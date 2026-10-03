// vehicles/registry.js — every vehicle type, looked up by the `type` string on its record.
// A vehicle definition is data. The server never loads a renderer from here.

import { SURVEY } from './survey/def.js';

const DEFS = new Map([SURVEY].map((d) => [d.type, d]));

/** The definition for a vehicle type. An unknown type throws. */
export function vehicleDef(type) {
  const d = DEFS.get(type);
  if (!d) throw new Error(`Unknown vehicle type: ${type}`);
  return d;
}

export const vehicleTypes = () => [...DEFS.keys()];
