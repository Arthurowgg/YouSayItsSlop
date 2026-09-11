// Tiny DOM + misc helpers.
export function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') n.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (v === true) n.setAttribute(k, '');
    else if (v !== false && v !== null && v !== undefined) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

export const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = (arr) => arr[rnd(0, arr.length - 1)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const fmt = (n) => Number(n).toLocaleString('en-US');

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
export function weekKey() {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-w${week}`;
}

// Procedural pixel coin (fallback until coin.png exists / for tiny sizes).
export function coinDataURL(size = 20) {
  const c = document.createElement('canvas');
  c.width = c.height = 10;
  const g = c.getContext('2d');
  const P = [
    '..GGGG..',
    '.GYYYG.',
    'GYWWYYG',
    'GYWYYYG',
    'GYYYYYG',
    'GYYYYGG',
    'GYYYYGG',
    '.GYGGG.',
    '..GGGG..',
  ];
  const col = { G: '#8a5a00', Y: '#ffd23c', W: '#fff3b0' };
  P.forEach((row, y) => [...row].forEach((ch, x) => {
    if (col[ch]) { g.fillStyle = col[ch]; g.fillRect(x, y, 1, 1); }
  }));
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const o = out.getContext('2d');
  o.imageSmoothingEnabled = false;
  o.drawImage(c, 0, 0, 10, 10, 0, 0, size, size);
  return out.toDataURL();
}
