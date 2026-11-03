/* ============================================================================
   arena.js - The Arena: a two-page paintball field for people and AI players
   ---------------------------------------------------------------------------
   One field, 40 x 24 m, split at x = 0 by the Seam Room's seam.js: the west
   half is page A (/lab/arena/a/, team A's base), the east half is page B
   (/lab/arena/b/, team B's base). The URL you load is your team and your
   spawn. Walk across the centre line and the address changes, no reload.

   REUSED, not copied:
     /lab/seam-room/seam.js  the seam (URL switching, spawn by URL, Back/Forward)
     /shell/shell.js         identity, phone controls, the realtime channel (world
                             "arena" -> channel "hb-arena", its own, never the
                             Seam Room's). The shell's two laws hold: presence is
                             identity only; movement goes at most 10 Hz.
     /lab/bedroom/person.glb the body (walk + idle), as in the Seam Room.
   Shared with the AI players (agent/arena-agent.mjs): field.js (cover, line of
   sight, the ball's flight) and zones.json (the field as data).

   THE MARKER: a paintball marker. Tap/click fires toward the crosshair. The
   ball is a real projectile with travel time and an arc. Every client flies
   it from the same fire event ("arena-fire": start point, velocity, birth
   time), like the gym's basketball, so everyone sees the same arc and the same
   splat. A ball that crosses x = 0 is logged: "ball #A-3K9F crossed A→B".

   HITS ARE DECIDED BY THE TARGET'S OWN SIDE: each browser (or agent) checks
   only balls against ITS OWN player and reports "arena-hit". No two clients
   can disagree about a hit, because only one of them ever decides it. A tagged
   player shows the paint, scores a point for the other team, and is back at
   its own base after 3 s ("arena-respawn").

   HOT-LOAD: zones.json is re-read every 20 s while the tab is visible (the
   Seam Room's polling); cover, rules and the scene module ("v") apply live.

   SNAPSHOT MODE: when window.__ARENA_SNAPSHOT is set (agent/snapshot.py), the
   page draws that state from one player's eyes and never mounts the shell, so
   the camera never joins the channel as an extra player.
   ========================================================================== */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Seam } from "/lab/seam-room/seam.js";
import * as FD from "/lab/arena/field.js";
// friendly fire rule (field.js); the fallback covers a browser still holding yesterday's cached field.js
const canTag = FD.canTag || ((F, ballTeam, targetTeam) => !!(F && F.rules && F.rules.friendlyFire) || ballTeam !== targetTeam);

const ZONES_URL = "/lab/arena/zones.json";
const SNAP = window.__ARENA_SNAPSHOT || null;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nowS = () => performance.now() / 1000;
const isTouch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

/* ----------------------------------------------------------- the data - */
let zonesText = "";
let DATA = await fetch(ZONES_URL + "?v=" + Date.now(), { cache: "no-store" })
  .then((r) => r.text()).then((t) => { zonesText = t; return JSON.parse(t); });
let F = FD.fieldFrom(DATA);
const teamColor = (t) => ((DATA.teams && DATA.teams[t]) || {}).color || (t === "a" ? "#f07a2b" : "#1f9bd6");
const teamName = (t) => ((DATA.teams && DATA.teams[t]) || {}).name || "Team " + String(t || "?").toUpperCase();
const LABEL = (z) => String(z || "?").toUpperCase();

/* ----------------------------------------------------------- the seam - */
let zoneId = "a";
let booted = false;   // onEnter runs once inside seam.start(), before the rest of this file has set up
const seamCfg = Seam.fromData(DATA);
const seam = Seam.define(Object.assign({}, seamCfg, {
  onEnter(zone, from, info) {
    zoneId = zone.id;
    if (!booted) return;
    if (info.how === "popstate") {   // Back / Forward: just across the line, on that page's side
      player.x = zone.id === "a" ? -0.7 : 0.7;
    }
    if (from && info.how !== "load") seamLog(`you crossed to page ${LABEL(zone.id)}`);
    if (shell) shell.setPlace(`Arena · page ${LABEL(zone.id)}`);
    updateCounter(true);
  },
}));
const startZone = SNAP ? (seam.zone(SNAP.me.zone || SNAP.me.team) || seam.start()) : seam.start();
zoneId = startZone.id;
const TEAM = SNAP ? (SNAP.me.team || zoneId) : startZone.id;   // the page you loaded is your team

/* ------------------------------------------------------------ renderer - */
const quality = isTouch ? "low" : "high";
const renderer = new THREE.WebGLRenderer({ canvas: $("gl"), antialias: true, preserveDrawingBuffer: !!SNAP, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.75 : 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfe7ea);
scene.fog = new THREE.Fog(0xdfe7ea, 70, 175);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 400);
scene.add(new THREE.HemisphereLight(0xd6e8f7, 0x4d5c3a, 1.0));
const sun = new THREE.DirectionalLight(0xfff2dc, 2.5);
sun.position.set(-14, 28, 10); sun.castShadow = true;
sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 16, bottom: -16, near: 1, far: 70 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
addEventListener("resize", () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

/* ----------------------------------------------- the field (scene.js) - */
let field = null, fieldKey = "";
const keyOf = (d) => JSON.stringify([d.v, d.module, d.cover, d.teams, d.field]);
async function buildFieldNow(data) {
  const mod = await import(`/lab/arena/${/^[\w-]+\.js$/.test(data.module || "") ? data.module : "scene.js"}?v=${encodeURIComponent(data.v || 1)}`);
  const fn = mod.buildField || mod.default;
  const built = fn({ THREE, F, data, RoundedBoxGeometry, quality });
  if (field) { scene.remove(field.group); try { field.dispose(); } catch (_) {} }
  field = built; scene.add(field.group); fieldKey = keyOf(data);
  // splats on a piece of cover that is gone go with it
  const ids = new Set(F.cover.map((c) => c.id));
  for (const s of splats.slice()) if (s.on && s.on !== "turf" && s.on !== "net" && !ids.has(s.on)) dropSplat(s);
}

/* ------------------------------------------------------------- paint - */
const splatTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"); let s = 11; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  g.fillStyle = "#fff";
  g.beginPath(); g.arc(64, 64, 26, 0, 7); g.fill();
  for (let i = 0; i < 11; i++) { const a = r() * 7, d = 18 + r() * 22, rr = 6 + r() * 11; g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, rr, 0, 7); g.fill(); }
  for (let i = 0; i < 14; i++) { const a = r() * 7, d = 40 + r() * 20, rr = 1.5 + r() * 4; g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, rr, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const splatMat = {}, ballMat = {}, trailMat = {};
for (const t of ["a", "b"]) {
  splatMat[t] = new THREE.MeshStandardMaterial({ color: teamColor(t), map: splatTex, transparent: true, alphaTest: 0.3, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false });
  ballMat[t] = new THREE.MeshStandardMaterial({ color: teamColor(t), emissive: teamColor(t), emissiveIntensity: 0.55, roughness: 0.25 });
  trailMat[t] = new THREE.LineBasicMaterial({ color: teamColor(t), transparent: true, opacity: 0.55 });
}
const splatGeo = new THREE.PlaneGeometry(1, 1);
const splatGroup = new THREE.Group(); scene.add(splatGroup);
const splats = [];
function addSplat(p, n, team, on, size) {
  const m = new THREE.Mesh(splatGeo, splatMat[team] || splatMat.a);
  const s = size || 0.42 + Math.random() * 0.12;
  m.scale.set(s, s, 1);
  const N = new THREE.Vector3(n[0], n[1], n[2]).normalize();
  m.position.set(p[0] + N.x * 0.012, p[1] + N.y * 0.012, p[2] + N.z * 0.012);
  m.lookAt(m.position.clone().add(N)); m.rotateZ(Math.random() * 6.28);
  splatGroup.add(m);
  const rec = { mesh: m, on, p, n, team };
  splats.push(rec);
  while (splats.length > 160) dropSplat(splats[0]);
  return rec;
}
function dropSplat(s) { splatGroup.remove(s.mesh); const i = splats.indexOf(s); if (i >= 0) splats.splice(i, 1); }

/* -------------------------------------------------------------- people - */
let template = null; const clips = {};
const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x7a8a99, roughness: 0.8 });
const gearMat = { a: new THREE.MeshStandardMaterial({ color: teamColor("a"), roughness: 0.6 }), b: new THREE.MeshStandardMaterial({ color: teamColor("b"), roughness: 0.6 }) };
const blackMat = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.45, metalness: 0.3 });
const lensMat = new THREE.MeshStandardMaterial({ color: 0x2a3440, roughness: 0.1, metalness: 0.7 });
const proxyGeo = new THREE.CylinderGeometry(0.32, 0.32, 1.8, 8); proxyGeo.translate(0, 0.9, 0);
const proxyMat = new THREE.MeshBasicMaterial({ visible: false });

function makeGear(team) {
  const g = new THREE.Group();
  const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.215, 0.46, 16, 1, true), gearMat[team] || gearMat.a);
  vest.position.set(0, 1.21, 0.0); vest.scale.set(1, 1, 0.8); vest.castShadow = true; g.add(vest);
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.11, 0.07), blackMat); mask.position.set(0, 1.6, 0.11); g.add(mask);
  const lens = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.045, 0.01), lensMat); lens.position.set(0, 1.625, 0.146); g.add(lens);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 4, 16), gearMat[team] || gearMat.a); strap.rotation.x = Math.PI / 2; strap.position.set(0, 1.63, 0.03); strap.scale.set(1, 1.1, 1); g.add(strap);
  // the marker, held at the chest, pointing forward
  const mk = new THREE.Group(); mk.position.set(0.14, 1.22, 0.3);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.09, 0.26), blackMat); mk.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.32, 10), blackMat); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, 0.28); mk.add(barrel);
  const hopper = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), gearMat[team] || gearMat.a); hopper.scale.set(0.8, 1, 1.25); hopper.position.set(0, 0.12, 0.02); mk.add(hopper);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 10), new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: 0.8, roughness: 0.3 })); tank.rotation.x = Math.PI / 2; tank.position.set(0, -0.04, -0.2); mk.add(tank);
  mk.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.add(mk); g.userData.marker = mk;
  return g;
}
function makeAvatar(h, team) {
  h.group = h.group || new THREE.Group();
  h.body = new THREE.Group(); h.group.add(h.body);
  if (template) {
    const b = SkeletonUtils.clone(template); h.body.add(b);
    h.mixer = new THREE.AnimationMixer(b);
    h.walk = h.mixer.clipAction(clips.walk); h.idle = h.mixer.clipAction(clips.idle);
    h.walk.play(); h.idle.play(); h.walk.setEffectiveWeight(0); h.idle.setEffectiveWeight(1);
  } else {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.3, 4, 12), fallbackMat); m.position.y = 0.85; m.castShadow = true; m.userData.placeholder = true; h.body.add(m);
  }
  h.gear = makeGear(team); h.group.add(h.gear);
  h.paint = new THREE.Group(); h.group.add(h.paint);
  h.proxy = new THREE.Mesh(proxyGeo, proxyMat); h.group.add(h.proxy);
  h.team = team;
}
function upgradeAvatar(h) {
  if (h.mixer || !template || !h.body) return;
  h.group.remove(h.body); makeAvatarBody(h);
}
function makeAvatarBody(h) {
  h.body = new THREE.Group(); h.group.add(h.body);
  const b = SkeletonUtils.clone(template); h.body.add(b);
  h.mixer = new THREE.AnimationMixer(b);
  h.walk = h.mixer.clipAction(clips.walk); h.idle = h.mixer.clipAction(clips.idle);
  h.walk.play(); h.idle.play(); h.walk.setEffectiveWeight(0); h.idle.setEffectiveWeight(1);
}
function animate(h, speed, dt) {
  if (!h.mixer) return;
  const w = Math.min(1, speed / 0.8);
  h.walk.setEffectiveWeight(w); h.idle.setEffectiveWeight(1 - w);
  h.walk.timeScale = Math.max(0.7, speed / 1.2);
  h.mixer.update(dt);
}
function setOutPose(h, out) {   // tagged: the marker goes up over the head (the paintball "I'm out" sign)
  const mk = h.gear && h.gear.userData.marker; if (!mk) return;
  if (out) { mk.position.set(0.12, 1.95, 0.05); mk.rotation.x = -1.35; } else { mk.position.set(0.14, 1.22, 0.3); mk.rotation.x = 0; }
}
function paintOn(h, worldP, team) {   // a splat on a player's body, in its own frame so it moves with it
  const g = h.group; g.updateMatrixWorld();
  const local = g.worldToLocal(new THREE.Vector3(worldP[0], worldP[1], worldP[2]));
  const r = Math.hypot(local.x, local.z) || 1, k = 0.24 / r;
  local.x *= k; local.z *= k; local.y = clamp(local.y, 0.4, 1.75);
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.07 + Math.random() * 0.04, 8, 6), ballMat[team] || ballMat.a);
    m.position.set(local.x + (Math.random() - 0.5) * 0.12, local.y + (Math.random() - 0.5) * 0.14, local.z + (Math.random() - 0.5) * 0.12);
    m.scale.set(1, 1.2, 0.45); m.lookAt(0, m.position.y, 0);
    h.paint.add(m);
  }
}
function clearPaint(h) { if (h.paint) for (const c of h.paint.children.slice()) { h.paint.remove(c); c.geometry.dispose(); } }

function nameSprite(text, color, ai, out, letter) {
  const c = document.createElement("canvas"); c.width = 360; c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = out ? "rgba(60,60,60,.78)" : "rgba(14,18,20,.74)"; g.beginPath(); g.roundRect(4, 8, 352, 48, 24); g.fill();
  g.strokeStyle = color; g.lineWidth = 4; g.stroke();   // the team colour, round the whole tag
  g.fillStyle = color; g.beginPath(); g.arc(32, 32, 15, 0, 7); g.fill();
  if (letter) { g.fillStyle = "#101418"; g.font = "800 19px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(letter, 32, 33); g.textAlign = "left"; }
  let tx = 56;
  if (ai) { g.fillStyle = "#e8c98a"; g.beginPath(); g.roundRect(48, 18, 46, 28, 8); g.fill(); g.fillStyle = "#2a2014"; g.font = "800 19px system-ui, sans-serif"; g.textBaseline = "middle"; g.fillText("AI", 59, 33); tx = 104; }
  g.fillStyle = "#f3f1ea"; g.font = "600 25px system-ui, sans-serif"; g.textBaseline = "middle"; g.fillText(text + (out ? " · OUT" : ""), tx, 33, 352 - tx - 14);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(1.15, 0.2, 1); s.position.y = 2.12; s.renderOrder = 10;
  return s;
}

const loader = new GLTFLoader();
const modelReady = new Promise((res) => {
  loader.load("/lab/bedroom/person.glb", (gltf) => {
    const p = gltf.scene;
    p.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.material) o.material.roughness = 0.85; } });
    const bb = new THREE.Box3().setFromObject(p), h = bb.max.y - bb.min.y;
    if (h > 0.1) p.scale.multiplyScalar(1.76 / h);
    p.position.y = -bb.min.y * (1.76 / h);
    template = new THREE.Group(); template.add(p);
    for (const c of gltf.animations) clips[c.name] = c;
    if (!clips.walk) clips.walk = gltf.animations[0];
    if (!clips.idle) clips.idle = gltf.animations[1] || gltf.animations[0];
    for (const h of [selfAv, ...peerAv.values()]) upgradeAvatar(h);
    res(true);
  }, undefined, () => res(false));
});

/* --------------------------------------------------------------- me - */
const sp = (startZone.spawn || { x: TEAM === "a" ? -17.5 : 17.5, z: 0, yaw: TEAM === "a" ? Math.PI / 2 : -Math.PI / 2 });
const player = { x: sp.x, z: sp.z, y: 0, yaw: sp.yaw, mx: 0, my: 0, speed: 0, out: false, outUntil: 0, outBy: "", hits: 0, tagged: 0, lastFire: 0 };
const cam = { yaw: sp.yaw, pitch: 0.1 };
const selfAv = { group: new THREE.Group() };
makeAvatar(selfAv, TEAM); scene.add(selfAv.group);

const LOCAL_KEY = "local-" + Math.random().toString(36).slice(2, 8);
let shell = null;
const myKey = () => (shell && shell.selfKey) || LOCAL_KEY;
const myName = () => (shell && shell.displayName) || "You";

/* ------------------------------------------------------------- the HUD - */
const logLines = [];
function seamLog(text, color) {
  const t = new Date();
  logLines.push({ at: t.getTime(), text, color });
  if (logLines.length > 60) logLines.shift();
  const el = $("seamLog"); if (!el) return;
  el.innerHTML = logLines.slice(-4).map((l) => `<div${l.color ? ` style="color:${l.color}"` : ""}>${esc(l.text)}</div>`).join("");
}
const score = { a: 0, b: 0, rev: 0 };
const seenHits = new Set();
function renderScore() {
  const el = $("score"); if (!el) return;
  el.innerHTML = `<span class="ta">A <b>${score.a}</b></span><span class="sep">:</span><span class="tb"><b>${score.b}</b> B</span>`;
  const me = $("mine"); if (me) me.textContent = `you · team ${LABEL(TEAM)} · ${player.hits} hit${player.hits === 1 ? "" : "s"} · out ${player.tagged}`;
}
let counterSig = "", lastPeers = [];
function updateCounter(force) {
  const n = { a: 0, b: 0 }; n[zoneId] = (n[zoneId] || 0) + 1;
  for (const p of lastPeers) { const z = FD.parsePlace(p.place).zone; if (n[z] != null) n[z] += 1; }
  const sig = zoneId + "|" + n.a + "|" + n.b;
  if (!force && sig === counterSig) return;
  counterSig = sig;
  const el = $("counter"); if (el) el.innerHTML = `You: <b>page ${LABEL(zoneId)}</b> · On A: ${n.a} · On B: ${n.b}`;
  window.__arenaCount = n;
}
renderScore(); updateCounter(true);

/* --------------------------------------------------------------- balls - */
const ballGeo = new THREE.SphereGeometry(0.075, 12, 9);
const balls = new Map();          // id -> flight
const seenBalls = new Set();
const ripples = [];
const TRAIL = 9;
function ballLabel(id) { return "#" + id; }
function addBall(w, opts) {
  if (!w || !w.id || seenBalls.has(w.id) || !Array.isArray(w.p) || !Array.isArray(w.v)) return null;
  seenBalls.add(w.id);
  if (seenBalls.size > 4000) seenBalls.clear();
  const late = opts && opts.age != null ? opts.age : clamp((Date.now() - (w.t0 || Date.now())) / 1000, 0, 0.3);
  const imp = FD.impactOf(F, w);
  const b = { w, born: nowS() - late, imp, cross: FD.seamCrossing(w, imp.t), crossedDone: false, lastAge: late, mine: !!(opts && opts.mine), pages: (w.pages || [w.page]).slice() };
  const team = w.team === "b" ? "b" : "a";
  b.mesh = new THREE.Mesh(ballGeo, ballMat[team]); b.mesh.castShadow = true;
  const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
  b.trail = new THREE.Line(tg, trailMat[team]); b.trail.frustumCulled = false;
  scene.add(b.mesh, b.trail);
  balls.set(w.id, b);
  placeBall(b, late);
  return b;
}
function placeBall(b, age) {
  const p = FD.ballAt(F, b.w, Math.min(age, b.imp.t));
  b.mesh.position.set(p[0], p[1], p[2]);
  const arr = b.trail.geometry.attributes.position.array;
  for (let i = 0; i < TRAIL; i++) { const q = FD.ballAt(F, b.w, Math.max(0, Math.min(age, b.imp.t) - i * 0.018)); arr[i * 3] = q[0]; arr[i * 3 + 1] = q[1]; arr[i * 3 + 2] = q[2]; }
  b.trail.geometry.attributes.position.needsUpdate = true;
}
function endBall(b) {
  scene.remove(b.mesh, b.trail); b.trail.geometry.dispose(); balls.delete(b.w.id);
}
function ripple(z, y, team) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 28), new THREE.MeshBasicMaterial({ color: teamColor(team), transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  m.position.set(0, y, z); m.rotation.y = Math.PI / 2; scene.add(m);
  ripples.push({ m, t: 0 });
}
function stepBalls() {
  const t = nowS();
  for (const b of [...balls.values()]) {
    const age = t - b.born;
    // the seam: log the crossing the moment it happens
    if (b.cross && !b.crossedDone && age >= b.cross.t) {
      b.crossedDone = true; b.pages.push(b.cross.to);
      const q = FD.ballAt(F, b.w, b.cross.t);
      seamLog(`ball ${ballLabel(b.w.id)} crossed ${LABEL(b.cross.from)}→${LABEL(b.cross.to)}`, teamColor(b.w.team));
      ripple(q[2], q[1], b.w.team);
      if (field && field.curtain) field.curtain.material.opacity = 0.6;
    }
    // MY side decides if it hit ME (never anyone else)
    if (!b.mine && !player.out && !SNAP && b.w.by !== myKey() && canTag(F, b.w.team, TEAM)) {   // a teammate's ball passes through
      const to = Math.min(age, b.imp.t);
      if (to > b.lastAge) {
        const ht = FD.hitTime(F, b.w, b.lastAge, to, player);
        b.lastAge = to;
        if (ht != null) { tagMe(b, ht); continue; }
      }
    }
    if (age >= b.imp.t) {
      if (b.imp.what !== "air") addSplat(b.imp.p, b.imp.n, b.w.team === "b" ? "b" : "a", b.imp.id);
      endBall(b);
      continue;
    }
    placeBall(b, age);
  }
  for (const r of ripples.slice()) {
    r.t += 1 / 60; const k = r.t / 0.55;
    r.m.scale.setScalar(1 + k * 5); r.m.material.opacity = 0.9 * (1 - k);
    if (k >= 1) { scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); ripples.splice(ripples.indexOf(r), 1); }
  }
  if (field && field.curtain && field.curtain.material.opacity > 0.26) field.curtain.material.opacity = Math.max(0.26, field.curtain.material.opacity - 0.02);
}

/* ------------------------------------------------------------- firing - */
const ray = new THREE.Raycaster();
function lookDir() { return new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)); }
function aimPoint() {
  const dir = lookDir();
  ray.set(camera.position, dir); ray.far = 80;
  const list = field ? field.aimables.slice() : [];
  for (const e of peerAv.values()) list.push(e.proxy);
  const hits = ray.intersectObjects(list, false);
  const minD = camera.position.distanceTo(new THREE.Vector3(player.x, player.y + 1.4, player.z)) + 0.6;
  const h = hits.find((x) => x.distance > minD);
  if (h) return [h.point.x, h.point.y, h.point.z];
  const p = camera.position.clone().addScaledVector(dir, 45);
  return [p.x, p.y, p.z];
}
let ballSerial = 0;
function newBallId() { ballSerial++; return TEAM.toUpperCase() + "-" + (Date.now() % 1679616).toString(36).toUpperCase().padStart(4, "0").slice(-4) + (ballSerial % 36).toString(36).toUpperCase(); }
function muzzle() {
  const f = { x: Math.sin(player.yaw), z: Math.cos(player.yaw) }, r = { x: Math.cos(player.yaw), z: -Math.sin(player.yaw) };
  return [player.x + f.x * 0.62 + r.x * 0.14, player.y + 1.26, player.z + f.z * 0.62 + r.z * 0.14];
}
function fire(target) {
  if (SNAP || player.out) return null;
  const t = nowS();
  if (t - player.lastFire < F.rules.fireCooldownS) return null;
  player.lastFire = t;
  player.yaw = cam.yaw;
  const from = muzzle(), to = target || aimPoint();
  const w = { id: newBallId(), by: myKey(), byName: myName(), team: TEAM, page: zoneId, pages: [zoneId], t0: Date.now(),
    p: from.map((n) => +n.toFixed(3)), v: FD.solveLaunch(F, from, to).map((n) => +n.toFixed(4)) };
  addBall(w, { mine: true, age: 0 });
  if (shell) shell.send("arena-fire", { ball: w });
  kick = 1;
  return w;
}
let kick = 0;

/* -------------------------------------------------------- hits + score - */
function tagMe(b, hitAge) {
  const p = FD.ballAt(F, b.w, hitAge);
  const hit = { ball: b.w.id, by: b.w.by, byName: b.w.byName || "someone", byTeam: b.w.team, target: myKey(), targetName: myName(), targetTeam: TEAM,
    at: Date.now(), p: p.map((n) => +n.toFixed(3)) };
  player.out = true; player.outUntil = nowS() + F.rules.respawnS; player.outBy = hit.byName; player.tagged += 1;
  endBall(b);
  applyHit(hit);
  if (shell) shell.send("arena-hit", { hit });
}
function applyHit(h) {
  if (!h || !h.ball || seenHits.has(h.ball)) return;
  seenHits.add(h.ball);
  const friendly = h.byTeam === h.targetTeam;
  if (friendly && !canTag(F, h.byTeam, h.targetTeam)) return;   // friendly fire is off: an old client's own-team report changes nothing
  const b = balls.get(h.ball); if (b) endBall(b);
  if (!friendly && (h.byTeam === "a" || h.byTeam === "b")) { score[h.byTeam] += 1; score.rev += 1; }
  const meTarget = h.target === myKey(), meShooter = h.by === myKey();
  if (meShooter && !friendly) player.hits += 1;
  // paint on the body
  const av = meTarget ? selfAv : peerAv.get(h.target);
  if (av && Array.isArray(h.p)) paintOn(av, h.p, h.byTeam === "b" ? "b" : "a");
  if (av && !meTarget) { av.out = true; av.outAt = nowS(); }
  const who = meShooter ? "you" : h.byName, whom = meTarget ? "you" : h.targetName;
  seamLog(`${who} tagged ${whom} with ball #${h.ball}${friendly ? " (own team, no point)" : ""} · A ${score.a} : ${score.b} B`, teamColor(h.byTeam));
  if (meShooter && !meTarget) flash(friendly ? "Own team!" : "Hit! +1", teamColor(TEAM));
  renderScore();
}
function respawnMe() {
  const s = (seam.zone(TEAM) || {}).spawn || sp;
  player.out = false; player.outBy = "";
  player.x = s.x; player.z = s.z + (Math.random() - 0.5) * 3; player.y = 0;
  cam.yaw = s.yaw; player.yaw = s.yaw;
  const p = FD.pushOut(F, player.x, player.z); player.x = p.x; player.z = p.z;
  clearPaint(selfAv);
  seam.update(player.x, player.z);
  if (shell) shell.send("arena-respawn", { id: myKey() });
  seamLog("you are back in at your base");
}
let flashT = 0;
function flash(text, color) { const el = $("flash"); if (!el) return; el.textContent = text; el.style.color = color || ""; el.classList.add("on"); flashT = nowS(); }

/* --------------------------------------------------------- the network - */
const handlers = {};
function onEvent(kind, fn) { (handlers[kind] = handlers[kind] || []).push(fn); if (shell) shell.on(kind, fn); }
function wireEvents() {
  onEvent("arena-fire", (m) => { if (m && m.ball) addBall(m.ball); });
  onEvent("arena-hit", (m) => applyHit(m && m.hit));
  onEvent("arena-respawn", (m) => {
    const av = m && peerAv.get(m.id);
    if (av) { clearPaint(av); av.out = false; }
  });
  onEvent("arena-ask", () => {
    if (score.rev > 0) setTimeout(() => shell && shell.send("arena-score", { score: { ...score }, hits: [...seenHits].slice(-60) }), Math.random() * 500);
  });
  onEvent("arena-score", (m) => {
    const s = m && m.score; if (!s || !(s.rev > score.rev)) return;
    score.a = s.a | 0; score.b = s.b | 0; score.rev = s.rev | 0;
    for (const id of m.hits || []) seenHits.add(id);
    renderScore();
  });
}

const peerAv = new Map();
function syncPeers(list, dt) {
  lastPeers = list;
  const live = new Set();
  for (const p of list) {
    live.add(p.id);
    const pl = FD.parsePlace(p.place);
    const team = pl.team === "b" ? "b" : "a";
    let e = peerAv.get(p.id);
    if (!e || e.team !== team) {
      if (e) scene.remove(e.group);
      e = { group: new THREE.Group(), px: p.x, pz: p.z, speed: 0, label: "", out: false };
      makeAvatar(e, team); scene.add(e.group); peerAv.set(p.id, e);
    }
    const ai = !!(p.appearance && p.appearance.ai);
    const out = pl.out || (e.out && nowS() - (e.outAt || 0) < F.rules.respawnS + 2);
    if (!pl.out && e.out && nowS() - (e.outAt || 0) > 0.6) { e.out = false; clearPaint(e); }
    const label = `${p.name || "Guest"} · ${LABEL(team)}`;
    const key = label + ai + out;
    if (key !== e.label) {
      if (e.sprite) { e.group.remove(e.sprite); e.sprite.material.map.dispose(); e.sprite.material.dispose(); }
      e.sprite = nameSprite(label, teamColor(team), ai, out, LABEL(team)); e.group.add(e.sprite); e.label = key;
      setOutPose(e, out);
    }
    e.name = p.name; e.zone = pl.zone; e.y = p.y || 0;
    const v = dt > 0 ? Math.hypot(p.x - e.px, p.z - e.pz) / dt : 0;
    e.speed += (Math.min(v, 6) - e.speed) * 0.2;
    e.px = p.x; e.pz = p.z;
    e.group.position.set(p.x, p.y || FD.groundAt(F, p.x, p.z), p.z); e.group.rotation.y = p.yaw || 0;
    animate(e, e.speed, dt);
  }
  for (const [id, e] of peerAv) if (!live.has(id)) { scene.remove(e.group); peerAv.delete(id); }
  updateCounter();
}

if (!SNAP) {
  shell = window.HBShell.mount({
    world: "arena",
    worldLabel: "The Arena",
    gateUrl: "/",
    getState() {
      return { x: player.x, y: player.y, z: player.z, yaw: player.yaw, pitch: cam.pitch, stance: player.speed > 0.3 ? "run" : "stand", place: FD.placeOf(zoneId, TEAM, player.out) };
    },
    onPeers() {},
    onMove({ x, y }) { player.mx = x; player.my = y; },
    onLook(dx, dy) {
      const k = 0.0042 * (shell.settings.sensitivity || 1), inv = shell.settings.invertY ? -1 : 1;
      cam.yaw += dx * k; cam.pitch = clamp(cam.pitch - dy * k * inv * 0.6, -0.5, 0.65);
    },
    onAction(name) { if (name === "use") fire(); },
    onSettings(s) { camera.fov = s.fov || 70; camera.updateProjectionMatrix(); },
  });
  let frameDt = 0;
  shell.opts.onPeers = (list) => syncPeers(list, frameDt);
  window.__arenaFrameDt = (d) => { frameDt = d; };
  shell.setPlace(`Arena · page ${LABEL(zoneId)}`);
  // the shell's use button is the trigger: it only shows while a prompt is set, so set one and hide the prompt text
  shell.setPrompt("Fire");
  const relabel = () => { const b = document.querySelector(".hbs-act.go"); if (b) b.textContent = "Fire"; };
  relabel(); setTimeout(relabel, 500);
  wireEvents();
  // ask the people already here for the score (once connected)
  const askT = setInterval(() => { if (shell.connected) { clearInterval(askT); shell.send("arena-ask", {}); void setupOrders(); } }, 500);
} else {
  wireEvents();
}

/* ------------------------------------------- team mode: orders (owner only) - */
/* Jaron gives his AI teammate orders. They go into public.arena_orders, whose RLS lets only his uid insert and read
   (lab/arena/agent/SETUP-ORDERS.sql). The teammate (agent/arena-agent.mjs follow-orders) reads ONLY that table, never a
   broadcast, and answers with a short status row that only he can read: a bubble over the teammate, on his screen.
   The box is closed by default: one small "Orders" pill under the score. It never sits over the middle of the view. */
const ORDER_CHIPS = [["follow", "Follow me"], ["hold", "Hold here"], ["goto", "Go to…"], ["cover", "Cover me"],
  ["flank-left", "Flank left"], ["flank-right", "Flank right"], ["find", "Find them"]];
let canOrder = false, pickSpot = 0, pickMark = null;
const bubbles = new Map();   // channel id -> { sprite, until, holder }
function bubbleSprite(text, color) {
  const words = String(text).split(/\s+/), lines = [""];
  for (const w of words) { const l = lines[lines.length - 1]; if ((l + " " + w).trim().length > 24 && lines.length < 3) lines.push(w); else lines[lines.length - 1] = (l + " " + w).trim(); }
  const c = document.createElement("canvas"); c.width = 420; c.height = 34 + lines.length * 36;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(250,248,240,.94)"; g.beginPath(); g.roundRect(4, 4, 412, c.height - 8, 16); g.fill();
  g.strokeStyle = color; g.lineWidth = 4; g.stroke();
  g.fillStyle = "#1b1f22"; g.font = "600 29px system-ui, sans-serif"; g.textBaseline = "middle";
  lines.forEach((l, i) => g.fillText(l, 18, 35 + i * 36, 386));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  sp.scale.set(2.1, 2.1 * c.height / 420, 1); sp.position.y = 2.36 + (c.height / 420) * 1.05; sp.renderOrder = 11;
  return sp;
}
function showBubble(id, text, ms) {
  const holder = peerAv.get(id); if (!holder) return false;
  const old = bubbles.get(id); if (old) { old.holder.group.remove(old.sprite); old.sprite.material.map.dispose(); }
  const sprite = bubbleSprite(text, teamColor(holder.team)); holder.group.add(sprite);
  bubbles.set(id, { sprite, holder, until: nowS() + (ms || 6000) / 1000 });
  return true;
}
function stepBubbles() {
  const t = nowS();
  for (const [id, b] of bubbles) if (t > b.until || !peerAv.has(id)) { b.holder.group.remove(b.sprite); b.sprite.material.map.dispose(); b.sprite.material.dispose(); bubbles.delete(id); }
  if (pickMark && t > pickMark.until) { scene.remove(pickMark.m); pickMark.m.geometry.dispose(); pickMark = null; }
  if (pickSpot && Date.now() > pickSpot) { pickSpot = 0; ordHint(""); }
}
function ordHint(text) { const el = $("ordHint"); if (!el) return; el.textContent = text; el.classList.toggle("on", !!text); }
async function sendOrder(kind, extra) {
  const label = (ORDER_CHIPS.find((c) => c[0] === kind) || [kind, ""])[1];
  const row = Object.assign({ user_id: shell.uid, speaker: "human", kind, team: TEAM, body: label.replace("…", "") }, extra || {});
  const { error } = await shell.supa.from("arena_orders").insert(row);
  if (error) { seamLog(/row-level security/i.test(error.message) ? "order not sent: only the arena's owner gives orders" : "order not sent: " + error.message, "#e36d7c"); return false; }
  seamLog(`order: ${row.body}`, teamColor(TEAM));
  return true;
}
function pickAt(cx, cy) {   // "Go to": the ground under the tap
  pickSpot = 0; ordHint("");
  const v = new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  const r = new THREE.Raycaster(); r.setFromCamera(v, camera);
  const hit = new THREE.Vector3();
  if (!r.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit) || hit.distanceTo(camera.position) > 70) { seamLog("that spot is off the field: tap Go to and try again"); return; }
  const x = +clamp(hit.x, -F.halfX + 0.6, F.halfX - 0.6).toFixed(1), z = +clamp(hit.z, -F.halfZ + 0.6, F.halfZ - 0.6).toFixed(1);
  if (pickMark) { scene.remove(pickMark.m); pickMark.m.geometry.dispose(); }
  const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.45, 32), new THREE.MeshBasicMaterial({ color: teamColor(TEAM), transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, FD.groundAt(F, x, z) + 0.03, z); scene.add(m);
  pickMark = { m, until: nowS() + 4 };
  void sendOrder("goto", { x, z, body: `Go to x ${x}, z ${z}` });
}
function buildOrders() {
  if ($("ord")) return;
  const btn = document.createElement("button"); btn.id = "ordBtn"; btn.type = "button"; btn.textContent = "Orders"; btn.setAttribute("aria-expanded", "false");
  const box = document.createElement("div"); box.id = "ord";
  box.innerHTML = `<div class="chips">${ORDER_CHIPS.map(([k, l]) => `<button type="button" data-k="${k}">${esc(l)}</button>`).join("")}</div>
    <form id="ordForm" autocomplete="off"><input id="ordIn" type="text" maxlength="140" enterkeyhint="send" placeholder="Tell your AI…" aria-label="An order for your AI teammate"><button type="submit">Send</button></form>`;
  const hint = document.createElement("div"); hint.id = "ordHint"; hint.setAttribute("aria-live", "polite");
  document.body.append(btn, box, hint);
  for (const el of [btn, box]) {   // taps here never reach the shell's stick/look or the trigger
    for (const ev of ["pointerdown", "touchstart", "mousedown"]) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    el.addEventListener("keydown", (e) => e.stopPropagation());
  }
  const open = (on) => { box.classList.toggle("on", on); btn.classList.toggle("on", on); btn.setAttribute("aria-expanded", on ? "true" : "false"); };
  btn.addEventListener("click", () => { pickSpot = 0; ordHint(""); open(!box.classList.contains("on")); });
  box.querySelector(".chips").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-k]"); if (!b) return;
    open(false);
    if (b.dataset.k === "goto") { pickSpot = Date.now() + 12000; ordHint("Tap the ground where your AI should go"); return; }
    void sendOrder(b.dataset.k);
  });
  $("ordForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const inp = $("ordIn"), text = inp.value.trim().slice(0, 140); if (!text) return;
    inp.value = ""; inp.blur(); open(false);
    void sendOrder("say", { body: text });
  });
}
const seenOrderRows = new Set();
function onOrderRow(r) {   // the teammate's answer: a bubble over it, and one quiet line in the log
  if (!r || r.speaker !== "ai" || seenOrderRows.has(r.id)) return;
  seenOrderRows.add(r.id);
  showBubble(r.ai_key, r.body, 4500 + String(r.body).length * 45);
  seamLog(`${r.ai_name || "AI"}: ${r.body}`, teamColor(r.team || TEAM));
}
async function setupOrders() {
  if (!shell || !shell.supa || !shell.uid || canOrder) return;   // guests never get the box
  let ok = false;
  try { const { data } = await shell.supa.rpc("arena_is_owner"); ok = data === true; } catch (_) {}
  if (!ok) return;   // not Jaron, or SETUP-ORDERS.sql not applied yet
  canOrder = true;
  buildOrders();
  shell.supa.channel("arena-orders-" + shell.uid)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "arena_orders", filter: `user_id=eq.${shell.uid}` }, ({ new: r }) => onOrderRow(r))
    .subscribe();
}
/* test handle. previewBox() only draws the box: for anyone but Jaron the database refuses what it sends. */
window.__arenaOrders = { previewBox: () => buildOrders(), onOrderRow, showBubble, get picking() { return !!pickSpot; } };

/* ---------------------------------------------------- desktop + taps - */
const keys = new Set();
addEventListener("keydown", (e) => {
  if (e.target && e.target.matches && e.target.matches("input,textarea,select")) return;
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === "f") fire();
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
addEventListener("blur", () => keys.clear());
const onUi = (t) => !!(t && t.closest && t.closest(".hbs-act,.hbs-icon,.hbs-panel,.hbs-chip,#hudSeam,#ord,#ordBtn,a,button,input"));
const drag = { id: null, x: 0, y: 0, t: 0, moved: 0, mouse: false };
addEventListener("pointerdown", (e) => {
  if (SNAP || onUi(e.target)) return;
  if (e.pointerType === "mouse") { drag.id = e.pointerId; drag.mouse = true; }
  else if (pickSpot || e.clientX > innerWidth * 0.45) { drag.id = e.pointerId; drag.mouse = false; }   // the shell turns this drag into look
  else return;
  drag.x = e.clientX; drag.y = e.clientY; drag.t = performance.now(); drag.moved = 0;
});
addEventListener("pointermove", (e) => {
  if (e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  if (drag.mouse && (e.buttons & 1)) { const k = 0.0045 * ((shell && shell.settings.sensitivity) || 1); cam.yaw += dx * k; cam.pitch = clamp(cam.pitch - dy * k * 0.7, -0.5, 0.65); }
  drag.x = e.clientX; drag.y = e.clientY;
});
const endDrag = (e) => {
  if (e.pointerId !== drag.id) return;
  if (e.type === "pointerup" && drag.moved < 12 && performance.now() - drag.t < 320) { if (pickSpot) pickAt(e.clientX, e.clientY); else fire(); }   // a tap (or a click) fires; in "Go to" it picks the spot
  drag.id = null;
};
addEventListener("pointerup", endDrag); addEventListener("pointercancel", endDrag);

/* --------------------------------------------------------- the frame - */
const tmpV = new THREE.Vector3();
let last = nowS();
function frame() {
  const t = nowS(), dt = Math.min(0.05, t - last); last = t;
  if (window.__arenaFrameDt) window.__arenaFrameDt(dt);
  if (!SNAP) {
    // move: the stick or WASD, relative to where the camera looks
    let mx = player.mx, my = player.my;
    if (keys.has("w") || keys.has("arrowup")) my -= 1;
    if (keys.has("s") || keys.has("arrowdown")) my += 1;
    if (keys.has("a") || keys.has("arrowleft")) mx -= 1;
    if (keys.has("d") || keys.has("arrowright")) mx += 1;
    const len = Math.hypot(mx, my); if (len > 1) { mx /= len; my /= len; }
    const fwd = -my, side = mx;
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    const spd = player.out ? 0 : F.rules.runSpeed;
    const vx = (fx * fwd + rx * side) * spd, vz = (fz * fwd + rz * side) * spd;
    if (Math.abs(vx) + Math.abs(vz) > 0.001) {
      const p = FD.walkStep(F, player.x, player.z, vx * dt, vz * dt, player.y);
      player.speed = Math.hypot(p.x - player.x, p.z - player.z) / dt;
      player.x = p.x; player.z = p.z;
    } else player.speed *= 0.8;
    const gy = FD.groundAt(F, player.x, player.z);
    player.y += (gy - player.y) * Math.min(1, dt * 14);
    player.yaw = cam.yaw;
    seam.update(player.x, player.z);
    if (player.out && t >= player.outUntil) respawnMe();
    const tg = $("tagged");
    if (tg) { if (player.out) { tg.textContent = `Tagged by ${player.outBy} · back in ${Math.max(0, player.outUntil - t).toFixed(1)} s`; tg.classList.add("on"); } else tg.classList.remove("on"); }
    if (flashT && t - flashT > 0.9) { flashT = 0; const el = $("flash"); if (el) el.classList.remove("on"); }
    if (shell) shell.frame(dt);
  }
  selfAv.group.position.set(player.x, player.y, player.z);
  selfAv.group.rotation.y = player.yaw;
  setOutPose(selfAv, player.out);
  animate(selfAv, player.speed, dt);
  stepBubbles();
  stepBalls();
  placeCamera();
  if (kick > 0) kick = Math.max(0, kick - dt * 8);
  renderer.render(scene, camera);
}
const camRay = new THREE.Raycaster();
function placeCamera() {
  const f = lookDir();
  const r = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
  if (SNAP && SNAP.view === "eye") {
    camera.position.set(player.x, player.y + 1.62, player.z).addScaledVector(f, 0.15);
    camera.lookAt(tmpV.copy(camera.position).add(f));
    return;
  }
  const shoulder = new THREE.Vector3(player.x, player.y + 1.6, player.z).addScaledVector(r, 0.5);
  const want = shoulder.clone().addScaledVector(f, -3.0); want.y += 0.3;
  const back = want.clone().sub(shoulder), L = back.length(); back.normalize();
  let d = L;
  if (field) { camRay.set(shoulder, back); camRay.far = L; const h = camRay.intersectObjects(field.aimables, false)[0]; if (h) d = Math.max(0.4, h.distance - 0.2); }
  camera.position.copy(shoulder).addScaledVector(back, d);
  if (camera.position.y < 0.25) camera.position.y = 0.25;
  // never behind the net: at the base the camera would look through it
  camera.position.x = clamp(camera.position.x, -F.halfX + 0.35, F.halfX - 0.35);
  camera.position.z = clamp(camera.position.z, -F.halfZ + 0.35, F.halfZ - 0.35);
  camera.lookAt(tmpV.copy(camera.position).add(f));
  if (kick > 0) camera.rotateX(kick * 0.012);
}

/* ------------------------------------------------- hot-load (zones.json) - */
const ZONES_POLL_MS = 20000;
let zonesBusy = false, zonesLastPoll = Date.now();
async function applyData(data, text) {
  const before = F, oldKey = fieldKey;
  F = FD.fieldFrom(data);
  DATA = data; zonesText = text;
  for (const z of data.zones || []) seam.addZone(Seam.zoneFromData(z));
  const parts = [];
  if (keyOf(data) !== oldKey) {
    try { await buildFieldNow(data); } catch (e) { console.warn("arena: field rebuild failed", e); F = before; seamLog("an update is ready, reload when you like"); return false; }
    if (before.cover.length !== F.cover.length) parts.push(`cover ${before.cover.length} → ${F.cover.length} pieces`);
    else parts.push("the field");
  }
  if (JSON.stringify(before.rules) !== JSON.stringify(F.rules)) parts.push("rules");
  const pp = FD.pushOut(F, player.x, player.z); player.x = pp.x; player.z = pp.z;   // a new bunker on my spot pushes me out
  seamLog(`arena updated live: ${parts.join(", ") || "notes"}`);
  return true;
}
async function pollZones(force) {
  if (SNAP || zonesBusy || (!force && document.hidden)) return false;
  zonesBusy = true; zonesLastPoll = Date.now();
  try {
    const r = await fetch(ZONES_URL + "?v=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return false;
    const text = await r.text();
    if (text === zonesText) return false;
    let data; try { data = JSON.parse(text); } catch (_) { return false; }   // half a deploy: next time
    return await applyData(data, text);
  } catch (_) { return false; } finally { zonesBusy = false; }
}
if (!SNAP) {
  setInterval(() => { if (!document.hidden) void pollZones(); }, ZONES_POLL_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - zonesLastPoll > ZONES_POLL_MS) void pollZones(); });
}

/* ------------------------------------------------------------- start - */
booted = true;
await buildFieldNow(DATA);

if (SNAP) {
  // a local copy of one moment, drawn from one player's eyes; no shell, no channel
  const m = SNAP.me || {};
  Object.assign(player, { x: +m.x || 0, z: +m.z || 0, y: +m.y || FD.groundAt(F, +m.x || 0, +m.z || 0), yaw: +m.yaw || 0, out: !!m.out });
  cam.yaw = +m.yaw || 0; cam.pitch = m.pitch != null ? +m.pitch : 0.05;
  await Promise.race([modelReady, new Promise((r) => setTimeout(r, 8000))]);
  for (const p of SNAP.players || []) {
    const e = { group: new THREE.Group(), px: p.x, pz: p.z, speed: 0 };
    makeAvatar(e, p.team === "b" ? "b" : "a"); scene.add(e.group); peerAv.set(p.id || p.name, e);
    e.group.position.set(p.x, p.y || FD.groundAt(F, p.x, p.z), p.z); e.group.rotation.y = p.yaw || 0;
    e.sprite = nameSprite(`${p.name} · ${LABEL(p.team)}`, teamColor(p.team), !!p.ai, !!p.out, LABEL(p.team)); e.group.add(e.sprite);
    setOutPose(e, !!p.out);
    if (e.mixer) e.mixer.update(0.3);
  }
  selfAv.group.position.set(player.x, player.y, player.z); selfAv.group.rotation.y = player.yaw; setOutPose(selfAv, player.out);
  if (selfAv.mixer) selfAv.mixer.update(0.3);
  for (const s of SNAP.splats || []) if (s && s.p && s.n) addSplat(s.p, s.n, s.team === "b" ? "b" : "a", s.on);
  for (const b of SNAP.balls || []) if (b && b.w) addBall(b.w, { age: +b.age || 0 });
  if (SNAP.score) { score.a = SNAP.score.a | 0; score.b = SNAP.score.b | 0; }
  player.hits = m.hits | 0; player.tagged = m.tagged | 0;
  renderScore();
  const cap = $("counter"); if (cap) cap.innerHTML = `<b>${esc(m.name || "AI")}</b>'s view · team ${LABEL(m.team)} · page ${LABEL(m.zone)}`;
  const lg = $("seamLog"); if (lg) lg.innerHTML = (SNAP.log || []).slice(-3).map((l) => `<div>${esc(l)}</div>`).join("");
  $("loading").style.display = "none";   // at once: the normal fade would still be on screen in the picture
  // draw a few frames without moving time on the balls
  const freeze = nowS();
  for (const b of balls.values()) b.born = freeze - (b.lastAge || 0);
  placeCamera(); renderer.render(scene, camera);
  requestAnimationFrame(() => { placeCamera(); renderer.render(scene, camera); requestAnimationFrame(() => { renderer.render(scene, camera); window.__arenaReady = true; }); });
} else {
  $("loading").classList.add("off");
  renderer.setAnimationLoop(frame);
  seamLog(`you are team ${LABEL(TEAM)} · base on page ${LABEL(TEAM)}`, teamColor(TEAM));
}

/* --------------------------------------------- test handle (read-only-ish) - */
window.__arena = {
  get state() {
    return { zone: zoneId, team: TEAM, url: location.pathname, me: { x: +player.x.toFixed(2), y: +player.y.toFixed(2), z: +player.z.toFixed(2), yaw: +player.yaw.toFixed(3), out: player.out, hits: player.hits, tagged: player.tagged },
      score: { ...score }, balls: balls.size, splats: splats.length, cover: F.cover.length, peers: [...peerAv.keys()], key: myKey(), connected: !!(shell && shell.connected),
      draws: renderer.info.render.calls };
  },
  log: logLines,
  F: () => F,
  fireAt(x, y, z) { player.lastFire = 0; return fire([x, y, z]); },
  aimAt(x, z) { cam.yaw = Math.atan2(x - player.x, z - player.z); player.yaw = cam.yaw; },
  teleport(x, z) { const p = FD.pushOut(F, x, z); player.x = p.x; player.z = p.z; seam.update(player.x, player.z); },
  inject(kind, payload) { for (const fn of handlers[kind] || []) fn(Object.assign({ kind, from: "test" }, payload || {}), "test"); },
  pollZones: (force) => pollZones(force),
  ready: true,
};
