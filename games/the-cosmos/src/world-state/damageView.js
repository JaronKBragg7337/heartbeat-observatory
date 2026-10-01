import * as THREE from 'three';
// Durable shot scars. Weapons still own their transient flashes and dust.
export class DamageView {
  constructor(world,engine) {this.world=world;this.engine=engine;this.revision=-1;this.accum=0;this.pool=[];
    this.geo=new THREE.CircleGeometry(.65,12);this.mat=new THREE.MeshBasicMaterial({color:0x23150e,transparent:true,opacity:.65,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});}
  tick(dt,position) {
    this.accum+=dt;if(this.accum<.5)return;this.accum=0;
    const near=Object.values(this.world.state.damage).filter(d=>d.position&&Math.hypot(d.position.x-position.x,d.position.y-position.y,d.position.z-position.z)<90).slice(-64);
    for(let i=0;i<near.length;i++) {
      if(!this.pool[i]) {
        const mesh=new THREE.Mesh(this.geo,this.mat);this.engine.scene.add(mesh);
        this.pool.push({mesh,entry:this.engine.track({worldPos:{x:0,y:0,z:0},object3d:mesh,quaternion:new THREE.Quaternion()})});
      }
      const p=this.pool[i],d=near[i],up=new THREE.Vector3(d.up.x,d.up.y,d.up.z).normalize();
      p.entry.worldPos={x:d.position.x+up.x*.025,y:d.position.y+up.y*.025,z:d.position.z+up.z*.025};
      p.entry.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),up);p.mesh.visible=true;
    }
    for(let i=near.length;i<this.pool.length;i++)this.pool[i].mesh.visible=false;
  }
}
