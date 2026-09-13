#!/usr/bin/env python3
"""Slice the AI sprite sheets (art_ai/) into every character asset the game ships.

Owns (nothing else may write these):
  public/assets/spr/<hero>.png     96x96 hero icons      (grid idle pose / K0 pose)
  public/assets/anim/<hero>.png    78-frame 48px strips  (idle/walk/attack/power
                                                           + 10 emote dance loops)

Sources (all AI-generated, committed in art_ai/):
  grid_<hero>.png   4 rows: idle(4) walk(6-7) attack(4-5) power(4-5)
  anim_<hero>.png   1 row of 4 key poses: K0 stand, K1 stride/crouch,
                    K2 jump-flex, K3 stand variant
  (emote/pick/glider shop icons are sliced by tools/make_shop_icons.py)

Method:
  * key every flat background fill (column bands, plate fills, grid lines) by
    quantised colour share + component-area rule -> true alpha, no chroma halo;
  * drop ground-shadow ellipses and hollow plate rims / letterbox bars;
  * auto-detect sprites as connected components (fx merged by closing),
    cluster into rows top-to-bottom, left-to-right - no hardcoded grids;
  * integer-ratio NEAREST downscale (keeps the pixel grid crisp, no blur),
    one ratio per source sheet so a hero's grain stays uniform;
  * ground every core frame on a shared feet line (no flicker); emote loops
    are choreographed from the hero's own poses with integer bob / hop /
    mirror / sway offsets (see RECIPES) - 100% AI pixels, zero repainting.

Run:  .venv/bin/python tools/make_ai_assets.py [--contact]
"""
import os
import sys
import json
import argparse
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(__file__), '..')
RAW = os.path.join(ROOT, 'art_ai')
PUB = os.path.join(ROOT, 'public')
SPR = os.path.join(PUB, 'assets', 'spr')
ANIM = os.path.join(PUB, 'assets', 'anim')
SHOT = os.path.join(ROOT, '.shot')

FRAME = 48
GROUND = 47          # feet line inside the 48px frame (bottom row)
TARGET_H = 42        # wanted character height in strip frames
ICON_CANVAS = 96
ICON_MAX = 88

# catalog emote order == strip order (starts 18..72, 6 frames each)
EMOTES = ['gangnam', 'floss', 'dab', 'moonwalk', 'robot',
          'runningman', 'macarena', 'hype', 'heart', 'groove']

HEROES = ['spiderman', 'spiderman_classic', 'miles', 'gwen', 'venom',
          'ironman', 'capamerica', 'thor', 'hulk', 'wolverine',
          'blackwidow', 'hawkeye', 'drstrange', 'scarletwitch',
          'scarletwitch_azure', 'blackpanther', 'captainmarvel',
          'captainmarvel_classic', 'antman', 'antman_unmasked']


# ----------------------------------------------------------------- sheet prep
def load(sheet):
    return np.array(Image.open(os.path.join(RAW, sheet)).convert('RGBA'))


def key_background(rgb):
    """True-alpha mask of the artwork: True = sprite pixel.

    The sheets sit on smooth navy gradients / column bands, so colour keying
    is unreliable. Line art instead gives strong local contrast: take the
    gradient magnitude, close the outlines, fill their holes -> solid sprite
    blobs regardless of backdrop. Sheet furniture (grid seams, band edges,
    plate rims) survives as thin bars / big rounded solids and is filtered
    below; ground shadows are flat ellipses removed by drop_shadows().
    """
    h, w = rgb.shape[:2]
    r = rgb.astype(np.int32)
    gx = np.abs(r[:, 1:] - r[:, :-1]).max(axis=2)
    gy = np.abs(r[1:, :] - r[:-1, :]).max(axis=2)
    g = np.zeros((h, w))
    g[:, :-1] = np.maximum(g[:, :-1], gx)
    g[:, 1:] = np.maximum(g[:, 1:], gx)
    g[:-1, :] = np.maximum(g[:-1, :], gy)
    g[1:, :] = np.maximum(g[1:, :], gy)
    edge = g > 26
    # sheet furniture: grid seams / band borders are straight lines running
    # (nearly) unbroken across the whole sheet - clear them before closing,
    # else the lattice fills into one sheet-sized blob. Aligned sprite
    # outlines also make dense columns, but never one long unbroken run.
    def long_run(v):
        idx = np.flatnonzero(np.diff(np.concatenate(([0], v.view(np.int8), [0]))))
        runs = idx[1::2] - idx[0::2]
        return runs.max() if len(runs) else 0
    cd = edge.mean(axis=0)
    rd = edge.mean(axis=1)
    for x in np.where(cd > 0.6)[0]:
        if long_run(edge[:, x]) > 120:
            edge[:, max(0, x - 1):x + 2] = False
    for y in np.where(rd > 0.6)[0]:
        if long_run(edge[y, :]) > 120:
            edge[max(0, y - 1):y + 2, :] = False
    art = ndimage.binary_fill_holes(edge)

    def remove_thin(m):
        """seam dashes / slivers: long but <=8px thick in one axis"""
        lab, n = ndimage.label(m, structure=np.ones((3, 3)))
        out = m.copy()
        for i in range(1, n + 1):
            comp = lab == i
            ys, xs = np.where(comp)
            bh, bw = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1
            if (bh <= 6 and bw >= 32) or (bw <= 6 and bh >= 32):
                out &= ~comp
        return out

    # dashed seam leftovers are thin lines now (their loops were open, so
    # fill_holes skipped them); drop them, then seal the 3px channels that
    # seam clearing cut through sprites that overlap a seam line, and fill
    # those sprites again.
    art = remove_thin(art)
    art = ndimage.binary_closing(art, structure=np.ones((1, 9)))
    art = ndimage.binary_closing(art, structure=np.ones((9, 1)))
    art = ndimage.binary_fill_holes(art)
    art = remove_thin(art)

    # drop sheet furniture: hollow plate rims / letterbox bars
    lab, n = ndimage.label(art, structure=np.ones((3, 3)))
    drop = np.zeros((h, w), dtype=bool)
    for i in range(1, n + 1):
        comp = lab == i
        ys, xs = np.where(comp)
        bh, bw = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1
        hollow = (bh * bw > 0.02 * h * w) and (comp.sum() < 0.15 * bh * bw)
        bar = (bh <= 12 and bw > 0.4 * w) or (bw <= 12 and bh > 0.4 * h)
        if hollow or bar:
            drop |= comp
    art &= ~drop

    # the close/fill steps leave a 1-2px halo of backdrop colour glued to
    # every silhouette (reads as a blurry fringe once downscaled). The
    # backdrop is a smooth bilinear gradient between the sheet corners, so
    # pixels matching that model are backdrop, never art.
    c00 = rgb[0, 0].astype(float)
    c01 = rgb[0, -1].astype(float)
    c10 = rgb[-1, 0].astype(float)
    c11 = rgb[-1, -1].astype(float)
    yy, xx = np.mgrid[0:h, 0:w]
    ty, tx = (yy / max(1, h - 1))[..., None], (xx / max(1, w - 1))[..., None]
    bg = (c00 * (1 - tx) * (1 - ty) + c01 * tx * (1 - ty) +
          c10 * (1 - tx) * ty + c11 * tx * ty)
    halo = art & (np.abs(rgb.astype(float) - bg).max(axis=2) <= 12)
    return art & ~halo


def drop_shadows(art, rgb):
    """Remove detached flat ground-shadow ellipses under the poses."""
    lab, n = ndimage.label(art, structure=np.ones((3, 3)))
    boxes = []
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        boxes.append((i, ys.min(), ys.max(), xs.min(), xs.max(), len(ys)))
    shadow = np.zeros((h := art.shape[0], art.shape[1]), dtype=bool)
    for i, y0, y1, x0, x1, sz in boxes:
        bh, bw = y1 - y0 + 1, x1 - x0 + 1
        if not (bh <= 26 and bw >= 24 and bw / bh >= 3):
            continue
        px = rgb[lab == i][:, :3]
        if len(np.unique(px // 12, axis=0)) > 3:
            continue                       # not a flat fill -> real art
        # a sprite must sit right above it
        for j, y0b, y1b, x0b, x1b, szb in boxes:
            if j == i or szb < sz * 3:
                continue
            if y1b <= y0 and y0 - y1b <= 26 and not (x1 < x0b or x0 > x1b):
                shadow |= lab == i
                break
    return art & ~shadow


def cell_sprite(sub, cw, ch):
    """Biggest component in a cell + contained small fx glued onto it."""
    lab, n = ndimage.label(sub, structure=np.ones((3, 3)))
    comps = []
    for i in range(1, n + 1):
        m = lab == i
        sz = int(m.sum())
        if sz < 400:
            continue
        ys, xs = np.where(m)
        if xs.max() - xs.min() < 23 or ys.max() - ys.min() < 23:
            continue                       # seam slivers / bars
        comps.append([xs.min(), ys.min(), xs.max(), ys.max(), sz, m])
    if not comps:
        return None
    main = max(comps, key=lambda c: c[4])
    mask = main[5].copy()
    for c in comps:
        if c is main:
            continue
        dx = max(main[0] - c[2], c[0] - main[2], 0)
        dy = max(main[1] - c[3], c[1] - main[3], 0)
        contained = (c[0] >= 4 and c[1] >= 4 and c[2] <= cw - 5 and c[3] <= ch - 5)
        if max(dx, dy) <= 24 and c[4] <= 0.35 * main[4] and contained:
            mask |= c[5]                   # detached fx: shield, lightning
    return mask


def sheet_sprites(sheet, cols, rows):
    """Slice a sheet on its known grid; returns rows of sprites + the rgb."""
    rgb = load(sheet)[:, :, :3]
    art = key_background(rgb)
    art = drop_shadows(art, rgb)
    H, W = art.shape
    cw, ch = W // cols, H // rows
    out = []
    for r in range(rows):
        row = []
        for c in range(cols):
            y0, y1, x0, x1 = r * ch, (r + 1) * ch, c * cw, (c + 1) * cw
            m = cell_sprite(art[y0:y1, x0:x1], cw, ch)
            if m is None:
                continue
            ys, xs = np.where(m)
            full = np.zeros((H, W), bool)
            full[y0:y1, x0:x1] = m
            row.append(dict(mask=full, y0=y0 + ys.min(), y1=y0 + ys.max(),
                            x0=x0 + xs.min(), x1=x0 + xs.max(),
                            cy=y0 + (ys.min() + ys.max()) / 2,
                            cx=x0 + (xs.min() + xs.max()) / 2))
        out.append(row)
    # the AI grids are not perfectly uniform: a pose can straddle a cell
    # border and come out as two flush halves. Re-join halves whose cut
    # edges are pixel-continuous (touching *distinct* poses only kiss at a
    # few pixels, split bodies share most of the cut column).
    for row in out:
        changed = True
        while changed:
            changed = False
            row.sort(key=lambda s: s['cx'])
            for i in range(len(row) - 1):
                a, b = row[i], row[i + 1]
                if b['x0'] - a['x1'] > 2:
                    continue
                y0, y1 = max(a['y0'], b['y0']), min(a['y1'], b['y1'])
                if y1 - y0 < 8:
                    continue
                col = (a['mask'][y0:y1 + 1, a['x1']] & b['mask'][y0:y1 + 1, b['x0']])
                if col.mean() >= 0.45:
                    a['mask'] = a['mask'] | b['mask']
                    a['x0'], a['x1'] = min(a['x0'], b['x0']), max(a['x1'], b['x1'])
                    a['y0'], a['y1'] = min(a['y0'], b['y0']), max(a['y1'], b['y1'])
                    a['cy'], a['cx'] = (a['y0'] + a['y1']) / 2, (a['x0'] + a['x1']) / 2
                    row.pop(i + 1)
                    changed = True
                    break
    # drop floating fx that survived as their own "sprite" (beam segments
    # beyond merge range): much shorter than the poses of their row.
    for row in out:
        if len(row) > 1:
            med = np.median([s['y1'] - s['y0'] + 1 for s in row])
            kept = [s for s in row if s['y1'] - s['y0'] + 1 >= 0.6 * med]
            if kept:
                row[:] = kept
    return [r for r in out if r], rgb


def cut(rgb, spr):
    """RGBA crop of one detected sprite."""
    m = spr['mask'][spr['y0']:spr['y1'] + 1, spr['x0']:spr['x1'] + 1]
    px = np.dstack([rgb[spr['y0']:spr['y1'] + 1, spr['x0']:spr['x1'] + 1],
                    np.where(m, 255, 0).astype(np.uint8)])
    return px


def sheet_ratio(rows, want=TARGET_H):
    hs = [s['y1'] - s['y0'] + 1 for r in rows for s in r]
    return max(2, int(round(np.median(hs) / want)))


def scale_px(px, ratio, pal=None):
    """Area-average (premultiplied BOX) downscale + hard alpha.

    The sheets are fine-grained pixel art (1px line work): NEAREST decimation
    would drop outline pixels and read as dotted/blurry. Box filtering keeps
    every source pixel's contribution; the alpha threshold keeps the
    silhouette crisp and semi-free.
    """
    h, w = px.shape[:2]
    nw, nh = max(1, w // ratio), max(1, h // ratio)
    arr = px.astype(np.float32)
    a = arr[:, :, 3:4] / 255.0
    prem = np.concatenate([arr[:, :, :3] * a, arr[:, :, 3:4]], axis=2)
    out = np.empty((nh, nw, 4), np.float32)
    for i in range(4):
        band = Image.fromarray(prem[:, :, i], 'F').resize((nw, nh), Image.BOX)
        out[:, :, i] = np.array(band)
    al = out[:, :, 3] / 255.0
    rgb = np.zeros((nh, nw, 3), np.uint8)
    m = al > 1e-3
    rgb[m] = np.clip(out[:, :, :3][m] / al[m][:, None], 0, 255).astype(np.uint8)
    sil = al > 0.45
    if m.sum():
        if pal is not None:
            rgb = _flat(rgb, sil, pal)
        else:
            rgb = _restore_contour(rgb, px, sil, ratio)
    res = np.dstack([rgb, np.where(sil, 255, 0).astype(np.uint8)])
    return res


# ----------------------------------------------------------------- frames
def _anchor_crop(px, limit):
    """Trim an over-long frame to `limit` px around its body: the body is
    the densest run of column/row mass, far fx (beams) get cut first."""
    def fix(arr, lim):
        n = arr.shape[1] if arr.ndim == 3 else arr.shape[0]
        if n <= lim:
            return arr
        mass = (arr[:, :, 3] if arr.ndim == 3 else arr).sum(axis=0).astype(float)
        k = np.ones(5) / 5
        sm = np.convolve(mass, k, mode='same')
        anchor = int(np.argmax(sm))
        s = max(0, min(anchor - lim // 2, n - lim))
        return arr[:, s:s + lim] if arr.ndim == 3 else arr[s:s + lim]
    px = fix(px, limit)
    if px.shape[0] > limit:
        mass = (px[:, :, 3] if px.ndim == 3 else px).sum(axis=1).astype(float)
        k = np.ones(5) / 5
        sm = np.convolve(mass, k, mode='same')
        anchor = int(np.argmax(sm))
        s = max(0, min(anchor - limit // 2, px.shape[0] - limit))
        px = px[s:s + limit]
    return px


def _restore_contour(rgb, src, sil, ratio):
    """Silhouette border pixels take the darkest source pixel of their block:
    a consistent 1px contour instead of patchy blended fringe."""
    er = ndimage.binary_erosion(sil, structure=np.ones((3, 3)))
    edge = sil & ~er
    if not edge.any():
        return rgb
    lum = src[:, :, :3].astype(int).sum(axis=2) + (src[:, :, 3] < 128) * 100000
    ys, xs = np.where(edge)
    for i, j in zip(ys, xs):
        blk = lum[j * ratio:(j + 1) * ratio, i * ratio:(i + 1) * ratio]
        srk = src[j * ratio:(j + 1) * ratio, i * ratio:(i + 1) * ratio, :3]
        if blk.size == 0:
            continue
        k = np.unravel_index(np.argmin(blk), blk.shape)
        rgb[i, j] = srk[k]
    return rgb


def _smooth_labels(lab, sil):
    """Mode-filter the label map so grain checkerboards collapse into flat
    regions, while ties keep the original label - 1px lines and eye rims
    always tie in their 3x3 window, so they survive untouched."""
    k = int(lab.max()) + 1
    cnt = np.stack([ndimage.convolve(lab == j, np.ones((3, 3)),
                                     mode='constant', cval=0)
                    for j in range(k)], axis=2)
    mode = np.argmax(cnt, axis=2)
    moden = np.take_along_axis(cnt, mode[:, :, None], axis=2)[:, :, 0]
    own = np.take_along_axis(cnt, lab[:, :, None], axis=2)[:, :, 0]
    # ties keep the original label: 1px lines/rims always tie (3-3-3 or
    # 3-line vs 3+3), grain checkerboards do not (5-4, 6-3...).
    return np.where(sil & (own < moden), mode, lab).astype(lab.dtype)


def _despeckle(lab, sil, rounds=2):
    """Kill 1-2px grain speckle in the label map: a pixel whose own colour
    appears <=2 times in its 3x3 window joins the dominant neighbour colour
    (>=6 of 9). 1px lines survive (a line pixel sees 3+ of its own)."""
    k = int(lab.max()) + 1
    for _ in range(rounds):
        cnt = np.stack([ndimage.convolve(lab == j, np.ones((3, 3)),
                                         mode='constant', cval=0)
                        for j in range(k)], axis=2)
        own = np.take_along_axis(cnt, lab[:, :, None], axis=2)[:, :, 0]
        cnt_o = cnt.copy()
        np.put_along_axis(cnt_o, lab[:, :, None], -1, axis=2)
        dom = np.argmax(cnt_o, axis=2)
        domn = np.take_along_axis(cnt_o, dom[:, :, None], axis=2)[:, :, 0]
        cond = sil & (own <= 2) & (domn >= 6)
        if not cond.any():
            break
        lab = np.where(cond, dom, lab)
    return lab


def _flat(rgb, sil, pal):
    """Snap every pixel to the hero's own flat colours, despeckle the grain,
    and give the silhouette one uniform 1px outline (the darkest palette
    tone) - the OG pixel-art look. The game draws these frames at 5-7x, so
    half-blended or grain-scattered pixels read as blur."""
    d = ((rgb.astype(np.float32)[:, :, None, :] - pal[None, None, :, :]) ** 2).sum(axis=3)
    lab = np.argmin(d, axis=2)
    lab = _smooth_labels(lab, sil)
    lab = _despeckle(lab, sil)
    out = rgb.copy()
    out[sil] = pal[lab][sil]
    edge = sil & ~ndimage.binary_erosion(sil, structure=np.ones((3, 3)))
    out[edge] = pal[np.argmin(pal.sum(axis=1))].astype(np.uint8)
    return out


def hero_palette(cuts, n=14):
    """Flat colour palette per hero: k-means over masked source pixels.

    Exact-colour counting fails here because the AI fills carry per-pixel
    grain, so the only exact colours frequent enough to make a top-N are
    the flat outline tones and every pixel snaps to silhouette-dark.
    Cluster means recover the true fill tones; snapping BOX means to them
    keeps the frames flat AND correctly coloured."""
    px = np.concatenate([c[c[:, :, 3] > 128][:, :3] for c in cuts
                         if (c[:, :, 3] > 128).any()])[::2].astype(np.float32)
    if not len(px):
        return np.zeros((1, 3), np.float32)
    buck = (px // 24).astype(np.int32)
    keys, inv, counts = np.unique(buck, axis=0, return_inverse=True,
                                  return_counts=True)
    order = np.argsort(-counts)[:n]
    cen = np.array([px[inv == o].mean(axis=0) for o in order], np.float32)
    for _ in range(8):
        d = ((px[:, None, :] - cen[None, :, :]) ** 2).sum(axis=2)
        lab = np.argmin(d, axis=1)
        for j in range(len(cen)):
            m = lab == j
            if m.sum():
                cen[j] = px[m].mean(axis=0)
    # single-linkage merge: grain makes k-means split one fill tone into
    # several near clusters (5 reds for spidey) which then speckle against
    # each other. Closer than 45 RGB = one flat tone; real region borders
    # (red|blue, white|rim, skin|blond) stay apart.
    w = np.array([np.sum(lab == j) for j in range(len(cen))], np.float32)
    while len(cen) > 2:
        dd = ((cen[:, None, :] - cen[None, :, :]) ** 2).sum(2) + np.eye(len(cen)) * 1e9
        i, j = np.unravel_index(np.argmin(dd), dd.shape)
        if dd[i, j] >= 45 ** 2:
            break
        cen[i] = (cen[i] * w[i] + cen[j] * w[j]) / (w[i] + w[j])
        w[i] += w[j]
        cen = np.delete(cen, j, 0)
        w = np.delete(w, j)
    return cen


def _squeeze(px, nw, nh, pal=None):
    """Pre-multiplied BOX resize to an exact size (gentle squash, no cuts)."""
    arr = px.astype(np.float32)
    a = arr[:, :, 3:4] / 255.0
    prem = np.concatenate([arr[:, :, :3] * a, arr[:, :, 3:4]], axis=2)
    out = np.empty((nh, nw, 4), np.float32)
    for i in range(4):
        band = Image.fromarray(prem[:, :, i], 'F').resize((nw, nh), Image.BOX)
        out[:, :, i] = np.array(band)
    al = out[:, :, 3] / 255.0
    rgb = np.zeros((nh, nw, 3), np.uint8)
    m = al > 1e-3
    rgb[m] = np.clip(out[:, :, :3][m] / al[m][:, None], 0, 255).astype(np.uint8)
    sil = al > 0.45
    if pal is not None and m.sum():
        rgb = _flat(rgb, sil, pal)
    return np.dstack([rgb, np.where(sil, 255, 0).astype(np.uint8)])


def place(px, dx=0, dy=0, mirror=False, ground=GROUND, canvas=FRAME, pal=None):
    """Mirror / ground / centre a scaled frame onto the 48px canvas."""
    if mirror:
        px = px[:, ::-1]
    a = px[:, :, 3] > 24
    ys, xs = np.where(a)
    px = px[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    # over-long frames: extreme fx (beams) get anchor-cropped; mildly wide
    # poses get a gentle BOX squeeze so limbs are never sliced flat.
    if px.shape[1] > 64:
        px = _anchor_crop(px, canvas)
    if px.shape[1] > canvas:
        px = _squeeze(px, canvas, px.shape[0], pal)
    if px.shape[0] > canvas:
        px = _squeeze(px, px.shape[1], canvas, pal)
    h, w = px.shape[:2]
    out = np.zeros((canvas, canvas, 4), np.uint8)
    y0 = ground - h + 1 + dy
    x0 = (canvas - w) // 2 + dx
    y0 = max(0, min(y0, canvas - h))
    x0 = max(0, min(x0, canvas - w))
    out[y0:y0 + h, x0:x0 + w] = px
    return out


def resample(seq, n):
    if len(seq) == n:
        return seq
    return [seq[int(round(i * (len(seq) - 1) / (n - 1)))] for i in range(n)]


WALK_BOB = [0, -1, 0, 0, -1, 0]      # stride phases lift the body 1px
POWER_HOP = [0, -1, -2, -1]          # charge -> burst hop

# emote choreography: (pose key, dx, dy, mirror) x6 - integer ops only.
# pose keys: I idle0, S stand2(K3), C stride/crouch(K1), F jump-flex(K2),
#            L lunge (attack mid), W<i> walk frame i
RECIPES = {
    'gangnam':     [('F', 0, 0, 0), ('C', 0, 0, 1), ('F', 0, 0, 0),
                    ('C', 0, 0, 0), ('F', 0, 0, 1), ('C', 0, 0, 1)],
    'floss':       [('L', 0, 0, 0), ('L', 0, -1, 0), ('L', 0, 0, 1),
                    ('L', 0, -1, 1), ('L', 0, 0, 0), ('L', 0, -1, 0)],
    'dab':         [('L', 0, 0, 0), ('L', 0, -1, 0), ('L', 0, -1, 0),
                    ('L', 0, 0, 0), ('L', 0, -1, 0), ('L', 0, -1, 0)],
    'moonwalk':    [('W0', 1, 0, 1), ('W1', 0, 0, 1), ('W2', -1, 0, 1),
                    ('W3', -2, 0, 1), ('W4', -1, 0, 1), ('W5', 0, 0, 1)],
    'robot':       [('S', 0, 0, 0), ('S', 0, 0, 0), ('L', 0, 0, 0),
                    ('L', 0, 0, 0), ('S', 0, 0, 1), ('S', 0, 0, 1)],
    'runningman':  [('C', 0, 0, 0), ('C', 0, -2, 0), ('C', 0, 0, 1),
                    ('C', 0, -2, 1), ('C', 0, 0, 0), ('C', 0, -1, 0)],
    'macarena':    [('L', 0, 0, 0), ('L', 0, 0, 0), ('S', 0, 0, 0),
                    ('L', 0, 0, 1), ('L', 0, 0, 1), ('S', 0, 0, 0)],
    'hype':        [('I', 0, 0, 0), ('C', 0, 0, 0), ('F', 0, -3, 0),
                    ('F', 0, -4, 0), ('F', 0, -2, 0), ('I', 0, 0, 0)],
    'heart':       [('I', 0, 0, 0), ('I', 0, -1, 0), ('F', 0, 0, 0),
                    ('F', 0, -1, 0), ('F', 0, 0, 0), ('I', 0, -1, 0)],
    'groove':      [('L', 0, -1, 0), ('L', 0, -1, 1), ('L', 0, 0, 0),
                    ('L', 0, 0, 1), ('L', 0, -1, 0), ('L', 0, -1, 1)],
}


class HeroArt:
    def __init__(self, hid):
        self.hid = hid
        self.grid = None
        self.k = None
        if os.path.exists(os.path.join(RAW, 'grid_%s.png' % hid)):
            rows, rgb = sheet_sprites('grid_%s.png' % hid, 8, 4)
            self.grid_rgb = rgb
            self.grid_ratio = sheet_ratio(rows)
            self.grid = [[cut(rgb, s) for s in r] for r in rows]
        rows, rgb = sheet_sprites('anim_%s.png' % hid, 4, 1)
        self.k_rgb = rgb
        self.k_ratio = sheet_ratio(rows)
        self.k = [cut(rgb, s) for s in rows[0]]
        cuts = [c for r in (self.grid or []) for c in r] + self.k
        self.pal = hero_palette(cuts)

    def pose(self, key):
        """Scaled (not yet placed) frame pixels for a pose key."""
        if key.startswith('W') and self.grid and len(self.grid) > 1:
            walk = self.grid[1]
            i = min(int(key[1:] or 0), len(walk) - 1)
            return scale_px(walk[i], self.grid_ratio, self.pal)
        if key == 'I':
            if self.grid:
                return scale_px(self.grid[0][0], self.grid_ratio, self.pal)
            return scale_px(self.k[0], self.k_ratio, self.pal)
        if key == 'S':
            return scale_px(self.k[3], self.k_ratio, self.pal)
        if key == 'C':
            return scale_px(self.k[1], self.k_ratio, self.pal)
        if key == 'F':
            return scale_px(self.k[2], self.k_ratio, self.pal)
        if key == 'L':
            if self.grid and len(self.grid) > 2 and len(self.grid[2]) > 1:
                return scale_px(self.grid[2][1], self.grid_ratio, self.pal)
            return scale_px(self.k[1], self.k_ratio, self.pal)
        raise KeyError(key)

    def walk_loop(self):
        """6-frame loop from the walk row. The AI rows are not always clean
        phase cycles (the 7-frame sheets hide a strict-profile pose mid-row
        that pops when looped), so pick stride/passing phases that loop."""
        w = self.grid[1]
        n = len(w)
        if n == 6:
            idx = list(range(6))
        elif n == 7:
            idx = [1, 2, 3, 5, 6, 3]
        elif n >= 8:
            idx = [0, 1, 3, 4, 5, 7]
        else:
            return resample(w, 6)
        return [w[i] for i in idx]

    def core_frames(self):
        fr = []
        if self.grid and len(self.grid) >= 4:
            idle = resample(self.grid[0], 4)
            walk = self.walk_loop()
            atk = resample(self.grid[2], 4)
            pow_ = resample(self.grid[3], 4)
            for px in idle:
                fr.append(place(scale_px(px, self.grid_ratio, self.pal), pal=self.pal))
            for i, px in enumerate(walk):
                fr.append(place(scale_px(px, self.grid_ratio, self.pal),
                                dy=WALK_BOB[i], pal=self.pal))
            for px in atk:
                fr.append(place(scale_px(px, self.grid_ratio, self.pal), pal=self.pal))
            for i, px in enumerate(pow_):
                fr.append(place(scale_px(px, self.grid_ratio, self.pal),
                                dy=POWER_HOP[i], pal=self.pal))
        else:  # pose-sheet heroes: synthesise the cycles from K poses
            g = lambda k, dx=0, dy=0, m=0: place(self.pose(k), dx, dy, m,
                                                 pal=self.pal)
            fr += [g('I'), g('S'), g('I'), g('S')]
            fr += [g('C', 0, WALK_BOB[0]), g('C', 0, WALK_BOB[1]),
                   g('S', 0, WALK_BOB[2]), g('C', 0, WALK_BOB[3], 1),
                   g('C', 0, WALK_BOB[4], 1), g('S', 0, WALK_BOB[5])]
            fr += [g('S'), g('F'), g('C', 0, 0, 1), g('S')]
            fr += [g('I', 0, POWER_HOP[0]), g('F', 0, POWER_HOP[1]),
                   g('F', 0, POWER_HOP[2]), g('F', 0, POWER_HOP[3])]
        return fr

    def emote_frames(self, em):
        out = []
        for key, dx, dy, m in RECIPES[em]:
            if key.startswith('W') and not self.grid:
                key = 'C'                      # pose-sheet moonwalk: stride sway
            out.append(place(self.pose(key), dx, dy, m, pal=self.pal))
        return out

    def strip(self):
        frames = self.core_frames()
        for em in EMOTES:
            frames += self.emote_frames(em)
        assert len(frames) == 78, (self.hid, len(frames))
        return np.hstack(frames)

    def icon(self):
        px = self.pose('I')
        a = px[:, :, 3] > 24
        ys, xs = np.where(a)
        h = ys.max() - ys.min() + 1
        ratio = max(1, -(-h // ICON_MAX))      # ceil
        px = scale_px(px, ratio, self.pal) if ratio > 1 else px
        return place(px, ground=93, canvas=ICON_CANVAS, pal=self.pal)


def build_backblings():
    """32px back-bling sprites for the in-game animator (the 96px shop icons
    are far too big to sit on a 48px hero). Cropped from the shop icon,
    BOX-downscaled /4 with the same flat-palette + contour treatment."""
    cat = json.load(open(os.path.join(PUB, 'data', 'catalog.json')))
    n = 0
    for g in cat['gliders']:
        gid = g['id']
        src = os.path.join(SPR, gid + '.png')
        if not os.path.exists(src):
            continue
        if os.path.exists(os.path.join(ROOT, 'art2', 'bling_%s.png' % gid.replace('glider_h_', '', 1) if gid.startswith('glider_h_') else '__none__')):
            continue  # native sprite generated directly by make_ai2_assets.py
        ic = np.array(Image.open(src).convert('RGBA'))
        a = ic[:, :, 3] > 24
        if a.sum() < 16:
            continue
        ys, xs = np.where(a)
        crop = ic[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        pal = hero_palette([crop], n=12)
        small = scale_px(crop, 3, pal)
        h, w = small.shape[:2]
        if h > 32 or w > 32:
            small = _squeeze(small, min(w, 32), min(h, 32), pal)
            h, w = small.shape[:2]
        out = np.zeros((32, 32, 4), np.uint8)
        out[(32 - h) // 2:(32 - h) // 2 + h, (32 - w) // 2:(32 - w) // 2 + w] = small
        Image.fromarray(out, 'RGBA').save(os.path.join(ANIM, gid + '.png'))
        n += 1
    print('done: %d back-bling sprites (32px).' % n)


def contact(strip, hid, scale=2, per=26):
    os.makedirs(SHOT, exist_ok=True)
    rows = [strip[:, i * FRAME:(i + 1) * FRAME] for i in range(78)]
    chunks = [rows[i:i + per] for i in range(0, 78, per)]
    for ci, ch in enumerate(chunks):
        w = len(ch) * FRAME * scale
        out = Image.new('RGBA', (w, FRAME * scale), (24, 26, 34, 255))
        for i, fr in enumerate(ch):
            im = Image.fromarray(fr, 'RGBA').resize(
                (FRAME * scale, FRAME * scale), Image.NEAREST)
            out.paste(im, (i * FRAME * scale, 0), im)
        out.save(os.path.join(SHOT, 'strip_%s_%d.png' % (hid, ci)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--contact', action='store_true',
                    help='also write .shot/strip_<hero>_*.png review sheets')
    ap.add_argument('--only', nargs='*', default=None)
    args = ap.parse_args()
    os.makedirs(SPR, exist_ok=True)
    os.makedirs(ANIM, exist_ok=True)
    heroes = args.only or HEROES
    for hid in heroes:
        if os.path.exists(os.path.join(ROOT, 'art2', 'sheet_%s.png' % hid)):
            continue  # rebuilt by make_ai2_assets.py from purpose-made sheets
        art = HeroArt(hid)
        strip = art.strip()
        Image.fromarray(strip, 'RGBA').save(os.path.join(ANIM, hid + '.png'))
        icon = art.icon()
        Image.fromarray(icon, 'RGBA').save(os.path.join(SPR, hid + '.png'))
        g = 'grid' if art.grid else 'poses'
        print('  -> %s  [%s] ratio %s/%s' % (
            hid, g, art.grid_ratio if art.grid else '-', art.k_ratio))
        if args.contact:
            contact(strip, hid)
    build_backblings()
    if args.contact:  # icon contact sheet
        os.makedirs(SHOT, exist_ok=True)
        cols = 5
        sheet = Image.new('RGBA', (cols * 96, ((len(heroes) - 1) // cols + 1) * 96),
                          (24, 26, 34, 255))
        for i, hid in enumerate(heroes):
            im = Image.open(os.path.join(SPR, hid + '.png')).convert('RGBA')
            sheet.paste(im, ((i % cols) * 96, (i // cols) * 96), im)
        sheet.save(os.path.join(SHOT, 'icons_heroes.png'))
    print('done: %d heroes (strips + icons) from art_ai sheets.' % len(heroes))


if __name__ == '__main__':
    main()
