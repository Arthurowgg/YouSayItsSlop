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

  ok(tabBtns().length === 5 && tabBtns().every((t) => /^[A-ZÀ-Ú]+$/.test(t.textContent.trim())), '5 name-only tabs');
  const nav = $('#tabs');
  ok(nav.scrollWidth <= nav.clientWidth + 1, 'top bar not scrollable');
  ok(!$('#lvl') && !!$('#settingsBtn') && !$('#scanlines'), 'no level in bar, settings yes, scanlines gone');
  ok($('#coinCount').textContent.replace(/\D/g, '') === '500', 'base coins = 500');

  // lobby (fullscreen)
  ok(!!$('#screen canvas.hero') && !!$('#screen .stage.full'), 'fullscreen lobby with hero on background');
  ok($('.heroPlate .pq') && $('.heroPlate .pq').textContent.length > 4, 'hero quote shown in lobby');
  ok(!!$('.btn.playBig'), 'big PLAY button');
  ok($$('#screen .hudRect').length === 2, 'two HUD rectangles (mode + map)');
  ok($$('#screen .msCard').length === 5, 'lobby shows 5 mode cards');
  $$('#screen .msCard')[2].click(); await sleep(20);
  ok($$('#screen .msCard')[2].classList.contains('sel'), 'mode strip selects mode');
  ok(catalog.emotes.length === 10, 'catalog has 10 emotes');
  $$('#screen .hudRect')[0].click(); await sleep(30);
  ok($$('.modePrompt .mpCard').length === 5, 'mode prompt opens fullscreen with 5 modes');
  $$('.modePrompt .mpCard')[1].click(); await sleep(200);
  ok(!$('.modePrompt'), 'mode prompt closes after pick');
  ok($$('#screen .hudRect')[0].textContent.includes(catalog.modes[1].name), 'mode rectangle shows picked mode');
  const mapBefore = $$('#screen .hudRect')[1].textContent;
  $$('#screen .hudRect')[1].click(); await sleep(30);
  ok($$('#screen .hudRect')[1].textContent.length > 4, 'map rectangle rerolls');
  void mapBefore;

  // settings
  $('#settingsBtn').click(); await sleep(30);
  ok(!!$('.settingsFS'), 'settings open fullscreen');
  ok($$('.setTab').length === 6, '6 settings tabs');
  ok($$('.setTab').every((t) => t.querySelector('img') && !t.querySelector('span')), 'settings tabs are icon-only');
  $$('.setTab')[1].click(); await sleep(20);
  ok($('.settingsFS').textContent.includes('SOM') && $('.settingsFS').textContent.includes('VOLUME DE EFEITOS'), 'audio tab shows SOM settings');
  $$('.setFoot .btn').find((b) => b.textContent.includes('VOLTAR')).click(); await sleep(40);
  ok(!$('.settingsFS'), 'settings close');

  async function toShopGrid() {
    tabBtns()[1].click(); await sleep(30);
    const bk = $$('.pageHead .btn').find((b) => b.textContent.includes('VOLTAR'));
    if (bk) { bk.click(); await sleep(30); }
  }

  // shop: bundles + item pages
  await toShopGrid();
  ok(['PACOTES', 'TRAJES', 'EMOTES'].every((s) => $('#screen').textContent.includes(s)) && !$('#screen').textContent.includes('DAILY'), 'shop sections (no daily)');
  ok($$('#screen .secTitle').filter((t) => t.textContent === 'EMOTES')[0].nextElementSibling.querySelectorAll('.fcard2').length === 10, 'shop EMOTES section lists 10 emotes');
  ok($$('.fcard2.bundle').length === 4, 'shop shows 4 bundles');

  // shop v2 storefront presentation
  ok(!!$('.shop2bg .s2skyline') && !!$('.shop2bg .s2stars'), 'shop has layered pixel backdrop');
  ok(!!$('.featBundle') && !!$('.featHero'), 'featured bundle + featured hero strip');
  ok($$('.featBundle .miniIco').length === 3, 'featured bundle shows included item icons');
  ok($$('.bcard2').length === 4 && $$('.bcard2').every((b) => b.querySelectorAll('.miniIco').length === 3), 'bundle cards show individual item icons');
  ok($$('.ecard .eRing').length === 20, 'emote cards use dedicated ring stages');
  ok($$('.gcard .gBase').length === 60, 'gear cards use pedestal presentation');
  ok($$('.hcard canvas').length === 20, 'hero cards animate in-grid');

  $$('.fcard2.bundle')[0].click(); await sleep(30);
  ok($('#screen').textContent.includes('INCLUÍDO'), 'bundle page lists included items');
  ok($$('.inclRow').length === 3, 'bundle page shows 3 included rows');
  ok(!!$('.show2 .shPlatform'), 'bundle showcase has platform');
  $$('.pageHead .btn').find((b) => b.textContent.includes('VOLTAR')).click(); await sleep(30);

  // included items open their own showcase from the bundle page
  $$('.fcard2.bundle')[0].click(); await sleep(30);
  const inclName = $$('.inclRow .irNm')[0].textContent;
  $$('.inclRow')[0].click(); await sleep(30);
  ok(!!$('.itemName') && $('.itemName').textContent === inclName, 'included item opens its own showcase');
  ok(!!$('.show2'), 'item showcase present');
  $$('.pageHead .btn').find((b) => b.textContent.includes('VOLTAR')).click(); await sleep(30);
  $$('#screen .fcard2').find((c) => c.textContent.includes('HOMEM DE FERRO')).click(); await sleep(30);
  ok($('.itemName') && $('.itemName').textContent === 'HOMEM DE FERRO', 'item page opens for IRON MAN');
  ok(!!$('.statbars'), 'item page shows stat bars');
  ok(!!$('.itemQuote') && $('.itemQuote').textContent.length > 4, 'item page shows hero quote');
  const c0 = Number($('#coinCount').textContent.replace(/\D/g, ''));
  $$('.actions .btn').find((b) => b.textContent.includes('COMPRAR')).click(); await sleep(30);
  ok(Number($('#coinCount').textContent.replace(/\D/g, '')) === c0, 'buy denied at 500');

  // dev coins then buy + equip
  tabBtns()[4].click(); await sleep(30);
  $$('#screen .btn').find((b) => b.textContent.includes('+5000')).click(); await sleep(30);
  ok($('#coinCount').textContent.replace(/\D/g, '') === '5500', 'dev +5000');
  await toShopGrid();
  $$('#screen .fcard2').find((c) => c.textContent.includes('HOMEM DE FERRO')).click(); await sleep(30);
  $$('.actions .btn').find((b) => b.textContent.includes('COMPRAR')).click(); await sleep(30);
  ok($('#coinCount').textContent.replace(/\D/g, '') === String(5500 - 1600), 'coins deducted (3,900)');
  $$('.actions .btn').find((b) => b.textContent.includes('ESCOLHER HERÓI')).click(); await sleep(30);
  ok(!!$('.ownedTag'), 'item page shows equipped after select');

  // gear + emote showcases use type-specific presentation
  await toShopGrid();
  $$('#screen .gcard').find((c) => c.textContent.includes('BASTÃO')).click(); await sleep(30);
  ok(!!$('.show2 .shItem'), 'gear showcase shows large inspectable icon');
  ok(!!$('.show2 .shPlatform'), 'gear showcase has platform');
  $$('.pageHead .btn').find((b) => b.textContent.includes('VOLTAR')).click(); await sleep(30);
  $$('#screen .ecard')[0].click(); await sleep(30);
  ok(!!$('.show2 .emotePlay'), 'emote showcase plays the emote animation');
  ok(catalog.emotes.every((x) => x.anim && x.anim.frames === 6 && typeof x.anim.start === 'number'), 'emotes carry data-driven animation metadata');
  ok(!!w.__ANIMS && w.__ANIMS['e_dab'] && w.__ANIMS['e_dab'].start === 30 && w.__ANIMS['e_gangnam'].start === 18, 'emote anims registered from catalog data');
  $$('.pageHead .btn').find((b) => b.textContent.includes('VOLTAR')).click(); await sleep(30);

  // bundle buy
  await toShopGrid();
  $$('.fcard2.bundle')[1].click(); await sleep(30);
  const cBefore = Number($('#coinCount').textContent.replace(/\D/g, ''));
  $$('.actions .btn').find((b) => b.textContent.includes('COMPRAR PACOTE')).click(); await sleep(30);
  ok(Number($('#coinCount').textContent.replace(/\D/g, '')) < cBefore, 'bundle purchase works (coins deducted)');

  // locker with combined backbling
  tabBtns()[2].click(); await sleep(30);
  ok(!!$('#screen canvas.hero'), 'locker animated preview');
  ok($$('.lockerGrid .fcard2').length === 4, 'locker shows only owned outfits (4 after test buys)');
  ok($('.lkLoadout') && $$('.lkSlot').length === 3, 'loadout row shows equipped cosmetics');
  ok(!!$('.lkSearch') && $$('.lkF').length === 7, 'locker search + 7 rarity filters');
  $('.lkSearch').value = 'aranha'; $('.lkSearch').dispatchEvent(new w.Event('input', { bubbles: true })); await sleep(20);
  ok($$('.lockerGrid .fcard2').length >= 1 && $$('.lockerGrid .fcard2').every((c) => c.textContent.toLowerCase().includes('aranha')), 'locker search filters');
  $('.lkSearch').value = ''; $('.lkSearch').dispatchEvent(new w.Event('input', { bubbles: true })); await sleep(20);
  const catBling = $$('.lkCat').find((c) => c.textContent === 'BACK BLING');
  catBling.click(); await sleep(30);
  $$('.lockerGrid .fcard2').find((c) => c.textContent.includes('ASAS DE ANJO')).click(); await sleep(30);
  ok($$('.lockerGrid .fcard2').some((c) => c.classList.contains('equipped')), 'glider equipped (combines on hero)');
  ok($('.lkLoadout').textContent.includes('ASAS DE ANJO'), 'loadout shows equipped back bling');

  // tasks categories + level
  tabBtns()[3].click(); await sleep(30);
  ok($('.levelPanel') && $('.levelPanel').textContent.includes('LV'), 'tasks shows stored level');
  ok(['COMBATE', 'ECONOMIA', 'ESTILO'].every((c) => $('#screen').textContent.includes(c)), 'task categories shown');
  tabBtns()[0].click(); await sleep(30);
  $$('#screen .animChips .chip').find((c) => c.textContent === 'EMOTE ▾').click(); await sleep(30);
  const pk = $$('.animChips.picker .chip');
  ok(pk.length === 2, 'emote picker lists owned emotes (DAB+GROOVE)');
  pk[1].click(); await sleep(30);
  tabBtns()[3].click(); await sleep(30);
  ok($('#screen').textContent.includes('1/1'), 'emote task 1/1');
  const claim = $$('#screen .btn').find((b) => b.textContent === 'RESGATAR' && !b.disabled);
  ok(!!claim, 'claim enabled');
  if (claim) { const cb2 = Number($('#coinCount').textContent.replace(/\D/g, '')); claim.click(); await sleep(30); ok(Number($('#coinCount').textContent.replace(/\D/g, '')) > cb2, 'task claimed (reward)'); }

  // match
  tabBtns()[0].click(); await sleep(30);
  $$('#screen .btn').find((b) => b.textContent.trim() === 'JOGAR').click();
  await sleep(6000);
  ok(!!$('#screen .in-play, .stage.in-play'), 'per-tab transition class present');
  ok(!!$('#deploy'), 'deploy overlay');
  ok(catalog.maps.some((m) => $('#deploy').textContent.includes(m.name)), 'random map picked');
  const back = $$('#deploy .btn').find((b) => b.textContent.includes('VOLTAR AO LOBBY'));
  ok(!!back, 'results shown');
  if (back) { back.click(); await sleep(30); }
  ok($('#screen').textContent.includes('PARTIDAS 1'), 'match stat in lobby');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('SMOKE ERROR', e); process.exit(2); });
