// Exact rational numbers (BigInt). Used for every time mapping so nothing drifts: 1/600 s stays 1/600 s.
const big = (x) => (typeof x === 'bigint' ? x : BigInt(x));
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; };
export class Rat {
  constructor(n, d = 1n) {
    n = big(n); d = big(d); if (d === 0n) throw new RangeError('Rat: zero denominator');
    if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; this.n = n / g; this.d = d / g;
  }
  // Rat.of: integers, bigint, "p/q", exact decimal strings ("1.6"), [p,q]. A non-integer JS float is refused on purpose
  // (it would silently reinterpret 0.1). Use Rat.ofFloat(x) to say "I mean the shortest decimal of this float".
  static of(x) {
    if (x instanceof Rat) return x;
    if (typeof x === 'bigint') return new Rat(x);
    if (typeof x === 'number') { if (!Number.isInteger(x)) throw new TypeError('Rat.of: float ' + x + ' is not exact; pass a string or use Rat.ofFloat'); return new Rat(BigInt(x)); }
    if (Array.isArray(x) && x.length === 2) return new Rat(big(x[0]), big(x[1]));
    if (typeof x === 'string') {
      const s = x.trim(); let m;
      if ((m = /^(-?\d+)\/(\d+)$/.exec(s))) return new Rat(BigInt(m[1]), BigInt(m[2]));
      if ((m = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(s))) {
        const frac = m[3] || '', e = parseInt(m[4] || '0', 10); let n = BigInt(m[2] + frac), d = 10n ** BigInt(frac.length);
        if (e > 0) n *= 10n ** BigInt(e); else if (e < 0) d *= 10n ** BigInt(-e);
        return new Rat(m[1] ? -n : n, d);
      }
    }
    throw new TypeError('Rat.of: cannot read ' + JSON.stringify(x));
  }
  static ofFloat(x) { if (!Number.isFinite(x)) throw new RangeError('Rat.ofFloat: not finite'); return Rat.of(String(x)); }
  add(o) { o = Rat.of(o); return new Rat(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = Rat.of(o); return new Rat(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = Rat.of(o); return new Rat(this.n * o.n, this.d * o.d); }
  div(o) { o = Rat.of(o); return new Rat(this.n * o.d, this.d * o.n); }
  neg() { return new Rat(-this.n, this.d); }
  cmp(o) { o = Rat.of(o); const a = this.n * o.d, b = o.n * this.d; return a < b ? -1 : a > b ? 1 : 0; }
  eq(o) { return this.cmp(o) === 0; } lt(o) { return this.cmp(o) < 0; } lte(o) { return this.cmp(o) <= 0; } gt(o) { return this.cmp(o) > 0; } gte(o) { return this.cmp(o) >= 0; }
  get isInteger() { return this.d === 1n; }
  floor() { let q = this.n / this.d; if (this.n < 0n && this.n % this.d !== 0n) q -= 1n; return q; }
  ceil() { return -this.neg().floor(); }
  round() { return this.add(new Rat(1n, 2n)).floor(); }                // half rounds up
  toNumber() {
    const a = this.n < 0n ? -this.n : this.n;
    if (a < (1n << 53n) && this.d < (1n << 53n)) return Number(this.n) / Number(this.d);
    return Number((this.n << 64n) / this.d) / 2 ** 64;
  }
  toString() { return this.d === 1n ? this.n.toString() : this.n + '/' + this.d; }
  toJSON() { return this.toString(); }
}
export const rat = (x) => Rat.of(x);
export const ZERO = new Rat(0n), ONE = new Rat(1n);
