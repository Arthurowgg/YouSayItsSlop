#!/usr/bin/env python3
"""Paints full-body 24x24 in-game hero sprites as animation strips.
Strip layout (12 frames): idle[0..1] walk[2..5] attack[6..8] power[9..11].
Deterministic; restyle a hero by editing its config dict."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from make_maps import Cv, save

ANIM = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "anim")
os.makedirs(ANIM, exist_ok=True)

W = BLACK = (18, 18, 26)
WHITE = (245, 245, 250)

HEROES = {
    "spiderman":            dict(suit=(215, 40, 45), suit2=(40, 90, 190), accent=(18, 18, 26), skin=(240, 190, 140), style="fullmask", eyes=WHITE, emblem="spider"),
    "spiderman_classic":    dict(suit=(200, 30, 35), suit2=(30, 70, 160), accent=(18, 18, 26), skin=(240, 190, 140), style="fullmask", eyes=WHITE, emblem="spider"),
    "miles":                dict(suit=(25, 25, 32), suit2=(25, 25, 32), accent=(230, 40, 50), skin=(150, 100, 70), style="fullmask", eyes=WHITE, emblem="spider"),
    "gwen":                 dict(suit=(240, 240, 245), suit2=(240, 240, 245), accent=(255, 90, 170), skin=(245, 210, 180), style="hood", eyes=(255, 90, 170), emblem=None),
    "venom":                dict(suit=(20, 20, 26), suit2=(20, 20, 26), accent=(230, 40, 50), skin=(20, 20, 26), style="venom", eyes=WHITE, emblem=None),
    "ironman":              dict(suit=(200, 35, 40), suit2=(200, 35, 40), accent=(255, 200, 60), skin=(240, 190, 140), style="bot", eyes=(120, 240, 255), emblem="circle"),
    "capamerica":           dict(suit=(40, 90, 190), suit2=(40, 90, 190), accent=(230, 40, 50), skin=(240, 190, 140), style="halfmask", eyes=WHITE, emblem="star", wings=True),
    "thor":                 dict(suit=(120, 130, 150), suit2=(60, 66, 86), accent=(255, 200, 60), skin=(245, 210, 180), style="helm", eyes=(120, 240, 255), hair=(250, 220, 120), cape=(200, 35, 45), emblem="circle", wings=True),
    "hulk":                 dict(suit=(70, 170, 80), suit2=(120, 70, 170), accent=(70, 170, 80), skin=(70, 170, 80), style="face", hair=(20, 40, 25), emblem=None, big=True),
    "wolverine":            dict(suit=(250, 200, 40), suit2=(40, 90, 190), accent=(250, 200, 40), skin=(240, 190, 140), style="halfmask", eyes=WHITE, emblem=None, ears=True),
    "blackwidow":           dict(suit=(30, 30, 38), suit2=(30, 30, 38), accent=(255, 200, 60), skin=(245, 210, 180), style="face", hair=(170, 50, 40), emblem=None),
    "hawkeye":              dict(suit=(120, 60, 170), suit2=(60, 40, 90), accent=(245, 245, 250), skin=(240, 190, 140), style="hood", eyes=(245, 245, 250), hair=(140, 90, 40), emblem=None),
    "drstrange":            dict(suit=(40, 70, 160), suit2=(40, 70, 160), accent=(255, 200, 60), skin=(240, 200, 160), style="face", hair=(90, 90, 100), cape=(190, 30, 40), emblem="circle"),
    "scarletwitch":         dict(suit=(200, 35, 50), suit2=(120, 20, 35), accent=(255, 90, 100), skin=(245, 210, 180), style="face", hair=(190, 40, 45), emblem=None, tiara=True),
    "scarletwitch_azure":   dict(suit=(50, 90, 200), suit2=(30, 50, 120), accent=(120, 200, 255), skin=(245, 210, 180), style="face", hair=(190, 40, 45), emblem=None, tiara=True),
    "blackpanther":         dict(suit=(28, 28, 36), suit2=(28, 28, 36), accent=(190, 200, 220), skin=(28, 28, 36), style="fullmask", eyes=(120, 255, 170), emblem=None, ears=True),
    "captainmarvel":        dict(suit=(40, 70, 170), suit2=(200, 35, 45), accent=(255, 200, 60), skin=(245, 210, 180), style="face", hair=(250, 220, 120), emblem="star"),
    "captainmarvel_classic":dict(suit=(40, 70, 170), suit2=(40, 70, 170), accent=(255, 200, 60), skin=(245, 210, 180), style="helm", eyes=(245, 245, 250), hair=(250, 220, 120), emblem="star", wings=True),
    "antman":               dict(suit=(140, 25, 40), suit2=(30, 30, 36), accent=(190, 200, 220), skin=(240, 190, 140), style="bot", eyes=(255, 70, 70), emblem=None),
    "antman_unmasked":      dict(suit=(140, 25, 40), suit2=(30, 30, 36), accent=(190, 200, 220), skin=(240, 190, 140), style="face", hair=(120, 80, 40), emblem=None),
}

FR = 24  # frame size


class HC(Cv):
    def __init__(self):
        super().__init__(FR, FR)
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


def draw_frame(cv, cfg, anim, fi):
    big = cfg.get("big")
    bob = 0
    # pose parameters
    legL_dx = legR_dx = legL_up = legR_up = 0
    armL = armR = None          # hand target (x, y)
    slash = False
    aura = 0
    if anim == "idle":
        bob = fi % 2
    elif anim == "walk":
        bob = fi % 2
        d = [0, -1, 0, 1][fi]
        legL_dx, legR_dx = d, -d
        legL_up, legR_up = (1 if d else 0), (1 if -d else 0)
        armL = (7 - d, 13 + bob)
        armR = (16 + d, 13 + bob)
    elif anim == "attack":
        if fi == 0: armR = (18, 9)
        elif fi == 1: armR = (21, 11); slash = True
        else: armR = (19, 13)
        armL = (6, 12)
    elif anim == "power":
        bob = 1 if fi == 2 else 0
        armL = (6 - fi, 9 - fi * 2)
        armR = (17 + fi, 9 - fi * 2)
        aura = fi

    y = bob
    suit, suit2, accent, skin = cfg["suit"], cfg["suit2"], cfg["accent"], cfg["skin"]

    # cape (behind)
    if cfg.get("cape"):
        sway = (fi + 1) % 2
        cv.rect(7, 9 + y, 1, 8 + sway, cfg["cape"])
        cv.rect(16, 9 + y, 1, 8 + sway, cfg["cape"])
        cv.hline(7, 16, 17 + sway + y, cfg["cape"])

    # legs
    if big:
        cv.rect(8 + legL_dx, 16 + y, 3, 6 - legL_up, suit2)
        cv.rect(13 + legR_dx, 16 + y, 3, 6 - legR_up, suit2)
    else:
        cv.rect(9 + legL_dx, 16 + y, 2, 6 - legL_up, suit2)
        cv.rect(13 + legR_dx, 16 + y, 2, 6 - legR_up, suit2)

    # torso
    if big:
        cv.rect(6, 9 + y, 12, 7, skin)
        cv.hline(6, 17, 15 + y, suit2)
    else:
        cv.rect(8, 9 + y, 8, 7, suit)
        cv.hline(8, 15, 15 + y, accent)  # belt
    # emblem
    em = cfg.get("emblem")
    cx = 11 if not big else 11
    if em == "star":
        cv.set(cx + 1, 11 + y, WHITE); cv.set(cx, 12 + y, WHITE); cv.set(cx + 2, 12 + y, WHITE); cv.set(cx + 1, 12 + y, WHITE); cv.set(cx + 1, 13 + y, WHITE)
    elif em == "circle":
        cv.rect(cx, 11 + y, 2, 2, accent); cv.set(cx, 11 + y, WHITE)
    elif em == "spider":
        cv.rect(cx, 11 + y, 2, 2, BLACK); cv.set(cx - 1, 11 + y, BLACK); cv.set(cx + 2, 12 + y, BLACK)

    # arms
    shL, shR = ((7, 10 + y), (16, 10 + y)) if not big else ((5, 10 + y), (18, 10 + y))
    if armL is None: armL = (7, 14 + y) if not big else (5, 14 + y)
    if armR is None: armR = (16, 14 + y) if not big else (18, 14 + y)
    cv.line(shL[0], shL[1], armL[0], armL[1], suit if not big else skin)
    cv.line(shR[0], shR[1], armR[0], armR[1], suit if not big else skin)
    cv.set(armL[0], armL[1], skin if cfg["style"] in ("face",) else accent)
    cv.set(armR[0], armR[1], skin if cfg["style"] in ("face",) else accent)
    if slash:
        for i, yy in enumerate((8, 9, 10, 11, 12, 13, 14)):
            cv.set(21 + (0 if i in (0, 6) else 1), yy, WHITE)

    # head
    hx, hy = 8, 2 + y
    st = cfg["style"]
    if st == "fullmask":
        cv.rect(hx, hy, 8, 7, suit)
        cv.rect(hx + 1, hy + 2, 2, 2, cfg["eyes"]); cv.rect(hx + 5, hy + 2, 2, 2, cfg["eyes"])
    elif st == "halfmask":
        cv.rect(hx, hy, 8, 4, suit)
        cv.rect(hx, hy + 4, 8, 3, skin)
        cv.rect(hx + 1, hy + 2, 2, 1, cfg["eyes"]); cv.rect(hx + 5, hy + 2, 2, 1, cfg["eyes"])
    elif st == "face":
        cv.rect(hx, hy, 8, 7, skin)
        hair = cfg.get("hair", BLACK)
        cv.rect(hx, hy, 8, 2, hair); cv.set(hx, hy + 2, hair); cv.set(hx + 7, hy + 2, hair)
        cv.set(hx + 2, hy + 3, BLACK); cv.set(hx + 5, hy + 3, BLACK)
    elif st == "helm":
        cv.rect(hx, hy, 8, 7, suit)
        cv.rect(hx + 1, hy + 3, 2, 1, cfg["eyes"]); cv.rect(hx + 5, hy + 3, 2, 1, cfg["eyes"])
        if cfg.get("hair"):
            cv.rect(hx - 1, hy + 3, 1, 4, cfg["hair"]); cv.rect(hx + 8, hy + 3, 1, 4, cfg["hair"])
    elif st == "hood":
        cv.rect(hx, hy, 8, 7, suit)
        cv.rect(hx + 2, hy + 2, 4, 4, (30, 26, 24))
        cv.set(hx + 2, hy + 3, cfg["eyes"]); cv.set(hx + 5, hy + 3, cfg["eyes"])
    elif st == "venom":
        cv.rect(hx, hy, 8, 7, suit)
        cv.rect(hx + 1, hy + 2, 2, 2, WHITE); cv.rect(hx + 5, hy + 2, 2, 2, WHITE)
        cv.hline(hx + 1, hx + 6, hy + 5, WHITE)
        cv.set(hx + 3, hy + 6, cfg["accent"])
    elif st == "bot":
        cv.rect(hx, hy, 8, 7, suit)
        cv.rect(hx + 1, hy + 3, 2, 1, cfg["eyes"]); cv.rect(hx + 5, hy + 3, 2, 1, cfg["eyes"])
        cv.hline(hx + 2, hx + 5, hy + 5, BLACK)
    if cfg.get("ears"):
        cv.set(hx, hy - 1, suit); cv.set(hx, hy, suit); cv.set(hx + 7, hy - 1, suit); cv.set(hx + 7, hy, suit)
        cv.set(hx + 1, hy - 2, suit) if big is False else None
        cv.set(hx + 6, hy - 2, suit)
    if cfg.get("wings"):
        cv.set(hx - 1, hy + 1, WHITE); cv.set(hx - 1, hy + 2, WHITE); cv.set(hx + 8, hy + 1, WHITE); cv.set(hx + 8, hy + 2, WHITE)
    if cfg.get("tiara"):
        cv.set(hx + 3, hy - 1, accent); cv.set(hx + 4, hy - 1, accent); cv.set(hx + 3, hy, accent); cv.set(hx + 4, hy, accent)

    # power aura
    if aura:
        a = accent
        pts = [(5, 6), (18, 6), (4, 10), (19, 10), (6, 3), (17, 3)]
        for i, (px, py) in enumerate(pts[: 2 * aura + 2]):
            cv.set(px, py + y, a)
        if aura >= 2:
            cv.set(3, 13, a); cv.set(20, 13, a)


def main():
    order = ["idle", "idle", "walk", "walk", "walk", "walk", "attack", "attack", "attack", "power", "power", "power"]
    for hid, cfg in HEROES.items():
        strip = HC()
        # we paint into one wide canvas by offsetting x per frame: use temp per-frame then copy
        for f, anim in enumerate(order):
            frame = HC()
            draw_frame(frame, cfg, anim, f - {"idle": 0, "walk": 2, "attack": 6, "power": 9}[anim])
            for (x, yy), c in frame.px.items():
                strip.px[(f * FR + x, yy)] = c
        strip.w = FR * len(order)
        save(hid, strip, folder=ANIM)
    print("hero strips done.")


if __name__ == "__main__":
    main()
