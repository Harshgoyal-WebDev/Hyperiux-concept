import * as THREE from "three";

// Daylight over the garden: one sky function shared by the sky dome, the
// environment map the garden is lit with, and the water's reflection.
// warm sun from camera-right and behind, ~35° up (the garden metadata's light)
export const GARDEN_SUN = new THREE.Vector3(0.5, 0.57, 0.65).normalize();

export const SKY_GLSL = /* glsl */ `
vec3 gardenSky(vec3 d, vec3 sunDir) {
  float h = d.y;
  // a bright, clear blue, paling to the horizon
  vec3 zenith = vec3(0.07, 0.3, 0.82);
  vec3 horizon = vec3(0.6, 0.79, 0.98);
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
// soft cumulus drifting across on the wind (uCover of the sky, at uSpeed),
// their shapes slowly changing as they go (the noise is warped by itself,
// the warp drifting a little slower than the clouds), thinning towards the
// horizon; shade: 1 on their sunlit tops, less in their thick undersides
uniform float uCover;
uniform float uSpeed;
float gardenClouds(vec3 d, float t, vec3 sunDir, out float shade) {
  shade = 1.0;
  if (d.y < 0.012) return 0.0;
  vec2 uv = d.xz / (d.y + 0.1) * 0.5;
  vec2 wind = vec2(0.045, 0.018) * t * uSpeed;
  float warp = gsFbm(uv * 0.7 + wind * 0.6 + 3.1);
  vec2 q = uv * 1.25 + wind + warp * 0.7;
  float c = gsFbm(q);
  float th = mix(0.78, 0.44, uCover);
  float dens = smoothstep(th, th + 0.22, c);
  // the side towards the sun is thinner: lit; deep inside, shaded
  float toward = gsFbm(q + normalize(sunDir.xz + 1e-4) * 0.08);
  shade = clamp(0.86 + (c - toward) * 3.0 - smoothstep(th + 0.1, th + 0.4, c) * 0.18, 0.6, 1.08);
  return dens * smoothstep(0.012, 0.14, d.y);
}
`;

export function createSkyMaterial({ clouds = true } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uSunDir: { value: GARDEN_SUN.clone() }, uTime: { value: 0 }, uCover: { value: 0.55 }, uSpeed: { value: 1 } },
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
            ? `float shade;
        float c = gardenClouds(d, uTime, uSunDir, shade);
        // white in the sun, cool grey in their own shade, warmer towards the sun
        vec3 cloud = mix(vec3(0.7, 0.76, 0.86), vec3(1.08, 1.06, 1.02), smoothstep(0.6, 1.05, shade));
        cloud *= 0.92 + 0.12 * smoothstep(-0.2, 0.6, dot(d, uSunDir));
        col = mix(col, cloud, c * 0.95);`
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
  // (disposing the map frees its render target too, not just the texture)
  const texture = target.texture;
  const disposeTexture = texture.dispose.bind(texture);
  texture.dispose = () => {
    target.dispose();
    disposeTexture();
  };
  return texture;
}
