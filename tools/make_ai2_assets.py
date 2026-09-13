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
CYCLES = [('idle', 6), ('walk', 6), ('attack', 6), ('ability', 6), ('jump', 2),
          ('fall', 2), ('land', 2), ('hurt', 2), ('death', 4), ('sense', 6)]
# one sheet per hero: 6 rows x 6 cols of EQUAL cells, row-major cell map:
#  r0 idle1-4 jump1-2 | r1 walk1-6 | r2 fall1-2 land1-2 attack1-2
#  r3 attack3-4 hurt1-2 death1-2 | r4 death3-4 ability1-4 | r5 ability5-6 sense1-4
# Generation is chunked into 3 simple grids (reliable for the image model);
# the pipeline stitches them into ONE master sheet art2/sheet_<hero>.png
# (7 rows x 6 cols = 42 equal cells) which is the single source of truth.
CHUNKS = [  # (file, rows, cellmap rows: list of (row, [(cyc,frame,col)...]))
    ('s1', 2, [(0, [('idle', i, i) for i in range(6)]),
               (1, [('walk', i, i) for i in range(6)])]),
    ('s2', 2, [(0, [('attack', i, i) for i in range(6)]),
               (1, [('ability', i, i) for i in range(6)])]),
    ('s3', 3, [(0, [('jump', 0, 0), ('jump', 1, 1), ('fall', 0, 2), ('fall', 1, 3),
                    ('land', 0, 4), ('land', 1, 5)]),
               (1, [('hurt', 0, 0), ('hurt', 1, 1), ('death', 0, 2), ('death', 1, 3),
                    ('death', 2, 4), ('death', 3, 5)]),
               (2, [('sense', i, i) for i in range(6)])]),
]
CELLMAP = [(cyc, f) for _, _, rows in CHUNKS for _, items in rows for cyc, f, _ in items]
# strip output order = ANIMS starts: idle0 walk6 attack12 ability18 jump24 fall26 land28 hurt30 death32 sense36
STRIP_ORDER = ([(('idle'), i) for i in range(6)] + [('walk', i) for i in range(6)]
               + [('attack', i) for i in range(6)] + [('ability', i) for i in range(6)]
               + [('jump', i) for i in range(2)] + [('fall', i) for i in range(2)]
               + [('land', i) for i in range(2)] + [('hurt', i) for i in range(2)]
               + [('death', i) for i in range(4)] + [('sense', i) for i in range(6)])
DY = {'walk': M.WALK_BOB, 'jump': [-3, -7], 'fall': [-9, -7], 'land': [-2, 0]}
BLING_OF = {
    'spiderman': 'glider_h_spider', 'venom': 'glider_h_venom',
    'capamerica': 'glider_h_cap', 'ironman': 'glider_h_iron',
    'hulk': 'glider_h_hulk', 'wolverine': 'glider_h_wolverine',
    'antman': 'glider_h_antman', 'blackpanther': 'glider_h_panther',
    'drstrange': 'glider_h_strange',
}


def has_art2(hid):
    return os.path.exists(os.path.join(ART2, 's1_%s.png' % hid))


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


def build_hero(hid):
    chunks = []
    for name, rows, rowmap in CHUNKS:
        pth = os.path.join(ART2, '%s_%s.png' % (name, hid))
        if not os.path.exists(pth):
            print('  (skip %s: missing %s)' % (hid, os.path.basename(pth)))
            return False
        chunks.append((name, rows, rowmap, load_rgb(pth)))
    # stitch the single master sheet: 7 rows x 6 cols of equal cells
    ch = max(img.shape[0] // rows for _, rows, _, img in chunks)
    cw = max(img.shape[1] // 6 for _, _, _, img in chunks)
    master = np.zeros((ch * 7, cw * 6, 3), np.uint8)
    cuts = {}
    mr = 0
    for name, rows, rowmap, img in chunks:
        gh, gw = img.shape[0] // rows, img.shape[1] // 6
        for r, items in rowmap:
            for cyc, f, col in items:
                cell_img = img[r * gh:(r + 1) * gh, col * gw:(col + 1) * gw]
                tile = master[(mr + r) * ch:(mr + r + 1) * ch, col * cw:(col + 1) * cw]
                th, tw = tile.shape[0], tile.shape[1]
                tile[:min(ch, cell_img.shape[0]), :min(cw, cell_img.shape[1])] = \
                    cell_img[:min(ch, cell_img.shape[0]), :min(cw, cell_img.shape[1])]
                cuts[(cyc, f)] = keyed_cut(cell_img)
        mr += rows
    Image.fromarray(master).save(os.path.join(ART2, 'sheet_%s.png' % hid))
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
    assert len(STRIP_ORDER) == 42
    pal = M.hero_palette(allcuts)

    tallest = max(c.shape[0] for c in allcuts)
    ratio = max(2, int(round(tallest / M.TARGET_H)))

    strip = np.zeros((M.FRAME, M.FRAME * 42, 4), np.uint8)
    for i, (cyc, f) in enumerate(STRIP_ORDER):
        px = M.scale_px(cuts_by_cyc[cyc][f], ratio, pal)
        dy = (DY.get(cyc) or [0] * 8)[f % 8]
        strip[:, i * M.FRAME:(i + 1) * M.FRAME] = M.place(px, dy=dy, pal=pal)
    Image.fromarray(strip, 'RGBA').save(os.path.join(M.ANIM, hid + '.png'))

    print('  -> %s  [art2] ratio %d' % (hid, ratio))


def build_bling(hid):
    gid = BLING_OF[hid]
    src = os.path.join(ART2, 'bling_%s.png' % hid)
    if not os.path.exists(src):
        return
    c = keyed_cut(load_rgb(src))
    pal = M.hero_palette([c], n=12)
    # shop icon (96px, grounded like the rest)
    r_i = max(1, -(-c.shape[0] // M.ICON_MAX))
    px = M.scale_px(c, r_i, pal) if r_i > 1 else M._flat(c[:, :, :3], c[:, :, 3] > 0, pal)
    Image.fromarray(M.place(px, ground=93, canvas=M.ICON_CANVAS, pal=pal),
                    'RGBA').save(os.path.join(M.SPR, gid + '.png'))
    # native 32px back-bling sprite for the animator
    r_b = max(2, int(round(c.shape[0] / 28)))
    small = M.scale_px(c, r_b, pal)
    if small.shape[0] > 32 or small.shape[1] > 32:
        small = M._squeeze(small, min(small.shape[1], 32), min(small.shape[0], 32), pal)
    Image.fromarray(centre_on(small, 32), 'RGBA').save(os.path.join(M.ANIM, gid + '.png'))
    print('  -> %s  [art2 bling]' % gid)


def main():
    import json
    heroes = [h['id'] for h in json.load(open(os.path.join(M.PUB, 'data', 'catalog.json')))['heroes']]
    done = 0
    for hid in heroes:
        if has_art2(hid):
            build_hero(hid)
            build_bling(hid)
            done += 1
    print('done: %d heroes rebuilt from art2 sheets.' % done)


if __name__ == '__main__':
    main()
