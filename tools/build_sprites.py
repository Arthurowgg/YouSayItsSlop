#!/usr/bin/env python3
"""build_sprites.py - pipeline v3: art2/ sheets -> crisp in-game sprites.

Usage:
  .venv/bin/python tools/build_sprites.py heroes     # art2/hero_<id>.png -> strips + icons
  .venv/bin/python tools/build_sprites.py blings     # spr/bling_*.png     -> in-game overlay sizes
  .venv/bin/python tools/build_sprites.py picks      # art2/picks.png      -> one relic per hero
  .venv/bin/python tools/build_sprites.py all
  .venv/bin/python tools/build_sprites.py test SHEET OUTDIR   # slice any sheet to OUTDIR

Outputs
  public/assets/anim/<hero>.png     strip, N frames of 96px, RGBA, binary alpha
  public/assets/spr/<hero>.png      96x96 portrait icon (locker / shop / cards)
  public/data/anim.json             per-hero anim metadata (start/count/fps/loop)
  public/assets/bling/<id>_<n>.png  back bling drawn on the hero (n = px, integer bakes)
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprites_lib as S

HEROES = [
    ('spiderman', 'M'), ('venom', 'L'), ('ironman', 'M'), ('capamerica', 'M'),
    ('hulk', 'L'), ('wolverine', 'S'), ('drstrange', 'M'), ('blackpanther', 'M'),
    ('antman', 'S'),
]
# body height target per hero size class (inside the 96px frame)
TARGET_H = {'S': 66, 'M': 80, 'L': 88}
# back-bling bake sizes (integer divisors of the 96px icon source)
BLING_SIZES = [16, 24, 32]
ORDER = ['idle', 'walk', 'attack', 'ability']


def build_hero(hid, size, force=False):
    src = os.path.join(S.ART2, 'hero_%s.png' % hid)
    if not os.path.exists(src):
        print('  [%s] MISSING %s' % (hid, os.path.relpath(src, S.ROOT)))
        return None
    frames, info = S.slice_sheet(src, TARGET_H[size])
    strip = S.strip_of(frames, ORDER)
    meta = S.anim_meta(frames, ORDER)
    S.save_rgba(strip, os.path.join(S.OUT_ANIM, '%s.png' % hid))
    # portrait icon: biggest idle frame, cropped and centred
    icon_src = None
    for anim in ORDER:
        for fr in frames[anim]:
            b = S.bounds(fr)
            if b and (icon_src is None or (b[3] - b[1]) > icon_src[0]):
                icon_src = (b[3] - b[1], fr)
    icon = S.fit_icon(icon_src[1], 96, 5) if icon_src else np.zeros((96, 96, 4), np.uint8)
    S.save_rgba(icon, os.path.join(S.OUT_SPR, '%s.png' % hid))
    print('  [%s] strip %dx%d  frames %s' % (hid, strip.shape[1], strip.shape[0], info['frames']))
    return {'meta': meta, 'frames': info['frames'], 'scale': info['scale']}


def build_blings():
    """Back blings: the shop icon (96px) stays as it is; the in-game overlay
    is baked at fixed integer sizes so it can be drawn 1:1 (never resampled,
    never blurry) and can follow the hero's size class."""
    ids = sorted(f[:-4] for f in os.listdir(S.OUT_SPR) if f.startswith('bling_') and f.endswith('.png'))
    out = {}
    for bid in ids:
        icon = S.load_rgba(os.path.join(S.OUT_SPR, '%s.png' % bid))
        b = S.bounds(icon)
        if not b:
            continue
        x0, y0, x1, y1 = b
        art = icon[y0:y1, x0:x1]
        for n in BLING_SIZES:
            scale = min(n / float(art.shape[1]), n / float(art.shape[0]))
            f = max(1, int(round(1 / scale))) if scale < 1 else 1
            small = S.downscale_block(art, f)
            # if the integer step overshot, do one more exact nearest fit
            if small.shape[1] > n or small.shape[0] > n:
                im = Image.fromarray(small, 'RGBA')
                small = np.array(im.resize(
                    (max(1, min(n, int(round(small.shape[1] * n / max(small.shape[1], 1))))),
                     max(1, min(n, int(round(small.shape[0] * n / max(small.shape[0], 1)))))),
                    Image.NEAREST))
            S.save_rgba(small, os.path.join(S.ROOT, 'public', 'assets', 'bling', '%s_%d.png' % (bid, n)))
        out[bid] = {str(n): os.path.join('assets', 'bling', '%s_%d.png' % (bid, n)) for n in BLING_SIZES}
    print('  blings baked: %d x %s' % (len(out), BLING_SIZES))
    return out


def build_picks():
    """One relic (pickaxe) per hero, sliced from art2/picks.png."""
    src = os.path.join(S.ART2, 'picks.png')
    if not os.path.exists(src):
        print('  picks.png missing - keeping existing icons')
        return {}
    img = Image.open(src).convert('RGB')
    rgb = np.array(img)
    mask, bg = S.foreground(rgb)
    lab, keep = S.label_blobs(mask)
    blobs = S.blob_info(lab, keep)
    bands = S.group_rows(blobs, 1) if blobs else []
    out = {}
    if not bands:
        return out
    groups = S.group_cols(bands[0])
    print('  picks sheet: %d items' % len(groups))
    order = [h for h, _ in HEROES]
    for i, grp in enumerate(groups):
        x0 = min(b['x0'] for b in grp)
        x1 = max(b['x1'] for b in grp)
        y0 = max(0, min(b['y0'] for b in grp) - 2)
        y1 = min(rgb.shape[0], max(b['y1'] for b in grp) + 2)
        size = max(x1 - x0, y1 - y0)
        f = max(1, int(round(size / 88.0)))
        cut = S.cut_rgba(rgb, mask, bg, (x0, y0, x1, y1), f)
        icon = S.fit_icon(cut, 96, 4)
        hid = order[i] if i < len(order) else 'extra%d' % i
        out[hid] = 'assets/spr/pick_%s.png' % hid
        S.save_rgba(icon, os.path.join(S.OUT_SPR, 'pick_%s.png' % hid))
    return out


def build_all():
    print('== heroes ==')
    heroes = {}
    for hid, size in HEROES:
        r = build_hero(hid, size)
        if r:
            heroes[hid] = r
    print('== blings ==')
    blings = build_blings()
    print('== picks ==')
    picks = build_picks()
    print('== anim.json ==')
    path = os.path.join(S.OUT_DATA, 'anim.json')
    old = {}
    if os.path.exists(path):
        with open(path) as fh:
            old = json.load(fh)
    data = dict(old)
    for hid, info in heroes.items():
        data[hid] = {'frames': info['frames'], 'anims': info['meta'],
                     'frame': S.FRAME, 'scale': info['scale'], 'source': 'art2'}
    with open(path, 'w') as fh:
        json.dump(data, fh, indent=1, sort_keys=True)
    print('  wrote %s (%d heroes)' % (os.path.relpath(path, S.ROOT), len(data)))


def test_slice(sheet, outdir):
    frames, info = S.slice_sheet(sheet, 84)
    os.makedirs(outdir, exist_ok=True)
    for anim in ORDER:
        fr = frames[anim]
        if not fr:
            continue
        strip = np.concatenate(fr, axis=1)
        S.save_rgba(strip, os.path.join(outdir, '%s.png' % anim))
        print('  %-8s %d frames -> %s' % (anim, len(fr), os.path.join(outdir, '%s.png' % anim)))
    # debug contact sheet, 3x
    rows = [np.concatenate(frames[a], axis=1) for a in ORDER if frames[a]]
    if rows:
        w = max(r.shape[1] for r in rows)
        canvas = np.zeros((sum(r.shape[0] for r in rows), w, 4), np.uint8)
        y = 0
        for r in rows:
            canvas[y:y + r.shape[0], :r.shape[1]] = r
            y += r.shape[0]
        big = np.array(Image.fromarray(canvas, 'RGBA').resize(
            (canvas.shape[1] * 3, canvas.shape[0] * 3), Image.NEAREST))
        S.save_rgba(big, os.path.join(outdir, '_contact.png'))
        print('  contact sheet -> %s/_contact.png' % outdir)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if cmd == 'heroes':
        ids = sys.argv[2:] or [h for h, _ in HEROES]
        for hid in ids:
            size = dict(HEROES).get(hid, 'M')
            build_hero(hid, size)
    elif cmd == 'blings':
        build_blings()
    elif cmd == 'picks':
        build_picks()
    elif cmd == 'test':
        test_slice(sys.argv[2], sys.argv[3])
    else:
        build_all()
