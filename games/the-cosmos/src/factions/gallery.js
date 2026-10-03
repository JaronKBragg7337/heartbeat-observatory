// ============================================================================
// factions/gallery.js - the in-game faction style gallery (package F0). Dev only: `?dev=1&styles=1` (or `styles=fortis` to open on
// one faction); also `window.cosmos.styles()`. One scrollable page, one card per style: palette, materials, signs and emblem (drawn
// by emblems.js), uniforms on real Loft people, a ship in the faction's livery, architecture and the comedy lines. Built to be read
// on a phone: one column, big targets, chips along the top.
//
// The 3D previews are drawn with the game's own renderer into a corner of its canvas and copied to a 2D canvas (so the lighting, tone
// mapping and colour space are the game's, and no second WebGL context is made). They are rendered one at a time, as a card scrolls
// into view, so opening the gallery costs nothing.
// ============================================================================
import { allFactionStyles, factionLook, shipLivery, applyLiveryTint, uniformRoles, shipMark } from './registry.js';
import { drawEmblem, drawSign } from './emblems.js';
import { css } from './_kit/style.js';
import { shipDef } from '../ships/registry.js';
import { visualsFor } from '../ships/visuals.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SHIPS = ['meridian', 'courier', 'hauler'];

const STYLE = `
#fx-gallery{position:fixed;inset:0;z-index:99999;overflow:auto;background:#0d1117;color:#e6edf3;font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;-webkit-overflow-scrolling:touch}
#fx-gallery *{box-sizing:border-box}
#fx-gallery .bar{position:sticky;top:0;z-index:2;background:#0d1117ee;backdrop-filter:blur(6px);padding:10px 12px;border-bottom:1px solid #30363d}
#fx-gallery .bar h1{margin:0 0 8px;font-size:16px;display:flex;justify-content:space-between;align-items:center;gap:8px}
#fx-gallery .chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}
#fx-gallery .chip{flex:0 0 auto;border:1px solid #30363d;background:#161b22;color:#e6edf3;border-radius:999px;padding:8px 12px;font-size:14px;min-height:40px;display:flex;align-items:center;gap:6px}
#fx-gallery .chip i{width:12px;height:12px;border-radius:50%;display:inline-block;border:1px solid #fff4}
#fx-gallery .close{background:#da3633;border:0;color:#fff;border-radius:8px;padding:8px 14px;min-height:40px;font-size:14px}
#fx-gallery .card{margin:16px 12px;border-radius:14px;overflow:hidden;border:1px solid #30363d;background:#161b22}
#fx-gallery .head{padding:14px 14px 10px;border-left:8px solid var(--a)}
#fx-gallery .head h2{margin:0;font-size:22px}
#fx-gallery .head .tag{color:#9fb3c8;font-style:italic;margin-top:2px}
#fx-gallery .head .meta{color:#7d8590;font-size:12px;margin-top:4px;text-transform:uppercase;letter-spacing:.08em}
#fx-gallery .body{padding:0 14px 14px}
#fx-gallery h3{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#7d8590;margin:16px 0 6px}
#fx-gallery .sw{display:flex;flex-wrap:wrap;gap:6px}
#fx-gallery .sw div{width:62px;border-radius:8px;overflow:hidden;border:1px solid #30363d;font-size:10px;text-align:center;background:#0d1117}
#fx-gallery .sw div b{display:block;height:38px}
#fx-gallery .mat{display:flex;gap:10px;align-items:flex-start;margin:6px 0;font-size:13px}
#fx-gallery .mat b{flex:0 0 28px;height:28px;border-radius:50%;border:1px solid #fff4}
#fx-gallery .mat span{color:#9fb3c8}
#fx-gallery canvas{max-width:100%;border-radius:10px;display:block;background:#0b0f14}
#fx-gallery .signs{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#fx-gallery .shots{display:grid;grid-template-columns:1fr;gap:10px}
@media(min-width:760px){#fx-gallery .shots{grid-template-columns:1fr 1fr}}
#fx-gallery .shot{position:relative}
#fx-gallery .shot .cap{position:absolute;left:8px;bottom:8px;background:#000a;border-radius:6px;padding:3px 8px;font-size:12px}
#fx-gallery .shot button{position:absolute;right:8px;bottom:8px;background:#238636;border:0;color:#fff;border-radius:6px;padding:8px 12px;min-height:36px;font-size:13px}
#fx-gallery .role{display:flex;gap:10px;align-items:flex-start;margin:6px 0;font-size:13px}
#fx-gallery .role b{flex:0 0 22px;height:22px;border-radius:5px;border:1px solid #fff4}
#fx-gallery .role em{font-style:normal;color:#e6edf3;font-weight:600;margin-right:4px}
#fx-gallery .role span{color:#9fb3c8}
#fx-gallery ul{margin:4px 0;padding-left:18px;color:#c9d1d9;font-size:13px}
#fx-gallery .avoid{color:#f0883e}
#fx-gallery p{margin:4px 0;font-size:13px;color:#c9d1d9}
`;

export async function openGallery({ engine, people, THREE, mats, open }) {
  closeGallery();
  const styles = allFactionStyles();
  const root = el('div'); root.id = 'fx-gallery';
  const st = el('style'); st.textContent = STYLE; root.appendChild(st);
  const bar = el('div', 'bar');
  const h1 = el('h1', null, `<span>Faction style sheet <small style="color:#7d8590">F0 - ${styles.length} looks</small></span>`);
  const x = el('button', 'close', 'Close'); x.onclick = closeGallery; h1.appendChild(x); bar.appendChild(h1);
  const chips = el('div', 'chips');
  for (const s of styles) { const c = el('button', 'chip', `<i style="background:${css(s.palette.accent)}"></i>${esc(s.name.replace(' (neutral)', '').replace('The alien-looking ship', 'Alien ship'))}`); c.onclick = () => root.querySelector(`#fx-${s.id}`).scrollIntoView({ behavior: 'smooth', block: 'start' }); chips.appendChild(c); }
  bar.appendChild(chips); root.appendChild(bar);

  const queue = []; let busy = false;
  const pump = async () => { if (busy) return; busy = true; while (queue.length) { const job = queue.shift(); try { await job(); } catch (e) { console.warn('gallery preview failed', e); } } busy = false; };
  const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting && !e.target._done) { e.target._done = true; queue.push(e.target._render); } pump(); }, { root, rootMargin: '300px' });

  const ctxEnv = { engine, people, THREE, mats };
  for (const s of styles) root.appendChild(card(s, ctxEnv, io));
  document.body.appendChild(root);
  if (open && open !== '1') { const t = root.querySelector(`#fx-${open}`); if (t) setTimeout(() => t.scrollIntoView({ block: 'start' }), 50); }
  return root;
}
export function closeGallery() { const r = document.getElementById('fx-gallery'); if (r) r.remove(); }

function card(s, env, io) {
  const P = s.palette, c = el('section', 'card'); c.id = `fx-${s.id}`;
  c.style.setProperty('--a', css(P.accent));
  c.appendChild(el('div', 'head', `<h2>${esc(s.name)}</h2><div class="tag">${esc(s.tagline)}</div><div class="meta">${esc(s.kind)} - home: ${esc(s.home)}</div>`));
  const b = el('div', 'body'); c.appendChild(b);
  b.appendChild(el('p', null, esc(s.ethos)));

  b.appendChild(el('h3', null, 'Palette'));
  const sw = el('div', 'sw');
  for (const [k, v] of [...Object.entries(s.palette).filter(([k]) => k !== 'extra'), ...(P.extra || []).map((v, i) => ['extra ' + (i + 1), v])]) sw.appendChild(el('div', null, `<b style="background:${css(v)}"></b>${esc(k)}<br>${css(v)}`));
  b.appendChild(sw);
  b.appendChild(el('p', null, `Lights: ambient ${css(s.lights.ambient)}, work ${css(s.lights.work)}, signal ${css(s.lights.signal)}${s.lights.alarm ? ', alarm ' + css(s.lights.alarm) : ''}.`));

  b.appendChild(el('h3', null, 'Signs and emblem'));
  const sg = el('div', 'signs'); const cv = el('canvas'); cv.width = 640; cv.height = 300; cv.style.width = '100%'; cv.style.maxWidth = '640px'; sg.appendChild(cv); b.appendChild(sg);
  paintSigns(cv, s);
  b.appendChild(el('p', null, `Lettering: ${esc(s.signs.font)}. Numbering: ${esc(s.signs.numbering.pattern)} (${esc(s.signs.numbering.example)}). Emblem: ${esc(s.signs.emblem.meaning)}.`));

  if (s.kind !== 'alien') {
    b.appendChild(el('h3', null, 'People in uniform (Loft people, tinted)'));
    const shot = el('div', 'shot'); const pc = el('canvas'); pc.width = 720; pc.height = 380; pc.style.width = '100%'; shot.appendChild(pc);
    shot.appendChild(el('div', 'cap', 'loading people...')); b.appendChild(shot);
    c._renderPeople = () => renderPeople(env, s, pc, shot.querySelector('.cap'));
  }
  b.appendChild(el('h3', null, 'Ship livery'));
  const sh = el('div', 'shot'); const sc = el('canvas'); sc.width = 720; sc.height = 380; sc.style.width = '100%'; sh.appendChild(sc);
  const scap = el('div', 'cap', 'loading ship...'); sh.appendChild(scap);
  const btn = el('button', null, 'Next ship'); sh.appendChild(btn); b.appendChild(sh);
  let si = 0;
  const draw = () => renderShip(env, s, sc, scap, SHIPS[si % SHIPS.length]);
  btn.onclick = () => { si++; draw(); };
  c._renderShip = draw;
  const V = shipLivery(s.id);
  b.appendChild(el('p', null, `${esc(V.shape)}`));
  b.appendChild(el('p', null, `Stripe (${esc(V.stripe.kind)}): ${esc(V.stripe.note)}. Registry ${esc(shipMark(s.id, 7, 'Example').registry || 'none')}. Names: ${esc(V.nameStyle)}. Weathering: grime ${V.weathering.grime}, scorch ${V.weathering.scorch}, patchwork ${V.weathering.patchwork}.`));

  b.appendChild(el('h3', null, 'Materials'));
  for (const m of s.materials) b.appendChild(el('div', 'mat', `<b style="background:${css(m.color)}"></b><div><strong>${esc(m.name)}</strong> <span>rough ${m.roughness}, metal ${m.metalness}</span><br><span>${esc(m.use)}</span></div>`));

  if (s.uniforms) {
    b.appendChild(el('h3', null, 'Uniforms'));
    for (const r of uniformRoles(s.id)) { const u = s.uniforms[r]; b.appendChild(el('div', 'role', `<b style="background:${css(u.cloth)}"></b><div><em>${esc(r)}</em><span>${esc(u.note)}${u.helmet ? ' (duty helmet)' : ''}</span></div>`)); }
  }
  if (s.architecture) {
    const A = s.architecture;
    b.appendChild(el('h3', null, 'Architecture'));
    b.appendChild(el('p', null, `<b>Massing:</b> ${esc(A.massing)}`));
    b.appendChild(el('p', null, `<b>Roofs:</b> ${esc(A.roofs)}<br><b>Windows:</b> ${esc(A.windows)}<br><b>Light:</b> ${esc(A.lighting)}<br><b>Ground:</b> ${esc(A.ground)}`));
    b.appendChild(el('p', null, `<b>Motifs:</b> ${esc(A.motifs.join(', '))}`));
    b.appendChild(el('p', null, `<b>Props:</b> ${esc(A.props.join(', '))}`));
    b.appendChild(el('p', 'avoid', `<b>Avoid:</b> ${esc(A.avoid.join('; '))}`));
  }
  b.appendChild(el('h3', null, 'Places, slogans, graffiti'));
  b.appendChild(el('p', null, `<b>Places:</b> ${esc(s.signs.places.join(' / '))}`));
  b.appendChild(el('ul', null, s.signs.slogans.map((t) => `<li>${esc(t)}</li>`).join('')));
  b.appendChild(el('p', null, '<b>Graffiti:</b>')); b.appendChild(el('ul', null, s.signs.graffiti.map((t) => `<li>${esc(t)}</li>`).join('')));

  c._render = async () => { if (c._renderPeople) await c._renderPeople(); await c._renderShip(); };
  c._observe = true; io.observe(c);
  return c;
}

function paintSigns(cv, s) {
  const g = cv.getContext('2d'), P = s.palette;
  g.fillStyle = css(P.dark); g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = css(P.primary); g.fillRect(0, 0, cv.width, 8);
  if (s.signs.emblem.shape === 'none') { g.fillStyle = css(P.accent); g.font = '20px sans-serif'; g.textAlign = 'center'; g.fillText('no lettering, no mark: nothing a person can read', 320, 150); return; }
  drawEmblem(g, s.id, 90, 100, 130);
  drawSign(g, s.id, s.signs.places[0], 170, 40, 450, 120, 'plate');
  drawSign(g, s.id, [...s.signs.slogans].sort((a, b) => a.length - b.length)[0], 20, 190, 400, 90, 'banner');
  drawSign(g, s.id, 'CAUTION', 440, 190, 180, 90, 'warning');
}

// ---- 3D previews, drawn by the game's own renderer into a corner of its canvas, then copied ------------------------------------
function snap(env, scene, camera, out, w, h, bg) {
  const { THREE, engine } = env, r = engine.renderer, dom = r.domElement;
  const pr = r.getPixelRatio(), prevT = r.getRenderTarget(), prevClear = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha(), prevAuto = r.autoClear;
  const vp = r.getViewport(new THREE.Vector4()), sc = r.getScissor(new THREE.Vector4()), scT = r.getScissorTest();
  const cw = Math.floor(dom.width / pr), chh = Math.floor(dom.height / pr), vw = Math.min(w, cw), vh = Math.min(h, chh);
  r.setRenderTarget(null); r.autoClear = true; r.setClearColor(bg, 1);
  r.setScissorTest(true); r.setViewport(0, 0, vw, vh); r.setScissor(0, 0, vw, vh);
  camera.aspect = vw / vh; camera.updateProjectionMatrix();
  r.render(scene, camera);
  const g = out.getContext('2d'); g.drawImage(dom, 0, dom.height - vh * pr, vw * pr, vh * pr, 0, 0, out.width, out.height);
  r.setScissorTest(scT); r.setViewport(vp); r.setScissor(sc); r.setClearColor(prevClear, prevAlpha); r.autoClear = prevAuto; r.setRenderTarget(prevT);
}

function lights(THREE, scene, s) {
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x605848, 2.4));
  const sun = new THREE.DirectionalLight(0xfff0dc, 5.5); sun.position.set(-4, 6, 5); scene.add(sun);
  const rim = new THREE.DirectionalLight(s.lights.signal, 1.1); rim.position.set(5, 2, -5); scene.add(rim);
}

async function renderPeople(env, s, canvas, cap) {
  const { THREE, people } = env;
  const scene = new THREE.Scene(); lights(THREE, scene, s);
  const roles = ['worker', s.uniforms.guard ? 'guard' : s.uniforms.pilot ? 'pilot' : 'civilian', 'leader'];
  const spawned = [];
  for (let i = 0; i < roles.length; i++) {
    const look = factionLook(s.id, 3 + i * 5, roles[i]);
    const p = people.spawn(look.personId); await p.ready;
    if (p.loaded) { p.play('Idle', 0); p.update(0.5); p.dress(look); }
    p.group.position.set((i - 1) * 0.95, 0, i === 1 ? 0.15 : 0); p.group.rotation.y = (1 - i) * 0.28; scene.add(p.group); spawned.push(p);
  }
  const ground = new THREE.Mesh(new THREE.CircleGeometry(4, 32), new THREE.MeshStandardMaterial({ color: s.palette.dark, roughness: 0.9 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const cam = new THREE.PerspectiveCamera(32, canvas.width / canvas.height, 0.1, 50); cam.position.set(0, 1.2, 4.3); cam.lookAt(0, 0.95, 0);
  await new Promise((r) => requestAnimationFrame(r));
  snap(env, scene, cam, canvas, 720, 380, new THREE.Color(s.palette.dark).lerp(new THREE.Color(0x8a97a6), 0.55));
  cap.textContent = roles.map((r) => r).join(' / ') + (spawned.every((p) => p.loaded) ? '' : ' (stand-in bodies: the Loft files did not load)');
  for (const p of spawned) p.dispose();
}

async function renderShip(env, s, canvas, cap, type) {
  const { THREE, mats } = env;
  if (!mats) { cap.textContent = 'no ship materials yet'; return; }
  const def = shipDef(type), V = visualsFor(type);
  const scene = new THREE.Scene(); lights(THREE, scene, s);
  const ext = V.buildExterior(def.layout, mats, { tier: 'low', def, remote: true, decal: null });
  V.applyNeutralPose(ext);
  applyLiveryTint(THREE, ext.root, mats, s.id);
  scene.add(ext.root);
  const box = new THREE.Box3().setFromObject(ext.root), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  const R = Math.max(size.x, size.y, size.z) * 0.5;
  const cam = new THREE.PerspectiveCamera(30, canvas.width / canvas.height, 0.5, 2000);
  const d = R / Math.tan(THREE.MathUtils.degToRad(15)) * 0.82;
  cam.position.set(mid.x + d * 0.78, mid.y + d * 0.32, mid.z + d * 0.62); cam.lookAt(mid);
  const grid = new THREE.Mesh(new THREE.CircleGeometry(R * 2.2, 40), new THREE.MeshStandardMaterial({ color: new THREE.Color(s.palette.dark).lerp(new THREE.Color(0x6a7684), 0.4), roughness: 0.95 })); grid.rotation.x = -Math.PI / 2; grid.position.y = box.min.y - 0.4; scene.add(grid);
  await new Promise((r) => requestAnimationFrame(r));
  snap(env, scene, cam, canvas, 720, 380, new THREE.Color(s.palette.dark).lerp(new THREE.Color(0x8a97a6), 0.55));
  const mk = shipMark(s.id, 7, def.name || type);
  cap.textContent = `${def.name || type} in ${s.name} colours${mk.registry ? ' - ' + mk.registry : ''}`;
  ext.root.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); });
}
