import * as THREE from "three";
import { Mob, box } from "./Mob.js";
import { World } from "../world/World.js";

export class Chicken extends Mob {
  private wanderTimer = 0;
  private wanderDir = 0;
  private flapTimer = 0;
  private eggTimer = 60 + Math.random() * 120;

  constructor(x: number, y: number, z: number) {
    super(x, y, z, 0.5, 0.7, 4, false);
    this.drops = [
      { id: "feather", count: 1 + Math.floor(Math.random() * 2) },
      { id: "raw_chicken", count: 1, chance: 0.5 },
      { id: "egg", count: 1, chance: 0.25 },
    ];
  }

  protected buildModel() {
    const g = this.group;
    const body = box(0.5, 0.4, 0.55, 0xffffff);
    body.position.set(0, 0.45, 0);
    g.add(body);
    const head = box(0.25, 0.25, 0.25, 0xffffff);
    head.position.set(0, 0.75, 0.28);
    g.add(head);
    const beak = box(0.1, 0.08, 0.12, 0xe8a83a);
    beak.position.set(0, 0.74, 0.46);
    g.add(beak);
    const comb = box(0.08, 0.1, 0.18, 0xd63030);
    comb.position.set(0, 0.9, 0.28);
    g.add(comb);
    const wingL = box(0.08, 0.3, 0.4, 0xf2f2f2);
    wingL.position.set(-0.28, 0.45, 0);
    g.add(wingL);
    const wingR = box(0.08, 0.3, 0.4, 0xf2f2f2);
    wingR.position.set(0.28, 0.45, 0);
    g.add(wingR);
    const legL = box(0.07, 0.25, 0.07, 0xe8a83a);
    legL.position.set(-0.12, 0.12, 0);
    g.add(legL);
    const legR = box(0.07, 0.25, 0.07, 0xe8a83a);
    legR.position.set(0.12, 0.12, 0);
    g.add(legR);
    this.wingL = wingL;
    this.wingR = wingR;
    this.enableShadows();
  }
  private wingL!: THREE.Mesh;
  private wingR!: THREE.Mesh;

  updateAI(dt: number, world: World, playerPos: THREE.Vector3, isDay: boolean) {
    void isDay;
    this.wanderTimer -= dt;
    this.flapTimer += dt;
    this.eggTimer -= dt;

    // Flee if player is close
    const dPlayer = this.distXZ(playerPos);
    if (dPlayer < 4) {
      this.faceTowards(this.pos.clone().multiplyScalar(2).sub(playerPos)); // face away
      this.wanderDir = this.yaw;
      this.vel.x = Math.sin(this.yaw) * 2.4;
      this.vel.z = Math.cos(this.yaw) * 2.4;
      if (this.onGround && this.flapTimer > 0.4) {
        this.vel.y = 5;
        this.flapTimer = 0;
      }
    } else if (this.wanderTimer <= 0) {
      // Pick new wander action
      const r = Math.random();
      if (r < 0.4) {
        this.wanderDir = Math.random() * Math.PI * 2;
        this.wanderTimer = 2 + Math.random() * 3;
      } else {
        this.wanderTimer = 1 + Math.random() * 2;
      }
      this.yaw = this.wanderDir;
    } else {
      // Walk in wander direction slowly
      this.vel.x = Math.sin(this.wanderDir) * 1.1;
      this.vel.z = Math.cos(this.wanderDir) * 1.1;
      if (this.onGround && Math.random() < dt * 0.5) {
        this.vel.y = 4;
      }
    }

    // Lay egg occasionally
    if (this.eggTimer <= 0) {
      this.eggTimer = 180 + Math.random() * 240;
      this.eggLaying = true;
    }

    // Wing flap animation
    const flap = Math.sin(this.flapTimer * 12) * 0.5;
    if (this.wingL) this.wingL.rotation.z = flap;
    if (this.wingR) this.wingR.rotation.z = -flap;
  }

  eggLaying = false;
}
