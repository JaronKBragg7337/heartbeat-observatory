// ============================================================================
// desktopPlanet.js - high-fidelity desktop planet embodiment.
//
// OWNS: desktop-only PBR body meshes, atmosphere shells, rings, and GLB zone
//       dressing. DOES NOT OWN: terrain truth. It builds body._terrainGrid and
//       samples terrainRadiusAt(), preserving mesh-true collision.
// ============================================================================

import * as THREE from 'three';
import { fbm } from '../core/math3d.js';
import { analyticTerrainRadiusAt, terrainRadiusAt } from '../world/planet.js';
import { buildWorldDetailLayer } from '../world/worldDetails.js';
import { createTerrainTextureSet } from './desktopTextures.js';

const BODY_DETAIL = {
  huge: 192,
  large: 160,
  medium: 128,
  small: 96,
};

export function buildDesktopBodyVisual(body, factionById, assets) {
  body._centerV = new THREE.Vector3().fromArray(body.position);
  for (const zone of body.landingZones) {
    zone._dirV = new THREE.Vector3().fromArray(zone.dir).normalize();
    const t = body.terrain;
    zone._flatHeight = fbm(zone._dirV.x, zone._dirV.y, zone._dirV.z, t.seed, t.octaves, t.freq) * t.amplitude;
  }

  const group = new THREE.Group();
  group.name = `desktop-body:${body.id}`;
  const detail = chooseDetail(body);
  buildTerrainGrid(body, detail);

  const geo = new THREE.SphereGeometry(1, detail * 2, detail);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const low = new THREE.Color(body.colors.low);
  const mid = new THREE.Color(body.colors.mid);
  const high = new THREE.Color(body.colors.high);
  const dir = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    dir.fromBufferAttribute(pos, i).normalize();
    const r = terrainRadiusAt(body, dir);
    pos.setXYZ(i, dir.x * r, dir.y * r, dir.z * r);
    const hN = (r - body.radius) / Math.max(1, body.terrain.amplitude);
    if (hN < 0) c.lerpColors(low, mid, hN + 1);
    else c.lerpColors(mid, high, Math.min(1, hN));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const texSize = body.radius > 9000 ? 2048 : 1024;
  const maps = createTerrainTextureSet(body, texSize);
  const material = new THREE.MeshStandardMaterial({
    map: maps.map,
    roughnessMap: maps.roughnessMap,
    bumpMap: maps.bumpMap,
    bumpScale: Math.max(2, body.terrain.amplitude * 0.018),
    vertexColors: true,
    roughness: 0.74,
    metalness: body.terrain.profile === 'ridged' ? 0.08 : 0.02,
    envMapIntensity: 0.85,
  });
  if (body.terrain.profile === 'ice') {
    material.roughness = 0.32;
    material.metalness = 0.0;
  }
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = `desktop-terrain:${body.id}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  if (body.seaLevel !== null && body.seaLevel !== undefined && body.colors.water) {
    const water = new THREE.Mesh(
      new THREE.SphereGeometry(body.radius + body.seaLevel, Math.min(256, detail * 2), Math.min(128, detail)),
      new THREE.MeshPhysicalMaterial({
        color: body.colors.water,
        transparent: true,
        opacity: body.terrain.profile === 'oceanic' ? 0.78 : 0.58,
        roughness: 0.08,
        metalness: 0,
        transmission: 0.25,
        thickness: 0.7,
        envMapIntensity: 1.6,
        depthWrite: false,
      })
    );
    water.name = `desktop-water:${body.id}`;
    water.receiveShadow = true;
    group.add(water);
  }

  if (body.atmosphere) {
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(body.radius + body.atmosphere.height, Math.min(192, detail), Math.min(96, detail / 2)),
      createAtmosphereMaterial(body)
    );
    atmo.name = `desktop-atmosphere:${body.id}`;
    atmo.renderOrder = -1;
    body._atmoMesh = atmo;
    group.add(atmo);
  }

  if (body.id === 'veldora' || body.id === 'nimbara') addRingSystem(group, body);

  for (const zone of body.landingZones) {
    addDesktopLandingZone(group, body, zone, factionById, assets);
  }
  group.add(buildWorldDetailLayer(body, factionById, terrainRadiusAt, { quality: 'desktop' }));

  body._group = group;
  return { group, bodyMesh: mesh };
}

function buildTerrainGrid(body, detail) {
  const W = detail * 2;
  const H = detail;
  const radii = new Float64Array((W + 1) * (H + 1));
  const dir = new THREE.Vector3();
  for (let iy = 0; iy <= H; iy++) {
    const theta = (iy / H) * Math.PI;
    for (let ix = 0; ix <= W; ix++) {
      const phi = (ix / W) * Math.PI * 2;
      const st = Math.sin(theta);
      dir.set(-Math.cos(phi) * st, Math.cos(theta), Math.sin(phi) * st);
      if (dir.lengthSq() < 1e-12) dir.set(0, theta < 1 ? 1 : -1, 0);
      dir.normalize();
      radii[iy * (W + 1) + ix] = analyticTerrainRadiusAt(body, dir);
    }
  }
  body._terrainGrid = { W, H, radii };
}

function chooseDetail(body) {
  if (body.radius > 15000) return BODY_DETAIL.huge;
  if (body.radius > 9000) return BODY_DETAIL.large;
  if (body.radius > 3000) return BODY_DETAIL.medium;
  return BODY_DETAIL.small;
}

function createAtmosphereMaterial(body) {
  const c = new THREE.Color(body.atmosphere.color);
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      color: { value: new THREE.Vector3(c.r, c.g, c.b) },
      density: { value: body.atmosphere.density },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float density;
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float rim = pow(1.0 - max(0.0, dot(vNormal, viewDir)), 2.15);
        float haze = pow(max(0.0, dot(vNormal, viewDir)), 0.35) * 0.12;
        gl_FragColor = vec4(color, (rim * 0.62 + haze) * density);
      }
    `,
  });
}

function addRingSystem(group, body) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(body.radius * 1.35, body.radius * 2.35, 256, 4),
    new THREE.MeshStandardMaterial({
      color: body.id === 'nimbara' ? 0xd7b47a : 0xced8c6,
      transparent: true,
      opacity: 0.46,
      side: THREE.DoubleSide,
      roughness: 0.9,
      metalness: 0.0,
      depthWrite: false,
    })
  );
  ring.name = `desktop-rings:${body.id}`;
  ring.rotation.x = Math.PI / 2.35;
  ring.rotation.z = body.id === 'nimbara' ? 0.2 : -0.45;
  group.add(ring);
}

async function addDesktopLandingZone(group, body, zone, factionById, assets) {
  const faction = zone.factionId && factionById ? factionById[zone.factionId] : null;
  const zoneGroup = new THREE.Group();
  zoneGroup.name = `desktop-zone:${zone.id}`;
  group.add(zoneGroup);

  const padMat = new THREE.MeshStandardMaterial({
    color: 0x242b2f,
    roughness: 0.52,
    metalness: 0.28,
    emissive: faction ? faction.color : 0x000000,
    emissiveIntensity: 0.025,
  });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(42, 42, 0.8, 64), padMat);
  placeOnSurface(body, zone._dirV, pad, 0.45);
  pad.name = `desktop-pad:${zone.id}`;
  pad.receiveShadow = true;
  zoneGroup.add(pad);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(39, 0.55, 12, 96),
    new THREE.MeshStandardMaterial({
      color: faction ? faction.color : 0x9eb4bd,
      emissive: faction ? faction.color : 0x000000,
      emissiveIntensity: 0.18,
      roughness: 0.42,
      metalness: 0.35,
    })
  );
  rim.name = `desktop-pad-rim:${zone.id}`;
  placeOnSurface(body, zone._dirV, rim, 0.9);
  rim.rotateX(Math.PI / 2);
  zoneGroup.add(rim);

  try {
    const main = await assets.instance('habitat', { name: `desktop-habitat:${zone.id}`, scale: structureScale(body, zone) });
    placeOnSurface(body, offsetDir(zone._dirV, 46, 12, body), main, 0.1);
    zoneGroup.add(main);
    const propA = await assets.instance('prop', { name: `desktop-prop-a:${zone.id}`, scale: 1.8 });
    placeOnSurface(body, offsetDir(zone._dirV, -28, -24, body), propA, 0.1);
    zoneGroup.add(propA);
    const propB = await assets.instance('prop', { name: `desktop-prop-b:${zone.id}`, scale: 1.25 });
    placeOnSurface(body, offsetDir(zone._dirV, 24, -34, body), propB, 0.1);
    propB.rotateY(Math.PI * 0.35);
    zoneGroup.add(propB);
  } catch (e) {
    // Keep the pad visible if a model fails. The asset loader reports the
    // visible fallback through the missing model, not through gameplay.
  }
}

function structureScale(body, zone) {
  if (zone.structures === 'outpost') return 1.25;
  if (zone.structures === 'depot') return 0.95;
  if (zone.structures === 'relay') return 0.82;
  return Math.max(0.65, Math.min(1.2, body.radius / 7600));
}

function placeOnSurface(body, dirUnit, obj, extraHeight = 0) {
  const r = terrainRadiusAt(body, dirUnit) + extraHeight;
  obj.position.copy(dirUnit).multiplyScalar(r);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirUnit);
}

function offsetDir(dirUnit, eastM, northM, body) {
  const frame = zoneFrame(dirUnit);
  return dirUnit.clone()
    .addScaledVector(frame.east, eastM / body.radius)
    .addScaledVector(frame.north, northM / body.radius)
    .normalize();
}

function zoneFrame(dirUnit) {
  const east = new THREE.Vector3(0, 1, 0).cross(dirUnit);
  if (east.lengthSq() < 1e-6) east.set(1, 0, 0);
  east.normalize();
  const north = dirUnit.clone().cross(east).normalize();
  return { east, north };
}

export function buildDesktopStarfield(count = 18000, radius = 900000) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    positions[i * 3] = s * Math.cos(th) * radius;
    positions[i * 3 + 1] = u * radius;
    positions[i * 3 + 2] = s * Math.sin(th) * radius;
    color.setHSL(0.58 + Math.random() * 0.1, 0.35, 0.74 + Math.random() * 0.24);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const stars = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ vertexColors: true, size: 2.0, sizeAttenuation: false, transparent: true, opacity: 0.9 })
  );
  stars.name = 'desktop-starfield';
  stars.frustumCulled = false;
  return stars;
}
