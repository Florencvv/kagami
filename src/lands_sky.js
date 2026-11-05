// lands_sky.js - painted skies, towering cumulus, stratus, far mountains for LAKE / SKY / PASS (dept LANDS).
// Pure code: every texture/shape is generated, seeded, no files. See lands.js for the public API.
import * as THREE from 'three';

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const D2R = Math.PI / 180;
// unit direction from azimuth (deg, 0 = -Z, +90 = +X) and elevation (deg)
export const dirAE = (az, el = 0) => V3(Math.sin(az * D2R) * Math.cos(el * D2R), Math.sin(el * D2R), -Math.cos(az * D2R) * Math.cos(el * D2R));

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = V3(), _e = new THREE.Euler();
export function instanced(geo, mat, items) {
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((r, i) => {
    _q.setFromEuler(_e.set(...(r.rot || [0, 0, 0]), 'YXZ'));
    m.setMatrixAt(i, _m4.compose(r.pos, _q, r.scl || _s.set(1, 1, 1)));
    if (r.col) m.setColorAt(i, new THREE.Color(r.col));
  });
  m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.frustumCulled = false; return m;
}

// ------------------------------------------------------------------ painted sky (custom: azimuth-aware sunset/dawn)
// Elevation gradient (horizon / low / high / zenith) + a horizon that warms toward the sun, a wide sun glow, a big disk
// with halo, thin strata crossing the disk, high painted streak clouds lit by the sun, brush noise in 3D (no zenith pinch).
export function paintedSky(A, o) {
  const { NOISE, GLOBAL_PARS } = A.GLSL;
  const C = (c) => new THREE.Color(c);
  const U = {
    uZen: { value: C(o.zen) }, uHigh: { value: C(o.high) }, uLow: { value: C(o.low) }, uHor: { value: C(o.hor) },
    uAntiHor: { value: C(o.antiHor ?? o.hor) }, uGlow: { value: C(o.glow) }, uBelow: { value: C(o.below ?? o.hor) },
    uSun: { value: o.sun.clone().normalize() }, uSunR: { value: o.sunR ?? 0.05 }, uSunC: { value: C(o.sunColor ?? '#ffd08a') },
    uHaloC: { value: C(o.haloColor ?? '#ffb070') }, uHalo: { value: o.halo ?? 0.5 }, uSunEmis: { value: o.sunBloom ?? 0.9 },
    uFlare: { value: 0 }, uGlowAmt: { value: o.glowAmt ?? 0.85 }, uGlowPow: { value: o.glowPow ?? 5 },
    uStreak: { value: o.streak ?? 1 }, uStreakLit: { value: C(o.streakLit ?? '#ffd8b0') }, uStreakShade: { value: C(o.streakShade ?? '#9a84c4') },
    uStreakB: { value: new THREE.Vector3(...(o.streakBand ?? [0.04, 0.62]), o.streakAmt ?? 0.8) }, uStrata: { value: o.strata ?? 1 }, uStrataC: { value: C(o.strataColor ?? '#c8708a') }, uBrush: { value: o.brush ?? 1 },
    uH: { value: new THREE.Vector4(...(o.heights ?? [0.1, 0.32, 0.85, 0])) },
  };
  const fs = /* glsl */ `
${NOISE}
${GLOBAL_PARS}
uniform vec3 uZen, uHigh, uLow, uHor, uAntiHor, uGlow, uBelow, uSun, uSunC, uHaloC, uStreakLit, uStreakShade, uStrataC;
uniform float uSunR, uHalo, uSunEmis, uFlare, uGlowAmt, uGlowPow, uStreak, uStrata, uBrush;
uniform vec4 uH; uniform vec3 uStreakB;
void main(){
  vec3 d = normalize(vW - cameraPosition);
  vec3 S = normalize(uSun);
  float cs = dot(d, S);
  vec2 hd = normalize(d.xz + vec2(1e-5)), hs = normalize(S.xz + vec2(1e-5));
  float sd = dot(hd, hs);                                   // horizontal facing toward the sun (-1..1)
  // brush: long horizontal strokes push the gradient around (3D noise on the view dir, stretched in y)
  float b1 = vnoise3(vec3(d.x * 5.0, d.y * 70.0, d.z * 5.0));
  float b2 = vnoise3(vec3(d.x * 13.0 + 3.0, d.y * 180.0, d.z * 13.0));
  float b3 = fbm3(vec3(d.x * 2.0, d.y * 8.0, d.z * 2.0) + 4.0);
  float below = d.y < 0.0 ? 1.0 : 0.0; d.y = abs(d.y);          // below the horizon: a painted fake mirror of the sky
  float e = d.y + ((b1 - 0.5) * 0.022 + (b3 - 0.5) * 0.05 + (b2 - 0.5) * 0.008) * uBrush;
  float ee = max(e, 0.0);
  vec3 hor = mix(uAntiHor, uHor, smoothstep(-0.7, 0.95, sd));
  vec3 c = mix(hor, uLow, smoothstep(0.0, uH.x, ee));
  c = mix(c, uHigh, smoothstep(uH.x * 0.7, uH.y, ee));
  c = mix(c, uZen, smoothstep(uH.y * 0.8, uH.z, ee));
  // wide warm wash toward the sun, strongest at the horizon
  float g = pow(max(cs, 0.0), uGlowPow) * (1.0 - smoothstep(0.0, 0.22, ee));
  c = mix(c, uGlow, clamp(g * uGlowAmt, 0.0, 1.0));
  // painted value/hue variation
  c *= 1.0 + ((b1 - 0.5) * 0.06 + (b2 - 0.5) * 0.04 + smoothstep(0.62, 0.8, b2) * 0.03) * uBrush;
  c = mix(c, c * vec3(1.06, 0.96, 1.05), clamp((b3 - 0.45) * 1.6, -0.6, 1.0) * uBrush * 0.5);
  // high streak clouds (thin, long, lit on the sun side)
  if(uStreak > 0.0){
    float band = smoothstep(uStreakB.x, uStreakB.x + 0.08, ee) * (1.0 - smoothstep(uStreakB.y - 0.2, uStreakB.y, ee));
    vec3 q = vec3(d.x * 1.4, d.y * 26.0, d.z * 1.4);
    float s = fbm3(q + 11.0);
    float s2 = vnoise3(vec3(d.x * 9.0, d.y * 140.0, d.z * 9.0) + 2.0);
    float s3 = vnoise3(vec3(d.x * 3.0, d.y * 3.0, d.z * 3.0) + 7.0);      // patches: streaks only in some parts of the sky
    float st = smoothstep(0.56, 0.66, s + (s2 - 0.5) * 0.22) * band * smoothstep(0.35, 0.6, s3) * uStreak;
    float litK = clamp(0.5 + 0.5 * cs, 0.0, 1.0);
    vec3 sc = mix(uStreakShade, uStreakLit, pow(litK, 2.0));
    float edge = smoothstep(0.66, 0.72, s + (s2 - 0.5) * 0.22);        // lit core inside each streak
    sc = mix(sc, mix(sc, vec3(1.0, 0.95, 0.85), 0.35 * litK), edge);
    c = mix(c, sc, st * uStreakB.z);
  }
  float emis = 0.0;
  // sun: big disk + halo, thin strata crossing its lower half
  float ang = acos(clamp(cs, -1.0, 1.0));
  float halo = (uHalo + uFlare) * (exp(-ang / (uSunR * 1.6)) * 0.7 + exp(-pow(ang / (uSunR * 3.2), 2.0)) * 0.35);
  halo *= 0.88 + 0.24 * vnoise3(d * 60.0);
  c += uHaloC * halo;
  float aa = fwidth(ang) * 1.2;
  float disk = smoothstep(uSunR + aa, uSunR - aa, ang);
  vec3 dc = mix(uSunC, vec3(1.0, 0.98, 0.9), smoothstep(uSunR, 0.0, ang) * 0.7);
  // strata: thin horizontal bands at the sun's lower half
  float rel = (d.y - S.y) / uSunR;
  float strata = 0.0;
  if(uStrata > 0.0){
    float w1 = smoothstep(0.07, 0.0, abs(rel + 0.5 + (vnoise3(d * 90.0) - 0.5) * 0.08));
    float w2 = smoothstep(0.05, 0.0, abs(rel + 0.8 + (vnoise3(d * 70.0 + 3.0) - 0.5) * 0.08));
    float span = smoothstep(uSunR * 5.0, uSunR * 1.2, abs(ang)) ;
    strata = max(w1, w2 * 0.85) * span * uStrata;
  }
  c = mix(c, dc, disk);
  c = mix(c, mix(uStrataC, uSunC, 0.25 * (1.0 - disk)), strata * mix(0.55, 0.9, disk));
  emis = disk * uSunEmis * (1.0 - strata * 0.7) * (1.0 + uFlare) + halo * 0.15;
  // below the horizon (SKY set without ground)
  if(below > 0.5){ c = mix(c * vec3(0.9, 0.9, 1.0), uBelow, 0.25 + 0.2 * smoothstep(0.0, 0.3, d.y)); emis *= 0.6; }
  writeOut(c, emis, vec3(0.0, 0.0, 1.0), 10000.0, 0.0);
}`;
  const m = A.animeShader(U, fs, { side: THREE.BackSide });
  m.depthWrite = false; m.name = 'lands_sky_mat';
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(5200, 64, 32), m);
  mesh.frustumCulled = false; mesh.renderOrder = -100; mesh.name = 'anime_sky'; mesh.userData.lands = true;
  mesh.onBeforeRender = (r, s, cam) => { mesh.position.copy(cam.position); mesh.updateMatrixWorld(); };
  mesh.userData.U = U;
  return mesh;
}

// ------------------------------------------------------------------ X split for cloud materials (shared uniform objects)
// Every cloud material patched with splitPatch() reads the same CUT uniforms: two planes through uCutC with normals
// uCutA.xyz / uCutB.xyz; .w = gap half-width (m). Puffs slide away from each plane by uCutPush (instance origin side),
// pixels inside the gap are discarded, a glowing edge band is drawn on the cut faces.
export function makeCut() {
  return {
    uCutC: { value: V3(0, 0, 0) }, uCutA: { value: new THREE.Vector4(1, 0, 0, 0) }, uCutB: { value: new THREE.Vector4(0, 1, 0, 0) },
    uCutPush: { value: 0 }, uCutGlow: { value: new THREE.Color('#fff2d0') }, uCutGlowAmt: { value: 0 },
  };
}
export function splitPatch(m, CUT) {
  Object.assign(m.uniforms, CUT);
  let v = m.vertexShader;
  v = v.replace('void main(){', 'uniform vec3 uCutC; uniform vec4 uCutA, uCutB; uniform float uCutPush;\nvoid main(){');
  v = v.replace('vec4 wp = modelMatrix * lp;', `vec4 wp = modelMatrix * lp;
  if(uCutPush > 0.0){
    #ifdef USE_INSTANCING
    vec3 io = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    #else
    vec3 io = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    #endif
    float sa = dot(io - uCutC, uCutA.xyz), sb = dot(io - uCutC, uCutB.xyz);
    float fa = uCutA.w > 0.0 ? exp(-abs(sa) / (uCutA.w * 4.0 + 80.0)) : 0.0, fb = uCutB.w > 0.0 ? exp(-abs(sb) / (uCutB.w * 4.0 + 80.0)) : 0.0;
    wp.xyz += uCutA.xyz * sign(sa) * uCutPush * fa + uCutB.xyz * sign(sb) * uCutPush * fb;
  }`);
  let f = m.fragmentShader;
  f = f.replace('void main(){', 'uniform vec3 uCutC; uniform vec4 uCutA, uCutB; uniform float uCutPush, uCutGlowAmt; uniform vec3 uCutGlow;\nvoid main(){');
  f = f.replace(/writeOut\(c, (\w+), NV, vDepth, uId\);\s*\}\s*$/, (all, em) => `float cutE = 0.0;
  if(uCutA.w > 0.0 || uCutB.w > 0.0){
    float da = abs(dot(vW - uCutC, uCutA.xyz)), db = abs(dot(vW - uCutC, uCutB.xyz));
    float ja = (vnoise(vW.xy * 0.02 + vW.zz * 0.01) - 0.5) * uCutA.w * 0.5;
    float jb = (vnoise(vW.yx * 0.02 + vW.zz * 0.013 + 5.0) - 0.5) * uCutB.w * 0.5;
    if((uCutA.w > 0.0 && da < uCutA.w + ja) || (uCutB.w > 0.0 && db < uCutB.w + jb)) discard;
    float ea = uCutA.w > 0.0 ? 1.0 - smoothstep(uCutA.w + ja, uCutA.w * 1.6 + ja + 6.0, da) : 0.0;
    float eb = uCutB.w > 0.0 ? 1.0 - smoothstep(uCutB.w + jb, uCutB.w * 1.6 + jb + 6.0, db) : 0.0;
    cutE = max(ea, eb) * uCutGlowAmt;
    c = mix(c, uCutGlow, cutE);
  }
  writeOut(c, ${em} + cutE * 1.5, NV, vDepth, uId);
}`);
  if (!f.includes('cutE') || !v.includes('uCutPush * fa')) throw new Error('lands: split patch failed');
  m.vertexShader = v; m.fragmentShader = f; m.needsUpdate = true;
  return m;
}

/// ------------------------------------------------------------------ cumulus tower: painted volume (custom cloud shader)
// Lit as one mass (puffs bend it): 5 painted value steps deep -> shade -> mid -> lit -> hot with brushy boundaries,
// every puff's underside in the shadow of the puff above (layered), darker puff creases, flat cool base, a silver lining
// on the sun-side silhouette, blazing rims when backlit near the sun, ragged brushed puff edges (noise discard).
// pal = {deep, shade, mid, lit, hot, rim}; light = painted light dir (cheat per cloud); sunW = the real sun (backlight).
const CLOUD_FS = (A) => /* glsl */ `
${A.GLSL.NOISE}
${A.GLSL.GLOBAL_PARS}
uniform vec3 uDeepC, uShC, uMidC, uLitC, uHotC, uRimC, uL, uSunW;
uniform vec4 uMass; uniform vec3 uMassScale; uniform vec2 uBase; uniform vec4 uSteps;
uniform float uId, uRimK, uEdge, uBack, uEmisK;
void main(){
  vec3 Np = normalize(vNW);
  if(!gl_FrontFacing) Np = -Np;
  // reflection pass: shade as seen from the real camera (the mirror copy keeps the painted look, only the tint changes)
  vec3 camP = uReflectPass > 0.5 ? vec3(cameraPosition.x, 2.0 * uClip.y - cameraPosition.y, cameraPosition.z) : cameraPosition;
  vec3 V = normalize(camP - vW);
  vec3 Nm = uMass.w > 0.0 ? normalize((vW - uMass.xyz) * uMassScale) : Np;   // no mass (sheets, billows): per puff
  vec3 N = normalize(mix(Np, Nm, uMass.w));
  vec3 L = normalize(uL);
  vec3 q = vW / max(uBase.y, 1.0);
  float n1 = fbm3(q * 3.2 + 3.0) - 0.5;
  float n2 = vnoise3(vec3(q.x * 16.0, q.y * 46.0, q.z * 16.0)) - 0.5;          // horizontal brush strokes
  float n3 = vnoise3(q * 30.0 + 7.0) - 0.5;
  float pf = 1.0 - abs(dot(Np, normalize(cameraPosition - vW)));
  if(pf > uEdge + n3 * 0.22 + n1 * 0.3) discard;                             // ragged brushed puff edges
  float h = clamp((vW.y - uBase.x) / uBase.y, 0.0, 1.0);
  float ndl = dot(N, L) + n1 * 0.36 + n2 * 0.09 + n3 * 0.05 + (h - 0.45) * 0.4;
  vec3 c = uDeepC;
  c = mix(c, uShC, smoothstep(uSteps.x - 0.06, uSteps.x + 0.04, ndl));
  c = mix(c, uMidC, smoothstep(uSteps.y - 0.06, uSteps.y + 0.05, ndl));
  c = mix(c, uLitC, smoothstep(uSteps.z - 0.05, uSteps.z + 0.06, ndl));
  float hot = smoothstep(uSteps.w - 0.05, uSteps.w + 0.07, ndl);
  c = mix(c, uHotC, hot);
  c *= vColor;
  // layered puffs: undersides in the shadow of the puff above, darker creases where puffs overlap
  float lit = smoothstep(uSteps.z - 0.1, uSteps.w, ndl);
  float under = smoothstep(0.1, -0.7, Np.y + n2 * 0.3) * (1.0 - lit * 0.7);
  c = mix(c, mix(uShC, uDeepC, 0.35), under * 0.5);
  float inside = smoothstep(0.55, 0.25, 1.0 - abs(dot(Nm, V)));
  float crease = smoothstep(0.42, 0.8, pf + n3 * 0.2) * inside;
  c = mix(c, c * mix(vec3(0.78, 0.74, 0.9), vec3(1.0), lit * 0.5), crease * 0.55);
  // flat cool base
  c = mix(c, uDeepC, smoothstep(0.14, 0.0, h + n2 * 0.05) * 0.6);
  // silver lining on the sun side of the silhouette, blazing rims when backlit
  float mf = 1.0 - max(dot(Nm, V), 0.0);
  float sunSide = smoothstep(0.15, 0.6, dot(Nm, L) + n1 * 0.4);
  float rim = smoothstep(0.6, 0.72, mf + n2 * 0.2 + n3 * 0.1) * sunSide;
  float toward = pow(max(dot(-V, normalize(uSunW)), 0.0), 14.0);
  rim = max(rim, smoothstep(0.46, 0.62, mf + n2 * 0.25) * toward * uBack);
  rim = clamp(rim * uRimK, 0.0, 1.0);
  c = mix(c, uRimC, rim);
  float emis = (rim * 0.45 + hot * 0.15) * uEmisK;
  vec3 NV = normalize((viewMatrix * vec4(N, 0.0)).xyz);
  writeOut(c, emis, NV, vDepth, uId);
}`;
const CL = (c) => new THREE.Color(c);
export function cloudMaterial(A, o) {
  const p = o.pal;
  const m = A.animeShader({
    uDeepC: { value: CL(p.deep) }, uShC: { value: CL(p.shade) }, uMidC: { value: CL(p.mid) }, uLitC: { value: CL(p.lit) },
    uHotC: { value: CL(p.hot) }, uRimC: { value: CL(p.rim) }, uL: { value: o.light.clone().normalize() }, uSunW: { value: (o.sunW ?? o.light).clone().normalize() },
    uMass: { value: new THREE.Vector4(o.c0.x, o.c0.y + o.h * 0.4, o.c0.z, o.massAmt ?? 0.5) }, uMassScale: { value: new THREE.Vector3(1, 0.62, 1) },
    uBase: { value: new THREE.Vector2(o.c0.y, o.h) }, uSteps: { value: new THREE.Vector4(...(o.steps ?? [-0.5, -0.1, 0.22, 0.56])) },
    uId: { value: A.ID.CLOUD }, uRimK: { value: o.rim ?? 1 }, uEdge: { value: o.edge ?? 0.84 }, uBack: { value: o.back ?? 1 }, uEmisK: { value: o.emis ?? 1 },
  }, CLOUD_FS(A), {});
  m.name = 'lands_cloud';
  return m;
}
// cauliflower: a profile R(f) (narrowing, wobbling), hidden core puffs, silhouette puffs on the profile surface, a top
// cap, then many small detail puffs on the outline; flat squashed base. o.shape: 'tower' (default) | 'anvil' | 'stack'
const PUFF = new THREE.IcosahedronGeometry(1, 3);
export function cumulus(A, rng, o) {
  const { c0, w, h } = o;
  const mat = cloudMaterial(A, { ...o, light: o.light ?? o.lightDir ?? o.sun });
  const n = o.n ?? 80, items = [], dep = o.depth ?? 0.75, ph = rng() * 10, lean = (o.lean ?? (rng() - 0.5) * 0.25) * w;
  const shape = o.shape ?? 'tower';
  const prof = shape === 'anvil' ? (f) => 1 - 0.45 * Math.pow(f, 1.1) + 0.55 * smooth(0.7, 0.95, f)
    : shape === 'stack' ? (f) => 1 - 0.3 * f - 0.18 * Math.sin(f * 9.5 + ph)
    : (f) => 1 - 0.55 * Math.pow(f, 1.25);
  const R = (f) => w * 0.5 * prof(f) * (1 + 0.14 * Math.sin(f * 8 + ph) + 0.08 * Math.sin(f * 19 + ph * 2));
  const at = (f, a, rr) => V3(c0.x + Math.cos(a) * rr + lean * f * f, c0.y + f * h, c0.z + Math.sin(a) * rr * dep);
  const push = (p, r, sq = 0.9) => { const y = Math.max(p.y - c0.y, r * 0.5); const base = y <= r * 0.52;
    const v = 0.95 + rng() * 0.08;
    items.push({ pos: V3(p.x, c0.y + y, p.z), scl: V3(r * 1.12, r * (base ? 0.55 : sq), r), col: new THREE.Color(v, v, v) }); };
  for (let f = 0; f <= 0.9; f += 0.15) push(at(f, 0, 0), R(f) * 0.85, 0.85);
  for (let i = 0; i < n * 1.6; i++) { const f = Math.pow(rng(), o.topBias ?? 0.75), a = rng() * Math.PI * 2;
    push(at(f, a, R(f) * lerp(0.62, 0.92, rng())), R(f) * lerp(0.24, 0.44, rng())); }
  for (let i = 0; i < n * 0.4; i++) { const a = rng() * Math.PI * 2, f = lerp(0.88, 1.02, rng());
    push(at(f, a, R(0.9) * lerp(0.1, 0.7, rng())), R(0.9) * lerp(0.35, 0.6, rng())); }
  for (let i = 0; i < n * 1.4; i++) { const f = Math.pow(rng(), 0.6), a = rng() * Math.PI * 2;
    push(at(f, a, R(f) * lerp(0.95, 1.08, rng())), R(f) * lerp(0.1, 0.19, rng())); }
  const mesh = instanced(PUFF, mat, items);
  mesh.userData = { c0, w, h, mat, kind: 'cumulus' };
  return mesh;
}
// long thin stratus band: glows hot orange-gold where it crosses the sun, pink further out, violet at the ends
const STRATUS_FS = (A) => /* glsl */ `
${A.GLSL.NOISE}
${A.GLSL.GLOBAL_PARS}
uniform vec3 uCore, uMid2, uFar, uTop, uSunW; uniform float uId, uSpread;
void main(){
  vec3 V = normalize(cameraPosition - vW);
  vec3 Np = normalize(vNW); if(!gl_FrontFacing) Np = -Np;
  float pf = 1.0 - abs(dot(Np, V));
  if(uReflectPass > 0.5) V = normalize(vec3(cameraPosition.x, 2.0 * uClip.y - cameraPosition.y, cameraPosition.z) - vW);
  float n2 = vnoise3(vec3(vW.x * 0.004, vW.y * 0.08, vW.z * 0.004)) - 0.5;
  float n3 = vnoise3(vec3(vW.x * 0.02, vW.y * 0.3, vW.z * 0.02) + 4.0) - 0.5;
  if(pf > 0.78 + n2 * 0.35 + n3 * 0.15) discard;
  float near = max(dot(-V, normalize(uSunW)), 0.0);
  float g = pow(near, 70.0 * uSpread), g2 = pow(near, 7.0 * uSpread);
  vec3 c = mix(uFar, uMid2, smoothstep(0.0, 1.0, g2 + n2 * 0.2));
  c = mix(c, uCore, clamp(g * 1.2 + n3 * 0.15, 0.0, 1.0));
  float under = smoothstep(0.25, -0.55, Np.y + n3 * 0.3);          // the low sun lights the undersides
  c = mix(c, uCore, under * (0.25 + 0.55 * g2));
  c = mix(c, uTop, smoothstep(0.15, 0.75, Np.y + n2 * 0.3) * 0.45 * (1.0 - g));
  float emis = g * 1.1 + g2 * under * 0.3;
  vec3 NV = normalize((viewMatrix * vec4(Np, 0.0)).xyz);
  writeOut(c, emis, NV, vDepth, uId);
}`;
export function stratus(A, rng, o) {
  const { c0, len, thick, sun } = o;
  const p = o.pal ?? {};
  const mat = A.animeShader({
    uCore: { value: CL(p.core ?? '#ffb24a') }, uMid2: { value: CL(p.mid ?? '#f47a6a') }, uFar: { value: CL(p.far ?? '#8a5a9e') }, uTop: { value: CL(p.top ?? '#6a4a8c') },
    uSunW: { value: sun.clone().normalize() }, uId: { value: A.ID.CLOUD }, uSpread: { value: o.spread ?? 1 },
  }, STRATUS_FS(A), {});
  mat.name = 'lands_stratus';
  const n = o.n ?? 30, items = [], ax = o.axis ?? V3(1, 0, 0);
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1) - 0.5) * len + (rng() - 0.5) * len / n;
    const taper = 1 - Math.pow(Math.abs(u) / (len * 0.5), 2) * 0.75;
    const r = thick * lerp(0.6, 1.1, rng()) * taper;
    const pp = c0.clone().addScaledVector(ax, u).add(V3(0, (rng() - 0.5) * thick * 0.5, (rng() - 0.5) * thick * 3));
    items.push({ pos: pp, scl: V3(r * lerp(4, 7, rng()), r * 0.45, r * 2), rot: [0, Math.atan2(-ax.z, ax.x), 0], col: new THREE.Color(1, 1, 1) });
  }
  const mesh = instanced(PUFF, mat, items);
  mesh.userData = { c0, mat, kind: 'stratus' };
  return mesh;
}

// ------------------------------------------------------------------ far mountains: ring strips with a ridge profile
// profile(azDeg) -> height (m); painted, hazy, lit rim along the top edge
export function mountainRing(A, o) {
  const { dist, profile, color, color2, shade, rimColor, sun } = o;
  const N = o.seg ?? 720, a0 = o.az0 ?? -180, a1 = o.az1 ?? 180;
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const az = lerp(a0, a1, i / N), d = dirAE(az, 0), hh = profile(az);
    const dd = dist * (1 + 0.04 * Math.sin(az * 0.07));
    // 3 rows: foot, mid shoulder (pushed out a bit so the face has slope + normals), crest
    pos.push(d.x * dd, -20, d.z * dd);
    pos.push(d.x * (dd - hh * 0.6), hh * 0.55, d.z * (dd - hh * 0.6));
    pos.push(d.x * (dd - hh * 1.2), hh, d.z * (dd - hh * 1.2));
    if (i < N) { const k = i * 3; idx.push(k, k + 3, k + 1, k + 1, k + 3, k + 4, k + 1, k + 4, k + 2, k + 2, k + 4, k + 5); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const mat = A.paintedMaterial({ color, color2: color2 ?? color, shade, id: A.ID.PAINT, varScale: 0.004, varAmt: 0.6, bands: true, dab: 0.3,
    stroke: 1.2, strokeScale: 0.01, rim: o.rim ?? 0.8, rimColor: rimColor ?? '#ffd0a0', rimWidth: 0.2, rimTop: 1, light: o.light ?? 0.6, side: THREE.DoubleSide });
  mat.side = THREE.DoubleSide;
  mat.uniforms.uSunDir = { value: sun.clone().normalize() };
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; return m;
}
// value-noise in 1D for ridge profiles (seeded)
export function ridge(rng, oct = 5) {
  const T = Array.from({ length: 1024 }, () => rng());
  const n1 = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(T[((i % 1024) + 1024) % 1024], T[(((i + 1) % 1024) + 1024) % 1024], u); };
  return (x) => { let s = 0, a = 0.5, f = 1; for (let k = 0; k < oct; k++) { s += a * (k > 1 ? 1 - Math.abs(n1(x * f + k * 31) * 2 - 1) : n1(x * f + k * 31)); a *= 0.5; f *= 2.1; } return s; };
}
