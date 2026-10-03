// What each port worker says when you talk to them. Pure data (no three.js) so the voice clip generator and the
// validator can read it. portPeople.js builds the people; src/voice/cast.js says who voices whom.
export const WORKER_LINES = {
  'cab-pad-1': 'Pad 01 is assigned to Meridian. Keep the approach clear.',
  'cab-pad-2': 'Shuttle and courier traffic use pads 02 and 03.',
  'cab-ground': 'Stay on the marked foot route across the apron.',
  'cab-approach': 'Approach desk. Watching for inbound traffic.',
  'cab-weather': 'Weather sensors are offline. Watch the dust outside.',
  'cab-supervisor': 'This watch keeps the apron clear for arrivals.',
  'cab-runner': 'I carry the shift notes between desks.',
  'cab-binoculars': 'Watching the horizon. No traffic to report.',
  'depot-clerk': 'Supply desk. Spares and field kits are on the racks.',
  'arrival-guide': 'Welcome to Marineris. Depot west, market south, control tower north. Use the lift inside.',
  'reception-clerk': 'Control is upstairs. Call the lift straight ahead.',
  'trader-1': 'Rations and coffee here. Keep your suit sealed outside.',
  'trader-2': 'Filters, connectors, salvage. Bring the part you need matched.',
  'trader-3': 'Sealed water bottles. Mind the cap in the dust.',
  'trader-4': 'Field rolls and repair fabric. Check your suit seams before you leave.',
};
/** Lines the talk panel speaks when no catalog entry has one. */
export const WORKER_FALLBACK = {
  answer: 'We keep the port running a watch at a time. The supervisor upstairs has the paid jobs.',
};
