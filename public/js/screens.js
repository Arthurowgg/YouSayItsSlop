// Screens v4: lobby cinematic, shop by category (scroll-snap), locker, tasks.
import { el, fmt, pick, coinDataURL } from './util.js';
import { store } from './store.js';
import { sfx, confetti } from './fx.js';
import { deployMatch } from './match.js';
import { Animator, preloadHero, blingMeta } from './anim.js';
import { bus } from './bus.js';

const C = () => store.catalog;
const CB = { common: '#9aa7b8', uncommon: '#0f8ff5', rare: '#00c8e0', epic: '#b060ff', legendary: '#ff9a00', marvel: '#ff5fa2' };
const rar = (r) => {
  const base = C().rarities[r] || { label: r, color: '#fff' };
  return store.data.settings.colorblind ? { label: base.label, color: CB[r] || base.color } : base;
};

let anim = null;
let liveAnims = [];
function killAnim() { if (anim) { anim.destroy(); anim = null; } liveAnims.forEach((a) => a.destroy()); liveAnims = []; }

export function toast() { /* notificações removidas */ }

export function modal(node) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = '';
  const back = el('div', { class: 'backdrop', onclick: close });
  const m = el('div', { class: 'modal pixelbox' }, node);
  root.append(back, m);
  function close() { root.innerHTML = ''; }
  return { close, node: m };
}

const heroOf = () => C().heroes.find((h) => h.id === store.data.equipped.hero) || C().heroes[0];
const gliderOf = () => store.data.equipped.glider;

function priceTag(n) {
  return el('span', { class: 'price' }, el('img', { src: coinDataURL(12), class: 'pixel', alt: '' }), fmt(n));
}
// "obtido" overrides the price: owned items show a check badge, never a price
function priceOrOwned(type, it) {
  return store.owns(type, it.id) ? el('span', { class: 'ownBadge' }, '✓') : priceTag(it.price);
}
// skin -> base hero: skins are alternate looks of the hero, so they share
// the base hero's stat block (and the base is never listed as a skin)
function familyOfHero(hid) {
  const fams = (C().shopCats || []).map((c) => c.families || []).flat();
  return fams.find((f) => f.hero === hid || (f.skins || []).includes(hid));
}
const baseIdOf = (hid) => { const f = familyOfHero(hid); return f ? f.hero : hid; }
const skinsOf = (hid) => { const f = familyOfHero(hid); return f ? (f.skins || []) : []; }

function statBars(id) {
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  const v = (s) => 3 + ((h >> s) % 8);
  return el('div', { class: 'statbars' },
    [['POWER', v(1)], ['SPEED', v(3)], ['UTILITY', v(5)]].map(([label, n]) =>
      el('div', { class: 'sbar' },
        el('span', {}, label),
        el('div', { class: 'track' }, el('i', { style: { width: `${n * 10}%` } })))));
}

function animChips(stageEl) {
  const chips = el('div', { class: 'animChips' });
  [['idle', 'PARADO'], ['walk', 'ANDAR'], ['attack', 'ATACAR'], ['ability', 'ESPECIAL']].forEach(([id, label], i) => {
    chips.append(el('button', {
      class: `chip ${i === 0 ? 'sel' : ''}`,
      onclick: (e) => {
        sfx.click();
        if (anim) anim.setAnim(id);
        chips.querySelectorAll('.chip').forEach((c) => c.classList.remove('sel'));
        e.currentTarget.classList.add('sel');
      }
    }, label));
  });
  (stageEl || chips).append(chips);
  return chips;
}

/* ------------------------------ PLAY: cinematic mode select ------------------------------ */
let lastModeId = 'mode_1v1';
export function renderPlay() {
  killAnim();
  const modes = C().modes, maps = C().maps;
  let mode = modes.find((m) => m.id === lastModeId) || modes[0];
  let map = maps.find((m) => m.id === store.data.lastMap) || pick(maps);
  store.data.lastMap = map.id;
  const sceneMap = () => (mode.available ? map : (maps.find((m) => m.id === mode.map) || maps[0]));

  const glow = el('div', { class: 'p2modeglow' });
  const emblem = el('img', { class: 'p2emblem pixel', src: mode.tile, alt: '' });

  const pix = el('div', { class: 'p2pix' });
  for (let i = 0; i < 14; i++) pix.append(el('span', {
    style: {
      left: `${(i * 37 + 13) % 100}%`,
      top: `${(i * 53 + 29) % 92}%`,
      animationDelay: `${((i * 0.83) % 6).toFixed(2)}s`,
      animationDuration: `${(6 + (i % 5) * 1.6).toFixed(2)}s`,
    }
  }));

  const head = el('div', { class: 'p2head' },
    el('div', { class: 'p2kick' }, 'TEMPORADA 1 · NOITE DE NÉON'),
    el('h2', { class: 'p2title' }, 'ESCOLHA SEU MODO'),
    el('div', { class: 'p2stats' },
      el('span', { class: 'chip' }, `PARTIDAS ${store.data.stats.matches}`),
      el('span', { class: 'chip' }, `VITÓRIAS ${store.data.stats.wins}`)));

  const list = el('div', { class: 'p2modes' });
  const dName = el('div', { class: 'p2dn' });
  const dDesc = el('div', { class: 'p2dd' });
  const dChips = el('div', { class: 'p2chips' });
  const playBtn = el('button', { class: 'p2play' });

  let root = null;
  function draw() {
    const sm = sceneMap();
    emblem.src = mode.tile;
    if (root) root.dataset.mode = mode.id;
    list.innerHTML = '';
    modes.forEach((m) => {
      const ms = maps.find((x) => x.id === (m.available ? map.id : m.map)) || maps[0];
      list.append(el('button', {
        class: `p2card ${m.id === mode.id ? 'sel' : ''} ${m.available ? '' : 'locked'}`,
        onclick: () => { sfx.equip(); mode = m; lastModeId = m.id; draw(); },
      },
        el('div', { class: 'p2art' },
          el('div', { class: 'p2scene', style: { backgroundImage: `url('${ms.art}')` } }),
          el('img', { class: 'p2tile', src: m.tile, alt: '' })),
        el('div', { class: 'p2txt' },
          el('div', { class: 'p2nm' }, m.name),
          el('div', { class: 'p2ds' }, m.desc),
          el('div', { class: 'p2meta' },
            el('span', {}, `${m.players} JOGADORES`),
            el('span', {}, `x${m.mult} MOEDAS`))),
        el('span', { class: m.available ? 'p2ok' : 'p2soon' }, m.available ? 'DISPONÍVEL' : 'EM BREVE')));
    });
    dName.textContent = mode.name;
    dDesc.textContent = mode.desc;
    dChips.innerHTML = '';
    dChips.append(
      el('span', { class: 'p2chip' }, `${mode.players} JOGADORES`),
      el('span', { class: 'p2chip gold' }, `x${mode.mult} MOEDAS`));
    if (mode.available) dChips.append(el('button', {
      class: 'p2chip p2map',
      onclick: () => { sfx.click(); map = pick(maps); store.data.lastMap = map.id; store.persist(); draw(); },
    }, el('img', { class: 'pixel', src: sm.art, alt: '' }), el('span', { class: 'rn' }, `${sm.name} · TROCAR`)));
    playBtn.innerHTML = '';
    playBtn.disabled = !mode.available;
    playBtn.append(
      el('span', { class: 'p2pmain' }, mode.available ? 'JOGAR' : 'EM BREVE'),
      el('span', { class: 'p2psub' }, mode.available ? `${mode.name} · ENTRAR NA FILA` : `${mode.name} CHEGA NA PRÓXIMA TEMPORADA`));
  }

  playBtn.onclick = () => {
    if (!mode.available) { sfx.deny(); playBtn.classList.remove('shake'); void playBtn.offsetWidth; playBtn.classList.add('shake'); return; }
    sfx.launch(); deployMatch(mode);
  };

  root = el('div', { class: 'play2 in-play' },
    el('div', { class: 'p2sky' }),
    el('div', { class: 'p2stars' }),
    el('div', { class: 'p2skyline' }),
    glow,
    el('div', { class: 'p2fog a' }), el('div', { class: 'p2fog b' }),
    pix,
    emblem,
    el('div', { class: 'p2shade' }),
    head,
    list,
    el('div', { class: 'p2hud' },
      el('div', { class: 'p2detail' }, dName, dDesc, dChips),
      playBtn));
  draw();
  return root;
}

/* ------------------------------ SHOP v3: categories, scroll-snap ------------------------------ */
let shopSel = null; // null | {kind:'item',type,id} | {kind:'bundle',id}
export function shopHome() { shopSel = null; }
export function renderShop() {
  killAnim();
  if (shopSel) return shopSel.kind === 'bundle' ? bundlePage(shopSel.id) : itemPage(shopSel.type, shopSel.id);
  return shopCats();
}

const portraitOf = (id) => `assets/spr/${id}.png`;

/* live hero canvas, optionally wearing a back bling (drawn on the sprite) */
function liveHeroCanvas(id, scale, gliderId) {
  const cv = el('canvas', { class: 'pixel cardAnim' });
  const a = new Animator(cv, scale);
  a.load(id, gliderId || null);
  liveAnims.push(a);
  return cv;
}

/* static composite: back bling riding behind a hero frame, integer-upscaled */
const gcache = new Map();
function gliderImg(id) {
  const c = gcache.get(id);
  if (c) return c;
  const p = new Promise((res) => {
    const Img = (typeof window !== 'undefined' && window.Image) ? window.Image : Image;
    const img = new Img();
    img.onload = () => res(img);
    img.onerror = () => {
      const fb = new Img();
      fb.onload = () => res(fb);
      fb.onerror = () => res(null);
      fb.src = `assets/spr/${id}.png`;
    };
    img.src = `assets/anim/${id}.png`;
  });
  gcache.set(id, p);
  return p;
}
function blingCanvas(heroId, gliderId, S) {
  const cv = el('canvas', { class: 'pixel' });
  cv.width = 48 * S; cv.height = 48 * S;
  cv.style.width = 48 * S + 'px'; cv.style.height = 48 * S + 'px';
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  Promise.all([preloadHero(heroId), gliderImg(gliderId)]).then(([h, g]) => {
    if (g && g.width <= 40) {
      const off = blingMeta(gliderId);
      const gw = g.width, gh = g.height;
      ctx.drawImage(g, 0, 0, gw, gh,
        Math.round((48 - gw) / 2 + off.dx) * S, off.dy * S, gw * S, gh * S);
    } else if (g) {
      ctx.drawImage(g, 0, 0, g.width, g.height, 0, 0, 48 * S, 48 * S);
    }
    if (h) ctx.drawImage(h, 0, 0, 48, 48, 0, 0, 48 * S, 48 * S);
  });
  return cv;
}

/* tight crop: show only the character area of the 48px frame (no dead air) */
function cropWrap(canvas, S, w = 36, h = 44, x = 6, y = 4) {
  const box = el('div', { class: 'crop' });
  box.style.width = w * S + 'px';
  box.style.height = h * S + 'px';
  canvas.style.marginLeft = -x * S + 'px';
  canvas.style.marginTop = -y * S + 'px';
  box.append(canvas);
  return box;
}

function miniIcon(id) {
  const f = store.findItem(id);
  if (!f) return null;
  const src = f.type === 'hero' ? portraitOf(f.item.id) : f.item.art;
  return el('span', { class: `miniIco ${f.type === 'hero' ? 'h' : ''}`, style: { '--rc': rar(f.item.rarity).color }, title: f.item.name },
    el('img', { class: 'pixel', src, alt: '' }));
}

/* ---- category cards ---- */
function heroCard3(h, S, skin) {
  const Rr = rar(h.rarity);
  return el('button', {
    class: `s3card hero ${skin ? 'skin' : ''} r-${h.rarity} ${store.owns('hero', h.id) ? 'owned' : ''}`,
    style: { '--rc': Rr.color },
    onclick: () => { sfx.click(); shopSel = { kind: 'item', type: 'hero', id: h.id }; bus.refresh(); },
  },
    el('div', { class: 'c3art' },
      cropWrap(liveHeroCanvas(h.id, S), S),
      skin ? el('span', { class: 'skinTag' }, 'SKIN') : null),
    el('div', { class: 'c3bar' },
      el('span', { class: 'c3nm', title: h.name }, h.name),
      priceOrOwned('hero', h)));
}
function blingCard3(g, heroId) {
  const Rr = rar(g.rarity);
  return el('button', {
    class: `s3card gear r-${g.rarity} ${store.owns('glider', g.id) ? 'owned' : ''}`,
    style: { '--rc': Rr.color },
    onclick: () => { sfx.click(); shopSel = { kind: 'item', type: 'glider', id: g.id }; bus.refresh(); },
  },
    el('div', { class: 'c3art' }, cropWrap(blingCanvas(heroId, g.id, 2), 2, 40, 44, 4, 4)),
    el('div', { class: 'c3bar' },
      el('span', { class: 'c3nm', title: g.name }, g.name),
      priceOrOwned('glider', g)));
}
function pickCard3(p) {
  const Rr = rar(p.rarity);
  return el('button', {
    class: `s3card gear r-${p.rarity} ${store.owns('pick', p.id) ? 'owned' : ''}`,
    style: { '--rc': Rr.color },
    onclick: () => { sfx.click(); shopSel = { kind: 'item', type: 'pick', id: p.id }; bus.refresh(); },
  },
    el('div', { class: 'c3art pick' }, el('img', { class: 'pixel pIco', src: p.art, alt: p.name })),
    el('div', { class: 'c3bar' },
      el('span', { class: 'c3nm', title: p.name }, p.name),
      priceOrOwned('pick', p)));
}
function bundleCard3(b, heroId, gliderId) {
  const Rr = rar(b.rarity);
  const value = b.items.reduce((s, id) => { const f = store.findItem(id); return s + (f ? f.item.price : 0); }, 0);
  return el('button', {
    class: `s3card bundle r-${b.rarity}`,
    style: { '--rc': Rr.color },
    onclick: () => { sfx.click(); shopSel = { kind: 'bundle', id: b.id }; bus.refresh(); },
  },
    el('div', { class: 'cbArt' }, cropWrap(liveHeroCanvas(heroId, 4, gliderId), 4, 40, 44, 4, 4)),
    el('div', { class: 'cbInfo' },
      el('span', { class: 'cbKick' }, '★ PACOTE'),
      el('span', { class: 'cbName' }, b.name),
      el('div', { class: 'cbMinis' }, b.items.map((id) => miniIcon(id))),
      el('div', { class: 'cbPrice' }, priceTag(b.price),
        el('span', { class: 'savePill' }, `-${Math.round((1 - b.price / value) * 100)}%`))));
}

/* ---- the scroll-snap category view ---- */
function shopCats() {
  const cats = C().shopCats || [];
  const wrap = el('div', { class: 'shop3wrap in-shop' });
  const scroller = el('div', { class: 'shop3 scroll' });
  const dots = el('nav', { class: 'catDots', 'aria-label': 'categorias' });

  cats.forEach((cat, ci) => {
    const b = C().bundles.find((x) => x.id === cat.bundle);
    const fams = cat.families || [];
    const firstHero = fams[0] ? fams[0].hero : heroOf().id;
    const itemCount = fams.reduce((s, f) => s + 1 + f.skins.length, 0) + cat.gliders.length + cat.picks.length + (b ? 1 : 0);

    const sec = el('section', { class: 'shopSec', id: `cat-${cat.id}`, style: { '--rc': b ? rar(b.rarity).color : 'var(--cyan)' } },
      el('header', { class: 'catHead' },
        el('div', { class: 'catTit' },
          el('span', { class: 'catKick' }, `CATEGORIA ${ci + 1}/${cats.length}`),
          el('h2', { class: 'catName' }, cat.name),
          el('span', { class: 'catTag' }, cat.tag || '')),
        el('span', { class: 'catCount' }, `${itemCount} ITENS`)));

    const group = (label, node) => el('div', { class: 'catGrp' },
      el('span', { class: 'grpLbl' }, label), node);

    if (b) {
      sec.append(group('PACOTE', el('div', { class: 'catBundle' }, bundleCard3(b, firstHero, null))));
    }
    const blings = el('div', { class: 'catBlings' });
    cat.gliders.forEach((gid) => { const g = C().gliders.find((x) => x.id === gid); if (g) blings.append(blingCard3(g, heroOf().id)); });
    sec.append(group('BACK BLINGS', blings));

    const famRow = el('div', { class: 'catFams' });
    fams.forEach((f) => {
      const h = C().heroes.find((x) => x.id === f.hero);
      if (!h) return;
      const box = el('div', { class: 'famBox' }, heroCard3(h, 3, false));
      if (f.skins && f.skins.length) {
        const sr = el('div', { class: 'skinRow' });
        f.skins.forEach((sid) => { const sk = C().heroes.find((x) => x.id === sid); if (sk) sr.append(heroCard3(sk, 2, true)); });
        box.append(sr);
      }
      famRow.append(box);
    });
    sec.append(group('HERÓIS', famRow));

    if (cat.picks && cat.picks.length) {
      const pr = el('div', { class: 'catPicks' });
      cat.picks.forEach((pid) => { const p = C().picks.find((x) => x.id === pid); if (p) pr.append(pickCard3(p)); });
      sec.append(group('RELÍQUIAS', pr));
    }

    scroller.append(sec);
    dots.append(el('button', {
      class: 'catDot', title: cat.name, 'data-i': ci,
      onclick: () => { sfx.tab(); sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
    }, el('span', {}, cat.name)));
  });

  // highlight the dot of the section currently snapped in view
  if (typeof IntersectionObserver === 'undefined') { wrap.append(scroller, dots); return wrap; }
  const io = new IntersectionObserver((ents) => {
    ents.forEach((e) => {
      if (!e.isIntersecting) return;
      const i = cats.findIndex((c) => `cat-${c.id}` === e.target.id);
      dots.querySelectorAll('.catDot').forEach((d, di) => d.classList.toggle('sel', di === i));
    });
  }, { root: scroller, threshold: 0.6 });
  scroller.querySelectorAll('.shopSec').forEach((s) => io.observe(s));

  wrap.append(scroller, dots);
  return wrap;
}

/* ---- selected-item showcase ---- */
function showcase(type, it) {
  const Rr = rar(it.rarity);
  const box = el('div', { class: 'show2', style: { '--rc': Rr.color } },
    el('div', { class: 'shAura' }), el('div', { class: 'shRays' }),
    el('div', { class: 'shPix p1' }), el('div', { class: 'shPix p2' }), el('div', { class: 'shPix p3' }));
  if (type === 'hero') {
    const cv = el('canvas', { class: 'hero pixel' });
    box.append(el('div', { class: 'shStage' }, cv, el('div', { class: 'shShadow', style: { '--rc': Rr.color } }), el('div', { class: 'shPlatform' })));
    anim = new Animator(cv, 7);
    anim.load(it.id, gliderOf());
    box.append(animChips(box));
  } else if (type === 'glider') {
    // the bling rides on the equipped hero: accessory over the sprite
    const cv = el('canvas', { class: 'hero pixel' });
    box.append(el('div', { class: 'shStage' }, cv, el('div', { class: 'shShadow', style: { '--rc': Rr.color } }), el('div', { class: 'shPlatform' })));
    anim = new Animator(cv, 7);
    anim.load(heroOf().id, it.id);
    box.append(animChips(box));
  } else {
    box.append(el('div', { class: 'shStage gear' },
      el('span', { class: 'shSpot' }),
      el('img', { class: 'pixel shItem', src: it.art, alt: it.name }),
      el('div', { class: 'shShadow', style: { '--rc': Rr.color } }), el('div', { class: 'shPlatform' })));
  }
  return box;
}

function itemPage(type, id) {
  const f = store.findItem(id);
  const it = f.item;
  const Rr = rar(it.rarity);
  const owned = store.owns(type, id);

  const details = el('div', { class: 'col det2' },
    el('h2', { class: 'itemName' }, it.name),
    el('p', { class: 'itemDesc' }, it.desc),
    type === 'hero' ? el('p', { class: 'itemQuote' }, `“${it.quote || ''}”`) : null,
    type === 'hero' ? statBars(baseIdOf(id)) : null,
    el('div', { class: 'priceLine' }, owned ? el('span', { class: 'ownBadge big' }, '✓ OBTIDO') : priceTag(it.price)),
    el('div', { class: 'actions' }, buyButton(type, id, it.price)));

  return el('div', { class: 'page2 in-page', style: { '--rc': Rr.color } },
    el('div', { class: 'pageHead' },
      el('button', { class: 'btn ghost', onclick: () => { sfx.click(); shopSel = null; bus.refresh(); } }, '◂ VOLTAR'),
      el('div', { class: 'panelTitle' }, 'LOJA DE ITENS')),
    el('div', { class: 'cols2' }, showcase(type, it), details));
}

function bundlePage(id) {
  const b = C().bundles.find((x) => x.id === id);
  const Rr = rar(b.rarity);
  const firstHero = b.items.map((i) => store.findItem(i)).find((f) => f && f.type === 'hero');
  const bGlider = b.items.find((i) => i.startsWith('glider'));
  const value = b.items.reduce((s, i) => { const f = store.findItem(i); return s + (f ? f.item.price : 0); }, 0);

  const box = el('div', { class: 'show2 bShow', style: { '--rc': Rr.color } },
    el('div', { class: 'shAura' }), el('div', { class: 'shRays' }));
  const cv = el('canvas', { class: 'hero pixel' });
  box.append(el('div', { class: 'shStage' }, cv, el('div', { class: 'shShadow', style: { '--rc': Rr.color } }), el('div', { class: 'shPlatform' })),
    el('div', { class: 'bShowMinis' }, b.items.map((iid) => miniIcon(iid))));
  anim = new Animator(cv, 7);
  anim.load(firstHero ? firstHero.item.id : heroOf().id, bGlider || null);

  // contents never show their own prices: the bundle price overrides them
  const grid = el('div', { class: 'inclGrid' });
  b.items.forEach((iid) => {
    const f = store.findItem(iid);
    if (!f) return;
    const ir = rar(f.item.rarity);
    grid.append(el('button', {
      class: 'inclRow', style: { '--rc': ir.color },
      onclick: () => { sfx.click(); shopSel = { kind: 'item', type: f.type, id: iid }; bus.refresh(); }
    },
      el('span', { class: `irIco ${f.type === 'hero' ? 'h' : ''}` }, el('img', { class: 'pixel', src: f.type === 'hero' ? portraitOf(iid) : f.item.art, alt: '' })),
      el('span', { class: 'irTxt' }, el('span', { class: 'irNm' }, f.item.name)),
      store.owns(f.type, iid) ? el('span', { class: 'irOwn' }, '✓') : el('span', { class: 'irIncl' }, 'INCLUÍDO'),
      el('span', { class: 'irGo' }, '▸')));
  });

  const allOwned = b.items.every((i) => { const f = store.findItem(i); return f && store.owns(f.type, i); });
  const buy = el('button', {
    class: 'btn big',
    onclick: () => {
      if (store.buyBundle(b)) { sfx.buy(); confetti(70); bus.refresh(); }
      else {
        sfx.deny();
        const pill = document.getElementById('coinPill');
        pill.classList.add('deny'); setTimeout(() => pill.classList.remove('deny'), 350);
      }
    }
  }, 'COMPRAR PACOTE ', priceTag(b.price));

  const details = el('div', { class: 'col det2' },
    el('h2', { class: 'itemName' }, b.name),
    el('p', { class: 'itemDesc' }, b.desc),
    el('div', { class: 'priceLine' }, priceTag(b.price),
      el('span', { class: 'saveNote' }, ` VALOR ${fmt(value)} · ECONOMIZE ${fmt(value - b.price)}`)),
    el('div', { class: 'inclHead' }, el('div', { class: 'panelTitle' }, 'INCLUÍDO'), el('span', { class: 'secCount' }, `${b.items.length} ITENS`)),
    grid,
    el('div', { class: 'actions' }, allOwned ? el('span', { class: 'ownedTag' }, 'TUDO OBTIDO') : buy));

  return el('div', { class: 'page2 in-page', style: { '--rc': Rr.color } },
    el('div', { class: 'pageHead' },
      el('button', { class: 'btn ghost', onclick: () => { sfx.click(); shopSel = null; bus.refresh(); } }, '◂ VOLTAR'),
      el('div', { class: 'panelTitle' }, 'PACOTE')),
    el('div', { class: 'cols2' }, box, details));
}

function buyButton(type, id, price, after) {
  const owned = store.owns(type, id);
  const eq = store.data.equipped[type === 'hero' ? 'hero' : type === 'pick' ? 'pick' : type === 'glider' ? 'glider' : 'emote'] === id;
  if (!owned) return el('button', {
    class: 'btn',
    onclick: () => {
      const doBuy = () => {
        if (store.buy(type, id, price)) { sfx.buy(); confetti(40); after && after(); bus.refresh(); }
        else {
          sfx.deny();
          const pill = document.getElementById('coinPill');
          pill.classList.add('deny'); setTimeout(() => pill.classList.remove('deny'), 350);
        }
      };
      if (store.data.settings.confirmBuys) {
        const nm = (store.findItem(id) || { item: { name: '' } }).item.name;
        const m = modal(el('div', {},
          el('h2', {}, 'CONFIRMAR COMPRA'),
          el('p', { style: { fontSize: '16px', margin: '10px 0 14px' } }, `Comprar ${nm} por ${fmt(price)} moedas?`),
          el('div', { style: { display: 'flex', gap: '10px', justifyContent: 'flex-end' } },
            el('button', { class: 'btn ghost', onclick: () => m.close() }, 'CANCELAR'),
            el('button', { class: 'btn', onclick: () => { m.close(); doBuy(); } }, 'COMPRAR'))));
      } else doBuy();
    }
  }, 'COMPRAR ', priceTag(price));
  if (!eq) return el('button', { class: 'btn blue', onclick: () => { sfx.equip(); store.equip(type, id); bus.refresh(); } }, type === 'hero' ? 'ESCOLHER HERÓI' : 'EQUIPAR');
  return el('span', { class: 'ownedTag' }, '★ EQUIPADO');
}

/* ------------------------------ LOCKER v2: character customization hub ------------------------------ */
export function renderLocker() {
  killAnim();
  const CATS = [['hero', 'HERÓI'], ['glider', 'BACK BLING'], ['pick', 'RELÍQUIAS']];
  let cat = 'hero';
  let lkQ = '', lkRar = '';

  // hero/skin families come from the shop category data (spiderman -> classic/miles/gwen)
  const families = () => (C().shopCats || []).map((c) => c.families || []).flat();
  const familyOf = (hid) => familyOfHero(hid);
  const baseHeroes = () => families().map((f) => f.hero);

  const canvas = el('canvas', { class: 'hero pixel' });
  const nameTag = el('div', { class: 'lkName' }, '');
  const quoteTag = el('div', { class: 'lkQuote' }, '');
  const slotsRow = el('div', { class: 'lk2Slots' });
  const gridWrap = el('div', { class: 'lk2Grid scroll' });
  const headCount = el('span', { class: 'catCount' }, '');

  const stage = el('div', { class: 'lk2Stage' },
    el('div', { class: 'floorGlow', style: { '--rc': rar(heroOf().rarity).color } }),
    canvas,
    el('div', { class: 'lkPlate' }, nameTag, quoteTag));
  const chips = animChips(stage);
  chips.classList.add('lkChips');

  anim = new Animator(canvas, 7);

  function syncPreview() {
    const h = heroOf(); const Rr = rar(h.rarity);
    nameTag.textContent = h.name;
    quoteTag.textContent = `“${h.quote || ''}”`;
    quoteTag.style.display = store.data.settings.showQuotes ? '' : 'none';
    stage.querySelector('.floorGlow').style.setProperty('--rc', Rr.color);
    if (anim) anim.load(h.id, gliderOf());
  }

  /* ---- equipped-item slots: compact, rarity-tinted, click to browse ---- */
  function slotCard(label, catId, previewNode, nm, rarity, empty) {
    return el('button', {
      class: `s3card lk2Slot r-${rarity || 'common'} ${cat === catId ? 'sel' : ''} ${empty ? 'empty' : ''}`,
      style: { '--rc': rar(rarity || 'common').color },
      onclick: () => { sfx.tab(); cat = catId; drawSlots(); drawGrid(); },
    },
      el('span', { class: 'slotLbl' }, label),
      el('span', { class: 'slotIco' }, previewNode),
      el('span', { class: 'slotNm' }, nm));
  }
  function drawSlots() {
    slotsRow.innerHTML = '';
    const h = heroOf();
    const g = C().gliders.find((x) => x.id === gliderOf());
    const pk = C().picks.find((x) => x.id === store.data.equipped.pick);
    // integer scales only: 96px icons at 48 (1/2), 32px blings at 64 (x2)
  const ico = (src, filter, size = 48) => el('img', {
    class: 'pixel', src, alt: '',
    style: Object.assign({ width: size + 'px', height: size + 'px' }, filter ? { filter } : {}),
  });
    slotsRow.append(
      slotCard('HERÓI', 'hero', ico(portraitOf(h.id)), h.name, h.rarity),
      g ? slotCard('BLING', 'glider', ico(`assets/anim/${g.id}.png`, '', 64), g.name, g.rarity)
        : slotCard('BLING', 'glider', el('span', { class: 'lkEmpty' }, '—'), 'SEM BLING', 'common', true),
      pk ? slotCard('RELÍQUIA', 'pick', ico(pk.art), pk.name, pk.rarity)
        : slotCard('RELÍQUIA', 'pick', el('span', { class: 'lkEmpty' }, '—'), 'SEM RELÍQUIA', 'common', true));
    slotsRow.querySelectorAll('.lk2Slot').forEach((b, i) => b.classList.toggle('sel', CATS[i][0] === cat));
  }

  /* ---- inventory browser: owned items of the active category ---- */
  function listFor() {
    if (cat === 'hero') return C().heroes.filter((h) => baseHeroes().includes(h.id) && store.owns('hero', h.id));
    if (cat === 'pick') return C().picks.filter((x) => store.owns('pick', x.id));
    return C().gliders.filter((x) => store.owns('glider', x.id));
  }
  const matches = (x) => (!lkQ || (x.name || '').toLowerCase().includes(lkQ)) && (!lkRar || x.rarity === lkRar);

  function equipOf(catId, id) {
    if (catId === 'style') return store.data.equipped.style === id;
    if (catId === 'hero') return store.data.equipped.hero === id;
    return store.data.equipped[catId] === id;
  }

  function drawGrid() {
    gridWrap.innerHTML = '';
    let list = listFor().filter(matches);
    headCount.textContent = `${list.length} ${list.length === 1 ? 'ITEM' : 'ITENS'}`;

    if (cat === 'glider') {
      // "none" option so the slot can be emptied straight from the locker
      gridWrap.append(el('button', {
        class: `s3card empty lkNone ${gliderOf() ? '' : 'equipped'}`,
        onclick: () => { sfx.equip(); store.data.equipped.glider = null; store.bump('equips'); syncPreview(); drawSlots(); drawGrid(); },
      },
        el('div', { class: 'c3art' }, el('span', { class: 'lkEmpty big' }, '—')),
        el('div', { class: 'c3bar' }, el('span', { class: 'c3nm' }, 'SEM BACK BLING'))));
    }
    if (!list.length && cat !== 'glider') {
      gridWrap.append(el('div', { class: 'lkVoid' }, 'NADA OBTIDO NESTA CATEGORIA — VISITE A LOJA'));
      return;
    }

    list.forEach((it) => {
      const Rr = rar(it.rarity);
      const eq = equipOf(cat, it.id);
      let art;
      if (cat === 'hero' || cat === 'skin') art = cropWrap(liveHeroCanvas(it.id, 2), 2);
      else if (cat === 'glider') art = el('div', { class: 'c3art' }, el('img', { class: 'pixel pIco', src: it.art, alt: '' }));
      else art = el('div', { class: 'c3art pick' }, el('img', { class: 'pixel pIco', src: it.art, alt: '' }));
      // skins appear WITH their hero inside the HERO rack (never as dupes)
      const skinChips = cat === 'hero' ? (skinsOf(it.id).filter((sid) => store.owns('hero', sid))
        .map((sid) => {
          const sk = C().heroes.find((x) => x.id === sid);
          return el('button', {
            class: `skinChip ${store.data.equipped.hero === sid ? 'equipped' : ''}`,
            title: sk ? sk.name : sid,
            onclick: (ev) => { ev.stopPropagation(); sfx.equip(); store.equip('hero', sid); syncPreview(); drawSlots(); drawGrid(); },
          }, el('img', { class: 'pixel', src: portraitOf(sid), alt: '' }));
        })) : [];
      gridWrap.append(el('button', {
        class: `s3card lk2Card r-${it.rarity} ${eq ? 'equipped' : ''}`,
        style: { '--rc': Rr.color },
        onclick: () => {
          sfx.equip();
          if (cat === 'hero') store.equip('hero', it.id);
          else store.equip(cat, it.id);
          syncPreview(); drawSlots(); drawGrid();
        },
      },
        el('div', { class: 'c3art' }, art),
        el('div', { class: 'c3bar' }, el('span', { class: 'c3nm', title: it.name }, it.name)),
        skinChips.length ? el('div', { class: 'skinChips' }, ...skinChips) : null));
    });
  }

  /* ---- head: title + search + rarity dots (colour-only, no labels) ---- */
  const dots = el('div', { class: 'lkRars' });
  ['', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'marvel'].forEach((r) => {
    dots.append(el('button', {
      class: `lkF ${r === '' ? 'sel' : ''}`, style: r ? { '--rc': rar(r).color } : {},
      title: r ? rar(r).label : 'TODOS',
      onclick: (ev) => { sfx.tab(); lkRar = r; [...dots.querySelectorAll('.lkF')].forEach((b) => b.classList.remove('sel')); ev.currentTarget.classList.add('sel'); drawGrid(); },
    }));
  });
  const head = el('div', { class: 'lk2Head' },
    el('span', { class: 'lk2Title' }, 'ARMÁRIO'),
    el('input', { class: 'lkSearch', placeholder: 'PESQUISAR…', oninput: (ev) => { lkQ = ev.target.value.toLowerCase(); drawGrid(); } }),
    dots,
    headCount);

  syncPreview(); drawSlots(); drawGrid();

  const left = el('div', { class: 'lk2Left' }, stage, slotsRow);
  const right = el('div', { class: 'lk2Right' }, head, gridWrap);
  return el('div', { class: 'cols screen-anim in-locker locker2' }, left, right);
}

/* ------------------------------ TASKS (categorized) ------------------------------ */
export function renderTasks() {
  killAnim();
  const wrap = el('div', { class: 'col scroll screen-anim in-tasks', style: { height: '100%' } });
  wrap.append(el('div', { class: 'levelPanel pixelbox' },
    el('span', { class: 'lv' }, `LV ${store.data.level}`),
    el('div', { class: 'xpbar' }, el('i', { style: { width: `${Math.min(100, (store.data.xp / store.xpNeed()) * 100)}%` } })),
    el('span', { class: 'xptxt' }, `${fmt(store.data.xp)} / ${fmt(store.xpNeed())} XP`)));

  for (const catDef of C().taskCats) {
    const box = el('div', { class: 'col', style: { gap: '8px', marginTop: '10px' } },
      el('div', { class: 'panelTitle', style: { color: catDef.color } }, catDef.label));
    C().tasks.filter((t) => t.cat === catDef.id).forEach((t) => {
      const p = store.taskProgress(t);
      box.append(el('div', { class: `task pixelbox ${p.done && !p.claimed ? 'done' : ''} ${p.claimed ? 'claimed' : ''}` },
        el('div', {},
          el('div', { class: 'd' }, `${t.desc}  ·  ${t.type === 'daily' ? 'DIÁRIO' : 'SEMANAL'}`),
          el('div', { class: 'bar' }, el('i', { style: { width: `${(p.cur / t.count) * 100}%`, background: `linear-gradient(90deg, ${catDef.color}, #fff)` } })),
          el('div', { class: 'meta' },
            el('span', {}, `${p.cur}/${t.count}`),
            el('span', { class: 'rwd' }, `+${t.coins} MOEDAS`),
            el('span', { style: { color: 'var(--cyan)' } }, `+${t.xp} XP`))),
        el('button', {
          class: `btn ${p.done && !p.claimed ? '' : 'ghost'}`,
          disabled: !p.done || p.claimed,
          onclick: () => { if (store.claimTask(t)) { sfx.claim(); confetti(50); bus.refresh(); } }
        }, p.claimed ? 'RESGATADO' : 'RESGATAR')));
    });
    wrap.append(box);
  }
  if (store.data.dev.noCooldown)
    wrap.append(el('p', { style: { fontSize: '14px', color: 'var(--dim)' } }, 'MODO TESTE: tarefas resgatadas rearmam na hora — sem cooldown.'));
  return wrap;
}

/* ------------------------------ DEV ------------------------------ */
export function renderDev() {
  killAnim();
  const wrap = el('div', { class: 'col scroll screen-anim in-dev', style: { height: '100%', gap: '12px' } });
  wrap.append(
    el('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
      el('div', { class: 'panelTitle' }, 'DEV / LAB DE MOEDAS'),
      el('span', { class: 'devBadge' }, 'SÓ PARA TESTES')),
    el('p', { style: { fontSize: '15px', color: 'var(--dim)' } },
      'Moeda base de teste: 500 moedas. Instantâneo e sem cooldown, para validar a economia antes do jogo real.'));
  wrap.append(el('div', { class: 'panelTitle' }, 'OBTER MOEDAS'),
    el('div', { class: 'devRow' },
      el('button', { class: 'btn', onclick: () => { store.addCoins(100); sfx.claim(); } }, '+100'),
      el('button', { class: 'btn', onclick: () => { store.addCoins(500); sfx.claim(); } }, '+500'),
      el('button', { class: 'btn', onclick: () => { store.addCoins(5000); sfx.claim(); } }, '+5000'),
      el('button', { class: 'btn blue', onclick: () => { store.setCoins(500); sfx.click(); } }, 'BASE 500'),
      el('button', { class: 'btn blue', onclick: () => { store.setCoins(store.data.coins * 2); sfx.click(); } }, 'x2')));
  wrap.append(el('div', { class: 'panelTitle' }, 'OPÇÕES'),
    el('div', { class: 'devRow' },
      el('button', { class: `btn ${store.data.dev.noCooldown ? '' : 'ghost'}`, onclick: () => { store.data.dev.noCooldown = !store.data.dev.noCooldown; store.emit('dev'); sfx.click(); bus.refresh(); } },
        `SEM COOLDOWN: ${store.data.dev.noCooldown ? 'LIG' : 'DESL'}`),
      el('button', { class: `btn ${store.data.dev.unlockAll ? '' : 'ghost'}`, onclick: () => { store.data.dev.unlockAll = !store.data.dev.unlockAll; store.emit('dev'); sfx.click(); bus.refresh(); } },
        `DESBLOQUEAR TUDO (TESTE): ${store.data.dev.unlockAll ? 'LIG' : 'DESL'}`),
      el('button', { class: 'btn dark', onclick: () => { store.resetTasks(); sfx.click(); bus.refresh(); } }, 'REARMAR TAREFAS'),
      el('button', { class: 'btn danger', onclick: () => { store.resetAll(); sfx.deny(); } }, 'APAGAR SAVE')));
  wrap.append(el('div', { class: 'panelTitle' }, 'SAVE BRUTO'),
    el('pre', { class: 'save' }, JSON.stringify(store.data, null, 2)));
  return wrap;
}
