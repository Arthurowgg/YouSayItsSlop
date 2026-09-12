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
    if (t - this.last < 1000 / A.fps) return;
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
  }
  destroy() { this.dead = true; if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.raf); this.raf = 0; }
}
