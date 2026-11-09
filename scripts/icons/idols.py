"""The idols' face sheet for 「カードの絵柄」 (docs/plans/EXECPLAN_IDOL_ICON_TABLE.md, T2, T5 and T7).

    uv run idols.py [--masters <dir>] [--cards out/offered.json]    # build into out/
    uv run idols.py --publish                                       # build, then copy into the page

Each playable idol's SD face, the small cartoon face the game uses in its menus
(`img_sd_<idol id>_face-00`, extracted by gakumas-supportcards' `extract.py --only 'img_sd_'` into
its local masters), is scaled into a CELL px square with its transparency, and the faces are laid
in one row in the data file's idol order (`idols` in the JSON offered.ts prints, I8). The sheet is
lossy WebP named by its hash, `idols96-<8 hex>.webp`, and `idols.v1.json` names it and the idol of
each cell. With --publish the sheet goes to public/icons/ (an older idols96-*.webp there is
removed) and the index to src/icons/idols.v1.json, sheet first, so the index never names a sheet
that is not there. The command exits 1 naming each idol whose face is missing.
"""

import argparse
import hashlib
import io
import json
import re
import shutil
import sys
from pathlib import Path

from PIL import Image

CELL = 96
"""Twice the 48 CSS px the page draws a face at (T2)."""
QUALITY = 90
NAME = re.compile(r"idols96-[0-9a-f]{8}\.webp")
HERE = Path(__file__).parent
ROOT = HERE.parent.parent


def face_file(idol: str) -> str:
    """The master of an idol's SD face, in its default smile (T5)."""
    return f"img_sd_{idol}_face-00.webp"


def missing_faces(idols: list[str], present: set[str]) -> list[str]:
    """The idols, in order, whose face master is not among the `present` file names."""
    return [idol for idol in idols if face_file(idol) not in present]


def face_cell(face: Image.Image) -> Image.Image:
    """A face as a CELL px RGBA cell, scaled once with its transparency kept."""
    return face.convert("RGBA").resize((CELL, CELL), Image.Resampling.LANCZOS)


def face_row(cells: list[Image.Image]) -> Image.Image:
    """The cells side by side, in the order given, on a transparent sheet."""
    sheet = Image.new("RGBA", (CELL * len(cells), CELL), (0, 0, 0, 0))
    for i, cell in enumerate(cells):
        sheet.paste(cell, (i * CELL, 0))
    return sheet


def encode(sheet: Image.Image, quality: int = QUALITY) -> bytes:
    """Lossy WebP with its alpha kept lossless."""
    out = io.BytesIO()
    sheet.save(out, "WEBP", quality=quality, method=6, alpha_quality=100, exact=False)
    return out.getvalue()


def sheet_name(data: bytes) -> str:
    """`idols96-<first 8 hex digits of the bytes' SHA-256>.webp`, a name that never changes meaning."""
    return f"idols96-{hashlib.sha256(data).hexdigest()[:8]}.webp"


def index(file: str, idols: list[str]) -> dict:
    """The committed index: the sheet's name, the cell size and the idol of each cell, in order."""
    return {"formatVersion": 1, "cell": CELL, "file": file, "idols": list(idols)}


def stale_sheets(names: list[str], keep: str) -> list[str]:
    """Of the file names in public/icons/, the face sheets other than `keep`, to remove on publishing."""
    return sorted(n for n in names if NAME.fullmatch(n) and n != keep)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--masters", type=Path, default=HERE / "../../../gakumas-supportcards/scripts/images/out/master")
    parser.add_argument("--cards", type=Path, default=HERE / "out/offered.json")
    parser.add_argument("--out", type=Path, default=HERE / "out")
    parser.add_argument("--publish", action="store_true", help="copy the sheet into public/icons/ and the index into src/icons/")
    args = parser.parse_args()

    idols: list[str] = json.loads(args.cards.read_text(encoding="utf-8"))["idols"]
    present = {p.name for p in args.masters.glob("img_sd_*.webp")} if args.masters.is_dir() else set()
    missing = missing_faces(idols, present)
    if missing:
        for idol in missing:
            print(f"missing: {args.masters / face_file(idol)}", file=sys.stderr)
        print("extract them in gakumas-supportcards: cd scripts/images && uv run extract.py --only 'img_sd_'", file=sys.stderr)
        return 1

    data = encode(face_row([face_cell(Image.open(args.masters / face_file(idol))) for idol in idols]))
    name = sheet_name(data)
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / name).write_bytes(data)
    index_text = json.dumps(index(name, idols), ensure_ascii=False, indent=2) + "\n"
    (args.out / "idols.v1.json").write_text(index_text, encoding="utf-8")
    print(f"{len(idols)} faces, {name}, {len(data) // 1000} KB")

    if args.publish:
        public = ROOT / "public" / "icons"
        shutil.copyfile(args.out / name, public / name)
        (ROOT / "src" / "icons" / "idols.v1.json").write_text(index_text, encoding="utf-8")
        for old in stale_sheets([p.name for p in public.iterdir()], name):
            (public / old).unlink()
            print(f"removed public/icons/{old}")
        print(f"published public/icons/{name} and src/icons/idols.v1.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
