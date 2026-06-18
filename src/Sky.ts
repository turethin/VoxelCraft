import * as THREE from "three";

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */`
uniform vec3 topColor;
uniform vec3 midColor;
uniform vec3 bottomColor;
uniform float sunPos;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col;
  if (h < 0.5) {
    col = mix(bottomColor, midColor, smoothstep(0.0, 0.5, h));
  } else {
    col = mix(midColor, topColor, smoothstep(0.5, 1.0, h));
  }
  // warm tint near horizon based on sun height
  float horizon = pow(1.0 - abs(vDir.y), 6.0);
  col += vec3(0.9, 0.5, 0.2) * horizon * smoothstep(0.0, 0.35, sunPos) * 0.6;
  gl_FragColor = vec4(col, 1.0);
}
`;

export class Sky {
  mesh: THREE.Mesh;
  private uniforms: { topColor: { value: THREE.Color }; midColor: { value: THREE.Color }; bottomColor: { value: THREE.Color }; sunPos: { value: number } };
  sun: THREE.Mesh;
  sunLight: THREE.DirectionalLight;
  isDay = true;
  timeLabel = "白天";

  constructor() {
    this.uniforms = {
      topColor: { value: new THREE.Color(0x2a6fdb) },
      midColor: { value: new THREE.Color(0x8fb8e8) },
      bottomColor: { value: new THREE.Color(0xbfd4ef) },
      sunPos: { value: 0.6 },
    };
    const geo = new THREE.SphereGeometry(500, 32, 16);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;

    this.sun = new THREE.Mesh(
      new THREE.SphereGeometry(8, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff2c4, fog: false })
    );
    this.sun.frustumCulled = false;

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.sunLight.position.set(60, 100, 40);
  }

  update(time: number, camera: THREE.Camera) {
    const cycle = (time * 0.035) % (Math.PI * 2);
    const sunY = Math.sin(cycle);
    const sunX = Math.cos(cycle);
    this.isDay = sunY > 0.05;
    const t = ((cycle / (Math.PI * 2)) * 24 + 6) % 24;
    const hh = Math.floor(t);
    const mm = Math.floor((t - hh) * 60);
    this.timeLabel = `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")} ${this.isDay ? "白天" : "夜晚"}`;
    const dist = 300;
    this.sun.position.set(
      camera.position.x + sunX * dist,
      camera.position.y + Math.max(sunY, -0.2) * dist,
      camera.position.z - 60
    );
    this.sunLight.position.set(
      camera.position.x + sunX * 80,
      camera.position.y + Math.max(sunY, 0.05) * 100,
      camera.position.z - 40
    );
    this.sunLight.target.position.copy(camera.position);
    this.uniforms.sunPos.value = Math.max(0, sunY);

    const dayFactor = THREE.MathUtils.clamp(sunY * 1.4 + 0.25, 0.12, 1);
    this.sunLight.intensity = 0.4 + dayFactor * 0.95;
    this.uniforms.topColor.value.setRGB(
      0.16 * dayFactor + 0.02,
      0.43 * dayFactor + 0.02,
      0.86 * dayFactor + 0.05
    );
  }
}
