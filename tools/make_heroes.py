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
EMOTES = ['gangnam', 'floss', 'dab', 'moonwalk', 'robot', 'runningman', 'macarena', 'hype', 'heart', 'groove']

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
 "spiderman": dict(boot=(198, 30, 36), suit=(214, 42, 48), suit2=(38, 88, 190), accent=(214, 42, 48), skin=(240, 190, 140), quote="Your friendly neighborhood pixel-slinger."),
 "spiderman_classic": dict(boot=(198, 30, 36), suit=(198, 30, 36), suit2=(28, 66, 158), accent=(198, 30, 36), skin=(240, 190, 140), quote="Classic suit. Classic responsibility."),
 "miles": dict(boot=(198, 30, 36), suit=(24, 24, 30), suit2=(24, 24, 30), accent=(230, 42, 52), skin=(150, 100, 70), quote="Alright, one more swing."),
 "gwen": dict(boot=(24, 24, 30), suit=(240, 240, 246), suit2=(24, 24, 30), accent=(255, 92, 170), skin=(245, 210, 180), quote="You wouldn't get it. It's a whole dimension thing."),
 "venom": dict(boot=(18, 18, 24), suit=(18, 18, 24), suit2=(18, 18, 24), accent=(230, 60, 70), skin=(18, 18, 24), big=True, quote="We are done talking."),
 "ironman": dict(boot=(150, 30, 36), suit=(198, 36, 42), suit2=(150, 30, 36), accent=GOLD, skin=(240, 190, 140), quote="Power at 100 percent. Try to keep up."),
 "capamerica": dict(boot=(150, 30, 36), suit=(40, 90, 190), suit2=(40, 90, 190), accent=RED, skin=(240, 190, 140), quote="I can do this all day."),
 "thor": dict(boot=(60, 60, 74), suit=(90, 100, 125), suit2=(62, 68, 88), accent=GOLD, skin=(245, 210, 180), hair=(250, 220, 120), cape=(198, 36, 48), quote="Bring me that horizon!"),
 "hulk": dict(boot=(40, 110, 50), suit=(72, 172, 82), suit2=(122, 72, 172), accent=(72, 172, 82), skin=(72, 172, 82), big=True, quote="Puny menu. HULK SMASH."),
 "wolverine": dict(boot=(250, 200, 44), suit=(250, 200, 44), suit2=(40, 90, 190), accent=(250, 200, 44), skin=(240, 190, 140), quote="Bub, I don't line up."),
 "blackwidow": dict(boot=(30, 30, 38), suit=(30, 30, 38), suit2=(30, 30, 38), accent=GOLD, skin=(245, 210, 180), hair=(172, 52, 42), quote="Red in my ledger. You're adding to it."),
 "hawkeye": dict(boot=(62, 42, 92), suit=(122, 62, 172), suit2=(62, 42, 92), accent=(248, 248, 252), skin=(240, 190, 140), quote="Wind's fine. I'm better."),
 "drstrange": dict(boot=(120, 60, 40), suit=(42, 72, 162), suit2=(42, 72, 162), accent=(255, 160, 40), skin=(240, 200, 160), hair=(96, 96, 108), cape=(190, 32, 42), quote="Dormammu, I've come to bargain."),
 "scarletwitch": dict(boot=(122, 22, 38), suit=(198, 36, 52), suit2=(122, 22, 38), accent=(255, 92, 100), skin=(245, 210, 180), hair=(150, 32, 40), quote="You have no idea what I can do."),
 "scarletwitch_azure": dict(boot=(32, 52, 122), suit=(52, 92, 202), suit2=(32, 52, 122), accent=(130, 205, 255), skin=(245, 210, 180), hair=(150, 32, 40), quote="Chaos, but make it cool."),
 "blackpanther": dict(boot=(28, 28, 36), suit=(28, 28, 36), suit2=(28, 28, 36), accent=SILV, skin=(28, 28, 36), quote="Wakanda forever."),
 "captainmarvel": dict(boot=(198, 36, 48), suit=(42, 72, 172), suit2=(198, 36, 48), accent=GOLD, skin=(245, 210, 180), hair=(250, 220, 120), quote="Higher. Further. Faster."),
 "captainmarvel_classic": dict(boot=(198, 36, 48), suit=(42, 72, 172), suit2=(42, 72, 172), accent=GOLD, skin=(245, 210, 180), hair=(250, 220, 120), quote="The original star-spangled problem."),
 "antman": dict(boot=(32, 32, 38), suit=(142, 26, 42), suit2=(32, 32, 38), accent=SILV, skin=(240, 190, 140), quote="It's not size, it's timing."),
 "antman_unmasked": dict(boot=(32, 32, 38), suit=(142, 26, 42), suit2=(32, 32, 38), accent=SILV, skin=(240, 190, 140), hair=(122, 82, 42), quote="Scott Lang. Mostly reformed."),
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
            cv.rect(hx, hy, hw, 13, suit)
            dk = sh(suit, .5)
            cv.vline(hx + hw // 2, hy, hy + 12, dk)
            for yy in (hy + 2, hy + 9, hy + 11): cv.hline(hx, hx + hw - 1, yy, dk)
            for i in range(4):
                cv.set(hx + 1 + i, hy + 1 + (i // 3), dk); cv.set(hx + hw - 2 - i, hy + 1 + (i // 3), dk)
            cv.rect(hx + 1, hy + 4, 6, 4, BLACK); cv.rect(hx + hw - 7, hy + 4, 6, 4, BLACK)
            cv.rect(hx + 2, hy + 5, 4, 2, WHITE); cv.set(hx + 1, hy + 5, WHITE)
            cv.rect(hx + hw - 6, hy + 5, 4, 2, WHITE); cv.set(hx + hw - 2, hy + 5, WHITE)
        elif hid == "miles":
            cv.rect(hx, hy, hw, 13, suit)
            dk = sh(c["accent"], .45)
            cv.vline(hx + hw // 2, hy, hy + 12, dk)
            for yy in (hy + 2, hy + 10): cv.hline(hx, hx + hw - 1, yy, dk)
            cv.rect(hx + 1, hy + 4, 6, 4, c["accent"]); cv.rect(hx + hw - 7, hy + 4, 6, 4, c["accent"])
            cv.rect(hx + 2, hy + 5, 4, 2, WHITE); cv.set(hx + 1, hy + 5, WHITE)
            cv.rect(hx + hw - 6, hy + 5, 4, 2, WHITE); cv.set(hx + hw - 2, hy + 5, WHITE)
        elif hid == "gwen":
            cv.rect(hx - 1, hy - 1, hw + 2, 15, suit)
            cv.hline(hx - 1, hx + hw, hy - 1, PINK)
            cv.set(hx - 1, hy, PINK); cv.set(hx + hw, hy, PINK)
            cv.rect(hx + 3, hy + 3, hw - 6, 9, (44, 40, 50))
            cv.rect(hx + 4, hy + 4, hw - 8, 7, skin)
            cv.rect(hx + 5, hy + 6, 2, 2, WHITE); cv.rect(hx + hw - 7, hy + 6, 2, 2, WHITE)
            cv.set(hx + 3, hy + 3, PINK); cv.set(hx + hw - 4, hy + 3, PINK)
        elif hid == "ironman":
            cv.rect(hx, hy, hw, 13, suit)
            cv.hline(hx + 2, hx + hw - 3, hy + 1, sh(suit, 1.35))
            cv.rect(hx + 4, hy + 3, hw - 8, 9, GOLD)
            cv.hline(hx + 4, hx + hw - 5, hy + 3, sh(GOLD, 1.3))
            cv.rect(hx + 5, hy + 5, 3, 1, WHITE); cv.rect(hx + hw - 8, hy + 5, 3, 1, WHITE)
            cv.set(hx + 5, hy + 6, CYAN); cv.set(hx + hw - 6, hy + 6, CYAN)
            cv.hline(hx + 6, hx + hw - 7, hy + 9, sh(GOLD, .55))
            cv.vline(hx + 2, hy + 3, hy + 11, sh(suit, .7)); cv.vline(hx + hw - 3, hy + 3, hy + 11, sh(suit, .7))
        elif hid == "capamerica":
            cv.rect(hx, hy, hw, 13, suit)
            cv.rect(hx + 3, hy + 8, hw - 6, 5, skin)
            cv.rect(hx + 2, hy + 4, 4, 2, WHITE); cv.rect(hx + hw - 6, hy + 4, 4, 2, WHITE)
            cv.set(hx + 3, hy + 4, BLACK); cv.set(hx + hw - 4, hy + 4, BLACK)
            cv.set(hx + hw // 2, hy + 1, WHITE); cv.set(hx + hw // 2 - 1, hy + 2, WHITE); cv.set(hx + hw // 2 + 1, hy + 2, WHITE)
            cv.set(hx - 1, hy + 3, WHITE); cv.set(hx - 1, hy + 5, WHITE); cv.set(hx - 1, hy + 4, WHITE)
            cv.set(hx + hw, hy + 3, WHITE); cv.set(hx + hw, hy + 5, WHITE); cv.set(hx + hw, hy + 4, WHITE)
            cv.hline(hx + 5, hx + hw - 6, hy + 11, sh(skin, .7))
            cv.vline(hx + 2, hy + 8, hy + 12, sh(suit, .7)); cv.vline(hx + hw - 3, hy + 8, hy + 12, sh(suit, .7))
        elif hid == "thor":
            cv.rect(hx, hy, hw, 13, skin)
            cv.rect(hx, hy, hw, 2, hr)
            cv.vline(hx, hy, hy + 13, hr); cv.vline(hx + 1, hy + 2, hy + 13, sh(hr, .85))
            cv.vline(hx + hw - 1, hy, hy + 13, hr); cv.vline(hx + hw - 2, hy + 2, hy + 13, sh(hr, .85))
            cv.set(hx + 3, hy + 2, hr); cv.set(hx + hw - 4, hy + 2, hr)
            cv.set(hx + 4, hy + 5, (70, 130, 200)); cv.set(hx + 5, hy + 5, (70, 130, 200))
            cv.set(hx + hw - 5, hy + 5, (70, 130, 200)); cv.set(hx + hw - 6, hy + 5, (70, 130, 200))
            cv.hline(hx + 4, hx + hw - 5, hy + 4, sh(skin, .8))
            cv.hline(hx + 4, hx + hw - 5, hy + 10, sh(hr, .75)); cv.hline(hx + 5, hx + hw - 6, hy + 11, sh(hr, .65))
        elif hid == "hulk":
            cv.rect(hx - 1, hy, hw + 2, 14, skin)
            cv.rect(hx - 1, hy, hw + 2, 2, (22, 62, 30))
            cv.line(hx + 1, hy + 3, hx + 5, hy + 4, BLACK, 1); cv.line(hx + hw - 2, hy + 3, hx + hw - 6, hy + 4, BLACK, 1)
            cv.set(hx + 3, hy + 5, WHITE); cv.set(hx + hw - 4, hy + 5, WHITE)
            cv.line(hx + 3, hy + 11, hx + hw - 4, hy + 10, sh(skin, .55), 1)
            cv.set(hx + 1, hy + 8, sh(skin, .8)); cv.set(hx + hw - 2, hy + 8, sh(skin, .8))
        elif hid == "blackwidow":
            cv.rect(hx, hy, hw, 13, skin)
            cv.rect(hx, hy, hw, 3, hr)
            cv.vline(hx, hy, hy + 14, hr); cv.vline(hx + hw - 1, hy, hy + 14, hr)
            cv.vline(hx - 1, hy + 3, hy + 14, sh(hr, .8)); cv.vline(hx + hw, hy + 3, hy + 14, sh(hr, .8))
            cv.vline(hx + 1, hy + 2, hy + 12, sh(hr, 1.15)); cv.vline(hx + hw - 2, hy + 2, hy + 12, sh(hr, 1.15))
            cv.hline(hx + 3, hx + 6, hy + 4, BLACK); cv.hline(hx + hw - 7, hx + hw - 4, hy + 4, BLACK)
            cv.set(hx + 4, hy + 5, (70, 140, 170)); cv.set(hx + 5, hy + 5, (70, 140, 170))
            cv.set(hx + hw - 5, hy + 5, (70, 140, 170)); cv.set(hx + hw - 6, hy + 5, (70, 140, 170))
            cv.set(hx + hw // 2, hy + 10, (190, 60, 60)); cv.set(hx + hw // 2 - 1, hy + 10, (190, 60, 60))
        elif hid == "hawkeye":
            cv.rect(hx - 1, hy - 1, hw + 2, 15, suit)
            cv.set(hx + hw // 2, hy - 2, sh(suit, 1.2))
            cv.rect(hx + 2, hy + 2, hw - 4, 10, skin)
            cv.rect(hx + 2, hy + 4, hw - 4, 3, BLACK)
            cv.set(hx + 4, hy + 5, WHITE); cv.set(hx + 5, hy + 5, WHITE)
            cv.set(hx + hw - 5, hy + 5, WHITE); cv.set(hx + hw - 6, hy + 5, WHITE)
            cv.hline(hx + 4, hx + hw - 5, hy + 10, sh(skin, .7))
        elif hid == "drstrange":
            cv.rect(hx, hy, hw, 13, skin)
            cv.rect(hx, hy, hw, 2, hr)
            cv.vline(hx, hy + 1, hy + 6, hr); cv.vline(hx + hw - 1, hy + 1, hy + 6, hr)
            cv.hline(hx + 3, hx + 6, hy + 4, sh(skin, .75)); cv.hline(hx + hw - 7, hx + hw - 4, hy + 4, sh(skin, .75))
            cv.set(hx + 4, hy + 5, (80, 120, 170)); cv.set(hx + hw - 5, hy + 5, (80, 120, 170))
            cv.hline(hx + 4, hx + hw - 5, hy + 9, (95, 75, 62))
            cv.set(hx + 3, hy + 9, hr); cv.set(hx + hw - 4, hy + 9, hr)
            cv.set(hx + hw // 2, hy + 10, (95, 75, 62)); cv.set(hx + hw // 2, hy + 11, (95, 75, 62)); cv.set(hx + hw // 2, hy + 12, (95, 75, 62))
            cv.rect(hx - 2, hy + 8, 2, 5, c.get("cape", RED)); cv.rect(hx + hw, hy + 8, 2, 5, c.get("cape", RED))
            cv.set(hx - 2, hy + 7, sh(c.get("cape", RED), 1.2)); cv.set(hx + hw + 1, hy + 7, sh(c.get("cape", RED), 1.2))
        elif hid in ("scarletwitch", "scarletwitch_azure"):
            cv.rect(hx, hy, hw, 13, skin)
            cv.rect(hx, hy, hw, 3, hr)
            cv.vline(hx, hy, hy + 14, hr); cv.vline(hx + hw - 1, hy, hy + 14, hr)
            cv.vline(hx - 1, hy + 4, hy + 14, sh(hr, .85)); cv.vline(hx + hw, hy + 4, hy + 14, sh(hr, .85))
            cv.set(hx + hw // 2 - 3, hy, c["accent"]); cv.set(hx + hw // 2 - 1, hy - 1, c["accent"]); cv.set(hx + hw // 2 + 1, hy - 1, c["accent"])
            cv.set(hx + hw // 2 + 3, hy, c["accent"]); cv.set(hx + hw // 2, hy - 2, c["accent"])
            cv.set(hx + 4, hy + 6, (150, 40, 55)); cv.set(hx + 5, hy + 6, (150, 40, 55))
            cv.set(hx + hw - 5, hy + 6, (150, 40, 55)); cv.set(hx + hw - 6, hy + 6, (150, 40, 55))
        elif hid == "blackpanther":
            cv.rect(hx, hy, hw, 13, suit)
            cv.line(hx + 2, hy, hx, hy - 3, suit, 2); cv.line(hx + hw - 3, hy, hx + hw - 1, hy - 3, suit, 2)
            cv.set(hx, hy - 3, sh(suit, 1.4)); cv.set(hx + hw - 1, hy - 3, sh(suit, 1.4))
            cv.vline(hx + hw // 2, hy, hy + 12, sh(suit, .6))
            cv.rect(hx + 1, hy + 4, 5, 3, BLACK); cv.rect(hx + hw - 6, hy + 4, 5, 3, BLACK)
            cv.rect(hx + 2, hy + 5, 3, 1, (170, 240, 200)); cv.rect(hx + hw - 5, hy + 5, 3, 1, (170, 240, 200))
            cv.hline(hx + 4, hx + hw - 5, hy + 10, SILV)
        elif hid == "captainmarvel":
            cv.rect(hx, hy, hw, 13, skin)
            cv.rect(hx, hy, hw, 3, hr)
            cv.vline(hx, hy, hy + 12, hr); cv.vline(hx + hw - 1, hy, hy + 12, hr)
            cv.vline(hx + 1, hy + 2, hy + 10, sh(hr, 1.15)); cv.vline(hx + hw - 2, hy + 2, hy + 10, sh(hr, 1.15))
            cv.set(hx + 4, hy + 5, (70, 130, 200)); cv.set(hx + 5, hy + 5, (70, 130, 200))
            cv.set(hx + hw - 5, hy + 5, (70, 130, 200)); cv.set(hx + hw - 6, hy + 5, (70, 130, 200))
            cv.hline(hx + 4, hx + hw - 5, hy + 4, sh(skin, .8))
            cv.hline(hx + 5, hx + hw - 6, hy + 10, sh(skin, .75))
        elif hid == "captainmarvel_classic":
            cv.rect(hx, hy, hw, 13, suit)
            cv.vline(hx + hw // 2, hy, hy + 4, GOLD)
            cv.set(hx + hw // 2, hy - 1, GOLD)
            cv.rect(hx + 2, hy + 4, 4, 2, WHITE); cv.rect(hx + hw - 6, hy + 4, 4, 2, WHITE)
            cv.set(hx + 3, hy + 4, BLACK); cv.set(hx + hw - 4, hy + 4, BLACK)
            cv.vline(hx - 1, hy + 5, hy + 12, hr); cv.vline(hx + hw, hy + 5, hy + 12, hr)
            cv.hline(hx + 4, hx + hw - 5, hy + 10, sh(skin, .75))
            cv.rect(hx + 3, hy + 8, hw - 6, 5, skin)
        elif hid == "antman":
            cv.rect(hx, hy, hw, 13, suit)
            cv.vline(hx + hw // 2, hy, hy + 12, (32, 32, 38))
            cv.hline(hx + 2, hx + hw - 3, hy + 2, sh(suit, 1.3))
            cv.rect(hx + 2, hy + 4, 4, 4, SILV); cv.rect(hx + hw - 6, hy + 4, 4, 4, SILV)
            cv.set(hx + 3, hy + 5, RED); cv.set(hx + 4, hy + 6, RED)
            cv.set(hx + hw - 4, hy + 5, RED); cv.set(hx + hw - 5, hy + 6, RED)
        elif hid in ("antman_unmasked", "dancer"):
            cv.rect(hx, hy, hw, 13, skin)
            cv.rect(hx, hy, hw, 3, hr)
            cv.set(hx, hy + 3, hr); cv.set(hx + hw - 1, hy + 3, hr)
            cv.hline(hx + 3, hx + 6, hy + 4, sh(skin, .75)); cv.hline(hx + hw - 7, hx + hw - 4, hy + 4, sh(skin, .75))
            cv.set(hx + 4, hy + 5, BLACK); cv.set(hx + hw - 5, hy + 5, BLACK)
            cv.hline(hx + 4, hx + hw - 5, hy + 9, sh(skin, .7))
            cv.hline(hx + 4, hx + hw - 5, hy + 11, sh(skin, .85))
        elif hid == "venom":
            cv.rect(hx - 1, hy - 1, hw + 2, 15, suit)
            cv.rect(hx + 1, hy + 3, 6, 4, WHITE); cv.set(hx, hy + 2, WHITE); cv.set(hx + 7, hy + 2, WHITE)
            cv.set(hx + 2, hy + 7, WHITE); cv.set(hx + 5, hy + 7, WHITE)
            cv.rect(hx + hw - 7, hy + 3, 6, 4, WHITE); cv.set(hx + hw - 1, hy + 2, WHITE); cv.set(hx + hw - 8, hy + 2, WHITE)
            cv.set(hx + hw - 3, hy + 7, WHITE); cv.set(hx + hw - 6, hy + 7, WHITE)
            cv.hline(hx + 1, hx + hw - 2, hy + 10, WHITE)
            for xx in (hx + 2, hx + 5, hx + 8, hx + hw - 3, hx + hw - 6, hx + hw - 9): cv.set(xx, hy + 11, WHITE)
        elif hid == "wolverine":
            cv.rect(hx, hy, hw, 13, suit)
            cv.rect(hx + 3, hy + 8, hw - 6, 5, skin)
            cv.rect(hx + 1, hy + 3, 6, 4, BLACK); cv.rect(hx + hw - 7, hy + 3, 6, 4, BLACK)
            cv.set(hx + 3, hy + 4, WHITE); cv.set(hx + 4, hy + 4, WHITE)
            cv.set(hx + hw - 4, hy + 4, WHITE); cv.set(hx + hw - 5, hy + 4, WHITE)
            cv.line(hx + 1, hy + 1, hx - 2, hy - 4, BLACK, 2); cv.line(hx + hw - 2, hy + 1, hx + hw + 1, hy - 4, BLACK, 2)
            cv.set(hx - 2, hy - 4, (250, 200, 44)); cv.set(hx + hw + 1, hy - 4, (250, 200, 44))
            cv.vline(hx + 2, hy + 8, hy + 11, BLACK); cv.vline(hx + hw - 3, hy + 8, hy + 11, BLACK)
            cv.hline(hx + 5, hx + hw - 6, hy + 11, sh(skin, .7))
        elif hid == "deadpool":
            cv.rect(hx, hy, hw, 13, suit)
            cv.rect(hx + 1, hy + 3, 6, 5, BLACK); cv.rect(hx + hw - 7, hy + 3, 6, 5, BLACK)
            cv.rect(hx + 2, hy + 4, 4, 3, WHITE); cv.rect(hx + hw - 6, hy + 4, 4, 3, WHITE)
            cv.set(hx + 3, hy + 5, BLACK); cv.set(hx + hw - 4, hy + 5, BLACK)
        elif hid == "gamora":
            cv.rect(hx, hy, hw, 13, (72, 172, 82))
            cv.rect(hx, hy, hw, 2, (40, 22, 46))
            cv.vline(hx, hy, hy + 13, (40, 22, 46)); cv.vline(hx + hw - 1, hy, hy + 13, (40, 22, 46))
            cv.set(hx + 2, hy + 1, (190, 60, 70)); cv.set(hx + 3, hy + 2, (190, 60, 70))
            cv.set(hx + 4, hy + 5, BLACK); cv.set(hx + hw - 5, hy + 5, BLACK)
        elif hid == "rocket":
            cv.rect(hx + 1, hy + 1, hw - 2, 12, (140, 100, 60))
            cv.rect(hx + 2, hy - 1, 3, 3, (140, 100, 60)); cv.rect(hx + hw - 5, hy - 1, 3, 3, (140, 100, 60))
            cv.set(hx + 3, hy, (90, 60, 40)); cv.set(hx + hw - 4, hy, (90, 60, 40))
            cv.rect(hx + 4, hy + 7, hw - 8, 4, (220, 200, 170))
            cv.set(hx + hw // 2, hy + 7, BLACK)
            cv.set(hx + 4, hy + 4, BLACK); cv.set(hx + 5, hy + 4, WHITE)
            cv.set(hx + hw - 5, hy + 4, BLACK); cv.set(hx + hw - 6, hy + 4, WHITE)
        elif hid == "groot":
            cv.rect(hx, hy, hw, 13, BARK)
            cv.vline(hx + 3, hy, hy + 12, sh(BARK, .7)); cv.vline(hx + hw - 4, hy + 2, hy + 12, sh(BARK, .7))
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
        elif hid in ("antman", "antman_unmasked", "dancer"):
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
    fx = []
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
        if em == "gangnam":
            bob = [0, 1, 0, 1, 0, 1][fi]; ph = fi % 2
            if ph == 0: handL, handR = (19, 22), (29, 22)
            else: handL, handR = (12, 20), (36, 20)
            if ph: legL = (3, 2)
            else: legR = (3, 2)
        elif em == "floss":
            dx = [-3, 0, 3, 3, 0, -3][fi]
            if fi % 2 == 0: handL, handR = (14 + dx, 26), (40 + dx, 22)
            else: handL, handR = (14 + dx, 22), (40 + dx, 26)
            legL = (dx // 2, 0); legR = (dx // 2, 0)
        elif em == "dab":
            if fi < 2:
                handL, handR = (10, 12), (40, 10)
            else:
                lean = -2; bob = fi % 2
                handL, handR = (18, 7), (42, 9)
        elif em == "moonwalk":
            lean = -1
            legL = ([3, 1, -2, -3, -1, 2][fi], 0); legR = ([-2, -3, -1, 2, 3, 1][fi], 0)
            handL, handR = (14, 28), (34, 28)
            if fi % 2 == 0: fx = [24]
        elif em == "robot":
            poses = [((10, 20), (38, 20)), ((10, 14), (38, 20)), ((10, 14), (38, 12)),
                     ((16, 20), (38, 12)), ((16, 20), (32, 20)), ((10, 20), (32, 14))]
            handL, handR = poses[fi]
            if fi % 2 == 1: fx = [25]
        elif em == "runningman":
            bob = [0, 1, 0, 1, 0, 1][fi]; ph = fi % 2
            if ph: legL, legR = (2, 3), (-2, 0); handL, handR = (14, 24), (34, 18)
            else: legL, legR = (-2, 0), (2, 3); handL, handR = (16, 18), (34, 24)
        elif em == "macarena":
            seqh = [((15, 27), (36, 20)), ((34, 24), (36, 20)), ((34, 24), (36, 12)),
                    ((34, 12), (36, 12)), ((20, 6), (28, 6)), ((16, 26), (32, 26))]
            handL, handR = seqh[fi]
            bob = 1 if fi == 5 else 0
        elif em == "hype":
            bob = [0, -2, -2, 0, 1, 0][fi]
            if fi in (1, 2): handL, handR = (11, 4), (37, 4); fx = [26]
            elif fi == 3: handL, handR = (13, 10), (35, 10)
        elif em == "heart":
            handL, handR = (21, 5), (27, 5)
            bob = [0, 0, 1, 0, 0, 1][fi]
            fx = [22]
        elif em == "groove":
            ph = fi // 3
            bob = fi % 2
            if ph == 0: handL, handR = (17, 26), (40, 6)
            else: handL, handR = (8, 6), (31, 26)
            if fi % 3 == 0: fx = [27]

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
        boot = cfg.get("boot", (24, 24, 32))
        cv.line(foot[0] - 1, foot[1] - 1, foot[0] - 1, foot[1], boot, 2)
        cv.line(foot[0] - 1, foot[1], foot[0] + 2, foot[1], boot, 1)

    # torso
    tw = 22 if big else 16
    tx = 24 - tw // 2
    cv.rect(tx, 18 + bob, tw, 13, suit)
    cv.vline(tx + tw - 2, 18 + bob, 30 + bob, dS)
    cv.vline(tx + tw - 1, 18 + bob, 30 + bob, dS)
    cv.hline(tx, tx + tw - 1, 18 + bob, sh(suit, 1.25))
    cv.hline(tx, tx + tw - 1, 30 + bob, acc)
    cv.rect(23, 29 + bob, 2, 2, sh(acc, 1.3))

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
    hw = 18 if big else 16
    hx = 24 - hw // 2 + lean
    hy = 4 + bob + lean
    HEAD_FN[hid](cv, cfg, hx, hy, hw, bob)

    outline(cv)

    H = dict(handL=handL, handR=handR, hx=hx, hy=hy)
    if anim == "attack": ATK_FN[hid](cv, cfg, fi, H)
    if anim == "power": POW_FN[hid](cv, cfg, fi, H)
    if anim == "emote":
        em = cfg.get("em")
        if em == "gangnam" and fi in (0, 3):
            cv.set(8, 10, CYAN); cv.set(40, 8, PINK)
        if 24 in fx:  # moonwalk speed lines
            cv.line(6, 26, 10, 26, WHITE, 1); cv.line(7, 32, 11, 32, WHITE, 1)
        if 25 in fx:  # robot joint clicks
            cv.set(handL[0], handL[1] - 2, CYAN); cv.set(handR[0], handR[1] - 2, CYAN)
        if 26 in fx:  # hype sparks
            cv.set(10, 2, GOLD); cv.set(38, 2, GOLD); cv.set(24, 1, WHITE)
        if 22 in fx:  # heart (pulsing)
            s = 1 if fi in (2, 5) else 0
            for d in ((22 - s, 1), (26 + s, 1), (21 - s, 2), (27 + s, 2), (22, 3), (26, 3), (23, 4), (25, 4), (24, 5)):
                cv.set(d[0], d[1], PINK)
        if 27 in fx:  # disco sparkle at fingertip
            cv.set(41, 4, GOLD); cv.set(7, 4, GOLD)

def main():
    seq = [("idle", i) for i in range(4)] + [("walk", i) for i in range(6)] + \
          [("attack", i) for i in range(4)] + [("power", i) for i in range(4)]
    for e in EMOTES:
        seq += [(e, i) for i in range(6)]
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

    # ---- neutral "dancer" rig: bakes emote ICONS from real emote frames ----
    dancer = dict(boot=(90, 60, 40), suit=(214, 60, 60), suit2=(58, 108, 168),
                  accent=(214, 60, 60), skin=(240, 190, 140), hair=(122, 82, 42), id="dancer")
    HEAD_FN["dancer"] = HEADS("dancer")
    EMB_FN["dancer"] = EMBLEMS("dancer")
    dseq = [(em, i) for em in EMOTES for i in range(6)]
    dstrip = HC(FR * len(dseq), FR)
    for f, (an, fi) in enumerate(dseq):
        fr = HC()
        cfg2 = dict(dancer); cfg2["em"] = an
        draw_frame(fr, cfg2, "emote", fi)
        for (x, yy), cc in fr.px.items():
            dstrip.px[(f * FR + x, yy)] = cc
    pick_frame = {"gangnam": 1, "floss": 2, "dab": 3, "moonwalk": 1, "robot": 2,
                  "runningman": 1, "macarena": 4, "hype": 2, "heart": 2, "groove": 1}
    for em in EMOTES:
        sx = (EMOTES.index(em) * 6 + pick_frame[em]) * FR
        icon = HC(96, 96)
        for y in range(FR):
            for x in range(FR):
                cc = dstrip.px.get((sx + x, y))
                if cc:
                    for j in range(2):
                        for i in range(2):
                            icon.set(x * 2 + i, y * 2 + j, cc)
        save("emote_%s" % em, icon, folder=SPR)
    print("emote icons baked from dancer strip.")

    # ---- backblings 48px ----
    def wings():
        s = HC(FR * 2, FR)
        for f in range(2):
            cv = HC()
            up = 0 if f == 0 else 3
            for i in range(11):
                h = 15 - abs(i - 4) * 2 + up
                cv.vline(22 - i, 26 - h, 26, WHITE if i % 2 == 0 else sh(WHITE, .82))
                cv.vline(25 + i, 26 - h, 26, WHITE if i % 2 == 0 else sh(WHITE, .82))
                cv.set(22 - i, 26 - h, GOLD); cv.set(25 + i, 26 - h, GOLD)
                cv.set(22 - i, 26 - h + 1, sh(GOLD, .7)); cv.set(25 + i, 26 - h + 1, sh(GOLD, .7))
            cv.vline(23, 20 - up, 26, GOLD); cv.vline(24, 20 - up, 26, GOLD)
            outline(cv)
            for (x, yy), c in cv.px.items(): s.px[(f * FR + x, yy)] = c
        save("glider_wings", s, folder=ANIM)
    def single(name, fn):
        cv = HC(); fn(cv); outline(cv); save(name, cv, folder=ANIM)
    def f_shield(cv):
        cv.disc(24, 24, 12, RED); cv.disc(24, 24, 8.5, WHITE); cv.disc(24, 24, 5, BLUE)
        for d in ((0, -3), (3, 0), (0, 3), (-3, 0), (2, -2), (-2, -2), (2, 2), (-2, 2)): cv.set(24 + d[0], 24 + d[1], WHITE)
    def f_cosmic(cv):
        for yy in range(7, 42):
            w = 6 + (yy - 7) // 2
            cv.hline(24 - w, 24 + w, yy, (52, 18, 102) if yy % 3 else (62, 22, 112))
            cv.hline(24 - w, 24 - w + 2, yy, (112, 62, 182))
            cv.hline(24 + w - 1, 24 + w, yy, (32, 10, 62))
        for (x, yy) in [(20, 14), (28, 20), (17, 26), (30, 30), (23, 36), (26, 12), (19, 33)]:
            cv.set(x, yy, WHITE); cv.set(x + 1, yy, CYAN)
        cv.hline(21, 27, 9, (160, 90, 220))
    def f_claws(cv):
        cv.line(12, 8, 36, 40, (110, 70, 40), 2)
        cv.line(36, 8, 12, 40, (110, 70, 40), 2)
        cv.rect(14, 7, 22, 24, (20, 20, 26))
        cv.hline(14, 35, 7, (60, 60, 74)); cv.vline(14, 7, 30, (60, 60, 74))
        for i in range(3):
            cv.line(18 + i * 6, 9, 22 + i * 6, 29, SILV, 2)
            cv.set(19 + i * 6, 10, WHITE)
        cv.set(24, 12, GOLD); cv.set(25, 13, GOLD)
    wings()
    single("glider_shield", f_shield)
    single("glider_cosmic", f_cosmic)
    single("glider_claws", f_claws)

    print("backblings done.")  # mode icons live in tools/make_mode_icons.py (PLAY v2)

if __name__ == "__main__":
    main()
