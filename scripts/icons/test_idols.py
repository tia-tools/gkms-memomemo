import hashlib
import io

from PIL import Image

from idols import CELL, encode, face_cell, face_file, face_row, index, missing_faces, sheet_name, stale_sheets


def face(color: tuple[int, int, int]) -> Image.Image:
    """A synthetic 256 px face: a coloured square on a transparent background."""
    im = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    im.paste((*color, 255), (64, 64, 192, 192))
    return im


def test_an_idols_face_is_her_default_smile():
    assert face_file("hski") == "img_sd_hski_face-00.webp"


def test_missing_faces_are_named_in_the_idols_order():
    present = {"img_sd_hski_face-00.webp", "img_sd_fktn_face-00.webp", "img_sd_ttmr_face-01.webp"}
    assert missing_faces(["shro", "hski", "ttmr", "fktn"], present) == ["shro", "ttmr"]
    assert missing_faces(["hski"], present) == []


def test_a_cell_is_the_face_scaled_once_with_its_transparency():
    cell = face_cell(face((200, 40, 40)))
    assert cell.size == (CELL, CELL) and cell.mode == "RGBA"
    assert cell.getpixel((0, 0))[3] == 0 and cell.getpixel((CELL // 2, CELL // 2)) == (200, 40, 40, 255)


def test_the_row_keeps_the_cells_in_the_order_given():
    colors = [(200, 0, 0), (0, 200, 0), (0, 0, 200)]
    row = face_row([face_cell(face(c)) for c in colors])
    assert row.size == (CELL * 3, CELL)
    assert [row.getpixel((i * CELL + CELL // 2, CELL // 2))[:3] for i in range(3)] == colors
    assert row.getpixel((CELL, 0))[3] == 0


def test_the_encoded_sheet_is_webp_named_by_its_hash():
    data = encode(face_row([face_cell(face((10, 20, 30)))]))
    assert Image.open(io.BytesIO(data)).format == "WEBP"
    assert sheet_name(data) == f"idols96-{hashlib.sha256(data).hexdigest()[:8]}.webp"
    assert sheet_name(data) != sheet_name(data + b"x")


def test_the_index_names_the_sheet_the_cell_and_each_cells_idol():
    assert index("idols96-0123abcd.webp", ["hski", "ttmr"]) == {"formatVersion": 1, "cell": CELL, "file": "idols96-0123abcd.webp", "idols": ["hski", "ttmr"]}


def test_publishing_removes_only_the_other_face_sheets():
    names = ["frames112.webp", "idols96-00000000.webp", "idols96-11111111.webp", "app-192.png", "idols96-bad.webp"]
    assert stale_sheets(names, "idols96-11111111.webp") == ["idols96-00000000.webp"]
