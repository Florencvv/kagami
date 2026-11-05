// lands_geo.js - small geometry helpers for dept LANDS (merge, rounded boxes, rocks, vertex colour masks).
import * as THREE from 'three';

// merge geometries (non-indexed) keeping position / normal / color (missing colour -> white)
export function merge(geos) {
  const P = [], N = [], C = [];
  for (let g of geos) {
    g = g.index ? g.toNonIndexed() : g;
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i));
      if (c) C.push(c.getX(i), c.getY(i), c.getZ(i)); else C.push(1, 1, 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(P.length / 3 * 2), 2));
  return g;
}
// place a geometry: clone + transform
export function placed(g, pos, rot = [0, 0, 0], scl = [1, 1, 1]) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, 'YXZ')), new THREE.Vector3(...scl));
  return g.clone().applyMatrix4(m);
}
// rounded box: subdivided box whose corners/edges are rounded with radius r (no boxy look)
export function roundBox(w, h, d, r = 0.1, seg = 3) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const p = g.attributes.position, hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r, v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(THREE.MathUtils.clamp(v.x, -hw, hw), THREE.MathUtils.clamp(v.y, -hh, hh), THREE.MathUtils.clamp(v.z, -hd, hd));
    const o = v.clone().sub(c); if (o.lengthSq() > 1e-9) o.setLength(r);
    p.setXYZ(i, c.x + o.x, c.y + o.y, c.z + o.z);
  }
  g.computeVertexNormals(); return g;
}
// jagged rock: displaced icosahedron, flattened planes (chiselled), seeded
export function rockGeo(rng, r = 1, detail = 2, flat = 0.35) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position, v = new THREE.Vector3();
  const planes = Array.from({ length: 7 }, () => ({ n: new THREE.Vector3(rng() - 0.5, rng() - 0.3, rng() - 0.5).normalize(), d: r * (0.55 + rng() * 0.3) }));
  const s = [rng() * 10, rng() * 10, rng() * 10];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 2.1 + s[0]) * Math.sin(v.y * 2.7 + s[1]) * Math.sin(v.z * 2.3 + s[2]);
    v.multiplyScalar(1 + n * 0.18);
    for (const pl of planes) { const k = v.dot(pl.n); if (k > pl.d) v.addScaledVector(pl.n, -(k - pl.d) * (1 - flat * 0.3)); }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  // merge the duplicated seam vertices so normals come out smooth (cel shading draws the planes, not the polygons)
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  const P = g.attributes.position, map = new Map(), idx = [], pos = [];
  for (let i = 0; i < P.count; i++) {
    const k = `${P.getX(i).toFixed(4)},${P.getY(i).toFixed(4)},${P.getZ(i).toFixed(4)}`;
    let j = map.get(k); if (j === undefined) { j = pos.length / 3; map.set(k, j); pos.push(P.getX(i), P.getY(i), P.getZ(i)); }
    idx.push(j);
  }
  const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (g.index) { const I = g.index.array; ng.setIndex(Array.from(I, (v) => idx[v])); } else ng.setIndex(idx);
  ng.computeVertexNormals();
  return ng;
}
// vertex colours by facing: up-facing (with noise) gets `top` (snow / moss), others `side`
export function colorByUp(g, side, top, th = 0.55, noise = 0.15, seed = 1, extra) {
  const p = g.attributes.position, n = g.attributes.normal, C = new Float32Array(p.count * 3);
  const cs = new THREE.Color(side), ct = new THREE.Color(top), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const nz = Math.sin(x * 3.1 + seed) * Math.sin(z * 2.7 + seed * 2) * Math.sin(y * 1.9 + seed * 3);
    const up = n.getY(i) + nz * noise;
    c.copy(up > th ? ct : cs);
    if (extra) extra(c, x, y, z, n.getY(i));
    C[i * 3] = c.r; C[i * 3 + 1] = c.g; C[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  return g;
}
export function tint(g, col) {
  const p = g.attributes.position, C = new Float32Array(p.count * 3), c = new THREE.Color(col);
  for (let i = 0; i < p.count; i++) { C[i * 3] = c.r; C[i * 3 + 1] = c.g; C[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(C, 3)); return g;
}
