import { BLOCKS, BLOCK_NAME_TO_ID } from "./blocks.js";

export type ItemKind = "block" | "tool" | "material" | "food";
export type ToolType = "pickaxe" | "axe" | "shovel" | "sword";
export type ToolTier = "wood" | "stone" | "iron";

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  maxStack: number;
  color: number;
  icon?: string;
  blockId?: number;
  toolType?: ToolType;
  tier?: ToolTier;
  attackDamage?: number;
  miningSpeed?: number;
  heal?: number;
  saturation?: number;
}

const TIER_SPEED: Record<ToolTier, number> = { wood: 2, stone: 4, iron: 6 };
const TIER_DMG: Record<ToolTier, number> = { wood: 0, stone: 1, iron: 2 };

function def(d: ItemDef): ItemDef {
  return d;
}

export const ITEMS: Record<string, ItemDef> = {};

function register(d: ItemDef) {
  ITEMS[d.id] = d;
}

// Block items — auto-generated from BLOCKS (skip air/water)
for (const k of Object.keys(BLOCKS)) {
  const id = Number(k);
  const b = BLOCKS[id];
  if (b.name === "Air" || b.name === "Water") continue;
  const itemId = b.name.toLowerCase().replace(/\s+/g, "_");
  register(def({
    id: itemId,
    name: b.name,
    kind: "block",
    maxStack: 64,
    color: b.colors.top,
    blockId: id,
  }));
}

// Materials
register(def({ id: "stick", name: "Stick", kind: "material", maxStack: 64, color: 0x8a5a32 }));
register(def({ id: "coal", name: "Coal", kind: "material", maxStack: 64, color: 0x1a1a1a }));
register(def({ id: "feather", name: "Feather", kind: "material", maxStack: 64, color: 0xeeeeee }));
register(def({ id: "egg", name: "Egg", kind: "material", maxStack: 16, color: 0xf5e6c4 }));

// Food
register(def({ id: "apple", name: "Apple", kind: "food", maxStack: 64, color: 0xd63030, heal: 4, saturation: 2.4 }));
register(def({ id: "raw_chicken", name: "Raw Chicken", kind: "food", maxStack: 64, color: 0xe8b8b0, heal: 2, saturation: 0.6 }));
register(def({ id: "cooked_chicken", name: "Cooked Chicken", kind: "food", maxStack: 64, color: 0xc97f4a, heal: 6, saturation: 6 }));
register(def({ id: "rotten_flesh", name: "Rotten Flesh", kind: "food", maxStack: 64, color: 0x6b5a4a, heal: 4, saturation: 0.8 }));

// Tools
function makeTool(type: ToolType, tier: ToolTier) {
  const baseDmg = type === "sword" ? 3 : type === "axe" ? 2 : 1;
  register(def({
    id: `${tier}_${type}`,
    name: `${tier[0].toUpperCase() + tier.slice(1)} ${type[0].toUpperCase() + type.slice(1)}`,
    kind: "tool",
    maxStack: 1,
    color: tier === "wood" ? 0x8a5a32 : tier === "stone" ? 0x8a8a8a : 0xdedede,
    toolType: type,
    tier,
    attackDamage: baseDmg + TIER_DMG[tier],
    miningSpeed: TIER_SPEED[tier],
  }));
}

for (const tier of ["wood", "stone", "iron"] as ToolTier[]) {
  for (const type of ["pickaxe", "axe", "shovel", "sword"] as ToolType[]) {
    makeTool(type, tier);
  }
}

export function getItem(id: string): ItemDef | undefined {
  return ITEMS[id];
}

export interface ItemStack {
  id: string;
  count: number;
}

export function stackEq(a: ItemStack | null, b: ItemStack | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.id === b.id;
}

export function blockIdToItemId(blockId: number): string | null {
  const b = BLOCKS[blockId];
  if (!b || b.name === "Air" || b.name === "Water") return null;
  return b.name.toLowerCase().replace(/\s+/g, "_");
}

export function itemIdToBlockId(itemId: string): number | null {
  const it = ITEMS[itemId];
  return it?.blockId ?? null;
}

void BLOCK_NAME_TO_ID;
