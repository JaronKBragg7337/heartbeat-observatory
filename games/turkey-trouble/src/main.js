// Turkey Trouble: boot, screens, the fixed-step loop, events -> sound / effects / HUD, the story, the ending, director.
import { createStage } from './render/stage.js';
import { createGame, makeInput, MODE_NAMES, STORY, STORY_LINES, ENDING_LINES, DT } from './game/game.js';
import { worldFor } from './game/world.js';
import { createCast, createView, PEOPLE } from './game/view.js';
import { makeFollowCam, orbitShot } from './game/camera.js';
import { findBot, huntedFleeBot, huntWinBot, escapeBot } from './game/bots.js';
import { createControls } from './ui/input.js';
import { createHud, fmtTime } from './ui/hud.js';
import { createAudio } from './audio.js';
import { seedFrom } from './game/rng.js';

const Q = new URLSearchParams(location.search);
const DEBUG = Q.get('debug') === '1';
const DIRECTOR = Q.get('director') === '1';
const MODE_Q = Q.get('mode');
const SEED_Q = Q.get('seed');
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d = null) { try { const v = localStorage.getItem('tt-' + k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('tt-' + k, String(v)); } catch (e) { /* private tab */ } },
};

const canvas = $('c');
const hud = createHud();
const audio = createAudio({ muted: Q.get('mute') === '1' || store.get('muted') === '1' });
hud.setMuted(audio.muted);

const app = {
  screen: 'loading', game: null, view: null, kind: null, story: null, storyIndex: 0, run: 0, paused: false,
  personPick: store.get('person', 'random'), person: null, seed: 0, endedAt: 0, resultShown: false, endingT: -1,
  director: DIRECTOR, bot: null, shotT: 0, shot: 0, starting: false,
};
let stage, cast, cam, world, controls;
const input = makeInput();

// ------------------------------------------------------------------------------------------ boot
async function boot() {
  const bar = $('loadBar'), msg = $('loadMsg');
  try {
    stage = await createStage({ canvas, quality: Q.get('quality') || 'auto', onProgress: (p) => { bar.style.width = Math.round(20 + p * 40) + '%'; } });
  } catch (e) {
    console.error(e); msg.textContent = 'This phone could not start the 3D view. Try closing other tabs, then reload.'; return;
  }
  world = worldFor(stage.layout);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); app.screen = 'glLost'; hud.screen('glLost'); hud.show(false); }, false);
  msg.textContent = 'Waking the turkey…';
  cast = await createCast(stage, (p) => { bar.style.width = Math.round(60 + p * 30) + '%'; });
  cam = makeFollowCam(stage.camera, world);
  controls = createControls(canvas, {
    enabled: () => app.screen === 'play' && !app.paused && !app.director,
    onLook: (dx, dy) => cam.look(dx, dy),
    onFirstGesture: () => audio.unlock(),
    actionButton: $('btnAction'),
  });
  // preload the chosen person (and the farmer) in the background so the first start is quick
  cast.person(app.personPick !== 'random' ? app.personPick : 'ada').catch(() => {});
  bar.style.width = '100%';
  buildTitle();
  addEventListener('resize', () => stage.resize());
  addEventListener('orientationchange', () => setTimeout(() => stage.resize(), 250));
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true, true); else if (app.screen !== 'pause') audio.pause(false); });
  for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, () => audio.unlock(), { passive: true });
  wireButtons();
  if (MODE_Q && (MODE_NAMES[MODE_Q])) start(MODE_Q);
  else if (DIRECTOR) start('story');
  else showTitle();
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------------------------------ title
function buildTitle() {
  const box = $('people'); box.innerHTML = '';
  const mk = (id) => {
    const b = document.createElement('button');
    b.className = 'person' + (id === 'random' ? ' rand' : '');
    b.setAttribute('role', 'radio'); b.dataset.id = id;
    b.setAttribute('aria-label', id === 'random' ? 'Surprise me' : id);
    if (id === 'random') b.textContent = '?'; else b.style.backgroundImage = `url(/homes/people/${id}.jpg)`;
    b.addEventListener('click', () => { app.personPick = id; store.set('person', id); for (const c of box.children) c.setAttribute('aria-checked', String(c.dataset.id === id)); if (id !== 'random') cast.person(id).catch(() => {}); });
    b.setAttribute('aria-checked', String(app.personPick === id));
    box.appendChild(b);
  };
  mk('random'); PEOPLE.forEach(mk);
  if (![...box.children].some((c) => c.getAttribute('aria-checked') === 'true')) box.children[0].setAttribute('aria-checked', 'true');
  for (const b of $('modes').querySelectorAll('.mode')) b.addEventListener('click', () => { audio.unlock(); start(b.dataset.mode); });
  const touch = matchMedia('(pointer: coarse)').matches;
  $('controlsHint').textContent = touch ? 'Left thumb walks (push to the edge to run). Right side looks around.' : 'WASD or arrows walk, Shift runs, Space acts, drag the mouse to look.';
}
function showTitle() {
  app.screen = 'title'; app.game = null; app.story = null; app.endingT = -1;
  hud.show(false); hud.screen('title');
  cast.hideAll(); cam.reset();
  showBests();
  const sp = stage.layout.spawns.player;
  cast.turkey.root.visible = true; cast.turkey.root.position.set(sp.x + 1.6, 0, sp.z - 6); cast.turkey.root.rotation.set(0, 0.6, 0);
  titleT = 0;
}
let titleT = 0;
// best times on the title's mode cards (Escape only for now; never on the ending card)
function showBests() {
  const el = $('bestEscape'); if (!el) return;
  const v = store.get('best-escape', '');
  const n = Number(v);
  if (v !== '' && Number.isFinite(n) && n > 0) { el.textContent = `Best: ${fmtTime(n)}`; el.hidden = false; } else el.hidden = true;
}

// ------------------------------------------------------------------------------------------ playing
async function start(mode, extra = {}) {
  if (app.starting) return;
  app.starting = true;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  try {
    if (mode === 'story') { app.story = STORY; app.storyIndex = 0; app.run = 0; mode = STORY[0]; app.person = pickPerson(); }
    else if (!extra.keepStory) { app.story = null; if (!extra.keepRun || !app.person) { app.person = pickPerson(); app.run = 0; } }
    app.seed = SEED_Q ? seedFrom(SEED_Q) : seedFrom(null);
    const game = createGame(mode, stage.layout, { seed: app.seed, carry: extra.carry, run: app.run });
    hud.hideScreens();
    // the old view stops drawing now, so it cannot re-show anything the new one hides
    const oldView = app.view; app.view = null; app.game = null; if (app.screen === 'title') app.screen = 'loading-mode';
    if (oldView) oldView.dispose();
    if (!cast.people.has(app.person) || (mode === 'escape' && !cast.pools.size)) hud.toast('Getting ready…', 30);
    const view = await createView(cast, game, { personId: app.person, debug: DEBUG });
    hud.toast('', 0.01);
    app.game = game; app.view = view; app.kind = mode; app.resultShown = false; app.endedAt = 0; app.endingT = -1; app.paused = false; acc = 0;
    cam.reset(); cam.setMode(mode === 'escape' ? 'turkey' : 'person');
    cam.snapBehind(mode === 'escape' ? 0 : game.player.heading);
    controls.clear();
    hud.setup(game); hud.show(!app.director);
    app.screen = 'play';
    if (app.director) { app.bot = ({ find: findBot, hunted: huntedFleeBot, hunt: huntWinBot, escape: escapeBot })[mode](game); app.shotT = 0; }
    const goal = { find: 'Find the turkey. Listen for the gobble.', hunted: 'Run! Last 75 seconds.', hunt: 'Sneak up close, then dive!', escape: 'Get to the woods!' }[mode];
    if (!app.director) hud.toast(goal, 2.6);
    if (!app.director && !sessionFlag('hint-' + (matchMedia('(pointer: coarse)').matches ? 't' : 'k'))) {
      hud.hint(matchMedia('(pointer: coarse)').matches ? 'Left thumb: walk. Right side: look around.' + (game.hud.action ? ` Button: ${game.hud.action.toLowerCase()}.` : '') : 'WASD to walk, Shift runs, drag to look' + (game.hud.action ? ', Space to ' + game.hud.action.toLowerCase() : '') + '.', 5);
    }
    if (mode === 'hunted') { audio.gobble(game.turkey.x, game.turkey.z, 1); audio.thunder(); if (stage.fx.lightning) stage.fx.lightning(); }
  } catch (e) {
    console.error(e); app.starting = false; showTitle(); hud.toast('That did not start. Try again?', 2.5);
  } finally { app.starting = false; }
}
function pickPerson() { return app.personPick && app.personPick !== 'random' ? app.personPick : PEOPLE[Math.floor(Math.random() * PEOPLE.length)]; }
const flags = new Set();
function sessionFlag(k) { if (flags.has(k)) return true; flags.add(k); return false; }

function setPaused(p, fromHide = false) {
  if (app.screen !== 'play' && !(app.screen === 'pause' && !p)) { if (fromHide) audio.pause(true); return; }
  if (app.director && fromHide) return;
  app.paused = p; audio.pause(p);
  if (p) { app.screen = 'pause'; hud.screen('pause'); controls.clear(); }
  else { app.screen = 'play'; hud.hideScreens(); last = performance.now(); }
}

function wireButtons() {
  $('btnMute').addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); audio.setMuted(!audio.muted); store.set('muted', audio.muted ? '1' : '0'); hud.setMuted(audio.muted); });
  $('btnPause').addEventListener('click', (e) => { e.stopPropagation(); setPaused(true); });
  $('btnResume').addEventListener('click', () => setPaused(false));
  $('btnRestart').addEventListener('click', () => { audio.pause(false); start(app.kind, { keepStory: !!app.story, keepRun: true }); });
  $('btnQuit').addEventListener('click', () => { audio.pause(false); showTitle(); });
  $('btnHome').addEventListener('click', () => showTitle());
  $('btnRetry').addEventListener('click', () => start(app.kind, { keepStory: !!app.story, keepRun: true }));
  $('btnNext').addEventListener('click', () => onNext());
  $('btnBetween').addEventListener('click', () => nextChapter());
  $('btnFaster').addEventListener('click', () => { app.run++; start('escape', { keepRun: true }); });
  $('btnFarm').addEventListener('click', () => showTitle());
  $('btnReload').addEventListener('click', () => location.reload());
}

// ------------------------------------------------------------------------------------------ results and the story
const EXIT_NAMES = { woods_gap: 'the gap by the woods', silo_gap: 'the gap behind the silo', south_gate: 'the front gate' };
function best(kind, value, lowerIsBetter = true) {
  const prev = Number(store.get('best-' + kind, ''));
  const has = store.get('best-' + kind, '') !== '' && Number.isFinite(prev);
  const better = !has || (lowerIsBetter ? value < prev : value > prev);
  if (better) store.set('best-' + kind, value);
  return { prev: has ? prev : null, better };
}
function showResult() {
  const g = app.game, r = g.result; app.resultShown = true;
  if (app.story && r.win && app.storyIndex < app.story.length - 1) {
    $('betweenLine').textContent = STORY_LINES[app.kind] || 'Keep going!';
    app.screen = 'between'; hud.show(false); hud.screen('between'); return;
  }
  $('resTitle').textContent = r.title;
  let text = '', bestTxt = '';
  if (app.kind === 'find') { text = `Found it in ${fmtTime(r.time)}.`; const b = best('find', Math.round(r.time)); bestTxt = b.better && b.prev !== null ? 'A new best time!' : b.prev !== null ? `Best: ${fmtTime(b.prev)}` : ''; }
  if (app.kind === 'hunted') { text = r.win ? `You lasted the whole 75 seconds with ${g.hearts} ${g.hearts === 1 ? 'heart' : 'hearts'} left.` : `It got you after ${fmtTime(r.time)}.`; if (r.win) { const b = best('hunted', g.hearts, false); bestTxt = b.prev !== null && !b.better ? `Best: ${b.prev} hearts left` : ''; } }
  if (app.kind === 'hunt') { text = r.win ? `Caught it in ${fmtTime(r.time)}.` : `It got out through ${EXIT_NAMES[r.exit] || 'a gap in the fence'}.`; if (r.win) { const b = best('hunt', Math.round(r.time)); bestTxt = b.better && b.prev !== null ? 'A new best time!' : b.prev !== null ? `Best: ${fmtTime(b.prev)}` : ''; } }
  $('resText').textContent = text; $('resBest').textContent = bestTxt;
  $('btnNext').textContent = r.win ? (app.story ? 'Keep going' : 'Play again') : 'Try again';
  $('btnRetry').hidden = true;
  app.screen = 'result'; hud.show(false); hud.screen('result');
}
function onNext() {
  const r = app.game && app.game.result;
  if (!r || !r.win) return start(app.kind, { keepStory: !!app.story, keepRun: true });
  if (app.story) return nextChapter();
  start(app.kind, { keepRun: true });
}
function nextChapter() {
  const carry = app.kind === 'find' && app.game.carryOut ? app.game.carryOut() : undefined;
  app.storyIndex++;
  start(app.story[app.storyIndex], { keepStory: true, keepRun: true, carry });
}

// the ending: the side view, the two knocks (rules emit them), then the card, one line at a time
function startEndingCard() {
  hud.show(false); hud.screen('ending');
  for (const id of ['e1', 'e2', 'e3']) { const e = $(id); e.textContent = ''; e.classList.remove('on'); }
  $('endingButtons').hidden = true;
  app.screen = 'ending'; app.endingT = 0;
  store.set('escaped', Number(store.get('escaped', '0')) + 1);
  best('escape', Math.round(app.game.result.time));
  // the run-again button: faster each time until the cap, then it says so (still one more go, just as fast)
  $('btnFaster').textContent = app.game.topSpeed ? 'Run again (top speed!)' : app.run > 0 ? `Run again (even faster)` : 'Run again (faster)';
}
function tickEndingCard(dt) {
  if (app.endingT < 0) return;
  const before = app.endingT; app.endingT += dt;
  const at = [0.7, 2.1, 3.6];
  at.forEach((t, i) => { if (before < t && app.endingT >= t) { const e = $('e' + (i + 1)); e.textContent = ENDING_LINES[i]; e.classList.add('on'); } });
  if (before < 7.2 && app.endingT >= 7.2 && !app.director) $('endingButtons').hidden = false;
  if (app.director && app.endingT > 9) { app.endingT = -1; showTitle(); }
}

// ------------------------------------------------------------------------------------------ events -> sound, effects, HUD
const LANE_TOASTS = { yard: 'Out of the yard!', farmlane: 'Past the tractor!', creek: 'Over the creek!', gravel: 'Across the gravel road!', stubble: 'Through the field!', highway: 'Over the highway!' };
let toastedCharge = false, toastedDog = false, toastedTaunt = 0;
function onEvent(e, g) {
  const fx = stage.fx;
  switch (e.type) {
    case 'gobble': audio.gobble(e.x, e.z, e.loud); if (e.taunt && toastedTaunt++ % 2 === 0 && !app.director) hud.toast('Gobble gobble!', 1.2); break;
    case 'feathers': fx.feathers(e.x, (e.y ?? 0.6) + stage.groundHeight(e.x, e.z), e.z, e.n || 8); break;
    case 'found': audio.flap(e.x, e.z, 9); audio.win(); hud.toast('Found it!', 2, true); cam.shake = 0.5; break;
    case 'slip': hud.toast('It slipped away!', 1.6); audio.flap(e.x, e.z, 6); break;
    case 'peck': audio.bonk(e.x, e.z); hud.hurt(); cam.shake = 1; if (navigator.vibrate) try { navigator.vibrate(60); } catch (er) { /* */ } if (e.hearts > 0) hud.toast(e.hearts === 1 ? 'Ouch! One heart left' : 'Ouch!', 1.2); break;
    case 'peckMiss': audio.whoosh(e.x, e.z); break;
    case 'charge': audio.gobble(e.x, e.z, 1); audio.flap(e.x, e.z, 4); if (!toastedCharge && !app.director) { toastedCharge = true; hud.toast('Look out! Step aside!', 1.4); } break;
    case 'bonk': audio.thud(e.x, e.z); fx.dust(e.x, e.z); hud.toast('Bonk!', 0.9); break;
    case 'lost': if (!app.director) hud.toast('It lost you…', 1.2); break;
    case 'win': audio.win(); hud.toast('You made it!', 2, true); break;
    case 'lose': audio.lose(); break;
    case 'dive': audio.whoosh(e.x, e.z); break;
    case 'miss': audio.thud(e.x, e.z); fx.dust(e.x, e.z); break;
    case 'caught': audio.flap(e.x, e.z, 10); audio.gobble(e.x, e.z, 1); audio.win(); hud.toast('Got it!', 2, true); cam.shake = 0.6; break;
    case 'juke': audio.flap(e.x, e.z, 3); break;
    case 'bolt': hud.toast('It is making a run for it!', 1.8); break;
    case 'escaped': hud.toast('It got away!', 2, true); break;
    case 'splash': audio.splash(e.x, e.z); fx.splash(e.x, e.z); hud.toast('Splash!', 1); break;
    case 'hit': audio.thud(e.x, e.z); audio.flap(e.x, e.z, 6); cam.shake = 0.8; hud.toast('Bonk! Try that lane again', 1.3); break;
    case 'horn': audio.horn(e.x, e.z, e.kind); break;
    case 'lane': if (LANE_TOASTS[e.id]) hud.toast(LANE_TOASTS[e.id], 1.3); break;
    case 'spotted': audio.hey(e.x, e.z); hud.toast('The farmer saw you!', 1.4); break;
    case 'swing': audio.whoosh(e.x, e.z); break;
    case 'netted': audio.flap(e.x, e.z, 8); audio.sting(); hud.toast(e.who === 'dog' ? 'The dog got you! Back to the barn' : 'Caught in the net! Back to the barn', 1.8); break;
    case 'netMiss': break;
    case 'bark': audio.bark(e.x, e.z); if (!toastedDog && !app.director) { toastedDog = true; hud.toast('The dog woke up!', 1.3); } break;
    case 'flap': audio.flap(e.x, e.z, 4); break;
    case 'land': fx.dust(e.x, e.z); break;
    case 'ending': hud.show(false); hud.el.hint.hidden = true; hud.el.toast.classList.remove('on'); break;
    case 'knock': audio.knock(); break;
    case 'card': startEndingCard(); break;
  }
}

// ------------------------------------------------------------------------------------------ the frame
let last = performance.now(), acc = 0, fpsT = 0, fpsN = 0, fps = 0;
let stepDist = 0, beatT = 0, creekLane = null;
let passSign = new Int8Array(0);
function frame(now) {
  requestAnimationFrame(frame);
  if (!stage) return;
  let dt = (now - last) / 1000; last = now;
  if (!(dt > 0)) dt = 0; if (dt > 0.1) dt = 0.1;
  fpsT += dt; fpsN++; if (fpsT > 0.5) { fps = Math.round(fpsN / fpsT); fpsT = 0; fpsN = 0; }

  if (app.screen === 'glLost') return;
  if (app.screen === 'title' || app.screen === 'loading') { titleFrame(dt); return; }
  const g = app.game, v = app.view;
  if (!g || !v) { stage.render(); return; }

  if (app.screen === 'play' && !app.paused) {
    acc += dt;
    let n = 0;
    while (acc >= DT && n < 8) {
      if (app.director && app.bot) { app.bot.think(input); }
      else if (window.__tt.pilot) { controls.read(input, cam.yaw); window.__tt.pilot(input, g); }   // test hook: a bot plays, the normal camera watches
      else { controls.read(input, cam.yaw); input.action = controls.takeAction(); }
      v.beforeStep();
      g.events.length = 0;
      g.step(input);
      for (let i = 0; i < g.events.length; i++) onEvent(g.events[i], g);
      if (app.director && app.bot) { /* bots read events next think */ }
      input.action = false;
      acc -= DT; n++;
    }
    if (n === 8) acc = 0;
    if ((g.phase === 'won' || g.phase === 'lost') && !app.resultShown) {
      app.endedAt += dt;
      if (app.endedAt > (app.director ? 3 : 1.6)) { if (app.director) directorNext(); else showResult(); }
    }
  }
  const focus = v.update(dt, acc / DT);
  const P = g.player;
  // camera
  if (g.kind === 'escape' && (g.phase === 'ending' || g.phase === 'done')) {
    const door = stage.layout.escape.finish.door;
    const atDoor = g.ending.stage !== 'walk' || Math.hypot(P.x - door.x, P.z - door.z) < 3.2;
    if (atDoor) {
      // a side view from the side away from the sign, so nothing stands between the camera and the knock
      const fin = stage.layout.escape.finish, side = fin.signAt && fin.signAt.x > door.x ? -1 : 1;
      cam.setShot({ from: { x: door.x + side * 3.6, y: 1.25, z: door.z - 2.2 }, at: { x: P.x + side * 0.15, y: 0.75, z: P.z + 0.25 }, rate: 2.2 });
    }
    else if (g.ending.path.i >= 1) {
      // on the path through the spruce: a high shot from behind and above (over the tree tops), so the camera
      // never sits inside the trees and the kinked way through reads from above
      cam.setShot({ from: { x: P.x, y: 11.5, z: P.z - 4.5 }, at: { x: P.x, y: 0.4, z: P.z + 1.2 }, rate: 1.8 });
    }
    else { cam.setShot(null); cam.yaw = 0; cam.pitch = 0.3; cam.lookIdle = 0; }
  } else if (app.director) directorCam(dt, g);
  cam.update(dt, focus, P.heading, P.speed);
  // world + sound
  stage.update(dt, focus);
  stage.render();
  soundFrame(dt, g, focus);
  tickEndingCard(dt);
  if (app.screen === 'play' || app.screen === 'pause') hud.update(g, dt, cam.yaw);
  if (g.kind === 'escape' && g.phase === 'play' && !app.director) escapeTips(g);
  if (DEBUG) hud.dev(`${fps} fps  q=${stage.quality}\n${g.kind} ${g.phase} t=${g.t.toFixed(1)} seed=${app.seed}\nP ${P.x.toFixed(1)}, ${P.z.toFixed(1)} sp ${P.speed.toFixed(1)}\nT ${g.turkey.state || ''} ${g.turkey.anim} ${g.turkey.x.toFixed(1)}, ${g.turkey.z.toFixed(1)}` + (g.hits != null ? `\nhits ${g.hits} lanes ${g.cleared} x${g.speedUp().toFixed(2)}` : ''));
}

// two short lessons, once per session, right where they are needed
function escapeTips(g) {
  const P = g.player, lanes = stage.layout.escape.lanes;
  const creek = lanes.find((l) => l.kind === 'creek'), road = lanes.find((l) => l.kind === 'road');
  if (creek && P.z > creek.z0 - 5 && P.z < creek.z0 && !sessionFlag('tip-creek')) hud.toast('Hop log to log with Flap', 2.4);
  if (road && P.z > road.z0 - 4 && P.z < road.z0 && !sessionFlag('tip-road')) hud.toast('Wait for a gap, then run!', 2.2);
  const hw = lanes.find((l) => l.id === 'highway');
  if (hw && P.z > hw.z0 - 4 && P.z < hw.z0 && !sessionFlag('tip-highway')) hud.toast('Three lanes. You can wait between them', 2.4);
}

function titleFrame(dt) {
  titleT += dt;
  // the farm at dusk from the south-east: farmhouse, barn and windmill against the sky, the yard lamp between them.
  // The menu card covers the lower part of a phone, so the camera looks down until the skyline sits in the top quarter;
  // in landscape the card sits in the middle and the camera looks more level. It drifts slowly, never stops.
  const ca = stage.camera, portrait = ca.aspect < 1;
  const w = titleT * 0.045, s = Math.sin(w), s2 = Math.sin(w * 0.61 + 1.3);
  const ex = 46 + s * 7, ey = 8.6 + s2 * 0.8, ez = -17 - s * 4.5;
  const tx = -9 + s * 4, tz = -44;
  const hd = Math.hypot(tx - ex, tz - ez), pitch = (portrait ? 0.36 : 0.29) + s2 * 0.012;
  ca.position.set(ex, ey, ez);
  ca.lookAt(tx, ey - hd * Math.tan(pitch), tz);
  const a = stage.layout.arena, cx = (a.minX + a.maxX) / 2 - 4, cz = (a.minZ + a.maxZ) / 2 + 6;      // sound and the hero light stay in the yard
  if (cast) {
    const t = cast.turkey;
    const anim = (titleT % 9) < 1.2 ? 'gobble' : 'idle';
    t.rig.update(dt, anim, titleT % 9, 0, null);
  }
  stage.update(dt, { x: cx, z: cz });
  stage.render();
  audio.update(dt, cx, cz, 0, 0);
}

function soundFrame(dt, g, focus) {
  const P = g.player;
  // creek nearness for the water loop
  let water = 0;
  if (g.kind === 'escape') { const c = creekLane || (creekLane = stage.layout.escape.lanes.find((l) => l.kind === 'creek')); if (c) { const d = P.z < c.z0 ? c.z0 - P.z : P.z > c.z1 ? P.z - c.z1 : 0; water = Math.max(0, 1 - d / 14); } }
  audio.update(dt, focus.x, focus.z, cam.yaw, water);
  if (app.screen !== 'play' || app.paused) return;
  // footsteps
  const stride = g.kind === 'escape' ? 0.42 : 0.78;
  if ((P.y || 0) <= 0) {
    stepDist += P.speed * dt;
    if (stepDist > stride) { stepDist = 0; const s = g.kind === 'escape' && P.onLog ? 'wood' : world.surfaceAt(P.x, P.z); audio.step(s, P.x, P.z, g.kind === 'escape' ? 0.6 : P.running ? 1.2 : 0.9); }
  }
  // the heartbeat: on the HUD in Find, in your ears when it is close in Hunted
  let bpm = 0, vol = 0;
  if (g.kind === 'find' && g.phase === 'play') { bpm = g.hud.bpm; vol = 0.35 + 0.65 * (bpm - 62) / 110; }
  else if (g.kind === 'hunted' && g.phase === 'play') { const d = Math.hypot(g.turkey.x - P.x, g.turkey.z - P.z); if (d < 12) { bpm = 90 + (12 - d) * 8; vol = 0.3 + (12 - d) / 18; } }
  if (bpm > 0) { beatT += dt; if (beatT >= 60 / bpm) { beatT = 0; audio.heartbeat(vol); if (g.kind === 'find') hud.beat(); } }
  // vehicles passing you
  if (g.vehicles) {
    if (passSign.length !== g.vehicles.length) passSign = new Int8Array(g.vehicles.length);
    for (let i = 0; i < g.vehicles.length; i++) {
      const v = g.vehicles[i];
      if (v.kind === 'log') continue;
      const s = v.x > focus.x ? 1 : -1;
      if (passSign[i] !== 0 && s !== passSign[i] && Math.abs(v.z - focus.z) < 16) audio.pass(v.x, v.z, v.kind, v.sub.speed * g.speedUp());
      passSign[i] = s;
    }
  }
}

// ------------------------------------------------------------------------------------------ director: it plays itself
const SHOTS = ['follow', 'low', 'wide', 'follow', 'side'];
function directorCam(dt, g) {
  app.shotT += dt;
  if (app.shotT > 6) { app.shotT = 0; app.shot = (app.shot + 1) % SHOTS.length; }
  const P = g.player, T = g.turkey, s = SHOTS[app.shot];
  if (s === 'follow') { cam.setShot(null); cam.lookIdle = 9; return; }
  const mx = (P.x + T.x) / 2, mz = (P.z + T.z) / 2;
  if (s === 'low') cam.setShot({ from: { x: mx + Math.sin(app.shotT * 0.2) * 6, y: 0.5, z: mz + 5 }, at: { x: mx, y: 0.9, z: mz }, rate: 2 });
  if (s === 'wide') cam.setShot({ from: { x: mx - 14, y: 9, z: mz - 12 }, at: { x: mx, y: 0.5, z: mz }, rate: 1.5 });
  if (s === 'side') cam.setShot({ from: { x: P.x + 7, y: 2.2, z: P.z + 1 }, at: { x: P.x, y: 1, z: P.z }, rate: 2 });
}
function directorNext() {
  app.resultShown = true;
  const order = STORY, i = order.indexOf(app.kind);
  const nextKind = order[(i + 1) % order.length];
  const carry = app.kind === 'find' && app.game.carryOut ? app.game.carryOut() : undefined;
  start(nextKind, { keepRun: true, carry });
}

window.__tt = { app, audio, pilot: null, get titleT() { return titleT; }, set titleT(v) { titleT = v; }, get stage() { return stage; }, get cast() { return cast; }, get cam() { return cam; } };
boot();
