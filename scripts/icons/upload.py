"""Milestone 4 of docs/plans/EXECPLAN_GAME_STYLE_ICONS.md: the sheets into tia-assets, then the index into the page.

    uv run upload.py --dry-run        # which sheets would be uploaded; changes nothing
    uv run upload.py                  # upload them, then copy the index and the frames into the repository
    uv run upload.py --all            # every sheet the new index names, whatever the committed index says

A sheet is uploaded when out/index.v1.json names it and the index committed at HEAD
(src/icons/index.v1.json) does not: a sheet's name is its hash, so a name the committed index
already holds was stored with these bytes. Then every sheet the new index names, uploaded now or
before, is read back from the bucket and its bytes checked against its name; only when all of them
are there is out/index.v1.json copied to src/icons/index.v1.json (and out/frames112.webp to
public/icons/), so the index never names a sheet the bucket lacks, even one deleted since it was
first uploaded. Uploading uses `bunx wrangler r2 object put` with the Wrangler
login of the person running it; no key outside this app's prefix is ever written (I3).
"""

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import time
from collections.abc import Callable, Sequence
from pathlib import Path

BUCKET = "tia-assets"
KEY = re.compile(r"gkms-memomemo/sheet112/(?:sense|logic|anomaly)-[a-z0-9]{4}-([0-9a-f]{8})\.webp")
"""The only keys this script writes: this app's prefix, a plan, an idol, the bytes' hash."""
IMMUTABLE = "public, max-age=31536000, immutable"
RETRY_WAITS: tuple[float, ...] = (5.0, 20.0)
"""Seconds before the second and third attempt of a put; the R2 API sometimes fails one put transiently."""
HERE = Path(__file__).parent
ROOT = HERE.parent.parent


class UploadError(Exception):
    pass


def sheet_files(index: dict) -> list[str]:
    """Every sheet key an index names, in its order."""
    return [sheet["file"] for plan in index.get("plans", []) for sheet in plan["sheets"]]


def to_upload(new: dict, committed: dict | None, everything: bool) -> list[str]:
    """The keys to upload: those the new index names and the committed one does not (all, with `everything`)."""
    stored = set() if everything or committed is None else set(sheet_files(committed))
    return [key for key in sheet_files(new) if key not in stored]


def check(key: str, data: bytes) -> None:
    """Refuses a key outside this app's prefix, and bytes whose hash is not the one the name carries."""
    match = KEY.fullmatch(key)
    if match is None:
        raise UploadError(f"{key}: not a key this app may write")
    if hashlib.sha256(data).hexdigest()[:8] != match.group(1):
        raise UploadError(f"{key}: the file's bytes do not match the hash in its name")


def _retried(command: list[str], what: str, run: Callable[..., object], sleep: Callable[[float], None], waits: Sequence[float]) -> object:
    """Runs `command`, again after each of `waits` when it fails, and raises the last failure."""
    for wait in waits:
        try:
            return run(command, check=True, capture_output=True)
        except subprocess.CalledProcessError as e:
            print(f"{what} failed (exit {e.returncode}); trying again in {wait:g} s", file=sys.stderr)
            sleep(wait)
    return run(command, check=True, capture_output=True)


def put(
    key: str,
    path: Path,
    run: Callable[..., object] = subprocess.run,
    sleep: Callable[[float], None] = time.sleep,
    waits: Sequence[float] = RETRY_WAITS,
) -> None:
    """`wrangler r2 object put` of one checked sheet, tried again after each of `waits`, then the last failure raised."""
    check(key, path.read_bytes())
    command = ["bunx", "wrangler", "r2", "object", "put", f"{BUCKET}/{key}", "--file", str(path), "--content-type", "image/webp", "--cache-control", IMMUTABLE, "--remote"]
    _retried(command, f"put {key}", run, sleep, waits)


def stored(
    key: str,
    run: Callable[..., object] = subprocess.run,
    sleep: Callable[[float], None] = time.sleep,
    waits: Sequence[float] = RETRY_WAITS,
) -> bytes:
    """The bytes the bucket holds under `key`, by `wrangler r2 object get --pipe`; a missing key fails like any error."""
    command = ["bunx", "wrangler", "r2", "object", "get", f"{BUCKET}/{key}", "--pipe", "--remote"]
    done = _retried(command, f"get {key}", run, sleep, waits)
    return getattr(done, "stdout", b"")


def missing(keys: list[str], fetch: Callable[[str], bytes]) -> list[str]:
    """Each key whose stored bytes cannot be had or do not match its name, with the reason."""
    problems = []
    for key in keys:
        try:
            check(key, fetch(key))
        except (UploadError, subprocess.CalledProcessError) as e:
            problems.append(f"{key}: {e if isinstance(e, UploadError) else 'not in the bucket, or not readable'}")
    return problems


def committed_index() -> dict | None:
    """The index at HEAD, or None where there is none yet."""
    shown = subprocess.run(["git", "show", "HEAD:src/icons/index.v1.json"], cwd=ROOT, capture_output=True, text=True)
    return json.loads(shown.stdout) if shown.returncode == 0 else None


def publish(
    out: Path,
    root: Path,
    committed: dict | None,
    everything: bool,
    send: Callable[[str, Path], None] = put,
    fetch: Callable[[str], bytes] = stored,
) -> list[str]:
    """Uploads the sheets the committed index lacks, reads back every sheet the new index names, and only
    then copies the frames and, last, the index into `root`. Returns the keys uploaded; raises UploadError,
    having copied nothing, when a file is wrong or the bucket lacks a named sheet."""
    new = json.loads((out / "index.v1.json").read_text())
    keys = to_upload(new, committed, everything)
    for key in keys:
        check(key, (out / key).read_bytes())
    for n, key in enumerate(keys, 1):
        send(key, out / key)
        print(f"{n}/{len(keys)} {key}", file=sys.stderr)
    named = sheet_files(new)
    print(f"reading back the {len(named)} sheets the index names", file=sys.stderr)
    problems = missing(named, fetch)
    if problems:
        raise UploadError("the index was not copied, since the bucket lacks what it names:\n" + "\n".join(problems))
    # The frames first and the index last: whatever stops this halfway, the index changes only once
    # everything else has, and then names only sheets just read back.
    shutil.copyfile(out / "frames112.webp", root / "public/icons/frames112.webp")
    shutil.copyfile(out / "index.v1.json", root / "src/icons/index.v1.json")
    return keys


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--out", type=Path, default=HERE / "out")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--all", action="store_true")
    args = parser.parse_args()

    if args.dry_run:
        new = json.loads((args.out / "index.v1.json").read_text())
        keys = to_upload(new, committed_index(), args.all)
        for key in keys:
            check(key, (args.out / key).read_bytes())
        print(f"{len(keys)} of {len(sheet_files(new))} sheets to upload", file=sys.stderr)
        for key in keys:
            print(key)
        return 0
    keys = publish(args.out, ROOT, committed_index(), args.all)
    print(f"{len(keys)} sheets uploaded; index and frames copied into the repository; commit them with scripts/icons/stamps.json")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except UploadError as e:
        print(e, file=sys.stderr)
        sys.exit(1)
