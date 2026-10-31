import { describe, expect, test } from "bun:test";
import { dropIndex, placeAmongAll, popoverOffset } from "./layout.ts";

describe("dropIndex", () => {
  const mids = [100, 160, 220];

  test("counts the other rows whose middle is above the pointer", () => {
    expect(dropIndex(50, mids)).toBe(0);
    expect(dropIndex(130, mids)).toBe(1);
    expect(dropIndex(219, mids)).toBe(2);
    expect(dropIndex(500, mids)).toBe(3);
  });

  test("a pointer exactly on a middle stays above that row", () => {
    expect(dropIndex(160, mids)).toBe(1);
  });

  test("with no other row it lands first", () => {
    expect(dropIndex(130, [])).toBe(0);
  });
});

describe("placeAmongAll", () => {
  const others = ["a", "hidden1", "b", "hidden2", "c"];
  const shown = ["a", "b", "c"];

  test("before a shown row is that row's place among all", () => {
    expect(placeAmongAll(others, shown, 0)).toBe(0);
    expect(placeAmongAll(others, shown, 1)).toBe(2);
    expect(placeAmongAll(others, shown, 2)).toBe(4);
  });

  test("past the shown rows is just after the last of them, before hidden rows after it", () => {
    expect(placeAmongAll(["a", "b", "hidden"], ["a", "b"], 2)).toBe(2);
  });

  test("with every row shown, it is the same index", () => {
    expect([0, 1, 2, 3].map((i) => placeAmongAll(shown, shown, i))).toEqual([0, 1, 2, 3]);
  });

  test("with no other row shown, it lands at the end", () => {
    expect(placeAmongAll(["hidden"], [], 0)).toBe(1);
  });
});

describe("popoverOffset", () => {
  test("stays at its anchor when it fits", () => {
    expect(popoverOffset(20, 200, 390)).toBe(0);
  });

  test("moves left just enough to keep the right margin", () => {
    expect(popoverOffset(300, 200, 390)).toBe(390 - 8 - 200 - 300);
  });

  test("moves right to keep the left margin when its anchor is off the left edge", () => {
    expect(popoverOffset(-30, 200, 390)).toBe(38);
  });

  test("wider than the screen, it starts at the left margin", () => {
    expect(popoverOffset(100, 500, 390)).toBe(8 - 100);
  });

  test("touching the right margin exactly is still a fit", () => {
    expect(popoverOffset(182, 200, 390)).toBe(0);
  });
});
