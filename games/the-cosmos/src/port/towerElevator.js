// Two-stop lift state, independent of rendering. Only closed doors permit travel.
import { TOWER } from './portSpec.js';

export class TowerElevator {
  constructor() {
    this.y = 0; this.target = 0; this.speed = 0;
    this.phase = 'open'; this.open = 1;
    this.maxSpeed = 2.2; this.acceleration = 1.4;
  }
  request(y) {
    if (![0, TOWER.cab.floorY].includes(y) || this.phase === 'moving') return false;
    this.target = y;
    this.phase = Math.abs(y - this.y) < .01 ? 'opening' : 'closing';
    return true;
  }
  tick(dt, doorwayOccupied = false) {
    const before = this.y;
    if (this.phase === 'closing') {
      // Light curtain: keep the car and landing doors open until the sill clears.
      this.open = Math.max(doorwayOccupied ? 1 : 0, this.open - dt / .8);
      if (!this.open) this.phase = 'moving';
    } else if (this.phase === 'moving') {
      const gap = this.target - this.y, dir = Math.sign(gap);
      this.speed = Math.min(this.maxSpeed, this.speed + this.acceleration * dt,
        Math.sqrt(2 * this.acceleration * Math.abs(gap)));
      const move = Math.min(Math.abs(gap), this.speed * dt);
      this.y += dir * move;
      if (Math.abs(this.y - this.target) < 1e-6) {
        this.y = this.target; this.speed = 0; this.phase = 'opening';
      }
    } else if (this.phase === 'opening') {
      this.open = Math.min(1, this.open + dt / .8);
      if (this.open === 1) this.phase = 'open';
    }
    return this.y - before;
  }
  landingOpen(y) { return Math.abs(this.y - y) < .01 ? this.open : 0; }
  contains(x, z, margin = 0) {
    const c = TOWER.car;
    return x > c.x0 + margin && x < c.x1 - margin && z > c.z0 + margin && z < c.z1 - margin;
  }
  floorAt(x, z, feetY) {
    return this.contains(x, z) && this.y <= feetY + .35 ? this.y : null;
  }
}
