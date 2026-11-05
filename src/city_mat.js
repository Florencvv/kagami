// city_mat.js - CITY materials (dept CITY). All built on A.animeShader so they write the engine's MRT
// (colour + emissive alpha | view normal, depth, id) and work in the mirror pass.
//   CU                       shared city uniforms: neon spill lights (uLP/uLC), night key, time on twos/threes
//   facadeMat()              painted towers (id 100): procedural windows, rain stains, neon spill, height gradient
//   celCity({map, emap, id}) inked cel for shops/props/poles/cables: vertex colour (or atlas) + 2 tones + neon spill;
//                            uv.x >= 2 on vertex-colour meshes = emissive amount (uv.x - 2), uv.y >= 2 = paper-lantern ribs
//   roofMat()                kawara tile roofs (cel, id 14): tile rows by world position, wet sheen
//   signMat(tex)             neon / lightbox signs (FX id 91, blooms): colour = vertex colour, style + flicker seed in uv
//   steamMat()               additive steam plumes (writes colour only, data untouched), drawn on threes
//   streetMat(o)             wet street (id 120 WATER): asphalt paint, lane marks, puddle mask, rain rings, mirror sample
import * as THREE from 'three';

export const NL = 32;
export function makeCU() {
  return {
    uLP: { value: Array.from({ length: NL }, () => new THREE.Vector4(0, -999, 0, 1)) },
    uLC: { value: Array.from({ length: NL }, () => new THREE.Color(0, 0, 0)) },
    uCKey: { value: new THREE.Vector3(-0.3, 0.8, 0.5).normalize() },      // soft sky key for city cels
    uCLit: { value: new THREE.Color('#8f8cd0') }, uCShade: { value: new THREE.Color('#4a4592') },
    uAmbW: { value: new THREE.Color('#6c68b0') },                         // wall ambient multiplier
    uT2: { value: 0 }, uT3: { value: 0 }, uSpill: { value: 1 }, uWinAmt: { value: 1 },
    uZone: { value: 0 },  // 0 night street, 1 dusk causeway
    uHaze: { value: new THREE.Color('#7a5aa8') }, uHazeP: { value: new THREE.Vector4(0.004, 30, 0.85, 0.6) },   // cel self-haze: den, near, max, amount
  };
}

export const SPILL = /* glsl */ `
uniform vec4 uLP[${NL}]; uniform vec3 uLC[${NL}]; uniform float uSpill;
vec3 spill(vec3 p, vec3 N){
  vec3 s = vec3(0.0);
  for(int i = 0; i < ${NL}; i++){
    vec4 L = uLP[i];
    vec3 d = L.xyz - p; float r2 = dot(d, d); float R2 = L.w * L.w;
    if(r2 > R2) continue;
    float f = 1.0 - r2 / R2; f *= f;
    float w = max(dot(N, d * inversesqrt(max(r2, 1e-4))), 0.0) * 0.75 + 0.25;
    s += uLC[i] * f * w;
  }
  return s * uSpill;
}
`;

// city vertex shader (merged static meshes): the engine's basic path + sway on twos. aSw = (pivot y, amplitude rad,
// phase, kind 0 noren: swings toward the street | 1 lantern: small pendulum in x and z)
const CITY_VERT = /* glsl */ `
attribute vec4 aSw;
uniform float uT2;
varying vec3 vW, vNW, vNV, vLocal, vColor, vNL;
varying float vDepth;
varying vec2 vUv;
void main(){
  vec3 p = position;
  if(aSw.y != 0.0){
    float ph = aSw.z;
    float a = aSw.y * (sin(uT2 * 2.1 + ph) + 0.45 * sin(uT2 * 3.7 + ph * 1.7));
    float below = max(aSw.x - p.y, 0.0);
    if(aSw.w > 0.5){ p.x += below * a; p.z += below * aSw.y * 0.7 * sin(uT2 * 1.6 + ph * 2.3); }
    else p.x += below * a * (0.6 + 0.4 * below);
    p.y += below * a * a * 0.5;
  }
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vW = wp.xyz; vLocal = p; vNL = normal;
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z;
  vNW = normalize(mat3(modelMatrix) * normal);
  vNV = normalize(mat3(viewMatrix) * vNW);
  vUv = uv;
  vColor = vec3(1.0);
  #ifdef USE_COLOR
  vColor = color;
  #endif
  gl_Position = projectionMatrix * mv;
}`;

export function makeMats(A, CU) {
  const { animeShader, GLSL } = A;
  const cityShader = (uniforms, fs, o = {}) => {
    const m = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, uniforms: { ...A.AU, ...uniforms }, vertexShader: CITY_VERT, fragmentShader: fs,
      side: o.side ?? THREE.FrontSide, vertexColors: !!o.vertexColors,
    });
    return m;
  };
  const H = `${GLSL.NOISE}${GLSL.GLOBAL_PARS}${SPILL}
uniform vec3 uCKey, uCLit, uCShade, uAmbW, uHaze; uniform float uT2, uT3, uWinAmt, uZone; uniform vec4 uHazeP;
// cel pixels get only celFog in the post: add the rest here so near-street cels and far towers dissolve together
vec3 hazed(vec3 c, float d){ float f = (1.0 - exp(-max(d - uHazeP.y, 0.0) * uHazeP.x)) * uHazeP.z * uHazeP.w; return mix(c, uHaze, f); }`;

  // ------------------------------------------------------------ towers
  // painted facades (id 100): brushed value/hue dabs + drips (the Kuwahara pass turns them into gouache), window grids
  // with lit / unlit / curtained / blinded cells, sills, mullions, sill silhouettes, warm-cool mixes; near walls darker
  const FACADE = /* glsl */ `${H}
uniform vec3 uWallA, uWallB, uWallLow, uWallTop, uWinWarm, uWinCool, uWinPink, uWinDark, uRoof; uniform float uNearDark, uLitK;
void main(){
  vec3 N = normalize(vNW), NV = normalize(vNV);
  if(!gl_FrontFacing){ N = -N; NV = -NV; }
  float seed = vUv.x, style = vUv.y;
  float h = vW.y;
  vec3 c; float emis = 0.0;
  float pk = hash12(vec2(seed * 91.7, 3.1));
  vec3 wall = pk < 0.3 ? uWallA : (pk < 0.55 ? uWallB : (pk < 0.72 ? vec3(0.03, 0.055, 0.12) : (pk < 0.87 ? vec3(0.085, 0.04, 0.11) : vec3(0.08, 0.075, 0.16))));
  wall *= 0.75 + 0.5 * hash12(vec2(seed * 33.1, 7.7));
  if(N.y > 0.6){
    c = mix(uRoof, wall, 0.3) * (0.8 + 0.35 * vnoise(vW.xz * 0.15));
  } else if(N.y < -0.6){
    c = wall * 0.55;
  } else {
    float u = abs(N.x) > 0.5 ? vW.z : vW.x;
    vec2 fp = vec2(u, h);
    float d1 = vnoise(fp * vec2(0.5, 0.2) + seed * 17.0), d2 = vnoise(fp * vec2(1.6, 0.55) + 3.0 + seed * 5.0);
    wall *= 0.76 + 0.32 * d1 + 0.14 * d2;                                                   // value dabs
    float hue = smoothstep(0.5, 0.8, vnoise(fp * 0.06 + seed * 9.0));
    wall = mix(wall, wall * vec3(1.2, 0.85, 1.06), hue * 0.6);                                // plum patches
    wall = mix(wall, wall * vec3(0.82, 1.06, 1.18), (1.0 - hue) * smoothstep(0.55, 0.8, d1) * 0.45);   // teal patches
    float drip = vnoise(vec2(u * 2.1 + seed * 11.0, h * 0.045));
    wall *= 1.0 - 0.2 * smoothstep(0.55, 0.85, drip) * (0.5 + 0.5 * vnoise(vec2(u * 6.0, h * 0.25)));   // rain drips
    wall = mix(wall, uWallLow, (1.0 - smoothstep(3.0, 30.0, h)) * 0.5);                      // neon bounce near the street
    wall = mix(wall, uWallTop, smoothstep(60.0, 190.0, h) * 0.35);                           // sky haze at the top
    wall *= mix(uNearDark, 1.0, smoothstep(12.0, 120.0, vDepth));                            // near walls frame the shot
    c = wall;
    if(style >= 0.0){
      float fh = 2.9 + fract(seed * 5.1) * 0.6, ws = 1.3 + fract(seed * 7.3) * 0.7;
      float typ = style > 0.5 ? 1.0 : (fract(seed * 13.7) < 0.3 ? 2.0 : 0.0);
      vec2 g = vec2(u / ws + seed * 3.0, (h - 0.6) / fh); vec2 cell = floor(g), f = fract(g);
      float jit = (vnoise(vW.xz * 1.7 + h * 0.9) - 0.5) * 0.05;
      float wx = 0.2 + 0.1 * fract(seed * 3.1), wyB = 0.3, wyT = 0.18;
      if(typ == 1.0){ wx = 0.0; wyB = 0.36; wyT = 0.2; }
      if(typ == 2.0){ wx = 0.36; wyB = 0.05; wyT = 0.04; }
      float inWin = step(wx + jit, f.x) * step(f.x, 1.0 - wx - jit) * step(wyB + jit, f.y) * step(f.y, 1.0 - wyT + jit);
      inWin *= step(7.5, h);
      float bayN = 4.0 + floor(fract(seed * 17.1) * 4.0), flN = 3.0 + floor(fract(seed * 19.3) * 5.0);
      float pil = step(fract(g.x / bayN), 0.11 / bayN * 2.0);
      float band = step(fract(g.y / flN), 0.12 / flN * 2.0);
      inWin *= (1.0 - pil) * (1.0 - band * step(0.5, fract(seed * 23.0)));
      float litFrac = (0.18 + 0.3 * fract(seed * 11.3)) * uLitK;
      // rooms: lit runs of 1-3 windows per floor; some floors dark, a few office floors fully lit
      float fl = hash12(vec2(cell.y, seed * 41.0));
      float rw = 1.0 + floor(hash12(vec2(cell.y, seed * 17.0)) * 3.0);
      vec2 lc = typ == 1.0 ? vec2(floor(g.x / 3.0), cell.y) : vec2(floor((g.x + fl * 5.0) / rw), cell.y);
      float hs = hash12(lc + seed * 137.0);
      float lf = fl < 0.12 ? 0.04 : (fl > 0.94 ? 0.85 : litFrac);
      float lit = step(hs, lf) * uWinAmt;
      float tone = hash12(lc * 1.7 + seed);
      vec3 wl = tone < 0.7 ? uWinWarm : (tone < 0.92 ? uWinCool : uWinPink);
      float dim = 0.72 + 0.28 * hash12(lc + 9.0);
      vec2 q = vec2((f.x - wx) / max(1.0 - 2.0 * wx, 0.05), (f.y - wyB) / max(1.0 - wyB - wyT, 0.05));
      if(typ == 1.0) q.x = fract(g.x / 3.0);
      wl *= dim * (0.72 + 0.4 * smoothstep(0.4, 1.0, q.y));                                  // ceiling lamp glow
      float kind = hash12(lc + 6.0);
      if(kind < 0.3){                                                                         // curtains, lit from behind
        float k2 = hash12(lc + 9.0);
        vec3 cc = k2 < 0.5 ? vec3(1.0, 0.8, 0.58) : (k2 < 0.8 ? vec3(1.0, 0.6, 0.74) : vec3(0.55, 0.9, 0.86));
        float open = 0.12 + 0.25 * hash12(lc + 8.0);
        float cur = 1.0 - step(abs(q.x - 0.5), open);
        wl = mix(wl, cc * dim * (0.78 + 0.22 * sin(q.x * 44.0)), cur);
      } else if(kind < 0.5){                                                                  // blinds
        wl *= 0.55 + 0.45 * step(0.45, fract(q.y * 7.0));
      }
      float obj = hash12(lc + 10.0);                                                          // sill silhouettes: plants, boxes, lamps
      if(obj > 0.68){ float prof = 0.16 + 0.12 * sin(q.x * 9.0 + obj * 30.0) + 0.07 * sin(q.x * 23.0 + obj * 7.0); wl = mix(wl, wl * 0.22, step(q.y, prof)); }
      vec3 wd = mix(wall * 0.55, uWinDark * 0.7, 0.55) * (0.65 + 0.45 * hash12(cell + 2.0));             // dark glass reflecting the sky
      wd = mix(wd, wd * 1.5 + vec3(0.02, 0.01, 0.05), q.y * 0.6);
      wd += step(abs(fract(q.x * 0.7 + q.y * 0.5 + hash12(cell + 4.0)) - 0.5), 0.05) * wd * 0.6;   // glass sheen
      vec3 win = mix(wd, wl, lit);
      float mull = step(abs(q.x - 0.5), 0.03) * step(0.45, fract(seed * 29.0)) + step(abs(q.y - 0.64), 0.025) * step(0.6, fract(seed * 31.0));
      win *= 1.0 - clamp(mull, 0.0, 1.0) * 0.65;
      float bord = 1.0 - step(0.05, q.x) * step(q.x, 0.95) * step(0.05, q.y) * step(q.y, 0.95);   // frame
      win = mix(win, wall * 1.25 + 0.015, bord * 0.65 * (1.0 - lit * 0.5));
      float px = max(fwidth(g.x), fwidth(g.y));
      float fade = smoothstep(0.12, 0.35, px);
      float cover = (1.0 - 2.0 * wx) * (1.0 - wyB - wyT);
      vec3 avg = mix(wall, mix(wd, uWinWarm * 0.55, litFrac), cover * 0.9);
      vec3 cw = wall;
      // sill below each window (lighter strip) + a painted AC unit under some
      float sill = step(wyB - 0.06, f.y) * step(f.y, wyB) * step(wx - 0.04, f.x) * step(f.x, 1.0 - wx + 0.04) * step(7.5, h) * (1.0 - pil);
      cw = mix(cw, wall * 1.55 + 0.01, sill * 0.85);
      float ac = step(0.86, hash12(cell + 12.0)) * step(typ, 0.5) * step(0.04, f.y) * step(f.y, wyB - 0.1) * step(0.52, f.x) * step(f.x, 0.9) * step(7.5, h) * (1.0 - pil);
      float fan = step(length((f - vec2(0.71, (wyB - 0.06) * 0.5 + 0.02)) * vec2(1.0, fh / ws)), 0.07);
      cw = mix(cw, mix(vec3(0.42, 0.42, 0.58), vec3(0.15, 0.14, 0.24), fan), ac);
      c = mix(mix(cw, win, inWin), avg, fade);
      c *= 1.0 - 0.15 * pil - 0.08 * band;
      emis = inWin * lit * 0.32 * dim * (1.0 - fade) + fade * litFrac * cover * 0.1;
    }
  }
  float amb = (0.75 + 0.25 * clamp(N.y, 0.0, 1.0)) * (0.82 + 0.3 * max(dot(N, normalize(vec3(0.55, 0.25, 0.8))), 0.0));
  vec3 sp = spill(vW, N);
  c = c * uAmbW * amb * 1.6 + (c * 1.4 + vec3(0.03)) * sp * (1.0 - emis);
  writeOut(c, emis, NV, vDepth, 100.0);
}`;
  function facadeMat(o = {}) {
    return animeShader({
      ...CU,
      uWallA: { value: new THREE.Color(o.wallA ?? '#2a2f66') }, uWallB: { value: new THREE.Color(o.wallB ?? '#3a2f64') },
      uWallLow: { value: new THREE.Color(o.wallLow ?? '#6a3f86') }, uWallTop: { value: new THREE.Color(o.wallTop ?? '#4a5aa0') },
      uWinWarm: { value: new THREE.Color('#ffd49a') }, uWinCool: { value: new THREE.Color('#d8ecff') }, uWinPink: { value: new THREE.Color('#ff9ad0') },
      uWinDark: { value: new THREE.Color(o.winDark ?? '#283a78') }, uRoof: { value: new THREE.Color('#2a2c5a') },
      uNearDark: { value: o.nearDark ?? 0.72 }, uLitK: { value: o.litK ?? 1 },
    }, FACADE);
  }

  // ------------------------------------------------------------ inked cels
  const CEL = /* glsl */ `${H}
uniform sampler2D uMap, uEmap; uniform float uUseMap, uId, uEmisK, uRim;
uniform vec3 uRimC;
void main(){
  vec3 N = normalize(vNW), NV = normalize(vNV);
  if(!gl_FrontFacing){ N = -N; NV = -NV; }
  vec3 base = vColor; vec3 em = vec3(0.0);
  vec2 uv = vUv;
  float lantern = 0.0;
  if(uUseMap > 0.5){
    base *= texture(uMap, uv).rgb;
    em = texture(uEmap, uv).rgb * uEmisK;
  } else {
    if(uv.x >= 2.0) em = vColor * (uv.x - 2.0);
    if(uv.y >= 2.0) lantern = 1.0;
  }
  float n = fbm3(vW * 1.7) * 2.0 - 1.0;
  float ndl = dot(N, normalize(uCKey)) + n * 0.08;
  float aa = max(fwidth(ndl), 1e-4);
  float lit = smoothstep(-aa, aa, ndl - 0.05);
  vec3 c = base * mix(uCShade, uCLit, lit) * 1.7;
  vec3 sp = spill(vW, N);
  c += (base * 1.3 + vec3(0.04)) * sp;
  vec3 V = normalize(cameraPosition - vW);
  float fres = 1.0 - max(dot(N, V), 0.0);
  c += uRimC * smoothstep(0.72, 0.78, fres + n * 0.04) * uRim * (0.4 + 0.6 * clamp(length(sp), 0.0, 1.0));
  float emis = 0.0;
  if(lantern > 0.5){
    // chochin: glowing paper with dark ribs, brighter belly, dark caps handled by geometry
    float rib = smoothstep(0.08, 0.0, abs(fract(vW.y * 9.0) - 0.5) - 0.38);
    vec3 glow = vColor * (1.25 + 0.6 * max(dot(N, V), 0.0));
    c = mix(glow, vColor * 0.35, rib * 0.65);
    emis = 1.1 * (1.0 - rib * 0.6);
  } else {
    c += em; emis = clamp(dot(em, vec3(0.33)) * 1.4, 0.0, 3.0);
  }
  c = hazed(c, vDepth);
  writeOut(c, emis, NV, vDepth, uId);
}`;
  function celCity(o = {}) {
    const m = cityShader({
      ...CU,
      uMap: { value: o.map ?? null }, uEmap: { value: o.emap ?? null }, uUseMap: { value: o.map ? 1 : 0 },
      uId: { value: o.id ?? 10 }, uEmisK: { value: o.emisK ?? 1.3 }, uRim: { value: o.rim ?? 0.35 },
      uRimC: { value: new THREE.Color(o.rimColor ?? '#ff8fd0') },
    }, CEL, { vertexColors: true, side: o.side ?? THREE.FrontSide });
    return m;
  }

  // ------------------------------------------------------------ kawara tile roofs
  const ROOF = /* glsl */ `${H}
uniform vec3 uTile, uTile2; uniform float uAxis;
void main(){
  vec3 N = normalize(vNW), NV = normalize(vNV);
  if(!gl_FrontFacing){ N = -N; NV = -NV; }
  float along = uAxis > 0.5 ? vW.x : vW.z;
  float r = fract(along / 0.32);
  float ridge = sin(r * 6.2831);                         // round tile profile
  vec3 base = mix(uTile, uTile2, hash12(vec2(floor(along / 0.32), floor(vW.y * 2.0))) * 0.6);
  float lit = smoothstep(-0.1, 0.1, ridge + (vnoise(vW.xz * 3.0) - 0.5) * 0.4);
  vec3 c = base * mix(uCShade, uCLit, lit) * 1.8;
  c *= 1.0 - 0.45 * smoothstep(0.06, 0.0, abs(r - 0.5) - 0.44);   // dark gap lines between tile rows
  float wet = smoothstep(0.82, 0.98, ridge) * 0.45;      // wet highlight on the tile crowns
  vec3 sp = spill(vW, N);
  c += (base * 1.3 + 0.05) * sp + sp * wet + vec3(0.25, 0.28, 0.45) * wet * 0.4;
  c = hazed(c, vDepth);
  writeOut(c, 0.0, NV, vDepth, 14.0);
}`;
  function roofMat(o = {}) {
    return animeShader({ ...CU, uTile: { value: new THREE.Color(o.tile ?? '#3a3c6a') }, uTile2: { value: new THREE.Color('#2c2a52') }, uAxis: { value: o.axis ?? 0 } }, ROOF, { side: THREE.DoubleSide });
  }

  // ------------------------------------------------------------ neon signs
  const SIGN = /* glsl */ `${H}
uniform sampler2D uAtlas; uniform float uBright;
void main(){
  vec3 NV = normalize(vNV);
  if(!gl_FrontFacing) NV = -NV;
  float style = floor(vUv.y / 2.0);
  vec2 uv = vec2(fract(vUv.x), vUv.y - style * 2.0);
  float seed = floor(vUv.x);
  vec3 m = texture(uAtlas, uv).rgb;
  vec3 col = vColor;
  // flicker: a few signs stutter on threes
  float fl = 1.0;
  float fs = fract(seed * 0.618);
  if(fs > 0.86){ float k = hash12(vec2(floor(uT3 * 8.0 + 0.5), seed)); fl = k < 0.22 ? 0.18 : (k < 0.35 ? 0.6 : 1.0); }
  vec3 c; float emis;
  vec3 hot = mix(col, vec3(1.0), 0.38);
  if(style < 0.5){
    // tube: dark lacquer panel, glow halo, white-hot core
    vec3 panel = vec3(0.06, 0.05, 0.12) + col * 0.05;
    c = mix(vec3(0.03, 0.03, 0.07), panel, step(0.1, m.b));
    c += col * m.g * 0.9 * fl;
    c = mix(c, hot * 1.15, m.r * fl);
    emis = (m.r * 1.6 + m.g * 0.6) * fl;
  } else {
    // lightbox: lit colour panel, letters dark, rim tube
    vec3 panel = mix(col * 0.85, vec3(1.0), 0.12);
    c = mix(vec3(0.03, 0.03, 0.07), panel * fl, step(0.5, m.b));
    c = mix(c, mix(vec3(0.08, 0.05, 0.12), vec3(1.0), step(0.5, fract(seed * 0.37))) , m.r * step(0.5, m.b));
    emis = step(0.5, m.b) * (1.0 - m.r * 0.7) * 0.8 * fl;
  }
  c *= uBright;
  writeOut(c, emis * uBright, NV, vDepth, 91.0);
}`;
  function signMat(atlas) {
    return animeShader({ ...CU, uAtlas: { value: atlas }, uBright: { value: 1 } }, SIGN, { vertexColors: true, side: THREE.DoubleSide });
  }

  // ------------------------------------------------------------ steam (additive, colour only)
  const STEAM = /* glsl */ `${H}
uniform float uAmt; uniform vec3 uTint;
void main(){
  vec2 uv = vUv;
  float seed = vColor.r * 17.0;
  float t = uT3 * 0.9 + seed;
  float n = fbm2(vec2(uv.x * 3.0 + seed, uv.y * 2.2 - t * 1.4));
  float n2 = vnoise(vec2(uv.x * 9.0 - seed, uv.y * 6.0 - t * 2.4));
  float hw = 0.1 + 0.36 * uv.y;                                       // plume widens as it rises
  float cx = 0.5 + (n - 0.5) * 0.35 * uv.y + sin(uv.y * 3.0 + seed) * 0.06 * uv.y;
  float shape = smoothstep(hw, hw * 0.35, abs(uv.x - cx)) * smoothstep(0.0, 0.08, uv.y) * smoothstep(1.0, 0.35, uv.y);
  float a = smoothstep(0.5, 0.8, n * 0.75 + n2 * 0.45 + shape * 0.25) * shape * (1.0 - uv.y * 0.6);
  a = floor(a * 4.0 + 0.5) / 4.0;                         // painted: three flat values
  vec3 sp = spill(vW, vec3(0.0, 1.0, 0.0));
  vec3 c = (uTint + sp * 0.8) * a * uAmt * vColor.g;
  oColor = vec4(c, 0.0); oData = vec4(0.0);
}`;
  function steamMat() {
    const m = animeShader({ ...CU, uAmt: { value: 0.75 }, uTint: { value: new THREE.Color('#7a76b8') } }, STEAM, { vertexColors: true, side: THREE.DoubleSide });
    m.transparent = true; m.depthWrite = false;
    m.blending = THREE.CustomBlending; m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneFactor; m.blendEquation = THREE.AddEquation;
    m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor;
    return m;
  }

  // ------------------------------------------------------------ wet street + puddles (mirror)
  const STREET = /* glsl */ `${GLSL.NOISE}${GLSL.GLOBAL_PARS}${GLSL.MIRROR}${SPILL}
uniform vec3 uCKey, uCLit, uCShade, uAmbW; uniform float uT2, uT3, uWinAmt, uZone;
uniform vec4 uPud[16]; uniform vec4 uPud2[16];
uniform vec3 uAsph, uAsph2, uLine, uWalk, uTint, uFallback;
uniform float uPudAmt, uMarks, uRoadW, uWalkW, uRain, uSmear, uCross[4];
uniform sampler2D uLM; uniform vec4 uLMBox; uniform float uLMOn;
float puddles(vec2 p){
  float pm = 0.0;
  for(int i = 0; i < 16; i++){
    vec4 P = uPud[i]; if(P.z <= 0.0) continue;
    vec2 d = p - P.xy; float a = uPud2[i].x; d = mat2(cos(a), -sin(a), sin(a), cos(a)) * d;
    vec2 q = d / P.zw;
    float r = length(q) + (fbm2(p * 0.55 + float(i) * 7.0) - 0.5) * 0.55 + (vnoise(p * 2.4) - 0.5) * 0.12;
    pm = max(pm, smoothstep(1.0, 0.9, r) * uPud2[i].y);
  }
  float sm = fbm2(p * vec2(0.16, 0.07) + 3.0);
  pm = max(pm, smoothstep(0.64, 0.68, sm) * 0.8);
  return pm;
}
void main(){
  if(uReflectPass > 0.5) discard;
  vec3 N = vec3(0.0, 1.0, 0.0), NV = normalize(vNV);
  vec3 V = normalize(cameraPosition - vW);
  vec2 p = vW.xz;
  float ax = abs(p.x);
  float pm = puddles(p);
  // asphalt: painted value/hue dabs, long strokes along the street
  float s1 = fbm2(p * vec2(0.5, 0.08)), s2 = vnoise(p * vec2(2.0, 0.4) + 5.0);
  vec3 base = mix(uAsph, uAsph2, smoothstep(0.3, 0.75, s1));
  base *= 0.85 + 0.3 * s2;
  float refl = 1.0, mark = 0.0;
  // markings: edge lines, dashed centre, crossings (painted, less reflective)
  if(ax < uRoadW){
    mark = max(mark, step(abs(ax - (uRoadW - 0.6)), 0.08));
    mark = max(mark, step(ax, 0.08) * step(0.5, fract(p.y / 10.0)));
    for(int i = 0; i < 4; i++){ float z0 = uCross[i]; if(abs(p.y - z0) < 2.2 && ax < uRoadW - 1.0) mark = max(mark, step(0.5, fract(p.x / 0.9))); }
    mark *= uMarks * (0.75 + 0.25 * vnoise(p * 6.0));     // worn paint
  } else {
    // sidewalk: square tiles, tactile line, curb
    vec2 tq = fract(p / 0.6);
    base = uWalk * (0.88 + 0.2 * hash12(floor(p / 0.6)));
    base *= 1.0 - 0.25 * (step(tq.x, 0.04) + step(tq.y, 0.04));
    float tac = step(abs(ax - (uRoadW + 0.9)), 0.17);
    base = mix(base, vec3(0.55, 0.45, 0.18), tac);
    base = mix(base, base * 0.55, step(ax, uRoadW + 0.22));
    refl = 0.75;
  }
  base = mix(base, uLine, mark);
  refl *= 1.0 - mark * 0.6;
  // rain rings: one ring per 0.9 m cell, drawn on threes, near the camera only
  vec2 cell = floor(p / 0.9), f = fract(p / 0.9);
  float h = hash12(cell), per = 0.55 + 0.5 * hash12(cell + 3.0);
  float age = fract(uT3 / per + h) * per;
  vec2 cc = 0.3 + 0.4 * vec2(hash12(cell + 7.0), hash12(cell + 9.0));
  vec2 dv = (f - cc) * 0.9; float d = length(dv);
  float rad = age * 0.75;
  float ring = smoothstep(0.035, 0.0, abs(d - rad)) * (1.0 - age / per) * step(rad, 0.3) * uRain;
  ring *= 1.0 - smoothstep(25.0, 60.0, vDepth);
  vec2 roff = dv / max(d, 1e-3) * ring * 0.18;
  // reflection
  float fr = mix(0.55, 1.0, pow(1.0 - abs(dot(N, V)), 3.0));
  bool live = uMirror.x > 0.5;
  vec3 rc = live ? mirrorSample(vW + vec3(roff.x, 0.0, roff.y), mix(1.0, 0.25, pm)) : uFallback;
  // wet asphalt: lights smear into long vertical streaks toward the viewer; puddles stay crisp
  float smr = (1.0 - smoothstep(0.2, 0.6, pm)) * uSmear;
  if(live && smr > 0.01){
    float em0 = mirrorEmis;
    vec2 vd = normalize(cameraPosition.xz - p + 1e-4);
    float L = (0.4 + vDepth * 0.07) * smr;
    vec3 a1 = mirrorSample(vW + vec3(vd * L, 0.0).xzy, 1.0); float e1 = mirrorEmis;
    vec3 a2 = mirrorSample(vW - vec3(vd * L, 0.0).xzy, 1.0); float e2 = mirrorEmis;
    vec3 a3 = mirrorSample(vW + vec3(vd * L * 2.2, 0.0).xzy, 1.0); float e3 = mirrorEmis;
    vec3 a4 = mirrorSample(vW - vec3(vd * L * 2.2, 0.0).xzy, 1.0); float e4 = mirrorEmis;
    rc = rc * 0.28 + (a1 + a2) * 0.22 + (a3 + a4) * 0.14;
    mirrorEmis = em0 * 0.28 + (e1 + e2) * 0.22 + (e3 + e4) * 0.14;
  }
  float on = clamp(fr * refl * mix(live ? uMirror.z : 0.5, uPudAmt, pm), 0.0, 1.0);
  vec3 c = base * uAmbW * 1.2 + (base + 0.03) * spill(vW, N) * (1.0 - pm * 0.7);
  c = mix(c, rc * uTint, on);
  // puddle edge: a thin darker lip so the patch reads as drawn
  float edge = smoothstep(0.08, 0.35, pm) * smoothstep(0.75, 0.4, pm);
  c *= 1.0 - edge * 0.35;
  c += vec3(0.55, 0.6, 0.85) * ring * 0.4;
  // baked light pools from shops / lanterns / lamps / neon on the wet street (every light of the zone, any distance)
  if(uLMOn > 0.5){
    vec2 lu = vec2((p.x - uLMBox.x) / uLMBox.z, (p.y - uLMBox.y) / uLMBox.w);
    vec3 pool = texture(uLM, lu).rgb * 2.0 * (0.85 + 0.3 * vnoise(p * 1.3));
    c += pool * (0.16 + base * 1.0) * (1.0 - on * 0.5) * uLMOn;
  }
  writeOut(c, (live ? mirrorEmis * on : 0.0) + ring * 0.2, NV, vDepth, pm > 0.5 ? 121.0 : 120.0);
}`;
  function streetMat(o = {}) {
    const m = animeShader({
      ...CU,
      uPud: { value: Array.from({ length: 16 }, () => new THREE.Vector4(0, 0, 0, 0)) },
      uPud2: { value: Array.from({ length: 16 }, () => new THREE.Vector4(0, 0, 0, 0)) },
      uAsph: { value: new THREE.Color(o.asph ?? '#2a2b5c') }, uAsph2: { value: new THREE.Color(o.asph2 ?? '#3a2f62') },
      uLine: { value: new THREE.Color('#9c9ccc') }, uWalk: { value: new THREE.Color(o.walk ?? '#4a4a7c') },
      uTint: { value: new THREE.Color(o.tint ?? '#c8c8ee') }, uFallback: { value: new THREE.Color('#4a4a8a') },
      uPudAmt: { value: o.pudAmt ?? 0.95 }, uMarks: { value: o.marks ?? 1 }, uRoadW: { value: o.roadW ?? 12 }, uWalkW: { value: 3 },
      uRain: { value: o.rain ?? 1 }, uSmear: { value: o.smear ?? 1 }, uCross: { value: o.cross ?? [-40, -165, 70, -330] },
      uLM: { value: null }, uLMBox: { value: new THREE.Vector4(0, 0, 1, 1) }, uLMOn: { value: 0 },
    }, STREET, {});
    m.userData.mirror = true; m.name = 'city_street';
    return m;
  }

  return { facadeMat, celCity, roofMat, signMat, steamMat, streetMat };
}
