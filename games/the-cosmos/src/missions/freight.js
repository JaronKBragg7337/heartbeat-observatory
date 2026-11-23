// ============================================================================
// missions/freight.js - THE FREIGHT BOARD: paid work that never runs out (part 3, 11/19). PURE DATA, read by catalog.js (which adds these to MISSIONS, so the
// authority, the Talk panel, the tracker and the validator treat them like every other job).
//
// A freight job has `repeat: true`: finishing it does not close it, the same person offers it again the next time you ask. Everything else is an ordinary job:
// a person offers it, the steps finish by arriving, the authority checks every step, the pay arrives with the last one.
//
// PAY FOLLOWS THE DISTANCE AND THE WORK (credits; one credit is four marks):
//   a walk out of the settlement and back              80
//   ground dug and carted, or ore dug and flown in     90 to 130
//   a hop to a neighbouring pad or a moon and its door 150 to 240
//   a crossing to another world                        400 (Ceres and Mars) to 600 (Callisto and Mars)
// Story jobs still pay more for the same distance the first time: they are how a pilot learns the place. Freight is what is always there afterwards.
//
// THE FREIGHT TICKET (the first rung of the roles ladder): every finished freight run is counted (server: missions[player].freight.runs). The count gives a
// name people can know you by and a bonus on every later freight run. FREIGHT_RANKS below is the whole table; the authority pays by it and the Talk panel shows it.
//
// Mars is neutral: its freight takes no side. Most freight elsewhere is side 'port' too (it moves no balance). Every side of every two-sided world has a run of its own
// (faction + side 'home'): open after that side's oath job, it feeds that side's home a little every time (Ironclad and Greenhaven, Fortis and Technos Prime,
// Skyward and the Homeguard, Mystara and the Unbound).
//
// TALLY RUNS (11/23): every home side has a yard where its ship lands and its stock rises and falls (worlds/_kit/sideYard.js, worlds/ceres/activity.js).
// A tally run sends you there to count what is really standing on the stand and sign the number: one step of kind `count` (worlds/yardBook.js holds the
// place and the truth; the authority checks the number against the same clock the yard is drawn from). They take no side (side 'port'): a neutral pair of
// eyes is the point. They are the cheapest run on each board, so the giver's pitch, which names both of the world's yards, is the first thing a pilot hears.
// ============================================================================
import { TALLIES } from '../worlds/yardBook.js';

/** runs needed, the name, and the bonus on freight pay. */
export const FREIGHT_RANKS = [
  { runs: 0, name: 'New hand', bonus: 0 },
  { runs: 3, name: 'Hauler', bonus: 0.1 },
  { runs: 10, name: 'Senior hauler', bonus: 0.2 },
  { runs: 25, name: 'Freight master', bonus: 0.3 },
];
/** The rank for a number of finished runs: { name, bonus, runs, next: { name, runs } | null }. */
export function freightRank(runs = 0) {
  let i = 0; for (let k = 0; k < FREIGHT_RANKS.length; k++) if (runs >= FREIGHT_RANKS[k].runs) i = k;
  const n = FREIGHT_RANKS[i + 1];
  return { ...FREIGHT_RANKS[i], next: n ? { name: n.name, runs: n.runs } : null };
}
/** What a freight job pays a pilot with this many runs behind them (whole credits). */
export const freightPay = (m, runs = 0) => Math.round(m.pay * (1 + freightRank(runs).bonus));

export const FREIGHT_THREADS = [
  { id: 'mars-freight', world: 'mars', title: 'The freight board', blurb: 'Marineris Port feeds two moons, a well in the desert and anyone who lands. There is always a case waiting.' },
  { id: 'moon-freight', world: 'moon', title: 'The freight board', blurb: 'Three landings on one Moon, and none of them makes everything it needs.' },
  { id: 'ceres-freight', world: 'ceres', title: 'The freight board', blurb: 'The foundry eats ore every shift, and what it pours has to reach Mars.' },
  { id: 'earth-freight', world: 'earth', title: 'The freight board', blurb: 'The sea takes a little of the wall every tide.' },
  { id: 'callisto-freight', world: 'callisto', title: 'The freight board', blurb: 'The Archive runs on clean ice, and its sealed cases go a long way.' },
];

const F = (m) => ({ side: 'port', repeat: true, ...m });
/** The one step of a tally run: stand at a side's stock, count it, set the number and sign it. `beat` is said when the count is taken: {n} is what stands
 *  there, {ship} is a sentence about the side's ship (down on the stand, or how long until she is due). */
const COUNT = (key, text, beat) => { const t = TALLIES[key]; return { k: 'count', tally: key, to: { at: t.at, frame: t.frame, name: t.place }, r: t.r, text, beat }; };
const PHOBOS_LOCK = { at: [35, -3], frame: 'phobos', name: 'the station airlock' };
const DEIMOS_RIG = { at: [33, 12], frame: 'deimos', name: 'the drill rig' };
const WELL = { port: [407, -626], name: 'the ice well' };

export const FREIGHT = [
  // ============================================================================ MARS (the supply clerk, west of the pads)
  F({ id: 'mars-fr-well', thread: 'mars-freight', world: 'mars', giver: 'depot-clerk', title: 'Well samples', pay: 80,
    brief: 'Walk the haul road north to the ice well, collect the day\'s water samples, and bring them back to the supply desk.',
    pitch: 'Water Works 1 pulls a sample every shift and nobody walks it down. It is six hundred metres up the haul road, out of the north-east gate. Follow the road and the pipeline, the tower is the tall thing. Bring the rack back to me.',
    take: 'North-east gate, then the road. The samples are in the grey rack at the foot of the tower.',
    steps: [
      { k: 'go', to: WELL, r: 14, carry: 'a rack of water samples', text: 'Walk the haul road north from the port to the ice well (the tall tower) and take the sample rack.', beat: 'Six tubes, cold enough to fog. The top one has a date and "still clean" written on it.' },
      { k: 'go', to: 'depot-clerk', r: 5, drop: true, text: 'Carry the samples back to the supply desk (west of the pads).' },
    ],
    done: 'Supply clerk: Still clean. Good. Same again next shift, if your legs are up to it.' }),

  F({ id: 'mars-fr-mast', thread: 'mars-freight', world: 'mars', giver: 'cab-weather', title: 'Read the mast', pay: 100, needs: ['mars-sensor'],       // once her sensors are back (the story job), she has a mast worth reading
    brief: 'Walk out to the weather mast in the desert north of the port, read its card, and bring the numbers back up the tower.',
    pitch: 'My far mast stands out past the ice well and its radio link drops every time the dust lifts. Somebody has to walk out, pull the card and bring it to me. Follow the haul road to the well, then the stakes east of it. The mast is the thin one with the guy wires.',
    take: 'Past the well, then east. Pull the card from the box at the foot. Do not lean on the wires.',
    steps: [
      { k: 'go', to: { port: [508, -710], name: 'the weather mast' }, r: 14, carry: 'the weather mast\'s data card', text: 'Walk the haul road north past the ice well, then east to the weather mast (the thin mast with guy wires), and pull its data card.', beat: 'The box at the foot of the mast opens with a kick. One card, dusty, warm from the electronics.' },
      { k: 'go', to: 'cab-weather', r: 5, drop: true, text: 'Bring the card back to the weather desk (ride the lift up the control tower).' },
    ],
    done: 'Weather desk: Three days of wind I did not have. The mast will drop its link again by the weekend. It always does.' }),

  F({ id: 'mars-fr-landing', thread: 'mars-freight', world: 'mars', giver: 'reception-clerk', title: 'Keep the first landing', pay: 120,
    brief: 'Walk to the first landing site at the end of the haul road, brush the dust off the plaque, sign the keeper\'s book, and come back.',
    pitch: 'The first crew to land in this valley came down a little over a kilometre north of here, in 2041. What is left of their lander still stands, and the Crew Hall keeps it, because somebody has to. Somebody walks out, brushes the plaque, signs the book. It is a long walk and nobody will check. I will know.',
    take: 'The haul road, all the way to its end. The book is in the box under the plaque.',
    steps: [
      { k: 'go', to: { port: [458, -1291], name: 'the first landing' }, r: 16, text: 'Walk the haul road north to its end (about 1.3 km): the first landing site. Brush the plaque and sign the book.', beat: 'The plaque comes clean in four strokes. The book has a page of names, most of them in the same few hands. You add yours.' },
      { k: 'go', to: 'reception-clerk', r: 5, text: 'Walk back to the reception clerk at the Crew Hall (north end of the pads).' },
    ],
    done: 'Reception clerk: You went. People say they will. Thank you. The valley was empty before that lander, and it is worth remembering how empty.' }),

  F({ id: 'mars-fr-phobos', thread: 'mars-freight', world: 'mars', giver: 'depot-clerk', title: 'Freight for Stickney', pay: 180, needs: ['mars-stores'],
    brief: 'The regular case for Stickney East on Phobos: fly it up and hand it in at the airlock.',
    pitch: 'Stickney breathes a case of cartridges every few days whether the line boat flies or not. You know the pad. One case, their airlock.',
    take: 'Same door as last time: the one with the lamp bar.',
    carry: 'a case of scrubber cartridges',
    steps: [
      { k: 'land', frame: 'phobos', text: 'Fly to Phobos (Course, Phobos) and set down on the Stickney East pad.' },
      { k: 'go', to: PHOBOS_LOCK, r: 7, drop: true, text: 'Carry the case east across the pad to the station airlock (the door with the lamp bar).', beat: 'A glove takes the case. "Counted. Tell the depot the last lot ran a day long."' },
    ],
    done: 'Supply clerk (radio): Signed for. The next case is packed when you are back.' }),

  F({ id: 'mars-fr-deimos', thread: 'mars-freight', world: 'mars', giver: 'depot-clerk', title: 'Freight for the Deimos camp', pay: 240, needs: ['mars-cores'],
    brief: 'Food and drill spares for the survey camp on Deimos: fly them out and hand them over at the rig.',
    pitch: 'The Deimos camp is four people and a drill, and they eat like twelve. A box of meals and a box of spares, to the rig. It pays better than Phobos because it is twice as far and there is nobody to wave at.',
    take: 'Inside their marker circle, then east to the rig.',
    carry: 'a box of meals and drill spares',
    steps: [
      { k: 'land', frame: 'deimos', text: 'Fly to Deimos (Course, Deimos) and set down inside the camp\'s marker circle.' },
      { k: 'go', to: DEIMOS_RIG, r: 8, drop: true, text: 'Walk east to the drill rig and hand the boxes to the driller.', beat: 'Driller: Meals. And the right seals this time. You can come again.' },
    ],
    done: 'Supply clerk (radio): The camp says thank you, in their way. They asked what took so long.' }),

  F({ id: 'mars-fr-ceres', thread: 'mars-freight', world: 'mars', giver: 'depot-clerk', title: 'Long haul: Occator Works', pay: 400, needs: ['mars-stores'],
    brief: 'A crossing. Filter membranes for Occator Works on Ceres: fly the long-range drive out and hand them to the supply desk there.',
    pitch: 'This one is a crossing, not a hop. Occator Works on Ceres cannot make filter membranes and we can. One sealed drum, to Idris Kell at their supply desk. It is a long way and the drive does most of the work. It pays like it.',
    take: 'Course, Ceres. Their supply desk is by the pad. Do not open the drum.',
    carry: 'a sealed drum of filter membranes',
    steps: [
      { k: 'land', frame: 'ceres', text: 'Cross to Ceres (Course, Ceres: the long-range drive) and land at Occator Works.' },
      { k: 'go', to: 'supply', r: 6, drop: true, text: 'Carry the drum to Idris Kell at the Works supply desk.', beat: 'Idris Kell reads the seal twice. "From Mars. Unopened. I am going to frame the label."' },
    ],
    done: 'Idris Kell: Paid from the Works account, with the port\'s thanks relayed. The flight office here has loads going the other way.' }),

  // Freight that starts ON the two moons (their people: worlds/phobos/cast.js), so nobody flies home empty and the two outposts trade with each other.
  F({ id: 'mars-fr-empties', thread: 'mars-freight', world: 'mars', giver: 'ph-yard', title: 'Empties down to the port', pay: 180,
    brief: 'Six empty cartridge cases from the Stickney East yard, down to the supply desk at Marineris Port.',
    pitch: 'Going down? Then you are not going down empty. Six cartridge cases, used, lashed and tagged. The supply desk at the port refills them and we breathe another month. The depot pays the freight.',
    take: 'They are light. Up here everything is. The supply desk, west of the pads.',
    carry: 'six empty cartridge cases',
    steps: [
      { k: 'land', frame: 'mars', near: 'port', text: 'Fly down to Mars (Course, Marineris Port) and land at the port.' },
      { k: 'go', to: 'depot-clerk', r: 5, drop: true, text: 'Carry the empties to the supply desk (west of the pads).', beat: 'The supply clerk counts six and writes six. "Stickney looks after its cases. Nobody else does."' },
    ],
    done: 'Supply clerk: Six empties, signed for. There is a full case going up whenever you are.' }),

  F({ id: 'mars-fr-fuel', thread: 'mars-freight', world: 'mars', giver: 'ph-pump', title: 'Propellant for the drill', pay: 200,
    brief: 'A cold flask of propellant from the Stickney East tanks to the survey camp on Deimos.',
    pitch: 'The Deimos camp runs its drill and its hopper on what we cook here, and they are always a flask short. One cold flask, to their geologist at the survey tent. Keep it out of the Sun on the way to your ramp.',
    take: 'Course, Deimos. Aoi Tanabe, at the tent east of the marker circle.',
    carry: 'a cold flask of propellant',
    steps: [
      { k: 'land', frame: 'deimos', text: 'Fly to Deimos (Course, Deimos) and set down inside the camp\'s marker circle.' },
      { k: 'go', to: 'de-geo', r: 6, drop: true, text: 'Carry the flask east to Aoi Tanabe at the survey tent.', beat: 'Aoi Tanabe weighs the flask in one hand. "Full. Stickney must want something."' },
    ],
    done: 'Aoi Tanabe: The drill runs another week. If you are going back their way, I have plates for them.' }),

  F({ id: 'mars-fr-plates', thread: 'mars-freight', world: 'mars', giver: 'de-geo', title: 'Survey plates for Stickney', pay: 200,
    brief: 'Exposed survey plates from the Deimos camp to the propellant tech at Stickney East on Phobos.',
    pitch: 'Stickney develops our survey plates because they have the one clean room between here and Mars. A case of exposed plates, to Tomas Reyes at their pump panel. Do not open it. Light is the whole problem.',
    take: 'Course, Phobos. The pump panel is south-east of the pad.',
    carry: 'a sealed case of survey plates',
    steps: [
      { k: 'land', frame: 'phobos', text: 'Fly to Phobos (Course, Phobos) and set down on the Stickney East pad.' },
      { k: 'go', to: 'ph-pump', r: 6, drop: true, text: 'Carry the case to Tomas Reyes at the pump panel (south-east of the pad).', beat: 'Tomas Reyes turns the case to check the seal. "Unopened. You would be amazed how rare that is."' },
    ],
    done: 'Tomas Reyes: Plates received. They will be developed by the time the next flask goes out.' }),

  F({ id: 'mars-fr-rack', thread: 'mars-freight', world: 'mars', giver: 'de-driller', title: 'Cores for the tower', pay: 240,
    brief: 'A rack of drill cores from the Deimos rig to the weather desk in the tower at Marineris Port.',
    pitch: 'Another rack is full. Twelve cores, top to bottom, and the tower on Mars wants them the right way up. The port pays the freight, and pays it better than they pay me.',
    take: 'Do not turn the rack over. The weather desk, up the tower lift.',
    carry: 'a rack of drill cores',
    steps: [
      { k: 'land', frame: 'mars', near: 'port', text: 'Fly down to Mars (Course, Marineris Port) and land at the port.' },
      { k: 'go', to: 'cab-weather', r: 5, drop: true, text: 'Take the rack to the weather desk (ride the lift up the control tower).', beat: 'Weather desk: Right way up again. You are getting a reputation.' },
    ],
    done: 'Weather desk: Logged with the others. The dark band is thicker in this one.' }),

  // ============================================================================ THE MOON (three landings; each has someone with loads for the others)
  F({ id: 'moon-fr-shack', thread: 'moon-freight', world: 'moon', giver: 'h-guide', title: 'Freight for Shackleton', pay: 150,
    brief: 'A crate from the Tranquility terminal to the Fortis quartermaster at Shackleton, at the south pole.',
    pitch: 'The terminal collects more crates for the pole than the pole collects itself. This one is for Quartermaster Ostrander at Shackleton. Mind the gate sergeant, hand it over, and they pay on the spot.',
    take: 'Course, Shackleton. The quartermaster is past the gate.',
    carry: 'a crate for the Shackleton stores',
    steps: [
      { k: 'land', frame: 'moon-shackleton', text: 'Fly to Shackleton (Course, Shackleton) and land.' },
      { k: 'go', to: 's-quarter', r: 6, drop: true, text: 'Carry the crate to Quartermaster Ostrander.', beat: 'Ostrander checks the tag against a list as long as his arm, and ticks one line.' },
    ],
    done: 'Quartermaster Ostrander: One line ticked. There are four hundred. Come back whenever you like.' }),

  F({ id: 'moon-fr-daed', thread: 'moon-freight', world: 'moon', giver: 'h-guide', title: 'Freight for Daedalus', pay: 170,
    brief: 'A crate from the Tranquility terminal to the supply desk at Daedalus Station, on the far side.',
    pitch: 'Daedalus is on the far side, where the radio is quiet and so are the people. This crate is for their supply desk. It is the long way round, so it pays a little more than the pole.',
    take: 'Course, Daedalus. Supply Clerk Stroud signs for everything.',
    carry: 'a crate for the Daedalus supply desk',
    steps: [
      { k: 'land', frame: 'moon-daedalus', text: 'Fly to Daedalus Station (Course, Daedalus) and land.' },
      { k: 'go', to: 'd-supply', r: 6, drop: true, text: 'Carry the crate to Supply Clerk Oksana Stroud.', beat: 'Stroud signs without looking up. "Put it with the others. No, the other others."' },
    ],
    done: 'Supply Clerk Stroud: Received. If you are going back empty, ask me. Nobody should fly empty.' }),

  F({ id: 'moon-fr-ice', thread: 'moon-freight', world: 'moon', giver: 's-quarter', title: 'Parts back to Tranquility', pay: 150,
    brief: 'Worn pump parts from Shackleton to the water office at Tranquility for rebuilding.',
    pitch: 'The ice dock wears out pump parts and Tranquility rebuilds them. A box of worn ones for Marit Lindqvist at the water office. Fortis pays its freight on delivery, like everything.',
    take: 'Course, Tranquility. The water office, in the hub.',
    carry: 'a box of worn pump parts',
    steps: [
      { k: 'land', frame: 'moon', text: 'Fly to Tranquility (Course, Tranquility) and land.' },
      { k: 'go', to: 'h-water', r: 6, drop: true, text: 'Carry the box to Marit Lindqvist at the water office.', beat: 'Lindqvist tips one out and holds it to the light. "They run them dry again. Every time."' },
    ],
    done: 'Marit Lindqvist: Rebuilt by next week. The terminal desk will have the crate going back.' }),

  F({ id: 'moon-fr-chips', thread: 'moon-freight', world: 'moon', giver: 'd-supply', title: 'Boards back to Tranquility', pay: 170,
    brief: 'Printed circuit boards from the Daedalus fab to Tranquility Mercantile.',
    pitch: 'Since you are going back anyway. The fab prints boards and the Mercantile at Tranquility sells them for three times what we charge. One case, to Dov Abara. He will pretend to be surprised.',
    take: 'Course, Tranquility. The Mercantile, in the hub.',
    carry: 'a case of printed boards',
    steps: [
      { k: 'land', frame: 'moon', text: 'Fly to Tranquility (Course, Tranquility) and land.' },
      { k: 'go', to: 'h-shop', r: 6, drop: true, text: 'Carry the case to Dov Abara at Tranquility Mercantile.', beat: 'Dov Abara: Boards! What a surprise. Put them where the last surprise went.' },
    ],
    done: 'Dov Abara: Paid. The far side is good for business as long as nobody has to live there.' }),

  // The tally runs: each landing's own freight keeper sends you to the yard beside them
  F({ id: 'moon-fr-tally-fortis', thread: 'moon-freight', world: 'moon', giver: 's-quarter', title: 'Count the stand', pay: 60,
    brief: 'Walk to Supply Stand 6 inside the south wall, count the crates on the three pallets, and sign the tally.',
    pitch: 'Supply Stand 6, inside the south wall. Ration Six lands there, the crates come off her ramp, and the base eats the stack down before she is back. My sheet says one number. The pallets say another. Walk over, count what is standing on the three pallets, and sign it. Fortis counts everything twice. Today you are the second time.',
    take: 'South-east of here, past the motor pool. Red lamps round a numbered slab. Count the crates, not the pallets.',
    steps: [COUNT('fortis', 'Walk to Supply Stand 6 (south-east of the quartermaster, inside the wall: red lamps round a numbered slab) and count the crates on the three pallets beside the ration store. Set the number and sign the tally.',
      'Tally hand: {n}. That is what I have. {ship}')],
    done: 'Quartermaster Ostrander (radio): The sheet and the pallets agree. Do not expect it to last.' }),

  F({ id: 'moon-fr-tally-technos', thread: 'moon-freight', world: 'moon', giver: 'd-supply', title: 'Count the trays', pay: 60,
    brief: 'Walk to the tray dock in front of Fab Floor 2, count the sealed cases on the plinth, and sign the tally.',
    pitch: 'The fab prints sealed cases onto the plinth at the tray dock, and Quiet Carrier takes them away when she lands. The system knows how many there are. The system has been wrong since Tuesday. Walk to the dock, count the cases on the plinth with your own eyes, and sign the number. Do not open one.',
    take: 'West of my desk, on the white deck with the blue lines. The cases on the plinth, not the two by the arch.',
    steps: [COUNT('technos', 'Walk west to the tray dock (the white deck with blue light-lines in front of Fab Floor 2) and count the sealed cases on the plinth. Set the number and sign the tally.',
      'Seal checker: {n} on the plinth. The system said otherwise. The system is being looked at. {ship}')],
    done: 'Supply Clerk Stroud (radio): Logged by a person. I will tell the system. It will not like it.' }),

  // The Moon's two sides (open after each side's oath job; they feed that side's home)
  F({ id: 'moon-fr-rations', thread: 'moon-freight', world: 'moon', giver: 'h-recruit-fortis', title: 'Rations for the gate', pay: 160, needs: ['moon-ration'],
    faction: 'fortis', side: 'home', trade: 'defences', size: 0.5,
    brief: 'Fortis work. Buy four food packs at the Tranquility Mercantile and hand them to the quartermaster at Shackleton.',
    pitch: 'Shackleton eats every day, recruit, and the Mercantile does not deliver. Four food packs from Dov Abara, to Quartermaster Ostrander. Fortis pays you back and then some. Do it as often as you can stand the flight.',
    take: 'Four packs. The quartermaster counts.',
    steps: [
      { k: 'give', from: 'supply', item: 'food', n: 4, to: 's-quarter', r: 6, text: 'Buy four food packs at the Tranquility Mercantile (Dov Abara), land at Shackleton Base and hand them to Quartermaster Ostrander.',
        beat: 'Ostrander counts four, twice. "Fortis eats tonight. Tell the Sergeant."' },
    ],
    done: 'Sergeant Holloway: Four packs, delivered by one of ours. That is how a base stands.' }),

  F({ id: 'moon-fr-trays', thread: 'moon-freight', world: 'moon', giver: 'h-recruit-technos', title: 'Trays for the dishes', pay: 160, needs: ['moon-tray'],
    faction: 'technos', side: 'home', trade: 'wealth', size: 0.5,
    brief: 'Technos Prime work. Carry a sealed tray of chips from Tranquility to the dish engineer at Daedalus.',
    pitch: 'The dishes at Daedalus burn out a chip a week and I can only get them printed here. A sealed tray, to Yara, as before. Technos Prime does not say thank you. It pays instead.',
    take: 'Sealed. Keep it sealed. Course, Daedalus.',
    carry: 'a sealed tray of chips',
    steps: [
      { k: 'land', frame: 'moon-daedalus', text: 'Fly to Daedalus Station (Course, Daedalus) and land.' },
      { k: 'go', to: 'd-dish', r: 6, drop: true, text: 'Give the tray to Dish Engineer Yara.', beat: 'Yara slots the tray into a rack of identical trays. One dish on the rim turns a few degrees and stops.' },
    ],
    done: 'Doctor Pryce: The dishes hear a little further tonight. Technos Prime remembers who carried the tray.' }),

  // ============================================================================ CERES (the flight office, beside the JOBS board)
  // The tally runs: the flight office wants each side's stock counted by somebody who is paid by neither
  F({ id: 'ceres-fr-tally-ironclad', thread: 'ceres-freight', world: 'ceres', giver: 'lane-clerk', title: 'Count the bunker', pay: 70,
    brief: 'Walk to Ironclad\'s ore bunker west of the foundry, count how many of its three bays have ore in them, and sign the tally.',
    pitch: 'Ironclad\'s ore bunker, west of the foundry. Three bays. The pit fills them and Pit Seven empties them when she lands. The foreman says the bunker is never full, and she would say that. Walk over and count how many of the three bays have ore in them. A bay with any ore in it counts.',
    take: 'North-west of the pad, west of the foundry. Three bays. A bay with any ore in it counts.',
    steps: [COUNT('ironclad', 'Walk to Ironclad\'s ore bunker (north-west of the pad, west of the foundry) and count how many of its three bays have ore in them. Set the number and sign the tally.',
      'Yard hand: {n} with ore in. The pit fills them, the hauler empties them, and I sweep. {ship}')],
    done: 'Flight office (radio): Ironclad\'s bunker, counted by nobody\'s friend. Filed.' }),

  F({ id: 'ceres-fr-tally-greenhaven', thread: 'ceres-freight', world: 'ceres', giver: 'lane-clerk', title: 'Read the tanks', pay: 60,
    brief: 'Walk to Greenhaven\'s four clean-water tanks south of the flight office, read the lit gauge, and sign how full they are.',
    pitch: 'Two sides share these Works and each has a yard. Greenhaven has the four clean-water tanks south of my office: Good Soup fills them and the Works drinks them down. Ironclad has the ore bunker west of the foundry: Pit Seven empties it. Both sides tell me what they have. I would rather hear it from somebody who is paid by neither. Start with the tanks. Read the lit gauge on their side and tell me how full: a quarter, half, three quarters, or full.',
    take: 'South of here, the row of four tanks. The lit bar on the side is the gauge.',
    steps: [COUNT('greenhaven', 'Walk to Greenhaven\'s clean-water tanks (the row of four, south of the flight office) and read the lit gauge on their side. Set how full they are and sign the tally.',
      'Valve hand: {n}, as near as the glass shows. The trays drink first, then everybody else. {ship}')],
    done: 'Flight office (radio): Greenhaven\'s water, read by nobody\'s friend. Filed.' }),

  // The two sides' own runs: each is open once you have done that side's oath job, feeds that side's home (roles/balance.js) and shows on the standing board
  // by the pad (worlds/ceres/activity.js). Half the size of the oath job, so one pilot moves the board slowly.
  F({ id: 'ceres-fr-ore', thread: 'ceres-freight', world: 'ceres', giver: 'foreman', title: 'Ore for the bunker', pay: 130, needs: ['ceres-pit'],
    faction: 'ironclad', side: 'home', trade: 'industry', size: 0.5,
    brief: 'Ironclad work. Dig half a tonne of ore, fly it in and bring it to the foundry foreman.',
    pitch: 'The hauler empties the bunker faster than the pit fills it, so I buy from anyone wearing our badge who has a shovel and a hold. Half a tonne, any day you like. Rust-red seams, not the grey.',
    take: 'Half a tonne of the red. Into your hold, then to me.',
    steps: [
      { k: 'haul', item: 'ceres-ore', kg: 500, text: 'Dig half a tonne of ore (the rust-red seams and outcrops) and stow it in your ship\'s hold.' },
      { k: 'give', from: 'hold', item: 'ceres-ore', kg: 500, to: 'foreman', r: 6, text: 'Land at the Works and bring it to Marta Voss, the foundry foreman.', beat: 'Marta weighs it and tips it in. The furnace takes it without comment.' },
    ],
    done: 'Marta Voss: Half a tonne for Ironclad, on the books. The bunker is never full. You know where I am.' }),

  F({ id: 'ceres-fr-salt', thread: 'ceres-freight', world: 'ceres', giver: 'greenhaven-rep', title: 'Salt for the trays', pay: 130, needs: ['ceres-filters'],
    faction: 'greenhaven', side: 'home', trade: 'population', size: 0.5,
    brief: 'Greenhaven work. Dig half a tonne of salt, fly it in and bring it to Doctor Roth.',
    pitch: 'The filters eat salt and the grow hall eats what the filters make. Half a tonne of the white ground keeps both going for a week, and I will take it from anyone of ours, any day. White, not rust.',
    take: 'Half a tonne of the white. Into your hold, then to me.',
    steps: [
      { k: 'haul', item: 'ceres-salt', kg: 500, text: 'Dig half a tonne of salt (the white ground) and stow it in your ship\'s hold.' },
      { k: 'give', from: 'hold', item: 'ceres-salt', kg: 500, to: 'greenhaven-rep', r: 6, text: 'Land at the Works and bring it to Doctor Roth.', beat: 'Doctor Roth checks the colour against a card and waves it through to the trays.' },
    ],
    done: 'Doctor Roth: Half a tonne for Greenhaven. The trays are full for a week. Do not make me say thank you every time.' }),

  F({ id: 'ceres-fr-mars', thread: 'ceres-freight', world: 'ceres', giver: 'lane-clerk', title: 'Long haul: Marineris Port', pay: 400,
    brief: 'A crossing. Assay bars from the Works to the supply desk at Marineris Port on Mars.',
    pitch: 'A crossing, if you have the patience. A sealed case of assay bars for the supply desk at Marineris Port: proof of what the pit is pouring this season. Mars will not buy a tonne until it has weighed a bar.',
    take: 'Course, Mars. The supply desk is west of the pads.',
    carry: 'a sealed case of assay bars',
    steps: [
      { k: 'land', frame: 'mars', near: 'port', text: 'Cross to Mars (Course, Mars: the long-range drive) and land at Marineris Port.' },
      { k: 'go', to: 'depot-clerk', r: 5, drop: true, text: 'Carry the case to the supply desk (west of the pads).', beat: 'The supply clerk weighs one bar, then all of them, then the first one again.' },
    ],
    done: 'Supply clerk: Good metal. I will say so in writing. There is a drum going back to Ceres if you are.' }),

  // ============================================================================ EARTH (Range Control dispatch)
  // The tally runs: two yards south of the pad, and a dispatcher who trusts neither side's own count
  F({ id: 'earth-fr-tally-skyward', thread: 'earth-freight', world: 'earth', giver: 'e-dispatch', title: 'Count the canisters', pay: 70,
    brief: 'Walk to Payload Stand 2 south-west of the pad, count the canisters in the rack, and sign the tally.',
    pitch: 'Two yards work south of the pad now. Skyward has Payload Stand 2 on the west side: Upbound Two brings canisters for the next launch. The Homeguard has Sea Wall Depot 1 on the east side, on ground Skyward lent them, casting blocks for the wall. Each sends me a count and neither believes the other\'s. So the range pays a pair of eyes that belongs to nobody. Walk down to Skyward\'s rack, count the canisters, and sign it.',
    take: 'South-west of the pad. The white canisters in the rack beside the gantry with the orange arm.',
    steps: [COUNT('skyward', 'Walk to Payload Stand 2 (south-west of the landing pad, by the lattice gantry with the orange arm) and count the white canisters in the rack. Set the number and sign the tally.',
      'Stand marshal: {n} in the rack. Write it big, the range reads small. {ship}')],
    done: 'Marisol Quintero (radio): Skyward\'s number, counted by somebody who is not Skyward. Stamped.' }),

  F({ id: 'earth-fr-tally-homeguard', thread: 'earth-freight', world: 'earth', giver: 'e-dispatch', title: 'Count the wall blocks', pay: 70,
    brief: 'Walk to Sea Wall Depot 1 south-east of the pad, count the wall blocks stacked on the timbers, and sign the tally.',
    pitch: 'Sea Wall Depot 1, south-east of the pad, on the ground Skyward lent the Homeguard. They cast blocks for the sea wall and Tide Table carries them out to the coast. Pruitt says they have cast more than Skyward admits. Skyward says fewer. Walk down, count the blocks stacked on the timbers, and sign it. I only stamp it.',
    take: 'South-east of the pad. The grey blocks on timbers, by the brick hut.',
    steps: [COUNT('homeguard', 'Walk to Sea Wall Depot 1 (south-east of the landing pad, by the brick site hut) and count the grey wall blocks stacked on the timbers. Set the number and sign the tally.',
      'Depot tally: {n}, cast and cured. Every one of them is a metre of coast. {ship}')],
    done: 'Marisol Quintero (radio): The Homeguard\'s number, counted by somebody who is not the Homeguard. Stamped.' }),

  F({ id: 'earth-fr-fill', thread: 'earth-freight', world: 'earth', giver: 'e-dispatch', title: 'Fill for the sea wall', pay: 90,
    brief: 'Dig 300 kg of ground and cart it to the stakes by the road to Range Control.',
    pitch: 'The wall loses a little every tide and the range pays for every cartload that goes back into it. Three hundred kilos of anything that is not water: shell rock, sand, soil. Tip it at the stakes.',
    take: 'Shovel, cart, stakes. North-east of the pad.',
    steps: [
      { k: 'give', from: 'hopper', mats: 'earth', kg: 300, to: { at: [30, -52], frame: 'earth', name: 'the stakes' }, r: 7, text: 'Dig 300 kg of ground (shell rock, sand or soil) with the shovel, fill the cart, and carry it to the stakes (north-east of the pad, by the road to Range Control).',
        beat: 'The cart tips. It does not look like much against the sea. It is three hundred kilos more than there was.' },
    ],
    done: 'Marisol Quintero: Logged. The tide comes twice a day, so the job does too.' }),

  F({ id: 'earth-fr-line', thread: 'earth-freight', world: 'earth', giver: 'e-okafor', title: 'The line check', pay: 90, needs: ['earth-line'],
    faction: 'skyward', side: 'home', trade: 'industry', size: 0.5,
    brief: 'Skyward work. Okafor\'s daily line check: the hangar door, the tank 3 gauge, the foot of the tower, and back.',
    pitch: 'The line gets walked every day or it stops being a flight line. Hangar door, tank 3, the foot of the tower, then back to me with the numbers. Skyward pays for the boots.',
    take: 'Same round as your first day. Write the gauge down this time.',
    steps: [
      { k: 'go', to: { at: [-66, 32], frame: 'earth', name: 'the hangar door' }, r: 8, text: 'Check the hangar door (west of the pad).' },
      { k: 'go', to: { at: [179, -24], frame: 'earth', name: 'tank 3' }, r: 10, text: 'Read the gauge on tank 3 at the kerosene farm (far east of the pad).' },
      { k: 'go', to: { at: [106, -152], frame: 'earth', name: 'the tower foot' }, r: 12, text: 'Look at the foot of the launch tower (north-east).' },
      { k: 'go', to: 'e-okafor', r: 6, text: 'Report to Okafor, at the hangar.', beat: 'Okafor writes three numbers in the log and initials them.' },
    ],
    done: 'Okafor: Line walked. That is one more day Skyward can launch.' }),

  F({ id: 'earth-fr-bags', thread: 'earth-freight', world: 'earth', giver: 'e-pruitt', title: 'Fill for the Homeguard wall', pay: 90, needs: ['earth-footing'],
    faction: 'homeguard', side: 'home', trade: 'defences', size: 0.5,
    brief: 'Homeguard work. Dig 300 kg of ground and cart it to Pruitt for the wall.',
    pitch: 'A footing is not a wall. Every cartload goes into bags and every bag goes on the line. Three hundred kilos, tipped here by me, as often as your back allows. The Homeguard pays what it can.',
    take: 'Shovel, cart, and bring it to me by the training hall.',
    steps: [
      { k: 'give', from: 'hopper', mats: 'earth', kg: 300, to: 'e-pruitt', r: 7, text: 'Dig 300 kg of ground (shell rock, sand or soil) with the shovel, fill the cart, and carry it to Pruitt (beside the training hall, north-east).',
        beat: 'Pruitt shovels the first of it into a bag himself and stamps it flat.' },
    ],
    done: 'Pruitt: Another course on the wall. People see it from the road now.' }),

  // ============================================================================ CALLISTO (the camp desk)
  // The tally runs: the camp desk sends you to Mystara's stand; the Unbound keep their own count at their own camp (ask Bram there)
  F({ id: 'callisto-fr-tally-mystara', thread: 'callisto-freight', world: 'callisto', giver: 'c-dispatcher', title: 'Count the coils', pay: 60,
    brief: 'Walk to the Relay Stand east of the camp, count the coil drums, and sign the tally.',
    pitch: 'Two sides work this ice. Mystara keeps the Relay Stand, east of the camp behind the quartermaster\'s shed: Ninth Band brings coil drums for the relays the storms took. The Unbound keep a freight pad of their own up at the Prospectors\' Camp, and a count of their own. Ask Bram about that one when you are up there. Mine is the Relay Stand. Walk over, count the drums, and sign the sheet. The Director likes a number that a stranger wrote.',
    take: 'East of the camp. Violet drums with gold bands, by the measuring house.',
    steps: [COUNT('mystara', 'Walk east to the Relay Stand (behind the quartermaster\'s shed: violet stone and standing stones) and count the coil drums by the measuring house, the ones on top too. Set the number and sign the tally.',
      'Measurer: {n}. Each one is a relay that will answer again. {ship}')],
    done: 'Farah Adeyemi (radio): Written by a stranger, so the Director will believe it. Thank you.' }),

  F({ id: 'callisto-fr-tally-unbound', thread: 'callisto-freight', world: 'callisto', giver: 'c-prospector', title: 'Count the core boxes', pay: 60,
    brief: 'Walk to the claim freight pad just east of the Prospectors\' Camp, count the core boxes by the awning, and sign the tally.',
    pitch: 'Number Four takes our core boxes off the pad whenever she lands, and pays by the box. The pilot counts them her way. I count them mine. A third count settles it, and you are standing here. The stack is by the awning on the freight pad, east of the huts. Count the boxes. Sign it. Self-service, like everything else.',
    take: 'East of the huts. The stack on skids by the tarp awning. Weigh nothing. Just count.',
    steps: [COUNT('unbound', 'Walk east to the claim freight pad (salvaged deck plates with an orange cross) and count the core boxes stacked by the tarp awning. Set the number and sign the tally.',
      'Bench hand: {n}. Same as mine, which makes two against the pilot. {ship}')],
    done: 'Bram Okonkwo: A count nobody paid for is the only kind I trust. The camp paid for this one anyway.' }),

  F({ id: 'callisto-fr-ice', thread: 'callisto-freight', world: 'callisto', giver: 'c-director', title: 'Clean ice for the Archive', pay: 90, needs: ['callisto-ice'],
    faction: 'mystara', side: 'home', trade: 'wealth', size: 0.5,
    brief: 'Mystara work. Dig 300 kg of bright ice and cart it to the Archive quartermaster.',
    pitch: 'The Archive cools its listening gear with clean ice, and the melt never stops needing more. Three hundred kilos of the bright ice under the dust, to Tomas Grey. It is the same work as your first day. It matters as much.',
    take: 'Bright ice, not the dark gravel on top. Tomas Grey, at the Archive.',
    steps: [
      { k: 'give', from: 'hopper', mats: 'callisto', kg: 300, to: 'c-archivist', r: 6, text: 'Dig 300 kg of ground (the bright ice just under the dust), fill the cart, and carry it to Tomas Grey, the Archive quartermaster.',
        beat: 'Tomas Grey rubs a piece between two fingers and nods. "Clean enough to listen through."' },
    ],
    done: 'Director Sorn: The gear runs cold another week. Mystara notices who keeps it so.' }),

  F({ id: 'callisto-fr-charges', thread: 'callisto-freight', world: 'callisto', giver: 'c-prospector', title: 'Charges for the Scar', pay: 100, needs: ['callisto-claim'],
    faction: 'unbound', side: 'home', trade: 'industry', size: 0.5,
    brief: 'Unbound work. Carry a crate of drill charges east to the claim on the rim of the Listening Scar.',
    pitch: 'The claim you marked is being worked now, and a worked claim eats drill charges. One crate, on foot, to the rim. It is the same walk as the beacon. The camp pays for every crate that gets there.',
    take: 'East, about 850 metres. Set it down by the beacon, gently.',
    carry: 'a crate of drill charges',
    steps: [
      { k: 'go', to: { at: [640, -530], frame: 'callisto', name: "the Scar's rim" }, r: 25, drop: true, text: 'Carry the crate east to the rim of the Listening Scar (about 850 m) and set it down by the claim beacon.',
        beat: 'The crate goes down beside the beacon. Fresh drill holes run along the rim in a line that was not there before.' },
    ],
    done: 'Bram Okonkwo: Counted in. The claim goes a little deeper every crate. That is how the Unbound own anything.' }),

  F({ id: 'callisto-fr-mars', thread: 'callisto-freight', world: 'callisto', giver: 'c-dispatcher', title: 'Long haul: Marineris Port', pay: 600,
    brief: 'The longest crossing on the board. A sealed case of Archive recordings to the supply desk at Marineris Port on Mars.',
    pitch: 'The Archive sends a sealed case inward every season and trusts nobody to carry it, so they pay a stranger well and tell them nothing. Marineris Port, the supply desk. It is the longest run there is. Eat first.',
    take: 'Course, Mars. Do not ask what is on the recordings. I did.',
    carry: 'a sealed case of Archive recordings',
    steps: [
      { k: 'land', frame: 'mars', near: 'port', text: 'Cross to Mars (Course, Mars: the long-range drive) and land at Marineris Port.' },
      { k: 'go', to: 'depot-clerk', r: 5, drop: true, text: 'Carry the case to the supply desk (west of the pads).', beat: 'The supply clerk turns the case over, finds no label, and writes one.' },
    ],
    done: 'Supply clerk: From Callisto. That is the farthest anything on this shelf has come. Paid in full.' }),
];
