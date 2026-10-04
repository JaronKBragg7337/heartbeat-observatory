// ============================================================================
// worlds/moon/startWorld.js - the Moon as a row on the opening's arrivals board (src/opening/worlds.js START_WORLDS): the same shape as the Mars and Ceres rows, with
// `status: 'open'`, and the live goods lines from this world's own trade tables. The opening's builder spreads `MOON_START` over its 'coming' placeholder and calls
// `moonGoodsLines()` from `goodsLines('moon')`; facts (size, gravity, day) come from the registry now that the Moon is a built world. Pure data.
// ============================================================================
import { ICE_PRICE, SHOPS } from './trade.js';

export const MOON_START = {
  id: 'moon', status: 'open', factions: ['fortis', 'technos'], port: 'Tranquility Civil Hub', money: 'lunars', startPlace: 'Tranquility Civil Hub, on Mare Tranquillitatis',
  line: 'Two blocs share one rock: the walls and searchlights of Fortis at the south pole, the glass and dishes of Technos Prime on the far side. Everyone lands at the neutral hub between them.',
  good: 'Power, launch mass, security, electronics, comms, and the only ice on the Moon.', lacks: 'Water, food, metal in bulk.',
};

/** The board's goods lines for the Moon, live from the trade tables. */
export function moonGoodsLines() {
  return [
    `Lunar ice ${ICE_PRICE['ice-hub']} marks a tonne at the hub's water office, ${ICE_PRICE['ice-dock']} at the Fortis dock; the shadows at the pole are where it is`,
    `Fab Floor 2 sells spare parts at ${SHOPS['technos-fab'].sells.parts} marks a kit; the Fortis quartermaster pays ${SHOPS['fortis-quartermaster'].buys.parts} for one`,
  ];
}
