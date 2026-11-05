// city_rain.js - CITY rain (dept CITY, round 2): fine layered streaks + small soft splash crowns, drawn on threes.
// Replaces the FX auto rain on the CITY set (city.js mutes fx 'rain'). Everything runs in the vertex shader from
// static instance seeds: drops live on a world-fixed lattice that wraps around boxes in front of the camera, so the
// rain is a pure function of st.t and the camera, and costs no CPU per frame.
//   near  : few long thin streaks 2-12 m from the lens, tinted by the nearest neon / lanterns
//   mid   : many short faint streaks 10-40 m
//   far   : many short, very faint streaks 40-140 m that fade into the haze
// Opaque pixels with ordered-dither coverage (the 2x render downsample turns it into real transparency) and FX id 92:
// no ink, no Kuwahara smear, the city stays readable through it. Main camera only (not in reflections).
// cityRain(ctx, CU) -> { group, update(st, camPos, camFwd, fov, amount) }
import * as THREE from 'three';
import { NL } from './city_mat.js';

const LAY = [   // ahead (m), half xz, half y, px width (internal), alpha, brightness, count, length [min, max]
  { ahead: 6, hx: 6.5, hy: 6, px: 2.2, a: 0.5, b: 0.6, n: 220, len: [1.3, 2.4] },
  { ahead: 24, hx: 17, hy: 15, px: 1.5, a: 0.4, b: 0.5, n: 2600, len: [0.55, 1.1] },
  { ahead: 80, hx: 58, hy: 42, px: 1.3, a: 0.3, b: 0.44, n: 4600, len: [0.9, 1.9] },
];

const HEAD = (A) => `${A.GLSL.NOISE}${A.GLSL.GLOBAL_PARS}`;
const VS_COMMON = /* glsl */ `
varying vec3 vW, vNW, vNV, vLocal, vColor, vNL;
varying float vDepth;
varying vec2 vUv;
varying vec4 vRA;
varying vec3 vTint;
uniform vec4 uLP[${NL}]; uniform vec3 uLC[${NL}];
uniform float uT3, uPxK, uAmt;
uniform vec3 uCamF;
vec3 lightAt(vec3 p, float grow){
  vec3 s = vec3(0.0);
  for(int i = 0; i < ${NL}; i++){
    vec4 L = uLP[i]; vec3 d = L.xyz - p; float r2 = dot(d, d), R2 = L.w * L.w * grow;
    if(r2 > R2) continue;
    float f = 1.0 - r2 / R2; s += uLC[i] * f * f;
  }
  return s;
}
float h11(float x){ return fract(sin(x * 127.1) * 43758.5453); }
void outside(){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vRA = vec4(0.0); vTint = vec3(0.0); vW = vec3(0.0); vNW = vNV = vLocal = vColor = vNL = vec3(0.0); vDepth = 0.0; vUv = vec2(0.0); }
`;

const RAIN_VS = /* glsl */ `
attribute vec4 aR, aR2;          // aR: lattice seed xyz 0..1, layer | aR2: length, fall speed k, dir jitter x, z
uniform vec4 uL[3], uL2[3];      // uL: ahead, half xz, half y, px width | uL2: alpha, brightness
uniform vec3 uDir; uniform float uFall;
${VS_COMMON}
void main(){
  int li = int(aR.w + 0.5);
  vec4 P = uL[li], P2 = uL2[li];
  if(fract(aR.x * 91.7 + aR.z * 13.3 + aR.y * 7.1) > uAmt){ outside(); return; }
  vec3 C = cameraPosition + uCamF * P.x;
  C.y = max(C.y, P.z * 0.8);
  vec3 hb = vec3(P.y, P.z, P.y);
  vec3 dir = normalize(uDir + vec3(aR2.z, 0.0, aR2.w));
  vec3 base = aR.xyz * 2.0 * hb + dir * (uFall * aR2.y * uT3);
  vec3 o = C + mod(base - C + hb, 2.0 * hb) - hb;
  if(o.y < 0.05){ outside(); return; }
  vec3 ax = dir * aR2.x;
  vec3 toC = cameraPosition - o;
  float dist = length(toC);
  if(dist < 1.2){ outside(); return; }
  vec3 sd = normalize(cross(ax, toC) + vec3(1e-6, 0.0, 0.0));
  float w = uPxK * P.w * dist;
  vec3 wp = o - ax * position.y + sd * position.x * w;
  vTint = lightAt(o, 2.2);
  vRA = vec4(position.y, P2.x, P2.y, aR.x);
  vW = wp; vLocal = position; vNL = normalize(toC); vNW = vNL; vNV = vec3(0.0, 0.0, 1.0); vColor = vec3(1.0); vUv = uv;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

// crowns: one small drawn crown per instance, a new place every drawing (on threes), on the street near the lens
const CROWN_VS = /* glsl */ `
attribute vec4 aR;               // seed, size k, -, -
uniform vec4 uCZ;                // ahead, half, street half width, max cam height
${VS_COMMON}
void main(){
  float k = floor(uT3 * 8.0 + 0.5);
  float s = aR.x * 17.13 + k * 3.71;
  vec3 f = normalize(vec3(uCamF.x, 0.0, uCamF.z) + vec3(1e-4, 0.0, 0.0));
  vec3 r = vec3(-f.z, 0.0, f.x);
  float a = h11(s), b = h11(s + 1.7);
  float along = mix(4.0, uCZ.x + uCZ.y, a), side = (b - 0.5) * 2.0 * (0.4 + along * 0.55);
  vec3 o = vec3(cameraPosition.x, 0.0, cameraPosition.z) + f * along + r * side;
  if(abs(o.x) > uCZ.z || cameraPosition.y > uCZ.w || h11(s + 4.2) > uAmt){ outside(); return; }
  vec3 toC = cameraPosition - o; vec3 fw = normalize(vec3(toC.x, 0.0, toC.z) + vec3(1e-5, 0.0, 0.0)); vec3 rt = vec3(fw.z, 0.0, -fw.x);
  float sz = (0.035 + 0.05 * aR.y) * (0.8 + 0.4 * h11(s + 2.9)) * clamp(along / 8.0, 0.7, 1.6);
  vec3 wp = o + rt * position.x * sz * 2.0 + vec3(0.0, (position.y + 0.5) * sz * 1.1, 0.0);
  vTint = lightAt(o + vec3(0.0, 0.5, 0.0), 2.5);
  vRA = vec4(h11(s + 6.1), 0.0, 0.0, 0.0);
  vW = wp; vLocal = position; vNL = fw; vNW = fw; vNV = vec3(0.0, 0.0, 1.0); vColor = vec3(1.0); vUv = uv;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FS_COMMON = /* glsl */ `
varying vec4 vRA; varying vec3 vTint;
uniform vec3 uRainCol, uHaze; uniform float uHazeD;
// 2x2 ordered dither on the internal pixel grid: the 2x downsample turns it into 4-step transparency
float dith(float sh){ vec2 p = mod(floor(gl_FragCoord.xy) + vec2(sh, 0.0), 2.0); float v = p.y < 0.5 ? (p.x < 0.5 ? 0.0 : 2.0) : (p.x < 0.5 ? 3.0 : 1.0); return (v + 0.5) / 4.0; }
`;
const RAIN_FS = (A) => `${HEAD(A)}${FS_COMMON}
void main(){
  if(uReflectPass > 0.5) discard;
  float t = vRA.x;                                      // 0 head (bottom) .. 1 tail
  float prof = smoothstep(0.0, 0.1, t) * pow(1.0 - t, 0.7);
  float a = vRA.y * prof * (1.0 - smoothstep(70.0, 150.0, vDepth) * 0.75);
  if(a <= dith(step(0.5, vRA.w))) discard;
  vec3 c = uRainCol * vRA.z * (0.85 + 0.3 * (1.0 - t)) + vTint * 0.9;
  c = mix(c, uHaze, clamp(vDepth / uHazeD, 0.0, 0.65));
  writeOut(c, clamp(dot(vTint, vec3(0.33)) * 0.5, 0.0, 0.35), vec3(0.0, 0.0, 1.0), vDepth, 92.0);
}`;
const CROWN_FS = (A) => `${HEAD(A)}${FS_COMMON}
void main(){
  if(uReflectPass > 0.5) discard;
  vec2 p = vec2(vUv.x * 2.0 - 1.0, vUv.y);              // x -1..1, y 0..1 (base at 0)
  float sd = vRA.x * 40.0;
  float m = 0.0;
  // 5 thin spikes fanning out from the base, droplets at the tips
  for(int i = 0; i < 5; i++){
    float fi = float(i) - 2.0;
    float ang = fi * 0.3 + (fract(sin(sd + fi * 3.1) * 43.7) - 0.5) * 0.18;
    float L = 0.55 + 0.35 * fract(sin(sd * 1.3 + fi * 7.7) * 91.3) - abs(fi) * 0.08;
    vec2 d = vec2(sin(ang), cos(ang));
    float tq = clamp(dot(p - vec2(fi * 0.12, 0.0), d) / L, 0.0, 1.0);
    vec2 q = p - vec2(fi * 0.12, 0.0) - d * tq * L;
    m = max(m, step(length(q), 0.05 * (1.0 - tq * 0.6)));
    m = max(m, step(length(p - vec2(fi * 0.12, 0.0) - d * (L + 0.12)), 0.06));
  }
  m = max(m, step(length((p - vec2(0.0, 0.03)) * vec2(1.0, 4.0)), 0.6) * step(0.42, length((p - vec2(0.0, 0.03)) * vec2(1.0, 4.0))));   // base rim
  if(m < 0.5 || 0.55 <= dith(0.0)) discard;
  vec3 c = uRainCol * 0.5 + vTint * 0.7;
  writeOut(c, 0.08, vec3(0.0, 0.0, 1.0), vDepth, 92.0);
}`;

export function cityRain(ctx, CU) {
  const { A } = ctx;
  const rng = ctx.rng(3290);
  const group = new THREE.Group(); group.name = 'city_rain';
  const shared = {
    uLP: CU.uLP, uLC: CU.uLC, uT3: { value: 0 }, uPxK: { value: 0.001 }, uAmt: { value: 1 }, uCamF: { value: new THREE.Vector3(0, 0, -1) },
    uRainCol: { value: new THREE.Color('#c4c8f4') }, uHaze: { value: new THREE.Color('#7a5aa8') }, uHazeD: { value: 240 },
  };
  // ---- streaks
  const N = LAY.reduce((s, l) => s + l.n, 0);
  const g = new THREE.InstancedBufferGeometry();
  const pl = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  g.index = pl.index; g.setAttribute('position', pl.attributes.position); g.setAttribute('uv', pl.attributes.uv);
  const aR = new Float32Array(N * 4), aR2 = new Float32Array(N * 4);
  let i = 0;
  LAY.forEach((l, li) => {
    for (let k = 0; k < l.n; k++, i++) {
      aR.set([rng(), rng(), rng(), li], i * 4);
      aR2.set([l.len[0] + rng() * (l.len[1] - l.len[0]), 0.85 + rng() * 0.3, (rng() - 0.5) * 0.08, (rng() - 0.5) * 0.06], i * 4);
    }
  });
  g.setAttribute('aR', new THREE.InstancedBufferAttribute(aR, 4)); g.setAttribute('aR2', new THREE.InstancedBufferAttribute(aR2, 4));
  g.instanceCount = N;
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: RAIN_VS, fragmentShader: RAIN_FS(A), side: THREE.DoubleSide,
    uniforms: { ...A.AU, ...shared,
      uL: { value: LAY.map((l) => new THREE.Vector4(l.ahead, l.hx, l.hy, l.px)) },
      uL2: { value: LAY.map((l) => new THREE.Vector4(l.a, l.b, 0, 0)) },
      uDir: { value: new THREE.Vector3(0.13, -1, 0.05) }, uFall: { value: 9.5 } },
  });
  m.name = 'city_rain';
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.name = 'city_rain_streaks'; mesh.renderOrder = 5;
  mesh.layers.set(ctx.LAYER?.MAIN_ONLY ?? 1); group.add(mesh);
  // ---- crowns
  const NC = 14;
  const gc = new THREE.InstancedBufferGeometry();
  const pc = new THREE.PlaneGeometry(1, 1);
  gc.index = pc.index; gc.setAttribute('position', pc.attributes.position); gc.setAttribute('uv', pc.attributes.uv);
  const cR = new Float32Array(NC * 4);
  for (let k = 0; k < NC; k++) cR.set([rng(), rng(), 0, 0], k * 4);
  gc.setAttribute('aR', new THREE.InstancedBufferAttribute(cR, 4)); gc.instanceCount = NC;
  const mc = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: CROWN_VS, fragmentShader: CROWN_FS(A), side: THREE.DoubleSide,
    uniforms: { ...A.AU, ...shared, uCZ: { value: new THREE.Vector4(16, 10, 14.6, 14) } },
  });
  mc.name = 'city_crowns';
  const crowns = new THREE.Mesh(gc, mc); crowns.frustumCulled = false; crowns.name = 'city_rain_crowns'; crowns.renderOrder = 5;
  crowns.layers.set(ctx.LAYER?.MAIN_ONLY ?? 1); group.add(crowns);

  const IH = () => (ctx.post?.IH ?? (ctx.H ?? 1040) * (ctx.S ?? 1));
  function update(st, camF, fov, amount = 1, haze) {
    shared.uT3.value = A.onThrees(st.t);
    shared.uPxK.value = (2 * Math.tan((fov * Math.PI) / 360)) / IH();
    shared.uCamF.value.copy(camF);
    shared.uAmt.value = amount;
    if (haze) shared.uHaze.value.set(haze);
    group.visible = amount > 0;
  }
  return { group, update, uniforms: shared };
}
