"""Cells, sprite sheets and their index (docs/plans/EXECPLAN_GAME_STYLE_ICONS.md, I2, I3 and § Interfaces).

A cell is one card at one level painted on one idol's art, CELL pixels square with transparent
corners. A plan's sheets (one per idol) hold the same cells in the same order: the plan's cards
and the free ones, in the game's order and then by level, COLUMNS to a row. Pure: no I/O.
"""

import hashlib

import numpy as np
from PIL import Image

from art import Card
from geometry import ICON, rounded
from overlay import Overlay, Veil, paint

CELL = 112
COLUMNS = 10
PLANS = ("sense", "logic", "anomaly")
PREFIX = "gkms-memomemo/sheet112"
"""The sheets' key prefix in the bucket `tia-assets`; the upload refuses any other (I3)."""


def plan_cells(cards: list[Card], plan: str) -> list[Card]:
    """The cells of a plan's sheets: its cards and the free ones, in the game's order, then by level."""
    return sorted((c for c in cards if c.plan in (plan, "free")), key=lambda c: (c.order, c.id, c.upgrade))


def finish(icon: np.ndarray) -> np.ndarray:
    """A 146 px float RGB icon as a CELL px RGBA cell: scaled down once, its corners made transparent."""
    scaled = Image.fromarray(np.clip(np.round(icon), 0, 255).astype(np.uint8)).resize((CELL, CELL), Image.Resampling.LANCZOS)
    rgb = np.asarray(scaled, dtype=np.float32)
    alpha = rounded(CELL)
    # A corner pixel is part border, part the panel's white: keep the border's colour.
    a = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.where(alpha[..., None] < 1, np.clip((rgb - (1 - a) * 255) / a, 0, 255), rgb)
    return np.dstack([np.round(rgb), np.round(alpha * 255)]).astype(np.uint8)


def paint_cell(placed_art: np.ndarray, veil: Veil, overlay: Overlay) -> np.ndarray:
    """A card's cell: its overlay laid on an idol's art placed in the icon (art.place) under the card's veil."""
    if placed_art.shape[:2] != (ICON, ICON):
        raise ValueError("paint_cell: the art must be placed at the icon's size")
    return finish(paint(veil.apply(placed_art), overlay))


def grid(cells: list[np.ndarray], columns: int = COLUMNS) -> np.ndarray:
    """The cells row by row, `columns` to a row, the last row's empty places transparent."""
    if not cells:
        raise ValueError("grid: no cells")
    rows = (len(cells) + columns - 1) // columns
    sheet = np.zeros((rows * CELL, columns * CELL, 4), dtype=np.uint8)
    for i, cell in enumerate(cells):
        y, x = divmod(i, columns)
        sheet[y * CELL : (y + 1) * CELL, x * CELL : (x + 1) * CELL] = cell
    return sheet


def sheet_key(plan: str, idol: str, data: bytes) -> str:
    """A sheet's bucket key, named for its plan, its idol and the first 8 hex digits of its bytes' SHA-256."""
    return f"{PREFIX}/{plan}-{idol}-{hashlib.sha256(data).hexdigest()[:8]}.webp"


def index(plans: dict[str, tuple[list[str], dict[str, str]]]) -> dict:
    """The index: per plan, its cells (`<card id>:<level>`) and each idol's sheet key, in the order given."""
    return {
        "formatVersion": 1,
        "cell": CELL,
        "columns": COLUMNS,
        "plans": [
            {"plan": plan, "cells": cells, "sheets": [{"idol": idol, "file": key} for idol, key in sheets.items()]}
            for plan, (cells, sheets) in plans.items()
        ],
    }
