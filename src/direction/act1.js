// direction/act1.js - DIRECTION A (KAGAMI s01-s20): cameras (on ones), looks (colour script on top of look.js) and
// choreography (ronin on twos, FX triggers, world states). Registered through CAMS / LOOKS / ACT exports (main.js).
//
// Staging (screen direction is law until s23): SUMI travels / faces screen-right, YUKI screen-left.
//   CITY  Sumi walks the street toward +Z (x -1.5), stops at the crossing z 31 (s06), crosses it toward +X (s08, the omen
//         twin stays behind in the puddle), walks the causeway toward -Z (s11).
//   PASS  Yuki kneels at the hero lantern (s04), walks down the path x 4.5 toward -Z (s05, s07, s09), leaps off the cliff
//         toward -Z (s10). Cameras on the -X side so -Z reads screen-left.
//   LAKE  duel line on z = 0, sun at -Z: Sumi from -X walking +X, Yuki from +X walking -X, both stop at +-30 at 28.0.
// Hand-off to DIRECTION B at 43.0: Sumi (-30,0,0) faces +X, guard + look-down, blade.draw(0.1); Yuki (30,0,0) faces -X,
//   stance, both kodachi drawn, look-down; wind still.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const eio = (k) => 0.5 - 0.5 * Math.cos(PI * clamp(k));                 // ease in-out (sine)
const eout = (k) => 1 - Math.pow(1 - clamp(k), 3);
const ein = (k) => Math.pow(clamp(k), 2);
const L3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const tw = (t) => Math.floor(t * 12 + 1e-6) / 12;                       // on twos (characters)
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// ---------------------------------------------------------------- walk timelines (pure in t; positions on twos)
const SUMI_P = 1.7, SUMI_D = 8.4, SUMI_V = SUMI_D / SUMI_P;            // heavy, deliberate: 4.94 m/s
const YUKI_P = 1.25, YUKI_D = 7.6, YUKI_V = YUKI_D / YUKI_P;            // light: 6.08 m/s
const YUKI_RP = 0.8, YUKI_RD = 18, YUKI_RV = YUKI_RD / YUKI_RP;          // run
const ph = (t, t0, P) => ((((t - t0) / P) % 1) + 1) % 1;
// CITY street: left foot lands in the s02 puddle at sumiStep 3.9 (z 23.0)
const CITY_Z = (t) => 20.4 + SUMI_V * (t - 3.9);
// causeway: walking -Z, left foot lands at 22.9 (continues into s12: the match cut on the foot)
const CW_Z = (t) => -2.58 + SUMI_V * (22.9 - t);
// LAKE: Sumi left foot lands at 22.9 (s12) and at 28.0 (stop); Yuki's left foot lands at 28.0 (stop)
const LAKE_SX = (t) => -30.85 - SUMI_V * (28.0 - t);
const LAKE_YX = (t) => 30.9 + YUKI_V * (28.0 - t);
// PASS
const PATH_X = 4.5;
const OMEN_SIGN = 1;

// ---------------------------------------------------------------- shared state
let C = null;   // ctx
const api = () => C.api;
function R(n) { return C.api.ronin?.[n]; }
function place(r, x, y, z, yaw) { r.root.position.set(x, y, z); r.root.rotation.set(0, yaw, 0); r.root.updateMatrixWorld(true); }
function wind(r, t, w) { r.cloth(tw(t), V(...w)); }
const passY = (x, z) => C.api.pass?.groundY?.(x, z) ?? 0;
function only(who) { const s = R('sumi'), y = R('yuki'); if (s) s.show(who !== 'yuki'); if (y) y.show(who !== 'sumi'); }
// root-space target for a pose dict from a world point
function toRoot(r, p) { r.root.updateMatrixWorld(true); const v = p.clone(); r.root.worldToLocal(v); return [v.x, v.y, v.z]; }

// ================================================================= CAMERAS (on ones)
const cam = (pos, look, fov, roll = 0) => ({ pos: V(...pos), look: V(...look), fov, roll });
export const CAMS = {
  // s01 HOOK: extreme wide sunset mirror, sky doubled, two tiny silhouettes far apart; slow push
  s01: (lt, d) => { const k = eio(lt / d) * 0.6 + lt / d * 0.4; return cam([0, lerp(4.6, 3.8, k), lerp(330, 285, k)], [0, lerp(22, 20, k), -1000], 34); },
  // s02 low macro profile from the west sidewalk: the foot stamps into the neon puddle (moving screen-right)
  s02: (lt, d) => { const k = lt / d; return cam([-15.5, 0.55, lerp(21.4, 23.4, eio(k))], [-1.4, lerp(1.7, 1.9, k), lerp(22.8, 24.0, eio(k))], 32); },
  // s03 low front dolly-back down the neon canyon
  s03: (lt, d) => { const k = eio(lt / d); return cam([-1.0, lerp(3.0, 3.4, k), lerp(50, 57, k)], [-1.5, lerp(10.8, 11.2, k), lerp(18, 26, k)], 44); },
  // s06 CU helmet: slow push, slit flares, head turns a touch to screen-right (toward the crossing)
  s06: (lt, d) => { const k = eio(lt / d); return cam([lerp(-0.1, -0.5, k), lerp(14.3, 14.5, k), lerp(43.5, 40.0, k)], [-1.4, lerp(14.75, 14.9, k), 31], 28); },
  // s08 omen: long lens, low, across the puddle: Sumi crosses screen-right at z 30, the reflection stays behind
  s08: (lt, d) => { const k = eio(lt / d); const z = eio(sstep(0.1, 0.95, lt)); return cam([lerp(9.5, 9.35, k), 1.0, lerp(110, 109, k)], [lerp(-3.4, -5.4, z), lerp(0.6, -1.5, z), 30], lerp(29, 22.5, z)); },
  // s11 low rear 3/4 tracking along the causeway, the golden glow ahead, the last street around him
  s11: (lt, d, t) => { const z = CW_Z(t); const k = lt / d; return cam([lerp(9.5, 7.5, k), lerp(2.4, 1.6, eio(k)), z + lerp(19, 15, k)], [-1.5, lerp(6.5, 4.5, eio(k)), z - 22], 46); },
  // s12 match cut on the foot: side, mirror level, sun beyond; the foot lands, the ring spreads over the reflected sunset
  s12: (lt, d) => { const k = eio(lt / d); return cam([lerp(-56.0, -54.2, k), 0.62, lerp(9.5, 8.6, k)], [lerp(-53.6, -52.4, k), lerp(0.85, 1.2, k), -6], 30); },
  // s13 high aerial: the two walk in from opposite edges, clouds doubled in the mirror; slow dolly forward
  // (fix1: tilted up so the sun + its reflection and the doubled clouds stay in frame the whole shot)
  s13: (lt, d) => { const k = eio(lt / d); return cam([lerp(-4, 3, k), lerp(64, 57, k), lerp(96, 85, k)], [0, 0, lerp(-150, -136, k)], 50); },
  // s14 ICONIC duel frame: side wide at mirror level, sun exactly between them; slow push
  s14: (lt, d) => { const k = eio(lt / d) * 0.7 + 0.3 * lt / d; return cam([0, lerp(3.6, 3.1, k), lerp(92, 76, k)], [0, lerp(8.6, 8.2, k), -1000], 36); },
  // s15 CU hilt from his front-right, sun rim behind; tiny push on the click
  s15: (lt, d, t) => { const k = eio(lt / d); const h = HILT; return cam(add(h, [lerp(4.6, 4.1, k), lerp(-3.7, -3.3, k), lerp(2.5, 2.1, k)]), add(h, [-0.36, -0.5, -0.36]), lerp(27, 25, k)); },
  // s16 Yuki sinks into the stance: medium from her front-left (+Z side), the sun behind her
  s16: (lt, d) => { const k = eio(lt / d); return cam([lerp(13.5, 15.0, k), lerp(5.2, 4.2, k), lerp(19.5, 17.0, k)], [lerp(28.5, 28.8, k), lerp(7.6, 6.4, k), 0], 40); },
  // s17 extreme CUs cross-cut: red slit (first half) / cyan eyes (second half); each a slow push
  s17: (lt, d) => {
    if (lt < 0.75) { const k = eio(lt / 0.75); const e = EYE_S; return cam(add(e, [lerp(4.0, 3.4, k), 0.15, lerp(2.3, 1.95, k)]), add(e, [0, -0.05, 0]), 22); }
    const k = eio((lt - 0.75) / 0.75); const e = EYE_Y; return cam(add(e, [lerp(-3.6, -3.1, k), -0.85, lerp(2.0, 1.7, k)]), add(e, [0, -0.15, 0]), 22);
  },
  // s18 macro at mirror level, total stillness: the drop swells at the scarf tip and falls toward its own reflection
  s18: (lt, d) => { const k = eio(lt / d); const p = DROP_P; return cam([p[0] + 1.2, 0.55, p[2] + lerp(10.5, 9.6, k)], [p[0] + 0.6, p[1] * 0.42, p[2]], 50); },
  // s19 the ring: start low on the hit, then crane up + tilt DOWN into the reflection; the giant's eyes open (39.9)
  // (fix1: an oblique end framing so the mirror keeps the reflected sunset colour; the look target sinks from the ring to
  //  the giant's face 76 m deep in the reflection = the tilt down INTO the mirror; ronin feet at the upper frame edges)
  s19: (lt, d, t) => {
    const p = DROP_P, k = eio(sstep(0.3, 1.6, lt)), h = lt > 1.6 ? eio((lt - 1.6) / (d - 1.6)) : 0;
    const pos = L3([p[0] + 1.2, 1.1, p[2] + 6.0], [lerp(-3, 0, h), lerp(50, 45, h), lerp(61, 55, h)], k);
    const look = L3([p[0], 0, p[2] - 0.5], [0, -76, -76], k);
    return cam(pos, look, lerp(40, lerp(33, 30, h), k), 0);
  },
  // s20 3/4 two-shot from behind Sumi's right side: both look down at the same moment
  s20: (lt, d) => { const k = eio(lt / d); return cam([-6, lerp(31, 27.5, k), lerp(75, 66, k)], [0, 0, lerp(-21, -18, k)], 48); },
};
// PASS cameras
Object.assign(CAMS, {
  // s04 macro: the white hand sweeps the snow off the mossy lantern cap, flakes in the dawn light
  // (fix1: a clean long-lens macro on the cap only; Yuki's body sits outside frame right, only the arm enters)
  s04: (lt, d) => { const k = eio(lt / d); const L = LANTERN(); return cam([L[0] + lerp(0.95, 0.8, k), L[1] + lerp(1.6, 1.5, k), L[2] - lerp(7.8, 7.0, k)], [L[0] - 0.45, L[1] - 0.1, L[2]], 17); },
  // s05 wide: Yuki has just come through the broken gate and walks down beside the steps (fix1: front-left 3/4, low, so
  //   she reads big against the dawn sky; the steps run up behind her to the gate; slow dolly back + pan on ones)
  s05: (lt, d, t) => { const k = eio(lt / d); const z = Y5_Z(t); return cam([lerp(-20.5, -19, k), lerp(19, 18, k), lerp(55, 52.5, k)], [4.5, passY(4.5, z) + 7.5, z - 2], 42); },
  // s07 CU faceplate from her front-left: cyan eyes, breath from the cheek vents
  s07: (lt, d) => { const k = eio(lt / d); const e = EYE_Y7; return cam(add(e, [lerp(-3.4, -2.8, k), lerp(-0.9, -0.75, k), lerp(-4.6, -3.9, k)]), add(e, [0.1, -0.2, 0]), 28); },
  // s09 frozen pond from the west, low: Yuki passes beyond the ice, her reflection in it; the eye-crack flickers
  s09: (lt, d) => { const k = eio(lt / d); return cam([-33, lerp(4.4, 3.8, k), lerp(-58, -60, k)], [lerp(-8, -10, k), 0.8, -66], 40); },
  // s10 side wide from the west: she runs, leaps off the promontory into the sea of clouds (pan follows on ones)
  // (fix1: close + low tracking side camera, her silhouette large against the sky with the sea of clouds below)
  s10: (lt, d, t) => { const p = YUKI10(t, true); const k = eio(lt / d); return cam([lerp(-31, -28, k), lerp(1.5, -1, k), Math.min(p[2] + 4, -114)], [4.5, p[1] * 0.5 + lerp(7, 3, k), p[2] - 2.5], 40); },
});

// anchor caches (pure: computed from fixed staging)
let HILT = [-28.4, 9.2, -0.9], EYE_S = [-29.6, 15.9, 0], EYE_Y = [29.6, 13.0, 0], EYE_Y7 = [4.5, 13, -10], DROP_P = [-33, 3.5, 0];
const LANTERN = () => (C?.api.pass?.anchors?.lantern ? C.api.pass.anchors.lantern.toArray() : [-3.4, 2.95, -36]);
// s05: she walks down toward the gate (z 40) and stops short of it on the cut (her head never meets the 12 m tie beam)
const Y5_Z = (t) => 60 - YUKI_V * (t - 9.5);
function YUKI10(t, ones = false) {
  const tL = 19.4, edge = C?.api.pass?.anchors?.cliffEdge ?? V(4.5, 0, -115.8);
  const tq = ones ? t : tw(t);   // ones: the camera follows on ones
  if (tq < tL) return [PATH_X, passY(PATH_X, edge.z + YUKI_RV * (tL - tq)), edge.z + YUKI_RV * (tL - tq)];
  const u = tq - tL;
  return [PATH_X, edge.y + 7.5 * u - 9 * u * u, edge.z - 17 * u];
}

// ================================================================= LOOKS (colour script)
const KEY_FRONT = { dir: [0.25, 0.55, 0.8] };
const Y_FACE = { head: [-0.45, 0, 0], neck: [0, 0, 0] };   // Yuki's stance with the eyes locked on Sumi
export const LOOKS = {
  s01: { inkRef: 60, key: { dir: [0.2, 0.4, 0.9], tint: 0.2 }, bloom: 0.7 },
  s02: { key: { dir: [-0.6, 0.5, 0.5] } },
  s03: { inkRef: 14, key: { dir: [0.2, 0.5, 0.9] } },
  s06: { key: { dir: [0.35, 0.45, 0.85], color: '#ffb0d8' }, rim: { dir: [0.7, 0.3, -0.6], amt: 1.3 } },
  s08: { inkRef: 40, key: { dir: [0.3, 0.5, 0.85] } },
  s11: { inkRef: 12, key: { dir: [-0.3, 0.5, 0.9], color: '#ffc8a0' }, rim: { dir: [0, 0.2, -1], amt: 1.4 } },
  s12: { key: { dir: [0.2, 0.5, 0.9] }, rim: { dir: [0, 0.15, -1], amt: 1.3 } },
  s13: { inkRef: 90 },
  s14: { inkRef: 40, key: { dir: [0.0, 0.45, 0.9], tint: 0.2 }, rim: { dir: [0, 0.12, -1], amt: 1.5 } },
  s15: { key: { dir: [0.55, 0.5, 0.65] }, rim: { dir: [-0.4, 0.2, -1], amt: 1.4 } },
  s16: { inkRef: 12, key: { dir: [-0.6, 0.5, 0.65] }, rim: { dir: [0.3, 0.2, -1], amt: 1.4 } },
  s17: (lt) => (lt < 0.75 ? { key: { dir: [0.6, 0.4, 0.7] }, rim: { dir: [-0.5, 0.2, -1], amt: 1.5 } } : { key: { dir: [-0.6, 0.4, 0.7] }, rim: { dir: [0.5, 0.2, -1], amt: 1.5 } }),
  s18: { key: { dir: [0.1, 0.4, 0.9] }, rim: { dir: [0, 0.1, -1], amt: 1.6 }, bloom: 0.8 },
  // fix1: haze ~0 so the reflected sunset + the giant stay saturated; eyes are the brightest thing (bloom)
  s19: { inkRef: 30, fogDensity: 0.00002, fogMax: 0.04, celFog: 0.05, bloom: 0.75, sat: 1.22 },
  s20: { inkRef: 30, key: { dir: [0.0, 0.6, 0.8] }, fogDensity: 0.00015, fogMax: 0.22 },
  // PASS: the ice mirror only in s09 (reflection pass cost)
  s04: { mirror: { on: false }, inkRef: 3, key: { dir: [-0.55, 0.55, -0.6], tint: 0.15 }, rim: { dir: [0.35, 0.45, 1], amt: 1.7 }, bloom: 0.75 },
  s05: { mirror: { on: false }, inkRef: 30 },
  s07: { mirror: { on: false }, key: { dir: [-0.6, 0.45, -0.65] }, rim: { dir: [0.6, 0.2, 0.7], amt: 1.3 } },
  s09: { mirror: { on: true, y: 0, rough: 0.5, strength: 0.9 }, inkRef: 25 },
  s10: { mirror: { on: false }, inkRef: 60 },
};

// ================================================================= ACT (choreography, on twos)
// shared LAKE staging for s14-s20 (after the stop)
function lakeStanding(t, o = {}) {
  const s = R('sumi'), y = R('yuki');
  place(s, -30, 0, 0, PI / 2); place(y, 30, 0, 0, -PI / 2);
  return { s, y };
}
export const ACT = {
  s01(lt, d, t) {
    const s = R('sumi'), y = R('yuki'); only('both');
    place(s, -70, 0, 0, PI / 2); place(y, 70, 0, 0, -PI / 2);
    s.blade.draw(0); y.blade.draw(0); s.pose('idle'); y.pose('idle'); s.eyes(1.2); y.eyes(1.2);
    wind(s, t, [-9, 0.5, 3]); wind(y, t, [9, 0.5, 3]);
  },
  s02(lt, d, t) {
    const s = R('sumi'); only('sumi');
    const tq = tw(t);
    place(s, -1.5, 0, CITY_Z(tq), 0); s.blade.draw(0); s.walk(ph(tq, 3.9, SUMI_P)); s.eyes(1);
    wind(s, t, [-1, 0, -7]);
  },
  s03(lt, d, t) {
    const s = R('sumi'); only('sumi');
    const tq = tw(t);
    place(s, -1.5, 0, 18 + SUMI_V * (tq - 5.25), 0); s.blade.draw(0); s.walk(ph(tq, 5.25 - 0.2, SUMI_P)); s.eyes(1);
    wind(s, t, [2, 0.5, -9]);
  },
  s06(lt, d, t) {
    const s = R('sumi'); only('sumi');
    const tq = tw(t);
    place(s, -1.5, 0, 31, 0); s.blade.draw(0); s.pose('idle');
    const k = sstep(12.45, 12.75, tq);   // head lifts + turns a touch screen-right (toward the crossing)
    s.pose({ neck: [lerp(0.05, -0.04, k), lerp(0, -0.12, k), 0], head: [lerp(0.05, -0.1, k), lerp(0, -0.18, k), 0] });
    s.eyes(lerp(0.8, 1.9, sstep(12.6, 12.85, tq)) - 0.25 * sstep(12.85, 13.2, tq));
    wind(s, t, [3, 0.5, -8]);
  },
  s08(lt, d, t, st, ctx) {
    const s = R('sumi'); only('sumi');
    const tq = tw(t), tStop = 15.5, x0 = -9.0;
    const xr = x0 + SUMI_V * (tq - 15.0);
    place(s, xr, 0, 30, PI / 2); s.blade.draw(0); s.walk(ph(tq, 15.0, SUMI_P)); s.eyes(1);
    wind(s, t, [-8, 0.5, 1]);
    s.setLayer(ctx.LAYER.MAIN_ONLY);
    const tw8 = s.reflectionTwin(); tw8.show(true); tw8.blade.draw(0);
    if (tq < tStop) { place(tw8, xr, 0, 30, PI / 2); tw8.walk(ph(tq, 15.0, SUMI_P)); tw8.eyes(1); }
    else {
      place(tw8, x0 + SUMI_V * (tStop - 15.0), 0, 30, PI / 2);
      tw8.walk(ph(tStop, 15.0, SUMI_P)); tw8.pose('stride', 0.6);
      const k = sstep(15.62, 15.82, tq);   // the head snaps round to the lens
      const sg = OMEN_SIGN * (st.q?.has('omenyaw') ? +st.q.get('omenyaw') : 1);
      tw8.pose({ neck: [0, -0.5 * k * sg, 0], chest: [0.03, -0.22 * k * sg, 0], head: [-0.12 * k, -1.0 * k * sg, 0] });
      const white = t >= 15.875 && t < 16.0;   // 3 frames
      tw8.eyes(white ? 2.2 : lerp(1, 0.35, sstep(16.0, 16.3, tq)), white ? '#ffffff' : undefined);
      if (white) { const e = tw8.anchor('eye'); api().fx?.glint(e, 15.875, { size: 3.2, life: 0.13, layer: 2 }); }
    }
    tw8.cloth(tw(t), V(-8, 0.5, 1));
  },
  s11(lt, d, t) {
    const s = R('sumi'); only('sumi');
    const tq = tw(t);
    place(s, 0, 0, CW_Z(tq), PI); s.blade.draw(0); s.walk(ph(tq, 22.9, SUMI_P)); s.eyes(1);
    wind(s, t, [-3, 0.6, 9]);
  },
  s12(lt, d, t) {
    const s = R('sumi'), y = R('yuki'); only('sumi');
    const tq = tw(t);
    place(s, LAKE_SX(tq), 0, 0, PI / 2); s.blade.draw(0); s.walk(ph(tq, 22.9, SUMI_P)); s.eyes(1);
    wind(s, t, [-9, 0.5, 2]);
    api().lake?.ripple(-53.45, -0.1, 22.9, 7);
  },
  s13(lt, d, t) {
    const s = R('sumi'), y = R('yuki'); only('both');
    const tq = tw(t);
    place(s, LAKE_SX(tq), 0, 0, PI / 2); s.blade.draw(0); s.walk(ph(tq, 22.9, SUMI_P)); s.eyes(1);
    place(y, LAKE_YX(tq), 0, 0, -PI / 2); y.blade.draw(0); y.walk(ph(tq, 28.0, YUKI_P)); y.eyes(1);
    wind(s, t, [-9, 0.5, 2]); wind(y, t, [9, 0.5, 2]);
    // footstep rings on the mirror (one per planted step, the last few)
    const L = api().lake;
    if (L) for (let i = 0; i < 4; i++) {
      const ts = 22.9 + SUMI_P / 2 * Math.floor((tq - 22.9) / (SUMI_P / 2) - i); if (ts >= 22.9) L.ripple(LAKE_SX(ts) + 2.6, 0, ts, 6);
      const ty = 28.0 - YUKI_P / 2 * Math.ceil((28.0 - tq) / (YUKI_P / 2) + i); L.ripple(LAKE_YX(ty) - 2.36, 0, ty, 6);
    }
    // fix1: ripple TRAILS behind both (drawn rings for every planted step, back to before the shot)
    const fx = api().fx;
    if (fx) for (let i = 0; i < 10; i++) {
      const ts = 22.9 + SUMI_P / 2 * (Math.floor((tq - 22.9) / (SUMI_P / 2)) - i);
      if (ts >= 22.9 && ts <= tq) fx.ring(V(LAKE_SX(ts) + 2.6, 0, 0), ts, { speed: 2.2, life: 4.5, width: 0.45, r0: 0.6 });
      const ty = 28.0 - YUKI_P / 2 * (Math.ceil((28.0 - tq) / (YUKI_P / 2)) + i);
      if (ty <= tq) fx.ring(V(LAKE_YX(ty) - 2.36, 0, 0), ty, { speed: 2.0, life: 4.5, width: 0.4, r0: 0.5 });
    }
  },
  s14(lt, d, t) {
    const s = R('sumi'), y = R('yuki'); only('both');
    const tq = tw(t);
    if (tq < 28.0) {
      place(s, LAKE_SX(tq), 0, 0, PI / 2); s.walk(ph(tq, 22.9, SUMI_P));
      place(y, LAKE_YX(tq), 0, 0, -PI / 2); y.walk(ph(tq, 28.0, YUKI_P));
    } else {
      place(s, -30, 0, 0, PI / 2); place(y, 30, 0, 0, -PI / 2);
      // stop: stride with the weight settling back (overshoot then hold), then the long silent hold
      const k = sstep(28.0, 28.35, tq);
      s.pose('stride'); s.pose({ hipsPos: [0, -0.85 - 0.25 * Math.sin(PI * k), -0.2] });
      y.pose('stride'); y.pose({ hipsPos: [0, -0.71 - 0.2 * Math.sin(PI * k), -0.17] });
    }
    s.blade.draw(0); y.blade.draw(0); s.eyes(1); y.eyes(1);
    wind(s, t, [-9, 0.5, 2.5]); wind(y, t, [9, 0.5, 2.5]);
    const L = api().lake; if (L) { L.ripple(-27.4, 0, 28.0, 6); L.ripple(27.64, 0, 28.0, 6); }
  },
  s15(lt, d, t) {
    const { s, y } = lakeStanding(t); only('both');
    const tq = tw(t);
    s.pose('stride'); s.pose('guard', sstep(31.0, 31.25, tq));     // hand settles on the hilt
    s.blade.draw(0.1 * sstep(31.75, 31.84, tq));                     // the thumb pushes the guard: a sliver of steel
    s.pose({ hiltR: [1] });
    y.pose('stride'); y.blade.draw(0); s.eyes(1); y.eyes(1);
    wind(s, t, [-8, 0.5, 2.5]); wind(y, t, [8, 0.5, 2.5]);
  },
  s16(lt, d, t) {
    const { s, y } = lakeStanding(t); only('both');
    const tq = tw(t);
    s.pose('guard'); s.blade.draw(0.1);
    // anticipation: rises a touch, then sinks into the low stance while both kodachi come out reverse-grip
    y.pose('stride');
    y.pose('guard', sstep(32.9, 33.15, tq));
    if (tq >= 33.25) { y.pose('stance', eout((tq - 33.25) / 0.42)); }
    y.blade.draw(sstep(33.3, 33.55, tq));
    if (tq >= 33.67 && tq < 33.84) y.pose({ hipsPos: [0, -3.25 * 0.833, -0.3 * 0.833] });   // overshoot
    if (tq >= 33.25) y.pose({ head: [-0.45, -0.4 * (1 - sstep(33.5, 33.9, tq)), 0], neck: [0, -0.2 * (1 - sstep(33.5, 33.9, tq)), 0] });   // eyes onto Sumi
    s.eyes(1); y.eyes(1);
    const w = lerp(8, 3, sstep(33.4, 34.3, tq));   // the plume settles
    wind(s, t, [-8, 0.5, 2.5]); wind(y, t, [w, 0.3, 1.5]);
  },
  s17(lt, d, t) {
    const { s, y } = lakeStanding(t); only('both');
    s.pose('guard'); s.blade.draw(0.1); y.pose('stance'); y.pose(Y_FACE); y.blade.draw(1);
    const tq = tw(t);
    s.eyes(lt < 0.75 ? lerp(1.2, 2.0, sstep(34.6, 34.9, tq)) : 1); y.eyes(lt >= 0.75 ? lerp(1.2, 2.0, sstep(35.35, 35.6, tq)) : 1);
    wind(s, t, [-5, 0.3, 2]); wind(y, t, [3, 0.3, 1.5]);
  },
  s18(lt, d, t) {
    const { s, y } = lakeStanding(t); only('both');
    s.pose('guard'); s.blade.draw(0.1); y.pose('stance'); y.pose(Y_FACE); y.blade.draw(1); s.eyes(1); y.eyes(1);
    stillCloth(s, y, t);
    const p = dropPoint(s, t);
    api().fx?.drop(V(...p), 37.2, 38.6, { size: 0.3, hang: 0.45, splashSize: 0.2 });
  },
  s19(lt, d, t) {
    const { s, y } = lakeStanding(t); only('both');
    s.pose('guard'); s.blade.draw(0.1); y.pose('stance'); y.pose(Y_FACE); y.blade.draw(1); s.eyes(1); y.eyes(1);
    stillCloth(s, y, t);
    const p = dropPoint(s, t);
    const fx = api().fx;
    fx?.drop(V(...p), 37.2, 38.6, { size: 0.3, hang: 0.45, splashSize: 0.2, ringSpeed: 2.2 });
    // the ring keeps going: a wide wave spreads across the lake (reflection wobble + drawn rings)
    fx?.ring(V(p[0], 0, p[2]), 38.6, { speed: 9, life: 2.4, width: 0.5, r0: 0.3 });
    api().lake?.ripple(p[0], p[2], 38.6, 9);
    // fix1: the giant's white-sun eyes open brighter than anything else (auto opens them at eyesOpen 39.9)
    const g = api().giant;
    if (g?.state?.reflect) { const tq = tw(t); g.eyes(1.8 * sstep(39.9, 40.25, tq)); g.aura(0.85); g.pose({ head: [0.55 * sstep(39.9, 40.5, tq), 0, 0] }); }   // the face lifts toward them
  },
  s20(lt, d, t) {
    const { s, y } = lakeStanding(t); only('both');
    const tq = tw(t), k = sstep(41.2, 41.45, tq);
    s.pose('guard'); s.blade.draw(0.1); y.pose('stance'); y.blade.draw(1);
    // both look down at the same moment (a 1-drawing flinch up first = anticipation)
    const up = tq >= 41.1 && tq < 41.2 ? 1 : 0;
    s.pose({ neck: [0.25 * k - 0.06 * up, 0, 0], head: [0.42 * k - 0.08 * up, 0, 0], chest: [0.12 + 0.06 * k, -0.12, 0] });
    y.pose({ neck: [0.25 * k - 0.06 * up, 0, 0], head: [0.42 * k - 0.45 * (1 - k) - 0.08 * up, 0, 0] });
    s.eyes(1 + 0.4 * k); y.eyes(1 + 0.4 * k);
    stillCloth(s, y, t);
    // fix1: the giant's face (lifted in s19) settles back so s20 ends exactly on FX auto (hand-off to act 2)
    const g = api().giant; if (g?.state?.reflect) g.pose({ head: [0.55 * (1 - sstep(41.6, 42.8, tq)), 0, 0] });
  },
};
// PASS choreography
Object.assign(ACT, {
  s04(lt, d, t) {
    const y = R('yuki'); only('yuki');
    const tq = tw(t), L = V(...LANTERN());
    // fix1: kneeling well to the west of the lantern (outside the macro frame, screen-right), facing -Z; only the right
    // arm enters: reach in from frame right (7.75-8.05), one sweep across the cap toward +X = screen-left (8.05-8.35,
    // yukiBrush 8.2), follow-through + lift (8.35-8.6), withdraw out of frame right (8.75-9.15), clean lantern + flakes
    const rx = L.x - 3.3, rz = L.z + 0.4;
    place(y, rx, passY(rx, rz), rz, PI); y.blade.draw(0); y.eyes(1);
    y.pose('land-kneel'); y.pose({ hipsPos: [0, -5.2 * 0.833, 0.3 * 0.833] });
    const pre = eout((tq - 7.75) / 0.3), k = sstep(8.05, 8.35, tq), ft = sstep(8.35, 8.6, tq), wd = sstep(8.75, 9.15, tq);
    const hx = lerp(lerp(-3.6, -1.2, pre), 1.45, k) + lerp(0, 0.3, ft) - lerp(0, 4.6, wd);
    const hy = lerp(1.3, 0.3, pre) + 0.1 * Math.sin(PI * k) + 0.5 * ft + 1.3 * wd;
    const hw = V(L.x + hx, L.y + hy, L.z + lerp(0.35, 0.05, k));
    y.pose({ handRp: toRoot(y, hw), handRf: [-0.75, -0.6, 0.1], handRz: [0, 0, 1], gripR: [0.2 + 0.3 * ft], elbowR: [-0.6, -0.8, -0.2], head: [0.3, -0.25, 0], neck: [0.2, -0.15, 0] });
    const cap = api().pass?.lanternSnow;
    if (cap) { cap.userData.s0 ??= cap.scale.clone(); const r = 1 - 0.9 * sstep(8.1, 8.35, tq); cap.scale.set(cap.userData.s0.x, cap.userData.s0.y * r, cap.userData.s0.z); }
    const fx = api().fx;
    if (fx) {   // the snow comes off the cap in two puffs that follow the hand, then drifts on (FX draws them on threes)
      fx.puff(V(L.x - 0.2, L.y + 0.1, L.z), 8.14, { size: 0.32, n: 4, life: 0.9, spread: 0.35, dir: V(1, 0.3, -0.15) });
      fx.puff(V(L.x + 0.6, L.y + 0.1, L.z), 8.24, { size: 0.42, n: 6, life: 1.15, spread: 0.5, dir: V(1, 0.4, -0.1) });
      fx.puff(V(L.x + 1.4, L.y + 0.25, L.z - 0.1), 8.34, { size: 0.36, n: 4, life: 1.1, spread: 0.6, dir: V(0.8, 0.5, -0.2) });
    }
    wind(y, t, [1.5, 0.3, 6]);
    armOnly(y);   // macro cheat: the kneeling body sits just outside frame right; only the arm is drawn
  },
  s05(lt, d, t) {
    const y = R('yuki'); only('yuki');
    const tq = tw(t), z = Y5_Z(tq);
    place(y, PATH_X, passY(PATH_X, z), z, PI); y.blade.draw(0); y.walk(ph(tq, 9.5, YUKI_P)); y.eyes(1);
    wind(y, t, [2.5, 0.3, 9]);
    for (let i = 0; i < 3; i++) api().fx?.breath(() => y.anchor('mouth'), 9.8 + i * 0.85, { dir: V(0.1, 0.25, -1), size: 0.5 });
  },
  s07(lt, d, t) {
    const y = R('yuki'); only('yuki');
    const z = -10, tq = tw(t);
    place(y, PATH_X, passY(PATH_X, z), z, PI); y.blade.draw(0); y.pose('idle'); y.eyes(lerp(1, 1.6, sstep(13.9, 14.15, tq)));
    const k = sstep(14.05, 14.3, tq);   // eyes lift from the path to the horizon
    y.pose({ neck: [lerp(0.08, -0.02, k), 0.05, 0], head: [lerp(0.1, -0.08, k), lerp(0.12, 0.2, k), 0] });
    wind(y, t, [2.5, 0.3, 8]);
    const fx = api().fx;
    if (fx) for (let i = 0; i < 2; i++) for (const n of ['ventL', 'ventR']) fx.breath(() => y.anchor(n), 13.65 + i * 0.75, { dir: V(n === 'ventL' ? 0.35 : -0.35, 0.15, -1), size: 0.45, life: 0.85 });
  },
  s09(lt, d, t) {
    const y = R('yuki'); only('yuki');
    const tq = tw(t), z = -58 - YUKI_V * (tq - 17.0), x = 1.5;
    place(y, x, passY(x, z), z, PI); y.blade.draw(0); y.walk(ph(tq, 17.0, YUKI_P)); y.eyes(1);
    wind(y, t, [2.5, 0.3, 8]);
  },
  s10(lt, d, t) {
    const y = R('yuki'); only('yuki');
    const tq = tw(t), p = YUKI10(t), tL = 19.4;
    place(y, ...p, PI); y.blade.draw(0); y.eyes(1.2);
    if (tq < tL - 0.09) y.run(ph(tq, tL - 0.1, YUKI_RP));
    else if (tq < tL) y.pose('stance');                               // 1 drawing of crouch: anticipation
    else { y.pose('leap'); const u = tq - tL; y.root.rotation.x = -0.35 * sstep(0, 1.2, u); y.root.updateMatrixWorld(true); }
    wind(y, t, tq < tL ? [1.5, 0.5, 14] : [0, 8, 10]);
    const e = C.api.pass?.anchors?.cliffEdge; if (e) api().fx?.puff(V(e.x, e.y + 0.5, e.z + 1), tL - 0.05, { size: 6, n: 7, life: 1.4, spread: 1.6, dir: V(0, 0.7, 0.5) });
  },
});

// macro cheat (s04): hide every part of a ronin except its right arm subtree (restored every frame in update())
const HIDDEN = [];
function armOnly(r) {
  const J = r.rig?.J?.armR; if (!J) return;
  r.root.traverse((o) => {
    if (!(o.isMesh || o.isLine || o.isPoints) || !o.visible) return;
    for (let p = o; p; p = p.parent) if (p === J) return;
    o.visible = false; HIDDEN.push(o);
  });
}

// still LAKE (s18-s20): the wind is gone
function stillCloth(s, y, t) { s.cloth(tw(t), V(-0.6, 0, 0.6)); y.cloth(tw(t), V(0.6, 0, 0.6)); }
// deterministic drop point: the scarf tip at dropFall with the still wind, on the mirror
function dropPoint(s) {
  const t0 = s.clothT, w0 = s.wind.clone();
  s.cloth(tw(37.2), V(-0.6, 0, 0.6)); const p = s.anchor('scarfTip').toArray();
  s.cloth(t0, w0);
  DROP_P = p; return p;
}

// anchor caches refreshed after the poses, then the shot camera is re-evaluated (ACT may edit st.cam; main applies it
// after ACT), so a CU camera never depends on a previous frame
function caches(sid) {
  const s = R('sumi'), y = R('yuki');
  if (sid === 's15') HILT = s.anchor('handR').toArray();
  if (sid === 's17') { EYE_S = s.anchor('eye').toArray(); EYE_Y = y.anchor('eye').toArray(); }
  if (sid === 's07') EYE_Y7 = y.anchor('eye').toArray();
}
for (const sid of Object.keys(ACT)) {
  const f = ACT[sid];
  ACT[sid] = (lt, d, t, st, ctx) => {
    f(lt, d, t, st, ctx);
    caches(sid);
    if (st.test && st.q?.has('cam')) return;
    const c = CAMS[sid]?.(lt, d, t, st); if (!c) return;
    st.cam.pos.copy(c.pos); st.cam.look.copy(c.look); st.cam.fov = c.fov; st.cam.roll = c.roll ?? 0;
  };
}

// ================================================================= module
const MINE = new Set(['s01', 's02', 's03', 's04', 's05', 's06', 's07', 's08', 's09', 's10', 's11', 's12', 's13', 's14', 's15', 's16', 's17', 's18', 's19', 's20']);
export async function create(ctx) {
  C = ctx;
  const fx = ctx.api.fx;
  if (fx?.mute) { fx.mute('breath'); fx.mute('drop'); fx.mute('yukiLeap'); fx.mute('snow'); }   // A calls its own (direction-aware breath, bigger drop)
  return {
    update(st) {
      const s = R('sumi'), y = R('yuki'); if (!s || !y) return;
      // every frame, every shot: undo per-shot state so frames render in any order
      for (const o of HIDDEN) o.visible = true; HIDDEN.length = 0;
      // PASS snow is drawn here (FX auto 'snow' muted): s04 macro gets small flakes so none balloons in front of the lens
      if (st.set === 'PASS' && ctx.api.fx) ctx.api.fx.snow(st.sid === 's04' ? 0.8 : 0.6, st.sid === 's04' ? { size: 0.035 } : {});
      for (const r of [s, y]) { r.setLayer(0); r.show(true); r.scarfBurn(0); r.root.rotation.x = 0; if (r.twin) r.twin.show(false); }
      const cap = ctx.api.pass?.lanternSnow; if (cap?.userData.s0) cap.scale.copy(cap.userData.s0);
      if (!MINE.has(st.sid) || (st.test && !st.act)) return;
    },
  };
}
