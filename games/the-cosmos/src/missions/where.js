// ============================================================================
// missions/where.js - WHERE a mission's places are, and how far a player is from one. Pure maths over the layouts the rest of the game already has (no three.js,
// no DOM): the authority checks every step with it, the browser points the arrow with it, the validator proves every place in the catalog exists and is walkable.
//
// A place is one of
//   'person-id'                          a person: the Mars port's workers (port-local metres, x right, z back, y up: the tower cab is 22.5 m up), or an outpost's
//                                        people (Occator Works, the Moon's three landings, the Skyward Launch Complex): outpost-local metres (x east, z south)
//   { at:[x,z], frame, name }            a spot at an outpost
//   { derelict:'phobos', name }          the drifting cargo module (frame coordinates)
// ============================================================================
import { PORT_WORKERS } from '../port/portPeople.js';
import { WORKERS as CERES_PEOPLE } from '../worlds/ceres/layout.js';
import { castOf } from '../worlds/moon/cast.js';
import { EARTH_CAST } from '../worlds/earth/cast.js';
import { CALISTO_CAST } from '../worlds/callisto/cast.js';
import { frameToOutpost } from '../worlds/moon/place.js';
import { makeMoon } from '../space/moonField.js';
import { worldOfFrame } from '../roles/seats.js';

const MOON_FRAMES = ['moon', 'moon-shackleton', 'moon-daedalus'];
let _people = null;
/** id -> { id, name, title, frame, kind: 'port' | 'outpost', x, y, z } for every person a mission can name. */
export function peopleIndex() {
  if (_people) return _people;
  const m = new Map();
  for (const w of PORT_WORKERS) m.set(w.id, { id: w.id, name: w.name, title: w.name, frame: 'mars', kind: 'port', x: w.x, y: w.y || 0, z: w.z });
  for (const w of CERES_PEOPLE) m.set(w.id, { id: w.id, name: w.name, title: w.title, frame: 'ceres', kind: 'outpost', x: w.x, y: 0, z: w.z });
  for (const w of EARTH_CAST) m.set(w.id, { id: w.id, name: w.name, title: w.title, frame: 'earth', kind: 'outpost', x: w.x, y: 0, z: w.z });
  for (const w of CALISTO_CAST) m.set(w.id, { id: w.id, name: w.name, title: w.title, frame: 'callisto', kind: 'outpost', x: w.x, y: 0, z: w.z });
  for (const f of MOON_FRAMES) for (const w of castOf(f)) m.set(w.id, { id: w.id, name: w.name || w.title, title: w.title, frame: f, kind: 'outpost', x: w.x, y: 0, z: w.z });
  return (_people = m);
}
export const personById = (id) => peopleIndex().get(id) || null;

/** A place, resolved: { frame, kind: 'port' | 'outpost' | 'body', x, y, z, name, person? }. null if it names nothing. */
export function resolve(ref) {
  if (!ref) return null;
  if (typeof ref === 'string') { const p = personById(ref); return p ? { ...p, person: p.id } : null; }
  if (ref.at) return { frame: ref.frame, kind: 'outpost', x: ref.at[0], y: 0, z: ref.at[1], name: ref.name || 'there' };
  if (ref.derelict) { const b = makeMoon(ref.derelict), d = b.derelict; return d ? { frame: ref.derelict, kind: 'body', x: d.point.x, y: d.point.y, z: d.point.z, name: ref.name || 'the wreck' } : null; }
  return null;
}

/**
 * Metres from a player's feet to a place, or Infinity if the player is on another frame. `site` is the Mars port's frame (authority.site / the client's portSite):
 * anything with toLocal(worldPos). `pos` is a world position in the player's frame.
 */
export function distanceTo(place, frameId, pos, site) {
  if (!place || frameId !== place.frame || !pos) return Infinity;
  if (place.kind === 'port') { const l = site.toLocal(pos); return Math.hypot(l.x - place.x, l.y - place.y, l.z - place.z); }
  if (place.kind === 'body') return Math.hypot(pos.x - place.x, pos.y - place.y, pos.z - place.z);
  const o = frameToOutpost(makeMoon(place.frame).padInfo, pos);
  return Math.hypot(o.x - place.x, o.z - place.z);
}

/** A place as a world position in its frame (for a goal arrow): { x, y, z } or null. `site` is needed for the port. */
export function toWorldPos(place, site) {
  if (!place) return null;
  if (place.kind === 'port') return site.toWorld(place.x, place.y + 1.5, place.z);
  if (place.kind === 'body') return { x: place.x, y: place.y, z: place.z };
  const pi = makeMoon(place.frame).padInfo;
  return { x: pi.point.x + pi.east.x * place.x + pi.up.x * 1.5 - pi.north.x * place.z, y: pi.point.y + pi.east.y * place.x + pi.up.y * 1.5 - pi.north.y * place.z, z: pi.point.z + pi.east.z * place.x + pi.up.z * 1.5 - pi.north.z * place.z };
}
/** Which world (roles/seats.js) a frame belongs to, as an id: 'mars', 'earth', 'moon', 'ceres', ... or null. */
export const worldIdOfFrame = (frameId) => worldOfFrame(frameId)?.id || null;
