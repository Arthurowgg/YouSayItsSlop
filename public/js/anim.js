// AnimationManager v7 — crisp, data-driven sprite animator.
//
// What changed from v6 (the build that looked "bugado" on screen):
//   * frames are 112px (not 48px) and can be any size declared by
//     data/anim.json, so the art is NEVER downscaled by the browser below
//     its own pixel grid: the canvas backing store is always frames x
//     integer device scale and CSS size is derived from it — crisp at any
//     zoom, on any DPR, with zero resampling of the source art;
//   * the animation table (start/count/fps/loop) comes from the built
//     sheets, so a hero with 4 frames and a hero with 6 frames both work;
//   * `crop` lets a card show one region of the frame (portrait cards fill
//     their box without stretching the whole 112px frame);
//   * back blings are drawn from PRE-BAKED integer sizes and only integer
//     offsets are used, so the accessory keeps the same pixel grid as the
//     hero — no half-pixel blur, no giant bling on a small hero.
//
// One rAF ticker drives every live Animator; off-screen canvases are culled.
export const SHEET_FRAME = 112;         // default frame size (see anim.json)
const DEFAULT_FPS_CAP = 60;

// fallback table used when data/anim.json has no entry for a hero
const FALLBACK = {
  frames: { idle: 4, walk: 4, attack: 4, ability: 4 },
  anims: {
    idle: { start: 0, count: 4, fps: 3, loop: true },
    walk: { start: 4, count: 4, fps: 7, loop: true },
    attack: { start: 8, count: 4, fps: 9, loop: false },
    ability: { start: 12, count: 4, fps: 7, loop: false },
  },
};

let PACKS = {};                          // heroId -> {frames, anims, scale}
let FRAME = SHEET_FRAME;
let FPS_CAP = DEFAULT_FPS_CAP;

export function configureSheets(json) {
  if (!json || typeof json !== 'object') return;
  PACKS = json;
  for (const k of Object.keys(json)) {
    const s = json[k] && json[k].frame;
    if (s && Number.isFinite(s) && s >= 32) { FRAME = s; break; }
  }
}
export const animPack = (id) => PACKS[id] || FALLBACK;
export const frameSize = () => FRAME;

export function setFpsCap(n) { FPS_CAP = Math.max(10, n | 0) || DEFAULT_FPS_CAP; }

let ANIM_DEBUG = false;
export function setAnimDebug(v) { ANIM_DEBUG = !!v; }
export function getAnimDebug() { return ANIM_DEBUG; }

const LIVE = [];
export function debugPause() { const a = LIVE[LIVE.length - 1]; if (a) { a.paused = !a.paused; a.dirty = true; } return !!a && a.paused; }
export function debugStep(d = 1) { LIVE.forEach((a) => a.step(d)); }

// ---- decoded-sheet cache (one decode per hero, shared by every canvas) ----
const cache = new Map();
function loadImage(src, allowFail = true) {
  const hit = cache.get(src);
  if (hit) return hit.ready ? Promise.resolve(hit.img) : hit.p;
  const entry = { img: null, ready: false, p: null };
  entry.p = new Promise((res) => {
    const Img = (typeof window !== 'undefined' && window.Image) || Image;
    const img = new Img();
    img.onload = () => { entry.img = img; entry.ready = true; res(img); };
    img.onerror = () => { entry.ready = true; res(allowFail ? null : img); };
    img.src = src;
  });
  cache.set(src, entry);
  return entry.p;
}
export const preloadHero = (heroId) => loadImage(`assets/anim/${heroId}.png`);
export const preloadImg = (src) => loadImage(src);
export function cachedImage(src) { const c = cache.get(src); return c && c.ready ? c.img : null; }

// ---- back-bling attachment (configured from catalog.json) ----
let BLING_META = {};
export function configureBling(map) { BLING_META = map || {}; }
const DEFAULT_ATTACH = { dx: 0, dy: 4, layer: 'behind', perHero: null };
export function blingMeta(id, heroId) {
  const base = { ...DEFAULT_ATTACH, ...(BLING_META[id] || {}) };
  const per = base.perHero && heroId ? base.perHero[heroId] : null;
  return per ? { ...base, ...per } : base;
}

// hero size class -> bake size for a bling of size class S/M/L
const BLING_PX = {
  S: { S: 16, M: 24, L: 32 },
  M: { S: 16, M: 24, L: 32 },
  L: { S: 24, M: 32, L: 32 },
};
export function blingPixels(heroSize, blingSize) {
  const row = BLING_PX[heroSize] || BLING_PX.M;
  return row[blingSize] || 24;
}
export const blingSrc = (id, n) => `assets/bling/${id}_${n}.png`;

// ---- the single global ticker ----
const TICK = { set: new Set(), raf: 0, last: 0 };
function tick(t) {
  TICK.raf = requestAnimationFrame(tick);
  const dt = Math.min(100, t - (TICK.last || t));   // clamp: no fast-forward after a stall
  TICK.last = t;
  for (const a of TICK.set) a._update(dt);
}
function wake() { if (!TICK.raf && typeof requestAnimationFrame !== 'undefined') TICK.raf = requestAnimationFrame(tick); }

export class Animator {
  /** @param canvas   a <canvas>
   *  @param scale    integer CSS px per sprite px
   *  @param opts     {crop:{x,y,w,h}} region of the frame to show */
  constructor(canvas, scale = 4, opts = {}) {
    this.cv = canvas;
    this.scale = Math.max(1, Math.round(scale));
    this.crop = opts.crop || null;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    this.ds = Math.max(1, Math.round(this.scale * dpr));   // device px per sprite px
    this.ctx = canvas.getContext && canvas.getContext('2d');
    if (!this.ctx) { this.dead = true; return; }
    this.ctx.imageSmoothingEnabled = false;
    this.applyCrop();

    this.img = null;
    this.hid = null;
    this.frames = 1;
    this.anim = 'idle';
    this.frame = 0;
    this.acc = 0;
    this.dead = false;
    this.paused = false;
    this.dirty = true;
    this.onEnd = null;
    this.visible = true;
    this.bling = null;
    this.blingImg = null;
    this.heroSize = 'M';

    if (typeof IntersectionObserver !== 'undefined') {
      this.io = new IntersectionObserver((es) => {
        const v = !!es[es.length - 1].isIntersecting;
        if (v && !this.visible) this.dirty = true;
        this.visible = v;
      }, { rootMargin: '80px' });
      this.io.observe(canvas);
    }
    TICK.set.add(this);
    LIVE.push(this);
    wake();
  }

  setCrop(crop) { this.crop = crop || null; this.applyCrop(); }
  applyCrop() {
    const c = this.crop;
    const w = c ? c.w : FRAME, h = c ? c.h : FRAME;
    this.boxW = w; this.boxH = h;
    this.cv.width = w * this.ds;
    this.cv.height = h * this.ds;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    this.cv.style.width = (w * this.ds / dpr) + 'px';
    this.cv.style.height = (h * this.ds / dpr) + 'px';
    if (this.ctx) this.ctx.imageSmoothingEnabled = false;
    this.dirty = true;
  }

  pack() { return animPack(this.hid); }
  anims() { return this.pack().anims || FALLBACK.anims; }
  table(name) { const a = this.anims(); return a[name] || a.idle || FALLBACK.anims.idle; }

  /** load a hero sheet (+ optional back bling) */
  load(heroId, opts = {}) {
    this.hid = heroId;
    this.heroSize = opts.heroSize || 'M';
    this.frames = this.pack().frames ? Object.values(this.pack().frames).reduce((s, n) => s + n, 0) : 16;
    const img = cachedImage(`assets/anim/${heroId}.png`);
    if (img) this._setImg(img);
    else preloadHero(heroId).then((i) => { if (!this.dead) this._setImg(i); });
    this.setBling(opts.bling || null, opts.blingSize || 'M');
  }

  _setImg(img) {
    if (!img) { this.missing = true; this.dirty = true; return; }
    this.missing = false;
    this.img = img;
    this.srcFrame = Math.round(img.height);
    this.srcFrames = Math.max(1, Math.round(img.width / img.height));
    this.dirty = true;
    this.cv.classList.add('ready');
  }

  setBling(id, blingSize = 'M') {
    this.bling = id || null;
    this.blingImg = null;
    if (!this.bling) { this.dirty = true; return; }
    const src = blingSrc(this.bling, blingPixels(this.heroSize, blingSize));
    const img = cachedImage(src);
    if (img) { this.blingImg = img; this.dirty = true; return; }
    preloadImg(src).then((i) => { if (!this.dead && i) { this.blingImg = i; this.dirty = true; } });
  }

  setAnim(a, onEnd) {
    if (onEnd !== undefined) this.onEnd = onEnd;
    const name = this.anims()[a] ? a : 'idle';
    if (this.anim !== name) { this.anim = name; this.frame = 0; this.acc = 0; this.dirty = true; }
  }

  step(d = 1) {
    const A = this.table(this.anim);
    this.frame = (this.frame + d + A.count) % A.count;
    this.dirty = true;
  }

  _update(dt) {
    if (this.dead || !this.visible) return;
    const A = this.table(this.anim);
    if (!this.paused && this.img) {
      const stepMs = Math.max(1000 / (A.fps || 6), 1000 / FPS_CAP);
      this.acc += dt;
      let steps = 0;
      while (this.acc >= stepMs && steps < 4) {
        this.acc -= stepMs;
        steps++;
        this.frame++;
        if (this.frame >= A.count) {
          if (A.loop) this.frame = 0;
          else {
            this.frame = A.count - 1;
            const cb = this.onEnd; this.onEnd = null;
            if (cb) cb(); else this.anim = 'idle';
            this.dirty = true;
          }
        }
      }
      if (this.acc > stepMs) this.acc = stepMs;
      this.dirty = true;
    }
    if (!this.dirty) return;
    this.dirty = false;
    this._draw();
  }

  _draw() {
    const c = this.ctx, S = this.ds;
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    if (!this.img) { if (ANIM_DEBUG) this._debug(); return; }
    const A = this.table(this.anim);
    const idx = A.start + Math.min(this.frame, A.count - 1);
    const src = Math.min(idx, this.srcFrames - 1) * this.srcFrame;
    const crop = this.crop || { x: 0, y: 0, w: FRAME, h: FRAME };

    // back bling behind the body, then the body, then front-layer bling
    if (this.blingImg) this._drawBling(false, crop, S);
    c.drawImage(this.img, src + crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w * S, crop.h * S);
    if (this.blingImg) this._drawBling(true, crop, S);
    if (ANIM_DEBUG) this._debug();
  }

  _drawBling(front, crop, S) {
    const m = blingMeta(this.bling, this.hid);
    if ((m.layer === 'front') !== front) return;
    const sway = [0, -1, 0, 1][this.frame % 4] | 0;
    const w = this.blingImg.width, h = this.blingImg.height;
    // anchor: middle of the hero's back, in FRAME coordinates (never CSS px)
    const anchorY = Math.round(FRAME * 0.34);
    const fx = Math.round((FRAME - w) / 2) + (m.dx | 0);
    const fy = anchorY - Math.round(h / 2) + (m.dy | 0) + sway;
    this.ctx.drawImage(this.blingImg, 0, 0, w, h,
      (fx - crop.x) * S, (fy - crop.y) * S, w * S, h * S);
  }

  _debug() {
    const c = this.ctx, S = this.ds, A = this.table(this.anim);
    c.strokeStyle = 'rgba(0,255,120,.9)'; c.lineWidth = Math.max(1, S * 0.4);
    c.beginPath(); c.moveTo(0, (this.boxH - 6) * S); c.lineTo(this.boxW * S, (this.boxH - 6) * S); c.stroke();
    c.fillStyle = '#7dffb0'; c.font = `${3 * S}px monospace`;
    c.fillText(`${this.hid || '-'} ${this.anim} f${this.frame}/${A.count} ${A.fps}fps ${this.srcFrame || '?'}px${this.paused ? ' ||' : ''}`, 1 * S, 5 * S);
  }

  destroy() {
    this.dead = true;
    TICK.set.delete(this);
    if (this.io) { this.io.disconnect(); this.io = null; }
    const i = LIVE.indexOf(this); if (i >= 0) LIVE.splice(i, 1);
  }
}

if (typeof window !== 'undefined') window.__ANIMS = { FALLBACK, PACKS: () => PACKS };
