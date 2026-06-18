import * as THREE from "three";
import { World, WORLD_HEIGHT } from "../world/World.js";
import { isSolid } from "../blocks.js";
import { ItemStack } from "../items.js";

const GRAVITY = 26;

export function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.0 });
  return new THREE.Mesh(geo, mat);
}

export interface DropDef {
  id: string;
  count: number;
  chance?: number;
}

export abstract class Mob {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  readonly width: number;
  readonly height: number;
  health: number;
  maxHealth: number;
  onGround = false;
  group: THREE.Group;
  alive = true;
  invulnTimer = 0;
  burnTimer = 0;
  hostile: boolean;
  drops: DropDef[] = [];
  id: number;

  private static nextId = 1;

  constructor(x: number, y: number, z: number, width: number, height: number, maxHealth: number, hostile: boolean) {
    this.id = Mob.nextId++;
    this.width = width;
    this.height = height;
    this.maxHealth = maxHealth;
    this.health = maxHealth;
    this.hostile = hostile;
    this.pos.set(x, y, z);
    this.group = new THREE.Group();
    this.buildModel();
  }

  protected abstract buildModel(): void;
  abstract updateAI(dt: number, world: World, playerPos: THREE.Vector3, isDay: boolean): void;

  protected enableShadows() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; }
    });
  }

  takeDamage(amount: number, knockX: number, knockZ: number): boolean {
    if (this.invulnTimer > 0 || !this.alive) return false;
    this.health -= amount;
    this.invulnTimer = 0.5;
    this.vel.x += knockX;
    this.vel.z += knockZ;
    this.vel.y = Math.max(this.vel.y, 5);
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
    return true;
  }

  update(dt: number, world: World, playerPos: THREE.Vector3, isDay: boolean) {
    dt = Math.min(dt, 0.05);
    if (this.invulnTimer > 0) this.invulnTimer -= dt;

    this.updateAI(dt, world, playerPos, isDay);

    // Burn in daylight if hostile and exposed to sky
    if (this.hostile && isDay) {
      if (this.exposedToSky(world)) {
        this.burnTimer += dt;
        if (this.burnTimer > 0.5) {
          this.health -= 1;
          this.burnTimer = 0;
          if (this.health <= 0) this.alive = false;
        }
      }
    }

    // Gravity
    this.vel.y -= GRAVITY * dt;
    if (this.vel.y < -55) this.vel.y = -55;

    this.moveAndCollide(world, dt);

    // Despawn if fell out of world
    if (this.pos.y < -10) this.alive = false;

    // Sync model
    this.group.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.group.rotation.y = this.yaw;
    // Flash red/white when invulnerable
    const flash = this.invulnTimer > 0 && Math.floor(this.invulnTimer * 20) % 2 === 0;
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const m = o.material as THREE.MeshLambertMaterial;
        m.emissive?.setHex(flash ? 0x661111 : 0x000000);
      }
    });
  }

  private exposedToSky(world: World): boolean {
    const x = Math.floor(this.pos.x);
    const z = Math.floor(this.pos.z);
    const y = Math.floor(this.pos.y + this.height + 0.1);
    for (let yy = y; yy < WORLD_HEIGHT; yy++) {
      const b = world.getBlock(x, yy, z);
      if (b !== 0 && b !== 7) return false; // blocked by solid/non-water
    }
    return true;
  }

  private getAABB() {
    const hw = this.width / 2;
    return {
      min: new THREE.Vector3(this.pos.x - hw, this.pos.y, this.pos.z - hw),
      max: new THREE.Vector3(this.pos.x + hw, this.pos.y + this.height, this.pos.z + hw),
    };
  }

  private moveAndCollide(world: World, dt: number) {
    this.pos.x += this.vel.x * dt;
    this.resolveAxis(world, 0);
    this.pos.y += this.vel.y * dt;
    this.onGround = false;
    this.resolveAxis(world, 1);
    this.pos.z += this.vel.z * dt;
    this.resolveAxis(world, 2);
    // Friction
    this.vel.x *= 0.7;
    this.vel.z *= 0.7;
  }

  private resolveAxis(world: World, axis: 0 | 1 | 2) {
    const aabb = this.getAABB();
    const minX = Math.floor(aabb.min.x);
    const maxX = Math.floor(aabb.max.x);
    const minY = Math.floor(aabb.min.y);
    const maxY = Math.floor(aabb.max.y);
    const minZ = Math.floor(aabb.min.z);
    const maxZ = Math.floor(aabb.max.z);
    const hw = this.width / 2;

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (y < 0 || y >= WORLD_HEIGHT) continue;
          if (!isSolid(world.getBlock(x, y, z))) continue;
          if (!(aabb.max.x > x && aabb.min.x < x + 1 && aabb.max.y > y && aabb.min.y < y + 1 && aabb.max.z > z && aabb.min.z < z + 1)) continue;
          if (axis === 0) {
            if (this.vel.x > 0) this.pos.x = x - hw - 1e-4;
            else if (this.vel.x < 0) this.pos.x = x + 1 + hw + 1e-4;
            this.vel.x = 0;
          } else if (axis === 1) {
            if (this.vel.y > 0) this.pos.y = y - this.height - 1e-4;
            else if (this.vel.y < 0) { this.pos.y = y + 1 + 1e-4; this.onGround = true; }
            this.vel.y = 0;
          } else {
            if (this.vel.z > 0) this.pos.z = z - hw - 1e-4;
            else if (this.vel.z < 0) this.pos.z = z + 1 + hw + 1e-4;
            this.vel.z = 0;
          }
          aabb.min.set(this.pos.x - hw, this.pos.y, this.pos.z - hw);
          aabb.max.set(this.pos.x + hw, this.pos.y + this.height, this.pos.z + hw);
        }
      }
    }
  }

  getDropStacks(): ItemStack[] {
    const out: ItemStack[] = [];
    for (const d of this.drops) {
      if (d.chance !== undefined && Math.random() > d.chance) continue;
      out.push({ id: d.id, count: d.count });
    }
    return out;
  }

  // Distance to a point (XZ plane)
  distXZ(p: THREE.Vector3): number {
    const dx = this.pos.x - p.x;
    const dz = this.pos.z - p.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  faceTowards(p: THREE.Vector3) {
    this.yaw = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
  }
}
