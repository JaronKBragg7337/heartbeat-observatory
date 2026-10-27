// SHA-256 (sync, pure JS, same result in browser and Node) + canonical JSON hashing.
// Hash strings look like "sha256:<64 hex>". Asset IDs in a project are these hashes.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

export function sha256Bytes(data) {                    // Uint8Array -> Uint8Array(32)
  const n = data.length, full = n - (n % 64);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  const rest = n - full, tailLen = rest + 9 <= 64 ? 64 : 128, tail = new Uint8Array(tailLen);
  tail.set(data.subarray(full)); tail[rest] = 0x80;
  const dv = new DataView(tail.buffer);
  dv.setUint32(tailLen - 8, Math.floor(n / 0x20000000), false); dv.setUint32(tailLen - 4, (n * 8) >>> 0, false);
  const block = (buf, off) => {
    for (let i = 0; i < 16; i++) { const j = off + i * 4; W[i] = (buf[j] << 24) | (buf[j + 1] << 16) | (buf[j + 2] << 8) | buf[j + 3]; }
    for (let i = 16; i < 64; i++) {
      const a = W[i - 15], b = W[i - 2];
      W[i] = ((((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3)) + W[i - 7] + (((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10)) + W[i - 16]) | 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
      const t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  };
  for (let off = 0; off < full; off += 64) block(data, off);
  for (let off = 0; off < tailLen; off += 64) block(tail, off);
  const out = new Uint8Array(32), ov = new DataView(out.buffer); for (let i = 0; i < 8; i++) ov.setUint32(i * 4, H[i], false);
  return out;
}
export const toHex = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += HEX[u8[i]]; return s; };
export const hashBytes = (u8) => 'sha256:' + toHex(sha256Bytes(u8));
const enc = new TextEncoder();
export const utf8 = (s) => enc.encode(s);
export const hashString = (s) => hashBytes(utf8(s));
export const isHash = (s) => typeof s === 'string' && /^sha256:[0-9a-f]{64}$/.test(s);

// Canonical JSON: sorted keys, no whitespace, finite numbers only. Same value -> same bytes -> same hash on every machine.
export function canonical(v) {
  if (v === null) return 'null';
  const t = typeof v;
  if (t === 'number') { if (!Number.isFinite(v)) throw new TypeError('canonical: non-finite number'); return JSON.stringify(v); }
  if (t === 'string' || t === 'boolean') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map((x) => (x === undefined ? 'null' : canonical(x))).join(',') + ']';
  if (t === 'object') {
    if (typeof v.toJSON === 'function') return canonical(v.toJSON());
    const ks = Object.keys(v).filter((k) => v[k] !== undefined).sort();
    return '{' + ks.map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  }
  throw new TypeError('canonical: unsupported ' + t);
}
export const hashJSON = (v) => hashString(canonical(v));
