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
npm run smoke      # headless runtime test: bundles the ES modules, clicks through every tab (21 assertions)
npm run assets     # re-slice generated sprite sheets into public/assets/spr/
```

No runtime dependencies — the server is Node's built-in `http` module. The client also
falls back to `localStorage` when the API is unreachable.

## Tabs

| Tab | What it does |
| --- | --- |
| **▶ PLAY** | Lobby pedestal with your hero (idle bob, emotes with floating notes), game-mode cards (Solo / Duos / Squads / Team Rumble / Save the World / Creative), map select, and **LAUNCH** — a simulated match (countdown → match log → results) that pays out coins + XP and feeds tasks/stats. |
| **◆ SHOP** | Featured heroes + daily gear/gliders/emotes with rarity frames (common→MARVEL), shine sweeps on legendaries, buy flow with deny-shake when broke, confetti + 8-bit fanfare on purchase. Daily stock timer (ignored in test mode). |
| **▣ LOCKER** | Pick your hero, harvesting tool, back bling and emote; **STYLES** recolor any hero with pixel-friendly CSS filters (Crimson/Gold/Void/Noir/Frost). Locked items point you to the shop. |
| **✔ TASKS** | Daily + weekly tasks with progress bars (play, win, buy, loadout, emote). Claiming pays coins + XP. In test mode claimed tasks re-arm instantly — no cooldown. |
| **⚙ DEV** | Test-only currency lab: base **500** coins, +100/+500/+5000, SET BASE 500, ×2, NO-COOLDOWN and UNLOCK-ALL flags, task re-arm, save wipe, raw save viewer. |

Extras: level/XP bar in the HUD with level-up fanfare, chunky bevel pixel buttons,
animated neon-skyline background with floating pixel motes + scanlines, WebAudio square-wave
SFX (mutable), keyboard tabs `1–5`, staggered card entrances, toasts.

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
  js/main.js         boot, tab router, HUD
  js/store.js        save-state store (server-backed, localStorage fallback), economy, tasks, inventory
  js/screens.js      renderers for PLAY / SHOP / LOCKER / TASKS / DEV + item modal
  js/match.js        simulated match (deploy -> results -> rewards)
  js/fx.js           particle canvas + WebAudio 8-bit sfx + confetti
  js/util.js         DOM/helpers + procedural coin fallback
  assets/spr/*.png   128px chunky sprites (image-rendering: pixelated everywhere)
tools/
  build_assets.sh    slices magenta-bg AI sheets into transparent sprites (ImageMagick)
  make_sprites.py    deterministic hand-painted 16x16 sprites (coin, tools, gliders, emotes, mode tiles)
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
