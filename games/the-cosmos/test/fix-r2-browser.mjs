// Fix round 2 EYES + checks: iPhone WebKit. Usage: node test/fix-r2-browser.mjs <before|after>
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const pw=createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT||'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules')('playwright');
const tag=process.argv[2]||'after';
const exe=process.env.COSMOS_WEBKIT_EXE||join(process.env.LOCALAPPDATA,'ms-playwright','webkit-2336','Playwright.exe');
const out=join('docs','qa','2026-10-04','fix-r2');await mkdir(out,{recursive:true});
const browser=await pw.webkit.launch({headless:true,executablePath:exe});
const context=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});
const page=await context.newPage();const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
const url=process.env.COSMOS_LOCAL_URL||'http://localhost:8399/?dev=1&solo=1&opening=off&tier=low';
const shot=n=>page.screenshot({path:join(out,`${n}-${tag}.png`)});
try{
  await page.goto(url);
  await page.waitForFunction(()=>window.cosmos?.port?.root&&cosmos.ship?.ready&&cosmos.crewUI,{},{timeout:90000});
  await page.evaluate(()=>{cosmos.engine.stop();const c=cosmos,s=c.port.site;c.ship.aboard=false;Object.assign(c.walker.worldPos,s.toWorld(-14,.02,39));c.walker.yaw=0;c.step(0);});
  // 1. Settings, scrolled so the tool select passes under the sticky heading
  await page.locator('#btn-settings').tap();await page.waitForTimeout(400);
  await page.evaluate(()=>{const p=document.getElementById('settings-panel');p.scrollTop=140;});await page.waitForTimeout(300);await shot('settings-scrolled');
  const ov=await page.evaluate(()=>{const x=document.getElementById('btn-close-settings').getBoundingClientRect(),panel=document.getElementById('settings-panel');
    const hit=[];for(const id of ['set-tool','set-view']){const r=document.getElementById(id).getBoundingClientRect();const ix=Math.min(x.right,r.right)-Math.max(x.left,r.left),iy=Math.min(x.bottom,r.bottom)-Math.max(x.top,r.top);if(ix>0&&iy>0)hit.push(id);}
    const cx=x.left+x.width/2,cy=x.top+x.height/2,top=document.elementFromPoint(cx,cy);return {overlaps:hit,topAtClose:top?.id||top?.tagName,sel:getComputedStyle(document.getElementById('set-tool')).appearance};});
  checks.push({name:'settings: nothing but the X is under the close button',pass:ov.topAtClose==='btn-close-settings',detail:ov});
  const sp=await page.evaluate(()=>{const r=document.getElementById('settings-panel').getBoundingClientRect(),h=document.getElementById('hud').getBoundingClientRect();return {panelTop:r.top,hudBottom:h.bottom};});
  await page.locator('#btn-close-settings').tap();await page.waitForTimeout(300);
  // 2. A person talks to someone: the dialog must start below the HUD card
  const opened=await page.evaluate(async()=>{const c=cosmos,s=c.port.site;Object.assign(c.walker.worldPos,s.toWorld(-12,.02,41));c.walker.velocity={x:0,y:0,z:0};
    for(let i=0;i<8;i++)c.step(.25);const m=c.portPeople?.nearest(c.walker.worldPos)||c.crewUI.portPeople?.nearest(c.walker.worldPos);if(!m)return false;c.crewUI.openFor(m);c.step(.25);return true;});
  await page.waitForTimeout(600);await shot('dialog-over-hud');
  const dlg=await page.evaluate(()=>{const p=document.getElementById('crew-panel').getBoundingClientRect(),h=document.getElementById('hud').getBoundingClientRect();return {opened:getComputedStyle(document.getElementById('crew-panel')).display!=='none',panelTop:p.top,hudBottom:h.bottom};});
  checks.push({name:'dialog panel starts below the HUD card',pass:opened&&dlg.opened&&dlg.panelTop>=dlg.hudBottom-0.5,detail:{opened,...dlg}});
  await page.evaluate(()=>cosmos.crewUI.close());
  // 3. A refusal said again and again turns into advice on the third time
  const refusals=await page.evaluate(()=>{const c=cosmos,s=c.port.site;const out={};
    Object.assign(c.walker.worldPos,s.toWorld(0,.02,0));c.walker.velocity={x:0,y:0,z:0};c.walker.pitch=-1.2;c.step(0);out.concrete=[0,1,2,3].map(()=>c.doDig().msg);
    c.walker.pitch=1.1;c.step(0);out.air=[0,1,2,3].map(()=>c.doDig().msg);return out;});
  checks.push({name:'repeated "Structural concrete will not cut." escalates to advice by the 3rd',pass:refusals.concrete[0]===refusals.concrete[1]&&refusals.concrete[2]!==refusals.concrete[0],detail:refusals.concrete});
  checks.push({name:'repeated "Nothing in reach" escalates to advice by the 3rd',pass:refusals.air[0]===refusals.air[1]&&refusals.air[2]!==refusals.air[0],detail:refusals.air});
  await shot('after-toasts');
  // 4. Boot splash markup
  await writeFile(join(out,`checks-${tag}.json`),JSON.stringify({tag,checks,errors,sp},null,1));
}finally{await browser.close();}
console.log(JSON.stringify({checks,errors},null,1));
