import math

import numpy as np

from geometry import CIRCLE, HEXAGON, ICON, window


def shoelace(points):
    return abs(sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(points, points[1:] + points[:1]))) / 2


def test_the_windows_have_the_area_of_their_shapes():
    assert math.isclose(window("active").sum(), shoelace(list(HEXAGON)), rel_tol=0.002)
    assert math.isclose(window("mental").sum(), math.pi * CIRCLE[2] ** 2, rel_tol=0.002)


def test_coverage_is_a_share_full_at_the_centre_and_empty_in_the_corner():
    for card_type in ("active", "mental"):
        w = window(card_type)
        assert w.shape == (ICON, ICON)
        assert w.min() == 0 and w.max() == 1
        assert w[73, 73] == 1 and w[0, 0] == 0
        assert ((w > 0) & (w < 1)).any()


def test_growing_moves_every_side_out_and_shrinking_in():
    r = CIRCLE[2]
    assert math.isclose(window("mental", 2.5).sum(), math.pi * (r + 2.5) ** 2, rel_tol=0.002)
    assert math.isclose(window("mental", -2.5).sum(), math.pi * (r - 2.5) ** 2, rel_tol=0.002)
    grown, shrunk, plain = window("active", 1.0), window("active", -1.0), window("active")
    assert (grown >= plain).all() and (shrunk <= plain).all()
    perimeter = sum(math.dist(a, b) for a, b in zip(HEXAGON, HEXAGON[1:] + HEXAGON[:1]))
    assert math.isclose(grown.sum() - plain.sum(), perimeter, rel_tol=0.05)


def test_the_hexagon_is_pointy_topped_and_the_circle_round():
    w = window("active")
    top = np.nonzero(w[:, 72] > 0.5)[0].min()
    side = np.nonzero(w[73] > 0.5)[0].min()
    assert top < 6 and 10 < side < 14
    m = window("mental")
    assert abs(np.nonzero(m[73] > 0.5)[0].min() - (CIRCLE[0] - CIRCLE[2])) < 1
