import hashlib
import subprocess
from pathlib import Path

import pytest

from upload import UploadError, check, put, sheet_files, to_upload


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

    def failing(command, check):
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
