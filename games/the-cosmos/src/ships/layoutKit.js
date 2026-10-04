// ============================================================================
// layoutKit.js - the small vocabulary every ship's layout is written in.
//
// OWNS: room(), door(), prop(), lamp(), and the shape of the layout object the walker, the interior builder and the
//       validator all read (the same shape src/ship/shipSpec.js builds for the Meridian). Pure data; no three.js.
// DOES NOT OWN: any ship's numbers (src/ships/<type>/), or how anything is drawn.
//
// A ship definition writes its rooms with these and calls finish() once. Nothing here knows which ship it is.
// ============================================================================

export function assignDoorLabels(doors, roomById, extraRooms = []) {
  const names=new Map([...roomById,...extraRooms.map(r=>[r.id,r])]);
  for(const d of doors)if(!d.sign)d.sign=d.kind==='outer'?'GANGWAY':d.b==='outside'?'CARGO HATCH':(names.get(d.b)?.name||names.get(d.a)?.name||d.b.replaceAll('_',' ')).toUpperCase();
}

export function layoutKit(DECK) {
  const rooms = [], doors = [], props = [], lights = [];
  const byId = (id) => rooms.find((q) => q.id === id);

  function room(id, name, kind, deck, x0, x1, z0, z1, o = {}) {
    const r = {
      id, name, kind, deck, x0, x1, z0, z1,
      y: o.y ?? DECK[deck], h: o.h ?? DECK.clear,
      style: o.style || kind,
      floorHoles: o.floorHoles || [], ceilHoles: o.ceilHoles || [],
      lights: o.lights || null,
      shaftFrom: o.shaftFrom,           // a room entered through a hatch in its floor: where the shaft below starts
      canopy: !!o.canopy,               // a flight deck: its fore and side walls stop at the sill and the rest is glass
    };
    rooms.push(r);
    return r;
  }

  function door(id, a, b, axis, at, c, o = {}) {
    doors.push({
      id, a, b, axis, at, c,
      w: o.w ?? 1.0, h: o.h ?? 2.1, y: o.y ?? DECK[o.deck || 'main'],
      kind: o.kind || 'slide', sign: o.sign || null, signFace: o.signFace || 'a', noZone: !!o.noZone,
      gate: o.gate || null,
    });
  }

  function prop(kind, roomId, x, z, w, d, h, rot = 0, o = {}) {
    const r = byId(roomId);
    props.push({
      kind, room: roomId, x, z, y: o.y ?? (r ? r.y : 0), w, d, h, rot,
      blocks: o.blocks !== false, style: o.style || null, ...(o.extra || {}),
    });
  }

  function lamp(roomId, x, z, o = {}) {
    const r = byId(roomId);
    lights.push({
      room: roomId, x, y: (r.y + r.h) - 0.08, z,
      color: o.color ?? 0xfff1dc, intensity: o.intensity ?? 7, range: o.range ?? 10,
      len: o.len ?? 1.4, w: o.w ?? 0.28, axis: o.axis || 'z',
    });
  }

  /** The layout object: everything a ship's walkable, drawable interior is made of. */
  function finish(extra) {
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    assignDoorLabels(doors,roomById,Object.values(extra?.stairs||{}));
    return { rooms, roomById, doors, props, lights, ...extra };
  }

  return { room, door, prop, lamp, finish, rooms, doors, props, lights };
}

/** Rotate a prop's plan box into ship axes. rot is in 90-degree steps. */
export function propBoxOf(p) {
  const swap = (p.rot % 2) !== 0;
  const w = swap ? p.d : p.w, d = swap ? p.w : p.d;
  return { x0: p.x - w / 2, x1: p.x + w / 2, z0: p.z - d / 2, z1: p.z + d / 2, y0: p.y, y1: p.y + p.h };
}
