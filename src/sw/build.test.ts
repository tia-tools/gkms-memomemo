import { describe, expect, test } from "bun:test";
import { swManifest, withManifest } from "./build.ts";

const FILES = [
  { path: "index.html", bytes: "<html></html>" },
  { path: "assets/index-abc.js", bytes: "js" },
  { path: "assets/index-abc.css", bytes: new TextEncoder().encode("css") },
  { path: "sw.js", bytes: "worker" },
  { path: "assets/index-abc.js.map", bytes: "{}" },
  { path: ".vite/manifest.json", bytes: "{}" },
  { path: "icons/frames112.webp", bytes: new Uint8Array([1, 2, 3]) },
];
const TTMR = "/img/gkms-memomemo/sheet112/sense-ttmr-0000bbbb.webp";
const HSKI = "/img/gkms-memomemo/sheet112/sense-hski-0000aaaa.webp";
const SHEETS = [TTMR, HSKI];

const manifestOf = (files = FILES) => swManifest(files, SHEETS, "/data/skillcards.json", "/img/");

describe("swManifest", () => {
  test("keeps the page at /, its scripts, styles and static files, but not the worker, source maps or Vite's manifests", () => {
    expect(manifestOf().precache).toEqual(["/", "/assets/index-abc.css", "/assets/index-abc.js", "/icons/frames112.webp"]);
  });

  test("carries the data route, the sheet prefix and the sheets, sorted", () => {
    const { data, sheetPrefix, sheets } = manifestOf();
    expect({ data, sheetPrefix, sheets }).toEqual({ data: "/data/skillcards.json", sheetPrefix: "/img/", sheets: [HSKI, TTMR] });
  });

  test("the version is the same for the same files, whatever their order", () => {
    expect(manifestOf([...FILES].reverse()).version).toBe(manifestOf().version);
    expect(manifestOf().version).toMatch(/^[0-9a-f]{16}$/);
  });

  test("the version changes when one byte of a kept file does, as a rebuilt static file's", () => {
    const changed = FILES.map((f) => (f.path === "icons/frames112.webp" ? { ...f, bytes: new Uint8Array([1, 2, 4]) } : f));
    expect(manifestOf(changed).version).not.toBe(manifestOf().version);
  });

  test("the version changes when a file is renamed, even with the same bytes", () => {
    const renamed = FILES.map((f) => (f.path === "assets/index-abc.js" ? { ...f, path: "assets/index-def.js" } : f));
    expect(manifestOf(renamed).version).not.toBe(manifestOf().version);
  });

  test("the version does not change with the worker or a source map, which are not kept", () => {
    const other = FILES.map((f) => (f.path === "sw.js" || f.path.endsWith(".map") ? { ...f, bytes: "changed" } : f));
    expect(manifestOf(other).version).toBe(manifestOf().version);
  });

  test("a file's bytes cannot be shifted into its neighbour's name to give the same version", () => {
    const a = [{ path: "a", bytes: "bc" }];
    const b = [{ path: "ab", bytes: "c" }];
    expect(swManifest(a, [], "/d", "/img/").version).not.toBe(swManifest(b, [], "/d", "/img/").version);
  });

  test("nor can two files be merged into one that holds the next one's name", () => {
    const two = [
      { path: "a", bytes: "x" },
      { path: "b", bytes: "y" },
    ];
    const one = [{ path: "a", bytes: "x/b\0y" }];
    expect(swManifest(two, [], "/d", "/img/").version).not.toBe(swManifest(one, [], "/d", "/img/").version);
  });
});

describe("withManifest", () => {
  test("writes the manifest where the worker reads it", () => {
    const manifest = manifestOf();
    const code = withManifest("start(__SW_MANIFEST__);", manifest);
    expect(code).toBe(`start(${JSON.stringify(manifest)});`);
  });

  test("refuses a worker that names it twice or not at all", () => {
    expect(() => withManifest("a(__SW_MANIFEST__);b(__SW_MANIFEST__);", manifestOf())).toThrow("found it 2 times");
    expect(() => withManifest("start();", manifestOf())).toThrow("found it 0 times");
  });
});
