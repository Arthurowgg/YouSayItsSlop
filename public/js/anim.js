// Sprite-strip animator v2: 48x48 frames, smoother rates, backbling layer.
export const FRAME = 48;
export const ANIMS = {
  idle:   { start: 0,  count: 4, fps: 7 },
  walk:   { start: 4,  count: 6, fps: 11 },
  attack: { start: 10, count: 4, fps: 12 },
  power:  { start: 14, count: 4, fps: 9 },
};
export const EMOTES = ['gangnam', 'floss', 'dab', 'moonwalk', 'robot', 'runningman', 'macarena', 'hype', 'heart', 'groove'];
EMOTES.forEach((e, i) => { ANIMS['e_' + e] = { start: 18 + i * 6, count: 6, fps: 10 }; });
let FPS_CAP = 60;
export function setFpsCap(n) { FPS_CAP = Math.max(10, n | 0) || 60; }
const GLIDER_OFF = {
  glider_wings:  { dx: 0,   dy: -2 },
  glider_shield: { dx: -11, dy: 0 },
  glider_cosmic: { dx: 0,   dy: -2 },
  glider_claws:  { dx: 10,  dy: -4 },
};

export class Animator {
  constructor(canvas, scale = 5) {
    this.cv = canvas;
    this.scale = scale;
    this.ctx = canvas.getContext('2d');
    canvas.width = FRAME * scale;
    canvas.height = FRAME * scale;
    this.img = null;
    this.gimg = null;
    this.gid = null;
    this.anim = 'idle';
    this.frame = 0;
    this.last = 0;
    this.raf = 0;
    this.dead = false;
  }
  load(heroId, gliderId) {
    const Img = (typeof window !== 'undefined' && window.Image) ? window.Image : Image;
    const img = new Img();
    img.onload = () => {
      if (this.dead) return;
      this.img = img;
      this.hid = heroId;
      this.frame = 0;
      if (!this.raf) this.raf = requestAnimationFrame((t) => this.loop(t));
    };
    img.src = `assets/anim/${heroId}.png`;
    if (gliderId) {
      const g = new Img();
      g.onload = () => { if (!this.dead) { this.gimg = g; this.gid = gliderId; } };
      g.src = `assets/anim/${gliderId}.png`;
    } else { this.gimg = null; this.gid = null; }
  }
  setAnim(a) {
    if (this.anim !== a) { this.anim = a; this.frame = 0; this.last = 0; }
  }
  loop(t) {
    if (this.dead) return;
    this.raf = requestAnimationFrame((x) => this.loop(x));
    if (!this.img) return;
    const A = ANIMS[this.anim];
    const minMs = Math.max(1000 / A.fps, 1000 / FPS_CAP);
    if (t - this.last < minMs) return;
    this.last = t;
    this.frame = (this.frame + 1) % A.count;
    const c = this.ctx, S = this.scale;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    if (this.gimg) {
      const off = GLIDER_OFF[this.gid] || { dx: 0, dy: 0 };
      const gw = this.gimg.width / FRAME; // wings strip = 2 frames
      const gf = gw > 1 ? (Math.floor(this.frame / 2) % 2) : 0;
      c.drawImage(this.gimg, gf * FRAME, 0, FRAME, FRAME, off.dx * S, off.dy * S, FRAME * S, FRAME * S);
    }
    c.drawImage(this.img, (A.start + this.frame) * FRAME, 0, FRAME, FRAME, 0, 0, FRAME * S, FRAME * S);
    if (this.hid) drawHeroFX(c, S, this.hid, this.anim, this.frame);
  }

  destroy() { this.dead = true; if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.raf); this.raf = 0; }
}
/* ---------------- unique per-hero power/attack FX ---------------- */
const FX_COLORS = {
  spiderman: '#ff4d4d', spiderman_classic: '#ff4d4d', miles: '#b44dff', gwen: '#ff7ab8',
  venom: '#8b46ff', ironman: '#59e6ff', capamerica: '#7db4ff', thor: '#ffe45c',
  hulk: '#6dff5c', wolverine: '#ffd94d', blackwidow: '#ff5c7a', hawkeye: '#c68cff',
  drstrange: '#ffab40', scarletwitch: '#ff3d5a', scarletwitch_azure: '#4dc3ff',
  blackpanther: '#b44dff', captainmarvel: '#ffd75c', captainmarvel_classic: '#ffd75c',
  antman: '#5cd0ff', antman_unmasked: '#5cd0ff',
};
function pxl(c, S, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x) * S, Math.round(y) * S, Math.max(1, w) * S, Math.max(1, h) * S); }
function drawHeroFX(c, S, hid, animName, f) {
  const col = FX_COLORS[hid] || '#ffffff';
  const web = () => { // teia: linhas irradiando da mão
    c.fillStyle = '#f5f8ff';
    for (let i = 0; i < 3; i++) for (let k = 0; k < 6 + f; k++) {
      const a = -0.5 + i * 0.5 - f * 0.06;
      pxl(c, S, 30 + Math.cos(a) * k * 1.6, 20 + Math.sin(a) * k * 1.6, 1, 1, k % 2 ? '#f5f8ff' : col);
    }
  };
  if (animName === 'attack') {
    // arco de golpe na cor do herói
    for (let i = 0; i < 5; i++) {
      const a = -1.1 + (f / 3) * 2.2 + i * 0.1;
      pxl(c, S, 32 + Math.cos(a) * (7 + i * 1.5), 22 + Math.sin(a) * (7 + i * 1.5), 2, 2, i % 2 ? col : '#ffffff');
    }
    return;
  }
  if (animName !== 'power') return;
  switch (true) {
    case /^(spiderman|miles|gwen)/.test(hid): web(); break;
    case hid === 'venom': // tentáculos
      for (let i = 0; i < 4; i++) for (let k = 0; k < 8 + f * 2; k++)
        pxl(c, S, 14 + i * 7 + Math.sin((k + f) * 0.9 + i) * 2, 40 - k, 2, 1, i % 2 ? '#3b1d66' : col);
      break;
    case hid === 'ironman': // raio repulsor
      for (let k = 0; k < 14 + f * 4; k++) pxl(c, S, 30 + k, 19 + (k % 2), 2, 1, k % 3 ? col : '#ffffff');
      pxl(c, S, 29, 18, 3, 3, '#ffffff');
      break;
    case hid === 'capamerica': { // escudo girando
      const a = f * 1.4;
      for (let i = 0; i < 8; i++) { const an = a + i * 0.785;
        pxl(c, S, 34 + Math.cos(an) * 6, 20 + Math.sin(an) * 6, 2, 2, ['#ff4d4d', '#f5f8ff', '#3a6cff'][i % 3]); }
      break; }
    case hid === 'thor': // relâmpago
      let x = 30; for (let y = 0; y < 18; y += 2) { x += (y + f) % 4 ? 1 : -2; pxl(c, S, x, y, 2, 2, y % 4 ? '#ffe45c' : '#ffffff'); }
      break;
    case hid === 'hulk': // onda de choque
      for (let i = 0; i < 10 + f * 3; i++) { pxl(c, S, 24 - i, 40, 2, 1, col); pxl(c, S, 24 + i, 40, 2, 1, col); }
      pxl(c, S, 20, 38 - f, 8, 1, '#b6ff9e');
      break;
    case hid === 'wolverine': // garras
      for (let i = 0; i < 3; i++) for (let k = 0; k < 8; k++) pxl(c, S, 28 + k + i * 2, 12 + k * 2 + i * 3, 2, 1, '#e8ecf5');
      break;
    case hid === 'blackwidow': // clarão duplo
      pxl(c, S, 30 - f, 18, 4 + f, 2, col); pxl(c, S, 30 - f, 24, 4 + f, 2, col);
      break;
    case hid === 'hawkeye': // flecha
      for (let k = 0; k < 12 + f * 5; k++) pxl(c, S, 26 + k, 20, 2, 1, k > 10 + f * 5 - 3 ? '#ffffff' : col);
      break;
    case hid === 'drstrange': // círculo mágico
      for (let i = 0; i < 12; i++) { const an = f * 0.8 + i * 0.52;
        pxl(c, S, 24 + Math.cos(an) * (8 + (f % 2)), 22 + Math.sin(an) * (8 + (f % 2)), 2, 2, i % 3 ? col : '#ffe08a'); }
      break;
    case /^(scarletwitch)/.test(hid): // explosão de caos
      for (let i = 0; i < 6; i++) { const an = i * 1.05 + f * 0.4;
        pxl(c, S, 24 + Math.cos(an) * (4 + f * 2), 22 + Math.sin(an) * (4 + f * 2), 2, 2, col); }
      break;
    case hid === 'blackpanther': // garras de energia
      for (let i = 0; i < 3; i++) for (let k = 0; k < 6 + f; k++) pxl(c, S, 26 + k * 2, 14 + i * 5 + k, 2, 1, k % 2 ? col : '#e9d5ff');
      break;
    case /^(captainmarvel)/.test(hid): { // estrela fóton
      for (let i = 0; i < 8; i++) { const an = i * 0.785 + f * 0.3;
        for (let k = 2; k < 6 + f * 2; k++) pxl(c, S, 24 + Math.cos(an) * k, 20 + Math.sin(an) * k, 1, 1, k % 2 ? col : '#ffffff'); }
      break; }
    default: // pulso genérico
      for (let i = 0; i < 8; i++) { const an = i * 0.785; pxl(c, S, 24 + Math.cos(an) * (3 + f * 2), 24 + Math.sin(an) * (3 + f * 2), 2, 2, col); }
  }
}
