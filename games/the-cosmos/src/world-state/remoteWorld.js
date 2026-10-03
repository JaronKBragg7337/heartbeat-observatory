import { stringify, parse } from './wire.js';
const identityKey='cosmos-device-v2';
export function deviceIdentity(storage=localStorage,slot=identityKey) {
  let id;try{id=JSON.parse(storage.getItem(slot));}catch{}
  if(!id?.key){id={key:crypto.randomUUID()+crypto.randomUUID(),name:(slot===identityKey?'Visitor ':'Test visitor ')+Math.floor(Math.random()*1000)};try{storage.setItem(slot,JSON.stringify(id));}catch{}}
  id.slot=slot;
  return id;
}
export class RemoteWorld {
  constructor(identity,url){this.identity=identity;this.url=url;this.remote=true;this.connected=false;this.saving=0;this.error='';this.handlers=new Map();
    this.pendingActions=new Map();this.listeners=new Set();this.bricks=new Map();this.lastRevision=-1;this.poseSeq=0;this.sentPoses=new Map();}
  register(){} // Existing local rule registration cannot mutate the remote authority.
  async load(){await this.connect();return {record:this.state,bricks:[...this.bricks.values()].filter(b=>b.bodyId==='mars')};}
  connect(){return new Promise((resolve,reject)=>{
    const ws=this.socket=new WebSocket(this.url);let joined=false;
    const timer=setTimeout(()=>{if(!joined){ws.close();reject(Error('World server unavailable.'));}},3500);
    ws.onopen=()=>{const p=new URLSearchParams(location.search),review=p.get('dev')==='1'&&p.get('opening')==='off';
      ws.send(stringify({type:'hello',deviceKey:this.identity.key,name:this.identity.name,personId:localStorage.getItem('hb-look')||'isaiah',openingVersion:review?0:1}));};
    ws.onmessage=e=>{let m;try{m=parse(e.data);}catch{return;}
      if(m.type==='welcome'){this.playerId=m.playerId;this.connected=true;this.error='';joined=true;clearTimeout(timer);this.apply(m);resolve();
        for(const [actionId,p] of this.pendingActions)ws.send(stringify({type:'action',actionId,action:p.action}));}
      else if(m.type==='state')this.apply(m);
      else if(m.type==='receipt'){const p=this.pendingActions.get(m.actionId);if(p){this.pendingActions.delete(m.actionId);this.saving=this.pendingActions.size;p.resolve(m);this.onReceipt?.(m);}}
      else if(m.type==='error'){this.onReceipt?.({ok:false,msg:m.msg});}
    };
    ws.onerror=()=>{};
    ws.onclose=()=>{clearTimeout(timer);if(this.socket!==ws)return;this.connected=false;
      if(!joined){reject(Error('World server unavailable.'));return;}
      this.error='Disconnected — reconnecting to the shared world.';this.onConnection?.(false);
      this.scheduleReconnect();
    };
  });}
  scheduleReconnect(){clearTimeout(this.retry);this.retry=setTimeout(()=>this.connect().then(()=>this.onConnection?.(true)).catch(()=>this.scheduleReconnect()),1500);}
  apply(m){if(!m.state||m.state.revision<this.lastRevision||(m.serverAt&&m.serverAt<(this.serverAt||0)))return;this.lastRevision=m.state.revision;this.snapshot=m.state;this.serverAt=m.serverAt;
    for(const b of m.bricks||[])this.bricks.set(b.key,b);
    const p=m.state.players[this.playerId],ship=m.state.ships[p.aboardShipId||p.currentShipId||p.shipId],owned=m.state.ships[p.shipId];
    this.state={schema:1,revision:m.state.revision,economy:{...owned.economy,cargo:p.carried,traders:m.state.market.traders},
      player:p.pose,ship:{...ship.pose,state:ship.state},crew:ship.crew,damage:m.state.damage,terrain:m.state.terrain.mars,toolIdx:p.toolIdx,opening:p.opening};
    this.error=m.state.storageError||'';
    for(const fn of this.listeners)fn(m);
  }
  sendPose(pose,controls,vehicle){if(this.connected&&this.socket.readyState===WebSocket.OPEN){const seq=++this.poseSeq;this.sentPoses.set(seq,structuredClone(pose));while(this.sentPoses.size>64)this.sentPoses.delete(this.sentPoses.keys().next().value);this.socket.send(stringify({type:'pose',pose,controls,vehicle:vehicle||undefined,seq}));}}
  request(action){if(!this.connected||this.socket.readyState!==WebSocket.OPEN)return Promise.resolve({ok:false,msg:'Shared world disconnected; wait for reconnect.'});
    const actionId=crypto.randomUUID();this.saving++;
    return new Promise(resolve=>{this.pendingActions.set(actionId,{action,resolve});this.socket.send(stringify({type:'action',actionId,action}));});}
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
  try{const saved=await remote.load();return {world:remote,saved};}catch{remote.socket?.close();local.offline=true;
    const saved=await local.load();return {world:local,saved};}
}
