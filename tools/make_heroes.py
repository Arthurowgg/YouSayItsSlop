#!/usr/bin/env python3
"""v2 hero painter: 48x48 shaded, outlined, signature-prop heroes.
Strip (18 frames): idle[0..3] walk[4..9] attack[10..13] power[14..17].
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

def sh(c, f): return tuple(min(255, int(v * f)) for v in c[:3])

class HC:
    def __init__(self, w=FR, h=FR):
        self.w, self.h = w, h
        self.px = {}
    def set(self, x, y, c):
        if c and 0 <= x < self.w and 0 <= y < self.h: self.px[(int(x), int(y))] = c
    def get(self, x, y): return self.px.get((int(x), int(y)))
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
 "spiderman": dict(suit=(214, 42, 48), suit2=(38, 88, 190), accent=(214, 42, 48), skin=(240, 190, 140), style="fullmask", eyes=WHITE, prop="web", quote="Your friendly neighborhood pixel-slinger."),
 "spiderman_classic": dict(suit=(198, 30, 36), suit2=(28, 66, 158), accent=(198, 30, 36), skin=(240, 190, 140), style="fullmask", eyes=WHITE, prop="web", quote="Classic suit. Classic responsibility."),
 "miles": dict(suit=(24, 24, 30), suit2=(24, 24, 30), accent=(230, 42, 52), skin=(150, 100, 70), style="fullmask", eyes=WHITE, prop="web", quote="Alright, one more swing."),
 "gwen": dict(suit=(240, 240, 246), suit2=(24, 24, 30), accent=(255, 92, 170), skin=(245, 210, 180), style="hood", eyes=(255, 92, 170), prop="web", quote="You wouldn't get it. It's a whole dimension thing."),
 "venom": dict(suit=(18, 18, 24), suit2=(18, 18, 24), accent=(230, 42, 52), skin=(18, 18, 24), style="venom", eyes=WHITE, prop="tongue", big=True, quote="We are done talking."),
 "ironman": dict(suit=(198, 36, 42), suit2=(198, 36, 42), accent=(255, 198, 60), skin=(240, 190, 140), style="bot", eyes=(130, 240, 255), prop="repulsor", quote="Power at 100 percent. Try to keep up."),
 "capamerica": dict(suit=(40, 90, 190), suit2=(40, 90, 190), accent=(230, 42, 52), skin=(240, 190, 140), style="halfmask", eyes=WHITE, prop="shield", wings=True, quote="I can do this all day."),
 "thor": dict(suit=(122, 132, 152), suit2=(62, 68, 88), accent=(255, 198, 60), skin=(245, 210, 180), style="helm", eyes=(130, 240, 255), hair=(250, 220, 120), cape=(198, 36, 48), prop="hammer", wings=True, quote="Bring me that horizon!"),
 "hulk": dict(suit=(72, 172, 82), suit2=(122, 72, 172), accent=(72, 172, 82), skin=(72, 172, 82), style="face", hair=(22, 42, 26), prop="smash", big=True, quote="Puny menu. HULK SMASH."),
 "wolverine": dict(suit=(250, 200, 44), suit2=(40, 90, 190), accent=(250, 200, 44), skin=(240, 190, 140), style="halfmask", eyes=WHITE, prop="claws", ears=True, quote="Bub, I don't line up."),
 "blackwidow": dict(suit=(30, 30, 38), suit2=(30, 30, 38), accent=(255, 198, 60), skin=(245, 210, 180), style="face", hair=(172, 52, 42), prop="batons", quote="Red in my ledger. You're adding to it."),
 "hawkeye": dict(suit=(122, 62, 172), suit2=(62, 42, 92), accent=(248, 248, 252), skin=(240, 190, 140), style="hood", eyes=(248, 248, 252), hair=(140, 90, 40), prop="bow", quote="Wind's fine. I'm better."),
 "drstrange": dict(suit=(42, 72, 162), suit2=(42, 72, 162), accent=(255, 160, 40), skin=(240, 200, 160), style="face", hair=(96, 96, 108), cape=(190, 32, 42), prop="magic", quote="Dormammu, I've come to bargain."),
 "scarletwitch": dict(suit=(198, 36, 52), suit2=(122, 22, 38), accent=(255, 92, 100), skin=(245, 210, 180), style="face", hair=(190, 42, 48), prop="magic", tiara=True, quote="You have no idea what I can do."),
 "scarletwitch_azure": dict(suit=(52, 92, 202), suit2=(32, 52, 122), accent=(130, 205, 255), skin=(245, 210, 180), style="face", hair=(190, 42, 48), prop="magic", tiara=True, quote="Chaos, but make it cool."),
 "blackpanther": dict(suit=(28, 28, 36), suit2=(28, 28, 36), accent=(190, 200, 220), skin=(28, 28, 36), style="fullmask", eyes=(130, 255, 170), prop="claws", ears=True, quote="Wakanda forever."),
 "captainmarvel": dict(suit=(42, 72, 172), suit2=(198, 36, 48), accent=(255, 198, 60), skin=(245, 210, 180), style="face", hair=(250, 220, 120), prop="repulsor", quote="Higher. Further. Faster."),
 "captainmarvel_classic": dict(suit=(42, 72, 172), suit2=(42, 72, 172), accent=(255, 198, 60), skin=(245, 210, 180), style="helm", eyes=(248, 248, 252), hair=(250, 220, 120), prop="repulsor", wings=True, quote="The original star-spangled problem."),
 "antman": dict(suit=(142, 26, 42), suit2=(32, 32, 38), accent=(190, 200, 220), skin=(240, 190, 140), style="bot", eyes=(255, 72, 72), prop="punch", quote="It's not size, it's timing."),
 "antman_unmasked": dict(suit=(142, 26, 42), suit2=(32, 32, 38), accent=(190, 200, 220), skin=(240, 190, 140), style="face", hair=(122, 82, 42), prop="punch", quote="Scott Lang. Mostly reformed."),
}

def draw_frame(cv, cfg, anim, fi):
    big = cfg.get("big")
    suit, suit2, acc, skin = cfg["suit"], cfg["suit2"], cfg["accent"], cfg["skin"]
    dS, dS2 = sh(suit, .72), sh(suit2, .72)
    bob = 0
    legL = legR = (0, 0)   # (dx, lift)
    handL = handR = None
    fx = []
    if anim == "idle":
        bob = [0, 1, 1, 0][fi]
    elif anim == "walk":
        t = fi / 6 * 2 * math.pi
        bob = 1 if fi in (1, 2, 4, 5) else 0
        legL = (round(3 * math.cos(t)), max(0, round(3 * math.sin(t))))
        legR = (round(3 * math.cos(t + math.pi)), max(0, round(3 * math.sin(t + math.pi))))
        handL = (14 - round(2 * math.cos(t)), 26 + bob)
        handR = (33 + round(2 * math.cos(t)), 26 + bob)
    elif anim == "attack":
        if fi == 0: handR = (28, 20); handL = (14, 25)
        elif fi == 1: handR = (38, 22); handL = (13, 25); fx = [1]
        elif fi == 2: handR = (41, 24); handL = (13, 26); fx = [1, 2]
        else: handR = (34, 27); handL = (14, 26)
    elif anim == "power":
        bob = [1, 0, -1, 0][fi]
        handL = (12 - fi, 20 - fi * 3)
        handR = (35 + fi, 20 - fi * 3)
        fx = [10 + fi]

    y = 24 + bob  # torso top baseline reference

    # cape behind
    if cfg.get("cape"):
        sway = [0, 1, 1, 2][fi % 4]
        for i in range(4):
            cv.hline(15 - i // 2, 32 + i // 2, 20 + i * 3 + sway + bob, sh(cfg["cape"], 1 - i * .07))
        cv.rect(15, 18 + bob, 18, 3, cfg["cape"])

    # legs (two segments)
    hipL, hipR = (20, 31 + bob), (27, 31 + bob)
    if big: hipL, hipR = (18, 31 + bob), (29, 31 + bob)
    for hip, (dx, lift) in ((hipL, legL), (hipR, legR)):
        knee = (hip[0] + dx * .5, 37 + bob - lift * .3)
        foot = (hip[0] + dx, 43 - lift)
        col = suit2 if not big else cfg["suit2"]
        cv.line(hip[0], hip[1], knee[0], knee[1], sh(col, .85), 3 if big else 2)
        cv.line(knee[0], knee[1], foot[0], foot[1], col, 3 if big else 2)
        cv.line(foot[0] - 1, foot[1], foot[0] + 2, foot[1], BLACK, 1)  # foot

    # torso with shading
    tw = 22 if big else 16
    tx = 24 - tw // 2
    cv.rect(tx, 18 + bob, tw, 13, suit)
    cv.vline(tx + tw - 2, 18 + bob, 30 + bob, dS)          # side shade
    cv.vline(tx + tw - 1, 18 + bob, 30 + bob, dS)
    cv.hline(tx, tx + tw - 1, 18 + bob, sh(suit, 1.25))    # top light
    cv.hline(tx, tx + tw - 1, 30 + bob, acc)               # belt
    if big:  # hulk chest shade
        cv.line(tx + 4, 20 + bob, 24, 24 + bob, sh(suit, .8), 2)
        cv.line(tx + tw - 4, 20 + bob, 24, 24 + bob, sh(suit, .8), 2)

    # signature chest emblem
    p = cfg.get("prop")
    if cfg.get("style") != "venom" and not big:
        cv.set(23, 22 + bob, sh(suit, 1.3)); cv.set(24, 22 + bob, sh(suit, 1.3))

    # arms (shoulder -> hand with elbow bend)
    shL, shR = (tx + 1, 20 + bob), (tx + tw - 2, 20 + bob)
    if handL is None: handL = (tx - 1, 27 + bob)
    if handR is None: handR = (tx + tw + 1, 27 + bob)
    acol = skin if big else suit
    cv.limb(shL[0], shL[1], handL[0], handL[1], -2, sh(acol, .9), 3 if big else 2)
    cv.limb(shR[0], shR[1], handR[0], handR[1], 2, acol, 3 if big else 2)
    cv.disc(handL[0], handL[1], 1.4, skin if cfg["style"] == "face" or big else acc)
    cv.disc(handR[0], handR[1], 1.4, skin if cfg["style"] == "face" or big else acc)

    # idle signature props on back/hand
    if anim == "idle" or anim == "walk":
        if cfg.get("prop") == "hammer":
            cv.line(handR[0] + 1, handR[1] - 6, handR[0] + 1, handR[1] + 2, (120, 90, 50), 2)
            cv.rect(handR[0] - 2, handR[1] - 9, 7, 4, (150, 160, 180)); cv.set(handR[0] - 1, handR[1] - 8, WHITE)
        if cfg.get("prop") == "bow":
            cv.line(tx - 3, 16 + bob, tx - 3, 30 + bob, (120, 90, 50), 1)
            cv.line(tx - 3, 16 + bob, tx - 1, 23 + bob, (200, 200, 210), 1); cv.line(tx - 3, 30 + bob, tx - 1, 23 + bob, (200, 200, 210), 1)
        if cfg.get("prop") == "shield" and "glider" not in cfg:
            cv.disc(tx - 3, 24 + bob, 4, (198, 36, 48)); cv.disc(tx - 3, 24 + bob, 2.6, WHITE); cv.disc(tx - 3, 24 + bob, 1.4, (40, 90, 190))

    # head
    hw = 15 if big else 14
    hx = 24 - hw // 2
    hy = 5 + bob
    st = cfg["style"]
    if st == "fullmask":
        cv.rect(hx, hy, hw, 12, suit); cv.vline(hx + hw - 2, hy, hy + 11, dS)
        cv.rect(hx + 2, hy + 4, 4, 3, cfg["eyes"]); cv.rect(hx + hw - 6, hy + 4, 4, 3, cfg["eyes"])
        cv.set(hx + 2, hy + 4, BLACK); cv.set(hx + hw - 3, hy + 4, BLACK)
        if cfg.get("prop") == "web":
            cv.vline(hx + hw // 2, hy, hy + 11, sh(suit, .6), )
            cv.hline(hx, hx + hw - 1, hy + 8, sh(suit, .6))
    elif st == "halfmask":
        cv.rect(hx, hy, hw, 7, suit); cv.rect(hx, hy + 7, hw, 5, skin)
        cv.rect(hx + 2, hy + 3, 4, 2, cfg["eyes"]); cv.rect(hx + hw - 6, hy + 3, 4, 2, cfg["eyes"])
        cv.set(hx + 3, hy + 8, sh(skin, .8)); cv.set(hx + hw - 4, hy + 8, sh(skin, .8))
    elif st == "face":
        cv.rect(hx, hy, hw, 12, skin); cv.vline(hx + hw - 2, hy, hy + 11, sh(skin, .8))
        hair = cfg.get("hair", BLACK)
        cv.rect(hx, hy, hw, 3, hair); cv.set(hx, hy + 3, hair); cv.set(hx + hw - 1, hy + 3, hair)
        if cfg.get("hair") and not big: cv.vline(hx, hy + 3, hy + 8, hair); cv.vline(hx + hw - 1, hy + 3, hy + 8, hair)
        cv.set(hx + 4, hy + 6, BLACK); cv.set(hx + hw - 5, hy + 6, BLACK)
        cv.hline(hx + 4, hx + hw - 5, hy + 9, sh(skin, .75))
    elif st == "helm":
        cv.rect(hx, hy, hw, 12, suit)
        cv.rect(hx + 2, hy + 5, 4, 2, cfg["eyes"]); cv.rect(hx + hw - 6, hy + 5, 4, 2, cfg["eyes"])
        if cfg.get("hair"): cv.vline(hx - 1, hy + 4, hy + 11, cfg["hair"]); cv.vline(hx + hw, hy + 4, hy + 11, cfg["hair"])
    elif st == "hood":
        cv.rect(hx - 1, hy - 1, hw + 2, 14, suit)
        cv.rect(hx + 3, hy + 3, hw - 6, 7, (32, 28, 26))
        cv.set(hx + 4, hy + 5, cfg["eyes"]); cv.set(hx + hw - 5, hy + 5, cfg["eyes"])
    elif st == "venom":
        cv.rect(hx - 1, hy - 1, hw + 2, 13, suit)
        cv.rect(hx + 1, hy + 3, 5, 4, WHITE); cv.rect(hx + hw - 6, hy + 3, 5, 4, WHITE)
        cv.set(hx + 2, hy + 2, WHITE); cv.set(hx + hw - 3, hy + 2, WHITE)
        cv.hline(hx + 2, hx + hw - 3, hy + 9, WHITE)
        cv.set(hx + 4, hy + 10, cfg["accent"]); cv.set(hx + 6, hy + 11, cfg["accent"])
    elif st == "bot":
        cv.rect(hx, hy, hw, 12, suit)
        cv.rect(hx + 2, hy + 2, hw - 4, 8, sh(suit, .85))
        cv.rect(hx + 2, hy + 4, 4, 2, cfg["eyes"]); cv.rect(hx + hw - 6, hy + 4, 4, 2, cfg["eyes"])
        cv.hline(hx + 4, hx + hw - 5, hy + 9, BLACK)
        cv.set(hx + hw // 2, hy + 1, sh(suit, 1.3))
    if cfg.get("ears"):
        cv.line(hx + 1, hy, hx - 1, hy - 3, suit, 2); cv.line(hx + hw - 2, hy, hx + hw, hy - 3, suit, 2)
    if cfg.get("wings"):
        cv.set(hx - 2, hy + 3, WHITE); cv.set(hx - 2, hy + 5, WHITE); cv.set(hx + hw + 1, hy + 3, WHITE); cv.set(hx + hw + 1, hy + 5, WHITE)
    if cfg.get("tiara"):
        cv.rect(hx + hw // 2 - 1, hy - 2, 3, 3, acc); cv.set(hx + hw // 2, hy - 3, acc)

    outline(cv)

    # ---- attack / power fx (drawn after outline, no halo) ----
    pr = cfg.get("prop")
    if anim == "attack" and fx:
        hx2, hy2 = handR
        if pr == "web":
            cv.line(hx2 + 2, hy2, 46, hy2 - 2, WHITE, 1); cv.set(46, hy2 - 2, acc); cv.set(45, hy2 - 3, acc)
        elif pr == "repulsor":
            cv.line(hx2 + 2, hy2, 46, hy2, (130, 240, 255), 2); cv.set(46, hy2, WHITE)
        elif pr == "claws":
            for i in (-2, 0, 2): cv.line(hx2 + 1, hy2 + i, hx2 + 8, hy2 + i + 1, WHITE, 1)
        elif pr == "shield":
            cv.disc(42, hy2, 4, (198, 36, 48)); cv.disc(42, hy2, 2.6, WHITE); cv.disc(42, hy2, 1.3, (40, 90, 190))
            cv.line(hx2 + 2, hy2, 38, hy2, WHITE, 1)
        elif pr == "hammer":
            cv.line(hx2, hy2, hx2 + 6, hy2 - 6, (120, 90, 50), 2); cv.rect(hx2 + 4, hy2 - 11, 8, 5, (150, 160, 180))
            cv.set(hx2 + 10, hy2 - 12, (130, 240, 255)); cv.set(hx2 + 3, hy2 - 12, (130, 240, 255))
        elif pr == "bow":
            cv.line(hx2 - 2, hy2 - 6, hx2 - 2, hy2 + 6, (120, 90, 50), 1)
            cv.line(hx2 - 2, hy2, 46, hy2, WHITE, 1); cv.set(46, hy2, acc)
        elif pr == "batons":
            cv.line(hx2, hy2, hx2 + 7, hy2 - 3, BLACK, 2); cv.line(handL[0], handL[1], handL[0] - 7, handL[1] - 3, BLACK, 2)
            cv.set(hx2 + 7, hy2 - 3, (255, 220, 80))
        elif pr == "magic":
            cv.disc(hx2 + 4, hy2, 3 + fx[-1], acc); cv.set(hx2 + 4, hy2, WHITE)
        elif pr == "tongue":
            cv.line(hx + hw - 2, hy + 10, hx + hw + 8, hy + 12, acc, 2)
            for i in (-2, 0, 2): cv.line(hx2 + 1, hy2 + i, hx2 + 7, hy2 + i + 1, WHITE, 1)
        elif pr == "smash":
            cv.line(hx2, hy2, hx2 + 4, 43, skin, 3)
            for i in range(3): cv.set(36 + i * 3, 44, (200, 190, 160)); cv.set(38 + i * 3, 42 - i, (200, 190, 160))
        elif pr == "punch":
            cv.line(hx2 + 2, hy2, hx2 + 8, hy2, WHITE, 1); cv.set(hx2 + 8, hy2 - 1, acc); cv.set(hx2 + 8, hy2 + 1, acc)
    if anim == "power":
        lvl = fx[0] - 10
        n = 3 + lvl * 3
        for i in range(n):
            a = i / n * 2 * math.pi + lvl
            r = 12 + lvl * 3
            cv.set(24 + r * math.cos(a), 22 + r * .8 * math.sin(a), acc)
        if lvl >= 2:
            cv.set(handL[0], handL[1] - 2, WHITE); cv.set(handR[0], handR[1] - 2, WHITE)

def main():
    order = ["idle"] * 4 + ["walk"] * 6 + ["attack"] * 4 + ["power"] * 4
    base = {"idle": 0, "walk": 4, "attack": 10, "power": 14}
    for hid, cfg in HEROES.items():
        strip = HC(FR * len(order), FR)
        for f, anim in enumerate(order):
            fr = HC()
            draw_frame(fr, cfg, anim, f - base[anim])
            for (x, yy), c in fr.px.items():
                strip.px[(f * FR + x, yy)] = c
        save(hid, strip, folder=ANIM)
    print("hero strips v2 done.")

    # ---- backblings 48px ----
    def wings():
        s = HC(FR * 2, FR)
        for f in range(2):
            cv = HC()
            up = 0 if f == 0 else 3
            for i in range(10):
                h = 14 - abs(i - 4) * 2 + up
                cv.vline(22 - i, 26 - h, 26, WHITE); cv.vline(25 + i, 26 - h, 26, WHITE)
                cv.set(22 - i, 26 - h, (255, 198, 60)); cv.set(25 + i, 26 - h, (255, 198, 60))
            outline(cv)
            for (x, yy), c in cv.px.items(): s.px[(f * FR + x, yy)] = c
        save("glider_wings", s, folder=ANIM)
    def single(name, fn):
        cv = HC(); fn(cv); outline(cv); save(name, cv, folder=ANIM)
    def f_shield(cv):
        cv.disc(24, 24, 12, (198, 36, 48)); cv.disc(24, 24, 8.5, WHITE); cv.disc(24, 24, 5, (40, 90, 190))
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
        for i in range(3): cv.line(18 + i * 6, 10, 22 + i * 6, 28, (190, 200, 220), 2)
    wings()
    single("glider_shield", f_shield)
    single("glider_cosmic", f_cosmic)
    single("glider_claws", f_claws)

    # ---- kree arena icon ----
    cv = HC(32, 32)
    cv.disc(16, 16, 13, (40, 46, 70)); cv.disc(16, 16, 11, (60, 70, 105))
    cv.vline(8, 8, 24, (150, 160, 190), ); cv.vline(23, 8, 24, (150, 160, 190))
    cv.hline(8, 23, 8, (150, 160, 190))
    cv.line(12, 20, 20, 12, (255, 90, 100), 2); cv.line(12, 12, 20, 20, (130, 240, 255), 2)
    save("mode_kree_arena", cv, folder=SPR)
    print("backblings + arena icon done.")

if __name__ == "__main__":
    main()
