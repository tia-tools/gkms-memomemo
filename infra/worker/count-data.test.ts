import { describe, expect, test } from "bun:test";
import { cardNamed, SKILL_CARDS } from "../../src/test-support/skillcards.ts";
import type { CountRules } from "./count-event.ts";
import { fetchRules, keptRules, RULES_TTL_MS } from "./count-data.ts";
import { LIBRARY, POINTER } from "../../src/data/library.ts";

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

describe("fetchRules", () => {
  test("reads the library's pool into the rules of its cards", async () => {
    const asked: string[] = [];
    const rules = await fetchRules(async (url) => (asked.push(url), serve(FILES)(url)));
    expect(asked[0]).toBe(`${LIBRARY}/${POINTER}`);
    const event = { section: "sense.kocho" as const, card: JOJU.id, upgrade: 1, hif: HIF, steps: [] };
    expect(rules?.(event)?.length).toBe(3);
  });

  test("is null when a file cannot be fetched, answers an error, is not JSON or breaks its format", async () => {
    const answers: ((url: string) => Promise<Response>)[] = [
      async () => {
        throw new Error("offline");
      },
      serve(FILES, 502),
      serve({ ...FILES, [POINTER]: "{" }),
      serve({ ...FILES, [POINTER]: JSON.stringify({ pointerVersion: 2 }) }),
      serve({ ...FILES, "data/skill-cards/v1/20261127T1126Z-a09c6f2a.json": JSON.stringify({ formatVersion: 1, cards: [], memoryAbilities: [] }) }),
    ];
    for (const answer of answers) expect(await fetchRules(answer)).toBeNull();
  });
});

describe("keptRules", () => {
  const a: CountRules = () => null;
  const b: CountRules = () => [];

  test("loads once, and again only after the hour", async () => {
    let clock = 0;
    let loads = 0;
    const rules = keptRules(async () => (loads++, loads === 1 ? a : b), () => clock);
    expect(await rules()).toBe(a);
    clock = RULES_TTL_MS - 1;
    expect(await rules()).toBe(a);
    expect(loads).toBe(1);
    clock = RULES_TTL_MS;
    expect(await rules()).toBe(b);
    expect(loads).toBe(2);
  });

  test("while a reload fails, keeps the last rules had, and loads again on the next call", async () => {
    let clock = 0;
    let loads = 0;
    const rules = keptRules(async () => (loads++, loads === 1 ? a : null), () => clock);
    await rules();
    clock = RULES_TTL_MS;
    expect(await rules()).toBe(a);
    expect(await rules()).toBe(a);
    expect(loads).toBe(3);
  });

  test("with no rules ever had, a failed load is null, and the next call tries again", async () => {
    let loads = 0;
    const rules = keptRules(async () => (loads++, loads === 1 ? null : a), () => 0);
    expect(await rules()).toBeNull();
    expect(await rules()).toBe(a);
  });
});
