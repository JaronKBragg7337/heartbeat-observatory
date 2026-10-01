export class MemoryAdapter {
  constructor() {this.record=null;this.bricks=new Map();}
  async load() {return {record:structuredClone(this.record),bricks:structuredClone([...this.bricks.values()])};}
  async save(record,bricks=[]) {this.record=structuredClone(record);for(const b of bricks)this.bricks.set(b.key,structuredClone(b));}
}
// Adapter contract: load() => {record, bricks}; save(record, changedBricks) is atomic.
// A server adapter will submit actions instead; the server runs the same authority/reducer.
export class IndexedDBAdapter {
  constructor(name='cosmos-world-v1') {this.name=name;this.db=null;this.release=null;}
  async load() {
    if (navigator.locks) {
      await new Promise((resolve,reject)=>{
        navigator.locks.request(this.name,{ifAvailable:true},lock=>{
          if(!lock){reject(Error('This world is open in another tab. Close that tab and refresh.'));return;}
          resolve();return new Promise(r=>this.release=r);
        }).catch(reject);
      });
    }
    this.db=await new Promise((resolve,reject)=>{
      const r=indexedDB.open(this.name,1);
      r.onupgradeneeded=()=>{r.result.createObjectStore('state');r.result.createObjectStore('bricks',{keyPath:'key'});};
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    });
    return new Promise((resolve,reject)=>{
      const t=this.db.transaction(['state','bricks'],'readonly');
      const r=t.objectStore('state').get('world'), b=t.objectStore('bricks').getAll();
      t.oncomplete=()=>resolve({record:r.result||null,bricks:b.result});t.onerror=()=>reject(t.error);
    });
  }
  save(record,bricks=[]) {
    return new Promise((resolve,reject)=>{
      const t=this.db.transaction(['state','bricks'],'readwrite',{durability:'strict'});
      t.objectStore('state').put(record,'world');for(const b of bricks)t.objectStore('bricks').put(b);
      t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Save aborted.'));
    });
  }
}
