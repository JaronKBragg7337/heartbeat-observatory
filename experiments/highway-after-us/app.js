(() => {
  'use strict';
  const slider = document.getElementById('timeline');
  const yearVisual = document.getElementById('yearVisual');
  const oldScene = document.getElementById('oldScene');
  const scenePhase = document.getElementById('scenePhase');
  const play = document.getElementById('play');
  const playText = document.getElementById('playText');
  const playIcon = document.getElementById('playIcon');
  let year = 0, running = false, lastTime = 0, frame = 0, currentStage = -1;
  const stages = [
    { at:0, range:'YEAR 0 · THE BEGINNING', phase:'THE ROAD TODAY', title:'The last ordinary day.', body:'The lanes are clear, the shoulders are cut, and water has somewhere to go. From here on, this road is on its own.' },
    { at:1, range:'YEARS 1–4 · THE EDGES', phase:'THE EDGES GO WILD', title:'The edges come first.', body:'Without mowing, grasses lean over the shoulder. Leaves and windblown soil gather in low spots, and blocked drains can leave water sitting longer.' },
    { at:5, range:'YEARS 5–14 · SMALL OPENINGS', phase:'CRACKS BECOME SHELTER', title:'A foothold in the cracks.', body:'Water and weather can widen existing cracks. Bits of soil collect there, giving mosses and small plants a place to settle.' },
    { at:15, range:'YEARS 15–29 · NEW GROWTH', phase:'THE ROAD GETS NARROWER', title:'The green moves inward.', body:'Grass spreads from the shoulders. Shrubs and young trees take hold where seeds find enough soil and light. The straight lines begin to soften.' },
    { at:30, range:'YEARS 30–50 · A YOUNG FOREST', phase:'A DIFFERENT LANDSCAPE', title:'A road beneath the trees.', body:'In this imagined future, young trees rise over broken pavement. The highway is still there beneath them, but the landscape is taking it back.' }
  ];
  const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
  const smooth = (v,a,b) => { let t=clamp((v-a)/(b-a)); return t*t*(3-2*t); };
  function update(v) {
    year=clamp(v,0,50); const whole=Math.round(year); slider.value=whole; slider.style.setProperty('--progress',`${year*2}%`);
    oldScene.style.opacity = smooth(year, 7, 50);
    slider.setAttribute('aria-valuetext',`Year ${whole}`); yearVisual.textContent=String(whole).padStart(2,'0');
    let index=0; for(let i=0;i<stages.length;i++) if(year>=stages[i].at) index=i;
    if(index!==currentStage) {currentStage=index;const s=stages[index];scenePhase.textContent=s.phase;document.getElementById('storyIndex').textContent=`0${index+1} / 05`;document.getElementById('storyTime').textContent=s.range;document.getElementById('storyTitle').textContent=s.title;document.getElementById('storyBody').textContent=s.body;}
  }
  function stop() {running=false;cancelAnimationFrame(frame);playText.textContent='PLAY';playIcon.textContent='▶';play.setAttribute('aria-label','Play timeline');}
  function tick(t) {if(!running)return;if(lastTime)update(year+(t-lastTime)/450);lastTime=t;if(year>=50){stop();return;}frame=requestAnimationFrame(tick);}
  play.addEventListener('click',()=>{if(running){stop();return;}if(year>=50)update(0);running=true;lastTime=0;playText.textContent='PAUSE';playIcon.textContent='Ⅱ';play.setAttribute('aria-label','Pause timeline');frame=requestAnimationFrame(tick);});
  slider.addEventListener('input',()=>{stop();update(Number(slider.value));});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)stop();});
  update(0);
})();
