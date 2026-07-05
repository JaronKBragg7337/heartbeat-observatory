// ============================================================================
// crafting/recipes.js — Crafting recipe registry and crafting actions.
//
// OWNS: recipe definitions (what inputs -> what output) and the craft() action.
// DOES NOT OWN: item definitions (items.js), inventory (inventory.js), or UI.
//
// INTEGRATION: Import in main.js and wire to a crafting panel in ui.js.
//   import { RECIPES, craft } from './crafting/recipes.js';
//
// Architecture: recipes are pure data. craft() is a pure function that mutates
// inventory and returns { ok, msg, recipe }.
// ============================================================================

export const RECIPES = [
  // --- Refining ---
  {
    id: 'refine_titanium',
    name: 'Refine Titanium Ore',
    category: 'refining',
    inputs: { titanium_ore: 2, salvage_alloy: 1 },
    output: { itemId: 'titanium_ingot', count: 1 },
    description: 'Smelt titanium ore into usable ingots.',
  },
  {
    id: 'crack_ice',
    name: 'Crack Water Ice',
    category: 'refining',
    inputs: { water_ice: 2 },
    output: { itemId: 'hydrogen_cracked', count: 1 },
    description: 'Electrolyze water ice into high-grade hydrogen fuel.',
  },
  {
    id: 'stabilize_crystal',
    name: 'Stabilize Crystal Matrix',
    category: 'refining',
    inputs: { crystal_matrix: 2, wiring_loom: 1 },
    output: { itemId: 'sensor_crystal', count: 1 },
    description: 'Stabilize raw crystal matrix for sensor use.',
  },
  {
    id: 'forge_composite',
    name: 'Forge Composite Alloy',
    category: 'refining',
    inputs: { titanium_ingot: 1, nickel_iron: 2, salvage_alloy: 1 },
    output: { itemId: 'alloy_composite', count: 1 },
    description: 'Layer titanium and nickel-iron into heavy composite.',
  },
  {
    id: 'manufacture_circuit',
    name: 'Manufacture Circuit Board',
    category: 'refining',
    inputs: { scrap_electronics: 2, wiring_loom: 1 },
    output: { itemId: 'circuit_board', count: 1 },
    description: 'Assemble working circuit boards from scrap.',
  },

  // --- Manufacturing: Ship Parts ---
  {
    id: 'build_reactor',
    name: 'Build Fusion Reactor',
    category: 'manufacturing',
    inputs: { reactor_core: 1, titanium_ingot: 3, circuit_board: 2 },
    output: { itemId: 'part_reactor', count: 1 },
    description: 'Assemble a fusion reactor module.',
  },
  {
    id: 'build_shield',
    name: 'Build Shield Generator',
    category: 'manufacturing',
    inputs: { sensor_crystal: 2, circuit_board: 2, titanium_ingot: 2 },
    output: { itemId: 'part_shield', count: 1 },
    description: 'Assemble an energy shield projector.',
  },
  {
    id: 'build_scanner',
    name: 'Build Sensor Array',
    category: 'manufacturing',
    inputs: { sensor_crystal: 1, circuit_board: 2, wiring_loom: 1 },
    output: { itemId: 'part_scanner', count: 1 },
    description: 'Assemble a long-range sensor array.',
  },
  {
    id: 'build_radiator',
    name: 'Build Heat Radiator',
    category: 'manufacturing',
    inputs: { titanium_ingot: 2, alloy_composite: 1 },
    output: { itemId: 'part_radiator', count: 1 },
    description: 'Assemble a thermal radiator system.',
  },
  {
    id: 'build_adv_engine',
    name: 'Build Advanced Thruster',
    category: 'manufacturing',
    inputs: { titanium_ingot: 4, reactor_core: 1, circuit_board: 1 },
    output: { itemId: 'part_adv_engine', count: 1 },
    description: 'Assemble a high-efficiency main thruster.',
  },
  {
    id: 'build_maneuver',
    name: 'Build Maneuvering Thrusters',
    category: 'manufacturing',
    inputs: { titanium_ingot: 1, circuit_board: 1, wiring_loom: 1 },
    output: { itemId: 'part_maneuver', count: 1 },
    description: 'Assemble attitude control thrusters.',
  },
  {
    id: 'build_weapon',
    name: 'Build Weapon Hardpoint',
    category: 'manufacturing',
    inputs: { alloy_composite: 2, titanium_ingot: 2, circuit_board: 1 },
    output: { itemId: 'part_weapon', count: 1 },
    description: 'Assemble a kinetic weapon mount.',
  },
  {
    id: 'build_cargo_adv',
    name: 'Build Reinforced Cargo Pod',
    category: 'manufacturing',
    inputs: { alloy_composite: 2, titanium_ingot: 2, wiring_loom: 1 },
    output: { itemId: 'part_cargo_adv', count: 1 },
    description: 'Assemble a heavy-duty cargo container.',
  },
  {
    id: 'build_hull_heavy',
    name: 'Build Heavy Armor Plating',
    category: 'manufacturing',
    inputs: { alloy_composite: 3, titanium_ingot: 2 },
    output: { itemId: 'part_hull_heavy', count: 1 },
    description: 'Forge thick composite armor plates.',
  },

  // --- Emergency / Field ---
  {
    id: 'field_repair_alloy',
    name: 'Field Repair: Alloy',
    category: 'field',
    inputs: { salvage_alloy: 1 },
    output: { itemId: 'salvage_alloy', count: 1 },
    description: 'Reprocess damaged alloy into usable material. (No net gain — emergency only.)',
  },
];

export function getRecipe(id) {
  const r = RECIPES.find((x) => x.id === id);
  if (!r) throw new Error(`Unknown recipe: ${id}`);
  return r;
}

export function listRecipes(category = null) {
  if (!category) return RECIPES;
  return RECIPES.filter((r) => r.category === category);
}

// Craft an item from inventory. Returns { ok, msg, recipe }.
export function craft(inventory, recipeId) {
  const recipe = RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return { ok: false, msg: 'Unknown recipe.' };

  // Check inputs
  for (const [itemId, count] of Object.entries(recipe.inputs)) {
    if (!inventory.has(itemId, count)) {
      return { ok: false, msg: `Need ${count}x ${itemId} for ${recipe.name}.` };
    }
  }

  // Consume inputs
  for (const [itemId, count] of Object.entries(recipe.inputs)) {
    inventory.remove(itemId, count);
  }

  // Produce output
  inventory.add(recipe.output.itemId, recipe.output.count);

  return { ok: true, msg: `Crafted ${recipe.output.count}x ${recipe.output.itemId}.`, recipe };
}

// Check what recipes are currently craftable given inventory contents.
export function availableRecipes(inventory) {
  return RECIPES.filter((r) => {
    for (const [itemId, count] of Object.entries(r.inputs)) {
      if (!inventory.has(itemId, count)) return false;
    }
    return true;
  });
}
