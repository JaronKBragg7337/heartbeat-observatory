const key='cosmos-opening-solo-v1';
export function readOpeningCheckpoint(storage=localStorage) {
  try{const s=JSON.parse(storage.getItem(key));
    if(s?.version===1&&Number.isInteger(s.stage)&&s.stage>=0&&s.stage<=5&&
      ['x','y','z','yaw','pitch'].every(k=>Number.isFinite(s.pose?.[k]))&&Array.isArray(s.cuts))return s;
  }catch{}return null;
}
export function writeOpeningCheckpoint(world,state,storage=localStorage) {
  // Remote steps are durable commands, replayed with their original action ids.
  // Never copy a private solo save into the shared authority.
  if(world.remote)return;
  try{storage.setItem(key,JSON.stringify(state));}catch{}
}
