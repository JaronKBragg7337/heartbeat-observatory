// ============================================================================
// cinema/math.js — camera paths, letterbox, and the film clock. No three.js,
// no DOM, so a shot can be replayed in Node and the same numbers come back.
//
// A shot is JSON. Playing it twice from the same clock gives the same eye,
// target, and fov. The world around the camera (a ship climbing, an elevator)
// is replayed by stepping the game at the shot's fixed dt from the same start.
// ============================================================================

export const FILM_ASPECT = 2.39;
export const RIGS = ['orbit', 'dolly', 'chase', 'push', 'handheld'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { const t = clamp(u, 0, 1); return t * t * (3 - 2 * t); };

export function v3(x, y, z) {
  if (Array.isArray(x)) return { x: x[0], y: x[1], z: x[2] };
  if (x && typeof x === 'object') return { x: x.x, y: x.y, z: x.z };
  return { x, y, z };
}
const add = (a, b, s = 1) => ({ x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s });
const sub = (a, b) => add(a, b, -1);
const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const norm = (a) => { const l = len(a) || 1; return scale(a, 1 / l); };
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x,
});
const dist = (a, b) => len(sub(a, b));
const lerpV = (a, b, u) => add(a, sub(b, a), u);

/** Black bars for a 2.39:1 picture inside a viewport. Equal bars, picture aspect exact. */
export function letterbox(width, height, aspect = FILM_ASPECT) {
  const w = Math.max(1, width), h = Math.max(1, height), a = aspect > 0 ? aspect : FILM_ASPECT;
  if (w / h > a) {
    const pictureW = h * a, side = (w - pictureW) / 2;
    return { top: 0, bottom: 0, left: side, right: side, pictureW, pictureH: h, aspect: a };
  }
  const pictureH = w / a, bar = (h - pictureH) / 2;
  return { top: bar, bottom: bar, left: 0, right: 0, pictureW: w, pictureH, aspect: a };
}

/** How many frames a shot lasts, and the time of frame i. The step is 1/fps, not the display clock. */
export function frameCount(duration, fps = 24) {
  const n = Math.round(Math.max(0, duration) * fps);
  return Math.max(1, n);
}
export function frameTime(i, fps = 24) { return i / fps; }
export function frameTimes(duration, fps = 24) {
  const n = frameCount(duration, fps);
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = i / fps;
  return out;
}

/**
 * Depth of field reads the logarithmic depth buffer three.js writes:
 *   gl_FragDepth = log2(1 + w) * logDepthBufFC * 0.5
 *   logDepthBufFC = 2 / log2(far + 1)
 * w is the view-space w of the fragment (positive distance from the camera).
 */
export function logDepthBufFC(far) {
  return 2 / (Math.log(far + 1) / Math.LN2);
}
export function packLogDepth(viewW, far) {
  const w = Math.max(0, viewW);
  return Math.log2(1 + w) * logDepthBufFC(far) * 0.5;
}
export function viewWFromLogDepth(depth, far) {
  const fc = logDepthBufFC(far);
  return Math.pow(2, depth * 2 / fc) - 1;
}

/** Film post is the desktop high tier. Phones and the safe tier stay on the plain renderer. */
export function postAllowed({ tier, safe = false } = {}) {
  return tier === 'high' && !safe;
}

/** A filmed stick. Absent fields are left to the flight computer. */
export function applyCinemaFlight(flight, script) {
  if (!flight || !script) return flight;
  const c = flight.controls;
  if (script.lift != null) c.lift = script.lift;
  if (script.fwd != null) c.fwd = script.fwd;
  if (script.yaw != null) c.yaw = script.yaw;
  if (script.climbCap != null) flight.climbCap = script.climbCap;
  if (script.thrustDown != null) flight.thrustDown = !!script.thrustDown;
  if (script.autoHover != null) flight.autoHover = !!script.autoHover;
  if (script.gearPos != null) flight.gearPos = script.gearPos;
  return flight;
}

function hash01(i, seed) {
  let x = Math.imul((i | 0) + Math.imul(seed | 0, 997) + 1, 0x9e3779b1);
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x ^= x >>> 13;
  return (x >>> 0) / 4294967295;
}
function valueNoise(t, seed) {
  const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
  return hash01(i, seed) * (1 - u) + hash01(i + 1, seed) * u;
}

/** Deterministic handheld offset, in metres and radians. Same seed and t, same shake. */
export function handheldOffset(t, shake) {
  if (!shake || !(shake.amount > 0 || shake.roll > 0)) return { x: 0, y: 0, z: 0, roll: 0 };
  const speed = shake.speed > 0 ? shake.speed : 1.4;
  const s = shake.seed | 0;
  const n = (axis) => valueNoise(t * speed, s + axis * 17) - 0.5;
  const amount = shake.amount || 0;
  return { x: n(1) * amount, y: n(2) * amount, z: n(3) * amount, roll: n(4) * (shake.roll || 0) };
}

function catmull(p0, p1, p2, p3, u) {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}
function catmullV(a, b, c, d, u) {
  return {
    x: catmull(a.x, b.x, c.x, d.x, u),
    y: catmull(a.y, b.y, c.y, d.y, u),
    z: catmull(a.z, b.z, c.z, d.z, u),
  };
}

function sampleDolly(rig, t) {
  const keys = rig.keys;
  if (!keys || keys.length === 0) throw new Error('dolly rig needs keys');
  const eyes = keys.map((k) => v3(k.eye));
  const targets = keys.map((k) => v3(k.target));
  const times = keys.map((k, i) => (k.t == null ? i : k.t));
  if (t <= times[0]) return pack(eyes[0], targets[0], keys[0].fov, rig);
  const last = times.length - 1;
  if (t >= times[last]) return pack(eyes[last], targets[last], keys[last].fov, rig);
  let i = 0;
  while (i < last - 1 && times[i + 1] < t) i++;
  const span = times[i + 1] - times[i] || 1;
  const u = (t - times[i]) / span;
  const at = (arr, j) => arr[clamp(j, 0, last)];
  const eye = catmullV(at(eyes, i - 1), at(eyes, i), at(eyes, i + 1), at(eyes, i + 2), u);
  const target = catmullV(at(targets, i - 1), at(targets, i), at(targets, i + 1), at(targets, i + 2), u);
  const fov = keys[i].fov == null && keys[i + 1].fov == null ? rig.fov
    : lerp(keys[i].fov ?? rig.fov ?? keys[i + 1].fov, keys[i + 1].fov ?? rig.fov ?? keys[i].fov, u);
  return pack(eye, target, fov, rig);
}

function sampleOrbit(rig, t) {
  const dur = rig.duration > 0 ? rig.duration : 1;
  const u = smooth(t / dur);
  const yaw = lerp(rig.yaw0 ?? 0, rig.yaw1 ?? Math.PI * 0.5, u);
  const target = v3(rig.target || [0, 0, 0]);
  const radius = rig.radius ?? 20;
  const eye = {
    x: target.x + Math.sin(yaw) * radius,
    y: target.y + (rig.height ?? 8),
    z: target.z + Math.cos(yaw) * radius,
  };
  return pack(eye, target, rig.fov, rig);
}

function samplePush(rig, t) {
  const dur = rig.duration > 0 ? rig.duration : 1;
  const u = smooth(t / dur);
  const eye = lerpV(v3(rig.from), v3(rig.to), u);
  const target = lerpV(v3(rig.target), v3(rig.targetTo || rig.target), u);
  const fov = rig.fov0 == null ? rig.fov : lerp(rig.fov0, rig.fov1 ?? rig.fov0, u);
  return pack(eye, target, fov, rig);
}

function along(from, to, u) { return lerpV(v3(from), v3(to), clamp(u, 0, 1)); }

/** Heading basis in a local frame: +x right, +y up, +z back, nose along -z. */
export function headingBasis(from, to, up) {
  const upN = norm(v3(up || [0, 1, 0]));
  let fwd = sub(v3(to), v3(from));
  const vertical = dot(fwd, upN);
  fwd = sub(fwd, scale(upN, vertical));
  if (len(fwd) < 1e-6) fwd = cross(upN, { x: 1, y: 0, z: 0 });
  if (len(fwd) < 1e-6) fwd = { x: 0, y: 0, z: -1 };
  fwd = norm(fwd);
  const right = norm(cross(fwd, upN));
  const back = scale(fwd, -1);
  return { right, up: upN, back, fwd };
}

function sampleChase(rig, t) {
  const dur = rig.duration > 0 ? rig.duration : 1;
  const u = smooth(t / dur);
  let eyeOff = v3(rig.offset || [20, 8, 30]);
  let look = v3(rig.look || [0, 2, -8]);
  if (rig.offsetTo) eyeOff = lerpV(eyeOff, v3(rig.offsetTo), u);
  if (rig.lookTo) look = lerpV(look, v3(rig.lookTo), u);
  // A moving subject in the same frame: the offset is in the subject's heading basis.
  if (rig.subject) {
    const su = t / dur;
    const pos = along(rig.subject.from, rig.subject.to, su);
    const ahead = along(rig.subject.from, rig.subject.to, Math.min(1, su + 0.02));
    const b = headingBasis(pos, ahead, rig.subject.up || [0, 1, 0]);
    const eye = add(add(add(pos, b.right, eyeOff.x), b.up, eyeOff.y), b.back, eyeOff.z);
    const target = add(add(add(pos, b.right, look.x), b.up, look.y), b.fwd, -look.z);
    return pack(eye, target, rig.fov, rig);
  }
  // Glued to a ship: both points are in the ship frame and converted later.
  return pack(eyeOff, look, rig.fov, rig);
}

function pack(eye, target, fov, rig) {
  return { eye, target, fov: fov ?? rig.fov ?? null, roll: 0, frame: rig.frame || null };
}

export function sampleRig(rig, t) {
  if (!rig || !rig.type) throw new Error('rig needs a type');
  if (rig.type === 'handheld') {
    const inner = sampleRig(rig.rig, t);
    const o = handheldOffset(t, rig);
    inner.eye = add(inner.eye, o);
    inner.roll += o.roll;
    return inner;
  }
  if (rig.type === 'dolly') return sampleDolly(rig, t);
  if (rig.type === 'orbit') return sampleOrbit(rig, t);
  if (rig.type === 'push') return samplePush(rig, t);
  if (rig.type === 'chase') return sampleChase(rig, t);
  throw new Error('unknown rig: ' + rig.type);
}

export function sampleShot(shot, t) {
  const s = sampleRig(shot.rig, t);
  if (shot.shake) {
    const o = handheldOffset(t, shot.shake);
    s.eye = add(s.eye, o);
    s.roll += o.roll;
  }
  s.frame = s.frame || shot.frame || 'world';
  if (s.fov == null) s.fov = shot.fov ?? 40;
  s.focus = shot.focus == null ? 40 : shot.focus;
  s.aperture = shot.aperture == null ? 0.02 : shot.aperture;
  s.motion = shot.motion == null ? 0.7 : shot.motion;
  return s;
}

const BEATS = ['port-dusk', 'tower', 'liftoff', 'climb', 'limb', 'phobos', 'raider', 'crew', 'tunnel'];

/** Parse a shot or a shot list. Throws if a path could not be played back. */
export function parseShot(data) {
  const shot = typeof data === 'string' ? JSON.parse(data) : data;
  if (!shot || typeof shot !== 'object') throw new Error('shot is not an object');
  if (!shot.id) throw new Error('shot needs an id');
  if (!(shot.duration > 0)) throw new Error(shot.id + ' needs a duration');
  if (!(shot.fps > 0)) throw new Error(shot.id + ' needs an fps');
  if (!shot.rig || !RIGS.includes(shot.rig.type)) throw new Error(shot.id + ' needs a known rig');
  if (shot.rig.type === 'dolly' && (!shot.rig.keys || shot.rig.keys.length < 2)) throw new Error(shot.id + ' dolly needs two keys');
  if (shot.rig.type === 'handheld' && (!shot.rig.rig || !RIGS.includes(shot.rig.rig.type))) throw new Error(shot.id + ' handheld needs an inner rig');
  sampleShot(shot, 0);
  sampleShot(shot, shot.duration);
  return shot;
}

export function parseShotList(data) {
  const list = typeof data === 'string' ? JSON.parse(data) : data;
  const shots = Array.isArray(list) ? list : list.shots;
  if (!Array.isArray(shots)) throw new Error('shot list needs shots');
  if (shots.length < 8 || shots.length > 12) throw new Error('a trailer list is 8 to 12 shots, got ' + shots.length);
  const parsed = shots.map(parseShot);
  const ids = new Set(parsed.map((s) => s.id));
  if (ids.size !== parsed.length) throw new Error('shot ids must be unique');
  const beats = new Set(parsed.map((s) => s.beat));
  for (const b of BEATS) if (!beats.has(b)) throw new Error('shot list is missing ' + b);
  return { version: list.version || 1, shots: parsed };
}

export function serializeShot(shot) {
  return JSON.stringify(parseShot(shot));
}

/** Where a scripted subject sits in its frame at time t. Used by the raider pass and by chase. */
export function subjectPoint(subject, t, duration) {
  if (!subject) return null;
  const u = duration > 0 ? clamp(t / duration, 0, 1) : 0;
  return along(subject.from, subject.to, u);
}

export { dist, add, sub, len, norm, BEATS };
