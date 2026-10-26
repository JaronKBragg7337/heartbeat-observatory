// The five ways to use the same event history: Explore, Game, Film, Music, Show.
// Nothing here has its own data: each mode reads the one history (ctx.hist) and nothing else. That is the point.
import { midi } from './audio.js';

export function initModes(ctx) {
  const { THREE, camera, controls, hist, sim, view, state, $, B, DOORS, DX, L } = ctx;
  const panel = $('modepanel'), body = document.body;
  const api = { mode: 'explore' };
  let rngS = 11; const rand = () => ((rngS = (rngS * 1664525 + 1013904223) >>> 0) / 4294967296);
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const doorName = (id) => (hist.entities.get(id) || { label: id }).label;
  const lastEvent = (t) => { const a = hist.eventsBetween(Math.max(0, t - 8), t, { limit: 200 }).filter((e) => e.e !== 'sounded' && e.e !== 'planted'); return a[a.length - 1]; };

  // ============================================================ EXPLORE
  function explore() {
    panel.innerHTML = `<details class="card help" id="help" style="margin-bottom:6px"><summary>Help</summary>Tap the man, a footprint, a door, the bed, a lamp. Teal = made (the man's steps are scripted: made). Lilac = patched from real pixels. Tap the middle door to unlock it.<div class="dim" style="margin-top:4px">Interactive reconstruction. Base by Claude Sonnet 5.5; room + person made by Grok Imagine, rebuilt by Heartbeat Observatory tools.</div></details>
      <div class="btns"><button id="bSound" type="button">Sound: off</button><button id="bFollow" type="button">Follow him</button><button id="bTrail" class="on" type="button">Path</button><button id="bView" type="button">Overview</button></div>`;
    const bs = $('bSound'); bs.textContent = state.sound ? 'Sound: on' : 'Sound: off'; bs.classList.toggle('on', state.sound);
    bs.onclick = async () => { if (state.sound) { ctx.soundOff(); bs.textContent = 'Sound: off'; bs.classList.remove('on'); } else { const ok = await ctx.soundOn(); bs.textContent = ok ? 'Sound: on' : 'No audio'; bs.classList.toggle('on', ok); if (ok) { ctx.playSnd({ k: 'tick' }); ctx.say('Sound on: steps, doors, room tone'); } } };
    $('bFollow').classList.toggle('on', state.follow); $('bFollow').onclick = (e) => { state.follow = !state.follow; e.target.classList.toggle('on', state.follow); };
    $('bTrail').classList.toggle('on', state.trail); $('bTrail').onclick = (e) => { state.trail = !state.trail; e.target.classList.toggle('on', state.trail); };
    const bv = $('bView'); bv.textContent = ctx.viewName === 'inside' ? 'Overview' : 'Step inside';
    bv.onclick = () => { state.follow = false; ctx.setView(ctx.viewName === 'inside' ? 'overview' : 'inside'); bv.textContent = ctx.viewName === 'inside' ? 'Overview' : 'Step inside'; };
  }

  // ============================================================ GAME: "Witness" (the man's statements, checked against the history)
  const G = { round: 0, score: 0, cur: null, startedAt: 0, answered: false, order: [], quest: null, questDone: false };
  function distIn(t0, t1) { let d = 0, prev = null; for (const s of hist.samples) { if (s[0] < t0) continue; if (s[0] > t1) break; if (prev) d += Math.hypot(s[1] - prev[1], s[2] - prev[2]); prev = s; } return d; }
  function makeStatement(kind) {
    const T = sim.t, w0 = Math.max(0, T - 20), steps = hist.eventsBetween(w0, T, { e: 'planted', limit: 400 }), truth = rand() < 0.5;
    const jig = (n, lo = 2, hi = 4) => Math.max(0, n + (rand() < 0.5 ? -1 : 1) * (lo + Math.floor(rand() * (hi - lo + 1))));
    const sec = (T - w0).toFixed(0);
    switch (kind) {
      case 'steps': { const n = steps.length, shown = truth ? n : jig(n); return { text: `"I took ${shown} steps in the last ${sec} seconds."`, truth: shown === n, t: w0, why: `History says ${n} steps (${steps.length ? steps[0].id + ' to ' + steps[steps.length - 1].id : 'none'}).` }; }
      case 'made': { const n = steps.filter((e) => e.place !== 'seen-floor').length, shown = truth ? n : jig(n, 1, 3); return { text: `"${shown} of my steps were on floor we patched together, not floor you saw."`, truth: shown === n, t: w0, why: `${n} step${n === 1 ? ' has' : 's have'} place patched-floor / patched-room; the rest are on seen floor.` }; }
      case 'door': { const locked = sim.unlockT == null; const claim = truth ? locked : !locked; return { text: `"The middle door is still locked."`, truth: locked, t: sim.unlockT != null ? sim.unlockT - 1 : Math.max(0, T - 10), why: locked ? 'D-0002 has no unlocked event.' : `D-0002 was unlocked at ${sim.unlockT.toFixed(1)} s (E-id in the sheet).`, ask: claim }; }
      case 'last': { const e = steps[steps.length - 1]; if (!e) return null; const foot = /left/.test(e.note) ? 'left' : 'right', shown = truth ? foot : (foot === 'left' ? 'right' : 'left'); return { text: `"My last step was with my ${shown} foot."`, truth: shown === foot, t: e.t - 0.5, why: `${e.id}: ${e.note}.` }; }
      case 'pass': { const n = hist.eventsBetween(w0, T, { e: 'walked_past' }).length, shown = truth ? n : jig(n, 1, 2); return { text: `"I walked past a door ${shown} time${shown === 1 ? '' : 's'} in the last ${sec} seconds."`, truth: shown === n, t: w0, why: `${n} walked_past events in that window.` }; }
      case 'far': { const d = distIn(w0, T), r = Math.round(d * 2) / 2, shown = truth ? r : r + (rand() < 0.5 ? -1 : 1) * (1.5 + Math.floor(rand() * 2)); return { text: `"I walked about ${Math.max(0, shown).toFixed(1)} metres in the last ${sec} seconds."`, truth: Math.abs(Math.max(0, shown) - d) <= 0.8, t: w0, why: `His track adds up to ${d.toFixed(1)} m.` }; }
    }
  }
  // Fable: quest 1 = the faded door. Unknown is locked; the one door the story allows opens onto a made room, and he walks in.
  function quest() {
    G.quest = { t0: sim.t, steps0: hist.eventsBetween(0, sim.t, { e: 'planted', limit: 4000 }).length, stage: 0 };
    panel.innerHTML = `<div class="card"><div style="color:var(--dim);font-size:11px">QUEST 1 · THE FADED DOOR</div><div class="big" style="margin:4px 0 6px">Three doors. Nothing was ever filmed behind any of them. One can be opened: find it, tap it. He will hear the latch.</div>
      <div class="btns"><button id="qSkip" type="button">Skip to Witness</button></div></div>`;
    $('qSkip').onclick = () => { G.quest = null; G.questDone = true; witness(); };
  }
  function questUpdate() {
    const q = G.quest; if (!q) return;
    if (q.stage === 0 && sim.unlockT != null) { q.stage = 1; panel.innerHTML = `<div class="card"><div style="color:var(--dim);font-size:11px">QUEST 1 · THE FADED DOOR</div><div class="big" style="margin:4px 0 6px">The latch clicks. What opens is MADE, never seen. He is on his way in.</div></div>`; }
    if (q.stage === 1) { const ent = hist.eventsBetween(sim.unlockT, sim.t, { e: 'entered', limit: 5 })[0]; if (ent) { q.stage = 2; const steps = hist.eventsBetween(0, sim.t, { e: 'planted', limit: 4000 }).length - q.steps0, secs = +(sim.t - q.t0).toFixed(1);
      ctx.emit({ t: sim.t, id: 'P-0001', e: 'quest_done', target: 'D-0002', parent: 'P-0001', cause: ent.eid, origin: 'script', basis: 'made', note: `Quest 1 done in ${secs} s and ${steps} steps: he stands in a room nobody filmed, labelled made. Two doors stay locked until new footage arrives.` });
      ctx.playSnd({ k: 'win' }); G.questDone = true;
      panel.innerHTML = `<div class="card"><div class="big">Quest done: ${secs} s, ${steps} steps.</div><div style="margin:4px 0 8px">He stands in a room nobody filmed, and the page says so. Two doors stay locked until new footage arrives. Now the room tests you.</div><div class="btns"><button id="qNext" type="button">Play Witness</button></div></div>`;
      $('qNext').onclick = () => { G.quest = null; witness(); }; } }
  }
  function game() { if (!G.questDone && sim.unlockT == null) return quest(); G.quest = null; witness(); }
  function witness() {
    if (G.round === 0 || G.round > 4) { G.round = 0; G.score = 0; G.order = ['steps', 'door', 'made', 'last', 'pass', 'far'].sort(() => rand() - 0.5).slice(0, 4); if (sim.unlockT == null) G.order[1] = G.order[1] === 'door' ? 'door' : G.order[1]; }
    nextRound(true);
  }
  function nextRound(first) {
    if (!first) G.round++; else if (G.round === 0) G.round = 1;
    if (G.round > 4) { const rank = G.score >= 400 ? 'Sharp. Nobody lies to this room.' : G.score >= 200 ? 'Good eye. The history never forgets.' : 'The history remembers more than you do. Try again.'; panel.innerHTML = `<div class="card"><div class="big">Case closed: ${G.score} points</div><div style="margin:4px 0 8px">${rank} Every answer was checked against E-ids, not opinion.</div><div class="btns"><button id="gAgain" type="button">Play again</button></div></div>`; $('gAgain').onclick = () => { G.round = 0; witness(); }; ctx.playSnd({ k: 'win' }); return; }
    let st = null, tries = 0; while (!st && tries++ < 8) st = makeStatement(G.order[(G.round - 1 + tries - 1) % G.order.length]);
    G.cur = st; G.answered = false; G.startedAt = performance.now();
    panel.innerHTML = `<div class="card"><div style="display:flex;justify-content:space-between;color:var(--dim);font-size:11px"><span>WITNESS · round ${G.round}/4</span><span>${G.score} pts</span></div>
      <div class="big" style="margin:4px 0 6px"><span style="color:var(--dim);font-size:11px">THE MAN SAYS</span><br>${esc(st.text)}</div>
      <div class="btns"><button id="gT" type="button">TRUE</button><button id="gF" type="button">LIE</button><button id="gH" type="button" style="flex:0 0 auto">Check history</button></div></div>`;
    $('gT').onclick = () => answer(true); $('gF').onclick = () => answer(false);
    $('gH').onclick = () => { ctx.seek(st.t, true); ctx.say('Replaying the evidence window. Then decide.'); };
  }
  function answer(sayTrue) {
    if (G.answered) return; G.answered = true; const st = G.cur, ok = sayTrue === st.truth, dtS = (performance.now() - G.startedAt) / 1000;
    const pts = ok ? 100 + (dtS < 8 ? 50 : 0) : 0; G.score += pts;
    ctx.emit({ t: sim.t, id: 'C-0001', e: 'answered', basis: 'seen', note: `${ok ? 'right' : 'wrong'}: ${st.text}` });
    ctx.playSnd({ k: ok ? 'win' : 'lose' });
    panel.innerHTML = `<div class="card"><div class="big" style="color:${ok ? '#8fd18b' : '#f0b36b'}">${ok ? 'Right' : 'Wrong'}: it was ${st.truth ? 'TRUE' : 'a LIE'}${ok && pts > 100 ? ' (+50 fast)' : ''}</div><div style="margin:4px 0 8px">${esc(st.why)} <span style="color:var(--dim)">Replaying the moment.</span></div><div class="btns"><button id="gN" type="button">${G.round >= 4 ? 'See result' : 'Next statement'}</button></div></div>`;
    ctx.seek(st.t, true); $('gN').onclick = () => { ctx.goLive(); nextRound(false); };
  }

  // ============================================================ FILM: the shot list is written from the event history
  const F = { on: false, t0: 0, lastShot: -1 };
  const fwd = (yaw) => [Math.sin(yaw), Math.cos(yaw)], rgt = (yaw) => [-Math.cos(yaw), Math.sin(yaw)];
  const SHOTS = [
    { name: 'ESTABLISH', dur: 5.5, why: 'Whole room, closed. Wide orbit from the unseen corner.', cam(u, m) { const a = 0.85 + u * 0.7, r = 6.4; return { p: [-0.4 + Math.cos(a) * r, 4.4 - u * 0.5, -1.0 + Math.sin(a) * r], l: [-0.4, 0.6, -1.0], fov: 52 }; } },
    { name: 'TRACK', dur: 5, why: 'Follow shot from behind his right shoulder.', cam(u, m) { const f = fwd(m.yaw), r = rgt(m.yaw); return { p: [m.x - f[0] * 2.7 + r[0] * 0.35, 1.75, m.z - f[1] * 2.7 + r[1] * 0.35], l: [m.x + f[0] * 0.6, 1.05, m.z + f[1] * 0.6], fov: 48 }; } },
    { name: 'FEET', dur: 3.5, why: 'Low angle on the footsteps: every contact is an event.', cam(u, m) { const f = fwd(m.yaw), r = rgt(m.yaw); return { p: [m.x + f[0] * (2.4 - u * 0.5) + r[0] * 0.1, 0.32, m.z + f[1] * (2.4 - u * 0.5) + r[1] * 0.1], l: [m.x, 0.42, m.z], fov: 40 }; } },
    { name: 'POV', dur: 4, why: 'His view: head height, walk bob from the real gait phase.', cam(u, m) { const f = fwd(m.yaw), bob = 0.018 * Math.sin(m.cyc * Math.PI * 4); return { p: [m.x + f[0] * 0.14, 1.62 + bob, m.z + f[1] * 0.14], l: [m.x + f[0] * 3, 1.5 + bob, m.z + f[1] * 3], fov: 78 }; } },
    { name: 'DOOR', dur: 4.5, why: 'Lane shot toward the middle door, slow push.', cam(u, m) { return { p: [L + 0.35, 1.35, 1.45 - u * 0.8], l: [DX, 1.15, DOORS[1].z], fov: 46 }; } },
    { name: () => (ctx.sceneRefs.madeRoomG.visible ? 'REVEAL' : 'WINDOW'), dur: 4.5, why: 'If the door is open: from inside the made room, back at the doorway. Else: the window wall.', cam(u, m) { if (ctx.sceneRefs.madeRoomG.visible) return { p: [-3.9, 1.5, -0.35 + u * 0.25], l: [DX + 0.2, 1.2, DOORS[1].z], fov: 56 }; return { p: [0.2, 1.5, -0.9 + u * 0.4], l: [0.9, 1.3, -3.5], fov: 54 }; } },
    { name: 'TOP', dur: 4, why: 'Top-down: the whole path is a line on the floor.', cam(u, m) { const a = u * 1.2; return { p: [-0.2 + Math.sin(a) * 0.7, 8.6, -0.9 + Math.cos(a) * 0.7], l: [-0.2, 0, -0.9], fov: 58 }; } },
  ];
  const TOTAL = SHOTS.reduce((s, x) => s + x.dur, 0);
  const shotName = (s) => (typeof s.name === 'function' ? s.name() : s.name);
  function film() {
    panel.innerHTML = `<div class="card" style="margin-bottom:6px"><b>Roll camera.</b> Every shot is chosen from the event history, so the same take can be re-shot from any moment: scrub the timeline and it films the replay.</div>
      <div class="btns"><button id="fRoll" class="on" type="button">Cut: rolling</button><button id="fJson" type="button">Shot list JSON</button><button id="fClean" type="button">Hide controls</button></div>`;
    F.on = true; F.t0 = view.t; F.lastShot = -1; controls.enabled = false; body.classList.add('film');
    $('fRoll').onclick = (e) => { F.on = !F.on; controls.enabled = !F.on; body.classList.toggle('film', F.on); e.target.classList.toggle('on', F.on); e.target.textContent = F.on ? 'Cut: rolling' : 'Cut: off (orbit freely)'; if (!F.on) { $('slate').style.display = 'none'; $('title').style.display = 'none'; } else F.t0 = view.t; };
    $('fClean').onclick = (e) => { const c = body.classList.toggle('clean'); e.target.textContent = c ? 'Show controls' : 'Hide controls'; };
    $('fJson').onclick = () => ctx.openJSON(JSON.stringify(shotList(), null, 1), 'shots.json');
  }
  function shotList() { let t = 0; return { format: 'hb-shots/1', note: 'Written from the event history by Claude Sonnet 5.5. Camera is a function of (shot, local time, man pose from the track).', based_on_events: hist.events.length, shots: SHOTS.map((s, i) => { const o = { sh: i + 1, name: shotName(s), start: t, dur: s.dur, why: s.why }; t += s.dur; return o; }) }; }
  function filmUpdate() {
    const ft = Math.max(0, view.t - F.t0), tc = ft % TOTAL; let acc = 0, idx = 0; for (; idx < SHOTS.length; idx++) { if (tc < acc + SHOTS[idx].dur) break; acc += SHOTS[idx].dur; } idx = Math.min(idx, SHOTS.length - 1);
    const sh = SHOTS[idx], u = (tc - acc) / sh.dur, tr = hist.trackAt(view.t); const m = { x: tr[1], z: tr[2], yaw: tr[3], cyc: tr[4] };
    const c = sh.cam(u, m), pf = window.innerWidth < window.innerHeight ? 1.22 : 1; camera.position.set(...c.p); camera.lookAt(new THREE.Vector3(...c.l)); const fv = Math.min(95, c.fov * pf); if (Math.abs(camera.fov - fv) > 0.01) { camera.fov = fv; camera.updateProjectionMatrix(); }
    const cutAge = tc - acc; $('flash').style.opacity = String(Math.max(0, 0.55 * (1 - cutAge / 0.22)) * (ft > 0.3 ? 1 : 0));
    const le = lastEvent(view.t); $('slate').style.display = 'block'; $('slate').style.top = `calc(11vh + 6px)`; $('slate').style.right = '14px'; $('slate').style.left = 'auto'; $('slate').style.textAlign = 'right'; $('slate').innerHTML = `SC 1 · SH ${idx + 1} · ${shotName(sh)}<br>${le ? le.eid + ' ' + le.e : ''}`;
    const ti = $('title'); if (ft < 2.8) { ti.style.display = 'block'; ti.style.opacity = String(Math.min(1, (2.8 - ft) / 0.8)); } else ti.style.display = 'none';
    $('subtitle').style.bottom = '16vh';
  }

  // ============================================================ MUSIC: his steps are the drum machine
  const M = { on: false, lastKick: -9, lines: ['STEP', 'STEP', 'THE FLOOR', 'REMEMBERS', 'WHAT WE SAW', 'IS SOLID', 'WHAT WE MADE', 'IS MARKED', 'NO STEPS', 'NO BEAT'], li: 0, step: 0, key: 0 };
  const SCALE = [45, 48, 50, 52, 55, 57, 60, 62];
  function music() {
    panel.innerHTML = `<div class="card" style="margin-bottom:6px"><b>Music video: "Heavy Steps".</b> Left foot = kick + bass, right foot = clap. Hats ride between steps. His z-position picks the bass note. Doors play bells and chords. He stops, the beat stops.</div>
      <div class="btns"><button id="bSound" type="button">Sound: off</button><button id="mKit" class="on" type="button">Beat: on</button></div>`;
    const bs = $('bSound'); bs.textContent = state.sound ? 'Sound: on' : 'Tap for sound'; bs.classList.toggle('on', state.sound);
    bs.onclick = async () => { if (state.sound) { ctx.soundOff(); bs.textContent = 'Tap for sound'; bs.classList.remove('on'); } else { const ok = await ctx.soundOn(); bs.textContent = ok ? 'Sound: on' : 'No audio'; bs.classList.toggle('on', ok); } };
    $('mKit').onclick = (e) => { M.on = !M.on; sim.music = M.on; e.target.classList.toggle('on', M.on); e.target.textContent = 'Beat: ' + (M.on ? 'on' : 'off'); };
    M.on = true; sim.music = true; body.classList.add('music'); controls.autoRotate = true; controls.autoRotateSpeed = 1.1;
  }
  function onEventMusic(ev) {
    if (!M.on || !sim.music) return;
    if (ev.e === 'planted') {
      const si = sim.stepInfo || {}, left = si.foot === 'L', t = ev.t, gap = Math.min(0.9, Math.max(0.3, si.gap || 0.55));
      const note = SCALE[Math.max(0, Math.min(7, Math.round(((si.z != null ? si.z : sim.z) - B.z0) / (B.z1 - B.z0) * 7)))] + (ev.place === 'patched-room' ? 3 : 0);
      if (left) { ctx.sound(t, ev.id, ev.id, { k: 'kick', g: 1 }, null, ev); ctx.sound(t, ev.id, ev.id, { k: 'bass', n: note - 12, dur: gap * 0.9, g: 0.9 }, null, ev); M.lastKick = t; }
      else ctx.sound(t, ev.id, ev.id, { k: 'clap', g: 1, pan: 0.1 }, null, ev);
      sim.sched.push({ at: t + gap * 0.5, fn: (at) => ctx.sound(at, ev.id, ev.id, { k: 'hat', g: 0.9, pan: left ? -0.3 : 0.3 }, null, ev) });
      if (si.n % 8 === 0) sim.sched.push({ at: t + gap * 0.25, fn: (at) => ctx.sound(at, ev.id, ev.id, { k: 'bell', n: note + 12, g: 0.8 }, null, ev) });
      M.li = si.n; $('lyric').textContent = M.lines[Math.floor((si.n - 1) / 2) % M.lines.length]; $('lyric').style.color = ev.place === 'seen-floor' ? '#fff' : '#9ff3e6';
    } else if (ev.e === 'walked_past') { ctx.sound(ev.t, ev.target, ev.id, { k: 'bell', n: 76, g: 0.8, pan: -0.5 }, null, ev); }
    else if (ev.e === 'unlocked') { ctx.sound(ev.t, ev.id, ev.id, { k: 'riser', dur: 1.4, g: 1 }, null, ev); ctx.sound(ev.t, ev.id, ev.id, { k: 'pad', ns: [57, 60, 64, 67], dur: 3.2 }, null, ev); }
    else if (ev.e === 'entered') ctx.sound(ev.t, ev.id, ev.id, { k: 'pad', ns: [60, 64, 67, 71, 74], dur: 3.5 }, null, ev);
  }
  function musicUpdate() {
    let age = 9; for (let i = ctx.sndList.length - 1; i >= 0; i--) { const e = ctx.sndList[i]; if (e.t > view.t) continue; if (e.snd.k === 'kick') { age = view.t - e.t; break; } if (view.t - e.t > 1) break; }
    const p = Math.max(0, 1 - age / 0.32); $('pulse').style.opacity = String(p * 0.9); const base = window.innerWidth < window.innerHeight ? 62 : 46; const f = base - 2.2 * p; if (Math.abs(camera.fov - f) > 0.02) { camera.fov = f; camera.updateProjectionMatrix(); }
    const st = $('lyric'); st.style.top = '27%'; st.style.transform = `scale(${1 + p * 0.1})`;
    controls.update();
  }

  // ============================================================ SHOW: a script written from the events, plus a continuity check
  const S = { lines: [], upto: 0, lastT: 0, slug: 'INT. BEDROOM - NIGHT', cap: '', capT: -9, voice: false };
  const canSpeak = () => !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
  function speak(s, cancel = true) { if (!S.voice || !canSpeak()) return; try { const u = new SpeechSynthesisUtterance(s); u.rate = 0.95; u.pitch = 0.9; if (cancel) speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {} }
  function narration() {   // the room tells its own history, every number from the record
    const T = sim.t, steps = hist.eventsBetween(0, T, { e: 'planted', limit: 4000 }), un = hist.eventsBetween(0, T, { e: 'unlocked', limit: 2 })[0], tried = hist.eventsBetween(0, T, { e: 'tried_door', limit: 50 }).length, d = distIn(0, T);
    const L = [`This is a bedroom nobody has ever stood in. Two frames anchor its room mesh; other frames of the same video supply the patches. Everything else is patched from those pixels or invented, and marked.`,
      `A made man has walked it for ${T.toFixed(0)} seconds: ${steps.length} steps, ${d.toFixed(1)} metres, every one on record.`];
    if (steps.length) { const e = steps[Math.floor(steps.length / 2)]; L.push(`Step ${e.id} landed at ${e.t.toFixed(1)} seconds, ${/left/.test(e.note) ? 'left' : 'right'} foot. Tap it and it tells you this itself.`); }
    L.push(un ? `At ${un.t.toFixed(1)} seconds the middle door was unlocked. The study behind it was never filmed: patched surfaces, made furniture.` : (tried ? `He tried the middle door ${tried} time${tried === 1 ? '' : 's'}. Locked. Not seen yet.` : `Three doors stay faded. Nothing behind them was filmed, so nothing is shown.`));
    L.push('These events came from this session. Download them with H B dot download. The bundled history dot json is a separate example run.'); return L;
  }
  function show() {
    panel.innerHTML = `<div class="card"><div style="display:flex;justify-content:space-between;color:var(--dim);font-size:10.5px"><span>"THE ROOM REMEMBERS" · EP 0 · SC 1</span><button id="sTake" type="button" style="min-height:22px;font-size:10.5px;border-radius:999px;padding:0 8px">Take 2</button></div>
      <div class="script" id="script"></div><div id="cont" style="font-size:11px;margin-top:4px"></div></div>`;
    $('sTake').onclick = () => { S.lines = []; S.upto = 0; ctx.seek(0, true); ctx.say('Take 2: same scene, replayed from the history'); };
    const bar = document.createElement('div'); bar.className = 'btns'; bar.style.marginTop = '6px';
    bar.innerHTML = `<button id="sVoice" type="button" ${canSpeak() ? '' : 'disabled'}>${canSpeak() ? 'Voice: off' : 'No voice here'}</button><button id="sNarr" type="button">Narrate the history</button>`; panel.firstElementChild.appendChild(bar);
    $('sVoice').onclick = (e) => { S.voice = !S.voice; e.target.classList.toggle('on', S.voice); e.target.textContent = S.voice ? 'Voice: on' : 'Voice: off'; if (!S.voice && canSpeak()) speechSynthesis.cancel(); else if (S.cap) speak(S.cap); };
    $('sNarr').onclick = () => { const L = narration(); S.narr = { L, i: 0, t: view.t }; if (!S.voice && canSpeak()) { S.voice = true; const b = $('sVoice'); if (b) { b.classList.add('on'); b.textContent = 'Voice: on'; } } L.forEach((s, i) => speak(s, i === 0)); ctx.emit({ t: sim.t, id: 'C-0001', e: 'narrated', basis: 'made', note: L.join(' ') }); };
  }
  function lineFor(ev) {
    const nm = (id) => doorName(id);
    switch (ev.e) {
      case 'walked_past': return { k: 'a', s: `He passes ${nm(ev.target)}.` };
      case 'tried_door': return { k: 'a', s: `He tries ${nm(ev.target)}. LOCKED.` };
      case 'paused': return ev.note ? { k: 'a', s: ev.note } : null;
      case 'tapped': return ev.target && ev.target.startsWith('D-') ? { k: 'a', s: `SOMEONE (you) taps ${nm(ev.target)}.` } : null;
      case 'unlocked': return { k: 'a', s: 'A latch clicks. Nothing behind this door was ever filmed.' };
      case 'opened': return { k: 'a', s: 'The door swings open on a room that was never filmed.' };
      case 'entered': return [{ k: 's', s: 'INT. STUDY (PATCHED + MADE) - CONTINUOUS' }, { k: 'a', s: 'Unfilmed study: patched surfaces, made furniture.' }];
      case 'left': return [{ k: 's', s: 'INT. BEDROOM - NIGHT' }, { k: 'a', s: 'He comes back out.' }];
      default: return null;
    }
  }
  function scriptUpdate(force) {
    if (view.t < S.lastT - 0.01) { S.lines = []; S.upto = 0; }
    S.lastT = view.t;
    if (!S.lines.length) S.lines.push({ k: 's', s: 'INT. BEDROOM - NIGHT', t: 0, eid: 'E-00000' }, { k: 'a', s: 'THE MAN (AI-generated, not real) walks the lane past three locked doors.', t: 0, eid: 'E-00000' });
    const evs = hist.events; let i = S.upto;
    while (i < evs.length && evs[i].t <= view.t) { const ev = evs[i++]; if (ev.id === 'M-0005' || ev.e === 'planted' || ev.e === 'sounded' || ev.e === 'seen' || ev.e === 'answered') continue; const l = lineFor(ev); if (!l) continue; for (const x of [].concat(l)) { S.lines.push(Object.assign({ t: ev.t, eid: ev.eid }, x)); if (x.k === 'a') { S.cap = x.s; S.capT = ev.t; } } }
    S.upto = i;
    if (S.narr) { const per = 6.5, k = Math.min(S.narr.L.length - 1, Math.floor((view.t - S.narr.t) / per)); if (k !== S.narr.i || !S.narr.shown) { S.narr.i = k; S.narr.shown = true; S.cap = S.narr.L[k]; S.capT = view.t; } if (view.t - S.narr.t > per * S.narr.L.length) S.narr = null; }
    else if (S.capT === S.lastSpokenT) {} else if (S.cap && S.capT !== S.lastSpokenT && view.t - S.capT < 0.5) { S.lastSpokenT = S.capT; speak(S.cap); }
    const el = $('script'); if (!el) return;
    const show = S.lines.slice(-6); el.innerHTML = show.map((l) => l.k === 's' ? `<div class="sl ln" data-t="${l.t}">${esc(l.s)}</div>` : `<div class="ac ln" data-t="${l.t}">${esc(l.s)} <span class="dim">${l.eid}</span></div>`).join('');
    el.querySelectorAll('.ln').forEach((d) => d.onclick = () => ctx.seek(parseFloat(d.dataset.t) - 0.5, true));
    $('subtitle').style.bottom = 'calc(' + ($('bottom').offsetHeight + 8) + 'px)'; $('subtitle').textContent = view.t - S.capT < 4.5 ? S.cap : '';
    if (force || Math.floor(view.t * 2) !== S.lastCheck) { S.lastCheck = Math.floor(view.t * 2); $('cont').innerHTML = continuity(); }
  }
  function continuity() {
    const sm = hist.samples; let maxJ = 0; for (let i = Math.max(1, sm.length - 900); i < sm.length; i++) maxJ = Math.max(maxJ, Math.hypot(sm[i][1] - sm[i - 1][1], sm[i][2] - sm[i - 1][2]));
    const steps = hist.events.filter((e) => e.e === 'planted'); let minGap = 9, inside = true; for (let i = Math.max(1, steps.length - 80); i < steps.length; i++) minGap = Math.min(minGap, steps[i].t - steps[i - 1].t);
    for (const s of sm.slice(-300)) if (s[1] < B.x0 - 3 || s[1] > B.x1 || s[2] < B.z0 || s[2] > B.z1) { if (!(s[1] < B.x0 && s[2] > -2 && s[2] < 0.1)) inside = false; }
    const door = !(sim.openT != null && sim.unlockT == null);
    const madeOk = steps.every((e) => e.basis === 'made' && (e.floor_basis === 'seen' || e.floor_basis === 'patched'));
    const checks = [[maxJ < 0.05, `No teleporting (max ${(maxJ * 30).toFixed(2)} m/s)`], [minGap > 0.2, `Steps spaced (min ${minGap > 8 ? '-' : minGap.toFixed(2)} s)`], [inside, 'He never leaves the closed room'], [door, 'Door opened only after unlocked'], [madeOk, 'Steps: made action, floor basis recorded']];
    const n = checks.filter((c) => c[0]).length;
    return `<span class="${n === 5 ? 'ok' : 'warn'}">Continuity ${n}/5</span> <span style="color:var(--dim)">${checks.map((c) => (c[0] ? '✔ ' : '⚠ ') + c[1]).slice(0, 3).join(' · ')}</span>`;
  }

  // ============================================================ mode switching
  // SEAM: api.register(name, { label, enter(ctx, panel), update(dt), leave(), cameraOwned() }) adds a tab or REPLACES a built-in mode (Fable: narrated show, replay-cut movie, tempo-from-steps).
  const EXT = {};
  api.register = (name, def) => { EXT[name] = def; if (!document.querySelector('#tabs [data-m="' + name + '"]')) { const b = document.createElement('button'); b.type = 'button'; b.dataset.m = name; b.textContent = def.label || name; b.addEventListener('click', () => enter(name)); $('tabs').appendChild(b); } };
  function enter(m) {
    if (EXT[api.mode] && EXT[api.mode].leave) EXT[api.mode].leave();
    // leave
    if (api.mode === 'film') { body.classList.remove('clean'); F.on = false; controls.enabled = true; body.classList.remove('film'); $('slate').style.display = 'none'; $('title').style.display = 'none'; $('flash').style.opacity = '0'; ctx.home(); camera.fov = window.innerWidth < window.innerHeight ? 62 : 46; camera.updateProjectionMatrix(); }
    if (api.mode === 'music') { M.on = false; sim.music = false; body.classList.remove('music'); controls.autoRotate = false; $('pulse').style.opacity = '0'; $('lyric').textContent = ''; camera.fov = window.innerWidth < window.innerHeight ? 62 : 46; camera.updateProjectionMatrix(); }
    if (api.mode === 'show' || m !== 'show') { $('subtitle').textContent = ''; S.narr = null; if (canSpeak()) { try { speechSynthesis.cancel(); } catch (e) {} } }
    api.mode = m; state.mode = m; document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    if (EXT[m]) EXT[m].enter(ctx, panel); else if (m === 'explore') explore(); else if (m === 'game') game(); else if (m === 'film') film(); else if (m === 'music') music(); else if (m === 'show') { show(); scriptUpdate(true); }
  }
  document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => enter(b.dataset.m)));
  ctx.listeners.push(onEventMusic);
  api.update = (dt) => { if (EXT[api.mode]) return EXT[api.mode].update && EXT[api.mode].update(dt); if (api.mode === 'film' && F.on) filmUpdate(); else if (api.mode === 'music') musicUpdate(); else if (api.mode === 'show') scriptUpdate(false); else if (api.mode === 'game') questUpdate(); };
  api.cameraOwned = () => (EXT[api.mode] && EXT[api.mode].cameraOwned ? EXT[api.mode].cameraOwned() : api.mode === 'film' && F.on);
  api.hideTag = () => false;
  api.enter = enter; api.shotList = shotList; api.filmSkip = (s) => { F.t0 -= s; };
  explore();
  return api;
}
