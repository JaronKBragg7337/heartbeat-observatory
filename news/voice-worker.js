// Heartbeat News - eSpeak synth in a worker so a long line never freezes the 3D studio.
// meSpeak (eSpeak compiled to JS, GPL) renders a WAV; the page plays it through its studio effects chain.
/* global meSpeak */
let ready = null;

function boot() {
  if (ready) return ready;
  ready = (async () => {
    importScripts("/news/vendor/mespeak.js");
    const [config, voice] = await Promise.all([
      fetch("/news/vendor/mespeak_config.json").then((r) => r.json()),
      fetch("/news/vendor/en-us.json").then((r) => r.json())
    ]);
    meSpeak.loadConfig(config);
    meSpeak.loadVoice(voice);
    return true;
  })();
  return ready;
}

self.onmessage = async (e) => {
  const { id, text, opts } = e.data || {};
  try {
    await boot();
    if (!text) { self.postMessage({ id, ok: true, warm: true }); return; }
    const o = opts || {};
    const bytes = meSpeak.speak(text, {
      rawdata: "array",
      pitch: Math.round(o.pitch == null ? 50 : o.pitch),
      speed: Math.round(o.speed == null ? 170 : o.speed),
      wordgap: Math.round(o.wordgap || 0),
      amplitude: 100,
      variant: o.variant || undefined
    });
    if (!bytes || !bytes.length) throw new Error("empty render");
    const buf = new Uint8Array(bytes).buffer;
    self.postMessage({ id, ok: true, wav: buf }, [buf]);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
