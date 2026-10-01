import { START_MARKS, WAGES, GOODS, TRADERS, QUESTS, MARKS_PER_CREDIT, SOL_SECONDS } from './catalog.js';
const clone = v => structuredClone(v);
const SCALE = 2 ** 96;
const account = v => BigInt(v * SCALE);
export const sumExact = (lots, key) => lots.reduce((s, l) => s + account(l[key]), 0n);
export function initialEconomy() {
  return { marks: START_MARKS, marketMarks: 1000000, payrollMarks: 0, questFundMarks: 100000,
    inventory: Object.fromEntries(Object.keys(GOODS).map(k => [k, 0])),
    traders: Object.fromEntries(Object.entries(TRADERS).map(([id,t]) => [id, Object.fromEntries(t.goods.map(k => [k, 30]))])),
    crew: {}, quests: {}, elapsedSeconds: 0, cargo: [], depotLots: [], questLots: [],
    exportedMassExact: '0', exportedVolumeExact: '0' };
}
export const inventoryMass = inv => Object.entries(inv).reduce((s,[k,n]) => s + GOODS[k].massKg * n, 0);
export const pureRegolith = l => l.materialId === 'MAT-REGOLITH' && l.parts?.every(p => p.materialId === 'MAT-REGOLITH');
export const regolithKg = lots => lots.filter(pureRegolith).reduce((s,l) => s+l.massKg,0);

// Split only the accepted mass, retaining all composition/volume and untouched lots.
export function takeRegolith(lots, tonnes) {
  if (!Number.isSafeInteger(tonnes) || tonnes < 1 || regolithKg(lots) < tonnes * 1000) throw Error('Need a full tonne of raw regolith in your cart or hopper.');
  const remaining = clone(lots), delivered = []; let need = tonnes * 1000;
  for (let i = 0; i < remaining.length && need > 0; i++) {
    const l = remaining[i]; if (!pureRegolith(l)) continue;
    if (l.massKg <= need) { need -= l.massKg; delivered.push(l); remaining.splice(i--,1); continue; }
    const mass = need, ratio = mass/l.massKg;
    const part = clone(l); part.massKg = mass;
    for (const k of ['solidVolumeM3','looseVolumeM3']) { part[k] = l[k]*ratio; l[k] -= part[k]; }
    part.parts = l.parts.map(p => ({...p, massKg:p.massKg*ratio, volumeM3:p.volumeM3*ratio}));
    l.parts = l.parts.map((p,j) => ({...p,massKg:p.massKg-part.parts[j].massKg,volumeM3:p.volumeM3-part.parts[j].volumeM3}));
    l.massKg -= mass; part.lotId += ':weighed'; delivered.push(part); need = 0;
  }
  return { remaining, delivered,
    massExact: sumExact(lots,'massKg') - sumExact(remaining,'massKg'),
    volumeExact: sumExact(lots,'solidVolumeM3') - sumExact(remaining,'solidVolumeM3') };
}
function exportLoad(s, tonnes, destination) {
  const t = takeRegolith(s.cargo,tonnes); s.cargo = t.remaining; s[destination].push(...t.delivered);
  s.exportedMassExact = String(BigInt(s.exportedMassExact)+t.massExact);
  s.exportedVolumeExact = String(BigInt(s.exportedVolumeExact)+t.volumeExact);
}
// Single authority for transactions. Rejections leave the input byte-for-byte unchanged.
export function reduceEconomy(state, a) {
  const s = clone(state);
  switch (a.type) {
    case 'space-award': {
      const marks=a.credits*MARKS_PER_CREDIT;
      if(!Number.isSafeInteger(marks)||marks<0)throw Error('Invalid space reward.');
      s.marks+=marks;break;
    }
    case 'space-cargo-add':case 'space-cargo-remove': {
      if(typeof a.item!=='string'||!Number.isFinite(a.kg)||a.kg<0)throw Error('Invalid hold transfer.');
      s.hold=s.hold||{};const old=s.hold[a.item]||0;
      if(a.type==='space-cargo-remove'&&old+1e-5<a.kg)throw Error('Insufficient hold cargo.');
      s.hold[a.item]=a.type==='space-cargo-add'?old+a.kg:Math.max(0,old-a.kg);break;
    }
    case 'hire': {
      if (!(a.id in WAGES) || s.crew[a.id]) throw Error('Not available.');
      const fee = WAGES[a.id]*MARKS_PER_CREDIT;
      if (s.marks < fee) throw Error(`Signing fee is ${fee} marks. You cannot afford it yet.`);
      s.marks -= fee; s.payrollMarks += fee;
      s.crew[a.id] = { nextPay: s.elapsedSeconds+SOL_SECONDS, unpaid: false }; break;
    }
    case 'fire': if (!s.crew[a.id]) throw Error('Not hired.'); delete s.crew[a.id]; break;
    case 'wages': {
      if (!Number.isFinite(a.seconds) || a.seconds<0) throw Error('Invalid sol clock.');
      s.elapsedSeconds += a.seconds;
      for (const [id,c] of Object.entries(s.crew)) {
        if (c.unpaid || s.elapsedSeconds < c.nextPay) continue;
        const count = Math.floor((s.elapsedSeconds-c.nextPay)/SOL_SECONDS)+1, due = count*WAGES[id]*4;
        if (s.marks < due) c.unpaid = true;
        else { s.marks -= due; s.payrollMarks += due; c.nextPay += count*SOL_SECONDS; }
      } break;
    }
    case 'purchase': case 'sale': {
      const t = s.traders[a.trader], g = GOODS[a.good], n = a.quantity ?? 1;
      if (!t || !(a.good in t) || !g || !Number.isSafeInteger(n) || n < 1) throw Error('Invalid trade.');
      const buying = a.type === 'purchase', price = n*(buying?g.buy:g.sell);
      if (buying && (t[a.good]<n || s.marks<price)) throw Error('Not enough stock or marks.');
      if (!buying && (s.inventory[a.good]<n || s.marketMarks<price)) throw Error('Not enough goods or dealer funds.');
      s.marks += buying?-price:price; s.marketMarks += buying?price:-price;
      s.inventory[a.good] += buying?n:-n; t[a.good] += buying?-n:n; break;
    }
    case 'regolith-sale': {
      const n = a.tonnes ?? 1, price = n*12;
      if (!Number.isSafeInteger(price) || s.marketMarks<price) throw Error('Depot cannot pay.');
      exportLoad(s,n,'depotLots'); s.marks += price; s.marketMarks -= price; break;
    }
    case 'quest-accept': {
      const q = QUESTS.find(q=>q.id===a.id); if (!q || s.quests[a.id]) throw Error('That job is not available.');
      s.quests[a.id] = { status:'active' }; break;
    }
    case 'quest-step': {
      const q = QUESTS.find(q=>q.id===a.id);
      if (!q || s.quests[a.id]?.status !== 'active') throw Error('Accept the job at the tower first.');
      if (!a.position || Math.hypot(a.position.x-q.target.x,a.position.z-q.target.z)>q.target.radius) throw Error('Bring the load to the amber weigh bay.');
      if (s.questFundMarks<q.rewardMarks) throw Error('Job fund is empty.');
      exportLoad(s,q.tonnes,'questLots'); s.marks += q.rewardMarks; s.questFundMarks -= q.rewardMarks;
      s.quests[a.id] = { status:'complete' }; break;
    }
    default: throw Error(`Unknown economy action: ${a.type}`);
  }
  if (!Number.isSafeInteger(s.marks) || s.marks<0) throw Error('Account invariant failed.');
  return s;
}
