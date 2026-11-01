import { describe, expect, test } from "bun:test";

const CSS = await Bun.file(new URL("./index.css", import.meta.url)).text();
const FIELDS_RULE = /^input,\s*select,\s*textarea\s*\{\s*font-size:\s*max\(16px,\s*1em\);\s*\}/m;

describe("index.css", () => {
  test("sizes every field at 16 px or more, so iOS Safari does not zoom in when one takes focus (D62)", () => {
    expect(FIELDS_RULE.test(CSS)).toBe(true);
  });

  test("keeps that rule outside any layer, where it wins over Tailwind's text-* utilities on a field", () => {
    const at = CSS.search(FIELDS_RULE);
    const layer = CSS.indexOf("@layer");
    expect(at >= 0 && (layer === -1 || at < layer)).toBe(true);
  });
});
