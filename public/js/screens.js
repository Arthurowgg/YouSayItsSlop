// Screen renderers for each tab.
import { el, fmt, coinDataURL } from './util.js';
import { store } from './store.js';
import { sfx, confetti } from './fx.js';
import { deployMatch } from './match.js';
import { bus } from './bus.js';

const C = () => store.catalog;
const rar = (r) => C().rarities[r] || { label: r, color: '#fff' };

function artImg(item, size) {
  const img = el('img', { class: 'pixel', src: item.art, alt: item.name });
  if (size) { img.style.width = size + 'px'; img.style.height = size + 'px'; }
  return img;
}
function priceTag(n) {
  const c = el('img', { src: coinDataURL(12), class: 'pixel', alt: '' });
  return el('span', { class: 'price' }, c, fmt(n));
}

export function toast(msg, kind = '') {
  const t = el('div', { class: `toast ${kind}` }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 2600);
  setTimeout(() => t.remove(), 3000);
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

function itemModal(item, type) {
  const owned = store.owns(type, item.id);
  const R = rar(item.rarity);
  const isEquipped =
    (type === 'hero' && store.data.equipped.hero === item.id) ||
    (type === 'pick' && store.data.equipped.pick === item.id) ||
    (type === 'glider' && store.data.equipped.glider === item.id) ||
    (type === 'emote' && store.data.equipped.emote === item.id);

  const actions = [];
  if (!owned) {
    actions.push(el('button', {
      class: 'btn', onclick: () => {
        if (store.buy(type, item.id, item.price)) {
          sfx.buy(); confetti(40);
          toast(`PURCHASED ${item.name}!`, 'gold');
          m.close(); bus.refresh();
        } else {
          sfx.deny();
          document.getElementById('coinPill').classList.add('deny');
          setTimeout(() => document.getElementById('coinPill').classList.remove('deny'), 350);
          toast('NOT ENOUGH COINS', 'red');
        }
      }
    }, 'BUY ', priceTag(item.price)));
  } else if (!isEquipped) {
    actions.push(el('button', {
      class: 'btn blue', onclick: () => { sfx.equip(); store.equip(type, item.id); toast(`EQUIPPED ${item.name}`, 'green'); m.close(); bus.refresh(); }
    }, type === 'hero' ? 'SELECT HERO' : 'EQUIP'));
  } else {
    actions.push(el('span', { style: { color: '#7dffb0', fontSize: '9px', alignSelf: 'center' } }, '★ EQUIPPED'));
  }
  actions.push(el('button', { class: 'btn ghost', onclick: () => m.close() }, 'CLOSE'));

  const body = el('div', {},
    el('h2', {}, item.name),
    el('p', {}, item.desc),
    el('div', { class: 'mArt', style: { background: `radial-gradient(60% 60% at 50% 60%, ${R.color}33, transparent)` } }, artImg(item, 150)),
    el('p', { style: { color: R.color, marginBottom: '14px' } }, R.label),
    el('div', { class: 'actions' }, actions)
  );
  const m = modal(body);
}


function itemCard(item, type, i = 0) {
  const owned = store.owns(type, item.id);
  const R = rar(item.rarity);
  const isEq =
    store.data.equipped.hero === item.id || store.data.equipped.pick === item.id ||
    store.data.equipped.glider === item.id || store.data.equipped.emote === item.id;
  const card = el('button', {
    class: `card ${owned ? 'owned' : 'locked'} ${isEq ? 'equipped' : ''} ${['legendary', 'marvel'].includes(item.rarity) ? 'glow' : ''}`,
    style: { '--rc': R.color, animationDelay: `${Math.min(i * 40, 400)}ms` },
    onclick: () => { sfx.click(); itemModal(item, type); },
    onmouseenter: () => sfx.hover(),
  },
    el('div', { class: 'art' }, artImg(item)),
    el('div', { class: 'nm' }, item.name),
    el('div', { class: 'row' },
      el('span', { class: 'rar' }, R.label),
      owned ? el('span', { style: { color: '#7dffb0' } }, owned && isEq ? 'EQUIPPED' : 'OWNED') : priceTag(item.price)
    ),
    !owned ? el('span', { class: 'tag' }, 'SHOP') : null
  );
  return card;
}

/* ------------------------------ PLAY ------------------------------ */
let lastModeId = null, lastMapId = null;
export function renderPlay() {
  const modes = C().modes, maps = C().maps;
  let mode = modes.find((m) => m.id === lastModeId) || modes[0];
  let map = maps.find((m) => m.id === lastMapId) || maps[0];

  const hero = C().heroes.find((h) => h.id === store.data.equipped.hero) || C().heroes[0];
  const style = C().styles.find((s) => s.id === store.data.equipped.style) || C().styles[0];

  const heroImg = el('img', { class: 'heroImg pixel', src: hero.art, style: { filter: style.filter } });
  const pedestal = el('div', { class: 'pedestal pixelbox', style: { padding: '16px' } },
    el('div', { class: 'glow', style: { '--rc': rar(hero.rarity).color } }),
    heroImg,
    el('div', { class: 'floor' }),
    el('div', { class: 'heroName' }, hero.name),
    el('div', { style: { display: 'flex', gap: '8px', marginTop: '10px' } },
      el('button', { class: 'btn blue', onclick: playEmote }, 'EMOTE'),
    )
  );

  function playEmote() {
    sfx.click();
    store.bump('emotes'); // emits -> sync re-render; re-query fresh nodes below
    const img2 = document.querySelector('#screen .heroImg');
    const ped2 = img2 && img2.closest('.pedestal');
    if (img2) img2.classList.add('dance');
    for (let i = 0; i < 4; i++) setTimeout(() => {
      const n = el('span', { class: 'note' }, ['♪', '♫', '♩'][i % 3]);
      n.style.left = 40 + Math.random() * 40 + '%';
      n.style.top = 30 + Math.random() * 20 + '%';
      (ped2 || document.body).append(n);
      setTimeout(() => n.remove(), 1100);
    }, i * 180);
    setTimeout(() => img2 && img2.classList.remove('dance'), 1600);
  }

  const modeList = el('div', { class: 'col scroll', style: { gap: '10px' } });
  const mapRow = el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } });

  function drawModes() {
    modeList.innerHTML = '';
    modes.forEach((m, i) => {
      const hasTile = true;
      const card = el('div', {
        class: `modeCard pixelbox ${m.id === mode.id ? 'sel' : ''}`,
        style: { animationDelay: `${i * 50}ms` },
        onclick: () => { sfx.tab(); mode = m; lastModeId = m.id; drawModes(); },
      },
        el('div', { class: 'tile' }, el('img', { class: 'pixel', src: m.tile, alt: '' , onerror: (e) => { e.target.style.display='none'; e.target.parentNode.classList.add('fb'); e.target.parentNode.style.setProperty('--p1', '#123c66'); e.target.parentNode.style.setProperty('--p2', '#2aa7d8'); }})),
        el('div', {},
          el('h3', {}, m.name),
          el('p', {}, m.desc)
        )
      );
      card.classList.add('card'); card.style.setProperty('animation-name', 'cardIn');
      modeList.append(card);
    });
  }
  function drawMaps() {
    mapRow.innerHTML = '';
    maps.forEach((m) => mapRow.append(el('button', {
      class: `mapChip ${m.id === map.id ? 'sel' : ''}`,
      onclick: () => { sfx.click(); map = m; lastMapId = m.id; drawMaps(); }
    }, m.name)));
  }
  drawModes(); drawMaps();

  const launch = el('button', {
    class: 'btn big', onclick: () => { sfx.launch(); deployMatch(mode, map); }
  }, '▶ LAUNCH');

  const right = el('div', { class: 'col', style: { flex: '1.2' } },
    el('div', { class: 'panelTitle' }, 'GAME MODE'),
    modeList,
    el('div', { class: 'panelTitle' }, 'MAP'),
    mapRow,
    launch
  );

  const left = el('div', { class: 'col', style: { flex: '1' } },
    el('div', { class: 'panelTitle' }, 'LOBBY'),
    pedestal,
    el('div', { class: 'pixelbox', style: { padding: '10px', fontSize: '8px', color: 'var(--dim)', lineHeight: '1.8' } },
      `MATCHES ${store.data.stats.matches} · WINS ${store.data.stats.wins}`,
    )
  );

  return el('div', { class: 'cols screen-anim' }, left, right);
}

/* ------------------------------ SHOP ------------------------------ */
export function renderShop() {
  const wrap = el('div', { class: 'col scroll screen-anim', style: { height: '100%' } });
  const now = new Date();
  const end = new Date(now); end.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((end - now) / 60000));
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');

  wrap.append(el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
    el('div', { class: 'panelTitle' }, 'ITEM SHOP'),
    el('span', { style: { fontSize: '8px', color: 'var(--dim)' } },
      store.data.dev.noCooldown ? 'TEST MODE — STOCK NEVER LOCKS' : `NEW STOCK IN ${hh}:${mm}`)
  ));

  const feat = el('div', { class: 'grid cards' });
  C().heroes.forEach((h, i) => feat.append(itemCard(h, 'hero', i)));
  wrap.append(el('div', { class: 'panelTitle', style: { marginTop: '8px' } }, 'FEATURED — HEROES'), feat);

  const daily = el('div', { class: 'grid cards' });
  [...C().picks, ...C().gliders, ...C().emotes].forEach((it, i) => {
    const type = it.id.startsWith('pick') ? 'pick' : it.id.startsWith('glider') ? 'glider' : 'emote';
    daily.append(itemCard(it, type, i));
  });
  wrap.append(el('div', { class: 'panelTitle', style: { marginTop: '14px' } }, 'DAILY — GEAR · GLIDERS · EMOTES'), daily);
  return wrap;
}

/* ------------------------------ LOCKER ------------------------------ */
export function renderLocker() {
  let cat = 'hero';
  const cats = [
    ['hero', 'HEROES'], ['pick', 'PICKAXE'], ['glider', 'BACK BLING'], ['emote', 'EMOTES'], ['style', 'STYLES'],
  ];

  const hero = () => C().heroes.find((h) => h.id === store.data.equipped.hero) || C().heroes[0];
  const style = () => C().styles.find((s) => s.id === store.data.equipped.style) || C().styles[0];

  const heroImg = el('img', { class: 'heroImg pixel', src: hero().art, style: { filter: style().filter } });
  const preview = el('div', { class: 'col', style: { flex: '1' } },
    el('div', { class: 'panelTitle' }, 'LOCKER'),
    el('div', { class: 'pedestal pixelbox', style: { padding: '16px' } },
      el('div', { class: 'glow', style: { '--rc': rar(hero().rarity).color } }),
      heroImg,
      el('div', { class: 'floor' }),
      el('div', { class: 'heroName' }, `${hero().name} · ${style().name}`),
      el('div', { style: { display: 'flex', gap: '8px', marginTop: '10px' } },
        el('button', {
          class: 'btn blue', onclick: () => {
            sfx.click(); store.bump('emotes');
            const img = document.querySelector('#screen .heroImg');
            if (img) { img.classList.add('dance'); setTimeout(() => img.classList.remove('dance'), 1600); }
          }
        }, 'EMOTE'))
    )
  );

  const catRow = el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } });
  const gridWrap = el('div', { class: 'grid cards scroll', style: { alignContent: 'start' } });

  function drawCats() {
    catRow.innerHTML = '';
    cats.forEach(([id, label]) => catRow.append(el('button', {
      class: `mapChip ${id === cat ? 'sel' : ''}`,
      onclick: () => { sfx.tab(); cat = id; drawCats(); drawGrid(); }
    }, label)));
  }

  function drawGrid() {
    gridWrap.innerHTML = '';
    if (cat === 'style') {
      C().styles.forEach((s, i) => {
        const eq = store.data.equipped.style === s.id;
        gridWrap.append(el('button', {
          class: `card ${eq ? 'equipped' : ''}`,
          style: { '--rc': '#35e0ff', animationDelay: `${i * 40}ms` },
          onclick: () => { sfx.equip(); store.equip('style', s.id); drawGrid(); syncPreview(); }
        },
          el('div', { class: 'art' }, el('img', { class: 'pixel', src: hero().art, style: { filter: s.filter, width: '84px', height: '84px' } })),
          el('div', { class: 'nm' }, s.name),
          el('div', { class: 'row' }, el('span', { class: 'rar', style: { color: '#35e0ff' } }, 'STYLE'), eq ? el('span', { style: { color: '#7dffb0' } }, 'ON') : null)
        ));
      });
      return;
    }
    const list = cat === 'hero' ? C().heroes : cat === 'pick' ? C().picks : cat === 'glider' ? C().gliders : C().emotes;
    list.forEach((it, i) => {
      const owned = store.owns(cat, it.id);
      const R = rar(it.rarity);
      const eq = store.data.equipped[cat === 'hero' ? 'hero' : cat] === it.id;
      gridWrap.append(el('button', {
        class: `card ${owned ? '' : 'locked'} ${eq ? 'equipped' : ''}`,
        style: { '--rc': R.color, animationDelay: `${i * 40}ms` },
        onclick: () => {
          if (!owned) { sfx.deny(); toast('NOT OWNED — GET IT IN THE SHOP', 'red'); return; }
          sfx.equip(); store.equip(cat, it.id); drawGrid(); syncPreview();
          toast(`EQUIPPED ${it.name}`, 'green');
        }
      },
        el('div', { class: 'art' }, artImg(it)),
        el('div', { class: 'nm' }, it.name),
        el('div', { class: 'row' }, el('span', { class: 'rar' }, R.label), owned ? (eq ? el('span', { style: { color: '#7dffb0' } }, 'ON') : null) : el('span', { class: 'tag', style: { position: 'static' } }, 'LOCKED'))
      ));
    });
  }

  function syncPreview() {
    heroImg.src = hero().art;
    heroImg.style.filter = style().filter;
    preview.querySelector('.heroName').textContent = `${hero().name} · ${style().name}`;
    preview.querySelector('.glow').style.setProperty('--rc', rar(hero().rarity).color);
  }

  drawCats(); drawGrid();

  const right = el('div', { class: 'col', style: { flex: '1.4' } }, catRow, gridWrap);
  return el('div', { class: 'cols screen-anim' }, preview, right);
}

/* ------------------------------ TASKS ------------------------------ */
export function renderTasks() {
  const wrap = el('div', { class: 'col scroll screen-anim', style: { height: '100%' } });
  wrap.append(el('div', { class: 'panelTitle' }, 'TASKS — EARN COINS'));

  function section(type, title) {
    const box = el('div', { class: 'col', style: { gap: '10px', marginTop: '10px' } }, el('div', { class: 'panelTitle' }, title));
    C().tasks.filter((t) => t.type === type).forEach((t, i) => {
      const p = store.taskProgress(t);
      const row = el('div', { class: `task pixelbox ${p.done && !p.claimed ? 'done' : ''} ${p.claimed ? 'claimed' : ''}`, style: { animationDelay: `${i * 50}ms` } },
        el('div', {},
          el('div', { class: 'd' }, t.desc),
          el('div', { class: 'bar' }, el('i', { style: { width: `${(p.cur / t.count) * 100}%` } })),
          el('div', { class: 'meta' },
            el('span', {}, `${p.cur}/${t.count}`),
            el('span', { class: 'rwd' }, `+${t.coins} COINS`),
            el('span', { style: { color: 'var(--cyan)' } }, `+${t.xp} XP`),
          )
        ),
        el('button', {
          class: `btn ${p.done && !p.claimed ? '' : 'ghost'}`,
          disabled: !p.done || p.claimed,
          onclick: () => {
            if (store.claimTask(t)) {
              sfx.claim(); confetti(50);
              toast(`TASK COMPLETE +${t.coins} COINS`, 'gold');
              bus.refresh();
            }
          }
        }, p.claimed ? 'CLAIMED' : 'CLAIM')
      );
      box.append(row);
    });
    wrap.append(box);
  }
  section('daily', 'DAILY TASKS');
  section('weekly', 'WEEKLY TASKS');
  if (store.data.dev.noCooldown)
    wrap.append(el('p', { style: { fontSize: '7px', color: 'var(--dim)', marginTop: '8px' } }, 'TEST MODE: claimed tasks re-arm instantly — no cooldown.'));
  return wrap;
}

/* ------------------------------ DEV ------------------------------ */
export function renderDev() {
  const wrap = el('div', { class: 'col scroll screen-anim', style: { height: '100%', gap: '14px' } });
  wrap.append(
    el('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
      el('div', { class: 'panelTitle' }, 'DEV / CURRENCY LAB'),
      el('span', { class: 'devBadge' }, 'TEST PURPOSE ONLY')
    ),
    el('p', { style: { fontSize: '8px', color: 'var(--dim)', lineHeight: '1.8' } },
      `Base test currency is 500 coins. Everything here is instant and cooldown-free so you can validate the economy before the real game ships.`)
  );

  const coinRow = el('div', { class: 'devRow' },
    el('button', { class: 'btn', onclick: () => { store.addCoins(100); sfx.claim(); toast('+100 COINS', 'gold'); } }, '+100'),
    el('button', { class: 'btn', onclick: () => { store.addCoins(500); sfx.claim(); toast('+500 COINS', 'gold'); } }, '+500'),
    el('button', { class: 'btn', onclick: () => { store.addCoins(5000); sfx.claim(); toast('+5000 COINS', 'gold'); } }, '+5000'),
    el('button', { class: 'btn blue', onclick: () => { store.setCoins(500); sfx.click(); toast('RESET TO BASE 500', 'green'); } }, 'SET BASE 500'),
    el('button', { class: 'btn blue', onclick: () => { store.setCoins(store.data.coins * 2); sfx.click(); toast('COINS x2', 'green'); } }, 'x2'),
  );
  wrap.append(el('div', { class: 'panelTitle' }, 'OBTAIN CURRENCY'), coinRow);

  const toggles = el('div', { class: 'devRow' },
    el('button', {
      class: `btn ${store.data.dev.noCooldown ? '' : 'ghost'}`,
      onclick: (e) => { store.data.dev.noCooldown = !store.data.dev.noCooldown; store.emit('dev'); sfx.click(); bus.refresh(); }
    }, `NO COOLDOWN: ${store.data.dev.noCooldown ? 'ON' : 'OFF'}`),
    el('button', {
      class: `btn ${store.data.dev.unlockAll ? '' : 'ghost'}`,
      onclick: () => { store.data.dev.unlockAll = !store.data.dev.unlockAll; store.emit('dev'); sfx.click(); bus.refresh(); }
    }, `UNLOCK ALL (TEST): ${store.data.dev.unlockAll ? 'ON' : 'OFF'}`),
    el('button', { class: 'btn dark', onclick: () => { store.resetTasks(); sfx.click(); toast('TASKS RE-ARMED', 'green'); bus.refresh(); } }, 'RE-ARM TASKS'),
    el('button', { class: 'btn danger', onclick: () => { store.resetAll(); sfx.deny(); toast('SAVE WIPED', 'red'); } }, 'WIPE SAVE'),
  );
  wrap.append(el('div', { class: 'panelTitle' }, 'FLAGS'), toggles);

  wrap.append(el('div', { class: 'panelTitle' }, 'RAW SAVE'),
    el('pre', { class: 'save' }, JSON.stringify(store.data, null, 2)));
  return wrap;
}
