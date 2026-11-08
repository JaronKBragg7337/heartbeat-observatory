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
  // Rock + Country (11/7, tuned by Claude after Terra's first pass): a live drum kit, two guitar takes panned left and right,
  // rock = palm-muted verse chugs that open up in the hook, bass on driving eighths; country = boom-chick (bass on 1 and 3,
  // root then fifth, walk-ups into the next chord), cross-stick verse, full snare hook, a light eighth-note shuffle.
  rock: { hats: ["x.x.x.x.x.x.x.x."], kits: ["live"], bassPool: ["round"], keysPool: ["pad"], leadPool: ["guitar"], bassModes: ["eighths"], name: "Rock", tag: "A big live backbeat, two distorted guitars: palm-muted verses, open power chords in the hook.", bpm: [90, 150, 120], swing: 0.5, bars: [4, 16, 8, 16, 8, 4], sevenths: false,
    kick: ["x.......x.......", "x.......x.x.....", "x.....x.x.......", "x.......x.....x."], snare: ["....x.......x...", "....x.......x..x"], hat: "x.x.x.x.x.x.x.x.", melRhythm: [[0, 4, 8, 12], [0, 6, 8, 12], [0, 3, 6, 8, 12]], bass: "round", keys: "pad", lead: "guitar", kit: "live", snareSound: "snare", rolls: false, slides: 0, mood: "bright", moodFree: false, keysRhythm: "stabs", live: true },
  country: { hats: ["x.x.x.x.x.x.x.x."], kits: ["live"], bassPool: ["round"], keysPool: ["pad"], leadPool: ["guitar"], bassModes: ["boom"], name: "Country", tag: "Boom-chick bass, a light shuffle and two strummed acoustic guitars.", bpm: [85, 145, 110], swing: 0.56, bars: [4, 16, 8, 16, 8, 4], sevenths: false,
    kick: ["x.......x.......", "x.......x.....x."], snare: ["....x.......x..."], hat: "x.x.x.x.x.x.x.x.", melRhythm: [[0, 4, 8, 12], [0, 6, 8, 14], [2, 6, 8, 12]], bass: "round", keys: "pad", lead: "guitar", kit: "live", snareSound: "snare", rolls: false, slides: 0, mood: "bright", moodFree: false, keysRhythm: "stabs", live: true, swing8: true },
};
// ---------- guitar: real chord shapes, the way a player holds them ----------
// Open shapes (low E string first, -1 = not played). A country player capos so most chords are open shapes; the rest are barre shapes.
const STD_TUNING = [40, 45, 50, 55, 59, 64], NASHVILLE = [52, 57, 62, 67, 59, 64];   // Nashville = the low four strings an octave up (the classic second acoustic)
const OPEN_SHAPES = { "0": [-1, 3, 2, 0, 1, 0], "2": [-1, -1, 0, 2, 3, 2], "4": [0, 2, 2, 1, 0, 0], "7": [3, 2, 0, 0, 3, 3], "9": [-1, 0, 2, 2, 2, 0], "9m": [-1, 0, 2, 2, 1, 0], "4m": [0, 2, 2, 0, 0, 0], "2m": [-1, -1, 0, 2, 3, 1] };
function barreShape(rel, q) {        // rel = the chord's pitch class counted from the capo
  const fe = (rel + 8) % 12, fa = (rel + 3) % 12, e = fe <= fa, f = e ? fe : fa;
  if (q === "dim") return e ? [f, f + 1, f + 2, f, -1, -1] : [-1, f, f + 1, f + 2, f + 1, -1];
  if (q === "m") return e ? [f, f + 2, f + 2, f, f, f] : [-1, f, f + 2, f + 2, f + 1, f];
  return e ? [f, f + 2, f + 2, f + 1, f, f] : [-1, f, f + 2, f + 2, f + 2, f];
}
function guitarVoicing(chords) {
  const openKey = (ch, capo) => { const rel = (ch.pc - capo + 12) % 12; return ch.q === "dim" ? null : OPEN_SHAPES[rel + (ch.q === "m" ? "m" : "")]; };
  let capo = 0, best = -1e9;
  for (let c = 0; c <= 7; c++) { let s = -0.35 * c; for (const ch of chords) { const rel = (ch.pc - c + 12) % 12; s += openKey(ch, c) ? 2 : Math.min((rel + 8) % 12, (rel + 3) % 12) <= 5 ? 0 : -1; } if (s > best) { best = s; capo = c; } }
  let prev = null;
  return { capo, chords: chords.map((ch) => {
    const frets = openKey(ch, capo) || barreShape((ch.pc - capo + 12) % 12, ch.q);
    let pr = 40 + ((ch.pc + 8) % 12); if (prev != null && pr + 12 <= 55 && Math.abs(pr + 12 - prev) < Math.abs(pr - prev)) pr += 12; prev = pr;   // power chord root: low E or A string, the shortest move
    return { frets, power: pr };
  }) };
}
// Karplus-Strong string with the parts a plain one lacks: a softened pick burst, a pick-position comb (where the pick hits the
// string shapes the tone), an allpass for exact tuning, a decay time per string, and extra damping for palm mutes.
export function pluckString(sr, m, p, seed) {
  const f = hz(m), N = sr / f, S = p.S, md = p.mute || 0, extra = md ? md / (1 - md) : 0;
  const L = Math.max(2, Math.floor(N - S - extra - 0.1)), D = N - S - extra - L, eta = (1 - D) / (1 + D);
  const r = rng(seed), ex = new Float32Array(L), buf = new Float32Array(L);
  let lp = 0; for (let i = 0; i < L; i++) { lp = lp * p.soft + (r() * 2 - 1) * (1 - p.soft); ex[i] = lp; }
  const P = Math.max(1, Math.round(L * p.pick)); let mean = 0, e = 0;
  for (let i = 0; i < L; i++) { buf[i] = ex[i] - 0.92 * ex[(i - P + L) % L]; mean += buf[i]; }
  mean /= L; for (let i = 0; i < L; i++) { buf[i] -= mean; e += buf[i] * buf[i]; }
  const norm = 0.5 / Math.sqrt(e / L + 1e-12); for (let i = 0; i < L; i++) buf[i] *= norm;
  const t60 = typeof p.t60 === "function" ? p.t60(m) : p.t60, g = Math.pow(10, -3 / (t60 * f));
  const len = Math.ceil(p.len * sr), out = new Float32Array(len); let k = 0, xp = 0, ax = 0, ay = 0, ml = 0;
  for (let n = 0; n < len; n++) {
    const x = buf[k]; out[n] = x;
    const lf = (1 - S) * x + S * xp; xp = x;
    const ap = eta * lf + ax - eta * ay; ax = lf; ay = ap;
    let y = ap * g; if (md) { ml = md * ml + (1 - md) * y; y = ml; }
    buf[k] = y; if (++k === L) k = 0;
  }
  const fl = Math.min(len, Math.floor(sr * 0.02)); for (let n = 0; n < fl; n++) out[len - 1 - n] *= n / fl;
  return out;
}
const STRING_TYPES = {
  a: { soft: 0.3, pick: 0.14, S: 0.42, len: 2.6, t60: (m) => 1.6 + 2.4 * Math.max(0, Math.min(1, (70 - m) / 30)) },   // steel acoustic, flat pick
  f: { soft: 0.45, pick: 0.21, S: 0.45, len: 2.6, t60: (m) => 1.8 + 2.4 * Math.max(0, Math.min(1, (70 - m) / 30)) },  // fingers
  q: { soft: 0.42, pick: 0.14, S: 0.5, len: 0.36, t60: 0.3, mute: 0.5 },                                              // acoustic palm mute
  e: { soft: 0.5, pick: 0.2, S: 0.4, len: 2.6, t60: (m) => 3 + 2 * Math.max(0, Math.min(1, (70 - m) / 30)) },     // electric, bridge pickup
  t: { soft: 0.22, pick: 0.11, S: 0.3, len: 2.6, t60: (m) => 2 + 1.5 * Math.max(0, Math.min(1, (80 - m) / 30)) },    // clean lead, bright "twang"
  p: { soft: 0.55, pick: 0.2, S: 0.5, len: 0.4, t60: 0.32, mute: 0.55 },                                              // electric palm mute
};
let GTR_CACHE = null, GTR_USERS = 0;   // one render's string recordings, reused across its 4-bar pieces (a strum reuses the same few strings)
function stringBuffer(type, m, variant) {
  const k = type + m + "." + variant; let b = GTR_CACHE.get(k); if (b) return b;
  const data = pluckString(44100, m, STRING_TYPES[type], (m * 7919 + variant * 104729 + type.charCodeAt(0) * 15485863) >>> 0);
  b = new AudioBuffer({ length: data.length, numberOfChannels: 1, sampleRate: 44100 }); b.copyToChannel(data, 0); GTR_CACHE.set(k, b); return b;
}
const SECTIONS = ["Intro", "Verse", "Hook", "Verse", "Hook", "Outro"];

// ---------- the rules: turn choices into notes ----------
export function compose(o) {
  const st = STYLES[o.style], sc = SCALE[o.mood], key = 48 + o.key;
  const rd = rng(o.seeds.drums), rc = rng(o.seeds.chords), rm = rng(o.seeds.melody);
  // A chosen guitar progression drives the whole band so bass, keys and guitar agree.
  // Recipes without guitar retain the original seeded progression and random sequence.
  const seededProg = pick(rc, PROGS[o.mood]);
  const guitarProgs = { oneFourFive: [0, 3, 4, 4], oneFiveSixFour: [0, 4, 5, 3] };
  const prog = o.guitarOn && guitarProgs[o.guitarProgression] ? guitarProgs[o.guitarProgression] : seededProg;
  const deg = (d, oct = 0) => key + 12 * (oct + Math.floor(d / 7)) + sc[((d % 7) + 7) % 7];
  const chords = prog.map((d) => {
    const tones = [d, d + 2, d + 4].concat(st.sevenths ? [d + 6] : []).map((x) => deg(x, 1));
    const third = (sc[(d + 2) % 7] - sc[d % 7] + 12) % 12, fifth = (sc[(d + 4) % 7] - sc[d % 7] + 12) % 12;
    const q = third === 3 ? (fifth === 6 ? "dim" : "m") : "";
    let root = deg(d, -1); while (root > 40) root -= 12; while (root < 28) root += 12;
    return { d, root, tones, pc: deg(d) % 12, q, name: NOTE[deg(d) % 12] + q, roman: q ? ROMAN[d].toLowerCase() + (q === "dim" ? "°" : "") : ROMAN[d] };
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
  const drums = o.drums || { kick: pick(rd, st.kick), snare: pick(rd, st.snare), hat: pick(rd, (st.hats || [st.hat]).concat(o.style !== "rock" && o.style !== "country" && rd() < 0.3 ? HATS_COMMON : [])), rolls: !!st.rolls };
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
  return { st, chords, drums, motif, bassRhythm, rhythm, shape, bassMode, arr, slideSeed: o.seeds.bass, gtr: guitarVoicing(chords) };
}
// What picking a style sets up (the page and the test renders share this).
export function styleDefaults(o, k) {
  if (k === "rock" || k === "country") {
    o.guitarOn = true; o.guitarSound = k === "rock" ? "electric" : "acoustic";
    o.guitarPattern = k === "rock" ? "riff" : "strum";
    o.guitarProgression = k === "rock" ? "oneFiveSixFour" : "oneFourFive";
    o.brushSnare = false;
  } else o.brushSnare = false;
  return o;
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
function kitFor(c, rnd) {   // rnd = seeded, so the same recipe renders the same samples every time

  const noise = c.createBuffer(1, c.sampleRate, c.sampleRate), d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
  const panTo = (node, out, pan) => { if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(out); } else node.connect(out); };
  // filtered noise burst: the base of every drum's "snap"
  const ns = (t, dur, type, f, q, g, out, pan = 0, f2 = null) => {
    const s = c.createBufferSource(); s.buffer = noise; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const a = c.createGain(); a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(a); panTo(a, out, pan); s.start(t, rnd() * 0.5); s.stop(t + dur + 0.02);
  };
  const env = (p, t, peak, a, dec) => { p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a); p.exponentialRampToValueAtTime(0.0001, t + a + dec); };
  const tone = (t, type, f0, f1, sweep, peak, dec, out, pan = 0) => {   // one pitched hit with a pitch drop
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + sweep);
    env(g.gain, t, peak, 0.002, dec); o.connect(g); panTo(g, out, pan); o.start(t); o.stop(t + dec + 0.05);
  };
  return {
    kick(t, out, kit, v = 1) {
      // body (sub sweep) + knock (mid tone that a phone can play) + click
      if (kit === "live") {          // a miked rock/country kick: short round body, a knock and the beater click, no long 808 tail
        tone(t, "sine", 125, 54, 0.045, v * 0.95, 0.24, out);
        tone(t, "triangle", 210, 105, 0.025, v * 0.3, 0.05, out);
        ns(t, 0.012, "bandpass", 3200, 0.8, 0.5 * v, out); ns(t, 0.03, "lowpass", 600, 0.7, 0.25 * v, out);
        return;
      }
      const soft = kit === "soft", boom = kit === "boom";
      tone(t, "sine", soft ? 130 : 185, soft ? 44 : 50, soft ? 0.09 : 0.055, v * (soft ? 0.75 : 1), boom ? 0.55 : soft ? 0.3 : 0.26, out);
      tone(t, "triangle", soft ? 160 : 240, soft ? 85 : 95, 0.03, v * (soft ? 0.18 : 0.38), soft ? 0.05 : 0.07, out);
      if (!soft) ns(t, 0.018, "highpass", 2600, 0.7, 0.45 * v, out);
      if (kit === "dusty") ns(t, 0.06, "lowpass", 900, 0.7, 0.3 * v, out);
    },
    snare(t, out, kit, v = 1) {
      if (kit === "live") {          // shell tone + a longer bed of snare wires + the stick crack
        tone(t, "triangle", 235, 185, 0.03, 0.55 * v, 0.11, out); tone(t, "sine", 345, 330, 0.01, 0.2 * v, 0.07, out);
        ns(t, 0.24, "bandpass", 2600, 0.45, 0.8 * v, out); ns(t, 0.09, "highpass", 5000, 0.7, 0.4 * v, out); ns(t, 0.012, "bandpass", 1200, 1, 0.5 * v, out);
        return;
      }
      const dusty = kit === "dusty", soft = kit === "soft";
      ns(t, dusty ? 0.2 : soft ? 0.14 : 0.16, "bandpass", dusty ? 1300 : 1900, 0.6, (soft ? 0.6 : 0.85) * v, out);     // body noise
      ns(t, 0.07, "highpass", soft ? 4500 : 3800, 0.7, (soft ? 0.35 : 0.6) * v, out);                                  // snap (phone hears this)
      tone(t, "triangle", 196, 165, 0.04, (soft ? 0.3 : 0.45) * v, 0.08, out);                                          // drum tone
      if (!soft) tone(t, "sine", 330, 330, 0.01, 0.12 * v, 0.05, out);
    },
    brush(t, out, v = 1) {
      ns(t, 0.15, "bandpass", 2400, 0.5, 0.42 * v, out);
      ns(t + 0.025, 0.12, "highpass", 4500, 0.7, 0.18 * v, out);
    },
    clap(t, out, v = 1) {
      for (const [i, d] of [0, 0.009, 0.019, 0.03].entries()) ns(t + d, i === 3 ? 0.2 : 0.018, "bandpass", 1150, 0.9, (i === 3 ? 0.8 : 0.5) * v, out);
      ns(t + 0.03, 0.09, "highpass", 3200, 0.7, 0.5 * v, out);
    },
    hat(t, out, v = 1, open = false, pan = 0.18) { ns(t, open ? 0.26 : 0.045, "bandpass", 9000, 0.9, (open ? 0.6 : 0.8) * v, out, pan); ns(t, open ? 0.2 : 0.025, "highpass", 6500, 0.7, 0.4 * v, out, pan); },
    shaker(t, out, v = 1) { ns(t, 0.05, "bandpass", 5200, 1.1, 0.42 * v, out, -0.3, 4200); },
    rim(t, out, v = 1) { tone(t, "sine", 520, 480, 0.01, 0.45 * v, 0.035, out, -0.15); tone(t, "triangle", 1700, 1700, 0.01, 0.2 * v, 0.02, out, -0.15); ns(t, 0.025, "bandpass", 3200, 1, 0.3 * v, out, -0.15); },
    perc(t, out, v = 1, hi = false) { tone(t, "sine", hi ? 420 : 260, hi ? 300 : 170, 0.06, 0.4 * v, 0.12, out, hi ? 0.35 : -0.35); ns(t, 0.015, "highpass", 2000, 0.7, 0.15 * v, out, hi ? 0.35 : -0.35); },
    tom(t, out, f, v = 1) { tone(t, "sine", f * 1.5, f, 0.06, 0.7 * v, 0.3, out, f > 120 ? 0.2 : -0.2); ns(t, 0.02, "lowpass", 1500, 0.7, 0.2 * v, out); },
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
// ---------- guitar rig: takes -> body or amp -> pan -> guitar bus (+ a small room) ----------
const biq = (c, type, f, q, gain) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (gain != null) b.gain.value = gain; return b; };
const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
function guitarRig(c, o, only, master, verb) {
  const r = rng(0x6a17e5), sr = c.sampleRate, electric = o.guitarSound === "electric", pat = o.guitarPattern || "strum", clean = pat === "pick";
  const bus = c.createGain(); bus.gain.value = only && only !== "guitar" ? 0 : (o.mute.guitar ? 0 : (o.vol.guitar == null ? 1 : o.vol.guitar)); bus.connect(master);
  const send = c.createGain(); send.gain.value = clean ? 0.3 : electric ? 0.09 : 0.12; bus.connect(send); send.connect(verb);
  // two short reflections (left 11 ms, right 17 ms, darkened): a touch of room so the two takes sound like one band in one space
  const er = c.createGain(); er.gain.value = 0.16; const erf = biq(c, "lowpass", 3500, 0.7); bus.connect(erf); erf.connect(er);
  [[0.011, -0.6], [0.017, 0.6]].forEach(([t, pn]) => { const dl = c.createDelay(0.05); dl.delayTime.value = t; er.connect(dl); if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pn; dl.connect(p); p.connect(master); } else dl.connect(master); });
  // acoustic body: the wood and the air inside the box ring at a few low frequencies (modal impulse response)
  let bodyIR = null;
  if (!electric) {
    const bn = Math.floor(sr * 0.12); bodyIR = c.createBuffer(1, bn, sr); const d = bodyIR.getChannelData(0); let e = 0;
    const modes = [[102, 0.05, 1], [196, 0.04, 0.8], [285, 0.03, 0.45], [410, 0.022, 0.35], [580, 0.016, 0.3], [860, 0.01, 0.25], [1250, 0.007, 0.2], [2100, 0.004, 0.15]];
    for (let i = 0; i < bn; i++) { const t = i / sr; let x = (r() * 2 - 1) * 0.4 * Math.exp(-t / 0.004); for (const [f, tau, a] of modes) x += a * Math.exp(-t / tau) * Math.sin(2 * Math.PI * f * t); d[i] = x; e += x * x; }
    const k = 1 / Math.sqrt(e); for (let i = 0; i < bn; i++) d[i] *= k;
  }
  // amp: tighten the lows, push the mids, then clip (asymmetric, like a tube); speaker cab = steep roll-off above 5 kHz with a mid bump
  const curve = new Float32Array(2048); let cm = 0;
  for (let i = 0; i < curve.length; i++) { const x = i / 1023.5 - 1; curve[i] = clean ? Math.tanh(1.6 * x) : Math.tanh(5 * (x + 0.1)) - Math.tanh(0.5); cm = Math.max(cm, Math.abs(curve[i])); }
  for (let i = 0; i < curve.length; i++) curve[i] /= cm;
  const n = clean ? 1 : 2, takes = [];
  for (let i = 0; i < n; i++) {
    const inp = c.createGain(), out = c.createGain(); let last;
    if (electric) {
      const pre = chain(inp, biq(c, "highpass", clean ? 80 : 90, 0.7), biq(c, "peaking", 400, 0.7, clean ? 0 : 3), biq(c, "lowpass", clean ? 6500 : 3400, 0.7));
      const drv = c.createGain(); drv.gain.value = clean ? 0.9 : 2.4; const sh = c.createWaveShaper(); sh.curve = curve; sh.oversample = "4x"; pre.connect(drv); drv.connect(sh);
      last = chain(sh, biq(c, "highpass", 70, 0.7), biq(c, "lowshelf", 160, 0.7, 6), biq(c, "peaking", 300, 0.8, 4), biq(c, "peaking", 1700, 0.9, i ? 1 : 2), biq(c, "highshelf", 2600, 0.7, -5),
        biq(c, "lowpass", i ? 3900 : 4500, 0.8), biq(c, "lowpass", i ? 4800 : 5400, 0.6), out);
      out.gain.value = clean ? 0.9 : 0.21;
    } else {
      const hp = biq(c, "highpass", clean ? 150 : 75, 0.7), dry = c.createGain(), body = c.createConvolver(), bg = c.createGain(), sum = c.createGain();
      dry.gain.value = 0.6; body.normalize = false; body.buffer = bodyIR; bg.gain.value = 0.85;
      inp.connect(hp); hp.connect(dry); dry.connect(sum); hp.connect(body); body.connect(bg); bg.connect(sum);
      last = chain(sum, biq(c, "peaking", 470, 1.1, -3), biq(c, "peaking", 2900, 0.9, 2.5), biq(c, "highshelf", 7500, 0.7, -4.5), out);
      out.gain.value = 3.5;
    }
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = n === 1 ? 0.1 : i ? 0.8 : -0.8; last.connect(p); p.connect(bus); } else last.connect(bus);
    takes.push(inp);
  }
  const nb = c.createBuffer(1, Math.floor(sr * 0.05), sr), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;
  return { takes, electric, clean, pat,
    play(take, buf, t, end, v, rate = 1) {          // one string: rings until the player stops it (next stroke on that string, or the chord change)
      const s = c.createBufferSource(), g = c.createGain(); s.buffer = buf; if (rate !== 1) s.playbackRate.value = rate;
      const natural = t + buf.duration / rate; g.gain.setValueAtTime(v, t);
      if (end + 0.04 < natural) { g.gain.setValueAtTime(v, Math.max(t, end)); g.gain.linearRampToValueAtTime(0, Math.max(t, end) + 0.04); }
      s.connect(g); g.connect(takes[take]); s.start(t); s.stop(Math.min(natural, Math.max(t, end) + 0.05));
    },
    click(take, t, dur, v) {                       // the pick scraping across the strings
      const s = c.createBufferSource(), f = biq(c, "bandpass", 3600, 0.7), g = c.createGain(); s.buffer = nb;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(takes[take]); s.start(t); s.stop(t + dur + 0.01);
    } };
}
// Lead guitar for the tune: overdriven with vibrato and a bend into phrase starts (rock), or clean and twangy (country and the rest).
function leadRig(c, o, out) {
  const drive = o.style === "rock" || (o.guitarOn && o.guitarSound === "electric" && o.guitarPattern !== "pick");
  const curve = new Float32Array(2048); let cm = 0;
  for (let i = 0; i < curve.length; i++) { const x = i / 1023.5 - 1; curve[i] = drive ? Math.tanh(4 * (x + 0.05)) - Math.tanh(0.2) : Math.tanh(1.8 * x); cm = Math.max(cm, Math.abs(curve[i])); }
  for (let i = 0; i < curve.length; i++) curve[i] /= cm;
  const inp = c.createGain(), drv = c.createGain(), sh = c.createWaveShaper(), g = c.createGain(); drv.gain.value = drive ? 2 : 1; sh.curve = curve; sh.oversample = "4x";
  chain(inp, biq(c, "highpass", 180, 0.7), biq(c, "peaking", drive ? 900 : 1300, 0.8, drive ? 5 : 3), biq(c, "lowpass", drive ? 4000 : 7500, 0.7), drv, sh);
  chain(sh, biq(c, "highpass", 120, 0.7), biq(c, "peaking", 2200, 1, 2), biq(c, "lowpass", drive ? 5000 : 7500, 0.8), biq(c, "lowpass", drive ? 6000 : 9000, 0.6), g, out);
  g.gain.value = drive ? 0.045 : 0.19;
  return { play(t, m, dur, v, bend) {
    while (m > 84) m -= 12;
    const b = stringBuffer(drive ? "e" : "t", m, Math.round(t * 1000) % 2), s = c.createBufferSource(), a = c.createGain(); s.buffer = b;
    const end = Math.min(t + b.duration, t + dur + 0.08);
    if (bend && drive) { s.playbackRate.setValueAtTime(0.8909, t); s.playbackRate.linearRampToValueAtTime(1, t + 0.09); }   // a whole-step bend up into the note
    if (dur > 0.3) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(drive ? 0.006 : 0.003, t + Math.min(0.4, dur)); l.connect(lg); lg.connect(s.playbackRate); l.start(t); l.stop(end + 0.05); }
    a.gain.setValueAtTime(v * 0.5, t); a.gain.setValueAtTime(v * 0.5, end); a.gain.linearRampToValueAtTime(0, end + 0.05);
    s.connect(a); a.connect(inp); s.start(t); s.stop(end + 0.06);
  } };
}
// One bar of guitar, played like a session player: pattern per section, real strum timing, strings damped by the next stroke.
function guitarBar(o, song, G, bd, t0, T) {
  const { bar, sec, b, nb, nth, next } = bd, R = G.gtr, beat = 60 / o.bpm, step = beat / 4, barEnd = t0 + 16 * step;
  const gv = song.gtr.chords[bar % 4], capo = song.gtr.capo, r = rng(((song.slideSeed ^ 0x51ed27) + bar * 104729) >>> 0);
  const hook = sec === "Hook", verse = sec === "Verse", intro = sec === "Intro", outro = sec === "Outro";
  const lastBar = b === nb - 1, intoHook = next === "Hook" && lastBar, breakdown = verse && nth === 2 && b < 4, finalBar = outro && lastBar;
  const pat = R.pat, electric = R.electric, power = electric && pat !== "pick";
  const lvl = hook ? 1 : intro ? 0.72 : outro ? 0.85 * (1 - 0.5 * b / nb) : 0.8;
  const S = [], add = (s, k, v, x) => S.push({ s, k, v, x });
  const eighths = (k, vOn, vOff) => { for (let s = 0; s < 16; s += 2) add(s, s % 4 ? (k === "D" ? "U" : k) : k === "U" ? "D" : k, s % 4 ? vOff : s % 8 ? vOn * 0.88 : vOn); };
  if (finalBar || (breakdown && pat !== "pick")) add(0, "R", 0.9);
  else if (pat === "pick") { const seq = [0, -3, -2, -1, 1, -2, -1, -3]; seq.forEach((x, i) => add(i * 2, "P", i === 0 ? 1 : i === 4 ? 0.85 : 0.68, x)); if (hook) add(15, "P", 0.5, -1); }
  else if (pat === "boom") { add(0, "B", 0.95); add(4, "d", 0.8); add(6, "U", 0.5); add(8, "A", 0.9); add(12, "d", 0.8); add(14, "U", 0.5); if (hook) add(10, "U", 0.45); }
  else if (pat === "riff") {
    if (intro) { add(0, "R", 0.95); if (lastBar) for (const s of [8, 10, 12, 14]) add(s, "M", 0.8); }
    else if (hook) for (let s = 0; s < 16; s += 2) add(s, "D", s % 4 ? 0.82 : 1);
    else if (intoHook) { add(0, "D", 0.95); for (const s of [2, 4, 6]) add(s, "M", 0.8); for (const s of [8, 10, 12, 14]) add(s, "D", 0.92 + s / 160); }
    else { add(0, "D", 1); for (let s = 2; s < 16; s += 2) if (!(b % 2 && s >= 12)) add(s, "M", s === 8 ? 0.9 : 0.74); if (b % 2) { add(12, "D", 0.9); add(14, "D", 0.9); } }
  } else if (pat === "steady") {
    if (hook || intoHook) for (let s = 0; s < 16; s += 2) add(s, "D", s % 4 ? 0.7 : 1);
    else for (const s of [0, 4, 8, 12]) add(s, "D", s ? 0.82 : 1);
  } else {                                                                                     // down and up
    if (hook) eighths("D", 1, 0.58);
    else if (intoHook) for (const s of [0, 4, 8, 10, 12, 14]) add(s, "D", 0.85 + s / 100);
    else { add(0, "D", 1); add(4, "D", 0.78); add(6, "U", 0.55); add(10, "U", 0.6); add(12, "D", 0.8); add(14, "U", 0.55); }
  }
  // the strings each stroke hits
  const shape = (tun) => power ? [gv.power, gv.power + 7, gv.power + 12] : gv.frets.map((f, i) => (f < 0 ? null : tun[i] + capo + f));
  const strike = (k, x, tun) => {
    const sh = shape(tun), idx = sh.map((m, i) => (m == null ? -1 : i)).filter((i) => i >= 0), at = (j) => idx[j < 0 ? idx.length + j : Math.min(j, idx.length - 1)];
    if (k === "D" || k === "R") return idx.map((i) => [i, sh[i]]);
    if (k === "d") return idx.slice(-4).map((i) => [i, sh[i]]);
    if (k === "U") return idx.slice(power ? -2 : -3).reverse().map((i) => [i, sh[i]]);
    if (k === "M") return idx.slice(0, power ? 2 : 4).map((i) => [i, sh[i]]);
    if (k === "B") return [[idx[0], sh[idx[0]]]];
    if (k === "A") { const root = sh[idx[0]], lo = idx[0] > 0 && root - 5 >= tun[0] + capo; return [[lo ? idx[0] - 1 : idx[0] + 1, lo ? root - 5 : root + 7]]; }
    const i = at(x); return [[i, sh[i]]];
  };
  const nash = o.style === "country" && !electric && (pat === "strum" || pat === "steady" || pat === "riff");
  for (let take = 0; take < R.takes.length; take++) {
    const tun = take && nash ? NASHVILLE : STD_TUNING, rate = take ? 1.00173 : 1, ev = [];
    for (const st of S) {
      if (take && (st.k === "B" || st.k === "A")) continue;                                   // the second guitar only strums
      const v = st.v * lvl, ts = Math.max(0, T(st.s) + (r() - 0.5) * (take ? 0.012 : 0.006) + (take ? 0.004 : 0));
      const notes = strike(st.k, st.x, tun), single = st.k === "B" || st.k === "A" || st.k === "P";
      const gap = single ? 0 : (electric ? 0.0042 : 0.0058) * (1.25 - 0.4 * st.v) * (st.k === "U" ? 0.75 : 1);
      const type = st.k === "M" ? (electric ? "p" : "q") : st.k === "P" ? (electric ? "e" : "f") : electric ? "e" : "a";
      notes.forEach(([si, m], j) => ev.push({ si, m, t: ts + j * (gap + r() * 0.0012), v: v * (0.88 + r() * 0.24), type, ring: st.k === "R", mute: st.k === "M" }));
      if (!electric && !single) R.click(take, ts, gap * notes.length + 0.012, 0.035 * v);
    }
    ev.sort((a, c2) => a.si - c2.si || a.t - c2.t);
    ev.forEach((e, i) => {
      const nx = ev[i + 1] && ev[i + 1].si === e.si ? ev[i + 1].t : barEnd + 0.01;
      const end = finalBar ? e.t + 3 : e.mute ? Math.min(nx, e.t + 0.3) : nx;
      const base = (electric ? (R.clean ? 0.16 : 0.32) : 0.11) * (e.type === "f" || (R.clean && e.type === "e") ? 2 : 1);   // single picked notes vs six-string strums
      R.play(take, stringBuffer(e.type, e.m, take * 2 + (r() < 0.5 ? 0 : 1)), e.t, end, e.v * base, rate);
    });
  }
}
function graph(c, o, only) {
  const rnd = rng(0x5eed1234), K = kitFor(c, rnd), master = c.createGain(); master.gain.value = 0.8;
  const tilt = c.createBiquadFilter(); tilt.type = "peaking"; tilt.frequency.value = 3200; tilt.Q.value = 0.7; tilt.gain.value = 2.5;   // presence: phone speakers live here
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 15500; lp.Q.value = 0.5;        // nothing above what a phone or an MP3 keeps (also tames true peaks)
  master.connect(tilt); tilt.connect(lp); lp.connect(c.destination);
  const sr = c.sampleRate, verb = c.createConvolver(), irn = Math.floor(sr * 1.8), ir = c.createBuffer(2, irn, sr);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < irn; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / irn, 3); }
  verb.buffer = ir; const vg = c.createGain(); vg.gain.value = 0.25; verb.connect(vg); vg.connect(master);
  const bus = (name, send) => { const g = c.createGain(); g.gain.value = only && only !== name ? 0 : (o.mute[name] ? 0 : o.vol[name]); g.connect(master); if (send) { const s = c.createGain(); s.gain.value = send; g.connect(s); s.connect(verb); } return g; };
  const B = { drums: bus("drums", 0.07), bass: bus("bass"), keys: bus("keys", 0.5), melody: bus("melody", 0.55) };
  // Guitar: its own bus (its own stem). Built only when the guitar is on, so beats without guitar render exactly as before.
  const gtr = o.guitarOn ? guitarRig(c, o, only, master, verb) : null;
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
  const lead = o.leadSound === "guitar" ? leadRig(c, o, melIn) : null;
  return { K, B, bassIn, drumsIn, melIn, gtr, lead, only };
}
function schedBar(o, song, G, bd, t0) {
  const { bar, sec, b, nb, nth, next } = bd, st = song.st, { K, B, bassIn, drumsIn, melIn } = G, beat = 60 / o.bpm, step = beat / 4, energy = o.energy, rs = rng(song.slideSeed + bar * 7919);
  const ci = bar % 4, ch = song.chords[ci], nextCh = song.chords[(ci + 1) % 4];
  const hum = () => rs() * 0.006, vel = (base) => base * (0.92 + rs() * 0.16);           // humanize: a few ms, a few percent
  const T = st.swing8 ? (s) => t0 + s * step + (s % 4 === 2 ? (o.swing - 0.5) * beat : 0)          // country: the eighth notes shuffle (the guitar strums on eighths)
    : (s) => t0 + s * step + (s % 2 ? (o.swing - 0.5) * beat / 2 : 0);
  const hook = sec === "Hook", verse = sec === "Verse", lastBar = b === nb - 1, intoHook = next === "Hook" && b >= nb - 2;
  const breakdown = verse && nth === 2 && b < 4;                                                 // verse 2 opens stripped back, then the beat comes back
  const fade = sec === "Outro" ? 1 - b / nb : verse ? 0.7 : 1;                                   // verse sits back, hook lifts
  // Guitar runs in every section (its own rules in guitarBar).
  if (G.gtr && (!G.only || G.only === "guitar") && !o.mute.guitar) guitarBar(o, song, G, bd, t0, T);
  // chords
  const kv = (breakdown ? 0.55 : 1) * fade * (o.guitarOn ? (st.live ? 1 : 0.75) : 1);              // with a guitar playing the chords, the keys step back
  if (o.keysSound === "pad") for (const m of ch.tones) K.pad(t0, m, 4 * beat, B.keys, kv);
  else if (st.keysRhythm === "off") for (const s of [0, 3, 6, 10, 13]) for (const [j, m] of ch.tones.entries()) K[o.keysSound](T(s) + j * 0.008, m, step * 1.5, B.keys, (s ? 0.75 : 0.95) * kv);
  else for (const s of song.arr.stabs) for (const [j, m] of ch.tones.entries()) K[o.keysSound](T(s) + j * 0.01, m, beat * (s ? 0.9 : 1.4), B.keys, (s ? 0.6 : 0.9) * kv, st.wobble ? 1 : 0);
  if (st.crackle) K.crackle(t0, 4 * beat, drumsIn, rs);
  const tune = (v, up = 0) => { for (const n of song.motif) if (n.bar === ci) { if (G.lead) G.lead.play(T(n.step) + hum(), n.m + up, n.len * step, vel(v), n.step % 8 === 0 && n.len >= 2); else K[o.leadSound](T(n.step) + hum(), n.m + up, n.len * step, melIn, vel(v)); } };
  if (sec === "Intro" || sec === "Outro") {
    if (sec === "Intro" && b >= nb - 2 && song.arr.introTune) tune(0.5);
    if (sec === "Intro" && b === nb - 2) K.riser(t0, 8 * beat - 0.02, drumsIn, 0.6);
    if (sec === "Outro" && b < 2) { tune(0.5); if (b === 0) K.crash(t0, drumsIn, 0.6); }
    return;
  }
  // drums
  const breathe = lastBar && !st.perc && !(next === "Hook");                                   // the last bar before a change drops out for a beat (let it breathe)
  [...song.drums.kick].forEach((x, s) => { if (x === "x" && !(breathe && s >= 12) && !(intoHook && lastBar && s >= 8)) K.kick(T(s), drumsIn, o.kit, vel(1)); });
  const crossStick = o.style === "country" && !hook && !o.brushSnare;                              // country verses: cross-stick on the rim, the full snare comes in on the hook
  const snareHit = (t, v = 1) => o.brushSnare ? K.brush(t, drumsIn, v) : crossStick ? K.rim(t, drumsIn, 0.9 * v) : st.snareSound === "clap" ? K.clap(t, drumsIn, v) : st.snareSound === "rim" ? K.rim(t, drumsIn, v) : K.snare(t, drumsIn, o.kit, v);
  [...song.drums.snare].forEach((x, s) => {
    if (x !== "x") return;
    if (intoHook && lastBar && s >= 8) return;
    snareHit(T(s) + hum(), vel(1)); if (hook && o.style !== "rock" && o.style !== "country" && st.snareSound !== "clap") K.clap(T(s), drumsIn, 0.4); if (hook && st.snareSound === "clap" && s === 12) K.snare(T(s), drumsIn, "hard", 0.35);
  });
  if (intoHook && lastBar && st.live) {                                                            // a drummer's fill: snare, then down the toms
    const sn = (t, v) => o.brushSnare ? K.brush(t, drumsIn, v) : K.snare(t, drumsIn, o.kit, v);
    sn(T(8), 0.75); sn(T(10), 0.85); K.tom(T(12), drumsIn, 165, 0.85); K.tom(T(13), drumsIn, 165, 0.75); K.tom(T(14), drumsIn, 98, 0.95); K.tom(T(15), drumsIn, 98, 0.85);
  } else if (intoHook && lastBar) for (let k = 0; k < 8; k++) snareHit(T(8) + k * step, 0.45 + k * 0.07);          // snare roll into the hook
  if (intoHook && b === nb - 2) K.riser(t0, 8 * beat - 0.02, drumsIn, 0.5);
  if ((hook && b === 0) || (st.live && hook && b % 4 === 0) || (st.live && verse && b === 0 && !breakdown)) K.crash(t0, drumsIn, b === 0 ? 0.8 : 0.6);
  const roll = song.drums.rolls && bar % 2 === 1 && !intoHook && rs() < 0.4 + energy * 0.5, rollN = rs() < 0.5 ? 6 : 8;   // hat roll at the end of every other bar
  const hatV = breakdown ? 0.6 : 1;
  [...song.drums.hat].forEach((x, s) => {
    if (x !== "x") return;
    if (roll && s >= 12) { if (s === 12) for (let k = 0; k < rollN; k++) K.hat(T(12) + k * (4 * step / rollN), drumsIn, (0.5 + k * 0.06) * hatV); return; }
    if (st.hatSkip && s % 8 === 6 && rs() < 0.5) return;                                         // drill: skipped hat
    if (o.style === "rock" && hook) { K.hat(T(s) + hum(), drumsIn, vel(s % 4 === 0 ? 0.42 : 0.32), true); return; }   // rock hook: the hats open up and wash
    K.hat(T(s) + hum(), drumsIn, vel(s % 4 === 0 ? 0.9 : 0.6) * hatV);
    if (o.style !== "rock" && o.style !== "country" && energy > 0.5 && ((hook && song.arr.doubleHats) || st.hatSkip) && s % 4 === 2 && rs() < (hook ? 0.9 : 0.4)) K.hat(T(s + 1), drumsIn, 0.45 * hatV);
    if (o.style !== "rock" && o.style !== "country" && energy > 0.75 && hook && s === 10) for (let k = 1; k < 4; k++) K.hat(T(s) + k * step / 4, drumsIn, 0.35);
  });
  if (st.openHat && (hook || b % 4 === 3)) K.hat(T(14), drumsIn, 0.6, true);
  if (st.shaker) for (let s = 0; s < 16; s++) K.shaker(T(s) + hum(), drumsIn, (s % 2 ? 0.55 : 1) * (s % 4 === 2 ? 1.2 : 1) * (hook ? 1 : 0.8));
  if (st.perc) { for (const s of [3, 11]) K.perc(T(s), drumsIn, 0.8, false); if (hook || b % 2) for (const s of [7, 15]) K.perc(T(s) + hum(), drumsIn, 0.7, true); }
  // bass locks to the kick
  let hits = [...song.bassRhythm].map((x, s) => (x === "x" ? s : -1)).filter((s) => s >= 0);
  if (song.bassMode === "half") hits = hits.filter((s, i) => i === 0 || (s >= 8 && hits[i - 1] < 8));                 // one note per half bar
  else if (song.bassMode === "synco") hits = [...new Set([hits[0], 6, 11, 14].filter((s) => s >= 0))].sort((a, b) => a - b);  // off-beat line
  else if (song.bassMode === "walk") hits = [...new Set(hits.concat(b % 2 ? [10, 14] : [12]))].sort((a, b) => a - b);
  else if (song.bassMode === "eighths") hits = [0, 2, 4, 6, 8, 10, 12, 14];                                            // rock: driving eighths on the root
  else if (song.bassMode === "boom") hits = nextCh.root !== ch.root && b % 2 ? [0, 8, 12, 14] : [0, 8];                 // country boom-chick, walk-up into a new chord
  const sc = SCALE[o.mood], up = nextCh.root > ch.root;                                     // walk-up: the scale notes leading into the next chord's root
  const walkTo = (k) => { let m = nextCh.root, d = nextCh.d; for (let j = 0; j < k; j++) { const d2 = up ? d - 1 : d + 1, a = sc[((d % 7) + 7) % 7], c2 = sc[((d2 % 7) + 7) % 7]; m += up ? -((a - c2 + 12) % 12) : (c2 - a + 12) % 12; d = d2; } return m; };
  const slideHit = st.slides && hits.length > 1 && rs() < (o.style === "drill" ? 0.6 : 0.3) ? hits[1 + Math.floor(rs() * (hits.length - 1))] : -1;
  if (!breakdown) hits.forEach((s, i) => {
    if (intoHook && lastBar && s >= 8) return;
    const end = i + 1 < hits.length ? hits[i + 1] : 16, d = (end - s) * step;
    let m = ch.root; const fifth = ch.root + 7 > 43 ? ch.root - 5 : ch.root + 7;
    if ((o.bassSound === "log" || song.bassMode === "synco") && i % 2 === 1) m = fifth;                                    // bounce root / fifth
    if (song.bassMode === "walk" && s >= 10 && !song.bassRhythm.startsWith("x", s)) m = s === 14 ? nextCh.root + (nextCh.root > ch.root ? -1 : 1) : fifth;   // walk toward the next chord
    if (song.bassMode === "boom") m = s === 8 ? fifth : s >= 12 ? walkTo(s === 12 ? 2 : 1) : ch.root;
    if (o.bassSound === "808") K.b808(T(s), m, d, bassIn, s === slideHit ? (rs() < 0.5 ? m - 5 : m + 7) : null, 1, st.slides || 0.12);
    else if (o.bassSound === "log") K.log(T(s), m, d, bassIn);
    else if (song.bassMode === "boom" || song.bassMode === "eighths") K.round(T(s), m, Math.min(d, song.bassMode === "boom" ? beat * 0.8 : step * 1.8), bassIn, song.bassMode === "eighths" ? (s % 4 ? 0.8 : 0.95) * (hook ? 1 : 0.85) : s >= 12 ? 0.8 : 1);
    else K.round(T(s), m, d, bassIn);
    if (o.bassSound === "808" && i === hits.length - 1 && end - s > 2 && lastBar && !intoHook) K.b808(T(14), nextCh.root, 2 * step, bassIn, ch.root, 1, st.slides || 0.12);   // slide into the next chord
    if (o.bassSound === "round" && song.bassMode !== "boom" && song.bassMode !== "eighths" && i === hits.length - 1 && end - s > 3 && b % 2 === 0) K.round(T(14), ch.root + 7 > 43 ? ch.root - 5 : ch.root + 7, 2 * step, bassIn, 0.6);    // walk to the fifth
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
export async function render(o, song, only = null, onProgress, raw = false) {   // raw = skip the master (test renders that compare part levels)
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
  // Guitar makes many short string buffers. Render one piece at a time to keep
  // peak memory down on phones; existing guitar-free beats keep their old batching.
  const parallel = o.guitarOn && (!only || only === "guitar") ? 1 : 3;
  GTR_USERS++; if (!GTR_CACHE) GTR_CACHE = new Map();
  try { for (let i = 0; i < pieces.length; i += parallel) await Promise.all(pieces.slice(i, i + parallel).map(one)); } finally { if (--GTR_USERS === 0) GTR_CACHE = null; }
  if (!raw) master(L, R, total, sr);
  const buf = new AudioBuffer({ length: total, numberOfChannels: 2, sampleRate: sr });
  buf.copyToChannel(L, 0); buf.copyToChannel(R, 1);
  return buf;
}

// ---------- the page ----------
export function mount(root, { getCtx, onUse, wav }) {
  const seed = () => Math.floor(Math.random() * 1e9);
  const mk = () => ({ style: "trap", mood: "dark", key: 6, bpm: 140, swing: 0.5, energy: 0.6, kit: "hard", bassSound: "808", keysSound: "pad", leadSound: "bell", verseMelody: true, len: 1,
    seeds: { drums: seed(), bass: seed(), chords: seed(), melody: seed() }, drums: null, melody: null,
    guitarOn: false, guitarSound: "acoustic", guitarPattern: "strum", guitarProgression: "song", brushSnare: false,
    vol: { drums: 1, bass: 0.5, keys: 1.7, melody: 1.8 }, mute: {} });   // chords + tune forward: phone speakers lose the low end
  const o = mk();
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
    <div class="row"><button class="on" id="blNew">🎲 Make a new beat</button><button id="blPlay">▶ Hear it</button><button id="blKeep" aria-pressed="false">☆ Keep this beat</button></div>
    <p class="muted" id="blMsg"></p>
    <div id="blParts"></div>
    <p class="muted" style="margin:14px 0 6px">3. Take it to the recorder</p>
    <div class="row"><button class="on" id="blUse">Use this beat → record over it</button><button id="blSave">Save / share beat</button><button id="blStems">Save parts</button></div>
    <div class="row" style="margin-top:10px"><span class="btn file" style="min-height:44px">Open a saved beat file<input type="file" id="blOpenFile" accept="audio/*,.wav,.mp3" aria-label="Open a saved beat file"></span></div>
    <p class="muted" id="blOpenMsg" style="margin:6px 0 0">Files you saved from here carry their recipe, so you can edit them again.</p>
    <div class="card" style="margin:14px 0;background:var(--panel2)"><b>My beats</b>
      <p class="muted" style="margin:4px 0 8px">Every roll and edit is saved on this phone. Tap one to reopen it exactly. Tap the star to keep it for good.</p><div id="blMine"></div></div>
    <p class="muted">Made by Heartbeat's own beat engine: music-theory rules plus your choices. No AI model makes the track, the same way a drum machine works. Nobody else gets your exact beat unless you share it. Mixed for phone speakers; headphones hear the full bass.</p>`;
  const chip = (label, on, fn, title) => { const b = document.createElement("button"); b.textContent = label; if (on) b.className = "on"; if (title) b.title = title; b.onclick = fn; return b; };
  const setStyle = (k) => { o.style = k; roll(o, seed()); styleDefaults(o, k); remake(); };
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
    part("drums", "Drums", "Tap squares to add or remove hits (4 squares = 1 beat). The bass follows the kick. Fills and rolls are added by the rules.", [["hard", "Hard"], ["dusty", "Dusty"], ["soft", "Soft"], ["boom", "Boomy"]].concat(song.st.live || o.kit === "live" ? [["live", "Live kit"]] : []), o.kit, (v) => (o.kit = v),
      () => { o.seeds.drums = seed(); o.drums = null; remake(); }, grid);
    part("bass", "Bass", `Plays the root of each chord: ${ch.map((c) => nn(c.root)).join(" · ")}` + ({ half: " (one long note per half bar)", synco: " (off-beat line, root and fifth)", walk: " (walks to the next chord)", eighths: " (driving eighth notes)", boom: " (boom-chick: root on 1, fifth on 3, walks up into the next chord)" }[song.bassMode] || " (locked to the kick)") + (o.bassSound === "808" ? ". Slides into the hook." : o.bassSound === "log" ? ". Bounces root and fifth." : ""), [["808", "808 (slides)"], ["round", "Round bass"], ["log", "Log drum"]], o.bassSound, (v) => (o.bassSound = v),
      () => { o.seeds.bass = seed(); remake(); });
    part("keys", "Chords", `${ch.map((c) => c.name).join(" → ")} &nbsp;(${ch.map((c) => c.roman).join(" - ")} in ${NOTE[o.key]} ${o.mood === "dark" ? "minor" : "major"})`, [["pad", "Warm pad"], ["keys", "Electric piano"], ["pluck", "Plucked"]], o.keysSound, (v) => (o.keysSound = v),
      () => { o.seeds.chords = seed(); o.melody = null; remake(); });
    const guitar = document.createElement("div"); guitar.className = "card"; guitar.style.cssText = "margin:10px 0;background:var(--panel2)";
    guitar.innerHTML = `<div class="row" style="justify-content:space-between"><b>Guitar</b><button id="blGuitarToggle" class="${o.guitarOn ? "on" : ""}" aria-label="Guitar" aria-pressed="${!!o.guitarOn}">${o.guitarOn ? "On" : "Off"}</button></div><p class="muted" style="margin:6px 0">Add a guitar loop to any style.</p><div id="blGuitarChoices"></div>`;
    guitar.querySelector("#blGuitarToggle").onclick = () => { o.guitarOn = !o.guitarOn; if (o.guitarOn && !STYLES[o.style].live) o.guitarPattern = "pick"; remake(); };   // over a hip hop beat, a picked loop is the record sound
    if (o.guitarOn) {
      const choices = guitar.querySelector("#blGuitarChoices");
      const picker = (label, key, options) => {
        const wrap = document.createElement("label"); wrap.className = "inline"; wrap.style.marginTop = "8px";
        const text = document.createElement("span"); text.textContent = label; const select = document.createElement("select");
        select.style.cssText = "font:inherit;font-size:16px;min-height:44px;max-width:100%;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:8px";
        for (const [v, name] of options) { const option = document.createElement("option"); option.value = v; option.textContent = name; select.append(option); }
        select.value = o[key]; select.onchange = () => { o[key] = select.value; remake(); }; wrap.append(text, select); choices.append(wrap);
      };
      picker("Sound", "guitarSound", [["acoustic", "Acoustic"], ["electric", "Electric"]]);
      picker("Pattern", "guitarPattern", [["strum", "Down and up strums"], ["steady", "Steady down strums"], ["riff", "Rock riff with palm mute"], ["pick", "Fingerpicked (one note at a time)"], ["boom", "Bass note and strum (country)"]]);
      picker("Chords", "guitarProgression", [["song", "Follow the beat"], ["oneFourFive", o.mood === "dark" ? "i - iv - v" : "I - IV - V"], ["oneFiveSixFour", o.mood === "dark" ? "i - v - VI - iv" : "I - V - vi - IV"]]);
      const note = document.createElement("p"); note.className = "muted"; note.style.margin = "6px 0 0";
      note.textContent = "Choosing chords changes them for the whole beat."; choices.append(note);
    }
    el.append(guitar);
    if (o.style === "country") {
      const brush = chip(o.brushSnare ? "Brushed snare on" : "Brushed snare off", o.brushSnare, () => { o.brushSnare = !o.brushSnare; buf = null; drawParts(); });
      brush.setAttribute("aria-pressed", String(!!o.brushSnare)); el.append(brush);
    }
    const notes = song.motif.map((n) => nn(n.m)).join(" ");
    const vt = document.createElement("label"); vt.className = "inline"; vt.style.marginTop = "8px"; vt.innerHTML = `<input type="checkbox" ${o.verseMelody ? "checked" : ""}> Melody in the verses too (off = more room to rap)`;
    vt.querySelector("input").onchange = (e) => { o.verseMelody = e.target.checked; buf = null; };
    part("melody", "Melody", `The tune (4 bars): ${notes}. Full in the hook, an octave up in its second half, with a soft echo.`, [["bell", "Bell"], ["keys", "Electric piano"], ["pluck", "Pluck"], ["dark", "Dark synth"], ["guitar", "Lead guitar"]], o.leadSound, (v) => (o.leadSound = v),
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
  $("#blUse").onclick = async () => { stopPrev(); const b = await build(); onUse(b, "Beat Lab: " + name(), o.bpm, recipe()); };
  const openSheet = async (start) => {
    const { openSave } = await import("./save.js");
    openSave({ title: name(), wav, start, recipe: recipe(),
      getBuffer: () => build(),
      getParts: async (onP) => { const out = [], ps = ["drums", "bass", "keys", "melody"].concat(o.guitarOn ? ["guitar"] : []); for (let i = 0; i < ps.length; i++) { $("#blMsg").textContent = "Making " + ps[i] + "…"; out.push({ name: ps[i], buffer: await render(o, song, ps[i]) }); onP((i + 1) / ps.length); } msg(); return out; } });
  };
  $("#blSave").onclick = () => openSheet();
  $("#blStems").onclick = () => openSheet("parts");
  drawTop(); drawParts();
  // ---------- My beats: every roll and edit is saved as a small recipe on this phone ----------
  const KEY = "hb-studio-beats-v1", MAXRECENT = 30;
  const recipe = () => ({ v: 1, ...JSON.parse(JSON.stringify(o)) });
  const store = { get() { try { const a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } },
    set(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); return true; } catch (e) { return false; } } };
  let curId = null, lastJson = "", timer = 0, confirmId = null, renameId = null;
  const autoName = (r) => `${STYLES[r.style] ? STYLES[r.style].name : r.style} ${NOTE[r.key]}${r.mood === "dark" ? "m" : ""} ${r.bpm}`;
  const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" }); };
  function saveNow() {
    clearTimeout(timer); const r = recipe(), j = JSON.stringify(r); if (j === lastJson && curId) return; lastJson = j;
    let all = store.get(), e = all.find((x) => x.id === curId);
    if (e) { e.r = r; e.t = Date.now(); } else { curId = "b" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); all.unshift({ id: curId, t: Date.now(), name: null, kept: false, r }); }
    const kept = all.filter((x) => x.kept), rest = all.filter((x) => !x.kept).sort((a, b) => b.t - a.t).slice(0, MAXRECENT);
    store.set(kept.concat(rest).sort((a, b) => b.t - a.t)); drawMine(); drawKeep();
  }
  const touch = () => { clearTimeout(timer); timer = setTimeout(saveNow, 350); };
  ["click", "input", "change"].forEach((ev) => root.addEventListener(ev, (e) => { if (e.target.closest && e.target.closest("#blMine, #blKeep, #blPlay, #blUse, #blSave, #blStems, #blOpenFile")) return; touch(); }));
  const fresh = () => { curId = null; };                                   // a new dice roll is a new entry
  function openRecipe(r, id) {
    if (!r || !STYLES[r.style] || !r.seeds) return false;
    stopPrev(); Object.keys(o).forEach((k) => delete o[k]); Object.assign(o, mk(), JSON.parse(JSON.stringify(r))); delete o.v;
    song = compose(o); if (o.drums) song.drums = o.drums; buf = null; curId = id || null; lastJson = JSON.stringify(recipe()); drawTop(); drawParts(); drawMine(); drawKeep();
    if (!id) { const j = JSON.stringify(recipe()), same = store.get().find((x) => JSON.stringify({ v: 1, ...x.r, v: 1 }) === j || JSON.stringify(x.r) === j); curId = same ? same.id : null; if (!same) saveNow(); drawMine(); drawKeep(); }
    return true;
  }
  function drawKeep() { const e = store.get().find((x) => x.id === curId), b = $("#blKeep"); b.textContent = e && e.kept ? "★ Kept" : "☆ Keep this beat"; b.setAttribute("aria-pressed", String(!!(e && e.kept))); b.className = e && e.kept ? "on" : ""; }
  function drawMine() {
    const all = store.get(), box = $("#blMine"); box.replaceChildren();
    if (!all.length) { const p = document.createElement("p"); p.className = "muted"; p.textContent = "Nothing yet. Roll a beat and it shows up here."; box.append(p); return; }
    const group = (label, list) => {
      if (!list.length) return; const h = document.createElement("p"); h.className = "muted"; h.style.margin = "10px 0 4px"; h.textContent = label; box.append(h);
      for (const e of list) {
        const d = document.createElement("div"); d.className = "blEntry"; d.style.cssText = "border:1px solid var(--line);border-radius:12px;padding:8px;margin:6px 0;" + (e.id === curId ? "border-color:var(--accent);" : "");
        const nm = e.name || autoName(e.r), open = document.createElement("button"); open.style.cssText = "width:100%;text-align:left;min-height:48px;overflow-wrap:anywhere";
        open.textContent = nm; const sub = document.createElement("span"); sub.style.cssText = "display:block;font-weight:400;font-size:13px;color:var(--faint)";
        sub.textContent = `${STYLES[e.r.style].name} · ${NOTE[e.r.key]} ${e.r.mood === "dark" ? "minor" : "major"} · ${e.r.bpm} BPM · ${ago(e.t)}`; open.append(sub);
        open.onclick = () => { openRecipe(e.r, e.id); $("#blMsg").scrollIntoView({ behavior: "smooth", block: "center" }); };
        const row = document.createElement("div"); row.className = "row"; row.style.marginTop = "6px";
        const star = document.createElement("button"); star.textContent = e.kept ? "★ Kept" : "☆ Keep"; star.setAttribute("aria-label", (e.kept ? "Unkeep " : "Keep ") + nm); if (e.kept) star.className = "on";
        star.onclick = () => { const a = store.get(), x = a.find((y) => y.id === e.id); if (x) { x.kept = !x.kept; store.set(a); } drawMine(); drawKeep(); };
        const ren = document.createElement("button"); ren.textContent = "Rename";
        ren.onclick = () => { renameId = renameId === e.id ? null : e.id; drawMine(); };
        const del = document.createElement("button"); del.textContent = confirmId === e.id ? "Tap again to delete" : "Delete"; if (confirmId === e.id) del.className = "rec";
        del.onclick = () => {
          if (confirmId !== e.id) { confirmId = e.id; drawMine(); setTimeout(() => { if (confirmId === e.id) { confirmId = null; drawMine(); } }, 4000); return; }
          confirmId = null; store.set(store.get().filter((y) => y.id !== e.id)); if (curId === e.id) { curId = null; lastJson = ""; } drawMine(); drawKeep();
        };
        row.append(star, ren, del); d.append(open, row);
        if (renameId === e.id) {
          const r2 = document.createElement("div"); r2.className = "row"; r2.style.marginTop = "6px"; const inp = document.createElement("input"); inp.value = nm; inp.maxLength = 40; inp.setAttribute("aria-label", "Beat name");
          inp.style.cssText = "flex:1;font:inherit;font-size:16px;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px";
          const ok = document.createElement("button"); ok.textContent = "Save name"; ok.className = "on";
          ok.onclick = () => { const a = store.get(), x = a.find((y) => y.id === e.id); if (x) { x.name = inp.value.trim().slice(0, 40) || null; store.set(a); } renameId = null; drawMine(); };
          r2.append(inp, ok); d.append(r2);
        }
        box.append(d);
      }
    };
    group("Kept", all.filter((x) => x.kept)); group("Recent (last " + MAXRECENT + ")", all.filter((x) => !x.kept));
  }
  $("#blKeep").onclick = () => { saveNow(); const a = store.get(), x = a.find((y) => y.id === curId); if (x) { x.kept = !x.kept; store.set(a); } drawMine(); drawKeep(); };
  $("#blOpenFile").onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    const { readRecipe } = await import("./save.js"), r = await readRecipe(f);
    $("#blOpenMsg").textContent = r && openRecipe(r) ? "Opened " + f.name + ". It is saved in My beats too." : "That file has no beat recipe. Only files saved from the Beat Lab can be edited again. Use Upload your own beat (step 1 above) to record over it.";
  };
  $("#blNew").addEventListener("click", fresh, true);
  root.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("#blStyle button"); if (b) fresh(); }, true);
  drawMine(); drawKeep();
  return { open: (r) => openRecipe(r) };
}
