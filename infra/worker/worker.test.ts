import { describe, expect, test } from "bun:test";
import type { CountsDb } from "./count.ts";
import { fakeD1 } from "./fake-d1.ts";
import worker, { type Env, route, type Runtime } from "./worker.ts";

function env(db: CountsDb): Env & { seen: string[] } {
  const seen: string[] = [];
  return {
    seen,
    ASSETS: { fetch: async (r) => (seen.push(`assets ${new URL(r.url).pathname}`), new Response("page")) },
    IMAGES: {
      head: async (key) => (seen.push(`head ${key}`), null),
      get: async (key) => (seen.push(`get ${key}`), null),
    },
    DB: db,
  };
}

function runtime(): Runtime & { seen: string[] } {
  const seen: string[] = [];
  return {
    seen,
    fetchUpstream: async (url) => (seen.push(`upstream ${url}`), new Response("{}")),
    rules: async () => (seen.push("rules"), null),
    cache: async () => ({ match: async () => undefined, put: async () => undefined }),
    waitUntil: () => undefined,
    now: () => new Date("2026-11-02T12:00:00Z"),
    log: () => undefined,
  };
}

describe("route", () => {
  test("sends /img/* to R2, /data/skillcards.json upstream, and everything else to the assets", async () => {
    const e = env(await fakeD1());
    const r = runtime();
    await route(new Request("https://example.tia.run/img/gkms-memomemo/sheet112/sense-hski-1a2b3c4d.webp"), e, r);
    const data = await route(new Request("https://example.tia.run/data/skillcards.json"), e, r);
    await route(new Request("https://example.tia.run/?m=1"), e, r);
    await route(new Request("https://example.tia.run/data/skillcards.v1.json"), e, r);
    expect(e.seen).toEqual(["get gkms-memomemo/sheet112/sense-hski-1a2b3c4d.webp", "assets /", "assets /data/skillcards.v1.json"]);
    expect(r.seen).toEqual(["upstream https://gakumas-supportcards.tia.run/data/skillcards.v1.json"]);
    expect(await data.text()).toBe("{}");
  });

  test("sends POST /count to the counting, with the salt and D1 of its Env", async () => {
    const db = await fakeD1();
    const r = runtime();
    const body = JSON.stringify({ section: "sense.kocho", card: "p_card-01-act-3_029", upgrade: 1, hif: "memory_ability-x", customization: [] });
    const request = () => new Request("https://example.tia.run/count", { method: "POST", body, headers: { "CF-Connecting-IP": "203.0.113.7" } });
    expect((await route(request(), env(db), r)).status).toBe(503);
    expect(r.seen).toEqual([]);
    expect((await route(request(), { ...env(db), HASH_SALT: "salt" }, r)).status).toBe(503);
    expect(r.seen).toEqual(["rules"]);
  });

  test("sends GET /counts to the counts from D1", async () => {
    const db = await fakeD1();
    const response = await route(new Request("https://example.tia.run/counts"), env(db), runtime());
    expect(response.status).toBe(200);
    expect(db.written.map((w) => w.sql)).toEqual(["SELECT section, kind, id, n FROM counts"]);
  });

  test("a path next to a Worker route is the assets' to answer", async () => {
    const e = env(await fakeD1());
    const paths = ["/img", "/imgx/a", "/data/skillcards.json/", "/data/skillcards.jsonx", "/count/", "/countx", "/counts/", "/counts.json"];
    for (const path of paths) await route(new Request(`https://example.tia.run${path}`), e, runtime());
    expect(e.seen).toEqual(paths.map((p) => `assets ${p}`));
  });
});

describe("scheduled", () => {
  test("deletes the cap rows of days before the trigger's UTC day", async () => {
    const db = await fakeD1();
    db.sqlite.run("INSERT INTO caps (key, day, n) VALUES ('a', '2026-11-01', 1), ('b', '2026-11-02', 1)");
    const waits: Promise<unknown>[] = [];
    worker.scheduled({ scheduledTime: Date.parse("2026-11-02T00:05:00Z") }, env(db), { waitUntil: (p) => void waits.push(p) });
    await Promise.all(waits);
    expect(db.sqlite.query("SELECT key FROM caps").all()).toEqual([{ key: "b" }]);
  });
});
