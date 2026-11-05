// lands.js - dept LANDS: PASS (dawn snow ridge), LAKE (sunset salt-flat mirror), SKY (the lake sky for upward shots).
// Files: lands.js (this, API + update), lands_sky.js (painted sky shader, cumulus, stratus, mountains, X split),
// lands_lake.js (mirror shader for lake + ice, LAKE/SKY builds), lands_pass.js (PASS build), lands_geo.js (helpers).
//
// PUBLIC API (ctx.api) ------------------------------------------------------------------------------------------------
// ctx.api.lake = {
//   ripple(x, z, t0, speed = 9)  footstep / drop ring: call every frame it should exist (pure; ignored before t0 or
//                                after 7 s). Goes into look.mirror.ripples (max 8, newest kept) + drawn ring lines.
//   crack(k, centre = (0,0,0))   0..1, white-hot cracks race out from centre to the horizon (front r = k^1.4 * 4.2 km),
//                                the mirror breaks into Voronoi plates (per-plate reflection offset). Default schedule
//                                from CUES (crack 49.75 -> 52.0, held) unless someone calls crack() that frame.
//   heal(k)                      0..1, a silver mercury front closes the cracks from the centre outward. Default from
//                                CUES (heal 76.2 -> 78.5).
//   strokeDir(rad)               direction of the painted strokes on the water (default along X)
//   sunDir, groundY(x,z) -> 0, water (mesh), uniforms }
// ctx.api.sky = {
//   split(k, {centre, nA, nB, width, push, glow})  X split of the LAKE + SKY clouds: two planes through centre (world)
//                                with normals nA / nB; width = gap half-width (m, default k*90), push = puff slide (m,
//                                default k*140, only puffs near a cut move), glow = edge glow 0..1 (default 1-k*0.6). k 0 = off.
//   splitFromView(k, centre, camera, {angle = 40deg, ...})  same, planes contain the view ray so the X reads on screen.
//   sunFlare(k)                  extra halo + bloom on the sun (sky split / flare beats)
//   clouds: {LAKE, SKY, SKYnear} groups (InstancedMesh per tower; .material.uniforms), CUT (shared split uniforms) }
// ctx.api.pass = {
//   groundY(x, z)                snow height (feet / FX placement). A RIDGE: steps run on the crest x = 0 from z +140 (y 32)
//                                down to z -20 (y 0); ronin path x = +4.5 beside them; shelf + pond at y 0; cliff edge
//                                z ~ -112. Walkable top ~25-40 m wide (crest(z) -> [centre x, half width]), then rock
//                                drop-offs on both sides to the sea of clouds (y -150); the far end climbs to a summit.
//   crest(z)                     [centre x, half width] of the walkable top at z
//   anchors: {gate, gateWidth, lantern (snow cap top of the s04 hero lantern), cliffEdge, leapDir, pond, pondR,
//             stepsTop, stepsBottom, path(z) -> point on the ronin path}
//   ice: {eye(k, size = 7, centre?)  the omen crack on the ice (s09): an eye opening, k 0..1; default from CUES
//         omenIce flicker; uniforms}   pond ice is a mirror (id 121): set look.mirror = {on: true, y: 0, rough: ~0.5}
//   lanternSnow (mesh: the hero lantern's snow cap, FX may scale/hide it), lanterns, trees, layout, sunDir }
// ctx.api.lands = { sunDir: {PASS, LAKE, SKY}, look: {PASS, LAKE, SKY} (suggested look keys), groundY(set, x, z) }
//
// Test views (q): set=PASS|LAKE|SKY, stand=1 (stand-in ronin: sumi=x,z yuki=x,z, 18 m / 15 m), crack=k, crackc=x,z,
// heal=k, eye=k, split=k, flare=k.
import * as THREE from 'three';
import { V3, lerp, clamp, smooth } from './lands_sky.js';
import { buildPass, groundY as passGround, crest as passCrest, PASS_SUN } from './lands_pass.js';
import { buildLake, buildSky, LAKE_SUN } from './lands_lake.js';
import { LOOK_PRESETS } from './look.js';

// the LAKE / PASS / SKY look keys live in look.js (LOOK_PRESETS, owned by LANDS); exposed here as ctx.api.lands.look
export const LANDS_LOOK = { LAKE: LOOK_PRESETS.LAKE, SKY: LOOK_PRESETS.SKY, PASS: LOOK_PRESETS.PASS };

export async function create(ctx) {
  const { THREE: T, A, sets, CUES } = ctx;
  const pass = buildPass(ctx, sets.PASS);
  const lake = buildLake(ctx, sets.LAKE);
  const sky = buildSky(ctx, sets.SKY);
  const cue = (k, d) => (CUES && CUES[k] !== undefined ? CUES[k] : d);

  // ---------------------------------------------------------------- per-frame state (reset in update, pure in t)
  const F = { st: null, ripples: [], crackSet: false, healSet: false, splitSet: false, eyeSet: false, flareSet: false };
  const CUTS = [lake.CUT, sky.CUT];
  function pushRipples() {
    const st = F.st; if (!st || !st.look) return;
    const keep = F.ripples.slice().sort((a, b) => b[2] - a[2]).slice(0, 8);
    if (!st.look.mirror || st.look.mirror.on === false) { if (st.set !== 'LAKE' && !(st.q && st.q.get('mirror'))) return; st.look.mirror = { ...LANDS_LOOK[st.set].mirror }; }
    else st.look.mirror = { ...st.look.mirror };
    const prev = (st.look.mirror.ripples ?? []).filter((r) => !keep.some((k) => k[0] === r[0] && k[1] === r[1] && k[2] === r[2]));
    st.look.mirror.ripples = [...keep, ...prev].slice(0, 8);
  }
  const lakeApi = {
    ripple(x, z, t0, speed = 9) {
      const t = F.st ? F.st.t : 0;
      if (t < t0 || t - t0 > 7) return;
      if (F.ripples.some((r) => r[0] === x && r[1] === z && r[2] === t0)) return;
      F.ripples.push([x, z, t0, speed]); pushRipples();
    },
    crack(k, centre = V3(0, 0, 0)) { F.crackSet = true; lake.api.crack(k, centre); },
    heal(k) { F.healSet = true; lake.api.heal(k); },
    strokeDir: (a) => lake.api.strokeDir(a),
    sunDir: LAKE_SUN.clone(), groundY: () => 0, water: lake.water, uniforms: lake.api.uniforms,
  };
  function setSplit(k, o = {}) {
    F.splitSet = true;
    for (const C of CUTS) {
      if (!(k > 0)) { C.uCutA.value.w = 0; C.uCutB.value.w = 0; C.uCutPush.value = 0; C.uCutGlowAmt.value = 0; continue; }
      const c = o.centre ?? V3(0, 300, -1500), nA = (o.nA ?? V3(1, 1, 0)).clone().normalize(), nB = (o.nB ?? V3(1, -1, 0)).clone().normalize();
      const w = o.width ?? k * 90;
      C.uCutC.value.copy(c); C.uCutA.value.set(nA.x, nA.y, nA.z, w); C.uCutB.value.set(nB.x, nB.y, nB.z, w);
      C.uCutPush.value = o.push ?? k * 140; C.uCutGlowAmt.value = o.glow ?? clamp(1 - k * 0.6, 0, 1);
    }
  }
  const skyApi = {
    split: setSplit,
    splitFromView(k, centre, camera, o = {}) {
      const ang = (o.angle ?? 40) * Math.PI / 180;
      const fwd = centre.clone().sub(camera.position).normalize();
      const up = V3(0, 1, 0).applyQuaternion(camera.quaternion), rt = V3(1, 0, 0).applyQuaternion(camera.quaternion);
      // a cut line on screen at +-ang from horizontal: plane contains fwd and the line direction -> normal = fwd x line
      const lA = rt.clone().multiplyScalar(Math.cos(ang)).addScaledVector(up, Math.sin(ang));
      const lB = rt.clone().multiplyScalar(Math.cos(ang)).addScaledVector(up, -Math.sin(ang));
      setSplit(k, { ...o, centre, nA: V3().crossVectors(fwd, lA).normalize(), nB: V3().crossVectors(fwd, lB).normalize() });
    },
    sunFlare(k) { F.flareSet = true; for (const s of skies) s.material.uniforms.uFlare.value = k; },
    clouds: { LAKE: lake.clouds, SKY: sky.clouds, SKYnear: sky.near }, CUT: lake.CUT, CUTS, sunDir: LAKE_SUN.clone(),
  };
  const skies = [];
  for (const g of [sets.LAKE, sets.SKY]) g.traverse((o) => { if (o.name === 'anime_sky' && o.userData.lands) skies.push(o); });
  const passApi = {
    groundY: passGround, crest: passCrest, anchors: pass.anchors, layout: pass.layout, sunDir: PASS_SUN.clone(),
    ice: { eye(k, size, centre) { F.eyeSet = true; pass.ice.eye(k, size, centre); }, uniforms: pass.ice.uniforms },
    lanternSnow: pass.lanternSnow, lanterns: pass.lanterns, trees: pass.trees,
  };
  ctx.api.lake = lakeApi; ctx.api.sky = skyApi; ctx.api.pass = passApi;
  ctx.api.lands = {
    sunDir: { PASS: PASS_SUN.clone(), LAKE: LAKE_SUN.clone(), SKY: LAKE_SUN.clone() }, look: LANDS_LOOK,
    groundY: (set, x, z) => (set === 'PASS' ? passGround(x, z) : 0),
  };
  pass.ice.eye(0, 7, pass.anchors.pond);

  // ---------------------------------------------------------------- stand-in ronin (test views only)
  const stand = new T.Group(); stand.visible = false; ctx.scene.add(stand);
  function standIn(h, base, accent, eye) {
    const g = new T.Group(); const s = h / 18;
    const body = A.celMaterial({ base, id: 50, highlight: 0.3, rimColor: '#ffe0b0' }), acc = A.celMaterial({ base: accent, id: 51, highlight: 0.4 });
    const eyeM = A.fxMaterial({ color: eye, intensity: 2, bloom: 1.5 });
    const part = (geo, m, x, y, z, rx = 0, rz = 0) => { const o = new T.Mesh(geo, m); o.position.set(x * s, y * s, z * s); o.rotation.set(rx, 0, rz); o.scale.setScalar(s); g.add(o); return o; };
    part(new T.CapsuleGeometry(1.0, 6.5, 6, 12), body, -1.1, 4.2, 0, 0, 0.03); part(new T.CapsuleGeometry(1.0, 6.5, 6, 12), body, 1.1, 4.2, 0, 0, -0.03);
    part(new T.CapsuleGeometry(2.6, 3.2, 8, 16), body, 0, 10.2, 0);
    part(new T.SphereGeometry(1.5, 16, 12), body, 0, 14.6, 0);
    part(new T.BoxGeometry(2.0, 0.25, 0.4), eyeM, 0, 14.7, 1.35);
    part(new T.CapsuleGeometry(1.4, 1.2, 6, 12), acc, -3.6, 12.5, 0, 0, 0.4); part(new T.CapsuleGeometry(1.4, 1.2, 6, 12), acc, 3.6, 12.5, 0, 0, -0.4);
    part(new T.CapsuleGeometry(0.6, 5.5, 6, 10), body, -3.9, 8.6, 0, 0, 0.1); part(new T.CapsuleGeometry(0.6, 5.5, 6, 10), body, 3.9, 8.6, 0, 0, -0.1);
    part(new T.BoxGeometry(0.25, 0.5, 9), acc, 2.8, 7.2, 1.0, 0.4, 0);
    return g;
  }
  const SUMI = standIn(18, '#2c3150', '#a3242c', '#ff3b2e'), YUKI = standIn(15, '#eeedf2', '#d2402f', '#5cf2ff');
  stand.add(SUMI, YUKI);

  const vq = (q, k) => { const v = q && q.get(k); return v ? v.split(',').map(Number) : null; };
  const nq = (q, k) => { const v = q && q.get(k); return v !== null && v !== undefined && v !== '' ? Number(v) : null; };

  return {
    update(st) {
      F.st = st; F.ripples = []; F.crackSet = F.healSet = F.splitSet = F.eyeSet = F.flareSet = false;
      const t = st.t, q = st.q;
      A.AU.uWind.value.set(st.set === 'PASS' ? 0.6 : 1, 2.2, A.onTwos(t), 0);
      // defaults from the cue sheet (pure in t); later departments override by calling the api this frame
      const c0 = cue('crack', 49.75), h0 = cue('heal', 76.2);
      let ck = smooth(c0, c0 + 2.25, t) * (t >= c0 ? 1 : 0), hk = smooth(h0, h0 + 2.3, t);
      if (nq(q, 'crack') !== null) ck = nq(q, 'crack');
      if (nq(q, 'heal') !== null) hk = nq(q, 'heal');
      const cc = vq(q, 'crackc');
      lake.api.crack(t >= c0 || nq(q, 'crack') !== null ? Math.max(ck, 0.0001) : 0, cc ? V3(cc[0], 0, cc[1]) : V3(0, 0, 0));
      lake.api.heal(hk >= 1 ? 1 : hk);
      if (hk >= 1) lake.api.crack(0);
      // ice eye: opens at omenIce on threes with a flicker, closes by the end of s09
      const oi = cue('omenIce', 17.6), tt = A.onThrees(t);
      let ek = 0;
      if (tt >= oi - 0.05 && tt < 18.75) { const a = tt - oi; ek = a < 0 ? 0 : (a < 0.125 ? 0.5 : a < 0.25 ? 0.15 : a < 0.75 ? Math.min(1, 0.6 + a * 0.6) : Math.max(0, 1 - (a - 0.75) * 1.4)); }
      if (nq(q, 'eye') !== null) ek = nq(q, 'eye');
      pass.ice.eye(ek);
      setSplit(nq(q, 'split') ?? 0); F.splitSet = false;
      if (nq(q, 'splitv') !== null) { ctx.camera.updateMatrixWorld(); const sc = vq(q, 'splitc') ?? [0, 300, -3000]; skyApi.splitFromView(nq(q, 'splitv'), V3(...sc), ctx.camera, { angle: nq(q, 'splita') ?? 22 }); }
      for (const s of skies) s.material.uniforms.uFlare.value = nq(q, 'flare') ?? 0;
      // stand-ins
      stand.visible = !!(q && q.get('stand'));
      if (stand.visible) {
        const gy = (x, z) => (st.set === 'PASS' ? passGround(x, z) : 0);
        const s = vq(q, 'sumi') ?? [-30, 0], y = vq(q, 'yuki') ?? [30, 0];
        SUMI.position.set(s[0], gy(s[0], s[1]), s[1]); SUMI.rotation.y = Math.atan2(y[0] - s[0], y[1] - s[1]);
        YUKI.position.set(y[0], gy(y[0], y[1]), y[1]); YUKI.rotation.y = Math.atan2(s[0] - y[0], s[1] - y[1]);
        const ry = nq(q, 'sumiry'), yy = nq(q, 'yukiry');
        if (ry !== null) SUMI.rotation.y = ry; if (yy !== null) YUKI.rotation.y = yy;
        SUMI.visible = !q.get('nosumi'); YUKI.visible = !q.get('noyuki');
      }
      if (st.set === 'LAKE' || st.set === 'PASS') pushRipples();
    },
  };
}
