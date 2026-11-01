import { describe, expect, test } from "bun:test";
import { imageKey } from "../../infra/worker/img.ts";
import committed from "../icons/index.v1.json";
import { bundledIcons, FRAME_ORDER, FRAMES_URL, frameCell, iconCell, IconIndexError, NO_ICONS, parseIconIndex, spriteStyle } from "./sheets.ts";

/** センス with two idols' sheets, ロジック with one: the shape scripts/icons/build.py writes, cut short. */
const INDEX = {
  formatVersion: 1,
  cell: 112,
  columns: 2,
  plans: [
    {
      plan: "sense",
      cells: ["p_card-01-act-1_001:0", "p_card-01-act-1_001:1", "p_card-00-men-0_003:0"],
      sheets: [
        { idol: "hski", file: "gkms-memomemo/sheet112/sense-hski-60cb780d.webp" },
        { idol: "ttmr", file: "gkms-memomemo/sheet112/sense-ttmr-603d4bed.webp" },
      ],
    },
    { plan: "logic", cells: ["p_card-02-men-2_010:1"], sheets: [{ idol: "hski", file: "gkms-memomemo/sheet112/logic-hski-0a1b2c3d.webp" }] },
  ],
};
const ICONS = parseIconIndex(INDEX);
const PLUS = { id: "p_card-01-act-1_001", upgrade: 1 };

function withSheet(change: Record<string, unknown>): unknown {
  const [sense, logic] = INDEX.plans;
  return { ...INDEX, plans: [{ ...sense, sheets: [{ ...sense?.sheets[0], ...change }] }, logic] };
}

describe("parseIconIndex", () => {
  test("reads the shape the build writes", () => {
    expect(ICONS.columns).toBe(2);
    expect(ICONS.plans.map((p) => [p.plan, p.cells.length, p.sheets.length])).toEqual([["sense", 3, 2], ["logic", 1, 1]]);
  });

  test("refuses another format version, naming it", () => {
    expect(() => parseIconIndex({ ...INDEX, formatVersion: 2 })).toThrow(new IconIndexError("formatVersion: expected 1"));
    expect(() => parseIconIndex([])).toThrow(IconIndexError);
  });

  test("refuses a file the Worker would not serve, which would also reach a CSS url()", () => {
    for (const file of ['gkms-memomemo/sheet112/sense-hski-60cb780d.webp")', "sheet112/sense-hski-60cb780d.webp", "master/x.webp", "w112/img_a.webp"]) {
      expect(() => parseIconIndex(withSheet({ file }))).toThrow(new IconIndexError("plans[0].sheets[0].file: expected the sheet of sense and hski"));
    }
  });

  test("refuses a sheet whose file is named for another plan or idol", () => {
    for (const file of ["gkms-memomemo/sheet112/logic-hski-60cb780d.webp", "gkms-memomemo/sheet112/sense-ttmr-60cb780d.webp"]) {
      expect(() => parseIconIndex(withSheet({ file }))).toThrow("plans[0].sheets[0].file: expected the sheet of sense and hski");
    }
  });

  test("refuses a cell that is not a card and level, an unknown or repeated plan, and counts below one", () => {
    const [sense, logic] = INDEX.plans;
    expect(() => parseIconIndex({ ...INDEX, plans: [{ ...sense, cells: ["p_card-01-act-1_001:2"] }] })).toThrow("plans[0].cells[0]");
    expect(() => parseIconIndex({ ...INDEX, plans: [{ ...logic, plan: "free" }] })).toThrow("plans[0].plan");
    expect(() => parseIconIndex({ ...INDEX, plans: [sense, sense] })).toThrow("plans: expected each plan once");
    expect(() => parseIconIndex({ ...INDEX, columns: 0 })).toThrow("columns: expected a positive integer");
    expect(() => parseIconIndex({ ...INDEX, cell: 0 })).toThrow("cell: expected a positive integer");
  });
});

describe("the committed index", () => {
  test("parses, and every sheet it names is one the Worker serves", () => {
    const index = parseIconIndex(committed);
    for (const p of index.plans) for (const s of p.sheets) expect(imageKey(`/img/${s.file}`)).toBe(s.file);
  });

  test("a malformed index draws every card as its frame rather than breaking the page", () => {
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => errors.push(args);
    try {
      expect(bundledIcons({ formatVersion: 2 })).toEqual(NO_ICONS);
    } finally {
      console.error = original;
    }
    expect(errors.length).toBe(1);
  });
});

describe("iconCell", () => {
  test("finds a card at its level in the chosen idol's sheet of the tab's plan", () => {
    expect(iconCell(ICONS, "sense", PLUS, "ttmr", "hski")).toEqual({ url: "/img/gkms-memomemo/sheet112/sense-ttmr-603d4bed.webp", columns: 2, rows: 2, index: 1 });
    expect(iconCell(ICONS, "sense", { ...PLUS, upgrade: 0 }, "ttmr", "hski")?.index).toBe(0);
  });

  test("falls back to the default idol's sheet when the chosen idol has none (D20)", () => {
    expect(iconCell(ICONS, "logic", { id: "p_card-02-men-2_010", upgrade: 1 }, "ttmr", "hski")?.url).toBe("/img/gkms-memomemo/sheet112/logic-hski-0a1b2c3d.webp");
  });

  test("is null for a card or level the plan's cells lack, so the frame is drawn instead", () => {
    expect(iconCell(ICONS, "logic", PLUS, "hski", "hski")).toBeNull();
    expect(iconCell(ICONS, "sense", { id: "p_card-00-men-0_003", upgrade: 1 }, "hski", "hski")).toBeNull();
    expect(iconCell(ICONS, "anomaly", PLUS, "hski", "hski")).toBeNull();
    expect(iconCell(NO_ICONS, "sense", PLUS, "hski", "hski")).toBeNull();
  });
});

describe("frameCell", () => {
  test("finds the empty frame of each rarity and type in the one-row file", () => {
    expect(frameCell("N", "active")).toEqual({ url: FRAMES_URL, columns: 8, rows: 1, index: 0 });
    expect(frameCell("SR", "mental")?.index).toBe(5);
    expect(frameCell("SSR", "mental")?.index).toBe(7);
  });

  test("follows the order the pipeline writes the frames in (scripts/icons/frames.py)", async () => {
    const python = await Bun.file(new URL("../../scripts/icons/frames.py", import.meta.url)).text();
    const order = /^ORDER = \(([^)]*)\)/m.exec(python)?.[1] ?? "";
    expect([...order.matchAll(/"([^"]+)"/g)].map((m) => m[1])).toEqual([...FRAME_ORDER]);
  });

  test("has no frame for Legend, which the pool holds none of", () => {
    expect(frameCell("Legend", "active")).toBeNull();
  });
});

describe("spriteStyle", () => {
  test("scales the sheet to the size and moves it to the cell's column and row", () => {
    expect(spriteStyle({ url: "/img/s.webp", columns: 10, rows: 7, index: 23 }, "56px")).toEqual({
      width: "56px",
      height: "56px",
      backgroundImage: 'url("/img/s.webp")',
      backgroundSize: "calc(10 * 56px) calc(7 * 56px)",
      backgroundPosition: "calc(-3 * 56px) calc(-2 * 56px)",
    });
  });

  test("the first cell sits at the origin, and the size may be a variable", () => {
    expect(spriteStyle({ url: "/img/s.webp", columns: 10, rows: 7, index: 0 }, "var(--icon)").backgroundPosition).toBe("calc(0 * var(--icon)) calc(0 * var(--icon))");
  });
});
