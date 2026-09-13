# MARVEL PIXEL ROYALE — menu prototype

A Fortnite-inspired 2D game **menu/lobby** for a pixelated Marvel battle-royale concept.
Built as a working prototype: every tab, currency flow and progression hook is functional
so it can grow into the real game later.

> ⚠️ **Trademark notice (read this):** this is a private fan/test prototype made on the
> owner's request. Marvel characters are trademarks of Marvel/Disney; Fortnite is a
> trademark of Epic Games. Using them in a public release requires licenses. Keep this
> repo private until then.

## Run it

```bash
npm start          # serves http://0.0.0.0:8080 (static menu + JSON API)
npm run smoke      # headless runtime test: bundles the ES modules, clicks every tab
npm run assets     # rebuild ALL assets from the sheets in art2/ + art_ai/ and audit
```

The client is static-first: when `/api` is absent it falls back to `localStorage` and the
static catalog, so the repo itself can host the game.

## Tabs

| Tab | What it does |
| --- | --- |
| **JOGAR** | Cinematic mode-select (night-city scene, embers, floating emblem) with 1V1 (available) and DOMINATION (preview only, `EM BREVE`), plus a NEXT-MAP chip with reroll. |
| **LOJA** | One section per category, **each with its own colour**, item cards that animate in every time the category comes into view, the bundle sitting **next to** the featured hero and the other items underneath. No separator lines, no category numbers, no item counters, no type/rarity text — and no forced packs: every item is bought separately. |
| **ARMÁRIO** | Animated stage + racks (HERÓI / BACK BLING / RELÍQUIAS) that list **icons** — the character only appears on the stage. Slots, search, rarity dots, "sem back bling" option. |
| **TAREFAS** | Stored LEVEL + XP bar, daily/weekly tasks with progress bars and claimable coins (no cooldown in test mode). |
| **DEV** | Currency lab: base 500 coins, +100/+500/+5000, x2, flags, task re-arm, save wipe, raw save viewer. |

## Architecture

```
server.js            zero-dep static + API server (binds 0.0.0.0, PORT env)
  GET  /api/catalog  -> public/data/catalog.json (heroes, blings, picks, modes, maps, tasks)
  GET  /data/*       -> read-only JSON built by the tools (anim.json)
  GET  /api/state    -> save (404 when fresh)   POST/DELETE manage it
public/data/catalog.json  all game data — add items here, the UI renders them
public/data/anim.json     per-hero animation tables (frame size, counts, fps, loops)
data/save.json            your save (git-ignored)
public/
  index.html         shell (topbar, tabs, HUD, screen mount)
  style.css          pixel design system + shop/locker animations
  js/main.js         boot, name-only tab router, HUD, settings modal
  js/screens.js      renderers: play / shop (by category) / locker / tasks / dev
  js/anim.js         Animator v7: data-driven 112px strips, integer scaling,
                     pre-baked back blings, one rAF ticker, no resampling
  js/store.js        save-state store (server-backed, localStorage fallback)
  js/match.js        simulated match: random map -> results -> rewards
  js/fx.js           particle canvas + WebAudio sfx + confetti
  js/util.js         DOM/helpers + procedural coin fallback
  assets/spr/*.png   96x96 icons: heroes / back blings / relics / modes / UI
  assets/anim/*.png  in-game strips: N frames of 112px (idle/walk/attack/ability)
  assets/bling/*.png back blings pre-baked at 16/24/32px (drawn 1:1 in game)
  assets/maps/*.png  five 480x268 side-view 2D battle maps
tools/
  build_assets.sh    ONE-STOP pipeline: art2 sheets -> art_ai sheets -> audit
  sprites_lib.py     extraction library (silhouette, blob frames, majority downscale)
  build_sprites.py   art2/hero_<id>.png (4 rows x 6 poses, flat magenta) -> strips
  build_legacy.py    art_ai/grid_*.png + anim_*.png -> strips for the rest
  validate_assets.py audits strips, icons, blings and the catalog (exit 1 on problems)
  smoke_test.js      jsdom end-to-end click-through (npm run smoke)
```

Save format (`data/save.json`): `{ coins, level, xp, owned[], picks[], blings[],
equipped{hero,style,pick,bling}, stats{}, tasks{}, dev{} }` — a real backend can swap in
behind the same API. Old saves that still carry gliders/emotes are cleaned on load.

## Systems removed / renamed in this build

* **gliders** (and emotes) are gone from the whole game — catalog, store, UI and assets;
* **skins** are no longer a category: a hero's alternate looks live inside its own card
  (both in the shop and in the locker);
* the shop lost the separator lines, the item counters and the group labels;
* relics (pickaxes) are now **one per hero**, nine in total;
* back blings are **exactly 12**, each with a size class (S/M/L) and per-hero attach
  offsets so they fit small and huge heroes alike (Hulk's gear is scaled up, Ant-Man's
  down) — and every bling is pre-baked at 16/24/32px, so it is never stretched.

## Art pipeline (v3)

One generated image per hero = one single style for all of its frames (the old pipeline
mixed poses from different sheets, which is why some frames did not fit their hero).

| input | becomes |
| --- | --- |
| `art2/hero_<id>.png` (4 rows x 6 poses, flat magenta #FF00FF) | `assets/anim/<id>.png` + portrait + `data/anim.json` entry |
| `art_ai/grid_*.png`, `art_ai/anim_*.png` | same outputs for heroes without an `art2` sheet |
| `assets/spr/bling_*.png` | `assets/bling/<id>_{16,24,32}.png` (integer bakes) |
| `art2/picks.png` | one relic icon per hero |

`tools/build_assets.sh` runs the whole chain (creates `.venv` with
pillow/numpy/scipy on first run) and ends with `validate_assets.py`.

Extraction is done by **connected blobs + projection bands**, never by fixed cell
division, so a pose that overflows its imaginary cell is not chopped in half (the
"cropped hulk" bug), dark heroes survive a dark backdrop (silhouette pass: closing +
hole fill, so a black symbiote on a navy sheet is recovered), sheet separator rules and
dust fragments are erased, and every sprite is downscaled by one integer factor with
majority voting — 1px outlines survive and nothing gets blurred. The game then draws the
strips 1:1 on integer-scaled canvases, which is why they stay crisp on screen.
