// Screens v3: lobby with combined backbling, shop item/bundle pages, categorized tasks.
import { el, fmt, pick, coinDataURL } from './util.js';
import { store } from './store.js';
import { sfx, confetti } from './fx.js';
import { deployMatch } from './match.js';
import { Animator } from './anim.js';
import { bus } from './bus.js';

const C = () => store.catalog;
const rar = (r) => C().rarities[r] || { label: r, color: '#fff' };

let anim = null;
function killAnim() { if (anim) { anim.destroy(); anim = null; } }

export function toast(msg, kind = '') {
  const t = el('div', { class: `toast ${kind}` }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 2400);
  setTimeout(() => t.remove(), 2800);
}

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

function animChips(stageEl) {
  const chips = el('div', { class: 'animChips' });
  [['idle', 'IDLE'], ['walk', 'WALK'], ['attack', 'ATTACK'], ['power', 'POWER']].forEach(([id, label], i) => {
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
  chips.append(el('button', {
    class: 'chip',
    onclick: () => {
      sfx.claim();
      if (anim) anim.setAnim('power');
      store.bump('emotes');
      for (let i = 0; i < 4; i++) setTimeout(() => {
        const n = el('span', { class: 'note' }, ['♪', '♫', ''][i % 3]);
        n.style.left = 42 + Math.random() * 16 + '%';
        n.style.top = 28 + Math.random() * 18 + '%';
        (stageEl || document.body).append(n);
        setTimeout(() => n.remove(), 1100);
      }, i * 160);
      setTimeout(() => anim && anim.setAnim('idle'), 1800);
    }
  }, 'EMOTE'));
  return chips;
}

/* ------------------------------ PLAY / LOBBY ------------------------------ */
let lastModeId = null;
export function renderPlay() {
  killAnim();
  const modes = C().modes, maps = C().maps;
  let mode = modes.find((m) => m.id === lastModeId) || modes[0];
  let map = maps.find((m) => m.id === store.data.lastMap) || pick(maps);
  store.data.lastMap = map.id;

  const hero = heroOf();
  const R = rar(hero.rarity);

  const modeList = el('div', { class: 'col', style: { gap: '6px' } });
  function drawModes() {
    modeList.innerHTML = '';
    modes.forEach((m) => modeList.append(el('div', {
      class: `modeRow pixelbox ${m.id === mode.id ? 'sel' : ''}`,
      onclick: () => { sfx.tab(); mode = m; lastModeId = m.id; drawModes(); }
    },
      el('div', { class: 'tile' }, el('img', { class: 'pixel', src: m.tile, alt: '' })),
      el('div', {}, el('h3', {}, m.name), el('p', {}, `${m.players} PLAYERS · x${m.mult} COINS`))
    )));
  }
  drawModes();

  const mapImg = el('img', { class: 'pixel', src: map.art, alt: map.name });
  const mapName = el('span', {}, map.name);
  const bg = el('div', { class: 'bgmap', style: { backgroundImage: `url('${map.art}')` } });
  const mapCard = el('div', { class: 'mapCard pixelbox' },
    el('span', { class: 'randTag' }, 'RANDOM AT START'),
    mapImg,
    el('div', { class: 'mname' }, mapName,
      el('button', {
        class: 'reroll', title: 'Reroll preview',
        onclick: () => { sfx.click(); map = pick(maps); store.data.lastMap = map.id; mapImg.src = map.art; mapName.textContent = map.name; bg.style.backgroundImage = `url('${map.art}')`; store.persist(); }
      }, ' REROLL'))
  );

  const playBtn = el('button', { class: 'btn big', onclick: () => { sfx.launch(); deployMatch(mode); } }, el('span', {}, 'PLAY'));

  const side = el('div', { class: 'lobbySide' },
    el('div', { class: 'panelTitle' }, 'GAME MODE'),
    modeList,
    el('div', { class: 'panelTitle' }, 'NEXT MAP'),
    mapCard,
    playBtn
  );

  const canvas = el('canvas', { class: 'hero pixel' });
  const stage = el('div', { class: 'stage' },
    bg,
    el('div', { class: 'shade' }),
    el('div', { class: 'stageStats' },
      el('span', { class: 'chip' }, `MATCHES ${store.data.stats.matches}`),
      el('span', { class: 'chip' }, `WINS ${store.data.stats.wins}`),
      el('span', { class: 'chip', onclick: () => bus.gotoTab && bus.gotoTab('locker') }, 'LOCKER ▸')),
    el('div', { class: 'heroWrap' }, canvas, el('div', { class: 'floorGlow', style: { '--rc': R.color } })),
    el('div', { class: 'heroPlate' },
      el('div', { class: 'pn' }, `${hero.name} · ${styleOf().name}`),
      el('div', { class: 'pq' }, `“${hero.quote || ''}”`))
  );
  stage.append(animChips(stage));

  anim = new Animator(canvas, 6);
  if (styleOf().filter !== 'none') canvas.style.filter = styleOf().filter;
  anim.load(hero.id, gliderOf());

  return el('div', { class: 'cols screen-anim' }, side, stage);
}

/* ------------------------------ SHOP ------------------------------ */
let shopSel = null; // null | {kind:'item',type,id} | {kind:'bundle',id}
export function renderShop() {
  killAnim();
  if (shopSel) return shopSel.kind === 'bundle' ? bundlePage(shopSel.id) : itemPage(shopSel.type, shopSel.id);
  return shopGrid();
}

function shopGrid() {
  const typeOf = (it) => C().heroes.includes(it) ? 'hero' : it.id.startsWith('pick') ? 'pick' : it.id.startsWith('glider') ? 'glider' : 'emote';
  function card(it, i) {
    const t = typeOf(it);
    const owned = store.owns(t, it.id);
    const Rr = rar(it.rarity);
    return el('button', {
      class: `card ${owned ? 'owned' : ''} ${['legendary', 'marvel'].includes(it.rarity) ? 'glow' : ''}`,
      style: { '--rc': Rr.color, animationDelay: `${Math.min(i * 20, 280)}ms` },
      onclick: () => { sfx.click(); shopSel = { kind: 'item', type: t, id: it.id }; bus.refresh(); }
    },
      el('div', { class: 'art' }, artImg(it)),
      el('div', { class: 'nm' }, it.name),
      el('div', { class: 'row' },
        el('span', { class: 'rar' }, Rr.label),
        owned ? el('span', { style: { color: '#7dffb0' } }, 'OWNED') : priceTag(it.price)));
  }
  function bundleCard(b, i) {
    const Rr = rar(b.rarity);
    const value = b.items.reduce((s, id) => { const f = store.findItem(id); return s + (f ? f.item.price : 0); }, 0);
    return el('button', {
      class: 'card bundle',
      style: { '--rc': Rr.color, animationDelay: `${i * 40}ms` },
      onclick: () => { sfx.click(); shopSel = { kind: 'bundle', id: b.id }; bus.refresh(); }
    },
      el('div', { class: 'bart' }, b.items.slice(0, 3).map((id) => {
        const f = store.findItem(id); return f ? artImg(f.item, 54) : null;
      })),
      el('div', { class: 'nm' }, b.name),
      el('div', { class: 'row' },
        el('span', { class: 'rar' }, `${b.items.length} ITEMS · VALUE ${fmt(value)}`),
        priceTag(b.price)),
      el('span', { class: 'tag' }, `-${Math.round((1 - b.price / Math.max(1, value)) * 100)}%`));
  }

  const bundles = el('div', { class: 'grid cards', style: { gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))' } });
  C().bundles.forEach((b, i) => bundles.append(bundleCard(b, i)));
  const heroesGrid = el('div', { class: 'grid cards' });
  C().heroes.forEach((h, i) => heroesGrid.append(card(h, i)));
  const dailyGrid = el('div', { class: 'grid cards' });
  [...C().picks, ...C().gliders, ...C().emotes].forEach((it, i) => dailyGrid.append(card(it, i)));

  const now = new Date(); const end = new Date(now); end.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((end - now) / 60000));
  return el('div', { class: 'col scroll screen-anim', style: { height: '100%' } },
    el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      el('div', { class: 'panelTitle' }, 'ITEM SHOP'),
      el('span', { style: { fontSize: '15px', color: 'var(--dim)' } },
        store.data.dev.noCooldown ? 'TEST MODE — STOCK NEVER LOCKS' : `NEW STOCK IN ${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`)),
    el('div', { class: 'panelTitle' }, 'BUNDLES'), bundles,
    el('div', { class: 'panelTitle', style: { marginTop: '10px' } }, 'FEATURED HEROES'), heroesGrid,
    el('div', { class: 'panelTitle', style: { marginTop: '10px' } }, 'RELICS · BACK BLING · EMOTES'), dailyGrid);
}

function buyButton(type, id, price, after) {
  const owned = store.owns(type, id);
  const eq = store.data.equipped[type === 'hero' ? 'hero' : type === 'pick' ? 'pick' : type === 'glider' ? 'glider' : 'emote'] === id;
  if (!owned) return el('button', {
    class: 'btn',
    onclick: () => {
      if (store.buy(type, id, price)) { sfx.buy(); confetti(40); toast('PURCHASED!', 'gold'); after && after(); bus.refresh(); }
      else {
        sfx.deny();
        const pill = document.getElementById('coinPill');
        pill.classList.add('deny'); setTimeout(() => pill.classList.remove('deny'), 350);
        toast('NOT ENOUGH COINS', 'red');
      }
    }
  }, 'BUY ', priceTag(price));
  if (!eq) return el('button', { class: 'btn blue', onclick: () => { sfx.equip(); store.equip(type, id); toast('EQUIPPED', 'green'); bus.refresh(); } }, type === 'hero' ? 'SELECT HERO' : 'EQUIP');
  return el('span', { class: 'ownedTag' }, '★ EQUIPPED');
}

function previewPanel(heroId, gliderId, bigIcon) {
  const cv = el('canvas', { class: 'hero pixel' });
  const box = el('div', { class: 'prevPanel pixelbox' },
    el('div', { class: 'prevBg' }),
    cv,
    bigIcon ? el('div', { class: 'sideIcon' }, bigIcon) : null,
    el('div', { class: 'floorGlow', style: { '--rc': '#35e0ff' } }));
  anim = new Animator(cv, 6);
  anim.load(heroId, gliderId);
  box.append(animChips(box));
  return box;
}

function itemPage(type, id) {
  const f = store.findItem(id);
  const it = f.item;
  const Rr = rar(it.rarity);
  const hero = type === 'hero' ? it : heroOf();
  const glider = type === 'glider' ? id : gliderOf();
  const bigIcon = type !== 'hero' && type !== 'glider' ? artImg(it, 96) : null;

  const details = el('div', { class: 'col', style: { flex: '1', gap: '10px' } },
    el('div', { class: 'spotRar', style: { color: Rr.color } }, Rr.label),
    el('h2', { class: 'itemName' }, it.name),
    el('p', { class: 'itemDesc' }, it.desc),
    type === 'hero' ? el('p', { class: 'itemQuote' }, `“${it.quote || ''}”`) : null,
    type === 'hero' ? statBars(id) : null,
    el('div', { class: 'priceLine' }, priceTag(it.price), store.owns(type, id) ? el('span', { style: { color: '#7dffb0', fontSize: '16px' } }, ' · OWNED') : null),
    el('div', { class: 'actions' }, buyButton(type, id, it.price)));

  return el('div', { class: 'col screen-anim', style: { height: '100%', gap: '12px' } },
    el('div', { class: 'pageHead' },
      el('button', { class: 'btn ghost', onclick: () => { sfx.click(); shopSel = null; bus.refresh(); } }, '◂ BACK'),
      el('div', { class: 'panelTitle' }, 'ITEM SHOP')),
    el('div', { class: 'cols', style: { flex: '1', minHeight: '0' } },
      previewPanel(hero.id, glider, bigIcon),
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
      store.owns(f.type, iid) ? el('span', { style: { color: '#7dffb0', fontSize: '14px' } }, 'OWNED') : null));
  });

  const allOwned = b.items.every((i) => { const f = store.findItem(i); return f && store.owns(f.type, i); });
  const buy = el('button', {
    class: 'btn',
    onclick: () => {
      if (store.buyBundle(b)) { sfx.buy(); confetti(70); toast(`BUNDLE UNLOCKED: ${b.name}`, 'gold'); bus.refresh(); }
      else { sfx.deny(); toast('NOT ENOUGH COINS', 'red'); }
    }
  }, 'BUY BUNDLE ', priceTag(b.price));

  const details = el('div', { class: 'col', style: { flex: '1', gap: '10px' } },
    el('div', { class: 'spotRar', style: { color: Rr.color } }, `${Rr.label} BUNDLE`),
    el('h2', { class: 'itemName' }, b.name),
    el('p', { class: 'itemDesc' }, b.desc),
    el('div', { class: 'priceLine' }, priceTag(b.price),
      el('span', { style: { color: 'var(--dim)', fontSize: '15px' } }, ` · VALUE ${fmt(value)} · SAVE ${fmt(value - b.price)}`)),
    el('div', { class: 'panelTitle' }, 'INCLUDED'), rows,
    el('div', { class: 'actions' }, allOwned ? el('span', { class: 'ownedTag' }, 'ALL OWNED') : buy));

  return el('div', { class: 'col screen-anim', style: { height: '100%', gap: '12px' } },
    el('div', { class: 'pageHead' },
      el('button', { class: 'btn ghost', onclick: () => { sfx.click(); shopSel = null; bus.refresh(); } }, '◂ BACK'),
      el('div', { class: 'panelTitle' }, 'BUNDLE')),
    el('div', { class: 'cols', style: { flex: '1', minHeight: '0' } },
      previewPanel(firstHero ? firstHero.item.id : heroOf().id, glider || gliderOf(), null),
      details));
}

/* ------------------------------ LOCKER ------------------------------ */
export function renderLocker() {
  killAnim();
  let cat = 'hero';
  const cats = [['hero', 'HEROES'], ['pick', 'RELICS'], ['glider', 'BACK BLING'], ['emote', 'EMOTES'], ['style', 'STYLES']];

  const canvas = el('canvas', { class: 'hero pixel' });
  const plate = el('div', { class: 'heroPlate', style: { position: 'static', transform: 'none', marginTop: '8px' } });
  const chips = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' } });
  [['idle', 'IDLE'], ['walk', 'WALK'], ['attack', 'ATTACK'], ['power', 'POWER']].forEach(([id, label], i) => {
    chips.append(el('button', {
      class: `chip ${i === 0 ? 'sel' : ''}`, style: { position: 'static' },
      onclick: (e) => { sfx.click(); if (anim) anim.setAnim(id); chips.querySelectorAll('.chip').forEach((c) => c.classList.remove('sel')); e.currentTarget.classList.add('sel'); }
    }, label));
  });
  const stageBox = el('div', { class: 'pixelbox lockerPrev' },
    el('div', { class: 'floorGlow', style: { '--rc': rar(heroOf().rarity).color, position: 'absolute', bottom: '86px' } }),
    canvas, plate, chips);

  function syncPreview() {
    plate.innerHTML = '';
    plate.append(el('div', { class: 'pn' }, `${heroOf().name} · ${styleOf().name}`),
      el('div', { class: 'pq' }, `“${heroOf().quote || ''}”`));
    canvas.style.filter = styleOf().filter === 'none' ? '' : styleOf().filter;
    if (anim) anim.load(heroOf().id, gliderOf());
  }
  anim = new Animator(canvas, 6);
  syncPreview();

  const catRow = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
  const gridWrap = el('div', { class: 'grid cards scroll', style: { alignContent: 'start' } });

  function drawCats() {
    catRow.innerHTML = '';
    cats.forEach(([id, label]) => catRow.append(el('button', {
      class: `chip ${id === cat ? 'sel' : ''}`, style: { position: 'static' },
      onclick: () => { sfx.tab(); cat = id; drawCats(); drawGrid(); }
    }, label)));
  }
  function drawGrid() {
    gridWrap.innerHTML = '';
    if (cat === 'style') {
      C().styles.forEach((s, i) => {
        const eq = store.data.equipped.style === s.id;
        gridWrap.append(el('button', {
          class: `card ${eq ? 'equipped' : ''}`, style: { '--rc': '#35e0ff', animationDelay: `${i * 20}ms` },
          onclick: () => { sfx.equip(); store.equip('style', s.id); syncPreview(); drawGrid(); }
        },
          el('div', { class: 'art' }, el('img', { class: 'pixel', src: heroOf().art, style: { filter: s.filter, width: '72px', height: '72px' } })),
          el('div', { class: 'nm' }, s.name),
          el('div', { class: 'row' }, el('span', { class: 'rar', style: { color: '#35e0ff' } }, 'STYLE'), eq ? el('span', { style: { color: '#7dffb0' } }, 'ON') : null)));
      });
      return;
    }
    const list = cat === 'hero' ? C().heroes : cat === 'pick' ? C().picks : cat === 'glider' ? C().gliders : C().emotes;
    list.forEach((it, i) => {
      const owned = store.owns(cat, it.id);
      const Rr = rar(it.rarity);
      const eq = store.data.equipped[cat === 'hero' ? 'hero' : cat] === it.id;
      gridWrap.append(el('button', {
        class: `card ${owned ? '' : 'locked'} ${eq ? 'equipped' : ''}`,
        style: { '--rc': Rr.color, animationDelay: `${i * 20}ms` },
        onclick: () => {
          if (!owned) { sfx.deny(); toast('NOT OWNED — GET IT IN THE SHOP', 'red'); return; }
          sfx.equip(); store.equip(cat, it.id); drawGrid(); syncPreview(); toast(`EQUIPPED ${it.name}`, 'green');
        }
      },
        el('div', { class: 'art' }, artImg(it)),
        el('div', { class: 'nm' }, it.name),
        el('div', { class: 'row' }, el('span', { class: 'rar' }, Rr.label), owned ? (eq ? el('span', { style: { color: '#7dffb0' } }, 'ON') : null) : el('span', { style: { fontSize: '13px', color: 'var(--dim)' } }, 'LOCKED'))));
    });
  }
  drawCats(); drawGrid();

  const left = el('div', { class: 'col', style: { flex: '1', maxWidth: '430px' } },
    el('div', { class: 'panelTitle' }, 'LOCKER'), stageBox);
  const right = el('div', { class: 'col', style: { flex: '1.4' } }, catRow, gridWrap);
  return el('div', { class: 'cols screen-anim' }, left, right);
}

/* ------------------------------ TASKS (categorized) ------------------------------ */
export function renderTasks() {
  killAnim();
  const wrap = el('div', { class: 'col scroll screen-anim', style: { height: '100%' } });
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
          el('div', { class: 'd' }, `${t.desc}  ·  ${t.type === 'daily' ? 'DAILY' : 'WEEKLY'}`),
          el('div', { class: 'bar' }, el('i', { style: { width: `${(p.cur / t.count) * 100}%`, background: `linear-gradient(90deg, ${catDef.color}, #fff)` } })),
          el('div', { class: 'meta' },
            el('span', {}, `${p.cur}/${t.count}`),
            el('span', { class: 'rwd' }, `+${t.coins} COINS`),
            el('span', { style: { color: 'var(--cyan)' } }, `+${t.xp} XP`))),
        el('button', {
          class: `btn ${p.done && !p.claimed ? '' : 'ghost'}`,
          disabled: !p.done || p.claimed,
          onclick: () => { if (store.claimTask(t)) { sfx.claim(); confetti(50); toast(`TASK COMPLETE +${t.coins} COINS`, 'gold'); bus.refresh(); } }
        }, p.claimed ? 'CLAIMED' : 'CLAIM')));
    });
    wrap.append(box);
  }
  if (store.data.dev.noCooldown)
    wrap.append(el('p', { style: { fontSize: '14px', color: 'var(--dim)' } }, 'TEST MODE: claimed tasks re-arm instantly — no cooldown.'));
  return wrap;
}

/* ------------------------------ DEV ------------------------------ */
export function renderDev() {
  killAnim();
  const wrap = el('div', { class: 'col scroll screen-anim', style: { height: '100%', gap: '12px' } });
  wrap.append(
    el('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
      el('div', { class: 'panelTitle' }, 'DEV / CURRENCY LAB'),
      el('span', { class: 'devBadge' }, 'TEST PURPOSE ONLY')),
    el('p', { style: { fontSize: '15px', color: 'var(--dim)' } },
      'Base test currency is 500 coins. Instant and cooldown-free, for validating the economy before the real game ships.'));
  wrap.append(el('div', { class: 'panelTitle' }, 'OBTAIN CURRENCY'),
    el('div', { class: 'devRow' },
      el('button', { class: 'btn', onclick: () => { store.addCoins(100); sfx.claim(); toast('+100 COINS', 'gold'); } }, '+100'),
      el('button', { class: 'btn', onclick: () => { store.addCoins(500); sfx.claim(); toast('+500 COINS', 'gold'); } }, '+500'),
      el('button', { class: 'btn', onclick: () => { store.addCoins(5000); sfx.claim(); toast('+5000 COINS', 'gold'); } }, '+5000'),
      el('button', { class: 'btn blue', onclick: () => { store.setCoins(500); sfx.click(); toast('RESET TO BASE 500', 'green'); } }, 'SET BASE 500'),
      el('button', { class: 'btn blue', onclick: () => { store.setCoins(store.data.coins * 2); sfx.click(); toast('COINS x2', 'green'); } }, 'x2')));
  wrap.append(el('div', { class: 'panelTitle' }, 'FLAGS'),
    el('div', { class: 'devRow' },
      el('button', { class: `btn ${store.data.dev.noCooldown ? '' : 'ghost'}`, onclick: () => { store.data.dev.noCooldown = !store.data.dev.noCooldown; store.emit('dev'); sfx.click(); bus.refresh(); } },
        `NO COOLDOWN: ${store.data.dev.noCooldown ? 'ON' : 'OFF'}`),
      el('button', { class: `btn ${store.data.dev.unlockAll ? '' : 'ghost'}`, onclick: () => { store.data.dev.unlockAll = !store.data.dev.unlockAll; store.emit('dev'); sfx.click(); bus.refresh(); } },
        `UNLOCK ALL (TEST): ${store.data.dev.unlockAll ? 'ON' : 'OFF'}`),
      el('button', { class: 'btn dark', onclick: () => { store.resetTasks(); sfx.click(); toast('TASKS RE-ARMED', 'green'); bus.refresh(); } }, 'RE-ARM TASKS'),
      el('button', { class: 'btn danger', onclick: () => { store.resetAll(); sfx.deny(); toast('SAVE WIPED', 'red'); } }, 'WIPE SAVE')));
  wrap.append(el('div', { class: 'panelTitle' }, 'RAW SAVE'),
    el('pre', { class: 'save' }, JSON.stringify(store.data, null, 2)));
  return wrap;
}
