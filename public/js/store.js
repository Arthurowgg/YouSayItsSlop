// Save-state store: server-backed (POST /api/state) with localStorage fallback.
import { todayKey, weekKey, clamp } from './util.js';

export const COIN_BASE = 500; // test-build starting currency

export function defaultSave() {
  return {
    coins: COIN_BASE,
    level: 1,
    xp: 0,
    owned: ['spiderman', 'blackwidow'],
    picks: ['pick_axe'],
    gliders: [],
    emotes: ['emote_salute'],
    equipped: { hero: 'spiderman', style: 'default', pick: 'pick_axe', glider: null, emote: 'emote_salute' },
    stats: { matches: 0, wins: 0, purchases: 0, equips: 0, emotes: 0 },
    tasks: {},
    dev: { noCooldown: true, unlockAll: false },
    settings: { sound: true, particles: true, scanlines: true },
    day: todayKey(),
    week: weekKey(),
  };
}

export class Store {
  constructor() {
    this.data = defaultSave();
    this.api = false;
    this.listeners = new Set();
    this.catalog = null;
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(what) { this.listeners.forEach((fn) => fn(what)); this.persist(); }

  async load() {
    try {
      const r = await fetch('/api/state');
      if (r.ok) {
        const j = await r.json();
        if (!j.empty) { this.data = { ...defaultSave(), ...j }; this.api = true; }
      }
    } catch { /* offline / file:// -> localStorage */ }
    if (!this.api) {
      try {
        const raw = localStorage.getItem('mpr_save');
        if (raw) this.data = { ...defaultSave(), ...JSON.parse(raw) };
      } catch {}
    }
    try {
      const rc = await fetch('/api/catalog');
      this.catalog = await rc.json();
    } catch {
      const rc = await fetch('data/catalog.json'); // file:// fallback when served statically
      this.catalog = await rc.json();
    }
    this.rollCalendars();
    this.ensureTasks();
  }

  _saveTimer = 0;
  persist() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      if (this.api) {
        fetch('/api/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.data),
        }).catch(() => {});
      } else {
        try { localStorage.setItem('mpr_save', JSON.stringify(this.data)); } catch {}
      }
    }, 150);
  }

  async resetAll() {
    this.data = defaultSave();
    if (this.api) await fetch('/api/state', { method: 'DELETE' }).catch(() => {});
    else localStorage.removeItem('mpr_save');
    this.ensureTasks();
    this.emit('reset');
  }

  // ---- calendar / task bookkeeping ----
  rollCalendars() {
    const d = this.data;
    if (d.day !== todayKey()) {
      d.day = todayKey();
      for (const t of this.catalog.tasks.filter((t) => t.type === 'daily')) d.tasks[t.id] = this._freshTask(t);
    }
    if (d.week !== weekKey()) {
      d.week = weekKey();
      for (const t of this.catalog.tasks.filter((t) => t.type === 'weekly')) d.tasks[t.id] = this._freshTask(t);
    }
  }
  _freshTask(t) { return { start: this.data.stats[t.metric] || 0, claimed: false }; }
  ensureTasks() {
    for (const t of this.catalog.tasks) if (!this.data.tasks[t.id]) this.data.tasks[t.id] = this._freshTask(t);
  }
  taskProgress(t) {
    const st = this.data.tasks[t.id];
    const cur = (this.data.stats[t.metric] || 0) - (st ? st.start : 0);
    return { cur: clamp(cur, 0, t.count), done: cur >= t.count, claimed: !!(st && st.claimed) };
  }
  claimTask(t) {
    const p = this.taskProgress(t);
    if (!p.done || p.claimed) return false;
    this.data.tasks[t.id].claimed = true;
    this.addCoins(t.coins);
    this.addXP(t.xp);
    if (this.data.dev.noCooldown) {
      // test mode: re-arm immediately so currency can be earned with no cooldown
      this.data.tasks[t.id] = this._freshTask(t);
    }
    this.emit('task');
    return true;
  }
  resetTasks(scope) {
    for (const t of this.catalog.tasks.filter((x) => !scope || x.type === scope))
      this.data.tasks[t.id] = this._freshTask(t);
    this.emit('tasks-reset');
  }

  // ---- economy ----
  addCoins(n) { this.data.coins = clamp(this.data.coins + n, 0, 999999999); this.emit('coins'); }
  setCoins(n) { this.data.coins = clamp(n, 0, 999999999); this.emit('coins'); }
  addXP(n) {
    const d = this.data;
    d.xp += n;
    let ups = 0;
    while (d.xp >= this.xpNeed()) { d.xp -= this.xpNeed(); d.level++; ups++; }
    if (ups) this.emit('levelup');
    else this.emit('xp');
    return ups;
  }
  xpNeed() { return 100 + (this.data.level - 1) * 50; }

  bump(metric, n = 1) {
    this.data.stats[metric] = (this.data.stats[metric] || 0) + n;
    this.emit('stats');
  }

  // ---- inventory ----
  owns(type, id) {
    if (this.data.dev.unlockAll) return true;
    const bag = type === 'hero' ? 'owned' : type === 'pick' ? 'picks' : type === 'glider' ? 'gliders' : 'emotes';
    return this.data[bag].includes(id);
  }
  buy(type, id, price) {
    if (this.owns(type, id) || this.data.coins < price) return false;
    const bag = type === 'hero' ? 'owned' : type === 'pick' ? 'picks' : type === 'glider' ? 'gliders' : 'emotes';
    this.data[bag].push(id);
    this.data.coins -= price;
    this.bump('purchases');
    this.emit('buy');
    return true;
  }
  buyBundle(b) {
    if (this.data.coins < b.price) return false;
    this.data.coins -= b.price;
    for (const id of b.items) {
      const it = this.findItem(id);
      if (!it || this.owns(it.type, id)) continue;
      const bag = it.type === 'hero' ? 'owned' : it.type === 'pick' ? 'picks' : it.type === 'glider' ? 'gliders' : 'emotes';
      this.data[bag].push(id);
    }
    this.bump('purchases');
    this.emit('buy');
    return true;
  }
  findItem(id) {
    const c = this.catalog;
    if (c.heroes.some((h) => h.id === id)) return { type: 'hero', item: c.heroes.find((h) => h.id === id) };
    if (c.picks.some((h) => h.id === id)) return { type: 'pick', item: c.picks.find((h) => h.id === id) };
    if (c.gliders.some((h) => h.id === id)) return { type: 'glider', item: c.gliders.find((h) => h.id === id) };
    if (c.emotes.some((h) => h.id === id)) return { type: 'emote', item: c.emotes.find((h) => h.id === id) };
    return null;
  }
  equip(type, id) {
    const key = type === 'hero' ? 'hero' : type === 'pick' ? 'pick' : type === 'glider' ? 'glider' : type === 'emote' ? 'emote' : 'style';
    this.data.equipped[key] = id;
    this.bump('equips');
    this.emit('equip');
  }
}

export const store = new Store();
