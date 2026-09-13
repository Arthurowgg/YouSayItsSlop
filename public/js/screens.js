// Screens v5 — LOJA por categoria (cor própria + entrada animada) e
// ARMÁRIO que mostra ÍCONES (nunca o boneco) nas listas e nos slots.
import { el, fmt, pick, coinDataURL } from './util.js';
import { store } from './store.js';
import { sfx, confetti } from './fx.js';
import { deployMatch } from './match.js';
import { Animator, preloadHero, frameSize, blingMeta } from './anim.js';
import { bus } from './bus.js';

const C = () => store.catalog;
const CB = { common: '#9aa7b8', uncommon: '#0f8ff5', rare: '#00c8e0', epic: '#b060ff', legendary: '#ff9a00', marvel: '#ff5fa2' };
const rar = (r) => {
  const base = (C().rarities && C().rarities[r]) || { label: r, color: '#fff' };
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

/* ------------------------------- catalog helpers ------------------------------- */
const heroById = (id) => (C().heroes || []).find((h) => h.id === id);
const blingById = (id) => (C().blings || []).find((b) => b.id === id);
const pickById = (id) => (C().picks || []).find((p) => p.id === id);
const heroOf = () => heroById(store.data.equipped.hero) || C().heroes[0];
const blingOf = () => store.data.equipped.bling || null;
const pickOf = () => store.data.equipped.pick || null;
const portraitOf = (id) => `assets/spr/${id}.png`;
const heroSize = (id) => (heroById(id) || {}).size || 'M';

function priceTag(n, big) {
  return el('span', { class: `price ${big ? 'big' : ''}` },
    el('img', { src: coinDataURL(big ? 16 : 12), class: 'pixel', alt: '' }), fmt(n));
}
// "obtido" overrides the price: owned items show a check badge, never a price
function priceOrOwned(type, it) {
  return store.owns(type, it.id) ? el('span', { class: 'ownBadge' }, '✓') : priceTag(it.price);
}
// skins are alternate looks of the same hero: they live INSIDE the hero card
const skinsOf = (hid) => (heroById(hid) || {}).skins || [];

function statBars(id) {
  const st = (heroById(id) || {}).stat || { power: 5, speed: 5, utility: 5 };
  return el('div', { class: 'statbars' },
    [['PODER', st.power], ['VELOCIDADE', st.speed], ['UTILIDADE', st.utility]].map(([label, n]) =>
      el('div', { class: 'sbar' },
        el('span', {}, label),
        el('div', { class: 'track' }, el('i', { style: { width: `${Math.max(4, Math.min(100, n * 10))}%` } })))));
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
      const sel = m.id === mode.id;
      list.append(el('button', {
        class: `p2card ${sel ? 'sel' : ''} ${m.available ? '' : 'soon'}`,
        onclick: () => { sfx.tab(); mode = m; lastModeId = m.id; draw(); },
      },
        el('img', { class: 'pixel', src: m.tile, alt: m.name }),
        el('div', { class: 'p2cn' }, m.name),
        el('div', { class: 'p2cm' }, m.available ? 'DISPONÍVEL' : 'EM BREVE')));
    });
    dName.textContent = mode.name;
    dDesc.textContent = mode.desc;
    dChips.innerHTML = '';
    (mode.meta || '').split(' · ').forEach((t) => t && dChips.append(el('span', { class: 'chip' }, t)));
    if (mode.players) dChips.append(el('span', { class: 'chip' }, `${mode.players} JOGADORES`));
    playBtn.disabled = !mode.available;
    playBtn.textContent = mode.available ? 'JOGAR' : 'EM BREVE';
    const mp = document.getElementById('screen') && null;
    void mp;
    preview.src = sm.art;
    preview.alt = sm.name;
    mapName.textContent = sm.name;
  }

  const preview = el('img', { class: 'p2mapimg' });
  const mapName = el('span', { class: 'rn' });
  const mapChip = el('button', { class: 'p2map', onclick: () => { sfx.click(); map = pick(maps); store.data.lastMap = map.id; draw(); } },
    el('span', { class: 'lbl' }, 'PRÓXIMO MAPA'), mapName, el('span', { class: 'rr' }, '⟳'));

  playBtn.onclick = () => { if (!playBtn.disabled) deployMatch(mode); };

  root = el('div', { class: 'play2 in-play', dataset: { mode: mode.id } },
    el('div', { class: 'p2bg' },
      el('div', { class: 'p2sky' }), el('div', { class: 'p2stars' }),
      el('div', { class: 'p2skyline' }), el('div', { class: 'p2fog f1' }), el('div', { class: 'p2fog f2' }),
      glow, pix, el('div', { class: 'p2vignette' })),
    el('div', { class: 'p2wrap' },
      el('div', { class: 'p2col left' },
        head,
        list,
        el('div', { class: 'p2foot' },
          el('div', { class: 'p2detail' }, dName, dDesc, dChips), mapChip)),
      el('div', { class: 'p2col right' },
        el('div', { class: 'p2hero' }, preview, emblem),
        playBtn)));
  draw();
  return root;
}

/* ============================== LOJA v5: categorias com cor ============================== */
let shopSel = null;                 // null | {kind:'item',type,id} | {kind:'bundle',id}
let shopCat = 0;
export function shopHome() { shopSel = null; }
export function renderShop() {
  killAnim();
  if (shopSel) return shopSel.kind === 'bundle' ? bundlePage(shopSel.id) : itemPage(shopSel.type, shopSel.id);
  return shopCats();
}

/* one compact card = icon + name + price/owned. No rarity/type text tags. */
function itemCard(type, it, delay = 0) {
  const Rr = rar(it.rarity);
  const skinChips = type === 'hero' ? skinsOf(it.id)
    .map((sid) => ({ sid, sk: heroById(sid) })).filter((x) => x.sk) : [];
  return el('button', {
    class: `s3card icard r-${it.rarity} ${store.owns(type, it.id) ? 'owned' : ''}`,
    style: { '--rc': Rr.color, '--d': String(delay) },
    onclick: () => { sfx.click(); shopSel = { kind: 'item', type, id: it.id }; bus.refresh(); },
  },
    el('div', { class: 'c3art' }, el('img', { class: 'pixel iIco', src: it.art, alt: it.name })),
    el('div', { class: 'c3bar' },
      el('span', { class: 'c3nm', title: it.name }, it.name),
      priceOrOwned(type, it)),
    skinChips.length ? el('div', { class: 'skinChips' }, ...skinChips.map(({ sid, sk }) =>
      el('span', { class: 'skinChip', title: sk.name },
        el('img', { class: 'pixel', src: portraitOf(sid), alt: '' })))) : null);
}

/* the featured hero card of a category: bigger portrait */
function featuredHeroCard(h, delay = 0) {
  const Rr = rar(h.rarity);
  return el('button', {
    class: `s3card icard feat r-${h.rarity} ${store.owns('hero', h.id) ? 'owned' : ''}`,
    style: { '--rc': Rr.color, '--d': String(delay) },
    onclick: () => { sfx.click(); shopSel = { kind: 'item', type: 'hero', id: h.id }; bus.refresh(); },
  },
    el('div', { class: 'c3art' }, el('img', { class: 'pixel iIco big', src: h.art, alt: h.name })),
    el('div', { class: 'c3bar' },
      el('span', { class: 'c3nm', title: h.name }, h.name),
      priceOrOwned('hero', h)),
    el('div', { class: 'featTags' }, el('span', { class: 'chip' }, h.ability ? h.ability.name : 'HERÓI')));
}

function bundleCard(b, delay = 0) {
  const Rr = rar(b.rarity);
  const hero = heroById(b.hero) || heroById(b.items[0]) || heroOf();
  const value = b.items.reduce((s, id) => { const f = store.findItem(id); return s + (f ? f.item.price : 0); }, 0);
  return el('button', {
    class: `s3card icard bundle r-${b.rarity}`,
    style: { '--rc': Rr.color, '--d': String(delay) },
    onclick: () => { sfx.click(); shopSel = { kind: 'bundle', id: b.id }; bus.refresh(); },
  },
    el('div', { class: 'cbArt' }, el('img', { class: 'pixel iIco hero', src: portraitOf(hero.id), alt: hero.name })),
    el('div', { class: 'cbInfo' },
      el('span', { class: 'cbKick' }, '★ PACOTE'),
      el('span', { class: 'cbName' }, b.name),
      el('div', { class: 'cbMinis' }, b.items.map((id) => miniIcon(id))),
      el('div', { class: 'cbPrice' }, priceTag(b.price),
        value > b.price ? el('span', { class: 'savePill' }, `-${Math.round((1 - b.price / value) * 100)}%`) : null)));
}

function miniIcon(id) {
  const f = store.findItem(id);
  if (!f) return null;
  return el('span', { class: `miniIco ${f.type === 'hero' ? 'h' : ''}`, style: { '--rc': rar(f.item.rarity).color }, title: f.item.name },
    el('img', { class: 'pixel', src: f.item.art, alt: '' }));
}

/* ---- the category page: one section per category, its own colour ---- */
function shopCats() {
  const cats = C().shopCats || [];
  const wrap = el('div', { class: 'shop5wrap in-shop' });
  const tabs = el('nav', { class: 'shopTabs' });
  const scroller = el('div', { class: 'shop5 scroll' });
  const dots = el('nav', { class: 'catDots', 'aria-label': 'categorias' });

  const goTo = (i, smooth = true) => {
    const secs = scroller.querySelectorAll('.shopSec');
    const sec = secs[i];
    if (!sec) return;
    shopCat = i;
    secs.forEach((s, si) => { if (si !== i) s.classList.remove('in'); });
    sec.classList.remove('in'); void sec.offsetWidth; sec.classList.add('in');
    tabs.querySelectorAll('.shopTab').forEach((t, ti) => t.classList.toggle('sel', ti === i));
    dots.querySelectorAll('.catDot').forEach((d, di) => d.classList.toggle('sel', di === i));
    if (sec.scrollIntoView) sec.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  };

  cats.forEach((cat, ci) => {
    const b = (C().bundles || []).find((x) => x.id === cat.bundle);
    const heroes = (cat.heroes || []).map(heroById).filter(Boolean);
    const blings = (cat.blings || []).map(blingById).filter(Boolean);
    const picks = (cat.picks || []).map(pickById).filter(Boolean);
    const featured = (b && heroById(b.hero)) || heroes[0] || heroOf();
    // the featured hero stands next to the bundle; every other item goes below
    const restHeroes = heroes.filter((h) => h.id !== featured.id);

    const sec = el('section', { class: 'shopSec', id: `cat-${cat.id}`, style: { '--cat': cat.color, '--rc': cat.color } },
      el('header', { class: 'secHead' },
        el('h2', { class: 'secName' }, cat.name),
        el('p', { class: 'secTag' }, cat.tag || '')),
      el('div', { class: 'secFeat' },
        b ? bundleCard(b, 0) : null,
        featured ? featuredHeroCard(featured, 1) : null),
      el('div', { class: 'secGrid' },
        ...restHeroes.map((h, i) => itemCard('hero', h, i + 2)),
        ...blings.map((g, i) => itemCard('bling', g, i + 2 + restHeroes.length)),
        ...picks.map((p, i) => itemCard('pick', p, i + 2 + restHeroes.length + blings.length))));

    scroller.append(sec);
    tabs.append(el('button', {
      class: `shopTab ${ci === 0 ? 'sel' : ''}`, style: { '--cat': cat.color },
      onclick: () => { sfx.tab(); goTo(ci); },
    }, el('span', { class: 'dot' }), cat.name));
    dots.append(el('button', {
      class: `catDot ${ci === 0 ? 'sel' : ''}`, title: cat.name, 'data-i': ci,
      style: { '--cat': cat.color },
      onclick: () => { sfx.tab(); goTo(ci); },
    }));
  });

  // sections pop their items in when they come into view / when the
  // category changes (the transition the shop was missing)
  if (typeof IntersectionObserver !== 'undefined') {
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        const i = cats.findIndex((c) => `cat-${c.id}` === e.target.id);
        tabs.querySelectorAll('.shopTab').forEach((t, ti) => t.classList.toggle('sel', ti === i));
        dots.querySelectorAll('.catDot').forEach((d, di) => d.classList.toggle('sel', di === i));
        shopCat = i;
      });
    }, { root: scroller, threshold: 0.35 });
    scroller.querySelectorAll('.shopSec').forEach((s) => io.observe(s));
    wrap._io = io;
  } else {
    scroller.querySelectorAll('.shopSec').forEach((s) => s.classList.add('in'));
  }

  const first = scroller.querySelectorAll('.shopSec')[bootCat()];
  if (first) first.classList.add('in');

  wrap.append(el('div', { class: 'shopHead' },
    el('h2', { class: 'shopTitle' }, 'LOJA'),
    el('span', { class: 'shopSub' }, 'ITENS SEPARADOS · SEM PACOTE OBRIGATÓRIO')),
    tabs, el('div', { class: 'shopBody' }, scroller, dots));
  return wrap;
}
const bootCat = () => Math.max(0, Math.min((C().shopCats || []).length - 1, shopCat));

/* ---- selected-item showcase ---- */
function showcase(type, it) {
  const Rr = rar(it.rarity);
  const box = el('div', { class: 'show2', style: { '--rc': Rr.color } },
    el('div', { class: 'shAura' }), el('div', { class: 'shRays' }),
    el('div', { class: 'shPix p1' }), el('div', { class: 'shPix p2' }), el('div', { class: 'shPix p3' }));
  if (type === 'hero') {
    const cv = el('canvas', { class: 'hero pixel' });
    box.append(el('div', { class: 'shStage' }, cv,
      el('div', { class: 'shShadow', style: { '--rc': Rr.color } }), el('div', { class: 'shPlatform' })));
    anim = new Animator(cv, 3);
    anim.load(it.id, { heroSize: it.size, bling: blingOf(), blingSize: blingById(blingOf()) ? blingById(blingOf()).size : 'M' });
    box.append(animChips(box));
  } else if (type === 'bling') {
    const hid = (store.data.equipped.hero) || 'spiderman';
    const cv = el('canvas', { class: 'hero pixel' });
    box.append(el('div', { class: 'shStage' }, cv,
      el('div', { class: 'shShadow', style: { '--rc': Rr.color } }), el('div', { class: 'shPlatform' })));
    anim = new Animator(cv, 3);
    anim.load(hid, { heroSize: heroSize(hid), bling: it.id, blingSize: it.size });
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
    type === 'hero' ? statBars(it.id) : null,
    type === 'bling' ? el('p', { class: 'attachNote' },
      `EQUIPADO NO HERÓI · TAMANHO ${({ S: 'PEQUENO', M: 'MÉDIO', L: 'GRANDE' })[it.size] || 'MÉDIO'}`) : null,
    el('div', { class: 'priceLine' }, owned ? el('span', { class: 'ownBadge big' }, '✓ OBTIDO') : priceTag(it.price, true)),
    el('div', { class: 'actions' }, buyButton(type, id, it.price)));

  return el('div', { class: 'page2 in-page', style: { '--rc': Rr.color } },
    el('div', { class: 'pageHead' },
      el('button', { class: 'btn ghost', onclick: () => { sfx.click(); shopSel = null; bus.refresh(); } }, '◂ VOLTAR'),
      el('div', { class: 'panelTitle' }, 'LOJA')),
    el('div', { class: 'cols2' }, showcase(type, it), details));
}

function bundlePage(id) {
  const b = C().bundles.find((x) => x.id === id);
  const Rr = rar(b.rarity);
  const hero = heroById(b.hero) || heroById(b.items[0]) || heroOf();
  const value = b.items.reduce((s, i) => { const f = store.findItem(i); return s + (f ? f.item.price : 0); }, 0);

  const box = el('div', { class: 'show2 bShow', style: { '--rc': Rr.color } },
    el('div', { class: 'shAura' }), el('div', { class: 'shRays' }));
  const cv = el('canvas', { class: 'hero pixel' });
  box.append(el('div', { class: 'shStage' }, cv,
    el('div', { class: 'shShadow', style: { '--rc': Rr.color } }), el('div', { class: 'shPlatform' })));
  anim = new Animator(cv, 3);
  const bBling = b.items.map(blingById).find(Boolean);
  anim.load(hero.id, { heroSize: hero.size, bling: bBling ? bBling.id : null, blingSize: bBling ? bBling.size : 'M' });

  const grid = el('div', { class: 'inclGrid' });
  b.items.forEach((iid) => {
    const f = store.findItem(iid);
    if (!f) return;
    const ir = rar(f.item.rarity);
    grid.append(el('button', {
      class: 'inclRow', style: { '--rc': ir.color },
      onclick: () => { sfx.click(); shopSel = { kind: 'item', type: f.type, id: iid }; bus.refresh(); }
    },
      el('span', { class: 'irIco' }, el('img', { class: 'pixel', src: f.item.art, alt: '' })),
      el('span', { class: 'irTxt' }, el('span', { class: 'irNm' }, f.item.name)),
      store.owns(f.type, iid) ? el('span', { class: 'irOwn' }, '✓') : el('span', { class: 'irIncl' }, 'INCLUÍDO'),
      el('span', { class: 'irGo' }, '▸')));
  });

  const allOwned = b.items.every((i) => { const f = store.findItem(i); return f && store.owns(f.type, i); });
  const buy = el('button', {
    class: 'btn big',
    onclick: () => {
      if (store.buyBundle(b)) { sfx.buy(); confetti(70); bus.refresh(); }
      else denyPill();
    }
  }, 'COMPRAR PACOTE ', priceTag(b.price));

  const details = el('div', { class: 'col det2' },
    el('h2', { class: 'itemName' }, b.name),
    el('p', { class: 'itemDesc' }, b.desc),
    el('div', { class: 'priceLine' }, priceTag(b.price, true),
      el('span', { class: 'saveNote' }, ` VALOR ${fmt(value)} · ECONOMIZE ${fmt(value - b.price)}`)),
    grid,
    el('div', { class: 'actions' }, allOwned ? el('span', { class: 'ownedTag' }, 'TUDO OBTIDO') : buy));

  return el('div', { class: 'page2 in-page', style: { '--rc': Rr.color } },
    el('div', { class: 'pageHead' },
      el('button', { class: 'btn ghost', onclick: () => { sfx.click(); shopSel = null; bus.refresh(); } }, '◂ VOLTAR'),
      el('div', { class: 'panelTitle' }, 'PACOTE')),
    el('div', { class: 'cols2' }, box, details));
}

function denyPill() {
  sfx.deny();
  const pill = document.getElementById('coinPill');
  if (pill) { pill.classList.add('deny'); setTimeout(() => pill.classList.remove('deny'), 350); }
}

function buyButton(type, id, price, after) {
  const owned = store.owns(type, id);
  const eq = store.data.equipped[type === 'hero' ? 'hero' : type] === id;
  if (!owned) return el('button', {
    class: 'btn',
    onclick: () => {
      const doBuy = () => {
        if (store.buy(type, id, price)) { sfx.buy(); confetti(40); after && after(); bus.refresh(); }
        else denyPill();
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

/* ============================== ARMÁRIO v3: ícones, não bonecos ============================== */
export function renderLocker() {
  killAnim();
  const CATS = [['hero', 'HERÓI'], ['bling', 'BACK BLING'], ['pick', 'RELÍQUIAS']];
  let cat = 'hero';
  let lkQ = '', lkRar = '';

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

  anim = new Animator(canvas, 3);

  function syncPreview() {
    const h = heroOf(); const Rr = rar(h.rarity);
    const b = blingById(blingOf());
    nameTag.textContent = h.name;
    quoteTag.textContent = `“${h.quote || ''}”`;
    quoteTag.style.display = store.data.settings.showQuotes ? '' : 'none';
    stage.querySelector('.floorGlow').style.setProperty('--rc', Rr.color);
    if (anim) anim.load(h.id, { heroSize: h.size, bling: b ? b.id : null, blingSize: b ? b.size : 'M' });
  }

  /* ---- equipped-item slots: pure icons, click to browse that rack ---- */
  const ico = (src, size = 48) => el('img', { class: 'pixel', src, alt: '', style: { width: size + 'px', height: size + 'px' } });
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
    const b = blingById(blingOf());
    const pk = pickById(pickOf());
    slotsRow.append(
      slotCard('HERÓI', 'hero', ico(h.art), h.name, h.rarity),
      b ? slotCard('BLING', 'bling', ico(b.art, 56), b.name, b.rarity)
        : slotCard('BLING', 'bling', el('span', { class: 'lkEmpty' }, '—'), 'SEM BLING', 'common', true),
      pk ? slotCard('RELÍQUIA', 'pick', ico(pk.art, 56), pk.name, pk.rarity)
        : slotCard('RELÍQUIA', 'pick', el('span', { class: 'lkEmpty' }, '—'), 'SEM RELÍQUIA', 'common', true));
    slotsRow.querySelectorAll('.lk2Slot').forEach((btn, i) => btn.classList.toggle('sel', CATS[i][0] === cat));
  }

  /* ---- inventory browser: always ICONS (the animated stage is the only
         place the hero is drawn as a character) ---- */
  function listFor() {
    if (cat === 'hero') return (C().heroes || []).filter((h) => store.owns('hero', h.id));
    if (cat === 'pick') return (C().picks || []).filter((x) => store.owns('pick', x.id));
    return (C().blings || []).filter((x) => store.owns('bling', x.id));
  }
  const matches = (x) => (!lkQ || (x.name || '').toLowerCase().includes(lkQ)) && (!lkRar || x.rarity === lkRar);
  const equipOf = (catId, id) => store.data.equipped[catId] === id;

  function drawGrid() {
    gridWrap.innerHTML = '';
    const list = listFor().filter(matches);
    headCount.textContent = `${list.length} ${list.length === 1 ? 'ITEM' : 'ITENS'}`;

    if (cat === 'bling') {
      gridWrap.append(el('button', {
        class: `s3card icard empty lkNone ${blingOf() ? '' : 'equipped'}`,
        style: { '--d': '0' },
        onclick: () => { sfx.equip(); store.data.equipped.bling = null; store.bump('equips'); syncPreview(); drawSlots(); drawGrid(); },
      },
        el('div', { class: 'c3art' }, el('span', { class: 'lkEmpty big' }, '—')),
        el('div', { class: 'c3bar' }, el('span', { class: 'c3nm' }, 'SEM BACK BLING'))));
    }
    if (!list.length && cat !== 'bling') {
      gridWrap.append(el('div', { class: 'lkVoid' }, 'NADA OBTIDO NESTA CATEGORIA — VISITE A LOJA'));
      return;
    }
    list.forEach((it, i) => {
      const Rr = rar(it.rarity);
      const eq = equipOf(cat, it.id);
      // skins show up WITH their hero inside the HERO rack (never as a dupe)
      const skinChips = cat === 'hero' ? skinsOf(it.id)
        .map((sid) => ({ sid, sk: heroById(sid) })).filter((x) => x.sk && store.owns('hero', x.sid)) : [];
      gridWrap.append(el('button', {
        class: `s3card icard lk2Card r-${it.rarity} ${eq ? 'equipped' : ''}`,
        style: { '--rc': Rr.color, '--d': String(Math.min(i, 12)) },
        onclick: () => {
          sfx.equip();
          if (cat === 'hero') store.equip('hero', it.id);
          else store.equip(cat, it.id);
          syncPreview(); drawSlots(); drawGrid();
        },
      },
        el('div', { class: 'c3art' }, el('img', { class: 'pixel iIco', src: it.art, alt: it.name })),
        el('div', { class: 'c3bar' }, el('span', { class: 'c3nm', title: it.name }, it.name)),
        skinChips.length ? el('div', { class: 'skinChips' }, ...skinChips.map(({ sid, sk }) =>
          el('button', {
            class: `skinChip ${store.data.equipped.hero === sid ? 'equipped' : ''}`,
            title: sk.name,
            onclick: (ev) => { ev.stopPropagation(); sfx.equip(); store.equip('hero', sid); syncPreview(); drawSlots(); drawGrid(); },
          }, el('img', { class: 'pixel', src: portraitOf(sid), alt: '' })))) : null));
    });
  }

  /* ---- rack tabs ---- */
  const catTabs = el('div', { class: 'lkCatTabs' });
  CATS.forEach(([id, label]) => catTabs.append(el('button', {
    class: `lkCatTab ${cat === id ? 'sel' : ''}`,
    onclick: () => { sfx.tab(); cat = id; drawSlots(); drawGrid(); drawTabs(); },
  }, label)));
  function drawTabs() {
    [...catTabs.children].forEach((b, i) => b.classList.toggle('sel', CATS[i][0] === cat));
  }

  /* ---- head: title + search + rarity dots ---- */
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

  syncPreview(); drawSlots(); drawGrid(); drawTabs();

  const left = el('div', { class: 'lk2Left' }, stage, slotsRow);
  const right = el('div', { class: 'lk2Right' }, head, catTabs, gridWrap);
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

export { preloadHero, frameSize, blingMeta };
