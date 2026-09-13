#!/usr/bin/env python3
"""Asset validation & debug report for the cosmetic sprite system.

Audits EVERY cosmetic in the catalog (heroes, picks, gliders, emotes) plus
every animation strip, and reports per asset:
  type, file, frame count, frame dims, bounding box, pivot/ground line,
  transparency status (border must be empty), fill ratio, fragment count.

Fails (exit 1) when:
  * an icon keeps background pixels on its outer border,
  * an icon is empty / over-filled / cut off at the canvas edge,
  * an icon has more separated fragments than wings allow,
  * a strip has the wrong frame count or frame size,
  * a strip frame is empty,
  * feet (ground line) or head drift between frames (flicker source).

Also writes contact sheets to /tmp/va_* for frame-by-frame visual review.

Run:  .venv/bin/python tools/validate_assets.py
"""
import os
import sys
import json
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(__file__), '..')
PUB = os.path.join(ROOT, 'public')
FAILS = []


def ok(line):
    print('  OK  ' + line)


def bad(line):
    print('  FAIL ' + line)
    FAILS.append(line)


def alpha(im):
    return np.array(im.convert('RGBA'))[:, :, 3]


def audit_icon(path, kind, max_frags=3):
    if not os.path.exists(path):
        bad(f'{kind} {os.path.basename(path)}: missing file')
        return
    im = Image.open(path)
    if im.mode != 'RGBA':
        # palette PNGs are fine iff they carry real transparency
        conv = im.convert('RGBA')
        ca = np.array(conv)[:, :, 3]
        if not ((ca == 0).any() and (ca == 255).any()):
            bad(f'{kind} {os.path.basename(path)}: mode {im.mode} without transparency')
            return
        im = conv
    a = alpha(im)
    h, w = a.shape
    semi = int(((a > 0) & (a < 255)).sum())
    if semi:
        bad(f'{kind} {os.path.basename(path)}: {semi} semi-transparent pixels (halo / keying fringe)')
    m = a > 24
    if m.sum() < 16:
        bad(f'{kind} {os.path.basename(path)}: empty sprite')
        return
    border = np.concatenate([a[0, :], a[-1, :], a[:, 0], a[:, -1]])
    if (border > 0).any():
        bad(f'{kind} {os.path.basename(path)}: background remnant on border')
    ys, xs = np.where(m)
    if ys.min() < 1 or xs.min() < 1 or ys.max() > h - 2 or xs.max() > w - 2:
        bad(f'{kind} {os.path.basename(path)}: cut off at canvas edge '
            f'(bbox {xs.min()},{ys.min()}-{xs.max()},{ys.max()})')
    fill = m.sum() / (h * w)
    if fill > 0.97:
        bad(f'{kind} {os.path.basename(path)}: over-filled ({fill:.2f}), likely baked bg')
    lab, n = ndimage.label(m, structure=np.ones((3, 3)))
    sizes = sorted(ndimage.sum(m, lab, range(1, n + 1)), reverse=True)
    big = [s for s in sizes if s > 0.10 * sizes[0]]
    if len(big) > max_frags:
        bad(f'{kind} {os.path.basename(path)}: {len(big)} separated fragments')
    ok(f'{kind:6s} {os.path.basename(path):28s} {w}x{h} bbox {xs.max()-xs.min()+1}x{ys.max()-ys.min()+1} '
       f'fill {fill:.2f} frags {len(big)}')


def audit_strip(path, hid, frames=78):
    if not os.path.exists(path):
        bad(f'strip {hid}: missing')
        return None
    im = Image.open(path)
    a = alpha(im)
    h, w = a.shape
    if h != 48:
        bad(f'strip {hid}: height {h} != 48')
        return None
    if w != 48 * frames:
        bad(f'strip {hid}: width {w} != {48*frames} ({w//48} frames)')
        frames = w // 48
    feet, tops, counts = [], [], []
    for f in range(frames):
        fa = a[:, f * 48:(f + 1) * 48]
        m = fa > 24
        if m.sum() < 40:
            bad(f'strip {hid}: frame {f} empty ({m.sum()} px)')
            continue
        ys, xs = np.where(m)
        feet.append(ys.max())
        tops.append(ys.min())
        counts.append(m.sum())
    # core anims (idle/walk/attack/power, frames 0..17) must stand on one
    # ground line; emote loops (18+) may hop but never sink below it, and
    # raised arms/jumps may lift their tops further than core frames.
    cf, ct = feet[:18], tops[:18]
    ef, et = feet[18:], tops[18:]
    # idle & attack stand planted; walk strides bob 1px; power may hop.
    for name, seg, tol in (('idle', feet[0:4], 1), ('walk', feet[4:10], 2),
                           ('attack', feet[10:14], 1), ('power', feet[14:18], 5)):
        if seg and max(seg) - min(seg) > tol:
            bad(f'strip {hid}: {name} ground drifts {min(seg)}..{max(seg)} (flicker)')
    if ct and (max(ct) - min(ct) > 14):
        bad(f'strip {hid}: core tops drift {min(ct)}..{max(ct)} (mis-crop)')
    if ef and cf:
        if max(ef) - min(ef) > 6:
            bad(f'strip {hid}: emote feet drift {min(ef)}..{max(ef)} (flicker)')
        if max(ef) > max(cf) + 1:
            bad(f'strip {hid}: emote sinks below ground ({max(ef)} > {max(cf)})')
    if et and (max(et) - min(et) > 20):
        bad(f'strip {hid}: emote tops drift {min(et)}..{max(et)} (mis-crop)')
    ok(f'strip  {hid:22s} {w}x{h} frames {frames} feet {min(feet)}-{max(feet)} '
       f'tops {min(tops)}-{max(tops)} px/frame {int(sum(counts)/len(counts))}')
    return a


def sheet(a, name, frames=18, scale=3):
    """contact sheet of the first N frames for visual frame-by-frame review"""
    rgba = np.dstack([a, np.full(a.shape[:2], 255, np.uint8)]) if a.ndim == 2 else a
    n = min(frames, rgba.shape[1] // 48)
    out = Image.new('RGBA', (n * 48 * scale, 48 * scale), (24, 26, 34, 255))
    for f in range(n):
        fr = Image.fromarray(rgba[:, f * 48:(f + 1) * 48]).convert('RGBA').resize((48 * scale, 48 * scale), Image.NEAREST)
        out.paste(fr, (f * 48 * scale, 0), fr)
    out.save(f'/tmp/va_{name}.png')


def main():
    cat = json.load(open(os.path.join(PUB, 'data', 'catalog.json')))
    print('== cosmetic icons ==')
    for h in cat['heroes']:
        audit_icon(os.path.join(PUB, h['art']), 'hero')
    for p in cat['picks']:
        audit_icon(os.path.join(PUB, p['art']), 'pick')
    for g in cat['gliders']:
        audit_icon(os.path.join(PUB, g['art']), 'glider')
    for e in cat['emotes']:
        audit_icon(os.path.join(PUB, e['art']), 'emote')
        if not e.get('anim') or not e['anim'].get('frames'):
            bad(f"emote {e['id']}: missing animation metadata")

    print('== animation strips ==')
    for h in cat['heroes']:
        a = audit_strip(os.path.join(PUB, 'assets', 'anim', h['id'] + '.png'), h['id'])
        if a is not None and h['id'] in ('spiderman', 'ironman', 'hulk', 'gwen'):
            sheet(np.array(Image.open(os.path.join(PUB, 'assets', 'anim', h['id'] + '.png')).convert('RGBA')), h['id'])

    print('== emote metadata (generic system) ==')
    seen = set()
    for e in cat['emotes']:
        a = e.get('anim', {})
        key = (a.get('start'), a.get('frames'))
        if key in seen:
            bad(f"emote {e['id']}: duplicate strip range {key}")
        seen.add(key)
        ok(f"emote  {e['id']:16s} start {a.get('start')} frames {a.get('frames')} fps {a.get('fps')} loop {a.get('loop')}")

    print()
    if FAILS:
        print(f'{len(FAILS)} PROBLEM(S):')
        for f in FAILS:
            print(' -', f)
        sys.exit(1)
    print('ALL ASSETS VALID')


if __name__ == '__main__':
    main()
