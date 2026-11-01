import hashlib

import numpy as np
import pytest
from PIL import Image

from art import Card
from frames import FRAME_BOXES, IMAGE_SIZE, ORDER, frame_cell, frames_row
from geometry import ICON
from overlay import Overlay, Veil
from sheets import CELL, COLUMNS, PREFIX, finish, grid, index, paint_cell, plan_cells, sheet_key


def card(card_id: str, upgrade: int, plan: str, order: str) -> Card:
    return Card(card_id, upgrade, card_id, plan, "R", "active", order, f"img_{card_id}", False)


def test_a_plans_cells_are_its_cards_and_the_free_ones_in_the_games_order_then_by_level():
    cards = [card("b", 1, "sense", "2"), card("f", 0, "free", "1"), card("a", 0, "sense", "3"), card("b", 0, "sense", "2"), card("l", 0, "logic", "0")]
    assert [c.cell for c in plan_cells(cards, "sense")] == ["f:0", "b:0", "b:1", "a:0"]
    assert [c.cell for c in plan_cells(cards, "logic")] == ["l:0", "f:0"]


def test_a_cell_is_scaled_down_with_transparent_corners():
    cell = finish(np.full((ICON, ICON, 3), 100.0))
    assert cell.shape == (CELL, CELL, 4)
    assert cell[0, 0, 3] == 0 and cell[CELL // 2, CELL // 2, 3] == 255 and cell[0, CELL // 2, 3] == 255
    assert tuple(cell[CELL // 2, CELL // 2, :3]) == (100, 100, 100)


def test_painting_lays_the_overlay_on_the_veiled_art():
    alpha = np.zeros((ICON, ICON), dtype=np.float32)
    alpha[:, : ICON // 2] = 1
    overlay = Overlay(alpha, np.full((ICON, ICON, 3), 200.0, dtype=np.float32))
    cell = paint_cell(np.full((ICON, ICON, 3), 50.0, dtype=np.float32), Veil(0.5, 10.0), overlay)
    assert tuple(cell[60, 20, :3]) == (200, 200, 200)
    assert tuple(cell[60, 100, :3]) == (35, 35, 35)
    with pytest.raises(ValueError):
        paint_cell(np.zeros((1, ICON, 3), dtype=np.float32), Veil(1, 0), overlay)  # would broadcast unnoticed


def test_the_grid_fills_rows_of_ten_and_leaves_the_rest_transparent():
    cells = [np.full((CELL, CELL, 4), i, dtype=np.uint8) for i in range(1, 13)]
    sheet = grid(cells)
    assert sheet.shape == (2 * CELL, COLUMNS * CELL, 4)
    assert sheet[0, 0, 0] == 1 and sheet[CELL, CELL, 0] == 12 and sheet[CELL, 2 * CELL, 3] == 0
    with pytest.raises(ValueError):
        grid([])


def test_a_sheet_is_named_for_its_plan_idol_and_bytes():
    assert sheet_key("sense", "hski", b"x") == f"{PREFIX}/sense-hski-{hashlib.sha256(b'x').hexdigest()[:8]}.webp"


def test_the_index_lists_each_plans_cells_and_sheets():
    built = index({"sense": (["a:0", "a:1"], {"hski": "k1", "ttmr": "k2"})})
    assert built == {
        "formatVersion": 1,
        "cell": CELL,
        "columns": COLUMNS,
        "plans": [{"plan": "sense", "cells": ["a:0", "a:1"], "sheets": [{"idol": "hski", "file": "k1"}, {"idol": "ttmr", "file": "k2"}]}],
    }


def test_a_frame_has_its_window_blanked_and_keeps_its_rim():
    image = Image.new("RGB", IMAGE_SIZE, (240, 160, 40))
    cell = frame_cell(image, "SR-active")
    assert tuple(cell[CELL // 2, CELL // 2, :3]) == (255, 255, 255)
    assert tuple(cell[CELL // 2, 3, :3]) == (240, 160, 40)
    assert frames_row(image).shape == (CELL, 8 * CELL, 4)
    with pytest.raises(ValueError):
        frame_cell(Image.new("RGB", (100, 100)), "SR-active")


def test_every_frame_in_the_order_has_a_box():
    assert sorted(ORDER) == sorted(FRAME_BOXES) and len(ORDER) == 8
