import hashlib
import subprocess
from pathlib import Path

import pytest

import json

from upload import UploadError, check, missing, publish, put, sheet_files, stored, to_upload


def key_for(data: bytes, plan="sense", idol="hski") -> str:
    return f"gkms-memomemo/sheet112/{plan}-{idol}-{hashlib.sha256(data).hexdigest()[:8]}.webp"


def index(*keys: str) -> dict:
    return {"plans": [{"plan": "sense", "cells": [], "sheets": [{"idol": "hski", "file": k} for k in keys]}]}


def test_only_sheets_the_committed_index_lacks_are_uploaded():
    assert to_upload(index("a", "b", "c"), index("b"), False) == ["a", "c"]
    assert to_upload(index("a", "b"), None, False) == ["a", "b"]
    assert to_upload(index("a", "b"), index("a", "b"), True) == ["a", "b"]
    assert sheet_files({"plans": []}) == []


def test_a_key_outside_this_apps_prefix_is_refused():
    data = b"sheet"
    check(key_for(data), data)
    for key in [f"sheet112/sense-hski-{key_for(data)[-13:]}", "master/x.webp", key_for(data).replace("gkms-memomemo/", "gkms-memomemo/../"), key_for(data, plan="free")]:
        with pytest.raises(UploadError, match="not a key"):
            check(key, data)


def test_bytes_that_do_not_match_the_name_are_refused():
    with pytest.raises(UploadError, match="do not match"):
        check(key_for(b"one"), b"two")


def test_a_failed_put_is_tried_again_and_the_last_failure_raised(tmp_path: Path):
    data = b"sheet"
    path = tmp_path / "s.webp"
    path.write_bytes(data)
    calls: list[list[str]] = []
    waits: list[float] = []

    def failing(command, check, capture_output):
        calls.append(command)
        raise subprocess.CalledProcessError(1, command)

    with pytest.raises(subprocess.CalledProcessError):
        put(key_for(data), path, run=failing, sleep=waits.append, waits=(1.0, 2.0))
    assert len(calls) == 3 and waits == [1.0, 2.0]
    assert calls[0][:6] == ["bunx", "wrangler", "r2", "object", "put", f"tia-assets/{key_for(data)}"]
    assert "--remote" in calls[0] and "public, max-age=31536000, immutable" in calls[0]


def test_a_put_refuses_before_running_anything_when_the_key_is_wrong(tmp_path: Path):
    path = tmp_path / "s.webp"
    path.write_bytes(b"sheet")
    ran: list[object] = []
    with pytest.raises(UploadError):
        put("master/x.webp", path, run=lambda *a, **k: ran.append(a))
    assert ran == []


def test_every_sheet_the_index_names_is_read_back_and_a_missing_or_wrong_one_named():
    good, other = b"good", b"other"
    store = {key_for(good): good, key_for(other, idol="ttmr"): b"corrupted"}

    def fetch(key: str) -> bytes:
        if key not in store:
            raise subprocess.CalledProcessError(1, ["get", key])
        return store[key]

    gone = key_for(b"gone", idol="fktn")
    problems = missing([key_for(good), key_for(other, idol="ttmr"), gone], fetch)
    assert problems == [f"{key_for(other, idol='ttmr')}: {key_for(other, idol='ttmr')}: the file's bytes do not match the hash in its name", f"{gone}: not in the bucket, or not readable"]
    assert missing([key_for(good)], fetch) == []


def test_reading_back_asks_wrangler_for_the_stored_bytes():
    seen: list[list[str]] = []

    class Done:
        stdout = b"bytes"

    def run(command, check, capture_output):
        seen.append(command)
        return Done()

    assert stored("gkms-memomemo/sheet112/sense-hski-00000000.webp", run=run) == b"bytes"
    assert seen == [["bunx", "wrangler", "r2", "object", "get", "tia-assets/gkms-memomemo/sheet112/sense-hski-00000000.webp", "--pipe", "--remote"]]


def build_out(tmp_path: Path, sheets: dict[str, bytes]) -> tuple[Path, Path]:
    out, root = tmp_path / "out", tmp_path / "root"
    for key, data in sheets.items():
        (out / key).parent.mkdir(parents=True, exist_ok=True)
        (out / key).write_bytes(data)
    (out / "index.v1.json").write_text(json.dumps(index(*sheets)))
    (out / "frames112.webp").write_bytes(b"frames")
    (root / "src/icons").mkdir(parents=True)
    (root / "public/icons").mkdir(parents=True)
    return out, root


def test_publishing_uploads_what_is_new_reads_everything_back_and_only_then_copies_the_index(tmp_path: Path):
    old, new = b"old sheet", b"new sheet"
    out, root = build_out(tmp_path, {key_for(old): old, key_for(new, idol="ttmr"): new})
    bucket = {key_for(old): old}
    events: list[str] = []

    def send(key: str, path: Path) -> None:
        events.append(f"put {key}")
        bucket[key] = path.read_bytes()

    def fetch(key: str) -> bytes:
        events.append(f"get {key}")
        if key not in bucket:
            raise subprocess.CalledProcessError(1, ["get", key])
        return bucket[key]

    assert publish(out, root, index(key_for(old)), False, send, fetch) == [key_for(new, idol="ttmr")]
    assert events == [f"put {key_for(new, idol='ttmr')}", f"get {key_for(old)}", f"get {key_for(new, idol='ttmr')}"]
    assert json.loads((root / "src/icons/index.v1.json").read_text()) == index(key_for(old), key_for(new, idol="ttmr"))
    assert (root / "public/icons/frames112.webp").read_bytes() == b"frames"


def test_a_sheet_the_committed_index_names_but_the_bucket_lost_stops_the_copy(tmp_path: Path):
    old = b"old sheet"
    out, root = build_out(tmp_path, {key_for(old): old})

    def fetch(key: str) -> bytes:
        raise subprocess.CalledProcessError(1, ["get", key])

    with pytest.raises(UploadError, match="not in the bucket"):
        publish(out, root, index(key_for(old)), False, lambda key, path: None, fetch)
    assert not (root / "src/icons/index.v1.json").exists()
