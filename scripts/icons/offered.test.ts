import { describe, expect, test } from "bun:test";
import { N_MEMORY_CARD } from "../../src/app/catalog.ts";
import { parseSkillCardData } from "../../src/data/load.ts";
import fixture from "../../src/data/fixtures/skillcards.v1.json";
import { offeredCards } from "./offered.ts";

const data = parseSkillCardData(fixture);

describe("offeredCards", () => {
  const out = offeredCards(data);

  test("lists the idols in the file's order", () => {
    expect(out.idols).toEqual(data.idols.map((i) => i.id));
  });

  test("lists exactly the cards the page offers, so no N card but 表現の基本", () => {
    expect(out.cards.length).toBe(349);
    expect(out.cards.filter((c) => c.rarity === "N").map((c) => c.id)).toEqual([N_MEMORY_CARD]);
  });

  test("carries what the pipeline needs of each card, the art flattened", () => {
    const first = data.cards.find((c) => c.id === "p_card-01-act-1_001" && c.upgrade === 1);
    expect(out.cards.find((c) => c.id === "p_card-01-act-1_001" && c.upgrade === 1)).toEqual({
      id: "p_card-01-act-1_001",
      upgrade: 1,
      name: first?.name ?? "",
      plan: "sense",
      rarity: "R",
      type: "active",
      order: first?.order ?? "",
      asset: "img_general_skillcard_act-1_001",
      perIdol: false,
    });
  });
});
