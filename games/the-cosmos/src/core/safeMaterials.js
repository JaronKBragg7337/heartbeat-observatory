import * as THREE from 'three';

// GLSL ES 1.00 built-ins with small terrain cut-outs. No fragment-depth or
// shield effects, normal maps, environment maps or render targets.
export function safeMaterials(scene, cache, maxTextureSize = 256) {
  scene.traverse(o=>{
    if(o.isPointLight||o.isSpotLight)o.visible=false;
    o.castShadow=false;o.receiveShadow=false;
    if(!o.material)return;
    const convert=m=>{
      if(m.userData?.safeGraphics)return m;
      if(cache.has(m))return cache.get(m);
      let map=m.map;
      const img=map?.image;
      if(!img?.data&&(img?.width>maxTextureSize||img?.height>maxTextureSize)){
        const c=document.createElement('canvas'),scale=maxTextureSize/Math.max(img.width,img.height);c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));
        try{c.getContext('2d').drawImage(img,0,0,c.width,c.height);map=new THREE.CanvasTexture(c);map.colorSpace=m.map.colorSpace;map.wrapS=m.map.wrapS;map.wrapT=m.map.wrapT;map.repeat.copy(m.map.repeat);}catch{map=null;}
      }
      const basic=o.isSprite||o.isPoints||o.isLine||m.isShaderMaterial||m.isMeshBasicMaterial;
      const opts={color:m.color?.clone()||new THREE.Color(0xb6aca0),map,vertexColors:!!m.vertexColors,side:m.side,transparent:m.transparent,opacity:m.opacity,depthTest:m.depthTest,depthWrite:m.depthWrite,alphaTest:m.alphaTest||0,clippingPlanes:m.clippingPlanes,clipIntersection:m.clipIntersection};
      const n=o.isSprite?new THREE.SpriteMaterial(opts):o.isPoints?new THREE.PointsMaterial({...opts,size:m.size||1}):o.isLine?new THREE.LineBasicMaterial(opts):basic?new THREE.MeshBasicMaterial(opts):new THREE.MeshLambertMaterial({...opts,emissive:m.emissive?.clone()||new THREE.Color(0)});
      const tier=m.userData.safeTier,cover=m.userData.safeCover;
      if(tier||cover){n.onBeforeCompile=shader=>{
        if(tier){Object.assign(shader.uniforms,tier);shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vTierPos;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTierPos=position;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
          varying vec3 vTierPos;uniform vec3 uTierOffset,uTierEast,uTierNorth,uTierUp,uTierPlane;uniform float uTierHalf;`).replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
          vec3 tp=vTierPos+uTierOffset;float ts=uTierPlane.z/(uTierPlane.z+dot(tp,uTierUp));
          if(abs((dot(tp,uTierEast)+uTierPlane.x)*ts-uTierPlane.x)<uTierHalf&&abs((dot(tp,uTierNorth)+uTierPlane.y)*ts-uTierPlane.y)<uTierHalf)discard;`);}
        if(cover){Object.assign(shader.uniforms,cover.grid.shared,{uCoverOffset:cover.offset});shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCoverPos;uniform vec3 uCoverOffset;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCoverPos=position+uCoverOffset;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
          varying vec3 vCoverPos;uniform sampler2D uCover;uniform float uCoverOn,uCoverBrick,uCoverShrink;`).replace('void main() {',`void main() {
          vec3 cg=vCoverPos/uCoverBrick;
          if(uCoverOn>0.5&&all(greaterThanEqual(cg,vec3(0.0)))&&all(lessThan(cg,vec3(64.0)))){
            vec3 cell=floor(cg),cf=fract(cg);vec2 uv=(vec2(mod(cell.z,8.0)*64.0+cell.x,floor(cell.z/8.0)*64.0+cell.y)+0.5)/512.0;
            float cv=floor(texture2D(uCover,uv).r*255.0+0.5);
            if(mod(cv,2.0)>0.5){bool keep=(mod(floor(cv/2.0),2.0)>0.5&&cf.x<uCoverShrink)||(mod(floor(cv/4.0),2.0)>0.5&&cf.x>1.0-uCoverShrink)||(mod(floor(cv/8.0),2.0)>0.5&&cf.y<uCoverShrink)||(mod(floor(cv/16.0),2.0)>0.5&&cf.y>1.0-uCoverShrink)||(mod(floor(cv/32.0),2.0)>0.5&&cf.z<uCoverShrink)||(mod(floor(cv/64.0),2.0)>0.5&&cf.z>1.0-uCoverShrink);if(!keep)discard;}
          }`);}
      };n.customProgramCacheKey=()=>`safe-v1:${!!tier}:${!!cover}`;}
      if(m.uniforms)n.uniforms=m.uniforms;
      n.userData.safeGraphics=true;cache.set(m,n);return n;
    };
    o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);
  });
}
