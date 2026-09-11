// Boot: tabs, HUD, routing.
import { el, fmt, coinDataURL } from './util.js';
import { store } from './store.js';
import { startParticles, sfx, toggleMute } from './fx.js';
import { renderPlay, renderShop, renderLocker, renderTasks, renderDev, toast } from './screens.js';
import { bus } from './bus.js';

const TABS = [
  ['play', '▶ PLAY'],
  ['shop', '◆ SHOP'],
  ['locker', '▣ LOCKER'],
  ['tasks', '✔ TASKS'],
  ['dev', '⚙ DEV'],
];
let current = 'play';

function updateHUD() {
  document.getElementById('coinCount').textContent = fmt(store.data.coins);
  document.getElementById('lvlNum').textContent = store.data.level;
  document.getElementById('xpFill').style.width = `${Math.min(100, (store.data.xp / store.xpNeed()) * 100)}%`;
}

function renderCurrent() {
  const screen = document.getElementById('screen');
  screen.innerHTML = '';
  const node =
    current === 'play' ? renderPlay() :
    current === 'shop' ? renderShop() :
    current === 'locker' ? renderLocker() :
    current === 'tasks' ? renderTasks() : renderDev();
  screen.append(node);
  updateHUD();
}

function buildTabs() {
  const nav = document.getElementById('tabs');
  nav.innerHTML = '';
  TABS.forEach(([id, label]) => {
    const b = el('button', {
      class: `tab ${id === current ? 'active' : ''}`,
      onclick: () => { current = id; sfx.tab(); buildTabs(); renderCurrent(); },
      onmouseenter: () => sfx.hover(),
    }, el('span', {}, label));
    nav.append(b);
  });
}

async function boot() {
  await store.load();

  // coin icon fallback if the generated sprite is missing
  const ci = document.getElementById('coinIcon');
  ci.addEventListener('error', () => { ci.src = coinDataURL(20); }, { once: true });

  document.getElementById('muteBtn').addEventListener('click', (e) => {
    const m = toggleMute();
    e.currentTarget.classList.toggle('off', m);
    if (!m) sfx.click();
  });

  addEventListener('keydown', (e) => {
    const i = Number(e.key) - 1;
    if (i >= 0 && i < TABS.length) { current = TABS[i][0]; sfx.tab(); buildTabs(); renderCurrent(); }
  });

  store.onChange(() => { updateHUD(); renderCurrent(); });
  bus.refresh = renderCurrent;

  startParticles();
  buildTabs();
  renderCurrent();
  toast('WELCOME TO THE PIXEL LOBBY', 'green');
}

boot();
