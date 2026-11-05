// direction/act2.js - DIRECTION B: shots s21-s40 - cameras (on ones), colour script (LOOKS on top of
// look.js), choreography (ACT: ronin on twos, giant overrides, FX triggers, world states). Everything is a pure
// function of film time t, so frames render in any order.
//
// World layout (LAKE): the sun sits low in -z; cameras mostly look toward -z, so +x = screen-right. Before the pass
// Sumi travels +x (screen-right) and Yuki -x; after s23 they have swapped sides (Sumi right, Yuki left) and keep
// their new sides to the end (bow in s39 = mirror of s14, then they walk away: Sumi +x, Yuki -x).
// Hand-off from DIRECTION A (s20 end): Sumi (-30,0,0) facing +x, Yuki (+30,0,0) facing -x, look-down; Yuki blades out,
// Sumi blade 0.1 (thumb push). The mirror giant's face (between the eyes) drifts from z -70 (A) to z 0 in s21 so its
// two eyes lie under the blades the ronin drive into the mirror in s23 (Sumi tip x +11, Yuki tips x -11).
import * as THREE from 'three';
import { registerDirection, CUES } from '../shots.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lin = (a, b, x) => cl((x - a) / (b - a));
const sm = (a, b, x) => { const k = lin(a, b, x); return k * k * (3 - 2 * k); };
const lerp = (a, b, k) => a + (b - a) * k;
const L3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const eio = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);       // ease in-out cubic
const eo = (k) => 1 - Math.pow(1 - k, 3);                                               // ease out
const ei = (k) => k * k * k;
const two = (t) => Math.floor(t * 12 + 1e-6) / 12;                                       // characters on twos
const PI = Math.PI;
const FACE_R = PI / 2, FACE_L = -PI / 2;                                                // yaw facing +x / -x
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
// camera shake on ones, decaying after t0
function shake(t, t0, amp, dur = 0.5) {
  if (t < t0 || t > t0 + dur) return [0, 0, 0];
  const f = Math.floor(t * 24), k = amp * Math.pow(1 - (t - t0) / dur, 2);
  return [(hash(f) - 0.5) * 2 * k, (hash(f + 17) - 0.5) * 2 * k, (hash(f + 31) - 0.5) * k];
}
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const C = CUES;

// ------------------------------------------------------------------ trajectories (pure in t; CAMS + ACT share them)
// s22-s23 charge + pass: lanes z +3 (Sumi, camera side) / -3 (Yuki); cross at x 0 on the pass cue, slide to the stab
const LANE_S = 3, LANE_Y = -3;
const RUN0 = 45.25, PASS = C.pass;                                                      // 47.6
function chargeX(t, who) {        // who +1 Sumi (from -30 to +4), -1 Yuki (from +30 to -7)
  const s = who;
  if (t < RUN0) return -30 * s;
  if (t < PASS) { const u = (t - RUN0) / (PASS - RUN0); return -30 * s + 30 * s * (0.35 * u + 0.65 * u * u); }
  const end = s > 0 ? 4 : -7, v = eo(lin(PASS, PASS + 0.3, t));
  return end * v;
}
// s26-s27: the ronin face the giant at its feet, s27 they leap apart over the sweeping blade
const FEET_Z = 70, DZ_S = 6, DZ_Y = -6;   // Sumi a little nearer the camera than Yuki: their s27 cross-leap never meets
const SW_T0 = 56.2;                     // wind-up hold ends, the slam starts
// screen direction after the pass: Sumi travels screen-left, Yuki screen-right -> they CROSS-leap over the sweeping blade
// (Sumi from the right, high and near; Yuki from the left, lower and far: 12-24 m apart in z, ~20 m in height)
function leapApart(t, who) {             // who +1 Sumi (starts right), -1 Yuki (starts left) -> {x, y, z, air}
  const t0 = who > 0 ? 56.32 : 56.42, t1 = t0 + 0.85;
  const x0 = 16 * who, x1 = -58 * who, z0 = FEET_Z + (who > 0 ? DZ_S : DZ_Y), dz = who > 0 ? 8 : -6;
  if (t < t0) return { x: x0, y: 0, z: z0, air: 0 };
  if (t > t1) return { x: x1, y: 0, z: z0 + dz, air: 2 };
  const u = (t - t0) / (t1 - t0);
  return { x: lerp(x0, x1, eo(u)), y: (who > 0 ? 64 : 42) * 4 * u * (1 - u), z: z0 + dz * u, air: 1, u };
}
// s28: Yuki runs up the giant's right forearm (reach pose: hand (19,135,5) -> elbow (28,144,-34))
const ARM_A = V(19, 135, 5), ARM_B = V(28, 144, -34), ARM_UP = 6.5;
function armRun(t) { const u = 0.08 + 0.84 * lin(58.0, 60.25, t); return ARM_A.clone().lerp(ARM_B, u).add(V(0, ARM_UP, 0)); }
// s30: Yuki's leap across the giant's face (head ~ (-3, 190, -72), slashes at z -54)
function faceLeap(t) {
  const u = lin(62.25, 63.9, t);
  const x = lerp(-46, 40, u < 0.4 ? eo(u / 0.4) * 0.45 : 0.45 + 0.55 * eo((u - 0.4) / 0.6));
  const y = 170 + 16 * Math.sin(PI * Math.min(1, u * 1.15)) - 18 * Math.max(0, u - 0.7);
  return V(x, y, -24);
}
// s32-s35: the leap over the giant and the cross strike (giant chest ~ (0,146,-67), head (0,194,-86))
function skyPos(t, who) {           // who +1 Sumi (from the right), -1 Yuki (from the left)
  if (t < 68.0) {                    // s32: rising arcs from both shoulders, apex above the head at 68
    const u = lin(66.0, 68.0, t), e = eo(u);
    return V(who * lerp(52, 26, e), lerp(150, 246, e) - 8 * u * u, lerp(-20, -30, e));   // (s33 cuts to its own wide)
  }
  if (t < C.cross) {                 // dive in (smear) to the start of each cut
    const u = ei(lin(68.0, C.cross, t));
    return who > 0 ? V(lerp(30, 10, u), lerp(262, 205, u), -42) : V(lerp(-30, -62, u), lerp(262, 150, u), -40);
  }
  // through and past toward camera: Sumi's vertical cut ends low-left, Yuki's horizontal cut ends right; frozen in s34
  const u = eo(lin(C.cross, C.cross + 0.25, t)), w = eo(lin(C.cross + 0.1, 69.45, t));
  const drift = t > C.split ? (t - C.split) : 0;
  return who > 0 ? V(lerp(10, -6, u) - 14 * w, lerp(205, 112, u) - 8 * w - drift * 7, lerp(-42, -20, u) + 40 * w)
    : V(lerp(-62, 52, u) + 4 * w, lerp(150, 140, u) - 6 * w - drift * 7, lerp(-40, -20, u) + 40 * w);
}
// s36-s37: falling back down to the healed centre, landing back to back at 76.3
const LAND = 76.3;
function fallPos(t, who) {
  const u = lin(73.0, LAND, t);
  // Sumi drifts left to land at x -4 facing -x, Yuki falls to x +4 facing +x (back to back, sides of s14 again)
  const x = lerp(who > 0 ? -20 : 56, who > 0 ? -7 : 7, eo(u));
  const y = (who > 0 ? 88 : 118) * (1 - Math.pow(u, 1.7));
  return V(x, Math.max(0, y), lerp(20, 0, eo(u)));
}
// s40: walk away (Sumi +x, Yuki -x) after a short turn
const WALK0 = 82.35;
// dir -1 = Sumi walking screen-left from x -10.5, +1 = Yuki walking screen-right from x +10.5
function walkX(t, dir, stride) { return dir * (10.5 + Math.max(0, t - WALK0) / 1.25 * stride); }

// ------------------------------------------------------------------ cameras (on ones)
const cam = (pos, look, fov, roll = 0) => ({ pos, look, fov, roll });
const CAMS = {
  // s21 top-down: the giant rises under the lake and slides beneath them; slow descent (push) on the two dots
  // high oblique (~36 deg down) so the mirror shows the reflected sunset clouds above the frame, the giant under the two
  s21: (lt, d) => { const k = eio(lt / d); return cam([lerp(-6, 0, k), lerp(178, 150, k), lerp(262, 218, k)], [0, 0, lerp(-14, -8, k)], 52, lerp(-2, 0, k)); },
  // s22 low wide at mirror level: tracks in a little as they charge; Sumi left -> right
  s22: (lt, d, t) => { const k = eio(lt / d); return cam(add([lerp(-4, 0, k), lerp(2.2, 3.2, k), lerp(74, 60, k)], shake(t, RUN0, 0.25, 0.4)), [0, lerp(9, 8, k), 0], 42); },
  // s23 the pass: medium side, fast push into the meeting point, hard stop + shake on the impact
  s23: (lt, d, t) => {
    const k = eo(lin(47.0, PASS, t)), k2 = eio(lin(PASS + 0.1, 48.5, t));
    const p = [lerp(-6, 0, k), lerp(4.5, 6, k) + 1.5 * k2, lerp(56, 34, k) + 4 * k2];
    return cam(add(p, shake(t, PASS, 1.4, 0.6)), [0, lerp(9, 7, k), 0], 42);
  },
  // s24 silence: low at the mirror, symmetric two-shot with the sun between them, an almost still push
  s24: (lt, d) => { const k = eio(lt / d); return cam([-1.5, 2.0, lerp(64, 59, k)], [-1.5, 7.2, -10], 36); },
  // s25 aerial: from above the blades (the eyes under them) a crane up and back until the cracks reach the horizon
  s25: (lt, d) => {
    const k = eio(lin(0, d, lt));
    return cam([0, lerp(64, 520, k), lerp(18, 420, k)], [-1.5, 0, lerp(-2, -380, Math.pow(k, 0.8))], lerp(62, 50, k));
  },
  // s26 THE big wide: low on the shattered mirror, the giant pushes up into the sunset; slow tilt up as it rises
  // (far back + longer lens so the giant fills ~70% of the frame height at full rise and the ronin read tiny at its feet)
  s26: (lt, d) => {
    const k = eio(lt / d);
    return cam([lerp(-16, -6, k), lerp(1.3, 1.7, k), lerp(318, 292, k)], [lerp(-5, 0, k), lerp(34, 104, eio(lin(0.15, d, lt))), -90], lerp(46, 43, k));
  },
  // s27 the swing: medium-wide from the front-right, the blade sweeps the lake toward camera, they leap apart
  s27: (lt, d, t) => {
    const k = eio(lt / d);
    return cam(add([lerp(16, 8, k), lerp(10, 13, k), lerp(214, 200, k)], shake(t, 56.42, 1.6, 0.8)), [0, lerp(46, 38, k), 0], 56);
  },
  // s28 tracking alongside Yuki on the forearm (camera on her right side, she runs screen-right)
  s28: (lt, d, t) => {
    const y = armRun(two(t)), yc = armRun(t);
    return cam([yc.x + 34, yc.y + 4, yc.z + 10 - 6 * eio(lt / d)], [yc.x, yc.y + 7, yc.z - 8], 46, -4);
  },
  // s29 the aura: low profile on Sumi (faces screen-left), push in as the blade goes up and ignites
  s29: (lt, d) => {
    const k = eio(lt / d);
    return cam([52 - lerp(40, 30, k), lerp(2.0, 3.0, k), 76 + lerp(4, 2, k)], [52, lerp(13, 17, k), 70], lerp(40, 34, k));
  },
  // s30 face cut: in front of the giant's face, Yuki crosses left -> right; shake on the cuts
  s30: (lt, d, t) => {
    const k = eio(lt / d);
    return cam(add([lerp(10, 18, k), lerp(166, 172, k), lerp(40, 30, k)], add(shake(t, C.faceCut, 1.6, 0.4), shake(t, C.faceCut + 0.25, 1.6, 0.45))), [lerp(-8, 6, k), 184, -64], 52);
  },
  // s31 kaleidoscope: FX's glide through the shard corridor (set in create, needs ctx)
  // s32 the leap: low under the giant's head into the sun, they rise from both sides as rimmed silhouettes
  // (low and close: the camera cranes up with them, a little below their height, so they rise as big rimmed
  // silhouettes beside the sun and end above the giant's head, which sits low in frame)
  s32: (lt, d, t) => {
    const e = eo(lin(66.0, 68.0, t));
    return cam([lerp(-3, 0, e), lerp(146, 214, e), lerp(52, 40, e)], [0, lerp(166, 250, e), -100], lerp(48, 45, e), lerp(3, 0, e));
  },
  // s33 the cross: the one bold move - a fast push to the chest, hard stop + shake on the impact frames
  s33: (lt, d, t) => {
    const k = eo(lin(68.0, C.cross, t)), k2 = eio(lin(C.cross + 0.15, 69.5, t));
    return cam(add([0, lerp(236, 150, k), lerp(150, 116, k) - 8 * k2], shake(t, C.cross, 3.5, 0.7)), [0, lerp(250, 146, k), -64], 54);
  },
  // s34 still: frontal, slightly lower, the X glowing; nothing moves (a breath of a push)
  s34: (lt, d) => { const k = eio(lt / d); return cam([0, 118, lerp(118, 114, k)], [0, 140, -60], 56); },
  // s35 sky split: the camera pulls back and down while the X runs into the sky for kilometres
  s35: (lt, d) => { const k = eio(lt / d); return cam([0, lerp(140, 110, k), lerp(380, 860, k)], [0, lerp(170, 250, k), -600], lerp(52, 56, k)); },
  // s36 shatter: low wide on the mirror (rhyme of s26), tilt down with the falling glitter
  s36: (lt, d) => { const k = eio(lt / d); return cam([lerp(-10, 0, k), lerp(4, 3, k), lerp(330, 300, k)], [0, lerp(120, 40, k), -60], 54); },
  // s37 heal: medium-wide on the two landing back to back, crane up to watch the mercury close outward
  s37: (lt, d) => { const k = eio(lin(0.35, d, lt)); return cam([lerp(-6, -2, k), lerp(8, 34, k), lerp(52, 70, k)], [0, lerp(7, 2, k), lerp(0, -16, k)], 46); },
  // s38 CU: Sumi sheathes (he faces +x); push in on the scabbard mouth, the click
  // (on his left hip from the side, sunset behind: hilt, the last metres of steel, the saya mouth; slow push to the click)
  s38: (lt, d, t) => {
    const k = eio(lin(78.5, C.click, t)), k2 = eio(lin(C.click, 80.25, t));
    return cam(add([lerp(-16.4, -15.2, k) + 0.4 * k2, lerp(6.4, 6.6, k), lerp(10.5, 9.0, k) - 0.6 * k2], shake(t, C.click, 0.06, 0.25)),
      [lerp(-10.8, -9.4, k), lerp(8.9, 8.7, k), lerp(1.6, 2.0, k)], lerp(34, 30, k));
  },
  // s39 the bow: side two-shot at mirror level, the sun between them: s14's lens, height and level gaze (A), closer
  s39: (lt, d) => { const k = eio(lt / d); return cam([0, lerp(3.6, 3.1, k), lerp(56, 49, k)], [0, lerp(9.4, 9.0, k), -1000], 36); },
  // s40 crane up high: two lines of ripples on the endless mirror
  s40: (lt, d) => { const k = eio(lin(0, d, lt)); return cam([0, lerp(6, 220, k), lerp(90, 340, k)], [0, lerp(8, 0, k), lerp(0, -300, k)], lerp(30, 52, k)); },
};

// ------------------------------------------------------------------ colour script (merged on the set preset)
const SUNK = { dir: [0.35, 0.45, -0.8], color: '#ffe0b0', tint: 0.18 };
const LOOKS = {
  s21: { inkRef: 30, mirror: { strength: 1, rough: 0 }, fogDensity: 0.00006, fogMax: 0.1, sat: 1.34, contrast: 0.32, gain: '#fff2e4', bloom: 0.75 },
  s22: { inkRef: 16, key: { dir: [0.2, 0.5, 0.9], color: '#ffe4bc', tint: 0.2 }, rim: { amt: 1.4 } },
  s23: { inkRef: 10, key: { dir: [0.1, 0.5, 0.9], color: '#ffe4bc', tint: 0.2 }, rim: { amt: 1.5 } },
  s24: { inkRef: 12, key: { dir: [0.0, 0.45, 0.9], color: '#ffd8b0', tint: 0.16 }, rim: { amt: 1.6 }, vignette: 0.24, bloom: 0.7 },
  s25: { inkRef: 30, fogDensity: 0.00016, fogMax: 0.24 },
  s26: { inkRef: 30, rim: { amt: 1.4 }, bloom: 0.75, glows: [{ pos: [0, 120, -90], color: '#ffd08a', size: 260, amount: 0.25 }] },
  s27: { inkRef: 20, rim: { amt: 1.4 } },
  s28: { inkRef: 8, key: { dir: [0.6, 0.6, 0.3], color: '#ffe8c8', tint: 0.2 } },
  s29: { inkRef: 8, key: { dir: [-0.6, 0.35, 0.6], color: '#ffd0a0', tint: 0.22 }, rim: { amt: 1.8 }, bloom: 0.85 },
  s30: { inkRef: 12, key: { dir: [0.3, 0.4, 0.9], color: '#fff0d8', tint: 0.2 } },
  s31: { inkRef: 8, bloom: 0.75 },
  s32: { inkRef: 20, key: { dir: [0, 0.2, 1], color: '#ffb890', tint: 0.1 }, rim: { amt: 2.0 }, bloom: 0.9 },
  s33: { inkRef: 16, rim: { amt: 1.8 }, bloom: 0.9 },
  s34: { inkRef: 16, rim: { amt: 1.8 }, bloom: 0.95, vignette: 0.22 },
  s35: { inkRef: 30, bloom: 1.0 },
  s36: { inkRef: 30, bloom: 0.85, rim: { amt: 1.4 } },
  s37: { inkRef: 12, key: SUNK },
  s38: { inkRef: 6, key: { dir: [0.7, 0.4, 0.6], color: '#ffe0b8', tint: 0.2 }, rim: { amt: 1.6 } },
  s39: { inkRef: 16, key: { dir: [0, 0.4, 1], color: '#ffe0b8', tint: 0.18 }, rim: { amt: 1.6 } },
  s40: (lt, d, t) => ({ inkRef: 30, fade: sm(83.5, 84.0, t) * 0.92, fadeColor: '#ffd590' }),
};

// ------------------------------------------------------------------ choreography
export async function create(ctx) {
  const { A } = ctx;
  const ap = () => ctx.api;
  ctx.api.fx?.mute?.('xcut'); ctx.api.fx?.mute?.('pour'); ctx.api.fx?.mute?.('swing');
  CAMS.s31 = (lt, d) => { const c = ctx.api.fx?.kaleidoCam?.(lt, d); return c ?? cam([0, 64, 220], [0, 64, 150], 40); };

  // per-frame reset of every ronin state this act touches (also run before act-1 shots so nothing leaks)
  function resetRonin(R) {
    if (!R) return;
    R.show(true); R.setLayer(0); if (R.twin) R.twin.show(false);
    R.root.scale.set(1, 1, 1); R.root.rotation.set(0, R.root.rotation.y, 0);
    R.eyes(1); R.scarfBurn?.(0);
  }
  function place(R, x, y, z, yaw) { R.root.position.set(x, y, z); R.root.rotation.set(0, yaw, 0); }
  function smear(R, k = 1.55) { R.root.scale.set(0.86, 1.04, k); }           // stretched along the travel (root +z)
  function wind(R, t, w) { R.cloth(two(t), w); }

  // ripples + drawn rings at a point
  function ringAt(x, z, t0, o = {}) { const fx = ap().fx, lake = ap().lake; lake?.ripple?.(Math.round(x), Math.round(z), t0, o.speed ?? 9); fx?.ring?.(V(x, 0, z), t0, { speed: o.speed ?? 9, life: o.life ?? 2.6, width: o.width ?? 0.45 }); }

  const ACT = {};
  // ---------------------------------------------------------------- s21 rise (top-down)
  ACT.s21 = (lt, d, t) => {
    const { sumi, yuki } = ap().ronin, g = ap().giant, tq = two(t);
    place(sumi, -30, 0, 0, FACE_R); place(yuki, 30, 0, 0, FACE_L);
    // still looking down; at the end they lift their heads and settle into readiness (anticipation for the charge)
    const up = sm(44.3, 44.8, tq);
    const LD = { neck: [0.25, 0, 0], head: [0.42, 0, 0] };              // A's s20 ends in guard / stance + look-down
    sumi.blade.draw(0.1); sumi.pose('guard'); sumi.pose(LD, 1 - up);
    yuki.blade.draw(1); yuki.pose('stance'); yuki.pose(LD, 1 - up);
    wind(sumi, t, V(1.5, 0, -2)); wind(yuki, t, V(1.5, 0, -2));
    // the giant slides from under the far mirror (z -70) to under their feet (eyes at z 0) while it rises
    // (seen from the high oblique cam its face, ~65-90 m deep, reads ~1/tan(36deg) x depth nearer: keep it far in z so
    // the eyes read right under the ronin; s22 resets it to z 0 for the low cameras)
    if (g?.state?.reflect) { g.pose({ z: lerp(-118, -92, sm(43.0, 45.0, two(t))) }); g.eyes(1.3 + 0.9 * sm(43.2, 44.6, two(t))); }
  };
  // ---------------------------------------------------------------- s22 charge
  function charge(t) {
    const { sumi, yuki } = ap().ronin, tq = two(t);
    for (const [R, s, lane, stride] of [[sumi, 1, LANE_S, 19], [yuki, -1, LANE_Y, 18]]) {
      const x = chargeX(tq, s);
      place(R, x, 0, lane, s > 0 ? FACE_R : FACE_L);
      if (tq < RUN0) {                              // anticipation: sink, coil
        R.pose(s > 0 ? 'guard' : 'stance'); R.pose({ hipsPos: [0, -1.8, -0.4] });
      } else if (tq < PASS - 0.15) {
        R.run(((Math.abs(x + 30 * s)) / stride + 0.1) % 1);
      } else if (tq < PASS) {                        // last drive: the low dash, Sumi's hand still on the hilt
        R.pose('dash');
      } else if (tq < PASS + 0.25) {                 // through: iai draw-cut / Yuki's horizontal slash
        R.pose(s > 0 ? 'draw-cut' : 'slash-horizontal');
      } else {                                       // drive the blades down into the mirror
        R.pose('pass-stab'); if (tq < PASS + 0.34) R.pose(s > 0 ? 'draw-cut' : 'slash-horizontal', 0.35);
      }
      R.blade.draw(s > 0 ? (tq < PASS - 0.15 ? 0.1 : 1) : 1);
      wind(R, t, V(-14 * s, 0, 0));
    }
    // smear frames on the fastest move (the frame just before the impact frames)
    const f = Math.round(t * 24), fp = Math.round(PASS * 24);
    if (f === fp - 1) { smear(sumi, 1.7); smear(yuki, 1.7); }
  }
  ACT.s22 = (lt, d, t, st) => {
    charge(t);
    if (st.look.speed) st.look.speed = { ...st.look.speed, amount: 0.28 * sm(45.2, 45.6, t) };
    const g = ap().giant; if (g?.state?.reflect) g.pose({ z: 0 });
  };
  ACT.s23 = (lt, d, t) => {
    charge(t);
    const g = ap().giant; if (g?.state?.reflect) g.pose({ z: 0, head: [0, 0, 0] });
    // the blades hit the mirror: splash + rings at the tips, sparks, the giant's eyes flare under them
    const fx = ap().fx, tS = PASS + 0.3;
    if (fx && t >= tS) {
      for (const [x, z] of [[11, LANE_S], [-11, LANE_Y]]) {
        fx.splash(V(x, 0, z), tS, 0.9, { n: 14, life: 0.8 });
        fx.sparks(V(x, 0.5, z), tS, { n: 12, speed: 12, life: 0.35, dir: V(0, 1, 0), flash: 2.4 });
        ringAt(x, z, tS, { speed: 7 });
      }
      g?.eyes?.(1 + 1.2 * (1 - lin(tS, tS + 0.5, t)));
    }
  };
  // ---------------------------------------------------------------- s24 silence: the hold
  ACT.s24 = (lt, d, t) => {
    const { sumi, yuki } = ap().ronin, g = ap().giant;
    place(sumi, 4, 0, LANE_S, FACE_R); place(yuki, -7, 0, LANE_Y, FACE_L);
    sumi.blade.draw(1); yuki.blade.draw(1); sumi.pose('pass-stab'); yuki.pose('pass-stab');
    wind(sumi, t, V(0, 0, 0)); wind(yuki, t, V(0, 0, 0));
    for (const [x, z] of [[11, LANE_S], [-11, LANE_Y]]) ringAt(x, z, PASS + 0.3, { speed: 7 });
    if (g?.state?.reflect) { g.pose({ z: 0 }); g.eyes(1 + 0.6 * sm(49.4, 49.75, t)); }
  };
  // ---------------------------------------------------------------- s25 crack (aerial)
  ACT.s25 = (lt, d, t) => {
    const { sumi, yuki } = ap().ronin, g = ap().giant, tq = two(t);
    place(sumi, 4, 0, LANE_S, FACE_R); place(yuki, -7, 0, LANE_Y, FACE_L);
    sumi.blade.draw(1); yuki.blade.draw(1);
    const rise = sm(51.0, 51.5, tq);              // they wrench the blades out and turn to the rising thing
    sumi.pose('pass-stab'); sumi.pose('chudan', rise); yuki.pose('pass-stab'); yuki.pose('stance', rise);
    if (tq > 51.4) { sumi.root.rotation.y = lerp(FACE_R, PI, sm(51.4, 51.8, tq)); yuki.root.rotation.y = lerp(FACE_L, -PI, sm(51.4, 51.8, tq)); }
    wind(sumi, t, V(0, 0, 3)); wind(yuki, t, V(0, 0, 3));
    if (g?.state?.reflect) { g.pose({ z: 0 }); g.eyes(1.6); }
    const fx = ap().fx;
    if (fx) for (const [x, z] of [[11, LANE_S], [-11, LANE_Y]]) fx.sparks(V(x, 0.5, z), C.crack, { n: 16, speed: 16, life: 0.5, dir: V(0, 1, 0), flash: 3 });
  };
  // ---------------------------------------------------------------- s26 emerge
  // pour (FX auto 'pour' muted in create): thin strand curtains off shoulders / arms / sword, clear of the chest + face
  function pourFx(t) {
    const fx = ap().fx; if (!fx || t < 52 || t >= 58) return;
    const k = sm(C.emerge, 53.0, t) * (1 - sm(56.5, 58, t));
    fx.pour(k, { anchors: ['shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'forearmL', 'forearmR', 'handL', 'handR', 'swordBase'], width: 10, outward: 9, spray: 0.6, n: 160 });
  }
  ACT.s26 = (lt, d, t) => {
    const { sumi, yuki } = ap().ronin, tq = two(t);
    place(sumi, 16, 0, FEET_Z + DZ_S, PI + 0.12); place(yuki, -16, 0, FEET_Z + DZ_Y, PI - 0.12);
    sumi.blade.draw(1); yuki.blade.draw(1);
    sumi.pose('chudan'); yuki.pose('stance');
    const g = ap().giant; g?.eyes?.(1.5 + 0.5 * sm(52.6, 53.4, tq));
    pourFx(t);
    // the crack web before FX's calmLake kicks in (52.3): dim it here too so the first frames are not a white floor
    const U = ap().lake?.uniforms?.uCrack; if (U && U.value.w > 0 && t < 52.5) U.value.w *= 0.45;
    // a step back as it rises (on twos, a held key)
    if (tq > 53.6) { sumi.pose('stride', 0.4); yuki.pose({ hipsPos: [0, -1.4, -0.6] }); }
    const w = V(0, 0, 9 * sm(52.3, 53.2, t)); wind(sumi, t, w); wind(yuki, t, w);
  };
  // ---------------------------------------------------------------- s27 swing: a low sweep carves the lake
  // custom sweep keys (armR [shX, shY, shZ, elbow], wristR [x,0,0], chest yaw) found by search: tip on the water at the
  // right (108,10,17), centre (-2,2,99), left (-122,-3,32)
  const KR = { armR: [0.4, 0, 0.2, -0.1], wristR: [-1.6, 0, 0], cy: 0.4 };
  const KM = { armR: [0.2, 0, 0.4, -0.5], wristR: [-1.0, 0, 0], cy: -0.4 };
  const KL = { armR: [0.0, 0, -0.6, -0.1], wristR: [-1.0, 0, 0], cy: -0.4 };
  const KW = { armR: [-2.6, 0.3, -0.45, -0.9], wristR: [-0.4, 0, 0], cy: -0.35 };   // wind-up (FX's .35 key)
  const KS = { armR: [0.35, 0, -0.1, -0.7], wristR: [-0.9, 0, 0], cy: 0 };          // rest
  const lk = (a, b, k) => ({ armR: a.armR.map((v, i) => lerp(v, b.armR[i], k)), wristR: a.wristR.map((v, i) => lerp(v, b.wristR[i], k)), cy: lerp(a.cy, b.cy, k) });
  function sweepKey(t) {
    if (t < 55.75) return lk(KS, KW, eio(lin(55.5, 55.75, t)) * 0.4);
    if (t < SW_T0) return lk(KS, KW, 0.4 + 0.6 * eo(lin(55.75, 56.08, t)));      // heavy wind-up, held
    if (t < 56.32) return lk(KW, KR, ei(lin(SW_T0, 56.32, t)));                  // the slam down to the right
    if (t < 56.5) return lk(KR, KM, lin(56.32, 56.5, t));                        // carve toward camera
    if (t < 56.7) return lk(KM, KL, eo(lin(56.5, 56.7, t)));                     // and away to the left
    return lk(KL, KS, 0.25 * sm(57.3, 58, t));                                   // follow-through hold
  }
  ACT.s27 = (lt, d, t, st) => {
    const { sumi, yuki } = ap().ronin, g = ap().giant, fx = ap().fx, tq = two(t);
    if (g) {
      const k = sweepKey(tq);
      g.pose({ rise: 1, x: 0, z: -90, yaw: 0, sword: null, armR: k.armR, wristR: k.wristR, chest: [0.15, k.cy, 0], head: [0.1, k.cy * 0.5, 0] });
    }
    // the ronin: brace, then leap apart over the sweeping blade (smears on the take-off), land low
    for (const [R, s] of [[sumi, 1], [yuki, -1]]) {
      const p = leapApart(tq, s);
      const yawF = s > 0 ? PI + 0.12 : PI - 0.12;
      place(R, p.x, p.y, p.z, p.air === 1 ? lerp(yawF, s > 0 ? FACE_L : FACE_R, sm(0, 0.3, p.u)) : p.air === 2 ? (s > 0 ? PI - 0.35 : PI + 0.35) : yawF);
      R.blade.draw(1);
      if (p.air === 0) { R.pose(s > 0 ? 'chudan' : 'stance'); if (tq > (s > 0 ? 56.1 : 56.2)) R.pose({ hipsPos: [0, -2.4, -0.4] }); }
      else if (p.air === 1) R.pose(p.u < 0.75 ? 'leap' : 'land-kneel');
      else { R.pose('land-kneel'); if (tq > 57.5) R.pose(s > 0 ? 'chudan' : 'stance', sm(57.5, 57.9, tq)); }
      const f = Math.round(t * 24), ft = Math.round((s > 0 ? 56.32 : 56.42) * 24) + 1;
      if (f === ft || f === ft + 1) smear(R, f === ft ? 1.7 : 1.35);
      wind(R, t, V(10 * s, -4, 3));
    }
    pourFx(t);
    if (fx) {
      // the cut on the water: wall segments following the blade tip (right -> centre -> left); FX auto 'swing' is muted:
      // thin layered sheets (alpha down), little mist, small glinting glass, so the ronin read through it
      const P0 = [[108, 17], [70, 60], [30, 92], [-2, 99], [-50, 80], [-90, 55], [-122, 32]];
      const T0 = [56.32, 56.38, 56.44, 56.5, 56.57, 56.63, 56.7];
      for (let i = 0; i < P0.length - 1; i++) fx.wall([V(P0[i][0], 0, P0[i][1]), V(P0[i + 1][0], 0, P0[i + 1][1])], T0[i], { height: 24, life: 1.3, alpha: 0.45, mist: 0.1, glass: 0.6 });
      if (tq >= 56.32 && tq < 56.9) fx.speedLines(0.4, { centre: [0.5, 0.5] }); else st.look.speed = 0;
      const f = Math.round(t * 24); if (f === Math.round(56.32 * 24)) fx.impact(1);
    }
  };
  // ---------------------------------------------------------------- s28 run up the arm
  ACT.s28 = (lt, d, t) => {
    const { sumi, yuki } = ap().ronin, tq = two(t);
    const p = armRun(tq), dir = ARM_B.clone().sub(ARM_A);
    place(yuki, p.x, p.y, p.z, Math.atan2(dir.x, dir.z));
    yuki.blade.draw(1); yuki.run(((tq - 58) * 18 / 18 / 0.95) % 1);
    wind(yuki, t, V(0, 0, 16));
    place(sumi, -58, 0, FEET_Z + DZ_S + 8, PI - 0.35); sumi.blade.draw(1); sumi.pose('chudan');
  };
  // ---------------------------------------------------------------- s29 aura
  ACT.s29 = (lt, d, t) => {
    const { sumi, yuki } = ap().ronin, tq = two(t);
    place(sumi, 52, 0, 70, FACE_L - 0.15);     // faces screen-left (-x) toward the giant, profile to camera
    sumi.blade.draw(1);
    if (tq < 60.42) sumi.pose('chudan');
    else if (tq < 60.6) { sumi.pose('chudan'); sumi.pose('jodan', 0.35); sumi.pose({ hipsPos: [0, -2.2, -0.3] }); }   // anticipation: sink
    else { sumi.pose('raise'); if (tq < 60.75) sumi.pose('jodan', 0.4); }                                             // up + overshoot settle
    sumi.scarfBurn(sm(60.8, 62.2, tq));
    wind(sumi, t, V(4, 9, 3));
    place(yuki, 30, 150, -20, 0); yuki.show(false); yuki._hidB = true;
  };
  // ---------------------------------------------------------------- s30 face cut
  ACT.s30 = (lt, d, t) => {
    const { sumi, yuki } = ap().ronin, tq = two(t);
    const p = faceLeap(tq);
    place(yuki, p.x, p.y, p.z, FACE_R - 0.35);
    yuki.blade.draw(1);
    const t1 = C.faceCut, t2 = C.faceCut + 0.25;
    if (tq < t1 - 0.17) yuki.pose('leap');
    else if (tq < t1) yuki.pose('stance');                 // coil
    else if (tq < t2 - 0.08) yuki.pose('slash-horizontal');
    else if (tq < t2 + 0.2) { yuki.pose('slash-horizontal'); yuki.root.rotation.y = FACE_R + 0.5; yuki.pose({ hips: [0, -0.5, 0] }); }
    else yuki.pose('leap');
    const f = Math.round(t * 24);
    if (f === Math.round(t1 * 24) - 1 || f === Math.round(t2 * 24) - 1) smear(yuki, 1.6);
    wind(yuki, t, V(-14, 2, 0));
    place(sumi, 52, 0, 70, FACE_L); sumi.blade.draw(1); sumi.pose('raise'); sumi.scarfBurn(1); sumi.show(false); sumi._hidB = true;
  };
  // ---------------------------------------------------------------- s31 kaleidoscope: Sumi charging (aura on)
  ACT.s31 = (lt, d, t) => {
    const { sumi, yuki } = ap().ronin, tq = two(t);
    const x = 52 - (tq - 64) * 15;
    place(sumi, x, 0, 70 - (tq - 64) * 6, FACE_L - 0.3);
    sumi.blade.draw(1); sumi.run(((tq - 64) * 15 / 19 + 0.25) % 1); sumi.scarfBurn(1);
    wind(sumi, t, V(14, 2, 4));
    yuki.show(false); yuki._hidB = true;
  };
  // ---------------------------------------------------------------- s32-s35 the sky
  function sky(t) {
    const { sumi, yuki } = ap().ronin, tq = two(t);
    const pS = skyPos(tq, 1), pY = skyPos(tq, -1);
    for (const [R, p, s] of [[sumi, pS, 1], [yuki, pY, -1]]) {
      R.show(true); R.blade.draw(1); R.scarfBurn?.(1);
      // facing: Sumi came from the right -> faces -x (screen-left), Yuki faces +x; three-quarter to camera
      place(R, p.x, p.y, p.z, s > 0 ? FACE_L + 0.45 : FACE_R - 0.45);
      if (tq < 67.7) R.pose('leap');
      else if (tq < C.cross) R.pose(s > 0 ? 'jodan' : 'dash');                       // wind-up at the apex, dive
      else R.pose(s > 0 ? 'slash-vertical' : 'slash-horizontal');                   // through, follow-through held
      const f = Math.round(t * 24), fx0 = Math.round(C.cross * 24);
      if (f === fx0 - 1) smear(R, 1.8);
      wind(R, t, tq < 68 ? V(0, -12, 0) : tq < 69.5 ? V(0, 10, 0) : tq < 70.75 ? V(0, 0, 0) : V(0, 6, 0));
    }
  }
  ACT.s32 = (lt, d, t, st) => { sky(t); if (st.look.speed) st.look.speed = { ...st.look.speed, amount: 0.3 }; };
  // the X: FX's xcut re-timed at a smaller size so the ronin read next to it (auto 'xcut' muted in create)
  function xcutFx(t, st) {
    const fx = ap().fx; if (!fx || t < C.cross || t >= 73.05) return;
    fx.xcut(Math.min(1, (two(t) - C.cross) / 1.2 + 0.001), { size: 78, width: 4.2, extend: sm(C.split, 72.6, t) });
    const f = st.frame, f0 = Math.round(C.cross * 24);
    if (f === f0 || f === f0 + 1) fx.impact(1); else if (f === f0 + 2) fx.impact(2);
  }
  const xk = (t) => 0.25 * sm(C.cross, C.cross + 0.25, two(t)) + 0.75 * sm(C.split, C.shatter, two(t));   // parts only in the split
  ACT.s33 = (lt, d, t, st) => { sky(t); ap().giant?.xCut?.(xk(t)); xcutFx(t, st); };
  ACT.s34 = (lt, d, t, st) => { sky(t); ap().giant?.xCut?.(xk(t)); xcutFx(t, st); };
  ACT.s35 = (lt, d, t, st) => {
    sky(t); const g = ap().giant; g?.xCut?.(xk(t)); xcutFx(t, st);
    const k = sm(C.split, 72.6, t), skyA = ap().sky;
    if (skyA) {
      const c = ctx.camera.position.clone().add(V(0, 160, -70).sub(ctx.camera.position).normalize().multiplyScalar(3200));
      skyA.splitFromView(k, c, ctx.camera, { angle: 49, width: 30 + k * 70, glow: 1 - k * 0.5 });
      skyA.sunFlare(sm(71.2, 72.4, t) * (1 - 0.3 * sm(72.5, 73, t)));
    }
  };
  // after the split the X stays torn in the sky over the lake, slowly closing (centred on the sun)
  function skyScar(t) {
    const skyA = ap().sky; if (!skyA) return;
    const k = 0.85 * (1 - 0.55 * sm(73, 84, t));
    const sun = V(0, 0.07, -1).normalize().multiplyScalar(3000);
    skyA.splitFromView(k, sun, ctx.camera, { angle: 49, width: 18 + 60 * k, glow: 0.35 });
  }
  // ---------------------------------------------------------------- s36 shatter: they fall through the glitter
  ACT.s36 = (lt, d, t) => {
    const { sumi, yuki } = ap().ronin, tq = two(t);
    for (const [R, s] of [[sumi, 1], [yuki, -1]]) {
      const p = fallPos(tq, s);
      place(R, p.x, p.y, p.z, s > 0 ? FACE_L : FACE_R); R.blade.draw(1); R.scarfBurn?.(1);
      R.pose('leap'); wind(R, t, V(0, 12, 0));
    }
    skyScar(t);
  };
  // ---------------------------------------------------------------- s37 heal: land back to back
  ACT.s37 = (lt, d, t) => {
    const { sumi, yuki } = ap().ronin, fx = ap().fx, tq = two(t);
    for (const [R, s] of [[sumi, 1], [yuki, -1]]) {
      const p = tq < LAND ? fallPos(tq, s) : V(-7 * s, 0, 0);
      place(R, p.x, p.y, p.z, s > 0 ? FACE_L : FACE_R); R.blade.draw(1); R.scarfBurn?.(1);
      if (tq < LAND) R.pose('leap');
      else if (tq < 77.5) { R.pose('land-kneel'); if (tq < LAND + 0.17) R.pose({ hipsPos: [0, -3.2, -0.6] }); }   // impact squash, then hold
      else { R.pose('land-kneel'); R.pose(s > 0 ? 'chudan' : 'stance', sm(77.5, 78.1, tq)); }
      wind(R, t, tq < LAND ? V(0, 12, 0) : V(-2 * s, 0, 2));
    }
    if (fx && t >= LAND) { for (const s of [1, -1]) { fx.splash(V(-8.5 * s, 0, 0.8), LAND, 1.0, { n: 16, life: 0.9 }); ringAt(-7 * s, 0, LAND, { speed: 10, life: 3 }); } }
    skyScar(t);
  };
  // ---------------------------------------------------------------- s38 sheathe
  ACT.s38 = (lt, d, t) => {
    const { sumi, yuki } = ap().ronin, tq = two(t);
    place(sumi, -7, 0, 0, FACE_L + 0.2); sumi.scarfBurn(1);
    // draw value: starts with ~3 m of steel out (hand on the hilt in front of the hip), slides in, the last sliver
    // closes on the click (draw 0 = guard against the saya mouth)
    const dv = tq < 78.75 ? 0.42 : tq < 79.25 ? lerp(0.42, 0.2, eio(lin(78.75, 79.25, tq))) : tq < C.click ? 0.2 * (1 - ei(lin(79.25, C.click, tq))) : 0;
    sumi.pose('sheathe'); sumi.blade.sheathe(1 - dv); sumi.pose('sheathe');
    if (tq >= C.click && tq < C.click + 0.17) sumi.pose({ hipsPos: [0, -1.25, -0.2] });    // the click: a tiny settle
    wind(sumi, t, V(2, 0, 3));
    place(yuki, 7, 0, 0, FACE_R); yuki.blade.draw(0); yuki.pose('idle'); yuki.show(false); yuki._hidB = true;   // CU: Yuki out
    skyScar(t);
  };
  // ---------------------------------------------------------------- s39 bow (rhyme of s14, sides swapped)
  ACT.s39 = (lt, d, t) => {
    const { sumi, yuki } = ap().ronin, tq = two(t);
    place(sumi, -10.5, 0, 0, FACE_R); place(yuki, 10.5, 0, 0, FACE_L);
    sumi.blade.draw(0); yuki.blade.draw(0); sumi.scarfBurn(1);
    const b0 = C.bow - 0.1, kb = tq < b0 ? 0 : tq < C.bow + 0.35 ? eio(lin(b0, C.bow + 0.35, tq)) : tq < 81.55 ? 1 : 1 - eio(lin(81.55, 81.95, tq));
    for (const R of [sumi, yuki]) { R.pose('idle'); R.pose('bow', kb); }
    const w = V(5, 0, -1); wind(sumi, t, w); wind(yuki, t, w);
    skyScar(t);
  };
  // ---------------------------------------------------------------- s40 part
  ACT.s40 = (lt, d, t) => {
    const { sumi, yuki } = ap().ronin, tq = two(t);
    for (const [R, s, stride] of [[sumi, -1, 8.4], [yuki, 1, 7.6]]) {      // s = walking direction
      R.blade.draw(0); if (R === sumi) R.scarfBurn(1);
      const yIn = s > 0 ? FACE_L : FACE_R, yOut = s > 0 ? FACE_R : FACE_L;    // facing each other -> turning away
      const yaw = tq < 82.15 ? yIn : tq < WALK0 ? yIn + (s > 0 ? -1 : 1) * PI / 2 : yOut;
      const x = walkX(tq, s, stride);
      place(R, x, 0, 0, yaw);
      if (tq < WALK0) R.pose('idle'); else R.walk(((tq - WALK0) / 1.25) % 1);
      wind(R, t, V(5, 0, -1));
      // a ripple ring at every footfall (2 per cycle): two lines of ripples
      for (let j = 0; j < 6; j++) {
        const tj = WALK0 + j * 0.625 + 0.3; if (tj > t) break;
        ringAt(s * (10.5 + (tj - WALK0) / 1.25 * stride) + 0.6 * s, j % 2 ? 1.2 : -1.2, tj, { speed: 6, life: 3.2 });
      }
    }
    skyScar(t);
  };

  registerDirection({ CAMS, LOOKS, ACT });
  const MINE = new Set(Object.keys(CAMS));
  return {
    update(st) {
      // keep act-2 state from leaking into other frames (scale smears, burnt scarf, hidden ronin, layers)
      if (st.test && !st.act) return;
      const r = ap().ronin; if (!r) return;
      if (MINE.has(st.sid)) { resetRonin(r.sumi); resetRonin(r.yuki); }
      else { for (const R of [r.sumi, r.yuki]) { R.root.scale.set(1, 1, 1); R.scarfBurn?.(0); if (R._hidB) { R.show(true); R._hidB = false; } } }
    },
  };
}
