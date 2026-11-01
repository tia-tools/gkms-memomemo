import { describe, expect, test } from "bun:test";
import { cardNamed, kindLabelled, SKILL_CARDS } from "../../src/test-support/skillcards.ts";
import { clientKey } from "./client-key.ts";
import type { CountEvent } from "./count-contract.ts";
import { countRules } from "./count-event.ts";
import { cleanCaps, countsAnswer, type CountDeps, type CountsCache, type CountsDb, type CountsDeps, DAILY_CAP, handleCount, serveCounts } from "./count.ts";
import { type FakeD1, fakeD1 } from "./fake-d1.ts";

const SITE = "https://gkms-memomemo.tia.run";
const NOW = new Date("2026-11-02T12:00:00Z");
const IP = "203.0.113.7";
const JOJU = cardNamed("成就+");
const KOCHO = kindLabelled(JOJU, "好調+");
const HIF = SKILL_CARDS.hifAbilities.find((h) => SKILL_CARDS.cards.find((c) => c.id === h.card)?.plan === "sense")?.id ?? "";
const EVENT: CountEvent = { section: "sense.kocho", card: JOJU.id, upgrade: 1, hif: HIF, customization: [`${KOCHO}:1`] };
const RULES = countRules(SKILL_CARDS);

function post(body: unknown, headers: Record<string, string> = { "CF-Connecting-IP": IP }): Request {
  return new Request(`${SITE}/count`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers });
}

function deps(db: CountsDb, over: Partial<CountDeps> = {}): CountDeps & { lines: string[] } {
  const lines: string[] = [];
  return { db, salt: "salt", rules: async () => RULES, now: () => NOW, log: (line) => void lines.push(line), lines, ...over };
}

function table(db: FakeD1, sql: string): unknown[] {
  return db.sqlite.query(sql).all();
}
const counts = (db: FakeD1) => table(db, "SELECT section, kind, id, n FROM counts ORDER BY kind, id");
const caps = (db: FakeD1) => table(db, "SELECT key, day, n FROM caps");
const writes = (db: FakeD1) => db.written.filter((w) => !w.sql.startsWith("SELECT"));

describe("handleCount", () => {
  test("adds 1 to the card at its level, the H.I.F. ability and the customization step, under the section", async () => {
    const db = await fakeD1();
    expect((await handleCount(post(EVENT), deps(db))).status).toBe(200);
    expect((await handleCount(post({ ...EVENT, customization: [] }), deps(db))).status).toBe(200);
    expect(counts(db)).toEqual([
      { section: "sense.kocho", kind: "card", id: `${JOJU.id}:1`, n: 2 },
      { section: "sense.kocho", kind: "customization", id: "none", n: 1 },
      { section: "sense.kocho", kind: "customization", id: `${KOCHO}:1`, n: 1 },
      { section: "sense.kocho", kind: "hif", id: HIF, n: 2 },
    ]);
    expect(caps(db)).toEqual([{ key: await clientKey(IP, "2026-11-02", "salt"), day: "2026-11-02", n: 2 }]);
  });

  test("logs the rows each step writes: one for the cap, one per count, whether a row is new or not", async () => {
    const db = await fakeD1();
    const d = deps(db);
    await handleCount(post(EVENT), d);
    await handleCount(post(EVENT), d);
    expect(d.lines).toEqual(["count: rows written 1 for the cap, 3 for 3 counts", "count: rows written 1 for the cap, 3 for 3 counts"]);
  });

  test("the cap is exact: the 201st event of a day is refused and counts nothing", async () => {
    expect(DAILY_CAP).toBe(200); // the plan's starting cap (Milestone 6)
    const db = await fakeD1();
    for (let i = 0; i < DAILY_CAP; i++) expect((await handleCount(post(EVENT), deps(db))).status).toBe(200);
    const before = writes(db).length;
    expect((await handleCount(post(EVENT), deps(db))).status).toBe(429);
    expect(writes(db).slice(before).map((w) => w.rows)).toEqual([0]);
    expect(counts(db)).toContainEqual({ section: "sense.kocho", kind: "card", id: `${JOJU.id}:1`, n: DAILY_CAP });
    expect(caps(db)).toEqual([expect.objectContaining({ n: DAILY_CAP })]);
  });

  test("the cap is per player and per day: another address, or the next day, counts again", async () => {
    const db = await fakeD1();
    db.sqlite.run("INSERT INTO caps (key, day, n) VALUES (?1, ?2, ?3)", [await clientKey(IP, "2026-11-02", "salt"), "2026-11-02", DAILY_CAP]);
    expect((await handleCount(post(EVENT), deps(db))).status).toBe(429);
    expect((await handleCount(post(EVENT, { "CF-Connecting-IP": "203.0.113.8" }), deps(db))).status).toBe(200);
    expect((await handleCount(post(EVENT), deps(db, { now: () => new Date("2026-11-03T00:00:00Z") }))).status).toBe(200);
  });

  test("two events at once for the last place: one is counted, one refused", async () => {
    const db = await fakeD1();
    db.sqlite.run("INSERT INTO caps (key, day, n) VALUES (?1, ?2, ?3)", [await clientKey(IP, "2026-11-02", "salt"), "2026-11-02", DAILY_CAP - 1]);
    const answers = await Promise.all([handleCount(post(EVENT), deps(db)), handleCount(post(EVENT), deps(db))]);
    expect(answers.map((a) => a.status).toSorted((x, y) => x - y)).toEqual([200, 429]);
    expect(counts(db)).toContainEqual({ section: "sense.kocho", kind: "card", id: `${JOJU.id}:1`, n: 1 });
  });

  test("a refused request writes nothing and uses up no place", async () => {
    const db = await fakeD1();
    const refusals: [Request, Partial<CountDeps>, number][] = [
      [new Request(`${SITE}/count`), {}, 405],
      [post(EVENT, { "CF-Connecting-IP": IP, Origin: "https://example.com" }), {}, 403],
      [post("x".repeat(1025)), {}, 413],
      [post("{"), {}, 400],
      [post({ ...EVENT, section: "sense" }), {}, 400],
      [post(EVENT), { salt: undefined }, 503],
      [post(EVENT), { salt: "" }, 503],
      [post(EVENT, {}), {}, 400],
      [post(EVENT), { rules: async () => null }, 503],
      [post({ ...EVENT, section: "logic.yaruki" }), {}, 400],
      [post({ ...EVENT, customization: [`${KOCHO}:2`] }), {}, 400],
    ];
    for (const [request, over, status] of refusals) expect({ status, got: (await handleCount(request, deps(db, over))).status }).toEqual({ status, got: status });
    expect(db.written).toEqual([]);
  });

  test("a request from the page's own origin, as a browser sends it, is counted", async () => {
    const db = await fakeD1();
    expect((await handleCount(post(EVENT, { "CF-Connecting-IP": IP, Origin: SITE }), deps(db))).status).toBe(200);
  });

  test("answers JSON that no one caches", async () => {
    const response = await handleCount(post(EVENT), deps(await fakeD1()));
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await handleCount(post(EVENT), deps(await fakeD1(), { salt: undefined }))).headers.get("Cache-Control")).toBe("no-store");
  });

  test("a D1 failure is a 503, logged", async () => {
    const broken: CountsDb = {
      prepare: () => {
        throw new Error("D1_ERROR: daily limit");
      },
      batch: async () => [],
    };
    const d = deps(broken);
    expect((await handleCount(post(EVENT), d)).status).toBe(503);
    expect(d.lines).toEqual(["count: D1 failed: D1_ERROR: daily limit"]);
  });
});

function memoryCache(): CountsCache & { kept: Map<string, Response> } {
  const kept = new Map<string, Response>();
  return {
    kept,
    match: async (request) => kept.get(request.url)?.clone(),
    put: async (request, response) => void kept.set(request.url, response),
  };
}

function countsDeps(db: CountsDb, cache = memoryCache()): CountsDeps & { lines: string[]; waits: Promise<unknown>[] } {
  const lines: string[] = [];
  const waits: Promise<unknown>[] = [];
  return { db, cache: async () => cache, waitUntil: (p) => void waits.push(p), log: (line) => void lines.push(line), lines, waits };
}

describe("serveCounts", () => {
  test("answers every count by section and kind, every section present", async () => {
    const db = await fakeD1();
    await handleCount(post(EVENT), deps(db));
    await handleCount(post({ ...EVENT, section: "sense.common", customization: [] }), deps(db));
    const response = await serveCounts(new Request(`${SITE}/counts`), countsDeps(db));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
    const body: unknown = await response.json();
    expect(body).toEqual({
      formatVersion: 1,
      sections: {
        ...countsAnswer([]).sections,
        "sense.kocho": { card: { [`${JOJU.id}:1`]: 1 }, hif: { [HIF]: 1 }, customization: { [`${KOCHO}:1`]: 1 } },
        "sense.common": { card: { [`${JOJU.id}:1`]: 1 }, hif: { [HIF]: 1 }, customization: { none: 1 } },
      },
    });
  });

  test("is one query, then kept for the hour: a later request, a query string too, reads no D1", async () => {
    const db = await fakeD1();
    const cache = memoryCache();
    const first = countsDeps(db, cache);
    await serveCounts(new Request(`${SITE}/counts`), first);
    await Promise.all(first.waits);
    expect(db.written.length).toBe(1);
    expect([...cache.kept.keys()]).toEqual([`${SITE}/counts`]);
    await handleCount(post(EVENT), deps(db));
    const reads = db.written.length;
    const later = await serveCounts(new Request(`${SITE}/counts?nocache=1`), countsDeps(db, cache));
    expect(db.written.length).toBe(reads);
    expect(await later.json()).toEqual(countsAnswer([]));
  });

  test("HEAD answers the headers without a body; another method is a 405", async () => {
    const db = await fakeD1();
    const head = await serveCounts(new Request(`${SITE}/counts`, { method: "HEAD" }), countsDeps(db));
    expect(head.status).toBe(200);
    expect(head.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(await head.text()).toBe("");
    const other = await serveCounts(new Request(`${SITE}/counts`, { method: "POST" }), countsDeps(db));
    expect(other.status).toBe(405);
    expect(other.headers.get("Allow")).toBe("GET, HEAD");
  });

  test("a D1 failure is a 503 that is not kept, so the next request asks D1 again", async () => {
    const cache = memoryCache();
    const broken: CountsDb = {
      prepare: () => {
        throw new Error("D1_ERROR");
      },
      batch: async () => [],
    };
    const d = countsDeps(broken, cache);
    const response = await serveCounts(new Request(`${SITE}/counts`), d);
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(cache.kept.size).toBe(0);
    expect(d.lines).toEqual(["counts: D1 failed: D1_ERROR"]);
  });
});

describe("countsAnswer", () => {
  test("leaves out a row that is not a count of a known section and kind", () => {
    const good = { section: "logic.yaruki", kind: "hif", id: "memory_ability-x", n: 4 };
    const answer = countsAnswer([
      good,
      { ...good, section: "logic" },
      { ...good, kind: "memo" },
      { ...good, id: 7 },
      { ...good, n: 0 },
      { ...good, n: 1.5 },
      { ...good, n: "4" },
    ]);
    expect(answer.sections["logic.yaruki"]).toEqual({ card: {}, hif: { "memory_ability-x": 4 }, customization: {} });
    expect(Object.values(answer.sections).flatMap((s) => Object.values(s).flatMap((k) => Object.keys(k)))).toEqual(["memory_ability-x"]);
  });

  test("an id cannot set an object's prototype", () => {
    const answer = countsAnswer([{ section: "sense.kocho", kind: "card", id: "__proto__", n: 1 }]);
    expect(Object.getPrototypeOf(answer.sections["sense.kocho"].card)).toBe(Object.prototype);
    expect(JSON.stringify(answer.sections["sense.kocho"].card)).toBe('{"__proto__":1}');
  });
});

describe("cleanCaps", () => {
  test("deletes the cap rows of past days and keeps today's", async () => {
    const db = await fakeD1();
    for (const [key, day] of [["a", "2026-10-31"], ["b", "2026-11-01"], ["c", "2026-11-02"]]) db.sqlite.run("INSERT INTO caps (key, day, n) VALUES (?1, ?2, 1)", [key ?? "", day ?? ""]);
    const lines: string[] = [];
    await cleanCaps(db, new Date("2026-11-02T00:05:00Z"), (line) => void lines.push(line));
    expect(caps(db)).toEqual([{ key: "c", day: "2026-11-02", n: 1 }]);
    expect(lines).toEqual(["caps: rows written 2 deleting the rows of days before 2026-11-02"]);
  });
});

describe("the migration", () => {
  test("makes WITHOUT ROWID tables, so a new row is one row written, not a row and its key's index", async () => {
    const db = await fakeD1();
    expect(table(db, "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).toEqual([{ name: "caps" }, { name: "counts" }]);
    expect(table(db, "SELECT name FROM sqlite_master WHERE type = 'index'")).toEqual([]);
  });
});
