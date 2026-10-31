import { describe, expect, test } from "bun:test";
import { cardNamed, SKILL_CARDS } from "../test-support/skillcards.ts";
import { GUIDE_LABEL_ORDER, OTHER_LABEL, sortRows, sortSection, type CardLookup } from "./sort.ts";
import { emptyMemo, emptyRow, type Memo, type Row } from "./types.ts";

const BY_LEVEL = new Map(SKILL_CARDS.cards.map((c) => [`${c.id}:${c.upgrade}`, c]));
const cardOf: CardLookup = (card, upgrade) => BY_LEVEL.get(`${card}:${upgrade}`);

/** A row of the named fixture card; a name the fixture lacks is an unknown card (D31). */
function row(name: string): Row {
  const card = SKILL_CARDS.cards.find((c) => c.name === name);
  return emptyRow(name, { card: card?.id ?? `p_card-09-act-9_${name}`, upgrade: card?.upgrade ?? 0, customization: [], kaimaku: false, hif: "h" });
}

const names = (rows: readonly Row[]) => rows.map((r) => r.id);
const sorted = (list: string[], key: Parameters<typeof sortRows>[1]) => names(sortRows(list.map(row), key, cardOf));

describe("sortRows", () => {
  test("レアリティ: SSR, SR, R, N, keeping the order within a rarity", () => {
    expect(sorted(["挑戦", "軽い足取り", "成就", "前途洋々", "愛嬌", "バズワード"], "rarity")).toEqual(["成就", "バズワード", "前途洋々", "軽い足取り", "愛嬌", "挑戦"]);
  });

  test("アクティブ/メンタル: active before mental, keeping the order within each", () => {
    expect(sorted(["テレビ出演", "成就", "眼力", "愛嬌"], "type")).toEqual(["成就", "愛嬌", "テレビ出演", "眼力"]);
  });

  test("sorting by type and then by rarity gives rarity order with active first inside each rarity (D15)", () => {
    const once = sortRows(["眼力", "テレビ出演", "前途洋々", "成就", "表現の基本", "挑戦"].map(row), "type", cardOf);
    expect(names(sortRows(once, "rarity", cardOf))).toEqual(["成就", "テレビ出演", "前途洋々", "眼力", "挑戦", "表現の基本"]);
  });

  test("buff type: labels in the game's order, その他 and no label last, in their order (D36)", () => {
    // 軽い足取り スコア; 眼力 集中; テレビ出演 元気; アイドル宣言 その他; 愛嬌 none.
    expect(sorted(["愛嬌", "眼力", "アイドル宣言", "軽い足取り", "テレビ出演"], "buff")).toEqual(["軽い足取り", "テレビ出演", "眼力", "愛嬌", "アイドル宣言"]);
  });

  test("buff type: a card under two labels sorts by its earlier one, never by その他", () => {
    // 叶えたい夢 is 元気 and その他: it sorts as 元気, with テレビ出演, ahead of 眼力's 集中.
    expect(sorted(["眼力", "叶えたい夢", "テレビ出演"], "buff")).toEqual(["叶えたい夢", "テレビ出演", "眼力"]);
    expect(cardNamed("叶えたい夢").guideLabels).toContain(OTHER_LABEL);
  });

  test("buff type: a card's labels count in the game's order, not the order the card lists them", () => {
    // 総合芸術 lists 強気 before スコア; スコア comes first in the game's order, so it sorts ahead of テレビ出演's 元気.
    expect(cardNamed("総合芸術").guideLabels).toEqual(["強気に変更するスキルカード", "スコアを上昇させるスキルカード"]);
    expect(sorted(["テレビ出演", "総合芸術"], "buff")).toEqual(["総合芸術", "テレビ出演"]);
  });

  test("五十音: kana names in the order of the syllabary", () => {
    expect(sorted(["ファンサ", "ハイタッチ", "トークタイム", "エキサイト", "アドリブ"], "name")).toEqual(["アドリブ", "エキサイト", "トークタイム", "ハイタッチ", "ファンサ"]);
  });

  test("looks a card up at its own level: 表現の基本 has no +, and sorts as itself", () => {
    expect(sorted(["表現の基本", "挑戦"], "rarity")).toEqual(["表現の基本", "挑戦"]);
  });

  test("a card the data file does not have sorts last under every key, keeping its order", () => {
    for (const key of ["rarity", "type", "buff", "name"] as const) {
      expect(sorted(["unknown-b", "挑戦", "unknown-a", "成就"], key).slice(2)).toEqual(["unknown-b", "unknown-a"]);
    }
  });

  test("every guide label in the data file is in the game's order or is その他 (D44)", () => {
    const labels = new Set(SKILL_CARDS.cards.flatMap((c) => c.guideLabels));
    expect([...labels].filter((l) => l !== OTHER_LABEL && !GUIDE_LABEL_ORDER.includes(l))).toEqual([]);
  });
});

describe("sortSection", () => {
  test("rearranges only that section, and leaves the memo passed in as it was, as the undo", () => {
    const memo: Memo = { ...emptyMemo(), sections: { ...emptyMemo().sections, "sense.kocho": ["挑戦", "成就"].map(row), "sense.shuchu": ["挑戦", "成就"].map(row) } };
    const before = JSON.stringify(memo);
    const after = sortSection(memo, "sense.kocho", "rarity", cardOf);
    expect([names(after.sections["sense.kocho"]), names(after.sections["sense.shuchu"])]).toEqual([["成就", "挑戦"], ["挑戦", "成就"]]);
    expect(JSON.stringify(memo)).toBe(before);
  });
});
