#!/usr/bin/env python3
"""v4 hero painter: recognizable Marvel heroes (masks, emblems, unique attack & power anims).
Strip (58 frames): idle[0..3] walk[4..9] attack[10..13] power[14..17] + 10 emotes x4.
Also paints 48px backblings (2-frame wings) and the kree arena icon."""
import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
from make_maps import save

ANIM = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "anim")
SPR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "spr")
os.makedirs(ANIM, exist_ok=True)

FR = 48
BLACK = (16, 16, 24)
WHITE = (248, 248, 252)
OUT = (12, 12, 20)
GOLD = (255, 198, 60)
SILV = (190, 200, 220)
CYAN = (130, 240, 255)
RED = (214, 42, 48)
BLUE = (40, 90, 190)
PINK = (255, 92, 170)
BARK = (122, 88, 52)
EMOTES = ['dance', 'wave', 'cheer', 'flex', 'bow', 'laugh', 'salute', 'heart', 'shrug', 'point']

def sh(c, f): return tuple(min(255, int(v * f)) for v in c[:3])

class HC:
    def __init__(self, w=FR, h=FR):
        self.w, self.h = w, h
        self.px = {}
    def set(self, x, y, c):
        if c and 0 <= x < self.w and 0 <= y < self.h: self.px[(int(x), int(y))] = c
    def rect(self, x, y, w, h, c):
        for j in range(int(h)):
            for i in range(int(w)): self.set(x + i, y + j, c)
    def hline(self, x0, x1, y, c):
        for x in range(int(min(x0, x1)), int(max(x0, x1)) + 1): self.set(x, y, c)
    def vline(self, x, y0, y1, c):
        for y in range(int(min(y0, y1)), int(max(y0, y1)) + 1): self.set(x, y, c)
    def line(self, x0, y0, x1, y1, c, w=1):
        x0, y0, x1, y1 = map(lambda v: int(round(v)), (x0, y0, x1, y1))
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        x, y = x0, y0
        while True:
            if w > 1: self.rect(x - w // 2, y - w // 2, w, w, c)
            else: self.set(x, y, c)
            if x == x1 and y == y1: break
            e2 = 2 * err
            if e2 >= dy: err += dy; x += sx
            if e2 <= dx: err += dx; y += sy
    def limb(self, x0, y0, x1, y1, bend, c, w=2):
        mx, my = (x0 + x1) / 2 + bend, (y0 + y1) / 2 + abs(bend) * .3
        self.line(x0, y0, mx, my, c, w); self.line(mx, my, x1, y1, c, w)
    def disc(self, cx, cy, r, c):
        for y in range(int(cy - r - 1), int(cy + r + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                if math.hypot(x - cx, y - cy) <= r + .4: self.set(x, y, c)

def outline(cv):
    drawn = dict(cv.px)
    for (x, y), c in list(drawn.items()):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in drawn: cv.set(x + dx, y + dy, OUT)

HEROES = {
 "spiderman": dict(suit=(214, 42, 48), suit2=(38, 88, 190), accent=(214, 42, 48), skin=(240, 190, 140), quote="Your friendly neighborhood pixel-slinger."),
 "spiderman_classic": dict(suit=(198, 30, 36), suit2=(28, 66, 158), accent=(198, 30, 36), skin=(240, 190, 140), quote="Classic suit. Classic responsibility."),
 "miles": dict(suit=(24, 24, 30), suit2=(24, 24, 30), accent=(230, 42, 52), skin=(150, 100, 70), quote="Alright, one more swing."),
 "gwen": dict(suit=(240, 240, 246), suit2=(24, 24, 30), accent=(255, 92, 170), skin=(245, 210, 180), quote="You wouldn't get it. It's a whole dimension thing."),
 "venom": dict(suit=(18, 18, 24), suit2=(18, 18, 24), accent=(230, 60, 70), skin=(18, 18, 24), big=True, quote="We are done talking."),
 "ironman": dict(suit=(198, 36, 42), suit2=(150, 30, 36), accent=GOLD, skin=(240, 190, 140), quote="Power at 100 percent. Try to keep up."),
 "capamerica": dict(suit=(40, 90, 190), suit2=(40, 90, 190), accent=RED, skin=(240, 190, 140), quote="I can do this all day."),
 "thor": dict(suit=(90, 100, 125), suit2=(62, 68, 88), accent=GOLD, skin=(245, 210, 180), hair=(250, 220, 120), cape=(198, 36, 48), quote="Bring me that horizon!"),
 "hulk": dict(suit=(72, 172, 82), suit2=(122, 72, 172), accent=(72, 172, 82), skin=(72, 172, 82), big=True, quote="Puny menu. HULK SMASH."),
 "wolverine": dict(suit=(250, 200, 44), suit2=(40, 90, 190), accent=(250, 200, 44), skin=(240, 190, 140), quote="Bub, I don't line up."),
 "blackwidow": dict(suit=(30, 30, 38), suit2=(30, 30, 38), accent=GOLD, skin=(245, 210, 180), hair=(172, 52, 42), quote="Red in my ledger. You're adding to it."),
 "hawkeye": dict(suit=(122, 62, 172), suit2=(62, 42, 92), accent=(248, 248, 252), skin=(240, 190, 140), quote="Wind's fine. I'm better."),
 "drstrange": dict(suit=(42, 72, 162), suit2=(42, 72, 162), accent=(255, 160, 40), skin=(240, 200, 160), hair=(96, 96, 108), cape=(190, 32, 42), quote="Dormammu, I've come to bargain."),
 "scarletwitch": dict(suit=(198, 36, 52), suit2=(122, 22, 38), accent=(255, 92, 100), skin=(245, 210, 180), hair=(150, 32, 40), quote="You have no idea what I can do."),
 "scarletwitch_azure": dict(suit=(52, 92, 202), suit2=(32, 52, 122), accent=(130, 205, 255), skin=(245, 210, 180), hair=(150, 32, 40), quote="Chaos, but make it cool."),
 "blackpanther": dict(suit=(28, 28, 36), suit2=(28, 28, 36), accent=SILV, skin=(28, 28, 36), quote="Wakanda forever."),
 "captainmarvel": dict(suit=(42, 72, 172), suit2=(198, 36, 48), accent=GOLD, skin=(245, 210, 180), hair=(250, 220, 120), quote="Higher. Further. Faster."),
 "captainmarvel_classic": dict(suit=(42, 72, 172), suit2=(42, 72, 172), accent=GOLD, skin=(245, 210, 180), hair=(250, 220, 120), quote="The original star-spangled problem."),
 "antman": dict(suit=(142, 26, 42), suit2=(32, 32, 38), accent=SILV, skin=(240, 190, 140), quote="It's not size, it's timing."),
 "antman_unmasked": dict(suit=(142, 26, 42), suit2=(32, 32, 38), accent=SILV, skin=(240, 190, 140), hair=(122, 82, 42), quote="Scott Lang. Mostly reformed."),
}

# ---------------------------------------------------------------- heads
def lens(cv, x, y, w, h, c=WHITE):
    cv.rect(x - 1, y - 1, w + 2, h + 2, BLACK)
    cv.rect(x, y, w, h, c)

def HEADS(hid):
    def f(cv, c, hx, hy, hw, bob):
        suit, skin = c["suit"], c["skin"]
        hr = c.get("hair")
        if hid in ("spiderman", "spiderman_classic"):
            cv.rect(hx, hy, hw, 12, suit)
            dk = sh(suit, .55)
            cv.vline(hx + hw // 2, hy, hy + 11, dk)
            for yy in (hy + 2, hy + 8, hy + 10): cv.hline(hx, hx + hw - 1, yy, dk)
            lens(cv, hx + 2, hy + 4, 4, 3); lens(cv, hx + hw - 6, hy + 4, 4, 3)
        elif hid == "miles":
            cv.rect(hx, hy, hw, 12, suit)
            lens(cv, hx + 2, hy + 4, 4, 3); lens(cv, hx + hw - 6, hy + 4, 4, 3)
            for ex in (hx + 1, hx + hw - 6):
                cv.hline(ex, ex + 5, hy + 3, c["accent"]); cv.hline(ex, ex + 5, hy + 8, c["accent"])
            cv.vline(hx + hw // 2, hy, hy + 11, sh(c["accent"], .5))
        elif hid == "gwen":
            cv.rect(hx - 1, hy - 1, hw + 2, 14, suit)
            cv.hline(hx - 1, hx + hw, hy - 1, PINK)
            cv.rect(hx + 2, hy + 3, hw - 4, 8, (42, 38, 46))
            cv.rect(hx + 3, hy + 4, hw - 6, 6, skin)
            cv.set(hx + 4, hy + 6, WHITE); cv.set(hx + 5, hy + 6, WHITE)
            cv.set(hx + hw - 5, hy + 6, WHITE); cv.set(hx + hw - 6, hy + 6, WHITE)
            cv.set(hx + 2, hy + 3, PINK); cv.set(hx + hw - 3, hy + 3, PINK)
        elif hid == "ironman":
            cv.rect(hx, hy, hw, 12, suit)
            cv.rect(hx + 3, hy + 3, hw - 6, 8, GOLD)
            cv.rect(hx + 4, hy + 5, 3, 1, WHITE); cv.rect(hx + hw - 7, hy + 5, 3, 1, WHITE)
            cv.hline(hx + 5, hx + hw - 6, hy + 9, sh(GOLD, .6))
            cv.hline(hx + 2, hx + hw - 3, hy + 1, sh(suit, 1.3))
        elif hid == "capamerica":
            cv.rect(hx, hy, hw, 12, suit)
            cv.rect(hx + 2, hy + 7, hw - 4, 5, skin)
            lens(cv, hx + 2, hy + 4, 3, 2); lens(cv, hx + hw - 5, hy + 4, 3, 2)
            cv.set(hx + hw // 2, hy + 1, WHITE)
            cv.set(hx - 1, hy + 3, WHITE); cv.set(hx - 1, hy + 5, WHITE)
            cv.set(hx + hw, hy + 3, WHITE); cv.set(hx + hw, hy + 5, WHITE)
            cv.hline(hx + 4, hx + hw - 5, hy + 10, sh(skin, .75))
        elif hid == "thor":
            cv.rect(hx, hy, hw, 12, skin)
            cv.rect(hx, hy, hw, 2, hr); cv.vline(hx, hy, hy + 12, hr); cv.vline(hx + hw - 1, hy, hy + 12, hr)
            cv.set(hx + 4, hy + 5, (70, 130, 200)); cv.set(hx + hw - 5, hy + 5, (70, 130, 200))
            cv.hline(hx + 4, hx + hw - 5, hy + 9, sh(hr, .8))
            cv.hline(hx + 3, hx + hw - 4, hy + 4, sh(skin, .8))
        elif hid == "hulk":
            cv.rect(hx - 1, hy, hw + 2, 13, skin)
            cv.rect(hx - 1, hy, hw + 2, 2, (22, 62, 30))
            cv.hline(hx + 1, hx + 5, hy + 4, BLACK); cv.hline(hx + hw - 6, hx + hw - 2, hy + 4, BLACK)
            cv.set(hx + 3, hy + 5, WHITE); cv.set(hx + hw - 4, hy + 5, WHITE)
            cv.hline(hx + 3, hx + hw - 4, hy + 10, sh(skin, .6))
        elif hid == "blackwidow":
            cv.rect(hx, hy, hw, 12, skin)
            cv.rect(hx, hy, hw, 3, hr)
            cv.vline(hx, hy, hy + 13, hr); cv.vline(hx + hw - 1, hy, hy + 13, hr)
            cv.vline(hx - 1, hy + 4, hy + 13, sh(hr, .8)); cv.vline(hx + hw, hy + 4, hy + 13, sh(hr, .8))
            cv.set(hx + 4, hy + 6, (60, 120, 160)); cv.set(hx + hw - 5, hy + 6, (60, 120, 160))
            cv.set(hx + hw // 2, hy + 10, (190, 60, 60))
        elif hid == "hawkeye":
            cv.rect(hx - 1, hy - 1, hw + 2, 14, suit)
            cv.rect(hx + 2, hy + 2, hw - 4, 9, skin)
            cv.rect(hx + 2, hy + 4, hw - 4, 2, BLACK)
            cv.set(hx + 4, hy + 4, WHITE); cv.set(hx + hw - 5, hy + 4, WHITE)
            cv.hline(hx + 4, hx + hw - 5, hy + 9, sh(skin, .75))
        elif hid == "drstrange":
            cv.rect(hx, hy, hw, 12, skin)
            cv.rect(hx, hy, hw, 2, hr); cv.set(hx, hy + 2, hr); cv.set(hx + hw - 1, hy + 2, hr)
            cv.vline(hx, hy + 2, hy + 6, hr); cv.vline(hx + hw - 1, hy + 2, hy + 6, hr)
            cv.set(hx + 4, hy + 5, (70, 110, 160)); cv.set(hx + hw - 5, hy + 5, (70, 110, 160))
            cv.hline(hx + 4, hx + hw - 5, hy + 9, (90, 70, 60))
            cv.set(hx + hw // 2, hy + 10, (90, 70, 60)); cv.set(hx + hw // 2, hy + 11, (90, 70, 60))
            cv.rect(hx - 2, hy + 9, 2, 4, c.get("cape", RED)); cv.rect(hx + hw, hy + 9, 2, 4, c.get("cape", RED))
        elif hid in ("scarletwitch", "scarletwitch_azure"):
            cv.rect(hx, hy, hw, 12, skin)
            cv.rect(hx, hy, hw, 3, hr)
            cv.vline(hx, hy, hy + 13, hr); cv.vline(hx + hw - 1, hy, hy + 13, hr)
            cv.vline(hx - 1, hy + 5, hy + 13, sh(hr, .8)); cv.vline(hx + hw, hy + 5, hy + 13, sh(hr, .8))
            cv.set(hx + hw // 2 - 2, hy, c["accent"]); cv.set(hx + hw // 2, hy - 1, c["accent"]); cv.set(hx + hw // 2 + 2, hy, c["accent"])
            cv.set(hx + 4, hy + 6, (140, 40, 50)); cv.set(hx + hw - 5, hy + 6, (140, 40, 50))
        elif hid == "blackpanther":
            cv.rect(hx, hy, hw, 12, suit)
            cv.line(hx + 2, hy, hx, hy - 3, suit, 2); cv.line(hx + hw - 3, hy, hx + hw - 1, hy - 3, suit, 2)
            lens(cv, hx + 2, hy + 4, 3, 2, (170, 240, 200)); lens(cv, hx + hw - 5, hy + 4, 3, 2, (170, 240, 200))
            cv.hline(hx + 3, hx + hw - 4, hy + 9, SILV)
        elif hid == "captainmarvel":
            cv.rect(hx, hy, hw, 12, skin)
            cv.rect(hx, hy, hw, 3, hr)
            cv.vline(hx, hy, hy + 11, hr); cv.vline(hx + hw - 1, hy, hy + 11, hr)
            cv.set(hx + 4, hy + 5, (70, 130, 200)); cv.set(hx + hw - 5, hy + 5, (70, 130, 200))
            cv.hline(hx + 4, hx + hw - 5, hy + 9, sh(skin, .8))
        elif hid == "captainmarvel_classic":
            cv.rect(hx, hy, hw, 12, suit)
            cv.vline(hx + hw // 2, hy, hy + 3, GOLD)
            lens(cv, hx + 2, hy + 4, 3, 2); lens(cv, hx + hw - 5, hy + 4, 3, 2)
            cv.vline(hx - 1, hy + 4, hy + 11, hr); cv.vline(hx + hw, hy + 4, hy + 11, hr)
        elif hid == "antman":
            cv.rect(hx, hy, hw, 12, suit)
            cv.vline(hx + hw // 2, hy, hy + 11, (32, 32, 38))
            cv.rect(hx + 2, hy + 4, 3, 3, SILV); cv.rect(hx + hw - 5, hy + 4, 3, 3, SILV)
            cv.set(hx + 3, hy + 5, RED); cv.set(hx + hw - 4, hy + 5, RED)
        elif hid == "antman_unmasked":
            cv.rect(hx, hy, hw, 12, skin)
            cv.rect(hx, hy, hw, 3, hr); cv.set(hx, hy + 3, hr); cv.set(hx + hw - 1, hy + 3, hr)
            cv.set(hx + 4, hy + 6, BLACK); cv.set(hx + hw - 5, hy + 6, BLACK)
            cv.hline(hx + 4, hx + hw - 5, hy + 9, sh(skin, .75))
        elif hid == "venom":
            cv.rect(hx - 1, hy - 1, hw + 2, 14, suit)
            cv.rect(hx + 1, hy + 3, 5, 3, WHITE); cv.set(hx, hy + 2, WHITE); cv.set(hx + 6, hy + 2, WHITE)
            cv.rect(hx + hw - 6, hy + 3, 5, 3, WHITE); cv.set(hx + hw - 1, hy + 2, WHITE); cv.set(hx + hw - 7, hy + 2, WHITE)
            cv.hline(hx + 1, hx + hw - 2, hy + 9, WHITE)
            for xx in (hx + 2, hx + 5, hx + hw - 3, hx + hw - 6): cv.set(xx, hy + 10, WHITE)
        elif hid == "wolverine":
            cv.rect(hx, hy, hw, 12, suit)
            cv.rect(hx + 2, hy + 8, hw - 4, 4, skin)
            cv.rect(hx + 1, hy + 3, 5, 3, BLACK); cv.rect(hx + hw - 6, hy + 3, 5, 3, BLACK)
            cv.set(hx + 3, hy + 4, WHITE); cv.set(hx + hw - 4, hy + 4, WHITE)
            cv.line(hx + 1, hy + 1, hx - 2, hy - 3, BLACK, 2); cv.line(hx + hw - 2, hy + 1, hx + hw + 1, hy - 3, BLACK, 2)
            cv.hline(hx + 4, hx + hw - 5, hy + 10, sh(skin, .7))
        elif hid == "deadpool":
            cv.rect(hx, hy, hw, 12, suit)
            cv.rect(hx + 1, hy + 3, 5, 4, BLACK); cv.rect(hx + hw - 6, hy + 3, 5, 4, BLACK)
            cv.rect(hx + 2, hy + 4, 3, 2, WHITE); cv.rect(hx + hw - 5, hy + 4, 3, 2, WHITE)
        elif hid == "gamora":
            cv.rect(hx, hy, hw, 12, (72, 172, 82))
            cv.rect(hx, hy, hw, 2, (40, 22, 46))
            cv.vline(hx, hy, hy + 12, (40, 22, 46)); cv.vline(hx + hw - 1, hy, hy + 12, (40, 22, 46))
            cv.set(hx + 2, hy + 1, (190, 60, 70))
            cv.set(hx + 4, hy + 5, BLACK); cv.set(hx + hw - 5, hy + 5, BLACK)
        elif hid == "rocket":
            cv.rect(hx + 1, hy + 1, hw - 2, 11, (140, 100, 60))
            cv.rect(hx + 2, hy - 1, 3, 3, (140, 100, 60)); cv.rect(hx + hw - 5, hy - 1, 3, 3, (140, 100, 60))
            cv.set(hx + 3, hy, (90, 60, 40)); cv.set(hx + hw - 4, hy, (90, 60, 40))
            cv.rect(hx + 4, hy + 6, hw - 8, 4, (220, 200, 170))
            cv.set(hx + hw // 2, hy + 6, BLACK)
            cv.set(hx + 4, hy + 4, BLACK); cv.set(hx + 5, hy + 4, WHITE)
            cv.set(hx + hw - 5, hy + 4, BLACK); cv.set(hx + hw - 6, hy + 4, WHITE)
        elif hid == "groot":
            cv.rect(hx, hy, hw, 12, BARK)
            cv.vline(hx + 3, hy, hy + 11, sh(BARK, .7)); cv.vline(hx + hw - 4, hy + 2, hy + 11, sh(BARK, .7))
            cv.line(hx, hy + 3, hx - 3, hy + 1, BARK, 2); cv.line(hx + hw - 1, hy + 4, hx + hw + 2, hy + 2, BARK, 2)
            cv.rect(hx + 3, hy + 5, 3, 2, (40, 26, 16)); cv.rect(hx + hw - 6, hy + 5, 3, 2, (40, 26, 16))
            cv.set(hx + 4, hy + 5, (120, 160, 90)); cv.set(hx + hw - 5, hy + 5, (120, 160, 90))
    return f

# ---------------------------------------------------------------- emblems
def EMBLEMS(hid):
    def f(cv, c, tx, ty, tw):
        cx = tx + tw // 2
        if hid in ("spiderman", "spiderman_classic"):
            cv.set(cx, ty + 4, BLACK)
            for d in ((-3, -1), (3, -1), (-3, 2), (3, 2), (-2, -2), (2, -2), (-2, 3), (2, 3)):
                cv.set(cx + d[0], ty + 4 + d[1], BLACK)
        elif hid == "miles":
            cv.set(cx, ty + 4, c["accent"])
            for d in ((-3, -1), (3, -1), (-3, 2), (3, 2)): cv.set(cx + d[0], ty + 4 + d[1], c["accent"])
        elif hid == "gwen":
            cv.set(cx, ty + 4, BLACK)
            for d in ((-2, -1), (2, -1), (-2, 2), (2, 2)): cv.set(cx + d[0], ty + 4 + d[1], BLACK)
        elif hid == "ironman":
            cv.disc(cx, ty + 4, 2, CYAN); cv.set(cx, ty + 4, WHITE)
        elif hid == "capamerica":
            cv.set(cx, ty + 4, WHITE)
            for d in ((0, -2), (0, 2), (-2, 0), (2, 0), (-1, -1), (1, -1), (-1, 1), (1, 1)): cv.set(cx + d[0], ty + 4 + d[1], WHITE)
        elif hid == "thor":
            cv.disc(tx + 4, ty + 3, 1.6, SILV); cv.disc(tx + tw - 5, ty + 3, 1.6, SILV)
            cv.line(tx + 2, ty + 1, tx + tw - 3, ty + 6, sh(c["suit"], .7), 1)
        elif hid == "blackwidow":
            cv.set(cx, ty + 3, c["accent"]); cv.set(cx - 1, ty + 4, c["accent"]); cv.set(cx + 1, ty + 4, c["accent"])
            cv.set(cx, ty + 5, c["accent"]); cv.set(cx - 1, ty + 6, c["accent"]); cv.set(cx + 1, ty + 6, c["accent"])
        elif hid == "hawkeye":
            cv.line(tx + 1, ty + 1, tx + tw - 2, ty + 7, BLACK, 1)
            cv.set(cx, ty + 4, c["accent"])
        elif hid == "drstrange":
            cv.disc(cx, ty + 4, 1.6, c["accent"]); cv.set(cx, ty + 4, WHITE)
        elif hid in ("scarletwitch", "scarletwitch_azure"):
            cv.vline(cx - 3, ty + 2, ty + 8, sh(c["suit"], .7)); cv.vline(cx + 3, ty + 2, ty + 8, sh(c["suit"], .7))
        elif hid == "blackpanther":
            for i in range(5): cv.set(tx + 3 + i * 2, ty + 1, SILV)
        elif hid in ("captainmarvel", "captainmarvel_classic"):
            cv.set(cx, ty + 4, GOLD)
            for d in ((0, -2), (0, 2), (-2, 0), (2, 0), (-1, -1), (1, -1), (-1, 1), (1, 1)): cv.set(cx + d[0], ty + 4 + d[1], GOLD)
        elif hid == "antman" or hid == "antman_unmasked":
            cv.set(cx, ty + 3, SILV); cv.set(cx, ty + 4, SILV); cv.set(cx, ty + 5, SILV)
        elif hid == "venom":
            cv.set(cx, ty + 5, WHITE)
            for d in ((-4, -2), (4, -2), (-4, 3), (4, 3), (-2, -3), (2, -3), (-2, 4), (2, 4), (-5, 0), (5, 0)):
                cv.set(cx + d[0], ty + 5 + d[1], WHITE)
        elif hid == "wolverine":
            cv.line(tx + 2, ty + 1, tx + tw - 3, ty + 8, BLACK, 1); cv.line(tx + tw - 3, ty + 1, tx + 2, ty + 8, BLACK, 1)
        elif hid == "deadpool":
            cv.hline(tx + 1, tx + tw - 2, ty + 7, (110, 70, 40))
            cv.set(tx + 4, ty + 7, BLACK); cv.set(tx + tw - 5, ty + 7, BLACK)
        elif hid == "gamora":
            cv.line(tx + 2, ty + 1, tx + tw - 3, ty + 6, (60, 40, 50), 1)
        elif hid == "rocket":
            cv.line(tx + 2, ty + 1, tx + tw - 3, ty + 7, (220, 120, 40), 1)
            cv.rect(tx + tw - 6, ty + 6, 4, 4, (90, 90, 100))
        elif hid == "groot":
            cv.vline(cx - 2, ty + 2, ty + 9, sh(BARK, .75)); cv.vline(cx + 3, ty + 1, ty + 8, sh(BARK, .8))
        elif hid == "hulk":
            cv.line(tx + 3, ty + 2, cx, ty + 5, sh(c["suit"], .8), 2); cv.line(tx + tw - 4, ty + 2, cx, ty + 5, sh(c["suit"], .8), 2)
    return f

# ---------------------------------------------------------------- unique attack / power
ATK_POSE = {
 "thor": [((14, 24), (26, 10)), ((13, 24), (32, 6)), ((13, 25), (40, 16)), ((14, 26), (38, 26))],
 "capamerica": [((14, 25), (24, 18)), ((13, 25), (32, 16)), ((13, 25), (40, 16)), ((14, 26), (36, 20))],
 "hulk": [((18, 10), (30, 10)), ((18, 6), (32, 6)), ((22, 26), (32, 34)), ((20, 30), (30, 36))],
 "hawkeye": [((22, 22), (30, 20)), ((16, 22), (30, 22)), ((16, 22), (34, 22)), ((20, 23), (34, 22))],
 "blackwidow": [((14, 24), (30, 16)), ((13, 26), (38, 14)), ((14, 24), (38, 24)), ((14, 26), (34, 26))],
 "wolverine": [((14, 24), (30, 14)), ((13, 25), (38, 16)), ((14, 24), (38, 24)), ((14, 26), (34, 26))],
 "deadpool": [((14, 22), (30, 10)), ((14, 24), (38, 14)), ((14, 24), (38, 24)), ((14, 26), (34, 26))],
 "hawkeye2": [],
 "drstrange": [((14, 26), (34, 20)), ((14, 26), (38, 20)), ((14, 26), (40, 20)), ((14, 26), (36, 22))],
 "scarletwitch": [((14, 26), (32, 18)), ((14, 26), (36, 18)), ((14, 26), (38, 18)), ((14, 26), (36, 20))],
 "scarletwitch_azure": [((14, 26), (32, 18)), ((14, 26), (36, 18)), ((14, 26), (38, 18)), ((14, 26), (36, 20))],
 "venom": [((14, 26), (34, 18)), ((14, 26), (38, 16)), ((14, 26), (40, 20)), ((14, 26), (36, 24))],
 "rocket": [((14, 26), (32, 20)), ((14, 26), (36, 20)), ((14, 26), (38, 20)), ((14, 26), (36, 22))],
 "groot": [((14, 26), (30, 20)), ((14, 26), (36, 20)), ((14, 26), (40, 20)), ((14, 26), (36, 24))],
 "blackpanther": [((14, 24), (30, 16)), ((14, 25), (38, 18)), ((14, 25), (40, 22)), ((14, 26), (36, 24))],
 "captainmarvel": [((14, 25), (28, 18)), ((13, 25), (36, 18)), ((13, 25), (41, 20)), ((14, 26), (37, 22))],
}
POW_POSE = {
 "thor": [((14, 20), (30, 6)), ((14, 18), (30, 4)), ((14, 20), (34, 8)), ((14, 24), (36, 14))],
 "hulk": [((16, 10), (30, 10)), ((16, 6), (32, 6)), ((20, 28), (30, 34)), ((18, 32), (30, 36))],
 "ironman": [((14, 26), (34, 20)), ((14, 26), (38, 20)), ((14, 26), (40, 20)), ((14, 26), (40, 20))],
 "capamerica": [((14, 24), (34, 14)), ((14, 24), (14, 14)), ((14, 24), (34, 26)), ((14, 24), (36, 18))],
 "drstrange": [((16, 14), (32, 14)), ((14, 12), (34, 12)), ((12, 12), (36, 12)), ((12, 14), (36, 14))],
 "venom": [((12, 16), (36, 16)), ((10, 12), (38, 12)), ((10, 14), (38, 14)), ((12, 18), (36, 18))],
 "captainmarvel": [((12, 22), (36, 22)), ((10, 18), (38, 18)), ((10, 16), (38, 16)), ((12, 18), (36, 18))],
}

def ATK_FX(hid):
    def f(cv, c, fi, H):
        hx2, hy2 = H["handR"]; hx1, hy1 = H["handL"]
        if hid in ("spiderman", "spiderman_classic", "miles", "gwen"):
            col = WHITE if hid != "miles" else (255, 240, 240)
            if fi >= 1:
                cv.line(hx2 + 2, hy2, 46, hy2 - 2, col, 1)
                cv.line(hx2 + 2, hy2 + 1, 46, hy2 + 2, col, 1)
                cv.set(46, hy2 - 2, c["accent"]); cv.set(45, hy2 - 3, c["accent"])
        elif hid == "ironman":
            if fi >= 1:
                cv.line(hx2 + 2, hy2, 46, hy2, CYAN, 2); cv.set(46, hy2, WHITE)
                cv.disc(hx2 + 1, hy2, 1.5 + fi * .5, CYAN)
        elif hid == "thor":
            cv.line(hx2, hy2, hx2 + 5, hy2 - 7, (120, 90, 50), 2)
            cv.rect(hx2 + 2, hy2 - 12, 9, 5, SILV); cv.set(hx2 + 6, hy2 - 10, WHITE)
            if fi >= 2:
                for i in range(3): cv.set(hx2 + 10 - i * 3, hy2 - 12 + i * 3, CYAN)
        elif hid == "capamerica":
            sx = 30 + fi * 5
            cv.disc(sx, hy2, 4, RED); cv.disc(sx, hy2, 2.6, WHITE); cv.disc(sx, hy2, 1.3, BLUE)
            if fi >= 1: cv.line(hx2 + 2, hy2, sx - 4, hy2, WHITE, 1)
        elif hid == "hulk":
            if fi >= 2:
                cv.line(hx2, hy2, hx2 + 3, 43, c["skin"], 3)
                for i in range(4):
                    cv.set(30 + i * 4, 44, (200, 190, 160)); cv.set(32 + i * 4, 42 - (i % 2) * 2, (200, 190, 160))
                cv.hline(20, 44, 44, (200, 190, 160))
        elif hid == "blackwidow":
            cv.line(hx2, hy2, hx2 + 7, hy2 - 4, BLACK, 2); cv.line(hx1, hy1, hx1 - 7, hy1 - 4, BLACK, 2)
            if fi >= 1: cv.set(hx2 + 7, hy2 - 4, (255, 220, 80)); cv.set(hx2 + 8, hy2 - 5, (130, 240, 255))
        elif hid == "hawkeye":
            cv.line(hx1 + 1, hy1 - 6, hx1 + 1, hy1 + 6, (120, 90, 50), 1)
            cv.line(hx1 + 1, hy1 - 6, hx1 + 4, hy1, (200, 200, 210), 1); cv.line(hx1 + 1, hy1 + 6, hx1 + 4, hy1, (200, 200, 210), 1)
            if fi >= 2:
                cv.line(hx2 + 2, hy2, 46, hy2, WHITE, 1)
                cv.set(46, hy2, c["accent"]); cv.set(45, hy2 - 1, c["accent"])
        elif hid == "blackpanther":
            for i in (-2, 0, 2):
                cv.line(hx2 - 4 + fi, hy2 + i, hx2 + 5 + fi, hy2 + i + 2, SILV, 1)
        elif hid in ("wolverine",):
            for i in (-2, 0, 2): cv.line(hx2, hy2 + i, hx2 + 8, hy2 + i + 1, SILV, 1)
            if fi >= 2:
                for i in (-2, 0, 2): cv.line(hx2 + 2, hy2 + i + 3, hx2 + 9, hy2 + i + 2, WHITE, 1)
        elif hid == "deadpool":
            cv.line(hx2, hy2, hx2 + 8, hy2 - 6, SILV, 2)
            if fi >= 1:
                cv.line(hx2 - 2, hy2 + 4, hx2 + 8, hy2 - 4, WHITE, 1)
            if fi >= 2:
                cv.line(hx2 + 8, hy2 + 4, hx2 - 2, hy2 - 4, WHITE, 1)
        elif hid == "drstrange":
            r = 2 + fi
            cv.disc(hx2 + 3, hy2, r, c["accent"])
            for a in range(4):
                aa = a / 4 * 2 * math.pi + fi
                cv.set(hx2 + 3 + r * math.cos(aa), hy2 + r * math.sin(aa), GOLD)
        elif hid in ("scarletwitch", "scarletwitch_azure"):
            r = 1 + fi
            for d in ((0, -r), (r, 0), (0, r), (-r, 0)): cv.set(hx2 + 2 + d[0], hy2 + d[1], c["accent"])
            cv.set(hx2 + 2, hy2, WHITE)
        elif hid == "venom":
            tl = 4 + fi * 3
            cv.line(hx1 - 2, hy1 - 8, hx1 - 2 + tl, hy1 - 8 + (fi % 2) * 2, c["accent"], 2)
            if fi >= 2:
                for i in (-2, 0, 2): cv.line(hx2, hy2 + i, hx2 + 7, hy2 + i + 1, WHITE, 1)
        elif hid == "captainmarvel" or hid == "captainmarvel_classic":
            if fi >= 1:
                cv.disc(hx2 + 1, hy2, 2 + fi * .7, GOLD); cv.set(hx2 + 1, hy2, WHITE)
        elif hid == "rocket":
            cv.rect(hx2, hy2 - 1, 6, 3, (90, 90, 100))
            if fi >= 1:
                cv.line(hx2 + 6, hy2, 46, hy2, (255, 160, 40), 2)
                cv.disc(hx2 + 6, hy2, 1.5, (255, 220, 80))
        elif hid == "groot":
            ln = 4 + fi * 4
            cv.line(hx2, hy2, hx2 + ln, hy2 - 2, BARK, 2)
            cv.line(hx2 + 2, hy2 + 2, hx2 + ln - 2, hy2 + 3, sh(BARK, .8), 2)
        elif hid == "gamora":
            cv.line(hx2, hy2, hx2 + 8, hy2 - 6, SILV, 2)
            if fi >= 1: cv.line(hx2 + 2, hy2 + 2, hx2 + 9, hy2 - 5, (130, 255, 170), 1)
        elif hid == "thor2":
            pass
        else:  # antman & fallback punch
            cv.line(hx2 + 2, hy2, hx2 + 8, hy2, WHITE, 1)
            cv.set(hx2 + 8, hy2 - 1, c["accent"]); cv.set(hx2 + 8, hy2 + 1, c["accent"])
    return f

def POW_FX(hid):
    def f(cv, c, fi, H):
        hx2, hy2 = H["handR"]; hx1, hy1 = H["handL"]
        if hid in ("spiderman", "spiderman_classic", "gwen"):
            for a in range(8):
                aa = a / 8 * 2 * math.pi
                cv.line(hx2 + 2 * math.cos(aa), hy2 + 2 * math.sin(aa), hx2 + (6 + fi * 2) * math.cos(aa), hy2 + (6 + fi * 2) * math.sin(aa), WHITE, 1)
            cv.disc(hx2, hy2, 1.5, c["accent"])
        elif hid == "miles":
            for d in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                cv.line(hx2 + d[0] * 2, hy2 + d[1] * 2, hx2 + d[0] * (4 + fi), hy2 + d[1] * (4 + fi), (255, 220, 60), 1)
            cv.set(hx1, hy1 - 2, (255, 220, 60))
        elif hid == "ironman":
            cv.line(26, 22, 47, 18 + fi, WHITE, 3)
            cv.line(26, 22, 47, 22, CYAN, 1)
            cv.disc(25, 22, 2 + fi * .5, CYAN)
        elif hid == "thor":
            for i in range(3 + fi):
                xx = 30 + (i % 3) * 4
                cv.line(xx, 0, xx + 2, 10 + i * 2, CYAN, 1)
            if fi >= 2: cv.disc(hx2 + 4, hy2 - 6, 3, CYAN)
        elif hid == "capamerica":
            px, py = [(24, 8), (12, 20), (36, 26), (30, 12)][fi]
            cv.disc(px, py, 4, RED); cv.disc(px, py, 2.6, WHITE); cv.disc(px, py, 1.3, BLUE)
            cv.line(hx2, hy2, px, py, WHITE, 1)
        elif hid == "hulk":
            r = 4 + fi * 4
            cv.line(24 - r, 44, 24 + r, 44, (200, 190, 160), 2)
            cv.set(24 - r, 42, (200, 190, 160)); cv.set(24 + r, 42, (200, 190, 160))
            for i in range(fi + 1): cv.set(18 + i * 5, 40 - i * 2, (140, 130, 110))
        elif hid == "blackwidow":
            for s in (hx1, hx2):
                for i in range(3):
                    cv.line(s, 20 - i * 2, s + (2 if s > 24 else -2) * (i % 2 or 1), 14 - i * 2, CYAN, 1)
        elif hid == "hawkeye":
            for dy in (-4, 0, 4):
                cv.line(hx2, hy2, 46, hy2 + dy, WHITE, 1)
                cv.set(46, hy2 + dy, c["accent"])
        elif hid == "blackpanther":
            r = 6 + fi * 4
            for a in range(10):
                aa = a / 10 * 2 * math.pi
                cv.set(24 + r * math.cos(aa), 24 + r * .8 * math.sin(aa), (170, 120, 255))
        elif hid == "wolverine":
            r = 5 + fi * 3
            for a in range(8):
                aa = a / 8 * 2 * math.pi + fi
                cv.line(24 + r * math.cos(aa), 24 + r * .7 * math.sin(aa), 24 + (r + 3) * math.cos(aa), 24 + (r + 3) * .7 * math.sin(aa), SILV, 1)
        elif hid == "deadpool":
            cv.line(14, 12, 34 + fi, 32, WHITE, 2); cv.line(34 + fi, 12, 14, 32, WHITE, 2)
        elif hid == "drstrange":
            r = 6 + fi * 2
            cv.disc(hx2 + 4, hy2, r, c["accent"])
            for a in range(6):
                aa = a / 6 * 2 * math.pi + fi * .8
                cv.set(hx2 + 4 + (r - 1) * math.cos(aa), hy2 + (r - 1) * math.sin(aa), GOLD)
        elif hid in ("scarletwitch", "scarletwitch_azure"):
            r = 3 + fi * 3
            for a in range(8):
                aa = a / 8 * 2 * math.pi + fi * .5
                cv.set(24 + r * math.cos(aa), 20 + r * .8 * math.sin(aa), c["accent"])
            cv.set(24, 20, WHITE)
        elif hid == "venom":
            for i in range(4 + fi):
                xx = 16 + i * 4
                cv.line(xx, 20, xx - 2, 6 - (i % 3) * 2, c["suit"], 2)
                cv.set(xx - 2, 6 - (i % 3) * 2, WHITE)
        elif hid in ("captainmarvel", "captainmarvel_classic"):
            for a in range(12):
                aa = a / 12 * 2 * math.pi
                cv.set(24 + (8 + fi * 2) * math.cos(aa), 22 + (8 + fi * 2) * .8 * math.sin(aa), GOLD)
            cv.disc(hx2, hy2, 2, GOLD); cv.disc(hx1, hy1, 2, GOLD)
        elif hid == "rocket":
            cv.disc(38, 18, 3 + fi * 2, (255, 160, 40))
            cv.disc(38, 18, 1.5 + fi, (255, 220, 80))
            for a in range(6):
                aa = a / 6 * 2 * math.pi
                cv.line(38 + 4 * math.cos(aa), 18 + 4 * math.sin(aa), 38 + (6 + fi * 2) * math.cos(aa), 18 + (6 + fi * 2) * math.sin(aa), (255, 160, 40), 1)
        elif hid == "groot":
            for a in range(8):
                aa = a / 8 * 2 * math.pi
                cv.line(24 + 4 * math.cos(aa), 24 + 4 * math.sin(aa), 24 + (8 + fi * 3) * math.cos(aa), 24 + (8 + fi * 3) * math.sin(aa), BARK, 2)
        elif hid == "gamora":
            r = 6 + fi * 3
            for a in range(9):
                aa = a / 9 * 2 * math.pi + fi
                cv.set(24 + r * math.cos(aa), 22 + r * .8 * math.sin(aa), (130, 255, 170))
        elif hid == "thor":
            pass
        else:
            n = 3 + fi * 3
            for i in range(n):
                a = i / n * 2 * math.pi + fi
                r = 10 + fi * 3
                cv.set(24 + r * math.cos(a), 22 + r * .8 * math.sin(a), c["accent"])
    return f

HEAD_FN = {h: HEADS(h) for h in HEROES}
EMB_FN = {h: EMBLEMS(h) for h in HEROES}
ATK_FN = {h: ATK_FX(h) for h in HEROES}
POW_FN = {h: POW_FX(h) for h in HEROES}

def draw_frame(cv, cfg, anim, fi):
    hid = cfg["id"]
    big = cfg.get("big")
    suit, suit2, acc, skin = cfg["suit"], cfg["suit2"], cfg["accent"], cfg["skin"]
    dS = sh(suit, .72)
    bob = 0; lean = 0
    legL = legR = (0, 0)
    handL = handR = None
    if anim == "idle":
        bob = [0, 1, 1, 0][fi]
    elif anim == "walk":
        t = fi / 6 * 2 * math.pi
        bob = 1 if fi in (1, 2, 4, 5) else 0
        legL = (round(3 * math.cos(t)), max(0, round(3 * math.sin(t))))
        legR = (round(3 * math.cos(t + math.pi)), max(0, round(3 * math.sin(t + math.pi))))
        handL = (14 - round(3 * math.cos(t + math.pi)), 26 + bob)
        handR = (33 + round(3 * math.cos(t + math.pi)), 26 + bob)
    elif anim == "attack":
        poses = ATK_POSE.get(hid)
        if poses: handL, handR = poses[fi]
        else:
            if fi == 0: handR, handL = (28, 20), (14, 25)
            elif fi == 1: handR, handL = (38, 22), (13, 25)
            elif fi == 2: handR, handL = (41, 24), (13, 26)
            else: handR, handL = (34, 27), (14, 26)
    elif anim == "power":
        poses = POW_POSE.get(hid)
        if poses: handL, handR = poses[fi]
        else:
            bob = [1, 0, -1, 0][fi]
            handL = (12 - fi, 20 - fi * 3); handR = (35 + fi, 20 - fi * 3)
    elif anim == "emote":
        em = cfg.get("em")
        if em == "dance":
            bob = [0, 1, 0, 1][fi]; s = 1 if fi % 2 == 0 else -1
            handL = (13 - 2 * s, 15 if s > 0 else 7); handR = (35 + 2 * s, 7 if s > 0 else 15)
            legL = (2 * s, 0); legR = (-2 * s, 0)
        elif em == "wave":
            bob = fi % 2; handR = (36 + (fi % 2) * 2, 7); handL = (15, 27)
        elif em == "cheer":
            bob = [0, -1, -1, 0][fi]; handL = (11, 6); handR = (37, 6)
        elif em == "flex":
            handL = (12, 15 if fi in (1, 3) else 13); handR = (36, 15 if fi in (1, 3) else 13)
        elif em == "bow":
            lean = [0, 2, 2, 1][fi]; handL = (16, 26); handR = (32, 26)
        elif em == "laugh":
            bob = [0, -1, 0, -1][fi]; handL = (20, 27); handR = (28, 27)
        elif em == "salute":
            handR = (30, 7); handL = (15, 27)
        elif em == "heart":
            handL = (21, 5); handR = (27, 5)
        elif em == "shrug":
            handL = (9, 20); handR = (39, 20); bob = [0, 1, 0, 0][fi]
        elif em == "point":
            handR = (40, 19); handL = (17, 26)

    # back props behind body
    if cfg.get("cape"):
        sway = [0, 1, 1, 2][fi % 4]
        for i in range(4):
            cv.hline(15 - i // 2, 32 + i // 2, 20 + i * 3 + sway + bob, sh(cfg["cape"], 1 - i * .07))
        cv.rect(15, 18 + bob, 18, 3, cfg["cape"])
    if hid == "deadpool":
        cv.line(18, 14 + bob, 14, 24 + bob, (110, 70, 40), 2); cv.line(30, 14 + bob, 34, 24 + bob, (110, 70, 40), 2)
        cv.set(18, 13 + bob, SILV); cv.set(30, 13 + bob, SILV)
    if hid == "hawkeye":
        cv.rect(14, 18 + bob, 4, 10, (110, 70, 40))
        for i in range(3): cv.set(15 + (i % 2), 17 + bob, SILV)

    # legs
    hipL, hipR = (20, 31 + bob), (27, 31 + bob)
    if big: hipL, hipR = (18, 31 + bob), (29, 31 + bob)
    for hip, (dx, lift) in ((hipL, legL), (hipR, legR)):
        knee = (hip[0] + dx * .5, 37 + bob - lift * .3)
        foot = (hip[0] + dx, 43 - lift)
        cv.line(hip[0], hip[1], knee[0], knee[1], sh(suit2, .85), 3 if big else 2)
        cv.line(knee[0], knee[1], foot[0], foot[1], suit2, 3 if big else 2)
        cv.line(foot[0] - 1, foot[1], foot[0] + 2, foot[1], BLACK, 1)

    # torso
    tw = 22 if big else 16
    tx = 24 - tw // 2
    cv.rect(tx, 18 + bob, tw, 13, suit)
    cv.vline(tx + tw - 2, 18 + bob, 30 + bob, dS)
    cv.vline(tx + tw - 1, 18 + bob, 30 + bob, dS)
    cv.hline(tx, tx + tw - 1, 18 + bob, sh(suit, 1.25))
    cv.hline(tx, tx + tw - 1, 30 + bob, acc)

    # arms
    shL, shR = (tx + 1, 20 + bob), (tx + tw - 2, 20 + bob)
    if handL is None: handL = (tx - 1, 27 + bob)
    if handR is None: handR = (tx + tw + 1, 27 + bob)
    acol = skin if big else suit
    cv.limb(shL[0], shL[1], handL[0], handL[1], -2, sh(acol, .9), 3 if big else 2)
    cv.limb(shR[0], shR[1], handR[0], handR[1], 2, acol, 3 if big else 2)
    cv.disc(handL[0], handL[1], 1.4, skin if big else acc)
    cv.disc(handR[0], handR[1], 1.4, skin if big else acc)

    # idle signature props
    if anim in ("idle", "walk"):
        if hid == "thor":
            cv.line(handR[0] + 1, handR[1] - 6, handR[0] + 1, handR[1] + 2, (120, 90, 50), 2)
            cv.rect(handR[0] - 2, handR[1] - 9, 7, 4, SILV); cv.set(handR[0] - 1, handR[1] - 8, WHITE)
        if hid == "hawkeye":
            cv.line(tx - 3, 16 + bob, tx - 3, 30 + bob, (120, 90, 50), 1)
            cv.line(tx - 3, 16 + bob, tx - 1, 23 + bob, (200, 200, 210), 1); cv.line(tx - 3, 30 + bob, tx - 1, 23 + bob, (200, 200, 210), 1)
        if hid == "capamerica":
            cv.disc(tx - 3, 24 + bob, 4, RED); cv.disc(tx - 3, 24 + bob, 2.6, WHITE); cv.disc(tx - 3, 24 + bob, 1.3, BLUE)

    # emblem + head
    EMB_FN[hid](cv, cfg, tx, 18 + bob, tw)
    hw = 15 if big else 14
    hx = 24 - hw // 2 + lean
    hy = 5 + bob + lean
    HEAD_FN[hid](cv, cfg, hx, hy, hw, bob)

    outline(cv)

    H = dict(handL=handL, handR=handR, hx=hx, hy=hy)
    if anim == "attack": ATK_FN[hid](cv, cfg, fi, H)
    if anim == "power": POW_FN[hid](cv, cfg, fi, H)
    if anim == "emote":
        em = cfg.get("em")
        if em == "flex" and fi in (1, 3): cv.set(9, 11, acc); cv.set(38, 11, acc)
        if em == "laugh" and fi in (1, 3): cv.set(33, 3, WHITE); cv.set(35, 5, WHITE)
        if em == "heart":
            for d in ((22, 1), (26, 1), (21, 2), (27, 2), (22, 3), (26, 3), (23, 4), (25, 4), (24, 5)):
                cv.set(d[0], d[1], PINK)
        if em == "point" and fi in (1, 2): cv.line(42, 18, 45, 18, WHITE, 1)

def main():
    seq = [("idle", i) for i in range(4)] + [("walk", i) for i in range(6)] + \
          [("attack", i) for i in range(4)] + [("power", i) for i in range(4)]
    for e in EMOTES:
        seq += [(e, i) for i in range(4)]
    for hid, base in HEROES.items():
        cfg = dict(base); cfg["id"] = hid
        strip = HC(FR * len(seq), FR)
        for f, (an, fi) in enumerate(seq):
            fr = HC()
            if an in EMOTES:
                cfg2 = dict(cfg); cfg2["em"] = an
                draw_frame(fr, cfg2, "emote", fi)
            else:
                draw_frame(fr, cfg, an, fi)
            for (x, yy), c in fr.px.items():
                strip.px[(f * FR + x, yy)] = c
        save(hid, strip, folder=ANIM)
    print("hero strips v4 done.")

    # ---- backblings 48px ----
    def wings():
        s = HC(FR * 2, FR)
        for f in range(2):
            cv = HC()
            up = 0 if f == 0 else 3
            for i in range(10):
                h = 14 - abs(i - 4) * 2 + up
                cv.vline(22 - i, 26 - h, 26, WHITE); cv.vline(25 + i, 26 - h, 26, WHITE)
                cv.set(22 - i, 26 - h, GOLD); cv.set(25 + i, 26 - h, GOLD)
            outline(cv)
            for (x, yy), c in cv.px.items(): s.px[(f * FR + x, yy)] = c
        save("glider_wings", s, folder=ANIM)
    def single(name, fn):
        cv = HC(); fn(cv); outline(cv); save(name, cv, folder=ANIM)
    def f_shield(cv):
        cv.disc(24, 24, 12, RED); cv.disc(24, 24, 8.5, WHITE); cv.disc(24, 24, 5, BLUE)
        for d in ((0, -3), (3, 0), (0, 3), (-3, 0), (2, -2), (-2, -2), (2, 2), (-2, 2)): cv.set(24 + d[0], 24 + d[1], WHITE)
    def f_cosmic(cv):
        for yy in range(8, 42):
            w = 6 + (yy - 8) // 2
            cv.hline(24 - w, 24 + w, yy, (62, 22, 112))
            cv.hline(24 - w, 24 - w + 2, yy, (92, 42, 152))
        for (x, yy) in [(20, 14), (28, 20), (17, 26), (30, 30), (23, 36)]: cv.set(x, yy, WHITE)
    def f_claws(cv):
        cv.vline(14, 6, 44, (120, 90, 50))
        cv.rect(15, 8, 22, 22, (20, 20, 26))
        for i in range(3): cv.line(18 + i * 6, 10, 22 + i * 6, 28, SILV, 2)
    wings()
    single("glider_shield", f_shield)
    single("glider_cosmic", f_cosmic)
    single("glider_claws", f_claws)

    # ---- kree arena icon ----
    cv = HC(32, 32)
    cv.disc(16, 16, 13, (40, 46, 70)); cv.disc(16, 16, 11, (60, 70, 105))
    cv.vline(8, 8, 24, (150, 160, 190)); cv.vline(23, 8, 24, (150, 160, 190))
    cv.hline(8, 23, 8, (150, 160, 190))
    cv.line(12, 20, 20, 12, (255, 90, 100), 2); cv.line(12, 12, 20, 20, (130, 240, 255), 2)
    save("mode_kree_arena", cv, folder=SPR)
    print("backblings + arena icon done.")

if __name__ == "__main__":
    main()
