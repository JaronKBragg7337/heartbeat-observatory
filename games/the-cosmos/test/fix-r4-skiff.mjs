// FIX-R4 (28): EYES capture of the Skiff flight deck from the pilot seat (forward, down) and from the front window looking aft. Real GL (angle) Chromium.
import {createRequire} from 'node:module';import {join} from 'node:path';
const pw=createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT||'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules')('playwright');
const tag=process.argv[2]||'after';
const exe=process.env.COSMOS_CHROMIUM_EXE||join(process.env.LOCALAPPDATA,'ms-playwright','chromium-1234','chrome-win64','chrome.exe');
const browser=await pw.chromium.launch({headless:false,executablePath:exe,args:['--use-gl=angle','--use-angle=d3d11','--enable-webgl','--ignore-gpu-blocklist']});
const page=await (await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:2})).newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.COSMOS_LOCAL_URL||'http://localhost:8391/?dev=1&solo=1&tier=low');
await page.waitForFunction(()=>window.cosmos?.opening?.actorsReady,{},{timeout:90000});
await page.evaluate(()=>{cosmos.engine.stop();cosmos.opening.ui.hidden=true;});
const views={'pilot-fwd-down':{eye:[-0.9,1.15,-4.0],look:[-0.9,0.7,-5.2]},'pilot-fwd':{eye:[-0.9,1.25,-3.9],look:[-0.4,1.2,-6]},'window-aft':{eye:[0,1.5,-4.9],look:[0,1.2,-2.0]},'window-aft-left':{eye:[-1.2,1.5,-4.9],look:[0.6,1.0,-2.0]}};
for(const [n,v] of Object.entries(views)){
  await page.evaluate(h=>{window.qaHide=h;},tag==='after');
  await page.evaluate(async({v})=>{
    const {ShipStage}=await import('/src/opening/stageShip.js');const THREE=await import('/lib/three.module.js');
    if(!window.qaStage){window.qaStage=new ShipStage({engine:{track:x=>x,untrack:()=>{}},type:'lifeboat',mats:cosmos.opening.mats,signs:cosmos.ship.signs,tier:'low'});}
    if(!window.qaExt){const {buildLifeboatExterior}=await import('/src/ships/lifeboat/exterior.js');const {LAYOUT}=await import('/src/ships/lifeboat/spec.js');
      window.qaExt=buildLifeboatExterior(LAYOUT,cosmos.ship.matsExt,{world:'mars',remote:true});window.qaExtScene=new THREE.Scene();window.qaExtScene.background=new THREE.Color(0x6a4a3a);
      window.qaExtScene.add(new THREE.AmbientLight(0xffffff,1.4));const dl=new THREE.DirectionalLight(0xfff0dd,2);dl.position.set(3,8,4);window.qaExtScene.add(dl);
      const gr=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshBasicMaterial({color:0x8a5a3a}));gr.rotation.x=-Math.PI/2;gr.position.y=-1.4;window.qaExtScene.add(gr);window.qaExtScene.add(window.qaExt.root);}
    for(const o of qaExt.insideHide||[])o.visible=!window.qaHide;
    const s=qaStage,eye=new THREE.Vector3(...v.eye),target=new THREE.Vector3(...v.look);
    s.sw.place(eye.x,0,eye.z,0);s.sw.tick(0,{});s.sw.zoneRoom='cockpit';
    s.update(0,eye,target.clone().sub(eye).normalize(),{inside:true,walking:true,aspect:393/852,fov:72,first:true});
    const c=cosmos.engine.camera;c.position.copy(eye);c.up.set(0,1,0);c.lookAt(target);c.updateMatrixWorld(true);const R=cosmos.engine.renderer;R.autoClear=true;R.render(qaExtScene,c);R.autoClear=false;R.render(s.interiorScene,c);R.autoClear=true;
  },{v});
  await page.screenshot({path:join('docs','qa','2026-10-05','fix-r4',`skiff-${n}-${tag}.png`)});
}
console.log('errors',errors);await browser.close();
