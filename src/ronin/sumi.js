// ronin/sumi.js - SUMI 墨, the heavy black ronin (18 m). Model space: metres, ground y=0, facing +Z, left = +X.
// Silhouette: massive inverted triangle - huge flared sode, keeled barrel chest, heavy flared gauntlets, short
// powerful legs in tapered haidate + ridged suneate, toe-plated sabatons. Frame only shows at the joints.
import * as THREE from 'three';
import { sheet, sub, bandFn, domeFn, plateFn, tube, lathe, ext, box, cyl, sphere, sblob, crescentPts, mats, lameTexture, wrapTexture, setEdge, T, xf, Builder } from './kit.js';
import { laces, trim, pins, rows, hand, piston, cables, sword, scabbard, frameAt } from './parts.js';
import { Rig, Ribbon, Blade } from './rig.js';

const PI = Math.PI;
const ss = THREE.MathUtils.smoothstep;
export const SUMI_DIMS = {
  pelvis: [0, 8.9, 0], spine: [0, 9.9, 0], chest: [0, 11.2, 0], neck: [0, 14.3, 0], head: [0, 14.85, 0.1],
  clav: [1.1, 13.6, 0], shoulder: [3.05, 13.5, 0], elbow: [3.05, 10.45, 0], wrist: [3.05, 7.55, 0], hand: 1.4,
  hip: [1.3, 8.45, 0], knee: [1.3, 4.75, 0], ankle: [1.3, 1.15, 0], toe: [1.3, 0.38, 1.3],
  sode: { rows: 5, x: 4.2, y: 14.45, z: 0.05, rowH: 0.82 },
  kusa: { n: 6, angles: [0.42, -0.42, 1.42, -1.42, 2.5, -2.5], rx: 1.9, rz: 1.5, y: 9.45, len: 3.3, clear: 1.05 },
  sliver: 0.5,
};

export function buildSumi(A) {
  const lame = lameTexture({ cols: 12, line: '#3a3c66', band: true });
  const lame2 = lameTexture({ cols: 9, line: '#3a3c66', band: true });
  // deep indigo lacquer: lit side mid-indigo (so the ink line reads), shade deep indigo, gold highlight band,
  // thin warm rim on the dark side; bevelled plate edges lit lavender-blue (setEdge)
  const LQ = { base: '#34364e', shade: '#0f0f22', rimColor: '#ffb27a', highlight: 0.9, hiSize: 0.985, hiColor: '#ffd884', rimWidth: 0.15, wobble: 0.2 };
  const M = mats(A, {
    lacqA: { ...LQ, base: '#565a80', shade: '#1b1b3c', hiColor: '#ffe39a', highlight: 0.3, id: 30, map: lame },
    lacqB: { ...LQ, base: '#565a80', shade: '#1b1b3c', hiColor: '#ffe39a', highlight: 0.3, id: 31, map: lame2 },
    plain: { ...LQ, id: 32 },
    face: { base: '#2c2d46', shade: '#0c0c1e', id: 33, wobble: 0.35, rimColor: '#ffb27a', highlight: 0.9, hiSize: 0.97, hiColor: '#f2cf78', rimWidth: 0.15 },
    lace: { base: '#B02A32', shade: '#5e1224', id: 34, rimColor: '#ff9a7a', highlight: 0.35, hiColor: '#ffb0a0' },
    gold: { base: '#D4AA4E', shade: '#7a532a', id: 36, rimColor: '#fff0c0', highlight: 0.95, hiSize: 0.88, hiColor: '#fff6d0' },
    frame: { base: '#454654', shade: '#1d1d28', id: 38, rimColor: '#ffb27a', highlight: 0.5, hiSize: 0.9, hiColor: '#b8b8d8', rimWidth: 0.12 },
    steel: { base: '#8a8ea4', shade: '#44465c', id: 39, rimColor: '#e0e4ff', highlight: 0.8, hiSize: 0.9 },
    scarf: { base: '#9E2029', shade: '#4e0e1e', id: 40, rimColor: '#ff9a7a', highlight: 0.25, hiColor: '#ff8080', side: THREE.DoubleSide },
    blade: { base: '#d3dae9', shade: '#6f7a99', id: 44, rimColor: '#ffffff', highlight: 1, hiSize: 0.86, hiColor: '#ffffff' },
    edge: { base: '#f6f9ff', shade: '#c4cce4', id: 45, rimColor: '#ffffff', highlight: 1, hiSize: 0.8, hiColor: '#ffffff' },
    saya: { base: '#2c3263', shade: '#100f2a', id: 46, rimColor: '#ffb27a', highlight: 0.95, hiSize: 0.88, hiColor: '#f2cf78' },
    wrap: { base: '#ffffff', shade: '#9a8ab0', id: 47, map: wrapTexture({ wrap: '#1c1828', diamond: '#d8c27a' }), highlight: 0.2 },
    eye: { fx: true, color: '#FF3B2E', intensity: 2.2, bloom: 1.6, id: 91 },
  });
  M.steel2 = M.steel; M.bladeSteel = M.blade;
  setEdge([2.5, 2.4, 2.9]);
  const rig = new Rig({ name: 'SUMI', dims: SUMI_DIMS, defaults: {} });
  const J = rig.J, d = SUMI_DIMS;
  for (const g of rig.kusa) { g.rotation.order = 'YXZ'; g.rotation.y = g.userData.a; }
  rig.root.updateMatrixWorld(true);
  const B = new Builder();
  const S = (f, nu, nv, th, bev = 0.12) => sheet(f, nu, nv, th, { bev, bevD: th * 0.8 });

  // ================================================================= HEAD
  const H = J.head;
  B.add(H, M.frame, sphere(1.0, 16, 12), T([0, 15.3, 0.05]));
  const bowl = domeFn({ rx: 1.22, ry: 0.98, rz: 1.32, cy: 15.82, cz: 0.02 });
  B.add(H, M.plain, sheet(bowl, 32, 9, 0.12, { closeU: true }));
  for (let i = 0; i < 18; i++) { const u = i / 18; B.add(H, M.face, sheet(sub(bowl, u - 0.007, u + 0.007, 0.02, 0.9, 0.035), 1, 6, 0.04)); }
  B.add(H, M.gold, cyl(0.22, 0.3, 0.12, 16), T([0, 16.8, 0.02]));
  const brim = bandFn({ y0: 15.64, y1: 15.9, rx0: 1.66, rz0: 1.9, rx1: 1.22, rz1: 1.34, a0: -1.25, a1: 1.25, cz: 0.02 });
  B.add(H, M.plain, S(brim, 18, 2, 0.1, 0.2));
  trim(B, H, M.gold, brim, 0, 0.16, 0.012, 0.05);
  // shikoro: 4 flared rows (each lower row flares further out and down)
  const shik = [0, 1, 2, 3].map((i) => bandFn({ y0: 15.1 - i * 0.44, y1: 15.78 - i * 0.44, rx0: 1.62 + i * 0.4, rz0: 1.62 + i * 0.34, rx1: 1.26 + i * 0.36, rz1: 1.3 + i * 0.31, a0: 0.95 - i * 0.03, a1: 2 * PI - 0.95 + i * 0.03, cz: -0.08 - i * 0.05, flare: 0.08 }));
  rows(B, H, M, shik, { thick: 0.1, nu: 22, cols: 11, side: 1 });
  for (const s of [1, -1]) {
    const f = plateFn({ w: 0.95, h: 1.1, cr: 1.3, crV: 2.0 });
    const Mt = T([1.42, 15.98, 0.66], [0.1, 0.66, -0.24]);
    B.add(H, M.lacqA, S(xf(f, Mt), 5, 3, 0.09, 0.16), null, s);
    B.add(H, M.gold, sheet(sub(xf(f, Mt), 0.0, 0.14, 0, 1, 0.02), 1, 3, 0.05), null, s);
    B.add(H, M.gold, sphere(0.07, 8, 6), T(new THREE.Vector3(...xf(f, Mt)(0.6, 0.55)).toArray()), s);
  }
  // maedate: golden crescent wider than the head on a lacquer plaque
  B.add(H, M.gold, ext(crescentPts(4.4, 1.8, 0.3), 0.12, { bevel: 0.03 }), T([0, 16.06, 1.36], [-0.2, 0, 0]));
  B.add(H, M.face, ext([[-0.28, 0], [0.28, 0], [0.2, 0.42], [-0.2, 0.42]], 0.12, { bevel: 0.03 }), T([0, 15.86, 1.33], [-0.2, 0, 0]));
  B.add(H, M.gold, sphere(0.1, 10, 8), T([0, 16.06, 1.42]));
  // menpo: brow ridge, eye recess, keeled mask, jaw plates, mouth vents
  const brow = bandFn({ y0: 15.5, y1: 15.68, rx0: 1.06, rz0: 1.3, rx1: 1.04, rz1: 1.28, a0: -0.95, a1: 0.95, cz: 0.02, bulge: 0.05, keel: 0.06 });
  B.add(H, M.face, S(brow, 16, 2, 0.1, 0.2));
  B.add(H, M.frame, sheet(bandFn({ y0: 15.3, y1: 15.52, rx0: 0.98, rz0: 1.18, a0: -0.95, a1: 0.95, cz: 0.02 }), 14, 1, 0.08));
  const slit = bandFn({ y0: 15.405, y1: 15.485, rx0: 1.0, rz0: 1.215, a0: -0.62, a1: 0.62, cz: 0.02 });
  const eyeMesh = new THREE.Mesh(sheet(slit, 18, 1, 0.03), M.eye);
  const mask = (u, v) => { const x = (u - 0.5) * 2, w = 0.62 + 0.4 * v; const y = 14.42 + v * 0.95; const z = 0.02 + 1.1 + 0.32 * (1 - v) * (1 - v) - Math.pow(Math.abs(x), 1.4) * 0.62 * (0.7 + 0.3 * v); return [x * w, y, z]; };
  B.add(H, M.face, S(mask, 10, 6, 0.1, 0.14));
  B.add(H, M.plain, sheet(sub(mask, 0.47, 0.53, 0.42, 0.98, 0.07), 1, 4, 0.08));
  for (const s of [1, -1]) B.add(H, M.lacqB, S((u, v) => { const p = mask(0.06 + u * 0.3, 0.05 + v * 0.62); return [p[0] - 0.05, p[1], p[2] + 0.07]; }, 3, 3, 0.08, 0.2), null, s);
  for (let i = 0; i < 3; i++) B.add(H, M.frame, sblob(0.21 - i * 0.04, 0.02, 0.05, 0.4), T([0, 14.72 - i * 0.09, 1.4 + 0.03 * i]));
  const yod = [0, 1].map((i) => bandFn({ y0: 13.88 - i * 0.42, y1: 14.48 - i * 0.42, rx0: 1.24 + i * 0.18, rz0: 1.28 + i * 0.14, rx1: 1.0 + i * 0.16, rz1: 1.12 + i * 0.12, a0: -1.3, a1: 1.3, cz: 0.12, keel: 0.1 }));
  rows(B, H, M, yod, { thick: 0.08, nu: 16, cols: 8 });
  B.add(J.neck, M.frame, cyl(0.62, 0.72, 1.3, 14), T([0, 14.45, 0]));
  cables(B, J.neck, M.frame, [0.5, 14.9, -0.5], [0.6, 13.9, -0.6], 3, 0.07, 0.15, 0.18);

  // ================================================================= TORSO (keeled barrel chest, inverted triangle)
  const C = J.chest;
  const rxAt = (y) => 1.62 + 0.95 * ss(y, 10.3, 13.0) - 0.45 * ss(y, 13.15, 14.0);
  B.add(C, M.frame, sphere(1, 18, 12), T([0, 12.2, 0], [0, 0, 0], [2.05, 1.95, 1.45]));
  for (let i = 4; i >= 0; i--) {
    const y0 = 10.5 + i * 0.5, y1 = y0 + 0.64, v = i / 4;
    const f = bandFn({ y0, y1, rx0: rxAt(y0) + 0.12, rz0: (rxAt(y0) + 0.12) * 0.7, rx1: rxAt(y1), rz1: rxAt(y1) * 0.68, a0: -PI, a1: PI, p: 2.5, keel: 0.12 + 0.2 * v, keelP: 4, flare: 0.06 });
    B.add(C, i % 2 ? M.lacqB : M.plain, sheet(f, 44, 2, 0.13, { closeU: true, bev: 0.18, bevD: 0.1 }));
    laces(B, C, M.lace, f, { cols: 14, v0: 0.35, v1: 1.0, w: 0.0042, gap: 0.0085, lift: 0.04 });
  }
  // munaita: big keeled chest plate, flared top edge, gold trims
  const muna = bandFn({ y0: 12.95, y1: 14.0, rx0: rxAt(12.95) + 0.22, rz0: (rxAt(12.95) + 0.22) * 0.72, rx1: 1.6, rz1: 1.18, a0: -1.3, a1: 1.3, bulge: 0.1, p: 2.4, keel: 0.38, keelP: 4 });
  B.add(C, M.plain, S(muna, 22, 4, 0.15, 0.14));
  trim(B, C, M.gold, muna, 0.86, 1, 0.025, 0.06);
  trim(B, C, M.gold, muna, 0, 0.08, 0.025, 0.05);
  pins(B, C, M.gold, muna, [[0.12, 0.5], [0.88, 0.5]], 0.09);
  const back = bandFn({ y0: 12.95, y1: 14.0, rx0: rxAt(12.95) + 0.22, rz0: (rxAt(12.95) + 0.22) * 0.72, rx1: 1.6, rz1: 1.18, a0: PI - 1.35, a1: PI + 1.35, bulge: 0.08, p: 2.4 });
  B.add(C, M.plain, S(back, 22, 4, 0.15, 0.14));
  for (const s of [1, -1]) {
    const strap = (u, v) => { const z = (u - 0.5) * 2.6; return [1.3 + 0.12 * Math.cos(z) - 0.42 + v * 0.84, 14.05 - z * z * 0.12, z]; };
    B.add(C, M.lacqB, S(strap, 10, 1, 0.16, 0.2), null, s);
    B.add(C, M.gold, sphere(0.1, 8, 6), T([1.3, 14.18, 1.02]), s);
    B.add(C, M.gold, sphere(0.1, 8, 6), T([1.3, 14.18, -1.02]), s);
    // shoulder yoke: heavy rounded pauldron cap under the sode crown (widens the top of the triangle)
    B.add(C, M.plain, sheet(domeFn({ rx: 1.25, ry: 0.8, rz: 1.25, cx: 2.55, cy: 13.75, l0: -0.25, l1: 1.3, a0: -1.9, a1: 1.9 }), 14, 5, 0.12, { bev: 0.15 }), null, s);
    trim(B, C, M.gold, domeFn({ rx: 1.25, ry: 0.8, rz: 1.25, cx: 2.55, cy: 13.75, l0: -0.25, l1: 1.3, a0: -1.9, a1: 1.9 }), 0, 0.1, 0.02, 0.05, s, 14);
  }
  // keel ridge down the chest with gold trim
  const keel = (u, v) => { const x = (u - 0.5) * 0.5, y = 10.55 + v * 2.45; const rz = rxAt(y) * 0.68 + 0.12 + 0.32 * (i => i)(v) * 0.6; return [x, y, rz + 0.2 * (1 - Math.abs(u - 0.5) * 2) + 0.05]; };
  B.add(C, M.face, S(keel, 2, 8, 0.12, 0.2));
  B.add(C, M.gold, sheet(sub(keel, 0.47, 0.53, 0, 1, 0.03), 1, 8, 0.04));
  const eri = bandFn({ y0: 13.85, y1: 14.55, rx0: 1.38, rz0: 1.16, rx1: 1.16, rz1: 1.0, a0: -PI, a1: PI, p: 2.3 });
  B.add(C, M.lacqB, sheet(eri, 28, 2, 0.12, { closeU: true, bev: 0.2 }));
  trim(B, C, M.gold, eri, 0.86, 1, 0.02, 0.05, 1, 28);
  B.add(C, M.lace, tube([[0, 12.6, -1.72], [0.45, 12.9, -1.78], [0.55, 12.4, -1.8], [0, 12.6, -1.72], [-0.45, 12.9, -1.78], [-0.55, 12.4, -1.8], [0, 12.6, -1.72]], [0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08], 6, { sub: 2 }));
  B.add(C, M.scarf, sheet(bandFn({ y0: 13.95, y1: 14.75, rx0: 1.46, rz0: 1.28, rx1: 1.24, rz1: 1.1, a0: -PI, a1: PI, bulge: 0.14 }), 24, 3, 0.15, { closeU: true }));
  // waist frame (visible joint: rings + cables), obi
  const SP = J.spine;
  B.add(SP, M.frame, cyl(1.42, 1.56, 1.6, 20), T([0, 10.0, 0], [0, 0, 0], [1, 1, 0.78]));
  for (let i = 0; i < 3; i++) B.add(SP, M.steel, cyl(1.52, 1.52, 0.1, 20), T([0, 10.25 + i * 0.32, 0], [0, 0, 0], [1, 1, 0.8]));
  for (const s of [1, -1]) cables(B, SP, M.frame, [1.1, 10.75, 0.6], [1.25, 9.9, 0.9], 3, 0.06, 0.12, 0.16, s);
  const obi = bandFn({ y0: 9.5, y1: 10.05, rx0: 1.8, rz0: 1.4, a0: -PI, a1: PI, bulge: 0.06, p: 2.2 });
  B.add(SP, M.lace, sheet(obi, 32, 2, 0.14, { closeU: true }));
  B.add(SP, M.gold, ext([[-0.22, -0.18], [0.22, -0.18], [0.22, 0.18], [-0.22, 0.18]], 0.1, { bevel: 0.03 }), T([-0.65, 9.78, 1.42], [0, -0.35, 0]));
  const P = J.pelvis;
  B.add(P, M.frame, sphere(1, 16, 10), T([0, 8.8, 0], [0, 0, 0], [1.5, 0.95, 1.1]));
  B.add(P, M.lacqB, S(bandFn({ y0: 8.2, y1: 9.4, rx0: 1.2, rz0: 1.05, rx1: 1.5, rz1: 1.2, a0: -0.9, a1: 0.9, keel: 0.1 }), 10, 2, 0.12));
  // kusazuri: 6 panels x 5 flared laced rows
  rig.kusa.forEach((g, k) => {
    const a = g.userData.a, side = Math.abs(a) > 1 && Math.abs(a) < 2;
    const w = side ? 1.8 : 1.62;
    const pv = rig.bind['kusa' + k];
    const fns = [];
    for (let i = 0; i < 5; i++) {
      const f = plateFn({ w: w * (1 + i * 0.07), h: 0.76, cr: 2.2, crV: 4 });
      fns.push(xf(f, T([pv.x, pv.y - i * 0.64 + 0.04 * i, pv.z], [0, a, 0]).multiply(T([0, 0, 0.07 * i], [0.07 + i * 0.04, 0, 0]))));
    }
    rows(B, g, M, fns, { thick: 0.1, nu: 8, cols: 5, mats: k % 2 ? ['lacqA', 'lacqB'] : ['lacqB', 'lacqA'] });
    B.add(g, M.lace, sheet(xf(plateFn({ w: w * 0.9, h: 0.2, cr: 2.2 }), T([pv.x, pv.y + 0.18, pv.z], [0, a, 0]).multiply(T([0, 0, -0.05]))), 6, 1, 0.08));
  });

  // ================================================================= ARMS (left authored, mirrored)
  for (const [L, s] of [['L', 1], ['R', -1]]) {
    const sx = d.shoulder[0], AR = J['arm' + L], EL = J['elbow' + L];
    B.add(AR, M.frame, sphere(1, 14, 10), T([sx - 0.2, 13.5, 0], [0, 0, 0], [0.92, 0.92, 0.92]), s);
    B.add(AR, M.frame, cyl(0.66, 0.58, 2.6, 12), T([sx, 12.0, 0]), s);
    // upper arm: tapered wrap plates (front / inner), the sode covers the outside
    const ua = [0, 1].map((i) => bandFn({ y0: 11.0 + (1 - i) * 0.95, y1: 11.0 + (1 - i) * 0.95 + 1.05, rx0: 0.84 + i * 0.05, rz0: 0.8 + i * 0.04, rx1: 0.9 + i * 0.05, rz1: 0.86 + i * 0.04, a0: -2.6, a1: 1.2, cx: sx, p: 2.3, flare: 0.05 }));
    ua.forEach((f, i) => B.add(AR, i % 2 ? M.lacqB : M.lacqA, S(f, 14, 2, 0.11, 0.16), null, s));
    trim(B, AR, M.gold, ua[1], 0, 0.08, 0.02, 0.05, s, 14);
    // elbow: frame ball + cop with a pointed gold spine + cables on the inner side
    B.add(EL, M.frame, sphere(0.62, 12, 8), T([sx, 10.45, 0]), s);
    B.add(EL, M.plain, sheet(domeFn({ rx: 0.72, ry: 0.74, rz: 0.6, cx: sx + 0.28, cy: 10.45, cz: -0.12, l0: -1.25, l1: 1.25, a0: 0.15, a1: 2.7 }), 12, 6, 0.1, { bev: 0.16 }), null, s);
    B.add(EL, M.gold, ext([[0, 0.5], [0.16, 0], [0, -0.5], [-0.16, 0]], 0.08, { bevel: 0.02 }), T([sx + 0.86, 10.45, -0.36], [0, PI / 2 + 0.4, 0]), s);
    cables(B, EL, M.frame, [sx - 0.45, 10.95, 0.35], [sx - 0.45, 9.7, 0.45], 2, 0.06, 0.18, 0.16, s);
    // heavy gauntlet: closed squarish bracer swelling toward the wrist + big outer plate flaring into a cuff
    B.add(EL, M.frame, cyl(0.55, 0.48, 2.4, 12), T([sx, 9.2, 0]), s);
    const kote = bandFn({ y0: 7.9, y1: 10.05, rx0: 0.84, rz0: 0.78, rx1: 0.78, rz1: 0.74, a0: -PI, a1: PI, cx: sx, p: 2.6, bulge: 0.06, ease: (v) => v * v });
    B.add(EL, M.plain, sheet(kote, 24, 4, 0.12, { closeU: true, bev: 0.08 }), null, s);
    const koteO = bandFn({ y0: 7.75, y1: 9.95, rx0: 0.96, rz0: 0.9, rx1: 0.86, rz1: 0.82, a0: 0.15, a1: 2.6, cx: sx, p: 2.3, bulge: 0.05, flare: 0.14, flareP: 4, ease: (v) => v * v });
    B.add(EL, M.lacqA, S(koteO, 14, 4, 0.12, 0.12), null, s);
    trim(B, EL, M.gold, koteO, 0, 0.07, 0.025, 0.06, s, 14);
    for (let i = 0; i < 3; i++) B.add(EL, M.lacqB, sheet(sub(koteO, 0.3 + i * 0.16, 0.36 + i * 0.16, 0.14, 0.9, 0.06), 1, 4, 0.08, { bev: 0.3 }), null, s);
    trim(B, EL, M.lace, kote, 0.55, 0.6, 0.03, 0.05, s, 24);
    trim(B, EL, M.lace, kote, 0.82, 0.87, 0.03, 0.05, s, 24);
    hand(B, rig, L, s, M, [sx, d.wrist[1], 0], d.hand, { width: d.hand * 0.6 });
    // sode: 5 flared laced rows, curved around the arm and bowed outward, widening and kicking out row by row
    const sd = d.sode, sodeFns = [];
    for (let i = 0; i < sd.rows; i++) {
      const f = plateFn({ w: 3.15 + i * 0.2, h: sd.rowH + 0.18, cr: 2.5, crV: 5 });
      sodeFns.push(xf(f, T([sd.x + i * 0.26, sd.y - i * sd.rowH, sd.z], [0, 0, 0.16 + i * 0.07]).multiply(T([0, 0, 0], [0, PI / 2, 0]))));
    }
    rows(B, Array.from({ length: sd.rows }, (_, i) => J[`sode${L}${i}`]), M, sodeFns, { thick: 0.12, nu: 12, nv: 3, cols: 7, side: s });
    const crown = xf(plateFn({ w: 3.25, h: 0.36, cr: 2.5 }), T([sd.x - 0.08, sd.y + 0.26, sd.z], [0, 0, 0.16]).multiply(T([0, 0, 0], [0, PI / 2, 0])));
    B.add(J[`sode${L}0`], M.plain, S(crown, 10, 1, 0.16, 0.25), null, s);
    trim(B, J[`sode${L}0`], M.gold, crown, 0.72, 1, 0.025, 0.05, s, 10);
    piston(rig, 'arm' + L, [sx * s, 11.6, -0.68], 'elbow' + L, [sx * s, 9.4, -0.6], M, 0.17);
  }

  // ================================================================= LEGS (short and powerful)
  for (const [L, s] of [['L', 1], ['R', -1]]) {
    const lx = d.hip[0], TH = J['thigh' + L], SH = J['shin' + L], FT = J['foot' + L], TO = J['toe' + L];
    B.add(TH, M.frame, sphere(0.98, 14, 10), T([lx, 8.4, 0]), s);
    B.add(TH, M.frame, cyl(0.84, 0.72, 3.4, 14), T([lx, 6.6, 0]), s);
    // haidate: 4 laced rows tapering from a massive hip to the knee, wrapping front, outside and inside
    const hd = [0, 1, 2, 3].map((i) => { const top = 7.7 - i * 0.66, bot = top - 0.78, r = (y) => 0.98 + 0.38 * ss(y, 5.0, 7.9);
      return bandFn({ y0: bot, y1: top, rx0: r(bot) + 0.04, rz0: r(bot) * 0.94, rx1: r(top), rz1: r(top) * 0.92, a0: -2.3, a1: 2.5, cx: lx + 0.06, p: 2.3, keel: 0.12, flare: 0.06 }); });
    rows(B, TH, M, hd, { thick: 0.11, nu: 16, cols: 6, side: s });
    B.add(TH, M.lacqB, S(bandFn({ y0: 5.2, y1: 7.8, rx0: 0.95, rz0: 0.95, rx1: 1.2, rz1: 1.15, a0: 2.4, a1: 4.0, cx: lx, p: 2.3, bulge: 0.08 }), 8, 3, 0.1), null, s);
    // knee: frame ball, domed cop with gold spine, piston + cables behind
    B.add(SH, M.frame, sphere(0.72, 12, 8), T([lx, 4.75, 0]), s);
    const cop = domeFn({ rx: 0.88, ry: 1.0, rz: 0.62, cx: lx, cy: 4.78, cz: 0.32, l0: -1.25, l1: 1.25, a0: -1.45, a1: 1.45 });
    B.add(SH, M.plain, sheet(cop, 12, 8, 0.12, { bev: 0.14 }), null, s);
    B.add(SH, M.gold, ext([[0, 0.75], [0.2, 0], [0, -0.75], [-0.2, 0]], 0.08, { bevel: 0.03 }), T([lx, 4.78, 0.98], [0, 0, 0]), s);
    piston(rig, 'thigh' + L, [lx * s, 6.6, -0.8], 'shin' + L, [lx * s, 3.4, -0.72], M, 0.21);
    cables(B, SH, M.frame, [lx + 0.55, 5.0, -0.35], [lx + 0.6, 3.9, -0.3], 2, 0.06, 0.15, 0.16, s);
    // suneate: keeled shin guard with a sharp ridge, flaring over the foot; calf plate; gold rim, red ties
    B.add(SH, M.frame, cyl(0.68, 0.58, 3.3, 12), T([lx, 3.0, 0]), s);
    const sune = bandFn({ y0: 1.45, y1: 4.3, rx0: 0.72, rz0: 0.76, rx1: 1.0, rz1: 1.02, a0: -2.25, a1: 2.25, cx: lx, cz: 0.04, p: 2, bulge: 0.1, keel: 0.32, keelP: 10, flare: 0.3, flareP: 6 });
    B.add(SH, M.plain, S(sune, 22, 5, 0.13, 0.1), null, s);
    B.add(SH, M.gold, sheet(sub(sune, 0.485, 0.515, 0.06, 0.94, 0.03), 1, 6, 0.04), null, s);
    for (const u of [0.3, 0.7]) B.add(SH, M.lacqB, sheet(sub(sune, u - 0.03, u + 0.03, 0.1, 0.9, 0.05), 1, 4, 0.08, { bev: 0.3 }), null, s);
    trim(B, SH, M.gold, sune, 0.92, 1, 0.025, 0.05, s, 22);
    const calf = bandFn({ y0: 1.6, y1: 4.1, rx0: 0.62, rz0: 0.62, rx1: 0.86, rz1: 0.86, a0: PI - 1.05, a1: PI + 1.05, cx: lx, bulge: 0.18, p: 2.2 });
    B.add(SH, M.lacqA, S(calf, 10, 4, 0.1), null, s);
    const tieF = bandFn({ y0: 1.6, y1: 4.1, rx0: 0.76, rz0: 0.76, rx1: 0.88, rz1: 0.88, a0: 2.0, a1: 2 * PI - 2.0, cx: lx, bulge: 0.18 });
    trim(B, SH, M.lace, tieF, 0.25, 0.3, 0.05, 0.06, s, 8);
    trim(B, SH, M.lace, tieF, 0.7, 0.75, 0.05, 0.06, s, 8);
    // sabaton: flared ankle guard, sole, arched instep shell, 3 keeled toe plates + pointed cap
    const ax = d.ankle[0];
    B.add(FT, M.frame, sphere(0.6, 10, 8), T([ax, 1.15, 0]), s);
    B.add(FT, M.plain, sheet(bandFn({ y0: 0.82, y1: 1.6, rx0: 0.98, rz0: 1.02, rx1: 0.78, rz1: 0.8, a0: -PI, a1: PI, cx: ax, p: 2.3, flare: 0.08 }), 20, 2, 0.1, { closeU: true, bev: 0.2 }), null, s);
    const prof = [[-1.0, 0], [1.25, 0], [1.25, 0.32], [0.6, 0.62], [-0.4, 0.82], [-1.0, 0.6]];
    B.add(FT, M.frame, ext(prof, 1.5, { bevel: 0.07 }), T([ax, 0.0, 0], [0, -PI / 2, 0]), s);
    const inst = bandFn({ y0: 0.2, y1: 0.98, rx0: 0.86, rz0: 1.3, rx1: 0.6, rz1: 0.74, a0: -1.65, a1: 1.65, cx: ax, cz: 0.3, bulge: 0.1, p: 2.3, keel: 0.14 });
    B.add(FT, M.lacqA, S(inst, 14, 3, 0.11, 0.14), null, s);
    trim(B, FT, M.gold, inst, 0, 0.08, 0.02, 0.05, s);
    for (let i = 0; i < 3; i++) {
      const tf = bandFn({ y0: 0.08, y1: 0.66 - i * 0.12, rx0: 0.8 - i * 0.06, rz0: 0.5, rx1: 0.6 - i * 0.06, rz1: 0.36, a0: -1.5, a1: 1.5, cx: ax, cz: 1.22 + i * 0.3, bulge: 0.05, p: 2.2, keel: 0.08 });
      B.add(TO, i % 2 ? M.lacqB : M.lacqA, S(tf, 12, 2, 0.09, 0.18), null, s);
    }
    B.add(TO, M.frame, ext([[-0.66, 0], [0.66, 0], [0.5, 0.75], [0, 0.95], [-0.5, 0.75]], 0.22, { bevel: 0.05 }), T([ax, 0.13, 1.2], [-PI / 2, 0, 0]), s);
    B.add(TO, M.gold, sheet(sub(bandFn({ y0: 0.1, y1: 0.42, rx0: 0.66, rz0: 0.42, a0: -1.45, a1: 1.45, cx: ax, cz: 1.86, p: 2.2 }), 0, 1, 0, 0.3, 0.02), 12, 1, 0.05), null, s);
  }

  B.finish((m) => { m.userData.ronin = 'sumi'; });
  H.scale.setScalar(1.12);

  H.add(eyeMesh);
  eyeMesh.geometry.translate(-rig.bind.head.x, -rig.bind.head.y, -rig.bind.head.z); eyeMesh.position.set(0, 0, 0);
  eyeMesh.frustumCulled = false;

  // ================================================================= NODACHI + scabbard (left hip)
  const sw = sword(M, { name: 'nodachi', len: 12, width: 0.5, thick: 0.13, curve: 0.38, tsubaZ: 0.62, habaki: 0.28, hiltBack: 3.0, hiltR: 0.26, tsubaR: 0.62, tsubaT: 0.14 });
  sw.traverse((o) => { if (o.material === M.steel) o.material = M.blade; });
  const sc = scabbard(M, { name: 'saya', len: 12.6, width: 0.62, curve: 0.38, flat: 0.42, mat: 'saya', cord: 'lace', cordR: 0.06, knobMat: 'gold' });
  frameAt(sc, rig.bind.pelvis, [2.25, 9.85, 1.3], [0.3, -0.3, -0.9], [0, 1, 0]);
  J.pelvis.add(sc);
  const blade = new Blade(rig, { sword: sw, scabbard: sc, hand: J.handR, reverse: false, tsubaZ: 0.62, bladeLen: 12.3, gripGap: 1.05, arcR: 12.6 * 12.6 / (2 * 0.38), gripX: 0.12 });
  rig.blades.push(blade);

  // ================================================================= scarf (10 m, tattered) on the back of the neck
  const scAnchor = rig.marker('chest', [0, 14.25, -1.1], 'scarfRoot');
  const hash = (x) => { const s = Math.sin(x * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const scarf = new Ribbon(rig, {
    name: 'scarf', mat: M.scarf, anchor: scAnchor, segs: 18, cols: 7, length: 10, drape: [0, -0.45, -1], fall: 0.9,
    waves: 1.6, speed: 9, flutter: 0.32, twist: 0.5, seed: 1.3, cup: 0.12,
    width: (s) => 2.1 * (1 - 0.35 * s), colLen: (c) => 0.8 + 0.2 * hash(Math.round(c * 7) + 3),
    clearZ: (y) => (y > 10.5 ? -1.95 : y > 5.8 ? -2.35 : -1.8),
    caps: [['thighL', 'shinL', 1.75], ['thighR', 'shinR', 1.75], ['shinL', 'footL', 1.45], ['shinR', 'footR', 1.45],
      ['armL', 'elbowL', 1.7], ['armR', 'elbowR', 1.7], ['elbowL', 'handL', 1.6], ['elbowR', 'handR', 1.6], ['pelvis', 'chest', 2.4]],
  });
  rig.cloths.push(scarf);

  const an = {
    head: rig.marker('head', [0, 15.6, 0.3], 'head'), eye: rig.marker('head', [0, 15.45, 1.2], 'eye'),
    chest: rig.marker('chest', [0, 12.4, 1.5], 'chest'), handR: rig.marker('handR', [-d.wrist[0], d.wrist[1] - d.hand * 0.45, 0], 'handR'),
    handL: rig.marker('handL', [d.wrist[0], d.wrist[1] - d.hand * 0.45, 0], 'handL'),
    footL: rig.marker('footL', [d.ankle[0], 0, 0.4], 'footL'), footR: rig.marker('footR', [-d.ankle[0], 0, 0.4], 'footR'),
    scabbard: sc,
  };
  return { rig, M, blade, blades: [blade], cloth: scarf, eyeMats: [M.eye], eyeBase: { color: '#FF3B2E', int: 2.2 }, anchors: an, sword: sw, swords: [sw] };
}
