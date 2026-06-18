import * as THREE from "three";
import { World, WORLD_HEIGHT } from "../world/World.js";
import { isSolid } from "../blocks.js";
import { ItemStack, getItem } from "../items.js";

const GRAVITY = 22;

export class DropEntity {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  stack: ItemStack;
  mesh: THREE.Mesh;
  alive = true;
  pickupDelay = 0.5;
  age = 0;
  readonly width = 0.25;

  constructor(x: number, y: number, z: number, stack: ItemStack) {
    this.stack = stack;
    this.pos.set(x, y, z);
    this.vel.set((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2);
    const def = getItem(stack.id);
    const color = def?.color ?? 0xffffff;
    const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(0x111111), roughness: 0.6 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.pos);
    this.mesh.castShadow = true;
  }

  update(dt: number, world: World, playerPos: THREE.Vector3): boolean {
    dt = Math.min(dt, 0.05);
    this.age += dt;
    if (this.pickupDelay > 0) this.pickupDelay -= dt;

    this.vel.y -= GRAVITY * dt;
    if (this.vel.y < -30) this.vel.y = -30;

    // Move with simple collision (axis Y mainly; X/Z slide)
    this.pos.x += this.vel.x * dt;
    this.collideAxis(world, 0);
    this.pos.y += this.vel.y * dt;
    if (this.collideAxis(world, 1)) this.vel.y = 0;
    this.pos.z += this.vel.z * dt;
    this.collideAxis(world, 2);
    this.vel.x *= 0.8;
    this.vel.z *= 0.8;

    // Attract toward player when close
    const dx = playerPos.x - this.pos.x;
    const dz = playerPos.z - this.pos.z;
    const dy = playerPos.y + 0.9 - this.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (this.pickupDelay <= 0 && dist < 1.6) {
      this.vel.x += (dx / dist) * 0.8;
      this.vel.z += (dz / dist) * 0.8;
      this.vel.y += (dy / dist) * 0.5;
    }

    this.mesh.position.set(this.pos.x, this.pos.y + 0.14 + Math.sin(this.age * 3) * 0.05, this.pos.z);
    this.mesh.rotation.y += dt * 2;
    this.mesh.rotation.x += dt * 1.2;

    // Expire after 5 minutes
    if (this.age > 300) this.alive = false;
    return dist < 0.8 && this.pickupDelay <= 0;
  }

  private collideAxis(world: World, axis: 0 | 1 | 2): boolean {
    const hw = this.width / 2;
    const minX = Math.floor(this.pos.x - hw);
    const maxX = Math.floor(this.pos.x + hw);
    const minY = Math.floor(this.pos.y);
    const maxY = Math.floor(this.pos.y + this.width);
    const minZ = Math.floor(this.pos.z - hw);
    const maxZ = Math.floor(this.pos.z + hw);
    let hit = false;
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (y < 0 || y >= WORLD_HEIGHT) continue;
          if (!isSolid(world.getBlock(x, y, z))) continue;
          if (!(this.pos.x + hw > x && this.pos.x - hw < x + 1 && this.pos.y + this.width > y && this.pos.y < y + 1 && this.pos.z + hw > z && this.pos.z - hw < z + 1)) continue;
          hit = true;
          if (axis === 0) {
            if (this.vel.x > 0) this.pos.x = x - hw - 1e-4;
            else if (this.vel.x < 0) this.pos.x = x + 1 + hw + 1e-4;
            this.vel.x = 0;
          } else if (axis === 1) {
            if (this.vel.y > 0) this.pos.y = y - this.width - 1e-4;
            else if (this.vel.y < 0) this.pos.y = y + 1 + 1e-4;
          } else {
            if (this.vel.z > 0) this.pos.z = z - hw - 1e-4;
            else if (this.vel.z < 0) this.pos.z = z + 1 + hw + 1e-4;
            this.vel.z = 0;
          }
        }
      }
    }
    return hit;
  }
}
