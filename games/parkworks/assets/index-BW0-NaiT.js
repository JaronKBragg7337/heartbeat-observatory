(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=1e3,t=1001,n=1002,r=1003,i=1004,a=1005,o=1006,s=1007,c=1008,l=1009,u=1010,d=1011,f=1012,p=1013,m=1014,h=1015,g=1016,_=1017,v=1018,y=1020,b=35902,x=35899,S=1021,C=1022,w=1023,T=1026,E=1027,D=1028,ee=1029,O=1030,k=1031,te=1033,A=33776,j=33777,ne=33778,re=33779,M=35840,ie=35841,ae=35842,oe=35843,se=36196,ce=37492,le=37496,ue=37488,N=37489,de=37490,fe=37491,pe=37808,me=37809,he=37810,ge=37811,_e=37812,ve=37813,ye=37814,be=37815,xe=37816,Se=37817,Ce=37818,we=37819,Te=37820,Ee=37821,De=36492,Oe=36494,ke=36495,Ae=36283,je=36284,Me=36285,Ne=36286,Pe=2300,P=2301,Fe=2302,Ie=2303,Le=2400,F=2401,Re=2402,I=3200,ze=`srgb`,L=`srgb-linear`,Be=`linear`,Ve=`srgb`,He=7680,Ue=35044,We=2e3;function Ge(e){for(let t=e.length-1;t>=0;--t)if(e[t]>=65535)return!0;return!1}function Ke(e){return ArrayBuffer.isView(e)&&!(e instanceof DataView)}function qe(e){return document.createElementNS(`http://www.w3.org/1999/xhtml`,e)}function Je(){let e=qe(`canvas`);return e.style.display=`block`,e}var Ye={};function Xe(...e){let t=`THREE.`+e.shift();console.log(t,...e)}function Ze(e){let t=e[0];if(typeof t==`string`&&t.startsWith(`TSL:`)){let t=e[1];t&&t.isStackTrace?e[0]+=` `+t.getLocation():e[1]=`Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.`}return e}function R(...e){e=Ze(e);let t=`THREE.`+e.shift();{let n=e[0];n&&n.isStackTrace?console.warn(n.getError(t)):console.warn(t,...e)}}function z(...e){e=Ze(e);let t=`THREE.`+e.shift();{let n=e[0];n&&n.isStackTrace?console.error(n.getError(t)):console.error(t,...e)}}function Qe(...e){let t=e.join(` `);t in Ye||(Ye[t]=!0,R(...e))}function $e(e,t,n){return new Promise(function(r,i){function a(){switch(e.clientWaitSync(t,e.SYNC_FLUSH_COMMANDS_BIT,0)){case e.WAIT_FAILED:i();break;case e.TIMEOUT_EXPIRED:setTimeout(a,n);break;default:r()}}setTimeout(a,n)})}var et={0:1,2:6,4:7,3:5,1:0,6:2,7:4,5:3},tt=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){let n=this._listeners;return n!==void 0&&n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let r=n[e];if(r!==void 0){let e=r.indexOf(t);e!==-1&&r.splice(e,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let t=n.slice(0);for(let n=0,r=t.length;n<r;n++)t[n].call(this,e);e.target=null}}},nt=`00.01.02.03.04.05.06.07.08.09.0a.0b.0c.0d.0e.0f.10.11.12.13.14.15.16.17.18.19.1a.1b.1c.1d.1e.1f.20.21.22.23.24.25.26.27.28.29.2a.2b.2c.2d.2e.2f.30.31.32.33.34.35.36.37.38.39.3a.3b.3c.3d.3e.3f.40.41.42.43.44.45.46.47.48.49.4a.4b.4c.4d.4e.4f.50.51.52.53.54.55.56.57.58.59.5a.5b.5c.5d.5e.5f.60.61.62.63.64.65.66.67.68.69.6a.6b.6c.6d.6e.6f.70.71.72.73.74.75.76.77.78.79.7a.7b.7c.7d.7e.7f.80.81.82.83.84.85.86.87.88.89.8a.8b.8c.8d.8e.8f.90.91.92.93.94.95.96.97.98.99.9a.9b.9c.9d.9e.9f.a0.a1.a2.a3.a4.a5.a6.a7.a8.a9.aa.ab.ac.ad.ae.af.b0.b1.b2.b3.b4.b5.b6.b7.b8.b9.ba.bb.bc.bd.be.bf.c0.c1.c2.c3.c4.c5.c6.c7.c8.c9.ca.cb.cc.cd.ce.cf.d0.d1.d2.d3.d4.d5.d6.d7.d8.d9.da.db.dc.dd.de.df.e0.e1.e2.e3.e4.e5.e6.e7.e8.e9.ea.eb.ec.ed.ee.ef.f0.f1.f2.f3.f4.f5.f6.f7.f8.f9.fa.fb.fc.fd.fe.ff`.split(`.`),rt=1234567,it=Math.PI/180,at=180/Math.PI;function ot(){let e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0,r=Math.random()*4294967295|0;return(nt[e&255]+nt[e>>8&255]+nt[e>>16&255]+nt[e>>24&255]+`-`+nt[t&255]+nt[t>>8&255]+`-`+nt[t>>16&15|64]+nt[t>>24&255]+`-`+nt[n&63|128]+nt[n>>8&255]+`-`+nt[n>>16&255]+nt[n>>24&255]+nt[r&255]+nt[r>>8&255]+nt[r>>16&255]+nt[r>>24&255]).toLowerCase()}function B(e,t,n){return Math.max(t,Math.min(n,e))}function st(e,t){return(e%t+t)%t}function ct(e,t,n,r,i){return r+(e-t)*(i-r)/(n-t)}function lt(e,t,n){return e===t?0:(n-e)/(t-e)}function ut(e,t,n){return(1-n)*e+n*t}function dt(e,t,n,r){return ut(e,t,1-Math.exp(-n*r))}function ft(e,t=1){return t-Math.abs(st(e,t*2)-t)}function pt(e,t,n){return e<=t?0:e>=n?1:(e=(e-t)/(n-t),e*e*(3-2*e))}function mt(e,t,n){return e<=t?0:e>=n?1:(e=(e-t)/(n-t),e*e*e*(e*(e*6-15)+10))}function ht(e,t){return e+Math.floor(Math.random()*(t-e+1))}function gt(e,t){return e+Math.random()*(t-e)}function _t(e){return e*(.5-Math.random())}function vt(e){e!==void 0&&(rt=e);let t=rt+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function yt(e){return e*it}function bt(e){return e*at}function xt(e){return!(e&e-1)&&e!==0}function St(e){return 2**Math.ceil(Math.log(e)/Math.LN2)}function Ct(e){return 2**Math.floor(Math.log(e)/Math.LN2)}function wt(e,t,n,r,i){let a=Math.cos,o=Math.sin,s=a(n/2),c=o(n/2),l=a((t+r)/2),u=o((t+r)/2),d=a((t-r)/2),f=o((t-r)/2),p=a((r-t)/2),m=o((r-t)/2);switch(i){case`XYX`:e.set(s*u,c*d,c*f,s*l);break;case`YZY`:e.set(c*f,s*u,c*d,s*l);break;case`ZXZ`:e.set(c*d,c*f,s*u,s*l);break;case`XZX`:e.set(s*u,c*m,c*p,s*l);break;case`YXY`:e.set(c*p,s*u,c*m,s*l);break;case`ZYZ`:e.set(c*m,c*p,s*u,s*l);break;default:R(`MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: `+i)}}function Tt(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return e/4294967295;case Uint16Array:return e/65535;case Uint8Array:return e/255;case Int32Array:return Math.max(e/2147483647,-1);case Int16Array:return Math.max(e/32767,-1);case Int8Array:return Math.max(e/127,-1);default:throw Error(`THREE.MathUtils: Invalid component type.`)}}function Et(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return Math.round(e*4294967295);case Uint16Array:return Math.round(e*65535);case Uint8Array:return Math.round(e*255);case Int32Array:return Math.round(e*2147483647);case Int16Array:return Math.round(e*32767);case Int8Array:return Math.round(e*127);default:throw Error(`THREE.MathUtils: Invalid component type.`)}}var Dt={DEG2RAD:it,RAD2DEG:at,generateUUID:ot,clamp:B,euclideanModulo:st,mapLinear:ct,inverseLerp:lt,lerp:ut,damp:dt,pingpong:ft,smoothstep:pt,smootherstep:mt,randInt:ht,randFloat:gt,randFloatSpread:_t,seededRandom:vt,degToRad:yt,radToDeg:bt,isPowerOfTwo:xt,ceilPowerOfTwo:St,floorPowerOfTwo:Ct,setQuaternionFromProperEuler:wt,normalize:Et,denormalize:Tt},V=class e{static{e.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw Error(`THREE.Vector2: index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw Error(`THREE.Vector2: index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6],this.y=r[1]*t+r[4]*n+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=B(this.x,e.x,t.x),this.y=B(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=B(this.x,e,t),this.y=B(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(B(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(B(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),r=Math.sin(t),i=this.x-e.x,a=this.y-e.y;return this.x=i*n-a*r+e.x,this.y=i*r+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},Ot=class{constructor(e=0,t=0,n=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=r}static slerpFlat(e,t,n,r,i,a,o){let s=n[r+0],c=n[r+1],l=n[r+2],u=n[r+3],d=i[a+0],f=i[a+1],p=i[a+2],m=i[a+3];if(u!==m||s!==d||c!==f||l!==p){let e=s*d+c*f+l*p+u*m;e<0&&(d=-d,f=-f,p=-p,m=-m,e=-e);let t=1-o;if(e<.9995){let n=Math.acos(e),r=Math.sin(n);t=Math.sin(t*n)/r,o=Math.sin(o*n)/r,s=s*t+d*o,c=c*t+f*o,l=l*t+p*o,u=u*t+m*o}else{s=s*t+d*o,c=c*t+f*o,l=l*t+p*o,u=u*t+m*o;let e=1/Math.sqrt(s*s+c*c+l*l+u*u);s*=e,c*=e,l*=e,u*=e}}e[t]=s,e[t+1]=c,e[t+2]=l,e[t+3]=u}static multiplyQuaternionsFlat(e,t,n,r,i,a){let o=n[r],s=n[r+1],c=n[r+2],l=n[r+3],u=i[a],d=i[a+1],f=i[a+2],p=i[a+3];return e[t]=o*p+l*u+s*f-c*d,e[t+1]=s*p+l*d+c*u-o*f,e[t+2]=c*p+l*f+o*d-s*u,e[t+3]=l*p-o*u-s*d-c*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,r){return this._x=e,this._y=t,this._z=n,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,r=e._y,i=e._z,a=e._order,o=Math.cos,s=Math.sin,c=o(n/2),l=o(r/2),u=o(i/2),d=s(n/2),f=s(r/2),p=s(i/2);switch(a){case`XYZ`:this._x=d*l*u+c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u-d*f*p;break;case`YXZ`:this._x=d*l*u+c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u+d*f*p;break;case`ZXY`:this._x=d*l*u-c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u-d*f*p;break;case`ZYX`:this._x=d*l*u-c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u+d*f*p;break;case`YZX`:this._x=d*l*u+c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u-d*f*p;break;case`XZY`:this._x=d*l*u-c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u+d*f*p;break;default:R(`Quaternion: .setFromEuler() encountered an unknown order: `+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,r=Math.sin(n);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],r=t[4],i=t[8],a=t[1],o=t[5],s=t[9],c=t[2],l=t[6],u=t[10],d=n+o+u;if(d>0){let e=.5/Math.sqrt(d+1);this._w=.25/e,this._x=(l-s)*e,this._y=(i-c)*e,this._z=(a-r)*e}else if(n>o&&n>u){let e=2*Math.sqrt(1+n-o-u);this._w=(l-s)/e,this._x=.25*e,this._y=(r+a)/e,this._z=(i+c)/e}else if(o>u){let e=2*Math.sqrt(1+o-n-u);this._w=(i-c)/e,this._x=(r+a)/e,this._y=.25*e,this._z=(s+l)/e}else{let e=2*Math.sqrt(1+u-n-o);this._w=(a-r)/e,this._x=(i+c)/e,this._y=(s+l)/e,this._z=.25*e}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(B(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let r=Math.min(1,t/n);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x*=e,this._y*=e,this._z*=e,this._w*=e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,r=e._y,i=e._z,a=e._w,o=t._x,s=t._y,c=t._z,l=t._w;return this._x=n*l+a*o+r*c-i*s,this._y=r*l+a*s+i*o-n*c,this._z=i*l+a*c+n*s-r*o,this._w=a*l-n*o-r*s-i*c,this._onChangeCallback(),this}slerp(e,t){let n=e._x,r=e._y,i=e._z,a=e._w,o=this.dot(e);o<0&&(n=-n,r=-r,i=-i,a=-a,o=-o);let s=1-t;if(o<.9995){let e=Math.acos(o),c=Math.sin(e);s=Math.sin(s*e)/c,t=Math.sin(t*e)/c,this._x=this._x*s+n*t,this._y=this._y*s+r*t,this._z=this._z*s+i*t,this._w=this._w*s+a*t,this._onChangeCallback()}else this._x=this._x*s+n*t,this._y=this._y*s+r*t,this._z=this._z*s+i*t,this._w=this._w*s+a*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),r=Math.sqrt(1-n),i=Math.sqrt(n);return this.set(r*Math.sin(e),r*Math.cos(e),i*Math.sin(t),i*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},H=class e{static{e.prototype.isVector3=!0}constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw Error(`THREE.Vector3: index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw Error(`THREE.Vector3: index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(At.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(At.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,r=this.z,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6]*r,this.y=i[1]*t+i[4]*n+i[7]*r,this.z=i[2]*t+i[5]*n+i[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,i=e.elements,a=1/(i[3]*t+i[7]*n+i[11]*r+i[15]);return this.x=(i[0]*t+i[4]*n+i[8]*r+i[12])*a,this.y=(i[1]*t+i[5]*n+i[9]*r+i[13])*a,this.z=(i[2]*t+i[6]*n+i[10]*r+i[14])*a,this}applyQuaternion(e){let t=this.x,n=this.y,r=this.z,i=e.x,a=e.y,o=e.z,s=e.w,c=2*(a*r-o*n),l=2*(o*t-i*r),u=2*(i*n-a*t);return this.x=t+s*c+a*u-o*l,this.y=n+s*l+o*c-i*u,this.z=r+s*u+i*l-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,r=this.z,i=e.elements;return this.x=i[0]*t+i[4]*n+i[8]*r,this.y=i[1]*t+i[5]*n+i[9]*r,this.z=i[2]*t+i[6]*n+i[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=B(this.x,e.x,t.x),this.y=B(this.y,e.y,t.y),this.z=B(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=B(this.x,e,t),this.y=B(this.y,e,t),this.z=B(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(B(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,r=e.y,i=e.z,a=t.x,o=t.y,s=t.z;return this.x=r*s-i*o,this.y=i*a-n*s,this.z=n*o-r*a,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return kt.copy(this).projectOnVector(e),this.sub(kt)}reflect(e){return this.sub(kt.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(B(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,r=this.z-e.z;return t*t+n*n+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let r=Math.sin(t)*e;return this.x=r*Math.sin(n),this.y=Math.cos(t)*e,this.z=r*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},kt=new H,At=new Ot,U=class e{static{e.prototype.isMatrix3=!0}constructor(e,t,n,r,i,a,o,s,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,r,i,a,o,s,c)}set(e,t,n,r,i,a,o,s,c){let l=this.elements;return l[0]=e,l[1]=r,l[2]=o,l[3]=t,l[4]=i,l[5]=s,l[6]=n,l[7]=a,l[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,i=this.elements,a=n[0],o=n[3],s=n[6],c=n[1],l=n[4],u=n[7],d=n[2],f=n[5],p=n[8],m=r[0],h=r[3],g=r[6],_=r[1],v=r[4],y=r[7],b=r[2],x=r[5],S=r[8];return i[0]=a*m+o*_+s*b,i[3]=a*h+o*v+s*x,i[6]=a*g+o*y+s*S,i[1]=c*m+l*_+u*b,i[4]=c*h+l*v+u*x,i[7]=c*g+l*y+u*S,i[2]=d*m+f*_+p*b,i[5]=d*h+f*v+p*x,i[8]=d*g+f*y+p*S,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8];return t*a*l-t*o*c-n*i*l+n*o*s+r*i*c-r*a*s}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8],u=l*a-o*c,d=o*s-l*i,f=c*i-a*s,p=t*u+n*d+r*f;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let m=1/p;return e[0]=u*m,e[1]=(r*c-l*n)*m,e[2]=(o*n-r*a)*m,e[3]=d*m,e[4]=(l*t-r*s)*m,e[5]=(r*i-o*t)*m,e[6]=f*m,e[7]=(n*s-c*t)*m,e[8]=(a*t-n*i)*m,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,r,i,a,o){let s=Math.cos(i),c=Math.sin(i);return this.set(n*s,n*c,-n*(s*a+c*o)+a+e,-r*c,r*s,-r*(-c*a+s*o)+o+t,0,0,1),this}scale(e,t){return Qe(`Matrix3: .scale() is deprecated. Use .makeScale() instead.`),this.premultiply(jt.makeScale(e,t)),this}rotate(e){return Qe(`Matrix3: .rotate() is deprecated. Use .makeRotation() instead.`),this.premultiply(jt.makeRotation(-e)),this}translate(e,t){return Qe(`Matrix3: .translate() is deprecated. Use .makeTranslation() instead.`),this.premultiply(jt.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let e=0;e<9;e++)if(t[e]!==n[e])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}},jt=new U,Mt=new U().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Nt=new U().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Pt(){let e={enabled:!0,workingColorSpace:L,spaces:{},convert:function(e,t,n){return this.enabled===!1||t===n||!t||!n?e:(this.spaces[t].transfer===`srgb`&&(e.r=Ft(e.r),e.g=Ft(e.g),e.b=Ft(e.b)),this.spaces[t].primaries!==this.spaces[n].primaries&&(e.applyMatrix3(this.spaces[t].toXYZ),e.applyMatrix3(this.spaces[n].fromXYZ)),this.spaces[n].transfer===`srgb`&&(e.r=It(e.r),e.g=It(e.g),e.b=It(e.b)),e)},workingToColorSpace:function(e,t){return this.convert(e,this.workingColorSpace,t)},colorSpaceToWorking:function(e,t){return this.convert(e,t,this.workingColorSpace)},getPrimaries:function(e){return this.spaces[e].primaries},getTransfer:function(e){return e===``?Be:this.spaces[e].transfer},getToneMappingMode:function(e){return this.spaces[e].outputColorSpaceConfig.toneMappingMode||`standard`},getLuminanceCoefficients:function(e,t=this.workingColorSpace){return e.fromArray(this.spaces[t].luminanceCoefficients)},define:function(e){Object.assign(this.spaces,e)},_getMatrix:function(e,t,n){return e.copy(this.spaces[t].toXYZ).multiply(this.spaces[n].fromXYZ)},_getDrawingBufferColorSpace:function(e){return this.spaces[e].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(e=this.workingColorSpace){return this.spaces[e].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(t,n){return Qe(`ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace().`),e.workingToColorSpace(t,n)},toWorkingColorSpace:function(t,n){return Qe(`ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking().`),e.colorSpaceToWorking(t,n)}},t=[.64,.33,.3,.6,.15,.06],n=[.2126,.7152,.0722],r=[.3127,.329];return e.define({[L]:{primaries:t,whitePoint:r,transfer:Be,toXYZ:Mt,fromXYZ:Nt,luminanceCoefficients:n,workingColorSpaceConfig:{unpackColorSpace:ze},outputColorSpaceConfig:{drawingBufferColorSpace:ze}},[ze]:{primaries:t,whitePoint:r,transfer:Ve,toXYZ:Mt,fromXYZ:Nt,luminanceCoefficients:n,outputColorSpaceConfig:{drawingBufferColorSpace:ze}}}),e}var W=Pt();function Ft(e){return e<.04045?e*.0773993808:(e*.9478672986+.0521327014)**2.4}function It(e){return e<.0031308?e*12.92:1.055*e**.41666-.055}var Lt,Rt=class{static getDataURL(e,t=`image/png`){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>`u`)return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{Lt===void 0&&(Lt=qe(`canvas`)),Lt.width=e.width,Lt.height=e.height;let t=Lt.getContext(`2d`);e instanceof ImageData?t.putImageData(e,0,0):t.drawImage(e,0,0,e.width,e.height),n=Lt}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap){let t=qe(`canvas`);t.width=e.width,t.height=e.height;let n=t.getContext(`2d`);n.drawImage(e,0,0,e.width,e.height);let r=n.getImageData(0,0,e.width,e.height),i=r.data;for(let e=0;e<i.length;e++)i[e]=Ft(i[e]/255)*255;return n.putImageData(r,0,0),t}if(e.data){let t=e.data.slice(0);for(let e=0;e<t.length;e++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[e]=Math.floor(Ft(t[e]/255)*255):t[e]=Ft(t[e]);return{data:t,width:e.width,height:e.height}}return R(`ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied.`),e}},zt=0,Bt=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:zt++}),this.uuid=ot(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<`u`&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<`u`&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t===null?e.set(0,0,0):e.set(t.width,t.height,t.depth||0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e==`string`;if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:``},r=this.data;if(r!==null){let e;if(Array.isArray(r)){e=[];for(let t=0,n=r.length;t<n;t++)r[t].isDataTexture?e.push(Vt(r[t].image)):e.push(Vt(r[t]))}else e=Vt(r);n.url=e}return t||(e.images[this.uuid]=n),n}};function Vt(e){return typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap?Rt.getDataURL(e):e.data?{data:Array.from(e.data),width:e.width,height:e.height,type:e.data.constructor.name}:(R(`Texture: Unable to serialize Texture.`),{})}var Ht=0,Ut=new H,Wt=class r extends tt{constructor(e=r.DEFAULT_IMAGE,n=r.DEFAULT_MAPPING,i=t,a=t,s=o,u=c,d=w,f=l,p=r.DEFAULT_ANISOTROPY,m=``){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Ht++}),this.uuid=ot(),this.name=``,this.source=new Bt(e),this.mipmaps=[],this.mapping=n,this.channel=0,this.wrapS=i,this.wrapT=a,this.magFilter=s,this.minFilter=u,this.anisotropy=p,this.format=d,this.internalFormat=null,this.type=f,this.offset=new V(0,0),this.repeat=new V(1,1),this.center=new V(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new U,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=m,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Ut).x}get height(){return this.source.getSize(Ut).y}get depth(){return this.source.getSize(Ut).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){R(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){R(`Texture.setValues(): property '${t}' does not exist.`);continue}r&&n&&r.isVector2&&n.isVector2||r&&n&&r.isVector3&&n.isVector3||r&&n&&r.isMatrix3&&n.isMatrix3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e==`string`;if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:`Texture`,generator:`Texture.toJSON`},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:`dispose`})}transformUv(r){if(this.mapping!==300)return r;if(r.applyMatrix3(this.matrix),r.x<0||r.x>1)switch(this.wrapS){case e:r.x-=Math.floor(r.x);break;case t:r.x=r.x<0?0:1;break;case n:Math.abs(Math.floor(r.x)%2)===1?r.x=Math.ceil(r.x)-r.x:r.x-=Math.floor(r.x)}if(r.y<0||r.y>1)switch(this.wrapT){case e:r.y-=Math.floor(r.y);break;case t:r.y=r.y<0?0:1;break;case n:Math.abs(Math.floor(r.y)%2)===1?r.y=Math.ceil(r.y)-r.y:r.y-=Math.floor(r.y)}return this.flipY&&(r.y=1-r.y),r}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};Wt.DEFAULT_IMAGE=null,Wt.DEFAULT_MAPPING=300,Wt.DEFAULT_ANISOTROPY=1;var Gt=class e{static{e.prototype.isVector4=!0}constructor(e=0,t=0,n=0,r=1){this.x=e,this.y=t,this.z=n,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,r){return this.x=e,this.y=t,this.z=n,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw Error(`THREE.Vector4: index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw Error(`THREE.Vector4: index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w===void 0?1:e.w,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,i=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*r+a[12]*i,this.y=a[1]*t+a[5]*n+a[9]*r+a[13]*i,this.z=a[2]*t+a[6]*n+a[10]*r+a[14]*i,this.w=a[3]*t+a[7]*n+a[11]*r+a[15]*i,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,r,i,a=.01,o=.1,s=e.elements,c=s[0],l=s[4],u=s[8],d=s[1],f=s[5],p=s[9],m=s[2],h=s[6],g=s[10];if(Math.abs(l-d)<a&&Math.abs(u-m)<a&&Math.abs(p-h)<a){if(Math.abs(l+d)<o&&Math.abs(u+m)<o&&Math.abs(p+h)<o&&Math.abs(c+f+g-3)<o)return this.set(1,0,0,0),this;t=Math.PI;let e=(c+1)/2,s=(f+1)/2,_=(g+1)/2,v=(l+d)/4,y=(u+m)/4,b=(p+h)/4;return e>s&&e>_?e<a?(n=0,r=.707106781,i=.707106781):(n=Math.sqrt(e),r=v/n,i=y/n):s>_?s<a?(n=.707106781,r=0,i=.707106781):(r=Math.sqrt(s),n=v/r,i=b/r):_<a?(n=.707106781,r=.707106781,i=0):(i=Math.sqrt(_),n=y/i,r=b/i),this.set(n,r,i,t),this}let _=Math.sqrt((h-p)*(h-p)+(u-m)*(u-m)+(d-l)*(d-l));return Math.abs(_)<.001&&(_=1),this.x=(h-p)/_,this.y=(u-m)/_,this.z=(d-l)/_,this.w=Math.acos((c+f+g-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=B(this.x,e.x,t.x),this.y=B(this.y,e.y,t.y),this.z=B(this.z,e.z,t.z),this.w=B(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=B(this.x,e,t),this.y=B(this.y,e,t),this.z=B(this.z,e,t),this.w=B(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(B(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},Kt=class extends tt{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:o,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new Gt(0,0,e,t),this.scissorTest=!1,this.viewport=new Gt(0,0,e,t),this.textures=[];let r=new Wt({width:e,height:t,depth:n.depth}),i=n.count;for(let e=0;e<i;e++)this.textures[e]=r.clone(),this.textures[e].isRenderTargetTexture=!0,this.textures[e].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:o,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let e=0;e<this.textures.length;e++)this.textures[e].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let r=0,i=this.textures.length;r<i;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=n,this.textures[r].isData3DTexture!==!0&&(this.textures[r].isArrayTexture=this.textures[r].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let n=Object.assign({},e.textures[t].image);this.textures[t].source=new Bt(n)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:`dispose`})}},qt=class extends Kt{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},Jt=class extends Wt{constructor(e=null,n=1,i=1,a=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:n,height:i,depth:a},this.magFilter=r,this.minFilter=r,this.wrapR=t,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}},Yt=class extends Wt{constructor(e=null,n=1,i=1,a=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:n,height:i,depth:a},this.magFilter=r,this.minFilter=r,this.wrapR=t,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},Xt=class e{static{e.prototype.isMatrix4=!0}constructor(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h)}set(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h){let g=this.elements;return g[0]=e,g[4]=t,g[8]=n,g[12]=r,g[1]=i,g[5]=a,g[9]=o,g[13]=s,g[2]=c,g[6]=l,g[10]=u,g[14]=d,g[3]=f,g[7]=p,g[11]=m,g[15]=h,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new e().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,n=e.elements,r=1/Zt.setFromMatrixColumn(e,0).length(),i=1/Zt.setFromMatrixColumn(e,1).length(),a=1/Zt.setFromMatrixColumn(e,2).length();return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=0,t[4]=n[4]*i,t[5]=n[5]*i,t[6]=n[6]*i,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,r=e.y,i=e.z,a=Math.cos(n),o=Math.sin(n),s=Math.cos(r),c=Math.sin(r),l=Math.cos(i),u=Math.sin(i);if(e.order===`XYZ`){let e=a*l,n=a*u,r=o*l,i=o*u;t[0]=s*l,t[4]=-s*u,t[8]=c,t[1]=n+r*c,t[5]=e-i*c,t[9]=-o*s,t[2]=i-e*c,t[6]=r+n*c,t[10]=a*s}else if(e.order===`YXZ`){let e=s*l,n=s*u,r=c*l,i=c*u;t[0]=e+i*o,t[4]=r*o-n,t[8]=a*c,t[1]=a*u,t[5]=a*l,t[9]=-o,t[2]=n*o-r,t[6]=i+e*o,t[10]=a*s}else if(e.order===`ZXY`){let e=s*l,n=s*u,r=c*l,i=c*u;t[0]=e-i*o,t[4]=-a*u,t[8]=r+n*o,t[1]=n+r*o,t[5]=a*l,t[9]=i-e*o,t[2]=-a*c,t[6]=o,t[10]=a*s}else if(e.order===`ZYX`){let e=a*l,n=a*u,r=o*l,i=o*u;t[0]=s*l,t[4]=r*c-n,t[8]=e*c+i,t[1]=s*u,t[5]=i*c+e,t[9]=n*c-r,t[2]=-c,t[6]=o*s,t[10]=a*s}else if(e.order===`YZX`){let e=a*s,n=a*c,r=o*s,i=o*c;t[0]=s*l,t[4]=i-e*u,t[8]=r*u+n,t[1]=u,t[5]=a*l,t[9]=-o*l,t[2]=-c*l,t[6]=n*u+r,t[10]=e-i*u}else if(e.order===`XZY`){let e=a*s,n=a*c,r=o*s,i=o*c;t[0]=s*l,t[4]=-u,t[8]=c*l,t[1]=e*u+i,t[5]=a*l,t[9]=n*u-r,t[2]=r*u-n,t[6]=o*l,t[10]=i*u+e}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose($t,e,en)}lookAt(e,t,n){let r=this.elements;return rn.subVectors(e,t),rn.lengthSq()===0&&(rn.z=1),rn.normalize(),tn.crossVectors(n,rn),tn.lengthSq()===0&&(Math.abs(n.z)===1?rn.x+=1e-4:rn.z+=1e-4,rn.normalize(),tn.crossVectors(n,rn)),tn.normalize(),nn.crossVectors(rn,tn),r[0]=tn.x,r[4]=nn.x,r[8]=rn.x,r[1]=tn.y,r[5]=nn.y,r[9]=rn.y,r[2]=tn.z,r[6]=nn.z,r[10]=rn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,i=this.elements,a=n[0],o=n[4],s=n[8],c=n[12],l=n[1],u=n[5],d=n[9],f=n[13],p=n[2],m=n[6],h=n[10],g=n[14],_=n[3],v=n[7],y=n[11],b=n[15],x=r[0],S=r[4],C=r[8],w=r[12],T=r[1],E=r[5],D=r[9],ee=r[13],O=r[2],k=r[6],te=r[10],A=r[14],j=r[3],ne=r[7],re=r[11],M=r[15];return i[0]=a*x+o*T+s*O+c*j,i[4]=a*S+o*E+s*k+c*ne,i[8]=a*C+o*D+s*te+c*re,i[12]=a*w+o*ee+s*A+c*M,i[1]=l*x+u*T+d*O+f*j,i[5]=l*S+u*E+d*k+f*ne,i[9]=l*C+u*D+d*te+f*re,i[13]=l*w+u*ee+d*A+f*M,i[2]=p*x+m*T+h*O+g*j,i[6]=p*S+m*E+h*k+g*ne,i[10]=p*C+m*D+h*te+g*re,i[14]=p*w+m*ee+h*A+g*M,i[3]=_*x+v*T+y*O+b*j,i[7]=_*S+v*E+y*k+b*ne,i[11]=_*C+v*D+y*te+b*re,i[15]=_*w+v*ee+y*A+b*M,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],r=e[8],i=e[12],a=e[1],o=e[5],s=e[9],c=e[13],l=e[2],u=e[6],d=e[10],f=e[14],p=e[3],m=e[7],h=e[11],g=e[15],_=s*f-c*d,v=o*f-c*u,y=o*d-s*u,b=a*f-c*l,x=a*d-s*l,S=a*u-o*l;return t*(m*_-h*v+g*y)-n*(p*_-h*b+g*x)+r*(p*v-m*b+g*S)-i*(p*y-m*x+h*S)}determinantAffine(){let e=this.elements,t=e[0],n=e[4],r=e[8],i=e[1],a=e[5],o=e[9],s=e[2],c=e[6],l=e[10];return t*(a*l-o*c)-n*(i*l-o*s)+r*(i*c-a*s)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8],u=e[9],d=e[10],f=e[11],p=e[12],m=e[13],h=e[14],g=e[15],_=t*o-n*a,v=t*s-r*a,y=t*c-i*a,b=n*s-r*o,x=n*c-i*o,S=r*c-i*s,C=l*m-u*p,w=l*h-d*p,T=l*g-f*p,E=u*h-d*m,D=u*g-f*m,ee=d*g-f*h,O=_*ee-v*D+y*E+b*T-x*w+S*C;if(O===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let k=1/O;return e[0]=(o*ee-s*D+c*E)*k,e[1]=(r*D-n*ee-i*E)*k,e[2]=(m*S-h*x+g*b)*k,e[3]=(d*x-u*S-f*b)*k,e[4]=(s*T-a*ee-c*w)*k,e[5]=(t*ee-r*T+i*w)*k,e[6]=(h*y-p*S-g*v)*k,e[7]=(l*S-d*y+f*v)*k,e[8]=(a*D-o*T+c*C)*k,e[9]=(n*T-t*D-i*C)*k,e[10]=(p*x-m*y+g*_)*k,e[11]=(u*y-l*x-f*_)*k,e[12]=(o*w-a*E-s*C)*k,e[13]=(t*E-n*w+r*C)*k,e[14]=(m*v-p*b-h*_)*k,e[15]=(l*b-u*v+d*_)*k,this}scale(e){let t=this.elements,n=e.x,r=e.y,i=e.z;return t[0]*=n,t[4]*=r,t[8]*=i,t[1]*=n,t[5]*=r,t[9]*=i,t[2]*=n,t[6]*=r,t[10]*=i,t[3]*=n,t[7]*=r,t[11]*=i,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,r))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),r=Math.sin(t),i=1-n,a=e.x,o=e.y,s=e.z,c=i*a,l=i*o;return this.set(c*a+n,c*o-r*s,c*s+r*o,0,c*o+r*s,l*o+n,l*s-r*a,0,c*s-r*o,l*s+r*a,i*s*s+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,r,i,a){return this.set(1,n,i,0,e,1,a,0,t,r,1,0,0,0,0,1),this}compose(e,t,n){let r=this.elements,i=t._x,a=t._y,o=t._z,s=t._w,c=i+i,l=a+a,u=o+o,d=i*c,f=i*l,p=i*u,m=a*l,h=a*u,g=o*u,_=s*c,v=s*l,y=s*u,b=n.x,x=n.y,S=n.z;return r[0]=(1-(m+g))*b,r[1]=(f+y)*b,r[2]=(p-v)*b,r[3]=0,r[4]=(f-y)*x,r[5]=(1-(d+g))*x,r[6]=(h+_)*x,r[7]=0,r[8]=(p+v)*S,r[9]=(h-_)*S,r[10]=(1-(d+m))*S,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,n){let r=this.elements;e.x=r[12],e.y=r[13],e.z=r[14];let i=this.determinantAffine();if(i===0)return n.set(1,1,1),t.identity(),this;let a=Zt.set(r[0],r[1],r[2]).length(),o=Zt.set(r[4],r[5],r[6]).length(),s=Zt.set(r[8],r[9],r[10]).length();i<0&&(a=-a),Qt.copy(this);let c=1/a,l=1/o,u=1/s;return Qt.elements[0]*=c,Qt.elements[1]*=c,Qt.elements[2]*=c,Qt.elements[4]*=l,Qt.elements[5]*=l,Qt.elements[6]*=l,Qt.elements[8]*=u,Qt.elements[9]*=u,Qt.elements[10]*=u,t.setFromRotationMatrix(Qt),n.x=a,n.y=o,n.z=s,this}makePerspective(e,t,n,r,i,a,o=We,s=!1){let c=this.elements,l=2*i/(t-e),u=2*i/(n-r),d=(t+e)/(t-e),f=(n+r)/(n-r),p,m;if(s)p=i/(a-i),m=a*i/(a-i);else if(o===2e3)p=-(a+i)/(a-i),m=-2*a*i/(a-i);else if(o===2001)p=-a/(a-i),m=-a*i/(a-i);else throw Error(`THREE.Matrix4.makePerspective(): Invalid coordinate system: `+o);return c[0]=l,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=u,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=p,c[14]=m,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,r,i,a,o=We,s=!1){let c=this.elements,l=2/(t-e),u=2/(n-r),d=-(t+e)/(t-e),f=-(n+r)/(n-r),p,m;if(s)p=1/(a-i),m=a/(a-i);else if(o===2e3)p=-2/(a-i),m=-(a+i)/(a-i);else if(o===2001)p=-1/(a-i),m=-i/(a-i);else throw Error(`THREE.Matrix4.makeOrthographic(): Invalid coordinate system: `+o);return c[0]=l,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=u,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=p,c[14]=m,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let e=0;e<16;e++)if(t[e]!==n[e])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}},Zt=new H,Qt=new Xt,$t=new H(0,0,0),en=new H(1,1,1),tn=new H,nn=new H,rn=new H,an=new Xt,on=new Ot,sn=class e{constructor(t=0,n=0,r=0,i=e.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=n,this._z=r,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,r=this._order){return this._x=e,this._y=t,this._z=n,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let r=e.elements,i=r[0],a=r[4],o=r[8],s=r[1],c=r[5],l=r[9],u=r[2],d=r[6],f=r[10];switch(t){case`XYZ`:this._y=Math.asin(B(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-l,f),this._z=Math.atan2(-a,i)):(this._x=Math.atan2(d,c),this._z=0);break;case`YXZ`:this._x=Math.asin(-B(l,-1,1)),Math.abs(l)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(s,c)):(this._y=Math.atan2(-u,i),this._z=0);break;case`ZXY`:this._x=Math.asin(B(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(s,i));break;case`ZYX`:this._y=Math.asin(-B(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(s,i)):(this._x=0,this._z=Math.atan2(-a,c));break;case`YZX`:this._z=Math.asin(B(s,-1,1)),Math.abs(s)<.9999999?(this._x=Math.atan2(-l,c),this._y=Math.atan2(-u,i)):(this._x=0,this._y=Math.atan2(o,f));break;case`XZY`:this._z=Math.asin(-B(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,i)):(this._x=Math.atan2(-l,f),this._y=0);break;default:R(`Euler: .setFromRotationMatrix() encountered an unknown order: `+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return an.makeRotationFromQuaternion(e),this.setFromRotationMatrix(an,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return on.setFromEuler(this),this.setFromQuaternion(on,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};sn.DEFAULT_ORDER=`XYZ`;var cn=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return!!(this.mask&(1<<e|0))}},ln=0,un=new H,dn=new Ot,fn=new Xt,pn=new H,mn=new H,hn=new H,gn=new Ot,_n=new H(1,0,0),vn=new H(0,1,0),yn=new H(0,0,1),bn={type:`added`},xn={type:`removed`},Sn={type:`childadded`,child:null},Cn={type:`childremoved`,child:null},wn=class e extends tt{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:ln++}),this.uuid=ot(),this.name=``,this.type=`Object3D`,this.parent=null,this.children=[],this.up=e.DEFAULT_UP.clone();let t=new H,n=new sn,r=new Ot,i=new H(1,1,1);function a(){r.setFromEuler(n,!1)}function o(){n.setFromQuaternion(r,void 0,!1)}n._onChange(a),r._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:n},quaternion:{configurable:!0,enumerable:!0,value:r},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new Xt},normalMatrix:{value:new U}}),this.matrix=new Xt,this.matrixWorld=new Xt,this.matrixAutoUpdate=e.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=e.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new cn,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return dn.setFromAxisAngle(e,t),this.quaternion.multiply(dn),this}rotateOnWorldAxis(e,t){return dn.setFromAxisAngle(e,t),this.quaternion.premultiply(dn),this}rotateX(e){return this.rotateOnAxis(_n,e)}rotateY(e){return this.rotateOnAxis(vn,e)}rotateZ(e){return this.rotateOnAxis(yn,e)}translateOnAxis(e,t){return un.copy(e).applyQuaternion(this.quaternion),this.position.add(un.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(_n,e)}translateY(e){return this.translateOnAxis(vn,e)}translateZ(e){return this.translateOnAxis(yn,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(fn.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?pn.copy(e):pn.set(e,t,n);let r=this.parent;this.updateWorldMatrix(!0,!1),mn.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?fn.lookAt(mn,pn,this.up):fn.lookAt(pn,mn,this.up),this.quaternion.setFromRotationMatrix(fn),r&&(fn.extractRotation(r.matrixWorld),dn.setFromRotationMatrix(fn),this.quaternion.premultiply(dn.invert()))}add(e){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return e===this?(z(`Object3D.add: object can't be added as a child of itself.`,e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(bn),Sn.child=e,this.dispatchEvent(Sn),Sn.child=null):z(`Object3D.add: object not an instance of THREE.Object3D.`,e),this)}remove(e){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.remove(arguments[e]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(xn),Cn.child=e,this.dispatchEvent(Cn),Cn.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),fn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),fn.multiply(e.parent.matrixWorld)),e.applyMatrix4(fn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(bn),Sn.child=e,this.dispatchEvent(Sn),Sn.child=null,this}getObjectById(e){return this.getObjectByProperty(`id`,e)}getObjectByName(e){return this.getObjectByProperty(`name`,e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,r=this.children.length;n<r;n++){let r=this.children[n].getObjectByProperty(e,t);if(r!==void 0)return r}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let r=this.children;for(let i=0,a=r.length;i<a;i++)r[i].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(mn,e,hn),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(mn,gn,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,n=e.y,r=e.z,i=this.matrix.elements;i[12]+=t-i[0]*t-i[4]*n-i[8]*r,i[13]+=n-i[1]*t-i[5]*n-i[9]*r,i[14]+=r-i[2]*t-i[6]*n-i[10]*r}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){let r=this.parent;if(e===!0&&r!==null&&r.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),t===!0){let e=this.children;for(let t=0,r=e.length;t<r;t++)e[t].updateWorldMatrix(!1,!0,n)}}toJSON(e){let t=e===void 0||typeof e==`string`,n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:`Object`,generator:`Object3D.toJSON`});let r={};r.uuid=this.uuid,r.type=this.type,this.name!==``&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),this.static!==!1&&(r.static=this.static),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.pivot!==null&&(r.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(r.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(r.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(r.type=`InstancedMesh`,r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type=`BatchedMesh`,r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(e=>({...e,boundingBox:e.boundingBox?e.boundingBox.toJSON():void 0,boundingSphere:e.boundingSphere?e.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(e=>({...e})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function i(t,n){return t[n.uuid]===void 0&&(t[n.uuid]=n.toJSON(e)),n.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=i(e.geometries,this.geometry);let t=this.geometry.parameters;if(t!==void 0&&t.shapes!==void 0){let n=t.shapes;if(Array.isArray(n))for(let t=0,r=n.length;t<r;t++){let r=n[t];i(e.shapes,r)}else i(e.shapes,n)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(i(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0){if(Array.isArray(this.material)){let t=[];for(let n=0,r=this.material.length;n<r;n++)t.push(i(e.materials,this.material[n]));r.material=t}else r.material=i(e.materials,this.material)}if(this.children.length>0){r.children=[];for(let t=0;t<this.children.length;t++)r.children.push(this.children[t].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let t=0;t<this.animations.length;t++){let n=this.animations[t];r.animations.push(i(e.animations,n))}}if(t){let t=a(e.geometries),r=a(e.materials),i=a(e.textures),o=a(e.images),s=a(e.shapes),c=a(e.skeletons),l=a(e.animations),u=a(e.nodes);t.length>0&&(n.geometries=t),r.length>0&&(n.materials=r),i.length>0&&(n.textures=i),o.length>0&&(n.images=o),s.length>0&&(n.shapes=s),c.length>0&&(n.skeletons=c),l.length>0&&(n.animations=l),u.length>0&&(n.nodes=u)}return n.object=r,n;function a(e){let t=[];for(let n in e){let r=e[n];delete r.metadata,t.push(r)}return t}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot===null?null:e.pivot.clone(),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let t=0;t<e.children.length;t++){let n=e.children[t];this.add(n.clone())}return this}};wn.DEFAULT_UP=new H(0,1,0),wn.DEFAULT_MATRIX_AUTO_UPDATE=!0,wn.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Tn=class extends wn{constructor(){super(),this.isGroup=!0,this.type=`Group`}},En={type:`move`},Dn=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Tn,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Tn,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new H,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new H),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Tn,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new H,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new H,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:`connected`,data:e}),this}disconnect(e){return this.dispatchEvent({type:`disconnected`,data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let r=null,i=null,a=null,o=this._targetRay,s=this._grip,c=this._hand;if(e&&t.session.visibilityState!==`visible-blurred`){if(c&&e.hand){a=!0;for(let r of e.hand.values()){let e=t.getJointPose(r,n),i=this._getHandJoint(c,r);e!==null&&(i.matrix.fromArray(e.transform.matrix),i.matrix.decompose(i.position,i.rotation,i.scale),i.matrixWorldNeedsUpdate=!0,i.jointRadius=e.radius),i.visible=e!==null}let r=c.joints[`index-finger-tip`],i=c.joints[`thumb-tip`],o=r.position.distanceTo(i.position);c.inputState.pinching&&o>.025?(c.inputState.pinching=!1,this.dispatchEvent({type:`pinchend`,handedness:e.handedness,target:this})):!c.inputState.pinching&&o<=.015&&(c.inputState.pinching=!0,this.dispatchEvent({type:`pinchstart`,handedness:e.handedness,target:this}))}else s!==null&&e.gripSpace&&(i=t.getPose(e.gripSpace,n),i!==null&&(s.matrix.fromArray(i.transform.matrix),s.matrix.decompose(s.position,s.rotation,s.scale),s.matrixWorldNeedsUpdate=!0,i.linearVelocity?(s.hasLinearVelocity=!0,s.linearVelocity.copy(i.linearVelocity)):s.hasLinearVelocity=!1,i.angularVelocity?(s.hasAngularVelocity=!0,s.angularVelocity.copy(i.angularVelocity)):s.hasAngularVelocity=!1,s.eventsEnabled&&s.dispatchEvent({type:`gripUpdated`,data:e,target:this})));o!==null&&(r=t.getPose(e.targetRaySpace,n),r===null&&i!==null&&(r=i),r!==null&&(o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,r.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(r.linearVelocity)):o.hasLinearVelocity=!1,r.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(r.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(En)))}return o!==null&&(o.visible=r!==null),s!==null&&(s.visible=i!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new Tn;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},On={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},kn={h:0,s:0,l:0},An={h:0,s:0,l:0};function jn(e,t,n){return n<0&&(n+=1),n>1&&--n,n<1/6?e+(t-e)*6*n:n<1/2?t:n<2/3?e+(t-e)*6*(2/3-n):e}var G=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let t=e;t&&t.isColor?this.copy(t):typeof t==`number`?this.setHex(t):typeof t==`string`&&this.setStyle(t)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=ze){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,W.colorSpaceToWorking(this,t),this}setRGB(e,t,n,r=W.workingColorSpace){return this.r=e,this.g=t,this.b=n,W.colorSpaceToWorking(this,r),this}setHSL(e,t,n,r=W.workingColorSpace){if(e=st(e,1),t=B(t,0,1),n=B(n,0,1),t===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+t):n+t-n*t,i=2*n-r;this.r=jn(i,r,e+1/3),this.g=jn(i,r,e),this.b=jn(i,r,e-1/3)}return W.colorSpaceToWorking(this,r),this}setStyle(e,t=ze){function n(t){t!==void 0&&parseFloat(t)<1&&R(`Color: Alpha component of `+e+` will be ignored.`)}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let i,a=r[1],o=r[2];switch(a){case`rgb`:case`rgba`:if(i=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setRGB(Math.min(255,parseInt(i[1],10))/255,Math.min(255,parseInt(i[2],10))/255,Math.min(255,parseInt(i[3],10))/255,t);if(i=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setRGB(Math.min(100,parseInt(i[1],10))/100,Math.min(100,parseInt(i[2],10))/100,Math.min(100,parseInt(i[3],10))/100,t);break;case`hsl`:case`hsla`:if(i=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setHSL(parseFloat(i[1])/360,parseFloat(i[2])/100,parseFloat(i[3])/100,t);break;default:R(`Color: Unknown color model `+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let n=r[1],i=n.length;if(i===3)return this.setRGB(parseInt(n.charAt(0),16)/15,parseInt(n.charAt(1),16)/15,parseInt(n.charAt(2),16)/15,t);if(i===6)return this.setHex(parseInt(n,16),t);R(`Color: Invalid hex color `+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=ze){let n=On[e.toLowerCase()];return n===void 0?R(`Color: Unknown color `+e):this.setHex(n,t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Ft(e.r),this.g=Ft(e.g),this.b=Ft(e.b),this}copyLinearToSRGB(e){return this.r=It(e.r),this.g=It(e.g),this.b=It(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=ze){return W.workingToColorSpace(Mn.copy(this),e),Math.round(B(Mn.r*255,0,255))*65536+Math.round(B(Mn.g*255,0,255))*256+Math.round(B(Mn.b*255,0,255))}getHexString(e=ze){return(`000000`+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=W.workingColorSpace){W.workingToColorSpace(Mn.copy(this),t);let n=Mn.r,r=Mn.g,i=Mn.b,a=Math.max(n,r,i),o=Math.min(n,r,i),s,c,l=(o+a)/2;if(o===a)s=0,c=0;else{let e=a-o;switch(c=l<=.5?e/(a+o):e/(2-a-o),a){case n:s=(r-i)/e+(r<i?6:0);break;case r:s=(i-n)/e+2;break;case i:s=(n-r)/e+4}s/=6}return e.h=s,e.s=c,e.l=l,e}getRGB(e,t=W.workingColorSpace){return W.workingToColorSpace(Mn.copy(this),t),e.r=Mn.r,e.g=Mn.g,e.b=Mn.b,e}getStyle(e=ze){W.workingToColorSpace(Mn.copy(this),e);let t=Mn.r,n=Mn.g,r=Mn.b;return e===`srgb`?`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(r*255)})`:`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${r.toFixed(3)})`}offsetHSL(e,t,n){return this.getHSL(kn),this.setHSL(kn.h+e,kn.s+t,kn.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(kn),e.getHSL(An);let n=ut(kn.h,An.h,t),r=ut(kn.s,An.s,t),i=ut(kn.l,An.l,t);return this.setHSL(n,r,i),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,r=this.b,i=e.elements;return this.r=i[0]*t+i[3]*n+i[6]*r,this.g=i[1]*t+i[4]*n+i[7]*r,this.b=i[2]*t+i[5]*n+i[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Mn=new G;G.NAMES=On;var Nn=class e{constructor(e,t=25e-5){this.isFogExp2=!0,this.name=``,this.color=new G(e),this.density=t}clone(){return new e(this.color,this.density)}toJSON(){return{type:`FogExp2`,name:this.name,color:this.color.getHex(),density:this.density}}},Pn=class extends wn{constructor(){super(),this.isScene=!0,this.type=`Scene`,this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new sn,this.environmentIntensity=1,this.environmentRotation=new sn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}},Fn=new H,In=new H,Ln=new H,Rn=new H,zn=new H,Bn=new H,Vn=new H,Hn=new H,Un=new H,Wn=new H,Gn=new Gt,Kn=new Gt,qn=new Gt,Jn=class e{constructor(e=new H,t=new H,n=new H){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,r){r.subVectors(n,t),Fn.subVectors(e,t),r.cross(Fn);let i=r.lengthSq();return i>0?r.multiplyScalar(1/Math.sqrt(i)):r.set(0,0,0)}static getBarycoord(e,t,n,r,i){Fn.subVectors(r,t),In.subVectors(n,t),Ln.subVectors(e,t);let a=Fn.dot(Fn),o=Fn.dot(In),s=Fn.dot(Ln),c=In.dot(In),l=In.dot(Ln),u=a*c-o*o;if(u===0)return i.set(0,0,0),null;let d=1/u,f=(c*s-o*l)*d,p=(a*l-o*s)*d;return i.set(1-f-p,p,f)}static containsPoint(e,t,n,r){return this.getBarycoord(e,t,n,r,Rn)!==null&&Rn.x>=0&&Rn.y>=0&&Rn.x+Rn.y<=1}static getInterpolation(e,t,n,r,i,a,o,s){return this.getBarycoord(e,t,n,r,Rn)===null?(s.x=0,s.y=0,`z`in s&&(s.z=0),`w`in s&&(s.w=0),null):(s.setScalar(0),s.addScaledVector(i,Rn.x),s.addScaledVector(a,Rn.y),s.addScaledVector(o,Rn.z),s)}static getInterpolatedAttribute(e,t,n,r,i,a){return Gn.setScalar(0),Kn.setScalar(0),qn.setScalar(0),Gn.fromBufferAttribute(e,t),Kn.fromBufferAttribute(e,n),qn.fromBufferAttribute(e,r),a.setScalar(0),a.addScaledVector(Gn,i.x),a.addScaledVector(Kn,i.y),a.addScaledVector(qn,i.z),a}static isFrontFacing(e,t,n,r){return Fn.subVectors(n,t),In.subVectors(e,t),Fn.cross(In).dot(r)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,r){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,n,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Fn.subVectors(this.c,this.b),In.subVectors(this.a,this.b),Fn.cross(In).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return e.getNormal(this.a,this.b,this.c,t)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,n){return e.getBarycoord(t,this.a,this.b,this.c,n)}getInterpolation(t,n,r,i,a){return e.getInterpolation(t,this.a,this.b,this.c,n,r,i,a)}containsPoint(t){return e.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return e.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,r=this.b,i=this.c,a,o;zn.subVectors(r,n),Bn.subVectors(i,n),Hn.subVectors(e,n);let s=zn.dot(Hn),c=Bn.dot(Hn);if(s<=0&&c<=0)return t.copy(n);Un.subVectors(e,r);let l=zn.dot(Un),u=Bn.dot(Un);if(l>=0&&u<=l)return t.copy(r);let d=s*u-l*c;if(d<=0&&s>=0&&l<=0)return a=s/(s-l),t.copy(n).addScaledVector(zn,a);Wn.subVectors(e,i);let f=zn.dot(Wn),p=Bn.dot(Wn);if(p>=0&&f<=p)return t.copy(i);let m=f*c-s*p;if(m<=0&&c>=0&&p<=0)return o=c/(c-p),t.copy(n).addScaledVector(Bn,o);let h=l*p-f*u;if(h<=0&&u-l>=0&&f-p>=0)return Vn.subVectors(i,r),o=(u-l)/(u-l+(f-p)),t.copy(r).addScaledVector(Vn,o);let g=1/(h+m+d);return a=m*g,o=d*g,t.copy(n).addScaledVector(zn,a).addScaledVector(Bn,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},Yn=class{constructor(e=new H(1/0,1/0,1/0),t=new H(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Zn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Zn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=Zn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let r=n.getAttribute(`position`);if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let t=0,n=r.count;t<n;t++)e.isMesh===!0?e.getVertexPosition(t,Zn):Zn.fromBufferAttribute(r,t),Zn.applyMatrix4(e.matrixWorld),this.expandByPoint(Zn);else e.boundingBox===void 0?(n.boundingBox===null&&n.computeBoundingBox(),Qn.copy(n.boundingBox)):(e.boundingBox===null&&e.computeBoundingBox(),Qn.copy(e.boundingBox)),Qn.applyMatrix4(e.matrixWorld),this.union(Qn)}let r=e.children;for(let e=0,n=r.length;e<n;e++)this.expandByObject(r[e],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Zn),Zn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(ar),or.subVectors(this.max,ar),$n.subVectors(e.a,ar),er.subVectors(e.b,ar),tr.subVectors(e.c,ar),nr.subVectors(er,$n),rr.subVectors(tr,er),ir.subVectors($n,tr);let t=[0,-nr.z,nr.y,0,-rr.z,rr.y,0,-ir.z,ir.y,nr.z,0,-nr.x,rr.z,0,-rr.x,ir.z,0,-ir.x,-nr.y,nr.x,0,-rr.y,rr.x,0,-ir.y,ir.x,0];return!lr(t,$n,er,tr,or)||(t=[1,0,0,0,1,0,0,0,1],!lr(t,$n,er,tr,or))?!1:(sr.crossVectors(nr,rr),t=[sr.x,sr.y,sr.z],lr(t,$n,er,tr,or))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Zn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Zn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Xn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Xn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Xn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Xn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Xn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Xn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Xn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Xn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Xn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},Xn=[new H,new H,new H,new H,new H,new H,new H,new H],Zn=new H,Qn=new Yn,$n=new H,er=new H,tr=new H,nr=new H,rr=new H,ir=new H,ar=new H,or=new H,sr=new H,cr=new H;function lr(e,t,n,r,i){for(let a=0,o=e.length-3;a<=o;a+=3){cr.fromArray(e,a);let o=i.x*Math.abs(cr.x)+i.y*Math.abs(cr.y)+i.z*Math.abs(cr.z),s=t.dot(cr),c=n.dot(cr),l=r.dot(cr);if(Math.max(-Math.max(s,c,l),Math.min(s,c,l))>o)return!1}return!0}var ur=new H,dr=new V,fr=0,pr=class extends tt{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw TypeError(`THREE.BufferAttribute: array should be a Typed Array.`);this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:fr++}),this.name=``,this.array=e,this.itemSize=t,this.count=e===void 0?0:e.length/t,this.normalized=n,this.usage=Ue,this.updateRanges=[],this.gpuType=h,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let r=0,i=this.itemSize;r<i;r++)this.array[e+r]=t.array[n+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)dr.fromBufferAttribute(this,t),dr.applyMatrix3(e),this.setXY(t,dr.x,dr.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)ur.fromBufferAttribute(this,t),ur.applyMatrix3(e),this.setXYZ(t,ur.x,ur.y,ur.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)ur.fromBufferAttribute(this,t),ur.applyMatrix4(e),this.setXYZ(t,ur.x,ur.y,ur.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)ur.fromBufferAttribute(this,t),ur.applyNormalMatrix(e),this.setXYZ(t,ur.x,ur.y,ur.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)ur.fromBufferAttribute(this,t),ur.transformDirection(e),this.setXYZ(t,ur.x,ur.y,ur.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=Tt(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=Et(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=Tt(t,this.array)),t}setX(e,t){return this.normalized&&(t=Et(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=Tt(t,this.array)),t}setY(e,t){return this.normalized&&(t=Et(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=Tt(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Et(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=Tt(t,this.array)),t}setW(e,t){return this.normalized&&(t=Et(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=Et(t,this.array),n=Et(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,r){return e*=this.itemSize,this.normalized&&(t=Et(t,this.array),n=Et(n,this.array),r=Et(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this}setXYZW(e,t,n,r,i){return e*=this.itemSize,this.normalized&&(t=Et(t,this.array),n=Et(n,this.array),r=Et(r,this.array),i=Et(i,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this.array[e+3]=i,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==``&&(e.name=this.name),this.usage!==35044&&(e.usage=this.usage),e}dispose(){this.dispatchEvent({type:`dispose`})}},mr=class extends pr{constructor(e,t,n){super(new Uint16Array(e),t,n)}},hr=class extends pr{constructor(e,t,n){super(new Uint32Array(e),t,n)}},gr=class extends pr{constructor(e,t,n){super(new Float32Array(e),t,n)}},_r=new Yn,vr=new H,yr=new H,br=class{constructor(e=new H,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t===void 0?_r.setFromPoints(e).getCenter(n):n.copy(t);let r=0;for(let t=0,i=e.length;t<i;t++)r=Math.max(r,n.distanceToSquared(e[t]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius*=e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;vr.subVectors(e,this.center);let t=vr.lengthSq();if(t>this.radius*this.radius){let e=Math.sqrt(t),n=(e-this.radius)*.5;this.center.addScaledVector(vr,n/e),this.radius+=n}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(yr.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(vr.copy(e.center).add(yr)),this.expandByPoint(vr.copy(e.center).sub(yr))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},xr=0,Sr=new Xt,Cr=new wn,wr=new H,Tr=new Yn,Er=new Yn,Dr=new H,Or=class e extends tt{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:xr++}),this.uuid=ot(),this.name=``,this.type=`BufferGeometry`,this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return this.index=Array.isArray(e)?new(Ge(e)?hr:mr)(e,1):e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let t=new U().getNormalMatrix(e);n.applyNormalMatrix(t),n.needsUpdate=!0}let r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return Sr.makeRotationFromQuaternion(e),this.applyMatrix4(Sr),this}rotateX(e){return Sr.makeRotationX(e),this.applyMatrix4(Sr),this}rotateY(e){return Sr.makeRotationY(e),this.applyMatrix4(Sr),this}rotateZ(e){return Sr.makeRotationZ(e),this.applyMatrix4(Sr),this}translate(e,t,n){return Sr.makeTranslation(e,t,n),this.applyMatrix4(Sr),this}scale(e,t,n){return Sr.makeScale(e,t,n),this.applyMatrix4(Sr),this}lookAt(e){return Cr.lookAt(e),Cr.updateMatrix(),this.applyMatrix4(Cr.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(wr).negate(),this.translate(wr.x,wr.y,wr.z),this}setFromPoints(e){let t=this.getAttribute(`position`);if(t===void 0){let t=[];for(let n=0,r=e.length;n<r;n++){let r=e[n];t.push(r.x,r.y,r.z||0)}this.setAttribute(`position`,new gr(t,3))}else{let n=Math.min(e.length,t.count);for(let r=0;r<n;r++){let n=e[r];t.setXYZ(r,n.x,n.y,n.z||0)}e.length>t.count&&R(`BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry.`),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Yn);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){z(`BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.`,this),this.boundingBox.set(new H(-1/0,-1/0,-1/0),new H(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let e=0,n=t.length;e<n;e++){let n=t[e];Tr.setFromBufferAttribute(n),this.morphTargetsRelative?(Dr.addVectors(this.boundingBox.min,Tr.min),this.boundingBox.expandByPoint(Dr),Dr.addVectors(this.boundingBox.max,Tr.max),this.boundingBox.expandByPoint(Dr)):(this.boundingBox.expandByPoint(Tr.min),this.boundingBox.expandByPoint(Tr.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&z(`BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.`,this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new br);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){z(`BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.`,this),this.boundingSphere.set(new H,1/0);return}if(e){let n=this.boundingSphere.center;if(Tr.setFromBufferAttribute(e),t)for(let e=0,n=t.length;e<n;e++){let n=t[e];Er.setFromBufferAttribute(n),this.morphTargetsRelative?(Dr.addVectors(Tr.min,Er.min),Tr.expandByPoint(Dr),Dr.addVectors(Tr.max,Er.max),Tr.expandByPoint(Dr)):(Tr.expandByPoint(Er.min),Tr.expandByPoint(Er.max))}Tr.getCenter(n);let r=0;for(let t=0,i=e.count;t<i;t++)Dr.fromBufferAttribute(e,t),r=Math.max(r,n.distanceToSquared(Dr));if(t)for(let i=0,a=t.length;i<a;i++){let a=t[i],o=this.morphTargetsRelative;for(let t=0,i=a.count;t<i;t++)Dr.fromBufferAttribute(a,t),o&&(wr.fromBufferAttribute(e,t),Dr.add(wr)),r=Math.max(r,n.distanceToSquared(Dr))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&z(`BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.`,this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){z(`BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)`);return}let n=t.position,r=t.normal,i=t.uv,a=this.getAttribute(`tangent`);(a===void 0||a.count!==n.count)&&(a=new pr(new Float32Array(4*n.count),4),this.setAttribute(`tangent`,a));let o=[],s=[];for(let e=0;e<n.count;e++)o[e]=new H,s[e]=new H;let c=new H,l=new H,u=new H,d=new V,f=new V,p=new V,m=new H,h=new H;function g(e,t,r){c.fromBufferAttribute(n,e),l.fromBufferAttribute(n,t),u.fromBufferAttribute(n,r),d.fromBufferAttribute(i,e),f.fromBufferAttribute(i,t),p.fromBufferAttribute(i,r),l.sub(c),u.sub(c),f.sub(d),p.sub(d);let a=1/(f.x*p.y-p.x*f.y);isFinite(a)&&(m.copy(l).multiplyScalar(p.y).addScaledVector(u,-f.y).multiplyScalar(a),h.copy(u).multiplyScalar(f.x).addScaledVector(l,-p.x).multiplyScalar(a),o[e].add(m),o[t].add(m),o[r].add(m),s[e].add(h),s[t].add(h),s[r].add(h))}let _=this.groups;_.length===0&&(_=[{start:0,count:e.count}]);for(let t=0,n=_.length;t<n;++t){let n=_[t],r=n.start,i=n.count;for(let t=r,n=r+i;t<n;t+=3)g(e.getX(t+0),e.getX(t+1),e.getX(t+2))}let v=new H,y=new H,b=new H,x=new H;function S(e){b.fromBufferAttribute(r,e),x.copy(b);let t=o[e];v.copy(t),v.sub(b.multiplyScalar(b.dot(t))).normalize(),y.crossVectors(x,t);let n=y.dot(s[e])<0?-1:1;a.setXYZW(e,v.x,v.y,v.z,n)}for(let t=0,n=_.length;t<n;++t){let n=_[t],r=n.start,i=n.count;for(let t=r,n=r+i;t<n;t+=3)S(e.getX(t+0)),S(e.getX(t+1)),S(e.getX(t+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute(`position`);if(t!==void 0){let n=this.getAttribute(`normal`);if(n===void 0||n.count!==t.count)n=new pr(new Float32Array(t.count*3),3),this.setAttribute(`normal`,n);else for(let e=0,t=n.count;e<t;e++)n.setXYZ(e,0,0,0);let r=new H,i=new H,a=new H,o=new H,s=new H,c=new H,l=new H,u=new H;if(e)for(let d=0,f=e.count;d<f;d+=3){let f=e.getX(d+0),p=e.getX(d+1),m=e.getX(d+2);r.fromBufferAttribute(t,f),i.fromBufferAttribute(t,p),a.fromBufferAttribute(t,m),l.subVectors(a,i),u.subVectors(r,i),l.cross(u),o.fromBufferAttribute(n,f),s.fromBufferAttribute(n,p),c.fromBufferAttribute(n,m),o.add(l),s.add(l),c.add(l),n.setXYZ(f,o.x,o.y,o.z),n.setXYZ(p,s.x,s.y,s.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let e=0,o=t.count;e<o;e+=3)r.fromBufferAttribute(t,e+0),i.fromBufferAttribute(t,e+1),a.fromBufferAttribute(t,e+2),l.subVectors(a,i),u.subVectors(r,i),l.cross(u),n.setXYZ(e+0,l.x,l.y,l.z),n.setXYZ(e+1,l.x,l.y,l.z),n.setXYZ(e+2,l.x,l.y,l.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Dr.fromBufferAttribute(e,t),Dr.normalize(),e.setXYZ(t,Dr.x,Dr.y,Dr.z)}toNonIndexed(){function t(e,t){let n=e.array,r=e.itemSize,i=e.normalized,a=new n.constructor(t.length*r),o=0,s=0;for(let i=0,c=t.length;i<c;i++){o=e.isInterleavedBufferAttribute?t[i]*e.data.stride+e.offset:t[i]*r;for(let e=0;e<r;e++)a[s++]=n[o++]}return new pr(a,r,i)}if(this.index===null)return R(`BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed.`),this;let n=new e,r=this.index.array,i=this.attributes;for(let e in i){let a=i[e],o=t(a,r);n.setAttribute(e,o)}let a=this.morphAttributes;for(let e in a){let i=[],o=a[e];for(let e=0,n=o.length;e<n;e++){let n=o[e],a=t(n,r);i.push(a)}n.morphAttributes[e]=i}n.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let e=0,t=o.length;e<t;e++){let t=o[e];n.addGroup(t.start,t.count,t.materialIndex)}return n}toJSON(){let e={metadata:{version:4.7,type:`BufferGeometry`,generator:`BufferGeometry.toJSON`}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?`BufferGeometry`:this.type,this.name!==``&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let t=this.parameters;for(let n in t)t[n]!==void 0&&(e[n]=t[n]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let t in n){let r=n[t];e.data.attributes[t]=r.toJSON(e.data)}let r={},i=!1;for(let t in this.morphAttributes){let n=this.morphAttributes[t],a=[];for(let t=0,r=n.length;t<r;t++){let r=n[t];a.push(r.toJSON(e.data))}a.length>0&&(r[t]=a,i=!0)}i&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone());let r=e.attributes;for(let e in r){let n=r[e];this.setAttribute(e,n.clone(t))}let i=e.morphAttributes;for(let e in i){let n=[],r=i[e];for(let e=0,i=r.length;e<i;e++)n.push(r[e].clone(t));this.morphAttributes[e]=n}this.morphTargetsRelative=e.morphTargetsRelative;let a=e.groups;for(let e=0,t=a.length;e<t;e++){let t=a[e];this.addGroup(t.start,t.count,t.materialIndex)}let o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());let s=e.boundingSphere;return s!==null&&(this.boundingSphere=s.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:`dispose`})}},kr=0,Ar=class extends tt{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:kr++}),this.uuid=ot(),this.name=``,this.type=`Material`,this.blending=1,this.side=0,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=204,this.blendDst=205,this.blendEquation=100,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new G(0,0,0),this.blendAlpha=0,this.depthFunc=3,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=519,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=He,this.stencilZFail=He,this.stencilZPass=He,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){R(`Material: parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){R(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(n):r&&r.isVector2&&n&&n.isVector2||r&&r.isEuler&&n&&n.isEuler||r&&r.isVector3&&n&&n.isVector3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e==`string`;t&&(e={textures:{},images:{}});let n={metadata:{version:4.7,type:`Material`,generator:`Material.toJSON`}};n.uuid=this.uuid,n.type=this.type,this.name!==``&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==1&&(n.blending=this.blending),this.side!==0&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==204&&(n.blendSrc=this.blendSrc),this.blendDst!==205&&(n.blendDst=this.blendDst),this.blendEquation!==100&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==3&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==519&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==7680&&(n.stencilFail=this.stencilFail),this.stencilZFail!==7680&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==7680&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.allowOverride===!1&&(n.allowOverride=!1),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==`round`&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==`round`&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function r(e){let t=[];for(let n in e){let r=e[n];delete r.metadata,t.push(r)}return t}if(t){let t=r(e.textures),i=r(e.images);t.length>0&&(n.textures=t),i.length>0&&(n.images=i)}return n}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new G().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(this.vertexColors=typeof e.vertexColors==`number`?e.vertexColors>0:e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let t=e.normalScale;Array.isArray(t)===!1&&(t=[t,t]),this.normalScale=new V().fromArray(t)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new V().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let e=t.length;n=Array(e);for(let r=0;r!==e;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:`dispose`})}set needsUpdate(e){e===!0&&this.version++}},jr=new H,Mr=new H,Nr=new H,Pr=new H,Fr=new H,Ir=new H,Lr=new H,Rr=class{constructor(e=new H,t=new H(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,jr)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=jr.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(jr.copy(this.origin).addScaledVector(this.direction,t),jr.distanceToSquared(e))}distanceSqToSegment(e,t,n,r){Mr.copy(e).add(t).multiplyScalar(.5),Nr.copy(t).sub(e).normalize(),Pr.copy(this.origin).sub(Mr);let i=e.distanceTo(t)*.5,a=-this.direction.dot(Nr),o=Pr.dot(this.direction),s=-Pr.dot(Nr),c=Pr.lengthSq(),l=Math.abs(1-a*a),u,d,f,p;if(l>0){if(u=a*s-o,d=a*o-s,p=i*l,u>=0){if(d>=-p){if(d<=p){let e=1/l;u*=e,d*=e,f=u*(u+a*d+2*o)+d*(a*u+d+2*s)+c}else d=i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c}else d=-i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c}else d<=-p?(u=Math.max(0,-(-a*i+o)),d=u>0?-i:Math.min(Math.max(-i,-s),i),f=-u*u+d*(d+2*s)+c):d<=p?(u=0,d=Math.min(Math.max(-i,-s),i),f=d*(d+2*s)+c):(u=Math.max(0,-(a*i+o)),d=u>0?i:Math.min(Math.max(-i,-s),i),f=-u*u+d*(d+2*s)+c)}else d=a>0?-i:i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),r&&r.copy(Mr).addScaledVector(Nr,d),f}intersectSphere(e,t){jr.subVectors(e.center,this.origin);let n=jr.dot(this.direction),r=jr.dot(jr)-n*n,i=e.radius*e.radius;if(r>i)return null;let a=Math.sqrt(i-r),o=n-a,s=n+a;return s<0?null:o<0?this.at(s,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,r,i,a,o,s,c=1/this.direction.x,l=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(e.min.x-d.x)*c,r=(e.max.x-d.x)*c):(n=(e.max.x-d.x)*c,r=(e.min.x-d.x)*c),l>=0?(i=(e.min.y-d.y)*l,a=(e.max.y-d.y)*l):(i=(e.max.y-d.y)*l,a=(e.min.y-d.y)*l),n>a||i>r||((i>n||isNaN(n))&&(n=i),(a<r||isNaN(r))&&(r=a),u>=0?(o=(e.min.z-d.z)*u,s=(e.max.z-d.z)*u):(o=(e.max.z-d.z)*u,s=(e.min.z-d.z)*u),n>s||o>r)||((o>n||n!==n)&&(n=o),(s<r||r!==r)&&(r=s),r<0)?null:this.at(n>=0?n:r,t)}intersectsBox(e){return this.intersectBox(e,jr)!==null}intersectTriangle(e,t,n,r,i){Fr.subVectors(t,e),Ir.subVectors(n,e),Lr.crossVectors(Fr,Ir);let a=this.direction.dot(Lr),o;if(a>0){if(r)return null;o=1}else if(a<0)o=-1,a=-a;else return null;Pr.subVectors(this.origin,e);let s=o*this.direction.dot(Ir.crossVectors(Pr,Ir));if(s<0)return null;let c=o*this.direction.dot(Fr.cross(Pr));if(c<0||s+c>a)return null;let l=-o*Pr.dot(Lr);return l<0?null:this.at(l/a,i)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},zr=class extends Ar{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type=`MeshBasicMaterial`,this.color=new G(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new sn,this.combine=0,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap=`round`,this.wireframeLinejoin=`round`,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},Br=new Xt,Vr=new Rr,Hr=new br,Ur=new H,Wr=new H,Gr=new H,Kr=new H,qr=new H,Jr=new H,Yr=new H,Xr=new H,K=class extends wn{constructor(e=new Or,t=new zr){super(),this.isMesh=!0,this.type=`Mesh`,this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let e=0,t=n.length;e<t;e++){let t=n[e].name||String(e);this.morphTargetInfluences.push(0),this.morphTargetDictionary[t]=e}}}}getVertexPosition(e,t){let n=this.geometry,r=n.attributes.position,i=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(r,e);let o=this.morphTargetInfluences;if(i&&o){Jr.set(0,0,0);for(let n=0,r=i.length;n<r;n++){let r=o[n],s=i[n];r!==0&&(qr.fromBufferAttribute(s,e),a?Jr.addScaledVector(qr,r):Jr.addScaledVector(qr.sub(t),r))}t.add(Jr)}return t}raycast(e,t){let n=this.geometry,r=this.material,i=this.matrixWorld;r!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Hr.copy(n.boundingSphere),Hr.applyMatrix4(i),Vr.copy(e.ray).recast(e.near),!(Hr.containsPoint(Vr.origin)===!1&&(Vr.intersectSphere(Hr,Ur)===null||Vr.origin.distanceToSquared(Ur)>(e.far-e.near)**2))&&(Br.copy(i).invert(),Vr.copy(e.ray).applyMatrix4(Br),(n.boundingBox===null||Vr.intersectsBox(n.boundingBox)!==!1)&&this._computeIntersections(e,t,Vr)))}_computeIntersections(e,t,n){let r,i=this.geometry,a=this.material,o=i.index,s=i.attributes.position,c=i.attributes.uv,l=i.attributes.uv1,u=i.attributes.normal,d=i.groups,f=i.drawRange;if(o!==null){if(Array.isArray(a))for(let i=0,s=d.length;i<s;i++){let s=d[i],p=a[s.materialIndex],m=Math.max(s.start,f.start),h=Math.min(o.count,Math.min(s.start+s.count,f.start+f.count));for(let i=m,a=h;i<a;i+=3){let a=o.getX(i),d=o.getX(i+1),f=o.getX(i+2);r=Qr(this,p,e,n,c,l,u,a,d,f),r&&(r.faceIndex=Math.floor(i/3),r.face.materialIndex=s.materialIndex,t.push(r))}}else{let i=Math.max(0,f.start),s=Math.min(o.count,f.start+f.count);for(let d=i,f=s;d<f;d+=3){let i=o.getX(d),s=o.getX(d+1),f=o.getX(d+2);r=Qr(this,a,e,n,c,l,u,i,s,f),r&&(r.faceIndex=Math.floor(d/3),t.push(r))}}}else if(s!==void 0){if(Array.isArray(a))for(let i=0,o=d.length;i<o;i++){let o=d[i],p=a[o.materialIndex],m=Math.max(o.start,f.start),h=Math.min(s.count,Math.min(o.start+o.count,f.start+f.count));for(let i=m,a=h;i<a;i+=3){let a=i,s=i+1,d=i+2;r=Qr(this,p,e,n,c,l,u,a,s,d),r&&(r.faceIndex=Math.floor(i/3),r.face.materialIndex=o.materialIndex,t.push(r))}}else{let i=Math.max(0,f.start),o=Math.min(s.count,f.start+f.count);for(let s=i,d=o;s<d;s+=3){let i=s,o=s+1,d=s+2;r=Qr(this,a,e,n,c,l,u,i,o,d),r&&(r.faceIndex=Math.floor(s/3),t.push(r))}}}}};function Zr(e,t,n,r,i,a,o,s){let c;if(c=t.side===1?r.intersectTriangle(o,a,i,!0,s):r.intersectTriangle(i,a,o,t.side===0,s),c===null)return null;Xr.copy(s),Xr.applyMatrix4(e.matrixWorld);let l=n.ray.origin.distanceTo(Xr);return l<n.near||l>n.far?null:{distance:l,point:Xr.clone(),object:e}}function Qr(e,t,n,r,i,a,o,s,c,l){e.getVertexPosition(s,Wr),e.getVertexPosition(c,Gr),e.getVertexPosition(l,Kr);let u=Zr(e,t,n,r,Wr,Gr,Kr,Yr);if(u){let e=new H;Jn.getBarycoord(Yr,Wr,Gr,Kr,e),i&&(u.uv=Jn.getInterpolatedAttribute(i,s,c,l,e,new V)),a&&(u.uv1=Jn.getInterpolatedAttribute(a,s,c,l,e,new V)),o&&(u.normal=Jn.getInterpolatedAttribute(o,s,c,l,e,new H),u.normal.dot(r.direction)>0&&u.normal.multiplyScalar(-1));let t={a:s,b:c,c:l,normal:new H,materialIndex:0};Jn.getNormal(Wr,Gr,Kr,t.normal),u.face=t,u.barycoord=e}return u}var $r=class extends Wt{constructor(e=null,t=1,n=1,i,a,o,s,c,l=r,u=r,d,f){super(null,o,s,c,l,u,i,a,d,f),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},ei=class extends pr{constructor(e,t,n,r=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},ti=new Xt,ni=new Xt,ri=[],ii=new Yn,ai=new Xt,oi=new K,si=new br,ci=class extends K{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new ei(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let e=0;e<n;e++)this.setMatrixAt(e,ai)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new Yn),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,ti),ii.copy(e.boundingBox).applyMatrix4(ti),this.boundingBox.union(ii)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new br),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,ti),si.copy(e.boundingSphere).applyMatrix4(ti),this.boundingSphere.union(si)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let n=t.morphTargetInfluences,r=this.morphTexture.source.data.data,i=e*(n.length+1)+1;for(let e=0;e<n.length;e++)n[e]=r[i+e]}raycast(e,t){let n=this.matrixWorld,r=this.count;if(oi.geometry=this.geometry,oi.material=this.material,oi.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),si.copy(this.boundingSphere),si.applyMatrix4(n),e.ray.intersectsSphere(si)!==!1))for(let i=0;i<r;i++){this.getMatrixAt(i,ti),ni.multiplyMatrices(n,ti),oi.matrixWorld=ni,oi.raycast(e,ri);for(let e=0,n=ri.length;e<n;e++){let n=ri[e];n.instanceId=i,n.object=this,t.push(n)}ri.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new ei(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){let n=t.morphTargetInfluences,r=n.length+1;this.morphTexture===null&&(this.morphTexture=new $r(new Float32Array(r*this.count),r,this.count,D,h));let i=this.morphTexture.source.data.data,a=0;for(let e=0;e<n.length;e++)a+=n[e];let o=this.geometry.morphTargetsRelative?1:1-a,s=r*e;return i[s]=o,i.set(n,s+1),this}updateMorphTargets(){}dispose(){this.dispatchEvent({type:`dispose`}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},li=new H,ui=new H,di=new U,fi=class{constructor(e=new H(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,r){return this.normal.set(e,t,n),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let r=li.subVectors(n,t).cross(ui.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){let r=e.delta(li),i=this.normal.dot(r);if(i===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let a=-(e.start.dot(this.normal)+this.constant)/i;return n===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(r,a)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||di.getNormalMatrix(e),r=this.coplanarPoint(li).applyMatrix4(e),i=this.normal.applyMatrix3(n).normalize();return this.constant=-r.dot(i),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}},pi=new br,mi=new V(.5,.5),hi=new H,gi=class{constructor(e=new fi,t=new fi,n=new fi,r=new fi,i=new fi,a=new fi){this.planes=[e,t,n,r,i,a]}set(e,t,n,r,i,a){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(r),o[4].copy(i),o[5].copy(a),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=We,n=!1){let r=this.planes,i=e.elements,a=i[0],o=i[1],s=i[2],c=i[3],l=i[4],u=i[5],d=i[6],f=i[7],p=i[8],m=i[9],h=i[10],g=i[11],_=i[12],v=i[13],y=i[14],b=i[15];if(r[0].setComponents(c-a,f-l,g-p,b-_).normalize(),r[1].setComponents(c+a,f+l,g+p,b+_).normalize(),r[2].setComponents(c+o,f+u,g+m,b+v).normalize(),r[3].setComponents(c-o,f-u,g-m,b-v).normalize(),n)r[4].setComponents(s,d,h,y).normalize(),r[5].setComponents(c-s,f-d,g-h,b-y).normalize();else if(r[4].setComponents(c-s,f-d,g-h,b-y).normalize(),t===2e3)r[5].setComponents(c+s,f+d,g+h,b+y).normalize();else if(t===2001)r[5].setComponents(s,d,h,y).normalize();else throw Error(`THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: `+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),pi.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),pi.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(pi)}intersectsSprite(e){return pi.center.set(0,0,0),pi.radius=.7071067811865476+mi.distanceTo(e.center),pi.applyMatrix4(e.matrixWorld),this.intersectsSphere(pi)}intersectsSphere(e){let t=this.planes,n=e.center,r=-e.radius;for(let e=0;e<6;e++)if(t[e].distanceToPoint(n)<r)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let r=t[n];if(hi.x=r.normal.x>0?e.max.x:e.min.x,hi.y=r.normal.y>0?e.max.y:e.min.y,hi.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(hi)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}},_i=class extends Ar{constructor(e){super(),this.isLineBasicMaterial=!0,this.type=`LineBasicMaterial`,this.color=new G(16777215),this.map=null,this.linewidth=1,this.linecap=`round`,this.linejoin=`round`,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}},vi=new H,yi=new H,bi=new Xt,xi=new Rr,Si=new br,Ci=new H,wi=new H,Ti=class extends wn{constructor(e=new Or,t=new _i){super(),this.isLine=!0,this.type=`Line`,this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[0];for(let e=1,r=t.count;e<r;e++)vi.fromBufferAttribute(t,e-1),yi.fromBufferAttribute(t,e),n[e]=n[e-1],n[e]+=vi.distanceTo(yi);e.setAttribute(`lineDistance`,new gr(n,1))}else R(`Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.`);return this}raycast(e,t){let n=this.geometry,r=this.matrixWorld,i=e.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Si.copy(n.boundingSphere),Si.applyMatrix4(r),Si.radius+=i,e.ray.intersectsSphere(Si)===!1)return;bi.copy(r).invert(),xi.copy(e.ray).applyMatrix4(bi);let o=i/((this.scale.x+this.scale.y+this.scale.z)/3),s=o*o,c=this.isLineSegments?2:1,l=n.index,u=n.attributes.position;if(l!==null){let n=Math.max(0,a.start),r=Math.min(l.count,a.start+a.count);for(let i=n,a=r-1;i<a;i+=c){let n=l.getX(i),r=l.getX(i+1),a=Ei(this,e,xi,s,n,r,i);a&&t.push(a)}if(this.isLineLoop){let i=l.getX(r-1),a=l.getX(n),o=Ei(this,e,xi,s,i,a,r-1);o&&t.push(o)}}else{let n=Math.max(0,a.start),r=Math.min(u.count,a.start+a.count);for(let i=n,a=r-1;i<a;i+=c){let n=Ei(this,e,xi,s,i,i+1,i);n&&t.push(n)}if(this.isLineLoop){let i=Ei(this,e,xi,s,r-1,n,r-1);i&&t.push(i)}}}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let e=0,t=n.length;e<t;e++){let t=n[e].name||String(e);this.morphTargetInfluences.push(0),this.morphTargetDictionary[t]=e}}}}};function Ei(e,t,n,r,i,a,o){let s=e.geometry.attributes.position;if(vi.fromBufferAttribute(s,i),yi.fromBufferAttribute(s,a),n.distanceSqToSegment(vi,yi,Ci,wi)>r)return;Ci.applyMatrix4(e.matrixWorld);let c=t.ray.origin.distanceTo(Ci);if(!(c<t.near||c>t.far))return{distance:c,point:wi.clone().applyMatrix4(e.matrixWorld),index:o,face:null,faceIndex:null,barycoord:null,object:e}}var Di=new H,Oi=new H,ki=class extends Ti{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type=`LineSegments`}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[];for(let e=0,r=t.count;e<r;e+=2)Di.fromBufferAttribute(t,e),Oi.fromBufferAttribute(t,e+1),n[e]=e===0?0:n[e-1],n[e+1]=n[e]+Di.distanceTo(Oi);e.setAttribute(`lineDistance`,new gr(n,1))}else R(`LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.`);return this}},Ai=class extends Wt{constructor(e=[],t=301,n,r,i,a,o,s,c,l){super(e,t,n,r,i,a,o,s,c,l),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},ji=class extends Wt{constructor(e,t,n,r,i,a,o,s,c){super(e,t,n,r,i,a,o,s,c),this.isCanvasTexture=!0,this.needsUpdate=!0}},Mi=class extends Wt{constructor(e,t,n=m,i,a,o,s=r,c=r,l,u=T,d=1){if(u!==1026&&u!==1027)throw Error(`THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat`);super({width:e,height:t,depth:d},i,a,o,s,c,u,n,l),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new Bt(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}},Ni=class extends Mi{constructor(e,t=m,n=301,i,a,o=r,s=r,c,l=T){let u={width:e,height:e,depth:1},d=[u,u,u,u,u,u];super(e,e,t,n,i,a,o,s,c,l),this.image=d,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},Pi=class extends Wt{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},Fi=class e extends Or{constructor(e=1,t=1,n=1,r=1,i=1,a=1){super(),this.type=`BoxGeometry`,this.parameters={width:e,height:t,depth:n,widthSegments:r,heightSegments:i,depthSegments:a};let o=this;r=Math.floor(r),i=Math.floor(i),a=Math.floor(a);let s=[],c=[],l=[],u=[],d=0,f=0;p(`z`,`y`,`x`,-1,-1,n,t,e,a,i,0),p(`z`,`y`,`x`,1,-1,n,t,-e,a,i,1),p(`x`,`z`,`y`,1,1,e,n,t,r,a,2),p(`x`,`z`,`y`,1,-1,e,n,-t,r,a,3),p(`x`,`y`,`z`,1,-1,e,t,n,r,i,4),p(`x`,`y`,`z`,-1,-1,e,t,-n,r,i,5),this.setIndex(s),this.setAttribute(`position`,new gr(c,3)),this.setAttribute(`normal`,new gr(l,3)),this.setAttribute(`uv`,new gr(u,2));function p(e,t,n,r,i,a,p,m,h,g,_){let v=a/h,y=p/g,b=a/2,x=p/2,S=m/2,C=h+1,w=g+1,T=0,E=0,D=new H;for(let a=0;a<w;a++){let o=a*y-x;for(let s=0;s<C;s++)D[e]=(s*v-b)*r,D[t]=o*i,D[n]=S,c.push(D.x,D.y,D.z),D[e]=0,D[t]=0,D[n]=m>0?1:-1,l.push(D.x,D.y,D.z),u.push(s/h),u.push(1-a/g),T+=1}for(let e=0;e<g;e++)for(let t=0;t<h;t++){let n=d+t+C*e,r=d+t+C*(e+1),i=d+(t+1)+C*(e+1),a=d+(t+1)+C*e;s.push(n,r,a),s.push(r,i,a),E+=6}o.addGroup(f,E,_),f+=E,d+=T}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}},Ii=class e extends Or{constructor(e=1,t=1,n=1,r=32,i=1,a=!1,o=0,s=Math.PI*2){super(),this.type=`CylinderGeometry`,this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:r,heightSegments:i,openEnded:a,thetaStart:o,thetaLength:s};let c=this;r=Math.floor(r),i=Math.floor(i);let l=[],u=[],d=[],f=[],p=0,m=[],h=n/2,g=0;_(),a===!1&&(e>0&&v(!0),t>0&&v(!1)),this.setIndex(l),this.setAttribute(`position`,new gr(u,3)),this.setAttribute(`normal`,new gr(d,3)),this.setAttribute(`uv`,new gr(f,2));function _(){let a=new H,_=new H,v=0,y=(t-e)/n;for(let c=0;c<=i;c++){let l=[],g=c/i,v=g*(t-e)+e;for(let e=0;e<=r;e++){let t=e/r,i=t*s+o,c=Math.sin(i),m=Math.cos(i);_.x=v*c,_.y=-g*n+h,_.z=v*m,u.push(_.x,_.y,_.z),a.set(c,y,m).normalize(),d.push(a.x,a.y,a.z),f.push(t,1-g),l.push(p++)}m.push(l)}for(let n=0;n<r;n++)for(let r=0;r<i;r++){let a=m[r][n],o=m[r+1][n],s=m[r+1][n+1],c=m[r][n+1];(e>0||r!==0)&&(l.push(a,o,c),v+=3),(t>0||r!==i-1)&&(l.push(o,s,c),v+=3)}c.addGroup(g,v,0),g+=v}function v(n){let i=p,a=new V,m=new H,_=0,v=n===!0?e:t,y=n===!0?1:-1;for(let e=1;e<=r;e++)u.push(0,h*y,0),d.push(0,y,0),f.push(.5,.5),p++;let b=p;for(let e=0;e<=r;e++){let t=e/r*s+o,n=Math.cos(t),i=Math.sin(t);m.x=v*i,m.y=h*y,m.z=v*n,u.push(m.x,m.y,m.z),d.push(0,y,0),a.x=n*.5+.5,a.y=i*.5*y+.5,f.push(a.x,a.y),p++}for(let e=0;e<r;e++){let t=i+e,r=b+e;n===!0?l.push(r,r+1,t):l.push(r+1,r,t),_+=3}c.addGroup(g,_,n===!0?1:2),g+=_}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},Li=class e extends Ii{constructor(e=1,t=1,n=32,r=1,i=!1,a=0,o=Math.PI*2){super(0,e,t,n,r,i,a,o),this.type=`ConeGeometry`,this.parameters={radius:e,height:t,radialSegments:n,heightSegments:r,openEnded:i,thetaStart:a,thetaLength:o}}static fromJSON(t){return new e(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},Ri=class e extends Or{constructor(e=[],t=[],n=1,r=0){super(),this.type=`PolyhedronGeometry`,this.parameters={vertices:e,indices:t,radius:n,detail:r};let i=[],a=[];o(r),c(n),l(),this.setAttribute(`position`,new gr(i,3)),this.setAttribute(`normal`,new gr(i.slice(),3)),this.setAttribute(`uv`,new gr(a,2)),r===0?this.computeVertexNormals():this.normalizeNormals();function o(e){let n=new H,r=new H,i=new H;for(let a=0;a<t.length;a+=3)f(t[a+0],n),f(t[a+1],r),f(t[a+2],i),s(n,r,i,e)}function s(e,t,n,r){let i=r+1,a=[];for(let r=0;r<=i;r++){a[r]=[];let o=e.clone().lerp(n,r/i),s=t.clone().lerp(n,r/i),c=i-r;for(let e=0;e<=c;e++)e===0&&r===i?a[r][e]=o:a[r][e]=o.clone().lerp(s,e/c)}for(let e=0;e<i;e++)for(let t=0;t<2*(i-e)-1;t++){let n=Math.floor(t/2);t%2==0?(d(a[e][n+1]),d(a[e+1][n]),d(a[e][n])):(d(a[e][n+1]),d(a[e+1][n+1]),d(a[e+1][n]))}}function c(e){let t=new H;for(let n=0;n<i.length;n+=3)t.x=i[n+0],t.y=i[n+1],t.z=i[n+2],t.normalize().multiplyScalar(e),i[n+0]=t.x,i[n+1]=t.y,i[n+2]=t.z}function l(){let e=new H;for(let t=0;t<i.length;t+=3){e.x=i[t+0],e.y=i[t+1],e.z=i[t+2];let n=h(e)/2/Math.PI+.5,r=g(e)/Math.PI+.5;a.push(n,1-r)}p(),u()}function u(){for(let e=0;e<a.length;e+=6){let t=a[e+0],n=a[e+2],r=a[e+4];Math.max(t,n,r)>.9&&Math.min(t,n,r)<.1&&(t<.2&&(a[e+0]+=1),n<.2&&(a[e+2]+=1),r<.2&&(a[e+4]+=1))}}function d(e){i.push(e.x,e.y,e.z)}function f(t,n){let r=t*3;n.x=e[r+0],n.y=e[r+1],n.z=e[r+2]}function p(){let e=new H,t=new H,n=new H,r=new H,o=new V,s=new V,c=new V;for(let l=0,u=0;l<i.length;l+=9,u+=6){e.set(i[l+0],i[l+1],i[l+2]),t.set(i[l+3],i[l+4],i[l+5]),n.set(i[l+6],i[l+7],i[l+8]),o.set(a[u+0],a[u+1]),s.set(a[u+2],a[u+3]),c.set(a[u+4],a[u+5]),r.copy(e).add(t).add(n).divideScalar(3);let d=h(r);m(o,u+0,e,d),m(s,u+2,t,d),m(c,u+4,n,d)}}function m(e,t,n,r){r<0&&e.x===1&&(a[t]=e.x-1),n.x===0&&n.z===0&&(a[t]=r/2/Math.PI+.5)}function h(e){return Math.atan2(e.z,-e.x)}function g(e){return Math.atan2(-e.y,Math.sqrt(e.x*e.x+e.z*e.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.vertices,t.indices,t.radius,t.detail)}},zi=class{constructor(){this.type=`Curve`,this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){R(`Curve: .getPoint() not implemented.`)}getPointAt(e,t){let n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){let e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let t=[],n,r=this.getPoint(0),i=0;t.push(0);for(let a=1;a<=e;a++)n=this.getPoint(a/e),i+=n.distanceTo(r),t.push(i),r=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t=null){let n=this.getLengths(),r=0,i=n.length,a;a=t||e*n[i-1];let o=0,s=i-1,c;for(;o<=s;)if(r=Math.floor(o+(s-o)/2),c=n[r]-a,c<0)o=r+1;else if(c>0)s=r-1;else{s=r;break}if(r=s,n[r]===a)return r/(i-1);let l=n[r],u=n[r+1]-l,d=(a-l)/u;return(r+d)/(i-1)}getTangent(e,t){let n=1e-4,r=e-n,i=e+n;r<0&&(r=0),i>1&&(i=1);let a=this.getPoint(r),o=this.getPoint(i),s=t||(a.isVector2?new V:new H);return s.copy(o).sub(a).normalize(),s}getTangentAt(e,t){let n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t=!1){let n=new H,r=[],i=[],a=[],o=new H,s=new Xt;for(let t=0;t<=e;t++){let n=t/e;r[t]=this.getTangentAt(n,new H)}i[0]=new H,a[0]=new H;let c=Number.MAX_VALUE,l=Math.abs(r[0].x),u=Math.abs(r[0].y),d=Math.abs(r[0].z);l<=c&&(c=l,n.set(1,0,0)),u<=c&&(c=u,n.set(0,1,0)),d<=c&&n.set(0,0,1),o.crossVectors(r[0],n).normalize(),i[0].crossVectors(r[0],o),a[0].crossVectors(r[0],i[0]);for(let t=1;t<=e;t++){if(i[t]=i[t-1].clone(),a[t]=a[t-1].clone(),o.crossVectors(r[t-1],r[t]),o.length()>2**-52){o.normalize();let e=Math.acos(B(r[t-1].dot(r[t]),-1,1));i[t].applyMatrix4(s.makeRotationAxis(o,e))}a[t].crossVectors(r[t],i[t])}if(t===!0){let t=Math.acos(B(i[0].dot(i[e]),-1,1));t/=e,r[0].dot(o.crossVectors(i[0],i[e]))>0&&(t=-t);for(let n=1;n<=e;n++)i[n].applyMatrix4(s.makeRotationAxis(r[n],t*n)),a[n].crossVectors(r[n],i[n])}return{tangents:r,normals:i,binormals:a}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){let e={metadata:{version:4.7,type:`Curve`,generator:`Curve.toJSON`}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}},Bi=class extends zi{constructor(e=0,t=0,n=1,r=1,i=0,a=Math.PI*2,o=!1,s=0){super(),this.isEllipseCurve=!0,this.type=`EllipseCurve`,this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=r,this.aStartAngle=i,this.aEndAngle=a,this.aClockwise=o,this.aRotation=s}getPoint(e,t=new V){let n=t,r=Math.PI*2,i=this.aEndAngle-this.aStartAngle,a=Math.abs(i)<2**-52;for(;i<0;)i+=r;for(;i>r;)i-=r;i<2**-52&&(i=a?0:r),this.aClockwise===!0&&!a&&(i===r?i=-r:i-=r);let o=this.aStartAngle+e*i,s=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){let e=Math.cos(this.aRotation),t=Math.sin(this.aRotation),n=s-this.aX,r=c-this.aY;s=n*e-r*t+this.aX,c=n*t+r*e+this.aY}return n.set(s,c)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){let e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}},Vi=class extends Bi{constructor(e,t,n,r,i,a){super(e,t,n,n,r,i,a),this.isArcCurve=!0,this.type=`ArcCurve`}};function Hi(){let e=0,t=0,n=0,r=0;function i(i,a,o,s){e=i,t=o,n=-3*i+3*a-2*o-s,r=2*i-2*a+o+s}return{initCatmullRom:function(e,t,n,r,a){i(t,n,a*(n-e),a*(r-t))},initNonuniformCatmullRom:function(e,t,n,r,a,o,s){let c=(t-e)/a-(n-e)/(a+o)+(n-t)/o,l=(n-t)/o-(r-t)/(o+s)+(r-n)/s;c*=o,l*=o,i(t,n,c,l)},calc:function(i){let a=i*i,o=a*i;return e+t*i+n*a+r*o}}}var Ui=new H,Wi=new H,Gi=new Hi,Ki=new Hi,qi=new Hi,Ji=class extends zi{constructor(e=[],t=!1,n=`centripetal`,r=.5){super(),this.isCatmullRomCurve3=!0,this.type=`CatmullRomCurve3`,this.points=e,this.closed=t,this.curveType=n,this.tension=r}getPoint(e,t=new H){let n=t,r=this.points,i=r.length,a=(i-+!this.closed)*e,o=Math.floor(a),s=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/i)+1)*i:s===0&&o===i-1&&(o=i-2,s=1);let c,l;this.closed||o>0?c=r[(o-1)%i]:(Wi.subVectors(r[0],r[1]).add(r[0]),c=Wi);let u=r[o%i],d=r[(o+1)%i];if(this.closed||o+2<i?l=r[(o+2)%i]:(Ui.subVectors(r[i-1],r[i-2]).add(r[i-1]),l=Ui),this.curveType===`centripetal`||this.curveType===`chordal`){let e=this.curveType===`chordal`?.5:.25,t=c.distanceToSquared(u)**+e,n=u.distanceToSquared(d)**+e,r=d.distanceToSquared(l)**+e;n<1e-4&&(n=1),t<1e-4&&(t=n),r<1e-4&&(r=n),Gi.initNonuniformCatmullRom(c.x,u.x,d.x,l.x,t,n,r),Ki.initNonuniformCatmullRom(c.y,u.y,d.y,l.y,t,n,r),qi.initNonuniformCatmullRom(c.z,u.z,d.z,l.z,t,n,r)}else this.curveType===`catmullrom`&&(Gi.initCatmullRom(c.x,u.x,d.x,l.x,this.tension),Ki.initCatmullRom(c.y,u.y,d.y,l.y,this.tension),qi.initCatmullRom(c.z,u.z,d.z,l.z,this.tension));return n.set(Gi.calc(s),Ki.calc(s),qi.calc(s)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let n=e.points[t];this.points.push(n.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let n=this.points[t];e.points.push(n.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let n=e.points[t];this.points.push(new H().fromArray(n))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}};function Yi(e,t,n,r,i){let a=(r-t)*.5,o=(i-n)*.5,s=e*e,c=e*s;return(2*n-2*r+a+o)*c+(-3*n+3*r-2*a-o)*s+a*e+n}function Xi(e,t){let n=1-e;return n*n*t}function Zi(e,t){return 2*(1-e)*e*t}function Qi(e,t){return e*e*t}function $i(e,t,n,r){return Xi(e,t)+Zi(e,n)+Qi(e,r)}function ea(e,t){let n=1-e;return n*n*n*t}function ta(e,t){let n=1-e;return 3*n*n*e*t}function na(e,t){return 3*(1-e)*e*e*t}function ra(e,t){return e*e*e*t}function ia(e,t,n,r,i){return ea(e,t)+ta(e,n)+na(e,r)+ra(e,i)}var aa=class extends zi{constructor(e=new V,t=new V,n=new V,r=new V){super(),this.isCubicBezierCurve=!0,this.type=`CubicBezierCurve`,this.v0=e,this.v1=t,this.v2=n,this.v3=r}getPoint(e,t=new V){let n=t,r=this.v0,i=this.v1,a=this.v2,o=this.v3;return n.set(ia(e,r.x,i.x,a.x,o.x),ia(e,r.y,i.y,a.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},oa=class extends zi{constructor(e=new H,t=new H,n=new H,r=new H){super(),this.isCubicBezierCurve3=!0,this.type=`CubicBezierCurve3`,this.v0=e,this.v1=t,this.v2=n,this.v3=r}getPoint(e,t=new H){let n=t,r=this.v0,i=this.v1,a=this.v2,o=this.v3;return n.set(ia(e,r.x,i.x,a.x,o.x),ia(e,r.y,i.y,a.y,o.y),ia(e,r.z,i.z,a.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},sa=class extends zi{constructor(e=new V,t=new V){super(),this.isLineCurve=!0,this.type=`LineCurve`,this.v1=e,this.v2=t}getPoint(e,t=new V){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new V){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},ca=class extends zi{constructor(e=new H,t=new H){super(),this.isLineCurve3=!0,this.type=`LineCurve3`,this.v1=e,this.v2=t}getPoint(e,t=new H){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new H){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},la=class extends zi{constructor(e=new V,t=new V,n=new V){super(),this.isQuadraticBezierCurve=!0,this.type=`QuadraticBezierCurve`,this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new V){let n=t,r=this.v0,i=this.v1,a=this.v2;return n.set($i(e,r.x,i.x,a.x),$i(e,r.y,i.y,a.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},ua=class extends zi{constructor(e=new H,t=new H,n=new H){super(),this.isQuadraticBezierCurve3=!0,this.type=`QuadraticBezierCurve3`,this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new H){let n=t,r=this.v0,i=this.v1,a=this.v2;return n.set($i(e,r.x,i.x,a.x),$i(e,r.y,i.y,a.y),$i(e,r.z,i.z,a.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},da=Object.freeze({__proto__:null,ArcCurve:Vi,CatmullRomCurve3:Ji,CubicBezierCurve:aa,CubicBezierCurve3:oa,EllipseCurve:Bi,LineCurve:sa,LineCurve3:ca,QuadraticBezierCurve:la,QuadraticBezierCurve3:ua,SplineCurve:class extends zi{constructor(e=[]){super(),this.isSplineCurve=!0,this.type=`SplineCurve`,this.points=e}getPoint(e,t=new V){let n=t,r=this.points,i=(r.length-1)*e,a=Math.floor(i),o=i-a,s=r[a===0?a:a-1],c=r[a],l=r[a>r.length-2?r.length-1:a+1],u=r[a>r.length-3?r.length-1:a+2];return n.set(Yi(o,s.x,c.x,l.x,u.x),Yi(o,s.y,c.y,l.y,u.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let n=e.points[t];this.points.push(n.clone())}return this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let n=this.points[t];e.points.push(n.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let n=e.points[t];this.points.push(new V().fromArray(n))}return this}}}),fa=class e extends Ri{constructor(e=1,t=0){let n=(1+Math.sqrt(5))/2,r=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1];super(r,[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1],e,t),this.type=`IcosahedronGeometry`,this.parameters={radius:e,detail:t}}static fromJSON(t){return new e(t.radius,t.detail)}},pa=class e extends Or{constructor(e=1,t=1,n=1,r=1){super(),this.type=`PlaneGeometry`,this.parameters={width:e,height:t,widthSegments:n,heightSegments:r};let i=e/2,a=t/2,o=Math.floor(n),s=Math.floor(r),c=o+1,l=s+1,u=e/o,d=t/s,f=[],p=[],m=[],h=[];for(let e=0;e<l;e++){let t=e*d-a;for(let n=0;n<c;n++){let r=n*u-i;p.push(r,-t,0),m.push(0,0,1),h.push(n/o),h.push(1-e/s)}}for(let e=0;e<s;e++)for(let t=0;t<o;t++){let n=t+c*e,r=t+c*(e+1),i=t+1+c*(e+1),a=t+1+c*e;f.push(n,r,a),f.push(r,i,a)}this.setIndex(f),this.setAttribute(`position`,new gr(p,3)),this.setAttribute(`normal`,new gr(m,3)),this.setAttribute(`uv`,new gr(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.widthSegments,t.heightSegments)}},ma=class e extends Or{constructor(e=1,t=32,n=16,r=0,i=Math.PI*2,a=0,o=Math.PI){super(),this.type=`SphereGeometry`,this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:r,phiLength:i,thetaStart:a,thetaLength:o},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));let s=Math.min(a+o,Math.PI),c=0,l=[],u=new H,d=new H,f=[],p=[],m=[],h=[];for(let f=0;f<=n;f++){let g=[],_=f/n,v=a+_*o,y=e*Math.cos(v),b=Math.sqrt(e*e-y*y),x=0;f===0&&a===0?x=.5/t:f===n&&s===Math.PI&&(x=-.5/t);for(let e=0;e<=t;e++){let n=e/t,a=r+n*i;u.x=-b*Math.cos(a),u.y=y,u.z=b*Math.sin(a),p.push(u.x,u.y,u.z),d.copy(u).normalize(),m.push(d.x,d.y,d.z),h.push(n+x,1-_),g.push(c++)}l.push(g)}for(let e=0;e<n;e++)for(let r=0;r<t;r++){let t=l[e][r+1],i=l[e][r],o=l[e+1][r],c=l[e+1][r+1];(e!==0||a>0)&&f.push(t,i,c),(e!==n-1||s<Math.PI)&&f.push(i,o,c)}this.setIndex(f),this.setAttribute(`position`,new gr(p,3)),this.setAttribute(`normal`,new gr(m,3)),this.setAttribute(`uv`,new gr(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}},ha=class e extends Or{constructor(e=1,t=.4,n=12,r=48,i=Math.PI*2,a=0,o=Math.PI*2){super(),this.type=`TorusGeometry`,this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:r,arc:i,thetaStart:a,thetaLength:o},n=Math.floor(n),r=Math.floor(r);let s=[],c=[],l=[],u=[],d=new H,f=new H,p=new H;for(let s=0;s<=n;s++){let m=a+s/n*o;for(let a=0;a<=r;a++){let o=a/r*i;f.x=(e+t*Math.cos(m))*Math.cos(o),f.y=(e+t*Math.cos(m))*Math.sin(o),f.z=t*Math.sin(m),c.push(f.x,f.y,f.z),d.x=e*Math.cos(o),d.y=e*Math.sin(o),p.subVectors(f,d).normalize(),l.push(p.x,p.y,p.z),u.push(a/r),u.push(s/n)}}for(let e=1;e<=n;e++)for(let t=1;t<=r;t++){let n=(r+1)*e+t-1,i=(r+1)*(e-1)+t-1,a=(r+1)*(e-1)+t,o=(r+1)*e+t;s.push(n,i,o),s.push(i,a,o)}this.setIndex(s),this.setAttribute(`position`,new gr(c,3)),this.setAttribute(`normal`,new gr(l,3)),this.setAttribute(`uv`,new gr(u,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.radius,t.tube,t.radialSegments,t.tubularSegments,t.arc)}},ga=class e extends Or{constructor(e=new ua(new H(-1,-1,0),new H(-1,1,0),new H(1,1,0)),t=64,n=1,r=8,i=!1){super(),this.type=`TubeGeometry`,this.parameters={path:e,tubularSegments:t,radius:n,radialSegments:r,closed:i};let a=e.computeFrenetFrames(t,i);this.tangents=a.tangents,this.normals=a.normals,this.binormals=a.binormals;let o=new H,s=new H,c=new V,l=new H,u=[],d=[],f=[],p=[];m(),this.setIndex(p),this.setAttribute(`position`,new gr(u,3)),this.setAttribute(`normal`,new gr(d,3)),this.setAttribute(`uv`,new gr(f,2));function m(){for(let e=0;e<t;e++)h(e);h(i===!1?t:0),_(),g()}function h(i){l=e.getPointAt(i/t,l);let c=a.normals[i],f=a.binormals[i];for(let e=0;e<=r;e++){let t=e/r*Math.PI*2,i=Math.sin(t),a=-Math.cos(t);s.x=a*c.x+i*f.x,s.y=a*c.y+i*f.y,s.z=a*c.z+i*f.z,s.normalize(),d.push(s.x,s.y,s.z),o.x=l.x+n*s.x,o.y=l.y+n*s.y,o.z=l.z+n*s.z,u.push(o.x,o.y,o.z)}}function g(){for(let e=1;e<=t;e++)for(let t=1;t<=r;t++){let n=(r+1)*(e-1)+(t-1),i=(r+1)*e+(t-1),a=(r+1)*e+t,o=(r+1)*(e-1)+t;p.push(n,i,o),p.push(i,a,o)}}function _(){for(let e=0;e<=t;e++)for(let n=0;n<=r;n++)c.x=e/t,c.y=n/r,f.push(c.x,c.y)}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON();return e.path=this.parameters.path.toJSON(),e}static fromJSON(t){return new e(new da[t.path.type]().fromJSON(t.path),t.tubularSegments,t.radius,t.radialSegments,t.closed)}};function _a(e){let t={};for(let n in e){t[n]={};for(let r in e[n]){let i=e[n][r];if(ya(i))i.isRenderTargetTexture?(R(`UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms().`),t[n][r]=null):t[n][r]=i.clone();else if(Array.isArray(i)){if(ya(i[0])){let e=[];for(let t=0,n=i.length;t<n;t++)e[t]=i[t].clone();t[n][r]=e}else t[n][r]=i.slice()}else t[n][r]=i}}return t}function va(e){let t={};for(let n=0;n<e.length;n++){let r=_a(e[n]);for(let e in r)t[e]=r[e]}return t}function ya(e){return e&&(e.isColor||e.isMatrix3||e.isMatrix4||e.isVector2||e.isVector3||e.isVector4||e.isTexture||e.isQuaternion)}function ba(e){let t=[];for(let n=0;n<e.length;n++)t.push(e[n].clone());return t}function xa(e){let t=e.getRenderTarget();return t===null?e.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:W.workingColorSpace}var Sa={clone:_a,merge:va},Ca=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,wa=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,Ta=class extends Ar{constructor(e){super(),this.isShaderMaterial=!0,this.type=`ShaderMaterial`,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Ca,this.fragmentShader=wa,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=_a(e.uniforms),this.uniformsGroups=ba(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let n in this.uniforms){let r=this.uniforms[n].value;r&&r.isTexture?t.uniforms[n]={type:`t`,value:r.toJSON(e).uuid}:r&&r.isColor?t.uniforms[n]={type:`c`,value:r.getHex()}:r&&r.isVector2?t.uniforms[n]={type:`v2`,value:r.toArray()}:r&&r.isVector3?t.uniforms[n]={type:`v3`,value:r.toArray()}:r&&r.isVector4?t.uniforms[n]={type:`v4`,value:r.toArray()}:r&&r.isMatrix3?t.uniforms[n]={type:`m3`,value:r.toArray()}:r&&r.isMatrix4?t.uniforms[n]={type:`m4`,value:r.toArray()}:t.uniforms[n]={value:r}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let e in this.extensions)this.extensions[e]===!0&&(n[e]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let n in e.uniforms){let r=e.uniforms[n];switch(this.uniforms[n]={},r.type){case`t`:this.uniforms[n].value=t[r.value]||null;break;case`c`:this.uniforms[n].value=new G().setHex(r.value);break;case`v2`:this.uniforms[n].value=new V().fromArray(r.value);break;case`v3`:this.uniforms[n].value=new H().fromArray(r.value);break;case`v4`:this.uniforms[n].value=new Gt().fromArray(r.value);break;case`m3`:this.uniforms[n].value=new U().fromArray(r.value);break;case`m4`:this.uniforms[n].value=new Xt().fromArray(r.value);break;default:this.uniforms[n].value=r.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let t in e.extensions)this.extensions[t]=e.extensions[t];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},Ea=class extends Ta{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type=`RawShaderMaterial`}},Da=class extends Ar{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type=`MeshStandardMaterial`,this.defines={STANDARD:``},this.color=new G(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new G(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new V(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new sn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap=`round`,this.wireframeLinejoin=`round`,this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:``},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},Oa=class extends Da{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:``,PHYSICAL:``},this.type=`MeshPhysicalMaterial`,this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new V(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return B(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(e){this.ior=(1+.4*e)/(1-.4*e)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new G(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new G(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new G(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:``,PHYSICAL:``},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}},ka=class extends Ar{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type=`MeshDepthMaterial`,this.depthPacking=I,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},Aa=class extends Ar{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type=`MeshDistanceMaterial`,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function ja(e,t){return!e||e.constructor===t?e:typeof t.BYTES_PER_ELEMENT==`number`?new t(e):Array.prototype.slice.call(e)}var Ma=class{constructor(e,t,n,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r===void 0?new t.constructor(n):r,this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,r=t[n],i=t[n-1];validate_interval:{seek:{let a;linear_scan:{forward_scan:if(!(e<r)){for(let a=n+2;;){if(r===void 0){if(e<i)break forward_scan;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===a)break;if(i=r,r=t[++n],e<r)break seek}a=t.length;break linear_scan}if(!(e>=i)){let o=t[1];e<o&&(n=2,i=o);for(let a=n-2;;){if(i===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===a)break;if(r=i,i=t[--n-1],e>=i)break seek}a=n,n=0;break linear_scan}break validate_interval}for(;n<a;){let r=n+a>>>1;e<t[r]?a=r:n=r+1}if(r=t[n],i=t[n-1],i===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,i,r)}return this.interpolate_(n,i,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,r=this.valueSize,i=e*r;for(let e=0;e!==r;++e)t[e]=n[i+e];return t}interpolate_(){throw Error(`THREE.Interpolant: Call to abstract method.`)}intervalChanged_(){}},Na=class extends Ma{constructor(e,t,n,r){super(e,t,n,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Le,endingEnd:Le}}intervalChanged_(e,t,n){let r=this.parameterPositions,i=e-2,a=e+1,o=r[i],s=r[a];if(o===void 0)switch(this.getSettings_().endingStart){case F:i=e,o=2*t-n;break;case Re:i=r.length-2,o=t+r[i]-r[i+1];break;default:i=e,o=n}if(s===void 0)switch(this.getSettings_().endingEnd){case F:a=e,s=2*n-t;break;case Re:a=1,s=n+r[1]-r[0];break;default:a=e-1,s=t}let c=(n-t)*.5,l=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(s-n),this._offsetPrev=i*l,this._offsetNext=a*l}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=this._offsetPrev,u=this._offsetNext,d=this._weightPrev,f=this._weightNext,p=(n-t)/(r-t),m=p*p,h=m*p,g=-d*h+2*d*m-d*p,_=(1+d)*h+(-1.5-2*d)*m+(-.5+d)*p+1,v=(-1-f)*h+(1.5+f)*m+.5*p,y=f*h-f*m;for(let e=0;e!==o;++e)i[e]=g*a[l+e]+_*a[c+e]+v*a[s+e]+y*a[u+e];return i}},Pa=class extends Ma{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=(n-t)/(r-t),u=1-l;for(let e=0;e!==o;++e)i[e]=a[c+e]*u+a[s+e]*l;return i}},Fa=class extends Ma{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e){return this.copySampleValue_(e-1)}},Ia=class extends Ma{interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=this.inTangents,u=this.outTangents;if(!l||!u){let e=(n-t)/(r-t),l=1-e;for(let t=0;t!==o;++t)i[t]=a[c+t]*l+a[s+t]*e;return i}let d=o*2,f=e-1;for(let p=0;p!==o;++p){let o=a[c+p],m=a[s+p],h=f*d+p*2,g=u[h],_=u[h+1],v=e*d+p*2,y=l[v],b=l[v+1],x=(n-t)/(r-t),S,C,w,T,E;for(let e=0;e<8;e++){S=x*x,C=S*x,w=1-x,T=w*w,E=T*w;let e=E*t+3*T*x*g+3*w*S*y+C*r-n;if(Math.abs(e)<1e-10)break;let i=3*T*(g-t)+6*w*x*(y-g)+3*S*(r-y);if(Math.abs(i)<1e-10)break;x-=e/i,x=Math.max(0,Math.min(1,x))}i[p]=E*o+3*T*x*_+3*w*S*b+C*m}return i}},La=class{constructor(e,t,n,r){if(e===void 0)throw Error(`THREE.KeyframeTrack: track name is undefined`);if(t===void 0||t.length===0)throw Error(`THREE.KeyframeTrack: no keyframes in track named `+e);this.name=e,this.times=ja(t,this.TimeBufferType),this.values=ja(n,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:ja(e.times,Array),values:ja(e.values,Array)};let t=e.getInterpolation();t!==e.DefaultInterpolation&&(n.interpolation=t)}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new Fa(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new Pa(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new Na(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new Ia(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case Pe:t=this.InterpolantFactoryMethodDiscrete;break;case P:t=this.InterpolantFactoryMethodLinear;break;case Fe:t=this.InterpolantFactoryMethodSmooth;break;case Ie:t=this.InterpolantFactoryMethodBezier}if(t===void 0){let t=`unsupported interpolation for `+this.ValueTypeName+` keyframe track named `+this.name;if(this.createInterpolant===void 0){if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw Error(t)}return R(`KeyframeTrack:`,t),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Pe;case this.InterpolantFactoryMethodLinear:return P;case this.InterpolantFactoryMethodSmooth:return Fe;case this.InterpolantFactoryMethodBezier:return Ie}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]*=e}return this}trim(e,t){let n=this.times,r=n.length,i=0,a=r-1;for(;i!==r&&n[i]<e;)++i;for(;a!==-1&&n[a]>t;)--a;if(++a,i!==0||a!==r){i>=a&&(a=Math.max(a,1),i=a-1);let e=this.getValueSize();this.times=n.slice(i,a),this.values=this.values.slice(i*e,a*e)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(z(`KeyframeTrack: Invalid value size in track.`,this),e=!1);let n=this.times,r=this.values,i=n.length;i===0&&(z(`KeyframeTrack: Track is empty.`,this),e=!1);let a=null;for(let t=0;t!==i;t++){let r=n[t];if(typeof r==`number`&&isNaN(r)){z(`KeyframeTrack: Time is not a valid number.`,this,t,r),e=!1;break}if(a!==null&&a>r){z(`KeyframeTrack: Out of order keys.`,this,t,r,a),e=!1;break}a=r}if(r!==void 0&&Ke(r))for(let t=0,n=r.length;t!==n;++t){let n=r[t];if(isNaN(n)){z(`KeyframeTrack: Value is not a valid number.`,this,t,n),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),r=this.getInterpolation()===Fe,i=e.length-1,a=1;for(let o=1;o<i;++o){let i=!1,s=e[o];if(s!==e[o+1]&&(o!==1||s!==e[0])){if(r)i=!0;else{let e=o*n,r=e-n,a=e+n;for(let o=0;o!==n;++o){let n=t[e+o];if(n!==t[r+o]||n!==t[a+o]){i=!0;break}}}}if(i){if(o!==a){e[a]=e[o];let r=o*n,i=a*n;for(let e=0;e!==n;++e)t[i+e]=t[r+e]}++a}}if(i>0){e[a]=e[i];for(let e=i*n,r=a*n,o=0;o!==n;++o)t[r+o]=t[e+o];++a}return a===e.length?(this.times=e,this.values=t):(this.times=e.slice(0,a),this.values=t.slice(0,a*n)),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=this.constructor,r=new n(this.name,e,t);return r.createInterpolant=this.createInterpolant,r}};La.prototype.ValueTypeName=``,La.prototype.TimeBufferType=Float32Array,La.prototype.ValueBufferType=Float32Array,La.prototype.DefaultInterpolation=P;var Ra=class extends La{constructor(e,t,n){super(e,t,n)}};Ra.prototype.ValueTypeName=`bool`,Ra.prototype.ValueBufferType=Array,Ra.prototype.DefaultInterpolation=Pe,Ra.prototype.InterpolantFactoryMethodLinear=void 0,Ra.prototype.InterpolantFactoryMethodSmooth=void 0;var za=class extends La{constructor(e,t,n,r){super(e,t,n,r)}};za.prototype.ValueTypeName=`color`;var Ba=class extends La{constructor(e,t,n,r){super(e,t,n,r)}};Ba.prototype.ValueTypeName=`number`;var Va=class extends Ma{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=(n-t)/(r-t),c=e*o;for(let e=c+o;c!==e;c+=4)Ot.slerpFlat(i,0,a,c-o,a,c,s);return i}},Ha=class extends La{constructor(e,t,n,r){super(e,t,n,r)}InterpolantFactoryMethodLinear(e){return new Va(this.times,this.values,this.getValueSize(),e)}};Ha.prototype.ValueTypeName=`quaternion`,Ha.prototype.InterpolantFactoryMethodSmooth=void 0;var Ua=class extends La{constructor(e,t,n){super(e,t,n)}};Ua.prototype.ValueTypeName=`string`,Ua.prototype.ValueBufferType=Array,Ua.prototype.DefaultInterpolation=Pe,Ua.prototype.InterpolantFactoryMethodLinear=void 0,Ua.prototype.InterpolantFactoryMethodSmooth=void 0;var Wa=class extends La{constructor(e,t,n,r){super(e,t,n,r)}};Wa.prototype.ValueTypeName=`vector`;var Ga={enabled:!1,files:{},add:function(e,t){this.enabled!==!1&&(Ka(e)||(this.files[e]=t))},get:function(e){if(this.enabled!==!1&&!Ka(e))return this.files[e]},remove:function(e){delete this.files[e]},clear:function(){this.files={}}};function Ka(e){try{let t=e.slice(e.indexOf(`:`)+1);return new URL(t).protocol===`blob:`}catch{return!1}}var qa=new class{constructor(e,t,n){let r=this,i=!1,a=0,o=0,s,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(e){o++,i===!1&&r.onStart!==void 0&&r.onStart(e,a,o),i=!0},this.itemEnd=function(e){a++,r.onProgress!==void 0&&r.onProgress(e,a,o),a===o&&(i=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(e){r.onError!==void 0&&r.onError(e)},this.resolveURL=function(e){return e=e.normalize(`NFC`),s?s(e):e},this.setURLModifier=function(e){return s=e,this},this.addHandler=function(e,t){return c.push(e,t),this},this.removeHandler=function(e){let t=c.indexOf(e);return t!==-1&&c.splice(t,2),this},this.getHandler=function(e){for(let t=0,n=c.length;t<n;t+=2){let n=c[t],r=c[t+1];if(n.global&&(n.lastIndex=0),n.test(e))return r}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||=new AbortController,this._abortController}},Ja=class{constructor(e){this.manager=e===void 0?qa:e,this.crossOrigin=`anonymous`,this.withCredentials=!1,this.path=``,this.resourcePath=``,this.requestHeader={},typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}load(){}loadAsync(e,t){let n=this;return new Promise(function(r,i){n.load(e,r,t,i)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};Ja.DEFAULT_MATERIAL_NAME=`__DEFAULT`;var Ya=new WeakMap,Xa=class extends Ja{constructor(e){super(e)}load(e,t,n,r){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let i=this,a=Ga.get(`image:${e}`);if(a!==void 0){if(a.complete===!0)i.manager.itemStart(e),setTimeout(function(){t&&t(a),i.manager.itemEnd(e)},0);else{let e=Ya.get(a);e===void 0&&(e=[],Ya.set(a,e)),e.push({onLoad:t,onError:r})}return a}let o=qe(`img`);function s(){l(),t&&t(this);let n=Ya.get(this)||[];for(let e=0;e<n.length;e++){let t=n[e];t.onLoad&&t.onLoad(this)}Ya.delete(this),i.manager.itemEnd(e)}function c(t){l(),r&&r(t),Ga.remove(`image:${e}`);let n=Ya.get(this)||[];for(let e=0;e<n.length;e++){let r=n[e];r.onError&&r.onError(t)}Ya.delete(this),i.manager.itemError(e),i.manager.itemEnd(e)}function l(){o.removeEventListener(`load`,s,!1),o.removeEventListener(`error`,c,!1)}return o.addEventListener(`load`,s,!1),o.addEventListener(`error`,c,!1),e.slice(0,5)!==`data:`&&this.crossOrigin!==void 0&&(o.crossOrigin=this.crossOrigin),Ga.add(`image:${e}`,o),i.manager.itemStart(e),o.src=e,o}},Za=class extends Ja{constructor(e){super(e)}load(e,t,n,r){let i=new Wt,a=new Xa(this.manager);return a.setCrossOrigin(this.crossOrigin),a.setPath(this.path),a.load(e,function(e){i.image=e,i.needsUpdate=!0,t!==void 0&&t(i)},n,r),i}},Qa=class extends wn{constructor(e,t=1){super(),this.isLight=!0,this.type=`Light`,this.color=new G(e),this.intensity=t}dispose(){this.dispatchEvent({type:`dispose`})}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}},$a=new Xt,eo=new H,to=new H,no=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new V(512,512),this.mapType=l,this.map=null,this.mapPass=null,this.matrix=new Xt,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new gi,this._frameExtents=new V(1,1),this._viewportCount=1,this._viewports=[new Gt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera,n=this.matrix;eo.setFromMatrixPosition(e.matrixWorld),t.position.copy(eo),to.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(to),t.updateMatrixWorld(),$a.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix($a,t.coordinateSystem,t.reversedDepth),t.coordinateSystem===2001||t.reversedDepth?n.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply($a)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},ro=new H,io=new Ot,ao=new H,oo=class extends wn{constructor(){super(),this.isCamera=!0,this.type=`Camera`,this.matrixWorldInverse=new Xt,this.projectionMatrix=new Xt,this.projectionMatrixInverse=new Xt,this.coordinateSystem=We,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(ro,io,ao),ao.x===1&&ao.y===1&&ao.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(ro,io,ao.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(ro,io,ao),ao.x===1&&ao.y===1&&ao.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(ro,io,ao.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},so=new H,co=new V,lo=new V,uo=class extends oo{constructor(e=50,t=1,n=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type=`PerspectiveCamera`,this.fov=e,this.zoom=1,this.near=n,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=at*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(it*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return at*2*Math.atan(Math.tan(it*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){so.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(so.x,so.y).multiplyScalar(-e/so.z),so.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(so.x,so.y).multiplyScalar(-e/so.z)}getViewSize(e,t){return this.getViewBounds(e,co,lo),t.subVectors(lo,co)}setViewOffset(e,t,n,r,i,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=i,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(it*.5*this.fov)/this.zoom,n=2*t,r=this.aspect*n,i=-.5*r,a=this.view;if(this.view!==null&&this.view.enabled){let e=a.fullWidth,o=a.fullHeight;i+=a.offsetX*r/e,t-=a.offsetY*n/o,r*=a.width/e,n*=a.height/o}let o=this.filmOffset;o!==0&&(i+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(i,i+r,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},fo=class extends oo{constructor(e=-1,t=1,n=1,r=-1,i=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type=`OrthographicCamera`,this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=r,this.near=i,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,r,i,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=i,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,r=(this.top+this.bottom)/2,i=n-e,a=n+e,o=r+t,s=r-t;if(this.view!==null&&this.view.enabled){let e=(this.right-this.left)/this.view.fullWidth/this.zoom,t=(this.top-this.bottom)/this.view.fullHeight/this.zoom;i+=e*this.view.offsetX,a=i+e*this.view.width,o-=t*this.view.offsetY,s=o-t*this.view.height}this.projectionMatrix.makeOrthographic(i,a,o,s,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},po=class extends no{constructor(){super(new fo(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},mo=class extends Qa{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type=`DirectionalLight`,this.position.copy(wn.DEFAULT_UP),this.updateMatrix(),this.target=new wn,this.shadow=new po}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}},ho=class extends Qa{constructor(e,t){super(e,t),this.isAmbientLight=!0,this.type=`AmbientLight`}},go=-90,_o=1,vo=class extends wn{constructor(e,t,n){super(),this.type=`CubeCamera`,this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let r=new uo(go,_o,e,t);r.layers=this.layers,this.add(r);let i=new uo(go,_o,e,t);i.layers=this.layers,this.add(i);let a=new uo(go,_o,e,t);a.layers=this.layers,this.add(a);let o=new uo(go,_o,e,t);o.layers=this.layers,this.add(o);let s=new uo(go,_o,e,t);s.layers=this.layers,this.add(s);let c=new uo(go,_o,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,r,i,a,o,s]=t;for(let e of t)this.remove(e);if(e===2e3)n.up.set(0,1,0),n.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),i.up.set(0,0,-1),i.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),s.up.set(0,1,0),s.lookAt(0,0,-1);else if(e===2001)n.up.set(0,-1,0),n.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),i.up.set(0,0,1),i.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),s.up.set(0,-1,0),s.lookAt(0,0,-1);else throw Error(`THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: `+e);for(let e of t)this.add(e),e.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[i,a,o,s,c,l]=this.children,u=e.getRenderTarget(),d=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),p=e.xr.enabled;e.xr.enabled=!1;let m=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let h=!1;h=e.isWebGLRenderer===!0?e.state.buffers.depth.getReversed():e.reversedDepthBuffer,e.setRenderTarget(n,0,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,i),e.setRenderTarget(n,1,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,2,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,3,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,s),e.setRenderTarget(n,4,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),n.texture.generateMipmaps=m,e.setRenderTarget(n,5,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(u,d,f),e.xr.enabled=p,n.texture.needsPMREMUpdate=!0}},yo=class extends uo{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}},bo=`\\[\\]\\.:\\/`,xo=RegExp(`[\\[\\]\\.:\\/]`,`g`),So=`[^\\[\\]\\.:\\/]`,Co=`[^`+bo.replace(`\\.`,``)+`]`,wo=`((?:WC+[\\/:])*)`.replace(`WC`,So),To=`(WCOD+)?`.replace(`WCOD`,Co),Eo=`(?:\\.(WC+)(?:\\[(.+)\\])?)?`.replace(`WC`,So),Do=`\\.(WC+)(?:\\[(.+)\\])?`.replace(`WC`,So),Oo=RegExp(`^`+wo+To+Eo+Do+`$`),ko=[`material`,`materials`,`bones`,`map`],Ao=class{constructor(e,t,n){let r=n||jo.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,r)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,r=this._bindings[n];r!==void 0&&r.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let r=this._targetGroup.nCachedObjects_,i=n.length;r!==i;++r)n[r].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},jo=class e{constructor(t,n,r){this.path=n,this.parsedPath=r||e.parseTrackName(n),this.node=e.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,n,r){return t&&t.isAnimationObjectGroup?new e.Composite(t,n,r):new e(t,n,r)}static sanitizeNodeName(e){return e.replace(/\s/g,`_`).replace(xo,``)}static parseTrackName(e){let t=Oo.exec(e);if(t===null)throw Error(`THREE.PropertyBinding: Cannot parse trackName: `+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=n.nodeName&&n.nodeName.lastIndexOf(`.`);if(r!==void 0&&r!==-1){let e=n.nodeName.substring(r+1);ko.indexOf(e)!==-1&&(n.nodeName=n.nodeName.substring(0,r),n.objectName=e)}if(n.propertyName===null||n.propertyName.length===0)throw Error(`THREE.PropertyBinding: can not parse propertyName from trackName: `+e);return n}static findNode(e,t){if(t===void 0||t===``||t===`.`||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(e){for(let r=0;r<e.length;r++){let i=e[r];if(i.name===t||i.uuid===t)return i;let a=n(i.children);if(a)return a}return null},r=n(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)e[t++]=n[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let t=this.node,n=this.parsedPath,r=n.objectName,i=n.propertyName,a=n.propertyIndex;if(t||(t=e.findNode(this.rootNode,n.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){R(`PropertyBinding: No target node found for track: `+this.path+`.`);return}if(r){let e=n.objectIndex;switch(r){case`materials`:if(!t.material){z(`PropertyBinding: Can not bind to material as node does not have a material.`,this);return}if(!t.material.materials){z(`PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.`,this);return}t=t.material.materials;break;case`bones`:if(!t.skeleton){z(`PropertyBinding: Can not bind to bones as node does not have a skeleton.`,this);return}t=t.skeleton.bones;for(let n=0;n<t.length;n++)if(t[n].name===e){e=n;break}break;case`map`:if(`map`in t){t=t.map;break}if(!t.material){z(`PropertyBinding: Can not bind to material as node does not have a material.`,this);return}if(!t.material.map){z(`PropertyBinding: Can not bind to material.map as node.material does not have a map.`,this);return}t=t.material.map;break;default:if(t[r]===void 0){z(`PropertyBinding: Can not bind to objectName of node undefined.`,this);return}t=t[r]}if(e!==void 0){if(t[e]===void 0){z(`PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.`,this,t);return}t=t[e]}}let o=t[i];if(o===void 0){let e=n.nodeName;z(`PropertyBinding: Trying to update property for track: `+e+`.`+i+` but it wasn't found.`,t);return}let s=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?s=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(s=this.Versioning.MatrixWorldNeedsUpdate);let c=this.BindingType.Direct;if(a!==void 0){if(i===`morphTargetInfluences`){if(!t.geometry){z(`PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.`,this);return}if(!t.geometry.morphAttributes){z(`PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.`,this);return}t.morphTargetDictionary[a]!==void 0&&(a=t.morphTargetDictionary[a])}c=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=a}else o.fromArray!==void 0&&o.toArray!==void 0?(c=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(c=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=i;this.getValue=this.GetterByBindingType[c],this.setValue=this.SetterByBindingTypeAndVersioning[c][s]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};jo.Composite=Ao,jo.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3},jo.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2},jo.prototype.GetterByBindingType=[jo.prototype._getValue_direct,jo.prototype._getValue_array,jo.prototype._getValue_arrayElement,jo.prototype._getValue_toArray],jo.prototype.SetterByBindingTypeAndVersioning=[[jo.prototype._setValue_direct,jo.prototype._setValue_direct_setNeedsUpdate,jo.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[jo.prototype._setValue_array,jo.prototype._setValue_array_setNeedsUpdate,jo.prototype._setValue_array_setMatrixWorldNeedsUpdate],[jo.prototype._setValue_arrayElement,jo.prototype._setValue_arrayElement_setNeedsUpdate,jo.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[jo.prototype._setValue_fromArray,jo.prototype._setValue_fromArray_setNeedsUpdate,jo.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var Mo=new Xt,No=class{constructor(e,t,n=0,r=1/0){this.ray=new Rr(e,t),this.near=n,this.far=r,this.camera=null,this.layers=new cn,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,t.projectionMatrix.elements[14]).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):z(`Raycaster: Unsupported camera type: `+t.type)}setFromXRController(e){return Mo.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(Mo),this}intersectObject(e,t=!0,n=[]){return Fo(e,this,n,t),n.sort(Po),n}intersectObjects(e,t=!0,n=[]){for(let r=0,i=e.length;r<i;r++)Fo(e[r],this,n,t);return n.sort(Po),n}};function Po(e,t){return e.distance-t.distance}function Fo(e,t,n,r){let i=!0;if(e.layers.test(t.layers)&&e.raycast(t,n)===!1&&(i=!1),i===!0&&r===!0){let r=e.children;for(let e=0,i=r.length;e<i;e++)Fo(r[e],t,n,!0)}}var Io=class{constructor(e=!0){this.autoStart=e,this.startTime=0,this.oldTime=0,this.elapsedTime=0,this.running=!1,R(`Clock: This module has been deprecated. Please use THREE.Timer instead.`)}start(){this.startTime=performance.now(),this.oldTime=this.startTime,this.elapsedTime=0,this.running=!0}stop(){this.getElapsedTime(),this.running=!1,this.autoStart=!1}getElapsedTime(){return this.getDelta(),this.elapsedTime}getDelta(){let e=0;if(this.autoStart&&!this.running)return this.start(),0;if(this.running){let t=performance.now();e=(t-this.oldTime)/1e3,this.oldTime=t,this.elapsedTime+=e}return e}};(class e{static{e.prototype.isMatrix2=!0}constructor(e,t,n,r){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,r)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,r){let i=this.elements;return i[0]=e,i[2]=t,i[1]=n,i[3]=r,this}});function Lo(e,t,n,r){let i=Ro(r);switch(n){case S:return e*t;case D:return e*t/i.components*i.byteLength;case ee:return e*t/i.components*i.byteLength;case O:return e*t*2/i.components*i.byteLength;case k:return e*t*2/i.components*i.byteLength;case C:return e*t*3/i.components*i.byteLength;case w:return e*t*4/i.components*i.byteLength;case te:return e*t*4/i.components*i.byteLength;case A:case j:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case ne:case re:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case ie:case oe:return Math.max(e,16)*Math.max(t,8)/4;case M:case ae:return Math.max(e,8)*Math.max(t,8)/2;case se:case ce:case ue:case N:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case le:case de:case fe:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case pe:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case me:return Math.floor((e+4)/5)*Math.floor((t+3)/4)*16;case he:return Math.floor((e+4)/5)*Math.floor((t+4)/5)*16;case ge:return Math.floor((e+5)/6)*Math.floor((t+4)/5)*16;case _e:return Math.floor((e+5)/6)*Math.floor((t+5)/6)*16;case ve:return Math.floor((e+7)/8)*Math.floor((t+4)/5)*16;case ye:return Math.floor((e+7)/8)*Math.floor((t+5)/6)*16;case be:return Math.floor((e+7)/8)*Math.floor((t+7)/8)*16;case xe:return Math.floor((e+9)/10)*Math.floor((t+4)/5)*16;case Se:return Math.floor((e+9)/10)*Math.floor((t+5)/6)*16;case Ce:return Math.floor((e+9)/10)*Math.floor((t+7)/8)*16;case we:return Math.floor((e+9)/10)*Math.floor((t+9)/10)*16;case Te:return Math.floor((e+11)/12)*Math.floor((t+9)/10)*16;case Ee:return Math.floor((e+11)/12)*Math.floor((t+11)/12)*16;case De:case Oe:case ke:return Math.ceil(e/4)*Math.ceil(t/4)*16;case Ae:case je:return Math.ceil(e/4)*Math.ceil(t/4)*8;case Me:case Ne:return Math.ceil(e/4)*Math.ceil(t/4)*16}throw Error(`Unable to determine texture byte length for ${n} format.`)}function Ro(e){switch(e){case l:case u:return{byteLength:1,components:1};case f:case d:case g:return{byteLength:2,components:1};case _:case v:return{byteLength:2,components:4};case m:case p:case h:return{byteLength:4,components:1};case b:case x:return{byteLength:4,components:3}}throw Error(`THREE.TextureUtils: Unknown texture type ${e}.`)}typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`register`,{detail:{revision:`185`}})),typeof window<`u`&&(window.__THREE__?R(`WARNING: Multiple instances of Three.js being imported.`):window.__THREE__=`185`);function zo(){let e=null,t=!1,n=null,r=null;function i(t,a){n(t,a),r=e.requestAnimationFrame(i)}return{start:function(){t!==!0&&n!==null&&e!==null&&(r=e.requestAnimationFrame(i),t=!0)},stop:function(){e!==null&&e.cancelAnimationFrame(r),t=!1},setAnimationLoop:function(e){n=e},setContext:function(t){e=t}}}function Bo(e){let t=new WeakMap;function n(t,n){let r=t.array,i=t.usage,a=r.byteLength,o=e.createBuffer();e.bindBuffer(n,o),e.bufferData(n,r,i),t.onUploadCallback();let s;if(r instanceof Float32Array)s=e.FLOAT;else if(typeof Float16Array<`u`&&r instanceof Float16Array)s=e.HALF_FLOAT;else if(r instanceof Uint16Array)s=t.isFloat16BufferAttribute?e.HALF_FLOAT:e.UNSIGNED_SHORT;else if(r instanceof Int16Array)s=e.SHORT;else if(r instanceof Uint32Array)s=e.UNSIGNED_INT;else if(r instanceof Int32Array)s=e.INT;else if(r instanceof Int8Array)s=e.BYTE;else if(r instanceof Uint8Array)s=e.UNSIGNED_BYTE;else if(r instanceof Uint8ClampedArray)s=e.UNSIGNED_BYTE;else throw Error(`THREE.WebGLAttributes: Unsupported buffer data format: `+r);return{buffer:o,type:s,bytesPerElement:r.BYTES_PER_ELEMENT,version:t.version,size:a}}function r(t,n,r){let i=n.array,a=n.updateRanges;if(e.bindBuffer(r,t),a.length===0)e.bufferSubData(r,0,i);else{a.sort((e,t)=>e.start-t.start);let t=0;for(let e=1;e<a.length;e++){let n=a[t],r=a[e];r.start<=n.start+n.count+1?n.count=Math.max(n.count,r.start+r.count-n.start):(++t,a[t]=r)}a.length=t+1;for(let t=0,n=a.length;t<n;t++){let n=a[t];e.bufferSubData(r,n.start*i.BYTES_PER_ELEMENT,i,n.start,n.count)}n.clearUpdateRanges()}n.onUploadCallback()}function i(e){return e.isInterleavedBufferAttribute&&(e=e.data),t.get(e)}function a(n){n.isInterleavedBufferAttribute&&(n=n.data);let r=t.get(n);r&&(e.deleteBuffer(r.buffer),t.delete(n))}function o(e,i){if(e.isInterleavedBufferAttribute&&(e=e.data),e.isGLBufferAttribute){let n=t.get(e);(!n||n.version<e.version)&&t.set(e,{buffer:e.buffer,type:e.type,bytesPerElement:e.elementSize,version:e.version});return}let a=t.get(e);if(a===void 0)t.set(e,n(e,i));else if(a.version<e.version){if(a.size!==e.array.byteLength)throw Error(`THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.`);r(a.buffer,e,i),a.version=e.version}}return{get:i,remove:a,update:o}}var q={alphahash_fragment:`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,alphahash_pars_fragment:`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,alphamap_fragment:`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,alphamap_pars_fragment:`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,alphatest_fragment:`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,alphatest_pars_fragment:`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,aomap_fragment:`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,aomap_pars_fragment:`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,batching_pars_vertex:`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,batching_vertex:`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,begin_vertex:`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,beginnormal_vertex:`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,bsdfs:`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,iridescence_fragment:`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,bumpmap_pars_fragment:`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,clipping_planes_fragment:`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,clipping_planes_pars_fragment:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,clipping_planes_pars_vertex:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,clipping_planes_vertex:`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,color_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,color_pars_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,color_pars_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,color_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,common:`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,cube_uv_reflection_fragment:`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,defaultnormal_vertex:`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,displacementmap_pars_vertex:`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,displacementmap_vertex:`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,emissivemap_fragment:`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,emissivemap_pars_fragment:`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,colorspace_fragment:`gl_FragColor = linearToOutputTexel( gl_FragColor );`,colorspace_pars_fragment:`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,envmap_fragment:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,envmap_common_pars_fragment:`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,envmap_pars_fragment:`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,envmap_pars_vertex:`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,envmap_physical_pars_fragment:`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,envmap_vertex:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,fog_vertex:`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,fog_pars_vertex:`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,fog_fragment:`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,fog_pars_fragment:`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,gradientmap_pars_fragment:`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,lightmap_pars_fragment:`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,lights_lambert_fragment:`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,lights_lambert_pars_fragment:`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,lights_pars_begin:`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,lights_toon_fragment:`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,lights_toon_pars_fragment:`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,lights_phong_fragment:`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,lights_phong_pars_fragment:`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,lights_physical_fragment:`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,lights_physical_pars_fragment:`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,lights_fragment_begin:`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,lights_fragment_maps:`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,lights_fragment_end:`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,lightprobes_pars_fragment:`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,logdepthbuf_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,logdepthbuf_pars_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_pars_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,map_fragment:`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,map_pars_fragment:`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,map_particle_fragment:`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,map_particle_pars_fragment:`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,metalnessmap_fragment:`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,metalnessmap_pars_fragment:`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,morphinstance_vertex:`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,morphcolor_vertex:`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,morphnormal_vertex:`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,morphtarget_pars_vertex:`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,morphtarget_vertex:`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,normal_fragment_begin:`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,normal_fragment_maps:`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,normal_pars_fragment:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_pars_vertex:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_vertex:`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,normalmap_pars_fragment:`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,clearcoat_normal_fragment_begin:`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,clearcoat_normal_fragment_maps:`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,clearcoat_pars_fragment:`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,iridescence_pars_fragment:`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,opaque_fragment:`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,packing:`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,premultiplied_alpha_fragment:`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,project_vertex:`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,dithering_fragment:`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,dithering_pars_fragment:`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,roughnessmap_fragment:`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,roughnessmap_pars_fragment:`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,shadowmap_pars_fragment:`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,shadowmap_pars_vertex:`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,shadowmap_vertex:`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,shadowmask_pars_fragment:`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,skinbase_vertex:`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,skinning_pars_vertex:`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,skinning_vertex:`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,skinnormal_vertex:`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,specularmap_fragment:`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,specularmap_pars_fragment:`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,tonemapping_fragment:`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,tonemapping_pars_fragment:`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,transmission_fragment:`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,transmission_pars_fragment:`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,uv_pars_fragment:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_pars_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,worldpos_vertex:`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,background_vert:`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,background_frag:`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,backgroundCube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,backgroundCube_frag:`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,cube_frag:`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,depth_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,depth_frag:`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,distance_vert:`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,distance_frag:`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,equirect_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,equirect_frag:`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,linedashed_vert:`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,linedashed_frag:`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,meshbasic_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,meshbasic_frag:`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshlambert_vert:`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshlambert_frag:`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshmatcap_vert:`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,meshmatcap_frag:`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshnormal_vert:`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,meshnormal_frag:`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,meshphong_vert:`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshphong_frag:`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshphysical_vert:`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,meshphysical_frag:`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshtoon_vert:`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshtoon_frag:`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,points_vert:`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,points_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,shadow_vert:`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,shadow_frag:`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,sprite_vert:`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,sprite_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`},J={common:{diffuse:{value:new G(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new U},alphaMap:{value:null},alphaMapTransform:{value:new U},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new U}},envmap:{envMap:{value:null},envMapRotation:{value:new U},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new U}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new U}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new U},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new U},normalScale:{value:new V(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new U},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new U}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new U}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new U}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new G(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new H},probesMax:{value:new H},probesResolution:{value:new H}},points:{diffuse:{value:new G(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new U},alphaTest:{value:0},uvTransform:{value:new U}},sprite:{diffuse:{value:new G(16777215)},opacity:{value:1},center:{value:new V(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new U},alphaMap:{value:null},alphaMapTransform:{value:new U},alphaTest:{value:0}}},Vo={basic:{uniforms:va([J.common,J.specularmap,J.envmap,J.aomap,J.lightmap,J.fog]),vertexShader:q.meshbasic_vert,fragmentShader:q.meshbasic_frag},lambert:{uniforms:va([J.common,J.specularmap,J.envmap,J.aomap,J.lightmap,J.emissivemap,J.bumpmap,J.normalmap,J.displacementmap,J.fog,J.lights,{emissive:{value:new G(0)},envMapIntensity:{value:1}}]),vertexShader:q.meshlambert_vert,fragmentShader:q.meshlambert_frag},phong:{uniforms:va([J.common,J.specularmap,J.envmap,J.aomap,J.lightmap,J.emissivemap,J.bumpmap,J.normalmap,J.displacementmap,J.fog,J.lights,{emissive:{value:new G(0)},specular:{value:new G(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:q.meshphong_vert,fragmentShader:q.meshphong_frag},standard:{uniforms:va([J.common,J.envmap,J.aomap,J.lightmap,J.emissivemap,J.bumpmap,J.normalmap,J.displacementmap,J.roughnessmap,J.metalnessmap,J.fog,J.lights,{emissive:{value:new G(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:q.meshphysical_vert,fragmentShader:q.meshphysical_frag},toon:{uniforms:va([J.common,J.aomap,J.lightmap,J.emissivemap,J.bumpmap,J.normalmap,J.displacementmap,J.gradientmap,J.fog,J.lights,{emissive:{value:new G(0)}}]),vertexShader:q.meshtoon_vert,fragmentShader:q.meshtoon_frag},matcap:{uniforms:va([J.common,J.bumpmap,J.normalmap,J.displacementmap,J.fog,{matcap:{value:null}}]),vertexShader:q.meshmatcap_vert,fragmentShader:q.meshmatcap_frag},points:{uniforms:va([J.points,J.fog]),vertexShader:q.points_vert,fragmentShader:q.points_frag},dashed:{uniforms:va([J.common,J.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:q.linedashed_vert,fragmentShader:q.linedashed_frag},depth:{uniforms:va([J.common,J.displacementmap]),vertexShader:q.depth_vert,fragmentShader:q.depth_frag},normal:{uniforms:va([J.common,J.bumpmap,J.normalmap,J.displacementmap,{opacity:{value:1}}]),vertexShader:q.meshnormal_vert,fragmentShader:q.meshnormal_frag},sprite:{uniforms:va([J.sprite,J.fog]),vertexShader:q.sprite_vert,fragmentShader:q.sprite_frag},background:{uniforms:{uvTransform:{value:new U},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:q.background_vert,fragmentShader:q.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new U}},vertexShader:q.backgroundCube_vert,fragmentShader:q.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:q.cube_vert,fragmentShader:q.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:q.equirect_vert,fragmentShader:q.equirect_frag},distance:{uniforms:va([J.common,J.displacementmap,{referencePosition:{value:new H},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:q.distance_vert,fragmentShader:q.distance_frag},shadow:{uniforms:va([J.lights,J.fog,{color:{value:new G(0)},opacity:{value:1}}]),vertexShader:q.shadow_vert,fragmentShader:q.shadow_frag}};Vo.physical={uniforms:va([Vo.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new U},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new U},clearcoatNormalScale:{value:new V(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new U},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new U},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new U},sheen:{value:0},sheenColor:{value:new G(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new U},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new U},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new U},transmissionSamplerSize:{value:new V},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new U},attenuationDistance:{value:0},attenuationColor:{value:new G(0)},specularColor:{value:new G(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new U},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new U},anisotropyVector:{value:new V},anisotropyMap:{value:null},anisotropyMapTransform:{value:new U}}]),vertexShader:q.meshphysical_vert,fragmentShader:q.meshphysical_frag};var Ho={r:0,b:0,g:0},Uo=new Xt,Wo=new U;Wo.set(-1,0,0,0,1,0,0,0,1);function Go(e,t,n,r,i,a){let o=new G(0),s=i===!0?0:1,c,l,u=null,d=0,f=null;function p(e){let n=e.isScene===!0?e.background:null;if(n&&n.isTexture){let r=e.backgroundBlurriness>0;n=t.get(n,r)}return n}function m(t){let r=!1,i=p(t);i===null?g(o,s):i&&i.isColor&&(g(i,1),r=!0);let c=e.xr.getEnvironmentBlendMode();c===`additive`?n.buffers.color.setClear(0,0,0,1,a):c===`alpha-blend`&&n.buffers.color.setClear(0,0,0,0,a),(e.autoClear||r)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil))}function h(t,n){let i=p(n);i&&(i.isCubeTexture||i.mapping===306)?(l===void 0&&(l=new K(new Fi(1,1,1),new Ta({name:`BackgroundCubeMaterial`,uniforms:_a(Vo.backgroundCube.uniforms),vertexShader:Vo.backgroundCube.vertexShader,fragmentShader:Vo.backgroundCube.fragmentShader,side:1,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute(`normal`),l.geometry.deleteAttribute(`uv`),l.onBeforeRender=function(e,t,n){this.matrixWorld.copyPosition(n.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),r.update(l)),l.material.uniforms.envMap.value=i,l.material.uniforms.backgroundBlurriness.value=n.backgroundBlurriness,l.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,l.material.uniforms.backgroundRotation.value.setFromMatrix4(Uo.makeRotationFromEuler(n.backgroundRotation)).transpose(),i.isCubeTexture&&i.isRenderTargetTexture===!1&&l.material.uniforms.backgroundRotation.value.premultiply(Wo),l.material.toneMapped=W.getTransfer(i.colorSpace)!==Ve,(u!==i||d!==i.version||f!==e.toneMapping)&&(l.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),l.layers.enableAll(),t.unshift(l,l.geometry,l.material,0,0,null)):i&&i.isTexture&&(c===void 0&&(c=new K(new pa(2,2),new Ta({name:`BackgroundMaterial`,uniforms:_a(Vo.background.uniforms),vertexShader:Vo.background.vertexShader,fragmentShader:Vo.background.fragmentShader,side:0,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute(`normal`),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),r.update(c)),c.material.uniforms.t2D.value=i,c.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,c.material.toneMapped=W.getTransfer(i.colorSpace)!==Ve,i.matrixAutoUpdate===!0&&i.updateMatrix(),c.material.uniforms.uvTransform.value.copy(i.matrix),(u!==i||d!==i.version||f!==e.toneMapping)&&(c.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),c.layers.enableAll(),t.unshift(c,c.geometry,c.material,0,0,null))}function g(t,r){t.getRGB(Ho,xa(e)),n.buffers.color.setClear(Ho.r,Ho.g,Ho.b,r,a)}function _(){l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return o},setClearColor:function(e,t=1){o.set(e),s=t,g(o,s)},getClearAlpha:function(){return s},setClearAlpha:function(e){s=e,g(o,s)},render:m,addToRenderList:h,dispose:_}}function Ko(e,t){let n=e.getParameter(e.MAX_VERTEX_ATTRIBS),r={},i=f(null),a=i,o=!1;function s(n,r,i,s,c){let u=!1,f=d(n,s,i,r);a!==f&&(a=f,l(a.object)),u=p(n,s,i,c),u&&m(n,s,i,c),c!==null&&t.update(c,e.ELEMENT_ARRAY_BUFFER),(u||o)&&(o=!1,b(n,r,i,s),c!==null&&e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t.get(c).buffer))}function c(){return e.createVertexArray()}function l(t){return e.bindVertexArray(t)}function u(t){return e.deleteVertexArray(t)}function d(e,t,n,i){let a=i.wireframe===!0,o=r[t.id];o===void 0&&(o={},r[t.id]=o);let s=e.isInstancedMesh===!0?e.id:0,l=o[s];l===void 0&&(l={},o[s]=l);let u=l[n.id];u===void 0&&(u={},l[n.id]=u);let d=u[a];return d===void 0&&(d=f(c()),u[a]=d),d}function f(e){let t=[],r=[],i=[];for(let e=0;e<n;e++)t[e]=0,r[e]=0,i[e]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:t,enabledAttributes:r,attributeDivisors:i,object:e,attributes:{},index:null}}function p(e,t,n,r){let i=a.attributes,o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=i[t],r=o[t];if(r===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(r=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(r=e.instanceColor)),n===void 0||n.attribute!==r||r&&n.data!==r.data)return!0;s++}return a.attributesNum!==s||a.index!==r}function m(e,t,n,r){let i={},o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=o[t];n===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(n=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(n=e.instanceColor));let r={};r.attribute=n,n&&n.data&&(r.data=n.data),i[t]=r,s++}a.attributes=i,a.attributesNum=s,a.index=r}function h(){let e=a.newAttributes;for(let t=0,n=e.length;t<n;t++)e[t]=0}function g(e){_(e,0)}function _(t,n){let r=a.newAttributes,i=a.enabledAttributes,o=a.attributeDivisors;r[t]=1,i[t]===0&&(e.enableVertexAttribArray(t),i[t]=1),o[t]!==n&&(e.vertexAttribDivisor(t,n),o[t]=n)}function v(){let t=a.newAttributes,n=a.enabledAttributes;for(let r=0,i=n.length;r<i;r++)n[r]!==t[r]&&(e.disableVertexAttribArray(r),n[r]=0)}function y(t,n,r,i,a,o,s){s===!0?e.vertexAttribIPointer(t,n,r,a,o):e.vertexAttribPointer(t,n,r,i,a,o)}function b(n,r,i,a){h();let o=a.attributes,s=i.getAttributes(),c=r.defaultAttributeValues;for(let r in s){let i=s[r];if(i.location>=0){let s=o[r];if(s===void 0&&(r===`instanceMatrix`&&n.instanceMatrix&&(s=n.instanceMatrix),r===`instanceColor`&&n.instanceColor&&(s=n.instanceColor)),s!==void 0){let r=s.normalized,o=s.itemSize,c=t.get(s);if(c===void 0)continue;let l=c.buffer,u=c.type,d=c.bytesPerElement,f=u===e.INT||u===e.UNSIGNED_INT||s.gpuType===1013;if(s.isInterleavedBufferAttribute){let t=s.data,c=t.stride,p=s.offset;if(t.isInstancedInterleavedBuffer){for(let e=0;e<i.locationSize;e++)_(i.location+e,t.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=t.meshPerAttribute*t.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,c*d,(p+o/i.locationSize*e)*d,f)}else{if(s.isInstancedBufferAttribute){for(let e=0;e<i.locationSize;e++)_(i.location+e,s.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=s.meshPerAttribute*s.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,o*d,o/i.locationSize*e*d,f)}}else if(c!==void 0){let t=c[r];if(t!==void 0)switch(t.length){case 2:e.vertexAttrib2fv(i.location,t);break;case 3:e.vertexAttrib3fv(i.location,t);break;case 4:e.vertexAttrib4fv(i.location,t);break;default:e.vertexAttrib1fv(i.location,t)}}}}v()}function x(){T();for(let e in r){let t=r[e];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e]}}function S(e){if(r[e.id]===void 0)return;let t=r[e.id];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e.id]}function C(e){for(let t in r){let n=r[t];for(let t in n){let r=n[t];if(r[e.id]===void 0)continue;let i=r[e.id];for(let e in i)u(i[e].object),delete i[e];delete r[e.id]}}}function w(e){for(let t in r){let n=r[t],i=e.isInstancedMesh===!0?e.id:0,a=n[i];if(a!==void 0){for(let e in a){let t=a[e];for(let e in t)u(t[e].object),delete t[e];delete a[e]}delete n[i],Object.keys(n).length===0&&delete r[t]}}}function T(){E(),o=!0,a!==i&&(a=i,l(a.object))}function E(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:s,reset:T,resetDefaultState:E,dispose:x,releaseStatesOfGeometry:S,releaseStatesOfObject:w,releaseStatesOfProgram:C,initAttributes:h,enableAttribute:g,disableUnusedAttributes:v}}function qo(e,t,n){let r;function i(e){r=e}function a(t,i){e.drawArrays(r,t,i),n.update(i,r,1)}function o(t,i,a){a!==0&&(e.drawArraysInstanced(r,t,i,a),n.update(i,r,a))}function s(e,i,a){if(a===0)return;t.get(`WEBGL_multi_draw`).multiDrawArraysWEBGL(r,e,0,i,0,a);let o=0;for(let e=0;e<a;e++)o+=i[e];n.update(o,r,1)}this.setMode=i,this.render=a,this.renderInstances=o,this.renderMultiDraw=s}function Jo(e,t,n,r){let i;function a(){if(i!==void 0)return i;if(t.has(`EXT_texture_filter_anisotropic`)===!0){let n=t.get(`EXT_texture_filter_anisotropic`);i=e.getParameter(n.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function o(t){return t===1023||r.convert(t)===e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT)}function s(n){let i=n===1016&&(t.has(`EXT_color_buffer_half_float`)||t.has(`EXT_color_buffer_float`));return!(n!==1009&&r.convert(n)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE)&&n!==1015&&!i)}function c(t){if(t===`highp`){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return`highp`;t=`mediump`}return t===`mediump`&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?`mediump`:`lowp`}let l=n.precision===void 0?`highp`:n.precision,u=c(l);u!==l&&(R(`WebGLRenderer:`,l,`not supported, using`,u,`instead.`),l=u);let d=n.logarithmicDepthBuffer===!0,f=n.reversedDepthBuffer===!0&&t.has(`EXT_clip_control`);n.reversedDepthBuffer===!0&&f===!1&&R(`WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.`);let p=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),m=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),h=e.getParameter(e.MAX_TEXTURE_SIZE),g=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),_=e.getParameter(e.MAX_VERTEX_ATTRIBS),v=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),y=e.getParameter(e.MAX_VARYING_VECTORS),b=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),x=e.getParameter(e.MAX_SAMPLES),S=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:a,getMaxPrecision:c,textureFormatReadable:o,textureTypeReadable:s,precision:l,logarithmicDepthBuffer:d,reversedDepthBuffer:f,maxTextures:p,maxVertexTextures:m,maxTextureSize:h,maxCubemapSize:g,maxAttributes:_,maxVertexUniforms:v,maxVaryings:y,maxFragmentUniforms:b,maxSamples:x,samples:S}}function Yo(e){let t=this,n=null,r=0,i=!1,a=!1,o=new fi,s=new U,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(e,t){let n=e.length!==0||t||r!==0||i;return i=t,r=e.length,n},this.beginShadows=function(){a=!0,u(null)},this.endShadows=function(){a=!1},this.setGlobalState=function(e,t){n=u(e,t,0)},this.setState=function(t,o,s){let d=t.clippingPlanes,f=t.clipIntersection,p=t.clipShadows,m=e.get(t);if(!i||d===null||d.length===0||a&&!p)a?u(null):l();else{let e=a?0:r,t=e*4,i=m.clippingState||null;c.value=i,i=u(d,o,t,s);for(let e=0;e!==t;++e)i[e]=n[e];m.clippingState=i,this.numIntersection=f?this.numPlanes:0,this.numPlanes+=e}};function l(){c.value!==n&&(c.value=n,c.needsUpdate=r>0),t.numPlanes=r,t.numIntersection=0}function u(e,n,r,i){let a=e===null?0:e.length,l=null;if(a!==0){if(l=c.value,i!==!0||l===null){let t=r+a*4,i=n.matrixWorldInverse;s.getNormalMatrix(i),(l===null||l.length<t)&&(l=new Float32Array(t));for(let t=0,n=r;t!==a;++t,n+=4)o.copy(e[t]).applyMatrix4(i,s),o.normal.toArray(l,n),l[n+3]=o.constant}c.value=l,c.needsUpdate=!0}return t.numPlanes=a,t.numIntersection=0,l}}var Xo=4,Zo=[.125,.215,.35,.446,.526,.582],Qo=20,$o=256,es=new fo,ts=new G,ns=null,rs=0,is=0,as=!1,os=new H,ss=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,r=100,i={}){let{size:a=256,position:o=os}=i;ns=this._renderer.getRenderTarget(),rs=this._renderer.getActiveCubeFace(),is=this._renderer.getActiveMipmapLevel(),as=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);let s=this._allocateTargets();return s.depthBuffer=!0,this._sceneToCubeUV(e,n,r,s,o),t>0&&this._blur(s,0,0,t),this._applyPMREM(s),this._cleanup(s),s}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=ms(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=ps(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=2**this._lodMax}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(ns,rs,is),this._renderer.xr.enabled=as,e.scissorTest=!1,us(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===301||e.mapping===302?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),ns=this._renderer.getRenderTarget(),rs=this._renderer.getActiveCubeFace(),is=this._renderer.getActiveMipmapLevel(),as=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:o,minFilter:o,generateMipmaps:!1,type:g,format:w,colorSpace:L,depthBuffer:!1},r=ls(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=ls(e,t,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=cs(r)),this._blurMaterial=fs(r,e,t),this._ggxMaterial=ds(r,e,t)}return r}_compileMaterial(e){let t=new K(new Or,e);this._renderer.compile(t,es)}_sceneToCubeUV(e,t,n,r,i){let a=new uo(90,1,t,n),o=[1,-1,1,1,1,1],s=[1,1,1,-1,-1,-1],c=this._renderer,l=c.autoClear,u=c.toneMapping;c.getClearColor(ts),c.toneMapping=0,c.autoClear=!1,c.state.buffers.depth.getReversed()&&(c.setRenderTarget(r),c.clearDepth(),c.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new K(new Fi,new zr({name:`PMREM.Background`,side:1,depthWrite:!1,depthTest:!1})));let d=this._backgroundBox,f=d.material,p=!1,m=e.background;m?m.isColor&&(f.color.copy(m),e.background=null,p=!0):(f.color.copy(ts),p=!0);for(let t=0;t<6;t++){let n=t%3;n===0?(a.up.set(0,o[t],0),a.position.set(i.x,i.y,i.z),a.lookAt(i.x+s[t],i.y,i.z)):n===1?(a.up.set(0,0,o[t]),a.position.set(i.x,i.y,i.z),a.lookAt(i.x,i.y+s[t],i.z)):(a.up.set(0,o[t],0),a.position.set(i.x,i.y,i.z),a.lookAt(i.x,i.y,i.z+s[t]));let l=this._cubeSize;us(r,n*l,t>2?l:0,l,l),c.setRenderTarget(r),p&&c.render(d,a),c.render(e,a)}c.toneMapping=u,c.autoClear=l,e.background=m}_textureToCubeUV(e,t){let n=this._renderer,r=e.mapping===301||e.mapping===302;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=ms()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=ps());let i=r?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=i;let o=i.uniforms;o.envMap.value=e;let s=this._cubeSize;us(t,0,0,3*s,2*s),n.setRenderTarget(t),n.render(a,es)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let r=this._lodMeshes.length;for(let t=1;t<r;t++)this._applyGGXFilter(e,t-1,t);t.autoClear=n}_applyGGXFilter(e,t,n){let r=this._renderer,i=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;let s=a.uniforms,c=n/(this._lodMeshes.length-1),l=t/(this._lodMeshes.length-1),u=Math.sqrt(c*c-l*l)*(0+c*1.25),{_lodMax:d}=this,f=this._sizeLods[n],p=3*f*(n>d-Xo?n-d+Xo:0),m=4*(this._cubeSize-f);s.envMap.value=e.texture,s.roughness.value=u,s.mipInt.value=d-t,us(i,p,m,3*f,2*f),r.setRenderTarget(i),r.render(o,es),s.envMap.value=i.texture,s.roughness.value=0,s.mipInt.value=d-n,us(e,p,m,3*f,2*f),r.setRenderTarget(e),r.render(o,es)}_blur(e,t,n,r,i){let a=this._pingPongRenderTarget;this._halfBlur(e,a,t,n,r,`latitudinal`,i),this._halfBlur(a,e,n,n,r,`longitudinal`,i)}_halfBlur(e,t,n,r,i,a,o){let s=this._renderer,c=this._blurMaterial;a!==`latitudinal`&&a!==`longitudinal`&&z(`blur direction must be either latitudinal or longitudinal!`);let l=this._lodMeshes[r];l.material=c;let u=c.uniforms,d=this._sizeLods[n]-1,f=isFinite(i)?Math.PI/(2*d):2*Math.PI/39,p=i/f,m=isFinite(i)?1+Math.floor(3*p):Qo;m>Qo&&R(`sigmaRadians, ${i}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${Qo}`);let h=[],g=0;for(let e=0;e<Qo;++e){let t=e/p,n=Math.exp(-t*t/2);h.push(n),e===0?g+=n:e<m&&(g+=2*n)}for(let e=0;e<h.length;e++)h[e]=h[e]/g;u.envMap.value=e.texture,u.samples.value=m,u.weights.value=h,u.latitudinal.value=a===`latitudinal`,o&&(u.poleAxis.value=o);let{_lodMax:_}=this;u.dTheta.value=f,u.mipInt.value=_-n;let v=this._sizeLods[r];us(t,3*v*(r>_-Xo?r-_+Xo:0),4*(this._cubeSize-v),3*v,2*v),s.setRenderTarget(t),s.render(l,es)}};function cs(e){let t=[],n=[],r=[],i=e,a=e-Xo+1+Zo.length;for(let o=0;o<a;o++){let a=2**i;t.push(a);let s=1/a;o>e-Xo?s=Zo[o-e+Xo-1]:o===0&&(s=0),n.push(s);let c=1/(a-2),l=-c,u=1+c,d=[l,l,u,l,u,u,l,l,u,u,l,u],f=new Float32Array(108),p=new Float32Array(72),m=new Float32Array(36);for(let e=0;e<6;e++){let t=e%3*2/3-1,n=e>2?0:-1,r=[t,n,0,t+2/3,n,0,t+2/3,n+1,0,t,n,0,t+2/3,n+1,0,t,n+1,0];f.set(r,18*e),p.set(d,12*e);let i=[e,e,e,e,e,e];m.set(i,6*e)}let h=new Or;h.setAttribute(`position`,new pr(f,3)),h.setAttribute(`uv`,new pr(p,2)),h.setAttribute(`faceIndex`,new pr(m,1)),r.push(new K(h,null)),i>Xo&&i--}return{lodMeshes:r,sizeLods:t,sigmas:n}}function ls(e,t,n){let r=new qt(e,t,n);return r.texture.mapping=306,r.texture.name=`PMREM.cubeUv`,r.scissorTest=!0,r}function us(e,t,n,r,i){e.viewport.set(t,n,r,i),e.scissor.set(t,n,r,i)}function ds(e,t,n){return new Ta({name:`PMREMGGXConvolution`,defines:{GGX_SAMPLES:$o,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:hs(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function fs(e,t,n){let r=new Float32Array(Qo),i=new H(0,1,0);return new Ta({name:`SphericalGaussianBlur`,defines:{n:Qo,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:r},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:i}},vertexShader:hs(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function ps(){return new Ta({name:`EquirectangularToCubeUV`,uniforms:{envMap:{value:null}},vertexShader:hs(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function ms(){return new Ta({name:`CubemapToCubeUV`,uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:hs(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function hs(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}var gs=class extends qt{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},r=[n,n,n,n,n,n];this.texture=new Ai(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new Fi(5,5,5),i=new Ta({name:`CubemapFromEquirect`,uniforms:_a(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:1,blending:0});i.uniforms.tEquirect.value=t;let a=new K(r,i),s=t.minFilter;return t.minFilter===1008&&(t.minFilter=o),new vo(1,10,this).update(e,a),t.minFilter=s,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,r=!0){let i=e.getRenderTarget();for(let i=0;i<6;i++)e.setRenderTarget(this,i),e.clear(t,n,r);e.setRenderTarget(i)}};function _s(e){let t=new WeakMap,n=new WeakMap,r=null;function i(e,t=!1){return e==null?null:t?o(e):a(e)}function a(n){if(n&&n.isTexture){let r=n.mapping;if(r===303||r===304){if(t.has(n)){let e=t.get(n).texture;return s(e,n.mapping)}{let r=n.image;if(r&&r.height>0){let i=new gs(r.height);return i.fromEquirectangularTexture(e,n),t.set(n,i),n.addEventListener(`dispose`,l),s(i.texture,n.mapping)}return null}}}return n}function o(t){if(t&&t.isTexture){let i=t.mapping,a=i===303||i===304,o=i===301||i===302;if(a||o){let i=n.get(t),s=i===void 0?0:i.texture.pmremVersion;if(t.isRenderTargetTexture&&t.pmremVersion!==s)return r===null&&(r=new ss(e)),i=a?r.fromEquirectangular(t,i):r.fromCubemap(t,i),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),i.texture;if(i!==void 0)return i.texture;{let s=t.image;return a&&s&&s.height>0||o&&s&&c(s)?(r===null&&(r=new ss(e)),i=a?r.fromEquirectangular(t):r.fromCubemap(t),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),t.addEventListener(`dispose`,u),i.texture):null}}}return t}function s(e,t){return t===303?e.mapping=301:t===304&&(e.mapping=302),e}function c(e){let t=0;for(let n=0;n<6;n++)e[n]!==void 0&&t++;return t===6}function l(e){let n=e.target;n.removeEventListener(`dispose`,l);let r=t.get(n);r!==void 0&&(t.delete(n),r.dispose())}function u(e){let t=e.target;t.removeEventListener(`dispose`,u);let r=n.get(t);r!==void 0&&(n.delete(t),r.dispose())}function d(){t=new WeakMap,n=new WeakMap,r!==null&&(r.dispose(),r=null)}return{get:i,dispose:d}}function vs(e){let t={};function n(n){if(t[n]!==void 0)return t[n];let r=e.getExtension(n);return t[n]=r,r}return{has:function(e){return n(e)!==null},init:function(){n(`EXT_color_buffer_float`),n(`WEBGL_clip_cull_distance`),n(`OES_texture_float_linear`),n(`EXT_color_buffer_half_float`),n(`WEBGL_multisampled_render_to_texture`),n(`WEBGL_render_shared_exponent`)},get:function(e){let t=n(e);return t===null&&Qe(`WebGLRenderer: `+e+` extension not supported.`),t}}}function ys(e,t,n,r){let i={},a=new WeakMap;function o(e){let s=e.target;s.index!==null&&t.remove(s.index);for(let e in s.attributes)t.remove(s.attributes[e]);s.removeEventListener(`dispose`,o),delete i[s.id];let c=a.get(s);c&&(t.remove(c),a.delete(s)),r.releaseStatesOfGeometry(s),s.isInstancedBufferGeometry===!0&&delete s._maxInstanceCount,n.memory.geometries--}function s(e,t){return i[t.id]===!0?t:(t.addEventListener(`dispose`,o),i[t.id]=!0,n.memory.geometries++,t)}function c(n){let r=n.attributes;for(let n in r)t.update(r[n],e.ARRAY_BUFFER)}function l(e){let n=[],r=e.index,i=e.attributes.position,o=0;if(i===void 0)return;if(r!==null){let e=r.array;o=r.version;for(let t=0,r=e.length;t<r;t+=3){let r=e[t+0],i=e[t+1],a=e[t+2];n.push(r,i,i,a,a,r)}}else{let e=i.array;o=i.version;for(let t=0,r=e.length/3-1;t<r;t+=3){let e=t+0,r=t+1,i=t+2;n.push(e,r,r,i,i,e)}}let s=new(i.count>=65535?hr:mr)(n,1);s.version=o;let c=a.get(e);c&&t.remove(c),a.set(e,s)}function u(e){let t=a.get(e);if(t){let n=e.index;n!==null&&t.version<n.version&&l(e)}else l(e);return a.get(e)}return{get:s,update:c,getWireframeAttribute:u}}function bs(e,t,n){let r;function i(e){r=e}let a,o;function s(e){a=e.type,o=e.bytesPerElement}function c(t,i){e.drawElements(r,i,a,t*o),n.update(i,r,1)}function l(t,i,s){s!==0&&(e.drawElementsInstanced(r,i,a,t*o,s),n.update(i,r,s))}function u(e,i,o){if(o===0)return;t.get(`WEBGL_multi_draw`).multiDrawElementsWEBGL(r,i,0,a,e,0,o);let s=0;for(let e=0;e<o;e++)s+=i[e];n.update(s,r,1)}this.setMode=i,this.setIndex=s,this.render=c,this.renderInstances=l,this.renderMultiDraw=u}function xs(e){let t={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function r(t,r,i){switch(n.calls++,r){case e.TRIANGLES:n.triangles+=t/3*i;break;case e.LINES:n.lines+=t/2*i;break;case e.LINE_STRIP:n.lines+=i*(t-1);break;case e.LINE_LOOP:n.lines+=i*t;break;case e.POINTS:n.points+=i*t;break;default:z(`WebGLInfo: Unknown draw mode:`,r)}}function i(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:t,render:n,programs:null,autoReset:!0,reset:i,update:r}}function Ss(e,t,n){let r=new WeakMap,i=new Gt;function a(a,o,s){let c=a.morphTargetInfluences,l=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=l===void 0?0:l.length,d=r.get(o);if(d===void 0||d.count!==u){d!==void 0&&d.texture.dispose();let e=o.morphAttributes.position!==void 0,n=o.morphAttributes.normal!==void 0,a=o.morphAttributes.color!==void 0,s=o.morphAttributes.position||[],c=o.morphAttributes.normal||[],l=o.morphAttributes.color||[],f=0;e===!0&&(f=1),n===!0&&(f=2),a===!0&&(f=3);let p=o.attributes.position.count*f,m=1;p>t.maxTextureSize&&(m=Math.ceil(p/t.maxTextureSize),p=t.maxTextureSize);let g=new Float32Array(p*m*4*u),_=new Jt(g,p,m,u);_.type=h,_.needsUpdate=!0;let v=f*4;for(let t=0;t<u;t++){let r=s[t],o=c[t],u=l[t],d=p*m*4*t;for(let t=0;t<r.count;t++){let s=t*v;e===!0&&(i.fromBufferAttribute(r,t),g[d+s+0]=i.x,g[d+s+1]=i.y,g[d+s+2]=i.z,g[d+s+3]=0),n===!0&&(i.fromBufferAttribute(o,t),g[d+s+4]=i.x,g[d+s+5]=i.y,g[d+s+6]=i.z,g[d+s+7]=0),a===!0&&(i.fromBufferAttribute(u,t),g[d+s+8]=i.x,g[d+s+9]=i.y,g[d+s+10]=i.z,g[d+s+11]=u.itemSize===4?i.w:1)}}d={count:u,texture:_,size:new V(p,m)},r.set(o,d);function y(){_.dispose(),r.delete(o),o.removeEventListener(`dispose`,y)}o.addEventListener(`dispose`,y)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)s.getUniforms().setValue(e,`morphTexture`,a.morphTexture,n);else{let t=0;for(let e=0;e<c.length;e++)t+=c[e];let n=o.morphTargetsRelative?1:1-t;s.getUniforms().setValue(e,`morphTargetBaseInfluence`,n),s.getUniforms().setValue(e,`morphTargetInfluences`,c)}s.getUniforms().setValue(e,`morphTargetsTexture`,d.texture,n),s.getUniforms().setValue(e,`morphTargetsTextureSize`,d.size)}return{update:a}}function Cs(e,t,n,r,i){let a=new WeakMap;function o(r){let o=i.render.frame,s=r.geometry,l=t.get(r,s);if(a.get(l)!==o&&(t.update(l),a.set(l,o)),r.isInstancedMesh&&(r.hasEventListener(`dispose`,c)===!1&&r.addEventListener(`dispose`,c),a.get(r)!==o&&(n.update(r.instanceMatrix,e.ARRAY_BUFFER),r.instanceColor!==null&&n.update(r.instanceColor,e.ARRAY_BUFFER),a.set(r,o))),r.isSkinnedMesh){let e=r.skeleton;a.get(e)!==o&&(e.update(),a.set(e,o))}return l}function s(){a=new WeakMap}function c(e){let t=e.target;t.removeEventListener(`dispose`,c),r.releaseStatesOfObject(t),n.remove(t.instanceMatrix),t.instanceColor!==null&&n.remove(t.instanceColor)}return{update:o,dispose:s}}var ws={1:`LINEAR_TONE_MAPPING`,2:`REINHARD_TONE_MAPPING`,3:`CINEON_TONE_MAPPING`,4:`ACES_FILMIC_TONE_MAPPING`,6:`AGX_TONE_MAPPING`,7:`NEUTRAL_TONE_MAPPING`,5:`CUSTOM_TONE_MAPPING`};function Ts(e,t,n,r,i,a){let o=new qt(t,n,{type:e,depthBuffer:i,stencilBuffer:a,samples:r?4:0,depthTexture:i?new Mi(t,n):void 0}),s=new qt(t,n,{type:g,depthBuffer:!1,stencilBuffer:!1}),c=new Or;c.setAttribute(`position`,new gr([-1,3,0,-1,-1,0,3,-1,0],3)),c.setAttribute(`uv`,new gr([0,2,0,0,2,0],2));let l=new Ea({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),u=new K(c,l),d=new fo(-1,1,1,-1,0,1),f=null,p=null,m=!1,h,_=null,v=[],y=!1;this.setSize=function(e,t){o.setSize(e,t),s.setSize(e,t);for(let n=0;n<v.length;n++){let r=v[n];r.setSize&&r.setSize(e,t)}},this.setEffects=function(e){v=e,y=v.length>0&&v[0].isRenderPass===!0;let t=o.width,n=o.height;for(let e=0;e<v.length;e++){let r=v[e];r.setSize&&r.setSize(t,n)}},this.begin=function(e,t){if(m||e.toneMapping===0&&v.length===0)return!1;if(_=t,t!==null){let e=t.width,n=t.height;(o.width!==e||o.height!==n)&&this.setSize(e,n)}return y===!1&&e.setRenderTarget(o),h=e.toneMapping,e.toneMapping=0,!0},this.hasRenderPass=function(){return y},this.end=function(e,t){e.toneMapping=h,m=!0;let n=o,r=s;for(let i=0;i<v.length;i++){let a=v[i];if(a.enabled!==!1&&(a.render(e,r,n,t),a.needsSwap!==!1)){let e=n;n=r,r=e}}if(f!==e.outputColorSpace||p!==e.toneMapping){f=e.outputColorSpace,p=e.toneMapping,l.defines={},W.getTransfer(f)===`srgb`&&(l.defines.SRGB_TRANSFER=``);let t=ws[p];t&&(l.defines[t]=``),l.needsUpdate=!0}l.uniforms.tDiffuse.value=n.texture,e.setRenderTarget(_),e.render(u,d),_=null,m=!1},this.isCompositing=function(){return m},this.dispose=function(){o.depthTexture&&o.depthTexture.dispose(),o.dispose(),s.dispose(),c.dispose(),l.dispose()}}var Es=new Wt,Ds=new Mi(1,1),Os=new Jt,ks=new Yt,As=new Ai,js=[],Ms=[],Ns=new Float32Array(16),Ps=new Float32Array(9),Fs=new Float32Array(4);function Is(e,t,n){let r=e[0];if(r<=0||r>0)return e;let i=t*n,a=js[i];if(a===void 0&&(a=new Float32Array(i),js[i]=a),t!==0){r.toArray(a,0);for(let r=1,i=0;r!==t;++r)i+=n,e[r].toArray(a,i)}return a}function Ls(e,t){if(e.length!==t.length)return!1;for(let n=0,r=e.length;n<r;n++)if(e[n]!==t[n])return!1;return!0}function Rs(e,t){for(let n=0,r=t.length;n<r;n++)e[n]=t[n]}function zs(e,t){let n=Ms[t];n===void 0&&(n=new Int32Array(t),Ms[t]=n);for(let r=0;r!==t;++r)n[r]=e.allocateTextureUnit();return n}function Bs(e,t){let n=this.cache;n[0]!==t&&(e.uniform1f(this.addr,t),n[0]=t)}function Vs(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2f(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(Ls(n,t))return;e.uniform2fv(this.addr,t),Rs(n,t)}}function Hs(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3f(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else if(t.r!==void 0)(n[0]!==t.r||n[1]!==t.g||n[2]!==t.b)&&(e.uniform3f(this.addr,t.r,t.g,t.b),n[0]=t.r,n[1]=t.g,n[2]=t.b);else{if(Ls(n,t))return;e.uniform3fv(this.addr,t),Rs(n,t)}}function Us(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4f(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(Ls(n,t))return;e.uniform4fv(this.addr,t),Rs(n,t)}}function Ws(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(Ls(n,t))return;e.uniformMatrix2fv(this.addr,!1,t),Rs(n,t)}else{if(Ls(n,r))return;Fs.set(r),e.uniformMatrix2fv(this.addr,!1,Fs),Rs(n,r)}}function Gs(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(Ls(n,t))return;e.uniformMatrix3fv(this.addr,!1,t),Rs(n,t)}else{if(Ls(n,r))return;Ps.set(r),e.uniformMatrix3fv(this.addr,!1,Ps),Rs(n,r)}}function Ks(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(Ls(n,t))return;e.uniformMatrix4fv(this.addr,!1,t),Rs(n,t)}else{if(Ls(n,r))return;Ns.set(r),e.uniformMatrix4fv(this.addr,!1,Ns),Rs(n,r)}}function qs(e,t){let n=this.cache;n[0]!==t&&(e.uniform1i(this.addr,t),n[0]=t)}function Js(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2i(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(Ls(n,t))return;e.uniform2iv(this.addr,t),Rs(n,t)}}function Ys(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3i(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(Ls(n,t))return;e.uniform3iv(this.addr,t),Rs(n,t)}}function Xs(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4i(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(Ls(n,t))return;e.uniform4iv(this.addr,t),Rs(n,t)}}function Zs(e,t){let n=this.cache;n[0]!==t&&(e.uniform1ui(this.addr,t),n[0]=t)}function Qs(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2ui(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(Ls(n,t))return;e.uniform2uiv(this.addr,t),Rs(n,t)}}function $s(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3ui(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(Ls(n,t))return;e.uniform3uiv(this.addr,t),Rs(n,t)}}function ec(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4ui(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(Ls(n,t))return;e.uniform4uiv(this.addr,t),Rs(n,t)}}function tc(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i);let a;this.type===e.SAMPLER_2D_SHADOW?(Ds.compareFunction=n.isReversedDepthBuffer()?518:515,a=Ds):a=Es,n.setTexture2D(t||a,i)}function nc(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture3D(t||ks,i)}function rc(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTextureCube(t||As,i)}function ic(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture2DArray(t||Os,i)}function ac(e){switch(e){case 5126:return Bs;case 35664:return Vs;case 35665:return Hs;case 35666:return Us;case 35674:return Ws;case 35675:return Gs;case 35676:return Ks;case 5124:case 35670:return qs;case 35667:case 35671:return Js;case 35668:case 35672:return Ys;case 35669:case 35673:return Xs;case 5125:return Zs;case 36294:return Qs;case 36295:return $s;case 36296:return ec;case 35678:case 36198:case 36298:case 36306:case 35682:return tc;case 35679:case 36299:case 36307:return nc;case 35680:case 36300:case 36308:case 36293:return rc;case 36289:case 36303:case 36311:case 36292:return ic}}function oc(e,t){e.uniform1fv(this.addr,t)}function sc(e,t){let n=Is(t,this.size,2);e.uniform2fv(this.addr,n)}function cc(e,t){let n=Is(t,this.size,3);e.uniform3fv(this.addr,n)}function lc(e,t){let n=Is(t,this.size,4);e.uniform4fv(this.addr,n)}function uc(e,t){let n=Is(t,this.size,4);e.uniformMatrix2fv(this.addr,!1,n)}function dc(e,t){let n=Is(t,this.size,9);e.uniformMatrix3fv(this.addr,!1,n)}function fc(e,t){let n=Is(t,this.size,16);e.uniformMatrix4fv(this.addr,!1,n)}function pc(e,t){e.uniform1iv(this.addr,t)}function mc(e,t){e.uniform2iv(this.addr,t)}function hc(e,t){e.uniform3iv(this.addr,t)}function gc(e,t){e.uniform4iv(this.addr,t)}function _c(e,t){e.uniform1uiv(this.addr,t)}function vc(e,t){e.uniform2uiv(this.addr,t)}function yc(e,t){e.uniform3uiv(this.addr,t)}function bc(e,t){e.uniform4uiv(this.addr,t)}function xc(e,t,n){let r=this.cache,i=t.length,a=zs(n,i);Ls(r,a)||(e.uniform1iv(this.addr,a),Rs(r,a));let o;o=this.type===e.SAMPLER_2D_SHADOW?Ds:Es;for(let e=0;e!==i;++e)n.setTexture2D(t[e]||o,a[e])}function Sc(e,t,n){let r=this.cache,i=t.length,a=zs(n,i);Ls(r,a)||(e.uniform1iv(this.addr,a),Rs(r,a));for(let e=0;e!==i;++e)n.setTexture3D(t[e]||ks,a[e])}function Cc(e,t,n){let r=this.cache,i=t.length,a=zs(n,i);Ls(r,a)||(e.uniform1iv(this.addr,a),Rs(r,a));for(let e=0;e!==i;++e)n.setTextureCube(t[e]||As,a[e])}function wc(e,t,n){let r=this.cache,i=t.length,a=zs(n,i);Ls(r,a)||(e.uniform1iv(this.addr,a),Rs(r,a));for(let e=0;e!==i;++e)n.setTexture2DArray(t[e]||Os,a[e])}function Tc(e){switch(e){case 5126:return oc;case 35664:return sc;case 35665:return cc;case 35666:return lc;case 35674:return uc;case 35675:return dc;case 35676:return fc;case 5124:case 35670:return pc;case 35667:case 35671:return mc;case 35668:case 35672:return hc;case 35669:case 35673:return gc;case 5125:return _c;case 36294:return vc;case 36295:return yc;case 36296:return bc;case 35678:case 36198:case 36298:case 36306:case 35682:return xc;case 35679:case 36299:case 36307:return Sc;case 35680:case 36300:case 36308:case 36293:return Cc;case 36289:case 36303:case 36311:case 36292:return wc}}var Ec=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=ac(t.type)}},Dc=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Tc(t.type)}},Oc=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let r=this.seq;for(let i=0,a=r.length;i!==a;++i){let a=r[i];a.setValue(e,t[a.id],n)}}},kc=/(\w+)(\])?(\[|\.)?/g;function Ac(e,t){e.seq.push(t),e.map[t.id]=t}function jc(e,t,n){let r=e.name,i=r.length;for(kc.lastIndex=0;;){let a=kc.exec(r),o=kc.lastIndex,s=a[1],c=a[2]===`]`,l=a[3];if(c&&(s|=0),l===void 0||l===`[`&&o+2===i){Ac(n,l===void 0?new Ec(s,e,t):new Dc(s,e,t));break}{let e=n.map[s];e===void 0&&(e=new Oc(s),Ac(n,e)),n=e}}}var Mc=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<n;++r){let n=e.getActiveUniform(t,r);jc(n,e.getUniformLocation(t,n.name),this)}let r=[],i=[];for(let t of this.seq)t.type===e.SAMPLER_2D_SHADOW||t.type===e.SAMPLER_CUBE_SHADOW||t.type===e.SAMPLER_2D_ARRAY_SHADOW?r.push(t):i.push(t);r.length>0&&(this.seq=r.concat(i))}setValue(e,t,n,r){let i=this.map[t];i!==void 0&&i.setValue(e,n,r)}setOptional(e,t,n){let r=t[n];r!==void 0&&this.setValue(e,n,r)}static upload(e,t,n,r){for(let i=0,a=t.length;i!==a;++i){let a=t[i],o=n[a.id];o.needsUpdate!==!1&&a.setValue(e,o.value,r)}}static seqWithValue(e,t){let n=[];for(let r=0,i=e.length;r!==i;++r){let i=e[r];i.id in t&&n.push(i)}return n}};function Nc(e,t,n){let r=e.createShader(t);return e.shaderSource(r,n),e.compileShader(r),r}var Pc=37297,Fc=0;function Ic(e,t){let n=e.split(`
`),r=[],i=Math.max(t-6,0),a=Math.min(t+6,n.length);for(let e=i;e<a;e++){let i=e+1;r.push(`${i===t?`>`:` `} ${i}: ${n[e]}`)}return r.join(`
`)}var Lc=new U;function Rc(e){W._getMatrix(Lc,W.workingColorSpace,e);let t=`mat3( ${Lc.elements.map(e=>e.toFixed(4))} )`;switch(W.getTransfer(e)){case Be:return[t,`LinearTransferOETF`];case Ve:return[t,`sRGBTransferOETF`];default:return R(`WebGLProgram: Unsupported color space: `,e),[t,`LinearTransferOETF`]}}function zc(e,t,n){let r=e.getShaderParameter(t,e.COMPILE_STATUS),i=(e.getShaderInfoLog(t)||``).trim();if(r&&i===``)return``;let a=/ERROR: 0:(\d+)/.exec(i);if(a){let r=parseInt(a[1]);return n.toUpperCase()+`

`+i+`

`+Ic(e.getShaderSource(t),r)}return i}function Bc(e,t){let n=Rc(t);return[`vec4 ${e}( vec4 value ) {`,`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,`}`].join(`
`)}var Vc={1:`Linear`,2:`Reinhard`,3:`Cineon`,4:`ACESFilmic`,6:`AgX`,7:`Neutral`,5:`Custom`};function Hc(e,t){let n=Vc[t];return n===void 0?(R(`WebGLProgram: Unsupported toneMapping:`,t),`vec3 `+e+`( vec3 color ) { return LinearToneMapping( color ); }`):`vec3 `+e+`( vec3 color ) { return `+n+`ToneMapping( color ); }`}var Uc=new H;function Wc(){return W.getLuminanceCoefficients(Uc),[`float luminance( const in vec3 rgb ) {`,`	const vec3 weights = vec3( ${Uc.x.toFixed(4)}, ${Uc.y.toFixed(4)}, ${Uc.z.toFixed(4)} );`,`	return dot( weights, rgb );`,`}`].join(`
`)}function Gc(e){return[e.extensionClipCullDistance?`#extension GL_ANGLE_clip_cull_distance : require`:``,e.extensionMultiDraw?`#extension GL_ANGLE_multi_draw : require`:``].filter(Jc).join(`
`)}function Kc(e){let t=[];for(let n in e){let r=e[n];r!==!1&&t.push(`#define `+n+` `+r)}return t.join(`
`)}function qc(e,t){let n={},r=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let i=0;i<r;i++){let r=e.getActiveAttrib(t,i),a=r.name,o=1;r.type===e.FLOAT_MAT2&&(o=2),r.type===e.FLOAT_MAT3&&(o=3),r.type===e.FLOAT_MAT4&&(o=4),n[a]={type:r.type,location:e.getAttribLocation(t,a),locationSize:o}}return n}function Jc(e){return e!==``}function Yc(e,t){let n=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return e.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Xc(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var Zc=/^[ \t]*#include +<([\w\d./]+)>/gm;function Qc(e){return e.replace(Zc,el)}var $c=new Map;function el(e,t){let n=q[t];if(n===void 0){let e=$c.get(t);if(e!==void 0)n=q[e],R(`WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.`,t,e);else throw Error(`THREE.WebGLProgram: Can not resolve #include <`+t+`>`)}return Qc(n)}var tl=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function nl(e){return e.replace(tl,rl)}function rl(e,t,n,r){let i=``;for(let e=parseInt(t);e<parseInt(n);e++)i+=r.replace(/\[\s*i\s*\]/g,`[ `+e+` ]`).replace(/UNROLLED_LOOP_INDEX/g,e);return i}function il(e){let t=`precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;return e.precision===`highp`?t+=`
#define HIGH_PRECISION`:e.precision===`mediump`?t+=`
#define MEDIUM_PRECISION`:e.precision===`lowp`&&(t+=`
#define LOW_PRECISION`),t}var al={1:`SHADOWMAP_TYPE_PCF`,3:`SHADOWMAP_TYPE_VSM`};function ol(e){return al[e.shadowMapType]||`SHADOWMAP_TYPE_BASIC`}var sl={301:`ENVMAP_TYPE_CUBE`,302:`ENVMAP_TYPE_CUBE`,306:`ENVMAP_TYPE_CUBE_UV`};function cl(e){return e.envMap===!1?`ENVMAP_TYPE_CUBE`:sl[e.envMapMode]||`ENVMAP_TYPE_CUBE`}var ll={302:`ENVMAP_MODE_REFRACTION`};function ul(e){return e.envMap===!1?`ENVMAP_MODE_REFLECTION`:ll[e.envMapMode]||`ENVMAP_MODE_REFLECTION`}var dl={0:`ENVMAP_BLENDING_MULTIPLY`,1:`ENVMAP_BLENDING_MIX`,2:`ENVMAP_BLENDING_ADD`};function fl(e){return e.envMap===!1?`ENVMAP_BLENDING_NONE`:dl[e.combine]||`ENVMAP_BLENDING_NONE`}function pl(e){let t=e.envMapCubeUVHeight;if(t===null)return null;let n=Math.log2(t)-2,r=1/t;return{texelWidth:1/(3*Math.max(2**n,112)),texelHeight:r,maxMip:n}}function ml(e,t,n,r){let i=e.getContext(),a=n.defines,o=n.vertexShader,s=n.fragmentShader,c=ol(n),l=cl(n),u=ul(n),d=fl(n),f=pl(n),p=Gc(n),m=Kc(a),h=i.createProgram(),g,_,v=n.glslVersion?`#version `+n.glslVersion+`
`:``;n.isRawShaderMaterial?(g=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m].filter(Jc).join(`
`),g.length>0&&(g+=`
`),_=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m].filter(Jc).join(`
`),_.length>0&&(_+=`
`)):(g=[il(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m,n.extensionClipCullDistance?`#define USE_CLIP_DISTANCE`:``,n.batching?`#define USE_BATCHING`:``,n.batchingColor?`#define USE_BATCHING_COLOR`:``,n.instancing?`#define USE_INSTANCING`:``,n.instancingColor?`#define USE_INSTANCING_COLOR`:``,n.instancingMorph?`#define USE_INSTANCING_MORPH`:``,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.map?`#define USE_MAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+u:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.displacementMap?`#define USE_DISPLACEMENTMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.mapUv?`#define MAP_UV `+n.mapUv:``,n.alphaMapUv?`#define ALPHAMAP_UV `+n.alphaMapUv:``,n.lightMapUv?`#define LIGHTMAP_UV `+n.lightMapUv:``,n.aoMapUv?`#define AOMAP_UV `+n.aoMapUv:``,n.emissiveMapUv?`#define EMISSIVEMAP_UV `+n.emissiveMapUv:``,n.bumpMapUv?`#define BUMPMAP_UV `+n.bumpMapUv:``,n.normalMapUv?`#define NORMALMAP_UV `+n.normalMapUv:``,n.displacementMapUv?`#define DISPLACEMENTMAP_UV `+n.displacementMapUv:``,n.metalnessMapUv?`#define METALNESSMAP_UV `+n.metalnessMapUv:``,n.roughnessMapUv?`#define ROUGHNESSMAP_UV `+n.roughnessMapUv:``,n.anisotropyMapUv?`#define ANISOTROPYMAP_UV `+n.anisotropyMapUv:``,n.clearcoatMapUv?`#define CLEARCOATMAP_UV `+n.clearcoatMapUv:``,n.clearcoatNormalMapUv?`#define CLEARCOAT_NORMALMAP_UV `+n.clearcoatNormalMapUv:``,n.clearcoatRoughnessMapUv?`#define CLEARCOAT_ROUGHNESSMAP_UV `+n.clearcoatRoughnessMapUv:``,n.iridescenceMapUv?`#define IRIDESCENCEMAP_UV `+n.iridescenceMapUv:``,n.iridescenceThicknessMapUv?`#define IRIDESCENCE_THICKNESSMAP_UV `+n.iridescenceThicknessMapUv:``,n.sheenColorMapUv?`#define SHEEN_COLORMAP_UV `+n.sheenColorMapUv:``,n.sheenRoughnessMapUv?`#define SHEEN_ROUGHNESSMAP_UV `+n.sheenRoughnessMapUv:``,n.specularMapUv?`#define SPECULARMAP_UV `+n.specularMapUv:``,n.specularColorMapUv?`#define SPECULAR_COLORMAP_UV `+n.specularColorMapUv:``,n.specularIntensityMapUv?`#define SPECULAR_INTENSITYMAP_UV `+n.specularIntensityMapUv:``,n.transmissionMapUv?`#define TRANSMISSIONMAP_UV `+n.transmissionMapUv:``,n.thicknessMapUv?`#define THICKNESSMAP_UV `+n.thicknessMapUv:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexNormals?`#define HAS_NORMAL`:``,n.vertexColors?`#define USE_COLOR`:``,n.vertexAlphas?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.flatShading?`#define FLAT_SHADED`:``,n.skinning?`#define USE_SKINNING`:``,n.morphTargets?`#define USE_MORPHTARGETS`:``,n.morphNormals&&n.flatShading===!1?`#define USE_MORPHNORMALS`:``,n.morphColors?`#define USE_MORPHCOLORS`:``,n.morphTargetsCount>0?`#define MORPHTARGETS_TEXTURE_STRIDE `+n.morphTextureStride:``,n.morphTargetsCount>0?`#define MORPHTARGETS_COUNT `+n.morphTargetsCount:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.sizeAttenuation?`#define USE_SIZEATTENUATION`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 modelMatrix;`,`uniform mat4 modelViewMatrix;`,`uniform mat4 projectionMatrix;`,`uniform mat4 viewMatrix;`,`uniform mat3 normalMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,`#ifdef USE_INSTANCING`,`	attribute mat4 instanceMatrix;`,`#endif`,`#ifdef USE_INSTANCING_COLOR`,`	attribute vec3 instanceColor;`,`#endif`,`#ifdef USE_INSTANCING_MORPH`,`	uniform sampler2D morphTexture;`,`#endif`,`attribute vec3 position;`,`attribute vec3 normal;`,`attribute vec2 uv;`,`#ifdef USE_UV1`,`	attribute vec2 uv1;`,`#endif`,`#ifdef USE_UV2`,`	attribute vec2 uv2;`,`#endif`,`#ifdef USE_UV3`,`	attribute vec2 uv3;`,`#endif`,`#ifdef USE_TANGENT`,`	attribute vec4 tangent;`,`#endif`,`#if defined( USE_COLOR_ALPHA )`,`	attribute vec4 color;`,`#elif defined( USE_COLOR )`,`	attribute vec3 color;`,`#endif`,`#ifdef USE_SKINNING`,`	attribute vec4 skinIndex;`,`	attribute vec4 skinWeight;`,`#endif`,`
`].filter(Jc).join(`
`),_=[il(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.alphaToCoverage?`#define ALPHA_TO_COVERAGE`:``,n.map?`#define USE_MAP`:``,n.matcap?`#define USE_MATCAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+l:``,n.envMap?`#define `+u:``,n.envMap?`#define `+d:``,f?`#define CUBEUV_TEXEL_WIDTH `+f.texelWidth:``,f?`#define CUBEUV_TEXEL_HEIGHT `+f.texelHeight:``,f?`#define CUBEUV_MAX_MIP `+f.maxMip+`.0`:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.packedNormalMap?`#define USE_PACKED_NORMALMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoat?`#define USE_CLEARCOAT`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.dispersion?`#define USE_DISPERSION`:``,n.iridescence?`#define USE_IRIDESCENCE`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaTest?`#define USE_ALPHATEST`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.sheen?`#define USE_SHEEN`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexColors||n.instancingColor?`#define USE_COLOR`:``,n.vertexAlphas||n.batchingColor?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.gradientMap?`#define USE_GRADIENTMAP`:``,n.flatShading?`#define FLAT_SHADED`:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.premultipliedAlpha?`#define PREMULTIPLIED_ALPHA`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.numLightProbeGrids>0?`#define USE_LIGHT_PROBES_GRID`:``,n.decodeVideoTexture?`#define DECODE_VIDEO_TEXTURE`:``,n.decodeVideoTextureEmissive?`#define DECODE_VIDEO_TEXTURE_EMISSIVE`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 viewMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,n.toneMapping===0?``:`#define TONE_MAPPING`,n.toneMapping===0?``:q.tonemapping_pars_fragment,n.toneMapping===0?``:Hc(`toneMapping`,n.toneMapping),n.dithering?`#define DITHERING`:``,n.opaque?`#define OPAQUE`:``,q.colorspace_pars_fragment,Bc(`linearToOutputTexel`,n.outputColorSpace),Wc(),n.useDepthPacking?`#define DEPTH_PACKING `+n.depthPacking:``,`
`].filter(Jc).join(`
`)),o=Qc(o),o=Yc(o,n),o=Xc(o,n),s=Qc(s),s=Yc(s,n),s=Xc(s,n),o=nl(o),s=nl(s),n.isRawShaderMaterial!==!0&&(v=`#version 300 es
`,g=[p,`#define attribute in`,`#define varying out`,`#define texture2D texture`].join(`
`)+`
`+g,_=[`#define varying in`,n.glslVersion===`300 es`?``:`layout(location = 0) out highp vec4 pc_fragColor;`,n.glslVersion===`300 es`?``:`#define gl_FragColor pc_fragColor`,`#define gl_FragDepthEXT gl_FragDepth`,`#define texture2D texture`,`#define textureCube texture`,`#define texture2DProj textureProj`,`#define texture2DLodEXT textureLod`,`#define texture2DProjLodEXT textureProjLod`,`#define textureCubeLodEXT textureLod`,`#define texture2DGradEXT textureGrad`,`#define texture2DProjGradEXT textureProjGrad`,`#define textureCubeGradEXT textureGrad`].join(`
`)+`
`+_);let y=v+g+o,b=v+_+s,x=Nc(i,i.VERTEX_SHADER,y),S=Nc(i,i.FRAGMENT_SHADER,b);i.attachShader(h,x),i.attachShader(h,S),n.index0AttributeName===void 0?n.hasPositionAttribute===!0&&i.bindAttribLocation(h,0,`position`):i.bindAttribLocation(h,0,n.index0AttributeName),i.linkProgram(h);function C(t){if(e.debug.checkShaderErrors){let n=i.getProgramInfoLog(h)||``,r=i.getShaderInfoLog(x)||``,a=i.getShaderInfoLog(S)||``,o=n.trim(),s=r.trim(),c=a.trim(),l=!0,u=!0;if(i.getProgramParameter(h,i.LINK_STATUS)===!1){if(l=!1,typeof e.debug.onShaderError==`function`)e.debug.onShaderError(i,h,x,S);else{let e=zc(i,x,`vertex`),n=zc(i,S,`fragment`);z(`WebGLProgram: Shader Error `+i.getError()+` - VALIDATE_STATUS `+i.getProgramParameter(h,i.VALIDATE_STATUS)+`

Material Name: `+t.name+`
Material Type: `+t.type+`

Program Info Log: `+o+`
`+e+`
`+n)}}else o===``?(s===``||c===``)&&(u=!1):R(`WebGLProgram: Program Info Log:`,o);u&&(t.diagnostics={runnable:l,programLog:o,vertexShader:{log:s,prefix:g},fragmentShader:{log:c,prefix:_}})}i.deleteShader(x),i.deleteShader(S),w=new Mc(i,h),T=qc(i,h)}let w;this.getUniforms=function(){return w===void 0&&C(this),w};let T;this.getAttributes=function(){return T===void 0&&C(this),T};let E=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return E===!1&&(E=i.getProgramParameter(h,Pc)),E},this.destroy=function(){r.releaseStatesOfProgram(this),i.deleteProgram(h),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=Fc++,this.cacheKey=t,this.usedTimes=1,this.program=h,this.vertexShader=x,this.fragmentShader=S,this}var hl=0,gl=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let r=this._getShaderCacheForMaterial(e);return r.has(t)===!1&&(r.add(t),t.usedTimes++),r.has(n)===!1&&(r.add(n),n.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let e of t)e.usedTimes--,e.usedTimes===0&&this.shaderCache.delete(e.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new _l(e),t.set(e,n)),n}},_l=class{constructor(e){this.id=hl++,this.code=e,this.usedTimes=0}};function vl(e){return e===1030||e===37490||e===36285}function yl(e,t,n,r,i,a){let o=new cn,s=new gl,c=new Set,l=[],u=new Map,d=r.logarithmicDepthBuffer,f=r.precision,p={MeshDepthMaterial:`depth`,MeshDistanceMaterial:`distance`,MeshNormalMaterial:`normal`,MeshBasicMaterial:`basic`,MeshLambertMaterial:`lambert`,MeshPhongMaterial:`phong`,MeshToonMaterial:`toon`,MeshStandardMaterial:`physical`,MeshPhysicalMaterial:`physical`,MeshMatcapMaterial:`matcap`,LineBasicMaterial:`basic`,LineDashedMaterial:`dashed`,PointsMaterial:`points`,ShadowMaterial:`shadow`,SpriteMaterial:`sprite`};function m(e){return c.add(e),e===0?`uv`:`uv${e}`}function h(i,o,l,u,h,g){let _=u.fog,v=h.geometry,y=i.isMeshStandardMaterial||i.isMeshLambertMaterial||i.isMeshPhongMaterial?u.environment:null,b=i.isMeshStandardMaterial||i.isMeshLambertMaterial&&!i.envMap||i.isMeshPhongMaterial&&!i.envMap,x=t.get(i.envMap||y,b),S=x&&x.mapping===306?x.image.height:null,C=p[i.type];i.precision!==null&&(f=r.getMaxPrecision(i.precision),f!==i.precision&&R(`WebGLProgram.getParameters:`,i.precision,`not supported, using`,f,`instead.`));let w=v.morphAttributes.position||v.morphAttributes.normal||v.morphAttributes.color,T=w===void 0?0:w.length,E=0;v.morphAttributes.position!==void 0&&(E=1),v.morphAttributes.normal!==void 0&&(E=2),v.morphAttributes.color!==void 0&&(E=3);let D,ee,O,k;if(C){let e=Vo[C];D=e.vertexShader,ee=e.fragmentShader}else{D=i.vertexShader,ee=i.fragmentShader;let e=s.getVertexShaderStage(i),t=s.getFragmentShaderStage(i);s.update(i,e,t),O=e.id,k=t.id}let te=e.getRenderTarget(),A=e.state.buffers.depth.getReversed(),j=h.isInstancedMesh===!0,ne=h.isBatchedMesh===!0,re=!!i.map,M=!!i.matcap,ie=!!x,ae=!!i.aoMap,oe=!!i.lightMap,se=!!i.bumpMap&&i.wireframe===!1,ce=!!i.normalMap,le=!!i.displacementMap,ue=!!i.emissiveMap,N=!!i.metalnessMap,de=!!i.roughnessMap,fe=i.anisotropy>0,pe=i.clearcoat>0,me=i.dispersion>0,he=i.iridescence>0,ge=i.sheen>0,_e=i.transmission>0,ve=fe&&!!i.anisotropyMap,ye=pe&&!!i.clearcoatMap,be=pe&&!!i.clearcoatNormalMap,xe=pe&&!!i.clearcoatRoughnessMap,Se=he&&!!i.iridescenceMap,Ce=he&&!!i.iridescenceThicknessMap,we=ge&&!!i.sheenColorMap,Te=ge&&!!i.sheenRoughnessMap,Ee=!!i.specularMap,De=!!i.specularColorMap,Oe=!!i.specularIntensityMap,ke=_e&&!!i.transmissionMap,Ae=_e&&!!i.thicknessMap,je=!!i.gradientMap,Me=!!i.alphaMap,Ne=i.alphaTest>0,Pe=!!i.alphaHash,P=!!i.extensions,Fe=0;i.toneMapped&&(te===null||te.isXRRenderTarget===!0)&&(Fe=e.toneMapping);let Ie={shaderID:C,shaderType:i.type,shaderName:i.name,vertexShader:D,fragmentShader:ee,defines:i.defines,customVertexShaderID:O,customFragmentShaderID:k,isRawShaderMaterial:i.isRawShaderMaterial===!0,glslVersion:i.glslVersion,precision:f,batching:ne,batchingColor:ne&&h._colorsTexture!==null,instancing:j,instancingColor:j&&h.instanceColor!==null,instancingMorph:j&&h.morphTexture!==null,outputColorSpace:te===null?e.outputColorSpace:te.isXRRenderTarget===!0?te.texture.colorSpace:W.workingColorSpace,alphaToCoverage:!!i.alphaToCoverage,map:re,matcap:M,envMap:ie,envMapMode:ie&&x.mapping,envMapCubeUVHeight:S,aoMap:ae,lightMap:oe,bumpMap:se,normalMap:ce,displacementMap:le,emissiveMap:ue,normalMapObjectSpace:ce&&i.normalMapType===1,normalMapTangentSpace:ce&&i.normalMapType===0,packedNormalMap:ce&&i.normalMapType===0&&vl(i.normalMap.format),metalnessMap:N,roughnessMap:de,anisotropy:fe,anisotropyMap:ve,clearcoat:pe,clearcoatMap:ye,clearcoatNormalMap:be,clearcoatRoughnessMap:xe,dispersion:me,iridescence:he,iridescenceMap:Se,iridescenceThicknessMap:Ce,sheen:ge,sheenColorMap:we,sheenRoughnessMap:Te,specularMap:Ee,specularColorMap:De,specularIntensityMap:Oe,transmission:_e,transmissionMap:ke,thicknessMap:Ae,gradientMap:je,opaque:i.transparent===!1&&i.blending===1&&i.alphaToCoverage===!1,alphaMap:Me,alphaTest:Ne,alphaHash:Pe,combine:i.combine,mapUv:re&&m(i.map.channel),aoMapUv:ae&&m(i.aoMap.channel),lightMapUv:oe&&m(i.lightMap.channel),bumpMapUv:se&&m(i.bumpMap.channel),normalMapUv:ce&&m(i.normalMap.channel),displacementMapUv:le&&m(i.displacementMap.channel),emissiveMapUv:ue&&m(i.emissiveMap.channel),metalnessMapUv:N&&m(i.metalnessMap.channel),roughnessMapUv:de&&m(i.roughnessMap.channel),anisotropyMapUv:ve&&m(i.anisotropyMap.channel),clearcoatMapUv:ye&&m(i.clearcoatMap.channel),clearcoatNormalMapUv:be&&m(i.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:xe&&m(i.clearcoatRoughnessMap.channel),iridescenceMapUv:Se&&m(i.iridescenceMap.channel),iridescenceThicknessMapUv:Ce&&m(i.iridescenceThicknessMap.channel),sheenColorMapUv:we&&m(i.sheenColorMap.channel),sheenRoughnessMapUv:Te&&m(i.sheenRoughnessMap.channel),specularMapUv:Ee&&m(i.specularMap.channel),specularColorMapUv:De&&m(i.specularColorMap.channel),specularIntensityMapUv:Oe&&m(i.specularIntensityMap.channel),transmissionMapUv:ke&&m(i.transmissionMap.channel),thicknessMapUv:Ae&&m(i.thicknessMap.channel),alphaMapUv:Me&&m(i.alphaMap.channel),vertexTangents:!!v.attributes.tangent&&(ce||fe),vertexNormals:!!v.attributes.normal,vertexColors:i.vertexColors,vertexAlphas:i.vertexColors===!0&&!!v.attributes.color&&v.attributes.color.itemSize===4,pointsUvs:h.isPoints===!0&&!!v.attributes.uv&&(re||Me),fog:!!_,useFog:i.fog===!0,fogExp2:!!_&&_.isFogExp2,flatShading:i.wireframe===!1&&(i.flatShading===!0||v.attributes.normal===void 0&&ce===!1&&(i.isMeshLambertMaterial||i.isMeshPhongMaterial||i.isMeshStandardMaterial||i.isMeshPhysicalMaterial)),sizeAttenuation:i.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:A,skinning:h.isSkinnedMesh===!0,hasPositionAttribute:v.attributes.position!==void 0,morphTargets:v.morphAttributes.position!==void 0,morphNormals:v.morphAttributes.normal!==void 0,morphColors:v.morphAttributes.color!==void 0,morphTargetsCount:T,morphTextureStride:E,numDirLights:o.directional.length,numPointLights:o.point.length,numSpotLights:o.spot.length,numSpotLightMaps:o.spotLightMap.length,numRectAreaLights:o.rectArea.length,numHemiLights:o.hemi.length,numDirLightShadows:o.directionalShadowMap.length,numPointLightShadows:o.pointShadowMap.length,numSpotLightShadows:o.spotShadowMap.length,numSpotLightShadowsWithMaps:o.numSpotLightShadowsWithMaps,numLightProbes:o.numLightProbes,numLightProbeGrids:g.length,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:i.dithering,shadowMapEnabled:e.shadowMap.enabled&&l.length>0,shadowMapType:e.shadowMap.type,toneMapping:Fe,decodeVideoTexture:re&&i.map.isVideoTexture===!0&&W.getTransfer(i.map.colorSpace)===`srgb`,decodeVideoTextureEmissive:ue&&i.emissiveMap.isVideoTexture===!0&&W.getTransfer(i.emissiveMap.colorSpace)===`srgb`,premultipliedAlpha:i.premultipliedAlpha,doubleSided:i.side===2,flipSided:i.side===1,useDepthPacking:i.depthPacking>=0,depthPacking:i.depthPacking||0,index0AttributeName:i.index0AttributeName,extensionClipCullDistance:P&&i.extensions.clipCullDistance===!0&&n.has(`WEBGL_clip_cull_distance`),extensionMultiDraw:(P&&i.extensions.multiDraw===!0||ne)&&n.has(`WEBGL_multi_draw`),rendererExtensionParallelShaderCompile:n.has(`KHR_parallel_shader_compile`),customProgramCacheKey:i.customProgramCacheKey()};return Ie.vertexUv1s=c.has(1),Ie.vertexUv2s=c.has(2),Ie.vertexUv3s=c.has(3),c.clear(),Ie}function g(t){let n=[];if(t.shaderID?n.push(t.shaderID):(n.push(t.customVertexShaderID),n.push(t.customFragmentShaderID)),t.defines!==void 0)for(let e in t.defines)n.push(e),n.push(t.defines[e]);return t.isRawShaderMaterial===!1&&(_(n,t),v(n,t),n.push(e.outputColorSpace)),n.push(t.customProgramCacheKey),n.join()}function _(e,t){e.push(t.precision),e.push(t.outputColorSpace),e.push(t.envMapMode),e.push(t.envMapCubeUVHeight),e.push(t.mapUv),e.push(t.alphaMapUv),e.push(t.lightMapUv),e.push(t.aoMapUv),e.push(t.bumpMapUv),e.push(t.normalMapUv),e.push(t.displacementMapUv),e.push(t.emissiveMapUv),e.push(t.metalnessMapUv),e.push(t.roughnessMapUv),e.push(t.anisotropyMapUv),e.push(t.clearcoatMapUv),e.push(t.clearcoatNormalMapUv),e.push(t.clearcoatRoughnessMapUv),e.push(t.iridescenceMapUv),e.push(t.iridescenceThicknessMapUv),e.push(t.sheenColorMapUv),e.push(t.sheenRoughnessMapUv),e.push(t.specularMapUv),e.push(t.specularColorMapUv),e.push(t.specularIntensityMapUv),e.push(t.transmissionMapUv),e.push(t.thicknessMapUv),e.push(t.combine),e.push(t.fogExp2),e.push(t.sizeAttenuation),e.push(t.morphTargetsCount),e.push(t.morphAttributeCount),e.push(t.numDirLights),e.push(t.numPointLights),e.push(t.numSpotLights),e.push(t.numSpotLightMaps),e.push(t.numHemiLights),e.push(t.numRectAreaLights),e.push(t.numDirLightShadows),e.push(t.numPointLightShadows),e.push(t.numSpotLightShadows),e.push(t.numSpotLightShadowsWithMaps),e.push(t.numLightProbes),e.push(t.shadowMapType),e.push(t.toneMapping),e.push(t.numClippingPlanes),e.push(t.numClipIntersection),e.push(t.depthPacking)}function v(e,t){o.disableAll(),t.instancing&&o.enable(0),t.instancingColor&&o.enable(1),t.instancingMorph&&o.enable(2),t.matcap&&o.enable(3),t.envMap&&o.enable(4),t.normalMapObjectSpace&&o.enable(5),t.normalMapTangentSpace&&o.enable(6),t.clearcoat&&o.enable(7),t.iridescence&&o.enable(8),t.alphaTest&&o.enable(9),t.vertexColors&&o.enable(10),t.vertexAlphas&&o.enable(11),t.vertexUv1s&&o.enable(12),t.vertexUv2s&&o.enable(13),t.vertexUv3s&&o.enable(14),t.vertexTangents&&o.enable(15),t.anisotropy&&o.enable(16),t.alphaHash&&o.enable(17),t.batching&&o.enable(18),t.dispersion&&o.enable(19),t.batchingColor&&o.enable(20),t.gradientMap&&o.enable(21),t.packedNormalMap&&o.enable(22),t.vertexNormals&&o.enable(23),e.push(o.mask),o.disableAll(),t.fog&&o.enable(0),t.useFog&&o.enable(1),t.flatShading&&o.enable(2),t.logarithmicDepthBuffer&&o.enable(3),t.reversedDepthBuffer&&o.enable(4),t.skinning&&o.enable(5),t.morphTargets&&o.enable(6),t.morphNormals&&o.enable(7),t.morphColors&&o.enable(8),t.premultipliedAlpha&&o.enable(9),t.shadowMapEnabled&&o.enable(10),t.doubleSided&&o.enable(11),t.flipSided&&o.enable(12),t.useDepthPacking&&o.enable(13),t.dithering&&o.enable(14),t.transmission&&o.enable(15),t.sheen&&o.enable(16),t.opaque&&o.enable(17),t.pointsUvs&&o.enable(18),t.decodeVideoTexture&&o.enable(19),t.decodeVideoTextureEmissive&&o.enable(20),t.alphaToCoverage&&o.enable(21),t.numLightProbeGrids>0&&o.enable(22),t.hasPositionAttribute&&o.enable(23),e.push(o.mask)}function y(e){let t=p[e.type],n;if(t){let e=Vo[t];n=Sa.clone(e.uniforms)}else n=e.uniforms;return n}function b(t,n){let r=u.get(n);return r===void 0?(r=new ml(e,n,t,i),l.push(r),u.set(n,r)):++r.usedTimes,r}function x(e){if(--e.usedTimes===0){let t=l.indexOf(e);l[t]=l[l.length-1],l.pop(),u.delete(e.cacheKey),e.destroy()}}function S(e){s.remove(e)}function C(){s.dispose()}return{getParameters:h,getProgramCacheKey:g,getUniforms:y,acquireProgram:b,releaseProgram:x,releaseShaderCache:S,programs:l,dispose:C}}function bl(){let e=new WeakMap;function t(t){return e.has(t)}function n(t){let n=e.get(t);return n===void 0&&(n={},e.set(t,n)),n}function r(t){e.delete(t)}function i(t,n,r){e.get(t)[n]=r}function a(){e=new WeakMap}return{has:t,get:n,remove:r,update:i,dispose:a}}function xl(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.material.id===t.material.id?e.materialVariant===t.materialVariant?e.z===t.z?e.id-t.id:e.z-t.z:e.materialVariant-t.materialVariant:e.material.id-t.material.id:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function Sl(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.z===t.z?e.id-t.id:t.z-e.z:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function Cl(){let e=[],t=0,n=[],r=[],i=[];function a(){t=0,n.length=0,r.length=0,i.length=0}function o(e){let t=0;return e.isInstancedMesh&&(t+=2),e.isSkinnedMesh&&(t+=1),t}function s(n,r,i,a,s,c){let l=e[t];return l===void 0?(l={id:n.id,object:n,geometry:r,material:i,materialVariant:o(n),groupOrder:a,renderOrder:n.renderOrder,z:s,group:c},e[t]=l):(l.id=n.id,l.object=n,l.geometry=r,l.material=i,l.materialVariant=o(n),l.groupOrder=a,l.renderOrder=n.renderOrder,l.z=s,l.group=c),t++,l}function c(e,t,a,o,c,l){let u=s(e,t,a,o,c,l);a.transmission>0?r.push(u):a.transparent===!0?i.push(u):n.push(u)}function l(e,t,a,o,c,l){let u=s(e,t,a,o,c,l);a.transmission>0?r.unshift(u):a.transparent===!0?i.unshift(u):n.unshift(u)}function u(e,t,a){n.length>1&&n.sort(e||xl),r.length>1&&r.sort(t||Sl),i.length>1&&i.sort(t||Sl),a&&(n.reverse(),r.reverse(),i.reverse())}function d(){for(let n=t,r=e.length;n<r;n++){let t=e[n];if(t.id===null)break;t.id=null,t.object=null,t.geometry=null,t.material=null,t.group=null}}return{opaque:n,transmissive:r,transparent:i,init:a,push:c,unshift:l,finish:d,sort:u}}function wl(){let e=new WeakMap;function t(t,n){let r=e.get(t),i;return r===void 0?(i=new Cl,e.set(t,[i])):n>=r.length?(i=new Cl,r.push(i)):i=r[n],i}function n(){e=new WeakMap}return{get:t,dispose:n}}function Tl(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`DirectionalLight`:n={direction:new H,color:new G};break;case`SpotLight`:n={position:new H,direction:new H,color:new G,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case`PointLight`:n={position:new H,color:new G,distance:0,decay:0};break;case`HemisphereLight`:n={direction:new H,skyColor:new G,groundColor:new G};break;case`RectAreaLight`:n={color:new G,position:new H,halfWidth:new H,halfHeight:new H}}return e[t.id]=n,n}}}function El(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`DirectionalLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new V};break;case`SpotLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new V};break;case`PointLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new V,shadowCameraNear:1,shadowCameraFar:1e3}}return e[t.id]=n,n}}}var Dl=0;function Ol(e,t){return(t.castShadow?2:0)-(e.castShadow?2:0)+ +!!t.map-!!e.map}function kl(e){let t=new Tl,n=El(),r={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let e=0;e<9;e++)r.probe.push(new H);let i=new H,a=new Xt,o=new Xt;function s(i){let a=0,o=0,s=0;for(let e=0;e<9;e++)r.probe[e].set(0,0,0);let c=0,l=0,u=0,d=0,f=0,p=0,m=0,h=0,g=0,_=0,v=0;i.sort(Ol);for(let e=0,y=i.length;e<y;e++){let y=i[e],b=y.color,x=y.intensity,S=y.distance,C=null;if(y.shadow&&y.shadow.map&&(C=y.shadow.map.texture.format===1030?y.shadow.map.texture:y.shadow.map.depthTexture||y.shadow.map.texture),y.isAmbientLight)a+=b.r*x,o+=b.g*x,s+=b.b*x;else if(y.isLightProbe){for(let e=0;e<9;e++)r.probe[e].addScaledVector(y.sh.coefficients[e],x);v++}else if(y.isDirectionalLight){let e=t.get(y);if(e.color.copy(y.color).multiplyScalar(y.intensity),y.castShadow){let e=y.shadow,t=n.get(y);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,r.directionalShadow[c]=t,r.directionalShadowMap[c]=C,r.directionalShadowMatrix[c]=y.shadow.matrix,p++}r.directional[c]=e,c++}else if(y.isSpotLight){let e=t.get(y);e.position.setFromMatrixPosition(y.matrixWorld),e.color.copy(b).multiplyScalar(x),e.distance=S,e.coneCos=Math.cos(y.angle),e.penumbraCos=Math.cos(y.angle*(1-y.penumbra)),e.decay=y.decay,r.spot[u]=e;let i=y.shadow;if(y.map&&(r.spotLightMap[g]=y.map,g++,i.updateMatrices(y),y.castShadow&&_++),r.spotLightMatrix[u]=i.matrix,y.castShadow){let e=n.get(y);e.shadowIntensity=i.intensity,e.shadowBias=i.bias,e.shadowNormalBias=i.normalBias,e.shadowRadius=i.radius,e.shadowMapSize=i.mapSize,r.spotShadow[u]=e,r.spotShadowMap[u]=C,h++}u++}else if(y.isRectAreaLight){let e=t.get(y);e.color.copy(b).multiplyScalar(x),e.halfWidth.set(y.width*.5,0,0),e.halfHeight.set(0,y.height*.5,0),r.rectArea[d]=e,d++}else if(y.isPointLight){let e=t.get(y);if(e.color.copy(y.color).multiplyScalar(y.intensity),e.distance=y.distance,e.decay=y.decay,y.castShadow){let e=y.shadow,t=n.get(y);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,t.shadowCameraNear=e.camera.near,t.shadowCameraFar=e.camera.far,r.pointShadow[l]=t,r.pointShadowMap[l]=C,r.pointShadowMatrix[l]=y.shadow.matrix,m++}r.point[l]=e,l++}else if(y.isHemisphereLight){let e=t.get(y);e.skyColor.copy(y.color).multiplyScalar(x),e.groundColor.copy(y.groundColor).multiplyScalar(x),r.hemi[f]=e,f++}}d>0&&(e.has(`OES_texture_float_linear`)===!0?(r.rectAreaLTC1=J.LTC_FLOAT_1,r.rectAreaLTC2=J.LTC_FLOAT_2):(r.rectAreaLTC1=J.LTC_HALF_1,r.rectAreaLTC2=J.LTC_HALF_2)),r.ambient[0]=a,r.ambient[1]=o,r.ambient[2]=s;let y=r.hash;(y.directionalLength!==c||y.pointLength!==l||y.spotLength!==u||y.rectAreaLength!==d||y.hemiLength!==f||y.numDirectionalShadows!==p||y.numPointShadows!==m||y.numSpotShadows!==h||y.numSpotMaps!==g||y.numLightProbes!==v)&&(r.directional.length=c,r.spot.length=u,r.rectArea.length=d,r.point.length=l,r.hemi.length=f,r.directionalShadow.length=p,r.directionalShadowMap.length=p,r.pointShadow.length=m,r.pointShadowMap.length=m,r.spotShadow.length=h,r.spotShadowMap.length=h,r.directionalShadowMatrix.length=p,r.pointShadowMatrix.length=m,r.spotLightMatrix.length=h+g-_,r.spotLightMap.length=g,r.numSpotLightShadowsWithMaps=_,r.numLightProbes=v,y.directionalLength=c,y.pointLength=l,y.spotLength=u,y.rectAreaLength=d,y.hemiLength=f,y.numDirectionalShadows=p,y.numPointShadows=m,y.numSpotShadows=h,y.numSpotMaps=g,y.numLightProbes=v,r.version=Dl++)}function c(e,t){let n=0,s=0,c=0,l=0,u=0,d=t.matrixWorldInverse;for(let t=0,f=e.length;t<f;t++){let f=e[t];if(f.isDirectionalLight){let e=r.directional[n];e.direction.setFromMatrixPosition(f.matrixWorld),i.setFromMatrixPosition(f.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(d),n++}else if(f.isSpotLight){let e=r.spot[c];e.position.setFromMatrixPosition(f.matrixWorld),e.position.applyMatrix4(d),e.direction.setFromMatrixPosition(f.matrixWorld),i.setFromMatrixPosition(f.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(d),c++}else if(f.isRectAreaLight){let e=r.rectArea[l];e.position.setFromMatrixPosition(f.matrixWorld),e.position.applyMatrix4(d),o.identity(),a.copy(f.matrixWorld),a.premultiply(d),o.extractRotation(a),e.halfWidth.set(f.width*.5,0,0),e.halfHeight.set(0,f.height*.5,0),e.halfWidth.applyMatrix4(o),e.halfHeight.applyMatrix4(o),l++}else if(f.isPointLight){let e=r.point[s];e.position.setFromMatrixPosition(f.matrixWorld),e.position.applyMatrix4(d),s++}else if(f.isHemisphereLight){let e=r.hemi[u];e.direction.setFromMatrixPosition(f.matrixWorld),e.direction.transformDirection(d),u++}}}return{setup:s,setupView:c,state:r}}function Al(e){let t=new kl(e),n=[],r=[],i=[];function a(e){d.camera=e,n.length=0,r.length=0,i.length=0}function o(e){n.push(e)}function s(e){r.push(e)}function c(e){i.push(e)}function l(){t.setup(n)}function u(e){t.setupView(n,e)}let d={lightsArray:n,shadowsArray:r,lightProbeGridArray:i,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:a,state:d,setupLights:l,setupLightsView:u,pushLight:o,pushShadow:s,pushLightProbeGrid:c}}function jl(e){let t=new WeakMap;function n(n,r=0){let i=t.get(n),a;return i===void 0?(a=new Al(e),t.set(n,[a])):r>=i.length?(a=new Al(e),i.push(a)):a=i[r],a}function r(){t=new WeakMap}return{get:n,dispose:r}}var Ml=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Nl=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,Pl=[new H(1,0,0),new H(-1,0,0),new H(0,1,0),new H(0,-1,0),new H(0,0,1),new H(0,0,-1)],Fl=[new H(0,-1,0),new H(0,-1,0),new H(0,0,1),new H(0,0,-1),new H(0,-1,0),new H(0,-1,0)],Il=new Xt,Ll=new H,Rl=new H;function zl(e,t,n){let i=new gi,a=new V,s=new V,c=new Gt,l=new ka,u=new Aa,d={},f=n.maxTextureSize,p={0:1,1:0,2:2},_=new Ta({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new V},radius:{value:4}},vertexShader:Ml,fragmentShader:Nl}),v=_.clone();v.defines.HORIZONTAL_PASS=1;let y=new Or;y.setAttribute(`position`,new pr(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let b=new K(y,_),x=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=1;let S=this.type;this.render=function(t,n,l){if(x.enabled===!1||x.autoUpdate===!1&&x.needsUpdate===!1||t.length===0)return;this.type===2&&(R(`WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead.`),this.type=1);let u=e.getRenderTarget(),d=e.getActiveCubeFace(),p=e.getActiveMipmapLevel(),_=e.state;_.setBlending(0),_.buffers.depth.getReversed()===!0?_.buffers.color.setClear(0,0,0,0):_.buffers.color.setClear(1,1,1,1),_.buffers.depth.setTest(!0),_.setScissorTest(!1);let v=S!==this.type;v&&n.traverse(function(e){e.material&&(Array.isArray(e.material)?e.material.forEach(e=>e.needsUpdate=!0):e.material.needsUpdate=!0)});for(let u=0,d=t.length;u<d;u++){let d=t[u],p=d.shadow;if(p===void 0){R(`WebGLShadowMap:`,d,`has no shadow.`);continue}if(p.autoUpdate===!1&&p.needsUpdate===!1)continue;a.copy(p.mapSize);let y=p.getFrameExtents();a.multiply(y),s.copy(p.mapSize),(a.x>f||a.y>f)&&(a.x>f&&(s.x=Math.floor(f/y.x),a.x=s.x*y.x,p.mapSize.x=s.x),a.y>f&&(s.y=Math.floor(f/y.y),a.y=s.y*y.y,p.mapSize.y=s.y));let b=e.state.buffers.depth.getReversed();if(p.camera._reversedDepth=b,p.map===null||v===!0){if(p.map!==null&&(p.map.depthTexture!==null&&(p.map.depthTexture.dispose(),p.map.depthTexture=null),p.map.dispose()),this.type===3){if(d.isPointLight){R(`WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.`);continue}p.map=new qt(a.x,a.y,{format:O,type:g,minFilter:o,magFilter:o,generateMipmaps:!1}),p.map.texture.name=d.name+`.shadowMap`,p.map.depthTexture=new Mi(a.x,a.y,h),p.map.depthTexture.name=d.name+`.shadowMapDepth`,p.map.depthTexture.format=T,p.map.depthTexture.compareFunction=null,p.map.depthTexture.minFilter=r,p.map.depthTexture.magFilter=r}else d.isPointLight?(p.map=new gs(a.x),p.map.depthTexture=new Ni(a.x,m)):(p.map=new qt(a.x,a.y),p.map.depthTexture=new Mi(a.x,a.y,m)),p.map.depthTexture.name=d.name+`.shadowMap`,p.map.depthTexture.format=T,this.type===1?(p.map.depthTexture.compareFunction=b?518:515,p.map.depthTexture.minFilter=o,p.map.depthTexture.magFilter=o):(p.map.depthTexture.compareFunction=null,p.map.depthTexture.minFilter=r,p.map.depthTexture.magFilter=r);p.camera.updateProjectionMatrix()}let x=p.map.isWebGLCubeRenderTarget?6:1;for(let t=0;t<x;t++){if(p.map.isWebGLCubeRenderTarget)e.setRenderTarget(p.map,t),e.clear();else{t===0&&(e.setRenderTarget(p.map),e.clear());let n=p.getViewport(t);c.set(s.x*n.x,s.y*n.y,s.x*n.z,s.y*n.w),_.viewport(c)}if(d.isPointLight){let e=p.camera,n=p.matrix,r=d.distance||e.far;r!==e.far&&(e.far=r,e.updateProjectionMatrix()),Ll.setFromMatrixPosition(d.matrixWorld),e.position.copy(Ll),Rl.copy(e.position),Rl.add(Pl[t]),e.up.copy(Fl[t]),e.lookAt(Rl),e.updateMatrixWorld(),n.makeTranslation(-Ll.x,-Ll.y,-Ll.z),Il.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),p._frustum.setFromProjectionMatrix(Il,e.coordinateSystem,e.reversedDepth)}else p.updateMatrices(d);i=p.getFrustum(),E(n,l,p.camera,d,this.type)}p.isPointLightShadow!==!0&&this.type===3&&C(p,l),p.needsUpdate=!1}S=this.type,x.needsUpdate=!1,e.setRenderTarget(u,d,p)};function C(n,r){let i=t.update(b);_.defines.VSM_SAMPLES!==n.blurSamples&&(_.defines.VSM_SAMPLES=n.blurSamples,v.defines.VSM_SAMPLES=n.blurSamples,_.needsUpdate=!0,v.needsUpdate=!0),n.mapPass===null&&(n.mapPass=new qt(a.x,a.y,{format:O,type:g})),_.uniforms.shadow_pass.value=n.map.depthTexture,_.uniforms.resolution.value=n.mapSize,_.uniforms.radius.value=n.radius,e.setRenderTarget(n.mapPass),e.clear(),e.renderBufferDirect(r,null,i,_,b,null),v.uniforms.shadow_pass.value=n.mapPass.texture,v.uniforms.resolution.value=n.mapSize,v.uniforms.radius.value=n.radius,e.setRenderTarget(n.map),e.clear(),e.renderBufferDirect(r,null,i,v,b,null)}function w(t,n,r,i){let a=null,o=r.isPointLight===!0?t.customDistanceMaterial:t.customDepthMaterial;if(o!==void 0)a=o;else if(a=r.isPointLight===!0?u:l,e.localClippingEnabled&&n.clipShadows===!0&&Array.isArray(n.clippingPlanes)&&n.clippingPlanes.length!==0||n.displacementMap&&n.displacementScale!==0||n.alphaMap&&n.alphaTest>0||n.map&&n.alphaTest>0||n.alphaToCoverage===!0){let e=a.uuid,t=n.uuid,r=d[e];r===void 0&&(r={},d[e]=r);let i=r[t];i===void 0&&(i=a.clone(),r[t]=i,n.addEventListener(`dispose`,D)),a=i}if(a.visible=n.visible,a.wireframe=n.wireframe,i===3?a.side=n.shadowSide===null?n.side:n.shadowSide:a.side=n.shadowSide===null?p[n.side]:n.shadowSide,a.alphaMap=n.alphaMap,a.alphaTest=n.alphaToCoverage===!0?.5:n.alphaTest,a.map=n.map,a.clipShadows=n.clipShadows,a.clippingPlanes=n.clippingPlanes,a.clipIntersection=n.clipIntersection,a.displacementMap=n.displacementMap,a.displacementScale=n.displacementScale,a.displacementBias=n.displacementBias,a.wireframeLinewidth=n.wireframeLinewidth,a.linewidth=n.linewidth,r.isPointLight===!0&&a.isMeshDistanceMaterial===!0){let t=e.properties.get(a);t.light=r}return a}function E(n,r,a,o,s){if(n.visible===!1)return;if(n.layers.test(r.layers)&&(n.isMesh||n.isLine||n.isPoints)&&(n.castShadow||n.receiveShadow&&s===3)&&(!n.frustumCulled||i.intersectsObject(n))){n.modelViewMatrix.multiplyMatrices(a.matrixWorldInverse,n.matrixWorld);let i=t.update(n),c=n.material;if(Array.isArray(c)){let t=i.groups;for(let l=0,u=t.length;l<u;l++){let u=t[l],d=c[u.materialIndex];if(d&&d.visible){let t=w(n,d,o,s);n.onBeforeShadow(e,n,r,a,i,t,u),e.renderBufferDirect(a,null,i,t,n,u),n.onAfterShadow(e,n,r,a,i,t,u)}}}else if(c.visible){let t=w(n,c,o,s);n.onBeforeShadow(e,n,r,a,i,t,null),e.renderBufferDirect(a,null,i,t,n,null),n.onAfterShadow(e,n,r,a,i,t,null)}}let c=n.children;for(let e=0,t=c.length;e<t;e++)E(c[e],r,a,o,s)}function D(e){e.target.removeEventListener(`dispose`,D);for(let t in d){let n=d[t],r=e.target.uuid;r in n&&(n[r].dispose(),delete n[r])}}}function Bl(e,t){function n(){let t=!1,n=new Gt,r=null,i=new Gt(0,0,0,0);return{setMask:function(n){r!==n&&!t&&(e.colorMask(n,n,n,n),r=n)},setLocked:function(e){t=e},setClear:function(t,r,a,o,s){s===!0&&(t*=o,r*=o,a*=o),n.set(t,r,a,o),i.equals(n)===!1&&(e.clearColor(t,r,a,o),i.copy(n))},reset:function(){t=!1,r=null,i.set(-1,0,0,0)}}}function r(){let n=!1,r=!1,i=null,a=null,o=null;return{setReversed:function(e){if(r!==e){let n=t.get(`EXT_clip_control`);e?n.clipControlEXT(n.LOWER_LEFT_EXT,n.ZERO_TO_ONE_EXT):n.clipControlEXT(n.LOWER_LEFT_EXT,n.NEGATIVE_ONE_TO_ONE_EXT),r=e;let i=o;o=null,this.setClear(i)}},getReversed:function(){return r},setTest:function(t){t?N(e.DEPTH_TEST):de(e.DEPTH_TEST)},setMask:function(t){i!==t&&!n&&(e.depthMask(t),i=t)},setFunc:function(t){if(r&&(t=et[t]),a!==t){switch(t){case 0:e.depthFunc(e.NEVER);break;case 1:e.depthFunc(e.ALWAYS);break;case 2:e.depthFunc(e.LESS);break;case 3:e.depthFunc(e.LEQUAL);break;case 4:e.depthFunc(e.EQUAL);break;case 5:e.depthFunc(e.GEQUAL);break;case 6:e.depthFunc(e.GREATER);break;case 7:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}a=t}},setLocked:function(e){n=e},setClear:function(t){o!==t&&(o=t,r&&(t=1-t),e.clearDepth(t))},reset:function(){n=!1,i=null,a=null,o=null,r=!1}}}function i(){let t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null;return{setTest:function(n){t||(n?N(e.STENCIL_TEST):de(e.STENCIL_TEST))},setMask:function(r){n!==r&&!t&&(e.stencilMask(r),n=r)},setFunc:function(t,n,o){(r!==t||i!==n||a!==o)&&(e.stencilFunc(t,n,o),r=t,i=n,a=o)},setOp:function(t,n,r){(o!==t||s!==n||c!==r)&&(e.stencilOp(t,n,r),o=t,s=n,c=r)},setLocked:function(e){t=e},setClear:function(t){l!==t&&(e.clearStencil(t),l=t)},reset:function(){t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null}}}let a=new n,o=new r,s=new i,c=new WeakMap,l=new WeakMap,u={},d={},f={},p=new WeakMap,m=[],h=null,g=!1,_=null,v=null,y=null,b=null,x=null,S=null,C=null,w=new G(0,0,0),T=0,E=!1,D=null,ee=null,O=null,k=null,te=null,A=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS),j=!1,ne=0,re=e.getParameter(e.VERSION);re.indexOf(`WebGL`)===-1?re.indexOf(`OpenGL ES`)!==-1&&(ne=parseFloat(/^OpenGL ES (\d)/.exec(re)[1]),j=ne>=2):(ne=parseFloat(/^WebGL (\d)/.exec(re)[1]),j=ne>=1);let M=null,ie={},ae=e.getParameter(e.SCISSOR_BOX),oe=e.getParameter(e.VIEWPORT),se=new Gt().fromArray(ae),ce=new Gt().fromArray(oe);function le(t,n,r,i){let a=new Uint8Array(4),o=e.createTexture();e.bindTexture(t,o),e.texParameteri(t,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(t,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let o=0;o<r;o++)t===e.TEXTURE_3D||t===e.TEXTURE_2D_ARRAY?e.texImage3D(n,0,e.RGBA,1,1,i,0,e.RGBA,e.UNSIGNED_BYTE,a):e.texImage2D(n+o,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,a);return o}let ue={};ue[e.TEXTURE_2D]=le(e.TEXTURE_2D,e.TEXTURE_2D,1),ue[e.TEXTURE_CUBE_MAP]=le(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),ue[e.TEXTURE_2D_ARRAY]=le(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),ue[e.TEXTURE_3D]=le(e.TEXTURE_3D,e.TEXTURE_3D,1,1),a.setClear(0,0,0,1),o.setClear(1),s.setClear(0),N(e.DEPTH_TEST),o.setFunc(3),ye(!1),be(1),N(e.CULL_FACE),_e(0);function N(t){u[t]!==!0&&(e.enable(t),u[t]=!0)}function de(t){u[t]!==!1&&(e.disable(t),u[t]=!1)}function fe(t,n){return f[t]!==n&&(e.bindFramebuffer(t,n),f[t]=n,t===e.DRAW_FRAMEBUFFER&&(f[e.FRAMEBUFFER]=n),t===e.FRAMEBUFFER&&(f[e.DRAW_FRAMEBUFFER]=n),!0)}function pe(t,n){let r=m,i=!1;if(t){r=p.get(n),r===void 0&&(r=[],p.set(n,r));let a=t.textures;if(r.length!==a.length||r[0]!==e.COLOR_ATTACHMENT0){for(let t=0,n=a.length;t<n;t++)r[t]=e.COLOR_ATTACHMENT0+t;r.length=a.length,i=!0}}else r[0]!==e.BACK&&(r[0]=e.BACK,i=!0);i&&e.drawBuffers(r)}function me(t){return h!==t&&(e.useProgram(t),h=t,!0)}let he={100:e.FUNC_ADD,101:e.FUNC_SUBTRACT,102:e.FUNC_REVERSE_SUBTRACT};he[103]=e.MIN,he[104]=e.MAX;let ge={200:e.ZERO,201:e.ONE,202:e.SRC_COLOR,204:e.SRC_ALPHA,210:e.SRC_ALPHA_SATURATE,208:e.DST_COLOR,206:e.DST_ALPHA,203:e.ONE_MINUS_SRC_COLOR,205:e.ONE_MINUS_SRC_ALPHA,209:e.ONE_MINUS_DST_COLOR,207:e.ONE_MINUS_DST_ALPHA,211:e.CONSTANT_COLOR,212:e.ONE_MINUS_CONSTANT_COLOR,213:e.CONSTANT_ALPHA,214:e.ONE_MINUS_CONSTANT_ALPHA};function _e(t,n,r,i,a,o,s,c,l,u){if(t===0){g===!0&&(de(e.BLEND),g=!1);return}if(g===!1&&(N(e.BLEND),g=!0),t!==5){if(t!==_||u!==E){if((v!==100||x!==100)&&(e.blendEquation(e.FUNC_ADD),v=100,x=100),u)switch(t){case 1:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFunc(e.ONE,e.ONE);break;case 3:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case 4:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:z(`WebGLState: Invalid blending: `,t)}else switch(t){case 1:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case 3:z(`WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true`);break;case 4:z(`WebGLState: MultiplyBlending requires material.premultipliedAlpha = true`);break;default:z(`WebGLState: Invalid blending: `,t)}y=null,b=null,S=null,C=null,w.set(0,0,0),T=0,_=t,E=u}return}a||=n,o||=r,s||=i,(n!==v||a!==x)&&(e.blendEquationSeparate(he[n],he[a]),v=n,x=a),(r!==y||i!==b||o!==S||s!==C)&&(e.blendFuncSeparate(ge[r],ge[i],ge[o],ge[s]),y=r,b=i,S=o,C=s),(c.equals(w)===!1||l!==T)&&(e.blendColor(c.r,c.g,c.b,l),w.copy(c),T=l),_=t,E=!1}function ve(t,n){t.side===2?de(e.CULL_FACE):N(e.CULL_FACE);let r=t.side===1;n&&(r=!r),ye(r),t.blending===1&&t.transparent===!1?_e(0):_e(t.blending,t.blendEquation,t.blendSrc,t.blendDst,t.blendEquationAlpha,t.blendSrcAlpha,t.blendDstAlpha,t.blendColor,t.blendAlpha,t.premultipliedAlpha),o.setFunc(t.depthFunc),o.setTest(t.depthTest),o.setMask(t.depthWrite),a.setMask(t.colorWrite);let i=t.stencilWrite;s.setTest(i),i&&(s.setMask(t.stencilWriteMask),s.setFunc(t.stencilFunc,t.stencilRef,t.stencilFuncMask),s.setOp(t.stencilFail,t.stencilZFail,t.stencilZPass)),Se(t.polygonOffset,t.polygonOffsetFactor,t.polygonOffsetUnits),t.alphaToCoverage===!0?N(e.SAMPLE_ALPHA_TO_COVERAGE):de(e.SAMPLE_ALPHA_TO_COVERAGE)}function ye(t){D!==t&&(t?e.frontFace(e.CW):e.frontFace(e.CCW),D=t)}function be(t){t===0?de(e.CULL_FACE):(N(e.CULL_FACE),t!==ee&&(t===1?e.cullFace(e.BACK):t===2?e.cullFace(e.FRONT):e.cullFace(e.FRONT_AND_BACK))),ee=t}function xe(t){t!==O&&(j&&e.lineWidth(t),O=t)}function Se(t,n,r){t?(N(e.POLYGON_OFFSET_FILL),(k!==n||te!==r)&&(k=n,te=r,o.getReversed()&&(n=-n),e.polygonOffset(n,r))):de(e.POLYGON_OFFSET_FILL)}function Ce(t){t?N(e.SCISSOR_TEST):de(e.SCISSOR_TEST)}function we(t){t===void 0&&(t=e.TEXTURE0+A-1),M!==t&&(e.activeTexture(t),M=t)}function Te(t,n,r){r===void 0&&(r=M===null?e.TEXTURE0+A-1:M);let i=ie[r];i===void 0&&(i={type:void 0,texture:void 0},ie[r]=i),(i.type!==t||i.texture!==n)&&(M!==r&&(e.activeTexture(r),M=r),e.bindTexture(t,n||ue[t]),i.type=t,i.texture=n)}function Ee(){let t=ie[M];t!==void 0&&t.type!==void 0&&(e.bindTexture(t.type,null),t.type=void 0,t.texture=void 0)}function De(){try{e.compressedTexImage2D(...arguments)}catch(e){z(`WebGLState:`,e)}}function Oe(){try{e.compressedTexImage3D(...arguments)}catch(e){z(`WebGLState:`,e)}}function ke(){try{e.texSubImage2D(...arguments)}catch(e){z(`WebGLState:`,e)}}function Ae(){try{e.texSubImage3D(...arguments)}catch(e){z(`WebGLState:`,e)}}function je(){try{e.compressedTexSubImage2D(...arguments)}catch(e){z(`WebGLState:`,e)}}function Me(){try{e.compressedTexSubImage3D(...arguments)}catch(e){z(`WebGLState:`,e)}}function Ne(){try{e.texStorage2D(...arguments)}catch(e){z(`WebGLState:`,e)}}function Pe(){try{e.texStorage3D(...arguments)}catch(e){z(`WebGLState:`,e)}}function P(){try{e.texImage2D(...arguments)}catch(e){z(`WebGLState:`,e)}}function Fe(){try{e.texImage3D(...arguments)}catch(e){z(`WebGLState:`,e)}}function Ie(t){return d[t]===void 0?e.getParameter(t):d[t]}function Le(t,n){d[t]!==n&&(e.pixelStorei(t,n),d[t]=n)}function F(t){se.equals(t)===!1&&(e.scissor(t.x,t.y,t.z,t.w),se.copy(t))}function Re(t){ce.equals(t)===!1&&(e.viewport(t.x,t.y,t.z,t.w),ce.copy(t))}function I(t,n){let r=l.get(n);r===void 0&&(r=new WeakMap,l.set(n,r));let i=r.get(t);i===void 0&&(i=e.getUniformBlockIndex(n,t.name),r.set(t,i))}function ze(t,n){let r=l.get(n).get(t);c.get(n)!==r&&(e.uniformBlockBinding(n,r,t.__bindingPointIndex),c.set(n,r))}function L(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),o.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),u={},d={},M=null,ie={},f={},p=new WeakMap,m=[],h=null,g=!1,_=null,v=null,y=null,b=null,x=null,S=null,C=null,w=new G(0,0,0),T=0,E=!1,D=null,ee=null,O=null,k=null,te=null,se.set(0,0,e.canvas.width,e.canvas.height),ce.set(0,0,e.canvas.width,e.canvas.height),a.reset(),o.reset(),s.reset()}return{buffers:{color:a,depth:o,stencil:s},enable:N,disable:de,bindFramebuffer:fe,drawBuffers:pe,useProgram:me,setBlending:_e,setMaterial:ve,setFlipSided:ye,setCullFace:be,setLineWidth:xe,setPolygonOffset:Se,setScissorTest:Ce,activeTexture:we,bindTexture:Te,unbindTexture:Ee,compressedTexImage2D:De,compressedTexImage3D:Oe,texImage2D:P,texImage3D:Fe,pixelStorei:Le,getParameter:Ie,updateUBOMapping:I,uniformBlockBinding:ze,texStorage2D:Ne,texStorage3D:Pe,texSubImage2D:ke,texSubImage3D:Ae,compressedTexSubImage2D:je,compressedTexSubImage3D:Me,scissor:F,viewport:Re,reset:L}}function Vl(l,u,d,f,p,m,h){let g=u.has(`WEBGL_multisampled_render_to_texture`)?u.get(`WEBGL_multisampled_render_to_texture`):null,_=typeof navigator>`u`?!1:/OculusBrowser/g.test(navigator.userAgent),v=new V,y=new WeakMap,b=new Set,x,S=new WeakMap,C=!1;try{C=typeof OffscreenCanvas<`u`&&new OffscreenCanvas(1,1).getContext(`2d`)!==null}catch{}function w(e,t){return C?new OffscreenCanvas(e,t):qe(`canvas`)}function T(e,t,n){let r=1,i=Ie(e);if((i.width>n||i.height>n)&&(r=n/Math.max(i.width,i.height)),r<1){if(typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap||typeof VideoFrame<`u`&&e instanceof VideoFrame){let n=Math.floor(r*i.width),a=Math.floor(r*i.height);x===void 0&&(x=w(n,a));let o=t?w(n,a):x;return o.width=n,o.height=a,o.getContext(`2d`).drawImage(e,0,0,n,a),R(`WebGLRenderer: Texture has been resized from (`+i.width+`x`+i.height+`) to (`+n+`x`+a+`).`),o}return`data`in e&&R(`WebGLRenderer: Image in DataTexture is too big (`+i.width+`x`+i.height+`).`),e}return e}function D(e){return e.generateMipmaps}function ee(e){l.generateMipmap(e)}function O(e){return e.isWebGLCubeRenderTarget?l.TEXTURE_CUBE_MAP:e.isWebGL3DRenderTarget?l.TEXTURE_3D:e.isWebGLArrayRenderTarget||e.isCompressedArrayTexture?l.TEXTURE_2D_ARRAY:l.TEXTURE_2D}function k(e,t,n,r,i,a=!1){if(e!==null){if(l[e]!==void 0)return l[e];R(`WebGLRenderer: Attempt to use non-existing WebGL internal format '`+e+`'`)}let o;r&&(o=u.get(`EXT_texture_norm16`),o||R(`WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension`));let s=t;if(t===l.RED&&(n===l.FLOAT&&(s=l.R32F),n===l.HALF_FLOAT&&(s=l.R16F),n===l.UNSIGNED_BYTE&&(s=l.R8),n===l.UNSIGNED_SHORT&&o&&(s=o.R16_EXT),n===l.SHORT&&o&&(s=o.R16_SNORM_EXT)),t===l.RED_INTEGER&&(n===l.UNSIGNED_BYTE&&(s=l.R8UI),n===l.UNSIGNED_SHORT&&(s=l.R16UI),n===l.UNSIGNED_INT&&(s=l.R32UI),n===l.BYTE&&(s=l.R8I),n===l.SHORT&&(s=l.R16I),n===l.INT&&(s=l.R32I)),t===l.RG&&(n===l.FLOAT&&(s=l.RG32F),n===l.HALF_FLOAT&&(s=l.RG16F),n===l.UNSIGNED_BYTE&&(s=l.RG8),n===l.UNSIGNED_SHORT&&o&&(s=o.RG16_EXT),n===l.SHORT&&o&&(s=o.RG16_SNORM_EXT)),t===l.RG_INTEGER&&(n===l.UNSIGNED_BYTE&&(s=l.RG8UI),n===l.UNSIGNED_SHORT&&(s=l.RG16UI),n===l.UNSIGNED_INT&&(s=l.RG32UI),n===l.BYTE&&(s=l.RG8I),n===l.SHORT&&(s=l.RG16I),n===l.INT&&(s=l.RG32I)),t===l.RGB_INTEGER&&(n===l.UNSIGNED_BYTE&&(s=l.RGB8UI),n===l.UNSIGNED_SHORT&&(s=l.RGB16UI),n===l.UNSIGNED_INT&&(s=l.RGB32UI),n===l.BYTE&&(s=l.RGB8I),n===l.SHORT&&(s=l.RGB16I),n===l.INT&&(s=l.RGB32I)),t===l.RGBA_INTEGER&&(n===l.UNSIGNED_BYTE&&(s=l.RGBA8UI),n===l.UNSIGNED_SHORT&&(s=l.RGBA16UI),n===l.UNSIGNED_INT&&(s=l.RGBA32UI),n===l.BYTE&&(s=l.RGBA8I),n===l.SHORT&&(s=l.RGBA16I),n===l.INT&&(s=l.RGBA32I)),t===l.RGB&&(n===l.UNSIGNED_SHORT&&o&&(s=o.RGB16_EXT),n===l.SHORT&&o&&(s=o.RGB16_SNORM_EXT),n===l.UNSIGNED_INT_5_9_9_9_REV&&(s=l.RGB9_E5),n===l.UNSIGNED_INT_10F_11F_11F_REV&&(s=l.R11F_G11F_B10F)),t===l.RGBA){let e=a?Be:W.getTransfer(i);n===l.FLOAT&&(s=l.RGBA32F),n===l.HALF_FLOAT&&(s=l.RGBA16F),n===l.UNSIGNED_BYTE&&(s=e===`srgb`?l.SRGB8_ALPHA8:l.RGBA8),n===l.UNSIGNED_SHORT&&o&&(s=o.RGBA16_EXT),n===l.SHORT&&o&&(s=o.RGBA16_SNORM_EXT),n===l.UNSIGNED_SHORT_4_4_4_4&&(s=l.RGBA4),n===l.UNSIGNED_SHORT_5_5_5_1&&(s=l.RGB5_A1)}return(s===l.R16F||s===l.R32F||s===l.RG16F||s===l.RG32F||s===l.RGBA16F||s===l.RGBA32F)&&u.get(`EXT_color_buffer_float`),s}function te(e,t){let n;return e?t===null||t===1014||t===1020?n=l.DEPTH24_STENCIL8:t===1015?n=l.DEPTH32F_STENCIL8:t===1012&&(n=l.DEPTH24_STENCIL8,R(`DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.`)):t===null||t===1014||t===1020?n=l.DEPTH_COMPONENT24:t===1015?n=l.DEPTH_COMPONENT32F:t===1012&&(n=l.DEPTH_COMPONENT16),n}function A(e,t){return D(e)===!0||e.isFramebufferTexture&&e.minFilter!==1003&&e.minFilter!==1006?Math.log2(Math.max(t.width,t.height))+1:e.mipmaps!==void 0&&e.mipmaps.length>0?e.mipmaps.length:e.isCompressedTexture&&Array.isArray(e.image)?t.mipmaps.length:1}function j(e){let t=e.target;t.removeEventListener(`dispose`,j),re(t),t.isVideoTexture&&y.delete(t),t.isHTMLTexture&&b.delete(t)}function ne(e){let t=e.target;t.removeEventListener(`dispose`,ne),ie(t)}function re(e){let t=f.get(e);if(t.__webglInit===void 0)return;let n=e.source,r=S.get(n);if(r){let i=r[t.__cacheKey];i.usedTimes--,i.usedTimes===0&&M(e),Object.keys(r).length===0&&S.delete(n)}f.remove(e)}function M(e){let t=f.get(e);l.deleteTexture(t.__webglTexture);let n=e.source,r=S.get(n);delete r[t.__cacheKey],h.memory.textures--}function ie(e){let t=f.get(e);if(e.depthTexture&&(e.depthTexture.dispose(),f.remove(e.depthTexture)),e.isWebGLCubeRenderTarget)for(let e=0;e<6;e++){if(Array.isArray(t.__webglFramebuffer[e]))for(let n=0;n<t.__webglFramebuffer[e].length;n++)l.deleteFramebuffer(t.__webglFramebuffer[e][n]);else l.deleteFramebuffer(t.__webglFramebuffer[e]);t.__webglDepthbuffer&&l.deleteRenderbuffer(t.__webglDepthbuffer[e])}else{if(Array.isArray(t.__webglFramebuffer))for(let e=0;e<t.__webglFramebuffer.length;e++)l.deleteFramebuffer(t.__webglFramebuffer[e]);else l.deleteFramebuffer(t.__webglFramebuffer);if(t.__webglDepthbuffer&&l.deleteRenderbuffer(t.__webglDepthbuffer),t.__webglMultisampledFramebuffer&&l.deleteFramebuffer(t.__webglMultisampledFramebuffer),t.__webglColorRenderbuffer)for(let e=0;e<t.__webglColorRenderbuffer.length;e++)t.__webglColorRenderbuffer[e]&&l.deleteRenderbuffer(t.__webglColorRenderbuffer[e]);t.__webglDepthRenderbuffer&&l.deleteRenderbuffer(t.__webglDepthRenderbuffer)}let n=e.textures;for(let e=0,t=n.length;e<t;e++){let t=f.get(n[e]);t.__webglTexture&&(l.deleteTexture(t.__webglTexture),h.memory.textures--),f.remove(n[e])}f.remove(e)}let ae=0;function oe(){ae=0}function se(){return ae}function ce(e){ae=e}function le(){let e=ae;return e>=p.maxTextures&&R(`WebGLTextures: Trying to use `+e+` texture units while this GPU supports only `+p.maxTextures),ae+=1,e}function ue(e){let t=[];return t.push(e.wrapS),t.push(e.wrapT),t.push(e.wrapR||0),t.push(e.magFilter),t.push(e.minFilter),t.push(e.anisotropy),t.push(e.internalFormat),t.push(e.format),t.push(e.type),t.push(e.generateMipmaps),t.push(e.premultiplyAlpha),t.push(e.flipY),t.push(e.unpackAlignment),t.push(e.colorSpace),t.join()}function N(e,t){let n=f.get(e);if(e.isVideoTexture&&P(e),e.isRenderTargetTexture===!1&&e.isExternalTexture!==!0&&e.version>0&&n.__version!==e.version){let r=e.image;if(r===null)R(`WebGLRenderer: Texture marked for update but no image data found.`);else if(r.complete===!1)R(`WebGLRenderer: Texture marked for update but image is incomplete`);else{xe(n,e,t);return}}else e.isExternalTexture&&(n.__webglTexture=e.sourceTexture?e.sourceTexture:null);d.bindTexture(l.TEXTURE_2D,n.__webglTexture,l.TEXTURE0+t)}function de(e,t){let n=f.get(e);if(e.isRenderTargetTexture===!1&&e.version>0&&n.__version!==e.version){xe(n,e,t);return}e.isExternalTexture&&(n.__webglTexture=e.sourceTexture?e.sourceTexture:null),d.bindTexture(l.TEXTURE_2D_ARRAY,n.__webglTexture,l.TEXTURE0+t)}function fe(e,t){let n=f.get(e);if(e.isRenderTargetTexture===!1&&e.version>0&&n.__version!==e.version){xe(n,e,t);return}d.bindTexture(l.TEXTURE_3D,n.__webglTexture,l.TEXTURE0+t)}function pe(e,t){let n=f.get(e);if(e.isCubeDepthTexture!==!0&&e.version>0&&n.__version!==e.version){Se(n,e,t);return}d.bindTexture(l.TEXTURE_CUBE_MAP,n.__webglTexture,l.TEXTURE0+t)}let me={[e]:l.REPEAT,[t]:l.CLAMP_TO_EDGE,[n]:l.MIRRORED_REPEAT},he={[r]:l.NEAREST,[i]:l.NEAREST_MIPMAP_NEAREST,[a]:l.NEAREST_MIPMAP_LINEAR,[o]:l.LINEAR,[s]:l.LINEAR_MIPMAP_NEAREST,[c]:l.LINEAR_MIPMAP_LINEAR},ge={512:l.NEVER,519:l.ALWAYS,513:l.LESS,515:l.LEQUAL,514:l.EQUAL,518:l.GEQUAL,516:l.GREATER,517:l.NOTEQUAL};function _e(e,t){if(t.type===1015&&u.has(`OES_texture_float_linear`)===!1&&(t.magFilter===1006||t.magFilter===1007||t.magFilter===1005||t.magFilter===1008||t.minFilter===1006||t.minFilter===1007||t.minFilter===1005||t.minFilter===1008)&&R(`WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.`),l.texParameteri(e,l.TEXTURE_WRAP_S,me[t.wrapS]),l.texParameteri(e,l.TEXTURE_WRAP_T,me[t.wrapT]),(e===l.TEXTURE_3D||e===l.TEXTURE_2D_ARRAY)&&l.texParameteri(e,l.TEXTURE_WRAP_R,me[t.wrapR]),l.texParameteri(e,l.TEXTURE_MAG_FILTER,he[t.magFilter]),l.texParameteri(e,l.TEXTURE_MIN_FILTER,he[t.minFilter]),t.compareFunction&&(l.texParameteri(e,l.TEXTURE_COMPARE_MODE,l.COMPARE_REF_TO_TEXTURE),l.texParameteri(e,l.TEXTURE_COMPARE_FUNC,ge[t.compareFunction])),u.has(`EXT_texture_filter_anisotropic`)===!0){if(t.magFilter===1003||t.minFilter!==1005&&t.minFilter!==1008||t.type===1015&&u.has(`OES_texture_float_linear`)===!1)return;if(t.anisotropy>1||f.get(t).__currentAnisotropy){let n=u.get(`EXT_texture_filter_anisotropic`);l.texParameterf(e,n.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(t.anisotropy,p.getMaxAnisotropy())),f.get(t).__currentAnisotropy=t.anisotropy}}}function ve(e,t){let n=!1;e.__webglInit===void 0&&(e.__webglInit=!0,t.addEventListener(`dispose`,j));let r=t.source,i=S.get(r);i===void 0&&(i={},S.set(r,i));let a=ue(t);if(a!==e.__cacheKey){i[a]===void 0&&(i[a]={texture:l.createTexture(),usedTimes:0},h.memory.textures++,n=!0),i[a].usedTimes++;let r=i[e.__cacheKey];r!==void 0&&(i[e.__cacheKey].usedTimes--,r.usedTimes===0&&M(t)),e.__cacheKey=a,e.__webglTexture=i[a].texture}return n}function ye(e,t,n){return Math.floor(Math.floor(e/n)/t)}function be(e,t,n,r){let i=e.updateRanges;if(i.length===0)d.texSubImage2D(l.TEXTURE_2D,0,0,0,t.width,t.height,n,r,t.data);else{i.sort((e,t)=>e.start-t.start);let a=0;for(let e=1;e<i.length;e++){let n=i[a],r=i[e],o=n.start+n.count,s=ye(r.start,t.width,4),c=ye(n.start,t.width,4);r.start<=o+1&&s===c&&ye(r.start+r.count-1,t.width,4)===s?n.count=Math.max(n.count,r.start+r.count-n.start):(++a,i[a]=r)}i.length=a+1;let o=d.getParameter(l.UNPACK_ROW_LENGTH),s=d.getParameter(l.UNPACK_SKIP_PIXELS),c=d.getParameter(l.UNPACK_SKIP_ROWS);d.pixelStorei(l.UNPACK_ROW_LENGTH,t.width);for(let e=0,a=i.length;e<a;e++){let a=i[e],o=Math.floor(a.start/4),s=Math.ceil(a.count/4),c=o%t.width,u=Math.floor(o/t.width),f=s;d.pixelStorei(l.UNPACK_SKIP_PIXELS,c),d.pixelStorei(l.UNPACK_SKIP_ROWS,u),d.texSubImage2D(l.TEXTURE_2D,0,c,u,f,1,n,r,t.data)}e.clearUpdateRanges(),d.pixelStorei(l.UNPACK_ROW_LENGTH,o),d.pixelStorei(l.UNPACK_SKIP_PIXELS,s),d.pixelStorei(l.UNPACK_SKIP_ROWS,c)}}function xe(e,t,n){let r=l.TEXTURE_2D;(t.isDataArrayTexture||t.isCompressedArrayTexture)&&(r=l.TEXTURE_2D_ARRAY),t.isData3DTexture&&(r=l.TEXTURE_3D);let i=ve(e,t),a=t.source;d.bindTexture(r,e.__webglTexture,l.TEXTURE0+n);let o=f.get(a);if(a.version!==o.__version||i===!0){if(d.activeTexture(l.TEXTURE0+n),!(typeof ImageBitmap<`u`&&t.image instanceof ImageBitmap)){let e=W.getPrimaries(W.workingColorSpace),n=t.colorSpace===``?null:W.getPrimaries(t.colorSpace),r=t.colorSpace===``||e===n?l.NONE:l.BROWSER_DEFAULT_WEBGL;d.pixelStorei(l.UNPACK_FLIP_Y_WEBGL,t.flipY),d.pixelStorei(l.UNPACK_PREMULTIPLY_ALPHA_WEBGL,t.premultiplyAlpha),d.pixelStorei(l.UNPACK_COLORSPACE_CONVERSION_WEBGL,r)}d.pixelStorei(l.UNPACK_ALIGNMENT,t.unpackAlignment);let e=T(t.image,!1,p.maxTextureSize);e=Fe(t,e);let s=m.convert(t.format,t.colorSpace),c=m.convert(t.type),u=k(t.internalFormat,s,c,t.normalized,t.colorSpace,t.isVideoTexture);_e(r,t);let f,h=t.mipmaps,g=t.isVideoTexture!==!0,_=o.__version===void 0||i===!0,v=a.dataReady,y=A(t,e);if(t.isDepthTexture)u=te(t.format===E,t.type),_&&(g?d.texStorage2D(l.TEXTURE_2D,1,u,e.width,e.height):d.texImage2D(l.TEXTURE_2D,0,u,e.width,e.height,0,s,c,null));else if(t.isDataTexture){if(h.length>0){g&&_&&d.texStorage2D(l.TEXTURE_2D,y,u,h[0].width,h[0].height);for(let e=0,t=h.length;e<t;e++)f=h[e],g?v&&d.texSubImage2D(l.TEXTURE_2D,e,0,0,f.width,f.height,s,c,f.data):d.texImage2D(l.TEXTURE_2D,e,u,f.width,f.height,0,s,c,f.data);t.generateMipmaps=!1}else g?(_&&d.texStorage2D(l.TEXTURE_2D,y,u,e.width,e.height),v&&be(t,e,s,c)):d.texImage2D(l.TEXTURE_2D,0,u,e.width,e.height,0,s,c,e.data)}else if(t.isCompressedTexture){if(t.isCompressedArrayTexture){g&&_&&d.texStorage3D(l.TEXTURE_2D_ARRAY,y,u,h[0].width,h[0].height,e.depth);for(let n=0,r=h.length;n<r;n++)if(f=h[n],t.format!==1023){if(s!==null){if(g){if(v){if(t.layerUpdates.size>0){let e=Lo(f.width,f.height,t.format,t.type);for(let r of t.layerUpdates){let t=f.data.subarray(r*e/f.data.BYTES_PER_ELEMENT,(r+1)*e/f.data.BYTES_PER_ELEMENT);d.compressedTexSubImage3D(l.TEXTURE_2D_ARRAY,n,0,0,r,f.width,f.height,1,s,t)}t.clearLayerUpdates()}else d.compressedTexSubImage3D(l.TEXTURE_2D_ARRAY,n,0,0,0,f.width,f.height,e.depth,s,f.data)}}else d.compressedTexImage3D(l.TEXTURE_2D_ARRAY,n,u,f.width,f.height,e.depth,0,f.data,0,0)}else R(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`)}else g?v&&d.texSubImage3D(l.TEXTURE_2D_ARRAY,n,0,0,0,f.width,f.height,e.depth,s,c,f.data):d.texImage3D(l.TEXTURE_2D_ARRAY,n,u,f.width,f.height,e.depth,0,s,c,f.data)}else{g&&_&&d.texStorage2D(l.TEXTURE_2D,y,u,h[0].width,h[0].height);for(let e=0,n=h.length;e<n;e++)f=h[e],t.format===1023?g?v&&d.texSubImage2D(l.TEXTURE_2D,e,0,0,f.width,f.height,s,c,f.data):d.texImage2D(l.TEXTURE_2D,e,u,f.width,f.height,0,s,c,f.data):s===null?R(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`):g?v&&d.compressedTexSubImage2D(l.TEXTURE_2D,e,0,0,f.width,f.height,s,f.data):d.compressedTexImage2D(l.TEXTURE_2D,e,u,f.width,f.height,0,f.data)}}else if(t.isDataArrayTexture){if(g){if(_&&d.texStorage3D(l.TEXTURE_2D_ARRAY,y,u,e.width,e.height,e.depth),v){if(t.layerUpdates.size>0){let n=Lo(e.width,e.height,t.format,t.type);for(let r of t.layerUpdates){let t=e.data.subarray(r*n/e.data.BYTES_PER_ELEMENT,(r+1)*n/e.data.BYTES_PER_ELEMENT);d.texSubImage3D(l.TEXTURE_2D_ARRAY,0,0,0,r,e.width,e.height,1,s,c,t)}t.clearLayerUpdates()}else d.texSubImage3D(l.TEXTURE_2D_ARRAY,0,0,0,0,e.width,e.height,e.depth,s,c,e.data)}}else d.texImage3D(l.TEXTURE_2D_ARRAY,0,u,e.width,e.height,e.depth,0,s,c,e.data)}else if(t.isData3DTexture)g?(_&&d.texStorage3D(l.TEXTURE_3D,y,u,e.width,e.height,e.depth),v&&d.texSubImage3D(l.TEXTURE_3D,0,0,0,0,e.width,e.height,e.depth,s,c,e.data)):d.texImage3D(l.TEXTURE_3D,0,u,e.width,e.height,e.depth,0,s,c,e.data);else if(t.isFramebufferTexture){if(_){if(g)d.texStorage2D(l.TEXTURE_2D,y,u,e.width,e.height);else{let t=e.width,n=e.height;for(let e=0;e<y;e++)d.texImage2D(l.TEXTURE_2D,e,u,t,n,0,s,c,null),t>>=1,n>>=1}}}else if(t.isHTMLTexture){if(`texElementImage2D`in l){let n=l.canvas;if(n.hasAttribute(`layoutsubtree`)||n.setAttribute(`layoutsubtree`,`true`),e.parentNode!==n){n.appendChild(e),b.add(t),n.onpaint=e=>{let t=e.changedElements;for(let e of b)t.includes(e.image)&&(e.needsUpdate=!0)},n.requestPaint();return}if(l.texElementImage2D.length===3)l.texElementImage2D(l.TEXTURE_2D,l.RGBA8,e);else{let t=l.RGBA,n=l.RGBA,r=l.UNSIGNED_BYTE;l.texElementImage2D(l.TEXTURE_2D,0,t,n,r,e)}l.texParameteri(l.TEXTURE_2D,l.TEXTURE_MIN_FILTER,l.LINEAR),l.texParameteri(l.TEXTURE_2D,l.TEXTURE_WRAP_S,l.CLAMP_TO_EDGE),l.texParameteri(l.TEXTURE_2D,l.TEXTURE_WRAP_T,l.CLAMP_TO_EDGE)}}else if(h.length>0){if(g&&_){let e=Ie(h[0]);d.texStorage2D(l.TEXTURE_2D,y,u,e.width,e.height)}for(let e=0,t=h.length;e<t;e++)f=h[e],g?v&&d.texSubImage2D(l.TEXTURE_2D,e,0,0,s,c,f):d.texImage2D(l.TEXTURE_2D,e,u,s,c,f);t.generateMipmaps=!1}else if(g){if(_){let t=Ie(e);d.texStorage2D(l.TEXTURE_2D,y,u,t.width,t.height)}v&&d.texSubImage2D(l.TEXTURE_2D,0,0,0,s,c,e)}else d.texImage2D(l.TEXTURE_2D,0,u,s,c,e);D(t)&&ee(r),o.__version=a.version,t.onUpdate&&t.onUpdate(t)}e.__version=t.version}function Se(e,t,n){if(t.image.length!==6)return;let r=ve(e,t),i=t.source;d.bindTexture(l.TEXTURE_CUBE_MAP,e.__webglTexture,l.TEXTURE0+n);let a=f.get(i);if(i.version!==a.__version||r===!0){d.activeTexture(l.TEXTURE0+n);let e=W.getPrimaries(W.workingColorSpace),o=t.colorSpace===``?null:W.getPrimaries(t.colorSpace),s=t.colorSpace===``||e===o?l.NONE:l.BROWSER_DEFAULT_WEBGL;d.pixelStorei(l.UNPACK_FLIP_Y_WEBGL,t.flipY),d.pixelStorei(l.UNPACK_PREMULTIPLY_ALPHA_WEBGL,t.premultiplyAlpha),d.pixelStorei(l.UNPACK_ALIGNMENT,t.unpackAlignment),d.pixelStorei(l.UNPACK_COLORSPACE_CONVERSION_WEBGL,s);let c=t.isCompressedTexture||t.image[0].isCompressedTexture,u=t.image[0]&&t.image[0].isDataTexture,f=[];for(let e=0;e<6;e++)!c&&!u?f[e]=T(t.image[e],!0,p.maxCubemapSize):f[e]=u?t.image[e].image:t.image[e],f[e]=Fe(t,f[e]);let h=f[0],g=m.convert(t.format,t.colorSpace),_=m.convert(t.type),v=k(t.internalFormat,g,_,t.normalized,t.colorSpace),y=t.isVideoTexture!==!0,b=a.__version===void 0||r===!0,x=i.dataReady,S=A(t,h);_e(l.TEXTURE_CUBE_MAP,t);let C;if(c){y&&b&&d.texStorage2D(l.TEXTURE_CUBE_MAP,S,v,h.width,h.height);for(let e=0;e<6;e++){C=f[e].mipmaps;for(let n=0;n<C.length;n++){let r=C[n];t.format===1023?y?x&&d.texSubImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,n,0,0,r.width,r.height,g,_,r.data):d.texImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,n,v,r.width,r.height,0,g,_,r.data):g===null?R(`WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()`):y?x&&d.compressedTexSubImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,n,0,0,r.width,r.height,g,r.data):d.compressedTexImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,n,v,r.width,r.height,0,r.data)}}}else{if(C=t.mipmaps,y&&b){C.length>0&&S++;let e=Ie(f[0]);d.texStorage2D(l.TEXTURE_CUBE_MAP,S,v,e.width,e.height)}for(let e=0;e<6;e++)if(u){y?x&&d.texSubImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,0,0,0,f[e].width,f[e].height,g,_,f[e].data):d.texImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,0,v,f[e].width,f[e].height,0,g,_,f[e].data);for(let t=0;t<C.length;t++){let n=C[t].image[e].image;y?x&&d.texSubImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,t+1,0,0,n.width,n.height,g,_,n.data):d.texImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,t+1,v,n.width,n.height,0,g,_,n.data)}}else{y?x&&d.texSubImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,0,0,0,g,_,f[e]):d.texImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,0,v,g,_,f[e]);for(let t=0;t<C.length;t++){let n=C[t];y?x&&d.texSubImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,t+1,0,0,g,_,n.image[e]):d.texImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+e,t+1,v,g,_,n.image[e])}}}D(t)&&ee(l.TEXTURE_CUBE_MAP),a.__version=i.version,t.onUpdate&&t.onUpdate(t)}e.__version=t.version}function Ce(e,t,n,r,i,a){let o=m.convert(n.format,n.colorSpace),s=m.convert(n.type),c=k(n.internalFormat,o,s,n.normalized,n.colorSpace),u=f.get(t),p=f.get(n);if(p.__renderTarget=t,!u.__hasExternalTextures){let e=Math.max(1,t.width>>a),n=Math.max(1,t.height>>a);i===l.TEXTURE_3D||i===l.TEXTURE_2D_ARRAY?d.texImage3D(i,a,c,e,n,t.depth,0,o,s,null):d.texImage2D(i,a,c,e,n,0,o,s,null)}d.bindFramebuffer(l.FRAMEBUFFER,e),Pe(t)?g.framebufferTexture2DMultisampleEXT(l.FRAMEBUFFER,r,i,p.__webglTexture,0,Ne(t)):(i===l.TEXTURE_2D||i>=l.TEXTURE_CUBE_MAP_POSITIVE_X&&i<=l.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&l.framebufferTexture2D(l.FRAMEBUFFER,r,i,p.__webglTexture,a),d.bindFramebuffer(l.FRAMEBUFFER,null)}function we(e,t,n){if(l.bindRenderbuffer(l.RENDERBUFFER,e),t.depthBuffer){let r=t.depthTexture,i=r&&r.isDepthTexture?r.type:null,a=te(t.stencilBuffer,i),o=t.stencilBuffer?l.DEPTH_STENCIL_ATTACHMENT:l.DEPTH_ATTACHMENT;Pe(t)?g.renderbufferStorageMultisampleEXT(l.RENDERBUFFER,Ne(t),a,t.width,t.height):n?l.renderbufferStorageMultisample(l.RENDERBUFFER,Ne(t),a,t.width,t.height):l.renderbufferStorage(l.RENDERBUFFER,a,t.width,t.height),l.framebufferRenderbuffer(l.FRAMEBUFFER,o,l.RENDERBUFFER,e)}else{let e=t.textures;for(let r=0;r<e.length;r++){let i=e[r],a=m.convert(i.format,i.colorSpace),o=m.convert(i.type),s=k(i.internalFormat,a,o,i.normalized,i.colorSpace);Pe(t)?g.renderbufferStorageMultisampleEXT(l.RENDERBUFFER,Ne(t),s,t.width,t.height):n?l.renderbufferStorageMultisample(l.RENDERBUFFER,Ne(t),s,t.width,t.height):l.renderbufferStorage(l.RENDERBUFFER,s,t.width,t.height)}}l.bindRenderbuffer(l.RENDERBUFFER,null)}function Te(e,t,n){let r=t.isWebGLCubeRenderTarget===!0;if(d.bindFramebuffer(l.FRAMEBUFFER,e),!(t.depthTexture&&t.depthTexture.isDepthTexture))throw Error(`THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.`);let i=f.get(t.depthTexture);if(i.__renderTarget=t,(!i.__webglTexture||t.depthTexture.image.width!==t.width||t.depthTexture.image.height!==t.height)&&(t.depthTexture.image.width=t.width,t.depthTexture.image.height=t.height,t.depthTexture.needsUpdate=!0),r){if(i.__webglInit===void 0&&(i.__webglInit=!0,t.depthTexture.addEventListener(`dispose`,j)),i.__webglTexture===void 0){i.__webglTexture=l.createTexture(),d.bindTexture(l.TEXTURE_CUBE_MAP,i.__webglTexture),_e(l.TEXTURE_CUBE_MAP,t.depthTexture);let e=m.convert(t.depthTexture.format),n=m.convert(t.depthTexture.type),r;t.depthTexture.format===1026?r=l.DEPTH_COMPONENT24:t.depthTexture.format===1027&&(r=l.DEPTH24_STENCIL8);for(let i=0;i<6;i++)l.texImage2D(l.TEXTURE_CUBE_MAP_POSITIVE_X+i,0,r,t.width,t.height,0,e,n,null)}}else N(t.depthTexture,0);let a=i.__webglTexture,o=Ne(t),s=r?l.TEXTURE_CUBE_MAP_POSITIVE_X+n:l.TEXTURE_2D,c=t.depthTexture.format===1027?l.DEPTH_STENCIL_ATTACHMENT:l.DEPTH_ATTACHMENT;if(t.depthTexture.format===1026)Pe(t)?g.framebufferTexture2DMultisampleEXT(l.FRAMEBUFFER,c,s,a,0,o):l.framebufferTexture2D(l.FRAMEBUFFER,c,s,a,0);else if(t.depthTexture.format===1027)Pe(t)?g.framebufferTexture2DMultisampleEXT(l.FRAMEBUFFER,c,s,a,0,o):l.framebufferTexture2D(l.FRAMEBUFFER,c,s,a,0);else throw Error(`THREE.WebGLTextures: Unknown depthTexture format.`)}function Ee(e){let t=f.get(e),n=e.isWebGLCubeRenderTarget===!0;if(t.__boundDepthTexture!==e.depthTexture){let n=e.depthTexture;if(t.__depthDisposeCallback&&t.__depthDisposeCallback(),n){let e=()=>{delete t.__boundDepthTexture,delete t.__depthDisposeCallback,n.removeEventListener(`dispose`,e)};n.addEventListener(`dispose`,e),t.__depthDisposeCallback=e}t.__boundDepthTexture=n}if(e.depthTexture&&!t.__autoAllocateDepthBuffer){if(n)for(let n=0;n<6;n++)Te(t.__webglFramebuffer[n],e,n);else{let n=e.texture.mipmaps;n&&n.length>0?Te(t.__webglFramebuffer[0],e,0):Te(t.__webglFramebuffer,e,0)}}else if(n){t.__webglDepthbuffer=[];for(let n=0;n<6;n++)if(d.bindFramebuffer(l.FRAMEBUFFER,t.__webglFramebuffer[n]),t.__webglDepthbuffer[n]===void 0)t.__webglDepthbuffer[n]=l.createRenderbuffer(),we(t.__webglDepthbuffer[n],e,!1);else{let r=e.stencilBuffer?l.DEPTH_STENCIL_ATTACHMENT:l.DEPTH_ATTACHMENT,i=t.__webglDepthbuffer[n];l.bindRenderbuffer(l.RENDERBUFFER,i),l.framebufferRenderbuffer(l.FRAMEBUFFER,r,l.RENDERBUFFER,i)}}else{let n=e.texture.mipmaps;if(n&&n.length>0?d.bindFramebuffer(l.FRAMEBUFFER,t.__webglFramebuffer[0]):d.bindFramebuffer(l.FRAMEBUFFER,t.__webglFramebuffer),t.__webglDepthbuffer===void 0)t.__webglDepthbuffer=l.createRenderbuffer(),we(t.__webglDepthbuffer,e,!1);else{let n=e.stencilBuffer?l.DEPTH_STENCIL_ATTACHMENT:l.DEPTH_ATTACHMENT,r=t.__webglDepthbuffer;l.bindRenderbuffer(l.RENDERBUFFER,r),l.framebufferRenderbuffer(l.FRAMEBUFFER,n,l.RENDERBUFFER,r)}}d.bindFramebuffer(l.FRAMEBUFFER,null)}function De(e,t,n){let r=f.get(e);t!==void 0&&Ce(r.__webglFramebuffer,e,e.texture,l.COLOR_ATTACHMENT0,l.TEXTURE_2D,0),n!==void 0&&Ee(e)}function Oe(e){let t=e.texture,n=f.get(e),r=f.get(t);e.addEventListener(`dispose`,ne);let i=e.textures,a=e.isWebGLCubeRenderTarget===!0,o=i.length>1;if(o||(r.__webglTexture===void 0&&(r.__webglTexture=l.createTexture()),r.__version=t.version,h.memory.textures++),a){n.__webglFramebuffer=[];for(let e=0;e<6;e++)if(t.mipmaps&&t.mipmaps.length>0){n.__webglFramebuffer[e]=[];for(let r=0;r<t.mipmaps.length;r++)n.__webglFramebuffer[e][r]=l.createFramebuffer()}else n.__webglFramebuffer[e]=l.createFramebuffer()}else{if(t.mipmaps&&t.mipmaps.length>0){n.__webglFramebuffer=[];for(let e=0;e<t.mipmaps.length;e++)n.__webglFramebuffer[e]=l.createFramebuffer()}else n.__webglFramebuffer=l.createFramebuffer();if(o)for(let e=0,t=i.length;e<t;e++){let t=f.get(i[e]);t.__webglTexture===void 0&&(t.__webglTexture=l.createTexture(),h.memory.textures++)}if(e.samples>0&&Pe(e)===!1){n.__webglMultisampledFramebuffer=l.createFramebuffer(),n.__webglColorRenderbuffer=[],d.bindFramebuffer(l.FRAMEBUFFER,n.__webglMultisampledFramebuffer);for(let t=0;t<i.length;t++){let r=i[t];n.__webglColorRenderbuffer[t]=l.createRenderbuffer(),l.bindRenderbuffer(l.RENDERBUFFER,n.__webglColorRenderbuffer[t]);let a=m.convert(r.format,r.colorSpace),o=m.convert(r.type),s=k(r.internalFormat,a,o,r.normalized,r.colorSpace,e.isXRRenderTarget===!0),c=Ne(e);l.renderbufferStorageMultisample(l.RENDERBUFFER,c,s,e.width,e.height),l.framebufferRenderbuffer(l.FRAMEBUFFER,l.COLOR_ATTACHMENT0+t,l.RENDERBUFFER,n.__webglColorRenderbuffer[t])}l.bindRenderbuffer(l.RENDERBUFFER,null),e.depthBuffer&&(n.__webglDepthRenderbuffer=l.createRenderbuffer(),we(n.__webglDepthRenderbuffer,e,!0)),d.bindFramebuffer(l.FRAMEBUFFER,null)}}if(a){d.bindTexture(l.TEXTURE_CUBE_MAP,r.__webglTexture),_e(l.TEXTURE_CUBE_MAP,t);for(let r=0;r<6;r++)if(t.mipmaps&&t.mipmaps.length>0)for(let i=0;i<t.mipmaps.length;i++)Ce(n.__webglFramebuffer[r][i],e,t,l.COLOR_ATTACHMENT0,l.TEXTURE_CUBE_MAP_POSITIVE_X+r,i);else Ce(n.__webglFramebuffer[r],e,t,l.COLOR_ATTACHMENT0,l.TEXTURE_CUBE_MAP_POSITIVE_X+r,0);D(t)&&ee(l.TEXTURE_CUBE_MAP),d.unbindTexture()}else if(o){for(let t=0,r=i.length;t<r;t++){let r=i[t],a=f.get(r),o=l.TEXTURE_2D;(e.isWebGL3DRenderTarget||e.isWebGLArrayRenderTarget)&&(o=e.isWebGL3DRenderTarget?l.TEXTURE_3D:l.TEXTURE_2D_ARRAY),d.bindTexture(o,a.__webglTexture),_e(o,r),Ce(n.__webglFramebuffer,e,r,l.COLOR_ATTACHMENT0+t,o,0),D(r)&&ee(o)}d.unbindTexture()}else{let i=l.TEXTURE_2D;if((e.isWebGL3DRenderTarget||e.isWebGLArrayRenderTarget)&&(i=e.isWebGL3DRenderTarget?l.TEXTURE_3D:l.TEXTURE_2D_ARRAY),d.bindTexture(i,r.__webglTexture),_e(i,t),t.mipmaps&&t.mipmaps.length>0)for(let r=0;r<t.mipmaps.length;r++)Ce(n.__webglFramebuffer[r],e,t,l.COLOR_ATTACHMENT0,i,r);else Ce(n.__webglFramebuffer,e,t,l.COLOR_ATTACHMENT0,i,0);D(t)&&ee(i),d.unbindTexture()}e.depthBuffer&&Ee(e)}function ke(e){let t=e.textures;for(let n=0,r=t.length;n<r;n++){let r=t[n];if(D(r)){let t=O(e),n=f.get(r).__webglTexture;d.bindTexture(t,n),ee(t),d.unbindTexture()}}}let Ae=[],je=[];function Me(e){if(e.samples>0){if(Pe(e)===!1){let t=e.textures,n=e.width,r=e.height,i=l.COLOR_BUFFER_BIT,a=e.stencilBuffer?l.DEPTH_STENCIL_ATTACHMENT:l.DEPTH_ATTACHMENT,o=f.get(e),s=t.length>1;if(s)for(let e=0;e<t.length;e++)d.bindFramebuffer(l.FRAMEBUFFER,o.__webglMultisampledFramebuffer),l.framebufferRenderbuffer(l.FRAMEBUFFER,l.COLOR_ATTACHMENT0+e,l.RENDERBUFFER,null),d.bindFramebuffer(l.FRAMEBUFFER,o.__webglFramebuffer),l.framebufferTexture2D(l.DRAW_FRAMEBUFFER,l.COLOR_ATTACHMENT0+e,l.TEXTURE_2D,null,0);d.bindFramebuffer(l.READ_FRAMEBUFFER,o.__webglMultisampledFramebuffer);let c=e.texture.mipmaps;c&&c.length>0?d.bindFramebuffer(l.DRAW_FRAMEBUFFER,o.__webglFramebuffer[0]):d.bindFramebuffer(l.DRAW_FRAMEBUFFER,o.__webglFramebuffer);for(let c=0;c<t.length;c++){if(e.resolveDepthBuffer&&(e.depthBuffer&&(i|=l.DEPTH_BUFFER_BIT),e.stencilBuffer&&e.resolveStencilBuffer&&(i|=l.STENCIL_BUFFER_BIT)),s){l.framebufferRenderbuffer(l.READ_FRAMEBUFFER,l.COLOR_ATTACHMENT0,l.RENDERBUFFER,o.__webglColorRenderbuffer[c]);let e=f.get(t[c]).__webglTexture;l.framebufferTexture2D(l.DRAW_FRAMEBUFFER,l.COLOR_ATTACHMENT0,l.TEXTURE_2D,e,0)}l.blitFramebuffer(0,0,n,r,0,0,n,r,i,l.NEAREST),_===!0&&(Ae.length=0,je.length=0,Ae.push(l.COLOR_ATTACHMENT0+c),e.depthBuffer&&e.resolveDepthBuffer===!1&&(Ae.push(a),je.push(a),l.invalidateFramebuffer(l.DRAW_FRAMEBUFFER,je)),l.invalidateFramebuffer(l.READ_FRAMEBUFFER,Ae))}if(d.bindFramebuffer(l.READ_FRAMEBUFFER,null),d.bindFramebuffer(l.DRAW_FRAMEBUFFER,null),s)for(let e=0;e<t.length;e++){d.bindFramebuffer(l.FRAMEBUFFER,o.__webglMultisampledFramebuffer),l.framebufferRenderbuffer(l.FRAMEBUFFER,l.COLOR_ATTACHMENT0+e,l.RENDERBUFFER,o.__webglColorRenderbuffer[e]);let n=f.get(t[e]).__webglTexture;d.bindFramebuffer(l.FRAMEBUFFER,o.__webglFramebuffer),l.framebufferTexture2D(l.DRAW_FRAMEBUFFER,l.COLOR_ATTACHMENT0+e,l.TEXTURE_2D,n,0)}d.bindFramebuffer(l.DRAW_FRAMEBUFFER,o.__webglMultisampledFramebuffer)}else if(e.depthBuffer&&e.resolveDepthBuffer===!1&&_){let t=e.stencilBuffer?l.DEPTH_STENCIL_ATTACHMENT:l.DEPTH_ATTACHMENT;l.invalidateFramebuffer(l.DRAW_FRAMEBUFFER,[t])}}}function Ne(e){return Math.min(p.maxSamples,e.samples)}function Pe(e){let t=f.get(e);return e.samples>0&&u.has(`WEBGL_multisampled_render_to_texture`)===!0&&t.__useRenderToTexture!==!1}function P(e){let t=h.render.frame;y.get(e)!==t&&(y.set(e,t),e.update())}function Fe(e,t){let n=e.colorSpace,r=e.format,i=e.type;return e.isCompressedTexture===!0||e.isVideoTexture===!0||n!==`srgb-linear`&&n!==``&&(W.getTransfer(n)===`srgb`?(r!==1023||i!==1009)&&R(`WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.`):z(`WebGLTextures: Unsupported texture color space:`,n)),t}function Ie(e){return typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement?(v.width=e.naturalWidth||e.width,v.height=e.naturalHeight||e.height):typeof VideoFrame<`u`&&e instanceof VideoFrame?(v.width=e.displayWidth,v.height=e.displayHeight):(v.width=e.width,v.height=e.height),v}this.allocateTextureUnit=le,this.resetTextureUnits=oe,this.getTextureUnits=se,this.setTextureUnits=ce,this.setTexture2D=N,this.setTexture2DArray=de,this.setTexture3D=fe,this.setTextureCube=pe,this.rebindTextures=De,this.setupRenderTarget=Oe,this.updateRenderTargetMipmap=ke,this.updateMultisampleRenderTarget=Me,this.setupDepthRenderbuffer=Ee,this.setupFrameBufferTexture=Ce,this.useMultisampledRTT=Pe,this.isReversedDepthBuffer=function(){return d.buffers.depth.getReversed()}}function Hl(e,t){function n(n,r=``){let i,a=W.getTransfer(r);if(n===1009)return e.UNSIGNED_BYTE;if(n===1017)return e.UNSIGNED_SHORT_4_4_4_4;if(n===1018)return e.UNSIGNED_SHORT_5_5_5_1;if(n===35902)return e.UNSIGNED_INT_5_9_9_9_REV;if(n===35899)return e.UNSIGNED_INT_10F_11F_11F_REV;if(n===1010)return e.BYTE;if(n===1011)return e.SHORT;if(n===1012)return e.UNSIGNED_SHORT;if(n===1013)return e.INT;if(n===1014)return e.UNSIGNED_INT;if(n===1015)return e.FLOAT;if(n===1016)return e.HALF_FLOAT;if(n===1021)return e.ALPHA;if(n===1022)return e.RGB;if(n===1023)return e.RGBA;if(n===1026)return e.DEPTH_COMPONENT;if(n===1027)return e.DEPTH_STENCIL;if(n===1028)return e.RED;if(n===1029)return e.RED_INTEGER;if(n===1030)return e.RG;if(n===1031)return e.RG_INTEGER;if(n===1033)return e.RGBA_INTEGER;if(n===33776||n===33777||n===33778||n===33779){if(a===`srgb`){if(i=t.get(`WEBGL_compressed_texture_s3tc_srgb`),i!==null){if(n===33776)return i.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null}else if(i=t.get(`WEBGL_compressed_texture_s3tc`),i!==null){if(n===33776)return i.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null}if(n===35840||n===35841||n===35842||n===35843){if(i=t.get(`WEBGL_compressed_texture_pvrtc`),i!==null){if(n===35840)return i.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===35841)return i.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===35842)return i.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===35843)return i.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null}if(n===36196||n===37492||n===37496||n===37488||n===37489||n===37490||n===37491){if(i=t.get(`WEBGL_compressed_texture_etc`),i!==null){if(n===36196||n===37492)return a===`srgb`?i.COMPRESSED_SRGB8_ETC2:i.COMPRESSED_RGB8_ETC2;if(n===37496)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:i.COMPRESSED_RGBA8_ETC2_EAC;if(n===37488)return i.COMPRESSED_R11_EAC;if(n===37489)return i.COMPRESSED_SIGNED_R11_EAC;if(n===37490)return i.COMPRESSED_RG11_EAC;if(n===37491)return i.COMPRESSED_SIGNED_RG11_EAC}else return null}if(n===37808||n===37809||n===37810||n===37811||n===37812||n===37813||n===37814||n===37815||n===37816||n===37817||n===37818||n===37819||n===37820||n===37821){if(i=t.get(`WEBGL_compressed_texture_astc`),i!==null){if(n===37808)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:i.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===37809)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:i.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===37810)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:i.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===37811)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:i.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===37812)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:i.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===37813)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:i.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===37814)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:i.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===37815)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:i.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===37816)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:i.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===37817)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:i.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===37818)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:i.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===37819)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:i.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===37820)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:i.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===37821)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:i.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null}if(n===36492||n===36494||n===36495){if(i=t.get(`EXT_texture_compression_bptc`),i!==null){if(n===36492)return a===`srgb`?i.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:i.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===36494)return i.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===36495)return i.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null}if(n===36283||n===36284||n===36285||n===36286){if(i=t.get(`EXT_texture_compression_rgtc`),i!==null){if(n===36283)return i.COMPRESSED_RED_RGTC1_EXT;if(n===36284)return i.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===36285)return i.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===36286)return i.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null}return n===1020?e.UNSIGNED_INT_24_8:e[n]===void 0?null:e[n]}return{convert:n}}var Ul=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Wl=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,Gl=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new Pi(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new Ta({vertexShader:Ul,fragmentShader:Wl,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new K(new pa(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Kl=class extends tt{constructor(e,t){super();let n=this,r=null,i=1,a=null,o=`local-floor`,s=1,c=null,u=null,d=null,f=null,p=null,h=null,g=typeof XRWebGLBinding<`u`,_=new Gl,v={},b=t.getContextAttributes(),x=null,S=null,C=[],D=[],ee=new V,O=null,k=new uo;k.viewport=new Gt;let te=new uo;te.viewport=new Gt;let A=[k,te],j=new yo,ne=null,re=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(e){let t=C[e];return t===void 0&&(t=new Dn,C[e]=t),t.getTargetRaySpace()},this.getControllerGrip=function(e){let t=C[e];return t===void 0&&(t=new Dn,C[e]=t),t.getGripSpace()},this.getHand=function(e){let t=C[e];return t===void 0&&(t=new Dn,C[e]=t),t.getHandSpace()};function M(e){let t=D.indexOf(e.inputSource);if(t===-1)return;let n=C[t];n!==void 0&&(n.update(e.inputSource,e.frame,c||a),n.dispatchEvent({type:e.type,data:e.inputSource}))}function ie(){r.removeEventListener(`select`,M),r.removeEventListener(`selectstart`,M),r.removeEventListener(`selectend`,M),r.removeEventListener(`squeeze`,M),r.removeEventListener(`squeezestart`,M),r.removeEventListener(`squeezeend`,M),r.removeEventListener(`end`,ie),r.removeEventListener(`inputsourceschange`,ae);for(let e=0;e<C.length;e++){let t=D[e];t!==null&&(D[e]=null,C[e].disconnect(t))}ne=null,re=null,_.reset();for(let e in v)delete v[e];e.setRenderTarget(x),p=null,f=null,d=null,r=null,S=null,fe.stop(),n.isPresenting=!1,e.setPixelRatio(O),e.setSize(ee.width,ee.height,!1),n.dispatchEvent({type:`sessionend`})}this.setFramebufferScaleFactor=function(e){i=e,n.isPresenting===!0&&R(`WebXRManager: Cannot change framebuffer scale while presenting.`)},this.setReferenceSpaceType=function(e){o=e,n.isPresenting===!0&&R(`WebXRManager: Cannot change reference space type while presenting.`)},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(e){c=e},this.getBaseLayer=function(){return f===null?p:f},this.getBinding=function(){return d===null&&g&&(d=new XRWebGLBinding(r,t)),d},this.getFrame=function(){return h},this.getSession=function(){return r},this.setSession=async function(u){if(r=u,r!==null){if(x=e.getRenderTarget(),r.addEventListener(`select`,M),r.addEventListener(`selectstart`,M),r.addEventListener(`selectend`,M),r.addEventListener(`squeeze`,M),r.addEventListener(`squeezestart`,M),r.addEventListener(`squeezeend`,M),r.addEventListener(`end`,ie),r.addEventListener(`inputsourceschange`,ae),b.xrCompatible!==!0&&await t.makeXRCompatible(),O=e.getPixelRatio(),e.getSize(ee),g&&`createProjectionLayer`in XRWebGLBinding.prototype){let n=null,a=null,o=null;b.depth&&(o=b.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,n=b.stencil?E:T,a=b.stencil?y:m);let s={colorFormat:t.RGBA8,depthFormat:o,scaleFactor:i};d=this.getBinding(),f=d.createProjectionLayer(s),r.updateRenderState({layers:[f]}),e.setPixelRatio(1),e.setSize(f.textureWidth,f.textureHeight,!1),S=new qt(f.textureWidth,f.textureHeight,{format:w,type:l,depthTexture:new Mi(f.textureWidth,f.textureHeight,a,void 0,void 0,void 0,void 0,void 0,void 0,n),stencilBuffer:b.stencil,colorSpace:e.outputColorSpace,samples:b.antialias?4:0,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1})}else{let n={antialias:b.antialias,alpha:!0,depth:b.depth,stencil:b.stencil,framebufferScaleFactor:i};p=new XRWebGLLayer(r,t,n),r.updateRenderState({baseLayer:p}),e.setPixelRatio(1),e.setSize(p.framebufferWidth,p.framebufferHeight,!1),S=new qt(p.framebufferWidth,p.framebufferHeight,{format:w,type:l,colorSpace:e.outputColorSpace,stencilBuffer:b.stencil,resolveDepthBuffer:p.ignoreDepthValues===!1,resolveStencilBuffer:p.ignoreDepthValues===!1})}S.isXRRenderTarget=!0,this.setFoveation(s),c=null,a=await r.requestReferenceSpace(o),fe.setContext(r),fe.start(),n.isPresenting=!0,n.dispatchEvent({type:`sessionstart`})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return _.getDepthTexture()};function ae(e){for(let t=0;t<e.removed.length;t++){let n=e.removed[t],r=D.indexOf(n);r>=0&&(D[r]=null,C[r].disconnect(n))}for(let t=0;t<e.added.length;t++){let n=e.added[t],r=D.indexOf(n);if(r===-1){for(let e=0;e<C.length;e++)if(e>=D.length){D.push(n),r=e;break}else if(D[e]===null){D[e]=n,r=e;break}if(r===-1)break}let i=C[r];i&&i.connect(n)}}let oe=new H,se=new H;function ce(e,t,n){oe.setFromMatrixPosition(t.matrixWorld),se.setFromMatrixPosition(n.matrixWorld);let r=oe.distanceTo(se),i=t.projectionMatrix.elements,a=n.projectionMatrix.elements,o=i[14]/(i[10]-1),s=i[14]/(i[10]+1),c=(i[9]+1)/i[5],l=(i[9]-1)/i[5],u=(i[8]-1)/i[0],d=(a[8]+1)/a[0],f=o*u,p=o*d,m=r/(-u+d),h=m*-u;if(t.matrixWorld.decompose(e.position,e.quaternion,e.scale),e.translateX(h),e.translateZ(m),e.matrixWorld.compose(e.position,e.quaternion,e.scale),e.matrixWorldInverse.copy(e.matrixWorld).invert(),i[10]===-1)e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse);else{let t=o+m,n=s+m,i=f-h,a=p+(r-h),u=c*s/n*t,d=l*s/n*t;e.projectionMatrix.makePerspective(i,a,u,d,t,n),e.projectionMatrixInverse.copy(e.projectionMatrix).invert()}}function le(e,t){t===null?e.matrixWorld.copy(e.matrix):e.matrixWorld.multiplyMatrices(t.matrixWorld,e.matrix),e.matrixWorldInverse.copy(e.matrixWorld).invert()}this.updateCamera=function(e){if(r===null)return;let t=e.near,n=e.far;_.texture!==null&&(_.depthNear>0&&(t=_.depthNear),_.depthFar>0&&(n=_.depthFar)),j.near=te.near=k.near=t,j.far=te.far=k.far=n,(ne!==j.near||re!==j.far)&&(r.updateRenderState({depthNear:j.near,depthFar:j.far}),ne=j.near,re=j.far),j.layers.mask=e.layers.mask|6,k.layers.mask=j.layers.mask&-5,te.layers.mask=j.layers.mask&-3;let i=e.parent,a=j.cameras;le(j,i);for(let e=0;e<a.length;e++)le(a[e],i);a.length===2?ce(j,k,te):j.projectionMatrix.copy(k.projectionMatrix),ue(e,j,i)};function ue(e,t,n){n===null?e.matrix.copy(t.matrixWorld):(e.matrix.copy(n.matrixWorld),e.matrix.invert(),e.matrix.multiply(t.matrixWorld)),e.matrix.decompose(e.position,e.quaternion,e.scale),e.updateMatrixWorld(!0),e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse),e.isPerspectiveCamera&&(e.fov=at*2*Math.atan(1/e.projectionMatrix.elements[5]),e.zoom=1)}this.getCamera=function(){return j},this.getFoveation=function(){if(f!==null||p!==null)return s},this.setFoveation=function(e){s=e,f!==null&&(f.fixedFoveation=e),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=e)},this.hasDepthSensing=function(){return _.texture!==null},this.getDepthSensingMesh=function(){return _.getMesh(j)},this.getCameraTexture=function(e){return v[e]};let N=null;function de(t,i){if(u=i.getViewerPose(c||a),h=i,u!==null){let t=u.views;p!==null&&(e.setRenderTargetFramebuffer(S,p.framebuffer),e.setRenderTarget(S));let i=!1;t.length!==j.cameras.length&&(j.cameras.length=0,i=!0);for(let n=0;n<t.length;n++){let r=t[n],a=null;if(p!==null)a=p.getViewport(r);else{let t=d.getViewSubImage(f,r);a=t.viewport,n===0&&(e.setRenderTargetTextures(S,t.colorTexture,t.depthStencilTexture),e.setRenderTarget(S))}let o=A[n];o===void 0&&(o=new uo,o.layers.enable(n),o.viewport=new Gt,A[n]=o),o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.quaternion,o.scale),o.projectionMatrix.fromArray(r.projectionMatrix),o.projectionMatrixInverse.copy(o.projectionMatrix).invert(),o.viewport.set(a.x,a.y,a.width,a.height),n===0&&(j.matrix.copy(o.matrix),j.matrix.decompose(j.position,j.quaternion,j.scale)),i===!0&&j.cameras.push(o)}let a=r.enabledFeatures;if(a&&a.includes(`depth-sensing`)&&r.depthUsage==`gpu-optimized`&&g){d=n.getBinding();let e=d.getDepthInformation(t[0]);e&&e.isValid&&e.texture&&_.init(e,r.renderState)}if(a&&a.includes(`camera-access`)&&g){e.state.unbindTexture(),d=n.getBinding();for(let e=0;e<t.length;e++){let n=t[e].camera;if(n){let e=v[n];e||(e=new Pi,v[n]=e);let t=d.getCameraImage(n);e.sourceTexture=t}}}}for(let e=0;e<C.length;e++){let t=D[e],n=C[e];t!==null&&n!==void 0&&n.update(t,i,c||a)}N&&N(t,i),i.detectedPlanes&&n.dispatchEvent({type:`planesdetected`,data:i}),h=null}let fe=new zo;fe.setAnimationLoop(de),this.setAnimationLoop=function(e){N=e},this.dispose=function(){}}},ql=new Xt,Jl=new U;Jl.set(-1,0,0,0,1,0,0,0,1);function Yl(e,t){function n(e,t){e.matrixAutoUpdate===!0&&e.updateMatrix(),t.value.copy(e.matrix)}function r(t,n){n.color.getRGB(t.fogColor.value,xa(e)),n.isFog?(t.fogNear.value=n.near,t.fogFar.value=n.far):n.isFogExp2&&(t.fogDensity.value=n.density)}function i(e,t,n,r,i){t.isNodeMaterial?t.uniformsNeedUpdate=!1:t.isMeshBasicMaterial?a(e,t):t.isMeshLambertMaterial?(a(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshToonMaterial?(a(e,t),d(e,t)):t.isMeshPhongMaterial?(a(e,t),u(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshStandardMaterial?(a(e,t),f(e,t),t.isMeshPhysicalMaterial&&p(e,t,i)):t.isMeshMatcapMaterial?(a(e,t),m(e,t)):t.isMeshDepthMaterial?a(e,t):t.isMeshDistanceMaterial?(a(e,t),h(e,t)):t.isMeshNormalMaterial?a(e,t):t.isLineBasicMaterial?(o(e,t),t.isLineDashedMaterial&&s(e,t)):t.isPointsMaterial?c(e,t,n,r):t.isSpriteMaterial?l(e,t):t.isShadowMaterial?(e.color.value.copy(t.color),e.opacity.value=t.opacity):t.isShaderMaterial&&(t.uniformsNeedUpdate=!1)}function a(e,r){e.opacity.value=r.opacity,r.color&&e.diffuse.value.copy(r.color),r.emissive&&e.emissive.value.copy(r.emissive).multiplyScalar(r.emissiveIntensity),r.map&&(e.map.value=r.map,n(r.map,e.mapTransform)),r.alphaMap&&(e.alphaMap.value=r.alphaMap,n(r.alphaMap,e.alphaMapTransform)),r.bumpMap&&(e.bumpMap.value=r.bumpMap,n(r.bumpMap,e.bumpMapTransform),e.bumpScale.value=r.bumpScale,r.side===1&&(e.bumpScale.value*=-1)),r.normalMap&&(e.normalMap.value=r.normalMap,n(r.normalMap,e.normalMapTransform),e.normalScale.value.copy(r.normalScale),r.side===1&&e.normalScale.value.negate()),r.displacementMap&&(e.displacementMap.value=r.displacementMap,n(r.displacementMap,e.displacementMapTransform),e.displacementScale.value=r.displacementScale,e.displacementBias.value=r.displacementBias),r.emissiveMap&&(e.emissiveMap.value=r.emissiveMap,n(r.emissiveMap,e.emissiveMapTransform)),r.specularMap&&(e.specularMap.value=r.specularMap,n(r.specularMap,e.specularMapTransform)),r.alphaTest>0&&(e.alphaTest.value=r.alphaTest);let i=t.get(r),a=i.envMap,o=i.envMapRotation;a&&(e.envMap.value=a,e.envMapRotation.value.setFromMatrix4(ql.makeRotationFromEuler(o)).transpose(),a.isCubeTexture&&a.isRenderTargetTexture===!1&&e.envMapRotation.value.premultiply(Jl),e.reflectivity.value=r.reflectivity,e.ior.value=r.ior,e.refractionRatio.value=r.refractionRatio),r.lightMap&&(e.lightMap.value=r.lightMap,e.lightMapIntensity.value=r.lightMapIntensity,n(r.lightMap,e.lightMapTransform)),r.aoMap&&(e.aoMap.value=r.aoMap,e.aoMapIntensity.value=r.aoMapIntensity,n(r.aoMap,e.aoMapTransform))}function o(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform))}function s(e,t){e.dashSize.value=t.dashSize,e.totalSize.value=t.dashSize+t.gapSize,e.scale.value=t.scale}function c(e,t,r,i){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.size.value=t.size*r,e.scale.value=i*.5,t.map&&(e.map.value=t.map,n(t.map,e.uvTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function l(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.rotation.value=t.rotation,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function u(e,t){e.specular.value.copy(t.specular),e.shininess.value=Math.max(t.shininess,1e-4)}function d(e,t){t.gradientMap&&(e.gradientMap.value=t.gradientMap)}function f(e,t){e.metalness.value=t.metalness,t.metalnessMap&&(e.metalnessMap.value=t.metalnessMap,n(t.metalnessMap,e.metalnessMapTransform)),e.roughness.value=t.roughness,t.roughnessMap&&(e.roughnessMap.value=t.roughnessMap,n(t.roughnessMap,e.roughnessMapTransform)),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)}function p(e,t,r){e.ior.value=t.ior,t.sheen>0&&(e.sheenColor.value.copy(t.sheenColor).multiplyScalar(t.sheen),e.sheenRoughness.value=t.sheenRoughness,t.sheenColorMap&&(e.sheenColorMap.value=t.sheenColorMap,n(t.sheenColorMap,e.sheenColorMapTransform)),t.sheenRoughnessMap&&(e.sheenRoughnessMap.value=t.sheenRoughnessMap,n(t.sheenRoughnessMap,e.sheenRoughnessMapTransform))),t.clearcoat>0&&(e.clearcoat.value=t.clearcoat,e.clearcoatRoughness.value=t.clearcoatRoughness,t.clearcoatMap&&(e.clearcoatMap.value=t.clearcoatMap,n(t.clearcoatMap,e.clearcoatMapTransform)),t.clearcoatRoughnessMap&&(e.clearcoatRoughnessMap.value=t.clearcoatRoughnessMap,n(t.clearcoatRoughnessMap,e.clearcoatRoughnessMapTransform)),t.clearcoatNormalMap&&(e.clearcoatNormalMap.value=t.clearcoatNormalMap,n(t.clearcoatNormalMap,e.clearcoatNormalMapTransform),e.clearcoatNormalScale.value.copy(t.clearcoatNormalScale),t.side===1&&e.clearcoatNormalScale.value.negate())),t.dispersion>0&&(e.dispersion.value=t.dispersion),t.iridescence>0&&(e.iridescence.value=t.iridescence,e.iridescenceIOR.value=t.iridescenceIOR,e.iridescenceThicknessMinimum.value=t.iridescenceThicknessRange[0],e.iridescenceThicknessMaximum.value=t.iridescenceThicknessRange[1],t.iridescenceMap&&(e.iridescenceMap.value=t.iridescenceMap,n(t.iridescenceMap,e.iridescenceMapTransform)),t.iridescenceThicknessMap&&(e.iridescenceThicknessMap.value=t.iridescenceThicknessMap,n(t.iridescenceThicknessMap,e.iridescenceThicknessMapTransform))),t.transmission>0&&(e.transmission.value=t.transmission,e.transmissionSamplerMap.value=r.texture,e.transmissionSamplerSize.value.set(r.width,r.height),t.transmissionMap&&(e.transmissionMap.value=t.transmissionMap,n(t.transmissionMap,e.transmissionMapTransform)),e.thickness.value=t.thickness,t.thicknessMap&&(e.thicknessMap.value=t.thicknessMap,n(t.thicknessMap,e.thicknessMapTransform)),e.attenuationDistance.value=t.attenuationDistance,e.attenuationColor.value.copy(t.attenuationColor)),t.anisotropy>0&&(e.anisotropyVector.value.set(t.anisotropy*Math.cos(t.anisotropyRotation),t.anisotropy*Math.sin(t.anisotropyRotation)),t.anisotropyMap&&(e.anisotropyMap.value=t.anisotropyMap,n(t.anisotropyMap,e.anisotropyMapTransform))),e.specularIntensity.value=t.specularIntensity,e.specularColor.value.copy(t.specularColor),t.specularColorMap&&(e.specularColorMap.value=t.specularColorMap,n(t.specularColorMap,e.specularColorMapTransform)),t.specularIntensityMap&&(e.specularIntensityMap.value=t.specularIntensityMap,n(t.specularIntensityMap,e.specularIntensityMapTransform))}function m(e,t){t.matcap&&(e.matcap.value=t.matcap)}function h(e,n){let r=t.get(n).light;e.referencePosition.value.setFromMatrixPosition(r.matrixWorld),e.nearDistance.value=r.shadow.camera.near,e.farDistance.value=r.shadow.camera.far}return{refreshFogUniforms:r,refreshMaterialUniforms:i}}function Xl(e,t,n,r){let i={},a={},o=[],s=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function c(e,t){let n=t.program;r.uniformBlockBinding(e,n)}function l(e,n){let o=i[e.id];o===void 0&&(g(e),o=u(e),i[e.id]=o,e.addEventListener(`dispose`,v));let s=n.program;r.updateUBOMapping(e,s);let c=t.render.frame;a[e.id]!==c&&(f(e),a[e.id]=c)}function u(t){let n=d();t.__bindingPointIndex=n;let r=e.createBuffer(),i=t.__size,a=t.usage;return e.bindBuffer(e.UNIFORM_BUFFER,r),e.bufferData(e.UNIFORM_BUFFER,i,a),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,n,r),r}function d(){for(let e=0;e<s;e++)if(o.indexOf(e)===-1)return o.push(e),e;return z(`WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached.`),0}function f(t){let n=i[t.id],r=t.uniforms,a=t.__cache;e.bindBuffer(e.UNIFORM_BUFFER,n);for(let e=0,t=r.length;e<t;e++){let t=r[e];if(Array.isArray(t))for(let n=0,r=t.length;n<r;n++)p(t[n],e,n,a);else p(t,e,0,a)}e.bindBuffer(e.UNIFORM_BUFFER,null)}function p(t,n,r,i){if(h(t,n,r,i)===!0){let n=t.__offset,r=t.value;if(Array.isArray(r)){let e=0;for(let n=0;n<r.length;n++){let i=r[n],a=_(i);m(i,t.__data,e),typeof i!=`number`&&typeof i!=`boolean`&&!i.isMatrix3&&!ArrayBuffer.isView(i)&&(e+=a.storage/Float32Array.BYTES_PER_ELEMENT)}}else m(r,t.__data,0);e.bufferSubData(e.UNIFORM_BUFFER,n,t.__data)}}function m(e,t,n){typeof e==`number`||typeof e==`boolean`?t[0]=e:e.isMatrix3?(t[0]=e.elements[0],t[1]=e.elements[1],t[2]=e.elements[2],t[3]=0,t[4]=e.elements[3],t[5]=e.elements[4],t[6]=e.elements[5],t[7]=0,t[8]=e.elements[6],t[9]=e.elements[7],t[10]=e.elements[8],t[11]=0):ArrayBuffer.isView(e)?t.set(new e.constructor(e.buffer,e.byteOffset,t.length)):e.toArray(t,n)}function h(e,t,n,r){let i=e.value,a=t+`_`+n;if(r[a]===void 0)return r[a]=typeof i==`number`||typeof i==`boolean`?i:ArrayBuffer.isView(i)?i.slice():i.clone(),!0;{let e=r[a];if(typeof i==`number`||typeof i==`boolean`){if(e!==i)return r[a]=i,!0}else if(ArrayBuffer.isView(i))return!0;else if(e.equals(i)===!1)return e.copy(i),!0}return!1}function g(e){let t=e.uniforms,n=0;for(let e=0,r=t.length;e<r;e++){let r=Array.isArray(t[e])?t[e]:[t[e]];for(let e=0,t=r.length;e<t;e++){let t=r[e],i=Array.isArray(t.value)?t.value:[t.value];for(let e=0,r=i.length;e<r;e++){let r=i[e],a=_(r),o=n%16,s=o%a.boundary,c=o+s;n+=s,c!==0&&16-c<a.storage&&(n+=16-c),t.__data=new Float32Array(a.storage/Float32Array.BYTES_PER_ELEMENT),t.__offset=n,n+=a.storage}}}let r=n%16;return r>0&&(n+=16-r),e.__size=n,e.__cache={},this}function _(e){let t={boundary:0,storage:0};return typeof e==`number`||typeof e==`boolean`?(t.boundary=4,t.storage=4):e.isVector2?(t.boundary=8,t.storage=8):e.isVector3||e.isColor?(t.boundary=16,t.storage=12):e.isVector4?(t.boundary=16,t.storage=16):e.isMatrix3?(t.boundary=48,t.storage=48):e.isMatrix4?(t.boundary=64,t.storage=64):e.isTexture?R(`WebGLRenderer: Texture samplers can not be part of an uniforms group.`):ArrayBuffer.isView(e)?(t.boundary=16,t.storage=e.byteLength):R(`WebGLRenderer: Unsupported uniform value type.`,e),t}function v(t){let n=t.target;n.removeEventListener(`dispose`,v);let r=o.indexOf(n.__bindingPointIndex);o.splice(r,1),e.deleteBuffer(i[n.id]),delete i[n.id],delete a[n.id]}function y(){for(let t in i)e.deleteBuffer(i[t]);o=[],i={},a={}}return{bind:c,update:l,dispose:y}}var Zl=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Ql=null;function $l(){return Ql===null&&(Ql=new $r(Zl,16,16,O,g),Ql.name=`DFG_LUT`,Ql.minFilter=o,Ql.magFilter=o,Ql.wrapS=t,Ql.wrapT=t,Ql.generateMipmaps=!1,Ql.needsUpdate=!0),Ql}var eu=class{constructor(e={}){let{canvas:t=Je(),context:n=null,depth:r=!0,stencil:i=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:s=!0,preserveDrawingBuffer:u=!1,powerPreference:d=`default`,failIfMajorPerformanceCaveat:p=!1,reversedDepthBuffer:h=!1,outputBufferType:b=l}=e;this.isWebGLRenderer=!0;let x;if(n!==null){if(typeof WebGLRenderingContext<`u`&&n instanceof WebGLRenderingContext)throw Error(`THREE.WebGLRenderer: WebGL 1 is not supported since r163.`);x=n.getContextAttributes().alpha}else x=a;let S=b,C=new Set([te,k,ee]),w=new Set([l,m,f,y,_,v]),T=new Uint32Array(4),E=new Int32Array(4),D=new H,O=null,A=null,j=[],ne=[],re=null;this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=0,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let M=this,ie=!1,ae=null,oe=null,se=null,ce=null;this._outputColorSpace=ze;let le=0,ue=0,N=null,de=-1,fe=null,pe=new Gt,me=new Gt,he=null,ge=new G(0),_e=0,ve=t.width,ye=t.height,be=1,xe=null,Se=null,Ce=new Gt(0,0,ve,ye),we=new Gt(0,0,ve,ye),Te=!1,Ee=new gi,De=!1,Oe=!1,ke=new Xt,Ae=new H,je=new Gt,Me={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},Ne=!1;function Pe(){return N===null?be:1}let P=n;function Fe(e,n){return t.getContext(e,n)}try{let e={alpha:!0,depth:r,stencil:i,antialias:o,premultipliedAlpha:s,preserveDrawingBuffer:u,powerPreference:d,failIfMajorPerformanceCaveat:p};if(`setAttribute`in t&&t.setAttribute(`data-engine`,`three.js r185`),t.addEventListener(`webglcontextlost`,ct,!1),t.addEventListener(`webglcontextrestored`,lt,!1),t.addEventListener(`webglcontextcreationerror`,ut,!1),P===null){let t=`webgl2`;if(P=Fe(t,e),P===null)throw Fe(t)?Error(`THREE.WebGLRenderer: Error creating WebGL context with your selected attributes.`):Error(`THREE.WebGLRenderer: Error creating WebGL context.`)}}catch(e){throw z(`WebGLRenderer: `+e.message),e}let Ie,Le,F,Re,I,L,Be,Ve,He,Ue,Ge,Ke,qe,Ye,Ze,Qe,et,tt,nt,rt,it,at,ot;function B(){Ie=new vs(P),Ie.init(),it=new Hl(P,Ie),Le=new Jo(P,Ie,e,it),F=new Bl(P,Ie),Le.reversedDepthBuffer&&h&&F.buffers.depth.setReversed(!0),oe=P.createFramebuffer(),se=P.createFramebuffer(),ce=P.createFramebuffer(),Re=new xs(P),I=new bl,L=new Vl(P,Ie,F,I,Le,it,Re),Be=new _s(M),Ve=new Bo(P),at=new Ko(P,Ve),He=new ys(P,Ve,Re,at),Ue=new Cs(P,He,Ve,at,Re),tt=new Ss(P,Le,L),Ze=new Yo(I),Ge=new yl(M,Be,Ie,Le,at,Ze),Ke=new Yl(M,I),qe=new wl,Ye=new jl(Ie),et=new Go(M,Be,F,Ue,x,s),Qe=new zl(M,Ue,Le),ot=new Xl(P,Re,Le,F),nt=new qo(P,Ie,Re),rt=new bs(P,Ie,Re),Re.programs=Ge.programs,M.capabilities=Le,M.extensions=Ie,M.properties=I,M.renderLists=qe,M.shadowMap=Qe,M.state=F,M.info=Re}B(),S!==1009&&(re=new Ts(S,t.width,t.height,o,r,i));let st=new Kl(M,P);this.xr=st,this.getContext=function(){return P},this.getContextAttributes=function(){return P.getContextAttributes()},this.forceContextLoss=function(){let e=Ie.get(`WEBGL_lose_context`);e&&e.loseContext()},this.forceContextRestore=function(){let e=Ie.get(`WEBGL_lose_context`);e&&e.restoreContext()},this.getPixelRatio=function(){return be},this.setPixelRatio=function(e){e!==void 0&&(be=e,this.setSize(ve,ye,!1))},this.getSize=function(e){return e.set(ve,ye)},this.setSize=function(e,n,r=!0){if(st.isPresenting){R(`WebGLRenderer: Can't change size while VR device is presenting.`);return}ve=e,ye=n,t.width=Math.floor(e*be),t.height=Math.floor(n*be),r===!0&&(t.style.width=e+`px`,t.style.height=n+`px`),re!==null&&re.setSize(t.width,t.height),this.setViewport(0,0,e,n)},this.getDrawingBufferSize=function(e){return e.set(ve*be,ye*be).floor()},this.setDrawingBufferSize=function(e,n,r){ve=e,ye=n,be=r,t.width=Math.floor(e*r),t.height=Math.floor(n*r),this.setViewport(0,0,e,n)},this.setEffects=function(e){if(S===1009){z(`WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.`);return}if(e){for(let t=0;t<e.length;t++)if(e[t].isOutputPass===!0){R(`WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.`);break}}re.setEffects(e||[])},this.getCurrentViewport=function(e){return e.copy(pe)},this.getViewport=function(e){return e.copy(Ce)},this.setViewport=function(e,t,n,r){e.isVector4?Ce.set(e.x,e.y,e.z,e.w):Ce.set(e,t,n,r),F.viewport(pe.copy(Ce).multiplyScalar(be).round())},this.getScissor=function(e){return e.copy(we)},this.setScissor=function(e,t,n,r){e.isVector4?we.set(e.x,e.y,e.z,e.w):we.set(e,t,n,r),F.scissor(me.copy(we).multiplyScalar(be).round())},this.getScissorTest=function(){return Te},this.setScissorTest=function(e){F.setScissorTest(Te=e)},this.setOpaqueSort=function(e){xe=e},this.setTransparentSort=function(e){Se=e},this.getClearColor=function(e){return e.copy(et.getClearColor())},this.setClearColor=function(){et.setClearColor(...arguments)},this.getClearAlpha=function(){return et.getClearAlpha()},this.setClearAlpha=function(){et.setClearAlpha(...arguments)},this.clear=function(e=!0,t=!0,n=!0){let r=0;if(e){let e=!1;if(N!==null){let t=N.texture.format;e=C.has(t)}if(e){let e=N.texture.type,t=w.has(e),n=et.getClearColor(),r=et.getClearAlpha(),i=n.r,a=n.g,o=n.b;t?(T[0]=i,T[1]=a,T[2]=o,T[3]=r,P.clearBufferuiv(P.COLOR,0,T)):(E[0]=i,E[1]=a,E[2]=o,E[3]=r,P.clearBufferiv(P.COLOR,0,E))}else r|=P.COLOR_BUFFER_BIT}t&&(r|=P.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),n&&(r|=P.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),r!==0&&P.clear(r)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(e){e.setRenderer(this),ae=e},this.dispose=function(){t.removeEventListener(`webglcontextlost`,ct,!1),t.removeEventListener(`webglcontextrestored`,lt,!1),t.removeEventListener(`webglcontextcreationerror`,ut,!1),et.dispose(),qe.dispose(),Ye.dispose(),I.dispose(),Be.dispose(),Ue.dispose(),at.dispose(),ot.dispose(),Ge.dispose(),st.dispose(),st.removeEventListener(`sessionstart`,_t),st.removeEventListener(`sessionend`,vt),yt.stop()};function ct(e){e.preventDefault(),Xe(`WebGLRenderer: Context Lost.`),ie=!0}function lt(){Xe(`WebGLRenderer: Context Restored.`),ie=!1;let e=Re.autoReset,t=Qe.enabled,n=Qe.autoUpdate,r=Qe.needsUpdate,i=Qe.type;B(),Re.autoReset=e,Qe.enabled=t,Qe.autoUpdate=n,Qe.needsUpdate=r,Qe.type=i}function ut(e){z(`WebGLRenderer: A WebGL context could not be created. Reason: `,e.statusMessage)}function dt(e){let t=e.target;t.removeEventListener(`dispose`,dt),ft(t)}function ft(e){pt(e),I.remove(e)}function pt(e){let t=I.get(e).programs;t!==void 0&&(t.forEach(function(e){Ge.releaseProgram(e)}),e.isShaderMaterial&&Ge.releaseShaderCache(e))}this.renderBufferDirect=function(e,t,n,r,i,a){t===null&&(t=Me);let o=i.isMesh&&i.matrixWorld.determinantAffine()<0,s=Ot(e,t,n,r,i);F.setMaterial(r,o);let c=n.index,l=1;if(r.wireframe===!0){if(c=He.getWireframeAttribute(n),c===void 0)return;l=2}let u=n.drawRange,d=n.attributes.position,f=u.start*l,p=(u.start+u.count)*l;a!==null&&(f=Math.max(f,a.start*l),p=Math.min(p,(a.start+a.count)*l)),c===null?d!=null&&(f=Math.max(f,0),p=Math.min(p,d.count)):(f=Math.max(f,0),p=Math.min(p,c.count));let m=p-f;if(m<0||m===1/0)return;at.setup(i,r,s,n,c);let h,g=nt;if(c!==null&&(h=Ve.get(c),g=rt,g.setIndex(h)),i.isMesh)r.wireframe===!0?(F.setLineWidth(r.wireframeLinewidth*Pe()),g.setMode(P.LINES)):g.setMode(P.TRIANGLES);else if(i.isLine){let e=r.linewidth;e===void 0&&(e=1),F.setLineWidth(e*Pe()),i.isLineSegments?g.setMode(P.LINES):i.isLineLoop?g.setMode(P.LINE_LOOP):g.setMode(P.LINE_STRIP)}else i.isPoints?g.setMode(P.POINTS):i.isSprite&&g.setMode(P.TRIANGLES);if(i.isBatchedMesh){if(Ie.get(`WEBGL_multi_draw`))g.renderMultiDraw(i._multiDrawStarts,i._multiDrawCounts,i._multiDrawCount);else{let e=i._multiDrawStarts,t=i._multiDrawCounts,n=i._multiDrawCount,a=c?Ve.get(c).bytesPerElement:1,o=I.get(r).currentProgram.getUniforms();for(let r=0;r<n;r++)o.setValue(P,`_gl_DrawID`,r),g.render(e[r]/a,t[r])}}else if(i.isInstancedMesh)g.renderInstances(f,m,i.count);else if(n.isInstancedBufferGeometry){let e=n._maxInstanceCount===void 0?1/0:n._maxInstanceCount,t=Math.min(n.instanceCount,e);g.renderInstances(f,m,t)}else g.render(f,m)};function mt(e,t,n){e.transparent===!0&&e.side===2&&e.forceSinglePass===!1?(e.side=1,e.needsUpdate=!0,Tt(e,t,n),e.side=0,e.needsUpdate=!0,Tt(e,t,n),e.side=2):Tt(e,t,n)}this.compile=function(e,t,n=null){n===null&&(n=e),A=Ye.get(n),A.init(t),ne.push(A),n.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(A.pushLight(e),e.castShadow&&A.pushShadow(e))}),e!==n&&e.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(A.pushLight(e),e.castShadow&&A.pushShadow(e))}),A.setupLights();let r=new Set;return e.traverse(function(e){if(!(e.isMesh||e.isPoints||e.isLine||e.isSprite))return;let t=e.material;if(t){if(Array.isArray(t))for(let i=0;i<t.length;i++){let a=t[i];mt(a,n,e),r.add(a)}else mt(t,n,e),r.add(t)}}),A=ne.pop(),r},this.compileAsync=function(e,t,n=null){let r=this.compile(e,t,n);return new Promise(t=>{function n(){if(r.forEach(function(e){I.get(e).currentProgram.isReady()&&r.delete(e)}),r.size===0){t(e);return}setTimeout(n,10)}Ie.get(`KHR_parallel_shader_compile`)===null?setTimeout(n,10):n()})};let ht=null;function gt(e){ht&&ht(e)}function _t(){yt.stop()}function vt(){yt.start()}let yt=new zo;yt.setAnimationLoop(gt),typeof self<`u`&&yt.setContext(self),this.setAnimationLoop=function(e){ht=e,st.setAnimationLoop(e),e===null?yt.stop():yt.start()},st.addEventListener(`sessionstart`,_t),st.addEventListener(`sessionend`,vt),this.render=function(e,t){if(t!==void 0&&t.isCamera!==!0){z(`WebGLRenderer.render: camera is not an instance of THREE.Camera.`);return}if(ie===!0)return;ae!==null&&ae.renderStart(e,t);let n=st.enabled===!0&&st.isPresenting===!0,r=re!==null&&(N===null||n)&&re.begin(M,N);if(e.matrixWorldAutoUpdate===!0&&e.updateMatrixWorld(),t.parent===null&&t.matrixWorldAutoUpdate===!0&&t.updateMatrixWorld(),st.enabled===!0&&st.isPresenting===!0&&(re===null||re.isCompositing()===!1)&&(st.cameraAutoUpdate===!0&&st.updateCamera(t),t=st.getCamera()),e.isScene===!0&&e.onBeforeRender(M,e,t,N),A=Ye.get(e,ne.length),A.init(t),A.state.textureUnits=L.getTextureUnits(),ne.push(A),ke.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),Ee.setFromProjectionMatrix(ke,We,t.reversedDepth),Oe=this.localClippingEnabled,De=Ze.init(this.clippingPlanes,Oe),O=qe.get(e,j.length),O.init(),j.push(O),st.enabled===!0&&st.isPresenting===!0){let e=M.xr.getDepthSensingMesh();e!==null&&bt(e,t,-1/0,M.sortObjects)}bt(e,t,0,M.sortObjects),O.finish(),M.sortObjects===!0&&O.sort(xe,Se,t.reversedDepth),Ne=st.enabled===!1||st.isPresenting===!1||st.hasDepthSensing()===!1,Ne&&et.addToRenderList(O,e),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),De===!0&&Ze.beginShadows();let i=A.state.shadowsArray;if(Qe.render(i,e,t),De===!0&&Ze.endShadows(),(r&&re.hasRenderPass())===!1){let n=O.opaque,r=O.transmissive;if(A.setupLights(),t.isArrayCamera){let i=t.cameras;if(r.length>0)for(let t=0,a=i.length;t<a;t++){let a=i[t];St(n,r,e,a)}Ne&&et.render(e);for(let t=0,n=i.length;t<n;t++){let n=i[t];xt(O,e,n,n.viewport)}}else r.length>0&&St(n,r,e,t),Ne&&et.render(e),xt(O,e,t)}N!==null&&ue===0&&(L.updateMultisampleRenderTarget(N),L.updateRenderTargetMipmap(N)),r&&re.end(M),e.isScene===!0&&e.onAfterRender(M,e,t),at.resetDefaultState(),de=-1,fe=null,ne.pop(),ne.length>0?(A=ne[ne.length-1],L.setTextureUnits(A.state.textureUnits),De===!0&&Ze.setGlobalState(M.clippingPlanes,A.state.camera)):A=null,j.pop(),O=j.length>0?j[j.length-1]:null,ae!==null&&ae.renderEnd()};function bt(e,t,n,r){if(e.visible===!1)return;if(e.layers.test(t.layers)){if(e.isGroup)n=e.renderOrder;else if(e.isLOD)e.autoUpdate===!0&&e.update(t);else if(e.isLightProbeGrid)A.pushLightProbeGrid(e);else if(e.isLight)A.pushLight(e),e.castShadow&&A.pushShadow(e);else if(e.isSprite){if(!e.frustumCulled||Ee.intersectsSprite(e)){r&&je.setFromMatrixPosition(e.matrixWorld).applyMatrix4(ke);let t=Ue.update(e),i=e.material;i.visible&&O.push(e,t,i,n,je.z,null)}}else if((e.isMesh||e.isLine||e.isPoints)&&(!e.frustumCulled||Ee.intersectsObject(e))){let t=Ue.update(e),i=e.material;if(r&&(e.boundingSphere===void 0?(t.boundingSphere===null&&t.computeBoundingSphere(),je.copy(t.boundingSphere.center)):(e.boundingSphere===null&&e.computeBoundingSphere(),je.copy(e.boundingSphere.center)),je.applyMatrix4(e.matrixWorld).applyMatrix4(ke)),Array.isArray(i)){let r=t.groups;for(let a=0,o=r.length;a<o;a++){let o=r[a],s=i[o.materialIndex];s&&s.visible&&O.push(e,t,s,n,je.z,o)}}else i.visible&&O.push(e,t,i,n,je.z,null)}}let i=e.children;for(let e=0,a=i.length;e<a;e++)bt(i[e],t,n,r)}function xt(e,t,n,r){let{opaque:i,transmissive:a,transparent:o}=e;A.setupLightsView(n),De===!0&&Ze.setGlobalState(M.clippingPlanes,n),r&&F.viewport(pe.copy(r)),i.length>0&&Ct(i,t,n),a.length>0&&Ct(a,t,n),o.length>0&&Ct(o,t,n),F.buffers.depth.setTest(!0),F.buffers.depth.setMask(!0),F.buffers.color.setMask(!0),F.setPolygonOffset(!1)}function St(e,t,n,r){if((n.isScene===!0?n.overrideMaterial:null)!==null)return;if(A.state.transmissionRenderTarget[r.id]===void 0){let e=Ie.has(`EXT_color_buffer_half_float`)||Ie.has(`EXT_color_buffer_float`);A.state.transmissionRenderTarget[r.id]=new qt(1,1,{generateMipmaps:!0,type:e?g:l,minFilter:c,samples:Math.max(4,Le.samples),stencilBuffer:i,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:W.workingColorSpace})}let a=A.state.transmissionRenderTarget[r.id],o=r.viewport||pe;a.setSize(o.z*M.transmissionResolutionScale,o.w*M.transmissionResolutionScale);let s=M.getRenderTarget(),u=M.getActiveCubeFace(),d=M.getActiveMipmapLevel();M.setRenderTarget(a),M.getClearColor(ge),_e=M.getClearAlpha(),_e<1&&M.setClearColor(16777215,.5),M.clear(),Ne&&et.render(n);let f=M.toneMapping;M.toneMapping=0;let p=r.viewport;if(r.viewport!==void 0&&(r.viewport=void 0),A.setupLightsView(r),De===!0&&Ze.setGlobalState(M.clippingPlanes,r),Ct(e,n,r),L.updateMultisampleRenderTarget(a),L.updateRenderTargetMipmap(a),Ie.has(`WEBGL_multisampled_render_to_texture`)===!1){let e=!1;for(let i=0,a=t.length;i<a;i++){let{object:a,geometry:o,material:s,group:c}=t[i];if(s.side===2&&a.layers.test(r.layers)){let t=s.side;s.side=1,s.needsUpdate=!0,wt(a,n,r,o,s,c),s.side=t,s.needsUpdate=!0,e=!0}}e===!0&&(L.updateMultisampleRenderTarget(a),L.updateRenderTargetMipmap(a))}M.setRenderTarget(s,u,d),M.setClearColor(ge,_e),p!==void 0&&(r.viewport=p),M.toneMapping=f}function Ct(e,t,n){let r=t.isScene===!0?t.overrideMaterial:null;for(let i=0,a=e.length;i<a;i++){let a=e[i],{object:o,geometry:s,group:c}=a,l=a.material;l.allowOverride===!0&&r!==null&&(l=r),o.layers.test(n.layers)&&wt(o,t,n,s,l,c)}}function wt(e,t,n,r,i,a){e.onBeforeRender(M,t,n,r,i,a),e.modelViewMatrix.multiplyMatrices(n.matrixWorldInverse,e.matrixWorld),e.normalMatrix.getNormalMatrix(e.modelViewMatrix),i.onBeforeRender(M,t,n,r,e,a),i.transparent===!0&&i.side===2&&i.forceSinglePass===!1?(i.side=1,i.needsUpdate=!0,M.renderBufferDirect(n,t,r,i,e,a),i.side=0,i.needsUpdate=!0,M.renderBufferDirect(n,t,r,i,e,a),i.side=2):M.renderBufferDirect(n,t,r,i,e,a),e.onAfterRender(M,t,n,r,i,a)}function Tt(e,t,n){t.isScene!==!0&&(t=Me);let r=I.get(e),i=A.state.lights,a=A.state.shadowsArray,o=i.state.version,s=Ge.getParameters(e,i.state,a,t,n,A.state.lightProbeGridArray),c=Ge.getProgramCacheKey(s),l=r.programs;r.environment=e.isMeshStandardMaterial||e.isMeshLambertMaterial||e.isMeshPhongMaterial?t.environment:null,r.fog=t.fog;let u=e.isMeshStandardMaterial||e.isMeshLambertMaterial&&!e.envMap||e.isMeshPhongMaterial&&!e.envMap;r.envMap=Be.get(e.envMap||r.environment,u),r.envMapRotation=r.environment!==null&&e.envMap===null?t.environmentRotation:e.envMapRotation,l===void 0&&(e.addEventListener(`dispose`,dt),l=new Map,r.programs=l);let d=l.get(c);if(d!==void 0){if(r.currentProgram===d&&r.lightsStateVersion===o)return Dt(e,s),d}else s.uniforms=Ge.getUniforms(e),ae!==null&&e.isNodeMaterial&&ae.build(e,n,s),e.onBeforeCompile(s,M),d=Ge.acquireProgram(s,c),l.set(c,d),r.uniforms=s.uniforms;let f=r.uniforms;return(!e.isShaderMaterial&&!e.isRawShaderMaterial||e.clipping===!0)&&(f.clippingPlanes=Ze.uniform),Dt(e,s),r.needsLights=At(e),r.lightsStateVersion=o,r.needsLights&&(f.ambientLightColor.value=i.state.ambient,f.lightProbe.value=i.state.probe,f.directionalLights.value=i.state.directional,f.directionalLightShadows.value=i.state.directionalShadow,f.spotLights.value=i.state.spot,f.spotLightShadows.value=i.state.spotShadow,f.rectAreaLights.value=i.state.rectArea,f.ltc_1.value=i.state.rectAreaLTC1,f.ltc_2.value=i.state.rectAreaLTC2,f.pointLights.value=i.state.point,f.pointLightShadows.value=i.state.pointShadow,f.hemisphereLights.value=i.state.hemi,f.directionalShadowMatrix.value=i.state.directionalShadowMatrix,f.spotLightMatrix.value=i.state.spotLightMatrix,f.spotLightMap.value=i.state.spotLightMap,f.pointShadowMatrix.value=i.state.pointShadowMatrix),r.lightProbeGrid=A.state.lightProbeGridArray.length>0,r.currentProgram=d,r.uniformsList=null,d}function Et(e){if(e.uniformsList===null){let t=e.currentProgram.getUniforms();e.uniformsList=Mc.seqWithValue(t.seq,e.uniforms)}return e.uniformsList}function Dt(e,t){let n=I.get(e);n.outputColorSpace=t.outputColorSpace,n.batching=t.batching,n.batchingColor=t.batchingColor,n.instancing=t.instancing,n.instancingColor=t.instancingColor,n.instancingMorph=t.instancingMorph,n.skinning=t.skinning,n.morphTargets=t.morphTargets,n.morphNormals=t.morphNormals,n.morphColors=t.morphColors,n.morphTargetsCount=t.morphTargetsCount,n.numClippingPlanes=t.numClippingPlanes,n.numIntersection=t.numClipIntersection,n.vertexAlphas=t.vertexAlphas,n.vertexTangents=t.vertexTangents,n.toneMapping=t.toneMapping}function V(e,t){if(e.length===0)return null;if(e.length===1)return e[0].texture===null?null:e[0];D.setFromMatrixPosition(t.matrixWorld);for(let t=0,n=e.length;t<n;t++){let n=e[t];if(n.texture!==null&&n.boundingBox.containsPoint(D))return n}return null}function Ot(e,t,n,r,i){t.isScene!==!0&&(t=Me),L.resetTextureUnits();let a=t.fog,o=r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial?t.environment:null,s=N===null?M.outputColorSpace:N.isXRRenderTarget===!0?N.texture.colorSpace:W.workingColorSpace,c=r.isMeshStandardMaterial||r.isMeshLambertMaterial&&!r.envMap||r.isMeshPhongMaterial&&!r.envMap,l=Be.get(r.envMap||o,c),u=r.vertexColors===!0&&!!n.attributes.color&&n.attributes.color.itemSize===4,d=!!n.attributes.tangent&&(!!r.normalMap||r.anisotropy>0),f=!!n.morphAttributes.position,p=!!n.morphAttributes.normal,m=!!n.morphAttributes.color,h=0;r.toneMapped&&(N===null||N.isXRRenderTarget===!0)&&(h=M.toneMapping);let g=n.morphAttributes.position||n.morphAttributes.normal||n.morphAttributes.color,_=g===void 0?0:g.length,v=I.get(r),y=A.state.lights;if(De===!0&&(Oe===!0||e!==fe)){let t=e===fe&&r.id===de;Ze.setState(r,e,t)}let b=!1;r.version===v.__version?v.needsLights&&v.lightsStateVersion!==y.state.version?b=!0:v.outputColorSpace===s?i.isBatchedMesh&&v.batching===!1||!i.isBatchedMesh&&v.batching===!0||i.isBatchedMesh&&v.batchingColor===!0&&i.colorTexture===null||i.isBatchedMesh&&v.batchingColor===!1&&i.colorTexture!==null||i.isInstancedMesh&&v.instancing===!1||!i.isInstancedMesh&&v.instancing===!0||i.isSkinnedMesh&&v.skinning===!1||!i.isSkinnedMesh&&v.skinning===!0||i.isInstancedMesh&&v.instancingColor===!0&&i.instanceColor===null||i.isInstancedMesh&&v.instancingColor===!1&&i.instanceColor!==null||i.isInstancedMesh&&v.instancingMorph===!0&&i.morphTexture===null||i.isInstancedMesh&&v.instancingMorph===!1&&i.morphTexture!==null?b=!0:v.envMap===l?r.fog===!0&&v.fog!==a||v.numClippingPlanes!==void 0&&(v.numClippingPlanes!==Ze.numPlanes||v.numIntersection!==Ze.numIntersection)?b=!0:v.vertexAlphas===u&&v.vertexTangents===d&&v.morphTargets===f&&v.morphNormals===p&&v.morphColors===m&&v.toneMapping===h&&v.morphTargetsCount===_?!!v.lightProbeGrid!=A.state.lightProbeGridArray.length>0&&(b=!0):b=!0:b=!0:b=!0:(b=!0,v.__version=r.version);let x=v.currentProgram;b===!0&&(x=Tt(r,t,i),ae&&r.isNodeMaterial&&ae.onUpdateProgram(r,x,v));let S=!1,C=!1,w=!1,T=x.getUniforms(),E=v.uniforms;if(F.useProgram(x.program)&&(S=!0,C=!0,w=!0),r.id!==de&&(de=r.id,C=!0),v.needsLights){let e=V(A.state.lightProbeGridArray,i);v.lightProbeGrid!==e&&(v.lightProbeGrid=e,C=!0)}if(S||fe!==e){F.buffers.depth.getReversed()&&e.reversedDepth!==!0&&(e._reversedDepth=!0,e.updateProjectionMatrix()),T.setValue(P,`projectionMatrix`,e.projectionMatrix),T.setValue(P,`viewMatrix`,e.matrixWorldInverse);let t=T.map.cameraPosition;t!==void 0&&t.setValue(P,Ae.setFromMatrixPosition(e.matrixWorld)),Le.logarithmicDepthBuffer&&T.setValue(P,`logDepthBufFC`,2/(Math.log(e.far+1)/Math.LN2)),(r.isMeshPhongMaterial||r.isMeshToonMaterial||r.isMeshLambertMaterial||r.isMeshBasicMaterial||r.isMeshStandardMaterial||r.isShaderMaterial)&&T.setValue(P,`isOrthographic`,e.isOrthographicCamera===!0),fe!==e&&(fe=e,C=!0,w=!0)}if(v.needsLights&&(y.state.directionalShadowMap.length>0&&T.setValue(P,`directionalShadowMap`,y.state.directionalShadowMap,L),y.state.spotShadowMap.length>0&&T.setValue(P,`spotShadowMap`,y.state.spotShadowMap,L),y.state.pointShadowMap.length>0&&T.setValue(P,`pointShadowMap`,y.state.pointShadowMap,L)),i.isSkinnedMesh){T.setOptional(P,i,`bindMatrix`),T.setOptional(P,i,`bindMatrixInverse`);let e=i.skeleton;e&&(e.boneTexture===null&&e.computeBoneTexture(),T.setValue(P,`boneTexture`,e.boneTexture,L))}i.isBatchedMesh&&(T.setOptional(P,i,`batchingTexture`),T.setValue(P,`batchingTexture`,i._matricesTexture,L),T.setOptional(P,i,`batchingIdTexture`),T.setValue(P,`batchingIdTexture`,i._indirectTexture,L),T.setOptional(P,i,`batchingColorTexture`),i._colorsTexture!==null&&T.setValue(P,`batchingColorTexture`,i._colorsTexture,L));let D=n.morphAttributes;if((D.position!==void 0||D.normal!==void 0||D.color!==void 0)&&tt.update(i,n,x),(C||v.receiveShadow!==i.receiveShadow)&&(v.receiveShadow=i.receiveShadow,T.setValue(P,`receiveShadow`,i.receiveShadow)),(r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial)&&r.envMap===null&&t.environment!==null&&(E.envMapIntensity.value=t.environmentIntensity),E.dfgLUT!==void 0&&(E.dfgLUT.value=$l()),C){if(T.setValue(P,`toneMappingExposure`,M.toneMappingExposure),v.needsLights&&kt(E,w),a&&r.fog===!0&&Ke.refreshFogUniforms(E,a),Ke.refreshMaterialUniforms(E,r,be,ye,A.state.transmissionRenderTarget[e.id]),v.needsLights&&v.lightProbeGrid){let e=v.lightProbeGrid;E.probesSH.value=e.texture,E.probesMin.value.copy(e.boundingBox.min),E.probesMax.value.copy(e.boundingBox.max),E.probesResolution.value.copy(e.resolution)}Mc.upload(P,Et(v),E,L)}if(r.isShaderMaterial&&r.uniformsNeedUpdate===!0&&(Mc.upload(P,Et(v),E,L),r.uniformsNeedUpdate=!1),r.isSpriteMaterial&&T.setValue(P,`center`,i.center),T.setValue(P,`modelViewMatrix`,i.modelViewMatrix),T.setValue(P,`normalMatrix`,i.normalMatrix),T.setValue(P,`modelMatrix`,i.matrixWorld),r.uniformsGroups!==void 0){let e=r.uniformsGroups;for(let t=0,n=e.length;t<n;t++){let n=e[t];ot.update(n,x),ot.bind(n,x)}}return x}function kt(e,t){e.ambientLightColor.needsUpdate=t,e.lightProbe.needsUpdate=t,e.directionalLights.needsUpdate=t,e.directionalLightShadows.needsUpdate=t,e.pointLights.needsUpdate=t,e.pointLightShadows.needsUpdate=t,e.spotLights.needsUpdate=t,e.spotLightShadows.needsUpdate=t,e.rectAreaLights.needsUpdate=t,e.hemisphereLights.needsUpdate=t}function At(e){return e.isMeshLambertMaterial||e.isMeshToonMaterial||e.isMeshPhongMaterial||e.isMeshStandardMaterial||e.isShadowMaterial||e.isShaderMaterial&&e.lights===!0}this.getActiveCubeFace=function(){return le},this.getActiveMipmapLevel=function(){return ue},this.getRenderTarget=function(){return N},this.setRenderTargetTextures=function(e,t,n){let r=I.get(e);r.__autoAllocateDepthBuffer=e.resolveDepthBuffer===!1,r.__autoAllocateDepthBuffer===!1&&(r.__useRenderToTexture=!1),I.get(e.texture).__webglTexture=t,I.get(e.depthTexture).__webglTexture=r.__autoAllocateDepthBuffer?void 0:n,r.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(e,t){let n=I.get(e);n.__webglFramebuffer=t,n.__useDefaultFramebuffer=t===void 0},this.setRenderTarget=function(e,t=0,n=0){N=e,le=t,ue=n;let r=null,i=!1,a=!1;if(e){let o=I.get(e);if(o.__useDefaultFramebuffer!==void 0){F.bindFramebuffer(P.FRAMEBUFFER,o.__webglFramebuffer),pe.copy(e.viewport),me.copy(e.scissor),he=e.scissorTest,F.viewport(pe),F.scissor(me),F.setScissorTest(he),de=-1;return}if(o.__webglFramebuffer===void 0)L.setupRenderTarget(e);else if(o.__hasExternalTextures)L.rebindTextures(e,I.get(e.texture).__webglTexture,I.get(e.depthTexture).__webglTexture);else if(e.depthBuffer){let t=e.depthTexture;if(o.__boundDepthTexture!==t){if(t!==null&&I.has(t)&&(e.width!==t.image.width||e.height!==t.image.height))throw Error(`THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.`);L.setupDepthRenderbuffer(e)}}let s=e.texture;(s.isData3DTexture||s.isDataArrayTexture||s.isCompressedArrayTexture)&&(a=!0);let c=I.get(e).__webglFramebuffer;e.isWebGLCubeRenderTarget?(r=Array.isArray(c[t])?c[t][n]:c[t],i=!0):r=e.samples>0&&L.useMultisampledRTT(e)===!1?I.get(e).__webglMultisampledFramebuffer:Array.isArray(c)?c[n]:c,pe.copy(e.viewport),me.copy(e.scissor),he=e.scissorTest}else pe.copy(Ce).multiplyScalar(be).floor(),me.copy(we).multiplyScalar(be).floor(),he=Te;if(n!==0&&(r=oe),F.bindFramebuffer(P.FRAMEBUFFER,r)&&F.drawBuffers(e,r),F.viewport(pe),F.scissor(me),F.setScissorTest(he),i){let r=I.get(e.texture);P.framebufferTexture2D(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_CUBE_MAP_POSITIVE_X+t,r.__webglTexture,n)}else if(a){let r=t;for(let t=0;t<e.textures.length;t++){let i=I.get(e.textures[t]);P.framebufferTextureLayer(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0+t,i.__webglTexture,n,r)}}else if(e!==null&&n!==0){let t=I.get(e.texture);P.framebufferTexture2D(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_2D,t.__webglTexture,n)}de=-1},this.readRenderTargetPixels=function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget)){z(`WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);return}let c=I.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o]),c){F.bindFramebuffer(P.FRAMEBUFFER,c);try{let o=e.textures[s],c=o.format,l=o.type;if(e.textures.length>1&&P.readBuffer(P.COLOR_ATTACHMENT0+s),!Le.textureFormatReadable(c)){z(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.`);return}if(!Le.textureTypeReadable(l)){z(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.`);return}t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i&&P.readPixels(t,n,r,i,it.convert(c),it.convert(l),a)}finally{let e=N===null?null:I.get(N).__webglFramebuffer;F.bindFramebuffer(P.FRAMEBUFFER,e)}}},this.readRenderTargetPixelsAsync=async function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget))throw Error(`THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);let c=I.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o]),c){if(t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i){F.bindFramebuffer(P.FRAMEBUFFER,c);let o=e.textures[s],l=o.format,u=o.type;if(e.textures.length>1&&P.readBuffer(P.COLOR_ATTACHMENT0+s),!Le.textureFormatReadable(l))throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.`);if(!Le.textureTypeReadable(u))throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.`);let d=P.createBuffer();P.bindBuffer(P.PIXEL_PACK_BUFFER,d),P.bufferData(P.PIXEL_PACK_BUFFER,a.byteLength,P.STREAM_READ),P.readPixels(t,n,r,i,it.convert(l),it.convert(u),0);let f=N===null?null:I.get(N).__webglFramebuffer;F.bindFramebuffer(P.FRAMEBUFFER,f);let p=P.fenceSync(P.SYNC_GPU_COMMANDS_COMPLETE,0);return P.flush(),await $e(P,p,4),P.bindBuffer(P.PIXEL_PACK_BUFFER,d),P.getBufferSubData(P.PIXEL_PACK_BUFFER,0,a),P.deleteBuffer(d),P.deleteSync(p),a}throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.`)}},this.copyFramebufferToTexture=function(e,t=null,n=0){let r=2**-n,i=Math.floor(e.image.width*r),a=Math.floor(e.image.height*r),o=t===null?0:t.x,s=t===null?0:t.y;L.setTexture2D(e,0),P.copyTexSubImage2D(P.TEXTURE_2D,n,0,0,o,s,i,a),F.unbindTexture()},this.copyTextureToTexture=function(e,t,n=null,r=null,i=0,a=0){let o,s,c,l,u,d,f,p,m,h=e.isCompressedTexture?e.mipmaps[a]:e.image;if(n!==null)o=n.max.x-n.min.x,s=n.max.y-n.min.y,c=n.isBox3?n.max.z-n.min.z:1,l=n.min.x,u=n.min.y,d=n.isBox3?n.min.z:0;else{let t=2**-i;o=Math.floor(h.width*t),s=Math.floor(h.height*t),c=e.isDataArrayTexture?h.depth:e.isData3DTexture?Math.floor(h.depth*t):1,l=0,u=0,d=0}r===null?(f=0,p=0,m=0):(f=r.x,p=r.y,m=r.z);let g=it.convert(t.format),_=it.convert(t.type),v;t.isData3DTexture?(L.setTexture3D(t,0),v=P.TEXTURE_3D):t.isDataArrayTexture||t.isCompressedArrayTexture?(L.setTexture2DArray(t,0),v=P.TEXTURE_2D_ARRAY):(L.setTexture2D(t,0),v=P.TEXTURE_2D),F.activeTexture(P.TEXTURE0),F.pixelStorei(P.UNPACK_FLIP_Y_WEBGL,t.flipY),F.pixelStorei(P.UNPACK_PREMULTIPLY_ALPHA_WEBGL,t.premultiplyAlpha),F.pixelStorei(P.UNPACK_ALIGNMENT,t.unpackAlignment);let y=F.getParameter(P.UNPACK_ROW_LENGTH),b=F.getParameter(P.UNPACK_IMAGE_HEIGHT),x=F.getParameter(P.UNPACK_SKIP_PIXELS),S=F.getParameter(P.UNPACK_SKIP_ROWS),C=F.getParameter(P.UNPACK_SKIP_IMAGES);F.pixelStorei(P.UNPACK_ROW_LENGTH,h.width),F.pixelStorei(P.UNPACK_IMAGE_HEIGHT,h.height),F.pixelStorei(P.UNPACK_SKIP_PIXELS,l),F.pixelStorei(P.UNPACK_SKIP_ROWS,u),F.pixelStorei(P.UNPACK_SKIP_IMAGES,d);let w=e.isDataArrayTexture||e.isData3DTexture,T=t.isDataArrayTexture||t.isData3DTexture;if(e.isDepthTexture){let n=I.get(e),r=I.get(t),h=I.get(n.__renderTarget),g=I.get(r.__renderTarget);F.bindFramebuffer(P.READ_FRAMEBUFFER,h.__webglFramebuffer),F.bindFramebuffer(P.DRAW_FRAMEBUFFER,g.__webglFramebuffer);for(let n=0;n<c;n++)w&&(P.framebufferTextureLayer(P.READ_FRAMEBUFFER,P.COLOR_ATTACHMENT0,I.get(e).__webglTexture,i,d+n),P.framebufferTextureLayer(P.DRAW_FRAMEBUFFER,P.COLOR_ATTACHMENT0,I.get(t).__webglTexture,a,m+n)),P.blitFramebuffer(l,u,o,s,f,p,o,s,P.DEPTH_BUFFER_BIT,P.NEAREST);F.bindFramebuffer(P.READ_FRAMEBUFFER,null),F.bindFramebuffer(P.DRAW_FRAMEBUFFER,null)}else if(i!==0||e.isRenderTargetTexture||I.has(e)){let n=I.get(e),r=I.get(t);F.bindFramebuffer(P.READ_FRAMEBUFFER,se),F.bindFramebuffer(P.DRAW_FRAMEBUFFER,ce);for(let e=0;e<c;e++)w?P.framebufferTextureLayer(P.READ_FRAMEBUFFER,P.COLOR_ATTACHMENT0,n.__webglTexture,i,d+e):P.framebufferTexture2D(P.READ_FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_2D,n.__webglTexture,i),T?P.framebufferTextureLayer(P.DRAW_FRAMEBUFFER,P.COLOR_ATTACHMENT0,r.__webglTexture,a,m+e):P.framebufferTexture2D(P.DRAW_FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_2D,r.__webglTexture,a),i===0?T?P.copyTexSubImage3D(v,a,f,p,m+e,l,u,o,s):P.copyTexSubImage2D(v,a,f,p,l,u,o,s):P.blitFramebuffer(l,u,o,s,f,p,o,s,P.COLOR_BUFFER_BIT,P.NEAREST);F.bindFramebuffer(P.READ_FRAMEBUFFER,null),F.bindFramebuffer(P.DRAW_FRAMEBUFFER,null)}else T?e.isDataTexture||e.isData3DTexture?P.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h.data):t.isCompressedArrayTexture?P.compressedTexSubImage3D(v,a,f,p,m,o,s,c,g,h.data):P.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h):e.isDataTexture?P.texSubImage2D(P.TEXTURE_2D,a,f,p,o,s,g,_,h.data):e.isCompressedTexture?P.compressedTexSubImage2D(P.TEXTURE_2D,a,f,p,h.width,h.height,g,h.data):P.texSubImage2D(P.TEXTURE_2D,a,f,p,o,s,g,_,h);F.pixelStorei(P.UNPACK_ROW_LENGTH,y),F.pixelStorei(P.UNPACK_IMAGE_HEIGHT,b),F.pixelStorei(P.UNPACK_SKIP_PIXELS,x),F.pixelStorei(P.UNPACK_SKIP_ROWS,S),F.pixelStorei(P.UNPACK_SKIP_IMAGES,C),a===0&&t.generateMipmaps&&P.generateMipmap(v),F.unbindTexture()},this.initRenderTarget=function(e){I.get(e).__webglFramebuffer===void 0&&L.setupRenderTarget(e)},this.initTexture=function(e){e.isCubeTexture?L.setTextureCube(e,0):e.isData3DTexture?L.setTexture3D(e,0):e.isDataArrayTexture||e.isCompressedArrayTexture?L.setTexture2DArray(e,0):L.setTexture2D(e,0),F.unbindTexture()},this.resetState=function(){le=0,ue=0,N=null,F.reset(),at.reset()},typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}get coordinateSystem(){return We}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=W._getDrawingBufferColorSpace(e),t.unpackColorSpace=W._getUnpackColorSpace()}},tu=[{kind:`burger-kiosk`,name:`Copper Bun Kitchen`,shortName:`Burgers`,category:`food`,icon:`burger`,description:`Hot food with a two-person service counter. Guests leave with wrappers.`,cost:720,upkeep:7,footprint:[5,4],serviceNeed:`hunger`,capacity:2,serviceSeconds:5.8,revenue:34,appeal:8},{kind:`lemonade-stand`,name:`Citrus Press`,shortName:`Drinks`,category:`food`,icon:`cup`,description:`A compact cold-drink counter with quick service and recyclable cups.`,cost:460,upkeep:4,footprint:[3,3],serviceNeed:`hunger`,capacity:1,serviceSeconds:3.4,revenue:19,appeal:5},{kind:`ice-cream-cart`,name:`Moon Scoop Creamery`,shortName:`Ice Cream`,category:`food`,icon:`ice-cream`,description:`A chilled service cart for quick treats. Guests leave with compostable cups.`,cost:620,upkeep:6,footprint:[3,3],serviceNeed:`hunger`,capacity:1,serviceSeconds:4.2,revenue:25,appeal:7},{kind:`pizza-kitchen`,name:`Ember Stone Pizzeria`,shortName:`Pizzeria`,category:`food`,icon:`pizza`,description:`A wood-fired stone oven and a sit-down terrace. Slow to serve, and the highest ticket in the park.`,cost:1450,upkeep:14,footprint:[6,5],serviceNeed:`hunger`,capacity:3,serviceSeconds:8.5,revenue:52,appeal:16},{kind:`carousel`,name:`Constellation Carousel`,shortName:`Carousel`,category:`rides`,icon:`carousel`,description:`A luminous family ride with twelve places and strong park appeal.`,cost:1850,upkeep:18,footprint:[9,9],serviceNeed:`fun`,capacity:6,serviceSeconds:12,revenue:24,appeal:24},{kind:`sky-wheel`,name:`Aurora Sky Wheel`,shortName:`Sky Wheel`,category:`rides`,icon:`wheel`,description:`A landmark observation wheel with braced steelwork and eight gondolas.`,cost:3200,upkeep:32,footprint:[12,7],serviceNeed:`fun`,capacity:8,serviceSeconds:18,revenue:32,appeal:42},{kind:`bumper-cars`,name:`Voltage Bumper Hall`,shortName:`Bumper Cars`,category:`rides`,icon:`bumper-car`,description:`An eight-car electric pavilion with a conductive ceiling grid and impact rails.`,cost:2450,upkeep:25,footprint:[11,9],serviceNeed:`fun`,capacity:8,serviceSeconds:14,revenue:27,appeal:32},{kind:`drop-tower`,name:`Pulse Drop Tower`,shortName:`Drop Tower`,category:`rides`,icon:`drop-tower`,description:`A 13-metre lattice tower with a guided carriage, redundant brakes, and beacon crown.`,cost:3950,upkeep:44,footprint:[8,8],serviceNeed:`fun`,capacity:8,serviceSeconds:20,revenue:35,appeal:52},{kind:`pirate-ship`,name:`Copper Corsair`,shortName:`Pirate Ship`,category:`rides`,icon:`pirate-ship`,description:`A swinging ten-seat vessel on braced A-frames with a flywheel drive and air brakes.`,cost:3350,upkeep:36,footprint:[12,8],serviceNeed:`fun`,capacity:10,serviceSeconds:18,revenue:31,appeal:45},{kind:`mini-railway`,name:`Willow Line Railway`,shortName:`Railway`,category:`rides`,icon:`train`,description:`A narrow-gauge circuit with a live-steam locomotive and two open carriages. Gentle, and it carries a crowd.`,cost:1150,upkeep:11,footprint:[12,10],serviceNeed:`fun`,capacity:12,serviceSeconds:26,revenue:20,appeal:15},{kind:`meteor-coaster`,name:`Meteor Chase`,shortName:`Coaster`,category:`rides`,icon:`coaster`,description:`A chain-lift steel circuit with a banked helix and a magnetic brake run. The ride a park is known for.`,cost:5600,upkeep:62,footprint:[16,14],serviceNeed:`fun`,capacity:8,serviceSeconds:22,revenue:46,appeal:74},{kind:`restroom`,name:`Park Comfort Station`,shortName:`Restroom`,category:`facilities`,icon:`restroom`,description:`A ventilated, accessible comfort station that protects guest happiness.`,cost:880,upkeep:11,footprint:[6,4],serviceNeed:`bladder`,capacity:4,serviceSeconds:5.2,revenue:0,appeal:3},{kind:`first-aid`,name:`Pulse Point First Aid`,shortName:`First Aid`,category:`facilities`,icon:`first-aid`,description:`A staffed accessible clinic where tired guests can recover before returning to the park.`,cost:940,upkeep:12,footprint:[5,4],serviceNeed:`rest`,capacity:2,serviceSeconds:6.5,revenue:0,appeal:5},{kind:`information-booth`,name:`Park Pathfinder`,shortName:`Information`,category:`facilities`,icon:`information`,description:`Maps, accessibility guidance, and attraction tips from a compact two-window booth.`,cost:520,upkeep:5,footprint:[4,3],serviceNeed:`information`,capacity:2,serviceSeconds:3.2,revenue:0,appeal:8},{kind:`cash-machine`,name:`Ledger Point Cash Machine`,shortName:`Cash Machine`,category:`facilities`,icon:`cash-machine`,description:`A hooded, anchored cash machine. Charges a small withdrawal fee and keeps guests spending.`,cost:340,upkeep:4,footprint:[2,2],serviceNeed:`cash`,capacity:1,serviceSeconds:4.2,revenue:3,appeal:2},{kind:`maintenance-hut`,name:`Warden Yard Crew Post`,shortName:`Cleaning Crew`,category:`facilities`,icon:`broom`,description:`A crew hut with lockers, a tool rack, and a barrow. Employs one janitor, who walks the park picking up litter wherever it falls.`,cost:620,upkeep:22,footprint:[4,3],serviceNeed:null,capacity:0,serviceSeconds:0,revenue:0,appeal:2,staff:`janitor`},{kind:`trash-bin`,name:`Sorting Bin`,shortName:`Bin`,category:`facilities`,icon:`bin`,description:`Captures nearby guest trash. Place one beside every food or ride exit.`,cost:85,upkeep:1,footprint:[1,1],serviceNeed:`trash`,capacity:20,serviceSeconds:.8,revenue:0,appeal:1},{kind:`bench`,name:`Slatted Park Bench`,shortName:`Bench`,category:`decor`,icon:`bench`,description:`A timber-and-steel rest point that helps tired guests stay longer.`,cost:120,upkeep:1,footprint:[2,1],serviceNeed:`rest`,capacity:2,serviceSeconds:5,revenue:0,appeal:2,radius:8},{kind:`park-lamp`,name:`Shielded Park Lamp`,shortName:`Lamp`,category:`decor`,icon:`lamp`,description:`Warm, downward-facing light with a bolted architectural base.`,cost:145,upkeep:2,footprint:[1,1],serviceNeed:null,capacity:0,serviceSeconds:0,revenue:0,appeal:3,radius:9},{kind:`shade-tree`,name:`Copper Beech`,shortName:`Tree`,category:`decor`,icon:`tree`,description:`A mature shade tree with a guarded trunk and layered crown.`,cost:190,upkeep:1,footprint:[3,3],serviceNeed:null,capacity:0,serviceSeconds:0,revenue:0,appeal:5,radius:10},{kind:`tiered-fountain`,name:`Tiered Bronze Fountain`,shortName:`Fountain`,category:`decor`,icon:`fountain`,description:`A two-bowl bronze fountain in a stone basin. Lifts a whole plaza, and only a plaza.`,cost:620,upkeep:5,footprint:[5,5],serviceNeed:null,capacity:0,serviceSeconds:0,revenue:0,appeal:14,radius:13},{kind:`blossom-planter`,name:`Blossom Planter`,shortName:`Planter`,category:`decor`,icon:`planter`,description:`A slatted timber planter in full flower. Cheap enough to line a path with.`,cost:110,upkeep:1,footprint:[2,2],serviceNeed:null,capacity:0,serviceSeconds:0,revenue:0,appeal:3,radius:6}],nu=tu,ru=new Map(tu.map(e=>[e.kind,e])),iu={food:`Food`,rides:`Rides`,facilities:`Facilities`,decor:`Park details`},au={janitor:`janitor`};function ou(e){return e.serviceNeed!==null||e.staff!==void 0}function su(e){let t=ru.get(e);if(!t)throw Error(`Unknown placeable kind: ${e}`);return t}var cu={hunger:.0042,fun:.0036,bladder:.0031,rest:.0022},lu={hunger:.72,fun:.3,bladder:.83,rest:.6},uu={hunger:.04,fun:.03,bladder:.03,rest:.02},du=.94,fu=[`hunger`,`fun`,`bladder`,`rest`],pu=90,mu=.25,hu=.9;function gu(e,t){let n=Math.max(0,Math.min(100,Number.isFinite(e)?e:0))/100,r=pu+150*Math.max(0,Math.min(1,Number.isFinite(t)?t:.5)),i=1+(n-.5)*2*mu;return Math.round(r*i)}function _u(e){return gu(e,.5)}var vu=.75,yu=.5;function bu(e,t){let n=su(e).revenue;if(n<=0)return 0;let r=t?.[e];return typeof r!=`number`||!Number.isFinite(r)?n:xu(e,r)}function xu(e,t){let n=su(e).revenue;return n<=0?0:Number.isFinite(t)?Math.max(0,Math.min(Math.round(n*3),Math.round(t))):n}function Su(e){return su(e).revenue>0}function Cu(e){return vu+Math.max(0,Math.min(100,Number.isFinite(e)?e:0))/100*1.25}function wu(e,t,n){let r=su(e).revenue;if(r<=0)return 1;let i=bu(e,t)/r,a=Cu(n);return i<=a?1:Math.max(0,Math.min(1,1-(i-a)/yu))}function Tu(e,t,n){return bu(e,t)*wu(e,t,n)}function Eu(e){if(!e||typeof e!=`object`)return{};let t={};for(let[n,r]of Object.entries(e)){if(typeof r!=`number`||!Number.isFinite(r))continue;let e;try{e=su(n).revenue}catch{continue}e<=0||(t[n]=xu(n,r))}return t}var Du=1440,Ou=1260,ku=1.6;720/ku;var Au=450/540;function ju(e){let t=Mu(e);return t>=540&&t<1260}function Mu(e){if(!Number.isFinite(e))return 540;let t=e%Du;return t<0?t+Du:t}function Nu(e){return ju(e)?ku:8}function Pu(e,t){let n=Mu(e),r=Math.max(0,Number.isFinite(t)?t:0),i=0;for(let e=0;e<64&&r>0;e+=1){let e=Nu(n),t=n<540?540:n<1260?Ou:Du,a=(t-n)/e;if(r<a){n+=r*e,r=0;break}r-=a,n=t,n>=1440&&(n=0,i+=1)}return{minuteOfDay:Mu(n),daysPassed:i}}var Fu=class{state;constructor(e=5370206){this.state=e>>>0}next(){let e=this.state+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}range(e,t){return e+(t-e)*this.next()}integer(e,t){return Math.floor(this.range(e,t+1))}pick(e){let t=e[Math.floor(this.next()*e.length)];if(t===void 0)throw Error(`Cannot pick from an empty collection.`);return t}},Iu=.012,Lu=600,Ru=300,zu=10,Bu=.1,Vu=2.2,Hu=.15,Uu=1.6,Wu=1.4500000000000002,Gu=1.4,Ku=1.5,qu=4,Ju={x:0,z:32},Yu={x:0,z:22},Xu=1e-4;function Zu(e,t){return typeof e==`number`&&Number.isFinite(e)?e:t}function Qu(e){return Math.max(0,Math.min(1,e))}function $u(e,t){let n=e.x-t.x,r=e.z-t.z;return n*n+r*r}function ed(e){return{...e}}var td=class{random;listeners=new Set;facilities=new Map;guests=new Map;staff=new Map;litter=new Map;nextGuestId=1;nextLitterId=1;nextStaffId=1;spawnTimer=1.25;upkeepTimer=45;running=!1;navigation=null;configuredAppeal=null;configuredUpkeep=null;prices={};revenueAtDayStart=0;stats={cash:4200,reputation:38,cleanliness:1,guestCount:0,guestsServed:0,guestsVisited:0,litterCleaned:0,revenue:0,expenses:0,day:1,minuteOfDay:540};constructor(e=1346458187){this.random=new Fu(e)}subscribe(e){return this.listeners.add(e),()=>this.listeners.delete(e)}setRunning(e){this.running=e}isRunning(){return this.running}setNavigationNetwork(e){let t=new Set(e?.destinations.map(e=>`${Math.round(e.x)},${Math.round(e.z)}`)??[]);this.navigation=e;for(let e of this.guests.values())e.state!==`using`&&e.state!==`queueing`&&(!e.route.slice(e.routeIndex).every(e=>t.has(`${Math.round(e.x)},${Math.round(e.z)}`))||!this.assignRoute(e,e.destination))&&(e.state===`seeking`?this.clearTarget(e):e.state===`leaving`?this.assignRoute(e,Ju)||this.routeToRandomDestination(e):e.state===`arriving`?this.assignRoute(e,Yu)||this.routeToRandomDestination(e):e.state===`wandering`&&this.routeToRandomDestination(e));for(let e of this.staff.values())e.route.slice(e.routeIndex).every(e=>t.has(`${Math.round(e.x)},${Math.round(e.z)}`))&&this.assignRoute(e,e.destination)||this.releaseJanitor(e)}setParkMetrics(e,t){this.configuredAppeal=Math.max(0,e),this.configuredUpkeep=Math.max(0,t)}setPrice(e,t){let n=Eu({...this.prices,[e]:t});this.prices=n;let r=bu(e,n);return this.emit({type:`price-changed`,kind:e,price:r}),r}getPrices(){return this.prices}getPrice(e){return bu(e,this.prices)}getAcceptanceRate(e){return wu(e,this.prices,this.stats.reputation)}debugSetClock(e){this.stats={...this.stats,minuteOfDay:Mu(e)}}getStats(){return this.stats}getGuests(){return Array.from(this.guests.values(),e=>({...e,position:{...e.position},needs:ed(e.needs)}))}getStaff(){return Array.from(this.staff.values(),e=>({id:e.id,role:e.role,postId:e.postId,position:{...e.position},heading:e.heading,speed:e.speed,state:e.state,targetLitterId:e.targetLitterId,paletteIndex:e.paletteIndex}))}getLitter(){return Array.from(this.litter.values(),e=>({...e,position:{...e.position}}))}getFacilities(){return Array.from(this.facilities.values(),e=>({id:e.id,kind:e.kind,position:{...e.position},rotation:e.rotation,queueLength:e.queue.length,activeUsers:e.services.length,enabled:e.enabled,accessPoint:e.accessPoint?{...e.accessPoint}:void 0}))}getGuestRoutes(){return Object.fromEntries(Array.from(this.guests.values(),e=>[e.id,e.route.slice(e.routeIndex).map(e=>({...e}))]))}getSaveState(){return{stats:{...this.stats},litter:this.getLitter().map(e=>({...e,position:{...e.position}})),nextGuestId:this.nextGuestId,nextLitterId:this.nextLitterId,prices:{...this.prices}}}loadSaveState(e){let t=this.stats,n=e.stats??{};this.stats={cash:Math.round(Zu(n.cash,t.cash)),reputation:Math.max(0,Math.min(100,Zu(n.reputation,t.reputation))),cleanliness:Qu(Zu(n.cleanliness,t.cleanliness)),guestCount:0,guestsServed:Math.max(0,Math.round(Zu(n.guestsServed,0))),guestsVisited:Math.max(0,Math.round(Zu(n.guestsVisited,0))),litterCleaned:Math.max(0,Math.round(Zu(n.litterCleaned,0))),revenue:Math.max(0,Math.round(Zu(n.revenue,0))),expenses:Math.max(0,Math.round(Zu(n.expenses,0))),day:Math.max(1,Math.round(Zu(n.day,1))),minuteOfDay:Mu(Zu(n.minuteOfDay,540))},this.guests.clear(),this.staff.clear(),this.litter.clear();for(let t of e.litter??[]){if(!t||typeof t.id!=`string`)continue;let e=Zu(t.position?.x,NaN),n=Zu(t.position?.z,NaN);!Number.isFinite(e)||!Number.isFinite(n)||this.litter.set(t.id,{id:t.id,position:{x:e,z:n},variant:Math.max(0,Math.min(3,Math.round(Zu(t.variant,0)))),age:Math.max(0,Zu(t.age,0))})}this.prices=Eu(e.prices),this.revenueAtDayStart=this.stats.revenue,this.nextGuestId=Math.max(1,Math.round(Zu(e.nextGuestId,1))),this.nextLitterId=Math.max(1,Math.round(Zu(e.nextLitterId,1))),this.spawnTimer=1.25,this.upkeepTimer=45}applyAwayProgress(e){if(this.stats={...this.stats,cash:this.stats.cash+e.netCash,revenue:this.stats.revenue+e.revenue,expenses:this.stats.expenses+e.upkeep,guestsVisited:this.stats.guestsVisited+e.guestsVisited,guestsServed:this.stats.guestsServed+e.guestsServed,reputation:Math.max(0,Math.min(100,e.reputation)),cleanliness:Qu(e.cleanliness),day:this.stats.day+e.daysPassed},e.litterRemoved>0){let t=[...this.litter.values()].sort((e,t)=>t.age-e.age);for(let n=0;n<e.litterRemoved&&n<t.length;n+=1){let e=t[n];if(!e)break;this.litter.delete(e.id),this.stats={...this.stats,litterCleaned:this.stats.litterCleaned+1},this.emit({type:`litter-removed`,litterId:e.id,byPlayer:!1})}}let t=[...this.facilities.values()].filter(e=>e.enabled&&su(e.kind).category===`food`);for(let n=0;n<e.litterCreated;n+=1){let e=t[this.random.integer(0,t.length-1)],n=e?this.approachPoint(e):{...Yu};this.createLitter({x:n.x+this.random.range(-4.5,4.5),z:n.z+this.random.range(-4.5,4.5)})}}setFacilities(e){let t=new Set(e.map(e=>e.id));for(let e of this.facilities.keys())t.has(e)||(this.cancelFacility(e),this.facilities.delete(e));for(let t of e){let e=this.facilities.get(t.id);if(e){let n=e.enabled&&!t.enabled;e.position={...t.position},e.rotation=t.rotation,e.enabled=t.enabled,e.accessPoint=t.accessPoint?{...t.accessPoint}:void 0,n&&this.cancelFacility(t.id)}else this.facilities.set(t.id,{...t,position:{...t.position},queue:[],services:[]})}this.syncStaff()}purchase(e){let t=su(e);return this.spend(t.cost)}refund(e){this.refundExpense(su(e).cost)}spend(e){let t=Number.isFinite(e)?Math.max(0,Math.round(e)):0;return this.stats.cash<t?(this.emit({type:`insufficient-funds`,required:t}),!1):(this.stats={...this.stats,cash:this.stats.cash-t,expenses:this.stats.expenses+t},!0)}refundExpense(e){let t=Number.isFinite(e)?Math.max(0,Math.round(e)):0;this.stats={...this.stats,cash:this.stats.cash+t,expenses:Math.max(0,this.stats.expenses-t)}}update(e,t){if(!this.running)return;let n=Math.min(e,.1);this.advanceClock(n),this.processUpkeep(n),this.processSpawning(n),this.processFacilities(n);for(let e of[...this.guests.values()])this.updateGuest(e,n);this.updateStaff(n),this.cleanNearbyLitter(t),this.ageLitter(n),this.recalculateCleanliness(n),this.stats={...this.stats,guestCount:this.guests.size}}advanceClock(e){let t=ju(this.stats.minuteOfDay),n=Pu(this.stats.minuteOfDay,e);if(this.stats={...this.stats,minuteOfDay:n.minuteOfDay,day:this.stats.day+n.daysPassed},t&&!ju(n.minuteOfDay)){for(let e of this.guests.values())e.state!==`leaving`&&this.startLeaving(e);this.emit({type:`park-closed`})}n.daysPassed>0&&this.settleDay(n.daysPassed)}settleDay(e){for(let t=0;t<e;t+=1){let e=Math.max(0,this.stats.revenue-this.revenueAtDayStart),t=Ru,n=Math.round(this.stats.reputation*zu),r=Math.round(e*Bu),i=t+n+r;this.stats={...this.stats,cash:this.stats.cash+i,revenue:this.stats.revenue+i},this.revenueAtDayStart=this.stats.revenue,this.emit({type:`day-settled`,day:this.stats.day,subsidy:t,standing:n,share:r,total:i})}}processUpkeep(e){if(this.upkeepTimer-=e,this.upkeepTimer>0)return;this.upkeepTimer+=45;let t=this.configuredUpkeep??0;if(this.configuredUpkeep===null)for(let e of this.facilities.values())t+=su(e.kind).upkeep;t>0&&(this.stats={...this.stats,cash:this.stats.cash-t,expenses:this.stats.expenses+t})}processSpawning(e){if(!ju(this.stats.minuteOfDay))return;this.spawnTimer-=e;let t=this.configuredAppeal??Array.from(this.facilities.values()).reduce((e,t)=>e+(t.enabled?su(t.kind).appeal:0),0),n=Math.min(Lu,5+Math.floor(t/3));if(this.spawnTimer>0||this.guests.size>=n)return;this.spawnGuest();let r=1-this.stats.reputation/180;this.spawnTimer=Math.max(2.2,6.8*r+this.random.range(.5,2.8))}spawnGuest(){let e=`guest-${this.nextGuestId++}`,t={id:e,position:{x:this.random.range(-.7,.7),z:Ju.z+this.random.range(-.3,.3)},heading:Math.PI,speed:this.random.range(1.65,2.15),state:`arriving`,targetFacilityId:null,needs:{hunger:this.random.range(.18,.48),fun:this.random.range(.3,.58),bladder:this.random.range(.08,.36),rest:this.random.range(.05,.25)},happiness:this.random.range(.72,.92),carryingTrash:!1,paletteIndex:this.random.integer(0,7),ageScale:this.random.next()<.2?.78:this.random.range(.92,1.06),destination:{...Yu},route:[],routeIndex:0,decisionTimer:this.random.range(.4,1.2),lifetime:0,dwellTimer:0,trashTimer:0,targetNeed:null,priceSensitivity:this.random.next(),wallet:gu(this.stats.reputation,this.random.next())};this.assignRoute(t,Yu),this.guests.set(e,t),this.stats={...this.stats,guestsVisited:this.stats.guestsVisited+1},this.emit({type:`guest-spawned`,guest:{...t,needs:ed(t.needs)}})}updateGuest(e,t){e.lifetime+=t,e.decisionTimer-=t,e.needs.hunger=Qu(e.needs.hunger+t*cu.hunger),e.needs.fun=Qu(e.needs.fun+t*cu.fun),e.needs.bladder=Qu(e.needs.bladder+t*cu.bladder),e.needs.rest=Qu(e.needs.rest+t*cu.rest);let n=Math.max(e.needs.hunger,e.needs.fun,e.needs.bladder,e.needs.rest);if(e.happiness=Qu(n>.86?e.happiness-t*.018*(1+(n-.86)*4):e.happiness+t*.0015*this.stats.cleanliness),e.state!==`using`&&e.state!==`queueing`){if(e.carryingTrash&&e.trashTimer>0&&(e.trashTimer-=t,e.trashTimer<=0&&this.routeTrash(e)),e.state===`leaving`){this.moveAlongRoute(e,t,.55)&&this.removeGuest(e);return}if(e.lifetime>155||e.happiness<.22){this.startLeaving(e);return}if(e.state===`arriving`){this.moveAlongRoute(e,t,.45)&&(e.state=`wandering`,e.decisionTimer=0);return}if(e.state===`seeking`){let n=e.targetFacilityId?this.facilities.get(e.targetFacilityId):void 0;!n||!n.enabled?this.clearTarget(e):this.moveAlongRoute(e,t,.45)&&this.enqueueGuest(e,n);return}if(e.dwellTimer>0){e.dwellTimer-=t;return}e.decisionTimer<=0&&this.chooseGuestAction(e),e.state===`wandering`&&this.moveAlongRoute(e,t,.36)&&(e.dwellTimer=this.random.range(.5,2.2),e.decisionTimer=Math.min(e.decisionTimer,.4))}}chooseGuestAction(e){e.decisionTimer=this.random.range(2.4,4.4);let t=[[`bladder`,e.needs.bladder*1.15],[`hunger`,e.needs.hunger],[`fun`,e.needs.fun*du],[`rest`,e.needs.rest*.8]];t.sort((e,t)=>t[1]-e[1]);let[n,r]=t[0]??[null,0];e.wallet<_u(this.stats.reputation)*.28&&this.seekFacility(e,`cash`)||n&&r>.48&&this.seekFacility(e,n)||e.needs.fun>.34&&this.random.next()<.38&&this.seekFacility(e,`fun`)||this.random.next()<.08&&this.seekFacility(e,`information`)||(e.state=`wandering`,this.routeToRandomDestination(e))}seekFacility(e,t){let n=[...this.facilities.values()].filter(n=>{let r=su(n.kind);return!n.enabled||r.serviceNeed!==t?!1:this.willPay(e,n.kind)});if(n.length===0)return!1;n.sort((t,n)=>$u(e.position,t.position)+t.queue.length*11-($u(e.position,n.position)+n.queue.length*11));let r=n[0];return r?(e.state=`seeking`,e.targetNeed=t,e.targetFacilityId=r.id,this.assignRoute(e,this.approachPoint(r))?!0:(this.clearTarget(e),!1)):!1}willPay(e,t){let n=bu(t,this.prices);if(n<=0||su(t).serviceNeed===`cash`)return!0;if(n>e.wallet)return!1;let r=wu(t,this.prices,this.stats.reputation);return r>=1||e.priceSensitivity<r}enqueueGuest(e,t){t.services.some(t=>t.guestId===e.id)||(t.queue.includes(e.id)||t.queue.push(e.id),e.state=`queueing`,e.position=this.queuePoint(t,t.queue.indexOf(e.id)),this.startQueuedServices(t))}processFacilities(e){for(let t of this.facilities.values()){if(!t.enabled){t.queueLength=0,t.activeUsers=0;continue}for(let n of[...t.services])n.remaining-=e,n.remaining<=0&&this.completeService(t,n);this.startQueuedServices(t),t.queueLength=t.queue.length,t.activeUsers=t.services.length}}startQueuedServices(e){if(!e.enabled)return;let t=su(e.kind);for(;e.services.length<t.capacity&&e.queue.length>0;){let n=e.queue.shift(),r=n?this.guests.get(n):void 0;r&&(r.state=`using`,r.position={...e.position},e.services.push({guestId:r.id,remaining:t.serviceSeconds}))}}completeService(e,t){e.services=e.services.filter(e=>e!==t);let n=this.guests.get(t.guestId);if(!n)return;let r=su(e.kind);switch(r.serviceNeed){case`hunger`:n.needs.hunger=Math.max(uu.hunger,n.needs.hunger-lu.hunger),n.needs.bladder=Qu(n.needs.bladder+.12),n.carryingTrash=!0,n.trashTimer=this.random.range(9,17);break;case`fun`:n.needs.fun=Math.max(uu.fun,n.needs.fun-lu.fun),n.needs.rest=Qu(n.needs.rest+.09);break;case`bladder`:n.needs.bladder=uu.bladder;break;case`rest`:n.needs.rest=Math.max(uu.rest,n.needs.rest-lu.rest);break;case`information`:n.happiness=Qu(n.happiness+.035),n.needs.fun=Math.max(.18,n.needs.fun-.16),n.decisionTimer=0;break;case`cash`:n.wallet+=Math.round(_u(this.stats.reputation)*hu),n.decisionTimer=0;break;case`trash`:n.carryingTrash=!1,n.trashTimer=0}n.happiness=Qu(n.happiness+.08+r.appeal*.0015),n.state=`wandering`,n.targetFacilityId=null,n.targetNeed=null,n.position=this.approachPoint(e),this.routeToRandomDestination(n),n.decisionTimer=this.random.range(1.2,2.8);let i=bu(e.kind,this.prices),a=Math.min(i,Math.max(0,n.wallet));n.wallet=Math.max(0,n.wallet-a),this.stats={...this.stats,cash:this.stats.cash+a,revenue:this.stats.revenue+a,guestsServed:this.stats.guestsServed+1},this.emit({type:`service-complete`,guestId:n.id,facilityId:e.id,revenue:a})}routeTrash(e){let t=[...this.facilities.values()].filter(e=>e.enabled&&su(e.kind).serviceNeed===`trash`);t.sort((t,n)=>$u(e.position,t.position)-$u(e.position,n.position));let n=t[0];if(n&&$u(e.position,n.position)<=144){if(e.state=`seeking`,e.targetNeed=`trash`,e.targetFacilityId=n.id,this.assignRoute(e,this.approachPoint(n)))return;this.clearTarget(e)}this.createLitter(e.position),e.carryingTrash=!1,e.happiness=Qu(e.happiness-.035)}pushOutOfBuildings(e){for(let t of this.facilities.values()){let n=su(t.kind),r=Math.abs(Math.round(t.rotation/(Math.PI/2)))%2==1,i=(r?n.footprint[1]:n.footprint[0])/2+.35,a=(r?n.footprint[0]:n.footprint[1])/2+.35,o=e.x-t.position.x,s=e.z-t.position.z;Math.abs(o)>=i||Math.abs(s)>=a||(e=i-Math.abs(o)<a-Math.abs(s)?{x:t.position.x+Math.sign(o||1)*i,z:e.z}:{x:e.x,z:t.position.z+Math.sign(s||1)*a})}return e}createLitter(e){let t=this.pushOutOfBuildings(e),n={id:`litter-${this.nextLitterId++}`,position:{x:t.x+this.random.range(-.35,.35),z:t.z+this.random.range(-.35,.35)},variant:this.random.integer(0,3),age:0};this.litter.set(n.id,n),this.emit({type:`litter-created`,litter:{...n,position:{...n.position}}})}cleanNearbyLitter(e){for(let t of this.litter.values())$u(t.position,e)>1.7*1.7||(this.litter.delete(t.id),this.stats={...this.stats,cash:this.stats.cash+3,litterCleaned:this.stats.litterCleaned+1,cleanliness:Math.min(1,this.stats.cleanliness+.06)},this.emit({type:`litter-removed`,litterId:t.id,byPlayer:!0}))}syncStaff(){let e=new Map;for(let t of this.facilities.values())t.enabled&&su(t.kind).staff===`janitor`&&e.set(t.id,t);for(let[t,n]of[...this.staff])e.has(n.postId)||this.staff.delete(t);let t=new Set(Array.from(this.staff.values(),e=>e.postId));for(let n of e.values())t.has(n.id)||this.hireJanitor(n)}hireJanitor(e){let t=this.approachPoint(e),n={id:`staff-${this.nextStaffId++}`,role:`janitor`,postId:e.id,position:{...t},heading:e.rotation,speed:Vu,state:`idle`,targetLitterId:null,paletteIndex:this.random.integer(0,5),destination:{...t},route:[],routeIndex:0,collectTimer:0,searchTimer:0};this.staff.set(n.id,n)}updateStaff(e){for(let t of this.staff.values()){if(t.state===`collecting`){t.collectTimer-=e,t.collectTimer<=0&&this.finishCollecting(t);continue}t.targetLitterId&&!this.litter.has(t.targetLitterId)&&this.releaseJanitor(t),t.searchTimer-=e,t.state===`idle`&&t.searchTimer<=0&&(t.searchTimer=Ku,this.assignJanitorWork(t));let n=this.moveAlongRoute(t,e,Hu);if(t.state!==`walking`)continue;let r=t.targetLitterId?this.litter.get(t.targetLitterId):void 0;if(!r){this.releaseJanitor(t);continue}(n||$u(t.position,r.position)<=Uu**2)&&(t.state=`collecting`,t.collectTimer=Gu)}}assignJanitorWork(e){let t=new Set;for(let n of this.staff.values())n!==e&&n.targetLitterId&&t.add(n.targetLitterId);let n=[...this.litter.values()].filter(e=>!t.has(e.id)&&this.canWalkTo(e.position)).sort((t,n)=>$u(e.position,t.position)-$u(e.position,n.position)).slice(0,qu);for(let t of n){let n=this.nearestWalkableDestination(t.position)??t.position;if(this.assignRoute(e,n)){e.targetLitterId=t.id,e.state=`walking`;return}}if(e.routeIndex<e.route.length)return;let r=this.facilities.get(e.postId);if(!r)return;let i=this.approachPoint(r);$u(e.position,i)<=1||this.assignRoute(e,i)}finishCollecting(e){let t=e.targetLitterId?this.litter.get(e.targetLitterId):void 0;this.releaseJanitor(e),!(!t||$u(e.position,t.position)>Uu**2)&&(this.litter.delete(t.id),this.stats={...this.stats,litterCleaned:this.stats.litterCleaned+1},this.emit({type:`litter-removed`,litterId:t.id,byPlayer:!1}))}releaseJanitor(e){e.targetLitterId=null,e.state=`idle`,e.collectTimer=0,e.searchTimer=0}canWalkTo(e){let t=this.nearestWalkableDestination(e);return!t||$u(t,e)<=Wu**2}ageLitter(e){for(let t of this.litter.values())t.age+=e}recalculateCleanliness(e){let t=Qu(1-this.litter.size*.045),n=this.stats.cleanliness+(t-this.stats.cleanliness)*e*.55;this.stats={...this.stats,cleanliness:n}}moveToward(e,t,n,r){let i=t.x-e.position.x,a=t.z-e.position.z,o=Math.hypot(i,a);if(o<=r)return n;let s=Math.min(o,n);return e.position.x+=i/Math.max(o,Xu)*s,e.position.z+=a/Math.max(o,Xu)*s,e.heading=Math.atan2(i,a),Math.max(0,n-s)}moveAlongRoute(e,t,n){let r=e.speed*t;for(;e.routeIndex<e.route.length;){let t=e.route[e.routeIndex];if(!t)break;let i=e.routeIndex===e.route.length-1?n:.12,a=r;if(r=this.moveToward(e,t,r,i),!($u(e.position,t)<=i*i))return!1;if(e.routeIndex+=1,r<=Xu||r===a){if(e.routeIndex>=e.route.length)return!0;if(r<=Xu)return!1}}return e.routeIndex>=e.route.length}assignRoute(e,t){let n=this.nearestWalkableDestination(e.position)??e.position,r=this.navigation?this.navigation.findPath(n,t):[t];if(!r)return e.route=[],e.routeIndex=0,!1;for(e.destination={...t},e.route=r.map(e=>({...e})),$u(e.position,n)>.08&&e.route.unshift({...n}),e.route.length===0&&e.route.push({...t}),e.routeIndex=0;e.routeIndex<e.route.length-1&&$u(e.position,e.route[e.routeIndex]??e.position)<.08;)e.routeIndex+=1;return!0}routeToRandomDestination(e){let t=this.navigation?.destinations;if(t&&t.length>0){let n=Math.min(8,t.length);for(let r=0;r<n;r+=1){let n=t[this.random.integer(0,t.length-1)];if(n&&this.assignRoute(e,n))return}}this.assignRoute(e,Yu)}nearestWalkableDestination(e){let t=this.navigation?.destinations;if(!t||t.length===0)return null;let n=null,r=1/0;for(let i of t){let t=$u(e,i);t<r&&(r=t,n=i)}return n?{...n}:null}approachPoint(e){if(e.accessPoint)return{...e.accessPoint};let t=su(e.kind),n=Math.max(t.footprint[0],t.footprint[1])*.54+.65;return{x:e.position.x+Math.sin(e.rotation)*n,z:e.position.z+Math.cos(e.rotation)*n}}queuePoint(e,t){let n=this.approachPoint(e),r=t*2.399963,i=Math.min(.32,.08+t*.045);return{x:n.x+Math.sin(r)*i,z:n.z+Math.cos(r)*i}}clearTarget(e){e.targetFacilityId=null,e.targetNeed=null,e.state=`wandering`,this.routeToRandomDestination(e)}cancelFacility(e){let t=this.facilities.get(e);if(!t)return;let n=[...t.queue,...t.services.map(e=>e.guestId)];for(let e of n){let n=this.guests.get(e);n&&(n.position=this.approachPoint(t),this.clearTarget(n))}t.queue=[],t.services=[],t.queueLength=0,t.activeUsers=0}startLeaving(e){this.removeGuestFromFacilities(e.id),e.state=`leaving`,e.targetFacilityId=null,e.targetNeed=null,this.assignRoute(e,Ju)}removeGuest(e){this.guests.delete(e.id),this.removeGuestFromFacilities(e.id);let t=e.happiness>=.55,n=this.stats.reputation,r=e.happiness*100,i=Math.max(0,Math.min(100,n+(r-n)*Iu));this.stats={...this.stats,reputation:i},this.emit({type:`guest-left`,guestId:e.id,happy:t}),this.emit({type:`reputation-changed`,delta:i-n})}removeGuestFromFacilities(e){for(let t of this.facilities.values())t.queue=t.queue.filter(t=>t!==e),t.services=t.services.filter(t=>t.guestId!==e)}emit(e){for(let t of this.listeners)t(e)}},nd=Object.freeze({minX:-32,maxX:31,minZ:-33,maxZ:32}),rd=Object.freeze({x:0,z:32}),id=Object.freeze({construction:Object.freeze({sidewalk:10,road:18}),demolition:Object.freeze({sidewalk:2,road:3})}),ad=Object.freeze([{id:`founders-park`,name:`Founder's Park`,bounds:Object.freeze({minX:-12,maxX:11,minZ:-20,maxZ:32}),cost:0,initiallyOwned:!0},{id:`south-promenade`,name:`South Promenade`,bounds:Object.freeze({minX:-12,maxX:11,minZ:-33,maxZ:-21}),cost:950},{id:`west-grove`,name:`West Grove`,bounds:Object.freeze({minX:-32,maxX:-13,minZ:6,maxZ:32}),cost:1600},{id:`west-meadow`,name:`West Meadow`,bounds:Object.freeze({minX:-32,maxX:-13,minZ:-20,maxZ:5}),cost:1500},{id:`west-corner`,name:`West Corner`,bounds:Object.freeze({minX:-32,maxX:-13,minZ:-33,maxZ:-21}),cost:1100},{id:`east-grove`,name:`East Grove`,bounds:Object.freeze({minX:12,maxX:31,minZ:6,maxZ:32}),cost:1650},{id:`east-meadow`,name:`East Meadow`,bounds:Object.freeze({minX:12,maxX:31,minZ:-20,maxZ:5}),cost:1550},{id:`east-corner`,name:`East Corner`,bounds:Object.freeze({minX:12,maxX:31,minZ:-33,maxZ:-21}),cost:1150}]),od=Object.freeze([Object.freeze({x:0,z:1}),Object.freeze({x:1,z:0}),Object.freeze({x:0,z:-1}),Object.freeze({x:-1,z:0})]),sd={lawn:0,sidewalk:1,road:2},cd=[`lawn`,`sidewalk`,`road`];function ld(e){return{x:e.x,z:e.z}}function ud(e){return{...e}}function dd(e){return Number.isInteger(e.x)&&Number.isInteger(e.z)}function fd(e,t){if(!Number.isInteger(e.minX)||!Number.isInteger(e.maxX)||!Number.isInteger(e.minZ)||!Number.isInteger(e.maxZ)||e.minX>e.maxX||e.minZ>e.maxZ)throw Error(`${t} must use ordered, inclusive integer bounds.`)}function pd(e,t){if(!Number.isFinite(e)||e<0)throw Error(`${t} must be a finite, non-negative number.`)}function md(e,t){return e.minX<=t.maxX&&e.maxX>=t.minX&&e.minZ<=t.maxZ&&e.maxZ>=t.minZ}function hd(e,t,n,r){return Math.max(e,n)<=Math.min(t,r)}function gd(e,t){let n=(e.maxX+1===t.minX||t.maxX+1===e.minX)&&hd(e.minZ,e.maxZ,t.minZ,t.maxZ),r=(e.maxZ+1===t.minZ||t.maxZ+1===e.minZ)&&hd(e.minX,e.maxX,t.minX,t.maxX);return n||r}function _d(e,t){return e.z-t.z||e.x-t.x}function vd(e){return`${e.x},${e.z}`}function yd(e){let t=new Map;for(let n of e)t.set(vd(n),ld(n));return[...t.values()].sort(_d)}function bd(e){return(e.maxX-e.minX+1)*(e.maxZ-e.minZ+1)}function xd(e){fd(e,`Cell rectangle`);let t=[];for(let n=e.minZ;n<=e.maxZ;n+=1)for(let r=e.minX;r<=e.maxX;r+=1)t.push({x:r,z:n});return t}var Sd=class{cellSizeMeters=1;bounds;width;height;entrance;costs;surfaces;parcels=new Map;parcelIdByCell;revision=0;constructor(e={}){let t=e.bounds===void 0&&e.entrance===void 0&&e.parcels===void 0;this.bounds=ud(e.bounds??nd),fd(this.bounds,`Grid`),this.width=this.bounds.maxX-this.bounds.minX+1,this.height=this.bounds.maxZ-this.bounds.minZ+1;let n=e.bounds?{x:Math.floor((this.bounds.minX+this.bounds.maxX)/2),z:this.bounds.maxZ}:rd;if(this.entrance=ld(e.entrance??n),!dd(this.entrance)||!this.contains(this.entrance))throw Error(`Entrance must be an integer cell inside the grid.`);this.costs={construction:{...id.construction,...e.costs?.construction},demolition:{...id.demolition,...e.costs?.demolition}},pd(this.costs.construction.sidewalk,`Sidewalk construction cost`),pd(this.costs.construction.road,`Road construction cost`),pd(this.costs.demolition.sidewalk,`Sidewalk demolition cost`),pd(this.costs.demolition.road,`Road demolition cost`),this.surfaces=new Uint8Array(this.width*this.height),this.parcelIdByCell=Array(this.width*this.height).fill(null);let r=e.parcels??(e.bounds?[{id:`founders-park`,name:`Founder's Park`,bounds:this.bounds,cost:0,initiallyOwned:!0}]:ad);this.initializeParcels(r),e.initialSurfaces===void 0?t&&this.initializeDefaultPromenades():this.initializeSurfaces(e.initialSurfaces)}getRevision(){return this.revision}getBounds(){return{...this.bounds,width:this.width,height:this.height}}getEntranceCell(){return ld(this.entrance)}getCosts(){return{construction:{...this.costs.construction},demolition:{...this.costs.demolition}}}contains(e){return dd(e)&&e.x>=this.bounds.minX&&e.x<=this.bounds.maxX&&e.z>=this.bounds.minZ&&e.z<=this.bounds.maxZ}worldToCell(e,t){if(!Number.isFinite(e)||!Number.isFinite(t))return null;let n={x:Math.floor(e+.5),z:Math.floor(t+.5)};return this.contains(n)?n:null}cellToWorld(e){return this.contains(e)?ld(e):null}getSurface(e){let t=this.indexOf(e);return t<0?null:this.surfaceAtIndex(t)}isOwned(e){let t=this.indexOf(e);if(t<0)return!1;let n=this.parcelIdByCell[t];return n!==null&&(this.parcels.get(n)?.owned??!1)}isWalkable(e){let t=this.getSurface(e);return t===`sidewalk`||t===`road`}getCell(e){let t=this.indexOf(e);return t<0?null:this.cellSnapshot(t)}getCells(){return Array.from({length:this.surfaces.length},(e,t)=>this.cellSnapshot(t))}getSnapshot(){return{revision:this.revision,cellSizeMeters:1,bounds:this.getBounds(),entrance:this.getEntranceCell(),cells:this.getCells(),parcels:this.getParcelSnapshots()}}getSaveState(){let e=[],t=this.surfaces[0]??0,n=0;for(let r=0;r<this.surfaces.length;r+=1){let i=this.surfaces[r]??0;if(i===t){n+=1;continue}e.push(t,n),t=i,n=1}return n>0&&e.push(t,n),{ownedParcelIds:[...this.parcels.values()].filter(e=>e.owned).map(e=>e.definition.id),surfaceRuns:e}}loadSaveState(e){if(!e||!Array.isArray(e.ownedParcelIds)||!Array.isArray(e.surfaceRuns)||e.surfaceRuns.length%2!=0)return!1;for(let t of e.ownedParcelIds)if(!this.parcels.has(t))return!1;let t=new Uint8Array(this.surfaces.length),n=0;for(let r=0;r<e.surfaceRuns.length;r+=2){let i=e.surfaceRuns[r]??-1,a=e.surfaceRuns[r+1]??-1;if(!Number.isInteger(i)||i<0||i>=cd.length||!Number.isInteger(a)||a<0||n+a>t.length)return!1;t.fill(i,n,n+a),n+=a}if(n!==t.length)return!1;let r=new Set(e.ownedParcelIds);for(let e of this.parcels.values())e.definition.initiallyOwned&&r.add(e.definition.id);for(let e=0;e<t.length;e+=1){if(t[e]===sd.lawn)continue;let n=this.parcelIdByCell[e];if(!n||!r.has(n))return!1}for(let e of this.parcels.values())e.owned=r.has(e.definition.id);return this.surfaces.set(t),this.revision+=1,!0}getParcelSnapshots(){return[...this.parcels.values()].map(e=>this.parcelSnapshot(e))}getParcelSnapshot(e){let t=this.parcels.get(e);return t?this.parcelSnapshot(t):null}quoteParcelPurchase(e){let t=this.parcels.get(e);return t?t.owned?{valid:!1,parcelId:e,cost:t.definition.cost,reason:`already-owned`}:this.getAdjacentParcels(t).some(e=>e.owned)?{valid:!0,parcelId:e,cost:t.definition.cost,reason:null}:{valid:!1,parcelId:e,cost:t.definition.cost,reason:`not-adjacent`}:{valid:!1,parcelId:e,cost:0,reason:`unknown-parcel`}}purchaseParcel(e){let t=this.quoteParcelPurchase(e);if(!t.valid)return{...t,purchased:!1};let n=this.parcels.get(e);return n?(n.owned=!0,this.revision+=1,{...t,purchased:!0}):{...t,valid:!1,reason:`unknown-parcel`,purchased:!1}}quoteConstruction(e,t){let n=this.validateCellSelection(e,`construct`,t);if(!n.valid)return n;for(let e of n.cells){if(!this.isOwned(e))return this.invalidSurfaceQuote(n,`unowned-land`,e);if(this.getSurface(e)!==`lawn`)return this.invalidSurfaceQuote(n,`surface-not-lawn`,e)}return{...n,cost:n.cellCount*this.costs.construction[t]}}construct(e,t){let n=this.quoteConstruction(e,t);if(!n.valid)return{...n,applied:!1};for(let e of n.cells)this.setSurface(e,t);return this.revision+=1,{...n,applied:!0}}quoteDemolition(e){let t=this.validateCellSelection(e,`demolish`,null);if(!t.valid)return t;let n=0;for(let e of t.cells){if(!this.isOwned(e))return this.invalidSurfaceQuote(t,`unowned-land`,e);let r=this.getSurface(e);if(r===null||r===`lawn`)return this.invalidSurfaceQuote(t,`surface-is-lawn`,e);n+=this.costs.demolition[r]}return{...t,cost:n}}demolish(e){let t=this.quoteDemolition(e);if(!t.valid)return{...t,applied:!1};for(let e of t.cells)this.setSurface(e,`lawn`);return this.revision+=1,{...t,applied:!0}}getWalkableNeighbors(e){if(!this.isWalkable(e))return[];let t=[];for(let n of od){let r={x:e.x+n.x,z:e.z+n.z};this.isWalkable(r)&&t.push(r)}return t}getPathGraphSnapshot(){let e=[];for(let t=0;t<this.surfaces.length;t+=1){let n=this.surfaceAtIndex(t);if(n===`lawn`)continue;let r=this.cellFromIndex(t);e.push({cell:r,surface:n,neighbors:this.getWalkableNeighbors(r)})}return e}getReachableCells(e=this.entrance){let t=this.indexOf(e);if(t<0||!this.isWalkable(e))return[];let n=new Uint8Array(this.surfaces.length),r=new Int32Array(this.surfaces.length),i=[],a=0,o=1;for(n[t]=1,r[0]=t;a<o;){let e=r[a];a+=1;let t=this.cellFromIndex(e);i.push(t);for(let e of od){let i={x:t.x+e.x,z:t.z+e.z},a=this.indexOf(i);a<0||n[a]===1||!this.isWalkable(i)||(n[a]=1,r[o]=a,o+=1)}}return i}findRoute(e,t){let n=this.indexOf(e),r=this.indexOf(t);if(n<0||r<0||!this.isWalkable(e)||!this.isWalkable(t))return null;if(n===r)return[ld(e)];let i=new Int32Array(this.surfaces.length);i.fill(-2),i[n]=-1;let a=new Int32Array(this.surfaces.length),o=0,s=1;for(a[0]=n;o<s;){let e=a[o];o+=1;let t=this.cellFromIndex(e);for(let n of od){let o={x:t.x+n.x,z:t.z+n.z},c=this.indexOf(o);if(!(c<0||i[c]!==-2||!this.isWalkable(o))){if(i[c]=e,c===r)return this.reconstructRoute(i,r);a[s]=c,s+=1}}}return null}getFacilityConnectivity(e){if(!this.isWalkable(this.entrance))return{connected:!1,entrance:this.getEntranceCell(),approachCell:null,route:null,reason:`entrance-not-walkable`};let t=yd(e.filter(e=>dd(e)&&this.isWalkable(e)));if(t.length===0)return{connected:!1,entrance:this.getEntranceCell(),approachCell:null,route:null,reason:`no-walkable-approach`};let n=null,r=null;for(let e of t){let t=this.findRoute(this.entrance,e);t&&(r===null||t.length<r.length)&&(n=e,r=t)}return!n||!r?{connected:!1,entrance:this.getEntranceCell(),approachCell:null,route:null,reason:`no-route`}:{connected:!0,entrance:this.getEntranceCell(),approachCell:ld(n),route:r,reason:null}}isFacilityConnected(e){return this.getFacilityConnectivity(e).connected}getApproachCells(e){fd(e,`Facility footprint`);let t=[];for(let n=e.minX;n<=e.maxX;n+=1)t.push({x:n,z:e.maxZ+1},{x:n,z:e.minZ-1});for(let n=e.minZ;n<=e.maxZ;n+=1)t.push({x:e.maxX+1,z:n},{x:e.minX-1,z:n});return yd(t.filter(e=>this.contains(e)))}initializeParcels(e){if(e.length===0)throw Error(`At least one parcel is required.`);for(let t of e){if(!t.id.trim())throw Error(`Parcel ids cannot be empty.`);if(this.parcels.has(t.id))throw Error(`Duplicate parcel id: ${t.id}`);if(fd(t.bounds,`Parcel ${t.id}`),pd(t.cost,`Parcel ${t.id} cost`),t.bounds.minX<this.bounds.minX||t.bounds.maxX>this.bounds.maxX||t.bounds.minZ<this.bounds.minZ||t.bounds.maxZ>this.bounds.maxZ)throw Error(`Parcel ${t.id} lies outside the grid.`);for(let e of this.parcels.values())if(md(t.bounds,e.definition.bounds))throw Error(`Parcel ${t.id} overlaps parcel ${e.definition.id}.`);let e={id:t.id,name:t.name,bounds:ud(t.bounds),cost:t.cost,initiallyOwned:t.initiallyOwned??!1};this.parcels.set(e.id,{definition:e,owned:e.initiallyOwned??!1});for(let t of xd(e.bounds))this.parcelIdByCell[this.indexOf(t)]=e.id}if(![...this.parcels.values()].some(e=>e.owned))throw Error(`At least one parcel must be initially owned.`)}initializeSurfaces(e){for(let t of e)for(let e of t.cells){if(!dd(e)||!this.contains(e))throw Error(`Initial surfaces must use integer cells inside the grid.`);if(!this.isOwned(e))throw Error(`Initial surfaces can only be placed on initially owned land.`);this.setSurface(e,t.surface)}}initializeDefaultPromenades(){let e=this.parcels.get(`founders-park`);if(!e?.owned)return;let t=[];for(let n=e.definition.bounds.minZ;n<=e.definition.bounds.maxZ;n+=1)for(let e=-2;e<=2;e+=1)t.push({x:e,z:n});for(let n=-2;n<=2;n+=1)for(let r=e.definition.bounds.minX;r<=e.definition.bounds.maxX;r+=1)t.push({x:r,z:n});for(let e=29;e<=32;e+=1)for(let n=-3;n<=3;n+=1)t.push({x:n,z:e});for(let e of yd(t))this.contains(e)&&this.isOwned(e)&&this.setSurface(e,`sidewalk`)}validateCellSelection(e,t,n){if(e.length===0)return{valid:!1,operation:t,targetSurface:n,cells:[],cellCount:0,cost:0,reason:`empty-selection`,invalidCell:null};let r=e.find(e=>!dd(e));if(r)return{valid:!1,operation:t,targetSurface:n,cells:[],cellCount:0,cost:0,reason:`invalid-cell`,invalidCell:ld(r)};let i=yd(e),a=i.find(e=>!this.contains(e));return a?{valid:!1,operation:t,targetSurface:n,cells:i,cellCount:i.length,cost:0,reason:`out-of-bounds`,invalidCell:ld(a)}:{valid:!0,operation:t,targetSurface:n,cells:i,cellCount:i.length,cost:0,reason:null,invalidCell:null}}invalidSurfaceQuote(e,t,n){return{...e,valid:!1,cost:0,reason:t,invalidCell:ld(n)}}parcelSnapshot(e){let t=this.getAdjacentParcels(e),n=t.filter(e=>e.owned),r=!e.owned&&n.length>0;return{id:e.definition.id,name:e.definition.name,bounds:ud(e.definition.bounds),area:bd(e.definition.bounds),cost:e.definition.cost,owned:e.owned,purchasable:r,status:e.owned?`owned`:r?`available`:`locked`,adjacentParcelIds:t.map(e=>e.definition.id),adjacentOwnedParcelIds:n.map(e=>e.definition.id)}}getAdjacentParcels(e){return[...this.parcels.values()].filter(t=>t!==e&&gd(e.definition.bounds,t.definition.bounds))}reconstructRoute(e,t){let n=[],r=t;for(;r>=0;)n.push(this.cellFromIndex(r)),r=e[r];return n.reverse(),n}cellSnapshot(e){let t=this.cellFromIndex(e),n=this.surfaceAtIndex(e),r=this.parcelIdByCell[e];return{...t,surface:n,walkable:n!==`lawn`,owned:r!==null&&(this.parcels.get(r)?.owned??!1),parcelId:r}}indexOf(e){return this.contains(e)?(e.z-this.bounds.minZ)*this.width+(e.x-this.bounds.minX):-1}cellFromIndex(e){return{x:this.bounds.minX+e%this.width,z:this.bounds.minZ+Math.floor(e/this.width)}}surfaceAtIndex(e){return cd[this.surfaces[e]]}setSurface(e,t){let n=this.indexOf(e);n>=0&&(this.surfaces[n]=sd[t])}};function Cd(e,t){if(!Number.isFinite(t)||t<=0)return 0;let n=Math.max(0,Number.isFinite(e)?e:t)/t;return n>=1?0:1-n*n}function wd(e,t){let n=e.x-t.position.x,r=e.z-t.position.z,i=Math.max(t.spec.footprint[0],t.spec.footprint[1])/2;return Math.max(0,Math.hypot(n,r)-i)}function Td(e,t){let n=e.spec.radius;if(typeof n!=`number`)return e.spec.appeal;let r=0;for(let i of t)if(!(i===e||!i.connected||i.spec.category===`decor`)&&(r=Math.max(r,Cd(wd(e.position,i),n)),r>=1))break;return e.spec.appeal*r}function Ed(e){let t=0;for(let n of e)n.connected&&(t+=typeof n.spec.radius==`number`?Td(n,e):n.spec.appeal);return t}var Dd=600,Od=5,kd=3,Ad=2.2,jd=6.8,Md=1.65,Nd=180,Pd=22;function Fd(e){return Math.max(Ad,jd*(1-Math.max(0,Math.min(100,e))/Nd)+Md)}function Id(e,t){let n=Math.min(Dd,Math.max(0,Od+Math.floor(e/kd))),r=(155+Pd)/Fd(t);return Math.min(n,r)}var Ld=.65,Rd=45,zd=.15,Bd=.045,Vd=.96,Hd=28800;function Ud(){return{appeal:0,upkeepPerCycle:0,needs:{hunger:{throughput:0,revenuePerService:0,acceptance:1},fun:{throughput:0,revenuePerService:0,acceptance:1},bladder:{throughput:0,revenuePerService:0,acceptance:1},rest:{throughput:0,revenuePerService:0,acceptance:1}},binCount:0,foodCount:0,janitorCount:0}}function Wd(e){return Math.max(0,Math.min(1,e))}function Gd(e,t,n,r){if(!Number.isFinite(n)||n<60)return null;let i=Math.min(n,Hd),a=n>Hd,o=i*Au,s=Id(t.appeal,e.reputation),c=0,l=0,u=0,d=0,f=0;for(let e of fu){let n=t.needs[e],r=Wd(typeof n.acceptance==`number`&&Number.isFinite(n.acceptance)?n.acceptance:1),i=s*cu[e]/lu[e]*r,a=Math.min(i,n.throughput),p=a*Ld*o;d+=i,f+=a,c+=p,l+=p*n.revenuePerService,e===`hunger`&&(u=p)}let p=s*o/155,m=t.walletPerGuest;if(typeof m==`number`&&Number.isFinite(m)&&m>=0){let e=p*m;if(l>e){let t=e/l;c*=t,u*=t,l=e}}let h=i/Rd*t.upkeepPerCycle,g=t.foodCount>0?Wd(t.binCount/t.foodCount):1,_=Math.max(0,u*(1-g)),v=Math.max(0,Math.round(t.janitorCount??0))*zd*i,y=Math.max(0,r),b=Math.max(0,y+_-v),x=Math.max(0,Math.round(b-y)),S=Math.max(0,Math.round(y-b)),C=Wd(1-b*Bd),w=p,T=d>0?Wd(f/d):1,E=Math.min(Vd,Wd(T*.65+C*.35))*100,D=.988**w,ee=E+(e.reputation-E)*D,O=Math.max(0,Math.round(l)),k=Math.max(0,Math.round(h));return{awaySeconds:n,creditedSeconds:i,capped:a,guestsVisited:Math.max(0,Math.round(w)),guestsServed:Math.max(0,Math.round(c)),revenue:O,upkeep:k,netCash:O-k,litterCreated:x,litterRemoved:S,daysPassed:Math.floor(i/540),cleanliness:C,reputation:Math.max(0,Math.min(100,ee))}}var Kd=`parkworks-tycoon-save`;function qd(e){return typeof e==`number`&&Number.isFinite(e)}function Jd(e){return typeof e==`object`&&!!e}function Yd(e){return JSON.stringify(e)}function Xd(e){let t=[],n;try{n=JSON.parse(e)}catch{return{save:null,warnings:[`That save could not be read.`]}}if(!Jd(n))return{save:null,warnings:[`That save is not a park.`]};if(n.format!==`parkworks-tycoon-save`)return{save:null,warnings:[`That file is not a Parkworks park.`]};if(!qd(n.version)||n.version>1)return{save:null,warnings:[`That park was saved by a newer version of the game.`]};let r=n.grid,i=n.simulation;if(!Jd(r)||!Array.isArray(r.ownedParcelIds)||!Array.isArray(r.surfaceRuns))return{save:null,warnings:[`That park is missing its land.`]};if(!Jd(i)||!Jd(i.stats))return{save:null,warnings:[`That park is missing its accounts.`]};let a=Array.isArray(n.buildings)?n.buildings:[],o=[],s=0;for(let e of a)if(Jd(e)){if(typeof e.kind!=`string`||!ru.has(e.kind)){s+=1;continue}!qd(e.x)||!qd(e.z)||o.push({id:typeof e.id==`string`&&e.id?e.id:`restored-${o.length+1}`,kind:e.kind,x:e.x,z:e.z,rotation:qd(e.rotation)?e.rotation:0})}s>0&&t.push(`${s} building${s===1?``:`s`} from an older version could not be rebuilt.`);let c=Jd(n.player)?n.player:{};return{save:{format:Kd,version:1,savedAt:qd(n.savedAt)?n.savedAt:0,parkName:typeof n.parkName==`string`&&n.parkName?n.parkName:`My Park`,started:n.started===!0,grid:{ownedParcelIds:r.ownedParcelIds.filter(e=>typeof e==`string`),surfaceRuns:r.surfaceRuns.filter(qd)},simulation:i,buildings:o,player:{x:qd(c.x)?c.x:0,z:qd(c.z)?c.z:18.5}},warnings:t}}var Zd=`parkworks-tycoon`,Qd=`parkworks-tycoon.save.v1`,$d=class{name=`local`;label=`this device`;static isAvailable(){try{let e=`__parkworks_probe__`;return window.localStorage.setItem(e,`1`),window.localStorage.removeItem(e),!0}catch{return!1}}async load(){try{return window.localStorage.getItem(Qd)}catch{return null}}async save(e){window.localStorage.setItem(Qd,e)}async clear(){try{window.localStorage.removeItem(Qd)}catch{}}},ef=class{name=`memory`;label=`this session only`;held=null;async load(){return this.held}async save(e){this.held=e}async clear(){this.held=null}};function tf(e){if(typeof e!=`object`||!e)return!1;let t=e;return typeof t.load==`function`&&typeof t.save==`function`&&typeof t.clear==`function`}function nf(e=globalThis.HeartbeatObservatory){try{let t=e?.createSaveBackend?.(Zd);if(tf(t))return t}catch{}return $d.isAvailable()?new $d:new ef}function rf(e,t,n,r=.1){let i=t.x-e.x,a=t.y-e.y,o=Math.hypot(i,a),s=Math.min(1,o/Math.max(1,n));if(s<=r||o===0)return{x:0,y:0,distance:0};let c=(s-r)/(1-r);return{x:i/o*c,y:a/o*c,distance:c}}var af=16,of=300,sf=3,cf=2;function lf(e){return Number.isFinite(e)?Math.max(-2,Math.min(cf,e)):0}function uf(e,t,n){return lf(e*(t===1?af:t===2?Math.max(1,n):1)/of)}function df(e,t){return Math.hypot(t.x-e.x,t.y-e.y)}function ff(e,t){return e<=0||t<=0?0:lf(Math.log(e/t)*sf)}var pf=class{element;joystick;pressedKeys=new Set;move={x:0,y:0,magnitude:0};lookDelta={x:0,y:0};joystickOrigin={x:0,y:0};touchPointers=new Map;movementPointerId=null;lookPointerId=null;pinchDistance=null;lastLookX=0;lastLookY=0;zoomDelta=0;enabled=!0;zoomEnabled=!1;maxJoystickRadius=56;constructor(e,t){this.element=e,this.joystick=t,this.bindEvents()}setEnabled(e){this.enabled=e,e||this.reset()}setZoomEnabled(e){this.zoomEnabled!==e&&(this.zoomEnabled=e,this.releaseMovement(),this.lookPointerId=null,this.lookDelta.x=0,this.lookDelta.y=0,this.touchPointers.clear(),this.pinchDistance=null,this.zoomDelta=0)}getMovement(){if(!this.enabled)return{x:0,y:0,magnitude:0};let e=Number(this.pressedKeys.has(`KeyD`)||this.pressedKeys.has(`ArrowRight`))-Number(this.pressedKeys.has(`KeyA`)||this.pressedKeys.has(`ArrowLeft`)),t=Number(this.pressedKeys.has(`KeyW`)||this.pressedKeys.has(`ArrowUp`))-Number(this.pressedKeys.has(`KeyS`)||this.pressedKeys.has(`ArrowDown`));if(e!==0||t!==0){let n=Math.hypot(e,t);return{x:e/n,y:t/n,magnitude:1}}return{...this.move}}consumeLookDelta(){let e={...this.lookDelta};return this.lookDelta.x=0,this.lookDelta.y=0,e}consumeZoomDelta(){if(!this.enabled||!this.zoomEnabled)return 0;let e=this.zoomDelta;return this.zoomDelta=0,e}isSprinting(){return this.pressedKeys.has(`ShiftLeft`)||this.pressedKeys.has(`ShiftRight`)}dispose(){window.removeEventListener(`keydown`,this.onKeyDown),window.removeEventListener(`keyup`,this.onKeyUp),window.removeEventListener(`blur`,this.onResetEvent),document.removeEventListener(`visibilitychange`,this.onVisibilityChange),window.removeEventListener(`orientationchange`,this.onResetEvent),this.element.removeEventListener(`pointerdown`,this.onPointerDown),this.element.removeEventListener(`pointermove`,this.onPointerMove),this.element.removeEventListener(`pointerup`,this.onPointerUp),this.element.removeEventListener(`pointercancel`,this.onPointerUp),this.element.removeEventListener(`wheel`,this.onWheel)}bindEvents(){window.addEventListener(`keydown`,this.onKeyDown,{passive:!1}),window.addEventListener(`keyup`,this.onKeyUp),window.addEventListener(`blur`,this.onResetEvent),document.addEventListener(`visibilitychange`,this.onVisibilityChange),window.addEventListener(`orientationchange`,this.onResetEvent),this.element.addEventListener(`pointerdown`,this.onPointerDown),this.element.addEventListener(`pointermove`,this.onPointerMove),this.element.addEventListener(`pointerup`,this.onPointerUp),this.element.addEventListener(`pointercancel`,this.onPointerUp),this.element.addEventListener(`wheel`,this.onWheel,{passive:!1})}onKeyDown=e=>{!this.enabled||this.isUiTarget(e.target)||((e.code.startsWith(`Arrow`)||e.code===`Space`)&&e.preventDefault(),this.pressedKeys.add(e.code))};onKeyUp=e=>{this.pressedKeys.delete(e.code)};onPointerDown=e=>{if(!this.enabled||this.isUiTarget(e.target))return;let t=(window.matchMedia(`(pointer: coarse)`).matches||e.pointerType===`touch`)&&e.clientX<window.innerWidth*.5;try{this.element.setPointerCapture(e.pointerId)}catch{}if(this.zoomEnabled&&e.pointerType===`touch`&&(this.touchPointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this.touchPointers.size>=2)){e.preventDefault(),this.beginPinch();return}if(t&&this.movementPointerId===null){e.preventDefault(),this.movementPointerId=e.pointerId,this.joystickOrigin.x=e.clientX,this.joystickOrigin.y=e.clientY,this.maxJoystickRadius=Math.max(48,Math.min(64,window.innerWidth*.11)),this.joystick.style.left=`${e.clientX}px`,this.joystick.style.top=`${e.clientY}px`,this.joystick.style.setProperty(`--knob-x`,`0px`),this.joystick.style.setProperty(`--knob-y`,`0px`),this.joystick.classList.add(`is-active`),this.joystick.setAttribute(`aria-hidden`,`false`);return}this.lookPointerId===null&&(this.lookPointerId=e.pointerId,this.lastLookX=e.clientX,this.lastLookY=e.clientY)};onPointerMove=e=>{if(this.zoomEnabled&&e.pointerType===`touch`&&this.touchPointers.has(e.pointerId)&&(this.touchPointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this.pinchDistance!==null)){e.preventDefault();let t=this.currentPinchDistance();t!==null&&(this.zoomDelta+=ff(this.pinchDistance,t),this.pinchDistance=t);return}if(e.pointerId===this.movementPointerId){e.preventDefault();let t=rf(this.joystickOrigin,{x:e.clientX,y:e.clientY},this.maxJoystickRadius,.1);this.move.x=t.x,this.move.y=-t.y,this.move.magnitude=t.distance;let n=e.clientX-this.joystickOrigin.x,r=e.clientY-this.joystickOrigin.y,i=Math.hypot(n,r),a=i>this.maxJoystickRadius?this.maxJoystickRadius/i:1;this.joystick.style.setProperty(`--knob-x`,`${n*a}px`),this.joystick.style.setProperty(`--knob-y`,`${r*a}px`);return}e.pointerId===this.lookPointerId&&(this.lookDelta.x+=e.clientX-this.lastLookX,this.lookDelta.y+=e.clientY-this.lastLookY,this.lastLookX=e.clientX,this.lastLookY=e.clientY)};onPointerUp=e=>{if(this.zoomEnabled&&e.pointerType===`touch`&&(this.touchPointers.delete(e.pointerId),this.pinchDistance!==null)){let e=this.currentPinchDistance();this.pinchDistance=e,e===null&&(this.releaseMovement(),this.lookPointerId=null);return}e.pointerId===this.movementPointerId&&this.releaseMovement(),e.pointerId===this.lookPointerId&&(this.lookPointerId=null)};onWheel=e=>{!this.enabled||!this.zoomEnabled||this.isUiTarget(e.target)||(e.preventDefault(),this.zoomDelta+=uf(e.deltaY,e.deltaMode,window.innerHeight))};onResetEvent=()=>this.reset();onVisibilityChange=()=>{document.hidden&&this.reset()};reset(){this.pressedKeys.clear(),this.releaseMovement(),this.lookPointerId=null,this.lookDelta.x=0,this.lookDelta.y=0,this.touchPointers.clear(),this.pinchDistance=null,this.zoomDelta=0}beginPinch(){this.releaseMovement(),this.lookPointerId=null,this.lookDelta.x=0,this.lookDelta.y=0,this.pinchDistance=this.currentPinchDistance()}currentPinchDistance(){let e=[...this.touchPointers.values()],t=e[0],n=e[1];return t&&n?df(t,n):null}releaseMovement(){this.movementPointerId=null,this.move.x=0,this.move.y=0,this.move.magnitude=0,this.joystick.classList.remove(`is-active`),this.joystick.setAttribute(`aria-hidden`,`true`),this.joystick.style.setProperty(`--knob-x`,`0px`),this.joystick.style.setProperty(`--knob-y`,`0px`)}isUiTarget(e){return e instanceof Element&&e.closest(`[data-ui]`)!==null}};function mf(e,t,n){let r=-Math.sin(n),i=-Math.cos(n),a=-i,o=r,s=a*e+r*t,c=o*e+i*t,l=Math.hypot(s,c);return l===0?{x:0,z:0}:{x:s/l,z:c/l}}var hf=new H;function gf(e,t,n,r,i,a){let o=2*Math.PI*i/4,s=Math.max(a-2*i,0),c=Math.PI/4;hf.copy(t),hf[r]=0,hf.normalize();let l=.5*o/(o+s),u=1-hf.angleTo(e)/c;return Math.sign(hf[n])===1?u*l:s/(o+s)+l+l*(1-u)}var _f=class e extends Fi{constructor(e=1,t=1,n=1,r=2,i=.1){let a=r*2+1;if(i=Math.min(e/2,t/2,n/2,i),super(1,1,1,a,a,a),this.type=`RoundedBoxGeometry`,this.parameters={width:e,height:t,depth:n,segments:r,radius:i},a===1)return;let o=this.toNonIndexed();this.index=null,this.attributes.position=o.attributes.position,this.attributes.normal=o.attributes.normal,this.attributes.uv=o.attributes.uv;let s=new H,c=new H,l=new H(e,t,n).divideScalar(2).subScalar(i),u=this.attributes.position.array,d=this.attributes.normal.array,f=this.attributes.uv.array,p=u.length/6,m=new H,h=.5/a;for(let r=0,a=0;r<u.length;r+=3,a+=2)switch(s.fromArray(u,r),c.copy(s),c.x-=Math.sign(c.x)*h,c.y-=Math.sign(c.y)*h,c.z-=Math.sign(c.z)*h,c.normalize(),u[r+0]=l.x*Math.sign(s.x)+c.x*i,u[r+1]=l.y*Math.sign(s.y)+c.y*i,u[r+2]=l.z*Math.sign(s.z)+c.z*i,d[r+0]=c.x,d[r+1]=c.y,d[r+2]=c.z,Math.floor(r/p)){case 0:m.set(1,0,0),f[a+0]=gf(m,c,`z`,`y`,i,n),f[a+1]=1-gf(m,c,`y`,`z`,i,t);break;case 1:m.set(-1,0,0),f[a+0]=1-gf(m,c,`z`,`y`,i,n),f[a+1]=1-gf(m,c,`y`,`z`,i,t);break;case 2:m.set(0,1,0),f[a+0]=1-gf(m,c,`x`,`z`,i,e),f[a+1]=gf(m,c,`z`,`x`,i,n);break;case 3:m.set(0,-1,0),f[a+0]=1-gf(m,c,`x`,`z`,i,e),f[a+1]=1-gf(m,c,`z`,`x`,i,n);break;case 4:m.set(0,0,1),f[a+0]=1-gf(m,c,`x`,`y`,i,e),f[a+1]=1-gf(m,c,`y`,`x`,i,t);break;case 5:m.set(0,0,-1),f[a+0]=gf(m,c,`x`,`y`,i,e),f[a+1]=1-gf(m,c,`y`,`x`,i,t)}}static fromJSON(t){return new e(t.width,t.height,t.depth,t.segments,t.radius)}},vf=new H(0,1,0),yf=new H,bf=new H,xf=new Ot;function Sf(e,t,n){n.texelScale&&Of(e,n.texelScale),kf(e);let r=new K(e,t);return n.name&&(r.name=n.name),n.position&&r.position.set(...n.position),n.rotation&&r.rotation.set(...n.rotation),r.castShadow=n.castShadow??!1,r.receiveShadow=n.receiveShadow??!1,r}function Cf(e,t,n,r,i,a={},o=2){let s=Math.max(.002,Math.min(r,Math.min(e,t,n)*.48));return Sf(new _f(e,t,n,Math.max(1,o),s),i,a)}function wf(e,t,n,r,i,a={}){return Sf(new Ii(e,t,n,Math.max(6,r),1,!1),i,a)}function Tf(e,t,n={},r=12,i=8){return Sf(new ma(e,Math.max(8,r),Math.max(6,i)),t,n)}function Ef(e,t,n,r={}){let i=new pa(e,t),a=i.getAttribute(`position`),o=i.getAttribute(`uv`),s=r.texelScale??1;for(let e=0;e<a.count;e+=1)o.setXY(e,a.getX(e)/s,a.getY(e)/s);o.needsUpdate=!0;let{texelScale:c,...l}=r;return Sf(i,n,l)}function Df(e,t,n,r,i=8,a={}){yf.subVectors(t,e);let o=Math.max(1e-4,yf.length());bf.addVectors(e,t).multiplyScalar(.5),xf.setFromUnitVectors(vf,yf.normalize());let s=wf(n,n,o,i,r,a);return s.position.copy(bf),s.quaternion.copy(xf),s}function Of(e,t=1){let n=e.getAttribute(`position`),r=e.getAttribute(`normal`);if(!n||!r)return;let i=1/Math.max(.001,t),a=new Float32Array(n.count*2);for(let e=0;e<n.count;e+=1){let t=n.getX(e),o=n.getY(e),s=n.getZ(e),c=Math.abs(r.getX(e)),l=Math.abs(r.getY(e)),u=Math.abs(r.getZ(e)),d,f;l>=c&&l>=u?(d=t,f=s):c>=u?(d=s,f=o):(d=t,f=o),a[e*2]=d*i,a[e*2+1]=f*i}e.setAttribute(`uv`,new pr(a,2))}function kf(e){let t=e.getAttribute(`uv`);t&&(e.getAttribute(`uv1`)||e.setAttribute(`uv1`,t.clone()),e.getAttribute(`uv2`)||e.setAttribute(`uv2`,t.clone()))}function Af(e,t,n=0){return new H(Math.sin(t)*e,n,Math.cos(t)*e)}var jf=64;function Mf(e,t=0,n=1){return Math.max(t,Math.min(n,e))}function Nf(e){return e*e*(3-2*e)}function Pf(e,t,n){let r=Math.imul(t+e*17,73244475)^Math.imul(n-e*29,295559667);return r=Math.imul(r^r>>>16,73244475),r=Math.imul(r^r>>>16,73244475),((r^r>>>16)>>>0)/4294967295}function Ff(e,t,n,r){let i=Math.floor(t),a=Math.floor(n),o=Nf(t-i),s=Nf(n-a),c=e=>(e%r+r)%r,l=Pf(e,c(i),c(a)),u=Pf(e,c(i+1),c(a)),d=Pf(e,c(i),c(a+1)),f=Pf(e,c(i+1),c(a+1)),p=l+(u-l)*o;return p+(d+(f-d)*o-p)*s}function If(e,t,n){let r=0,i=0,a=.58;for(let o=0;o<4;o+=1){let s=2**(o+1);r+=Ff(e+o*97,t*s,n*s,s)*a,i+=a,a*=.48}return r/i}function Lf(t,n,r){let i=new $r(t,n,n,w,l);return i.wrapS=e,i.wrapT=e,i.magFilter=o,i.minFilter=c,i.generateMipmaps=!0,i.anisotropy=1,r&&(i.colorSpace=ze),i.needsUpdate=!0,i}function Rf(e,t,n,r){let i=new G(e),a=new Uint8Array(r*r*4);for(let e=0;e<r;e+=1)for(let o=0;o<r;o+=1){let s=If(n,o/r,e/r)-.5,c=Pf(n+509,o,e)-.5,l=Pf(n+911,o,e)>.985?-t*.75:0,u=1+s*t*1.35+c*t*.28+l,d=(e*r+o)*4;a[d]=Math.round(Mf(i.r*u)*255),a[d+1]=Math.round(Mf(i.g*u)*255),a[d+2]=Math.round(Mf(i.b*u)*255),a[d+3]=255}return Lf(a,r,!0)}function zf(e){let n=new Uint8Array(e*e*4),r=(e-1)/2;for(let t=0;t<e;t+=1)for(let i=0;i<e;i+=1){let a=Mf(1-Math.hypot(i-r,t-r)/r),o=Math.round(a*a*255),s=(t*e+i)*4;n[s]=o,n[s+1]=Math.round(o*.82),n[s+2]=Math.round(o*.52),n[s+3]=255}let i=Lf(n,e,!0);return i.wrapS=t,i.wrapT=t,i}function Bf(e,t,n,r){let i=new Uint8Array(r*r*4);for(let a=0;a<r;a+=1)for(let o=0;o<r;o+=1){let s=If(n,o/r,a/r)-.5,c=Pf(n+313,o,a)-.5,l=Math.round(Mf(e+s*t+c*t*.24)*255),u=(a*r+o)*4;i[u]=l,i[u+1]=l,i[u+2]=l,i[u+3]=255}return Lf(i,r,!1)}var Vf=class{materialMap=new Map;lightPoolMaterial;ownedTextures=new Set;generatedGround=new Map;tintCache=new Map;textureSize;maxAnisotropy;ready;constructor(e={}){this.textureSize=Math.max(32,Math.min(128,e.proceduralTextureSize??jf)),this.maxAnisotropy=e.renderer?Math.min(8,e.renderer.capabilities.getMaxAnisotropy()):4,this.addSurface(`grass`,{color:4680507,roughness:.96,colorVariation:.28,roughnessVariation:.12,bumpScale:.065,seed:11}),this.addSurface(`soil`,{color:5914412,roughness:.97,colorVariation:.3,roughnessVariation:.11,bumpScale:.075,seed:23}),this.addSurface(`path`,{color:11703404,roughness:.9,colorVariation:.22,roughnessVariation:.14,bumpScale:.045,seed:37}),this.addSurface(`concrete`,{color:12038822,roughness:.86,colorVariation:.13,roughnessVariation:.1,bumpScale:.025,seed:41}),this.addSurface(`concreteDark`,{color:5922656,roughness:.82,colorVariation:.11,roughnessVariation:.1,bumpScale:.022,seed:43}),this.addSurface(`brick`,{color:9128251,roughness:.89,colorVariation:.16,roughnessVariation:.09,bumpScale:.03,seed:47}),this.addSurface(`porcelain`,{color:15065816,roughness:.28,colorVariation:.02,roughnessVariation:.04,bumpScale:.002,clearcoat:.2,clearcoatRoughness:.18,seed:53}),this.addPaint(`paintCream`,15849637,59),this.addPaint(`paintWhite`,15657439,61),this.addPaint(`paintRed`,12074808,67),this.addPaint(`paintYellow`,14855482,71),this.addPaint(`paintTeal`,3110775,73),this.addPaint(`paintBlue`,3234949,79),this.addPaint(`paintGreen`,4159056,83),this.addSurface(`steel`,{color:8752013,roughness:.34,metalness:.86,colorVariation:.06,roughnessVariation:.16,bumpScale:.008,seed:89}),this.addSurface(`steelDark`,{color:2370350,roughness:.43,metalness:.72,colorVariation:.08,roughnessVariation:.15,bumpScale:.009,seed:97}),this.addSurface(`galvanized`,{color:11186350,roughness:.48,metalness:.72,colorVariation:.1,roughnessVariation:.18,bumpScale:.012,seed:101}),this.addSurface(`copper`,{color:10443835,roughness:.4,metalness:.79,colorVariation:.13,roughnessVariation:.14,bumpScale:.008,seed:103}),this.addSurface(`brass`,{color:12028470,roughness:.31,metalness:.82,colorVariation:.09,roughnessVariation:.12,bumpScale:.006,seed:107}),this.addSurface(`rubber`,{color:1579804,roughness:.91,colorVariation:.07,roughnessVariation:.08,bumpScale:.014,seed:109}),this.addSurface(`timber`,{color:9659708,roughness:.72,colorVariation:.18,roughnessVariation:.13,bumpScale:.025,seed:113}),this.addSurface(`timberDark`,{color:5257252,roughness:.78,colorVariation:.15,roughnessVariation:.12,bumpScale:.024,seed:127}),this.addSurface(`bark`,{color:5060908,roughness:.98,colorVariation:.27,roughnessVariation:.09,bumpScale:.07,seed:131}),this.addSurface(`leaf`,{color:3235639,roughness:.81,colorVariation:.2,roughnessVariation:.08,bumpScale:.012,seed:137}),this.addSurface(`leafLight`,{color:5866056,roughness:.8,colorVariation:.2,roughnessVariation:.08,bumpScale:.012,seed:139}),this.addSurface(`paper`,{color:14867920,roughness:.89,colorVariation:.08,roughnessVariation:.05,bumpScale:.004,seed:149}),this.addSurface(`cardboard`,{color:10975305,roughness:.94,colorVariation:.13,roughnessVariation:.08,bumpScale:.012,seed:151});let t=new Oa({name:`parkworks/glass`,color:11456981,metalness:0,roughness:.09,transparent:!0,opacity:.42,depthWrite:!1,clearcoat:.8,clearcoatRoughness:.08});this.materialMap.set(`glass`,t);let n=new Da({name:`parkworks/lamp-glow`,color:16769952,emissive:16761947,emissiveIntensity:2.1,roughness:.35,metalness:0,toneMapped:!0});this.materialMap.set(`lampGlow`,n);let r=new zr({name:`parkworks/light-pool`,map:zf(64),transparent:!0,opacity:0,depthWrite:!1,blending:2,toneMapped:!0});this.lightPoolMaterial=r;for(let e of[`grass`,`soil`,`path`]){let t=this.get(e);this.generatedGround.set(e,{color:t.map,normal:t.normalMap,roughness:t.roughnessMap,ambientOcclusion:t.aoMap,displacement:t.displacementMap,metersPerRepeat:e===`grass`?[1.25,1.25]:[.9,.9]}),this.setGroundMaps(e,null)}if(e.groundMaps)for(let t of[`grass`,`soil`,`path`]){let n=e.groundMaps[t];n&&this.setGroundMaps(t,n)}this.ready=e.loadBundledCc0===!1||typeof document>`u`?Promise.resolve():this.loadBundledCc0Textures(e.textureAssetBaseUrl??`./assets/textures`)}get(e){let t=this.materialMap.get(e);if(!t)throw Error(`Unknown Parkworks material: ${e}`);return t}paint(e,t=.47){let n=new G(e),r=`${n.getHexString()}:${t.toFixed(3)}`,i=this.tintCache.get(r);if(i)return i;let a=this.createSurface({color:n.getHex(),roughness:t,metalness:.035,colorVariation:.045,roughnessVariation:.08,bumpScale:.004,seed:parseInt(n.getHexString(),16)^1346458187,clearcoat:.08,clearcoatRoughness:.42});return a.name=`parkworks/custom-paint-${n.getHexString()}`,this.tintCache.set(r,a),a}setGroundMaps(e,t){let n=this.get(e),r=this.generatedGround.get(e);if(!r)return;let i=t??{};n.map=i.color===void 0?r.color:i.color,n.normalMap=i.normal===void 0?r.normal:i.normal,n.roughnessMap=i.roughness===void 0?r.roughness:i.roughness,n.aoMap=i.ambientOcclusion===void 0?r.ambientOcclusion:i.ambientOcclusion,n.displacementMap=i.displacement===void 0?r.displacement:i.displacement;let a=this.resolveTileSize(i.metersPerRepeat??r.metersPerRepeat);for(let e of[n.map,n.normalMap,n.roughnessMap,n.aoMap,n.displacementMap])e&&this.prepareExternalTexture(e,e===n.map,a);n.userData.metersPerRepeat=a,n.needsUpdate=!0}getGroundMetersPerRepeat(e){let t=this.get(e).userData.metersPerRepeat;return Array.isArray(t)&&typeof t[0]==`number`&&typeof t[1]==`number`?[t[0],t[1]]:this.generatedGround.get(e)?.metersPerRepeat??[1,1]}async loadBundledCc0Textures(e=`./assets/textures`){let t=new Za;await Promise.allSettled([{id:`Grass005`,key:`grass`,meters:[2,2]},{id:`Concrete034`,key:`concrete`,meters:[1.1,.55],requiresAo:!1},{id:`PavingStones138`,key:`path`,meters:[1.25,2.5]},{id:`Bark014`,key:`bark`,meters:[1.2,1.2]},{id:`Planks037A`,key:`timber`,meters:[2,2]}].map(async({id:n,key:r,meters:i,requiresAo:a=!0})=>{let o=`${e.replace(/\/$/,``)}/${n}/${n}`,[s,c,l]=await Promise.all([t.loadAsync(`${o}_color.webp`),t.loadAsync(`${o}_normal.webp`),t.loadAsync(`${o}_roughness.webp`)]),u=a?await t.loadAsync(`${o}_ao.webp`):null;for(let e of[s,c,l,u])e&&this.ownedTextures.add(e);this.applySurfaceMaps(r,{color:s,normal:c,roughness:l,ambientOcclusion:u},i)}))}getLightPoolMaterial(){return this.lightPoolMaterial}setLampGlow(e){let t=Mf(e),n=this.materialMap.get(`lampGlow`);n&&(n.emissiveIntensity=.34+t*3.1),this.lightPoolMaterial.opacity=t*.85}dispose(){this.lightPoolMaterial.map?.dispose(),this.lightPoolMaterial.dispose();for(let e of this.materialMap.values())e.dispose();for(let e of this.tintCache.values())e.dispose();for(let e of this.ownedTextures)e.dispose();this.materialMap.clear(),this.tintCache.clear(),this.ownedTextures.clear()}addPaint(e,t,n){this.addSurface(e,{color:t,roughness:.47,metalness:.035,colorVariation:.055,roughnessVariation:.1,bumpScale:.005,clearcoat:.1,clearcoatRoughness:.38,seed:n})}addSurface(e,t){let n=this.createSurface(t);n.name=`parkworks/${e}`,this.materialMap.set(e,n)}createSurface(e){let t=Rf(e.color,e.colorVariation??.06,e.seed,this.textureSize),n=Bf(.9,e.roughnessVariation??.08,e.seed+1003,this.textureSize),r=Bf(.5,.42,e.seed+2003,this.textureSize);for(let e of[t,n,r])e.anisotropy=this.maxAnisotropy,this.ownedTextures.add(e);let i=e.clearcoat!==void 0,a={color:16777215,map:t,roughness:e.roughness,roughnessMap:n,metalness:e.metalness??0,bumpMap:r,bumpScale:e.bumpScale??.008,emissive:e.emissive??0,emissiveIntensity:e.emissiveIntensity??0};return i?new Oa({...a,clearcoat:e.clearcoat,clearcoatRoughness:e.clearcoatRoughness??.4}):new Da(a)}applySurfaceMaps(e,t,n){let r=this.get(e);r.map=t.color,r.normalMap=t.normal,r.roughnessMap=t.roughness,r.aoMap=t.ambientOcclusion;for(let e of[r.map,r.normalMap,r.roughnessMap,r.aoMap])e&&this.prepareExternalTexture(e,e===r.map,n);r.userData.metersPerRepeat=n,r.needsUpdate=!0}resolveTileSize(e){return typeof e==`number`?[Math.max(.01,e),Math.max(.01,e)]:[Math.max(.01,e[0]),Math.max(.01,e[1])]}prepareExternalTexture(t,n,r){t.wrapS=e,t.wrapT=e,t.repeat.set(1/r[0],1/r[1]),t.anisotropy=this.maxAnisotropy,n&&(t.colorSpace=ze),t.needsUpdate=!0}},Y=[0,0,0],Hf=new H(0,1,0),Uf=[3234949,12077628,4617810,13670968,7754636,2587517,10115428,5661548],Wf=[2503227,4799284,3029811,4012881],Gf=[1578e4,14395263,12222299,8803644,6043690],Kf=[2957596,5912614,10119991,1381911,7034181];function X(e,t,n,r,i,a=.045,o=Y,s=!0,c=!0){let l=Cf(t[0],t[1],t[2],a,r,{name:i,position:n,rotation:o,castShadow:s,receiveShadow:c,texelScale:1});return e.add(l),l}function Z(e,t,n,r,i,a,o,s=Y,c=10,l=!0,u=!0){let d=wf(t,n,r,c,a,{name:o,position:i,rotation:s,castShadow:l,receiveShadow:u,texelScale:1});return e.add(d),d}function Q(e,t,n,r,i,a=[1,1,1],o=!0,s=12){let c=Tf(t,r,{name:i,position:n,castShadow:o,receiveShadow:!0,texelScale:1},s,Math.max(6,Math.floor(s*.65)));return c.scale.set(...a),e.add(c),c}function qf(e,t,n,r,i,a,o=Y,s=48,c=!0){let l=new ha(t,n,8,s);Of(l,1),kf(l);let u=new K(l,i);return u.name=a,u.position.set(...r),u.rotation.set(...o),u.castShadow=c,u.receiveShadow=!0,e.add(u),u}function $(e,t,n,r,i,a,o=!0){let s=Df(new H(...t),new H(...n),r,i,8,{name:a,castShadow:o,receiveShadow:!0,texelScale:1});return e.add(s),s}function Jf(e,t,n,r=[Math.PI/2,0,0],i=.035){return Z(e,i,i,.035,t,n,`fastener`,r,8,!1,!1)}function Yf(e,t,n,r,i,a){for(let o=1;o<i;o+=1)X(e,[.018,1.05,.024],[-t/2+t/i*o,n,r],a,`panel seam`,.006,Y,!1,!1)}function Xf(e,t){let n=new Tn;return n.name=e,n.userData.assetType=t,n.userData.forward=`+z`,n}function Zf(e,t,n,r,i=new H(1,1,1)){let a=new Xt().compose(n,r,i);e.setMatrixAt(t,a)}function Qf(e){throw Error(`Unhandled placeable kind: ${String(e)}`)}var $f=class{materials;quality;ownsMaterials;animationHooks=new WeakMap;signMaterials=new Map;signTextures=new Set;constructor(e={}){e instanceof Vf?(this.materials=e,this.quality=`mobile`,this.ownsMaterials=!1):(this.materials=e.materials??new Vf,this.quality=e.quality??`mobile`,this.ownsMaterials=!e.materials)}createPlaceable(e){let t;switch(e){case`burger-kiosk`:t=this.createBurgerKiosk();break;case`lemonade-stand`:t=this.createLemonadeStand();break;case`ice-cream-cart`:t=this.createIceCreamCart();break;case`pizza-kitchen`:t=this.createPizzaKitchen();break;case`carousel`:t=this.createCarousel();break;case`sky-wheel`:t=this.createSkyWheel();break;case`bumper-cars`:t=this.createBumperCars();break;case`drop-tower`:t=this.createDropTower();break;case`pirate-ship`:t=this.createPirateShip();break;case`mini-railway`:t=this.createMiniRailway();break;case`meteor-coaster`:t=this.createMeteorCoaster();break;case`restroom`:t=this.createRestroom();break;case`first-aid`:t=this.createFirstAid();break;case`information-booth`:t=this.createInformationBooth();break;case`cash-machine`:t=this.createCashMachine();break;case`maintenance-hut`:t=this.createMaintenanceHut();break;case`trash-bin`:t=this.createTrashBin();break;case`bench`:t=this.createBench();break;case`park-lamp`:t=this.createParkLamp();break;case`shade-tree`:t=this.createShadeTree();break;case`tiered-fountain`:t=this.createTieredFountain();break;case`blossom-planter`:t=this.createBlossomPlanter();break;default:t=Qf(e)}let n=su(e);return t.userData.placeableKind=e,t.userData.footprint=[...n.footprint],t.userData.serviceNeed=n.serviceNeed,t.userData.approachOffset=Math.max(...n.footprint)*.54+.65,t}createBurgerKiosk(){let e=Xf(`Copper Bun Kitchen`,`placeable`),t=this.materials.get(`concrete`),n=this.materials.get(`paintCream`),r=this.materials.get(`paintRed`),i=this.materials.get(`steelDark`),a=this.materials.get(`steel`),o=this.materials.get(`galvanized`),s=this.materials.get(`copper`),c=this.materials.get(`lampGlow`);X(e,[4.8,.18,3.8],[0,.09,0],t,`foundation slab`,.07,Y,!1,!0),X(e,[4.35,2.55,.18],[0,1.48,-1.62],n,`rear wall`,.055),X(e,[.2,2.55,3.1],[-2.08,1.48,-.05],n,`left wall frame`,.05),X(e,[.2,2.55,3.1],[2.08,1.48,-.05],n,`right wall frame`,.05),X(e,[4.15,1.18,.22],[0,.78,1.5],r,`service counter front`,.045),Yf(e,4,.78,1.622,5,s),X(e,[4.45,.15,.62],[0,1.42,1.63],a,`stainless counter`,.055),X(e,[4.2,.26,.2],[0,2.72,1.5],n,`service header`,.045),X(e,[4.6,.18,3.6],[0,2.86,-.02],i,`standing seam roof`,.055);for(let t=-2;t<=2;t+=1)X(e,[.035,.045,3.5],[t*.9,2.97,-.02],a,`roof seam`,.01,Y,!1,!1);let l=new Tn;l.name=`mechanically framed awning`,l.position.set(0,2.63,1.9),l.rotation.x=-.12,e.add(l);for(let e=0;e<8;e+=1)X(l,[.56,.075,1],[-2+e*.57,0,0],e%2==0?r:n,`awning fabric panel`,.025,Y,!1,!0);X(l,[4.6,.08,.08],[0,-.02,.47],i,`awning front rail`,.02,Y,!1,!1),$(e,[-2,2.58,1.52],[-2,2.48,2.36],.025,i,`awning stay`,!1),$(e,[2,2.58,1.52],[2,2.48,2.36],.025,i,`awning stay`,!1),X(e,[2.2,.32,.5],[0,2.46,1.62],i,`sign backing`,.05),this.addSign(e,`COPPER BUN`,[2.05,.52],[0,2.5,1.885],9383980,16769966,`BURGERS • FRIES`),X(e,[1.25,.7,.62],[-.86,1.83,-.93],i,`grill chassis`,.035);for(let t=0;t<6;t+=1)X(e,[.035,.025,.5],[-1.36+t*.2,2.19,-.9],a,`grill grate`,.008,Y,!1,!1);X(e,[1.4,.12,.82],[-.85,2.42,-.98],a,`extract hood lip`,.035),$(e,[-1.52,2.35,-1.16],[-1.14,2.7,-1.16],.035,a,`hood taper`,!1),$(e,[-.18,2.35,-1.16],[-.56,2.7,-1.16],.035,a,`hood taper`,!1),Z(e,.16,.16,1,[-.85,3.36,-.93],o,`exhaust stack`,Y,12),Z(e,.28,.18,.16,[-.85,3.9,-.93],o,`rain cap`,Y,12,!1,!0),X(e,[.62,.42,.35],[1.3,1.83,-1.12],s,`warming cabinet`,.04),X(e,[.5,.25,.015],[1.3,1.84,-.935],this.materials.get(`glass`),`warming cabinet glass`,.005,Y,!1,!1),Q(e,.08,[-1.55,2.47,1.44],c,`counter light`,[1,.55,1],!1,10),Q(e,.08,[1.55,2.47,1.44],c,`counter light`,[1,.55,1],!1,10);for(let t of[-1.88,1.88])for(let n of[.34,1.19])Jf(e,[t,n,1.645],a);return e.userData.counterPoints=[[-.8,0,2.2],[.8,0,2.2]],e}createLemonadeStand(){let e=Xf(`Citrus Press`,`placeable`),t=this.materials.get(`concrete`),n=this.materials.get(`paintTeal`),r=this.materials.get(`paintYellow`),i=this.materials.get(`paintCream`),a=this.materials.get(`steelDark`),o=this.materials.get(`timber`),s=this.materials.get(`glass`);X(e,[2.75,.15,2.65],[0,.075,0],t,`stand pad`,.07,Y,!1,!0),X(e,[2.35,1.05,1.55],[0,.72,.08],n,`cabinet carcass`,.07),Yf(e,2.1,.72,.868,3,r),X(e,[2.6,.14,1.85],[0,1.3,.05],o,`butcher block counter`,.05),X(e,[2.45,.56,.16],[0,.75,.94],r,`front fascia`,.035),X(e,[1.9,.38,.05],[0,.74,1.035],n,`front inset panel`,.015,Y,!1,!0);for(let t of[-1.06,1.06])X(e,[.08,2.15,.08],[t,2.22,-.52],a,`canopy post`,.018),X(e,[.08,2.15,.08],[t,2.22,.63],a,`canopy post`,.018),Jf(e,[t,1.2,.99],this.materials.get(`brass`));let c=new Tn;c.name=`striped tensile canopy`,c.position.y=3.25,e.add(c);for(let e=0;e<6;e+=1)X(c,[.48,.09,2.15],[-1.2+e*.48,0,0],e%2==0?r:i,`canopy stripe`,.035,[0,0,(e-2.5)*.012],!1,!0);X(c,[2.95,.1,.08],[0,-.02,1.05],a,`canopy valance rail`,.018,Y,!1,!1),Z(e,.29,.29,.68,[-.55,1.72,.05],s,`drink dispenser tank`,Y,16,!1,!1),Z(e,.31,.31,.06,[-.55,1.39,.05],a,`dispenser base`,Y,12,!1,!0),Z(e,.31,.31,.06,[-.55,2.06,.05],a,`dispenser lid`,Y,12,!1,!0),X(e,[.08,.22,.12],[-.55,1.55,.4],a,`dispenser tap`,.02,Y,!1,!1),X(e,[.62,.43,.7],[.55,1.55,.05],o,`lemon crate`,.035);for(let t=0;t<6;t+=1)Q(e,.11,[.34+t%3*.2,1.79+Math.floor(t/3)*.14,-.1+t%2*.24],r,`lemon`,[1,.92,1],!1,8);Z(e,.34,.34,.055,[0,2.72,.75],r,`citrus medallion`,[Math.PI/2,0,0],20,!1,!0),Z(e,.26,.26,.058,[0,2.72,.785],i,`citrus medallion inset`,[Math.PI/2,0,0],20,!1,!0);for(let t=0;t<8;t+=1){let n=t/8*Math.PI*2;$(e,[0,2.72,.82],[Math.cos(n)*.23,2.72+Math.sin(n)*.23,.82],.012,r,`lemon segment`,!1)}this.addSign(e,`CITRUS PRESS`,[1.75,.38],[0,2.54,.76],2383713,16769637,`FRESH LEMONADE`);for(let t of[-.84,.84])Z(e,.23,.23,.11,[t,.42,-.83],this.materials.get(`rubber`),`cart wheel`,[Math.PI/2,0,0],14),Z(e,.09,.09,.14,[t,.42,-.83],a,`wheel hub`,[Math.PI/2,0,0],10,!1,!0);return e.userData.counterPoints=[[0,0,1.75]],e}createIceCreamCart(){let e=Xf(`Moon Scoop Creamery`,`placeable`),t=this.materials.get(`concrete`),n=this.materials.get(`paintCream`),r=this.materials.get(`paintTeal`),i=this.materials.get(`paintRed`),a=this.materials.get(`steelDark`),o=this.materials.get(`galvanized`),s=this.materials.get(`timber`),c=this.materials.get(`rubber`);X(e,[2.75,.13,2.7],[0,.065,0],t,`cart paving foundation`,.065,Y,!1,!0),X(e,[2.2,1.05,1.38],[0,.88,-.05],n,`insulated freezer cabinet`,.09),X(e,[2,.72,.025],[0,.83,.655],r,`riveted service panel`,.02,Y,!1,!0),Yf(e,1.9,.83,.672,4,o),X(e,[2.32,.12,1.52],[0,1.44,-.04],o,`stainless freezer rim`,.045),X(e,[1.04,.08,1.22],[-.54,1.53,-.05],n,`left freezer lid`,.035,[0,0,-.02]),X(e,[1.04,.08,1.22],[.54,1.53,-.05],n,`right freezer lid`,.035,[0,0,.02]),X(e,[2.28,.16,.52],[0,1.49,.86],s,`service counter`,.045);for(let t of[-.9,.9])Z(e,.29,.29,.13,[t,.48,-.75],c,`pneumatic cart wheel`,[Math.PI/2,0,0],14),Z(e,.1,.1,.17,[t,.48,-.75],o,`wheel hub and axle`,[Math.PI/2,0,0],10,!1,!0),X(e,[.08,2,.08],[t,2.47,-.58],a,`canopy frame post`,.018),X(e,[.08,2,.08],[t,2.47,.58],a,`canopy frame post`,.018),Jf(e,[t,.28,.67],o),Jf(e,[t,1.24,.67],o);$(e,[-.9,3.44,-.58],[.9,3.44,-.58],.035,a,`rear canopy cross rail`,!1),$(e,[-.9,3.44,.58],[.9,3.44,.58],.035,a,`front canopy cross rail`,!1);for(let t=0;t<6;t+=1)X(e,[.43,.09,1.65],[-1.075+t*.43,3.5,0],t%2==0?i:n,`striped canopy panel`,.03,[0,0,(t-2.5)*.013],!1,!0);X(e,[2.65,.09,.08],[0,3.46,.81],a,`canopy valance rail`,.018,Y,!1,!1),this.addSign(e,`MOON SCOOP`,[1.8,.4],[0,2.92,.83],3110775,16770232,`SMALL-BATCH ICE CREAM`);let l=new Li(.24,.6,12);Of(l,1),kf(l);let u=new K(l,this.materials.get(`cardboard`));return u.name=`waffle cone sign sculpture`,u.position.set(0,2.18,.79),u.rotation.z=Math.PI,u.castShadow=!1,e.add(u),Q(e,.25,[0,2.54,.79],this.materials.paint(15905986,.58),`strawberry scoop`,[1,.9,1],!1,10),Q(e,.22,[.08,2.82,.79],n,`vanilla scoop`,[1,.9,1],!1,10),X(e,[.5,.22,.34],[-.72,1.72,.43],i,`compostable cup dispenser`,.035,Y,!1,!0),X(e,[.38,.05,.22],[-.72,1.83,.61],o,`cup dispenser lip`,.012,Y,!1,!1),e.userData.counterPoints=[[0,0,1.75]],e}createPizzaKitchen(){let e=Xf(`Ember Stone Pizzeria`,`placeable`),t=this.materials.get(`concrete`),n=this.materials.get(`brick`),r=this.materials.get(`paintCream`),i=this.materials.get(`paintTeal`),a=this.materials.get(`paintRed`),o=this.materials.get(`steelDark`),s=this.materials.get(`steel`),c=this.materials.get(`copper`),l=this.materials.get(`timber`),u=this.materials.get(`glass`),d=this.materials.get(`lampGlow`);X(e,[5.9,.18,4.85],[0,.09,0],t,`terrace foundation slab`,.07,Y,!1,!0),X(e,[5.5,.5,2.95],[0,.33,-.95],n,`masonry plinth course`,.04),X(e,[5.3,2.3,.2],[0,1.68,-2.32],r,`rear stucco wall`,.045),X(e,[.2,2.3,2.9],[-2.6,1.68,-.95],r,`left stucco wall`,.045),X(e,[.2,2.3,2.9],[2.6,1.68,-.95],r,`right stucco wall`,.045),X(e,[1,2.3,.2],[-2.2,1.68,.42],r,`left service opening pier`,.045),X(e,[1,2.3,.2],[2.2,1.68,.42],r,`right service opening pier`,.045),X(e,[5.3,.52,.2],[0,2.57,.42],r,`service opening lintel`,.045),X(e,[5.5,.1,3.05],[0,.6,-.95],t,`plinth weather course`,.02,Y,!1,!0),X(e,[3.35,.95,.44],[0,1.06,.4],n,`service counter base`,.035),X(e,[3.6,.14,.66],[0,1.6,.46],t,`honed stone counter top`,.04),X(e,[3.3,.52,.022],[0,1.95,.56],u,`counter sneeze guard`,.008,Y,!1,!1);for(let t of[-1.62,1.62])X(e,[.05,.5,.06],[t,1.95,.56],s,`sneeze guard mullion`,.012,Y,!1,!0),Jf(e,[t,1.5,.79],s,Y,.028);Yf(e,3.2,1.06,.63,4,c);let f=new ma(.78,16,10,0,Math.PI*2,0,Math.PI/2);Of(f,1),kf(f);let p=new K(f,n);p.name=`wood fired oven dome`,p.position.set(-1.35,1.02,-1.35),p.scale.set(1,.86,1),p.castShadow=!0,p.receiveShadow=!0,e.add(p),Z(e,.88,.94,.16,[-1.35,.96,-1.35],t,`oven hearth ring`,Y,18),X(e,[.56,.46,.24],[-1.35,1.16,-.62],o,`oven mouth arch`,.12),X(e,[.4,.3,.06],[-1.35,1.14,-.56],d,`oven fire glow`,.04,Y,!1,!1),Z(e,.13,.15,1.35,[-1.35,2.25,-1.35],c,`oven flue`,Y,12),$(e,[-1.9,1.05,-1.35],[-1.35,1.55,-.95],.03,s,`oven peel handle`,!1);for(let t=0;t<8;t+=1)Z(e,.07,.07,.52,[-2.25,.68+Math.floor(t/4)*.15,-1.72+t%4*.16],l,`seasoned firewood`,[0,Math.PI/2,0],7,!1,!0);let m=.3,h=-.95;for(let t of[-1,1])X(e,[5.95,.14,1.52],[0,3.03,h+t*.71],l,`pitched roof deck`,.035,[t*m,0,0]);let g=this.quality===`high`?76:52,_=new Ii(.078,.078,1.48,7,1,!1);Of(_,1),kf(_);let v=new ci(_,c,g);v.name=`instanced terracotta pantile`,v.castShadow=!0,v.receiveShadow=!0;let y=Math.floor(g/2);for(let e=0;e<g;e+=1){let t=e<y?-1:1,n=-2.85+e%y/(y-1)*5.7;Zf(v,e,new H(n,3.03+Math.cos(m)*.11,h+t*.71-t*Math.sin(m)*.11),new Ot().setFromEuler(new sn(Math.PI/2+t*m,0,0)))}v.instanceMatrix.needsUpdate=!0,e.add(v),Z(e,.13,.13,5.95,[0,3.34,h],c,`ridge capping`,[0,0,Math.PI/2],10),Z(e,.075,.075,5.9,[0,2.78,.55],s,`eaves gutter`,[0,0,Math.PI/2],8,!1,!0),X(e,[.1,2.2,.1],[2.72,1.7,.5],s,`rainwater downspout`,.02,Y,!1,!0),X(e,[.68,1.55,.68],[1.5,3.6,-1.75],n,`flue chimney stack`,.04),X(e,[.82,.14,.82],[1.5,4.42,-1.75],t,`chimney capping slab`,.03),Z(e,.16,.2,.3,[1.5,4.62,-1.75],c,`chimney cowl`,Y,12,!1,!0),X(e,[4.1,.12,.95],[0,2.42,1],a,`counter awning deck`,.03,[-.16,0,0]),X(e,[4.2,.1,.09],[0,2.34,1.44],r,`awning front rail`,.02,Y,!1,!1);for(let t of[-1.85,1.85])$(e,[t,2.6,.55],[t,2.4,1.4],.028,o,`awning stay`,!1);for(let t of[-1.05,0,1.05])Z(e,.16,.09,.2,[t,2.28,.28],i,`pendant lamp shade`,Y,12,!1,!0),$(e,[t,2.5,.28],[t,2.32,.28],.012,o,`pendant lamp flex`,!1),Q(e,.065,[t,2.19,.28],d,`pendant lamp bulb`,[1,.9,1],!1,8);X(e,[1.5,.7,.05],[1.6,2,.31],o,`chalk menu board`,.02,Y,!1,!0);for(let t=0;t<4;t+=1)X(e,[1-t*.12,.045,.02],[1.55,2.24-t*.16,.28],r,`menu chalk line`,.006,Y,!1,!1);this.addSign(e,`EMBER STONE`,[2.5,.46],[0,2.57,.53],8138536,16178608,`WOOD FIRED PIZZA`);for(let t of[-1.72,1.72]){Z(e,.09,.16,.72,[t,.45,1.62],o,`terrace table column`,Y,10),Z(e,.44,.44,.07,[t,.84,1.62],l,`terrace table top`,Y,18),Z(e,.34,.34,.05,[t,.11,1.62],s,`table base plate`,Y,14,!1,!0);for(let n of[-.72,.72])Z(e,.2,.2,.07,[t+n,.53,1.62],i,`terrace stool seat`,Y,12),Z(e,.06,.09,.48,[t+n,.27,1.62],o,`terrace stool column`,Y,8)}return e.userData.counterPoints=[[-.7,0,2.15],[.7,0,2.15]],e}createCarousel(){let e=Xf(`Constellation Carousel`,`placeable`),t=this.materials.get(`concrete`),n=this.materials.get(`paintTeal`),r=this.materials.get(`paintRed`),i=this.materials.get(`paintCream`),a=this.materials.get(`brass`),o=this.materials.get(`steelDark`),s=this.materials.get(`lampGlow`),c=this.quality===`high`?40:32;Z(e,4.42,4.42,.22,[0,.11,0],t,`circular foundation`,Y,c,!1,!0),qf(e,4.1,.11,[0,.28,0],a,`platform perimeter trim`,[Math.PI/2,0,0],c,!1);let l=new Tn;l.name=`carousel rotating assembly`,e.add(l),Z(l,4.03,4.03,.2,[0,.33,0],n,`rotating deck`,Y,c),Z(l,.42,.5,4.7,[0,2.68,0],r,`central drive mast`,Y,16),Z(l,.54,.54,.18,[0,.51,0],a,`mast bearing collar`,Y,16),Z(l,.46,.46,.12,[0,4.92,0],a,`upper bearing collar`,Y,16);let u=new Li(4.48,1.5,c,1,!1);Of(u,1),kf(u);let d=new K(u,i);d.name=`tensioned carousel canopy`,d.position.y=4.63,d.castShadow=!0,d.receiveShadow=!0,l.add(d),qf(l,4.43,.095,[0,3.9,0],r,`canopy edge rail`,[Math.PI/2,0,0],c),Z(l,.08,.08,.8,[0,5.75,0],a,`finial stem`,Y,10),Q(l,.18,[0,6.18,0],a,`finial`,[1,1.25,1],!0,12);let f=new Ii(.032,.032,3.1,8),p=new ma(.5,10,7),m=new ma(.5,9,6),h=new Ii(.045,.06,.72,7),g=new _f(.58,.12,.42,1,.05);for(let e of[f,p,m,h,g])Of(e,1),kf(e);let _=new ci(f,a,12),v=new ci(p,i,12),y=new ci(m,i,12),b=new ci(h,i,24),x=new ci(g,r,12);_.name=`instanced brass ride poles`,v.name=`instanced carousel horse bodies`,y.name=`instanced carousel horse heads`,b.name=`instanced carousel horse legs`,x.name=`instanced saddles`,v.castShadow=!0,y.castShadow=!0,x.castShadow=!0;for(let e of[_,v,y,b,x])e.receiveShadow=!0;let S=new Ot,C=new H;for(let e=0;e<12;e+=1){let t=e/12*Math.PI*2,n=e%2==0?.2:-.05;S.setFromEuler(new sn(0,t,0));let r=Af(2.78,t,0);Zf(_,e,new H(r.x,2.24,r.z),new Ot),Zf(v,e,new H(r.x,2+n,r.z),S,new H(1,.58,1.35)),C.set(0,.35,.68).applyQuaternion(S).add(r),C.y+=2+n,Zf(y,e,C,S,new H(.52,.72,.56)),C.set(0,.36,-.06).applyQuaternion(S).add(r),C.y+=2+n,Zf(x,e,C,S);for(let t=0;t<2;t+=1){C.set(t===0?-.25:.25,-.55,t===0?.27:-.25).applyQuaternion(S).add(r),C.y+=2+n;let i=S.clone().multiply(new Ot().setFromEuler(new sn(.15,0,t===0?-.25:.25)));Zf(b,e*2+t,C,i)}}for(let e of[_,v,y,b,x])e.instanceMatrix.needsUpdate=!0,l.add(e);for(let e=0;e<16;e+=1){let t=Af(4.23,e/16*Math.PI*2,3.82);Q(l,.075,[t.x,t.y,t.z],s,`canopy bulb`,[1,1,1],!1,8)}for(let e of[0,Math.PI/2,Math.PI,Math.PI*1.5]){let t=Af(4,e,.62);$(l,[t.x,.62,t.z],[t.x,1.08,t.z],.035,o,`deck guard post`,!1)}return e.userData.operating=!0,this.registerAnimation(e,({delta:t,activity:n})=>{e.userData.operating!==!1&&(l.rotation.y+=t*.34*n)}),e}createSkyWheel(){let e=Xf(`Aurora Sky Wheel`,`placeable`),t=this.materials.get(`concrete`),n=this.materials.get(`steelDark`),r=this.materials.get(`galvanized`),i=this.materials.get(`paintTeal`),a=this.materials.get(`paintRed`),o=this.materials.get(`paintCream`),s=this.materials.get(`brass`),c=this.materials.get(`lampGlow`),l=this.quality===`high`?72:56;X(e,[10.9,.24,5.8],[0,.12,0],t,`reinforced foundation`,.09,Y,!1,!0);for(let i of[-3.85,3.85])for(let a of[-1.35,1.35]){X(e,[1.2,.28,1.1],[i,.35,a],t,`support footing`,.08),X(e,[.56,.12,.56],[i,.56,a],r,`support base plate`,.025);for(let t of[-.2,.2])for(let r of[-.2,.2])Jf(e,[i+t,.64,a+r],n,Y,.045)}let u=5.45;for(let t of[-.58,.58])$(e,[-3.85,.62,t*2.25],[-.58,u,t],.14,n,`left A-frame leg`),$(e,[3.85,.62,t*2.25],[.58,u,t],.14,n,`right A-frame leg`),$(e,[-3,1.88,t*1.8],[3,1.88,t*1.8],.065,r,`lower cross brace`),$(e,[-2.25,3,t*1.45],[2.25,3,t*1.45],.055,r,`middle cross brace`),$(e,[-3.3,1.4,t*1.9],[2.45,3,t*1.45],.045,r,`diagonal lattice brace`,!1),$(e,[3.3,1.4,t*1.9],[-2.45,3,t*1.45],.045,r,`diagonal lattice brace`,!1);let d=new Tn;d.name=`rotating observation wheel`,d.position.y=u,e.add(d);for(let e of[-.32,.32]){qf(d,4.58,.09,[0,0,e],i,`double wheel rim`,Y,l);for(let t=0;t<16;t+=1){let i=t/16*Math.PI*2;$(d,[0,0,e],[Math.cos(i)*4.48,Math.sin(i)*4.48,e],.028,t%2==0?r:n,`tension spoke`,!1)}}Z(d,.34,.34,1.65,[0,0,0],s,`main axle`,[Math.PI/2,0,0],16),Z(d,.53,.53,.22,[0,0,-.48],n,`hub bearing`,[Math.PI/2,0,0],16),Z(d,.53,.53,.22,[0,0,.48],n,`hub bearing`,[Math.PI/2,0,0],16);let f=[];for(let e=0;e<8;e+=1){let t=e/8*Math.PI*2,i=new Tn;i.name=`gondola ${e+1}`,i.position.set(Math.cos(t)*4.55,Math.sin(t)*4.55,0),d.add(i),f.push(i),$(i,[0,.02,-.42],[0,-.62,-.42],.035,s,`gondola hanger`,!1),$(i,[0,.02,.42],[0,-.62,.42],.035,s,`gondola hanger`,!1),X(i,[1.05,.52,.95],[0,-.88,0],e%2==0?a:o,`gondola cabin`,.12),X(i,[1.12,.1,1.02],[0,-.56,0],n,`gondola roof`,.045),X(i,[.72,.28,.018],[0,-.82,.49],this.materials.get(`glass`),`gondola glazing`,.005,Y,!1,!1),X(i,[.78,.06,.06],[0,-.72,.53],s,`gondola safety rail`,.018,Y,!1,!1),Jf(i,[-.44,-.56,0],r,[0,0,Math.PI/2],.035),Jf(i,[.44,-.56,0],r,[0,0,Math.PI/2],.035)}X(e,[3.4,.16,1.65],[0,.42,2],n,`loading platform`,.05),X(e,[3.5,.82,.12],[0,.85,2.76],i,`operator rail panel`,.025);for(let t of[-1.68,-.56,.56,1.68])X(e,[.06,1,.06],[t,.91,2.76],s,`queue rail post`,.015,Y,!1,!0);X(e,[1.55,.82,1],[-4.55,.62,1.6],o,`operator cabinet`,.06),X(e,[1.1,.35,.02],[-4.55,.7,2.11],n,`operator control panel`,.01,Y,!1,!0);for(let t of[-4.9,-4.55,-4.2])Q(e,.055,[t,.77,2.14],t===-4.55?c:a,`control button`,[1,.45,1],!1,8);return this.addSign(e,`AURORA SKY WHEEL`,[3.4,.54],[0,2,2.75],2182754,15980439,`OBSERVATION RIDE`),e.userData.operating=!0,this.registerAnimation(e,({delta:t,activity:n})=>{if(e.userData.operating!==!1){d.rotation.z-=t*.11*n;for(let e of f)e.rotation.z=-d.rotation.z}}),e}createBumperCars(){let e=Xf(`Voltage Bumper Hall`,`placeable`),t=this.materials.get(`concrete`),n=this.materials.get(`concreteDark`),r=this.materials.get(`steelDark`),i=this.materials.get(`galvanized`),a=this.materials.get(`paintTeal`),o=this.materials.get(`paintYellow`),s=this.materials.get(`paintRed`),c=this.materials.get(`paintCream`),l=this.materials.get(`rubber`),u=this.materials.get(`lampGlow`);X(e,[10.7,.2,8.7],[0,.1,0],t,`reinforced pavilion foundation`,.09,Y,!1,!0),X(e,[9.6,.18,7.25],[0,.29,-.2],n,`conductive arena floor`,.075,Y,!1,!0),X(e,[9.8,.38,.26],[0,.54,-3.72],a,`rear impact rail`,.09),X(e,[.26,.38,7.65],[-4.92,.54,-.05],a,`left impact rail`,.09),X(e,[.26,.38,7.65],[4.92,.54,-.05],a,`right impact rail`,.09),X(e,[3.65,.38,.26],[-3.08,.54,3.62],a,`front impact rail left`,.09),X(e,[3.65,.38,.26],[3.08,.54,3.62],a,`front impact rail right`,.09),X(e,[9.88,.08,.08],[0,.73,-3.73],l,`rear replaceable bumper strip`,.025,Y,!1,!0),X(e,[.08,.08,7.6],[-4.93,.73,-.05],l,`left replaceable bumper strip`,.025,Y,!1,!0),X(e,[.08,.08,7.6],[4.93,.73,-.05],l,`right replaceable bumper strip`,.025,Y,!1,!0);for(let[t,n]of[[-4.72,-3.5],[0,-3.5],[4.72,-3.5],[-4.72,3.4],[0,3.4],[4.72,3.4]]){X(e,[.34,4.48,.34],[t,2.55,n],r,`bolted pavilion frame column`,.055),X(e,[.68,.12,.68],[t,.28,n],i,`column base plate`,.025);for(let i of[-.23,.23])for(let a of[-.23,.23])Jf(e,[t+i,.36,n+a],r,Y,.035)}for(let t of[-3.5,3.4])X(e,[9.78,.28,.3],[0,4.77,t],r,`pavilion longitudinal roof beam`,.04),$(e,[-4.55,4.58,t],[-3.8,3.72,t],.055,i,`roof knee brace`),$(e,[4.55,4.58,t],[3.8,3.72,t],.055,i,`roof knee brace`);for(let t of[-4.72,0,4.72])X(e,[.3,.26,7.2],[t,4.76,-.05],r,`pavilion transverse roof beam`,.04);for(let t=0;t<6;t+=1){let n=-4.15+t*1.66;X(e,[1.63,.12,7.3],[n,5+Math.abs(t-2.5)*.025,-.05],t%2==0?c:a,`standing seam canopy panel`,.035,[0,0,(t-2.5)*.014],!1,!0),X(e,[.035,.045,7.18],[n+.81,5.08,-.05],i,`canopy standing seam`,.008,Y,!1,!1)}for(let t=0;t<7;t+=1)X(e,[.025,.025,6.5],[-4.2+t*1.4,4.54,-.05],i,`conductive ceiling grid rail`,.006,Y,!1,!1);for(let t=0;t<6;t+=1)X(e,[8.55,.025,.025],[0,4.53,-3.05+t*1.22],i,`conductive ceiling cross rail`,.006,Y,!1,!1);let d=[[-3.2,-2.25,.2],[-.9,-2.1,1.05],[1.65,-2.25,2.2],[3.35,-.65,2.9],[-2.85,.4,3.7],[-.65,1.1,4.5],[1.75,1.25,5.1],[3.15,2.2,5.85]],f=this.quality===`high`?8:6,p=[];for(let t=0;t<f;t+=1){let n=d[t];if(!n)continue;let[f,m,h]=n,g=new Tn;g.name=`bumper car animation pivot ${t+1}`,g.position.set(f,.48,m),g.rotation.y=h,e.add(g),p.push({group:g,x:f,z:m,phase:h});let _=t%3==0?s:t%3==1?o:a;qf(g,.78,.095,[0,.13,0],l,`perimeter impact bumper`,[Math.PI/2,0,0],24,!1),X(g,[1.28,.34,1.42],[0,.35,.04],_,`pressed bumper car body shell`,.16),X(g,[1.05,.18,.52],[0,.52,.37],r,`moulded two-place seat`,.11),X(g,[1.08,.42,.14],[0,.76,.12],r,`seat back and head restraint`,.07),X(g,[.72,.16,.12],[0,.5,.76],c,`front number panel`,.035,Y,!1,!0),qf(g,.17,.025,[-.28,.82,.52],i,`steering wheel`,[0,0,0],16,!1),$(g,[-.28,.82,.51],[-.28,.63,.45],.025,r,`steering column`,!1);for(let e of[-1,1])Z(g,.11,.11,.08,[e*.5,.18,.55],r,`front wheel hub`,[Math.PI/2,0,0],10,!1,!0),X(g,[.08,.08,.05],[e*.46,.44,.755],u,`bumper car marker lamp`,.018,Y,!1,!1);$(g,[.48,.58,-.35],[.48,3.78,-.35],.025,i,`spring contact antenna`,!1),Q(g,.07,[.48,3.82,-.35],i,`ceiling contact shoe`,[1.5,.45,1],!1,8);for(let e of[-.48,.48])Jf(g,[e,.45,.76],i,Y,.024)}X(e,[1.65,1.05,.82],[-3.95,.84,3.95],c,`operator control enclosure`,.065),X(e,[1.25,.42,.025],[-3.95,1.02,4.38],r,`operator control panel`,.012,Y,!1,!0);for(let t of[-4.3,-3.95,-3.6])Q(e,.05,[t,1.1,4.405],t===-3.95?u:s,`illuminated control button`,[1,.45,1],!1,8);X(e,[2.2,.82,.12],[0,.78,3.84],o,`gated loading rail panel`,.025);for(let t of[-1.08,0,1.08])X(e,[.07,1.05,.07],[t,.85,3.85],r,`loading rail post`,.018,Y,!1,!0);return this.addSign(e,`VOLTAGE`,[3.1,.62],[0,4.32,3.72],2569787,16765778,`BUMPER HALL • 8 CARS`),e.userData.entryPoints=[[0,0,4.7]],e.userData.operating=!0,e.userData.animationPivots=p.map(({group:e})=>e.name),this.registerAnimation(e,({elapsed:t,activity:n})=>{if(e.userData.operating!==!1)for(let[e,r]of p.entries()){let i=.56+e*.037;r.group.position.x=r.x+Math.sin(t*i+r.phase)*.42*n,r.group.position.z=r.z+Math.cos(t*i*.83+r.phase)*.36*n,r.group.rotation.y=r.phase+Math.sin(t*i*.7+e)*.7*n}}),e}createDropTower(){let e=Xf(`Pulse Drop Tower`,`placeable`),t=this.materials.get(`concrete`),n=this.materials.get(`steelDark`),r=this.materials.get(`galvanized`),i=this.materials.get(`paintRed`),a=this.materials.get(`paintTeal`),o=this.materials.get(`paintYellow`),s=this.materials.get(`paintCream`),c=this.materials.get(`lampGlow`);X(e,[7.65,.24,7.65],[0,.12,0],t,`deep tower foundation slab`,.1,Y,!1,!0),X(e,[2.3,.32,2.3],[0,.36,0],t,`mast pedestal`,.1);for(let t of[-.58,.58])for(let i of[-.58,.58]){X(e,[.34,11.65,.34],[t,6.3,i],n,`lattice mast vertical column`,.045),X(e,[.58,.12,.58],[t,.52,i],r,`mast column base plate`,.025);for(let r of[-.18,.18])for(let a of[-.18,.18])Jf(e,[t+r,.6,i+a],n,Y,.032)}for(let t=0;t<6;t+=1){let i=.8+t*1.88,a=i+1.38;$(e,[-.58,i,.58],[.58,a,.58],.045,r,`front mast diagonal brace`,!1),$(e,[.58,i,.58],[-.58,a,.58],.045,r,`front mast cross brace`,!1),$(e,[-.58,i,-.58],[.58,a,-.58],.045,r,`rear mast diagonal brace`,!1),$(e,[.58,i,-.58],[-.58,a,-.58],.045,r,`rear mast cross brace`,!1),$(e,[-.58,i,-.58],[-.58,a,.58],.045,r,`left mast diagonal brace`,!1),$(e,[.58,i,-.58],[.58,a,.58],.045,r,`right mast diagonal brace`,!1),X(e,[1.42,.12,1.42],[0,a+.04,0],n,`mast horizontal tie frame`,.025,Y,!1,!0)}X(e,[.12,11.3,.12],[-.82,6.2,0],r,`left machined carriage guide rail`,.018,Y,!1,!0),X(e,[.12,11.3,.12],[.82,6.2,0],r,`right machined carriage guide rail`,.018,Y,!1,!0);for(let t=1.25;t<11.7;t+=1.25)X(e,[.24,.05,.5],[-.82,t,0],o,`left magnetic brake fin`,.012,Y,!1,!1),X(e,[.24,.05,.5],[.82,t,0],o,`right magnetic brake fin`,.012,Y,!1,!1);X(e,[1.9,.62,1.9],[0,12.42,0],a,`upper drive machinery housing`,.08),X(e,[1.56,.22,1.56],[0,12.83,0],n,`weatherproof drive housing roof`,.05),Z(e,.23,.23,.46,[0,13.18,0],r,`beacon mounting pedestal`,Y,12),Q(e,.19,[0,13.48,0],c,`aviation warning beacon`,[1,.9,1],!1,12),Z(e,.08,.08,10.8,[0,6.78,.78],r,`redundant lift cable`,Y,8,!1,!1);let l=new Tn;l.name=`guided drop carriage animation pivot`,l.position.y=1.52,e.add(l),X(l,[3.55,.24,1.15],[0,0,1.12],n,`front carriage platform frame`,.055),X(l,[3.55,.24,1.15],[0,0,-1.12],n,`rear carriage platform frame`,.055),X(l,[1.15,.24,3.55],[1.12,0,0],n,`right carriage platform frame`,.055),X(l,[1.15,.24,3.55],[-1.12,0,0],n,`left carriage platform frame`,.055),qf(l,1.68,.075,[0,.18,0],a,`carriage perimeter safety rail`,[Math.PI/2,0,0],36,!1);for(let e of[-.62,.62])for(let t of[-1.16,1.16])X(l,[.48,.2,.52],[e,.27,t],i,`drop tower moulded seat base`,.09),X(l,[.48,.78,.16],[e,.7,t-Math.sign(t)*.25],s,`drop tower padded seat back`,.07),$(l,[e-.18,.92,t],[e+.18,.48,t],.035,o,`over shoulder restraint`,!1);for(let e of[-.62,.62])for(let t of[-1.16,1.16])X(l,[.52,.2,.48],[t,.27,e],i,`side drop tower seat base`,.09),X(l,[.16,.78,.48],[t-Math.sign(t)*.25,.7,e],s,`side padded seat back`,.07),$(l,[t,.92,e-.18],[t,.48,e+.18],.035,o,`side over shoulder restraint`,!1);for(let e of[-.9,.9]){X(l,[.25,.52,.42],[e,.28,0],r,`replaceable guide shoe assembly`,.035);for(let t of[.08,.42])Jf(l,[e,t,.23],n,Y,.03)}X(e,[2.1,.18,1.8],[0,.48,2.78],n,`loading platform`,.05),X(e,[2.2,.76,.12],[0,.88,3.55],a,`interlocked loading gate`,.025);for(let t of[-1.05,0,1.05])X(e,[.07,1,.07],[t,.87,3.56],r,`queue gate post`,.018,Y,!1,!0);X(e,[1.45,1,.82],[-2.72,.72,2.82],s,`tower operator console housing`,.06),X(e,[1.05,.35,.025],[-2.72,.88,3.245],n,`tower operator control panel`,.01,Y,!1,!0);for(let t of[-3,-2.72,-2.44])Q(e,.045,[t,.96,3.27],t===-2.72?c:i,`tower control indicator`,[1,.45,1],!1,8);return this.addSign(e,`PULSE DROP`,[2.9,.55],[0,2.18,3.57],2634811,16765778,`13 METRES • MAGNETIC BRAKES`),e.userData.entryPoints=[[0,0,4.4]],e.userData.operating=!0,e.userData.animationPivot=l.name,this.registerAnimation(e,({elapsed:t,activity:n})=>{if(e.userData.operating===!1)return;let r=t*.072%1,i=0;if(r<.58){let e=r/.58;i=e*e*(3-2*e)}else if(r<.7)i=1;else if(r<.79){let e=(r-.7)/.09;i=1-e*e}l.position.y=1.52+i*9.25*n}),e}createPirateShip(){let e=Xf(`Copper Corsair`,`placeable`),t=this.materials.get(`concrete`),n=this.materials.get(`steelDark`),r=this.materials.get(`galvanized`),i=this.materials.get(`copper`),a=this.materials.get(`brass`),o=this.materials.get(`timber`),s=this.materials.get(`timberDark`),c=this.materials.get(`paintRed`),l=this.materials.get(`paintCream`),u=this.materials.get(`paintTeal`),d=this.materials.get(`rubber`),f=this.materials.get(`lampGlow`);X(e,[11.55,.24,7.55],[0,.12,0],t,`reinforced ride foundation`,.1,Y,!1,!0);for(let i of[-3.65,3.65])for(let a of[-1.85,1.85]){X(e,[1.15,.3,1.05],[i,.36,a],t,`A-frame concrete footing`,.08),X(e,[.62,.12,.58],[i,.58,a],r,`A-frame base plate`,.025);for(let t of[-.2,.2])for(let r of[-.18,.18])Jf(e,[i+t,.66,a+r],n,Y,.04)}for(let t of[-1.85,1.85])$(e,[-3.65,.64,t],[0,5.18,t],.15,n,`left A-frame support leg`),$(e,[3.65,.64,t],[0,5.18,t],.15,n,`right A-frame support leg`),$(e,[-2.65,1.85,t],[2.65,1.85,t],.075,r,`A-frame lower cross tie`),$(e,[-2.9,1.55,t],[1.55,3.25,t],.052,r,`A-frame diagonal lattice brace`,!1),$(e,[2.9,1.55,t],[-1.55,3.25,t],.052,r,`A-frame diagonal lattice brace`,!1),Z(e,.42,.42,.32,[0,5.18,t],n,`main pivot bearing housing`,[Math.PI/2,0,0],16),Z(e,.24,.24,.4,[0,5.18,t],a,`pivot bearing cap`,[Math.PI/2,0,0],14,!1,!0);Z(e,.17,.17,4.15,[0,5.18,0],r,`through pivot axle`,[Math.PI/2,0,0],14);let p=new Tn;p.name=`pirate ship swing animation pivot`,p.position.y=5.18,e.add(p),$(p,[0,0,-1.62],[0,-1.25,-1.38],.08,n,`rear suspension hanger`),$(p,[0,0,1.62],[0,-1.25,1.38],.08,n,`front suspension hanger`),X(p,[7.7,.72,2.55],[0,-2.1,0],s,`laminated lower hull shell`,.2),X(p,[7.05,.7,2.78],[0,-1.58,0],o,`planked upper hull shell`,.16),X(p,[1.3,.72,2.35],[-4.05,-1.76,0],o,`assembled stern quarter`,.14,[0,0,-.24]),X(p,[1.3,.72,2.35],[4.05,-1.76,0],o,`assembled bow quarter`,.14,[0,0,.24]),X(p,[8.15,.16,2.82],[0,-1.17,0],n,`steel-backed passenger deck`,.05),X(p,[7.35,.16,.2],[0,-2.53,0],i,`copper keel band`,.045);for(let e of[-1.35,1.35]){X(p,[8,.11,.09],[0,-.45,e],a,`ship guard handrail`,.025,Y,!1,!0);for(let t=-3.75;t<=3.75;t+=.75)X(p,[.055,.78,.055],[t,-.79,e],n,`ship guard rail post`,.015,Y,!1,!0)}for(let e=0;e<5;e+=1){let t=-2.5+e*1.25;X(p,[.18,.27,2.18],[t,-.86,0],c,`two-place ride bench`,.07),X(p,[.16,.54,2.18],[t-.13,-.62,0],n,`bench back frame`,.055),$(p,[t+.12,-.52,-.9],[t+.12,-.9,-.45],.032,a,`lap restraint left`,!1),$(p,[t+.12,-.52,.9],[t+.12,-.9,.45],.032,a,`lap restraint right`,!1);for(let e of[-.82,.82])Jf(p,[t+.1,-.72,e],r,[0,0,Math.PI/2],.027)}Z(p,.09,.12,4,[.85,.78,0],n,`decorative ship mast`,Y,10),Z(p,.05,.05,3.15,[.85,2.92,0],a,`mast top spar`,[0,0,Math.PI/2],8,!1,!0);for(let e=0;e<4;e+=1)X(p,[2.45-e*.35,.58,.045],[1.72-e*.06,2.38-e*.59,0],e%2==0?l:c,`stitched sail cloth panel`,.018,Y,!1,!0),X(p,[2.55-e*.35,.035,.06],[1.72-e*.06,2.67-e*.59,0],n,`sail reinforcing batten`,.008,Y,!1,!1);$(p,[.85,2.55,0],[-3.95,-.42,0],.018,a,`stern rigging cable`,!1),$(p,[.85,2.55,0],[4.32,-.42,0],.018,a,`bow rigging cable`,!1),X(p,[.62,.62,.08],[4.05,-1.52,1.42],u,`corsair crest panel`,.08,Y,!1,!0),qf(e,.72,.15,[0,1.18,-2.15],d,`friction drive flywheel`,Y,28),Z(e,.2,.2,.82,[0,1.18,-2.15],r,`flywheel drive shaft`,[Math.PI/2,0,0],12),X(e,[1.35,.72,.9],[-1.35,.65,-2.22],u,`drive motor enclosure`,.07),X(e,[.95,.22,.025],[-1.35,.68,-1.755],n,`motor cooling vent panel`,.01,Y,!1,!0);for(let t=-1.72;t<=-.98;t+=.185)X(e,[.1,.035,.025],[t,.68,-1.738],r,`motor ventilation louver`,.008,Y,!1,!1);X(e,[2.55,.8,.12],[0,.88,3.14],u,`interlocked loading gate panel`,.025);for(let t of[-1.25,0,1.25])X(e,[.07,1,.07],[t,.88,3.15],n,`loading gate post`,.018,Y,!1,!0);X(e,[1.5,1,.86],[-4.55,.72,2.65],l,`pirate ship operator console`,.065),X(e,[1.08,.34,.025],[-4.55,.88,3.095],n,`pirate ship control panel`,.01,Y,!1,!0);for(let t of[-4.85,-4.55,-4.25])Q(e,.05,[t,.96,3.12],t===-4.55?f:c,`ship control indicator`,[1,.45,1],!1,8);return this.addSign(e,`COPPER CORSAIR`,[3.4,.58],[0,2.12,3.2],4272937,15849637,`10 SEATS • AIR BRAKES`),e.userData.entryPoints=[[0,0,4.2]],e.userData.operating=!0,e.userData.animationPivot=p.name,this.registerAnimation(e,({elapsed:t,activity:n})=>{e.userData.operating!==!1&&(p.rotation.z=Math.sin(t*.72)*.64*n)}),e}createMiniRailway(){let e=Xf(`Willow Line Railway`,`placeable`),t=this.materials.get(`concrete`),n=this.materials.get(`concreteDark`),r=this.materials.get(`timber`),i=this.materials.get(`galvanized`),a=this.materials.get(`steelDark`),o=this.materials.get(`galvanized`),s=this.materials.get(`timber`),c=this.materials.get(`paintCream`),l=this.materials.get(`paintGreen`),u=this.materials.get(`paintRed`),d=this.materials.get(`brass`),f=this.materials.get(`lampGlow`),p=this.quality===`high`?180:120,m=[];for(let e=0;e<12;e+=1){let t=e/12*Math.PI*2;m.push(new H(Math.sin(t)*4.55,.34,Math.cos(t)*3.05))}let h=new Ji(m,!0,`catmullrom`,.5),g=h.getLength(),_=Math.round(g/1.08),v=new _f(1.72,.22,1.02,1,.05);Of(v,1),kf(v);let y=new ci(v,n,_);y.name=`instanced ballast bed panel`,y.receiveShadow=!0;for(let e=0;e<_;e+=1){let t=this.trackFrameAt(h,e/_,0);Zf(y,e,new H(t.position.x,.11,t.position.z),new Ot().setFromRotationMatrix(new Xt().makeBasis(t.right,t.up,t.forward)))}y.instanceMatrix.needsUpdate=!0,e.add(y),this.addTrack(e,h,{name:`railway`,gauge:.78,railRadius:.045,railMaterial:i,tie:{size:[1.2,.1,.22],offset:-.075,perMetre:2.1,material:r},bankStrength:0,samples:p}),X(e,[5.4,.32,1.3],[0,.16,4.35],t,`station platform slab`,.05,Y,!1,!0),X(e,[5.4,.09,.16],[0,.36,3.78],c,`platform edge coping`,.02,Y,!1,!0);for(let t=-2;t<=2;t+=1)X(e,[.5,.02,.07],[t*1,.33,3.62],u,`platform safety line`,.006,Y,!1,!1);for(let t of[-2.25,2.25])X(e,[.1,2.25,.1],[t,1.45,4.05],a,`canopy support post`,.022),X(e,[.1,2.25,.1],[t,1.45,4.78],a,`canopy support post`,.022),$(e,[t,2.3,4.05],[t+Math.sign(t)*-.42,2.58,4.42],.028,i,`canopy knee brace`,!1),Jf(e,[t,.42,4.05],o,Y,.03);X(e,[5.2,.14,1.5],[0,2.66,4.42],l,`station canopy deck`,.045,[-.06,0,0]),X(e,[5.35,.16,.14],[0,2.62,3.71],c,`canopy valance board`,.03,Y,!1,!0);for(let t=-2;t<=2;t+=1)X(e,[.035,.045,1.45],[t*1.05,2.75,4.42],i,`canopy standing seam`,.008,[-.06,0,0],!1,!1);X(e,[1.6,.09,.42],[-1.5,.7,4.62],s,`platform bench seat`,.03),X(e,[1.6,.36,.07],[-1.5,.88,4.83],s,`platform bench back`,.025);for(let t of[-2.15,-.85])X(e,[.08,.36,.34],[t,.52,4.62],a,`bench cast frame`,.02);Z(e,.14,.1,.16,[2.6,2.34,4.12],d,`platform departure bell`,Y,12,!1,!0),$(e,[2.6,2.56,4.12],[2.6,2.4,4.12],.02,a,`bell hanger`,!1),X(e,[1.05,.62,.08],[1.75,1.62,4.7],a,`departure board`,.025,Y,!1,!0);for(let t=0;t<3;t+=1)X(e,[.78,.09,.02],[1.75,1.82-t*.19,4.65],t===0?f:c,`departure board line`,.006,Y,!1,!1);this.addSign(e,`WILLOW LINE`,[2.4,.44],[0,2.36,3.66],3103802,15983544,`NARROW GAUGE RAILWAY`),Z(e,.09,.11,2.35,[4,1.18,3.35],a,`signal post`,Y,10),X(e,[.3,.62,.16],[4,2.5,3.42],a,`signal head`,.04),Q(e,.075,[4,2.66,3.52],f,`signal clear lamp`,[1,1,.6],!1,8),Q(e,.075,[4,2.36,3.52],u,`signal stop lamp`,[1,1,.6],!1,8),X(e,[.42,.12,.42],[4,.06,3.35],t,`signal post footing`,.03,Y,!1,!0);for(let[t,n]of[[-5.62,.4],[5.62,-.4]])X(e,[.5,.72,.5],[t,.36,n],s,`lineside tool locker`,.05),X(e,[.56,.08,.56],[t,.76,n],a,`locker lid`,.02,Y,!1,!0);let b=this.buildRailwayLocomotive();e.add(b);let x=[1,2].map(t=>{let n=this.buildRailwayCarriage(t);return e.add(n),n}),S=[0,2.35,4.35].map(e=>e/g),C=.62,w=()=>{this.setOnTrack(b,this.trackFrameAt(h,C-S[0],0),.02);for(let[e,t]of x.entries())this.setOnTrack(t,this.trackFrameAt(h,C-S[e+1],0),.02)};return w(),e.userData.entryPoints=[[0,0,5.1]],e.userData.operating=!0,e.userData.animationPivot=b.name,this.registerAnimation(e,({delta:t,activity:n})=>{e.userData.operating!==!1&&(C=(C+t*2.4*n/g)%1,w())}),e}createMeteorCoaster(){let e=Xf(`Meteor Chase`,`placeable`),t=this.materials.get(`concrete`),n=this.materials.get(`steelDark`),r=this.materials.get(`galvanized`),i=this.materials.get(`galvanized`),a=this.materials.get(`paintTeal`),o=this.materials.get(`paintRed`),s=this.materials.get(`paintYellow`),c=this.materials.get(`paintCream`),l=this.materials.get(`paintBlue`),u=this.materials.get(`lampGlow`),d=this.quality===`high`?240:160,f=new Ji([[-4.6,1.55,5.05],[0,1.55,5.15],[4.55,1.62,5],[6.55,3.15,2.4],[6.85,5.95,-.6],[5.35,8.55,-3.4],[2.35,9.15,-4.85],[-1,5.6,-4.55],[-3.4,2.05,-2.95],[-4.2,3.6,-.4],[-2.6,4.85,1.85],[.65,2.95,3],[3.4,2.6,1.4],[2,2.2,-1.4],[-1.2,2,-1.85],[-3.6,1.9,.6],[-5.65,1.7,3]].map(e=>new H(...e)),!0,`catmullrom`,.5),p=f.getLength(),m=this.addTrack(e,f,{name:`coaster`,gauge:.86,railRadius:.062,railMaterial:i,tie:{size:[1.05,.075,.1],offset:-.12,perMetre:1.1,material:n},spine:{radius:.14,offset:-.52,material:a},bankStrength:6.5,samples:d});this.addTrackSupports(e,m,n,r,t,this.quality===`high`?9:13);let h=new Ji(this.trackSection(f,.175,.315,26),!1,`catmullrom`,.5),g=new ga(h,40,.035,6,!1);Of(g,1),kf(g);let _=new K(g,r);_.name=`lift hill drive chain`,_.castShadow=!0,_.position.y=-.2,e.add(_);for(let t=0;t<=12;t+=1){let n=h.getPointAt(t/12);X(e,[.3,.06,.12],[n.x,n.y-.28,n.z],s,`anti rollback ratchet`,.014,Y,!1,!1)}X(e,[1.5,.9,1.2],[3,9.35,-5.55],a,`lift drive machinery house`,.08),X(e,[1.65,.16,1.35],[3,9.86,-5.55],n,`machinery house roof`,.04),Z(e,.34,.34,.9,[2.05,9.3,-5.55],r,`chain drive sheave`,[0,0,Math.PI/2],14),Q(e,.16,[3,10.1,-5.55],u,`circuit warning beacon`,[1,.9,1],!1,10);for(let t=0;t<=9;t+=1){let n=this.trackFrameAt(f,.955+t*.0055,6.5);for(let t of[-1,1]){let r=n.position.clone().addScaledVector(n.right,t*.62).addScaledVector(n.up,-.16);X(e,[.06,.3,.44],[r.x,r.y,r.z],s,`magnetic brake fin`,.012,Y,!1,!1)}}X(e,[9.4,.24,7.2],[-.4,.12,1],t,`ride foundation slab`,.09,Y,!1,!0);for(let[r,i]of[[3.75,`boarding`],[6.45,`unloading`]])X(e,[6.6,1.3,1.1],[-.4,.78,r],t,`${i} platform substructure`,.06),X(e,[6.9,.16,1.35],[-.4,1.5,r],n,`${i} platform deck`,.045),X(e,[6.9,.1,.13],[-.4,1.62,r+(r<5?.61:-.61)],s,`${i} platform edge marking`,.02,Y,!1,!0);for(let t of[-3.5,-1.1,1.3,3.7])X(e,[.14,2.6,.14],[t,2.88,6.78],n,`station roof column`,.03),X(e,[.14,2.6,.14],[t,2.88,3.42],n,`station roof column`,.03),$(e,[t,4.1,6.78],[t,4.42,6.1],.035,r,`station roof knee brace`,!1),Jf(e,[t,1.7,6.78],r,Y,.032);X(e,[7.4,.18,3.7],[-.4,4.5,5.1],n,`station roof beam frame`,.04);for(let t=0;t<5;t+=1)X(e,[1.44,.11,3.6],[-3.35+t*1.48,4.66,5.1],t%2==0?c:a,`station canopy panel`,.03,[0,0,(t-2)*.012],!1,!0),X(e,[.035,.04,3.55],[-2.63+t*1.48,4.73,5.1],r,`canopy standing seam`,.008,Y,!1,!1);for(let t of[-2.6,0,2.6])X(e,[1.5,1.05,.09],[t,2.15,4.31],s,`air gate leaf`,.025),X(e,[.09,1.2,.09],[t-.78,2.2,4.31],n,`air gate post`,.02,Y,!1,!0),X(e,[.09,1.2,.09],[t+.78,2.2,4.31],n,`air gate post`,.02,Y,!1,!0);X(e,[1.6,1.1,.9],[-4.6,2.05,3.7],c,`coaster operator console housing`,.06),X(e,[1.15,.38,.025],[-4.6,2.24,3.25],n,`coaster operator control panel`,.01,Y,!1,!0);for(let t of[-4.9,-4.6,-4.3])Q(e,.05,[t,2.33,3.22],t===-4.6?u:o,`dispatch indicator`,[1,.45,1],!1,8);X(e,[1.4,.9,.12],[-2.4,1.05,2.85],n,`station access stair stringer`,.03,[-.42,0,0]);for(let n=0;n<4;n+=1)X(e,[1.4,.07,.34],[-2.4,.42+n*.3,2.45+n*.32],t,`station access step`,.02,Y,!1,!0);this.addSign(e,`METEOR CHASE`,[3.6,.6],[-.4,5.05,3.24],2043708,16765778,`CHAIN LIFT • 9 METRE DROP`);let v=[0,1].map(t=>{let i=this.buildCoasterCar(t,t===0?o:l,n,r,s,u);return e.add(i),i}),y=2.5/p,b=.02,x=()=>{for(let[e,t]of v.entries())this.setOnTrack(t,this.trackFrameAt(f,b-e*y,6.5),.42)};return x(),e.userData.entryPoints=[[-.4,0,7.6]],e.userData.operating=!0,e.userData.animationPivot=v[0]?.name,this.registerAnimation(e,({delta:t,activity:n})=>{if(e.userData.operating===!1)return;let r=this.trackFrameAt(f,b,0).position.y,i=b>.17&&b<.32?2.1:Math.min(19,Math.sqrt(Math.max(.9,19.62*(9.85-r))));b=(b+t*i*n/p)%1,x()}),e}createRestroom(){let e=Xf(`Park Comfort Station`,`placeable`),t=this.materials.get(`concrete`),n=this.materials.get(`brick`),r=this.materials.get(`paintCream`),i=this.materials.get(`paintTeal`),a=this.materials.get(`steelDark`),o=this.materials.get(`galvanized`),s=this.materials.get(`lampGlow`);X(e,[5.8,.18,3.8],[0,.09,0],t,`accessible foundation`,.07,Y,!1,!0),X(e,[5.45,2.65,.22],[0,1.5,-1.66],n,`rear masonry wall`,.04),X(e,[.24,2.65,3.25],[-2.61,1.5,-.04],n,`left masonry wall`,.045),X(e,[.24,2.65,3.25],[2.61,1.5,-.04],n,`right masonry wall`,.045),X(e,[.86,2.65,.22],[0,1.5,1.58],n,`center door pier`,.04),X(e,[.42,2.65,.22],[-2.38,1.5,1.58],n,`left door jamb wall`,.04),X(e,[.42,2.65,.22],[2.38,1.5,1.58],n,`right door jamb wall`,.04),X(e,[5.45,.46,.22],[0,2.6,1.58],n,`front lintel wall`,.04);for(let t of[-1.28,1.28])X(e,[1.65,2.15,.11],[t,1.33,1.72],i,`restroom door`,.045),X(e,[1.82,.08,.18],[t,2.45,1.69],a,`door head frame`,.018),X(e,[.08,2.28,.18],[t-.87,1.34,1.69],a,`door jamb`,.018),X(e,[.08,2.28,.18],[t+.87,1.34,1.69],a,`door jamb`,.018),Z(e,.045,.045,.14,[t+(t<0?.55:-.55),1.3,1.83],o,`lever handle`,[Math.PI/2,0,0],10,!1,!0),X(e,[.76,.07,.03],[t,.29,1.83],o,`door kick plate trim`,.012,Y,!1,!1);this.addSign(e,`RESTROOM`,[2.35,.46],[0,2.88,1.71],2779240,16116171,`ACCESSIBLE • FAMILY`),X(e,[5.75,.2,3.65],[0,2.91,-.02],r,`sloped roof deck`,.06,[-.025,0,0]),X(e,[5.86,.12,.14],[0,2.81,1.75],a,`roof drip edge`,.025),X(e,[.13,2.35,.13],[2.78,1.65,-1.55],a,`rain downspout`,.025,Y,!1,!0),X(e,[.5,.16,.5],[-1.45,3.13,-.52],o,`roof vent curb`,.035),Z(e,.17,.17,.5,[-1.45,3.44,-.52],o,`roof vent`,Y,12),Z(e,.27,.17,.08,[-1.45,3.72,-.52],o,`vent rain cap`,Y,12,!1,!0);for(let t=-1.9;t<=1.9;t+=.38)X(e,[.28,.045,.055],[t,2.24,-1.79],a,`ventilation louver`,.012,[.12,0,0],!1,!1);for(let t of[-2.15,2.15])X(e,[.26,.12,.2],[t,2.52,1.79],a,`shielded wall light`,.03,[.16,0,0],!1,!0),Q(e,.075,[t,2.44,1.87],s,`wall light lens`,[1.3,.6,.8],!1,8);return X(e,[1.75,.08,.65],[-1.28,.23,2],t,`flush threshold`,.025,Y,!1,!0),X(e,[1.75,.08,.65],[1.28,.23,2],t,`flush threshold`,.025,Y,!1,!0),e.userData.entryPoints=[[-1.28,0,2.2],[1.28,0,2.2]],e}createFirstAid(){let e=Xf(`Pulse Point First Aid`,`placeable`),t=this.materials.get(`concrete`),n=this.materials.get(`paintCream`),r=this.materials.get(`paintWhite`),i=this.materials.get(`paintRed`),a=this.materials.get(`paintTeal`),o=this.materials.get(`steelDark`),s=this.materials.get(`galvanized`),c=this.materials.get(`glass`),l=this.materials.get(`rubber`),u=this.materials.get(`lampGlow`);X(e,[4.85,.18,3.85],[0,.09,0],t,`accessible clinic foundation`,.075,Y,!1,!0),X(e,[4.48,2.55,.2],[0,1.47,-1.62],n,`rear insulated wall assembly`,.045),X(e,[.2,2.55,3.08],[-2.14,1.47,-.08],n,`left insulated wall assembly`,.045),X(e,[.2,2.55,3.08],[2.14,1.47,-.08],n,`right insulated wall assembly`,.045),X(e,[.38,2.55,.2],[-1.95,1.47,1.46],n,`left front wall return`,.04),X(e,[.42,2.55,.2],[1.93,1.47,1.46],n,`right front wall return`,.04),X(e,[.28,2.55,.2],[.15,1.47,1.46],n,`front opening mullion wall`,.04),X(e,[4.1,.5,.2],[0,2.5,1.46],n,`front structural lintel`,.04),X(e,[1.65,2.08,.1],[1.13,1.31,1.59],a,`accessible clinic door`,.045),X(e,[1.82,.08,.17],[1.13,2.4,1.55],o,`door head frame`,.018);for(let t of[.24,2.02])X(e,[.08,2.22,.17],[t,1.34,1.55],o,`door jamb frame`,.018);X(e,[.72,.46,.018],[1.13,1.7,1.65],c,`door observation glazing`,.012,Y,!1,!1),X(e,[.62,.09,.025],[1.13,.48,1.66],s,`door kick plate trim`,.012,Y,!1,!1),Z(e,.045,.045,.16,[1.72,1.24,1.69],s,`clinic lever handle`,[Math.PI/2,0,0],10,!1,!0);for(let t of[.68,1.28,1.88])X(e,[.035,.18,.025],[.28,t,1.67],s,`door hinge leaf`,.008,Y,!1,!1);X(e,[1.76,1.32,.025],[-.87,1.47,1.58],c,`reception window glazing`,.012,Y,!1,!1),X(e,[1.94,.09,.17],[-.87,2.16,1.55],o,`window head frame`,.018),X(e,[1.94,.09,.17],[-.87,.78,1.55],o,`window sill frame`,.018);for(let t of[-1.83,.09])X(e,[.08,1.48,.17],[t,1.47,1.55],o,`window jamb frame`,.018);X(e,[.07,1.34,.06],[-.87,1.47,1.6],o,`window center mullion`,.015,Y,!1,!0),X(e,[1.98,.12,.55],[-.87,.77,1.78],s,`reception pass-through counter`,.04),X(e,[4.7,.2,3.55],[0,2.85,-.05],r,`clinic roof deck assembly`,.06,[-.025,0,0]),X(e,[4.78,.11,.14],[0,2.75,1.7],o,`roof drip edge`,.025),X(e,[.12,2.3,.12],[2.3,1.62,-1.52],o,`rainwater downspout`,.025,Y,!1,!0),X(e,[1.02,.46,.72],[-1.18,3.18,-.38],s,`roof HVAC enclosure`,.055);for(let t=-1.55;t<=-.81;t+=.185)X(e,[.1,.23,.025],[t,3.17,-.005],o,`HVAC ventilation louver`,.008,Y,!1,!1);Z(e,.13,.13,.34,[.78,3.12,-.62],s,`clinic exhaust vent`,Y,12),Z(e,.22,.13,.07,[.78,3.32,-.62],s,`exhaust rain cap`,Y,12,!1,!0),X(e,[2.16,.14,1.02],[1.12,2.48,1.96],r,`entry canopy roof`,.045,[-.08,0,0]);for(let t of[.22,2.02])X(e,[.07,1.05,.07],[t,1.95,2.35],o,`entry canopy support post`,.018),$(e,[t,2.36,1.48],[t,2.2,2.32],.028,s,`canopy wall stay`,!1),Jf(e,[t,1.46,2.39],s,Y,.028);X(e,[1.84,.07,.07],[1.12,2.48,2.42],o,`canopy front fascia rail`,.018,Y,!1,!1),X(e,[.68,.68,.09],[-1.25,2.43,1.61],r,`first aid emblem backplate`,.035,Y,!1,!0),X(e,[.18,.54,.035],[-1.25,2.43,1.67],i,`first aid vertical cross bar`,.025,Y,!1,!1),X(e,[.54,.18,.035],[-1.25,2.43,1.67],i,`first aid horizontal cross bar`,.025,Y,!1,!1),this.addSign(e,`FIRST AID`,[1.52,.38],[-.25,2.43,1.66],15920869,12074808,`PULSE POINT`),X(e,[.24,.12,.2],[-1.92,2.48,1.64],o,`shielded clinic wall light`,.03,[.16,0,0],!1,!0),Q(e,.075,[-1.92,2.39,1.74],u,`clinic wall light lens`,[1.3,.6,.8],!1,8),X(e,[1.72,.09,.7],[1.13,.22,2],t,`flush accessible threshold`,.03,Y,!1,!0),X(e,[1.7,.07,.55],[1.13,.17,2.58],t,`accessible approach ramp`,.025,[-.04,0,0],!1,!0),X(e,[1.65,.18,.62],[-.88,.63,-.2],n,`treatment cot mattress`,.06),X(e,[1.72,.08,.68],[-.88,.5,-.2],o,`treatment cot frame`,.025);for(let t of[-1.57,-.19])X(e,[.06,.42,.06],[t,.28,-.2],o,`cot folding leg`,.018),Z(e,.075,.075,.05,[t,.11,-.2],l,`cot caster`,[Math.PI/2,0,0],10,!1,!0);return e.userData.entryPoints=[[1.13,0,2.75],[-.87,0,2.45]],e}createInformationBooth(){let e=Xf(`Park Pathfinder`,`placeable`),t=this.materials.get(`concrete`),n=this.materials.get(`paintCream`),r=this.materials.get(`paintTeal`),i=this.materials.get(`paintYellow`),a=this.materials.get(`paintRed`),o=this.materials.get(`steelDark`),s=this.materials.get(`galvanized`),c=this.materials.get(`glass`),l=this.materials.get(`timber`),u=this.materials.get(`lampGlow`);X(e,[3.82,.15,2.82],[0,.075,0],t,`booth paving foundation`,.07,Y,!1,!0),X(e,[3.38,1.02,2.25],[0,.72,-.04],r,`panelized lower booth cabinet`,.075),X(e,[3.04,.73,.025],[0,.7,1.1],n,`front service cabinet panels`,.025,Y,!1,!0),Yf(e,2.9,.7,1.118,4,s),X(e,[3.52,.13,2.42],[0,1.27,-.04],l,`continuous service counter sill`,.045);for(let t of[-1.52,0,1.52])X(e,[.09,1.56,.09],[t,2.01,.97],o,`front glazing frame post`,.02),X(e,[.09,1.56,.09],[t,2.01,-1.05],o,`rear glazing frame post`,.02);for(let t of[-1.05,.97])X(e,[3.14,.09,.09],[0,2.72,t],o,`booth glazing head rail`,.02),X(e,[3.14,.09,.09],[0,1.3,t],o,`booth glazing sill rail`,.02);X(e,[1.42,1.3,.025],[-.76,2.01,1.03],c,`left service window glazing`,.01,Y,!1,!1),X(e,[1.42,1.3,.025],[.76,2.01,1.03],c,`right service window glazing`,.01,Y,!1,!1),X(e,[1.42,1.3,.025],[-.76,2.01,-1.1],c,`left rear booth glazing`,.01,Y,!1,!1),X(e,[1.42,1.3,.025],[.76,2.01,-1.1],c,`right rear booth glazing`,.01,Y,!1,!1);for(let t of[-1.56,1.56])X(e,[.025,1.3,1.92],[t,2.01,-.04],c,`side booth glazing`,.01,Y,!1,!1),X(e,[.09,.09,2.05],[t,2.72,-.04],o,`side glazing head rail`,.02),Jf(e,[t,1.32,1.1],s,Y,.026),Jf(e,[t,2.68,1.1],s,Y,.026);X(e,[3.75,.18,2.82],[0,2.88,-.04],n,`overhanging booth roof deck`,.065),X(e,[3.42,.2,2.48],[0,3.04,-.04],r,`raised roof weather cap`,.055),X(e,[3.82,.09,.09],[0,2.83,1.38],o,`front roof drip rail`,.018,Y,!1,!1);for(let t of[-1.55,-.52,.52,1.55])X(e,[.035,.04,2.55],[t,3.16,-.04],s,`roof standing seam`,.008,Y,!1,!1);Z(e,.42,.42,.1,[0,3.22,.02],i,`information roof medallion`,[Math.PI/2,0,0],20,!1,!0),Z(e,.31,.31,.105,[0,3.22,.075],n,`information medallion inset`,[Math.PI/2,0,0],20,!1,!0),X(e,[.075,.32,.035],[0,3.18,.14],r,`information symbol stem`,.025,Y,!1,!1),Q(e,.055,[0,3.4,.14],r,`information symbol dot`,[1,1,.55],!1,8),X(e,[3.28,.11,.6],[0,1.29,1.32],l,`two-window public counter`,.04),X(e,[1.18,.46,.05],[-.75,1.78,1.075],i,`park map display panel`,.025,Y,!1,!0),X(e,[.9,.035,.02],[-.75,1.78,1.11],r,`map primary route decal`,.008,[0,0,.22],!1,!1),X(e,[.035,.32,.02],[-.58,1.78,1.115],a,`map destination route decal`,.008,[0,0,-.35],!1,!1);for(let[t,i]of[[-1.34,1.85],[-1.34,1.62],[1.32,1.85],[1.32,1.62]])X(e,[.28,.16,.08],[t,i,1.16],n,`brochure rack pocket`,.025,[.08,0,0],!1,!0),X(e,[.2,.12,.02],[t,i+.07,1.215],t>0?a:r,`printed brochure stack`,.006,[.08,0,0],!1,!1);return X(e,[.22,.12,.2],[1.22,2.48,1.12],o,`shielded counter light`,.03,[.15,0,0],!1,!0),Q(e,.07,[1.22,2.4,1.22],u,`counter light lens`,[1.3,.6,.8],!1,8),this.addSign(e,`PARK PATHFINDER`,[2.25,.36],[0,2.54,1.105],3110775,16770734,`MAPS • ACCESS • EVENTS`),e.userData.counterPoints=[[-.72,0,1.9],[.72,0,1.9]],e}createCashMachine(){let e=Xf(`Ledger Point Cash Machine`,`placeable`),t=this.materials.get(`concreteDark`),n=this.materials.get(`concrete`),r=this.materials.get(`steelDark`),i=this.materials.get(`steel`),a=this.materials.get(`galvanized`),o=this.materials.get(`paintTeal`),s=this.materials.get(`paintYellow`),c=this.materials.get(`rubber`),l=this.materials.get(`brass`),u=this.materials.get(`glass`),d=this.materials.get(`lampGlow`);X(e,[1.85,.12,1.7],[0,.06,0],t,`machine anchor pad`,.04,Y,!1,!0),X(e,[1.02,.26,.76],[0,.25,-.02],n,`levelling plinth`,.03),X(e,[.9,1.5,.68],[0,1.13,-.02],r,`safe body enclosure`,.06),X(e,[.82,1.28,.05],[0,1.22,.34],i,`stainless fascia panel`,.02),X(e,[.9,.12,.72],[0,1.94,-.02],r,`enclosure top cap`,.03),X(e,[.48,.36,.03],[0,1.62,.372],r,`screen bezel`,.012,Y,!1,!0),X(e,[.4,.29,.012],[0,1.62,.381],d,`screen backlight`,.004,Y,!1,!1),X(e,[.41,.3,.012],[0,1.62,.392],u,`screen glazing`,.004,Y,!1,!1);for(let t of[-1,1])for(let n of[1.72,1.62,1.52])X(e,[.055,.03,.02],[t*.31,n,.375],o,`soft function key`,.008,Y,!1,!1);X(e,[.34,.28,.035],[0,1.28,.372],r,`keypad surround`,.012,Y,!1,!0);for(let t=0;t<12;t+=1)X(e,[.055,.04,.02],[-.09+t%3*.09,1.37-Math.floor(t/3)*.065,.385],t===10?o:i,`keypad key`,.008,Y,!1,!1);X(e,[.14,.035,.05],[.27,1.4,.375],l,`card reader slot`,.01,Y,!1,!0),X(e,[.15,.025,.05],[-.27,1.4,.375],i,`receipt printer slot`,.008,Y,!1,!0),X(e,[.3,.06,.06],[0,1.02,.375],c,`cash dispenser lip`,.014,Y,!1,!0),X(e,[.36,.02,.04],[0,1.09,.38],i,`dispenser shutter`,.006,Y,!1,!1),X(e,[1.02,.1,.62],[0,2.16,.24],r,`privacy hood`,.03,[-.14,0,0]);for(let t of[-1,1])X(e,[.06,.34,.56],[t*.48,1.98,.22],r,`privacy hood cheek`,.02,Y,!1,!0),$(e,[t*.44,1.98,-.3],[t*.44,2.14,.18],.022,i,`hood support stay`,!1),Z(e,.085,.095,.86,[t*.76,.43,.42],a,`protective bollard`,Y,12),Z(e,.095,.095,.09,[t*.76,.7,.42],s,`bollard reflective band`,Y,12,!1,!0),Jf(e,[t*.4,.34,.36],a,Y,.032),Jf(e,[t*.4,.34,-.38],a,Y,.032);Q(e,.055,[0,2.05,.26],d,`hood service light`,[1.6,.5,1],!1,8),X(e,[.72,1.05,.03],[0,1.12,-.375],i,`rear service door`,.015,Y,!1,!0);for(let t of[.74,1.5])X(e,[.05,.16,.03],[-.3,t,-.39],a,`service door hinge`,.01,Y,!1,!1);return Z(e,.045,.045,.05,[.26,1.12,-.395],l,`service door lock`,[Math.PI/2,0,0],10,!1,!0),this.addSign(e,`CASH`,[.74,.2],[0,1.945,.372],2051919,16769663,`WITHDRAWALS`),e.userData.counterPoints=[[0,0,1.15]],e}createMaintenanceHut(){let e=Xf(`Warden Yard Crew Post`,`placeable`),t=this.materials.get(`concrete`),n=this.materials.get(`concreteDark`),r=this.materials.get(`paintCream`),i=this.materials.get(`paintGreen`),a=this.materials.get(`paintTeal`),o=this.materials.get(`paintYellow`),s=this.materials.get(`paintRed`),c=this.materials.get(`paintWhite`),l=this.materials.get(`steelDark`),u=this.materials.get(`galvanized`),d=this.materials.get(`glass`),f=this.materials.get(`timber`),p=this.materials.get(`timberDark`),m=this.materials.get(`rubber`),h=this.materials.get(`brass`),g=this.materials.get(`lampGlow`);X(e,[3.9,.15,2.9],[0,.075,0],t,`crew yard hardstanding`,.06,Y,!1,!0),X(e,[3.4,2.35,.18],[0,1.25,-1.28],r,`rear clad wall assembly`,.04),X(e,[.18,2.35,2.4],[-1.61,1.25,-.17],r,`left clad wall assembly`,.04),X(e,[.18,2.35,2.4],[1.61,1.25,-.17],r,`right clad wall assembly`,.04),X(e,[.3,2.35,.18],[-1.55,1.25,.94],r,`bay side wall return`,.035),X(e,[.34,2.35,.18],[.22,1.25,.94],r,`front opening mullion wall`,.035),X(e,[.3,2.35,.18],[1.55,1.25,.94],r,`door side wall return`,.035),X(e,[3.4,.45,.18],[0,2.2,.94],r,`front structural lintel`,.035),X(e,[1.45,.06,.5],[-.675,.16,1.15],n,`bay ramped threshold`,.02,Y,!1,!0),X(e,[1.42,.6,.08],[-.675,1.66,.98],u,`rolled shutter curtain`,.02);for(let t of[1.44,1.58,1.72,1.86])X(e,[1.42,.03,.02],[-.675,t,1.03],l,`shutter slat seam`,.006,Y,!1,!1);X(e,[1.66,.3,.36],[-.675,2.11,1.02],l,`shutter hood canister`,.05);for(let t of[-1.43,.08])X(e,[.1,1.94,.12],[t,1.12,1],l,`shutter guide rail`,.02),Jf(e,[t,.42,1.07],u,Y,.026),Jf(e,[t,1.82,1.07],u,Y,.026);X(e,[.66,.34,.78],[-.72,.55,.32],i,`litter barrow tub`,.09),X(e,[.7,.07,.12],[-.72,.75,.72],u,`barrow tipping lip`,.02,Y,!1,!0),$(e,[-.98,.36,-.16],[-.98,.34,.66],.028,l,`barrow chassis rail`),$(e,[-.46,.36,-.16],[-.46,.34,.66],.028,l,`barrow chassis rail`),$(e,[-.98,.36,-.16],[-.98,.72,-.44],.024,l,`barrow push handle`,!1),$(e,[-.46,.36,-.16],[-.46,.72,-.44],.024,l,`barrow push handle`,!1),Z(e,.17,.17,.08,[-.72,.25,.68],m,`barrow wheel`,[0,0,Math.PI/2],12),Z(e,.05,.05,.1,[-.72,.25,.68],u,`barrow axle bearing`,[0,0,Math.PI/2],8,!1,!0);for(let[t,n]of[[-1.24,i],[-.24,o]])X(e,[.52,.86,.46],[t,.6,-.78],l,`wheeled bin body`,.05),X(e,[.56,.09,.5],[t,1.06,-.79],n,`wheeled bin lid`,.03),Z(e,.09,.09,.06,[t,.21,-.6],m,`bin castor wheel`,[0,0,Math.PI/2],10,!1,!0);X(e,[1,2,.1],[.895,1.16,.97],a,`crew personnel door`,.04),X(e,[1.16,.09,.19],[.895,2.24,.93],l,`door head frame`,.018);for(let t of[.33,1.46])X(e,[.08,2.12,.19],[t,1.2,.93],l,`door jamb frame`,.018);X(e,[.44,.4,.02],[.895,1.74,1.03],d,`door vision panel`,.008,Y,!1,!1),X(e,[.82,.11,.025],[.895,.36,1.03],u,`door kick plate trim`,.01,Y,!1,!1),Z(e,.042,.042,.15,[1.31,1.08,1.06],h,`crew door lever handle`,[Math.PI/2,0,0],10,!1,!0);for(let t of[.5,1.16,1.82])X(e,[.035,.17,.025],[.42,t,1.04],u,`door hinge leaf`,.008,Y,!1,!1);X(e,[.6,.48,.05],[1.55,1.42,1.06],c,`duty rota board`,.02,Y,!1,!0);for(let t of[1.54,1.4,1.26])X(e,[.46,.03,.015],[1.55,t,1.09],l,`rota board rule`,.006,Y,!1,!1);X(e,[3.74,.18,2.76],[0,2.58,-.14],c,`roof deck assembly`,.05,[-.055,0,0]);for(let t of[-1.35,-.45,.45,1.35])X(e,[.045,.05,2.6],[t,2.71,-.14],u,`roof standing seam`,.008,[-.055,0,0],!1,!1);X(e,[3.82,.11,.13],[0,2.44,1.2],l,`roof drip edge`,.022),X(e,[3.6,.13,.16],[0,2.35,1.24],u,`eaves gutter channel`,.035,Y,!1,!0),X(e,[.11,2.24,.11],[1.72,1.24,1.2],u,`rainwater downspout`,.022,Y,!1,!0),Z(e,.15,.15,.38,[.86,2.82,-.62],u,`workshop extract vent`,Y,12),Z(e,.24,.15,.08,[.86,3.05,-.62],u,`vent rain cap`,Y,12,!1,!0),X(e,[.08,.1,1.55],[-1.76,1.52,-.2],u,`tool rack mounting rail`,.02);for(let t of[-.78,-.2,.38])Z(e,.028,.028,1.32,[-1.76,.92,t],f,`broom handle`,Y,8),X(e,[.1,.11,.4],[-1.76,.3,t],p,`broom head stock`,.02),X(e,[.09,.17,.36],[-1.76,.16,t],this.materials.get(`cardboard`),`broom bristle block`,.015,Y,!1,!1),X(e,[.06,.05,.09],[-1.75,1.42,t],l,`rack retaining clip`,.012,Y,!1,!1);X(e,[.12,.44,.52],[1.7,1.32,-.5],u,`hose reel wall bracket`,.03),Z(e,.27,.27,.24,[1.79,1.32,-.5],s,`hose reel drum`,[0,0,Math.PI/2],14),qf(e,.21,.045,[1.79,1.32,-.5],m,`coiled hose`,[0,Math.PI/2,0],20,!1),Z(e,.05,.05,.12,[1.79,1.32,-.5],h,`reel spindle hub`,[0,0,Math.PI/2],8,!1,!0),X(e,[.22,.13,.2],[1.5,2.4,1.01],l,`shielded yard wall light`,.03,[.16,0,0],!1,!0),Q(e,.07,[1.5,2.32,1.11],g,`yard light lens`,[1.3,.6,.8],!1,8),this.addSign(e,`PARK SERVICES`,[1.9,.32],[-.35,2.2,1.04],3110775,16770734,`GROUNDS & CLEANING`);for(let t of[-1.78,1.78])Z(e,.08,.09,.78,[t,.39,1.3],u,`yard guard bollard`,Y,12),Z(e,.09,.09,.08,[t,.62,1.3],o,`bollard reflective band`,Y,12,!1,!0),Jf(e,[t,.17,1.3],u,Y,.03);return e.userData.entryPoints=[[.895,0,1.75]],e}createTrashBin(){let e=Xf(`Sorting Bin`,`placeable`),t=this.materials.get(`steelDark`),n=this.materials.get(`galvanized`),r=this.materials.get(`paintGreen`),i=this.materials.get(`paintYellow`),a=this.materials.get(`rubber`);X(e,[.92,.08,.72],[0,.04,0],this.materials.get(`concreteDark`),`bin anchor pad`,.04,Y,!1,!0),X(e,[.82,.95,.62],[0,.54,0],t,`bin welded enclosure`,.075),X(e,[.36,.68,.02],[-.2,.49,.321],r,`waste door panel`,.025,Y,!1,!0),X(e,[.36,.68,.02],[.2,.49,.321],i,`recycling door panel`,.025,Y,!1,!0),X(e,[.38,.08,.18],[-.2,.85,.37],a,`waste aperture`,.035,Y,!1,!1),Z(e,.11,.11,.05,[.2,.85,.37],a,`bottle aperture`,[Math.PI/2,0,0],14,!1,!1),X(e,[.9,.11,.7],[0,1.075,0],n,`weather lid`,.055),X(e,[.28,.055,.14],[0,.13,.36],a,`foot pedal`,.025,[-.1,0,0],!1,!0),X(e,[.68,.025,.025],[0,.54,-.326],n,`rear service hinge`,.008,Y,!1,!1);for(let t of[-.34,.34])for(let r of[.2,.87])Jf(e,[t,r,.345],n,Y,.026);return this.addSign(e,`WASTE   RECYCLE`,[.7,.13],[0,.65,.355],2107434,15984848),e.userData.fillIndicator=0,e}createBench(){let e=Xf(`Slatted Park Bench`,`placeable`),t=this.materials.get(`timber`),n=this.materials.get(`timberDark`),r=this.materials.get(`steelDark`),i=this.materials.get(`steel`);X(e,[2.25,.07,.92],[0,.035,0],this.materials.get(`concrete`),`bench footing`,.035,Y,!1,!0);for(let t of[-.75,.75])X(e,[.11,.62,.11],[t,.36,-.12],r,`cast steel leg`,.035),X(e,[.48,.1,.11],[t,.11,-.03],r,`bolted foot`,.03),$(e,[t,.48,-.36],[t,1.05,-.46],.05,r,`back support`),Jf(e,[t-.15,.17,0],i,Y,.028),Jf(e,[t+.15,.17,0],i,Y,.028);for(let r=0;r<5;r+=1)X(e,[2.02,.085,.14],[0,.67,.32-r*.16],r===2?n:t,`seat timber slat`,.028);for(let r=0;r<4;r+=1)X(e,[2.02,.15,.075],[0,.83+r*.17,-.46],r===1?n:t,`back timber slat`,.03,[-.08,0,0]);for(let t of[-1.03,1.03]){X(e,[.09,.46,.09],[t,.73,.12],r,`armrest upright`,.03),X(e,[.1,.09,.58],[t,.96,.02],r,`curved armrest`,.035,[.04,0,0]);for(let n of[.87,1.22])Jf(e,[t,n,-.505],i,Y,.025)}return e.userData.seatPoints=[[-.52,.74,.02],[.52,.74,.02]],e}createParkLamp(){let e=Xf(`Shielded Park Lamp`,`placeable`),t=this.materials.get(`steelDark`),n=this.materials.get(`steel`),r=this.materials.get(`copper`),i=this.materials.get(`lampGlow`);Z(e,.34,.39,.16,[0,.08,0],this.materials.get(`concreteDark`),`lamp foundation`,Y,14,!1,!0),Z(e,.22,.28,.28,[0,.29,0],t,`bolted lamp base`,Y,12),Z(e,.08,.11,3.02,[0,1.88,0],t,`tapered pole`,Y,12),Z(e,.12,.12,.08,[0,.5,0],r,`lower collar`,Y,12,!1,!0),Z(e,.105,.105,.08,[0,3.36,0],r,`upper collar`,Y,12,!1,!0),$(e,[0,3.35,0],[0,3.72,.36],.055,t,`luminaire swan neck`),$(e,[0,3.72,.36],[0,3.72,.72],.055,t,`luminaire arm`),Z(e,.32,.12,.18,[0,3.64,.75],t,`full cutoff shade`,Y,16),Z(e,.18,.18,.1,[0,3.53,.75],i,`warm LED lens`,Y,12,!1,!1),X(e,[.18,.1,.24],[0,3.76,.47],n,`driver enclosure`,.035,Y,!1,!0);for(let t=0;t<6;t+=1){let r=t/6*Math.PI*2;Jf(e,[Math.sin(r)*.2,.18,Math.cos(r)*.2],n,Y,.025)}let a=new K(new pa(6.4,6.4),this.materials.getLightPoolMaterial());return a.name=`lamp light pool`,a.userData.decal=!0,a.rotation.x=-Math.PI/2,a.position.set(0,.02,.75),a.renderOrder=2,a.matrixAutoUpdate=!1,a.updateMatrix(),e.add(a),e.userData.lightAnchor=[0,3.48,.75],e.userData.lightColor=16761947,e.userData.lightIntensity=1.35,e}createShadeTree(){let e=Xf(`Copper Beech`,`placeable`),t=this.materials.get(`soil`),n=this.materials.get(`bark`),r=this.materials.get(`leaf`),i=this.materials.get(`leafLight`),a=this.materials.get(`steelDark`);Z(e,1.15,1.3,.12,[0,.06,0],t,`mulched root bed`,Y,18,!1,!0),Z(e,.2,.34,2.7,[0,1.4,0],n,`tapered trunk`,Y,12),Z(e,.13,.2,1.6,[-.42,2.7,.03],n,`left scaffold branch`,[0,0,-.55],10),Z(e,.12,.18,1.5,[.48,2.78,-.05],n,`right scaffold branch`,[.05,0,.62],10),Z(e,.1,.16,1.3,[.08,3,-.42],n,`rear scaffold branch`,[.6,0,.12],10);for(let[t,n]of[{p:[-.95,3.55,.05],s:[1.35,1,1.12],light:!1},{p:[.75,3.65,.12],s:[1.25,1.05,1.18],light:!0},{p:[0,4.15,0],s:[1.35,1.12,1.2],light:!1},{p:[-.25,3.62,-.95],s:[1.15,.9,1.15],light:!0},{p:[.34,3.46,.98],s:[1.25,.93,1.12],light:!1},{p:[-1.15,3.18,-.62],s:[.9,.82,.9],light:!0},{p:[1.22,3.2,.58],s:[.94,.84,.9],light:!1}].entries()){let a=new fa(.86,this.quality===`high`?2:1);Of(a,1),kf(a);let o=new K(a,n.light?i:r);o.name=`layered foliage cluster ${t+1}`,o.position.set(...n.p),o.scale.set(...n.s),o.rotation.set(t*.17,t*.73,t*.11),o.castShadow=t<4,o.receiveShadow=!0,e.add(o)}qf(e,.72,.035,[0,.62,0],a,`tree guard ring`,[Math.PI/2,0,0],24,!1);for(let t=0;t<3;t+=1){let n=Af(.72,t/3*Math.PI*2,.4);X(e,[.055,.78,.055],[n.x,n.y,n.z],a,`tree guard upright`,.015,Y,!1,!0)}return e.userData.windResponsive=!0,e}createTieredFountain(){let e=Xf(`Tiered Bronze Fountain`,`placeable`),t=this.materials.get(`concrete`),n=this.materials.get(`concreteDark`),r=this.materials.paint(11042890,.42),i=this.materials.paint(8215601,.5),a=this.materials.get(`brass`),o=this.materials.paint(9422036,.14),s=this.materials.get(`steelDark`),c=this.quality===`high`?36:24;Z(e,2.36,2.42,.14,[0,.07,0],t,`basin foundation ring`,Y,c,!1,!0),Z(e,2.16,2.22,.46,[0,.23,0],t,`stone basin wall`,Y,c),Z(e,2.03,2.03,.02,[0,.48,0],o,`basin water surface`,Y,c,!1,!1),qf(e,2.16,.13,[0,.5,0],t,`basin coping ring`,[Math.PI/2,0,0],c);for(let t=0;t<8;t+=1){let r=t/8*Math.PI*2,i=Af(2.2,r,.24);X(e,[.05,.42,.05],[i.x,i.y,i.z],n,`basin masonry joint`,.012,[0,-r,0],!1,!1)}Z(e,.52,.66,.78,[0,.89,0],n,`fountain pedestal`,Y,18),qf(e,.56,.07,[0,1.24,0],r,`pedestal collar`,[Math.PI/2,0,0],20,!1),Z(e,1.24,.56,.42,[0,1.46,0],r,`lower bronze bowl`,Y,24),qf(e,1.24,.07,[0,1.65,0],i,`lower bowl rim`,[Math.PI/2,0,0],28);for(let t=0;t<10;t+=1){let n=Af(1.16,t/10*Math.PI*2,1.34);$(e,[0,1.2,0],[n.x,n.y,n.z],.035,i,`bowl support rib`,!1)}Z(e,.2,.28,.98,[0,2.14,0],r,`bronze standpipe`,Y,14),Z(e,.66,.28,.28,[0,2.68,0],r,`upper bronze bowl`,Y,20),qf(e,.66,.05,[0,2.8,0],i,`upper bowl rim`,[Math.PI/2,0,0],22,!1),Q(e,.14,[0,3,0],i,`fountain finial`,[1,1.2,1],!1,12),Z(e,.035,.075,.95,[0,3.55,0],o,`central water jet`,Y,10,!1,!1);let l=[];for(let t of[{top:1.24,bottom:1.34,height:.46,y:1.44,name:`lower bowl overflow skirt`},{top:.66,bottom:.74,height:.34,y:2.65,name:`upper bowl overflow skirt`}]){let n=new Ii(t.top,t.bottom,t.height,20,1,!0);Of(n,1),kf(n);let r=new K(n,o);r.name=t.name,r.position.y=t.y,e.add(r),l.push(r)}for(let t=0;t<6;t+=1){let n=Af(1.86,t/6*Math.PI*2+.26,.72);Z(e,.055,.075,.22,[n.x,n.y,n.z],a,`basin jet nozzle`,[0,0,0],10),$(e,[n.x,n.y+.08,n.z],[n.x*.74,1.36,n.z*.74],.022,o,`arcing water jet`,!1)}X(e,[.52,.3,.05],[0,.4,2.2],i,`dedication plaque`,.015,Y,!1,!0);for(let t=0;t<6;t+=1){let n=Af(2.02,t/6*Math.PI*2+.5,.7);Jf(e,[n.x,n.y,n.z],s,Y,.03)}let u=new ha(1,.035,6,c);Of(u,1),kf(u);let d=[0,1,2].map(t=>{let n=new K(u,o);return n.name=`basin ripple ring ${t+1}`,n.rotation.x=Math.PI/2,n.position.y=.51,e.add(n),n});return this.registerAnimation(e,({elapsed:e,delta:t,activity:n})=>{for(let e of l)e.rotation.y+=t*.42;for(let[t,r]of d.entries()){let i=(e*.35+t/d.length)%1,a=.3+i*1.6;r.scale.set(a,1-i*.55,a),r.visible=n>0}}),e}createBlossomPlanter(){let e=Xf(`Blossom Planter`,`placeable`),t=this.materials.get(`concrete`),n=this.materials.get(`timber`),r=this.materials.get(`timberDark`),i=this.materials.get(`steelDark`),a=this.materials.get(`steel`),o=this.materials.get(`soil`),s=this.materials.get(`leaf`),c=this.materials.get(`leafLight`),l=this.materials.get(`brass`),u=this.materials.paint(14976925,.62),d=this.materials.paint(15982502,.62);X(e,[1.74,.08,1.74],[0,.04,0],t,`planter paving pad`,.03,Y,!1,!0);for(let t of[-.7,.7])for(let n of[-.7,.7])X(e,[.12,.66,.12],[t,.37,n],i,`planter corner post`,.022),Jf(e,[t,.24,n+Math.sign(n)*.06],a,[Math.PI/2,0,0],.024);for(let[t,i]of[[`x`,-.7],[`x`,.7],[`z`,-.7],[`z`,.7]]){for(let a=0;a<3;a+=1)X(e,t===`z`?[1.42,.17,.07]:[.07,.17,1.42],t===`z`?[0,.24+a*.2,i]:[i,.24+a*.2,0],a===1?r:n,`planter side slat`,.02);X(e,t===`z`?[1.6,.08,.16]:[.16,.08,1.6],t===`z`?[0,.72,i]:[i,.72,0],r,`planter rim cap`,.02,Y,!1,!0)}X(e,[1.32,.18,1.32],[0,.6,0],o,`planting compost`,.03,Y,!1,!0);for(let[t,n]of[{p:[-.32,.86,-.28],s:.34,light:!1},{p:[.3,.9,-.22],s:.3,light:!0},{p:[.02,.98,.06],s:.36,light:!1},{p:[-.28,.84,.34],s:.28,light:!0},{p:[.34,.86,.32],s:.3,light:!1}].entries()){let r=new fa(n.s,this.quality===`high`?2:1);Of(r,1),kf(r);let i=new K(r,n.light?c:s);i.name=`planted foliage cluster ${t+1}`,i.position.set(...n.p),i.scale.set(1,.82,1),i.rotation.set(t*.31,t*.87,t*.19),i.castShadow=t<3,i.receiveShadow=!0,e.add(i)}for(let t=0;t<14;t+=1){let n=t/14*Math.PI*2+.4,r=Af(.26+t%3*.14,n,1.03+t%4*.05);$(e,[r.x,r.y-.16,r.z],[r.x,r.y,r.z],.014,s,`blossom stem`,!1),Q(e,.065,[r.x,r.y,r.z],t%2==0?u:d,`open blossom`,[1,.7,1],!1,8)}return X(e,[.2,.11,.02],[.38,.5,.755],l,`nursery name tag`,.006,Y,!1,!0),e}createParkGate(){let e=Xf(`Parkworks Entrance Gate`,`gate`),t=this.materials.get(`brick`),n=this.materials.get(`concrete`),r=this.materials.get(`steelDark`),i=this.materials.get(`paintTeal`),a=this.materials.get(`brass`),o=this.materials.get(`lampGlow`);X(e,[11.5,.14,2.3],[0,.07,0],n,`gate pavement slab`,.06,Y,!1,!0);for(let i of[-4.2,4.2])X(e,[1.35,3.75,1.35],[i,1.95,0],t,`gate masonry pier`,.06),X(e,[1.55,.2,1.55],[i,.22,0],n,`pier footing`,.055),X(e,[1.52,.18,1.52],[i,3.9,0],n,`pier cap`,.065),X(e,[1.43,.12,1.43],[i,2.35,0],n,`pier belt course`,.025),X(e,[.44,.62,.18],[i,2.85,.73],r,`shielded gate lantern`,.055),Q(e,.13,[i,2.71,.83],o,`gate lantern lens`,[1.25,.75,.6],!1,10);X(e,[7.18,.34,.42],[0,3.75,0],r,`gate header beam`,.06),$(e,[-3.52,3.92,0],[-2.7,4.72,0],.075,i,`left arch chord`),$(e,[-2.7,4.72,0],[0,5.05,0],.075,i,`left arch chord`),$(e,[0,5.05,0],[2.7,4.72,0],.075,i,`right arch chord`),$(e,[2.7,4.72,0],[3.52,3.92,0],.075,i,`right arch chord`);for(let t of[-2.7,-1.35,0,1.35,2.7]){let n=5.05-Math.abs(t)*.13;$(e,[t,3.92,0],[t,n,0],.035,a,`arch hanger`,!1)}X(e,[5.5,.82,.2],[0,4.35,.05],i,`entrance sign chassis`,.085),this.addSign(e,`PARKWORKS`,[5.15,.64],[0,4.36,.17],2647658,16178864,`ADVENTURE GARDENS`);for(let t of[-2.1,0,2.1]){Z(e,.1,.13,1.05,[t,.61,.18],r,`turnstile pedestal`,Y,12),Z(e,.12,.12,.26,[t,1.12,.18],a,`turnstile hub`,[Math.PI/2,0,0],12,!1,!0);for(let n=0;n<3;n+=1){let r=n/3*Math.PI*2;$(e,[t,1.12,.18],[t+Math.cos(r)*.62,1.12+Math.sin(r)*.62,.18],.025,ep(this.materials),`turnstile arm`,!1)}X(e,[.48,.12,.4],[t,.12,.18],r,`turnstile anchor plate`,.035,Y,!1,!0)}for(let t of[-1,1]){let n=t*5.3;X(e,[2.05,.09,.09],[n,1,0],r,`gate side rail`,.02,Y,!1,!0),X(e,[2.05,.09,.09],[n,1.65,0],r,`gate side rail`,.02,Y,!1,!0);for(let n of[t*4.75,t*5.85])X(e,[.1,1.9,.1],[n,.98,0],r,`gate fence post`,.025,Y,!1,!0)}return e.userData.spawnPoint=[0,0,-2.4],e.userData.exitPoint=[0,0,2.4],e}createLandscape(e={}){let t=Math.max(40,e.width??64),n=Math.max(46,e.depth??66),r=Xf(`Parkworks Landscape`,`landscape`),i=this.materials.get(`grass`),a=this.materials.get(`path`),o=this.materials.get(`concrete`),s=this.materials.get(`soil`),c=this.materials.get(`steelDark`),l=Ef(t,n,i,{name:`meter-scaled grass parcel`,position:[0,-.08,0],rotation:[-Math.PI/2,0,0],receiveShadow:!0,castShadow:!1,texelScale:1});if(r.add(l),e.includePromenade!==!1){X(r,[5.8,.11,n-4],[0,-.005,0],a,`north south promenade`,.08,Y,!1,!0),X(r,[t-8,.11,5.8],[0,.002,-.6],a,`east west promenade`,.08,Y,!1,!0);for(let e of[-3.02,3.02])X(r,[.16,.14,n-4],[e,.02,0],o,`promenade edge restraint`,.035,Y,!1,!0);for(let e of[-3.62,2.42])X(r,[t-8,.14,.16],[0,.025,e],o,`cross path edge restraint`,.035,Y,!1,!0);for(let[e,t]of[[-8,-8],[8,-8],[-8,8],[8,8]]){Z(r,1.4,1.55,.12,[e,.01,t],s,`ornamental planting bed`,Y,18,!1,!0),qf(r,1.47,.055,[e,.08,t],o,`planting bed curb`,[Math.PI/2,0,0],24,!1);for(let n=0;n<5;n+=1){let i=Af(.72,n/5*Math.PI*2+e*.03,.24);Q(r,.23,[e+i.x,i.y,t+i.z],n%2==0?this.materials.get(`leafLight`):this.materials.get(`leaf`),`planting mound`,[1,.75,1],!1,8)}}}return e.includeFence!==!1&&this.addBoundaryFence(r,t,n,c),r.userData.bounds={minX:-t/2,maxX:t/2,minZ:-n/2,maxZ:n/2},r.userData.buildBounds={minX:-27,maxX:27,minZ:-27,maxZ:27},r}createPlayer(){let e=this.createHumanoid({name:`Park Caretaker`,shirt:3234949,trousers:2503227,skin:14395263,hair:3877410,worker:!0});return e.userData.assetType=`player`,e.userData.motion=0,e}createGuest(e={}){let t=typeof e==`number`?{paletteIndex:e}:e,n=Math.abs(Math.floor(t.paletteIndex??0)),r=this.createHumanoid({name:`Park Guest ${n+1}`,shirt:Uf[n%Uf.length]??Uf[0],trousers:Wf[n%Wf.length]??Wf[0],skin:Gf[n%Gf.length]??Gf[0],hair:Kf[n*3%Kf.length]??Kf[0],worker:!1});return r.name=`Guest ${n+1}`,r.userData.assetType=`guest`,r.userData.paletteIndex=n,r.userData.motion=0,r.userData.carryingTrash=t.carryingTrash??!1,r.scale.setScalar(Math.max(.72,Math.min(1.08,t.ageScale??1))),r}createJanitor(e=0){let t=Math.abs(Math.floor(e)),n=this.createHumanoid({name:`Park Janitor ${t+1}`,shirt:2898500,trousers:2764855,skin:Gf[t%Gf.length]??Gf[0],hair:Kf[t*2%Kf.length]??Kf[0],worker:!0,vest:14709276});return n.name=`Janitor ${t+1}`,n.userData.assetType=`janitor`,n.userData.paletteIndex=t,n.userData.motion=0,n}createLitter(e=0){let t=Xf(`Litter ${e}`,`litter`),n=(Math.floor(e)%4+4)%4;if(n===0)X(t,[.28,.025,.22],[0,.035,0],this.materials.get(`cardboard`),`creased food wrapper`,.015,[.08,.35,-.06],!1,!0),X(t,[.11,.012,.2],[.12,.055,.02],this.materials.get(`paper`),`wrapper folded flap`,.006,[.13,-.2,.22],!1,!0);else if(n===1)Z(t,.09,.065,.24,[0,.13,0],this.materials.get(`paper`),`discarded drink cup`,[.1,0,.25],12,!1,!0),Z(t,.095,.095,.018,[-.03,.24,0],this.materials.get(`paintWhite`),`cup lid`,[.1,0,.25],12,!1,!0),Z(t,.009,.009,.2,[-.08,.34,0],this.materials.get(`paintRed`),`cup straw`,[.08,0,.42],7,!1,!1);else if(n===2){let e=new K(new pa(.34,.26,2,2),this.materials.get(`paper`));e.name=`crumpled napkin`,e.rotation.set(-Math.PI/2+.08,.45,.12),e.position.y=.025,e.scale.set(1,.75,1),e.receiveShadow=!0,t.add(e)}else Z(t,.065,.065,.25,[0,.08,0],this.materials.get(`steel`),`aluminum can`,[Math.PI/2,.18,.4],12,!1,!0),Z(t,.05,.05,.01,[.1,.15,-.04],this.materials.get(`steelDark`),`can pull tab`,[Math.PI/2,.18,.4],10,!1,!1);return t.userData.variant=n,t.userData.collectRadius=1.7,t}animate(e,t,n,r){let i=this.animationHooks.get(e);if(!i)return;let a=e.userData.motion,o={elapsed:t,delta:Math.min(Math.max(n,0),.1),activity:Math.max(0,Math.min(1.5,r??(typeof a==`number`?a:1)))};for(let e of i)e(o)}setCharacterMotion(e,t,n){e.userData.motion=Math.max(0,Math.min(1.5,t)),n!==void 0&&(e.userData.carryingTrash=n)}dispose(){for(let e of this.signMaterials.values())e.dispose();for(let e of this.signTextures)e.dispose();this.signMaterials.clear(),this.signTextures.clear(),this.ownsMaterials&&this.materials.dispose()}buildRailwayLocomotive(){let e=new Tn;e.name=`miniature railway train animation pivot`;let t=this.materials.get(`steelDark`),n=this.materials.get(`paintGreen`),r=this.materials.get(`paintRed`),i=this.materials.get(`brass`),a=this.materials.get(`steel`),o=this.materials.get(`rubber`),s=this.materials.get(`lampGlow`),c=this.materials.get(`timber`);X(e,[1.06,.14,2.42],[0,.24,0],t,`locomotive footplate`,.03),Z(e,.31,.31,1.44,[0,.66,.28],n,`boiler barrel`,[Math.PI/2,0,0],16),Z(e,.34,.34,.24,[0,.66,1.05],t,`smokebox`,[Math.PI/2,0,0],16),Z(e,.19,.19,.05,[0,.66,1.19],i,`smokebox door ring`,[Math.PI/2,0,0],14,!1,!0);for(let t of[-.15,.42])Z(e,.32,.32,.055,[0,.66,t],i,`boiler band`,[Math.PI/2,0,0],16,!1,!0);Z(e,.1,.12,.4,[0,1.12,.86],t,`chimney`,Y,12),Z(e,.16,.13,.09,[0,1.34,.86],i,`chimney cap`,Y,12,!1,!0),Z(e,.15,.15,.2,[0,1,.22],i,`steam dome`,Y,12),Z(e,.045,.045,.14,[0,1.14,.22],i,`safety valve`,Y,8,!1,!0),X(e,[.16,.12,.1],[0,.98,-.16],i,`whistle mount`,.02,Y,!1,!0),X(e,[1.02,.86,.86],[0,.79,-.78],n,`driver cab`,.06),X(e,[1.16,.09,.98],[0,1.28,-.8],t,`cab roof`,.03);for(let t of[-1,1])X(e,[.02,.36,.42],[t*.52,.92,-.72],this.materials.get(`glass`),`cab side window`,.006,Y,!1,!1),$(e,[t*.34,.92,1.16],[t*.34,.92,-.28],.016,i,`boiler handrail`,!1),Z(e,.06,.06,.08,[t*.34,.92,.44],i,`handrail knob`,[Math.PI/2,0,0],8,!1,!1);X(e,[.72,.1,.5],[0,.34,-1.06],c,`coal bunker lid`,.02,Y,!1,!0),X(e,[1.12,.19,.11],[0,.31,1.24],r,`front buffer beam`,.025);for(let t of[-1,1])Z(e,.075,.075,.13,[t*.36,.31,1.32],a,`buffer head`,[Math.PI/2,0,0],10,!1,!0);X(e,[.18,.18,.14],[0,.55,1.28],t,`headlamp housing`,.03,Y,!1,!0),Q(e,.06,[0,.55,1.37],s,`headlamp lens`,[1,1,.55],!1,8),$(e,[0,.24,-1.28],[0,.24,-1.42],.035,t,`drawbar coupling`,!1);for(let n of[-1,1]){for(let t of[.72,.06,-.62])Z(e,.21,.21,.09,[n*.47,.21,t],o,`driving wheel tyre`,[Math.PI/2,0,0],14),Z(e,.07,.07,.13,[n*.47,.21,t],i,`wheel bearing hub`,[Math.PI/2,0,0],10,!1,!0);X(e,[.045,.07,1.44],[n*.55,.29,.05],a,`coupling rod`,.014,Y,!1,!1),X(e,[.2,.24,.34],[n*.44,.36,.98],t,`cylinder block`,.04)}return e}buildRailwayCarriage(e){let t=new Tn;t.name=`railway carriage ${e} animation pivot`;let n=this.materials.get(`steelDark`),r=this.materials.get(`timber`),i=this.materials.get(`paintCream`),a=this.materials.get(`brass`),o=this.materials.get(`rubber`),s=e===1?this.materials.get(`paintRed`):this.materials.get(`paintTeal`);X(t,[1.04,.12,1.86],[0,.26,0],n,`carriage underframe`,.03),X(t,[1,.09,1.74],[0,.35,0],r,`carriage floor planking`,.02,Y,!1,!0);for(let e of[-1,1]){for(let n=0;n<3;n+=1)X(t,[.07,.13,1.74],[e*.48,.5+n*.17,0],s,`carriage side slat`,.02);$(t,[e*.48,.94,.85],[e*.48,.94,-.85],.022,a,`carriage grab rail`,!1);for(let n of[.6,-.6])Z(t,.17,.17,.08,[e*.5,.18,n],o,`carriage wheel`,[Math.PI/2,0,0],12),Z(t,.055,.055,.11,[e*.5,.18,n],a,`carriage axle bearing`,[Math.PI/2,0,0],8,!1,!0)}for(let e of[.88,-.88])X(t,[1.02,.62,.07],[0,.66,e],s,`carriage end panel`,.025);for(let e of[.42,-.42])X(t,[.88,.09,.36],[0,.55,e],r,`carriage bench seat`,.025),X(t,[.88,.24,.07],[0,.68,e+Math.sign(e)*.18],i,`carriage seat back`,.025);return $(t,[0,.26,1],[0,.26,1.16],.03,n,`carriage coupling`,!1),t}buildCoasterCar(e,t,n,r,i,a){let o=new Tn;o.name=e===0?`meteor coaster train animation pivot`:`meteor coaster car ${e+1} pivot`;let s=this.materials.get(`paintCream`),c=this.materials.get(`rubber`);if(X(o,[1.02,.28,2.25],[0,.06,0],n,`car chassis frame`,.05),X(o,[1.12,.56,2.1],[0,.42,0],t,`moulded car shell`,.22),e===0){let e=new Li(.52,.85,14);Of(e,1),kf(e);let n=new K(e,t);n.name=`car nose cone`,n.position.set(0,.42,1.42),n.rotation.x=Math.PI/2,n.castShadow=!0,n.receiveShadow=!0,o.add(n),Q(o,.07,[0,.5,1.78],a,`train marker lamp`,[1,.7,.7],!1,8)}X(o,[.94,.06,1.9],[0,.72,-.05],s,`car body trim stripe`,.02,Y,!1,!0);for(let e of[.52,-.52]){X(o,[.94,.16,.46],[0,.66,e],n,`seat pan`,.06),X(o,[.94,.52,.14],[0,.94,e-.28],s,`seat back`,.05);for(let t of[-1,1])$(o,[t*.24,1.16,e-.2],[t*.24,.78,e+.16],.05,i,`over shoulder restraint`,!1),X(o,[.1,.1,.16],[t*.24,1.2,e-.24],n,`restraint pivot housing`,.02,Y,!1,!1)}for(let e of[-1,1]){for(let t of[.78,-.78])Z(o,.13,.13,.1,[e*.5,.06,t],c,`road wheel`,[0,0,Math.PI/2],10,!1,!0),Z(o,.1,.1,.08,[e*.58,-.16,t],c,`upstop wheel`,[0,0,Math.PI/2],10,!1,!0),Z(o,.1,.1,.08,[e*.62,-.05,t],c,`side friction wheel`,[Math.PI/2,0,0],10,!1,!0);X(o,[.07,.3,1.7],[e*.56,-.08,0],r,`wheel carrier bogie`,.02,Y,!1,!0)}return $(o,[0,.06,-1.2],[0,.06,-1.38],.045,r,`car coupling`,!1),o}trackFrameAt(e,t,n){let r=(t%1+1)%1,i=e.getPointAt(r),a=e.getTangentAt(r).normalize(),o=new H().crossVectors(Hf,a);o.lengthSq()<1e-6&&o.set(1,0,0),o.normalize();let s=new H().crossVectors(a,o).normalize();if(n!==0){let t=e.getTangentAt((r+.008)%1).normalize(),i=Math.atan2(t.x,t.z)-Math.atan2(a.x,a.z),c=Math.max(-.7,Math.min(.7,Math.atan2(Math.sin(i),Math.cos(i))*n)),l=new Ot().setFromAxisAngle(a,c);o.applyQuaternion(l),s.applyQuaternion(l)}return{position:i,forward:a,right:o,up:s}}setOnTrack(e,t,n){e.position.copy(t.position).addScaledVector(t.up,n),e.quaternion.setFromRotationMatrix(new Xt().makeBasis(t.right,t.up,t.forward))}addTrack(e,t,n){let r=[];for(let e=0;e<n.samples;e+=1)r.push(this.trackFrameAt(t,e/n.samples,n.bankStrength));for(let t of[-1,1]){let i=new ga(new Ji(r.map(e=>e.position.clone().addScaledVector(e.right,t*n.gauge/2)),!0,`catmullrom`,.5),n.samples,n.railRadius,6,!0);Of(i,1),kf(i);let a=new K(i,n.railMaterial);a.name=`${n.name} running rail`,a.castShadow=!0,a.receiveShadow=!0,e.add(a)}if(n.spine){let t=new ga(new Ji(r.map(e=>e.position.clone().addScaledVector(e.up,n.spine.offset)),!0,`catmullrom`,.5),n.samples,n.spine.radius,8,!0);Of(t,1),kf(t);let i=new K(t,n.spine.material);i.name=`${n.name} structural spine`,i.castShadow=!0,i.receiveShadow=!0,e.add(i)}let i=Math.max(8,Math.round(t.getLength()*n.tie.perMetre)),a=new _f(...n.tie.size,1,.018);Of(a,1),kf(a);let o=new ci(a,n.tie.material,i);o.name=`${n.name} instanced cross tie`,o.castShadow=!0,o.receiveShadow=!0;let s=n.spine?n.tie.offset-n.spine.offset:0,c=n.spine?new ci((()=>{let e=new _f(.075,Math.abs(s),.075,1,.015);return Of(e,1),kf(e),e})(),n.spine.material,i):null;c&&(c.name=`${n.name} instanced spine strut`,c.castShadow=!0,c.receiveShadow=!0);let l=new H(1,1,1);for(let e=0;e<i;e+=1){let r=this.trackFrameAt(t,e/i,n.bankStrength),a=new Ot().setFromRotationMatrix(new Xt().makeBasis(r.right,r.up,r.forward));Zf(o,e,r.position.clone().addScaledVector(r.up,n.tie.offset),a,l),c&&Zf(c,e,r.position.clone().addScaledVector(r.up,n.tie.offset-s/2),a,l)}return o.instanceMatrix.needsUpdate=!0,e.add(o),c&&(c.instanceMatrix.needsUpdate=!0,e.add(c)),r}addTrackSupports(e,t,n,r,i,a){for(let o=0;o<t.length;o+=a){let a=t[o];if(!a||a.position.y<2.2)continue;let{x:s,y:c,z:l}=a.position;if(t.some(e=>e===a||e.position.y>c-1.1||e.position.y<.4?!1:Math.hypot(e.position.x-s,e.position.z-l)<1.35))continue;let u=c-.42;X(e,[.26,u,.26],[s,u/2,l],n,`track support column`,.04),X(e,[.68,.16,.68],[s,.1,l],i,`support column footing`,.03,Y,!1,!0);let d=new H(a.right.x,0,a.right.z);d.lengthSq()<1e-6&&d.set(1,0,0),d.normalize();for(let t of[-1,1]){let n=new H(s,.22,l).addScaledVector(d,t*1.05);$(e,[s,u*.62,l],[n.x,n.y,n.z],.045,r,`support diagonal brace`,!1)}for(let t of[-.19,.19])Jf(e,[s+t,.2,l+.2],r,Y,.03)}}trackSection(e,t,n,r){let i=[];for(let a=0;a<=r;a+=1)i.push(e.getPointAt(((t+(n-t)*a/r)%1+1)%1));return i}addBoundaryFence(e,t,n,r){let i=3.2,a=[];for(let e=-t/2;e<=t/2+.01;e+=i)a.push(new H(e,.72,-n/2)),Math.abs(e)>5.6&&a.push(new H(e,.72,n/2));for(let e=-n/2+i;e<n/2;e+=i)a.push(new H(-t/2,.72,e),new H(t/2,.72,e));let o=new _f(.13,1.42,.13,1,.025);Of(o,1),kf(o);let s=new ci(o,r,a.length);s.name=`instanced boundary fence posts`,s.receiveShadow=!0;let c=new Ot;for(let[e,t]of a.entries())Zf(s,e,t,c);s.instanceMatrix.needsUpdate=!0,e.add(s);for(let i of[.55,1.08])X(e,[t,.065,.07],[0,i,-n/2],r,`north boundary rail`,.018,Y,!1,!0),X(e,[(t-11.2)/2,.065,.07],[-(t+11.2)/4,i,n/2],r,`south boundary rail`,.018,Y,!1,!0),X(e,[(t-11.2)/2,.065,.07],[(t+11.2)/4,i,n/2],r,`south boundary rail`,.018,Y,!1,!0),X(e,[.07,.065,n],[-t/2,i,0],r,`west boundary rail`,.018,Y,!1,!0),X(e,[.07,.065,n],[t/2,i,0],r,`east boundary rail`,.018,Y,!1,!0)}createHumanoid(e){let t=Xf(e.name,`character`),n=this.materials.paint(e.shirt,.68),r=this.materials.paint(e.trousers,.74),i=this.materials.paint(e.skin,.6),a=this.materials.paint(e.hair,.78),o=this.materials.get(`rubber`),s=this.materials.get(`steelDark`),c=X(t,[.52,.66,.29],[0,1.2,0],n,`seamed torso garment`,.14);c.scale.x=1.02,X(t,[.48,.12,.3],[0,.84,0],r,`waistband`,.045,Y,!1,!0),Z(t,.15,.16,.2,[0,1.67,0],i,`neck`,Y,10,!1,!0),Q(t,.25,[0,1.93,.01],i,`head`,[.9,1.08,.92],!0,14),Q(t,.245,[0,2.04,-.025],a,`hair cap`,[.93,.58,.94],!0,12),X(t,[.055,.035,.02],[-.085,1.95,.235],s,`left eye`,.009,Y,!1,!1),X(t,[.055,.035,.02],[.085,1.95,.235],s,`right eye`,.009,Y,!1,!1);let l=new Tn,u=new Tn;l.name=`left arm rig`,u.name=`right arm rig`,l.position.set(-.35,1.43,0),u.position.set(.35,1.43,0),t.add(l,u);for(let[e,t]of[[l,-1],[u,1]])Z(e,.075,.085,.48,[0,-.22,0],n,`sleeved upper arm`,Y,9),Z(e,.065,.075,.38,[0,-.62,0],i,`forearm`,Y,9),Q(e,.075,[0,-.84,0],i,`hand`,[.9,1.1,.8],!1,9),e.rotation.z=t*.06;let d=new Tn,f=new Tn;d.name=`left leg rig`,f.name=`right leg rig`,d.position.set(-.145,.82,0),f.position.set(.145,.82,0),t.add(d,f);for(let e of[d,f])Z(e,.095,.105,.68,[0,-.31,0],r,`trouser leg`,Y,10),X(e,[.21,.13,.34],[0,-.7,.075],o,`assembled shoe`,.065),X(e,[.18,.035,.3],[0,-.78,.09],this.materials.get(`steel`),`shoe sole edge`,.018,Y,!1,!0);let p=new Tn;if(p.name=`carried trash prop`,p.position.set(0,-.86,.08),u.add(p),X(p,[.16,.025,.13],[0,0,0],this.materials.get(`paper`),`carried wrapper`,.012,[.15,.25,0],!1,!1),p.visible=!1,e.vest!==void 0){let n=this.materials.paint(e.vest,.62),r=this.materials.get(`paintWhite`);X(t,[.6,.56,.4],[0,1.24,0],n,`high visibility over vest`,.1);for(let e of[-1,1])X(t,[.15,.2,.42],[e*.22,1.46,0],n,`vest shoulder panel`,.05);for(let e of[.205,-.205])X(t,[.62,.07,.02],[0,1.32,e],r,`vest retroreflective band`,.008,Y,!1,!1);X(t,[.16,.14,.02],[-.18,1.1,.205],r,`vest pocket flap`,.008,Y,!1,!1),Q(t,.27,[0,2.02,.005],r,`hard hat shell`,[.94,.62,.98],!0,12),X(t,[.56,.045,.56],[0,1.88,.02],r,`hard hat brim`,.02,Y,!1,!0)}if(e.worker){let r=this.materials.get(`paintYellow`),i=e.vest===void 0?.16:.21;X(t,[.47,.08,.018],[0,1.38,i],r,`high visibility chest stripe`,.012,Y,!1,!1),X(t,[.47,.08,.018],[0,1.18,i],r,`high visibility waist stripe`,.012,Y,!1,!1),X(t,[.48,.4,.12],[0,1.25,-.2],this.materials.get(`paintBlue`),`maintenance backpack`,.08),e.vest===void 0&&(X(t,[.34,.1,.38],[0,2.16,.03],n,`caretaker cap crown`,.07),X(t,[.34,.035,.23],[0,2.13,.24],n,`caretaker cap brim`,.03,[-.05,0,0],!1,!0)),$(t,[.36,1.18,-.05],[.45,.35,.18],.018,this.materials.get(`galvanized`),`litter picker tool`,!1)}else e.shirt&1||(X(t,[.34,.4,.13],[0,1.24,-.2],this.materials.paint(e.shirt^2105376,.72),`guest daypack`,.07),X(t,[.035,.46,.035],[-.16,1.27,-.15],s,`daypack strap`,.012,Y,!1,!1),X(t,[.035,.46,.035],[.16,1.27,-.15],s,`daypack strap`,.012,Y,!1,!1));let m=new Tn;m.name=`character vertical motion rig`;let h=[...t.children];return t.add(m),m.add(...h),t.userData.characterRig=!0,this.registerAnimation(t,({elapsed:e,activity:n})=>{let r=e*(7.2+n*1.6),i=Math.sin(r)*.55*n;d.rotation.x=i,f.rotation.x=-i,l.rotation.x=-i*.72,u.rotation.x=i*.72,m.position.y=Math.abs(Math.sin(r))*.025*n,p.visible=!!t.userData.carryingTrash}),t}addSign(e,t,n,r,i,a,o=``){let s=this.getSignMaterial(t,o,i,a),c=new pa(n[0],n[1]);kf(c);let l=new K(c,s);l.name=`${t.toLowerCase()} sign decal`,l.position.set(...r),l.castShadow=!1,l.receiveShadow=!1,e.add(l)}getSignMaterial(e,t,n,r){let i=`${e}|${t}|${n}|${r}`,a=this.signMaterials.get(i);if(a)return a;let o=new G(n),s=new G(r),c;if(typeof document<`u`){let n=document.createElement(`canvas`);n.width=384,n.height=128;let r=n.getContext(`2d`);if(r){r.fillStyle=`#${o.getHexString()}`,r.fillRect(0,0,n.width,n.height);let i=r.createLinearGradient(0,0,0,n.height);i.addColorStop(0,`rgba(255,255,255,0.12)`),i.addColorStop(.45,`rgba(255,255,255,0)`),i.addColorStop(1,`rgba(0,0,0,0.15)`),r.fillStyle=i,r.fillRect(0,0,n.width,n.height),r.strokeStyle=`#${s.getHexString()}`,r.lineWidth=5,r.strokeRect(9,9,n.width-18,n.height-18),r.textAlign=`center`,r.textBaseline=`middle`,r.fillStyle=`#${s.getHexString()}`,r.font=`700 ${t?42:50}px system-ui, sans-serif`,r.fillText(e,n.width/2,t?50:65,n.width-34),t&&(r.font=`600 17px system-ui, sans-serif`,r.letterSpacing=`2px`,r.fillText(t,n.width/2,94,n.width-40)),c=new ji(n),c.colorSpace=ze,c.anisotropy=4,c.needsUpdate=!0,this.signTextures.add(c)}}let l=new Da({name:`parkworks/sign-${e.toLowerCase().replace(/\s+/g,`-`)}`,color:c?16777215:n,...c?{map:c}:{},roughness:.39,metalness:.04,side:2,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1});return this.signMaterials.set(i,l),l}registerAnimation(e,t){let n=this.animationHooks.get(e)??[];n.push(t),this.animationHooks.set(e,n),e.userData.animated=!0,e.userData.animate=(t,n)=>{let r=e.userData.characterRig?e.userData.isWalking?1:typeof e.userData.motion==`number`?e.userData.motion:0:1;this.animate(e,t,n,r)}}};function ep(e){return e.get(`galvanized`)}var tp={burger:`<path d="M5 10.5h14M6.5 8.5c.4-3 2.5-4.5 5.5-4.5s5.1 1.5 5.5 4.5M5 13.5h14l-1 4H6l-1-4Z"/>`,cup:`<path d="m8 7 1 12h7l1-12H8Zm1-3h8M14 7l2-4"/>`,"ice-cream":`<path d="M9 10h6l-3 10-3-10Zm-.5-2.5a3.5 3.5 0 1 1 7 0c0 .9-.3 1.7-.9 2.5H9.4a4 4 0 0 1-.9-2.5Z"/>`,pizza:`<path d="M12 3 4.5 18.5a17 17 0 0 0 15 0L12 3Zm-2 8h.01M14 12.5h.01M12 16h.01"/>`,carousel:`<path d="M5 9h14L16 4H8L5 9Zm2 0v10m10-10v10M4 19h16M9 12h2v4H9v-4Zm5 0h2v4h-2v-4Z"/>`,wheel:`<circle cx="12" cy="11" r="8"/><circle cx="12" cy="11" r="1.5"/><path d="M12 3v16M4 11h16m-2.3-5.7L6.3 16.7m0-11.4 11.4 11.4M9 21l3-10 3 10"/>`,"bumper-car":`<path d="M5 13h14l1 3v2h-2l-1 2H7l-1-2H4v-2l1-3Zm2 0 1-4h8l1 4M8 9l2-3h4l2 3M7 16h.01M17 16h.01"/>`,"drop-tower":`<path d="M10 21V4h4v17M8 21h8M9 7h6M9 11h6M9 15h6M6 14h12v4H6v-4Zm6-10V2"/>`,"pirate-ship":`<path d="M4 14h16l-2 5H7l-3-5Zm8 0V4m0 1 5 4h-5M6 14l2-3m10 3-2-3M3 21h18"/>`,train:`<path d="M4 16V8h6l2.5 3.5H19V16H4Zm3-11h3v3H7V5Zm-5 16h20"/><circle cx="8" cy="18" r="1.6"/><circle cx="16" cy="18" r="1.6"/>`,coaster:`<path d="M2.5 19.5c1.5-9 4.5-13.5 8-13.5 3 0 4.5 3.5 5.5 7.5.7 2.8 1.7 4 3.5 4"/><path d="M6 12.5v7M11 6.5v13M16.5 14v5.5M2 21h20"/><path d="M8.6 3.4h3.6l.5 2.2H8.2l.4-2.2Z"/>`,restroom:`<path d="M8 4a2 2 0 1 0 0 .01M6 8h4v5H9v7H7v-7H6V8Zm10-4a2 2 0 1 0 0 .01M14 8h4l1 6h-2v6h-2v-6h-2l1-6Z"/>`,"first-aid":`<path d="M9 3h6l1 4h4v13H4V7h4l1-4Zm1 7v3H7v3h3v3h4v-3h3v-3h-3v-3h-4Z"/>`,information:`<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>`,"cash-machine":`<path d="M6 3h12v18H6V3Zm2.5 3h7v4.5h-7V6ZM9 14h6M9 17h3"/>`,bin:`<path d="M7 7h10l-1 13H8L7 7Zm-2 0h14M9 7V4h6v3m-4 3v7m3-7v7"/>`,bench:`<path d="M5 8h14v4H5V8Zm1 4v7m12-7v7M4 15h16"/>`,lamp:`<path d="M12 20V8m-5 0h10l-2-4H9L7 8Zm2 12h6M9 8l1 3h4l1-3"/>`,tree:`<path d="M12 20v-6m0 1-3-3m3 1 3-3M8 14a4 4 0 0 1-.5-7.97A5 5 0 0 1 17 8a3.5 3.5 0 0 1-2 6H8Z"/>`,fountain:`<path d="M4 20h16m-15-4h14l-2 4H7l-2-4Zm3-4h10l-2 3H9l-2-3Zm5-9v9M9 7a3 3 0 0 1 6 0"/>`,planter:`<path d="M5 13h14l-1.5 7h-11L5 13Zm2 0V9m5 4V7m5 6V9"/><circle cx="7" cy="7.6" r="1.5"/><circle cx="12" cy="5.6" r="1.5"/><circle cx="17" cy="7.6" r="1.5"/>`,build:`<path d="M4 20h16M6 17V8l6-4 6 4v9M9 17v-5h6v5"/>`,walk:`<circle cx="13" cy="4" r="2"/><path d="m10 21 2-7-3-3m3 3 3 2 2 5m-5-12 3 3 4-1M6 14l3-3 1-4 4 1"/>`,rotate:`<path d="M20 11a8 8 0 1 0-2 5.3M20 5v6h-6"/>`,check:`<path d="m5 12 4 4L19 6"/>`,close:`<path d="M6 6l12 12M18 6 6 18"/>`,pause:`<path d="M8 5v14m8-14v14"/>`,play:`<path d="m8 5 11 7-11 7V5Z"/>`,camera:`<path d="M4 7h3l1.5-2h7L17 7h3v12H4V7Z"/><circle cx="12" cy="13" r="3.5"/><path d="M17 10h.01"/>`,follow:`<circle cx="12" cy="8" r="2.5"/><path d="M7.5 20v-2.5a4.5 4.5 0 0 1 9 0V20M4 9V5h4m12 4V5h-4"/>`,reframe:`<path d="M8 4H4v4m12-4h4v4M8 20H4v-4m12 4h4v-4"/><circle cx="12" cy="12" r="3"/>`,nudge:`<path d="m12 4 5 6H7l5-6Z"/>`,broom:`<path d="m15 3-5 10m1-1 5 3-4 6-7-4 4-6 2 1Z"/>`,spark:`<path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Zm7 14 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/>`};function np(e,t){return`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${t?`role="img" aria-label="${t}"`:`aria-hidden="true"`}>${tp[e]}</svg>`}function rp(e){return`$${Math.round(e).toLocaleString(`en-US`)}`}function ip(e){let t=Math.max(0,Math.round(e)),n=Math.floor(t/3600),r=Math.round(t%3600/60);return n>=1?r>0?`${n}h ${r}m`:`${n}h`:r>=1?`${r}m`:`a moment`}function ap(e){let t=Math.floor(e/60),n=Math.floor(e%60),r=t>=12?`PM`:`AM`;return`${t%12||12}:${n.toString().padStart(2,`0`)} ${r}`}var op=class{root;callbacks;cashElement;reputationElement;guestsElement;cleanlinessElement;cleanlinessFill;timeElement;objectiveElement;buildPanel;buildToggle;placementBar;placementStatus;rotateButton;confirmButton;pauseButton;cameraButton;reframeButton;toastElement;inspectorBar;inspectorStatus;sellButton;nudgePad;selectedCategory=`infrastructure`;infrastructureTool=`sidewalk`;parcels=[];infrastructureCosts=id;prices={};reputation=38;parkSummary={day:1,cash:0,buildings:0};pricingSignature=``;toastTimer=0;constructor(e,t){this.root=e,this.callbacks=t,this.render(),this.captureElements(),this.bindEvents(),this.setMode(`explore`),this.setCameraMode(`follow`),this.renderCatalog()}setMode(e){this.root.dataset.mode=e,this.buildPanel.classList.toggle(`is-open`,e===`build`),this.placementBar.classList.toggle(`is-open`,e===`placing`||e===`surface`),this.placementBar.classList.toggle(`is-surface`,e===`surface`),this.inspectorBar.classList.toggle(`is-open`,e===`inspect`),this.rotateButton.hidden=e===`surface`,this.nudgePad.hidden=e!==`placing`,this.buildToggle.classList.toggle(`is-active`,e!==`explore`),this.buildToggle.innerHTML=e===`explore`?`${np(`build`)}<span>Build</span>`:`${np(`walk`)}<span>Walk</span>`}setPaused(e){this.pauseButton.innerHTML=e?np(`play`,`Resume`):np(`pause`,`Pause`),this.pauseButton.setAttribute(`aria-label`,e?`Resume simulation`:`Pause simulation`),this.root.classList.toggle(`is-paused`,e)}setCameraMode(e){let t=e===`overview`,n=t?`Return to follow camera`:`Switch to overview camera`;this.root.dataset.cameraMode=e,this.cameraButton.dataset.cameraMode=e,this.cameraButton.innerHTML=`${np(t?`camera`:`follow`)}<span class="camera-mode-label">${t?`Overview`:`Follow`}</span>`,this.cameraButton.setAttribute(`aria-label`,n),this.cameraButton.setAttribute(`aria-pressed`,`${t}`),this.cameraButton.title=n,this.reframeButton.hidden=!t}setPlacement(e,t){let n=nu.find(t=>t.kind===e);if(!n)return;let r=t.valid?t.connected?`is-valid`:`is-warning`:`is-invalid`;this.placementStatus.innerHTML=`<strong>${n.name}</strong><span class="placement-validity ${r}">${t.message}</span>`,this.confirmButton.disabled=!t.valid,this.confirmButton.innerHTML=`${np(`check`)}<span>Build</span>`}updateInfrastructure(e,t){this.parcels=e,this.infrastructureCosts=t,this.selectedCategory===`infrastructure`&&this.renderCatalog()}setInfrastructureStroke(e,t,n,r,i=null){this.infrastructureTool=e;let a=e===`sidewalk`?`Sidewalk`:e===`road`?`Park road`:`Demolish paths`,o=e===`demolish`?`Demolish`:`Build`,s=t>0,c=s?r?`${t} ${t===1?`tile`:`tiles`} · ${rp(n)}`:this.infrastructureReason(i):`Drag across the park to mark tiles`,l=s?r?`is-valid`:`is-invalid`:`is-neutral`;this.placementStatus.innerHTML=`<strong>${a}</strong><span class="placement-validity ${l}">${c}</span>`,this.confirmButton.disabled=!s||!r,this.confirmButton.innerHTML=`${np(`check`)}<span>${o}</span>`}setInspector(e){let t=typeof e.price==`number`?e.price>0?`<span class="inspector-charge">${rp(e.price)} per guest</span>`:`<span class="inspector-charge is-free">Free to use</span>`:``;this.inspectorStatus.innerHTML=`<strong>${e.name}</strong><span class="placement-validity ${e.tone===`positive`?`is-valid`:`is-warning`}">${e.detail}</span>${t}`,this.sellButton.innerHTML=`${np(`close`)}<span>Sell ${rp(e.resale)}</span>`}updatePricing(e,t,n){if(this.prices={...e},this.reputation=t,this.parkSummary={...n},this.selectedCategory!==`office`||!this.buildPanel.classList.contains(`is-open`))return;let r=[JSON.stringify(this.prices),Math.round(t),n.day,Math.round(n.cash),n.buildings].join(`|`);r!==this.pricingSignature&&(this.pricingSignature=r,this.renderCatalog())}updateStats(e){this.cashElement.textContent=rp(e.cash),this.reputationElement.textContent=`${Math.round(e.reputation)}`,this.guestsElement.textContent=`${e.guestCount}`;let t=Math.round(e.cleanliness*100);this.cleanlinessElement.textContent=`${t}%`,this.cleanlinessFill.style.width=`${t}%`,this.cleanlinessFill.dataset.level=t<45?`low`:t<75?`medium`:`high`;let n=ju(e.minuteOfDay);this.timeElement.textContent=n?`Day ${e.day} · ${ap(e.minuteOfDay)}`:`Day ${e.day} · ${ap(e.minuteOfDay)} · Closed`,this.timeElement.classList.toggle(`is-closed`,!n);let r=Math.min(25,e.guestsServed),i=t>=75,a=e.reputation>=70;this.objectiveElement.innerHTML=`
      <span class="objective-label">Opening goals</span>
      <span class="objective-step ${r>=25?`is-complete`:``}">${r}/25 guests served</span>
      <span class="objective-step ${i?`is-complete`:``}">75% clean</span>
      <span class="objective-step ${a?`is-complete`:``}">70 reputation</span>
    `}handleEvent(e){switch(e.type){case`service-complete`:e.revenue>0&&this.toast(`Sale +${rp(e.revenue)}`,`positive`);break;case`litter-created`:this.toast(`A guest dropped litter`,`warning`);break;case`litter-removed`:e.byPlayer&&this.toast(`Cleaned +$3`,`positive`);break;case`insufficient-funds`:this.toast(`Need ${rp(e.required)}`,`warning`);break;case`park-closed`:this.toast(`The gates are closed for the night`,`neutral`);break;case`day-settled`:this.toast(`Day ${e.day-1} settled +${rp(e.total)} · ${rp(e.standing)} reputation, ${rp(e.share)} takings`,`positive`)}}showResumeOption(e){let t=this.requireElement(`#splash-actions`);t.innerHTML=`
      <button class="start-button" id="continue-button">
        <span>Continue ${e.parkName}</span>${np(`spark`)}
      </button>
      <button class="ghost-action" id="new-park-button" type="button">Start a new park</button>
    `,this.requireElement(`#splash-footnote`).textContent=`Day ${e.day} · ${rp(e.cash)} · ${e.buildings} built · saved on ${e.storageLabel}`,this.requireElement(`#continue-button`).addEventListener(`click`,()=>{this.hideSplash(),this.callbacks.onContinue()}),this.requireElement(`#new-park-button`).addEventListener(`click`,()=>{this.callbacks.onNewPark()})}showFreshStart(){let e=this.requireElement(`#splash-actions`);e.innerHTML=`
      <button class="start-button" id="start-button"><span>Open the gates</span>${np(`spark`)}</button>
    `,this.requireElement(`#splash-footnote`).textContent=`No account · Touch-ready · CC0 materials`,this.requireElement(`#start-button`).addEventListener(`click`,()=>{this.hideSplash(),this.callbacks.onStart()})}hideSplash(){this.requireElement(`#splash`).classList.add(`is-hidden`)}showAwayReport(e,t){let n=this.requireElement(`#away-report`),r=this.requireElement(`#away-grid`),i=this.requireElement(`#away-heading`),a=this.requireElement(`#away-note`);i.textContent=e.netCash>=0?`Your park kept running`:`Your park ran at a loss`;let o=[[`Away for`,ip(e.awaySeconds)],[`Guests`,`${e.guestsVisited.toLocaleString(`en-US`)}`],[`Served`,`${e.guestsServed.toLocaleString(`en-US`)}`],[`Revenue`,rp(e.revenue)],[`Upkeep`,`-${rp(e.upkeep)}`],[`Net`,`${e.netCash<0?`-`:`+`}${rp(Math.abs(e.netCash))}`]];e.litterCreated>0&&o.push([`Litter dropped`,`${e.litterCreated}`]),e.litterRemoved>0&&o.push([`Crew cleared`,`${e.litterRemoved}`]),o.push([`Cleanliness`,`${Math.round(e.cleanliness*100)}%`]);let s=Math.round(e.reputation),c=s-Math.round(t);o.push([`Reputation`,c===0?`${s}`:`${s} (${c>0?`+`:``}${c})`]),r.innerHTML=o.map(([e,t])=>`<div><dt>${e}</dt><dd>${t}</dd></div>`).join(``);let l=[`Estimated from your park’s own service rates.`];e.guestsVisited>0&&e.guestsServed===0&&l.push(`Nothing was open to serve them, so they left unhappy.`),e.capped&&l.push(`Only the first ${ip(e.creditedSeconds)} counted.`),e.litterCreated>0&&e.litterRemoved===0&&l.push(`Nobody was there to clean up.`),e.litterRemoved>0&&l.push(`Your crew worked through the night.`),a.textContent=l.join(` `),n.hidden=!1}hideAwayReport(){this.requireElement(`#away-report`).hidden=!0}toast(e,t=`neutral`){window.clearTimeout(this.toastTimer),this.toastElement.textContent=e,this.toastElement.dataset.tone=t,this.toastElement.classList.add(`is-visible`),this.toastTimer=window.setTimeout(()=>this.toastElement.classList.remove(`is-visible`),2400)}dispose(){window.clearTimeout(this.toastTimer)}render(){this.root.insertAdjacentHTML(`beforeend`,`
      <div class="game-ui" data-ui>
        <header class="hud-bar glass-panel">
          <div class="brand-lockup">
            <span class="brand-mark">${np(`spark`)}</span>
            <span><b>Parkworks</b><small>TYCOON</small></span>
          </div>
          <div class="stat-cluster">
            <div class="stat stat-cash"><span class="stat-label">Park funds</span><strong id="cash-stat">$4,200</strong></div>
            <div class="stat"><span class="stat-label">Reputation</span><strong><span class="stat-symbol">★</span> <span id="reputation-stat">38</span></strong></div>
            <div class="stat"><span class="stat-label">Guests</span><strong id="guest-stat">0</strong></div>
          </div>
          <div class="day-cluster">
            <span id="time-stat">Day 1 · 9:00 AM</span>
            <button class="icon-button camera-toggle" id="camera-button" type="button" aria-label="Switch to overview camera" aria-pressed="false" title="Switch to overview camera">
              ${np(`follow`)}<span class="camera-mode-label">Follow</span>
            </button>
            <button class="icon-button reframe-camera" id="reframe-camera" type="button" aria-label="Recenter Park View" title="Recenter Park View" hidden>
              ${np(`reframe`)}
            </button>
            <button class="icon-button" id="pause-button" aria-label="Pause simulation">${np(`pause`)}</button>
          </div>
        </header>

        <aside class="park-pulse glass-panel" aria-label="Park condition">
          <div class="pulse-heading"><span>Park pulse</span><strong id="cleanliness-stat">100%</strong></div>
          <div class="meter"><i id="cleanliness-fill" data-level="high"></i></div>
          <span class="pulse-caption">Cleanliness</span>
        </aside>

        <section class="objectives glass-panel" id="objectives" aria-live="polite"></section>

        <div class="control-hint glass-panel" id="control-hint">
          <span class="desktop-hint follow-camera-hint"><kbd>WASD</kbd> walk · drag to look · <kbd>Shift</kbd> sprint</span>
          <span class="touch-hint follow-camera-hint">Touch left to walk · drag right to look</span>
          <span class="desktop-hint free-camera-hint"><kbd>WASD</kbd> pan · drag to orbit · wheel to zoom</span>
          <span class="touch-hint free-camera-hint">Touch left to pan · drag right to orbit · pinch to zoom</span>
        </div>

        <button class="build-toggle" id="build-toggle" aria-label="Open build catalog">
          ${np(`build`)}<span>Build</span>
        </button>

        <section class="build-panel glass-panel" id="build-panel" aria-label="Build catalog">
          <div class="build-header">
            <div><span class="eyebrow">Workshop</span><h2>Build the park</h2></div>
            <button class="icon-button" id="close-build" aria-label="Close build catalog">${np(`close`)}</button>
          </div>
          <nav class="category-tabs" id="category-tabs" aria-label="Build categories"></nav>
          <div class="catalog-grid" id="catalog-grid"></div>
        </section>

        <section class="placement-bar glass-panel" id="placement-bar" aria-label="Placement controls">
          <div class="placement-copy" id="placement-status"></div>
          <div class="nudge-pad" id="nudge-pad" role="group" aria-label="Nudge one metre">
            <button class="nudge-button nudge-up" id="nudge-up" type="button" aria-label="Nudge away from camera">${np(`nudge`)}</button>
            <button class="nudge-button nudge-left" id="nudge-left" type="button" aria-label="Nudge left">${np(`nudge`)}</button>
            <span class="nudge-hub" aria-hidden="true">1m</span>
            <button class="nudge-button nudge-right" id="nudge-right" type="button" aria-label="Nudge right">${np(`nudge`)}</button>
            <button class="nudge-button nudge-down" id="nudge-down" type="button" aria-label="Nudge toward camera">${np(`nudge`)}</button>
          </div>
          <div class="placement-actions">
            <button class="secondary-action" id="rotate-placement">${np(`rotate`)}<span>Rotate</span></button>
            <button class="secondary-action" id="cancel-placement">${np(`close`)}<span>Cancel</span></button>
            <button class="primary-action" id="confirm-placement">${np(`check`)}<span>Build</span></button>
          </div>
        </section>

        <section class="placement-bar inspector-bar glass-panel" id="inspector-bar" aria-label="Edit a building">
          <div class="placement-copy" id="inspector-status"></div>
          <div class="placement-actions">
            <button class="secondary-action" id="inspector-move">${np(`build`)}<span>Move</span></button>
            <button class="secondary-action" id="inspector-rotate">${np(`rotate`)}<span>Rotate</span></button>
            <button class="secondary-action inspector-sell" id="inspector-sell">${np(`close`)}<span>Sell</span></button>
            <button class="primary-action" id="inspector-done">${np(`check`)}<span>Done</span></button>
          </div>
        </section>

        <div class="joystick" id="movement-joystick" aria-hidden="true">
          <div class="joystick-ring"></div><div class="joystick-knob"></div>
        </div>

        <div class="toast" id="toast" role="status" aria-live="polite"></div>
      </div>

      <section class="splash" id="splash" data-ui>
        <div class="splash-vignette"></div>
        <div class="splash-content">
          <span class="splash-kicker">A tiny park with a big heartbeat</span>
          <h1>Build joy.<br><em>Mind the mess.</em></h1>
          <p>Shape a welcoming park on foot. Build rides, feed your guests, keep facilities flowing, and clean up what they leave behind.</p>
          <div class="splash-actions" id="splash-actions">
            <button class="start-button" id="start-button"><span>Open the gates</span>${np(`spark`)}</button>
          </div>
          <span class="splash-footnote" id="splash-footnote">No account · Touch-ready · CC0 materials</span>
        </div>
      </section>

      <section class="away-report confirm-dialog" id="confirm-dialog" data-ui hidden role="alertdialog" aria-labelledby="confirm-heading" aria-describedby="confirm-body">
        <div class="away-card glass-panel">
          <span class="eyebrow">Confirm</span>
          <h2 id="confirm-heading"></h2>
          <p class="away-note" id="confirm-body"></p>
          <div class="confirm-actions" id="confirm-actions"></div>
        </div>
      </section>

      <section class="away-report" id="away-report" data-ui hidden aria-live="polite">
        <div class="away-card glass-panel">
          <span class="eyebrow">While you were away</span>
          <h2 id="away-heading">Your park kept running</h2>
          <dl class="away-grid" id="away-grid"></dl>
          <p class="away-note" id="away-note"></p>
          <button class="primary-action" id="away-dismiss"><span>Back to the park</span></button>
        </div>
      </section>
    `)}captureElements(){this.cashElement=this.requireElement(`#cash-stat`),this.reputationElement=this.requireElement(`#reputation-stat`),this.guestsElement=this.requireElement(`#guest-stat`),this.cleanlinessElement=this.requireElement(`#cleanliness-stat`),this.cleanlinessFill=this.requireElement(`#cleanliness-fill`),this.timeElement=this.requireElement(`#time-stat`),this.objectiveElement=this.requireElement(`#objectives`),this.buildPanel=this.requireElement(`#build-panel`),this.buildToggle=this.requireElement(`#build-toggle`),this.placementBar=this.requireElement(`#placement-bar`),this.placementStatus=this.requireElement(`#placement-status`),this.rotateButton=this.requireElement(`#rotate-placement`),this.confirmButton=this.requireElement(`#confirm-placement`),this.cameraButton=this.requireElement(`#camera-button`),this.reframeButton=this.requireElement(`#reframe-camera`),this.pauseButton=this.requireElement(`#pause-button`),this.toastElement=this.requireElement(`#toast`),this.inspectorBar=this.requireElement(`#inspector-bar`),this.inspectorStatus=this.requireElement(`#inspector-status`),this.sellButton=this.requireElement(`#inspector-sell`),this.nudgePad=this.requireElement(`#nudge-pad`)}bindEvents(){this.requireElement(`#start-button`).addEventListener(`click`,()=>{this.hideSplash(),this.callbacks.onStart()}),this.requireElement(`#away-dismiss`).addEventListener(`click`,()=>this.hideAwayReport()),this.requireElement(`#nudge-up`).addEventListener(`click`,()=>this.callbacks.onNudge(0,-1)),this.requireElement(`#nudge-down`).addEventListener(`click`,()=>this.callbacks.onNudge(0,1)),this.requireElement(`#nudge-left`).addEventListener(`click`,()=>this.callbacks.onNudge(-1,0)),this.requireElement(`#nudge-right`).addEventListener(`click`,()=>this.callbacks.onNudge(1,0)),this.requireElement(`#inspector-move`).addEventListener(`click`,this.callbacks.onMoveSelected),this.requireElement(`#inspector-rotate`).addEventListener(`click`,this.callbacks.onRotateSelected),this.sellButton.addEventListener(`click`,this.callbacks.onSellSelected),this.requireElement(`#inspector-done`).addEventListener(`click`,this.callbacks.onCloseInspector),this.buildToggle.addEventListener(`click`,this.callbacks.onToggleBuild),this.requireElement(`#close-build`).addEventListener(`click`,this.callbacks.onToggleBuild),this.cameraButton.addEventListener(`click`,this.callbacks.onToggleCamera),this.reframeButton.addEventListener(`click`,this.callbacks.onReframeCamera),this.pauseButton.addEventListener(`click`,this.callbacks.onPause),this.requireElement(`#rotate-placement`).addEventListener(`click`,this.callbacks.onRotate),this.requireElement(`#cancel-placement`).addEventListener(`click`,this.callbacks.onCancel),this.requireElement(`#confirm-placement`).addEventListener(`click`,this.callbacks.onConfirm)}renderCatalog(){let e=this.requireElement(`#category-tabs`);e.innerHTML=[`infrastructure`,...Object.keys(iu),`office`].map(e=>`<button data-category="${e}" class="${e===this.selectedCategory?`is-active`:``}">${this.categoryLabel(e)}</button>`).join(``);for(let t of e.querySelectorAll(`button`))t.addEventListener(`click`,()=>{this.selectedCategory=t.dataset.category,this.pricingSignature=``,this.renderCatalog()});let t=this.requireElement(`#catalog-grid`);if(t.classList.toggle(`is-office`,this.selectedCategory===`office`),this.selectedCategory===`infrastructure`){this.renderInfrastructureCatalog(t);return}if(this.selectedCategory===`office`){this.renderOffice(t);return}t.classList.remove(`is-infrastructure`),t.innerHTML=nu.filter(e=>e.category===this.selectedCategory).map(e=>{let t=bu(e.kind,this.prices),n=e.staff?`<small class="catalog-earns is-wage">Wages ${rp(e.upkeep)} every upkeep cycle</small>`:typeof e.radius==`number`?`<small class="catalog-earns is-free">Adds ${e.appeal} appeal within ${e.radius} m</small>`:t>0?`<small class="catalog-earns">Earns ${rp(t)} per guest</small>`:`<small class="catalog-earns is-free">Free for guests</small>`;return`
        <button class="catalog-card" data-kind="${e.kind}">
          <span class="catalog-icon">${np(e.icon)}</span>
          <span class="catalog-copy"><strong>${e.shortName}</strong><small>${e.description}</small>${n}</span>
          <span class="catalog-price">${rp(e.cost)}</span>
        </button>
      `}).join(``);for(let e of t.querySelectorAll(`[data-kind]`))e.addEventListener(`click`,()=>this.callbacks.onSelectPlaceable(e.dataset.kind))}categoryLabel(e){return e===`infrastructure`?`Paths & land`:e===`office`?`Park office`:iu[e]}renderOffice(e){e.classList.remove(`is-infrastructure`);let t=Cu(this.reputation),n=nu.filter(e=>Su(e.kind));e.innerHTML=`
      <section class="infrastructure-section" aria-labelledby="prices-heading">
        <div class="catalog-section-heading">
          <div><span class="eyebrow">Pricing</span><h3 id="prices-heading">What the park charges</h3></div>
          <span>At reputation ${Math.round(this.reputation)}, guests pay up to <strong>${Math.round(t*100)}%</strong> of the standard price before they start walking away.</span>
        </div>
        <div class="price-list">
          ${n.map(e=>this.priceRow(e.kind)).join(``)}
        </div>
        <p class="parcel-note">Raise your reputation and you can raise your prices. Charge past what your park has earned and guests refuse the queue — which lowers your reputation, and lowers what you can charge.</p>
      </section>
      <section class="infrastructure-section danger-section" aria-labelledby="startover-heading">
        <div class="catalog-section-heading">
          <div><span class="eyebrow">Danger</span><h3 id="startover-heading">Start over</h3></div>
          <span>Clears this park completely and begins a new one.</span>
        </div>
        <button class="ghost-action is-danger" id="start-over-button" type="button">Start over with a new park</button>
      </section>
    `;for(let t of e.querySelectorAll(`[data-price-kind]`))t.addEventListener(`click`,()=>{let e=t.dataset.priceKind,n=Number(t.dataset.priceStep);!e||!Number.isFinite(n)||this.callbacks.onSetPrice(e,bu(e,this.prices)+n)});this.requireElement(`#start-over-button`).addEventListener(`click`,()=>this.confirmStartOver())}priceRow(e){let t=nu.find(t=>t.kind===e);if(!t)return``;let n=bu(e,this.prices),r=wu(e,this.prices,this.reputation),i=Tu(e,this.prices,this.reputation),a=Math.round(r*100),o=a>=100?`is-valid`:a>=50?`is-warning`:`is-invalid`,s=a>=100?`Everyone pays this`:a>0?`Only ${a}% of guests will pay`:`Nobody will pay this`,c=t.revenue*3,l=Math.max(1,Math.round(t.revenue*.1));return`
      <div class="price-row">
        <span class="catalog-icon">${np(t.icon)}</span>
        <span class="catalog-copy">
          <strong>${t.shortName}</strong>
          <small>Standard ${rp(t.revenue)} · earning ${rp(i)} per guest</small>
          <small class="placement-validity ${o}">${s}</small>
        </span>
        <span class="price-stepper">
          <button type="button" data-price-kind="${e}" data-price-step="${-l}" aria-label="Lower the price of ${t.shortName}" ${n<=0?`disabled`:``}>−</button>
          <strong>${rp(n)}</strong>
          <button type="button" data-price-kind="${e}" data-price-step="${l}" aria-label="Raise the price of ${t.shortName}" ${n>=c?`disabled`:``}>+</button>
        </span>
      </div>
    `}confirmStartOver(){let{day:e,cash:t,buildings:n}=this.parkSummary;this.showConfirm({heading:`Start over?`,body:`This park is on day ${e}, holds ${rp(t)}, and has ${n} ${n===1?`building`:`buildings`}. Starting over clears all of it.`,confirmLabel:`Continue`,onConfirm:()=>{this.showConfirm({heading:`This cannot be undone`,body:`The park, its buildings, its paths, and its saved copy will be gone for good. There is no way back to it.`,confirmLabel:`Delete my park`,onConfirm:()=>this.callbacks.onStartOver()})}})}showConfirm(e){let t=this.requireElement(`#confirm-dialog`);this.requireElement(`#confirm-heading`).textContent=e.heading,this.requireElement(`#confirm-body`).textContent=e.body;let n=this.requireElement(`#confirm-actions`);n.innerHTML=`
      <button class="secondary-action" id="confirm-cancel" type="button">Keep my park</button>
      <button class="primary-action is-danger" id="confirm-accept" type="button">${e.confirmLabel}</button>
    `,t.hidden=!1;let r=()=>{t.hidden=!0};this.requireElement(`#confirm-cancel`).addEventListener(`click`,r),this.requireElement(`#confirm-accept`).addEventListener(`click`,()=>{r(),e.onConfirm()})}renderInfrastructureCatalog(e){let t=this.parcels.filter(e=>e.owned),n=t.reduce((e,t)=>e+t.area,0),r=this.parcels.filter(e=>e.status===`available`),i=this.infrastructureCosts.construction.sidewalk,a=this.infrastructureCosts.construction.road,o=Math.min(this.infrastructureCosts.demolition.sidewalk,this.infrastructureCosts.demolition.road);e.classList.add(`is-infrastructure`),e.innerHTML=`
      <section class="infrastructure-section" aria-labelledby="paths-heading">
        <div class="catalog-section-heading">
          <div><span class="eyebrow">Infrastructure</span><h3 id="paths-heading">Draw the way</h3></div>
          <span>Guests only visit places connected to the gate.</span>
        </div>
        <div class="infrastructure-tools">
          ${this.infrastructureToolCard(`sidewalk`,`Sidewalk`,`Comfortable pedestrian paving`,i)}
          ${this.infrastructureToolCard(`road`,`Park road`,`A broad service and guest route`,a)}
          ${this.infrastructureToolCard(`demolish`,`Demolish`,`Return path tiles to lawn`,o,!0)}
        </div>
      </section>
      <section class="infrastructure-section land-section" aria-labelledby="land-heading">
        <div class="catalog-section-heading">
          <div><span class="eyebrow">Expansion</span><h3 id="land-heading">Grow your park</h3></div>
          <span>${t.length} ${t.length===1?`parcel`:`parcels`} · ${n.toLocaleString(`en-US`)} m² owned</span>
        </div>
        <div class="parcel-grid">
          ${this.parcels.length>0?this.parcels.map(e=>this.parcelCard(e)).join(``):`<div class="parcel-empty">Expansion survey loading…</div>`}
        </div>
        ${r.length===0&&this.parcels.length>t.length?`<p class="parcel-note">Buy an adjacent parcel to unlock the next expansion.</p>`:``}
      </section>
    `;for(let t of e.querySelectorAll(`[data-infrastructure-tool]`))t.addEventListener(`click`,()=>{this.infrastructureTool=t.dataset.infrastructureTool,this.callbacks.onSelectInfrastructure(this.infrastructureTool)});for(let t of e.querySelectorAll(`[data-parcel-id]`))t.addEventListener(`click`,()=>{let e=t.dataset.parcelId;e&&this.callbacks.onBuyParcel(e)})}infrastructureToolCard(e,t,n,r,i=!1){return`
      <button class="infrastructure-card" data-infrastructure-tool="${e}">
        <span class="infrastructure-swatch is-${e}" aria-hidden="true"><i></i></span>
        <span class="catalog-copy"><strong>${t}</strong><small>${n}</small></span>
        <span class="catalog-price">${i?`from `:``}${rp(r)}<small>/ tile</small></span>
      </button>
    `}parcelCard(e){let t=e.owned?`Owned`:e.purchasable?`Buy ${rp(e.cost)}`:`Locked`,n=e.owned?`${e.area.toLocaleString(`en-US`)} m² in your park`:e.purchasable?`${e.area.toLocaleString(`en-US`)} m² · adjacent land`:`Expand toward this parcel to unlock it`;return`
      <button
        class="parcel-card is-${e.status}"
        ${e.purchasable?`data-parcel-id="${e.id}"`:`disabled`}
        aria-label="${e.name}: ${t}"
      >
        <span class="parcel-map" aria-hidden="true"><i></i></span>
        <span class="parcel-copy"><strong>${e.name}</strong><small>${n}</small></span>
        <span class="parcel-state">${t}</span>
      </button>
    `}infrastructureReason(e){switch(e){case`unowned-land`:return`This tile is outside your owned land`;case`surface-not-lawn`:return`Build paths only on clear lawn`;case`surface-is-lawn`:return`Select a road or sidewalk to demolish`;case`out-of-bounds`:return`Keep the stroke inside the park boundary`;case`occupied`:return`A facility occupies part of this stroke`;case`entrance-required`:return`The front-gate path must stay connected`;case`insufficient-funds`:return`Not enough park funds`;case`empty-selection`:return`Drag across the park to mark tiles`;default:return e??`This stroke cannot be applied`}}requireElement(e){let t=this.root.querySelector(e);if(!t)throw Error(`Missing UI element: ${e}`);return t}},sp=540,cp=1260,lp=0,up=1440,dp=[{minute:lp,sunPosition:[10,26,-18],sunColor:10465506,sunIntensity:.62,ambientColor:7439291,ambientIntensity:1.02,skyColor:1581900,fogColor:1779536,lampGlow:1},{minute:300,sunPosition:[-24,22,26],sunColor:10728164,sunIntensity:.66,ambientColor:7767741,ambientIntensity:1.04,skyColor:1910868,fogColor:2108508,lampGlow:1},{minute:435,sunPosition:[-46,5,28],sunColor:16757896,sunIntensity:.72,ambientColor:9078446,ambientIntensity:.9,skyColor:6116216,fogColor:6971264,lampGlow:.82},{minute:sp,sunPosition:[-38,16,30],sunColor:16767400,sunIntensity:2.15,ambientColor:10469580,ambientIntensity:1.05,skyColor:10340044,fogColor:11718608,lampGlow:.16},{minute:660,sunPosition:[-26,34,20],sunColor:16772301,sunIntensity:3.05,ambientColor:11193541,ambientIntensity:1.18,skyColor:10470078,fogColor:11061440,lampGlow:0},{minute:780,sunPosition:[-4,42,8],sunColor:16774370,sunIntensity:3.35,ambientColor:11850440,ambientIntensity:1.22,skyColor:10930884,fogColor:11324868,lampGlow:0},{minute:960,sunPosition:[20,30,-6],sunColor:16769196,sunIntensity:3,ambientColor:11585984,ambientIntensity:1.12,skyColor:11060411,fogColor:11585725,lampGlow:.05},{minute:1110,sunPosition:[36,9,-16],sunColor:16755550,sunIntensity:2.5,ambientColor:11046806,ambientIntensity:.92,skyColor:14262385,fogColor:13803897,lampGlow:.42},{minute:1185,sunPosition:[40,2.5,-22],sunColor:15759950,sunIntensity:1.35,ambientColor:9144237,ambientIntensity:1.05,skyColor:8153742,fogColor:8219787,lampGlow:.88},{minute:cp,sunPosition:[34,-3,-26],sunColor:10917065,sunIntensity:.62,ambientColor:7175080,ambientIntensity:.95,skyColor:2568527,fogColor:2568527,lampGlow:1},{minute:1350,sunPosition:[22,20,-22],sunColor:10135769,sunIntensity:.55,ambientColor:7175858,ambientIntensity:.98,skyColor:1845072,fogColor:2042711,lampGlow:1},{minute:up,sunPosition:[10,26,-18],sunColor:10465506,sunIntensity:.62,ambientColor:7439291,ambientIntensity:1.02,skyColor:1581900,fogColor:1779536,lampGlow:1}];function fp(e,t,n){return e+(t-e)*n}function pp(e,t,n){let r=Math.round(fp(e>>16&255,t>>16&255,n)),i=Math.round(fp(e>>8&255,t>>8&255,n)),a=Math.round(fp(e&255,t&255,n));return r<<16|i<<8|a}function mp(e){let t=Number.isFinite(e)?Math.max(lp,Math.min(up,e)):sp,n=dp[0],r=dp[dp.length-1];for(let e=0;e<dp.length-1;e+=1){let i=dp[e],a=dp[e+1];if(t>=i.minute&&t<=a.minute){n=i,r=a;break}}let i=r.minute-n.minute,a=i>0?(t-n.minute)/i:0;return{sunPosition:[fp(n.sunPosition[0],r.sunPosition[0],a),fp(n.sunPosition[1],r.sunPosition[1],a),fp(n.sunPosition[2],r.sunPosition[2],a)],sunColor:pp(n.sunColor,r.sunColor,a),sunIntensity:fp(n.sunIntensity,r.sunIntensity,a),ambientColor:pp(n.ambientColor,r.ambientColor,a),ambientIntensity:fp(n.ambientIntensity,r.ambientIntensity,a),skyColor:pp(n.skyColor,r.skyColor,a),fogColor:pp(n.fogColor,r.fogColor,a),lampGlow:fp(n.lampGlow,r.lampGlow,a)}}var hp=Object.freeze({minX:-8,maxX:8,minZ:-8,maxZ:8}),gp=54*Math.PI/180,_p=4.5,vp=1.12;function yp(e){let t=e.filter(e=>e.owned);return t.length===0?null:t.reduce((e,t)=>({minX:Math.min(e.minX,t.bounds.minX),maxX:Math.max(e.maxX,t.bounds.maxX),minZ:Math.min(e.minZ,t.bounds.minZ),maxZ:Math.max(e.maxZ,t.bounds.maxZ)}),{...t[0].bounds})}function bp(e,t){let n=yp(e)??{...hp},r=Number.isFinite(t)&&t>0?Math.max(.35,t):1,i=r<.75?.08:.68,a=r<.75?.91:.82,o={x:(n.minX+n.maxX)/2,y:_p,z:(n.minZ+n.maxZ)/2},s=(n.maxX-n.minX+1)/2+1.5,c=(n.maxZ-n.minZ+1)/2+1.5,l=Math.tan(gp/2),u=l*r,d=Math.sin(i),f=Math.cos(i),p=Math.sin(a),m=Math.cos(a),h=0;for(let e of[-s,s])for(let t of[-c,c])for(let n of[-4.5,15.5]){let r=e*f-t*d,i=-e*d*p+n*m-t*f*p,a=-e*d*m-n*p-t*f*m;h=Math.max(h,Math.abs(r)/u-a,Math.abs(i)/l-a)}h=Math.max(28,h*vp);let g=Math.cos(a)*h;return{bounds:n,target:o,position:{x:o.x+Math.sin(i)*g,y:o.y+Math.sin(a)*h,z:o.z+Math.cos(i)*g},distance:h,azimuth:i,elevation:a}}var xp=Object.freeze({minFocusX:-512,maxFocusX:512,minFocusZ:-512,maxFocusZ:512,minPitch:.3,maxPitch:1.18,minDistance:9,maxDistance:320}),Sp=Object.freeze({panSpeed:17,panReferenceDistance:28,yawSensitivity:.004,pitchSensitivity:.003,zoomSensitivity:.16});Object.freeze({panRight:0,panForward:0,lookDeltaX:0,lookDeltaY:0,zoomDelta:0});var Cp=Object.freeze({focusX:0,focusZ:0,yaw:Math.PI/4,pitch:.78,distance:42});function wp(e,t){return e!==void 0&&Number.isFinite(e)?e:t}function Tp(e,t,n){return Math.min(n,Math.max(t,e))}function Ep(e){let t=Math.PI*2;return((e+Math.PI)%t+t)%t-Math.PI}function Dp(e){let t=xp,n={minFocusX:wp(e?.minFocusX,t.minFocusX),maxFocusX:wp(e?.maxFocusX,t.maxFocusX),minFocusZ:wp(e?.minFocusZ,t.minFocusZ),maxFocusZ:wp(e?.maxFocusZ,t.maxFocusZ),minPitch:wp(e?.minPitch,t.minPitch),maxPitch:wp(e?.maxPitch,t.maxPitch),minDistance:wp(e?.minDistance,t.minDistance),maxDistance:wp(e?.maxDistance,t.maxDistance)};return n.minFocusX>n.maxFocusX&&([n.minFocusX,n.maxFocusX]=[n.maxFocusX,n.minFocusX]),n.minFocusZ>n.maxFocusZ&&([n.minFocusZ,n.maxFocusZ]=[n.maxFocusZ,n.minFocusZ]),n.minPitch>n.maxPitch&&([n.minPitch,n.maxPitch]=[n.maxPitch,n.minPitch]),n.minDistance>n.maxDistance&&([n.minDistance,n.maxDistance]=[n.maxDistance,n.minDistance]),n}function Op(e){let t=Sp;return{panSpeed:Math.max(0,wp(e?.panSpeed,t.panSpeed)),panReferenceDistance:Math.max(.001,wp(e?.panReferenceDistance,t.panReferenceDistance)),yawSensitivity:wp(e?.yawSensitivity,t.yawSensitivity),pitchSensitivity:wp(e?.pitchSensitivity,t.pitchSensitivity),zoomSensitivity:Math.max(0,wp(e?.zoomSensitivity,t.zoomSensitivity))}}function kp(e={},t){let n=Dp(t);return{focusX:Tp(wp(e.focusX,Cp.focusX),n.minFocusX,n.maxFocusX),focusZ:Tp(wp(e.focusZ,Cp.focusZ),n.minFocusZ,n.maxFocusZ),yaw:Ep(wp(e.yaw,Cp.yaw)),pitch:Tp(wp(e.pitch,Cp.pitch),n.minPitch,n.maxPitch),distance:Tp(wp(e.distance,Cp.distance),n.minDistance,n.maxDistance)}}function Ap(e,t,n,r={}){let i=Dp(r.limits),a=Op(r.tuning),o=kp(e,i),s=Tp(wp(n,0),0,.1),c=wp(t.lookDeltaX,0),l=wp(t.lookDeltaY,0),u=Ep(o.yaw-c*a.yawSensitivity),d=Tp(o.pitch+l*a.pitchSensitivity,i.minPitch,i.maxPitch),f=Tp(wp(t.zoomDelta,0),-8,8),p=Tp(o.distance*Math.exp(f*a.zoomSensitivity),i.minDistance,i.maxDistance),m=wp(t.panRight,0),h=wp(t.panForward,0),g=Math.hypot(m,h);g>1&&(m/=g,h/=g);let _=Tp(p/a.panReferenceDistance,.5,3),v=a.panSpeed*_*s,y=Math.cos(u),b=-Math.sin(u),x=-Math.sin(u),S=-Math.cos(u);return{focusX:Tp(o.focusX+(y*m+x*h)*v,i.minFocusX,i.maxFocusX),focusZ:Tp(o.focusZ+(b*m+S*h)*v,i.minFocusZ,i.maxFocusZ),yaw:u,pitch:d,distance:p}}function jp(e,t=0){let n=kp(e),r=wp(t,0),i=Math.cos(n.pitch)*n.distance;return{position:{x:n.focusX+Math.sin(n.yaw)*i,y:r+Math.sin(n.pitch)*n.distance,z:n.focusZ+Math.cos(n.yaw)*i},target:{x:n.focusX,y:r,z:n.focusZ}}}function Mp(e){return`${e.x},${e.z}`}function Np(e,t){let n=[],r=e.x,i=e.z,a=Math.abs(t.x-e.x),o=Math.abs(t.z-e.z),s=e.x<t.x?1:-1,c=e.z<t.z?1:-1,l=a-o;for(;n.push({x:r,z:i}),r!==t.x||i!==t.z;){let e=l*2;e>-o&&(l-=o,r+=s),e<a&&(l+=a,i+=c)}return n}var Pp=class{selected=new Map;lastCell=null;currentTool=null;get tool(){return this.currentTool}get cells(){return[...this.selected.values()]}begin(e){this.currentTool=e,this.clear()}startStroke(e){this.currentTool&&(this.lastCell={...e},this.selected.set(Mp(e),{...e}))}extendStroke(e){if(!this.currentTool)return;let t=this.lastCell??e;for(let n of Np(t,e))this.selected.set(Mp(n),{...n});this.lastCell={...e}}endStroke(){this.lastCell=null}clear(){this.selected.clear(),this.lastCell=null}cancel(){this.currentTool=null,this.clear()}};function Fp(e,t){return`${e},${t}`}function Ip(e,t,n,r){if(t.length===0)return null;let i=new ci(n,r,t.length);return i.name=e,i.receiveShadow=!0,i.castShadow=!1,t.forEach((e,t)=>i.setMatrixAt(t,e)),i.instanceMatrix.needsUpdate=!0,i.computeBoundingSphere(),i}function Lp(e,t,n=0){let r=new wn;return r.position.set(e.x,t,e.z),r.rotation.y=n,r.updateMatrix(),r.matrix.clone()}var Rp=class{object=new Tn;surfaces=new Tn;ownership=new Tn;parcelOverlays=new Tn;preview=new Tn;tileGeometry=new Fi(.97,.085,.97);curbGeometry=new Fi(1,.075,.075);markingGeometry=new Fi(.065,.018,.34);drainGeometry=new Fi(.34,.018,.12);previewGeometry=new Fi(.9,.035,.9);parcelGeometry=new Fi(1,.025,1);boundaryMaterial=new _i({color:7398323,transparent:!0,opacity:.72});previewMaterial=new zr({color:5364131,transparent:!0,opacity:.52,depthWrite:!1});availableMaterial=new zr({color:15775066,transparent:!0,opacity:.1,depthWrite:!1});lockedMaterial=new zr({color:4216666,transparent:!0,opacity:.075,depthWrite:!1});materials;landMode=!1;constructor(e){this.materials=e,this.object.name=`Park infrastructure`,this.surfaces.name=`Roads and sidewalks`,this.ownership.name=`Owned land perimeter`,this.parcelOverlays.name=`Expansion parcel overlays`,this.preview.name=`Infrastructure stroke preview`,this.parcelOverlays.visible=!1,this.object.add(this.surfaces,this.ownership,this.parcelOverlays,this.preview)}update(e){this.disposeInstanceBuffers(this.surfaces),this.surfaces.clear(),this.ownership.traverse(e=>{e instanceof ki&&e.geometry.dispose()}),this.ownership.clear(),this.parcelOverlays.clear();let t=new Map(e.cells.map(e=>[Fp(e.x,e.z),e])),n=e.cells.filter(e=>e.surface===`sidewalk`),r=e.cells.filter(e=>e.surface===`road`),i=n.map(e=>Lp(e,.015)),a=r.map(e=>Lp(e,.012)),o=Ip(`Paving modules with construction joints`,i,this.tileGeometry,this.materials.get(`path`)),s=Ip(`Park road asphalt modules`,a,this.tileGeometry,this.materials.get(`concreteDark`));o&&this.surfaces.add(o),s&&this.surfaces.add(s);let c=[];for(let e of[...n,...r])this.addMissingEdgeCurbs(e,t,c);let l=Ip(`Segmented concrete edge restraints`,c,this.curbGeometry,this.materials.get(`concrete`));l&&this.surfaces.add(l);let u=[],d=[];for(let e of r){let n=this.isRoad(t,e.x,e.z-1)||this.isRoad(t,e.x,e.z+1),r=this.isRoad(t,e.x-1,e.z)||this.isRoad(t,e.x+1,e.z);if(Math.abs(e.x*13+e.z*5)%3!=1&&u.push(Lp(e,.064,r&&!n?Math.PI/2:0)),Math.abs(e.x*19+e.z*7)%9==0){let t=Lp({x:e.x+.34,z:e.z},.066,Math.PI/2);d.push(t)}}let f=Ip(`Short anti-slip road centre markings`,u,this.markingGeometry,this.materials.get(`paintYellow`)),p=Ip(`Galvanized road drainage grates`,d,this.drainGeometry,this.materials.get(`galvanized`));f&&this.surfaces.add(f),p&&this.surfaces.add(p),this.rebuildOwnedBoundary(e.cells,t),this.rebuildParcelOverlays(e.parcels),this.parcelOverlays.visible=this.landMode}setLandMode(e){this.landMode=e,this.parcelOverlays.visible=e}setPreview(e,t,n){if(this.disposeInstanceBuffers(this.preview),this.preview.clear(),e.length===0)return;let r=n?t===`road`?6727899:t===`demolish`?15775066:5364131:16739165;this.previewMaterial.color.setHex(r);let i=Ip(`Selected construction stroke`,e.map(e=>Lp(e,.105)),this.previewGeometry,this.previewMaterial);i&&this.preview.add(i)}clearPreview(){this.disposeInstanceBuffers(this.preview),this.preview.clear()}dispose(){this.object.removeFromParent(),this.tileGeometry.dispose(),this.curbGeometry.dispose(),this.markingGeometry.dispose(),this.drainGeometry.dispose(),this.previewGeometry.dispose(),this.parcelGeometry.dispose(),this.boundaryMaterial.dispose(),this.previewMaterial.dispose(),this.availableMaterial.dispose(),this.lockedMaterial.dispose()}isRoad(e,t,n){return e.get(Fp(t,n))?.surface===`road`}addMissingEdgeCurbs(e,t,n){let r=[[0,-.5,0],[0,.5,0],[-.5,0,Math.PI/2],[.5,0,Math.PI/2]];for(let[i,a,o]of r){let r=e.x+Math.round(i*2),s=e.z+Math.round(a*2);t.get(Fp(r,s))?.walkable||n.push(Lp({x:e.x+i,z:e.z+a},.082,o))}}rebuildOwnedBoundary(e,t){let n=[],r=(e,t,r,i)=>{n.push(e,.085,t,r,.085,i)};for(let n of e)n.owned&&(t.get(Fp(n.x,n.z-1))?.owned||r(n.x-.5,n.z-.5,n.x+.5,n.z-.5),t.get(Fp(n.x,n.z+1))?.owned||r(n.x-.5,n.z+.5,n.x+.5,n.z+.5),t.get(Fp(n.x-1,n.z))?.owned||r(n.x-.5,n.z-.5,n.x-.5,n.z+.5),t.get(Fp(n.x+1,n.z))?.owned||r(n.x+.5,n.z-.5,n.x+.5,n.z+.5));if(n.length===0)return;let i=new Or;i.setAttribute(`position`,new gr(n,3));let a=new ki(i,this.boundaryMaterial);a.name=`Surveyed owned-land boundary`,this.ownership.add(a)}rebuildParcelOverlays(e){for(let t of e){if(t.owned)continue;let e=t.bounds.maxX-t.bounds.minX+1,n=t.bounds.maxZ-t.bounds.minZ+1,r=new K(this.parcelGeometry,t.purchasable?this.availableMaterial:this.lockedMaterial);r.name=`${t.name} — ${t.status}`,r.position.set((t.bounds.minX+t.bounds.maxX)/2,-.055,(t.bounds.minZ+t.bounds.maxZ)/2),r.scale.set(e-.12,1,n-.12),r.userData.parcelId=t.id,this.parcelOverlays.add(r)}}disposeInstanceBuffers(e){e.traverse(e=>{e instanceof ci&&e.dispose()})}},zp=33,Bp=new Yn(new H(-4.5,0,24),new H(4.5,6,32));function Vp(){let e=new Or,t=new Float32Array([0,0,1.05,.62,0,.24,-.62,0,.24,-.24,0,.28,.24,0,-.46,-.24,0,-.46,-.24,0,.28,.24,0,.28,.24,0,-.46]);return e.setAttribute(`position`,new pr(t,3)),e.computeVertexNormals(),e}var Hp=class{world;assetFactory;callbacks;pointer=new V;raycaster=new No;groundPlane=new fi(new H(0,1,0),0);hit=new H;previewRoot=new Tn;footprintMaterial=new zr({color:5364131,transparent:!0,opacity:.34,depthWrite:!1});footprintMesh=new K(new Fi(1,.06,1),this.footprintMaterial);facingMaterial=new zr({color:5364131,transparent:!0,opacity:.92,depthWrite:!1,depthTest:!1,side:2,fog:!1});facingArrow=new K(Vp(),this.facingMaterial);activeKind=null;activeSpec=null;previewModel=null;rotation=0;valid=!1;positionPinned=!1;placedCounter=1;pointerWorld={x:0,z:0};constructor(e,t,n){this.world=e,this.assetFactory=t,this.callbacks=n,this.previewRoot.visible=!1,this.previewRoot.add(this.footprintMesh),this.facingArrow.renderOrder=6,this.previewRoot.add(this.facingArrow),this.world.add(this.previewRoot)}get active(){return this.activeKind!==null}get position(){return{...this.pointerWorld}}get pinned(){return this.positionPinned}get nextFacilityId(){return`facility-${this.placedCounter}`}reserveIds(e){for(let t of e){let e=/^facility-(\d+)$/.exec(t);if(!e)continue;let n=Number.parseInt(e[1]??``,10);Number.isFinite(n)&&(this.placedCounter=Math.max(this.placedCounter,n+1))}}begin(e,t=0){this.cancel(!1);let n=su(e);this.activeKind=e,this.activeSpec=n,this.positionPinned=!1,this.rotation=(t%(Math.PI*2)+Math.PI*2)%(Math.PI*2),this.previewRoot.rotation.y=this.rotation;let r=this.assetFactory.createPlaceable(e);this.previewModel=r,this.setPreviewTransparency(r,.62),this.previewRoot.add(r),this.previewRoot.visible=!0,this.footprintMesh.scale.set(n.footprint[0],1,n.footprint[1]);let i=Math.min(2.4,Math.max(1,Math.min(n.footprint[0],n.footprint[1])*.34));this.facingArrow.scale.setScalar(i),this.facingArrow.position.set(0,.09,n.footprint[1]/2+.55+i*.6),this.updateValidity([])}updatePointer(e,t,n,r){if(!this.active||(this.pointer.x=e/window.innerWidth*2-1,this.pointer.y=-(t/window.innerHeight)*2+1,this.raycaster.setFromCamera(this.pointer,n),!this.raycaster.ray.intersectPlane(this.groundPlane,this.hit)))return!1;let i=this.activeSpec?this.rotatedFootprint(this.activeSpec):[1,1],a=i[0]%2==0?.5:0,o=i[1]%2==0?.5:0;return this.pointerWorld={x:Math.round(this.hit.x-a)+a,z:Math.round(this.hit.z-o)+o},this.previewRoot.position.set(this.pointerWorld.x,.04,this.pointerWorld.z),this.updateValidity(r),!0}nudge(e,t,n){return this.active?(this.pointerWorld={x:this.pointerWorld.x+Math.round(e),z:this.pointerWorld.z+Math.round(t)},this.previewRoot.position.set(this.pointerWorld.x,.04,this.pointerWorld.z),this.positionPinned=!0,this.updateValidity(n),!0):!1}pinPosition(e){return this.active?(this.positionPinned=!0,this.updateValidity(e),!0):!1}rotate(e){if(this.active){if(this.rotation=(this.rotation+Math.PI/2)%(Math.PI*2),this.previewRoot.rotation.y=this.rotation,this.activeSpec){let e=this.rotatedFootprint(this.activeSpec),t=e[0]%2==0?.5:0,n=e[1]%2==0?.5:0;this.pointerWorld={x:Math.round(this.pointerWorld.x-t)+t,z:Math.round(this.pointerWorld.z-n)+n},this.previewRoot.position.set(this.pointerWorld.x,.04,this.pointerWorld.z)}this.updateValidity(e)}}confirm(e){if(!this.activeKind||!this.activeSpec||!this.positionPinned||(this.updateValidity(e),!this.valid))return null;let t=this.assetFactory.createPlaceable(this.activeKind);t.position.set(this.pointerWorld.x,0,this.pointerWorld.z),t.rotation.y=this.rotation;let n={id:`facility-${this.placedCounter++}`,spec:this.activeSpec,position:{...this.pointerWorld},rotation:this.rotation,object:t,queueLength:0,activeUsers:0};this.world.add(t);let r={placed:n};return this.callbacks.onPlaced(r),this.cancel(!1),r}cancel(e=!0){this.previewModel&&(this.previewRoot.remove(this.previewModel),this.disposePreview(this.previewModel)),this.previewModel=null,this.activeKind=null,this.activeSpec=null,this.previewRoot.visible=!1,this.previewRoot.rotation.y=0,this.valid=!1,this.positionPinned=!1,e&&this.callbacks.onCancelled()}dispose(){this.cancel(!1),this.world.remove(this.previewRoot),this.footprintMesh.geometry.dispose(),this.footprintMaterial.dispose(),this.facingArrow.geometry.dispose(),this.facingMaterial.dispose()}updateValidity(e){if(!this.activeSpec)return;let t=this.rotatedFootprint(this.activeSpec),n=this.boundsAt(this.pointerWorld,t[0],t[1]),r=n.min.x>=-33&&n.max.x<=zp&&n.min.z>=-33&&n.max.z<=zp,i=!n.intersectsBox(Bp),a=e.every(e=>{let t=this.rotatedFootprint(e.spec,e.rotation),r=this.boundsAt(e.position,t[0],t[1]);return!n.intersectsBox(r)}),o=this.callbacks.validatePlacement?.(this.activeSpec,{...this.pointerWorld},this.rotation)??{valid:!0,connected:!0,message:`Clear to build`};this.valid=r&&i&&a&&o.valid;let s=this.valid&&o.connected,c=this.valid?{valid:!0,connected:s,message:s?o.message:`No route yet — guests will wait for a connected path`}:{valid:!1,connected:!1,message:r?i?a?o.message:`That space is already occupied`:`Keep the entrance clear`:`Move inside your park boundary`},l=this.valid?s?5364131:15775066:16739165;this.footprintMaterial.color.setHex(l),this.facingMaterial.color.setHex(l),this.setPreviewColor(this.previewModel,new G(l)),this.callbacks.onPreviewChanged({...c,valid:c.valid&&this.positionPinned,message:!this.positionPinned&&c.valid?`Click a plot to lock this location`:c.message},{...this.pointerWorld},this.rotation)}rotatedFootprint(e,t=this.rotation){return Math.round(t/(Math.PI/2))%2==0?e.footprint:[e.footprint[1],e.footprint[0]]}boundsAt(e,t,n){let r=.28;return new Yn(new H(e.x-t/2-r,0,e.z-n/2-r),new H(e.x+t/2+r,8,e.z+n/2+r))}setPreviewTransparency(e,t){e.traverse(e=>{e instanceof K&&(e.material=(Array.isArray(e.material)?e.material:[e.material]).map(e=>{let n=e.clone();return n.transparent=!0,n.opacity=t,n.depthWrite=!1,n}))})}setPreviewColor(e,t){e?.traverse(e=>{if(!(e instanceof K))return;let n=Array.isArray(e.material)?e.material:[e.material];for(let e of n)`emissive`in e&&e.emissive instanceof G&&e.emissive.copy(t).multiplyScalar(.13)})}disposePreview(e){e.traverse(e=>{if(!(e instanceof K))return;e.geometry.dispose();let t=Array.isArray(e.material)?e.material:[e.material];for(let e of t)e.dispose()})}},Up=Object.freeze({phase:`inactive`});function Wp(e,t=!1){return{state:{phase:e},updatePreview:t}}function Gp(e,t){switch(t.type){case`begin`:return Wp(`tracking`);case`cancel`:case`confirm`:return Wp(`inactive`);case`rotate`:return Wp(e.phase);case`pointer-move`:return e.phase===`inactive`?Wp(`inactive`):t.pointerType===`mouse`?Wp(e.phase,e.phase===`tracking`):Wp(e.phase,!0);case`primary-canvas-press`:return e.phase===`inactive`?Wp(`inactive`):Wp(`pinned`,!0)}}var Kp=20,qp=.7,Jp=9,Yp=350,Xp=class{root;renderer;scene=new Pn;camera=new uo(54,1,.1,420);fog=new Nn(11061440,.013);world=new Tn;dynamicLayer=new Tn;materials;assets;simulation=new td;parkGrid=new Sd;input;ui;placement;infrastructureBuilder=new Pp;infrastructureView;clock=new Io;placedObjects=[];guestVisuals=new Map;staffVisuals=new Map;litterVisuals=new Map;player;playerPosition=new H(0,0,18.5);cameraTarget=new H;cameraTargetDesired=new H;cameraDesired=new H;moveDirection=new H;buildPointer=new V;buildRaycaster=new No;groundPlane=new fi(new H(0,1,0),0);groundHit=new H;unregisterSimulation;sun;ambient;skyColor=new G;lastSkyMinute=NaN;animationFrame=0;cameraYaw=0;cameraPitch=.44;cameraDistance=8.2;freeCamera=kp();running=!1;started=!1;mode=`explore`;cameraMode=`follow`;activePlaceable=null;drawingSurface=!1;placementPointer={...Up};lastStatsUiUpdate=0;isPaused=!1;saveBackend;parkName=`My Park`;autosaveCountdown=Kp;savePending=!1;saveInFlight=!1;pendingSave=null;selectedId=null;movingOrigin=null;selectionMarker=new Tn;selectionPad;selectionArrow;tapCandidate=null;guestRenderBudget;staffRenderBudget;constructor(e){this.root=e,this.renderer=new eu({antialias:!0,powerPreference:`high-performance`}),this.renderer.domElement.className=`game-canvas`,this.renderer.domElement.tabIndex=0,this.renderer.outputColorSpace=ze,this.renderer.toneMapping=4,this.renderer.toneMappingExposure=1.08,this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.autoUpdate=!0,this.root.append(this.renderer.domElement);let t=document.createElement(`div`);t.id=`joystick-bootstrap`,t.hidden=!0,this.root.append(t),this.materials=new Vf({renderer:this.renderer,textureAssetBaseUrl:`./assets/textures`});let n=window.matchMedia(`(pointer: coarse)`).matches||(navigator.deviceMemory??8)<=4;this.assets=new $f({materials:this.materials,quality:n?`mobile`:`high`}),this.guestRenderBudget=n?42:90,this.staffRenderBudget=Math.max(6,Math.round(this.guestRenderBudget/4)),this.infrastructureView=new Rp(this.materials),this.player=this.assets.createPlayer(),this.root.dataset.playerX=this.playerPosition.x.toFixed(3),this.root.dataset.playerZ=this.playerPosition.z.toFixed(3),this.selectionPad=new K(new Fi(1,.05,1),new zr({color:9105604,transparent:!0,opacity:.5,depthWrite:!1,fog:!1})),this.selectionArrow=new K(Vp(),new zr({color:9105604,transparent:!0,opacity:.95,depthWrite:!1,depthTest:!1,side:2,fog:!1})),this.selectionArrow.renderOrder=6,this.selectionMarker.add(this.selectionPad,this.selectionArrow),this.selectionMarker.visible=!1,this.saveBackend=nf(),this.ui=new op(this.root,{onStart:()=>this.openGates(),onContinue:()=>this.resumeSavedPark(),onNewPark:()=>this.discardSavedPark(),onToggleBuild:()=>this.toggleBuildMode(),onSelectPlaceable:e=>this.beginPlacement(e),onSelectInfrastructure:e=>this.beginInfrastructure(e),onBuyParcel:e=>this.buyParcel(e),onRotate:()=>this.rotatePlacement(),onNudge:(e,t)=>this.nudgePlacement(e,t),onConfirm:()=>this.confirmBuild(),onCancel:()=>this.cancelBuild(),onMoveSelected:()=>this.moveSelected(),onRotateSelected:()=>this.rotateSelected(),onSellSelected:()=>this.sellSelected(),onCloseInspector:()=>this.closeInspector(),onPause:()=>this.togglePause(),onToggleCamera:()=>this.toggleCameraMode(),onReframeCamera:()=>this.reframeFreeCamera(),onSetPrice:(e,t)=>this.setPrice(e,t),onStartOver:()=>void this.startOver()});let r=this.requireElement(`#movement-joystick`);this.input=new pf(this.renderer.domElement,r),t.remove(),this.placement=new Hp(this.world,this.assets,{onPreviewChanged:e=>{this.activePlaceable&&this.ui.setPlacement(this.activePlaceable,e)},onPlaced:({placed:e})=>this.onPlaced(e),onCancelled:()=>this.exitPlacement(),validatePlacement:(e,t,n)=>this.validateFacilityPlacement(e.footprint,e.serviceNeed!==null,t,n)}),this.unregisterSimulation=this.simulation.subscribe(e=>this.ui.handleEvent(e)),this.setupScene(),this.refreshInfrastructure(),this.seedStarterPark(),this.bindEvents(),this.resize(),this.ui.updateStats(this.simulation.getStats()),this.ui.updateInfrastructure(this.parkGrid.getParcelSnapshots(),this.parkGrid.getCosts())}async initialize(){let e=null;try{e=await this.saveBackend.load()}catch{e=null}if(!e)return;let{save:t,warnings:n}=Xd(e);if(!t){await this.saveBackend.clear().catch(()=>{}),n[0]&&this.ui.toast(n[0],`warning`);return}this.pendingSave=t,this.ui.showResumeOption({parkName:t.parkName,day:t.simulation.stats?.day??1,cash:t.simulation.stats?.cash??0,buildings:t.buildings.length,storageLabel:this.saveBackend.label})}start(){this.running||(this.running=!0,this.clock.start(),this.animationFrame=requestAnimationFrame(this.animate))}debugSetClock(e){this.simulation.debugSetClock(e);let t=this.simulation.getStats().minuteOfDay;this.applySkyCycle(t,!0),this.ui.updateStats(this.simulation.getStats()),this.renderer.render(this.scene,this.camera)}dispose(){this.running=!1,cancelAnimationFrame(this.animationFrame),this.unregisterSimulation(),this.input.dispose(),this.ui.dispose(),this.placement.dispose(),this.infrastructureView.dispose(),window.removeEventListener(`resize`,this.resize),window.removeEventListener(`pagehide`,this.saveBeforeHidden),document.removeEventListener(`visibilitychange`,this.saveBeforeHidden),this.renderer.domElement.removeEventListener(`pointermove`,this.onPointerMove),this.renderer.domElement.removeEventListener(`pointerdown`,this.onPointerDown),this.renderer.domElement.removeEventListener(`pointerup`,this.onPointerUp),this.renderer.domElement.removeEventListener(`pointercancel`,this.onPointerUp),this.renderer.domElement.removeEventListener(`contextmenu`,this.preventContextMenu),this.assets.dispose?.(),this.materials.dispose(),this.renderer.dispose(),this.renderer.domElement.remove()}setupScene(){this.scene.background=new G(10470078),this.scene.fog=this.fog,this.scene.add(this.world),this.world.add(this.dynamicLayer);let e=this.assets.createLandscape({includePromenade:!1});this.world.add(e),this.world.add(this.infrastructureView.object);let t=this.assets.createParkGate();t.position.set(0,0,29.2),this.world.add(t),this.player.position.copy(this.playerPosition),this.dynamicLayer.add(this.player),this.world.add(this.selectionMarker);let n=new ho(11193541,1.18);this.ambient=n,this.scene.add(n);let r=new mo(16771005,3.25);this.sun=r,r.position.set(-24,36,18),r.castShadow=!0,r.shadow.mapSize.set(1024,1024),r.shadow.camera.left=-42,r.shadow.camera.right=42,r.shadow.camera.top=42,r.shadow.camera.bottom=-42,r.shadow.camera.near=1,r.shadow.camera.far=90,r.shadow.bias=-25e-5,r.shadow.normalBias=.03,this.scene.add(r),this.applySkyCycle(this.simulation.getStats().minuteOfDay,!0),this.camera.position.set(7,5.4,35),this.cameraTarget.copy(this.playerPosition).add(new H(0,1.25,0)),this.cameraTargetDesired.copy(this.cameraTarget),this.camera.lookAt(this.cameraTarget)}selectPlaced(e){this.selectedId=e.id,this.mode=`inspect`,this.ui.setMode(`inspect`),this.applyInputState(),this.infrastructureView.setLandMode(!1),this.applySimulationState(),this.updateSelectionMarker(),this.refreshInspector()}closeInspector(){this.selectedId=null,this.selectionMarker.visible=!1,this.mode=`explore`,this.ui.setMode(`explore`),this.applyInputState(),this.applySimulationState()}getSelected(){return this.selectedId?this.placedObjects.find(e=>e.id===this.selectedId)??null:null}refreshInspector(){let e=this.getSelected();if(!e)return;let t=e.spec,n=!ou(t)||e.object.userData.connected!==!1,r;r=ou(t)?n?t.staff?`One ${au[t.staff]} on duty · wages ${t.upkeep}/cycle`:`Open · queue ${e.queueLength} · upkeep ${t.upkeep}/cycle`:`No path reaches this yet`:`Upkeep ${t.upkeep}/cycle`,this.ui.setInspector({name:t.name,detail:r,tone:n?`positive`:`warning`,resale:Math.round(t.cost*qp),price:t.staff?void 0:this.simulation.getPrice(t.kind)})}setPrice(e,t){let n=this.simulation.setPrice(e,t);this.refreshPricing(),this.refreshInspector(),this.ui.toast(n>0?`${su(e).shortName} now ${n.toLocaleString(`en-US`,{style:`currency`,currency:`USD`,maximumFractionDigits:0})} per guest`:`${su(e).shortName} is now free`,`neutral`),this.requestSave()}refreshPricing(){let e=this.simulation.getStats();this.ui.updatePricing(this.simulation.getPrices(),e.reputation,{day:e.day,cash:e.cash,buildings:this.placedObjects.length})}async startOver(){this.started=!1,this.applySimulationState(),await this.saveBackend.clear().catch(()=>{}),window.location.reload()}updateSelectionMarker(){let e=this.getSelected();if(!e){this.selectionMarker.visible=!1;return}let[t,n]=e.spec.footprint;this.selectionPad.scale.set(t+.6,1,n+.6);let r=Math.min(2.4,Math.max(1,Math.min(t,n)*.34));this.selectionArrow.scale.setScalar(r),this.selectionArrow.position.set(0,.12,n/2+.55+r*.6),this.selectionMarker.position.set(e.position.x,.06,e.position.z),this.selectionMarker.rotation.y=e.rotation,this.selectionMarker.visible=!0}rotateSelected(){let e=this.getSelected();if(!e)return;let t=(e.rotation+Math.PI/2)%(Math.PI*2),n=this.placedObjects.filter(t=>t.id!==e.id);if(!this.canOccupy(e.spec,e.position,t,n)){this.ui.toast(`No room to turn it there`,`warning`);return}e.rotation=t,e.object.rotation.y=t,this.syncFacilities(),this.updateSelectionMarker(),this.refreshInspector(),this.requestSave()}moveSelected(){let e=this.getSelected();e&&(this.movingOrigin={id:e.id,kind:e.spec.kind,position:{...e.position},rotation:e.rotation},this.removePlaced(e),this.selectedId=null,this.selectionMarker.visible=!1,this.activePlaceable=e.spec.kind,this.placementPointer=Gp(this.placementPointer,{type:`begin`}).state,this.mode=`placing`,this.applyInputState(),this.infrastructureView.setLandMode(!1),this.ui.setMode(`placing`),this.applySimulationState(),this.placement.begin(e.spec.kind,e.rotation),this.placement.updatePointer(window.innerWidth/2,window.innerHeight/2,this.camera,this.placedObjects),this.exposePlacementPointerState(),this.ui.toast(`Pick a new spot, or cancel to put it back`,`neutral`))}sellSelected(){let e=this.getSelected();if(!e)return;let t=Math.round(e.spec.cost*qp);this.removePlaced(e),this.simulation.refundExpense(t),this.closeInspector(),this.syncFacilities(),this.ui.updateStats(this.simulation.getStats()),this.ui.toast(`${e.spec.shortName} sold for $${t.toLocaleString(`en-US`)}`,`positive`),this.requestSave()}removePlaced(e){let t=this.placedObjects.indexOf(e);t>=0&&this.placedObjects.splice(t,1),e.object.removeFromParent()}canOccupy(e,t,n,r){let i=this.footprintBounds(t,e.footprint,n),a=this.cellsInFootprint(i);return!a.every(e=>this.parkGrid.isOwned(e))||!a.every(e=>this.parkGrid.getSurface(e)===`lawn`)?!1:r.every(e=>{let t=this.footprintBounds(e.position,e.spec.footprint,e.rotation);return i.minX>t.maxX||i.maxX<t.minX||i.minZ>t.maxZ||i.maxZ<t.minZ})}pickPlaced(e,t){this.buildPointer.x=e/window.innerWidth*2-1,this.buildPointer.y=-(t/window.innerHeight)*2+1,this.buildRaycaster.setFromCamera(this.buildPointer,this.camera);let n=this.buildRaycaster.intersectObjects(this.placedObjects.map(e=>e.object),!0)[0];return n?this.placedObjects.find(e=>{let t=n.object;for(;t;){if(t===e.object)return!0;t=t.parent}return!1})??null:null}seedStarterPark(){this.addFreePlaceable(`park-lamp`,{x:-3.7,z:21.5},0),this.addFreePlaceable(`park-lamp`,{x:3.7,z:21.5},Math.PI),this.addFreePlaceable(`bench`,{x:-4.7,z:15},Math.PI/2),this.addFreePlaceable(`trash-bin`,{x:3.2,z:14.8},0),this.addFreePlaceable(`shade-tree`,{x:-9,z:17},0),this.addFreePlaceable(`shade-tree`,{x:10,z:18},0),this.syncFacilities()}addFreePlaceable(e,t,n){let r=this.getSpec(e),i=this.assets.createPlaceable(e);i.position.set(t.x,0,t.z),i.rotation.y=n,this.world.add(i),this.placedObjects.push({id:`starter-${e}-${this.placedObjects.length+1}`,spec:r,position:{...t},rotation:n,object:i,queueLength:0,activeUsers:0})}openGates(){this.started=!0,this.applySimulationState(),this.ui.toast(`The park is open`,`positive`),this.requestSave()}resumeSavedPark(){let e=this.pendingSave;if(this.pendingSave=null,!e){this.openGates();return}this.applySave(e),this.started=e.started;let t=e.savedAt>0?(Date.now()-e.savedAt)/1e3:0;if(this.started&&t>0){let e=Gd(this.simulation.getStats(),this.buildAwayProfile(),t,this.simulation.getLitter().length);if(e){let t=this.simulation.getStats().reputation;this.simulation.applyAwayProgress(e),this.ui.showAwayReport(e,t)}}this.started||=!0,this.applySimulationState(),this.ui.updateStats(this.simulation.getStats()),this.requestSave()}discardSavedPark(){this.pendingSave=null,this.saveBackend.clear().catch(()=>{}),this.ui.showFreshStart(),this.ui.toast(`Saved park cleared`,`neutral`)}applySave(e){if(!this.parkGrid.loadSaveState(e.grid)){this.ui.toast(`That park did not fit this map — starting fresh`,`warning`);return}this.parkName=e.parkName,this.clearPlacedObjects();for(let t of e.buildings)this.addSavedPlaceable(t.id,t.kind,{x:t.x,z:t.z},t.rotation);this.simulation.loadSaveState(e.simulation),this.playerPosition.set(e.player.x,0,e.player.z),this.player.position.copy(this.playerPosition),this.root.dataset.playerX=this.playerPosition.x.toFixed(3),this.root.dataset.playerZ=this.playerPosition.z.toFixed(3),this.placement.reserveIds(this.placedObjects.map(e=>e.id)),this.refreshInfrastructure(),this.syncFacilities(),this.syncLitterVisuals(this.simulation.getLitter())}clearPlacedObjects(){for(let e of this.placedObjects)e.object.removeFromParent();this.placedObjects.length=0}addSavedPlaceable(e,t,n,r){let i=this.getSpec(t),a=this.assets.createPlaceable(t);a.position.set(n.x,0,n.z),a.rotation.y=r,this.world.add(a),this.placedObjects.push({id:e,spec:i,position:{...n},rotation:r,object:a,queueLength:0,activeUsers:0})}captureSave(){return{format:Kd,version:1,savedAt:Date.now(),parkName:this.parkName,started:this.started,grid:this.parkGrid.getSaveState(),simulation:this.simulation.getSaveState(),buildings:this.placedObjects.map(e=>({id:e.id,kind:e.spec.kind,x:e.position.x,z:e.position.z,rotation:e.rotation})),player:{x:this.playerPosition.x,z:this.playerPosition.z}}}requestSave(){this.savePending=!0,this.autosaveCountdown=Kp,this.flushSave()}async flushSave(){if(!(!this.savePending||this.saveInFlight)){this.savePending=!1,this.saveInFlight=!0;try{await this.saveBackend.save(Yd(this.captureSave()))}catch{this.savePending=!0}finally{this.saveInFlight=!1}}}buildAwayProfile(){let e=Ud();e.walletPerGuest=_u(this.simulation.getStats().reputation),e.janitorCount=this.placedObjects.filter(e=>e.spec.staff===`janitor`&&e.object.userData.connected!==!1).length;let t={hunger:0,fun:0,bladder:0,rest:0},n={hunger:0,fun:0,bladder:0,rest:0},r=this.placedObjects.map(e=>({spec:e.spec,position:e.position,connected:!ou(e.spec)||e.object.userData.connected!==!1}));e.appeal=Ed(r);for(let[i,a]of this.placedObjects.entries()){let o=a.spec;if(e.upkeepPerCycle+=o.upkeep,!r[i]?.connected)continue;o.serviceNeed===`trash`&&(e.binCount+=1),o.category===`food`&&(e.foodCount+=1);let s=o.serviceNeed;if(s===null||s===`trash`||s===`information`||s===`cash`||o.serviceSeconds<=0||o.capacity<=0)continue;let c=o.capacity/o.serviceSeconds;e.needs[s].throughput+=c,t[s]+=c*this.simulation.getPrice(o.kind),n[s]+=c*this.simulation.getAcceptanceRate(o.kind)}for(let r of Object.keys(e.needs)){let i=e.needs[r].throughput;e.needs[r].revenuePerService=i>0?t[r]/i:0,e.needs[r].acceptance=i>0?n[r]/i:1}return e}toggleBuildMode(){if(this.mode===`placing`){this.cancelPlacement();return}if(this.mode===`surface`){this.cancelInfrastructure(!1),this.mode=`explore`,this.ui.setMode(`explore`),this.applyInputState(),this.infrastructureView.setLandMode(!1),this.applySimulationState();return}this.mode=this.mode===`build`?`explore`:`build`,this.ui.setMode(this.mode),this.applyInputState(),this.infrastructureView.setLandMode(this.mode===`build`),this.applySimulationState()}beginPlacement(e){this.simulation.purchase(e)&&(this.activePlaceable=e,this.placementPointer=Gp(this.placementPointer,{type:`begin`}).state,this.mode=`placing`,this.applyInputState(),this.infrastructureView.setLandMode(!1),this.ui.setMode(`placing`),this.applySimulationState(),this.placement.begin(e),this.placement.updatePointer(window.innerWidth/2,window.innerHeight/2,this.camera,this.placedObjects),this.exposePlacementPointerState())}nudgePlacement(e,t){if(this.mode!==`placing`)return;let n=new H;this.camera.getWorldDirection(n),n.y=0,n.lengthSq()<1e-6&&n.set(0,0,-1),n.normalize();let r=new H(-n.z,0,n.x),i=e=>Math.abs(e.x)>=Math.abs(e.z)?{x:Math.sign(e.x),z:0}:{x:0,z:Math.sign(e.z)},a=i(n),o=i(r),s=a.x*-t+o.x*e,c=a.z*-t+o.z*e;(s!==0||c!==0)&&(this.placement.nudge(s,c,this.placedObjects),this.placementPointer=Gp(this.placementPointer,{type:`confirm`}).state,this.exposePlacementPointerState())}rotatePlacement(){this.placementPointer=Gp(this.placementPointer,{type:`rotate`}).state,this.placement.rotate(this.placedObjects)}confirmPlacement(){let e=this.placement.confirm(this.placedObjects);e&&(this.placementPointer=Gp(this.placementPointer,{type:`confirm`}).state,this.exposePlacementPointerState()),e||this.ui.toast(`That plot is blocked`,`warning`)}confirmBuild(){this.mode===`surface`?this.confirmInfrastructure():this.confirmPlacement()}cancelBuild(){this.mode===`surface`?this.cancelInfrastructure():this.cancelPlacement()}cancelPlacement(){let e=this.movingOrigin;if(e){this.movingOrigin=null,this.addSavedPlaceable(e.id,e.kind,e.position,e.rotation),this.placement.cancel(!1),this.placementPointer=Gp(this.placementPointer,{type:`cancel`}).state,this.syncFacilities(),this.exitPlacement(),this.ui.toast(`Move cancelled`,`neutral`);return}this.activePlaceable&&this.simulation.refund(this.activePlaceable),this.placement.cancel(!1),this.placementPointer=Gp(this.placementPointer,{type:`cancel`}).state,this.exitPlacement()}exitPlacement(){this.activePlaceable=null,this.exposePlacementPointerState(),this.mode=`build`,this.ui.setMode(`build`),this.applyInputState(),this.infrastructureView.setLandMode(!0),this.applySimulationState()}beginInfrastructure(e){this.activePlaceable=null,this.infrastructureBuilder.begin(e),this.mode=`surface`,this.drawingSurface=!1,this.applyInputState(),this.infrastructureView.setLandMode(!1),this.ui.setMode(`surface`),this.updateInfrastructureQuote(),this.applySimulationState()}cancelInfrastructure(e=!0){this.infrastructureBuilder.cancel(),this.infrastructureView.clearPreview(),this.drawingSurface=!1,e&&(this.mode=`build`,this.ui.setMode(`build`),this.applyInputState(),this.infrastructureView.setLandMode(!0),this.applySimulationState())}confirmInfrastructure(){let e=this.infrastructureBuilder.tool;if(!e)return;let{cells:t,quote:n,valid:r,reason:i}=this.infrastructureQuote();if(!r){this.ui.toast(i===`insufficient-funds`?`Not enough park funds`:`Adjust that stroke`,`warning`);return}if(!this.simulation.spend(n.cost))return;let a=e===`demolish`?this.parkGrid.demolish(t):this.parkGrid.construct(t,e);if(!a.applied){this.simulation.refundExpense(n.cost),this.ui.toast(`The park changed — draw that stroke again`,`warning`),this.updateInfrastructureQuote();return}this.infrastructureBuilder.clear(),this.refreshInfrastructure(),this.syncFacilities(),this.updateInfrastructureQuote(),this.requestSave(),this.ui.toast(e===`demolish`?`${a.cellCount} path ${a.cellCount===1?`tile`:`tiles`} removed`:`${a.cellCount} ${e===`road`?`road`:`sidewalk`} ${a.cellCount===1?`tile`:`tiles`} built`,`positive`)}buyParcel(e){let t=this.parkGrid.quoteParcelPurchase(e);if(!t.valid){this.ui.toast(`That parcel is not available yet`,`warning`);return}if(!this.simulation.spend(t.cost))return;if(!this.parkGrid.purchaseParcel(e).purchased){this.simulation.refundExpense(t.cost);return}this.refreshInfrastructure(),this.infrastructureView.setLandMode(this.mode===`build`),this.requestSave();let n=this.parkGrid.getParcelSnapshot(e);this.ui.toast(`${n?.name??`Land`} added to your park`,`positive`)}infrastructureQuote(){let e=this.infrastructureBuilder.tool,t=this.infrastructureBuilder.cells;if(!e){let e=this.parkGrid.quoteConstruction([],`sidewalk`);return{cells:[],quote:e,valid:!1,reason:e.reason}}let n=t.filter(t=>e===`demolish`?this.parkGrid.getSurface(t)!==`lawn`:this.parkGrid.getSurface(t)===`lawn`),r=e!==`demolish`&&n.some(e=>this.isCellInsideFacility(e)),i=this.parkGrid.getEntranceCell(),a=e===`demolish`&&n.some(e=>e.x===i.x&&e.z===i.z),o=e===`demolish`?this.parkGrid.quoteDemolition(n):this.parkGrid.quoteConstruction(n,e),s=this.simulation.getStats().cash>=o.cost;return{cells:n,quote:o,valid:o.valid&&!r&&!a&&s,reason:r?`occupied`:a?`entrance-required`:!s&&o.valid?`insufficient-funds`:o.reason}}updateInfrastructureQuote(){let e=this.infrastructureBuilder.tool;if(!e)return;let{cells:t,quote:n,valid:r,reason:i}=this.infrastructureQuote();this.infrastructureView.setPreview(t,e,r),this.ui.setInfrastructureStroke(e,t.length,n.cost,r,i)}isCellInsideFacility(e){return this.placedObjects.some(t=>{let n=this.footprintBounds(t.position,t.spec.footprint,t.rotation);return e.x>=n.minX&&e.x<=n.maxX&&e.z>=n.minZ&&e.z<=n.maxZ})}onPlaced(e){this.movingOrigin&&=(e.id=this.movingOrigin.id,null),this.placedObjects.push(e),this.syncFacilities(),this.activePlaceable=null,this.mode=`explore`,this.ui.setMode(`explore`),this.applyInputState(),this.infrastructureView.setLandMode(!1),this.applySimulationState(),this.requestSave();let t=!ou(e.spec)||e.object.userData.connected!==!1;this.ui.toast(t?`${e.spec.shortName} opened`:`${e.spec.shortName} needs a connected path`,t?`positive`:`warning`)}syncFacilities(){let e=new Map,t=this.placedObjects.filter(e=>ou(e.spec)).map(t=>{let n=this.footprintBounds(t.position,t.spec.footprint,t.rotation),r=this.parkGrid.getFacilityConnectivity(this.parkGrid.getApproachCells(n));return e.set(t.id,r),t.object.userData.connected=r.connected,{id:t.id,kind:t.spec.kind,position:{...t.position},rotation:t.rotation,queueLength:t.queueLength,activeUsers:t.activeUsers,enabled:r.connected,accessPoint:r.approachCell?this.parkGrid.cellToWorld(r.approachCell)??void 0:void 0}});this.simulation.setFacilities(t);let n=Ed(this.placedObjects.map(t=>({spec:t.spec,position:t.position,connected:!ou(t.spec)||e.get(t.id)?.connected===!0}))),r=this.placedObjects.reduce((e,t)=>e+t.spec.upkeep,0);this.simulation.setParkMetrics(n,r)}refreshInfrastructure(){let e=this.parkGrid.getSnapshot();this.infrastructureView.update(e);let t=this.parkGrid.getReachableCells().map(e=>({...e}));this.simulation.setNavigationNetwork({destinations:t,findPath:(e,t)=>{let n=this.parkGrid.worldToCell(e.x,e.z),r=this.parkGrid.worldToCell(t.x,t.z);return!n||!r?null:this.parkGrid.findRoute(n,r)?.map(e=>({...e}))??null}}),this.ui?.updateInfrastructure(this.parkGrid.getParcelSnapshots(),this.parkGrid.getCosts())}validateFacilityPlacement(e,t,n,r){let i=this.footprintBounds(n,e,r),a=this.cellsInFootprint(i);if(!a.every(e=>this.parkGrid.isOwned(e)))return{valid:!1,connected:!1,message:`Purchase this land before building here`};if(!a.every(e=>this.parkGrid.getSurface(e)===`lawn`))return{valid:!1,connected:!1,message:`Move the building off roads and sidewalks`};if(!t)return{valid:!0,connected:!0,message:`Clear to build`};let o=this.parkGrid.getFacilityConnectivity(this.parkGrid.getApproachCells(i));return{valid:!0,connected:o.connected,message:o.connected?`Connected to the entrance`:`No route yet`}}footprintBounds(e,t,n){let r=Math.abs(Math.round(n/(Math.PI/2)))%2==1,i=r?t[1]:t[0],a=r?t[0]:t[1],o=Math.round(e.x-(i-1)/2),s=Math.round(e.z-(a-1)/2);return{minX:o,maxX:o+i-1,minZ:s,maxZ:s+a-1}}cellsInFootprint(e){let t=[];for(let n=e.minZ;n<=e.maxZ;n+=1)for(let r=e.minX;r<=e.maxX;r+=1)t.push({x:r,z:n});return t}togglePause(){this.started&&(this.isPaused=!this.isPaused,this.applySimulationState(),this.ui.setPaused(this.isPaused),this.renderer.domElement.focus({preventScroll:!0}))}toggleCameraMode(){this.cameraMode=this.cameraMode===`follow`?`overview`:`follow`,this.cameraMode===`overview`&&this.resetFreeCamera(),this.ui.setCameraMode(this.cameraMode),this.applyInputState(),this.renderer.domElement.focus({preventScroll:!0}),this.player.userData.isWalking=!1,this.assets.setCharacterMotion(this.player,0),this.ui.toast(this.cameraMode===`overview`?`Free Park View — move, orbit, and zoom anywhere`:`Following your caretaker`,`positive`)}reframeFreeCamera(){this.mode===`explore`&&this.cameraMode===`overview`&&(this.resetFreeCamera(),this.renderer.domElement.focus({preventScroll:!0}),this.ui.toast(`Park View recentered`,`positive`))}applyInputState(){let e=this.mode===`explore`;this.input.setEnabled(e),this.input.setZoomEnabled(e&&this.cameraMode===`overview`),e&&this.renderer.domElement.focus({preventScroll:!0})}applySimulationState(){this.simulation.setRunning(this.started&&!this.isPaused&&this.mode===`explore`)}bindEvents(){window.addEventListener(`resize`,this.resize),window.addEventListener(`pagehide`,this.saveBeforeHidden),document.addEventListener(`visibilitychange`,this.saveBeforeHidden),this.renderer.domElement.addEventListener(`pointermove`,this.onPointerMove),this.renderer.domElement.addEventListener(`pointerdown`,this.onPointerDown),this.renderer.domElement.addEventListener(`pointerup`,this.onPointerUp),this.renderer.domElement.addEventListener(`pointercancel`,this.onPointerUp),this.renderer.domElement.addEventListener(`contextmenu`,this.preventContextMenu)}saveBeforeHidden=e=>{(e.type!==`visibilitychange`||document.visibilityState!==`visible`)&&this.started&&(this.mode===`placing`&&this.cancelPlacement(),this.requestSave())};onPointerMove=e=>{if(this.mode===`placing`){if(e.pointerType!==`mouse`&&!e.isPrimary||e.pointerType===`pen`&&e.buttons===0)return;let t=Gp(this.placementPointer,{type:`pointer-move`,pointerType:e.pointerType});this.placementPointer=t.state,t.updatePreview&&this.placement.updatePointer(e.clientX,e.clientY,this.camera,this.placedObjects),this.exposePlacementPointerState()}else if(this.mode===`surface`&&this.drawingSurface){let t=this.pointerToGridCell(e.clientX,e.clientY);if(!t)return;this.infrastructureBuilder.extendStroke(t),this.updateInfrastructureQuote()}};onPointerDown=e=>{if(this.tapCandidate=(this.mode===`explore`||this.mode===`build`||this.mode===`inspect`)&&e.isPrimary&&(e.pointerType!==`mouse`||e.button===0)?{x:e.clientX,y:e.clientY,time:e.timeStamp}:null,this.mode===`placing`&&e.isPrimary&&(e.pointerType!==`mouse`||e.button===0)){let t=Gp(this.placementPointer,{type:`primary-canvas-press`,pointerType:e.pointerType});this.placementPointer=t.state,t.updatePreview&&(this.placement.updatePointer(e.clientX,e.clientY,this.camera,this.placedObjects)?this.placement.pinPosition(this.placedObjects):this.placementPointer.phase===`pinned`&&!this.placement.pinned&&(this.placementPointer={phase:`tracking`})),this.exposePlacementPointerState()}else if(this.mode===`surface`&&(e.pointerType!==`mouse`||e.button===0)){let t=this.pointerToGridCell(e.clientX,e.clientY);if(!t)return;this.drawingSurface=!0,this.renderer.domElement.setPointerCapture(e.pointerId),this.infrastructureBuilder.startStroke(t),this.updateInfrastructureQuote()}};onPointerUp=e=>{let t=this.tapCandidate;if(this.tapCandidate=null,t&&e.type===`pointerup`){let n=Math.hypot(e.clientX-t.x,e.clientY-t.y),r=e.timeStamp-t.time;if(n<=Jp&&r<=Yp){let t=this.pickPlaced(e.clientX,e.clientY);if(t){this.selectPlaced(t);return}if(this.mode===`inspect`){this.closeInspector();return}}}this.mode!==`surface`||!this.drawingSurface||(this.drawingSurface=!1,this.infrastructureBuilder.endStroke(),this.renderer.domElement.hasPointerCapture(e.pointerId)&&this.renderer.domElement.releasePointerCapture(e.pointerId),this.updateInfrastructureQuote())};pointerToGridCell(e,t){let n=this.renderer.domElement.getBoundingClientRect();return this.buildPointer.x=(e-n.left)/Math.max(1,n.width)*2-1,this.buildPointer.y=-((t-n.top)/Math.max(1,n.height))*2+1,this.buildRaycaster.setFromCamera(this.buildPointer,this.camera),this.buildRaycaster.ray.intersectPlane(this.groundPlane,this.groundHit)?this.parkGrid.worldToCell(this.groundHit.x,this.groundHit.z):null}preventContextMenu=e=>e.preventDefault();resize=()=>{let e=window.innerWidth,t=window.innerHeight,n=window.matchMedia(`(pointer: coarse)`).matches,r=navigator.deviceMemory??8,i=n||r<=4?1.35:1.8;this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,i)),this.renderer.setSize(e,t,!1),this.camera.aspect=e/Math.max(1,t),this.camera.updateProjectionMatrix()};animate=()=>{if(!this.running)return;let e=Math.min(this.clock.getDelta(),.1),t=this.clock.elapsedTime;this.updateInput(e),this.simulation.update(e,{x:this.playerPosition.x,z:this.playerPosition.z}),this.syncGuestVisuals(this.simulation.getGuests(),e),this.syncStaffVisuals(this.simulation.getStaff(),e),this.syncLitterVisuals(this.simulation.getLitter()),this.animateWorld(t,e),this.updateCamera(e),t-this.lastStatsUiUpdate>.15&&(this.ui.updateStats(this.simulation.getStats()),this.refreshPricing(),this.lastStatsUiUpdate=t),this.applySkyCycle(this.simulation.getStats().minuteOfDay),this.simulation.isRunning()&&(this.autosaveCountdown-=e,this.autosaveCountdown<=0&&this.requestSave()),this.renderer.render(this.scene,this.camera),this.animationFrame=requestAnimationFrame(this.animate)};updateInput(e){if(this.player.userData.isWalking=!1,this.mode!==`explore`){this.assets.setCharacterMotion(this.player,0);return}let t=this.input.consumeLookDelta(),n=this.input.getMovement();if(this.cameraMode===`overview`){this.freeCamera=Ap(this.freeCamera,{panRight:n.x*n.magnitude,panForward:n.y*n.magnitude,lookDeltaX:t.x,lookDeltaY:t.y,zoomDelta:this.input.consumeZoomDelta()},e),this.assets.setCharacterMotion(this.player,0),this.exposeFreeCameraState();return}if(this.cameraYaw-=t.x*.004,this.cameraPitch=Dt.clamp(this.cameraPitch+t.y*.003,.2,.78),n.magnitude<=0){this.assets.setCharacterMotion(this.player,0);return}let r=mf(n.x,n.y,this.cameraYaw);this.moveDirection.set(r.x,0,r.z);let i=(this.input.isSprinting()?6.1:3.9)*n.magnitude,a=this.parkGrid.getBounds(),o=Dt.clamp(this.playerPosition.x+this.moveDirection.x*i*e,a.minX+.35,a.maxX-.35),s=Dt.clamp(this.playerPosition.z+this.moveDirection.z*i*e,a.minZ+.35,a.maxZ-.35);if(!this.isPointInsideFacility(o,s)){this.playerPosition.x=o,this.playerPosition.z=s,this.player.position.copy(this.playerPosition),this.root.dataset.playerX=this.playerPosition.x.toFixed(3),this.root.dataset.playerZ=this.playerPosition.z.toFixed(3);let t=Math.atan2(this.moveDirection.x,this.moveDirection.z);this.player.rotation.y=Dt.lerp(this.player.rotation.y,t,1-Math.exp(-e*12)),this.player.userData.isWalking=!0,this.assets.setCharacterMotion(this.player,n.magnitude*(this.input.isSprinting()?1.35:1))}}isPointInsideFacility(e,t){let n=.35;return this.placedObjects.some(r=>{let i=Math.round(r.rotation/(Math.PI/2))%2!=0,a=i?r.spec.footprint[1]:r.spec.footprint[0],o=i?r.spec.footprint[0]:r.spec.footprint[1];return Math.abs(e-r.position.x)<a/2+n&&Math.abs(t-r.position.z)<o/2+n})}updateCamera(e){let t=this.mode===`explore`&&this.cameraMode===`follow`;if(t){this.cameraDistance=Dt.lerp(this.cameraDistance,8.2,1-Math.exp(-e*3)),this.cameraTargetDesired.set(this.playerPosition.x,1.3,this.playerPosition.z);let t=Math.cos(this.cameraPitch)*this.cameraDistance;this.cameraDesired.set(this.cameraTargetDesired.x+Math.sin(this.cameraYaw)*t,this.cameraTargetDesired.y+Math.sin(this.cameraPitch)*this.cameraDistance,this.cameraTargetDesired.z+Math.cos(this.cameraYaw)*t),this.fog.density=Dt.lerp(this.fog.density,.013,1-Math.exp(-e*2.5))}else if(this.mode===`explore`&&this.cameraMode===`overview`){let t=jp(this.freeCamera,4.5);this.cameraTargetDesired.set(t.target.x,t.target.y,t.target.z),this.cameraDesired.set(t.position.x,t.position.y,t.position.z);let n=Math.min(.0105,.68/this.freeCamera.distance);this.fog.density=Dt.lerp(this.fog.density,n,1-Math.exp(-e*2.5))}else{let t=bp(this.parkGrid.getParcelSnapshots(),this.camera.aspect);this.cameraTargetDesired.set(t.target.x,t.target.y,t.target.z),this.cameraDesired.set(t.position.x,t.position.y,t.position.z);let n=Math.min(.0105,.68/t.distance);this.fog.density=Dt.lerp(this.fog.density,n,1-Math.exp(-e*2.5))}this.cameraTarget.lerp(this.cameraTargetDesired,1-Math.exp(-e*(t?9:3.5))),this.camera.position.lerp(this.cameraDesired,1-Math.exp(-e*7)),this.camera.lookAt(this.cameraTarget)}resetFreeCamera(){let e=bp(this.parkGrid.getParcelSnapshots(),this.camera.aspect);this.freeCamera=kp({focusX:e.target.x,focusZ:e.target.z,yaw:e.azimuth,pitch:e.elevation,distance:e.distance}),this.exposeFreeCameraState()}exposeFreeCameraState(){this.root.dataset.cameraFocusX=this.freeCamera.focusX.toFixed(3),this.root.dataset.cameraFocusZ=this.freeCamera.focusZ.toFixed(3),this.root.dataset.cameraYaw=this.freeCamera.yaw.toFixed(4),this.root.dataset.cameraPitch=this.freeCamera.pitch.toFixed(4),this.root.dataset.cameraDistance=this.freeCamera.distance.toFixed(3)}exposePlacementPointerState(){this.root.dataset.placementPointer=this.placementPointer.phase,this.root.dataset.placementX=this.placement.position.x.toFixed(3),this.root.dataset.placementZ=this.placement.position.z.toFixed(3)}nearestVisible(e,t){if(e.length<=t)return e;let n=this.cameraTarget;return[...e].sort((e,t)=>(e.position.x-n.x)**2+(e.position.z-n.z)**2-((t.position.x-n.x)**2+(t.position.z-n.z)**2)).slice(0,t)}syncGuestVisuals(e,t){let n=this.nearestVisible(e,this.guestRenderBudget),r=new Set(n.map(e=>e.id));for(let[e,t]of this.guestVisuals)r.has(e)||(this.dynamicLayer.remove(t.object),this.guestVisuals.delete(e));for(let e of n){let n=this.guestVisuals.get(e.id);if(!n){let t=this.assets.createGuest(e.paletteIndex);t.scale.setScalar(e.ageScale),this.dynamicLayer.add(t),n={object:t,previousPosition:new H(e.position.x,0,e.position.z)},this.guestVisuals.set(e.id,n)}let r=new H(e.position.x,0,e.position.z);n.object.position.lerp(r,1-Math.exp(-t*11)),n.object.rotation.y=e.heading;let i=r.distanceToSquared(n.previousPosition)>2e-5;n.object.userData.isWalking=i,n.object.userData.carryingTrash=e.carryingTrash,this.assets.setCharacterMotion(n.object,i?.88:0,e.carryingTrash),n.previousPosition.copy(r),n.object.visible=e.state!==`using`}}syncStaffVisuals(e,t){let n=this.nearestVisible(e,this.staffRenderBudget),r=new Set(n.map(e=>e.id));for(let[e,t]of this.staffVisuals)r.has(e)||(this.dynamicLayer.remove(t.object),this.staffVisuals.delete(e));for(let e of n){let n=this.staffVisuals.get(e.id);if(!n){let t=this.assets.createJanitor(e.paletteIndex);this.dynamicLayer.add(t),n={object:t,previousPosition:new H(e.position.x,0,e.position.z)},this.staffVisuals.set(e.id,n)}let r=new H(e.position.x,0,e.position.z);n.object.position.lerp(r,1-Math.exp(-t*11)),n.object.rotation.y=e.heading;let i=e.state!==`collecting`&&r.distanceToSquared(n.previousPosition)>2e-5;n.object.userData.isWalking=i,this.assets.setCharacterMotion(n.object,i?.95:0),n.previousPosition.copy(r)}}syncLitterVisuals(e){let t=new Set(e.map(e=>e.id));for(let[e,n]of this.litterVisuals)t.has(e)||(this.dynamicLayer.remove(n),this.litterVisuals.delete(e));for(let t of e){if(this.litterVisuals.has(t.id))continue;let e=this.assets.createLitter(t.variant);e.position.set(t.position.x,.04,t.position.z),e.rotation.y=t.variant*1.71,this.dynamicLayer.add(e),this.litterVisuals.set(t.id,e)}}applySkyCycle(e,t=!1){if(!t&&Math.abs(e-this.lastSkyMinute)<.25)return;this.lastSkyMinute=e;let n=mp(e);this.sun.position.set(...n.sunPosition),this.sun.color.setHex(n.sunColor),this.sun.intensity=n.sunIntensity,this.ambient.color.setHex(n.ambientColor),this.ambient.intensity=n.ambientIntensity,this.skyColor.setHex(n.skyColor),this.scene.background instanceof G&&this.scene.background.copy(this.skyColor),this.fog.color.setHex(n.fogColor),this.materials.setLampGlow(n.lampGlow)}animateWorld(e,t){let n=this.started&&!this.isPaused?1:0;this.assets.animate(this.player,e,t);for(let n of this.guestVisuals.values())this.assets.animate(n.object,e,t);for(let n of this.staffVisuals.values())this.assets.animate(n.object,e,t);for(let r of this.placedObjects){let i=r.spec.serviceNeed===null||r.object.userData.connected!==!1;this.assets.animate(r.object,e,t,i?n:0)}}getSpec(e){return su(e)}requireElement(e){let t=this.root.querySelector(e);if(!t)throw Error(`Missing element ${e}`);return t}},Zp=document.querySelector(`#app`);if(!Zp)throw Error(`Parkworks could not find its application root.`);var Qp=new Xp(Zp);Qp.start(),Qp.initialize();