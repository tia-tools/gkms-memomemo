"""Card art: the offered cards and their masters, and a master placed where the game draws it."""

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

from geometry import ART_SIZE, ART_X0, ART_Y0, ICON


@dataclass(frozen=True)
class Card:
    """A card the page offers, at one level, as `offered.ts` prints it."""

    id: str
    upgrade: int
    name: str
    plan: str
    rarity: str
    type: str
    order: str
    asset: str
    per_idol: bool

    @property
    def cell(self) -> str:
        """The card and level as the index names them, `<card id>:<level>`."""
        return f"{self.id}:{self.upgrade}"


@dataclass(frozen=True)
class Offered:
    idols: tuple[str, ...]
    cards: tuple[Card, ...]


def read_offered(path: Path) -> Offered:
    """The JSON `bun scripts/icons/offered.ts` printed."""
    data = json.loads(path.read_text())
    cards = tuple(
        Card(c["id"], c["upgrade"], c["name"], c["plan"], c["rarity"], c["type"], c["order"], c["asset"], c["perIdol"])
        for c in data["cards"]
    )
    return Offered(tuple(data["idols"]), cards)


def variant_name(asset: str, idol: str | None) -> str:
    """A master's name without `.webp`: the asset, with `-<idol>` for art drawn per idol."""
    return asset if idol is None else f"{asset}-{idol}"


def master_variants(masters: Path, asset: str, per_idol: bool) -> list[str | None]:
    """The idols whose art the masters hold for `asset` (None for a single image), in name order."""
    if not per_idol:
        return [None] if (masters / f"{asset}.webp").exists() else []
    return sorted(p.stem.removeprefix(f"{asset}-") for p in masters.glob(f"{asset}-*.webp"))


def load_master(masters: Path, asset: str, idol: str | None) -> Image.Image:
    """A master as RGB, its transparent corners filled with white."""
    with Image.open(masters / f"{variant_name(asset, idol)}.webp") as image:
        rgba = image.convert("RGBA")
    flat = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    flat.alpha_composite(rgba)
    return flat.convert("RGB")


def place(master: Image.Image, size: int = ICON) -> np.ndarray:
    """The master drawn where the game draws it in the icon, as float RGB; `size` scales the icon (146 → 112)."""
    scale = size / ICON
    k = master.size[0] / (ART_SIZE * scale)
    placed = master.transform(
        (size, size),
        Image.Transform.AFFINE,
        (k, 0, -ART_X0 * scale * k, 0, k, -ART_Y0 * scale * k),
        resample=Image.Resampling.BICUBIC,
    )
    return np.asarray(placed, dtype=np.float32)
