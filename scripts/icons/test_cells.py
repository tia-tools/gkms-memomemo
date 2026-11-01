from pathlib import Path

from art import Card
from cells import Identified, assign
from identify import Match
from shots import Shot


def card(n: int, upgrade: int, rarity="SR", asset=None) -> Card:
    return Card(f"p_card-01-act-2_{n:03d}", upgrade, f"c{n}", "sense", rarity, "active", f"{n:03d}", asset or f"img_{n}", False)


CARDS = (card(1, 0), card(1, 1), card(2, 0), card(2, 1), card(3, 0, "R"))


def shot(name: str, upgrade: int, rarity="SR") -> Shot:
    return Shot(Path(name), name, upgrade, rarity, "00000000")


def seen(asset: str, score=1.0, runner_up=5.0) -> Match:
    return Match(asset, None, score, runner_up, "other")


def test_each_screenshot_becomes_the_cell_of_its_art_and_folder_and_the_rest_are_missing():
    found = [Identified(shot("base/SR/a.png", 0), seen("img_1")), Identified(shot("enhanced/SR/b.png", 1), seen("img_1"))]
    cells, problems, missing = assign(found, CARDS)
    assert sorted(cells) == ["p_card-01-act-2_001:0", "p_card-01-act-2_001:1"]
    assert problems == []
    assert [m.split(":")[0] + ":" + m.split(":")[1] for m in missing] == ["p_card-01-act-2_002:0", "p_card-01-act-2_002:1", "p_card-01-act-2_003:0"]


def test_an_unclear_match_is_a_problem_not_a_guess():
    cells, problems, _ = assign([Identified(shot("base/SR/a.png", 0), seen("img_1", 3.0, 3.5))], CARDS)
    assert cells == {} and "no clear match" in problems[0]


def test_a_folder_of_the_wrong_rarity_is_a_problem():
    cells, problems, _ = assign([Identified(shot("base/SR/a.png", 0), seen("img_3"))], CARDS)
    assert cells == {} and "is R, in the SR folder" in problems[0]


def test_a_level_the_page_does_not_offer_is_a_problem():
    cells, problems, _ = assign([Identified(shot("enhanced/R/a.png", 1, "R"), seen("img_3"))], CARDS)
    assert cells == {} and "does not offer" in problems[0]


def test_two_screenshots_of_one_cell_are_a_problem():
    found = [Identified(shot("base/SR/a.png", 0), seen("img_2")), Identified(shot("base/SR/b.png", 0), seen("img_2"))]
    cells, problems, _ = assign(found, CARDS)
    assert list(cells) == ["p_card-01-act-2_002:0"]
    assert "again, already from base/SR/a.png" in problems[0]


def test_art_shared_by_two_cards_is_a_problem():
    cards = CARDS + (card(4, 0, asset="img_1"),)
    _, problems, _ = assign([], cards)
    assert "the art of 2 cards" in problems[0]
