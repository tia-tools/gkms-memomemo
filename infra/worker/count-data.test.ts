import { describe, expect, test } from "bun:test";
import type { Latest } from "../../src/data/formats/latest.v1.ts";
import { parse as parseLatest } from "../../src/data/formats/latest.v1.ts";
import { LIBRARY, POINTER } from "../../src/data/library.ts";
import { cardNamed, SKILL_CARDS } from "../../src/test-support/skillcards.ts";
import { keptRules, libraryUpstream, POINTER_TTL_MS, type RulesUpstream } from "./count-data.ts";
import type { CountRules } from "./count-event.ts";

const text = (name: string): Promise<string> => Bun.file(new URL(`../../src/data/fixtures/${name}`, import.meta.url)).text();
/** The library's address on 2026-11-27, path by path (src/data/library.test.ts). */
const FILES: Record<string, string> = {
  [POINTER]: await text("latest.v1.20261127T1126Z.json"),
  "data/skill-cards/v1/20261127T1126Z-a09c6f2a.json": await text("skill-cards.v1.20261127T1126Z-a09c6f2a.json"),
  "data/idols/v1/20261116T1124Z-5122c626.json": await text("idols.v1.20261116T1124Z-5122c626.json"),
};
const serve = (files: Record<string, string>, status = 200) => async (url: string) => {
  const body = files[url.slice(LIBRARY.length + 1)];
  return body === undefined ? new Response("not found", { status: 404 }) : new Response(body, { status });
};
const JOJU = cardNamed("成就+");
const HIF = SKILL_CARDS.hifAbilities.find((h) => SKILL_CARDS.cards.find((c) => c.id === h.card)?.plan === "sense")?.id ?? "";

/** The fixture's pointer, with its skill-cards release renamed to `release` (a newer publication). */
function pointerNaming(release: string): Latest {
  const pointer = parseLatest(JSON.parse(FILES[POINTER] ?? ""));
  return {
    ...pointer,
    files: pointer.files.map((f) => (f.format === "skill-cards" ? { ...f, release, path: `data/skill-cards/v1/${release}.json`, sha256: `${release.slice(-8)}${"0".repeat(56)}` } : f)),
  };
}

describe("libraryUpstream", () => {
  test("reads the library's pointer, and the pool it names into the rules of its cards", async () => {
    const asked: string[] = [];
    const upstream = libraryUpstream(async (url) => (asked.push(url), serve(FILES)(url)));
    const rules = await upstream.rules(await upstream.pointer());
    expect(asked[0]).toBe(`${LIBRARY}/${POINTER}`);
    const event = { section: "sense.kocho" as const, card: JOJU.id, upgrade: 1, hif: HIF, steps: [] };
    expect(rules(event)?.length).toBe(3);
  });

  test("rejects when a file cannot be fetched, answers an error, is not JSON or breaks its format", async () => {
    const answers: ((url: string) => Promise<Response>)[] = [
      async () => {
        throw new Error("offline");
      },
      serve(FILES, 502),
      serve({ ...FILES, [POINTER]: "{" }),
      serve({ ...FILES, [POINTER]: JSON.stringify({ pointerVersion: 2 }) }),
      serve({ ...FILES, "data/skill-cards/v1/20261127T1126Z-a09c6f2a.json": JSON.stringify({ formatVersion: 1, cards: [], memoryAbilities: [] }) }),
    ];
    for (const answer of answers) {
      const upstream = libraryUpstream(answer);
      expect(await upstream.pointer().then((p) => upstream.rules(p)).then(() => "read", () => "refused")).toBe("refused");
    }
  });
});

describe("keptRules", () => {
  const a: CountRules = () => null;
  const b: CountRules = () => [];
  const OLD = pointerNaming("20261127T1126Z-aaaaaaaa");
  const NEW = pointerNaming("20261127T2050Z-bbbbbbbb");

  /** An upstream whose pointer is `current.pointer` (null: unreadable), counting reads; each pool read gives the next of `pools`. */
  function upstream(pools: CountRules[]) {
    const seen = { pointers: 0, pools: 0 };
    const current: { pointer: Latest | null } = { pointer: OLD };
    const u: RulesUpstream = {
      pointer: async () => {
        seen.pointers++;
        if (current.pointer === null) throw new Error("offline");
        return current.pointer;
      },
      rules: async () => {
        const rules = pools[seen.pools++];
        if (rules === undefined) throw new Error("unreadable");
        return rules;
      },
    };
    return { u, seen, current };
  }

  test("asks the pointer again only after five minutes, the page's own wait", async () => {
    let clock = 0;
    const { u, seen } = upstream([a]);
    const rules = keptRules(u, () => clock);
    expect(await rules()).toBe(a);
    clock = POINTER_TTL_MS - 1;
    expect(await rules()).toBe(a);
    expect(seen).toEqual({ pointers: 1, pools: 1 });
    clock = POINTER_TTL_MS;
    expect(await rules()).toBe(a);
    expect(seen).toEqual({ pointers: 2, pools: 1 });
  });

  test("reads the pool again only when the pointer names new releases", async () => {
    let clock = 0;
    const { u, seen, current } = upstream([a, b]);
    const rules = keptRules(u, () => clock);
    await rules();
    current.pointer = NEW;
    clock = POINTER_TTL_MS;
    expect(await rules()).toBe(b);
    expect(seen).toEqual({ pointers: 2, pools: 2 });
  });

  test("while the library cannot be read, keeps the last rules had, and tries again only after five minutes", async () => {
    let clock = 0;
    const { u, seen, current } = upstream([a]);
    const rules = keptRules(u, () => clock);
    await rules();
    current.pointer = null;
    clock = POINTER_TTL_MS;
    expect([await rules(), await rules()]).toEqual([a, a]);
    expect(seen.pointers).toBe(2);
    current.pointer = NEW;
    clock = 2 * POINTER_TTL_MS;
    expect(await rules()).toBe(a);
    expect(seen).toEqual({ pointers: 3, pools: 2 });
  });

  test("a pool that cannot be read is not read again on every request, only after five minutes", async () => {
    let clock = 0;
    const { u, seen, current } = upstream([a]);
    const rules = keptRules(u, () => clock);
    await rules();
    current.pointer = NEW;
    clock = POINTER_TTL_MS;
    for (let i = 0; i < 5; i++) expect(await rules()).toBe(a);
    expect(seen).toEqual({ pointers: 2, pools: 2 });
    clock = 2 * POINTER_TTL_MS;
    await rules();
    expect(seen).toEqual({ pointers: 3, pools: 3 });
  });

  test("requests arriving during a try share it", async () => {
    const { u, seen } = upstream([a]);
    const rules = keptRules(u, () => 0);
    expect(await Promise.all([rules(), rules(), rules()])).toEqual([a, a, a]);
    expect(seen).toEqual({ pointers: 1, pools: 1 });
  });

  test("with no rules had and none to be had, is null", async () => {
    const { u, current } = upstream([]);
    current.pointer = null;
    expect(await keptRules(u, () => 0)()).toBeNull();
    current.pointer = OLD;
    expect(await keptRules(u, () => 0)()).toBeNull();
  });
});
