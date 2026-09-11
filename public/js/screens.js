// Screen renderers. Lobby-first design with in-game animated heroes.
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

function artImg(item, size) {
  const img = el('img', { class: 'pixel', src: item.art, alt: item.name });
  if (size) { img.style.width = size + 'px'; img.style.height = size + 'px'; }
  return img;
}
function priceTag(n) {
  return el('span', { class: 'price' }, el('img', { src: coinDataURL(12), class: 'pixel', alt: '' }), fmt(n));
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
    onclick: (e) => {
      sfx.claim();
      if (anim) anim.setAnim('power');
      store.bump('emotes');
      for (let i = 0; i < 4; i++) setTimeout(() => {
        const n = el('span', { class: 'note' }, ['♪', '♫', '♩'][i % 3]);
        n.style.left = 42 + Math.random() * 16 + '%';
        n.style.top = 30 + Math.random() * 18 + '%';
        stageEl.append(n);
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

  // left side: modes + next map + play (chapter-2 style)
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
  const mapCard = el('div', { class: 'mapCard pixelbox' },
    el('span', { class: 'randTag' }, 'RANDOM AT START'),
    mapImg,
    el('div', { class: 'mname' }, mapName,
      el('button', {
        class: 'reroll', title: 'Reroll preview',
        onclick: () => { sfx.click(); map = pick(maps); store.data.lastMap = map.id; mapImg.src = map.art; mapName.textContent = map.name; bg.style.backgroundImage = `url('${map.art}')`; store.persist(); }
      }, ' REROLL'))
  );

  const playBtn = el('button', {
    class: 'btn big',
    onclick: () => { sfx.launch(); deployMatch(mode); }
  }, el('span', {}, 'PLAY'));

  const side = el('div', { class: 'lobbySide' },
    el('div', { class: 'panelTitle' }, 'GAME MODE'),
    modeList,
    el('div', { class: 'panelTitle' }, 'NEXT MAP'),
    mapCard,
    playBtn
  );

  // stage: animated hero over the next map
  const bg = el('div', { class: 'bgmap', style: { backgroundImage: `url('${map.art}')` } });
  const canvas = el('canvas', { class: 'hero pixel' });
  const stage = el('div', { class: 'stage' },
    bg,
    el('div', { class: 'shade' }),
    animChips(null), // patched below with stage ref
    el('div', { class: 'stageStats' },
      el('span', { class: 'chip' }, `MATCHES ${store.data.stats.matches}`),
      el('span', { class: 'chip' }, `WINS ${store.data.stats.wins}`),
      el('span', { class: 'chip', onclick: () => bus.gotoTab && bus.gotoTab('locker') }, 'LOCKER ▸'),
    ),
    el('div', { class: 'heroWrap' },
      canvas,
      el('div', { class: 'floorGlow', style: { '--rc': R.color } }),
    ),
    el('div', { class: 'heroPlate' }, `${hero.name} · ${styleOf().name}`)
  );
  // attach chips to stage for notes
  stage.querySelectorAll('.animChips').forEach((c) => c.remove());
  stage.append(animChips(stage));

  anim = new Animator(canvas, 8);
  canvas.style.filter = `drop-shadow(0 4px 0 rgba(0,0,0,.4)) ${styleOf().filter === 'none' ? '' : styleOf().filter}`;
  anim.load(hero.id);

  return el('div', { class: 'cols screen-anim' }, side, stage);
}

/* ------------------------------ SHOP ------------------------------ */
export function renderShop() {
  killAnim();
  const all = [...C().heroes, ...C().picks, ...C().gliders, ...C().emotes];
  const typeOf = (it) => C().heroes.includes(it) ? 'hero' : it.id.startsWith('pick') ? 'pick' : it.id.startsWith('glider') ? 'glider' : 'emote';
  let sel = all.find((h) => h.id === 'ironman') || all[0];

  const spotArt = el('div', { class: 'spotArt' });
  const spotName = el('div', { class: 'spotName' });
  const spotRar = el('div', { class: 'spotRar' });
  const spotDesc = el('div', { class: 'spotDesc' });
  const spotAct = el('div', { style: { display: 'flex', gap: '8px' } });

  let spotAnim = null;
  function drawSpot() {
    if (spotAnim) { spotAnim.destroy(); spotAnim = null; }
    spotArt.innerHTML = ''; spotAct.innerHTML = '';
    const t = typeOf(sel);
    const Rr = rar(sel.rarity);
    spotArt.style.setProperty('--rc', Rr.color);
    if (t === 'hero') {
      const cv = el('canvas', { class: 'pixel' });
      spotArt.append(cv);
      spotAnim = new Animator(cv, 6);
      spotAnim.load(sel.id);
    } else {
      spotArt.append(artImg(sel, 150));
    }
    spotName.textContent = sel.name;
    spotRar.textContent = Rr.label;
    spotRar.style.color = Rr.color;
    spotDesc.textContent = sel.desc;
    const owned = store.owns(t, sel.id);
    const eq = store.data.equipped[t === 'hero' ? 'hero' : t === 'pick' ? 'pick' : t === 'glider' ? 'glider' : 'emote'] === sel.id;
    if (!owned) {
      spotAct.append(el('button', {
        class: 'btn',
        onclick: () => {
          if (store.buy(t, sel.id, sel.price)) {
            sfx.buy(); confetti(40); toast(`PURCHASED ${sel.name}!`, 'gold'); bus.refresh();
          } else {
            sfx.deny();
            const pill = document.getElementById('coinPill');
            pill.classList.add('deny'); setTimeout(() => pill.classList.remove('deny'), 350);
            toast('NOT ENOUGH COINS', 'red');
          }
        }
      }, 'BUY ', priceTag(sel.price)));
    } else if (!eq) {
      spotAct.append(el('button', { class: 'btn blue', onclick: () => { sfx.equip(); store.equip(t, sel.id); toast(`EQUIPPED ${sel.name}`, 'green'); bus.refresh(); } }, 'EQUIP'));
    } else {
      spotAct.append(el('span', { style: { color: '#7dffb0', alignSelf: 'center', fontSize: '18px' } }, '★ EQUIPPED'));
    }
  }

  const rail = el('div', { class: 'rail' });
  C().heroes.forEach((h) => rail.append(el('button', {
    class: h.id === sel.id ? 'sel' : '',
    onclick: (e) => { sfx.click(); sel = h; rail.querySelectorAll('button').forEach((b) => b.classList.remove('sel')); e.currentTarget.classList.add('sel'); drawSpot(); }
  }, el('img', { class: 'pixel', src: h.art, alt: h.name }))));

  const spotlight = el('div', { class: 'spotlight pixelbox' },
    el('div', { class: 'panelTitle' }, 'SPOTLIGHT'),
    spotArt, spotName, spotRar, spotDesc, spotAct,
    el('div', { class: 'panelTitle' }, 'HERO RAIL'), rail
  );

  function card(it, i) {
    const t = typeOf(it);
    const owned = store.owns(t, it.id);
    const Rr = rar(it.rarity);
    return el('button', {
      class: `card ${owned ? 'owned' : 'locked'} ${sel.id === it.id ? 'sel' : ''} ${['legendary', 'marvel'].includes(it.rarity) ? 'glow' : ''}`,
      style: { '--rc': Rr.color, animationDelay: `${Math.min(i * 25, 300)}ms` },
      onclick: () => { sfx.click(); sel = it; drawSpot(); drawGrids(); }
    },
      el('div', { class: 'art' }, artImg(it)),
      el('div', { class: 'nm' }, it.name),
      el('div', { class: 'row' },
        el('span', { class: 'rar' }, Rr.label),
        owned ? el('span', { style: { color: '#7dffb0' } }, 'OWNED') : priceTag(it.price)),
      !owned ? el('span', { class: 'tag' }, 'NEW') : null
    );
  }

  const heroesGrid = el('div', { class: 'grid cards' });
  const dailyGrid = el('div', { class: 'grid cards' });
  function drawGrids() {
    heroesGrid.innerHTML = ''; dailyGrid.innerHTML = '';
    C().heroes.forEach((h, i) => heroesGrid.append(card(h, i)));
    [...C().picks, ...C().gliders, ...C().emotes].forEach((it, i) => dailyGrid.append(card(it, i)));
  }
  drawGrids();
  drawSpot();

  const right = el('div', { class: 'col scroll' },
    el('div', { class: 'panelTitle' }, 'FEATURED HEROES'), heroesGrid,
    el('div', { class: 'panelTitle', style: { marginTop: '8px' } }, 'RELICS · BACK BLING · EMOTES'), dailyGrid
  );

  const now = new Date(); const end = new Date(now); end.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((end - now) / 60000));
  const head = el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' } },
    el('div', { class: 'panelTitle' }, 'ITEM SHOP'),
    el('span', { style: { fontSize: '16px', color: 'var(--dim)' } },
      store.data.dev.noCooldown ? 'TEST MODE — STOCK NEVER LOCKS' : `NEW STOCK IN ${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`)
  );

  return el('div', { class: 'screen-anim', style: { height: '100%', display: 'flex', flexDirection: 'column' } },
    head, el('div', { class: 'shopWrap' }, spotlight, right));
}

/* ------------------------------ LOCKER ------------------------------ */
export function renderLocker() {
  killAnim();
  let cat = 'hero';
  const cats = [['hero', 'HEROES'], ['pick', 'RELICS'], ['glider', 'BACK BLING'], ['emote', 'EMOTES'], ['style', 'STYLES']];

  const canvas = el('canvas', { class: 'hero pixel' });
  const plate = el('div', { class: 'heroPlate', style: { position: 'static', transform: 'none', marginTop: '8px' } });
  const stageBox = el('div', { class: 'pixelbox', style: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 12px 12px', minHeight: '280px', justifyContent: 'flex-end' } },
    el('div', { class: 'floorGlow', style: { '--rc': rar(heroOf().rarity).color, position: 'absolute', bottom: '70px' } }),
    canvas, plate,
    el('div', { style: { display: 'flex', gap: '6px', marginTop: '10px' } })
  );
  const chipRow = stageBox.lastChild;
  const chips = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' } });
  [['idle', 'IDLE'], ['walk', 'WALK'], ['attack', 'ATTACK'], ['power', 'POWER']].forEach(([id, label], i) => {
    chips.append(el('button', {
      class: `chip ${i === 0 ? 'sel' : ''}`, style: { position: 'static' },
      onclick: (e) => { sfx.click(); if (anim) anim.setAnim(id); chips.querySelectorAll('.chip').forEach((c) => c.classList.remove('sel')); e.currentTarget.classList.add('sel'); }
    }, label));
  });
  chipRow.innerHTML = ''; chipRow.append(chips);

  function syncPreview() {
    plate.textContent = `${heroOf().name} · ${styleOf().name}`;
    canvas.style.filter = styleOf().filter === 'none' ? '' : styleOf().filter;
    if (anim) anim.load(heroOf().id);
  }
  anim = new Animator(canvas, 8);
  anim.load(heroOf().id);
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
          class: `card ${eq ? 'equipped' : ''}`, style: { '--rc': '#35e0ff', animationDelay: `${i * 25}ms` },
          onclick: () => { sfx.equip(); store.equip('style', s.id); syncPreview(); drawGrid(); }
        },
          el('div', { class: 'art' }, el('img', { class: 'pixel', src: heroOf().art, style: { filter: s.filter, width: '72px', height: '72px' } })),
          el('div', { class: 'nm' }, s.name),
          el('div', { class: 'row' }, el('span', { class: 'rar', style: { color: '#35e0ff' } }, 'STYLE'), eq ? el('span', { style: { color: '#7dffb0' } }, 'ON') : null)
        ));
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
        style: { '--rc': Rr.color, animationDelay: `${i * 25}ms` },
        onclick: () => {
          if (!owned) { sfx.deny(); toast('NOT OWNED — GET IT IN THE SHOP', 'red'); return; }
          sfx.equip(); store.equip(cat, it.id); drawGrid(); syncPreview(); toast(`EQUIPPED ${it.name}`, 'green');
        }
      },
        el('div', { class: 'art' }, artImg(it)),
        el('div', { class: 'nm' }, it.name),
        el('div', { class: 'row' }, el('span', { class: 'rar' }, Rr.label), owned ? (eq ? el('span', { style: { color: '#7dffb0' } }, 'ON') : null) : el('span', { style: { fontSize: '14px', color: 'var(--dim)' } }, 'LOCKED'))
      ));
    });
  }
  drawCats(); drawGrid();

  const left = el('div', { class: 'col', style: { flex: '1', maxWidth: '420px' } },
    el('div', { class: 'panelTitle' }, 'LOCKER'), stageBox);
  const right = el('div', { class: 'col', style: { flex: '1.4' } }, catRow, gridWrap);
  return el('div', { class: 'cols screen-anim' }, left, right);
}

/* ------------------------------ TASKS ------------------------------ */
export function renderTasks() {
  killAnim();
  const wrap = el('div', { class: 'col scroll screen-anim', style: { height: '100%' } });
  wrap.append(el('div', { class: 'levelPanel pixelbox' },
    el('span', { class: 'lv' }, `LV ${store.data.level}`),
    el('div', { class: 'xpbar' }, el('i', { style: { width: `${Math.min(100, (store.data.xp / store.xpNeed()) * 100)}%` } })),
    el('span', { class: 'xptxt' }, `${fmt(store.data.xp)} / ${fmt(store.xpNeed())} XP`)
  ));
  wrap.append(el('div', { class: 'panelTitle', style: { marginTop: '6px' } }, 'TASKS — EARN COINS'));

  function section(type, title) {
    const box = el('div', { class: 'col', style: { gap: '8px', marginTop: '8px' } }, el('div', { class: 'panelTitle' }, title));
    C().tasks.filter((t) => t.type === type).forEach((t) => {
      const p = store.taskProgress(t);
      box.append(el('div', { class: `task pixelbox ${p.done && !p.claimed ? 'done' : ''} ${p.claimed ? 'claimed' : ''}` },
        el('div', {},
          el('div', { class: 'd' }, t.desc),
          el('div', { class: 'bar' }, el('i', { style: { width: `${(p.cur / t.count) * 100}%` } })),
          el('div', { class: 'meta' },
            el('span', {}, `${p.cur}/${t.count}`),
            el('span', { class: 'rwd' }, `+${t.coins} COINS`),
            el('span', { style: { color: 'var(--cyan)' } }, `+${t.xp} XP`))
        ),
        el('button', {
          class: `btn ${p.done && !p.claimed ? '' : 'ghost'}`,
          disabled: !p.done || p.claimed,
          onclick: () => {
            if (store.claimTask(t)) { sfx.claim(); confetti(50); toast(`TASK COMPLETE +${t.coins} COINS`, 'gold'); bus.refresh(); }
          }
        }, p.claimed ? 'CLAIMED' : 'CLAIM')
      ));
    });
    wrap.append(box);
  }
  section('daily', 'DAILY TASKS');
  section('weekly', 'WEEKLY TASKS');
  if (store.data.dev.noCooldown)
    wrap.append(el('p', { style: { fontSize: '15px', color: 'var(--dim)' } }, 'TEST MODE: claimed tasks re-arm instantly — no cooldown.'));
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
    el('p', { style: { fontSize: '16px', color: 'var(--dim)' } },
      'Base test currency is 500 coins. Instant and cooldown-free, for validating the economy before the real game ships.')
  );
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
