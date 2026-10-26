const VLQ = (n) => { const out = [n & 127]; while ((n >>= 7)) out.unshift((n & 127) | 128); return out; };
const text = (s) => [...new TextEncoder().encode(s)];
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n) => [(n >>> 8) & 255, n & 255];
const chunk = (tag, data) => [...text(tag), ...u32(data.length), ...data];

export function encodeMIDI(tracks, { ppq = 960, bpm = 120 } = {}) {
  const tempo = Math.round(60000000 / bpm);
  const chunks = [chunk('MTrk', [0, 0xff, 0x51, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255, 0, 0xff, 0x2f, 0])];
  for (const track of tracks) {
    const events = [];
    for (const note of track.notes || []) {
      const channel = note.channel || 0;
      events.push({ tick: note.tick, order: 1, bytes: [0x90 | channel, note.midi, Math.round((note.velocity ?? 0.8) * 127)] });
      events.push({ tick: note.tick + note.duration, order: 0, bytes: [0x80 | channel, note.midi, 0] });
      for (const cc of note.cc || []) events.push({ tick: note.tick + (cc.offset || 0), order: 0, bytes: [0xb0 | channel, cc.controller, cc.value] });
      if (note.bend !== undefined) { const n = Math.max(0, Math.min(16383, Math.round((note.bend + 1) * 8192))); events.push({ tick: note.tick, order: 0, bytes: [0xe0 | channel, n & 127, n >> 7] }); }
    }
    for (const event of track.events || []) if (event.type === 'cc') events.push({ tick: event.tick, order: 0, bytes: [0xb0 | (event.channel || 0), event.controller, event.value] });
    events.sort((a, b) => a.tick - b.tick || a.order - b.order);
    const data = [0, 0xff, 0x03, ...VLQ(track.name.length), ...text(track.name)]; let at = 0;
    for (const event of events) { data.push(...VLQ(event.tick - at), ...event.bytes); at = event.tick; }
    data.push(0, 0xff, 0x2f, 0); chunks.push(chunk('MTrk', data));
  }
  return new Uint8Array([...chunk('MThd', [...u32(6).slice(0, 0), 0, 1, ...u16(chunks.length), ...u16(ppq)]), ...chunks.flat()]);
}

function readVLQ(data, cursor) { let value = 0, b; do { b = data[cursor.i++]; value = (value << 7) | (b & 127); } while (b & 128); return value; }

export function decodeMIDI(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), cursor = { i: 0 };
  const tag = () => String.fromCharCode(...data.subarray(cursor.i, cursor.i += 4));
  const length = () => { const n = (data[cursor.i] << 24 | data[cursor.i + 1] << 16 | data[cursor.i + 2] << 8 | data[cursor.i + 3]) >>> 0; cursor.i += 4; return n; };
  if (tag() !== 'MThd') throw new Error('not a Standard MIDI File');
  const headerLength = length(), format = data[cursor.i] << 8 | data[cursor.i + 1], count = data[cursor.i + 2] << 8 | data[cursor.i + 3], ppq = data[cursor.i + 4] << 8 | data[cursor.i + 5];
  cursor.i = 8 + headerLength;
  if (format > 1) throw new Error('only SMF format 0 and 1 are supported');
  const tracks = []; let bpm = 120;
  for (let t = 0; t < count; t++) {
    if (tag() !== 'MTrk') throw new Error('bad MIDI track chunk'); const size = length(), end = cursor.i + size, notes = [], active = new Map(), events = []; let tick = 0, status = 0, name = `Track ${t + 1}`;
    while (cursor.i < end) {
      tick += readVLQ(data, cursor); let type = data[cursor.i++];
      if (type < 128) { cursor.i--; type = status; } else status = type;
      if (type === 0xff) { const meta = data[cursor.i++], size = readVLQ(data, cursor); if (meta === 0x51) bpm = 60000000 / ((data[cursor.i] << 16) | (data[cursor.i + 1] << 8) | data[cursor.i + 2]); if (meta === 0x03) name = new TextDecoder().decode(data.subarray(cursor.i, cursor.i + size)); cursor.i += size; continue; }
      if (type === 0xf0 || type === 0xf7) { cursor.i += readVLQ(data, cursor); continue; }
      const kind = type & 0xf0, channel = type & 15, a = data[cursor.i++], b = [0x80, 0x90, 0xa0, 0xb0, 0xe0].includes(kind) ? data[cursor.i++] : 0;
      const key = `${channel}:${a}`;
      if (kind === 0x90 && b > 0) active.set(key, { tick, midi: a, velocity: b / 127, channel });
      else if (kind === 0x80 || (kind === 0x90 && b === 0)) { const note = active.get(key); if (note) { notes.push({ ...note, duration: tick - note.tick }); active.delete(key); } }
      else if (kind === 0xb0) events.push({ type: 'cc', tick, channel, controller: a, value: b });
      else if (kind === 0xe0) events.push({ type: 'bend', tick, channel, value: ((b << 7 | a) / 8192) - 1 });
    }
    tracks.push({ name, notes, events, incomplete: [...active.values()] });
  }
  return { ppq, bpm, tracks, format };
}
