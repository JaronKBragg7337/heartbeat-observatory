// The classroom: live view of school-1 (Fly-Lab-2/school/school.py). Reads fly_live (one row, overwritten every trial)
// and fly_school (the log). Reuses the trader page's atlas + flybody loader. Nothing here computes a score.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {loadMeasuredFly} from '/live-systems/flies/brain/assets.js';

const $=id=>document.getElementById(id), set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
const valid=v=>typeof v==='number'&&Number.isFinite(v);
const number=(v,d=0)=>valid(v)?v.toLocaleString(undefined,{maximumFractionDigits:d}):'—';
const COLORS=['#74d3d3','#599bc6','#d5dc89','#e6a962','#e8cf66','#e77e8e','#a599df','#466578'];
const API='https://ygjpnvrwhkrowkrskftk.supabase.co/rest/v1/';
const KEY='sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN';
const FLY=(new URLSearchParams(location.search).get('fly')||(location.pathname.match(/^\/school\/([a-z0-9-]+)\/?$/)||[])[1]||'school-1').replace(/[^a-z0-9-]/g,''), FRESH_S=60, ASLEEP_S=120;
document.title=`${FLY} — The Classroom`;
const SYM={'.':'·','-':'–','.-':'·–','-.':'–·','':'silence'};
const BIN={dot:2,dash:6,gap:4,tail:4};   // 10 ms bins: dot 20 / dash 60 / gap 40 / tail 40 (chosen, same as school.py)
let row=null, atlas, positions, spikeMesh, brain, renderer, scene, camera, controls, measuredFly, seenTick=null, flashAt=-Infinity;
let lastReadOK=false, autoOrbit=!matchMedia('(prefers-reduced-motion: reduce)').matches, pressedAt=-Infinity, taps=[], mood=0, moodUntil=0;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const state={fresh:false,asleep:true}; window.classroom=state;
function float16(h){const s=(h&0x8000)?-1:1,e=(h>>10)&31,m=h&1023;return e===0?s*2**-14*(m/1024):e===31?(m?NaN:s*Infinity):s*2**(e-15)*(1+m/1024);}
async function readTable(q){const r=await fetch(API+q,{headers:{apikey:KEY},signal:AbortSignal.timeout(10000),cache:'no-store'});if(!r.ok)throw new Error(`Data unavailable (${r.status})`);return r.json();}
const ago=s=>s<90?`${Math.floor(s)}s`:s<5400?`${Math.floor(s/60)} min`:s<172800?`${(s/3600).toFixed(1)} h`:`${(s/86400).toFixed(1)} d`;
const when=iso=>iso?new Date(iso).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'}):'—';
const fedNote=s=>s.fed_at?`fed ${ago((Date.now()-Date.parse(s.fed_at))/1000)} ago`:'not fed yet';
const clock=iso=>iso?new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';

function freshness(){
  const age=row?Math.max(0,(Date.now()-Date.parse(row.at))/1000):Infinity;
  const per=row?.state?.period,slack=per==='sleep'?6:per==='free'?2:1;const fresh=Number.isFinite(age)&&age<FRESH_S*slack&&lastReadOK, asleep=!row||age>ASLEEP_S*slack;
  state.fresh=fresh;state.asleep=asleep;state.age=age;
  for(const id of['connection','connection2'])set(id,fresh?'Live simulation':row?'Last known trial':'Waiting for data');
  for(const id of['liveDot','liveDot2'])$(id).classList.toggle('fresh',fresh);
  set('tickAge',Number.isFinite(age)?`${ago(age)} since trial`:'no trial yet');
  if(asleep){const d=$('doing');d.textContent=row?'Off':'No fly yet';d.className='asleep';set('doingNote',row?`Life source down — the school process is not running · last sign of life ${clock(row.at)} (${ago(age)} ago) · memory fading meanwhile`:'The school has never written a trial');}
  if(!fresh&&spikeMesh)spikeMesh.material.opacity=0;
  return fresh;
}
function doing(s){
  const d=$('doing');d.className='';
  if(s.phase==='teach'){d.textContent=`Teaching ${SYM[s.symbol]||s.symbol}`;set('doingNote',`round ${(s.epoch??0)+1} of ${s.teach_epochs||12} · lesson ${s.lesson} · dopamine ${s.dopamine>0?'+1 reward':'−1 punishment'}`);}
  else if(s.phase==='exam'){d.textContent=`Exam: ${SYM[s.symbol]||s.symbol}`;set('doingNote',`cold · rep ${(s.epoch??0)+1} of ${s.exam_reps||6} · never taught this pair · no dopamine`);}
  else if(s.phase==='rest'){d.textContent='Resting';d.className='rest';set('doingNote',`between lessons · no sound · ${number(s.fired_total)} neurons fired`);}
  else if(s.phase==='free'){d.textContent='Free time';d.className='rest';set('doingNote',`out of school · ${fedNote(s)} · school again ${when(s.next_school)}`);}
  else if(s.phase==='meal'){d.textContent='Eating';d.className='';set('doingNote',`meal #${number(s.meals)} · a clock event for now, not dopamine · school again ${when(s.next_school)}`);}
  else if(s.phase==='sleep'){d.textContent='Sleeping';d.className='rest';set('doingNote',`night · forgetting runs on (half-life 6 h) · school again ${when(s.next_school)}`);}
  else{d.textContent=s.phase||'—';set('doingNote','');}
}
function strips(s){
  const active=Array.isArray(s.dn_active)?s.dn_active:[],n=active.length;
  const inb=new Array(n).fill(0);let p=0;const sym=String(s.symbol||'');
  for(let i=0;i<sym.length;i++){const len=sym[i]==='.'?BIN.dot:BIN.dash;for(let k=0;k<len&&p+k<n;k++)inb[p+k]=1;p+=len;if(i+1<sym.length)p+=BIN.gap;}
  $('inStrip').replaceChildren(...inb.map(v=>{const i=document.createElement('i');if(v)i.className='on';return i;}));
  $('outStrip').replaceChildren(...active.map(v=>{const i=document.createElement('i');if(v)i.className='on';return i;}));
  set('trialTitle',['rest','free','sleep','meal'].includes(s.phase)?'Nothing played':`${SYM[s.symbol]||s.symbol} played → DNa01 said ${s.decoded?SYM[s.decoded]||s.decoded:'nothing'}`);
  const v=$('verdict');
  if(['rest','free','sleep','meal'].includes(s.phase)){v.textContent=s.phase;v.className='verdict cold';}
  else if(s.phase==='exam'){v.textContent=s.correct?'EXACT · cold':'miss · cold';v.className='verdict '+(s.correct?'hit':'cold');}
  else{v.textContent=s.correct?`EXACT · +1 · ${number(s.synapses_hit)} synapses`:`miss · −1 · ${number(s.synapses_hit)} synapses`;v.className='verdict '+(s.correct?'hit':'miss');}
}
let ctx;function play(){const s=row?.state;if(!s||!Array.isArray(s.dn_active))return;ctx=ctx||new (window.AudioContext||window.webkitAudioContext)();const t0=ctx.currentTime+.05,binS=(s.bin_ms||10)/1000*8;
  s.dn_active.forEach((on,i)=>{if(!on)return;const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=660;o.connect(g);g.connect(ctx.destination);g.gain.setValueAtTime(.0001,t0+i*binS);g.gain.exponentialRampToValueAtTime(.25,t0+i*binS+.01);g.gain.exponentialRampToValueAtTime(.0001,t0+(i+1)*binS);o.start(t0+i*binS);o.stop(t0+(i+1)*binS+.02);});}
$('play').onclick=play;

function render(){
  const s=row?.state||{};if(!row)return freshness();
  set('flyId',row.fly);set('version',s.version||'—');set('lesson',number(s.lesson));set('trials',number(s.trials));
  const bornAge=s.born?(Date.now()-Date.parse(s.born))/1000:null;set('age',bornAge!=null?ago(bornAge):'—');set('born',s.born?`born ${new Date(s.born).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}`:'born —');
  const mb=s.mb||{};set('dopa',`${number(mb.rewards)} / ${number(mb.punishments)}`);set('memory',valid(mb.depressed)?`${number(mb.depressed)}`:'—');set('memoryNote',`of ${number(mb.synapses)} KC→MBON depressed · mean gain ${valid(mb.mean_gain)?mb.mean_gain.toFixed(3):'—'} · half-life ${mb.half_life_h??'—'} h`);
  set('spikes',number(s.spikes_per_sec));set('kcNote',`sim time · ${number(s.kc)} KC · ${number(s.dn_spikes)} DNa01 spikes`);
  const le=s.last_exam;set('lastExam',le?`${le.heldout?.['.-']?.correct??'—'} / ${le.heldout?.['-.']?.correct??'—'}`:'—');
  set('phaseTag',s.phase?`${s.phase} · lesson ${s.lesson}`:'—');set('life',s.period==='school'?'In school':s.period==='sleep'?'Night':'Free time');set('version',`${s.version||'—'} · year ${s.year||1}${s.inherited_from?` · from ${s.inherited_from}`:''}`);const hrs=Array.isArray(s.school_hours)?s.school_hours.map(([x,y])=>`${x%12||12}${x<12?'a':'p'}–${y%12||12}${y<12||y===24?'a':'p'}`).join(' & '):'';set('lessonNote',hrs?`school ${hrs} ET`:'since born');set('lifeNote',`${fedNote(s)} · ${number(s.meals)} meals · lifeline ${s.lifeline_at?ago((Date.now()-Date.parse(s.lifeline_at))/1000)+' ago':'—'}`);set('firedTotal',number(s.fired_total));
  if(!freshness())return; doing(s);
  if(row.at!==seenTick){seenTick=row.at;strips(s);
    if(atlas){const fired=Array.isArray(row.fired)?[...new Set(row.fired.filter(i=>Number.isInteger(i)&&i>=0&&i<atlas.n))]:[];set('firedCount',number(fired.length));updateSpikes(fired);}
    // puppet: mood from the verdict for a few seconds; a leg tap per DNa01 run, replayed 8x slower than simulated time
    const t=performance.now();mood=s.phase==='teach'?(s.correct?30:-20):0;moodUntil=t+4000;taps=[];
    if(Array.isArray(s.dn_active)){let prev=0;s.dn_active.forEach((on,i)=>{if(on&&!prev)taps.push(t+i*(s.bin_ms||10)*8);prev=on;});}
  }
}
function updateSpikes(indices){if(!spikeMesh)return;const a=spikeMesh.geometry.attributes.position.array;const limit=Math.min(indices.length,3000);for(let j=0;j<limit;j++)a.set(positions.subarray(indices[j]*3,indices[j]*3+3),j*3);spikeMesh.geometry.attributes.position.needsUpdate=true;spikeMesh.geometry.setDrawRange(0,limit);flashAt=performance.now();}
let polling=false;async function pollLive(){if(polling||document.hidden)return;polling=true;try{const rows=await readTable(`fly_live?select=fly,at,mode,state,fired&fly=eq.${FLY}`);if(rows[0])row=rows[0];lastReadOK=true;render();}catch(e){lastReadOK=false;freshness();}finally{polling=false;}}

async function pollCard(){try{
  const ex=await readTable(`fly_school?select=lesson,symbol,correct,at&fly=eq.${FLY}&phase=eq.exam&order=id.desc&limit=3000`);
  const by=new Map();for(const r of ex){const o=by.get(r.lesson)||{a:0,b:0,n:0,at:r.at};if(r.symbol==='.-')o.a+=r.correct?1:0;if(r.symbol==='-.')o.b+=r.correct?1:0;o.n++;by.set(r.lesson,o);}
  const lessons=[...by.keys()].sort((x,y)=>x-y),complete=lessons.filter(l=>by.get(l).n>=12);
  const totA=complete.reduce((n,l)=>n+by.get(l).a,0),totB=complete.reduce((n,l)=>n+by.get(l).b,0),trials=complete.length*6;
  set('totA',`${totA} / ${number(trials)}`);set('totB',`${totB} / ${number(trials)}`);set('exams',number(complete.length));
  let best=null;for(const l of complete){const o=by.get(l);if(!best||o.a+o.b>best.s)best={l,s:o.a+o.b,o};}
  set('best',best?`lesson ${best.l} · ${best.o.a}+${best.o.b} of 12`:'—');
  set('cardSummary',complete.length?`After ${complete.length} exam${complete.length===1?'':'s'}: ·– exact ${totA} of ${trials}, –· exact ${totB} of ${trials}. Lesson 0 is the baseline before any teaching.`:'No complete exam yet.');
  const show=complete.slice(-60);$('chart').replaceChildren(...show.map(l=>{const o=by.get(l),d=document.createElement('div');d.title=`lesson ${l}: ·– ${o.a}/6, –· ${o.b}/6`;const a=document.createElement('b'),b=document.createElement('b');a.className='a'+(o.a?'':' zero');b.className='b'+(o.b?'':' zero');a.style.height=`${Math.max(3,o.a/6*100)}%`;b.style.height=`${Math.max(3,o.b/6*100)}%`;d.append(a,b);return d;}));
  const key=document.createElement('div');key.className='card-key';key.innerHTML='<span><i style="background:var(--accent)"></i>·– of 6</span><span><i style="background:#e6a962"></i>–· of 6</span><span>last 60 lessons →</span>';$('chart').after(key);document.querySelectorAll('.card-key').forEach((k,i,all)=>{if(i<all.length-1)k.remove();});
  const tr=await readTable(`fly_school?select=correct&fly=eq.${FLY}&phase=eq.teach&order=id.desc&limit=240`);
  if(tr.length)set('prim',`${Math.round(tr.filter(r=>r.correct).length/tr.length*100)}% exact · last ${tr.length}`);
}catch(e){set('cardSummary','Report card unavailable · retrying');}}

async function pollFeed(){try{
  const data=await readTable(`fly_school?select=at,lesson,phase,epoch,symbol,decoded,correct,dopamine&fly=eq.${FLY}&order=id.desc&limit=12`);
  const items=data.map(a=>{const li=document.createElement('li'),time=document.createElement('time'),kind=document.createElement('b'),detail=document.createElement('span');time.textContent=clock(a.at);kind.textContent=a.phase;kind.className=a.phase;
    detail.innerHTML=['rest','free','sleep','meal'].includes(a.phase)?`${a.phase==='meal'?'meal':'silence'} → <em>${a.decoded?SYM[a.decoded]||a.decoded:'nothing'}</em>`:`L${a.lesson} · <em>${SYM[a.symbol]||a.symbol}</em> → <em>${a.decoded?SYM[a.decoded]||a.decoded:'∅'}</em> ${a.correct?'exact':'miss'}${a.dopamine?` · ${a.dopamine>0?'+1':'−1'}`:' · cold'}`;
    li.append(time,kind,detail);return li;});
  if(!items.length){const li=document.createElement('li');li.className='empty';li.textContent='No trials in the log yet.';items.push(li);}
  $('feed').replaceChildren(...items);set('feedStatus','Last 12 · checked '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
}catch(e){set('feedStatus','Log unavailable · retrying');}}

function buildRoom(scene){
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(8,8),new THREE.MeshStandardMaterial({color:0x0f1a22,roughness:.95,metalness:0}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.237;floor.receiveShadow=true;scene.add(floor);
  const grid=new THREE.GridHelper(8,32,0x1e2f3c,0x16232d);grid.position.y=-1.236;scene.add(grid);
}
async function setup(){try{
  const viewport=$('viewport');renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor(0x080e16,0);viewport.append(renderer.domElement);scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(43,1,.1,50);
  const reset=()=>{camera.position.set(2.6,1.6,4.6);controls.target.set(-.2,-.3,0);controls.update();};controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=2.5;controls.maxDistance=10;controls.maxPolarAngle=Math.PI*.73;controls.autoRotate=autoOrbit;controls.autoRotateSpeed=.23;reset();$('resetView').onclick=reset;
  $('orbit').textContent=autoOrbit?'Pause orbit':'Start orbit';$('orbit').setAttribute('aria-pressed',String(autoOrbit));$('orbit').onclick=()=>{autoOrbit=!autoOrbit;controls.autoRotate=autoOrbit;$('orbit').textContent=autoOrbit?'Pause orbit':'Start orbit';$('orbit').setAttribute('aria-pressed',String(autoOrbit));};
  scene.add(new THREE.HemisphereLight(0xc3dfdd,0x101723,2));const light=new THREE.DirectionalLight(0xe7ebc9,3);light.position.set(2,5,4);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-3;light.shadow.camera.right=3;light.shadow.camera.top=3;light.shadow.camera.bottom=-3;light.shadow.bias=-.001;scene.add(light);
  buildRoom(scene);
  brain=new THREE.Group();brain.position.y=.32;scene.add(brain);
  new ResizeObserver(()=>{const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(viewport);
  loadMeasuredFly(scene).then(f=>{measuredFly=f;set('assetNote','Measured flybody anatomy (TuragaLab, Apache 2.0) · 160× display size · a posed puppet: wings on reward, grooming on punishment, a tap per DNa01 run. Not measured limb movement.');}).catch(e=>set('assetNote','Measured fly asset unavailable. Anatomy is not being shown.'));
  const [metaResponse,binaryResponse]=await Promise.all([fetch('/live-systems/flies/atlas.json'),fetch('/live-systems/flies/atlas.bin')]);if(!metaResponse.ok||!binaryResponse.ok)throw new Error('Measured atlas unavailable');
  atlas=await metaResponse.json();const buffer=await binaryResponse.arrayBuffer();if(buffer.byteLength!==atlas.n*6||atlas.region.length!==atlas.n)throw new Error('Atlas length mismatch');
  positions=new Float32Array(atlas.n*3);const bytes=new DataView(buffer),colors=new Float32Array(atlas.n*3);
  for(let i=0;i<positions.length;i++){const value=float16(bytes.getUint16(i*2,true));if(!Number.isFinite(value))throw new Error('Invalid atlas coordinate');positions[i]=(value-.5)*2.7;}
  for(let i=0;i<atlas.n;i++){const c=new THREE.Color(COLORS[atlas.region[i]]||COLORS[7]);colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  brain.add(new THREE.Points(geometry,new THREE.PointsMaterial({size:.012,vertexColors:true,transparent:true,opacity:.56,depthWrite:false,sizeAttenuation:true})));
  const spikes=new THREE.BufferGeometry();spikes.setAttribute('position',new THREE.BufferAttribute(new Float32Array(9000),3));spikes.setDrawRange(0,0);spikeMesh=new THREE.Points(spikes,new THREE.PointsMaterial({color:0xe7ffbe,size:.028,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));spikeMesh.frustumCulled=false;brain.add(spikeMesh);
  $('legend').replaceChildren(...atlas.regions.map((name,i)=>{const span=document.createElement('span'),dot=document.createElement('i');dot.style.background=COLORS[i];span.append(dot,document.createTextNode(name));return span;}));
  const kcCenter=new THREE.Vector3();let count=0;atlas.region.forEach((code,i)=>{if(atlas.regions[code]==='KC'){kcCenter.add(new THREE.Vector3().fromArray(positions,i*3));count++;}});if(count)kcCenter.divideScalar(count);
  set('atlasCount',`${number(atlas.n)} measured neuron positions`);set('flashNote','Drag to orbit · each trial flashes once');seenTick=null;render();
  let last=performance.now();function animate(t){requestAnimationFrame(animate);if(document.hidden)return;const dt=Math.min((t-last)/1000,.05);last=t;controls.update(dt);
    spikeMesh.material.opacity=state.fresh?Math.max(0,1-(t-flashAt)/2500):0;
    while(taps.length&&taps[0]<=t){pressedAt=taps.shift();}
    const v=state.fresh&&t<moodUntil?mood:0;measuredFly?.update(v,t-pressedAt,t,reducedMotion);
    const label=kcCenter.clone();brain.localToWorld(label);label.project(camera);const x=(label.x*.5+.5)*viewport.clientWidth,y=(-label.y*.5+.5)*viewport.clientHeight;const el=document.querySelector('.atlas-label');el.style.left=`${Math.max(12,Math.min(viewport.clientWidth-140,x+16))}px`;el.style.top=`${Math.max(65,Math.min(viewport.clientHeight-120,y-32))}px`;
    renderer.render(scene,camera);
  }requestAnimationFrame(animate);
}catch(e){$('sceneError').hidden=false;set('sceneError',`${e.message}. Live vitals remain available.`);}}
setup();pollLive();pollCard();pollFeed();setInterval(pollLive,2500);setInterval(pollFeed,8000);setInterval(pollCard,30000);setInterval(freshness,1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){pollLive();pollFeed();pollCard();}});
