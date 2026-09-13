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
npm run assets     # rebuild ALL assets from the art_ai sheets + audit
```

No runtime dependencies — the server is Node's built-in `http` module. The client also
falls back to `localStorage` when the API is unreachable.

## Tabs

| Tab | What it does |
| --- | --- |
| **PLAY** | Cinematic mode-select (PLAY v2): layered night-city scene (sky gradient, twinkling stars, drifting pixel skyline, fog banks, rising embers, mode-tinted glow) with a floating mode emblem as focal point; mode-card stack with exactly two modes — **1V1** (available, selected emphasis, pixel preview + description + meta) and **DOMINATION** (selectable for preview but `EM BREVE`, PLAY stays disabled); NEXT-MAP chip with reroll for 1v1; huge skewed yellow PLAY with hover/pressed/disabled states. |
| **SHOP** | Pixel storefront: night-city backdrop (skyline, stars, rarity glows), featured bundle/hero strip, type-specific cards (animated hero cells, emote ring stages, gear pedestals), dedicated bundle cards with per-item icons, and a showcase page per item (rarity aura, platform, ground shadow, animations). |
| **LOCKER** | Animated preview + styles (CSS filter recolors); select hero, relic, back bling, emote. Locked items point to the shop. |
| **TASKS** | Stored **LEVEL + XP bar** up top, daily/weekly tasks with progress bars and claimable coin rewards (no cooldown in test mode). |
| **DEV** | Test-only currency lab: base **500** coins, +100/+500/+5000, SET BASE 500, x2, NO-COOLDOWN / UNLOCK-ALL flags, task re-arm, save wipe, raw save viewer. |

Top bar: names-only tabs that never scroll, coins pill, **settings** gear (sound / particles /
scanlines). Light pixel UI font (VT323), Press Start 2P only for accents. Performance:
no full re-render on state change, ~30fps particle canvas, static backgrounds, no blend modes.

## Architecture (ready for the real game)

> **All character art** (hero icons, 78-frame animation strips, pick / glider /
> emote icons) is sliced from the committed AI sheets in `art_ai/` — see
> *Art pipeline* below. Only UI chrome (coin, settings glyphs, maps, mode
> tiles) is painted by code.

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
  js/screens.js      renderers: play mode-select / shop spotlight / locker / tasks(level) / dev
  js/anim.js         48px sprite-strip animator, 100% frame-based (no runtime
                     transforms): idle/walk/attack/power + data-driven emotes
  js/match.js        simulated match: RANDOM map at start -> results -> rewards
  js/fx.js           lightweight particle canvas + WebAudio 8-bit sfx + confetti
  js/util.js         DOM/helpers + procedural coin fallback
  assets/spr/*.png   96x96 cosmetic icons: heroes/emotes/picks/gliders sliced
                     from the AI sheets; coin + settings glyphs hand-painted
  assets/anim/*.png  in-game hero strips: 78 frames of 48px (idle/walk/
                     attack/power + 10 emote loops), sliced from AI sheets
  assets/maps/*.png  five 480x268 side-view 2D battle maps
tools/
  build_assets.sh    ONE-STOP pipeline: venv bootstrap -> shop icons ->
                     hero icons + strips -> UI icons -> audit
  make_shop_icons.py slices emote/pick/glider sheets into clean transparent
                     96x96 icons (bg flood-key, nearest-neighbor downscale)
  make_ai_assets.py  slices grid_/anim_ hero sheets: edge-extract -> seam &
                     shadow removal -> cell sprites -> integer downscale ->
                     grounded 48px frames + choreographed emote dance loops
  make_sprites.py    hand-painted UI icons only (coin, settings glyphs)
  validate_assets.py audits every cosmetic icon + strip (transparency, crops,
                     ground-line stability per anim segment, emote metadata);
                     exits 1 on problems
  make_maps.py       paints the five 2D maps
  make_mode_icons.py paints the 1v1 / domination mode tiles
  smoke_test.js      jsdom end-to-end click-through (npm run smoke)
```

Save format (`data/save.json`): `{ coins, level, xp, owned[], picks[], gliders[], emotes[],
equipped{hero,style,pick,glider,emote}, stats{matches,wins,purchases,equips,emotes},
tasks{}, dev{noCooldown,unlockAll} }` — a real backend can swap in behind the same API.

## Art pipeline

Every character asset in the game comes from the AI-generated sprite sheets
committed in `art_ai/` (16-bit chibi style, one sheet set per hero):

| sheet | content | becomes |
| --- | --- | --- |
| `grid_<hero>.png` | 4 rows: idle / walk / attack / power poses | strip frames 0-17 + hero icon |
| `anim_<hero>.png` | 4 key poses (stand, stride, jump-flex, variant) | emote dance poses + strips for heroes without a grid sheet |
| `emotes_a/b.png` | 10 themed emote poses | `spr/emote_*.png` shop icons |
| `picks*_sheet.png` | pickaxe sets | `spr/pick_*.png` |
| `gliders*_sheet.png` | glider sets | `spr/glider_*.png` |

`tools/build_assets.sh` runs the whole chain (creates `.venv` with
pillow/numpy/scipy on first run):

1. `make_shop_icons.py` — flood-keys the flat navy backdrops / plates and
   slices picks, gliders and emote icons at integer downscale ratios;
2. `make_ai_assets.py` — extracts the line art (gradient -> close -> fill),
   strips grid seams, ground shadows and detached-fx fragments, slices every
   pose on the sheet grid, downscales with NEAREST at one ratio per sheet,
   grounds all core frames on a shared feet line and choreographs the 10
   emote loops per hero from their own poses (integer bob / hop / mirror /
   sway — zero repainting, zero runtime transforms);
3. `make_sprites.py` — the few hand-painted UI glyphs (coin, settings);
4. `validate_assets.py` — fails the build on halos, crops, fragment counts,
   wrong frame counts or ground-line flicker.

Heroes without a grid sheet (style variants, Hawkeye, Strange, Wanda,
Panther, Captain Marvel, Ant-Man) get their cycles synthesised from their
4-key-pose `anim_` sheet, so all 20 heroes ship AI art end to end.
