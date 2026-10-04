// ============================================================================
// worlds/moon/cast.js - the people of the Moon's three settlements, where they stand and what they say. Pure data (the server reads positions and what
// each one trades; the browser draws and speaks them). Outpost-local metres (place.js): x east, z south, origin at the middle of each landing's main pad.
//
// TWO KINDS OF PERSON
//   seat    holds one of F5's seats (src/roles/seats.js): name, temperament, voice and lines come from the seat's NPC (src/roles/npcs.js), so they
//           are the same person on the roles sheet, speak in the voice already rendered for them, and a player who takes the post steps them aside
//           (the body stays: the server keeps only the humans). Some are assholes: that is F5's design.
//   custom  one of ours: name, line, question, answer, a reply for the button, and a line for the trade panel. Every spoken line gets a voice
//           (tools/gen-voices.mjs reads `moonLines()` below).
// Fields: id, name, title, faction (F0 style: the uniform), role (a uniform role in that style), body (a Loft person), voice (cast.js VOICES), x, z, face,
//   helmet (a duty helmet: they are outdoors), trade ('ice' | 'shop:<id>' | null), join (a faction a Talk button signs you up to), far (not in the compound).
// ============================================================================

import DLG from './dialogue.js';

/** The settlements' vendor ids and what each is called on the panel. */
export const VENDORS = {
  'hub-mercantile': { name: 'Tranquility Mercantile', where: 'moon' },
  'hub-water': { name: 'Hub Water Office', where: 'moon' },
  'fortis-quartermaster': { name: 'Fortis Quartermaster', where: 'moon-shackleton' },
  'fortis-ice-dock': { name: 'Shackleton Ice Dock', where: 'moon-shackleton' },
  'technos-fab': { name: 'Fab Floor 2', where: 'moon-daedalus' },
  'technos-supply': { name: 'Daedalus Supply Desk', where: 'moon-daedalus' },
};

const HUB = [
  { id: 'h-port-master', seat: 'moon/port-master', title: 'Port master', faction: 'mars', role: 'officer', x: -20, z: -84, face: 'south' },
  { id: 'h-governor', seat: 'moon/governor', title: 'Governor of the Moon', faction: 'mars', role: 'leader', x: 0, z: -84, face: 'south' },
  { id: 'h-guide', name: 'Odalys Moreno', title: 'Arrivals guide', faction: 'mars', role: 'worker', body: 'sunita', voice: 'w-bella', x: -7, z: -60, face: 'south', helmet: true,
    line: 'Welcome to Tranquility Civil Hub, the only place on the Moon where nobody is shooting at anybody. Please enjoy the weather. There is none.',
    question: 'Where is everything?',
    answer: 'The terminal is behind me. Fortis recruits at the red booth, Technos Prime at the white one, and the first footprints are a kilometre south west. Please do not touch the footprints. They are older than your country.',
    reply: 'Footprints. Do not touch.' },
  { id: 'h-recruit-fortis', name: 'Sergeant Kade Holloway', title: 'Fortis recruiter', faction: 'fortis', role: 'guard', body: 'jorge', voice: 'w-fenrir', x: 24, z: -46, face: 'west', helmet: true, join: 'fortis',
    line: 'Sergeant Holloway, Fortis. You look like someone who has never been shouted at on purpose. We fix that for free.',
    question: 'What does Fortis offer?',
    answer: 'Walls, power and a schedule. We kept this Moon alive when the storms cut it off. Sign up and you get a bunk, a badge and a number. Remember the number.',
    reply: 'I will remember the number.',
    tradeLine: 'Say the word and your name goes on the list. Nobody has ever gotten off the list. Nobody has tried.' },
  { id: 'h-recruit-technos', name: 'Doctor Imogen Pryce', title: 'Technos Prime recruiter', faction: 'technos', role: 'officer', body: 'ada', voice: 'w-aoede', x: -46, z: -46, face: 'east', helmet: true, join: 'technos',
    line: 'Imogen Pryce, Technos Prime. Have you considered not being shouted at? We have a brochure. It is a very polite brochure.',
    question: 'What does Technos Prime offer?',
    answer: 'Signal over noise. Chips, comms, and a quiet room on the far side with the best view of nothing. Fortis will say we are soft. We are soft. We are also on the other end of every call they make.',
    reply: 'Soft, but listening. Noted.',
    tradeLine: 'One click and you are one of us. We will know. We always know. It is very nice.' },
  { id: 'h-shop', name: 'Dov Abara', title: 'Tranquility Mercantile', faction: 'mars', role: 'trader', body: 'aoi', voice: 'w-adam', x: -68, z: 5, face: 'east', trade: 'shop:hub-mercantile',
    line: 'Tranquility Mercantile. Everything here is priced for people who arrived out of options. Welcome.',
    question: 'Why is everything so expensive?',
    answer: 'It all came up a gravity well and across a lane. Water is the worst: it is ice at the pole, and the pole belongs to men with guns. I only sell the stuff. I do not set the sky.',
    reply: 'Fair enough. Show me the shelf.',
    tradeLine: 'Prices are on the board. I do not haggle. I did once. Never again.' },
  { id: 'h-water', name: 'Marit Lindqvist', title: 'Water office', faction: 'mars', role: 'trader', body: 'zuri', voice: 'w-lily', x: 47, z: -14, face: 'west', trade: 'ice-hub',
    line: 'Hub water office. Bring me ice and I will pay you more than the pole does. Do not ask me why. I do not know why. I think it is the carry.',
    question: 'Why does water cost so much up here?',
    answer: 'Everything wet on the Moon is at the bottom of a hole at the south pole, and the people who own the hole set the price. We pay haulers more than the shaft does, because haulers have other choices. Barely.',
    reply: 'Then I will bring you ice.',
    tradeLine: 'Whole tonnes only. I weigh it myself and I have never been wrong. Ask anyone who has tried to argue.' },
  { id: 'h-medic', seat: 'moon/medic-1', title: 'Medic', faction: 'mars', role: 'worker', x: -66, z: -41, face: 'east' },
  { id: 'h-gas', seat: 'moon/gas-worker-1', title: 'Gas station worker', faction: 'mars', role: 'worker', x: 40, z: 36, face: 'north', helmet: true },
  { id: 'h-pilot', seat: 'moon/pilot-1', title: 'Pilot', faction: 'mars', role: 'pilot', x: -36, z: 18, face: 'east', helmet: true },
  { id: 'h-tourist', name: 'Wendell Tull', title: 'Tourist', faction: 'mars', role: 'civilian', body: 'walter', voice: 'w-fable', x: 11, z: -37, face: 'south', helmet: true,
    line: 'Is this the gift shop? They told me there would be a gift shop. I paid for the gift shop.',
    question: 'Where did you come from?',
    answer: 'Earth. I booked a cruise to see the Moon. It turned out the cruise was a seat on a cargo hauler, and the Moon is, I have to say, quite grey.',
    reply: 'It is rather grey.' },
  { id: 'h-rover', name: 'Clerk Idris Quill', title: 'Rover hire', faction: 'mars', role: 'worker', body: 'jorge', voice: 'w-liam', x: 60, z: 34, face: 'south', helmet: true,
    line: 'Rover hire. Pressurised, heated, and very slightly haunted. The haunting is free. The heating is extra.',
    question: 'Can I hire a rover?',
    answer: 'You can look at one. All of them are out on contract, or in the shop, or in a ditch. We do not talk about the ditch. Come back on a Tuesday. We do not have Tuesdays on the Moon, but come back anyway.',
    reply: 'I will come back on a Tuesday.' },
  { id: 'h-dust', name: 'Dust Marshal Perpetua Cobb', title: 'Dust marshal', faction: 'mars', role: 'worker', body: 'ada', voice: 'w-sky', x: -22, z: -26, face: 'east', helmet: true,
    line: 'Dust marshal. My job is to move the dust from one place to another. The Moon has a lot of it. Nobody has ever told me to stop.',
    question: 'Is the dust really that bad?',
    answer: 'It is sharp, it is charged, and it clings to everything. It smells like spent gunpowder when you bring it indoors. The Apollo crews said so. I say it with a mop, every day, to nobody. Wipe your boots.',
    reply: 'I will wipe my boots.' },
  { id: 'h-ranger', name: 'Ranger Pascal Tolliver', title: 'Heritage ranger', faction: 'mars', role: 'guard', body: 'isaiah', voice: 'w-lewis', x: -806, z: 770, face: 'east', helmet: true, far: true,
    line: 'Heritage Ranger Tolliver. The Eagle is a protected site. Do not touch it, do not lean on it, and please keep your selfies at a respectful distance.',
    question: 'What happened here?',
    answer: 'July the twentieth, nineteen sixty nine. Two men walked on this dust and one waited upstairs. They left a flag, a plaque and a great many footprints. There is no wind. The prints will outlast us all, so mind your boots.',
    reply: 'I will mind my boots.' },
];

const SHACK = [
  { id: 's-gate', name: 'Sergeant Ilse Brandt', title: 'Gate sergeant', faction: 'fortis', role: 'guard', body: 'ada', voice: 'w-river', x: 108, z: 30, face: 'east', helmet: true,
    line: 'State your business. Badges visible. If you have no badge, state that loudly, and we will find you one.',
    question: 'What is the number of this gate?',
    answer: 'Seven. Gate seven. Remember seven. If you cannot remember seven, write it on your arm. Many do. I have a pen.',
    reply: 'Seven. Got it.' },
  { id: 's-leader', seat: 'fortis/leader', title: 'Fortis leader', faction: 'fortis', role: 'leader', x: 62, z: -24, face: 'south', helmet: true },
  { id: 's-security', seat: 'moon/security-chief', title: 'Security chief', faction: 'fortis', role: 'officer', x: 96, z: 44, face: 'west', helmet: true },
  { id: 's-patrol', seat: 'moon/patrol-1', title: 'Patrol', faction: 'fortis', role: 'guard', x: 96, z: 18, face: 'west', helmet: true },
  { id: 's-quarter', name: 'Quartermaster Bram Ostrander', title: 'Quartermaster', faction: 'fortis', role: 'trader', body: 'jorge', voice: 'w-echo', x: -84, z: -16, face: 'east', trade: 'shop:fortis-quartermaster',
    line: 'Quartermaster. Form seven for ammunition, form eight for oxygen, form nine for filling in the wrong form. I am kidding. I am not allowed to kid.',
    question: 'Why is ammunition cheap here?',
    answer: 'Because Fortis makes it, and we would rather you have it than the other lot. Oxygen is cheap too. The air is the one thing we never ration. The orders are ration everything but the air.',
    reply: 'Show me what you stock.',
    tradeLine: 'Everything on the list is numbered. Please do not ask about the item with no number.' },
  { id: 's-ice', name: 'Dock Master Teodora Quill', title: 'Ice dock', faction: 'fortis', role: 'worker', body: 'sunita', voice: 'w-alice', x: -76, z: 46, face: 'east', helmet: true, trade: 'ice-dock',
    line: 'Ice dock. You dig it in the dark, carry it up in the light, I weigh it, and I pay in lunars and bad news.',
    question: 'Where does the ice come from?',
    answer: 'From the bottom of the crater, where the Sun has not touched the ground for a couple of billion years. It is cold enough to crack a glove. Dig where the dust goes pale. The dust is lying about being dust.',
    reply: 'Dig where the dust goes pale.',
    tradeLine: 'Whole tonnes only. Hauling it to the hub pays a little more, if you can stand the hop. I cannot tell you that. I did not tell you that.' },
  { id: 's-driver', name: 'Technician Lazlo Greaves', title: 'Mass driver', faction: 'fortis', role: 'worker', body: 'isaiah', voice: 'w-puck', x: -10, z: -64, face: 'south', helmet: true,
    line: 'Mass driver control. We throw things at space with magnets. It is the best job on the Moon, and so loud that nobody ever hears us say so.',
    question: 'How does the mass driver work?',
    answer: 'A long rail, a lot of electricity from the rim, and a bucket of cargo. The rail speeds it past two kilometres a second and lets go. No fuel, no flames, no mercy for anyone standing in the road.',
    reply: 'I will stay out of the road.' },
  { id: 's-armourer', name: 'Armourer Cormac Dunmore', title: 'Armoury', faction: 'fortis', role: 'worker', body: 'aoi', voice: 'w-liam', x: 55, z: -62, face: 'south', helmet: true,
    line: 'Armoury. Every item in there has a number. So do the numbers. If you find something unnumbered, report it, and then leave it very gently alone.',
    question: 'Is everything really numbered?',
    answer: 'Yes. Sector four, building seventeen, door two. The mess hall is sector nine. Sector nine is not a sector. We asked. We were told to stop asking.',
    reply: 'Sector nine. Understood. Sort of.' },
  { id: 's-cook', name: 'Mess Sergeant Gideon Haldane', title: 'Mess hall', faction: 'fortis', role: 'worker', body: 'jorge', voice: 'w-adam', x: -40, z: -64, face: 'south', helmet: true,
    line: 'Mess hall. We serve three meals a day in sector nine. Sector nine is not a sector. The meals are real. Do not ask about the gravy.',
    question: 'What is on the menu?',
    answer: 'Beige. Beige with a side of beige. We make it from dried everything and a lot of discipline. The coffee is the one item with a number I will not tell you. It is not a good number.',
    reply: 'I will not ask about the gravy.' },
  { id: 's-recruit', name: 'Private Tobias Pell', title: 'New recruit', faction: 'fortis', role: 'guard', body: 'aoi', voice: 'aoi', x: 100, z: 56, face: 'west', helmet: true,
    line: 'Oh! Hello. Badge visible. I mean, your badge. Mine is visible. Is yours visible? Please tell me what to do.',
    question: 'How long have you been here?',
    answer: 'Nine days. I have been shouted at forty one times, and I have counted. They say it gets easier. Mostly they say it while shouting. I think I am doing fine. Am I doing fine?',
    reply: 'You are doing fine.' },
  { id: 's-command', name: 'Commander Reyes Salt', title: 'Fleet command', faction: 'fortis', role: 'officer', body: 'zuri', voice: 'w-jessica', x: 78, z: -22, face: 'south', helmet: true,
    line: 'Fleet command. We have eleven gunships and one pilot who can park. We are working on the ratio.',
    question: 'Why does Fortis keep a fleet at the pole?',
    answer: 'Because the pole has the ice, the power and the mass driver. Whoever holds the pole holds the Moon. We hold the pole. We also hold, if you will forgive the word, a grudge.',
    reply: 'Understood. Hold the pole.' },
];

const DAED = [
  { id: 'd-door', name: 'Embassy Host Anselm Ferreira', title: 'Embassy greeter', faction: 'technos', role: 'guard', body: 'aoi', voice: 'w-lewis', x: -30, z: -50, face: 'south', helmet: true,
    line: 'Welcome to Daedalus. Please do not feel observed. It is a feature. You can switch it off at the front desk. The front desk is also observed.',
    question: 'Why is the far side so quiet?',
    answer: 'The whole Moon sits between us and Earth, and blocks every radio there is. No static from home, no nonsense from home. Just the sky, very faint, and the dishes listening to it. It is the quietest place anyone has ever built.',
    reply: 'The quietest place anyone has built.' },
  { id: 'd-leader', seat: 'technos/leader', title: 'Technos Prime leader', faction: 'technos', role: 'leader', x: 10, z: -84, face: 'south', helmet: true },
  { id: 'd-trade', seat: 'moon/trade-director', title: 'Trade director', faction: 'technos', role: 'officer', x: 32, z: -80, face: 'south', helmet: true },
  { id: 'd-trader', seat: 'moon/trader-1', title: 'Trader', faction: 'technos', role: 'trader', x: -22, z: 38, face: 'east', helmet: true },
  { id: 'd-dish', name: 'Dish Engineer Yara Nakamura-Reed', title: 'Dish engineer', faction: 'technos', role: 'worker', body: 'ada', voice: 'w-heart', x: 128, z: -14, face: 'west', helmet: true,
    line: 'Dish engineer. Listening to the universe is mostly waiting. It is also, to be honest, mostly Fortis, on a bad day, shouting about numbers.',
    question: 'What do the dishes hear?',
    answer: 'Hydrogen, mostly. Pulsars ticking. A few things we are not allowed to describe. And every night, somewhere in all that, a very faint hum nobody can explain. I would tell you what it is, but I would have to say I do not know.',
    reply: 'A hum nobody can explain. Good.' },
  { id: 'd-fab', name: 'Fab Engineer Hollis Petrov', title: 'Fab Floor 2', faction: 'technos', role: 'worker', body: 'isaiah', voice: 'w-echo', x: -50, z: 66, face: 'south', helmet: true, trade: 'shop:technos-fab',
    line: 'Fab Floor 2. We print chips and parts. The parts are cheap. The chips are free, if you can explain what they do.',
    question: 'What does Technos make?',
    answer: 'Everything with a wire in it. Navigation computers, long range comms, ship electronics. Fortis needs all of it and will not say please. We send them an invoice. Then another one.',
    reply: 'Show me the parts.',
    tradeLine: 'Spares are cheaper here than anywhere on the Moon, because we make them ourselves. Please do not ask what is in the sealed box.' },
  { id: 'd-spoof', name: 'Clerk Delphine Mbeki', title: 'Identity Services (Calibration)', faction: 'technos', role: 'trader', body: 'sunita', voice: 'w-sky', x: -128, z: -12, face: 'east', helmet: true,
    line: 'Identity Services, Calibration. Everything here is legal. Nothing here is for sale. Please pay at the back.',
    question: 'What is calibrated, exactly?',
    answer: 'Your transponder, your lanyard, your face, and occasionally your story. We do not spoof. We simulate. There is a difference, and the difference is the fee.',
    reply: 'I will pay at the back.' },
  { id: 'd-supply', name: 'Supply Clerk Oksana Stroud', title: 'Supply desk', faction: 'technos', role: 'trader', body: 'zuri', voice: 'w-jessica', x: 44, z: 41, face: 'west', helmet: true, trade: 'shop:technos-supply',
    line: 'Supply desk. We make chips, not groceries. Water, food and oxygen are dear here, and I pay well for what comes in.',
    question: 'What do you need most?',
    answer: 'Power we have. Chips we have. What we do not have is anything wet, or anything you can eat. Bring me water and I will take you out for the dinner we cannot afford.',
    reply: 'Water. Understood.',
    tradeLine: 'I pay in lunars, on the spot, with a smile I practised in a mirror.' },
  { id: 'd-attache', name: 'Attache of Everyone, Anselm Dunmore', title: 'Attache of everyone', faction: 'technos', role: 'officer', body: 'walter', voice: 'w-fable', x: -104, z: -30, face: 'south', helmet: true,
    line: 'I am the attache of everyone. It saves time. Nobody has ever checked, and the one person who tried is now very happy in a quiet room.',
    question: 'Who do you actually represent?',
    answer: 'Whoever stands in front of me. Today it is you. Congratulations: your embassy has one member, me, and one flag, which I am wearing. We will draft the treaty after lunch. It will be extremely polite.',
    reply: 'A treaty. After lunch.' },
  { id: 'd-janitor', name: 'Custodian Marit Okafor', title: 'Custodian', faction: 'technos', role: 'worker', body: 'sunita', voice: 'w-aoede', x: -50, z: -80, face: 'south', helmet: true,
    line: 'Custodian. I am cleaning a floor that is already clean. It is the one thing in Daedalus that is not being measured.',
    question: 'Is the whole city this tidy?',
    answer: 'A fine is automatic. Drop a crumb and a drone arrives, apologises, and bills you. I have never seen a crumb. I have seen the drones. They are very polite and they are everywhere.',
    reply: 'I will not drop a crumb.' },
  { id: 'd-quiet', name: 'Attendant Wren Marchetti', title: 'Quiet room', faction: 'technos', role: 'civilian', body: 'sunita', voice: 'w-heart', x: 62, z: -52, face: 'west', helmet: true,
    line: 'Please lower your voice. You are being very loud, for a person.',
    question: 'What is the quiet room?',
    answer: 'A pod with no signal in it at all. Not a whisper. People pay to sit in it for an hour. Most of them cry a little, and then ask for another hour. I do not charge for the crying.',
    reply: 'I will whisper.' },
];

export const CAST = { moon: HUB, 'moon-shackleton': SHACK, 'moon-daedalus': DAED };
export const castOf = (worldId) => CAST[worldId] || [];

/** Every static line a custom person says, with the voice that says it (for tools/gen-voices.mjs; seat people use F5's lines, already voiced). */
export function moonLines() {
  const out = [];
  for (const list of Object.values(CAST)) for (const p of list) {
    if (p.seat) continue;
    for (const key of ['line', 'answer', 'tradeLine']) if (p[key]) out.push({ voice: p.voice, text: p[key] });
  }
  // the new opening's words for the Moon (dialogue.js): voiced here too, so the opening's own list finds its clips already made
  out.push({ voice: 'ship', text: DLG.surface }, { voice: 'ship', text: DLG.crate }, { voice: 'w-bella', text: DLG.gate });
  for (const d of Object.values(DLG.drivers)) for (const k of ['greeting', 'pitch1', 'pitch2', 'offer', 'closing']) out.push({ voice: d.voice, text: d[k] });
  for (const c of Object.values(DLG.counter)) out.push({ voice: c.voice, text: c.line });
  return out;
}
