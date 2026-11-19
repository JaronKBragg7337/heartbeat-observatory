import { setServerTime } from '../space/clock.js';
import { stringify, parse } from './wire.js';
import { BUILD_VERSION, reloadStaleBuild } from '../core/buildHandshake.js';
const identityKey='cosmos-device-v2';
const SLOT_KEY='cosmos-slot',DEV_TOKEN='cosmos-dev-token';
const isLocalHost=()=>['localhost','127.0.0.1'].includes(location.hostname);
const siteHost=()=>/(^|\.)heartbeatobservatory\.com$/.test(location.hostname)&&!/^cosmos\./.test(location.hostname);
const within=(promise,ms)=>Promise.race([promise,new Promise((_,no)=>setTimeout(()=>no(Error('timeout')),ms))]);
/** The site login, if there is one: the access token Supabase Auth gave this browser. Guests (no stored session) never load the Supabase client. */
export async function siteAuth(){
  try{
    if(isLocalHost()){const t=localStorage.getItem(DEV_TOKEN);if(t)return {token:t,email:'dev'};}
    if(!siteHost())return null;
    let stored=false;try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^sb-.*-auth-token$/.test(k))stored=true;}}catch{}
    if(!stored)return null;
    const mod=await within(import('/hb-supabase.js'),6000),sb=await within(mod.getSupabase(),6000),{data}=await within(sb.auth.getSession(),4000);
    return data?.session?{token:data.session.access_token,email:data.session.user?.email||'',sb}:null;
  }catch{return null;}
}
export const chosenSlot=()=>{try{return localStorage.getItem(SLOT_KEY)||'main';}catch{return 'main';}};
export const isAutomation=()=>{try{return navigator.webdriver===true||new URLSearchParams(location.search).get('qa')==='1';}catch{return false;}};
export function deviceIdentity(storage=localStorage,slot=identityKey) {
  let id;try{id=JSON.parse(storage.getItem(slot));}catch{}
  if(!id?.key){id={key:crypto.randomUUID()+crypto.randomUUID(),name:(slot===identityKey?'Visitor ':'Test visitor ')+Math.floor(Math.random()*1000)};try{storage.setItem(slot,JSON.stringify(id));}catch{}}
  id.slot=slot;
  return id;
}
export class RemoteWorld {
  constructor(identity,url){this.identity=identity;this.url=url;this.who=null;this.connectMs=12000;this.remote=true;this.connected=false;this.saving=0;this.error='';this.handlers=new Map();
    this.pendingActions=new Map();this.listeners=new Set();this.bricks=new Map();this.lastRevision=-1;this.poseSeq=0;this.sentPoses=new Map();
    this.journalKey='cosmos-opening-requests:'+identity.slot;
    try{const journal=JSON.parse(localStorage.getItem(this.journalKey));if(journal?.identity===identity.key)
      for(const [id,action] of journal.actions||[])if(action.type?.startsWith('opening-'))this.pendingActions.set(id,{action,resolve:()=>{}});
    }catch{}
  }
  journal(){try{localStorage.setItem(this.journalKey,JSON.stringify({identity:this.identity.key,
    actions:[...this.pendingActions].filter(([,p])=>p.action.type.startsWith('opening-')).map(([id,p])=>[id,p.action])}));}catch{}}
  register(){} // Existing local rule registration cannot mutate the remote authority.
  async load(){await this.connect();while(this.pendingActions.size)await new Promise(r=>setTimeout(r,20));
    return {record:this.state,bricks:[...this.bricks.values()].filter(b=>b.bodyId==='mars')};}
  connect(){return new Promise((resolve,reject)=>{
    const ws=this.socket=new WebSocket(this.url);let joined=false;
    // A phone on mobile data behind a tunnel can take several seconds to answer; giving up early made a slow answer look like an outage.
    const timer=setTimeout(()=>{if(!joined){ws.close();reject(Error('World server unavailable.'));}},this.connectMs);
    ws.onopen=async()=>{const p=new URLSearchParams(location.search),review=p.get('dev')==='1'&&p.get('opening')==='off';
      // The server checks this token itself; the browser never says who it is, only proves it.
      const auth=await siteAuth();this.auth=auth;
      if(ws.readyState!==WebSocket.OPEN)return;
      ws.send(stringify({type:'hello',deviceKey:this.identity.key,name:this.identity.name,personId:localStorage.getItem('hb-look')||'isaiah',openingVersion:review?0:1,buildVersion:BUILD_VERSION,
        token:auth?.token,slot:auth?chosenSlot():undefined,test:isAutomation()||undefined}));};
    ws.onmessage=e=>{let m;try{m=parse(e.data);}catch{return;}
      if(m.type==='identity-done'){this.onIdentityDone?.(m);return;}
      if(m.type==='welcome'){if(m.buildVersion)reloadStaleBuild(m.buildVersion);this.serverBuildVersion=m.buildVersion;this.who=m.identity||null;
        this.playerId=m.playerId;this.connected=true;this.error='';joined=true;clearTimeout(timer);this.apply(m);resolve();
        for(const [actionId,p] of this.pendingActions)ws.send(stringify({type:'action',actionId,action:p.action}));}
      else if(m.type==='state')this.apply(m);
      else if(m.type==='receipt'){const p=this.pendingActions.get(m.actionId);if(p){this.pendingActions.delete(m.actionId);this.journal();this.saving=this.pendingActions.size;
        if(m.opening){this.state.opening=m.opening;this.snapshot.players[this.playerId].opening=m.opening;}
        p.resolve(m);try{window.dispatchEvent(new CustomEvent('cosmos-receipt',{detail:{id:m.actionId,ok:m.ok!==false}}));}catch{}this.onReceipt?.(m);}}
      else if(m.type==='board'){this._boardWait?.(m.data);this._boardWait=null;}   // OPENING2: the arrivals board's live numbers
      else if(m.type==='voice')this.onVoice?.(m);   // VOICES: WebRTC handshake from another player
      else if(m.type==='error'){this.onReceipt?.({ok:false,msg:m.msg});}
    };
    ws.onerror=()=>{};
    ws.onclose=()=>{clearTimeout(timer);if(this.socket!==ws)return;this.connected=false;
      if(!joined){reject(Error('World server unavailable.'));return;}
      this.error='Disconnected — reconnecting to the shared world.';this.onConnection?.(false);
      this.scheduleReconnect();
    };
  });}
  /** Start fresh: ask the server to remove this character (its ship, crew and pad). Resolves with the server's answer. */
  discardCurrent(){return new Promise(resolve=>{if(!this.connected||this.socket.readyState!==WebSocket.OPEN){resolve({ok:false,msg:'Not connected to the shared world.'});return;}
    this.onIdentityDone=m=>{this.onIdentityDone=null;resolve(m);};this.socket.send(stringify({type:'identity',op:'discard'}));});}
  scheduleReconnect(){clearTimeout(this.retry);this.retry=setTimeout(()=>this.connect().then(()=>this.onConnection?.(true)).catch(()=>this.scheduleReconnect()),1500);}
  apply(m){if(!m.state||m.state.revision<this.lastRevision||(m.serverAt&&m.serverAt<(this.serverAt||0)))return;
    /* F2: the sky's clock is the server's (space/clock.js) */ if(m.serverAt)setServerTime(m.serverAt,Date.now());
    this.lastRevision=m.state.revision;this.snapshot=m.state;this.serverAt=m.serverAt;
    for(const b of m.bricks||[])this.bricks.set(b.key,b);
    const p=m.state.players[this.playerId],ship=m.state.ships[p.aboardShipId||p.currentShipId||p.shipId],owned=m.state.ships[p.shipId];
    this.state={schema:1,revision:m.state.revision,economy:{...owned.economy,cargo:p.carried,traders:m.state.market.traders},
      player:p.pose,ship:{...ship.pose,state:ship.state},crew:ship.crew,damage:m.state.damage,terrain:m.state.terrain.mars,toolIdx:p.toolIdx,opening:p.opening};
    this.error=m.state.storageError||'';
    for(const fn of this.listeners)fn(m);
  }
  sendPose(pose,controls,vehicle,ff){if(this.connected&&this.socket.readyState===WebSocket.OPEN){const seq=++this.poseSeq;this.sentPoses.set(seq,structuredClone(pose));while(this.sentPoses.size>64)this.sentPoses.delete(this.sentPoses.keys().next().value);this.socket.send(stringify({type:'pose',pose,controls,vehicle:vehicle||undefined,ff:ff||undefined,seq}));}}
  /** OPENING2: the arrivals board's data (worlds, sides and their live counts) from the authority. */
  board(){return new Promise((resolve,reject)=>{if(!this.connected||this.socket.readyState!==WebSocket.OPEN){reject(Error('Disconnected.'));return;}
    const t=setTimeout(()=>{this._boardWait=null;reject(Error('timeout'));},6000);this._boardWait=d=>{clearTimeout(t);resolve(d);};this.socket.send(stringify({type:'board'}));});}
  sendVoice(to,data){if(this.connected&&this.socket.readyState===WebSocket.OPEN){this.socket.send(stringify({type:'voice',to,data}));return true;}return false;}
  request(action){if(!this.connected||this.socket.readyState!==WebSocket.OPEN)return Promise.resolve({ok:false,msg:'Shared world disconnected; wait for reconnect.'});
    const actionId=crypto.randomUUID();this.saving++;
    try{window.dispatchEvent(new CustomEvent('cosmos-request',{detail:{id:actionId,type:action?.type}}));}catch{}
    return new Promise(resolve=>{this.pendingActions.set(actionId,{action,resolve});this.journal();this.socket.send(stringify({type:'action',actionId,action}));});}
  dispatch(action){if(['ship-pose','wages','player-pose','damage'].includes(action.type))return {ok:true,msg:'Server owns this state.'};
    this.beforeAction?.();this.request(action);return {ok:this.connected,msg:this.connected?'Request sent to the world.':'Disconnected; wait for reconnect.'};}
  async flush(){if(!this.connected)throw Error('Disconnected.');this.socket.send(stringify({type:'checkpoint'}));
    while(this.pendingActions.size)await new Promise(r=>setTimeout(r,20));}
}
export async function chooseWorld(local){const dev=['localhost','127.0.0.1'].includes(location.hostname);
  const params=new URLSearchParams(location.search);
  // (a local review can run its own authority on another port: ?ws=ws://localhost:PORT, honoured on localhost pages only)
  const asked=params.get('ws'),url=dev?(asked&&/^ws:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/.test(asked)?asked:'ws://localhost:8390'):'wss://cosmos.heartbeatobservatory.com';
  if(params.get('solo')==='1'){local.offline=true;return {world:local,saved:await local.load()};}
  const remote=new RemoteWorld(deviceIdentity(localStorage,params.get('test')==='1'?'cosmos-test-device-v2':identityKey),url);
  // SERVER DOWN (11/19, part 4): the page used to wait here for ever with one line of small print. Now it says plainly what is wrong, keeps trying,
  // and offers the way on: a solo game on this device (its own save; the shared-world journey is untouched and is there again when the server is).
  let goSolo=null,tries=0;const wantSolo=new Promise(r=>{goSolo=r;});
  for(;;){
    const got=await Promise.race([remote.load().then(saved=>({saved}),()=>null),wantSolo.then(()=>'solo')]);
    if(got==='solo'){try{remote.socket.onclose=null;remote.socket.close();}catch{}local.offline=true;local.serverDown=true;watchForReturn(url);return {world:local,saved:await local.load()};}
    if(got)return {world:remote,saved:got.saved};
    remote.socket?.close();
    if(dev&&params.get('serverdown')!=='1'){local.offline=true;const saved=await local.load();return {world:local,saved};}
    serverDownNotice(++tries,goSolo);
    await Promise.race([new Promise(r=>setTimeout(r,1500)),wantSolo]);}
}
/**
 * A solo game that began because the shared world was down: look in on the server now and then (one quiet socket every 20 seconds, closed at once),
 * and when it answers, offer the way back once. The solo save stays on the device either way.
 */
export function watchForReturn(url,{everyMs=20000,doc=document,Socket=globalThis.WebSocket}={}){
  if(!Socket)return;let done=false;
  const offer=()=>{if(done||doc.getElementById('world-back'))return;done=true;
    const el=doc.createElement('div');el.id='world-back';el.setAttribute('role','dialog');el.setAttribute('aria-label','The shared world is back');
    el.style.cssText='position:fixed;z-index:120;left:50%;transform:translateX(-50%);top:calc(64px + env(safe-area-inset-top,0px));width:min(92vw,420px);background:rgba(16,13,11,.94);border:1px solid rgba(240,185,120,.45);border-radius:12px;padding:12px 14px;color:#f1e2d0;font:14px/1.45 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5)';
    const p=doc.createElement('p');p.style.margin='0 0 10px';p.textContent='The shared world is answering again. Your solo game is saved on this device.';
    const row=doc.createElement('div');row.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
    const mk=(t,primary)=>{const b=doc.createElement('button');b.textContent=t;b.style.cssText=`flex:1;min-height:48px;border-radius:8px;border:1px solid ${primary?'#f0b978':'#c7b29666'};background:${primary?'#f0b978':'transparent'};color:${primary?'#1a120b':'#f1e2d0'};font:600 14px system-ui,sans-serif;padding:8px 12px;cursor:pointer`;return b;};
    const yes=mk('Return to the shared world',true),no=mk('Stay solo',false);
    yes.onclick=()=>{const u=new URL(location.href);u.searchParams.delete('solo');u.searchParams.delete('serverdown');location.replace(u.href);};no.onclick=()=>el.remove();
    row.append(yes,no);el.append(p,row);doc.body.append(el);};
  const look=()=>{if(done)return;let ws;try{ws=new Socket(url);}catch{return;}
    const end=setTimeout(()=>{try{ws.close();}catch{}},8000);
    ws.onopen=()=>{clearTimeout(end);try{ws.close();}catch{}offer();};ws.onerror=()=>{clearTimeout(end);};};
  const timer=setInterval(()=>{if(done)clearInterval(timer);else if(!doc.hidden)look();},everyMs);
}
/** The boot screen's words (and the button) while the shared world is not answering. */
export function serverDownNotice(tries,goSolo,doc=document){
  const status=doc.querySelector('#boot-status')||doc.querySelector('#boot p');
  if(status)status.textContent=tries<2?'The shared world is not answering. Trying again…':'The shared world is still not answering. It keeps trying by itself.';
  const boot=doc.querySelector('#boot');if(!boot||doc.querySelector('#boot-solo'))return;
  const b=doc.createElement('button');b.id='boot-solo';b.textContent='Play on your own for now';
  b.style.cssText='min-height:48px;margin-top:6px;padding:12px 20px;border-radius:8px;border:1px solid #f0b978;background:#f0b978;color:#1a120b;font:600 15px system-ui,sans-serif;cursor:pointer';
  const note=doc.createElement('p');note.id='boot-solo-note';note.textContent='A solo game saves on this device. Your journey in the shared world is safe and waits for you.';
  b.onclick=()=>{b.disabled=true;b.textContent='Starting your solo game…';goSolo();};
  boot.append(b,note);
}
