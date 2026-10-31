import { describe, expect, test } from "bun:test";
import type { IconIndex } from "../../src/app/sheets.ts";
import { SKILL_CARDS } from "../../src/test-support/skillcards.ts";
import { issueBody, keyOf, listKey, marker, needed, summary } from "./check.ts";
import type { Stamps } from "./stamp.ts";

const OFFERED = SKILL_CARDS.cards.filter((c) => c.rarity !== "N" || c.id === "p_card-00-men-0_003");
const ALL = OFFERED.map((c) => `${c.id}:${c.upgrade}`);
const NOW = new Map(ALL.map((cell) => [cell, "aaaaaaaa"]));
const STAMPS: Stamps = { formatVersion: 1, cells: Object.fromEntries(ALL.map((cell) => [cell, { shot: "11111111", fingerprint: "aaaaaaaa" }])) };
const index = (cells: string[]): IconIndex => ({ cell: 112, columns: 10, plans: [{ plan: "sense", cells, sheets: [] }] });
const FANSA = "p_card-01-act-1_001:0";

describe("needed", () => {
  test("is empty while every offered card has a cell whose stamp matches the game", () => {
    expect(needed(SKILL_CARDS, index(ALL), STAMPS, NOW)).toEqual([]);
  });

  test("lists an offered card without a cell as new, with where its screenshot goes", () => {
    const list = needed(SKILL_CARDS, index(ALL.filter((c) => c !== FANSA)), STAMPS, NOW);
    expect(list).toEqual([{ cell: FANSA, name: "ファンサ", folder: "base/R", reason: "new" }]);
  });

  test("lists a card the game changed since its screenshot, or that has no stamp, as changed", () => {
    const now = new Map(NOW).set(FANSA, "bbbbbbbb");
    expect(needed(SKILL_CARDS, index(ALL), STAMPS, now).map((n) => [n.cell, n.reason])).toEqual([[FANSA, "changed"]]);
    const { [FANSA]: _gone, ...rest } = STAMPS.cells;
    expect(needed(SKILL_CARDS, index(ALL), { formatVersion: 1, cells: rest }, NOW).map((n) => n.reason)).toEqual(["changed"]);
  });

  test("never asks for the N cards the page leaves out", () => {
    expect(needed(SKILL_CARDS, index([]), STAMPS, NOW).some((n) => n.folder.endsWith("/N") && n.cell !== "p_card-00-men-0_003:0")).toBe(false);
  });
});

describe("the issue's text", () => {
  const list = [
    { cell: FANSA, name: "ファンサ", folder: "base/R", reason: "new" as const },
    { cell: "p_card-01-act-1_001:1", name: "ファンサ+", folder: "enhanced/R", reason: "changed" as const },
  ];

  test("names each card, its folder and its cell, under new and changed, and carries the list's key", () => {
    const body = issueBody(list);
    expect(body).toContain("## New cards (1)\n\n- ファンサ — `base/R` — `p_card-01-act-1_001:0`");
    expect(body).toContain("## Changed in the game since their screenshot (1)\n\n- ファンサ+ — `enhanced/R`");
    expect(keyOf(body)).toBe(listKey(list));
  });

  test("the key follows the list, not its order", () => {
    expect(listKey([...list].reverse())).toBe(listKey(list));
    expect(listKey(list.slice(1))).not.toBe(listKey(list));
    expect(keyOf(`x ${marker("0123456789ab")} y`)).toBe("0123456789ab");
    expect(keyOf("no marker")).toBeNull();
  });

  test("the summary counts and names the first eight", () => {
    expect(summary(list)).toBe("1 new, 1 changed: ファンサ, ファンサ+");
    const many = Array.from({ length: 10 }, (_, i) => ({ ...list[0], cell: `c${i}`, name: `n${i}`, folder: "base/R", reason: "new" as const }));
    expect(summary(many)).toBe("10 new, 0 changed: n0, n1, n2, n3, n4, n5, n6, n7 and 2 more");
  });
});
