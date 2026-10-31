"""Milestone 1 of docs/plans/EXECPLAN_GAME_STYLE_ICONS.md: identify every screenshot's card and lift its overlay.

    uv run lift.py --shots ../../temp/skill_cards --masters <dir> --cards out/offered.json

Writes, under out/: lifted/<card id>_<level>.png (each cell's overlay, RGBA, 146 px), lifted.json
(per cell: its screenshot and that file's hash, the art and idol it matched, the veil, the match's
score and margin, and how far the overlay painted back on the same art is from the screenshot),
and check/<rarity>-<type>.png (per card: the screenshot, the overlay painted back on the same art,
and painted on two other idols' art) to look at. Exits 1, after writing, when any screenshot
cannot be trusted (cells.assign); cells without a screenshot are listed but do not fail.
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from art import Card, load_master, master_variants, place, read_offered
from cells import Identified, assign
from identify import Candidate, Candidates, probe_mask
from overlay import difference, fit_veil, lift, paint, slots, template, to_rgba
from shots import icon, list_shots

HERE = Path(__file__).parent


def candidates(masters: Path, cards: tuple[Card, ...]) -> tuple[Candidates, dict[tuple[str, str | None], np.ndarray]]:
    """Every variant the masters hold of every offered card's art, placed in the icon."""
    names: list[Candidate] = []
    placed: dict[tuple[str, str | None], np.ndarray] = {}
    for asset, per_idol in dict.fromkeys((c.asset, c.per_idol) for c in cards):
        variants = master_variants(masters, asset, per_idol)
        if not variants:
            raise SystemExit(f"{masters}: no master of {asset}")
        for idol in variants:
            placed[(asset, idol)] = place(load_master(masters, asset, idol))
            names.append(Candidate(asset, idol))
    mask = probe_mask()
    return Candidates(names, np.stack([placed[(n.asset, n.idol)][mask] for n in names])), placed


def checker(size: int) -> np.ndarray:
    cells = np.indices((size, size)).sum(axis=0) // 8 % 2
    return np.where(cells[..., None] == 1, 205.0, 245.0).repeat(3, axis=-1)


def contact(rows: list[list[np.ndarray]], path: Path) -> None:
    """Tiles of icons, one card per row of tiles, written as a PNG."""
    size, gap, per_row = 146, 6, 4
    width = len(rows[0]) * size + gap
    lines = (len(rows) + per_row - 1) // per_row
    sheet = Image.new("RGB", (per_row * (width + 2 * gap), lines * (size + gap)), (255, 255, 255))
    for n, tiles in enumerate(rows):
        x0, y0 = (n % per_row) * (width + 2 * gap), (n // per_row) * (size + gap)
        for k, tile in enumerate(tiles):
            sheet.paste(Image.fromarray(np.clip(tile, 0, 255).astype(np.uint8)), (x0 + k * size, y0))
    sheet.save(path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--shots", type=Path, default=HERE / "../../temp/skill_cards")
    parser.add_argument("--masters", type=Path, default=HERE / "../../../gakumas-supportcards/scripts/images/out/master")
    parser.add_argument("--cards", type=Path, default=HERE / "out/offered.json")
    parser.add_argument("--out", type=Path, default=HERE / "out")
    args = parser.parse_args()

    offered = read_offered(args.cards)
    shots = list_shots(args.shots)
    print(f"{len(shots)} screenshots, {len(offered.cards)} offered cells", file=sys.stderr)
    pool, placed = candidates(args.masters, offered.cards)
    print(f"{len(pool.names)} candidate arts", file=sys.stderr)

    probe = probe_mask()
    icons = {shot.name: icon(shot) for shot in shots}
    identified = [Identified(shot, pool.best(icons[shot.name][probe])) for shot in shots]
    assigned, problems, missing = assign(identified, offered.cards)

    veiled = {}
    for cell, a in assigned.items():
        art = placed[(a.match.asset, a.match.idol)]
        veil = fit_veil(icons[a.shot.name], art)
        veiled[cell] = (veil, veil.apply(art))
    slot = slots([difference(icons[assigned[c].shot.name], v) for c, (_, v) in veiled.items()])
    same = {t: template([icons[a.shot.name] for a in assigned.values() if a.card.type == t], t) for t in ("active", "mental")}

    (args.out / "lifted").mkdir(parents=True, exist_ok=True)
    (args.out / "check").mkdir(parents=True, exist_ok=True)
    report = {}
    sheets: dict[str, list[list[np.ndarray]]] = {}
    for cell, a in sorted(assigned.items(), key=lambda kv: (kv[1].card.order, kv[1].card.upgrade)):
        shot = icons[a.shot.name]
        veil, art = veiled[cell]
        overlay = lift(shot, art, a.card.type, slot, same[a.card.type])
        Image.fromarray(to_rgba(overlay), "RGBA").save(args.out / "lifted" / f"{cell.replace(':', '_')}.png")
        again = paint(art, overlay)
        error = np.abs(again - shot)
        report[cell] = {
            "name": a.card.name,
            "shot": a.shot.name,
            "digest": a.shot.digest,
            "asset": a.match.asset,
            "idol": a.match.idol,
            "veil": [round(veil.gain, 4), round(veil.offset, 2)],
            "score": round(a.match.score, 2),
            "ratio": round(a.match.ratio, 2),
            "error": round(float(error.mean()), 2),
            "error99": round(float(np.percentile(error.max(axis=2), 99)), 1),
        }
        others = [i for i in offered.idols if (a.match.asset, i) in placed and i != a.match.idol][:2] if a.card.per_idol else []
        tiles = [shot, paint(art, overlay)] + [paint(veil.apply(placed[(a.match.asset, i)]), overlay) for i in others]
        while len(tiles) < 4:
            tiles.append(np.full_like(shot, 255.0))
        sheets.setdefault(f"{a.card.rarity}-{a.card.type}", []).append(tiles)
    for name, rows in sheets.items():
        contact(rows, args.out / "check" / f"{name}.png")
    Image.fromarray(slot.astype(np.uint8) * 255).save(args.out / "slots.png")
    (args.out / "lifted.json").write_text(json.dumps({"cells": report, "problems": problems, "missing": missing}, ensure_ascii=False, indent=1))

    errors = np.array([r["error"] for r in report.values()]) if report else np.zeros(1)
    ratios = np.array([r["ratio"] for r in report.values()]) if report else np.zeros(1)
    print(f"{len(report)} cells lifted; smallest margin {ratios.min():.2f}; painted back on the same art, mean error {errors.mean():.2f} (worst {errors.max():.2f})")
    for line in missing:
        print(f"missing: {line}")
    for line in problems:
        print(f"problem: {line}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
