# Voices review, 2026-10-03

Jaron (10/2): "it should have voices saying what's on the screen though. All people should have voices. Players should be able to
hear other players close by without using phone too."

Two features, built and tested here. **Nobody has listened to any of this yet.** Everything below is what a machine could check.

## 1. People talk (NPC voices)

Every line a person says on screen is also spoken, from that person's body, in their own voice. Subtitles are untouched.

| Who | Lines | Voice | Where it comes from |
|---|---|---|---|
| The opening: port control, flight deck | 3 | radio (filtered) / intercom | not in the scene: flat |
| The opening: cabin crew | 1 | Sunita's | the seated passenger |
| The opening: the driver (Ada, Zuri or Jorge) | 4 each | their own crew voice | the driver's seat of the rover |
| Port workers (8 tower, 3 desks, 4 traders) | greeting, answer, offers | 15 distinct voices | their body |
| Hire candidates (6) | the pitch, hired / no ramp / settling / come aboard | one voice each | their body |
| Your hired crew | replies, order acceptances, call-outs | their voice | their body, wherever they sit on the ship |
| The pilot's trip panel | course, climb, burn, flip, arrival, landing | the pilot who flies it (Ada or Zuri), or the ship's own voice | the pilot's body, or flat |

- **337 clips, 4.85 MB** (mp3, mono, 24 kHz, about 15 KB each, largest 39 KB), under `assets/voices/`. Made with **Kokoro-82M** (Apache-2.0)
  on this machine: no key, no network, free. Cast by looking at each Loft portrait (`homes/people/*.jpg`):
  Ada, Sunita, Zuri women; Jorge, Aoi, Isaiah men; Walter the older man. The port picks bodies to match the voice
  (a woman's voice gets a woman's body; the two older-man voices get Walter).
- **Placed in space.** A Web Audio panner follows the speaker's body: it comes from their side, fades by 45 m, silent past it.
  Volume is the Settings slider.
- **New lines get voices automatically.** `node tools/gen-voices.mjs` reads the game's own dialogue data and the sentences in
  the crew, trip and job code, voices whatever has no clip yet, and rewrites the manifest. `validate.mjs` fails if any spoken
  line has no clip. Existing clips are kept (a clip is named by hash of voice + text), so only new lines cost time.
- **iPhone Safari:** audio unlocks on the first tap, key or click. The opening shows "Tap the screen once to turn on sound." until
  then (`09-opening-caption-and-sound-hint.png`). The page asks for a "playback" audio session so the silent switch does not mute it.
- **Browser voice as last fallback.** A line with no clip (it has a free number in it) is spoken by `speechSynthesis` in a voice of
  the right gender, not placed in space. These are the templates left to it: contact distance ("Contact at 412 metres"), terrain
  call-outs while roaming ("a ridge ahead, about 90 metres above us"), hull and shield read-out, position, altitude over Mars,
  core-sample mass, salvage tonnage, survey pay, "Stowed in the hold: ...". Everything else (including hull-percentage
  break-off calls and every place name) is pre-recorded.

Is it distinct? A rough pitch measurement of each cast voice (`tools/voice-pitch.py`, median F0): men 96 to 158 Hz, women
150 to 215 Hz, 24 voices, none identical. It is a sanity check, not a listening test. Zuri (152 Hz, a woman) and Aoi (158 Hz, a man)
sit close; they are different Kokoro voices, but listen to those two first.

## 2. Hear the players near you

WebRTC audio between players, the handshake carried by the authority's WebSocket (`server/voiceRelay.mjs`: offer, answer, ICE, bye,
to a named online player, 12 KB cap, rate limited, nothing stored).

- Connects inside **40 m**, lets go past **50 m**; volume falls from full at 6 m to silence at 45 m, panned to where they stand.
  **Same ship** is one crew channel: connected and full volume wherever you are aboard.
- You hear everyone near you with **no setup**. To talk, hold **Talk** (phone, bottom left above World / crew) or **B** (desktop).
- First press: a dialog in plain words ("only on while you hold the Talk button, goes straight to the players near you, nothing is
  recorded or kept"), then **Allow microphone**. The mic is let go 8 s after you release. If it is refused, you can still listen.
- Settings: **voice volume**, **player voice chat** on/off (off = no connections, mic released), **mute my microphone**.
- Works only in the shared world. Talk is hidden in solo, when alone, or when the browser has no WebRTC / microphone.

## What was verified

**Locally, by a machine (`node test/validate.mjs` on the rebased tree: 845 passed, 0 failed; voices are sections 32 and 33):**
- The cast, hashes, speaker prefixes, every hire candidate and port worker has a distinct voice, voice gender matches body kind.
- **Every static spoken line has a clip** (337 of 337), clips are real mp3, small.
- Distance gain curve, connect/hold/drop hysteresis, crew channel rule.
- The relay: unit tests, plus **two and three real WebSocket clients against a real authority**: the offer reaches only its target and is
  tagged with the true sender; a third player sees nothing; bad kinds and oversize are dropped without closing the socket.
- **Two real Chromium browsers with a fake microphone, real WebRTC** (`test/voice-browser.mjs`): two players 3 m apart connect with
  no setup; the mic dialog explains first and asks only after Allow; **holding Talk puts real audio packets into the other browser**
  (150 packets, 7.6 KB in 3 s; the listener's own analyser measures a signal) and the speaker shows in the listener's HUD; at 25 m
  the listener's gain is 0.26, at 60 m the connection drops; the same-ship rule connects them at 60 m at full volume; mute stops Talk;
  chat off drops every connection and releases the microphone; **the other direction works too** (the second player talks, the
  first hears: 217 packets and a clear signal), which matters because one side is always the offerer and the other the answerer;
  a phone-sized touch screen holds Talk with a real touch (CDP touch
  events) and audio reaches the other player.
- NPC speech: a port worker's clip decoded in Chromium, played through a panner at 12.5 m with its x position set from the
  speaker's body, and another worker 96 m away was refused as too far.
- **`test/phone-check.mjs` passes** on the iPhone 15 WebKit profile and the Galaxy S9 Chromium profile, with real touchscreen taps
  (voice rows work by touch, the chat checkbox toggles, the slider moves, the opening's port-control line reaches the voice system).

**Not verified, and why:**
- **Nobody heard any of it.** Audio cannot be heard headless. "Playing" means a decoded clip was started on a panner with a position.
  Whether the voices sound good, fit, are the right loudness, or are intelligible is unknown.
- **Real iOS Safari was not tested.** This machine's Playwright WebKit (Windows) has **no Web Audio, no WebRTC and no speechSynthesis**,
  so on that profile the voice system degrades silently (checked: it does not throw) and an mp3 decodes through an audio element
  (4.4 s, correct). Unlock-on-tap, panning and microphone use on an iPhone are untested; the code follows the documented iOS rules.
- **Real networks.** Both players were on one machine (host candidates). STUN only, no TURN: players on strict mobile or office
  networks (symmetric NAT) may never connect. A TURN relay is the fix if that happens.
- **Live proof is partial.** On https://www.heartbeatobservatory.com/games/the-cosmos/ (build 390119337877cff96e1e) `phone-check --live` passes on both profiles including the voices step (a live mp3 decodes and plays from a worker's body on Chromium; the settings rows work by touch). Two players talking on the live site, through `wss://cosmos.heartbeatobservatory.com`, have not been tried: the authority was restarted on the new build and `/health` is ok, nothing more.
- The crew channel was driven through the client's own "same ship" rule on two real peers; boarding two browsers onto one hull for
  it was not repeated here.
- The in-flight pilot lines were checked as data (every static line has a clip for Ada and Zuri and the ship), not by flying a trip
  and listening.

**A real bug the two-browser test found and this fixed:** the player answering a call had made its own audio line before applying
the other side's offer, so its microphone went to a line nobody negotiated and the offerer heard nothing from it. The answerer now
uses the line the offer creates. Without the reverse-direction test this would have shipped with one-way voice half the time.

## Files

New: `src/voice/{cast,lines,voice,proximity,voiceUI}.js`, `src/opening/dialogue.js`, `src/port/workerLines.js`,
`server/voiceRelay.mjs`, `tools/{gen-voices,scan-lines}.mjs`, `tools/voice-pitch.py`, `assets/voices/` (337 mp3, `manifest.json`,
`lines.json`), `test/{voice-checks,voice-browser,voice-shots}.mjs`.
Edited shared files (all marked `VOICES`): `src/main.js` (create voice, hook `ship.stations.onNote`, chat, per-frame update),
`src/ship/shipStations.js` (one `onNote` call), `src/crew/crewUI.js` (speak the panel), `src/opening/opening.js` (captions from
`dialogue.js`, speak them, sound hint), `src/port/portPeople.js` (lines from `workerLines.js`, body matches voice),
`src/world-state/multiplayerView.js` (the log you join with is not spoken), `src/world-state/remoteWorld.js` (`voice` message),
`server/index.mjs` (one line to relay `voice`), `index.html` (three settings rows), `server.js` (mp3 type), `test/validate.mjs`,
`test/phone-check.mjs`. Identity, hired-crew and save-slot code were not touched.

## Screenshots

`02-talk-button-desktop`, `03-mic-explained`, `04-listener-hears-speaker` (HUD "Alpha talking"), `05-settings-voice`,
`06-phone-talk-button`, `07-phone-mic-explained`, `08-phone-talking`, `09-opening-caption-and-sound-hint`,
`10-opening-cabin-crew`, `11-trader-talk-panel`; `browser-results.json` and `voice-log.json` hold the numbers.
