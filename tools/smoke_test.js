// Runtime smoke test v3: bundle the ES modules and drive them in jsdom.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const REPO = process.env.REPO || path.join(__dirname, '..');
const html = fs.readFileSync(path.join(REPO, 'public/index.html'), 'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(REPO, 'public/data/catalog.json'), 'utf8'));

const dom = new JSDOM(html, { url: 'http://localhost:8080/', pretendToBeVisual: true });
const w = dom.window;

const fakeCtx = () => new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : (...a) => undefined),
  set: (t, k, v) => { t[k] = v; return true; },
});
w.HTMLCanvasElement.prototype.getContext = function () { return fakeCtx(); };
w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,x';

w.fetch = async (url) => {
  if (String(url).includes('/api/catalog')) return { ok: true, json: async () => catalog };
  if (String(url).includes('/api/state')) return { ok: false, json: async () => ({ empty: true }) };
  return { ok: false, json: async () => ({}) };
};

for (const k of ['window', 'document', 'addEventListener', 'innerWidth', 'innerHeight', 'localStorage', 'requestAnimationFrame']) {
  const v = k === 'innerWidth' ? 1280 : k === 'innerHeight' ? 800 : w[k];
  if (!(k in global)) global[k] = typeof v === 'function' ? v.bind(w) : v;
}
global.window = w; global.document = w.document; global.fetch = w.fetch;
global.cancelAnimationFrame = (id) => w.cancelAnimationFrame(id);
if (!global.requestAnimationFrame) global.requestAnimationFrame = (cb) => w.requestAnimationFrame(cb);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log('PASS', label); } else { fail++; console.log('FAIL', label); } };

require(process.env.BUNDLE || '/tmp/mpr_bundle.js');

(async () => {
  await sleep(300);
  const $ = (s) => w.document.querySelector(s);
  const $$ = (s) => [...w.document.querySelectorAll(s)];
  const tabBtns = () => $$('#tabs .tab');

  ok(tabBtns().length === 5 && tabBtns().every((t) => /^[A-Z]+$/.test(t.textContent.trim())), '5 name-only tabs');
  const nav = $('#tabs');
  ok(nav.scrollWidth <= nav.clientWidth + 1, 'top bar not scrollable');
  ok(!$('#lvl') && !!$('#settingsBtn') && !$('#scanlines'), 'no level in bar, settings yes, scanlines gone');
  ok($('#coinCount').textContent.replace(/\D/g, '') === '500', 'base coins = 500');

  // lobby
  ok($$('#screen .modeRow').length === 5, 'lobby 5 modes with generated icons');
  ok(!!$('#screen canvas.hero'), 'lobby animated hero canvas');
  ok($('.heroPlate .pq') && $('.heroPlate .pq').textContent.length > 4, 'hero quote shown in lobby');
  ok($$('#screen .animChips .chip').length === 5, 'IDLE/WALK/ATTACK/POWER/EMOTE chips');

  // settings
  $('#settingsBtn').click(); await sleep(30);
  ok($('.modal') && $('.modal').textContent.includes('SOUND') && !$('.modal').textContent.includes('SCANLINES'), 'settings modal (sound+particles only)');
  $$('.modal .btn').find((b) => b.textContent === 'CLOSE').click(); await sleep(20);

  async function toShopGrid() {
    tabBtns()[1].click(); await sleep(30);
    const bk = $$('.pageHead .btn').find((b) => b.textContent.includes('BACK'));
    if (bk) { bk.click(); await sleep(30); }
  }

  // shop: bundles + item pages
  await toShopGrid();
  ok($$('.card.bundle').length === 4, 'shop shows 4 bundles');
  $$('.card.bundle')[0].click(); await sleep(30);
  ok($('#screen').textContent.includes('INCLUDED'), 'bundle page lists included items');
  ok($$('.inclRow').length === 3, 'bundle page shows 3 included rows');
  $$('.pageHead .btn').find((b) => b.textContent.includes('BACK')).click(); await sleep(30);
  $$('#screen .card').find((c) => c.textContent.includes('IRON MAN')).click(); await sleep(30);
  ok($('.itemName') && $('.itemName').textContent === 'IRON MAN', 'item page opens for IRON MAN');
  ok(!!$('.statbars'), 'item page shows stat bars');
  ok(!!$('.itemQuote') && $('.itemQuote').textContent.length > 4, 'item page shows hero quote');
  $$('.actions .btn').find((b) => b.textContent.includes('BUY')).click(); await sleep(30);
  ok($('#toasts').textContent.includes('NOT ENOUGH COINS'), 'buy denied at 500');

  // dev coins then buy + equip
  tabBtns()[4].click(); await sleep(30);
  $$('#screen .btn').find((b) => b.textContent.includes('+5000')).click(); await sleep(30);
  ok($('#coinCount').textContent.replace(/\D/g, '') === '5500', 'dev +5000');
  await toShopGrid();
  $$('#screen .card').find((c) => c.textContent.includes('IRON MAN')).click(); await sleep(30);
  $$('.actions .btn').find((b) => b.textContent.includes('BUY')).click(); await sleep(30);
  ok($('#coinCount').textContent.replace(/\D/g, '') === String(5500 - 1600), 'coins deducted (3,900)');
  $$('.actions .btn').find((b) => b.textContent.includes('SELECT HERO')).click(); await sleep(30);
  ok(!!$('.ownedTag'), 'item page shows equipped after select');

  // bundle buy
  await toShopGrid();
  $$('.card.bundle')[1].click(); await sleep(30);
  $$('.actions .btn').find((b) => b.textContent.includes('BUY BUNDLE')).click(); await sleep(30);
  ok($('#toasts').textContent.includes('BUNDLE UNLOCKED'), 'bundle purchase works');

  // locker with combined backbling
  tabBtns()[2].click(); await sleep(30);
  ok(!!$('#screen canvas.hero'), 'locker animated preview');
  const catBling = $$('.chip').find((c) => c.textContent === 'BACK BLING');
  catBling.click(); await sleep(30);
  $$('#screen .card').find((c) => c.textContent.includes('ANGEL WINGS')).click(); await sleep(30);
  ok($('#toasts').textContent.includes('EQUIPPED'), 'glider equipped (combines on hero)');

  // tasks categories + level
  tabBtns()[3].click(); await sleep(30);
  ok($('.levelPanel') && $('.levelPanel').textContent.includes('LV'), 'tasks shows stored level');
  ok(['COMBAT', 'ECONOMY', 'STYLE'].every((c) => $('#screen').textContent.includes(c)), 'task categories shown');
  tabBtns()[0].click(); await sleep(30);
  $$('#screen .animChips .chip').find((c) => c.textContent === 'EMOTE').click(); await sleep(30);
  tabBtns()[3].click(); await sleep(30);
  ok($('#screen').textContent.includes('1/1'), 'emote task 1/1');
  const claim = $$('#screen .btn').find((b) => b.textContent === 'CLAIM' && !b.disabled);
  ok(!!claim, 'claim enabled');
  if (claim) { claim.click(); await sleep(30); ok($('#toasts').textContent.includes('TASK COMPLETE'), 'task claimed'); }

  // match
  tabBtns()[0].click(); await sleep(30);
  $$('#screen .btn.big').find((b) => b.textContent.includes('PLAY')).click();
  await sleep(6000);
  ok(!!$('#deploy'), 'deploy overlay');
  ok(catalog.maps.some((m) => $('#deploy').textContent.includes(m.name)), 'random map picked');
  const back = $$('#deploy .btn').find((b) => b.textContent.includes('RETURN'));
  ok(!!back, 'results shown');
  if (back) { back.click(); await sleep(30); }
  ok($('#screen').textContent.includes('MATCHES 1'), 'match stat in lobby');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('SMOKE ERROR', e); process.exit(2); });
