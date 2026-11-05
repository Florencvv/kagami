// look.js - KAGAMI colour script: one preset per set (LOOKS from direction merge on top, see shots.js).
// A preset = AnimePost look keys (fog, grade, mirror, glows ...) plus light keys that main.js writes into the shared
// uniforms every frame (applyLights):
//   sky: skyDome options {stops: [[sinElev, colour] x4], disk: {dir, radius, color, halo, haloColor, bloom}, stars, brush}
//        main builds ctx.skies[SET] from it and re-applies look.sky each frame (a dept with its own sky: add a mesh named
//        'anime_sky' to the set group and main drops the preset sky; ctx.skies[SET] then points at yours)
//   sun: {dir, color} painted world light   ambient: colour   key: {dir | pos, color, tint} character key (cheat it)
//   shade: {tint, mix} cel shade tint       rim: {dir, amt}   wind: [amplitude, speed] painted cards
import * as THREE from 'three';
import { AU, setKey } from './anime/post.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v) && !v.isVector3 && !v.isColor && !v.isVector2;
// mergeLook(a, b): b over a; plain-object keys (mirror, sky, key, sun, speed ...) merge one level deep
export function mergeLook(a = {}, b = {}) {
  const o = { ...a };
  for (const [k, v] of Object.entries(b ?? {})) o[k] = isPlain(v) && isPlain(a[k]) ? { ...a[k], ...v } : v;
  return o;
}

const SUNSET_SKY = { stops: [[-0.02, '#ffd49a'], [0.07, '#f59c86'], [0.26, '#7c6cb4'], [0.75, '#2a3c8c']],
  disk: { dir: [0, 0.055, -1], radius: 0.075, color: '#fff0c0', halo: 0.55, haloColor: '#ffd08a', bloom: 0.9 }, brush: 1 };

export const LOOK_PRESETS = {
  // sunset salt-flat mirror: golden low sun, deep blue zenith, warm haze; the mirror slightly darker + cooler than the sky
  LAKE: {
    sky: SUNSET_SKY,
    sun: { dir: [0, 0.12, -1], color: '#ffd8a8' }, ambient: '#8a7cc0',
    key: { dir: [0.35, 0.45, -0.8], color: '#ffe0b0', tint: 0.18 }, shade: { tint: '#c8b8ff', mix: 0.3 }, rim: { dir: [0, 0.25, -1], amt: 1 },
    // LANDS look (dept LANDS owns LAKE / PASS / SKY): light fog = horizon colour so the far mirror melts into the sky
    fog: '#f4a07e', fogDensity: 0.00022, fogNear: 60, fogMax: 0.3, celFog: 0.25, paintRadius: 6, paintFar: 2500, paintFarScale: 1.6,
    mirror: { on: true, y: 0, strength: 1, distort: 0, rough: 0, ripples: [], ringColor: '#fff2dc' },
    bloom: 0.6, exposure: 1.0, sat: 1.16, contrast: 0.2, lift: '#0e0a2c', gain: '#fff8f0', vignette: 0.16, grain: 0.03, paper: 0.035,
  },
  // night rain neon canyon: deep blue-violet (never black), pink / cyan neon glows, wet street = broken mirror
  CITY: {
    sky: { stops: [[-0.05, '#4a3a86'], [0.1, '#2e2a6e'], [0.35, '#1f2258'], [0.8, '#171a44']], stars: 0, brush: 1 },
    sun: { dir: [0.2, 0.8, 0.3], color: '#8f8cd8' }, ambient: '#3c3a7a',
    key: { dir: [-0.5, 0.4, 0.7], color: '#ff9ccf', tint: 0.25 }, shade: { tint: '#7a8cff', mix: 0.45 }, rim: { dir: [0.6, 0.3, -0.7], amt: 1 },
    fog: '#4a3f86', fogDensity: 0.006, fogNear: 10, fogMax: 0.7, celFog: 0.3,
    mirror: { on: true, y: 0, strength: 0.5, distort: 0.6, rough: 0.35, ripples: [] },
    bloom: 1.25, exposure: 1.05, sat: 1.1, contrast: 0.14, lift: '#1c1440', gain: '#f4f0ff', vignette: 0.2,
  },
  // dawn snow pass: pink F6B8C8 -> blue 8AB4F0, low soft sun, cool lavender shade, frozen pond = rough mirror
  PASS: {
    sky: { stops: [[-0.04, '#ffe0d2'], [0.05, '#f6b8c8'], [0.3, '#b4b8ea'], [0.8, '#8ab4f0']],
      disk: { dir: [-0.6, 0.05, -1], radius: 0.05, color: '#fff4e4', halo: 0.4, haloColor: '#ffd0c8', bloom: 0.6 }, brush: 1 },
    sun: { dir: [-0.6, 0.18, -1], color: '#ffe6dc' }, ambient: '#a8a8e0',
    key: { dir: [-0.5, 0.5, 0.7], color: '#fff0ea', tint: 0.12 }, shade: { tint: '#c4c8ff', mix: 0.35 }, rim: { dir: [-0.6, 0.2, -0.8], amt: 1 },
    fog: '#e2c8e4', fogDensity: 0.00035, fogNear: 40, fogMax: 0.4, celFog: 0.3, paintRadius: 6, paintFar: 1500, paintFarScale: 1.7,
    mirror: { on: true, y: 0, strength: 0.85, distort: 0, rough: 0.5, ripples: [], ringColor: '#ffffff' },
    bloom: 0.5, exposure: 1.02, sat: 1.18, contrast: 0.18, lift: '#2a2458', gain: '#fffaf6', vignette: 0.14, grain: 0.03, paper: 0.035,
  },
  // the LAKE sky without ground (leap, X-cut): sun a little higher in frame, no mirror
  SKY: {
    sky: { ...SUNSET_SKY, disk: { ...SUNSET_SKY.disk, dir: [0, 0.16, -1] } },
    sun: { dir: [0, 0.2, -1], color: '#ffd8a8' }, ambient: '#8a7cc0',
    key: { dir: [0.3, 0.3, -0.9], color: '#ffd2a0', tint: 0.2 }, shade: { tint: '#c0b0ff', mix: 0.3 }, rim: { dir: [0, 0.2, -1], amt: 1.2 },
    fog: '#f4a07e', fogDensity: 0.0002, fogNear: 60, fogMax: 0.3, celFog: 0.25, paintRadius: 6, paintFar: 2500, paintFarScale: 1.6,
    mirror: { on: false },
    bloom: 0.65, exposure: 1.0, sat: 1.16, contrast: 0.2, lift: '#0e0a2c', gain: '#fff8f0', vignette: 0.16, grain: 0.03, paper: 0.035,
  },
};

const arr3 = (v) => (v.isVector3 ? v : new THREE.Vector3(...v));
// write the light keys of a look into the shared uniforms (main calls it before the department updates)
export function applyLights(look) {
  if (look.sun) { if (look.sun.dir) AU.uSunDir.value.copy(arr3(look.sun.dir)).normalize(); if (look.sun.color) AU.uSunColor.value.set(look.sun.color); }
  if (look.ambient) AU.uAmbient.value.set(look.ambient);
  if (look.key) setKey({ dir: look.key.dir ? arr3(look.key.dir).clone().normalize() : undefined, pos: look.key.pos ? arr3(look.key.pos) : undefined, color: look.key.color, tint: look.key.tint });
  if (look.shade) { if (look.shade.tint) AU.uShadeTint.value.set(look.shade.tint); if (look.shade.mix !== undefined) AU.uShadeMix.value = look.shade.mix; }
  if (look.rim) { if (look.rim.dir) AU.uRimDir.value.copy(arr3(look.rim.dir)).normalize(); if (look.rim.amt !== undefined) AU.uRimAmt.value = look.rim.amt; }
  if (look.wind) { AU.uWind.value.x = look.wind[0]; AU.uWind.value.y = look.wind[1]; }
}
