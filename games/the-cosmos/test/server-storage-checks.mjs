import assert from 'node:assert/strict';
import { SupabaseAdapter } from '../server/storage.mjs';
import { stringify, parse } from '../src/world-state/wire.js';
export async function runServerStorageChecks({check,section}) {
  section('19. Privileged Postgres adapter contract (mock HTTP, no real database)');
  const original=globalThis.fetch,requests=[];
  try{
    globalThis.fetch=async(url,options)=>{requests.push({url,args:parse(options.body)});
      return {ok:true,text:async()=>url.endsWith('/cosmos_load')?stringify({record:{schema:2,revision:11},bricks:[]}):'null'};};
    const adapter=new SupabaseAdapter('https://test.invalid/','test-placeholder','test-world');await adapter.load();
    const changed=[{key:'mars:1,2,3',phi:new Float32Array([.125,2.5]),offsets:new Uint16Array([1,7]),rho:new Float32Array([0,1600]),mat:new Uint8Array([0,1])}];
    await adapter.save({schema:2,revision:12},changed);assert.equal(requests[1].args.expected,11);assert.equal(adapter.revision,12);
    assert.deepEqual(requests[1].args.changed[0].phi,changed[0].phi);check('load/save RPC preserves typed terrain and uses the expected durable revision',true);
    globalThis.fetch=async()=>({ok:false,status:503,text:async()=>'secret response must not escape'});
    let msg='';try{await adapter.save({schema:2,revision:13},[]);}catch(e){msg=e.message;}
    assert.equal(adapter.revision,12);assert.equal(msg.includes('secret'),false);assert.equal(msg.includes('placeholder'),false);
    check('an RPC failure keeps the commit revision and reports no key or response body',true);
    // PLAYFIX: a save whose answer is lost but which landed must not wedge later saves
    {const db={revision:12},calls=[];let lose=true;
      globalThis.fetch=async(url,options)=>{calls.push(url.split('/').pop());
        if(url.includes('/rpc/cosmos_save')){const a=parse(options.body);
          if(a.expected!==db.revision)return {ok:false,status:400,text:async()=>'conflict'};
          db.revision=a.rec.revision;if(lose){lose=false;throw Error('timeout');}return {ok:true,text:async()=>'null'};}
        return {ok:true,text:async()=>JSON.stringify([{revision:db.revision}])};};
      await adapter.save({schema:2,revision:13},[]);assert.equal(adapter.revision,13,'landed save with a lost answer counts as saved');
      await adapter.save({schema:2,revision:14},[]);assert.equal(adapter.revision,14,'the next save is not a revision conflict');
      adapter.revision=12;db.revision=14;await adapter.save({schema:2,revision:15},[]);assert.equal(adapter.revision,15,'an unseen earlier landing is adopted');
      check('a save whose answer was lost but landed is recognised; the next save is not blocked by a stale revision',true);}
  }finally{globalThis.fetch=original;}
}
