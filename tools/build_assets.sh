#!/usr/bin/env bash
# Full asset pipeline: slice the AI sheets (art_ai/) into every game asset.
#   1. shop icons   : picks / gliders / emote icons   (make_shop_icons.py)
#   2. hero icons + 78-frame animation strips         (make_ai_assets.py)
#   3. UI-only pixel icons (coin, settings)           (make_sprites.py)
#   4. audit everything                               (validate_assets.py)
# Needs pillow + numpy + scipy in .venv (created on first run).
set -euo pipefail
cd "$(dirname "$0")/.."

PY=.venv/bin/python
if [ ! -x "$PY" ]; then
  echo "[venv] creating .venv (pillow numpy scipy)"
  python3 -m venv .venv
  "$PY" -m pip install -q --upgrade pip
  "$PY" -m pip install -q pillow numpy scipy
fi

echo "== [1/4] shop icons (picks / gliders / emotes) =="
"$PY" tools/make_shop_icons.py

echo "== [2/4] hero icons + animation strips =="
"$PY" tools/make_ai_assets.py

echo "== [3/4] UI pixel icons (coin / settings) =="
"$PY" tools/make_sprites.py

echo "== [4/4] audit =="
"$PY" tools/validate_assets.py

echo "all assets rebuilt from art_ai sheets."
