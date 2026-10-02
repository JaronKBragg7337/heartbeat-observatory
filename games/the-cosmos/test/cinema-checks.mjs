// Trailer filming: camera paths replay from JSON, the letterbox is 2.39:1,
// and the game is wired to play a shot at a fixed step. No WebGL in here.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FILM_ASPECT, letterbox, frameCount, frameTime, packLogDepth, viewWFromLogDepth,
  postAllowed, applyCinemaFlight, sampleShot, parseShot, parseShotList, serializeShot,
  headingBasis,
} from '../src/cinema/math.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

export async function runCinemaChecks({ check, section }) {
  section('30. Trailer filming: paths, letterbox, capture');

  const far = 1e9;
  const back = viewWFromLogDepth(packLogDepth(25, far), far);
  check('log depth round-trips 25 m at a 1e9 far plane', Math.abs(back - 25) < 1e-4, String(back));

  const box = letterbox(1920, 1080, FILM_ASPECT);
  const pictureH = 1920 / 2.39;
  const bar = (1080 - pictureH) / 2;
  check('1920x1080 letterbox is 2.39:1 with equal top and bottom bars',
    Math.abs(box.top - bar) < 1e-6 && Math.abs(box.bottom - bar) < 1e-6 && box.left === 0 && box.right === 0
    && Math.abs(box.pictureW / box.pictureH - 2.39) < 1e-9);
  const wide = letterbox(3000, 1000, 2.39);
  check('a viewport wider than 2.39 pillarboxes instead',
    wide.top === 0 && wide.bottom === 0 && wide.left > 0 && Math.abs(wide.left - wide.right) < 1e-6);

  const dolly = {
    id: 'd', beat: 'port-dusk', duration: 4, fps: 24, frame: 'port',
    rig: { type: 'dolly', frame: 'port', keys: [
      { t: 0, eye: [0, 0, 0], target: [0, 0, -10] },
      { t: 4, eye: [10, 0, 0], target: [10, 0, -10] },
    ] },
  };
  const d0 = sampleShot(dolly, 0), d1 = sampleShot(dolly, 4);
  check('a dolly hits its first and last keys',
    d0.eye.x === 0 && d0.eye.z === 0 && d1.eye.x === 10 && d1.target.z === -10);

  const orbit = {
    id: 'o', beat: 'port-dusk', duration: 4, fps: 24,
    rig: { type: 'orbit', duration: 4, target: [0, 0, 0], radius: 20, height: 5, yaw0: 0, yaw1: Math.PI / 2 },
  };
  const o0 = sampleShot(orbit, 0), o1 = sampleShot(orbit, 4), oMid = sampleShot(orbit, 2);
  const rad = (s) => Math.hypot(s.eye.x - 0, s.eye.z - 0);
  check('an orbit starts and ends on its yaw, at a constant radius',
    Math.abs(o0.eye.z - 20) < 1e-6 && Math.abs(o0.eye.x) < 1e-6 && Math.abs(o1.eye.x - 20) < 1e-6
    && Math.abs(rad(o0) - 20) < 1e-6 && Math.abs(rad(o1) - 20) < 1e-6 && Math.abs(rad(oMid) - 20) < 1e-6
    && Math.abs(o0.eye.y - 5) < 1e-6);

  const push = {
    id: 'p', beat: 'tunnel', duration: 4, fps: 24,
    rig: { type: 'push', duration: 4, from: [0, 0, 0], to: [0, 0, -8], target: [0, 0, -4] },
  };
  const p0 = sampleShot(push, 0), pMid = sampleShot(push, 2), p1 = sampleShot(push, 4);
  check('a push-in eases through the midpoint and lands on its end',
    p0.eye.z === 0 && Math.abs(p1.eye.z + 8) < 1e-6 && Math.abs(pMid.eye.z + 4) < 1e-6);

  const chase = {
    id: 'c', beat: 'liftoff', duration: 4, fps: 24, frame: 'ship',
    rig: { type: 'chase', frame: 'ship', duration: 4, offset: { x: 4, y: 2, z: 6 }, look: { x: 0, y: 1, z: -3 } },
  };
  const c0 = sampleShot(chase, 0);
  check('a ship chase is the offset and the look, in ship space',
    c0.eye.x === 4 && c0.eye.y === 2 && c0.eye.z === 6 && c0.target.z === -3 && c0.frame === 'ship');

  // Nose is -Z. Offset z is metres behind the subject. look.z negative looks toward the nose.
  const subject = {
    id: 's', beat: 'raider', duration: 4, fps: 24, frame: 'port',
    rig: {
      type: 'chase', frame: 'port', duration: 4,
      offset: { x: 0, y: 5, z: 12 }, look: { x: 0, y: 2, z: -8 },
      subject: { from: [0, 0, 0], to: [0, 0, -40], up: [0, 1, 0] },
    },
  };
  const s0 = sampleShot(subject, 0);
  const basis = headingBasis({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -10 }, { x: 0, y: 1, z: 0 });
  check('a chase of a subject flying -Z sits behind it and looks toward the nose',
    Math.abs(basis.fwd.z + 1) < 1e-6 && Math.abs(basis.right.x - 1) < 1e-6
    && Math.abs(s0.eye.y - 5) < 1e-6 && Math.abs(s0.eye.z - 12) < 1e-6
    && Math.abs(s0.target.z + 8) < 1e-6 && s0.target.y === 2);

  const hand = {
    id: 'h', beat: 'crew', duration: 2, fps: 24,
    rig: { type: 'handheld', amount: 0, roll: 0, rig: { type: 'push', duration: 2, from: [1, 2, 3], to: [1, 2, 3], target: [0, 0, 0] } },
  };
  const still = { id: 'h0', beat: 'crew', duration: 2, fps: 24, rig: { type: 'push', duration: 2, from: [1, 2, 3], to: [1, 2, 3], target: [0, 0, 0] } };
  const hA = sampleShot(hand, 0.4), hB = sampleShot(still, 0.4);
  check('handheld with no amount leaves the rig where it was',
    hA.eye.x === hB.eye.x && hA.eye.y === hB.eye.y && hA.eye.z === hB.eye.z && hA.roll === 0);
  const shaky = {
    id: 'hs', beat: 'limb', duration: 2, fps: 24,
    shake: { amount: 0.2, roll: 0.01, speed: 1.4, seed: 3 },
    rig: { type: 'push', duration: 2, from: [0, 0, 0], to: [0, 0, 0], target: [0, 0, -1] },
  };
  const k1 = sampleShot(shaky, 0.5), k2 = sampleShot(shaky, 0.5), k3 = sampleShot(shaky, 1.1);
  check('handheld shake is deterministic and actually moves',
    k1.eye.x === k2.eye.x && k1.eye.y === k2.eye.y && k1.roll === k2.roll && (k1.eye.x !== k3.eye.x || k1.eye.y !== k3.eye.y));

  const again = JSON.parse(serializeShot(dolly));
  const a = sampleShot(again, 1.5), b = sampleShot(again, 1.5);
  check('a shot saved as JSON samples the same point twice',
    a.eye.x === b.eye.x && a.eye.y === b.eye.y && a.eye.z === b.eye.z && a.target.z === b.target.z && a.fov === b.fov);

  check('fixed timestep is one twenty-fourth of a second', frameCount(4, 24) === 96 && frameTime(1, 24) === 1 / 24);
  check('film post is desktop high only',
    postAllowed({ tier: 'high', safe: false }) === true
    && postAllowed({ tier: 'high', safe: true }) === false
    && postAllowed({ tier: 'low' }) === false);

  const flight = { controls: { lift: 0, fwd: 0, yaw: 0 }, climbCap: 12, thrustDown: false, autoHover: false, gearPos: 1 };
  applyCinemaFlight(flight, { lift: 1, fwd: 0.45, yaw: 0.02, climbCap: 420, thrustDown: true, autoHover: true, gearPos: 0 });
  check('a filmed stick writes the flight controls',
    flight.controls.lift === 1 && flight.controls.fwd === 0.45 && flight.controls.yaw === 0.02
    && flight.climbCap === 420 && flight.thrustDown === true && flight.autoHover === true && flight.gearPos === 0);

  let parsed = null, err = '';
  try { parsed = parseShotList(read('docs/trailer/shots.json')); }
  catch (e) { err = e.message; }
  check('shots.json is 8 to 12 replayable shots covering the trailer beats', !!parsed && parsed.shots.length >= 8 && parsed.shots.length <= 12, err);
  if (parsed) {
    const tunnel = parsed.shots.find((s) => s.beat === 'tunnel');
    const raider = parsed.shots.find((s) => s.beat === 'raider');
    const lookXs = !tunnel ? []
      : tunnel.rig.target ? [tunnel.rig.target[0]]
      : (tunnel.rig.keys || []).map((k) => k.target[0]);
    check('the tunnel shot aims at the shaft the stage carves',
      !!tunnel && lookXs.length > 0 && lookXs.every((x) => x === 148));
    check('the raider chase follows the subject path stored on the rig',
      !!raider && raider.rig.subject && raider.rig.subject.from && raider.rig.subject.to);
    for (const s of parsed.shots) {
      const q = sampleShot(s, 0), r = sampleShot(s, s.duration);
      check(s.id + ' samples at both ends', q.eye && r.eye && Number.isFinite(q.eye.x) && Number.isFinite(r.eye.x));
    }
  }

  const html = read('index.html');
  const main = read('src/main.js');
  const ship = read('src/ship/shipSystem.js');
  const engine = read('src/core/engine.js');
  const capture = read('docs/trailer/capture.mjs');
  const stage = read('src/cinema/stage.js');
  check('the page has the cinematic toggle and the 2.39 letterbox',
    html.includes('set-cinema') && html.includes('set-letterbox') && html.includes('cinema-on') && html.includes('2.39'));
  check('main.js plays a shot around the simulation and honours ?cinema=1',
    main.includes('new Cinema') && main.includes('preFrame') && main.includes('postFrame') && main.includes('?cinema=1'));
  check('the ship applies the filmed stick before it steps',
    ship.includes('applyCinemaFlight') && ship.indexOf('applyCinemaFlight') < ship.indexOf('f.step('));
  check('the engine can hand a frame to a film pass', engine.includes('this.present'));
  check('capture films 1920x1080 at the high tier on a fixed step',
    capture.includes('1920') && capture.includes('1080') && capture.includes('tier=high') && capture.includes('e.stop()') && capture.includes('engine.step'));
  check('the tunnel stage carves the same shaft the shot looks at', stage.includes('toWorld(148') && stage.includes(', 24)'));

  // parseShot rejects a rig it cannot replay.
  let rejected = false;
  try { parseShot({ id: 'nope', duration: 1, fps: 24, rig: { type: 'crane' } }); }
  catch { rejected = true; }
  check('an unknown rig is rejected', rejected);
}
