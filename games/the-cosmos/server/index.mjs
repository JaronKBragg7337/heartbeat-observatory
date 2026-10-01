import './runtime.mjs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileAdapter, SupabaseAdapter } from './storage.mjs';
import { upgrade } from './websocket.mjs';
import { stringify, parse } from '../src/world-state/wire.js';
// Resolve browser import-map names after runtime hooks are registered, even on
// a fresh checkout with no node_modules shim from the validator.
const { Authority } = await import('./authority.mjs');

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.svg':'image/svg+xml','.webp':'image/webp'};
export async function startServer({adapter,port=8390,host='127.0.0.1',tick=true,now=Date.now}={}) {
  if(!adapter){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!!url!==!!key)throw Error('Set both Supabase environment variables.');
    if(url&&key)adapter=new SupabaseAdapter(url,key,process.env.COSMOS_WORLD_ID||'marineris');
    else if(process.env.COSMOS_LOCAL_STORE==='1')adapter=new FileAdapter(resolve(root,'server/.data/world.json'));
    else throw Error('Supabase credentials missing. Use COSMOS_LOCAL_STORE=1 only for local tests.');}
  const world=await new Authority(adapter,{now}).load();let timer,checkpoint=0,closing=false;
  const peers=new Set();
  const send=(peer,msg)=>peer.send(stringify(msg));
  function broadcast(bricks=[]){for(const peer of peers)if(peer.playerId)send(peer,{type:'state',state:world.publicState(),bricks});}
  const server=createServer(async(req,res)=>{
    if(req.url==='/health'){res.writeHead(world.error?503:200,{'content-type':'application/json','cache-control':'no-store'}).end(JSON.stringify({ok:!world.error,revision:world.state.revision,players:world.sessions.size,storage:adapter.constructor.name}));return;}
    try {const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const allowed=path==='/'||path==='/index.html'||/^\/(src|lib|assets)\//.test(path)||/^\/[\w-]+\.css$/.test(path)||path.startsWith('/homes/people/');
      if(!allowed||path.split('/').some(p=>p.startsWith('.'))){res.writeHead(404).end();return;}
      const base=path.startsWith('/homes/people/')?resolve(root,'../../homes/people'):root;
      const rel=path.startsWith('/homes/people/')?path.slice('/homes/people/'.length):(path==='/'?'index.html':path.slice(1));
      const file=resolve(base,rel);if(!file.startsWith(base+'\\')&&!file.startsWith(base+'/')){res.writeHead(403).end();return;}
      if(!(await stat(file)).isFile())throw Error();res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':'no-cache'}).end(await readFile(file));
    }catch{res.writeHead(404).end();}
  });
  server.on('upgrade',(req,socket,head)=>{
    // Browser origins are checked; protocol-only headless clients have no Origin.
    const origin=req.headers.origin;const extras=(process.env.COSMOS_ALLOWED_ORIGINS||'').split(',').filter(Boolean);
    if(origin&&!/^https:\/\/(cosmos\.)?heartbeatobservatory\.com$/.test(origin)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)&&!extras.includes(origin)){socket.destroy();return;}
    let peer;peer=upgrade(req,socket,head,text=>{
      world.enqueue(async()=>{if(closing)return;let m;try{m=parse(text);}catch{peer.close();return;}
        try{
          if(m.type==='hello'){const p=await world.join(m.deviceKey,m.name,m.personId);peer.playerId=p.id;world.sessions.set(p.id,peer);
            send(peer,{type:'welcome',playerId:p.id,state:world.publicState(),bricks:[...world.bricks.values()]});broadcast();}
          else if(!peer.playerId)throw Error('Join first.');
          else if(m.type==='pose'){world.updatePose(world.state.players[peer.playerId],m);}
          else if(m.type==='action'){const result=await world.action(peer.playerId,m.actionId,m.action);const bricks=result.bricks||[];delete result.bricks;
            send(peer,{type:'receipt',actionId:m.actionId,...result,revision:world.state.revision});broadcast(bricks);}
          else if(m.type==='checkpoint'){const bricks=await world.commit();broadcast(bricks);}
          else throw Error('Unknown message.');
        }catch(e){send(peer,{type:'error',msg:e.message});}
      });
    },()=>{peers.delete(peer);if(peer?.playerId)world.enqueue(()=>{world.disconnect(peer.playerId,peer);broadcast();});});
    if(peer){peers.add(peer);socket.setTimeout(45000,()=>socket.destroy());}
  });
  await new Promise((ok,no)=>{server.once('error',no);server.listen(port,host,ok);});
  if(tick){let last=performance.now(),busy=false,updates=0;
    timer=setInterval(()=>{if(busy||closing)return;busy=true;const t=performance.now(),elapsed=(t-last)/1000;last=t;
      world.enqueue(async()=>{world.advance(elapsed);checkpoint+=elapsed;updates+=elapsed;
        if(checkpoint>=2){checkpoint=0;try{const bricks=await world.commit();broadcast(bricks);}catch{world.error='Durable storage failed; transactions are paused.';broadcast();}}
        else if(updates>=.1){updates=0;broadcast();}
      }).finally(()=>busy=false);
    },1000/30);}
  return {world,server,url:'ws://127.0.0.1:'+server.address().port,
    async close(){closing=true;clearInterval(timer);await world.queue;await world.commit();for(const p of peers)p.close();await new Promise(r=>server.close(r));}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let app;
  try { app=await startServer({port:Number(process.env.COSMOS_PORT||8390)}); }
  catch(e) {
    // Missing migration RPCs return HTTP 400/404. Keep local play available until applied.
    if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY||!(/HTTP (400|404)/.test(e.message))) throw e;
    console.error('Supabase schema unavailable at startup; using local FileAdapter until migration is applied.');
    app=await startServer({adapter:new FileAdapter(resolve(root,'server/.data/world.json')),port:Number(process.env.COSMOS_PORT||8390)});
  }
  console.log('The Cosmos authority listening on localhost:'+app.server.address().port+' ('+app.world.adapter.constructor.name+').');
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.close().then(()=>process.exit(0)).catch(()=>process.exit(1)));
}
