import * as THREE from "three";
import { World, WORLD_HEIGHT } from "./world/World.js";
import { isSolid } from "./blocks.js";

const PLAYER_WIDTH = 0.6;
const PLAYER_HEIGHT = 1.8;
const EYE_HEIGHT = 1.62;
const GRAVITY = 26;
const JUMP_SPEED = 8.5;
const WALK_SPEED = 4.7;
const SPRINT_SPEED = 7.5;
const FLY_SPEED = 9;
const FLY_SPRINT = 18;
const ACCEL_GROUND = 12;
const ACCEL_AIR = 2.5;

export class Player {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = false;
  flying = false;
  sprint = false;
  inWater = false;
  camera: THREE.PerspectiveCamera;

  health = 20;
  maxHealth = 20;
  hunger = 20;
  maxHunger = 20;
  saturation = 5;
  invulnTimer = 0;
  private fallStartY = 0;
  private wasOnGround = true;
  private hungerTimer = 0;
  private regenTimer = 0;
  private prevY = 0;
  dead = false;

  private keys: Record<string, boolean> = {};
  private domElement: HTMLElement;
  private locked = false;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, spawn: THREE.Vector3) {
    this.camera = camera;
    this.domElement = domElement;
    this.pos.copy(spawn);
    this.bindEvents();
    this.updateCamera();
  }

  private bindEvents() {
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (e.code === "KeyF" && this.locked) this.flying = !this.flying;
    });
    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });
    this.domElement.addEventListener("click", () => {
      if (!this.locked) this.domElement.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.domElement;
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      const sens = 0.0022;
      this.yaw -= e.movementX * sens;
      this.pitch -= e.movementY * sens;
      const lim = Math.PI / 2 - 0.01;
      this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
    });
  }

  get locked_() { return this.locked; }
  get isLocked() { return this.locked; }

  private getForward(out: THREE.Vector3): THREE.Vector3 {
    out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(-1);
    return out;
  }
  private getRight(out: THREE.Vector3): THREE.Vector3 {
    out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    return out.normalize();
  }

  updateCamera() {
    this.camera.position.set(this.pos.x, this.pos.y + EYE_HEIGHT, this.pos.z);
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, "YXZ");
    this.camera.quaternion.setFromEuler(euler);
  }

  getEyeDirection(out: THREE.Vector3): THREE.Vector3 {
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, "YXZ");
    out.set(0, 0, -1).applyEuler(euler);
    return out;
  }

  update(dt: number, world: World) {
    dt = Math.min(dt, 0.05);
    const fwd = new THREE.Vector3();
    const right = new THREE.Vector3();
    this.getForward(fwd);
    this.getRight(right);

    const want = new THREE.Vector3();
    if (this.keys["KeyW"]) want.add(fwd);
    if (this.keys["KeyS"]) want.sub(fwd);
    if (this.keys["KeyD"]) want.add(right);
    if (this.keys["KeyA"]) want.sub(right);
    if (want.lengthSq() > 0) want.normalize();

    this.sprint = !!this.keys["ShiftLeft"] || !!this.keys["ShiftRight"];

    const px = Math.floor(this.pos.x);
    const py = Math.floor(this.pos.y + 0.9);
    const pz = Math.floor(this.pos.z);
    const headBlock = world.getBlock(px, py, pz);
    this.inWater = headBlock === 7;

    if (this.flying) {
      const speed = this.sprint ? FLY_SPRINT : FLY_SPEED;
      this.vel.x = want.x * speed;
      this.vel.z = want.z * speed;
      let vy = 0;
      if (this.keys["Space"]) vy += 1;
      if (this.keys["ControlLeft"] || this.keys["KeyQ"]) vy -= 1;
      this.vel.y = vy * speed;
    } else {
      const speed = this.sprint ? SPRINT_SPEED : WALK_SPEED;
      const targetVX = want.x * speed;
      const targetVZ = want.z * speed;
      const accel = this.onGround ? ACCEL_GROUND : ACCEL_AIR;
      this.vel.x += (targetVX - this.vel.x) * Math.min(1, accel * dt);
      this.vel.z += (targetVZ - this.vel.z) * Math.min(1, accel * dt);

      if (this.inWater) {
        this.vel.y -= GRAVITY * 0.35 * dt;
        if (this.vel.y < -4) this.vel.y = -4;
        if (this.keys["Space"]) this.vel.y = 3.5;
      } else {
        this.vel.y -= GRAVITY * dt;
        if (this.onGround && this.keys["Space"]) this.vel.y = JUMP_SPEED;
      }
      if (this.vel.y < -55) this.vel.y = -55;
    }

    this.moveAndCollide(world, dt);

    // Fall damage: track highest point while airborne, compute damage on landing
    if (this.onGround && !this.wasOnGround) {
      const fall = this.fallStartY - this.pos.y;
      if (fall > 3.5 && !this.inWater && !this.flying) {
        this.applyDamage(Math.floor(fall - 3));
      }
      this.fallStartY = this.pos.y;
    }
    if (!this.onGround && this.pos.y > this.fallStartY) this.fallStartY = this.pos.y;
    this.wasOnGround = this.onGround;

    this.updateVitals(dt, world);

    if (this.pos.y < -10) {
      this.applyDamage(4);
      this.pos.set(world.getSpawnPoint().x, world.getSpawnPoint().y, world.getSpawnPoint().z);
      this.vel.set(0, 0, 0);
    }

    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    this.prevY = this.pos.y;
    this.updateCamera();
  }

  applyDamage(amount: number): boolean {
    if (this.dead || this.flying) return false;
    if (this.invulnTimer > 0) return false;
    this.health -= amount;
    this.invulnTimer = 0.5;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
    return true;
  }

  heal(amount: number) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  eat(heal: number, saturation: number): boolean {
    if (this.hunger >= this.maxHunger) return false;
    this.hunger = Math.min(this.maxHunger, this.hunger + heal);
    this.saturation = Math.min(this.hunger, this.saturation + saturation);
    return true;
  }

  knockback(kx: number, kz: number) {
    this.vel.x += kx;
    this.vel.z += kz;
    this.vel.y = Math.max(this.vel.y, 4);
  }

  private updateVitals(dt: number, world: World) {
    void world;
    this.hungerTimer += dt;
    // Hunger drain: every ~6s if moving/sprinting, faster when sprinting
    const moving = this.vel.lengthSq() > 0.5 && this.onGround;
    const drainInterval = this.sprint ? 2.5 : moving ? 6 : 12;
    if (this.hungerTimer > drainInterval) {
      this.hungerTimer = 0;
      if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
      else if (this.hunger > 0) this.hunger = Math.max(0, this.hunger - 1);
    }
    // Regen when hunger >= 18
    this.regenTimer += dt;
    if (this.hunger >= 18 && this.health < this.maxHealth && this.regenTimer > 2.5) {
      this.regenTimer = 0;
      this.heal(1);
      this.saturation = Math.max(0, this.saturation - 0.5);
    } else if (this.hunger <= 0 && this.regenTimer > 4) {
      // Starvation damage
      this.regenTimer = 0;
      if (this.health > 1) this.health -= 1;
    }
  }

  respawn(spawn: THREE.Vector3) {
    this.health = this.maxHealth;
    this.hunger = this.maxHunger;
    this.saturation = 5;
    this.dead = false;
    this.vel.set(0, 0, 0);
    this.pos.copy(spawn);
    this.updateCamera();
  }

  private getAABB(pos: THREE.Vector3): { min: THREE.Vector3; max: THREE.Vector3 } {
    const hw = PLAYER_WIDTH / 2;
    return {
      min: new THREE.Vector3(pos.x - hw, pos.y, pos.z - hw),
      max: new THREE.Vector3(pos.x + hw, pos.y + PLAYER_HEIGHT, pos.z + hw),
    };
  }

  private moveAndCollide(world: World, dt: number) {
    const dx = this.vel.x * dt;
    const dy = this.vel.y * dt;
    const dz = this.vel.z * dt;

    this.pos.x += dx;
    this.resolveAxis(world, 0);
    this.pos.y += dy;
    this.onGround = false;
    this.resolveAxis(world, 1);
    this.pos.z += dz;
    this.resolveAxis(world, 2);
  }

  private resolveAxis(world: World, axis: 0 | 1 | 2) {
    const aabb = this.getAABB(this.pos);
    const minX = Math.floor(aabb.min.x);
    const maxX = Math.floor(aabb.max.x);
    const minY = Math.floor(aabb.min.y);
    const maxY = Math.floor(aabb.max.y);
    const minZ = Math.floor(aabb.min.z);
    const maxZ = Math.floor(aabb.max.z);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (y < 0 || y >= WORLD_HEIGHT) continue;
          const b = world.getBlock(x, y, z);
          if (!isSolid(b)) continue;
          const bMinX = x, bMaxX = x + 1;
          const bMinY = y, bMaxY = y + 1;
          const bMinZ = z, bMaxZ = z + 1;
          const overlapX = aabb.max.x > bMinX && aabb.min.x < bMaxX;
          const overlapY = aabb.max.y > bMinY && aabb.min.y < bMaxY;
          const overlapZ = aabb.max.z > bMinZ && aabb.min.z < bMaxZ;
          if (!(overlapX && overlapY && overlapZ)) continue;

          if (axis === 0) {
            if (this.vel.x > 0) this.pos.x = bMinX - (PLAYER_WIDTH / 2) - 1e-4;
            else if (this.vel.x < 0) this.pos.x = bMaxX + (PLAYER_WIDTH / 2) + 1e-4;
            this.vel.x = 0;
          } else if (axis === 1) {
            if (this.vel.y > 0) this.pos.y = bMinY - PLAYER_HEIGHT - 1e-4;
            else if (this.vel.y < 0) { this.pos.y = bMaxY + 1e-4; this.onGround = true; }
            this.vel.y = 0;
          } else {
            if (this.vel.z > 0) this.pos.z = bMinZ - (PLAYER_WIDTH / 2) - 1e-4;
            else if (this.vel.z < 0) this.pos.z = bMaxZ + (PLAYER_WIDTH / 2) + 1e-4;
            this.vel.z = 0;
          }
          aabb.min.set(this.pos.x - PLAYER_WIDTH / 2, this.pos.y, this.pos.z - PLAYER_WIDTH / 2);
          aabb.max.set(this.pos.x + PLAYER_WIDTH / 2, this.pos.y + PLAYER_HEIGHT, this.pos.z + PLAYER_WIDTH / 2);
        }
      }
    }
  }
}
