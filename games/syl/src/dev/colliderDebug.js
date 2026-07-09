// ============================================================================
// colliderDebug.js — F7: see the physics. Collider + bounds visualization.
//
// OWNS: wireframe rendering of every structure collider (zone structures AND
//       settlement/nature detail colliders) plus the ship's hull footprint,
//       so "invisible wall" reports can be diagnosed by LOOKING.
// DOES NOT OWN: the colliders themselves (planet.js / worldDetails.js own
//       those). This file only draws what the physics already believes.
//
// USAGE: F7 toggles. Green wireframes = box colliders, cyan = circle
// colliders, orange = the ship hull box. If the player is blocked where no
// wireframe exists, the bug is in movement code, not collision data — and if
// a wireframe exists where no visible object does, THAT is the invisible
// wall, and the fix is deleting or matching the collider.
// ============================================================================

import * as THREE from 'three';
import { allCollidersForZone, terrainRadiusAt } from '../world/planet.js';

const boxMat = new THREE.MeshBasicMaterial({ color: 0x4dff7a, wireframe: true, transparent: true, opacity: 0.7, depthTest: false });
const cylMat = new THREE.MeshBasicMaterial({ color: 0x53e6ff, wireframe: true, transparent: true, opacity: 0.7, depthTest: false });
const shipMat = new THREE.MeshBasicMaterial({ color: 0xffb454, wireframe: true, transparent: true, opacity: 0.85, depthTest: false });
const _worldY = new THREE.Vector3(0, 1, 0);

export class ColliderDebug {
  constructor(engine, input, bodies, ship) {
    this.engine = engine;
    this.bodies = bodies;
    this.ship = ship;
    this.group = null;
    this.on = false;
    input.onPress('F7', () => this.toggle());
  }

  toggle() {
    this.on = !this.on;
    if (this.on && !this.group) this.build();
    if (this.group) this.group.visible = this.on;
    if (this.shipBox) this.shipBox.visible = this.on;
  }

  build() {
    this.group = new THREE.Group();
    this.group.name = 'collider-debug';
    for (const body of this.bodies) {
      if (!body.landingZones) continue;
      const bodyGroup = new THREE.Group();
      for (const zone of body.landingZones) {
        const frame = zoneFrame(zone._dirV);
        for (const c of allCollidersForZone(zone)) {
          const dir = zone._dirV.clone()
            .addScaledVector(frame.east, (c.east || 0) / body.radius)
            .addScaledVector(frame.north, (c.north || 0) / body.radius)
            .normalize();
          const r = terrainRadiusAt(body, dir);
          let mesh;
          if (c.kind === 'box') {
            mesh = new THREE.Mesh(new THREE.BoxGeometry(c.halfEast * 2, c.height, c.halfNorth * 2), boxMat);
          } else {
            mesh = new THREE.Mesh(new THREE.CylinderGeometry(c.radius, c.radius, c.height, 12, 1, true), cylMat);
          }
          mesh.position.copy(dir).multiplyScalar(r + c.height / 2);
          mesh.quaternion.setFromUnitVectors(_worldY, dir);
          mesh.renderOrder = 999;
          bodyGroup.add(mesh);
        }
      }
      this.group.add(bodyGroup);
      this.engine.scene.add(this.group);
      this.engine.trackWorldObject({ worldPos: body._centerV, object3d: bodyGroup });
      // NOTE: each bodyGroup is tracked against its own body centre; the
      // outer group stays at origin.
      this.group.position.set(0, 0, 0);
    }
    // Ship hull footprint box (matches player.js oriented-box collision).
    this.shipBox = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.4, 12.6), shipMat);
    this.shipBox.renderOrder = 999;
    this.engine.scene.add(this.shipBox);
    this.engine.trackWorldObject({ worldPos: this.ship.worldPos, object3d: this.shipBox, quaternion: this.ship.quaternion });
  }
}

function zoneFrame(dirUnit) {
  const east = new THREE.Vector3().crossVectors(_worldY, dirUnit);
  if (east.lengthSq() < 1e-6) east.set(1, 0, 0);
  east.normalize();
  const north = new THREE.Vector3().crossVectors(dirUnit, east).normalize();
  return { east, north };
}
