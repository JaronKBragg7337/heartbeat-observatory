// Activate from the pointer release, without depending on Safari's synthesized
// click. Keep native keyboard/assistive clicks, and suppress duplicate clicks.
export function bindActivation(button, run) {
  let press=null, suppressUntil=0;
  button.style.touchAction='manipulation';
  button.addEventListener('pointerdown',e=>{
    if(button.disabled||e.button>0)return;
    press={id:e.pointerId,x:e.clientX,y:e.clientY};
    e.stopPropagation();
    try{button.setPointerCapture?.(e.pointerId);}catch{}
  });
  button.addEventListener('pointerup',e=>{
    if(press?.id!==e.pointerId)return;
    const p=press;press=null;suppressUntil=performance.now()+700;
    e.preventDefault();e.stopPropagation();
    const r=button.getBoundingClientRect();
    if(!button.disabled&&Math.hypot(e.clientX-p.x,e.clientY-p.y)<18&&
      e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom)run();
  });
  for(const name of ['pointercancel','lostpointercapture'])button.addEventListener(name,()=>{press=null;});
  button.addEventListener('click',e=>{
    e.stopPropagation();
    if(performance.now()<suppressUntil&&e.detail!==0){e.preventDefault();return;}
    if(!button.disabled)run();
  });
}

// A sheet may update its values while a thumb is held. Delay replacing the
// pressed DOM until after click dispatch; otherwise a tap loses its target.
export function guardSheetPress(sheet) {
  sheet.addEventListener('pointerdown',()=>{sheet.dataset.pressed='true';});
  // By click capture, the browser has fixed the release target/event path.
  // Permit the click handler to redraw its reply immediately, even in a paused
  // game, without replacing a button before the browser selects that target.
  sheet.addEventListener('click',()=>{delete sheet.dataset.pressed;},true);
  const release=()=>setTimeout(()=>{delete sheet.dataset.pressed;},0);
  window.addEventListener('pointerup',release);
  window.addEventListener('pointercancel',release);
  window.addEventListener('blur',release);
}
