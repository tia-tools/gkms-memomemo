import { describe, expect, test } from "bun:test";
import { fold, search } from "./picker.ts";

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
