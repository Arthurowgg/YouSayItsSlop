// Simulated match: random map at start -> countdown -> match log -> results & rewards.
import { el, rnd, pick, fmt } from './util.js';
import { store } from './store.js';
import { sfx, confetti } from './fx.js';
import { toast } from './screens.js';
import { bus } from './bus.js';

const LINES = [
  'Indo para o mapa…',
  'Saqueando caches de pixels…',
  'Disputando o objetivo…',
  'Entrando na briga alheia…',
  'Fechando o 1v3…',
  'Círculo final…',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function deployMatch(mode) {
  const map = pick(store.catalog.maps); // random map at start
  store.data.lastMap = map.id;

  const ov = el('div', { id: 'deploy' });
  const count = el('div', { class: 'count' }, '3');
  const line = el('div', { class: 'line' }, `DEPLOYING → ${map.name} · ${mode.name}`);
  const prev = el('img', { class: 'mapPrev', src: map.art, alt: map.name });
  const bar = el('div', { class: 'bar' }, el('i'));
  ov.append(count, line, prev, bar);
  document.body.append(ov);

  for (const n of ['3', '2', '1', 'VAI!']) {
    count.textContent = n;
    count.style.animation = 'none'; void count.offsetWidth; count.style.animation = '';
    sfx.tick();
    await sleep(n === 'VAI!' ? 400 : 650);
  }

  for (let i = 0; i < LINES.length; i++) {
    line.textContent = LINES[i];
    bar.firstChild.style.width = `${((i + 1) / LINES.length) * 100}%`;
    sfx.hover();
    await sleep(420);
  }

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
    el('div', { class: 'count', style: { fontSize: '24px', color: win ? 'var(--gold)' : 'var(--cyan)' } },
      win ? '#1 VITÓRIA!' : `#${place} LUGAR`),
    el('div', { class: 'line' }, `${mode.name} · ${map.name}`),
    el('img', { class: 'mapPrev', src: map.art, alt: map.name }),
    el('div', { class: 'line', style: { color: 'var(--ink)' } }, `ELIMINAÇÕES: ${kills}`),
    el('div', { class: 'line', style: { color: 'var(--gold)' } }, `+${fmt(coins)} MOEDAS`),
    el('div', { class: 'line', style: { color: 'var(--cyan)' } }, `+${fmt(xp)} XP`),
    el('button', {
      class: 'btn big', style: { marginTop: '8px' },
      onclick: () => { ov.remove(); bus.refresh(); }
    }, el('span', {}, 'VOLTAR AO LOBBY'))
  );
  if (win) { confetti(120); sfx.buy(); } else sfx.click();
  if (ups) { sfx.levelup(); confetti(80); toast(`SUBIU DE NÍVEL! AGORA LV ${store.data.level}`, 'gold'); }
  bus.refresh();
}
