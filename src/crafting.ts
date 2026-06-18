import { ItemStack } from "./items.js";

export interface ShapedRecipe {
  pattern: string[];
  key: Record<string, string>;
  result: ItemStack;
}

export interface ShapelessRecipe {
  ingredients: string[];
  result: ItemStack;
}

export const SHAPED_RECIPES: ShapedRecipe[] = [
  // Planks: 1 wood -> 4 planks
  { pattern: ["W"], key: { W: "wood" }, result: { id: "plank", count: 4 } },
  // Sticks: 2 planks vertical
  { pattern: ["P", "P"], key: { P: "plank" }, result: { id: "stick", count: 4 } },
  // Crafting table: 2x2 planks
  { pattern: ["PP", "PP"], key: { P: "plank" }, result: { id: "crafting_table", count: 1 } },
  // Cobble -> stone? no. Tools:
  // Wooden pickaxe
  { pattern: ["PPP", " S ", " S "], key: { P: "plank", S: "stick" }, result: { id: "wood_pickaxe", count: 1 } },
  { pattern: ["PP", "PS", " S"], key: { P: "plank", S: "stick" }, result: { id: "wood_axe", count: 1 } },
  { pattern: ["P", "S", "S"], key: { P: "plank", S: "stick" }, result: { id: "wood_shovel", count: 1 } },
  { pattern: ["P", "P", "S"], key: { P: "plank", S: "stick" }, result: { id: "wood_sword", count: 1 } },
  // Stone tools (use cobblestone)
  { pattern: ["CCC", " S ", " S "], key: { C: "cobblestone", S: "stick" }, result: { id: "stone_pickaxe", count: 1 } },
  { pattern: ["CC", "CS", " S"], key: { C: "cobblestone", S: "stick" }, result: { id: "stone_axe", count: 1 } },
  { pattern: ["C", "S", "S"], key: { C: "cobblestone", S: "stick" }, result: { id: "stone_shovel", count: 1 } },
  { pattern: ["C", "C", "S"], key: { C: "cobblestone", S: "stick" }, result: { id: "stone_sword", count: 1 } },
  // Brick from cobble? no. Brick block from... use 4 cobble -> 1 brick block? Actually brick is clay. Keep brick obtainable via place. Skip.
  // Glass from sand? needs furnace — skip, place directly.
];

export const SHAPELESS_RECIPES: ShapelessRecipe[] = [];

// Trim a 2D grid to its bounding box (rows/cols with any non-null).
function trim(grid: (string | null)[][]): { trimmed: (string | null)[][]; w: number; h: number } | null {
  const h = grid.length;
  if (h === 0) return null;
  const w = grid[0].length;
  let minR = h, maxR = -1, minC = w, maxC = -1;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (grid[r][c]) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }
  if (maxR < 0) return null;
  const out: (string | null)[][] = [];
  for (let r = minR; r <= maxR; r++) {
    const row: (string | null)[] = [];
    for (let c = minC; c <= maxC; c++) row.push(grid[r][c]);
    out.push(row);
  }
  return { trimmed: out, w: maxC - minC + 1, h: maxR - minR + 1 };
}

// Convert a recipe pattern into a normalized item-grid for comparison.
function patternToGrid(recipe: ShapedRecipe): (string | null)[][] {
  return recipe.pattern.map((row) =>
    row.split("").map((ch) => (ch === " " ? null : recipe.key[ch] ?? null))
  );
}

function gridsEqual(a: (string | null)[][], b: (string | null)[][]): boolean {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    if (a[r].length !== b[r].length) return false;
    for (let c = 0; c < a[r].length; c++) {
      if ((a[r][c] ?? null) !== (b[r][c] ?? null)) return false;
    }
  }
  return true;
}

// Match a crafting grid (size x size) of item ids (null = empty). Returns result or null.
export function matchCrafting(grid: (string | null)[][], size: number): ItemStack | null {
  // Shapeless: count ingredients regardless of position
  const flat: string[] = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const id = grid[r]?.[c] ?? null;
    if (id) flat.push(id);
  }
  for (const rec of SHAPELESS_RECIPES) {
    if (flat.length !== rec.ingredients.length) continue;
    const need = [...rec.ingredients];
    let ok = true;
    for (const id of flat) {
      const idx = need.indexOf(id);
      if (idx < 0) { ok = false; break; }
      need.splice(idx, 1);
    }
    if (ok && need.length === 0) return { ...rec.result };
  }

  // Shaped: trim input grid to bounding box, compare to each recipe's pattern grid.
  const trimmed = trim(grid.slice(0, size).map((row) => row.slice(0, size)));
  if (!trimmed) return null;
  for (const rec of SHAPED_RECIPES) {
    const rg = patternToGrid(rec);
    if (gridsEqual(rg, trimmed.trimmed)) return { ...rec.result };
  }
  return null;
}
