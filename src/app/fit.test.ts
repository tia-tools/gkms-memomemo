import { describe, expect, test } from "bun:test";
import { NARROW_EM, nameEms } from "./fit.ts";

describe("nameEms", () => {
  test("counts a full-width character one em, and a digit, + or half-width kana less", () => {
    expect(nameEms("成就")).toBe(2);
    expect(nameEms("成就+")).toBeCloseTo(2 + NARROW_EM);
    expect(nameEms("コール＆レスポンス+")).toBeCloseTo(9 + NARROW_EM);
    expect(nameEms("ｱｲ")).toBeCloseTo(2 * NARROW_EM);
    expect(nameEms("")).toBe(0);
  });

  test("never undercounts the glyphs measured wider: + is 0.63 em, and a Latin letter or % counts one em", () => {
    expect(NARROW_EM).toBeGreaterThanOrEqual(0.63);
    expect(nameEms("W")).toBe(1);
    expect(nameEms("200%")).toBeCloseTo(3 * NARROW_EM + 1);
  });
});
