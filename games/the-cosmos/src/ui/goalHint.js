import * as THREE from 'three';
// fix-r1: only a planet walk, away from a goal for a minute.
export function hintState(previous, dt, goal) {
  if (!goal?.onPlanet || !goal.target || goal.distance <= (goal.reach ?? 12)) return { id: goal?.id, away: 0, visible: false };
  const away = (previous.id === goal.id ? previous.away : 0) + dt;
  return { id: goal.id, away, visible: away >= 60 };
}
export class GoalHint {
  constructor(engine) {
    this.engine=engine;this.state={};
    this.el=document.createElement('div');this.el.className='goal-edge-arrow';this.el.hidden=true;this.el.textContent='➤';
    this.el.style.cssText='position:fixed;z-index:36;pointer-events:none;color:#ffd28b;font:26px system-ui;text-shadow:0 1px 4px #000;line-height:30px;width:30px;height:30px';
    document.body.append(this.el);
  }
  update(dt,goal) {
    const eye=goal?.eye||this.engine.cameraWorldPos;
    const distance=goal?.target?Math.hypot(goal.target.x-eye.x,goal.target.y-eye.y,goal.target.z-eye.z):0;
    this.state=hintState(this.state,dt,{...goal,distance});this.el.hidden=!this.state.visible;
    if(this.el.hidden)return;
    const v=new THREE.Vector3(goal.target.x-eye.x,goal.target.y-eye.y,goal.target.z-eye.z).applyQuaternion(this.engine.camera.quaternion.clone().invert());
    let x=v.x,y=-v.y;
    if(v.z>0){x=Math.sign(x||1)*Math.max(Math.abs(x),v.z);y=0;}
    if(Math.hypot(x,y)<.01)y=1;
    const w=innerWidth,h=innerHeight,scale=Math.min((w/2-36)/Math.max(.001,Math.abs(x)),(h/2-130)/Math.max(.001,Math.abs(y)));
    this.el.style.left=(w/2+x*scale-15)+'px';this.el.style.top=(h/2+y*scale-15)+'px';
    this.el.style.transform='rotate('+Math.atan2(y,x)+'rad)';this.el.setAttribute('aria-label',goal.label);this.el.title=goal.label;
  }
  dispose(){this.el.remove();}
}
