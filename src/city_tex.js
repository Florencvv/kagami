// city_tex.js - canvas-painted textures for the CITY set (dept CITY). Pure code: no image or font files
// (system CJK fonts via canvas only), seeded, built once at create().
//   signAtlas()  -> { tex, cells: {word: {u0, v0, u1, v1, aspect}} }  neon sign masks (r tube core, g glow, b lightbox fill)
//   shopAtlas(rng) -> { col, emi, cells: [{u0, v0, u1, v1}] }          old shop fronts (colour + emissive twin)
//   norenAtlas() -> { tex, cells }                                      noren cloth designs
//   boardAtlas() -> { tex, cells: {word: ...} }                         wooden kanban boards
import * as THREE from 'three';

export const WORDS = ['酒', '宿', '薬', '湯', '夜', '雨', '本', '茶', '喫茶', '居酒屋'];
const GOTHIC = '"Yu Gothic UI", "Yu Gothic", "YuGothic", "MS Gothic", sans-serif';
const SONG = '"SimSun", "Yu Gothic", serif';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true; return t;
}
// wobbly hand-drawn line (ink)
function inkLine(g, x0, y0, x1, y1, w, rng, col = 'rgba(30,20,28,0.9)') {
  g.strokeStyle = col; g.lineCap = 'round';
  const n = 6; let px = x0, py = y0;
  for (let i = 1; i <= n; i++) {
    const k = i / n, j = (rng() - 0.5) * w * 0.6;
    const x = x0 + (x1 - x0) * k + (i < n ? j : 0), y = y0 + (y1 - y0) * k + (i < n ? j : 0);
    g.lineWidth = w * (0.75 + rng() * 0.5);
    g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke(); px = x; py = y;
  }
}

// ---------------------------------------------------------------- neon sign atlas (masks, coloured in the shader)
// each word gets one vertical cell: panel with a border tube and the word written top to bottom
export function signAtlas() {
  const CW = 256, SW = 4096, SH = 2048;
  const [c, g] = canvas(SW, SH);
  g.fillStyle = '#000'; g.fillRect(0, 0, SW, SH);
  const cells = {};
  let x = 0, y = 0, colW = 0;
  const place = (w, h) => { if (y + h > SH) { x += colW + 8; y = 0; colW = 0; } const r = { x, y }; y += h + 8; colW = Math.max(colW, w); return r; };
  // per word: 'tube' (neon letters on a dark panel) and 'box' (lightbox panel with letters), vertical and horizontal
  for (const horiz of [false, true]) {
    if (horiz) { x += colW + 8; y = 0; colW = 0; }
    for (const style of ['tube', 'box']) {
      for (const w of WORDS) {
        const n = [...w].length, ch = 236, L = 40 + n * ch;
        const cw = horiz ? L : CW, h = horiz ? CW : L;
        const r = place(cw, h);
        // channel drawings: R tube core / letters, G glow halo, B panel fill
        const [cc, cg] = canvas(cw, h);
        cg.fillStyle = style === 'box' ? 'rgb(0,0,255)' : 'rgb(0,0,60)';
        rr(cg, 6, 6, cw - 12, h - 12, 22); cg.fill();
        cg.globalCompositeOperation = 'lighter';
        cg.save(); cg.filter = 'blur(10px)';
        cg.fillStyle = 'rgb(0,200,0)'; cg.strokeStyle = 'rgb(0,200,0)';
        drawWord(cg, w, cw, h, style, true, horiz);
        cg.restore();
        cg.save();
        cg.fillStyle = 'rgb(255,0,0)'; cg.strokeStyle = 'rgb(255,0,0)';
        drawWord(cg, w, cw, h, style, false, horiz);
        cg.restore();
        g.drawImage(cc, r.x, r.y);
        cells[w + ':' + style + (horiz ? ':h' : '')] = { u0: r.x / SW, v0: 1 - (r.y + h) / SH, u1: (r.x + cw) / SW, v1: 1 - r.y / SH, aspect: horiz ? cw / h : h / cw };
      }
    }
  }
  const t = tex(c, false);
  return { tex: t, cells };
}
function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function drawWord(g, w, cw, h, style, glow, horiz) {
  const chars = [...w], n = chars.length, ch = 236;
  // border tube (inside the panel edge)
  g.lineWidth = glow ? 14 : 7;
  rr(g, 18, 18, cw - 36, h - 36, 16); g.stroke();
  g.font = `bold 190px ${GOTHIC}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    const px = horiz ? 20 + ch * (i + 0.5) : cw / 2, py = horiz ? h / 2 + 2 : 20 + ch * (i + 0.5) + 2;
    if (style === 'tube') {
      // neon tube letters: stroked outline + thin fill reads like bent glass at phone size
      g.lineWidth = glow ? 16 : 9; g.lineJoin = 'round';
      g.strokeText(chars[i], px, py);
      if (!glow) { g.globalAlpha = 0.55; g.fillText(chars[i], px, py); g.globalAlpha = 1; }
    } else {
      g.fillText(chars[i], px, py);
    }
  }
}

// ---------------------------------------------------------------- old shop fronts: 8 designs (512 x 1024 each => 8 m x 7.2 m front)
export function shopAtlas(rng) {
  const W = 512, H = 1024, S = 2048;
  const [c, g] = canvas(S, S), [e, ge] = canvas(S, S);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
  const cells = [];
  for (let k = 0; k < 8; k++) {
    const ox = (k % 4) * W, oy = Math.floor(k / 4) * H;
    g.save(); g.translate(ox, oy); ge.save(); ge.translate(ox, oy);
    drawShop(g, ge, W, H, k, rng);
    g.restore(); ge.restore();
    cells.push({ u0: ox / S, v0: 1 - (oy + H) / S, u1: (ox + W) / S, v1: 1 - oy / S });
  }
  return { col: tex(c), emi: tex(e), cells };
}
const WOODS = ['#4a3242', '#5a3a3a', '#3e3350', '#553d33', '#463048'];
const PLASTER = ['#8c84b0', '#a296b8', '#7f7aa6', '#9a8aa8'];
function drawShop(g, ge, W, H, k, rng) {
  const px = W / 8;              // pixels per metre (8 m wide)
  const Y = (m) => H - m * (H / 7.2);  // metres from ground -> canvas y
  const wood = WOODS[k % WOODS.length], plaster = PLASTER[k % PLASTER.length];
  // upper floor wall (plaster or boards)
  g.fillStyle = k % 3 === 0 ? wood : plaster; g.fillRect(0, 0, W, H);
  if (k % 3 === 0) { for (let x = 0; x < W; x += 18 + rng() * 6) inkLine(g, x, Y(7.2), x, Y(3.4), 2, rng, 'rgba(25,15,30,0.55)'); }
  else { // painted plaster dabs
    for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(${60 + rng() * 40},${50 + rng() * 40},${90 + rng() * 40},0.12)`; g.fillRect(rng() * W, Y(7.2) + rng() * (Y(3.4) - Y(7.2)), 20 + rng() * 40, 6 + rng() * 10); }
  }
  // upper windows: mushiko slats over a warm glow (some lit)
  const upLit = rng() < 0.6;
  const wx0 = px * (1 + rng() * 0.6), wx1 = W - px * (1 + rng() * 0.6), wy0 = Y(6.3), wy1 = Y(4.4);
  g.fillStyle = upLit ? '#f2b56a' : '#2b2a52'; g.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
  if (upLit) { ge.fillStyle = 'rgb(255,170,90)'; ge.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0); }
  const slat = 13;
  for (let x = wx0; x < wx1; x += slat) { g.fillStyle = wood; g.fillRect(x, wy0, slat * 0.45, wy1 - wy0); ge.fillStyle = '#000'; ge.fillRect(x, wy0, slat * 0.45, wy1 - wy0); }
  g.lineWidth = 5; g.strokeStyle = '#24161e'; g.strokeRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
  // beam between floors
  g.fillStyle = '#2a1c26'; g.fillRect(0, Y(3.6), W, Y(3.2) - Y(3.6));
  // ground floor: posts + sliding lattice doors with glowing paper, or glass with warm interior
  g.fillStyle = '#2c1f2c'; g.fillRect(0, Y(3.2), W, H - Y(3.2));
  const kind = k % 4;   // 0 lattice+paper, 1 glass izakaya, 2 shutters half down + lit gap, 3 noodle bar counter
  const gy0 = Y(2.9), gy1 = Y(0.05);
  const glow = ['#ffcf86', '#ffb36a', '#ffd9a0', '#ff9c6a'][kind];
  const gE = ['rgb(255,190,110)', 'rgb(255,150,80)', 'rgb(255,200,140)', 'rgb(255,130,80)'][kind];
  g.fillStyle = glow; g.fillRect(px * 0.4, gy0, W - px * 0.8, gy1 - gy0);
  ge.fillStyle = gE; ge.fillRect(px * 0.4, gy0, W - px * 0.8, gy1 - gy0);
  if (kind === 0 || kind === 3) {
    // koshi lattice: dense vertical bars + a few rails
    for (let x = px * 0.4; x < W - px * 0.4; x += 11) { g.fillStyle = '#3a2430'; g.fillRect(x, gy0, 4.5, gy1 - gy0); ge.fillStyle = '#000'; ge.fillRect(x, gy0, 4.5, gy1 - gy0); }
    for (const m of [0.9, 1.8, 2.5]) { g.fillStyle = '#3a2430'; g.fillRect(px * 0.4, Y(m), W - px * 0.8, 5); ge.fillStyle = '#000'; ge.fillRect(px * 0.4, Y(m), W - px * 0.8, 5); }
  } else if (kind === 1) {
    // glass panes with silhouettes of bottles/people inside
    for (let x = px * 0.4; x < W - px * 0.4; x += px * 1.4) { g.fillStyle = '#3a2430'; g.fillRect(x, gy0, 7, gy1 - gy0); ge.fillStyle = '#000'; ge.fillRect(x, gy0, 7, gy1 - gy0); }
    for (let i = 0; i < 5; i++) { const x = px * (1 + rng() * 5.5), h = px * (0.9 + rng() * 0.5); g.fillStyle = 'rgba(120,60,70,0.75)'; g.beginPath(); g.ellipse(x, Y(1.0) - h * 0.5, px * 0.28, h * 0.5, 0, 0, 7); g.fill(); g.beginPath(); g.arc(x, Y(1.0) - h - px * 0.2, px * 0.2, 0, 7); g.fill(); ge.fillStyle = 'rgba(0,0,0,0.6)'; ge.beginPath(); ge.ellipse(x, Y(1.0) - h * 0.5, px * 0.28, h * 0.5, 0, 0, 7); ge.fill(); }
    g.fillStyle = '#3a2430'; g.fillRect(px * 0.4, Y(1.0), W - px * 0.8, 8);
  } else {
    // shutters half down
    const sy = Y(1.4);
    g.fillStyle = '#5d5a86'; g.fillRect(px * 0.4, gy0, W - px * 0.8, sy - gy0); ge.fillStyle = '#000'; ge.fillRect(px * 0.4, gy0, W - px * 0.8, sy - gy0);
    for (let y = gy0; y < sy; y += 9) { g.fillStyle = 'rgba(30,25,60,0.5)'; g.fillRect(px * 0.4, y, W - px * 0.8, 2); }
  }
  // posts
  for (const x of [0, W / 2 - 6, W - 12]) { g.fillStyle = '#24161e'; g.fillRect(x, Y(3.2), 12, H - Y(3.2)); ge.fillStyle = '#000'; ge.fillRect(x, Y(3.2), 12, H - Y(3.2)); }
  // ink frame lines
  inkLine(g, 0, Y(3.2), W, Y(3.2), 4, rng); inkLine(g, 0, Y(3.6), W, Y(3.6), 3, rng);
  inkLine(g, px * 0.4, gy0, W - px * 0.4, gy0, 3, rng);
  // stone footing
  g.fillStyle = '#3b3560'; g.fillRect(0, Y(0.25), W, H - Y(0.25)); ge.fillStyle = '#000'; ge.fillRect(0, Y(0.25), W, H - Y(0.25));
}

// ---------------------------------------------------------------- noren designs (6 cells 256 x 256 in 768 x 512)
export function norenAtlas() {
  const S = 256, [c, g] = canvas(S * 3, S * 2);
  const designs = [['#2c3a7a', '#f2efe6', '酒'], ['#8e1e26', '#f6efe4', '湯'], ['#efe8dc', '#2a2440', '茶'], ['#2a2a5a', '#f2efe6', ''],
    ['#a32a3a', '#f6efe4', '宿'], ['#3a2f6a', '#f2efe6', '本']];
  const cells = [];
  designs.forEach(([bg, fg, w], i) => {
    const x = (i % 3) * S, y = Math.floor(i / 3) * S;
    g.fillStyle = bg; g.fillRect(x, y, S, S);
    // subtle cloth folds
    for (let k = 0; k < 8; k++) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x + k * 32 + 10, y, 8, S); }
    g.fillStyle = fg; g.strokeStyle = fg;
    if (w) { g.font = `bold 150px ${SONG}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(w, x + S / 2, y + S * 0.42); }
    else { g.lineWidth = 14; g.beginPath(); g.arc(x + S / 2, y + S * 0.42, 60, 0, 7); g.stroke(); }
    cells.push({ u0: x / (S * 3), v0: 1 - (y + S) / (S * 2), u1: (x + S) / (S * 3), v1: 1 - y / (S * 2) });
  });
  return { tex: tex(c), cells };
}

// ---------------------------------------------------------------- wooden kanban boards (horizontal), 1 cell per word
export function boardAtlas() {
  const CW = 512, CH = 160, [c, g] = canvas(CW * 2, CH * 5);
  const cells = {};
  WORDS.forEach((w, i) => {
    const x = (i % 2) * CW, y = Math.floor(i / 2) * CH;
    g.fillStyle = ['#3a2430', '#2a1f3a', '#4a2a2a'][i % 3]; g.fillRect(x, y, CW, CH);
    g.strokeStyle = '#c9a24a'; g.lineWidth = 6; g.strokeRect(x + 10, y + 10, CW - 20, CH - 20);
    g.fillStyle = i % 2 ? '#f2e6c8' : '#e8c27a';
    const n = [...w].length;
    g.font = `bold ${n > 2 ? 100 : 118}px ${SONG}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(w, x + CW / 2, y + CH / 2 + 4);
    cells[w] = { u0: x / (CW * 2), v0: 1 - (y + CH) / (CH * 5), u1: (x + CW) / (CW * 2), v1: 1 - y / (CH * 5) };
  });
  return { tex: tex(c), cells };
}
