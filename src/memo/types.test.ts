import { describe, expect, test } from "bun:test";
import { EXTRA_PATTERNS, emptyMemo, emptyRow, FIXED_PATTERNS, PLAN_IDS, planOf, SECTION_IDS, sectionsOf } from "./types.ts";

describe("sections", () => {
  test("each tab has its two styles and 共通, in display order", () => {
    expect(PLAN_IDS.map((plan) => sectionsOf(plan))).toEqual([
      ["sense.kocho", "sense.shuchu", "sense.common"],
      ["logic.yaruki", "logic.koinsho", "logic.common"],
      ["anomaly.tsuyoki", "anomaly.zenryoku", "anomaly.common"],
    ]);
  });

  test("every section names its own tab", () => {
    expect(SECTION_IDS.map((section) => `${section} ${planOf(section)}`)).toEqual(SECTION_IDS.map((section) => `${section} ${section.split(".")[0] ?? ""}`));
  });
});

describe("patterns", () => {
  test("the fixed and the extra patterns are the eight combinations of % and F, each once", () => {
    const all: string[] = [];
    for (const vo of "%F") for (const da of "%F") for (const vi of "%F") all.push(`${vo}${da}${vi}`);
    expect([...FIXED_PATTERNS, ...EXTRA_PATTERNS].map(String).toSorted()).toEqual(all.toSorted());
  });

  test("the extra picker offers %%% and FFF first (D3)", () => {
    expect(EXTRA_PATTERNS.slice(0, 2)).toEqual(["%%%", "FFF"]);
  });
});

describe("empty values", () => {
  test("an empty memo has every section, empty, and the H.I.F. scenario tag", () => {
    const memo = emptyMemo();
    expect(Object.keys(memo.sections)).toEqual([...SECTION_IDS]);
    expect(Object.values(memo.sections).every((rows) => rows.length === 0)).toBe(true);
    expect([memo.formatVersion, memo.scenario]).toEqual([1, "hif"]);
  });

  test("an empty row has the three fixed groups, empty, and no extras", () => {
    const row = emptyRow("r1", { card: "p_card-01-act-1_002", upgrade: 1, customization: [], kaimaku: true, hif: "h" });
    expect([Object.keys(row.fixed), Object.values(row.fixed).flat(), row.extras]).toEqual([[...FIXED_PATTERNS], [], []]);
  });
});
