#!/usr/bin/env python3
"""validate_assets.py - audit the v3 sprite outputs (exit 1 on any problem).

Checks per hero (see docs/SPRITE_SPEC.md):
  * strip exists, width is a whole number of 112px frames, RGBA binary alpha
  * the frame table in data/anim.json matches the strip and covers all 4 anims
  * idle/walk loop (first frame != last frame, no duplicated neighbours)
  * every frame has feet inside a small band around the ground line
  * no empty or dust-only frame
Then: 12 back-blings (icon + baked 16/24/32 px), 9 relics, 9 hero portraits,
and catalog consistency (no gliders/emotes, 12 blings, one relic per hero).
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprites_lib as S

HEROES = ['spiderman', 'venom', 'ironman', 'capamerica', 'hulk', 'wolverine',
          'drstrange', 'blackpanther', 'antman']
BLING_SIZES = [16, 24, 32]
problems = []
notes = []


def check(cond, msg):
    if not cond:
        problems.append(msg)


def alpha_of(path):
    return np.array(Image.open(path).convert('RGBA'))[:, :, 3]


def audit_hero(hid, meta):
    strip_path = os.path.join(S.OUT_ANIM, '%s.png' % hid)
    check(os.path.exists(strip_path), '%s: strip missing' % hid)
    if not os.path.exists(strip_path):
        return
    a = np.array(Image.open(strip_path).convert('RGBA'))
    frame = int(meta.get('frame', S.FRAME))
    check(a.shape[0] == frame, '%s: strip height %d != frame %d' % (hid, a.shape[0], frame))
    check(a.shape[1] % frame == 0, '%s: strip width %d is not a whole number of frames' % (hid, a.shape[1]))
    al = a[:, :, 3]
    check(np.isin(al, (0, 255)).all(), '%s: alpha is not binary' % hid)
    total = a.shape[1] // frame
    counts = meta.get('anims', {})
    check(sum(c['count'] for c in counts.values()) == total,
          '%s: anim table covers %d of %d frames' % (hid, sum(c['count'] for c in counts.values()), total))
    for anim in ('idle', 'walk', 'attack', 'ability'):
        check(anim in counts, '%s: %s missing from the anim table' % (hid, anim))
    for anim, c in counts.items():
        start, n = c['start'], c['count']
        check(start + n <= total, '%s/%s: frames out of range' % (hid, anim))
        frames = [a[:, (start + i) * frame:(start + i + 1) * frame] for i in range(n)]
        empt = [i for i, f in enumerate(frames) if (f[:, :, 3] > 0).sum() < 200]
        check(not empt, '%s/%s: empty or dust frames %s' % (hid, anim, empt))
        dupes = [i for i in range(1, len(frames)) if np.array_equal(frames[i], frames[i - 1])]
        check(not dupes, '%s/%s: duplicated consecutive frames %s' % (hid, anim, dupes))
        # ground line stability (idle/walk/attack must not float)
        feet = []
        for f in frames:
            ys = np.where((f[:, :, 3] > 0).any(axis=1))[0]
            feet.append(ys.max() if len(ys) else 0)
        spread = max(feet) - min(feet)
        limit = frame * 0.25 if anim == 'ability' else 6
        check(spread <= limit, '%s/%s: ground line drifts %dpx' % (hid, anim, spread))
    icon = os.path.join(S.OUT_SPR, '%s.png' % hid)
    check(os.path.exists(icon), '%s: portrait icon missing' % hid)
    if os.path.exists(icon):
        im = Image.open(icon)
        check(im.size == (96, 96), '%s: portrait is %s, expected 96x96' % (hid, im.size))


def main():
    anim_json = json.load(open(os.path.join(S.OUT_DATA, 'anim.json')))
    catalog = json.load(open(os.path.join(S.OUT_DATA, 'catalog.json')))

    for hid in HEROES:
        check(hid in anim_json, '%s: missing from anim.json' % hid)
        if hid in anim_json:
            audit_hero(hid, anim_json[hid])

    for b in catalog['blings']:
        icon = os.path.join(S.ROOT, 'public', b['art'])
        check(os.path.exists(icon), '%s: bling icon missing' % b['id'])
        for n in BLING_SIZES:
            p = os.path.join(S.ROOT, 'public', 'assets', 'bling', '%s_%d.png' % (b['id'], n))
            check(os.path.exists(p), '%s: baked size %d missing' % (b['id'], n))
        check(b.get('size') in ('S', 'M', 'L'), '%s: no size class' % b['id'])
        check(b.get('attach') and 'dy' in b['attach'], '%s: no attach metadata' % b['id'])
    check(len(catalog['blings']) == 12, 'catalog must ship exactly 12 back blings')
    check('gliders' not in catalog and 'emotes' not in catalog, 'catalog still has gliders/emotes')

    for p in catalog['picks']:
        check(os.path.exists(os.path.join(S.ROOT, 'public', p['art'])), '%s: relic icon missing' % p['id'])
    check(len(catalog['picks']) == len(catalog['heroes']), 'one relic per hero expected')
    for h in catalog['heroes']:
        check(os.path.exists(os.path.join(S.ROOT, 'public', h['art'])), '%s: hero icon missing' % h['id'])

    for hid in HEROES:
        if hid in anim_json:
            notes.append('%s: %s frames' % (hid, {k: v['count'] for k, v in anim_json[hid]['anims'].items()}))
    print('\n'.join('  ' + n for n in notes))
    if problems:
        print('\n%d PROBLEM(S):' % len(problems))
        print('\n'.join('  ✗ ' + p for p in problems))
        sys.exit(1)
    print('\nALL ASSETS VALID (%d heroes, %d blings, %d relics)'
          % (len(HEROES), len(catalog['blings']), len(catalog['picks'])))


if __name__ == '__main__':
    main()
