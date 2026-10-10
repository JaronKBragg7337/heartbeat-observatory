// Callisto: the opening's words for a crash on the bright ice of Valhalla's floor, a few kilometres from the Valhalla Camp. Same keys
// as every world's file. The two sides: Mystara (the researchers) and the open seat, held loosely by the prospectors' camp.
export default {
  id: 'callisto',
  place: "the bright floor of Valhalla's basin",
  port: 'the Valhalla Camp',
  surface: 'Gravity outside is one point two four metres per second squared. Every step is a small leap. The ground is impact ice, four billion years old, and it rings under your boots.',
  weather: 'That is Jupiter below us. Yes, all of it. The camp said the drive would drop us east of the basin. The drive disagreed.',
  locker: {
    name: 'Ken Watanabe-Reyes',
    role: 'Steward, Mars Line',
    photo: 'A photo taped inside the door: a man in a very warm hat standing in a greenhouse, holding a wrench in one hand and a tomato in the other, both like trophies.',
    note: 'To whoever finds this: the tomato was a gift and the wrench was mine. If you are reading this on Callisto, look up. Once. Then work. That is what I would do.',
  },
  crate: 'Survival crate open. One hand tool, one day of air and water, one beacon. Beacon armed. Help is on the way at rover speed, which is honest but slow.',
  drivers: {
    mystara: { person: 'aoi', voice: 'aoi', name: 'Grey', role: 'Quartermaster of the Archive', faction: 'mystara',
      greeting: 'Tomas Grey, Mystara, keeper of the camp\'s cupboards and, today, its rescue rover. We saw your beacon. We always see the beacons. We are very good at beacons.',
      pitch1: 'Mystara studies what Jupiter is singing about. We have the only safe routes in this system, the only complete maps, and more questions than a person can carry. We cannot build much and we do not fight. We listen.',
      pitch2: 'The prospectors will tell you the seat here is open and everything can be yours. It is open. But the road to Europa goes through our maps, and the maps go through us.',
      offer: 'Climb in. Do not touch the middle stone as we pass the array. It is measuring something, and it prefers quiet.',
      closing: 'That is the Valhalla Camp. The Archive is the low building with the gold line. The Director waits at the door, and she already knows your name.' },
    unbound: { person: 'jorge', voice: 'jorge', name: 'Bram', role: 'Prospector, spokesman of the camp', faction: 'unbound',
      greeting: 'Bram, of the prospectors. We watched you come down and we had a bet on whether the beacon would work. I won. Welcome to Callisto, the only place in the system where nobody owns anything yet.',
      pitch1: 'The second seat on Callisto is open. No faction, no masters, no deeds. The first side to raise a building gets it, and until then we hold it, and we prospect. Ice, metal, and whatever the ice is hiding.',
      pitch2: 'The purple people will tell you the road to Europa is theirs. The road is whoever drives it, friend. Raise the first wall and the seat is yours, and we will follow you.',
      offer: 'Climb in. The heater works when it feels like it. Kick it twice, politely.',
      closing: 'That is the Valhalla Camp. The camp desk has jobs and hands for hire. My lot is a kilometre north, past the Scar. Follow the lights, or your nose, whichever is sharper.' },
  },
  // the other side's recruiter, waiting at the camp; keyed by the faction that sent the rover
  counter: {
    mystara: { person: 'jorge', voice: 'jorge', name: 'Bram', faction: 'unbound',
      line: 'Bram, of the prospectors. Before you sign with the listeners: the seat is open and the ice is rich. Raise one building and it is yours. They will never say that to you.' },
    unbound: { person: 'aoi', voice: 'aoi', name: 'Grey', faction: 'mystara',
      line: 'Tomas Grey, Mystara. The prospectors are good people and their drills are loud. We have the maps of this system and the road to Europa. Do come and see the array before you decide anything.' },
  },
};
