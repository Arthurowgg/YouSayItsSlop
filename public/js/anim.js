// AnimationManager v4: named states (fps/loop/transitions), sprite strips of any res,
// 2x supersampled crisp rendering, transparent AI frames, preload + fallback,
// unique per-hero power FX. No transform-jumping idle: idle uses planted frames.
export const FRAME = 48;
export const ANIMS = {
  idle:   { start: 0,  count: 4, fps: 4,  loop: true },
  walk:   { start: 4,  count: 6, fps: 9,  loop: true },
  attack: { start: 10, count: 4, fps: 10, loop: false },
  power:  { start: 14, count: 4, fps: 8,  loop: false },
};
let ANIM_DEBUG = false;
export function setAnimDebug(v) { ANIM_DEBUG = !!v; }
export function getAnimDebug() { return ANIM_DEBUG; }
export const EMOTES = ['gangnam', 'floss', 'dab', 'moonwalk', 'robot', 'runningman', 'macarena', 'hype', 'heart', 'groove'];
EMOTES.forEach((e) => { ANIMS['e_' + e] = { start: 0, count: 6, fps: 9, loop: true }; });
let FPS_CAP = 60;
export function setFpsCap(n) { FPS_CAP = Math.max(10, n | 0) || 60; }

// ---- asset preload + fallback registry ----
const cache = new Map();
export function preloadHero(id) {
  if (cache.has(id)) return cache.get(id);
  const p = new Promise((res) => {
    const Img = (typeof window !== 'undefined' && window.Image) ? window.Image : Image;
    const img = new Img();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = `assets/anim/${id}.png`;
  });
  cache.set(id, p);
  return p;
}

const GLIDER_OFF = {
  glider_wings: { dx: 0, dy: -2 }, glider_shield: { dx: -11, dy: 0 },
  glider_cosmic: { dx: 0, dy: -2 }, glider_claws: { dx: 10, dy: -4 },
  glider_portal: { dx: 0, dy: -3 }, glider_webwings: { dx: 0, dy: -2 },
  glider_storm: { dx: 0, dy: -4 }, glider_panther: { dx: 0, dy: -2 },
  glider_holo: { dx: -10, dy: -2 }, glider_valkyrie: { dx: 0, dy: -4 },
};

// pose = [dx, dy, rot(rad), scale] — applied in 48-grid units
const POSES = {
  idle:   [[0, 0, 0, 1], [0, 0, 0, 1.012], [0, 0, 0, 1], [0, 0, 0, 1.012]],
  walk:   [[0, 0, -0.05, 1], [1, -1, 0.04, 1], [0, 0, 0.05, 1], [-1, -1, -0.04, 1]],
  attack: [[0, 0, -0.14, 1], [2, -1, 0.16, 1.03], [4, 0, 0.3, 1.05], [1, 0, 0.05, 1]],
  power:  [[0, 0, 0, 1], [0, -1, 0, 1.05], [0, -2, 0, 1.1], [0, -1, 0, 1.05]],
};
// idle alternates the two "planted" frames of the strip (0 and 3) for subtle breathing
const IDLE_SRC = [0, 0, 0, 0]; // planted frame; breathing comes from pose scale
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
function pxl(c, u, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x) * u, Math.round(y) * u, Math.max(1, w) * u, Math.max(1, h) * u); }
function drawHeroFX(c, u, hid, animName, f) {
  const col = FX_COLORS[hid] || '#ffffff';
  if (animName === 'attack') {
    for (let i = 0; i < 5; i++) {
      const a = -1.1 + (f / 3) * 2.2 + i * 0.1;
      pxl(c, u, 32 + Math.cos(a) * (7 + i * 1.5), 22 + Math.sin(a) * (7 + i * 1.5), 2, 2, i % 2 ? col : '#ffffff');
    }
    return;
  }
  if (animName !== 'power') return;
  switch (true) {
    case /^(spiderman|miles|gwen)/.test(hid):
      for (let i = 0; i < 3; i++) for (let k = 0; k < 6 + f; k++) {
        const a = -0.5 + i * 0.5 - f * 0.06;
        pxl(c, u, 30 + Math.cos(a) * k * 1.6, 20 + Math.sin(a) * k * 1.6, 1, 1, k % 2 ? '#f5f8ff' : col);
      }
      break;
    case hid === 'venom':
      for (let i = 0; i < 4; i++) for (let k = 0; k < 8 + f * 2; k++)
        pxl(c, u, 14 + i * 7 + Math.sin((k + f) * 0.9 + i) * 2, 40 - k, 2, 1, i % 2 ? '#3b1d66' : col);
      break;
    case hid === 'ironman':
      for (let k = 0; k < 14 + f * 4; k++) pxl(c, u, 30 + k, 19 + (k % 2), 2, 1, k % 3 ? col : '#ffffff');
      pxl(c, u, 29, 18, 3, 3, '#ffffff');
      break;
    case hid === 'capamerica': {
      const a = f * 1.4;
      for (let i = 0; i < 8; i++) { const an = a + i * 0.785;
        pxl(c, u, 34 + Math.cos(an) * 6, 20 + Math.sin(an) * 6, 2, 2, ['#ff4d4d', '#f5f8ff', '#3a6cff'][i % 3]); }
      break; }
    case hid === 'thor': {
      let x = 30; for (let y = 0; y < 18; y += 2) { x += (y + f) % 4 ? 1 : -2; pxl(c, u, x, y, 2, 2, y % 4 ? '#ffe45c' : '#ffffff'); }
      break; }
    case hid === 'hulk':
      for (let i = 0; i < 10 + f * 3; i++) { pxl(c, u, 24 - i, 40, 2, 1, col); pxl(c, u, 24 + i, 40, 2, 1, col); }
      pxl(c, u, 20, 38 - f, 8, 1, '#b6ff9e');
      break;
    case hid === 'wolverine':
      for (let i = 0; i < 3; i++) for (let k = 0; k < 8; k++) pxl(c, u, 28 + k + i * 2, 12 + k * 2 + i * 3, 2, 1, '#e8ecf5');
      break;
    case hid === 'blackwidow':
      pxl(c, u, 30 - f, 18, 4 + f, 2, col); pxl(c, u, 30 - f, 24, 4 + f, 2, col);
      break;
    case hid === 'hawkeye':
      for (let k = 0; k < 12 + f * 5; k++) pxl(c, u, 26 + k, 20, 2, 1, k > 10 + f * 5 - 3 ? '#ffffff' : col);
      break;
    case hid === 'drstrange':
      for (let i = 0; i < 12; i++) { const an = f * 0.8 + i * 0.52;
        pxl(c, u, 24 + Math.cos(an) * (8 + (f % 2)), 22 + Math.sin(an) * (8 + (f % 2)), 2, 2, i % 3 ? col : '#ffe08a'); }
      break;
    case /^scarletwitch/.test(hid):
      for (let i = 0; i < 6; i++) { const an = i * 1.05 + f * 0.4;
        pxl(c, u, 24 + Math.cos(an) * (4 + f * 2), 22 + Math.sin(an) * (4 + f * 2), 2, 2, col); }
      break;
    case hid === 'blackpanther':
      for (let i = 0; i < 3; i++) for (let k = 0; k < 6 + f; k++) pxl(c, u, 26 + k * 2, 14 + i * 5 + k, 2, 1, k % 2 ? col : '#e9d5ff');
      break;
    case /^captainmarvel/.test(hid):
      for (let i = 0; i < 8; i++) { const an = i * 0.785 + f * 0.3;
        for (let k = 2; k < 6 + f * 2; k++) pxl(c, u, 24 + Math.cos(an) * k, 20 + Math.sin(an) * k, 1, 1, k % 2 ? col : '#ffffff'); }
      break;
    default:
      for (let i = 0; i < 8; i++) { const an = i * 0.785; pxl(c, u, 24 + Math.cos(an) * (3 + f * 2), 24 + Math.sin(an) * (3 + f * 2), 2, 2, col); }
  }
}

export class Animator {
  constructor(canvas, scale = 5) {
    this.cv = canvas;
    this.scale = scale;
    this.q = 2; // supersampling: internal 2x, CSS size = logical
    canvas.width = FRAME * scale * this.q;
    canvas.height = FRAME * scale * this.q;
    canvas.style.width = FRAME * scale + 'px';
    canvas.style.height = FRAME * scale + 'px';
    this.ctx = canvas.getContext('2d');
    this.img = null;
    this.gimg = null;
    this.gid = null;
    this.res = FRAME;
    this.frames = 4;
    this.anim = 'idle';
    this.frame = 0;
    this.last = 0;
    this.raf = 0;
    this.dead = false;
    this.onEnd = null;
  }
  load(heroId, gliderId) {
    preloadHero(heroId).then((img) => {
      if (this.dead) return;
      if (!img) { this.missing = true; return; } // fallback: render nothing, no crash
      this.img = img;
      this.hid = heroId;
      this.res = img.height;
      this.frames = Math.max(1, Math.round(img.width / img.height));
      this.frame = 0;
      this.cv.classList.add('ready');
      if (!this.raf) this.raf = requestAnimationFrame((t) => this.loop(t));
    });
    if (gliderId) {
      const Img = (typeof window !== 'undefined' && window.Image) ? window.Image : Image;
      const g = new Img();
      g.onload = () => { if (!this.dead) { this.gimg = g; this.gid = gliderId; this.gsingle = g.width === g.height; } };
      g.src = `assets/spr/${gliderId}.png`;
    } else { this.gimg = null; this.gid = null; }
  }
  setAnim(a, onEnd) {
    if (onEnd !== undefined) this.onEnd = onEnd;
    if (this.anim !== a) { this.anim = a; this.frame = 0; this.last = 0; }
  }
  loop(t) {
    if (this.dead) return;
    this.raf = requestAnimationFrame((x) => this.loop(x));
    const c = this.ctx, S = this.scale * this.q;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    if (!this.img) return;
    const A = ANIMS[this.anim] || ANIMS.idle;
    const minMs = Math.max(1000 / A.fps, 1000 / FPS_CAP);
    if (t - this.last < minMs) return;
    this.last = t;
    this.frame++;
    if (this.frame >= A.count) {
      if (A.loop) this.frame = 0;
      else {
        this.frame = A.count - 1;
        const cb = this.onEnd; this.onEnd = null;
        if (cb) cb(); else this.anim = 'idle'; // transition back to idle
        return;
      }
    }
    const f = this.frame;
    if (this.gimg) {
      const off = GLIDER_OFF[this.gid] || { dx: 0, dy: 0 };
      const sway = [0, -1, 0, 1][f % 4];
      if (this.gsingle) {
        c.drawImage(this.gimg, 0, 0, this.gimg.width, this.gimg.height, off.dx * S, (off.dy + sway) * S - 4 * S, FRAME * S, FRAME * S);
      } else {
        const gr = this.gimg.height, gw = Math.round(this.gimg.width / gr);
        const gf = gw > 1 ? (Math.floor(f / 2) % gw) : 0;
        c.drawImage(this.gimg, gf * gr, 0, gr, gr, off.dx * S, (off.dy + sway) * S, FRAME * S, FRAME * S);
      }
    }
    const isEmote = this.anim.startsWith('e_');
    const full = this.frames >= 18; // real generated sequences: idle/walk/attack/power
    let dx = 0, dy = 0, rot = 0, sc = 1, src;
    if (full && !isEmote) {
      src = A.start + f; // true frames, no transform posing
    } else if (isEmote) {
      const poses = EMOTE_POSES[this.anim.slice(2)] || POSES.idle;
      [dx, dy, rot, sc] = poses[f % poses.length];
      src = f % Math.min(4, this.frames);
    } else {
      const poses = POSES[this.anim] || POSES.idle;
      [dx, dy, rot, sc] = poses[f % poses.length];
      src = this.anim === 'idle' ? IDLE_SRC[f % IDLE_SRC.length] : this.anim === 'walk' ? [0, 1, 0, 1][f % 4] : (f % this.frames);
    }
    if (this.anim === 'power') { c.shadowColor = FX_COLORS[this.hid] || '#fff'; c.shadowBlur = 6 * S; }
    c.save();
    c.translate((24 + dx) * S, (24 + dy) * S);
    c.rotate(rot);
    c.scale(sc, sc);
    c.drawImage(this.img, src * this.res, 0, this.res, this.res, -24 * S, -24 * S, FRAME * S, FRAME * S);
    c.restore();
    c.shadowBlur = 0;
    if (this.hid && !isEmote) drawHeroFX(c, S, this.hid, this.anim, f);
    if (ANIM_DEBUG) {
      const u = S;
      c.strokeStyle = 'rgba(0,255,120,.9)'; c.lineWidth = Math.max(1, u * 0.4);
      c.beginPath(); c.moveTo(0, 44 * u); c.lineTo(48 * u, 44 * u); c.stroke();
      c.strokeStyle = 'rgba(255,80,80,.9)'; c.strokeRect(6 * u, 2 * u, 36 * u, 42 * u);
      c.fillStyle = '#7dffb0'; c.font = `${3 * u}px monospace`;
      c.fillText(`${this.anim} f${f}/${A.count} ${A.fps}fps ${this.res}px`, 1 * u, 5 * u);
    }
  }
  destroy() { this.dead = true; if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.raf); this.raf = 0; }
}
