// Allocation is deterministic and append-only; adding a pad never moves old ships.
export function allocatedPad(index, shipId) {
  const n = index + 1;
  return { id: `pad-${n}`, shipId, bodyId:'mars', number: String(index===0?1:index+3).padStart(2, '0'),
    x: index === 0 ? 0 : 150 + ((index - 1) % 4) * 64,
    z: index === 0 ? 0 : -120 + Math.floor((index - 1) / 4) * 100, w: 38, d: 64 };
}
export function landingField(site, getPads) {
  return { bodyId: 'mars',
    weight(x,y,z) { const p=site.toLocal({x,y,z}); let best=0;
      for(const a of getPads()) {
        if(a.x===0&&a.z===0)continue;
        const d=Math.hypot(Math.max(0,Math.abs(p.x-a.x)-a.w/2-6),Math.max(0,Math.abs(p.z-a.z)-a.d/2-6));
        const t=Math.min(1,d/16);best=Math.max(best,1-t*t*(3-2*t));
      } return best;
    },
    apply(base,x,y,z) { const w=this.weight(x,y,z);return base*(1-w)+site.toLocal({x,y,z}).y*w; },
    materialAt(x,y,z) { const p=site.toLocal({x,y,z});
      if(p.y>0.05||p.y<-.5)return null;
      return getPads().some(a=>Math.abs(p.x-a.x)<=a.w/2&&Math.abs(p.z-a.z)<=a.d/2)?
        {id:'MAT-PORT-CONCRETE',name:'Landing concrete',densityKgM3:2400,strength:.9,color:0x77716a}:null;
    }
  };
}
