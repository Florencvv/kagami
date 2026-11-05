// ronin/kit.js - procedural hard-surface kit for the mecha ronin (dept RONIN).
// sheet(): thick curved plates from a parametric surface (outer smooth, inner + walls crisp -> ink at plate edges),
// ext(): extruded flat shapes (crests, tsuba, blades), Builder: parts authored in MODEL (bind) space, baked into
// the joint frame and merged per (joint, material) so a whole ronin is ~100 draw calls.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const D2R = Math.PI / 180;

// ---------------------------------------------------------------- geometry primitives
// edge tint: bevelled plate edges get this vertex colour (x base/shade), set per ronin before building.
// Dark lacquer gets a LIGHTER edge (reads as a lit lacquer bevel next to the ink line), white armour a lavender one.
let EDGE = [1, 1, 1];
export function setEdge(c) { EDGE = c.slice(); }
// fn(u, v) -> [x, y, z]; du x dv must point OUT of the plate (o.flip to invert). thick > 0 grows inward.
// o.bev = bevel width (fraction of u/v) -> the plate edge rolls inward by o.bevD (default 0.7 thick) with a tilted
// normal and the EDGE tint: a chamfer that catches its own highlight and outlines every plate.
export function sheet(fn, nu, nv, thick, o = {}) {
  const at = (u, v) => { const a = fn(u, v); return V(a[0], a[1], a[2]); };
  const e = 1e-3;
  const bev = o.bev ?? 0, bevD = o.bevD ?? thick * 0.7;
  const us = [], vs = [];
  for (let i = 0; i <= nu; i++) us.push(i / nu);
  for (let j = 0; j <= nv; j++) vs.push(j / nv);
  if (bev > 0) {
    const bv = Math.min(bev, 0.45 / Math.max(1, nv) * nv);
    vs.splice(1, 0, Math.min(bev, vs[1] * 0.5)); vs.splice(vs.length - 1, 0, 1 - Math.min(bev, (1 - vs[vs.length - 2]) * 0.5));
    if (!o.closeU) { us.splice(1, 0, Math.min(bev, us[1] * 0.5)); us.splice(us.length - 1, 0, 1 - Math.min(bev, (1 - us[us.length - 2]) * 0.5)); }
  }
  const NU = us.length - 1, NV = vs.length - 1;
  const P = [], N = [], C = [], base = [], BN = [];
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const u = us[i], v = vs[j];
    const p = at(u, v);
    const u0 = Math.max(0, u - e), u1 = Math.min(1, u + e), v0 = Math.max(0, v - e), v1 = Math.min(1, v + e);
    const du = at(u1, v).sub(at(u0, v)), dv = at(u, v1).sub(at(u, v0));
    const n = du.clone().cross(dv);
    if (n.lengthSq() < 1e-14) n.set(0, 1, 0);
    n.normalize(); if (o.flip) n.negate();
    base.push(p.clone()); BN.push(n.clone());
    let c = 1;
    if (bev > 0) {
      const out = V();
      if (j === 0) out.addScaledVector(dv.clone().normalize(), -1);
      if (j === NV) out.addScaledVector(dv.clone().normalize(), 1);
      if (!o.closeU && i === 0) out.addScaledVector(du.clone().normalize(), -1);
      if (!o.closeU && i === NU) out.addScaledVector(du.clone().normalize(), 1);
      if (out.lengthSq() > 1e-8) {
        out.addScaledVector(n, -out.dot(n)).normalize();
        p.addScaledVector(n, -bevD);
        n.multiplyScalar(0.55).addScaledVector(out, 0.85).normalize();
        c = 0;
      }
    }
    P.push(p); N.push(n); C.push(c);
  }
  const idx = (i, j) => j * (NU + 1) + i;
  const pos = [], nor = [], uv = [], col = [];
  const inner = (k) => base[k].clone().addScaledVector(BN[k], -thick);
  const push = (p, n, u, v, c = 1) => { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); uv.push(u, v); const t = c ? [1, 1, 1] : EDGE; col.push(t[0], t[1], t[2]); };
  const UV = (k) => [us[k % (NU + 1)], vs[Math.floor(k / (NU + 1))]];
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const a = idx(i, j), b = idx(i + 1, j), c = idx(i + 1, j + 1), d = idx(i, j + 1);
    const tri = o.flip ? [[a, c, b], [a, d, c]] : [[a, b, c], [a, c, d]];
    for (const t of tri) for (const k of t) push(P[k], N[k], ...UV(k), C[k]);
    if (thick > 0) {
      const tri2 = o.flip ? [[a, b, c], [a, c, d]] : [[a, c, b], [a, d, c]];
      for (const t of tri2) for (const k of t) push(inner(k), BN[k].clone().negate(), ...UV(k));
    }
  }
  if (thick > 0) {
    const wall = (k0, k1, out) => {
      const A = P[k0], B = P[k1], Cc = inner(k1), Dd = inner(k0);
      const n = B.clone().sub(A).cross(Cc.clone().sub(A));
      if (n.lengthSq() < 1e-14) return;
      n.normalize();
      let q = [A, B, Cc, A, Cc, Dd];
      if (n.dot(out) < 0) { q = [A, Cc, B, A, Dd, Cc]; n.negate(); }
      for (const p of q) push(p, n, 0, 0, bev > 0 ? 0 : 1);
    };
    for (let i = 0; i < NU; i++) {
      wall(idx(i, 0), idx(i + 1, 0), base[idx(i, 0)].clone().sub(base[idx(i, 1)]));
      wall(idx(i, NV), idx(i + 1, NV), base[idx(i, NV)].clone().sub(base[idx(i, NV - 1)]));
    }
    if (!o.closeU) for (let j = 0; j < NV; j++) {
      wall(idx(0, j), idx(0, j + 1), base[idx(0, j)].clone().sub(base[idx(1, j)]));
      wall(idx(NU, j), idx(NU, j + 1), base[idx(NU, j)].clone().sub(base[idx(NU - 1, j)]));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// elliptic band around the Y axis: angles in radians (0 = +Z front, positive toward +X), rx/rz at top & bottom
// (y0 bottom, y1 top), optional bulge (outward bow at mid height) and edge fn(u) -> extra drop at the bottom edge
export function bandFn({ y0, y1, rx0, rz0, rx1 = rx0, rz1 = rz0, a0 = -Math.PI, a1 = Math.PI, bulge = 0, cx = 0, cz = 0, drop = null, p = 2, keel = 0, keelP = 6, flare = 0, flareP = 3, lean = 0, ease = null }) {
  const ex = 2 / p;
  return (u, v) => {
    const a = a0 + (a1 - a0) * u;
    const b = Math.sin(v * Math.PI) * bulge + flare * Math.pow(1 - v, flareP);
    const w = ease ? ease(v) : v;
    const rx = rx0 + (rx1 - rx0) * w + b, rz = rz0 + (rz1 - rz0) * w + b;
    const y = y0 + (y1 - y0) * v - (drop ? drop(u) * (1 - v) : 0);
    const sa = Math.sin(a), ca = Math.cos(a);
    const sx = Math.sign(sa) * Math.pow(Math.abs(sa), ex), sz = Math.sign(ca) * Math.pow(Math.abs(ca), ex);
    const k = keel * Math.pow(Math.max(0, ca), keelP);
    return [cx + sx * rx, y, cz + sz * rz + k + lean * (v - 0.5)];
  };
}
export function band(o) { return sheet(bandFn(o), o.nu ?? 24, o.nv ?? 3, o.thick ?? 0.12, { closeU: !!o.closed, bev: o.bev ?? 0.12, bevD: o.bevD }); }
// superellipsoid solid (rounded boxes / pods): e < 1 boxy, 1 ellipsoid. Used for hands, toe caps, frame pods.
export function sblobFn(rx, ry, rz, e = 0.4, e2 = e, c = [0, 0, 0]) {
  const sp = (x, k) => Math.sign(x) * Math.pow(Math.abs(x), k);
  return (u, v) => { const a = u * Math.PI * 2, l = -Math.PI / 2 + 0.02 + v * (Math.PI - 0.04);
    return [c[0] + rx * sp(Math.cos(l), e) * sp(Math.sin(a), e2), c[1] + ry * sp(Math.sin(l), e), c[2] + rz * sp(Math.cos(l), e) * sp(Math.cos(a), e2)]; };
}
export function sblob(rx, ry, rz, e = 0.4, e2 = e, nu = 16, nv = 10) { return sheet(sblobFn(rx, ry, rz, e, e2), nu, nv, 0, { closeU: true }); }

// ellipsoid cap / dome: lat from l0 to l1 (radians, -PI/2..PI/2), lon a0..a1 (0 = +Z)
export function domeFn({ rx, ry, rz, l0 = 0, l1 = Math.PI / 2 - 0.02, a0 = -Math.PI, a1 = Math.PI, cx = 0, cy = 0, cz = 0, squash = null }) {
  return (u, v) => {
    const a = a0 + (a1 - a0) * u, l = l0 + (l1 - l0) * v;
    const s = squash ? squash(a, l) : 1;
    return [cx + Math.sin(a) * Math.cos(l) * rx * s, cy + Math.sin(l) * ry, cz + Math.cos(a) * Math.cos(l) * rz * s];
  };
}
export function dome(o) { return sheet(domeFn(o), o.nu ?? 28, o.nv ?? 8, o.thick ?? 0.1, { closeU: !!o.closed }); }
// sub-patch of a surface fn, lifted along its normal (lacing, trims, ribs glued onto plates)
export function sub(f, u0, u1, v0, v1, lift = 0) {
  const e = 1e-3;
  return (u, v) => {
    const uu = u0 + (u1 - u0) * u, vv = v0 + (v1 - v0) * v;
    const p = V(...f(uu, vv));
    if (!lift) return p.toArray();
    const du = V(...f(Math.min(1, uu + e), vv)).sub(V(...f(Math.max(0, uu - e), vv)));
    const dv = V(...f(uu, Math.min(1, vv + e))).sub(V(...f(uu, Math.max(0, vv - e))));
    const n = du.cross(dv).normalize();
    return p.addScaledVector(n, lift).toArray();
  };
}
// transform a surface fn by a Matrix4
export function xf(f, M) { return (u, v) => V(...f(u, v)).applyMatrix4(M).toArray(); }

// flat plate (rectangle in XY, facing +Z) with optional curvature around Y (radius cr) and taper; centred on origin top edge
export function plateFn({ w, h, cr = 0, crV = 0, taper = 0, skew = 0 }) {
  return (u, v) => {
    const ww = w * (1 - taper * (1 - v));
    let x = (u - 0.5) * ww + skew * (1 - v), y = -h + v * h, z = 0;   // v=1 top edge at y=0
    if (cr) { const a = x / cr; z = cr * Math.cos(a) - cr; x = cr * Math.sin(a); }
    if (crV) { const a = (y + h / 2) / crV; z += crV * Math.cos(a) - crV; y = -h / 2 + crV * Math.sin(a); }
    return [x, y, z];
  };
}
export function plate(o) { return sheet(plateFn(o), o.nu ?? 6, o.nv ?? 2, o.thick ?? 0.1, { bev: o.bev ?? 0.12 }); }
// give a raw geometry a white colour attribute (meshes outside the Builder that use vertex-colour cel materials)
export function white(g) { g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3)); return g; }

// tube along a polyline of points with radii (capsule-like frames, cords, hilts, pistons)
export function tube(pts, radii, seg = 10, o = {}) {
  const path = pts.map((p) => V(...p));
  const n = path.length;
  return sheet((u, v) => {
    const fi = v * (n - 1), i = Math.min(n - 2, Math.floor(fi)), f = fi - i;
    const p = path[i].clone().lerp(path[i + 1], f);
    const r = radii[i] + (radii[i + 1] - radii[i]) * f;
    const t = path[i + 1].clone().sub(path[i]).normalize();
    const ref = Math.abs(t.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0);
    const b1 = ref.clone().cross(t).normalize(), b2 = t.clone().cross(b1);
    const a = u * Math.PI * 2;
    const sx = o.sx ?? 1, sz = o.sz ?? 1;
    return p.addScaledVector(b1, Math.cos(a) * r * sx).addScaledVector(b2, Math.sin(a) * r * sz).toArray();
  }, seg, (n - 1) * (o.sub ?? 1), 0, { closeU: true, flip: !!o.flip });
}

// closed lathe solid (pistons, rivets, hilts)
export function lathe(profile, seg = 16) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  return g.toNonIndexed();
}

// extruded flat shape: pts [[x,y],...] in the XY plane, depth along Z (centred)
export function ext(pts, depth, o = {}) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  if (o.holes) for (const h of o.holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const bev = o.bevel ?? 0;
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev * (o.bevelSize ?? 1), bevelSegments: 1, curveSegments: o.curve ?? 12 });
  g.translate(0, 0, -depth / 2);
  g.deleteAttribute('uv'); const n = g.attributes.position.count;
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  return g.index ? g.toNonIndexed() : g;
}
export function box(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  return g;
}
export function cyl(rt, rb, h, seg = 12, open = false) { return new THREE.CylinderGeometry(rt, rb, h, seg, 1, open).toNonIndexed(); }
export function sphere(r, ws = 14, hs = 10) { return new THREE.SphereGeometry(r, ws, hs).toNonIndexed(); }

// crescent (two arcs), horns up, width w, height h, centred at the bottom middle
export function crescentPts(w, h, thick, n = 28) {
  const outer = [], inner = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = (t - 0.5) * w;
    const k = Math.pow(Math.abs(2 * t - 1), 2.2);
    outer.push([x, h * k - thick * (1 - k) * 0.4]);
    inner.push([x * 0.93, h * Math.pow(Math.abs(2 * t - 1), 1.7) * 0.97 + thick * (1 - k)]);
  }
  outer[0][1] = inner[0][1] = h; outer[n][1] = inner[n][1] = h;
  return outer.concat(inner.slice(1, n).reverse());
}

// ---------------------------------------------------------------- materials (cel, kept small)
export function mats(A, defs) {
  const out = {};
  for (const [k, d] of Object.entries(defs)) {
    out[k] = d.fx ? A.fxMaterial(d) : A.celMaterial({ vertexColors: true, ...d });
    out[k].name = 'ronin_' + k;
  }
  return out;
}

// canvas textures (pure, seeded by pattern only)
export function lameTexture({ cols = 10, line = '#585870', bg = '#ffffff', w = 512, h = 64, band = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  // bevel shade near the bottom edge, highlight line near the top (lacquer edge)
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.75, '#f2f2f8'); gr.addColorStop(1, '#c8c8d8');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  if (band) {   // painted lacquer: one crisp reflection band under the top edge, darker body, deeper bottom bevel
    g.fillStyle = '#9c9cb2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; g.fillRect(0, h * 0.1, w, h * 0.17);
    g.fillStyle = '#c4c4d6'; g.fillRect(0, h * 0.31, w, h * 0.04);
    g.fillStyle = '#7c7c96'; g.fillRect(0, h * 0.86, w, h * 0.14);
  }
  g.strokeStyle = line; g.lineWidth = 3;
  for (let i = 0; i <= cols; i++) { const x = (i / cols) * w; g.beginPath(); g.moveTo(x, h * 0.08); g.lineTo(x, h); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
export function wrapTexture({ wrap = '#1a1420', diamond = '#c9a24a', w = 128, h = 512, n = 9 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = diamond; g.fillRect(0, 0, w, h);
  g.fillStyle = wrap;
  const step = h / n;
  for (let i = 0; i < n; i++) {           // crossing wrap bands leave diamond windows (hishigami) of the under layer
    const y = i * step;
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + step * 0.5); g.lineTo(w, y + step * 0.5 + step * 0.22); g.lineTo(0, y + step * 0.22); g.fill();
    g.beginPath(); g.moveTo(w, y); g.lineTo(0, y + step * 0.5); g.lineTo(0, y + step * 0.5 + step * 0.22); g.lineTo(w, y + step * 0.22); g.fill();
  }
  g.globalAlpha = 0.35; g.fillStyle = '#000';
  for (let i = 0; i < n; i++) g.fillRect(0, i * step + step * 0.47, w, step * 0.06);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------- builder: model-space parts -> merged meshes per joint
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export function T(p = [0, 0, 0], r = [0, 0, 0], s = 1) {
  _e.set(r[0], r[1], r[2], 'XYZ'); _q.setFromEuler(_e);
  if (typeof s === 'number') _s.set(s, s, s); else _s.set(...s);
  return new THREE.Matrix4().compose(_p.set(...p), _q, _s);
}
const MIRROR = new THREE.Matrix4().makeScale(-1, 1, 1);

export class Builder {
  constructor() { this.buckets = new Map(); }
  // joint: Object3D whose matrixWorld is its MODEL-space bind matrix (call root.updateMatrixWorld first)
  add(joint, mat, geo, M = null, side = 1) {
    let m = M ? M.clone() : new THREE.Matrix4();
    if (side < 0) m.premultiply(MIRROR);
    const key = joint.uuid + '|' + mat.uuid;
    if (!this.buckets.has(key)) this.buckets.set(key, { joint, mat, parts: [] });
    this.buckets.get(key).parts.push({ geo, m });
    return this;
  }
  finish(onMesh) {
    for (const { joint, mat, parts } of this.buckets.values()) {
      const inv = new THREE.Matrix4().copy(joint.matrixWorld).invert();
      let count = 0;
      for (const p of parts) count += (p.geo.index ? p.geo.index.count : p.geo.attributes.position.count);
      const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2), col = new Float32Array(count * 3).fill(1);
      let o = 0;
      const v = new THREE.Vector3(), nm = new THREE.Matrix3();
      for (const p of parts) {
        const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
        const M = inv.clone().multiply(p.m);
        nm.getNormalMatrix(M);
        const flipW = M.determinant() < 0;
        const P = g.attributes.position, Nn = g.attributes.normal, U = g.attributes.uv, Cc = g.attributes.color;
        if (!Nn) g.computeVertexNormals();
        const NN = g.attributes.normal;
        for (let i = 0; i < P.count; i++) {
          let k = i;
          if (flipW) { const r = i % 3; k = r === 1 ? i + 1 : r === 2 ? i - 1 : i; }
          v.fromBufferAttribute(P, k).applyMatrix4(M); pos.set([v.x, v.y, v.z], (o + i) * 3);
          v.fromBufferAttribute(NN, k).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], (o + i) * 3);
          if (U) uv.set([U.getX(k), U.getY(k)], (o + i) * 2);
          if (Cc) col.set([Cc.getX(k), Cc.getY(k), Cc.getZ(k)], (o + i) * 3);
        }
        o += P.count;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      joint.add(mesh);
      if (onMesh) onMesh(mesh);
    }
    this.buckets.clear();
  }
}
