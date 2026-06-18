import * as THREE from "three";
import { BLOCK } from "./blocks.js";

const TILE = 32;
const N = 8;
const SIZE = TILE * N;

// Tile indices in the atlas (row-major, row 0 = top of canvas)
const T = {
  grass_top: 0,
  grass_side: 1,
  dirt: 2,
  stone: 3,
  sand: 4,
  wood_top: 5,
  wood_side: 6,
  leaves: 7,
  snow: 8,
  plank: 9,
  brick: 10,
  glass: 11,
  cobble: 12,
  crafting_top: 13,
  crafting_side: 14,
  bedrock: 15,
  coal_ore: 16,
} as const;

// --- value noise ---
function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 0x9e3779b9)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function fbm(x: number, y: number, seed: number, oct = 4): number {
  let f = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < oct; i++) { f += amp * vnoise(x * freq, y * freq, seed + i); amp *= 0.5; freq *= 2; }
  return f;
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

type Pix = (lx: number, ly: number) => [number, number, number, number];

function grassTop(): Pix {
  return (x, y) => {
    const n = fbm(x * 0.25, y * 0.25, 11, 4);
    const blade = vnoise(x * 1.3, y * 1.3, 7) > 0.7 ? 20 : 0;
    const r = clamp(70 + n * 50 + blade, 0, 255);
    const g = clamp(135 + n * 60 + blade, 0, 255);
    const b = clamp(50 + n * 30, 0, 255);
    return [r, g, b, 255];
  };
}
function dirt(): Pix {
  return (x, y) => {
    const n = fbm(x * 0.3, y * 0.3, 21, 4);
    const pebble = vnoise(x * 1.7, y * 1.7, 5) > 0.78 ? -30 : 0;
    const r = clamp(120 + n * 35 + pebble, 0, 255);
    const g = clamp(85 + n * 28 + pebble, 0, 255);
    const b = clamp(55 + n * 22 + pebble, 0, 255);
    return [r, g, b, 255];
  };
}
function grassSide(): Pix {
  const d = dirt();
  return (x, y) => {
    const boundary = 5 + Math.floor(vnoise(x * 0.4, 0, 3) * 4);
    if (y < boundary) {
      const n = fbm(x * 0.25, y * 0.25, 11, 3);
      return [clamp(70 + n * 50, 0, 255), clamp(135 + n * 60, 0, 255), clamp(50 + n * 30, 0, 255), 255];
    }
    return d(x, y);
  };
}
function stone(): Pix {
  return (x, y) => {
    const n = fbm(x * 0.2, y * 0.2, 31, 4);
    const crack = vnoise(x * 0.5, y * 0.5, 9) > 0.85 ? -35 : 0;
    const v = clamp(125 + n * 40 + crack, 0, 255);
    return [v, v, v * 0.98, 255];
  };
}
function sand(): Pix {
  return (x, y) => {
    const n = fbm(x * 0.35, y * 0.35, 41, 4);
    const r = clamp(218 + n * 30, 0, 255);
    const g = clamp(200 + n * 28, 0, 255);
    const b = clamp(145 + n * 22, 0, 255);
    return [r, g, b, 255];
  };
}
function woodTop(): Pix {
  const cx = 15.5, cy = 15.5;
  return (x, y) => {
    const dx = x - cx, dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const ring = Math.sin(dist * 1.3) * 0.5 + 0.5;
    const n = vnoise(x * 0.3, y * 0.3, 51) * 0.3;
    const base = 110 + ring * 40 + n * 30;
    return [clamp(base * 1.0, 0, 255), clamp(base * 0.72, 0, 255), clamp(base * 0.42, 0, 255), 255];
  };
}
function woodSide(): Pix {
  return (x, y) => {
    const streak = fbm(x * 0.15, y * 0.6, 61, 4);
    const line = vnoise(x * 3, y * 0.05, 13) > 0.8 ? -25 : 0;
    const base = 100 + streak * 45 + line;
    return [clamp(base, 0, 255), clamp(base * 0.72, 0, 255), clamp(base * 0.42, 0, 255), 255];
  };
}
function plank(): Pix {
  return (x, y) => {
    const row = Math.floor(y / 16);
    const grain = fbm(x * 0.4, y * 0.08, 71, 3);
    const seam = (y % 16 === 0) ? -45 : 0;
    const base = 165 + grain * 40 + seam + (row ? 8 : 0);
    return [clamp(base, 0, 255), clamp(base * 0.76, 0, 255), clamp(base * 0.5, 0, 255), 255];
  };
}
function leaves(): Pix {
  return (x, y) => {
    const n = fbm(x * 0.4, y * 0.4, 81, 4);
    if (n < 0.32) return [0, 0, 0, 0]; // hole
    const m = vnoise(x * 1.5, y * 1.5, 17) * 0.3;
    return [clamp(55 + n * 40 + m * 30, 0, 255), clamp(120 + n * 50 + m * 30, 0, 255), clamp(45 + n * 25, 0, 255), 255];
  };
}
function snow(): Pix {
  return (x, y) => {
    const n = fbm(x * 0.3, y * 0.3, 91, 3);
    return [clamp(242 + n * 12, 0, 255), clamp(246 + n * 10, 0, 255), clamp(250 + n * 6, 0, 255), 255];
  };
}
function brick(): Pix {
  return (x, y) => {
    const row = Math.floor(y / 8);
    const offset = (row % 2) * 8;
    const bx = (x + offset) % 16;
    const mortar = (y % 8 === 0) || (bx === 0);
    if (mortar) return [190, 185, 178, 255];
    const n = vnoise(x * 0.5, y * 0.5, 23) * 0.25;
    return [clamp(150 + n * 40, 0, 255), clamp(58 + n * 20, 0, 255), clamp(48 + n * 16, 0, 255), 255];
  };
}
function glass(): Pix {
  return (x, y) => {
    const border = x < 2 || x > 29 || y < 2 || y > 29;
    const n = vnoise(x * 0.3, y * 0.3, 33) * 0.15;
    if (border) return [235, 245, 250, 255];
    return [clamp(180 + n * 40, 0, 255), clamp(225 + n * 25, 0, 255), clamp(235 + n * 20, 0, 255), 255];
  };
}
function cobble(): Pix {
  return (x, y) => {
    const n = fbm(x * 0.3, y * 0.3, 43, 4);
    if (n < 0.42) return [60, 60, 60, 255]; // gap
    const m = vnoise(x * 0.8, y * 0.8, 19) * 0.3;
    const v = clamp(120 + n * 50 + m * 30, 0, 255);
    return [v, v, v * 0.98, 255];
  };
}
function craftingTop(): Pix {
  const p = plank();
  return (x, y) => {
    const gridLine = (x % 10 === 0) || (y % 10 === 0);
    const base = p(x, y);
    if (gridLine) return [50, 35, 22, 255];
    return base;
  };
}
function craftingSide(): Pix {
  const p = plank();
  return (x, y) => {
    const top = y < 3;
    const base = p(x, y);
    if (top) return [60, 42, 26, 255];
    return base;
  };
}
function bedrock(): Pix {
  return (x, y) => {
    const n = vnoise(x * 0.8, y * 0.8, 53);
    const v = clamp(35 + n * 70, 0, 255);
    return [v, v, v, 255];
  };
}
function coalOre(): Pix {
  const s = stone();
  return (x, y) => {
    const n = fbm(x * 0.5, y * 0.5, 73, 4);
    if (n > 0.62) {
      const m = vnoise(x * 1.2, y * 1.2, 29) * 0.3;
      return [clamp(25 + m * 30, 0, 255), clamp(25 + m * 30, 0, 255), clamp(28 + m * 30, 0, 255), 255];
    }
    return s(x, y);
  };
}

const TILES: Record<number, Pix> = {
  [T.grass_top]: grassTop(),
  [T.grass_side]: grassSide(),
  [T.dirt]: dirt(),
  [T.stone]: stone(),
  [T.sand]: sand(),
  [T.wood_top]: woodTop(),
  [T.wood_side]: woodSide(),
  [T.leaves]: leaves(),
  [T.snow]: snow(),
  [T.plank]: plank(),
  [T.brick]: brick(),
  [T.glass]: glass(),
  [T.cobble]: cobble(),
  [T.crafting_top]: craftingTop(),
  [T.crafting_side]: craftingSide(),
  [T.bedrock]: bedrock(),
  [T.coal_ore]: coalOre(),
};

function tileForBlock(blockId: number, face: "top" | "side" | "bottom"): number {
  switch (blockId) {
    case BLOCK.GRASS: return face === "top" ? T.grass_top : face === "bottom" ? T.dirt : T.grass_side;
    case BLOCK.DIRT: return T.dirt;
    case BLOCK.STONE: return T.stone;
    case BLOCK.SAND: return T.sand;
    case BLOCK.WOOD: return face === "side" ? T.wood_side : T.wood_top;
    case BLOCK.LEAVES: return T.leaves;
    case BLOCK.SNOW: return T.snow;
    case BLOCK.PLANK: return T.plank;
    case BLOCK.BRICK: return T.brick;
    case BLOCK.GLASS: return T.glass;
    case BLOCK.COBBLE: return T.cobble;
    case BLOCK.CRAFTING_TABLE: return face === "top" ? T.crafting_top : face === "bottom" ? T.plank : T.crafting_side;
    case BLOCK.BEDROCK: return T.bedrock;
    case BLOCK.COAL_ORE: return T.coal_ore;
    default: return T.stone;
  }
}

let cachedTexture: THREE.Texture | null = null;

export function getAtlasTexture(): THREE.Texture {
  if (cachedTexture) return cachedTexture;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(SIZE, SIZE);
  for (let idx = 0; idx < N * N; idx++) {
    const col = idx % N, row = Math.floor(idx / N);
    const pix = TILES[idx];
    if (!pix) continue;
    for (let ly = 0; ly < TILE; ly++) {
      for (let lx = 0; lx < TILE; lx++) {
        const [r, g, b, a] = pix(lx, ly);
        const px = col * TILE + lx;
        const py = row * TILE + ly;
        const o = (py * SIZE + px) * 4;
        img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = a;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cachedTexture = tex;
  return tex;
}

const PAD = 0.5 / SIZE;

export function tileRect(blockId: number, face: "top" | "side" | "bottom"): { u0: number; v0: number; u1: number; v1: number } {
  const idx = tileForBlock(blockId, face);
  const col = idx % N;
  const row = Math.floor(idx / N);
  const u0 = col / N + PAD;
  const u1 = (col + 1) / N - PAD;
  // flipY=true (CanvasTexture default): canvas row 0 (top) -> high v
  const vTop = 1 - row / N - PAD;
  const vBottom = 1 - (row + 1) / N + PAD;
  return { u0, v0: vBottom, u1, v1: vTop };
}
