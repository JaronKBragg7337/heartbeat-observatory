import * as THREE from 'three';
// fix-r1: only a planet walk, away from a goal for a minute. Part 1 (11/19): a goal may ask for its arrow sooner (`after` seconds):
// a brand-new player's first goals (the arrivals hall, the Kestrel, the lifeboat's two parts) show it almost at once, with a name and a distance.
export function hintState(previous, dt, goal) {
  if (!goal?.onPlanet || !goal.target || goal.distance <= (goal.reach ?? 12)) return { id: goal?.id, away: 0, visible: false };
  const away = (previous.id === goal.id ? previous.away : 0) + dt;
  return { id: goal.id, away, visible: away >= (goal.after ?? 60) };
}
export class GoalHint {
  constructor(engine) {
    this.engine=engine;this.state={};
    this.el=document.createElement('div');this.el.className='goal-edge-arrow';this.el.hidden=true;this.el.textContent='➤';
    this.el.style.cssText='position:fixed;z-index:36;pointer-events:none;color:#ffd28b;font:26px system-ui;text-shadow:0 1px 4px #000;line-height:30px;width:30px;height:30px';
    this.tag=document.createElement('div');this.tag.className='goal-edge-tag';this.tag.hidden=true;
    this.tag.style.cssText='position:fixed;z-index:36;pointer-events:none;color:#ffe2b0;font:600 12px system-ui;background:rgba(14,12,11,.72);border:1px solid rgba(255,210,139,.35);border-radius:10px;padding:3px 8px;white-space:nowrap;max-width:60vw;overflow:hidden;text-overflow:ellipsis';
    document.body.append(this.el,this.tag);
  }
  update(dt,goal) {
    const eye=goal?.eye||this.engine.cameraWorldPos;
    const distance=goal?.target?Math.hypot(goal.target.x-eye.x,goal.target.y-eye.y,goal.target.z-eye.z):0;
    this.state=hintState(this.state,dt,{...goal,distance});this.el.hidden=!this.state.visible;
    this.tag.hidden=this.el.hidden||!goal?.named;
    if(this.el.hidden)return;
    const v=new THREE.Vector3(goal.target.x-eye.x,goal.target.y-eye.y,goal.target.z-eye.z).applyQuaternion(this.engine.camera.quaternion.clone().invert());
    let x=v.x,y=-v.y;
    if(v.z>0){x=Math.sign(x||1)*Math.max(Math.abs(x),v.z);y=0;}
    if(Math.hypot(x,y)<.01)y=1;
    const w=innerWidth,h=innerHeight,scale=Math.min((w/2-36)/Math.max(.001,Math.abs(x)),(h/2-130)/Math.max(.001,Math.abs(y)));
    this.el.style.left=(w/2+x*scale-15)+'px';this.el.style.top=(h/2+y*scale-15)+'px';
    this.el.style.transform='rotate('+Math.atan2(y,x)+'rad)';this.el.setAttribute('aria-label',goal.label);this.el.title=goal.label;
    if(!this.tag.hidden){const ax=w/2+x*scale,ay=h/2+y*scale,text=goal.label+' · '+(distance>=950?(distance/1000).toFixed(1)+' km':Math.round(distance)+' m');if(this.tag.textContent!==text)this.tag.textContent=text;
      // the name sits beside the arrow, toward the middle of the screen, and never leaves the screen
      const tw=this.tag.offsetWidth||120,tx=Math.max(8,Math.min(w-tw-8,ax-tw/2)),hud=parseFloat(document.documentElement.style.getPropertyValue('--hud-bottom'))||0,ty=Math.max(tx<w*.75&&hud?hud+8:64,Math.min(h-150,ay+(y*scale>h/4?-34:26)));   // never across the status card
      this.tag.style.left=tx+'px';this.tag.style.top=ty+'px';}
  }
  dispose(){this.el.remove();this.tag.remove();}
}
