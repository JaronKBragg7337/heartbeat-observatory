import * as THREE from 'three';
const axes = ['x', 'y', 'z'];
// A pose is a small record of numbers and short arrays that nobody mutates after it is stored, so a copy of its three vectors is all that has to
// be private. (structuredClone of a whole ship pose, legs and power included, per ship per frame was the largest single cost of a busy port on a phone.)
const copyPose = (p) => { const o = { ...p }; if (p.pos) o.pos = { ...p.pos }; if (p.vel) o.vel = { ...p.vel }; if (p.quaternion) o.quaternion = [...p.quaternion]; return o; };
const angle = (a, b, t) => a + Math.atan2(Math.sin(b-a), Math.cos(b-a))*t;

// Server times order packets; the minimum observed clock offset excludes network
// jitter. Keep 100 ms of history and freeze after at most 150 ms of prediction.
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
const slerpArr = (a, b, t) => _qa.fromArray(a).slerp(_qb.fromArray(b), t).toArray();

export class MotionBuffer {
  constructor({ delay = 100, extrapolate = 150 } = {}) {
    this.delay = delay; this.extrapolate = extrapolate; this.offset = Infinity; this.samples = new Map();this.display=new Map();
  }
  push(id, time, arrival, pose, frame) {
    this.offset = Math.min(this.offset, arrival-time);
    let list = this.samples.get(id);
    // A delayed packet from the old ship/frame must not discard newer history.
    if (list?.length && time < list.at(-1).time) return;
    if (!list || list.at(-1).frame !== frame || Math.hypot(...axes.map(k=>pose.pos[k]-list.at(-1).pose.pos[k])) > Math.max(1000, Math.hypot(pose.vel?.x || 0, pose.vel?.y || 0, pose.vel?.z || 0) * (pose.warp || 1) * 0.6)/* FREEFLIGHT: a compressed ship legitimately jumps far between packets */) {this.samples.set(id, list=[]);this.display.delete(id);}
    if (list.length && time === list.at(-1).time) {list.at(-1).pose=copyPose(pose);return;}
    list.push({ time, frame, pose: copyPose(pose) });
    while (list.length > 32) list.shift();
  }
  sample(id, now) {
    const list = this.samples.get(id); if (!list?.length) return null;
    const time = now-this.offset-this.delay;
    let a = list[0], b = a;
    for (const s of list) { if (s.time <= time) a = s; if (s.time >= time) { b=s; break; } b=s; }
    const out = copyPose(a.pose);
    if (b.time > a.time) {
      const t=Math.max(0, Math.min(1,(time-a.time)/(b.time-a.time)));
      for (const k of axes) out.pos[k]=a.pose.pos[k]+(b.pose.pos[k]-a.pose.pos[k])*t;
      if (a.pose.quaternion && b.pose.quaternion) out.quaternion=slerpArr(a.pose.quaternion,b.pose.quaternion,t);
      if (Number.isFinite(out.yaw)) out.yaw=angle(a.pose.yaw,b.pose.yaw,t);
    } else if (time > a.time) {
      const dt=Math.min(this.extrapolate, time-a.time)/1000;
      for (const k of axes) out.pos[k]+=(a.pose.vel?.[k]||0)*dt;
    }
    return out;
  }
  render(id, now) {
    const pose=this.sample(id,now);if(!pose)return null;
    const last=this.display.get(id);
    if(last){const dt=Math.max(0,(now-last.now)/1000),distance=Math.hypot(...axes.map(k=>pose.pos[k]-last.pose.pos[k]));
      // Bound catch-up after a bunched packet. Ordinary interpolation remains
      // exact; only a discontinuity spends several frames settling its error.
      const speed=Math.hypot(...axes.map(k=>pose.vel?.[k]||0))*(pose.warp||1)/* FREEFLIGHT: a compressed ship covers its ground faster than its speed says */,limit=Math.max(.08,speed*dt*1.5),t=distance>8&&speed<12?1:Math.min(1,limit/Math.max(distance,.0001));
      if(dt===0)return copyPose(last.pose);
      for(const k of axes)pose.pos[k]=last.pose.pos[k]+(pose.pos[k]-last.pose.pos[k])*t;
    }
    this.display.set(id,{now,pose:copyPose(pose)});return pose;
  }
}

export function reconcile(position, correction, dt, snapDistance = 8) {
  const distance=Math.hypot(...axes.map(k=>correction[k]));
  const t=distance>snapDistance?1:Math.min(1,dt*5, .04/Math.max(distance,.0001));
  for (const k of axes) { const d=correction[k]*t; position[k]+=d; correction[k]-=d; }
  return distance;
}
