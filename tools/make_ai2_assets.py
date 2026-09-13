#!/usr/bin/env python3
"""Asset builder v2: sprites generated FOR the animation system.

art2/ holds purpose-made pixel sheets with a KNOWN fixed layout, so slicing
is exact equal-cell division (no seam detection => no wrong crops):
  art2/cyc/<hero>_idle.png    1 row, 4 equal cells  (breathing loop)
  art2/cyc/<hero>_walk.png    1 row, 6 equal cells  (loopable walk cycle)
  art2/cyc/<hero>_attack.png  1 row, 4 equal cells  (strike sequence)
  art2/cyc/<hero>_power.png   1 row, 4 equal cells  (charge -> burst)
  art2/icon_<hero>.png        single centred character
  art2/bling_<hero>.png       single centred back-bling item

Everything then goes through the v1 finishers (premultiplied BOX downscale,
flat per-hero palette, uniform 1px outline, ground-anchored 48px framing),
so frames stay crisp at 5-7x in-game upscale and loops hold their footing.
"""
import os
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_ai_assets as M

ART2 = os.path.join(M.ROOT, 'art2')
CYCLES = [('idle', 6), ('walk', 6), ('attack', 6), ('ability', 6)]
# one sheet per hero: 6 rows x 6 cols of EQUAL cells, row-major cell map:
#  r0 idle1-4 jump1-2 | r1 walk1-6 | r2 fall1-2 land1-2 attack1-2
#  r3 attack3-4 hurt1-2 death1-2 | r4 death3-4 ability1-4 | r5 ability5-6 sense1-4
# ONE generated sheet per hero (same character/style guaranteed):
# art2/hero_<id>.png = 4 rows x 6 cols = 24 equal cells, transparent or
# chroma-key backdrop. Extraction is deterministic fixed rects only.
SHEET_ROWS = [(0, [('idle', i, i) for i in range(6)]),
              (1, [('walk', i, i) for i in range(6)]),
              (2, [('attack', i, i) for i in range(6)]),
              (3, [('ability', i, i) for i in range(6)])]
CELLMAP = [(cyc, f) for _, items in SHEET_ROWS for cyc, f, _ in items]
# strip output order = ANIMS starts: idle0 walk6 attack12 ability18
STRIP_ORDER = ([(('idle'), i) for i in range(6)] + [('walk', i) for i in range(6)]
               + [('attack', i) for i in range(6)] + [('ability', i) for i in range(6)])
# 12 back blings live in ONE sheet: art2/bling_sheet.png = 3 rows x 4 cols
BLING_ROWS, BLING_COLS = 3, 4
DY = {'walk': M.WALK_BOB}
BLING_OF = {
    'spiderman': 'glider_h_spider', 'venom': 'glider_h_venom',
    'capamerica': 'glider_h_cap', 'ironman': 'glider_h_iron',
    'hulk': 'glider_h_hulk', 'wolverine': 'glider_h_wolverine',
    'antman': 'glider_h_antman', 'blackpanther': 'glider_h_panther',
    'drstrange': 'glider_h_strange',
}


def has_art2(hid):
    return os.path.exists(os.path.join(ART2, 'hero_%s.png' % hid))


def load_rgba(path):
    im = Image.open(path).convert('RGBA')
    return np.array(im)


def sprite_mask(rgba):
    """Mask from REAL alpha when the source carries transparency, else fall
    back to the flat-backdrop modal key (magenta/white)."""
    a = rgba[:, :, 3]
    if (a == 0).sum() > 0.15 * a.size and (a > 200).sum() > 0.01 * a.size:
        return a > 127
    return mask_of(rgba[:, :, :3])


def load_rgb(path):
    return np.array(Image.open(path).convert('RGB'))


def mask_of(rgb):
    """Robust mask for flat/checked backdrops: background = the dominant
    backdrop buckets (flat colour OR fake-transparency checkerboard / soft
    gradient, which together cover most of the sheet). Sprite = pixels far
    from every backdrop bucket AND far from the white divider grid; largest
    blob kept, holes filled, thin ground bars dropped."""
    from scipy import ndimage as ndi
    h, w, _ = rgb.shape
    q = (rgb // 24).astype(np.int32).reshape(-1, 3)
    keys, counts = np.unique(q, axis=0, return_counts=True)
    order = np.argsort(-counts)
    total = counts.sum()
    bks, cum = [], 0.0
    for i2 in order:                       # cumulative backdrop buckets
        share = counts[i2] / total
        if share < 0.12:
            break
        bks.append(keys[i2]); cum += share
        if cum > 0.55:
            break
    if not bks:
        bks = [keys[order[0]]]
    centres = np.array([k * 24 + 12 for k in bks], np.int32)
    d = np.abs(rgb.astype(np.int32)[:, :, None, :] - centres[None, None, :, :]).max(axis=3).min(axis=2)
    dw = np.abs(rgb.astype(np.int32) - 255).max(axis=2)
    m = (d > 16) & (dw > 28)   # tight tolerance keeps outlines
    if m.sum() < 0.02 * m.size or m.sum() > 0.6 * m.size:
        m = (d > 28) & (dw > 28)  # fallback if the sheet came out gradient-y
    for y in range(h):  # thin full-width ground bars
        if m[y].mean() > 0.85:
            m[y] = False
    for x in range(w):  # thin full-height divider bars
        if m[:, x].mean() > 0.85:
            m[:, x] = False
    lab, n = ndi.label(m, structure=np.ones((3, 3), int))
    if n > 1:
        sizes = ndi.sum(m, lab, range(1, n + 1))
        m = lab == (int(np.argmax(sizes)) + 1)
    m = ndi.binary_fill_holes(m)
    return m


def load_rgba(path):
    im = Image.open(path).convert('RGBA')
    return np.array(im)


def sprite_mask(rgba):
    """Mask from REAL alpha when the source carries transparency, else fall
    back to the flat-backdrop modal key (magenta/white)."""
    a = rgba[:, :, 3]
    if (a == 0).sum() > 0.15 * a.size and (a > 200).sum() > 0.01 * a.size:
        return a > 127
    return mask_of(rgba[:, :, :3])


def load_rgb(path):
    return np.array(Image.open(path).convert('RGB'))


def mask_of(rgb):
    """Robust mask for the flat-backdrop art2 sheets: background = median of
    the border pixels (navy or divider white), sprite = anything far from it
    AND far from pure white (dividers); largest blob, holes filled (eyes and
    lenses are enclosed so they come back), thin ground bars dropped."""
    from scipy import ndimage as ndi
    h, w, _ = rgb.shape
    q = (rgb // 24).astype(np.int32).reshape(-1, 3)
    keys, counts = np.unique(q, axis=0, return_counts=True)
    bk = keys[np.argmax(counts)]
    sel = (q == bk).all(axis=1).reshape(h, w)
    bg = rgb[sel].mean(axis=0)  # modal backdrop colour (navy or white)
    d = np.abs(rgb.astype(np.int32) - bg.astype(np.int32)).max(axis=2)
    dw = np.abs(rgb.astype(np.int32) - 255).max(axis=2)
    m = (d > 16) & (dw > 28)   # flat backdrop: tight tolerance keeps outlines
    if m.sum() < 0.02 * m.size or m.sum() > 0.6 * m.size:
        m = (d > 28) & (dw > 28)  # fallback if the sheet came out gradient-y
    for y in range(h):  # thin full-width ground bars
        if m[y].mean() > 0.85:
            m[y] = False
    for x in range(w):  # thin full-height divider bars
        if m[:, x].mean() > 0.85:
            m[:, x] = False
    lab, n = ndi.label(m)
    if n:
        sizes = ndi.sum(m, lab, range(1, n + 1))
        m = lab == (np.argmax(sizes) + 1)
    m = ndi.binary_fill_holes(m)
    m = ndi.binary_closing(m, np.ones((3, 3)))
    return m


def main_row(rgb):
    """Keep only the tallest horizontal band of art (generated sheets can
    grow extra reference rows); drops them before equal-cell slicing."""
    m = mask_of(rgb)
    proj = m.sum(axis=1)
    bands, y0 = [], None
    for y, v in enumerate(proj > max(2, proj.max() * 0.02)):
        if v and y0 is None:
            y0 = y
        elif not v and y0 is not None:
            bands.append((y0, y)); y0 = None
    if y0 is not None:
        bands.append((y0, len(proj)))
    if not bands:
        return rgb
    a, b = max(bands, key=lambda t: t[1] - t[0])
    return rgb[a:b]


KEY_COLOR = np.array([255, 0, 255], np.int32)  # chroma-key backdrop


def inpaint_key_leaks(rgb, m):
    """Models sometimes paint the chroma key INSIDE the character (accents,
    glows). Those pixels would survive as opaque magenta or leave holes.
    Deterministic repair: recolor key-ish pixels inside the sprite blob with
    the nearest non-key sprite colour (nearest-neighbour fill, pixel-safe)."""
    from scipy import ndimage as ndi
    kd = np.abs(rgb.astype(np.int32) - KEY_COLOR).max(axis=2)
    keyish = (kd < 96) & m
    if not keyish.any():
        return rgb
    known = m & ~keyish
    if not known.any():
        return rgb
    _, inds = ndi.distance_transform_edt(~known, return_indices=True)
    out = rgb.copy()
    out[keyish] = out[inds[0][keyish], inds[1][keyish]]
    return out


def keyed_cut_rgba(rgba):
    """Tight-bbox RGBA crop of one RGBA cell (alpha or keyed backdrop)."""
    m = sprite_mask(rgba)
    if m.sum() < 64:
        return None
    rgb = inpaint_key_leaks(rgba[:, :, :3], m)
    ys, xs = np.where(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return np.dstack([rgb[y0:y1, x0:x1],
                      np.where(m[y0:y1, x0:x1], 255, 0).astype(np.uint8)])


def keyed_cut(rgb):
    """Tight-bbox RGBA crop of one cell / image."""
    m = mask_of(rgb)
    if m.sum() < 64:
        return None
    rgb = inpaint_key_leaks(rgb, m)
    ys, xs = np.where(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return np.dstack([rgb[y0:y1, x0:x1],
                      np.where(m[y0:y1, x0:x1], 255, 0).astype(np.uint8)])


def fixed_cells(rgb, n):
    w = rgb.shape[1] // n
    return [rgb[:, i * w:(i + 1) * w] for i in range(n)]


def centre_on(px, canvas):
    h, w = px.shape[:2]
    out = np.zeros((canvas, canvas, 4), np.uint8)
    y0, x0 = (canvas - h) // 2, (canvas - w) // 2
    out[y0:y0 + h, x0:x0 + w] = px
    return out


def _cell_cut(rgba, band_y0, band_y1, cellx, gw, w):
    """Fixed-rect cell extraction with deterministic straddle repair: the
    frame rectangle never changes, but when the generator draws a pose
    across a grid line we attribute the whole connected character blob to
    the cell it overlaps most (searched in a +-half-cell window), so frames
    are never sliced in half."""
    from scipy import ndimage as ndi
    x0 = max(0, cellx - gw // 2)
    x1 = min(w, cellx + gw + gw // 2)
    win = rgba[band_y0:band_y1, x0:x1]
    m = sprite_mask(win)
    if m.sum() < 64:
        return None
    lab, n = ndi.label(m, structure=np.ones((3, 3), int))
    if n == 0:
        return None
    cx0, cx1 = cellx - x0, min(x1, cellx + gw) - x0
    best, bestov = None, 0
    for k in range(1, n + 1):
        ov = int((lab[:, cx0:cx1] == k).sum())
        if ov > bestov:
            best, bestov = k, ov
    if best is None or bestov < 64:
        m2 = m[:, cx0:cx1]
        if m2.sum() < 64:
            return None
        best = None
        m = m2
        win = win[:, cx0:cx1]
    if best is not None:
        m = lab == best
    ys, xs = np.where(m)
    y0, y1 = ys.min(), ys.max() + 1
    x0b, x1b = xs.min(), xs.max() + 1
    rgb = inpaint_key_leaks(win[:, :, :3], m)
    return np.dstack([rgb[y0:y1, x0b:x1b],
                      np.where(m[y0:y1, x0b:x1b], 255, 0).astype(np.uint8)])


def build_hero(hid):
    rgba = load_rgba(os.path.join(ART2, 'hero_%s.png' % hid))
    h, w = rgba.shape[:2]
    gh, gw = h // 4, w // 6
    cuts = {}
    for r, items in SHEET_ROWS:
        for cyc, f, col in items:
            cuts[(cyc, f)] = _cell_cut(rgba, r * gh, (r + 1) * gh, col * gw, gw, w)
    cuts_by_cyc = {}
    for cyc, n in CYCLES:
        cells = [cuts.get((cyc, f)) for f in range(n)]
        for f, c in enumerate(cells):  # repair garbage cells deterministically
            if c is not None and c.shape[0] >= 24 and c[:, :, 3].sum() > 24 * 400:
                continue
            def _valid(j):
                cj = cells[j]
                return cj is not None and cj.shape[0] >= 24
            near = next((cells[j] for j in range(f + 1, n) if _valid(j)), None)
            if near is None:
                near = next((cells[j] for j in range(f - 1, -1, -1) if _valid(j)), None)
            print('    ! %s %s f%d cell unreadable -> nearest valid frame' % (hid, cyc, f))
            cells[f] = near if near is not None else c
        cuts_by_cyc[cyc] = cells
    allcuts = [c for cyc, _ in CYCLES for c in cuts_by_cyc[cyc]]
    assert len(STRIP_ORDER) == 24
    pal = M.hero_palette(allcuts)

    tallest = max(c.shape[0] for c in allcuts)
    ratio = max(2, int(round(tallest / M.TARGET_H)))

    strip = np.zeros((M.FRAME, M.FRAME * 24, 4), np.uint8)
    for i, (cyc, f) in enumerate(STRIP_ORDER):
        px = M.scale_px(cuts_by_cyc[cyc][f], ratio, pal)
        dy = (DY.get(cyc) or [0] * 8)[f % 8]
        strip[:, i * M.FRAME:(i + 1) * M.FRAME] = M.place(px, dy=dy, pal=pal)
    Image.fromarray(strip, 'RGBA').save(os.path.join(M.ANIM, hid + '.png'))

    print('  -> %s  [art2] ratio %d' % (hid, ratio))


def build_blings():
    src = os.path.join(ART2, 'bling_sheet.png')
    if not os.path.exists(src):
        return 0
    import json
    cat = json.load(open(os.path.join(M.PUB, 'data', 'catalog.json')))
    rgba = load_rgba(src)
    h, w = rgba.shape[:2]
    gh, gw = h // BLING_ROWS, w // BLING_COLS
    n = 0
    for idx, g in enumerate(cat['gliders']):
        r, c = divmod(idx, BLING_COLS)
        if r >= BLING_ROWS:
            break
        cell = rgba[r * gh:(r + 1) * gh, c * gw:(c + 1) * gw]
        cut = keyed_cut_rgba(cell)
        if cut is None:
            print('  ! bling cell %d (%s) unreadable' % (idx, g['id']))
            continue
        pal = M.hero_palette([cut], n=12)
        r_i = max(1, -(-cut.shape[0] // M.ICON_MAX), -(-cut.shape[1] // M.ICON_MAX))
        px = M.scale_px(cut, r_i, pal) if r_i > 1 else cut
        Image.fromarray(M.place(px, ground=93, canvas=M.ICON_CANVAS, pal=pal),
                        'RGBA').save(os.path.join(M.SPR, g['id'] + '.png'))
        r_b = max(2, int(round(cut.shape[0] / 28)))
        small = M.scale_px(cut, r_b, pal)
        if small.shape[0] > 32 or small.shape[1] > 32:
            small = M._squeeze(small, min(small.shape[1], 32), min(small.shape[0], 32), pal)
        Image.fromarray(centre_on(small, 32), 'RGBA').save(os.path.join(M.ANIM, g['id'] + '.png'))
        print('  -> %s  [bling sheet cell %d]' % (g['id'], idx))
        n += 1
    return n


def main():
    import json
    heroes = [h['id'] for h in json.load(open(os.path.join(M.PUB, 'data', 'catalog.json')))['heroes']]
    done = 0
    for hid in heroes:
        if has_art2(hid):
            build_hero(hid)
            done += 1
    nb = build_blings()
    print('done: %d heroes rebuilt, %d blings built.' % (done, nb))


if __name__ == '__main__':
    main()
