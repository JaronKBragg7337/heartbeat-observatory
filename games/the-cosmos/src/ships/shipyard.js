// ============================================================================
// ships/shipyard.js - where a ship can be bought. One yard, at Marineris Port: a kiosk by the hiring board, a short walk from the
// Meridian's pad, selling the classes whose definition carries a price. Pure data (no three.js), read by the server (which checks the
// purchase) and the client (which draws the kiosk and the price board).
// ============================================================================

import { allShipDefs, shipCatalog } from './registry.js';

/** Port-local metres: x right, z toward the south apron (the same frame as src/crew/crewSpec.js HIRE_SPOTS). */
export const SHIPYARD = { name: 'Marineris Shipyard', spot: { x: -36, y: 0, z: 40 }, reach: 14 };

/** The classes for sale: every ship definition that names a price. */
export const forSale = () => allShipDefs().filter((d) => d.stats && Number.isFinite(d.stats.priceCredits)).map((d) => ({ type: d.type, name: d.class, priceCredits: d.stats.priceCredits }));

/** The shop's full cards: every ship that is for sale with its description, picture, price, stats and specs (see ships/_kit/schema.js). */
export const shopCards = () => shipCatalog().filter((c) => c.forSale);
