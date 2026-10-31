import { describe, expect, test } from "bun:test";
import { PLAN_IDS } from "../memo/types.ts";
import { cardNamed, kindLabelled, SKILL_CARDS } from "../test-support/skillcards.ts";
import { customizationTexts, makeCatalog, stepText } from "./catalog.ts";

const CATALOG = makeCatalog(SKILL_CARDS);

function kindOf(cardName: string, label: string) {
  const card = cardNamed(cardName);
  const id = kindLabelled(card, label);
  const kind = card.customization.kinds.find((k) => k.id === id);
  if (kind === undefined) throw new Error("no kind");
  return { card, kind };
}

describe("makeCatalog", () => {
  test("finds a card by id and level, base and + apart", () => {
    const plus = cardNamed("成就+");
    expect(CATALOG.card(plus.id, 1)?.name).toBe("成就+");
    expect(CATALOG.card(plus.id, 0)?.name).toBe("成就");
    expect(CATALOG.card(plus.id, 2)).toBeUndefined();
    expect(CATALOG.card("p_card-09-act-9_999", 0)).toBeUndefined();
  });

  test("a tab offers its plan's cards, then the free ones, in the game's order", () => {
    const cards = CATALOG.tabCards("sense");
    const firstFree = cards.findIndex((c) => c.plan === "free");
    expect(cards.length).toBe(112 + 19);
    expect(cards.slice(0, firstFree).every((c) => c.plan === "sense")).toBe(true);
    expect(cards.slice(firstFree).every((c) => c.plan === "free")).toBe(true);
    expect(cards[firstFree]?.name).toBe("表現の基本");
    const order = cards.slice(0, firstFree).map((c) => SKILL_CARDS.cards.indexOf(c));
    expect(order).toEqual(order.toSorted((a, b) => a - b));
  });

  test("no tab offers an N card but 表現の基本: the others cannot be a produce memory (D54)", () => {
    const offeredN = PLAN_IDS.flatMap((plan) => CATALOG.tabCards(plan))
      .filter((c) => c.rarity === "N")
      .map((c) => `${c.name}:${c.upgrade}`);
    expect([...new Set(offeredN)]).toEqual(["表現の基本:0"]);
    expect(CATALOG.card(cardNamed("挑戦+").id, 1)?.name).toBe("挑戦+");
  });

  test("a tab offers the H.I.F. abilities of its plan's cards only, with their base card", () => {
    const counts = { sense: 40, logic: 38, anomaly: 37 } as const;
    for (const plan of ["sense", "logic", "anomaly"] as const) {
      const abilities = CATALOG.tabAbilities(plan);
      expect(abilities.length).toBe(counts[plan]);
      expect(abilities.every((h) => h.card.plan === plan && h.card.upgrade === 0)).toBe(true);
    }
  });

  test("abilities come in their cards' game order", () => {
    const places = CATALOG.tabAbilities("logic").map((h) => SKILL_CARDS.cards.indexOf(h.card));
    expect(places).toEqual(places.toSorted((a, b) => a - b));
  });

  test("an ability is found by id with its card's name, and an unknown id is undefined", () => {
    const first = SKILL_CARDS.hifAbilities[0];
    expect(first === undefined ? undefined : CATALOG.hif(first.id)?.card.name).toBe("ひと呼吸");
    expect(CATALOG.hif("memory_ability-nothing")).toBeUndefined();
  });

  test("an ability whose card the file lacks is neither found nor offered", () => {
    const orphan = { id: "memory_ability-orphan", card: "p_card-01-act-9_999" };
    const catalog = makeCatalog({ ...SKILL_CARDS, hifAbilities: [...SKILL_CARDS.hifAbilities, orphan] });
    expect(catalog.hif(orphan.id)).toBeUndefined();
    expect(catalog.tabAbilities("sense").length).toBe(40);
  });
});

describe("stepText", () => {
  test("a generic label ending in + carries its step, one step or several", () => {
    const { kind } = kindOf("ファンサ+", "パラメータ+");
    expect([1, 2, 3].map((s) => stepText(kind, s))).toEqual(["パラメータ+1", "パラメータ+2", "パラメータ+3"]);
    expect(stepText(kindOf("成就+", "好調+").kind, 1)).toBe("好調+1");
  });

  test("a label ending in - carries its step too", () => {
    expect(stepText(kindOf("成就+", "コスト値-").kind, 1)).toBe("コスト値-1");
  });

  test("a step's own description is written as it is", () => {
    expect(stepText(kindOf("ファンサ+", "好調追加").kind, 1)).toBe("好調追加");
    const { kind } = kindOf("巻き返し+", "成長追加");
    expect([1, 2].map((s) => stepText(kind, s))).toEqual(["成長追加", "成長+2"]);
  });

  test("the game's line break is taken out", () => {
    expect(stepText(kindOf("準備運動+", "パラメータ\n上昇回数+").kind, 1)).toBe("パラメータ上昇回数+1");
  });
});

describe("customizationTexts", () => {
  test("lists the chosen steps in the card's kind order, whatever order they were chosen in", () => {
    const card = cardNamed("ファンサ+");
    const chosen = [
      { kind: kindLabelled(card, "パラメータ+"), step: 1 },
      { kind: kindLabelled(card, "好調追加"), step: 1 },
    ];
    expect(customizationTexts(card, chosen)).toEqual(["好調追加", "パラメータ+1"]);
  });

  test("no customization is no label", () => {
    expect(customizationTexts(cardNamed("ファンサ+"), [])).toEqual([]);
  });

  test("a kind or step the card lacks, or an unknown card, reads 不明 rather than disappearing", () => {
    const card = cardNamed("ファンサ+");
    expect(customizationTexts(card, [{ kind: "p_card_custom-gone", step: 1 }])).toEqual(["不明"]);
    expect(customizationTexts(card, [{ kind: kindLabelled(card, "好調追加"), step: 2 }])).toEqual(["不明"]);
    expect(customizationTexts(undefined, [{ kind: "p_card_custom-x", step: 1 }])).toEqual(["不明"]);
  });
});
