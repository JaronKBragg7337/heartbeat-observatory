// ============================================================================
// multiplayer.js - optional Heartbeat/Supabase realtime presence for SYL.
//
// OWNS: remote-player rendering, realtime identity, low-rate state broadcast.
// DOES NOT OWN: physics, traversal, save data, ship modules, inventory, combat.
//
// Heartbeat law: presence.track() is join/leave identity only. Movement rides
// broadcast state at <=10Hz with idle suppression and a 250ms interpolation
// buffer. If realtime fails, the game remains a normal singleplayer build.
// ============================================================================

import * as THREE from 'three';
import { MODE } from '../world/traversal.js';

const SUPA_URL = 'https://ygjpnvrwhkrowkrskftk.supabase.co';
const SUPA_KEY = 'sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN';
const GAME_CHANNEL = 'game-syl-public';
const LOBBY_CHANNEL = 'observatory-games-public';
const COLORS = ['#64b5f6', '#81c784', '#ffb74d', '#e57373', '#ba68c8', '#4db6ac', '#fff176', '#f06292'];

export class Multiplayer {
  constructor({ engine, player, ship, traversal, civilTransportFleet }) {
    this.engine = engine;
    this.player = player;
    this.ship = ship;
    this.traversal = traversal;
    this.civilTransportFleet = civilTransportFleet || [];

    this.supabase = null;
    this.channel = null;
    this.lobby = null;
    this.connected = false;
    this.lobbyConnected = false;
    this.id = getGuestId();
    this.name = defaultGuestName(this.id);
    this.color = COLORS[hash(this.id) % COLORS.length];
    this.remotes = new Map();
    this.remoteTransports = [];
    this.sendAccumulator = 0;
    this.lastSentSig = '';
    this.lastSentAt = 0;
    this.reconnectTimer = null;
    this.lobbyIds = new Set();

    this.chip = ensureChip();
    this.setChip('solo');
    this.connect();
    window.addEventListener('pagehide', () => this.disconnect());
  }

  async connect() {
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      this.supabase = createClient(SUPA_URL, SUPA_KEY, {
        realtime: { params: { eventsPerSecond: 24 } }
      });
      await this.loadIdentity();
      this.connectGameChannel();
      this.connectLobbyChannel();
    } catch (e) {
      this.connected = false;
      this.setChip('solo');
    }
  }

  async loadIdentity() {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;
      this.id = uid;
      const { data } = await this.supabase
        .from('world_characters')
        .select('display_name, appearance')
        .eq('auth_user_id', uid)
        .maybeSingle();
      this.name = sanitize(data?.display_name) || sanitize(session.user.email) || this.name;
      const appearance = normalizeAppearance(data?.appearance);
      if (appearance?.color) this.color = appearance.color;
    } catch (e) {
      // Guest identity is enough for public playtesting.
    }
  }

  connectGameChannel() {
    if (!this.supabase || this.channel) return;
    this.channel = this.supabase.channel(GAME_CHANNEL, {
      config: {
        presence: { key: this.id },
        broadcast: { self: false }
      }
    });
    this.channel.on('broadcast', { event: 'state' }, ({ payload }) => this.applyPeerState(payload));
    this.channel.on('presence', { event: 'sync' }, () => this.syncGamePresence());
    this.channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      for (const p of leftPresences || []) {
        const id = p.id || p.key;
        if (id && id !== this.id) this.removeRemote(id);
      }
      this.updateChip();
    });
    this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.connected = true;
        this.trackSelf();
        this.sendState(true);
        this.updateChip();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        this.connected = false;
        this.updateChip();
        this.scheduleReconnect();
      }
    });
  }

  connectLobbyChannel() {
    if (!this.supabase || this.lobby) return;
    this.lobby = this.supabase.channel(LOBBY_CHANNEL, {
      config: {
        presence: { key: 'syl:' + this.id },
        broadcast: { self: false }
      }
    });
    this.lobby.on('presence', { event: 'sync' }, () => this.syncLobbyPresence());
    this.lobby.on('presence', { event: 'join' }, () => this.syncLobbyPresence());
    this.lobby.on('presence', { event: 'leave' }, () => this.syncLobbyPresence());
    this.lobby.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.lobbyConnected = true;
        this.trackLobby();
        this.syncLobbyPresence();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        this.lobbyConnected = false;
        this.updateChip();
      }
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      try { if (this.channel) this.supabase.removeChannel(this.channel); } catch (e) {}
      this.channel = null;
      this.connectGameChannel();
    }, 2200);
  }

  disconnect() {
    try { this.channel?.untrack(); } catch (e) {}
    try { this.lobby?.untrack(); } catch (e) {}
  }

  trackSelf() {
    try {
      this.channel.track({
        id: this.id,
        name: this.name,
        color: this.color,
        game: 'syl'
      });
    } catch (e) {}
  }

  trackLobby() {
    try {
      this.lobby.track({
        id: 'syl:' + this.id,
        playerId: this.id,
        name: this.name,
        color: this.color,
        game: 'syl',
        label: 'SYL'
      });
    } catch (e) {}
  }

  update(dt) {
    this.sendAccumulator += dt;
    this.updateRemotes(dt);
    this.sendState(false);
  }

  localState() {
    const piloting = this.traversal.mode === MODE.PILOTING;
    const source = piloting ? this.ship : this.player;
    const q = piloting ? this.ship.quaternion : this.player.bodyMesh.quaternion;
    const body = piloting ? this.ship._domBody : this.player.dominant?.();
    const transports = this.civilTransportFleet.map((t) => ({
      x: t.worldPos.x, y: t.worldPos.y, z: t.worldPos.z,
      qx: t.quaternion.x, qy: t.quaternion.y, qz: t.quaternion.z, qw: t.quaternion.w,
      routeIndex: t.routeIndex, state: t.state, passenger: t.passenger,
    }));
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      game: 'syl',
      mode: piloting ? 'ship' : 'foot',
      bodyId: body?.id || 'earth',
      x: source.worldPos.x,
      y: source.worldPos.y,
      z: source.worldPos.z,
      qx: q.x,
      qy: q.y,
      qz: q.z,
      qw: q.w,
      yaw: this.player.yaw,
      pitch: this.player.pitch,
      throttle: this.ship.throttle || 0,
      landed: !!this.ship.landed,
      transports,
    };
  }

  sendState(force = false) {
    if (!this.connected || !this.channel) return;
    if (!force && this.sendAccumulator < 0.1) return;
    const state = this.localState();
    const sig = [
      state.mode,
      state.bodyId,
      state.x.toFixed(2),
      state.y.toFixed(2),
      state.z.toFixed(2),
      state.qx.toFixed(2),
      state.qy.toFixed(2),
      state.qz.toFixed(2),
      state.throttle.toFixed(2),
      state.landed ? 1 : 0,
      state.transports.map((t) => `${t.x.toFixed(0)}|${t.state}|${t.passenger ? 1 : 0}`).join(','),
    ].join('|');
    if (!force && sig === this.lastSentSig && performance.now() - this.lastSentAt < 5000) return;
    this.lastSentSig = sig;
    this.lastSentAt = performance.now();
    this.sendAccumulator = 0;
    try {
      this.channel.send({ type: 'broadcast', event: 'state', payload: state });
    } catch (e) {}
  }

  applyPeerState(state) {
    if (!validState(state) || state.id === this.id) return;
    let remote = this.remotes.get(state.id);
    if (!remote) {
      remote = createRemote(this.engine, state);
      this.remotes.set(state.id, remote);
      this.engine.scene.add(remote.group);
      this.updateChip();
    }
    const now = performance.now();
    const pos = new THREE.Vector3(state.x, state.y, state.z);
    remote.target.copy(pos);
    remote.targetQuat.set(state.qx || 0, state.qy || 0, state.qz || 0, state.qw ?? 1).normalize();
    remote.mode = state.mode === 'ship' ? 'ship' : 'foot';
    remote.name = sanitize(state.name) || remote.name;
    remote.lastUpdate = now;
    remote.buf.push({ t: now, pos, q: remote.targetQuat.clone(), mode: remote.mode });
    if (remote.buf.length > 10) remote.buf.shift();

    // Remote transport markers
    if (state.transports && state.transports.length > 0) {
      this.updateRemoteTransports(state.transports);
    }
  }

  updateRemoteTransports(transports) {
    while (this.remoteTransports.length < transports.length) {
      const group = new THREE.Group();
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(7.5, 3.2, 20),
        new THREE.MeshLambertMaterial({ color: 0x607d8b, transparent: true, opacity: 0.5 })
      );
      group.add(marker);
      const worldPos = new THREE.Vector3();
      const trackEntry = this.engine.trackWorldObject({ worldPos, object3d: group });
      this.engine.scene.add(group);
      this.remoteTransports.push({ group, worldPos, trackEntry });
    }
    for (let i = 0; i < transports.length; i++) {
      const t = transports[i];
      const rt = this.remoteTransports[i];
      rt.worldPos.set(t.x, t.y, t.z);
      rt.group.quaternion.set(t.qx || 0, t.qy || 0, t.qz || 0, t.qw ?? 1);
      rt.group.visible = true;
    }
    for (let i = transports.length; i < this.remoteTransports.length; i++) {
      this.remoteTransports[i].group.visible = false;
    }
  }

  syncGamePresence() {
    if (!this.channel) return;
    const live = new Set();
    const state = this.channel.presenceState();
    for (const key in state) {
      const meta = state[key]?.[0];
      const id = meta?.id || key;
      if (!id || id === this.id) continue;
      live.add(id);
    }
    for (const id of [...this.remotes.keys()]) {
      if (!live.has(id) && performance.now() - this.remotes.get(id).lastUpdate > 5000) this.removeRemote(id);
    }
    this.updateChip();
  }

  syncLobbyPresence() {
    if (!this.lobby) return;
    this.lobbyIds.clear();
    const state = this.lobby.presenceState();
    for (const key in state) {
      const meta = state[key]?.[0];
      const id = meta?.id || key;
      if (id) this.lobbyIds.add(id);
    }
    this.updateChip();
  }

  updateRemotes(dt) {
    const renderT = performance.now() - 250;
    const blend = Math.min(1, dt * 12);
    for (const [id, remote] of this.remotes) {
      if (performance.now() - remote.lastUpdate > 20000) {
        this.removeRemote(id);
        continue;
      }
      const buf = remote.buf;
      if (buf.length >= 2 && buf[buf.length - 1].t >= renderT) {
        while (buf.length > 2 && buf[1].t <= renderT) buf.shift();
        const a = buf[0], b = buf[1] || a;
        if (b.t - a.t > 1200) {
          buf.splice(0, buf.length - 1);
          remote.worldPos.copy(b.pos);
          remote.group.quaternion.copy(b.q);
          remote.mode = b.mode;
        } else {
          const span = Math.max(1, b.t - a.t);
          const k = Math.max(0, Math.min(1, (renderT - a.t) / span));
          remote.worldPos.lerpVectors(a.pos, b.pos, k);
          remote.group.quaternion.slerpQuaternions(a.q, b.q, k);
          remote.mode = b.mode;
        }
      } else if (buf.length) {
        const latest = buf[buf.length - 1];
        remote.worldPos.lerp(latest.pos, blend);
        remote.group.quaternion.slerp(latest.q, blend);
        remote.mode = latest.mode;
      }
      remote.avatar.visible = remote.mode !== 'ship';
      remote.ship.visible = remote.mode === 'ship';
    }
  }

  removeRemote(id) {
    const remote = this.remotes.get(id);
    if (!remote) return;
    this.engine.untrackWorldObject(remote.trackEntry);
    this.engine.scene.remove(remote.group);
    disposeTree(remote.group);
    this.remotes.delete(id);
    this.updateChip();
  }

  updateChip() {
    const here = this.remotes.size;
    const games = Math.max(0, this.lobbyIds.size - 1);
    if (!this.connected) return this.setChip('solo');
    const hereText = here === 0 ? 'alone here' : here === 1 ? '1 here with you' : `${here} here with you`;
    const gamesText = games > here ? ` · ${games} in games` : '';
    this.setChip(`realtime · ${hereText}${gamesText}`);
  }

  setChip(text) {
    if (this.chip && this.chip.textContent !== text) this.chip.textContent = text;
  }
}

function createRemote(engine, state) {
  const group = new THREE.Group();
  group.name = `remote:${state.id}`;
  const color = new THREE.Color(state.color || COLORS[hash(state.id) % COLORS.length]);

  const avatar = new THREE.Group();
  const suit = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
    new THREE.MeshLambertMaterial({ color })
  );
  suit.position.y = 0.85;
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.15, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xffcc80 })
  );
  visor.position.set(0, 1.45, 0.28);
  avatar.add(suit, visor);
  group.add(avatar);

  const ship = new THREE.Group();
  ship.visible = false;
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.45, 2.6),
    new THREE.MeshLambertMaterial({ color })
  );
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.45, 0.95, 4),
    new THREE.MeshLambertMaterial({ color: 0xb0bec5 })
  );
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 1.75;
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff7043 })
  );
  glow.position.z = -1.55;
  ship.add(hull, nose, glow);
  group.add(ship);

  const label = makeNameSprite(sanitize(state.name) || 'Pilot');
  label.position.y = 2.1;
  group.add(label);

  const worldPos = new THREE.Vector3(state.x || 0, state.y || 0, state.z || 0);
  const trackEntry = engine.trackWorldObject({ worldPos, object3d: group });
  return {
    group,
    avatar,
    ship,
    label,
    worldPos,
    target: worldPos.clone(),
    targetQuat: new THREE.Quaternion(state.qx || 0, state.qy || 0, state.qz || 0, state.qw ?? 1),
    mode: state.mode === 'ship' ? 'ship' : 'foot',
    name: sanitize(state.name) || 'Pilot',
    lastUpdate: performance.now(),
    buf: [],
    trackEntry
  };
}

function makeNameSprite(name) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = '600 28px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(8,12,16,0.66)';
  const w = Math.min(246, ctx.measureText(name).width + 28);
  ctx.fillRect((256 - w) / 2, 10, w, 44);
  ctx.fillStyle = '#eef4fa';
  ctx.fillText(name, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(2.3, 0.58, 1);
  return sprite;
}

function ensureChip() {
  let chip = document.getElementById('mp-chip');
  if (!chip) {
    chip = document.createElement('div');
    chip.id = 'mp-chip';
    chip.className = 'mp-chip';
    chip.textContent = 'solo';
    document.body.appendChild(chip);
  }
  return chip;
}

function getGuestId() {
  try {
    const key = 'hb_guest_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = 'guest:' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
      localStorage.setItem(key, id);
    }
    return id;
  } catch (e) {
    return 'guest:' + Math.random().toString(36).slice(2, 10);
  }
}

function defaultGuestName(id) {
  return 'Pilot ' + String(id).replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase();
}

function sanitize(raw) {
  const s = String(raw || '').replace(/[<>&"']/g, '').trim().slice(0, 24);
  return s || null;
}

function normalizeAppearance(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const color = typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : null;
  return color ? { color } : null;
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0;
  return Math.abs(h);
}

function validState(s) {
  return s && typeof s.id === 'string'
    && Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.z);
}

function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
}
