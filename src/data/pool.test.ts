import { describe, expect, test } from "bun:test";
import { parse as parseIdols } from "./formats/idols.v1.ts";
import { parse as parseSkillCards, type SkillCard, type SkillCardsFile } from "./formats/skill-cards.v1.ts";
import { HIF_GROUP, inPool, pool, PoolError } from "./pool.ts";

const fixture = async (name: string): Promise<unknown> => JSON.parse(await Bun.file(new URL(`fixtures/${name}`, import.meta.url)).text());

/** The library's releases of 2026-11-27, and gakumas-supportcards' pool file fetched the same minute. */
const SKILL_CARDS = parseSkillCards(await fixture("skill-cards.v1.20261127T1126Z-a09c6f2a.json"));
const IDOLS = parseIdols(await fixture("idols.v1.20261116T1124Z-5122c626.json"));
const SUPPORTCARDS = await fixture("supportcards-skillcards.20261127.json");

/** The library's row of this card at this level, or a failed test. */
function row(id: string, upgrade: number): SkillCard {
  const card = SKILL_CARDS.cards.find((c) => c.id === id && c.upgrade === upgrade);
  if (card === undefined) throw new Error(`the fixture has no ${id} at level ${upgrade}`);
  return card;
}

/** 成就 (a plain SSR card of the pool), at level 0. */
const PLAIN = row("p_card-01-act-3_029", 0);

describe("pool, the real files", () => {
  test("is exactly the pool gakumas-supportcards published the same day: 361 cards, 115 abilities, 14 idols, in order", () => {
    const cut = pool(SKILL_CARDS, IDOLS);
    expect(SUPPORTCARDS).toStrictEqual({ formatVersion: 1, ...cut });
    expect([cut.cards.length, cut.hifAbilities.length, cut.idols.length]).toEqual([361, 115, 14]);
  });
});

describe("inPool, one clause at a time", () => {
  test("a plain card is in at levels 0 and 1, and out from level 2", () => {
    expect([inPool(PLAIN), inPool({ ...PLAIN, upgrade: 1 }), inPool({ ...PLAIN, upgrade: 2 })]).toEqual([true, true, false]);
  });

  test("a card unique to one P-idol is out", () => {
    expect(inPool({ ...PLAIN, origin: { ...PLAIN.origin, tag: "idolUnique" } })).toBe(false);
  });

  test("a card a support card's event gives is out", () => {
    expect(inPool({ ...PLAIN, origin: { ...PLAIN.origin, supportCard: "s_card-x" } })).toBe(false);
  });

  test("a starter is out, but for level 0 of 表現の基本", () => {
    const starter = { ...PLAIN, origin: { ...PLAIN.origin, tag: "starter" as const } };
    const basic = row("p_card-00-men-0_003", 0);
    expect([inPool(starter), inPool(basic), inPool({ ...basic, upgrade: 1 })]).toEqual([false, true, false]);
  });

  test("a trouble card and a Legend card are out", () => {
    expect([inPool({ ...PLAIN, type: "trouble" }), inPool({ ...PLAIN, rarity: "Legend" })]).toEqual([false, false]);
  });
});

describe("pool, the abilities and the refusal", () => {
  const file = (cards: readonly SkillCard[], memoryAbilities: SkillCardsFile["memoryAbilities"]): SkillCardsFile => ({ formatVersion: 1, cards: [...cards], memoryAbilities });

  test("keeps an ability of the H.I.F. group whose card is in the pool, and no other", () => {
    /** アピールの基本, a starter: out of the pool. */
    const out = row("p_card-00-act-0_001", 0);
    const abilities = [
      { id: "kept", groups: ["produce_group-001", HIF_GROUP], card: PLAIN.id },
      { id: "other-scenario", groups: ["produce_group-001"], card: PLAIN.id },
      { id: "no-card", groups: [HIF_GROUP] },
      { id: "card-not-in-pool", groups: [HIF_GROUP], card: "p_card-unknown" },
      { id: "card-out-of-pool", groups: [HIF_GROUP], card: out.id },
    ];
    expect(pool(file([PLAIN, out], abilities), IDOLS).hifAbilities).toEqual([{ id: "kept", card: PLAIN.id }]);
  });

  test("drops `origin` and keeps every other field of a card", () => {
    const { origin: _origin, ...rest } = PLAIN;
    const cards: unknown = pool(file([PLAIN], []), IDOLS).cards;
    expect(cards).toStrictEqual([rest]);
  });

  test("refuses files that leave no card", () => {
    expect(() => pool(file([{ ...PLAIN, rarity: "Legend" }], []), IDOLS)).toThrow(PoolError);
  });
});
