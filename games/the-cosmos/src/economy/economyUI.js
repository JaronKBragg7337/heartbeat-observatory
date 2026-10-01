import * as THREE from 'three';
import { QUESTS, WAGES, GOODS } from './catalog.js';
import { inventoryMass } from './economy.js';
export class EconomyUI {
  constructor(world,{port,walker,ship,bridge}) {
    Object.assign(this,{world,port,walker,ship,bridge});this.accum=0;this.open=false;
    const style=document.createElement('style');style.textContent=`
      #purse{position:fixed;right:12px;top:62px;z-index:67;color:#ffdb9c;background:#18120be8;border:1px solid #ae8548;border-radius:9px;min-height:44px;padding:5px 10px;font:12px ui-monospace,monospace;max-width:calc(100vw - 24px)}
      #account-panel{display:none;position:fixed;right:12px;top:110px;z-index:70;width:min(320px,calc(100vw - 24px));max-height:calc(100dvh - 190px);overflow:auto;box-sizing:border-box;background:#18120bf5;color:#ffdfb9;border:1px solid #ae8548;border-radius:12px;padding:14px;font:12px/1.5 ui-monospace,monospace}
      #account-panel button,#quest-deliver{min-height:46px;padding:8px 12px;border:1px solid #ae8548;border-radius:9px;background:#342713;color:#ffdfb9;font:inherit}
      #quest-deliver{display:none;position:fixed;bottom:230px;right:12px;z-index:67;max-width:calc(100vw - 24px)}
      @media(max-width:520px){#purse{font-size:10px;top:calc(var(--hud-bottom,140px) + 52px);right:8px}#account-panel{right:8px;top:calc(var(--hud-bottom,140px) + 100px);max-height:calc(100dvh - var(--hud-bottom,140px) - 164px)}}
    `;document.head.appendChild(style);
    this.purse=document.createElement('button');this.purse.id='purse';this.purse.setAttribute('aria-label','Purse, supplies, crew wages and quests');
    this.panel=document.createElement('div');this.panel.id='account-panel';
    this.deliver=document.createElement('button');this.deliver.id='quest-deliver';this.deliver.textContent='Deliver 1 tonne · receive 400 marks';
    document.body.append(this.purse,this.panel,this.deliver);
    this.purse.onclick=()=>{this.open=!this.open;this.draw();};
    this.panel.onclick=e=>{if(e.target.closest('button')){this.open=false;this.draw();}};
    this.deliver.onclick=()=>{if(!this.deliveryQuest)return;const r=world.dispatch({type:'quest-step',id:this.deliveryQuest.id});ship.note(r.msg,!r.ok);this.draw();};
    for(const q of QUESTS)this.buildBay(q);this.draw();
  }
  buildBay(q) {
    const g=new THREE.Group();g.name=`quest-bay-${q.id}`;g.position.set(q.target.x,.06,q.target.z);
    const mat=new THREE.MeshStandardMaterial({color:0xc28b32,emissive:0x714400,roughness:.6});
    for(const [x,z,w,d] of [[-3,0,.12,6],[3,0,.12,6],[0,-3,6,.12],[0,3,6,.12]]) {
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,.08,d),mat);m.position.set(x,0,z);g.add(m);
    }
    const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');x.fillStyle='#211509';x.fillRect(0,0,512,256);
    x.textAlign='center';x.fillStyle='#ffdc9e';x.font='bold 32px sans-serif';x.fillText(q.title.toUpperCase(),256,65,490);
    x.font='30px sans-serif';x.fillText(`${q.tonnes} TONNE RAW REGOLITH`,256,125);x.fillText(`Tower job · ${q.rewardMarks} marks`,256,180);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
    const face=new THREE.Mesh(new THREE.PlaneGeometry(3,1.5),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));face.position.set(0,2,-3);g.add(face);
    for(const sx of [-1.4,1.4]){const p=new THREE.Mesh(new THREE.BoxGeometry(.07,2.7,.07),mat);p.position.set(sx,1.35,-3);g.add(p);}
    this.port.root.add(g);
  }
  tick(dt) {this.accum+=dt;if(this.accum<.25)return;this.accum=0;this.draw();}
  draw() {
    const e=this.world.state.economy,w=this.world;
    const save=w.error?(w.remote?'Shared world disconnected':'SAVE FAILED'):w.saving?'Saving...':w.remote?'Saved to shared world':w.offline?'Offline solo - saved locally':'Saved locally';
    this.purse.textContent=`${e.marks.toLocaleString()} marks · ${(e.marks/4).toLocaleString()} cr · ${save}`;
    this.purse.style.borderColor=w.error?'#ff6351':'#ae8548';
    const p=this.port.site.toLocal(this.walker.worldPos);
    this.deliveryQuest=QUESTS.find(q=>e.quests[q.id]?.status==='active'&&Math.hypot(p.x-q.target.x,p.z-q.target.z)<q.target.radius);
    const q=this.deliveryQuest;
    this.deliver.style.display=q&&!this.ship.aboard&&Math.abs(p.y)<2?'block':'none';
    if(q)this.deliver.textContent=`Deliver ${q.tonnes} tonne · receive ${q.rewardMarks} marks`;
    this.panel.style.display=this.open?'block':'none';if(!this.open)return;
    this.panel.innerHTML=`<b>Ship account · Mars marks</b><p>${e.marks} marks (${e.marks/4} credits)<br>4 marks = 1 credit<br>${save}${w.error?': '+w.error:''}</p>`+
      `<p>Supplies · ${inventoryMass(e.inventory)} kg<br>${Object.entries(e.inventory).map(([k,n])=>`${GOODS[k].name}: ${n}`).join('<br>')}</p>`+
      `<p>Crew wages per Mars sol (${(88775.244/3600).toFixed(2)} hours)<br>${Object.entries(e.crew).map(([id,c])=>`${id}: ${WAGES[id]*4} marks · ${c.unpaid?'UNPAID: leaves at next port':Math.max(0,(c.nextPay-e.elapsedSeconds)/3600).toFixed(1)+' h until due'}`).join('<br>')||'No crew hired.'}</p>`+
      QUESTS.map(q=>`<p>${q.title}<br>${e.quests[q.id]?.status==='active'?`Accepted · bay ${Math.round(Math.hypot(p.x-q.target.x,p.z-q.target.z))} m away`:e.quests[q.id]?.status==='complete'?'Complete · paid':'Ask the tower watch supervisor for work.'}</p>`).join('')+`<button>Close</button>`;
  }
}
