// Private, resumable opening. The same rules run locally and on the authority.
import { getBody } from '../world/bodies.js';
import { createPortSite } from '../port/portSpec.js';
import { MATERIALS, attachEdits, density } from '../world/field.js';
import { EditStore } from '../world/edits.js';
import { Walker } from '../player/walker.js';
import { Digger } from '../player/digging.js';

export const OPENING_SECONDS = 48;
export const CONTACTS = [
  { person: 'ada', name: 'Ada', faction: 'Solar Union', color: 0xb3a47b },
  { person: 'zuri', name: 'Zuri', faction: 'Outer Accord', color: 0x6b949b },
  { person: 'jorge', name: 'Jorge', faction: 'Free Settlements', color: 0x9a735f },
];
export function freshOpening(seed = Math.random()) {
  return { version: 1, stage: 0, elapsed: 0, contact: Math.min(2,Math.max(0,Math.floor(seed*3))),
    pose: { x: 0, y: .02, z: 15, yaw: Math.PI, pitch: -.2 }, cuts: [], carriedCrate: false,
    ride: false, rideSeconds: 0, contactSeconds: 0, walked: 0, complete: false };
}
export function needsOpening(state, savedRecord) {
  return state?.version === 1 ? !state.complete : !savedRecord;
}
export function openingBody(id='solo') {
  const mars=getBody('mars'),port=createPortSite(mars),origin=port.toWorld(2600,0,350);
  const frame={right:port.right,up:port.up,back:port.back};
  const toLocal=p=>{const d={x:p.x-origin.x,y:p.y-origin.y,z:p.z-origin.z};return Object.fromEntries(
    [['x',frame.right],['y',frame.up],['z',frame.back]].map(([k,v])=>[k,d.x*v.x+d.y*v.y+d.z*v.z]));};
  const toWorld=(x,y,z)=>Object.fromEntries(['x','y','z'].map(k=>[k,origin[k]+frame.right[k]*x+frame.up[k]*y+frame.back[k]*z]));
  const height=(x,z)=>{
    const distance=Math.min(Math.hypot(x,z),Math.hypot(x+2600,z+350));
    const t=Math.max(0,Math.min(1,(distance-80)/450)),blend=t*t*(3-2*t);
    return .035*Math.sin(x*.28)*Math.sin(z*.2)+.54*Math.exp(-((x-4)**2+(z-20)**2)/1.3)
      +blend*(9*Math.sin(x*.0023+2)*Math.sin(z*.0042)+5*Math.sin(x*.006+z*.003));
  };
  const b={...mars,id:'opening-'+id,baseField:(x,y,z)=>{const p=toLocal({x,y,z});return p.y-height(p.x,p.z);},
    materialField:()=>MATERIALS.regolith};
  b.surfaceRadius=(x,y,z)=>{const dot=x*frame.up.x+y*frame.up.y+z*frame.up.z;
    let r=(origin.x*frame.up.x+origin.y*frame.up.y+origin.z*frame.up.z)/dot;
    for(let i=0;i<3;i++){const p=toLocal({x:x*r,y:y*r,z:z*r});r+=(height(p.x,p.z)-p.y)/dot;}return r;};
  return {body:b,origin,frame,toWorld,toLocal,height,port};
}
export class OpeningModel {
  constructor(state,id='solo') {
    this.state=state;Object.assign(this,openingBody(id));this.edits=new EditStore(this.body);
    this.walker=new Walker(this.body);this.digger=new Digger(this.body,this.edits,this.walker);
    attachEdits(this.edits);
    for(const cut of state.cuts||[])this.cut(cut,false);
    this.place(state.pose);
  }
  place(p){Object.assign(this.walker.worldPos,this.toWorld(p.x,p.y,p.z));this.walker.yaw=p.yaw;this.walker.pitch=p.pitch;this.walker.updateFrame();}
  pose(){return {...this.toLocal(this.walker.worldPos),yaw:this.walker.yaw,pitch:this.walker.pitch};}
  exposed(){attachEdits(this.edits);return [[0,0],[.18,0],[-.18,0],[0,.18],[0,-.18]].every(([x,z])=>{
    const p=this.toWorld(4+x,.34,20+z);return density(this.body,p.x,p.y,p.z)>0;});}
  cut(p,record=true){attachEdits(this.edits);this.place(p);const r=this.digger.dig();
    if(r.ok&&record)this.state.cuts.push({...p});return r;}
  act(a){const s=this.state;if(s.complete)return {ok:true,msg:'The opening is complete.'};
    if(a.type==='opening-pose'){
      const p=a.pose;if(!p||!['x','y','z','yaw','pitch'].every(k=>Number.isFinite(p[k]))||Math.abs(p.x)>5000||p.z< -5000||p.z>80||p.y< -25||p.y>(s.stage===4?25:8))throw Error('Invalid opening position.');
    const d=Math.hypot(p.x-s.pose.x,p.y-s.pose.y,p.z-s.pose.z),seconds=Math.max(0,Math.min(2,a.seconds||0));
      if(d>seconds*(s.ride?75:9)+2)throw Error('Walk to that place.');
      s.pose={...p};s.walked+=d;s.elapsed+=seconds;if(s.ride)s.rideSeconds+=seconds;
      if(s.stage===3)s.contactSeconds=(s.contactSeconds||0)+seconds;return {ok:true};
    }
    if(a.type==='opening-next'){
      if(s.stage===0&&s.elapsed>=OPENING_SECONDS){s.stage=1;s.played=true;s.pose={x:0,y:.02,z:4,yaw:Math.PI,pitch:0};}
      else if(s.stage===1&&s.pose.z>12){s.stage=2;s.pose={x:0,y:.02,z:15,yaw:Math.PI,pitch:-.2};}
      else throw Error('Continue the opening first.');
    } else if(a.type==='opening-dig'){
      if(s.stage!==2||s.cuts.length>=240)throw Error('Cannot dig here.');
      if(Math.hypot(s.pose.x-4,s.pose.z-20)>4)throw Error('Move closer.');
      return this.cut(s.pose);
    } else if(a.type==='opening-carry'){
      if(s.stage!==2||!this.exposed()||Math.hypot(s.pose.x-4,s.pose.z-20)>2.8)throw Error('Clear the dust and move closer.');
      s.carriedCrate=true;s.stage=3;
    } else if(a.type==='opening-ride'){
      if(s.stage!==3||(s.contactSeconds||0)<8||Math.hypot(s.pose.x+7,s.pose.z-23)>5)throw Error('Meet the driver first.');
      s.stage=4;s.ride=true;s.rideSeconds=0;
    } else if(a.type==='opening-walk'){
      if(s.stage!==3)throw Error('Continue the opening first.');s.stage=4;s.ride=false;
    } else if(a.type==='opening-finish'){
      if(s.stage!==4||(s.ride?s.rideSeconds<65:Math.hypot(s.pose.x+2600,s.pose.z+350)>100))throw Error('Reach the port first.');
      s.stage=5;s.complete=true;
    } else if(a.type==='opening-skip'){
      if(!s.played)throw Error('Skip intro is available after first play.');s.stage=5;s.complete=true;
    } else throw Error('Unknown opening action.');
    return {ok:true,msg:'Saved.'};
  }
}
