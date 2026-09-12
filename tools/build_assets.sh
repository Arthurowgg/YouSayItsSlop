#!/usr/bin/env bash
# Slices magenta-background sprite sheets into transparent chunky PNG sprites.
# Cell maps were derived by visual inspection of each generated sheet.
set -euo pipefail
cd "$(dirname "$0")/.."
RAW=art_raw
OUT=public/assets/spr
mkdir -p "$OUT"

# cell <sheet> <cols> <rows> <col> <row> <name>
cell() {
  local f="$RAW/$1" cols=$2 rows=$3 c=$4 r=$5 name=$6
  [ -f "$f" ] || { echo "  (skip missing $f)"; return 0; }
  local w h cw ch x y
  read -r w h < <(identify -format "%w %h\n" "$f")
  cw=$((w / cols)); ch=$((h / rows)); x=$((c * cw)); y=$((r * ch))
  convert "$f" -crop "${cw}x${ch}+${x}+${y}" +repage \
    -fuzz 24% -transparent "rgb(255,0,255)" \
    -trim +repage -filter point -resize 120x120 \
    -gravity center -background none -extent 128x128 "$OUT/$name.png"
  echo "  -> $name.png"
}

# Hero/emote icons are NO LONGER sliced from RAW sheets here:
# fuzz-magenta keying left semi-transparent halos. All isolated icons are
# now baked deterministically by tools/make_heroes.py (96px, true alpha).

echo "[bg] skyline"
if [ -f "$RAW/skyline.png" ]; then
  convert "$RAW/skyline.png" -filter point -resize 384x216 public/assets/skyline.png
  echo "  -> skyline.png"
fi
echo "done."
