// Fix round 3: settings sheet at 390x844 and 375x667: nothing overlaps the close X at any scroll, no empty visible button anywhere.
// Usage: node test/fix-r3-settings.mjs <before|after>
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const pw=createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT||'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules')('playwright');
const tag=process.argv[2]||'after';
const exe=process.env.COSMOS_WEBKIT_EXE||join(process.env.LOCALAPPDATA,'ms-playwright','webkit-2336','Playwright.exe');
const out=join('docs','qa','2026-10-04','fix-r3');await mkdir(out,{recursive:true});
const browser=await pw.webkit.launch({headless:true,executablePath:exe});
const url=process.env.COSMOS_LOCAL_URL||'http://localhost:8399/?dev=1&solo=1&opening=off&tier=low';
const res=[];
for(const [W,H] of [[390,844],[375,667]]){
  const ctx=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});
  const page=await ctx.newPage();
  await page.goto(url);await page.waitForFunction(()=>window.cosmos?.port?.root&&cosmos.ship?.ready&&cosmos.crewUI,{},{timeout:90000});
  await page.waitForTimeout(1500);
  await page.locator('#btn-settings').tap();await page.waitForTimeout(400);
  const r=await page.evaluate(async()=>{
    const panel=document.getElementById('settings-panel'),body=panel.querySelector('.settings-body')||panel,x=document.getElementById('btn-close-settings');
    const hits=new Set();let worst=0;
    const els=[...panel.querySelectorAll('button,input,select,label,a')].filter(e=>e!==x);
    for(let st=0;st<=body.scrollHeight;st+=60){body.scrollTop=st;panel.scrollTop=st;await new Promise(r=>setTimeout(r,20));
      const a=x.getBoundingClientRect();
      for(const e of els){const b=e.getBoundingClientRect();if(!b.width||!b.height)continue;const cy=b.top+b.height/2,cx=b.left+b.width/2;let clip=false;for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){const o=getComputedStyle(p);if(/(auto|scroll|hidden)/.test(o.overflowY)){const q=p.getBoundingClientRect();if(cx<q.left||cx>q.right||cy<q.top||cy>q.bottom)clip=true;}}if(clip)continue;
        const ix=Math.min(a.right,b.right)-Math.max(a.left,b.left),iy=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
        if(ix>0&&iy>0){hits.add(e.id||e.tagName);worst=Math.max(worst,ix*iy/(b.width*b.height));}}}
    body.scrollTop=0;panel.scrollTop=0;
    const pr=panel.getBoundingClientRect(),xr=x.getBoundingClientRect();
    return {overlaps:[...hits],worst,panelBottom:Math.round(pr.bottom),vh:innerHeight,xInside:xr.top>=pr.top&&xr.bottom<=pr.bottom+1,canScroll:body.scrollHeight>body.clientHeight};});
  await page.screenshot({path:join(out,`settings-${W}x${H}-${tag}.png`)});
  const empties=await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>{const r=b.getBoundingClientRect(),cs=getComputedStyle(b);return r.width>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&!b.textContent.trim()&&!b.getAttribute('aria-label')&&!b.title;}).map(b=>b.id||b.className));
  res.push({W,H,...r,emptyButtons:empties,pass:r.worst<.2&&r.xInside&&r.panelBottom<=r.vh&&empties.length===0});
  await ctx.close();
}
await browser.close();
await writeFile(join(out,`settings-${tag}.json`),JSON.stringify(res,null,1));console.log(JSON.stringify(res,null,1));
