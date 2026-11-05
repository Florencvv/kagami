// lands_lake.js - LAKE (endless sunset salt-flat mirror) + SKY (same sky, no ground) + the painted mirror shader used by
// the lake and the PASS ice. Dept LANDS.
import * as THREE from 'three';
import { V3, lerp, dirAE, paintedSky, cumulus, stratus, mountainRing, ridge, makeCut, splitPatch } from './lands_sky.js';

// sun straight down -Z, 2.6 deg up: a side shot along X with the camera looking -Z puts the sun between the duellists
export const LAKE_SUN = dirAE(0, 2.6);
const CLOUD_LIGHT = dirAE(0, 14);

// ------------------------------------------------------------------ painted mirror (lake / ice)
// Live reflection (engine MIRROR pass) x Fresnel, slightly cooler + darker than the sky, faint long horizontal strokes,
// hexagonal salt-crust ridges that appear when looking steeply down, cracks (Voronoi plates with per-plate reflection
// offsets, white-hot crack lines racing out from a centre), heal (a silver mercury front closing them), and for the ice:
// frost, old hairline cracks and the eye-shaped omen crack.
export function mirrorWater(ctx, o = {}) {
  const { A } = ctx, ice = o.kind === 'ice';
  const { NOISE, GLOBAL_PARS, MIRROR } = A.GLSL;
  const U = {
    uId: { value: o.id ?? (ice ? 121 : 120) },
    uIce: { value: ice ? 1 : 0 },
    uTint: { value: new THREE.Color(o.tint ?? (ice ? '#dfe8ff' : '#e4def2')) },
    uBase: { value: new THREE.Color(o.base ?? (ice ? '#b9c8ec' : '#c9b6c8')) },
    uFallback: { value: new THREE.Color(o.fallback ?? (ice ? '#c6d2f2' : '#e8a890')) },
    uFres: { value: o.fresnel ?? (ice ? 0.55 : 0.82) },
    uDarken: { value: o.darken ?? (ice ? 0.05 : 0.07) },
    uStroke: { value: o.stroke ?? 1 },
    uHex: { value: o.hex ?? (ice ? 0 : 1) }, uHexCol: { value: new THREE.Color(o.hexColor ?? '#fff6ee') },
    uStrokeDir: { value: new THREE.Vector2(1, 0) },
    uCrack: { value: new THREE.Vector4(0, 0, 0, 0) },        // centre x, z, front radius (m), amount 0..1
    uHeal: { value: new THREE.Vector2(0, 0) },               // heal front radius (m), amount 0..1
    uCrackCol: { value: new THREE.Color('#fffaf0') }, uCrackGlow: { value: new THREE.Color('#ffd9a0') },
    uEye: { value: new THREE.Vector4(o.centre?.x ?? 0, o.centre?.z ?? 0, 0, 0) },   // ice: eye crack centre x, z, size, k
    uRingCol: { value: new THREE.Color(ice ? '#ffffff' : '#fff2dc') },
  };
  const fs = /* glsl */ `
${NOISE}
${GLOBAL_PARS}
${MIRROR}
uniform vec3 uTint, uBase, uFallback, uHexCol, uCrackCol, uCrackGlow, uRingCol;
uniform float uId, uIce, uFres, uDarken, uStroke, uHex;
uniform vec2 uStrokeDir, uHeal; uniform vec4 uCrack, uEye;
vec2 h22(vec2 p){ return vec2(hash12(p), hash12(p + 17.31)); }
// voronoi: x = distance to the nearest edge, yz = nearest cell id
vec3 voro(vec2 p){
  vec2 n = floor(p), f = fract(p); vec2 mg, mr; float md = 8.0;
  for(int j = -1; j <= 1; j++) for(int i = -1; i <= 1; i++){
    vec2 g = vec2(float(i), float(j)); vec2 r = g + h22(n + g) * 0.9 + 0.05 - f; float d = dot(r, r);
    if(d < md){ md = d; mr = r; mg = g; } }
  md = 8.0;
  for(int j = -2; j <= 2; j++) for(int i = -2; i <= 2; i++){
    vec2 g = mg + vec2(float(i), float(j)); vec2 r = g + h22(n + g) * 0.9 + 0.05 - f;
    if(dot(mr - r, mr - r) > 1e-5) md = min(md, dot(0.5 * (mr + r), normalize(r - mr))); }
  return vec3(md, n + mg);
}
// hexagon edge distance (cells of size 1)
float hexEdge(vec2 p){
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 hc = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - hc.xy * s, p - (hc.zw + 0.5) * s);
  vec2 q = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw;
  q = abs(q); return 0.5 - max(dot(q, s * 0.5), q.x);
}
void main(){
  if(uReflectPass > 0.5) discard;
  vec3 N = vec3(0.0, 1.0, 0.0);
  vec3 V = normalize(cameraPosition - vW);
  float cosV = abs(dot(N, V));
  float dist = length(cameraPosition - vW);
  vec2 xz = vW.xz;
  // ---- cracks: Voronoi plates inside the crack front
  float crackLine = 0.0, crackGlow = 0.0; vec2 plateOff = vec2(0.0); float plateShade = 0.0, mercury = 0.0;
  if(uCrack.w > 0.0){
    vec2 c0 = uCrack.xy; float r = length(xz - c0);
    float jag = (vnoise(xz * 0.02) - 0.5) * 0.25 * uCrack.z;
    float inside = smoothstep(uCrack.z + jag, uCrack.z + jag - 30.0, r);
    float cell = mix(9.0, 60.0, smoothstep(10.0, 900.0, r));             // plates grow with distance from the centre
    vec2 q = xz / cell + vec2(vnoise(xz * 0.05), vnoise(xz * 0.05 + 7.0)) * 0.35;
    vec3 v1 = voro(q);
    vec3 v2 = voro(q * 3.1 + 11.0);                                        // finer branches
    float pw = fwidth(q.x) * 1.3;
    float healMask = 1.0;
    if(uHeal.y > 0.0){                                                     // healed inside the heal front (closes outward)
      float hf = uHeal.x + (vnoise(xz * 0.03) - 0.5) * 40.0;
      healMask = smoothstep(hf - 25.0, hf + 5.0, r);
      mercury = exp(-pow((r - hf) / 9.0, 2.0)) * uHeal.y * (1.0 - smoothstep(0.92, 1.0, uHeal.y));
    }
    float k = inside * uCrack.w * healMask;
    float w1 = (0.022 + 0.05 * smoothstep(60.0, 0.0, r)) * mix(1.0, 0.45, smoothstep(150.0, 1500.0, dist));
    // grazing views: fwidth blows up along the view (screen y), so the AA band would paint the whole plate edge as a
    // wide white strip (a white floor). Keep the band thin (capped) and fade its strength by the real coverage
    // (line width / filter width), leaving thin bright lines + the soft glow (emissive -> bloom).
    float pxQ = length(dFdx(q));                                            // one pixel across (not foreshortened)
    w1 = min(w1, pxQ * (1.8 + 10.0 * smoothstep(0.5, 0.9, cosV)));            // low views: lines a few px, not metres
    float pwC = min(pw, w1 * 1.2 + 0.004);
    float cov1 = clamp(2.2 * w1 / max(pw, 1e-4), 0.22, 1.0);
    float l1 = (1.0 - smoothstep(w1, w1 + pwC, v1.x)) * cov1;
    float pw2 = pw * 3.1, pw2C = min(pw2, 0.04);
    float l2 = (1.0 - smoothstep(0.03, 0.03 + pw2C, v2.x)) * step(0.55, hash12(v2.yz)) * 0.8 * clamp(2.0 * 0.03 / max(pw2, 1e-4), 0.18, 1.0);
    crackLine = max(l1, l2 * (1.0 - smoothstep(200.0, 900.0, dist))) * k * mix(1.0, 0.6, smoothstep(400.0, 2500.0, dist));
    crackGlow = exp(-pow((r - uCrack.z) / max(uCrack.z * 0.08, 20.0), 2.0)) * uCrack.w * healMask;   // hot front
    vec2 hv = h22(v1.yz) - 0.5;
    plateOff = hv * 0.9 * k;                                               // each plate tilts: its reflection shifts
    plateShade = (hash12(v1.yz + 3.0) - 0.5) * k;
  }
  // ---- reflection
  bool live = uMirror.x > 0.5;
  vec3 wp = vW + vec3(plateOff.x, 0.0, plateOff.y) * 6.0;
  vec3 refl = uFallback;
  if(live){
    refl = mirrorSample(wp, 1.0);
    // soften the half-res reflection (no paint pass there): 4 diagonal taps around the projected point
    vec4 pp = uReflectVP * vec4(wp.x, uMirror.y, wp.z, 1.0);
    vec2 uv0 = pp.xy / pp.w * 0.5 + 0.5, tx = 1.0 / vec2(textureSize(uReflect, 0));
    vec3 tb = texture(uReflect, uv0 + tx * vec2(1.3, 0.9)).rgb + texture(uReflect, uv0 + tx * vec2(-1.3, -0.9)).rgb
            + texture(uReflect, uv0 + tx * vec2(-0.9, 1.3)).rgb + texture(uReflect, uv0 + tx * vec2(0.9, -1.3)).rgb;
    refl = refl * 0.4 + tb * 0.15;
  }
  float fr = mix(uFres, 1.0, pow(1.0 - cosV, 3.0));
  float on = clamp(fr * (live ? uMirror.z : 1.0), 0.0, 1.0);
  vec3 c = mix(uBase, refl * uTint * (1.0 - uDarken), on);
  float emis = live ? mirrorEmis * on : 0.0;
  // ---- painted long strokes (value + hue), faint, longer far away
  vec2 sd = normalize(uStrokeDir), sn = vec2(-sd.y, sd.x);
  float along = dot(xz, sd), across = dot(xz, sn);
  float s1 = vnoise(vec2(along * 0.02, across * 0.6));
  float s2 = vnoise(vec2(along * 0.05 + 3.1, across * 1.7 + 1.7));
  float s3 = vnoise(vec2(along * 0.006, across * 0.12) + 9.0);
  float sAmt = uStroke * (0.6 + 0.4 * smoothstep(5.0, 60.0, dist));
  c *= 1.0 + ((s1 - 0.5) * 0.10 + (s2 - 0.5) * 0.06 + (s3 - 0.5) * 0.08) * sAmt;
  c = mix(c, c * vec3(1.05, 0.97, 1.06), smoothstep(0.6, 0.8, s2) * sAmt * 0.45);
  c = mix(c, c * vec3(0.96, 1.0, 1.06), smoothstep(0.62, 0.85, s3) * sAmt * 0.35);
  // ---- hexagonal salt crust: thin pale ridges seen when looking steeply down (near only, anti-aliased)
  if(uHex > 0.0){
    vec2 hp = xz / 1.9 + vec2(vnoise(xz * 0.4), vnoise(xz * 0.4 + 5.0)) * 0.22;
    float he = hexEdge(hp);
    float fw = fwidth(hp.x) * 1.2;
    float line = 1.0 - smoothstep(0.014, 0.014 + fw, he);
    // only near the camera: fades out with distance / height (gone by ~50 m), thin drawn lines
    float vis = smoothstep(0.35, 0.8, cosV) * (1.0 - smoothstep(0.02, 0.045, fw)) * (1.0 - smoothstep(10.0, 48.0, dist)) * uHex;
    float broken = smoothstep(0.25, 0.5, vnoise(xz * 1.3));                 // drawn, not perfect: gaps in the ridges
    c = mix(c, mix(c, uHexCol, 0.45), line * vis * broken);
    // the salt floor tint under the water near the camera
    c = mix(c, c * vec3(1.03, 1.0, 1.04) + vec3(0.02), vis * 0.3);
  }
  // ---- ice: frost patches, snow dusting at the edge, old hairline cracks, the omen eye crack
  if(uIce > 0.5){
    vec2 lc = xz - uEye.xy;
    float rr = length(lc * vec2(1.0, 1.15));
    float fro = fbm2(xz * 0.35) + (vnoise(xz * 2.2) - 0.5) * 0.25;
    float frost = smoothstep(0.55, 0.75, fro + smoothstep(9.0, 15.5, rr) * 0.45);
    c = mix(c, vec3(0.93, 0.93, 1.0), frost * 0.75);
    c = mix(c, vec3(1.0, 0.97, 0.98), smoothstep(14.0, 15.6, rr + (vnoise(xz * 1.5) - 0.5) * 1.2));   // snow at the rim
    vec3 vv = voro(xz * 0.22 + 3.0);
    float hair = (1.0 - smoothstep(0.012, 0.012 + fwidth(xz.x * 0.22) * 1.5, vv.x)) * step(0.62, hash12(vv.yz));
    c = mix(c, vec3(0.97, 0.98, 1.0), hair * 0.55);
    if(uEye.w > 0.0){                                                       // the omen: an eye-shaped crack opening
      float S = uEye.z, k = uEye.w;
      vec2 e = lc / S;
      float ex = e.x, ey = e.y * mix(5.0, 1.6, k);                          // the lids open with k
      float lid = abs(abs(ey) - (1.0 - ex * ex) * 0.55);
      float lidMask = step(abs(ex), mix(0.4, 1.05, smoothstep(0.0, 0.5, k)));
      float lidL = (1.0 - smoothstep(0.012, 0.03, lid / S * 6.0)) * lidMask;
      float ang = atan(e.y, e.x), rad = length(e);
      float iris = (1.0 - smoothstep(0.012, 0.028, abs(rad - 0.32 * smoothstep(0.3, 0.9, k)))) * step(0.15, k);
      float rays = smoothstep(0.92, 0.99, abs(sin(ang * 9.0 + vnoise(vec2(ang * 3.0, 0.0)) * 2.0))) * smoothstep(1.6 * k, 1.3 * k, rad) * step(0.35, rad) * smoothstep(0.4, 0.8, k);
      float eye = clamp(max(max(lidL, iris), rays), 0.0, 1.0);
      c = mix(c, vec3(1.0), eye);
      emis = max(emis, eye * 1.4);
    }
  }
  // ---- cracks on top (white-hot lines, plates vary in value)
  c *= 1.0 + plateShade * 0.18;
  c = mix(c, uCrackCol, crackLine);
  c += uCrackGlow * crackGlow * 0.6 * (0.5 + crackLine);
  emis = max(emis, crackLine * (0.6 + crackGlow * 1.5));
  c = mix(c, vec3(0.92, 0.95, 1.0), mercury * 0.7);                       // mercury: the healing front is a silver sheen
  emis = max(emis, mercury * 0.8);
  c = mix(c, uRingCol, mirrorRing * 0.8 * (live ? 1.0 : 0.0));
  emis = max(emis, mirrorRing * 0.3);
  writeOut(c, emis, normalize((viewMatrix * vec4(N, 0.0)).xyz), vDepth, uId);
}`;
  const m = A.animeShader(U, fs, {});
  m.userData.mirror = true; m.name = 'lands_mirror';
  const api = {
    uniforms: U,
    crack(k, centre = V3(0, 0, 0), maxR = 4200) {   // k 0..1: front radius = k^1.4 * maxR, cracks persist behind it
      U.uCrack.value.set(centre.x, centre.z, Math.pow(Math.max(k, 0), 1.4) * maxR, k > 0 ? 1 : 0);
    },
    heal(k, maxR = 4200) { U.uHeal.value.set(Math.pow(Math.max(k, 0), 1.25) * maxR * 1.05, k); },
    eye(k, size = 7, centre) { if (centre) U.uEye.value.set(centre.x, centre.z, size, k); else { U.uEye.value.z = size; U.uEye.value.w = k; } },
    strokeDir(angRad) { U.uStrokeDir.value.set(Math.cos(angRad), Math.sin(angRad)); },
  };
  m.userData.api = api;
  return m;
}

/// ------------------------------------------------------------------ sunset sky + clouds (shared by LAKE and SKY)
// blazing anime sunset: ultramarine zenith -> violet -> hot coral -> orange-gold horizon around a big haloed sun
function sunsetSky(A) {
  return paintedSky(A, {
    sun: LAKE_SUN, sunR: 0.06, sunColor: '#fff2b8', haloColor: '#ff9a3c', halo: 0.62, sunBloom: 1.25,
    zen: '#101a62', high: '#4a2f92', low: '#ec6a7c', hor: '#ff9a3a', antiHor: '#f0889a', glow: '#ffc457', below: '#f2a08a',
    heights: [0.05, 0.16, 0.36, 0], glowAmt: 0.95, glowPow: 5, streak: 1, streakLit: '#ffd8a8', streakShade: '#a070b8',
    streakBand: [0.16, 0.75], streakAmt: 0.5, strata: 0.4, strataColor: '#d8506e',
  });
}
// cloud palettes: deep (base / core shadow) -> shade (lavender-blue) -> mid (rose) -> lit (gold-pink) -> hot (gold) + rim
const PAL = {
  left: { deep: '#3c2f86', shade: '#7262bc', mid: '#d0729e', lit: '#ff9e8c', hot: '#ffcc7c', rim: '#ffe49c' },
  right: { deep: '#33378a', shade: '#6a6cbc', mid: '#e0807e', lit: '#ffae74', hot: '#ffd480', rim: '#ffeaa8' },
  back: { deep: '#46449a', shade: '#7c78c4', mid: '#d88cb8', lit: '#ffaaa6', hot: '#ffd2b4', rim: '#ffe8d8' },
  far: { deep: '#5a4a9a', shade: '#8a70ba', mid: '#e08aa2', lit: '#ffae90', hot: '#ffcc98', rim: '#ffe6b4' },
};
// painted light cheat per cloud: toward the sun (horizontally), up, and toward the camera so the sun-facing side shows
const SUN_PT = V3(0, 0, -7000);
function cloudLight(c0, up = 0.85, cam = 0.6) {
  if (c0.z > 0) { up = 1.25; cam = -0.15; }               // behind the camera (anti-sun): lit tops, cool shaded fronts
  const toSun = V3(SUN_PT.x - c0.x, 0, SUN_PT.z - c0.z).normalize(), toCam = V3(-c0.x, 0, 300 - c0.z).normalize();
  return toSun.add(V3(0, up, 0)).addScaledVector(toCam, cam).normalize();
}
function sunsetClouds(A, rng, CUT, o = {}) {
  const g = new THREE.Group(); g.name = 'clouds';
  const towers = o.towers ?? [
    // az, dist, width, height, base y, palette, shape, lean
    [-24, 3900, 1300, 820, 50, 'left', 'tower', 0.12], [-47, 3300, 1000, 1150, 50, 'left', 'anvil', -0.05], [-75, 3600, 1500, 900, 50, 'left', 'tower'],
    [-105, 3000, 900, 1250, 50, 'back', 'tower'],
    [22, 3800, 1500, 640, 50, 'right', 'stack', -0.1], [44, 3100, 1000, 1050, 50, 'right', 'tower', 0.08], [70, 3700, 1300, 950, 50, 'right', 'stack'],
    [100, 3200, 1000, 1100, 50, 'back', 'tower'],
    [135, 3400, 1200, 1000, 50, 'back', 'stack'], [9, 4500, 700, 380, 40, 'right', 'stack'], [175, 3600, 1500, 1300, 50, 'back', 'anvil'],
    [-140, 3300, 1100, 1050, 50, 'back', 'tower'], [-170, 2900, 800, 800, 50, 'back', 'stack'],
  ];
  for (const [az, d, w, h, by, pal, shape, lean] of towers) {
    const c0 = dirAE(az, 0).multiplyScalar(d).setY(by);
    const cl = cumulus(A, rng, { c0, w, h, n: 95, pal: PAL[pal], shape, lean, light: cloudLight(c0), sunW: LAKE_SUN,
      back: Math.cos(az * Math.PI / 180) > 0.5 ? 1 : 0.4 });
    if (CUT) splitPatch(cl.material, CUT);
    g.add(cl);
  }
  // a broken ring of smaller, far cumulus along the horizon (fills the skyline, doubles in the mirror)
  for (let i = 0; i < 16; i++) {
    let az = -180 + (i + rng() * 0.8) * 22.5; if (Math.abs(az) < 16) az += az < 0 ? -14 : 14;
    const d = lerp(4300, 4800, rng()), w = lerp(260, 520, rng()), h = lerp(180, 480, rng());
    const c0 = dirAE(az, 0).multiplyScalar(d).setY(lerp(30, 70, rng()));
    const cl = cumulus(A, rng, { c0, w, h, n: 34, pal: PAL.far, light: cloudLight(c0), sunW: LAKE_SUN, topBias: 0.9, shape: rng() < 0.5 ? 'stack' : 'tower' });
    if (CUT) splitPatch(cl.material, CUT);
    g.add(cl);
  }
  // long thin stratus bands glowing orange across the sun, coral further out, violet at the far ends
  const bands = o.bands ?? [[-4, 4100, 2600, 34, 165], [6, 4300, 3600, 46, 270], [12, 3500, 2400, 30, 470], [-15, 3700, 2600, 40, 620]];
  for (const [az, d, len, th, y] of bands) {
    const c0 = dirAE(az, 0).multiplyScalar(d).setY(y);
    const ax = V3(-Math.cos(az * Math.PI / 180), 0, -Math.sin(az * Math.PI / 180));
    const st = stratus(A, rng, { c0, len, thick: th, sun: LAKE_SUN, axis: ax, n: 30 });
    if (CUT) splitPatch(st.material, CUT);
    g.add(st);
  }
  return g;
}
function farMountains(A, rng) {
  const g = new THREE.Group();
  const r1 = ridge(rng, 5), r2 = ridge(rng, 5);
  const gap = (az) => 1 - 0.85 * Math.exp(-Math.pow(az / 11, 2));                // the sun sits on a clean horizon
  g.add(mountainRing(A, { dist: 4300, sun: LAKE_SUN, color: '#6c5cc8', color2: '#6a64c4', shade: '#4c4aa0', rimColor: '#ffb882', rim: 0.85,
    profile: (az) => (30 + 150 * Math.pow(r1(az * 0.035 + 20), 1.7) + 60 * r1(az * 0.11)) * gap(az) }));
  g.add(mountainRing(A, { dist: 4750, sun: LAKE_SUN, color: '#9a80d0', color2: '#9488d4', shade: '#7a72c0', rimColor: '#ffc89a', rim: 0.7,
    profile: (az) => (60 + 260 * Math.pow(r2(az * 0.025 + 3), 2.0) + 50 * r2(az * 0.09)) * gap(az * 0.8) }));
  return g;
}

export function buildLake(ctx, group) {
  const { A } = ctx, rng = ctx.rng(3202);
  group.add(sunsetSky(A));
  const CUT = makeCut();
  const clouds = sunsetClouds(A, rng, CUT); group.add(clouds);
  group.add(farMountains(A, ctx.rng(3203)));
  // water: a 5 km disc that follows the camera in xz (world-space strokes/hex/cracks stay put)
  const mat = mirrorWater(ctx, { kind: 'lake' });
  const water = new THREE.Mesh(new THREE.CircleGeometry(5000, 128), mat); water.rotation.x = -Math.PI / 2;
  water.frustumCulled = false; water.renderOrder = -50; water.name = 'lake_water';
  water.onBeforeRender = (r, s, cam) => { water.position.set(cam.position.x, 0, cam.position.z); water.updateMatrixWorld(); };
  group.add(water);
  return { water, mat, api: mat.userData.api, clouds, CUT, sunDir: LAKE_SUN.clone() };
}
export function buildSky(ctx, group) {
  const { A } = ctx, rng = ctx.rng(3202);   // same seed: the same clouds as the LAKE
  const sky = sunsetSky(A); sky.material.uniforms.uBelow.value.set('#f0ae98'); group.add(sky);
  const CUT = makeCut();
  const clouds = sunsetClouds(A, rng, CUT); group.add(clouds);
  // extra mid-altitude cumulus nearer the action (leap shots are 200-400 m up)
  const r2 = ctx.rng(3204), near = new THREE.Group(); near.name = 'nearClouds';
  for (const [az, d, w, h, by] of [[-40, 1500, 420, 520, 150], [35, 1400, 380, 480, 180], [150, 1300, 420, 560, 120], [-150, 1600, 460, 600, 140], [95, 1700, 400, 500, 160], [-95, 1500, 380, 460, 130]]) {
    const c0 = dirAE(az, 0).multiplyScalar(d).setY(by);
    const cl = cumulus(A, r2, { c0, w, h, n: 70, pal: az < 0 ? PAL.left : PAL.right, light: cloudLight(c0), sunW: LAKE_SUN, shape: Math.abs(az) > 100 ? 'stack' : 'tower' });
    splitPatch(cl.material, CUT); near.add(cl);
  }
  group.add(near);
  group.add(farMountains(A, ctx.rng(3203)));
  return { sky, clouds, near, CUT };
}
