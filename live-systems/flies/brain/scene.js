import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $=id=>document.getElementById(id), set=(id,value)=>$(id).textContent=value;
const valid=v=>typeof v==='number'&&Number.isFinite(v);
const number=(v,d=0)=>valid(v)?v.toLocaleString(undefined,{maximumFractionDigits:d}):'—';
const dollars=v=>valid(v)?new Intl.NumberFormat(undefined,{style:'currency',currency:'USD',maximumFractionDigits:2}).format(v):'—';
const signed=(v,suffix='')=>valid(v)?`${v>0?'+':''}${number(v,1)}${suffix}`:'—';
const cents=v=>valid(v)?`${number(v*100,1)}¢`:'—';
const COLORS=['#74d3d3','#599bc6','#d5dc89','#e6a962','#e8cf66','#e77e8e','#a599df','#466578'];
const API='https://ygjpnvrwhkrowkrskftk.supabase.co/rest/v1/';
const KEY='sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN';
let selected='fly-1', rows=[], atlas, positions, spikeMesh, brain, renderer, scene, camera, controls;
let seenTick=null, flashAt=-Infinity, activeRow=null, polling=false, actionsPolling=false, actionInitialized=false, newestAction=null;
let lastReadOK=false, autoOrbit=!matchMedia('(prefers-reduced-motion: reduce)').matches, avatar, mixer, rigNodes=[], clips=[], pressedAt=-Infinity, lastPose=null;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const sceneState={atlasReady:false,rendered:false,pointCount:0,flashUpdates:0,selected,glb:false};
// Read-only diagnostics also make source-to-render verification possible.
window.flyScene=sceneState;
function float16(h){const s=(h&0x8000)?-1:1,e=(h>>10)&31,m=h&1023;return e===0?s*2**-14*(m/1024):e===31?(m?NaN:s*Infinity):s*2**(e-15)*(1+m/1024);}
async function readTable(query){const r=await fetch(API+query,{headers:{apikey:KEY},signal:AbortSignal.timeout(10000),cache:'no-store'});if(!r.ok)throw new Error(`Data unavailable (${r.status})`);return r.json();}
function freshness(){
  const age=activeRow?Math.max(0,(Date.now()-Date.parse(activeRow.at))/1000):Infinity;
  const fresh=Number.isFinite(age)&&age<30&&lastReadOK;
  set('connection',fresh?'Live simulation':activeRow?'Last known tick':'Waiting for data');
  set('tickAge',Number.isFinite(age)?`${Math.floor(age)}s since tick`:'No tick yet');
  $('liveDot').classList.toggle('fresh',fresh);sceneState.fresh=fresh;
  if(!fresh&&spikeMesh)spikeMesh.material.opacity=0;
  return fresh;
}
function renderData(){
  activeRow=rows.find(r=>r.fly===selected)||null;const s=activeRow?.state||{};
  set('mode',({dry:'DRY',live:'LIVE',watch:'WATCH'})[activeRow?.mode]||'—');
  set('role',selected==='watcher-1'?'Observer · no hands':activeRow?.mode==='dry'?'Simulation · no orders':'Trader');
  set('flyId',selected);set('valence',signed(s.valence));set('sugar',dollars(s.realized));set('sugarNote',activeRow?.mode==='dry'?'Dry-run realized P&L':'Reported realized P&L');
  $('valence').classList.toggle('negative',valid(s.valence)&&s.valence<0);
  const v=valid(s.valence)?Math.max(-80,Math.min(80,s.valence)):0,pct=(v+80)/1.6;
  $('valenceFill').style.left=`${Math.min(50,pct)}%`;$('valenceFill').style.width=`${Math.abs(pct-50)}%`;$('valenceFill').style.background=v<0?'var(--down)':'var(--accent)';
  const meter=document.querySelector('[role=meter]');valid(s.valence)?meter.setAttribute('aria-valuenow',s.valence):meter.removeAttribute('aria-valuenow');
  set('spikes',number(s.spikes_per_sec));set('kc',number(s.kc));set('cap',Array.isArray(s.cap)?s.cap.map(v=>dollars(v).replace(/\.00$/,'')).join(' / '):'—');
  set('matchTitle',s.title||'Waiting for a match');set('smelling',s.player?`Smelling from ${s.player} (${String(s.side||'—').toUpperCase()} @ ${cents(s.price)})`:'No current sensory data');
  set('sets',Array.isArray(s.sets)?s.sets.map(x=>number(x)).join(' : '):'—');set('points',Array.isArray(s.pts)?s.pts.map(x=>number(x)).join(' : '):'—');
  set('period',`Current set ${s.period||'—'}`);set('price',cents(s.price));set('move',valid(s.dprice)?signed(s.dprice*100,'¢'):'—');set('spread',cents(s.spread));set('holding',typeof s.holding==='boolean'?(s.holding?'Yes':'No'):'—');
  set('response',valid(s.valence)?s.valence>20?'Approach':s.valence< -15?'Avoid':'Neutral':'—');
  const scores=String(s.score||'').split(',').map(x=>x.trim()).filter(Boolean),current=Number(String(s.period||'').replace(/\D/g,''))-1;
  $('scoreSets').replaceChildren(...scores.map((score,i)=>{const el=document.createElement('span');el.textContent=score;if(i===current){el.className='current';el.setAttribute('aria-label',`Current set: ${score}`);}return el;}));
  set('firedTotal',number(s.fired_total));
  if(atlas&&activeRow){
    const fired=Array.isArray(activeRow.fired)?[...new Set(activeRow.fired.filter(i=>Number.isInteger(i)&&i>=0&&i<atlas.n))]:null;
    set('firedCount',fired?number(fired.length):'—');
    set('dn',fired?number(fired.filter(i=>atlas.regions[atlas.region[i]]==='DN').length):'—');
    sceneState.dnSampled=fired?.filter(i=>atlas.regions[atlas.region[i]]==='DN').length??null;
    // Never replay a fetched tick. Stale data remains visible, without fake activity.
    if(activeRow.at!==seenTick){seenTick=activeRow.at;sceneState.tick=seenTick;if(freshness()&&fired){updateSpikes(fired);sceneState.flashUpdates++;}}
  }else{set('firedCount','—');set('dn','—');}
  freshness();
}
function updateSpikes(indices){if(!spikeMesh)return;const a=spikeMesh.geometry.attributes.position.array;const limit=Math.min(indices.length,3000);for(let j=0;j<limit;j++)a.set(positions.subarray(indices[j]*3,indices[j]*3+3),j*3);spikeMesh.geometry.attributes.position.needsUpdate=true;spikeMesh.geometry.setDrawRange(0,limit);flashAt=performance.now();sceneState.sampleCount=limit;}
async function pollLive(){if(polling||document.hidden)return;polling=true;try{rows=await readTable('fly_live?select=fly,at,mode,state,fired');lastReadOK=true;renderData();}catch(e){lastReadOK=false;freshness();}finally{polling=false;}}
async function pollActions(){if(actionsPolling||document.hidden)return;actionsPolling=true;const fly=selected;try{
  const data=await readTable(`fly_actions?select=*&fly=eq.${encodeURIComponent(fly)}&order=at.desc&limit=8`);if(fly!==selected)return;
  const items=data.map(a=>{const li=document.createElement('li'),time=document.createElement('time'),kind=document.createElement('b'),detail=document.createElement('span');li.className=String(a.action||'');time.textContent=a.at?new Date(a.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';kind.textContent=a.action||'action';detail.textContent=a.note||a.why||a.title||a.slug||'Recorded action';li.append(time,kind,detail);return li;});
  if(!items.length){const li=document.createElement('li');li.className='empty';li.textContent='No recorded actions for this fly yet.';items.push(li);} $('actions').replaceChildren(...items);set('actionStatus','Last 8 · checked '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
  const latest=data[0];if(actionInitialized&&latest&&String(latest.id??latest.at)!==newestAction&&latest.action==='press'&&Date.now()-Date.parse(latest.at)<15000){pressedAt=performance.now();playClip('press');}newestAction=latest?String(latest.id??latest.at):null;actionInitialized=true;
}catch(e){set('actionStatus','Action feed unavailable · retrying');}finally{actionsPolling=false;}}
document.querySelectorAll('[data-fly]').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.fly;sceneState.selected=selected;seenTick=null;actionInitialized=false;newestAction=null;if(spikeMesh)spikeMesh.geometry.setDrawRange(0,0);document.querySelectorAll('[data-fly]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderData();pollActions();}));
function box(w,h,d,color,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.8}));m.position.set(x,y,z);scene.add(m);return m;}
function playClip(name){if(!mixer)return;const clip=clips.find(c=>c.name.toLowerCase().includes(name));if(clip){mixer.stopAllAction();const action=mixer.clipAction(clip);action.reset().setLoop(name==='press'?THREE.LoopOnce:THREE.LoopRepeat,name==='press'?1:Infinity).play();}}
async function loadAvatar(){
  avatar=new THREE.Group();avatar.position.set(-1.05,-1.06,.72);scene.add(avatar);
  const body=new THREE.Mesh(new THREE.SphereGeometry(.18,12,8),new THREE.MeshStandardMaterial({color:'#c2c687',roughness:.65}));body.scale.set(.8,.8,1.6);avatar.add(body);
  for(const sign of [-1,1]){const wing=new THREE.Mesh(new THREE.SphereGeometry(.16,10,6),new THREE.MeshStandardMaterial({color:'#a6d5d8',transparent:true,opacity:.48,roughness:.3}));wing.scale.set(1,.12,1.8);wing.position.set(sign*.16,.12,-.02);wing.rotation.z=sign*.25;wing.userData.sign=sign;avatar.add(wing);}
  try{const response=await fetch('fly.glb',{method:'HEAD'});if(!response.ok)return;const gltf=await new GLTFLoader().loadAsync('fly.glb');
    avatar.children.forEach(c=>{c.geometry?.dispose();c.material?.dispose();});avatar.clear();const model=gltf.scene;const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());model.position.sub(center);const scale=.8/Math.max(size.x,size.y,size.z);const holder=new THREE.Group();holder.scale.setScalar(scale);holder.add(model);avatar.add(holder);mixer=new THREE.AnimationMixer(model);clips=gltf.animations;model.traverse(n=>{if(n.isBone&&/wing|foreleg|front.*leg/i.test(n.name)){n.userData.rest=n.rotation.clone();rigNodes.push(n);}});playClip('idle');set('assetNote','Rigged fly asset loaded. Motion illustrates the brain’s response.');sceneState.glb=true;
  }catch(e){set('assetNote','Fly asset could not load. Showing the three-shape placeholder.');}
}
async function setup(){try{
  const viewport=$('viewport');renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x080e16,0);viewport.append(renderer.domElement);scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(43,1,.1,50);
  const reset=()=>{camera.position.set(0,1.3,6.9);controls.target.set(0,-.1,0);controls.update();};controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=3.7;controls.maxDistance=10;controls.maxPolarAngle=Math.PI*.73;controls.autoRotate=autoOrbit;controls.autoRotateSpeed=.23;reset();$('resetView').onclick=reset;
  $('orbit').textContent=autoOrbit?'Pause orbit':'Start orbit';$('orbit').setAttribute('aria-pressed',String(autoOrbit));$('orbit').onclick=()=>{autoOrbit=!autoOrbit;controls.autoRotate=autoOrbit;$('orbit').textContent=autoOrbit?'Pause orbit':'Start orbit';$('orbit').setAttribute('aria-pressed',String(autoOrbit));};
  scene.add(new THREE.HemisphereLight(0xc3dfdd,0x101723,2));const light=new THREE.DirectionalLight(0xe7ebc9,3);light.position.set(2,5,4);scene.add(light);
  box(3.5,.08,2,0x153e40,0,-1.3,0);box(3.52,.012,.018,0x85aaa4,0,-1.25,-.98);box(3.52,.012,.018,0x85aaa4,0,-1.25,.98);box(.018,.012,2,0x85aaa4,-1.74,-1.25,0);box(.018,.012,2,0x85aaa4,1.74,-1.25,0);box(3.5,.012,.012,0x719c96,0,-1.25,0);
  box(.02,.24,2.03,0x698a88,0,-1.12,0).material=new THREE.MeshStandardMaterial({color:0x678a87,transparent:true,opacity:.28,wireframe:true});
  for(const x of [-1.45,1.45])for(const z of [-.73,.73])box(.05,.55,.05,0x253440,x,-1.6,z);
  brain=new THREE.Group();brain.position.y=.32;scene.add(brain);
  new ResizeObserver(()=>{const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(viewport);
  loadAvatar();
  const [metaResponse,binaryResponse]=await Promise.all([fetch('../atlas.json'),fetch('../atlas.bin')]);if(!metaResponse.ok||!binaryResponse.ok)throw new Error('Measured atlas unavailable');
  atlas=await metaResponse.json();const buffer=await binaryResponse.arrayBuffer();if(buffer.byteLength!==atlas.n*6||atlas.region.length!==atlas.n)throw new Error('Atlas length mismatch');
  positions=new Float32Array(atlas.n*3);const bytes=new DataView(buffer),colors=new Float32Array(atlas.n*3);
  for(let i=0;i<positions.length;i++){const value=float16(bytes.getUint16(i*2,true));if(!Number.isFinite(value))throw new Error('Invalid atlas coordinate');positions[i]=(value-.5)*2.7;}
  for(let i=0;i<atlas.n;i++){const c=new THREE.Color(COLORS[atlas.region[i]]||COLORS[7]);colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const material=new THREE.PointsMaterial({size:.012,vertexColors:true,transparent:true,opacity:.56,depthWrite:false,sizeAttenuation:true});brain.add(new THREE.Points(geometry,material));
  const spikes=new THREE.BufferGeometry();spikes.setAttribute('position',new THREE.BufferAttribute(new Float32Array(9000),3));spikes.setDrawRange(0,0);spikeMesh=new THREE.Points(spikes,new THREE.PointsMaterial({color:0xe7ffbe,size:.028,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));spikeMesh.frustumCulled=false;brain.add(spikeMesh);
  $('legend').replaceChildren(...atlas.regions.map((name,i)=>{const span=document.createElement('span'),dot=document.createElement('i');dot.style.background=COLORS[i];span.append(dot,document.createTextNode(name));return span;}));
  // Anchor the label to the measured KC centroid, not an arbitrary screen location.
  const kcCenter=new THREE.Vector3();let count=0;atlas.region.forEach((code,i)=>{if(atlas.regions[code]==='KC'){kcCenter.add(new THREE.Vector3().fromArray(positions,i*3));count++;}});if(count)kcCenter.divideScalar(count);sceneState.kcAtlasCount=count;
  set('atlasCount',`${number(atlas.n)} measured neuron positions`);set('flashNote','Drag to orbit · new ticks flash once');sceneState.atlasReady=true;sceneState.pointCount=atlas.n;renderData();
  let last=performance.now();function animate(t){requestAnimationFrame(animate);if(document.hidden)return;const dt=Math.min((t-last)/1000,.05);last=t;controls.update(dt);mixer?.update(dt);
    const s=activeRow?.state||{},v=sceneState.fresh?s.valence:null,elapsed=t-flashAt;spikeMesh.material.opacity=sceneState.fresh?Math.max(0,1-elapsed/1600):0;
    const pose=t-pressedAt<700?'press':valid(v)&&v< -15?'groom':valid(v)&&v>20?'wing':'idle';if(pose!==lastPose){if(!reducedMotion)playClip(pose);lastPose=pose;}
    if(avatar){if(!sceneState.glb){for(const wing of avatar.children.slice(1)){const sign=wing.userData.sign;wing.rotation.z=sign*(valid(v)&&v>20?.7:valid(v)&&v< -15?.08:.25);}}else{for(const node of rigNodes){node.rotation.copy(node.userData.rest);if(/wing/i.test(node.name)&&valid(v)&&v>20)node.rotation.z+=.45;if(/foreleg|front.*leg/i.test(node.name)&&t-pressedAt<700)node.rotation.x+=Math.sin((t-pressedAt)/700*Math.PI)*.6;}}avatar.position.y=-1.06+(!reducedMotion&&valid(v)&&v>20?Math.sin(t*.004)*.025:0);if(t-pressedAt<700)avatar.rotation.x=Math.sin((t-pressedAt)/700*Math.PI)*.18;else avatar.rotation.x=0;}
    const label=kcCenter.clone();brain.localToWorld(label);label.project(camera);const x=(label.x*.5+.5)*viewport.clientWidth,y=(-label.y*.5+.5)*viewport.clientHeight;const el=document.querySelector('.atlas-label');el.style.left=`${Math.max(12,Math.min(viewport.clientWidth-140,x+16))}px`;el.style.top=`${Math.max(65,Math.min(viewport.clientHeight-120,y-32))}px`;
    renderer.render(scene,camera);sceneState.rendered=true;
  }requestAnimationFrame(animate);
}catch(e){$('sceneError').hidden=false;set('sceneError',`${e.message}. Live vitals remain available below.`);sceneState.error=e.message;}}
setup();pollLive();pollActions();setInterval(pollLive,3000);setInterval(pollActions,10000);setInterval(freshness,1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){pollLive();pollActions();}});
