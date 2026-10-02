import {createRequire} from 'node:module';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {startServer} from '../server/index.mjs';
import {FileAdapter} from '../server/storage.mjs';
import {execFileSync} from 'node:child_process';
const require=createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT||'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/');
const {chromium}=require('playwright');
const out=fileURLToPath(new URL('../docs/qa/2026-10-01/mp-fix/',import.meta.url));
await mkdir(out,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'cosmos-parity-'));
const before=process.argv.includes('--before');
let app,browser,clock=Date.now();const results={},errors=[];
const baselineFiles=[];
try{
 let baseline;
 if(before){for(const name of ['simulation','authority']){const path=fileURLToPath(new URL('../server/__qa-before-'+name+'.mjs',import.meta.url));baselineFiles.push(path);
   const source=execFileSync('git',['show','HEAD:games/the-cosmos/server/'+name+'.mjs'],{encoding:'utf8'}).replace("'./simulation.mjs'","'./__qa-before-simulation.mjs'");await writeFile(path,source);}
   baseline=await import(new URL('../server/__qa-before-authority.mjs',import.meta.url));}
 // The live Supabase authority already owns 127.0.0.1:8390 on the MSI.
 // Bind the test authority to a separate loopback address on the same port.
 app=await startServer({adapter:new FileAdapter(join(temp,'world.json')),host:'127.0.0.2',port:8390,tick:false,now:()=>clock});
 if(baseline){Object.setPrototypeOf(app.world,baseline.Authority.prototype);app.world.state.pool={};app.world.state.poolSeq=0;app.world.rebuild();app.world.refill();}
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebSockets']});
 const context=await browser.newContext({viewport:{width:1280,height:720}});
 await context.addInitScript(()=>{const WS=window.WebSocket;window.WebSocket=class extends WS{constructor(url,...rest){super(String(url).replace('localhost:8390','127.0.0.2:8390'),...rest);}};});
 await context.route('http://localhost:8390/**',route=>route.continue({url:route.request().url().replace('localhost:8390','127.0.0.2:8390')}));
 if(before)await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;
   if(path==='/index.html'||path==='/'||path.startsWith('/src/')){try{const source=execFileSync('git',['show','HEAD:games/the-cosmos/'+(path==='/'?'index.html':path.slice(1))],{encoding:'utf8',stdio:['ignore','pipe','ignore']});return route.fulfill({body:source,contentType:path.startsWith('/src/')?'text/javascript':'text/html'});}catch{}}
   if(route.request().url().startsWith('http://localhost:8390/'))return route.fulfill({response:await route.fetch({url:route.request().url().replace('localhost:8390','127.0.0.2:8390')})});
   await route.fallback();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')console.log('Browser:',m.text());});
 await page.goto('http://localhost:8390/?tier=low&dev=1');
 try{await page.waitForFunction(()=>window.cosmos,null,{timeout:30000});}catch(e){console.log('Boot state:',await page.evaluate(()=>({url:location.href,boot:document.querySelector('#boot')?.innerText,scripts:[...document.scripts].map(s=>s.src)})));await page.screenshot({path:join(out,'before-boot.png')});throw e;}
 if(!await page.evaluate(()=>!!cosmos.multiplayer))throw Error('Not online: '+await page.evaluate(()=>JSON.stringify({remote:cosmos.world.remote,error:cosmos.world.error,offline:cosmos.world.offline})));
 await page.evaluate(()=>cosmos.engine.stop());
 const id=await page.evaluate(()=>cosmos.world.playerId),w=app.world;
 const p=w.state.players[id],sim=w.sims.get(p.shipId);
 async function sync(){await w.enqueue(()=>w.commit());await page.evaluate(()=>cosmos.world.socket.send(JSON.stringify({type:'checkpoint'})));await page.waitForFunction(r=>cosmos.world.state.revision>=r,w.state.revision);await page.evaluate(()=>{cosmos.multiplayer.forcePlayer=true;cosmos.multiplayer.apply({bricks:[]});cosmos.step(.21);});}
 function ground(x,y,z){p.aboardShipId=null;p.pose.aboard=false;p.pose.seat=null;p.pose.worldPos=w.site.toWorld(x,y,z);p.pose.velocity={x:0,y:0,z:0};p.poseAt=clock;}
 ground(-28,.02,-57);await sync();await page.waitForTimeout(3000);
 await w.enqueue(()=>w.advance(20));await sync();results.candidateStates=Object.values(w.state.pool).map(c=>({name:c.name,status:c.status,position:c.position}));
 await page.evaluate(()=>{cosmos.multiplayer.tick(.21);cosmos.step(.21);});
 results.hall=await page.evaluate(()=>({visible:[...cosmos.multiplayer.bodies.values()].filter(b=>b.group.visible).map(b=>b.name),crewUI:!!cosmos.crewUI}));
 await page.screenshot({path:join(out,before?'before-hall.png':'desktop-hall.png')});
 ground(-70,.02,52);await sync();results.trader=await page.evaluate(()=>({workers:cosmos.portPeople.members.length,talk:!!document.querySelector('#crew-talk'),crewUI:!!cosmos.crewUI}));
 const st=sim.ship.state.ramps.cargo,local={x:0,y:-Math.sin(st.angle)*5,z:20.9+Math.cos(st.angle)*5-.03};
 p.pose.worldPos=sim.flight.toWorld(local,{});p.pose.yaw=sim.flight.heading;p.poseAt=clock;await sync();
 results.boardBefore=await page.evaluate(()=>({...cosmos.ship.flight.toLocal(cosmos.walker.worldPos,{})}));
 await page.evaluate(()=>cosmos.ship._outsideFrame(1/60,{moveNorth:1,moveEast:0}));await page.waitForTimeout(250);
 results.boardAfter=await page.evaluate(()=>({aboard:cosmos.ship.aboard,sw:{x:cosmos.ship.sw.x,y:cosmos.ship.sw.y,z:cosmos.ship.sw.z},world:cosmos.ship.flight.toLocal(cosmos.walker.worldPos,{})}));
 console.log(JSON.stringify(results,null,2));
}finally{await writeFile(join(out,before?'before.json':'browser-results.json'),JSON.stringify({results,errors},null,2));await browser?.close();await app?.close();for(const path of baselineFiles)await rm(path,{force:true});await rm(temp,{recursive:true,force:true});}
