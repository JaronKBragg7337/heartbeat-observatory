// Every advertised keyboard action has an explicit touch control. New prompts
// must add a mapping here; the validator audits prompt strings and handlers.
export const KEY_ACTIONS = [
  ['KeyG','Debug · G'],['KeyV','View · V'],['KeyE','Use / dig / lift · E'],
  ['KeyQ','Drop one · Q'],['KeyR','Drop all · R'],['KeyC','Climb / descend · C'],
  ['KeyT','Talk / hire · T'],['KeyF','Fire · F'],
  ['Digit1','Spade · 1'],['Digit2','Shovel · 2'],['Digit3','Bucket · 3'],
  ['Space','Jump / ascend'],['KeyW','Forward'],['KeyS','Back'],['KeyA','Left'],['KeyD','Right'],
  ['ShiftLeft','Run'],['Escape','Close panels'],
];
export const TOUCH_PATHS = Object.fromEntries(KEY_ACTIONS.map(([code])=>[code,`#touch-key-${code}`]));
export function buildKeyControls() {
  const style=document.createElement('style');style.textContent=`
    #key-controls{position:fixed;left:12px;bottom:calc(64px + env(safe-area-inset-bottom,0px));z-index:67;font:11px ui-monospace,monospace;pointer-events:none}
    #key-controls button{pointer-events:auto;min-height:46px;border:1px solid #ba936a;border-radius:9px;padding:8px;background:#21190fe8;color:#ffe1bb;font:inherit;touch-action:none}
    #key-pad{display:none;grid-template-columns:repeat(3,1fr);gap:6px;background:#120e09f5;padding:8px;border-radius:12px;width:min(360px,calc(100vw - 40px));max-height:calc(100dvh - 160px);overflow:auto;touch-action:pan-y;overscroll-behavior:contain;margin-bottom:6px;pointer-events:auto}
  `;document.head.appendChild(style);
  const root=document.createElement('div');root.id='key-controls';
  root.innerHTML='<div id="key-pad"></div><button id="btn-key-controls" aria-expanded="false">Controls</button>';document.body.appendChild(root);
  const pad=root.querySelector('#key-pad'),toggle=root.querySelector('#btn-key-controls');
  toggle.onclick=()=>{const open=pad.style.display!=='grid';pad.style.display=open?'grid':'none';root.style.zIndex=open?'74':'67';toggle.setAttribute('aria-expanded',String(open));};
  for(const [code,label] of KEY_ACTIONS) {
    const b=document.createElement('button');b.id=`touch-key-${code}`;b.textContent=label;pad.appendChild(b);
    let held=false;
    const up=()=>{if(!held)return;held=false;window.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));};
    b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();try{b.setPointerCapture(e.pointerId);}catch{}held=true;
      window.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));});
    b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);
    window.addEventListener('blur',up);
  }
  window.addEventListener('keydown',e=>{if(e.code==='Escape'){pad.style.display='none';root.style.zIndex='67';toggle.setAttribute('aria-expanded','false');}});
  return root;
}
