import { describe, expect, test } from "bun:test";
import { HALF_WIDTH_EM, nameEms } from "./fit.ts";

describe("nameEms", () => {
  test("counts a full-width character one em and a half-width one less", () => {
    expect(nameEms("成就")).toBe(2);
    expect(nameEms("成就+")).toBeCloseTo(2 + HALF_WIDTH_EM);
    expect(nameEms("コール＆レスポンス+")).toBeCloseTo(9 + HALF_WIDTH_EM);
    expect(nameEms("ｱｲ")).toBeCloseTo(2 * HALF_WIDTH_EM);
    expect(nameEms("")).toBe(0);
  });
});
