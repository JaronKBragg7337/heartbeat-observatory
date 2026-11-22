// app.js - World Printer (remake 2026-11-21, Fable 5.2).
// The yard, the gantry printer, the controls and the shared sandbox. Every part on screen comes
// from flow.js: a path the nozzle follows. This file never draws a part any other way.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PARTS, customPart, meshPart, nozzleAt, H } from './flow.js';

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
let statusHold = 0;
function say(text, hold = 0) { statusEl.textContent = text; statusHold = hold ? performance.now() + hold : 0; }

const YARD = 12;          // the yard is 24 m x 24 m
const SNAP = 0.3;         // tap positions snap to 30 cm
const MAX_TOP = 7;        // tallest thing the gantry can print
const NOZZLE_SPEED = 16;  // metres of bead per second at Normal
const WORLD = 'printer-lab';
const MATS = {
  concrete: { label: 'Concrete', color: 0xb9b3a7 },
  lime: { label: 'Lime white', color: 0xe4ddcf },
  sand: { label: 'Sandstone', color: 0xd0b384 },
  clay: { label: 'Clay', color: 0xb5674a },
  basalt: { label: 'Basalt', color: 0x55545a },
};

// ---------- renderer, scene, light ----------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
const shadowsDirty = () => { renderer.shadowMap.needsUpdate = true; };

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfe6ea);
scene.fog = new THREE.Fog(0xe9e4da, 70, 260);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
camera.position.set(4.2, 6.2, 8.6);
const controls = new OrbitControls(camera, canvas);
controls.target.set(-0.9, 1.3, -3.4);
controls.enableDamping = true; controls.dampingFactor = 0.09;
controls.minDistance = 2.5; controls.maxDistance = 55; controls.maxPolarAngle = Math.PI * 0.492;
controls.zoomSpeed = 0.9; controls.rotateSpeed = 0.7;

scene.add(new THREE.HemisphereLight(0xdfeaf5, 0x9a8468, 1.15));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
sun.position.set(-14, 22, 9); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 60 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun);

// sky: a soft gradient dome
{
  const g = new THREE.SphereGeometry(300, 24, 12), c = [], top = new THREE.Color(0x8fb4d6), hor = new THREE.Color(0xece6da), p = g.attributes.position, t = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const u = Math.max(0, p.getY(i) / 300); t.copy(hor).lerp(top, Math.pow(u, 0.32)); c.push(t.r, t.g, t.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
}

// ground: gravel around a cast pad with the building grid troweled in
function canvasTex(size, draw, repeat) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
}
const speckle = (ctx, s, base, n, lo, hi) => { ctx.fillStyle = base; ctx.fillRect(0, 0, s, s); for (let i = 0; i < n; i++) { const v = lo + Math.random() * (hi - lo); ctx.fillStyle = `rgba(${v},${v * 0.96},${v * 0.9},${0.25 + Math.random() * 0.4})`; const r = 0.5 + Math.random() * 1.6; ctx.fillRect(Math.random() * s, Math.random() * s, r, r); } };
{
  const gravel = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ map: canvasTex(256, (c, s) => speckle(c, s, '#b9ab93', 5000, 120, 235), 150), roughness: 1 }));
  gravel.rotation.x = -Math.PI / 2; gravel.position.y = -0.02; gravel.receiveShadow = true; scene.add(gravel);
  const padTex = canvasTex(512, (c, s) => {
    speckle(c, s, '#cfc8ba', 7000, 150, 240);
    c.strokeStyle = 'rgba(70,60,45,.16)'; c.lineWidth = 1; for (let i = 1; i < 4; i++) { const p = i * s / 4; c.beginPath(); c.moveTo(p, 0); c.lineTo(p, s); c.moveTo(0, p); c.lineTo(s, p); c.stroke(); }
    c.strokeStyle = 'rgba(70,60,45,.38)'; c.lineWidth = 3; c.strokeRect(0, 0, s, s);
  }, YARD * 2 / 2.4);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(YARD * 2, YARD * 2), new THREE.MeshStandardMaterial({ map: padTex, roughness: 0.95 }));
  pad.rotation.x = -Math.PI / 2; pad.receiveShadow = true; scene.add(pad);
}

// ---------- the gantry printer ----------
const paint = new THREE.MeshStandardMaterial({ color: 0xd79a1c, roughness: 0.55, metalness: 0.25 });
const steel = new THREE.MeshStandardMaterial({ color: 0x6a6d72, roughness: 0.6, metalness: 0.15 });
const RAIL_X = YARD + 1.3, BRIDGE_Y = 8.6;
const box = (w, h, d, mat, x, y, z, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
for (const s of [-1, 1]) { box(0.3, 0.16, YARD * 2 + 4, steel, s * RAIL_X, 0.08, 0, scene); }
const bridge = new THREE.Group(); scene.add(bridge);
for (const s of [-1, 1]) {
  box(0.7, 0.5, 2.2, steel, s * RAIL_X, 0.42, 0, bridge);
  box(0.34, BRIDGE_Y - 0.6, 0.34, paint, s * RAIL_X, BRIDGE_Y / 2 + 0.3, -0.7, bridge);
  box(0.34, BRIDGE_Y - 0.6, 0.34, paint, s * RAIL_X, BRIDGE_Y / 2 + 0.3, 0.7, bridge);
  box(0.5, 0.3, 1.9, paint, s * RAIL_X, BRIDGE_Y * 0.5, 0, bridge);
}
box(RAIL_X * 2 + 0.8, 0.5, 0.5, paint, 0, BRIDGE_Y, -0.7, bridge);
box(RAIL_X * 2 + 0.8, 0.5, 0.5, paint, 0, BRIDGE_Y, 0.7, bridge);
const carriage = new THREE.Group(); bridge.add(carriage);
box(1.3, 0.7, 2.0, steel, 0, BRIDGE_Y + 0.1, 0, carriage);
const mast = box(0.26, 1, 0.26, steel, 0, 0, 0, carriage);
const head = new THREE.Group(); carriage.add(head);
box(0.5, 0.4, 0.5, paint, 0, 0.62, 0, head);
{ const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.045, 0.42, 16), steel); cone.position.y = 0.21; head.add(cone); }
const nozzle = new THREE.Vector3(-YARD + 1, 3, -YARD + 1);  // tip of the nozzle, world space
function poseGantry() {
  bridge.position.z = nozzle.z; carriage.position.x = nozzle.x; head.position.y = nozzle.y;
  const top = BRIDGE_Y - 0.2, bottom = nozzle.y + 0.8, len = Math.max(0.1, top - bottom);
  mast.scale.y = len; mast.position.y = bottom + len / 2;
}
poseGantry();

// ---------- parts: geometry straight from the flow ----------
// reg(id) -> { part, m (the meshed flow), geo } for a catalogue part or a "spin~..." own shape; made on first ask
const registry = new Map();
function reg(id) {
  if (registry.has(id)) return registry.get(id);
  const p = PARTS.find(x => x.id === id) || customPart(id); if (!p) return null;
  if (registry.has(p.id)) return registry.get(p.id);
  const m = meshPart(p), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3));
  g.setAttribute('color', new THREE.BufferAttribute(m.color, 3));
  g.setAttribute('dist', new THREE.BufferAttribute(m.dist, 1));
  g.setIndex(new THREE.BufferAttribute(m.index, 1));
  g.boundingBox = new THREE.Box3(new THREE.Vector3(...m.bbox.min), new THREE.Vector3(...m.bbox.max));
  g.computeBoundingSphere();
  const entry = { part: p, m, geo: g }; registry.set(p.id, entry); return entry;
}
for (const p of PARTS) reg(p.id);
const doneMats = {};
for (const [k, v] of Object.entries(MATS)) doneMats[k] = new THREE.MeshStandardMaterial({ color: v.color, vertexColors: true, roughness: 0.93, metalness: 0 });
// while a part is being printed, only the bead already laid is drawn, and fresh bead is darker (wet)
function printingMat(matKey) {
  const m = doneMats[matKey].clone(); const uD = m.userData.uD = { value: 0 };
  m.onBeforeCompile = (s) => {
    s.uniforms.uD = uD;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float dist;\nvarying float vDist;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDist = dist;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uD;\nvarying float vDist;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nif (vDist > uD) discard;\ndiffuseColor.rgb *= mix(1.0, 0.6, 1.0 - smoothstep(0.0, 45.0, uD - vDist));');
  };
  m.customProgramCacheKey = () => 'flow-printing';
  return m;
}

const parts = [];                 // every part mesh in the yard (printed, printing or waiting)
const byRow = new Map();          // db id -> mesh
const queue = []; let job = null; const curing = [];
function makePart(partId, matKey, x, y, z, rot, rowId, mine) {
  const mesh = new THREE.Mesh(reg(partId).geo, doneMats[matKey]);
  mesh.position.set(x, y, z); mesh.rotation.y = rot; mesh.updateMatrixWorld(true);
  mesh.receiveShadow = true; mesh.castShadow = true;
  mesh.userData = { partId, matKey, rowId, mine, box: new THREE.Box3().copy(reg(partId).geo.boundingBox).applyMatrix4(mesh.matrixWorld) };
  scene.add(mesh); parts.push(mesh); if (rowId) byRow.set(rowId, mesh);
  return mesh;
}
function order(mesh, speedMul) {   // hand a part to the printer
  const mat = printingMat(mesh.userData.matKey); mesh.material = mat; mesh.castShadow = false;
  const marker = new THREE.Box3Helper(mesh.userData.box, 0xc8641e); marker.material.transparent = true; marker.material.opacity = 0.7; scene.add(marker);
  queue.push({ mesh, mat, marker, m: reg(mesh.userData.partId).m, d: 0, speedMul, phase: 'travel' });
}
function dropPart(mesh) {
  const i = parts.indexOf(mesh); if (i >= 0) parts.splice(i, 1);
  if (mesh.userData.rowId) byRow.delete(mesh.userData.rowId);
  const qi = queue.findIndex(j => j.mesh === mesh); if (qi >= 0) { scene.remove(queue[qi].marker); queue.splice(qi, 1); }
  if (job && job.mesh === mesh) { scene.remove(job.marker); job = null; }
  const ci = curing.findIndex(j => j.mesh === mesh); if (ci >= 0) curing.splice(ci, 1);
  scene.remove(mesh); shadowsDirty(); countParts();
}
function countParts() { if (!job && !queue.length && performance.now() > statusHold) idleStatus(); }
function idleStatus() {
  const n = parts.length;
  statusEl.textContent = removing ? 'Tap a part to remove it.' : (n ? `${n} part${n === 1 ? '' : 's'} in the shared yard. Tap the yard to pick a spot.` : 'Tap the yard to pick a spot.');
}

// ---------- the printer at work ----------
let speed = 1;
const tmp = new THREE.Vector3(), arr = [0, 0, 0];
function work(dt) {
  if (!job && queue.length) job = queue.shift();
  if (job) {
    const { mesh, m } = job, mul = Math.max(speed, job.speedMul);
    if (job.phase === 'travel') {
      nozzleAt(m, 0, arr); tmp.set(arr[0], arr[1] + H / 2, arr[2]).applyMatrix4(mesh.matrixWorld);
      const dist = nozzle.distanceTo(tmp), step = 11 * Math.max(1, mul) * dt;
      if (dist <= step) { nozzle.copy(tmp); job.phase = 'print'; scene.remove(job.marker); } else nozzle.lerp(tmp, step / dist);
      if (performance.now() > statusHold) statusEl.textContent = `Moving to print the ${reg(mesh.userData.partId).part.label.toLowerCase()}...`;
    } else {
      job.d = Math.min(m.length, job.d + NOZZLE_SPEED * mul * dt);
      job.mat.userData.uD.value = job.d;
      nozzleAt(m, job.d, arr); const layer = Math.min(m.layers, Math.floor(arr[1] / H) + 1);
      nozzle.set(arr[0], arr[1] + H / 2, arr[2]).applyMatrix4(mesh.matrixWorld);
      if (performance.now() > statusHold) statusEl.textContent = `Printing ${reg(mesh.userData.partId).part.label.toLowerCase()}: layer ${layer} of ${m.layers}` + (queue.length ? ` (${queue.length} waiting)` : '');
      if (job.d >= m.length) { mesh.castShadow = true; shadowsDirty(); curing.push(job); job = null; if (!queue.length) idleStatus(); }
    }
  } else if (nozzle.y < 2.2) nozzle.y = Math.min(2.2, nozzle.y + 2.5 * dt);   // lift clear when idle
  for (let i = curing.length - 1; i >= 0; i--) {   // fresh bead dries to its final colour
    const c = curing[i]; c.d += NOZZLE_SPEED * 1.5 * dt; c.mat.userData.uD.value = c.d;
    if (c.d > c.m.length + 46) { c.mesh.material = doneMats[c.mesh.userData.matKey]; c.mat.dispose(); curing.splice(i, 1); }
  }
  poseGantry();
}

// ---------- shared yard (Supabase: table placements, world printer-lab, type "flow:<part>:<material>") ----------
// The old lab's rows live in the same table with their old type names; this page leaves them alone
// and the old lab ignores ours, so nothing had to be migrated.
let sb = null, me = null;
const SOLO = new URLSearchParams(location.search).has('solo');   // test switch: build without touching the shared yard
const ready = (async () => {
  if (SOLO) return;
  try {
    const mod = await import('/hb-supabase.js'); sb = await mod.getSupabase();
    const { data: { session } } = await sb.auth.getSession(); me = session?.user?.id || null;
    if (!me) { const { data, error } = await sb.auth.signInAnonymously(); if (!error) me = data?.user?.id ?? null; }
  } catch (e) { sb = null; }
})();
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)));
function fromRow(row, animate) {
  const t = String(row.type || '').split(':'); if (t[0] !== 'flow' || !reg(t[1]) || byRow.has(row.id)) return null;
  const mesh = makePart(reg(t[1]).part.id, MATS[t[2]] ? t[2] : 'concrete', row.x, row.y, row.z, row.rot_y || 0, row.id, !!me && row.placed_by === me);
  if (animate && queue.length < 4) order(mesh, 4);
  return mesh;
}
async function saveRow(mesh) {
  await ready; if (!sb) return;
  const u = mesh.userData;
  try {
    const { error } = await sb.from('placements').insert({ id: u.rowId, world: WORLD, type: `flow:${u.partId}:${u.matKey}`, label: reg(u.partId).part.label, x: mesh.position.x, y: mesh.position.y, z: mesh.position.z, rot_y: mesh.rotation.y, scale: 1, placed_by: me });
    if (error) say('Could not save that one to the shared yard. It stays on your screen only.', 5000);
  } catch (e) { /* offline: local only */ }
}
(async () => {
  await ready;
  if (!sb) { say(SOLO ? 'Solo test yard: nothing is saved.' : 'Shared yard is offline. You can still print here.', 5000); return; }
  try {
    const { data } = await sb.from('placements').select('*').eq('world', WORLD).like('type', 'flow:%').order('created_at').limit(2000);
    for (const row of data || []) fromRow(row, false);
    shadowsDirty(); countParts();
    sb.channel('placements-flow-' + WORLD)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'placements', filter: `world=eq.${WORLD}` }, ({ new: row }) => { if (row && fromRow(row, true)) { shadowsDirty(); say('Another builder is printing here too.', 3500); } })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'placements' }, ({ old }) => { const mesh = old && byRow.get(old.id); if (mesh) { if (picked === mesh) unpick(); dropPart(mesh); } })
      .subscribe();
  } catch (e) { /* keep building locally */ }
})();

// ---------- controls: pick a part, tap a spot, print ----------
let current = PARTS[0], matKey = 'concrete', removing = false, picked = null;
const ghost = new THREE.Mesh(reg(current.id).geo, new THREE.MeshBasicMaterial({ color: 0xe0782a, transparent: true, opacity: 0.38, depthWrite: false }));
ghost.visible = false; ghost.renderOrder = 2; scene.add(ghost);
const pickBox = new THREE.Box3Helper(new THREE.Box3(), 0xa63a2a); pickBox.visible = false; scene.add(pickBox);
const act = $('act'), goBtn = $('go'), turnBtn = $('turn');

// The bar appears right after a tap on the yard. A phone then sends a "click" to whatever is now under
// the finger, which could be the new button, so the bar ignores presses for a moment after it shows.
let actShownAt = 0;
const actReady = () => performance.now() - actShownAt > 380;
function showAct(mode) {
  if (mode && act.hidden) actShownAt = performance.now();
  act.hidden = !mode; if (!mode) return;
  turnBtn.hidden = mode !== 'build'; goBtn.classList.toggle('danger', mode === 'remove');
  goBtn.textContent = mode === 'build' ? 'Print here' : 'Remove it';
}
function unpick() { picked = null; pickBox.visible = false; if (removing) showAct(null); }
function cancelGhost() { ghost.visible = false; if (!removing) showAct(null); }
function setWhy() { const s = current.size; $('why').innerHTML = `<b>${current.label}</b> ${s[0]} x ${s[2]} m, ${s[1]} m tall. ${current.why}`; }

function choosePart(p) {
  const old = current.id;
  current = p; ghost.geometry = reg(p.id).geo; $('own').hidden = !p.custom;
  // an own shape that was only ever a preview is thrown away again
  if (old !== p.id && old.startsWith('spin~') && old !== OWN_SAMPLE && !parts.some(m => m.userData.partId === old)) { const e = registry.get(old); if (e) { e.geo.dispose(); registry.delete(old); } }
  if (p.mat && MATS[p.mat]) chooseMat(p.mat);
  for (const el of $('parts').children) el.classList.toggle('on', el.dataset.id === (p.custom ? 'own' : p.id));
  setWhy(); if (removing) setMode(false);
}
function chooseMat(k) { matKey = k; for (const el of $('mats').children) el.classList.toggle('on', el.dataset.k === k); }
function setMode(rem) {
  removing = rem; $('mode').classList.toggle('on', rem); $('mode').textContent = rem ? 'Removing' : 'Remove';
  ghost.visible = false; unpick(); showAct(null); countParts(); if (!job && !queue.length) idleStatus();
}

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitV = new THREE.Vector3();
function castAt(ev) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  let best = null, bt = Infinity;
  for (const p of parts) { const h = ray.ray.intersectBox(p.userData.box, hitV); if (h) { const t = h.distanceToSquared(ray.ray.origin); if (t < bt) { bt = t; best = { part: p, point: h.clone() }; } } }
  return best;
}
const snap = (v) => Math.max(-YARD + 0.6, Math.min(YARD - 0.6, Math.round(v / SNAP) * SNAP));
function onTap(ev) {
  const hit = castAt(ev);
  if (removing) {
    if (!hit) { unpick(); return; }
    picked = hit.part; pickBox.box.copy(picked.userData.box); pickBox.visible = true; showAct('remove');
    say(`${reg(picked.userData.partId).part.label} selected.`, 2500); return;
  }
  let x, y = 0, z;
  if (hit && Math.abs(hit.point.y - hit.part.userData.box.max.y) < 0.03) { x = hit.point.x; z = hit.point.z; y = hit.part.userData.box.max.y; }
  else { const g = ray.ray.intersectPlane(groundPlane, hitV); if (!g) return; x = g.x; z = g.z; }
  if (Math.abs(x) > YARD + 1 || Math.abs(z) > YARD + 1) { say('That is outside the print yard.', 2500); return; }
  if (y + current.size[1] > MAX_TOP) { say('Too tall for the gantry there.', 2500); return; }
  ghost.position.set(snap(x), y, snap(z)); ghost.visible = true; showAct('build');
  say(y > 0 ? 'On top of that part. Turn it, or print.' : 'Turn it, tap somewhere else, or print.', 4000);
}
// a tap is a short press that did not drag (dragging turns the camera)
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = e.isPrimary ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; });
canvas.addEventListener('pointerup', (e) => { if (down && e.isPrimary && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 9 && performance.now() - down.t < 450) onTap(e); down = null; });
canvas.addEventListener('pointercancel', () => { down = null; });

turnBtn.addEventListener('click', () => { if (!actReady()) return; ghost.rotation.y = (ghost.rotation.y + Math.PI / 2) % (Math.PI * 2); });
$('cancel').addEventListener('click', () => { if (!actReady()) return; if (removing) unpick(); else cancelGhost(); });
goBtn.addEventListener('click', async () => {
  if (!actReady()) return;
  if (removing) {
    const mesh = picked; if (!mesh) return; unpick();
    if (mesh.userData.rowId && sb) {
      try {
        const { data } = await sb.from('placements').delete().eq('id', mesh.userData.rowId).select('id');
        if (!data || !data.length) { say('Only the builder who printed that can remove it.', 4500); return; }
      } catch (e) { say('Could not reach the shared yard. Try again.', 4000); return; }
    }
    if (parts.includes(mesh)) dropPart(mesh);
    say('Removed.', 2000); return;
  }
  if (!ghost.visible) return;
  const mesh = makePart(current.id, matKey, ghost.position.x, ghost.position.y, ghost.position.z, ghost.rotation.y, newId(), true);
  order(mesh, 0); saveRow(mesh);
  ghost.visible = false; showAct(null);
  say(queue.length > 1 || job ? `${current.label} added to the print line.` : `${current.label} ordered.`, 2500);
});
$('mode').addEventListener('click', () => setMode(!removing));
for (const b of $('speed').children) b.addEventListener('click', () => { speed = +b.dataset.s; for (const o of $('speed').children) o.classList.toggle('on', o === b); });
window.addEventListener('keydown', (e) => { if (e.key === 'r' || e.key === 'R') turnBtn.click(); else if (e.key === 'Enter' && !act.hidden) goBtn.click(); else if (e.key === 'Escape') $('cancel').click(); });

const OWN_SAMPLE = 'spin~6~10~18~-1~4~2~0';
// part cards with a small picture of the real printed part
function thumbnails() {
  const out = {};
  try {
    const s2 = new THREE.Scene(); s2.background = new THREE.Color(0xefe6d6);
    s2.add(new THREE.HemisphereLight(0xffffff, 0xa08c70, 1.5)); const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(-3, 5, 4); s2.add(d);
    const cam = new THREE.PerspectiveCamera(30, 72 / 60, 0.1, 100), mesh = new THREE.Mesh(reg('wall').geo, doneMats.sand); s2.add(mesh);
    renderer.setPixelRatio(1); renderer.setSize(216, 180, false);
    for (const p of [...PARTS, { id: OWN_SAMPLE, mat: 'clay', as: 'own' }]) {
      mesh.geometry = reg(p.id).geo; mesh.material = doneMats[p.mat || 'sand'];
      const b = reg(p.id).geo.boundingBox, c = b.getCenter(new THREE.Vector3()), r = reg(p.id).geo.boundingSphere.radius;
      cam.position.set(c.x + r * 2.3, c.y + r * 1.5, c.z + r * 2.9); cam.lookAt(c); renderer.render(s2, cam);
      out[p.as || p.id] = canvas.toDataURL('image/jpeg', 0.8);
    }
  } catch (e) { /* cards fall back to plain */ }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  return out;
}
{
  const pics = thumbnails(), wrap = $('parts');
  for (const p of PARTS) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'part'; b.dataset.id = p.id; b.setAttribute('role', 'option');
    b.innerHTML = (pics[p.id] ? `<img alt="" src="${pics[p.id]}">` : '<i class="ph"></i>') + `<span>${p.label}</span>`;
    b.addEventListener('click', () => choosePart(p)); wrap.appendChild(b);
  }
  // "Your own": the same flow with the numbers left open
  const own = document.createElement('button'); own.type = 'button'; own.className = 'part'; own.dataset.id = 'own'; own.setAttribute('role', 'option');
  own.innerHTML = (pics.own ? `<img alt="" src="${pics.own}">` : '<i class="ph"></i>') + '<span>Your own</span>';
  wrap.insertBefore(own, wrap.children[1] || null);
  const SIDES = [0, 3, 4, 5, 6, 8], vals = { n: 4, w: 10, h: 18, t: -1, q: 4, v: 2, lid: 0 };
  const spec = [
    ['n', 'Sides', 0, 5, v => SIDES[v] ? String(SIDES[v]) : 'Round'], ['w', 'Width', 4, 24, v => (v / 10).toFixed(1) + ' m'],
    ['h', 'Height', 3, 40, v => (v * H).toFixed(2) + ' m'], ['t', 'Lean', -5, 5, v => v === 0 ? 'Straight' : (v > 0 ? 'Out ' : 'In ') + Math.abs(v)],
    ['q', 'Twist', 0, 9, v => v ? String(v) : 'None'], ['v', 'Waves', 0, 4, v => v ? String(v) : 'None'],
  ];
  const ownKey = () => ['spin', SIDES[vals.n], vals.w, vals.h, vals.t, vals.q, vals.v, vals.lid].join('~');
  let ownFirst = true;
  const applyOwn = () => {
    choosePart(customPart(ownKey())); if (ownFirst) { ownFirst = false; chooseMat('clay'); }
    if (!ghost.visible) { ghost.position.set(snap(controls.target.x), 0, snap(controls.target.z)); ghost.visible = true; showAct('build'); }
  };
  const panel = $('own');
  for (const [k, label, min, max, fmt] of spec) {
    const l = document.createElement('label'); l.innerHTML = `<span>${label}</span><output>${fmt(vals[k])}</output><input type="range" min="${min}" max="${max}" step="1" value="${vals[k]}" aria-label="${label}">`;
    const inp = l.querySelector('input'), o = l.querySelector('output');
    inp.addEventListener('input', () => { vals[k] = +inp.value; o.textContent = fmt(vals[k]); applyOwn(); });
    panel.appendChild(l);
  }
  { const l = document.createElement('label'); l.className = 'check'; l.innerHTML = '<input type="checkbox"><span>Closed top and bottom</span>'; l.querySelector('input').addEventListener('change', (e) => { vals.lid = e.target.checked ? 1 : 0; applyOwn(); }); panel.appendChild(l); }
  own.addEventListener('click', applyOwn);
  const mw = $('mats');
  for (const [k, v] of Object.entries(MATS)) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mat'; b.dataset.k = k; b.title = v.label; b.setAttribute('aria-label', v.label);
    b.style.background = '#' + v.color.toString(16).padStart(6, '0'); b.addEventListener('click', () => chooseMat(k)); mw.appendChild(b);
  }
  choosePart(PARTS[0]); chooseMat('concrete');
}

// ---------- run ----------
function resize() {
  const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.setViewOffset(w, h, 0, Math.round(Math.min(h * 0.14, 110)), w, h);   // keep the yard clear of the bottom tray
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); window.addEventListener('orientationchange', resize); resize();
idleStatus(); shadowsDirty();
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (statusHold && now > statusHold) { statusHold = 0; if (!job && !queue.length) idleStatus(); }
  work(dt); controls.update(); renderer.render(scene, camera);
});
window.__printer = { parts, queue, PARTS, get job() { return job; }, get nozzle() { return nozzle; } };   // for tests
