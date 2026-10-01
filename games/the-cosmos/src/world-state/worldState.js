import { initialEconomy, reduceEconomy } from '../economy/economy.js';
// Authority boundary: all persistent commands pass here. No DOM, network or three.js.
// LocalAuthority is today's in-browser host. A future server hosts this class.
export class WorldState {
  constructor(adapter) {this.adapter=adapter;this.state={schema:1,revision:0,economy:initialEconomy(),ship:null,player:null,crew:[],damage:{}};
    this.handlers=new Map();this.pending=Promise.resolve();this.error='';this.saving=0;this.capture=null;}
  async load() {
    const loaded=await this.adapter.load();
    if(loaded.record){if(loaded.record.schema!==1)throw Error('Unsupported world save version.');this.state=loaded.record;}
    return loaded;
  }
  register(type, fn) {this.handlers.set(type,fn);}
  dispatch(action) {
    let result={ok:true,msg:'Done.'};
    try {
      if(this.error) throw Error(`Saving unavailable: ${this.error}`);
      const handler=this.handlers.get(action.type);
      if(handler) {result=handler(action)||result;if(result.ok===false)return result;}
      else if(action.type==='ship-pose') this.state.ship=structuredClone(action.pose);
      else if(action.type==='player-pose') this.state.player=structuredClone(action.pose);
      else if(action.type==='damage') {
        if(!action.id||!Number.isFinite(action.amount)||action.amount<0)throw Error('Invalid damage.');
        const old=this.state.damage[action.id];
        this.state.damage[action.id]={amount:(old?.amount||0)+action.amount,position:action.position,up:action.up};
      } else this.state.economy=reduceEconomy(this.state.economy,action);
      this.state.revision++;
      const bricks=this.capture?.(action)||[];
      this.persist(bricks);return result;
    } catch(e) {return {ok:false,msg:e.message};}
  }
  persist(bricks=[]) {
    const record=structuredClone(this.state);this.saving++;
    // Preserve action order across asynchronous durable transactions.
    this.pending=this.pending.then(()=>this.adapter.save(record,bricks)).catch(e=>{this.error=e.message;}).finally(()=>this.saving--);
    return this.pending;
  }
  async flush() {await this.pending;if(this.error)throw Error(this.error);}
}
