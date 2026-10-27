import { StudioSession, exportWAV, exportStems, renderSession, encodeMIDI } from './lib/libraries/studio/index.js';
import { encodeWAV, decodeWAV } from './lib/libraries/audio/wav.js';
import { toWebAudioBuffer } from './lib/libraries/audio/buffer.js';
import { applyStudioCommand } from './lib/core/commands/definitions/studio.js';
import { makeDemo } from './demo.js';

const $ = (s) => document.querySelector(s), esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const STORE = 'hb-studio-pro-1';
let session, selectedTrack = 'vocal', selectedClip = 'lead', tab = 'edit', audioContext, source, playingAt = 0, playTimer, recorder, recordChunks = [], recordStream;
const time = (tick) => { const s = session.time.seconds(tick); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(2).padStart(5, '0')}`; };
const download = (bytes, name, type = 'application/octet-stream') => { const url = URL.createObjectURL(new Blob([bytes], { type })), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 15000); };
const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
function status(text) { $('#status').textContent = text; }

function persist() {
  $('#saveState').textContent = 'Saving locally…';
  clearTimeout(persist.timer); persist.timer = setTimeout(() => {
    try { const media = {}; for (const [id, buffer] of session.media) media[id] = b64(encodeWAV(buffer, { bitDepth: 32 })); localStorage.setItem(STORE, JSON.stringify({ state: session.toJSON(), media })); $('#saveState').textContent = 'Saved on this device'; }
    catch (error) { $('#saveState').textContent = 'Storage full — export session'; status(error.message); }
  }, 250);
}
async function restore() {
  const raw = localStorage.getItem(STORE); if (!raw) return null;
  try { const saved = JSON.parse(raw), media = new Map(); for (const [id, data] of Object.entries(saved.media)) media.set(id, decodeWAV(unb64(data))); return new StudioSession({ state: saved.state, media, namespace: 'studio-pro' }); }
  catch { localStorage.removeItem(STORE); return null; }
}
function run(name, params, message = 'Edit recorded') {
  const result = applyStudioCommand(session, name, params); persist(); draw(); status(message); return result;
}
function selectTrack(id) { selectedTrack = id; const clips = Object.values(session.track(id).clips); selectedClip = clips[0]?.id || null; draw(); }

function drawTracks() {
  const length = Math.max(session.state.sampleRate * 4, ...session.tracks().flatMap((t) => Object.values(t.clips).map((c) => c.startTick + c.durationTicks)));
  $('#sections').innerHTML = session.state.sections.map((s) => `<div class="section" style="flex-grow:${s.durationTicks}">${esc(s.name)}</div>`).join('');
  $('#tracks').innerHTML = session.tracks().map((t) => `<div class="track ${t.id === selectedTrack ? 'selected' : ''}" data-track="${t.id}"><button class="tracklabel" data-select-track="${t.id}"><strong>${esc(t.name)}</strong><small>${t.kind} · ${Object.keys(t.takes).length} takes${t.mute ? ' · muted' : ''}</small></button><div class="lane">${Object.values(t.clips).map((c) => `<button class="clip ${t.kind === 'audio' ? 'audio' : ''} ${c.id === selectedClip ? 'selected' : ''}" data-clip="${c.id}" data-track="${t.id}" style="left:${c.startTick / length * 100}%;width:${Math.max(1.5, c.durationTicks / length * 100)}%" title="${esc(c.name)}">${esc(c.name)}${c.pitch ? ' ♪' : ''}</button>`).join('')}</div></div>`).join('');
  $('#position').value = time(session.state.transport.playhead);
}
function selected() { return selectedClip ? session.clip(selectedTrack, selectedClip) : null; }
function editPanel() {
  const c = selected(), t = session.track(selectedTrack);
  return `<h2>Clip editor</h2><p>${esc(t.name)} · ${c ? esc(c.name) : 'Select a clip'} · sample ${c?.startTick ?? 0}</p><div class="row"><button data-action="split" ${!c ? 'disabled' : ''}>Split at midpoint</button><button data-action="trim" ${!c ? 'disabled' : ''}>Trim 10%</button><button data-action="fade" ${!c ? 'disabled' : ''}>Fade edges</button><button data-action="stretch" ${!c ? 'disabled' : ''}>Stretch ×1.05</button><button data-action="reverse" ${!c ? 'disabled' : ''}>Reverse</button><button data-action="duplicate" ${!c ? 'disabled' : ''}>Duplicate</button></div><div class="grid"><label>Clip gain<input data-clip-gain type="range" min="0" max="2" step="0.01" value="${c?.gain ?? 1}"></label><label>Retune scale<select id="scale"><option>minor</option><option>major</option><option>chromatic</option></select></label></div><div class="row"><button data-action="pitch" ${!c || t.kind !== 'audio' ? 'disabled' : ''}>Detect + correct pitch</button></div>${c?.pitch ? `<div class="card"><strong>${c.pitch.averageCorrectionCents.toFixed(1)} cents average correction</strong><p>${c.pitch.notes.length} editable note ranges · ${c.pitch.frames.length} voiced/unvoiced analysis windows · source preserved</p></div>` : ''}<h3>Arrangement</h3><div class="row"><button data-action="section">Add section at end</button><button data-action="repeat">Repeat Verse</button><button data-action="marker">Add marker</button></div>`;
}
function takesPanel() {
  const t = session.track(selectedTrack), takes = Object.values(t.takes);
  return `<h2>Takes & comping</h2><p>Original multichannel captures stay separate. Comp ranges are non-destructive.</p>${takes.length ? takes.map((take, i) => `<div class="card"><strong>Take ${i + 1}</strong><p>${take.channels} channels · starts ${time(take.startTick)} · ${take.comped ? 'used in comp' : 'retained'}</p></div>`).join('') : '<p>Select the Comped take track, or record a new take.</p>'}<div class="row"><button data-action="comp" ${takes.length < 2 ? 'disabled' : ''}>Comp sequential takes</button><button data-action="record">Record another</button></div>`;
}
function notesPanel() {
  const t = session.track(selectedTrack), midi = t.notes || [], pattern = t.patterns[0];
  return `<h2>Notes & patterns</h2><p>Piano-roll MIDI carries velocity, channels, CC and pitch bend. Tap a cell to add/remove C3 notes.</p><div class="piano">${Array.from({ length: 16 }, (_, i) => `<button data-note="${i * 240}" class="${midi.some((n) => n.tick === i * 240 && n.midi === 48) ? 'on' : ''}">${i + 1}</button>`).join('')}</div><p>${midi.length} notes · <button data-action="midi">Export MIDI</button></p>${pattern ? `<h3>${esc(pattern.id)} step sequencer</h3>${pattern.rows.map((row, r) => `<p>${esc(row.instrument)}</p><div class="steps">${Array.from({ length: 16 }, (_, i) => `<button data-step="${r}:${i}" class="${row.steps.some((s) => s.step === i) ? 'on' : ''}">${i + 1}</button>`).join('')}</div>`).join('')}` : '<p>Select Beat for its step sequencer, or Bass MIDI for the piano roll.</p>'}`;
}
function mixPanel() {
  return `<h2>Mixer</h2><p>Gain, pan, mute, solo, polarity, buses and automation all live on the same clock.</p>${session.tracks().map((t) => `<div class="card"><strong>${esc(t.name)}</strong><div class="row"><button data-mute="${t.id}">${t.mute ? 'Unmute' : 'Mute'}</button><button data-solo="${t.id}">${t.solo ? 'Unsolo' : 'Solo'}</button></div><label>Gain <output>${t.gain.toFixed(2)}</output><input data-gain="${t.id}" type="range" min="0" max="1.5" step="0.01" value="${t.gain}"></label><label>Pan<input data-pan="${t.id}" type="range" min="-1" max="1" step="0.01" value="${t.pan}"></label></div>`).join('')}<div class="row"><button data-action="automate">Add gain ramp to selected</button><button data-action="bus">Add reverb bus</button><button data-action="snapshot">Snapshot mix</button></div><h3>Master</h3><div class="row"><select id="preset"><option value="streaming">Streaming −14 LUFS</option><option value="podcast">Podcast −16 LUFS</option><option value="club">Club −8 LUFS</option><option value="reference">Reference −23 LUFS</option></select><button data-action="master">Apply preset</button></div>`;
}
function lyricsPanel() {
  return `<h2>Time-linked lyrics</h2><p>Lines and words navigate the performance; export standard timed LRC.</p>${session.state.lyrics.lines.map((l) => `<div class="lyric"><time>${time(l.startTick)}</time> ${esc(l.text)}<small> · ${l.words.length} timed words</small></div>`).join('')}<div class="grid"><label>Start (samples)<input id="lyricStart" type="number" value="0"></label><label>End (samples)<input id="lyricEnd" type="number" value="12000"></label></div><label>Line<textarea id="lyricText">A new line in the room</textarea></label><div class="row"><button data-action="lyric">Add synced line</button><button data-action="lrc">Export LRC</button></div>`;
}
function picturePanel() {
  const p = session.state.picture;
  return `<h2>Sound for picture</h2><p>${p ? `Locked to ${esc(p.clockId)} at ${p.fps}/${p.fpsDen} fps · ${esc(p.shotId || 'no shot')}` : 'No picture lock'}.</p><div class="row"><input id="videoFile" type="file" accept="video/*"><button data-action="lock">Lock shot clock</button><button data-action="contact">Place engine contact at frame 30</button></div><div class="card"><strong>Material → sound → edit</strong><p>The demo contact uses wood against concrete. Its audio sample is converted from the exact 30 fps shot clock, not from a visual timer.</p><button data-action="why">Trace selected sound with why()</button></div><div id="why" class="why"></div>`;
}
function exportPanel() {
  return `<h2>Finish & deliver</h2><p>Mastering is measured. Stems share an origin and bypass the nonlinear master, so they recombine.</p><div class="exportgrid"><button data-action="wav">Master WAV<br><small>${session.state.master.targetLUFS} LUFS · 24-bit</small></button><button data-action="stems">Aligned stems<br><small>pre-master + manifest</small></button><button data-action="session">Editable session<br><small>state + history</small></button><button data-action="cover">Cover-art hook<br><small>PNG from session</small></button><button data-action="video">Music-video hook<br><small>canvas + song</small></button><button data-action="midi">MIDI<br><small>selected notes</small></button></div><div id="measurements"></div>`;
}
function draw() {
  drawTracks(); const panels = { edit: editPanel, takes: takesPanel, notes: notesPanel, mix: mixPanel, lyrics: lyricsPanel, picture: picturePanel, export: exportPanel };
  $('#panel').innerHTML = panels[tab](); document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
}
function showHistory() {
  const events = session.history.history.events.slice(-35).reverse().map((e) => `${e.type}  ${e.eventId}\n  subject: ${e.subject || '—'} · causes: ${(e.causes || []).join(', ') || 'root'}`).join('\n\n');
  $('#historyText').textContent = events; $('#historyDialog').showModal();
}

async function togglePlay() {
  if (source) { source.stop(); source = null; cancelAnimationFrame(playTimer); $('#play').textContent = '▶ Play'; return; }
  status('Rendering offline mix…'); await new Promise((r) => setTimeout(r, 20));
  const rendered = renderSession(session), Audio = window.AudioContext || window.webkitAudioContext; audioContext ||= new Audio(); await audioContext.resume();
  source = audioContext.createBufferSource(); source.buffer = toWebAudioBuffer(rendered.buffer, audioContext); source.connect(audioContext.destination); source.start(); playingAt = audioContext.currentTime; $('#play').textContent = '■ Stop';
  const tick = () => { if (!source) return; const elapsed = audioContext.currentTime - playingAt; $('#position').value = time(Math.min(rendered.length, elapsed * session.state.sampleRate)); if (elapsed < rendered.buffer.duration) playTimer = requestAnimationFrame(tick); }; tick();
  source.onended = () => { source = null; cancelAnimationFrame(playTimer); $('#play').textContent = '▶ Play'; };
}
async function toggleRecord() {
  if (recorder?.state === 'recording') { recorder.stop(); return; }
  const track = session.track(selectedTrack); if (track.kind !== 'audio') { status('Select an audio track to record'); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { status('This browser does not provide microphone recording'); return; }
  try {
    recordStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 2, echoCancellation: false, noiseSuppression: false } }); recordChunks = [];
    recorder = new MediaRecorder(recordStream); recorder.ondataavailable = (e) => { if (e.data.size) recordChunks.push(e.data); };
    recorder.onstop = async () => { try { const blob = new Blob(recordChunks, { type: recorder.mimeType }), Audio = window.AudioContext || window.webkitAudioContext; audioContext ||= new Audio(); const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer()); const take = run('studio.take.record', { track: selectedTrack, buffer: decoded, start: session.state.transport.playhead }, 'Take retained'); selectedClip = null; status(`Take ${take.id} retained · original untouched`); } catch (error) { status(error.message); } finally { recordStream.getTracks().forEach((t) => t.stop()); $('#record').textContent = '● Record'; } };
    recorder.start(250); $('#record').textContent = '■ Stop take'; status('Recording locally…');
  } catch (error) { status(error.message); }
}
function contactEvent() {
  const eventId = `engine-contact-${session.history.history.events.length + 1}`;
  return { eventId, event: { k: 'event', eventId, seq: 0, at: { clock: 'shot', tick: 30 }, type: 'contact.begin', subject: 'engine:ball', targets: ['engine:floor'], origin: 'physics', basis: 'made', basisOrigin: 'record', causes: [] }, at: { clock: 'shot', tick: 30 }, materialIds: ['wood', 'concrete'], impactSpeed: 2.8, mass: 1.2 };
}
async function coverArt() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1080; const ctx = canvas.getContext('2d'), gradient = ctx.createLinearGradient(0, 0, 1080, 1080); gradient.addColorStop(0, '#241a13'); gradient.addColorStop(1, '#9a593d'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1080); ctx.strokeStyle = '#e6bd73'; ctx.lineWidth = 7; for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.arc(540, 480, 60 + i * 23, 0, Math.PI * 1.5); ctx.stroke(); } ctx.fillStyle = '#f0e9dd'; ctx.font = '72px Georgia'; ctx.fillText(session.state.name, 80, 930); const blob = await new Promise((r) => canvas.toBlob(r, 'image/png')); download(await blob.arrayBuffer(), 'small-hours-cover.png', 'image/png');
}
async function musicVideo() {
  if (!window.MediaRecorder) { status('MediaRecorder is unavailable; use the hb-project video adapter'); return; }
  status('Making a real-time 4-second music video…'); const canvas = document.createElement('canvas'); canvas.width = 540; canvas.height = 960; const ctx = canvas.getContext('2d'), stream = canvas.captureStream(30), Audio = window.AudioContext || window.webkitAudioContext; audioContext ||= new Audio(); const rendered = renderSession(session, { master: true }), audio = audioContext.createBufferSource(), dest = audioContext.createMediaStreamDestination(); audio.buffer = toWebAudioBuffer(rendered.buffer, audioContext); audio.connect(dest); dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t)); const chunks = [], rec = new MediaRecorder(stream); rec.ondataavailable = (e) => chunks.push(e.data); rec.onstop = () => download(new Blob(chunks, { type: rec.mimeType }), 'small-hours-video.webm', rec.mimeType); rec.start(); audio.start(); const started = performance.now();
  const frame = () => { const elapsed = (performance.now() - started) / 1000; ctx.fillStyle = '#18120e'; ctx.fillRect(0, 0, 540, 960); ctx.fillStyle = '#e6bd73'; ctx.font = '42px Georgia'; ctx.fillText(session.state.name, 35, 100); const line = session.lyricAt(elapsed * session.state.sampleRate); ctx.fillStyle = '#f0e9dd'; ctx.font = '27px system-ui'; ctx.fillText(line?.text || 'Heartbeat Observatory', 35, 790, 470); ctx.fillStyle = '#c77b5c'; ctx.fillRect(35, 850, Math.min(470, elapsed / rendered.buffer.duration * 470), 8); if (elapsed < Math.min(4.2, rendered.buffer.duration)) requestAnimationFrame(frame); else { rec.stop(); status('Music video exported'); } }; frame();
}

async function action(name) {
  const c = selected();
  if (name === 'split' && c) run('studio.clip.edit', { track: selectedTrack, clip: c.id, operation: 'split', params: { at: c.startTick + Math.floor(c.durationTicks / 2) } }, 'Clip split');
  if (name === 'trim' && c) run('studio.clip.edit', { track: selectedTrack, clip: c.id, operation: 'trim', params: { start: c.startTick + Math.floor(c.durationTicks * 0.05), end: c.startTick + Math.floor(c.durationTicks * 0.95) } }, 'Edges trimmed');
  if (name === 'fade' && c) run('studio.clip.edit', { track: selectedTrack, clip: c.id, operation: 'fade', params: { fadeIn: 128, fadeOut: 128, curve: 'equal-power' } }, 'Equal-power fades set');
  if (name === 'stretch' && c) run('studio.clip.edit', { track: selectedTrack, clip: c.id, operation: 'stretch', params: { factor: 1.05 } }, 'Derivative stretched; source retained');
  if (name === 'reverse' && c) run('studio.clip.edit', { track: selectedTrack, clip: c.id, operation: 'reverse', params: {} }, 'Derivative reversed; source retained');
  if (name === 'duplicate' && c) run('studio.clip.edit', { track: selectedTrack, clip: c.id, operation: 'duplicate', params: {} }, 'Clip duplicated');
  if (name === 'pitch' && c) { status('Detecting pitch…'); await new Promise((r) => setTimeout(r, 20)); run('studio.pitch.correct', { track: selectedTrack, clip: c.id, options: { key: 'A', scale: $('#scale').value, window: 512, hop: 512 } }, 'Pitch corrected with scale lock'); }
  if (name === 'section') { const end = Math.max(0, ...session.state.sections.map((s) => s.startTick + s.durationTicks)); run('studio.section.add', { section: { name: `Section ${session.state.sections.length + 1}`, start: end, duration: session.state.sampleRate } }, 'Section added'); }
  if (name === 'repeat') run('studio.edit', { operation: 'section.repeat', params: { section: 'verse', at: session.state.sampleRate * 4 } }, 'Section repeated across media');
  if (name === 'marker') run('studio.edit', { operation: 'marker.add', params: { name: 'Cue', at: session.state.transport.playhead } }, 'Marker added');
  if (name === 'comp') { const takes = Object.values(session.track(selectedTrack).takes); let at = 0; const ranges = takes.map((t) => { const from = at; at += session.mediaBuffer(t.mediaId).length; return { take: t.id, from, to: at, sourceStart: 0 }; }); const comp = run('studio.take.comp', { track: selectedTrack, ranges }, 'New comp created'); selectedClip = comp.id; draw(); }
  if (name === 'record') toggleRecord();
  if (name === 'automate') run('studio.automation.set', { track: selectedTrack, parameter: 'gain', points: [{ tick: 0, value: 0.4 }, { tick: session.state.sampleRate * 4, value: 1, curve: 'smooth' }] }, 'Automation lane written');
  if (name === 'bus') { const id = `space-${Object.keys(session.state.buses).length}`; run('studio.edit', { operation: 'bus.add', params: { id, name: 'Reverb', inserts: [{ type: 'reverb', decay: 0.3, mix: 1 }] } }, 'Bus added'); run('studio.mixer.set', { id: selectedTrack, values: { sends: [{ bus: id, gain: 0.15 }] } }, 'Send connected'); }
  if (name === 'snapshot') run('studio.edit', { operation: 'mixer.snapshot', params: { name: `Mix ${Object.keys(session.state.mixSnapshots).length + 1}` } }, 'Mix snapshot stored');
  if (name === 'master') run('studio.edit', { operation: 'master.set', params: { preset: $('#preset').value, overrides: {} } }, 'Mastering preset applied');
  if (name === 'lyric') { const lines = [...session.state.lyrics.lines, { text: $('#lyricText').value, start: Number($('#lyricStart').value), end: Number($('#lyricEnd').value) }]; run('studio.edit', { operation: 'lyrics.set', params: { lines } }, 'Lyric synced'); }
  if (name === 'lrc') download(session.timedLyrics(), 'small-hours.lrc', 'text/plain');
  if (name === 'lock') { run('studio.edit', { operation: 'picture.lock', params: { clockId: 'shot', fps: 30, shotId: 'local-shot' } }, 'Picture locked to 30 fps'); }
  if (name === 'contact') { const placed = run('studio.sound.contact', { track: selectedTrack, contact: contactEvent() }, 'Contact placed from engine event'); selectedClip = placed.clip.id; $('#why').textContent = placed.why().chain.map((e) => `${e.type}\n${e.eventId}`).join('\n← '); draw(); }
  if (name === 'why') { if (!c?.soundId) { $('#why').textContent = 'Select the Contact clip on Beat first.'; return; } $('#why').textContent = session.why(c.soundId).chain.map((e) => `${e.type}\n${e.eventId}\ncauses: ${(e.causes || []).join(', ') || 'root'}`).join('\n\n↑\n'); }
  if (name === 'wav') { status('Mastering and measuring…'); await new Promise((r) => setTimeout(r, 20)); const out = exportWAV(session); download(out.bytes, 'small-hours-master.wav', 'audio/wav'); $('#measurements').innerHTML = `<div class="card"><strong class="loud">${out.rendered.master.loudness.integrated.toFixed(2)} LUFS</strong><p>${out.rendered.master.truePeak.dbTP.toFixed(2)} dBTP · ${out.bytes.length.toLocaleString()} bytes · ${out.rendered.master.withinTolerance ? 'within target tolerance' : 'outside target tolerance'}</p></div>`; persist(); status('Master WAV exported'); }
  if (name === 'stems') { const out = exportStems(session); out.files.forEach((f, i) => setTimeout(() => download(f.bytes, f.name, 'audio/wav'), i * 120)); download(JSON.stringify(out.manifest, null, 2), 'small-hours-stems.json', 'application/json'); $('#measurements').innerHTML = `<div class="card"><strong>${out.files.length} aligned stems</strong><p>Recombination maximum error: ${out.recombinationMaxError}</p></div>`; status('Stems exported'); }
  if (name === 'session') download(JSON.stringify(session.toJSON(), null, 2), 'small-hours.hb-studio.json', 'application/json');
  if (name === 'midi') download(encodeMIDI([{ name: session.track(selectedTrack).name, notes: session.track(selectedTrack).notes }]), 'small-hours.mid', 'audio/midi');
  if (name === 'cover') coverArt();
  if (name === 'video') musicVideo();
}

$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; draw(); } });
$('#tracks').addEventListener('click', (e) => { const b = e.target.closest('[data-track]'); if (!b) return; selectedTrack = b.dataset.track; selectedClip = b.dataset.clip || Object.values(session.track(selectedTrack).clips)[0]?.id || null; draw(); });
$('#panel').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b || b.disabled) return; if (b.dataset.action) action(b.dataset.action).catch((error) => status(error.message)); if (b.dataset.mute) run('studio.mixer.set', { id: b.dataset.mute, values: { mute: !session.track(b.dataset.mute).mute } }, 'Mute changed'); if (b.dataset.solo) run('studio.mixer.set', { id: b.dataset.solo, values: { solo: !session.track(b.dataset.solo).solo } }, 'Solo changed'); if (b.dataset.note) { const t = session.track(selectedTrack), tick = Number(b.dataset.note), notes = t.notes.some((n) => n.tick === tick && n.midi === 48) ? t.notes.filter((n) => !(n.tick === tick && n.midi === 48)) : [...t.notes, { tick, duration: 240, midi: 48, velocity: 0.8 }]; run('studio.midi.set', { track: selectedTrack, notes }, 'Piano roll edited'); } if (b.dataset.step) { const [r, i] = b.dataset.step.split(':').map(Number), pattern = structuredClone(session.track(selectedTrack).patterns[0]), row = pattern.rows[r], at = row.steps.findIndex((s) => s.step === i); if (at >= 0) row.steps.splice(at, 1); else row.steps.push({ step: i }); run('studio.step.set', { track: selectedTrack, pattern }, 'Step edited'); } });
$('#panel').addEventListener('input', (e) => { if (e.target.dataset.gain) run('studio.mixer.set', { id: e.target.dataset.gain, values: { gain: Number(e.target.value) } }, 'Gain changed'); if (e.target.dataset.pan) run('studio.mixer.set', { id: e.target.dataset.pan, values: { pan: Number(e.target.value) } }, 'Pan changed'); if (e.target.dataset.clipGain && selected()) run('studio.clip.edit', { track: selectedTrack, clip: selectedClip, operation: 'gain', params: { gain: Number(e.target.value) } }, 'Clip gain changed'); });
$('#panel').addEventListener('change', (e) => { if (e.target.id === 'videoFile' && e.target.files[0]) { const url = URL.createObjectURL(e.target.files[0]); $('#reference').src = url; $('#reference').hidden = false; $('#reference').className = 'card'; $('#reference').style.width = '100%'; $('#reference').controls = true; } });
$('#play').onclick = () => togglePlay().catch((e) => status(e.message)); $('#record').onclick = () => toggleRecord(); $('#rewind').onclick = () => { run('studio.edit', { operation: 'transport.set', params: { playhead: 0 } }, 'Returned to start'); }; $('#save').onclick = persist; $('#addTrack').onclick = () => { const t = run('studio.track.add', { name: `Audio ${session.tracks().length + 1}`, kind: 'audio' }, 'Track added'); selectTrack(t.id); }; $('#undoInfo').onclick = showHistory; $('#closeHistory').onclick = () => $('#historyDialog').close();
document.addEventListener('visibilitychange', () => { if (document.hidden && recorder?.state === 'recording') recorder.stop(); });

session = await restore() || makeDemo(); if (!session.track(selectedTrack)) selectedTrack = session.state.trackOrder[0]; draw();
window.studioPro = { get session() { return session; }, run, render: () => renderSession(session), exportWAV: () => exportWAV(session), exportStems: () => exportStems(session), selectTrack, makeDemo };
