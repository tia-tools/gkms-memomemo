import { describe, expect, test } from "bun:test";
import { cardNamed, SKILL_CARDS } from "../../src/test-support/skillcards.ts";
import type { CountRules } from "./count-event.ts";
import { fetchRules, keptRules, RULES_TTL_MS } from "./count-data.ts";
import { SKILLCARDS_SOURCE } from "./data.ts";

const FILE = await Bun.file(new URL("../../src/data/fixtures/skillcards.v1.json", import.meta.url)).text();
const JOJU = cardNamed("成就+");
const HIF = SKILL_CARDS.hifAbilities.find((h) => SKILL_CARDS.cards.find((c) => c.id === h.card)?.plan === "sense")?.id ?? "";

describe("fetchRules", () => {
  test("reads the sibling's file into the rules of its cards", async () => {
    const asked: string[] = [];
    const rules = await fetchRules(async (url) => (asked.push(url), new Response(FILE)));
    expect(asked).toEqual([SKILLCARDS_SOURCE]);
    const event = { section: "sense.kocho" as const, card: JOJU.id, upgrade: 1, hif: HIF, steps: [] };
    expect(rules?.(event)?.length).toBe(3);
  });

  test("is null when the file cannot be fetched, answers an error, is not JSON or breaks the contract", async () => {
    const answers: (() => Promise<Response>)[] = [
      async () => {
        throw new Error("offline");
      },
      async () => new Response(FILE, { status: 502 }),
      async () => new Response("{"),
      async () => new Response(JSON.stringify({ formatVersion: 2 })),
      async () => new Response(JSON.stringify({ ...JSON.parse(FILE), cards: [] })),
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
