// AnimationManager v5: 100% frame-based playback of procedural 48px strips.
// Strip layout (78 frames): idle[0..3] walk[4..9] attack[10..13] power[14..17]
// + 10 emotes x 6 frames starting at 18 (registered data-driven from catalog).
// v5 fixes the flicker: no runtime rotation/scaling transforms (sub-pixel
// scaling was shimmering the pixel grid), integer-only drawing, one rAF loop
// per canvas, single source frame per tick, no baked-FX double rendering.
export const FRAME = 48;
export const STRIP_FRAMES = 78;
export const ANIMS = {
  idle:   { start: 0,  count: 4, fps: 4,  loop: true },
  walk:   { start: 4,  count: 6, fps: 9,  loop: true },
  attack: { start: 10, count: 4, fps: 10, loop: false },
  power:  { start: 14, count: 4, fps: 8,  loop: false },
};

// generic emote system: animation entries come from catalog emote metadata
// (start/count/fps/loop per emote) instead of per-emote hardcoded code.
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
export function debugPause() { const a = LIVE[LIVE.length - 1]; if (a) a.paused = !a.paused; return !!a && a.paused; }
export function debugStep(d = 1) { const a = LIVE[LIVE.length - 1]; if (a) a.step(d); }

// ---- asset preload + fallback registry ----
// Decoded sheets are cached so a re-render (UI update, tab switch, item change)
// attaches the Image synchronously: no blank canvas frame, no load flicker.
const cache = new Map(); // id -> { img, ready, p }
const ASSET_V = 16; // bump on asset rebakes to defeat stale caches
export function preloadHero(id) {
  const c = cache.get(id);
  if (c) return c.ready ? Promise.resolve(c.img) : c.p;
  const entry = { img: null, ready: false, p: null };
  entry.p = new Promise((res) => {
    const Img = (typeof window !== 'undefined' && window.Image) ? window.Image : Image;
    const img = new Img();
    img.onload = () => { entry.img = img; entry.ready = true; res(img); };
    img.onerror = () => { entry.ready = true; res(null); }; // clean fallback: stay empty
    img.src = `assets/anim/${id}.png?v=${ASSET_V}`;
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

export class Animator {
  constructor(canvas, scale = 5) {
    this.cv = canvas;
    this.scale = scale;
    this.q = 1; // native-res source; integer display scale => crisp pixels
    canvas.width = FRAME * scale * this.q;
    canvas.height = FRAME * scale * this.q;
    canvas.style.width = FRAME * scale + 'px';
    canvas.style.height = FRAME * scale + 'px';
    this.ctx = canvas.getContext && canvas.getContext('2d');
    if (!this.ctx) { this.dead = true; return; } // no 2d context: stay inert, never throw
    this.img = null;
    this.gimg = null;
    this.gid = null;
    this.res = FRAME;
    this.frames = STRIP_FRAMES;
    this.anim = 'idle';
    this.frame = 0;
    this.last = 0;
    this.raf = 0;
    this.dead = false;
    this.paused = false;
    this.onEnd = null;
    LIVE.push(this);
  }
  applyImg(img, heroId) {
    if (!img) { this.missing = true; return; } // fallback: render nothing, no crash
    this.img = img;
    this.hid = heroId;
    this.res = img.height;
    this.frames = Math.max(1, Math.round(img.width / img.height));
    this.frame = 0;
    this.cv.classList.add('ready');
    if (!this.raf) this.raf = requestAnimationFrame((t) => this.loop(t));
  }
  load(heroId, gliderId) {
    // synchronous when the sheet is already decoded — re-renders never flash
    const c = cache.get(heroId);
    if (c && c.ready) this.applyImg(c.img, heroId);
    else preloadHero(heroId).then((img) => { if (!this.dead) this.applyImg(img, heroId); });
    if (gliderId) {
      const Img = (typeof window !== 'undefined' && window.Image) ? window.Image : Image;
      const g = new Img();
      g.onload = () => { if (!this.dead) { this.gimg = g; this.gid = gliderId; this.gsingle = g.width === g.height; } };
      g.src = `assets/spr/${gliderId}.png?v=${ASSET_V}`;
    } else { this.gimg = null; this.gid = null; }
  }
  setAnim(a, onEnd) {
    if (onEnd !== undefined) this.onEnd = onEnd;
    if (this.anim !== a) { this.anim = a; this.frame = 0; this.last = 0; }
  }
  step(d = 1) {
    const A = ANIMS[this.anim] || ANIMS.idle;
    this.frame = (this.frame + d + A.count) % A.count;
    this.last = 0; // redraw on next rAF
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
    if (!this.paused && t - this.last >= minMs) {
      this.last = t;
      this.frame++;
      if (this.frame >= A.count) {
        if (A.loop) this.frame = 0;
        else {
          this.frame = A.count - 1;
          const cb = this.onEnd; this.onEnd = null;
          if (cb) cb(); else this.anim = 'idle'; // one-shots settle back to idle
          return;
        }
      }
    }
    const f = this.frame;
    // one source frame, drawn 1:1 on the integer grid: no transforms, no bleed
    const src = Math.min(A.start + f, this.frames - 1);
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
    c.drawImage(this.img, src * this.res, 0, this.res, this.res, 0, 0, FRAME * S, FRAME * S);
    if (ANIM_DEBUG) {
      const u = S;
      c.strokeStyle = 'rgba(0,255,120,.9)'; c.lineWidth = Math.max(1, u * 0.4);
      c.beginPath(); c.moveTo(0, 44 * u); c.lineTo(48 * u, 44 * u); c.stroke();
      c.strokeStyle = 'rgba(255,80,80,.9)'; c.strokeRect(6 * u, 2 * u, 36 * u, 42 * u);
      c.fillStyle = '#7dffb0'; c.font = `${3 * u}px monospace`;
      c.fillText(`${this.anim} f${f}/${A.count} ${A.fps}fps src${src} ${this.res}px${this.paused ? ' ||' : ''}`, 1 * u, 5 * u);
    }
  }
  destroy() {
    this.dead = true;
    if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.raf);
    this.raf = 0;
    const i = LIVE.indexOf(this); if (i >= 0) LIVE.splice(i, 1);
  }
}

if (typeof window !== 'undefined') window.__ANIMS = ANIMS; // debug/validation hook
