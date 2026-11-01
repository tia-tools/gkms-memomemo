"""The placeholder frames (docs/plans/EXECPLAN_GAME_STYLE_ICONS.md, I5): the empty frame of each
rarity and type, cut from the user's `temp/image.png` (2560 × 1440), a game screen that shows one
icon of each with no values on it, its window blanked to white. Pure: no I/O.
"""

import numpy as np
from PIL import Image

from geometry import ICON, window
from sheets import CELL, finish

IMAGE_SIZE = (2560, 1440)
FRAME_BOXES = {
    "N-active": (134, 566, 490, 923),
    "N-mental": (132, 163, 489, 520),
    "R-active": (567, 167, 924, 524),
    "R-mental": (1012, 169, 1369, 527),
    "SR-active": (1857, 173, 2213, 530),
    "SR-mental": (1431, 168, 1787, 525),
    "SSR-active": (565, 570, 921, 927),
    "SSR-mental": (1012, 570, 1369, 927),
}
"""Each icon in the image, dark border included, as (left, top, right, bottom): measured from its border."""
ORDER = ("N-active", "N-mental", "R-active", "R-mental", "SR-active", "SR-mental", "SSR-active", "SSR-mental")
"""The frames' order in `frames112.webp`, one row; the page finds a frame by this order."""
BLANK_GROW = 1.5
"""The white fill reaches this far past the window, into the white outline, so no art shows at the edge."""


def frame_cell(image: Image.Image, name: str) -> np.ndarray:
    """One placeholder frame as a CELL px RGBA cell."""
    if image.size != IMAGE_SIZE:
        raise ValueError(f"frames: the image is {image.size[0]} × {image.size[1]}, expected {IMAGE_SIZE[0]} × {IMAGE_SIZE[1]}")
    icon = np.asarray(image.convert("RGB").crop(FRAME_BOXES[name]).resize((ICON, ICON), Image.Resampling.LANCZOS), dtype=np.float32)
    fill = window(name.split("-")[1], BLANK_GROW)[..., None]
    return finish(fill * 255.0 + (1 - fill) * icon)


def frames_row(image: Image.Image) -> np.ndarray:
    """The eight frames in ORDER, one row of CELL px cells."""
    return np.concatenate([frame_cell(image, name) for name in ORDER], axis=1)
