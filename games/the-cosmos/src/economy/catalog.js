// Prices are whole Mars marks. Currency is integer marks; 4 marks = 1 credit.
export const MARKS_PER_CREDIT = 4;
export const START_MARKS = 2500 * MARKS_PER_CREDIT;
export const SOL_SECONDS = 88775.244;
export const WAGES = { pilot: 140, captain: 180, nav: 110, gunner_dorsal: 90, gunner_ventral: 90, comms: 100 };
export const GOODS = {
  water: { name: 'Water · 1 litre', massKg: 1, buy: 8, sell: 4 },
  food: { name: 'Food pack', massKg: .5, buy: 12, sell: 6 },
  ammo: { name: 'Ammo box', massKg: 2, buy: 40, sell: 20 },
  parts: { name: 'Spare parts kit', massKg: 5, buy: 80, sell: 40 },
  oxygen: { name: 'Suit oxygen cylinder', massKg: 3, buy: 24, sell: 12 },
};
export const TRADERS = {
  'trader-1': { goods: ['food'], greeting: 'You look like someone who skipped breakfast. I can fix that.',
    question: 'What survives a long shift?', answer: 'Sealed rations. Coffee is a morale budget, but food is a fuel budget.', reply: 'Then I had better pack some.' },
  'trader-2': { goods: ['parts', 'ammo'], greeting: 'Got a serial number? Good. Got a broken part? Better.',
    question: 'Do you buy salvage?', answer: 'Working spares and sealed ammunition, yes. I pay half the shelf price. No mystery scrap.', reply: 'Fair. Show me the shelf.' },
  'trader-3': { goods: ['water'], greeting: 'A tight cap is worth more than a pretty bottle out here.',
    question: 'Where does the water come from?', answer: 'Filtered ice melt. Every seal checked twice. Dust only has to win once.', reply: 'I will check my seals too.' },
  'trader-4': { goods: ['oxygen', 'parts'], greeting: 'Before you leave: hose, valve, seam. In that order.',
    question: 'What fails first outside?', answer: 'The part you did not check. Carry oxygen and a spare kit. Come back with both unused.', reply: 'Let me see the field supplies.' },
  'depot-clerk': { goods: Object.keys(GOODS), greeting: 'Supply desk. Raw regolith: 12 marks a tonne. We weigh it here.',
    question: 'How does the weigh-in work?', answer: 'One tonne at a time from your cart or hopper. Pure regolith only. The rest of your load stays with you.', reply: 'All right. Let us trade.' },
};
// Add quests as records; no quest-specific branches in the reducer.
export const QUESTS = [{ id: 'depot-foundation', giver: 'cab-supervisor', title: 'A tonne for the foundation',
  offer: 'The depot needs one tonne of raw regolith. Take it to the amber weigh bay west of the depot. Payment: 400 marks.',
  target: { x: -83, z: 24, radius: 4 }, tonnes: 1, rewardMarks: 400 }];
