// Shared helpers for the mission tests: a real authority on a memory store, a player who has finished the opening on any world, and a way to stand them somewhere.
import '../server/runtime.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const load = (p) => import(pathToFileURL(join(ROOT, p)).href);
export const mem = () => { const m = { rec: null, load: async () => (m.rec ? { record: structuredClone(m.rec), bricks: [] } : { record: null, bricks: [] }), save: async (r) => { m.rec = r; } }; return m; };

export async function mkWorld() {
  const { Authority } = await load('server/authority.mjs');
  const W = await load('src/missions/where.js'), PL = await load('src/worlds/moon/place.js'), MF = await load('src/space/moonField.js');
  let clock = Date.now();
  const adapter = mem();
  const world = await new Authority(adapter, { now: () => clock, verify: null }).load();
  const H = { world, adapter, W, get clock() { return clock; }, advance(sec) { for (let i = 0; i < sec * 30; i++) { world.advance(1 / 30); clock += 33; } },
    // a pilot who has finished the opening on `where` with the lifeboat fitted, signed in (online) with a dummy session
    start(where, faction = null, name = 'QA') {
      const p = world.createPlayer((name + Math.random()).padEnd(48, 'x'), name, 'isaiah', 1, { ephemeral: true });
      const ship = world.state.ships[p.shipId];
      p.opening.dest = { world: where, faction, stay: where === 'mars' }; p.opening.complete = true;
      if (where !== 'mars' && !(where in (ship.moonPads || {}))) throw Error('no pad on ' + where);
      world.arriveFromOpening(p, ship);
      ship.drained = false; ship.repair = null; world.sims.get(ship.id).repairDone();
      world.sessions.set(p.id, { close() {}, send() {} });
      // a refused action rolls the whole world record back to a copy, so objects held across it go stale: hand out views that always read the live one
      const live = (get) => new Proxy({}, { get: (_, k) => { const t = get(); const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; }, set: (_, k, v) => { get()[k] = v; return true; }, has: (_, k) => k in get(), ownKeys: () => Reflect.ownKeys(get()), getOwnPropertyDescriptor: (_, k) => { const d = Object.getOwnPropertyDescriptor(get(), k); if (d) d.configurable = true; return d; } });
      return { p: live(() => world.state.players[p.id]), ship: live(() => world.state.ships[ship.id]), sim: live(() => world.sims.get(ship.id)) };
    },
    // stand the player at a place (a person id, or { at:[x,z], frame })
    stand(p, ref) {
      const pl = W.resolve(ref); if (!pl) throw Error('no such place ' + JSON.stringify(ref));
      p.aboardShipId = null; p.pose.aboard = false; p.pose.seat = null; p.frameId = pl.frame;
      if (pl.kind === 'port') p.pose.worldPos = world.site.toWorld(pl.x, pl.y + 0.02, pl.z);
      else if (pl.kind === 'body') p.pose.worldPos = { x: pl.x, y: pl.y, z: pl.z };
      else p.pose.worldPos = PL.outpostToFrame(MF.makeMoon(pl.frame).padInfo, pl.x, 0.02, pl.z);
      return pl;
    },
    act: async (p, a, id) => world.action(p.id, 'mt-' + (id || Math.random().toString(36).slice(2) + Date.now()), a),
    tick(p, sec = 1) { H.advance(sec); },
    // fly the player's flagship to a destination with the real authority (the time compression the nav computer offers), return what happened
    fly(p, dest, o = {}) {
      const ship = world.state.ships[p.shipId], sim = world.sims.get(ship.id), seat = sim.def.seats.find((q) => q.id === 'pilot');
      p.aboardShipId = ship.id; p.currentShipId = ship.id; p.pose.aboard = true; p.frameId = sim.frameId; p.pose.seat = 'pilot'; Object.assign(p.pose.sw, { x: seat.x, y: seat.y, z: seat.z });
      if (o.power) sim.flight.routePower('engines', 100);
      try { world.reduce(p, { type: 'engage', destination: dest }); } catch (e) { return { dest, err: e.message }; }
      const t0 = world.state.clock;
      for (let i = 0; i < 900_000 && sim.trip && sim.trip.active; i++) {
        const w = sim.trip.phase === 'longdrive' ? 14400 : 60;
        if (sim.trip.warp !== w && (w <= 60 || sim.trip.phase === 'longdrive')) { try { world.reduce(p, { type: 'trip-warp', warp: w }); } catch { /* the ladder is shorter here */ } }
        world.advance(1 / 30); clock += 33;
      }
      for (let i = 0; i < 900 && !sim.flight.landed && !sim.trip; i++) { world.advance(1 / 30); clock += 33; }
      p.frameId = sim.frameId; p.pose.worldPos = { ...sim.flight.pos };
      return { dest, frame: sim.frameId, landed: sim.flight.landed, simS: Math.round(world.state.clock - t0) };
    },
    mine: (p) => world.state.missions[p.id],
  };
  return H;
}
