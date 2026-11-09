import { describe, expect, test } from "bun:test";
import committed from "../icons/idols.v1.json";
import { bundledIdolIcons, fallbackGlyph, IDOL_SHEET_PREFIX, idolCell, IdolIconsError, NO_IDOL_ICONS, parseIdolIcons } from "./idols.ts";

/** The shape scripts/icons/idols.py writes, cut short. */
const INDEX = { formatVersion: 1, cell: 96, file: "idols96-0123abcd.webp", idols: ["hski", "ttmr", "shro"] };
const ICONS = parseIdolIcons(INDEX);

describe("parseIdolIcons", () => {
  test("reads the shape idols.py writes", () => {
    expect(ICONS).toEqual({ cell: 96, file: "idols96-0123abcd.webp", idols: ["hski", "ttmr", "shro"] });
  });

  test("refuses another format version, naming it", () => {
    expect(() => parseIdolIcons({ ...INDEX, formatVersion: 2 })).toThrow(new IdolIconsError("formatVersion: expected 1"));
    expect(() => parseIdolIcons([])).toThrow(IdolIconsError);
  });

  test("refuses a file name idols.py does not write, so nothing else reaches the CSS url()", () => {
    for (const file of ["idols96-0123abc.webp", "../idols96-0123abcd.webp", 'idols96-0123abcd.webp") , url("x', "frames112.webp"]) {
      expect(() => parseIdolIcons({ ...INDEX, file })).toThrow(IdolIconsError);
    }
  });

  test("refuses an idol named twice, and a cell that is not a positive integer", () => {
    expect(() => parseIdolIcons({ ...INDEX, idols: ["hski", "hski"] })).toThrow(IdolIconsError);
    expect(() => parseIdolIcons({ ...INDEX, cell: 0 })).toThrow(IdolIconsError);
  });

  test("the committed index is well formed, and its sheet is in public/icons/", async () => {
    const icons = parseIdolIcons(committed);
    expect(icons.idols.length).toBeGreaterThan(0);
    expect(await Bun.file(new URL(`../../public${IDOL_SHEET_PREFIX}${icons.file}`, import.meta.url)).exists()).toBe(true);
  });
});

describe("bundledIdolIcons", () => {
  test("a malformed index draws every idol without a face", () => {
    const error = console.error;
    console.error = () => {};
    try {
      expect(bundledIdolIcons({ formatVersion: 2 })).toBe(NO_IDOL_ICONS);
    } finally {
      console.error = error;
    }
  });
});

describe("idolCell", () => {
  test("finds an idol by id, in a one-row sheet of every idol", () => {
    expect(idolCell(ICONS, "shro")).toEqual({ url: "/icons/idols96-0123abcd.webp", columns: 3, rows: 1, index: 2 });
    expect(idolCell(ICONS, "hski")?.index).toBe(0);
  });

  test("an idol the sheet lacks has no cell", () => {
    expect(idolCell(ICONS, "hrnm")).toBeNull();
    expect(idolCell(NO_IDOL_ICONS, "hski")).toBeNull();
  });
});

describe("fallbackGlyph", () => {
  test("is the first character of the name", () => {
    expect(fallbackGlyph("篠澤広")).toBe("篠");
    expect(fallbackGlyph("𠮷田")).toBe("𠮷");
    expect(fallbackGlyph("")).toBe("?");
  });
});
