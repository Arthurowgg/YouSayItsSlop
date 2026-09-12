# MARVEL PIXEL ROYALE — menu prototype

A Fortnite-inspired 2D game **menu/lobby** for a pixelated Marvel battle-royale concept.
Built as a working prototype: every tab, currency flow and progression hook is functional
so it can grow into the real game later.

> ⚠️ **Trademark notice (read this):** this is a private fan/test prototype made on the
> owner's request. Marvel characters are trademarks of Marvel/Disney; Fortnite is a
> trademark of Epic Games. Using them in a public release requires licenses. Keep this
> repo private until then.

## Run it from GitHub (no server needed)

The client is static-first: when `/api` is absent it falls back to `localStorage` and the
static catalog, so the repo itself can host the game.

- **CDN mirror (works today):**
  `https://cdn.jsdelivr.net/gh/Arthurowgg/YouSayItsSlop@arena/01a09264-yousayitsslop/public/index.html`
  (jsdelivr serves the files straight from this branch; pin `@<commit>` for immutable links.)
- **GitHub Pages:** `.github/workflows/deploy-pages.yml` deploys `public/` on push.
  Enabling Pages requires one owner click (Settings → Pages → Source: *GitHub Actions*)
  because the automation token has no Pages-admin scope; once enabled, every push deploys
  to `https://arthurowgg.github.io/YouSayItsSlop/` automatically.

## Run it locally

```bash
npm start          # serves http://0.0.0.0:8080 (static menu + JSON API)
npm run smoke      # headless runtime test: bundles the ES modules, clicks through every tab (21 assertions)
npm run assets     # re-slice generated sprite sheets into public/assets/spr/
```

No runtime dependencies — the server is Node's built-in `http` module. The client also
falls back to `localStorage` when the API is unreachable.

## Tabs

| Tab | What it does |
| --- | --- |
| **PLAY** | True lobby: your hero shown **in-game** (24x24 animated sprite: IDLE / WALK / ATTACK / POWER / EMOTE previews) standing over the next map. Left panel: 5 original modes (Hero Rush, Squad Siege, Symbiote Siege, Infinity Hunt, Kree Arena), NEXT MAP card with reroll (map is random at match start), big skewed yellow PLAY. |
| **SHOP** | Spotlight layout: animated hero preview + buy/equip on the left with a hero rail; featured heroes and relics/back-bling/emotes grids on the right. Rarity frames, shine sweeps, deny-shake, confetti. |
| **LOCKER** | Animated preview + styles (CSS filter recolors); select hero, relic, back bling, emote. Locked items point to the shop. |
| **TASKS** | Stored **LEVEL + XP bar** up top, daily/weekly tasks with progress bars and claimable coin rewards (no cooldown in test mode). |
| **DEV** | Test-only currency lab: base **500** coins, +100/+500/+5000, SET BASE 500, x2, NO-COOLDOWN / UNLOCK-ALL flags, task re-arm, save wipe, raw save viewer. |

Top bar: names-only tabs that never scroll, coins pill, **settings** gear (sound / particles /
scanlines). Light pixel UI font (VT323), Press Start 2P only for accents. Performance:
no full re-render on state change, ~30fps particle canvas, static backgrounds, no blend modes.

## Architecture (ready for the real game)

```
server.js            zero-dep static + API server (binds 0.0.0.0, PORT env)
  GET  /api/catalog  -> data/catalog.json (heroes, gear, modes, maps, styles, tasks, rarities)
  GET  /api/state    -> save (404 when fresh)
  POST /api/state    -> sanitized save (coins/level/owned/equipped/stats/tasks/dev)
  DELETE /api/state  -> wipe
data/catalog.json    all game data — add items here, UI renders them automatically
data/save.json       your save (git-ignored)
public/
  index.html         shell (topbar, tabs, HUD, screen mount)
  style.css          pixel design system + all animations
  js/main.js         boot, name-only tab router, HUD, settings modal
  js/store.js        save-state store (server-backed, localStorage fallback), economy, tasks, inventory
  js/screens.js      renderers: lobby / shop spotlight / locker / tasks(level) / dev
  js/anim.js         24x24 sprite-strip animator (idle/walk/attack/power)
  js/match.js        simulated match: RANDOM map at start -> results -> rewards
  js/fx.js           lightweight particle canvas + WebAudio 8-bit sfx + confetti
  js/util.js         DOM/helpers + procedural coin fallback
  assets/spr/*.png   item/mode/coin icons (kept, hand-painted 16x16)
  assets/anim/*.png  in-game hero animation strips (12 frames of 24x24)
  assets/maps/*.png  five 192x108 side-view 2D battle maps
tools/
  build_assets.sh    slices magenta-bg AI sheets into transparent bust sprites
  make_sprites.py    deterministic hand-painted 16x16 item icons
  make_heroes.py     parametric hero animation strips (edit configs to restyle)
  make_maps.py       paints the five 2D maps + survival mode icon
  smoke_test.js      jsdom end-to-end click-through (npm run smoke)
```

Save format (`data/save.json`): `{ coins, level, xp, owned[], picks[], gliders[], emotes[],
equipped{hero,style,pick,glider,emote}, stats{matches,wins,purchases,equips,emotes},
tasks{}, dev{noCooldown,unlockAll} }` — a real backend can swap in behind the same API.

## Art pipeline

Hero portraits were generated as 16-bit-style sprite sheets on magenta backgrounds and
sliced/chroma-keyed by `tools/build_assets.sh` (cell maps are in the script). Item icons,
mode tiles and the coin are painted pixel-by-pixel by `tools/make_sprites.py` — edit the
paint functions to restyle them. `art_raw/` (source sheets) is git-ignored.
