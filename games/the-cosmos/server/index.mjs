import './runtime.mjs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileAdapter, SupabaseAdapter } from './storage.mjs';
import { logClientError } from './clientErrors.mjs';
import { upgrade } from './websocket.mjs';
import { tokenVerifier } from './identity.mjs';
import { stringify, parse } from '../src/world-state/wire.js';
import { BUILD_VERSION } from '../src/core/buildVersion.js';
// Resolve browser import-map names after runtime hooks are registered, even on
// a fresh checkout with no node_modules shim from the validator.
const { Authority } = await import('./authority.mjs');

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.svg':'image/svg+xml','.webp':'image/webp'};
export async function startServer({adapter,port=8390,host='127.0.0.1',tick=true,now=Date.now,verify,clientErrorLog=resolve(root,'server/.data/client-errors.log')}={}) {
  if(!adapter){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!!url!==!!key)throw Error('Set both Supabase environment variables.');
    if(url&&key)adapter=new SupabaseAdapter(url,key,process.env.COSMOS_WORLD_ID||'marineris');
    else if(process.env.COSMOS_LOCAL_STORE==='1')adapter=new FileAdapter(resolve(root,'server/.data/world.json'));
    else throw Error('Supabase credentials missing. Use COSMOS_LOCAL_STORE=1 only for local tests.');}
  // Sign-in: browsers send a Supabase access token; the server asks Supabase who it belongs to. Without Supabase credentials (local tests) tokens are ignored unless a verifier is passed in.
  if(verify===undefined)verify=process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY?tokenVerifier({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY}):null;
  // The listener opens FIRST (health answers 503 'starting' while the world loads and catches up), so a slow start is visible and never looks like a dead port.
  let world=null,timer,checkpoint=0,closing=false;const stats={n:0,sum:0,max:0,since:Date.now()};
  const peers=new Set();
  const send=(peer,msg)=>peer.send(stringify(msg));
  function broadcast(bricks=[]){for(const peer of peers)if(peer.playerId)send(peer,{type:'state',state:world.publicState(peer.playerId),serverAt:now(),bricks});}
  const server=createServer(async(req,res)=>{
    if(req.url==='/health'){
      // Answered from plain memory: no queue, no storage, no await. Only a blocked event loop can delay it, and the tick is bounded (see below) so it cannot be blocked for long.
      if(!world){res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'}).end(JSON.stringify({ok:false,starting:true,buildVersion:BUILD_VERSION}));return;}
      const tick={avgMs:stats.n?+(stats.sum/stats.n).toFixed(2):0,maxMs:+stats.max.toFixed(1),samples:stats.n};
      res.writeHead(world.error?503:200,{'content-type':'application/json','cache-control':'no-store'}).end(JSON.stringify({ok:!world.error,buildVersion:BUILD_VERSION,revision:world.state.revision,players:world.sessions.size,storage:adapter.constructor.name,tick}));return;}
    try {const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const allowed=path==='/'||path==='/index.html'||path==='/build.json'||path==='/favicon.svg'||/^\/(src|lib|assets)\//.test(path)||/^\/[\w-]+\.css$/.test(path)||path.startsWith('/homes/people/');
      if(!allowed||path.split('/').some(p=>p.startsWith('.'))){res.writeHead(404).end();return;}
      const base=path.startsWith('/homes/people/')?resolve(root,'../../homes/people'):root;
      const rel=path.startsWith('/homes/people/')?path.slice('/homes/people/'.length):(path==='/'?'index.html':path.slice(1));
      const file=resolve(base,rel);if(!file.startsWith(base+'\\')&&!file.startsWith(base+'/')){res.writeHead(403).end();return;}
      if(!(await stat(file)).isFile())throw Error();res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':'no-cache'}).end(await readFile(file));
    }catch{res.writeHead(404).end();}
  });
  server.on('upgrade',(req,socket,head)=>{
    if(!world){socket.destroy();return;}
    // Browser origins are checked; protocol-only headless clients have no Origin.
    const origin=req.headers.origin;const extras=(process.env.COSMOS_ALLOWED_ORIGINS||'').split(',').filter(Boolean);
    if(origin&&!/^https:\/\/(www\.|cosmos\.)?heartbeatobservatory\.com$/.test(origin)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)&&!extras.includes(origin)){socket.destroy();return;}
    let peer;peer=upgrade(req,socket,head,async text=>{
      // Checking a sign-in token calls Supabase: do it before joining the world's queue so a slow answer never stalls the simulation.
      let ident=null;if(text.includes('"hello"'))try{const probe=parse(text);if(probe?.type==='hello')ident=await world.identify(probe);}catch{ident=null;}
      world.enqueue(async()=>{if(closing)return;let m;try{m=parse(text);}catch{peer.close();return;}
        try{
          if(m.type==='hello'){const p=await world.join(m.deviceKey,m.name,m.personId,m.openingVersion,ident||{});peer.playerId=p.id;world.sessions.set(p.id,peer);
            send(peer,{type:'welcome',buildVersion:BUILD_VERSION,playerId:p.id,state:world.publicState(p.id),serverAt:now(),bricks:[...world.bricks.values()],identity:world.identityInfo(p,world.joinNote)});broadcast();}
          else if(!peer.playerId)throw Error('Join first.');
          else if(m.type==='client-error'){if(!peer.errorReports||peer.errorReports<4){peer.errorReports=(peer.errorReports||0)+1;await logClientError(clientErrorLog,m);}}
          else if(m.type==='pose'){world.updatePose(world.state.players[peer.playerId],m);}
          else if(m.type==='action'){const result=await world.action(peer.playerId,m.actionId,m.action);const bricks=result.bricks||[];delete result.bricks;
            send(peer,{type:'receipt',actionId:m.actionId,...result,revision:world.state.revision});broadcast(bricks);}
          else if(m.type==='identity'){
            // Start fresh: this player's ship, crew and pad leave the world, and the browser starts a new character.
            if(m.op==='discard'){const id=peer.playerId;world.sessions.delete(id);let ok=false;try{ok=world.removePlayer(id);}finally{if(!ok)world.sessions.set(id,peer);}
              if(ok){peer.playerId=null;await world.commit();}
              send(peer,{type:'identity-done',op:'discard',ok,msg:ok?'':'Someone is aboard your ship. Try again when they leave.'});broadcast();}
            else throw Error('Unknown identity request.');}
          else if(m.type==='checkpoint'){const bricks=await world.commit();broadcast(bricks);}
          else throw Error('Unknown message.');
        }catch(e){send(peer,{type:'error',msg:e.message});}
      });
    },()=>{peers.delete(peer);if(peer?.playerId)world.enqueue(()=>{world.disconnect(peer.playerId,peer);broadcast();});});
    if(peer){peers.add(peer);socket.setTimeout(45000,()=>socket.destroy());}
  });
  await new Promise((ok,no)=>{server.once('error',no);server.listen(port,host,ok);});
  try{world=await new Authority(adapter,{now,verify}).load();}catch(e){await new Promise(r=>server.close(r));throw e;}
  if(tick){let last=performance.now(),busy=false,updates=0,sweepClock=0;
    timer=setInterval(()=>{if(busy||closing)return;busy=true;const t=performance.now(),elapsed=Math.min(.25,(t-last)/1000);last=t;
      // The simulated step is capped at a quarter second. If the machine falls behind, the world runs a little slow for a moment; it never tries to
      // make up the lost time in one go (that catch-up is what turned one slow tick into a pegged CPU on October 2).
      world.enqueue(async()=>{const a=performance.now();world.advance(elapsed);const ms=performance.now()-a;stats.n++;stats.sum+=ms;if(ms>stats.max)stats.max=ms;if(stats.n>=900){stats.n=Math.round(stats.n/2);stats.sum/=2;stats.max=ms;}checkpoint+=elapsed;updates+=elapsed;sweepClock+=elapsed;
        if(sweepClock>=60){sweepClock=0;try{world.lastSweep=world.sweep();}catch(e){console.error('sweep failed:',e.message);}}
        if(checkpoint>=2){checkpoint=0;try{const bricks=await world.commit();broadcast(bricks);}catch{world.error='Durable storage failed; transactions are paused.';broadcast();}}
        else if(updates>=.1){updates=0;broadcast();}
      }).finally(()=>busy=false);
    },1000/30);}
  return {world,server,url:'ws://127.0.0.1:'+server.address().port,
    async close(){closing=true;clearInterval(timer);await world.queue;await world.commit();for(const p of peers)p.close();await new Promise(r=>server.close(r));}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let app;
  // With Supabase credentials the world lives in Supabase and nowhere else. A failed start is retried and then the process exits (the watchdog starts it
  // again). It must never serve a local file world instead: that was a second, nearly empty world (two players, five ships) that real players
  // joined for a while on October 2, and it looked like their ships and crew had vanished.
  const supabase=!!(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
  for(let attempt=1;!app;attempt++){
    try { app=await startServer({port:Number(process.env.COSMOS_PORT||8390)}); }
    catch(e) {
      if(!supabase) throw e;
      console.error(`Supabase world unavailable at startup (attempt ${attempt}): ${e.message}`);
      if(attempt>=6){console.error('Giving up; exiting so the watchdog can start a fresh process.');process.exit(1);}
      await new Promise(r=>setTimeout(r,Math.min(30000,3000*attempt)));
    }
  }
  console.log('The Cosmos authority listening on localhost:'+app.server.address().port+' ('+app.world.adapter.constructor.name+').');
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.close().then(()=>process.exit(0)).catch(()=>process.exit(1)));
}
