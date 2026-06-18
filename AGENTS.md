# AGENTS.md

VoxelCraft — browser-based 3D voxel sandbox (Minecraft-like) built with Three.js + TypeScript.

## Commands

- `npm run dev` — Vite dev server on http://localhost:5173 (HMR)
- `npm run build` — `tsc -b` typecheck then `vite build` → `dist/`
- `npx tsc --noEmit` — typecheck only (fastest correctness gate; run after edits)

There are **no tests**. Verify gameplay changes manually in a browser (real user click required — see Pointer Lock below).

## Architecture

Single-page app; entry is `src/main.ts` which wires Three.js scene, world meshes, player, HUD, and the render loop.

- `src/world/World.ts` — **core**. Holds the entire world as one flat `Uint8Array` (NOT chunked storage): index = `(y*sizeZ + z)*sizeX + x`. Contains terrain generation (simplex noise), tree placement, face-culled mesh builder, and spawn finder. This is where voxel data lives.
- `src/world/alea.ts` — tiny seedable PRNG fed to simplex-noise.
- `src/blocks.ts` — block registry (`BLOCK` id constants + `BLOCKS` definitions with per-face colors/solid/transparent/liquid flags, hardness, drop, required-tool). `isSolid`/`isOpaque` drive collision and meshing. `BLOCK_NAME_TO_ID` maps snake_case names↔ids.
- `src/items.ts` — **item** registry. Block items are auto-generated from `BLOCKS` (id = snake_case block name). Also defines materials (stick/coal/feather/egg), food (apple/raw/cooked chicken/rotten flesh with heal+saturation), and tools (`{tier}_{type}` e.g. `wood_pickaxe`, `stone_sword`, `iron_axe`) with `miningSpeed`/`attackDamage`. `ItemStack = {id, count}`.
- `src/inventory.ts` — `Inventory`: 36 slots (0–8 hotbar, 9–35 storage). `addItem` fills hotbar-first then storage, stacking to `maxStack`. `consumeSelected` for placing/eating. Source of truth for the hotbar; `selected` is the hotbar index.
- `src/crafting.ts` — shaped (`pattern`+`key`) and shapeless recipe matching. `matchCrafting(grid, size)` trims the input grid to its bounding box before comparing to shaped recipes. Recipes: planks, sticks, crafting table, wood/stone tools (iron tools craftable but iron has no ore yet).
- `src/Player.ts` — player state + physics + input. AABB collision is swept **axis-by-axis** (`moveAndCollide` → `resolveAxis` per axis). Input keys are read regardless of pointer-lock state, so movement works in automation even when mouse-look doesn't. Also holds `health`/`hunger`/`saturation`, fall damage (tracks peak Y while airborne), `applyDamage`/`eat`/`knockback`, and `dead`/`respawn`.
- `src/raycast.ts` — Amanatides–Woo voxel DDA; returns hit block + face normal for break/place.
- `src/mobs/Mob.ts` — base entity: position/velocity, AABB physics (shared axis-separated collision), health, `invulnTimer` (i-frames + red flash via emissive), daylight burning for hostiles, `drops: DropDef[]`, `getDropStacks()`. `box(w,h,d,color)` helper builds Minecraft-style cuboid parts.
- `src/mobs/Chicken.ts` — passive: wanders, flees player within 4 blocks, flaps wings, lays eggs (flagged via `eggLaying`), drops feather/raw_chicken/egg.
- `src/mobs/Zombie.ts` — hostile: chases player within 24 blocks, jumps 1-block obstacles, melee via `onAttackPlayer` hook (set by main loop to damage the player), burns in daylight. Drops rotten flesh.
- `src/mobs/DropEntity.ts` — ground item entity with gravity/collision, magnet-attracts to player within 1.6 blocks, picked up within 0.8 blocks. `update()` returns `true` when in pickup range.
- `src/HUD.ts` — DOM overlay: crosshair, 10 hearts + 10 hunger (emoji), hotbar (rendered from `inventory.slots[0..8]`), coords/FPS/time/mob-count, and the **inventory screen** (E). Inventory screen has a 2×2 (or 3×3 at a crafting table) crafting grid + result slot, with full pick-up/swap/merge (left click) and split/place-one (right click) interactions. `heldStack` follows the cursor.
- `src/Sky.ts` — gradient sky-dome `ShaderMaterial` + sun mesh + `DirectionalLight` driven by a day cycle in the render loop. Exposes `isDay` and `timeLabel`. Cycle period ≈ 3 min (`time * 0.035`).

## Rendering pipeline (modern PBR)

- **Materials are `MeshStandardMaterial`** (PBR), NOT Lambert. Roughness/metalness per category: opaque ~0.92/0, water ~0.15/0 (reflective), transparent ~0.4/0. Vertex colors carry block color × directional shade × **per-vertex AO**.
- **Per-vertex ambient occlusion** is baked in the mesher (`aoForFace` in `World.buildMesh`): each face corner samples the 3 neighbor blocks on the air side. This is what kills the flat look — don't remove it.
- **Tone mapping**: `ACESFilmicToneMapping`, exposure ~1.05. **Shadows**: `PCFSoftShadowMap`, 2048 map; the `DirectionalLight` (sky.sunLight) casts shadows and its frustum is recentered on the player each frame in `loop()`.
- **Post-processing**: `EffectComposer` with `RenderPass → UnrealBloomPass → OutputPass`. The loop calls `composer.render()`, **not** `renderer.render()`. On resize, also call `composer.setSize`/`bloom.setSize`.
- **Environment**: `scene.environment` is a PMREM from `RoomEnvironment` for neutral PBR reflections. Sky dome itself uses a raw `ShaderMaterial` (unaffected by env/tone-map).

## Quirks & gotchas

- **Import specifiers use `.js` extensions** (`./World.js`) despite being `.ts` files — required by `moduleResolution: bundler` + Vite. Keep this convention.
- **Mesh rebuild is global**: `world.buildMesh()` regenerates the whole world's geometry on every block edit (`rebuild()` in `main.ts`). Fine for the 6×6 chunk world (96×64×96); will not scale to larger worlds without chunking.
- **Pointer Lock needs a real user gesture**. `requestPointerLock()` is rejected ("root document not valid") in headless/automated browsers (Playwright). Real browsers are unaffected; don't "fix" this by removing the gesture check.
- **Coordinate system**: Y up. Sea level = 20, world height = 64, chunks 16². Player spawn found by scanning down for first solid at world center.
- Terrain is regenerated from a random seed on every load (no persistence). Add `localStorage` save only if a stable world id is introduced first.
- Water renders at y+0.9 (slightly lowered top) for a visual effect; collision treats water as non-solid (`isSolid` false) so you sink/swim in it.

## Controls (also shown in-game overlay)

WASD move · Space jump · Shift sprint · Mouse look · Left-click break/attack (hold to mine) · Right-click place/use/eat · 1-9 / scroll select hotbar · E inventory + 2×2 craft · Right-click crafting table for 3×3 craft · F toggle fly · Q/Shift descend (fly).

## Gameplay notes

- **Mining is hold-based, not instant**: progress accumulates while holding left-click on one block; speed = `tool.miningSpeed / block.hardness` when the held tool's `toolType` matches the block's required `tool`, else base 1.0. Pickaxe-required blocks (stone/ore/cobble) drop **nothing** without a pickaxe.
- **Mobs**: chickens spawn passively by day (cap 8); zombies spawn at night within a 16–30 block ring (cap 14) and burn to death in daylight if exposed to sky. Both despawn beyond 80 blocks.
- **Combat**: left-click swings; if a mob is within 3.6 blocks and ~50° of view, it takes `tool.attackDamage` (sword highest) + knockback. Hostile contact deals 3 dmg + knockback to the player (0.5s i-frames). Dead mobs drop items as `DropEntity`s.
- **Vitals**: 20 HP / 20 hunger / 5 saturation. Hunger drains faster when sprinting. HP regenerates when hunger ≥ 18; starvation damages below 1 HP when hunger = 0. Fall damage above 3.5 blocks (negated by water). Death shows a screen; click to respawn at spawn point.
- Starter kit: wood pickaxe, wood sword, 5 apples, crafting table, 16 planks.
