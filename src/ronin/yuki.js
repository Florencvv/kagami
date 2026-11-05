// ronin/yuki.js - YUKI 雪, the slim white ronin (15 m). Model space: metres, ground y=0, facing +Z, left = +X.
// Silhouette: slim hourglass - flared keeled chest plate, pinched waist, small pointed shoulder plates, long tapered
// legs in closed shells (no tubes), pointed sabatons. Frame only at the joints. Lavender cel shade, vermilion trims.
import * as THREE from 'three';
import { sheet, sub, bandFn, domeFn, plateFn, tube, ext, box, cyl, sphere, sblob, mats, lameTexture, wrapTexture, setEdge, T, xf, Builder } from './kit.js';
import { laces, trim, pins, rows, hand, piston, cables, sword, scabbard, frameAt } from './parts.js';
import { Rig, Ribbon, Blade } from './rig.js';

const PI = Math.PI;
const ss = THREE.MathUtils.smoothstep;
export const YUKI_DIMS = {
  pelvis: [0, 7.85, 0], spine: [0, 8.6, 0], chest: [0, 9.6, 0], neck: [0, 11.85, 0], head: [0, 12.3, 0.05],
  clav: [0.8, 11.35, 0], shoulder: [2.05, 11.25, 0], elbow: [2.05, 8.75, 0], wrist: [2.05, 6.4, 0], hand: 1.08,
  hip: [0.92, 7.5, 0], knee: [0.92, 4.25, 0], ankle: [0.92, 0.85, 0], toe: [0.92, 0.25, 1.0],
  sode: { rows: 2, x: 2.55, y: 12.0, z: 0.05, rowH: 0.62 },
  kusa: { n: 4, angles: [0.5, -0.5, 2.62, -2.62], rx: 1.0, rz: 0.84, y: 8.2, len: 1.6, clear: 0.6 },
  sliver: 0.3,
};

export function buildYuki(A) {
  const lame = lameTexture({ cols: 6, line: '#b0acd8' });
  const W = { base: '#F5F4F9', shade: '#A39FDA', rimColor: '#ffd2a8', highlight: 0.75, hiSize: 0.975, hiColor: '#ffffff', rimWidth: 0.15, wobble: 0.4 };
  const M = mats(A, {
    lacqA: { ...W, id: 50, map: lame },
    lacqB: { ...W, id: 51 },
    plain: { ...W, id: 52 },
    face: { ...W, base: '#F8F7FB', shade: '#ADAAE0', id: 53 },
    lace: { base: '#D8432F', shade: '#8a2238', id: 54, rimColor: '#ffb090', highlight: 0.4 },
    verm: { base: '#D8432F', shade: '#8a2238', id: 55, rimColor: '#ffb090', highlight: 0.85, hiSize: 0.95, hiColor: '#ffd0b0' },
    gold: { base: '#D4AA4E', shade: '#7a532a', id: 56, rimColor: '#fff0c0', highlight: 0.95, hiSize: 0.9, hiColor: '#fff6d0' },
    frame: { base: '#8E8FA6', shade: '#4e4f68', id: 58, rimColor: '#ffd2a8', highlight: 0.5, hiSize: 0.92, rimWidth: 0.12 },
    dark: { base: '#34364a', shade: '#1e1f2c', id: 59, highlight: 0.2 },
    steel: { base: '#9a9eb0', shade: '#5c6078', id: 39, rimColor: '#e0e4ff', highlight: 0.8 },
    plume: { base: '#F4F3F8', shade: '#A9A6DA', id: 60, rimColor: '#ffffff', highlight: 0.3, side: THREE.DoubleSide },
    blade: { base: '#d3dae9', shade: '#6f7a99', id: 44, rimColor: '#ffffff', highlight: 1, hiSize: 0.86, hiColor: '#ffffff' },
    edge: { base: '#f6f9ff', shade: '#c4cce4', id: 45, rimColor: '#ffffff', highlight: 1, hiSize: 0.8, hiColor: '#ffffff' },
    saya: { base: '#D8432F', shade: '#8a2238', id: 46, rimColor: '#ffb090', highlight: 0.9, hiSize: 0.9, hiColor: '#ffc8a8' },
    wrap: { base: '#ffffff', shade: '#a8a4c4', id: 47, map: wrapTexture({ wrap: '#2a2a36', diamond: '#f0eef6' }), highlight: 0.2 },
    eye: { fx: true, color: '#5CF2FF', intensity: 2.0, bloom: 1.4, id: 92 },
  });
  setEdge([0.8, 0.79, 0.93]);
  const rig = new Rig({ name: 'YUKI', dims: YUKI_DIMS, defaults: {} });
  const J = rig.J, d = YUKI_DIMS;
  for (const g of rig.kusa) { g.rotation.order = 'YXZ'; g.rotation.y = g.userData.a; }
  rig.root.updateMatrixWorld(true);
  const B = new Builder();
  const S = (f, nu, nv, th, bev = 0.12) => sheet(f, nu, nv, th, { bev, bevD: th * 0.8 });

  // ================================================================= HEAD
  const H = J.head;
  B.add(H, M.frame, sphere(0.72, 14, 10), T([0, 12.72, 0.0]));
  const helm = domeFn({ rx: 0.84, ry: 0.86, rz: 1.12, cy: 12.98, cz: -0.12, l0: -0.18 });
  const peak = bandFn({ y0: 12.72, y1: 12.86, rx0: 1.0, rz0: 1.4, rx1: 0.84, rz1: 1.12, a0: -1.05, a1: 1.05, cz: -0.12, keel: 0.12 });
  B.add(H, M.lacqB, S(peak, 16, 1, 0.08, 0.25));
  trim(B, H, M.verm, peak, 0, 0.3, 0.01, 0.04);
  B.add(H, M.plain, sheet(helm, 32, 9, 0.1, { closeU: true }));
  B.add(H, M.lacqB, sheet(sub(helm, 0.49, 0.51, 0.3, 0.98, 0.04), 1, 6, 0.05));
  const brow = bandFn({ y0: 12.86, y1: 12.96, rx0: 0.86, rz0: 1.14, a0: -1.9, a1: 1.9, cz: -0.12 });
  B.add(H, M.verm, sheet(brow, 18, 1, 0.06));
  for (const s of [1, -1]) {   // swept-back blade crests
    const pts = [], pts2 = [], N = 22;
    for (let i = 0; i <= N; i++) { const t = i / N, X = -0.3 + 3.6 * t, c = 1.25 * Math.pow(t, 1.6), w = 0.3 * Math.pow(1 - t, 0.8) + 0.008; pts.push([X, c + w]); pts2.unshift([X, c - w * 0.55]); }
    const inner = [], inner2 = [];
    for (let i = 0; i <= N; i++) { const t = i / N * 0.85, X = -0.15 + 3.6 * t, c = 1.25 * Math.pow(t, 1.6) + 0.04, w = 0.1 * Math.pow(1 - t, 0.8); inner.push([X, c + w]); inner2.unshift([X, c - w]); }
    const M0 = T([0.36, 13.36, 0.66], [0, 0, -0.42]).multiply(T([0, 0, 0], [0, PI / 2 - 0.38, 0]));
    B.add(H, M.lacqB, ext(pts.concat(pts2), 0.08, { bevel: 0.025 }), M0, s);
    B.add(H, M.verm, ext(inner.concat(inner2), 0.03), M0.clone().multiply(T([0, 0, 0.075])), s);
    B.add(H, M.gold, sphere(0.11, 8, 6), T([0.36, 13.36, 0.7]), s);
  }
  B.add(H, M.gold, cyl(0.16, 0.22, 0.3, 12), T([0, 13.8, -0.5], [-0.9, 0, 0]));
  const mask = (u, v) => { const x = (u - 0.5) * 2, w = 0.16 + 0.56 * Math.pow(v, 0.55); const y = 11.92 + v * 0.9; const z = 0.88 + 0.16 * (1 - v) - Math.pow(Math.abs(x), 1.5) * 0.8 * (0.5 + 0.5 * v) + 0.06 * (1 - Math.abs(x)); return [x * w, y, z]; };
  B.add(H, M.face, S(mask, 12, 6, 0.08, 0.1));
  B.add(H, M.dark, sheet(sub(mask, 0.08, 0.92, 0.66, 0.8, 0.012), 10, 1, 0.03));
  for (const s of [1, -1]) {
    const p = mask(0.5 + 0.2, 0.73);
    const eye = new THREE.Mesh(ext([[-0.2, -0.032], [0.2, 0.0], [0.23, 0.05], [-0.17, 0.034]], 0.05), M.eye);
    const em = T([p[0], p[1], p[2] + 0.04], [0, 0.45, 0.16], [1.05, 1.1, 1]);
    if (s < 0) em.premultiply(new THREE.Matrix4().makeScale(-1, 1, 1));
    rig._eyes = rig._eyes || []; rig._eyes.push({ geo: eye.geometry, m: em, flip: s < 0 });
    const cv = mask(0.5 + 0.3, 0.38);
    B.add(H, M.dark, sblob(0.09, 0.075, 0.03, 0.4), T([cv[0], cv[1], cv[2]], [0, 0.6, 0]), s);
    for (let i = 0; i < 3; i++) B.add(H, M.lacqB, box(0.025, 0.13, 0.07), T([cv[0] - 0.05 + i * 0.05, cv[1], cv[2] + 0.02], [0, 0.6, 0]), s);
  }
  B.add(H, M.plain, sheet(sub(mask, 0.47, 0.53, 0.05, 0.6, 0.03), 1, 3, 0.04));
  B.add(H, M.verm, sheet(sub(mask, 0.485, 0.515, 0.0, 0.12, 0.05), 1, 1, 0.03));
  const shk = [0, 1].map((i) => bandFn({ y0: 12.02 - i * 0.36, y1: 12.48 - i * 0.36, rx0: 1.08 + i * 0.2, rz0: 1.14 + i * 0.16, rx1: 0.88 + i * 0.16, rz1: 0.98 + i * 0.13, a0: 1.25, a1: 2 * PI - 1.25, cz: -0.1, flare: 0.05 }));
  rows(B, H, M, shk, { thick: 0.07, nu: 18, cols: 8, trimLast: 'verm' });
  B.add(J.neck, M.frame, cyl(0.4, 0.48, 1.0, 12), T([0, 11.95, 0]));
  cables(B, J.neck, M.frame, [0.32, 12.3, -0.32], [0.38, 11.6, -0.4], 2, 0.045, 0.1, 0.12);
  cables(B, J.neck, M.frame, [-0.32, 12.3, -0.32], [-0.38, 11.6, -0.4], 2, 0.045, 0.1, 0.12);

  // ================================================================= TORSO (hourglass)
  const C = J.chest;
  const rxAt = (y) => 0.6 + 1.0 * ss(y, 9.5, 11.4) - 0.36 * ss(y, 11.45, 11.95);
  B.add(C, M.frame, sphere(1, 16, 12), T([0, 10.7, 0], [0, 0, 0], [0.95, 1.1, 0.72]));
  const lames = [];
  for (let i = 1; i >= 0; i--) { const y0 = 9.25 + i * 0.5, y1 = y0 + 0.6; lames.push(bandFn({ y0, y1, rx0: rxAt(y0) + 0.08, rz0: (rxAt(y0) + 0.08) * 0.8, rx1: rxAt(y1), rz1: rxAt(y1) * 0.76, a0: -PI, a1: PI, flare: 0.04, keel: 0.06 })); }
  lames.forEach((f, i) => { B.add(C, i % 2 ? M.lacqB : M.plain, sheet(f, 36, 2, 0.1, { closeU: true, bev: 0.2 })); if (i === 1) trim(B, C, M.verm, f, 0, 0.08, 0.015, 0.04, 1, 36); });
  // flared chest plate: keeled, bowed, the top edge sweeps out toward the shoulders
  const muna = bandFn({ y0: 10.1, y1: 11.8, rx0: rxAt(10.1) + 0.14, rz0: (rxAt(10.1) + 0.14) * 0.8, rx1: 1.42, rz1: 1.0, a0: -1.4, a1: 1.4, bulge: 0.12, keel: 0.3, keelP: 5, ease: (v) => Math.pow(v, 0.8) });
  B.add(C, M.plain, S(muna, 24, 6, 0.12, 0.1));
  trim(B, C, M.verm, muna, 0.88, 1, 0.02, 0.05);
  trim(B, C, M.verm, muna, 0, 0.06, 0.02, 0.04);
  B.add(C, M.verm, sheet(sub(muna, 0.49, 0.51, 0.1, 0.86, 0.03), 1, 5, 0.04));
  pins(B, C, M.gold, muna, [[0.1, 0.62], [0.9, 0.62]], 0.06);
  const back = bandFn({ y0: 10.1, y1: 11.8, rx0: rxAt(10.1) + 0.14, rz0: (rxAt(10.1) + 0.14) * 0.8, rx1: 1.36, rz1: 0.94, a0: PI - 1.4, a1: PI + 1.4, bulge: 0.08, ease: (v) => Math.pow(v, 0.8) });
  B.add(C, M.plain, S(back, 22, 5, 0.12));
  const col = bandFn({ y0: 11.6, y1: 12.0, rx0: 0.9, rz0: 0.78, rx1: 0.72, rz1: 0.64, a0: -PI, a1: PI });
  B.add(C, M.lacqB, sheet(col, 24, 2, 0.08, { closeU: true, bev: 0.2 }));
  trim(B, C, M.verm, col, 0.82, 1, 0.015, 0.04, 1, 24);
  for (const s of [1, -1]) B.add(C, M.lacqB, S((u, v) => { const z = (u - 0.5) * 1.9; return [0.95 + 0.1 * Math.cos(z) - 0.3 + v * 0.6, 11.84 - z * z * 0.1, z]; }, 8, 1, 0.1, 0.2), null, s);
  // pinched waist: frame + rings, slim obi
  const SP = J.spine;
  B.add(SP, M.frame, cyl(0.62, 0.74, 1.4, 18), T([0, 8.8, 0], [0, 0, 0], [1, 1, 0.82]));
  for (let i = 0; i < 2; i++) B.add(SP, M.steel, cyl(0.66, 0.66, 0.07, 18), T([0, 9.0 + i * 0.25, 0], [0, 0, 0], [1, 1, 0.84]));
  const obi = bandFn({ y0: 8.35, y1: 8.78, rx0: 0.86, rz0: 0.7, a0: -PI, a1: PI, bulge: 0.04 });
  B.add(SP, M.verm, sheet(obi, 28, 2, 0.1, { closeU: true }));
  B.add(SP, M.gold, ext([[-0.14, -0.12], [0.14, -0.12], [0.14, 0.12], [-0.14, 0.12]], 0.08, { bevel: 0.02 }), T([0, 8.57, 0.74]));
  const P = J.pelvis;
  B.add(P, M.frame, sphere(1, 14, 10), T([0, 7.8, 0], [0, 0, 0], [1.0, 0.68, 0.76]));
  B.add(P, M.lacqB, S(bandFn({ y0: 7.35, y1: 8.3, rx0: 0.74, rz0: 0.74, rx1: 0.92, rz1: 0.78, a0: -0.8, a1: 0.8, keel: 0.08 }), 8, 2, 0.1));
  // short flared tassets (they reveal the long legs)
  rig.kusa.forEach((g, k) => {
    const a = g.userData.a, pv = rig.bind['kusa' + k];
    const fns = [];
    for (let i = 0; i < 3; i++) {
      const f = plateFn({ w: 0.98 + i * 0.1, h: 0.62, cr: 1.4, crV: 3, taper: -0.1 });
      fns.push(xf(f, T([pv.x, pv.y - i * 0.5, pv.z], [0, a, 0]).multiply(T([0, 0, 0.06 * i], [0.08 + i * 0.05, 0, 0]))));
    }
    rows(B, g, M, fns, { thick: 0.07, nu: 6, cols: 3, trimLast: 'verm', mats: k % 2 ? ['lacqA', 'lacqB'] : ['lacqB', 'lacqA'] });
  });

  // ================================================================= ARMS (slim, closed tapered shells)
  for (const [L, s] of [['L', 1], ['R', -1]]) {
    const sx = d.shoulder[0], AR = J['arm' + L], EL = J['elbow' + L];
    B.add(AR, M.frame, sphere(0.52, 12, 10), T([sx - 0.12, 11.28, 0]), s);
    const ua = bandFn({ y0: 9.15, y1: 10.85, rx0: 0.33, rz0: 0.33, rx1: 0.42, rz1: 0.42, a0: -PI, a1: PI, cx: sx, bulge: 0.05, keel: 0.0 });
    B.add(AR, M.plain, sheet(ua, 18, 3, 0.08, { closeU: true, bev: 0.14 }), null, s);
    trim(B, AR, M.verm, ua, 0, 0.07, 0.015, 0.04, s, 18);
    B.add(EL, M.frame, sphere(0.4, 10, 8), T([sx, 8.75, 0]), s);
    B.add(EL, M.lacqB, sheet(domeFn({ rx: 0.42, ry: 0.5, rz: 0.36, cx: sx + 0.16, cy: 8.78, cz: -0.14, l0: -1.2, l1: 1.25, a0: 0.4, a1: 2.8 }), 8, 5, 0.06, { bev: 0.2 }), null, s);
    B.add(EL, M.verm, ext([[0, 0.38], [0.1, 0], [0, -0.3], [-0.1, 0]], 0.05, { bevel: 0.015 }), T([sx + 0.5, 8.8, -0.3], [0, PI / 2 + 0.5, 0]), s);
    cables(B, EL, M.frame, [sx - 0.3, 9.15, 0.22], [sx - 0.3, 8.3, 0.28], 2, 0.04, 0.12, 0.1, s);
    // forearm: tapered shell, slim at the wrist, outer plate with a vermilion cuff
    const kote = bandFn({ y0: 6.72, y1: 8.45, rx0: 0.27, rz0: 0.26, rx1: 0.37, rz1: 0.35, a0: -PI, a1: PI, cx: sx, bulge: 0.04, ease: (v) => Math.sqrt(v) });
    B.add(EL, M.plain, sheet(kote, 18, 3, 0.08, { closeU: true, bev: 0.12 }), null, s);
    const koteO = bandFn({ y0: 6.66, y1: 8.4, rx0: 0.33, rz0: 0.32, rx1: 0.43, rz1: 0.41, a0: 0.25, a1: 2.6, cx: sx, bulge: 0.05, keel: 0.0, ease: (v) => Math.sqrt(v) });
    B.add(EL, M.lacqB, S(koteO, 12, 3, 0.07, 0.14), null, s);
    trim(B, EL, M.verm, koteO, 0, 0.1, 0.02, 0.05, s, 12);
    pins(B, EL, M.gold, koteO, [[0.5, 0.85]], 0.05, s);
    hand(B, rig, L, s, M, [sx, d.wrist[1], 0], d.hand, { back: 'plain', back2: 'lacqB', trim: 'verm' });
    // small pointed shoulder plates: 2 stacked shields narrowing to a point, tilted out
    const sd = d.sode, fns = [];
    for (let i = 0; i < sd.rows; i++) {
      const f = plateFn({ w: 1.75 - i * 0.3, h: sd.rowH + 0.32, cr: 1.0, crV: 2.4, taper: 0.8 });
      fns.push(xf(f, T([sd.x + i * 0.12, sd.y - i * sd.rowH, sd.z - i * 0.04], [0, 0, 0.5 - i * 0.04]).multiply(T([0, 0, 0], [0, PI / 2, 0]))));
    }
    const SJ = Array.from({ length: sd.rows }, (_, i) => J[`sode${L}${i}`]);
    rows(B, SJ, M, fns, { thick: 0.08, nu: 8, nv: 3, cols: 0, side: s, mats: ['plain', 'lacqB'], trimLast: null });
    fns.forEach((f, i) => B.add(SJ[i], M.verm, sheet(sub(f, 0.0, 0.08, 0.05, 1, 0.02), 1, 3, 0.04), null, s));
    fns.forEach((f, i) => B.add(SJ[i], M.verm, sheet(sub(f, 0.92, 1, 0.05, 1, 0.02), 1, 3, 0.04), null, s));
    const cap = xf(domeFn({ rx: 0.8, ry: 0.42, rz: 0.88, l0: 0, l1: 1.3, a0: -2.4, a1: 2.4 }), T([sd.x - 0.72, sd.y - 0.12, sd.z], [0, 0, -0.25]));
    B.add(SJ[0], M.lacqB, sheet(cap, 12, 4, 0.08, { bev: 0.15 }), null, s);
    trim(B, SJ[0], M.verm, cap, 0, 0.12, 0.015, 0.04, s, 12);
    pins(B, SJ[0], M.gold, fns[0], [[0.5, 0.82]], 0.05, s);
  }

  // ================================================================= LEGS (long, tapered, closed shells)
  for (const [L, s] of [['L', 1], ['R', -1]]) {
    const lx = d.hip[0], TH = J['thigh' + L], SH = J['shin' + L], FT = J['foot' + L], TO = J['toe' + L];
    B.add(TH, M.frame, sphere(0.56, 12, 10), T([lx, 7.45, 0]), s);
    const thigh = bandFn({ y0: 4.75, y1: 7.15, rx0: 0.4, rz0: 0.43, rx1: 0.62, rz1: 0.66, a0: -PI, a1: PI, cx: lx, bulge: 0.06, keel: 0.06, ease: (v) => v * v });
    B.add(TH, M.plain, sheet(thigh, 22, 4, 0.09, { closeU: true, bev: 0.12 }), null, s);
    const hd = [0, 1].map((i) => { const top = 7.0 - i * 0.95, bot = top - 1.05; const r = (y) => 0.44 + 0.2 * ss(y, 4.8, 7.1);
      return bandFn({ y0: bot, y1: top, rx0: r(bot) + 0.06, rz0: r(bot) + 0.06, rx1: r(top) + 0.06, rz1: r(top) + 0.06, a0: -1.3, a1: 1.9, cx: lx, keel: 0.08, flare: 0.04 }); });
    hd.forEach((f, i) => B.add(TH, i % 2 ? M.lacqB : M.lacqA, S(f, 12, 2, 0.08, 0.16), null, s));
    trim(B, TH, M.verm, hd[1], 0, 0.1, 0.015, 0.04, s);
    // knee: frame ball + pointed guard
    B.add(SH, M.frame, sphere(0.46, 10, 8), T([lx, 4.25, 0]), s);
    B.add(SH, M.lacqB, ext([[0, 0.6], [0.34, 0.12], [0.26, -0.35], [0, -0.6], [-0.26, -0.35], [-0.34, 0.12]], 0.12, { bevel: 0.05 }), T([lx, 4.32, 0.5], [-0.15, 0, 0]), s);
    B.add(SH, M.verm, ext([[0, 0.32], [0.11, 0.0], [0, -0.32], [-0.11, 0.0]], 0.05), T([lx, 4.32, 0.62], [-0.15, 0, 0]), s);
    piston(rig, 'thigh' + L, [lx * s, 5.8, -0.55], 'shin' + L, [lx * s, 3.1, -0.48], M, 0.11, 'frame', 'steel');
    cables(B, SH, M.frame, [lx + 0.36, 4.5, -0.25], [lx + 0.38, 3.7, -0.22], 2, 0.04, 0.1, 0.1, s);
    // greave: keeled ridge, slim ankle, flares over the foot; calf shell behind
    const gre = bandFn({ y0: 1.1, y1: 3.95, rx0: 0.36, rz0: 0.4, rx1: 0.56, rz1: 0.6, a0: -2.1, a1: 2.1, cx: lx, cz: 0.02, bulge: 0.05, keel: 0.2, keelP: 10, flare: 0.16, flareP: 6 });
    B.add(SH, M.plain, S(gre, 18, 5, 0.08, 0.1), null, s);
    B.add(SH, M.verm, sheet(sub(gre, 0.485, 0.515, 0.08, 0.92, 0.025), 1, 5, 0.04), null, s);
    trim(B, SH, M.verm, gre, 0.92, 1, 0.02, 0.04, s, 18);
    const calf = bandFn({ y0: 1.25, y1: 3.8, rx0: 0.32, rz0: 0.34, rx1: 0.5, rz1: 0.52, a0: PI - 1.35, a1: PI + 1.35, cx: lx, bulge: 0.12 });
    B.add(SH, M.lacqB, S(calf, 12, 4, 0.07), null, s);
    // pointed sabaton
    const ax = d.ankle[0];
    B.add(FT, M.frame, sphere(0.36, 10, 8), T([ax, 0.85, 0]), s);
    B.add(FT, M.lacqB, sheet(bandFn({ y0: 0.55, y1: 1.15, rx0: 0.56, rz0: 0.58, rx1: 0.44, rz1: 0.46, a0: -PI, a1: PI, cx: ax, flare: 0.05 }), 16, 2, 0.08, { closeU: true, bev: 0.2 }), null, s);
    B.add(FT, M.frame, ext([[-0.66, 0], [0.98, 0], [0.98, 0.22], [0.3, 0.5], [-0.4, 0.62], [-0.66, 0.42]], 0.9, { bevel: 0.05 }), T([ax, 0.0, 0], [0, -PI / 2, 0]), s);
    const up = bandFn({ y0: 0.16, y1: 0.7, rx0: 0.54, rz0: 0.98, rx1: 0.38, rz1: 0.52, a0: -1.6, a1: 1.6, cx: ax, cz: 0.18, bulge: 0.06, keel: 0.12 });
    B.add(FT, M.plain, S(up, 12, 3, 0.08, 0.16), null, s);
    trim(B, FT, M.verm, up, 0, 0.1, 0.015, 0.04, s);
    B.add(TO, M.plain, ext([[-0.46, 0], [0.46, 0], [0.3, 0.55], [0, 1.0], [-0.3, 0.55]], 0.3, { bevel: 0.06 }), T([ax, 0.17, 0.92], [-PI / 2, 0, 0]), s);
    B.add(TO, M.frame, ext([[-0.42, 0], [0.42, 0], [0.26, 0.5], [0, 0.9], [-0.26, 0.5]], 0.12, { bevel: 0.03 }), T([ax, 0.06, 0.95], [-PI / 2, 0, 0]), s);
  }
  B.finish((m) => { m.userData.ronin = 'yuki'; });

  for (const e of rig._eyes) {
    const g = e.geo.clone().applyMatrix4(e.m);
    if (e.flip) { const p = g.attributes.position; const idx = []; for (let i = 0; i < p.count; i += 3) idx.push(i, i + 2, i + 1); g.setIndex(idx); }
    g.translate(-rig.bind.head.x, -rig.bind.head.y, -rig.bind.head.z);
    const m = new THREE.Mesh(g, M.eye); m.frustumCulled = false; H.add(m);
  }

  // ================================================================= KODACHI x2 crossed at the lower back
  const mkSword = (name) => {
    const sw = sword(M, { name, len: 5, width: 0.3, thick: 0.08, curve: 0.12, tsubaZ: 0.38, habaki: 0.14, hiltBack: 1.15, hiltR: 0.15, tsubaR: 0.32, tsubaT: 0.09 });
    sw.traverse((o) => { if (o.material === M.steel) o.material = M.blade; });
    return sw;
  };
  const swR = mkSword('kodachiR'), swL = mkSword('kodachiL');
  const scR = scabbard(M, { name: 'sayaR', len: 5.3, width: 0.36, curve: 0.12, flat: 0.45, mat: 'saya' });
  const scL = scabbard(M, { name: 'sayaL', len: 5.3, width: 0.36, curve: 0.12, flat: 0.45, mat: 'saya' });
  frameAt(scR, rig.bind.pelvis, [-1.45, 9.0, -0.98], [0.93, -0.3, -0.22]);
  frameAt(scL, rig.bind.pelvis, [1.45, 9.2, -1.4], [-0.93, -0.3, -0.22]);
  J.pelvis.add(scR, scL);
  const arc = 5.3 * 5.3 / (2 * 0.12);
  const bR = new Blade(rig, { sword: swR, scabbard: scR, hand: J.handR, reverse: true, tsubaZ: 0.38, bladeLen: 5.2, gripGap: 0.6, arcR: arc, gripX: 0.08 });
  const bL = new Blade(rig, { sword: swL, scabbard: scL, hand: J.handL, reverse: true, tsubaZ: 0.38, bladeLen: 5.2, gripGap: 0.6, arcR: arc, gripX: 0.08 });
  rig.blades.push(bR, bL);

  // ================================================================= plume: 3 interleaved horsehair ribbons, 8 m
  const anc = rig.marker('head', [0, 13.88, -0.62], 'plumeRoot');
  const caps = [['thighL', 'shinL', 1.0], ['thighR', 'shinR', 1.0], ['armL', 'elbowL', 0.95], ['armR', 'elbowR', 0.95], ['elbowL', 'handL', 0.85], ['elbowR', 'handR', 0.85], ['pelvis', 'chest', 1.6]];
  const plumes = [0, 1, 2].map((i) => new Ribbon(rig, {
    name: 'plume' + i, mat: M.plume, anchor: anc, segs: 14, cols: 4, length: 8 - i * 0.6, drape: [(i - 1) * 0.15, 0.35, -1], fall: 0.75,
    waves: 1.3 + i * 0.2, speed: 8 + i, flutter: 0.28, twist: 0.6, seed: i * 2.1, cup: 0.35,
    width: (s) => (0.28 + (0.95 - i * 0.14) * Math.sin(Math.PI * Math.min(1, Math.pow(s, 0.6) * 1.05)) * (1 - 0.35 * s)), colLen: (c) => 0.88 + 0.12 * Math.abs(Math.sin(c * 9 + i)),
    clearZ: (y) => (y > 9.2 ? -1.3 : y > 6.0 ? -1.8 : -1.35), caps,
  }));
  rig.cloths.push(...plumes);

  const an = {
    head: rig.marker('head', [0, 12.9, 0.2], 'head'), eye: rig.marker('head', [0, 12.6, 0.85], 'eye'),
    mouth: rig.marker('head', [0, 12.2, 0.75], 'mouth'), ventL: rig.marker('head', [0.36, 12.2, 0.72], 'ventL'), ventR: rig.marker('head', [-0.36, 12.2, 0.72], 'ventR'),
    chest: rig.marker('chest', [0, 10.6, 1.15], 'chest'), handR: rig.marker('handR', [-d.wrist[0], d.wrist[1] - d.hand * 0.45, 0], 'handR'),
    handL: rig.marker('handL', [d.wrist[0], d.wrist[1] - d.hand * 0.45, 0], 'handL'),
    footL: rig.marker('footL', [d.ankle[0], 0, 0.3], 'footL'), footR: rig.marker('footR', [-d.ankle[0], 0, 0.3], 'footR'),
    scabbard: scR,
  };
  return { rig, M, blade: bR, blades: [bR, bL], cloth: plumes[0], cloths: plumes, eyeMats: [M.eye], eyeBase: { color: '#5CF2FF', int: 2.0 }, anchors: an, sword: swR, swords: [swR, swL] };
}
