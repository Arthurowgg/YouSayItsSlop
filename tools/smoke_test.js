// Runtime smoke test: bundle the menu's ES modules and drive them in jsdom.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const REPO = process.env.REPO || require('path').join(__dirname, '..');
const html = fs.readFileSync(path.join(REPO, 'public/index.html'), 'utf8');
const catalog = fs.readFileSync(path.join(REPO, 'data/catalog.json'), 'utf8');

const dom = new JSDOM(html, { url: 'http://localhost:8080/', pretendToBeVisual: true });
const w = dom.window;

// --- stubs ---
const fakeCtx = () => new Proxy({}, {
  get: (t, k) => {
    if (k === 'canvas') return {};
    if (k === 'globalAlpha' || k === 'fillStyle') return t[k];
    return (t[k] !== undefined) ? t[k] : (...a) => undefined;
  },
  set: (t, k, v) => { t[k] = v; return true; },
});
w.HTMLCanvasElement.prototype.getContext = function () { return fakeCtx(); };
w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,x';

w.fetch = async (url) => {
  if (String(url).includes('/api/catalog')) return { ok: true, json: async () => JSON.parse(catalog) };
  if (String(url).includes('/api/state')) return { ok: false, json: async () => ({ empty: true }) };
  return { ok: false, json: async () => ({}) };
};

for (const k of ['window', 'document', 'addEventListener', 'innerWidth', 'innerHeight', 'localStorage', 'requestAnimationFrame']) {
  const v = k === 'innerWidth' ? 1280 : k === 'innerHeight' ? 800 : w[k];
  if (!(k in global)) global[k] = typeof v === 'function' ? v.bind(w) : v;
}
global.window = w; global.document = w.document; global.fetch = w.fetch;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log('PASS', label); } else { fail++; console.log('FAIL', label); } };

require(process.env.BUNDLE || '/tmp/mpr_bundle.js');

(async () => {
  await sleep(300); // boot
  const $ = (s) => w.document.querySelector(s);
  const $$ = (s) => [...w.document.querySelectorAll(s)];

  ok($$('#tabs .tab').length === 5, '5 tabs rendered');
  ok($('#coinCount').textContent.replace(/\D/g, '') === '500', 'base coins = 500');
  ok($('#screen').textContent.includes('LOBBY'), 'play screen shows lobby');
  ok($$('#screen .modeCard').length === 6, '6 game modes listed');

  // tab: shop
  $$('#tabs .tab')[1].click(); await sleep(50);
  ok($('#screen').textContent.includes('ITEM SHOP'), 'shop screen');
  ok($$('#screen .card').length >= 26, 'shop shows all items');

  // open a locked hero modal and attempt purchase with 500 coins (should deny)
  const iron = $$('#screen .card').find((c) => c.textContent.includes('IRON MAN'));
  iron.click(); await sleep(30);
  ok($('.modal') !== null, 'item modal opens');
  const buyBtn = $$('.modal .btn').find((b) => b.textContent.includes('BUY'));
  buyBtn.click(); await sleep(30);
  ok($('#toasts').textContent.includes('NOT ENOUGH COINS'), 'purchase denied at 500 coins');
  $$('.modal .btn').find((b) => b.textContent.includes('CLOSE')).click(); await sleep(20);

  // dev tab: add coins then buy
  $$('#tabs .tab')[4].click(); await sleep(30);
  ok($('#screen').textContent.includes('TEST PURPOSE ONLY'), 'dev tab has test badge');
  const add5000 = $$('#screen .btn').find((b) => b.textContent.includes('+5000'));
  add5000.click(); await sleep(30);
  ok($('#coinCount').textContent.replace(/\D/g, '') === '5500', 'dev +5000 coins works');

  $$('#tabs .tab')[1].click(); await sleep(30);
  const iron2 = $$('#screen .card').find((c) => c.textContent.includes('IRON MAN'));
  iron2.click(); await sleep(20);
  $$('.modal .btn').find((b) => b.textContent.includes('BUY')).click(); await sleep(30);
  ok($('#toasts').textContent.includes('PURCHASED'), 'purchase succeeds with funds');
  ok($('#coinCount').textContent.replace(/\D/g, '') === String(5500 - 1600), 'coins deducted (3,900)');

  // locker: equip iron man
  $$('#tabs .tab')[2].click(); await sleep(30);
  ok($('#screen').textContent.includes('LOCKER'), 'locker screen');
  const ironCard = $$('#screen .card').find((c) => c.textContent.includes('IRON MAN'));
  ironCard.click(); await sleep(30);
  ok($('#screen .heroName').textContent.includes('IRON MAN'), 'hero equipped in locker');

  // tasks: emote task progress after using emote in lobby
  $$('#tabs .tab')[0].click(); await sleep(30);
  $$('#screen .btn').find((b) => b.textContent === 'EMOTE').click(); await sleep(30);
  $$('#tabs .tab')[3].click(); await sleep(30);
  ok($('#screen').textContent.includes('TASKS'), 'tasks screen');
  ok($('#screen').textContent.includes('1/1'), 'emote task reached 1/1');
  const claim = $$('#screen .btn').find((b) => b.textContent === 'CLAIM' && !b.disabled);
  ok(!!claim, 'a claim button is enabled');
  if (claim) { claim.click(); await sleep(30); ok($('#toasts').textContent.includes('TASK COMPLETE'), 'task claimed with reward'); }

  // launch a match (async sim ~5s)
  $$('#tabs .tab')[0].click(); await sleep(30);
  $$('#screen .btn').find((b) => b.textContent.includes('LAUNCH')).click();
  await sleep(6000);
  ok(!!$('#deploy'), 'deploy overlay visible during/after match');
  const back = $$('#deploy .btn').find((b) => b.textContent.includes('RETURN'));
  ok(!!back, 'match produced results');
  if (back) { back.click(); await sleep(30); }
  ok($('#screen').textContent.includes('MATCHES 1'), 'match stat recorded');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('SMOKE ERROR', e); process.exit(2); });
