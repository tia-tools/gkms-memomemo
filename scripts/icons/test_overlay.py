import numpy as np

from geometry import ICON, window
from overlay import HIGH, TEMPLATE_MIN_SHOTS, Overlay, Veil, fit_veil, from_rgba, lift, paint, slots, template, to_rgba
from test_identify import art

WHITE = np.array([255.0, 255.0, 255.0])
ORANGE = np.array([245.0, 180.0, 60.0])
BLUE = np.array([30.0, 120.0, 220.0])
VEIL = Veil(0.9, 20.0)
yy, xx = np.mgrid[0:ICON, 0:ICON]
BADGE = (30, 70)
EDGE_BADGE = (13, 70)
"""A badge on the hexagon's left side, half in the window and half on the frame."""


def badge_distance(centre: tuple[int, int]) -> np.ndarray:
    return np.hypot(xx - centre[0], yy - centre[1])


def game_icon(veiled: np.ndarray, edge_error: float = 1.5, badge: tuple[int, int] = BADGE) -> np.ndarray:
    """What the game draws: the art in a window `edge_error` px wider than the fitted one, a 1.5 px white
    outline around it, the frame beyond, and a blue badge with a soft edge at `badge`."""
    inner, outer = window("active", edge_error)[..., None], window("active", edge_error + 1.5)[..., None]
    icon = inner * veiled + (outer - inner) * WHITE + (1 - outer) * ORANGE
    alpha = np.clip(8.5 - badge_distance(badge), 0, 1)[..., None]
    return alpha * BLUE + (1 - alpha) * icon


def lifted(shot: np.ndarray, veiled: np.ndarray, badge: tuple[int, int] = BADGE) -> Overlay:
    return lift(shot, veiled, "active", badge_distance(badge) <= 12)


def test_the_overlay_carries_frame_outline_and_badge_to_other_art_without_the_first_art():
    first, second = VEIL.apply(art(1)), VEIL.apply(art(2))
    overlay = lifted(game_icon(first), first)
    error = np.abs(paint(second, overlay) - game_icon(second)).max(axis=2)
    assert error.mean() < 1.0
    near_edge = (window("active", 4) > 0) & (window("active", -4) < 1) & (badge_distance(BADGE) > 12)
    assert np.percentile(error[near_edge], 99) < 30


def test_painting_back_on_the_same_art_gives_the_screenshot():
    first = VEIL.apply(art(1))
    shot = game_icon(first)
    assert np.abs(paint(first, lifted(shot, first)) - shot).mean() < 0.5


def test_a_difference_inside_the_window_off_the_badge_slots_is_art_not_overlay():
    first = VEIL.apply(art(1))
    shot = game_icon(first)
    shot[56:64, 86:94] = 0.0  # a blob of noise in fine art: far from the master, but not a badge
    assert lifted(shot, first).alpha[56:64, 86:94].max() == 0


def test_a_badge_crossing_the_window_edge_stays_whole_on_other_art():
    first, second = VEIL.apply(art(1)), VEIL.apply(art(2))
    overlay = lifted(game_icon(first, badge=EDGE_BADGE), first, EDGE_BADGE)
    error = np.abs(paint(second, overlay) - game_icon(second, badge=EDGE_BADGE)).max(axis=2)
    assert error[badge_distance(EDGE_BADGE) <= 7].max() < 10


def test_the_badge_is_opaque_and_keeps_its_colour():
    first = VEIL.apply(art(1))
    overlay = lifted(game_icon(first), first)
    assert overlay.alpha[70, 30] == 1
    assert np.allclose(overlay.colour[70, 30], BLUE)


def test_the_veil_is_found_despite_stray_pixels_over_a_fifth_of_the_probe():
    a = art(3)
    shot = 0.85 * a + 30
    shot[::5] = [255, 0, 0]
    veil = fit_veil(shot, a)
    assert abs(veil.gain - 0.85) < 0.01 and abs(veil.offset - 30) < 1


def test_a_slot_is_where_enough_screenshots_have_overlay():
    maps = [np.zeros((ICON, ICON), dtype=np.float32) for _ in range(100)]
    for m in maps[:3]:
        m[10, 10] = HIGH + 1
    for m in maps[:2]:
        m[40, 40] = HIGH + 1
    s = slots(maps)
    assert s[10, 10] and s[12, 10] and not s[13, 10]
    assert not s[40, 40]


def test_an_overlay_survives_saving():
    alpha = np.linspace(0, 1, ICON * ICON, dtype=np.float32).reshape(ICON, ICON)
    colour = np.full((ICON, ICON, 3), 100.0, dtype=np.float32)
    back = from_rgba(to_rgba(Overlay(alpha, colour)))
    assert np.abs(back.alpha - alpha).max() <= 0.5 / 255 + 1e-6
    assert np.all(back.colour[alpha > 0] == 100)


PALE = np.array([238.0, 244.0, 248.0])
BOTTOM = (yy - 146) ** 2 + (xx - 72) ** 2 <= 14**2
"""A pale badge at the bottom, drawn alike on every card, as the game's A and M are."""


def with_bottom_badge(veiled: np.ndarray) -> np.ndarray:
    shot = game_icon(veiled)
    shot[BOTTOM] = PALE
    return shot


def test_a_badge_every_card_shows_alike_is_kept_where_it_has_the_arts_colour():
    arts = [VEIL.apply(art(i)) for i in range(TEMPLATE_MIN_SHOTS)]
    same = template([with_bottom_badge(a) for a in arts], "active")
    white = np.full((ICON, ICON, 3), 245.0)
    overlay = lift(with_bottom_badge(white), white, "active", BADGE_SLOT_FOR_TEMPLATE, same)
    inside = BOTTOM & (window("active") == 1)
    assert overlay.alpha[inside].min() == 1
    assert np.allclose(overlay.colour[inside], PALE)


def test_too_few_screenshots_make_no_template():
    arts = [VEIL.apply(art(i)) for i in range(TEMPLATE_MIN_SHOTS - 1)]
    assert not template([with_bottom_badge(a) for a in arts], "active").mask.any()


BADGE_SLOT_FOR_TEMPLATE = badge_distance(BADGE) <= 12


def test_a_card_showing_its_art_where_others_share_a_badge_does_not_carry_that_art():
    arts = [VEIL.apply(art(i)) for i in range(TEMPLATE_MIN_SHOTS)]
    same = template([with_bottom_badge(a) for a in arts], "active")
    first, second = VEIL.apply(art(50)), VEIL.apply(art(51))
    overlay = lift(game_icon(first), first, "active", BADGE_SLOT_FOR_TEMPLATE, same)  # this card has no bottom badge
    inside = BOTTOM & (window("active", -3) == 1)
    assert np.abs(paint(second, overlay) - second)[inside].max() < 1
