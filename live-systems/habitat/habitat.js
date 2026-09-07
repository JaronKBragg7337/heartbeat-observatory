const SNAPSHOT_URL = "/api/habitat-snapshot?world=habitat-v0";
const els = {
  canvas: document.getElementById("habitatCanvas"),
  fallback: document.getElementById("webglFallback"),
  worldDot: document.getElementById("worldDot"),
  worldStatus: document.getElementById("worldStatus"),
  focusName: document.getElementById("focusName"),
  focusState: document.getElementById("focusState"),
  tick: document.getElementById("tickValue"),
  bodyCount: document.getElementById("bodyCount"),
  controllerCount: document.getElementById("controllerCount"),
  generation: document.getElementById("generationValue"),
  actorList: document.getElementById("actorList"),
  controllerList: document.getElementById("controllerList"),
  generationList: document.getElementById("generationList"),
  eventList: document.getElementById("eventList"),
  lastRefresh: document.getElementById("lastRefresh")
};

let snapshot = null;
let selectedActorId = null;
let refreshTimer = 0;
let renderer = null;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};
const textSummary = (obj) => {
  if (!obj || typeof obj !== "object") return "";
  if (typeof obj.note === "string") return obj.note;
  if (typeof obj.text === "string") return obj.text;
  if (typeof obj.type === "string") return obj.type;
  const keys = Object.keys(obj).slice(0, 4);
  return keys.map((k) => `${k}: ${String(obj[k])}`).join(" · ");
};

function actorById(id) {
  return snapshot?.actors?.find((a) => a.id === id) || null;
}
function bodyForActor(id) {
  return snapshot?.bodies?.find((b) => b.actor_id === id) || null;
}
function controllerForActor(id) {
  const list = snapshot?.controllers?.filter((c) => c.actor_id === id) || [];
  return list.find((c) => c.status === "active") || list[0] || null;
}

function renderDom() {
  if (!snapshot?.ok) return;
  const world = snapshot.world || {};
  const actors = Array.isArray(snapshot.actors) ? snapshot.actors : [];
  const bodies = Array.isArray(snapshot.bodies) ? snapshot.bodies : [];
  const controllers = Array.isArray(snapshot.controllers) ? snapshot.controllers : [];
  const generations = Array.isArray(snapshot.generations) ? snapshot.generations : [];
  const events = Array.isArray(snapshot.events) ? snapshot.events : [];

  els.worldDot.className = "dot" + (world.status === "live" ? " live" : "");
  els.worldStatus.textContent = world.status === "live" ? "Live · persistent state online" : String(world.status || "unknown");
  els.tick.textContent = String(world.tick ?? "—");
  els.bodyCount.textContent = String(bodies.length);
  els.controllerCount.textContent = String(controllers.filter((c) => c.status === "active").length);
  const activeGen = generations.find((g) => g.status === "active") || generations[0];
  els.generation.textContent = activeGen?.key || "—";

  if (!selectedActorId && actors[0]) selectedActorId = actors[0].id;
  if (selectedActorId && !actors.some((a) => a.id === selectedActorId)) selectedActorId = actors[0]?.id || null;

  els.actorList.innerHTML = "";
  if (!actors.length) {
    const d = document.createElement("div"); d.className = "empty"; d.textContent = "No bodies are registered."; els.actorList.appendChild(d);
  }
  for (const actor of actors) {
    const body = bodyForActor(actor.id);
    const controller = controllerForActor(actor.id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "actor-card" + (actor.id === selectedActorId ? " selected" : "");
    const row = document.createElement("div"); row.className = "row";
    const name = document.createElement("span"); name.className = "name"; name.textContent = actor.name || actor.key;
    const badge = document.createElement("span"); badge.className = "badge" + (controller?.status === "active" ? " live" : "");
    badge.textContent = controller?.status === "active" ? "mind connected" : (actor.status || "unknown");
    row.append(name, badge);
    const dl = document.createElement("dl"); dl.className = "actor-meta";
    const fields = [
      ["Actor", actor.key],
      ["Body", body?.key || "none"],
      ["Generation", actor.generation || "unassigned"],
      ["Mind", controller ? `${controller.provider || "external"}${controller.model ? ` / ${controller.model}` : ""}` : (actor.identity?.brain_status || body?.state?.mind || "not attached")]
    ];
    for (const [k, v] of fields) {
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = String(v ?? "—");
      dl.append(dt, dd);
    }
    btn.append(row, dl);
    btn.addEventListener("click", () => {
      selectedActorId = actor.id;
      renderDom();
      renderer?.focusActor(actor.id);
    });
    els.actorList.appendChild(btn);
  }

  const focusActor = actorById(selectedActorId);
  const focusBody = bodyForActor(selectedActorId);
  const focusController = controllerForActor(selectedActorId);
  els.focusName.textContent = focusActor?.name || "Habitat";
  els.focusState.textContent = focusController
    ? `${focusController.provider || "controller"}${focusController.model ? ` · ${focusController.model}` : ""}`
    : (focusActor?.identity?.brain_status || focusBody?.state?.mind || focusActor?.status || "no mind attached").replaceAll("_", " ");

  els.controllerList.innerHTML = "";
  if (!controllers.length) {
    const d = document.createElement("div"); d.className = "empty"; d.textContent = "No external or resident controller session is attached right now."; els.controllerList.appendChild(d);
  } else {
    for (const c of controllers.slice(0, 12)) {
      const a = actorById(c.actor_id);
      const row = document.createElement("div"); row.className = "list-row";
      const left = document.createElement("div");
      const strong = document.createElement("strong"); strong.textContent = `${c.provider || "controller"}${c.model ? ` / ${c.model}` : ""}`;
      const sub = document.createElement("span"); sub.textContent = `${a?.name || "unknown actor"} · ${c.status} · seen ${fmtTime(c.last_seen_at)}`;
      left.append(strong, sub);
      const right = document.createElement("span"); right.className = "badge" + (c.status === "active" ? " live" : ""); right.textContent = c.status;
      row.append(left, right); els.controllerList.appendChild(row);
    }
  }

  els.generationList.innerHTML = "";
  if (!generations.length) {
    const d = document.createElement("div"); d.className = "empty"; d.textContent = "No generations registered."; els.generationList.appendChild(d);
  } else {
    for (const g of generations.slice().reverse().slice(0, 12)) {
      const row = document.createElement("div"); row.className = "list-row";
      const left = document.createElement("div");
      const strong = document.createElement("strong"); strong.textContent = `${g.key} · ${g.architecture || "unassigned"}`;
      const bits = [g.parameters ? `${Number(g.parameters).toLocaleString()} params` : "parameter count open", g.runtime || "runtime unassigned"];
      const sub = document.createElement("span"); sub.textContent = bits.join(" · ");
      left.append(strong, sub);
      const right = document.createElement("span"); right.className = "badge" + (g.status === "active" ? " live" : ""); right.textContent = g.status;
      row.append(left, right); els.generationList.appendChild(row);
    }
  }

  els.eventList.innerHTML = "";
  if (!events.length) {
    const d = document.createElement("div"); d.className = "empty"; d.textContent = "No events yet."; els.eventList.appendChild(d);
  } else {
    for (const e of events.slice(0, 14)) {
      const row = document.createElement("div"); row.className = "event";
      const time = document.createElement("time"); time.dateTime = e.created_at || ""; time.textContent = fmtTime(e.created_at);
      const main = document.createElement("div");
      const strong = document.createElement("strong"); strong.textContent = e.type || "event";
      const p = document.createElement("p"); p.textContent = textSummary(e.payload) || "State change recorded.";
      main.append(strong, p); row.append(time, main); els.eventList.appendChild(row);
    }
  }
  els.lastRefresh.textContent = `refreshed ${fmtTime(snapshot.server_time || new Date().toISOString())}`;
}

async function refresh() {
  clearTimeout(refreshTimer);
  try {
    const res = await fetch(SNAPSHOT_URL, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data?.ok) throw new Error(data?.note || `HTTP ${res.status}`);
    snapshot = data;
    renderDom();
    renderer?.setSnapshot(snapshot);
  } catch (err) {
    els.worldDot.className = "dot";
    els.worldStatus.textContent = `Offline · ${err?.message || "snapshot unavailable"}`;
  } finally {
    refreshTimer = setTimeout(refresh, document.hidden ? 10000 : 2500);
  }
}

document.addEventListener("visibilitychange", () => {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, document.hidden ? 10000 : 300);
});

/* ----------------------------- minimal dependency-free WebGL renderer ---- */
function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    const b0=b[c*4], b1=b[c*4+1], b2=b[c*4+2], b3=b[c*4+3];
    out[c*4]   = a[0]*b0 + a[4]*b1 + a[8]*b2 + a[12]*b3;
    out[c*4+1] = a[1]*b0 + a[5]*b1 + a[9]*b2 + a[13]*b3;
    out[c*4+2] = a[2]*b0 + a[6]*b1 + a[10]*b2 + a[14]*b3;
    out[c*4+3] = a[3]*b0 + a[7]*b1 + a[11]*b2 + a[15]*b3;
  }
  return out;
}
function mat4Perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0]=f/aspect; out[5]=f; out[10]=(far+near)*nf; out[11]=-1; out[14]=2*far*near*nf;
  return out;
}
function mat4LookAt(eye, center, up) {
  let zx=eye[0]-center[0], zy=eye[1]-center[1], zz=eye[2]-center[2];
  let l=Math.hypot(zx,zy,zz)||1; zx/=l; zy/=l; zz/=l;
  let xx=up[1]*zz-up[2]*zy, xy=up[2]*zx-up[0]*zz, xz=up[0]*zy-up[1]*zx;
  l=Math.hypot(xx,xy,xz)||1; xx/=l; xy/=l; xz/=l;
  const yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
  return new Float32Array([
    xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
    -(xx*eye[0]+xy*eye[1]+xz*eye[2]),
    -(yx*eye[0]+yy*eye[1]+yz*eye[2]),
    -(zx*eye[0]+zy*eye[1]+zz*eye[2]),1
  ]);
}
function mat4Compose(x,y,z,yaw,sx,sy,sz) {
  const c=Math.cos(yaw||0), s=Math.sin(yaw||0);
  return new Float32Array([
    c*sx,0,-s*sx,0,
    0,sy,0,0,
    s*sz,0,c*sz,0,
    x,y,z,1
  ]);
}
function compile(gl, type, source) {
  const sh=gl.createShader(type); gl.shaderSource(sh,source); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)||"shader compile failed");
  return sh;
}
function createProgram(gl) {
  const vs = compile(gl, gl.VERTEX_SHADER, `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform mat4 uModel;
    uniform mat4 uViewProj;
    varying vec3 vNormal;
    void main(){
      vNormal = normalize(mat3(uModel) * aNormal);
      gl_Position = uViewProj * uModel * vec4(aPosition,1.0);
    }`);
  const fs = compile(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform vec3 uColor;
    varying vec3 vNormal;
    void main(){
      vec3 n=normalize(vNormal);
      float lit=0.36 + max(dot(n,normalize(vec3(-0.45,0.82,0.35))),0.0)*0.64;
      gl_FragColor=vec4(uColor*lit,1.0);
    }`);
  const p=gl.createProgram(); gl.attachShader(p,vs); gl.attachShader(p,fs); gl.linkProgram(p);
  if (!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)||"program link failed");
  return p;
}
function cubeData() {
  const p=[
    -0.5,-0.5,0.5, 0.5,-0.5,0.5, 0.5,0.5,0.5, -0.5,0.5,0.5,
    0.5,-0.5,-0.5, -0.5,-0.5,-0.5, -0.5,0.5,-0.5, 0.5,0.5,-0.5,
    -0.5,0.5,0.5, 0.5,0.5,0.5, 0.5,0.5,-0.5, -0.5,0.5,-0.5,
    -0.5,-0.5,-0.5, 0.5,-0.5,-0.5, 0.5,-0.5,0.5, -0.5,-0.5,0.5,
    0.5,-0.5,0.5, 0.5,-0.5,-0.5, 0.5,0.5,-0.5, 0.5,0.5,0.5,
    -0.5,-0.5,-0.5, -0.5,-0.5,0.5, -0.5,0.5,0.5, -0.5,0.5,-0.5
  ];
  const n=[]; [[0,0,1],[0,0,-1],[0,1,0],[0,-1,0],[1,0,0],[-1,0,0]].forEach(v=>{for(let i=0;i<4;i++)n.push(...v);});
  const idx=[]; for(let f=0;f<6;f++){const o=f*4;idx.push(o,o+1,o+2,o,o+2,o+3);} return {p,n,idx};
}

class HabitatRenderer {
  constructor(canvas) {
    this.canvas=canvas;
    this.gl=canvas.getContext("webgl",{antialias:true,alpha:false,powerPreference:"high-performance"}) || canvas.getContext("experimental-webgl");
    if (!this.gl) throw new Error("WebGL unavailable");
    const gl=this.gl;
    this.program=createProgram(gl); gl.useProgram(this.program);
    this.loc={
      p:gl.getAttribLocation(this.program,"aPosition"), n:gl.getAttribLocation(this.program,"aNormal"),
      model:gl.getUniformLocation(this.program,"uModel"), vp:gl.getUniformLocation(this.program,"uViewProj"), color:gl.getUniformLocation(this.program,"uColor")
    };
    const d=cubeData();
    this.pb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,this.pb); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(d.p),gl.STATIC_DRAW);
    this.nb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,this.nb); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(d.n),gl.STATIC_DRAW);
    this.ib=gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(d.idx),gl.STATIC_DRAW);
    this.indexCount=d.idx.length;
    this.world=null; this.visualBodies=new Map(); this.target=[0,1,0];
    this.camera={yaw:0.72,pitch:0.62,distance:24};
    this.drag=null; this.lastFrame=performance.now();
    this.bindInput();
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.clearColor(0.025,0.04,0.055,1);
    this.resize();
    this.ro = new ResizeObserver(()=>this.resize()); this.ro.observe(canvas);
    requestAnimationFrame((t)=>this.frame(t));
  }
  bindInput(){
    const c=this.canvas;
    c.addEventListener("pointerdown",e=>{this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};c.setPointerCapture?.(e.pointerId);});
    c.addEventListener("pointermove",e=>{if(!this.drag||e.pointerId!==this.drag.id)return;const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;this.drag.x=e.clientX;this.drag.y=e.clientY;this.camera.yaw-=dx*0.007;this.camera.pitch=clamp(this.camera.pitch+dy*0.006,0.16,1.35);});
    const end=e=>{if(this.drag&&e.pointerId===this.drag.id)this.drag=null;}; c.addEventListener("pointerup",end);c.addEventListener("pointercancel",end);
    c.addEventListener("wheel",e=>{e.preventDefault();this.camera.distance=clamp(this.camera.distance*Math.exp(e.deltaY*0.0012),7,48);},{passive:false});
  }
  resize(){
    const rect=this.canvas.getBoundingClientRect(), dpr=Math.min(devicePixelRatio||1,1.75); const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.gl.viewport(0,0,w,h);}
  }
  setSnapshot(s){
    this.world=s;
    for(const b of s.bodies||[]){
      const p=b.position||{}; const existing=this.visualBodies.get(b.id);
      if(existing){existing.tx=Number(p.x)||0;existing.ty=Number(p.y)||0;existing.tz=Number(p.z)||0;existing.tyaw=Number(b.yaw)||0;existing.state=b.state||{};}
      else this.visualBodies.set(b.id,{x:Number(p.x)||0,y:Number(p.y)||0,z:Number(p.z)||0,yaw:Number(b.yaw)||0,tx:Number(p.x)||0,ty:Number(p.y)||0,tz:Number(p.z)||0,tyaw:Number(b.yaw)||0,state:b.state||{}});
    }
  }
  focusActor(actorId){
    const b=this.world?.bodies?.find(x=>x.actor_id===actorId); if(!b)return; const v=this.visualBodies.get(b.id); if(v)this.target=[v.x,1.1+v.y,v.z];
  }
  bindGeometry(){
    const gl=this.gl; gl.bindBuffer(gl.ARRAY_BUFFER,this.pb);gl.enableVertexAttribArray(this.loc.p);gl.vertexAttribPointer(this.loc.p,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.nb);gl.enableVertexAttribArray(this.loc.n);gl.vertexAttribPointer(this.loc.n,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ib);
  }
  cube(x,y,z,sx,sy,sz,yaw,color){
    const gl=this.gl;gl.uniformMatrix4fv(this.loc.model,false,mat4Compose(x,y,z,yaw,sx,sy,sz));gl.uniform3fv(this.loc.color,color);gl.drawElements(gl.TRIANGLES,this.indexCount,gl.UNSIGNED_SHORT,0);
  }
  drawGrid(){
    const line=[0.12,0.17,0.21]; for(let i=-9;i<=9;i+=2){this.cube(i,0.012,0,0.025,0.024,18,0,line);this.cube(0,0.013,i,18,0.024,0.025,0,line);}
  }
  objectColor(o){
    if(o.kind==="beacon")return [0.48,0.62,0.72]; if(o.kind==="terminal")return [0.36,0.48,0.56];
    if(o.state?.tone==="warm")return [0.38,0.31,0.23]; if(o.state?.tone==="cool")return [0.20,0.30,0.37]; if(o.kind==="platform")return [0.075,0.10,0.13]; return [0.24,0.29,0.34];
  }
  drawWorld(){
    for(const o of this.world?.objects||[]){const p=o.position||{},s=o.scale||{};this.cube(Number(p.x)||0,Number(p.y)||0,Number(p.z)||0,Number(s.x)||1,Number(s.y)||1,Number(s.z)||1,Number(o.yaw)||0,this.objectColor(o));}
    this.drawGrid();
  }
  drawBody(body,v,time){
    const actor=this.world?.actors?.find(a=>a.id===body.actor_id);const controller=this.world?.controllers?.find(c=>c.actor_id===body.actor_id&&c.status==="active");
    const dormant=!controller && (actor?.status==="dormant" || v.state?.mode==="dormant"); const base=dormant?[0.31,0.35,0.39]:controller?[0.29,0.52,0.63]:[0.34,0.48,0.38];
    const bob=v.state?.animation==="walk"?Math.sin(time*0.01)*0.035:Math.sin(time*0.002)*0.012; const y=v.y+bob;
    this.cube(v.x,y+1.15,v.z,0.58,0.74,0.34,v.yaw,base);
    this.cube(v.x,y+1.91,v.z,0.42,0.42,0.42,v.yaw,[base[0]+0.08,base[1]+0.08,base[2]+0.08]);
    this.cube(v.x-0.18,y+0.45,v.z,0.18,0.78,0.20,v.yaw,base); this.cube(v.x+0.18,y+0.45,v.z,0.18,0.78,0.20,v.yaw,base);
    this.cube(v.x-0.42,y+1.18,v.z,0.16,0.68,0.18,v.yaw,base); this.cube(v.x+0.42,y+1.18,v.z,0.16,0.68,0.18,v.yaw,base);
  }
  frame(time){
    const dt=Math.min(0.05,(time-this.lastFrame)/1000||0.016);this.lastFrame=time;
    for(const v of this.visualBodies.values()){const k=1-Math.exp(-dt*5.5);v.x+=(v.tx-v.x)*k;v.y+=(v.ty-v.y)*k;v.z+=(v.tz-v.z)*k;let d=v.tyaw-v.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));v.yaw+=d*k;}
    const focusBody=this.world?.bodies?.find(b=>b.actor_id===selectedActorId);const fv=focusBody?this.visualBodies.get(focusBody.id):null;if(fv){const k=1-Math.exp(-dt*3);this.target[0]+=(fv.x-this.target[0])*k;this.target[1]+=((fv.y+1.0)-this.target[1])*k;this.target[2]+=(fv.z-this.target[2])*k;}
    const gl=this.gl;this.resize();gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);this.bindGeometry();
    const cp=Math.cos(this.camera.pitch),sp=Math.sin(this.camera.pitch),cy=Math.cos(this.camera.yaw),sy=Math.sin(this.camera.yaw),d=this.camera.distance;
    const eye=[this.target[0]+cy*cp*d,this.target[1]+sp*d,this.target[2]+sy*cp*d];const view=mat4LookAt(eye,this.target,[0,1,0]);const proj=mat4Perspective(Math.PI/3,this.canvas.width/this.canvas.height,0.1,120);gl.uniformMatrix4fv(this.loc.vp,false,mat4Multiply(proj,view));
    this.drawWorld();for(const b of this.world?.bodies||[]){const v=this.visualBodies.get(b.id);if(v)this.drawBody(b,v,time);} requestAnimationFrame(t=>this.frame(t));
  }
}

try { renderer = new HabitatRenderer(els.canvas); }
catch (err) { els.fallback.hidden = false; els.canvas.hidden = true; console.warn("Habitat 3D unavailable", err); }
refresh();
