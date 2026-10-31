import hashlib
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from geometry import BOX, ICON
from shots import ShotError, icon, list_shots, parse_place


def test_the_folders_give_level_and_rarity():
    assert parse_place(Path("base/SR/a.png")) == (0, "SR")
    assert parse_place(Path("enhanced/N/b.PNG")) == (1, "N")


@pytest.mark.parametrize("bad", ["plus/SR/a.png", "base/UR/a.png", "base/a.png", "base/SR/x/a.png", "base/SR/a.jpg"])
def test_any_other_place_is_refused(bad):
    with pytest.raises(ShotError):
        parse_place(Path(bad))


def write_shot(path: Path, size=(720, 1280), colour=(10, 20, 30)) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGB", size, (255, 255, 255))
    image.paste(Image.new("RGB", (ICON, ICON), colour), BOX[:2])
    image.save(path)


def test_shots_are_listed_with_their_hash_and_finder_files_ignored(tmp_path):
    write_shot(tmp_path / "enhanced/R/b.png")
    write_shot(tmp_path / "base/SSR/a.png")
    (tmp_path / "base/.DS_Store").write_bytes(b"x")
    shots = list_shots(tmp_path)
    assert [(s.name, s.upgrade, s.rarity) for s in shots] == [("base/SSR/a.png", 0, "SSR"), ("enhanced/R/b.png", 1, "R")]
    assert shots[0].digest == hashlib.sha256((tmp_path / "base/SSR/a.png").read_bytes()).hexdigest()[:8]


def test_a_stray_file_stops_the_listing(tmp_path):
    write_shot(tmp_path / "base/SR/a.png")
    (tmp_path / "base/SR/notes.txt").write_text("x")
    with pytest.raises(ShotError):
        list_shots(tmp_path)


def test_the_icon_is_cut_from_its_box_and_another_size_refused(tmp_path):
    write_shot(tmp_path / "base/R/a.png")
    write_shot(tmp_path / "base/R/b.png", size=(1080, 1920))
    good, bad = list_shots(tmp_path)
    cut = icon(good)
    assert cut.shape == (ICON, ICON, 3) and np.all(cut == [10, 20, 30])
    with pytest.raises(ShotError):
        icon(bad)
