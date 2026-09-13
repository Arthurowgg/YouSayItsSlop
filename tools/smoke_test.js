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

  // PLAY v2: cinematic mode select
  ok(!!$('#screen .play2 .p2sky') && !!$('#screen .play2 .p2stars') && !!$('#screen .play2 .p2skyline') && $$('#screen .play2 .p2fog').length === 2 && !!$('#screen .play2 .p2pix'), 'play has layered atmospheric scene (sky/stars/skyline/fog/embers)');
  ok($('#screen .play2').dataset.mode === 'mode_1v1' && !!$('#screen .p2emblem'), 'scene tinted + emblem for selected mode');
  ok($$('#screen .p2card').length === 2 && catalog.modes.length === 2, 'exactly two game modes');
  ok($$('#screen .p2card')[0].classList.contains('sel') && $$('#screen .p2card')[0].textContent.includes('1V1'), '1v1 selected by default');
  ok($$('#screen .p2card')[0].textContent.includes('DISPONÍVEL'), '1v1 marked available');
  ok(!$('#screen .p2play').disabled, 'PLAY enabled for 1v1');
  ok($$('#screen .p2card')[1].textContent.includes('EM BREVE'), 'domination marked coming soon');
  $$('#screen .p2card')[1].click(); await sleep(30);
  ok($$('#screen .p2card')[1].classList.contains('sel'), 'domination selectable for preview');
  ok($('#screen .play2').dataset.mode === 'mode_domination' && $('#screen .p2emblem').src.includes('mode_domination'), 'scene tint + emblem follow selection');
  ok($('#screen .p2play').disabled && $('#screen .p2play').textContent.includes('EM BREVE'), 'PLAY disabled while domination selected');
  ok(!$('#deploy'), 'domination cannot start a match');
  $$('#screen .p2card')[0].click(); await sleep(30);
  ok($$('#screen .p2card')[0].classList.contains('sel') && !$('#screen .p2play').disabled, 'back to 1v1 re-enables PLAY');
  ok(!catalog.emotes, 'emotes removed from catalog');
  const mapBefore = $('#screen .p2map .rn').textContent;
  $('#screen .p2map').click(); await sleep(30);
  ok($('#screen .p2map .rn').textContent.length > 4, 'next-map chip rerolls');
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

  // shop v3: category sections with scroll-snap
  await toShopGrid();
  ok($$('#screen .shopSec').length === 5 && catalog.shopCats.length === 5, 'shop has 5 category sections');
  ok(!!$('.shop3') && !!$('.catDots') && $$('.catDot').length === 5, 'category scroller + dot nav');
  const shopTxt = $('.shop3').textContent;
  ok(!shopTxt.includes('EMOTES') && !shopTxt.includes('ÉPICO') && !shopTxt.includes('NOVO') && !shopTxt.includes('TRAJE'), 'no emotes / épico / novo / traje written in shop');
  ok($$('.s3card.bundle').length === 5, 'shop shows 5 bundle cards (one per category)');
  ok($$('.catBlings canvas').length === 12, 'every back bling previewed riding a hero');
  ok($$('.s3card.hero').length === 9 && $$('.s3card.skin').length === 0, '9 hero cards, skins listed separately (none yet)');
  ok($$('.catPicks .s3card').length === 30, 'all picks listed by category');
  ok($$('.s3card.owned .ownBadge').length >= 2 && $$('.s3card.owned').every((c) => !c.querySelector('.c3bar .price')), 'owned overrides the price tag');
  ok($$('.s3card').every((c) => !c.querySelector('.rarlbl2') && !c.querySelector('.typeTag') && !c.querySelector('.newTag')), 'no rarity/type/new text tags on cards');

  $$('.s3card.bundle')[0].click(); await sleep(30);
  ok($('#screen').textContent.includes('INCLUÍDO'), 'bundle page lists included items');
  ok($$('.inclRow').length === 3, 'bundle page shows 3 included rows');
  ok($$('.inclRow .price').length === 0, 'bundle contents carry no individual prices (bundle price overrides)');
  ok(!!$('.show2 .shPlatform'), 'bundle showcase has platform');
  $$('.pageHead .btn').find((b) => b.textContent.includes('VOLTAR')).click(); await sleep(30);

  // included items open their own showcase from the bundle page
  $$('.s3card.bundle')[0].click(); await sleep(30);
  const inclName = $$('.inclRow .irNm')[0].textContent;
  $$('.inclRow')[0].click(); await sleep(30);
  ok(!!$('.itemName') && $('.itemName').textContent === inclName, 'included item opens its own showcase');
  ok(!!$('.show2'), 'item showcase present');
  $$('.pageHead .btn').find((b) => b.textContent.includes('VOLTAR')).click(); await sleep(30);
  $$('#screen .s3card').find((c) => c.textContent.includes('HOMEM DE FERRO')).click(); await sleep(30);
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
  $$('#screen .s3card').find((c) => c.textContent.includes('HOMEM DE FERRO')).click(); await sleep(30);
  $$('.actions .btn').find((b) => b.textContent.includes('COMPRAR')).click(); await sleep(30);
  ok($('#coinCount').textContent.replace(/\D/g, '') === String(5500 - 1600), 'coins deducted (3,900)');
  $$('.actions .btn').find((b) => b.textContent.includes('ESCOLHER HERÓI')).click(); await sleep(30);
  ok(!!$('.ownedTag'), 'item page shows equipped after select');

  // gear + emote showcases use type-specific presentation
  await toShopGrid();
  $$('#screen .s3card.gear').find((c) => c.textContent.includes('BASTÃO')).click(); await sleep(30);
  ok(!!$('.show2 .shItem'), 'gear showcase shows large inspectable icon');
  ok(!!$('.show2 .shPlatform'), 'gear showcase has platform');
  $$('.pageHead .btn').find((b) => b.textContent.includes('VOLTAR')).click(); await sleep(30);
  $$('#screen .s3card.gear').find((c) => c.textContent.includes('ESCUDO ESTRELA')).click(); await sleep(30);
  ok(!!$('.show2 .shStage') && !$('.show2 .shItem'), 'back bling showcase rides the equipped hero');
  $$('.pageHead .btn').find((b) => b.textContent.includes('VOLTAR')).click(); await sleep(30);

  // bundle buy
  await toShopGrid();
  $$('.s3card.bundle')[1].click(); await sleep(30);
  const cBefore = Number($('#coinCount').textContent.replace(/\D/g, ''));
  $$('.actions .btn').find((b) => b.textContent.includes('COMPRAR PACOTE')).click(); await sleep(30);
  ok(Number($('#coinCount').textContent.replace(/\D/g, '')) < cBefore, 'bundle purchase works (coins deducted)');

  // locker with combined backbling
  tabBtns()[2].click(); await sleep(30);
  ok(!!$('#screen canvas.hero'), 'locker animated preview');
  ok($$('.lk2Grid .s3card:not(.empty)').length === 4, 'locker hero rack shows only owned base heroes (4 after test buys)');
  ok($$('.lk2Slot').length === 3 && $$('.lk2Slot')[0].textContent.includes('HOMEM DE FERRO'), 'equipped loadout visible in 3 customization slots');
  ok(!!$('.lkSearch') && $$('.lkF').length === 7, 'locker search + 7 rarity filters');
  $('.lkSearch').value = 'aranha'; $('.lkSearch').dispatchEvent(new w.Event('input', { bubbles: true })); await sleep(20);
  ok($$('.lk2Grid .s3card:not(.empty)').length >= 1 && $$('.lk2Grid .s3card:not(.empty)').every((c) => c.textContent.toLowerCase().includes('aranha')), 'locker search filters');
  $('.lkSearch').value = ''; $('.lkSearch').dispatchEvent(new w.Event('input', { bubbles: true })); await sleep(20);
  $$('.lk2Slot')[1].click(); await sleep(30);
  ok($$('.lk2Grid .s3card').length === 2, 'bling rack lists owned bling + empty slot');
  $$('.lk2Grid .s3card').find((c) => c.textContent.includes('ESCUDO ESTRELA')).click(); await sleep(30);
  ok($$('.lk2Grid .s3card').some((c) => c.classList.contains('equipped')), 'glider equipped (combines on hero)');
  ok($$('.lk2Slot')[1].textContent.includes('ESCUDO ESTRELA'), 'bling slot shows equipped accessory');
  $$('.lk2Slot')[0].click(); await sleep(30);
  ok($$('.lk2Grid .s3card:not(.empty)').length === 4 && $$('.lk2Grid .s3card:not(.empty)').some((c) => c.textContent.includes('HOMEM DE FERRO')), 'hero rack lists owned base heroes (skins live inside them)');
  ok($$('.lk2Grid .skinChip').length === 0, 'no owned skins yet - chips appear with their hero when owned');

  // tasks categories + level
  tabBtns()[3].click(); await sleep(30);
  ok($('.levelPanel') && $('.levelPanel').textContent.includes('LV'), 'tasks shows stored level');
  ok(['COMBATE', 'ECONOMIA', 'ESTILO'].every((c) => $('#screen').textContent.includes(c)), 'task categories shown');
  tabBtns()[3].click(); await sleep(30);
  ok($('#screen').textContent.includes('2/2'), 'loadout task 2/2 after two equips');
  const claim = $$('#screen .btn').find((b) => b.textContent === 'RESGATAR' && !b.disabled);
  ok(!!claim, 'claim enabled');
  if (claim) { const cb2 = Number($('#coinCount').textContent.replace(/\D/g, '')); claim.click(); await sleep(30); ok(Number($('#coinCount').textContent.replace(/\D/g, '')) > cb2, 'task claimed (reward)'); }

  // match
  tabBtns()[0].click(); await sleep(30);
  $('#screen .p2play').click();
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
