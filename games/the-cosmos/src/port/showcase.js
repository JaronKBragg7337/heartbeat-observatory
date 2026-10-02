import * as THREE from 'three';
import { shipDef } from '../ships/registry.js';
import { visualsFor } from '../ships/visuals.js';
import { hullPush } from '../ship/hullCollision.js';
import { PADS } from './portSpec.js';

// Shipyard stock is scenery, never a second player-owned hull or pad allocation.
export function buildShowcase(port, mats, tier) {
  const def=shipDef('meridian'),pad=PADS[1],V=visualsFor(def.type);
  const ext=V.buildExterior(def.layout,mats,{tier,remote:true});V.applyNeutralPose(ext);
  for(const e of ext.engines)e.outer.visible=e.core.visible=false;
  for(const p of ext.liftPods)p.mesh.visible=p.core.visible=false;
  ext.root.position.set(pad.x,def.gear.nominal+def.gear.soleOffset,pad.z);
  ext.root.name='shipyard-display';port.root.add(ext.root);
  const collide=port.tick.bind(port);
  port.tick=(dt,walker,contact=true,holdDoors=false)=>{
    collide(dt,walker,contact,holdDoors);if(!contact)return;
    const p=port.site.toLocal(walker.worldPos),local={x:p.x-pad.x,y:p.y-ext.root.position.y,z:p.z-pad.z};
    const push=hullPush(def,{ramps:{}},local,false);if(!push)return;
    Object.assign(walker.worldPos,port.site.toWorld(p.x+push.x,p.y,p.z+push.z));
    walker.velocity.x*=.2;walker.velocity.y*=.2;walker.velocity.z*=.2;
  };
  return {ext,def,pad};
}
