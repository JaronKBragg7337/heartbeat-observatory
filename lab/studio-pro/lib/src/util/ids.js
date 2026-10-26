// Stable IDs. Random by default (crypto), deterministic with a seed (tests, repeatable imports).
// Imported IDs are NEVER rewritten: a history keeps its own local IDs; the project-wide form is  namespace::localId.
const ALPHA = '0123456789abcdefghjkmnpqrstvwxyz';
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export class IdGen {
  constructor({ seed } = {}) { this.rnd = seed === undefined ? null : mulberry(seed); }
  _chars(n) {
    let s = '';
    if (this.rnd) for (let i = 0; i < n; i++) s += ALPHA[Math.floor(this.rnd() * 32)];
    else { const b = new Uint8Array(n); globalThis.crypto.getRandomValues(b); for (let i = 0; i < n; i++) s += ALPHA[b[i] & 31]; }
    return s;
  }
  make(prefix) { return prefix + '_' + this._chars(12); }
}
export const NS_SEP = '::';
export const qualify = (ns, id) => ns + NS_SEP + id;
export function splitQualified(id) { const i = id.indexOf(NS_SEP); return i < 0 ? { ns: null, id } : { ns: id.slice(0, i), id: id.slice(i + NS_SEP.length) }; }
export const isLocalId = (id) => typeof id === 'string' && id.length > 0 && !id.includes(NS_SEP);
export const isNamespace = (s) => typeof s === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(s);
