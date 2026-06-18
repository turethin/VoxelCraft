import * as THREE from "three";
import { Mob, box } from "./Mob.js";
import { World } from "../world/World.js";

export class Zombie extends Mob {
  private attackCooldown = 0;
  private armSwing = 0;

  constructor(x: number, y: number, z: number) {
    super(x, y, z, 0.6, 1.9, 20, true);
    this.drops = [{ id: "rotten_flesh", count: 1, chance: 0.6 }];
  }

  protected buildModel() {
    const g = this.group;
    const skin = 0x4a7a3a;
    const shirt = 0x3a6a8a;
    const pants = 0x3a3a5a;
    const body = box(0.6, 0.8, 0.3, shirt);
    body.position.set(0, 1.1, 0);
    g.add(body);
    const head = box(0.5, 0.5, 0.5, skin);
    head.position.set(0, 1.75, 0);
    g.add(head);
    const armL = box(0.2, 0.8, 0.2, skin);
    armL.position.set(-0.4, 1.1, 0.3);
    armL.rotation.x = -Math.PI / 2;
    g.add(armL);
    const armR = box(0.2, 0.8, 0.2, skin);
    armR.position.set(0.4, 1.1, 0.3);
    armR.rotation.x = -Math.PI / 2;
    g.add(armR);
    const legL = box(0.22, 0.7, 0.22, pants);
    legL.position.set(-0.15, 0.35, 0);
    g.add(legL);
    const legR = box(0.22, 0.7, 0.22, pants);
    legR.position.set(0.15, 0.35, 0);
    g.add(legR);
    this.armL = armL;
    this.armR = armR;
    this.legL = legL;
    this.legR = legR;
    this.enableShadows();
  }
  private armL!: THREE.Mesh;
  private armR!: THREE.Mesh;
  private legL!: THREE.Mesh;
  private legR!: THREE.Mesh;

  updateAI(dt: number, world: World, playerPos: THREE.Vector3, isDay: boolean) {
    void isDay;
    this.attackCooldown -= dt;
    this.armSwing += dt * (this.distXZ(playerPos) < 12 ? 8 : 3);

    const d = this.distXZ(playerPos);
    if (d < 24) {
      // Chase player
      this.faceTowards(playerPos);
      const speed = 2.6;
      this.vel.x = Math.sin(this.yaw) * speed;
      this.vel.z = Math.cos(this.yaw) * speed;
      // Jump if blocked
      if (this.onGround) {
        const ahead = new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * 0.6, this.pos.y, this.pos.z + Math.cos(this.yaw) * 0.6);
        const by = Math.floor(ahead.y);
        const bx = Math.floor(ahead.x);
        const bz = Math.floor(ahead.z);
        const b = world.getBlock(bx, by, bz);
        const bUp = world.getBlock(bx, by + 1, bz);
        if ((b !== 0 && b !== 7) && bUp === 0) {
          this.vel.y = 8;
        }
      }
      // Attack on contact
      if (d < 1.0 && this.attackCooldown <= 0 && Math.abs(this.pos.y - playerPos.y) < 2) {
        this.onAttackPlayer();
        this.attackCooldown = 1.0;
      }
    } else {
      // Idle wander
      this.vel.x *= 0.5;
      this.vel.z *= 0.5;
    }

    // Animate limbs
    const swing = Math.sin(this.armSwing) * 0.4;
    if (this.armL) this.armL.rotation.x = -Math.PI / 2 + swing;
    if (this.armR) this.armR.rotation.x = -Math.PI / 2 - swing;
    if (this.legL) this.legL.rotation.x = swing;
    if (this.legR) this.legR.rotation.x = -swing;
  }

  // Hook set by game loop to deal damage to the player.
  onAttackPlayer: () => void = () => {};
}
