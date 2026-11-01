"""Where the game draws a skill card's icon in a P図鑑 screenshot, and the shape of its art window.

Every number here was measured on the user's 349 screenshots (docs/plans/EXECPLAN_GAME_STYLE_ICONS.md
§ Surprises & Discoveries): the icon box is at the same pixels in all of them, the art is the
whole square master drawn at a fixed place inside it, and the window through which the art shows
is a hexagon for アクティブ cards and a circle for メンタル cards. Pure: no I/O.
"""

from functools import cache

import numpy as np

SHOT_SIZE = (720, 1280)
"""A screenshot's width and height; the box below is only valid for this size."""

BOX = (27, 132, 173, 278)
"""The icon in the screenshot, dark border included, as (left, top, right, bottom)."""

ICON = BOX[2] - BOX[0]
"""The icon's side in screenshot pixels: 146."""

ART_SIZE = 138.25
ART_X0 = 3.75
ART_Y0 = 3.875
"""The master is drawn as an ART_SIZE square with its top-left corner at (ART_X0, ART_Y0) of the icon:
the median of sub-pixel fits on the 24 base screenshots with the most varied art."""

OUTLINE_WIDTH = 1.75
"""The white outline the game draws just outside each window, in icon pixels."""

HEXAGON = (
    (72.25, 4.11),
    (132.69, 31.98),
    (132.69, 112.62),
    (72.25, 140.49),
    (11.81, 112.62),
    (11.81, 31.98),
)
"""The アクティブ window's corners in icon pixels, clockwise from the top: a pointy-topped hexagon, wider
than a regular one, symmetric about x = 72.25 and y = 72.3. Measured on the four hexagonal frames of
`temp/image.png` (badge-free and 2.4 times the screenshots' size): the outline's outer edge, fitted
over 2,552 points with an rms of 0.32 px, moved in by OUTLINE_WIDTH. The top edges and the sides
agree with a fit on the screenshots to 0.1 px; its lower edges, hidden by badges there, were off by
up to 6 px."""

CIRCLE = (72.4, 72.67, 64.26)
"""The メンタル window: centre x, centre y and radius in icon pixels, measured the same way on the four
round frames (the outline's outer edge, rms 0.38 px over 2,144 points, radius less OUTLINE_WIDTH)."""

SUPERSAMPLE = 8
"""Samples per pixel side when measuring how much of a pixel lies inside a window."""


def _inside_hexagon(x: np.ndarray, y: np.ndarray, grow: float) -> np.ndarray:
    """Whether each point lies inside the convex HEXAGON (corners clockwise), each side moved out by `grow` (in, when negative)."""
    inside = np.ones(x.shape, dtype=bool)
    for i, (ax, ay) in enumerate(HEXAGON):
        bx, by = HEXAGON[(i + 1) % len(HEXAGON)]
        inside &= (bx - ax) * (y - ay) - (by - ay) * (x - ax) >= -grow * float(np.hypot(bx - ax, by - ay))
    return inside


def _inside_circle(x: np.ndarray, y: np.ndarray, grow: float) -> np.ndarray:
    cx, cy, r = CIRCLE
    return (x - cx) ** 2 + (y - cy) ** 2 <= (r + grow) ** 2


@cache
def window(card_type: str, grow: float = 0.0) -> np.ndarray:
    """Per icon pixel, the share of it inside the art window of a card of `card_type` ("active" or "mental"),
    0 to 1; with `grow`, inside the window widened by that many pixels on every side (narrowed, when negative)."""
    inside = {"active": _inside_hexagon, "mental": _inside_circle}[card_type]
    n = SUPERSAMPLE
    offsets = (np.arange(n) + 0.5) / n
    y, x = np.mgrid[0:ICON, 0:ICON].astype(np.float64)
    total = np.zeros((ICON, ICON))
    for dy in offsets:
        for dx in offsets:
            total += inside(x + dx, y + dy, grow)
    result = total / (n * n)
    result.setflags(write=False)
    return result


CORNER_RADIUS = 8.5
"""The icon's dark border is a rounded square; outside its corners the screenshot shows the P図鑑's white panel."""


@cache
def rounded(size: int = ICON) -> np.ndarray:
    """Per pixel of a `size` square icon, the share of it inside the icon's rounded border, 0 to 1."""
    r = CORNER_RADIUS * size / ICON
    n = SUPERSAMPLE
    offsets = (np.arange(n) + 0.5) / n
    y, x = np.mgrid[0:size, 0:size].astype(np.float64)
    total = np.zeros((size, size))
    for dy in offsets:
        for dx in offsets:
            px, py = x + dx, y + dy
            cx = np.clip(px, r, size - r)
            cy = np.clip(py, r, size - r)
            total += (px - cx) ** 2 + (py - cy) ** 2 <= r * r
    result = total / (n * n)
    result.setflags(write=False)
    return result
