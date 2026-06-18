# VoxelCraft

A browser-based 3D voxel sandbox game inspired by Minecraft, built with Three.js + TypeScript.

Play directly in the browser — no install required beyond `npm install`.

## Features

- **Procedural terrain** — grass, dirt, stone, sand, snow-capped peaks, water, trees (simplex noise)
- **Block breaking & placing** — hold-to-mine with tool-dependent speed; pickaxe-required drops
- **Inventory & crafting** — 36-slot inventory, 2×2 (inventory) and 3×3 (crafting table) shaped/shapeless recipes
- **Tools** — wood/stone/iron pickaxe, axe, shovel, sword (affect mining speed & combat damage)
- **Mobs** — passive chickens (wander, flee, lay eggs) and hostile zombies (spawn at night, chase, burn in daylight)
- **Combat** — melee attacks with knockback, i-frames, death drops
- **Survival** — 20 HP / 20 hunger, health regen, fall damage, starvation, death & respawn
- **Day-night cycle** — ~3 min cycle; zombies burn at dawn
- **Modern rendering** — PBR materials (MeshStandardMaterial), ACES tone mapping, soft shadows, bloom post-processing, procedural texture atlas, per-vertex ambient occlusion, animated water with rippling waves

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173 and click the screen to play.

### Build

```bash
npm run build      # type-check + production build to dist/
npm run preview    # preview the production build
```

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Space | Jump |
| Shift | Sprint |
| Mouse | Look (click screen to lock pointer) |
| Left-click (hold) | Mine block / attack mob |
| Right-click | Place block / use crafting table / eat food (hold) |
| 1-9 / Scroll | Select hotbar slot |
| E | Open inventory + 2×2 crafting |
| F | Toggle fly |
| Q / Shift | Descend (fly mode) |

Right-click a **crafting table** block for 3×3 crafting.

## Tech stack

- [Vite](https://vitejs.dev/) + TypeScript
- [Three.js](https://threejs.org/) — rendering, PBR, shadows, post-processing
- [simplex-noise](https://github.com/jwagner/simplex-noise) — terrain generation
- Custom AABB collision, Amanatides–Woo voxel raycasting, procedural texture atlas

## License

MIT
