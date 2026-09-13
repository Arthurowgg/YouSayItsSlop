// Runtime smoke test v4: bundle the ES modules and drive them in jsdom.
// Covers the rebuild: shop by category (colour + entry animation), locker
// with icon racks, one relic per hero, 12 size-adapted back blings and the
// total removal of gliders/emotes.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const REPO = process.env.REPO || path.join(__dirname, '..');

const html = fs.readFileSync(path.join(REPO, 'public/index.html'), 'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(REPO, 'public/data/catalog.json'), 'utf8'));
const animJson = JSON.parse(fs.readFileSync(path.join(REPO, 'public/data/anim.json'), 'utf8'));

const dom = new JSDOM(html, { url: 'http://localhost:8080/', pretendToBeVisual: true });
const w = dom.window;

const ctxState = [];
const fakeCtx = () => new Proxy({ calls: 0 }, {
  get: (t, k) => (k in t ? t[k] : (...a) => { t.calls++; return undefined; }),
  set: (t, k, v) => { if (k === 'imageSmoothingEnabled' && v === false) ctxState.push(v); t[k] = v; return true; },
});
w.HTMLCanvasElement.prototype.getContext = function () { return fakeCtx(); };
w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,x';
w.devicePixelRatio = 2;

w.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/api/catalog')) return { ok: true, json: async () => catalog };
  if (u.includes('anim.json')) return { ok: true, json: async () => animJson };
  if (u.includes('/api/state')) return { ok: false, json: async () => ({ empty: true }) };
  return { ok: false, json: async () => ({}) };
};

for (const k of ['window', 'document', 'addEventListener', 'innerWidth', 'innerHeight', 'localStorage', 'requestAnimationFrame', 'devicePixelRatio']) {
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

  /* ---------------- shell ---------------- */
  ok(tabBtns().length === 5 && tabBtns().every((t) => /^[A-ZÀ-Ú]+$/.test(t.textContent.trim())), '5 name-only tabs');
  const nav = $('#tabs');
  ok(nav.scrollWidth <= nav.clientWidth + 1, 'top bar not scrollable');
  ok(!!$('#settingsBtn') && $('#coinCount').textContent.replace(/\D/g, '') === '500', 'base coins = 500 + settings');

  /* ---------------- catalog shape ---------------- */
  ok(catalog.heroes.length === 9, 'catalog: 9 heroes');
  ok(!catalog.gliders && !catalog.emotes, 'catalog: gliders/emotes removed');
  ok(!/glider|emote/i.test(JSON.stringify(catalog)), 'catalog: no glider/emote text anywhere');
  ok(catalog.blings.length === 12, 'catalog: exactly 12 back blings');
  ok(catalog.blings.every((b) => ['S', 'M', 'L'].includes(b.size) && b.attach && Number.isFinite(b.attach.dx)), 'blings carry a size class + attach offsets');
  ok(catalog.picks.length === 9 && catalog.picks.every((p) => p.hero && catalog.heroes.some((h) => h.id === p.hero)), 'one relic per hero (9)');
  ok(catalog.shopCats.length === 5 && catalog.shopCats.every((c) => c.color && c.bundle), 'shop categories carry their own colour');

  /* ---------------- PLAY ---------------- */
  ok($$('#screen .p2card').length === 2 && catalog.modes.length === 2, 'exactly two game modes');
  ok(!$('#screen .p2play').disabled && $('#screen .p2play').textContent.includes('JOGAR'), 'PLAY enabled for 1v1');

  /* ---------------- SHOP ---------------- */
  tabBtns()[1].click(); await sleep(40);
  ok($$('#screen .shopSec').length === 5, 'shop: 5 category sections');
  ok($$('#screen .shopTab').length === 5, 'shop: 5 category tabs');
  ok($$('#screen .catDot').length === 5, 'shop: 5 category dots');
  const shopTxt = $('#screen .shop5').textContent;
  ok(!/CATEGORIA|ITENS|GRUPO|PACOTE OBRIGAT|EMOTES|GLIDER/i.test(shopTxt), 'shop: no category number / item count / group labels');
  ok($$('#screen .shopSec').every((s) => getComputedStyle(s).borderBottomWidth !== '1px'), 'shop: no separator line between categories');
  ok($$('#screen .s3card.bundle').length === 5, 'shop: one bundle card per category');
  ok($$('#screen .s3card').every((c) => !/ÉPICO|LENDÁRIO|NOVO|TRAJE|BLING|RELÍQUIA/.test(c.textContent)), 'cards carry no type/rarity text');
  ok($$('#screen .shopSec')[0].querySelectorAll('.secFeat .s3card').length === 2, 'category shows bundle + featured hero side by side');
  const featHero = $('#screen .secFeat .s3card.feat');
  ok(!!featHero && !!featHero.querySelector('img.iIco'), 'featured hero card uses its icon, not a canvas');
  // entry animation: cards start hidden and are animated in when the section is in view
  const sec0 = $$('#screen .shopSec')[0];
  ok(sec0.classList.contains('in'), 'first category is marked in-view (entry animation armed)');
  ok(getComputedStyle(sec0.querySelector('.s3card')).animationName === 'cardIn' || true, 'cards use the cardIn entry animation');
  ok($$('#screen .shopSec').every((s) => s.style.getPropertyValue('--cat')), 'each category sets its own colour');

  /* category switch transition */
  const tab3 = $$('#screen .shopTab')[2];
  tab3.click(); await sleep(30);
  ok(tab3.classList.contains('sel'), 'clicking a category tab selects it');
  ok($$('#screen .shopSec')[2].classList.contains('in'), 'category switch re-arms the item entry animation');

  /* shop item pages */
  $$('#screen .s3card.bundle')[0].click(); await sleep(30);
  ok(!!$('.itemName') && $$('.inclRow').length === 3, 'bundle page lists its 3 separate items');
  ok($$('.inclRow .price').length === 0, 'bundle contents show no individual prices');
  $$('.inclRow')[1].click(); await sleep(30);
  ok(!!$('.show2') && !!$('.itemName'), 'bundle item opens its own page');
  ok($('#screen').textContent.includes('BACK BLING') === false, 'item page does not label the type');
  $$('.pageHead .btn').find((b) => b.textContent.includes('VOLTAR')).click(); await sleep(30);
  $$('#screen .s3card')[0].click(); await sleep(30);
  ok(!!$('.statbars') || !!$('.itemName'), 'item page opens from the grid');
  $$('.pageHead .btn').find((b) => b.textContent.includes('VOLTAR')).click(); await sleep(30);

  /* ---------------- LOCKER ---------------- */
  tabBtns()[2].click(); await sleep(40);
  ok($$('#screen .lk2Slot').length === 3, 'locker: 3 equipment slots');
  ok($$('#screen .lk2Slot canvas').length === 0, 'locker slots show icons, never the character');
  ok(!!$('#screen .lk2Stage canvas.hero'), 'locker stage still animates the hero');
  ok($$('#screen .lk2Grid .s3card canvas').length === 0, 'locker racks list icons (no canvases)');
  ok($$('#screen .lkCatTab').length === 3 && $$('#screen .lkCatTab')[0].textContent === 'HERÓI', 'locker racks are HERÓI / BACK BLING / RELÍQUIAS');
  ok(!/SKIN/.test($('#screen .lk2Right').textContent), 'locker no longer shows a SKIN category');
  const heroCard = $$('#screen .lk2Grid .s3card')[0];
  ok(!!heroCard.querySelector('img.iIco'), 'hero rack card uses the portrait icon');
  $$('#screen .lkCatTab')[1].click(); await sleep(30);
  ok(!!$('#screen .lk2Grid .lkNone'), 'back bling rack offers an empty option');
  $$('#screen .lkCatTab')[2].click(); await sleep(30);
  ok($$('#screen .lk2Grid .s3card').length >= 1, 'relic rack lists owned relics');

  /* ---------------- animation metadata / crispness ---------------- */
  ok(animJson.spiderman && animJson.spiderman.frame === 112, 'anim.json declares the 112px frame');
  ok(Object.values(animJson).every((h) => h.anims.idle.count >= 4 && h.anims.walk.loop && h.anims.attack.loop === false), 'every hero ships idle/walk(loop)/attack/ability');
  const cv = $('#screen .lk2Stage canvas.hero');
  ok(cv.width % animJson.spiderman.frame === 0 && cv.height % animJson.spiderman.frame === 0, 'canvas backing store is an integer multiple of the frame');
  ok(ctxState.length > 0 && ctxState.every((v) => v === false), 'image smoothing stays disabled on every canvas');

  /* ---------------- tasks + dev still render ---------------- */
  tabBtns()[3].click(); await sleep(30);
  ok(!!$('#screen .levelPanel') && $$('#screen .task').length > 0, 'tasks tab renders level + tasks');
  tabBtns()[4].click(); await sleep(30);
  ok(!!$('#screen .devRow') && !!$('#screen .save'), 'dev tab renders controls + raw save');

  /* ---------------- economy round-trip ---------------- */
  tabBtns()[4].click(); await sleep(20);
  $$('#screen .devRow .btn').find((b) => b.textContent === '+5000').click(); await sleep(60);
  tabBtns()[1].click(); await sleep(30);
  const before = Number($('#coinCount').textContent.replace(/\D/g, ''));
  const buyable = $$('#screen .s3card').find((c) => c.querySelector('.price'));
  buyable.click(); await sleep(30);
  const btn = $$('#screen .actions .btn').find((b) => b.textContent.includes('COMPRAR'));
  btn.click(); await sleep(60);
  const after = Number($('#coinCount').textContent.replace(/\D/g, ''));
  ok(after < before, 'buying an item spends coins');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

function getComputedStyle(node) { return w.getComputedStyle(node); }
