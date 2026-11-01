"""The user's screenshots: which files there are, what their folders say, and the icon cut from each.

Laid out `<root>/<base|enhanced>/<N|R|SR|SSR>/*.png` (docs/plans/EXECPLAN_GAME_STYLE_ICONS.md, I12):
the folder gives the card's level and rarity, the art gives the card.
"""

import hashlib
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

from geometry import BOX, SHOT_SIZE

LEVELS = {"base": 0, "enhanced": 1}
RARITIES = ("N", "R", "SR", "SSR")


@dataclass(frozen=True)
class Shot:
    path: Path
    name: str
    """The path under the root, `base/SR/gakumas_….png`, as reports name it."""
    upgrade: int
    rarity: str
    digest: str
    """The first 8 hex digits of the file's SHA-256, which tells a retaken screenshot from the same one."""


class ShotError(Exception):
    pass


def parse_place(relative: Path) -> tuple[int, str]:
    """The level and rarity a screenshot's folders give, or ShotError naming what is wrong."""
    parts = relative.parts
    if len(parts) != 3 or parts[0] not in LEVELS or parts[1] not in RARITIES or relative.suffix.lower() != ".png":
        raise ShotError(f"{relative}: expected <base|enhanced>/<N|R|SR|SSR>/<name>.png")
    return LEVELS[parts[0]], parts[1]


def list_shots(root: Path) -> list[Shot]:
    """Every screenshot under `root`, in name order; any other file is an error, not skipped."""
    shots = []
    for path in sorted(p for p in root.rglob("*") if p.is_file() and p.name != ".DS_Store"):
        relative = path.relative_to(root)
        upgrade, rarity = parse_place(relative)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()[:8]
        shots.append(Shot(path, relative.as_posix(), upgrade, rarity, digest))
    return shots


def icon(shot: Shot) -> np.ndarray:
    """The icon cut from the screenshot, as float RGB, ICON × ICON × 3."""
    with Image.open(shot.path) as image:
        if image.size != SHOT_SIZE:
            raise ShotError(f"{shot.name}: {image.size[0]} × {image.size[1]}, expected {SHOT_SIZE[0]} × {SHOT_SIZE[1]}")
        return np.asarray(image.convert("RGB").crop(BOX), dtype=np.float32)
