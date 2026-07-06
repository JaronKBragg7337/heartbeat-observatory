// ============================================================================
// spaceProps.js — visual debris/asteroids/satellites in deep space.
//
// OWNS: decorative space objects that populate the solar system. DOES NOT OWN:
// collision, physics, or gameplay logic (visual dressing only).
// ============================================================================

import * as THREE from 'three';

const COUNT_MIN = 40;
const COUNT_MAX = 60;
const MIN_DIST = 500000;
const MAX_DIST = 2000000;
const ASTEROID_COLORS = [0x5d4037, 0x4e342e, 0x6d4c41, 0x3e2723, 0x8d6e63];
const DEBRIS_COLORS = [0x455a64, 0x37474f, 0x78909c, 0x263238];
const SATELLITE_COLORS = [0x90a4ae, 0xb0bec5, 0x607d8b];

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function randElem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randVec3(scale = 1) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta) * scale,
    Math.sin(phi) * Math.sin(theta) * scale,
    Math.cos(phi) * scale
  );
}

export class SpaceProps {
  constructor(engine) {
    this.engine = engine;
    this.props = []; // { mesh, worldPos, rotAxis, rotSpeed, trackEntry }
    const count = Math.floor(randRange(COUNT_MIN, COUNT_MAX + 1));
    this._spawn(count);
  }

  _spawn(count) {
    let spawned = 0;
    while (spawned < count) {
      const typeRoll = Math.random();
      if (typeRoll < 0.15) {
        const rocks = this._spawnAsteroidCluster(count - spawned);
        spawned += rocks;
      } else if (typeRoll < 0.25) {
        this._spawnDebris();
        spawned += 1;
      } else if (typeRoll < 0.30) {
        this._spawnSatellite();
        spawned += 1;
      } else {
        this._spawnAsteroid();
        spawned += 1;
      }
    }
  }

  _spawnAsteroid() {
    const dist = randRange(MIN_DIST, MAX_DIST);
    const pos = randVec3(dist);
    const radius = randRange(120, 900);
    const geometry = new THREE.DodecahedronGeometry(radius, 0);
    const material = new THREE.MeshLambertMaterial({
      color: randElem(ASTEROID_COLORS),
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    this._addProp(mesh, pos);
  }

  _spawnAsteroidCluster(maxRocks) {
    const dist = randRange(MIN_DIST, MAX_DIST);
    const center = randVec3(dist);
    const rocks = Math.min(2 + Math.floor(Math.random() * 2), maxRocks); // 2-3 rocks, capped by remaining budget
    for (let r = 0; r < rocks; r++) {
      const offset = randVec3(randRange(200, 1200));
      const pos = center.clone().add(offset);
      const radius = randRange(80, 500);
      const geometry = new THREE.IcosahedronGeometry(radius, 0);
      const material = new THREE.MeshLambertMaterial({
        color: randElem(ASTEROID_COLORS),
        flatShading: true,
      });
      const mesh = new THREE.Mesh(geometry, material);
      this._addProp(mesh, pos);
    }
    return rocks;
  }

  _spawnDebris() {
    const dist = randRange(MIN_DIST, MAX_DIST);
    const pos = randVec3(dist);
    const w = randRange(30, 180);
    const h = randRange(10, 60);
    const d = randRange(30, 180);
    const geometry = new THREE.BoxGeometry(w, h, d);
    const material = new THREE.MeshLambertMaterial({
      color: randElem(DEBRIS_COLORS),
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    this._addProp(mesh, pos);
  }

  _spawnSatellite() {
    const dist = randRange(MIN_DIST, MAX_DIST);
    const pos = randVec3(dist);
    const group = new THREE.Group();
    // Main body
    const bodyGeo = new THREE.CylinderGeometry(40, 40, 200, 8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: randElem(SATELLITE_COLORS) });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.z = Math.PI / 2;
    group.add(body);
    // Solar panels
    const panelGeo = new THREE.BoxGeometry(300, 4, 140);
    const panelMat = new THREE.MeshLambertMaterial({ color: 0x1a237e });
    const panel1 = new THREE.Mesh(panelGeo, panelMat);
    panel1.position.set(0, 80, 0);
    const panel2 = new THREE.Mesh(panelGeo, panelMat);
    panel2.position.set(0, -80, 0);
    group.add(panel1, panel2);
    // Dish
    const dishGeo = new THREE.ConeGeometry(60, 40, 8);
    const dishMat = new THREE.MeshLambertMaterial({ color: 0xe0e0e0 });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.set(120, 0, 0);
    dish.rotation.z = -Math.PI / 2;
    group.add(dish);
    this._addProp(group, pos);
  }

  _addProp(mesh, worldPos) {
    this.engine.scene.add(mesh);
    const trackEntry = this.engine.trackWorldObject({ worldPos, object3d: mesh });
    const rotAxis = randVec3(1).normalize();
    const rotSpeed = randRange(0.02, 0.15); // radians per second
    this.props.push({ mesh, worldPos, rotAxis, rotSpeed, trackEntry });
  }

  tick(dt) {
    for (const p of this.props) {
      p.mesh.rotateOnWorldAxis(p.rotAxis, p.rotSpeed * dt);
    }
  }
}
