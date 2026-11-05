// ronin/poses.js - named key poses + walk/run cycles for SUMI and YUKI (authoring dicts, see rig.js POSE_KEYS).
// Positions in root space (metres, +Z forward, left = +X). Authored at Sumi scale; Yuki is scaled by k / sx.
import { mirV } from './rig.js';

const n3 = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

export function makePoses(kind, d) {
  const k = d.head[1] / 14.85, sx = d.shoulder[0] / 3.05;
  const P = (x, y, z) => [x * sx, y * k, z * k];               // scaled position
  const F = (x, y, z, pitch = 0, yaw = 0, roll = 0) => [x * sx, y * k, z * k, pitch, yaw, roll];
  const hipY = (y) => [0, y * k, 0];
  const relaxL = { handLp: P(3.35, 6.55, 0.35), handLz: [0, 0, 1], handLf: [0.15, -1, 0.1], gripL: [0.55] };
  const relaxR = { handRp: P(-3.35, 6.55, 0.35), handRz: [0, 0, 1], handRf: [-0.15, -1, 0.1], gripR: [0.55] };
  const sumi = kind === 'sumi';
  const T = {};
  // ---------------------------------------------------------- shared
  T.idle = {
    ...relaxL, ...relaxR, hipsPos: hipY(-0.35), chest: [0.03, 0, 0], head: [-0.04, 0, 0],
    footL: F(0.3, 0, 0.25, 0, 0.22), footR: F(-0.3, 0, -0.35, 0, -0.25), mouthL: [sumi ? 1 : 0], gripL: [sumi ? 0.85 : 0.55],
    elbowL: [0.8, -0.3, -1], elbowR: [-0.8, -0.3, -1],
  };
  T.stride = {   // stride stop: front foot planted, weight settling back, rear heel up
    ...T.idle, hipsPos: [0, -0.85 * k, -0.2 * k], hips: [0, 0.12, 0], chest: [-0.06, -0.1, 0], head: [0.02, -0.04, 0],
    footL: F(0.25, 0, 1.75, 0, 0.12), footR: F(-0.35, 0.2, -1.85, -0.38, -0.18), toeR: [0.4],
  };
  T.guard = sumi ? {   // hand on the hilt, left hand on the scabbard mouth (thumb on the tsuba)
    ...T.idle, hipsPos: [0, -1.1, -0.2], hips: [0, 0.22, 0], spine: [0.08, -0.08, 0], chest: [0.12, -0.12, 0], head: [-0.1, -0.08, 0],
    footL: F(0.45, 0, 1.4, 0, 0.18), footR: F(-0.5, 0, -1.55, 0, -0.45), hiltR: [1], mouthL: [1], gripR: [0.9], gripL: [0.85],
    elbowR: [-0.4, -0.5, -1], elbowL: [1, -0.4, -0.4],
  } : {
    ...T.idle, hipsPos: [0, -1.0 * k, 0], hips: [0, 0, 0], chest: [0.12, 0, 0], head: [-0.1, 0, 0],
    footL: F(0.5, 0, 0.9, 0, 0.3), footR: F(-0.5, 0, -1.0, 0, -0.35), hiltR: [1], hiltL: [1], gripR: [0.9], gripL: [0.9],
    elbowR: [-1, -0.2, -0.6], elbowL: [1, -0.2, -0.6],
  };
  T['look-down'] = { ...T.idle, chest: [0.1, 0, 0], neck: [0.25, 0, 0], head: [0.42, 0, 0] };
  // bow: slow formal bow from the hips (back straight, head follows), hands on the thighs (Sumi's left keeps the saya)
  T.bow = {
    ...T.idle, hipsPos: [0, -0.55 * k, -1.0 * k], hips: [0.52, 0, 0], spine: [0.1, 0, 0], chest: [0.04, 0, 0], neck: [0.12, 0, 0], head: [0.22, 0, 0],
    footL: F(-0.2, 0, 0.15, 0, 0.08), footR: F(0.2, 0, 0.15, 0, -0.08), kneeL: [0.05, 0, 1], kneeR: [-0.05, 0, 1],
    handRp: P(-1.9, 6.7, 2.9), handRf: [0.15, -1, 0.55], handRz: [0, 0, 1], elbowR: [-1, -0.3, -0.6], gripR: [0.35],
  };
  if (!sumi) Object.assign(T.bow, { handLp: P(1.9, 6.7, 2.9), handLf: [-0.15, -1, 0.55], elbowL: [1, -0.3, -0.6], gripL: [0.35] });
  T.sheathe = sumi ? { ...T.guard, hipsPos: [0, -1.2, -0.2], hips: [0.08, -0.25, 0], chest: [0.12, -0.2, 0], head: [0.22, 0.1, 0], footL: F(0.6, 0, 1.4, 0, 0.25), footR: F(-0.7, 0, -1.5, 0, -0.5) }
    : { ...T.guard, hipsPos: [0, -0.9 * k, 0], chest: [0.15, 0, 0], head: [0.18, 0, 0] };
  // land-kneel: right knee down on the mirror, left foot planted forward, blade held out to the side, eyes up
  T['land-kneel'] = {
    ...T.idle, hipsPos: [0, -4.5 * k, 0.3 * k], hips: [0.15, -0.25, 0], spine: [0.22, -0.05, 0], chest: [0.32, -0.12, 0.06], neck: [-0.05, 0.1, 0], head: [-0.5, 0.25, 0],
    footL: F(1.2, 0, 2.6, 0, 0.3), footR: F(-1.0, 0.3, -2.4, -1.3, -0.3), kneeL: [0.45, 0, 1], kneeR: [-0.2, -0.85, 1], toeR: [1.0],
    handLp: P(2.3, 5.0, 3.0), handLz: [0, 0, 1], handLf: n3([0.1, -1, 0.4]), gripL: [0.45], mouthL: [0], elbowL: [1, 0.2, -0.4],
  };
  if (sumi) Object.assign(T['land-kneel'], { handRp: P(-5.6, 5.4, 1.4), handRz: n3([-1, -0.32, 0.4]), handRf: n3([-0.3, -0.2, -1]), gripR: [1], elbowR: [-0.3, -1, -0.5] });
  else Object.assign(T['land-kneel'], { handRp: P(-5.4, 6.6, 0.8), handRz: n3([-0.25, 0.85, 0.45]), handRf: n3([-1, -0.2, 0]), gripR: [1], elbowR: [-0.3, -1, -0.4],
    handLp: P(2.3, 4.6, 3.0), handLz: n3([0.1, 0.9, 0.3]), handLf: n3([0.3, -0.2, 1]), gripL: [1] });

  if (sumi) {
    // ---------------------------------------------------------- SUMI (nodachi, forward grip: blade = handRz, edge = handRf)
    const two = { twoHand: [1], gripR: [1], gripL: [1], mouthL: [0] };
    T.chudan = { ...T.idle, ...two, hipsPos: [0, -1.7, -0.2], hips: [0.08, 0.15, 0], chest: [0.14, 0.1, 0], head: [-0.15, -0.05, 0], footL: F(0.8, 0, 1.9, 0, 0.15), footR: F(-0.8, 0.1, -2.1, -0.25, -0.45), kneeL: [0.4, 0, 1], kneeR: [-0.4, 0, 1],
      handRp: [-0.4, 8.8, 3.6], handRz: n3([0.03, 0.42, 1]), handRf: n3([0, -1, 0.4]), elbowR: [-1, -0.6, -0.2], elbowL: [1, -0.6, -0.2] };
    T.raise = { ...T.idle, ...two, hipsPos: [0, -1.9, 0], hips: [-0.05, 0, 0], chest: [-0.15, 0, 0], head: [-0.25, 0, 0], footL: F(1.1, 0, 1.7, 0, 0.3), footR: F(-1.1, 0, -1.7, 0, -0.4), kneeL: [0.5, 0, 1], kneeR: [-0.5, 0, 1],
      handRp: [-0.2, 15.2, 2.3], handRz: n3([0, 1, 0.06]), handRf: [0, 0, 1], elbowR: [-1, -0.2, 0], elbowL: [1, -0.2, 0] };
    T.jodan = { ...T.raise, hips: [0, 0.2, 0], chest: [-0.2, 0.15, 0], handRp: [-0.6, 15.8, 0.2], handRz: n3([0.15, -0.45, -1]), handRf: n3([0, 1, -0.45]) };
    // full extension of a downward cut: deep lunge, hips twisted, arms long, blade forward-down
    T['slash-vertical'] = { ...T.idle, ...two, hipsPos: [0, -3.0, 1.2], hips: [0.25, -0.3, 0], spine: [0.22, -0.1, 0], chest: [0.35, -0.15, 0], neck: [0, 0.1, 0], head: [-0.5, 0.3, 0],
      footL: F(1.0, 0, 3.7, 0, 0.2), footR: F(-1.0, 0.3, -3.4, -0.9, -0.45), toeR: [0.8], kneeL: [0.4, 0, 1], kneeR: [-0.3, -0.5, 1],
      handRp: [-0.6, 6.6, 6.6], handRz: n3([0.05, -0.45, 1]), handRf: n3([0, -1, -0.45]), elbowR: [-1, 0.3, -0.2], elbowL: [1, 0.3, -0.2] };
    // pass-stab: deepest lunge, both hands drive the blade straight down
    T['pass-stab'] = { ...T.idle, ...two, hipsPos: [0, -4.0, 0.6], hips: [0.35, 0, 0], spine: [0.15, 0, 0], chest: [0.4, 0, 0], head: [0.05, 0, 0],
      footL: F(1.0, 0, 3.0, 0, 0.15), footR: F(-1.0, 0.25, -3.3, -1.2, -0.2), toeR: [1.0], kneeL: [0.5, 0, 1], kneeR: [-0.15, -0.85, 1],
      handRp: [-0.2, 5.6, 4.6], handRz: n3([0, -1, 0.12]), handRf: n3([0, -0.12, -1]), elbowR: [-1, 0.1, -0.3], elbowL: [1, 0.1, -0.3] };
    // dash: body leaning ~35 deg, knee driving forward, back leg fully extended, blade trailing low behind, arms back
    T.dash = { ...T.idle, gripR: [1], gripL: [0.8], mouthL: [0], twoHand: [0], hipsPos: [0, -1.8, 1.3], hips: [0.38, 0.12, 0], spine: [0.15, 0.05, 0], chest: [0.12, 0.12, 0], neck: [-0.1, 0, 0], head: [-0.55, -0.1, 0],
      footL: F(0.4, 2.0, 3.1, 0.5, 0.05), footR: F(-0.5, 1.0, -4.7, -1.3, -0.1), toeR: [0.9], kneeL: [0.1, 0.35, 1], kneeR: [-0.1, -0.3, 1],
      handRp: [-2.8, 5.8, -3.2], handRz: n3([-0.3, -0.35, -1]), handRf: n3([0, -1, 0.35]), elbowR: [-1, 0.4, 0.2],
      handLp: [3.0, 6.6, -2.6], handLz: [0, 0, 1], handLf: n3([0.3, -0.6, -0.7]), elbowL: [1, 0.4, 0.2] };
    // leap: tucked knees, blade cocked back over the head, scarf trails
    T.leap = { ...T.idle, ...two, hipsPos: [0, 0.2, 0], hips: [0.38, 0, 0], spine: [0.12, 0, 0], chest: [0.1, 0, 0], head: [-0.6, 0, 0],
      footL: F(0.7, 5.0, 2.2, 0.9, 0.1), footR: F(-0.7, 3.4, -0.6, 0.3, -0.1), kneeL: [0.2, 0.4, 1], kneeR: [-0.2, 0.3, 1], toeR: [0.3],
      handRp: [-0.7, 14.2, 1.0], handRz: n3([0.05, -0.2, -1]), handRf: n3([0, 1, -0.2]), elbowR: [-1, 0.2, 0.3], elbowL: [1, 0.2, 0.3] };
    // stance: iai crouch, deep and wide, left side leading, torso wound up, right hand on the hilt, left on the saya
    T.stance = { ...T.guard, hipsPos: [0, -2.9, -0.5], hips: [0.12, -0.42, 0], spine: [0.14, -0.1, 0], chest: [0.24, -0.15, 0.04], neck: [0, 0.15, 0], head: [-0.32, 0.45, 0],
      footL: F(1.5, 0, 2.5, 0, 0.45), footR: F(-1.5, 0.3, -2.6, -0.5, -0.75), toeR: [0.6], kneeL: [0.7, 0, 1], kneeR: [-0.6, -0.25, 1], elbowR: [-0.5, -0.6, -1], elbowL: [1, -0.5, -0.3] };
    T['draw-cut'] = { ...T.idle, hipsPos: [0, -2.3, 0.6], hips: [0.05, -0.45, 0], spine: [0.08, -0.15, 0], chest: [0.14, -0.55, 0], head: [-0.12, 0.6, 0],
      footL: F(0.8, 0, 1.2, 0, 0.4), footR: F(-0.9, 0, 2.9, 0, -0.1), kneeL: [0.6, 0, 1], kneeR: [-0.3, 0, 1],
      handRp: [-5.6, 10.0, 2.6], handRz: n3([-1, 0.06, 0.15]), handRf: n3([0, -0.25, 1]), gripR: [1], mouthL: [1], elbowR: [-0.3, -1, -0.3] };
    T['slash-horizontal'] = T['draw-cut'];
  } else {
    // ---------------------------------------------------------- YUKI (two kodachi, reverse grip: blade = -handZ)
    const both = { gripR: [1], gripL: [1] };
    T.stance = { ...T.idle, ...both, hipsPos: [0, -3.0 * k, -0.3 * k], hips: [0.15, 0.38, 0], spine: [0.2, 0.15, 0], chest: [0.36, 0.3, 0.05], neck: [0, -0.2, 0], head: [-0.45, -0.4, 0],
      footL: F(1.3, 0, 2.6, 0, 0.45), footR: F(-1.3, 0.25, -2.6, -0.5, -0.7), toeR: [0.6], kneeL: [0.6, 0, 1], kneeR: [-0.6, -0.2, 1],
      handRp: P(-0.8, 8.0, 3.6), handRz: n3([0.15, 0.55, 1]), handRf: n3([0.9, -0.35, 0.1]), elbowR: [-1, -0.5, -0.2],
      handLp: P(3.6, 5.4, -1.9), handLz: n3([0.1, 0.35, 1]), handLf: n3([0, -1, 0.1]), elbowL: [1, -0.2, 0.4] };
    T.dash = { ...T.idle, ...both, hipsPos: [0, -1.8 * k, 1.3 * k], hips: [0.42, 0, 0], spine: [0.15, 0, 0], chest: [0.12, 0, 0], neck: [-0.1, 0, 0], head: [-0.6, 0, 0],
      footL: F(0.4, 2.2, 3.1, 0.5, 0), footR: F(-0.4, 1.0, -4.7, -1.3, 0), toeR: [0.9], kneeL: [0.1, 0.35, 1], kneeR: [-0.1, -0.3, 1],
      handRp: P(-2.8, 6.8, -3.8), handRz: n3([0, 0.35, 1]), handRf: n3([-0.3, -1, 0.3]), elbowR: [-1, 0.3, 0.2],
      handLp: P(2.8, 6.8, -3.8), handLz: n3([0, 0.35, 1]), handLf: n3([0.3, -1, 0.3]), elbowL: [1, 0.3, 0.2] };
    T['slash-horizontal'] = { ...T.idle, ...both, hipsPos: [0, -2.3 * k, 0.7 * k], hips: [0.12, 0.6, 0], spine: [0.1, 0.25, 0], chest: [0.18, 0.62, 0.05], neck: [0, -0.3, 0], head: [-0.2, -0.6, 0],
      footL: F(1.4, 0, 3.0, 0, 0.6), footR: F(-1.1, 0.25, -2.7, -0.6, -0.2), toeR: [0.6], kneeL: [0.6, 0, 1], kneeR: [-0.3, -0.3, 1],
      handRp: P(4.6, 9.8, 3.6), handRz: n3([-0.95, 0.05, -0.2]), handRf: n3([0, -1, 0.3]), elbowR: [-0.3, -1, 0],
      handLp: P(-3.6, 8.8, -2.8), handLz: n3([0.8, 0.0, 0.6]), handLf: n3([0, -1, 0]), elbowL: [0.3, -1, 0.2] };
    T['pass-stab'] = { ...T.idle, ...both, hipsPos: [0, -4.0 * k, 0.6 * k], hips: [0.38, 0, 0], spine: [0.15, 0, 0], chest: [0.38, 0, 0], head: [0.1, 0, 0],
      footL: F(1.0, 0, 3.1, 0, 0.15), footR: F(-1.0, 0.25, -3.3, -1.2, -0.2), toeR: [1.0], kneeL: [0.5, 0, 1], kneeR: [-0.15, -0.85, 1],
      handRp: P(-0.5, 4.6, 4.4), handRz: n3([0, 1, -0.1]), handRf: n3([0.6, 0, 1]), elbowR: [-1, 0.1, -0.2],
      handLp: P(0.5, 4.6, 4.4), handLz: n3([0, 1, -0.1]), handLf: n3([-0.6, 0, 1]), elbowL: [1, 0.1, -0.2] };
    T.leap = { ...T.idle, ...both, hipsPos: [0, 0.2 * k, 0], hips: [0.42, 0, 0], spine: [0.15, 0, 0], chest: [0.15, 0, 0], head: [-0.65, 0, 0],
      footL: F(0.7, 5.2, 2.0, 0.9, 0.1), footR: F(-0.7, 3.8, -0.4, 0.3, -0.1), kneeL: [0.2, 0.4, 1], kneeR: [-0.2, 0.3, 1],
      handRp: P(-3.2, 9.6, -2.4), handRz: n3([0, 0.4, 1]), handRf: n3([-0.4, -1, 0]), elbowR: [-1, 0.3, 0.1],
      handLp: P(3.2, 9.6, -2.4), handLz: n3([0, 0.4, 1]), handLf: n3([0.4, -1, 0]), elbowL: [1, 0.3, 0.1] };
    T['slash-vertical'] = T['slash-horizontal'];
    T.raise = T.stance; T.jodan = T.stance; T.chudan = T.stance; T['draw-cut'] = T['slash-horizontal'];
  }
  T.walk = T.idle;

  // ---------------------------------------------------------- cycles (phase 0..1, on twos is the caller's job)
  const W = sumi ? { D: 8.4, lift: 0.9, bob: 0.28, drop: 0.78, yaw: 0.1, swing: 1.2 } : { D: 7.6 * k / 0.833, lift: 0.8, bob: 0.22, drop: 0.55, yaw: 0.12, swing: 1.0 };
  const R = sumi ? { D: 19, lift: 2.0, bob: 0.5, drop: 1.0, lean: 0.32, swing: 2.0 } : { D: 18 * k / 0.833, lift: 2.0, bob: 0.5, drop: 0.85, lean: 0.42, swing: 2.0 };
  const footCycle = (q, D, stance, lift, sideX, yawOut) => {
    const A = D * stance / 2;
    if (q < stance) { const s = q / stance; const heel = Math.max(0, (s - 0.75) / 0.25); return [sideX, 0.05 * heel * k, A - 2 * A * s, -0.45 * heel, yawOut, 0, 0.5 * heel]; }
    const s = (q - stance) / (1 - stance); const e = s * s * (3 - 2 * s);
    return [sideX, lift * k * Math.sin(Math.PI * s) + 0.1 * k * (1 - s), -A + 2 * A * e, 0.25 * Math.sin(Math.PI * s) - 0.2 * (1 - s) * (1 - s), yawOut, 0, 0.2 * (1 - s)];
  };
  const cycle = (phase, run) => {
    const C = run ? R : W, stance = run ? 0.38 : 0.62;
    const ph = ((phase % 1) + 1) % 1;
    const fl = footCycle(ph, C.D, stance, C.lift, 0.12 * sx, sumi ? 0.18 : 0.08);
    const fr = footCycle((ph + 0.5) % 1, C.D, stance, C.lift, -0.12 * sx, sumi ? -0.18 : -0.08);
    const s2 = Math.cos(4 * Math.PI * (ph - (run ? 0.42 : 0.31)));
    const sw = Math.sin(2 * Math.PI * ph);
    const base = run ? (sumi ? T.dash : T.dash) : T.idle;
    const o = {
      ...T.idle,
      hipsPos: [0, (-C.drop + C.bob * s2) * k, run ? 0.4 * k : 0], hips: [0, -sw * (run ? 0.18 : W.yaw), sw * 0.04],
      spine: [run ? C.lean * 0.5 : 0.02, sw * 0.05, 0], chest: [run ? C.lean : 0.04, sw * (run ? 0.16 : 0.08), -sw * 0.02], head: [run ? -C.lean * 1.1 : -0.04, -sw * 0.05, 0],
      footL: [fl[0], fl[1], fl[2], fl[3], fl[4], 0], footR: [fr[0], fr[1], fr[2], fr[3], fr[4], 0], toeL: [fl[6]], toeR: [fr[6]],
    };
    // arms swing opposite to the legs (Sumi keeps the left hand on the scabbard while walking)
    const swing = C.swing * k;
    o.handRp = P(-3.25 + (run ? 0.6 : 0), 6.7 + (run ? 2.2 : 0) + Math.max(0, -sw) * (run ? 1.8 : 0.35), 0.35 + (run ? 0.5 : 0)).map((v, i) => (i === 2 ? v - sw * swing : v));
    o.handLp = P(3.25 - (run ? 0.6 : 0), 6.7 + (run ? 2.2 : 0) + Math.max(0, sw) * (run ? 1.8 : 0.35), 0.35 + (run ? 0.5 : 0)).map((v, i) => (i === 2 ? v + sw * swing : v));
    if (run) { o.handRf = n3([-0.2, -0.6, 0.8]); o.handLf = n3([0.2, -0.6, 0.8]); o.gripR = [1]; o.gripL = [1]; o.elbowR = [-0.6, -0.3, -1]; o.elbowL = [0.6, -0.3, -1]; }
    if (sumi && !run) { o.mouthL = [1]; }
    if (sumi && run) { o.mouthL = [0.85]; }
    return o;
  };
  return { table: T, walk: (p) => cycle(p, false), run: (p) => cycle(p, true), stride: { walk: W.D, run: R.D } };
}
