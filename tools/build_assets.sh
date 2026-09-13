#!/usr/bin/env bash
# Full asset pipeline (v3): every game sprite is rebuilt from the sheets and
# audited. Needs pillow + numpy + scipy in .venv (created on first run).
#
#   1. build_sprites.py  art2/hero_<id>.png (4 rows x 6 poses, flat magenta)
#                        -> 112px animation strips + portraits + blings + relics
#   2. build_legacy.py   art_ai/grid_*.png / anim_*.png
#                        -> same outputs for heroes without an art2 sheet
#   3. validate_assets.py audits strips, icons, blings and the catalog
set -euo pipefail
cd "$(dirname "$0")/.."

PY=.venv/bin/python
if [ ! -x "$PY" ]; then
  echo "[venv] creating .venv (pillow numpy scipy)"
  python3 -m venv .venv
  "$PY" -m pip install -q --upgrade pip
  "$PY" -m pip install -q pillow numpy scipy
fi

echo "== [1/3] art2 sheets -> strips / portraits / blings / relics =="
if compgen -G "art2/hero_*.png" > /dev/null; then
  "$PY" tools/build_sprites.py all
else
  echo "  (no art2/hero_*.png yet - using the art_ai sheets)"
fi

echo "== [2/3] art_ai sheets -> strips for the remaining heroes =="
"$PY" tools/build_legacy.py

echo "== [3/3] audit =="
"$PY" tools/validate_assets.py

echo "all assets rebuilt."
