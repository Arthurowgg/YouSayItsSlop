// Screens v3: lobby with combined backbling, shop item/bundle pages, categorized tasks.
import { el, fmt, pick, coinDataURL } from './util.js';
import { store } from './store.js';
import { sfx, confetti } from './fx.js';
import { deployMatch } from './match.js';
import { Animator } from './anim.js';
import { playEmote } from './emotes.js';
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
const styleOf = () => C().styles.find((s) => s.id === store.data.equipped.style) || C().styles[0];
const gliderOf = () => store.data.equipped.glider;

function artImg(item, size) {
  const img = el('img', { class: 'pixel', src: item.art, alt: item.name });
  if (size) { img.style.width = size + 'px'; img.style.height = size + 'px'; }
  return img;
}
function priceTag(n) {
  return el('span', { class: 'price' }, el('img', { src: coinDataURL(12), class: 'pixel', alt: '' }), fmt(n));
}
function statBars(id) {
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  const v = (s) => 3 + ((h >> s) % 8);
  return el('div', { class: 'statbars' },
    [['POWER', v(1)], ['SPEED', v(3)], ['UTILITY', v(5)]].map(([label, n]) =>
      el('div', { class: 'sbar' },
        el('span', {}, label),
        el('div', { class: 'track' }, el('i', { style: { width: `${n * 10}%` } })))));
}

function animChips(stageEl, emoteOnly) {
  const chips = el('div', { class: 'animChips' });
  if (!emoteOnly) [['idle', 'PARADO'], ['walk', 'ANDAR'], ['attack', 'ATACAR'], ['power', 'PODER']].forEach(([id, label], i) => {
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
  const picker = el('div', { class: 'animChips picker', style: { display: 'none' } });
  chips.append(el('button', {
    class: 'chip',
    onclick: () => {
      sfx.click();
      picker.innerHTML = '';
      C().emotes.filter((e) => store.owns('emote', e.id)).forEach((e) => {
        picker.append(el('button', {
          class: 'chip',
          onclick: () => {
            sfx.claim();
            if (anim) playEmote(anim, e.id);
            store.bump('emotes');
            picker.style.display = 'none';
            if (!store.data.settings.emoteNotes) return;
            for (let i = 0; i < 4; i++) setTimeout(() => {
              const n = el('span', { class: 'note' }, ['♪', '♫', ''][i % 3]);
              n.style.left = 42 + Math.random() * 16 + '%';
              n.style.top = 26 + Math.random() * 18 + '%';
              (stageEl || document.body).append(n);
              setTimeout(() => n.remove(), 1100);
            }, i * 160);
          }
        }, el('img', { class: 'chipIcon pixel', src: e.art, alt: '' }), e.name));
      });
      picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
    }
  }, 'EMOTE ▾'));
  (stageEl || chips).append(picker);
  return chips;
}

/* ------------------------------ PLAY / LOBBY (fullscreen) ------------------------------ */
let lastModeId = null;
export function renderPlay() {
  killAnim();
  const modes = C().modes, maps = C().maps;
  let mode = modes.find((m) => m.id === lastModeId) || modes[0];
  let map = maps.find((m) => m.id === store.data.lastMap) || pick(maps);
  store.data.lastMap = map.id;

  const hero = heroOf();
  const R = rar(hero.rarity);

  const bg = el('div', { class: 'bgmap', style: { backgroundImage: `url('${map.art}')` } });

  const playBtn = el('button', { class: 'btn playBig', onclick: () => { sfx.launch(); deployMatch(mode); } }, 'JOGAR');

  const modeIcon = el('img', { class: 'pixel', src: mode.tile, alt: '' });
  const modeName = el('div', { class: 'rn' }, mode.name);
  const modeSub = el('div', { class: 'rs' }, `${mode.players} JOGADORES · x${mode.mult} MOEDAS`);
  const modeRect = el('button', { class: 'hudRect', onclick: () => openModePrompt() },
    modeIcon, el('div', { class: 'rt' }, el('div', { class: 'rl' }, 'MODO DE JOGO'), modeName, modeSub));

  const mapThumb = el('img', { class: 'pixel mapTh', src: map.art, alt: '' });
  const mapName = el('div', { class: 'rn' }, map.name);
  const mapRect = el('button', {
    class: 'hudRect',
    onclick: () => {
      sfx.click(); map = pick(maps); store.data.lastMap = map.id;
      mapThumb.src = map.art; mapName.textContent = map.name;
      bg.style.backgroundImage = `url('${map.art}')`; store.persist();
    }
  }, mapThumb, el('div', { class: 'rt' }, el('div', { class: 'rl' }, 'PRÓXIMO MAPA · TOQUE P/ TROCAR'), mapName));

  function openModePrompt() {
    sfx.tab();
    const grid = el('div', { class: 'mpGrid' });
    const root = el('div', { class: 'modePrompt' });
    function close() { root.remove(); }
    function draw() {
      grid.innerHTML = '';
      modes.forEach((m) => grid.append(el('button', {
        class: `mpCard ${m.id === mode.id ? 'sel' : ''}`,
        onclick: () => { sfx.equip(); mode = m; lastModeId = m.id; modeIcon.src = m.tile; modeName.textContent = m.name; modeSub.textContent = `${m.players} JOGADORES · x${m.mult} MOEDAS`; draw(); setTimeout(close, 120); }
      },
        el('img', { class: 'pixel', src: m.tile, alt: '' }),
        el('h3', {}, m.name),
        el('p', {}, m.desc || ''),
        el('span', { class: 'mpMeta' }, `${m.players} JOGADORES · x${m.mult} MOEDAS`),
        m.id === mode.id ? el('span', { class: 'mpSel' }, 'SELECIONADO') : null)));
    }
    draw();
    root.append(
      el('div', { class: 'mpHead' },
        el('div', { class: 'panelTitle' }, 'SELECIONAR MODO'),
        el('button', { class: 'btn ghost', onclick: () => { sfx.click(); close(); } }, '✕ FECHAR')),
      grid);
    document.getElementById('modalRoot').append(root);
  }

  const modeStrip = el('div', { class: 'modeStrip' }, modes.map((m, ix) => el('button', {
    class: `msCard ${m.id === mode.id ? 'sel' : ''}`, title: m.desc,
    onclick: () => {
      sfx.equip(); mode = m; lastModeId = m.id;
      modeIcon.src = m.tile; modeName.textContent = m.name;
      modeSub.textContent = `${m.players} JOGADORES · x${m.mult} MOEDAS`;
      [...modeStrip.children].forEach((x, j) => x.classList.toggle('sel', j === ix));
    }
  }, el('img', { class: 'pixel', src: m.tile, alt: '' }), el('span', {}, m.name))));

  const canvas = el('canvas', { class: 'hero pixel' });
  const emoteChips = animChips(null, true);
  emoteChips.classList.add('lobbyEmote');

  const stage = el('div', { class: 'stage full in-play' },
    bg,
    el('div', { class: 'shade soft' }),
    modeStrip,
    el('div', { class: 'stageStats' },
      el('span', { class: 'chip' }, `PARTIDAS ${store.data.stats.matches}`),
      el('span', { class: 'chip' }, `VITÓRIAS ${store.data.stats.wins}`),
      el('span', { class: 'chip link', onclick: () => bus.gotoTab && bus.gotoTab('locker') }, 'ARMÁRIO ▸')),
    el('div', { class: 'heroWrap' }, canvas, el('div', { class: 'floorGlow', style: { '--rc': R.color } })),
    el('div', { class: 'heroPlate' },
      el('div', { class: 'pn' }, `${hero.name} · ${styleOf().name}`),
      el('div', { class: 'pq' }, `“${hero.quote || ''}”`)),
    el('div', { class: 'hud' },
      playBtn,
      emoteChips,
      el('div', { class: 'hudR' }, modeRect, mapRect))
  );
  const heroScale = { S: 6, M: 8, L: 10 }[store.data.settings.heroSize] || 8;
  anim = new Animator(canvas, heroScale);
  if (styleOf().filter !== 'none') canvas.style.filter = styleOf().filter;
  anim.load(hero.id, gliderOf());

  return stage;
}

/* ------------------------------ SHOP v2: cohesive pixel storefront ------------------------------ */
let shopSel = null; // null | {kind:'item',type,id} | {kind:'bundle',id}
export function shopHome() { shopSel = null; }
export function renderShop() {
  killAnim();
  if (shopSel) return shopSel.kind === 'bundle' ? bundlePage(shopSel.id) : itemPage(shopSel.type, shopSel.id);
  return shopGrid();
}

const portraitOf = (id) => `assets/spr/${id}.png`;
const dayIdx = () => { const d = new Date(); return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5); };
const typeOf = (it) => C().heroes.includes(it) ? 'hero' : it.id.startsWith('pick') ? 'pick' : it.id.startsWith('glider') ? 'glider' : 'emote';
const TYPE_LBL = { hero: 'TRAJE', pick: 'RELÍQUIA', glider: 'BACK BLING', emote: 'EMOTE' };
const iconSrc = (f) => f.type === 'hero' ? portraitOf(f.item.id) : f.item.art;

function liveHeroCanvas(id, scale) {
  const cv = el('canvas', { class: 'pixel cardAnim' });
  const a = new Animator(cv, scale);
  a.load(id, null);
  liveAnims.push(a);
  return cv;
}
function tags(it, t) {
  const owned = store.owns(t, it.id);
  return [
    el('span', { class: 'rarlbl2' }, rar(it.rarity).label),
    owned ? el('span', { class: 'ownDot' }, '✓ OBTIDO') : el('span', { class: 'newTag' }, 'NOVO!'),
    el('span', { class: 'typeTag' }, TYPE_LBL[t]),
  ];
}

/* ---- item cards, one composition per cosmetic type ---- */
function heroCard(h, i, xl = false) {
  const Rr = rar(h.rarity);
  const cv = liveHeroCanvas(h.id, xl ? 5 : 3);
  return el('button', {
    class: `fcard2 hcard ${xl ? 'xl' : ''} ${store.owns('hero', h.id) ? 'owned' : ''}`,
    style: { '--rc': Rr.color, animationDelay: `${Math.min(i * 22, 300)}ms` },
    onclick: () => { sfx.click(); shopSel = { kind: 'item', type: 'hero', id: h.id }; bus.refresh(); }
  },
    el('div', { class: 'f2art hArt' }, cv, xl ? el('span', { class: 'liveTag' }, 'AO VIVO') : null, ...tags(h, 'hero')),
    el('div', { class: 'f2bar' }, el('span', { class: 'f2nm' }, h.name), el('span', { class: 'f2pr' }, priceTag(h.price))));
}
function emoteCard(e, i) {
  const Rr = rar(e.rarity);
  return el('button', {
    class: `fcard2 ecard ${store.owns('emote', e.id) ? 'owned' : ''}`,
    style: { '--rc': Rr.color, animationDelay: `${Math.min(i * 22, 300)}ms` },
    onclick: () => { sfx.click(); shopSel = { kind: 'item', type: 'emote', id: e.id }; bus.refresh(); }
  },
    el('div', { class: 'f2art eStage' },
      el('span', { class: 'eRing' }), el('span', { class: 'eRing r2' }),
      el('img', { class: 'pixel eIco', src: e.art, alt: e.name }),
      ...tags(e, 'emote')),
    el('div', { class: 'f2bar' }, el('span', { class: 'f2nm' }, e.name), el('span', { class: 'f2pr' }, priceTag(e.price))));
}
function gearCard(it, t, i) {
  const Rr = rar(it.rarity);
  return el('button', {
    class: `fcard2 gcard ${store.owns(t, it.id) ? 'owned' : ''}`,
    style: { '--rc': Rr.color, animationDelay: `${Math.min(i * 18, 300)}ms` },
    onclick: () => { sfx.click(); shopSel = { kind: 'item', type: t, id: it.id }; bus.refresh(); }
  },
    el('div', { class: 'f2art gStage' },
      el('span', { class: 'gSpot' }),
      el('img', { class: 'pixel gIco', src: it.art, alt: it.name }),
      el('span', { class: 'gBase' }),
      ...tags(it, t)),
    el('div', { class: 'f2bar' }, el('span', { class: 'f2nm' }, it.name), el('span', { class: 'f2pr' }, priceTag(it.price))));
}
function miniIcon(id) {
  const f = store.findItem(id);
  if (!f) return null;
  return el('span', { class: `miniIco ${f.type === 'hero' ? 'h' : ''}`, style: { '--rc': rar(f.item.rarity).color }, title: f.item.name },
    el('img', { class: 'pixel', src: iconSrc(f), alt: '' }));
}
function bundleCard(b, i) {
  const Rr = rar(b.rarity);
  const value = b.items.reduce((s, id) => { const f = store.findItem(id); return s + (f ? f.item.price : 0); }, 0);
  const heroF = b.items.map((id) => store.findItem(id)).find((f) => f && f.type === 'hero');
  return el('button', {
    class: 'fcard2 bundle bcard2',
    style: { '--rc': Rr.color, animationDelay: `${i * 40}ms` },
    onclick: () => { sfx.click(); shopSel = { kind: 'bundle', id: b.id }; bus.refresh(); }
  },
    el('div', { class: 'f2art bArt2' },
      el('div', { class: 'bMinis' }, b.items.map((id) => miniIcon(id))),
      heroF ? el('img', { class: 'pixel bHero', src: portraitOf(heroF.item.id), alt: '', width: 128, height: 128 }) : null,
      el('span', { class: 'savePill' }, `ECONOMIZE ${fmt(value - b.price)}`),
      el('span', { class: 'bCount' }, `${b.items.length} ITENS`)),
    el('div', { class: 'f2bar bBar' },
      el('span', { class: 'f2nm' }, b.name),
      el('span', { class: 'f2pr' }, priceTag(b.price), el('s', { class: 'oldPr' }, fmt(value)))));
}

/* ---- featured strips ---- */
function featBundle(b) {
  const Rr = rar(b.rarity);
  const value = b.items.reduce((s, id) => { const f = store.findItem(id); return s + (f ? f.item.price : 0); }, 0);
  const heroF = b.items.map((id) => store.findItem(id)).find((f) => f && f.type === 'hero');
  return el('button', {
    class: 'featBundle', style: { '--rc': Rr.color },
    onclick: () => { sfx.click(); shopSel = { kind: 'bundle', id: b.id }; bus.refresh(); }
  },
    el('div', { class: 'fbArt' },
      heroF ? liveHeroCanvas(heroF.item.id, 4) : null,
      el('span', { class: 'fbFloor', style: { '--rc': Rr.color } })),
    el('div', { class: 'fbMid' },
      el('span', { class: 'fbTag' }, '★ PACOTE EM DESTAQUE'),
      el('div', { class: 'fbName' }, b.name),
      el('div', { class: 'fbDesc' }, b.desc),
      el('div', { class: 'fbMinis' }, b.items.map((id) => miniIcon(id)))),
    el('div', { class: 'fbRight' },
      el('span', { class: 'savePill big' }, `-${Math.round((1 - b.price / value) * 100)}%`),
      el('div', { class: 'fbPrice' }, priceTag(b.price), el('s', { class: 'oldPr' }, fmt(value))),
      el('span', { class: 'fbCta' }, 'VER PACOTE ▸')));
}
function featHero(h) {
  const Rr = rar(h.rarity);
  return el('button', {
    class: 'featHero', style: { '--rc': Rr.color },
    onclick: () => { sfx.click(); shopSel = { kind: 'item', type: 'hero', id: h.id }; bus.refresh(); }
  },
    el('div', { class: 'fhArt' }, liveHeroCanvas(h.id, 4), el('span', { class: 'fbFloor', style: { '--rc': Rr.color } })),
    el('div', { class: 'fhMid' },
      el('span', { class: 'fbTag' }, '◆ HERÓI EM DESTAQUE'),
      el('div', { class: 'fbName' }, h.name),
      el('div', { class: 'fhRar', style: { color: Rr.color } }, `${Rr.label} · SÉRIE ESPECIAL`)),
    el('div', { class: 'fhRight' }, priceTag(h.price), el('span', { class: 'fbCta' }, 'INSPECIONAR ▸')));
}

/* ---- grid page ---- */
function shopGrid() {
  const bundles = C().bundles;
  const featB = bundles[dayIdx() % bundles.length];
  const specials = C().heroes.filter((h) => h.rarity === 'marvel' || h.rarity === 'legendary');
  const featH = specials[dayIdx() % specials.length] || C().heroes[0];

  const now = new Date(); const end = new Date(now); end.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((end - now) / 60000));
  const timer = store.data.dev.noCooldown ? 'MODO TESTE — ESTOQUE LIBERADO'
    : `NOVO ESTOQUE EM ${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

  const sec = (title, grid, extra) => el('div', { class: 'secHead' },
    el('div', { class: 'secTitle' }, title), grid, extra || null);

  const bGrid = el('div', { class: 'bGrid2' });
  bundles.forEach((b, i) => bGrid.append(bundleCard(b, i)));
  const hGrid = el('div', { class: 'hGrid' });
  C().heroes.forEach((h, i) => hGrid.append(heroCard(h, i, i === 0)));
  const eGrid = el('div', { class: 'eGrid' });
  C().emotes.forEach((e, i) => eGrid.append(emoteCard(e, i)));
  const pGrid = el('div', { class: 'gGrid' });
  C().picks.forEach((p, i) => pGrid.append(gearCard(p, 'pick', i)));
  const glGrid = el('div', { class: 'gGrid' });
  C().gliders.forEach((g, i) => glGrid.append(gearCard(g, 'glider', i)));

  return el('div', { class: 'shop2 scroll in-shop', style: { height: 'calc(100% + 28px)' } },
    el('div', { class: 'shop2bg', 'aria-hidden': 'true' },
      el('div', { class: 's2sky' }), el('div', { class: 's2stars' }), el('div', { class: 's2stars s2' }),
      el('div', { class: 's2glow a', style: { '--rc': rar(featB.rarity).color } }),
      el('div', { class: 's2glow b', style: { '--rc': rar(featH.rarity).color } }),
      el('div', { class: 's2line' }), el('div', { class: 's2skyline' })),
    el('div', { class: 'shop2inner' },
      el('header', { class: 'shop2head' },
        el('div', { class: 's2hL' },
          el('span', { class: 's2kicker' }, 'LOJA DE ITENS · COLEÇÃO NOITE DE NÉON'),
          el('h1', { class: 's2title' }, 'BAZAR HERÓICO'),
          el('span', { class: 's2sub' }, 'Trajes, relíquias, back bling e emotes — pixel por pixel.')),
        el('div', { class: 's2hR' }, el('span', { class: 'shopTimer2' }, '⏳ ', timer))),
      el('div', { class: 'featRow' }, featBundle(featB), featHero(featH)),
      sec('PACOTES', bGrid, el('span', { class: 'secCount' }, `${bundles.length} OFERTAS`)),
      sec('TRAJES', hGrid, el('span', { class: 'secCount' }, `${C().heroes.length} HERÓIS`)),
      sec('EMOTES', eGrid, el('span', { class: 'secCount' }, `${C().emotes.length} EMOTES`)),
      sec('RELÍQUIAS', pGrid, el('span', { class: 'secCount' }, `${C().picks.length} PICARETAS`)),
      sec('BACK BLING', glGrid, el('span', { class: 'secCount' }, `${C().gliders.length} ASAS`))));
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
  } else if (type === 'emote') {
    const cv = el('canvas', { class: 'hero pixel' });
    box.append(
      el('div', { class: 'shStage' }, cv, el('div', { class: 'shShadow', style: { '--rc': Rr.color } }), el('div', { class: 'shPlatform' })),
      el('div', { class: 'shSide' }, el('img', { class: 'pixel', src: it.art, alt: '' })),
      el('div', { class: 'animChips emotePlay' }, el('span', { class: 'chip sel' }, '▸ ANIMAÇÃO DO EMOTE')));
    anim = new Animator(cv, 7);
    anim.load(heroOf().id, null);
    playEmote(anim, it.id);
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

  const details = el('div', { class: 'col det2' },
    el('div', { class: 'detTags' },
      el('span', { class: 'typeTag big' }, TYPE_LBL[type]),
      el('span', { class: 'spotRar', style: { color: Rr.color } }, Rr.label)),
    el('h2', { class: 'itemName' }, it.name),
    el('p', { class: 'itemDesc' }, it.desc),
    type === 'hero' ? el('p', { class: 'itemQuote' }, `“${it.quote || ''}”`) : null,
    type === 'hero' ? statBars(id) : null,
    el('div', { class: 'priceLine' }, priceTag(it.price), store.owns(type, id) ? el('span', { class: 'ownedNote' }, ' · OBTIDO') : null),
    el('div', { class: 'actions' }, buyButton(type, id, it.price)));

  return el('div', { class: 'page2 in-page', style: { '--rc': Rr.color } },
    el('div', { class: 'shop2bg', 'aria-hidden': 'true' },
      el('div', { class: 's2sky' }), el('div', { class: 's2stars' }), el('div', { class: 's2skyline' })),
    el('div', { class: 'pageHead' },
      el('button', { class: 'btn ghost', onclick: () => { sfx.click(); shopSel = null; bus.refresh(); } }, '◂ VOLTAR'),
      el('div', { class: 'panelTitle' }, 'LOJA DE ITENS')),
    el('div', { class: 'cols2' }, showcase(type, it), details));
}

function bundlePage(id) {
  const b = C().bundles.find((x) => x.id === id);
  const Rr = rar(b.rarity);
  const firstHero = b.items.map((i) => store.findItem(i)).find((f) => f && f.type === 'hero');
  const value = b.items.reduce((s, i) => { const f = store.findItem(i); return s + (f ? f.item.price : 0); }, 0);

  const box = el('div', { class: 'show2 bShow', style: { '--rc': Rr.color } },
    el('div', { class: 'shAura' }), el('div', { class: 'shRays' }));
  const cv = el('canvas', { class: 'hero pixel' });
  box.append(el('div', { class: 'shStage' }, cv, el('div', { class: 'shShadow', style: { '--rc': Rr.color } }), el('div', { class: 'shPlatform' })),
    el('div', { class: 'bShowMinis' }, b.items.map((iid) => miniIcon(iid))));
  anim = new Animator(cv, 7);
  anim.load(firstHero ? firstHero.item.id : heroOf().id, null);

  const grid = el('div', { class: 'inclGrid' });
  b.items.forEach((iid) => {
    const f = store.findItem(iid);
    if (!f) return;
    const ir = rar(f.item.rarity);
    grid.append(el('button', {
      class: 'inclRow', style: { '--rc': ir.color },
      onclick: () => { sfx.click(); shopSel = { kind: 'item', type: f.type, id: iid }; bus.refresh(); }
    },
      el('span', { class: `irIco ${f.type === 'hero' ? 'h' : ''}` }, el('img', { class: 'pixel', src: iconSrc(f), alt: '' })),
      el('span', { class: 'irTxt' },
        el('span', { class: 'irNm' }, f.item.name),
        el('span', { class: 'irRar', style: { color: ir.color } }, `${ir.label} · ${TYPE_LBL[f.type]}`)),
      store.owns(f.type, iid) ? el('span', { class: 'irOwn' }, '✓') : priceTag(f.item.price),
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
    el('div', { class: 'detTags' },
      el('span', { class: 'typeTag big' }, 'PACOTE'),
      el('span', { class: 'spotRar', style: { color: Rr.color } }, `${Rr.label}`)),
    el('h2', { class: 'itemName' }, b.name),
    el('p', { class: 'itemDesc' }, b.desc),
    el('div', { class: 'priceLine' }, priceTag(b.price),
      el('span', { class: 'saveNote' }, ` VALOR ${fmt(value)} · ECONOMIZE ${fmt(value - b.price)}`)),
    el('div', { class: 'inclHead' }, el('div', { class: 'panelTitle' }, 'INCLUÍDO'), el('span', { class: 'secCount' }, `${b.items.length} ITENS`)),
    grid,
    el('div', { class: 'actions' }, allOwned ? el('span', { class: 'ownedTag' }, 'TUDO OBTIDO') : buy));

  return el('div', { class: 'page2 in-page', style: { '--rc': Rr.color } },
    el('div', { class: 'shop2bg', 'aria-hidden': 'true' },
      el('div', { class: 's2sky' }), el('div', { class: 's2stars' }), el('div', { class: 's2skyline' })),
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
/* ------------------------------ LOCKER (fortnite-style, owned only) ------------------------------ */
export function renderLocker() {
  killAnim();
  let cat = 'hero';
  const cats = [['hero', 'TRAJES'], ['glider', 'BACK BLING'], ['pick', 'RELÍQUIAS'], ['emote', 'EMOTES'], ['style', 'ESTILOS']];

  const canvas = el('canvas', { class: 'hero pixel' });
  const seriesTag = el('div', { class: 'lkSeries' }, '');
  const nameTag = el('div', { class: 'lkName' }, '');
  const quoteTag = el('div', { class: 'lkQuote' }, '');
  const loadoutRow = el('div', { class: 'lkLoadout' });

  function syncLoadout() {
    loadoutRow.innerHTML = '';
    const g = C().gliders.find((x) => x.id === gliderOf());
    const p = C().picks.find((x) => x.id === store.data.equipped.pick);
    const e = C().emotes.find((x) => x.id === store.data.equipped.emote);
    [[g, 'BACK BLING'], [p, 'RELÍQUIA'], [e, 'EMOTE']].forEach(([it, label]) => {
      loadoutRow.append(el('div', { class: 'lkSlot', title: label },
        it ? el('img', { class: 'pixel', src: it.art, alt: '' }) : el('span', { class: 'lkEmpty' }, '—'),
        el('span', {}, it ? it.name : `SEM ${label}`)));
    });
  }

  const stageBox = el('div', { class: 'lockerPrev2' },
    el('div', { class: 'floorGlow', style: { '--rc': rar(heroOf().rarity).color } }),
    canvas,
    el('div', { class: 'lkPlate' }, seriesTag, nameTag, quoteTag));
  const chips = animChips(stageBox);
  chips.classList.add('lkChips');

  function syncPreview() {
    const h = heroOf(); const Rr = rar(h.rarity);
    seriesTag.textContent = `${Rr.label} SÉRIE — TRAJE`;
    seriesTag.style.color = Rr.color;
    nameTag.textContent = h.name;
    quoteTag.textContent = `“${h.quote || ''}”`;
    stageBox.querySelector('.floorGlow').style.setProperty('--rc', Rr.color);
    canvas.style.filter = styleOf().filter === 'none' ? '' : styleOf().filter;
    if (anim) anim.load(h.id, gliderOf());
    syncLoadout();
  }
  anim = new Animator(canvas, 7);
  syncPreview();

  const catCol = el('div', { class: 'lkCats' });
  const headRow = el('div', { class: 'lkHead' });
  const gridWrap = el('div', { class: 'f2grid small lockerGrid' });
  let lkQ = '', lkRar = '';
  const lkTools = el('div', { class: 'lkTools' },
    el('input', { class: 'lkSearch', placeholder: 'PESQUISAR NO ARMÁRIO…', oninput: (ev) => { lkQ = ev.target.value.toLowerCase(); drawGrid(); } }));
  ['', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'marvel'].forEach((r) => {
    lkTools.append(el('button', {
      class: `lkF ${r === '' ? 'sel' : ''}`, style: r ? { '--rc': rar(r).color } : {},
      onclick: (ev) => { sfx.tab(); lkRar = r; [...lkTools.querySelectorAll('.lkF')].forEach((b) => b.classList.remove('sel')); ev.currentTarget.classList.add('sel'); drawGrid(); }
    }, r ? rar(r).label : 'TODOS'));
  });

  function drawCats() {
    catCol.innerHTML = '';
    cats.forEach(([id, label]) => catCol.append(el('button', {
      class: `lkCat ${id === cat ? 'sel' : ''}`,
      onclick: () => { sfx.tab(); cat = id; drawCats(); drawGrid(); }
    }, label)));
  }
  function drawGrid() {
    gridWrap.innerHTML = '';
    let list;
    if (cat === 'style') list = C().styles;
    else if (cat === 'hero') list = C().heroes.filter((x) => store.owns('hero', x.id));
    else if (cat === 'pick') list = C().picks.filter((x) => store.owns('pick', x.id));
    else if (cat === 'glider') list = C().gliders.filter((x) => store.owns('glider', x.id));
    else list = C().emotes.filter((x) => store.owns('emote', x.id));
    list = list.filter((x) => (!lkQ || (x.name || '').toLowerCase().includes(lkQ)) && (!lkRar || x.rarity === lkRar));
    headRow.innerHTML = '';
    headRow.append(el('span', { class: 'lkAll' }, `TODOS (${list.length})`));
    if (!list.length) {
      headRow.append(el('span', { class: 'lkNone' }, ' — NADA OBTIDO AINDA, VISITE A LOJA'));
      return;
    }
    list.forEach((it, i) => {
      const Rr = rar(it.rarity);
      const eq = cat === 'style' ? store.data.equipped.style === it.id : store.data.equipped[cat === 'hero' ? 'hero' : cat] === it.id;
      const art = cat === 'hero'
        ? el('img', { class: 'pixel f2img', src: portraitOf(it.id), alt: '' })
        : cat === 'style'
          ? el('img', { class: 'pixel f2img item', src: heroOf().art, style: { filter: it.filter }, alt: '' })
          : el('img', { class: 'pixel f2img item', src: it.art, alt: '' });
      gridWrap.append(el('button', {
        class: `fcard2 ${eq ? 'equipped' : ''}`,
        style: { '--rc': Rr.color, animationDelay: `${i * 20}ms` },
        onclick: () => {
          sfx.equip(); store.equip(cat === 'hero' ? 'hero' : cat, it.id);
          drawGrid(); syncPreview(); toast(`EQUIPADO ${it.name}`, 'green');
        }
      },
        el('div', { class: 'f2art' }, art,
          el('span', { class: 'rarlbl' }, Rr.label),
          eq ? el('span', { class: 'eqTag' }, 'EQUIPADO') : null),
        el('div', { class: 'f2bar' }, el('span', { class: 'f2nm' }, it.name))));
    });
  }
  drawCats(); drawGrid();

  const left = el('div', { class: 'lkLeft' }, stageBox, chips, loadoutRow);
  const right = el('div', { class: 'lkRight' }, catCol, el('div', { class: 'col', style: { flex: '1', minWidth: '0', gap: '10px' } }, lkTools, headRow, gridWrap));
  return el('div', { class: 'cols screen-anim in-locker lockerWrap' }, left, right);
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
          onclick: () => { if (store.claimTask(t)) { sfx.claim(); confetti(50); toast(`TAREFA CONCLUÍDA +${t.coins} MOEDAS`, 'gold'); bus.refresh(); } }
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
      el('button', { class: 'btn', onclick: () => { store.addCoins(100); sfx.claim(); toast('+100 MOEDAS', 'gold'); } }, '+100'),
      el('button', { class: 'btn', onclick: () => { store.addCoins(500); sfx.claim(); toast('+500 MOEDAS', 'gold'); } }, '+500'),
      el('button', { class: 'btn', onclick: () => { store.addCoins(5000); sfx.claim(); toast('+5000 MOEDAS', 'gold'); } }, '+5000'),
      el('button', { class: 'btn blue', onclick: () => { store.setCoins(500); sfx.click(); toast('BASE 500 RESTAURADA', 'green'); } }, 'BASE 500'),
      el('button', { class: 'btn blue', onclick: () => { store.setCoins(store.data.coins * 2); sfx.click(); toast('MOEDAS x2', 'green'); } }, 'x2')));
  wrap.append(el('div', { class: 'panelTitle' }, 'OPÇÕES'),
    el('div', { class: 'devRow' },
      el('button', { class: `btn ${store.data.dev.noCooldown ? '' : 'ghost'}`, onclick: () => { store.data.dev.noCooldown = !store.data.dev.noCooldown; store.emit('dev'); sfx.click(); bus.refresh(); } },
        `SEM COOLDOWN: ${store.data.dev.noCooldown ? 'LIG' : 'DESL'}`),
      el('button', { class: `btn ${store.data.dev.unlockAll ? '' : 'ghost'}`, onclick: () => { store.data.dev.unlockAll = !store.data.dev.unlockAll; store.emit('dev'); sfx.click(); bus.refresh(); } },
        `DESBLOQUEAR TUDO (TESTE): ${store.data.dev.unlockAll ? 'LIG' : 'DESL'}`),
      el('button', { class: 'btn dark', onclick: () => { store.resetTasks(); sfx.click(); toast('TAREFAS REARMADAS', 'green'); bus.refresh(); } }, 'REARMAR TAREFAS'),
      el('button', { class: 'btn danger', onclick: () => { store.resetAll(); sfx.deny(); toast('SAVE APAGADO', 'red'); } }, 'APAGAR SAVE')));
  wrap.append(el('div', { class: 'panelTitle' }, 'SAVE BRUTO'),
    el('pre', { class: 'save' }, JSON.stringify(store.data, null, 2)));
  return wrap;
}
