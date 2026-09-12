// Boot: name-only top tabs, HUD, settings modal, routing.
import { el, fmt, coinDataURL } from './util.js';
import { store } from './store.js';
import { startParticles, setParticlesEnabled, setVolume, setHoverEnabled, sfx, toggleMute, isMuted } from './fx.js';
import { setFpsCap } from './anim.js';
import { renderPlay, renderShop, renderLocker, renderTasks, renderDev, toast, modal, shopHome } from './screens.js';
import { bus } from './bus.js';

const TABS = [
  ['play', 'JOGAR'],
  ['shop', 'LOJA'],
  ['locker', 'ARMÁRIO'],
  ['tasks', 'TAREFAS'],
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
  setVolume((s.sfxVol == null ? 80 : s.sfxVol) / 100);
  setHoverEnabled(s.hoverSounds !== false);
  setFpsCap(s.fpsCap || 60);
  const f = [];
  if (s.brightness !== 100) f.push(`brightness(${s.brightness}%)`);
  if (s.contrast !== 100) f.push(`contrast(${s.contrast}%)`);
  if ((s.saturation == null ? 100 : s.saturation) !== 100) f.push(`saturate(${s.saturation}%)`);
  document.body.style.filter = f.join(' ');
  document.documentElement.style.fontSize = `${16 * (s.uiScale || 100) / 100}px`;
  document.body.classList.toggle('reduce-motion', !!s.reduceMotion);
  document.body.classList.toggle('high-contrast', !!s.highContrast);
  document.body.classList.toggle('large-text', !!s.largeText);
  document.body.classList.toggle('no-quotes', !s.showQuotes);
  document.body.classList.toggle('smoothing', !!s.smoothing);
  document.body.classList.toggle('no-glow', !s.bgGlow);
  document.body.classList.toggle('rar-tags', !!s.rarTags);
  document.body.classList.toggle('fps-on', !!s.fpsMeter);
  if (s.fpsMeter) startFpsMeter();
}

let fpsRunning = false;
function startFpsMeter() {
  if (fpsRunning) return;
  fpsRunning = true;
  let m = document.getElementById('fpsMeter');
  if (!m) { m = document.createElement('div'); m.id = 'fpsMeter'; document.body.append(m); }
  let frames = 0, last = performance.now();
  (function loop(t) {
    frames++;
    if (t - last >= 500) {
      m.textContent = `${Math.round(frames * 1000 / (t - last))} FPS`;
      frames = 0; last = t;
      if (!store.data.settings.fpsMeter) { fpsRunning = false; return; }
    }
    requestAnimationFrame(loop);
  })(last);
}

function openSettings() {
  const s = store.data.settings;
  const rootEl = document.getElementById('modalRoot');
  const root = el('div', { class: 'settingsFS in-settings' });
  const tabsBar = el('div', { class: 'setTabs' });
  const listEl = el('div', { class: 'setList' });
  const descEl = el('div', { class: 'setDesc' });
  let tab = 'video';

  const SET_TABS = [
    ['video', 'VÍDEO'], ['audio', 'ÁUDIO'], ['game', 'JOGO'],
    ['ui', 'INTERFACE'], ['access', 'ACESSIBILIDADE'], ['data', 'DADOS'],
  ];

  function describe(label, text) {
    descEl.innerHTML = '';
    descEl.append(el('h3', {}, label), el('p', {}, text));
  }
  function row(label, ctrl, text) {
    const r = el('div', { class: 'setRow', onmouseenter: () => describe(label, text) },
      el('span', { class: 'setLbl' }, label), ctrl);
    r.addEventListener('click', () => describe(label, text));
    return r;
  }
  function toggle(key, label, text) {
    const btn = el('button', { class: `setVal ${s[key] ? 'on' : ''}` }, s[key] ? 'ON' : 'OFF');
    btn.onclick = (e) => {
      e.stopPropagation(); sfx.click();
      s[key] = !s[key]; store.emit('settings'); applySettings();
      btn.textContent = s[key] ? 'ON' : 'OFF';
      btn.classList.toggle('on', s[key]);
      bus.refresh();
    };
    return row(label, btn, text);
  }
  function slider(key, label, min, max, unit, text) {
    const inp = el('input', { type: 'range', min, max, value: s[key] });
    const val = el('span', { class: 'setNum' }, `${s[key]}${unit}`);
    inp.oninput = () => {
      s[key] = Number(inp.value); val.textContent = `${s[key]}${unit}`;
      store.emit('settings'); applySettings();
    };
    return row(label, el('div', { class: 'setSlide' }, inp, val), text);
  }
  function choice(key, label, opts, fmtFn, text) {
    const lab = el('span', { class: 'setNum' }, fmtFn(s[key]));
    const wrap = el('div', { class: 'setChoice' });
    const left = el('button', {}, '◂'); const right = el('button', {}, '▸');
    const go = (d) => {
      const i = Math.max(0, opts.indexOf(s[key]) + d);
      s[key] = opts[Math.min(opts.length - 1, i)];
      lab.textContent = fmtFn(s[key]);
      store.emit('settings'); applySettings(); sfx.click();
      if (key === 'fullscreen') {
        if (s.fullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
        if (!s.fullscreen && document.fullscreenElement) document.exitFullscreen?.();
      }
    };
    left.onclick = (e) => { e.stopPropagation(); go(-1); };
    right.onclick = (e) => { e.stopPropagation(); go(1); };
    wrap.append(left, lab, right);
    return row(label, wrap, text);
  }

  function buildTab() {
    listEl.innerHTML = '';
    if (tab === 'video') {
      listEl.append(
        el('h2', { class: 'setSec' }, 'EXIBIÇÃO'),
        choice('fullscreen', 'MODO DE JANELA', [false, true], (v) => v ? 'TELA CHEIA' : 'JANELA', 'Tela cheia usa a tela inteira. Janela deixa redimensionar e multitarefar.'),
        slider('brightness', 'BRILHO', 60, 140, '%', 'Ajusta o brilho de toda a interface.'),
        slider('contrast', 'CONTRASTE', 60, 140, '%', 'Aumenta ou suaviza o contraste da interface.'),
        slider('saturation', 'SATURAÇÃO', 60, 160, '%', 'Aumenta ou reduz a intensidade das cores.'),
        el('h2', { class: 'setSec' }, 'GRÁFICOS'),
        choice('fpsCap', 'LIMITE DE QUADROS', [30, 60, 120], (v) => `${v} FPS`, 'Limita os quadros da animação. Limites baixos economizam bateria.'),
        toggle('particles', 'PARTÍCULAS DO LOBBY', 'Pontinhos de pixel flutuando no fundo do lobby.'),
        toggle('smoothing', 'SUAVIZAÇÃO DE PIXEL', 'Suaviza o pixel art. Desligue para pixels crocantes.'),
        toggle('bgGlow', 'BRILHO DE FUNDO', 'Brilhos de cor ambiente atrás dos menus.'),
        toggle('screenShake', 'TREMOR DE TELA', 'Adiciona tremor ao iniciar partidas.'));
    } else if (tab === 'audio') {
      listEl.append(
        el('h2', { class: 'setSec' }, 'ÁUDIO'),
        toggle('sound', 'SOM', 'Liga/desliga todos os sons da interface.'),
        slider('sfxVol', 'VOLUME DE EFEITOS', 0, 100, '%', 'Volume de cliques, compras e outros efeitos.'),
        toggle('hoverSounds', 'SONS DE CURSOR', 'Bipes leves ao passar o cursor em abas e botões.'),
        row('TESTAR SOM', el('button', {
          class: 'setVal on',
          onclick: (e) => { e.stopPropagation(); sfx.buy(); }
        }, 'TOCAR'), 'Toca o jingle de compra no volume atual.'));
    } else if (tab === 'game') {
      listEl.append(
        el('h2', { class: 'setSec' }, 'GAMEPLAY'),
        toggle('confirmBuys', 'CONFIRMAR COMPRAS', 'Mostra uma confirmação antes de gastar moedas.'),
        toggle('emoteNotes', 'NOTAS DE EMOTE', 'Mostra notas musicais ao usar emotes.'),
        choice('heroSize', 'TAMANHO DO HERÓI', ['S', 'M', 'L'], (v) => ({ S: 'PEQUENO', M: 'MÉDIO', L: 'GRANDE' })[v], 'Quão grande seu herói fica no lobby.'),
        toggle('fpsMeter', 'MEDIDOR DE FPS', 'Mostra um contador de FPS ao vivo no canto.'));
    } else if (tab === 'ui') {
      listEl.append(
        el('h2', { class: 'setSec' }, 'INTERFACE'),
        slider('uiScale', 'ESCALA DA INTERFACE', 80, 120, '%', 'Escala o tamanho base da interface.'),
        toggle('largeText', 'TEXTO GRANDE', 'Aumenta o texto nos menus.'),
        toggle('showQuotes', 'MOSTRAR FALAS', 'Mostra as falas dos heróis no lobby, armário e loja.'),
        toggle('rarTags', 'ETIQUETAS DE RARIDADE', 'Mostra o nome da raridade em cada card da loja e do armário.'));
    } else if (tab === 'access') {
      listEl.append(
        el('h2', { class: 'setSec' }, 'ACCESSIBILITY'),
        toggle('reduceMotion', 'REDUZIR MOVIMENTO', 'Desativa animações e transições dos menus.'),
        toggle('highContrast', 'ALTO CONTRASTE', 'Clareia textos fracos e reforça bordas.'),
        toggle('colorblind', 'RARIDADE P/ DALTONISMO', 'Usa cores de raridade amigáveis a deutanopia.'));
    } else {
      listEl.append(
        el('h2', { class: 'setSec' }, 'DATA'),
        row('EXPORTAR SAVE', el('button', {
          class: 'setVal on',
          onclick: (e) => {
            e.stopPropagation(); sfx.click();
            try { navigator.clipboard?.writeText(JSON.stringify(store.data, null, 2)); } catch {}
            toast('SAVE COPIADO', 'green');
          }
        }, 'COPIAR'), 'Copia seu save completo em JSON.'),
        row('RESTAURAR PADRÕES', el('button', {
          class: 'setVal',
          onclick: (e) => {
            e.stopPropagation(); sfx.click();
            const { defaultSave } = storeMod;
            store.data.settings = defaultSave().settings;
            store.emit('settings'); applySettings(); bus.refresh();
            rootEl.innerHTML = ''; openSettings();
          }
        }, 'RESETAR'), 'Reseta todas as configurações ao padrão.'),
        row('APAGAR SAVE', el('button', {
          class: 'setVal danger',
          onclick: (e) => { e.stopPropagation(); sfx.deny(); store.resetAll(); toast('SAVE WIPED', 'red'); bus.refresh(); }
        }, 'APAGAR'), 'Apaga seu save: moedas, itens, tarefas e nível.'));
    }
  }

  function buildTabs() {
    tabsBar.innerHTML = '';
    SET_TABS.forEach(([id, label]) => {
      const b = el('button', {
        class: `setTab ${id === tab ? 'sel' : ''}`,
        title: label,
        onclick: () => { sfx.tab(); tab = id; buildTabs(); buildTab(); }
      }, el('img', { class: 'pixel', src: `assets/spr/set_${id}.png`, alt: label }));
      tabsBar.append(b);
    });
  }

  root.append(tabsBar,
    el('div', { class: 'setCols' }, listEl, el('div', { class: 'setScrollbar' }), descEl),
    el('div', { class: 'setFoot' },
      el('span', { class: 'setHint' }, 'CONFIGURAÇÕES APLICADAS NA HORA'),
      el('button', { class: 'btn ghost', onclick: () => { sfx.click(); rootEl.innerHTML = ''; } }, '✕ VOLTAR')));
  buildTabs(); buildTab();
  rootEl.innerHTML = '';
  rootEl.append(root);
}
const storeMod = { defaultSave: null };

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
  window.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const keys = { 1: 'play', 2: 'shop', 3: 'locker', 4: 'tasks', 5: 'dev' };
    if (keys[e.key]) { current = keys[e.key]; sfx.tab(); buildTabs(); renderCurrent(); }
    else if (e.key === 'Escape') {
      const fsx = document.querySelector('.settingsFS');
      if (fsx) { sfx.click(); fsx.remove(); }
      else if (document.querySelector('.modePrompt')) document.querySelector('.modePrompt').remove();
      else { shopHome(); renderCurrent(); }
    }
  });
  buildTabs();
  renderCurrent();
  toast('BEM-VINDO AO LOBBY PIXEL', 'green');
}

boot();
