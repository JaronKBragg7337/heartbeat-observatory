// Beat Lab - Heartbeat's own beat engine. Jaron 10/24: no producer needed, no talent needed, nobody's permission.
// A beat is made from music-theory RULES (scales, chord moves, drum patterns per style) + seeded randomness + the
// artist's choices. No trained AI model makes the track: like a drum machine, it's software the person drives.
// Every sound is synthesized here (Web Audio), no samples. Renders offline, so the result is exact on any phone.
// Mix rules (10/24, Fable): tuned for a PHONE SPEAKER first - the drums carry a 2-8 kHz "snap", the 808 has a buzz
// harmonic so it is still heard when the speaker can't play the sub, and the master runs through a glue compressor
// and a soft clipper (about -11 LUFS, peaks under -0.5 dBFS). Headphones still get the full low end.

const NOTE = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const nn = (m) => NOTE[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];

const SCALE = { dark: [0, 2, 3, 5, 7, 8, 10], bright: [0, 2, 4, 5, 7, 9, 11] };
const PROGS = {                                  // scale degrees, 0 = home chord (14 moves per mood, all real-record progressions)
  dark: [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 6], [0, 5, 3, 4], [0, 0, 5, 6], [0, 3, 0, 4], [0, 2, 5, 6], [5, 6, 0, 0], [0, 6, 3, 4], [3, 5, 0, 6], [0, 4, 5, 2], [5, 3, 6, 0], [0, 2, 3, 4], [6, 5, 0, 4]],
  bright: [[0, 4, 5, 3], [1, 4, 0, 5], [3, 4, 2, 5], [0, 5, 3, 4], [0, 3, 4, 3], [5, 3, 0, 4], [0, 4, 3, 5], [3, 0, 4, 5], [0, 2, 3, 4], [1, 3, 0, 4], [5, 4, 0, 3], [0, 5, 1, 4], [3, 4, 0, 0], [0, 1, 3, 4]],
};
// Common rhythm pool for the tune (16th steps in a bar); each style adds its own on top.
const MEL_COMMON = [[0, 4, 8, 12], [0, 6, 8, 14], [2, 6, 10, 14], [0, 2, 4, 8, 10], [0, 3, 8, 11], [4, 8, 12, 15], [0, 7, 8, 15], [1, 4, 9, 12]];
const HATS_COMMON = ["x.x.x.x.x.x.x.x.", "x.x.x.xxx.x.x.xx", "x.xxx.x.x.xxx.x.", "xxxxxxxxxxxxxxxx", "x.x.x.x.x.x.xxxx"];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
// Each style = the rules a producer in that lane follows. bpm = [min, max, default]. Drum rows are one bar of 16 steps.
const STYLES = {
  trap: { hats: ["x.x.x.x.x.x.x.x.", "xxxxxxxxxxxxxxxx", "x.x.x.xxx.x.x.xx", "x.xxx.x.x.xxx.x."], kits: ["hard", "boom"], bassPool: ["808"], keysPool: ["pad", "keys", "pluck"], leadPool: ["bell", "pluck", "dark", "keys"], bassModes: ["kick", "kick", "half"], name: "Trap", tag: "Hard 808s, claps, fast hat rolls. Space for the voice.", bpm: [120, 165, 140], swing: 0, bars: [8, 32, 16, 32, 16, 8], sevenths: false,
    kick: ["x......x..x.....", "x.....x...x..x..", "x..x......x.....", "x......x.x......", "x.....x..x....x."],
    snare: ["....x.......x...", "....x.......x..x", "........x.......", "........x......x"], hat: "x.x.x.x.x.x.x.x.", melRhythm: [[0, 3, 6, 8, 11, 14], [0, 2, 6, 10, 12], [0, 3, 7, 10, 14]],
    bass: "808", keys: "pad", lead: "bell", kit: "hard", snareSound: "clap", rolls: true, slides: 0.12, mood: "dark", keysRhythm: "hold" },
  drill: { hats: ["x.x.x.x.x.x.x.x.", "x.x.x.xxx.x.x.x.", "x.xxx.x.x.xxx.x."], kits: ["hard"], bassPool: ["808"], keysPool: ["pad", "keys"], leadPool: ["dark", "bell", "pluck"], bassModes: ["kick", "synco"], name: "Drill", tag: "Sliding 808s, snares off the beat, skipping hats. Cold and tense.", bpm: [136, 150, 142], swing: 0, bars: [4, 32, 16, 32, 16, 8], sevenths: false,
    kick: ["x......x..x.....", "x.....x...x.....", "x.......x.x.....", "x......x....x...", "x..x......x.....", "x.......x...x.x."],
    snare: ["......x.......x.", "......x.....x.x.", "......x......x..", "....x.x.......x."], hat: "x.x.x.x.x.x.x.x.", melRhythm: [[0, 3, 6, 10, 12], [0, 2, 4, 8, 11, 14], [2, 6, 9, 12]],
    bass: "808", keys: "pad", lead: "dark", kit: "hard", snareSound: "snare", rolls: true, slides: 0.22, hatSkip: true, mood: "dark", keysRhythm: "hold" },
  boombap: { hats: ["x.x.x.x.x.x.x.x.", "x.x.x.x.x.x.x.xx", "x.xxx.x.x.xxx.x."], kits: ["dusty", "hard", "boom"], bassPool: ["round", "808"], keysPool: ["keys", "pad"], leadPool: ["keys", "bell", "pluck"], bassModes: ["kick", "walk"], name: "Boom bap", tag: "Dusty drums, head-nod swing, warm keys. Classic hip hop.", bpm: [80, 100, 90], swing: 0.58, bars: [4, 16, 8, 16, 8, 4], sevenths: true,
    kick: ["x.....x...x.....", "x......x..x.x...", "x.x.......x.....", "x.....x.x.....x."],
    snare: ["....x.......x...", "....x.......x..x"], hat: "x.x.x.x.x.x.x.x.", melRhythm: [[2, 3, 8, 14], [0, 6, 10], [2, 7, 12, 14]],
    bass: "round", keys: "keys", lead: "keys", kit: "dusty", snareSound: "snare", rolls: false, slides: 0, openHat: true, mood: "dark", keysRhythm: "stabs" },
  lofi: { hats: ["x.x.x.x.x.x.x.x.", "..x...x...x...x.", "x.x.x.x.x.x.x.xx"], kits: ["soft", "dusty"], bassPool: ["round"], keysPool: ["keys", "pad"], leadPool: ["keys", "bell", "pluck"], bassModes: ["kick", "half", "walk"], name: "Lo-fi", tag: "Slow, soft, a little wobbly, vinyl crackle. Late-night writing.", bpm: [65, 90, 78], swing: 0.6, bars: [4, 16, 8, 16, 8, 4], sevenths: true,
    kick: ["x.....x...x.....", "x.........x.....", "x......x..x.....", "x..x......x.....", "x.....x...x..x.."],
    snare: ["....x.......x...", "....x.........x.", "....x.......x.x.", "....x...x...x..."], hat: "x.x.x.x.x.x.x.x.", melRhythm: [[2, 6, 10], [0, 3, 8, 12], [4, 7, 12]],
    bass: "round", keys: "keys", lead: "keys", kit: "soft", snareSound: "snare", rolls: false, slides: 0, crackle: true, wobble: true, mood: "dark", keysRhythm: "stabs" },
  rnb: { hats: ["x.x.x.x.x.x.x.x.", "..x...x...x...x.", "x.x.x.xxx.x.x.x.", "xxxxxxxxxxxxxxxx"], kits: ["soft", "hard"], bassPool: ["808", "round"], keysPool: ["pad", "keys"], leadPool: ["bell", "keys", "pluck"], bassModes: ["kick", "half"], name: "R&B", tag: "Slow and smooth, soft kick, rim shots, warm pad. Sing on it.", bpm: [64, 90, 75], swing: 0.55, bars: [4, 16, 8, 16, 8, 4], sevenths: true,
    kick: ["x.........x.....", "x......x........", "x.........x..x..", "x..x......x.....", "x.......x.x....."],
    snare: ["....x.......x...", "....x.........x.", "....x.......x..x", "......x.....x..."], hat: "x.x.x.x.x.x.x.x.", melRhythm: [[2, 4, 6, 12], [0, 3, 8], [4, 6, 10, 14]],
    bass: "808", keys: "pad", lead: "bell", kit: "soft", snareSound: "rim", rolls: false, slides: 0.1, mood: "dark", keysRhythm: "hold" },
  afro: { hats: ["..x...x...x...x.", "x.x.x.x.x.x.x.x.", "..x..x..x...x.x."], kits: ["hard", "soft"], bassPool: ["log", "round"], keysPool: ["pluck", "keys", "pad"], leadPool: ["pluck", "bell", "keys"], bassModes: ["kick", "synco"], name: "Afrobeats", tag: "Bouncy kick, shakers, log drum bass, bright plucked chords. Made to dance.", bpm: [98, 118, 108], swing: 0.52, bars: [4, 16, 8, 16, 8, 4], sevenths: false,
    kick: ["x..x..x...x.x...", "x..x..x.x...x...", "x..x....x.x.x...", "x.....x..x..x...", "x..x..x...x...x."],
    snare: ["....x.......x...", "....x.....x.x...", "....x..x....x...", "..x...x...x...x."], hat: "..x...x...x...x.", melRhythm: [[0, 3, 6, 8, 11], [2, 4, 7, 10, 12, 14], [0, 2, 6, 9, 12]],
    bass: "log", keys: "pluck", lead: "pluck", kit: "hard", snareSound: "rim", rolls: false, slides: 0, shaker: true, perc: true, mood: "bright", keysRhythm: "off" },
};
const SECTIONS = ["Intro", "Verse", "Hook", "Verse", "Hook", "Outro"];

// ---------- the rules: turn choices into notes ----------
export function compose(o) {
  const st = STYLES[o.style], sc = SCALE[o.mood], key = 48 + o.key;
  const rd = rng(o.seeds.drums), rc = rng(o.seeds.chords), rm = rng(o.seeds.melody);
  const prog = pick(rc, PROGS[o.mood]);
  const deg = (d, oct = 0) => key + 12 * (oct + Math.floor(d / 7)) + sc[((d % 7) + 7) % 7];
  const chords = prog.map((d) => {
    const tones = [d, d + 2, d + 4].concat(st.sevenths ? [d + 6] : []).map((x) => deg(x, 1));
    const third = (sc[(d + 2) % 7] - sc[d % 7] + 12) % 12, fifth = (sc[(d + 4) % 7] - sc[d % 7] + 12) % 12;
    const q = third === 3 ? (fifth === 6 ? "dim" : "m") : "";
    let root = deg(d, -1); while (root > 40) root -= 12; while (root < 28) root += 12;
    return { d, root, tones, name: NOTE[deg(d) % 12] + q, roman: q ? ROMAN[d].toLowerCase() + (q === "dim" ? "°" : "") : ROMAN[d] };
  });
  // voicing: first chord in a random inversion, every next chord takes the inversion that moves the least (smooth, like a keys player)
  let prevAvg = null;
  for (const ch of chords) {
    const inv = (n) => ch.tones.map((m, i) => (i < n ? m + 12 : m)).sort((a, b) => a - b), avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const opts = [0, 1, 2].map(inv);
    ch.tones = prevAvg == null ? pick(rc, opts) : opts.reduce((a, b) => (Math.abs(avg(b) - prevAvg) < Math.abs(avg(a) - prevAvg) ? b : a));
    prevAvg = avg(ch.tones);
  }
  // drums: one bar pattern, rules decide fills
  const drums = o.drums || { kick: pick(rd, st.kick), snare: pick(rd, st.snare), hat: pick(rd, (st.hats || [st.hat]).concat(rd() < 0.3 ? HATS_COMMON : [])), rolls: !!st.rolls };
  // bass: how it follows the kick - every kick, only the first kick of each half bar, a syncopated line, or a walking line
  const bassMode = o.bassMode || pick(rng(o.seeds.bass), st.bassModes || ["kick"]);
  // melody: a motif on chord tones (strong steps) and scale steps (weak), shaped by one of three contours
  const rhythm = o.melRhythm || pick(rm, st.melRhythm.concat(MEL_COMMON));
  const shape = pick(rm, ["steps", "steps", "leaps", "riff"]), skip = 0.2 + rm() * 0.3, stepsPool = shape === "leaps" ? [-4, -2, 2, 2, 4, 3] : [-2, -1, -1, 1, 1, 2];
  const motif = []; let cur = 3 + Math.floor(rm() * 5); const lenPool = pick(rm, [[3, 2], [4, 2], [2, 1], [6, 3]]);
  const cell = [];                                                          // riff = one bar cell repeated, moved to each chord
  for (let bar = 0; bar < 4; bar++) {
    if (shape === "riff" && bar > 0) { let shift = deg(prog[bar]) - deg(prog[0]); if (shift > 6) shift -= 12; if (shift < -6) shift += 12; for (const n of cell) motif.push({ bar, step: n.step, m: n.m + shift, len: n.len }); continue; }
    for (const s of rhythm) {
      if (bar % 2 === 1 && rm() < skip) continue;
      const ch = prog[bar], strong = s % 4 === 0;
      if (strong) { const ct = [ch, ch + 2, ch + 4].map((x) => x + 7 * Math.round((cur - x) / 7)); cur = ct.reduce((a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a)); }
      else cur += pick(rm, stepsPool);
      cur = Math.max(2, Math.min(12, cur));
      const n = { bar, step: s, m: deg(cur, 1), len: strong ? lenPool[0] : lenPool[1] }; motif.push(n); if (bar === 0) cell.push(n);
    }
  }
  if (o.melody) motif.splice(0, motif.length, ...o.melody);
  // arrangement choices for this beat (seeded by the drums): which verse phrases get the tune, hook octave lift, double-time hats
  const ra = rng(o.seeds.drums + 17), arr = { versePhrase: ra() < 0.5 ? 1 : 0, octaveUp: ra() < 0.7, doubleHats: ra() < 0.5, introTune: ra() < 0.6, stabs: pick(ra, [[0, 6, 10], [0, 4, 8, 12], [0, 7, 10], [2, 6, 10, 14], [0, 3, 8, 11]]) };
  const bassRhythm = drums.kick;                                   // bass locks to the kick (the rule producers use)
  return { st, chords, drums, motif, bassRhythm, rhythm, shape, bassMode, arr, slideSeed: o.seeds.bass };
}
// The dice: a new beat inside the chosen style. Everything that can differ, differs: key, moves, drums, sounds, tempo, bounce, energy.
export function roll(o, seed) {
  const st = STYLES[o.style], r = rng(seed);
  o.seeds = { drums: Math.floor(r() * 1e9), bass: Math.floor(r() * 1e9), chords: Math.floor(r() * 1e9), melody: Math.floor(r() * 1e9) };
  o.drums = null; o.melody = null; o.melRhythm = null; o.bassMode = null;
  o.key = Math.floor(r() * 12);
  const span = st.bpm[1] - st.bpm[0]; o.bpm = Math.round(st.bpm[2] + (r() - 0.5) * span * 0.7);        // tempo nudge around the style's default
  o.bpm = Math.max(st.bpm[0], Math.min(st.bpm[1], o.bpm));
  o.swing = Math.min(0.66, Math.max(0.5, (st.swing || 0.5) + (r() - 0.4) * 0.05));
  o.energy = 0.3 + r() * 0.65;
  o.kit = pick(r, st.kits || [st.kit]); o.bassSound = pick(r, st.bassPool || [st.bass]); o.keysSound = pick(r, st.keysPool || [st.keys]); o.leadSound = pick(r, st.leadPool || [st.lead]);
  if (st.moodFree !== false && r() < 0.25) o.mood = o.mood === "dark" ? "bright" : "dark"; else o.mood = st.mood;   // mostly the style's mood, sometimes the other one
  return o;
}

// ---------- the sounds ----------
function kitFor(c) {
  const noise = c.createBuffer(1, c.sampleRate, c.sampleRate), d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const panTo = (node, out, pan) => { if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(out); } else node.connect(out); };
  // filtered noise burst: the base of every drum's "snap"
  const ns = (t, dur, type, f, q, g, out, pan = 0, f2 = null) => {
    const s = c.createBufferSource(); s.buffer = noise; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const a = c.createGain(); a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(a); panTo(a, out, pan); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  };
  const env = (p, t, peak, a, dec) => { p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a); p.exponentialRampToValueAtTime(0.0001, t + a + dec); };
  const tone = (t, type, f0, f1, sweep, peak, dec, out, pan = 0) => {   // one pitched hit with a pitch drop
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + sweep);
    env(g.gain, t, peak, 0.002, dec); o.connect(g); panTo(g, out, pan); o.start(t); o.stop(t + dec + 0.05);
  };
  return {
    kick(t, out, kit, v = 1) {
      // body (sub sweep) + knock (mid tone that a phone can play) + click
      const soft = kit === "soft", boom = kit === "boom";
      tone(t, "sine", soft ? 130 : 185, soft ? 44 : 50, soft ? 0.09 : 0.055, v * (soft ? 0.75 : 1), boom ? 0.55 : soft ? 0.3 : 0.26, out);
      tone(t, "triangle", soft ? 160 : 240, soft ? 85 : 95, 0.03, v * (soft ? 0.18 : 0.38), soft ? 0.05 : 0.07, out);
      if (!soft) ns(t, 0.018, "highpass", 2600, 0.7, 0.45 * v, out);
      if (kit === "dusty") ns(t, 0.06, "lowpass", 900, 0.7, 0.3 * v, out);
    },
    snare(t, out, kit, v = 1) {
      const dusty = kit === "dusty", soft = kit === "soft";
      ns(t, dusty ? 0.2 : soft ? 0.14 : 0.16, "bandpass", dusty ? 1300 : 1900, 0.6, (soft ? 0.6 : 0.85) * v, out);     // body noise
      ns(t, 0.07, "highpass", soft ? 4500 : 3800, 0.7, (soft ? 0.35 : 0.6) * v, out);                                  // snap (phone hears this)
      tone(t, "triangle", 196, 165, 0.04, (soft ? 0.3 : 0.45) * v, 0.08, out);                                          // drum tone
      if (!soft) tone(t, "sine", 330, 330, 0.01, 0.12 * v, 0.05, out);
    },
    clap(t, out, v = 1) {
      for (const [i, d] of [0, 0.009, 0.019, 0.03].entries()) ns(t + d, i === 3 ? 0.2 : 0.018, "bandpass", 1150, 0.9, (i === 3 ? 0.8 : 0.5) * v, out);
      ns(t + 0.03, 0.09, "highpass", 3200, 0.7, 0.5 * v, out);
    },
    hat(t, out, v = 1, open = false, pan = 0.18) { ns(t, open ? 0.26 : 0.045, "bandpass", 9000, 0.9, (open ? 0.6 : 0.8) * v, out, pan); ns(t, open ? 0.2 : 0.025, "highpass", 6500, 0.7, 0.4 * v, out, pan); },
    shaker(t, out, v = 1) { ns(t, 0.05, "bandpass", 5200, 1.1, 0.42 * v, out, -0.3, 4200); },
    rim(t, out, v = 1) { tone(t, "sine", 520, 480, 0.01, 0.45 * v, 0.035, out, -0.15); tone(t, "triangle", 1700, 1700, 0.01, 0.2 * v, 0.02, out, -0.15); ns(t, 0.025, "bandpass", 3200, 1, 0.3 * v, out, -0.15); },
    perc(t, out, v = 1, hi = false) { tone(t, "sine", hi ? 420 : 260, hi ? 300 : 170, 0.06, 0.4 * v, 0.12, out, hi ? 0.35 : -0.35); ns(t, 0.015, "highpass", 2000, 0.7, 0.15 * v, out, hi ? 0.35 : -0.35); },
    crash(t, out, v = 1) { ns(t, 0.9, "bandpass", 6500, 0.5, 0.45 * v, out, 0, 3500); ns(t, 0.5, "highpass", 8000, 0.7, 0.3 * v, out); },
    riser(t, dur, out, v = 1) {        // noise swell into the hook
      const s = c.createBufferSource(); s.buffer = noise; s.loop = true; const fl = c.createBiquadFilter(); fl.type = "bandpass"; fl.Q.value = 1.4;
      fl.frequency.setValueAtTime(500, t); fl.frequency.exponentialRampToValueAtTime(7000, t + dur);
      const a = c.createGain(); a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(0.3 * v, t + dur); a.gain.setValueAtTime(0.0001, t + dur + 0.001);
      s.connect(fl); fl.connect(a); a.connect(out); s.start(t); s.stop(t + dur + 0.01);
    },
    crackle(t, dur, out, r, v = 1) {   // vinyl: soft hiss + a few random ticks per bar
      ns(t, dur, "bandpass", 3500, 0.4, 0.012 * v, out);
      for (let i = 0; i < 7; i++) if (r() < 0.6) ns(t + r() * dur, 0.006, "highpass", 2500, 0.7, 0.07 * v * (0.5 + r()), out, r() - 0.5);
    },
    b808(t, m, dur, out, from, v = 1, glide = 0.12) {
      // sine body with a punchy pitch drop + a 2nd-harmonic "buzz" so the note reads on a phone speaker
      const f = hz(m), o = c.createOscillator(), g = c.createGain(), start = from != null ? hz(from) : f * 2.2;
      o.frequency.setValueAtTime(start, t); o.frequency.exponentialRampToValueAtTime(from != null ? hz(from) : f, t + 0.025);
      if (from != null) o.frequency.exponentialRampToValueAtTime(f, t + 0.025 + glide);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.72 * v, t + 0.006); g.gain.setValueAtTime(0.72 * v, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.35, dur));
      o.connect(g); g.connect(out); o.start(t); o.stop(t + Math.max(0.35, dur) + 0.05);
      const h = c.createOscillator(), hg = c.createGain(); h.type = "triangle"; h.frequency.setValueAtTime(start * 2, t); h.frequency.exponentialRampToValueAtTime((from != null ? hz(from) : f) * 2, t + 0.025);
      if (from != null) h.frequency.exponentialRampToValueAtTime(f * 2, t + 0.025 + glide);
      env(hg.gain, t, 0.22 * v, 0.004, Math.min(0.5, Math.max(0.25, dur * 0.6))); h.connect(hg); hg.connect(out); h.start(t); h.stop(t + 0.6);
    },
    round(t, m, dur, out, v = 1) {
      for (const [k, a, type] of [[1, 0.75, "sine"], [2, 0.28, "triangle"]]) { const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = hz(m) * k; env(g.gain, t, a * v, 0.008, Math.max(0.2, dur * 0.9)); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.3); }
      ns(t, 0.012, "lowpass", 1500, 0.7, 0.1 * v, out);       // finger pluck
    },
    log(t, m, dur, out, v = 1) {       // log drum (amapiano/afro bass): sine with a fast pitch drop, short and bouncy
      tone(t, "sine", hz(m) * 2.6, hz(m), 0.035, 0.7 * v, Math.min(0.45, Math.max(0.22, dur * 0.8)), out);
      tone(t, "triangle", hz(m) * 5.2, hz(m) * 2, 0.035, 0.22 * v, 0.12, out);
    },
    keys(t, m, dur, out, v = 1, wobble = 0) {        // Rhodes-like: FM tine
      const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain(), f = hz(m);
      car.frequency.value = f; mod.frequency.value = f; mg.gain.setValueAtTime(f * 1.4 * v, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.6);
      mod.connect(mg); mg.connect(car.frequency); env(g.gain, t, 0.16 * v, 0.004, dur + 0.6); car.connect(g); g.connect(out);
      if (wobble) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 0.9 + wobble; lg.gain.value = 9 * wobble; l.connect(lg); lg.connect(car.detune); l.start(t); l.stop(t + dur + 1); }
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
    dark(t, m, dur, out, v = 1) {      // drill lead: two detuned saws, closed filter, slow vibrato
      const fl = c.createBiquadFilter(), g = c.createGain(); fl.type = "lowpass"; fl.frequency.setValueAtTime(2600, t); fl.frequency.exponentialRampToValueAtTime(700, t + dur + 0.3); fl.Q.value = 2;
      env(g.gain, t, 0.085 * v, 0.01, dur + 0.35); fl.connect(g); g.connect(out);
      const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = 7; l.connect(lg); l.start(t); l.stop(t + dur + 0.5);
      for (const det of [-9, 9]) { const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz(m); o.detune.value = det; lg.connect(o.detune); o.connect(fl); o.start(t); o.stop(t + dur + 0.5); }
    },
    pad(t, m, dur, out, v = 1) {
      const fl = c.createBiquadFilter(), g = c.createGain(); fl.type = "lowpass"; fl.frequency.value = 1400;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035 * v, t + 0.5); g.gain.setValueAtTime(0.035 * v, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
      for (const det of [-7, 0, 6]) { const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz(m); o.detune.value = det; const pg = c.createGain(); pg.gain.value = 0.34; o.connect(pg); panTo(pg, fl, det / 14); o.start(t); o.stop(t + dur + 0.7); }
      fl.connect(g); g.connect(out);
    },
  };
}

// ---------- arrange + render ----------
// Rendered in 4-bar pieces that are stitched together: one long render gets slower and slower as notes pile up,
// short pieces stay fast on a phone. Each piece keeps its own echo tail, so the joins are seamless.
function plan(o, song) {
  const bars = []; let bar = 0; const seen = {};
  song.st.bars.forEach((nb0, si) => {
    const nb = Math.max(2, Math.round(nb0 * (o.len || 1) / 2) * 2), sec = SECTIONS[si]; seen[sec] = (seen[sec] || 0) + 1;
    for (let b = 0; b < nb; b++) bars.push({ bar: bar++, sec, b, nb, si, nth: seen[sec], next: SECTIONS[si + 1] || null });
  });
  return bars;
}
function graph(c, o, only) {
  const K = kitFor(c), master = c.createGain(); master.gain.value = 0.8;
  const tilt = c.createBiquadFilter(); tilt.type = "peaking"; tilt.frequency.value = 3200; tilt.Q.value = 0.7; tilt.gain.value = 2.5;   // presence: phone speakers live here
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 15500; lp.Q.value = 0.5;        // nothing above what a phone or an MP3 keeps (also tames true peaks)
  master.connect(tilt); tilt.connect(lp); lp.connect(c.destination);
  const sr = c.sampleRate, verb = c.createConvolver(), irn = Math.floor(sr * 1.8), ir = c.createBuffer(2, irn, sr);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < irn; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irn, 3); }
  verb.buffer = ir; const vg = c.createGain(); vg.gain.value = 0.25; verb.connect(vg); vg.connect(master);
  const bus = (name, send) => { const g = c.createGain(); g.gain.value = only && only !== name ? 0 : (o.mute[name] ? 0 : o.vol[name]); g.connect(master); if (send) { const s = c.createGain(); s.gain.value = send; g.connect(s); s.connect(verb); } return g; };
  const B = { drums: bus("drums", 0.07), bass: bus("bass"), keys: bus("keys", 0.5), melody: bus("melody", 0.55) };
  // drums: gentle saturation + a high shelf so the snap survives a phone speaker
  const dsh = c.createWaveShaper(), dc = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; dc[i] = Math.tanh(1.3 * x) / Math.tanh(1.3); }
  dsh.curve = dc; const shelf = c.createBiquadFilter(); shelf.type = "highshelf"; shelf.frequency.value = 4500; shelf.gain.value = 3;
  const drumsIn = c.createGain(); drumsIn.connect(dsh); dsh.connect(shelf); shelf.connect(B.drums);
  // bass: saturation = 808 grit heard on phones
  const shaper = c.createWaveShaper(), curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(2.4 * x); }
  shaper.curve = curve; const bassIn = c.createGain(); bassIn.connect(shaper); shaper.connect(B.bass);
  // melody: a dotted-8th echo (the classic record trick), quiet, panned a touch
  const beat = 60 / o.bpm, dl = c.createDelay(2), fb = c.createGain(), dg = c.createGain(), dfl = c.createBiquadFilter();
  dl.delayTime.value = Math.min(1.9, beat * 0.75); fb.gain.value = 0.32; dg.gain.value = 0.3; dfl.type = "lowpass"; dfl.frequency.value = 3000;
  const melIn = c.createGain(); melIn.connect(B.melody); melIn.connect(dl); dl.connect(dfl); dfl.connect(fb); fb.connect(dl);
  if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = -0.3; dfl.connect(p); p.connect(dg); } else dfl.connect(dg);
  dg.connect(B.melody);
  return { K, B, bassIn, drumsIn, melIn };
}
function schedBar(o, song, G, bd, t0) {
  const { bar, sec, b, nb, nth, next } = bd, st = song.st, { K, B, bassIn, drumsIn, melIn } = G, beat = 60 / o.bpm, step = beat / 4, energy = o.energy, rs = rng(song.slideSeed + bar * 7919);
  const ci = bar % 4, ch = song.chords[ci], nextCh = song.chords[(ci + 1) % 4];
  const hum = () => rs() * 0.006, vel = (base) => base * (0.92 + rs() * 0.16);           // humanize: a few ms, a few percent
  const T = (s) => t0 + s * step + (s % 2 ? (o.swing - 0.5) * beat / 2 : 0);
  const hook = sec === "Hook", verse = sec === "Verse", lastBar = b === nb - 1, intoHook = next === "Hook" && b >= nb - 2;
  const breakdown = verse && nth === 2 && b < 4;                                                 // verse 2 opens stripped back, then the beat comes back
  const fade = sec === "Outro" ? 1 - b / nb : verse ? 0.7 : 1;                                   // verse sits back, hook lifts
  // chords
  const kv = (breakdown ? 0.55 : 1) * fade;
  if (o.keysSound === "pad") for (const m of ch.tones) K.pad(t0, m, 4 * beat, B.keys, kv);
  else if (st.keysRhythm === "off") for (const s of [0, 3, 6, 10, 13]) for (const [j, m] of ch.tones.entries()) K[o.keysSound](T(s) + j * 0.008, m, step * 1.5, B.keys, (s ? 0.75 : 0.95) * kv);
  else for (const s of song.arr.stabs) for (const [j, m] of ch.tones.entries()) K[o.keysSound](T(s) + j * 0.01, m, beat * (s ? 0.9 : 1.4), B.keys, (s ? 0.6 : 0.9) * kv, st.wobble ? 1 : 0);
  if (st.crackle) K.crackle(t0, 4 * beat, drumsIn, rs);
  const tune = (v, up = 0) => { for (const n of song.motif) if (n.bar === ci) K[o.leadSound](T(n.step) + hum(), n.m + up, n.len * step, melIn, vel(v)); };
  if (sec === "Intro" || sec === "Outro") {
    if (sec === "Intro" && b >= nb - 2 && song.arr.introTune) tune(0.5);
    if (sec === "Intro" && b === nb - 2) K.riser(t0, 8 * beat - 0.02, drumsIn, 0.6);
    if (sec === "Outro" && b < 2) { tune(0.5); if (b === 0) K.crash(t0, drumsIn, 0.6); }
    return;
  }
  // drums
  const breathe = lastBar && !st.perc && !(next === "Hook");                                   // the last bar before a change drops out for a beat (let it breathe)
  [...song.drums.kick].forEach((x, s) => { if (x === "x" && !(breathe && s >= 12) && !(intoHook && lastBar && s >= 8)) K.kick(T(s), drumsIn, o.kit, vel(1)); });
  const snareHit = (t, v = 1) => st.snareSound === "clap" ? K.clap(t, drumsIn, v) : st.snareSound === "rim" ? K.rim(t, drumsIn, v) : K.snare(t, drumsIn, o.kit, v);
  [...song.drums.snare].forEach((x, s) => {
    if (x !== "x") return;
    if (intoHook && lastBar && s >= 8) return;
    snareHit(T(s) + hum(), vel(1)); if (hook && st.snareSound !== "clap") K.clap(T(s), drumsIn, 0.4); if (hook && st.snareSound === "clap" && s === 12) K.snare(T(s), drumsIn, "hard", 0.35);
  });
  if (intoHook && lastBar) for (let k = 0; k < 8; k++) snareHit(T(8) + k * step, 0.45 + k * 0.07);          // snare roll into the hook
  if (intoHook && b === nb - 2) K.riser(t0, 8 * beat - 0.02, drumsIn, 0.5);
  if (hook && b === 0) K.crash(t0, drumsIn, 0.8);
  const roll = song.drums.rolls && bar % 2 === 1 && !intoHook && rs() < 0.4 + energy * 0.5, rollN = rs() < 0.5 ? 6 : 8;   // hat roll at the end of every other bar
  const hatV = breakdown ? 0.6 : 1;
  [...song.drums.hat].forEach((x, s) => {
    if (x !== "x") return;
    if (roll && s >= 12) { if (s === 12) for (let k = 0; k < rollN; k++) K.hat(T(12) + k * (4 * step / rollN), drumsIn, (0.5 + k * 0.06) * hatV); return; }
    if (st.hatSkip && s % 8 === 6 && rs() < 0.5) return;                                         // drill: skipped hat
    K.hat(T(s) + hum(), drumsIn, vel(s % 4 === 0 ? 0.9 : 0.6) * hatV);
    if (energy > 0.5 && ((hook && song.arr.doubleHats) || st.hatSkip) && s % 4 === 2 && rs() < (hook ? 0.9 : 0.4)) K.hat(T(s + 1), drumsIn, 0.45 * hatV);
    if (energy > 0.75 && hook && s === 10) for (let k = 1; k < 4; k++) K.hat(T(s) + k * step / 4, drumsIn, 0.35);
  });
  if (st.openHat && (hook || b % 4 === 3)) K.hat(T(14), drumsIn, 0.6, true);
  if (st.shaker) for (let s = 0; s < 16; s++) K.shaker(T(s) + hum(), drumsIn, (s % 2 ? 0.55 : 1) * (s % 4 === 2 ? 1.2 : 1) * (hook ? 1 : 0.8));
  if (st.perc) { for (const s of [3, 11]) K.perc(T(s), drumsIn, 0.8, false); if (hook || b % 2) for (const s of [7, 15]) K.perc(T(s) + hum(), drumsIn, 0.7, true); }
  // bass locks to the kick
  let hits = [...song.bassRhythm].map((x, s) => (x === "x" ? s : -1)).filter((s) => s >= 0);
  if (song.bassMode === "half") hits = hits.filter((s, i) => i === 0 || (s >= 8 && hits[i - 1] < 8));                 // one note per half bar
  else if (song.bassMode === "synco") hits = [...new Set([hits[0], 6, 11, 14].filter((s) => s >= 0))].sort((a, b) => a - b);  // off-beat line
  else if (song.bassMode === "walk") hits = [...new Set(hits.concat(b % 2 ? [10, 14] : [12]))].sort((a, b) => a - b);
  const slideHit = st.slides && hits.length > 1 && rs() < (o.style === "drill" ? 0.6 : 0.3) ? hits[1 + Math.floor(rs() * (hits.length - 1))] : -1;
  if (!breakdown) hits.forEach((s, i) => {
    if (intoHook && lastBar && s >= 8) return;
    const end = i + 1 < hits.length ? hits[i + 1] : 16, d = (end - s) * step;
    let m = ch.root; const fifth = ch.root + 7 > 43 ? ch.root - 5 : ch.root + 7;
    if ((o.bassSound === "log" || song.bassMode === "synco") && i % 2 === 1) m = fifth;                                    // bounce root / fifth
    if (song.bassMode === "walk" && s >= 10 && !song.bassRhythm.startsWith("x", s)) m = s === 14 ? nextCh.root + (nextCh.root > ch.root ? -1 : 1) : fifth;   // walk toward the next chord
    if (o.bassSound === "808") K.b808(T(s), m, d, bassIn, s === slideHit ? (rs() < 0.5 ? m - 5 : m + 7) : null, 1, st.slides || 0.12);
    else if (o.bassSound === "log") K.log(T(s), m, d, bassIn);
    else K.round(T(s), m, d, bassIn);
    if (o.bassSound === "808" && i === hits.length - 1 && end - s > 2 && lastBar && !intoHook) K.b808(T(14), nextCh.root, 2 * step, bassIn, ch.root, 1, st.slides || 0.12);   // slide into the next chord
    if (o.bassSound === "round" && i === hits.length - 1 && end - s > 3 && b % 2 === 0) K.round(T(14), ch.root + 7 > 43 ? ch.root - 5 : ch.root + 7, 2 * step, bassIn, 0.6);    // walk to the fifth
  });
  if (intoHook && lastBar && o.bassSound === "808") K.b808(T(8), nextCh.root, 8 * step, bassIn, ch.root - 5, 1, 0.5);   // long 808 slide into the hook
  // the tune: full in the hook (an octave up in its second half), every other phrase in the verse (room for the vocal)
  if (hook) tune(1, song.arr.octaveUp && b >= nb / 2 ? 12 : 0);
  else if (!breakdown && Math.floor(b / 4) % 2 === song.arr.versePhrase && o.verseMelody) tune(0.55);
}
// master, in plain JS on the stitched mix so every piece gets the same treatment:
// 1) loudness normalize (gated block RMS, like LUFS does) so a sparse R&B beat lands as loud as a busy trap beat,
// 2) glue compressor, 3) soft saturation, 4) lookahead limiter with headroom for intersample peaks (true peak stays under 0).
function master(L, R, total, sr) {
  const blk = Math.floor(sr * 0.1), blocks = [];
  for (let i = 0; i + blk <= total; i += blk) { let e = 0; for (let j = i; j < i + blk; j++) e += L[j] * L[j] + R[j] * R[j]; blocks.push(e / (2 * blk)); }
  const top = Math.max(1e-12, ...blocks), gate = top / 100; let sum = 0, n = 0;                // gate: ignore blocks 20 dB under the loudest
  for (const e of blocks) if (e >= gate) { sum += e; n++; }
  const rms = Math.sqrt(sum / Math.max(1, n)), g0 = 0.23 / Math.max(rms, 1e-6);               // about -13.5 dBFS RMS -> about -12 LUFS
  const th = 0.55, ratio = 2.5, aA = Math.exp(-1 / (sr * 0.008)), aR = Math.exp(-1 / (sr * 0.2)), k = Math.tanh(1.15);
  let env = 0, l, r, x, gr;
  for (let i = 0; i < total; i++) {
    l = L[i] * g0; r = R[i] * g0; x = Math.max(Math.abs(l), Math.abs(r));
    env = x > env ? aA * env + (1 - aA) * x : aR * env + (1 - aR) * x;
    gr = env > th ? (th + (env - th) / ratio) / env : 1;
    L[i] = Math.tanh(l * gr * 1.15) / k; R[i] = Math.tanh(r * gr * 1.15) / k;
  }
  // lookahead limiter: ceiling 0.72 (-2.9 dBFS) with a smooth 1.5 ms attack ramp (a gain step would ring past 0 dB on a phone's DAC)
  const ceil = 0.72, W = Math.floor(sr * 0.0015), rel = Math.exp(-1 / (sr * 0.06)), need = new Float32Array(total); let gmin = 1;
  const mid = (A, i) => i > 0 && i + 2 < total ? Math.abs((-A[i - 1] + 9 * A[i] + 9 * A[i + 1] - A[i + 2]) / 16) : 0;   // between-sample peak estimate (what the DAC will play)
  for (let i = 0; i < total; i++) { x = Math.max(Math.abs(L[i]), Math.abs(R[i]), mid(L, i), mid(R, i)); const nd = x > ceil ? ceil / x : 1; gmin = nd < gmin ? nd : 1 - (1 - gmin) * rel; need[i] = gmin; }
  const mn = new Float32Array(total), dq = new Int32Array(total); let h = 0, t = 0;          // running min over the next W samples (monotonic queue)
  for (let i = 0; i < total; i++) { while (t > h && need[dq[t - 1]] >= need[i]) t--; dq[t++] = i; if (dq[h] < i - W) h++; if (i >= W) mn[i - W] = need[dq[h]]; }
  for (let i = Math.max(0, total - W); i < total; i++) mn[i] = need[dq[h]];
  let acc = W; for (let i = 0; i < total; i++) { acc += mn[i] - (i >= W ? mn[i - W] : 1); const gm = acc / W; L[i] *= gm; R[i] *= gm; }   // mean over the last W = the ramp
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
  master(L, R, total, sr);
  const buf = new AudioBuffer({ length: total, numberOfChannels: 2, sampleRate: sr });
  buf.copyToChannel(L, 0); buf.copyToChannel(R, 1);
  return buf;
}

// ---------- the page ----------
export function mount(root, { getCtx, onUse, wav }) {
  const seed = () => Math.floor(Math.random() * 1e9);
  const o = { style: "trap", mood: "dark", key: 6, bpm: 140, swing: 0.5, energy: 0.6, kit: "hard", bassSound: "808", keysSound: "pad", leadSound: "bell", verseMelody: true, len: 1,
    seeds: { drums: seed(), bass: seed(), chords: seed(), melody: seed() }, drums: null, melody: null,
    vol: { drums: 1, bass: 0.5, keys: 1.7, melody: 1.8 }, mute: {} };   // chords + tune forward: phone speakers lose the low end
  let song = compose(o), buf = null, src = null;
  const $ = (s) => root.querySelector(s);
  root.innerHTML = `
    <p class="muted" style="margin:0 0 6px">1. Pick a style</p>
    <div class="chips" style="margin-top:0" id="blStyle"></div>
    <p class="muted" id="blTag" style="margin:6px 0 0"></p>
    <div class="row" style="margin-top:10px" id="blMood"></div>
    <label class="inline" style="margin-top:10px">Tempo <b id="blBpmV"></b><input type="range" id="blBpm" style="flex:1" aria-label="Tempo"></label>
    <label class="inline">Key <select id="blKey" aria-label="Key" style="font:inherit;background:var(--panel2);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:8px"></select></label>
    <label class="inline" style="margin-top:6px">Bounce <input type="range" id="blSwing" min="50" max="66" style="flex:1" aria-label="Bounce (swing)"></label>
    <label class="inline">Energy <input type="range" id="blEnergy" min="0" max="100" style="flex:1" aria-label="Energy"></label>
    <div class="row" style="margin-top:8px" id="blLen"></div>
    <p class="muted" style="margin:14px 0 6px">2. Roll the dice until you like it, then shape the parts</p>
    <div class="row"><button class="on" id="blNew">🎲 Make a new beat</button><button id="blPlay">▶ Hear it</button></div>
    <p class="muted" id="blMsg"></p>
    <div id="blParts"></div>
    <p class="muted" style="margin:14px 0 6px">3. Take it to the recorder</p>
    <div class="row"><button class="on" id="blUse">Use this beat → record over it</button><button id="blSave">Save beat (WAV)</button><button id="blStems">Save parts</button></div>
    <p class="muted">Made by Heartbeat's own beat engine: music-theory rules plus your choices. No AI model makes the track, the same way a drum machine works. Nobody else gets your exact beat unless you share it. Mixed for phone speakers; headphones hear the full bass.</p>`;
  const chip = (label, on, fn, title) => { const b = document.createElement("button"); b.textContent = label; if (on) b.className = "on"; if (title) b.title = title; b.onclick = fn; return b; };
  const setStyle = (k) => { o.style = k; roll(o, seed()); remake(); };
  function drawTop() {
    const st = STYLES[o.style];
    $("#blStyle").replaceChildren(...Object.entries(STYLES).map(([k, s]) => chip(s.name, o.style === k, () => setStyle(k), s.tag)));
    $("#blTag").textContent = st.tag + " " + st.bpm[0] + "-" + st.bpm[1] + " BPM.";
    $("#blMood").replaceChildren(chip("Dark (minor)", o.mood === "dark", () => { o.mood = "dark"; o.melody = null; remake(); }), chip("Bright (major)", o.mood === "bright", () => { o.mood = "bright"; o.melody = null; remake(); }));
    $("#blLen").replaceChildren(chip("Full song", o.len === 1, () => { o.len = 1; buf = null; drawTop(); msg(); }), chip("Short (half the bars)", o.len === 0.5, () => { o.len = 0.5; buf = null; drawTop(); msg(); }));
    Object.assign($("#blBpm"), { min: st.bpm[0], max: st.bpm[1], value: o.bpm }); $("#blBpmV").textContent = o.bpm + " BPM";
    $("#blKey").innerHTML = NOTE.map((n, i) => `<option value="${i}" ${i === o.key ? "selected" : ""}>${n}</option>`).join("");
    $("#blSwing").value = Math.round(o.swing * 100); $("#blEnergy").value = Math.round(o.energy * 100);
  }
  function msg() {
    const st = song.st, bars = plan(o, song), tot = bars.length * 4 * 60 / o.bpm, secs = [];
    for (const bd of bars) if (bd.b === 0) secs.push(bd.sec + " " + bd.nb);
    $("#blMsg").textContent = `${st.name} · ${o.bpm} BPM · ${NOTE[o.key]} ${o.mood === "dark" ? "minor" : "major"} · ${Math.floor(tot / 60)}:${String(Math.round(tot % 60)).padStart(2, "0")} · ` + secs.join(", ") + " bars";
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
    // drum grid: tap any step (label above each row so the 16 squares get the full width on a phone)
    const grid = document.createElement("div"); grid.style.cssText = "margin-top:8px";
    const snareName = song.st.snareSound === "clap" ? "clap" : song.st.snareSound === "rim" ? "rim" : "snare";
    for (const row of ["kick", "snare", "hat"]) {
      const lab = document.createElement("div"); lab.textContent = row === "snare" ? snareName : row; lab.className = "muted"; lab.style.cssText = "font-size:12px;margin:6px 0 2px;text-transform:capitalize"; grid.append(lab);
      const line = document.createElement("div"); line.style.cssText = "display:grid;grid-template-columns:repeat(16,1fr);gap:2px"; line.setAttribute("role", "group"); line.setAttribute("aria-label", row + " steps");
      [...song.drums[row]].forEach((x, s) => {
        const b = document.createElement("button"); b.setAttribute("aria-label", row + " step " + (s + 1)); b.setAttribute("aria-pressed", x === "x");
        b.style.cssText = `min-height:34px;padding:0;border-radius:6px;${s % 4 === 0 && s ? "margin-left:4px;" : ""}background:${x === "x" ? "var(--accent)" : s % 4 === 0 ? "#3a2f24" : "#2b221a"}`;
        b.onclick = () => { const a = [...song.drums[row]]; a[s] = a[s] === "x" ? "." : "x"; song.drums[row] = a.join(""); o.drums = { ...song.drums }; if (row === "kick") song.bassRhythm = song.drums.kick; buf = null; drawParts(); };
        line.append(b);
      });
      grid.append(line);
    }
    part("drums", "Drums", "Tap squares to add or remove hits (4 squares = 1 beat). The bass follows the kick. Fills and rolls are added by the rules.", [["hard", "Hard"], ["dusty", "Dusty"], ["soft", "Soft"], ["boom", "Boomy"]], o.kit, (v) => (o.kit = v),
      () => { o.seeds.drums = seed(); o.drums = null; remake(); }, grid);
    part("bass", "Bass", `Plays the root of each chord: ${ch.map((c) => nn(c.root)).join(" · ")}` + ({ half: " (one long note per half bar)", synco: " (off-beat line, root and fifth)", walk: " (walks to the next chord)" }[song.bassMode] || " (locked to the kick)") + (o.bassSound === "808" ? ". Slides into the hook." : o.bassSound === "log" ? ". Bounces root and fifth." : ""), [["808", "808 (slides)"], ["round", "Round bass"], ["log", "Log drum"]], o.bassSound, (v) => (o.bassSound = v),
      () => { o.seeds.bass = seed(); remake(); });
    part("keys", "Chords", `${ch.map((c) => c.name).join(" → ")} &nbsp;(${ch.map((c) => c.roman).join(" – ")} in ${NOTE[o.key]} ${o.mood === "dark" ? "minor" : "major"})`, [["pad", "Warm pad"], ["keys", "Electric piano"], ["pluck", "Plucked"]], o.keysSound, (v) => (o.keysSound = v),
      () => { o.seeds.chords = seed(); o.melody = null; remake(); });
    const notes = song.motif.map((n) => nn(n.m)).join(" ");
    const vt = document.createElement("label"); vt.className = "inline"; vt.style.marginTop = "8px"; vt.innerHTML = `<input type="checkbox" ${o.verseMelody ? "checked" : ""}> Melody in the verses too (off = more room to rap)`;
    vt.querySelector("input").onchange = (e) => { o.verseMelody = e.target.checked; buf = null; };
    part("melody", "Melody", `The tune (4 bars): ${notes}. Full in the hook, an octave up in its second half, with a soft echo.`, [["bell", "Bell"], ["keys", "Electric piano"], ["pluck", "Pluck"], ["dark", "Dark synth"]], o.leadSound, (v) => (o.leadSound = v),
      () => { o.seeds.melody = seed(); o.melody = null; remake(); }, vt);
    msg();
  }
  function remake() { stopPrev(); song = compose(o); if (o.drums) song.drums = o.drums; buf = null; drawTop(); drawParts(); }
  function stopPrev() { if (src) { try { src.stop(); } catch (e) {} src = null; $("#blPlay").textContent = "▶ Hear it"; } }
  async function build() {
    if (buf) return buf; const m = $("#blMsg"); m.textContent = "Building your beat… 0%";
    buf = await render(o, song, null, (p) => { m.textContent = "Building your beat… " + Math.round(p * 100) + "%"; }); drawParts(); return buf;
  }
  $("#blBpm").oninput = (e) => { o.bpm = +e.target.value; $("#blBpmV").textContent = o.bpm + " BPM"; buf = null; msg(); };
  $("#blKey").onchange = (e) => { o.key = +e.target.value; o.melody = null; remake(); };
  $("#blSwing").oninput = (e) => { o.swing = e.target.value / 100; buf = null; };
  $("#blEnergy").oninput = (e) => { o.energy = e.target.value / 100; buf = null; };
  $("#blNew").onclick = () => { roll(o, seed()); remake(); };
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
