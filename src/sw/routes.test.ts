import { describe, expect, test } from "bun:test";
import { cacheNames, cacheOf, missingReleases, pointedReleases, routeOf, staleCaches, staleData, staleKept, type SwManifest, worthKeeping } from "./routes.ts";

const ORIGIN = "https://gkms-memomemo.tia.run";
const SHEET = "/img/gkms-memomemo/sheet112/sense-hski-0000aaaa.webp";
const FONT = "/fonts/ibm-plex-sans-jp-119-500-normal-AbCd12.woff2";
const MANIFEST: SwManifest = {
  version: "v1",
  precache: ["/", "/assets/index-abc.js", "/assets/index-abc.css", "/icons/frames112.webp", "/manifest.webmanifest"],
  library: "https://gkms-library.tia.run",
  pointer: "/data/latest.v1.json",
  sheetPrefix: "/img/",
  sheets: [SHEET],
  fontPrefix: "/fonts/",
  fonts: [FONT],
};

const LIBRARY = MANIFEST.library;
const POINTER = `${LIBRARY}/data/latest.v1.json`;
const RELEASE = `${LIBRARY}/data/skill-cards/v1/20261127T1126Z-a09c6f2a.json`;
const FACE = `${LIBRARY}/img/w112/img_sd_hkne_face-00.webp`;

const get = (path: string, navigate = false) => routeOf({ url: `${ORIGIN}${path}`, method: "GET", navigate }, ORIGIN, MANIFEST);
const at = (url: string, method = "GET") => routeOf({ url, method, navigate: false }, ORIGIN, MANIFEST);

describe("routeOf", () => {
  test("a navigation is the page, whatever its path or query", () => {
    expect([get("/", true), get("/?x=1", true), get("/other", true)]).toEqual(["page", "page", "page"]);
  });

  test("the page's own files are precached", () => {
    expect([get("/assets/index-abc.js"), get("/assets/index-abc.css"), get("/icons/frames112.webp"), get("/manifest.webmanifest")]).toEqual(["precached", "precached", "precached", "precached"]);
  });

  test("the sheets have their own route", () => {
    expect([get(SHEET), get("/img/gkms-memomemo/sheet112/logic-ttmr-0000bbbb.webp")]).toEqual(["sheet", "sheet"]);
  });

  test("at the library's origin, the pointer, a release and a face have their own routes (L5, L6)", () => {
    expect([at(POINTER), at(RELEASE), at(`${LIBRARY}/data/idols/v1/20261116T1124Z-5122c626.json`), at(FACE)]).toEqual(["pointer", "release", "release", "face"]);
  });

  test("anything else there, a query or another method is left to the network", () => {
    const others = [`${LIBRARY}/img/w112/img_general_skillcard_act-3_029.webp`, `${LIBRARY}/formats/idols.v1.ts`, `${LIBRARY}/data/latest.v2.json`, `${LIBRARY}/data/x.json`, `${POINTER}?x`, `${RELEASE}?x`, `${FACE}?v=1`];
    expect(others.map((url) => at(url))).toEqual(others.map(() => "network"));
    expect(at(RELEASE, "HEAD")).toBe("network");
    expect(at(`${ORIGIN}/data/latest.v1.json`)).toBe("network");
  });

  test("so do the font's files, which are not precached (D68)", () => {
    expect([get(FONT), get("/fonts/ibm-plex-sans-jp-latin-700-normal-EfGh34.woff")]).toEqual(["font", "font"]);
    expect(get("/fonts/x.woff2?v=1")).toBe("network");
  });

  test("a file the page does not have, another origin, a query or a method other than GET is left to the network", () => {
    expect(get("/assets/index-old.js")).toBe("network");
    expect(get("/sw.js")).toBe("network");
    expect(get("/assets/index-abc.js?v=2")).toBe("network");
    expect(get("/data/skillcards.json")).toBe("network");
    expect(at("https://gakumas-supportcards.tia.run/data/skillcards.v1.json")).toBe("network");
    expect(routeOf({ url: `${ORIGIN}/count`, method: "POST", navigate: false }, ORIGIN, MANIFEST)).toBe("network");
  });

  test("another origin's navigation is not this page's either", () => {
    expect(routeOf({ url: "https://example.com/", method: "GET", navigate: true }, ORIGIN, MANIFEST)).toBe("network");
  });
});

describe("cacheNames and staleCaches", () => {
  test("only the page's cache carries the version", () => {
    expect(cacheNames("v1")).toEqual({ page: "memomemo-page-v1", data: "memomemo-data", next: "memomemo-data-next", sheets: "memomemo-sheets", fonts: "memomemo-fonts", faces: "memomemo-faces" });
  });

  test("an activation deletes earlier versions' pages, keeps the data, the sheets, the font and the faces, and touches no other cache", () => {
    const existing = ["memomemo-page-v0", "memomemo-page-v1", "memomemo-data", "memomemo-data-next", "memomemo-sheets", "memomemo-fonts", "memomemo-faces", "memomemo-other", "someone-else"];
    expect(staleCaches(existing, "v1")).toEqual(["memomemo-page-v0", "memomemo-other"]);
    expect(staleCaches([], "v1")).toEqual([]);
  });
});

describe("cacheOf", () => {
  test("a fresh pointer waits apart, a release goes in the data cache, a face in the faces', a sheet and a font in theirs, nothing else anywhere", () => {
    const names = cacheNames("v1");
    const routes = ["pointer", "release", "face", "sheet", "font", "page", "precached", "network"] as const;
    expect(routes.map((route) => cacheOf(route, names))).toEqual([names.next, names.data, names.faces, names.sheets, names.fonts, null, null, null]);
  });

  test("missingReleases names the releases a pointer names that are not kept", () => {
    const named = ["/data/skill-cards/v1/a.json", "/data/idols/v1/b.json"];
    expect(missingReleases(named, [`${LIBRARY}/data/idols/v1/b.json`, POINTER], MANIFEST)).toEqual(["/data/skill-cards/v1/a.json"]);
    expect(missingReleases(named, named.map((path) => `${LIBRARY}${path}`), MANIFEST)).toEqual([]);
  });
});

describe("pointedReleases and staleData", () => {
  const OTHER = `${LIBRARY}/data/skill-cards/v1/20261126T1126Z-00000000.json`;

  test("a pointer's paths are read as paths at the library", () => {
    expect(pointedReleases({ files: [{ path: "data/idols/v1/a.json" }, { path: "data/skill-cards/v1/b.json" }] })).toEqual(["/data/idols/v1/a.json", "/data/skill-cards/v1/b.json"]);
  });

  test("a pointer with no list of paths names nothing", () => {
    for (const json of [null, 3, {}, { files: {} }, { files: [{}] }, { files: [{ path: 1 }] }]) expect(pointedReleases(json)).toBeNull();
  });

  test("drops what is not the library's pointer or a release, and a release the pointer no longer names", () => {
    const kept = [POINTER, RELEASE, OTHER, `${ORIGIN}/data/skillcards.json`, `${RELEASE}?x`];
    expect(staleData(kept, ["/data/skill-cards/v1/20261127T1126Z-a09c6f2a.json"], MANIFEST)).toEqual([OTHER, `${ORIGIN}/data/skillcards.json`, `${RELEASE}?x`]);
  });

  test("with no pointer to go by, keeps every release", () => {
    expect(staleData([POINTER, RELEASE, OTHER, `${ORIGIN}/data/skillcards.json`], null, MANIFEST)).toEqual([`${ORIGIN}/data/skillcards.json`]);
  });
});

describe("staleKept", () => {
  test("names the kept sheets the index no longer names", () => {
    const old = `${ORIGIN}/img/gkms-memomemo/sheet112/sense-hski-1111cccc.webp`;
    expect(staleKept([`${ORIGIN}${SHEET}`, old], MANIFEST.sheets)).toEqual([old]);
    expect(staleKept([], MANIFEST.sheets)).toEqual([]);
  });

  test("names the kept font files the build no longer wrote", () => {
    const old = `${ORIGIN}/fonts/ibm-plex-sans-jp-119-500-normal-Old999.woff2`;
    expect(staleKept([`${ORIGIN}${FONT}`, old], MANIFEST.fonts)).toEqual([old]);
  });
});

describe("worthKeeping", () => {
  test("keeps the library's pointer, releases and faces, the sheets and the font's files a first visit loaded, each once", () => {
    const loaded = [`${ORIGIN}/assets/index-abc.js`, POINTER, RELEASE, FACE, `${ORIGIN}${SHEET}`, `${ORIGIN}${SHEET}`, `${ORIGIN}/icons/frames112.webp`, `${ORIGIN}${FONT}`];
    expect(worthKeeping(loaded, ORIGIN, MANIFEST)).toEqual([POINTER, RELEASE, FACE, `${ORIGIN}${SHEET}`, `${ORIGIN}${FONT}`]);
  });

  test("ignores what is not a URL of this page's data or sheets", () => {
    expect(worthKeeping([3, null, "not a url", "/data/skillcards.json", `https://example.com${SHEET}`, `${ORIGIN}/count`], ORIGIN, MANIFEST)).toEqual([]);
  });
});
