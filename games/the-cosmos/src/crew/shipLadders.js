// The Meridian's two ladders, straight from the layout (not copied: if a ladder moves, the crew's route moves with it).
import { buildLayout } from '../ship/shipSpec.js';
export const LADDERS_BY_ID = Object.fromEntries(buildLayout().ladders.map((l) => [l.id, l]));
