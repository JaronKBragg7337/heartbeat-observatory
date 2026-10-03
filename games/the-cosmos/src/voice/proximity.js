// ============================================================================
// proximity.js - hear the players near you. WebRTC audio between players in the shared world, with the handshake carried
// by the authority's WebSocket (server/voiceRelay.mjs); the audio itself goes straight between the two browsers.
//
//   * Players connect when they are close (ENTER_M) and let go when they drift away (LEAVE_M), or when they are aboard the
//     same ship: that is the crew channel, heard at full volume wherever you stand on the ship.
//   * Heard volume follows distance (full inside 6 m, silent at 45 m) and the voice is panned to where the speaker stands.
//   * You hear everyone near you with no setup. To TALK you hold the Talk button (phone) or B (desktop). The microphone is
//     asked for the first time you press it, after a plain-words explanation; it is only live while the button is held, and
//     is let go a few seconds after you let go.
//   * Settings: voice volume, chat on/off, mute my mic.
// STUN only (no TURN): two players behind strict mobile or corporate NATs may not connect. Nothing here is verified by ear.
// ============================================================================
import { distanceGain, HEARD_M } from './voice.js';

export const ENTER_M = 40, LEAVE_M = 50;
const ICE = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
const MIC_KEY = 'cosmos-voice-mic-ok';
const MIC_HOLD_S = 8;           // keep the mic open this long after the button is released, then let it go

/** Pure: should we be connected to this player? hysteresis stops flapping at the edge. */
export function wantConnection({ sameShip, dist, connected }) {
  if (sameShip) return true;
  return connected ? dist <= LEAVE_M : dist <= ENTER_M;
}
/** Pure: how loud is a connected player. */
export function chatGain({ sameShip, dist }) { return sameShip ? 1 : distanceGain(dist); }

export class ProximityChat {
  /** o: { world, voice, camera, bodyOf(id) -> Object3D|null, sameFrame(id) -> bool, onChange() } */
  constructor(o) {
    Object.assign(this, { world: o.world, voice: o.voice, bodyOf: o.bodyOf || (() => null), sameFrame: o.sameFrame || (() => true), onChange: o.onChange || (() => {}) });
    this.peers = new Map(); this.cool = new Map();   // cool: player id -> do not reconnect before this time (stops a failing pair from storming)
    this.mic = null; this.track = null; this.talking = false; this.micTimer = 0; this.micAsk = null;
    this.t = 0; this.evalT = 0;
    this.speaking = new Map();            // player id -> level 0..1, for the HUD
    this.stats = { offers: 0, answers: 0, ice: 0, connected: 0, remoteTracks: 0, micStarts: 0 };
    this.history = [];               // what happened, newest last (for tests and bug reports)
    this.q = Promise.resolve();      // handshake messages are handled one at a time, in order
    this.world.onVoice = (m) => { this.q = this.q.then(() => this._signal(m)).catch(() => {}); };
    this.voice.listeners.add((k) => { if (k === 'chat' || k === 'muteMic') this._settingsChanged(); });
  }
  get enabled() { return !!this.voice.settings.chat; }
  get myId() { return this.world.playerId; }
  players() { const s = this.world.snapshot; return s ? Object.values(s.players).filter((p) => p.id !== this.myId && p.online && !(p.opening && !p.opening.complete)) : []; }
  me() { return this.world.snapshot?.players?.[this.myId] || null; }
  /** Is there anyone to talk to? (the Talk button shows only then) */
  anyoneHere() { return this.canTalk && this.enabled && this.world.connected && this.players().length > 0; }
  /** The browser can do WebRTC and ask for a microphone (needs HTTPS; the live site has it). */
  get canTalk() { return typeof RTCPeerConnection !== 'undefined' && !!navigator.mediaDevices?.getUserMedia; }
  ready() { const me = this.me(); return !!this.world.snapshot && this.world.connected && !!me && !(me.opening && !me.opening.complete); }

  // ---- per frame -------------------------------------------------------------------------------------------------
  tick() {
    // wall-clock time, not frame time: connections and the mic must not stretch when the frame rate drops
    this.t = performance.now() / 1000;
    const me = this.me();
    if (!this.world.snapshot || !me || (me.opening && !me.opening.complete)) { if (this.peers.size) this.closeAll('not in the shared world'); return; }
    // a dropped socket does not end a call that is already up (the audio is browser to browser); it only stops new handshakes
    if (this.world.connected && this.t - this.evalT >= 0.5) { this.evalT = this.t; this._evaluate(); }
    this._place();
    if (this.micTimer && !this.talking && this.t > this.micTimer) this._releaseMic();
  }
  _distance(id) {
    if (!this.sameFrame(id)) return Infinity;
    const b = this.bodyOf(id); if (!b) return Infinity;
    return this.voice._distanceTo({ source: b });
  }
  _sameShip(p) { const me = this.me(); return !!(me && me.aboardShipId && p.aboardShipId === me.aboardShipId); }
  _evaluate() {
    const seen = new Set();
    for (const p of this.players()) {
      seen.add(p.id);
      const peer = this.peers.get(p.id), sameShip = this._sameShip(p), dist = this._distance(p.id);
      const want = this.enabled && wantConnection({ sameShip, dist, connected: !!peer });
      if (want && !peer) { if ((this.cool.get(p.id) || 0) <= this.t) this._open(p.id, this.myId < p.id); }
      else if (!want && peer) { peer.dropAt ??= this.t + 4; if (this.t >= peer.dropAt) this._close(p.id, true, 'out of range ' + Math.round(dist) + ' m'); }
      else if (peer) peer.dropAt = null;
    }
    for (const id of [...this.peers.keys()]) if (!seen.has(id)) this._close(id, false, 'player gone (' + (this.world.snapshot?.players?.[id] ? (this.world.snapshot.players[id].online ? 'opening' : 'offline') : 'unknown') + ')');
    this.onChange();
  }

  // ---- connections -----------------------------------------------------------------------------------------------
  _hist(e) { this.history.push(Math.round(performance.now() / 100) / 10 + ' ' + e); if (this.history.length > 40) this.history.shift(); }
  _open(id, initiator) {
    this._hist('open ' + id.slice(0, 4) + (initiator ? ' (offerer)' : ' (answerer)'));
    if (typeof RTCPeerConnection === 'undefined') return null;
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const peer = { id, pc, initiator, queued: [], remote: false, level: 0, state: 'new', dropAt: null, log: [] };
    const note = (e) => { peer.log.push(Math.round(performance.now() / 100) / 10 + ' ' + e); if (peer.log.length > 24) peer.log.shift(); };
    peer.note = note;
    this.peers.set(id, peer);
    // The offerer makes the one audio line (we may send and receive on it). The answerer must NOT make its own: applying the offer
    // creates the negotiated one, and a second, unnegotiated transceiver would carry our microphone to nobody (see _signal).
    if (initiator) {
      const tr = pc.addTransceiver('audio', { direction: 'sendrecv' }); peer.sender = tr.sender;
      if (this.track) tr.sender.replaceTrack(this.track).catch(() => {});
    }
    pc.onicecandidate = (e) => { if (e.candidate) { this.stats.ice++; this.world.sendVoice(id, { kind: 'ice', cand: e.candidate.toJSON() }); } };
    pc.ontrack = (e) => { this.stats.remoteTracks++; peer.stream = e.streams[0] || new MediaStream([e.track]); this._attach(peer); };
    pc.oniceconnectionstatechange = () => note('ice ' + pc.iceConnectionState);
    pc.onconnectionstatechange = () => {
      peer.state = pc.connectionState; note('conn ' + pc.connectionState);
      if (pc.connectionState === 'connected') this.stats.connected++;
      if (['failed', 'closed'].includes(pc.connectionState)) this._close(id, true, 'connection ' + pc.connectionState);
      this.onChange();
    };
    if (initiator) this._offer(peer);
    return peer;
  }
  async _offer(peer) {
    try {
      const offer = await peer.pc.createOffer(); await peer.pc.setLocalDescription(offer);
      this.stats.offers++; this.world.sendVoice(peer.id, { kind: 'offer', sdp: peer.pc.localDescription.sdp });
    } catch (e) { peer.note('offer error ' + (e?.message || e)); this._close(peer.id, true, 'offer failed'); }
  }
  async _signal(m) {
    const id = m.from, d = m.data || {};
    this._hist('got ' + d.kind + ' ' + id.slice(0, 4));
    if (d.kind === 'bye') { this._close(id, false, 'they let go'); return; }   // they let go: do not answer with a bye of our own
    if (!this.enabled || !this.ready()) return;
    let peer = this.peers.get(id);
    try {
      if (d.kind === 'offer') {
        if (peer && (peer.initiator || peer.remote)) { this._close(id, false, 'fresh offer'); peer = null; }       // a fresh offer means a fresh connection: never renegotiate an old one
        if (!this.players().some((p) => p.id === id)) return;
        peer ||= this._open(id, false); if (!peer) return;
        await peer.pc.setRemoteDescription({ type: 'offer', sdp: d.sdp }); peer.remote = true;
        const tr = peer.pc.getTransceivers().find((t) => t.receiver?.track?.kind === 'audio');
        if (tr) { tr.direction = 'sendrecv'; peer.sender = tr.sender; if (this.track) await tr.sender.replaceTrack(this.track).catch(() => {}); }
        for (const c of peer.queued.splice(0)) await peer.pc.addIceCandidate(c).catch(() => {});
        const answer = await peer.pc.createAnswer(); await peer.pc.setLocalDescription(answer);
        this.stats.answers++; this.world.sendVoice(id, { kind: 'answer', sdp: peer.pc.localDescription.sdp });
      } else if (d.kind === 'answer' && peer && peer.initiator && peer.pc.signalingState === 'have-local-offer') {
        await peer.pc.setRemoteDescription({ type: 'answer', sdp: d.sdp }); peer.remote = true;
        for (const c of peer.queued.splice(0)) await peer.pc.addIceCandidate(c).catch(() => {});
      } else if (d.kind === 'ice' && peer && d.cand) {
        if (peer.remote) await peer.pc.addIceCandidate(d.cand).catch(() => {}); else peer.queued.push(d.cand);
      }
    } catch (e) { peer?.note?.('signal error ' + (e?.message || e)); /* a bad handshake just means no voice with that player until the next try */ if (peer) this._close(id, true, 'handshake error'); }
  }
  _close(id, tell, why = '') {
    const peer = this.peers.get(id); if (!peer) return;
    this._hist('close ' + id.slice(0, 4) + ' ' + why + ' ' + peer.state);
    this.peers.delete(id); this.speaking.delete(id); this.cool.set(id, this.t + 2.5);
    if (tell) this.world.sendVoice(id, { kind: 'bye' });
    try { peer.pc.onconnectionstatechange = null; peer.pc.close(); } catch { /* closed */ }
    try { peer.el?.pause(); peer.el && (peer.el.srcObject = null); peer.src?.disconnect(); peer.panner?.disconnect(); peer.gain?.disconnect(); peer.analyser?.disconnect(); } catch { /* gone */ }
    this.onChange();
  }
  closeAll(why = 'close all') { for (const id of [...this.peers.keys()]) this._close(id, true, why); }

  // ---- hearing them --------------------------------------------------------------------------------------------------
  _attach(peer) {
    const v = this.voice, ctx = v.ctx; if (!peer.stream) return;
    if (!ctx || !v.master) { peer.needsAttach = true; return; }
    peer.needsAttach = false;
    // Chromium only delivers a remote WebRTC stream to Web Audio when it is also attached to a media element
    const el = peer.el = new Audio(); el.muted = true; el.autoplay = true; el.playsInline = true; el.srcObject = peer.stream; el.play?.().catch(() => {});
    peer.src = ctx.createMediaStreamSource(peer.stream);
    peer.panner = ctx.createPanner(); peer.panner.panningModel = 'equalpower'; peer.panner.distanceModel = 'inverse'; peer.panner.rolloffFactor = 0;
    peer.gain = ctx.createGain(); peer.gain.gain.value = 0;
    peer.analyser = ctx.createAnalyser(); peer.analyser.fftSize = 256;
    peer.src.connect(peer.analyser); peer.src.connect(peer.panner); peer.panner.connect(peer.gain); peer.gain.connect(v.master);
    peer.buf = new Uint8Array(peer.analyser.fftSize);
  }
  _place() {
    const v = this.voice, ctx = v.ctx; if (!ctx) return;
    for (const [id, peer] of this.peers) {
      if (peer.needsAttach) this._attach(peer);
      if (!peer.gain) continue;
      const p = this.world.snapshot.players[id], sameShip = !!(p && this._sameShip(p)), dist = this._distance(id);
      const g = this.enabled ? chatGain({ sameShip, dist }) : 0;
      peer.gain.gain.setTargetAtTime(g, ctx.currentTime, 0.1); peer.heard = g;
      const b = this.bodyOf(id);
      if (b && !sameShip && Number.isFinite(dist)) { const r = v._rel(b), t = ctx.currentTime;
        if (peer.panner.positionX) { peer.panner.positionX.setTargetAtTime(r.x, t, 0.05); peer.panner.positionY.setTargetAtTime(r.y, t, 0.05); peer.panner.positionZ.setTargetAtTime(r.z, t, 0.05); } else peer.panner.setPosition(r.x, r.y, r.z);
      } else if (peer.panner.positionX) { peer.panner.positionX.setTargetAtTime(0, ctx.currentTime, 0.05); peer.panner.positionZ.setTargetAtTime(-1, ctx.currentTime, 0.05); }
      // who is talking right now (for the HUD)
      peer.analyser.getByteTimeDomainData(peer.buf); let s = 0; for (const x of peer.buf) { const d = (x - 128) / 128; s += d * d; }
      const lvl = Math.sqrt(s / peer.buf.length); peer.level = lvl;
      if (lvl > 0.02 && g > 0.02) this.speaking.set(id, lvl); else this.speaking.delete(id);
    }
  }

  // ---- talking -----------------------------------------------------------------------------------------------------
  micOk() { try { return localStorage.getItem(MIC_KEY) === '1'; } catch { return false; } }
  /** Press: start talking. Returns 'talking' | 'explain' (show the plain-words dialog first) | 'off'. */
  async pressTalk() {
    if (!this.enabled || this.voice.settings.muteMic) return 'off';
    this.talking = true; this.micTimer = 0;
    if (!this.track || this.track.readyState !== 'live') {
      if (!this.micOk()) { this.talking = false; return 'explain'; }
      const ok = await this.startMic(); if (!ok) { this.talking = false; return 'off'; }
    }
    if (!this.talking) return 'off';       // let go while the mic was starting
    this.track.enabled = true; this.onChange(); return 'talking';
  }
  releaseTalk() {
    this.talking = false;
    if (this.track) this.track.enabled = false;
    this.micTimer = this.t + MIC_HOLD_S; this.onChange();
  }
  /** Called from the dialog's Allow button (a real tap, which is what the browser needs to ask). */
  async startMic() {
    if (this.track && this.track.readyState === 'live') return true;
    if (this.micAsk) return this.micAsk;
    this.micAsk = (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
        this.mic = stream; this.track = stream.getAudioTracks()[0]; this.track.enabled = this.talking;
        this.stats.micStarts++;
        try { localStorage.setItem(MIC_KEY, '1'); } catch { /* storage blocked */ }
        for (const peer of this.peers.values()) peer.sender?.replaceTrack(this.track).catch(() => {});
        return true;
      } catch (e) { this.micError = e?.name || 'denied'; return false; }
      finally { this.micAsk = null; }
    })();
    return this.micAsk;
  }
  _releaseMic() {
    this.micTimer = 0;
    if (this.mic) for (const t of this.mic.getTracks()) t.stop();
    for (const peer of this.peers.values()) peer.sender?.replaceTrack(null).catch(() => {});
    this.mic = null; this.track = null; this.onChange();
  }
  _settingsChanged() {
    if (!this.enabled) { this.talking = false; this._releaseMic(); this.closeAll(); }
    else if (this.voice.settings.muteMic) { this.talking = false; if (this.track) this.track.enabled = false; }
    this.onChange();
  }
  /** For tests and the review page. */
  summary() { return { enabled: this.enabled, peers: [...this.peers.values()].map((p) => ({ id: p.id, state: p.state, initiator: p.initiator, heard: p.heard ?? null, level: p.level, log: p.log })), stats: { ...this.stats }, history: this.history.slice(-14), mic: !!this.track, talking: this.talking, HEARD_M }; }
}
