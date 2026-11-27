"""The masters directory's check (art.py, docs/plans/EXECPLAN_LIBRARY_DATA.md, Milestone 4)."""

from pathlib import Path

import pytest

from art import MASTERS, SYNC_MASTERS, require_masters


def test_a_directory_holding_masters_is_used(tmp_path: Path) -> None:
    (tmp_path / "img_general_skillcard_act-3_029.webp").write_bytes(b"x")
    assert require_masters(tmp_path) == tmp_path


@pytest.mark.parametrize("make", [False, True])
def test_a_missing_or_empty_directory_names_the_sync_command(tmp_path: Path, make: bool) -> None:
    masters = tmp_path / "masters"
    if make:
        masters.mkdir()
        (masters / "notes.txt").write_text("not a master")
    with pytest.raises(SystemExit) as exit_:
        require_masters(masters)
    assert SYNC_MASTERS in str(exit_.value)


def test_the_default_is_the_ignored_out_directory() -> None:
    assert MASTERS == Path(__file__).parent / "out" / "masters"
    assert "--only '^img_general_skillcard_'" in SYNC_MASTERS
