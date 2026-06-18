import { createNoise2D, createNoise3D } from "simplex-noise";
import alea from "./alea.js";
import { BLOCK, BLOCKS, BlockId, isOpaque } from "../blocks.js";
import { tileRect } from "../textureGenerator.js";
import * as THREE from "three";

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 64;
export const SEA_LEVEL = 20;

const FACES = [
  { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], normal: [1, 0, 0], face: "side", uv: [[0, 0], [0, 1], [1, 1], [1, 0]] },
  { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], normal: [-1, 0, 0], face: "side", uv: [[1, 0], [1, 1], [0, 1], [0, 0]] },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], normal: [0, 1, 0], face: "top", uv: [[0, 1], [1, 1], [1, 0], [0, 0]] },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], normal: [0, -1, 0], face: "bottom", uv: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  { dir: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], normal: [0, 0, 1], face: "side", uv: [[1, 0], [1, 1], [0, 1], [0, 0]] },
  { dir: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], normal: [0, 0, -1], face: "side", uv: [[0, 0], [0, 1], [1, 1], [1, 0]] },
];

interface ChunkMeshData {
  positions: number[];
  normals: number[];
  colors: number[];
  uvs: number[];
  indices: number[];
}

export class World {
  readonly chunksX: number;
  readonly chunksZ: number;
  readonly sizeX: number;
  readonly sizeZ: number;
  private data: Uint8Array;
  private noise2D: ReturnType<typeof createNoise2D>;
  private noise2Dc: ReturnType<typeof createNoise2D>;
  private noise3D: ReturnType<typeof createNoise3D>;

  constructor(seed: number, chunksX = 6, chunksZ = 6) {
    this.chunksX = chunksX;
    this.chunksZ = chunksZ;
    this.sizeX = chunksX * CHUNK_SIZE;
    this.sizeZ = chunksZ * CHUNK_SIZE;
    this.data = new Uint8Array(this.sizeX * WORLD_HEIGHT * this.sizeZ);
    const prng = alea(seed);
    this.noise2D = createNoise2D(prng);
    this.noise2Dc = createNoise2D(alea(seed + 9999));
    this.noise3D = createNoise3D(alea(seed + 1));
    this.generate();
  }

  private idx(x: number, y: number, z: number): number {
    return (y * this.sizeZ + z) * this.sizeX + x;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < this.sizeX && y >= 0 && y < WORLD_HEIGHT && z >= 0 && z < this.sizeZ;
  }

  getBlock(x: number, y: number, z: number): BlockId {
    if (!this.inBounds(x, y, z)) return BLOCK.AIR;
    return this.data[this.idx(x, y, z)];
  }

  setBlock(x: number, y: number, z: number, id: BlockId): void {
    if (!this.inBounds(x, y, z)) return;
    this.data[this.idx(x, y, z)] = id;
  }

  private generate(): void {
    const sx = this.sizeX;
    const sz = this.sizeZ;
    const baseFreq = 0.018;
    const detailFreq = 0.05;
    const mountainFreq = 0.008;

    for (let x = 0; x < sx; x++) {
      for (let z = 0; z < sz; z++) {
        const base = this.noise2D(x * baseFreq, z * baseFreq);
        const detail = this.noise2Dc(x * detailFreq, z * detailFreq) * 0.5;
        const mountain = Math.max(0, this.noise2D(x * mountainFreq + 100, z * mountainFreq + 100)) * 22;
        const h = Math.floor(SEA_LEVEL + 2 + base * 8 + detail * 4 + mountain);
        for (let y = 0; y <= Math.min(h, WORLD_HEIGHT - 1); y++) {
          let block: BlockId = BLOCK.STONE;
          const depth = h - y;
          if (h >= WORLD_HEIGHT - 8) {
            block = BLOCK.SNOW;
          } else if (depth === 0) {
            block = h <= SEA_LEVEL + 1 ? BLOCK.SAND : BLOCK.GRASS;
          } else if (depth <= 3) {
            block = h <= SEA_LEVEL + 1 ? BLOCK.SAND : BLOCK.DIRT;
          }
          this.data[this.idx(x, y, z)] = block;
        }
        for (let y = h + 1; y <= SEA_LEVEL; y++) {
          this.data[this.idx(x, y, z)] = BLOCK.WATER;
        }
      }
    }

    this.placeTrees();
  }

  private placeTrees(): void {
    const treeRng = alea(this.chunksX * 7919 + this.chunksZ);
    for (let x = 2; x < this.sizeX - 2; x++) {
      for (let z = 2; z < this.sizeZ - 2; z++) {
        if (treeRng() > 0.012) continue;
        let groundY = -1;
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
          const b = this.data[this.idx(x, y, z)];
          if (b === BLOCK.GRASS) { groundY = y; break; }
          if (b !== BLOCK.AIR && b !== BLOCK.WATER) break;
        }
        if (groundY < 0 || groundY < SEA_LEVEL) continue;
        const trunk = 4 + Math.floor(treeRng() * 2);
        for (let i = 1; i <= trunk; i++) {
          this.data[this.idx(x, groundY + i, z)] = BLOCK.WOOD;
        }
        const topY = groundY + trunk;
        for (let dy = -1; dy <= 1; dy++) {
          const r = dy === 1 ? 1 : 2;
          for (let dx = -r; dx <= r; dx++) {
            for (let dz = -r; dz <= r; dz++) {
              if (dx === 0 && dz === 0 && dy < 1) continue;
              const lx = x + dx, ly = topY + dy, lz = z + dz;
              if (!this.inBounds(lx, ly, lz)) continue;
              if (this.data[this.idx(lx, ly, lz)] === BLOCK.AIR) {
                this.data[this.idx(lx, ly, lz)] = BLOCK.LEAVES;
              }
            }
          }
        }
        this.data[this.idx(x, topY + 1, z)] = BLOCK.LEAVES;
      }
    }
  }

  private isFaceVisible(x: number, y: number, z: number, self: BlockId): boolean {
    const nb = this.getBlock(x, y, z);
    if (nb === BLOCK.AIR) return true;
    const nbDef = BLOCKS[nb];
    const selfDef = BLOCKS[self];
    if (nbDef.transparent && nb !== self) return true;
    if (selfDef.transparent && nb === self) return false;
    return nbDef.transparent;
  }

  buildMesh(): { opaque: THREE.BufferGeometry; water: THREE.BufferGeometry; transparent: THREE.BufferGeometry } {
    const opaque: ChunkMeshData = { positions: [], normals: [], colors: [], uvs: [], indices: [] };
    const water: ChunkMeshData = { positions: [], normals: [], colors: [], uvs: [], indices: [] };
    const trans: ChunkMeshData = { positions: [], normals: [], colors: [], uvs: [], indices: [] };

    const addQuad = (
      target: ChunkMeshData,
      x: number, y: number, z: number,
      corners: number[][],
      normal: number[],
      lightFactors: number[],
      rect: { u0: number; v0: number; u1: number; v1: number } | null,
      localUV: number[][]
    ) => {
      const start = target.positions.length / 3;
      for (let i = 0; i < 4; i++) {
        const c = corners[i];
        target.positions.push(x + c[0], y + c[1], z + c[2]);
        target.normals.push(normal[0], normal[1], normal[2]);
        const lf = lightFactors[i];
        target.colors.push(lf, lf, lf);
        if (rect) {
          target.uvs.push(rect.u0 + localUV[i][0] * (rect.u1 - rect.u0), rect.v0 + localUV[i][1] * (rect.v1 - rect.v0));
        } else {
          target.uvs.push(0, 0);
        }
      }
      target.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    };

    // Directional face shading factor (applied as grayscale vertex color, multiplied onto texture)
    const faceShade = (ny: number, nx: number, nz: number): number =>
      ny > 0 ? 1.0 : ny < 0 ? 0.62 : (nx !== 0 ? 0.8 : nz !== 0 ? 0.9 : 1.0);

    // Per-corner ambient occlusion: sample the 3 neighbor blocks on the air side of the face.
    const occ = (p: number[]) => (isOpaque(this.getBlock(p[0], p[1], p[2])) ? 1 : 0);
    const aoForFace = (x: number, y: number, z: number, dir: number[], corners: number[][]): number[] => {
      const base = [x + dir[0], y + dir[1], z + dir[2]];
      const out: number[] = [];
      for (const c of corners) {
        const tangents: number[] = [];
        const signs: number[] = [];
        for (let a = 0; a < 3; a++) {
          if (dir[a] !== 0) continue;
          tangents.push(a);
          signs.push(c[a] === 0 ? -1 : 1);
        }
        const a1 = tangents[0], a2 = tangents[1];
        const s1 = signs[0], s2 = signs[1];
        const side1 = [base[0], base[1], base[2]]; side1[a1] += s1;
        const side2 = [base[0], base[1], base[2]]; side2[a2] += s2;
        const cor = [base[0], base[1], base[2]]; cor[a1] += s1; cor[a2] += s2;
        const o1 = occ(side1), o2 = occ(side2), oc = occ(cor);
        const level = o1 && o2 ? 0 : 3 - (o1 + o2 + oc);
        out.push(0.45 + (level / 3) * 0.55);
      }
      return out;
    };

    for (let x = 0; x < this.sizeX; x++) {
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        for (let z = 0; z < this.sizeZ; z++) {
          const block = this.data[this.idx(x, y, z)];
          if (block === BLOCK.AIR) continue;
          const def = BLOCKS[block];
          for (const f of FACES) {
            const nx = x + f.dir[0], ny = y + f.dir[1], nz = z + f.dir[2];
            if (!this.isFaceVisible(nx, ny, nz, block)) continue;
            const fs = faceShade(f.normal[1], f.normal[0], f.normal[2]);
            const corners = block === BLOCK.WATER && f.face === "top"
              ? [[0, 0.9, 0], [1, 0.9, 0], [1, 0.9, 1], [0, 0.9, 1]]
              : f.corners;
            const ao = block === BLOCK.WATER ? [1, 1, 1, 1] : aoForFace(x, y, z, f.dir, f.corners);
            const lightFactors = ao.map((a) => a * fs);
            const rect = block === BLOCK.WATER ? null : tileRect(block, f.face as "top" | "side" | "bottom");
            if (block === BLOCK.WATER) {
              addQuad(water, x, y, z, corners, f.normal, lightFactors, null, f.uv);
            } else if (def.transparent) {
              addQuad(trans, x, y, z, f.corners, f.normal, lightFactors, rect, f.uv);
            } else {
              addQuad(opaque, x, y, z, f.corners, f.normal, lightFactors, rect, f.uv);
            }
          }
        }
      }
    }

    const toGeom = (d: ChunkMeshData) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(d.positions, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(d.normals, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(d.colors, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(d.uvs, 2));
      g.setIndex(d.indices);
      return g;
    };

    return {
      opaque: toGeom(opaque),
      water: toGeom(water),
      transparent: toGeom(trans),
    };
  }

  getSpawnPoint(): THREE.Vector3 {
    const cx = Math.floor(this.sizeX / 2);
    const cz = Math.floor(this.sizeZ / 2);
    // Search a spiral around world center for a safe land spawn (skip leaves/water/treetops)
    for (let r = 0; r < Math.max(this.sizeX, this.sizeZ); r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = cx + dx, z = cz + dz;
          for (let y = WORLD_HEIGHT - 1; y >= 1; y--) {
            const b = this.getBlock(x, y, z);
            if (b === BLOCK.AIR || b === BLOCK.WATER || b === BLOCK.LEAVES) continue;
            const above = this.getBlock(x, y + 1, z);
            const above2 = this.getBlock(x, y + 2, z);
            if (above === BLOCK.AIR && above2 === BLOCK.AIR && b !== BLOCK.WATER) {
              return new THREE.Vector3(x + 0.5, y + 1.5, z + 0.5);
            }
            break;
          }
        }
      }
    }
    return new THREE.Vector3(cx + 0.5, SEA_LEVEL + 3, cz + 0.5);
  }

  rebuildGeometry(opaqueMesh: THREE.Mesh, waterMesh: THREE.Mesh, transMesh: THREE.Mesh): void {
    const { opaque, water, transparent } = this.buildMesh();
    opaqueMesh.geometry.dispose();
    opaqueMesh.geometry = opaque;
    waterMesh.geometry.dispose();
    waterMesh.geometry = water;
    transMesh.geometry.dispose();
    transMesh.geometry = transparent;
  }
}
