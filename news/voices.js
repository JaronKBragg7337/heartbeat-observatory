// Heartbeat News - the two anchors' voices.
//
// Two free engines, chosen per anchor in the Voice Studio:
//   "synth"   eSpeak rendered in code (voice-worker.js). Runs through the studio chain below, so every knob works:
//             pitch, speed, size (formant), tone EQ, robot ring-mod, metal comb, bit crush, radio, echo.
//   "browser" the device's own speech engine (speechSynthesis). The most natural voices on most phones, but the
//             browser gives no audio to process, so only voice / pitch / speed / volume apply.
// Paid voices come later as a third engine with the same speak() contract.
//
// level(who) is 0..1 and drives the mouths: measured from the audio for "synth", from word timing for "browser".

export const DEFAULT_SETTINGS = {
  vex: {
    engine: "synth", variant: "m3", voiceName: "",
    pitch: 1.0, speed: 1.0, volume: 0.95, size: 1.06,
    bass: 2, treble: 3, presence: 3,
    robot: 0.42, robotHz: 52, metal: 0.25, crush: 0, radio: 0, echo: 0.12,
    look: { body: "#d6dbe1", trim: "#2a2f36", eyes: "#4fe3ff", tie: "#c21f2e" }
  },
  joe: {
    engine: "browser", variant: "m7", voiceName: "",
    pitch: 0.82, speed: 0.97, volume: 1.0, size: 0.94,
    bass: 3, treble: 0, presence: 1,
    robot: 0, robotHz: 30, metal: 0, crush: 0, radio: 0, echo: 0.06,
    look: { skin: "#8fae8b", eyes: "#07090b", suit: "#1e2533", tie: "#1f4fae" }
  }
};

// Voices a device may offer, best first, per anchor. Used only when the studio has not picked one by name.
const PREFER = {
  vex: ["Microsoft Guy Online", "Google US English", "Aaron", "Alex", "Fred", "Daniel", "Microsoft David"],
  joe: ["Daniel", "Google UK English Male", "Microsoft Ryan Online", "Microsoft Guy Online", "Arthur", "Rishi", "Alex", "Aaron", "Microsoft Mark"]
};

export const SYNTH_VARIANTS = [
  ["m1", "Male 1"], ["m2", "Male 2"], ["m3", "Male 3"], ["m4", "Male 4 (deep)"], ["m5", "Male 5"], ["m6", "Male 6"],
  ["m7", "Male 7 (breathy)"], ["f1", "Female 1"], ["f2", "Female 2"], ["f3", "Female 3"], ["f4", "Female 4"], ["f5", "Female 5"],
  ["croak", "Croak"], ["klatt", "Klatt (1980s)"], ["klatt2", "Klatt 2"], ["klatt3", "Klatt 3"], ["whisper", "Whisper"]
];

// How long after the device voice's last line a synth line waits to start (CHOSEN). The show already leaves a 0.45 s gap
// between lines, so this adds about a quarter second after Joe's lines and nothing after Vex's own.
const DEVICE_RELEASE_MS = 700;

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// Split a line into sentence-sized pieces. Chrome's cloud voices stop after ~15 s, and short pieces keep the
// mouth timing honest on every engine.
export function sentences(text) {
  const parts = String(text).match(/[^.!?;:]+[.!?;:]*["')\]]*\s*/g) || [String(text)];
  const out = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    if (out.length && (t.split(/\s+/).length < 3 || out[out.length - 1].split(/\s+/).length < 3)) out[out.length - 1] += " " + t;
    else out.push(t);
  }
  return out.length ? out : [String(text)];
}

function syllables(word) {
  const w = String(word).toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 1;
  const m = w.replace(/e$/, "").match(/[aeiouy]+/g);
  return clamp(m ? m.length : 1, 1, 6);
}

function parseWav(buf) {
  const dv = new DataView(buf);
  let off = 12, rate = 22050, bits = 16, ch = 1, dataOff = 0, dataLen = 0;
  while (off + 8 <= dv.byteLength) {
    const id = String.fromCharCode(dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3));
    const len = dv.getUint32(off + 4, true);
    if (id === "fmt ") { ch = dv.getUint16(off + 10, true); rate = dv.getUint32(off + 12, true); bits = dv.getUint16(off + 22, true); }
    if (id === "data") { dataOff = off + 8; dataLen = Math.min(len, dv.byteLength - dataOff); break; }
    off += 8 + len + (len & 1);
  }
  const n = Math.floor(dataLen / (bits / 8) / ch);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = dataOff + i * ch * (bits / 8);
    out[i] = bits === 16 ? dv.getInt16(p, true) / 32768 : (dv.getUint8(p) - 128) / 128;
  }
  // eSpeak leaves ~0.2 s of silence at each end; trim it so the anchors don't wait between lines.
  let a = 0, b = n - 1;
  while (a < n && Math.abs(out[a]) < 0.004) a++;
  while (b > a && Math.abs(out[b]) < 0.004) b--;
  a = Math.max(0, a - Math.round(rate * 0.02)); b = Math.min(n - 1, b + Math.round(rate * 0.06));
  return { rate, samples: out.subarray(a, b + 1) };
}

export class VoiceBox {
  constructor() {
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.ctx = null;
    this.unlocked = false;
    this.levels = { vex: 0, joe: 0 };
    this.targets = { vex: 0, joe: 0 };
    this.env = { vex: null, joe: null };
    this.chains = {};
    this.worker = null;
    this.jobs = new Map();
    this.jobSeq = 0;
    this.cache = new Map();
    this.current = null;
    this.voices = [];
    this.synthFailed = false;
    if (typeof speechSynthesis !== "undefined") {
      const load = () => { try { this.voices = speechSynthesis.getVoices() || []; } catch (e) { this.voices = []; } };
      load();
      try { speechSynthesis.addEventListener("voiceschanged", load); } catch (e) { speechSynthesis.onvoiceschanged = load; }
    }
  }

  setSettings(who, s) {
    this.settings[who] = Object.assign({}, DEFAULT_SETTINGS[who], s || {});
    this.settings[who].look = Object.assign({}, DEFAULT_SETTINGS[who].look, (s && s.look) || {});
    this.cache.clear();
    if (this.chains[who]) this.applyChain(who);
  }

  englishVoices() {
    return (this.voices || []).filter((v) => /^en([-_]|$)/i.test(v.lang || "") || /english/i.test(v.name || ""));
  }

  pickVoice(who) {
    const list = this.englishVoices();
    const s = this.settings[who];
    if (s.voiceName) { const v = list.find((x) => x.name === s.voiceName) || this.voices.find((x) => x.name === s.voiceName); if (v) return v; }
    for (const name of PREFER[who] || []) { const v = list.find((x) => x.name === name || x.name.startsWith(name)); if (v) return v; }
    return list.find((v) => /en-US/i.test(v.lang) && v.localService) || list[0] || null;
  }

  // Must run inside a tap/click: phones only open audio from a user gesture.
  unlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
        this.master = this.ctx.createDynamicsCompressor();
        this.master.threshold.value = -14; this.master.ratio.value = 3; this.master.attack.value = 0.004; this.master.release.value = 0.2;
        this.master.connect(this.ctx.destination);
        for (const who of ["vex", "joe"]) this.buildChain(who);
      }
    }
    if (this.ctx && this.ctx.state !== "running") this.ctx.resume().catch(() => {});
    // A one-sample buffer played inside the gesture fully unlocks iOS Web Audio.
    try { const b = this.ctx.createBuffer(1, 1, 22050); const s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.ctx.destination); s.start(0); } catch (e) {}
    // Same for speech: an empty utterance inside the gesture lets later ones play on iOS.
    try { if (typeof speechSynthesis !== "undefined") { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } } catch (e) {}
    this.unlocked = true;
    this.warmSynth();
  }

  buildChain(who) {
    const c = this.ctx, n = {};
    n.input = c.createGain();
    // Robot: ring modulation (voice x carrier), mixed against the dry voice.
    n.dry = c.createGain(); n.ringIn = c.createGain(); n.ringIn.gain.value = 0; n.ringOut = c.createGain();
    n.carrier = c.createOscillator(); n.carrier.type = "sine"; n.carrier.connect(n.ringIn.gain); n.carrier.start();
    n.input.connect(n.dry); n.input.connect(n.ringIn); n.ringIn.connect(n.ringOut);
    n.mix = c.createGain(); n.dry.connect(n.mix); n.ringOut.connect(n.mix);
    // Metal: a short feedback comb, the "speaking through a can" colour.
    n.comb = c.createDelay(0.05); n.combFb = c.createGain(); n.combWet = c.createGain();
    n.mix.connect(n.comb); n.comb.connect(n.combFb); n.combFb.connect(n.comb); n.comb.connect(n.combWet);
    n.post = c.createGain(); n.mix.connect(n.post); n.combWet.connect(n.post);
    // Tone: bass shelf, presence peak, treble shelf.
    n.bass = c.createBiquadFilter(); n.bass.type = "lowshelf"; n.bass.frequency.value = 180;
    n.pres = c.createBiquadFilter(); n.pres.type = "peaking"; n.pres.frequency.value = 2800; n.pres.Q.value = 0.9;
    n.treb = c.createBiquadFilter(); n.treb.type = "highshelf"; n.treb.frequency.value = 5200;
    n.post.connect(n.bass); n.bass.connect(n.pres); n.pres.connect(n.treb);
    // Crush: a staircase waveshaper (fewer amplitude steps = grittier).
    n.crush = c.createWaveShaper(); n.treb.connect(n.crush);
    // Radio: band-pass wet/dry.
    n.radioHP = c.createBiquadFilter(); n.radioHP.type = "highpass"; n.radioHP.frequency.value = 420;
    n.radioLP = c.createBiquadFilter(); n.radioLP.type = "lowpass"; n.radioLP.frequency.value = 3200;
    n.radioWet = c.createGain(); n.radioDry = c.createGain();
    n.crush.connect(n.radioHP); n.radioHP.connect(n.radioLP); n.radioLP.connect(n.radioWet); n.crush.connect(n.radioDry);
    n.out = c.createGain(); n.radioWet.connect(n.out); n.radioDry.connect(n.out);
    // Echo: a studio slap-back.
    n.delay = c.createDelay(1); n.delay.delayTime.value = 0.16; n.fb = c.createGain(); n.echoWet = c.createGain();
    n.out.connect(n.delay); n.delay.connect(n.fb); n.fb.connect(n.delay); n.delay.connect(n.echoWet);
    n.vol = c.createGain(); n.out.connect(n.vol); n.echoWet.connect(n.vol);
    n.analyser = c.createAnalyser(); n.analyser.fftSize = 512; n.vol.connect(n.analyser);
    n.vol.connect(this.master);
    n.buf = new Float32Array(n.analyser.fftSize);
    this.chains[who] = n;
    this.applyChain(who);
  }

  applyChain(who) {
    const n = this.chains[who], s = this.settings[who];
    if (!n) return;
    const r = clamp(+s.robot || 0, 0, 1);
    n.dry.gain.value = 1 - r * 0.85; n.ringOut.gain.value = r * 1.6; n.carrier.frequency.value = clamp(+s.robotHz || 50, 5, 400);
    const m = clamp(+s.metal || 0, 0, 1);
    n.comb.delayTime.value = 0.004 + (1 - m) * 0.004; n.combFb.gain.value = m * 0.72; n.combWet.gain.value = m * 0.8;
    n.bass.gain.value = clamp(+s.bass || 0, -12, 12); n.treb.gain.value = clamp(+s.treble || 0, -12, 12); n.pres.gain.value = clamp(+s.presence || 0, -12, 12);
    const k = clamp(+s.crush || 0, 0, 1);
    if (k > 0.01) {
      const steps = Math.round(64 - k * 60), curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.round(x * steps) / steps; }
      n.crush.curve = curve;
    } else n.crush.curve = null;
    const rad = clamp(+s.radio || 0, 0, 1); n.radioWet.gain.value = rad * 1.4; n.radioDry.gain.value = 1 - rad;
    const e = clamp(+s.echo || 0, 0, 1); n.echoWet.gain.value = e * 0.55; n.fb.gain.value = e * 0.45;
    n.vol.gain.value = clamp(s.volume == null ? 1 : +s.volume, 0, 1.5);
  }

  // ---- eSpeak worker -------------------------------------------------------------------------------------------
  ensureWorker() {
    if (this.worker || this.synthFailed) return this.worker;
    try {
      this.worker = new Worker("/news/voice-worker.js");
      this.worker.onmessage = (e) => {
        const j = this.jobs.get(e.data.id); if (!j) return;
        this.jobs.delete(e.data.id);
        e.data.ok ? j.resolve(e.data) : j.reject(new Error(e.data.error));
      };
      this.worker.onerror = () => { this.synthFailed = true; for (const j of this.jobs.values()) j.reject(new Error("synth worker failed")); this.jobs.clear(); };
    } catch (e) { this.synthFailed = true; }
    return this.worker;
  }
  warmSynth() {
    if (!["vex", "joe"].some((w) => this.settings[w].engine === "synth")) return;
    const w = this.ensureWorker(); if (!w) return;
    const id = ++this.jobSeq; this.jobs.set(id, { resolve() {}, reject() {} }); w.postMessage({ id, text: "" });
  }
  synthOpts(who) {
    const s = this.settings[who], size = clamp(+s.size || 1, 0.7, 1.4);
    // Size (formant): render at pitch/size and speed/size, then play back at x size. Pitch and pace land where asked,
    // while the vocal tract scales by size: bigger = deeper, smaller = brighter.
    return { variant: s.variant || "", pitch: clamp(50 * (+s.pitch || 1) / size, 0, 99), speed: clamp(172 * (+s.speed || 1) / size, 80, 450), size };
  }
  render(who, text) {
    const o = this.synthOpts(who), key = who + "|" + JSON.stringify(o) + "|" + text;
    if (this.cache.has(key)) return this.cache.get(key);
    const w = this.ensureWorker();
    if (!w) return Promise.reject(new Error("synth unavailable"));
    const id = ++this.jobSeq;
    const p = new Promise((resolve, reject) => { this.jobs.set(id, { resolve, reject }); w.postMessage({ id, text, opts: o }); })
      .then((d) => { const wav = parseWav(d.wav); return { wav, size: o.size }; });
    p.catch(() => this.cache.delete(key));
    this.cache.set(key, p);
    if (this.cache.size > 24) this.cache.delete(this.cache.keys().next().value);
    return p;
  }
  prepare(who, text) {
    if (this.settings[who].engine === "synth" && this.unlocked) this.render(who, text).catch(() => {});
  }

  // ---- speaking ---------------------------------------------------------------------------------------------------
  // nextEngine = the engine of the line about to start. A synth line only stops the device voice if it is actually
  // busy: poking an idle speech engine at the top of every Vex line made phones duck the page's audio again.
  cancel(nextEngine) {
    const c = this.current; this.current = null;
    if (c) { c.cancelled = true; try { c.src && c.src.stop(); } catch (e) {} }
    try {
      if (typeof speechSynthesis !== "undefined" && (nextEngine !== "synth" || speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
    } catch (e) {}
    this.targets.vex = this.targets.joe = 0; this.env.vex = this.env.joe = null;
  }

  // Resolves when the line has finished (or was cancelled). Never rejects: a failed engine falls back to the other.
  speak(who, text, hooks = {}) {
    const engine = this.settings[who].engine;
    const synth = engine === "synth" && !this.synthFailed;
    this.cancel(synth ? "synth" : "browser");
    const job = { who, cancelled: false, device: !synth }; this.current = job;
    const run = synth ? this.speakSynth(job, text, hooks) : this.speakBrowser(job, text, hooks);
    return run.catch(() => (job.cancelled ? null : ((job.device = true), this.speakBrowser(job, text, hooks)))).then(() => {
      if (job.device) this.deviceEndAt = performance.now();
      if (this.current === job) this.current = null; this.targets[who] = 0;
    });
  }

  // Before a synth line starts: phones turn the page's own audio down while their speech engine (the device voice) has
  // the output, and fade it back up after it lets go. Starting Vex inside that fade is what made his first words come
  // out low and quiet. So wait until the device voice is idle and its fade has finished, and make sure the audio
  // context is running (iOS can leave it suspended/interrupted after the speech engine used the output).
  async outputReady(job) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const t0 = performance.now();
    while (typeof speechSynthesis !== "undefined" && (speechSynthesis.speaking || speechSynthesis.pending) && performance.now() - t0 < 1500 && !job.cancelled) await sleep(40);
    const wait = (this.deviceEndAt || -1e9) + DEVICE_RELEASE_MS - performance.now();
    if (wait > 0 && !job.cancelled) await sleep(wait);
    if (this.ctx.state !== "running") { try { await Promise.race([this.ctx.resume(), sleep(800)]); } catch (e) {} }
  }

  async speakSynth(job, text, hooks) {
    if (!this.ctx) throw new Error("audio locked");
    const who = job.who, n = this.chains[who];
    const { wav, size } = await this.render(who, text);
    if (job.cancelled) return;
    const buf = this.ctx.createBuffer(1, wav.samples.length, wav.rate);
    buf.copyToChannel ? buf.copyToChannel(wav.samples, 0) : buf.getChannelData(0).set(wav.samples);
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = size;
    src.connect(n.input);
    await this.outputReady(job);
    if (job.cancelled) return;
    job.src = src;
    await new Promise((resolve) => {
      src.onended = resolve;
      hooks.onStart && hooks.onStart(buf.duration / size);
      src.start();
    });
  }

  speakBrowser(job, text, hooks) {
    return new Promise((resolve) => {
      if (typeof speechSynthesis === "undefined") { resolve(); return; }
      const who = job.who, s = this.settings[who], voice = this.pickVoice(who);
      const parts = sentences(text);
      let i = 0, started = false;
      const words = String(text).split(/\s+/).length;
      const next = () => {
        if (job.cancelled) { resolve(); return; }
        if (i >= parts.length) { this.env[who] = null; resolve(); return; }
        const part = parts[i++];
        const u = new SpeechSynthesisUtterance(part);
        if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = "en-US";
        u.pitch = clamp(+s.pitch || 1, 0.1, 2); u.rate = clamp(+s.speed || 1, 0.5, 2); u.volume = clamp(s.volume == null ? 1 : +s.volume, 0, 1);
        let gotBoundary = false;
        const t0 = performance.now();
        const estMs = part.split(/\s+/).length / (2.7 * u.rate) * 1000;
        // Without word events (some Android voices), animate from the sentence's syllables over its estimated length.
        this.env[who] = { start: t0, dur: estMs, sylls: part.split(/\s+/).reduce((a, w) => a + syllables(w), 0), boundary: false };
        u.onstart = () => { if (!started) { started = true; hooks.onStart && hooks.onStart(words / (2.7 * u.rate)); } this.env[who].start = performance.now(); };
        u.onboundary = (ev) => {
          if (ev.name && ev.name !== "word") return;
          gotBoundary = true;
          const w = part.slice(ev.charIndex).split(/\s+/)[0] || "";
          this.env[who] = { start: performance.now(), dur: Math.max(140, syllables(w) * 190 / u.rate), sylls: syllables(w), boundary: true };
        };
        u.onend = () => { clearTimeout(guard); next(); };
        u.onerror = () => { clearTimeout(guard); next(); };
        // Some engines never fire onend; don't let the show hang.
        const guard = setTimeout(() => { if (!job.cancelled) next(); }, estMs * 2.4 + 4000);
        speechSynthesis.speak(u);
        void gotBoundary;
      };
      next();
    });
  }

  // Mouth level for this frame, 0..1.
  level(who, now = performance.now()) {
    const n = this.chains[who];
    let target = 0;
    const cur = this.current;
    if (cur && cur.who === who && cur.src && n) {
      n.analyser.getFloatTimeDomainData(n.buf);
      let sum = 0; for (let i = 0; i < n.buf.length; i++) sum += n.buf[i] * n.buf[i];
      target = clamp(Math.sqrt(sum / n.buf.length) * 8, 0, 1);
    } else if (this.env[who]) {
      const e = this.env[who], t = (now - e.start) / Math.max(1, e.dur);
      if (t >= 0 && t <= 1.05) {
        const cyc = t * e.sylls;
        target = clamp(0.25 + 0.75 * Math.abs(Math.sin(cyc * Math.PI)), 0, 1) * (e.boundary ? 1 : 0.85);
      } else if (!e.boundary && t > 1.05) target = 0;
    }
    const k = target > this.levels[who] ? 0.55 : 0.28;
    this.levels[who] += (target - this.levels[who]) * k;
    return this.levels[who];
  }
}

// Silent-mode mouths: a believable talking envelope from the line's syllables, used when sound is off.
export function silentLevel(text, t, dur) {
  if (t < 0 || t > dur) return 0;
  const words = String(text).split(/\s+/);
  const syl = words.reduce((a, w) => a + syllables(w), 0);
  const x = (t / dur) * syl;
  const wobble = 0.75 + 0.25 * Math.sin(x * 1.7 + 1.3);
  const pause = /[,.;:]/.test(words[Math.min(words.length - 1, Math.floor((t / dur) * words.length))] || "") && (x % 1) > 0.7 ? 0.2 : 1;
  return clamp(Math.abs(Math.sin(x * Math.PI)) * wobble * pause, 0, 1);
}
