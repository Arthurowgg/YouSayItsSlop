// Ambient pixel motes (lightweight) + tiny WebAudio 8-bit sfx.
let ctx = null;
let muted = false;
let particlesOn = true;
let volMul = 1;
let hoverOn = true;

export function toggleMute() { muted = !muted; return muted; }
export function isMuted() { return muted; }
export function setParticlesEnabled(on) { particlesOn = !!on; }
export function setVolume(v) { volMul = Math.max(0, Math.min(1, v)); }
export function setHoverEnabled(v) { hoverOn = !!v; }

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function blip(freq, dur = 0.07, type = 'square', vol = 0.04, when = 0) {
  if (muted || volMul <= 0) return;
  vol *= volMul;
  try {
    const a = ac();
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, a.currentTime + when);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + when + dur);
    o.connect(g).connect(a.destination);
    o.start(a.currentTime + when);
    o.stop(a.currentTime + when + dur + 0.02);
  } catch {}
}

export const sfx = {
  hover: () => { if (hoverOn) blip(720, 0.03, 'square', 0.015); },
  click: () => { blip(520, 0.05); blip(780, 0.06, 'square', 0.03, 0.05); },
  tab: () => { blip(400, 0.05); blip(600, 0.05, 'square', 0.03, 0.06); blip(900, 0.07, 'square', 0.03, 0.12); },
  buy: () => [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.09, 'square', 0.04, i * 0.07)),
  deny: () => { blip(180, 0.12, 'sawtooth', 0.05); blip(140, 0.16, 'sawtooth', 0.05, 0.1); },
  claim: () => [660, 880, 1320].forEach((f, i) => blip(f, 0.08, 'triangle', 0.05, i * 0.06)),
  equip: () => { blip(300, 0.06, 'triangle', 0.05); blip(450, 0.08, 'triangle', 0.05, 0.07); },
  levelup: () => [392, 523, 659, 784, 1046, 1318].forEach((f, i) => blip(f, 0.1, 'square', 0.04, i * 0.08)),
  launch: () => { blip(200, 0.2, 'sawtooth', 0.05); blip(400, 0.2, 'sawtooth', 0.04, 0.15); blip(800, 0.3, 'square', 0.04, 0.3); },
  tick: () => blip(1000, 0.04, 'square', 0.04),
};

// ---- floating pixel motes: 20 particles @ ~30fps, no shadows ----
export function startParticles() {
  const cv = document.getElementById('fx');
  const g = cv.getContext('2d');
  let W, H;
  const resize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };
  resize();
  addEventListener('resize', resize);
  const cols = ['#35e0ff', '#ffd23c', '#ff3d5a', '#7dffb0'];
  const ps = Array.from({ length: 20 }, () => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    s: 2 + Math.floor(Math.random() * 2) * 2,
    v: 0.3 + Math.random() * 0.6,
    c: cols[Math.floor(Math.random() * cols.length)],
  }));
  let last = 0, skip = 0;
  (function loop(t) {
    requestAnimationFrame(loop);
    if (t - last < 33) return; // ~30fps
    last = t;
    g.clearRect(0, 0, W, H);
    if (!particlesOn) return;
    skip ^= 1;
    for (const p of ps) {
      p.y -= p.v;
      if (p.y < -6) { p.y = H + 6; p.x = Math.random() * W; }
      g.globalAlpha = 0.4;
      g.fillStyle = p.c;
      g.fillRect(p.x | 0, p.y | 0, p.s, p.s);
    }
    g.globalAlpha = 1;
  })(0);
}

export function confetti(n = 60) {
  const cols = ['#ffd23c', '#35e0ff', '#ff3d5a', '#7dffb0', '#c65cff', '#ffffff'];
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'confetti';
    d.style.left = Math.random() * 100 + 'vw';
    d.background = cols[i % cols.length];
    d.style.background = cols[i % cols.length];
    d.style.animationDuration = 0.9 + Math.random() * 1.2 + 's';
    d.style.animationDelay = Math.random() * 0.3 + 's';
    document.body.append(d);
    setTimeout(() => d.remove(), 2600);
  }
}
