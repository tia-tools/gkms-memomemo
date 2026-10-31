"""The game's overlay on a card's art: lifted off a screenshot, and painted onto another idol's art.

A screenshot's icon is, per pixel, `alpha × overlay + (1 − alpha) × veiled art`: the overlay is the
frame, the values, the badges, the ＋ and the A or M; the veiled art is the master placed under it
and whitened by the card's veil (`gain × art + offset`). Knowing the art, lifting recovers the
overlay's alpha and colour; painting lays it on another art under the same veil. Pure: no I/O.

Alpha comes from three places. Outside the window the overlay is opaque. Near the window's edge,
within EDGE_ZONE pixels of the fitted shape on either side, the game draws a white outline over
the art, and the fitted shape is right only to a pixel or two, so a pixel there that is a mix of
the outline's colour and the art under it gets the outline's colour, with alpha its share of the
mix: measured from the pixel, not from the shape, so the original idol's art never leaks into
another idol's icon. Only where the art itself is close to the outline's colour, and the share
cannot be measured, does the shape decide (geometry.window); a pixel there that is no such mix is
a badge crossing the edge, as opaque as it is far from the art. Inside the window, overlay can only
be in the slots where the game draws badges (found across all screenshots, `slots`); there a
pixel far from the veiled art is overlay, and a pixel at a badge's edge is matted against the
colour of the nearest opaque badge pixel. Anywhere else inside the window the art shows, so a
difference there (resampling noise in fine art) is never lifted. Last, what the game draws the
same on every card of a type (the A or M badge at the bottom, the outline, part of the cost
badge) is found as the pixels that do not change across all that type's screenshots, and is
opaque overlay there even where it has the art's colour, as the A badge's pale backing has on
white art (`template`).
"""

from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageFilter

from geometry import window
from identify import probe_mask

LOW = 14.0
"""Below this difference (of 255, the largest channel) a pixel is art."""
HIGH = 40.0
"""Above this difference a pixel in a slot is opaque overlay."""
SLOT_MIN_SHARE = 0.03
"""A pixel is a slot when at least this share of the screenshots have opaque overlay on it. Over the
349 screenshots the count of such pixels inside the windows falls steeply up to 3 % (resampling
noise in the art) and then stays near 3,600 up to 6 % (the badges), so 3 % sits at the knee."""
SLOT_GROW = 2
"""Slots are grown by this many pixels, so a badge's soft edge stays inside."""
EDGE_ZONE = 2.5
"""How far, in icon pixels, either side of the fitted window shape the outline is looked for."""
TEMPLATE_SPREAD = 2.0
"""A pixel is the same on every card of a type when its screenshots' median absolute deviation is at most this."""
TEMPLATE_MIN_SHOTS = 20
"""Fewer screenshots of a type than this make no template."""
MEASURABLE = 40.0
"""The least difference (largest channel) between the outline's colour and the art for a share to be measured."""


@dataclass(frozen=True)
class Veil:
    gain: float
    offset: float

    def apply(self, art: np.ndarray) -> np.ndarray:
        return np.clip(self.gain * art + self.offset, 0, 255)


@dataclass(frozen=True)
class Template:
    """What the game draws the same on every card of a type, inside and near its window."""

    mask: np.ndarray
    colour: np.ndarray


@dataclass(frozen=True)
class Overlay:
    alpha: np.ndarray
    """ICON × ICON, 0 to 1."""
    colour: np.ndarray
    """ICON × ICON × 3, 0 to 255; meaningless where alpha is 0."""


def fit_veil(shot: np.ndarray, art: np.ndarray) -> Veil:
    """One gain and offset shared by the channels, fitted on the probe disc, ignoring its worst 30 % of pixels."""
    mask = probe_mask()
    a = art[mask].ravel().astype(np.float64)
    s = shot[mask].ravel().astype(np.float64)
    keep = np.ones(a.shape, dtype=bool)
    gain, offset = 1.0, 0.0
    for _ in range(4):
        gain, offset = (float(v) for v in np.polyfit(a[keep], s[keep], 1))
        residual = np.abs(gain * a + offset - s)
        keep = residual <= max(float(np.percentile(residual, 70)), 1.0)
    return Veil(gain, offset)


def difference(shot: np.ndarray, veiled: np.ndarray) -> np.ndarray:
    """The largest channel's difference per pixel, median-filtered over 3 × 3 so lone noisy pixels drop out."""
    d = np.abs(shot - veiled).max(axis=2)
    filtered = Image.fromarray(np.clip(d, 0, 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(3))
    return np.asarray(filtered, dtype=np.float32)


def _grow(mask: np.ndarray, pixels: int) -> np.ndarray:
    image = Image.fromarray(mask.astype(np.uint8) * 255)
    for _ in range(pixels):
        image = image.filter(ImageFilter.MaxFilter(3))
    return np.asarray(image) > 127


def _shrink(mask: np.ndarray, pixels: int) -> np.ndarray:
    image = Image.fromarray(mask.astype(np.uint8) * 255)
    for _ in range(pixels):
        image = image.filter(ImageFilter.MinFilter(3))
    return np.asarray(image) > 127


def slots(differences: list[np.ndarray]) -> np.ndarray:
    """Where badges are drawn: pixels with opaque overlay in at least SLOT_MIN_SHARE of the screenshots, grown by SLOT_GROW."""
    count = sum((d > HIGH).astype(np.int32) for d in differences)
    return _grow(np.asarray(count) >= SLOT_MIN_SHARE * len(differences), SLOT_GROW)


def template(icons: list[np.ndarray], card_type: str) -> Template:
    """The pixels near or inside the window that every screenshot of `card_type` shows alike, and their median colour."""
    near = window(card_type, EDGE_ZONE) > 0
    if len(icons) < TEMPLATE_MIN_SHOTS:
        return Template(np.zeros(near.shape, dtype=bool), np.zeros(near.shape + (3,), dtype=np.float32))
    stack = np.stack(icons)
    median = np.median(stack, axis=0)
    spread = np.median(np.abs(stack - median), axis=0).max(axis=2)
    return Template(near & (spread <= TEMPLATE_SPREAD), median.astype(np.float32))


def _unpremultiply(shot: np.ndarray, veiled: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    a = np.maximum(alpha, 1e-3)[..., None]
    return np.clip((shot - (1 - a) * veiled) / a, 0, 255)


def _matte(shot: np.ndarray, veiled: np.ndarray, core: np.ndarray, band: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Alpha and colour for the band pixels, each against the opaque neighbour (5 × 5) whose colour explains it best."""
    h, w = core.shape
    alpha = np.zeros((h, w), dtype=np.float32)
    colour = np.zeros((h, w, 3), dtype=np.float32)
    best = np.full((h, w), np.inf, dtype=np.float32)
    ys, xs = np.nonzero(band)
    s, v = shot[ys, xs], veiled[ys, xs]
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            ny, nx = ys + dy, xs + dx
            ok = (ny >= 0) & (ny < h) & (nx >= 0) & (nx < w)
            ny, nx = np.clip(ny, 0, h - 1), np.clip(nx, 0, w - 1)
            ok &= core[ny, nx]
            f = shot[ny, nx]
            fv = f - v
            norm = (fv**2).sum(axis=1)
            ok &= norm > 400.0  # a foreground too close to the art cannot be told from it
            a = np.clip(((s - v) * fv).sum(axis=1) / np.maximum(norm, 1e-6), 0, 1)
            err = np.abs(s - (a[:, None] * f + (1 - a[:, None]) * v)).max(axis=1)
            better = ok & (err < best[ys, xs])
            best[ys[better], xs[better]] = err[better]
            alpha[ys[better], xs[better]] = a[better]
            colour[ys[better], xs[better]] = f[better]
    unmatched = band & ~np.isfinite(best)
    ramp = np.clip((np.abs(shot - veiled).max(axis=2) - LOW) / (HIGH - LOW), 0, 1)
    alpha[unmatched] = ramp[unmatched]
    colour[unmatched] = _unpremultiply(shot, veiled, ramp)[unmatched]
    return alpha, colour


def _share(shot: np.ndarray, colour: np.ndarray, veiled: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Per pixel, the share t of `colour` in the best mix t × colour + (1 − t) × veiled, and whether that mix explains the pixel."""
    span = colour - veiled
    t = np.clip(((shot - veiled) * span).sum(axis=2) / np.maximum((span**2).sum(axis=2), 1e-6), 0, 1)
    residual = np.abs(shot - (t[..., None] * colour + (1 - t[..., None]) * veiled)).max(axis=2)
    return t.astype(np.float32), residual < LOW


def outline_colour(shot: np.ndarray, zone: np.ndarray, coverage: np.ndarray) -> np.ndarray:
    """The outline's colour: the median of the near-white, colourless pixels outside the shape in the edge zone, else white."""
    rgb = shot[zone & (coverage == 0)]
    light = rgb[(rgb.min(axis=1) >= 220) & (np.ptp(rgb, axis=1) <= 20)]
    if len(light) < 20:
        return np.array([255.0, 255.0, 255.0], dtype=np.float32)
    return np.median(light, axis=0).astype(np.float32)


def lift(shot: np.ndarray, veiled: np.ndarray, card_type: str, slot: np.ndarray, same: Template | None = None) -> Overlay:
    """The overlay on `shot` of a card of `card_type`, whose art under the veil is `veiled`; `slot` is where badges
    may be, and `same` what every card of the type shows alike."""
    coverage = window(card_type)
    zone = (window(card_type, EDGE_ZONE) > 0) & (window(card_type, -EDGE_ZONE) < 1)
    d = difference(shot, veiled)
    inside = coverage > 0
    core = _grow(_shrink((d > HIGH) & slot & inside & ~zone, 1), 1) & (d > HIGH) & ~zone
    band = _grow(core, 2) & ~core & slot & inside & ~zone & (np.abs(shot - veiled).max(axis=2) > LOW)
    alpha, colour = _matte(shot, veiled, core, band)
    alpha[core] = 1.0
    colour[core] = shot[core]

    outside = coverage == 0
    alpha[outside & ~zone] = 1.0
    colour[outside & ~zone] = shot[outside & ~zone]

    white = outline_colour(shot, zone, coverage)
    share, mixed = _share(shot, white, veiled)
    measurable = np.abs(white - veiled).max(axis=2) >= MEASURABLE
    edge = zone & mixed
    alpha[edge] = np.where(measurable, share, 1.0 - coverage)[edge]
    colour[edge] = white
    # In the zone but no mix of outline and art: the frame where the shape says outside, and
    # elsewhere a badge crossing the edge, as opaque as it is far from the art.
    rest = zone & ~mixed
    alpha[rest & outside] = 1.0
    colour[rest & outside] = shot[rest & outside]
    crossing = rest & inside
    ramp = np.clip((np.abs(shot - veiled).max(axis=2) - LOW) / (HIGH - LOW), 0, 1).astype(np.float32)
    alpha[crossing] = ramp[crossing]
    colour[crossing] = _unpremultiply(shot, veiled, ramp)[crossing]
    if same is not None:
        # Only where this card shows it: a minority of cards may draw a badge over a shared pixel.
        shown = same.mask & (np.abs(shot - same.colour).max(axis=2) < LOW)
        alpha[shown] = 1.0
        colour[shown] = shot[shown]
    return Overlay(alpha.astype(np.float32), colour.astype(np.float32))


def paint(veiled: np.ndarray, overlay: Overlay) -> np.ndarray:
    """The icon with `overlay` laid on `veiled` art, float RGB 0 to 255."""
    a = overlay.alpha[..., None]
    return np.clip(a * overlay.colour + (1 - a) * veiled, 0, 255)


def to_rgba(overlay: Overlay) -> np.ndarray:
    """The overlay as 8-bit RGBA, for saving; colour is 0 where alpha is 0."""
    rgba = np.zeros(overlay.alpha.shape + (4,), dtype=np.uint8)
    rgba[..., :3] = np.round(np.where(overlay.alpha[..., None] > 0, overlay.colour, 0)).astype(np.uint8)
    rgba[..., 3] = np.round(overlay.alpha * 255).astype(np.uint8)
    return rgba


def from_rgba(rgba: np.ndarray) -> Overlay:
    return Overlay(rgba[..., 3].astype(np.float32) / 255, rgba[..., :3].astype(np.float32))
