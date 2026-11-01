import { describe, expect, test } from "bun:test";
import { cacheNames, routeOf, staleCaches, staleSheets, type SwManifest, worthKeeping } from "./routes.ts";

const ORIGIN = "https://gkms-memomemo.tia.run";
const SHEET = "/img/gkms-memomemo/sheet112/sense-hski-0000aaaa.webp";
const MANIFEST: SwManifest = {
  version: "v1",
  precache: ["/", "/assets/index-abc.js", "/assets/index-abc.css", "/icons/frames112.webp", "/manifest.webmanifest"],
  data: "/data/skillcards.json",
  sheetPrefix: "/img/",
  sheets: [SHEET],
};

const get = (path: string, navigate = false) => routeOf({ url: `${ORIGIN}${path}`, method: "GET", navigate }, ORIGIN, MANIFEST);

describe("routeOf", () => {
  test("a navigation is the page, whatever its path or query", () => {
    expect([get("/", true), get("/?x=1", true), get("/other", true)]).toEqual(["page", "page", "page"]);
  });

  test("the page's own files are precached", () => {
    expect([get("/assets/index-abc.js"), get("/assets/index-abc.css"), get("/icons/frames112.webp"), get("/manifest.webmanifest")]).toEqual(["precached", "precached", "precached", "precached"]);
  });

  test("the data file and the sheets have their own routes", () => {
    expect([get("/data/skillcards.json"), get(SHEET), get("/img/gkms-memomemo/sheet112/logic-ttmr-0000bbbb.webp")]).toEqual(["data", "sheet", "sheet"]);
  });

  test("a file the page does not have, another origin, a query or a method other than GET is left to the network", () => {
    expect(get("/assets/index-old.js")).toBe("network");
    expect(get("/sw.js")).toBe("network");
    expect(get("/assets/index-abc.js?v=2")).toBe("network");
    expect(get("/data/skillcards.json?x")).toBe("network");
    expect(routeOf({ url: `https://gakumas-supportcards.tia.run/data/skillcards.json`, method: "GET", navigate: false }, ORIGIN, MANIFEST)).toBe("network");
    expect(routeOf({ url: `${ORIGIN}/data/skillcards.json`, method: "HEAD", navigate: false }, ORIGIN, MANIFEST)).toBe("network");
    expect(routeOf({ url: `${ORIGIN}/count`, method: "POST", navigate: false }, ORIGIN, MANIFEST)).toBe("network");
  });

  test("another origin's navigation is not this page's either", () => {
    expect(routeOf({ url: "https://example.com/", method: "GET", navigate: true }, ORIGIN, MANIFEST)).toBe("network");
  });
});

describe("cacheNames and staleCaches", () => {
  test("only the page's cache carries the version", () => {
    expect(cacheNames("v1")).toEqual({ page: "memomemo-page-v1", data: "memomemo-data", sheets: "memomemo-sheets" });
  });

  test("an activation deletes earlier versions' pages, keeps the data and the sheets, and touches no other cache", () => {
    const existing = ["memomemo-page-v0", "memomemo-page-v1", "memomemo-data", "memomemo-sheets", "memomemo-other", "someone-else"];
    expect(staleCaches(existing, "v1")).toEqual(["memomemo-page-v0", "memomemo-other"]);
    expect(staleCaches([], "v1")).toEqual([]);
  });
});

describe("staleSheets", () => {
  test("names the kept sheets the index no longer names", () => {
    const old = `${ORIGIN}/img/gkms-memomemo/sheet112/sense-hski-1111cccc.webp`;
    expect(staleSheets([`${ORIGIN}${SHEET}`, old], MANIFEST)).toEqual([old]);
    expect(staleSheets([], MANIFEST)).toEqual([]);
  });
});

describe("worthKeeping", () => {
  test("keeps the data file and the sheets a first visit loaded, each once", () => {
    const loaded = [`${ORIGIN}/assets/index-abc.js`, `${ORIGIN}/data/skillcards.json`, `${ORIGIN}${SHEET}`, `${ORIGIN}${SHEET}`, `${ORIGIN}/icons/frames112.webp`];
    expect(worthKeeping(loaded, ORIGIN, MANIFEST)).toEqual([`${ORIGIN}/data/skillcards.json`, `${ORIGIN}${SHEET}`]);
  });

  test("ignores what is not a URL of this page's data or sheets", () => {
    expect(worthKeeping([3, null, "not a url", "/data/skillcards.json", `https://example.com${SHEET}`, `${ORIGIN}/count`], ORIGIN, MANIFEST)).toEqual([]);
  });
});
