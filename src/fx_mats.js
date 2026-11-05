// fx_mats.js - drawn anime FX materials (dept FX). All FX shapes are drawn in the fragment shader as bold flat cels
// (no blending, no soft particles): discard outside the shape, 2-3 hard tones, white cores, coloured edges, bloom via alpha.
// Modes (defines): BILL (camera-facing card, instance rot in iA.w), STREAK (instance Y column = world length vector, width
// faces the camera, min px width), UPRIGHT (cylindrical card), RIBBON (centre line + tangent/width, camera-facing or
// explicit side), MESHI (instanced plain mesh), default plain mesh.
export function fxMats(THREE, A) {
  const VS = /* glsl */ `
  uniform float uPxK, uMinPx;
  #if defined(BILL) || defined(STREAK) || defined(UPRIGHT) || defined(MESHI)
  attribute vec4 iA;
  #endif
  #ifdef RIBBON
  attribute vec4 aD; attribute vec4 aE;
  #endif
  varying vec3 vW, vNW, vNV, vLocal, vColor, vNL;
  varying float vDepth;
  varying vec2 vUv;
  varying vec4 vA;
  void main(){
    vec3 wp; vec3 nW = vec3(0.0, 1.0, 0.0); vA = vec4(0.0);
  #if defined(BILL) || defined(STREAK) || defined(UPRIGHT)
    mat4 IM = modelMatrix * instanceMatrix;
    vec3 o = IM[3].xyz; float sx = length(IM[0].xyz), sy = length(IM[1].xyz);
    float dist = length(cameraPosition - o);
    #ifdef BILL
      vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
      vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
      float a = iA.w;
      float s = max(1.0, uPxK * uMinPx * dist / max(min(sx, sy), 1e-4));
      vec2 p = vec2(position.x * sx, position.y * sy) * s;
      p = mat2(cos(a), sin(a), -sin(a), cos(a)) * p;
      wp = o + camR * p.x + camU * p.y;
      nW = normalize(cameraPosition - o);
    #elif defined(STREAK)
      vec3 ax = IM[1].xyz;
      vec3 toC = cameraPosition - o;
      vec3 sd = cross(ax, toC); sd = normalize(sd + vec3(1e-6, 0.0, 0.0));
      float w = max(sx, uPxK * uMinPx * dist);
      wp = o + ax * position.y + sd * position.x * w;
      nW = normalize(toC);
    #else
      vec3 toC = cameraPosition - o; vec3 f = normalize(vec3(toC.x, 0.0, toC.z) + vec3(1e-5, 0.0, 0.0)); vec3 rt = vec3(f.z, 0.0, -f.x);
      float s = max(1.0, uPxK * uMinPx * dist / max(min(sx, sy), 1e-4));
      wp = o + rt * position.x * sx * s + vec3(0.0, position.y * sy * s, 0.0);
      nW = f;
    #endif
    vA = iA;
  #elif defined(MESHI)
    mat4 IM = modelMatrix * instanceMatrix;
    wp = (IM * vec4(position, 1.0)).xyz; nW = normalize(mat3(IM) * normal); vA = iA;
  #elif defined(RIBBON)
    vec3 o = (modelMatrix * vec4(position, 1.0)).xyz;
    vec3 tg = normalize(mat3(modelMatrix) * aD.xyz + vec3(1e-6, 0.0, 0.0));
    vec3 sd = dot(aE.xyz, aE.xyz) > 1e-6 ? normalize(aE.xyz) : normalize(cross(tg, cameraPosition - o) + vec3(0.0, 1e-6, 0.0));
    float w = max(aD.w, uPxK * uMinPx * length(cameraPosition - o));
    wp = o + sd * (uv.y * 2.0 - 1.0) * w;
    nW = normalize(cameraPosition - o);
    vA = vec4(aE.w, aD.w, 0.0, 0.0);
  #else
    wp = (modelMatrix * vec4(position, 1.0)).xyz; nW = normalize(mat3(modelMatrix) * normal);
  #endif
    vW = wp; vLocal = position; vNL = nW; vNW = nW; vNV = normalize(mat3(viewMatrix) * nW);
    vec4 mv = viewMatrix * vec4(wp, 1.0);
    vDepth = -mv.z; vUv = uv; vColor = vec3(1.0);
    gl_Position = projectionMatrix * mv;
  }`;
  const HEAD = `${A.GLSL.NOISE}\n${A.GLSL.GLOBAL_PARS}\nvarying vec4 vA;\nuniform float uFid;\n`;
  const shared = { uPxK: { value: 0.001 }, uMinPx: { value: 1.2 } };
  const C = (h) => new THREE.Color(h);
  function mk(name, fs, uniforms, defines = {}, o = {}) {
    const m = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: VS, fragmentShader: HEAD + fs, defines,
      uniforms: { ...A.AU, ...shared, uFid: { value: o.id ?? 92 }, ...uniforms }, side: THREE.DoubleSide,
    });
    m.name = 'fx_' + name;
    return m;
  }

  // rain streak: thin, tapered both ends, brighter head; iA: x seed, y brightness
  const rain = (col = '#cfe0ff') => mk('rain', /* glsl */ `
  uniform vec3 uCol, uCol2;
  void main(){
    float t = vUv.y, a = abs(vUv.x - 0.5) * 2.0;
    float w = pow(sin(3.14159 * clamp(t, 0.0, 1.0)), 0.6) * mix(0.55, 1.0, t);
    if(a > w) discard;
    vec3 c = mix(uCol2, uCol, smoothstep(0.2, 0.9, t)) * (0.7 + 0.45 * vA.y);
    writeOut(c, 0.12 + 0.3 * vA.y, vec3(0.0, 0.0, 1.0), vDepth, uFid);
  }`, { uCol: { value: C(col) }, uCol2: { value: C('#7f96d8') } }, { STREAK: '' });

  // spark / droplet streak: hot core at the head, coloured edge, tail tapers; iA: x seed, y heat (0..1), z kind (0 spark, 1 drop)
  const spark = () => mk('spark', /* glsl */ `
  uniform vec3 uCore, uEdge, uWater, uWater2;
  void main(){
    float t = vUv.y, a = abs(vUv.x - 0.5) * 2.0;
    float w = vA.z > 0.5 ? sqrt(max(1.0 - pow(abs(t - 0.75) / 0.25, 2.0), 0.0)) * step(0.5, t) + (t < 0.5 ? 0.0 : 0.0) : pow(t, 0.8) * (1.0 - smoothstep(0.92, 1.0, t) * 0.6);
    if(vA.z > 0.5){ w = t > 0.5 ? sqrt(max(0.0, 1.0 - pow((t - 0.75) / 0.25, 2.0))) : pow(t / 0.5, 1.6) * 0.95; }
    if(a > w) discard;
    vec3 c; float e;
    if(vA.z > 0.5){ c = mix(uWater2, uWater, step(0.35, a + (1.0 - t) * 0.4)); if(a < 0.3 && t > 0.7 && t < 0.86) c = vec3(1.0); e = 0.15; }
    else { c = mix(uCore, uEdge, smoothstep(0.35, 0.6, a / max(w, 1e-3))); c *= 1.0 + vA.y; e = 1.6 + vA.y; }
    writeOut(c, e, vec3(0.0, 0.0, 1.0), vDepth, uFid);
  }`, { uCore: { value: C('#fffbe0') }, uEdge: { value: C('#ffb23c') }, uWater: { value: C('#eaf8ff') }, uWater2: { value: C('#8fc0ee') } }, { STREAK: '' });

  // snow flake / glitter dot: irregular disc, lit + shade crescent; iA: x seed, y size class
  const flake = () => mk('flake', /* glsl */ `
  uniform vec3 uLit, uShade, uRimC;
  void main(){
    vec2 p = vUv - 0.5; float ang = atan(p.y, p.x), r = length(p) * 2.0;
    float R = 0.82 + 0.1 * sin(ang * 3.0 + vA.x * 40.0) + 0.06 * sin(ang * 5.0 + vA.x * 13.0);
    if(r > R) discard;
    float sh = step(0.25, dot(p, normalize(vec2(0.6, -0.8))) * 2.0 + (vA.x - 0.5) * 0.2);
    vec3 c = mix(uLit, uShade, sh);
    if(r > R - 0.16) c = mix(c, uRimC, 0.5);
    writeOut(c, 0.08, vec3(0.0, 0.0, 1.0), vDepth, uFid);
  }`, { uLit: { value: C('#ffffff') }, uShade: { value: C('#c7c3ee') }, uRimC: { value: C('#b2b4e6') } }, { BILL: '' });

  // puff: drawn vapour / snow / spray cloud, cel 2-tone + outline, dissolves with age; iA: x age 0..1, y seed, z kind
  const puff = (lit = '#ffffff', shade = '#c9c6ec', line = '#9e9ad0', lobe = 1) => mk('puff', /* glsl */ `
  uniform vec3 uLit, uShade, uLine; uniform float uLobe;
  void main(){
    vec2 p = (vUv - 0.5) * 2.0; float ang = atan(p.y, p.x), r = length(p);
    float sd = vA.y * 37.0;
    float R = 0.78 + (0.1 * sin(ang * 5.0 + sd) + 0.07 * sin(ang * 9.0 + sd * 1.7) + 0.05 * sin(ang * 3.0 - sd)) * uLobe;
    R = mix(R, 0.95, smoothstep(-0.2, -0.9, p.y) * 0.4);
    if(r > R) discard;
    float age = vA.x;
    float n = fbm2(p * 2.2 + sd) + (1.0 - r / R) * 0.35;
    if(n < age * 1.25 - 0.15) discard;                    // drawn dissolve: holes eat the puff from the edge in
    float lit = dot(p, normalize(vec2(-0.55, 0.85))) + (vnoise(p * 3.0 + sd) - 0.5) * 0.5;
    vec3 c = mix(uShade, uLit, step(-0.05, lit));
    float edge = step(R - 0.07 - age * 0.05, r) + step(n, age * 1.25 - 0.08) * step(0.01, age);
    c = mix(c, uLine, clamp(edge, 0.0, 1.0) * 0.85);
    writeOut(c, 0.0, vec3(0.0, 0.0, 1.0), vDepth, uFid);
  }`, { uLit: { value: C(lit) }, uShade: { value: C(shade) }, uLine: { value: C(line) }, uLobe: { value: lobe } }, { BILL: '' });

  // splash crown: drawn crown of spikes with droplet tips (upright card); iA: x age, y seed, z tint mix
  const crown = () => mk('crown', /* glsl */ `
  uniform vec3 uLit, uShade, uTint;
  void main(){
    vec2 p = vec2(vUv.x - 0.5, vUv.y);
    float age = vA.x, sd = vA.y * 31.0;
    float base = step(abs(p.x) * 2.0, 1.0) * step(p.y, 0.12 * (1.0 - pow(abs(p.x) * 2.0, 2.0)));
    float sp = 0.0, drop = 0.0;
    for(int i = 0; i < 7; i++){
      float fi = float(i);
      float x = (fi - 3.0) / 3.0 * 0.42 + (hash12(vec2(fi, sd)) - 0.5) * 0.06;
      float h = (0.45 + 0.5 * hash12(vec2(sd, fi))) * (1.0 - abs(x) * 0.9) * (0.6 + 0.6 * age);
      float lean = x * 0.6;
      float t = p.y / h; float cx = x + lean * t * h;
      float w = 0.035 * (1.0 - t) + 0.006;
      if(t > 0.0 && t < 1.0 && abs(p.x - cx) < w) sp = 1.0;
      vec2 dp = vec2(p.x - (x + lean * h * (1.3 + age)), p.y - h * (1.2 + age * 0.8));
      if(length(dp * vec2(1.0, 0.75)) < 0.03 * (1.0 - age * 0.5)) drop = 1.0;
    }
    float m = max(max(base, sp), drop);
    if(m < 0.5) discard;
    vec3 c = mix(uShade, uLit, step(0.0, p.x * -0.4 + 0.03 + (p.y - 0.1) * 0.3));
    c = mix(c, uTint, vA.z * 0.45);
    writeOut(c, 0.1, vec3(0.0, 0.0, 1.0), vDepth, uFid);
  }`, { uLit: { value: C('#f2fbff') }, uShade: { value: C('#9cc2ee') }, uTint: { value: C('#ff6fb8') } }, { UPRIGHT: '' });

  // ring decal on water (instanced flat quad): iA: x age, y seed, z width k
  const ring = () => mk('ring', /* glsl */ `
  uniform vec3 uCol, uCol2;
  void main(){
    float r = length(vUv - 0.5) * 2.0, age = vA.x;
    float w = (0.035 + 0.03 * vA.z) * (1.0 - age * 0.6);
    float wob = (vnoise(vec2(atan(vUv.y - 0.5, vUv.x - 0.5) * 6.0, vA.y * 9.0)) - 0.5) * 0.02;
    float r1 = abs(r - 0.96 + wob), r2 = abs(r - 0.78 + wob * 0.7);
    float m1 = step(r1, w), m2 = step(r2, w * 0.55) * step(0.15, age);
    if(m1 + m2 < 0.5 || age >= 1.0) discard;
    vec3 c = m1 > 0.5 ? uCol : uCol2;
    writeOut(c, 0.35 * (1.0 - age), vec3(0.0, 1.0, 0.0), vDepth, uFid);
  }`, { uCol: { value: C('#fffaf0') }, uCol2: { value: C('#ffe0a8') } }, { MESHI: '' });

  // 4-point star sparkle / glint: iA: x age, y seed, z warm 0..1, w rotation
  const star = () => mk('star', /* glsl */ `
  uniform vec3 uCore, uWarm, uCool;
  void main(){
    vec2 p = (vUv - 0.5) * 2.0;
    float s = 1.0 - vA.x;
    float d1 = abs(p.x) * 10.0 + abs(p.y), d2 = abs(p.x) + abs(p.y) * 10.0;
    float d3 = (abs(p.x + p.y) * 12.0 + abs(p.x - p.y)) / 1.41, d4 = (abs(p.x - p.y) * 12.0 + abs(p.x + p.y)) / 1.41;
    float m = min(d1, d2); float m2 = min(d3, d4);
    float core = step(length(p), 0.12 * s);
    float arms = step(m, s) + step(m2, s * 0.38);
    if(arms + core < 0.5) discard;
    vec3 edge = mix(uCool, uWarm, vA.z);
    vec3 c = mix(edge, uCore, step(m, s * 0.55) + core);
    writeOut(c * 1.4, 2.4, vec3(0.0, 0.0, 1.0), vDepth, uFid);
  }`, { uCore: { value: C('#ffffff') }, uWarm: { value: C('#ffd27a') }, uCool: { value: C('#a8e8ff') } }, { BILL: '' });

  // flame tongue: 3 nested drawn tongues (red / orange / gold-white) + dark red rim; iA: x drawing seed, y height k, z phase
  const flame = () => mk('flame', /* glsl */ `
  uniform vec3 uRed, uOrange, uGold, uRim;
  float tongue(vec2 p, float sd, float k){
    float y = p.y; if(y < 0.0 || y > 1.0) return -1.0;
    float bend = sin(y * 5.0 + sd * 6.28) * 0.12 * y + (vnoise(vec2(y * 3.0, sd * 17.0)) - 0.5) * 0.2 * y;
    float w = 0.5 * pow(1.0 - y, 0.9) * smoothstep(0.0, 0.18, y + 0.06) * (1.0 + 0.25 * sin(y * 9.0 + sd * 20.0));
    return w - abs(p.x - bend);
  }
  void main(){
    vec2 p = vec2(vUv.x - 0.5, vUv.y);
    float sd = vA.x;
    float o = tongue(p, sd, 1.0);
    // a second, shorter tongue licking off the side
    float o2 = tongue(vec2((p.x - 0.18) * 1.4, p.y * 1.6), sd + 0.37, 1.0);
    float outer = max(o, o2 * 0.8);
    if(outer < 0.0) discard;
    float mid = tongue(vec2(p.x * 1.5, p.y * 1.25 + 0.02), sd + 0.11, 1.0);
    float core = tongue(vec2(p.x * 2.6, p.y * 1.9 + 0.05), sd + 0.23, 1.0);
    vec3 c = uRed; float e = 1.4;
    if(mid > 0.0){ c = uOrange; e = 2.0; }
    if(core > 0.0){ c = uGold; e = 2.8; }
    if(outer < 0.022 && mid <= 0.0) { c = uRim; e = 0.6; }
    writeOut(c, e, vec3(0.0, 0.0, 1.0), vDepth, uFid);
  }`, { uRed: { value: C('#ff3b2e') }, uOrange: { value: C('#ff8a2a') }, uGold: { value: C('#fff0b0') }, uRim: { value: C('#8e1e26') } }, { BILL: '' });

  // ember: small glowing flake (rotated diamond with a hot centre); iA: x heat, y seed, z unused, w rot
  const ember = () => mk('ember', /* glsl */ `
  uniform vec3 uHot, uWarm;
  void main(){
    vec2 p = (vUv - 0.5) * 2.0;
    float d = abs(p.x) * 1.6 + abs(p.y) * (0.9 + vA.y * 0.6);
    if(d > 1.0) discard;
    vec3 c = mix(uHot, uWarm, smoothstep(0.35, 0.7, d));
    writeOut(c * (0.8 + vA.x), 1.4 + vA.x, vec3(0.0, 0.0, 1.0), vDepth, uFid);
  }`, { uHot: { value: C('#fff1b8') }, uWarm: { value: C('#ff5a24') } }, { BILL: '' });

  // drawn ribbon: slash arc / X-cut / crack / mercury. uv.x along (0 tail .. 1 head), uv.y across; vA.x = age
  // kind 0 slash (white core, coloured edge, ink-dark outer), 1 crack (white line, blue edge), 2 mercury, 3 water curtain
  const ribbon = (kind, col = '#5cf2ff', col2 = '#1a5aa8') => mk('ribbon' + kind, /* glsl */ `
  uniform vec3 uCore, uEdge, uOuter; uniform float uKind, uAge, uReveal, uBright, uSeed, uPhase;
  void main(){
    float u = vUv.x, v = abs(vUv.y - 0.5) * 2.0;
    float age = uAge;
    if(uKind < 0.5){
      float prof = pow(sin(3.14159 * clamp(u, 0.0, 1.0)), 0.55) * mix(0.55, 1.0, u) * (1.0 - age * 0.55);
      if(u < age * 0.9 || u > uReveal) discard;
      float a = v / max(prof, 1e-3);
      if(a > 1.0) discard;
      if(age > 0.3 && vnoise(vec2(u * 18.0 + uSeed * 9.0, 0.5)) < (age - 0.3) * 1.1) discard;   // breaks into dashes
      float core = 0.3 + 0.12 * (1.0 - age);
      vec3 c = a < core ? uCore : (a < 0.8 ? uEdge : uOuter);
      if(a >= core && a < core + 0.08) c = mix(uCore, uEdge, 0.45);
      float e = a < core ? 1.3 * uBright : (a < 0.8 ? 0.35 * uBright : 0.0);
      writeOut(c, e, vec3(0.0, 0.0, 1.0), vDepth, uFid);
    } else if(uKind < 1.5){
      if(u > uReveal) discard;
      float n = vnoise(vec2(u * 40.0 + uSeed, uPhase * 13.0));
      float a = v;
      if(a > 0.9) discard;
      vec3 c = a < 0.4 ? uCore : uEdge;
      float fl = uBright * (0.6 + 0.8 * n);
      writeOut(c * (0.8 + fl * 0.4), 1.8 * fl, vec3(0.0, 1.0, 0.0), vDepth, uFid);
    } else if(uKind < 2.5){
      if(u > uReveal) discard;
      float a = v;
      vec3 c = a < 0.28 ? uCore : (a < 0.8 ? uEdge : uOuter);
      float hl = step(0.6, vnoise(vec2(u * 30.0 - uPhase * 6.0, uSeed)));
      if(a < 0.5) c = mix(c, vec3(1.0), hl * 0.7);
      writeOut(c, 0.6 * uBright + hl * 0.6, vec3(0.0, 1.0, 0.0), vDepth, uFid);
    } else {
      // falling water curtain (top u 0 .. bottom 1): thin drawn strands with gaps (the body shows through), each strand
      // breaking into drips lower down; white foam head, pale-blue edges, dark outline, torn sides
      if(u > uReveal) discard;
      float edge = 0.8 + 0.2 * vnoise(vec2(u * 6.0 - uPhase * 3.0, uSeed + 3.0));
      if(v > edge) discard;
      float x = vUv.y * 7.0 + uSeed * 3.1, ci = floor(x), cf = fract(x);
      float h = fract(sin(ci * 12.9898 + uSeed * 78.233) * 43758.5453);
      float sw = 0.13 + 0.2 * h;                                                   // strand half width (cell units)
      float dx = abs(cf - 0.5 - 0.22 * sin(u * 7.0 + h * 6.28) - 0.05 * sin(u * 23.0 - uPhase * 3.0));
      float brk = 0.35 + 0.4 * h;                                                    // where the strand breaks into drips
      float head = 1.0 - smoothstep(0.0, 0.07, u);                                   // foam head: strands join at the top
      float swU = sw * (1.0 + head * 1.6) * (1.0 - 0.45 * smoothstep(brk - 0.25, brk, u));
      bool strand = u < brk ? dx < swU : false;
      float dp = fract(u * (6.0 + 5.0 * h) - uPhase * 1.3 + h * 5.0);
      bool drip = u >= brk - 0.05 && dx < sw * 0.8 && dp < 0.22 + 0.1 * h;            // short falling dashes
      if(!(strand || drip)) discard;
      if(vnoise(vec2(ci + uSeed, u * 4.0)) < age * 0.9) discard;
      float r = dx / max(strand ? swU : sw * 0.8, 1e-3);
      vec3 c = r < 0.4 ? uCore : (r < 0.82 ? uEdge : uEdge * 0.7);
      if(head > 0.5) c = mix(c, uCore, 0.6);
      writeOut(c, r < 0.4 ? 0.45 : 0.1, vec3(0.0, 0.0, 1.0), vDepth, uFid);
    }
  }`, {
    uCore: { value: C(kind === 0 ? '#ffffff' : kind === 1 ? '#ffffff' : kind === 2 ? '#f4f6ff' : '#f3fbff') },
    uEdge: { value: C(col) }, uOuter: { value: C(col2) },
    uKind: { value: kind }, uAge: { value: 0 }, uReveal: { value: 1 }, uBright: { value: 1 }, uSeed: { value: 0 }, uPhase: { value: 0 },
  }, { RIBBON: '' });

  // water sheet (plain mesh, uv.x along the sheet, uv.y from root 0 to lip 1): cel water with gold streaks, white lip, torn
  const sheet = () => mk('sheet', /* glsl */ `
  uniform vec3 uLit, uShade, uLip, uGold; uniform float uAge, uSeed;
  void main(){
    vec2 uv = vUv;
    float n = fbm2(vec2(uv.x * 5.0 + uSeed * 7.0, uv.y * 2.5));
    float top = 0.8 + 0.2 * vnoise(vec2(uv.x * 9.0 + uSeed * 3.0, 1.0));
    if(uv.y > top) discard;
    if(n < uAge * 1.15 - 0.2 + (1.0 - uv.y) * 0.1) discard;
    float sideFade = smoothstep(0.0, 0.08, uv.x) * smoothstep(1.0, 0.92, uv.x);
    if(sideFade < 0.5 * (0.6 + 0.4 * n)) discard;
    vec3 c = mix(uShade, uLit, step(0.5, uv.y + (vnoise(vec2(uv.x * 14.0 + uSeed, uv.y * 3.0)) - 0.5) * 0.5));
    float gs = step(0.7, vnoise(vec2(uv.x * 30.0 + uSeed * 5.0, uv.y * 1.2)));
    c = mix(c, uGold, gs * 0.75);
    if(uv.y > top - 0.07) c = uLip;
    writeOut(c, 0.15 + gs * 0.3, normalize(vNV), vDepth, uFid);
  }`, { uLit: { value: C('#e8f6ff') }, uShade: { value: C('#86b4e6') }, uLip: { value: C('#ffffff') }, uGold: { value: C('#ffd08a') }, uAge: { value: 0 }, uSeed: { value: 0 } });

  // falling raindrop (BILL, card = 1 x (1 + 1.6 streak) drop diameters, body at the bottom): round cel drop with a dark
  // rim, white highlight, sunset crescent, and a short motion streak above it; iA: x streak 0..1, y seed
  const drop = () => mk('drop', /* glsl */ `
  uniform vec3 uBody, uShade, uRimC, uGold;
  void main(){
    float L = 1.0 + vA.x * 1.6;                                  // card height in body diameters
    vec2 p = vec2((vUv.x - 0.5) * 2.0, vUv.y * L * 2.0 - 1.0);   // body centred at (0, 0), radius 1
    float d = length(vec2(p.x * (1.0 + max(p.y, 0.0) * 0.3 * vA.x), p.y)) - 1.0;
    if(d > 0.0){
      // short motion streak: 3 thin tapering lines above the drop
      float y = p.y - 0.6; if(y < 0.0 || vA.x < 0.05) discard;
      float k = y / max(L * 2.0 - 1.6, 1e-3);
      float w = 0.11 * (1.0 - k);
      float side = min(abs(p.x - 0.5), abs(p.x + 0.5));
      bool mid = abs(p.x) < w && k < 1.0, sides = side < w * 0.8 && k < 0.55;
      if(!(mid || sides)) discard;
      writeOut(mix(uBody, uShade, k), 0.1, vec3(0.0, 0.0, 1.0), vDepth, uFid);
      return;
    }
    vec3 c = mix(uShade, uBody, step(0.0, -p.x * 0.8 + p.y * 0.4 + 0.15));
    if(d > -0.13) c = uRimC;
    if(length(p - vec2(-0.36, 0.4)) < 0.2) c = vec3(1.0);
    if(d < -0.2 && d > -0.42 && p.y < -0.2 && p.x > 0.0) c = uGold;
    writeOut(c, 0.3, vec3(0.0, 0.0, 1.0), vDepth, uFid);
  }`, { uBody: { value: C('#bfe6ff') }, uShade: { value: C('#6c9ee0') }, uRimC: { value: C('#33407e') }, uGold: { value: C('#ffc870') } }, { BILL: '' });

  // tiny glitter dot (BILL): hard white core + coloured ring; iA: x age, y seed, z warm
  const dot = () => mk('dot', /* glsl */ `
  uniform vec3 uWarm, uCool;
  void main(){
    float r = length(vUv - 0.5) * 2.0, s = 1.0 - vA.x * 0.6;
    if(r > s) discard;
    vec3 c = r < s * 0.55 ? vec3(1.0) : mix(uCool, uWarm, vA.z);
    writeOut(c * 1.3, 2.0, vec3(0.0, 0.0, 1.0), vDepth, uFid);
  }`, { uWarm: { value: C('#ffd27a') }, uCool: { value: C('#a8e8ff') } }, { BILL: '' });

  // water crown curtain (plain mesh: uv.x around, uv.y root 0 .. rim 1): scalloped spiky rim with droplet beads, white rim
  // line, lit / shade cel water with vertical streaks; uAge eats it from the root up as it collapses
  const crownSheet = () => mk('crownSheet', /* glsl */ `
  uniform vec3 uLit, uShade, uLip, uDeep; uniform float uAge, uSeed, uSpikes;
  void main(){
    vec2 uv = vUv;
    float sp = fract(uv.x * uSpikes + uSeed), sid = floor(uv.x * uSpikes + uSeed);
    float hgt = 0.6 + 0.25 * hash12(vec2(sid, uSeed * 7.0));
    float spike = hgt + (0.97 - hgt) * pow(max(0.0, 1.0 - abs(sp - 0.5) * 2.0), 3.0);
    float bead = length(vec2((sp - 0.5) * 2.4, (uv.y - min(spike + 0.07, 0.99)) * 10.0));
    bool isBead = bead < 0.8 && uv.y > spike && hash12(vec2(sid, uSeed + 3.0)) > 0.3;
    if(uv.y > spike && !isBead) discard;
    if(uv.y < uAge * 0.95 - 0.05 + 0.1 * vnoise(vec2(uv.x * 20.0, uSeed))) discard;   // collapses from the root
    float side = smoothstep(0.0, 0.03, uv.x) * smoothstep(1.0, 0.97, uv.x);
    if(side < 0.5) discard;
    vec3 c = mix(uShade, uLit, step(0.42, uv.y + (vnoise(vec2(uv.x * 30.0 + uSeed, uv.y * 2.0)) - 0.5) * 0.35));
    float streak = step(0.72, vnoise(vec2(uv.x * 48.0 + uSeed * 3.0, uv.y * 0.8)));
    c = mix(c, uLip, streak * 0.55);
    c = mix(c, uDeep, step(uv.y, 0.12) * 0.6);
    if(isBead || uv.y > spike - 0.08) c = uLip;
    writeOut(c, 0.15 + 0.2 * streak, normalize(vNV), vDepth, uFid);
  }`, { uLit: { value: C('#eef9ff') }, uShade: { value: C('#8cbcee') }, uLip: { value: C('#ffffff') }, uDeep: { value: C('#5f86c8') },
    uAge: { value: 0 }, uSeed: { value: 0 }, uSpikes: { value: 14 } });

  // transparent wall-of-water sheet (plain mesh): colour blends over the frame, emissive + data stay untouched (no ink);
  // torn top with a white foam rim, vertical fall streaks, gold sun glints. uAlpha, uTone (0 near / white .. 1 far / cool)
  const wallSheet = () => {
    const m = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: VS, side: THREE.DoubleSide, transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      uniforms: { ...A.AU, ...shared, uLit: { value: C('#f2fbff') }, uShade: { value: C('#9cc8f0') }, uFar: { value: C('#b8a8e8') }, uGold: { value: C('#ffd590') },
        uAge: { value: 0 }, uSeed: { value: 0 }, uAlpha: { value: 0.6 }, uTone: { value: 0.5 } },
      fragmentShader: /* glsl */ `
      ${A.GLSL.NOISE}
      uniform vec3 uLit, uShade, uFar, uGold; uniform float uAge, uSeed, uAlpha, uTone;
      varying vec3 vW, vNW, vNV, vLocal, vColor, vNL; varying float vDepth; varying vec2 vUv; varying vec4 vA;
      layout(location = 0) out vec4 oColor; layout(location = 1) out vec4 oData;
      void main(){
        vec2 uv = vUv;
        float n = fbm2(vec2(uv.x * 7.0 + uSeed * 5.0, uv.y * 2.0 - uAge * 1.5));
        float top = 0.72 + 0.22 * vnoise(vec2(uv.x * 11.0 + uSeed * 3.0, uAge * 2.0)) + 0.05 * sin(uv.x * 60.0 + uSeed);
        if(uv.y > top) discard;
        if(n < uAge * 1.1 - 0.25 + (1.0 - uv.y) * 0.15) discard;
        float sideFade = smoothstep(0.0, 0.06, uv.x) * smoothstep(1.0, 0.94, uv.x);
        if(sideFade < 0.5 * (0.6 + 0.4 * n)) discard;
        vec3 c = mix(uShade, uLit, step(0.45, uv.y + (vnoise(vec2(uv.x * 16.0 + uSeed, uv.y * 3.0)) - 0.5) * 0.45));
        c = mix(c, uFar, uTone * 0.55);
        float fall = step(0.7, vnoise(vec2(uv.x * 70.0 + uSeed * 9.0, uv.y * 1.5 + uAge * 3.0)));
        float gs = step(0.82, vnoise(vec2(uv.x * 34.0 + uSeed * 5.0, uv.y * 4.0)));
        c = mix(c, vec3(1.0), fall * 0.45);
        c = mix(c, uGold, gs * 0.7);
        float rim = step(top - 0.05 - 0.03 * uTone, uv.y);
        c = mix(c, vec3(1.0), rim);
        float a = uAlpha * (0.55 + 0.45 * uv.y) + rim * 0.5 + fall * 0.2 + gs * 0.3;
        oColor = vec4(c, clamp(a, 0.0, 1.0)); oData = vec4(0.0);
      }` });
    m.name = 'fx_wallSheet';
    return m;
  };

  return { VS, shared, mk, rain, spark, flake, puff, crown, ring, star, flame, ember, ribbon, sheet, drop, dot, crownSheet, wallSheet };
}
