// ronin.js - dept RONIN: SUMI 墨 (heavy black, 18 m) and YUKI 雪 (slim white, 15 m), procedural mecha
// samurai: rigid lacquer plates on joint pivots, laced lamellar rows, crests, faceplates, eye glows, scarf / plume on
// procedural bone chains, nodachi + 2 kodachi with scabbards. Files: src/ronin.js + src/ronin/{kit,parts,rig,poses,sumi,yuki}.js
//
// API  ctx.api.ronin = { sumi, yuki, POSES, ref(show) }  each ronin R:
//   R.root                     THREE.Group: place / rotate it (ground y = 0, faces +Z). Parent it anywhere.
//   R.pose(name | dict, k?)     set a named pose (k omitted) or blend toward it by k (0..1) from the pose set earlier
//                               this frame. dict = authoring keys of src/ronin/rig.js POSE_KEYS (partial OK: merged on
//                               top of the current pose). Names: idle, stride, guard, stance, dash, pass-stab, leap,
//                               slash-vertical, slash-horizontal, land-kneel, sheathe, bow, look-down, chudan, raise
//                               (blade straight up, aura), jodan (wind-up overhead), draw-cut (iai finish)  [Sumi];
//                               Yuki has the same names (reverse-grip versions; raise/jodan/chudan = stance).
//                               Pose at A.onTwos(t) (characters draw on twos).
//   R.walk(phase) / R.run(phase)   cycle pose, phase 0..1 per two steps; move the root by R.stride.walk / .run metres
//                               per cycle so feet stay planted (Sumi walk 8.4 m, run 19 m; Yuki 7.6 / 18).
//   R.anchor(name, v3?)         world position: head, eye, chest, handR, handL, bladeTip, bladeBase, scabbard, footL,
//                               footR, scarfTip (Sumi) | plumeTip (Yuki), mouth / ventL / ventR (Yuki breath)
//   R.blade.draw(k) / .sheathe(k)  0..1: 0-0.2 = thumb push (a sliver of steel), 0.2-1 slides out ALONG the saya arc
//                               (rigid rotation about its centre of curvature), 1 = in the right hand
//                               (Yuki: both kodachi; R.blades[i].draw(k) for one). With pose key hiltR (guard /
//                               sheathe) the right hand follows the hilt while it slides.
//   R.eyes(intensity, color?)   eye glow (Sumi slit FF3B2E, Yuki 5CF2FF); color override e.g. '#ffffff' for the omen
//   R.setLayer(layer)           0 both, ctx.LAYER.MAIN_ONLY 1 (no reflection), REFLECT_ONLY 2 (reflection only)
//   R.reflectionTwin()          second full ronin on the REFLECT_ONLY layer (same API, own root/pose/eyes); the real
//                               one is NOT changed: call R.setLayer(1) for the omen shot. twin.show(false) hides it.
//   R.cloth(t, wind)            scarf / plume (pure fn of t, drawn on twos). wind = THREE.Vector3 world m/s-ish (length
//                               ~12 = full stream). Re-evaluated automatically right before every render with the last
//                               (t, wind), so calling it is only needed to change the wind. R.scarfBurn(k) shortens
//                               Sumi's scarf (embers, s29).
//   R.show(bool), R.stride, R.dims, R.rig (joints R.rig.J), R.height (18 / 15)
// Test views (?test=1&set=LAKE&cam=..&at=..): &ronin=sumi|yuki|both &pose=name (both) &poseS= &poseY= &walk=p &run=p
//   &draw=k &sumi=x,z,yawDeg &yuki=x,z,yawDeg &eyes=i &eyecol=ffffff &wind=x,y,z &ref=1 (18 m / 15 m scale poles + 1.7 m human)
import * as THREE from 'three';
import { buildSumi, SUMI_DIMS } from './ronin/sumi.js';
import { buildYuki, YUKI_DIMS } from './ronin/yuki.js';
import { fullPose, lerpPose } from './ronin/rig.js';
import { makePoses } from './ronin/poses.js';
import { updatePistons } from './ronin/parts.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function makeRonin(ctx, kind, parent) {
  const A = ctx.A;
  const B = kind === 'sumi' ? buildSumi(A) : buildYuki(A);
  const rig = B.rig, dims = kind === 'sumi' ? SUMI_DIMS : YUKI_DIMS;
  const P = makePoses(kind, dims);
  const spec = rig.spec; spec.defaults = {};
  const base = fullPose(spec, { ...P.table.idle });
  // defaults for null hand targets come from idle
  for (const k of ['handLp', 'handRp']) if (!base[k]) base[k] = P.table.idle[k].slice();
  spec.defaults.handLp = P.table.idle.handLp; spec.defaults.handRp = P.table.idle.handRp;
  const cloths = rig.cloths;
  let cur = base;
  const R = {
    kind, root: rig.root, rig, dims, stride: P.stride, poses: P.table, height: kind === 'sumi' ? 18 : 15,
    blades: B.blades, swords: B.swords, M: B.M, wind: V(0, 0, 0), clothT: 0,
    pose(p, k) {
      let target;
      if (typeof p === 'string') { const d = P.table[p]; if (!d) { console.warn('[ronin] unknown pose', p); return R; } target = fullPose(spec, d); }
      else { target = { ...cur }; for (const [key, v] of Object.entries(p)) target[key] = Array.isArray(v) ? v.slice() : [v]; }
      cur = k === undefined ? target : lerpPose(cur, target, k);
      rig.apply(cur); updatePistons(rig);
      return R;
    },
    current: () => cur,
    walk(phase) { cur = fullPose(spec, P.walk(phase)); rig.apply(cur); updatePistons(rig); return R; },
    run(phase) { cur = fullPose(spec, P.run(phase)); rig.apply(cur); updatePistons(rig); return R; },
    anchor(name, out = V()) {
      rig.root.updateWorldMatrix(true, true);
      const a = B.anchors[name];
      if (a) return a.getWorldPosition(out);
      if (name === 'bladeTip' || name === 'bladeBase') { const s = B.sword; s.updateWorldMatrix(true, false); return out.copy(name === 'bladeTip' ? s.userData.tip : s.userData.base).applyMatrix4(s.matrixWorld); }
      if (name === 'bladeTipL' || name === 'bladeBaseL') { const s = B.swords[1]; if (!s) return out; s.updateWorldMatrix(true, false); return out.copy(name === 'bladeTipL' ? s.userData.tip : s.userData.base).applyMatrix4(s.matrixWorld); }
      if (name === 'scarfTip' || name === 'plumeTip') { R.cloth(R.clothT, R.wind); return B.cloth.tip(out); }
      return rig.root.getWorldPosition(out);
    },
    blade: {
      draw(k) { for (const b of B.blades) b.place(k); if (cur) { rig.apply(cur); updatePistons(rig); } return R; },
      sheathe(k) { return R.blade.draw(1 - k); },
    },
    eyes(i = 1, color) { for (const m of B.eyeMats) { m.uniforms.uInt.value = B.eyeBase.int * i; m.uniforms.uColor.value.set(color ?? B.eyeBase.color); m.uniforms.uEmisAmt.value = 1.5 * Math.min(1, i); } return R; },
    setLayer(layer) { rig.root.traverse((o) => o.layers.set(layer)); return R; },
    show(v) { rig.root.visible = v; return R; },
    cloth(t, wind) { if (t !== undefined) R.clothT = t; if (wind) R.wind.copy(wind); for (const c of cloths) c.update(R.clothT, R.wind); return R; },
    scarfBurn(k) { for (const c of cloths) c.burn = Math.max(0, Math.min(1, k)); return R; },
    twin: null,
    reflectionTwin() {
      if (!R.twin) { R.twin = makeRonin(ctx, kind, rig.root.parent ?? parent); R.twin.setLayer(ctx.LAYER?.REFLECT_ONLY ?? 2); R.twin.isTwin = true; }
      return R.twin;
    },
  };
  R.blade.draw(0);
  R.pose('idle');
  parent.add(rig.root);
  R.cloth(0, V(0, 0, -4));
  return R;
}

// scale reference: 18 m / 15 m poles with 1 m ticks + a 1.7 m human, flat cel
function makeRef(A) {
  const g = new THREE.Group(); g.name = 'ronin_ref';
  const mA = A.celMaterial({ base: '#e8d9b0', shade: '#a99a80', id: 70 }), mB = A.celMaterial({ base: '#4a5070', shade: '#30344a', id: 71 });
  const mH = A.celMaterial({ base: '#d27a5a', shade: '#8a4a40', id: 72 });
  for (const [x, h] of [[-4, 18], [4, 15]]) {
    for (let i = 0; i < h; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1, 0.35), i % 2 ? mA : mB); m.position.set(x, i + 0.5, -3); g.add(m); }
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.6), mH); cap.position.set(x, h, -3); g.add(cap);
  }
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.1, 4, 8), mH); body.position.set(0, 0.8, 3); g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mH); head.position.set(0, 1.58, 3); g.add(head);
  return g;
}

export async function create(ctx) {
  const holder = new THREE.Group(); holder.name = 'RONIN'; ctx.scene.add(holder);
  const sumi = makeRonin(ctx, 'sumi', holder);
  const yuki = makeRonin(ctx, 'yuki', holder);
  sumi.root.position.set(-30, 0, 0); sumi.root.rotation.y = Math.PI / 2;
  yuki.root.position.set(30, 0, 0); yuki.root.rotation.y = -Math.PI / 2;
  sumi.eyes(1); yuki.eyes(1);
  let ref = null;
  const api = { sumi, yuki, holder, ref(show) { if (!ref) { ref = makeRef(ctx.A); holder.add(ref); } ref.visible = !!show; } };
  ctx.api.ronin = api;
  // cloth late pass: runs right before every post.render so it follows whatever direction did to the roots this frame
  const post = ctx.post, orig = post.render.bind(post);
  post.render = (scene, cam, look) => {
    for (const R of [sumi, yuki, sumi.twin, yuki.twin]) if (R && R.root.visible) { try { updatePistons(R.rig); R.cloth(); } catch (e) { console.error('[ronin cloth]', e); } }
    return orig(scene, cam, look);
  };

  const parseV = (s) => s.split(',').map(Number);
  return {
    update(st) {
      const tq = ctx.A.onTwos(st.t);
      for (const R of [sumi, yuki]) { R.clothT = tq; }
      const q = st.q;
      if (!(st.test && q)) return;
      // ---------------------------------------------- test views
      const who = q.get('ronin') ?? 'both';
      sumi.show(who !== 'yuki'); yuki.show(who !== 'sumi');
      if (q.has('sumi')) { const [x, z, r] = parseV(q.get('sumi')); sumi.root.position.set(x, 0, z); sumi.root.rotation.y = (r || 0) * Math.PI / 180; }
      else if (who === 'sumi') { sumi.root.position.set(0, 0, 0); sumi.root.rotation.y = 0; }
      if (q.has('yuki')) { const [x, z, r] = parseV(q.get('yuki')); yuki.root.position.set(x, 0, z); yuki.root.rotation.y = (r || 0) * Math.PI / 180; }
      else if (who === 'yuki') { yuki.root.position.set(0, 0, 0); yuki.root.rotation.y = 0; }
      const k = q.has('draw') ? parseFloat(q.get('draw')) : null;
      for (const [R, key] of [[sumi, 'poseS'], [yuki, 'poseY']]) {
        const name = q.get(key) ?? q.get('pose');
        if (k !== null) R.blade.draw(k); else R.blade.draw(0);
        if (q.has('walk')) R.walk(parseFloat(q.get('walk')));
        else if (q.has('run')) R.run(parseFloat(q.get('run')));
        else R.pose(name || 'idle');
        if (q.has('eyes')) R.eyes(parseFloat(q.get('eyes')), q.has('eyecol') ? '#' + q.get('eyecol') : undefined);
        R.cloth(tq, q.has('wind') ? V(...parseV(q.get('wind'))) : V(0, 0, -6).applyQuaternion(R.root.quaternion).add(V(2, 0, 0)));
      }
      if (q.get('omen') === '1') {   // omen test: real Sumi direct-only, twin in the reflection looks back with white eyes
        sumi.setLayer(ctx.LAYER?.MAIN_ONLY ?? 1);
        const tw = sumi.reflectionTwin(); tw.show(true);
        tw.root.position.copy(sumi.root.position); tw.root.rotation.copy(sumi.root.rotation);
        tw.pose(sumi.current()); tw.pose({ neck: [0, -0.5, 0], head: [-0.15, -0.9, 0], chest: [0, -0.25, 0] });
        tw.eyes(1.6, '#ffffff'); tw.cloth(tq, V(0, 0, -6).applyQuaternion(tw.root.quaternion));
      } else if (sumi.twin) { sumi.twin.show(false); sumi.setLayer(0); }
      if (q.has('key')) ctx.A.setKey({ dir: V(...parseV(q.get('key'))) });
      if (q.get('ref') === '1') api.ref(true); else if (ref) ref.visible = false;
    },
  };
}
