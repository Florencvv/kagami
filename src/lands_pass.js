// lands_pass.js - PASS set: dawn snow ridge, human-scale stone steps, broken old gate, snow-laden pines, mossy lanterns,
// sea of clouds with far peaks, cliff edge (s10), frozen pond with an ice mirror (s09). Dept LANDS.
// Layout (m, ground at the pond = y 0): steps run down the ridge crest along -Z from z +140 (y 32) to z -20 (y 0); the
// ronin path is x = +4.5 beside them; gate at z +40; shelf z -20..-112 with the pond; cliff edge z = -112; cloud sea y -150.
import * as THREE from 'three';
import { V3, lerp, clamp, smooth, dirAE, instanced, paintedSky, cumulus, cloudMaterial, ridge } from './lands_sky.js';
import { snowMaterial } from './lands_snow.js';
import { merge, placed, roundBox, rockGeo, colorByUp, tint } from './lands_geo.js';

export const PASS_SUN = dirAE(-31, 3);                 // low dawn sun, ahead-left when looking down the steps (-Z)
const LIGHT = dirAE(-40, 12);                          // painted light cheat (higher than the sun so snow gets lit planes)
export const PASS_LAYOUT = {
  path: 4.5, gateZ: 40, gateX: 2, stepsTop: 140, stepsBottom: -20, cliffZ: -112,
  pond: V3(-16, 0, -64), pondR: 15, cloudY: -150, heroLantern: V3(-3.4, 0, -36),
};
const L = PASS_LAYOUT;
// camera spots kept free of trees (x, z, r): s05 wide on the right flank, s10 side of the cliff
export const CAM_CLEAR = [[26, 80, 16], [24, 60, 12], [60, -125, 30]];
export const crestY = (z) => (z <= -20 ? 0 : (z + 20) * 0.2);

/// ------------------------------------------------------------------ terrain height (pure, exported as api.pass.groundY)
// A RIDGE: a walkable crest (half width ~12-20 m around the steps, wider at the gate) with drop-offs on both sides
// (a steep rock band, then lower slopes that run under the sea of clouds at y -150); the shelf below the steps (pond,
// lantern, cliff) is a wider saddle with the same drops; the far end climbs to a summit and falls away behind it.
function n2(x, z) { return Math.sin(x * 0.11 + z * 0.07) * Math.sin(z * 0.13 - x * 0.05) + 0.5 * Math.sin(x * 0.31 + 1.3) * Math.sin(z * 0.27 + 2.1); }
// crest centre x and half width at z
export function crest(z) {
  const t = smooth(-6, -36, z);
  const cx = lerp(3.5 + 1.5 * Math.sin(z * 0.02), -8, t);
  const hw = lerp(13.5 + 2.5 * Math.sin(z * 0.045 + 1) + 6 * Math.exp(-(((z - 40) / 22) ** 2)), 34, t);
  return [cx, hw];
}
// the shelf ends in a ragged cliff; a promontory juts out at the leap point (x ~ path)
export const cliffEdgeZ = (x) => L.cliffZ + 5 * Math.sin(x * 0.09) + 2.5 * Math.sin(x * 0.31 + 1) - 9 * Math.exp(-(((x - 4.5) / 9) ** 2));
export function groundY(x, z) {
  const base = crestY(z) + 48 * smooth(150, 245, z);
  const [cx, hw0] = crest(z);
  const side = x > cx ? 1 : -1;
  const hw = hw0 + 2.2 * Math.sin(z * 0.13 + (side > 0 ? 1.7 : 0)) + 1.3 * Math.sin(z * 0.37 + (side > 0 ? 0.4 : 2.2));
  const d = Math.abs(x - cx), o0 = Math.max(d - hw, 0);
  // buttresses + gullies down the faces (vertical ribs, ~14-20 m apart) so the drop reads as rock, not a wall
  const rib = Math.abs(Math.sin(z * 0.19 + 1.3 * Math.sin(z * 0.047) + (side > 0 ? 0.8 : 2.1))) * 7 + Math.abs(Math.sin(z * 0.53 + 0.6)) * 2.5;
  const o = Math.max(o0 - rib * smooth(1.5, 9, o0), 0) + (o0 > 0 ? o0 * 0.04 : 0);
  let y = base - 0.0022 * d * d;
  y += Math.exp(-(((d - hw + 1.6) / 2.2) ** 2)) * (side > 0 ? 1.1 : 0.55);                 // wind lip (cornice) along the edge
  const spur = n2(x * 0.45 + 3, z * 0.45);                                                   // spurs + gullies on the faces
  y -= 118 * (1 - Math.exp(-o / 24)) * (1 + 0.3 * spur) + o * 0.55 + Math.max(0, o - 8) * 0.25 * (n2(x * 0.9, z * 0.9 + 5) + 1);
  // snow drifts + wind-carved humps on the top, flat on the steps / path, none in the pond
  const pd = Math.hypot(x - L.pond.x, (z - L.pond.z) * 1.15);
  const dr = smooth(5, 11, Math.abs(x - 2)) * smooth(hw + 3, hw - 3, d) * smooth(L.pondR, L.pondR + 7, pd);
  y += (n2(x, z) * 1.5 + n2(x * 2.3 + 7, z * 2.1) * 0.4) * dr;
  // pond bowl: a shallow rim around the ice so the ice sits at y 0 inside a snow bank
  y += smooth(L.pondR + 7, L.pondR + 1, pd) * 0.9 - smooth(L.pondR + 0.5, L.pondR - 2, pd) * 1.2;
  // cliff: the shelf ends at z ~ -112 (ragged), then a near-vertical drop into the clouds
  const edge = cliffEdgeZ(x);
  if (z < edge) {   // the cliff: stepped rock bands (6 m run: a 3 m ledge, then a ~20 m drop), ribs along x
    const dz = Math.max(edge - z - Math.abs(Math.sin(x * 0.27 + 0.4)) * 3.5 * smooth(0, 4, edge - z), 0), k = Math.floor(dz / 6), fr = dz / 6 - k;
    const hh = 18 + 5 * Math.sin(x * 0.11 + k * 1.7);
    y -= Math.min(k * hh + hh * smooth(0.45, 1, fr) + dz * 0.8, 320);
  }
  // rock bands: the faces step down in ledges (snow sits on them), uneven per place
  const fw = smooth(0.5, 6, o) + (z < edge ? smooth(0, 3, edge - z) : 0);
  if (fw > 0) { const st = 13 + 4 * Math.sin(x * 0.05 + z * 0.04), q = (y + 5 * n2(x * 0.3, z * 0.3)) / st, fl = Math.floor(q);
    y = lerp(y, (fl + smooth(0.45, 1, q - fl)) * st - 5 * n2(x * 0.3, z * 0.3), Math.min(fw, 1) * 0.85); }
  // the far end falls away behind the summit
  if (z > 250) y -= (z - 250) * 5;
  return Math.max(y, -330);
}
const slopeAt = (x, z) => Math.hypot(groundY(x + 1, z) - groundY(x - 1, z), groundY(x, z + 1) - groundY(x, z - 1)) / 2;

export function buildPass(ctx, group) {
  const { A } = ctx, rng = ctx.rng(3201);
  const api = { anchors: {}, ice: null, groundY, layout: L, sunDir: PASS_SUN.clone(), lights: {} };

  // --- sky: dawn pink -> blue
  const sky = paintedSky(A, {
    sun: PASS_SUN, sunR: 0.034, sunColor: '#fff2d6', haloColor: '#ffc8a8', halo: 0.55, sunBloom: 0.8,
    zen: '#86aef0', high: '#a9c2f2', low: '#f6b8c8', hor: '#ffd6bc', antiHor: '#eab4d0', glow: '#ffe2c4', below: '#e8c6dc',
    heights: [0.12, 0.42, 0.95, 0], glowAmt: 0.75, glowPow: 4, streak: 0.9, streakLit: '#ffe0e6', streakShade: '#c49ad0',
    strata: 0.6, strataColor: '#e48aa6',
  });
  group.add(sky);

  // --- terrain: exact grid (feet + steps); painted snow + rock shader with long cast shadows (lands_snow.js)
  const SHADOW_DIR = new THREE.Vector2(-LIGHT.x, -LIGHT.z).normalize();
  const snowM = snowMaterial(A, { light: LIGHT, shadowDir: SHADOW_DIR, shadowLen: 3.3, path: [0, L.path, L.stepsTop + 4, -116],
    pal: { snowLit: '#ffd6c8', snowHi: '#fff0e0', snowSh: '#8696e4', snowDeep: '#6270cc', shadow: '#6f7ed8',
      rockLit: '#a8808e', rockSh: '#50528e', rockDeep: '#353872' } });
  const casters = snowM.userData.casters;
  {
    const W = 440, D = 540, nx = 300, nz = 370, cx = 1.5, cz = 30;
    const g = new THREE.PlaneGeometry(W, D, nx, nz); g.rotateX(-Math.PI / 2);
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i) + cx, z = P.getZ(i) + cz; P.setXYZ(i, x, groundY(x, z), z); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, snowM); m.name = 'pass_terrain'; m.frustumCulled = false; group.add(m);
  }
  // --- stone steps (human scale): rounded slabs with snow caps on the back half, irregular
  const stoneM = A.celMaterial({ base: '#a3948f', shade: '#625875', id: 30, highlight: 0.15, rimColor: '#ffd8e0', vertexColors: true });
  const capM = A.celMaterial({ base: '#fff4f4', shade: '#aab8e6', id: 31, highlight: 0.35, hiSize: 0.95, rimColor: '#ffffff' });
  {
    const slab = roundBox(2.7, 0.34, 0.74, 0.07, 2), cap = roundBox(2.6, 0.1, 0.62, 0.05, 2);
    tint(slab, '#ffffff');
    const S = [], Cp = [];
    for (let z = L.stepsTop, i = 0; z > L.stepsBottom; z -= 0.72, i++) {
      const y = crestY(z), wob = (rng() - 0.5);
      const shade = 0.86 + rng() * 0.16;
      S.push({ pos: V3(wob * 0.12, y - 0.13 + rng() * 0.03, z), rot: [0, wob * 0.06, (rng() - 0.5) * 0.02], scl: V3(1 + (rng() - 0.5) * 0.15, 1, 1), col: new THREE.Color(shade, shade * (0.97 + rng() * 0.04), shade) });
      if (rng() < 0.95) Cp.push({ pos: V3(wob * 0.12 + (rng() - 0.5) * 0.2, y + 0.06, z + 0.04 + rng() * 0.06), rot: [0, (rng() - 0.5) * 0.1, 0], scl: V3(0.8 + rng() * 0.25, 0.7 + rng() * 0.6, 0.8 + rng() * 0.3) });
    }
    group.add(instanced(slab, stoneM, S));
    group.add(instanced(cap, capM, Cp));
    // landing slabs at the bottom (z -20..-28) and edging stones along both sides of the flight
    const E = [];
    for (let z = L.stepsTop; z > L.stepsBottom; z -= 1.6 + rng()) for (const sx of [-1.75, 1.75]) {
      if (rng() < 0.25) continue;
      E.push({ pos: V3(sx + (rng() - 0.5) * 0.2, crestY(z) - 0.05, z), rot: [rng(), rng() * 3, rng()], scl: V3(0.35 + rng() * 0.25, 0.22 + rng() * 0.15, 0.4 + rng() * 0.3), col: new THREE.Color(0.8 + rng() * 0.15, 0.8, 0.82) });
    }
    const pebble = rockGeo(rng, 1, 1, 0.4); tint(pebble, '#ffffff');
    group.add(instanced(pebble, stoneM, E));
  }

  // --- the broken old gate (weathered vermilion torii, 17 m: the ronin passes between the posts; the top beam is broken)
  {
    const woodM = A.celMaterial({ base: '#b3604c', shade: '#663a52', id: 34, highlight: 0.2, rimColor: '#ffd2c0', vertexColors: true });
    const blackM = A.celMaterial({ base: '#3e3446', shade: '#251f33', id: 35, highlight: 0.3, rimColor: '#ffc8d8' });
    const snowCapM = A.celMaterial({ base: '#fff5f5', shade: '#a9b8e8', id: 36, highlight: 0.3, rimColor: '#ffffff' });
    const G = new THREE.Group(); G.position.set(L.gateX, crestY(L.gateZ), L.gateZ); group.add(G);
    const H = 16.5, X0 = -8, X1 = 8;
    const weather = (g, seed) => colorByUp(g, '#ffffff', '#ffffff', 2, 0, seed, (c, x, y, z) => {
      const s = 0.5 + 0.5 * Math.sin(y * 3.3 + seed) * Math.sin(x * 5.1 + z * 4.7);   // faded, peeling paint streaks
      const k = smooth(0.55, 0.9, s) * 0.35 + smooth(H * 0.25, 0, y) * 0.25;
      c.setRGB(1 - k * 0.25, 1 - k * 0.45, 1 - k * 0.35);
    });
    for (const [x, lean] of [[X0, 0.012], [X1, -0.02]]) {
      const post = weather(new THREE.CylinderGeometry(0.62, 0.74, H, 20, 12), x);
      const m = new THREE.Mesh(post, woodM); m.position.set(x, H / 2, 0); m.rotation.z = lean; G.add(m);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.9, 1.3, 20), blackM); foot.position.set(x, 0.5, 0); G.add(foot);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.08, 6, 20), blackM); ring.rotation.x = Math.PI / 2; ring.position.set(x, 1.25, 0); G.add(ring);
      const stoneBase = new THREE.Mesh(roundBox(2.4, 0.6, 2.4, 0.15, 2), stoneM); stoneBase.position.set(x, -0.1, 0); G.add(stoneBase);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), snowCapM); cap.scale.set(1.15, 0.5, 1.15); cap.position.set(x, 0.0, 0); G.add(cap);
    }
    // tie beam (nuki), intact, through both posts
    const nuki = new THREE.Mesh(weather(roundBox(20.5, 0.9, 0.62, 0.12, 2), 3), woodM); nuki.position.set(0, H * 0.74, 0); G.add(nuki);
    const nukiSnow = new THREE.Mesh(roundBox(19.5, 0.22, 0.66, 0.1, 2), snowCapM); nukiSnow.position.set(-0.2, H * 0.74 + 0.5, 0); G.add(nukiSnow);
    // gakuzuka strut (centre) snapped: only a stub stays on the nuki
    const strut = new THREE.Mesh(roundBox(0.9, 1.2, 0.5, 0.1, 2), woodM); strut.position.set(0, H * 0.74 + 1.05, 0); strut.rotation.z = 0.12; G.add(strut);
    // top beam (kasagi + shimaki): left half still up, curved and upswept; right half fallen against the right post
    const beam = (len, up) => { const g = roundBox(len, 1.0, 1.0, 0.16, 3); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (len / 2); p.setY(i, p.getY(i) + Math.pow(Math.abs(x), 2.4) * up * (x < 0 ? 1 : 0.15)); }
      g.computeVertexNormals(); return g; };
    const kL = new THREE.Mesh(beam(12.5, 1.1), blackM); kL.position.set(-4.6, H + 0.4, 0); G.add(kL);
    const sL = new THREE.Mesh(weather(roundBox(11, 0.7, 0.8, 0.12, 2), 5), woodM); sL.position.set(-4.0, H - 0.5, 0); G.add(sL);
    const kLs = new THREE.Mesh(roundBox(11.5, 0.3, 1.05, 0.12, 2), snowCapM); kLs.position.set(-4.4, H + 1.0, 0); G.add(kLs);
    // splintered end at x ~ +1.6
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.16 + rng() * 0.1, 0.9 + rng() * 0.9, 4), i % 2 ? blackM : woodM);
      s.position.set(1.9 + rng() * 0.3, H - 0.4 + rng() * 1.3, (rng() - 0.5) * 0.7); s.rotation.z = -Math.PI / 2 + (rng() - 0.5) * 0.7; G.add(s); }
    // fallen right half: one end on the ground outside the right post, the other propped on the nuki stub
    const fallen = new THREE.Group(); G.add(fallen);
    const kR = new THREE.Mesh(beam(10.5, 0.9), blackM); fallen.add(kR);
    const sR = new THREE.Mesh(weather(roundBox(9.4, 0.7, 0.8, 0.12, 2), 7), woodM); sR.position.set(0.5, -0.85, 0); fallen.add(sR);
    const kRs = new THREE.Mesh(roundBox(8.5, 0.28, 1.0, 0.12, 2), snowCapM); kRs.position.set(0.4, 0.62, 0); fallen.add(kRs);
    fallen.position.set(13.2, 4.6, 1.6); fallen.rotation.set(0.05, -0.35, -0.62); // leans from the ground up onto the right post's outer side
    // debris + snow mound where it lands
    const mound = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), snowCapM); mound.scale.set(1.4, 0.45, 1); mound.position.set(17.3, -0.2, 3.2); G.add(mound);
    api.anchors.gate = G.position.clone();
    api.anchors.gateWidth = X1 - X0;
  }

  // --- stone lanterns (3.2 m), mossy, snow caps on roof and platform
  const lanternStoneM = A.celMaterial({ base: '#ffffff', shade: '#9b98c4', id: 38, highlight: 0.18, rimColor: '#ffe2e8', vertexColors: true });
  const lanternSnowM = A.celMaterial({ base: '#fff6f6', shade: '#a8b6e8', id: 39, highlight: 0.4, hiSize: 0.95, rimColor: '#ffffff' });
  const lanternWinM = A.celMaterial({ base: '#2e2a44', flat: true, id: 37 });
  function lanternGeo(seed) {
    const r = ctx.rng(seed);
    const parts = [];
    const hex = (rt, rb, h, y) => placed(new THREE.CylinderGeometry(rt, rb, h, 6, 2), [0, y, 0], [0, Math.PI / 6, 0]);
    parts.push(hex(0.62, 0.7, 0.28, 0.14), hex(0.5, 0.6, 0.18, 0.37));                 // base (kiso)
    parts.push(placed(new THREE.CylinderGeometry(0.19, 0.23, 1.15, 14, 4), [0, 1.03, 0])); // pole (sao)
    parts.push(placed(new THREE.TorusGeometry(0.22, 0.05, 6, 14), [0, 1.0, 0], [Math.PI / 2, 0, 0]));
    parts.push(hex(0.56, 0.3, 0.26, 1.72));                                            // platform (chudai)
    parts.push(hex(0.4, 0.4, 0.6, 2.15));                                              // firebox (hibukuro)
    const roof = new THREE.CylinderGeometry(0.16, 0.92, 0.42, 6, 3);                   // roof (kasa) with upturned corners
    { const p = roof.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i), z = p.getZ(i), rr = Math.hypot(x, z);
      const ang = Math.atan2(z, x), corner = Math.pow(Math.abs(Math.cos(3 * ang)), 8);
      if (y < -0.1) p.setY(i, y + corner * 0.12 * (rr / 0.9)); else p.setY(i, y - (rr - 0.16) * 0.25); } roof.computeVertexNormals(); }
    parts.push(placed(roof, [0, 2.66, 0], [0, Math.PI / 6, 0]));
    parts.push(placed(new THREE.SphereGeometry(0.17, 12, 8), [0, 3.02, 0], [0, 0, 0], [1, 1.2, 1]));   // jewel (hoju)
    parts.push(placed(new THREE.ConeGeometry(0.08, 0.16, 10), [0, 3.25, 0]));
    const g = merge(parts);
    // weathered stone + moss on top-facing planes, lichen dots
    return colorByUp(g, '#c9c2d2', '#a3ae8c', 0.45, 0.35, seed, (c, x, y, z, ny) => {
      const s = Math.sin(x * 13 + seed) * Math.sin(y * 11) * Math.sin(z * 12 + seed);
      if (ny <= 0.45 && s > 0.6) c.set('#a8b292');                     // moss streaks running down the sides
      else if (ny <= 0.45 && s < -0.7) c.set('#a29db0');
      if (y < 0.5 && ny < 0.45 && s > 0.1) c.set('#9aa680');            // mossy foot
    });
  }
  const LG = [lanternGeo(11), lanternGeo(12), lanternGeo(13)];
  function addLantern(pos, rotY, k, snowAmt = 1) {
    const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = rotY; group.add(g);
    g.add(new THREE.Mesh(LG[k % 3], lanternStoneM));
    for (let a = 0; a < 3; a++) {                                                     // firebox windows (front/back/side)
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.32), lanternWinM); const ang = a * Math.PI / 3 * 2 + Math.PI / 2;
      w.position.set(Math.cos(ang) * 0.35, 2.17, Math.sin(ang) * 0.35); w.lookAt(Math.cos(ang) * 2, 2.17, Math.sin(ang) * 2); g.add(w);
    }
    // snow cap on the roof: thick, rounded, overhanging slightly, an irregular drip edge
    const cap = new THREE.SphereGeometry(0.9, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    { const p = cap.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      p.setXYZ(i, x * (1 + 0.06 * Math.sin(z * 9 + k)), y * 0.42 * snowAmt + 0.02, z * (1 + 0.06 * Math.sin(x * 8 + k))); } cap.computeVertexNormals(); }
    const cm = new THREE.Mesh(cap, lanternSnowM); cm.position.y = 2.78; g.add(cm);
    const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), lanternSnowM); c2.scale.set(1, 0.32, 1); c2.position.y = 1.84; g.add(c2);
    const c3 = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), lanternSnowM); c3.scale.set(1.05, 0.28, 1.05); c3.position.y = 0.42; g.add(c3);
    g.userData.snowCap = cm;
    return g;
  }
  const LANTERNS = [];
  for (let z = 128, i = 0; z > -14; z -= 22 + rng() * 6, i++) {
    LANTERNS.push(addLantern(V3(-3.1, crestY(z), z), rng() * 0.3, i));
    if (i % 2 === 0) LANTERNS.push(addLantern(V3(11.5 + rng() * 2, groundY(12, z - 6), z - 6), rng(), i + 1));
  }
  // hero lantern (s04 macro) on the shelf where the steps end, plus two by the pond
  const hero = addLantern(L.heroLantern.clone(), 0.25, 1, 1.25); LANTERNS.push(hero);
  LANTERNS.push(addLantern(V3(L.pond.x + 13, groundY(L.pond.x + 13, L.pond.z + 12), L.pond.z + 12), 0.6, 2));
  LANTERNS.push(addLantern(V3(L.pond.x - 15, groundY(L.pond.x - 15, L.pond.z - 7), L.pond.z - 7), 1.1, 0));
  api.anchors.lantern = L.heroLantern.clone().add(V3(0, 2.95, 0));     // top of the hero lantern's snow cap
  api.lanternSnow = hero.userData.snowCap;                              // FX may scale/hide it when Yuki brushes it off
  api.lanterns = LANTERNS;

  // --- rock outcrops: cel, snow caps on top-facing planes; jagged teeth along both crest lips, crags on the drop faces,
  // stacked blocks under the cliff edge
  {
    const rockM = A.celMaterial({ base: '#ffffff', shade: '#8a8ed0', id: 40, highlight: 0.2, rimColor: '#ffd8d0', vertexColors: true });
    const RG = [0, 1, 2, 3].map((i) => colorByUp(rockGeo(rng, 1, 2, 1), '#a88490', '#fff1ec', 0.5, 0.25, i * 3 + 1));
    const items = [[], [], [], []];
    const free = (x, z, r) => !(Math.hypot(x - L.gateX, z - L.gateZ) < 14 + r || Math.hypot(x - 17, z - 44) < 7 + r ||
      Math.hypot(x - L.pond.x, z - L.pond.z) < L.pondR + 4 + r || (z > -24 && z < L.stepsTop + 6 && x > -6 - r && x < 8 + r) ||
      (z <= -24 && z > -118 && x > -1 - r && x < 11 + r) || Math.hypot(x - L.heroLantern.x, z - L.heroLantern.z) < 5 + r ||
      CAM_CLEAR.some(([cx, cz, rr]) => Math.hypot(x - cx, z - cz) < rr * 0.7 + r));
    const put = (x, z, s, sink = 0.35, k) => { const y = groundY(x, z); items[k ?? Math.floor(rng() * 4)].push({ pos: V3(x, y - s * sink, z),
      rot: [rng() * 0.4, rng() * 6, rng() * 0.4], scl: V3(s * (0.9 + rng() * 0.6), s * (0.7 + rng() * 0.7), s * (0.9 + rng() * 0.5)) }); };
    // teeth on the lips (both sides), clusters of 2-3
    for (let i = 0; i < 56; i++) {
      const z = lerp(-108, 235, rng()), [cx, hw] = crest(z), side = rng() < 0.5 ? -1 : 1, x = cx + side * (hw + lerp(-2, 4, rng()));
      const s = lerp(1.2, 4.2, rng() ** 1.6); if (!free(x, z, s)) continue;
      put(x, z, s, 0.3);
      if (rng() < 0.6) { const x2 = x + side * lerp(1, 3, rng()), z2 = z + (rng() - 0.5) * 5; if (free(x2, z2, s)) put(x2, z2, s * lerp(0.5, 0.8, rng()), 0.3); }
    }
    // crags on the faces below the lips (half buried, big)
    for (let i = 0; i < 60; i++) {
      const z = lerp(-110, 240, rng()), [cx, hw] = crest(z), side = rng() < 0.5 ? -1 : 1, x = cx + side * (hw + lerp(6, 70, rng() ** 1.3));
      const s = lerp(4, 10, rng()), y = groundY(x, z);
      items[Math.floor(rng() * 4)].push({ pos: V3(x, y - s * 0.5, z), rot: [rng() * 0.3, rng() * 6, rng() * 0.3], scl: V3(s * 0.8, s * 1.5, s * 0.8) });
    }
    // cliff face: stacked big rocks along the edge, dropping down
    // the cliff lip at the leap point: a jutting snow-capped outcrop
    const tip = cliffEdgeZ(L.path);
    items[0].push({ pos: V3(L.path, -2.6, tip + 1.5), rot: [0.1, 0.4, 0.05], scl: V3(9, 3.2, 6) });
    items[1].push({ pos: V3(L.path - 7, -2.5, tip + 3), rot: [0.2, 1.4, 0.1], scl: V3(5, 3, 4) });
    RG.forEach((g, i) => group.add(instanced(g, rockM, items[i])));
    api.anchors.cliffEdge = V3(L.path, groundY(L.path, cliffEdgeZ(L.path) + 1.5), cliffEdgeZ(L.path) + 1.5);
    api.anchors.leapDir = V3(0, 0, -1);
  }

  // --- snow-laden pines: cel trunks + tiers of pine-needle cards; the clump-lit top of each tier maps to snow.
  // On the crest edges + the shelf (they cast the long dawn shadows) and lower down the faces where they ease off,
  // half sunk in the sea of clouds (depth: the drop reads by the pines below).
  {
    const atlas = A.foliageAtlas({ seed: 321, cells: 4, kind: 'pine' });
    const pineM = A.cardMaterial({ map: atlas, cells: 4, ramp: ['#16263a', '#2c4a52', '#b6c4e6', '#fff1f2'], alt: '#d8c8ff', altAmt: 0.25, ink: '#1c1830', texW: 0.5, bias: 0.04, sway: 0.01, id: A.ID.FOLIAGE });
    const trunkM = A.celMaterial({ base: '#7a5a62', shade: '#3e3250', id: 42, highlight: 0.1, map: A.barkTexture({ seed: 4 }), rimColor: '#ffd8d8' });
    const cardItems = [], trunks = [];
    const sun = LIGHT.clone();
    const trees = [];
    const ok = (x, z, gap) => {
      if (Math.hypot(x - L.gateX, z - L.gateZ) < 22) return false;
      if (CAM_CLEAR.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r)) return false;
      if (Math.hypot(x - L.pond.x, z - L.pond.z) < L.pondR + 10) return false;
      if (z < -20 && x > -4 && x < 16) return false;                               // keep the shelf path + cliff run clear
      if (z >= -20 && x > -7 && x < 9) return false;                                // steps, lanterns and the ronin path
      if (Math.abs(x - 12.5) < 4 && z > -20) return false;                          // right lantern row
      if (z < cliffEdgeZ(x) + 4) return false;
      return !trees.some((t) => Math.hypot(t.x - x, t.z - z) < gap);
    };
    // crest / shelf trees
    for (let i = 0; i < 900 && trees.length < 34; i++) {
      const z = lerp(-104, 230, rng()), [cx, hw] = crest(z), side = rng() < 0.5 ? -1 : 1, x = cx + side * lerp(hw * 0.35, hw + 3, rng());
      if (!ok(x, z, 10) || slopeAt(x, z) > 0.7 || (z < -20 && rng() < 0.6)) continue;
      trees.push({ x, z, h: lerp(13, 26, rng()), cast: true });
    }
    // lower trees on the eased slopes, near the clouds
    for (let i = 0; i < 900 && trees.length < 74; i++) {
      const z = lerp(-100, 240, rng()), [cx, hw] = crest(z), side = rng() < 0.5 ? -1 : 1, x = cx + side * (hw + lerp(50, 120, rng()));
      if (!ok(x, z, 9)) continue;
      const y = groundY(x, z); if (y > -70 || y < -150 || slopeAt(x, z) > 1.3) continue;
      trees.push({ x, z, h: lerp(18, 32, rng()), cast: false });
    }
    for (const t of trees) {
      const y0 = groundY(t.x, t.z) - 0.4, h = t.h, lean = (rng() - 0.5) * 0.06;
      trunks.push({ pos: V3(t.x, y0 + h * 0.45, t.z), rot: [lean, rng() * 6, lean], scl: V3(h * 0.022, h * 0.9, h * 0.022) });
      const tiers = 6 + Math.floor(h / 4.5), clumps = [];
      let R0 = 0;
      for (let k = 0; k < tiers; k++) {
        const f = k / (tiers - 1), cy = y0 + h * lerp(0.22, 0.97, f), R = h * lerp(0.26, 0.06, f) * (0.85 + rng() * 0.3);
        if (k === 0) R0 = R;
        const off = V3((rng() - 0.5) * R * 0.3, 0, (rng() - 0.5) * R * 0.3);
        clumps.push({ c: V3(t.x, cy, t.z).add(off), r: V3(R, R * 0.36, R), n: Math.round(10 + R * 3.2), light: 0.02 });
      }
      cardItems.push(...A.foliageItems(rng, clumps, { sun, size: 0.95 }));
      if (t.cast) casters.add(t.x, t.z, h, R0 * 1.05);
    }
    const trunkGeo = new THREE.CylinderGeometry(0.7, 1, 1, 9, 3);
    group.add(instanced(trunkGeo, trunkM, trunks));
    group.add(A.cardInstances(pineM, cardItems, { base: false }));
    api.trees = trees;
  }
  // lanterns cast small shadows too; the gate casts posts + the tie beam + the broken top beam (it reads in the shadow)
  for (const lt of LANTERNS) casters.add(lt.position.x, lt.position.z, 3.3, 0.9);
  {
    const gx = L.gateX, gz = L.gateZ, H = 16.5, k = 3.3;
    const sh = (x, h) => [gx + x + SHADOW_DIR.x * h * k, gz + SHADOW_DIR.y * h * k];
    for (const px of [-8, 8]) { const [bx, bz] = sh(px, H); casters.seg(gx + px, gz, bx, bz, 0.75); }
    { const [ax, az] = sh(-10.2, H * 0.74), [bx, bz] = sh(10.2, H * 0.74); casters.seg(ax, az, bx, bz, 0.55); }
    { const [ax, az] = sh(-10.8, H + 0.6), [bx, bz] = sh(1.7, H + 0.4); casters.seg(ax, az, bx, bz, 0.8); }
  }
  // --- sea of clouds, well BELOW the ridge (crest 0..80 m, sea tops -90..-150): a displaced painted sheet to the horizon,
  // billows hugging the lower faces, far peaks poking through. Cooler + darker than the lit snow so the drop reads.
  {
    const SEA_PAL = { deep: '#484c9e', shade: '#6e74c4', mid: '#9e98d4', lit: '#dcb0ca', hot: '#ffd4cc', rim: '#ffeadc' };
    const seaLight = dirAE(-31, 9);
    const sheetM = cloudMaterial(A, { c0: V3(0, L.cloudY - 30, 0), h: 120, light: seaLight, sunW: PASS_SUN, pal: SEA_PAL, massAmt: 0, edge: 3, back: 0.6, rim: 0.6, emis: 0.3,
      steps: [-0.75, -0.3, 0.22, 0.6] });
    const g = new THREE.PlaneGeometry(10000, 10000, 260, 260); g.rotateX(-Math.PI / 2);
    const P = g.attributes.position, rr = ridge(ctx.rng(77), 4);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), z = P.getZ(i), r = Math.hypot(x, z);
      const bill = rr(x * 0.004 + 50) * rr(z * 0.004 + 9);
      const roll = 0.5 + 0.5 * Math.sin(z * 0.006 + rr(x * 0.002) * 4);          // long rolling lines
      P.setY(i, L.cloudY + (bill * 50 + roll * 16) * smooth(5000, 1200, r) - smooth(2500, 5000, r) * 40);
    }
    g.computeVertexNormals();
    const sea = new THREE.Mesh(g, sheetM); sea.frustumCulled = false; group.add(sea);
    // billows near the ridge (lower faces)
    const billM = cloudMaterial(A, { c0: V3(0, L.cloudY - 10, 0), h: 90, light: dirAE(-31, 48), sunW: PASS_SUN, pal: SEA_PAL, massAmt: 0, edge: 0.86, back: 0.6, emis: 0.3,
      steps: [-0.45, -0.1, 0.22, 0.55] });
    const P2 = [], r2 = ctx.rng(78);
    for (let i = 0; i < 110; i++) {                                              // clusters: a big dome + smaller side puffs
      const a = r2() * Math.PI * 2, d = lerp(110, 1000, r2() ** 1.3);
      const x = 1.5 + Math.cos(a) * d * 1.2, z = 40 + Math.sin(a) * d * 1.3;
      const s = lerp(18, 50, r2()) * (0.6 + d / 900), y = L.cloudY + 4 + r2() * 14;
      P2.push({ pos: V3(x, y, z), scl: V3(s * 1.4, s * 0.7, s * 1.1), rot: [0, r2() * 3, 0], col: new THREE.Color(1, 1, 1) });
      for (let k = 0; k < 3; k++) { const b = r2() * Math.PI * 2, rr = s * lerp(0.9, 1.6, r2()), ss = s * lerp(0.4, 0.7, r2());
        P2.push({ pos: V3(x + Math.cos(b) * rr, y - ss * 0.2, z + Math.sin(b) * rr), scl: V3(ss * 1.3, ss * 0.7, ss), rot: [0, r2() * 3, 0], col: new THREE.Color(1, 1, 1) }); }
    }
    group.add(instanced(new THREE.IcosahedronGeometry(1, 3), billM, P2));
    // far peaks: displaced cones, snow lit pink, blue shadow sides, a darker rock streak per ridge
    const peakM = A.paintedMaterial({ color: '#ffe4ec', color2: '#f6d4e4', shade: '#8f9ed6', id: A.ID.PAINT, bands: true, varScale: 0.006, varAmt: 0.5,
      dab: 0.3, stroke: 0.9, strokeScale: 0.008, rim: 0.7, rimColor: '#fff2ea', rimWidth: 0.18, vertexColors: true });
    peakM.uniforms.uSunDir = { value: dirAE(-55, 14) };
    // massifs: ridged-noise heightfields (jagged arêtes, several summits), rock on steep faces, snow elsewhere
    const PK = [[-70, 3600, 2600, 1350], [-45, 4300, 2400, 1150], [-12, 3900, 3200, 1750], [14, 4500, 2200, 1200], [38, 3400, 2600, 1250],
      [64, 4200, 2800, 1500], [110, 3700, 2600, 1100], [160, 4000, 2800, 1350], [-125, 3900, 2600, 1150], [-170, 3600, 2400, 1050],
      [88, 2700, 1400, 620], [-98, 2800, 1300, 560], [-30, 2600, 1100, 420]];
    const pr = ctx.rng(79);
    const hsh = (i, j, sd) => { const v = Math.sin(i * 127.1 + j * 311.7 + sd * 74.7) * 43758.5453; return v - Math.floor(v); };
    const vn = (x, z, sd) => { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
      return lerp(lerp(hsh(i, j, sd), hsh(i + 1, j, sd), ux), lerp(hsh(i, j + 1, sd), hsh(i + 1, j + 1, sd), ux), uz); };
    const ridged = (x, z, sd) => { let s = 0, a = 0.55, f = 1; for (let k = 0; k < 5; k++) { const n = 1 - Math.abs(vn(x * f, z * f, sd + k) * 2 - 1); s += a * n * n; a *= 0.5; f *= 2.05; } return s; };
    for (const [az, dist, size, hgt] of PK) {
      const sd = pr() * 100, el = 0.6 + pr() * 0.8, rot = pr() * Math.PI;
      const g = new THREE.PlaneGeometry(size, size, 150, 150); g.rotateX(-Math.PI / 2);
      const P = g.attributes.position, ca = Math.cos(rot), sa = Math.sin(rot);
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i), z = P.getZ(i);
        const u = (x * ca - z * sa) / (size / 2), v = (x * sa + z * ca) / (size / 2) * el;
        const r = Math.hypot(u, v), env = Math.pow(Math.max(0, 1 - r), 1.15);
        const n = ridged(x / size * 3.2, z / size * 3.2, sd);
        P.setY(i, hgt * env * (0.3 + 0.95 * n) * (0.85 + 0.15 * env));
      }
      g.computeVertexNormals();
      const N = g.attributes.normal, C = new Float32Array(P.count * 3);
      for (let i = 0; i < P.count; i++) {
        const ny = N.getY(i), y = P.getY(i), x = P.getX(i), z = P.getZ(i);
        const streak = vn(x * 0.03, z * 0.03 + y * 0.004, sd + 9);
        const rock = ny < 0.62 + (streak - 0.5) * 0.3 && y > hgt * 0.08;
        const c = rock ? (ny < 0.45 ? [0.5, 0.48, 0.62] : [0.7, 0.67, 0.8]) : [1, 1, 1];
        C[i * 3] = c[0]; C[i * 3 + 1] = c[1]; C[i * 3 + 2] = c[2];
      }
      g.setAttribute('color', new THREE.BufferAttribute(C, 3));
      const m = new THREE.Mesh(g, peakM); const d = dirAE(az, 0);
      m.position.set(d.x * dist, L.cloudY - 120, d.z * dist); m.frustumCulled = false; group.add(m);
    }
    // a few towering dawn cumulus far beyond the peaks, pink lit
    for (const [az, dist, w, h] of [[-100, 3800, 700, 900], [70, 4200, 800, 1000], [150, 4000, 700, 800], [-160, 4200, 800, 1100]]) {
      const c0 = dirAE(az, 0).multiplyScalar(dist).setY(L.cloudY + 60);
      group.add(cumulus(A, ctx.rng(az + 900), { c0, w, h, n: 70, light: dirAE(-32, 35), sunW: PASS_SUN, back: 0.5,
        pal: { deep: '#7a80c6', shade: '#a2ace0', mid: '#e6c2de', lit: '#ffe2e2', hot: '#fff2e0', rim: '#fffaf0' } }));
    }
  }

  // --- frozen pond: ice disc (mirror if the engine provides it), frost, old cracks, snow bank; crack(k) = the omen eye
  api.ice = buildIce(ctx, group, L.pond, L.pondR);
  api.anchors.pond = L.pond.clone();
  api.anchors.pondR = L.pondR;
  api.anchors.stepsTop = V3(0, crestY(L.stepsTop), L.stepsTop);
  api.anchors.stepsBottom = V3(0, 0, L.stepsBottom);
  api.anchors.path = (z) => V3(L.path, groundY(L.path, z), z);
  return api;
}

// ------------------------------------------------------------------ ice: painted mirror with frost + an eye-shaped crack
import { mirrorWater } from './lands_lake.js';
function buildIce(ctx, group, c, R) {
  const { A } = ctx;
  const g = new THREE.CircleGeometry(R + 0.6, 96); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
    const k = 1 + 0.06 * Math.sin(a * 3 + 1) + 0.04 * Math.sin(a * 7 + 2); p.setXYZ(i, x * k, 0, z * k / 1.15); }
  const mat = mirrorWater(ctx, { kind: 'ice', centre: c, radius: R });
  const m = new THREE.Mesh(g, mat); m.position.set(c.x, 0.0, c.z); m.renderOrder = 1; group.add(m);
  return mat.userData.api;
}
