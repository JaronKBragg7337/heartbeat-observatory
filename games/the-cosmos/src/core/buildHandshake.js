import { BUILD_VERSION } from './buildVersion.js';
export { BUILD_VERSION };
export function versionMismatch(version) {return typeof version==='string'&&version!==BUILD_VERSION;}
export function reloadStaleBuild(version) {
  if(!versionMismatch(version))return false;
  const key='cosmos-build-reload:'+version;
  try{if(sessionStorage.getItem(key))return false;sessionStorage.setItem(key,'1');}catch{return false;}
  const url=new URL(location.href);url.searchParams.set('build',version);location.replace(url.href);return true;
}
export function watchBuild() {
  const check=async()=>{try{const r=await fetch(new URL('../../build.json',import.meta.url),{cache:'no-store'});
    if(r.ok){const b=await r.json();reloadStaleBuild(b.id);}}catch{}};
  check();const timer=setInterval(check,60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
}
