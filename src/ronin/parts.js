// ronin/parts.js - shared armour parts: laced lamellar rows, gauntlets, armoured feet, pistons, swords, scabbards.
import * as THREE from 'three';
import { sheet, sub, band, bandFn, plateFn, tube, lathe, ext, box, cyl, sphere, sblob, sblobFn, white, T, Builder } from './kit.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// pairs of vertical cords crossing the top edge of a row (odoshi lacing); f = row surface fn (u across, v up)
export function laces(B, joint, mat, f, { cols = 8, v0 = 0.55, v1 = 1.12, w = 0.012, gap = 0.022, lift = 0.035, thick = 0.03, side = 1, u0 = 0.04, u1 = 0.96 } = {}) {
  for (let c = 0; c < cols; c++) {
    const u = u0 + (u1 - u0) * ((c + 0.5) / cols);
    for (const d of [-gap, gap]) {
      const g = sheet(sub(f, u + d - w, u + d + w, v0, Math.min(v1, 1), lift), 1, 2, thick);
      B.add(joint, mat, g, null, side);
      if (v1 > 1) { // the cord continues up over the gap to the row above: a short strip lifted a bit more
        const g2 = sheet(sub(f, u + d - w, u + d + w, 0.98, 1, lift), 1, 1, thick);
        const top = V(...f(u, 1)), top2 = V(...f(u, 0.9));
        const up = top.clone().sub(top2).normalize();
        B.add(joint, mat, g2, new THREE.Matrix4().makeTranslation(up.x * (v1 - 1) * 2, up.y * (v1 - 1) * 2, up.z * (v1 - 1) * 2), side);
      }
    }
  }
}
// thin trim strip along the bottom (v0..v1 small) or top of a row
export function trim(B, joint, mat, f, v0, v1, lift = 0.02, thick = 0.05, side = 1, nu = 16) {
  B.add(joint, mat, sheet(sub(f, 0, 1, v0, v1, lift), nu, 1, thick), null, side);
}
// gold pins (small domed rivets) on a surface
export function pins(B, joint, mat, f, uvs, r = 0.06, side = 1) {
  for (const [u, v] of uvs) {
    const p = V(...f(u, v));
    const g = sphere(r, 8, 6);
    B.add(joint, mat, g, T(p.toArray()), side);
  }
}
// stack of lamellar rows (fns from top to bottom), alternating materials, lacing on each row top
export function rows(B, joint, M, fns, { thick = 0.1, nu = 18, nv = 2, cols = 8, laceMat = 'lace', mats = ['lacqA', 'lacqB'], side = 1, trimLast = 'gold', laceOpts = {} } = {}) {
  fns.forEach((f, i) => {
    B.add(Array.isArray(joint) ? joint[i] : joint, M[mats[i % mats.length]], sheet(f, nu, nv, thick, { bev: 0.14, bevD: thick * 0.75 }), null, side);
    if (cols) laces(B, Array.isArray(joint) ? joint[i] : joint, M[laceMat], f, { cols, side, v1: i === 0 ? 1 : 1.1, ...laceOpts });
  });
  if (trimLast) trim(B, Array.isArray(joint) ? joint[fns.length - 1] : joint, M[trimLast], fns[fns.length - 1], 0, 0.1, 0.02, 0.04, side);
}

// gauntlet on the LEFT hand (mirror via side): wrist at w, hand length h, palm faces -X, fingers down, thumb +Z.
// Sculpted: rounded palm pod, tapered back plate (tekko) with a knuckle ridge, 4 two-phalanx fingers with domed
// armour caps, thumb with its own cap. Fingers curl about local Z (rig grip) so a fist closes on the hilt.
export function hand(B, rig, L, side, M, w, h, o = {}) {
  const J = rig.J, [x, y, z] = w;
  const pw = o.width ?? h * 0.56, pt = o.thick ?? h * 0.3, plen = h * 0.5;
  const back = M[o.back ?? 'lacqA'], back2 = M[o.back2 ?? 'lacqB'], trimM = M[o.trim ?? 'gold'];
  B.add(J['hand' + L], M.frame, sblob(pt * 0.5, plen * 0.55, pw * 0.5, 0.45, 0.35), T([x - pt * 0.05, y - plen * 0.5, z]), side);
  // tekko: curved back plate, wider over the knuckles, rolled edges
  const tk = (u, v) => { const zz = (u - 0.5) * pw * (0.9 + 0.25 * (1 - v)), yy = -v * plen * 1.05; return [x + pt * 0.5 + 0.12 * Math.cos((u - 0.5) * 2.4) * pw * 0.4 + 0.05 * Math.sin(v * Math.PI), y + 0.02 + yy, z + zz]; };
  B.add(J['hand' + L], back, sheet(tk, 6, 3, 0.07, { bev: 0.16 }), null, side);
  B.add(J['hand' + L], trimM, sblob(pt * 0.2, h * 0.05, pw * 0.58, 0.5, 0.3), T([x + pt * 0.5, y - plen * 1.0, z]), side);
  const fw = pw / 4;
  for (let i = 0; i < 4; i++) {
    const fz = z + (i - 1.5) * fw * 0.98;
    const sc = i === 3 ? 0.84 : i === 0 ? 0.95 : 1;
    const l1 = h * 0.27 * sc, l2 = h * 0.25 * sc;
    const k = y - plen;
    B.add(J['fing1' + L], M.frame, sblob(pt * 0.34, l1 * 0.58, fw * 0.42, 0.5, 0.45, 10, 6), T([x, k - l1 / 2, fz]), side);
    B.add(J['fing1' + L], back, sblob(pt * 0.2, l1 * 0.5, fw * 0.48, 0.6, 0.5, 8, 6), T([x + pt * 0.24, k - l1 / 2, fz]), side);
    const k2 = y - plen - h * 0.27;
    B.add(J['fing2' + L], M.frame, sblob(pt * 0.3, l2 * 0.56, fw * 0.39, 0.5, 0.45, 10, 6), T([x, k2 - l2 / 2, fz]), side);
    B.add(J['fing2' + L], back2, sblob(pt * 0.18, l2 * 0.5, fw * 0.44, 0.7, 0.5, 8, 6), T([x + pt * 0.22, k2 - l2 / 2 - l2 * 0.06, fz]), side);
  }
  const tj = rig.bind['thumb' + L];
  const tx = Math.abs(tj.x);
  B.add(J['thumb' + L], M.frame, sblob(pt * 0.3, h * 0.22, fw * 0.5, 0.5, 0.45, 10, 6), T([tx - 0.02, tj.y - h * 0.2, tj.z + 0.05], [0.35, 0, 0.15]), side);
  B.add(J['thumb' + L], back, sblob(pt * 0.16, h * 0.19, fw * 0.55, 0.6, 0.5, 8, 6), T([tx + pt * 0.2, tj.y - h * 0.2, tj.z + 0.05], [0.35, 0, 0.15]), side);
}

// bundle of cables hanging between two model-space points on one joint (frame detail at joints)
export function cables(B, joint, mat, a, b, n = 3, r = 0.06, sag = 0.3, spread = 0.14, side = 1) {
  for (let c = 0; c < n; c++) {
    const off = (c - (n - 1) / 2) * spread, pts = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([a[0] + (b[0] - a[0]) * t + off * 0.3, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag * (1 + c * 0.25), a[2] + (b[2] - a[2]) * t + off]); }
    B.add(joint, mat, tube(pts, pts.map(() => r), 6), null, side);
  }
}

// piston between two joints (housing on A points at B, rod on B points at A); updated by rig.updatePistons()
export function piston(rig, ja, pa, jb, pb, M, r, matH = 'frame', matR = 'steel') {
  const a = rig.marker(ja, pa, 'pA'), b = rig.marker(jb, pb, 'pB');
  const len = V(...pa).distanceTo(V(...pb));
  const h = new THREE.Mesh(white(cyl(r, r, len * 0.62, 10).rotateX(Math.PI / 2).translate(0, 0, len * 0.31)), M[matH]);
  const capA = new THREE.Mesh(white(sphere(r * 1.25, 10, 8)), M[matH]);
  const rod = new THREE.Mesh(white(cyl(r * 0.55, r * 0.55, len * 0.7, 8).rotateX(Math.PI / 2).translate(0, 0, len * 0.35)), M[matR]);
  const capB = new THREE.Mesh(white(sphere(r * 0.9, 10, 8)), M[matH]);
  a.add(h, capA); b.add(rod, capB);
  for (const m of [h, capA, rod, capB]) m.frustumCulled = false;
  rig.pistons = rig.pistons || [];
  rig.pistons.push({ a, b, h, rod });
}
export function updatePistons(rig) {
  for (const p of rig.pistons || []) {
    p.a.updateWorldMatrix(true, false); p.b.updateWorldMatrix(true, false);
    const A = p.a.getWorldPosition(V()), Bp = p.b.getWorldPosition(V());
    p.h.lookAt(Bp); p.rod.lookAt(A);
    // lookAt on a child aims +Z of the mesh (non-camera) toward the target in world space
  }
}

// ------------------------------------------------------------------ swords
// sword group: origin = grip centre, +Z along the blade, edge toward -Y (spine +Y), blade curves toward +Y.
export function sword(M, o) {
  const g = new THREE.Group(); g.name = o.name;
  const B = new Builder();
  g.updateMatrixWorld(true);
  const { len, width, thick, curve, tsubaZ, hiltBack, hiltR, tsubaR } = o;
  const z0 = tsubaZ + o.habaki;
  const yOff = (s) => curve * s * s;
  const wAt = (s) => (s < 0.9 ? width * (1 - 0.22 * s / 0.9) : width * 0.78 * Math.sqrt(Math.max(0, 1 - ((s - 0.9) / 0.1) ** 2)));
  // section around the blade: spine (top), shinogi ridges, edge; v along the blade
  const sec = (u, s) => {
    const w = Math.max(wAt(s), 0.004), wf = width * (1 - 0.22 * Math.min(s, 0.9) / 0.9);
    const yc = wf / 2 - w / 2;                       // spine line continuous, the kissaki edge sweeps up
    const tt = thick * (0.35 + 0.65 * (1 - s * 0.6)) * (w / Math.max(wf, 1e-3)) ** 0.3;
    const P = [[0, w / 2], [tt / 2, w * 0.42], [tt * 0.55, w * 0.18], [0, -w / 2], [-tt * 0.55, w * 0.18], [-tt / 2, w * 0.42], [0, w / 2]];
    const fu = u * 6, i = Math.min(5, Math.floor(fu)), f = fu - i;
    return [P[i][0] + (P[i + 1][0] - P[i][0]) * f, yc + P[i][1] + (P[i + 1][1] - P[i][1]) * f];
  };
  const bladeFn = (u, v) => { const s = v; const [x, y] = sec(1 - u, s); return [x, y + yOff(s), z0 + s * len]; };
  B.add(g, M.steel, sheet(bladeFn, 24, 40, 0));
  // bright edge (hamon side) strips on both faces
  for (const sgn of [1, -1]) {
    const ef = (u, v) => {
      const s = v, w = Math.max(wAt(s), 0.004), wf = width * (1 - 0.22 * Math.min(s, 0.9) / 0.9), yc = wf / 2 - w / 2;
      const tt = thick * (0.35 + 0.65 * (1 - s * 0.6)) * (w / Math.max(wf, 1e-3)) ** 0.3;
      const ham = 0.18 + 0.05 * Math.sin(s * 60) + 0.03 * Math.sin(s * 23 + 1);
      const yy = -w / 2 + (w * (0.5 + ham) - w / 2 + w / 2) * u * 0.62;
      const x = sgn * (tt * 0.55) * ((yy + w / 2) / (w * 0.68)) + sgn * 0.004;
      return [x, yc + yy + yOff(s), z0 + s * len];
    };
    B.add(g, M.edge, sheet(ef, 2, 40, 0, { flip: sgn > 0 }));
  }
  // habaki collar, tsuba, seppa, hilt with diamond wrap, pommel
  B.add(g, M.gold, box(thick * 1.6, width * 1.05, o.habaki), T([0, 0, tsubaZ + o.habaki / 2]));
  const tsuba = lathe([[0, -0.5], [tsubaR, -0.5], [tsubaR * 1.04, 0], [tsubaR, 0.5], [0, 0.5]].map(([r, y]) => [r, y * o.tsubaT]), 28);
  B.add(g, M[o.tsubaMat ?? 'gold'], tsuba, T([0, 0, tsubaZ], [Math.PI / 2, 0, 0], [1, 1, 0.82]));
  const ring = lathe([[tsubaR * 0.7, -0.6], [tsubaR * 0.78, -0.6], [tsubaR * 0.78, 0.6], [tsubaR * 0.7, 0.6]].map(([r, y]) => [r, y * o.tsubaT * 1.2]), 28);
  B.add(g, M.lacqB ?? M.frame, ring, T([0, 0, tsubaZ], [Math.PI / 2, 0, 0], [1, 1, 0.82]));
  const hilt = sheet((u, v) => { const a = u * Math.PI * 2, z = tsubaZ - 0.02 - v * hiltBack; const r = hiltR * (1 - 0.12 * Math.sin(v * Math.PI)); return [Math.cos(a) * r * 0.82, Math.sin(a) * r, z]; }, 16, 6, 0, { closeU: true, flip: true });
  B.add(g, M.wrap, hilt);
  B.add(g, M.gold, cyl(hiltR * 1.08, hiltR * 1.12, hiltR * 0.9, 16).rotateX(Math.PI / 2), T([0, 0, tsubaZ - hiltBack - hiltR * 0.4], [0, 0, 0], [0.84, 1, 1]));
  B.add(g, M.gold, cyl(hiltR * 1.12, hiltR * 1.05, hiltR * 0.5, 16).rotateX(Math.PI / 2), T([0, 0, tsubaZ - 0.05], [0, 0, 0], [0.84, 1, 1]));
  B.finish();
  g.userData = { tip: V(0, width * 0.3 + yOff(1), z0 + len), base: V(0, 0, z0) };
  return g;
}
// scabbard group: origin = mouth, +Z toward the tip, blade inside edge UP (curve toward -Y)
export function scabbard(M, o) {
  const g = new THREE.Group(); g.name = o.name;
  g.updateMatrixWorld(true);
  const B = new Builder();
  const { len, width, curve, mat } = o;
  const yOff = (s) => -curve * s * s;
  const f = (u, v) => { const a = u * Math.PI * 2, s = v; const w = width * (1 - 0.18 * s); return [Math.cos(a) * w * o.flat, Math.sin(a) * w * 0.5 + yOff(s) - width * 0.02, s * len]; };
  B.add(g, M[mat], sheet(f, 16, 24, 0, { closeU: true }));
  // koiguchi (mouth fitting), kurikata knob, kojiri cap
  B.add(g, M[o.fit ?? 'gold'], sheet(sub(f, 0, 1, 0, 0.035, 0.03), 16, 1, 0.04, { closeU: true }));
  B.add(g, M[o.fit ?? 'gold'], sheet(sub(f, 0, 1, 0.955, 1, 0.03), 16, 2, 0.04, { closeU: true }));
  const fc = (z) => V(...f(0.25, z / len));
  // red cord (sageo): wraps near the mouth + a loose loop
  if (o.cord) {
    const k = fc(len * 0.08);
    B.add(g, M[o.knobMat ?? 'lacqB'], box(width * 0.25, width * 0.25, width * 0.5), T([0, k.y + width * 0.04, k.z]));
    for (let i = 0; i < 3; i++) {
      const zz = len * (0.1 + i * 0.03);
      const pts = []; const radii = [];
      for (let j = 0; j <= 12; j++) { const a = (j / 12) * Math.PI * 2; const c = V(...f(0, zz / len)).lerp(V(...f(0.5, zz / len)), 0.5); pts.push([Math.cos(a) * width * o.flat * 1.06, c.y + Math.sin(a) * width * 0.53, zz + j * 0.004]); radii.push(o.cordR); }
      B.add(g, M[o.cord], tube(pts, radii, 6));
    }
    const p0 = V(...f(0.75, 0.1)), loop = [];
    for (let j = 0; j <= 10; j++) { const s = j / 10; loop.push([Math.sin(s * Math.PI) * width * 0.6, p0.y - Math.sin(s * Math.PI) * width * 2.4, len * (0.1 + s * 0.22)]); }
    B.add(g, M[o.cord], tube(loop, loop.map(() => o.cordR), 6, { sub: 2 }));
  }
  B.finish();
  return g;
}
// place a group at a model-space point with +Z along dir and +Y as close to up as possible
export function frameAt(obj, parentBind, p, dir, up = [0, 1, 0]) {
  const Z = V(...dir).normalize(), X = V(...up).cross(Z).normalize(), Y = Z.clone().cross(X);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  obj.position.set(p[0] - parentBind.x, p[1] - parentBind.y, p[2] - parentBind.z);
}
