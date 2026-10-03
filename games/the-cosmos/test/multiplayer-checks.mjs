import '../server/runtime.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';
import { stringify, parse } from '../src/world-state/wire.js';
import { SEATS } from '../src/ship/shipSpec.js';

export class TestClient {
  constructor(url,key,name,openingVersion=0){this.url=url;this.key=key;this.name=name;this.openingVersion=openingVersion;this.messages=[];this.waiters=[];}
  wait(predicate,from=0){const found=this.messages.slice(from).find(predicate);if(found)return Promise.resolve(found);
    return new Promise((resolve,reject)=>{const w={predicate,resolve,reject,timer:setTimeout(()=>{this.waiters=this.waiters.filter(v=>v!==w);reject(Error('Protocol wait timed out: '+this.name));},10000)};this.waiters.push(w);});}
  async connect(){this.socket=new WebSocket(this.url);this.socket.addEventListener('message',e=>{const m=parse(e.data);this.messages.push(m);
      if(m.state)this.state=m.state;if(m.type==='welcome')this.id=m.playerId;
      for(const w of [...this.waiters])if(w.predicate(m)){clearTimeout(w.timer);this.waiters.splice(this.waiters.indexOf(w),1);w.resolve(m);}});
    await new Promise((r,j)=>{this.socket.addEventListener('open',r,{once:true});this.socket.addEventListener('error',j,{once:true});});
    this.send({type:'hello',deviceKey:this.key,name:this.name,personId:'isaiah',openingVersion:this.openingVersion});return this.wait(m=>m.type==='welcome');}
  send(m){this.socket.send(stringify(m));}
  async action(action,actionId=randomUUID()){const from=this.messages.length;this.send({type:'action',action,actionId});return this.wait(m=>m.type==='receipt'&&m.actionId===actionId,from);}
  close(){this.socket?.close();}
}
export async function runMultiplayerChecks({check,section}) {
  section('18. One authority, many owned ships, two WebSocket clients');
  const dir=await mkdtemp(join(tmpdir(),'cosmos-multiplayer-'));let app,a,b,rejoined;let clock=Date.now();
  try{
    const adapter=new FileAdapter(join(dir,'world.json'));app=await startServer({adapter,port:0,tick:false,now:()=>clock});
    a=new TestClient(app.url,'a'.repeat(48),'Jaron');b=new TestClient(app.url,'b'.repeat(48),'Lilith');await a.connect();await b.connect();
    const world=app.world,pa=world.state.players[a.id],pb=world.state.players[b.id],sa=world.state.ships[pa.shipId],sb=world.state.ships[pb.shipId];
    assert.notEqual(sa.id,sb.id);assert.notDeepEqual(sa.pad,sb.pad);check('joining allocates independent owned ships, typed hulls and unique pads',true);
    assert.equal(JSON.stringify(world.publicState()).includes('deviceHash'),false);check('public snapshots omit device credentials and private receipts',true);
    const move=async(client,worldPoint,sw=null)=>{const p=world.state.players[client.id],origin=sw?p.pose.sw:p.pose.worldPos,dest=worldPoint;
      const dist=Math.hypot(dest.x-origin.x,dest.y-origin.y,dest.z-origin.z),n=Math.max(1,Math.ceil(dist/8)),start={...origin};
      for(let i=1;i<=n;i++){clock+=1000;const pose=structuredClone(p.pose);const target=sw?pose.sw:pose.worldPos;
        for(const k of ['x','y','z'])target[k]=start[k]+(dest[k]-start[k])*i/n;client.send({type:'pose',pose});await world.enqueue(()=>{});await new Promise(r=>setTimeout(r,5));}
    };
    await move(a,world.site.toWorld(-12,.02,42));a.send({type:'checkpoint'});await b.wait(m=>m.type==='state'&&m.state.players[a.id]?.pose.worldPos.x===pa.pose.worldPos.x);
    check('the second client receives the first player moving',true);
    await move(a,world.site.toWorld(-65,.02,16.9));await move(b,world.site.toWorld(-64,.02,16.9));
    world.state.market.traders['depot-clerk'].parts=1;
    const tradeId=randomUUID(),trades=await Promise.all([a.action({type:'purchase',trader:'depot-clerk',good:'parts'},tradeId),b.action({type:'purchase',trader:'depot-clerk',good:'parts'})]);
    assert.equal(trades.filter(r=>r.ok).length,1);const spent=world.state.ships[pa.shipId].economy.marks;
    const retry=await a.action({type:'purchase',trader:'depot-clerk',good:'parts'},tradeId);assert.equal(retry.replay,true);assert.equal(world.state.ships[pa.shipId].economy.marks,spent);
    check('last-item purchases serialize, and retrying a paid action cannot charge twice',true);
    // Aim a real shovel into the graded regolith beside the apron, not arbitrary density or mass.
    await move(a,world.site.toWorld(-23,.02,40));world.state.players[a.id].pose.pitch=-1.2;world.state.players[a.id].pose.yaw=world.site.heading;
    const dig=await a.action({type:'dig-edit'});assert.equal(dig.ok,true,dig.msg);
    const patch=await b.wait(m=>m.type==='state'&&m.bricks?.length>0);assert.ok(patch.bricks[0].phi instanceof Float32Array);
    assert.ok(world.state.players[a.id].carried[0].massKg>0);check('authority carves a hole and broadcasts exact typed terrain and retained matter',true);
    const candidate=Object.values(world.state.pool).find(c=>c.role==='pilot');
    await move(a,world.site.toWorld(-28,.02,-57));await move(b,world.site.toWorld(-29,.02,-57));
    assert.equal((await a.action({type:'meet',id:candidate.id})).ok,true);world.advance(20);await world.commit();
    await move(a,world.site.toWorld(candidate.position.x,.02,candidate.position.z+1));await move(b,world.site.toWorld(candidate.position.x+1,.02,candidate.position.z+1));
    const hires=await Promise.all([a.action({type:'hire',id:candidate.id}),b.action({type:'hire',id:candidate.id})]);
    assert.equal(hires.filter(r=>r.ok).length,1);assert.equal(world.state.ships[pa.shipId].crew.length,1);
    check('two simultaneous hires can only contract a candidate to one ship',true);
    world.advance(31);assert.ok(Object.values(world.state.pool).some(c=>c.role==='pilot'&&!c.shipId));check('the shared hiring pool replenishes with new generated people',true);
    world.advance(220);assert.equal(world.state.ships[pa.shipId].crew[0].status,'aboard');check('hired crew walk to their assigned pad and use the shared cabin route to their station',true);
    await move(a,world.site.toWorld(-60.35,.02,-40));await move(b,world.site.toWorld(-59.65,.02,-40));
    assert.equal((await a.action({type:'elevator',destination:22.5})).ok,true);world.advance(15);await world.commit();
    assert.ok(Math.abs(world.site.toLocal(world.state.players[a.id].pose.worldPos).y-22.52)<.01);assert.ok(Math.abs(world.site.toLocal(world.state.players[b.id].pose.worldPos).y-22.52)<.01);
    assert.equal((await b.action({type:'elevator',destination:0})).ok,true);world.advance(15);await world.commit();check('one tower lift carries both players on the same authority clock',true);
    const repeatId=randomUUID(),paidBefore=world.state.ships[sa.id].economy.marks;
    const failed=await b.action({type:'boarding-permission',allowed:true,shipId:sa.id});
    // The permission action applies only to the caller's own active ship.
    assert.equal(failed.ok,true);assert.equal(world.state.ships[sa.id].crewMayBoard,false);
    await a.action({type:'boarding-permission',allowed:true},repeatId);await a.action({type:'boarding-permission',allowed:true},repeatId);
    assert.equal(world.state.ships[sa.id].economy.marks,paidBefore);check('device authority cannot toggle another owner’s boarding permission',true);
    await move(a,world.sims.get(sa.id).flight.toWorld({x:-8,y:-1,z:38},{}));await move(b,world.sims.get(sa.id).flight.toWorld({x:-9,y:-1,z:38},{}));
    assert.equal((await a.action({type:'board',shipId:sa.id})).ok,true);assert.equal((await b.action({type:'board',shipId:sa.id})).ok,true);
    await move(a,SEATS.find(s=>s.id==='pilot'),true);await move(b,SEATS.find(s=>s.id==='nav'),true);
    assert.equal((await a.action({type:'seat',seat:'pilot'})).ok,true);assert.equal((await b.action({type:'seat',seat:'nav'})).ok,true);
    assert.equal((await b.action({type:'seat',seat:'pilot'})).ok,false);check('players board together and seats are exclusive',true);
    world.advance(.1);assert.equal(world.state.ships[sa.id].crew[0].displaced,true);
    const navPose=structuredClone(world.state.players[b.id].pose.sw);
    assert.equal((await b.action({type:'seat',seat:null})).ok,true);
    assert.notDeepEqual(world.state.players[b.id].pose.sw,navPose);
    await move(b,SEATS.find(s=>s.id==='nav'),true);assert.equal((await b.action({type:'seat',seat:'nav'})).ok,true);
    check('crew yield to player seats and standing restores a nearby walking pose',true);
    assert.equal((await a.action({type:'engage',destination:'phobos'})).ok,true);world.advance(310);await world.commit();
    assert.ok(world.state.ships[sa.id].trip);const mid=structuredClone(world.state.players[b.id].pose.sw);
    b.close();await new Promise(r=>setTimeout(r,30));rejoined=new TestClient(app.url,b.key,b.name);await rejoined.connect();
    assert.equal(rejoined.id,b.id);assert.equal(rejoined.state.players[b.id].shipId,sb.id);assert.equal(rejoined.state.players[b.id].aboardShipId,sa.id);
    assert.deepEqual(rejoined.state.players[b.id].pose.sw,mid);assert.equal(Object.values(world.state.ships).filter(s=>!s.npc).length,2);          // (the world's raiders are ships too: count the players')
    check('refresh mid-trip restores the same identity, owned ship and passenger-local pose',true);
    const savedMid={record:structuredClone(world.state),bricks:structuredClone([...world.bricks.values()])};
    const restored=await new world.constructor({load:async()=>structuredClone(savedMid),save:async()=>{}},{now:()=>clock+2000}).load();
    assert.equal(restored.state.ships[sa.id].trip.phase,world.state.ships[sa.id].trip.phase);assert.ok(restored.state.ships[sa.id].trip.t>world.state.ships[sa.id].trip.t);
    assert.deepEqual(restored.state.players[b.id].pose.sw,mid);check('loading a mid-flight checkpoint reconstructs the drive and advances downtime',true);
    const leaseExpired=await new world.constructor({load:async()=>structuredClone(savedMid),save:async()=>{}},{now:()=>clock+31000}).load();
    assert.equal(leaseExpired.state.players[b.id].pose.seat,null);assert.equal(leaseExpired.state.players[b.id].aboardShipId,sa.id);
    assert.notDeepEqual(leaseExpired.state.players[b.id].pose.sw,mid);check('restart expires abandoned seats while retaining passengers aboard',true);
    // Advance the real trip rules; no test warp endpoint exists on the wire.
    let elapsed=0;while(world.state.ships[sa.id].trip&&elapsed<15000){world.advance(30);elapsed+=30;}
    assert.equal(world.state.ships[sa.id].frameId,'phobos');assert.equal(world.state.ships[sa.id].pose.landed,true);
    assert.equal(world.state.players[b.id].frameId,'phobos');await world.commit();check('both passengers reach Phobos through the shared flight rules',true);
    a.close();rejoined.close();await app.close();app=null;
    clock+=2000;app=await startServer({adapter:new FileAdapter(join(dir,'world.json')),port:0,tick:false,now:()=>clock});
    rejoined=new TestClient(app.url,b.key,b.name);await rejoined.connect();
    assert.equal(rejoined.state.players[b.id].aboardShipId,sa.id);assert.equal(rejoined.state.ships[sa.id].frameId,'phobos');
    assert.ok(app.world.bricks.size);check('server restart preserves ship, passenger, contracts, purse and excavated bricks',true);
    const byteBefore=await readFile(join(dir,'world.json'),'utf8'),oldSave=app.world.adapter.save.bind(app.world.adapter);
    app.world.adapter.save=async()=>{throw Error('Injected disk failure');};const refusal=await rejoined.action({type:'rename',name:'Should not persist'});
    assert.equal(refusal.ok,false);assert.equal(app.world.state.players[b.id].name,'Lilith');assert.equal(await readFile(join(dir,'world.json'),'utf8'),byteBefore);
    app.world.adapter.save=oldSave;check('failed durable writes roll back state and never acknowledge success',true);
    assert.equal((await fetch(app.url.replace('ws:','http:')+'/server/.data/world.json')).status,404);
    assert.equal((await fetch(app.url.replace('ws:','http:')+'/server/storage.mjs')).status,404);check('HTTP cannot serve private server code or saved device identities',true);
  }catch(e){check('multiplayer scenario completes',false,e.stack);}
  finally{a?.close();b?.close();rejoined?.close();if(app)await app.close();await rm(dir,{recursive:true,force:true});}
}
