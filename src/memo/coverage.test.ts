import { describe, expect, test } from "bun:test";
import { hasGaps, rowCoverage } from "./coverage.ts";
import { emptyRow, type Memory, type Row } from "./types.ts";

const DDR: Memory = ["diamond", "diamond", "rainbow"];
const RRR: Memory = ["rainbow", "rainbow", "rainbow"];

function row(fixed: Partial<Row["fixed"]>, extras: Row["extras"] = []): Row {
  const base = emptyRow("r", { card: "p_card-01-act-3_029", upgrade: 1, customization: [], kaimaku: false, hif: "h" });
  return { ...base, fixed: { ...base.fixed, ...fixed }, extras };
}

describe("rowCoverage", () => {
  test("counts each fixed pattern's memories and lists the missing ones in display order", () => {
    expect(rowCoverage(row({ "%F%": [DDR, RRR] }))).toEqual({ fixed: { "%%F": 0, "%F%": 2, "F%%": 0 }, missing: ["%%F", "F%%"], extras: [] });
  });

  test("the Purpose's scenario: one %%F memory, %F% and F%% missing", () => {
    expect(rowCoverage(row({ "%%F": [DDR] })).missing).toEqual(["%F%", "F%%"]);
  });

  test("lists the extra groups' patterns in the row's order, which never count against the fixed ones", () => {
    const coverage = rowCoverage(row({}, [{ pattern: "FFF", memories: [RRR] }, { pattern: "%%%", memories: [DDR, DDR] }]));
    expect([coverage.extras, coverage.missing]).toEqual([["FFF", "%%%"], ["%%F", "%F%", "F%%"]]);
  });

  test("an emptied extra group owns nothing, so it gets no grey tag (D27)", () => {
    expect(rowCoverage(row({}, [{ pattern: "FFF", memories: [] }, { pattern: "%%%", memories: [DDR] }])).extras).toEqual(["%%%"]);
  });
});

describe("hasGaps", () => {
  test("a row with no memory, or with any fixed pattern missing, has gaps; a row with all three has none", () => {
    expect(hasGaps(row({}))).toBe(true);
    expect(hasGaps(row({ "%%F": [DDR], "%F%": [DDR] }, [{ pattern: "F%F", memories: [DDR] }]))).toBe(true);
    expect(hasGaps(row({ "%%F": [DDR], "%F%": [RRR], "F%%": [DDR, DDR] }))).toBe(false);
  });
});
