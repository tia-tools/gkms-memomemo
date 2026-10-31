import { describe, expect, test } from "bun:test";
import { dropIndex, popoverOffset } from "./layout.ts";

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
