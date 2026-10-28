import * as THREE from "three";

// Daylight over the garden: one sky function shared by the sky dome, the
// environment map the garden is lit with, and the water's reflection.
// warm sun from camera-right and behind, ~35° up (the garden metadata's light)
export const GARDEN_SUN = new THREE.Vector3(0.5, 0.57, 0.65).normalize();

export const SKY_GLSL = /* glsl */ `
vec3 gardenSky(vec3 d, vec3 sunDir) {
  float h = d.y;
  vec3 zenith = vec3(0.09, 0.28, 0.66);
  vec3 horizon = vec3(0.58, 0.75, 0.92);
  vec3 col = mix(horizon, zenith, pow(smoothstep(0.0, 0.62, h), 0.75));
  // below the horizon: a soft haze (only seen past the far hills)
  col = mix(col, vec3(0.62, 0.7, 0.72), smoothstep(0.0, -0.12, h));
  float sun = max(dot(d, sunDir), 0.0);
  col += vec3(1.0, 0.93, 0.8) * pow(sun, 7.0) * 0.18;
  col += vec3(1.0, 0.96, 0.88) * smoothstep(0.9993, 0.9997, sun) * 8.0;
  return col;
}
`;

const CLOUD_GLSL = /* glsl */ `
float gsHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gsNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(gsHash(i), gsHash(i + vec2(1.0, 0.0)), u.x), mix(gsHash(i + vec2(0.0, 1.0)), gsHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float gsFbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * gsNoise(p);
    p = p * 2.03 + 11.7;
    a *= 0.5;
  }
  return v;
}
// a few soft cumulus, thinning towards the horizon, drifting slowly
float gardenClouds(vec3 d, float t) {
  if (d.y < 0.015) return 0.0;
  vec2 uv = d.xz / (d.y + 0.12) * 0.55 + vec2(t * 0.006, t * 0.002);
  float c = gsFbm(uv * 1.3);
  c = smoothstep(0.63, 0.9, c);
  return c * smoothstep(0.015, 0.16, d.y) * 0.9;
}
`;

export function createSkyMaterial({ clouds = true } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uSunDir: { value: GARDEN_SUN.clone() }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform float uTime;
      varying vec3 vDir;
      ${SKY_GLSL}
      ${clouds ? CLOUD_GLSL : ""}
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = gardenSky(d, uSunDir);
        ${
          clouds
            ? `float c = gardenClouds(d, uTime);
        // lit from the sun's side, a little shaded underneath
        vec3 cloud = mix(vec3(0.82, 0.86, 0.9), vec3(1.04, 1.02, 0.98), smoothstep(-0.2, 0.6, dot(d, uSunDir)));
        col = mix(col, cloud, c);`
            : ""
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

// Environment map for the garden (sky light and reflections), rendered once.
export function createGardenEnvironment(gl) {
  const scene = new THREE.Scene();
  const material = createSkyMaterial({ clouds: false });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), material);
  scene.add(mesh);
  const pmrem = new THREE.PMREMGenerator(gl);
  const target = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  mesh.geometry.dispose();
  material.dispose();
  return target.texture;
}
