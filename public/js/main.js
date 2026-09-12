// Boot: name-only top tabs, HUD, settings modal, routing.
import { el, fmt, coinDataURL } from './util.js';
import { store } from './store.js';
import { startParticles, setParticlesEnabled, sfx, toggleMute, isMuted } from './fx.js';
import { renderPlay, renderShop, renderLocker, renderTasks, renderDev, toast, modal } from './screens.js';
import { bus } from './bus.js';

const TABS = [
  ['play', 'PLAY'],
  ['shop', 'SHOP'],
  ['locker', 'LOCKER'],
  ['tasks', 'TASKS'],
  ['dev', 'DEV'],
];
let current = 'play';

function updateHUD() {
  document.getElementById('coinCount').textContent = fmt(store.data.coins);
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
    nav.append(el('button', {
      class: `tab ${id === current ? 'active' : ''}`,
      onclick: () => { current = id; sfx.tab(); buildTabs(); renderCurrent(); },
      onmouseenter: () => sfx.hover(),
    }, el('span', {}, label)));
  });
}

function applySettings() {
  const s = store.data.settings;
  setParticlesEnabled(!!s.particles);
  if (isMuted() === !!s.sound) toggleMute(); // muted should equal !sound
}

function openSettings() {
  const s = store.data.settings;
  function row(label, key, extra) {
    const btn = el('button', { class: `btn ${s[key] ? 'blue' : 'ghost'}`, style: { minWidth: '70px' } }, s[key] ? 'ON' : 'OFF');
    btn.onclick = () => {
      s[key] = !s[key];
      store.emit('settings');
      sfx.click();
      applySettings();
      m.close(); openSettings();
      if (extra) extra();
    };
    return el('div', { class: 'row' }, el('span', {}, label), btn);
  }
  const m = modal(el('div', {},
    el('h2', {}, 'SETTINGS'),
    row('SOUND', 'sound'),
    row('LOBBY PARTICLES', 'particles'),
    el('div', { class: 'row', style: { border: 'none', justifyContent: 'flex-end', marginTop: '10px' } },
      el('button', { class: 'btn ghost', onclick: () => m.close() }, 'CLOSE'))
  ));
}

async function boot() {
  await store.load();

  const ci = document.getElementById('coinIcon');
  ci.addEventListener('error', () => { ci.src = coinDataURL(18); }, { once: true });

  document.getElementById('settingsBtn').addEventListener('click', () => { sfx.click(); openSettings(); });

  addEventListener('keydown', (e) => {
    const i = Number(e.key) - 1;
    if (i >= 0 && i < TABS.length) { current = TABS[i][0]; sfx.tab(); buildTabs(); renderCurrent(); }
  });

  // NOTE: no full re-render on store changes (perf). Screens call bus.refresh() when needed.
  store.onChange(updateHUD);
  bus.refresh = renderCurrent;
  bus.gotoTab = (id) => { current = id; sfx.tab(); buildTabs(); renderCurrent(); };

  startParticles();
  applySettings();
  buildTabs();
  renderCurrent();
  toast('WELCOME TO THE PIXEL LOBBY', 'green');
}

boot();
