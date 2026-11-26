// Seeded random (mulberry32). The same seed always gives the same run. No three, no DOM: runs in Node tests.
export function makeRng(seed = 1) {
  let a = (seed >>> 0) || 0x9e3779b9;
  const r = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (lo, hi) => lo + (hi - lo) * r();
  r.int = (n) => Math.floor(r() * n);
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.chance = (p) => r() < p;
  return r;
}

export function seedFrom(value) {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return Math.floor(n) >>> 0;
  return (Math.floor(Math.random() * 2 ** 31) + 1) >>> 0;
}
