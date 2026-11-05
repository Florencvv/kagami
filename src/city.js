// city.js - CITY set (dept CITY): rain-night neon canyon street + dusk causeway (s11). Pure code, seeded, f(st.t).
//
// LAYOUT (metres, ground y = 0). Two zones, one visible at a time (auto: zone 'causeway' when st.sid === 's11').
//  STREET zone: the street runs along Z. Frontages at x = +-15 (30 m canyon), road |x| < 12, sidewalks 12..15.
//    Old 2-storey shops (tiled eaves, noren, chochin, kanban) stand in front of towers (front x ~ +-22..25); some
//    modern towers come down to the frontage (x +-15) with lit storefronts. Towers 40-150 m, lit windows. Blade
//    neon signs (real kanji) project from the facades at 8-45 m. Utility poles + cables along the sidewalks at <= 12 m,
//    street-crossing cable tangles only ABOVE 24 m (the 18 m ronin walks free). Steam vents in the road.
//    Sumi's walk line: x = WALK.x (-1.5), walking toward +Z (camera at +Z looks down the canyon toward -Z).
//  CAUSEWAY zone (s11): the last street of the city at z 0..+260, the causeway deck (top y 0, |x| < 13) runs from z 0
//    to z -3000 toward a golden horizon glow at -Z; calm sea at y -0.6 (look.mirror.y = -0.6). Walk x = 0 toward -Z.
//
// API  ctx.api.city = {
//   group, street, causeway         THREE.Groups (children of ctx.sets.CITY)
//   zone(name?)                     get/force 'street' | 'causeway' (null = auto by shot)
//   WALK, CWALK                     {x, dir}: walk lines (street toward +Z, causeway toward -Z)
//   puddles: [{name, x, z, rx, rz, rot, strength}], puddle(name)   strong mirror patches (s02, s08 + extras)
//   shots: {s02, s03, s06, s08, s11, s11b}: {pos:[x,y,z], at:[x,y,z], fov, end?:{pos, at}, stand:{x, z, ry}}
//   look(zone) -> suggested look fragment (fog, mirror, glows, grade) for direction / look.js
//   lights()  -> [{p: Vector3, r, c: Color}] all neon/lantern lights of the active zone
//   groundY(x, z) -> 0 (street) / 0 (causeway deck) / -0.6 (sea)
//   standIn                         the 18 m stand-in figure (test only)
// }
// ROUND 2: towers = 1-3 setback tiers (painted facades with room-lit windows, curtains, sills) carried by inked cel parts
//   (cornices, corner posts, bands/fins, balconies, zigzag stairs, AC units, pipes, roof tanks/housings/antennas/billboards)
//   + a back-row skyline; baked light pools on the wet street (all lights); noren + chochin sway on twos; RAIN is drawn
//   here (city_rain.js: fine layered streaks + small crowns) and the FX auto rain is muted (fx.mute('rain')) for the set.
// TEST (st.q, test mode): rain=<0..1> (city rain amount), zone=street|causeway  cityshot=s02|s03|s06|s08|s11|s11b (camera + stand-in from `shots`)
//   stand=0|1 (stand-in figure; default 1 in test when no ronin), lights=0 (no neon spill), k=<0..1> (time within cityshot)
import * as THREE from 'three';
import { signAtlas, shopAtlas, norenAtlas, boardAtlas, WORDS } from './city_tex.js';
import { makeCU, makeMats, NL } from './city_mat.js';
import { cityRain } from './city_rain.js';
import { LOOK_PRESETS } from './look.js';

const NEON = ['#FF4FA3', '#49E6FF', '#FFB347', '#A178FF'];
const WALK = { x: -1.5, dir: 1 };
const CWALK = { x: 0, dir: -1 };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- merged geometry builder
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3();
const G = {};
function base() {
  if (G.box) return G;
  G.box = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  G.cyl = new THREE.CylinderGeometry(1, 1, 1, 12, 1).toNonIndexed();
  G.cyl6 = new THREE.CylinderGeometry(1, 1, 1, 6, 1).toNonIndexed();
  G.sph = new THREE.SphereGeometry(1, 14, 10).toNonIndexed();
  G.tor = new THREE.TorusGeometry(1, 0.07, 5, 18).toNonIndexed();
  G.plane = new THREE.PlaneGeometry(1, 1).toNonIndexed();
  return G;
}
class MB {
  constructor() { this.P = []; this.N = []; this.U = []; this.C = []; this.S = []; }
  // add(geo, pos[3], rot[3] euler, scale[3], color, uv: null | [u,v] constant | fn(u,v)->[u,v], sway: null | [pivotY, amp, phase, kind])
  add(geo, pos, rot, scl, col = '#ffffff', uv = null, sw = null) {
    _e.set(rot[0], rot[1], rot[2]); _q.setFromEuler(_e); _p.set(pos[0], pos[1], pos[2]); _s.set(scl[0], scl[1], scl[2]);
    _m.compose(_p, _q, _s); _nm.getNormalMatrix(_m);
    const c = col instanceof THREE.Color ? col : new THREE.Color(col);
    const P = geo.attributes.position, Nn = geo.attributes.normal, U = geo.attributes.uv;
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(_m); this.P.push(_v.x, _v.y, _v.z);
      _n.fromBufferAttribute(Nn, i).applyMatrix3(_nm).normalize(); this.N.push(_n.x, _n.y, _n.z);
      const u = U ? U.getX(i) : 0, w = U ? U.getY(i) : 0;
      if (!uv) this.U.push(u, w); else if (typeof uv === 'function') { const r = uv(u, w); this.U.push(r[0], r[1]); } else this.U.push(uv[0], uv[1]);
      this.C.push(c.r, c.g, c.b);
      if (sw) this.S.push(sw[0], sw[1], sw[2], sw[3]); else this.S.push(0, 0, 0, 0);
    }
    return this;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('aSw', new THREE.Float32BufferAttribute(this.S, 4));
    g.computeBoundingSphere();
    return g;
  }
  mesh(mat, name) { const m = new THREE.Mesh(this.geometry(), mat); m.name = name; m.frustumCulled = false; return m; }
}
// cable: catenary tube between a and b with sag
function cable(mb, a, b, sag, r, col) {
  const pts = [];
  for (let i = 0; i <= 12; i++) { const k = i / 12; const p = a.clone().lerp(b, k); p.y -= sag * 4 * k * (1 - k); pts.push(p); }
  const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, r, 4, false), g = tg.index ? tg.toNonIndexed() : tg;
  mb.add(g, [0, 0, 0], [0, 0, 0], [1, 1, 1], col);
}

// ---------------------------------------------------------------- the city builder (used by both zones)
function buildCity(rng, o, T, B, lights, steams) {
  const { z0, z1 } = o;  // z0 > z1, blocks from z0 down to z1
  const signs = [];
  for (const s of [-1, 1]) {
    let z = z0 + rng() * 8;
    while (z > z1) {
      const bw = 12 + rng() * 20, gap = rng() < 0.4 ? 1.5 + rng() * 3 : 0.2;
      const za = z - bw, zb = z;
      const modern = rng() < 0.3;
      const fx = modern ? 15 : 22 + rng() * 3;
      const depth = 18 + rng() * 24;
      let H = 40 + Math.pow(rng(), 1.4) * 95;
      if (rng() < 0.12) H = 140 + rng() * 25;
      tower(rng, s, za, zb, fx, depth, H, B, lights, signs, modern);
      if (!modern) {
        let zz = zb - 0.15;
        while (zz - za > 4.5) { let w = 5 + rng() * 4; if (zz - w - za < 4) w = zz - za - 0.15; shop(rng, s, zz - w, zz, fx, B, lights, T, signs); zz -= w + 0.15; }
      } else storefront(rng, s, za, zb, B, lights);
      // alley glow between blocks
      if (gap > 1) lights.push({ p: V(s * 17, 3, za - gap / 2), r: 8, c: new THREE.Color('#ff9a5a').multiplyScalar(0.35) });
      z = za - gap;
    }
  }
  // back-row skyline (layered above the front row, dissolves in the haze)
  if (o.back !== false) for (const s of [-1, 1]) for (let z = z0 + 10 - rng() * 10; z > z1; z -= 22 + rng() * 24) backTower(rng, s, z, B);
  // utility poles + sidewalk cables (<= 12 m), street lamps
  for (const s of [-1, 1]) {
    let prev = null;
    for (let z = z0 - rng() * 10; z > z1; z -= 24 + rng() * 8) {
      const x = s * 12.7, h = 11.5 + rng() * 1.2;
      B.poles.add(G.cyl, [x, h / 2, z], [0, 0, 0], [0.19, h, 0.19], '#5a5a82');
      for (const [yy, w] of [[h - 1.3, 1.9], [h - 0.5, 1.5]]) B.poles.add(G.box, [x, yy, z], [0, 0, 0], [w, 0.14, 0.14], '#3e3c62');
      if (rng() < 0.5) B.poles.add(G.cyl, [x + s * 0.45, h - 3, z], [0, 0, 0], [0.32, 1.1, 0.32], '#6a6a96');
      // street lamp arm toward the road
      B.poles.add(G.box, [x - s * 1.1, 7.6, z], [0, 0, s * 0.12], [2.2, 0.1, 0.1], '#3e3c62');
      B.props.add(G.box, [x - s * 2.15, 7.45, z], [0, 0, 0], [0.7, 0.18, 0.3], '#fff1d0', [2.9, 0]);
      lights.push({ p: V(x - s * 2.1, 7, z), r: 9, c: new THREE.Color('#ffe2b8').multiplyScalar(0.28) });
      const top = [V(x, h - 1.3, z), V(x + 0.8, h - 1.3, z), V(x - 0.8, h - 1.3, z), V(x + 0.6, h - 0.5, z)];
      if (prev) for (let i = 0; i < top.length; i++) cable(B.cables, prev[i], top[i], 0.5 + rng() * 0.5, 0.045, '#1c1a30');
      // drop cables into the buildings
      if (rng() < 0.6) cable(B.cables, top[0], V(s * 15.2, h - 3 - rng() * 2, z - 2 - rng() * 6), 0.4, 0.035, '#1c1a30');
      prev = top;
    }
  }
  // street-crossing cable tangles (all above 24 m)
  for (let z = z0; z > z1; z -= 9 + rng() * 16) {
    const n = 1 + Math.floor(rng() * 4), y0 = 25 + rng() * 32, zl = z + (rng() - 0.5) * 8, zr = z + (rng() - 0.5) * 8;
    for (let i = 0; i < n; i++) {
      const a = V(-15 - rng() * 6, y0 + rng() * 3, zl + (rng() - 0.5) * 2), b = V(15 + rng() * 6, y0 + (rng() - 0.5) * 6, zr + (rng() - 0.5) * 2);
      cable(B.cables, a, b, 1.5 + rng() * 3.5, 0.06 + rng() * 0.05, '#1c1a30');
    }
  }
  // steam vents in the road + shop chimneys
  for (const v of o.vents ?? []) {
    B.props.add(G.box, [v[0], 0.02, v[1]], [0, 0, 0], [2.2, 0.06, 1.4], '#2a2a48');
    steams.push({ x: v[0], y: 0, z: v[1], w: 9 + rng() * 4, h: 10 + rng() * 4, seed: rng() });
  }
  return signs;
}

// towers (round 2): designed silhouettes. Painted facade volumes (Kuwahara gouache) in 1-3 setback tiers, every edge
// carried by inked cel parts (cornice caps, corner posts, floor bands, fins, balconies, external stairs, AC units,
// pipes, rooftop tanks / housings / railings / antennas / billboard frames), vertical sign clusters.
const TRIM = ['#4c4a80', '#584e80', '#424c7c', '#5a5688', '#4a4472', '#54608e'];
const RAILC = ['#7a78aa', '#3a3a62', '#8a86b4', '#4a4876'];
function tower(rng, s, za, zb, fx, depth, H, B, lights, signs, modern) {
  const seed = 0.05 + rng() * 0.9, style = rng() < 0.3 ? 1 : 0;
  const w = zb - za, zc = (za + zb) / 2;
  const X = (d) => s * (fx + d);                     // d metres behind the street face (negative = toward the street)
  const trimC = TRIM[Math.floor(rng() * TRIM.length)], railC = RAILC[Math.floor(rng() * RAILC.length)];
  const fh = 3.2;
  // ---- massing: tiers step back from the street (each: painted volume, cornice cap, corner posts)
  const nT = H > 60 ? (rng() < 0.45 ? 3 : 2) : (rng() < 0.45 ? 2 : 1);
  const fr = nT === 1 ? [1] : nT === 2 ? [0.6 + rng() * 0.22, 1] : [0.42 + rng() * 0.12, 0.72 + rng() * 0.12, 1];
  const tiers = [];
  let y0 = 0, inset = 0, wi = w, zo = 0;
  for (let t = 0; t < nT; t++) {
    const y1 = H * fr[t], dd = depth - inset, z = zc + zo;
    B.tower.add(G.box, [X(inset + dd / 2), (y0 + y1) / 2, z], [0, 0, 0], [dd, y1 - y0, wi], '#ffffff', [seed, style]);
    B.trim.add(G.box, [X(inset + dd / 2 - 0.2), y1 + 0.3, z], [0, 0, 0], [dd + 0.8, 0.6, wi + 0.8], trimC);
    for (const e of [-1, 1]) B.trim.add(G.box, [X(inset - 0.1), (y0 + y1) / 2, z + e * (wi / 2 - 0.25)], [0, 0, 0], [0.5, y1 - y0, 0.55], trimC);
    tiers.push({ y0, y1, inset, wi, z });
    const ni = 1.6 + rng() * 3.4, nw = Math.max(8, wi - (1.5 + rng() * 5));
    zo += (rng() - 0.5) * (wi - nw); inset += ni; wi = nw; y0 = y1;
  }
  const T0 = tiers[0], TL = tiers[nT - 1];
  // ---- floor bands (inked lines across the face) or vertical fins (modern)
  const fins = modern && rng() < 0.6;
  if (!fins && rng() < 0.5) {
    const every = (2 + Math.floor(rng() * 4)) * fh;
    for (const t of tiers) for (let y = t.y0 + every; y < t.y1 - 2; y += every) B.trim.add(G.box, [X(t.inset - 0.15), y, t.z], [0, 0, 0], [0.32, 0.3, t.wi - 0.6], trimC);
  }
  if (fins) {
    const sp = 2.4 + rng() * 2;
    for (const t of tiers) for (let z = t.z - t.wi / 2 + sp; z < t.z + t.wi / 2 - 1; z += sp)
      B.fin.add(G.box, [X(t.inset - 0.35), (Math.max(t.y0, 8) + t.y1) / 2, z], [0, 0, 0], [0.7, t.y1 - Math.max(t.y0, 8), 0.2], railC);
  }
  // ---- balconies (residential "mansion" towers): slab + railing panel + unit dividers, AC units and clutter on them
  const balc = !modern && !fins && rng() < 0.55 && T0.y1 > 18;
  const bTop = Math.min(T0.y1 - 2.5, 62);
  if (balc) {
    const unit = 3.4 + rng() * 1.2, bw = T0.wi - 1.0;
    for (let y = 10.2; y < bTop; y += fh) {
      B.balc.add(G.box, [X(-0.6), y, T0.z], [0, 0, 0], [1.2, 0.2, bw], trimC);
      B.balc.add(G.box, [X(-1.16), y + 0.55, T0.z], [0, 0, 0], [0.08, 0.9, bw], railC);
      for (let z = T0.z - bw / 2 + unit; z < T0.z + bw / 2 - 0.5; z += unit) B.balc.add(G.box, [X(-0.6), y + 0.75, z], [0, 0, 0], [1.2, 1.3, 0.1], trimC);
      if (rng() < 0.45) {   // an AC unit or a planter on this floor
        const z = T0.z + (rng() - 0.5) * (bw - 1.2);
        if (rng() < 0.6) B.props.add(G.box, [X(-0.75), y + 0.42, z], [0, 0, 0], [0.5, 0.6, 0.8], '#8a88b0');
        else B.props.add(G.sph, [X(-0.8), y + 0.4, z], [0, 0, 0], [0.35, 0.35, 0.35], '#2f6a6a');
      }
    }
  }
  // ---- AC units on brackets + drain pipes on the face
  if (!balc) {
    const nac = 3 + Math.floor(rng() * 12);
    for (let i = 0; i < nac; i++) {
      const fl = Math.floor(rng() * Math.max(1, (Math.min(T0.y1, 70) - 10) / fh)), y = 9.4 + fl * fh, z = T0.z + (rng() - 0.5) * (T0.wi - 2);
      if (y > T0.y1 - 2) continue;
      B.props.add(G.box, [X(-0.27), y, z], [0, 0, 0], [0.55, 0.62, 0.85], '#8a88b0');
      B.props.add(G.cyl, [X(-0.56), y, z + 0.08], [0, 0, Math.PI / 2], [0.21, 0.03, 0.21], '#26243e');
      B.props.add(G.box, [X(-0.2), y - 0.36, z], [0, 0, 0], [0.4, 0.06, 0.7], '#26243e');
    }
  }
  const npipe = 1 + Math.floor(rng() * 2.4);
  for (let i = 0; i < npipe; i++) {
    const z = T0.z + (rng() < 0.5 ? -1 : 1) * (T0.wi / 2 - 0.9 - rng() * 1.5), r = 0.1 + rng() * 0.08, ph = T0.y1 - 1;
    B.props.add(G.cyl6, [X(balc ? -1.3 : -0.25), ph / 2, z], [0, 0, 0], [r, ph, r], '#55547e');
    for (let y = 8 + rng() * 6; y < ph - 3; y += 6 + rng() * 10) B.props.add(G.cyl6, [X(balc ? -1.3 : -0.25), y, z - 0.6], [Math.PI / 2, 0, 0], [r * 0.8, 1.2, r * 0.8], '#55547e');
  }
  // ---- external zigzag stairs on one end of the face
  if (!modern && !balc && rng() < 0.4 && T0.y1 > 16) {
    const ez = rng() < 0.5 ? T0.z - T0.wi / 2 + 1.0 : T0.z + T0.wi / 2 - 1.0, dz = ez < T0.z ? 1 : -1, run = 3.4;
    const top = Math.min(T0.y1 - 2, 42), stC = '#3c3a64';
    for (const zz of [ez, ez + dz * (run + 1.0)]) B.stair.add(G.box, [X(-1.65), (3 + top) / 2, zz], [0, 0, 0], [0.16, top - 3, 0.16], stC);
    for (let y = 3.2, k = 0; y < top - 0.1; y += fh / 2, k++) {
      const zA = k % 2 ? ez + dz * (run + 1.0) : ez, zB = k % 2 ? ez : ez + dz * (run + 1.0);
      B.stair.add(G.box, [X(-0.85), y, zA], [0, 0, 0], [1.6, 0.16, 1.2], stC);                  // landing
      B.stair.add(G.box, [X(-1.62), y + 0.5, zA], [0, 0, 0], [0.06, 1.0, 1.2], railC);           // landing rail
      if (y + fh / 2 < top) {
        const dzs = zB - zA, dy = fh / 2, L = Math.hypot(dzs, dy), ang = -Math.atan(dy / dzs);
        B.stair.add(G.box, [X(-0.85), y + dy / 2, (zA + zB) / 2], [ang, 0, 0], [1.1, 0.14, L], stC);   // flight
        B.stair.add(G.box, [X(-1.5), y + dy / 2 + 0.9, (zA + zB) / 2], [ang, 0, 0], [0.06, 0.07, L], railC);   // hand rail
      }
    }
  }
  // ---- rooftop: railing, stair/lift housing, water tank, condensers, antennas, dishes, billboard frame
  const top = TL.y1 + 0.6, rdd = depth - TL.inset, rxc = X(TL.inset + rdd / 2);
  B.trim.add(G.box, [X(TL.inset + 0.25), top + 0.5, TL.z], [0, 0, 0], [0.08, 1.0, TL.wi - 0.4], railC);
  for (const e of [-1, 1]) B.trim.add(G.box, [rxc, top + 0.5, TL.z + e * (TL.wi / 2 - 0.2)], [0, 0, 0], [rdd - 0.4, 1.0, 0.08], railC);
  if (rng() < 0.7) B.trim.add(G.box, [X(TL.inset + rdd * (0.55 + rng() * 0.2)), top + 1.8, TL.z + (rng() - 0.5) * (TL.wi - 5)], [0, 0, 0], [3.2, 3.6, 4.2], trimC);
  const rx = X(TL.inset + rdd * (0.3 + rng() * 0.4)), rz = TL.z + (rng() - 0.5) * TL.wi * 0.5;
  if (rng() < 0.65) {
    B.props.add(G.cyl, [rx, top + 3.5, rz], [0, 0, 0], [1.5, 2.6, 1.5], '#5c5a88');
    B.props.add(G.sph, [rx, top + 4.8, rz], [0, 0, 0], [1.5, 0.5, 1.5], '#4c4a76');
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.props.add(G.box, [rx + dx, top + 1.1, rz + dz], [0, 0, 0], [0.15, 2.2, 0.15], '#33325a');
  }
  for (let i = 0, n = Math.floor(rng() * 4); i < n; i++)
    B.props.add(G.box, [X(TL.inset + 1.5 + rng() * (rdd - 3)), top + 0.45, TL.z + (rng() - 0.5) * (TL.wi - 3)], [0, rng() * 0.3, 0], [1.0, 0.9, 1.3], '#7a78a4');
  if (rng() < 0.55) {
    const ah = 6 + rng() * 14, ax = X(TL.inset + rdd * (0.2 + rng() * 0.6)), az = TL.z + (rng() - 0.5) * TL.wi * 0.6;
    B.props.add(G.cyl6, [ax, top + ah / 2, az], [0, 0, 0], [0.12, ah, 0.12], '#2c2a4a');
    for (let k = 1; k <= 3; k++) B.props.add(G.box, [ax, top + ah * (0.45 + k * 0.13), az], [0, 0, 0], [1.6 - k * 0.35, 0.06, 0.06], '#2c2a4a');
    B.props.add(G.sph, [ax, top + ah, az], [0, 0, 0], [0.35, 0.35, 0.35], '#ff3b3b', [2.6, 0]);
  }
  if (rng() < 0.3) B.props.add(G.sph, [X(TL.inset + 1.4), top + 1.2, TL.z + (rng() - 0.5) * (TL.wi - 3)], [0, 0, s * 0.6], [0.7, 0.18, 0.7], '#9a98c0');
  if (rng() < 0.24 && TL.wi > 12) {
    const bw = Math.min(TL.wi - 2, 12), bh = 5, bx = X(TL.inset + 2);
    for (let k = -1; k <= 1; k += 2) B.stair.add(G.box, [bx + s * 0.6, top + bh / 2 + 1, TL.z + k * bw * 0.4], [0, 0, 0], [0.25, bh + 2, 0.25], '#2c2a4a');
    for (let k = -1; k <= 1; k += 2) B.stair.add(G.box, [bx + s * 0.6, top + 1.2 + bh / 2, TL.z + k * bw * 0.2], [k * 0.75, 0, 0], [0.12, 0.12, bw * 0.55], '#2c2a4a');
    B.stair.add(G.box, [bx + s * 0.6, top + 1.0, TL.z], [0, 0, 0], [0.2, 0.2, bw], '#2c2a4a');
    signs.push({ kind: 'flat', s, x: bx - s * 0.2, y: top + 1 + bh / 2 + 0.6, z: TL.z, w: bh * 0.75, word: WORDS[Math.floor(rng() * WORDS.length)], horiz: bw });
  }
  // ---- blade signs projecting toward the street
  const nb = Math.floor(rng() * 3.2) + (w > 16 ? 1 : 0);
  const minY = modern ? 7.5 : 11;
  let y = minY + rng() * 4;
  for (let i = 0; i < nb && y < Math.min(T0.y1 - 6, 52); i++) {
    const word = WORDS[Math.floor(rng() * WORDS.length)];
    const sw = 1.7 + rng() * 1.5;
    const z = za + 1.2 + rng() * (w - 2.4);
    signs.push({ kind: 'blade', s, x: s * (fx - (balc ? 1.3 : 0.35) - sw / 2), y, z, w: sw, word });
    y += 4 + rng() * 10 + [...word].length * sw * 0.9;
  }
  // ---- vertical sign cluster (tate-kanban stack of small lightboxes) or one flat wall sign
  if (!modern && T0.y1 > 26 && rng() < 0.45) {
    const n = 3 + Math.floor(rng() * 4), sw = 1.5 + rng() * 0.6, z = T0.z + (rng() < 0.5 ? -1 : 1) * (T0.wi / 2 - 1.6);
    let yy = 9.5 + rng() * 4;
    for (let i = 0; i < n && yy < T0.y1 - 3; i++) {
      const word = WORDS[Math.floor(rng() * 8)];
      signs.push({ kind: 'flat', s, x: s * (fx - (balc ? 1.35 : 0.12)), y: yy + sw * 0.6, z, w: sw, word });
      yy += sw * 1.45 + 0.25;
    }
  } else if (rng() < 0.55) {
    const word = WORDS[Math.floor(rng() * WORDS.length)];
    signs.push({ kind: 'flat', s, x: s * (fx - (balc ? 1.35 : 0.12)), y: minY + 2 + rng() * 25, z: zc + (rng() - 0.5) * (w - 6), w: 2.2 + rng() * 1.8, word });
  }
}

// back-row towers: taller, simpler, painted only (they read as layered skyline above the front row and fade in the haze)
function backTower(rng, s, z, B) {
  const seed = 0.05 + rng() * 0.9, style = rng() < 0.3 ? 1 : 0;
  const fx = 48 + rng() * 40, depth = 24 + rng() * 26, w = 16 + rng() * 26, H = 75 + Math.pow(rng(), 1.3) * 150;
  const xc = s * (fx + depth / 2);
  const h1 = rng() < 0.6 ? H * (0.6 + rng() * 0.25) : H;
  B.tower.add(G.box, [xc, h1 / 2, z], [0, 0, 0], [depth, h1, w], '#ffffff', [seed, style]);
  B.tower.add(G.box, [xc, h1 + 0.4, z], [0, 0, 0], [depth + 0.6, 0.8, w + 0.6], '#ffffff', [seed, -1]);
  if (h1 < H) {
    const i = 2 + rng() * 4;
    B.tower.add(G.box, [xc + s * i * 0.5, (h1 + H) / 2, z], [0, 0, 0], [depth - i * 2, H - h1, w - i * 2], '#ffffff', [seed, style]);
  }
  if (rng() < 0.5) {
    const ah = 8 + rng() * 16;
    B.props.add(G.cyl6, [xc, H + ah / 2, z], [0, 0, 0], [0.2, ah, 0.2], '#2c2a4a');
    B.props.add(G.sph, [xc, H + ah, z], [0, 0, 0], [0.5, 0.5, 0.5], '#ff3b3b', [2.6, 0]);
  }
}

function storefront(rng, s, za, zb, B, lights) {
  const w = zb - za, zc = (za + zb) / 2;
  const tone = ['#b8d8f0', '#f0b8d8', '#f0d8a8', '#a8e8e8'][Math.floor(rng() * 4)];
  // glowing glass front + awning + stripe
  B.props.add(G.box, [s * 14.98, 2.3, zc], [0, 0, 0], [0.05, 3.8, w - 1.2], tone, [2.2, 0]);
  B.props.add(G.box, [s * 14.9, 4.6, zc], [0, 0, 0], [0.2, 0.5, w - 0.8], NEON[Math.floor(rng() * 4)], [2.5, 0]);
  B.props.add(G.box, [s * 14.4, 5.3, zc], [0, 0, -s * 0.2], [1.4, 0.12, w - 0.4], '#3a3866');
  for (let k = 0; k < Math.floor(w / 4); k++) B.props.add(G.box, [s * 14.95, 2.3, za + 0.6 + k * 4], [0, 0, 0], [0.12, 3.8, 0.18], '#2a2848');
  // interior read through the glass: shelf rows with coloured goods, a dark counter band
  for (const y of [1.1, 1.8, 2.5, 3.2]) B.props.add(G.box, [s * 14.945, y, zc], [0, 0, 0], [0.04, 0.1, w - 1.6], '#5a4a7a');
  for (let k = 0; k < Math.floor(w / 1.3); k++) for (const y of [1.3, 2.0, 2.7]) if (rng() < 0.7)
    B.props.add(G.box, [s * 14.94, y + 0.12, za + 1.0 + k * 1.3 + rng() * 0.4], [0, 0, 0], [0.03, 0.22, 0.5 + rng() * 0.4], NEON[Math.floor(rng() * 4)], [2.3, 0]);
  B.props.add(G.box, [s * 14.99, 0.45, zc], [0, 0, 0], [0.06, 0.7, w - 1.2], '#3a3460');
  lights.push({ p: V(s * 12.5, 2.4, zc), r: Math.min(14, w * 0.8), c: new THREE.Color(tone).multiplyScalar(0.45) });
  // vending machines beside the door
  if (rng() < 0.6) vending(rng, s, za + 1.2, B, lights);
}

function vending(rng, s, z, B, lights) {
  const n = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < n; i++) {
    const zz = z + i * 1.05, x = s * 14.55;
    const body = ['#d8d8ec', '#c83a4a', '#3a6ad0', '#e8e4f0'][Math.floor(rng() * 4)];
    B.props.add(G.box, [x, 0.92, zz], [0, 0, 0], [0.75, 1.84, 1.0], body);
    B.props.add(G.box, [x - s * 0.38, 1.3, zz], [0, 0, 0], [0.02, 0.95, 0.82], '#e9f6ff', [2.9, 0]);
    for (let r = 0; r < 3; r++) B.props.add(G.box, [x - s * 0.395, 1.05 + r * 0.3, zz], [0, 0, 0], [0.02, 0.08, 0.78], NEON[(r + i) % 4], [2.8, 0]);
  }
  lights.push({ p: V(s * 13.2, 1.3, z + n * 0.5), r: 4.5, c: new THREE.Color('#d8f0ff').multiplyScalar(0.55) });
}

const LANT = ['#ff5a3c', '#ff6a3a', '#ffe2b8', '#ffb35a'];
function shop(rng, s, zA, zB, fx, B, lights, T, signs) {
  const w = zB - zA, zc = (zA + zB) / 2, d = fx - 15;
  const tall = rng() < 0.18;
  const h = tall ? 9.8 : 7.0;
  const k = Math.floor(rng() * 8), cell = T.shop.cells[k];
  B.shopBody.add(G.box, [s * (15 + d / 2), h / 2, zc], [0, 0, 0], [d, h, w - 0.05], tall ? '#7c76a6' : '#5e4a6a');
  // painted front (atlas) facing the street
  const fu = (u, v) => [cell.u0 + u * (cell.u1 - cell.u0), cell.v0 + v * (cell.v1 - cell.v0)];
  B.shopFront.add(G.plane, [s * 14.97, 3.6, zc], [0, -s * Math.PI / 2, 0], [w - 0.1, 7.2, 1], '#ffffff', fu);
  if (tall) B.shopBody.add(G.box, [s * 14.98, 8.5, zc], [0, 0, 0], [0.04, 2.6, w - 0.1], '#6a6496');
  // lower eave (hisashi) with fascia board
  B.roof.add(G.box, [s * (15 - 0.62), 3.62, zc], [0, 0, s * 0.36], [1.42, 0.16, w + 0.15], '#ffffff');
  B.props.add(G.box, [s * (15 - 1.27), 3.33, zc], [0, 0, 0], [0.08, 0.2, w + 0.15], '#2a1c2a');
  if (!tall) {
    // upper roof: front + back slope, ridge cap
    const run = d * 0.45 + 0.9, rise = run * 0.5, L = Math.hypot(run, rise), ang = Math.atan2(rise, run);
    B.roof.add(G.box, [s * (15 - 0.9 + run / 2), 7.0 + rise / 2, zc], [0, 0, s * ang], [L, 0.2, w + 0.3], '#ffffff');
    B.roof.add(G.box, [s * (15 - 0.9 + run * 1.5), 7.0 + rise / 2, zc], [0, 0, -s * ang], [L, 0.2, w + 0.3], '#ffffff');
    B.props.add(G.box, [s * (15 - 0.9 + run), 7.0 + rise + 0.1, zc], [0, 0, 0], [0.4, 0.35, w + 0.4], '#2a2846');
    // onigawara end tiles
    for (const e of [-1, 1]) B.props.add(G.box, [s * (15 - 0.9 + run), 7.0 + rise + 0.3, zc + e * (w / 2 + 0.2)], [0, 0, 0], [0.5, 0.6, 0.2], '#2a2846');
  } else {
    B.shopBody.add(G.box, [s * (15 + d / 2), h + 0.3, zc], [0, 0, 0], [d + 0.2, 0.6, w + 0.1], '#4a4670');
    signs.push({ kind: 'flat', s, x: s * 14.9, y: 8.5, z: zc, w: 1.3, word: WORDS[Math.floor(rng() * WORDS.length)], horiz: Math.min(w - 1.5, 4.5) });
  }
  // kanban board above the eave
  if (rng() < 0.65) {
    const word = WORDS[Math.floor(rng() * WORDS.length)], bc = T.board.cells[word];
    const bw = Math.min(w - 1.2, 3.4), bh = bw * 0.32;
    B.props.add(G.box, [s * 14.9, 4.45, zc], [0, 0, 0], [0.12, bh + 0.16, bw + 0.16], '#24161e');
    B.boards.add(G.plane, [s * 14.83, 4.45, zc], [0, -s * Math.PI / 2, 0], [bw, bh, 1], '#ffffff',
      (u, v) => [bc.u0 + u * (bc.u1 - bc.u0), bc.v0 + v * (bc.v1 - bc.v0)]);
    lights.push({ p: V(s * 14.2, 4.6, zc), r: 3.5, c: new THREE.Color('#ffd8a0').multiplyScalar(0.25) });
  }
  // chochin lanterns under the eave
  if (rng() < 0.8) {
    const n = rng() < 0.5 ? 1 : 2, big = rng() < 0.35;
    const col = LANT[Math.floor(rng() * LANT.length)];
    for (let i = 0; i < n; i++) {
      const z = n === 1 ? zc + (rng() - 0.5) * w * 0.4 : zc + (i ? 1 : -1) * w * 0.28;
      const sc = big ? [0.46, 0.66, 0.46] : [0.32, 0.44, 0.32], x = s * 14.05, y = 2.55;
      const sw = [3.4, 0.05 + rng() * 0.03, rng() * 6.28, 1];      // pendulum from the eave hook, on twos
      B.props.add(G.sph, [x, y, z], [0, 0, 0], sc, col, [0, 2.5], sw);
      B.props.add(G.cyl, [x, y + sc[1] * 0.92, z], [0, 0, 0], [sc[0] * 0.55, 0.1, sc[0] * 0.55], '#1c1420', null, sw);
      B.props.add(G.cyl, [x, y - sc[1] * 0.92, z], [0, 0, 0], [sc[0] * 0.55, 0.1, sc[0] * 0.55], '#1c1420', null, sw);
      B.props.add(G.box, [x, (y + 3.4) / 2 + sc[1] * 0.5, z], [0, 0, 0], [0.03, 3.4 - y - sc[1], 0.03], '#1c1420', null, sw);
      lights.push({ p: V(x - s * 0.4, y, z), r: big ? 7 : 5, c: new THREE.Color(col).multiplyScalar(big ? 0.65 : 0.45) });
    }
  }
  // noren at the door
  if (rng() < 0.7) {
    const nc = T.noren.cells[Math.floor(rng() * T.noren.cells.length)];
    const nw = Math.min(w * 0.45, 2.4), n = nw > 1.8 ? 4 : 3, sw = nw / n, z0 = zc + (rng() - 0.5) * (w - nw) * 0.6 - nw / 2;
    const ph0 = rng() * 6.28;
    for (let i = 0; i < n; i++) {
      const tilt = (rng() - 0.5) * 0.06;
      B.noren.add(G.plane, [s * 14.7, 2.42, z0 + sw * (i + 0.5)], [0, -s * Math.PI / 2, tilt], [sw - 0.05, 1.1, 1], '#ffffff',
        (u, v) => [nc.u0 + ((i + u) / n) * (nc.u1 - nc.u0), nc.v0 + (0.15 + v * 0.85) * (nc.v1 - nc.v0)], [2.97, 0.13, ph0 + i * 0.9, 0]);
    }
    B.props.add(G.cyl6, [s * 14.68, 3.0, z0 + nw / 2], [Math.PI / 2, 0, 0], [0.04, nw + 0.3, 0.04], '#2a1c2a');
  }
  // standing andon sign on the sidewalk
  if (rng() < 0.3) {
    const z = zA + 0.8 + rng() * (w - 1.6);
    B.props.add(G.box, [s * 13.9, 0.62, z], [0, 0, 0], [0.5, 1.24, 0.5], '#fff2d8', [2.8, 0]);
    B.props.add(G.box, [s * 13.9, 1.3, z], [0, 0, 0], [0.6, 0.1, 0.6], '#2a1c2a');
    lights.push({ p: V(s * 13.4, 0.8, z), r: 3, c: new THREE.Color('#ffe6b0').multiplyScalar(0.4) });
  }
  // sidewalk clutter: bikes, beer crates, potted plants
  if (rng() < 0.35) bike(B, s * (13.3 + rng() * 0.5), zA + 1 + rng() * Math.max(0.5, w - 3), rng);
  if (rng() < 0.3) {
    const z = zA + 0.6 + rng() * (w - 1.2), c = ['#c8343a', '#e0a83a', '#3a6ad0'][Math.floor(rng() * 3)];
    const n = 1 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) B.props.add(G.box, [s * 14.4, 0.17 + i * 0.33, z], [0, (rng() - 0.5) * 0.3, 0], [0.45, 0.32, 0.36], c);
  }
  if (rng() < 0.3) {
    const z = zA + 0.5 + rng() * (w - 1);
    B.props.add(G.cyl, [s * 14.5, 0.3, z], [0, 0, 0], [0.28, 0.6, 0.28], '#6a4a5a');
    B.props.add(G.sph, [s * 14.5, 0.95, z], [0, 0, 0], [0.5, 0.55, 0.5], '#2f6a6a');
  }
}

function bike(B, x, z, rng) {
  const c = ['#c8344a', '#3a8ad0', '#e8e4f0', '#2a2a48'][Math.floor(rng() * 4)];
  for (const dz of [-0.52, 0.52]) B.props.add(G.tor, [x, 0.34, z + dz], [0, Math.PI / 2, 0], [0.33, 0.33, 0.33], '#1c1a2c');
  B.props.add(G.box, [x, 0.55, z], [0.6, 0, 0], [0.05, 0.05, 0.9], c);
  B.props.add(G.box, [x, 0.6, z + 0.12], [-0.5, 0, 0], [0.05, 0.05, 0.75], c);
  B.props.add(G.box, [x, 0.85, z - 0.3], [0, 0, 0], [0.12, 0.05, 0.25], '#1c1a2c');
  B.props.add(G.box, [x, 0.95, z + 0.45], [0, 0, 0], [0.5, 0.04, 0.04], '#1c1a2c');
  B.props.add(G.box, [x, 0.8, z + 0.55], [0, 0, 0], [0.3, 0.22, 0.25], '#4a4870');   // basket
}

// signs -> geometry + lights
function buildSigns(rng, signs, T, B, lights) {
  let idx = 1;
  for (const g of signs) {
    const col = new THREE.Color(NEON[Math.floor(rng() * 4)]);
    const style = g.kind === 'blade' ? (rng() < 0.65 ? 0 : 1) : (rng() < 0.5 ? 0 : 1);
    const cell = T.sign.cells[g.word + ':' + (style ? 'box' : 'tube')];
    const id = idx++;
    const uvf = (flip) => (u, v) => [id + cell.u0 + (flip ? 1 - u : u) * (cell.u1 - cell.u0), style * 2 + cell.v0 + v * (cell.v1 - cell.v0)];
    if (g.kind === 'blade') {
      const w = g.w, h = w * cell.aspect;
      const y = g.y + h / 2;
      B.signFrame.add(G.box, [g.x, y, g.z], [0, 0, 0], [w + 0.22, h + 0.22, 0.34], '#25223e');
      B.signFrame.add(G.box, [g.x + g.s * (w / 2 + 0.25), y, g.z], [0, 0, 0], [0.5, 0.18, 0.18], '#25223e');
      B.sign.add(G.plane, [g.x, y, g.z + 0.18], [0, 0, 0], [w, h, 1], col, uvf(false));
      B.sign.add(G.plane, [g.x, y, g.z - 0.18], [0, Math.PI, 0], [w, h, 1], col, uvf(false));
      lights.push({ p: V(g.x, y, g.z), r: 9 + h * 1.1, c: col.clone().multiplyScalar(0.9) });
    } else {
      // flat sign on a facade, facing the street (normal -s x); horizontal lightboxes stack the word sideways
      const w = g.w, h = w * cell.aspect;
      if (g.horiz) {
        // horizontal lightbox: word runs along the board (height fixed, length from the word)
        const hc = T.sign.cells[g.word + ':' + (style ? 'box' : 'tube') + ':h'];
        const hh = g.w, L = Math.min(g.horiz, hh * hc.aspect);
        B.signFrame.add(G.box, [g.x + g.s * 0.1, g.y, g.z], [0, 0, 0], [0.2, hh + 0.25, L + 0.25], '#25223e');
        B.sign.add(G.plane, [g.x - g.s * 0.02, g.y, g.z], [0, -g.s * Math.PI / 2, 0], [L, hh, 1], col,
          (u, v) => [id + hc.u0 + u * (hc.u1 - hc.u0), style * 2 + hc.v0 + v * (hc.v1 - hc.v0)]);
        lights.push({ p: V(g.x - g.s * 1.5, g.y, g.z), r: 6 + L, c: col.clone().multiplyScalar(0.7) });
      } else {
        B.signFrame.add(G.box, [g.x + g.s * 0.1, g.y, g.z], [0, 0, 0], [0.2, h + 0.22, w + 0.22], '#25223e');
        B.sign.add(G.plane, [g.x - g.s * 0.02, g.y, g.z], [0, -g.s * Math.PI / 2, 0], [w, h, 1], col, uvf(false));
        lights.push({ p: V(g.x - g.s * 1.5, g.y, g.z), r: 7 + h, c: col.clone().multiplyScalar(0.75) });
      }
    }
  }
}

// ---------------------------------------------------------------- stand-in 18 m figure (test only; ronin dept owns the real one)
function standIn(A) {
  const g = new THREE.Group(); g.name = 'city_standin';
  const lac = A.celMaterial({ base: '#2C3150', shade: '#1A1C33', id: 30, rimColor: '#ff9ad0', rimWidth: 0.25, wobble: 0 });
  const lac2 = A.celMaterial({ base: '#363b5e', shade: '#1f2240', id: 31, rimColor: '#9ae0ff', rimWidth: 0.25, wobble: 0 });
  const gold = A.celMaterial({ base: '#C9A24A', shade: '#8a6a3a', id: 32 });
  const red = A.celMaterial({ base: '#8E1E26', shade: '#5a1420', id: 33, wobble: 0 });
  const eye = A.fxMaterial({ color: '#FF3B2E', intensity: 2.2, bloom: 2 });
  const add = (geo, m, p, s, r = [0, 0, 0]) => { const o = new THREE.Mesh(geo, m); o.position.set(...p); o.scale.set(...s); o.rotation.set(...r); g.add(o); return o; };
  const bx = new THREE.BoxGeometry(1, 1, 1), sp = new THREE.SphereGeometry(1, 20, 14), cy = new THREE.CylinderGeometry(1, 1, 1, 16);
  // legs (stride), feet
  add(bx, lac, [-1.5, 2.2, 1.2], [1.6, 4.4, 1.7], [0.25, 0, 0]); add(bx, lac2, [-1.5, 6.2, 0.4], [1.9, 4.0, 2.0], [-0.1, 0, 0]);
  add(bx, lac, [1.5, 2.2, -1.0], [1.6, 4.4, 1.7], [-0.2, 0, 0]); add(bx, lac2, [1.5, 6.2, -0.4], [1.9, 4.0, 2.0], [0.1, 0, 0]);
  add(bx, lac2, [-1.5, 0.35, 2.1], [2.0, 0.7, 3.2]); add(bx, lac2, [1.5, 0.35, -2.0], [2.0, 0.7, 3.2]);
  // kusazuri tassets
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(bx, i % 2 ? lac : lac2, [Math.sin(a) * 2.3, 7.4, Math.cos(a) * 1.8], [1.6, 2.6, 0.3], [0.15, a, 0]); }
  // torso (dō), sode, arms
  add(bx, lac, [0, 10.6, 0], [4.6, 4.6, 3.0]); add(bx, lac2, [0, 12.6, 0.2], [5.0, 1.4, 3.2]);
  for (const s of [-1, 1]) {
    for (let r = 0; r < 5; r++) add(bx, r % 2 ? lac : lac2, [s * 3.6, 13.2 - r * 0.85, 0], [1.8 - r * 0.05, 0.85, 2.8], [0, 0, s * 0.25]);
    add(bx, lac2, [s * 3.5, 9.2, 0.3], [1.1, 4.0, 1.1]);
  }
  // helmet: bowl, shikoro, crescent, slit
  add(sp, lac, [0, 15.8, 0], [1.6, 1.4, 1.7]);
  for (let r = 0; r < 4; r++) add(cy, r % 2 ? lac2 : lac, [0, 15.2 - r * 0.32, -0.2], [2.0 + r * 0.25, 0.3, 2.0 + r * 0.2]);
  const cres = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.12, 6, 32, Math.PI), gold); cres.position.set(0, 16.4, 1.3); cres.scale.set(1.3, 1, 1); g.add(cres);
  add(bx, eye, [0, 15.6, 1.55], [1.5, 0.12, 0.2]);
  // scarf
  const sc = add(new THREE.PlaneGeometry(1, 1, 1, 6), red, [0, 11, -2.6], [2.4, 9, 1], [0.35, 0, 0]); sc.material.side = THREE.DoubleSide;
  return g;
}

// ---------------------------------------------------------------- baked light pools on the ground (all lights, any distance)
// box: x0, z0 (first row), sx (width, + x), sz (length, signed z); returns a DataTexture (rgb x 0.5, linear)
function bakePools(lights, box, nx, nz, gain = 1) {
  const acc = new Float32Array(nx * nz * 3);
  const dx = box.sx / nx, dz = box.sz / nz;
  for (const l of lights) {
    const R = l.r * 1.25 + Math.max(0, l.p.y) * 0.5, R2 = R * R;
    const i0 = Math.max(0, Math.floor((l.p.x - R - box.x0) / dx)), i1 = Math.min(nx - 1, Math.ceil((l.p.x + R - box.x0) / dx));
    const ja = (l.p.z - R - box.z0) / dz, jb = (l.p.z + R - box.z0) / dz;
    const j0 = Math.max(0, Math.floor(Math.min(ja, jb))), j1 = Math.min(nz - 1, Math.ceil(Math.max(ja, jb)));
    if (i0 > i1 || j0 > j1) continue;
    const k = gain * 0.6 * (0.55 + 0.45 * Math.min(1, 6 / Math.max(1, l.p.y)));
    for (let j = j0; j <= j1; j++) {
      const z = box.z0 + (j + 0.5) * dz;
      for (let i = i0; i <= i1; i++) {
        const x = box.x0 + (i + 0.5) * dx;
        const d2 = (x - l.p.x) ** 2 + (z - l.p.z) ** 2 + l.p.y * l.p.y * 0.35;
        if (d2 > R2) continue;
        const f = (1 - d2 / R2) ** 2 * k, o = (j * nx + i) * 3;
        acc[o] += l.c.r * f; acc[o + 1] += l.c.g * f; acc[o + 2] += l.c.b * f;
      }
    }
  }
  const data = new Uint8Array(nx * nz * 4);
  for (let q = 0; q < nx * nz; q++) {
    for (let c = 0; c < 3; c++) { const v = acc[q * 3 + c]; data[q * 4 + c] = Math.min(255, Math.round((v / (1 + v * 0.35)) * 0.5 * 255)); }
    data[q * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, nx, nz, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  return t;
}
const setPools = (mat, tex, box, amt = 1) => { mat.uniforms.uLM.value = tex; mat.uniforms.uLMBox.value.set(box.x0, box.z0, box.sx, box.sz); mat.uniforms.uLMOn.value = amt; };

// ---------------------------------------------------------------- create
export async function create(ctx) {
  const { A, sets } = ctx;
  base();
  const rng = ctx.rng(3207);
  const T = { sign: signAtlas(), shop: shopAtlas(ctx.rng(3208)), noren: norenAtlas(), board: boardAtlas() };
  const CU = makeCU();
  const M = makeMats(A, CU);
  const root = sets.CITY;
  const street = new THREE.Group(); street.name = 'city_street';
  const causeway = new THREE.Group(); causeway.name = 'city_causeway';
  root.add(street, causeway);

  const mats = {
    tower: M.facadeMat(), tower2: M.facadeMat({ wallA: '#2c3266', wallB: '#3a3062', wallTop: '#4c5aa6' }),
    shopBody: M.celCity({ id: 10, rim: 0.3 }), shopFront: M.celCity({ id: 11, map: T.shop.col, emap: T.shop.emi, emisK: 1.25 }),
    roof: M.roofMat(), props: M.celCity({ id: 12, rim: 0.35 }), poles: M.celCity({ id: 16, rim: 0.4, rimColor: '#9ae8ff' }),
    cables: M.celCity({ id: 17, rim: 0 }), noren: M.celCity({ id: 13, map: T.noren.tex, emap: null, emisK: 0, side: THREE.DoubleSide }),
    boards: M.celCity({ id: 15, map: T.board.tex, emap: T.board.tex, emisK: 0.35 }),
    sign: M.signMat(T.sign.tex), signFrame: M.celCity({ id: 18, rim: 0.5 }), steam: M.steamMat(),
    trim: M.celCity({ id: 19, rim: 0.3 }), fin: M.celCity({ id: 21, rim: 0.35, rimColor: '#9ae8ff' }), balc: M.celCity({ id: 22, rim: 0.3 }),
    stair: M.celCity({ id: 23, rim: 0.4 }),
  };
  mats.noren.uniforms.uEmap.value = T.noren.tex; mats.noren.uniforms.uEmisK.value = 0.0;

  const newB = () => ({ tower: new MB(), trim: new MB(), fin: new MB(), balc: new MB(), stair: new MB(), shopBody: new MB(), shopFront: new MB(), roof: new MB(), props: new MB(), poles: new MB(), cables: new MB(), noren: new MB(), boards: new MB(), sign: new MB(), signFrame: new MB() });
  const flush = (B, grp, tag) => { for (const k in B) if (B[k].P.length) grp.add(B[k].mesh(mats[k], `city_${tag}_${k}`)); };

  // ============ STREET zone
  const S = { lights: [], steams: [] };
  {
    const B = newB();
    const signs = buildCity(rng, { z0: 210, z1: -720, vents: [[6.5, 41], [-8.5, -14], [3.5, -88], [9.5, 12], [-6, -150], [7, -240]] }, T, B, S.lights, S.steams);
    // a few hero signs low and close to the s03 / s06 framings (both sides near z 0..20)
    signs.push({ kind: 'blade', s: -1, x: -(15 - 0.35 - 1.3), y: 9.5, z: 16, w: 2.6, word: '居酒屋' });
    signs.push({ kind: 'blade', s: 1, x: (15 - 0.35 - 1.2), y: 13, z: 6, w: 2.4, word: '喫茶' });
    signs.push({ kind: 'blade', s: -1, x: -(15 - 0.35 - 1.1), y: 21, z: -6, w: 2.2, word: '薬' });
    signs.push({ kind: 'blade', s: 1, x: (15 - 0.35 - 1.3), y: 22, z: 24, w: 2.6, word: '湯' });
    buildSigns(rng, signs, T, B, S.lights);
    // curbs
    for (const s of [-1, 1]) B.props.add(G.box, [s * 12.1, 0.07, -255], [0, 0, 0], [0.24, 0.14, 930], '#5a5a8a');
    flush(B, street, 'st');
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30.4, 940).rotateX(-Math.PI / 2), M.streetMat());
    ground.position.set(0, 0, -255); ground.name = 'city_street_ground'; ground.frustumCulled = false;
    street.add(ground); S.ground = ground;
    const box = { x0: -15.2, z0: 215, sx: 30.4, sz: -945 };
    setPools(ground.material, bakePools(S.lights, box, 64, 1024), box);
  }
  // ============ CAUSEWAY zone
  const C = { lights: [], steams: [] };
  {
    const r2 = ctx.rng(3209);
    const B = newB();
    const signs = buildCity(r2, { z0: 270, z1: 14, vents: [[9.5, 40], [-9, 110]] }, T, B, C.lights, C.steams);
    buildSigns(r2, signs, T, B, C.lights);
    // deck parapets + rails, lamp posts every 36 m to the horizon
    const parC = '#8c86b4';
    for (const s of [-1, 1]) {
      for (let z = 8; z > -3000; z -= 60) B.props.add(G.box, [s * 13.3, 0.45, z - 30], [0, 0, 0], [0.5, 0.9, 60.2], parC);
      for (let z = 8; z > -700; z -= 3.5) B.props.add(G.box, [s * 13.3, 1.2, z], [0, 0, 0], [0.08, 0.6, 0.08], '#4a4672');
      for (let z = 8; z > -3000; z -= 100) B.props.add(G.box, [s * 13.3, 1.5, z - 50], [0, 0, 0], [0.1, 0.08, 100.1], '#4a4672');
      // deck side face + piers
      B.props.add(G.box, [s * 13.4, -0.8, -1496], [0, 0, 0], [0.4, 1.6, 3008], '#4c4878');
    }
    let side = 1;
    for (let z = -6; z > -2400; z -= 36) {
      const x = side * 12.4;
      B.poles.add(G.cyl, [x, 5, z], [0, 0, 0], [0.16, 10, 0.16], '#4a4870');
      B.poles.add(G.box, [x - side * 1.0, 9.9, z], [0, 0, -side * 0.18], [2.0, 0.12, 0.12], '#4a4870');
      B.props.add(G.box, [x - side * 1.95, 9.65, z], [0, 0, 0], [0.7, 0.2, 0.32], '#ffe2b0', [3.4, 0]);
      C.lights.push({ p: V(x - side * 2, 9, z), r: 12, c: new THREE.Color('#ffd9a0').multiplyScalar(0.35) });
      side = -side;
    }
    flush(B, causeway, 'cw');
    // ground: the last street (z 0..270) is the wet street material, the deck continues it to the horizon
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30.4, 270).rotateX(-Math.PI / 2), M.streetMat({ cross: [40, 160, 999, 999] }));
    ground.position.set(0, 0, 135); ground.frustumCulled = false; causeway.add(ground);
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(27, 3008).rotateX(-Math.PI / 2), M.streetMat({ cross: [999, 999, 999, 999], roadW: 11, asph: '#3a3666', asph2: '#4a3a6a', walk: '#5a5488' }));
    deck.position.set(0, 0.0, -1496); deck.frustumCulled = false; causeway.add(deck);
    C.deck = deck; C.ground = ground;
    { const b1 = { x0: -15.2, z0: 270, sx: 30.4, sz: -270 }, b2 = { x0: -13.5, z0: 8, sx: 27, sz: -3008 };
      setPools(ground.material, bakePools(C.lights, b1, 64, 512), b1, 0.8); setPools(deck.material, bakePools(C.lights, b2, 32, 2048), b2, 0.8); }
    // the sea (mirror at y -0.6)
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2),
      A.mirrorMaterial({ color: '#2a2c66', color2: '#3a3474', tint: '#e2d6ee', fallback: '#c09090', fresnel: 0.55, stroke: 0.8, strokeScale: 0.05, darken: 0.08, id: 122 }));
    sea.position.set(0, -0.6, -1000); sea.frustumCulled = false; causeway.add(sea);
    // far shores: three layered skyline rows on both banks (darker near, lighter + pinker far) + low horizon hills;
    // the centre of the far row stays open for the golden glow
    const fr = ctx.rng(3210);
    const rows = [
      { n: 40, x: [260, 900], z: [-250, -900], h: [14, 60], w: [18, 45], m: { wallA: '#2e2a5e', wallB: '#38306a', wallLow: '#4a3a7a', wallTop: '#4a4282', nearDark: 1, litK: 1.2 } },
      { n: 55, x: [380, 1700], z: [-950, -1900], h: [20, 95], w: [25, 60], m: { wallA: '#4a3c7c', wallB: '#56447e', wallLow: '#6a4c8a', wallTop: '#66589a', nearDark: 1, litK: 0.8 } },
      { n: 70, x: [180, 2600], z: [-2100, -3300], h: [25, 130], w: [30, 80], m: { wallA: '#7a5c98', wallB: '#8a6098', wallLow: '#9a6a9a', wallTop: '#9a7aa8', nearDark: 1, litK: 0.5 } },
    ];
    rows.forEach((R, ri) => {
      const mb = new MB();
      for (let i = 0; i < R.n; i++) {
        const sd = fr() < 0.5 ? -1 : 1, x = sd * (R.x[0] + fr() * (R.x[1] - R.x[0])), z = R.z[0] + fr() * (R.z[1] - R.z[0]);
        const h = R.h[0] + Math.pow(fr(), 1.5) * (R.h[1] - R.h[0]), w = R.w[0] + fr() * (R.w[1] - R.w[0]), seed = 0.05 + fr() * 0.9;
        mb.add(G.box, [x, h / 2 - 1, z], [0, (fr() - 0.5) * 0.3, 0], [w, h, w * (0.6 + fr() * 0.6)], '#ffffff', [seed, fr() < 0.3 ? 1 : 0]);
        if (fr() < 0.4) { const h2 = h * (0.2 + fr() * 0.3); mb.add(G.box, [x, h + h2 / 2 - 1, z], [0, 0, 0], [w * 0.6, h2, w * 0.45], '#ffffff', [seed, 0]); }
      }
      causeway.add(mb.mesh(M.facadeMat(R.m), 'city_cw_far' + ri));
    });
    const hills = new MB();
    for (let i = 0; i < 30; i++) {
      const x = (fr() - 0.5) * 6000, z = -3500 - fr() * 700, h = 12 + fr() * 40;
      if (Math.abs(x) < 250) continue;
      hills.add(G.sph, [x, -5, z], [0, 0, 0], [300 + fr() * 450, h, 140], '#ffffff', [0.5, -1]);
    }
    causeway.add(hills.mesh(M.facadeMat({ wallA: '#8a6aa0', wallB: '#9a6c9e', wallLow: '#a07098', wallTop: '#a07aa8', nearDark: 1 }), 'city_cw_hills'));
  }

  // ============ skies + cloud decks
  // night: the canyon's sky glows pink-violet near the horizon (city light under the rain clouds), deep blue overhead
  const nightSky = A.skyDome({ stops: [[-0.04, '#b674b4'], [0.07, '#7c58a8'], [0.26, '#3a3480'], [0.8, '#1d2156']], stars: 0, brush: 1.2 });
  street.add(nightSky);
  const duskDir = V(0, -0.022, -1).normalize();
  const duskSky = A.skyDome({
    stops: [[-0.03, '#ffcc90'], [0.04, '#f0a0a0'], [0.18, '#9a6aa8'], [0.6, '#2c3074']],
    disk: { dir: duskDir, radius: 0.06, color: '#fff0b8', halo: 3.0, haloColor: '#ffb060', bloom: 0.9 }, brush: 1.2,
  });
  causeway.add(duskSky);
  // painted clouds. Night: low rain strata lit pink from below. Dusk: cumulus (domed tops, flat lit bases) with gold rims
  const strata = (rngc, n, opts) => {
    const mb = new MB();
    for (let i = 0; i < n; i++) {
      const cx = opts.x(rngc), cz = opts.z(rngc), cy = opts.y(rngc), sx = opts.sx(rngc);
      const puffs = 10 + Math.floor(rngc() * 10);
      for (let k = 0; k < puffs; k++) {
        const t = (k / (puffs - 1) - 0.5), hump = 1 - Math.abs(t) * 1.4;
        const r = sx * (0.08 + rngc() * 0.1) * (0.6 + hump * 0.6);
        const py = cy + r * 0.25 * hump + rngc() * r * 0.2;
        mb.add(G.sph, [cx + t * sx + (rngc() - 0.5) * r, py, cz + (rngc() - 0.5) * sx * 0.25], [0, rngc(), 0], [r * 1.6, r * (0.35 + rngc() * 0.25) * (opts.flat ?? 1), r * 1.1], '#ffffff');
      }
    }
    return mb;
  };
  const cumulus = (rngc, n, opts) => {
    const mb = new MB();
    for (let i = 0; i < n; i++) {
      const cx = opts.x(rngc), cz = opts.z(rngc), cy = opts.y(rngc), W = opts.w(rngc), Hh = W * (0.28 + rngc() * 0.3);
      const puffs = 40 + Math.floor(rngc() * 24);
      for (let k = 0; k < puffs; k++) {
        const u = rngc() * 2 - 1, hump = Math.sqrt(Math.max(0, 1 - u * u * (0.85 + rngc() * 0.3)));
        const yk = Math.pow(rngc(), 0.75) * hump;                               // 0 base .. 1 crown
        const r = W * (0.03 + rngc() * rngc() * 0.11) * (0.55 + 0.6 * hump) * (1.15 - yk * 0.45);
        const y = cy + yk * Hh + r * 0.6;                                        // never below the base line
        const flat = yk < 0.22 ? 0.5 : 1;                                        // low puffs squashed: a flat lit base
        mb.add(G.sph, [cx + u * W * 0.5, y, cz + (rngc() - 0.5) * W * 0.18], [0, rngc() * 3, 0], [r * 1.3, r * flat, r * 0.9], '#ffffff');
      }
      for (let k = 0; k < 4; k++)                                                // flat base
        mb.add(G.sph, [cx + (rngc() - 0.5) * W * 0.6, cy + W * 0.02, cz], [0, 0, 0], [W * (0.18 + rngc() * 0.1), W * 0.035, W * 0.1], '#ffffff');
    }
    return mb;
  };
  {
    const cm = A.paintedMaterial({ color: '#5a4290', color2: '#6a4a98', shade: '#54468e', id: A.ID.CLOUD, bands: true, rim: 0.7, rimColor: '#ff9ad6', rimWidth: 0.35, varScale: 0.01, dab: 0.3, stroke: 0.7, strokeScale: 0.02 });
    cm.uniforms.uSunDir = { value: V(0.2, -1, 0.1).normalize() };
    const cr = ctx.rng(3211);
    street.add(strata(cr, 22, { x: (r) => (r() - 0.5) * 900, z: (r) => 200 - r() * 1300, y: (r) => 240 + r() * 220, sx: (r) => 160 + r() * 220 }).mesh(cm, 'city_night_clouds'));
    const dm = A.paintedMaterial({ color: '#ffb496', color2: '#ffc6a0', shade: '#7a5aa2', id: A.ID.CLOUD, bands: true, rim: 0.9, rimColor: '#ffe2a0', rimWidth: 0.4, varScale: 0.004, dab: 0.45, stroke: 0.5, strokeScale: 0.01 });
    dm.uniforms.uSunDir = { value: V(0, -0.55, -1).normalize() };            // the low sun lights the bellies peach-gold, tops stay violet
    dm.uniforms.uSunColor = { value: new THREE.Color('#ffffff') };
    const dr = ctx.rng(3212);
    causeway.add(cumulus(dr, 16, { x: (r) => (r() < 0.5 ? -1 : 1) * (120 + r() * 1300), z: (r) => -800 - r() * 1300, y: (r) => 120 + r() * 260, w: (r) => 200 + r() * 330 }).mesh(dm, 'city_dusk_clouds'));
    const dm2 = A.paintedMaterial({ color: '#c08aa8', color2: '#d498a8', shade: '#8a6aa0', id: A.ID.CLOUD, bands: true, rim: 1.2, rimColor: '#ffe0a0', rimWidth: 0.5, varScale: 0.004, dab: 0.35, stroke: 0.9, strokeScale: 0.008 });
    dm2.uniforms.uSunDir = { value: V(0, -0.1, -1).normalize() };
    causeway.add(strata(dr, 10, { x: (r) => (r() - 0.5) * 4000, z: (r) => -3000 - r() * 1200, y: (r) => 140 + r() * 200, sx: (r) => 700 + r() * 900, flat: 0.28 }).mesh(dm2, 'city_dusk_strata'));
  }

  // ============ steam plumes (crossed additive cards, drawn on threes)
  const steamMesh = (list, grp) => {
    if (!list.length) return;
    const mb = new MB();
    for (const s of list) for (const ry of [0, Math.PI / 2]) mb.add(G.plane, [s.x, s.y + s.h / 2, s.z], [0, ry + s.seed, 0], [s.w, s.h, 1], new THREE.Color(s.seed, 1, 0));
    const m = mb.mesh(mats.steam, 'city_steam'); m.renderOrder = 10; grp.add(m);
  };
  steamMesh(S.steams, street); steamMesh(C.steams, causeway);

  // ============ puddles (strong mirror patches)
  const pud = (name, x, z, rx, rz, rot = 0, strength = 1) => ({ name, x, z, rx, rz, rot, strength });
  // s08: long lens, low: the camera at P08CAM looks up the street at Sumi (~80 m away, x = -1.5, z ~ 28..36); his
  // reflection falls 4-16 m in front of the lens, so the puddle lies along that sightline (2-15 m)
  const P08CAM = V(9.5, 1.0, 110), P08TGT = V(-1.5, 0, 30);
  const u8 = P08TGT.clone().sub(P08CAM).setY(0).normalize();
  const puddles = [
    pud('s02', -3.4, 24.0, 4.6, 3.4, 0.35, 1),
    pud('s08', P08CAM.x + u8.x * 8.5, P08CAM.z + u8.z * 8.5, 2.6, 7.5, Math.atan2(-u8.x, u8.z), 1),
    pud('a', 5.5, 2, 3.2, 2.2, 0.8, 0.9), pud('b', -6.5, -30, 4.5, 2.6, -0.3, 0.9), pud('c', 2.5, -62, 3.0, 5.0, 0.2, 0.9),
    pud('d', -8.0, 48, 2.6, 1.8, 0.4, 0.9), pud('e', 8.5, -118, 4.0, 2.4, 0.1, 0.9), pud('f', -3, -190, 5.5, 3.0, -0.4, 0.9),
    pud('g', 9.0, 30, 1.8, 1.4, 0, 0.9), pud('h', -10.5, 8, 1.6, 2.6, 0, 0.9),
  ];
  const cwPuddles = [pud('cw1', 3.5, -25, 3.0, 6.0, 0.1, 0.9), pud('cw2', -5, 30, 4, 2.5, 0.6, 0.9), pud('cw3', 6, 70, 2.5, 2, 0, 0.9)];
  const setPuddles = (mat, list) => list.forEach((p, i) => { mat.uniforms.uPud.value[i].set(p.x, p.z, p.rx, p.rz); mat.uniforms.uPud2.value[i].set(p.rot, p.strength, 0, 0); });
  setPuddles(S.ground.material, puddles); setPuddles(C.ground.material, cwPuddles); setPuddles(C.deck.material, cwPuddles);

  // ============ shot framings (street frame for s02-s08, causeway frame for s11)
  const shots = {
    s02: { pos: [-1.2, 0.32, 30.8], at: [-3.4, 1.0, 21.5], fov: 34, stand: { x: -1.9, z: 20.0, ry: 0 } },
    s03: { pos: [-1.5, 3.1, 58], at: [-1.5, 10.5, 24], fov: 42, end: { pos: [-1.5, 3.3, 64], at: [-1.5, 10.5, 30] }, stand: { x: -1.5, z: 30, ry: 0 } },
    s06: { pos: [-0.4, 15.8, 41.5], at: [-1.5, 16.2, 31], fov: 28, end: { pos: [-0.5, 15.9, 39.5], at: [-1.5, 16.2, 31] }, stand: { x: -1.5, z: 31, ry: 0 } },
    s08: { pos: P08CAM.toArray(), at: [-1.0, 3.2, 30], fov: 24, end: { pos: [9.3, 1.0, 109], at: [-1.0, 3.2, 34] }, stand: { x: -1.5, z: 30, ry: 0 } },
    s11: { pos: [5, 6.5, 70], at: [0, 7.5, -120], fov: 34, end: { pos: [4.5, 6.8, 62], at: [0, 7.5, -120] }, stand: { x: 0, z: 8, ry: Math.PI }, zone: 'causeway' },
    s11b: { pos: [9, 2.6, -46], at: [-1, 10, 10], fov: 36, stand: { x: 0, z: -6, ry: Math.PI }, zone: 'causeway' },
  };

  // ============ looks (suggested; direction / look.js decides)
  const LOOKS = {
    street: {
      fog: '#7a58a6', fogDensity: 0.0036, fogNear: 45, fogMax: 0.86, celFog: 0.4,
      glows: [{ pos: V(0, 24, -760), color: '#ff86c4', size: 0.3, amount: 0.45 }, { pos: V(0, 150, -720), color: '#9a7aff', size: 0.6, amount: 0.16 }],
      bloom: 1.3, exposure: 1.05, sat: 1.12, contrast: 0.1, lift: '#1a1440', gain: '#f4f0ff', vignette: 0.2, grain: 0.03, paper: 0.025,
      inkWidth: 2.0, inkColor: '#1e1430', paintRadius: 5.5, paintFar: 260, paintFarScale: 2.0,
      mirror: { on: true, y: 0, strength: 0.45, distort: 0.35, rough: 0, ripples: [] },
    },
    causeway: {
      fog: '#b886a8', fogDensity: 0.00075, fogNear: 80, fogMax: 0.7, celFog: 0.35,
      bloom: 1.1, exposure: 1.05, sat: 1.1, contrast: 0.1, lift: '#2a1a40', gain: '#fff4ea', vignette: 0.18, grain: 0.03, paper: 0.025,
      inkWidth: 2.0, inkColor: '#22162a', paintRadius: 6, paintFar: 500, paintFarScale: 2.2,
      mirror: { on: true, y: -0.6, strength: 0.6, distort: 0.25, rough: 0.2, ripples: [] },
      glows: [{ pos: V(0, -20, -3000), color: '#ffb04a', size: 0.32, amount: 0.6 }, { pos: V(0, -60, -3000), color: '#ffc070', size: 0.9, amount: 0.16 }],
    },
  };

  // ============ stand-in
  const stand = standIn(A); stand.visible = false; root.add(stand);
  // ============ rain (replaces the FX auto rain on this set)
  const rain = cityRain(ctx, CU); root.add(rain.group);
  let fxMuted = false;

  // ============ API
  let forced = null, zoneNow = 'street';
  const api = {
    group: root, street, causeway, WALK, CWALK, puddles: [...puddles, ...cwPuddles], shots, standIn: stand,
    puddle: (name) => [...puddles, ...cwPuddles].find((p) => p.name === name),
    zone: (z) => { if (z !== undefined) forced = z; return zoneNow; },
    look: (z) => LOOKS[z ?? zoneNow],
    lights: () => (zoneNow === 'causeway' ? C.lights : S.lights),
    groundY: (x, z) => (zoneNow === 'causeway' && z < 0 && Math.abs(x) > 13.5 ? -0.6 : 0),
  };
  ctx.api.city = api;

  // light selection: nearest NL lights to a point just ahead of the camera (pure function of the camera)
  const _f = new THREE.Vector3(), _c = new THREE.Vector3(), _cam = new THREE.Object3D();
  function pickLights(list, cam, on) {
    cam.getWorldDirection(_f); _c.copy(cam.position).addScaledVector(_f, 22);
    const sorted = list.map((l) => [l.p.distanceToSquared(_c) / (l.r * l.r), l]).sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < NL; i++) {
      const l = sorted[i]?.[1];
      if (l && on) { CU.uLP.value[i].set(l.p.x, l.p.y, l.p.z, l.r); CU.uLC.value[i].copy(l.c); }
      else { CU.uLP.value[i].set(0, -9999, 0, 0.01); CU.uLC.value[i].setRGB(0, 0, 0); }
    }
  }

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function update(st) {
    if (st.set !== 'CITY') { stand.visible = false; return; }
    const q = st.q;
    const test = !!st.test;
    const cs = test ? q.get('cityshot') : null;
    const zone = forced ?? ((test && q.get('zone')) || (cs && shots[cs]?.zone) || (st.sid === 's11' ? 'causeway' : 'street'));
    zoneNow = zone;
    street.visible = zone === 'street'; causeway.visible = zone === 'causeway';
    CU.uT3.value = A.onThrees(st.t); CU.uT2.value = A.onTwos(st.t); CU.uZone.value = zone === 'causeway' ? 1 : 0;
    // test camera from the published framings
    if (cs && shots[cs]) {
      const sh = shots[cs], k = Math.min(1, Math.max(0, parseFloat(q.get('k') ?? '0')));
      const p0 = V(...sh.pos), a0 = V(...sh.at);
      if (sh.end) { p0.lerp(V(...sh.end.pos), k); a0.lerp(V(...sh.end.at), k); }
      st.cam.pos = p0; st.cam.look = a0; st.cam.fov = sh.fov;
    }
    // stand-in: test mode only (ronin dept owns the real figures)
    const wantStand = test && (q.get('stand') ?? (ctx.api.ronin ? '0' : '1')) === '1';
    stand.visible = wantStand;
    if (wantStand) {
      const sp = cs && shots[cs] ? shots[cs].stand : { x: zone === 'causeway' ? CWALK.x : WALK.x, z: 30, ry: zone === 'causeway' ? Math.PI : 0 };
      stand.position.set(parseFloat(q.get('sx') ?? sp.x), 0, parseFloat(q.get('sz') ?? sp.z)); stand.rotation.y = sp.ry;
    }
    _cam.position.copy(st.cam.pos); _cam.lookAt(st.cam.look);
    pickLights(zone === 'causeway' ? C.lights : S.lights, _cam, !(test && q.get('lights') === '0'));
    // the set's look: CITY keys the direction left at the preset value take the zone look (the causeway needs mirror y -0.6)
    if (st.look && !(test && q.get('citylook') === '0')) {
      const L = LOOKS[zone], P = LOOK_PRESETS.CITY ?? {};
      for (const k in L) if (st.look[k] === undefined || same(st.look[k], P[k] ?? A.LOOK_DEFAULTS?.[k])) st.look[k] = L[k];
      if (zone === 'causeway' && st.look.mirror) st.look.mirror = { ...st.look.mirror, y: -0.6 };
    }
    // cel self-haze follows the frame's fog (cels only get celFog in the post)
    const LK = st.look ?? LOOKS[zone];
    CU.uHaze.value.set(LK.fog ?? '#7a58a6');
    CU.uHazeP.value.set(LK.fogDensity ?? 0.004, LK.fogNear ?? 30, LK.fogMax ?? 0.85, 1 - (LK.celFog ?? 0.4));
    // rain: CITY draws its own (fine, layered); the FX auto rain is muted for the set
    if (ctx.api.fx?.mute && !fxMuted) { ctx.api.fx.mute('rain'); fxMuted = true; }
    _cam.getWorldDirection(_f);
    const ra = test && q.get('rain') != null ? parseFloat(q.get('rain')) : zone === 'causeway' ? 0.5 : 1;
    rain.update(st, _f, st.cam.fov ?? 40, ra, LK.fog);
  }
  return { update };
}
