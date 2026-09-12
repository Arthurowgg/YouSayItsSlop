// AnimationManager v6: one shared clock, many sprites.
//
// Architecture (replaces the v5 "one rAF loop per canvas" design, which ran
// 20+ independent loops in the shop grid and let them drift/jank):
//   * a single global ticker (one requestAnimationFrame) drives every live
//     Animator in registration order — no fighting loops, one FPS cap, one
//     place to pause/step for debugging;
//   * each canvas gets a device-pixel-correct backing store (integer device
//     scale), so pixels stay even on HiDPI / fractional-DPR screens and all
//     drawing is integer-only nearest-neighbour (crisp, no shimmer, no bleed);
//   * sprites whose canvas is off-screen are culled via IntersectionObserver
//     (they keep their state, they just don't draw);
//   * frame advance uses clamped time accumulation — returning from a
//     throttled/background tab can never fast-forward or jump frames;
//   * sheets are decoded once and cached; a re-render attaches them
//     synchronously, so UI updates never flash a blank canvas.
//
// Strip layout (78 frames of 48px): idle[0..3] walk[4..9] attack[10..13]
// power[14..17] + 10 emotes x 6 frames starting at 18, registered
// data-driven from catalog metadata (no per-emote hardcoded code).
export const FRAME = 48;
export const STRIP_FRAMES = 78;
export const ANIMS = {
  idle:   { start: 0,  count: 4, fps: 4,  loop: true },
  walk:   { start: 4,  count: 6, fps: 9,  loop: true },
  attack: { start: 10, count: 4, fps: 10, loop: false },
  power:  { start: 14, count: 4, fps: 8,  loop: false },
};

// generic emote system: entries come from catalog emote metadata.
export function initEmoteAnims(emotes) {
  for (const e of emotes || []) {
    const a = e.anim || {};
    ANIMS['e_' + String(e.id).replace('emote_', '')] = {
      start: a.start || 0,
      count: a.frames || 6,
      fps: a.fps || 9,
      loop: a.loop !== false,
    };
  }
  return ANIMS;
}

let FPS_CAP = 60;
export function setFpsCap(n) { FPS_CAP = Math.max(10, n | 0) || 60; }

let ANIM_DEBUG = false;
export function setAnimDebug(v) { ANIM_DEBUG = !!v; }
export function getAnimDebug() { return ANIM_DEBUG; }

// live registry powers the frame-step debugger (`,` pause / `.` step)
const LIVE = [];
export function debugPause() { const a = LIVE[LIVE.length - 1]; if (a) a.paused = !a.paused; if (a) a.dirty = true; return !!a && a.paused; }
export function debugStep(d = 1) { const a = LIVE[LIVE.length - 1]; if (a) a.step(d); }

// ---- asset preload + fallback registry ----
// Decoded sheets are cached so a re-render (UI update, tab switch, item
// change) attaches the Image synchronously: no blank frame, no load flicker.
const cache = new Map(); // id -> { img, ready, p }
export function preloadHero(id) {
  const c = cache.get(id);
  if (c) return c.ready ? Promise.resolve(c.img) : c.p;
  const entry = { img: null, ready: false, p: null };
  entry.p = new Promise((res) => {
    const Img = (typeof window !== 'undefined' && window.Image) ? window.Image : Image;
    const img = new Img();
    img.onload = () => { entry.img = img; entry.ready = true; res(img); };
    img.onerror = () => { entry.ready = true; res(null); }; // clean fallback: stay empty
    img.src = `assets/anim/${id}.png`;
  });
  cache.set(id, entry);
  return entry.p;
}

const GLIDER_OFF = {
  glider_wings: { dx: 0, dy: -2 }, glider_shield: { dx: -11, dy: 0 },
  glider_cosmic: { dx: 0, dy: -2 }, glider_claws: { dx: 10, dy: -4 },
  glider_portal: { dx: 0, dy: -3 }, glider_webwings: { dx: 0, dy: -2 },
  glider_storm: { dx: 0, dy: -4 }, glider_panther: { dx: 0, dy: -2 },
  glider_holo: { dx: -10, dy: -2 }, glider_valkyrie: { dx: 0, dy: -4 },
};

// ---- the single global ticker ----
const TICK = { set: new Set(), raf: 0, last: 0 };
function tick(t) {
  TICK.raf = requestAnimationFrame(tick);
  // clamp dt: after tab throttling we resume gently instead of fast-forwarding
  const dt = Math.min(100, t - (TICK.last || t));
  TICK.last = t;
  for (const a of TICK.set) a._update(dt);
}
function wake() { if (!TICK.raf && typeof requestAnimationFrame !== 'undefined') TICK.raf = requestAnimationFrame(tick); }

export class Animator {
  constructor(canvas, scale = 5) {
    this.cv = canvas;
    this.scale = scale;
    // device-pixel-correct integer backing store: even pixels on any DPR
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    this.ds = Math.max(1, Math.round(scale * dpr));
    canvas.width = FRAME * this.ds;
    canvas.height = FRAME * this.ds;
    canvas.style.width = FRAME * scale + 'px';
    canvas.style.height = FRAME * scale + 'px';
    this.ctx = canvas.getContext && canvas.getContext('2d');
    if (!this.ctx) { this.dead = true; return; } // no 2d context: stay inert
    this.ctx.imageSmoothingEnabled = false;

    this.img = null;
    this.gimg = null;
    this.gid = null;
    this.res = FRAME;
    this.frames = STRIP_FRAMES;
    this.anim = 'idle';
    this.frame = 0;
    this.acc = 0;
    this.dead = false;
    this.paused = false;
    this.dirty = true;   // draw once even before the animation advances
    this.onEnd = null;
    this.visible = true;

    // cull offscreen canvases: state keeps advancing nowhere, drawing stops
    if (typeof IntersectionObserver !== 'undefined') {
      this.io = new IntersectionObserver((es) => {
        const v = !!es[es.length - 1].isIntersecting;
        if (v && !this.visible) this.dirty = true;
        this.visible = v;
      });
      this.io.observe(canvas);
    }

    TICK.set.add(this);
    LIVE.push(this);
    wake();
  }

  applyImg(img, heroId) {
    if (!img) { this.missing = true; return; } // fallback: render nothing, no crash
    this.img = img;
    this.hid = heroId;
    this.res = img.height;
    this.frames = Math.max(1, Math.round(img.width / img.height));
    this.frame = 0;
    this.acc = 0;
    this.dirty = true;
    this.cv.classList.add('ready');
  }

  load(heroId, gliderId) {
    // synchronous when the sheet is already decoded — re-renders never flash
    const c = cache.get(heroId);
    if (c && c.ready) this.applyImg(c.img, heroId);
    else preloadHero(heroId).then((img) => { if (!this.dead) this.applyImg(img, heroId); });
    if (gliderId) {
      const g = cache.get('g:' + gliderId);
      if (g && g.ready) this.applyGlider(g.img, gliderId);
      else {
        const entry = { img: null, ready: false, p: null };
        entry.p = new Promise((res) => {
          const Img = (typeof window !== 'undefined' && window.Image) ? window.Image : Image;
          const img = new Img();
          img.onload = () => { entry.img = img; entry.ready = true; res(img); };
          img.onerror = () => { entry.ready = true; res(null); };
          img.src = `assets/spr/${gliderId}.png`;
        });
        cache.set('g:' + gliderId, entry);
        entry.p.then((img) => { if (!this.dead) this.applyGlider(img, gliderId); });
      }
    } else { this.gimg = null; this.gid = null; }
  }

  applyGlider(img, gliderId) {
    if (!img) return;
    this.gimg = img;
    this.gid = gliderId;
    this.gsingle = img.width === img.height;
    this.dirty = true;
  }

  setAnim(a, onEnd) {
    if (onEnd !== undefined) this.onEnd = onEnd;
    if (this.anim !== a) { this.anim = a; this.frame = 0; this.acc = 0; this.dirty = true; }
  }

  step(d = 1) {
    const A = ANIMS[this.anim] || ANIMS.idle;
    this.frame = (this.frame + d + A.count) % A.count;
    this.dirty = true; // redraw on next tick even while paused
  }

  _update(dt) {
    if (this.dead || !this.img || !this.visible) return;
    const A = ANIMS[this.anim] || ANIMS.idle;
    if (!this.paused) {
      const minMs = Math.max(1000 / A.fps, 1000 / FPS_CAP);
      this.acc += dt;
      let steps = 0;
      while (this.acc >= minMs && steps < 4) { // never spiral after a stall
        this.acc -= minMs;
        steps++;
        this.frame++;
        if (this.frame >= A.count) {
          if (A.loop) this.frame = 0;
          else {
            this.frame = A.count - 1;
            const cb = this.onEnd; this.onEnd = null;
            if (cb) cb(); else this.anim = 'idle'; // one-shots settle back to idle
          }
        }
      }
      if (this.acc > minMs) this.acc = minMs; // drop backlog
      this.dirty = true;
    }
    if (!this.dirty) return;
    this.dirty = false;
    this._draw();
  }

  _draw() {
    const c = this.ctx, S = this.ds;
    const W = this.cv.width, H = this.cv.height;
    c.clearRect(0, 0, W, H);
    const A = ANIMS[this.anim] || ANIMS.idle;
    const f = this.frame;
    // one source frame, drawn 1:1 on the integer grid: no transforms, no bleed
    const src = Math.min(A.start + f, this.frames - 1) * this.res;
    if (this.gimg) {
      const off = GLIDER_OFF[this.gid] || { dx: 0, dy: 0 };
      const sway = [0, -1, 0, 1][f % 4];
      if (this.gsingle) {
        c.drawImage(this.gimg, 0, 0, this.gimg.width, this.gimg.height,
          off.dx * S, (off.dy + sway) * S - 4 * S, FRAME * S, FRAME * S);
      } else {
        const gr = this.gimg.height, gw = Math.round(this.gimg.width / gr);
        const gf = gw > 1 ? (Math.floor(f / 2) % gw) : 0;
        c.drawImage(this.gimg, gf * gr, 0, gr, gr, off.dx * S, (off.dy + sway) * S, FRAME * S, FRAME * S);
      }
    }
    c.drawImage(this.img, src, 0, this.res, this.res, 0, 0, FRAME * S, FRAME * S);
    if (ANIM_DEBUG) {
      const u = S;
      c.strokeStyle = 'rgba(0,255,120,.9)'; c.lineWidth = Math.max(1, u * 0.4);
      c.beginPath(); c.moveTo(0, 44 * u); c.lineTo(48 * u, 44 * u); c.stroke();
      c.strokeStyle = 'rgba(255,80,80,.9)'; c.strokeRect(6 * u, 2 * u, 36 * u, 42 * u);
      c.fillStyle = '#7dffb0'; c.font = `${3 * u}px monospace`;
      c.fillText(`${this.anim} f${f}/${A.count} ${A.fps}fps src${src / this.res} ${this.res}px${this.paused ? ' ||' : ''}`, 1 * u, 5 * u);
    }
  }

  destroy() {
    this.dead = true;
    TICK.set.delete(this);
    if (this.io) { this.io.disconnect(); this.io = null; }
    const i = LIVE.indexOf(this); if (i >= 0) LIVE.splice(i, 1);
  }
}

if (typeof window !== 'undefined') window.__ANIMS = ANIMS; // debug/validation hook
