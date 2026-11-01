import { describe, expect, test } from "bun:test";
import { fakeCaches, fakeNetwork, ORIGIN } from "../test-support/caches.ts";
import { activate, install, keepLoaded, respond, type Worker } from "./handlers.ts";
import type { SwManifest } from "./routes.ts";

const SHEET = "/img/gkms-memomemo/sheet112/sense-hski-0000aaaa.webp";
const OLD_SHEET = "/img/gkms-memomemo/sheet112/sense-hski-1111cccc.webp";
const MANIFEST: SwManifest = { version: "v2", precache: ["/", "/assets/index-abc.js"], data: "/data/skillcards.json", sheetPrefix: "/img/", sheets: [SHEET] };
const ANSWERS = { "/": "<html>v2</html>", "/assets/index-abc.js": "js v2", "/data/skillcards.json": "data 1", [SHEET]: "sheet" };

function world(answers: Record<string, string | number> = ANSWERS) {
  const network = fakeNetwork(answers);
  const caches = fakeCaches(network);
  const worker: Worker = { caches, fetch: network.fetch, manifest: MANIFEST, origin: ORIGIN };
  return { network, caches, worker };
}

/** Asks the worker for `path` as the page would; null when it leaves the request to the browser. */
async function ask(worker: Worker, path: string, navigate = false): Promise<string | number | null> {
  const request = new Request(`${ORIGIN}${path}`);
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
  test("deletes earlier versions' pages and the sheets the index no longer names, keeping the rest", async () => {
    const { caches, worker } = world();
    const older = await caches.open("memomemo-page-v1");
    await older.put("/", new Response("v1"));
    const sheets = await caches.open("memomemo-sheets");
    await sheets.put(SHEET, new Response("sheet"));
    await sheets.put(OLD_SHEET, new Response("old"));
    await (await caches.open("memomemo-data")).put("/data/skillcards.json", new Response("data"));
    await install(worker);
    await activate(worker);
    expect(caches.kept()).toEqual({
      "memomemo-sheets": [`${ORIGIN}${SHEET}`],
      "memomemo-data": [`${ORIGIN}/data/skillcards.json`],
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

  test("the data file comes from the network, and its last copy is kept for when there is none", async () => {
    const { network, worker } = world();
    expect(await ask(worker, "/data/skillcards.json")).toBe("data 1");
    network.answers.set("/data/skillcards.json", "data 2");
    expect(await ask(worker, "/data/skillcards.json")).toBe("data 2");
    network.offline = true;
    expect(await ask(worker, "/data/skillcards.json")).toBe("data 2");
  });

  test("an error status for the data file gives the copy kept, and is not kept itself", async () => {
    const { caches, network, worker } = world();
    await ask(worker, "/data/skillcards.json");
    network.answers.set("/data/skillcards.json", 502);
    expect(await ask(worker, "/data/skillcards.json")).toBe("data 1");
    expect(await caches.text("memomemo-data", "/data/skillcards.json")).toBe("data 1");
  });

  test("an error status for the data file with nothing kept is passed on", async () => {
    const { worker } = world({ ...ANSWERS, "/data/skillcards.json": 502 });
    expect(await ask(worker, "/data/skillcards.json")).toBe(502);
  });

  test("offline, a data file never kept fails as it would without a worker", async () => {
    const { network, worker } = world();
    network.offline = true;
    expect(await ask(worker, "/data/skillcards.json").then(String, () => "failed")).toBe("failed");
  });

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

  test("anything else is left to the browser", async () => {
    const { worker } = world();
    expect([await ask(worker, "/sw.js"), await ask(worker, "/other.txt")]).toEqual([null, null]);
  });
});

describe("keepLoaded", () => {
  test("keeps the data file and the sheets a first visit loaded, from the network, which the HTTP cache answers", async () => {
    const { caches, worker } = world();
    await keepLoaded([`${ORIGIN}/assets/index-abc.js`, `${ORIGIN}/data/skillcards.json`, `${ORIGIN}${SHEET}`], worker);
    expect(caches.kept()).toEqual({ "memomemo-data": [`${ORIGIN}/data/skillcards.json`], "memomemo-sheets": [`${ORIGIN}${SHEET}`] });
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
    await keepLoaded([`${ORIGIN}/data/skillcards.json`, `${ORIGIN}${SHEET}`], worker);
    network.offline = false;
    network.answers.set("/data/skillcards.json", 502);
    await keepLoaded([`${ORIGIN}/data/skillcards.json`], worker);
    expect(caches.kept()).toEqual({ "memomemo-data": [], "memomemo-sheets": [] });
  });
});
