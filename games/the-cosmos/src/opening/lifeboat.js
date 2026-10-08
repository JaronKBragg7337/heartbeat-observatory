// ============================================================================
// opening/lifeboat.js - earning the first ship (SPOILER file, "The wreck" and "At the port"; BIBLE-v3 10.1 step 6). The transport's lifeboat is intact
// but drained, towed to the player's pad. Two parts bring it back, one from each of the two sides of the player's world (that is how a new pilot meets
// both sides for a reason): a power cell and a fuel coupler. On Mars, which has no sides, the two come from the two neutral traders of the Exchange.
// Pure data (no three.js): the authority checks who is standing where and what is paid; the client shows the one button that does it.
// ============================================================================

export const REPAIR_PARTS = {
  cell: { name: 'power cell', priceMarks: 300 },
  coupler: { name: 'fuel coupler', priceMarks: 300 },
};

/**
 * Who gives which part, by world. `at` is where they stand: port-local metres on Mars (the port's own frame: x right, z back), outpost-local metres on
 * Ceres (x east, z south, from the middle of the main pad: src/worlds/ceres/layout.js). `reach` is how close you must be.
 */
export const REPAIR_GIVERS = {
  mars: {
    cell: { id: 'trader-2', who: 'the Salvage trader', where: 'the Exchange', frame: 'port', at: { x: -62, z: 50.25 }, reach: 4 },
    coupler: { id: 'trader-4', who: 'the Field kit trader', where: 'the Exchange', frame: 'port', at: { x: -46, z: 50.25 }, reach: 4 },
  },
  ceres: {
    cell: { id: 'foreman', who: 'Marta Voss, the foundry foreman (Ironclad)', where: 'Occator Works', frame: 'outpost', at: { x: -6, z: -84 }, reach: 4 },
    coupler: { id: 'greenhaven-rep', who: 'Doctor Roth (Greenhaven)', where: 'Occator Works', frame: 'outpost', at: { x: 30, z: 44 }, reach: 4 },
  },
  // Earth: the Skyward Launch Complex (src/worlds/earth/layout.js; the two stand where cast.js puts them). Homeguard has nothing built, so its man stands in Skyward's yard.
  earth: {
    cell: { id: 'e-okafor', who: 'Okafor, the flight line crew chief (Skyward)', where: 'the Skyward Launch Complex', frame: 'outpost', at: { x: -50, z: 36 }, reach: 4 },
    coupler: { id: 'e-pruitt', who: 'Pruitt, the Homeguard organiser', where: 'the Skyward Launch Complex', frame: 'outpost', at: { x: 48, z: -58 }, reach: 4 },
  },
};
export const FIT_REACH = 20;

/** The two part names still missing from a ship record. */
export const missingParts = (ship) => (ship && ship.drained ? ['cell', 'coupler'].filter((p) => !(ship.repair?.have || []).includes(p)) : []);
export const giverFor = (world, part) => (REPAIR_GIVERS[world] || REPAIR_GIVERS.mars)[part];

/** The arrival note for a world: what the lifeboat needs and who has it. Spoken by the ship's voice (voiced by tools/gen-voices.mjs). */
export function arrivalNote(world) {
  const g = REPAIR_GIVERS[world] || REPAIR_GIVERS.mars;
  return `Passenger line settlement: 10,000 Mars marks, 2,500 credits. Your lifeboat is on its pad and drained. It needs a power cell from ${g.cell.who} and a fuel coupler from ${g.coupler.who}. Three hundred marks each.`;
}

/** FIX-R4: the parts a given person sells right now (the drained lifeboat's missing parts whose giver is this person), so the shop/talk panel can list them. */
export function partsSoldBy(giverId, world, ship) {
  return missingParts(ship).filter((part) => giverFor(world, part).id === giverId);
}
