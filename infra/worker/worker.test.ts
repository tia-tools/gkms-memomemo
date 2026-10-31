import { describe, expect, test } from "bun:test";
import { type Env, route } from "./worker.ts";

function env(): Env & { seen: string[] } {
  const seen: string[] = [];
  return {
    seen,
    ASSETS: { fetch: async (r) => (seen.push(`assets ${new URL(r.url).pathname}`), new Response("page")) },
    IMAGES: {
      head: async (key) => (seen.push(`head ${key}`), null),
      get: async (key) => (seen.push(`get ${key}`), null),
    },
  };
}

const upstream = async () => new Response("{}");

describe("route", () => {
  test("sends /img/* to R2, /data/skillcards.json upstream, and everything else to the assets", async () => {
    const e = env();
    await route(new Request("https://example.tia.run/img/sheet112/sense-hski-1a2b3c4d.webp"), e, upstream);
    const data = await route(new Request("https://example.tia.run/data/skillcards.json"), e, upstream);
    await route(new Request("https://example.tia.run/?m=1"), e, upstream);
    await route(new Request("https://example.tia.run/data/skillcards.v1.json"), e, upstream);
    expect(e.seen).toEqual(["get sheet112/sense-hski-1a2b3c4d.webp", "assets /", "assets /data/skillcards.v1.json"]);
    expect(await data.text()).toBe("{}");
  });
});
