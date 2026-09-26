// Heartbeat Homes - walk a baked, photoreal loft; the wall TV plays every Heartbeat TV channel; friends visit by invite link.
// Lighting was path-traced in Blender (Cycles) and baked into the atlas textures, so the page draws it unlit: phones stay smooth.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CSS3DRenderer, CSS3DObject } from "three/addons/renderers/CSS3DRenderer.js";
import { getSupabase, getIdentity } from "/hb-supabase.js";

const $ = (id) => document.getElementById(id);
const BASE = "/homes/loft/";
const phone = matchMedia("(pointer: coarse)").matches || Math.min(screen.width, screen.height) < 700;
const TEX = phone ? "2k" : "4k";
const qs = new URLSearchParams(location.search);

// ---------------------------------------------------------------- renderer + scene
const renderer = new THREE.WebGLRenderer({ antialias: !phone, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 2 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;            // the bake already carries the film look
$("view").appendChild(renderer.domElement);
const css = new CSS3DRenderer(); css.setSize(innerWidth, innerHeight); $("css").appendChild(css.domElement);
const scene = new THREE.Scene(), cssScene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(phone ? 72 : 65, innerWidth / innerHeight, 0.05, 3000);
scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x3a2a20, 1.4));   // only lights the avatars; baked surfaces are unlit
function fitFov() {   // keep ~78 degrees across in portrait, 65 tall in landscape
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? Math.min(105, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(39)) / camera.aspect))) : 65;
  camera.updateProjectionMatrix();
}
fitFov();
addEventListener("resize", () => {
  fitFov();
  renderer.setSize(innerWidth, innerHeight); css.setSize(innerWidth, innerHeight);
});

const bar = (f, msg) => { $("loadBar").style.width = Math.round(f * 100) + "%"; if (msg) $("loadMsg").textContent = msg; };
const texLoader = new THREE.TextureLoader();
const loadTex = (url) => new Promise((ok, no) => texLoader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 8; ok(t); }, undefined, no));

let colliders = null, screenInfo = null;
async function loadLoft() {
  const parts = ["floor", "shell", "living", "upper"];
  let done = 0; const tick = () => bar(0.1 + 0.8 * (++done / (parts.length + 3)));
  const [gltf, col, pano, ...atlases] = await Promise.all([
    new GLTFLoader().loadAsync(BASE + "loft.glb").then((g) => (tick(), g)),
    fetch(BASE + "colliders.json").then((r) => r.json()).then((j) => (tick(), j)),
    loadTex(BASE + `city_${phone ? "4k" : "8k"}.jpg`).then((t) => (tick(), t)),
    ...parts.map((p) => loadTex(BASE + `atlas_${p}_${TEX}.jpg`).then((t) => (tick(), t))),
  ]);
  colliders = col;
  pano.flipY = true; pano.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = pano;
  const maps = Object.fromEntries(parts.map((p, i) => [p, atlases[i]]));
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const name = (o.material && o.material.name) || o.name;
    const key = parts.find((p) => name === "BK_" + p || o.name === "BK_" + p);
    if (key) { o.material = new THREE.MeshBasicMaterial({ map: maps[key] }); return; }
    if (/glass/i.test(name) || /glass/i.test(o.name)) {
      o.material = new THREE.MeshBasicMaterial({ color: 0x9fb4c8, transparent: true, opacity: 0.08, depthWrite: false, envMap: pano, reflectivity: 0.25, combine: THREE.AddOperation });
      o.renderOrder = 2; return;
    }
    if (/screen/i.test(name) || /screen/i.test(o.name)) {
      o.material = new THREE.MeshBasicMaterial({ color: 0x050608 });
      o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      screenInfo = { box: bb, mesh: o };
    }
  });
  scene.add(gltf.scene);
  gltf.scene.updateMatrixWorld(true);
  if (screenInfo) { screenInfo.box = screenInfo.mesh.geometry.boundingBox.clone().applyMatrix4(screenInfo.mesh.matrixWorld); }
}

// ---------------------------------------------------------------- walking + collision (AABBs exported from Blender)
const P = { pos: new THREE.Vector3(), vy: 0, yaw: 0, pitch: -0.05, eye: 1.62, r: 0.26 };
const STEP = 0.36;
function blocked(x, z, feet) {
  const lo = feet + STEP * 0.9, hi = feet + 1.75, r = P.r;
  const hit = (b) => x + r > b[0] && x - r < b[3] && z + r > b[2] && z - r < b[5] && b[4] > lo && b[1] < hi;
  for (const b of colliders.solids) if (hit(b)) return true;
  for (const b of colliders.walk) if (hit(b)) return true;
  return false;
}
function groundAt(x, z, feet) {
  let g = -Infinity; const r = 0.12;
  const test = (b) => { if (x + r > b[0] && x - r < b[3] && z + r > b[2] && z - r < b[5] && b[4] <= feet + STEP && b[4] > g) g = b[4]; };
  for (const b of colliders.walk) test(b);
  for (const b of colliders.solids) test(b);
  return g;
}
const keys = {};
addEventListener("keydown", (e) => { keys[e.code] = true; if (e.code === "KeyT") toggleTV(); if (e.code === "BracketRight") tune(1); if (e.code === "BracketLeft") tune(-1); });
addEventListener("keyup", (e) => { keys[e.code] = false; });
const stick = { id: null, x0: 0, y0: 0, x: 0, y: 0 }, look = { id: null, x: 0, y: 0 };
const view = $("view");
view.addEventListener("pointerdown", (e) => {
  hideHint();
  if (e.pointerType !== "mouse" && e.clientX < innerWidth * 0.45 && stick.id === null) {
    Object.assign(stick, { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, y: 0 });
    const s = $("stick"); s.style.left = e.clientX + "px"; s.style.top = e.clientY + "px"; s.style.display = "block"; s.firstElementChild.style.transform = "";
  } else if (look.id === null) Object.assign(look, { id: e.pointerId, x: e.clientX, y: e.clientY });
  view.setPointerCapture(e.pointerId);
});
view.addEventListener("pointermove", (e) => {
  if (e.pointerId === stick.id) {
    let dx = e.clientX - stick.x0, dy = e.clientY - stick.y0; const m = Math.hypot(dx, dy), max = 50;
    if (m > max) { dx *= max / m; dy *= max / m; }
    stick.x = dx / max; stick.y = dy / max; $("stick").firstElementChild.style.transform = `translate(${dx}px,${dy}px)`;
  } else if (e.pointerId === look.id) {
    const k = e.pointerType === "mouse" ? 0.0042 : 0.0058;
    P.yaw -= (e.clientX - look.x) * k; P.pitch = Math.max(-1.35, Math.min(1.35, P.pitch - (e.clientY - look.y) * k));
    look.x = e.clientX; look.y = e.clientY;
  }
});
const endPtr = (e) => {
  if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; $("stick").style.display = "none"; }
  if (e.pointerId === look.id) look.id = null;
};
view.addEventListener("pointerup", endPtr); view.addEventListener("pointercancel", endPtr);
let hintT = setTimeout(hideHint, 9000);
function hideHint() { clearTimeout(hintT); $("hint").classList.add("gone"); }

function move(dt) {
  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - stick.y;
  let s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + stick.x;
  const m = Math.hypot(f, s); if (m > 1) { f /= m; s /= m; }
  const speed = (keys.ShiftLeft ? 4.2 : 2.6) * dt;
  const sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
  const dx = (-sin * f + cos * s) * speed, dz = (-cos * f - sin * s) * speed;
  const p = P.pos;
  if (dx && !blocked(p.x + dx, p.z, p.y)) p.x += dx;
  if (dz && !blocked(p.x, p.z + dz, p.y)) p.z += dz;
  const g = groundAt(p.x, p.z, p.y);
  if (p.y > g + 0.001) { P.vy -= 9.8 * dt; p.y = Math.max(g, p.y + P.vy * dt); if (p.y === g) P.vy = 0; }
  else { p.y = g; P.vy = 0; }
  if (!isFinite(p.y) || p.y < -5) spawn();
  camera.position.set(p.x, p.y + P.eye, p.z);
  camera.rotation.set(P.pitch, P.yaw, 0, "YXZ");
  return m > 0.01;
}
function spawn() { const s = colliders.spawn; P.pos.set(s[0], s[1], s[2]); P.vy = 0; P.yaw = colliders.spawnYaw || 0; }

// ---------------------------------------------------------------- the TV: a real /tv/ page on the wall
let channels = [], ch = 1, tvOn = false, tvObj = null, iframe = null;
const TV_W = 1280, TV_H = 720;
async function setupTV() {
  try { channels = (await (await fetch("/tv/channels.json", { cache: "no-cache" })).json()).channels; } catch (e) { channels = [{ n: 1, name: "Heartbeat News" }]; }
  try { ch = +localStorage.getItem("hbhome-ch") || 1; } catch (e) {}
}
function tvSrc() { return `/tv/?embed=1&ch=${ch}`; }
function toggleTV(force) {
  tvOn = typeof force === "boolean" ? force : !tvOn;
  $("tvBtn").classList.toggle("on", tvOn); $("tvbar").classList.toggle("show", tvOn);
  if (tvOn && !tvObj && screenInfo) {
    iframe = document.createElement("iframe");
    iframe.width = TV_W; iframe.height = TV_H; iframe.allow = "autoplay; fullscreen"; iframe.src = tvSrc();
    iframe.style.width = TV_W + "px"; iframe.style.height = TV_H + "px"; iframe.style.backfaceVisibility = "hidden";
    tvObj = new CSS3DObject(iframe);
    const b = screenInfo.box, c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
    const w = Math.max(sz.x, sz.z), h = sz.y;
    tvObj.position.set(b.max.x + 0.004, c.y, c.z);
    tvObj.rotation.y = Math.PI / 2;
    tvObj.scale.set(w / TV_W, h / TV_H, 1);
    cssScene.add(tvObj);
  }
  if (tvObj) tvObj.visible = tvOn;
  if (tvOn && iframe && iframe.src.indexOf(tvSrc()) < 0) iframe.src = tvSrc();
  if (!tvOn && iframe) { iframe.src = "about:blank"; }
  showCh();
}
function tune(d) {
  if (!channels.length) return;
  ch = ((ch - 1 + d + channels.length) % channels.length) + 1;
  try { localStorage.setItem("hbhome-ch", ch); } catch (e) {}
  if (!tvOn) toggleTV(true); else if (iframe) iframe.src = tvSrc();
  showCh();
}
function showCh() { const c = channels[ch - 1]; $("chName").textContent = c ? `CH ${c.n} · ${c.name}` : `CH ${ch}`; }
$("tvBtn").onclick = () => toggleTV(); $("chUp").onclick = () => tune(1); $("chDown").onclick = () => tune(-1);

// hide the TV layer when a wall or floor is between you and the screen (CSS3D draws on top of the 3D view)
const _o = new THREE.Vector3(), _d = new THREE.Vector3();
function rayHitsBox(o, d, len, b) {
  let t0 = 0, t1 = len;
  for (let i = 0; i < 3; i++) {
    const oi = o.getComponent(i), di = d.getComponent(i), mn = b[i], mx = b[i + 3];
    if (Math.abs(di) < 1e-9) { if (oi < mn || oi > mx) return false; continue; }
    let a = (mn - oi) / di, c = (mx - oi) / di; if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return false;
  }
  return true;
}
function tvVisible() {
  if (!screenInfo) return false;
  const b = screenInfo.box, c = b.getCenter(new THREE.Vector3());
  if (camera.position.x < b.max.x) return false;
  let seen = 0;
  for (const dz of [-0.9, 0, 0.9]) for (const dy of [-0.45, 0.45]) {
    _o.copy(camera.position); _d.set(b.max.x + 0.02, c.y + dy, c.z + dz).sub(_o); const len = _d.length() - 0.05; _d.normalize();
    let hit = false;
    for (const box of colliders.solids.concat(colliders.walk)) { if (box[3] < 0.7) continue; if (rayHitsBox(_o, _d, len, box)) { hit = true; break; } }
    if (!hit) seen++;
  }
  return seen >= 3;
}

// ---------------------------------------------------------------- friends (Supabase Realtime, channel named by the secret invite code)
const others = new Map(); let chan = null, me = null, lastSend = 0;
function nameSprite(text) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d");
  g.fillStyle = "rgba(10,14,20,.7)"; g.beginPath(); g.roundRect(4, 8, 248, 48, 24); g.fill();
  g.fillStyle = "#fff"; g.font = "600 28px Barlow, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text.slice(0, 16), 128, 33);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); s.scale.set(0.8, 0.2, 1); s.renderOrder = 5; return s;
}
function avatar(name) {
  let h = 0; for (const ch_ of name) h = (h * 31 + ch_.charCodeAt(0)) >>> 0;
  const col = new THREE.Color().setHSL((h % 360) / 360, 0.55, 0.55);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.85, 6, 16), new THREE.MeshLambertMaterial({ color: col })); body.position.y = 0.66;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), new THREE.MeshLambertMaterial({ color: 0xe8d2c0 })); head.position.y = 1.45;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: 0x111111 })); visor.position.set(0, 1.47, -0.14);
  const tag = nameSprite(name); tag.position.y = 1.85;
  g.add(body, head, visor, tag); return g;
}
function upsertOther(k, st) {
  let o = others.get(k);
  if (!o) { o = { g: avatar(st.name || "Guest"), to: new THREE.Vector3(st.x, st.y, st.z), yaw: st.yaw || 0 }; o.g.position.copy(o.to); scene.add(o.g); others.set(k, o); }
  if (st.x !== undefined) { o.to.set(st.x, st.y, st.z); o.yaw = st.yaw; }
  renderWho();
}
function dropOther(k) { const o = others.get(k); if (o) { scene.remove(o.g); others.delete(k); } renderWho(); }
function renderWho() { $("who").textContent = others.size ? `Here now: you + ${others.size} friend${others.size > 1 ? "s" : ""}` : ""; }

async function joinHome(supabase, code, myName) {
  const key = (await getIdentity()).sessionId || Math.random().toString(36).slice(2);
  chan = supabase.channel("home:" + code, { config: { broadcast: { self: false }, presence: { key } } });
  chan.on("broadcast", { event: "pos" }, ({ payload }) => { if (payload && payload.k !== key) upsertOther(payload.k, payload); });
  chan.on("presence", { event: "leave" }, ({ key: k }) => dropOther(k));
  chan.on("presence", { event: "sync" }, () => {
    const st = chan.presenceState();
    for (const k of Object.keys(st)) if (k !== key && !others.has(k)) { const s0 = st[k][0] || {}; upsertOther(k, { name: s0.name, x: s0.x ?? 7, y: s0.y ?? 0, z: s0.z ?? -2, yaw: 0 }); }
    for (const k of [...others.keys()]) if (!st[k]) dropOther(k);
  });
  await new Promise((ok) => chan.subscribe((s) => { if (s === "SUBSCRIBED") ok(); }));
  await chan.track({ name: myName, x: P.pos.x, y: P.pos.y, z: P.pos.z });
  me = { key, name: myName };
}
function sendPos(moved, now) {
  if (!chan || !me) return;
  if (now - lastSend < (moved ? 110 : 2000)) return;
  lastSend = now;
  chan.send({ type: "broadcast", event: "pos", payload: { k: me.key, name: me.name, x: +P.pos.x.toFixed(2), y: +P.pos.y.toFixed(2), z: +P.pos.z.toFixed(2), yaw: +P.yaw.toFixed(2) } });
}

async function setupPeople() {
  let supabase; try { supabase = await getSupabase(); } catch (e) { return; }
  const ident = await getIdentity().catch(() => ({ name: "Guest", kind: "device" }));
  const invite = (qs.get("invite") || "").replace(/[^a-f0-9]/gi, "").slice(0, 32);
  if (invite) {
    const { data } = await supabase.rpc("home_by_invite", { p_code: invite });
    const row = data && data[0];
    if (!row) { $("sub").textContent = "That invite link has expired - ask for a new one"; return; }
    $("title").firstChild.textContent = `${row.owner_name || "A friend"}'s Loft`; $("sub").textContent = "You're visiting";
    await joinHome(supabase, invite, ident.name || "Guest");
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { $("sub").innerHTML = `Model loft · <a href="/admin" style="color:inherit">sign in</a> to get your own + invite friends`; return; }
  const { data: home, error } = await supabase.rpc("my_home", { p_name: ident.name });
  if (error || !home) { $("sub").textContent = "Heartbeat Homes"; return; }
  $("title").firstChild.textContent = `${home.owner_name || "Your"}'s Loft`; $("sub").textContent = "Your home";
  const link = () => `${location.origin}/homes/?invite=${home.invite_code}`;
  $("invBtn").style.display = ""; $("invLink").value = link();
  $("invBtn").onclick = () => $("invSheet").classList.add("show");
  $("invClose").onclick = () => $("invSheet").classList.remove("show");
  $("invCopy").onclick = async () => { try { await navigator.clipboard.writeText(link()); $("invCopy").textContent = "Copied ✓"; } catch (e) { $("invLink").select(); } };
  $("invShare").onclick = () => navigator.share ? navigator.share({ title: "Come hang out in my loft", url: link() }).catch(() => {}) : $("invCopy").onclick();
  $("invRoll").onclick = async () => {
    const { data } = await supabase.rpc("rotate_home_invite");
    if (data) { home.invite_code = data; $("invLink").value = link(); if (chan) { supabase.removeChannel(chan); chan = null; await joinHome(supabase, data, ident.name); } }
  };
  await joinHome(supabase, home.invite_code, ident.name || "Me");
}

// ---------------------------------------------------------------- go
bar(0.05);
try {
  await Promise.all([loadLoft(), setupTV()]);
} catch (e) {
  $("loadMsg").textContent = "The loft didn't load - check your connection and refresh."; console.error(e); throw e;
}
spawn(); showCh(); bar(1, "Welcome home.");
setTimeout(() => $("load").classList.add("done"), 250);
setupPeople().catch((e) => console.warn("homes people", e));
if (qs.get("tv") === "1") toggleTV(true);

const clock = new THREE.Clock(); let visT = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), now = performance.now();
  const moved = move(dt);
  sendPos(moved, now);
  for (const o of others.values()) { o.g.position.lerp(o.to, Math.min(1, dt * 8)); o.g.rotation.y += ((o.yaw || 0) - o.g.rotation.y) * Math.min(1, dt * 8); }
  if (tvObj && tvOn && now - visT > 150) { visT = now; tvObj.visible = tvVisible(); }
  renderer.render(scene, camera);
  if (tvObj && tvOn) css.render(cssScene, camera);
});
window.HBHome = { P, camera, toggleTV, tune, others };
