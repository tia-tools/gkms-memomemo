import { describe, expect, test } from "bun:test";
import { iconCell, loadSheetIndex, parseSheetIndex, SHEET_INDEX_ROUTE, SheetIndexError, spriteStyle } from "./sheets.ts";

/** Two sheets of センス, a third of ロジック: the shape gakumas-supportcards publishes, cut short. */
const INDEX = {
  formatVersion: 1,
  cell: 112,
  sheets: [
    { plan: "sense", idol: "hski", file: "sheet112/sense-hski-60cb780d.webp", columns: 2, assets: ["img_a", "img_b-hski", "img_c"] },
    { plan: "sense", idol: "ttmr", file: "sheet112/sense-ttmr-603d4bed.webp", columns: 2, assets: ["img_a", "img_c"] },
    { plan: "logic", idol: "hski", file: "sheet112/logic-hski-0a1b2c3d.webp", columns: 2, assets: ["img_d-hski"] },
  ],
};
const SHEETS = parseSheetIndex(INDEX);
const PER_IDOL = { asset: "img_b", perIdol: true };
const SINGLE = { asset: "img_c", perIdol: false };

function withSheet(change: Record<string, unknown>): unknown {
  return { ...INDEX, sheets: [{ ...INDEX.sheets[0], ...change }] };
}

describe("parseSheetIndex", () => {
  test("reads the published shape", () => {
    expect(SHEETS.cell).toBe(112);
    expect(SHEETS.sheets.map((s) => [s.plan, s.idol])).toEqual([["sense", "hski"], ["sense", "ttmr"], ["logic", "hski"]]);
  });

  test("refuses another format version, naming it", () => {
    expect(() => parseSheetIndex({ ...INDEX, formatVersion: 2 })).toThrow(new SheetIndexError("formatVersion: expected 1"));
    expect(() => parseSheetIndex([])).toThrow(SheetIndexError);
  });

  test("refuses a file that is not a sheet's name, which would reach a CSS url()", () => {
    for (const file of ['sheet112/sense-hski-60cb780d.webp")', "sheet112/index.v1.json", "master/x.webp", "w112/img_a.webp"]) {
      expect(() => parseSheetIndex(withSheet({ file }))).toThrow(new SheetIndexError("sheets[0].file: expected a sprite sheet's name"));
    }
  });

  test("refuses an unknown plan and a column count below one", () => {
    expect(() => parseSheetIndex(withSheet({ plan: "free" }))).toThrow("sheets[0].plan");
    expect(() => parseSheetIndex(withSheet({ columns: 0 }))).toThrow("sheets[0].columns: expected a positive integer");
    expect(() => parseSheetIndex({ ...INDEX, cell: 0 })).toThrow("cell: expected a positive integer");
  });
});

describe("loadSheetIndex", () => {
  test("asks this origin's route", async () => {
    const asked: string[] = [];
    const index = await loadSheetIndex((url) => {
      asked.push(url);
      return Promise.resolve(Response.json(INDEX));
    });
    expect(asked).toEqual([SHEET_INDEX_ROUTE]);
    expect(index.sheets.length).toBe(3);
  });

  /** What `loadSheetIndex(get)` rejects with; a resolved load fails the test. */
  async function refusal(response: Response): Promise<string> {
    const outcome: unknown = await loadSheetIndex(() => Promise.resolve(response)).then(
      () => new Error("the load resolved"),
      (error: unknown) => error,
    );
    if (!(outcome instanceof SheetIndexError)) throw outcome;
    return outcome.message;
  }

  test("rejects an error status and a body that is not JSON", async () => {
    expect(await refusal(new Response("", { status: 404 }))).toBe(`${SHEET_INDEX_ROUTE}: HTTP 404`);
    expect(await refusal(new Response("<html>"))).toBe(`${SHEET_INDEX_ROUTE}: not JSON`);
  });
});

describe("iconCell", () => {
  test("finds a per-idol icon in the chosen idol's sheet of the tab's plan", () => {
    expect(iconCell(SHEETS, "sense", PER_IDOL, "hski", "hski")).toEqual({ url: "/img/sheet112/sense-hski-60cb780d.webp", columns: 2, rows: 2, index: 1 });
  });

  test("finds a single image under its own name in any idol's sheet", () => {
    expect(iconCell(SHEETS, "sense", SINGLE, "ttmr", "hski")?.url).toBe("/img/sheet112/sense-ttmr-603d4bed.webp");
    expect(iconCell(SHEETS, "sense", SINGLE, "ttmr", "hski")?.index).toBe(1);
  });

  test("falls back to the default idol's art when the chosen idol's sheet lacks it (D20)", () => {
    expect(iconCell(SHEETS, "sense", PER_IDOL, "ttmr", "hski")?.url).toBe("/img/sheet112/sense-hski-60cb780d.webp");
    expect(iconCell(SHEETS, "sense", SINGLE, "fktn", "hski")?.url).toBe("/img/sheet112/sense-hski-60cb780d.webp");
  });

  test("is null when no sheet of the plan holds it, so the name is drawn instead", () => {
    expect(iconCell(SHEETS, "logic", PER_IDOL, "hski", "hski")).toBeNull();
    expect(iconCell(SHEETS, "anomaly", SINGLE, "hski", "hski")).toBeNull();
    expect(iconCell(parseSheetIndex({ ...INDEX, sheets: [] }), "sense", SINGLE, "hski", "hski")).toBeNull();
  });
});

describe("spriteStyle", () => {
  test("scales the sheet to the size and moves it to the cell's column and row", () => {
    expect(spriteStyle({ url: "/img/s.webp", columns: 10, rows: 7, index: 23 }, 56)).toEqual({
      width: "56px",
      height: "56px",
      backgroundImage: 'url("/img/s.webp")',
      backgroundSize: "560px 392px",
      backgroundPosition: "-168px -112px",
    });
  });

  test("the first cell sits at the origin", () => {
    expect(spriteStyle({ url: "/img/s.webp", columns: 10, rows: 7, index: 0 }, 24).backgroundPosition).toBe("0px 0px");
  });
});
