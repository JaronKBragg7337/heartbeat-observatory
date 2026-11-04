/* ============================================================================
   pet-core.js - the growing pet's body and life, with no three.js in it.
   ---------------------------------------------------------------------------
   Everything that can be tested in plain node lives here: the soft body made
   of cells (spheres), the springs that make it wobble, the little script that
   makes it wander / idle / sleep / eat / follow, the food, hunger, growth and
   the save shape. pet.js wraps this in meshes; test/pet-sim.test.mjs runs it
   for ten simulated minutes and checks it never explodes.

   Units: metres-ish. A new cell is ~0.16 across; a new pet is ~0.5 wide.
   The body keeps a "heading" (yaw). Every cell has a rest offset in body
   space; the shape spring pulls each cell to centre + rotate(rest, heading),
   neighbour springs keep the jelly together, and cells push each other apart
   when they overlap. That is the whole trick: a cloud of soft balls that
   remembers a shape loosely enough to jiggle.
   ========================================================================== */

export const PET_VERSION = 1;

/* a small seeded random so the test is repeatable (mulberry32) */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* the six colours a pet can hatch as; the renderer derives rim/deep/glow from `hex` */
export const PALETTE = [
  { id: "peach", name: "Peach", hex: "#ffb088" },
  { id: "mint", name: "Mint", hex: "#8fe3b4" },
  { id: "sky", name: "Sky", hex: "#8cc8ff" },
  { id: "lilac", name: "Lilac", hex: "#c9a6ff" },
  { id: "lemon", name: "Lemon", hex: "#f6e27a" },
  { id: "rose", name: "Rose", hex: "#ff9ac2" },
];

export const DEFAULTS = {
  cells: 24,            // cells at hatch (spec: 20 to 40)
  maxCells: 110,        // the size cap: the phone must keep 60 fps
  cellRadius: 0.16,
  pack: 1.0,            // fill fraction used for the body radius: R = r * cbrt(n / pack). Cells overlap: it reads as one bumpy body, not a pile of balls
  overlap: 0.66,        // two cells rest this fraction of (ra + rb) apart
  gravity: 14,
  kShape: 42,           // pull toward the remembered shape
  kSpring: 70,          // neighbour springs
  kRepel: 260,          // cells pushing apart when they overlap
  damping: 1.6,         // per second, on every velocity
  springDamp: 3.0,
  neighbours: 4,
  maxSpeed: 9,
  substep: 1 / 120,
  worldRadius: 2.7,     // how far from the origin it will wander / be led
  growEvery: 3,         // bites per new cell
  hungerPerSecond: 1 / (30 * 60),   // full to empty in 30 minutes of play
  foodValue: 0.12,
  maxFood: 6,
  sleepAfter: 75,       // seconds of nothing happening before a nap
};

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const hypot3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);

/* body radius for n cells of radius r, packed loosely into a ball */
export function bodyRadiusFor(n, r, pack = DEFAULTS.pack) {
  return r * Math.cbrt(Math.max(1, n) / pack);
}

/* n rest offsets packed into a ball of radius R: random fill, then relaxed so they sit ~2r apart */
export function packBall(n, R, r, rng, iterations = 80) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    // uniform in a ball, kept a bit flatter than tall so it sits like a jelly, not a marble
    const u = rng(), v = rng(), w = rng();
    const rad = R * Math.cbrt(u) * 0.92;
    const th = TAU * v, ph = Math.acos(2 * w - 1);
    pts.push({ x: rad * Math.sin(ph) * Math.cos(th), y: rad * Math.cos(ph) * 0.82, z: rad * Math.sin(ph) * Math.sin(th), r: r * (0.84 + rng() * 0.32) });
  }
  relaxRest(pts, R, iterations);
  return pts;
}

/* push rest offsets apart until none overlap much, keep them inside the ball. Mutates. */
export function relaxRest(pts, R, iterations = 1, strength = 0.5, overlap = DEFAULTS.overlap) {
  const n = pts.length;
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      for (let j = i + 1; j < n; j++) {
        const b = pts[j];
        let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        let d = hypot3(dx, dy, dz);
        const want = (a.r + b.r) * overlap;
        if (d < want) {
          if (d < 1e-5) { dx = 0.01 * (j - i); dy = 0.007; dz = -0.009; d = hypot3(dx, dy, dz); }
          const push = (want - d) * 0.5 * strength / d;
          a.x -= dx * push; a.y -= dy * push; a.z -= dz * push;
          b.x += dx * push; b.y += dy * push; b.z += dz * push;
        }
      }
    }
    // stay inside the (slightly squashed) ball, and lean gently toward the middle so it stays round and full
    for (const p of pts) {
      const ey = p.y / 0.82;
      const d = hypot3(p.x, ey, p.z);
      const lim = Math.max(0.01, R - p.r * 0.35);
      if (d > lim) { const s = lim / d; p.x *= s; p.y *= s; p.z *= s; }
      p.x *= 1 - 0.01 * strength; p.y *= 1 - 0.01 * strength; p.z *= 1 - 0.01 * strength;
    }
  }
  return pts;
}

/* ------------------------------------------------------------------ the sim */
export class PetSim {
  constructor(opts = {}) {
    this.o = { ...DEFAULTS, ...opts };
    this.rng = makeRng(opts.seed ?? ((Math.random() * 1e9) | 0));
    this.time = 0;
    this.cells = [];          // {x,y,z, vx,vy,vz, r, rx,ry,rz (rest), tint, born, squash, pulse}
    this.springs = [];        // {a,b,len}
    this.center = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.heading = opts.heading ?? 0;
    this.grounded = false;
    this.R = 0;

    // life
    this.name = opts.name || "Pip";
    this.colour = opts.colour || PALETTE[0].id;
    this.bornAt = opts.bornAt || Date.now();
    this.hunger = clamp(opts.hunger ?? 0.85, 0, 1);
    this.bites = opts.bites || 0;
    this.state = "idle";      // idle | wander | sleep | eat | follow | poked
    this.stateT = 0;          // seconds in the current state
    this.stateFor = 2;        // how long the current state lasts (idle/wander)
    this.mood = 0;            // -1 sad .. +1 happy, eases toward 0
    this.lastTouch = 0;       // sim time of the last tap / food / hold
    this.target = null;       // {x,z} where it is going
    this.followPoint = null;  // {x,z} while a finger is held
    this.lookAt = null;       // {x,y,z} what the eyes look toward (food, finger) or null
    this.faceHint = null;     // {x,z} where its person is (the camera); when idle it turns to face them
    this.foods = [];          // {x,y,z, vx,vy,vz, r, eaten:0..1, id}
    this.foodId = 0;
    this.hopT = 0;
    this.gulp = 0;            // 1 right after a bite, eases to 0; drives the gulp wave
    this.pokeT = 0;
    this.settle = 0;          // seconds of rest-offset relaxing left (after a bud)
    this.events = [];         // ["eat"|"grow"|"poke"|"sleep"|"wake"] since last drain
    this.nightHint = 0;       // 0..1, the host says how dark it is (more naps)
    this.isNight = () => this.nightHint > 0.5;

    this.build(opts.cells ?? this.o.cells, opts.position);
  }

  /* ------------------------------------------------------------ building */
  build(n, position) {
    n = clamp(n | 0, 1, this.o.maxCells);
    const r = this.o.cellRadius;
    this.R = bodyRadiusFor(n, r, this.o.pack);
    const rest = packBall(n, this.R, r, this.rng);
    const cx = position?.x ?? 0, cz = position?.z ?? 0;
    this.cells = rest.map((p, i) => ({
      x: cx + p.x, y: this.R + p.y + 0.05, z: cz + p.z, vx: 0, vy: 0, vz: 0,
      r: p.r, rx: p.x, ry: p.y, rz: p.z, tint: this.rng(), born: 0, squash: 0, pulse: 0, id: i,
    }));
    this.rebuildSprings();
    this.updateCenter();
  }

  rebuildSprings() {
    const c = this.cells, n = c.length, k = this.o.neighbours;
    const seen = new Set();
    this.springs = [];
    for (let i = 0; i < n; i++) {
      const a = c[i];
      const near = [];
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const b = c[j];
        near.push({ j, d: hypot3(b.rx - a.rx, b.ry - a.ry, b.rz - a.rz) });
      }
      near.sort((p, q) => p.d - q.d);
      for (let m = 0; m < Math.min(k, near.length); m++) {
        const j = near[m].j, key = i < j ? i * 4096 + j : j * 4096 + i;
        if (seen.has(key)) continue;
        seen.add(key);
        this.springs.push({ a: i, b: j, len: Math.max(near[m].d, (a.r + c[j].r) * this.o.overlap) });
      }
    }
  }

  updateCenter() {
    let x = 0, y = 0, z = 0, vx = 0, vy = 0, vz = 0;
    const n = this.cells.length;
    for (const c of this.cells) { x += c.x; y += c.y; z += c.z; vx += c.vx; vy += c.vy; vz += c.vz; }
    this.center.x = x / n; this.center.y = y / n; this.center.z = z / n;
    this.vel.x = vx / n; this.vel.y = vy / n; this.vel.z = vz / n;
  }

  get count() { return this.cells.length; }
  get full() { return this.cells.length >= this.o.maxCells; }
  get ageMs() { return Date.now() - this.bornAt; }
  /* 0 = fed, 1 = as hungry as it gets (it never starves; it just droops) */
  get droop() { return clamp((0.4 - this.hunger) / 0.4, 0, 1); }

  /* ------------------------------------------------------------ growing */
  /* one new cell buds from the surface and settles in */
  grow() {
    if (this.full) return false;
    const r = this.o.cellRadius;
    const n = this.cells.length + 1;
    const Rn = bodyRadiusFor(n, r, this.o.pack);
    const s = Rn / this.R;
    for (const c of this.cells) { c.rx *= s; c.ry *= s; c.rz *= s; }
    this.R = Rn;
    // a random direction on the lower half of the body (it buds from the side/belly, then rolls into place)
    const th = this.rng() * TAU, ph = Math.acos(1 - 2 * (0.35 + this.rng() * 0.6));
    const dx = Math.sin(ph) * Math.cos(th), dy = Math.cos(ph) * 0.82, dz = Math.sin(ph) * Math.sin(th);
    const rr = r * (0.84 + this.rng() * 0.32);
    const rest = { x: dx * (Rn - rr * 0.6), y: dy * (Rn - rr * 0.6), z: dz * (Rn - rr * 0.6), r: rr };
    const { x: wx, z: wz } = this.rotate(rest.x, rest.z);
    // it starts inside, near its parent surface, small, and pops out
    const cell = {
      x: this.center.x + wx * 0.55, y: Math.max(rr, this.center.y + rest.y * 0.55), z: this.center.z + wz * 0.55,
      vx: wx * 1.2, vy: 0.8, vz: wz * 1.2,
      r: rr, rx: rest.x, ry: rest.y, rz: rest.z, tint: this.rng(), born: this.time, squash: 0, pulse: 0, id: this.cells.length,
    };
    this.cells.push(cell);
    this.rebuildSprings();
    this.settle = 2.5;
    this.events.push("grow");
    return true;
  }

  /* ------------------------------------------------------------ food */
  dropFood(x, z, y = 1.4) {
    const wr = this.o.worldRadius;
    const d = Math.hypot(x, z);
    if (d > wr) { x *= wr / d; z *= wr / d; }
    if (this.foods.length >= this.o.maxFood) this.foods.shift();
    const f = { id: ++this.foodId, x, y, z, vx: 0, vy: 0, vz: 0, r: 0.075, eaten: 0, bounces: 0 };
    this.foods.push(f);
    this.lastTouch = this.time;
    if (this.state === "sleep") this.wake();
    return f;
  }

  /* ------------------------------------------------------------ touch */
  poke() {
    this.lastTouch = this.time;
    if (this.state === "sleep") { this.wake(); }
    this.pokeT = 0.9;
    this.mood = Math.min(1, this.mood + 0.6);
    this.gulp = Math.max(this.gulp, 0.5);
    // a squish: top cells get pushed down, the sides bulge out
    const c = this.center;
    for (const cell of this.cells) {
      const h = (cell.y - c.y) / Math.max(0.05, this.R);
      const dx = cell.x - c.x, dz = cell.z - c.z, d = Math.hypot(dx, dz) || 1;
      cell.vy -= 1.6 * Math.max(0, h) + 0.3;
      cell.vx += (dx / d) * 1.1; cell.vz += (dz / d) * 1.1;
    }
    this.events.push("poke");
    if (this.state !== "eat") this.setState("poked");
  }

  /* hold a point (ground x,z) to lead it; null when the finger lifts */
  follow(point) {
    if (point) {
      this.followPoint = { x: point.x, z: point.z };
      this.lastTouch = this.time;
      if (this.state === "sleep") this.wake();
      if (this.state !== "follow" && this.state !== "poked") this.setState("follow");
    } else {
      this.followPoint = null;
      if (this.state === "follow") this.setState("idle");
    }
  }

  wake() { if (this.state === "sleep") { this.setState("idle"); this.events.push("wake"); } }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.stateT = 0;
    if (s === "idle") this.stateFor = 1.5 + this.rng() * 4;
    if (s === "wander") {
      this.stateFor = 3 + this.rng() * 5;
      const a = this.rng() * TAU, d = 0.6 + this.rng() * (this.o.worldRadius - 0.8);
      this.target = { x: Math.cos(a) * d, z: Math.sin(a) * d };
    }
    if (s === "sleep") { this.stateFor = 25 + this.rng() * 30; this.events.push("sleep"); }
    if (s === "poked") this.stateFor = 0.9;
  }

  /* ------------------------------------------------------------ the brain */
  think(dt) {
    this.stateT += dt;
    const o = this.o;
    this.hunger = clamp(this.hunger - o.hungerPerSecond * dt, 0, 1);
    this.mood *= Math.exp(-dt * 0.35);

    // food is interesting whenever we are awake (or sleeping lightly and hungry)
    const food = this.nearestFood();
    if (food && this.state !== "follow" && this.state !== "eat" && this.state !== "poked") {
      if (this.state !== "sleep" || this.hunger < 0.5) { this.wake(); this.setState("eat"); }
    }

    switch (this.state) {
      case "idle":
        this.target = null;
        if (this.stateT > this.stateFor) {
          const quiet = this.time - this.lastTouch > o.sleepAfter;
          const nap = quiet && this.rng() < (this.isNight() ? 0.75 : 0.35);
          this.setState(nap ? "sleep" : (this.rng() < 0.7 ? "wander" : "idle"));
        }
        break;
      case "wander":
        if (this.stateT > this.stateFor || (this.target && Math.hypot(this.target.x - this.center.x, this.target.z - this.center.z) < 0.25)) this.setState("idle");
        break;
      case "sleep":
        this.target = null;
        if (this.stateT > this.stateFor && !(this.isNight() && this.rng() < 0.8)) { this.setState("idle"); this.events.push("wake"); }
        break;
      case "poked":
        if (this.stateT > this.stateFor) this.setState(this.followPoint ? "follow" : "idle");
        break;
      case "follow":
        if (!this.followPoint) { this.setState("idle"); break; }
        this.target = this.followPoint;
        break;
      case "eat": {
        if (!food) { this.setState("idle"); break; }
        this.target = { x: food.x, z: food.z };
        const reach = this.R * 0.95 + food.r;
        const d = Math.hypot(food.x - this.center.x, food.z - this.center.z);
        if (d < reach && food.y < this.R * 1.2) {
          food.eaten += dt * 3.2;                 // it slides in over ~0.3 s
          if (food.eaten >= 1) this.eat(food);
        }
        break;
      }
    }
  }

  eat(food) {
    const i = this.foods.indexOf(food);
    if (i >= 0) this.foods.splice(i, 1);
    this.bites++;
    this.hunger = clamp(this.hunger + this.o.foodValue, 0, 1);
    this.mood = Math.min(1, this.mood + 0.5);
    this.gulp = 1;
    this.events.push("eat");
    // the gulp: a wave through the body, plus a little hop of joy
    for (const c of this.cells) c.vy += 0.9;
    if (this.bites % this.o.growEvery === 0) this.grow();
  }

  nearestFood() {
    let best = null, bd = Infinity;
    for (const f of this.foods) {
      if (f.y > this.R * 1.5 + 0.3) continue;  // still falling: wait
      const d = Math.hypot(f.x - this.center.x, f.z - this.center.z);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  /* where the eyes point: a finger, then food, then the way it walks, else nothing (straight ahead) */
  updateLook() {
    if (this.followPoint) this.lookAt = { x: this.followPoint.x, y: 0.1, z: this.followPoint.z };
    else if (this.state === "eat" && this.foods.length) { const f = this.nearestFood() || this.foods[0]; this.lookAt = { x: f.x, y: f.y, z: f.z }; }
    else if (this.target && this.state === "wander") this.lookAt = { x: this.target.x, y: 0.2, z: this.target.z };
    else if (this.faceHint && this.state !== "sleep") this.lookAt = { x: this.faceHint.x, y: 1.2, z: this.faceHint.z };
    else this.lookAt = null;
  }

  /* ------------------------------------------------------------ physics */
  rotate(x, z) { const c = Math.cos(this.heading), s = Math.sin(this.heading); return { x: c * x + s * z, z: c * z - s * x }; }

  step(dt) {
    dt = clamp(dt, 0, 0.05);
    this.think(dt);
    this.updateLook();
    const h = this.o.substep;
    let n = Math.ceil(dt / h);
    if (n > 6) n = 6;
    const sub = dt / Math.max(1, n);
    for (let i = 0; i < n; i++) this.integrate(sub);
    this.time += dt;
    this.gulp = Math.max(0, this.gulp - dt * 1.7);
    this.pokeT = Math.max(0, this.pokeT - dt);
    if (this.settle > 0) {
      this.settle -= dt;
      const rest = this.cells.map((c) => ({ x: c.rx, y: c.ry, z: c.rz, r: c.r, c }));
      relaxRest(rest, this.R, 1, 0.35, this.o.overlap);
      for (const p of rest) { p.c.rx = p.x; p.c.ry = p.y; p.c.rz = p.z; }
      if (this.settle <= 0) this.rebuildSprings();
    }
    this.stepFood(dt);
    this.updateCenter();
  }

  /* the body's own will: a target velocity on the ground, and hops when it moves */
  drive(dt) {
    const o = this.o;
    let want = { x: 0, z: 0 }, speed = 0, hop = 0;
    if (this.target && (this.state === "wander" || this.state === "follow" || this.state === "eat")) {
      const dx = this.target.x - this.center.x, dz = this.target.z - this.center.z, d = Math.hypot(dx, dz);
      speed = this.state === "wander" ? 0.75 : this.state === "eat" ? 1.25 : 1.7;
      speed *= 1 - 0.45 * this.droop;
      const stop = this.state === "follow" ? this.R * 0.6 + 0.15 : 0.08;
      if (d > stop) {
        const ease = Math.min(1, (d - stop) / 0.6);
        want = { x: (dx / d) * speed * ease, z: (dz / d) * speed * ease };
        hop = this.state === "wander" ? 0.62 : 0.46;
        hop *= 1 + 0.35 * this.droop;
        // turn toward the way we go
        const aim = Math.atan2(dx, dz);
        let diff = aim - this.heading;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        this.heading += diff * Math.min(1, dt * 6);
      }
    }
    // nothing to do: turn, slowly, to face its person
    if (hop === 0 && this.faceHint && (this.state === "idle" || this.state === "poked")) {
      const aim = Math.atan2(this.faceHint.x - this.center.x, this.faceHint.z - this.center.z);
      let diff = aim - this.heading;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      this.heading += diff * Math.min(1, dt * 1.6);
    }
    // keep it on the patch
    const cd = Math.hypot(this.center.x, this.center.z);
    if (cd > o.worldRadius) { want.x -= (this.center.x / cd) * (cd - o.worldRadius) * 4; want.z -= (this.center.z / cd) * (cd - o.worldRadius) * 4; }
    return { want, hop };
  }

  integrate(h) {
    const o = this.o, cells = this.cells, n = cells.length;
    const { want, hop } = this.drive(h);
    const wakeF = this.state === "sleep" ? 0.35 : 1;
    const droop = this.droop;
    // breathing while asleep, and the gulp wave; both reshape the rest offsets a little
    const breathe = this.state === "sleep" ? 1 + 0.035 * Math.sin(this.time * 1.6) : 1 + 0.008 * Math.sin(this.time * 2.2);
    const kShape = o.kShape * (this.state === "sleep" ? 0.8 : 1);
    const cx = this.center.x, cy = this.center.y, cz = this.center.z;
    const ch = Math.cos(this.heading), sh = Math.sin(this.heading);
    const restY = this.R * (this.state === "sleep" ? 0.92 : 1) * (1 - 0.3 * droop) + o.gravity / (kShape * 0.8);   // where the middle wants to sit (gravity's sag is paid back so it stays round, not a puddle)
    const g = o.gravity;
    this.grounded = false;

    // shape + gravity + drive + ground
    for (let i = 0; i < n; i++) {
      const c = cells[i];
      // gulp wave travels from the front (+z in body space) to the back
      let pulse = 0;
      if (this.gulp > 0) {
        const along = (c.rz / Math.max(0.05, this.R)) * 0.5 + 0.5;         // 1 front .. 0 back
        const ph = (1 - this.gulp) * 2.2 - (1 - along) * 1.2;
        pulse = Math.max(0, Math.sin(ph * Math.PI)) * 0.28 * this.gulp;
      }
      c.pulse = pulse;
      const sx = breathe * (1 + pulse * 0.6) * (1 + 0.14 * droop), sy = breathe * (1 + pulse) * (1 - 0.26 * droop), sz = sx;
      const rx = c.rx * sx, ry = c.ry * sy, rz = c.rz * sz;
      const tx = cx + ch * rx + sh * rz, ty = restY + ry, tz = cz + ch * rz - sh * rx;
      c.vx += (tx - c.x) * kShape * h;
      c.vy += (ty - c.y) * kShape * 0.8 * h;
      c.vz += (tz - c.z) * kShape * h;
      c.vy -= g * h;
      // the will of the body, spread over every cell
      c.vx += (want.x - this.vel.x) * 6 * wakeF * h;
      c.vz += (want.z - this.vel.z) * 6 * wakeF * h;
    }

    // neighbour springs (with damping along the spring)
    const kS = o.kSpring, sd = o.springDamp;
    for (const s of this.springs) {
      const a = cells[s.a], b = cells[s.b];
      let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      let d = hypot3(dx, dy, dz);
      if (d < 1e-6) continue;
      dx /= d; dy /= d; dz /= d;
      const rel = (b.vx - a.vx) * dx + (b.vy - a.vy) * dy + (b.vz - a.vz) * dz;
      const f = ((d - s.len) * kS + rel * sd) * h;
      a.vx += dx * f; a.vy += dy * f; a.vz += dz * f;
      b.vx -= dx * f; b.vy -= dy * f; b.vz -= dz * f;
    }

    // cells push apart when they overlap (soft)
    const kR = o.kRepel;
    for (let i = 0; i < n; i++) {
      const a = cells[i];
      for (let j = i + 1; j < n; j++) {
        const b = cells[j];
        const want = (a.r + b.r) * o.overlap;
        let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        if (dx > want || dx < -want || dz > want || dz < -want) continue;
        let d = hypot3(dx, dy, dz);
        if (d >= want) continue;
        if (d < 1e-5) { dx = 0.001 * (j - i); dy = 0.0007; dz = 0.0009; d = hypot3(dx, dy, dz); }
        const f = ((want - d) * kR * h) / d;
        a.vx -= dx * f; a.vy -= dy * f; a.vz -= dz * f;
        b.vx += dx * f; b.vy += dy * f; b.vz += dz * f;
      }
    }

    // damping, speed clamp, move, ground
    const damp = Math.exp(-o.damping * h), vmax = o.maxSpeed;
    for (let i = 0; i < n; i++) {
      const c = cells[i];
      c.vx *= damp; c.vy *= damp; c.vz *= damp;
      const sp = hypot3(c.vx, c.vy, c.vz);
      if (sp > vmax) { const s = vmax / sp; c.vx *= s; c.vy *= s; c.vz *= s; }
      c.x += c.vx * h; c.y += c.vy * h; c.z += c.vz * h;
      const floor = c.r * 0.92;   // the jelly flattens a touch where it touches the grass
      if (c.y < floor) {
        c.y = floor;
        if (c.vy < 0) c.vy = -c.vy * 0.25;
        c.vx *= 0.92; c.vz *= 0.92;
        this.grounded = true;
        c.squash = Math.min(1, c.squash + 0.5);
      }
      c.squash *= Math.exp(-h * 6);
      // never let a single cell be flung off: a hard leash to the centre
      const lx = c.x - cx, ly = c.y - cy, lz = c.z - cz, ld = hypot3(lx, ly, lz), leash = this.R * 1.9 + 0.2;
      if (ld > leash) { const s = leash / ld; c.x = cx + lx * s; c.y = cy + ly * s; c.z = cz + lz * s; c.vx *= 0.5; c.vy *= 0.5; c.vz *= 0.5; }
      // NaN guard: if anything ever goes wrong, put the cell back at its rest spot instead of poisoning the body
      if (!(c.x === c.x) || !(c.y === c.y) || !(c.z === c.z) || !(c.vx === c.vx) || !(c.vy === c.vy) || !(c.vz === c.vz)) {
        c.x = cx + c.rx; c.y = restY + c.ry; c.z = cz + c.rz; c.vx = c.vy = c.vz = 0;
      }
    }

    // hop when we mean to move
    this.hopT -= h;
    if (hop > 0 && this.grounded && this.hopT <= 0) {
      this.hopT = hop;
      const up = 2.0 + 0.25 * Math.min(1, hypot3(want.x, 0, want.z));
      for (const c of cells) { c.vy += up; c.vx += want.x * 0.9; c.vz += want.z * 0.9; }
    }
    this.updateCenter();
  }

  stepFood(dt) {
    for (const f of this.foods) {
      if (f.eaten > 0) {
        // slide toward the belly as it is swallowed
        const t = Math.min(1, dt * 10);
        f.x += (this.center.x - f.x) * t; f.y += (this.center.y * 0.6 - f.y) * t; f.z += (this.center.z - f.z) * t;
        continue;
      }
      if (f.y > f.r || f.vy > 0) {
        f.vy -= this.o.gravity * dt;
        f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
        if (f.y < f.r) {
          f.y = f.r; f.bounces++;
          f.vy = f.bounces < 3 ? -f.vy * 0.38 : 0;
          f.vx = (this.rng() - 0.5) * 0.4 * (f.bounces < 3 ? 1 : 0); f.vz = (this.rng() - 0.5) * 0.4 * (f.bounces < 3 ? 1 : 0);
        }
      } else { f.vx *= 0.9; f.vz *= 0.9; f.x += f.vx * dt; f.z += f.vz * dt; }
    }
  }

  /* stuff that happened since you last asked (for sounds, labels) */
  drainEvents() { const e = this.events; this.events = []; return e; }

  /* ------------------------------------------------------------ save */
  toJSON() {
    return { v: PET_VERSION, name: this.name, colour: this.colour, cells: this.cells.length, bites: this.bites,
      hunger: +this.hunger.toFixed(4), bornAt: this.bornAt, savedAt: Date.now() };
  }

  /* a saved pet comes back the same size; offline time makes it a bit hungry, never starving */
  static fromJSON(data, opts = {}) {
    if (!data || typeof data !== "object") return null;
    const cells = clamp(data.cells | 0, 1, (opts.maxCells || DEFAULTS.maxCells));
    const away = Math.max(0, (Date.now() - (data.savedAt || Date.now())) / 3.6e6);   // hours
    const hunger = Math.max(Math.min(0.3, data.hunger ?? 0.8), (data.hunger ?? 0.8) - away * 0.08);
    return new PetSim({ ...opts, cells: cells || DEFAULTS.cells, name: data.name, colour: data.colour, bites: data.bites | 0, hunger, bornAt: data.bornAt || Date.now() });
  }
}

/* a readable age: "just hatched", "12 min", "3 h", "2 d" */
export function formatAge(ms) {
  const m = ms / 60000;
  if (m < 1) return "just hatched";
  if (m < 60) return `${Math.floor(m)} min old`;
  const hrs = m / 60;
  if (hrs < 48) return `${Math.floor(hrs)} h old`;
  return `${Math.floor(hrs / 24)} d old`;
}
