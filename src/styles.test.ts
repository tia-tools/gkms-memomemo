import { describe, expect, test } from "bun:test";

const CSS = await Bun.file(new URL("./index.css", import.meta.url)).text();
const MAIN = await Bun.file(new URL("./main.tsx", import.meta.url)).text();
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

describe("the game's font (D67)", () => {
  test("is the page's sans-serif, before the system's fallbacks", () => {
    expect(CSS).toMatch(/--font-sans:\s*"IBM Plex Sans JP",/);
  });

  test("is loaded at the two weights the page uses, Medium for text and Bold where it is bold", () => {
    expect(MAIN).toContain('import "@fontsource/ibm-plex-sans-jp/500.css";');
    expect(MAIN).toContain('import "@fontsource/ibm-plex-sans-jp/700.css";');
  });
});

/** The relative luminance of a #rrggbb colour (WCAG 2). */
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].toSorted((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/**
 * Each component class with a text colour: its name, its colour, and its face's colours, a
 * gradient's two ends or a flat background's one.
 */
function faces(css: string): { name: string; color: string; ends: string[] }[] {
  const block = css.slice(css.indexOf("@layer components"));
  return [...block.matchAll(/\n {2}(\.[\w.-]+) \{([^}]*)\n {2}\}/g)].flatMap(([, name = "", body = ""]) => {
    const gradient = /linear-gradient\((?:\d+deg, )?(#[0-9a-f]{6}), (#[0-9a-f]{6})\) padding-box/.exec(body);
    const flat = /\n {4}background: (#[0-9a-f]{6});/.exec(body);
    const ends = gradient ? [gradient[1] ?? "", gradient[2] ?? ""] : flat ? [flat[1] ?? ""] : [];
    const color = /\n {4}color: (#[0-9a-f]{6});/.exec(body)?.[1];
    return ends.length > 0 && color ? [{ name, color, ends }] : [];
  });
}

describe("the controls' text (D67)", () => {
  test("keeps 4.5:1 against both ends of its face, the floor for small text", () => {
    const found = faces(CSS);
    expect(found.map((f) => f.name)).toEqual([".btn", ".btn-off", ".btn-on", ".btn-primary", ".btn-danger", ".btn-danger.armed"]);
    const low = found.flatMap((f) => f.ends.filter((end) => contrast(f.color, end) < 4.5).map((end) => `${f.name}: ${f.color} on ${end}`));
    expect(low).toEqual([]);
  });

  test("the measure is WCAG's: black on white is 21:1, a colour on itself 1:1", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#db2777", "#db2777")).toBe(1);
  });
});
