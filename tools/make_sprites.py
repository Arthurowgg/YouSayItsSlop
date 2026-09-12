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

# ---------------- pickaxes ----------------
def pick(kind):
    cv = C()
    cv.line(3, 13, 12, 4, BROWN)      # handle
    cv.line(4, 13, 12, 5, (90, 60, 25))
    if kind == "axe":
        cv.rect(10, 1, 4, 3, STEEL); cv.rect(11, 4, 3, 2, STEEL); cv.set(10, 1, WHT)
    elif kind == "hammer":
        cv.rect(9, 0, 6, 4, GOLD); cv.rect(9, 0, 6, 1, LITE); cv.set(14, 1, CYAN); cv.set(10, 4, CYAN)
    elif kind in ("ice", "scythe"):
        col = ICE if kind == "ice" else PURP
        edge = WHT if kind == "ice" else PINK
        # curved head arc
        for a in range(0, 90, 6):
            x = 12 + 5 * math.cos(math.radians(a + 90))
            y = 4 + 5 * math.sin(math.radians(a + 90))
            cv.line(int(x), int(y), 12, 4, col)
        cv.set(9, 0, edge); cv.set(7, 1, edge)
        if kind == "ice":
            cv.set(5, 2, ICE); cv.set(14, 6, ICE)
    return cv

# ---------------- gliders / back bling ----------------
def glider(kind):
    cv = C()
    if kind == "wings":
        for i in range(7):
            h = 7 - abs(i - 3)
            cv.vline(6 - i, 8 - h, 8, WHT); cv.vline(9 + i, 8 - h, 8, WHT)
            cv.set(6 - i, 8 - h, GOLD); cv.set(9 + i, 8 - h, GOLD)
        cv.rect(7, 6, 2, 4, GOLD)
    elif kind == "shield":
        cv.circle(7.5, 7.5, 6.5, RED, fill=True)
        cv.circle(7.5, 7.5, 4.6, WHT, fill=True)
        cv.circle(7.5, 7.5, 2.8, BLUE, fill=True)
        cv.star(7.5, 7.5, 2, WHT)
    elif kind == "cosmic":
        for y in range(3, 14):
            w = 3 + (y - 3) // 2
            cv.hline(7 - w, 8 + w, y, (60, 20, 110))
        for (x, y) in [(6, 5), (9, 7), (5, 9), (10, 10), (7, 12)]: cv.set(x, y, WHT)
        cv.hline(5, 10, 3, PURP)
    elif kind == "claws":
        cv.vline(3, 1, 14, BROWN)
        cv.rect(4, 2, 10, 8, BLK)
        for i in range(3): cv.line(6 + i * 3, 3, 8 + i * 3, 9, STEEL)
    return cv

# ---------------- emotes (chibi figure poses) ----------------
def figure(cv, arms):
    cv.rect(6, 2, 4, 4, SKIN)              # head
    cv.hline(6, 9, 2, HAIR)
    cv.rect(6, 6, 4, 5, JUMP)              # torso
    cv.vline(6, 11, 14, (50, 60, 90)); cv.vline(9, 11, 14, (50, 60, 90))  # legs
    for (x0, y0, x1, y1) in arms: cv.line(x0, y0, x1, y1, JUMP)

def emote(kind):
    cv = C()
    if kind == "dance":
        figure(cv, [(6, 7, 3, 4), (9, 7, 12, 10)])
        cv.set(2, 2, CYAN); cv.set(3, 3, CYAN); cv.set(13, 8, PINK)
        cv.line(6, 14, 5, 14, (50, 60, 90))
    elif kind == "salute":
        figure(cv, [(6, 7, 5, 10), (9, 7, 11, 4), (11, 4, 12, 3)])
    elif kind == "flex":
        figure(cv, [(6, 7, 3, 7), (3, 7, 3, 4), (9, 7, 12, 7), (12, 7, 12, 4)])
        cv.set(3, 3, SKIN); cv.set(12, 3, SKIN)
    elif kind == "heart":
        figure(cv, [(6, 7, 4, 3), (9, 7, 11, 3)])
        for (x, y) in [(6, 1), (8, 1), (5, 2), (7, 2), (9, 2), (6, 3), (8, 3), (7, 4)]: cv.set(x, y, PINK)
    return cv

# ---------------- mode tiles ----------------
def mode(kind):
    cv = C()
    if kind == "br":
        cv.circle(7.5, 8, 6.6, PURP)                    # storm ring
        cv.circle(7.5, 8, 4.5, (40, 140, 90), fill=True)  # island
        cv.rect(6, 6, 2, 2, (220, 200, 120)); cv.set(9, 9, (30, 90, 60))
    elif kind == "rumble":
        for (x, y) in [(2, 5), (3, 8), (2, 11), (4, 6)]: cv.rect(x, y, 2, 3, RED)
        for (x, y) in [(12, 5), (11, 8), (12, 11), (10, 6)]: cv.rect(x, y, 2, 3, BLUE)
        for (x, y) in [(7, 6), (8, 8), (7, 10)]: cv.set(x, y, GOLD)
    elif kind == "stw":
        cv.rect(5, 5, 6, 6, WOOD); cv.rect(5, 5, 6, 1, BROWN); cv.rect(7, 8, 2, 3, BROWN)
        cv.vline(7, 2, 4, WOOD); cv.rect(6, 1, 3, 2, CYAN)
        for (x, y) in [(1, 9), (2, 12), (13, 10), (12, 13)]: cv.rect(x, y, 2, 3, GREEN)
    elif kind == "creative":
        cv.rect(3, 10, 10, 3, (120, 90, 60))
        for (x, y, c) in [(4, 8, RED), (6, 8, BLUE), (8, 8, GREEN), (5, 6, ORNG), (7, 6, PURP), (6, 4, CYAN)]:
            cv.rect(x, y, 2, 2, c)
        cv.line(12, 10, 12, 2, STEEL); cv.hline(9, 12, 2, STEEL); cv.vline(9, 2, 4, STEEL)
    return cv

def emote24(kind):
    cv = C(24, 24)
    hx, hy = 9, 3
    cv.rect(hx, hy, 6, 5, SKIN); cv.hline(hx, hx + 5, hy, HAIR)
    cv.rect(hx, 8, 6, 6, JUMP)
    cv.vline(hx + 1, 14, 18, (50, 60, 90)); cv.vline(hx + 4, 14, 18, (50, 60, 90))
    A = lambda x0, y0, x1, y1: cv.line(x0, y0, x1, y1, JUMP)
    if kind == "gangnam":
        A(9, 9, 11, 11); A(14, 9, 12, 11); cv.set(11, 11, SKIN); cv.set(12, 11, SKIN)
        cv.line(10, 14, 7, 17, (50, 60, 90)); cv.set(5, 5, CYAN); cv.set(18, 4, PINK)
    elif kind == "floss":
        A(9, 10, 4, 11); A(14, 10, 19, 9); cv.set(4, 11, SKIN); cv.set(19, 9, SKIN)
    elif kind == "dab":
        cv.rect(hx - 1, hy + 1, 6, 5, SKIN); A(9, 8, 4, 4); A(14, 8, 20, 5)
        cv.set(20, 5, SKIN); cv.set(3, 3, WHT)
    elif kind == "moonwalk":
        cv.rect(hx - 1, hy + 1, 6, 5, SKIN); cv.rect(hx - 1, 9, 6, 6, JUMP)
        cv.line(hx + 1, 15, hx + 4, 18, (50, 60, 90)); cv.line(hx + 4, 14, hx + 6, 18, (50, 60, 90))
        cv.set(19, 8, WHT); cv.set(20, 10, WHT)
    elif kind == "robot":
        A(9, 9, 5, 9); cv.line(5, 9, 5, 5, JUMP); cv.set(5, 4, SKIN)
        A(14, 10, 19, 10); cv.set(19, 10, SKIN); cv.set(5, 3, CYAN)
    elif kind == "runningman":
        cv.line(hx + 1, 14, hx + 4, 14, (50, 60, 90)); cv.line(hx + 4, 14, hx + 4, 18, (50, 60, 90))
        cv.line(hx + 4, 14, hx + 6, 18, (50, 60, 90)); A(9, 9, 12, 12); A(14, 9, 11, 6)
    elif kind == "macarena":
        A(9, 9, 16, 9); A(14, 10, 20, 10); cv.set(16, 9, SKIN); cv.set(20, 10, SKIN)
    elif kind == "hype":
        A(9, 8, 6, 3); A(14, 8, 17, 3); cv.vline(hx + 1, 16, 17, (50, 60, 90)); cv.vline(hx + 4, 16, 17, (50, 60, 90))
        cv.set(11, 1, GOLD)
    elif kind == "heart":
        A(9, 8, 10, 4); A(14, 8, 13, 4)
        for (x, y) in [(10, 0), (13, 0), (9, 1), (12, 1), (14, 1), (10, 2), (13, 2), (11, 2), (12, 2), (11, 3), (12, 3)]: cv.set(x, y, PINK)
    elif kind == "groove":
        A(14, 8, 19, 3); cv.set(19, 3, SKIN); cv.set(20, 2, GOLD); A(9, 9, 10, 12)
    return cv

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
    print("[paint] hand-drawn sprites")
    save("coin", coin())
    save("pick_axe", pick("axe"))
    save("pick_hammer", pick("hammer"))
    save("pick_ice", pick("ice"))
    save("pick_scythe", pick("scythe"))
    save("glider_wings", glider("wings"))
    save("glider_shield", glider("shield"))
    save("glider_cosmic", glider("cosmic"))
    save("glider_claws", glider("claws"))
    for k in ["gangnam", "floss", "dab", "moonwalk", "robot", "runningman", "macarena", "hype", "heart", "groove"]:
        save(f"emote_{k}", emote24(k))

    def set_video():
        cv = C(24, 24)
        cv.rect(4, 5, 16, 11, (120, 160, 255)); cv.rect(5, 6, 14, 9, (20, 40, 90))
        cv.line(7, 12, 10, 9, CYAN); cv.line(10, 9, 13, 13, CYAN); cv.line(13, 13, 17, 8, CYAN)
        cv.vline(12, 16, 18, (120, 160, 255)); cv.hline(8, 16, 18, (120, 160, 255))
        return cv
    def set_audio():
        cv = C(24, 24)
        cv.rect(5, 10, 3, 4, WHT); cv.line(8, 10, 11, 7, WHT); cv.line(8, 14, 11, 17, WHT); cv.vline(11, 7, 17, WHT)
        cv.set(14, 9, CYAN); cv.set(15, 12, CYAN); cv.set(14, 15, CYAN)
        cv.set(17, 7, CYAN); cv.set(18, 12, CYAN); cv.set(17, 17, CYAN)
        return cv
    def set_game():
        cv = C(24, 24)
        cv.rect(4, 8, 16, 9, (70, 90, 150)); cv.rect(5, 7, 14, 1, (70, 90, 150)); cv.rect(5, 17, 14, 1, (70, 90, 150))
        cv.vline(8, 10, 14, WHT); cv.hline(6, 10, 12, WHT)
        cv.set(15, 11, RED); cv.set(17, 13, GOLD)
        return cv
    def set_ui():
        cv = C(24, 24)
        cv.hline(5, 19, 7, (90, 110, 170)); cv.hline(5, 19, 12, (90, 110, 170)); cv.hline(5, 19, 17, (90, 110, 170))
        cv.rect(8, 5, 3, 4, GOLD); cv.rect(14, 10, 3, 4, CYAN); cv.rect(6, 15, 3, 4, PINK)
        return cv
    def set_access():
        cv = C(24, 24)
        cv.rect(9, 4, 6, 6, WHT)
        cv.rect(7, 12, 10, 6, WHT); cv.rect(6, 13, 1, 4, WHT); cv.rect(17, 13, 1, 4, WHT)
        cv.vline(12, 12, 17, (20, 40, 90))
        return cv
    def set_data():
        cv = C(24, 24)
        cv.rect(5, 5, 14, 14, (70, 110, 200))
        cv.rect(9, 5, 6, 4, (30, 50, 110)); cv.set(13, 6, WHT)
        cv.rect(8, 12, 8, 7, WHT); cv.hline(9, 14, 14, (70, 110, 200)); cv.hline(9, 14, 16, (70, 110, 200))
        cv.set(18, 5, BLK)
        return cv
    for k in ["video", "audio", "game", "ui", "access", "data"]:
        save(f"set_{k}", seticon(k))
    save("mode_br", mode("br"))
    save("mode_rumble", mode("rumble"))
    save("mode_stw", mode("stw"))
    save("mode_creative", mode("creative"))
    print("done.")


if __name__ == "__main__":
    main()
