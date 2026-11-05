// fx_kaleido.js - dept FX: the s31 kaleidoscope. ~26 floating mirror shards hang in a corridor in the air; each one shows
// Sumi from a different angle: the scene is rendered live (raw cel, no post) from 4 cameras orbiting Sumi into small
// textures, and every shard maps one of them (own zoom / offset / roll, some flipped) under a gold-pink glass tint, a white
// bevel, an ink edge and a glint stroke. kaleidoCam(lt, dur) is the gliding camera through the corridor.
// Used by fx.js: fx.kaleido(k, {centre, yaw}) and fx.kaleidoCam(lt, dur, {centre, yaw}).
export function makeKaleido(ctx, parent) {
  const { THREE, A } = ctx;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const rng = ctx.rng(3131);
  const NCAM = 4, RES = 640, NSH = 26;
  const rts = [...Array(NCAM)].map(() => {
    const rt = new THREE.WebGLMultipleRenderTargets(RES, RES, 2, { type: THREE.HalfFloatType });
    rt.texture[0].minFilter = rt.texture[0].magFilter = THREE.LinearFilter;
    return rt;
  });
  const cams = [...Array(NCAM)].map(() => { const c = new THREE.PerspectiveCamera(38, 1, 0.5, 9000); c.layers.mask = 1 | 2; return c; });
  // views of Sumi: [azimuth from his front (rad), elevation (rad), distance (m), fov]
  const VIEWS = [[0.3, 0.08, 46, 36], [1.2, 0.0, 44, 38], [-0.8, -0.1, 42, 40], [2.4, 0.38, 50, 34]];

  // ---- shard layout (fixed, seeded): along the corridor axis (local +x), around it at 11..36 m
  const shards = [];
  const texOrder = [0, 1, 2, 3, 1, 3, 0, 2];
  for (let i = 0; i < NSH; i++) {
    const x = -80 + 160 * (i + 0.2 + rng() * 0.6) / NSH;
    const ang = (i * 2.399 + rng() * 0.8) % (Math.PI * 2), rad = 11 + 25 * Math.pow(rng(), 0.85);
    const size = 5 + 9 * rng() + (rad > 25 ? 4 : 0);
    const nv = 5 + Math.floor(rng() * 3), pts = [];
    const a0 = rng() * 6.28;
    for (let j = 0; j < nv; j++) {
      const a = a0 + (j + (rng() - 0.5) * 0.6) / nv * Math.PI * 2, r = size * (0.5 + 0.5 * rng()) * (j % 2 ? 1 : 0.85);
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    let sz = 0; for (const p of pts) sz = Math.max(sz, Math.hypot(p[0], p[1]));
    shards.push({ x, y: Math.sin(ang) * rad * 0.7, z: Math.cos(ang) * rad, pts, sz, tex: texOrder[i % 8], zoom: (0.72 + 0.26 * rng()) * (rng() < 0.35 ? -1 : 1),
      off: [(rng() - 0.5) * 0.12, (rng() - 0.5) * 0.12], roll: (rng() - 0.5) * 0.5, seed: rng(), ph: rng() * 6.28 });
  }
  let nV = 0, nI = 0;
  for (const s of shards) { s.v0 = nV; nV += s.pts.length + 1; nI += s.pts.length * 3; }
  const pos = new Float32Array(nV * 3), aK = new Float32Array(nV * 4), aE = new Float32Array(nV * 4), idx = [];
  for (const s of shards) {
    const m = s.pts.length;
    s.pts.forEach((p, k) => {
      const o = (s.v0 + k) * 4;
      aK.set([s.tex, s.seed, p[0] / s.sz, p[1] / s.sz], o); aE.set([0, s.zoom, s.off[0], s.off[1]], o);
      idx.push(s.v0 + m, s.v0 + k, s.v0 + (k + 1) % m);
    });
    const o = (s.v0 + m) * 4; aK.set([s.tex, s.seed, 0, 0], o); aE.set([1, s.zoom, s.off[0], s.off[1]], o);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aK', new THREE.BufferAttribute(aK, 4)); geo.setAttribute('aE', new THREE.BufferAttribute(aE, 4));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, side: THREE.DoubleSide,
    uniforms: { ...A.AU, uT0: { value: rts[0].texture[0] }, uT1: { value: rts[1].texture[0] }, uT2: { value: rts[2].texture[0] }, uT3: { value: rts[3].texture[0] },
      uInk: { value: new THREE.Color('#2a2148') }, uK: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec4 aK; attribute vec4 aE;
      varying vec3 vW, vNW, vNV, vLocal, vColor, vNL; varying float vDepth; varying vec2 vUv;
      varying vec4 vK, vE;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vLocal = position; vNL = vec3(0.0, 0.0, 1.0); vNW = vNL;
        vNV = vec3(0.0, 0.0, 1.0); vColor = vec3(1.0); vUv = aK.zw; vK = aK; vE = aE;
        vec4 mv = viewMatrix * wp; vDepth = -mv.z; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${A.GLSL.NOISE}
      ${A.GLSL.GLOBAL_PARS}
      uniform sampler2D uT0, uT1, uT2, uT3; uniform vec3 uInk; uniform float uK;
      varying vec4 vK, vE;
      void main(){
        float sd = vK.y;
        vec2 q = vK.zw * 0.5 * abs(vE.y); if(vE.y < 0.0) q.x = -q.x;
        vec2 uv = clamp(q + 0.5 + vE.zw, 0.002, 0.998);
        int ti = int(vK.x + 0.5);
        vec3 img = ti == 0 ? texture(uT0, uv).rgb : ti == 1 ? texture(uT1, uv).rgb : ti == 2 ? texture(uT2, uv).rgb : texture(uT3, uv).rgb;
        vec3 tint = mix(vec3(1.06, 0.95, 0.86), vec3(0.98, 0.9, 1.07), fract(sd * 7.3));
        vec3 c = img * tint;
        float sheen = smoothstep(0.1, 1.0, (vK.z - vK.w) * 0.5 + 0.5);                  // a faint sky sheen across the glass
        c = mix(c, vec3(1.0, 0.86, 0.74), sheen * 0.16);
        float dpx = vE.x / max(fwidth(vE.x), 1e-5);
        float ink = 1.0 - smoothstep(0.7, 1.7, dpx);
        float bevel = (1.0 - smoothstep(2.2, 4.8, dpx)) * (1.0 - ink);
        c = mix(c, vec3(1.0, 0.96, 0.9), bevel * 0.85);
        float g = (vK.z + vK.w) * 0.7071 - (fract(sd * 3.1) - 0.5) * 0.9, fw = fwidth(g);
        float gl = (1.0 - smoothstep(0.018 - fw, 0.018 + fw, abs(g))) * step(abs((vK.z - vK.w) * 0.7071 - 0.1), 0.32) * step(0.3, fract(sd * 5.7));
        float gl2 = (1.0 - smoothstep(0.008 - fw, 0.008 + fw, abs(g - 0.07))) * step(abs((vK.z - vK.w) * 0.7071 - 0.1), 0.2) * step(0.6, fract(sd * 9.1));
        gl = max(gl, gl2);
        c = mix(c, vec3(1.0), gl * 0.9);
        c = mix(c, uInk, ink);
        writeOut(c, bevel * 0.5 + gl * 0.7, vec3(0.0, 0.0, 1.0), vDepth, 96.0);
      }`,
  });
  mat.name = 'fx_kaleido';
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.visible = false; mesh.name = 'fx_kaleido'; parent.add(mesh);

  const frameOf = (o = {}) => {
    const c = o.centre ? (o.centre.isVector3 ? o.centre.clone() : V3(...o.centre)) : V3(0, 64, 150), yaw = o.yaw ?? 0;
    const X = V3(Math.cos(yaw), 0, -Math.sin(yaw)), Z = V3(Math.sin(yaw), 0, Math.cos(yaw));
    return { c, X, Y: V3(0, 1, 0), Z };
  };
  // camera glide through the corridor, lt 0..dur
  function cam(lt, dur, o = {}) {
    const F = frameOf(o), k = Math.max(0, Math.min(1, lt / dur)), e = k * k * (3 - 2 * k) * 0.35 + k * 0.65;
    const x = -66 + 118 * e, sway = Math.sin(lt * 1.3) * 2.5;
    const pos = F.c.clone().addScaledVector(F.X, x).addScaledVector(F.Y, 2 + Math.sin(lt * 0.9) * 1.5).addScaledVector(F.Z, sway);
    const look = F.c.clone().addScaledVector(F.X, x + 40).addScaledVector(F.Y, -1).addScaledVector(F.Z, -3 + 6 * k);
    return { pos, look, fov: 44, roll: Math.sin(lt * 0.8) * 4 };
  }
  // per frame: place the shards (drifting, on twos) and render the 4 views of Sumi
  const tmp = V3(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
  function frame(t, k, o, renderer, scene) {
    const F = frameOf(o), t2 = A.onTwos(t);
    for (const s of shards) {
      const ctr = F.c.clone().addScaledVector(F.X, s.x).addScaledVector(F.Y, s.y + Math.sin(t2 * 0.5 + s.ph) * 1.6).addScaledVector(F.Z, s.z);
      // face the corridor axis, turned toward the incoming camera, slow wobble
      const axisP = F.c.clone().addScaledVector(F.X, s.x - 18);
      const nrm = axisP.sub(ctr).normalize();
      const up0 = V3(0, 1, 0); const rt = V3().crossVectors(up0, nrm).normalize(); const up = V3().crossVectors(nrm, rt);
      M4.makeBasis(rt, up, nrm); Q.setFromRotationMatrix(M4);
      E.set(Math.sin(t2 * 0.7 + s.ph) * 0.08, Math.sin(t2 * 0.5 + s.ph * 2) * 0.1, s.roll); Q.multiply(new THREE.Quaternion().setFromEuler(E));
      const sc = Math.min(1, k * 1.3);
      const m = s.pts.length;
      s.pts.forEach((p, j) => { tmp.set(p[0] * sc, p[1] * sc, 0).applyQuaternion(Q).add(ctr); pos.set([tmp.x, tmp.y, tmp.z], (s.v0 + j) * 3); });
      pos.set([ctr.x, ctr.y, ctr.z], (s.v0 + m) * 3);
    }
    geo.attributes.position.needsUpdate = true;
    mesh.visible = false;
    renderViews(renderer, scene);
    mesh.visible = k > 0;
  }
  function renderViews(r, scene) {
    const sumi = ctx.api.ronin?.sumi; if (!sumi?.anchor) return;
    const chest = sumi.anchor('chest', V3()).lerp(sumi.root.getWorldPosition(V3()), 0.3);   // aim at the middle of the body
    const q = sumi.root.getWorldQuaternion(new THREE.Quaternion());
    const fwd = V3(0, 0, 1).applyQuaternion(q).setY(0).normalize(), side = V3(fwd.z, 0, -fwd.x);
    const AU = A.AU, save = { rp: AU.uReflectPass.value, clip: AU.uClip.value.clone(), mir: AU.uMirror.value.x, rt: r.getRenderTarget(),
      cc: r.getClearColor(new THREE.Color()), ca: r.getClearAlpha() };
    AU.uReflectPass.value = 0; AU.uClip.value.set(0, 0); AU.uMirror.value.x = 0;
    VIEWS.forEach(([az, el, d, fov], i) => {
      const c = cams[i];
      const dir = fwd.clone().multiplyScalar(Math.cos(az)).addScaledVector(side, Math.sin(az)).multiplyScalar(Math.cos(el)).add(V3(0, Math.sin(el), 0));
      c.position.copy(chest).addScaledVector(dir, d).add(V3(0, 1, 0)); c.fov = fov; c.updateProjectionMatrix();
      c.lookAt(chest.clone().add(V3(0, 1.5, 0))); c.updateMatrixWorld();
      r.setRenderTarget(rts[i]); r.setClearColor(0x000000, 0); r.clear(true, true, false);
      r.render(scene, c);
    });
    AU.uReflectPass.value = save.rp; AU.uClip.value.copy(save.clip); AU.uMirror.value.x = save.mir;
    r.setRenderTarget(save.rt); r.setClearColor(save.cc, save.ca);
  }
  return { mesh, frame, cam, hide() { mesh.visible = false; } };
}
