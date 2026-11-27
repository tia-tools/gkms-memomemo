import { describe, expect, test } from "bun:test";
import { faceUrl, fallbackGlyph } from "./idols.ts";

describe("faceUrl", () => {
  test("is the idol's face at the library's address", () => {
    expect(faceUrl("hkne")).toBe("https://gkms-library.tia.run/img/w112/img_sd_hkne_face-00.webp");
  });

  test("is null for anything that is not an idol id", () => {
    for (const id of ["", "hsk", "hskii", "HSKI", "../x", "hs/i"]) expect(faceUrl(id)).toBeNull();
  });
});

describe("fallbackGlyph", () => {
  test("is the first character of the name, a whole character even outside the BMP", () => {
    expect([fallbackGlyph("篠澤広"), fallbackGlyph("𠮷田"), fallbackGlyph("")]).toEqual(["篠", "𠮷", "?"]);
  });
});
