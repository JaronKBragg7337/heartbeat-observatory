// Beat Lab - Heartbeat's own beat engine. Jaron 10/24: no producer needed, no talent needed, nobody's permission.
// A beat is made from music-theory RULES (scales, chord moves, drum patterns per style) + seeded randomness + the
// artist's choices. No trained AI model makes the track: like a drum machine, it's software the person drives.
// Every sound is synthesized here (Web Audio), no samples. Renders offline, so the result is exact on any phone.

const NOTE = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const nn = (m) => NOTE[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];

const SCALE = { dark: [0, 2, 3, 5, 7, 8, 10], bright: [0, 2, 4, 5, 7, 9, 11] };
const PROGS = {                                  // scale degrees, 0 = home chord
  dark: [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 6], [0, 5, 3, 4], [0, 0, 5, 6], [0, 3, 0, 4]],
  bright: [[0, 4, 5, 3], [1, 4, 0, 5], [3, 4, 2, 5], [0, 5, 3, 4], [0, 3, 4, 3], [5, 3, 0, 4]],
};
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const STYLES = {
  trap: { name: "Trap", bpm: [120, 165, 140], swing: 0, bars: [8, 32, 16, 32, 16, 8], sevenths: false,
    kick: ["x......x..x.....", "x.....x...x..x..", "x..x......x.....", "x......x.x......", "x.....x..x....x."],
    snare: ["........x.......", "........x......x"], hat: "x.x.x.x.x.x.x.x.", melRhythm: [[0, 3, 6, 8, 11, 14], [0, 2, 6, 10, 12], [0, 3, 7, 10, 14]],
    bass: "808", keys: "pad", lead: "bell" },
  boombap: { name: "Boom bap", bpm: [80, 100, 90], swing: 0.58, bars: [4, 16, 8, 16, 8, 4], sevenths: true,
    kick: ["x.....x...x.....", "x......x..x.x...", "x.x.......x.....", "x.....x.x.....x."],
    snare: ["....x.......x...", "....x.......x..x"], hat: "x.x.x.x.x.x.x.x.", melRhythm: [[2, 3, 8, 14], [0, 6, 10], [2, 7, 12, 14]],
    bass: "round", keys: "keys", lead: "keys" },
  rnb: { name: "R&B", bpm: [64, 90, 75], swing: 0.55, bars: [4, 16, 8, 16, 8, 4], sevenths: true,
    kick: ["x.........x.....", "x......x........", "x.........x..x.."],
    snare: ["....x.......x...", "....x.........x."], hat: "x.x.x.x.x.x.x.x.", melRhythm: [[2, 4, 6, 12], [0, 3, 8], [4, 6, 10, 14]],
    bass: "808", keys: "pad", lead: "bell" },
};
const SECTIONS = ["Intro", "Verse", "Hook", "Verse", "Hook", "Outro"];

// ---------- the rules: turn choices into notes ----------
export function compose(o) {
  const st = STYLES[o.style], sc = SCALE[o.mood], key = 48 + o.key;
  const rd = rng(o.seeds.drums), rb = rng(o.seeds.bass), rc = rng(o.seeds.chords), rm = rng(o.seeds.melody);
  const prog = pick(rc, PROGS[o.mood]);
  const deg = (d, oct = 0) => key + 12 * (oct + Math.floor(d / 7)) + sc[((d % 7) + 7) % 7];
  const chords = prog.map((d) => {
    const tones = [d, d + 2, d + 4].concat(st.sevenths ? [d + 6] : []).map((x) => deg(x, 1));
    const third = (sc[(d + 2) % 7] - sc[d % 7] + 12) % 12, fifth = (sc[(d + 4) % 7] - sc[d % 7] + 12) % 12;
    const q = third === 3 ? (fifth === 6 ? "dim" : "m") : "";
    let root = deg(d, -1); while (root > 40) root -= 12; while (root < 28) root += 12;
    return { d, root, tones, name: NOTE[deg(d) % 12] + q, roman: q ? ROMAN[d].toLowerCase() + (q === "dim" ? "°" : "") : ROMAN[d] };
  });
  // drums: one bar pattern, rules decide fills
  const drums = o.drums || { kick: pick(rd, st.kick), snare: pick(rd, st.snare), hat: st.hat, rolls: o.style === "trap" };
  // melody: a 2-bar motif on chord tones (strong steps) and scale steps (weak), then a varied answer
  const rhythm = o.melRhythm || pick(rm, st.melRhythm);
  const motif = []; let cur = 4 + Math.floor(rm() * 3);
  for (let bar = 0; bar < 4; bar++) for (const s of rhythm) {
    if (bar % 2 === 1 && rm() < 0.35) continue;
    const ch = prog[bar], strong = s % 4 === 0;
    if (strong) { const ct = [ch, ch + 2, ch + 4].map((x) => x + 7 * Math.round((cur - x) / 7)); cur = ct.reduce((a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a)); }
    else cur += pick(rm, [-2, -1, -1, 1, 1, 2]);
    cur = Math.max(2, Math.min(11, cur));
    motif.push({ bar, step: s, m: deg(cur, 1), len: strong ? 3 : 2 });
  }
  if (o.melody) motif.splice(0, motif.length, ...o.melody);
  const bassRhythm = drums.kick;                                   // bass locks to the kick (the rule producers use)
  return { st, chords, drums, motif, bassRhythm, rhythm, slideSeed: o.seeds.bass };
}

// ---------- the sounds ----------
function kitFor(c) {
  const noise = c.createBuffer(1, c.sampleRate, c.sampleRate), d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const ns = (t, dur, type, f, q, g, out) => {
    const s = c.createBufferSource(); s.buffer = noise; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const a = c.createGain(); a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(a); a.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  };
  const env = (p, t, peak, a, dec) => { p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(peak, t + a); p.exponentialRampToValueAtTime(0.0001, t + a + dec); };
  return {
    kick(t, out, kit, v = 1) {
      const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(kit === "soft" ? 110 : 160, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.08);
      env(g.gain, t, v * (kit === "soft" ? 0.7 : 1), 0.003, kit === "boom" ? 0.5 : 0.25); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.6);
      if (kit !== "soft") ns(t, 0.02, "highpass", 3000, 0.7, 0.25 * v, out);
    },
    snare(t, out, kit, v = 1) {
      ns(t, kit === "dusty" ? 0.16 : 0.12, "bandpass", kit === "dusty" ? 1500 : 2200, 0.8, 0.7 * v, out);
      const o = c.createOscillator(), g = c.createGain(); o.type = "triangle"; o.frequency.value = 190; env(g.gain, t, 0.35 * v, 0.002, 0.07); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.15);
    },
    clap(t, out, v = 1) { for (const d of [0, 0.011, 0.022]) ns(t + d, d === 0.022 ? 0.14 : 0.02, "bandpass", 1200, 1.2, 0.6 * v, out); },
    hat(t, out, v = 1, open = false) { ns(t, open ? 0.22 : 0.04, "highpass", 7500, 0.7, 0.28 * v, out); },
    rim(t, out, v = 1) { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = 480; env(g.gain, t, 0.35 * v, 0.001, 0.03); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.06); ns(t, 0.02, "bandpass", 3000, 1, 0.2 * v, out); },
    b808(t, m, dur, out, from, v = 1) {
      const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(hz(from ?? m) * 1.5, t); o.frequency.exponentialRampToValueAtTime(hz(from ?? m), t + 0.02);
      if (from != null) o.frequency.exponentialRampToValueAtTime(hz(m), t + 0.12);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.8 * v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.3, dur));
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    },
    round(t, m, dur, out, v = 1) {
      for (const [k, a] of [[1, 0.7], [2, 0.3]]) { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = hz(m) * k; env(g.gain, t, a * v, 0.005, Math.max(0.2, dur)); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.3); }
    },
    keys(t, m, dur, out, v = 1) {        // Rhodes-like: FM tine
      const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain(), f = hz(m);
      car.frequency.value = f; mod.frequency.value = f; mg.gain.setValueAtTime(f * 1.4 * v, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.6);
      mod.connect(mg); mg.connect(car.frequency); env(g.gain, t, 0.16 * v, 0.004, dur + 0.6); car.connect(g); g.connect(out);
      car.start(t); mod.start(t); car.stop(t + dur + 1); mod.stop(t + dur + 1);
    },
    bell(t, m, dur, out, v = 1) {
      const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain(), f = hz(m);
      car.frequency.value = f; mod.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.02, t + 0.8);
      mod.connect(mg); mg.connect(car.frequency); env(g.gain, t, 0.14 * v, 0.002, dur + 0.9); car.connect(g); g.connect(out);
      car.start(t); mod.start(t); car.stop(t + dur + 1.2); mod.stop(t + dur + 1.2);
    },
    pluck(t, m, dur, out, v = 1) {
      const o = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain(); o.type = "sawtooth"; o.frequency.value = hz(m);
      fl.type = "lowpass"; fl.frequency.setValueAtTime(4000, t); fl.frequency.exponentialRampToValueAtTime(400, t + 0.25);
      env(g.gain, t, 0.1 * v, 0.003, dur + 0.25); o.connect(fl); fl.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.4);
    },
    pad(t, m, dur, out, v = 1) {
      const fl = c.createBiquadFilter(), g = c.createGain(); fl.type = "lowpass"; fl.frequency.value = 1400;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035 * v, t + 0.5); g.gain.setValueAtTime(0.035 * v, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
      for (const det of [-7, 0, 6]) { const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz(m); o.detune.value = det; o.connect(fl); o.start(t); o.stop(t + dur + 0.7); }
      fl.connect(g); g.connect(out);
    },
  };
}

// ---------- arrange + render ----------
// Rendered in 4-bar pieces that are stitched together: one long render gets slower and slower as notes pile up,
// short pieces stay fast on a phone. Each piece keeps its own echo tail, so the joins are seamless.
function plan(o, song) {
  const bars = []; let bar = 0;
  song.st.bars.forEach((nb, si) => { for (let b = 0; b < nb; b++) bars.push({ bar: bar++, sec: SECTIONS[si], b, nb }); });
  return bars;
}
function graph(c, o, only) {
  const K = kitFor(c), master = c.createGain(); master.gain.value = 0.8; master.connect(c.destination);
  const sr = c.sampleRate, verb = c.createConvolver(), irn = Math.floor(sr * 1.8), ir = c.createBuffer(2, irn, sr);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < irn; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irn, 3); }
  verb.buffer = ir; const vg = c.createGain(); vg.gain.value = 0.25; verb.connect(vg); vg.connect(master);
  const bus = (name, send) => { const g = c.createGain(); g.gain.value = only && only !== name ? 0 : (o.mute[name] ? 0 : o.vol[name]); g.connect(master); if (send) { const s = c.createGain(); s.gain.value = send; g.connect(s); s.connect(verb); } return g; };
  const B = { drums: bus("drums", 0.08), bass: bus("bass"), keys: bus("keys", 0.5), melody: bus("melody", 0.6) };
  const shaper = c.createWaveShaper(), curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(2.4 * x); }
  shaper.curve = curve; const bassIn = c.createGain(); bassIn.connect(shaper); shaper.connect(B.bass);       // 808 grit = heard on phones
  return { K, B, bassIn };
}
function schedBar(o, song, G, { bar, sec, b, nb }, t0) {
  const { K, B, bassIn } = G, beat = 60 / o.bpm, step = beat / 4, energy = o.energy, rs = rng(song.slideSeed + bar * 7919);
  const ci = bar % 4, ch = song.chords[ci], next = song.chords[(ci + 1) % 4];
  const T = (s) => t0 + s * step + (s % 2 ? (o.swing - 0.5) * beat / 2 : 0), fade = sec === "Outro" ? 1 - b / nb : sec === "Verse" ? 0.7 : 1;   // verse sits back, hook lifts
  if (o.keysSound === "pad") for (const m of ch.tones) K.pad(t0, m, 4 * beat, B.keys, fade);
  else for (const s of [0, 6, 10]) for (const [j, m] of ch.tones.entries()) K.keys(T(s) + j * 0.01, m, beat * (s ? 0.9 : 1.4), B.keys, (s ? 0.6 : 0.9) * fade);
  if (sec === "Intro" || sec === "Outro") {
    if (sec === "Intro" && b >= nb - 2) for (const n of song.motif) if (n.bar === ci) K[o.leadSound](T(n.step), n.m, n.len * step, B.melody, 0.5);
    return;
  }
  const hook = sec === "Hook", lastBar = b === nb - 1;      // the last bar before a change drops out for a beat (let it breathe)
  [...song.drums.kick].forEach((x, s) => { if (x === "x" && !(lastBar && s >= 12)) K.kick(T(s), B.drums, o.kit, 1); });
  [...song.drums.snare].forEach((x, s) => { if (x === "x") { o.style === "trap" ? K.clap(T(s), B.drums) : o.style === "rnb" && s === 4 ? K.rim(T(s), B.drums) : K.snare(T(s), B.drums, o.kit); if (hook && o.style !== "trap") K.clap(T(s), B.drums, 0.4); } });
  const roll = song.drums.rolls && bar % 2 === 1 && rs() < 0.4 + energy * 0.5, rollN = rs() < 0.5 ? 6 : 8;   // hat roll at the end of every other bar
  [...song.drums.hat].forEach((x, s) => {
    if (x !== "x") return;
    if (roll && s >= 12) { if (s === 12) for (let k = 0; k < rollN; k++) K.hat(T(12) + k * (4 * step / rollN), B.drums, 0.5 + k * 0.06); return; }
    K.hat(T(s), B.drums, s % 4 === 0 ? 0.9 : 0.6);
    if (energy > 0.5 && o.style === "trap" && hook && s % 4 === 2) K.hat(T(s + 1), B.drums, 0.45);
  });
  if (hook && o.style === "boombap" && b % 2 === 1) K.hat(T(14), B.drums, 0.6, true);
  const hits = [...song.bassRhythm].map((x, s) => (x === "x" ? s : -1)).filter((s) => s >= 0);   // bass locks to the kick
  hits.forEach((s, i) => {
    const end = i + 1 < hits.length ? hits[i + 1] : 16, d = (end - s) * step;
    if (o.bassSound === "808") K.b808(T(s), ch.root, d, bassIn, null); else K.round(T(s), ch.root, d, bassIn);
    if (o.bassSound === "808" && i === hits.length - 1 && end - s > 2 && rs() < 0.4) K.b808(T(14), next.root, 2 * step, bassIn, ch.root);   // slide into the next chord
  });
  // the tune: full in the hook (an octave up in its second half), every other phrase in the verse (room for the vocal)
  if (hook || (Math.floor(b / 4) % 2 === 1 && o.verseMelody)) for (const n of song.motif) if (n.bar === ci) K[o.leadSound](T(n.step), n.m + (hook && b >= nb / 2 ? 12 : 0), n.len * step, B.melody, hook ? 1 : 0.55);
}
export async function render(o, song, only = null, onProgress) {
  const bars = plan(o, song), barS = 4 * 60 / o.bpm, sr = 44100, tail = 2.5, CH = 4, pad = 0.05;
  const total = Math.ceil((bars.length * barS + tail + pad) * sr), L = new Float32Array(total), R = new Float32Array(total);
  const pieces = []; for (let i = 0; i < bars.length; i += CH) pieces.push(bars.slice(i, i + CH));
  let done = 0;
  const one = async (piece) => {
    const c = new OfflineAudioContext(2, Math.ceil((piece.length * barS + tail) * sr), sr), G = graph(c, o, only), first = piece[0].bar;
    for (const bd of piece) schedBar(o, song, G, bd, (bd.bar - first) * barS);
    const out = await c.startRendering(), off = Math.round((first * barS + pad) * sr), l = out.getChannelData(0), r = out.getChannelData(1);
    for (let i = 0; i < l.length && off + i < total; i++) { L[off + i] += l[i]; R[off + i] += r[i]; }
    if (onProgress) onProgress(++done / pieces.length);
  };
  for (let i = 0; i < pieces.length; i += 3) await Promise.all(pieces.slice(i, i + 3).map(one));
  let peak = 1e-9; for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = 1.15 / peak, k = Math.tanh(1.15);                     // gentle glue + loudness, never clips
  const buf = new AudioBuffer({ length: total, numberOfChannels: 2, sampleRate: sr });
  const bl = buf.getChannelData(0), br = buf.getChannelData(1);
  for (let i = 0; i < total; i++) { bl[i] = Math.tanh(L[i] * g) / k * 0.92; br[i] = Math.tanh(R[i] * g) / k * 0.92; }
  return buf;
}

// ---------- the page ----------
export function mount(root, { getCtx, onUse, wav }) {
  const seed = () => Math.floor(Math.random() * 1e9);
  const o = { style: "trap", mood: "dark", key: 6, bpm: 140, swing: 0.5, energy: 0.6, kit: "hard", bassSound: "808", keysSound: "pad", leadSound: "bell", verseMelody: true,
    seeds: { drums: seed(), bass: seed(), chords: seed(), melody: seed() }, drums: null, melody: null,
    vol: { drums: 0.9, bass: 0.75, keys: 1.3, melody: 1.4 }, mute: {} };   // chords + tune forward: phone speakers lose the low end
  let song = compose(o), buf = null, src = null;
  const $ = (s) => root.querySelector(s);
  root.innerHTML = `
    <div class="row" id="blStyle"></div>
    <div class="row" style="margin-top:8px" id="blMood"></div>
    <label class="inline" style="margin-top:10px">Tempo <b id="blBpmV"></b><input type="range" id="blBpm" style="flex:1"></label>
    <label class="inline">Key <select id="blKey" style="font:inherit;background:var(--panel2);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:8px"></select></label>
    <label class="inline" style="margin-top:6px">Bounce <input type="range" id="blSwing" min="50" max="66" style="flex:1"></label>
    <label class="inline">Energy <input type="range" id="blEnergy" min="0" max="100" style="flex:1"></label>
    <div class="row" style="margin-top:10px"><button class="on" id="blNew">🎲 Make a new beat</button><button id="blPlay">▶ Hear it</button></div>
    <p class="muted" id="blMsg"></p>
    <div id="blParts"></div>
    <div class="row" style="margin-top:12px"><button class="on" id="blUse">Use this beat → record over it</button><button id="blSave">Save beat (WAV)</button><button id="blStems">Save parts</button></div>
    <p class="muted">Made by Heartbeat's own beat engine: music-theory rules plus your choices. No AI model makes the track, the same way a drum machine works. Nobody else gets your exact beat unless you share it.</p>`;
  const chip = (label, on, fn) => { const b = document.createElement("button"); b.textContent = label; if (on) b.className = "on"; b.onclick = fn; return b; };
  function drawTop() {
    const st = STYLES[o.style];
    $("#blStyle").replaceChildren(...Object.entries(STYLES).map(([k, s]) => chip(s.name, o.style === k, () => { o.style = k; o.bpm = s.bpm[2]; o.swing = s.swing || 0.5; o.bassSound = s.bass; o.keysSound = s.keys; o.leadSound = s.lead; o.kit = k === "boombap" ? "dusty" : k === "rnb" ? "soft" : "hard"; o.drums = null; o.melody = null; o.melRhythm = null; remake(); })));
    $("#blMood").replaceChildren(chip("Dark (minor)", o.mood === "dark", () => { o.mood = "dark"; o.melody = null; remake(); }), chip("Bright (major)", o.mood === "bright", () => { o.mood = "bright"; o.melody = null; remake(); }));
    Object.assign($("#blBpm"), { min: st.bpm[0], max: st.bpm[1], value: o.bpm }); $("#blBpmV").textContent = o.bpm + " BPM";
    $("#blKey").innerHTML = NOTE.map((n, i) => `<option value="${i}" ${i === o.key ? "selected" : ""}>${n}</option>`).join("");
    $("#blSwing").value = Math.round(o.swing * 100); $("#blEnergy").value = Math.round(o.energy * 100);
  }
  function drawParts() {
    const ch = song.chords, el = $("#blParts"); el.innerHTML = "";
    const part = (key, title, what, sounds, cur, setSound, onNew, extra) => {
      const d = document.createElement("div"); d.className = "card"; d.style.margin = "10px 0"; d.style.background = "var(--panel2)";
      d.innerHTML = `<div class="row" style="justify-content:space-between"><b>${title}</b><span class="row"></span></div><p class="muted" style="margin:6px 0">${what}</p>`;
      const r = d.querySelector(".row span");
      r.append(chip("New " + title.toLowerCase(), false, onNew), chip(o.mute[key] ? "Muted" : "Mute", o.mute[key], () => { o.mute[key] = !o.mute[key]; buf = null; drawParts(); }));
      const s = document.createElement("div"); s.className = "chips"; sounds.forEach(([v, l]) => s.append(chip(l, cur === v, () => { setSound(v); buf = null; drawParts(); }))); d.append(s);
      if (extra) d.append(extra); el.append(d);
    };
    // drum grid: tap any step
    const grid = document.createElement("div"); grid.style.cssText = "display:grid;grid-template-columns:44px repeat(16,1fr);gap:2px;margin-top:8px";
    for (const row of ["kick", "snare", "hat"]) {
      const lab = document.createElement("span"); lab.textContent = row === "snare" && o.style === "trap" ? "clap" : row; lab.className = "muted"; lab.style.fontSize = "12px"; grid.append(lab);
      [...song.drums[row]].forEach((x, s) => {
        const b = document.createElement("button"); b.setAttribute("aria-label", row + " step " + (s + 1));
        b.style.cssText = `min-height:28px;padding:0;border-radius:5px;background:${x === "x" ? "var(--accent)" : s % 4 === 0 ? "#3a2f24" : "#2b221a"}`;
        b.onclick = () => { const a = [...song.drums[row]]; a[s] = a[s] === "x" ? "." : "x"; song.drums[row] = a.join(""); o.drums = { ...song.drums }; if (row === "kick") song.bassRhythm = song.drums.kick; buf = null; drawParts(); };
        grid.append(b);
      });
    }
    part("drums", "Drums", "Tap squares to add or remove hits. The bass follows the kick.", [["hard", "Hard"], ["dusty", "Dusty"], ["soft", "Soft"], ["boom", "Boomy"]], o.kit, (v) => (o.kit = v),
      () => { o.seeds.drums = seed(); o.drums = null; remake(); }, grid);
    part("bass", "Bass", `Plays the root of each chord: ${ch.map((c) => nn(c.root)).join(" · ")}`, [["808", "808 (slides)"], ["round", "Round bass"]], o.bassSound, (v) => (o.bassSound = v),
      () => { o.seeds.bass = seed(); remake(); });
    part("keys", "Chords", `${ch.map((c) => c.name).join(" → ")} &nbsp;(${ch.map((c) => c.roman).join(" – ")} in ${NOTE[o.key]} ${o.mood === "dark" ? "minor" : "major"})`, [["pad", "Warm pad"], ["keys", "Electric piano"]], o.keysSound, (v) => (o.keysSound = v),
      () => { o.seeds.chords = seed(); o.melody = null; remake(); });
    const notes = song.motif.map((n) => nn(n.m)).join(" ");
    const vt = document.createElement("label"); vt.className = "inline"; vt.style.marginTop = "8px"; vt.innerHTML = `<input type="checkbox" ${o.verseMelody ? "checked" : ""}> Melody in the verses too (off = more room to rap)`;
    vt.querySelector("input").onchange = (e) => { o.verseMelody = e.target.checked; buf = null; };
    part("melody", "Melody", `The tune (4 bars): ${notes}. Full in the hook, an octave up in its second half.`, [["bell", "Bell"], ["keys", "Electric piano"], ["pluck", "Pluck"]], o.leadSound, (v) => (o.leadSound = v),
      () => { o.seeds.melody = seed(); o.melody = null; remake(); }, vt);
    const st = song.st, beatS = 60 / o.bpm, tot = st.bars.reduce((a, b) => a + b, 0) * 4 * beatS;
    $("#blMsg").textContent = `${st.name} · ${o.bpm} BPM · ${NOTE[o.key]} ${o.mood === "dark" ? "minor" : "major"} · ${Math.floor(tot / 60)}:${String(Math.round(tot % 60)).padStart(2, "0")} · ` + st.bars.map((n, i) => SECTIONS[i] + " " + n).join(", ") + " bars";
  }
  function remake() { stopPrev(); song = compose(o); if (o.drums) song.drums = o.drums; buf = null; drawTop(); drawParts(); }
  function stopPrev() { if (src) { try { src.stop(); } catch (e) {} src = null; $("#blPlay").textContent = "▶ Hear it"; } }
  async function build() {
    if (buf) return buf; const m = $("#blMsg"); m.textContent = "Building your beat… 0%";
    buf = await render(o, song, null, (p) => { m.textContent = "Building your beat… " + Math.round(p * 100) + "%"; }); drawParts(); return buf;
  }
  $("#blBpm").oninput = (e) => { o.bpm = +e.target.value; $("#blBpmV").textContent = o.bpm + " BPM"; buf = null; };
  $("#blKey").onchange = (e) => { o.key = +e.target.value; o.melody = null; remake(); };
  $("#blSwing").oninput = (e) => { o.swing = e.target.value / 100; buf = null; };
  $("#blEnergy").oninput = (e) => { o.energy = e.target.value / 100; buf = null; };
  $("#blNew").onclick = () => { o.seeds = { drums: seed(), bass: seed(), chords: seed(), melody: seed() }; o.drums = null; o.melody = null; o.key = Math.floor(Math.random() * 12); remake(); };
  $("#blPlay").onclick = async () => {
    if (src) return stopPrev(); const ctx = getCtx(); const b = await build();
    src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(); $("#blPlay").textContent = "■ Stop"; src.onended = () => { src = null; $("#blPlay").textContent = "▶ Hear it"; };
  };
  const name = () => `${STYLES[o.style].name} ${NOTE[o.key]}${o.mood === "dark" ? "m" : ""} ${o.bpm}`;
  $("#blUse").onclick = async () => { stopPrev(); const b = await build(); onUse(b, "Beat Lab: " + name(), o.bpm); };
  const dl = (blob, fn) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fn; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); };
  $("#blSave").onclick = async () => { dl(wav(await build()), name().replace(/\W+/g, "-") + ".wav"); };
  $("#blStems").onclick = async () => {
    $("#blMsg").textContent = "Saving parts…";
    for (const p of ["drums", "bass", "keys", "melody"]) { $("#blMsg").textContent = "Saving " + p + "…"; dl(wav(await render(o, song, p)), name().replace(/\W+/g, "-") + "-" + p + ".wav"); }
    drawParts();
  };
  drawTop(); drawParts();
}
