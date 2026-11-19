// The game shell (part 4): the server-down path, the picture-quality setting, action sounds, and the home-screen app's manifest.
// A plain static server with NO game server behind it (so the shared world really is down), an iPhone-profile WebKit page and an
// Android-profile Chromium page. Run: node test/shell-browser.mjs   (OUT=<folder> for pictures; default docs/qa/2026-11-19/shell/)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickTier, medianFps, savedQuality, saveQuality } from '../src/ui/quality.js';
let pw;try{pw=createRequire(import.meta.url)('playwright');}catch{pw=createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT||'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/')('playwright');}
const out=process.env.OUT||fileURLToPath(new URL('../docs/qa/2026-11-19/shell/',import.meta.url));await mkdir(out,{recursive:true});
const root=fileURLToPath(new URL('..',import.meta.url));
const WEBKIT=process.env.COSMOS_WEBKIT||join(process.env.LOCALAPPDATA||'','ms-playwright','webkit-2336','Playwright.exe');
const CHROME=process.env.COSMOS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const IPHONE={userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',viewport:{width:375,height:812},deviceScaleFactor:2,isMobile:true,hasTouch:true};
const GALAXY={userAgent:'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',viewport:{width:360,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true};
const checks=[],errors=[];const check=(name,ok,detail='')=>{checks.push({name,ok:!!ok,detail});console.log((ok?'ok   ':'FAIL ')+name+(detail?'  '+detail:''));};
const PORT=4391,DEAD='ws://localhost:59871',base=`http://localhost:${PORT}/`;
let server,webkit,chrome;
try{
  // ---- the rules, with no browser ---------------------------------------------------------------------------------------------
  check('a phone starts on Fast, a desktop on Full detail',pickTier({touch:true})==='low'&&pickTier({touch:false})==='high');
  check('the player\'s saved choice wins over the guess',pickTier({touch:true,saved:'high'})==='high'&&pickTier({touch:false,saved:'low'})==='low');
  check('an address with ?tier= wins over the saved choice; safe graphics wins over all',pickTier({search:'?tier=low',saved:'high'})==='low'&&pickTier({search:'?tier=high',saved:'high',safe:true})==='low');
  {const mem=new Map(),st={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)};
    saveQuality('low',st);const a=savedQuality(st);saveQuality('auto',st);check('the choice is remembered, and Auto forgets it',a==='low'&&savedQuality(st)==='auto');}
  check('the frame-rate reading ignores the odd long hitch',Math.round(medianFps([16.7,16.7,16.7,400,16.7]))===60&&Math.round(medianFps([50,50,50,50]))===20);
  const man=JSON.parse(await readFile(join(root,'manifest.webmanifest'),'utf8'));
  check('the home-screen app opens the game itself, full screen, any way up',man.start_url==='/games/the-cosmos/'&&man.scope==='/games/the-cosmos/'&&man.display==='fullscreen'&&man.display_override.includes('standalone')&&man.orientation==='any'&&man.icons.length>=3);

  // ---- a static server and nothing else: the shared world is down -----------------------------------------------------------------
  server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(PORT)},stdio:'ignore'});
  for(let i=0;i<40;i++){try{const r=await fetch(base);if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
  webkit=await pw.webkit.launch({headless:true,executablePath:WEBKIT});
  try{chrome=await pw.chromium.launch({headless:true,executablePath:CHROME,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl','--autoplay-policy=no-user-gesture-required']});}catch(e){console.log('no Chromium: the Android half is skipped');}
  for(const [name,browser,profile] of [['iphone',webkit,IPHONE],['android',chrome,GALAXY]]){
    if(!browser)continue;
    const ctx=await browser.newContext(profile),page=await ctx.newPage();
    page.on('pageerror',e=>errors.push(name+': '+String(e)));
    page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|WebSocket connection|ERR_CONNECTION_REFUSED/i.test(m.text()))errors.push(name+' console: '+m.text().slice(0,240));});
    const fits=()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
    // 1. first launch with the shared world down: a plain message and a way on
    await page.goto(`${base}?dev=1&serverdown=1&ws=${DEAD}`);
    const btn=page.locator('#boot-solo');await btn.waitFor({timeout:90000});
    const words=await page.locator('#boot-status').textContent();
    check(name+': with the server down the first screen says so in plain words',/not answering/i.test(words),words);
    const box=await btn.boundingBox();check(name+': and offers a button big enough for a thumb',box&&box.height>=44&&box.x>=0&&box.x+box.width<=profile.viewport.width,JSON.stringify(box));
    await page.screenshot({path:join(out,`${name}-server-down.png`)});check(name+': the server-down screen fits the phone',await fits());
    await btn.tap();
    await page.waitForFunction(()=>window.cosmos?.engine?.frameCount>10&&!document.getElementById('boot'),null,{timeout:240000});
    check(name+': the button starts a solo game',await page.evaluate(()=>cosmos.world.offline===true&&!cosmos.world.remote));
    await page.waitForTimeout(1500);await page.screenshot({path:join(out,`${name}-solo-started.png`)});
    // 1b. the server comes back while the solo game runs: one offer to return (a bare socket that answers the handshake stands in for the server)
    {
      const socks=new Set(),back=createServer(sock=>{let buf='';socks.add(sock);sock.on('close',()=>socks.delete(sock));sock.on('error',()=>{});sock.on('data',d=>{buf+=d;const m=/Sec-WebSocket-Key: (.+)\r\n/i.exec(buf);if(!m||!buf.includes('\r\n\r\n'))return;
        sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+createHash('sha1').update(m[1].trim()+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')+'\r\n\r\n');buf='';});});
      await new Promise(r=>back.listen(Number(DEAD.split(':').pop()),'localhost',r));
      const offered=await page.locator('#world-back').waitFor({timeout:45000}).then(()=>true,()=>false);
      check(name+': when the server answers again the solo game offers the way back',offered&&/answering again/.test(await page.locator('#world-back').textContent().catch(()=>'')));
      if(offered){const bb=await page.locator('#world-back').boundingBox();check(name+': the offer fits the screen',bb.x>=0&&bb.x+bb.width<=profile.viewport.width+1,JSON.stringify(bb));
        await page.screenshot({path:join(out,`${name}-world-back.png`)});await page.locator('#world-back button',{hasText:'Stay solo'}).tap();check(name+': "Stay solo" puts the offer away',await page.locator('#world-back').count()===0);}
      await new Promise(r=>{back.close(r);for(const s of socks)s.destroy();});
    }
    // 2. the picture-quality setting: shown, changed, remembered across the reload it causes
    // (a brand-new player is in the opening now: Settings must be reachable from inside it, by the real button)
    check(name+': the opening is running',await page.evaluate(()=>!!cosmos.opening?.active));
    await page.locator('#btn-settings').tap();await page.locator('#set-quality').scrollIntoViewIfNeeded();
    check(name+': Settings opens during the opening and keeps to the screen',await page.evaluate(()=>{const r=document.getElementById('settings-panel').getBoundingClientRect();return r.width>200&&r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;}));
    check(name+': Settings says which quality is on',/Now: Fast/.test(await page.locator('#set-quality-now').textContent()));
    const row=await page.locator('#set-quality').boundingBox();check(name+': the quality control is a thumb-sized target inside the screen',row&&row.height>=40&&row.x+row.width<=profile.viewport.width+1,JSON.stringify(row));
    await page.screenshot({path:join(out,`${name}-settings-quality.png`)});
    const sfxBox=page.locator('#set-sfx');check(name+': Settings has the action-sounds switch, on by default',await sfxBox.isChecked());
    await Promise.all([page.waitForNavigation({timeout:120000}),page.locator('#set-quality').selectOption('high')]);
    await page.waitForFunction(()=>window.cosmos?.engine?.frameCount>10||document.getElementById('boot-solo'),null,{timeout:240000});
    if(await page.locator('#boot-solo').isVisible().catch(()=>false)){await page.locator('#boot-solo').tap();await page.waitForFunction(()=>window.cosmos?.engine?.frameCount>10&&!document.getElementById('boot'),null,{timeout:240000});}
    check(name+': choosing Full detail reloads into it and remembers it',await page.evaluate(()=>localStorage.getItem('cosmos-quality')==='high'&&/Now: Full detail/.test(document.getElementById('set-quality-now').textContent)));
    check(name+': the address keeps no ?tier= after the change',!/[?&]tier=/.test(page.url()));
    check(name+': nothing scrolls sideways',await fits());
    // 3. the home-screen app's tags are on the page
    const tags=await page.evaluate(()=>({man:document.querySelector('link[rel=manifest]')?.getAttribute('href'),cap:document.querySelector('meta[name=apple-mobile-web-app-capable]')?.content,title:document.querySelector('meta[name=apple-mobile-web-app-title]')?.content,vp:document.querySelector('meta[name=viewport]')?.content}));
    check(name+': the page carries its own home-screen app tags',/manifest\.webmanifest$/.test(tags.man||'')&&tags.cap==='yes'&&tags.title==='The Cosmos'&&/viewport-fit=cover/.test(tags.vp||''),JSON.stringify(tags));
    const mr=await page.evaluate(async()=>{const r=await fetch(document.querySelector('link[rel=manifest]').href);return r.ok&&(await r.json()).name;});
    check(name+': and the manifest is served',mr==='The Cosmos',String(mr));
    await ctx.close();
  }
  check('no errors in either browser',errors.length===0,errors.slice(0,4).join(' || '));
}catch(e){check('the run finished',false,String(e.stack||e).slice(0,700));}
finally{
  const failed=checks.filter(c=>!c.ok);await writeFile(join(out,'shell-results.json'),JSON.stringify({passed:failed.length===0,checks,errors},null,1));
  console.log(`\nshell: ${checks.length-failed.length}/${checks.length} checks passed`);if(failed.length)process.exitCode=1;
  await webkit?.close();await chrome?.close();server?.kill();
}
