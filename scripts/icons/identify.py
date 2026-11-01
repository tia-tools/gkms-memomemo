"""Which card a screenshot shows, by matching its art against every offered card's masters.

The probe is a central disc of the icon: inside both window shapes and clear of every badge. The
game whitens some cards' art by a fixed amount (a veil), so each candidate is first fitted to the
screenshot with a gain and an offset per channel, and then scored by the mean of the smallest 80 %
of its per-pixel differences, which keeps a stray overlay pixel from deciding. Pure: no I/O.
"""

from dataclasses import dataclass

import numpy as np

from geometry import ICON

PROBE_CENTRE = (73, 73)
PROBE_RADIUS = 36
KEEP = 0.8
"""The share of probe pixels, the closest ones, a score averages."""
MIN_RATIO = 1.5
"""A match counts only when the best other card scores at least this many times worse (2.26 or more on all 349 shots)."""


def probe_mask() -> np.ndarray:
    y, x = np.mgrid[0:ICON, 0:ICON]
    cx, cy = PROBE_CENTRE
    return (x - cx) ** 2 + (y - cy) ** 2 <= PROBE_RADIUS**2


@dataclass(frozen=True)
class Candidate:
    asset: str
    idol: str | None


@dataclass(frozen=True)
class Match:
    asset: str
    idol: str | None
    score: float
    runner_up: float
    """The best score of any other asset."""
    runner_up_asset: str

    @property
    def ratio(self) -> float:
        return self.runner_up / max(self.score, 1e-6)

    @property
    def clear(self) -> bool:
        return self.ratio >= MIN_RATIO


class Candidates:
    """Every candidate's placed art at the probe's pixels, ready to score against many screenshots."""

    def __init__(self, names: list[Candidate], probes: np.ndarray):
        if len(names) != len(probes) or len(names) < 2:
            raise ValueError("candidates: a probe per name, and at least two")
        self.names = names
        self.x = probes.astype(np.float32)
        self.mean = self.x.mean(axis=1, keepdims=True)
        self.centred = self.x - self.mean
        self.var = (self.centred**2).sum(axis=1, keepdims=True) + 1e-6

    def scores(self, probe: np.ndarray) -> np.ndarray:
        """Each candidate's score against one screenshot's probe pixels (P × 3); lower is closer."""
        s = probe[None].astype(np.float32)
        gain = (self.centred * (s - s.mean(axis=1, keepdims=True))).sum(axis=1, keepdims=True) / self.var
        offset = s.mean(axis=1, keepdims=True) - gain * self.mean
        residual = np.abs(gain * self.x + offset - s).max(axis=2)
        k = max(1, int(residual.shape[1] * KEEP))
        return np.partition(residual, k - 1, axis=1)[:, :k].mean(axis=1)

    def best(self, probe: np.ndarray) -> Match:
        scores = self.scores(probe)
        order = np.argsort(scores, kind="stable")
        first = self.names[order[0]]
        other = next((i for i in order if self.names[i].asset != first.asset), None)
        if other is None:
            raise ValueError("candidates: all of one asset")
        return Match(first.asset, first.idol, float(scores[order[0]]), float(scores[other]), self.names[other].asset)
