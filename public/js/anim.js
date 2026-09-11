// Tiny sprite-strip animator for in-game hero sprites (24x24 frames).
export const ANIMS = {
  idle:   { start: 0, count: 2, fps: 3 },
  walk:   { start: 2, count: 4, fps: 6 },
  attack: { start: 6, count: 3, fps: 6 },
  power:  { start: 9, count: 3, fps: 5 },
};

export class Animator {
  constructor(canvas, scale = 7) {
    this.cv = canvas;
    this.scale = scale;
    this.ctx = canvas.getContext('2d');
    canvas.width = 24 * scale;
    canvas.height = 24 * scale;
    this.img = null;
    this.anim = 'idle';
    this.frame = 0;
    this.last = 0;
    this.raf = 0;
    this.dead = false;
  }
  load(heroId) {
    const Img = (typeof window !== 'undefined' && window.Image) ? window.Image : Image;
    const img = new Img();
    img.onload = () => {
      if (this.dead) return;
      this.img = img;
      this.frame = 0;
      if (!this.raf) this.raf = requestAnimationFrame((t) => this.loop(t));
    };
    img.src = `assets/anim/${heroId}.png`;
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
    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    c.drawImage(this.img, (A.start + this.frame) * 24, 0, 24, 24, 0, 0, 24 * this.scale, 24 * this.scale);
  }
  destroy() { this.dead = true; if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.raf); this.raf = 0; }
}
