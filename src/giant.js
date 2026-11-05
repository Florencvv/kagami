// giant.js - UTSUSHI 写し, the mirror-shard giant (dept FX). Original design.
//
// ctx.api.giant = {
//   root                     THREE.Group (world placement is done by pose(); do not move it yourself)
//   show(bool)               visible or not (auto choreography sets it; call after it to override)
//   pose(p)                  p = name | object, merged on the current pose:
//       names: 'stand' 'emerge' 'push' 'windup' 'swing' 'follow' 'reach' 'reel' 'lie' (see POSES)
//       { rise 0..1          real: 0 head just under the water .. 1 feet on the lake
//                            reflect: 0 deep in the mirror .. 1 face just under the surface
//         x, z, yaw          real: root placement on the lake; reflect: point under which the face (between the eyes) sits
//         lie 0..1           reflect only: 1 = lying face-up under the mirror (default in reflect mode), 0 = upright
//         scale              size multiplier (reflect default 1.35: the giant in the mirror is colossal; real 1)
//         head [x,y,z]       head rotation (rad)   chest [x,y,z]
//         armL / armR [shX, shY, shZ, elbow]  (rad)  wristR [x,y,z]
//         sword 0..1         swing preset for the right arm (0 rest, .35 wind-up, .6 mid-swing, 1 follow-through)
//         reel 0..1          head + chest thrown back
//       }
//   reflectOnly(bool)        true: lives only in the reflection (layer 2, mirrored geometry above y=0); false: real (layer 0)
//   eyes(k)                  0 closed .. 1 open white suns (>1 brighter); in reflect mode they are the brightest thing
//   aura(k)                  reflect mode: soft dark aura behind the giant in the reflected sky (default .75, 0 off)
//   haze(k)                  real mode: warm sunset haze over the upper body (default .42)
//   crackFace(k)             0..1: two slash cracks across the face, white light in the cracks (k .0-.5 first, .5-1 second)
//   xCut(k)                  0..1: the X through the chest: 0-.25 the light runs along both lines, then glows and the 4 pieces part
//   shatter(k)               0..1: every shard flies apart, spins, sinks and shrinks to nothing
//   anchor(name, out?)       world position of eyeL eyeR head chest swordTip swordBase handR handL shoulderL shoulderR
//                            forearmL forearmR elbowL elbowR footL footR crest (actual geometry: mirrored in reflect mode)
//   auto                     true (default): update(st) runs the film choreography from CUES; set false to drive it yourself.
//                            Direction runs after giant.update and may override anything for its shot.
//   sun(dirVec3)             the sun direction the shards reflect (defaults to the LAKE sun, low in -z)
// }
// Test views (q): giant=1 shows it in test mode, gpose=<name>, grise, glie, greflect=1, gcrack, gx, gshatter, geyes, gsword,
//   gscale, gaura, ghaze, gz, gx0, gyaw
// Everything is a pure function of st.t; the auto choreography is on twos with long holds.
export async function create(ctx) {
  const { THREE, A, LAYER } = ctx;
  const rng = ctx.rng(3232);
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const tmp = V3(), tmp2 = V3();

  // ------------------------------------------------------------------ material: mirror shards
  // Each shard is a flat mirror polygon (fan around its centroid). aS = (seed, pu, pv, e): pu/pv planar coords in the shard
  // (-1..1, for the glint strokes), e = 0 on the rim .. 1 at the centroid (ink gap width in px). aF = (glow, size m, height
  // 0..1 on the body, spare). Colour = a DESIGNED sunset sky picked by the reflected ray (gold / peach / pink / lilac / pale
  // blue), sun-catchers blaze white-gold, only down- and edge-turned facets go cool violet, crisp white glint strokes on
  // the big plates, warm haze over the upper body so 200 m reads.
  const SHARD_VS = /* glsl */ `
    attribute vec4 aS;
    attribute vec4 aF;
    varying vec3 vW, vNW, vNV, vLocal, vColor, vNL;
    varying float vDepth;
    varying vec2 vUv;
    varying vec4 vS, vF;
    void main(){
      vec4 lp = vec4(position, 1.0);
      vec3 n = normal;
    #ifdef USE_INSTANCING
      lp = instanceMatrix * lp; n = mat3(instanceMatrix) * n;
    #endif
      vec4 wp = modelMatrix * lp;
      vW = wp.xyz; vLocal = position; vNL = normal;
      vNW = normalize(mat3(modelMatrix) * n);
      vNV = normalize(mat3(viewMatrix) * vNW);
      vec4 mv = viewMatrix * wp;
      vDepth = -mv.z; vUv = uv; vColor = vec3(1.0);
      vS = aS; vF = aF;
    #ifdef USE_INSTANCING
      vS.x = fract(aS.x + instanceMatrix[3].x * 0.1371 + instanceMatrix[3].z * 0.0713 + instanceMatrix[3].y * 0.031);
    #endif
      gl_Position = projectionMatrix * mv;
    }`;
  const SHARD_FS = /* glsl */ `
    ${A.GLSL.NOISE}
    ${A.GLSL.GLOBAL_PARS}
    uniform vec3 uP0, uP1, uP2, uP3, uP4, uGSun, uSunC, uGlowC, uInkC, uShadeC, uHazeC;
    uniform float uBlaze, uGid, uEdge, uHaze, uGain, uGlint, uSat;
    varying vec4 vS, vF;
    vec3 pal(float e){
      vec3 c = mix(uP0, uP1, smoothstep(0.08, 0.22, e));
      c = mix(c, uP2, smoothstep(0.25, 0.42, e));
      c = mix(c, uP3, smoothstep(0.45, 0.68, e));
      return mix(c, uP4, smoothstep(0.7, 0.95, e));
    }
    void main(){
      vec3 N = normalize(vNW);
      if(!gl_FrontFacing) N = -N;
      vec3 V = normalize(cameraPosition - vW);
      float seed = vS.x;
      vec3 jit = vec3(fract(seed * 91.7), fract(seed * 47.3), fract(seed * 23.9)) - 0.5;
      vec3 Ns = normalize(N + jit * 0.22);                         // no two neighbours tilt alike
      vec3 R = reflect(-V, Ns);
      vec3 c = pal(abs(R.y));
      vec2 rh = normalize(R.xz + vec2(1e-4)), sh = normalize(uGSun.xz + vec2(1e-4));
      c = mix(c, c * vec3(1.07, 0.98, 0.84), smoothstep(0.2, 0.95, dot(rh, sh)) * 0.6);   // toward the sun: gold
      if(R.y < 0.0) c *= vec3(0.92, 0.9, 0.98);                     // the mirror below: a touch deeper
      float h = vF.z;
      c = mix(c, uP0, smoothstep(0.72, 1.0, h) * 0.25);            // head + shoulders catch the gold
      c = mix(c, uP3, smoothstep(0.42, 0.05, h) * 0.2);            // legs cooler lilac
      c = mix(c, uP0 * 1.04, step(0.72, fract(seed * 29.7)) * 0.5);   // a quarter of the shards lean gold
      c *= mix(0.9, 1.07, fract(seed * 7.31)) * uGain;
      // shadow side: facets turned down, or edge-on at the silhouette, go cool violet (form)
      float down = smoothstep(-0.05, -0.55, Ns.y);
      float graze = smoothstep(0.32, 0.1, abs(dot(Ns, V)));
      vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
      float away = smoothstep(0.3, 0.8, dot(Ns, camR)) * 0.75;      // designed key from screen-left: the right flank cools
      float shade = max(max(down, graze), away) * (0.6 + 0.4 * step(0.3, fract(seed * 5.71)));
      c = mix(c, uShadeC * mix(0.85, 1.12, fract(seed * 2.9)), shade * 0.85);
      // sun-catchers: facets that reflect the sun + a few lucky shards blaze white-gold
      float sunR = max(dot(R, uGSun), 0.0);
      float blaze = max(smoothstep(0.88, 0.97, sunR), step(0.935, fract(seed * 3.7)) * (1.0 - shade)) * uBlaze;
      c = mix(c, uSunC, blaze);
      // painted glass: a second value on a diagonal inside the shard
      vec2 pp = vS.yz;
      float split = step(0.0, pp.x * 0.8 - pp.y + (fract(seed * 13.7) - 0.5) * 0.9);
      c *= mix(0.92, 1.05, split);
      // one or two crisp white diagonal glint strokes on the large plates
      float big = smoothstep(3.5, 8.0, vF.y) * uGlint;
      float g = (pp.x + pp.y) * 0.7071, o1 = (fract(seed * 3.17) - 0.5) * 0.8;
      float gw = 0.045 + 0.05 * fract(seed * 5.3), fw = fwidth(g) * 0.8;
      float s1 = 1.0 - smoothstep(gw - fw, gw + fw, abs(g - o1));
      float s2 = (1.0 - smoothstep(gw * 0.4 - fw, gw * 0.4 + fw, abs(g - o1 - gw * 3.4))) * step(0.4, fract(seed * 11.1));
      float along = (pp.x - pp.y) * 0.7071;
      float len = 1.0 - smoothstep(0.42, 0.5, abs(along - (fract(seed * 19.1) - 0.5) * 0.5) / (0.6 + 0.6 * fract(seed * 23.3)));
      float glint = max(s1, s2) * len * big * step(0.2, fract(seed * 17.3));
      c = mix(c, vec3(1.0, 0.99, 0.95), glint);
      c = max(mix(vec3(dot(c, vec3(0.3, 0.55, 0.15))), c, uSat), 0.0);
      // atmosphere: the upper body sinks into the warm haze (reads as 200 m)
      float hz = uHaze * smoothstep(0.25, 1.0, h) * clamp(vDepth / 520.0, 0.2, 1.0) * (1.0 - 0.7 * smoothstep(0.5, 0.9, abs(V.y)));
      c = mix(c, uHazeC, hz);
      // thin dark gaps (rim of every shard) and white light in the cracks
      float dpx = vS.w / max(fwidth(vS.w), 1e-5);
      float glow = vF.x;
      float ink = (1.0 - smoothstep(0.5 * uEdge, 1.4 * uEdge, dpx)) * (1.0 - min(glow * 2.0, 1.0));
      c = mix(c, mix(uInkC, uHazeC, hz * 0.85), ink * (1.0 - blaze * 0.4));
      float ge = (1.0 - smoothstep(0.8, 1.6 + 3.5 * glow, dpx)) * min(glow, 1.0);
      c = mix(c, uGlowC * (1.0 + glow), ge);
      c = mix(c, uGlowC, clamp(glow - 1.0, 0.0, 1.0) * 0.8);   // glow > 1: the whole shard burns white
      float emis = blaze * 0.8 + glint * 0.45 + ge * 1.3 + clamp(glow - 1.0, 0.0, 1.0) * 2.0;
      writeOut(c, emis, gl_FrontFacing ? normalize(vNV) : -normalize(vNV), vDepth, uGid);
    }`;
  const C = (h) => new THREE.Color(h);
  const shardUniforms = () => ({
    uP0: { value: C('#ffd690') }, uP1: { value: C('#ffb89c') }, uP2: { value: C('#f6a8c2') }, uP3: { value: C('#cdb6ee') }, uP4: { value: C('#b6d2f6') },
    uGSun: { value: V3(0, 0.07, -1).normalize() }, uSunC: { value: C('#fff4d4') }, uGlowC: { value: C('#fffaf0') },
    uInkC: { value: C('#2a2148') }, uShadeC: { value: C('#7a6ac0') }, uHazeC: { value: C('#f4c6bc') },
    uBlaze: { value: 1 }, uGid: { value: 30 }, uEdge: { value: 1 }, uHaze: { value: 0.42 }, uGain: { value: 1 }, uGlint: { value: 1 }, uSat: { value: 1.08 },
  });
  function shardMaterial(extra = {}) {
    const m = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, uniforms: { ...A.AU, ...shardUniforms(), ...extra }, vertexShader: SHARD_VS, fragmentShader: SHARD_FS,
      side: THREE.DoubleSide,
    });
    m.name = 'utsushi_shard';
    return m;
  }
  const mat = shardMaterial();
  // dark cores show through the gaps; same id as the shards so the post ink draws only the silhouette, not every gap
  const coreMat = A.celMaterial({ base: '#2a2450', shade: '#1a1634', id: 30, highlight: 0, rimColor: '#ffb070', rimWidth: 0.1 });
  coreMat.side = THREE.DoubleSide;

  // ------------------------------------------------------------------ skeleton (rest pose: feet y=0, faces +z, 200 m)
  const root = new THREE.Group(); root.name = 'UTSUSHI';
  const mirrorWrap = new THREE.Group(); mirrorWrap.add(root);     // scale.y = -1 in reflect mode
  const holder = new THREE.Group(); holder.add(mirrorWrap);
  const parentSet = ctx.sets?.LAKE ?? ctx.scene;
  ctx.scene.add(holder);   // the giant must also show over SKY; main toggles sets, so it hangs off the scene
  const node = (name, parent, x, y, z) => { const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); parent.add(o); N[name] = o; return o; };
  const N = {};
  node('hips', root, 0, 96, 0);
  node('chest', N.hips, 0, 18, 0);
  node('neck', N.chest, 0, 58, 0);
  node('head', N.neck, 0, 6, 0);
  for (const s of [-1, 1]) {
    const L = s < 0 ? 'L' : 'R';   // L = giant's left = +x when facing +z? keep simple: L at -x
    node('shoulder' + L, N.chest, s * 40, 46, 0);
    node('elbow' + L, N['shoulder' + L], 0, -46, 0);
    node('wrist' + L, N['elbow' + L], 0, -42, 0);
    node('thigh' + L, N.hips, s * 15, -4, 0);
    node('knee' + L, N['thigh' + L], 0, -46, 0);
    node('ankle' + L, N['knee' + L], 0, -44, 0);
  }
  node('sword', N.wristR, 0, -7, 0);
  // kusazuri plates swing from their own pivots
  const KUS = [];
  for (let i = 0; i < 6; i++) {
    const a = (i - 2.5) / 2.5 * 1.9;   // around the front and sides
    const o = node('kus' + i, N.hips, Math.sin(a) * 25, 4, Math.cos(a) * 20);
    o.rotation.y = a; KUS.push(o);
  }

  // ------------------------------------------------------------------ shard builder
  // shard = {part, pts: [V3 rim, ordered], n (flat normal), c (centroid), seed, size (max rim radius, m)}
  // Surfaces are irregular grids whose cells are MERGED at random into big plates (2x2, 2x1) or split into small triangles,
  // so shard sizes vary (big plates on chest / shoulders / thighs, small ones at the joints). Gaps are a constant ~0.6 m.
  const shards = [], cores = [];
  const GAP_M = 0.6;
  function addShard(part, pts, outHint, centre) {
    const q = [];
    for (const p of pts) if (!q.length || q[q.length - 1].distanceToSquared(p) > 1e-4) q.push(p);
    while (q.length > 2 && q[0].distanceToSquared(q[q.length - 1]) < 1e-4) q.pop();
    if (q.length < 3) return;
    const c = V3(); q.forEach((p) => c.add(p)); c.multiplyScalar(1 / q.length);
    if (centre) c.copy(centre);   // fan centre on the surface, so merged plates never dip into the dark core
    const n = V3();   // Newell normal (robust for slightly bent polygons)
    for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; n.x += (a.y - b.y) * (a.z + b.z); n.y += (a.z - b.z) * (a.x + b.x); n.z += (a.x - b.x) * (a.y + b.y); }
    if (n.lengthSq() < 1e-8) return;
    n.normalize();
    let P = q;
    if (outHint && n.dot(outHint) < 0) { P = q.slice().reverse(); n.negate(); }
    let size = 0; for (const p of P) size = Math.max(size, p.distanceTo(c));
    if (size < 0.05) return;
    const k = Math.min(0.2, GAP_M / size);
    shards.push({ part, pts: P.map((p) => p.clone().lerp(c, k)), n, c, seed: rng(), size });
  }
  // irregular grid surface f(u, v) -> V3 (local); o: {wrapU, out(p) -> outward hint, jit, big, med, split}
  function gridSurface(part, f, nu, nv, o = {}) {
    const jit = o.jit ?? 0.45, wrap = !!o.wrapU, P = [];
    for (let j = 0; j <= nv; j++) {
      P.push([]);
      for (let i = 0; i <= nu; i++) {
        if (wrap && i === nu) { P[j].push(P[j][0]); continue; }
        let u = i / nu, v = j / nv;
        const edgeU = !wrap && (i === 0 || i === nu), edgeV = j === 0 || j === nv;
        if (!edgeU) u += (rng() - 0.5) * jit / nu;
        if (!edgeV) v += (rng() - 0.5) * jit / nv;
        P[j].push(f(u, v));
      }
    }
    const pt = (i, j) => P[j][wrap ? i % nu : i];
    const own = Array.from({ length: nv }, () => new Array(nu).fill(false));
    const free = (i, j) => j < nv && (wrap || i < nu) && !own[j][i % nu];
    const order = []; for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) order.push([i, j]);
    for (let k = order.length - 1; k > 0; k--) { const r = Math.floor(rng() * (k + 1)); const t = order[k]; order[k] = order[r]; order[r] = t; }
    const big = o.big ?? 0.2, med = o.med ?? 0.3, split = o.split ?? 0.3;
    for (const [i, j] of order) {
      if (own[j][i]) continue;
      let w = 1, h = 1; const r = rng();
      if (nu > 2 && r < big && free(i + 1, j) && free(i, j + 1) && free(i + 1, j + 1)) { w = 2; h = 2; }
      else if (r < big + med) {
        const horiz = rng() < 0.5;
        if (horiz && nu > 2 && free(i + 1, j)) w = 2; else if (free(i, j + 1)) h = 2; else if (nu > 2 && free(i + 1, j)) w = 2;
      }
      for (let y = j; y < j + h; y++) for (let x = i; x < i + w; x++) own[y][x % nu] = true;
      const rim = [];
      for (let x = i; x <= i + w; x++) rim.push(pt(x, j));
      for (let y = j + 1; y <= j + h; y++) rim.push(pt(i + w, y));
      for (let x = i + w - 1; x >= i; x--) rim.push(pt(x, j + h));
      for (let y = j + h - 1; y > j; y--) rim.push(pt(i, y));
      const cen = V3(); rim.forEach((p) => cen.add(p)); cen.multiplyScalar(1 / rim.length);
      const out = o.out ? o.out(cen) : null;
      const sc = w * h > 1 ? f((i + w / 2) / nu, (j + h / 2) / nv) : null;
      if (w === 1 && h === 1 && rng() < split) {
        const [a, b, c, d] = rim;
        if (rng() < 0.5) { addShard(part, [a, b, c], out); addShard(part, [a, c, d], out); }
        else { addShard(part, [a, b, d], out); addShard(part, [b, c, d], out); }
      } else addShard(part, rim, out, sc);
    }
  }
  // ellipsoid-ish shell: centre, radii, opts {keel: front ridge, flat: front flattening, taper, vMin, vMax, core, + grid opts}
  function shell(part, cen, r, nu, nv, o = {}) {
    const vMin = o.vMin ?? 0, vMax = o.vMax ?? 1;
    const f = (u, v) => {
      const th = u * Math.PI * 2, ph = (vMin + (vMax - vMin) * v) * Math.PI;   // ph 0 bottom .. PI top
      const sy = -Math.cos(ph), sr = Math.sin(ph);
      const x = Math.sin(th) * sr; let z = Math.cos(th) * sr;
      let k = 1;
      if (o.keel) k *= 1 + o.keel * Math.pow(Math.max(Math.cos(th), 0), 10) * sr;
      if (o.flat && z > 0) z *= 1 - o.flat;
      if (o.taper) { const t = (sy + 1) / 2; k *= 1 + o.taper * (t - 0.5); }
      return V3(cen.x + x * r.x * k, cen.y + sy * r.y, cen.z + z * r.z * k);
    };
    gridSurface(part, f, nu, nv, { ...o, wrapU: true, out: (p) => tmp2.copy(p).sub(cen).normalize().clone() });
    if (o.core !== false) cores.push({ part, cen, r: r.clone().multiplyScalar(Math.cos(Math.PI / nu) * Math.cos(Math.PI / (2 * nv)) * 0.86), vMin, vMax });
  }
  // two-sided plate: f(u, v) is the face, the back sits `th` behind along the hint (a vector or a function of the point)
  function plate(part, f, nu, nv, outHint, th = 1.5, o = {}) {
    const H = typeof outHint === 'function' ? outHint : () => outHint;
    gridSurface(part, f, nu, nv, { ...o, out: (p) => H(p) });
    const g = (u, v) => { const p = f(u, v); return p.addScaledVector(H(p), -th); };
    gridSurface(part, g, Math.max(1, nu - 1), Math.max(1, nv - 1), { ...o, out: (p) => H(p).clone().negate() });
  }
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---- torso: broad cuirass of big plates over a narrow waist
  shell('hips', V3(0, 10, 0), V3(25, 17, 19), 10, 4, { big: 0.25 });
  shell('chest', V3(0, 33, 1), V3(41, 32, 26), 12, 7, { keel: 0.24, flat: 0.14, taper: 0.5, big: 0.6, med: 0.3, split: 0.15 });
  shell('neck', V3(0, 2, 0), V3(10, 8, 10), 7, 2, { big: 0, med: 0, split: 0.7 });
  // ---- head: faceted mask, low helmet bowl with a hard brow, crescent maedate + two swept blades
  shell('head', V3(0, 13, 2), V3(12, 15, 13.5), 8, 5, { flat: 0.22, keel: 0.3, big: 0.15, med: 0.3, jit: 0.3 });
  shell('head', V3(0, 21, -1), V3(17.5, 14, 18.5), 9, 3, { vMin: 0.5, vMax: 1, keel: 0.14, big: 0.35, jit: 0.25 });
  // brow (mabizashi): a hard visor ridge jutting forward over the eyes, pointed in the middle
  plate('head', (u, v) => {
    const s = u * 2 - 1, a = s * 1.35, rr = lerp(16.5, 22.5, v) + (1 - Math.abs(s)) * 4.5 * v;
    return V3(Math.sin(a) * rr, lerp(22, 18.5, v) + Math.abs(s) * 1.5, Math.cos(a) * rr - 1);
  }, 6, 1, V3(0, 1, 0.3).normalize(), 1.8, { jit: 0.15, big: 0.3, split: 0.2 });
  // fukigaeshi: two angular turn-backs at the sides of the bowl
  for (const s of [-1, 1]) {
    plate('head', (u, v) => V3(s * lerp(17, 23, u) , lerp(23, 13, v) + u * 3, lerp(9, -3, v) - u * 5), 2, 2, V3(s, 0.2, 0.5).normalize(), 1.4, { big: 0.5 });
  }
  // shikoro: 3 flared rows around the back and sides
  for (let row = 0; row < 3; row++) {
    const y0 = 20 - row * 5.5, r0 = 17 + row * 4.5, r1 = r0 + 5.5, y1 = y0 - 7.5;
    plate('head', (u, v) => { const a = lerp(-2.25, 2.25, u) + Math.PI; const rr = lerp(r0, r1, v); return V3(Math.sin(a) * rr, lerp(y0, y1, v), Math.cos(a) * rr * 0.95 - 1); },
      7, 1, (p) => V3(p.x, 6, p.z + 1).normalize(), 1.2, { big: 0.3 });
  }
  // crescent maedate (Sumi): a thick bottom tapering into two horns sweeping up and out to points
  const CRES = { y: 58, r: 35, a: 1.5, w: 9, z: 19 };
  plate('head', (u, v) => {
    const s = u * 2 - 1, a = s * CRES.a, th = CRES.w * Math.pow(Math.max(0, 1 - s * s), 0.7);
    const rr = CRES.r - th * 0.15 + (v - 0.5) * th;
    return V3(Math.sin(a) * rr, CRES.y - Math.cos(a) * rr, CRES.z - Math.abs(s) * 7);
  }, 14, 1, V3(0, 0.1, 1).normalize(), 1.4, { jit: 0.1, big: 0.35, med: 0.35, split: 0.1 });
  shell('head', V3(0, CRES.y - CRES.r + 0.5, CRES.z - 1), V3(4, 3.5, 2.5), 6, 2, { big: 0, med: 0 });   // the crest mount
  // swept blade crests (Yuki): from the temples, back and up, keen points
  for (const s of [-1, 1]) {
    plate('head', (u, v) => {
      const w = 8 * Math.pow(1 - u, 0.85) * (0.45 + 0.55 * Math.min(1, u / 0.12));
      const cx = s * lerp(15, 42, Math.pow(u, 0.8)), cy = lerp(24, 72, u), cz = lerp(3, -52, u * 0.65 + u * u * 0.35);
      return V3(cx + s * (v - 0.5) * w * 0.3, cy + (v - 0.5) * w, cz + (v - 0.5) * w * 0.5);
    }, 7, 1, V3(s, 0.1, 0.25).normalize(), 1.1, { jit: 0.2, big: 0.3, med: 0.4 });
  }
  // ---- shoulders: heavy pauldron domes + broad sode (3 rows of big plates), upper arm
  for (const s of [-1, 1]) {
    const L = s < 0 ? 'L' : 'R', sh = 'shoulder' + L;
    shell(sh, V3(s * 3, 3, 0), V3(19, 16, 18), 8, 4, { big: 0.45, keel: 0.15 });
    for (let row = 0; row < 3; row++) {
      const y0 = 17 - row * 14, y1 = y0 - 22, out0 = 13 + row * 5.5, out1 = out0 + 10;
      plate(sh, (u, v) => V3(s * (lerp(out0, out1 + 4, v) + 7 * Math.sin(u * Math.PI)), lerp(y0, y1, v), lerp(-26, 26, u) * (1 - 0.1 * v)),
        4, 2, V3(s, 0.5, 0).normalize(), 2.2, { big: 0.55, med: 0.3, jit: 0.35 });
    }
    shell(sh, V3(0, -22, 0), V3(11, 23, 11), 7, 4, { big: 0.3 });
    // forearm + gauntlet + fist (small shards at the joints)
    shell('elbow' + L, V3(0, -2, 0.5), V3(10, 7, 10), 7, 2, { big: 0, med: 0.1, split: 0.6 });
    shell('elbow' + L, V3(0, -21, 1), V3(10.5, 21, 10.5), 7, 5, { taper: -0.25, big: 0.35 });
    shell('elbow' + L, V3(0, -33, 1), V3(13, 9, 13), 8, 2, { big: 0.2 });
    shell('wrist' + L, V3(0, -6, 1), V3(9, 10, 10), 7, 3, { big: 0, med: 0.2, split: 0.5 });
    // legs: big thigh plates, small knee, shin, foot
    shell('thigh' + L, V3(0, -22, 0), V3(14, 26, 15), 7, 4, { big: 0.6, med: 0.3 });
    shell('knee' + L, V3(0, 0, 2.5), V3(10.5, 8, 9.5), 7, 2, { big: 0, med: 0.1, split: 0.6 });
    shell('knee' + L, V3(0, -22, 0.5), V3(11, 24, 12), 7, 4, { taper: 0.3, big: 0.45, keel: 0.2 });
    shell('ankle' + L, V3(0, -2, 6), V3(10.5, 5, 18), 7, 2, { big: 0.2 });
  }
  // ---- kusazuri: 6 broad hanging plates
  for (let i = 0; i < 6; i++) {
    plate('kus' + i, (u, v) => V3(lerp(-11, 11, u) * (1 + v * 0.35), -v * 42, v * 15 + Math.sin(u * Math.PI) * 3), 2, 3, V3(0, 0.1, 1).normalize(), 1.6, { big: 0.45, med: 0.4 });
  }
  // ---- the shard great-sword: hilt, round tsuba, a long jagged 175 m blade (diamond section, saw-toothed edges)
  shell('sword', V3(0, 5, 0), V3(2.8, 12, 2.8), 5, 3, { big: 0, med: 0 });
  plate('sword', (u, v) => { const a = u * Math.PI * 2; const r = lerp(11, 3, v); return V3(Math.sin(a) * r, -6.5, Math.cos(a) * r); }, 9, 1, V3(0, 1, 0), 1.3, { jit: 0.2, big: 0, med: 0.4 });
  const BL = 175;
  const bladeW = (v, side) => {
    const base = lerp(13, 5, v), saw = (v * 7.5 + (side > 0 ? 0.37 : 0.81)) % 1;
    const tip = v > 0.88 ? Math.max(0, (1 - v) / 0.12) : 1;
    return base * (1 + 0.55 * saw * saw) * tip;
  };
  for (const side of [-1, 1]) for (const face of [-1, 1]) {
    gridSurface('sword', (u, v) => V3(side * u * bladeW(v, side), -9 - v * BL, face * (1 - u) * 2.4), 2, 22,
      { out: () => V3(side * 0.25, 0, face).normalize(), jit: 0.4, big: 0.3, med: 0.4, split: 0.35 });
  }

  // ------------------------------------------------------------------ buffers (fan around each shard's centroid)
  const nS = shards.length;
  let nV = 0, nI = 0;
  for (const s of shards) { s.v0 = nV; nV += s.pts.length + 1; nI += s.pts.length * 3; }
  const pos = new Float32Array(nV * 3), nrm = new Float32Array(nV * 3), aS = new Float32Array(nV * 4), aF = new Float32Array(nV * 4);
  const idx = new Uint32Array(nI);
  let ii = 0;
  for (const s of shards) {
    // planar frame for the glint strokes: t1 along the longest rim direction, t2 = n x t1
    const t1 = s.pts[0].clone().sub(s.c); t1.addScaledVector(s.n, -t1.dot(s.n)).normalize();
    const t2 = V3().crossVectors(s.n, t1);
    const m = s.pts.length;
    s.pts.forEach((p, k) => {
      const o = (s.v0 + k) * 4, d = p.clone().sub(s.c);
      aS[o] = s.seed; aS[o + 1] = d.dot(t1) / s.size; aS[o + 2] = d.dot(t2) / s.size; aS[o + 3] = 0;
      idx[ii++] = s.v0 + m; idx[ii++] = s.v0 + k; idx[ii++] = s.v0 + ((k + 1) % m);
    });
    const oc = (s.v0 + m) * 4; aS[oc] = s.seed; aS[oc + 1] = 0; aS[oc + 2] = 0; aS[oc + 3] = 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aS', new THREE.BufferAttribute(aS, 4));
  geo.setAttribute('aF', new THREE.BufferAttribute(aF, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.name = 'utsushi_shards';
  mirrorWrap.add(mesh);     // positions are written in root space (CPU skinning), so the mesh sits beside root

  // dark cores (show through the gaps): low-poly ellipsoids parented to the skeleton
  const coreGeo = new THREE.IcosahedronGeometry(1, 2);
  const coreMeshes = cores.map((c) => {
    const m = new THREE.Mesh(coreGeo, coreMat); m.position.copy(c.cen); m.scale.copy(c.r);
    if (c.vMin > 0.4) m.scale.y *= 0.6;
    N[c.part].add(m); return m;
  });
  const spine = new THREE.Mesh(new THREE.BoxGeometry(1.4, BL, 2.6), coreMat); spine.position.set(0, -9 - BL / 2 + 6, 0); N.sword.add(spine);
  coreMeshes.push(spine);

  // eyes: two white suns on a dark visor band under the brow
  const visor = new THREE.Mesh(new THREE.CylinderGeometry(12.9, 12.9, 5.6, 24, 1, true, -1.15, 2.3), A.celMaterial({ base: '#1a1730', flat: true, id: 28 }));
  visor.material.side = THREE.DoubleSide;
  visor.position.set(0, 15, 1.2); visor.scale.set(1, 1, 1.02); N.head.add(visor);
  const eyeMat = A.fxMaterial({ color: '#ffffff', intensity: 2.2, bloom: 3.2 });
  const rayMat = A.fxMaterial({ color: '#fff6e0', intensity: 1.8, bloom: 2.4 });
  const EYES = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(s * 5.6, 15, 14.0); N.head.add(g);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.7, 24), eyeMat); g.add(disc);
    const rayShape = new THREE.Shape(); rayShape.moveTo(-1, 0); rayShape.lineTo(0, 0.35); rayShape.lineTo(1, 0); rayShape.lineTo(0, -0.35); rayShape.closePath();
    const rg = new THREE.ShapeGeometry(rayShape);
    const h = new THREE.Mesh(rg, rayMat); h.scale.set(11, 2.2, 1); h.position.z = 0.2; g.add(h);
    const v = new THREE.Mesh(rg, rayMat); v.scale.set(6, 1.6, 1); v.rotation.z = Math.PI / 2; v.position.z = 0.2; g.add(v);
    N['eye' + (s < 0 ? 'L' : 'R')] = g; EYES.push(g);
  }
  // reflect mode: a soft dark aura behind the giant (multiplies the reflected sky) so the face separates from it
  const auraMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.MultiplyBlending, premultipliedAlpha: false, side: THREE.DoubleSide,
    uniforms: { uCol: { value: C('#261c4a') }, uAmt: { value: 0.7 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; uniform float uAmt; varying vec2 vUv;
      layout(location = 0) out vec4 oColor; layout(location = 1) out vec4 oData;
      void main(){
        vec2 p = (vUv - 0.5) * 2.0; float r = length(p);
        float k = (1.0 - smoothstep(0.25, 1.0, r)) * uAmt;
        k = floor(k * 5.0 + 0.5) / 5.0 * 0.6 + k * 0.4;            // gently banded, painted
        oColor = vec4(mix(vec3(1.0), uCol, k), 1.0); oData = vec4(1.0);
      }`,
  });
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), auraMat); aura.renderOrder = 50; aura.frustumCulled = false;
  aura.position.set(0, 140, -45); aura.scale.set(330, 400, 1); root.add(aura);
  N.swordTip = new THREE.Object3D(); N.swordTip.position.set(0, -9 - BL, 0); N.sword.add(N.swordTip);
  N.swordBase = new THREE.Object3D(); N.swordBase.position.set(0, -10, 0); N.sword.add(N.swordBase);
  N.crest = new THREE.Object3D(); N.crest.position.set(0, CRES.y - CRES.r + 4, CRES.z); N.head.add(N.crest);
  N.forearmL = new THREE.Object3D(); N.forearmL.position.set(0, -20, 0); N.elbowL.add(N.forearmL);
  N.forearmR = new THREE.Object3D(); N.forearmR.position.set(0, -20, 0); N.elbowR.add(N.forearmR);
  N.handL = N.wristL; N.handR = N.wristR; N.footL = N.ankleL; N.footR = N.ankleR;
  N.chestC = new THREE.Object3D(); N.chestC.position.set(0, 32, 23); N.chest.add(N.chestC);
  N.headC = new THREE.Object3D(); N.headC.position.set(0, 15, 6); N.head.add(N.headC);

  // rest positions in each part's local frame (already local), plus rest model-space centroids for cut tests
  root.updateMatrixWorld(true);
  const partInv = {};
  for (const s of shards) {
    if (!partInv[s.part]) partInv[s.part] = true;
    s.cm = s.c.clone().applyMatrix4(N[s.part].matrixWorld);       // model space at rest (root at origin)
    s.axis = V3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
    s.r1 = rng(); s.r2 = rng(); s.r3 = rng();
    for (let k = 0; k <= s.pts.length; k++) { const o = (s.v0 + k) * 4; aF[o + 1] = s.size; aF[o + 2] = Math.max(0, Math.min(1, s.cm.y / 205)); }
  }

  // ------------------------------------------------------------------ poses
  const POSES = {
    stand: { head: [0, 0, 0], chest: [0, 0, 0], armL: [0.12, 0, 0.12, -0.25], armR: [0.12, 0, -0.12, -0.25], wristR: [0, 0, 0], sword: null, reel: 0 },
    emerge: { head: [-0.25, 0, 0], chest: [-0.12, 0, 0], armL: [-0.5, 0, 0.75, -0.9], armR: [-0.5, 0, -0.75, -0.9], sword: null },
    push: { head: [0.1, 0, 0], chest: [0.15, 0, 0], armL: [-1.2, 0, 0.5, -0.5], armR: [-1.2, 0, -0.5, -0.5], sword: null },
    windup: { sword: 0.35 }, swing: { sword: 0.65 }, follow: { sword: 1 },
    reach: { head: [0.2, -0.15, 0], chest: [0.12, -0.2, 0], armR: [-1.35, 0.25, -0.05, -0.1], armL: [0.2, 0, 0.3, -0.4], wristR: [0, 0, 0], sword: null },
    reel: { reel: 1 },
    lie: { lie: 1 },
  };
  // right arm keys for the sword swing (shoulder xyz, elbow, wrist x, chest yaw)
  const SW = [
    [0.0, [0.35, 0, -0.1, -0.7], [-0.9, 0, 0], 0.0],
    [0.35, [-2.6, 0.3, -0.45, -0.9], [-0.4, 0, 0], -0.35],
    [0.65, [-1.3, 0.2, 0.55, -0.15], [-1.4, 0, 0.4], 0.25],
    [1.0, [-0.9, 0.1, 1.25, -0.2], [-1.5, 0, 0.6], 0.45],
  ];
  const lerpArr = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  function swordKeys(k) {
    k = Math.max(0, Math.min(1, k));
    for (let i = 0; i < SW.length - 1; i++) if (k <= SW[i + 1][0]) {
      const t = (k - SW[i][0]) / (SW[i + 1][0] - SW[i][0]);
      return { armR: lerpArr(SW[i][1], SW[i + 1][1], t), wristR: lerpArr(SW[i][2], SW[i + 1][2], t), yaw: SW[i][3] + (SW[i + 1][3] - SW[i][3]) * t };
    }
    const l = SW[SW.length - 1]; return { armR: l[1], wristR: l[2], yaw: l[3] };
  }
  const BASE = () => ({ rise: 1, x: 0, z: -90, yaw: 0, ...JSON.parse(JSON.stringify(POSES.stand)) });
  const S = { visible: false, reflect: false, pose: BASE(), eyes: 1, crack: 0, x: 0, shatter: 0, aura: 0.75, haze: 0.42, dirty: true };
  let lieSet = false;

  function applyPose() {
    const p = S.pose;
    let armR = p.armR, wristR = p.wristR ?? [0, 0, 0], yawC = 0;
    if (p.sword !== null && p.sword !== undefined) { const k = swordKeys(p.sword); armR = k.armR; wristR = k.wristR; yawC = k.yaw; }
    const reel = p.reel ?? 0;
    N.head.rotation.set(p.head[0] - reel * 0.45, p.head[1], p.head[2] + reel * 0.12);
    N.chest.rotation.set(p.chest[0] - reel * 0.22, p.chest[1] + yawC, p.chest[2] + reel * 0.05);
    N.neck.rotation.set(-reel * 0.15, 0, 0);
    const arm = (L, a) => { N['shoulder' + L].rotation.set(a[0], a[1], a[2]); N['elbow' + L].rotation.set(a[3], 0, 0); };
    arm('L', reel ? lerpArr(p.armL, [-0.6, 0, 1.0, -0.9], reel * 0.6) : p.armL); arm('R', armR);
    N.wristR.rotation.set(wristR[0], wristR[1], wristR[2]);
    // legs: slight stance, kusazuri follow the hips on twos
    for (const L of ['L', 'R']) { N['thigh' + L].rotation.set(-0.05, 0, (L === 'L' ? -1 : 1) * 0.06); N['knee' + L].rotation.set(0.08, 0, 0); N['ankle' + L].rotation.set(-0.03, 0, 0); }
    KUS.forEach((k, i) => { k.rotation.x = 0.06 + (p.kusSwing ?? 0) * Math.sin(i * 1.7); });
    // placement
    const rise = p.rise ?? 1;
    if (!S.reflect) {
      root.rotation.set(0, p.yaw, 0); root.scale.setScalar(p.scale ?? 1);
      root.position.set(p.x, -212 * (1 - rise), p.z);
      mirrorWrap.scale.set(1, 1, 1);
    } else {
      // virtual giant under the mirror; geometry is its mirror image above y = 0 (layer 2 only)
      const lie = p.lie ?? 1;
      root.scale.setScalar(p.scale ?? 1.35);
      const depth = Math.max(14 + 520 * (1 - rise), 34 * (p.scale ?? 1.35));   // the chest + crest never break the surface
      root.rotation.set(-Math.PI / 2 * lie, p.yaw, 0, 'YXZ');
      // place so the face (headC) sits under (x, z) at -depth (in the un-mirrored local space of mirrorWrap)
      mirrorWrap.scale.set(1, -1, 1);
      root.position.set(0, 0, 0); holder.updateMatrixWorld(true);
      const hc = mirrorWrap.worldToLocal(N.headC.getWorldPosition(V3()));
      root.position.set(p.x - hc.x, -depth - hc.y, p.z - hc.z);
    }
  }

  // ------------------------------------------------------------------ CPU skinning + per-shard effects
  const M = new THREE.Matrix4(), NM = new THREE.Matrix3(), Q = new THREE.Quaternion(), cw = V3(), off = V3(), pv = V3(), nv = V3();
  const rootInv = new THREE.Matrix4();
  const X_C = V3(0, 150, 24), XN1 = V3(0.62, -0.78, 0).normalize(), XN2 = V3(0.62, 0.78, 0).normalize();
  const F1 = { c: V3(-2, 188, 16), n: V3(0.42, 0.9, 0).normalize() }, F2 = { c: V3(3, 184, 16), n: V3(-0.55, 0.83, 0).normalize() };
  function commit() {
    if (!S.dirty) return;
    S.dirty = false;
    applyPose();
    holder.updateMatrixWorld(true);
    rootInv.copy(mirrorWrap.matrixWorld).invert();
    const sh = S.shatter, xk = S.x, ck = S.crack;
    for (let i = 0; i < nS; i++) {
      const s = shards[i];
      M.copy(N[s.part].matrixWorld).premultiply(rootInv);   // part -> mirrorWrap space
      NM.setFromMatrix4(M);
      cw.copy(s.c).applyMatrix4(M);
      let glow = 0, spin = 0, scl = 1; off.set(0, 0, 0);
      // X cut: light runs along both lines from the crossing outwards (k 0-.25), pieces part after .55
      if (xk > 0) {
        const r = tmp.copy(s.cm).sub(X_C);
        for (const n of [XN1, XN2]) {
          const d = Math.abs(r.dot(n)); const along = Math.sqrt(Math.max(r.lengthSq() - d * d, 0));
          const reach = Math.min(xk / 0.25, 1) * 150;
          if (d < 4.5 && along < reach && s.cm.z > -10) glow = Math.max(glow, 0.55 + 0.4 * (1 - d / 4.5));
        }
        if (xk > 0.55) {   // four pieces part along the cuts
          const q = (xk - 0.55) / 0.45, a = Math.sign(r.dot(XN1)), b = Math.sign(r.dot(XN2));
          off.addScaledVector(XN1, a * q * 7).addScaledVector(XN2, b * q * 7);
        }
      }
      if (ck > 0) {
        const lines = [[F1, Math.min(ck / 0.5, 1)], [F2, Math.max(0, Math.min((ck - 0.5) / 0.5, 1))]];
        for (const [F, k] of lines) {
          if (k <= 0) continue;
          const r = tmp.copy(s.cm).sub(F.c), d = r.dot(F.n);
          const along = r.x * F.n.y - r.y * F.n.x;   // signed distance along the line (in the face plane)
          if (s.part === 'head' && Math.abs(d) < 3.6 && along < -22 + k * 48) {
            glow = Math.max(glow, 0.95 - Math.abs(d) / 3.6 * 0.4);
            off.addScaledVector(F.n, Math.sign(d) * 1.2 * k);
          }
        }
      }
      if (sh > 0) {
        const dir = tmp.copy(s.cm).sub(V3(0, 130, 0)); dir.y *= 0.6; dir.normalize();
        const k = Math.max(0, (sh - s.r1 * 0.25) / (1 - s.r1 * 0.25));
        const e = 1 - Math.pow(1 - k, 2.2);
        off.addScaledVector(dir, e * (60 + 160 * s.r2)).add(tmp2.set(0, -k * k * (60 + 90 * s.r3) + e * 20 * s.r2, 0));
        spin = k * (2 + 7 * s.r3);
        scl = 1 - Math.max(0, Math.min(1, (k - 0.45 - s.r2 * 0.3) / 0.35));
        glow = Math.max(glow, Math.max(0, 1 - k * 3) * 0.9);
      }
      if (S.reflect) off.y = off.y;   // offsets are in giant space; mirrored with the wrap
      // to giant (mirrorWrap) space: offsets were computed in rest-model space, rotate them by the root
      if (off.lengthSq() > 0) off.applyQuaternion(root.quaternion);
      if (spin) Q.setFromAxisAngle(s.axis, spin);
      for (let k = 0; k < s.pts.length; k++) {
        const vi = s.v0 + k;
        pv.copy(s.pts[k]).applyMatrix4(M);
        nv.copy(s.n).applyMatrix3(NM).normalize();
        if (spin || scl !== 1) { pv.sub(cw); if (spin) { pv.applyQuaternion(Q); nv.applyQuaternion(Q); } pv.multiplyScalar(scl).add(cw); }
        pv.add(off);
        pos[vi * 3] = pv.x; pos[vi * 3 + 1] = pv.y; pos[vi * 3 + 2] = pv.z;
        nrm[vi * 3] = nv.x; nrm[vi * 3 + 1] = nv.y; nrm[vi * 3 + 2] = nv.z;
        aF[vi * 4] = glow;
      }
      const vc = s.v0 + s.pts.length;   // the fan centre
      pv.copy(cw).add(off); nv.copy(s.n).applyMatrix3(NM).normalize(); if (spin) nv.applyQuaternion(Q);
      pos[vc * 3] = pv.x; pos[vc * 3 + 1] = pv.y; pos[vc * 3 + 2] = pv.z;
      nrm[vc * 3] = nv.x; nrm[vc * 3 + 1] = nv.y; nrm[vc * 3 + 2] = nv.z; aF[vc * 4] = glow;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true; geo.attributes.aF.needsUpdate = true;
    // cores and eyes vanish as the shards fly
    const cv = S.shatter < 0.08;
    coreMeshes.forEach((m) => { m.visible = cv; });
    visor.visible = cv;
    const ek = S.shatter > 0 ? Math.max(0, 1 - S.shatter * 6) * S.eyes : S.eyes;
    EYES.forEach((g) => { g.visible = ek > 0.01; g.scale.set(Math.min(1, 0.6 + ek * 0.4), Math.min(ek, 1.2), 1); });
    const R = S.reflect;
    eyeMat.uniforms.uInt.value = (R ? 3.2 : 1.6) + Math.max(0, ek - 1) * 1.5; eyeMat.uniforms.uEmisAmt.value = R ? 5 : 3.2;
    rayMat.uniforms.uInt.value = R ? 2.6 : 1.8; rayMat.uniforms.uEmisAmt.value = R ? 4 : 2.4;
    holder.visible = S.visible;
    aura.visible = R && cv && S.aura > 0; auraMat.uniforms.uAmt.value = S.aura;
    const U = mat.uniforms;
    U.uEdge.value = R ? 2.4 : 1.0; U.uHaze.value = R ? 0 : S.haze; U.uGain.value = R ? 1.05 : 1.0; U.uGlint.value = 1; U.uSat.value = R ? 1.45 : 1.08;
  }

  // layers: 2 = reflection only, 0 = everywhere
  function setLayer(l) { holder.traverse((o) => o.layers.set(l)); }
  setLayer(0);
  const prevBR = ctx.scene.onBeforeRender;
  ctx.scene.onBeforeRender = function (...a) { commit(); if (prevBR) prevBR.apply(this, a); };

  const api = {
    root, nodes: N, mesh, POSES, auto: true,
    show(b) { S.visible = !!b; holder.visible = !!b; S.dirty = true; },
    pose(p) {
      if (typeof p === 'string') p = POSES[p] ?? {};
      for (const k in p) S.pose[k] = Array.isArray(p[k]) ? p[k].slice() : p[k];
      S.dirty = true;
    },
    resetPose() { S.pose = BASE(); S.dirty = true; },
    reflectOnly(b) {
      b = !!b; if (b !== S.reflect) { S.reflect = b; setLayer(b ? LAYER.REFLECT_ONLY : 0); }
      if (b && !lieSet) S.pose.lie = S.pose.lie ?? 1;
      S.dirty = true;
    },
    eyes(k) { S.eyes = k; S.dirty = true; },
    aura(k) { S.aura = k; S.dirty = true; },     // reflect mode: soft dark aura behind it (0 off .. 1 strong, default .75)
    haze(k) { S.haze = k; S.dirty = true; },     // real mode: warm haze over the upper body (default .42)
    crackFace(k) { S.crack = k; S.dirty = true; },
    xCut(k) { S.x = k; S.dirty = true; },
    shatter(k) { S.shatter = k; S.dirty = true; },
    anchor(name, out = V3()) { commit(); const n = N[name] ?? N.head; holder.updateMatrixWorld(true); return n.getWorldPosition(out); },
    sun(dir) { mat.uniforms.uGSun.value.copy(dir).normalize(); },
    get state() { return S; },
    shardMaterial, // FX reuses the mirror look for falling glass
    commit,
  };
  ctx.api.giant = api;

  // ------------------------------------------------------------------ auto choreography (film timing, on twos)
  const cue = (n, d) => ctx.CUES?.[n] ?? d;
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function auto(st) {
    const t = A.onTwos(st.t);
    S.pose = BASE(); S.crack = 0; S.x = 0; S.shatter = 0; S.eyes = 1; S.aura = 0.75; S.haze = 0.42;
    const tEyes = cue('eyesOpen', 39.9), tEm = cue('emerge', 52.3), tSw = cue('swing', 56.2), tFc = cue('faceCut', 62.9);
    const tX = cue('cross', 68.4), tSh = cue('shatter', 73.0);
    let vis = false, refl = false;
    if (t >= 38.5 && t < 52.0) {                    // in the mirror: face up under the lake, rising
      vis = true; refl = true;
      S.pose.lie = 1; S.pose.x = 0; S.pose.z = -70;
      S.pose.rise = 0.55 + 0.31 * sm(38.5, 41, t) + 0.11 * sm(43.0, 45.0, t);
      S.pose.scale = 1.35 + 0.55 * sm(43.0, 45.0, t);   // s21: rising, it fills the lake
      S.eyes = sm(tEyes, tEyes + 0.35, t);
      S.pose.head = [0, 0, 0];
    } else if (t >= 52.0 && t < 76.0) {
      vis = true;
      const rise = 0.18 + 0.82 * sm(tEm - 0.3, tEm + 2.4, t);
      Object.assign(S.pose, { rise, x: 0, z: -90, yaw: 0 });
      if (t < tSw - 0.7) {
        const k = sm(tEm, tEm + 2.6, t);
        api.pose(k < 0.5 ? 'push' : 'emerge'); S.pose.rise = rise;
        S.pose.head = [lerp(0.15, -0.2, k), 0, 0];
      } else if (t < 58.0) {
        S.pose.sword = t < tSw ? 0.35 * sm(tSw - 0.7, tSw - 0.15, t) : 0.35 + 0.65 * sm(tSw, tSw + 0.5, t);
      } else if (t < tFc) {
        api.pose('reach'); S.pose.rise = 1;
      } else if (t < 66.0) {
        api.pose('reach');
        S.crack = sm(tFc, tFc + 0.5, t); S.pose.reel = sm(tFc + 0.1, tFc + 0.6, t) * (1 - 0.4 * sm(64.5, 66, t));
      } else {
        api.pose('stand'); S.pose.armR = [-0.3, 0, -0.4, -0.6]; S.pose.armL = [-0.3, 0, 0.4, -0.6];
        S.pose.head = [-0.15, 0, 0]; S.crack = 1;
        S.x = t >= tX ? Math.min(1, 0.25 * sm(tX, tX + 0.25, t) / 0.25 * 1 + 0.75 * sm(tX + 1.1, tSh, t)) : 0;
        if (t >= tX) S.pose.reel = 0.25 * sm(tX, tX + 0.4, t);
        S.shatter = t >= tSh ? sm(tSh, tSh + 2.8, t) : 0;
      }
    }
    if (refl !== S.reflect) { S.reflect = refl; setLayer(refl ? LAYER.REFLECT_ONLY : 0); }
    S.visible = vis; S.dirty = true;
  }

  function testView(q) {
    S.visible = true;
    const refl = q.get('greflect') === '1';
    if (refl !== S.reflect) { S.reflect = refl; setLayer(refl ? LAYER.REFLECT_ONLY : 0); }
    S.aura = 0.75; S.haze = 0.42;
    S.pose = BASE(); S.pose.z = +(q.get('gz') ?? 0); S.pose.x = +(q.get('gx0') ?? 0);
    if (q.get('gyaw')) S.pose.yaw = +q.get('gyaw');
    if (q.get('gpose')) for (const n of q.get('gpose').split(',')) api.pose(n);
    if (q.get('grise')) S.pose.rise = +q.get('grise');
    if (q.get('glie')) S.pose.lie = +q.get('glie');
    if (q.get('gsword')) S.pose.sword = +q.get('gsword');
    if (q.get('greel')) S.pose.reel = +q.get('greel');
    if (q.get('gscale')) S.pose.scale = +q.get('gscale');
    if (q.get('gaura')) S.aura = +q.get('gaura');
    if (q.get('ghaze')) S.haze = +q.get('ghaze');
    S.eyes = +(q.get('geyes') ?? 1); S.crack = +(q.get('gcrack') ?? 0); S.x = +(q.get('gx') ?? 0); S.shatter = +(q.get('gshatter') ?? 0);
    S.dirty = true;
  }

  return {
    update(st) {
      const q = st.q;
      if (q && q.get('test') === '1' && q.get('gauto') !== '1') {
        if (q.get('giant') === '1') testView(q); else { S.visible = false; S.dirty = true; }
        return;
      }
      if (api.auto) auto(st); else S.dirty = true;
    },
  };
}
