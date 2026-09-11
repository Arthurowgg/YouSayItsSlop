// Runtime smoke test: bundle the menu's ES modules and drive them in jsdom.
// Usage: npm run smoke   (or)  BUNDLE=/tmp/mpr_bundle.js node tools/smoke_test.js
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

  ok(tabBtns().length === 5, '5 tabs rendered');
  ok(tabBtns().every((t) => /^[A-Z]+$/.test(t.textContent.trim())), 'tabs are names only');
  const nav = $('#tabs');
  ok(nav.scrollWidth <= nav.clientWidth + 1, 'top bar not scrollable (all tabs visible)');
  ok(!$('#lvl'), 'level no longer in top bar');
  ok(!!$('#settingsBtn'), 'settings button replaces music icon');
  ok($('#coinCount').textContent.replace(/\D/g, '') === '500', 'base coins = 500');

  // lobby
  ok($$('#screen .modeRow').length === 5, 'lobby lists 5 custom modes');
  const mapName = $('.mapCard .mname span').textContent;
  ok(catalog.maps.some((m) => m.name === mapName), 'lobby shows one of the 5 maps');
  ok(!!$('#screen canvas.hero'), 'lobby has animated hero canvas');
  ok($$('#screen .animChips .chip').length === 5, 'lobby has IDLE/WALK/ATTACK/POWER/EMOTE chips');

  // settings modal
  $('#settingsBtn').click(); await sleep(30);
  ok($('.modal') && $('.modal').textContent.includes('SOUND'), 'settings modal opens with sound toggle');
  $$('.modal .btn').find((b) => b.textContent === 'CLOSE').click(); await sleep(20);

  // shop: spotlight + deny at 500
  tabBtns()[1].click(); await sleep(40);
  ok($('.spotlight') !== null, 'shop has spotlight layout');
  const railIron = $$('.rail button').find((b) => b.querySelector('img') && b.querySelector('img').alt === 'IRON MAN');
  railIron.click(); await sleep(30);
  ok($('.spotName').textContent === 'IRON MAN', 'spotlight shows selected hero');
  $$('.spotlight .btn').find((b) => b.textContent.includes('BUY')).click(); await sleep(30);
  ok($('#toasts').textContent.includes('NOT ENOUGH COINS'), 'purchase denied at 500 coins');

  // dev coins then buy
  tabBtns()[4].click(); await sleep(30);
  $$('#screen .btn').find((b) => b.textContent.includes('+5000')).click(); await sleep(30);
  ok($('#coinCount').textContent.replace(/\D/g, '') === '5500', 'dev +5000 coins works');
  tabBtns()[1].click(); await sleep(30);
  $$('.rail button').find((b) => b.querySelector('img') && b.querySelector('img').alt === 'IRON MAN').click(); await sleep(20);
  $$('.spotlight .btn').find((b) => b.textContent.includes('BUY')).click(); await sleep(30);
  ok($('#toasts').textContent.includes('PURCHASED'), 'purchase succeeds with funds');
  ok($('#coinCount').textContent.replace(/\D/g, '') === String(5500 - 1600), 'coins deducted (3,900)');

  // locker equip
  tabBtns()[2].click(); await sleep(30);
  ok(!!$('#screen canvas.hero'), 'locker has animated preview');
  $$('#screen .card').find((c) => c.textContent.includes('IRON MAN')).click(); await sleep(30);
  ok($('#screen .heroPlate').textContent.includes('IRON MAN'), 'hero equipped in locker');

  // emote -> tasks claim; level shown in tasks
  tabBtns()[0].click(); await sleep(30);
  $$('#screen .animChips .chip').find((c) => c.textContent === 'EMOTE').click(); await sleep(30);
  tabBtns()[3].click(); await sleep(30);
  ok($('.levelPanel') && $('.levelPanel').textContent.includes('LV'), 'tasks tab shows stored level');
  ok($('#screen').textContent.includes('1/1'), 'emote task reached 1/1');
  const claim = $$('#screen .btn').find((b) => b.textContent === 'CLAIM' && !b.disabled);
  ok(!!claim, 'a claim button is enabled');
  if (claim) { claim.click(); await sleep(30); ok($('#toasts').textContent.includes('TASK COMPLETE'), 'task claimed with reward'); }

  // match: random map at start
  tabBtns()[0].click(); await sleep(30);
  $$('#screen .btn.big').find((b) => b.textContent.includes('PLAY')).click();
  await sleep(6000);
  ok(!!$('#deploy'), 'deploy overlay visible');
  ok(catalog.maps.some((m) => $('#deploy').textContent.includes(m.name)), 'match picked one of the 5 random maps');
  const back = $$('#deploy .btn').find((b) => b.textContent.includes('RETURN'));
  ok(!!back, 'match produced results');
  if (back) { back.click(); await sleep(30); }
  ok($('#screen').textContent.includes('MATCHES 1'), 'match stat recorded in lobby');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('SMOKE ERROR', e); process.exit(2); });
