// ============================================================================
// geodesy.js — every point in this universe has an address.
//
// OWNS: the conversion between body-fixed cartesian metres and
//       (latitude, longitude, altitude) on a real oblate spheroid, plus the
//       local East/North/Up frame at any point.
// DOES NOT OWN: terrain height (field.js) or rendering (planetMesh.js).
//
// WHY THIS EXISTS
// ---------------
// "Somewhere on the planet" is not an address. If a player sees a rock clipping
// through the ground, the only useful bug report is a number: lat, lon, altitude,
// and the asset ID. That is impossible unless addressing is built into the
// foundation rather than bolted on, so it is one of the first files here.
//
// The spheroid is real. Mars is 20 km wider at the equator than pole to pole,
// so a spherical approximation would put geodetic latitude out by up to ~0.3°
// — about 18 km on the ground. That is a large enough error to make a
// coordinate readout a lie, so the ellipsoid maths is done properly.
//
// CONVENTIONS (fixed here, once, for the whole project)
// - Latitude:  +90 north pole, -90 south pole. Planetocentric-to-geodetic
//              conversion is explicit, never assumed.
// - Longitude: -180..+180, EAST positive. Mars' origin is the crater Airy-0.
// - Altitude:  metres above the body's datum (Mars: the areoid), NOT above
//              local ground. Ground clearance is a separate query.
// - Cartesian: body-fixed, metres. +Y through the north pole, +X through
//              (lat 0, lon 0), and -Z through (lat 0, lon 90°E).
//
//              That -Z looks odd written down and it is load-bearing. Three.js
//              renders right-handed. Mapping longitude onto +Z instead gives a
//              LEFT-handed frame: east x north comes out as -up, and everything
//              derived from it lands mirrored on screen. The first build had
//              exactly that bug — the movement stick and the camera both moved
//              left when you pushed right, because both read the same east
//              vector, and that vector was geodetically correct but rendered on
//              the wrong side.
//
//              `validate.mjs` now asserts east x north = +up at many points, so
//              a handedness flip cannot come back quietly. Orthonormality alone
//              does not catch it: a left-handed frame is perfectly orthonormal.
// ============================================================================

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// --- Ellipsoid constants, derived once per body. -----------------------------
const _cache = new WeakMap();
function ellipsoid(body) {
  let e = _cache.get(body);
  if (!e) {
    const a = body.radiusEquatorial;
    const b = body.radiusPolar;
    const f = (a - b) / a;                 // flattening
    const e2 = f * (2 - f);                // first eccentricity squared
    e = { a, b, f, e2, ep2: e2 / (1 - e2) };
    _cache.set(body, e);
  }
  return e;
}

// --- Geodetic (lat, lon, alt) -> body-fixed cartesian metres. ----------------
export function geodeticToCartesian(body, latDeg, lonDeg, altM = 0, out = {}) {
  const { a, e2 } = ellipsoid(body);
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  // Radius of curvature in the prime vertical.
  const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const r = (N + altM) * cosLat;
  out.x = r * Math.cos(lon);
  out.z = -r * Math.sin(lon);      // -Z east: keeps the frame right-handed
  out.y = (N * (1 - e2) + altM) * sinLat;
  return out;
}

// --- Body-fixed cartesian -> geodetic. ---------------------------------------
// Bowring's method: converges to sub-millimetre in one iteration for planetary
// flattening values, which is far below anything the game can observe.
export function cartesianToGeodetic(body, x, y, z, out = {}) {
  const { a, b, e2, ep2 } = ellipsoid(body);
  const p = Math.hypot(x, z);

  if (p < 1e-9) {                          // exactly on the spin axis
    out.lat = y >= 0 ? 90 : -90;
    out.lon = 0;
    out.alt = Math.abs(y) - b;
    return out;
  }

  const theta = Math.atan2(y * a, p * b);
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);
  const lat = Math.atan2(y + ep2 * b * sinT * sinT * sinT,
                         p - e2 * a * cosT * cosT * cosT);
  const sinLat = Math.sin(lat);
  const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);

  out.lat = lat * RAD;
  out.lon = Math.atan2(-z, x) * RAD;    // mirrors the -Z east convention
  out.alt = p / Math.cos(lat) - N;
  return out;
}

// --- Local tangent frame at a geodetic position. -----------------------------
// East, North, Up as unit vectors in body-fixed cartesian. This is the frame
// everything on the surface is built in: a building's footprint, a road's
// centreline, a player's walk direction.
export function localFrame(latDeg, lonDeg, out = {}) {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const sinLat = Math.sin(lat), cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon), cosLon = Math.cos(lon);

  // Derivatives of the position (cosLat·cosLon, sinLat, −cosLat·sinLon).
  // east × north = +up at every point on the body; the validator proves it.
  out.east  = { x: -sinLon,          y: 0,      z: -cosLon };
  out.north = { x: -sinLat * cosLon, y: cosLat, z:  sinLat * sinLon };
  out.up    = { x:  cosLat * cosLon, y: sinLat, z: -cosLat * sinLon };
  return out;
}

// Geodetic "up" differs from the direction back to the centre on an oblate
// body. Both are needed: gravity points roughly at the centre, but a plumb
// line and a level floor follow geodetic up.
export function geocentricUp(x, y, z, out = {}) {
  const len = Math.hypot(x, y, z) || 1;
  out.x = x / len; out.y = y / len; out.z = z / len;
  return out;
}

// --- Great-circle distance along the surface, metres. ------------------------
// Haversine on the mean radius. Good to ~0.3% on Mars' flattening, which is
// stated rather than hidden.
export function surfaceDistance(body, lat1, lon1, lat2, lon2) {
  const R = body.radiusMean;
  const dLat = (lat2 - lat1) * DEG;
  const dLon = (lon2 - lon1) * DEG;
  const s1 = Math.sin(dLat / 2), s2 = Math.sin(dLon / 2);
  const h = s1 * s1 + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Initial bearing from point 1 to point 2, degrees clockwise from north.
export function bearing(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * DEG, p2 = lat2 * DEG, dl = (lon2 - lon1) * DEG;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * RAD + 360) % 360;
}

// --- Human-readable coordinate, the thing Jaron reads off the debug bubble. --
export function formatCoord(latDeg, lonDeg, altM) {
  const ns = latDeg >= 0 ? 'N' : 'S';
  const ew = lonDeg >= 0 ? 'E' : 'W';
  const dms = (v) => {
    const a = Math.abs(v);
    const d = Math.floor(a);
    const m = Math.floor((a - d) * 60);
    const s = ((a - d) * 60 - m) * 60;
    return `${d}°${String(m).padStart(2, '0')}'${s.toFixed(1).padStart(4, '0')}"`;
  };
  const alt = altM === undefined ? ''
    : `  ${altM >= 0 ? '+' : ''}${altM.toFixed(1)} m`;
  return `${dms(latDeg)}${ns}  ${dms(lonDeg)}${ew}${alt}`;
}

// Compact form for logs and bug reports: "mars:-14.0000,-59.2000,+1234.5"
export function coordSlug(bodyId, latDeg, lonDeg, altM) {
  return `${bodyId}:${latDeg.toFixed(4)},${lonDeg.toFixed(4)},${altM >= 0 ? '+' : ''}${altM.toFixed(1)}`;
}
