// lands_snow.js - PASS ridge terrain shader (dept LANDS): painted dawn snow + rock in one pass.
// Steep faces are rock (strata, cracks, snow ledges), flatter ground is snow lit pink-gold with deep cool blue shade,
// wind ripples (sastrugi) and glints; long painted cast shadows from trees / lanterns (uCast: x, z, height, radius) and
// the gate (uSeg: shadow segments a.xz -> b.xz, width in uSegW), drawn crisp with a brushed wobble.
import * as THREE from 'three';

const MAXC = 112, MAXS = 8;
const FS = (A) => /* glsl */ `
${A.GLSL.NOISE}
${A.GLSL.GLOBAL_PARS}
uniform vec3 uL, uSnowLit, uSnowHi, uSnowSh, uSnowDeep, uRockLit, uRockSh, uRockDeep, uShadowC;
uniform vec4 uCast[${MAXC}]; uniform int uNCast; uniform vec4 uSeg[${MAXS}]; uniform float uSegW[${MAXS}]; uniform int uNSeg;
uniform vec2 uSd; uniform float uShLen, uId; uniform vec4 uPath;
float castShadow(vec2 p){
  float s = 0.0;
  vec2 sd = uSd, sn = vec2(-sd.y, sd.x);
  float wob = (vnoise(p * 0.7) - 0.5) * 0.5 + (vnoise(p * 2.3 + 4.0) - 0.5) * 0.2;
  for(int i = 0; i < ${MAXC}; i++){
    if(i >= uNCast) break;
    vec4 c = uCast[i];
    vec2 r = p - c.xy;
    float along = dot(r, sd), across = dot(r, sn);
    float L = c.z * uShLen;
    if(along < -c.w || along > L || abs(across) > c.w * 1.3) continue;
    float f = along / L;
    float saw = fract(f * 7.0 + c.x * 0.13);
    float hw = c.w * clamp(1.0 - (f - 0.2) / 0.8, 0.0, 1.0) * (0.55 + 0.45 * saw) * step(0.17, f);
    float trunk = c.w * 0.09 * step(f, 0.24);
    s = max(s, step(abs(across) + wob * c.w * 0.12, max(hw, trunk)));
    s = max(s, step(length(r) + wob * 0.4, c.w * 0.45));
  }
  for(int i = 0; i < ${MAXS}; i++){
    if(i >= uNSeg) break;
    vec2 a = uSeg[i].xy, b = uSeg[i].zw, ab = b - a;
    float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    s = max(s, step(length(p - a - ab * t) + wob * 0.15, uSegW[i]));
  }
  return s;
}
void main(){
  vec3 N = normalize(vNW);
  vec3 L = normalize(uL);
  float dist = length(cameraPosition - vW);
  vec2 xz = vW.xz;
  float n1 = fbm2(xz * 0.045) - 0.5;
  float n2 = vnoise(xz * 0.35) - 0.5;
  float n3 = vnoise(vec2(xz.x * 0.08 + vW.y * 0.05, xz.y * 0.08)) - 0.5;
  // rock on steep faces; strata give snow ledges on the rock
  float strata = sin(vW.y * 0.55 + n1 * 7.0 + n3 * 4.0 + sin(xz.x * 0.07 + xz.y * 0.05) * 2.0);
  float rockK = smoothstep(0.7, 0.6, N.y + n1 * 0.22 + n2 * 0.06 + strata * 0.07);
  float ndl = dot(N, L) + n1 * 0.1 + n2 * 0.04;
  float lit = smoothstep(-0.03, 0.05, ndl);
  float sh = castShadow(xz) * smoothstep(0.45, 0.75, N.y);
  lit *= 1.0 - sh;
  // ---- snow
  vec3 snowLit = mix(uSnowLit, uSnowHi, smoothstep(0.12, 0.4, ndl + n2 * 0.12));
  vec3 snowSh = mix(uSnowDeep, uSnowSh, smoothstep(-0.55, -0.05, ndl) * 0.75 + 0.25 * (n1 + 0.5));
  snowSh = mix(snowSh, uShadowC, sh * 0.7);
  // wind ripples (sastrugi): thin cool lines across the wind on flat snow, and drift crests
  float flatK = smoothstep(0.82, 0.95, N.y);
  float rip = sin(dot(xz, vec2(0.55, 0.83)) * 1.6 + n1 * 9.0 + n2 * 2.0);
  float ripL = smoothstep(0.9, 0.98, rip) * flatK * (1.0 - smoothstep(25.0, 120.0, dist)) * smoothstep(-0.2, 0.2, n3);
  vec3 snow = mix(snowSh, snowLit, lit);
  snow = mix(snow, mix(snow, uSnowSh, 0.55), ripL * 0.6);
  // trodden: the steps line and the ronin path are a touch darker / warmer
  float tr = max(smoothstep(2.6, 1.2, abs(xz.x - uPath.x)), smoothstep(3.0, 1.0, abs(xz.x - uPath.y))) * step(uPath.w, xz.y) * step(xz.y, uPath.z);
  snow *= 1.0 - tr * 0.06 * (0.6 + n2);
  // ---- rock: warm lit planes, deep cool shade, crack lines along the strata + vertical joints
  float rl = smoothstep(-0.05, 0.1, ndl + n3 * 0.2) * (1.0 - sh);
  vec3 rock = mix(mix(uRockDeep, uRockSh, smoothstep(-0.6, -0.05, ndl)), uRockLit, rl);
  rock *= 0.9 + 0.2 * (n3 + 0.5);
  float joint = smoothstep(0.95, 0.995, abs(sin(xz.x * 0.21 + xz.y * 0.17 + vW.y * 0.04 + n1 * 9.0 + n3 * 3.0))) * step(0.0, n2);
  rock *= 1.0 - 0.28 * max(smoothstep(0.86, 0.98, abs(strata)), joint * 0.7);
  // snow dusting on the top of each rock band (ledges)
  float ledge = smoothstep(0.55, 0.85, strata + n2 * 0.4) * smoothstep(0.3, 0.55, N.y + n2 * 0.2);
  // thin snow lines on the top edge of every rock band + snow caught on less steep patches (anime snowy cliff)
  float band = smoothstep(0.8, 0.9, strata + n2 * 0.5 + n3 * 0.3) * smoothstep(-0.25, 0.1, N.y + n3 * 0.5);
  float spot = smoothstep(0.62, 0.72, n1 + 0.5 + N.y * 0.5 + n2 * 0.3);
  ledge = max(ledge, max(band, spot));
  rock = mix(rock, mix(snowSh, snowLit, lit), ledge);
  vec3 c = mix(snow, rock, rockK);
  // glints in lit snow (near only)
  vec2 gc = floor(xz * 2.0);
  float gl = step(0.996, hash12(gc)) * lit * (1.0 - rockK) * (1.0 - smoothstep(15.0, 45.0, dist));
  c = mix(c, vec3(1.0, 0.98, 0.94), gl * 0.8);
  vec3 NV = normalize((viewMatrix * vec4(N, 0.0)).xyz);
  writeOut(c, gl * 0.8, NV, vDepth, uId);
}`;

// snowMaterial(A, {light, shadowDir (xz away from the sun), shadowLen (x height), path: [stepsX, pathX, zTop, zBottom], pal})
export function snowMaterial(A, o) {
  const C = (c) => new THREE.Color(c), p = o.pal;
  const m = A.animeShader({
    uL: { value: o.light.clone().normalize() },
    uSnowLit: { value: C(p.snowLit) }, uSnowHi: { value: C(p.snowHi) }, uSnowSh: { value: C(p.snowSh) }, uSnowDeep: { value: C(p.snowDeep) },
    uRockLit: { value: C(p.rockLit) }, uRockSh: { value: C(p.rockSh) }, uRockDeep: { value: C(p.rockDeep) }, uShadowC: { value: C(p.shadow) },
    uCast: { value: Array.from({ length: MAXC }, () => new THREE.Vector4()) }, uNCast: { value: 0 },
    uSeg: { value: Array.from({ length: MAXS }, () => new THREE.Vector4()) }, uSegW: { value: new Array(MAXS).fill(0) }, uNSeg: { value: 0 },
    uSd: { value: o.shadowDir.clone().normalize() }, uShLen: { value: o.shadowLen ?? 3.4 }, uId: { value: A.ID.GROUND },
    uPath: { value: new THREE.Vector4(...(o.path ?? [0, 4.5, 140, -20])) },
  }, FS(A), {});
  m.name = 'lands_snow';
  const U = m.uniforms;
  m.userData.casters = {
    // tree / lantern: base x, z, height, radius of the widest tier
    add(x, z, h, r) { const n = U.uNCast.value; if (n >= MAXC) return false; U.uCast.value[n].set(x, z, h, r); U.uNCast.value = n + 1; return true; },
    // straight shadow of a post / beam: from a (xz) to b (xz), half width w
    seg(ax, az, bx, bz, w) { const n = U.uNSeg.value; if (n >= MAXS) return false; U.uSeg.value[n].set(ax, az, bx, bz); U.uSegW.value[n] = w; U.uNSeg.value = n + 1; return true; },
  };
  return m;
}
