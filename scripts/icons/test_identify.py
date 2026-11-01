import numpy as np
import pytest

from geometry import ICON
from identify import MIN_RATIO, Candidate, Candidates, probe_mask


def art(seed: int) -> np.ndarray:
    """A smooth random picture, like card art at icon size."""
    rng = np.random.default_rng(seed)
    small = rng.uniform(0, 255, (8, 8, 3))
    return np.kron(small, np.ones((19, 19, 1)))[:ICON, :ICON].astype(np.float32)


def pool(arts: dict[str, np.ndarray]) -> Candidates:
    mask = probe_mask()
    names = [Candidate(asset, None) for asset in arts]
    return Candidates(names, np.stack([a[mask] for a in arts.values()]))


def test_the_veiled_art_with_badges_over_it_is_found():
    arts = {f"a{i}": art(i) for i in range(6)}
    shot = 0.8 * arts["a3"] + 40
    rng = np.random.default_rng(9)
    shot[rng.uniform(size=shot.shape[:2]) < 0.1] = [255, 0, 0]  # a tenth of the pixels under overlay
    match = pool(arts).best(shot[probe_mask()])
    assert match.asset == "a3"
    assert match.clear and match.ratio >= MIN_RATIO


def test_two_cards_with_the_same_art_are_not_told_apart():
    arts = {"a": art(1), "b": art(1).copy(), "c": art(2)}
    match = pool(arts).best(arts["a"][probe_mask()])
    assert match.asset in {"a", "b"}
    assert not match.clear


def test_the_runner_up_is_the_best_other_card_not_another_idol_of_the_same():
    mask = probe_mask()
    a, b = art(1), art(2)
    names = [Candidate("x", "hski"), Candidate("x", "ttmr"), Candidate("y", None)]
    candidates = Candidates(names, np.stack([a[mask], (a * 0.98)[mask], b[mask]]))
    match = candidates.best(a[mask])
    assert match.asset == "x" and match.runner_up_asset == "y"


def test_fewer_than_two_candidates_are_refused():
    with pytest.raises(ValueError):
        Candidates([Candidate("x", None)], art(1)[probe_mask()][None])
