// Store changed lattice samples as uint16 offsets + exact float32 bits, never JSON arrays.
// The deterministic base geology is rebuilt on load. Material density is retained too.
export function encodeBrick(store, b) {
  const offsets=[], values=[], materials=[], densities=[];
  for (let n=0;n<b.phi.length;n++) {
    const i=b.bx*32+(n&31), j=b.by*32+((n>>5)&31), k=b.bz*32+(n>>10);
    if (b.phi[n] !== Math.fround(store.baseLattice(i,j,k)) || b.rho?.[n] || b.mat?.[n]) {
      offsets.push(n); values.push(b.phi[n]); densities.push(b.rho?.[n]||0); materials.push(b.mat?.[n]||0);
    }
  }
  return { key:`${b.bx},${b.by},${b.bz}`, bx:b.bx,by:b.by,bz:b.bz,
    offsets:new Uint16Array(offsets),phi:new Float32Array(values),rho:new Float32Array(densities),mat:new Uint8Array(materials) };
}
export function terrainMeta(s) {
  return { edits:s.edits,piles:s.piles,seq:s._seq,repose:s.repose,
    accounts:['_removedV','_removedM','_depositedV','_depositedM'].map(k=>String(s[k])),
    totals:['totalRemovedM3','totalRemovedKg','totalDepositedM3','totalDepositedKg'].map(k=>s[k]) };
}
export function restoreTerrain(s, meta, bricks) {
  if (!meta) return;
  s.edits=meta.edits; s.piles=meta.piles; s._seq=meta.seq; s.repose=meta.repose;
  ['_removedV','_removedM','_depositedV','_depositedM'].forEach((k,i)=>s[k]=BigInt(meta.accounts[i]));
  ['totalRemovedM3','totalRemovedKg','totalDepositedM3','totalDepositedKg'].forEach((k,i)=>s[k]=meta.totals[i]);
  for (const r of bricks) {
    const b=s._ensureBrick(r.bx,r.by,r.bz); b.edited=true;
    // A sparse patch replaces the prior patch. Cells restored to natural ground
    // are omitted from the new offsets and must not retain an earlier hole.
    for(const n of b._restoredOffsets||[]) {
      const i=b.bx*32+(n&31),j=b.by*32+((n>>5)&31),k=b.bz*32+(n>>10);
      b.phi[n]=s.baseLattice(i,j,k);
    }
    b._restoredOffsets=r.offsets;
    b.rho=new Float32Array(b.phi.length); b.mat=new Uint8Array(b.phi.length);
    for(let n=0;n<r.offsets.length;n++) {const i=r.offsets[n];b.phi[i]=r.phi[n];b.rho[i]=r.rho[n];b.mat[i]=r.mat[n];}
    s._touch(r.bx*32,r.bx*32+31,r.by*32,r.by*32+31,r.bz*32,r.bz*32+31);
  }
}
