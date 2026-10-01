import { GOODS, TRADERS, QUESTS, WAGES } from './catalog.js';
import { inventoryMass, regolithKg } from './economy.js';
export { WAGES };
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function workerHTML(m,view,e) {
  const t=TRADERS[m.id],jobs=QUESTS.filter(q=>q.giver===m.id),q=jobs[0];
  let h=`<p>${esc(t?.greeting||m.line)}</p><div class="col">`;
  if(view==='answer') {
    h+=`<div class="say">${esc(t?.answer || (q?q.offer:'We keep the port running a watch at a time. The supervisor upstairs has the paid jobs.'))}</div>`;
    h+=`<button class="cbtn" data-a="worker-reply">${esc(t?.reply||'Understood. What can I do here?')}</button>`;
  } else if(view==='trade' && t) {
    h+=`<p class="stat">Purse ${e.marks} marks · supplies ${inventoryMass(e.inventory)} kg<br>Cart / hopper: ${(regolithKg(e.cargo)/1000).toFixed(3)} t raw regolith</p>`;
    for(const id of t.goods) {
      const g=GOODS[id],stock=e.traders[m.id][id],have=e.inventory[id];
      h+=`<p>${esc(g.name)} · ${g.massKg} kg · stock ${stock} · you have ${have}</p><div class="row2">`;
      h+=`<button class="cbtn" data-a="purchase" data-good="${id}" ${stock<1||e.marks<g.buy?'disabled':''}>Buy · ${g.buy} marks</button>`;
      h+=`<button class="cbtn" data-a="sale" data-good="${id}" ${have<1?'disabled':''}>Sell · ${g.sell} marks</button></div>`;
    }
    if(m.id==='depot-clerk')h+=`<button class="cbtn" data-a="regolith-sale" ${regolithKg(e.cargo)<1000?'disabled':''}>Sell 1 tonne raw regolith · 12 marks</button>`;
    h+=`<button class="cbtn" data-a="worker-back">Back to conversation</button>`;
  } else {
    h+=`<button class="cbtn" data-a="worker-question">${esc(t?.question || (q?'Is there paid work for a hauler?':'What is your watch like?'))}</button>`;
    if(t)h+=`<button class="cbtn" data-a="worker-trade">Show me what you buy and sell</button>`;
    for(const job of jobs) {
      const status=e.quests[job.id]?.status;
      h+=`<p>${esc(job.offer)}</p>`;
      h+=status?`<p class="stat">${status==='complete'?'Delivery complete. Payment received.':'Accepted. Look for the amber weigh bay west of the depot.'}</p>`:
        `<button class="cbtn" data-a="quest-accept" data-quest="${job.id}">Accept · ${esc(job.title)}</button>`;
    }
  }
  return h+`<button class="cbtn" data-a="close">Goodbye</button></div>`;
}
