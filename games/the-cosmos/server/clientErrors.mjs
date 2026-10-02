import { appendFile, mkdir, stat, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';

export function graphicsDiagnostic(message) {
  const clean=(v,n)=>String(v||'Unknown').replace(/[\r\n\x00-\x1f]/g,' ').replace(/https?:\/\/\S+/g,'[URL]').slice(0,n);
  return {at:new Date().toISOString(),reason:clean(message.reason,900),gpu:clean(message.gpu,200),browser:['Chrome','Firefox','Edge','Safari'].includes(message.browser)?message.browser:'Unknown',tier:['low','high','safe'].includes(message.tier)?message.tier:'Unknown'};
}
export async function logClientError(file, message) {
  await mkdir(dirname(file),{recursive:true});
  if((await stat(file).catch(()=>null))?.size>1024*1024){await rm(file+'.1',{force:true});await rename(file,file+'.1');}
  await appendFile(file,JSON.stringify(graphicsDiagnostic(message))+'\n','utf8');
}
