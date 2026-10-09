// ============================================================================
// missions/catalog.js - the jobs and the stories in them. PURE DATA (no three.js, no DOM): the authority reads it to check every step, the browser reads
// it to tell the player what is next, the validator reads it to prove every mission can be finished.
//
// THE RULES (BIBLE-v3 sections 10.2, 12, 13.2, 17)
//   * A person tells you the job when you ask them for work in the Talk panel and you answer "I'll take it": that is their dialogue, not an approve screen.
//   * No hand-in button. Steps finish by ARRIVING: walk to the place, land the ship, carry the load there, sign the hand on. The pay arrives with the last step.
//   * Every step is checked by the authority (where you stand, what the hold holds, where the ship is), saved in the world record and survives a refresh.
//   * Taking a faction's job is joining it, slowly (10.2). The first job of a faction's thread is its OATH job (13.2): done in the open, it is the switch.
//   * A thread is a story: the beats ("beat") are said when a step is done; the last mission of a thread ends in a choice or a thing found.
//   * Mars is neutral and unownable: Mars jobs are port jobs (side 'port'), they move no balance and take no side.
//
// STEPS (all checked on the server, src/missions/where.js resolves the places):
//   go     { to, r }                     be within r metres of `to` (a person id, or { at:[x,z], frame } outpost metres, or { derelict:'phobos' })
//                                         carry:'label' puts a load in your hands from this moment; drop:true takes it from you on arrival
//   land   { frame, near? }              the ship is landed on that frame (Mars: at the port)
//   haul   { item, kg }                  the ship's hold has that much of the hold item (dug matter, salvage)
//   give   { from:'hold'|'supply'|'hopper', item|mats, kg|n, to, r }   hand over what you carry to `to` (consumed, mass books kept)
//   hire   { n }                         sign a new hand (the crew grows by n from the moment the step starts)
//   choose { to, r, ask, options }       the story asks you something; the options end the job
// Fields on a mission: id, world, thread, giver, title, brief, faction, side ('port'|'home'|'joint'), trade, oath, needs[], needsAny[], pitch, take, steps[], pay (credits),
//   size (balance weight), done (the closing line), flags (what the story remembers), build ({ key, kg }: what the job leaves standing in the world, kept in homes.<world>.built).
// ============================================================================

/** Hopper materials that count as "ground" on Earth (grass and soil, shell rock, sand): dig any of them. */
export const EARTH_GROUND = ['MAT-EARTH-REGOLITH', 'MAT-EARTH-RUBBLE', 'MAT-EARTH-SAND'];

export const THREADS = [
  { id: 'mars-port', world: 'mars', title: 'The Quiet Band', blurb: 'Marineris Port is neutral and short of everything. Something on the survey band is not on any list.' },
  { id: 'earth-cold-fuel', world: 'earth', title: 'Cold Fuel', blurb: 'Twenty-eight percent of Skyward\'s cold fuel is gone. Two sides of one coast know where.' },
  { id: 'ceres-salt-water', world: 'ceres', title: 'Salt and Water', blurb: 'Ironclad needs the water, Greenhaven needs the metal. Neither will say so first.' },
  { id: 'moon-two-way', world: 'moon', title: 'The Two-Way Run', blurb: 'Fortis has the power and Technos has the parts. Everybody cashes it and nobody says cooperation.' },
];

export const MISSIONS = [
  // ============================================================================ MARS: THE QUIET BAND (neutral)
  { id: 'mars-notes', thread: 'mars-port', world: 'mars', giver: 'cab-runner', title: 'Shift notes', side: 'port', pay: 70,
    brief: 'Carry the tower\'s shift notes to the supply desk and the Salvage trader, then bring the receipt back.',
    pitch: 'I carry the shift notes between desks and the lift is slow. Take this green folder: the supply desk first, then the Salvage trader on the market row, then bring me the receipt. Do not read it. It is boring and you would not understand it.',
    take: 'Green folder. Do not bend it.',
    carry: 'the shift notes',
    steps: [
      { k: 'go', to: 'depot-clerk', r: 5, text: 'Take the shift notes to the supply desk (west of the pads).', beat: 'Supply clerk: Signed. Tell the runner the sealant is still not here.' },
      { k: 'go', to: 'trader-2', r: 4, text: 'Now the Salvage trader, on the market row (south of the pads).', beat: 'Salvage trader: Notes, notes. Tell the tower I have a part for their weather mast. It has been on this shelf since the storms.' },
      { k: 'go', to: 'cab-runner', r: 5, drop: true, text: 'Bring the receipt back to the shift runner (ride the lift up the control tower).', beat: 'Shift runner: Late, but fewer wrong turns than the last one.' },
    ],
    done: 'Shift runner: That is a week of lift rides saved. Go and see the weather officer. She has been grumbling about a part.' },

  { id: 'mars-sensor', thread: 'mars-port', world: 'mars', giver: 'cab-weather', title: 'A part for the weather mast', side: 'port', pay: 150, needs: ['mars-notes'],
    brief: 'Buy two spare parts kits from the Salvage trader and bring them to the weather officer in the tower.',
    pitch: 'The weather sensors died with the relays in the seventies. I can bring one back with two spare parts kits. The Salvage trader sells them, eighty marks each. I am not allowed to leave the glass. You are. Think about it.',
    take: 'Two kits. Not a kit and a good feeling.',
    steps: [
      { k: 'give', from: 'supply', item: 'parts', n: 2, to: 'cab-weather', r: 5, text: 'Buy two spare parts kits from the Salvage trader (market row), then bring them to the weather officer in the tower.',
        beat: 'She fits both. The mast on the roof hums, and a row of small green lights comes on across the glass. The first weather the port has had in years.' },
    ],
    done: 'Weather officer: Dust in four sols. I can say that again and it will still be true. Tell the approach desk the survey band is clean enough to hear.' },

  { id: 'mars-hand', thread: 'mars-port', world: 'mars', giver: 'reception-clerk', title: 'A hand on the flight deck', side: 'port', pay: 140,
    brief: 'Sign a hand at the Crew Hall: the port pays a grant for every new hand.',
    pitch: 'The port pays a grant for every new hand signed at the Crew Hall, because empty chairs make for expensive accidents. Sign anyone. Bring them aboard. I will pay you the grant, and I will pretend it was paperwork.',
    take: 'The grant is paid when the name is on the roster.',
    steps: [
      { k: 'hire', n: 1, text: 'Sign a hand at the Crew Hall (the long building at the north end of the pads). Stand at its door and they come out to meet you.' },
    ],
    done: 'Reception clerk: A name on a roster. The lift thanks you.' },

  { id: 'mars-band', thread: 'mars-port', world: 'mars', giver: 'cab-approach', title: 'The survey band', side: 'port', pay: 240, needs: ['mars-sensor'],
    brief: 'Fly to Phobos, take the drifting cargo module\'s flight recorder, and bring it to the approach desk.',
    pitch: 'My receiver works now. The survey band keeps repeating a transponder from Phobos, from that old cargo module, and it has no power to repeat anything. Go and take its flight recorder. Do not rest your hand on anything warm.',
    take: 'Phobos. The pad at Stickney East. It is a short flight and a long way back if you are wrong.',
    carry: null,
    steps: [
      { k: 'land', frame: 'phobos', text: 'Fly to Phobos (Course, Phobos) and set down on the Stickney East pad.', beat: 'Approach (radio): Strong now. Eight hundred metres south-west of you. Walk, do not jump.' },
      { k: 'go', to: { derelict: 'phobos', name: 'the drifting cargo module' }, r: 10, carry: 'the module\'s flight recorder', text: 'Walk to the drifting cargo module south-west of the pad and take its flight recorder.',
        beat: 'The door is dogged and cold. The recorder is still warm. Nobody has had power in this module for ten years.' },
      { k: 'land', frame: 'mars', near: 'port', text: 'Take the recorder home: land at Marineris Port.' },
      { k: 'go', to: 'cab-approach', r: 5, drop: true, text: 'Take the recorder to the approach controller (ride the lift up the control tower).', beat: 'Approach: Playing it now. Hm.' },
    ],
    done: 'Approach controller: Four seconds of something that moves like a ship and talks like nobody. I am logging it as a contact. The lookout will want to hear it.' },

  { id: 'mars-glass', thread: 'mars-port', world: 'mars', giver: 'cab-binoculars', title: 'The long glass', side: 'port', pay: 300, needs: ['mars-band'],
    brief: 'Stand at the glass with the lookout and see what crosses Deimos\' track.',
    pitch: 'I log every light I see. Last night one crossed Deimos\' track faster than the Ares line, and it had no transponder. The controller\'s recording matches. I need a second witness at the glass. Stand beside me. Look east.',
    take: 'Good. Do not talk. It does not like talking.',
    steps: [
      { k: 'go', to: 'cab-binoculars', r: 4, text: 'Stand at the glass beside the lookout (control tower cab).',
        beat: 'The lookout points east. A pale point above Deimos\' track, brighter than a star, moves. It does not turn. It does not slow. Then it is not there. Scanner log, entry one: contact, no transponder, no name.' },
      { k: 'choose', to: 'cab-binoculars', r: 5, ask: 'The lookout holds out the pen. What goes in the book?', text: 'The lookout is waiting. Talk to them: what goes in the book?', options: [
        { id: 'open', label: 'Put it on the open band. Let the port talk.', pay: 300, beat: 'Lookout: Then it is everyone\'s. By evening the market row will have a name for it, and by morning three of them.', flag: 'open' },
        { id: 'sealed', label: 'Seal it in the tower book. The Survey Office keeps it quiet.', pay: 300, beat: 'Lookout: Sealed. The book goes in the safe. Somebody will ask for it, one day, in a nicer voice.', flag: 'sealed' },
      ] },
    ],
    done: 'The scanner log keeps it: unexplained, unrepeated, never caught.' },

  // ============================================================================ EARTH: COLD FUEL (Skyward and Homeguard, one coast)
  { id: 'earth-line', thread: 'earth-cold-fuel', world: 'earth', giver: 'e-okafor', title: 'Walk the line', faction: 'skyward', side: 'home', trade: 'industry', oath: true, pay: 150, size: 1,
    brief: 'Okafor\'s daily line check: the hangar door, the tank 3 gauge, the foot of the tower, and back.',
    pitch: 'Flight line, daily check. Hangar door, tank farm gauge, tower foot, back to me. It is a long walk and you will hate it. I do it every day and I have thoughts about that.',
    take: 'Good. Boots on, eyes open, mouth shut.',
    steps: [
      { k: 'go', to: { at: [-66, 32], frame: 'earth', name: 'the hangar door' }, r: 8, text: 'Check the hangar door (west of the pad).', beat: 'The door seals clean. Your boots are clean too. The hangar floor is not.' },
      { k: 'go', to: { at: [179, -24], frame: 'earth', name: 'tank 3' }, r: 10, text: 'Read the gauge on tank 3 at the kerosene farm (far east of the pad).', beat: 'Tank 3 reads 62 percent. The log says 90. Somebody has been drawing it down.' },
      { k: 'go', to: { at: [106, -152], frame: 'earth', name: 'the tower foot' }, r: 12, text: 'Look at the foot of the launch tower (north-east).', beat: 'Fresh tyre tracks run from the tank farm road to the tower road and off toward the training hall. A flatbed.' },
      { k: 'go', to: 'e-okafor', r: 6, text: 'Report to Okafor, at the hangar.', beat: 'Okafor: Twenty-eight percent. That is a lot of kerosene for a leak.' },
    ],
    done: 'Okafor: You did the line. Most do the first door and discover a pressing need to be elsewhere.' },

  { id: 'earth-ask', thread: 'earth-cold-fuel', world: 'earth', giver: 'e-okafor', title: 'Ask politely', faction: 'skyward', side: 'home', trade: 'industry', pay: 120, needs: ['earth-line'],
    brief: 'Ask Pruitt and the dispatcher whose flatbed it was, and report to Okafor.',
    pitch: 'I need to know whose flatbed that was. Ask the Homeguard man. Politely. Then ask Quintero at dispatch what the gate logged. Then come back to me, and do not shout at anyone in my name.',
    take: 'Politely. I will know if it was not.',
    steps: [
      { k: 'go', to: 'e-pruitt', r: 5, text: 'Ask Pruitt, the Homeguard organiser (beside the training hall, north-east).', beat: 'Pruitt: Not ours. We have a borrowed truck and a wheelbarrow, and the wheelbarrow is not fast. Dispatch logs the gate. Ask Marisol.' },
      { k: 'go', to: 'e-dispatch', r: 5, text: 'Ask Quintero at the dispatch desk (south of Range Control).', beat: 'Quintero: Unscheduled key-card exit, three in the morning, Skyward night crew. Card holder: Dale Reyes. I only read what the gate writes.' },
      { k: 'go', to: 'e-okafor', r: 6, text: 'Go back to Okafor, at the hangar.', beat: 'Okafor says nothing for a while. Then: Dale is a good man. That is the part I do not like.' },
    ],
    done: 'Okafor: Thank you. Now I have to decide what kind of chief I am.' },

  { id: 'earth-footing', thread: 'earth-cold-fuel', world: 'earth', giver: 'e-pruitt', title: 'A footing for the first wall', build: { key: 'footing', kg: 300 }, faction: 'homeguard', side: 'home', trade: 'defences', oath: true, pay: 150, size: 1,
    brief: 'Dig a cartload of ground (300 kg) and carry it to the stakes: the first thing Homeguard builds on this coast.',
    pitch: 'Homeguard has nothing built on this coast. Not a wall, not a hut. Dig me a cartload of shell rock or sand, carry it to the stakes by the road to Range Control, and that is Homeguard\'s first foundation. Please do not count the chairs.',
    take: 'A cartload. Three hundred kilos. On your own back, more or less.',
    steps: [
      { k: 'give', from: 'hopper', mats: 'earth', kg: 300, to: { at: [30, -52], frame: 'earth', name: 'the stakes' }, r: 7, text: 'Dig 300 kg of ground (shell rock, sand or soil) with the shovel, fill the cart, and carry it to the stakes (north-east of the pad, by the road to Range Control).',
        beat: 'The load goes into the stake line and Pruitt walks the string. It is the footing of a sea wall. It is not much. It is the first thing Homeguard has ever built here.' },
    ],
    done: 'Pruitt: I will tell the others it exists. They will want to come and look. Please bring them gently.' },

  { id: 'earth-hand', thread: 'earth-cold-fuel', world: 'earth', giver: 'e-dispatch', title: 'A hand for the countdown', side: 'port', pay: 140,
    brief: 'Sign a hand at the dispatcher\'s desk: Range Control needs more hands on the line.',
    pitch: 'Range Control needs another pair of hands on the line before the next test. Sign a hand at my desk and I will clear the cost with the budget office, which is also me.',
    take: 'Talk to me again when you are ready: the hands are on the list.',
    steps: [
      { k: 'hire', n: 1, text: 'Sign a hand at the dispatcher\'s desk (Talk to Quintero, then Hire). They come aboard your landed ship.' },
    ],
    done: 'Quintero: One more name on the roster. Whoever it is, they will be shouted at by lunchtime.' },

  { id: 'earth-fuel', thread: 'earth-cold-fuel', world: 'earth', giver: 'e-dispatch', title: 'Cold fuel', side: 'joint', trade: 'wealth', pay: 300, size: 2, needsAny: ['earth-ask', 'earth-footing'],
    brief: 'The tank log must be signed by sunset. Decide what goes in it.',
    pitch: 'The range officer wants the tank log signed by sunset: twenty-eight percent short and a Skyward key card. Whether you walked the line or dug the footing, you know where the fuel went. Write it up however you like. I only stamp it.',
    take: 'Come to my desk when you know.',
    steps: [
      { k: 'choose', to: 'e-dispatch', r: 6, ask: 'Quintero holds the stamp over the tank log. What is written in it?', text: 'Go to the dispatch desk and tell Quintero what goes in the tank log.', options: [
        { id: 'leak', label: 'A slow leak. Nobody\'s name.', side: 'joint', size: 2, pay: 300, flag: 'leak',
          beat: 'Quintero stamps LEAK: SPHERE FARM, NO FAULT. Okafor and Pruitt nod at each other across the yard, one nod each, and the pumps at the school well keep running.' },
        { id: 'name', label: 'Put Dale\'s name on it.', side: 'home', size: 2, pay: 300, flag: 'name', rep: { homeguard: -3 },
          beat: 'Quintero stamps THEFT: KEY CARD 4471. Dale is grounded by noon. The pumps at the school well stop by evening. Pruitt does not look at anyone.' },
      ] },
    ],
    done: 'The tank log is closed. Whatever is in it, it will be the true thing from now on.' },

  // ============================================================================ CERES: SALT AND WATER (Ironclad and Greenhaven)
  { id: 'ceres-pit', thread: 'ceres-salt-water', world: 'ceres', giver: 'foreman', title: 'Ore for the foundry', faction: 'ironclad', side: 'home', trade: 'industry', oath: true, pay: 160, size: 1,
    brief: 'Dig a tonne of ore, stow it in your ship, land at the Works and hand it to the foreman.',
    pitch: 'Ore. One tonne of it, dug, stowed in your hold, landed here at the hopper. I pay better than the market and I will not tell you why. Rust-red seams. The white stuff is salt and it does not count.',
    take: 'One tonne. I weigh it myself.',
    steps: [
      { k: 'haul', item: 'ceres-ore', kg: 1000, text: 'Dig a tonne of ore (the rust-red seams and outcrops) and stow it in your ship\'s hold.' },
      { k: 'give', from: 'hold', item: 'ceres-ore', kg: 1000, to: 'foreman', r: 6, text: 'Land at the Works and bring it to Marta Voss, the foundry foreman.', beat: 'Marta weighs it, nods once, and tips it into the hopper. The furnace gives a low note like a pleased animal.' },
    ],
    done: 'Marta Voss: One tonne, honest weight. You have the hands for it. Come back when your back has forgotten.' },

  { id: 'ceres-filters', thread: 'ceres-salt-water', world: 'ceres', giver: 'greenhaven-rep', title: 'Salt for the filters', faction: 'greenhaven', side: 'home', trade: 'population', oath: true, pay: 150, size: 1,
    brief: 'Dig a tonne of salt, stow it in your ship, and bring it to Doctor Roth.',
    pitch: 'Sodium carbonate. The Compact has pans of it and no use for it, and my filters are eating their last bag. One tonne of the white ground, stowed in your hold and landed here. I will pay what a pharmacy is worth, which is a lot, and I will complain about it.',
    take: 'One tonne. White, not rust.',
    steps: [
      { k: 'haul', item: 'ceres-salt', kg: 1000, text: 'Dig a tonne of salt (the white ground) and stow it in your ship\'s hold.' },
      { k: 'give', from: 'hold', item: 'ceres-salt', kg: 1000, to: 'greenhaven-rep', r: 6, text: 'Land at the Works and bring it to Doctor Roth.', beat: 'Doctor Roth lets the salt run through her fingers. Clean, bright, a little cold. For a moment she looks almost happy.' },
    ],
    done: 'Doctor Roth: The filters will run for a month. That is the nicest thing anyone has done for me since I got here, and I am not going to say it twice.' },

  { id: 'ceres-notice', thread: 'ceres-salt-water', world: 'ceres', giver: 'shift-boss', title: 'The strike notice', side: 'joint', trade: 'wealth', pay: 260, size: 2, needsAny: ['ceres-pit', 'ceres-filters'],
    brief: 'Carry the shift boss\'s notice to Doctor Roth and the foreman, then tell him what you saw.',
    pitch: 'The belts are one bad shift from a strike and the domes are one bad shift from rationing the water. I cannot send either of them a letter. You can walk. Take the notice to Doctor Roth, then to Marta Voss, and come back and tell me what they said. Do not add anything.',
    take: 'Do not add anything. Everybody adds something.',
    carry: 'the shift boss\'s notice',
    steps: [
      { k: 'go', to: 'greenhaven-rep', r: 5, text: 'Take the notice to Doctor Roth (the Greenhaven recruiter, south-east of the pad).', beat: 'Roth reads it twice. "They will strike if we ration. I will not ration if they will not strike. I cannot sign a promise, but I can leave the valve open."' },
      { k: 'go', to: 'foreman', r: 5, text: 'Now to Marta Voss, the foundry foreman (north of the pad).', beat: 'Marta reads it once. "Open valve. Then I will tell the belts to hold. Tell Hallett it was my idea. It was not."' },
      { k: 'go', to: 'shift-boss', r: 5, drop: true, text: 'Go back to the shift boss, at the bunkhouse (north-east).' },
      { k: 'choose', to: 'shift-boss', r: 6, ask: 'Hallett looks at you. What do the belts do?', text: 'Tell the shift boss what you saw.', options: [
        { id: 'hold', label: 'They hold: the valve is open. Hold the belts.', side: 'joint', size: 2, pay: 260, flag: 'hold', beat: 'Hallett: Held, then. The water runs and the belts run and nobody gets a medal. Good. I hate medals.' },
        { id: 'strike', label: 'Strike on Friday. The domes are lying.', side: 'home', size: 2, pay: 260, flag: 'strike', rep: { greenhaven: -3 }, beat: 'Hallett: Friday. I will tell the bunkhouse. The domes will ration, the pans will be full of angry men, and you will have been right. That is a lot to be.' },
      ] },
    ],
    done: 'Ceres goes on, one way or the other.' },

  { id: 'ceres-hand', thread: 'ceres-salt-water', world: 'ceres', giver: 'lane-clerk', title: 'Hands for the Works', side: 'port', pay: 140,
    brief: 'Sign a hand at the flight office: Ceres pays a grant for every new hand.',
    pitch: 'The Works pays a grant for every hand signed on a ship that flies out of here, because a ship with no crew sits on my pad and I have to look at it. Sign one at my desk. I will cover the fee.',
    take: 'My desk. The hands are on the list.',
    steps: [
      { k: 'hire', n: 1, text: 'Sign a hand at the flight office (Talk to Ines Okafor, then Hire). They come aboard your landed ship.' },
    ],
    done: 'Flight office: A name on the roster, a ship off my pad one day sooner. Thank you.' },

  // ============================================================================ MOON: THE TWO-WAY RUN (Fortis and Technos Prime)
  { id: 'moon-footprints', thread: 'moon-two-way', world: 'moon', giver: 'h-guide', title: 'Do not touch', side: 'port', pay: 90,
    brief: 'Walk (or hop) to the first footprints, eleven hundred metres south-west, and see the ranger is well.',
    pitch: 'The Heritage Ranger has not called in since last week, and he is eleven hundred metres out at the first footprints. They are older than your country. Go and see that he is well. Do not touch anything. I have to say that every time.',
    take: 'South-west. Follow the old tracks. They are not ours.',
    steps: [
      { k: 'go', to: 'h-ranger', r: 12, text: 'Go to the first footprints, 1.1 km south-west of the pad, and find Ranger Tolliver.', beat: 'Ranger Tolliver: You walked. Nobody walks. Look at the fence, not the ground, and thank you. The footprints are under a low rail, perfectly sharp. Nothing has blown them away for a very long time.' },
      { k: 'go', to: 'h-guide', r: 6, text: 'Go back to the arrivals guide (the hub terminal).' },
    ],
    done: 'Odalys Moreno: He is well? Good. He is always well. He only says he is not when he wants company.' },

  { id: 'moon-ration', thread: 'moon-two-way', world: 'moon', giver: 'h-recruit-fortis', title: 'Rations for Shackleton', faction: 'fortis', side: 'home', trade: 'defences', oath: true, pay: 200, size: 1,
    brief: 'Buy six food packs at the Mercantile and hand them to the quartermaster at Shackleton Base.',
    pitch: 'Quartermaster Ostrander is short of food and too proud to say so. Buy six food packs at the Mercantile, land at Shackleton and hand them over. He will pretend to be ungrateful. That is how you know it worked.',
    take: 'Six. Sealed. Do not eat one on the way.',
    steps: [
      { k: 'give', from: 'supply', item: 'food', n: 6, to: 's-quarter', r: 6, text: 'Buy six food packs at the Tranquility Mercantile (Dov Abara), land at Shackleton Base and hand them to Quartermaster Ostrander.',
        beat: 'Ostrander counts them twice and says nothing about it. "Fortis remembers a supply. Fortis does not say thank you. Consider the silence a medal."' },
    ],
    done: 'Sergeant Holloway: Ostrander says you are acceptable. From him that is a parade.' },

  { id: 'moon-tray', thread: 'moon-two-way', world: 'moon', giver: 'h-recruit-technos', title: 'A sealed tray', faction: 'technos', side: 'home', trade: 'wealth', oath: true, pay: 200, size: 1,
    brief: 'Carry a sealed chip tray to the dish engineer at Daedalus Station.',
    pitch: 'This tray holds a chip the dish array has been waiting a month for. It has to go to Dish Engineer Yara at Daedalus, on the far side, and it has to go with someone who will not open it. You look like someone who will not open it. I may be wrong. It is a very polite tray.',
    take: 'Do not shake it. Do not tell Fortis. Do not look at it.',
    carry: 'the sealed chip tray',
    steps: [
      { k: 'go', to: 'd-dish', r: 6, drop: true, text: 'Fly to Daedalus Station (Course, Daedalus) and give the tray to Dish Engineer Yara.', beat: 'Yara opens the tray, looks at the chip for a long time, and laughs once. "Tell Doctor Pryce the dishes can hear again. Tell her I am buying her a coffee. Tell her it will be terrible."' },
    ],
    done: 'Doctor Pryce: The dishes hear again. I will say nothing about who made that possible, because that is how we say thank you.' },

  { id: 'moon-two', thread: 'moon-two-way', world: 'moon', giver: 'h-guide', title: 'The two-way run', side: 'joint', trade: 'wealth', pay: 320, size: 2, needsAny: ['moon-ration', 'moon-tray'],
    brief: 'Buy four parts at the Daedalus fab and bring them to the Fortis quartermaster at Shackleton.',
    pitch: 'Fortis pays well for parts and Technos prints them cheap, and neither will say the word out loud. You can say it for them: carry four parts from the fab on the far side to the quartermaster at Shackleton. It is a trade run. Nobody will call it cooperation, and everybody will cash it.',
    take: 'Four parts. Fab floor two on the far side, then Shackleton. Mind the gate sergeant.',
    steps: [
      { k: 'give', from: 'supply', item: 'parts', n: 4, to: 's-quarter', r: 6, text: 'Buy four parts at Daedalus (Fab Engineer Hollis Petrov), then land at Shackleton and hand them to Quartermaster Ostrander.',
        beat: 'Ostrander turns a part over in the lamplight. "Technos. I never thought I would say this without swearing." He does not say it. He nods.' },
    ],
    done: 'Odalys Moreno: Two worlds of people who cannot stand each other, and a parts shelf. That is how the Moon has always worked.' },
];

export const missionById = (id) => MISSIONS.find((m) => m.id === id) || null;
export const missionsOfWorld = (worldId) => MISSIONS.filter((m) => m.world === worldId);
export const missionsOfGiver = (personId) => MISSIONS.filter((m) => m.giver === personId);
export const threadById = (id) => THREADS.find((t) => t.id === id) || null;

/** Has this record finished every mission that `m` needs? `done` is the player's { missionId: {...} }. */
export function unlocked(m, done) {
  const d = done || {};
  if ((m.needs || []).some((id) => !d[id])) return false;
  if (m.needsAny && m.needsAny.length && !m.needsAny.some((id) => d[id])) return false;
  return true;
}
/** The missions a person could give right now: this world's, not done, unlocked. */
export function offeredBy(personId, worldId, done) {
  return missionsOfGiver(personId).filter((m) => m.world === worldId && !(done || {})[m.id] && unlocked(m, done));
}
export const stepsOf = (m) => m.steps;
/** The words for how a mission pays: credits and (for a faction job) the side it helps. */
export function payWords(m) {
  const w = m.side === 'joint' ? 'helps both factions' : m.side === 'home' ? `helps ${m.faction || 'your faction'}` : 'a port job';
  return `${m.pay} credits · ${w}`;
}
export const GROUND_MATS = { earth: EARTH_GROUND };
