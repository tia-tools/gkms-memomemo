import { describe, expect, test } from "bun:test";
import { cellValues, kindsOf } from "./values.ts";

describe("cellValues", () => {
  test("the Purpose's memory: %%F with Vo diamond, Da diamond, Vi rainbow shows 3.5 / 3.5 / 20", () => {
    expect(cellValues("%%F", ["diamond", "diamond", "rainbow"])).toEqual(["3.5", "3.5", "20"]);
  });

  test("each kind's two tiers: % is 3.5 or 2.8, F is 25 or 20", () => {
    expect(cellValues("%%%", ["diamond", "rainbow", "diamond"])).toEqual(["3.5", "2.8", "3.5"]);
    expect(cellValues("FFF", ["rainbow", "diamond", "rainbow"])).toEqual(["20", "25", "20"]);
  });

  test("reads each position's kind from the pattern, Vo, Da, Vi", () => {
    expect(kindsOf("F%%")).toEqual(["F", "%", "%"]);
    expect(kindsOf("%F%")).toEqual(["%", "F", "%"]);
    expect(cellValues("F%F", ["diamond", "diamond", "diamond"])).toEqual(["25", "3.5", "25"]);
  });
});
