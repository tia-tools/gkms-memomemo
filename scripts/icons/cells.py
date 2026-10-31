"""From identified screenshots to cells (`<card id>:<level>`), and every reason not to trust the result.

A screenshot's art names the card (no two card ids share an art asset), its folder the level and
the rarity. The pipeline builds nothing while one of these problems stands: a screenshot that
names no card clearly, a folder whose rarity is not the card's, a level the page does not offer
for that card, or two screenshots of one cell. An offered cell no screenshot shows is not a
problem but a cell the page draws as a placeholder until one is taken; it is listed apart. Pure.
"""

from dataclasses import dataclass

from art import Card
from identify import Match
from shots import Shot


@dataclass(frozen=True)
class Identified:
    shot: Shot
    match: Match


@dataclass(frozen=True)
class Assigned:
    shot: Shot
    match: Match
    card: Card


def assign(identified: list[Identified], cards: tuple[Card, ...]) -> tuple[dict[str, Assigned], list[str], list[str]]:
    """The cells the screenshots show, the problems found and the offered cells without a screenshot, each a line."""
    by_cell = {card.cell: card for card in cards}
    ids_by_asset: dict[str, set[str]] = {}
    for card in cards:
        ids_by_asset.setdefault(card.asset, set()).add(card.id)
    problems: list[str] = []
    for asset, ids in sorted(ids_by_asset.items()):
        if len(ids) > 1:
            problems.append(f"{asset}: the art of {len(ids)} cards ({', '.join(sorted(ids))}), so it cannot name one")
    assigned: dict[str, Assigned] = {}
    for item in identified:
        shot, match = item.shot, item.match
        if not match.clear:
            problems.append(f"{shot.name}: no clear match (best {match.asset} {match.score:.2f}, next {match.runner_up_asset} {match.runner_up:.2f})")
            continue
        ids = ids_by_asset.get(match.asset, set())
        if len(ids) != 1:
            continue
        cell = f"{next(iter(ids))}:{shot.upgrade}"
        card = by_cell.get(cell)
        if card is None:
            problems.append(f"{shot.name}: {match.asset} at level {shot.upgrade}, which the page does not offer")
            continue
        if card.rarity != shot.rarity:
            problems.append(f"{shot.name}: {card.name} is {card.rarity}, in the {shot.rarity} folder")
            continue
        if cell in assigned:
            problems.append(f"{shot.name}: {card.name} ({cell}) again, already from {assigned[cell].shot.name}")
            continue
        assigned[cell] = Assigned(shot, match, card)
    missing = [
        f"{card.cell}: no screenshot of {card.name} ({'enhanced' if card.upgrade else 'base'}/{card.rarity})"
        for card in cards
        if card.cell not in assigned
    ]
    return assigned, problems, missing
