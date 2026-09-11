// Simulated match flow: deploy countdown -> fake match log -> results & rewards.
import { el, rnd, pick, fmt } from './util.js';
import { store } from './store.js';
import { sfx, confetti } from './fx.js';
import { toast } from './screens.js';
import { bus } from './bus.js';

const LINES = [
  'Dropping onto the island…',
  'Looting pixel chests…',
  'Storm circle closing…',
  'Third-partying a fight…',
  'Clutching the 1v3…',
  'Building stairs for no reason…',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function deployMatch(mode, map) {
  const ov = el('div', { id: 'deploy' });
  const count = el('div', { class: 'count' }, '3');
  const line = el('div', { class: 'line' }, `DEPLOYING → ${map.name} · ${mode.name}`);
  const bar = el('div', { class: 'bar' }, el('i'));
  ov.append(count, line, bar);
  document.body.append(ov);

  for (const n of ['3', '2', '1', 'GO!']) {
    count.textContent = n;
    count.style.animation = 'none'; void count.offsetWidth; count.style.animation = '';
    sfx.tick();
    await sleep(n === 'GO!' ? 400 : 700);
  }

  for (let i = 0; i < LINES.length; i++) {
    line.textContent = LINES[i];
    bar.firstChild.style.width = `${((i + 1) / LINES.length) * 100}%`;
    sfx.hover();
    await sleep(450);
  }

  // results
  const players = mode.players;
  const win = Math.random() < 0.22;
  const place = win ? 1 : rnd(2, players);
  const kills = win ? rnd(4, 12) : rnd(0, 8);
  const coins = Math.round((30 + kills * 6 + (win ? 60 : 10)) * mode.mult);
  const xp = Math.round((40 + kills * 8 + (win ? 40 : 0)) * mode.mult);

  store.bump('matches');
  if (win) store.bump('wins');
  store.addCoins(coins);
  const ups = store.addXP(xp);

  ov.innerHTML = '';
  ov.append(
    el('div', { class: 'count', style: { fontSize: '26px', color: win ? 'var(--gold)' : 'var(--cyan)' } },
      win ? '#1 VICTORY ROYALE!' : `#${place} PLACE`),
    el('div', { class: 'line' }, `${mode.name} · ${map.name}`),
    el('div', { class: 'line', style: { color: 'var(--ink)' } }, `ELIMINATIONS: ${kills}`),
    el('div', { class: 'line', style: { color: 'var(--gold)' } }, `+${fmt(coins)} COINS`),
    el('div', { class: 'line', style: { color: 'var(--cyan)' } }, `+${fmt(xp)} XP`),
    el('button', {
      class: 'btn big', style: { marginTop: '10px' },
      onclick: () => { ov.remove(); bus.refresh(); }
    }, 'RETURN TO LOBBY')
  );
  if (win) { confetti(120); sfx.buy(); }
  else sfx.click();
  if (ups) { sfx.levelup(); confetti(80); toast(`LEVEL UP! NOW LV ${store.data.level}`, 'gold'); }
  bus.refresh();
}
