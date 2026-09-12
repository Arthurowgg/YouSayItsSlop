#!/usr/bin/env python3
"""Paints the two launch game-mode icons (24x24 art, baked at 4x = 96x96 RGBA)."""
import os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'spr')
SILV = (190, 200, 220)
WHITE = (248, 248, 252)
GOLD = (255, 198, 60)
BARK = (122, 88, 52)
RED = (214, 42, 48)
OUTL = (12, 12, 20)
GRASS = (52, 110, 62)
GRASS_D = (34, 78, 44)


class C:
    def __init__(self):
        self.px = {}

    def set(self, x, y, c):
        if c and 0 <= x < 24 and 0 <= y < 24:
            self.px[(x, y)] = c

    def line(self, x0, y0, x1, y1, c, w=1):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        x, y = x0, y0
        while True:
            if w > 1:
                for j in range(w):
                    for i in range(w):
                        self.set(x - w // 2 + i, y - w // 2 + j, c)
            else:
                self.set(x, y, c)
            if x == x1 and y == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x += sx
            if e2 <= dx:
                err += dx
                y += sy

    def rect(self, x, y, w, h, c):
        for j in range(h):
            for i in range(w):
                self.set(x + i, y + j, c)


def outline(cv):
    drawn = dict(cv.px)
    for (x, y) in list(drawn):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in drawn:
                cv.set(x + dx, y + dy, OUTL)


def swords():
    cv = C()
    # underlay outlines
    cv.line(4, 4, 14, 14, OUTL, 3)
    cv.line(19, 4, 9, 14, OUTL, 3)
    # blades
    cv.line(4, 4, 13, 13, SILV, 2)
    cv.set(4, 4, WHITE)
    cv.set(5, 4, WHITE)
    cv.set(4, 5, WHITE)
    cv.line(19, 4, 10, 13, SILV, 2)
    cv.set(19, 4, WHITE)
    cv.set(18, 4, WHITE)
    cv.set(19, 5, WHITE)
    # guards
    cv.line(12, 15, 16, 11, GOLD, 1)
    cv.line(7, 11, 11, 15, GOLD, 1)
    # grips + pommels
    cv.line(14, 16, 17, 19, BARK, 2)
    cv.line(9, 16, 6, 19, BARK, 2)
    cv.set(18, 20, GOLD)
    cv.set(5, 20, GOLD)
    # clash spark
    cv.set(12, 2, WHITE)
    cv.set(11, 3, GOLD)
    cv.set(13, 3, GOLD)
    return cv


def flag():
    cv = C()
    # hill (kept 2px inside the canvas so the outline never touches edges)
    for i, w in enumerate((14, 18, 20)):
        y = 18 + i
        cv.rect(12 - w // 2, y, w, 1, GRASS if i == 0 else GRASS_D)
    cv.line(7, 18, 9, 17, GRASS)
    cv.line(16, 17, 18, 18, GRASS)
    # pole
    cv.line(11, 4, 11, 19, BARK, 1)
    cv.set(11, 3, GOLD)
    # banner with wavy fly-end
    cv.rect(12, 4, 8, 6, RED)
    cv.set(20, 5, RED)
    cv.set(20, 8, RED)
    cv.set(21, 6, RED)
    cv.set(21, 7, RED)
    cv.line(12, 4, 19, 4, (255, 120, 120))
    # star
    cv.set(16, 6, WHITE)
    cv.set(15, 7, WHITE)
    cv.set(16, 7, WHITE)
    cv.set(17, 7, WHITE)
    cv.set(16, 8, WHITE)
    return cv


def bake(name, cv):
    outline(cv)
    img = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
    for (x, y), c in cv.px.items():
        for j in range(4):
            for i in range(4):
                img.putpixel((x * 4 + i, y * 4 + j), c + (255,))
    img.save(os.path.join(OUT, name))
    print('  ->', name)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    bake('mode_1v1.png', swords())
    bake('mode_domination.png', flag())
    print('mode icons done.')
