"""Milestone 2 of docs/plans/EXECPLAN_GAME_STYLE_ICONS.md: the sprite sheets, their index and the placeholder frames.

    uv run build.py --masters <dir> [--cards out/offered.json] [--frames ../../temp/image.png]

Reads what lift.py wrote (out/lifted.json and out/lifted/*.png) and paints each cell's overlay on
every playable idol's art under the card's veil. Writes, under out/:
gkms-memomemo/sheet112/<plan>-<idol>-<8 hex>.webp (one per plan and idol, keyed as in the bucket),
index.v1.json (the index the page bundles), cells.json (each cell's screenshot hash, for
stamp.ts) and frames112.webp (the eight placeholder frames, for public/icons/).
"""

import argparse
import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from art import Card, load_master, master_variants, place, read_offered
from frames import frames_row
from overlay import Veil, from_rgba
from sheets import PLANS, grid, index, paint_cell, plan_cells, sheet_key

HERE = Path(__file__).parent
QUALITY = 75
"""Lossy WebP quality of the sheets; the alpha of the corners is kept lossless."""


def webp(rgba: np.ndarray, quality: int) -> bytes:
    out = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(out, "WEBP", quality=quality, method=6, alpha_quality=100, exact=False)
    return out.getvalue()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--masters", type=Path, default=HERE / "../../../gakumas-supportcards/scripts/images/out/master")
    parser.add_argument("--cards", type=Path, default=HERE / "out/offered.json")
    parser.add_argument("--frames", type=Path, default=HERE / "../../temp/image.png")
    parser.add_argument("--out", type=Path, default=HERE / "out")
    parser.add_argument("--quality", type=int, default=QUALITY)
    args = parser.parse_args()

    offered = read_offered(args.cards)
    lifted = json.loads((args.out / "lifted.json").read_text())
    if lifted["problems"]:
        print("lift.py reported problems; fix them and run it again before building", file=sys.stderr)
        return 1
    built = {cell: info for cell, info in lifted["cells"].items()}
    cards = [c for c in offered.cards if c.cell in built]
    default = offered.idols[0]

    placed: dict[tuple[str, str | None], np.ndarray] = {}
    painted: dict[tuple[str, str | None], np.ndarray] = {}
    fallbacks: set[str] = set()

    def cell_for(card: Card, idol: str) -> np.ndarray:
        variants = master_variants(args.masters, card.asset, card.per_idol)
        if card.per_idol:
            use = idol if idol in variants else default
            if use not in variants:
                raise SystemExit(f"{args.masters}: no master of {card.asset} for {idol} or {default}")
            if use != idol:
                fallbacks.add(f"{card.asset}-{idol}")
        else:
            if not variants:
                raise SystemExit(f"{args.masters}: no master of {card.asset}")
            use = None
        key = (card.cell, use)
        if key not in painted:
            if (card.asset, use) not in placed:
                placed[(card.asset, use)] = place(load_master(args.masters, card.asset, use))
            info = built[card.cell]
            overlay = from_rgba(np.asarray(Image.open(args.out / "lifted" / f"{card.cell.replace(':', '_')}.png").convert("RGBA")))
            painted[key] = paint_cell(placed[(card.asset, use)], Veil(*info["veil"]), overlay)
        return painted[key]

    sheet_dir = args.out / "gkms-memomemo" / "sheet112"
    sheet_dir.mkdir(parents=True, exist_ok=True)
    plans: dict[str, tuple[list[str], dict[str, str]]] = {}
    sizes = []
    for plan in PLANS:
        cells = plan_cells(cards, plan)
        keys: dict[str, str] = {}
        for idol in offered.idols:
            data = webp(grid([cell_for(card, idol) for card in cells]), args.quality)
            key = sheet_key(plan, idol, data)
            (args.out / key).write_bytes(data)
            keys[idol] = key
            sizes.append(len(data))
        plans[plan] = ([c.cell for c in cells], keys)
        print(f"{plan}: {len(cells)} cells, {len(keys)} sheets", file=sys.stderr)

    (args.out / "index.v1.json").write_text(json.dumps(index(plans), ensure_ascii=False, indent=1) + "\n")
    (args.out / "cells.json").write_text(json.dumps({cell: info["digest"] for cell, info in sorted(built.items())}, indent=1) + "\n")
    with Image.open(args.frames) as image:
        (args.out / "frames112.webp").write_bytes(webp(frames_row(image), 95))

    total = sum(sizes)
    print(f"{len(sizes)} sheets, {total / 1e6:.1f} MB, {min(sizes) // 1000}–{max(sizes) // 1000} KB each (quality {args.quality})")
    for name in sorted(fallbacks):
        print(f"fallback: {name} drawn in {default}'s art")
    return 0


if __name__ == "__main__":
    sys.exit(main())
