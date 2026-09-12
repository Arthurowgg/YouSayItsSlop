// Animator v3: AI 4-frame strips + transform-based posing (idle/walk/attack/power/emotes),
// unique per-hero power FX, static AI backblings, legacy long-strip fallback.
export const FRAME = 48;
export const ANIMS = {
  idle:   { count: 4, fps: 6 },
  walk:   { count: 6, fps: 10 },
  attack: { count: 4, fps: 11 },
  power:  { count: 4, fps: 8 },
};
export const EMOTES = ['gangnam', 'floss', 'dab', 'moonwalk', 'robot', 'runningman', 'macarena', 'hype', 'heart', 'groove'];
EMOTES.forEach((e) => { ANIMS['e_' + e] = { count: 6, fps: 9 }; });
let FPS_CAP = 60;
export function setFpsCap(n) { FPS_CAP = Math.max(10, n | 0) || 60; }
const GLIDER_OFF = {
  glider_wings: { dx: 0, dy: -2 }, glider_shield: { dx: -11, dy: 0 },
  glider_cosmic: { dx: 0, dy: -2 }, glider_claws: { dx: 10, dy: -4 },
  glider_portal: { dx: 0, dy: -3 }, glider_webwings: { dx: 0, dy: -2 },
  glider_storm: { dx: 0, dy: -4 }, glider_panther: { dx: 0, dy: -2 },
  glider_holo: { dx: -10, dy: -2 }, glider_valkyrie: { dx: 0, dy: -4 },
};

// pose = [dx, dy, rot(rad), scale]
const POSES = {
  idle:   [[0, 0, 0, 1], [0, -1, 0, 1.015], [0, 0, 0, 1], [0, 1, 0, 0.99]],
  walk:   [[0, 0, -0.06, 1], [1, -2, 0.05, 1.03], [0, 0, 0.06, 1], [-1, -2, -0.05, 1.03]],
  attack: [[0, 0, -0.14, 1], [2, -1, 0.16, 1.04], [4, 0, 0.32, 1.06], [1, 0, 0.05, 1]],
  power:  [[0, 0, 0, 1], [0, -2, 0, 1.07], [0, -4, 0, 1.14], [0, -2, 0, 1.07]],
};
const EMOTE_POSES = {
  dab:        [[0, 0, -0.18, 1], [0, -2, 0.22, 1.06], [0, 0, -0.18, 1], [0, -2, 0.22, 1.06]],
  groove:     [[-2, 0, -0.1, 1], [2, -1, 0.1, 1], [-2, 0, -0.12, 1], [2, -1, 0.12, 1]],
  hype:       [[0, 0, 0, 1], [0, -5, 0, 1.12], [0, 0, 0, 1], [0, -3, 0, 1.07]],
  runningman: [[-2, 0, -0.14, 1], [2, 0, 0.14, 1], [-2, -1, -0.14, 1], [2, -1, 0.14, 1]],
  heart:      [[0, 0, 0, 1], [0, -1, 0, 1.06], [0, 0, 0, 1.1], [0, -1, 0, 1.06]],
  floss:      [[0, 0, -0.24, 1], [0, 0, 0.24, 1], [0, -1, -0.24, 1], [0, -1, 0.24, 1]],
  robot:      [[-2, 0, 0, 1], [-2, 0, 0, 1], [2, 0, 0, 1], [2, 0, 0, 1]],
  macarena:   [[0, 0, -0.1, 1], [0, 0, 0.1, 1], [0, -1, -0.16, 1], [0, -1, 0.16, 1]],
  gangnam:    [[0, 0, -0.1, 1], [0, -3, 0.14, 1.06], [0, 0, -0.1, 1], [0, -3, 0.14, 1.06]],
  moonwalk:   [[3, 0, 0.14, 1], [0, 0, 0.1, 1], [-3, 0, 0.14, 1], [0, 0, 0.1, 1]],
};

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
  if (animName === 'attack') {
    for (let i = 0; i < 5; i++) {
      const a = -1.1 + (f / 3) * 2.2 + i * 0.1;
      pxl(c, S, 32 + Math.cos(a) * (7 + i * 1.5), 22 + Math.sin(a) * (7 + i * 1.5), 2, 2, i % 2 ? col : '#ffffff');
    }
    return;
  }
  if (animName !== 'power') return;
  switch (true) {
    case /^(spiderman|miles|gwen)/.test(hid):
      c.fillStyle = '#f5f8ff';
      for (let i = 0; i < 3; i++) for (let k = 0; k < 6 + f; k++) {
        const a = -0.5 + i * 0.5 - f * 0.06;
        pxl(c, S, 30 + Math.cos(a) * k * 1.6, 20 + Math.sin(a) * k * 1.6, 1, 1, k % 2 ? '#f5f8ff' : col);
      }
      break;
    case hid === 'venom':
      for (let i = 0; i < 4; i++) for (let k = 0; k < 8 + f * 2; k++)
        pxl(c, S, 14 + i * 7 + Math.sin((k + f) * 0.9 + i) * 2, 40 - k, 2, 1, i % 2 ? '#3b1d66' : col);
      break;
    case hid === 'ironman':
      for (let k = 0; k < 14 + f * 4; k++) pxl(c, S, 30 + k, 19 + (k % 2), 2, 1, k % 3 ? col : '#ffffff');
      pxl(c, S, 29, 18, 3, 3, '#ffffff');
      break;
    case hid === 'capamerica': {
      const a = f * 1.4;
      for (let i = 0; i < 8; i++) { const an = a + i * 0.785;
        pxl(c, S, 34 + Math.cos(an) * 6, 20 + Math.sin(an) * 6, 2, 2, ['#ff4d4d', '#f5f8ff', '#3a6cff'][i % 3]); }
      break; }
    case hid === 'thor': {
      let x = 30; for (let y = 0; y < 18; y += 2) { x += (y + f) % 4 ? 1 : -2; pxl(c, S, x, y, 2, 2, y % 4 ? '#ffe45c' : '#ffffff'); }
      break; }
    case hid === 'hulk':
      for (let i = 0; i < 10 + f * 3; i++) { pxl(c, S, 24 - i, 40, 2, 1, col); pxl(c, S, 24 + i, 40, 2, 1, col); }
      pxl(c, S, 20, 38 - f, 8, 1, '#b6ff9e');
      break;
    case hid === 'wolverine':
      for (let i = 0; i < 3; i++) for (let k = 0; k < 8; k++) pxl(c, S, 28 + k + i * 2, 12 + k * 2 + i * 3, 2, 1, '#e8ecf5');
      break;
    case hid === 'blackwidow':
      pxl(c, S, 30 - f, 18, 4 + f, 2, col); pxl(c, S, 30 - f, 24, 4 + f, 2, col);
      break;
    case hid === 'hawkeye':
      for (let k = 0; k < 12 + f * 5; k++) pxl(c, S, 26 + k, 20, 2, 1, k > 10 + f * 5 - 3 ? '#ffffff' : col);
      break;
    case hid === 'drstrange':
      for (let i = 0; i < 12; i++) { const an = f * 0.8 + i * 0.52;
        pxl(c, S, 24 + Math.cos(an) * (8 + (f % 2)), 22 + Math.sin(an) * (8 + (f % 2)), 2, 2, i % 3 ? col : '#ffe08a'); }
      break;
    case /^scarletwitch/.test(hid):
      for (let i = 0; i < 6; i++) { const an = i * 1.05 + f * 0.4;
        pxl(c, S, 24 + Math.cos(an) * (4 + f * 2), 22 + Math.sin(an) * (4 + f * 2), 2, 2, col); }
      break;
    case hid === 'blackpanther':
      for (let i = 0; i < 3; i++) for (let k = 0; k < 6 + f; k++) pxl(c, S, 26 + k * 2, 14 + i * 5 + k, 2, 1, k % 2 ? col : '#e9d5ff');
      break;
    case /^captainmarvel/.test(hid):
      for (let i = 0; i < 8; i++) { const an = i * 0.785 + f * 0.3;
        for (let k = 2; k < 6 + f * 2; k++) pxl(c, S, 24 + Math.cos(an) * k, 20 + Math.sin(an) * k, 1, 1, k % 2 ? col : '#ffffff'); }
      break;
    default:
      for (let i = 0; i < 8; i++) { const an = i * 0.785; pxl(c, S, 24 + Math.cos(an) * (3 + f * 2), 24 + Math.sin(an) * (3 + f * 2), 2, 2, col); }
  }
}

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
    this.frames = 4;
    this.legacy = false;
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
      this.frames = Math.max(1, Math.round(img.width / FRAME));
      this.legacy = this.frames > 4;
      this.frame = 0;
      if (!this.raf) this.raf = requestAnimationFrame((t) => this.loop(t));
    };
    img.src = `assets/anim/${heroId}.png`;
    if (gliderId) {
      const g = new Img();
      g.onload = () => { if (!this.dead) { this.gimg = g; this.gid = gliderId; this.glegacy = g.width > FRAME; } };
      g.src = `assets/spr/${gliderId}.png`;
    } else { this.gimg = null; this.gid = null; }
  }
  setAnim(a) {
    if (this.anim !== a) { this.anim = a; this.frame = 0; this.last = 0; }
  }
  loop(t) {
    if (this.dead) return;
    this.raf = requestAnimationFrame((x) => this.loop(x));
    if (!this.img) return;
    const A = ANIMS[this.anim] || ANIMS.idle;
    const minMs = Math.max(1000 / A.fps, 1000 / FPS_CAP);
    if (t - this.last < minMs) return;
    this.last = t;
    this.frame = (this.frame + 1) % A.count;
    const c = this.ctx, S = this.scale;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    const f = this.frame;
    // backbling layer (static AI art w/ sway, or legacy strip)
    if (this.gimg) {
      const off = GLIDER_OFF[this.gid] || { dx: 0, dy: 0 };
      const sway = [0, -1, 0, 1][f % 4];
      if (this.glegacy) {
        const gw = Math.round(this.gimg.width / FRAME);
        const gf = gw > 1 ? (Math.floor(f / 2) % gw) : 0;
        c.drawImage(this.gimg, gf * FRAME, 0, FRAME, FRAME, off.dx * S, (off.dy + sway) * S, FRAME * S, FRAME * S);
      } else {
        c.drawImage(this.gimg, off.dx * S, (off.dy + sway) * S - 4 * S, FRAME * S, FRAME * S);
      }
    }
    if (this.legacy) {
      const LA = { idle: [0, 4], walk: [4, 6], attack: [10, 4], power: [14, 4] }[this.anim] ||
        [18 + EMOTES.indexOf(this.anim.slice(2)) * 6, 6];
      const src = LA[0] + (f % LA[1]);
      c.drawImage(this.img, src * FRAME, 0, FRAME, FRAME, 0, 0, FRAME * S, FRAME * S);
    } else {
      const poses = this.anim.startsWith('e_') ? (EMOTE_POSES[this.anim.slice(2)] || POSES.idle) : (POSES[this.anim] || POSES.idle);
      const [dx, dy, rot, sc] = poses[f % poses.length];
      if (this.anim === 'power') { c.shadowColor = FX_COLORS[this.hid] || '#fff'; c.shadowBlur = 8 * S; }
      c.save();
      c.translate((24 + dx) * S, (24 + dy) * S);
      c.rotate(rot);
      c.scale(sc, sc);
      c.drawImage(this.img, (f % this.frames) * FRAME, 0, FRAME, FRAME, -24 * S, -24 * S, FRAME * S, FRAME * S);
      c.restore();
      c.shadowBlur = 0;
    }
    if (this.hid) drawHeroFX(c, S, this.hid, this.anim, f);
  }
  destroy() { this.dead = true; if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.raf); this.raf = 0; }
}
