import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { stringify, parse } from '../src/world-state/wire.js';

// Same atomic load/save contract as IndexedDB. The private server record includes
// hashed device identities and durable receipts; neither is broadcast.
export class FileAdapter {
  constructor(path) { this.path = path; this.bricks = new Map(); }
  async load() {
    try {
      const s = parse(await readFile(this.path, 'utf8'));
      this.bricks = new Map(s.bricks.map(b => [b.key, b])); return s;
    } catch (e) { if (e.code === 'ENOENT') return { record: null, bricks: [] }; throw e; }
  }
  /** Admin reset: forget every stored terrain brick (the world record is replaced by the next save). */
  async wipeProjections({ terrain = true } = {}) { if (terrain) this.bricks = new Map(); }
  async save(record, changed = []) {
    const next = new Map(this.bricks); for (const b of changed) next.set(b.key, b);
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path + '.tmp', stringify({ record, bricks: [...next.values()] }));
    await rename(this.path + '.tmp', this.path); this.bricks = next;
  }
}
export class SupabaseAdapter {
  constructor(url, key, worldId = 'meridian') { this.url = url.replace(/\/$/, ''); this.key = key; this.worldId = worldId; this.revision = null; }
  async rpc(name, args) {
    const r = await fetch(this.url + '/rest/v1/rpc/' + name, {
      method: 'POST', headers: { apikey: this.key, Authorization: 'Bearer ' + this.key, 'Content-Type': 'application/json' },
      body: stringify(args), signal: AbortSignal.timeout(15000),
    });
    // Deliberately omit server response bodies/URLs: credentials must never enter logs.
    if (!r.ok) throw Error(`Postgres ${name} failed (HTTP ${r.status}).`);
    const text = await r.text();
    // A void RPC (cosmos_save) answers 204 with an empty body.
    return text ? parse(text) : null;
  }
  async load() {
    const s = await this.rpc('cosmos_load', { wid: this.worldId });
    this.revision = s.record?.revision ?? null; return s;
  }
  /** Admin reset: delete the rows the ordinary save never prunes (terrain bricks, damage, receipts). Needs the service role. */
  async wipeProjections({ terrain = true } = {}) {
    for (const t of [...(terrain ? ['cosmos_terrain_bricks'] : []), 'cosmos_damage', 'cosmos_action_receipts', 'cosmos_crew_contracts', 'cosmos_pads']) {
      const r = await fetch(this.url + '/rest/v1/' + t + '?world_id=eq.' + encodeURIComponent(this.worldId), { method: 'DELETE',
        headers: { apikey: this.key, Authorization: 'Bearer ' + this.key }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw Error(`Postgres delete from ${t} failed (HTTP ${r.status}).`);
    }
  }
  /** The revision the database holds right now (one small row), or undefined if it cannot be read. */
  async remoteRevision() {
    try {
      const r = await fetch(this.url + '/rest/v1/cosmos_worlds?select=revision&world_id=eq.' + encodeURIComponent(this.worldId), {
        headers: { apikey: this.key, Authorization: 'Bearer ' + this.key }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) return undefined;
      const rows = JSON.parse(await r.text()); return rows[0] ? Number(rows[0].revision) : null;
    } catch { return undefined; }
  }
  /**
   * Save, and never let one bad answer wedge the world. A save that timed out or lost its connection may still have landed; if this.revision
   * were left behind, every later save would fail "World revision conflict" until a restart (the sticky "transactions are paused" that made
   * Jaron's phone say Transaction failed on 10/2-10/3). So after a failure we ask the database what it holds: if our snapshot is there, it
   * succeeded; if an older revision is there, adopt it and try once more.
   */
  async save(record, changed = []) {
    let failure;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.rpc('cosmos_save', { wid: this.worldId, expected: this.revision, rec: record, changed });
        this.revision = record.revision; return;
      } catch (e) {
        failure = e;
        const remote = await this.remoteRevision();
        if (remote === record.revision) { this.revision = record.revision; return; }          // it landed; only the answer was lost
        if (remote === undefined) { if (attempt >= 1) break; continue; }                      // cannot tell: one plain retry
        if (remote !== null && remote < record.revision && remote !== this.revision) { this.revision = remote; continue; }   // an earlier save landed unseen: catch up, retry
        if (remote === this.revision || (remote === null && this.revision === null)) { if (attempt >= 1) break; continue; }   // did not land: plain retry
        break;                                                                                 // someone else wrote: do not overwrite
      }
    }
    throw failure;
  }
}
