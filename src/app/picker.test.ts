import { describe, expect, test } from "bun:test";
import { byRarity, fold, search, toggled } from "./picker.ts";

const NAMES = ["ファンサ", "ファンサ+", "成就+", "アイドル宣言", "表現の基本"];
const find = (query: string) => search(NAMES, query, (n) => n);

describe("search", () => {
  test("finds names containing the query, in their order", () => {
    expect(find("ファンサ")).toEqual(["ファンサ", "ファンサ+"]);
    expect(find("成就")).toEqual(["成就+"]);
  });

  test("hiragana finds katakana and the other way round", () => {
    expect(find("ふぁんさ")).toEqual(["ファンサ", "ファンサ+"]);
    expect(search(["ひと呼吸"], "ヒト", (n) => n)).toEqual(["ひと呼吸"]);
  });

  test("a full-width + finds the + card, and surrounding spaces are ignored", () => {
    expect(find("ファンサ＋")).toEqual(["ファンサ+"]);
    expect(find("  成就 ")).toEqual(["成就+"]);
  });

  test("a blank query keeps every entry; a query nothing contains keeps none", () => {
    expect(find("")).toEqual(NAMES);
    expect(find("   ")).toEqual(NAMES);
    expect(find("存在しない")).toEqual([]);
  });

  test("the long vowel mark and ヴ stay as they are", () => {
    expect(fold("ー")).toBe("ー");
    expect(fold("ヴ")).toBe("ゔ");
    expect(fold("Ａｂ")).toBe("ab");
  });
});

describe("byRarity", () => {
  const cards = [
    { name: "成就+", rarity: "SSR" },
    { name: "前途洋々+", rarity: "SR" },
    { name: "ファンサ+", rarity: "R" },
    { name: "表現の基本", rarity: "N" },
    { name: "コール＆レスポンス+", rarity: "SSR" },
  ] as const;
  const names = (on: ReadonlySet<"N" | "R" | "SR" | "SSR">) => byRarity(cards, on).map((c) => c.name);

  test("keeps the cards of the rarities that are on, in their order", () => {
    expect(names(new Set(["SSR"]))).toEqual(["成就+", "コール＆レスポンス+"]);
    expect(names(new Set(["R", "SSR"]))).toEqual(["成就+", "ファンサ+", "コール＆レスポンス+"]);
  });

  test("with no rarity on, the filter is off and keeps every card", () => {
    expect(names(new Set())).toEqual(cards.map((c) => c.name));
  });

  test("with every rarity on, it keeps every card too", () => {
    expect(names(new Set(["SSR", "SR", "R", "N"]))).toEqual(cards.map((c) => c.name));
  });
});

describe("toggled", () => {
  test("adds a value that is off and removes one that is on, leaving the set given as it was", () => {
    const off = new Set(["SSR"]);
    expect([...toggled(off, "SR")]).toEqual(["SSR", "SR"]);
    expect([...toggled(off, "SSR")]).toEqual([]);
    expect([...off]).toEqual(["SSR"]);
  });
});
