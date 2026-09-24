# Vendored for Heartbeat News

- `mespeak.js` — meSpeak 2.0.2 (npm `mespeak`, Norbert Landsteiner's Modular eSpeak, itself eSpeak by Jonathan Duddington
  compiled to JavaScript by speak.js). GPL. Bundled here as one browser file with esbuild (`--format=iife --global-name=meSpeak`)
  so it can run inside `news/voice-worker.js`.
- `mespeak_config.json`, `en-us.json` — eSpeak data and the US English voice from the same package.

Loaded only after someone taps for sound and an anchor is set to the code synth.
