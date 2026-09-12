// Screens v3: lobby with combined backbling, shop item/bundle pages, categorized tasks.
import { el, fmt, pick, coinDataURL } from './util.js';
import { store } from './store.js';
import { sfx, confetti } from './fx.js';
import { deployMatch } from './match.js';
import { Animator } from './anim.js';
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
            if (anim) anim.setAnim('e_' + e.id.replace('emote_', ''));
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

/* ------------------------------ SHOP ------------------------------ */
let shopSel = null; // null | {kind:'item',type,id} | {kind:'bundle',id}
export function shopHome() { shopSel = null; }
export function renderShop() {
  killAnim();
  if (shopSel) return shopSel.kind === 'bundle' ? bundlePage(shopSel.id) : itemPage(shopSel.type, shopSel.id);
  return shopGrid();
}

const portraitOf = (id) => `assets/spr/${id}.png`;
function shopGrid() {
  const typeOf = (it) => C().heroes.includes(it) ? 'hero' : it.id.startsWith('pick') ? 'pick' : it.id.startsWith('glider') ? 'glider' : 'emote';
  function card(it, i, size = '') {
    const t = typeOf(it);
    const owned = store.owns(t, it.id);
    const Rr = rar(it.rarity);
    const art = t === 'hero'
      ? el('img', { class: 'pixel f2img', src: portraitOf(it.id), alt: it.name })
      : el('img', { class: 'pixel f2img item', src: it.art, alt: it.name });
    return el('button', {
      class: `fcard2 ${size} ${owned ? 'owned' : ''}`,
      style: { '--rc': Rr.color, animationDelay: `${Math.min(i * 20, 280)}ms` },
      onclick: () => { sfx.click(); shopSel = { kind: 'item', type: t, id: it.id }; bus.refresh(); }
    },
      el('div', { class: 'f2art' }, art,
        el('span', { class: 'rarlbl' }, Rr.label),
        owned ? el('span', { class: 'ownDot' }, '✓ OBTIDO') : el('span', { class: 'newTag' }, 'NOVO!')),
      el('div', { class: 'f2bar' },
        el('span', { class: 'f2nm' }, it.name),
        el('span', { class: 'f2pr' }, priceTag(it.price))));
  }
  function liveCard(h, i) {
    const Rr = rar(h.rarity);
    const cv = el('canvas', { class: 'pixel f2live' });
    const b = el('button', {
      class: 'fcard2 xl live', style: { '--rc': Rr.color, animationDelay: `${i * 20}ms` },
      onclick: () => { sfx.click(); shopSel = { kind: 'item', type: 'hero', id: h.id }; bus.refresh(); }
    },
      el('div', { class: 'f2art' }, cv, el('span', { class: 'rarlbl' }, Rr.label), el('span', { class: 'liveTag' }, 'SKIN AO VIVO')),
      el('div', { class: 'f2bar' }, el('span', { class: 'f2nm' }, h.name), el('span', { class: 'f2pr' }, priceTag(h.price))));
    const a = new Animator(cv, 4); a.load(h.id, null); liveAnims.push(a);
    return b;
  }
  function bundleBlock(b, i) {
    const Rr = rar(b.rarity);
    const value = b.items.reduce((sum, id) => { const f = store.findItem(id); return sum + (f ? f.item.price : 0); }, 0);
    const heroF = b.items.map((id) => store.findItem(id)).find((f) => f && f.type === 'hero');
    const wrap = el('div', { class: 'bBlock' });
    wrap.append(el('button', {
      class: 'fcard2 bundle xl',
      style: { '--rc': Rr.color, animationDelay: `${i * 40}ms` },
      onclick: () => { sfx.click(); shopSel = { kind: 'bundle', id: b.id }; bus.refresh(); }
    },
      el('div', { class: 'f2art bArt' },
        el('div', { class: 'bItems' }, b.items.slice(0, 2).map((id) => {
          const f = store.findItem(id);
          return f ? el('img', { class: 'pixel', src: f.item.art, alt: '' }) : null;
        })),
        heroF ? el('img', { class: 'pixel f2img big', src: portraitOf(heroF.item.id), alt: '' }) : null,
        el('span', { class: 'savePill' }, `ECONOMIZE ${fmt(value - b.price)}`)),
      el('div', { class: 'f2bar' },
        el('span', { class: 'f2nm' }, `${b.name} · ${b.items.length} ITENS`),
        el('span', { class: 'f2pr' }, priceTag(b.price), el('s', { class: 'oldPr' }, fmt(value))))));
    b.items.forEach((id, j) => {
      const f = store.findItem(id);
      if (f) wrap.append(card(f.item, i + j, 'bItem'));
    });
    return wrap;
  }

  const bundles = el('div', { class: 'bWrap' });
  C().bundles.forEach((b, i) => bundles.append(bundleBlock(b, i)));
  const outfits = el('div', { class: 'f2grid' });
  C().heroes.forEach((h, i) => {
    if (i === 0) outfits.append(liveCard(h, i));
    else outfits.append(card(h, i, i % 7 === 3 ? 'wide' : ''));
  });
  const emotes = el('div', { class: 'f2grid small' });
  C().emotes.forEach((it, i) => emotes.append(card(it, i, i % 5 === 2 ? 'wide' : '')));
  const gear = el('div', { class: 'f2grid small' });
  [...C().picks, ...C().gliders].forEach((it, i) => gear.append(card(it, i, i % 6 === 0 ? 'wide' : '')));

  const now = new Date(); const end = new Date(now); end.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((end - now) / 60000));
  return el('div', { class: 'col scroll screen-anim in-shop shopBg', style: { height: '100%' } },
    el('div', { class: 'shopHead' },
      el('div', { class: 'shopTitle' }, 'LOJA DE ITENS'),
      el('span', { class: 'shopTimer' },
        store.data.dev.noCooldown ? 'MODO TESTE — ESTOQUE LIBERADO' : `NOVO ESTOQUE EM ${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`)),
    el('div', { class: 'secTitle' }, 'PACOTES'), bundles,
    el('div', { class: 'secTitle' }, 'TRAJES'), outfits,
    el('div', { class: 'secTitle' }, 'EMOTES'), emotes,
    el('div', { class: 'secTitle' }, 'RELÍQUIAS & BACK BLING'), gear);
}

function buyButton(type, id, price, after) {
  const owned = store.owns(type, id);
  const eq = store.data.equipped[type === 'hero' ? 'hero' : type === 'pick' ? 'pick' : type === 'glider' ? 'glider' : 'emote'] === id;
  if (!owned) return el('button', {
    class: 'btn',
    onclick: () => {
      const doBuy = () => {
        if (store.buy(type, id, price)) { sfx.buy(); confetti(40); toast('COMPRADO!', 'gold'); after && after(); bus.refresh(); }
        else {
          sfx.deny();
          const pill = document.getElementById('coinPill');
          pill.classList.add('deny'); setTimeout(() => pill.classList.remove('deny'), 350);
          toast('MOEDAS INSUFICIENTES', 'red');
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
  if (!eq) return el('button', { class: 'btn blue', onclick: () => { sfx.equip(); store.equip(type, id); toast('EQUIPADO', 'green'); bus.refresh(); } }, type === 'hero' ? 'ESCOLHER HERÓI' : 'EQUIPAR');
  return el('span', { class: 'ownedTag' }, '★ EQUIPADO');
}

function previewPanel(heroId, gliderId, bigIcon, mainArt) {
  const cv = el('canvas', { class: 'hero pixel' });
  const box = el('div', { class: 'prevPanel pixelbox' },
    el('div', { class: 'prevBg' }),
    mainArt ? el('div', { class: 'mainArt' }, mainArt) : cv,
    bigIcon ? el('div', { class: 'sideIcon' }, bigIcon) : null,
    el('div', { class: 'floorGlow', style: { '--rc': '#35e0ff' } }));
  if (!mainArt) { anim = new Animator(cv, 6); anim.load(heroId, gliderId); }
  box.append(animChips(box));
  return box;
}

function itemPage(type, id) {
  const f = store.findItem(id);
  const it = f.item;
  const Rr = rar(it.rarity);
  const hero = type === 'hero' ? it : heroOf();
  const glider = type === 'glider' ? id : gliderOf();
  const bigIcon = type === 'glider' ? null : artImg(it, 96);

  const details = el('div', { class: 'col', style: { flex: '1', gap: '10px' } },
    el('div', { class: 'spotRar', style: { color: Rr.color } }, Rr.label),
    el('h2', { class: 'itemName' }, it.name),
    el('p', { class: 'itemDesc' }, it.desc),
    type === 'hero' ? el('p', { class: 'itemQuote' }, `“${it.quote || ''}”`) : null,
    type === 'hero' ? statBars(id) : null,
    el('div', { class: 'priceLine' }, priceTag(it.price), store.owns(type, id) ? el('span', { style: { color: '#7dffb0', fontSize: '16px' } }, ' · OBTIDO') : null),
    el('div', { class: 'actions' }, buyButton(type, id, it.price)));

  return el('div', { class: 'col screen-anim in-page', style: { height: '100%', gap: '12px' } },
    el('div', { class: 'pageHead' },
      el('button', { class: 'btn ghost', onclick: () => { sfx.click(); shopSel = null; bus.refresh(); } }, '◂ VOLTAR'),
      el('div', { class: 'panelTitle' }, 'LOJA DE ITENS')),
    el('div', { class: 'cols', style: { flex: '1', minHeight: '0' } },
      previewPanel(hero.id, glider, bigIcon, (type === 'pick' || type === 'emote') ? artImg(it, 170) : null),
      details));
}

function bundlePage(id) {
  const b = C().bundles.find((x) => x.id === id);
  const Rr = rar(b.rarity);
  const firstHero = b.items.map((i) => store.findItem(i)).find((f) => f && f.type === 'hero');
  const glider = b.items.find((i) => i.startsWith('glider'));
  const value = b.items.reduce((s, i) => { const f = store.findItem(i); return s + (f ? f.item.price : 0); }, 0);

  const rows = el('div', { class: 'col', style: { gap: '6px' } });
  b.items.forEach((iid) => {
    const f = store.findItem(iid);
    if (!f) return;
    rows.append(el('div', { class: 'inclRow pixelbox' },
      el('div', { class: 'tile' }, artImg(f.item, 40)),
      el('div', { style: { flex: '1' } },
        el('div', { style: { fontSize: '18px' } }, f.item.name),
        el('div', { style: { fontSize: '14px', color: rar(f.item.rarity).color } }, rar(f.item.rarity).label)),
      priceTag(f.item.price),
      store.owns(f.type, iid) ? el('span', { style: { color: '#7dffb0', fontSize: '14px' } }, 'OBTIDO') : null));
  });

  const allOwned = b.items.every((i) => { const f = store.findItem(i); return f && store.owns(f.type, i); });
  const buy = el('button', {
    class: 'btn',
    onclick: () => {
      if (store.buyBundle(b)) { sfx.buy(); confetti(70); toast(`PACOTE DESBLOQUEADO: ${b.name}`, 'gold'); bus.refresh(); }
      else { sfx.deny(); toast('MOEDAS INSUFICIENTES', 'red'); }
    }
  }, 'COMPRAR PACOTE ', priceTag(b.price));

  const details = el('div', { class: 'col', style: { flex: '1', gap: '10px' } },
    el('div', { class: 'spotRar', style: { color: Rr.color } }, `${Rr.label} PACOTE`),
    el('h2', { class: 'itemName' }, b.name),
    el('p', { class: 'itemDesc' }, b.desc),
    el('div', { class: 'priceLine' }, priceTag(b.price),
      el('span', { style: { color: 'var(--dim)', fontSize: '15px' } }, ` · VALOR ${fmt(value)} · ECONOMIZE ${fmt(value - b.price)}`)),
    el('div', { class: 'panelTitle' }, 'INCLUÍDO'), rows,
    el('div', { class: 'actions' }, allOwned ? el('span', { class: 'ownedTag' }, 'TUDO OBTIDO') : buy));

  return el('div', { class: 'col screen-anim in-page', style: { height: '100%', gap: '12px' } },
    el('div', { class: 'pageHead' },
      el('button', { class: 'btn ghost', onclick: () => { sfx.click(); shopSel = null; bus.refresh(); } }, '◂ VOLTAR'),
      el('div', { class: 'panelTitle' }, 'PACOTE')),
    el('div', { class: 'cols', style: { flex: '1', minHeight: '0' } },
      previewPanel(firstHero ? firstHero.item.id : heroOf().id, glider || gliderOf(), null),
      details));
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
