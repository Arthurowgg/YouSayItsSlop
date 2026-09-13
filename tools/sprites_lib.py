#!/usr/bin/env python3
"""sprites_lib - shared sprite slicing/extraction library (pipeline v3).

Design rules (see docs/SPRITE_SPEC.md):
  * the AI sheets live in art2/ and are ONE sheet per hero: 4 rows
    (idle / walk / attack / special) x N columns of poses on a FLAT
    magenta #FF00FF backdrop, one single generated image per hero so the
    character style can never drift between frames;
  * extraction is done by CONNECTED BLOBS, never by naive equal-cell
    division: the generator is sloppy about cell borders, and blob
    detection is what fixes the "cropped wrong" bug (hulk's head/feet
    cut off, straddling poses, etc.);
  * every sprite is downscaled by an INTEGER factor with a majority-vote
    filter (keeps 1px outlines, never averages colors => no blur);
  * all frames of a row share one ground line, all rows share one scale.

Only pillow + numpy (+ scipy for labelling) are used.
"""
import os
import numpy as np
from PIL import Image

try:
    from scipy import ndimage
except Exception:  # pragma: no cover - scipy is installed by build_assets.sh
    ndimage = None

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ART2 = os.path.join(ROOT, 'art2')
OUT_SPR = os.path.join(ROOT, 'public', 'assets', 'spr')
OUT_ANIM = os.path.join(ROOT, 'public', 'assets', 'anim')
OUT_DATA = os.path.join(ROOT, 'public', 'data')

FRAME = 112         # output frame size (px). The app renders integer-scaled.
FOOT = FRAME - 6     # ground line inside the frame
BG_TOL = 70          # max-channel distance from the backdrop colour = sprite
MIN_BLOB = 48        # ignore specks smaller than this
ANIMS = ['idle', 'walk', 'attack', 'ability']
DEF_FPS = {'idle': 4, 'walk': 9, 'attack': 10, 'ability': 8}


# --------------------------------------------------------------------------
# backdrop / mask
# --------------------------------------------------------------------------
def border_color(rgb):
    """Modal colour of the border ring = the flat backdrop."""
    h, w = rgb.shape[:2]
    b = 4
    ring = np.concatenate([
        rgb[:b].reshape(-1, 3), rgb[-b:].reshape(-1, 3),
        rgb[:, :b].reshape(-1, 3), rgb[:, -b:].reshape(-1, 3)])
    q = (ring // 8 * 8).astype(np.int32)
    keys, counts = np.unique(q, axis=0, return_counts=True)
    return keys[counts.argmax()], counts.max() / len(ring)


def foreground(rgb, tol=BG_TOL):
    """Boolean sprite mask.

    The backdrop is modelled PER ROW from the border columns: flat fills and
    vertical gradients (the classic AI sheet background) are both keyed out,
    while a dark character (a black symbiote, a black panther suit) on a dark
    backdrop still survives - the old pipeline kept whole background
    rectangles for those heroes."""
    h, w = rgb.shape[:2]
    a = rgb.astype(np.int32)
    b = max(2, w // 64)
    edge = np.concatenate([a[:, :b], a[:, -b:]], axis=1)          # (h, 2b, 3)
    rowbg = np.median(edge, axis=1)                                # (h, 3)
    d = np.abs(a - rowbg[:, None, :]).max(axis=2)
    m = d > tol
    # flat-colour pass: near-uniform fills that reach the border are backdrop
    bg, share = border_color(rgb)
    if share > 0.35:
        m &= np.abs(a - bg[None, None, :]).max(axis=2) > tol
    # drop rows/columns of noise: keep the largest connected component only
    return m, bg


def silhouette(rgb, tol=26, close=2):
    """Character silhouette, robust for dark heroes on dark sheets.

    A black symbiote on a navy backdrop shares the backdrop colour, so colour
    keying alone cannot separate it. Those sheets draw a light outline around
    the body, so: threshold close to the backdrop -> close the gaps of the
    outline -> FILL the enclosed holes. The body (whatever its colour) ends
    up inside the silhouette; the backdrop outside it is dropped."""
    h, w = rgb.shape[:2]
    a = rgb.astype(np.int32)
    b = max(2, w // 64)
    edge = np.concatenate([a[:, :b], a[:, -b:]], axis=1)
    rowbg = np.median(edge, axis=1)
    d = np.abs(a - rowbg[:, None, :]).max(axis=2)
    m = d > tol
    if close:
        m = ndimage.binary_closing(m, structure=np.ones((3, 3)), iterations=close)
    m = ndimage.binary_fill_holes(m)
    lab, n = ndimage.label(m, structure=np.ones((3, 3), int))
    if n == 0:
        return m, rowbg
    sizes = ndimage.sum(m, lab, np.arange(1, n + 1))
    keep = [i + 1 for i, sz in enumerate(sizes) if sz >= MIN_BLOB]
    m = np.isin(lab, keep)
    return m, rowbg


def bands_by_projection(mask, want=4):
    """Split the sheet into `want` horizontal bands using the empty rows
    between pose blocks (projection valleys). More robust than fixed-cell
    division: a pose that pokes over an imaginary row line is never cut."""
    prof = mask.any(axis=1)
    ys = np.where(prof)[0]
    if len(ys) == 0:
        return []
    runs, start, prev = [], ys[0], ys[0]
    for y in ys[1:]:
        if y - prev > 2:
            runs.append((start, prev + 1))
            start = y
        prev = y
    runs.append((start, prev + 1))
    if len(runs) <= want:
        return runs
    # merge the smallest gaps until only `want` bands remain
    while len(runs) > want:
        gaps = [(runs[i + 1][0] - runs[i][1], i) for i in range(len(runs) - 1)]
        g, i = min(gaps)
        runs[i] = (runs[i][0], runs[i + 1][1])
        del runs[i + 1]
    return runs


def label_blobs(mask):
    lab, n = ndimage.label(mask, structure=np.ones((3, 3), int))
    if n == 0:
        return lab, []
    sizes = ndimage.sum(mask, lab, np.arange(1, n + 1))
    keep = [int(i) for i, s in zip(np.arange(1, n + 1), sizes) if s >= MIN_BLOB]
    return lab, keep


def blob_info(lab, keep):
    """centroid + bbox + area for each kept blob (one find_objects pass)."""
    if not keep:
        return []
    slices = ndimage.find_objects(lab, max(keep))
    want = set(keep)
    out = []
    for k, sl in enumerate(slices, start=1):
        if k not in want or sl is None:
            continue
        ys, xs = sl
        area = int((lab[sl] == k).sum())
        out.append({
            'id': k, 'area': area,
            'x0': xs.start, 'x1': xs.stop, 'y0': ys.start, 'y1': ys.stop,
            'cx': (xs.start + xs.stop) / 2, 'cy': (ys.start + ys.stop) / 2,
        })
    return out


def group_rows(blobs, rows=4):
    """Split blobs into `rows` bands by their centroid y (gap based)."""
    if len(blobs) <= rows:
        return sorted([blobs], key=lambda b: min(x['cy'] for x in b)) if blobs else []
    s = sorted(blobs, key=lambda b: b['cy'])
    gaps = [(s[i + 1]['cy'] - s[i]['cy'], i) for i in range(len(s) - 1)]
    cut = sorted(sorted(gaps, reverse=True)[:rows - 1], key=lambda g: g[1])
    bands, prev = [], 0
    for _, i in cut:
        bands.append(s[prev:i + 1])
        prev = i + 1
    bands.append(s[prev:])
    return bands


def group_cols(blobs, want=None):
    """Split a row band into the actual POSES drawn in it.

    The generator is not pixel-exact about cell borders - that is exactly
    what produced the old "cropped hulk" bug, and it is also why we never
    force a fixed 6-column cut: some rows come out with 5, 6 or 7 poses.
    Method: count the *bodies* (blobs >= 35% of the row's biggest blob),
    then assign every other blob (sparks, flames, debris) to its nearest
    body, so an effect always travels with the pose it belongs to."""
    if not blobs:
        return []
    mx = max(b['area'] for b in blobs)
    bodies = sorted([b for b in blobs if b['area'] >= 0.35 * mx], key=lambda b: b['cx'])
    if not bodies:
        bodies = [max(blobs, key=lambda b: b['area'])]
    if want and len(bodies) > want:      # too many: keep the biggest ones
        bodies = sorted(sorted(bodies, key=lambda b: -b['area'])[:want], key=lambda b: b['cx'])
    groups = [[] for _ in bodies]
    for b in blobs:
        i = min(range(len(bodies)), key=lambda k: abs(bodies[k]['cx'] - b['cx']))
        groups[i].append(b)
    return groups


# --------------------------------------------------------------------------
# pixel-art downscale (integer factor, majority vote, no colour smearing)
# --------------------------------------------------------------------------
def downscale_block(rgba, f):
    """Integer downscale by f with a majority vote per block.

    Hard edges stay hard and 1px outlines survive: for each f*f block we pick
    the most frequent colour among the opaque pixels (counting only pixels
    whose alpha is >= half) and keep that exact colour - never an average."""
    if f <= 1:
        return rgba.copy()
    h, w = rgba.shape[:2]
    h2, w2 = h // f, w // f
    if h2 == 0 or w2 == 0:
        return rgba.copy()
    crop = rgba[:h2 * f, :w2 * f]
    blocks = crop.reshape(h2, f, w2, f, 4).transpose(0, 2, 1, 3, 4).reshape(h2 * w2, f * f, 4)
    out = np.zeros((h2 * w2, 4), np.uint8)
    for i, blk in enumerate(blocks):
        solid = blk[blk[:, 3] >= 128]
        if len(solid) == 0:
            continue
        if len(solid) * 2 < f * f:            # mostly transparent block
            continue
        q = (solid[:, :3] >> 3).astype(np.int32)
        key = q[:, 0] * 4096 + q[:, 1] * 64 + q[:, 2]
        vals, counts = np.unique(key, return_counts=True)
        pick = vals[counts.argmax()]
        sel = solid[key == pick]
        out[i] = np.median(sel, axis=0).astype(np.uint8)
    return out.reshape(h2, w2, 4)


def cut_rgba(rgb, mask, bg, box, f):
    """Cut one frame region, key the backdrop to alpha, downscale by f.

    `bg` may be a single colour or one backdrop colour per sheet row."""
    x0, y0, x1, y1 = box
    sub = rgb[y0:y1, x0:x1].astype(np.int32)
    m = mask[y0:y1, x0:x1]
    b = np.asarray(bg, dtype=np.int32)
    if b.ndim == 2 and b.shape[0] == rgb.shape[0]:
        b = b[y0:y1]
    else:
        b = np.asarray(b).reshape(-1, 3)[0][None, :]
    d = np.abs(sub - b[:, None, :]).max(axis=2)
    # alpha: the silhouette, grown 1px so the art's own anti-aliased rim is
    # kept (the pixel-art downscale below re-hardens it)
    grown = ndimage.binary_dilation(m, iterations=1) if m.any() else m
    alpha = np.where(grown & (d > BG_TOL * 0.30), 255, 0).astype(np.uint8)
    sub = np.clip(sub, 0, 255).astype(np.uint8)
    rgba = np.dstack([sub, alpha])
    # drop key-colour pixels that survived inside the blob (halo cleanup)
    leak = m & (d <= BG_TOL * 0.55)
    if leak.any():
        rgba[leak, 3] = 0
    return downscale_block(rgba, f)


def key_plate(rgba, tol=16, min_share=0.08):
    """Remove the backdrop that is baked INSIDE the cut box.

    Handles both cases seen in the AI sheets: a single flat plate panel, and
    a two-tone checkerboard of fake transparency. The backdrop colours are
    read from the border ring of the cut (top buckets); any region within
    tolerance of one of them that TOUCHES the border is erased. The character
    survives even when its suit is dark, because its own outline is near-black
    and its interior flat colours never reach the border."""
    a = rgba[:, :, 3] > 0
    if not a.any():
        return rgba
    b = max(2, min(rgba.shape[0], rgba.shape[1]) // 32)
    ring = np.concatenate([rgba[:b].reshape(-1, 4), rgba[-b:].reshape(-1, 4),
                           rgba[:, :b].reshape(-1, 4), rgba[:, -b:].reshape(-1, 4)])
    ring = ring[ring[:, 3] > 0][:, :3]
    if len(ring) < 8:
        return rgba
    q = (ring // 8 * 8)
    keys, counts = np.unique(q, axis=0, return_counts=True)
    order = np.argsort(-counts)
    buckets = [keys[i].astype(np.int32) for i in order
               if counts[i] >= max(4, len(ring) * min_share)][:3]
    if not buckets:
        return rgba
    near = np.zeros(a.shape, bool)
    for bk in buckets:
        near |= np.abs(rgba[:, :, :3].astype(np.int32) - bk[None, None, :]).max(axis=2) <= tol
    near &= a
    if not near.any():
        return rgba
    lab, n = ndimage.label(near, structure=np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]]))
    if n == 0:
        return rgba
    border = np.zeros_like(near)
    border[0, :] = border[-1, :] = True
    border[:, 0] = border[:, -1] = True
    kill = set(np.unique(lab[border & near]).tolist()) - {0}
    if not kill:
        return rgba
    doomed = np.isin(lab, list(kill))
    if doomed.sum() > 0.9 * a.sum():          # never erase the whole pose
        return rgba
    rgba = rgba.copy()
    rgba[doomed] = 0
    return rgba


def pad_frame(rgba, cx, foot):
    """Place a sprite into the FRAME box: horizontal centre on cx, feet on
    `foot`. Nothing is ever cropped away silently - oversized art is scaled
    down by the caller instead."""
    h, w = rgba.shape[:2]
    out = np.zeros((FRAME, FRAME, 4), np.uint8)
    ox = int(round(FRAME / 2 - cx))
    oy = int(round(foot - h))
    sx0, sy0 = max(0, ox), max(0, oy)
    dx0, dy0 = max(0, -ox), max(0, -oy)
    cw = min(w - dx0, FRAME - sx0)
    ch = min(h - dy0, FRAME - sy0)
    if cw <= 0 or ch <= 0:
        return out
    out[sy0:sy0 + ch, sx0:sx0 + cw] = rgba[dy0:dy0 + ch, dx0:dx0 + cw]
    return out


def bounds(rgba):
    a = rgba[:, :, 3] > 0
    if not a.any():
        return None
    ys, xs = np.where(a)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def body_metrics(rgba, main_only=None):
    """feet y + centre x of the *body* (main blob) inside a cut frame."""
    a = rgba[:, :, 3] > 0
    if not a.any():
        return None
    ys, xs = np.where(a)
    # legs = bottom 25% of the sprite -> stable horizontal anchor even when
    # an arm/effect sticks far out to one side
    ymax = ys.max()
    band = ys > ymax - max(4, int((ymax - ys.min() + 1) * 0.25))
    cx = (xs[band].min() + xs[band].max() + 1) / 2 if band.any() else (xs.min() + xs.max() + 1) / 2
    return {'foot': ymax + 1, 'cx': cx, 'top': ys.min()}


def x_segments(mask_band, gap=6, min_area=24, min_width=10):
    """x-projection runs of a band -> [(x0,x1,y0,y1)] pose segments."""
    prof = mask_band.any(axis=0)
    xs = np.where(prof)[0]
    if len(xs) == 0:
        return []
    runs, start, prev = [], xs[0], xs[0]
    for x in xs[1:]:
        if x - prev > gap:
            runs.append((start, prev + 1))
            start = x
        prev = x
    runs.append((start, prev + 1))
    out = []
    for (x0, x1) in runs:
        if (x1 - x0) < min_width:      # sheet separator line / stray sliver
            continue
        sub = mask_band[:, x0:x1]
        ys = np.where(sub.any(axis=1))[0]
        if len(ys) == 0 or int(sub.sum()) < min_area:
            continue
        if len(out) and (x0 - out[-1][1]) <= gap + 4 and (x1 - x0) < (out[-1][1] - out[-1][0]) * 0.5:
            px0, px1, py0, py1 = out[-1]           # very narrow run: an fx spark
            out[-1] = (px0, x1, min(py0, int(ys.min())), max(py1, int(ys.max()) + 1))
            continue
        out.append((x0, x1, int(ys.min()), int(ys.max()) + 1))
    return out


def cut_metrics(rgb, mask, bg, box, f):
    """Cut one pose region -> (rgba, feet_y, centre_x).

    feet = bottom of the LARGEST blob of the cut (debris/shockwaves lying on
    the floor can never drag the ground line); centre_x = horizontal middle
    of the legs band, so an extended punch arm does not shift the body."""
    rgba = cut_rgba(rgb, mask, bg, box, f)
    a = rgba[:, :, 3] > 0
    if not a.any():
        return rgba, rgba.shape[0], rgba.shape[1] / 2
    lab, keep = label_blobs(a)
    if keep:
        biggest = max(keep, key=lambda k: int((lab == k).sum()))
        ys, xs = np.where(lab == biggest)
    else:
        ys, xs = np.where(a)
    ymax = int(ys.max())
    band = ys > ymax - max(3, int((ymax - ys.min() + 1) * 0.25))
    cx = (xs[band].min() + xs[band].max() + 1) / 2 if band.any() else (xs.min() + xs.max() + 1) / 2
    rgba = drop_rules(rgba, lab, keep, biggest)
    return rgba, ymax + 1, float(cx)


def drop_rules(rgba, lab, keep, biggest):
    """Erase leftovers of the sheet chrome: thin vertical rules (the panel
    separators) and dust specks that are not part of the pose."""
    if not keep:
        return rgba
    h = rgba.shape[0]
    doomed = []
    for k in keep:
        if k == biggest:
            continue
        ys, xs = np.where(lab == k)
        w = xs.max() - xs.min() + 1
        hh = ys.max() - ys.min() + 1
        if w <= 2 and hh >= h * 0.35:
            doomed.append(k)                     # vertical separator line
        elif hh <= 2 and w >= rgba.shape[1] * 0.35:
            doomed.append(k)                     # horizontal rule
    if not doomed:
        return rgba
    out = rgba.copy()
    out[np.isin(lab, doomed)] = 0
    return out


def median(vals):
    v = sorted(vals)
    return v[len(v) // 2] if v else 0


# --------------------------------------------------------------------------
# sheet -> frames
# --------------------------------------------------------------------------
def slice_sheet(path, target_h=84, log=print):
    """Full sheet -> {anim: [48..96px RGBA frames]} + diagnostics.

    Returns (frames_by_anim, info) where frames_by_anim[anim] is a list of
    numpy RGBA arrays of size FRAME x FRAME."""
    img = Image.open(path).convert('RGB')
    rgb = np.array(img)
    mask, bg = silhouette(rgb)
    lab, keep = label_blobs(mask)
    blobs = blob_info(lab, keep)
    if not blobs:
        raise SystemExit('%s: no sprite found (backdrop %s)' % (path, bg))
    ybands = bands_by_projection(mask, 4)
    bands = [[b for b in blobs if y0 <= b['cy'] < y1] for (y0, y1) in ybands]
    if not bands or sum(len(b) for b in bands) == 0:
        bands = group_rows(blobs, 4)
    base = np.median(bg, axis=0) if np.ndim(bg) > 1 else bg
    log('  sheet %s  %dx%d  backdrop %s  blobs %d  rows %s'
        % (os.path.basename(path), img.width, img.height, tuple(int(c) for c in base),
           len(blobs), [len(b) for b in bands]))
    if len(bands) != 4:
        log('  ! expected 4 rows, found %d - padding' % len(bands))
        while len(bands) < 4:
            bands.append([])

    # ---- scale: one integer factor for the whole sheet -------------------
    # measured on the BODY (largest blob of each frame), never on flying
    # effects: a shockwave must not shrink the character.
    body_h = []
    for band in bands:
        for grp in group_cols(band):
            main = max(grp, key=lambda b: b['area'])
            body_h.append(main['y1'] - main['y0'])
    med_h = median(body_h) or target_h
    f = max(1, int(round(med_h / float(target_h))))
    # a hero whose body is still taller than the box after rounding: step up
    tallest = max((max(b['y1'] for b in g) - min(b['y0'] for b in g)
                   for band in bands for g in group_cols(band)), default=0)
    while f > 0 and tallest / f > FRAME - 4:
        f += 1
    log('  median body height %dpx -> integer downscale 1/%d' % (med_h, f))

    frames_by_anim = {}
    for ai, anim in enumerate(ANIMS):
        band = bands[ai] if ai < len(bands) else []
        groups = group_cols(band) if band else []
        cuts, feets, cxs = [], [], []
        for grp in groups:
            x0 = min(b['x0'] for b in grp)
            x1 = max(b['x1'] for b in grp)
            y0 = max(0, min(b['y0'] for b in grp) - 2)
            y1 = min(rgb.shape[0], max(b['y1'] for b in grp) + 2)
            rgba, feet, cx = cut_metrics(rgb, mask, bg, (x0, y0, x1, y1), f)
            cuts.append(rgba)
            feets.append(feet)
            cxs.append(cx)
        frames_by_anim[anim] = (cuts, feets, cxs)

    # ---- shared ground line + placement ---------------------------------
    ground = median([fe for anim in ANIMS for fe in frames_by_anim[anim][1]])
    if ground <= 0:
        ground = FRAME
    out = {}
    stats = {}
    for anim in ANIMS:
        cuts, feets, cxs = frames_by_anim[anim]
        frames = []
        for rgba, fe, cx in zip(cuts, feets, cxs):
            # how far the feet sit from the shared ground line; a jump/smash
            # frame is allowed to lift, but never more than 40% of the sheet
            lift = ground - fe
            if anim == 'ability':
                lift = max(-6, min(10, lift))
            else:
                lift = max(-3, min(3, lift))
            frames.append(pad_frame(rgba, cx, FOOT - lift))
        out[anim] = frames
        stats[anim] = len(frames)
    bgbase = np.median(bg, axis=0) if np.ndim(bg) > 1 else bg
    return out, {'scale': f, 'frames': stats, 'bg': [int(c) for c in bgbase]}


# --------------------------------------------------------------------------
# strip assembly + metadata
# --------------------------------------------------------------------------
def strip_of(frames_by_anim, order):
    parts = []
    for anim in order:
        parts.extend(frames_by_anim[anim])
    if not parts:
        return np.zeros((FRAME, FRAME, 4), np.uint8)
    strip = np.concatenate(parts, axis=1)
    return strip


def anim_meta(frames_by_anim, order, fps=None):
    meta, start = {}, 0
    for anim in order:
        n = len(frames_by_anim[anim])
        if n <= 0:
            continue
        meta[anim] = {
            'start': start, 'count': n,
            'fps': (fps or DEF_FPS)[anim],
            'loop': anim in ('idle', 'walk'),
        }
        start += n
    return meta


def save_rgba(arr, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(arr, 'RGBA').save(path, optimize=True)


def load_rgba(path):
    return np.array(Image.open(path).convert('RGBA'))


def fit_icon(rgba, size=96, pad=4):
    """Cut a frame to its alpha bounds and centre it in a size x size icon."""
    b = bounds(rgba)
    if not b:
        return np.zeros((size, size, 4), np.uint8)
    x0, y0, x1, y1 = b
    art = rgba[y0:y1, x0:x1]
    h, w = art.shape[:2]
    scale = min((size - pad * 2) / float(max(w, 1)), (size - pad * 2) / float(max(h, 1)))
    if scale < 1:                       # integer downscale keeps it crisp
        f = int(np.ceil(1 / scale))
        art = downscale_block(art, f)
        h, w = art.shape[:2]
    out = np.zeros((size, size, 4), np.uint8)
    ox = (size - w) // 2
    oy = size - pad - h
    out[oy:oy + h, ox:ox + w] = art
    return out
