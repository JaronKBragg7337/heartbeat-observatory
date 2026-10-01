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
    return parse(await r.text());
  }
  async load() {
    const s = await this.rpc('cosmos_load', { wid: this.worldId });
    this.revision = s.record?.revision ?? null; return s;
  }
  async save(record, changed = []) {
    await this.rpc('cosmos_save', { wid: this.worldId, expected: this.revision, rec: record, changed });
    this.revision = record.revision;
  }
}
