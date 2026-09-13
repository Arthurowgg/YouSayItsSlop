#!/usr/bin/env python3
"""Re-slice generated art_ai sheets into clean, transparent pixel-art shop icons.

Fixes the old pipeline problems:
  * baked-in navy backgrounds and letterbox bars (no chroma key was applied),
  * cells sliced with the wrong grid (two variants stacked in one icon),
  * leftover fragments of neighbouring cells,
  * blurry / washed-out resampling.

Method per cell:
  1. detect the flat background fills (quantised colours covering >2% of cell),
  2. flood-key the fill regions connected to border/inset sample seeds,
  3. drop hollow "plate frame" leftovers + stray bg pixels outside the art,
  4. crop to the alpha bounding box,
  5. downscale NEAREST at an integer ratio (keeps the true pixel grid, no blur),
  6. centre on a transparent 96x96 canvas.

Run:  .venv/bin/python tools/make_shop_icons.py   (needs pillow + numpy)
"""
import os
import sys
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
RAW = os.path.join(ROOT, 'art_ai')
OUT = os.path.join(ROOT, 'public', 'assets', 'spr')
CANVAS = 96
# Backgrounds are flat navy fills (per-column gradient span < 8). Dark art
# (charcoal metal, near-black outlines) sits ~16-40 away in max-norm, so a
# tight tolerance + flood from sample seeds keys the fill without leaking
# into the art.
KEY_TOL = 12          # flood tolerance to a background sample -> transparent


def load(sheet):
    return np.array(Image.open(os.path.join(RAW, sheet)).convert('RGBA'))


def sample_points(cell):
    """Border ring + inset rings (catches rounded "plate" fills and their
    outline colour without touching the centred art)."""
    h, w = cell.shape[:2]
    pts = []
    for x in range(0, w, max(4, w // 12)):
        pts += [(0, x), (h - 1, x)]
    for y in range(0, h, max(4, h // 12)):
        pts += [(y, 0), (y, w - 1)]
    for fx, fy in ((0.10, 0.07), (0.16, 0.12)):
        ix, iy = int(w * fx), int(h * fy)
        for x in range(ix, w - ix, max(4, w // 8)):
            pts += [(iy, x), (h - 1 - iy, x)]
        for y in range(iy, h - iy, max(4, h // 8)):
            pts += [(y, ix), (y, w - 1 - ix)]
    return pts


def bg_samples(cell):
    """Quantised colours that cover > 2% of the cell = flat background fills
    (columns, plates). Art palettes are too varied to reach that share."""
    h, w = cell.shape[:2]
    q = (cell[:, :, :3] // 6 * 6).astype(np.int32)
    flat = q.reshape(-1, 3)
    keys, counts = np.unique(flat, axis=0, return_counts=True)
    big = keys[counts > 0.02 * h * w]
    # near-black is sprite outline, never a background fill — excluding it
    # stops the flood from leaking through the art's own line art.
    return [tuple(int(c) for c in row) for row in big if max(row) >= 24]


def key_background(cell):
    from scipy import ndimage
    rgb = cell[:, :, :3].astype(int)
    h, w = rgb.shape[:2]
    samples = bg_samples(cell)
    loose = list({(r // 6 * 6, g // 6 * 6, b // 6 * 6)
                  for r, g, b in (tuple(int(c) for c in cell[y, x][:3]) for y, x in sample_points(cell))})

    def near(col, tol):
        return np.abs(rgb - np.array(col)).max(axis=2) <= tol

    mask = np.zeros((h, w), dtype=bool)
    for col in samples:
        mask |= near(col, KEY_TOL)

    # keep only mask components connected to a sample seed (border ring +
    # inset rings), so enclosed "plates" are keyed too while dark art that
    # merely resembles the bg survives.
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    seed_labels = {int(lab[y, x]) for y, x in sample_points(cell) if mask[y, x]}
    seed_labels.discard(0)
    seen = np.isin(lab, list(seed_labels))
    cell[seen, 3] = 0

    # drop hollow "plate frame" components (big bbox, tiny fill) left by
    # rounded-rect outlines in emotes_b, then clean any stray background
    # pixels outside the art bbox with a loose tolerance.
    a = cell[:, :, 3] > 0
    lab, n = ndimage.label(a, structure=np.ones((3, 3)))
    keep = np.zeros((h, w), dtype=bool)
    for i in range(1, n + 1):
        comp = lab == i
        ys, xs = np.where(comp)
        bh, bw = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1
        hollow = (bh * bw > 0.20 * h * w) and (comp.sum() < 0.15 * bh * bw)
        bar = (bh <= 12 and bw > 0.5 * w) or (bw <= 12 and bh > 0.5 * h)
        if not hollow and not bar:
            keep |= comp
    cell[~keep, 3] = 0

    a = cell[:, :, 3] > 0
    if a.sum():
        lab3, n3 = ndimage.label(a, structure=np.ones((3, 3)))
        sizes = ndimage.sum(a, lab3, range(1, n3 + 1))
        core = lab3 == (int(np.argmax(sizes)) + 1)
        ys, xs = np.where(core)
        outside = np.ones((h, w), dtype=bool)
        outside[ys.min():ys.max() + 1, xs.min():xs.max() + 1] = False
        for col in loose:
            cell[outside & near(col, 44), 3] = 0
        # stray specks outside the core (ring corners, neighbour-cell bleed):
        # drop tiny navy comps, and small comps glued to the cell margins.
        a = cell[:, :, 3] > 0
        lab4, n4 = ndimage.label(a, structure=np.ones((3, 3)))
        mx = max(6, int(0.08 * w))
        my = max(6, int(0.08 * h))
        for i in range(1, n4 + 1):
            comp = lab4 == i
            if (comp & core).any():
                continue
            ys2, xs2 = np.where(comp)
            in_margin = (xs2.max() < mx) or (xs2.min() > w - mx) or (ys2.max() < my) or (ys2.min() > h - my)
            med = np.median(cell[comp][:, :3], axis=0)
            navy = med[2] > med[0] + 8 and med.max() < 120
            if comp.sum() < 200 and navy:
                cell[comp, 3] = 0
            elif comp.sum() < 900 and in_margin:
                cell[comp, 3] = 0
    return cell


def box_down(crop, nw, nh):
    """Pre-multiplied area-average downscale + hard alpha. The sheets are
    fine-grained pixel art: NEAREST decimation drops 1px outline pixels and
    reads as dotted/blurry; BOX keeps every source pixel's contribution and
    the alpha threshold keeps silhouettes crisp and semi-free."""
    arr = crop.astype(np.float32)
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
        # consistent 1px contour on the silhouette border
        from scipy import ndimage as _nd
        er = _nd.binary_erosion(sil, structure=np.ones((3, 3)))
        edge = sil & ~er
        lum = crop[:, :, :3].astype(int).sum(axis=2) + (crop[:, :, 3] < 128) * 100000
        ys, xs = np.where(edge)
        r = max(1, crop.shape[0] // nh)
        for i, j in zip(ys, xs):
            y0, x0 = min(j * r, crop.shape[0] - 1), min(i * r, crop.shape[1] - 1)
            blk = lum[y0:y0 + r, x0:x0 + r]
            srk = crop[y0:y0 + r, x0:x0 + r, :3]
            if blk.size == 0:
                continue
            k = np.unravel_index(np.argmin(blk), blk.shape)
            rgb[i, j] = srk[k]
    return np.dstack([rgb, np.where(sil, 255, 0).astype(np.uint8)])


def finish(cell, name, ratio_hint=None):
    a = cell[:, :, 3] > 24
    if a.sum() < 16:
        print('  ! %s: empty cell, skipped' % name)
        return False
    ys, xs = np.where(a)
    crop = cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = crop.shape[:2]
    ratios = [ratio_hint] if ratio_hint else [2, 3, 4, 5, 6]
    ratio = None
    for r in ratios:
        if ratio_hint:
            ratio = ratio_hint
            break
        if max(h, w) / r <= 88:
            ratio = r
            break
    ratio = ratio or 6
    nw, nh = max(1, w // ratio), max(1, h // ratio)
    img = Image.fromarray(box_down(crop, nw, nh), 'RGBA')
    out = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    out.paste(img, ((CANVAS - nw) // 2, (CANVAS - nh) // 2), img)
    out.save(os.path.join(OUT, name + '.png'))
    print('  -> %s.png  (%dx%d /%d)' % (name, nw, nh, ratio))
    return True


import json as _json
_CAT = _json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'data', 'catalog.json')))
_KNOWN = set([x['id'] for k in ('heroes', 'picks', 'gliders', 'emotes') for x in _CAT.get(k, [])])


def row(sheet, cols, names, ratio_hint=None, rows=1):
    names = [n if n in _KNOWN else None for n in names]  # pruned roster: skip
    """names laid out left-to-right, top-to-bottom across rows."""
    print('[%s]' % sheet)
    img = load(sheet)
    H, W = img.shape[:2]
    cw, ch = W // cols, H // rows
    for i, name in enumerate(names):
        if name is None:
            continue
        r, c = divmod(i, cols)
        cell = img[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw].copy()
        finish(key_background(cell), name, ratio_hint)


def main():
    os.makedirs(OUT, exist_ok=True)

    # ---- emotes: 5 poses per sheet, single row ----
    row('emotes_a.png', 5, ['emote_dab', 'emote_groove', 'emote_hype', 'emote_runningman', 'emote_heart'])
    row('emotes_b.png', 5, ['emote_floss', 'emote_robot', 'emote_macarena', 'emote_gangnam', 'emote_moonwalk'])

    # ---- base picks (top row of the 4x2 sheet; bottom row = alt poses) ----
    row('picks_sheet.png', 4, ['pick_axe', 'pick_ice', 'pick_scythe', 'pick_hammer', None, None, None, None], rows=2)
    # ---- elemental picks ----
    row('picks6_sheet.png', 6, ['pick_plasma', 'pick_web', 'pick_storm', 'pick_shadow', 'pick_quantum', 'pick_magma'])
    # ---- hero picks ----
    row('picksA_sheet.png', 5, ['pick_h_spider', 'pick_h_classic', 'pick_h_miles', 'pick_h_gwen', 'pick_h_venom'])
    row('picksB_sheet.png', 5, ['pick_h_iron', 'pick_h_cap', 'pick_h_thor', 'pick_h_hulk', 'pick_h_wolverine'])
    row('picksC_sheet.png', 5, ['pick_h_widow', 'pick_h_hawkeye', 'pick_h_strange', 'pick_h_wanda', 'pick_h_wanda_azure'])
    row('picksD_sheet.png', 5, ['pick_h_panther', 'pick_h_marvel', 'pick_h_marvel_classic', 'pick_h_antman', 'pick_h_antman_unmasked'])

    # ---- base gliders ----
    row('gliders_sheet.png', 4, ['glider_shield', 'glider_wings', 'glider_cosmic', 'glider_claws'])
    row('gliders6_sheet.png', 6, ['glider_portal', 'glider_webwings', 'glider_storm', 'glider_panther', 'glider_holo', 'glider_valkyrie'])
    # ---- hero gliders ----
    row('glidersA_sheet.png', 5, ['glider_h_spider', 'glider_h_classic', 'glider_h_venom', 'glider_h_gwen', 'glider_h_miles'])
    row('glidersB_sheet.png', 3, ['glider_h_iron', 'glider_h_cap', 'glider_h_marvel', 'glider_h_marvel_classic', 'glider_h_hulk', 'glider_h_wolverine'], rows=2)
    row('glidersC_sheet.png', 5, ['glider_h_widow', 'glider_h_hawkeye', 'glider_h_strange', 'glider_h_wanda', 'glider_h_wanda_azure'])
    row('glidersD_sheet.png', 5, ['glider_h_panther', 'glider_h_thor', 'glider_h_antman_unmasked', 'glider_h_antman', None])

    print('done.')


if __name__ == '__main__':
    main()
