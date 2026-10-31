import { describe, expect, test } from "bun:test";
import { SKILLCARDS_CACHE, SKILLCARDS_SOURCE, serveSkillCards } from "./data.ts";

const PAGE = "https://example.tia.run/data/skillcards.json";

function upstream(response: () => Response): ((url: string) => Promise<Response>) & { urls: string[] } {
  const urls: string[] = [];
  return Object.assign(async (url: string) => (urls.push(url), response()), { urls });
}

describe("serveSkillCards", () => {
  test("GET passes the sibling's versioned file through as JSON, cacheable for an hour", async () => {
    const fetchUpstream = upstream(() => new Response('{"formatVersion":1}', { status: 200 }));
    const res = await serveSkillCards(new Request(PAGE), fetchUpstream);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe(SKILLCARDS_CACHE);
    expect(await res.text()).toBe('{"formatVersion":1}');
    expect(fetchUpstream.urls).toEqual(["https://gakumas-supportcards.tia.run/data/skillcards.v1.json"]);
    expect(SKILLCARDS_SOURCE).toBe(fetchUpstream.urls[0] ?? "");
  });

  test("HEAD answers the same headers without a body", async () => {
    const res = await serveSkillCards(new Request(PAGE, { method: "HEAD" }), upstream(() => new Response("{}")));
    expect([res.status, res.headers.get("Cache-Control"), await res.text()]).toEqual([200, SKILLCARDS_CACHE, ""]);
  });

  test("an upstream failure is a 502 that is never cached", async () => {
    for (const fail of [() => new Response("gone", { status: 404 }), () => new Response("oops", { status: 500 })]) {
      const res = await serveSkillCards(new Request(PAGE), upstream(fail));
      expect([res.status, res.headers.get("Cache-Control")]).toEqual([502, "no-store"]);
    }
  });

  test("an upstream that cannot be reached is a 502 too", async () => {
    const res = await serveSkillCards(new Request(PAGE), async () => {
      throw new TypeError("network down");
    });
    expect([res.status, res.headers.get("Cache-Control")]).toEqual([502, "no-store"]);
  });

  test("refuses anything but GET and HEAD without asking upstream", async () => {
    const fetchUpstream = upstream(() => new Response("{}"));
    const res = await serveSkillCards(new Request(PAGE, { method: "POST", body: "x" }), fetchUpstream);
    expect([res.status, res.headers.get("Allow")]).toEqual([405, "GET, HEAD"]);
    expect(fetchUpstream.urls).toEqual([]);
  });
});
