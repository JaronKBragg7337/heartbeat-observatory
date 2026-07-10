import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUILD = 'v2f — continuous hero extrusion + piece-built world objects';
const app = document.querySelector('#app');

app.innerHTML = `
  <canvas id="world"></canvas>
  <section id="hud">
    <div class="topline">
      <h1>World Printer Lab <span style="color:#00ff9d">v2f</span></h1>
      <button id="toggleHud" class="secondary">Hide</button>
    </div>
    <div class="hud-body">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
        <a href="/" style="color:#00ff9d;text-decoration:none;font-weight:800">← Back to stable v1</a>
        <span class="pill">hero toolpath lab</span>
      </div>
      <p class="note"><b>${BUILD}</b>. Parts are measured before the object is moved to the bed, so nozzle paths and visible parts use the same coordinate space.</p>
      <div class="section-title">Speak / Type Object</div>
      <div class="row">
        <input id="commandInput" value="make a hero knot" aria-label="Object command" />
        <button id="runCommand">Print</button>
        <button id="voiceButton" class="secondary">🎙</button>
      </div>
      <div class="section-title">Printer Size</div>
      <div class="row" id="sizeButtons"></div>
      <div class="section-title">Object Recipes</div>
      <div class="row" id="recipeButtons"></div>
      <div class="section-title">Printer Bed Flow</div>
      <div class="row">
        <button id="pickupPrint" disabled>Pick Up Print</button>
        <button id="placeObject" disabled>Place</button>
        <button class="danger" id="cancelObject">Cancel/Delete</button>
      </div>
      <div class="section-title">Move / Rotate After Pickup</div>
      <div class="row">
        <button class="secondary" id="moveLeft">←</button>
        <button class="secondary" id="moveForward">↑</button>
        <button class="secondary" id="moveBack">↓</button>
        <button class="secondary" id="moveRight">→</button>
        <button class="secondary" id="rotateLeft">Rot −</button>
        <button class="secondary" id="rotateRight">Rot +</button>
        <button class="secondary" id="raiseUp">Up ⤒</button>
        <button class="secondary" id="lowerDown">Down ⤓</button>
        <button class="secondary" id="magnetToggle">🧲 On</button>
      </div>
      <div class="section-title">View &amp; Walk</div>
      <div class="row" id="viewButtons"></div>
      <div class="section-title">State</div>
      <div class="row">
        <span class="pill" id="statePill">ready</span>
        <span class="pill">bed-local paths</span>
        <span class="pill">continuous extrusion</span>
        <span class="pill">variable print time</span>
      </div>
      <div id="status">Ready. Try Stall, Cottage, Boat, Tree, Cart, Spiral, Creature, or Campfire.</div>
      <div id="selected">Target: none</div>
    </div>
  </section>
  <aside id="help">v2f: print the Hero Knot to watch one deliberate curved toolpath cool from molten amber into solid layered polymer.</aside>
  <div id="joystick" style="position:fixed;left:22px;bottom:26px;width:118px;height:118px;border-radius:50%;background:rgba(0,255,157,0.06);border:1px solid rgba(0,255,157,0.35);touch-action:none;z-index:20;display:flex;align-items:center;justify-content:center;user-select:none">
    <div id="joyknob" style="width:50px;height:50px;border-radius:50%;background:rgba(0,255,157,0.5);pointer-events:none;transition:transform .05s"></div>
  </div>
`;

const $ = (q) => document.querySelector(q);
const canvas = $('#world');
const hud = $('#hud');
const toggleHud = $('#toggleHud');
const statusEl = $('#status');
const selectedEl = $('#selected');
const statePill = $('#statePill');
const commandInput = $('#commandInput');
const recipeButtons = $('#recipeButtons');
const runButton = $('#runCommand');
const pickupButton = $('#pickupPrint');
const placeButton = $('#placeObject');
const cancelButton = $('#cancelObject');
const voiceButton = $('#voiceButton');

if (window.innerWidth <= 720) {
  hud.classList.add('collapsed', 'mobile-start');
  toggleHud.textContent = 'Open';
}
toggleHud.addEventListener('click', () => {
  hud.classList.toggle('collapsed');
  hud.classList.remove('mobile-start');
  toggleHud.textContent = hud.classList.contains('collapsed') ? 'Open' : 'Hide';
});

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const setStatus = (t) => { statusEl.textContent = t; };
const setState = (t) => { statePill.textContent = t; };
const setTarget = (t) => { selectedEl.textContent = `Target: ${t}`; };

function layerTexture(base, line, size = 256) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0,0,size,size);
  for (let y=0; y<size; y++) {
    x.fillStyle = Math.floor(y/5)%2 ? line : base;
    x.fillRect(0,y,size,1);
  }
  for (let i=0;i<900;i++) {
    x.fillStyle = `rgba(255,255,255,${Math.random()*0.045})`;
    x.fillRect(Math.random()*size,Math.random()*size,1,1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2,2);
  return tex;
}
function grainTexture(base, line, size = 256) {
  const c = document.createElement('canvas');
  c.width=size; c.height=size;
  const x=c.getContext('2d');
  x.fillStyle=base; x.fillRect(0,0,size,size);
  x.globalAlpha=.32;
  for(let px=0;px<size;px+=2){
    const w=Math.sin(px*.08)*10+Math.sin(px*.021)*18;
    x.strokeStyle=px%12<6?line:base;
    x.beginPath(); x.moveTo(px,0); x.bezierCurveTo(px+w,70,px-w,180,px+w*.3,size); x.stroke();
  }
  x.globalAlpha=1;
  const tex=new THREE.CanvasTexture(c);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(2,2);
  return tex;
}

const tex = {
  green: layerTexture('#0ee798','#08b16f'),
  orange: layerTexture('#ff9738','#d7601f'),
  cream: layerTexture('#e6d9bd','#bfb494'),
  wood: grainTexture('#8b5a32','#5b331f')
};
const mat = {
  ground: new THREE.MeshStandardMaterial({ color: 0x12221e, roughness:.92, metalness:.02 }),
  bed: new THREE.MeshPhysicalMaterial({ color:0x003f32, roughness:.18, metalness:.12, clearcoat:.9, clearcoatRoughness:.16 }),
  bedGlass: new THREE.MeshPhysicalMaterial({ color:0x00ff9d, transparent:true, opacity:.28, roughness:.08, clearcoat:1 }),
  dark: new THREE.MeshStandardMaterial({ color:0x151c1a, roughness:.42, metalness:.8 }),
  metal: new THREE.MeshStandardMaterial({ color:0x9da8a3, roughness:.28, metalness:.82 }),
  rubber: new THREE.MeshStandardMaterial({ color:0x050706, roughness:.8, metalness:.01 }),
  green: new THREE.MeshStandardMaterial({ color:0x00e996, map:tex.green, roughness:.34, metalness:.02, emissive:0x003020 }),
  orange: new THREE.MeshStandardMaterial({ color:0xff8730, map:tex.orange, roughness:.36, metalness:.02, emissive:0x2a1000 }),
  cream: new THREE.MeshStandardMaterial({ color:0xe6d9bd, map:tex.cream, roughness:.42, metalness:.01 }),
  wood: new THREE.MeshStandardMaterial({ color:0x9a683b, map:tex.wood, roughness:.62, metalness:.02 }),
  darkWood: new THREE.MeshStandardMaterial({ color:0x4b2d1e, map:tex.wood, roughness:.68, metalness:.01 }),
  wall: new THREE.MeshStandardMaterial({ color:0xcab17b, map:tex.cream, roughness:.72, metalness:.01 }),
  roof: new THREE.MeshStandardMaterial({ color:0x943848, map:tex.orange, roughness:.48, metalness:.04 }),
  leaf: new THREE.MeshStandardMaterial({ color:0x43bf67, roughness:.72, metalness:0 }),
  leafDark: new THREE.MeshStandardMaterial({ color:0x236f46, roughness:.74, metalness:0 }),
  stone: new THREE.MeshStandardMaterial({ color:0x7c817b, roughness:.9, metalness:.04 }),
  glass: new THREE.MeshPhysicalMaterial({ color:0x9adfff, transparent:true, opacity:.62, roughness:.05, clearcoat:1, transmission:.2 }),
  flame: new THREE.MeshBasicMaterial({ color:0xff8a20 }),
  freshGreen: new THREE.MeshBasicMaterial({ color:0x45ffc6, transparent:true, opacity:.92, depthWrite:false }),
  freshOrange: new THREE.MeshBasicMaterial({ color:0xffb14d, transparent:true, opacity:.92, depthWrite:false }),
  hot: new THREE.MeshStandardMaterial({ color:0xffd39a, emissive:0xff5a12, emissiveIntensity:1.9, roughness:.5, metalness:0 }),
  warm: new THREE.MeshStandardMaterial({ color:0xffcaa0, emissive:0xd23c06, emissiveIntensity:0.85, roughness:.6, metalness:0 }),
  knot: new THREE.MeshPhysicalMaterial({ color:0x13d99a, map:tex.green, roughness:.3, metalness:.03, clearcoat:.38, clearcoatRoughness:.34, emissive:0x002e20, emissiveIntensity:.28 }),
  knotWarm: new THREE.MeshStandardMaterial({ color:0xff9b50, emissive:0xff4b12, emissiveIntensity:1.15, roughness:.42, metalness:0 }),
  knotHot: new THREE.MeshStandardMaterial({ color:0xffe0a8, emissive:0xff641c, emissiveIntensity:2.35, roughness:.34, metalness:0 }),
  ghost: new THREE.MeshBasicMaterial({ color:0x00ff9d, transparent:true, opacity:.34, wireframe:true, depthWrite:false }),
  select: new THREE.MeshBasicMaterial({ color:0xffd479, transparent:true, opacity:.86, wireframe:true, depthWrite:false }),
  player: new THREE.MeshStandardMaterial({ color:0x65a8ff, roughness:.38, metalness:.05 })
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071012);
scene.fog = new THREE.Fog(0x071012, 45, 170);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth/window.innerHeight, .1, 1000);
camera.position.set(14,9.2,15.6);
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0,2.1,-1.2);
controls.enableDamping = true;
controls.dampingFactor = .08;
controls.minDistance = 5;
controls.maxDistance = 120;
controls.maxPolarAngle = Math.PI*.49;
controls.update();

scene.add(new THREE.AmbientLight(0x5e6b66,.48));
const key = new THREE.DirectionalLight(0xffffff,1.65);
key.position.set(17,25,12); key.castShadow=true; key.shadow.mapSize.set(2048,2048);
key.shadow.camera.left=-50; key.shadow.camera.right=50; key.shadow.camera.top=50; key.shadow.camera.bottom=-50; scene.add(key);
const rim = new THREE.DirectionalLight(0x8ffff0,.48); rim.position.set(-12,9,-8); scene.add(rim);
scene.add(new THREE.HemisphereLight(0x9fc9ff,0x302310,.42));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(150,150), mat.ground);
ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
const grid = new THREE.GridHelper(150,150,0x00ff9d,0x33453f);
grid.material.transparent=true; grid.material.opacity=.2; grid.position.y=.012; scene.add(grid);
const water = new THREE.Mesh(new THREE.RingGeometry(34,40,128), new THREE.MeshPhysicalMaterial({ color:0x49c4dc, transparent:true, opacity:.34, roughness:.08, clearcoat:1 }));
water.rotation.x=-Math.PI/2; water.position.y=.018; scene.add(water);

function shadow(root){ root.traverse(c=>{ if(c.isMesh){ c.castShadow=true; c.receiveShadow=true; } }); return root; }
function cyl(radius,length,material,seg=24){ return new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,seg),material); }
function tube(points,radius,material,seg=48){ return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),seg,radius,10),material); }
function fadeMat(material,opacity){ const m=material.clone(); m.transparent=true; m.opacity=opacity; m.depthWrite=opacity>.65; return m; }
function archShape(w,h,a){ const s=new THREE.Shape(); s.moveTo(-w/2,0); s.lineTo(-w/2,h-a); s.quadraticCurveTo(-w/2,h,0,h); s.quadraticCurveTo(w/2,h,w/2,h-a); s.lineTo(w/2,0); s.lineTo(-w/2,0); return s; }
function extrude(shape,depth,material,bevel=.035){ const g=new THREE.ExtrudeGeometry(shape,{ depth, bevelEnabled:true, bevelSize:bevel, bevelThickness:bevel, bevelSegments:4 }); g.center(); return new THREE.Mesh(g,material); }
function label(text,color='#00ff9d'){
  const c=document.createElement('canvas'); c.width=640; c.height=150; const x=c.getContext('2d');
  x.fillStyle='rgba(0,0,0,.68)'; x.fillRect(0,0,c.width,c.height); x.strokeStyle=color; x.lineWidth=8; x.strokeRect(8,8,c.width-16,c.height-16);
  x.fillStyle='#eafff7'; x.font='bold 45px system-ui'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(text,c.width/2,c.height/2);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; const s=new THREE.Sprite(new THREE.SpriteMaterial({ map:t, transparent:true })); s.scale.set(3.8,.9,1); return s;
}

// ---------------------------------------------------------------------------
// SLICER — reusable "cut a shape into many small printable pieces" system.
// Granularity is what makes a print read as real (see the campfire's small
// stones). Big primitives get sliced down so the nozzle works through many
// small pieces bottom-up. Foundation for piece-built world objects.
// ---------------------------------------------------------------------------
function markPiece(m){ m.castShadow=false; m.receiveShadow=false; m.userData.piece=true; return m; }
// Fill a 1D span [-len/2, len/2] with brick segments of ~bw, optional half-brick
// stagger so seams alternate course to course (running bond). Returns [center,width].
function fillCourse(len, bw, stagger){
  const segs=[]; let x = stagger ? -len/2 - bw*0.5 : -len/2;
  while(x < len/2 - 1e-3){
    const x0=Math.max(-len/2, x), x1=Math.min(len/2, x+bw);
    if(x1-x0 > bw*0.28) segs.push([(x0+x1)/2, x1-x0]);
    x += bw;
  }
  return segs;
}
// Hollow brick shell for a box (w,h,d) centered at origin. Four walls of small
// bricks in running bond, slight jitter. Returns an array of meshes.
function brickShell(w,h,d,opts={}){
  const { unit=0.42, courseH=0.3, gap=0.035, thickness=0.15, material=mat.wall, material2=mat.cream, jitter=0.02 } = opts;
  const out=[];
  const nCourses=Math.max(2, Math.round(h/courseH)), ch=h/nCourses;
  const walls=[
    {along:'x', len:w, fixed:d/2},
    {along:'x', len:w, fixed:-d/2},
    {along:'z', len:d, fixed:w/2},
    {along:'z', len:d, fixed:-w/2},
  ];
  for(let c=0;c<nCourses;c++){
    const y=-h/2 + ch*(c+0.5), stagger=c%2===1;
    for(const wl of walls){
      const nB=Math.max(1, Math.round(wl.len/unit)), bw=wl.len/nB;
      for(const [pos,width] of fillCourse(wl.len, bw, stagger)){
        const jx=(Math.random()-.5)*jitter, jy=(Math.random()-.5)*jitter;
        const mtl=((c+Math.round(pos*3))%2)?material:material2;
        let geo, px, pz;
        if(wl.along==='x'){ geo=new THREE.BoxGeometry(width-gap, ch-gap, thickness); px=pos; pz=wl.fixed; }
        else { geo=new THREE.BoxGeometry(thickness, ch-gap, width-gap); px=wl.fixed; pz=pos; }
        const b=markPiece(new THREE.Mesh(geo, mtl));
        b.position.set(px+ (wl.along==='z'? jx*0.0:0), y+jy, pz);
        out.push(b);
      }
    }
  }
  return out;
}
// Curved barrel roof made ENTIRELY of small pieces (no giant deck — that read as
// the old "grow" illusion). Overlapping shingle tiles wrap all the way around the
// arc so there's no see-through, laid course-by-course from the eaves up like the
// bricks. Gable ends are filled with small pieces too. Arc in X-Y, length along Z;
// centered so the eave line sits at y 0. Reuses fillCourse() (the brick helper).
// Fill a w x h x d box with a running-bond brick grid (constant brick size, so
// bigger pieces = more small bricks). Reused for the snap-together building
// pieces below. Centered on x/z; sits from y 0 upward when placed via the recipe.
function brickPanel(w,h,d,opts={}){
  const { unit=0.42, courseH=0.3, gap=0.04, material=mat.wall, material2=mat.cream } = opts;
  const out=[];
  const nY=Math.max(1,Math.round(h/courseH)), ch=h/nY;
  const nZ=Math.max(1,Math.round(d/unit)), bd=d/nZ;
  for(let iy=0; iy<nY; iy++){
    const y=-h/2+ch*(iy+0.5), stagger=iy%2===1;
    for(let iz=0; iz<nZ; iz++){
      const z=-d/2+bd*(iz+0.5);
      for(const [xc,xw] of fillCourse(w, unit, stagger)){
        const b=markPiece(new THREE.Mesh(new THREE.BoxGeometry(Math.max(.06,xw-gap), ch-gap, Math.max(.06,bd-gap)), ((iy+iz+Math.round(xc*3))%2)?material:material2));
        b.position.set(xc, y, z);
        out.push(b);
      }
    }
  }
  return out;
}

// Curved barrel roof made of small CURVED tile pieces (each a slice of the
// cylinder wall) so they wrap flush — no steps, no gaps, all pieces. Angular
// slices span a=0..PI (both eaves covered) with a small overlap so seams never
// open; length sliced along Z. Centered so the eave line sits at y 0.
function barrelShingles(R,L,opts={}){
  const { tile=0.4, material=mat.roof, material2=mat.darkWood } = opts;
  const out=[];
  const nA=Math.max(9, Math.round(Math.PI*R/tile)), da=Math.PI/nA;
  const nL=Math.max(4, Math.round(L/tile)), tl=L/nL, ov=da*0.15;
  for(let i=0;i<nA;i++){
    const rr=R+(i%2)*0.02; // alternate courses sit slightly proud, like lapped shingles
    for(let j=0;j<nL;j++){
      const zc=-L/2 + tl*(j+0.5);
      const g=new THREE.CylinderGeometry(rr, rr, tl*1.08, 5, 1, true, i*da-ov, da+ov*2);
      const t=markPiece(new THREE.Mesh(g, (i+j)%2?material:material2));
      t.rotation.z=Math.PI/2; t.rotation.y=Math.PI/2; // barrel axis along Z, dome up
      t.position.z=zc;
      out.push(t);
    }
  }
  // Gable ends filled with small pieces (radial rings) so you can't see inside.
  for(const ez of [-L/2-0.02, L/2+0.02]){
    const nr=Math.max(2, Math.round(R/tile));
    for(let ri=0; ri<nr; ri++){
      const rr=R*(ri+0.5)/nr, nc=Math.max(3, Math.round(Math.PI*rr/tile));
      for(let ci=0; ci<nc; ci++){
        const a=Math.PI*(ci+0.5)/nc;
        const b=markPiece(new THREE.Mesh(new THREE.BoxGeometry(tile*1.05, tile*1.05, 0.08), material2));
        b.position.set(Math.cos(a)*rr, Math.sin(a)*rr, ez);
        out.push(b);
      }
    }
  }
  return out;
}

// Stepped block pyramid (hip roof) built from small blocks — same block language
// as the walls, so it prints clean and ordered with no curves or gaps. Footprint
// w x d shrinks toward a peak over `height`. Lower layers are hollow rings (just
// the visible perimeter) to keep the piece count low; the top layer is solid so
// the peak is capped. Centered on x/z; base at y 0. (Kept as the "castle-type"
// roof style for blocky buildings.)
function pyramidRoof(w,d,height,opts={}){
  const { block=0.4, material=mat.roof, material2=mat.darkWood } = opts;
  const out=[];
  const layers=Math.max(3, Math.round(height/(block*0.85))), lh=height/layers;
  for(let l=0; l<layers; l++){
    const t=l/layers;
    const lw=Math.max(block, w*(1-t*0.92)), ld=Math.max(block, d*(1-t*0.92));
    const y=lh*(l+0.5);
    const nx=Math.max(1, Math.round(lw/block)), nz=Math.max(1, Math.round(ld/block));
    const bw=lw/nx, bd=ld/nz, top=(l===layers-1);
    for(let ix=0; ix<nx; ix++) for(let iz=0; iz<nz; iz++){
      const edge = ix===0||ix===nx-1||iz===0||iz===nz-1;
      if(!top && !edge) continue; // hollow interior except the capping top layer
      const b=markPiece(new THREE.Mesh(new THREE.BoxGeometry(bw*0.94, lh*0.98, bd*0.94), ((ix+iz+l)%2)?material:material2));
      b.position.set(-lw/2+bw*(ix+0.5), y, -ld/2+bd*(iz+0.5));
      out.push(b);
    }
  }
  return out;
}

function createPrinter(){
  const g=new THREE.Group();
  const base=new THREE.Mesh(new THREE.BoxGeometry(6.6,.36,5.9),mat.dark); base.position.y=.18; g.add(base);
  const bed=new THREE.Mesh(new THREE.BoxGeometry(5.12,.12,4.5),mat.bed); bed.position.set(0,.44,.28); g.add(bed);
  const glass=new THREE.Mesh(new THREE.BoxGeometry(4.82,.045,4.18),mat.bedGlass); glass.position.set(0,.535,.28); g.add(glass);
  for(const x of [-2.6,2.6]) for(const z of [-2.1,2.1]){ const p=cyl(.11,6.35,mat.metal,24); p.position.set(x,3.28,z); g.add(p); const cap=new THREE.Mesh(new THREE.SphereGeometry(.16,18,12),mat.green); cap.position.set(x,6.48,z); g.add(cap); }
  const gantry=new THREE.Group(); gantry.position.set(0,5.55,.25); gantry.add(new THREE.Mesh(new THREE.BoxGeometry(5.85,.3,.45),mat.dark));
  for(const z of [-.23,.23]){ const r=cyl(.055,5.7,mat.metal,20); r.rotation.z=Math.PI/2; r.position.set(0,-.22,z); gantry.add(r); }
  g.add(gantry);
  const carriage=new THREE.Group(); carriage.position.set(0,5.1,.25); carriage.add(new THREE.Mesh(new THREE.BoxGeometry(.95,.72,.86),mat.green));
  const fan=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,.09,32),mat.dark); fan.rotation.x=Math.PI/2; fan.position.set(0,.05,.49); carriage.add(fan);
  for(let i=0;i<6;i++){ const fin=new THREE.Mesh(new THREE.BoxGeometry(.5,.033,.35),mat.metal); fin.position.set(0,-.25-i*.07,0); carriage.add(fin); }
  const block=new THREE.Mesh(new THREE.BoxGeometry(.38,.22,.38),mat.metal); block.position.y=-.72; carriage.add(block);
  const nozzle=new THREE.Mesh(new THREE.ConeGeometry(.18,.55,30),mat.dark); nozzle.position.y=-1.1; nozzle.rotation.x=Math.PI; carriage.add(nozzle);
  const led=new THREE.PointLight(0x00ff9d,1.8,5); led.position.set(0,-.92,.1); carriage.add(led);
  carriage.add(tube([new THREE.Vector3(-.28,.36,-.3),new THREE.Vector3(-1.1,1,-.65),new THREE.Vector3(-1.8,.25,-1.45)],.035,mat.metal,40));
  g.add(carriage);
  const spool=new THREE.Group(); const spoolBody=cyl(.44,.34,mat.green,40); spoolBody.rotation.z=Math.PI/2; spool.add(spoolBody);
  for(const x of [-.2,.2]){ const r=new THREE.Mesh(new THREE.TorusGeometry(.5,.035,10,40),mat.dark); r.rotation.y=Math.PI/2; r.position.x=x; spool.add(r); }
  spool.position.set(2.95,5.95,-1.72); g.add(spool);
  g.add(tube([new THREE.Vector3(2.9,5.95,-1.72),new THREE.Vector3(1.4,6.45,-1.2),new THREE.Vector3(.1,5.65,-.35)],.026,mat.freshGreen,44));
  const sign=label('WORLD PRINTER v2f'); sign.position.set(0,6.52,-2.22); g.add(sign);
  g.userData={ carriage, gantry, spool, nozzleTipLocal:new THREE.Vector3(0,-1.13,0), idle:carriage.position.clone(), idleGantry:gantry.position.clone() };
  return shadow(g);
}
const printer=createPrinter(); printer.position.set(0,0,-5.5); scene.add(printer);
function bedWorld(local=new THREE.Vector3(0,0,0)){ return printer.localToWorld(new THREE.Vector3(local.x,.56+local.y,.28+local.z)); }
function nozzleWorld(){ return printer.userData.carriage.localToWorld(printer.userData.nozzleTipLocal.clone()); }

function createPlayer(){ const g=new THREE.Group(); const body=new THREE.Mesh(new THREE.CapsuleGeometry(.32,.78,8,16),mat.player); body.position.y=.82; g.add(body); const ring=new THREE.Mesh(new THREE.TorusGeometry(.68,.025,8,44),fadeMat(mat.green,.58)); ring.rotation.x=Math.PI/2; ring.position.y=.08; g.add(ring); const l=label('PLAYER'); l.scale.set(1.7,.42,1); l.position.y=1.85; g.add(l); return shadow(g); }
const player=createPlayer(); player.position.set(0,0,5.25); scene.add(player);
const handWorld=()=>player.localToWorld(new THREE.Vector3(0,1.55,0));

function createStall(s=1){ const g=new THREE.Group(); g.name='Market Stall';
  // Counter: sliced wood planks.
  for(const b of brickPanel(2.45*s,.58*s,1.08*s,{unit:.4,courseH:.2,material:mat.wood,material2:mat.darkWood})){ b.position.y+=.38*s; g.add(b); }
  // Corner posts (thin — kept whole).
  for(const x of [-1.05*s,1.05*s]) for(const z of [-.42*s,.42*s]){ const p=markPiece(cyl(.06*s,2.1*s,mat.darkWood,14)); p.position.set(x,1.35*s,z); g.add(p); }
  // Canopy: sliced curved tiles (same idea as the cottage roof).
  for(const t of barrelShingles(.82*s,2.65*s,{tile:.34,material:mat.roof,material2:mat.darkWood})){ t.position.y+=2.3*s; g.add(t); }
  return g;
}
function createCottage(s=1){
  const g=new THREE.Group(); g.name='Cottage';
  // Dimensions scale with s, but the brick/tile size stays CONSTANT — a bigger
  // cottage is made of MORE small pieces, not bigger ones.
  for(const b of brickShell(2.8*s,1.85*s,2.25*s,{unit:.44,courseH:.3,material:mat.wall,material2:mat.cream})){ b.position.y+=.925*s; g.add(b); }
  for(const t of barrelShingles(1.42*s,2.65*s,{tile:.4})){ t.position.y+=1.75*s; g.add(t); }
  const door=extrude(archShape(.62*s,1.05*s,.38*s),.08*s,mat.darkWood); door.position.set(0,.5*s,1.17*s); g.add(door);
  for(const x of [-.78*s,.78*s]){ const w=new THREE.Mesh(new THREE.CylinderGeometry(.22*s,.22*s,.08*s,32),mat.glass); w.rotation.x=Math.PI/2; w.position.set(x,1.15*s,1.18*s); g.add(w); }
  return g;
}
// --- Snap-together building pieces (print one, snap it to others) -----------
function pieceGroup(name, w,h,d, opts){ const g=new THREE.Group(); g.name=name; for(const b of brickPanel(w,h,d,opts)){ b.position.y+=h/2; g.add(b); } return g; }
function createBlock(s=1){ return pieceGroup('Block', 1*s,1*s,1*s); }
function createWall(s=1){ return pieceGroup('Wall', 2*s,2*s,0.4*s); }
function createFloor(s=1){ return pieceGroup('Floor', 2*s,0.35*s,2*s); }
function createPillar(s=1){ return pieceGroup('Pillar', 0.6*s,2*s,0.6*s,{unit:0.3}); }

function createBoat(s=1){ const g=new THREE.Group(); g.name='Boat';
  // Planked hull: stacked elliptical rings of small planks (narrow at the keel).
  const rows=5;
  for(let r=0;r<rows;r++){ const ry=r/(rows-1), y=(.2+ry*.55)*s, sc=.5+ry*.5, hl=1.5*sc*s, hw=.62*sc*s, nP=Math.max(8,Math.round(20*sc));
    for(let i=0;i<nP;i++){ const a=i/nP*Math.PI*2, x=Math.cos(a)*hl, z=Math.sin(a)*hw;
      const plank=markPiece(new THREE.Mesh(new THREE.BoxGeometry(.3*s,.16*s,.13*s), (r+i)%2?mat.wood:mat.darkWood));
      plank.position.set(x,y,z); plank.rotation.y=-a; g.add(plank);
    }
  }
  // Bench seats (from the v3 boat).
  for(const bx of [-.55*s,.5*s]){ for(const b of brickPanel(.28*s,.12*s,1.0*s,{unit:.3,courseH:.12,material:mat.wood,material2:mat.darkWood})){ b.position.x+=bx; b.position.y+=.72*s; g.add(b);} }
  // Mast: stacked segments.
  for(let i=0;i<7;i++){ const seg=markPiece(new THREE.Mesh(new THREE.CylinderGeometry(.04*s,.045*s,.26*s,8),mat.darkWood)); seg.position.set(.12*s,(.9+i*.26)*s,0); g.add(seg); }
  // Sail: small cloth pieces.
  for(let iy=0;iy<4;iy++) for(let ix=0;ix<3;ix++){ const sp=markPiece(new THREE.Mesh(new THREE.BoxGeometry(.03*s,.28*s,.24*s),mat.cream)); sp.position.set(.14*s,(1.15+iy*.28)*s,(.18+ix*.22)*s); g.add(sp); }
  return g;
}
function createTree(s=1){ const g=new THREE.Group(); g.name='Tree';
  // Trunk: short bark segments stacked up (builds bottom-up — the trunk grows first).
  const H=2.2*s, seg=0.26*s, n=Math.max(5,Math.round(H/seg));
  for(let i=0;i<n;i++){ const t=i/n, y=seg*(i+0.5), r=(0.17-0.06*t)*s;
    const bx=Math.sin(t*2.0)*0.16*s, bz=Math.cos(t*1.4)*0.05*s;
    const b=markPiece(new THREE.Mesh(new THREE.CylinderGeometry(r,r*1.1,seg*0.98,8), i%2?mat.wood:mat.darkWood));
    b.position.set(bx,y,bz); g.add(b);
  }
  // Canopy: many small leaf clusters on a deterministic (fibonacci) dome — they
  // reveal after the trunk (higher up), so leaves appear once the trunk is there.
  const topY=H*0.9, R=1.0*s, leaves=Math.max(18,Math.round(26*s));
  for(let i=0;i<leaves;i++){ const t=(i+0.5)/leaves, phi=Math.acos(1-1.7*t), theta=i*2.39996;
    const rr=R*(0.62+0.32*(((i*7)%5)/5));
    const lx=Math.cos(theta)*Math.sin(phi)*rr, ly=Math.cos(phi)*rr*0.8, lz=Math.sin(theta)*Math.sin(phi)*rr;
    const size=(0.22+0.13*(((i*3)%4)/4))*s;
    const leaf=markPiece(new THREE.Mesh(new THREE.DodecahedronGeometry(size,0), (i%3)?mat.leaf:mat.leafDark));
    leaf.position.set(lx, topY+ly, lz); leaf.scale.y=0.85; g.add(leaf);
  }
  return g;
}
function createCart(s=1){ const g=new THREE.Group(); g.name='Cart';
  // Bed: sliced wood planks.
  for(const b of brickPanel(2.2*s,.38*s,1.05*s,{unit:.4,courseH:.19,material:mat.wood,material2:mat.darkWood})){ b.position.y+=.7*s; g.add(b); }
  // Sides: sliced plank rails.
  for(const zc of [-.6*s,.6*s]){ for(const b of brickPanel(2.35*s,.62*s,.1*s,{unit:.4,courseH:.2,material:mat.darkWood,material2:mat.wood})){ b.position.y+=1*s; b.position.z+=zc; g.add(b); } }
  // Wheels (round — kept whole).
  for(const x of [-.78*s,.78*s]) for(const z of [-.72*s,.72*s]){ const w=markPiece(new THREE.Mesh(new THREE.CylinderGeometry(.3*s,.3*s,.16*s,32),mat.darkWood)); w.rotation.x=Math.PI/2; w.position.set(x,.32*s,z); g.add(w); }
  // Handle (from the v3 cart).
  const handle=markPiece(cyl(.05*s,1.35*s,mat.darkWood,12)); handle.position.set(1.55*s,1.05*s,0); handle.rotation.z=Math.PI*0.33; g.add(handle);
  return g;
}
function createCampfire(){ const g=new THREE.Group(); g.name='Campfire'; for(let i=0;i<8;i++){ const a=i/8*Math.PI*2; const s=new THREE.Mesh(new THREE.DodecahedronGeometry(.16,0),mat.stone); s.position.set(Math.cos(a)*.5,.14,Math.sin(a)*.5); g.add(s); } for(const a of [0,Math.PI/2]){ const log=cyl(.08,1,mat.wood,12); log.rotation.z=Math.PI/2; log.rotation.y=a; log.position.y=.22; g.add(log); } const f=new THREE.Mesh(new THREE.ConeGeometry(.3,.75,12),mat.flame); f.position.y=.6; g.add(f); const light=new THREE.PointLight(0xff8a20,1.4,6); light.position.y=1.1; g.add(light); return shadow(g); }
function knotPoint(t,s=1){
  // Trefoil centreline. Its lowest sweep kisses the bed while the broad X/Z
  // footprint and over-under crossings make the finished silhouette read clearly.
  const a=t*Math.PI*2, radial=1.38+.46*Math.cos(3*a);
  return new THREE.Vector3(Math.cos(2*a)*radial*.78*s, (.63+.55*Math.sin(3*a))*s, Math.sin(2*a)*radial*.62*s);
}
function createHeroKnot(s=1){
  const g=new THREE.Group(); g.name='Hero Knot';
  const count=Math.max(132,Math.round(176*s)), radius=.092*Math.max(.72,s);
  const points=[];
  for(let i=0;i<=count;i++) points.push(knotPoint(i/count,s));
  for(let i=0;i<count;i++){
    const curve=new THREE.LineCurve3(points[i],points[i+1]);
    const stroke=markPiece(new THREE.Mesh(new THREE.TubeGeometry(curve,2,radius,10,false),mat.knot));
    stroke.userData.pathIndex=i; stroke.userData.pathPoint=points[i].clone(); g.add(stroke);
  }
  g.userData.heroPath=points;
  return g;
}
function createSpiral(s=1){ return createHeroKnot(s); }
function createCreature(s=1){ const g=new THREE.Group(); g.name='Creature';
  // Body: cluster of small blobs (fibonacci dome) that build up piece by piece.
  const nB=Math.max(22,Math.round(30*s)), R=.6*s;
  for(let i=0;i<nB;i++){ const t=(i+.5)/nB, phi=Math.acos(1-2*t), theta=i*2.39996, rr=R*(.72+.28*(((i*5)%4)/4));
    const b=markPiece(new THREE.Mesh(new THREE.DodecahedronGeometry(.17*s,0), i%3?mat.orange:mat.roof));
    b.position.set(Math.cos(theta)*Math.sin(phi)*rr, .82*s+Math.cos(phi)*rr*.85, Math.sin(theta)*Math.sin(phi)*rr); g.add(b);
  }
  for(const x of [-.28*s,.28*s]){ const eye=markPiece(new THREE.Mesh(new THREE.SphereGeometry(.14*s,16,10),mat.glass)); eye.position.set(x,.98*s,.57*s); g.add(eye); }
  // Legs: bead segments.
  for(let i=0;i<6;i++){ const a=i/6*Math.PI*2; for(let k=0;k<3;k++){ const kt=k/3; const leg=markPiece(new THREE.Mesh(new THREE.SphereGeometry(.06*s,6,5),mat.green)); leg.position.set(Math.cos(a)*(.4+kt*.55)*s,(.5-kt*.34)*s,Math.sin(a)*(.4+kt*.55)*s); g.add(leg);} }
  return g;
}

const recipes=[
  {id:'block',label:'Block',aliases:['block','cube'],dims:[1,1,1],complexity:.6,create:createBlock,sized:true},
  {id:'wall',label:'Wall',aliases:['wall'],dims:[2,2,0.4],complexity:.85,create:createWall,sized:true},
  {id:'floor',label:'Floor',aliases:['floor','tile','ground','slab'],dims:[2,0.35,2],complexity:.75,create:createFloor,sized:true},
  {id:'pillar',label:'Pillar',aliases:['pillar','column','post'],dims:[0.6,2,0.6],complexity:.6,create:createPillar,sized:true},
  {id:'stall',label:'Market Stall',aliases:['market','stall','shop','vendor'],dims:[2.65,1.3,2.7],complexity:1.25,create:createStall,sized:true},
  {id:'cottage',label:'Cottage',aliases:['cottage','house','home','hut'],dims:[2.8,2.25,2.5],complexity:1.18,create:createCottage,sized:true},
  {id:'boat',label:'Boat',aliases:['boat','ship','sailboat'],dims:[3.1,1.3,2.0],complexity:1.05,create:createBoat,sized:true},
  {id:'tree',label:'Tree',aliases:['tree','forest','oak'],dims:[2.0,2.0,2.9],complexity:1.12,create:createTree,sized:true},
  {id:'cart',label:'Cart',aliases:['cart','wagon','carriage'],dims:[2.4,1.5,1.5],complexity:.9,create:createCart,sized:true},
  {id:'spiral',label:'Hero Knot',aliases:['spiral','twist','knot','hero'],dims:[2.9,2.3,1.2],complexity:1.35,create:createSpiral,sized:true,hero:true},
  {id:'creature',label:'Creature',aliases:['creature','robot','monster','eyeball','character'],dims:[1.9,1.9,1.5],complexity:1.4,create:createCreature,sized:true},
  {id:'campfire',label:'Campfire',aliases:['campfire','fire','firepit'],dims:[1.1,1.1,1.0],complexity:.55,create:createCampfire}
];

// Printer sizes: small (tiny props) / medium (current) / large (buildings).
const SIZES={ small:0.55, medium:1, large:1.8 };
const SIZE_LABELS={ small:'Small', medium:'Medium', large:'Large' };
let printSize='medium';
// Bake a uniform scale into an object's geometry (not group scale, which the print
// reveal resets). Used for non-parametrised recipes so they can be sized too.
function bakeScale(root,s){ if(s===1) return root; root.traverse(m=>{ if(m.isMesh){ m.geometry.scale(s,s,s); m.position.multiplyScalar(s); } }); return root; }
// Build a recipe at a given size. The cottage builds bigger with the SAME small
// pieces; other recipes bake the scale into their geometry.
function buildAtSize(recipe,s){ return recipe.sized ? recipe.create(s) : bakeScale(recipe.create(), s); }

let phase='ready', printedOnBed=null, carriedPreview=null, selected=null, selectionBox=null, pathGroup=null, liveBead=null, liveThread=null, idCounter=0, slotIndex=0;
const placed=[]; const slots=[[0,2.7],[-4,2.4],[4,2.4],[-4,6],[4,6],[0,7.2],[-7,0],[7,0]];
function parseCommand(text){ const t=text.toLowerCase().replace(/[^a-z0-9\s-]/g,' '); return recipes.find(r=>r.aliases.some(a=>t.includes(a))) || null; }
function printDuration(recipe,parts){ const [w,d,h]=recipe.dims; const base=3000+w*d*h*90, per=parts.length*48; return Math.round(Math.min(13500, base+per)*(0.9+recipe.complexity*0.1)); }
function setButtons(){ const busy=phase==='printing'||phase==='pickup-moving'; runButton.disabled=busy||phase==='printed-on-bed'; pickupButton.disabled=phase!=='printed-on-bed'; placeButton.disabled=phase!=='carried-preview'; recipeButtons.querySelectorAll('button').forEach(b=>{b.disabled=busy||phase==='printed-on-bed'}); }
function setPhase(next){ phase=next; setState(next); setButtons(); }

function collectPartsLocal(root){
  root.position.set(0,0,0); root.rotation.set(0,0,0); root.scale.set(1,1,1); root.updateMatrixWorld(true);
  const parts=[];
  root.traverse((m)=>{
    if(!m.isMesh) return;
    m.userData.baseMaterial=m.material;
    m.userData.baseScale=m.scale.clone();
    m.userData.basePosition=m.position.clone();
    m.geometry.computeBoundingBox();
    const box=m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
    const size=new THREE.Vector3(); box.getSize(size);
    if(size.x<.001||size.y<.001||size.z<.001) return;
    parts.push({mesh:m,box,size,minY:box.min.y,weight:Math.max(.12,size.x*size.y*size.z)});
    m.visible=false;
  });
  // Print order: bottom-up in layers, and WITHIN each layer sweep around the
  // object's centre (not scattered) so bricks lay in a deliberate sequence.
  let cx=0,cz=0; for(const p of parts){ cx+=(p.box.min.x+p.box.max.x)/2; cz+=(p.box.min.z+p.box.max.z)/2; }
  const n=parts.length||1; cx/=n; cz/=n;
  const band=0.16;
  for(const p of parts){ p.layer=Math.round(p.minY/band); const mx=(p.box.min.x+p.box.max.x)/2, mz=(p.box.min.z+p.box.max.z)/2; p.ang=Math.atan2(mz-cz,mx-cx); }
  parts.sort((a,b)=> (a.layer-b.layer) || (a.ang-b.ang) || (a.minY-b.minY));
  return parts;
}
function revealPart(part,fraction){
  const m=part.mesh; fraction=clamp01(fraction);
  m.visible=fraction>.02;
  if(!m.visible) return;
  // Fresh piece glows hot (molten) while depositing, then sits at its solid colour.
  m.material = fraction<1 ? mat.hot : m.userData.baseMaterial;
  m.position.copy(m.userData.basePosition);
  if(fraction>=1){ m.scale.copy(m.userData.baseScale); return; }
  const bs=m.userData.baseScale;
  const big = part.size.y>0.5 && Math.abs(m.rotation.x)<.2 && Math.abs(m.rotation.z)<.2;
  if(big){
    // Large un-sliced piece: build up from the bed (grow height + rise into place).
    m.scale.set(bs.x, bs.y*Math.max(.06,fraction), bs.z);
    m.position.y = m.userData.basePosition.y - part.size.y*(1-fraction)*.5;
  } else {
    // Small piece (sliced brick/tile/stone): quick solid deposit pop.
    const grow=0.5+0.5*Math.min(1,fraction/0.7);
    m.scale.set(bs.x*grow, bs.y*grow, bs.z*grow);
  }
}
function revealParts(parts,activeIndex,localT){ const COOL=6; parts.forEach((p,i)=>{ if(i<activeIndex){ revealPart(p,1); const age=activeIndex-i; if(age<=COOL) p.mesh.material=(age<=2?mat.hot:mat.warm); } else if(i===activeIndex) revealPart(p,localT); else p.mesh.visible=false; }); }
function restoreFinal(root){ root.traverse(m=>{ if(m.isMesh){ m.visible=true; if(m.userData.baseMaterial)m.material=m.userData.baseMaterial; if(m.userData.baseScale)m.scale.copy(m.userData.baseScale); if(m.userData.basePosition)m.position.copy(m.userData.basePosition); } }); }
function setGhost(root,on){ root.traverse(m=>{ if(!m.isMesh)return; m.userData.finalMaterial ||= m.material; m.material=on?mat.ghost:m.userData.finalMaterial; }); }

function partPath(part,localT){
  const b=part.box, s=part.size;
  const cx=(b.min.x+b.max.x)/2, cz=(b.min.z+b.max.z)/2;
  const w=Math.max(s.x*.55,.08), d=Math.max(s.z*.55,.08);
  const y=b.min.y+s.y*clamp01(localT);
  if(s.x<.28 && s.z<.28 && s.y>.6){ const a=localT*Math.PI*20, r=Math.max(s.x,s.z)*.8; return new THREE.Vector3(cx+Math.cos(a)*r,y,cz+Math.sin(a)*r); }
  if(s.x>s.z*2.2){ const u=Math.sin(localT*Math.PI*16)*.5+.5; return new THREE.Vector3(b.min.x+u*s.x,y,cz+Math.sin(localT*Math.PI*40)*d*.22); }
  if(s.z>s.x*2.2){ const u=Math.sin(localT*Math.PI*16)*.5+.5; return new THREE.Vector3(cx+Math.sin(localT*Math.PI*40)*w*.22,y,b.min.z+u*s.z); }
  if(s.x/Math.max(s.z,.01)<1.45 && s.z/Math.max(s.x,.01)<1.45){ const a=localT*Math.PI*18, r=Math.min(w,d)*(.55+.35*Math.sin(localT*Math.PI*6)); return new THREE.Vector3(cx+Math.cos(a)*r,y,cz+Math.sin(a)*r); }
  const loop=(localT*10)%5;
  if(loop<1)return new THREE.Vector3(cx-w+loop*2*w,y,cz-d);
  if(loop<2)return new THREE.Vector3(cx+w,y,cz-d+(loop-1)*2*d);
  if(loop<3)return new THREE.Vector3(cx+w-(loop-2)*2*w,y,cz+d);
  if(loop<4)return new THREE.Vector3(cx-w,y,cz+d-(loop-3)*2*d);
  return new THREE.Vector3(cx-w+(loop-4)*2*w,y,cz+Math.sin(localT*Math.PI*48)*d*.45);
}
function carriageFromLocal(p){ return new THREE.Vector3(p.x,1.17+p.y,.28+p.z); }
function segment(a,b,material,r=.024){ if(a.distanceTo(b)<.012)return null; return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a,b]),5,r,8),material); }
function drip(a,b){ const mid=a.clone().lerp(b,.5), len=a.distanceTo(b); const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,Math.max(.05,len),8),mat.freshGreen); mesh.position.copy(mid); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()); return mesh; }

function clearSelection(){ if(selectionBox){ scene.remove(selectionBox); selectionBox.geometry.dispose(); selectionBox.material.dispose(); selectionBox=null; } selected=null; setTarget(carriedPreview?`preview ${carriedPreview.userData.label}`:printedOnBed?`${printedOnBed.userData.label} on printer bed`:'none'); }
function selectPlaced(obj){ clearSelection(); selected=obj; const box=new THREE.Box3().setFromObject(obj), size=new THREE.Vector3(), center=new THREE.Vector3(); box.getSize(size); box.getCenter(center); selectionBox=new THREE.Mesh(new THREE.BoxGeometry(size.x+.18,size.y+.18,size.z+.18),mat.select); selectionBox.position.copy(center); scene.add(selectionBox); setTarget(`${obj.userData.label} #${obj.userData.id}`); }
function updateSelectionBox(){ if(!selectionBox||!selected)return; const box=new THREE.Box3().setFromObject(selected), center=new THREE.Vector3(); box.getCenter(center); selectionBox.position.copy(center); selectionBox.rotation.copy(selected.rotation); }
function movable(){ return carriedPreview||selected; }
// Edge-magnet snapping: when the moving object is within MAG of a placed object,
// snap its nearest face flush against that neighbour (butt-join or stack on top),
// so pieces align edge-to-edge without overlapping. Falls back to the grid when
// nothing is close. Works with rotation/size (uses world-space bounding boxes).
let magnetOn=true;
function magnetSnap(obj){
  if(!obj||!magnetOn) return;
  const box=new THREE.Box3().setFromObject(obj), size=new THREE.Vector3(), c=new THREE.Vector3();
  box.getSize(size); box.getCenter(c);
  const hx=size.x/2, hy=size.y/2, hz=size.z/2, MAG=0.85; let best=null;
  for(const p of placed){ if(p===obj) continue; const pb=new THREE.Box3().setFromObject(p);
    const ox=Math.min(box.max.x,pb.max.x)-Math.max(box.min.x,pb.min.x);
    const oy=Math.min(box.max.y,pb.max.y)-Math.max(box.min.y,pb.min.y);
    const oz=Math.min(box.max.z,pb.max.z)-Math.max(box.min.z,pb.min.z);
    if(oy>-0.1&&oz>-0.1) for(const t of [pb.max.x+hx,pb.min.x-hx]){ const d=Math.abs(t-c.x); if(d<MAG&&(!best||d<best.d)) best={ax:'x',val:t,d}; }
    if(ox>-0.1&&oz>-0.1) for(const t of [pb.max.y+hy,pb.min.y-hy]){ const d=Math.abs(t-c.y); if(d<MAG&&(!best||d<best.d)) best={ax:'y',val:t,d}; }
    if(ox>-0.1&&oy>-0.1) for(const t of [pb.max.z+hz,pb.min.z-hz]){ const d=Math.abs(t-c.z); if(d<MAG&&(!best||d<best.d)) best={ax:'z',val:t,d}; }
  }
  if(best){ if(best.ax==='x') obj.position.x+=best.val-c.x; else if(best.ax==='y') obj.position.y=Math.max(0,obj.position.y+(best.val-c.y)); else obj.position.z+=best.val-c.z; }
}
function moveTarget(dx,dz){ const o=movable(); if(!o){setStatus('Nothing can move yet. Print, pick up, then move the preview.');return;} o.position.x=Math.round(o.position.x+dx); o.position.z=Math.round(o.position.z+dz); magnetSnap(o); updateSelectionBox(); if(o.userData.dbId) updatePlacement(o); }
function rotateTarget(dir){ const o=movable(); if(!o){setStatus('Nothing can rotate yet. Print, pick up, then rotate the preview.');return;} o.rotation.y+=dir*Math.PI/8; magnetSnap(o); updateSelectionBox(); if(o.userData.dbId) updatePlacement(o); }
function raiseTarget(dy){ const o=movable(); if(!o){setStatus('Nothing to raise yet. Print, pick up, then raise/lower to stack.');return;} o.position.y=Math.max(0, Math.round((o.position.y+dy)/0.5)*0.5); magnetSnap(o); updateSelectionBox(); if(o.userData.dbId) updatePlacement(o); }
async function animateTransform(object,targetPosition,targetScale,duration){ const sPos=object.position.clone(), sScale=object.scale.clone(), eScale=new THREE.Vector3(targetScale,targetScale,targetScale), t0=performance.now(); return new Promise(resolve=>{ function step(now){ const t=clamp01((now-t0)/duration); const e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2; object.position.lerpVectors(sPos,targetPosition,e); object.scale.lerpVectors(sScale,eScale,e); if(t<1)requestAnimationFrame(step); else resolve(); } requestAnimationFrame(step); }); }

function moveMachineTo(localPoint,duration=700){
  const carriage=printer.userData.carriage, gantry=printer.userData.gantry;
  const fromC=carriage.position.clone(), toC=carriageFromLocal(localPoint);
  const fromG=gantry.position.y, toG=5.15+localPoint.y*.2, t0=performance.now();
  return new Promise(resolve=>{ function step(now){ const t=clamp01((now-t0)/duration), e=t*t*(3-2*t); carriage.position.lerpVectors(fromC,toC,e); gantry.position.y=THREE.MathUtils.lerp(fromG,toG,e); if(t<1)requestAnimationFrame(step); else resolve(); } requestAnimationFrame(step); });
}

async function startHeroPrint(recipe){
  const obj=buildAtSize(recipe,SIZES[printSize]);
  const path=obj.userData.heroPath;
  obj.userData={label:recipe.label,recipeId:recipe.id,state:'printing',sizeScale:SIZES[printSize]};
  obj.position.copy(bedWorld()); scene.add(obj); printedOnBed=obj;
  const strokes=[...obj.children];
  for(const stroke of strokes){ stroke.visible=false; stroke.userData.baseMaterial=mat.knot; }
  if(viewMode==='orbit'){
    camera.position.set(0,4.45,2.3); controls.target.set(0,1.55,-5.25); controls.update();
  }
  setStatus('Travel move to the Hero Knot start point — extrusion is off.');
  await moveMachineTo(path[0],760);
  setStatus(`Extruding one continuous ${strokes.length}-stroke curved toolpath. The amber front cools into layered green polymer.`);
  const carriage=printer.userData.carriage, gantry=printer.userData.gantry, spool=printer.userData.spool;
  const bead=new THREE.Mesh(new THREE.SphereGeometry(.115,18,12),mat.knotHot); scene.add(bead); liveBead=bead;
  const heat=new THREE.PointLight(0xff6a1a,3.2,5.5); scene.add(heat);
  const duration=Math.round(8800+strokes.length*9), t0=performance.now(); let shown=-1;
  await new Promise(resolve=>{ function step(now){
    const raw=clamp01((now-t0)/duration), eased=raw<.08 ? raw*raw/0.08 : raw;
    const cursor=Math.min(strokes.length-1,Math.floor(eased*strokes.length));
    if(cursor!==shown){ for(let i=shown+1;i<=cursor;i++) strokes[i].visible=true; shown=cursor; }
    for(let i=Math.max(0,cursor-18);i<=cursor;i++){
      const age=cursor-i; strokes[i].material=age<4?mat.knotHot:age<11?mat.knotWarm:mat.knot;
    }
    const p=path[Math.min(path.length-1,cursor+1)];
    carriage.position.copy(carriageFromLocal(p)); gantry.position.y=5.15+p.y*.2; spool.rotation.x+=.055;
    const world=bedWorld(p); bead.position.copy(world); heat.position.set(world.x,world.y+.2,world.z); heat.intensity=2.8+Math.sin(now*.035)*.35;
    if(raw<1) requestAnimationFrame(step); else resolve();
  } requestAnimationFrame(step); });
  for(const stroke of strokes){ stroke.visible=true; stroke.material=mat.knot; }
  scene.remove(bead); scene.remove(heat); liveBead=null;
  await moveMachineTo(new THREE.Vector3(0,3.93,-.03),620);
  obj.userData.state='printed-on-bed'; setPhase('printed-on-bed'); setTarget(`${recipe.label} finished on printer bed`);
  setStatus('Hero Knot complete: a coherent curved extrusion with a localized hot front and progressive cooling. Pick it up to place it.');
}

async function startPrint(recipe){
  if(phase==='printing'){setStatus('Printer is already working.');return;}
  if(phase==='printed-on-bed'){setStatus('Finished print is still on the bed. Pick it up or cancel it first.');return;}
  if(carriedPreview){setStatus('Place or cancel the carried preview before printing another object.');return;}
  commandInput.value=`make a ${recipe.label.toLowerCase()}`;
  clearSelection(); setPhase('printing');
  // Auto-hide the menu when a build starts so the print is visible right away.
  hud.classList.add('collapsed'); hud.classList.remove('mobile-start'); toggleHud.textContent='Open';
  if(recipe.hero){ await startHeroPrint(recipe); return; }
  const obj=buildAtSize(recipe, SIZES[printSize]); obj.userData={label:recipe.label,recipeId:recipe.id,state:'printing',sizeScale:SIZES[printSize]};
  const parts=collectPartsLocal(obj);
  obj.position.copy(bedWorld()); scene.add(obj); printedOnBed=obj;
  const duration=printDuration(recipe,parts);
  setStatus(`v2e printing ${recipe.label}: sliced into ${parts.length} small pieces, ${(duration/1000).toFixed(1)}s. Printing piece by piece, bottom-up.`);
  pathGroup=new THREE.Group(); scene.add(pathGroup);
  liveBead=new THREE.Mesh(new THREE.SphereGeometry(.11,16,10),mat.freshOrange); scene.add(liveBead);
  const depositLight=new THREE.PointLight(0xff6a1a, 2.8, 6); scene.add(depositLight); // molten heat glow at the print front
  const carriage=printer.userData.carriage, gantry=printer.userData.gantry, spool=printer.userData.spool;
  const startC=carriage.position.clone(), startG=gantry.position.clone();
  const total=parts.reduce((sum,p)=>sum+p.weight,0);
  const checkpoints=[]; let acc=0;
  for(const p of parts){ checkpoints.push({start:acc/total,end:(acc+p.weight)/total,part:p}); acc+=p.weight; }
  const t0=performance.now(); let prev=null,lastEmit=0,segCount=0,lastActive=-1;
  await new Promise(resolve=>{
    function step(now){
      const raw=clamp01((now-t0)/duration);
      let active=checkpoints.findIndex(c=>raw>=c.start&&raw<=c.end); if(active<0)active=checkpoints.length-1;
      const c=checkpoints[active]; const localT=clamp01((raw-c.start)/Math.max(.0001,c.end-c.start));
      if(active!==lastActive){ prev=null; lastActive=active; }
      revealParts(parts,active,localT);
      const p=partPath(c.part,localT);
      carriage.position.copy(carriageFromLocal(p));
      gantry.position.y=5.15+p.y*.2;
      spool.rotation.x+=.045;
      const bedP=bedWorld(p), noz=nozzleWorld();
      liveBead.position.copy(bedP);
      depositLight.position.set(bedP.x, bedP.y+0.25, bedP.z); depositLight.intensity=2.4+Math.sin(now*0.03)*0.6;
      if(liveThread) scene.remove(liveThread);
      liveThread=drip(noz,bedP); liveThread.material=mat.freshOrange; scene.add(liveThread);
      if(prev && now-lastEmit>38 && segCount<900){
        const a=bedWorld(prev), b=bedP;
        const material=(recipe.id==='spiral'||recipe.id==='creature'||c.part.mesh.userData.baseMaterial===mat.roof)?mat.freshOrange:mat.freshGreen;
        const s=segment(a,b,material,c.part.size.x<.28&&c.part.size.z<.28?.018:.026);
        if(s){ pathGroup.add(s); segCount++; }
        lastEmit=now;
      }
      prev=p.clone();
      if(raw<1) requestAnimationFrame(step); else { carriage.position.copy(startC); gantry.position.copy(startG); resolve(); }
    }
    requestAnimationFrame(step);
  });
  if(liveBead){scene.remove(liveBead);liveBead=null;} if(liveThread){scene.remove(liveThread);liveThread=null;}
  scene.remove(depositLight); // remove the molten heat glow
  if(pathGroup){scene.remove(pathGroup);pathGroup=null;} // clear the nozzle-path trail so the finished piece is clean
  restoreFinal(obj); obj.position.copy(bedWorld()); obj.userData.state='printed-on-bed';
  setPhase('printed-on-bed'); setTarget(`${recipe.label} finished on printer bed`);
  setStatus(`${recipe.label} finished on the actual bed. Pick it up to place it.`);
}
async function pickupPrint(){ if(phase!=='printed-on-bed'||!printedOnBed){setStatus('Nothing finished on the printer bed yet.');return;} const obj=printedOnBed; printedOnBed=null; if(pathGroup){scene.remove(pathGroup);pathGroup=null;} setPhase('pickup-moving'); obj.userData.state='pickup-moving'; setStatus(`Picking up ${obj.userData.label}.`); await animateTransform(obj,handWorld(),.42,850); await sleep(140); obj.userData.state='carried-preview'; obj.scale.setScalar(1); const [x,z]=slots[slotIndex++%slots.length]; obj.position.set(x,0,z); setGhost(obj,true); carriedPreview=obj; setPhase('carried-preview'); setTarget(`preview ${obj.userData.label}`); setStatus(`${obj.userData.label} picked up. Move/rotate it or tap ground, then Place.`); }
function placePreview(){ if(!carriedPreview){setStatus('No carried preview. Print something, then Pick Up Print first.');return;} const obj=carriedPreview; carriedPreview=null; setGhost(obj,false); restoreFinal(obj); obj.userData.id=++idCounter; obj.userData.state='placed'; placed.push(obj); magnetSnap(obj); setPhase('ready'); selectPlaced(obj); savePlacement(obj); setStatus(`${obj.userData.label} placed and saved to the shared world (persists on reload).`); }
function cancelOrDelete(){ if(phase==='printing'){setStatus('Print is mid-fabrication. Let it finish, then cancel/pick up.');return;} if(carriedPreview){scene.remove(carriedPreview);carriedPreview=null;setPhase('ready');setTarget('none');setStatus('Carried preview cancelled.');return;} if(printedOnBed){scene.remove(printedOnBed);printedOnBed=null;if(pathGroup){scene.remove(pathGroup);pathGroup=null;}setPhase('ready');setTarget('none');setStatus('Finished print removed from the bed.');return;} if(selected){const doomed=selected;clearSelection();scene.remove(doomed);const i=placed.indexOf(doomed);if(i>=0)placed.splice(i,1);deletePlacement(doomed);setStatus('Selected placed object deleted (removed from the shared world too).');return;} setStatus('Nothing to cancel or delete.'); }

// --- World-state persistence + real-time multiplayer (Supabase) -------------
// Every placed object is a row (the world's source of truth, not the git repo).
// Placing, moving and deleting sync to the table; a Realtime subscription pushes
// every builder's changes to all connected players live. Any AI (Claude/ChatGPT/
// Zeus) can SELECT to map the world or DELETE to clean it up.
const WORLD='printer-lab';
const supabase=createClient('https://ygjpnvrwhkrowkrskftk.supabase.co','sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN');
const newId=()=> (crypto&&crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random());
function findPlaced(dbId){ return placed.find(o=>o.userData.dbId===dbId); }
function spawnPlacementRow(row){
  const recipe=recipes.find(r=>r.id===row.type); if(!recipe) return null;
  const obj=buildAtSize(recipe, row.scale||1); // rebuild at the saved size (baked into geometry)
  obj.userData={label:row.label||recipe.label, recipeId:recipe.id, id:++idCounter, state:'placed', dbId:row.id, sizeScale:row.scale||1};
  obj.position.set(row.x,row.y,row.z); obj.rotation.y=row.rot_y||0;
  placed.push(obj); scene.add(obj); return obj;
}
async function savePlacement(obj){
  obj.userData.dbId=newId(); // client id so our own realtime echo is recognised, not duplicated
  try{ await supabase.from('placements').insert({ id:obj.userData.dbId, world:WORLD, type:obj.userData.recipeId, label:obj.userData.label, x:obj.position.x, y:obj.position.y, z:obj.position.z, rot_y:obj.rotation.y, scale:obj.userData.sizeScale||1 }); }catch(e){}
}
async function updatePlacement(obj){
  if(!obj.userData.dbId) return;
  try{ await supabase.from('placements').update({ x:obj.position.x, y:obj.position.y, z:obj.position.z, rot_y:obj.rotation.y, scale:obj.userData.sizeScale||1 }).eq('id',obj.userData.dbId); }catch(e){}
}
async function deletePlacement(obj){
  if(!obj.userData.dbId) return;
  try{ await supabase.from('placements').delete().eq('id',obj.userData.dbId); }catch(e){}
}
async function loadPlacements(){
  try{
    const { data, error } = await supabase.from('placements').select('*').eq('world',WORLD).order('created_at');
    if(error||!data||!data.length) return;
    for(const row of data){ if(!findPlaced(row.id)) spawnPlacementRow(row); }
    setStatus(`Loaded ${data.length} saved world object(s) from the shared world state.`);
  }catch(e){}
}
function subscribeWorld(){
  try{
    supabase.channel('placements-'+WORLD)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'placements',filter:`world=eq.${WORLD}`},({new:row})=>{ if(row && !findPlaced(row.id)){ spawnPlacementRow(row); setStatus(`Another builder placed a ${row.label||row.type}.`); } })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'placements',filter:`world=eq.${WORLD}`},({new:row})=>{ const o=row&&findPlaced(row.id); if(o){ o.position.set(row.x,row.y,row.z); o.rotation.y=row.rot_y||0; /* size is baked into geometry (group scale stays 1); do NOT re-apply row.scale or Large objects double-scale */ if(selected===o) updateSelectionBox(); } })
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'placements'},({old})=>{ const o=old&&findPlaced(old.id); if(o){ if(selected===o) clearSelection(); scene.remove(o); const i=placed.indexOf(o); if(i>=0)placed.splice(i,1); } })
      .subscribe();
  }catch(e){}
}

const sizeButtonsEl=$('#sizeButtons');
function renderSizeButtons(){ sizeButtonsEl.innerHTML=''; for(const key of ['small','medium','large']){ const b=document.createElement('button'); b.className='secondary'; b.textContent=SIZE_LABELS[key]; if(printSize===key){ b.style.borderColor='#00ff9d'; b.style.color='#00ff9d'; b.style.fontWeight='800'; } b.addEventListener('click',()=>{ printSize=key; setStatus(`Printer size set to ${SIZE_LABELS[key]}. The next print will be ${key}.`); renderSizeButtons(); }); sizeButtonsEl.appendChild(b); } }
renderSizeButtons();
for(const recipe of recipes){ const b=document.createElement('button'); b.className='secondary'; b.textContent=recipe.label; b.addEventListener('click',()=>startPrint(recipe)); recipeButtons.appendChild(b); }
runButton.addEventListener('click',()=>{ const r=parseCommand(commandInput.value); if(!r){setStatus('No recipe matched. Try stall, cottage, boat, tree, cart, spiral, creature, or campfire.');return;} startPrint(r); });
pickupButton.addEventListener('click',pickupPrint); placeButton.addEventListener('click',placePreview); cancelButton.addEventListener('click',cancelOrDelete);
$('#moveLeft').addEventListener('click',()=>moveTarget(-1,0)); $('#moveRight').addEventListener('click',()=>moveTarget(1,0)); $('#moveForward').addEventListener('click',()=>moveTarget(0,-1)); $('#moveBack').addEventListener('click',()=>moveTarget(0,1)); $('#rotateLeft').addEventListener('click',()=>rotateTarget(-1)); $('#rotateRight').addEventListener('click',()=>rotateTarget(1)); $('#raiseUp').addEventListener('click',()=>raiseTarget(0.5)); $('#lowerDown').addEventListener('click',()=>raiseTarget(-0.5));
$('#magnetToggle').addEventListener('click',()=>{ magnetOn=!magnetOn; $('#magnetToggle').textContent=magnetOn?'🧲 On':'🧲 Off'; if(magnetOn&&magnetOn){$('#magnetToggle').style.borderColor='#00ff9d';$('#magnetToggle').style.color='#00ff9d';}else{$('#magnetToggle').style.borderColor='';$('#magnetToggle').style.color='';} setStatus(magnetOn?'Edge-magnet snapping ON — pieces auto-align to neighbours.':'Magnet OFF — free grid placement.'); });
commandInput.addEventListener('keydown',(e)=>{ if(e.key==='Enter') runButton.click(); });

const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2(); let down=null;
renderer.domElement.addEventListener('pointerdown',(e)=>{down={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('click',(e)=>{ if(e.target.closest?.('#hud'))return; if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return; pointer.x=e.clientX/window.innerWidth*2-1; pointer.y=-(e.clientY/window.innerHeight)*2+1; raycaster.setFromCamera(pointer,camera); if(carriedPreview){ const hits=raycaster.intersectObject(ground); if(hits.length){ carriedPreview.position.x=Math.round(hits[0].point.x); carriedPreview.position.z=Math.round(hits[0].point.z); magnetSnap(carriedPreview); updateSelectionBox(); setStatus(`Moved carried preview to ${carriedPreview.position.x.toFixed(1)}, ${carriedPreview.position.z.toFixed(1)}.`); } return; } const hits=raycaster.intersectObjects(placed,true); if(hits.length){ let root=hits[0].object; while(root.parent&&!root.userData.id) root=root.parent; if(root.userData.id) selectPlaced(root); } });
window.addEventListener('keydown',(e)=>{ if(document.activeElement===commandInput&&e.key!=='Enter')return; const k=e.key.toLowerCase();
  if(k==='w'||e.key==='ArrowUp')move.f=1; else if(k==='s'||e.key==='ArrowDown')move.f=-1; if(k==='a'||e.key==='ArrowLeft')move.s=-1; else if(k==='d'||e.key==='ArrowRight')move.s=1;
  if(k==='q')rotateTarget(-1); if(k==='e')rotateTarget(1); if(k==='r')raiseTarget(0.5); if(k==='f')raiseTarget(-0.5);
  if(e.key==='Enter'&&carriedPreview)placePreview(); if(e.key==='Delete'||e.key==='Backspace')cancelOrDelete(); });
window.addEventListener('keyup',(e)=>{ const k=e.key.toLowerCase(); if(k==='w'||e.key==='ArrowUp'||k==='s'||e.key==='ArrowDown')move.f=0; if(k==='a'||e.key==='ArrowLeft'||k==='d'||e.key==='ArrowRight')move.s=0; });
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(!SpeechRecognition){ voiceButton.disabled=true; voiceButton.title='Speech recognition not available in this browser.'; } else { const rec=new SpeechRecognition(); rec.lang='en-US'; rec.interimResults=false; rec.continuous=false; voiceButton.addEventListener('click',()=>{ setStatus('Listening. Say make a stall, cottage, boat, tree...'); rec.start(); }); rec.onresult=(e)=>{ const text=e.results[0][0].transcript; commandInput.value=text; const r=parseCommand(text); if(r)startPrint(r); else setStatus(`Heard “${text}”, but no recipe matched yet.`); }; rec.onerror=(e)=>setStatus(`Voice error: ${e.error}. Type the command instead.`); }

const starter1=createSpiral(); starter1.position.set(-6.2,0,-1.4); starter1.scale.setScalar(.8); starter1.userData={label:'Starter Spiral',id:++idCounter,state:'placed'}; placed.push(starter1); scene.add(starter1);
const starter2=createCreature(); starter2.position.set(-8.3,0,1.7); starter2.userData={label:'Starter Creature',id:++idCounter,state:'placed'}; placed.push(starter2); scene.add(starter2);
const starter3=createBoat(); starter3.position.set(6.4,.04,-.5); starter3.rotation.y=-.45; starter3.userData={label:'Starter Boat',id:++idCounter,state:'placed'}; placed.push(starter3); scene.add(starter3);

// Rebuild any previously-placed world objects, then subscribe so every builder's
// placements/moves/deletes appear live for all connected players (multiplayer).
loadPlacements();
subscribeWorld();

function resize(){ camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2)); renderer.setSize(window.innerWidth,window.innerHeight); }
window.addEventListener('resize',resize);
// --- Camera modes + character controls --------------------------------------
// Walk the player with the on-screen joystick (or WASD/arrows); switch between
// Orbit (free overview), 3rd-person (follow) and 1st-person. Drag to look in the
// walking modes. Object nudging stays on the on-screen buttons, so there's no clash.
let viewMode='orbit', camYaw=0, camPitch=0.32;
const move={f:0,s:0}, joy={x:0,y:0};
const PLAYER_SPEED=0.11, PLAYER_EYE=1.55;
controls.enablePan=true;
const VIEW_LABELS={orbit:'Orbit',follow:'3rd Person',first:'1st Person'};
const viewButtonsEl=$('#viewButtons');
function renderViewButtons(){ viewButtonsEl.innerHTML=''; for(const key of ['orbit','follow','first']){ const b=document.createElement('button'); b.className='secondary'; b.textContent=VIEW_LABELS[key]; if(viewMode===key){ b.style.borderColor='#00ff9d'; b.style.color='#00ff9d'; b.style.fontWeight='800'; } b.addEventListener('click',()=>setViewMode(key)); viewButtonsEl.appendChild(b); } }
function setViewMode(key){ viewMode=key; controls.enabled=(key==='orbit'); if(key==='orbit'){ camera.position.set(14,9.2,15.6); controls.target.set(0,2.1,-1.2); controls.update(); setStatus('View: Orbit — drag to orbit, pinch/two-finger to pan. Joystick still walks your character.'); } else { camYaw=player.rotation.y; setStatus(`View: ${VIEW_LABELS[key]} — joystick (or WASD) walks, drag to look.`); } renderViewButtons(); }
renderViewButtons();

// On-screen joystick (touch + mouse) → character movement.
const joyEl=$('#joystick'), joyKnob=$('#joyknob'); let joyId=null, joyCX=0, joyCY=0;
function updateJoy(e){ const dx=e.clientX-joyCX, dy=e.clientY-joyCY, max=44, d=Math.min(1,Math.hypot(dx,dy)/max), a=Math.atan2(dy,dx); joy.x=Math.cos(a)*d; joy.y=Math.sin(a)*d; joyKnob.style.transform=`translate(${Math.cos(a)*d*max}px,${Math.sin(a)*d*max}px)`; }
joyEl.addEventListener('pointerdown',(e)=>{ joyId=e.pointerId; const r=joyEl.getBoundingClientRect(); joyCX=r.left+r.width/2; joyCY=r.top+r.height/2; try{joyEl.setPointerCapture(e.pointerId);}catch(_){} updateJoy(e); });
joyEl.addEventListener('pointermove',(e)=>{ if(e.pointerId===joyId) updateJoy(e); });
function endJoy(e){ if(e.pointerId===joyId){ joyId=null; joy.x=0; joy.y=0; joyKnob.style.transform='translate(0,0)'; } }
joyEl.addEventListener('pointerup',endJoy); joyEl.addEventListener('pointercancel',endJoy);

// Drag-to-look in the walking modes (coexists with tap-to-select/place).
let lookLast=null;
renderer.domElement.addEventListener('pointerdown',(e)=>{ if(viewMode!=='orbit') lookLast={x:e.clientX,y:e.clientY}; });
renderer.domElement.addEventListener('pointermove',(e)=>{ if(viewMode!=='orbit'&&lookLast){ camYaw-=(e.clientX-lookLast.x)*0.005; camPitch=Math.max(-0.9,Math.min(1.0,camPitch+(e.clientY-lookLast.y)*0.004)); lookLast={x:e.clientX,y:e.clientY}; } });
window.addEventListener('pointerup',()=>{ lookLast=null; });

const _eye=new THREE.Vector3();
function updatePlayerAndCamera(){
  let ix=joy.x+move.s, iz=joy.y-move.f; const len=Math.hypot(ix,iz);
  if(len>0.03){
    if(len>1){ ix/=len; iz/=len; }
    const yaw=(viewMode==='orbit') ? Math.atan2(camera.position.x-controls.target.x, camera.position.z-controls.target.z) : camYaw;
    const mx=Math.sin(yaw)*(-iz)+Math.cos(yaw)*ix, mz=Math.cos(yaw)*(-iz)-Math.sin(yaw)*ix;
    player.position.x=Math.max(-72,Math.min(72,player.position.x+mx*PLAYER_SPEED));
    player.position.z=Math.max(-72,Math.min(72,player.position.z+mz*PLAYER_SPEED));
    player.rotation.y=Math.atan2(mx,mz);
  }
  if(viewMode==='follow'){
    const dist=7.5, cp=Math.cos(camPitch);
    camera.position.set(player.position.x-Math.sin(camYaw)*dist*cp, player.position.y+2.4+Math.sin(camPitch)*dist, player.position.z-Math.cos(camYaw)*dist*cp);
    camera.lookAt(player.position.x, player.position.y+1.4, player.position.z);
  } else if(viewMode==='first'){
    _eye.set(player.position.x, player.position.y+PLAYER_EYE, player.position.z); camera.position.copy(_eye); const cp=Math.cos(camPitch);
    camera.lookAt(_eye.x+Math.sin(camYaw)*cp, _eye.y-Math.sin(camPitch), _eye.z+Math.cos(camYaw)*cp);
  }
}

function animate(now){ requestAnimationFrame(animate); if(phase==='ready'){ const c=printer.userData.carriage,g=printer.userData.gantry; c.position.x=Math.sin(now*.0011)*.55; c.position.y=5.1; c.position.z=.25+Math.cos(now*.0009)*.18; g.position.y=5.55; printer.userData.spool.rotation.x+=.008; } updatePlayerAndCamera(); updateSelectionBox(); if(viewMode==='orbit') controls.update(); renderer.render(scene,camera); }
setPhase('ready'); setTarget('none'); setStatus(`${BUILD}. Start with Hero Knot for the continuous curved-extrusion proof.`); animate(performance.now());

// Optional deep-link: /?auto=<recipe id or alias> auto-starts that print on load
// (handy for testing and for linking straight to a specific print).
const autoParam=new URLSearchParams(location.search).get('auto');
const autoPlace=new URLSearchParams(location.search).get('place');
const autoSize=new URLSearchParams(location.search).get('size');
if(autoSize && SIZES[autoSize]){ printSize=autoSize; renderSizeButtons(); }
if(autoParam){ const r=recipes.find(x=>x.id===autoParam)||parseCommand(autoParam); if(r) setTimeout(async()=>{ await startPrint(r); if(autoPlace){ await pickupPrint(); placePreview(); } },500); }
