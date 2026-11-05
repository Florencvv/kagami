// ronin/rig.js - joint hierarchy, two-bone IK (legs always, arms by hand targets), pose blending, walk/run cycles,
// cloth/plume ribbons on procedural bone chains (pure functions of t), blades with scabbards. Dept RONIN.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _v1 = V(), _v2 = V(), _v3 = V(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

// ---------------------------------------------------------------- pose format
// Every pose is a flat dict of number arrays (so any two poses blend by lerp). Authoring keys:
//  hipsPos [x,y,z] (offset of the pelvis), hips/spine/chest/neck/head/shL/shR [rx,ry,rz] Euler XYZ radians
//  handLp/handRp [x,y,z] root-space hand target (wrist), handLz/handRz fist axis (thumb side / blade dir),
//  handLf/handRf finger dir (= blade edge dir), elbowL/elbowR pole dir, gripL/gripR [0..1] fist,
//  hiltR [w] right hand on the sheathed hilt, mouthL [w] left hand on the scabbard mouth, twoHand [w] left hand on
//  the hilt behind the right (drawn blade), footL/footR [dx, lift, dz, pitch, yaw, roll] (ankle offset from bind,
//  root space), kneeL/kneeR pole, toeL/toeR [bend], sode [L, R] extra swing, kusa [k] extra flare, lookY yaw of head.
export const POSE_KEYS = {
  hipsPos: [0, 0, 0], hips: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0],
  shL: [0, 0, 0], shR: [0, 0, 0],
  handLp: null, handRp: null, handLz: [0, 0, 1], handRz: [0, 0, 1], handLf: [0, -1, 0], handRf: [0, -1, 0],
  elbowL: [0.5, -0.2, -1], elbowR: [-0.5, -0.2, -1], gripL: [0.5], gripR: [0.5],
  hiltR: [0], mouthL: [0], twoHand: [0], hiltL: [0],
  footL: [0, 0, 0, 0, 0, 0], footR: [0, 0, 0, 0, 0, 0], kneeL: [0.1, 0, 1], kneeR: [-0.1, 0, 1], toeL: [0], toeR: [0],
  sode: [0, 0], kusa: [0],
};
export function fullPose(spec, p = {}) {
  const o = {};
  for (const [k, d] of Object.entries(POSE_KEYS)) o[k] = (p[k] ?? d ?? spec.defaults[k]).slice();
  return o;
}
export function lerpPose(a, b, k) {
  const o = {};
  for (const key of Object.keys(a)) { const x = a[key], y = b[key] ?? x; o[key] = x.map((v, i) => v + ((y[i] ?? v) - v) * k); }
  return o;
}
export const mirV = (v) => [-v[0], v[1], v[2]];          // positions / directions across the YZ plane
export const mirR = (r) => [r[0], -r[1], -r[2]];         // Euler rotations

// ---------------------------------------------------------------- rig
export class Rig {
  constructor(spec) {
    this.spec = spec;
    this.root = new THREE.Group(); this.root.name = spec.name;
    this.body = new THREE.Group(); this.root.add(this.body);
    this.J = {};
    this.bind = {};
    const mk = (name, parent, p) => {
      const g = new THREE.Group(); g.name = spec.name + '.' + name;
      const pp = parent === this.body ? V() : this.bind[parent.userData.jn];
      g.position.set(p[0] - pp.x, p[1] - pp.y, p[2] - pp.z);
      g.userData.jn = name; this.bind[name] = V(...p); this.J[name] = g; parent.add(g); return g;
    };
    const s = spec.dims;
    const pel = mk('pelvis', this.body, s.pelvis);
    const spi = mk('spine', pel, s.spine);
    const che = mk('chest', spi, s.chest);
    const nec = mk('neck', che, s.neck);
    mk('head', nec, s.head);
    for (const [L, sg] of [['L', 1], ['R', -1]]) {
      const X = (p) => [p[0] * sg, p[1], p[2]];
      const cl = mk('sh' + L, che, X(s.clav));
      const ar = mk('arm' + L, cl, X(s.shoulder));
      const el = mk('elbow' + L, ar, X(s.elbow));
      const ha = mk('hand' + L, el, X(s.wrist));
      const kn = [s.wrist[0], s.wrist[1] - s.hand * 0.5, s.wrist[2]];
      const f1 = mk('fing1' + L, ha, X(kn));
      mk('fing2' + L, f1, X([kn[0], kn[1] - s.hand * 0.27, kn[2]]));
      mk('thumb' + L, ha, X([s.wrist[0] - 0.12 * s.hand, s.wrist[1] - s.hand * 0.22, s.wrist[2] + 0.22 * s.hand]));
      const th = mk('thigh' + L, pel, X(s.hip));
      const sh = mk('shin' + L, th, X(s.knee));
      const ft = mk('foot' + L, sh, X(s.ankle));
      mk('toe' + L, ft, X(s.toe));
      // sode rows (chain, each row hangs from the one above) on the clavicle
      if (s.sode) { let par = cl; for (let i = 0; i < s.sode.rows; i++) par = mk(`sode${L}${i}`, par, X([s.sode.x, s.sode.y - i * s.sode.rowH, s.sode.z])); }
    }
    this.kusa = [];
    if (s.kusa) for (let i = 0; i < s.kusa.n; i++) {
      const a = s.kusa.angles[i];
      const g = mk('kusa' + i, pel, [Math.sin(a) * s.kusa.rx, s.kusa.y, Math.cos(a) * s.kusa.rz]);
      g.userData.a = a; this.kusa.push(g);
    }
    this.L = { thigh: s.hip[1] - s.knee[1], shin: s.knee[1] - s.ankle[1], arm: s.shoulder[1] - s.elbow[1], fore: s.elbow[1] - s.wrist[1] };
    this.root.updateMatrixWorld(true);
    this.cur = null;
    this.blades = [];
    this.cloths = [];
    this.clothT = 0; this.wind = V(0, 0, 0);
  }

  // anchor helper: Object3D at a model-space bind point on a joint
  marker(joint, p, name) {
    const g = new THREE.Object3D(); g.name = name;
    const b = this.bind[joint];
    g.position.set(p[0] - b.x, p[1] - b.y, p[2] - b.z);
    this.J[joint].add(g); return g;
  }

  rootToWorld(a, out) { return out.set(a[0], a[1], a[2]).applyMatrix4(this.root.matrixWorld); }
  dirToWorld(a, out) { return out.set(a[0], a[1], a[2]).normalize().applyQuaternion(this.root.getWorldQuaternion(_q2)); }

  // two-bone IK: upper joint (world pos S) with rest axis -Y, hinge about local X with sign sg
  ik(upper, lower, a, b, T, pole, sg) {
    const S = upper.getWorldPosition(V());
    const D = T.clone().sub(S);
    let d = D.length();
    const u = D.normalize();
    d = clamp(d, Math.abs(a - b) + 1e-3, a + b - 1e-3);
    const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    const p = pole.clone().addScaledVector(u, -pole.dot(u));
    if (p.lengthSq() < 1e-8) p.set(0, 0, 1).addScaledVector(u, -u.z);
    p.normalize();
    const E = S.clone().addScaledVector(u, a * cosA).addScaledVector(p, a * sinA);
    const Tc = S.clone().addScaledVector(u, d);
    const h = p.clone().cross(u).normalize();
    const Y = S.clone().sub(E).normalize();
    const X = h.multiplyScalar(sg); X.addScaledVector(Y, -X.dot(Y)).normalize();
    const Z = X.clone().cross(Y);
    _m.makeBasis(X, Y, Z); const qW = new THREE.Quaternion().setFromRotationMatrix(_m);
    upper.parent.getWorldQuaternion(_q1);
    upper.quaternion.copy(_q1.invert().multiply(qW));
    const e1 = E.clone().sub(S).normalize(), e2 = Tc.clone().sub(E).normalize();
    const th = Math.acos(clamp(e1.dot(e2), -1, 1));
    lower.quaternion.setFromAxisAngle(V(1, 0, 0), sg * th);
    upper.updateMatrixWorld(true);
  }
  // orient joint so its local -Y points along fwd and local +Z along z (world)
  orient(j, fwd, z) {
    const Y = fwd.clone().negate().normalize();
    const Z = z.clone().addScaledVector(Y, -z.dot(Y)); if (Z.lengthSq() < 1e-8) Z.set(0, 0, 1); Z.normalize();
    const X = Y.clone().cross(Z);
    _m.makeBasis(X, Y, Z); const qW = new THREE.Quaternion().setFromRotationMatrix(_m);
    j.parent.getWorldQuaternion(_q1);
    j.quaternion.copy(_q1.invert().multiply(qW));
    j.updateMatrixWorld(true);
  }

  // apply a full (flat) pose
  apply(P) {
    this.cur = P;
    const J = this.J, s = this.spec.dims;
    const eul = (j, r) => j.rotation.set(r[0], r[1], r[2], 'XYZ');
    J.pelvis.position.set(s.pelvis[0] + P.hipsPos[0], s.pelvis[1] + P.hipsPos[1], s.pelvis[2] + P.hipsPos[2]);
    eul(J.pelvis, P.hips); eul(J.spine, P.spine); eul(J.chest, P.chest); eul(J.neck, P.neck); eul(J.head, P.head);
    eul(J.shL, P.shL); eul(J.shR, P.shR);
    this.root.updateWorldMatrix(true, true);
    const rq = this.root.getWorldQuaternion(new THREE.Quaternion());
    // legs
    for (const [L, sg] of [['L', 1], ['R', -1]]) {
      const f = P['foot' + L], a = s.ankle;
      const T = this.rootToWorld([a[0] * sg + f[0], a[1] + f[1], a[2] + f[2]], V());
      const pole = this.dirToWorld(P['knee' + L], V());
      this.ik(J['thigh' + L], J['shin' + L], this.L.thigh, this.L.shin, T, pole, 1);
      const qf = new THREE.Quaternion().setFromEuler(new THREE.Euler(f[3], f[4], f[5], 'YXZ'));
      const qW = rq.clone().multiply(qf);
      J['shin' + L].getWorldQuaternion(_q1);
      J['foot' + L].quaternion.copy(_q1.invert().multiply(qW));
      J['toe' + L].rotation.set(P['toe' + L][0], 0, 0);
    }
    this.root.updateWorldMatrix(true, true);
    // arms (targets may hang off the sheathed hilt / scabbard / drawn hilt)
    const targ = {};
    for (const [L, sg] of [['L', 1], ['R', -1]]) {
      targ[L] = { p: this.rootToWorld(P['hand' + L + 'p'], V()), z: this.dirToWorld(P['hand' + L + 'z'], V()), f: this.dirToWorld(P['hand' + L + 'f'], V()) };
    }
    const mixT = (t, o, w) => { if (w <= 0 || !o) return; t.p.lerp(o.p, w); t.z.lerp(o.z, w).normalize(); t.f.lerp(o.f, w).normalize(); };
    const B = this.blades[0];
    const solve = (L, sg) => {
      const t = targ[L];
      // target = grip centre; wrist = grip - fingers dir * palm offset
      const wrist = t.p.clone().addScaledVector(t.f, -s.hand * 0.45);
      const pole = this.dirToWorld(P['elbow' + L], V());
      this.ik(J['arm' + L], J['elbow' + L], this.L.arm, this.L.fore, wrist, pole, -1);
      this.orient(J['hand' + L], t.f, t.z);
      const g = P['grip' + L][0];
      J['fing1' + L].rotation.set(0, 0, -sg * g * 1.25);
      J['fing2' + L].rotation.set(0, 0, -sg * g * 1.35);
      J['thumb' + L].rotation.set(0, -sg * g * 0.6, -sg * g * 0.5);
      J['arm' + L].updateMatrixWorld(true);
    };
    // right arm first: the left hand's two-hand target hangs off the blade the RIGHT hand holds this frame
    if (B) mixT(targ.R, B.gripTarget(0), P.hiltR[0]);
    solve('R', -1);
    if (B) { mixT(targ.L, B.mouthTarget(), P.mouthL[0]); mixT(targ.L, B.gripTarget(-1), P.twoHand[0]); }
    if (this.blades[1]) mixT(targ.L, this.blades[1].gripTarget(0), P.hiltL[0]);
    solve('L', 1);
    this.root.updateWorldMatrix(true, true);
    this.secondary(P);
  }

  // sode follow the upper arm, kusazuri flare away from the knees (never intersect)
  secondary(P) {
    const J = this.J, s = this.spec.dims;
    if (s.sode) for (const [L, sg, k] of [['L', 1, 0], ['R', -1, 1]]) {
      // arm direction in clavicle space
      const d = V(0, -1, 0).applyQuaternion(J['arm' + L].quaternion);
      const abd = Math.atan2(d.x * sg, -d.y), pit = Math.atan2(d.z, -d.y);
      const r0 = J[`sode${L}0`];
      r0.rotation.set(clamp(-pit * 0.45, -0.9, 0.35), 0, sg * clamp(abd * 0.8 - 0.05, -0.1, 1.1));
      for (let i = 1; i < s.sode.rows; i++) J[`sode${L}${i}`].rotation.set(clamp(-pit * 0.04 + P.sode[k] * 0.06 * i, -0.3, 0.3), 0, sg * (0.03 + P.sode[k] * 0.05) * i);
    }
    if (s.kusa) {
      J.pelvis.updateWorldMatrix(true, true);
      const inv = new THREE.Matrix4().copy(J.pelvis.matrixWorld).invert();
      const knees = ['L', 'R'].map((L) => J['shin' + L].getWorldPosition(V()).applyMatrix4(inv));
      const shins = ['L', 'R'].map((L) => J['foot' + L].getWorldPosition(V()).lerp(J['shin' + L].getWorldPosition(V()), 0.6).applyMatrix4(inv));
      const pb = this.bind.pelvis;
      for (const g of this.kusa) {
        const a = g.userData.a, out = V(Math.sin(a), 0, Math.cos(a));
        const top = this.bind['kusa' + this.kusa.indexOf(g)].clone().sub(pb);
        let tilt = 0;
        for (const kp of knees.concat(shins)) {
          const rel = kp.clone().sub(top);
          const along = rel.dot(out), down = -rel.y;
          if (down <= 0.1) continue;
          const need = Math.atan2(along + s.kusa.clear, down);
          if (down < s.kusa.len * 1.35) tilt = Math.max(tilt, need);
        }
        g.rotation.set(0, 0, 0);
        g.rotation.order = 'YXZ';
        g.rotation.y = a;
        g.rotation.x = -clamp(tilt + P.kusa[0] * 0.25, 0, 1.3);
      }
    }
  }
}

// ---------------------------------------------------------------- cloth / plume ribbons (pure function of t)
// Chain from an anchor; dirs blend gravity, a "drape" direction and the wind, with travelling flutter waves on twos.
export class Ribbon {
  constructor(rig, o) {
    this.rig = rig; this.o = o;
    const { segs, cols } = o;
    const n = (segs + 1) * (cols + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const uv = new Float32Array(n * 2), idx = [];
    for (let j = 0; j <= segs; j++) for (let i = 0; i <= cols; i++) { uv[(j * (cols + 1) + i) * 2] = i / cols; uv[(j * (cols + 1) + i) * 2 + 1] = j / segs; }
    for (let j = 0; j < segs; j++) for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 2, d = a + cols + 1;
      idx.push(a, d, b, b, d, c);
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, o.mat); this.mesh.frustumCulled = false; this.mesh.name = rig.spec.name + '.' + o.name;
    rig.root.add(this.mesh);
    this.pts = Array.from({ length: segs + 1 }, () => V());
    this.burn = 0;
  }
  update(t, wind) {
    const o = this.o, rig = this.rig, { segs, cols } = o;
    rig.root.updateWorldMatrix(true, true);
    const anchor = o.anchor.getWorldPosition(V());
    const aq = o.anchor.getWorldQuaternion(new THREE.Quaternion());
    const side = V(1, 0, 0).applyQuaternion(aq);
    const back = V(...o.drape).applyQuaternion(aq).normalize();
    const w = wind.clone(); const ws = clamp(w.length() / 12, 0, 1); if (w.lengthSq() > 1e-6) w.normalize();
    const tq = Math.floor(t * 12 + 1e-6) / 12;
    const rootInv = new THREE.Matrix4().copy(rig.root.matrixWorld).invert();
    const rq = rig.root.getWorldQuaternion(new THREE.Quaternion()), rqi = rq.clone().invert();
    const segL = o.length / segs;
    this.pts[0].copy(anchor);
    const dir = V(), up = V(0, 1, 0);
    const keep = 1 - this.burn * 0.75;
    // limb collision: capsules between joints (world), pushed out radially so the cloth clears arms, legs and the sword
    const caps = o.caps ? o.caps.map(([a, b, r]) => [rig.J[a].getWorldPosition(V()), (typeof b === "string" ? rig.J[b] : b).getWorldPosition(V()), r]) : null;
    for (let j = 1; j <= segs; j++) {
      const s = j / segs;
      dir.copy(back).lerp(V(0, -1, 0), smooth(s * o.fall)).normalize();
      if (ws > 0) dir.lerp(w, ws * smooth(0.15 + s * 1.2)).normalize();
      // travelling flutter: bend around the side axis and a lateral swing
      const ph = s * o.waves * 6.283 - tq * o.speed + o.seed;
      const amp = o.flutter * (0.25 + ws) * s;
      const ax = side.clone().cross(dir).normalize();
      dir.addScaledVector(ax, Math.sin(ph) * amp).addScaledVector(side, Math.sin(ph * 0.7 + 1.3) * amp * 0.6).normalize();
      const p = this.pts[j].copy(this.pts[j - 1]).addScaledVector(dir, segL);
      // keep clear of the body: push behind the torso plane / above the ground
      const lp = p.clone().applyMatrix4(rootInv);
      const zLim = o.clearZ(lp.y);
      if (lp.z > zLim) { lp.z = zLim; p.copy(lp.applyMatrix4(rig.root.matrixWorld)); }
      if (caps) for (const [A, B2, r] of caps) { const ab = _v1.copy(B2).sub(A); const t = clamp(_v2.copy(p).sub(A).dot(ab) / Math.max(ab.lengthSq(), 1e-6), 0, 1); const c = _v3.copy(A).addScaledVector(ab, t); const dd = p.distanceTo(c); if (dd < r) { if (dd < 1e-4) p.addScaledVector(back, r); else p.sub(c).multiplyScalar(r / dd).add(c); } }
      if (p.y < 0.15) p.y = 0.15;
    }
    const P = this.mesh.geometry.attributes.position, N = this.mesh.geometry.attributes.normal;
    const tmp = V(), nrm = V();
    for (let j = 0; j <= segs; j++) {
      const s = j / segs;
      const a = this.pts[Math.max(0, j - 1)], b = this.pts[Math.min(segs, j + 1)];
      const tan = b.clone().sub(a).normalize();
      const sd = side.clone().addScaledVector(tan, -side.dot(tan)).normalize();
      const twist = Math.sin(s * 5.0 - tq * o.speed * 0.6 + o.seed) * o.twist * s;
      sd.applyAxisAngle(tan, twist);
      nrm.copy(sd).cross(tan).normalize();
      const width = o.width(s);
      for (let i = 0; i <= cols; i++) {
        const c = i / cols;
        // tattered tail: each column ends at its own length (vertices collapse onto that end)
        const len = Math.min(keep, o.colLen ? o.colLen(c) : 1);
        const sj = Math.min(s, len), jj = sj * segs, j0 = Math.floor(jj), f = jj - j0;
        const pA = this.pts[Math.min(segs, j0)], pB = this.pts[Math.min(segs, j0 + 1)];
        tmp.copy(pA).lerp(pB, f).addScaledVector(sd, (c - 0.5) * (s > len ? width * 0.15 : width));
        if (o.cup) tmp.addScaledVector(nrm, -Math.pow(Math.abs(c - 0.5) * 2, 2) * o.cup * width);
        tmp.applyMatrix4(rootInv);
        P.setXYZ(j * (cols + 1) + i, tmp.x, tmp.y, tmp.z);
        const nn = nrm.clone().applyQuaternion(rqi);
        N.setXYZ(j * (cols + 1) + i, nn.x, nn.y, nn.z);
      }
    }
    P.needsUpdate = true; N.needsUpdate = true;
    this.mesh.geometry.computeBoundingSphere();
  }
  tip(out) { return out.copy(this.pts[Math.round(this.o.segs * (1 - this.burn * 0.75))]); }
}

// ---------------------------------------------------------------- blade (sword group + scabbard)
// sword group: origin = grip centre, +Z along the blade, edge toward -Y. In the hand: identity (forward grip) or
// rotated PI about Y (reverse grip). In the scabbard (origin = mouth, +Z toward the scabbard tip, edge up).
export class Blade {
  constructor(rig, { sword, scabbard, hand, reverse = false, tsubaZ, bladeLen, gripGap, tipZ, arcR, gripX = 0 }) {
    Object.assign(this, { rig, sword, scabbard, hand, reverse, tsubaZ, bladeLen, gripGap, tipZ, arcR, gripX });
    this.k = 0; this.place(0);
  }
  place(k) {
    this.k = k = clamp(k, 0, 1);
    const sw = this.sword;
    if (k >= 0.999) {
      this.hand.add(sw);
      sw.position.set(this.gripX * (this.hand === this.rig.J.handL ? -1 : 1), -this.rig.spec.dims.hand * 0.45, 0);
      sw.rotation.set(0, this.reverse ? Math.PI : 0, 0);
    } else {
      this.scabbard.add(sw);
      const slide = k < 0.2 ? (k / 0.2) * this.rig.spec.dims.sliver : this.rig.spec.dims.sliver + ((k - 0.2) / 0.8) * this.bladeLen;
      // slide ALONG the scabbard arc: rigid rotation about the arc's centre of curvature (scabbard space,
      // curve bends toward -Y with radius len^2 / (2 curve)), so the steel still inside keeps matching the saya
      const Rc = this.arcR ?? 1e6, ph = -slide / Rc;
      const p0 = V(0, Rc, -this.tsubaZ).applyAxisAngle(V(1, 0, 0), ph);
      sw.position.set(0, p0.y - Rc, p0.z);
      sw.quaternion.setFromAxisAngle(V(1, 0, 0), ph).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.PI));
    }
    sw.updateMatrixWorld(true);
  }
  // hand target on the hilt: off = 0 -> right at the grip, -1 -> one grip gap behind (second hand)
  gripTarget(off = 0) {
    this.sword.updateWorldMatrix(true, false);
    const q = this.sword.getWorldQuaternion(new THREE.Quaternion());
    let z = V(0, 0, 1).applyQuaternion(q), f = V(0, -1, 0).applyQuaternion(q);
    const p = this.sword.getWorldPosition(V()).addScaledVector(z, off * this.gripGap);
    if (this.reverse && this.k >= 0.999) z.negate();
    if (this.k < 0.999 && this.reverse) z.negate();
    return { p, z, f };
  }
  mouthTarget() {
    this.scabbard.updateWorldMatrix(true, false);
    const q = this.scabbard.getWorldQuaternion(new THREE.Quaternion());
    const z = V(0, 0, 1).applyQuaternion(q);
    return { p: this.scabbard.getWorldPosition(V()).addScaledVector(z, 0.55), z: z.clone().negate(), f: V(0, -1, 0).applyQuaternion(q).negate().lerp(V(0, -1, 0), 0.3).normalize() };
  }
}
