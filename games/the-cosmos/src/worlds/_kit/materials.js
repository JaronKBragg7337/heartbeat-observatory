// ============================================================================
// worlds/_kit/materials.js - a world's own ground materials, made from a few numbers.
//
// A world that is not Mars, Phobos or Deimos may bring its own regolith and rubble (and any extra layer it wants, e.g. a clay or
// ice pocket). Return value goes in the def as `materials: groundMaterials({...})`. The registry appends them to the global
// MATERIALS table in worldIndex order (see registry.js): dug ground stores a material as its position in that table, so the table
// only ever grows at its end and the numbers of older materials never move.
// ============================================================================

const up = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '-');

/**
 * @param o { key: 'fortis' (id used in MAT-<KEY>-...), name: 'Fortis', regolithColor, rubbleColor, regolithKgM3?, rubbleKgM3?, note? }
 * @returns { regolith, rubble } material objects in the shape field.js's MATERIALS use
 */
export function groundMaterials(o) {
  const K = up(o.key);
  return {
    regolith: { id: `MAT-${K}-REGOLITH`, name: `${o.name} regolith`, densityKgM3: o.regolithKgM3 ?? 1300, strength: o.regolithStrength ?? 0.12,
      color: o.regolithColor, roughness: 0.96, note: o.note || `The loose surface layer of ${o.name}.` },
    rubble: { id: `MAT-${K}-RUBBLE`, name: `${o.name} rubble`, densityKgM3: o.rubbleKgM3 ?? 1900, strength: o.rubbleStrength ?? 0.35,
      color: o.rubbleColor ?? o.regolithColor, roughness: 0.92, note: `Broken rock under the loose layer of ${o.name}.` },
  };
}

/** One extra layer (a pocket of something): same shape, an id of your own. */
export const extraMaterial = (id, name, densityKgM3, strength, color, note = '') => ({ id, name, densityKgM3, strength, color, roughness: 0.9, note });
