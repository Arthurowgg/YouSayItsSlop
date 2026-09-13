#!/usr/bin/env python3
"""build_legacy.py - rebuild the 9 hero strips from the committed art_ai/
sheets with the v3 pipeline (crisp, no crop bugs).

The legacy sheets hold one 4x4 (or x7) sheet per hero with the pose blocks:
  row 0 = idle block | row 1 = walk block | row 2 = attack block | row 3 = power
and, to the right of every block, smaller duplicate poses from other rows -
the old pipeline mixed them together (that is why some frames "did not fit"
the hero and jumped in size). Here each row is split into its pose segments
(huge + small), the small duplicates are dropped, and the remaining poses are
cut with one integer downscale, one ground line, no cropping.

  .venv/bin/python tools/build_legacy.py            # all 9 heroes
  .venv/bin/python tools/build_legacy.py spiderman  # one hero
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprites_lib as S

HEROES = ['spiderman', 'venom', 'hulk', 'ironman', 'capamerica', 'wolverine',
          'antman', 'blackpanther', 'drstrange']
# hero id -> (sheet file, per-row pose count)
GRID = {h: ('art_ai/grid_%s.png' % h, 7) for h in
        ['spiderman', 'venom', 'hulk', 'ironman', 'capamerica', 'wolverine']}
ANIM = {h: ('art_ai/anim_%s.png' % h, 4) for h in ['antman', 'blackpanther', 'drstrange']}
ORDER = ['idle', 'walk', 'attack', 'ability']
TARGET = {'S': 78, 'M': 90, 'L': 100}   # body height per size class
TARGET_DEF = 90


def segments(mask_row):
    """x-projection runs of the row mask -> [(x0,x1)] pose segments."""
    prof = mask_row.any(axis=0)
    xs = np.where(prof)[0]
    if len(xs) == 0:
        return []
    runs, start, prev = [], xs[0], xs[0]
    for x in xs[1:]:
        if x - prev > 6:                  # gap = pose boundary
            runs.append((start, prev + 1))
            start = x
        prev = x
    runs.append((start, prev + 1))
    # attach narrow fragments (sparks, shields) to the neighbouring pose
    merged = []
    for r in runs:
        if merged and (r[0] - merged[-1][1]) <= 10 and (r[1] - r[0]) < (merged[-1][1] - merged[-1][0]) * 0.5:
            merged[-1] = (merged[-1][0], r[1])
        else:
            merged.append(r)
    return merged


def strip_rules(mask, log=print):
    """Erase the sheet's panel-separator rules: 1-2px columns that run almost
    the full height of the pose band AND repeat at the same x in at least two
    bands (a leg is thin too, but never repeats across bands)."""
    h, w = mask.shape
    colhit = np.zeros(w, int)
    for (y0, y1) in S.bands_by_projection(mask, 4):
        band = mask[y0:y1]
        bh = max(1, band.shape[0])
        ys = [np.where(band[:, x])[0] for x in range(w)]
        rule = np.zeros(w, bool)
        for x in range(w):
            yy = ys[x]
            if len(yy) < 0.45 * bh:
                continue
            runs = np.split(yy, np.where(np.diff(yy) > 1)[0] + 1)
            longest = max(len(r) for r in runs)
            if longest >= 0.9 * len(yy):
                rule[x] = True
        # only counts as chrome when it is a 1-2px wide line
        runs = np.split(np.where(rule)[0], np.where(np.diff(np.where(rule)[0]) > 1)[0] + 1)
        for r in runs:
            if len(r) and len(r) <= 2:
                colhit[r] += 1
    cols = np.where(colhit >= 2)[0]
    if len(cols):
        mask = mask.copy()
        mask[:, cols] = False
        log('    removed %d separator columns' % len(cols))
    return mask


def trim_edges(band, x0, x1):
    """Shrink a pose segment while its outer columns are sheet chrome (a
    separator rule is a near full-height 1-2px column that got glued to the
    pose because the gap was tiny)."""
    seg = band[:, x0:x1]
    h = seg.shape[0]
    if seg.size == 0:
        return x0, x1

    def is_rule(x):
        col = seg[:, x]
        ys = np.where(col)[0]
        if len(ys) == 0:
            return True
        runs = np.split(ys, np.where(np.diff(ys) > 1)[0] + 1)
        longest = max(len(r) for r in runs)
        return len(ys) >= 0.45 * h and longest >= 0.9 * len(ys)

    l, r = x0, x1
    while r - l > 4 and is_rule(r - 1 - x0):
        r -= 1
    while r - l > 4 and is_rule(l - x0):
        l += 1
    return l, r


def pick_poses(runs, want, log):
    """Keep the `want` poses that belong to this row: the duplicates drawn
    smaller are dropped by height, never by position."""
    if not runs:
        return []
    heights = [r[3] - r[2] for r in runs]
    hmax = max(heights)
    big = [r for r, h in zip(runs, heights) if h >= hmax * 0.72]
    if len(big) > want:
        # more than `want` large poses: keep the tallest ones in x order
        order = sorted(range(len(runs)), key=lambda i: -heights[i])[:want]
        big = [runs[i] for i in sorted(order)]
        log('    ! %d large poses, kept %d' % (len(runs), want))
    return big


def slice_legacy(path, poses_per_row=4, target=TARGET_DEF, log=print):
    img = Image.open(path).convert('RGB')
    rgb = np.array(img)
    h, w = rgb.shape[:2]
    mask, bg = S.silhouette(rgb, tol=30)
    # bands are found on the RAW key mask (the filled silhouette has no
    # valleys between pose rows)
    base = np.median(bg, axis=0) if np.ndim(bg) > 1 else bg
    raw = np.abs(rgb.astype(np.int32) - np.atleast_2d(bg)[:, None, :]).max(axis=2) > 30 \
        if np.ndim(bg) > 1 else np.abs(rgb.astype(np.int32) - base[None, None, :]).max(axis=2) > 30
    ybands = S.bands_by_projection(raw, 4)
    mask = strip_rules(mask, log=log)
    base = np.median(bg, axis=0) if bg.ndim > 1 else bg
    log('  %-18s %dx%d  backdrop %s  bands %s' %
        (os.path.basename(path), w, h, tuple(int(c) for c in base),
         [(int(a), int(b)) for a, b in ybands]))
    all_runs = []
    for (ry0, ry1) in (ybands + [(0, 0)] * 4)[:4]:
        band = mask[ry0:ry1]
        runs = [(x0, x1, ry0 + y0, ry0 + y1) for (x0, x1, y0, y1) in S.x_segments(band)]
        all_runs.append(runs)
    heights = [r[3] - r[2] for runs in all_runs for r in runs]
    body_h = S.median(sorted(heights)[len(heights) * 3 // 4:]) or target
    f = max(1, int(round(body_h / float(target))))
    while f > 1 and body_h / f < target * 0.62:
        f -= 1
    log('    body %dpx -> integer downscale 1/%d' % (body_h, f))

    out = {}
    for r, anim in enumerate(ORDER):
        runs = all_runs[r] if r < len(all_runs) else []
        if r < len(ybands):
            band = mask[ybands[r][0]:ybands[r][1]]
            runs = [trim_edges(band, x0, x1) + (y0, y1) for (x0, x1, y0, y1) in runs]
        if runs:
            hmax = max(x[3] - x[2] for x in runs)
            big = [x for x in runs if (x[3] - x[2]) >= hmax * 0.88]
            if len(big) > poses_per_row:
                big = big[:poses_per_row]
        else:
            big = []
        cuts, feets, cxs = [], [], []
        for (x0, x1, y0, y1) in big:
            box = (max(0, x0 - 2), max(0, y0 - 2), min(w, x1 + 2), min(h, y1 + 2))
            rgba, feet, cx = S.cut_metrics(rgb, mask, bg, box, f)
            if not (rgba[:, :, 3] > 0).any():
                continue
            b2 = S.bounds(rgba)
            feet = b2[3]
            m = S.body_metrics(rgba)
            cx = m['cx'] if m else (b2[0] + b2[2]) / 2
            cuts.append(rgba); feets.append(feet); cxs.append(cx)
        out[anim] = (cuts, feets, cxs)
        log('    %-8s %d poses' % (anim, len(cuts)))

    # a single-band sheet (energy_/anim_ style, 4 key poses) has no walk or
    # attack row: derive them from the hero's own poses with integer-only
    # motion (never a runtime transform) so every hero ships all 4 states.
    base = out['idle']
    if base[0]:
        order = {'walk': [1, 2, 3, 0], 'attack': [0, 1, 2, 3], 'ability': [3, 2, 1, 0]}
        for anim, idx in order.items():
            if out[anim][0]:
                continue
            cuts, feets, cxs = [], [], []
            for i in idx:
                if i >= len(base[0]):
                    continue
                cuts.append(base[0][i]); feets.append(base[1][i]); cxs.append(base[2][i])
            out[anim] = (cuts, feets, cxs)
    # keep a pose if it is big enough OR still person-shaped (a crouch / a
    # leap stays tall even when it covers less area than a standing pose)
    stats = []
    for a in ORDER:
        for cut in out[a][0]:
            b = S.bounds(cut)
            stats.append((int((cut[:, :, 3] > 0).sum()),
                          (b[3] - b[1]) if b else 0))
    if stats:
        med_a = S.median([s0 for s0, _ in stats])
        med_h = S.median([s1 for _, s1 in stats])
        for anim in ORDER:
            cuts, feets, cxs = out[anim]
            keep = []
            for i, c in enumerate(cuts):
                b = S.bounds(c)
                a_i = int((c[:, :, 3] > 0).sum())
                h_i = (b[3] - b[1]) if b else 0
                if a_i >= med_a * 0.30 or h_i >= med_h * 0.60:
                    keep.append(i)
            if keep and len(keep) != len(cuts):
                out[anim] = ([cuts[i] for i in keep], [feets[i] for i in keep], [cxs[i] for i in keep])
    ground = S.median([fe for a in ORDER for fe in out[a][1]])
    frames = {}
    for anim in ORDER:
        cuts, feets, cxs = out[anim]
        lst = []
        for cut, fe, cx in zip(cuts, feets, cxs):
            lift = int(round(ground - fe))
            lift = max(-8, min(12, lift)) if anim == 'ability' else max(-3, min(3, lift))
            lst.append(S.pad_frame(cut, cx, S.FOOT - lift))
        frames[anim] = lst
    # walk cycle: alternate a 1px body bob so the derived cycle reads as
    # stepping instead of a slideshow (integer shift only, no resampling)
    if anim == 'walk':
        pass
    return frames


def trim_dupes(frames, anim):
    """Drop consecutive duplicate frames (keeps the walk loop honest)."""
    out = []
    for fr in frames:
        if out and np.array_equal(fr, out[-1]):
            continue
        out.append(fr)
    if len(out) > 1 and np.array_equal(out[0], out[-1]):
        out.pop()
    return out


SIZE = {'spiderman': 'M', 'venom': 'L', 'ironman': 'M', 'capamerica': 'M', 'hulk': 'L',
        'wolverine': 'S', 'drstrange': 'M', 'blackpanther': 'M', 'antman': 'S'}


def build(hid, log=print):
    sheet, _ = GRID.get(hid) or ANIM.get(hid)
    path = os.path.join(S.ROOT, sheet)
    if not os.path.exists(path):
        log('  MISSING %s' % sheet)
        return None
    frames = slice_legacy(path, target=TARGET[SIZE.get(hid, 'M')], log=log)
    for anim in ORDER:
        frames[anim] = trim_dupes(frames[anim], anim)
    meta = {}
    start = 0
    for anim in ORDER:
        n = len(frames[anim])
        # fewer poses = slower steps, so every pose reads on screen
        base = {'idle': 3.4, 'walk': 2.6, 'attack': 2.2, 'ability': 2.0}[anim]
        fps = max(3, min(12, int(round(base * 6 / max(2, n)))))
        meta[anim] = {'start': start, 'count': n, 'fps': fps,
                      'loop': anim in ('idle', 'walk')}
        start += n
    if len(frames['walk']) >= 4:            # 1px alternating step borrows life
        for i, fr in enumerate(frames['walk']):
            if i % 2 == 1:
                frames['walk'][i] = np.roll(fr, 1, axis=0)
    strip = S.strip_of(frames, ORDER)
    S.save_rgba(strip, os.path.join(S.OUT_ANIM, '%s.png' % hid))
    icon_src = max((fr for anim in ORDER for fr in frames[anim]),
                   key=lambda fr: (S.bounds(fr) or (0, 0, 0, 0))[3] - (S.bounds(fr) or (0, 0, 0, 0))[1])
    S.save_rgba(S.fit_icon(icon_src, 96, 5), os.path.join(S.OUT_SPR, '%s.png' % hid))
    log('  -> strip %dx%d  %s' % (strip.shape[1], strip.shape[0],
                                  {a: meta[a]['count'] for a in ORDER}))
    return {'anims': meta, 'frame': S.FRAME, 'frames': {a: meta[a]['count'] for a in ORDER}}


if __name__ == '__main__':
    ids = sys.argv[1:] or HEROES
    out = {}
    for hid in ids:
        r = build(hid)
        if r:
            out[hid] = r
    import json
    p = os.path.join(S.OUT_DATA, 'anim.json')
    old = {}
    if os.path.exists(p):
        old = json.load(open(p))
    for hid, meta in out.items():
        meta['source'] = 'art_ai'
        old[hid] = meta
    json.dump(old, open(p, 'w'), indent=1, sort_keys=True)
    print('wrote', os.path.relpath(p, S.ROOT))
