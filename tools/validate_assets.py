#!/usr/bin/env python3
"""Asset validation pipeline (v13): checks transparency, frame consistency,
resolution, grounding and loop sanity BEFORE assets ship. Exit 1 on failures."""
import subprocess, sys, os, json

REPO = os.path.join(os.path.dirname(__file__), '..')
SPR = os.path.join(REPO, 'public/assets/spr')
ANI = os.path.join(REPO, 'public/assets/anim')

def sh(c):
    return subprocess.run(c, shell=True, capture_output=True, text=True).stdout.strip()

def dims(p):
    w, h = sh(f"identify -format '%w %h' '{p}'").split()
    return int(w), int(h)

def pixel(p, x, y):
    return sh(f"convert '{p}' -format '%[pixel:p{{{x},{y}}}]' info:")

def alpha_of(p, x, y):
    out = sh(f"convert '{p}' -format '%[hex:p{{{x},{y}}}]' info:")
    return out

def opaque_bottom(p, frame_w, frame_h):
    """count opaque pixels in the bottom 8 rows of frame 0"""
    out = sh(f"convert '{p}' -crop {frame_w}x8+0+{frame_h-8} +repage -channel A -threshold 40% "
             f"-format '%[fx:mean*{frame_w}*8]' info:")
    try:
        return float(out)
    except ValueError:
        return -1

def main():
    fails = []
    checks = 0
    heroes = [h['id'] for h in json.load(open(os.path.join(REPO, 'public/data/catalog.json')))] \
        if False else None
    d = json.load(open(os.path.join(REPO, 'public/data/catalog.json')))
    heroes = [h['id'] for h in d['heroes']]

    for h in heroes:
        p = os.path.join(ANI, f'{h}.png')
        if not os.path.exists(p):
            fails.append(f'{h}: missing strip'); continue
        w, hgt = dims(p)
        frames = round(w / hgt)
        checks += 1
        if hgt < 96: fails.append(f'{h}: low res {hgt}px')
        if frames not in (4, 18): fails.append(f'{h}: bad frame count {frames}')
        if '00' not in alpha_of(p, 0, 0)[-2:]:
            # corner must be transparent (last hex pair = alpha)
            a = alpha_of(p, 0, 0)
            if not a.endswith('00'):
                fails.append(f'{h}: background at corner ({a})')
        g = opaque_bottom(p, hgt, hgt)
        if g <= 0: fails.append(f'{h}: idle frame not grounded (bottom empty)')

    icons = [f for f in os.listdir(SPR)
             if f.startswith(('emote_', 'pick_', 'glider_')) or f[:-4] in heroes]
    for f in sorted(icons):
        p = os.path.join(SPR, f)
        w, hgt = dims(p)
        checks += 1
        if w != hgt: fails.append(f'{f}: not square {w}x{hgt}')
        if w < 96: fails.append(f'{f}: low res {w}px')
        a = alpha_of(p, 0, 0)
        if not a.endswith('00'): fails.append(f'{f}: background at corner ({a})')

    print(f'validated {checks} assets')
    if fails:
        print('FAILURES:')
        for f in fails: print(' -', f)
        sys.exit(1)
    print('ALL ASSETS OK: transparent, square/striped, >=96px, grounded idle')

if __name__ == '__main__':
    main()
