// Fix round 3: what an iPhone player sees in the first 10 s. Usage: node test/fix-r3-boot.mjs <before|after>
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const pw=createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT||'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules')('playwright');
const tag=process.argv[2]||'after';
const exe=process.env.COSMOS_WEBKIT_EXE||join(process.env.LOCALAPPDATA,'ms-playwright','webkit-2336','Playwright.exe');
const out=join('docs','qa','2026-10-04','fix-r3');await mkdir(out,{recursive:true});
const W=+process.env.W||393,H=+process.env.H||852;
const browser=await pw.webkit.launch({headless:true,executablePath:exe});
const context=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,isMobile:true,hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});
const page=await context.newPage();
const url=process.env.COSMOS_LOCAL_URL||'http://localhost:8399/?solo=1&tier=low';
const t0=Date.now(),log=[];
await page.goto(url,{waitUntil:'commit'});
for(let i=0;i<14;i++){
  const s=await page.evaluate(()=>{const v=id=>{const e=document.getElementById(id);if(!e)return null;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return {hidden:e.hidden,display:cs.display,vis:cs.visibility,w:Math.round(r.width),text:(e.textContent||'').slice(0,40)}};
    return {boot:!!document.getElementById('boot'),bootText:document.getElementById('boot')?.innerText?.replace(/\n+/g,' | ').slice(0,100),act:v('opening-action'),walk:v('opening-walk'),skip:v('opening-skip'),cap:document.getElementById('opening-caption')?.innerText,cosmos:!!window.cosmos,stage:window.cosmos?.opening?.state?.stage}}).catch(e=>({err:e.message}));
  log.push({t:((Date.now()-t0)/1000).toFixed(1),...s});
  await page.screenshot({path:join(out,`boot-${String(i).padStart(2,'0')}-${tag}.png`)}).catch(()=>{});
  await page.waitForTimeout(700);
}
console.log(log.map(l=>JSON.stringify(l)).join('\n'));
await browser.close();
