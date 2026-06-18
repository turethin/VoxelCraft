export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WOOD: 5,
  LEAVES: 6,
  WATER: 7,
  SNOW: 8,
  PLANK: 9,
  BRICK: 10,
  GLASS: 11,
  COBBLE: 12,
  CRAFTING_TABLE: 13,
  BEDROCK: 14,
  COAL_ORE: 15,
} as const;

export type BlockId = number;

export interface BlockDef {
  id: number;
  name: string;
  solid: boolean;
  transparent: boolean;
  liquid: boolean;
  colors: { top: number; side: number; bottom: number };
  hardness: number;
  drop?: string;
  tool?: "pickaxe" | "axe" | "shovel" | "sword" | "none";
}

const C = (top: number, side: number, bottom: number) => ({ top, side, bottom });
const D = (hardness: number, drop?: string, tool?: BlockDef["tool"]) => ({ hardness, drop, tool });

export const BLOCKS: Record<number, BlockDef> = {
  [BLOCK.AIR]: { id: BLOCK.AIR, name: "Air", solid: false, transparent: true, liquid: false, colors: C(0, 0, 0), ...D(0) },
  [BLOCK.GRASS]: { id: BLOCK.GRASS, name: "Grass", solid: true, transparent: false, liquid: false, colors: C(0x4eaa42, 0x7c5a36, 0x6b4a2d), ...D(0.6, "dirt", "shovel") },
  [BLOCK.DIRT]: { id: BLOCK.DIRT, name: "Dirt", solid: true, transparent: false, liquid: false, colors: C(0x7c5a36, 0x7c5a36, 0x7c5a36), ...D(0.5, "dirt", "shovel") },
  [BLOCK.STONE]: { id: BLOCK.STONE, name: "Stone", solid: true, transparent: false, liquid: false, colors: C(0x8a8a8a, 0x8a8a8a, 0x8a8a8a), ...D(1.5, "cobblestone", "pickaxe") },
  [BLOCK.SAND]: { id: BLOCK.SAND, name: "Sand", solid: true, transparent: false, liquid: false, colors: C(0xe6d7a0, 0xe6d7a0, 0xe6d7a0), ...D(0.5, "sand", "shovel") },
  [BLOCK.WOOD]: { id: BLOCK.WOOD, name: "Wood", solid: true, transparent: false, liquid: false, colors: C(0x6b4a2d, 0x4f3724, 0x6b4a2d), ...D(2.0, "wood", "axe") },
  [BLOCK.LEAVES]: { id: BLOCK.LEAVES, name: "Leaves", solid: true, transparent: true, liquid: false, colors: C(0x3a8a2f, 0x3a8a2f, 0x3a8a2f), ...D(0.2, "leaves", "none") },
  [BLOCK.WATER]: { id: BLOCK.WATER, name: "Water", solid: false, transparent: true, liquid: true, colors: C(0x2f6dd6, 0x2f6dd6, 0x2f6dd6), ...D(100) },
  [BLOCK.SNOW]: { id: BLOCK.SNOW, name: "Snow", solid: true, transparent: false, liquid: false, colors: C(0xf5f7fa, 0xf5f7fa, 0xf5f7fa), ...D(0.2, "snow", "shovel") },
  [BLOCK.PLANK]: { id: BLOCK.PLANK, name: "Plank", solid: true, transparent: false, liquid: false, colors: C(0xb8895a, 0xb8895a, 0xb8895a), ...D(2.0, "plank", "axe") },
  [BLOCK.BRICK]: { id: BLOCK.BRICK, name: "Brick", solid: true, transparent: false, liquid: false, colors: C(0x9e3b2e, 0x9e3b2e, 0x9e3b2e), ...D(2.0, "brick", "pickaxe") },
  [BLOCK.GLASS]: { id: BLOCK.GLASS, name: "Glass", solid: true, transparent: true, liquid: false, colors: C(0xbfe3ee, 0xbfe3ee, 0xbfe3ee), ...D(0.3, undefined, "none") },
  [BLOCK.COBBLE]: { id: BLOCK.COBBLE, name: "Cobblestone", solid: true, transparent: false, liquid: false, colors: C(0x6f6f6f, 0x6f6f6f, 0x6f6f6f), ...D(2.0, "cobblestone", "pickaxe") },
  [BLOCK.CRAFTING_TABLE]: { id: BLOCK.CRAFTING_TABLE, name: "Crafting Table", solid: true, transparent: false, liquid: false, colors: C(0x8a5a32, 0x6b4a2d, 0x8a5a32), ...D(2.5, "crafting_table", "axe") },
  [BLOCK.BEDROCK]: { id: BLOCK.BEDROCK, name: "Bedrock", solid: true, transparent: false, liquid: false, colors: C(0x222222, 0x222222, 0x222222), ...D(Infinity) },
  [BLOCK.COAL_ORE]: { id: BLOCK.COAL_ORE, name: "Coal Ore", solid: true, transparent: false, liquid: false, colors: C(0x444444, 0x444444, 0x444444), ...D(3.0, "coal", "pickaxe") },
};

export const BLOCK_NAME_TO_ID: Record<string, number> = {};
for (const k of Object.keys(BLOCKS)) {
  const id = Number(k);
  BLOCK_NAME_TO_ID[BLOCKS[id].name.toLowerCase().replace(/\s+/g, "_")] = id;
}

export function isSolid(id: BlockId): boolean {
  return BLOCKS[id]?.solid ?? false;
}
export function isOpaque(id: BlockId): boolean {
  const d = BLOCKS[id];
  return !!d && d.solid && !d.transparent;
}
