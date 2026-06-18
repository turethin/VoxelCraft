import * as THREE from "three";
import { World, WORLD_HEIGHT } from "./world/World.js";
import { Player } from "./Player.js";
import { HUD } from "./HUD.js";
import { raycastVoxel } from "./raycast.js";
import { BLOCK, BLOCKS, BlockId } from "./blocks.js";
import { Sky } from "./Sky.js";
import { Inventory } from "./inventory.js";
import { ItemStack, getItem, itemIdToBlockId } from "./items.js";
import { Mob } from "./mobs/Mob.js";
import { Chicken } from "./mobs/Chicken.js";
import { Zombie } from "./mobs/Zombie.js";
import { DropEntity } from "./mobs/DropEntity.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { getAtlasTexture } from "./textureGenerator.js";

const hudRoot = document.getElementById("hud")!;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9fc4e8, 50, 150);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 1000);

// PBR environment map (neutral studio for nice reflections on standard materials)
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.25;

const sky = new Sky();
scene.add(sky.mesh);
scene.add(sky.sun);
sky.sunLight.castShadow = true;
sky.sunLight.shadow.mapSize.set(2048, 2048);
sky.sunLight.shadow.camera.near = 1;
sky.sunLight.shadow.camera.far = 220;
sky.sunLight.shadow.camera.left = -70;
sky.sunLight.shadow.camera.right = 70;
sky.sunLight.shadow.camera.top = 70;
sky.sunLight.shadow.camera.bottom = -70;
sky.sunLight.shadow.bias = -0.0004;
sky.sunLight.shadow.normalBias = 0.04;
scene.add(sky.sunLight);
scene.add(sky.sunLight.target);
scene.add(new THREE.AmbientLight(0xffffff, 0.18));
const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x4a6b3a, 0.3);
scene.add(hemi);

const SEED = (Math.random() * 1e9) | 0;
const world = new World(SEED, 6, 6);

const { opaque, water, transparent } = world.buildMesh();
const atlas = getAtlasTexture();

// Water ripple shader time uniform (set inside onBeforeCompile)
let waterShaderUniforms: object | null = null;
const opaqueMat = new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.35 });
const opaqueMesh = new THREE.Mesh(opaque, opaqueMat);
opaqueMesh.castShadow = true;
opaqueMesh.receiveShadow = true;
scene.add(opaqueMesh);
const waterMat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.78, roughness: 0.15, metalness: 0.0, depthWrite: false });
waterMat.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = { value: 0 };
  waterShaderUniforms = shader.uniforms;
  shader.uniforms.uTime = (waterShaderUniforms as Record<string, { value: number }>)["uTime"];
  shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace(
    "#include <begin_vertex>",
    `vec3 transformed = vec3(position);
     float w1 = sin(position.x * 1.7 + uTime * 1.3) * 0.045;
     float w2 = sin(position.z * 2.1 - uTime * 1.7) * 0.045;
     float w3 = sin((position.x + position.z) * 1.1 + uTime * 0.9) * 0.03;
     float wave = w1 + w2 + w3;
     if (normal.y > 0.5) transformed.y += wave;`
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <roughnessmap_fragment>",
    `float roughnessFactor = roughness;
     float shimmer = sin(vViewPosition.x * 6.0 + vViewPosition.z * 5.0 + uTime * 2.0) * 0.5 + 0.5;
     roughnessFactor = mix(roughness, 0.35, shimmer * 0.35);`
  );
  shader.fragmentShader = "uniform float uTime;\n" + shader.fragmentShader;
};
const waterMesh = new THREE.Mesh(water, waterMat);
waterMesh.receiveShadow = true;
scene.add(waterMesh);
const transMat = new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, transparent: false, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.0, envMapIntensity: 0.35 });
const transMesh = new THREE.Mesh(transparent, transMat);
transMesh.castShadow = true;
transMesh.receiveShadow = true;
scene.add(transMesh);

// Post-processing: bloom for a modern glow on highlights/sun
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.12, 0.4, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 })
);
highlight.visible = false;
scene.add(highlight);

const spawn = world.getSpawnPoint();
const player = new Player(camera, renderer.domElement, spawn);
const inventory = new Inventory();
// Starter kit
inventory.addItem({ id: "wood_pickaxe", count: 1 });
inventory.addItem({ id: "wood_sword", count: 1 });
inventory.addItem({ id: "apple", count: 5 });
inventory.addItem({ id: "crafting_table", count: 1 });
inventory.addItem({ id: "plank", count: 16 });
const hud = new HUD(hudRoot, inventory);

const mobs: Mob[] = [];
const drops: DropEntity[] = [];

function rebuild() {
  const { opaque: o, water: w, transparent: t } = world.buildMesh();
  opaqueMesh.geometry.dispose(); opaqueMesh.geometry = o;
  waterMesh.geometry.dispose(); waterMesh.geometry = w;
  transMesh.geometry.dispose(); transMesh.geometry = t;
}

function placeBlockAllowed(bx: number, by: number, bz: number): boolean {
  if (!world.inBounds(bx, by, bz)) return false;
  const playerMin = new THREE.Vector3(player.pos.x - 0.3, player.pos.y + 0.05, player.pos.z - 0.3);
  const playerMax = new THREE.Vector3(player.pos.x + 0.3, player.pos.y + 1.75, player.pos.z + 0.3);
  return !(playerMax.x > bx && playerMin.x < bx + 1 && playerMax.y > by && playerMin.y < by + 1 && playerMax.z > bz && playerMin.z < bz + 1);
}

function spawnDrop(x: number, y: number, z: number, stack: ItemStack) {
  const d = new DropEntity(x + 0.5, y + 0.4, z + 0.5, stack);
  drops.push(d);
  scene.add(d.mesh);
}

function breakBlock(x: number, y: number, z: number) {
  const block = world.getBlock(x, y, z);
  if (block === BLOCK.AIR || block === BLOCK.BEDROCK) return;
  const def = BLOCKS[block];
  world.setBlock(x, y, z, BLOCK.AIR);
  rebuild();
  if (def.drop) {
    spawnDrop(x, y, z, { id: def.drop, count: 1 });
  }
}

function attackSwing(): boolean {
  const origin = camera.position.clone();
  const dir = new THREE.Vector3();
  player.getEyeDirection(dir);
  let best: Mob | null = null;
  let bestDist = 3.6;
  for (const m of mobs) {
    if (!m.alive) continue;
    const cx = m.pos.x, cy = m.pos.y + m.height / 2, cz = m.pos.z;
    const dx = cx - origin.x, dy = cy - origin.y, dz = cz - origin.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist > 3.6 || dist > bestDist) continue;
    // angle check
    const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / (dist * Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z));
    if (dot < 0.6) continue;
    best = m; bestDist = dist;
  }
  if (best) {
    const sel = inventory.getSelected();
    const def = sel ? getItem(sel.id) : null;
    const dmg = def?.kind === "tool" ? (def.attackDamage ?? 1) : 1;
    const kx = Math.sin(player.yaw) * 4;
    const kz = Math.cos(player.yaw) * 4;
    best.takeDamage(dmg, kx, kz);
    return true;
  }
  return false;
}

// Mining state
let leftDown = false;
let rightDown = false;
let miningTarget: { x: number; y: number; z: number } | null = null;
let miningProgress = 0;
let eatingTimer = 0;
let breakCooldown = 0;

renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

renderer.domElement.addEventListener("mousedown", (e) => {
  if (player.dead) {
    respawn();
    return;
  }
  if (hud.inventoryOpen) return;
  if (!player.isLocked) {
    // First click: request pointer lock. Still allow left-click mining immediately.
    renderer.domElement.requestPointerLock();
  }
  if (e.button === 0) {
    leftDown = true;
    attackSwing();
  } else if (e.button === 2) {
    rightDown = true;
    handleRightClick();
  }
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) { leftDown = false; miningTarget = null; miningProgress = 0; }
  if (e.button === 2) { rightDown = false; eatingTimer = 0; }
});

function handleRightClick() {
  // Eat food
  const sel = inventory.getSelected();
  const def = sel ? getItem(sel.id) : null;
  if (def?.kind === "food") return; // handled in loop (hold)
  // Use crafting table
  const origin = camera.position.clone();
  const dir = new THREE.Vector3();
  player.getEyeDirection(dir);
  const hit = raycastVoxel(world, origin, dir, 5);
  if (hit && world.getBlock(hit.x, hit.y, hit.z) === BLOCK.CRAFTING_TABLE) {
    hud.openInventory(3);
    return;
  }
  // Place block
  if (!hit) return;
  if (!sel || def?.kind !== "block") return;
  const bx = hit.x + hit.nx, by = hit.y + hit.ny, bz = hit.z + hit.nz;
  if (!world.inBounds(bx, by, bz)) return;
  if (world.getBlock(bx, by, bz) !== BLOCK.AIR) return;
  const blockId = itemIdToBlockId(sel.id);
  if (blockId === null) return;
  if (placeBlockAllowed(bx, by, bz)) {
    world.setBlock(bx, by, bz, blockId as BlockId);
    rebuild();
    inventory.consumeSelected();
  }
}

document.addEventListener("pointerlockchange", () => {
  hud.setLocked(document.pointerLockElement === renderer.domElement);
});

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth, innerHeight);
});

// --- Spawning ---
let spawnTimer = 0;
function findSpawnSurface(x: number, z: number): number {
  for (let y = WORLD_HEIGHT - 1; y >= 1; y--) {
    const b = world.getBlock(x, y, z);
    if (b !== BLOCK.AIR && b !== BLOCK.WATER) {
      return y + 1;
    }
  }
  return -1;
}

function trySpawnMob(hostile: boolean) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 16 + Math.random() * 14;
  const x = Math.floor(player.pos.x + Math.cos(angle) * dist);
  const z = Math.floor(player.pos.z + Math.sin(angle) * dist);
  if (!world.inBounds(x, 0, z)) return;
  const y = findSpawnSurface(x, z);
  if (y < 0) return;
  if (hostile) {
    if (mobs.filter((m) => m.hostile).length >= 14) return;
    const z2 = new Zombie(x + 0.5, y, z + 0.5);
    z2.onAttackPlayer = () => {
      const d = player.applyDamage(3);
      if (d) {
        const kx = Math.sin(z2.yaw) * 5;
        const kz = Math.cos(z2.yaw) * 5;
        player.knockback(kx, kz);
      }
    };
    mobs.push(z2);
    scene.add(z2.group);
  } else {
    if (mobs.filter((m) => !m.hostile).length >= 8) return;
    const c = new Chicken(x + 0.5, y, z + 0.5);
    mobs.push(c);
    scene.add(c.group);
  }
}

function respawn() {
  player.respawn(world.getSpawnPoint());
  // Clear hostile mobs near
  for (const m of mobs) {
    if (m.hostile && m.distXZ(player.pos) < 20) m.alive = false;
  }
}

// Death screen
const deathScreen = document.createElement("div");
deathScreen.style.cssText = `position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;background:rgba(80,0,0,0.6);color:#fff;font-family:system-ui,sans-serif;z-index:25;cursor:pointer;`;
deathScreen.innerHTML = `<div style="font-size:48px;font-weight:800;margin-bottom:10px;">你死了</div><div style="font-size:18px;opacity:.9">点击屏幕重生</div>`;
hudRoot.appendChild(deathScreen);

let last = performance.now();
let frames = 0, fps = 60, fpsTimer = 0;

function loop(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  frames++; fpsTimer += dt;
  if (fpsTimer >= 0.5) { fps = frames / fpsTimer; frames = 0; fpsTimer = 0; }

  const isDay = sky.isDay;
  const timeLabel = sky.timeLabel;

  if (!player.dead && !hud.inventoryOpen) {
    player.update(dt, world);
  }

  // Mining (hold left)
  if (leftDown && !hud.inventoryOpen && !player.dead) {
    const origin = camera.position.clone();
    const dir = new THREE.Vector3();
    player.getEyeDirection(dir);
    const hit = raycastVoxel(world, origin, dir, 6);
    if (hit) {
      if (!miningTarget || miningTarget.x !== hit.x || miningTarget.y !== hit.y || miningTarget.z !== hit.z) {
        miningTarget = { x: hit.x, y: hit.y, z: hit.z };
        miningProgress = 0;
      }
      const def = BLOCKS[world.getBlock(hit.x, hit.y, hit.z)];
      if (def && def.hardness !== Infinity) {
        const sel = inventory.getSelected();
        const itemDef = sel ? getItem(sel.id) : null;
        let speed = 1.0;
        if (itemDef?.kind === "tool" && itemDef.toolType === def.tool) speed = itemDef.miningSpeed ?? 1;
        miningProgress += (dt * speed) / Math.max(0.05, def.hardness);
        (highlight.material as THREE.LineBasicMaterial).opacity = 0.5 + 0.5 * Math.min(1, miningProgress);
        if (miningProgress >= 1) {
          // Drop rule: pickaxe-required blocks need pickaxe
          if (def.tool === "pickaxe" && itemDef?.toolType !== "pickaxe") {
            // no drop, still break
            world.setBlock(hit.x, hit.y, hit.z, BLOCK.AIR);
            rebuild();
          } else {
            breakBlock(hit.x, hit.y, hit.z);
          }
          miningTarget = null; miningProgress = 0;
        }
      }
    } else {
      miningTarget = null; miningProgress = 0;
    }
  } else {
    (highlight.material as THREE.LineBasicMaterial).opacity = 0.5;
  }

  // Eating (hold right with food)
  if (rightDown && !hud.inventoryOpen && !player.dead) {
    const sel = inventory.getSelected();
    const def = sel ? getItem(sel.id) : null;
    if (def?.kind === "food") {
      eatingTimer += dt;
      if (eatingTimer >= 1.2) {
        if (player.eat(def.heal ?? 0, def.saturation ?? 0)) {
          inventory.consumeSelected();
        }
        eatingTimer = 0;
      }
    }
  }

  // Update mobs
  for (const m of mobs) {
    m.update(dt, world, player.pos, isDay);
    // Contact damage from hostile
    if (m.hostile && m.alive && m.distXZ(player.pos) < 1.0 && Math.abs(m.pos.y - player.pos.y) < 2) {
      (m as Zombie).onAttackPlayer();
    }
  }
  // Remove dead mobs + spawn drops + remove meshes
  for (let i = mobs.length - 1; i >= 0; i--) {
    const m = mobs[i];
    if (!m.alive) {
      for (const s of m.getDropStacks()) spawnDrop(m.pos.x, m.pos.y, m.pos.z, s);
      scene.remove(m.group);
      mobs.splice(i, 1);
    } else if (m.distXZ(player.pos) > 80) {
      scene.remove(m.group);
      mobs.splice(i, 1);
    }
  }

  // Update drops + pickup
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    const picked = d.update(dt, world, player.pos);
    if (!d.alive) {
      scene.remove(d.mesh);
      drops.splice(i, 1);
    } else if (picked && !player.dead) {
      const leftover = inventory.addItem({ ...d.stack });
      if (leftover <= 0) {
        scene.remove(d.mesh);
        drops.splice(i, 1);
      } else {
        d.stack.count = leftover;
      }
    }
  }

  // Spawn cycle
  spawnTimer += dt;
  if (spawnTimer > 2.5) {
    spawnTimer = 0;
    if (!isDay) {
      if (Math.random() < 0.7) trySpawnMob(true);
    } else {
      if (Math.random() < 0.3) trySpawnMob(false);
    }
  }

  // Highlight raycast for targeting
  if (!hud.inventoryOpen) {
    const origin = camera.position.clone();
    const dir = new THREE.Vector3();
    player.getEyeDirection(dir);
    const hit = raycastVoxel(world, origin, dir, 6);
    if (hit) {
      highlight.visible = true;
      highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      highlight.visible = false;
    }
  } else {
    highlight.visible = false;
  }

  // HUD status
  hud.updateStatus(player.health, player.hunger);
  const mode = player.dead ? "死亡" : player.flying ? "飞行" : player.inWater ? "水中" : "步行";
  hud.updateCoords(player.pos.x, player.pos.y, player.pos.z, fps, `${mode} M:${mobs.length} D:${drops.length}`, timeLabel);

  // Death screen
  deathScreen.style.display = player.dead ? "flex" : "none";

  sky.update(now / 1000, camera);
  sky.mesh.position.copy(camera.position);

  // Keep the shadow frustum centered on the player so shadows stay crisp.
  sky.sunLight.target.position.copy(player.pos);
  const sunDir = sky.sunLight.position.clone().sub(player.pos).normalize();
  sky.sunLight.position.copy(player.pos).add(sunDir.multiplyScalar(90));

  breakCooldown -= dt;

  if (waterShaderUniforms) {
    (waterShaderUniforms as Record<string, { value: number }>).uTime.value = now / 1000;
  }

  composer.render();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
