"""Draws the page's home-screen icons into public/icons/ (docs/plans/EXECPLAN_MEMORY_MEMO.md, D60).

A placeholder drawn from the page's own motif, no game image (D20b): one memory's three cells, each
under its stat's strip (Vo, Da, Vi), the first two in the diamond and rainbow qualities and the third
未所持, on the page's pink. Drawn at four times the size and scaled down, so the edges are smooth.

    uv run app_icon.py

writes app-192.png, app-512.png, app-maskable-512.png and apple-touch-icon.png (180 px), which the
manifest (public/manifest.webmanifest) and index.html name. A maskable icon keeps its drawing inside
the middle 80 % of the square, the safe zone a phone's mask never cuts.
"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[2] / "public" / "icons"
SCALE = 4
BACKGROUND = (219, 39, 119)  # Tailwind pink-600, the page's accent
CARD = (255, 255, 255)
STRIPS = [(240, 70, 140), (47, 143, 240), (245, 180, 0)]  # Vo, Da, Vi (src/app/labels.ts STATS)
DIAMOND = [(255, 214, 236), (230, 222, 255), (255, 255, 255), (206, 236, 255), (196, 245, 245)]
RAINBOW = [(255, 205, 225), (255, 246, 214), (240, 214, 255), (206, 228, 255), (210, 248, 228)]
MISSING_EDGE = (240, 161, 191)
MISSING_HATCH = (252, 228, 238)


def gradient(size: tuple[int, int], colors: list[tuple[int, int, int]]) -> Image.Image:
    """A horizontal band through `colors`, evenly spaced."""
    width, height = size
    band = Image.new("RGB", (width, 1))
    for x in range(width):
        at = x / max(width - 1, 1) * (len(colors) - 1)
        i = min(int(at), len(colors) - 2)
        t = at - i
        band.putpixel((x, 0), tuple(round(a + (b - a) * t) for a, b in zip(colors[i], colors[i + 1])))
    return band.resize((width, height))


def facets(size: tuple[int, int]) -> Image.Image:
    """The diamond quality: the prism band under a grid of light triangle facets."""
    image = gradient(size, DIAMOND)
    draw = ImageDraw.Draw(image, "RGBA")
    width, height = size
    step = width // 3
    for x in range(-step, width + step, step):
        draw.polygon([(x, 0), (x + step, 0), (x + step // 2, height // 2)], fill=(255, 255, 255, 70))
        draw.polygon([(x + step // 2, height // 2), (x + step, height), (x, height)], fill=(255, 255, 255, 40))
    return image


def cell(size: tuple[int, int], kind: str) -> Image.Image:
    """One cell's face: diamond, rainbow, or 未所持 (hatched)."""
    if kind == "diamond":
        return facets(size)
    if kind == "rainbow":
        return gradient(size, RAINBOW)
    image = Image.new("RGB", size, CARD)
    draw = ImageDraw.Draw(image)
    width, height = size
    gap = width // 5
    for x in range(-height, width, gap):
        draw.line([(x, height), (x + height, 0)], fill=MISSING_HATCH, width=max(width // 14, 1))
    return image


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return mask


def draw_icon(px: int, content: float) -> Image.Image:
    """The icon `px` square, its card `content` of the width, centred on the pink."""
    size = px * SCALE
    image = Image.new("RGB", (size, size), BACKGROUND)
    card_w = round(size * content)
    card_h = round(card_w * 0.62)
    left, top = (size - card_w) // 2, (size - card_h) // 2
    image.paste(CARD, (left, top, left + card_w, top + card_h), rounded_mask((card_w, card_h), card_w // 9))
    pad = card_w // 12
    cell_w = (card_w - pad * 4) // 3
    cell_h = card_h - pad * 2
    strip = max(cell_h // 7, 1)
    draw = ImageDraw.Draw(image)
    for i, kind in enumerate(["diamond", "rainbow", "missing"]):
        x = left + pad + i * (cell_w + pad)
        y = top + pad
        face = cell((cell_w, cell_h - strip), kind)
        mask = rounded_mask((cell_w, cell_h), cell_w // 8)
        tile = Image.new("RGB", (cell_w, cell_h), STRIPS[i])
        tile.paste(face, (0, strip))
        image.paste(tile, (x, y), mask)
        if kind == "missing":
            dash = cell_w // 8
            edge = max(cell_w // 22, 1)
            for d in range(0, cell_w, dash * 2):
                draw.line([(x + d, y + cell_h - edge // 2), (x + min(d + dash, cell_w), y + cell_h - edge // 2)], fill=MISSING_EDGE, width=edge)
            for d in range(strip, cell_h, dash * 2):
                for side in (x + edge // 2, x + cell_w - edge // 2):
                    draw.line([(side, y + d), (side, y + min(d + dash, cell_h))], fill=MISSING_EDGE, width=edge)
    return image.resize((px, px), Image.Resampling.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    draw_icon(192, 0.78).save(OUT / "app-192.png", optimize=True)
    draw_icon(512, 0.78).save(OUT / "app-512.png", optimize=True)
    draw_icon(512, 0.62).save(OUT / "app-maskable-512.png", optimize=True)
    draw_icon(180, 0.78).save(OUT / "apple-touch-icon.png", optimize=True)


if __name__ == "__main__":
    main()
