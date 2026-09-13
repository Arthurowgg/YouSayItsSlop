#!/usr/bin/env python3
"""Hand-painted 16x16 pixel sprites for items/modes/coin, exported via ImageMagick.
Deterministic stand-ins that match the generated art's chunky style."""
import os, subprocess, math

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "spr")
os.makedirs(OUT, exist_ok=True)

class C:
    def __init__(self, w=16, h=16):
        self.w, self.h = w, h
        self.px = {}
    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h and c: self.px[(int(x), int(y))] = c
    def rect(self, x, y, w, h, c):
        for j in range(h):
            for i in range(w): self.set(x + i, y + j, c)
    def hline(self, x0, x1, y, c):
        for x in range(min(x0, x1), max(x0, x1) + 1): self.set(x, y, c)
    def vline(self, x, y0, y1, c):
        for y in range(min(y0, y1), max(y0, y1) + 1): self.set(x, y, c)
    def line(self, x0, y0, x1, y1, c):
        x0, y0, x1, y1 = (int(round(v)) for v in (x0, y0, x1, y1))
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        x, y = x0, y0
        while True:
            self.set(x, y, c)
            if x == x1 and y == y1: break
            e2 = 2 * err
            if e2 >= dy: err += dy; x += sx
            if e2 <= dx: err += dx; y += sy
    def circle(self, cx, cy, r, c, fill=False):
        for y in range(self.h):
            for x in range(self.w):
                d = math.hypot(x - cx, y - cy)
                if fill and d <= r + 0.5: self.set(x, y, c)
                elif not fill and abs(d - r) < 0.6: self.set(x, y, c)
    def disc(self, cx, cy, r, c):
        self.circle(cx, cy, r, c, fill=True)
    def star(self, cx, cy, r, c):
        pts = [(cx, cy - r), (cx + r * .3, cy - r * .3), (cx + r, cy - r * .2), (cx + r * .45, cy + r * .25),
               (cx + r * .6, cy + r), (cx, cy + r * .45), (cx - r * .6, cy + r), (cx - r * .45, cy + r * .25),
               (cx - r, cy - r * .2), (cx - r * .3, cy - r * .3)]
        for a, b in zip(pts, pts[1:] + pts[:1]):
            self.line(a[0], a[1], b[0], b[1], c)

def save(name, cv):
    txt = f"# ImageMagick pixel enumeration: {cv.w},{cv.h},255,srgba\n"
    for y in range(cv.h):
        for x in range(cv.w):
            c = cv.px.get((x, y))
            if c:
                txt += f"{x},{y}: ({c[0]},{c[1]},{c[2]},255) #{c[0]:02X}{c[1]:02X}{c[2]:02X}FF srgba({c[0]},{c[1]},{c[2]},1)\n"
            else:
                txt += f"{x},{y}: (0,0,0,0) #00000000 srgba(0,0,0,0)\n"
    p = os.path.join(OUT, f".{name}.txt")
    with open(p, "w") as f: f.write(txt)
    subprocess.run(["convert", "-size", f"{cv.w}x{cv.h}", f"txt:{p}",
                    "-filter", "point", "-resize", "128x128", os.path.join(OUT, f"{name}.png")],
                   check=True)
    os.remove(p)
    print(f"  -> {name}.png")

GOLD, DARK, LITE = (255, 210, 60), (138, 90, 0), (255, 243, 176)
SKIN, JUMP, HAIR = (240, 190, 140), (90, 120, 200), (60, 40, 20)
STEEL, SHADOW = (190, 200, 220), (40, 44, 60)
RED, BLUE, GREEN, PURP, WHT, BLK = (230, 50, 60), (50, 110, 230), (70, 200, 90), (170, 70, 230), (245, 245, 250), (20, 20, 28)
CYAN, ORNG, PINK, ICE = (53, 224, 255), (255, 150, 40), (255, 90, 170), (160, 230, 255)
BROWN, WOOD = (140, 90, 40), (190, 140, 70)

# ---------------- coin ----------------
def coin():
    cv = C()
    cv.circle(7.5, 7.5, 6.5, DARK, fill=True)
    cv.circle(7.5, 7.5, 5.5, GOLD, fill=True)
    cv.rect(4, 3, 3, 2, LITE)
    cv.star(7.5, 8, 3, (200, 140, 10))
    return cv

# ---------------- settings icons ----------------
def seticon(kind):
    cv = C(24, 24)
    if kind == "video":
        cv.rect(4, 5, 16, 11, (40, 60, 110)); cv.rect(5, 6, 14, 9, (90, 140, 220))
        cv.hline(6, 17, 8, WHT); cv.hline(6, 13, 11, WHT)
        cv.vline(12, 16, 18, WHT); cv.hline(9, 15, 19, WHT)
    elif kind == "audio":
        cv.rect(5, 9, 4, 6, WHT)
        cv.line(9, 9, 13, 5, WHT); cv.vline(13, 5, 19, WHT); cv.line(13, 19, 9, 15, WHT)
        cv.line(16, 9, 18, 7, WHT); cv.line(16, 15, 18, 17, WHT); cv.vline(18, 8, 16, WHT)
    elif kind == "game":
        cv.rect(4, 8, 16, 9, WHT)
        cv.vline(8, 10, 14, (20, 20, 30)); cv.hline(6, 10, 12, (20, 20, 30))
        cv.set(15, 11, (255, 61, 90)); cv.set(17, 13, (53, 224, 255))
    elif kind == "ui":
        for i, x in enumerate((7, 12, 17)):
            cv.vline(x, 5, 19, (90, 140, 220))
            cv.rect(x - 2, (9, 14, 7)[i], 5, 3, WHT)
    elif kind == "access":
        cv.disc(12, 7, 3, WHT)
        cv.hline(6, 18, 12, WHT); cv.vline(12, 12, 16, WHT)
        cv.line(12, 16, 9, 20, WHT); cv.line(12, 16, 15, 20, WHT)
    elif kind == "data":
        cv.rect(5, 5, 14, 14, WHT)
        cv.rect(9, 5, 6, 5, (20, 20, 30)); cv.set(13, 6, (90, 140, 220))
        cv.rect(8, 13, 8, 6, (90, 140, 220))
    return cv

def main():
    """UI-only icons. ALL character / item art (heroes, picks, gliders,
    emotes, strips) is sliced from the AI sheets by tools/make_shop_icons.py
    and tools/make_ai_assets.py - never paint those here."""
    print("[paint] hand-drawn UI sprites")
    save("coin", coin())
    for k in ["video", "audio", "game", "ui", "access", "data"]:
        save(f"set_{k}", seticon(k))
    print("done.")


if __name__ == "__main__":
    main()
