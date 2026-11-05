// shots.js - KAGAMI script data (transcribed from CONTRACT.md) + evalFrame(frame, q) -> st.
// Direction modules register per-shot functions with registerDirection({CAMS, LOOKS, ACT}):
//   CAMS[sid](lt, d, t, st) -> {pos, look, fov, roll?, near?, far?}   pos/look: Vector3 or [x, y, z]; fov + roll in DEGREES
//   LOOKS[sid] -> look object, or (lt, d, t, st) -> look; merged on top of the set preset from look.js (one level deep
//                 for object keys like mirror / sky / key / sun / speed)
//   ACT[sid](lt, d, t, st, ctx)   runs after every department update (direction last); may edit st.cam and the post keys of
//                 st.look (impact, speed, mirror ...). Light keys (sun/key/shade/rim/ambient/sky) are written to the shared
//                 uniforms BEFORE the department updates: from ACT use A.setKey(...) / A.AU directly.
// st = {frame, t, sid, shot, set, under, lt, dur, d, u, cues, look, cam, q, test, act, since(cue)}
//   lt = time inside the shot, dur = d = shot length, u = lt / dur, since('cross') = t - CUES.cross
import * as THREE from 'three';
import { LOOK_PRESETS, mergeLook } from './look.js';

export const FILM = 'KAGAMI';
export const FPS = 24;
export const DURATION = 84;
export const FRAMES = DURATION * FPS;   // 2016
export const W = 1920, H = 1040;
export const SETS = ['CITY', 'PASS', 'LAKE', 'SKY'];
// department modules in UPDATE order (contract); main loads src/<name>.js, or src/<name>/index.js | src/<name>/<name>.js
// when the .js file is missing or is a stub (exports STUB)
export const DEPTS = ['lands', 'city', 'ronin', 'giant', 'fx', 'direction/act1', 'direction/act2'];

const S = (id, name, t0, t1, set) => ({ id, name, t0, t1, set, under: false, dur: t1 - t0 });
export const SHOTS = [
  S('s01', 'open', 0, 3.5, 'LAKE'),
  S('s02', 'puddle', 3.5, 5.25, 'CITY'),
  S('s03', 'street', 5.25, 7.75, 'CITY'),
  S('s04', 'snow hand', 7.75, 9.5, 'PASS'),
  S('s05', 'steps', 9.5, 12.0, 'PASS'),
  S('s06', 'sumi eye', 12.0, 13.5, 'CITY'),
  S('s07', 'yuki eye', 13.5, 15.0, 'PASS'),
  S('s08', 'omen puddle', 15.0, 17.0, 'CITY'),
  S('s09', 'omen ice', 17.0, 18.75, 'PASS'),
  S('s10', 'leap', 18.75, 20.75, 'PASS'),
  S('s11', 'causeway', 20.75, 22.5, 'CITY'),
  S('s12', 'touchdown', 22.5, 24.5, 'LAKE'),
  S('s13', 'approach', 24.5, 28.0, 'LAKE'),
  S('s14', 'duel frame', 28.0, 31.0, 'LAKE'),
  S('s15', 'hilt', 31.0, 32.75, 'LAKE'),
  S('s16', 'stance', 32.75, 34.5, 'LAKE'),
  S('s17', 'eyes', 34.5, 36.0, 'LAKE'),
  S('s18', 'drop', 36.0, 38.5, 'LAKE'),
  S('s19', 'ring', 38.5, 41.0, 'LAKE'),
  S('s20', 'look down', 41.0, 43.0, 'LAKE'),
  S('s21', 'rise', 43.0, 45.0, 'LAKE'),
  S('s22', 'charge', 45.0, 47.0, 'LAKE'),
  S('s23', 'pass', 47.0, 48.5, 'LAKE'),
  S('s24', 'silence', 48.5, 49.75, 'LAKE'),
  S('s25', 'crack', 49.75, 52.0, 'LAKE'),
  S('s26', 'emerge', 52.0, 55.5, 'LAKE'),
  S('s27', 'swing', 55.5, 58.0, 'LAKE'),
  S('s28', 'run arm', 58.0, 60.25, 'LAKE'),
  S('s29', 'aura', 60.25, 62.25, 'LAKE'),
  S('s30', 'face cut', 62.25, 64.0, 'LAKE'),
  S('s31', 'shards', 64.0, 66.0, 'LAKE'),
  S('s32', 'leap', 66.0, 68.0, 'SKY'),
  S('s33', 'cross', 68.0, 69.5, 'SKY'),
  S('s34', 'still', 69.5, 70.75, 'SKY'),
  S('s35', 'sky split', 70.75, 73.0, 'SKY'),
  S('s36', 'shatter', 73.0, 76.0, 'LAKE'),
  S('s37', 'heal', 76.0, 78.5, 'LAKE'),
  S('s38', 'sheathe', 78.5, 80.25, 'LAKE'),
  S('s39', 'bow', 80.25, 82.0, 'LAKE'),
  S('s40', 'part', 82.0, 84.0, 'LAKE'),
];
SHOTS.forEach((s, i) => { s.index = i; s.f0 = Math.round(s.t0 * FPS); s.f1 = Math.round(s.t1 * FPS); });
export const SHOT = Object.fromEntries(SHOTS.map((s) => [s.id, s]));

export const CUES = {
  sumiStep: 3.9, yukiBrush: 8.2, omenFlash: 15.9, omenIce: 17.6, yukiLeap: 19.4, touchdown: 22.9, standoff: 28.0,
  guardClick: 31.8, drawYuki: 33.3, dropFall: 37.2, dropHit: 38.6, eyesOpen: 39.9, lookDown: 41.2, charge: 45.0, pass: 47.6,
  silence: 48.5, crack: 49.75, emerge: 52.3, swing: 56.2, aura: 60.5, faceCut: 62.9, leap: 66.2, cross: 68.4, still: 69.5,
  split: 70.75, shatter: 73.0, heal: 76.2, click: 79.4, bow: 80.8, end: 84.0,
};

// placeholder camera per set until direction fills CAMS (a slow push so frames are never dead)
export const PLACEHOLDER_CAMS = {
  LAKE: { pos: [0, 4, 70], look: [0, 12, 0], fov: 40 },
  CITY: { pos: [0, 5, 45], look: [0, 14, 0], fov: 45 },
  PASS: { pos: [0, 12, 60], look: [0, 8, 0], fov: 42 },
  SKY: { pos: [0, 80, 120], look: [0, 110, 0], fov: 45 },
};
export const CAM_DEFAULTS = { near: 0.1, far: 12000 };

// ------------------------------------------------------------ direction registry
export const DIRECTION = { CAMS: {}, LOOKS: {}, ACT: {} };
export function registerDirection(mod = {}) {
  for (const k of ['CAMS', 'LOOKS', 'ACT']) if (mod[k]) Object.assign(DIRECTION[k], mod[k]);
  return DIRECTION;
}

// ------------------------------------------------------------ evaluation
// direction functions never break a frame: an error is logged once (console + DIRECTION.errors) and the frame falls back
DIRECTION.errors = [];
const _seen = new Set();
function safe(tag, fn, fallback) {
  try { return fn(); } catch (e) {
    const k = tag + ':' + e?.message;
    if (!_seen.has(k)) { _seen.add(k); DIRECTION.errors.push(k); console.error(`[${tag}]`, e); }
    return fallback;
  }
}
export function shotAt(t) {
  if (t <= 0) return SHOTS[0];
  for (const s of SHOTS) if (t < s.t1) return s;
  return SHOTS[SHOTS.length - 1];
}
const v3 = (v) => (v && v.isVector3 ? v.clone() : new THREE.Vector3(...(v ?? [0, 0, 0])));
const num = (q, k, d) => (q.has(k) && q.get(k) !== '' ? parseFloat(q.get(k)) : d);
const vec = (q, k) => (q.has(k) ? q.get(k).split(',').map(Number) : null);
export function normCam(c, set) {
  const p = PLACEHOLDER_CAMS[set] ?? PLACEHOLDER_CAMS[SETS[0]];
  c = c ?? p;
  return { ...c, pos: v3(c.pos ?? p.pos), look: v3(c.look ?? c.at ?? p.look), fov: c.fov ?? p.fov ?? 40, roll: c.roll ?? 0,
    near: c.near ?? p.near ?? CAM_DEFAULTS.near, far: c.far ?? p.far ?? CAM_DEFAULTS.far };
}
function placeholderCam(set, lt) {
  const p = PLACEHOLDER_CAMS[set] ?? PLACEHOLDER_CAMS[SETS[0]];
  const pos = v3(p.pos), look = v3(p.look), k = Math.min(lt, 6) * 0.015;
  return { pos: pos.lerp(look, k), look, fov: p.fov };
}
// split 'POND-UNDER' -> {set: 'POND', under: true}
export function parseSet(s) { const m = /^(.*?)(-UNDER)?$/.exec(s ?? ''); return { set: m[1], under: !!m[2] }; }

// evalFrame(frame, q?) -> st. q = URLSearchParams; test mode (?test=1|demo) honours set / cam / at / fov / roll / t / f
// (&act=1 also runs the shot's LOOKS + ACT in test mode; &impact= &flash= &memory= &under= &speed= &fade= &mirror= set look keys)
export function evalFrame(frame, q = new URLSearchParams()) {
  const test = q.has('test');
  let t = frame / FPS;
  if (test && q.has('t')) t = num(q, 't', 0);
  else if (test && q.has('f')) t = num(q, 'f', 0) / FPS;
  frame = Math.round(t * FPS);
  const shot = shotAt(t);
  const lt = t - shot.t0, dur = shot.dur;
  let { set, under } = test && q.has('set') ? parseSet(q.get('set')) : { set: shot.set, under: shot.under };
  if (test && q.get('under') === '1') under = true;
  const act = !test || q.get('act') === '1' || (!q.has('set') && !q.has('cam'));
  const st = { frame, t, sid: shot.id, shot, set, under, lt, dur, d: dur, u: lt / dur, cues: CUES, q, test, act, since: (c) => t - CUES[c] };
  // look: per-frame basics, set preset, then the shot's LOOKS
  let look = mergeLook({ t, frame, inkSeed: Math.floor(t * 12 + 1e-6) }, LOOK_PRESETS[set] ?? {});
  if (under && LOOK_PRESETS.UNDER) look = mergeLook(look, LOOK_PRESETS.UNDER);
  if (under) look.under = look.under || true;
  st.look = look;
  const L = DIRECTION.LOOKS[shot.id];
  if (act && L && set === shot.set) st.look = mergeLook(look, safe('LOOKS ' + shot.id, () => (typeof L === 'function' ? L(lt, dur, t, st) : L), {}));
  // camera
  const C = DIRECTION.CAMS[shot.id];
  let cam = act && C && set === shot.set ? safe('CAMS ' + shot.id, () => (typeof C === 'function' ? C(lt, dur, t, st) : C), null) : null;
  if (!cam || !cam.pos) cam = placeholderCam(set, lt);
  if (test && q.has('cam')) cam = { pos: vec(q, 'cam'), look: vec(q, 'at') ?? PLACEHOLDER_CAMS[set]?.look, fov: num(q, 'fov', 40), roll: num(q, 'roll', 0), near: num(q, 'near', undefined), far: num(q, 'far', undefined) };
  else if (test) { if (q.has('fov')) cam.fov = num(q, 'fov', 40); if (q.has('roll')) cam.roll = num(q, 'roll', 0); if (q.has('at')) cam.look = vec(q, 'at'); }
  st.cam = normCam(cam, set);
  // test look toggles
  if (test) {
    for (const k of ['impact', 'flash', 'memory', 'fade', 'exposure']) if (q.has(k)) st.look[k] = num(q, k, 0);
    if (q.has('under')) st.look.under = num(q, 'under', 0);
    if (q.has('speed')) st.look.speed = { amount: num(q, 'speed', 1), centre: vec(q, 'speedc') ?? [0.5, 0.5] };
    if (q.has('mirror')) st.look.mirror = num(q, 'mirror', 1) > 0 ? { ...(st.look.mirror ?? { on: true, y: 0 }), on: true, strength: num(q, 'mirror', 1) } : { on: false };
  }
  return st;
}
export function evalTime(t, q) { return evalFrame(Math.round(t * FPS), q); }
