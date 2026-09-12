#!/usr/bin/env python3
"""Paints 5 side-view 2D battle maps (192x108) + a survival mode icon.
Deterministic (fixed seeds). Ground/floor line for gameplay at y=86."""
import os, random, subprocess, math

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "maps")
SPR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "spr")
os.makedirs(OUT, exist_ok=True)

W, H, FLOOR = 192, 108, 86

class Cv:
    def __init__(self, w=W, h=H):
        self.w, self.h = w, h
        self.px = {}
    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[(int(x), int(y))] = c
    def rect(self, x, y, w, h, c):
        for j in range(int(h)):
            for i in range(int(w)): self.set(x + i, y + j, c)
    def hline(self, x0, x1, y, c):
        for x in range(int(x0), int(x1) + 1): self.set(x, y, c)
    def vline(self, x, y0, y1, c):
        for y in range(int(y0), int(y1) + 1): self.set(x, y, c)
    def circle(self, cx, cy, r, c, fill=False):
        for y in range(self.h):
            for x in range(self.w):
                d = math.hypot(x - cx, y - cy)
                if fill and d <= r + 0.5: self.set(x, y, c)
                elif not fill and abs(d - r) < 0.6: self.set(x, y, c)
    def sky(self, stops):
        n = len(stops)
        for y in range(self.h):
            t = y / self.h * (n - 1)
            i = min(int(t), n - 2); f = t - i
            a, b = stops[i], stops[i + 1]
            self.hline(0, self.w - 1, y, tuple(round(a[k] + (b[k] - a[k]) * f) for k in range(3)))

def save(name, cv, folder=OUT):
    txt = f"# ImageMagick pixel enumeration: {cv.w},{cv.h},255,srgba\n"
    for y in range(cv.h):
        row = []
        for x in range(cv.w):
            c = cv.px.get((x, y))
            if c:
                row.append(f"{x},{y}: ({c[0]},{c[1]},{c[2]},255) #{c[0]:02X}{c[1]:02X}{c[2]:02X}FF srgba({c[0]},{c[1]},{c[2]},1)")
            else:
                row.append(f"{x},{y}: (0,0,0,0) #00000000 srgba(0,0,0,0)")
        txt += "\n".join(row) + "\n"
    p = os.path.join(folder, f".{name}.txt")
    open(p, "w").write(txt)
    subprocess.run(["convert", "-size", f"{cv.w}x{cv.h}", f"txt:{p}", os.path.join(folder, f"{name}.png")], check=True)
    os.remove(p)
    print(f"  -> {name}.png")

def buildings(cv, seed, base_y, col, lit, maxh=40):
    r = random.Random(seed)
    x = 0
    while x < W:
        bw = r.randint(14, 30); bh = r.randint(18, maxh)
        cv.rect(x, base_y - bh, bw, bh, col)
        for wy in range(base_y - bh + 3, base_y - 4, 5):
            for wx in range(x + 2, x + bw - 2, 4):
                if r.random() < 0.35: cv.set(wx, wy, lit)
        if r.random() < 0.4: cv.vline(x + bw // 2, base_y - bh - 6, base_y - bh - 1, col)
        x += bw + r.randint(1, 4)

# ---------------- 1 BROOKLYN ROOFTOPS ----------------
def brooklyn():
    cv = Cv(); cv.sky([(38, 20, 66), (120, 50, 80), (240, 130, 70), (255, 190, 110)])
    r = random.Random(7)
    for _ in range(40): cv.set(r.randint(0, W - 1), r.randint(0, 30), (255, 240, 220))
    cv.rect(150, 18, 10, 10, (255, 220, 150)); cv.rect(152, 20, 6, 6, (255, 245, 210))
    buildings(cv, 11, 62, (52, 34, 60), (255, 190, 110), 34)
    buildings(cv, 12, 78, (34, 22, 44), (255, 160, 90), 44)
    # foreground rooftop floor
    cv.rect(0, FLOOR, W, H - FLOOR, (74, 62, 70))
    cv.hline(0, W - 1, FLOOR, (120, 105, 112)); cv.hline(0, W - 1, FLOOR + 1, (96, 84, 92))
    for x in range(0, W, 12): cv.vline(x, FLOOR + 2, H - 1, (60, 50, 58))
    # props: water tower + vent + ledge
    cv.rect(20, FLOOR - 16, 14, 12, (110, 70, 50)); cv.rect(18, FLOOR - 18, 18, 3, (80, 50, 40))
    cv.vline(23, FLOOR - 4, FLOOR - 1, (60, 40, 30)); cv.vline(31, FLOOR - 4, FLOOR - 1, (60, 40, 30))
    cv.rect(150, FLOOR - 8, 10, 8, (90, 90, 100)); cv.hline(150, 159, FLOOR - 8, (140, 140, 150))
    cv.rect(90, FLOOR - 3, 24, 3, (96, 84, 92))
    return cv

# ---------------- 2 WAKANDA GROVE ----------------
def wakanda():
    cv = Cv(); cv.sky([(10, 40, 46), (16, 70, 66), (40, 110, 84)])
    r = random.Random(21)
    for _ in range(14):  # fireflies
        cv.set(r.randint(0, W - 1), r.randint(10, 70), (180, 255, 190))
    # jungle layers
    for layer, col, top in [(3, (14, 52, 48), 40), (9, (10, 40, 38), 56), (17, (7, 30, 30), 70)]:
        x = 0
        rr = random.Random(layer)
        while x < W:
            tw = rr.randint(10, 22); th = rr.randint(10, 26)
            for yy in range(th):
                ww = int(tw * (1 - yy / th * 0.7))
                cv.hline(x + (tw - ww) // 2, x + (tw - ww) // 2 + ww, top + (th - yy), col)
            cv.vline(x + tw // 2, top + th, min(top + th + 6, FLOOR), (40, 26, 20))
            x += tw + rr.randint(0, 5)
    # vibranium crystals
    for cx, ch in [(60, 16), (140, 22), (170, 12)]:
        for i in range(ch):
            wdt = max(1, int(4 * (1 - i / ch)))
            cv.hline(cx - wdt, cx + wdt, FLOOR - i, (150, 80, 230))
        cv.set(cx, FLOOR - ch - 1, (230, 190, 255))
    cv.rect(0, FLOOR, W, H - FLOOR, (26, 58, 40))
    cv.hline(0, W - 1, FLOOR, (70, 140, 90))
    for x in range(2, W, 7): cv.set(x, FLOOR + 3, (150, 80, 230))
    return cv

# ---------------- 3 ASGARD BRIDGE ----------------
def asgard():
    cv = Cv(); cv.sky([(4, 6, 26), (10, 14, 48), (24, 30, 80)])
    r = random.Random(33)
    for _ in range(70): cv.set(r.randint(0, W - 1), r.randint(0, 70), (230, 240, 255))
    for y in range(20, 60):  # rainbow band
        cols = [(230, 60, 60), (240, 150, 60), (240, 230, 90), (90, 220, 120), (80, 160, 240), (160, 90, 230)]
        cv.hline(0, W - 1, y, cols[(y - 20) // 7 % 6])
    # observatory silhouette
    cv.rect(80, 34, 32, 26, (30, 34, 70)); cv.rect(88, 26, 16, 8, (40, 46, 90)); cv.vline(96, 18, 26, (200, 210, 255))
    # golden bridge floor
    cv.rect(0, FLOOR, W, H - FLOOR, (150, 110, 40))
    cv.hline(0, W - 1, FLOOR, (255, 220, 130)); cv.hline(0, W - 1, FLOOR + 2, (120, 86, 30))
    for x in range(6, W, 16):
        cv.rect(x, FLOOR + 4, 8, 2, (255, 220, 130))
    for px in (10, 60, 120, 176):
        cv.vline(px, FLOOR - 22, FLOOR - 1, (190, 150, 60)); cv.rect(px - 2, FLOOR - 26, 5, 5, (255, 220, 130))
    return cv

# ---------------- 4 HELL'S KITCHEN NIGHT ----------------
def kitchen():
    cv = Cv(); cv.sky([(6, 8, 20), (10, 14, 32), (16, 22, 44)])
    r = random.Random(44)
    buildings(cv, 45, 70, (16, 18, 34), (120, 220, 255), 50)
    buildings(cv, 46, FLOOR, (10, 12, 24), (255, 120, 140), 60)
    # neon signs
    cv.rect(30, 52, 2, 14, (255, 60, 90)); cv.rect(28, 50, 6, 2, (255, 60, 90))
    cv.rect(130, 46, 10, 2, (80, 240, 255)); cv.vline(134, 48, 58, (80, 240, 255))
    # rain
    for _ in range(60):
        x, y = r.randint(0, W - 2), r.randint(0, FLOOR - 4)
        cv.set(x, y, (140, 170, 220)); cv.set(x + 1, y + 2, (140, 170, 220))
    # wet asphalt
    cv.rect(0, FLOOR, W, H - FLOOR, (24, 26, 38))
    cv.hline(0, W - 1, FLOOR, (60, 70, 100))
    for x in range(0, W, 3):
        if r.random() < 0.5: cv.set(x, FLOOR + 2 + (x % 3), (255, 60, 90) if x % 2 else (80, 240, 255))
    cv.rect(70, FLOOR - 10, 16, 10, (30, 32, 46)); cv.hline(70, 85, FLOOR - 10, (70, 76, 100))
    return cv

# ---------------- 5 HELICARRIER DECK ----------------
def carrier():
    cv = Cv(); cv.sky([(70, 130, 200), (110, 170, 225), (160, 205, 240)])
    r = random.Random(55)
    for _ in range(8):  # clouds
        cx, cy = r.randint(0, W - 20), r.randint(6, 40)
        cv.rect(cx, cy, r.randint(12, 24), 3, (240, 248, 255)); cv.rect(cx + 3, cy - 2, 10, 2, (240, 248, 255))
    cv.rect(0, 64, W, 22, (40, 90, 140))  # ocean
    for x in range(0, W, 5): cv.hline(x, x + 2, 66 + (x % 3) * 4, (120, 180, 220))
    cv.rect(0, FLOOR, W, H - FLOOR, (96, 104, 112))
    cv.hline(0, W - 1, FLOOR, (150, 158, 166))
    for x in range(4, W, 20): cv.rect(x, FLOOR + 6, 10, 2, (240, 200, 60))
    for x in range(0, W, 8): cv.set(x, FLOOR + 2, (240, 240, 240))
    # tower fin + antenna
    cv.rect(150, FLOOR - 30, 26, 30, (120, 128, 138)); cv.rect(154, FLOOR - 26, 18, 6, (60, 70, 86))
    cv.vline(160, FLOOR - 40, FLOOR - 30, (90, 98, 108)); cv.set(160, FLOOR - 41, (255, 80, 80))
    cv.rect(20, FLOOR - 6, 30, 6, (110, 118, 128))
    return cv

# ---------------- survival mode icon ----------------
def mode_survival():
    cv = Cv(16, 16)
    cv.circle(7.5, 8, 6.5, (230, 50, 60))
    for i, (x, y) in enumerate([(4, 6), (9, 5), (6, 9), (10, 10)]):
        cv.rect(x, y, 2, 3, (120, 255, 140))
    cv.set(7, 3, (255, 220, 130))
    return cv

if __name__ == "__main__":
    print("[paint] 2d maps")
    save("map_brooklyn", brooklyn())
    save("map_wakanda", wakanda())
    save("map_asgard", asgard())
    save("map_kitchen", kitchen())
    save("map_carrier", carrier())
    save("mode_survival", mode_survival(), SPR)
    print("done.")
