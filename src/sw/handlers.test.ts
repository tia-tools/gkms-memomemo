import { describe, expect, test } from "bun:test";
import { fakeCaches, fakeNetwork, ORIGIN } from "../test-support/caches.ts";
import { activate, install, keepLoaded, respond, type Worker } from "./handlers.ts";
import type { SwManifest } from "./routes.ts";

const SHEET = "/img/gkms-memomemo/sheet112/sense-hski-0000aaaa.webp";
const OLD_SHEET = "/img/gkms-memomemo/sheet112/sense-hski-1111cccc.webp";
const FONT = "/fonts/ibm-plex-sans-jp-119-500-normal-AbCd12.woff2";
const OLD_FONT = "/fonts/ibm-plex-sans-jp-119-500-normal-Old999.woff2";
const MANIFEST: SwManifest = {
  version: "v2",
  precache: ["/", "/assets/index-abc.js"],
  library: "https://gkms-library.tia.run",
  pointer: "/data/latest.v1.json",
  sheetPrefix: "/img/",
  sheets: [SHEET],
  fontPrefix: "/fonts/",
  fonts: [FONT],
};
const LIBRARY = MANIFEST.library;
const POINTER = `${LIBRARY}/data/latest.v1.json`;
const RELEASE_A = "/data/skill-cards/v1/20261126T1126Z-aaaaaaaa.json";
const RELEASE_B = "/data/skill-cards/v1/20261127T1126Z-bbbbbbbb.json";
const IDOLS = "/data/idols/v1/20261116T1124Z-5122c626.json";
const FACE = "/img/w112/img_sd_hkne_face-00.webp";
/** A pointer naming these releases, as the library writes it (only `files[].path` matters to the worker). */
const pointing = (...paths: string[]): string => JSON.stringify({ pointerVersion: 1, files: paths.map((path) => ({ path: path.slice(1) })) });
/** The fake network answers by path, whatever the origin: the page's paths and the library's do not overlap. */
const ANSWERS = {
  "/": "<html>v2</html>",
  "/assets/index-abc.js": "js v2",
  "/data/latest.v1.json": pointing(RELEASE_A, IDOLS),
  [RELEASE_A]: "release a",
  [RELEASE_B]: "release b",
  [IDOLS]: "idols",
  [FACE]: "face",
  [SHEET]: "sheet",
  [FONT]: "font",
};

function world(answers: Record<string, string | number> = ANSWERS) {
  const network = fakeNetwork(answers);
  const caches = fakeCaches(network);
  const worker: Worker = { caches, fetch: network.fetch, manifest: MANIFEST, origin: ORIGIN };
  return { network, caches, worker };
}

/** Asks the worker for `path` (on this page's origin, or a full URL) as the page would; null when it leaves the request to the browser. */
async function ask(worker: Worker, path: string, navigate = false): Promise<string | number | null> {
  const request = new Request(path.startsWith("https://") ? path : `${ORIGIN}${path}`);
  const answer = respond(request, { url: request.url, method: "GET", navigate }, worker);
  if (answer === null) return null;
  const response = await answer;
  return response.ok ? response.text() : response.status;
}

describe("install", () => {
  test("keeps every file of the page in this version's cache", async () => {
    const { caches, worker } = world();
    await install(worker);
    expect(caches.kept()).toEqual({ "memomemo-page-v2": [`${ORIGIN}/`, `${ORIGIN}/assets/index-abc.js`] });
  });

  test("fails when a file of the page does not come, so the version before stays in charge", async () => {
    const { worker } = world({ ...ANSWERS, "/assets/index-abc.js": 404 });
    expect(await install(worker).then(() => "installed", () => "failed")).toBe("failed");
  });
});

describe("activate", () => {
  test("deletes earlier versions' pages, the sheets the index and the font files the build no longer names, and what in the data cache is not the library's, keeping the rest", async () => {
    const { caches, worker } = world();
    const older = await caches.open("memomemo-page-v1");
    await older.put("/", new Response("v1"));
    const sheets = await caches.open("memomemo-sheets");
    await sheets.put(SHEET, new Response("sheet"));
    await sheets.put(OLD_SHEET, new Response("old"));
    const fonts = await caches.open("memomemo-fonts");
    await fonts.put(FONT, new Response("font"));
    await fonts.put(OLD_FONT, new Response("old"));
    const data = await caches.open("memomemo-data");
    await data.put("/data/skillcards.json", new Response("the file kept before the library"));
    await data.put(POINTER, new Response(pointing(RELEASE_A)));
    await data.put(`${LIBRARY}${RELEASE_A}`, new Response("release a"));
    await data.put(`${LIBRARY}${RELEASE_B}`, new Response("release b"));
    await install(worker);
    await activate(worker);
    expect(caches.kept()).toEqual({
      "memomemo-sheets": [`${ORIGIN}${SHEET}`],
      "memomemo-fonts": [`${ORIGIN}${FONT}`],
      "memomemo-data": [POINTER, `${LIBRARY}${RELEASE_A}`, `${LIBRARY}${RELEASE_B}`],
      "memomemo-page-v2": [`${ORIGIN}/`, `${ORIGIN}/assets/index-abc.js`],
    });
  });
});

describe("respond", () => {
  test("a navigation comes from the network while there is one", async () => {
    const { network, worker } = world();
    await install(worker);
    network.answers.set("/", "<html>v3</html>");
    expect(await ask(worker, "/", true)).toBe("<html>v3</html>");
  });

  test("offline, a navigation gets the page kept at install, whatever its path", async () => {
    const { network, worker } = world();
    await install(worker);
    network.offline = true;
    expect([await ask(worker, "/", true), await ask(worker, "/?from=home", true)]).toEqual(["<html>v2</html>", "<html>v2</html>"]);
  });

  test("a navigation's page is never kept from the network: offline, it stays the one install kept with its scripts", async () => {
    const { caches, network, worker } = world();
    await install(worker);
    network.answers.set("/", "<html>v3</html>");
    await ask(worker, "/", true);
    network.offline = true;
    expect(await ask(worker, "/", true)).toBe("<html>v2</html>");
    expect(await caches.text("memomemo-page-v2", "/")).toBe("<html>v2</html>");
  });

  test("offline with nothing kept, a navigation fails as it would without a worker", async () => {
    const { network, worker } = world();
    network.offline = true;
    expect(await ask(worker, "/", true).then(String, () => "failed")).toBe("failed");
  });

  test("a file of the page comes from the cache, without the network", async () => {
    const { network, worker } = world();
    await install(worker);
    network.fetched.length = 0;
    network.offline = true;
    expect(await ask(worker, "/assets/index-abc.js")).toBe("js v2");
    expect(network.fetched).toEqual([]);
  });

  test("offline, the page's script comes from the cache though the server answered Vary: Origin and the script's request carries an Origin (seen with vite preview)", async () => {
    const { network, worker } = world();
    network.vary = "Origin";
    await install(worker);
    network.offline = true;
    const request = new Request(`${ORIGIN}/assets/index-abc.js`, { headers: { Origin: ORIGIN } });
    const answer = respond(request, { url: request.url, method: "GET", navigate: false }, worker);
    expect(await answer?.then((r) => r.text())).toBe("js v2");
  });

});

describe("respond, the library's files", () => {
  test("so do a kept pointer, release, face and sheet, whatever the answer's Vary", async () => {
    const { network, worker } = world();
    network.vary = "Origin";
    for (const url of [POINTER, `${LIBRARY}${RELEASE_A}`, `${LIBRARY}${FACE}`, `${ORIGIN}${SHEET}`]) await ask(worker, url);
    network.offline = true;
    const withOrigin = (url: string) => respond(new Request(url, { headers: { Origin: ORIGIN } }), { url, method: "GET", navigate: false }, worker);
    const texts = await Promise.all([POINTER, `${LIBRARY}${RELEASE_A}`, `${LIBRARY}${FACE}`, `${ORIGIN}${SHEET}`].map((url) => withOrigin(url)?.then((r) => r.text()) ?? Promise.resolve(null)));
    expect(texts).toEqual([pointing(RELEASE_A, IDOLS), "release a", "face", "sheet"]);
  });

  test("the library's pointer comes from the network, and its last copy is kept for when there is none (L5)", async () => {
    const { network, worker } = world();
    expect(await ask(worker, POINTER)).toBe(pointing(RELEASE_A, IDOLS));
    network.answers.set("/data/latest.v1.json", pointing(RELEASE_B, IDOLS));
    expect(await ask(worker, POINTER)).toBe(pointing(RELEASE_B, IDOLS));
    network.offline = true;
    expect(await ask(worker, POINTER)).toBe(pointing(RELEASE_B, IDOLS));
  });

  test("an error status for the pointer gives the copy kept, and is not kept itself; with nothing kept it is passed on", async () => {
    const { caches, network, worker } = world();
    await ask(worker, POINTER);
    network.answers.set("/data/latest.v1.json", 502);
    expect(await ask(worker, POINTER)).toBe(pointing(RELEASE_A, IDOLS));
    expect(await caches.text("memomemo-data", POINTER)).toBe(pointing(RELEASE_A, IDOLS));
    expect(await ask(world({ ...ANSWERS, "/data/latest.v1.json": 502 }).worker, POINTER)).toBe(502);
  });

  test("offline, a pointer never kept fails as it would without a worker", async () => {
    const { network, worker } = world();
    network.offline = true;
    expect(await ask(worker, POINTER).then(String, () => "failed")).toBe("failed");
  });

  test("a release is fetched once, then kept: offline it still comes", async () => {
    const { network, worker } = world();
    expect(await ask(worker, `${LIBRARY}${RELEASE_A}`)).toBe("release a");
    network.offline = true;
    expect(await ask(worker, `${LIBRARY}${RELEASE_A}`)).toBe("release a");
    expect(network.fetched).toEqual([`${LIBRARY}${RELEASE_A}`]);
  });

  test("a fresh pointer drops the releases it no longer names, keeping the ones it does", async () => {
    const { caches, network, worker } = world();
    await ask(worker, POINTER);
    await ask(worker, `${LIBRARY}${RELEASE_A}`);
    await ask(worker, `${LIBRARY}${IDOLS}`);
    network.answers.set("/data/latest.v1.json", pointing(RELEASE_B, IDOLS));
    await ask(worker, POINTER);
    expect(caches.kept()["memomemo-data"]).toEqual([POINTER, `${LIBRARY}${IDOLS}`]);
  });

  test("a pointer the worker cannot read drops nothing", async () => {
    const { caches, network, worker } = world();
    await ask(worker, `${LIBRARY}${RELEASE_A}`);
    network.answers.set("/data/latest.v1.json", "not json");
    await ask(worker, POINTER);
    expect(caches.kept()["memomemo-data"]).toEqual([`${LIBRARY}${RELEASE_A}`, POINTER]);
  });

  test("a face is fetched once, then kept in the faces' own cache: offline it is still drawn (L6)", async () => {
    const { caches, network, worker } = world();
    expect(await ask(worker, `${LIBRARY}${FACE}`)).toBe("face");
    network.offline = true;
    expect(await ask(worker, `${LIBRARY}${FACE}`)).toBe("face");
    expect(network.fetched).toEqual([`${LIBRARY}${FACE}`]);
    expect(caches.kept()["memomemo-faces"]).toEqual([`${LIBRARY}${FACE}`]);
  });

  test("a face not published yet is not kept, so it is asked again next time", async () => {
    const { caches, network, worker } = world();
    network.answers.delete(FACE);
    expect(await ask(worker, `${LIBRARY}${FACE}`)).toBe(404);
    expect(caches.kept()["memomemo-faces"]).toEqual([]);
  });

});

describe("respond, the sheets, the font and the rest", () => {
  test("a sheet is fetched once, then kept: offline it is still shown", async () => {
    const { network, worker } = world();
    expect(await ask(worker, SHEET)).toBe("sheet");
    network.offline = true;
    expect(await ask(worker, SHEET)).toBe("sheet");
    expect(network.fetched).toEqual([`${ORIGIN}${SHEET}`]);
  });

  test("a sheet that does not come is not kept", async () => {
    const { caches, network, worker } = world();
    network.answers.delete(SHEET);
    expect(await ask(worker, SHEET)).toBe(404);
    expect(caches.kept()["memomemo-sheets"]).toEqual([]);
  });

  test("a font file is fetched once, then kept in the font's own cache: offline the page keeps its font (D68)", async () => {
    const { caches, network, worker } = world();
    expect(await ask(worker, FONT)).toBe("font");
    network.offline = true;
    expect(await ask(worker, FONT)).toBe("font");
    expect(network.fetched).toEqual([`${ORIGIN}${FONT}`]);
    expect(caches.kept()["memomemo-fonts"]).toEqual([`${ORIGIN}${FONT}`]);
  });

  test("anything else is left to the browser", async () => {
    const { worker } = world();
    expect([await ask(worker, "/sw.js"), await ask(worker, "/other.txt"), await ask(worker, "/data/skillcards.json"), await ask(worker, `${LIBRARY}/formats/idols.v1.ts`)]).toEqual([null, null, null, null]);
  });
});

describe("keepLoaded", () => {
  test("keeps the library's pointer, releases and faces and the sheets a first visit loaded, from the network, which the HTTP cache answers", async () => {
    const { caches, worker } = world();
    await keepLoaded([`${ORIGIN}/assets/index-abc.js`, POINTER, `${LIBRARY}${RELEASE_A}`, `${LIBRARY}${FACE}`, `${ORIGIN}${SHEET}`, `${ORIGIN}${FONT}`], worker);
    expect(caches.kept()).toEqual({
      "memomemo-data": [POINTER, `${LIBRARY}${RELEASE_A}`],
      "memomemo-faces": [`${LIBRARY}${FACE}`],
      "memomemo-sheets": [`${ORIGIN}${SHEET}`],
      "memomemo-fonts": [`${ORIGIN}${FONT}`],
    });
  });

  test("fetches nothing already kept", async () => {
    const { network, worker } = world();
    await ask(worker, SHEET);
    network.fetched.length = 0;
    await keepLoaded([`${ORIGIN}${SHEET}`], worker);
    expect(network.fetched).toEqual([]);
  });

  test("what does not come is left for the next visit", async () => {
    const { caches, network, worker } = world();
    network.offline = true;
    await keepLoaded([POINTER, `${ORIGIN}${SHEET}`], worker);
    network.offline = false;
    network.answers.set("/data/latest.v1.json", 502);
    await keepLoaded([POINTER], worker);
    expect(caches.kept()).toEqual({ "memomemo-data": [], "memomemo-sheets": [] });
  });
});
