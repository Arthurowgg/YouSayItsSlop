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

echo "[slice] marvel sheet A (2x2)"
cell test_sheet.png 2 2 0 0 ironman
cell test_sheet.png 2 2 1 0 capamerica
cell test_sheet.png 2 2 0 1 wolverine
cell test_sheet.png 2 2 1 1 hulk

echo "[slice] spider-verse sheet (4x2)"
cell sheet_spider.png 4 2 0 0 spiderman
cell sheet_spider.png 4 2 1 0 miles
cell sheet_spider.png 4 2 0 1 venom
cell sheet_spider.png 4 2 1 1 gwen

echo "[slice] mystic sheet (4x2)"
cell sheet_mystic.png 4 2 0 0 thor
cell sheet_mystic.png 4 2 1 0 blackwidow
cell sheet_mystic.png 4 2 0 1 drstrange
cell sheet_mystic.png 4 2 1 1 scarletwitch
cell sheet_mystic.png 4 2 3 0 captainmarvel_classic
cell sheet_mystic.png 4 2 2 1 scarletwitch_azure

echo "[slice] tech sheet (4x2)"
cell sheet_tech.png 4 2 0 0 blackpanther
cell sheet_tech.png 4 2 1 0 hawkeye
cell sheet_tech.png 4 2 3 0 antman
cell sheet_tech.png 4 2 0 1 captainmarvel
cell sheet_tech.png 4 2 1 1 antman_unmasked

echo "[slice] originals sheet (4x2)"
cell sheet_originals.png 4 2 0 0 jonesy
cell sheet_originals.png 4 2 1 0 ramirez
cell sheet_originals.png 4 2 3 0 nightshade
cell sheet_originals.png 4 2 0 1 skullface
cell sheet_originals.png 4 2 1 1 raven
cell sheet_originals.png 4 2 2 1 ramirez_casual

echo "[solo] spidey alt + coin"
if [ -f "$RAW/test_spidey.png" ]; then
  convert "$RAW/test_spidey.png" -fuzz 24% -transparent "rgb(255,0,255)" \
    -trim +repage -filter point -resize 120x120 \
    -gravity center -background none -extent 128x128 "$OUT/spiderman_classic.png"
  echo "  -> spiderman_classic.png"
fi
if [ -f "$RAW/coin.png" ]; then
  convert "$RAW/coin.png" -fuzz 24% -transparent "rgb(255,0,255)" \
    -trim +repage -filter point -resize 120x120 \
    -gravity center -background none -extent 128x128 "$OUT/coin.png"
  echo "  -> coin.png"
fi

echo "[bg] skyline"
if [ -f "$RAW/skyline.png" ]; then
  convert "$RAW/skyline.png" -filter point -resize 384x216 public/assets/skyline.png
  echo "  -> skyline.png"
fi
echo "done."
