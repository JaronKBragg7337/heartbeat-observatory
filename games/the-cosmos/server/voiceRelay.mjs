// Proximity voice chat signalling. The audio itself is peer to peer (WebRTC); the authority only carries the small
// handshake messages (offer, answer, ICE candidate, bye) from one connected player to another, and never reads or stores
// them. A message names its target; the sender is whoever owns the socket, so nobody can speak as someone else.
// Bounded: size, shape, and a token bucket per socket, so signalling cannot be used to flood another player.

const KINDS = new Set(['offer', 'answer', 'ice', 'bye']);
const MAX_BYTES = 12000;
const BUCKET = 80, REFILL_PER_S = 40;

/** Returns true when the message was delivered. `send(peer, obj)` is the authority's own sender. */
export function relayVoice(world, peer, m, send, now = Date.now()) {
  if (!peer?.playerId || typeof m.to !== 'string' || !m.data || typeof m.data !== 'object' || !KINDS.has(m.data.kind)) return false;
  const b = peer.voiceBucket ||= { tokens: BUCKET, at: now };
  b.tokens = Math.min(BUCKET, b.tokens + (now - b.at) / 1000 * REFILL_PER_S); b.at = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  let size = 0; try { size = JSON.stringify(m.data).length; } catch { return false; }
  if (size > MAX_BYTES) return false;
  if (m.to === peer.playerId) return false;
  const target = world.sessions.get(m.to);
  const from = world.state.players[peer.playerId], to = world.state.players[m.to];
  if (!target || !from || !to) return false;
  // someone still in the private opening is not part of the shared world yet
  if ((from.opening && !from.opening.complete) || (to.opening && !to.opening.complete)) return false;
  send(target, { type: 'voice', from: peer.playerId, data: m.data });
  return true;
}
