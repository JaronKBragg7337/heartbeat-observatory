import { layoutKit } from '../layoutKit.js';
import { makeHull } from '../hullLoft.js';
import { AVATAR } from '../../ship/shipSpec.js';
import { PHYS as BASE_PHYS, GUNS as BASE_GUNS } from '../raider/spec.js';
import { CREW_POSTS } from '../../crew/crewSpec.js';

const deck={main:0,upper:3,clear:2.7,pitch:3,slab:.3};
const K=layoutKit(deck),{room,door,prop,lamp}=K;
room('bridge','Flight deck','bridge','main',-2.4,2.4,-9,-5.2,{canopy:true});
room('corridor','Passage','corridor','main',-.8,.8,-5,3);
room('berth','Berth','crew','main',-3.4,-1,-4.8,2.8);
room('mess','Mess','galley','main',1,3.4,-4.8,-.2);
room('airlock','Airlock','airlock','main',1,3.4,0,2.8);
room('engine','Machinery','engineering','main',-3.4,3.4,3.2,6.4);
room('hold','Hold','cargo','main',-3.4,3.4,6.6,10.6,{h:3});
door('d_bridge','corridor','bridge','z',-5.1,0,{w:1.2,sign:'FLIGHT'});
door('d_berth','corridor','berth','x',-.9,-1,{sign:'BERTH'});
door('d_mess','corridor','mess','x',.9,-2.5,{sign:'MESS'});
door('d_airlock_in','corridor','airlock','x',.9,1.4,{sign:'AIRLOCK'});
door('d_airlock_out','airlock','outside','x',3.5,1.4,{kind:'outer',w:1.3,h:2.2});
door('d_engine','corridor','engine','z',3.1,0,{w:1.2,sign:'MACHINERY'});
door('d_hold','engine','hold','z',6.5,0,{w:1.8,sign:'HOLD'});
door('d_ramp','hold','outside','z',10.6,0,{kind:'portal',w:2.6,h:2.7,noZone:true});
const seats=[
  ['pilot',-1.15,-7,'flight'],['captain',1.15,-7,'flight+guns'],
  ['nav',-1.75,-5.7,'navigation'],['comms',1.75,-5.7,'comms'],['engineer',2.2,4.7,'power'],
].map(([id,x,z,role],i)=>({id,x,y:0,z,yaw:id==='engineer'?90:0,room:id==='engineer'?'engine':'bridge',
  name:id[0].toUpperCase()+id.slice(1),variant:id==='captain'?'captain':'pilot',stationId:'COS-MARS-STR-00'+(61+i),
  lookYaw:100,lookPitchUp:55,lookPitchDown:40,role,hint:'Work the station'}));
prop('console','bridge',-1.2,-8.55,2,.7,.7,0,{extra:{screens:2,lift:.2,fh:.36,sh:.32,station:'pilot'}});
prop('console','bridge',1.2,-8.55,2,.7,.7,0,{extra:{screens:2,lift:.2,fh:.36,sh:.32,station:'nav'}});
prop('bunk','berth',-2.85,-3.4,.95,2.1,1.9);
prop('bunk','berth',-2.85,-.9,.95,2.1,1.9);
prop('locker','berth',-2.8,2.2,.6,.55,2,2);
prop('table','mess',2.5,-2.7,.8,1.6,.76);
prop('bench','mess',3.08,-2.7,.36,1.6,.46);
prop('counter','mess',3,-.7,1.1,.6,.95,3);
prop('suitrack','airlock',2.6,.45,.8,.6,2,2);
prop('minireactor','engine',-2.2,4.8,1.6,1.6,2.3,0,{extra:{radius:.6}});
prop('console','engine',3,4.7,1.4,.5,1.1,3,{extra:{screens:2,station:'engineer'}});
prop('tank','engine',-2.9,6,.8,.8,2.2);
prop('crate','hold',-2.6,7.5,1.1,1.1,1.1);
prop('crate','hold',2.6,8.2,1.1,1.1,1.1);
prop('drum','hold',-2.7,9.3,.6,.6,.9);
prop('extinguisher','corridor',-.73,1,.14,.14,.5,1,{y:1.2,blocks:false});
for(const r of K.rooms)lamp(r.id,(r.x0+r.x1)/2,(r.z0+r.z1)/2,{intensity:r.id==='hold'?14:6,len:1.8});
const ramps={cargo:{id:'ramp_cargo',name:'Boarding ramp',hinge:{x:0,y:0,z:10.6},dir:{x:0,z:1},length:4,width:2.6,raisedHeight:2.7,panel:{thickness:.16}},
  airlock:{id:'ramp_airlock',name:'Gangway',hinge:{x:3.55,y:0,z:1.4},dir:{x:1,z:0},length:3.6,width:1.3,raisedHeight:2.2,panel:{thickness:.12}}};
const gear={soleOffset:.25,nominal:1.6,min:1,max:2.5,stroke:.6,padRadius:.65,legs:[{id:'fl',x:-2.8,z:-5},{id:'fr',x:2.8,z:-5},{id:'al',x:-3,z:8},{id:'ar',x:3,z:8}],
  keel:[{x:0,z:-9},{x:0,z:0},{x:0,z:10}],keelY:-.4};
const hull=makeHull([[-11,.4,-.4,.8,.2,.2],[-9,2.6,-.4,1.05,.3,.3],[-5.2,3.6,-.4,1.05,.3,.3],[-4.9,3.6,-.4,3.1,.3,.3],[6.5,3.6,-.4,3.4,.3,.3],[10.8,3.6,-.4,3.4,.3,.3]]);
const guns={main:{...BASE_GUNS.main,damage:5,rate:2,muzzles:[{x:-1,y:.5,z:-10.5},{x:1,y:.5,z:-10.5}],pivot:{x:0,y:.5,z:-9},range:1000}};
const panels=[{id:'panel_ramp',name:'Boarding ramp',x:-2,y:0,z:9.8,radius:2,action:'ramp_cargo'},
  {id:'panel_air',name:'Airlock',x:2,y:0,z:1.5,radius:1.6,action:'airlock'}];
const layout=K.finish({ramps,gear,guns,seats,panels,stairs:{},ladders:[],extraZones:[],portals:[],windows:[],posters:[],observation:[],wallScreens:[],custom:{dress:()=>{}}});
export const COURIER={ order: 20, role: "courier", blurb: "A 24 metre courier: five seats, a 3.5 tonne hold and one chin gun.", description: "The Wayfarer is a 24 metre courier: a small flight deck, a berth, a mess, an airlock, a machinery space and a hold under a single chin gun. Five seats and 3.5 tonnes of cargo. It is the ship the passenger line puts on a new pilot's pad, and it is not sold at the yard.",type:'courier',class:'Wayfarer-class courier',name:'Wayfarer',registryId:'COS-MARS-VEH-0060',layout,
  gear,guns,ramps,seats,panels,avatar:AVATAR,phys:{...BASE_PHYS,massKg:18000,liftThrustN:95000,driveThrustN:70000,shieldBase:80,cruiseSpeed:38},
  hull:{z0:hull.z0,z1:hull.z1,underside:hull.underside,extraPoints:[],combat:{centre:{x:0,y:1,z:0},radius:8},
    push:{topY:3.5,zNose:-11,zTail:11,hwAt:z=>hull.halfWidth(z),rampGap:{z:9,hw:1.6},hatch:{x:3.4,z:1.4,r:1}}},
  crewPosts:CREW_POSTS.filter(p=>['pilot','captain','navigator','comms','engineer'].includes(p.id)),
  gunSeats:{},seatGun:{captain:'main'},roles:{bridge:'bridge',cargo:'hold',engineering:'engine',airlock:'airlock',corridor:'corridor'},
  dock:{rampFoot:{x:0,y:0,z:15},boardSw:{x:0,y:0,z:8,yaw:0},leaveLocal:{x:-6,y:-1,z:16},clearRampZ:11,
    bounds:{x:8,z:18,y0:-3,y1:7},remote:{x:0,z:13,r:12},spawnY:2.6},
  features:{holo:false,practiceTargets:false,personalDrones:false,ventralGlass:false},hudName:'Wayfarer',deckName:()=> 'Main deck',
  envelope:{width:9.2,height:6.5,depth:24},stats:{crewMax:5,cargoKg:3500,escorts:0}};

/** The registry reads this (src/ships/_manifest.js is generated by tools/gen-registry.mjs). */
export default COURIER;
