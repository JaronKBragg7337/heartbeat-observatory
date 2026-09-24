/**
 * One shared screen for everyone in the Grand Palace.
 *
 * The 3D theater (Grand Palace repo, in the frame) plays; this page keeps the room in step and knows who
 * is signed in. Every play, pause, seek and stop goes over Supabase Realtime BROADCAST - nothing is written
 * to the database per event. Someone arriving late asks the room what is on and joins at the right second.
 *
 *  - theater:grand-palace        public room: load / play / pause / seek / tick / stop (own video only) / hello / state
 *  - theater-admin:grand-palace  private room: only accounts is_admin() says true for can send, so
 *                                "stop for everyone" on anyone's video cannot be faked by a visitor.
 *  - uploads go to the public Storage bucket theater-uploads (signed-in, one file per account, 100 MB cap)
 *    so everyone can stream them; signed out, an upload plays for you only.
 *
 * Database side: AI-Shared/projects/site-audit/2026-09-24-shared-theater-and-admins.sql
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ygjpnvrwhkrowkrskftk.supabase.co";
const supabase = createClient(SUPABASE_URL, "sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN");
const ROOM = "theater:grand-palace";
const ADMIN_ROOM = "theater-admin:grand-palace";
const BUCKET = "theater-uploads";
const MAX_UPLOAD_MB = 100;
const UPLOAD_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

const frame = document.querySelector("iframe");
const THEATER_ORIGIN = new URL(frame.src).origin;
const me = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2);

let ready = false;
let current = null;           // { src, owner } - what the room is showing
let session = null, admin = false;
let heardState = 0;           // when the last 'state' answer was seen in the room

/* ---- the theater in the frame ---- */
const toTheater = (m) => { try { frame.contentWindow.postMessage({ gp: 1, ...m }, THEATER_ORIGIN); } catch (e) {} };
const status = (text, error = false) => toTheater({ type: "status", text, error });
let reqId = 0;
const waiting = new Map();
function theaterState() {
  return new Promise((resolve) => {
    const id = ++reqId;
    waiting.set(id, resolve);
    toTheater({ type: "getState", reqId: id });
    setTimeout(() => { if (waiting.delete(id)) resolve(null); }, 1500);
  });
}
const hello = setInterval(() => { if (ready) clearInterval(hello); else toTheater({ type: "hello" }); }, 700);

/* ---- the room ---- */
const room = supabase.channel(ROOM, { config: { broadcast: { self: false } } });
const send = (payload) => room.send({ type: "broadcast", event: "gp", payload: { ...payload, by: me, at: Date.now() } });
const adminRoom = supabase.channel(ADMIN_ROOM, { config: { private: true, broadcast: { self: false } } });

// A source from someone else is only trusted if it is one of the kinds the theater knows how to play.
function cleanSrc(src) {
  if (!src || typeof src !== "object") return null;
  if (src.kind === "film" && Number.isInteger(src.index) && src.index >= 0 && src.index < 50) return { kind: "film", index: src.index };
  if (src.kind === "url" && /^https?:\/\//i.test(src.url || "") && src.url.length < 2000) return { kind: "url", url: src.url };
  if (src.kind === "upload" && String(src.url || "").startsWith(UPLOAD_PREFIX)) return { kind: "upload", url: src.url, name: String(src.name || "").slice(0, 120) };
  return null;
}
// Where the sender's video is now: its position when sent, plus the time the message spent travelling.
const nowT = (p) => Math.max(0, Number(p.t) || 0) + (p.playing ? Math.max(0, Date.now() - Number(p.at || Date.now())) / 1000 : 0);

async function answerHello(p) {
  if (!current || !current.src) return;
  const iOwn = current.owner === me;
  if (!iOwn) {
    // Let whoever started it answer; if they have left, the first of the rest does.
    const asked = Date.now();
    await new Promise((r) => setTimeout(r, 900 + Math.random() * 600));
    if (heardState > asked) return;
  }
  const s = await theaterState();
  if (!s || !s.src) return;
  send({ action: "state", to: p.by, src: s.src, owner: current.owner, t: s.t, playing: s.playing });
}

let joined = false;
room.on("broadcast", { event: "gp" }, ({ payload: p }) => {
  if (!p || p.by === me) return;
  switch (p.action) {
    case "hello": answerHello(p); break;
    case "state": {
      heardState = Date.now();
      if (p.to !== me || joined) return;
      const src = cleanSrc(p.src); if (!src) return;
      joined = true;
      current = { src, owner: p.owner || p.by, t: nowT(p), at: Date.now(), playing: p.playing !== false };
      if (ready) toTheater({ type: "remote", action: "load", src, t: current.t, playing: current.playing });
      break;
    }
    case "load": {
      const src = cleanSrc(p.src); if (!src) return;
      joined = true;
      current = { src, owner: p.by, t: nowT(p), at: Date.now(), playing: p.playing !== false };
      if (ready) toTheater({ type: "remote", action: "load", src, t: current.t, playing: current.playing });
      break;
    }
    case "play": case "pause": case "seek": case "tick":
      if (current) Object.assign(current, { t: nowT(p), at: Date.now(), playing: p.action === "tick" ? !!p.playing : p.action !== "pause" ? (p.action === "play" || current.playing) : false });
      if (current && ready) toTheater({ type: "remote", action: p.action, t: nowT(p), playing: p.action === "tick" ? !!p.playing : p.action === "play" });
      break;
    case "stop":
      if (current && current.owner === p.by) { current = null; toTheater({ type: "remote", action: "stop", admin: false }); }
      break;
  }
});
room.subscribe((s) => { if (s === "SUBSCRIBED") send({ action: "hello" }); });

adminRoom.on("broadcast", { event: "gp" }, ({ payload: p }) => {
  if (p && p.action === "stop") { current = null; toTheater({ type: "remote", action: "stop", admin: true }); }
});
let adminRoomUp = false;
function joinAdminRoom() {
  adminRoom.subscribe((s) => { adminRoomUp = s === "SUBSCRIBED"; });
}

/* ---- uploads ---- */
async function shareUpload(file, name) {
  if (!session) { status("Playing just for you. Sign in to share an uploaded video with everyone."); return; }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    status(`Playing just for you: ${Math.round(file.size / 1048576)} MB is over the ${MAX_UPLOAD_MB} MB limit for sharing. A link works for anything bigger.`);
    return;
  }
  const uid = session.user.id;
  status(`Uploading ${Math.max(1, Math.round(file.size / 1048576))} MB so everyone can watch - this can take a minute…`);
  try {
    // One shared upload per account: yours replaces your last one.
    const { data: old } = await supabase.storage.from(BUCKET).list(uid);
    if (old && old.length) await supabase.storage.from(BUCKET).remove(old.map((o) => `${uid}/${o.name}`));
    const path = `${uid}/${Date.now()}-${String(name || "video").replace(/[^\w.-]+/g, "_").slice(-80)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || "video/mp4", upsert: false });
    if (error) throw error;
    const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    if (!current || current.owner !== me) return;            // someone else started something meanwhile
    toTheater({ type: "uploaded", url });
    const s = await theaterState();
    current = { src: { kind: "upload", url, name }, owner: me };
    send({ action: "load", src: current.src, t: s ? s.t : 0, playing: s ? s.playing : true });
    status(`Playing for everyone: ${name}`);
  } catch (e) {
    status(`Playing just for you - the upload to share it did not go through (${e.message || e}).`, true);
  }
}

/* ---- what the viewer does in the theater ---- */
addEventListener("message", async (e) => {
  if (e.source !== frame.contentWindow || e.origin !== THEATER_ORIGIN) return;
  const m = e.data;
  if (!m || m.gp !== 1) return;
  if (m.type === "ready") {
    ready = true;
    toTheater({ type: "role", admin, signedIn: !!session });
    if (current && current.src && current.owner !== me) {
      // The room was already showing something while this theater was still building: join where it is now.
      const c = current;
      const t = (c.t || 0) + (c.playing ? (Date.now() - (c.at || Date.now())) / 1000 : 0);
      toTheater({ type: "remote", action: "load", src: c.src, t, playing: c.playing !== false });
    }
    return;
  }
  if (m.type === "state") { const r = waiting.get(m.reqId); if (r) { waiting.delete(m.reqId); r(m); } return; }
  if (m.type !== "local") return;
  joined = true;
  if (m.action === "load") {
    if (m.src && m.src.kind === "file") {
      current = { src: null, owner: me };
      if (m.file) shareUpload(m.file, m.src.name);
      return;
    }
    const src = cleanSrc(m.src); if (!src) return;
    current = { src, owner: me };
    send({ action: "load", src, t: 0, playing: true });
  } else if (m.action === "stop") {
    // Only the person who started the video, or an admin, stops it for the room. Anyone else's stop
    // changes nothing here, so this page keeps following the room.
    if (current && current.owner === me) { send({ action: "stop" }); current = null; }
    else if (admin && adminRoomUp) { adminRoom.send({ type: "broadcast", event: "gp", payload: { action: "stop", by: me, at: Date.now() } }); current = null; }
    else if (admin) status("Stop for everyone is not switched on yet (the database change for it has not been applied).", true);
  } else if (m.action === "play" || m.action === "pause" || m.action === "seek") {
    if (current && current.src) send({ action: m.action, t: m.t, playing: m.action === "seek" ? m.playing : m.action === "play" });
  }
});

// Whoever started what is on keeps everyone in step: every 5 s, where they are.
setInterval(async () => {
  if (!ready || !current || current.owner !== me || !current.src) return;
  const s = await theaterState();
  if (s && s.src) send({ action: "tick", t: s.t, playing: s.playing });
}, 5000);

/* ---- who is watching ---- */
(async () => {
  try {
    ({ data: { session } } = await supabase.auth.getSession());
    if (session) {
      const { data } = await supabase.rpc("is_admin");
      admin = data === true;
    }
  } catch (e) {}
  joinAdminRoom();
  if (ready) toTheater({ type: "role", admin, signedIn: !!session });
})();
