// fx.js - dept FX: every drawn effect of KAGAMI (rain, snow, breath, drop, rings, splashes, water sheets, slashes, X-cut,
// sparks, aura flames, embers, glass + water pouring off the giant, shard snow, sparkles, omen glints, speed / impact looks).
// Full signatures: src/fx/README.md. Materials: src/fx_mats.js. The giant: src/giant.js.
//
// HOW IT WORKS: immediate mode. Every frame fx.update(st) clears all requests and (if fx.auto) adds the film's default FX
// from CUES; then any department (direction runs last) may call the API for that frame. Requests are evaluated just before
// the frame renders (scene.onBeforeRender), so anchors read there (ronin blades, feet, the giant) are final for the frame.
// Everything is a pure function of st.t; effects are drawn ON THREES (new drawing every 1/8 s, A.onThrees).
//
// ctx.api.fx = {
//   rain(set, amount = 1, o?)                 o: {box (half size m), len (streak m), dir [x,y,z], splashes 0..1, tint}
//   snow(amount = 1, o?)                      o: {box, size (flake m), wind [x, z]}
//   breath(at, t0, o?)                        vapour puff from a point (Vector3 | () => Vector3), o: {dir, size, life}
//   puff(at, t0, o?)                          generic drawn cloud puff (steam / snow burst / mist), o: {dir, size, life, n, spread, kind:'snow'|'vapour'|'spray'}
//   drop(from, t0, t1, o?)                    the falling raindrop: from (V3 | fn) at t0, hits y = 0 at t1; ring + crown at t1
//   ring(at, t0, o?)                          drawn ring on the water, o: {speed m/s, life, width}
//   splash(at, t0, size = 1, o?)              crown splash + droplets + ring, o: {tint: '#ff4fa3', kind:'water'|'snow'}
//   kick(at, t0, dir, size = 1)               running-foot water sheet (bow-wave fan) + droplets
//   wall(path, t0, o?)                        wall of glass + spray along a path [V3...] (the sword carving the lake), o: {height, life}
//   slash(kind, from, to, t0, o?)             drawn slash arc. kind 'arc' (bulges toward o.bulge or up) | 'line';
//                                             o: {color, outer, width, life, bulge (V3 offset at the middle), seed}
//   xcut(k, o?)                               the X: o: {centre (default giant chest), size, extend 0..1, normal}
//   sparks(at, t0, o?)                        spark burst, o: {dir, n, speed, life, spread}
//   aura(on, k = 1, o?)                       red-gold flame tongues along Sumi's blade (or o.from/o.to)
//   embers(k, o?)                             embers rising from Sumi's scarf (or o.from/o.to)
//   pour(k, o?)                               glass + water pouring off the giant (thin strand curtains breaking into drips from
//                                             shoulders/arms/sword + falling glass), o: {anchors, width, n, outward (m, push clear of the body), spray (base puff scale)}
//   shardSnow(k, o?)                          glittering shard snow over the lake, o: {centre, radius, height}
//   sparkles(at, t0, o?)                      sheathe sparkles burst, o: {n, radius, life}
//   glint(at, t0, o?)                         one bright 4-point glint (steel flash, omen eyes), o: {size, life, layer: 2 for reflection-only}
//   speedLines(k, o?)                         sets st.look.speed for this frame, o: {centre [u,v], mode 'radial'|'parallel', dir, color}
//   kaleido(k, o?) / kaleidoCam(lt, dur, o?)  s31 floating shards showing Sumi live from 4 angles / the camera gliding through them
//   impact(kind)                              sets st.look.impact this frame (1 inverted ink, 2 white flash)
//   auto: true                                film defaults from CUES (see AUTO below); fx.mute('rain') disables one default
// }
// Test views (q): fxdemo=<name> shows one effect at the origin with the test camera (rain snow breath drop ring splash kick
//   wall slash xcut sparks aura embers pour shards sparkles glint), fxt=<s since start>.
import { fxMats } from './fx_mats.js';
import { makeKaleido } from './fx_kaleido.js';

export async function create(ctx) {
  const { THREE, A, scene } = ctx;
  const M = fxMats(THREE, A);
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const C = (h) => new THREE.Color(h);
  const root = new THREE.Group(); root.name = 'FX'; scene.add(root);
  const KAL = makeKaleido(ctx, root);
  const T3 = (t) => A.onThrees(t);
  const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const toV = (p) => (typeof p === 'function' ? p() : p?.isVector3 ? p : Array.isArray(p) ? V3(...p) : V3());
  // drawing index since t0 at `rate` drawings per second (8 = on threes): age is quantised to drawings
  const ageQ = (t, t0, rate = 8) => Math.floor((t - t0) * rate + 1e-6) / rate;

  // ------------------------------------------------------------------ instanced pools
  function pool(name, mat, max, mode, layer = 0) {
    const g = new THREE.PlaneGeometry(1, 1);
    if (mode === 'STREAK' || mode === 'UPRIGHT') g.translate(0, 0.5, 0);
    const iA = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); iA.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iA', iA);
    const m = new THREE.InstancedMesh(g, mat, max); m.frustumCulled = false; m.count = 0; m.name = 'fx_' + name;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.layers.set(layer); root.add(m);
    const P = { mesh: m, n: 0, max, iA: iA.array, im: m.instanceMatrix.array, mat,
      // add(pos, sx, sy, a[4], axis?) - BILL/UPRIGHT: scale sx, sy; STREAK: axis = full length vector, sx width
      add(p, sx, sy, a0 = 0, a1 = 0, a2 = 0, a3 = 0, ax = null) {
        if (P.n >= max) return; const i = P.n++, o = i * 16, e = P.im;
        if (ax) { e[o] = sx; e[o + 1] = 0; e[o + 2] = 0; e[o + 4] = ax.x; e[o + 5] = ax.y; e[o + 6] = ax.z; }
        else { e[o] = sx; e[o + 1] = 0; e[o + 2] = 0; e[o + 4] = 0; e[o + 5] = sy; e[o + 6] = 0; }
        e[o + 3] = 0; e[o + 7] = 0; e[o + 8] = 0; e[o + 9] = 0; e[o + 10] = 1; e[o + 11] = 0;
        e[o + 12] = p.x; e[o + 13] = p.y; e[o + 14] = p.z; e[o + 15] = 1;
        const q = i * 4; P.iA[q] = a0; P.iA[q + 1] = a1; P.iA[q + 2] = a2; P.iA[q + 3] = a3;
      },
      // flat on the ground (MESHI ring): radius r
      addFlat(p, r, a0 = 0, a1 = 0, a2 = 0) {
        if (P.n >= max) return; const i = P.n++, o = i * 16, e = P.im;
        e.set([r, 0, 0, 0, 0, 0, -r, 0, 0, 1, 0, 0, p.x, p.y, p.z, 1], o);
        const q = i * 4; P.iA[q] = a0; P.iA[q + 1] = a1; P.iA[q + 2] = a2; P.iA[q + 3] = 0;
      },
      flush() { m.count = P.n; m.visible = P.n > 0; m.instanceMatrix.needsUpdate = true; iA.needsUpdate = true; },
    };
    return P;
  }
  const P = {
    rain: pool('rain', M.rain(), 6000, 'STREAK'),
    spark: pool('spark', M.spark(), 1500, 'STREAK'),
    flake: pool('flake', M.flake(), 5000, 'BILL'),
    puff: pool('puff', M.puff(), 400, 'BILL'),
    puffW: pool('puffW', M.puff('#f4fbff', '#9fc6ee', '#6f96cc'), 400, 'BILL'),
    mist: pool('mist', M.puff('#ffffff', '#e6eefa', '#dfe8f8', 0.3), 300, 'BILL'),
    crown: pool('crown', M.crown(), 400, 'UPRIGHT'),
    ring: pool('ring', M.ring(), 200, 'MESHI'),
    star: pool('star', M.star(), 1500, 'BILL'),
    star2: pool('star2', M.star(), 40, 'BILL', 2),        // reflection-only glints (omen)
    flame: pool('flame', M.flame(), 120, 'BILL'),
    ember: pool('ember', M.ember(), 800, 'BILL'),
    drop: pool('drop', M.drop(), 60, 'BILL'),
    dot: pool('dot', M.dot(), 2500, 'BILL'),
  };
  { const g = new THREE.PlaneGeometry(2, 2); const a = new THREE.InstancedBufferAttribute(P.ring.iA, 4); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute('iA', a); P.ring.mesh.geometry = g; P.ring.flush = function () { this.mesh.count = this.n; this.mesh.visible = this.n > 0; this.mesh.instanceMatrix.needsUpdate = true; a.needsUpdate = true; }; }
  P.flame.mat.uniforms.uFid.value = 93; P.star.mat.uniforms.uFid.value = 94; P.ember.mat.uniforms.uFid.value = 93; P.dot.mat.uniforms.uFid.value = 94;

  // glass shards: instanced triangles with the giant's mirror material (if the giant exists) - falling glass + shard snow
  let glass = null;
  function makeGlass() {
    const gm = ctx.api.giant?.shardMaterial ? ctx.api.giant.shardMaterial() : A.fxMaterial({ color: '#ffe2b0' });
    // one irregular shard: fan of 4 around its centre (aS = seed, pu, pv, e; aF = glow, size, height) like the giant's
    const R4 = [[-0.5, -0.4], [0.6, -0.25], [0.15, 0.62], [-0.35, 0.3]], P = [0, 0, 0], NN = [0, 0, 1], S4 = [0.5, 0, 0, 1], F4 = [0, 12, 0.7, 0];
    const pa = [...P], na = [...NN], sa = [...S4], fa = [...F4];
    for (const [x, y] of R4) { pa.push(x, y, 0); na.push(...NN); sa.push(0.5, x * 1.4, y * 1.4, 0); fa.push(...F4); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pa), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(na), 3));
    g.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(sa), 4));
    g.setAttribute('aF', new THREE.BufferAttribute(new Float32Array(fa), 4));
    g.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1]);
    const max = 9000;
    const m = new THREE.InstancedMesh(g, gm, max); m.frustumCulled = false; m.count = 0; m.name = 'fx_glass';
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(m);
    const q = new THREE.Quaternion(), e = new THREE.Euler(), s = V3(), mm = new THREE.Matrix4();
    glass = { mesh: m, n: 0, max,
      add(p, size, rx, ry, rz) { if (glass.n >= max) return; e.set(rx, ry, rz); q.setFromEuler(e); mm.compose(p, q, s.set(size, size, size)); m.setMatrixAt(glass.n++, mm); },
      flush() { m.count = glass.n; m.visible = glass.n > 0; m.instanceMatrix.needsUpdate = true; } };
    if (gm.uniforms?.uGSun && ctx.api.lands?.sunDir?.LAKE) gm.uniforms.uGSun.value.copy(ctx.api.lands.sunDir.LAKE).normalize();
    if (gm.uniforms?.uEdge) { gm.uniforms.uEdge.value = 0.8; gm.uniforms.uHaze.value = 0; gm.uniforms.uBlaze.value = 1.3; }
  }

  // ------------------------------------------------------------------ ribbons (slash arcs, X-cut, curtains)
  const SEG = 48;
  function ribbonMesh(mat) {
    const g = new THREE.BufferGeometry();
    const n = (SEG + 1) * 2;
    const pos = new Float32Array(n * 3), aD = new Float32Array(n * 4), aE = new Float32Array(n * 4), uv = new Float32Array(n * 2), idx = [];
    for (let i = 0; i <= SEG; i++) { uv.set([i / SEG, 0, i / SEG, 1], i * 4); if (i < SEG) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aD', new THREE.BufferAttribute(aD, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aE', new THREE.BufferAttribute(aE, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.visible = false; root.add(m);
    return m;
  }
  const ribbons = { slash: [], crack: [], curtain: [] };
  const ribbonMat = { slash: () => M.ribbon(0), crack: () => M.ribbon(1, '#a8e8ff', '#5a8ad8'), curtain: () => M.ribbon(3, '#9cc6ee', '#ffffff') };
  const used = { slash: 0, crack: 0, curtain: 0 };
  // draw a ribbon: pts [V3] (centre line), width(u) -> m, side (V3 | null = face camera), uniforms {k: v}
  function drawRibbon(kind, pts, width, side, uni) {
    const list = ribbons[kind];
    if (used[kind] >= list.length) { if (list.length >= 24) return; list.push(ribbonMesh(ribbonMat[kind]())); }
    const m = list[used[kind]++]; m.visible = true;
    const g = m.geometry, pos = g.attributes.position.array, aD = g.attributes.aD.array, aE = g.attributes.aE.array;
    const n = pts.length - 1, tg = V3();
    for (let i = 0; i <= SEG; i++) {
      const f = i / SEG * n, k = Math.min(Math.floor(f), n - 1), r = f - k;
      const p = pts[k].clone().lerp(pts[k + 1], r);
      tg.subVectors(pts[k + 1], pts[k]).normalize();
      const w = width(i / SEG);
      for (let s = 0; s < 2; s++) {
        const v = i * 2 + s;
        pos.set([p.x, p.y, p.z], v * 3); aD.set([tg.x, tg.y, tg.z, w], v * 4);
        aE.set(side ? [side.x, side.y, side.z, 0] : [0, 0, 0, 0], v * 4);
      }
    }
    g.attributes.position.needsUpdate = g.attributes.aD.needsUpdate = g.attributes.aE.needsUpdate = true;
    for (const k in uni) m.material.uniforms[k].value = uni[k];
    return m;
  }
  // arc points from a to b bulging by `bulge` at the middle (quadratic), n points
  function arcPts(a, b, bulge, n = 24) {
    const c = a.clone().add(b).multiplyScalar(0.5).add(bulge), out = [];
    for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push(V3(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y, u * u * a.z + 2 * u * t * c.z + t * t * b.z)); }
    return out;
  }

  // water sheets (kick fans, walls): grid meshes with CPU positions
  const SHEET_KINDS = { sheet: () => M.sheet(), crown: () => M.crownSheet(), wall: () => M.wallSheet() };
  const sheetPools = { sheet: [], crown: [], wall: [] }, sheetUsed = { sheet: 0, crown: 0, wall: 0 };
  function sheetMesh(kind) {
    const nu = kind === 'wall' ? 40 : kind === 'crown' ? 24 : 16, nv = kind === 'wall' ? 8 : 6, g = new THREE.PlaneGeometry(1, 1, nu, nv);
    g.attributes.position.setUsage(THREE.DynamicDrawUsage);
    const m = new THREE.Mesh(g, SHEET_KINDS[kind]()); m.frustumCulled = false; m.visible = false; m.userData.nu = nu; m.userData.nv = nv; root.add(m); return m;
  }
  // f(u, v) -> V3 surface point (u along 0..1, v root 0 .. lip 1); kind 'sheet' | 'crown' | 'wall'; uni: extra uniforms
  function drawSheet(f, age, seed, kind = 'sheet', uni = null, order = 0) {
    const list = sheetPools[kind];
    if (sheetUsed[kind] >= list.length) { if (list.length >= 40) return; list.push(sheetMesh(kind)); }
    const m = list[sheetUsed[kind]++]; m.visible = true; m.renderOrder = order;
    if (uni) for (const k in uni) m.material.uniforms[k].value = uni[k];
    const g = m.geometry, pos = g.attributes.position.array, uv = g.attributes.uv.array, { nu, nv } = m.userData;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const k = j * (nu + 1) + i, u = i / nu, v = 1 - j / nv;   // PlaneGeometry rows go top -> bottom
      const p = f(u, v); pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
      uv[k * 2] = u; uv[k * 2 + 1] = v;
    }
    g.attributes.position.needsUpdate = true; g.attributes.uv.needsUpdate = true; g.computeVertexNormals();
    m.material.uniforms.uAge.value = age; m.material.uniforms.uSeed.value = seed;
  }

  // ------------------------------------------------------------------ anchors
  const ronin = (who) => ctx.api.ronin?.[who];
  function anchor(who, name, fb) {
    const r = ronin(who); if (!r?.anchor) return fb ? fb.clone() : null;
    try { const v = V3(); const res = r.anchor(name, v); return res?.isVector3 ? res.clone() : v; } catch (e) { return fb ? fb.clone() : null; }
  }
  const gAnchor = (name) => { try { return ctx.api.giant?.anchor(name, V3()); } catch (e) { return null; } };

  // ------------------------------------------------------------------ request state
  const R = { st: null, t: 0, reqs: [], muted: new Set(), auto: true, flushed: -1, looks: {} };
  const req = (fn) => { R.reqs.push(fn); };
  const cam = () => ctx.camera;

  // ---- effects (each adds a request evaluated at render time) ---------------------------------------------------------
  function rain(set, amount = 1, o = {}) {
    if (amount <= 0) { R.rainOff = true; return; }
    req(() => {
      const t = R.t, k = Math.floor(t * 8 + 1e-6), c = cam().position;
      const fwd = cam().getWorldDirection(V3());
      const box = o.box ?? Math.max(10, Math.min(70, c.y * 3 + 8)), len = o.len ?? box * 0.09;
      const dir = V3(...(o.dir ?? [0.14, -1, 0.06])).normalize().multiplyScalar(len);
      const n = Math.floor((o.n ?? 2600) * amount);
      const ctr = c.clone().addScaledVector(fwd, box * 0.6);
      for (let i = 0; i < n; i++) {
        const h1 = hash(i, k), h2 = hash(i + 0.5, k + 3.1), h3 = hash(i + 0.25, k + 7.7), h4 = hash(i, k + 11.3);
        const p = V3(ctr.x + (h1 - 0.5) * 2 * box, Math.max(0, ctr.y - box * 0.5) + h2 * box * 1.4, ctr.z + (h3 - 0.5) * 2 * box);
        P.rain.add(p, box * 0.0016 * (0.7 + h4 * 0.6), 0, h4, h4 * h4, 0, 0, dir.clone().multiplyScalar(0.6 + h4 * 0.8));
      }
      // splash crowns + rings on the street (each lives one drawing)
      const ns = Math.floor((o.splashes ?? 1) * amount * 70);
      for (let i = 0; i < ns; i++) {
        const h1 = hash(i + 91, k), h2 = hash(i + 37, k + 5), h3 = hash(i + 13, k + 9);
        const p = V3(ctr.x + (h1 - 0.5) * 1.6 * box, 0.02, ctr.z + (h2 - 0.5) * 1.6 * box);
        const s = box * (o.crown ?? 0.0055) * (0.6 + h3);
        P.crown.add(p, s * 1.5, s * 1.3, h3 * 0.6, h1, o.tint ? 0.5 : 0);
        P.ring.addFlat(p.clone().setY(0.03), s * 1.6, 0.2 + h3 * 0.5, h2, 0.35);
      }
    });
  }
  function snow(amount = 1, o = {}) {
    if (amount <= 0) { R.snowOff = true; return; }
    req(() => {
      const t = T3(R.t), c = cam().position, fwd = cam().getWorldDirection(V3());
      const box = o.box ?? Math.max(6, Math.min(60, c.y * 2.5 + 8));
      const size = o.size ?? box * 0.006;
      const wind = o.wind ?? [1.2, 0.3];
      const ctr = c.clone().addScaledVector(fwd, box * 0.55);
      const n = Math.floor((o.n ?? 2200) * amount);
      const B = box * 2;
      for (let i = 0; i < n; i++) {
        const h1 = hash(i, 1), h2 = hash(i, 2), h3 = hash(i, 3), h4 = hash(i, 4);
        const fall = box * 0.05 * (0.6 + h4);
        let x = h1 * B + (wind[0] * t + Math.sin(t * 1.3 + i) * 0.6) * box * 0.02, y = h2 * B - fall * t, z = h3 * B + wind[1] * t * box * 0.02;
        x = ((x - ctr.x + box) % B + B) % B - box + ctr.x; y = ((y - ctr.y + box) % B + B) % B - box + ctr.y; z = ((z - ctr.z + box) % B + B) % B - box + ctr.z;
        if (y < -0.2) continue;
        const s = size * (0.45 + h4 * h4 * 1.6);
        P.flake.add(V3(x, y, z), s, s, h4, 0, 0, h1 * 6.28);
      }
    });
  }
  function puff(at, t0, o = {}) {
    req(() => {
      const life = o.life ?? 1.0, a = ageQ(R.t, t0);
      if (a < 0 || a >= life) return;
      const k = a / life, p0 = toV(at), dir = o.dir ? toV(o.dir) : V3(0, 1, 0), size = o.size ?? 1, n = o.n ?? 3;
      const pool = o.kind === 'spray' ? P.puffW : P.puff;
      for (let i = 0; i < n; i++) {
        const h = hash(i + (o.seed ?? 0) * 7.3, t0), h2 = hash(i + 3.3, t0 + 1);
        const spread = V3(h - 0.5, (h2 - 0.5) * 0.6, hash(i + 9, t0) - 0.5).multiplyScalar((o.spread ?? 0.8) * size);
        const grow = size * (0.45 + 0.9 * Math.pow(k, 0.6)) * (0.7 + 0.6 * h);
        const p = p0.clone().addScaledVector(dir, size * (0.2 + 1.6 * Math.pow(k, 0.7)) * (0.6 + 0.6 * h2)).addScaledVector(spread, 0.4 + k);
        pool.add(p, grow, grow, Math.min(0.95, k * 1.05 + h * 0.1), h + i, 0, 0);
      }
    });
  }
  const breath = (at, t0, o = {}) => puff(at, t0, { life: 0.9, size: 0.7, n: 3, spread: 0.5, ...o });
  function ring(at, t0, o = {}) {
    req(() => {
      const life = o.life ?? 2.5, a = ageQ(R.t, t0, o.rate ?? 8);
      if (a < 0 || a >= life) return;
      const p = toV(at), r = (o.r0 ?? 0.3) + (o.speed ?? 6) * a;
      P.ring.addFlat(V3(p.x, (o.y ?? 0) + 0.02, p.z), r, a / life, hash(t0), o.width ?? 0.4);
    });
  }
  function splash(at, t0, size = 1, o = {}) {
    req(() => {
      const life = o.life ?? 0.75, a = ageQ(R.t, t0);
      if (a < 0 || a >= life) return;
      const k = a / life, p = toV(at);
      if (o.kind === 'snow') return;   // handled by puff
      P.crown.add(V3(p.x, (o.y ?? 0.02), p.z), size * 3.2 * (0.7 + k * 0.6), size * 2.6 * (0.6 + k * 0.8), k, hash(t0, 2), o.tint ? 0.6 : 0);
      if (o.tint) P.crown.mat.uniforms.uTint.value.set(o.tint);
      // droplets on ballistic arcs
      for (let i = 0; i < (o.n ?? 14); i++) {
        const h1 = hash(i, t0), h2 = hash(i + 4, t0), h3 = hash(i + 8, t0);
        const ang = h1 * 6.283, v = size * (2.5 + 3 * h2), up = size * (3 + 4 * h3);
        const tt = a + 0.04;
        const q = V3(p.x + Math.cos(ang) * v * tt, (o.y ?? 0) + up * tt - 9.8 * size * 0.6 * tt * tt, p.z + Math.sin(ang) * v * tt);
        if (q.y < 0) continue;
        const vel = V3(Math.cos(ang) * v, up - 9.8 * size * 1.2 * tt, Math.sin(ang) * v).normalize().multiplyScalar(size * 0.45);
        P.spark.add(q, size * 0.13, 0, h1, 0, 1, 0, vel);
      }
    });
    ring(at, t0, { speed: 3 * size, life: 1.6, r0: size * 0.6 });
  }
  // running-foot splash: a crown curtain of water (open toward the run, thrown back), spiky rim with beads + white lip,
  // drips leaving the rim, a ring on the water. On threes.
  function kick(at, t0, dir, size = 1, o = {}) {
    req(() => {
      const life = o.life ?? 0.62, a = ageQ(R.t, t0);
      if (a < 0 || a >= life) return;
      const k = a / life, p = toV(at), d = toV(dir).clone().setY(0).normalize(), sd = V3(-d.z, 0, d.x);
      const H = size * 3.6 * Math.sin(Math.PI * Math.min(1, 0.18 + k * 1.15));
      const r0 = size * (0.6 + 1.6 * Math.pow(k, 0.7)), A = 2.75;
      const c0 = p.clone().addScaledVector(d, -size * 0.9 * k);
      const dirAt = (u) => { const ang = (u - 0.5) * 2 * A; return d.clone().multiplyScalar(-Math.cos(ang)).addScaledVector(sd, Math.sin(ang)); };
      drawSheet((u, v) => {
        const ang = (u - 0.5) * 2 * A, rr = r0 * (1 + 0.15 * v + 0.45 * v * v * v) + v * size * 0.3 * (0.4 + k);
        return c0.clone().addScaledVector(dirAt(u), rr).setY(H * (0.82 + 0.18 * Math.cos(ang)) * v);
      }, k * 0.9, hash(t0, 1), 'crown', { uSpikes: 9 + Math.floor(hash(t0, 2) * 5) });
      for (let i = 0; i < 12; i++) {
        const h1 = hash(i, t0 * 3), h2 = hash(i + 2, t0 * 3), h3 = hash(i + 5, t0 * 3), ang = (h1 - 0.5) * 2 * A;
        const rr = r0 * 1.55 + size * 0.5 + size * (1 + 2 * h2) * k;
        const y = H * (0.82 + 0.18 * Math.cos(ang)) * (1.05 + 0.3 * h3) - size * 14 * Math.pow(Math.max(0, k - 0.3), 2);
        if (y < 0.05) continue;
        P.spark.add(c0.clone().addScaledVector(dirAt(h1), rr).setY(y), size * 0.14, 0, h1, 0, 1, 0, V3(0, -size * 0.55, 0));
      }
    });
    ring(at, t0, { speed: 4 * size, life: 1.2, r0: size, width: 0.5 });
  }
  // wall of water + glass + spray along a ground path: layered transparent sheets (far / main / mist veil / near), glass
  // shards glinting inside, droplets and drawn spray puffs along the top
  function wall(path, t0, o = {}) {
    req(() => {
      const life = o.life ?? 1.6, a = ageQ(R.t, t0);
      if (a < 0 || a >= life) return;
      const k = a / life, pts = path.map(toV), H0 = o.height ?? 40, H = H0 * Math.sin(Math.PI * Math.min(1, 0.12 + k * 1.1));
      const n = pts.length - 1;
      const seg = (u) => { const f = u * n, i = Math.min(Math.floor(f), n - 1); return [i, f - i]; };
      const at = (u) => { const [i, r] = seg(u); return pts[i].clone().lerp(pts[i + 1], r); };
      const nrmAt = (u) => { const [i] = seg(u); const tg = pts[i + 1].clone().sub(pts[i]).setY(0).normalize(); return V3(-tg.z, 0, tg.x); };
      const cs = Math.sign(cam().position.clone().sub(at(0.5)).dot(nrmAt(0.5))) || 1;   // + = toward the camera
      const layers = [   // offset toward the camera (m), height, alpha, tone (0 white near .. 1 cool far), u range, render order
        [-16, 1.25, 0.42, 1.0, 0.0, 1.0, 10], [0, 1.0, 0.58, 0.5, 0.0, 1.0, 11],
        [-4, 1.6, 0.28, 0.75, 0.05, 0.95, 12], [11, 0.6, 0.72, 0.05, 0.1, 0.9, 13],
      ];
      layers.forEach(([off, hk, al, tone, u0, u1, ord], li) => {
        drawSheet((u, v) => {
          const uu = u0 + (u1 - u0) * u;
          const crest = 0.8 + 0.12 * Math.sin(uu * 23 + t0 + li * 1.7) + 0.08 * Math.sin(uu * 61 + li * 4.1) + 0.1 * (hash(Math.floor(uu * 14), li + t0) - 0.5);
          return at(uu).addScaledVector(nrmAt(uu), off * cs * (0.6 + 0.4 * v)).setY(H * hk * v * crest);
        }, Math.min(0.95, k * (li === 2 ? 1.1 : 0.9)), hash(t0, 9 + li), 'wall', { uAlpha: al * (o.alpha ?? 1), uTone: tone }, ord);
      });
      const k3 = Math.floor(R.t * 8 + 1e-6);
      for (let i = 0; i < 90; i++) {
        const h1 = hash(i, t0), h2 = hash(i + 1, t0), h3 = hash(i + 2, t0);
        const p = at(h1).addScaledVector(nrmAt(h1), cs * (h2 * 26 - 16)), y = H * (0.15 + h3) * (1 - k * 0.35);
        if (i % 3 === 0) P.spark.add(p.clone().setY(y + H * 0.3), 0.7, 0, h1, 0, 1, 0, V3(0, -3, 0));
        else glass?.add(p.clone().setY(y), (2.2 + h3 * 4.5) * (o.glass ?? 1), h1 * 9 + a * 5, h2 * 9, h3 * 9);
        if (i % 7 === 0 && hash(i, k3) > 0.45) { const s = 2.5 + 3 * h2; P.star.add(p.clone().setY(y), s, s, 0.3, h1, 1, 0); }
      }
      const nm = Math.round(11 * (o.mist ?? 1));
      for (let i = 0; i < nm; i++) {   // spray mist: soft white puffs of mixed size drifting off the crest
        const h1 = hash(i, t0 + 4), h2 = hash(i + 7, t0 + 4), u = (i + 0.2 + 0.6 * h1) / nm;
        puffDirect(at(u).addScaledVector(nrmAt(u), cs * (h2 - 0.6) * 14).setY(H * (0.72 + 0.3 * h2) + k * 8), H0 * (0.5 + 0.45 * h1) * Math.min(1, 0.4 + (o.mist ?? 1)), k * 0.9, i + t0, P.mist);
      }
    });
  }
  function puffDirect(p, size, k, seed, pool = P.puff) { const h = hash(seed, 3); const s = size * (0.6 + 0.6 * k) * (0.8 + 0.4 * h); pool.add(p, s, s, Math.min(0.95, k * 1.1), h, 0, 0); }

  function slash(kind, from, to, t0, o = {}) {
    req(() => {
      const life = o.life ?? 0.5, a = ageQ(R.t, t0);
      if (a < 0 || a >= life) return;
      const age = a / life, A0 = toV(from), B0 = toV(to);
      const L = A0.distanceTo(B0);
      const bulge = kind === 'line' ? V3() : (o.bulge ? toV(o.bulge) : V3(0, L * 0.22, 0));
      const pts = arcPts(A0, B0, bulge, 24);
      const W = o.width ?? L * 0.045;
      const m = drawRibbon('slash', pts, () => W, o.side ?? null, { uAge: age, uReveal: 1, uBright: o.bright ?? 1, uSeed: o.seed ?? hash(t0) });
      if (m) { m.material.uniforms.uEdge.value.set(o.color ?? '#5cf2ff'); m.material.uniforms.uOuter.value.set(o.outer ?? '#1d3f8c'); }
    });
  }
  function xcut(k, o = {}) {
    if (k <= 0) return;
    req(() => {
      const c = o.centre ? toV(o.centre) : (gAnchor('chestC') ?? V3(0, 150, -66));
      const size = o.size ?? 120, ext = o.extend ?? 0;
      const camv = cam().position.clone().sub(c).normalize();
      const nrm = o.normal ? toV(o.normal).normalize() : camv;
      const up = V3(0, 1, 0), rt = V3().crossVectors(up, nrm).normalize(), up2 = V3().crossVectors(nrm, rt).normalize();
      const draw = Math.min(1, k / 0.12);
      const len = size * (1 + ext * 60);
      const lines = [[V3().addScaledVector(rt, -1).addScaledVector(up2, 1.15), '#ff3b2e', '#8e1e26'], [V3().addScaledVector(rt, 1).addScaledVector(up2, 1.15), '#5cf2ff', '#1d3f8c']];
      for (const [d, col, out] of lines) {
        d.normalize();
        const a = c.clone().addScaledVector(d, len * draw), b = c.clone().addScaledVector(d, -len * draw);
        const W = (o.width ?? size * 0.028) * (1 + ext * 7) * (k < 0.12 ? 1.5 : 1);
        const m = drawRibbon('slash', [a, b], (u) => W * Math.pow(Math.sin(Math.PI * u), 0.35), null, { uAge: 0, uReveal: 1, uBright: 1.3 + (k < 0.15 ? 1 : 0), uSeed: 0.3 });
        if (m) { m.material.uniforms.uEdge.value.set(col); m.material.uniforms.uOuter.value.set(out); }
      }
      if (k < 0.2) P.star.add(c, size * 0.9 * (1 - k * 2), size * 0.9 * (1 - k * 2), 0, 0.5, 0.6, 0.785);
    });
  }
  function sparks(at, t0, o = {}) {
    req(() => {
      const life = o.life ?? 0.5, a = ageQ(R.t, t0);
      if (a < 0 || a >= life) return;
      const k = a / life, p = toV(at), sp = o.speed ?? 14, dir = o.dir ? toV(o.dir).normalize() : V3(0, 1, 0), spread = o.spread ?? 1.2;
      const n = o.n ?? 18;
      for (let i = 0; i < n; i++) {
        const h1 = hash(i, t0 * 1.7), h2 = hash(i + 5, t0 * 1.7), h3 = hash(i + 9, t0 * 1.7);
        const v = dir.clone().add(V3(h1 - 0.5, h2 - 0.5, h3 - 0.5).multiplyScalar(2 * spread)).normalize().multiplyScalar(sp * (0.5 + h2));
        const tt = a + 0.06;
        const q = p.clone().addScaledVector(v, tt).add(V3(0, -4.9 * tt * tt, 0));
        const vel = v.clone().add(V3(0, -9.8 * tt, 0)).multiplyScalar(0.05 * (1 - k * 0.5));
        P.spark.add(q, (o.width ?? 0.08), 0, h1, 1 - k, 0, 0, vel);
      }
      if (a < 0.13) P.star.add(p, (o.flash ?? 2.5), (o.flash ?? 2.5), 0, hash(t0), 1, hash(t0) * 3);
    });
  }
  function aura(on, k = 1, o = {}) {
    if (!on || k <= 0) return;
    req(() => {
      const base = o.from ? toV(o.from) : anchor('sumi', 'bladeBase', V3(0, 10, 0));
      const tip = o.to ? toV(o.to) : anchor('sumi', 'bladeTip', V3(0, 22, 0));
      const d = R.t, k3 = Math.floor(d * 8 + 1e-6);
      const n = o.n ?? 12, L = base.distanceTo(tip), H = (o.height ?? L * 0.42) * k;
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, p = base.clone().lerp(tip, u);
        const h = H * (0.55 + 0.6 * hash(i, k3)) * (1 - 0.35 * Math.abs(u - 0.55));
        P.flame.add(p.add(V3(0, h * 0.42, 0)), h * 0.55, h, hash(i * 3.1, k3), k, 0, (hash(i, k3 + 2) - 0.5) * 0.35);
      }
      // a few licks off the tip and a hot core along the blade
      for (let i = 0; i < 3; i++) P.flame.add(tip.clone().add(V3(0, H * (0.3 + 0.2 * i), 0)), H * 0.3, H * 0.6, hash(i + 40, k3), k, 0, (hash(i, k3 + 7) - 0.5) * 0.6);
    });
  }
  function embers(k, o = {}) {
    if (k <= 0) return;
    req(() => {
      const a0 = o.from ? toV(o.from) : anchor('sumi', 'chest', V3(0, 12, 0)), a1 = o.to ? toV(o.to) : anchor('sumi', 'scarfTip', V3(-6, 8, -4));
      const t = T3(R.t), n = Math.floor((o.n ?? 160) * Math.min(1, k));
      const S = o.size ?? 0.35;
      for (let i = 0; i < n; i++) {
        const h1 = hash(i, 21), h2 = hash(i, 22), h3 = hash(i, 23), life = 1.4 + h2;
        const ph = ((t * 0.9 + h1 * life) % life) / life;
        const p = a0.clone().lerp(a1, Math.pow(h3, 0.7)).add(V3(Math.sin(i + t * 2) * 1.5 * ph, ph * (8 + 10 * h2), Math.cos(i * 1.7 + t) * 1.5 * ph));
        const s = S * (1 - ph * 0.7) * (0.6 + h2);
        P.ember.add(p, s, s * 1.4, 1 - ph, h1, 0, h3 * 6.28 + t * 3);
      }
    });
  }
  function pour(k, o = {}) {
    if (k <= 0) return;
    req(() => {
      const t = R.t, k3 = Math.floor(t * 8 + 1e-6);
      const names = o.anchors ?? ['shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'handL', 'handR', 'crest', 'swordBase', 'chestC', 'headC'];
      names.forEach((nm, i) => {
        const p = gAnchor(nm); if (!p || p.y < 2) return;
        const w = (o.width ?? 9) * (0.7 + 0.6 * hash(i, 3));
        const top = p.clone().add(V3((hash(i, 5) - 0.5) * 10, -4, (hash(i, 6) - 0.5) * 6));
        if (o.outward) { const c0 = gAnchor('chestC'); if (c0) top.x += Math.sign(top.x - c0.x || 1) * o.outward; }   // fall clear of the body
        const bot = top.clone().setY(0);
        const m = drawRibbon('curtain', [top, top.clone().lerp(bot, 0.5).add(V3(0, 0, 3)), bot], (u) => w * (0.5 + 0.7 * u), null,
          { uAge: 1 - k, uReveal: 1, uSeed: i * 1.7, uPhase: T3(t) * 2 });
        const ps = w * 1.6 * (o.spray ?? 1);
        if (ps > 0) P.puffW.add(bot.clone().setY(w * 0.5), ps, ps, 0.25 + 0.5 * hash(i, k3), hash(i, k3 + 1), 0, 0);
      });
      // glass pieces falling off
      const n = Math.floor((o.n ?? 220) * k);
      const cen = gAnchor('chestC') ?? V3(0, 120, -90);
      for (let i = 0; i < n; i++) {
        const h1 = hash(i, 61), h2 = hash(i, 62), h3 = hash(i, 63), life = 2.0 + h3;
        const ph = ((T3(t) + h1 * life) % life) / life;
        const p = cen.clone().add(V3((h2 - 0.5) * 120, 60 * (h3 - 0.3) - ph * ph * 180, (h1 - 0.5) * 50));
        if (p.y < 0) continue;
        glass?.add(p, 1.5 + 4 * h3, h1 * 7 + ph * 6, h2 * 7, h3 * 7 + ph * 3);
      }
    });
  }
  function shardSnow(k, o = {}) {
    if (k <= 0) return;
    req(() => {
      const t = T3(R.t), c = o.centre ? toV(o.centre) : V3(0, 0, -60), Rr = o.radius ?? 420, H = o.height ?? 260;
      const n = Math.floor((o.n ?? 7000) * Math.min(1, k * 1.5) * (o.amount ?? 1));
      const t0 = o.t0 ?? (ctx.CUES?.shatter ?? 73), age = Math.max(0, R.t - t0);
      for (let i = 0; i < n; i++) {
        const h1 = hash(i, 71), h2 = hash(i, 72), h3 = hash(i, 73), h4 = hash(i, 74);
        const r = Rr * Math.sqrt(h1) * (0.25 + 0.75 * Math.min(1, age / 2.5)), ang = h2 * 6.283;
        const fall = (6 + 10 * h4) * age;
        const y = H * (0.15 + 0.85 * h3) - fall + Math.sin(age * 1.5 + i) * 2;
        if (y < 0.5) continue;
        const p = V3(c.x + Math.cos(ang) * r + Math.sin(age * 0.7 + i) * 3, y, c.z + Math.sin(ang) * r);
        const size = (o.size ?? 1.6) * (0.35 + h4 * h4 * 2.0);
        glass?.add(p, size, h1 * 9 + t * (1 + h2 * 3), h2 * 9 + t * 1.3, h3 * 9);
      }
      // glitter: sparse star glints flickering per drawing
      const k3 = Math.floor(R.t * 8 + 1e-6), ns = Math.floor(420 * Math.min(1, k));
      for (let i = 0; i < ns; i++) {
        const h1 = hash(i, k3 * 1.31), h2 = hash(i + 2, k3 * 1.31), h3 = hash(i + 5, k3 * 1.31);
        const p = V3(c.x + (h1 - 0.5) * Rr * 1.6, H * h2 * Math.max(0.2, 1 - age / 12), c.z + (h3 - 0.5) * Rr * 1.2);
        if (i % 4 === 0) { const s = (o.size ?? 1.6) * (1 + 1.4 * h3); P.star.add(p, s, s, 0.2 + 0.5 * h1, h2, h1 > 0.5 ? 1 : 0.3, h3 * 0.3); }
        else { const s = (o.size ?? 1.6) * 0.3 * (0.6 + h3); P.dot.add(p, s, s, 0.3 * h1, h2, h1 > 0.5 ? 1 : 0, 0); }
      }
    });
  }
  function sparkles(at, t0, o = {}) {
    req(() => {
      const life = o.life ?? 0.75, a = ageQ(R.t, t0);
      if (a < 0 || a >= life) return;
      const k = a / life, p = toV(at), n = o.n ?? 16, Rr = o.radius ?? 10, S = o.size ?? 1.3;
      for (let i = 0; i < n; i++) {
        const h1 = hash(i, t0), h2 = hash(i + 3, t0), h3 = hash(i + 6, t0);
        if (h3 * 0.6 > 1 - k + 0.25) continue;
        const d = V3(h1 - 0.5, (h2 - 0.3) * 0.8, h3 - 0.5).normalize();
        const q = p.clone().addScaledVector(d, Rr * (0.3 + 0.9 * h2) * (0.4 + 0.8 * Math.pow(k, 0.5)));
        const tw = Math.sin(Math.PI * Math.min(1, k * 1.2 + 0.15 * h3));
        if (i % 3 === 0) { const s = S * (0.6 + 0.7 * h1) * tw; P.star.add(q, s, s, k * 0.5, h2, h1 > 0.4 ? 1 : 0.2, h3 * 0.3); }
        else { const s = S * 0.16 * (0.6 + h1) * tw; P.dot.add(q, s, s, k * 0.6, h2, h1 > 0.5 ? 1 : 0, 0); }
      }
      if (a < 0.13) P.star.add(p, Rr * 0.28, Rr * 0.28, 0, 0.3, 1, 0);
    });
  }
  function glint(at, t0, o = {}) {
    req(() => {
      const life = o.life ?? 0.375, a = ageQ(R.t, t0, o.rate ?? 8);
      if (a < 0 || a >= life) return;
      const k = a / life, s = (o.size ?? 2) * (1 - k * 0.6);
      (o.layer === 2 ? P.star2 : P.star).add(toV(at), s, s, k * 0.5, 0.2, o.warm ?? 0.3, o.rot ?? 0);
    });
  }
  function drop(from, t0, t1, o = {}) {
    req(() => {
      const t = o.onTwos === false ? R.t : A.onTwos(R.t);
      if (t < t0 || t > t1 + 0.01) return;
      const p0 = toV(from);
      const hang = o.hang ?? 0.25;   // first part: the drop swells and hangs, then falls
      let p, streak = 0, swell = 1;
      if ((t - t0) < hang) { p = p0.clone(); swell = 0.75 + 0.25 * (t - t0) / hang; }
      else { const u = Math.pow(((t - t0) - hang) / Math.max(t1 - t0 - hang, 1e-3), 2); p = p0.clone().setY(p0.y * (1 - u)); streak = Math.min(1, 0.35 + u * 1.2); }
      const r = (o.size ?? 0.09) * 1.15 * swell, L = 1 + streak * 1.6;
      P.drop.add(p.add(V3(0, r * (L - 1), 0)), 2 * r, 2 * r * L, streak, hash(t0), 0, 0);
    });
    const hit = toV(from).clone().setY(0);
    ring(hit, t1, { speed: o.ringSpeed ?? 1.4, life: o.ringLife ?? 3, r0: 0.08, width: 0.2 });
    splash(hit, t1, o.splashSize ?? 0.1, { n: 8, life: 0.5 });
  }
  // s31 kaleidoscope: floating shards each showing Sumi live from another angle (see fx_kaleido.js); o: {centre, yaw}
  function kaleido(k = 1, o = {}) { if (k > 0) R.kal = { k, o }; }
  const kaleidoCam = (lt, dur, o = {}) => KAL.cam(lt, dur, o);
  function speedLines(k, o = {}) { if (R.st) R.st.look.speed = { amount: k, centre: o.centre ?? [0.5, 0.5], mode: o.mode ?? 'radial', dir: o.dir ?? [1, 0], color: o.color }; }
  function impact(kind) { if (R.st) R.st.look.impact = kind; }

  const api = {
    rain, snow, breath, puff, drop, ring, splash, kick, wall, slash, xcut, sparks, aura, embers, pour, shardSnow, sparkles, glint,
    speedLines, impact, kaleido, kaleidoCam,
    mute(name) { R.muted.add(name); }, unmute(name) { R.muted.delete(name); },
    get auto() { return R.auto; }, set auto(v) { R.auto = !!v; },
    pools: P, root,
  };
  ctx.api.fx = api;

  // ------------------------------------------------------------------ AUTO: the film's default FX from CUES
  const cue = (n, d) => ctx.CUES?.[n] ?? d;
  const on = (name) => !R.muted.has(name);
  function autoFx(st) {
    const t = st.t, set = st.set, sid = st.sid;
    if (set === 'CITY' && on('rain')) rain('CITY', sid === 's11' ? 0.45 : 1, { tint: '#ff4fa3' });
    if (set === 'PASS' && on('snow')) snow(sid === 's04' ? 0.8 : 0.6, sid === 's04' ? {} : {});
    // s02 Sumi's foot splashes into the puddle
    if (on('sumiStep') && t > 3.5 && t < 5.25) {
      const t0 = cue('sumiStep', 3.9);
      const f = () => { const a = anchor('sumi', 'footR', V3(0, 0, 0)), b = anchor('sumi', 'footL', V3(0, 0, 0)); return (a.y < b.y ? a : b).setY(0); };
      splash(f, t0, 1.2, { tint: '#ff4fa3', n: 22, life: 1.0 });
    }
    // s07 breath vapour from Yuki's cheek vents
    if (on('breath') && (sid === 's07' || sid === 's05' || sid === 's04')) {
      for (let i = 0; i < 4; i++) {
        const t0 = 13.6 + i * 0.85 - (sid === 's07' ? 0 : 9);
        const head = () => { const e = anchor('yuki', 'eye', null) ?? anchor('yuki', 'head', V3(0, 14, 0)); return e.add(V3(0, -0.6, 0.4)); };
        breath(head, sid === 's07' ? t0 : st.shot.t0 + 0.3 + i * 0.85, { dir: V3(0.15, 0.25, 1), size: 0.55 });
      }
    }
    // s10 snow burst at the leap
    if (on('yukiLeap') && sid === 's10') {
      const t0 = cue('yukiLeap', 19.4);
      const f = () => anchor('yuki', 'footL', V3(0, 0, -112)).setY(Math.max(0, anchor('yuki', 'footL', V3()).y - 0.5));
      puff(f, t0 - 0.05, { size: 7, n: 7, life: 1.5, spread: 1.4, dir: V3(0, 0.6, 0.4) });
    }
    // s12 touchdown ring
    if (on('touchdown') && (sid === 's12' || sid === 's13')) {
      const t0 = cue('touchdown', 22.9);
      const f = () => { const a = anchor('sumi', 'footR', V3()), b = anchor('sumi', 'footL', V3()); return (a.y < b.y ? a : b).setY(0); };
      ring(f, t0, { speed: 8, life: 3, width: 0.5 }); splash(f, t0, 0.8, { n: 10 });
    }
    // s15 steel flash at the guard
    if (on('guardClick') && sid === 's15') glint(() => anchor('sumi', 'bladeBase', V3(0, 10, 0)), cue('guardClick', 31.8) + 0.1, { size: 1.2, life: 0.4 });
    // s18/s19 the drop from the scarf
    if (on('drop') && (sid === 's18' || sid === 's19')) {
      const from = () => anchor('sumi', 'scarfTip', V3(-2, 6, 0));
      drop(from, cue('dropFall', 37.2), cue('dropHit', 38.6), { size: 0.12 });
    }
    // s22 charge: water sheets at the feet on threes
    if (on('charge') && sid === 's22') {
      for (const who of ['sumi', 'yuki']) {
        const k0 = Math.floor((t - 45) * 4);
        for (let j = Math.max(0, k0 - 2); j <= k0; j++) {
          const t0 = 45 + j * 0.25, foot = j % 2 ? 'footL' : 'footR';
          const p = anchor(who, foot, null); if (!p) continue;
          const dir = anchor(who, 'chest', V3()).sub(anchor(who, 'head', V3(0, 0, 1))).setY(0);
          const fwd = who === 'sumi' ? V3(1, 0, 0) : V3(-1, 0, 0);
          if (t >= t0) kick(p.setY(0), t0, fwd, who === 'sumi' ? 1.1 : 0.9);
        }
      }
      speedLines(0.55, { centre: [0.5, 0.45] });
    }
    // s23 pass: two slashes + impact frames
    if (on('pass') && (sid === 's23' || sid === 's24')) {
      const t0 = cue('pass', 47.6);
      const c = V3(0, 9, 0);
      slash('arc', c.clone().add(V3(-16, 14, 2)), c.clone().add(V3(16, -6, -2)), t0, { color: '#ff3b2e', outer: '#8e1e26', width: 1.1, bulge: V3(0, 5, 3) });
      slash('arc', c.clone().add(V3(16, 12, -2)), c.clone().add(V3(-16, -4, 2)), t0 + 0.04, { color: '#5cf2ff', outer: '#1d3f8c', width: 0.9, bulge: V3(0, 4, -3) });
      sparks(c, t0, { n: 26, speed: 22, flash: 6 });
      if (st.frame === Math.round(t0 * 24)) impact(1); else if (st.frame === Math.round(t0 * 24) + 1) impact(2);
    }
    // s26 emerge: glass + water pouring off the giant, spray at its base
    if (on('pour') && t >= 52 && t < 58) {
      const k = sm(cue('emerge', 52.3), 53.0, t) * (1 - sm(56.5, 58, t));
      pour(k);
      const base = ctx.api.giant?.state?.pose; if (base && k > 0) {
        const k3 = Math.floor(t * 8);
        for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; puffDirect(V3(base.x + Math.cos(a) * 60, 6 + 8 * hash(i, k3), base.z + Math.sin(a) * 40), 30, 0.2 + 0.5 * hash(i, k3 + 1), i, P.puffW); }
      }
    }
    // calm mirror while the giant stands: LANDS' crack web fades to a faint trace (so its reflection reads), back for the heal
    if (on('calmLake') && t >= cue('emerge', 52.3) - 0.2 && t < cue('heal', 76.2) + 0.2) {
      const U = ctx.api.lake?.uniforms?.uCrack;
      if (U && U.value.w > 0) U.value.w *= 1 - 0.85 * sm(cue('emerge', 52.3), 53.8, t) * (1 - sm(cue('heal', 76.2) - 1.4, cue('heal', 76.2), t));
    }
    // the giant's own disturbance: rings at its feet (or at the waterline while it rises) every 0.9 s
    if (on('giantRipples') && t >= cue('emerge', 52.3) && t < cue('shatter', 73.0) + 1) {
      const g = ctx.api.giant, gp = g?.state?.pose;
      if (g && g.state.visible && !g.state.reflect && gp) {
        const per = 0.9, t00 = cue('emerge', 52.3), k0 = Math.floor((t - t00) / per);
        for (let j = Math.max(0, k0 - 4); j <= k0; j++) {
          const t0 = t00 + j * per, foot = gAnchor(j % 2 ? 'footL' : 'footR');
          const p = foot && foot.y < 12 && foot.y > -8 ? foot : V3(gp.x + (j % 2 ? -20 : 20), 0, gp.z);
          if (p.y < -8 && (gp.rise ?? 1) < 0.3) continue;
          ctx.api.lake?.ripple?.(Math.round(p.x), Math.round(p.z), t0, 12);
          ring(V3(Math.round(p.x), 0, Math.round(p.z)), t0, { speed: 12, life: 3.6, r0: 14, width: 0.5 });
        }
      }
    }
    // s31 kaleidoscope (+ its gliding camera unless direction gives s31 a camera)
    if (on('kaleido') && sid === 's31') {
      kaleido(Math.min(1, (t - st.shot.t0) / 0.25 + 0.2));
      if (on('kaleidoCam') && !st.test && !ctx.DIRECTION?.CAMS?.s31) {
        const c = kaleidoCam(t - st.shot.t0, st.shot.dur);
        st.cam.pos.copy(c.pos); st.cam.look.copy(c.look); st.cam.fov = c.fov; st.cam.roll = c.roll;
      }
    }
    // s27 the sword carves the lake: a wall of glass and spray along an arc in front of the giant
    if (on('swing') && t >= 55.5 && t < 58.5) {
      const t0 = cue('swing', 56.2), g = ctx.api.giant?.state?.pose ?? { x: 0, z: -90 };
      const path = []; for (let i = 0; i <= 10; i++) { const a = -0.9 + i / 10 * 1.9; path.push(V3(g.x + Math.sin(a) * 150, 0, g.z + Math.cos(a) * 110)); }
      wall(path, t0 + 0.15, { height: 45, life: 1.8 });
      if (t < t0 + 0.6) speedLines(0.7, { centre: [0.5, 0.6] });
    }
    // s28 Yuki runs up the forearm: sparks at her feet + parallel speed lines
    if (on('runArm') && sid === 's28') {
      const k0 = Math.floor((t - 58) * 8);
      for (let j = Math.max(0, k0 - 3); j <= k0; j++) {
        const t0 = 58 + j / 8, p = anchor('yuki', j % 2 ? 'footL' : 'footR', null); if (p) sparks(p, t0, { n: 10, speed: 10, life: 0.4, dir: V3(-1, 0.6, 0), flash: 1.4 });
      }
      speedLines(0.8, { mode: 'parallel', dir: [1, 0.25] });
    }
    // s29+ aura along Sumi's blade, scarf burns into embers
    if (on('aura') && t >= cue('aura', 60.5) && t < 69.6) {
      const k = sm(cue('aura', 60.5), cue('aura', 60.5) + 0.5, t);
      aura(true, k);
      if (t < 66.5) embers(sm(60.8, 61.6, t));
    }
    // s30 face cut: two quick slashes at the giant's head
    if (on('faceCut') && sid === 's30') {
      const t0 = cue('faceCut', 62.9), h = gAnchor('headC') ?? V3(0, 190, -80);
      slash('arc', h.clone().add(V3(-26, 22, 18)), h.clone().add(V3(22, -18, 18)), t0, { color: '#5cf2ff', width: 2.6, bulge: V3(0, 4, 10), life: 0.5 });
      slash('arc', h.clone().add(V3(24, 24, 18)), h.clone().add(V3(-20, -16, 18)), t0 + 0.25, { color: '#5cf2ff', width: 2.6, bulge: V3(0, 4, 10), life: 0.5 });
      sparks(h.clone().add(V3(0, 0, 16)), t0, { n: 22, speed: 30, flash: 10, width: 0.3 });
      sparks(h.clone().add(V3(0, 0, 16)), t0 + 0.25, { n: 22, speed: 30, flash: 10, width: 0.3 });
      const f0 = Math.round(t0 * 24); if (st.frame === f0 || st.frame === f0 + 6) impact(1);
    }
    // s32 leap: speed lines
    if (on('leap') && sid === 's32') speedLines(0.5, { centre: [0.5, 0.35] });
    // s33-s35 the X
    if (on('xcut') && t >= cue('cross', 68.4) && t < 73.05) {
      const t0 = cue('cross', 68.4);
      xcut(Math.min(1, (A.onTwos(t) - t0) / 1.2 + 0.001), { extend: sm(cue('split', 70.75), 72.6, t) });
      const f0 = Math.round(t0 * 24);
      if (st.frame === f0) impact(1); else if (st.frame === f0 + 1) impact(1); else if (st.frame === f0 + 2) impact(2);
    }
    // s36-s38 shard snow (gone after the click: the last shards burst into sparkles)
    if (on('shardSnow') && t >= cue('shatter', 73.0) && t < cue('click', 79.4)) {
      shardSnow(sm(cue('shatter', 73.0), 74.5, t) * (t > 78.5 ? 0.35 : 1));
    }
    if (on('click') && (sid === 's38' || sid === 's39')) {
      const t0 = cue('click', 79.4);
      sparkles(() => anchor('sumi', 'scabbard', V3(0, 9, 0)), t0, { n: 24, radius: 12, size: 0.9 });
      sparkles(() => anchor('sumi', 'chest', V3(0, 12, 0)).add(V3(0, 4, 0)), t0 + 0.08, { n: 20, radius: 22, size: 1.3, life: 1.0 });
    }
  }

  // ------------------------------------------------------------------ flush (just before the frame renders)
  function flush() {
    if (R.flushed === R.frameId) return;
    R.flushed = R.frameId;
    for (const k in P) P[k].n = 0;
    if (!glass) makeGlass();
    glass.n = 0;
    for (const k in ribbons) { ribbons[k].forEach((m) => { m.visible = false; }); used[k] = 0; }
    for (const k in sheetPools) { sheetPools[k].forEach((m) => { m.visible = false; }); sheetUsed[k] = 0; }
    const c = cam();
    const fovK = 2 * Math.tan((c.fov ?? 40) * Math.PI / 360) / 1040;
    M.shared.uPxK.value = fovK;
    ctx.api.giant?.commit?.();
    for (const fn of R.reqs) { try { fn(); } catch (e) { console.warn('fx', e); } }
    for (const k in P) P[k].flush();
    glass.flush();
    if (R.kal) { try { KAL.frame(R.t, R.kal.k, R.kal.o, ctx.renderer, scene); } catch (e) { console.warn('fx kaleido', e); KAL.hide(); } } else KAL.hide();
  }
  const prevBR = scene.onBeforeRender;
  scene.onBeforeRender = function (...a) { if (prevBR) prevBR.apply(this, a); flush(); };

  // ------------------------------------------------------------------ test demos (q: fxdemo=name, fxt=seconds since start)
  function demo(st, name) {
    const ft = +(st.q.get('fxt') ?? 0.25), t0 = st.t - ft, O = V3(0, 0, 0);
    switch (name) {
      case 'rain': rain(st.set, 1); break;
      case 'snow': snow(1); break;
      case 'breath': breath(V3(0, 1.5, 0), t0, { dir: V3(0.3, 0.3, 1) }); break;
      case 'puff': puff(V3(0, 2, 0), t0, { size: 6, n: 6, life: 1.5 }); break;
      case 'drop': drop(V3(0, 3, 0), t0, t0 + 1.2, { size: 0.12 }); break;
      case 'ring': ring(O, t0, { speed: 4 }); break;
      case 'splash': splash(O, t0, 1.2, { tint: '#ff4fa3', n: 22, life: 1 }); break;
      case 'kick': kick(O, t0, V3(1, 0, 0), 1.2); break;
      case 'wall': wall([V3(-80, 0, -40), V3(-30, 0, -10), V3(30, 0, -10), V3(80, 0, -40)], t0, { height: 40 }); break;
      case 'slash': slash('arc', V3(-14, 4, 0), V3(14, 18, 0), t0, { color: '#ff3b2e', outer: '#8e1e26', width: 1.0, bulge: V3(0, 5, 4) });
        slash('arc', V3(14, 4, 2), V3(-14, 16, 2), t0 + 0.04, { color: '#5cf2ff', width: 0.8, bulge: V3(0, 4, 4) }); break;
      case 'xcut': xcut(Math.min(1, ft / 1.2 + 0.001), { centre: V3(0, 20, 0), size: 20, extend: +(st.q.get('fxext') ?? 0) }); break;
      case 'sparks': sparks(V3(0, 4, 0), t0, { n: 30, speed: 14, flash: 3 }); break;
      case 'aura': aura(true, 1, { from: V3(-6, 6, 0), to: V3(8, 14, 0) }); embers(1, { from: V3(-2, 8, 0), to: V3(-10, 4, -3) }); break;
      case 'embers': embers(1, { from: V3(-2, 8, 0), to: V3(-10, 4, -3) }); break;
      case 'pour': pour(1); break;
      case 'shards': shardSnow(1, { t0: st.t - ft, centre: V3(0, 0, -60) }); break;
      case 'sparkles': sparkles(V3(0, 8, 0), t0, { n: 24, radius: 10, size: 1.1 }); break;
      case 'kaleido': kaleido(1); { const c = kaleidoCam(+(st.q.get('lt') ?? 1), 2); if (st.q.get('kcam') === '1') { st.cam.pos.copy(c.pos); st.cam.look.copy(c.look); st.cam.fov = c.fov; st.cam.roll = c.roll; } } break;
      case 'glint': glint(V3(0, 6, 0), t0, { size: 3 }); break;
      case 'all': rain(st.set, 0.6); splash(V3(-6, 0, 4), t0, 1, { tint: '#ff4fa3' }); slash('arc', V3(-14, 4, 0), V3(14, 18, 0), t0, { color: '#ff3b2e', outer: '#8e1e26', width: 1 }); break;
      default: break;
    }
  }

  return {
    update(st) {
      R.st = st; R.t = st.t; R.reqs = []; R.kal = null; R.frameId = (R.frameId ?? 0) + 1;
      const q = st.q, d = q?.get?.('fxdemo');
      if (d) { for (const n of d.split(',')) demo(st, n); return; }
      if (R.auto && !(st.test && q?.get?.('fxauto') === '0')) autoFx(st);
    },
  };
}
