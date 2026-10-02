// Small, bounded graphics-only diagnostics. No device key, player identity,
// page URL, stack trace, or arbitrary browser error is sent to the authority.
export function browserName(ua = '') {
  return /Firefox\//.test(ua) ? 'Firefox' : /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Unknown';
}
export function blankFrame(pixels, clear, tolerance = 3) {
  return pixels.length > 0 && pixels.every((pixel) => pixel.slice(0,3).every((v,i)=>Math.abs(v-clear[i])<=tolerance));
}
export class GraphicsHealth {
  constructor(tier) {
    this.tier=tier;this.pending=[];this.failures=0;this.blankCount=0;this.checked=0;
    try { const previous=JSON.parse(sessionStorage.getItem('cosmos-graphics-error'));if(previous){this.pending.push(previous);this.show(previous.reason, false);sessionStorage.removeItem('cosmos-graphics-error');} } catch {}
  }
  show(reason, switching) {
    let line=document.getElementById('graphics-problem');
    if(!line){line=document.createElement('div');line.id='graphics-problem';line.setAttribute('role','status');line.style.cssText='position:fixed;top:42px;left:8px;right:8px;z-index:1000;padding:5px;background:#271c16ee;color:#ffe0ad;font:12px/1.4 sans-serif;pointer-events:none';document.body.append(line);}
    line.title=reason;
    line.textContent=`Graphics problem: ${reason.slice(0,180)} - ${switching?'switching to safe mode':this.tier==='safe'?(this.failures?'safe mode failed':'safe mode active'):'graphics unavailable'}`;
  }
  attach(engine, gl) {
    this.engine=engine;this.gl=gl;
    try { const ext=gl.getExtension('WEBGL_debug_renderer_info');this.gpu=String(gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER)).slice(0,200); } catch {this.gpu='Unavailable';}
    engine.renderer.debug.onShaderError=(gl,program,vs,fs)=>this.problem('Shader compile/link: '+[gl.getProgramInfoLog(program),gl.getShaderInfoLog(vs),gl.getShaderInfoLog(fs)].filter(Boolean).join(' ').slice(0,700));
    engine.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.problem('WebGL context lost'+(e.statusMessage?': '+e.statusMessage.slice(0,120):''));});
  }
  problem(reason) {
    if(this.failures++)return;
    const switching=this.tier!=='safe';
    const report={reason:String(reason).replace(/https?:\/\/\S+/g,'[URL]').slice(0,900),gpu:this.gpu||'Unavailable',browser:browserName(navigator.userAgent),tier:this.tier};
    this.pending.push(report);this.show(report.reason,switching);this.flush();
    if(switching){try{sessionStorage.setItem('cosmos-graphics-error',JSON.stringify(report));}catch{}
      // A fresh page releases the old GPU resources and can request WebGL1 on
      // a fresh canvas. Safe mode never reloads itself, preventing a loop.
      setTimeout(()=>{const url=new URL(location.href);url.searchParams.set('tier','safe');url.searchParams.delete('depth');location.replace(url.href);},800);
    }
  }
  bindWorld(world){this.world=world;this.flush();}
  flush(){if(!this.world?.connected||this.world.socket?.readyState!==1)return;while(this.pending.length){const report=this.pending.shift();this.world.socket.send(JSON.stringify({type:'client-error',...report}));}}
  afterFrame() {
    const gl=this.gl;if(!gl||gl.isContextLost())return;
    this.flush();const err=gl.getError();if(err===gl.OUT_OF_MEMORY){this.problem('WebGL out of memory');return;}
    if(err===1286){this.problem('Incomplete WebGL framebuffer');return;}
    if(err===1282){this.problem('WebGL invalid operation');return;}
    // Sample the completed default framebuffer, before the browser discards
    // it. Several empty frames must agree; looking at empty sky is not enough.
    if(++this.checked>90 || this.checked%10)return;
    const clear=this.clearColor||gl.getParameter(gl.COLOR_CLEAR_VALUE),expected=Array.from(clear).map(v=>Math.round(v*255)),pixels=[];
    for(const x of [.15,.35,.5,.65,.85])for(const y of [.15,.35,.5,.65,.85]){const p=new Uint8Array(4);gl.readPixels(Math.floor(gl.drawingBufferWidth*x),Math.floor(gl.drawingBufferHeight*y),1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);pixels.push(Array.from(p));}
    const blank=blankFrame(pixels,expected);
    this.blankCount=blank?this.blankCount+1:0;
    if(this.blankCount>=3)this.problem('First frames contain only the clear color');
  }
}
