import { describe, expect, test } from "bun:test";
import { emptyMemo, emptyRow, type Memo } from "../memo/types.ts";
import { type Shown, takeable } from "./useSaving.ts";

function withRow(id: string): Memo {
  const row = emptyRow(id, { card: "p_card-01-act-3_029", upgrade: 1, customization: [], kaimaku: false, hif: "memory_ability-x" });
  return { ...emptyMemo(), sections: { ...emptyMemo().sections, "sense.kocho": [row] } };
}

const BEFORE: Shown = { memo: emptyMemo(), idol: "hski", counting: true };
const FOUND = { memo: withRow("theirs"), settings: { idol: "ttmr", counting: false } };

describe("takeable (#29)", () => {
  test("what another tab saved is taken when the page did not change meanwhile", () => {
    expect(takeable(FOUND, BEFORE, BEFORE)).toEqual(FOUND);
  });

  test("a memo changed while the store was read keeps the change; the settings are still taken", () => {
    expect(takeable(FOUND, BEFORE, { ...BEFORE, memo: withRow("mine") })).toEqual({ settings: FOUND.settings });
  });

  test("an idol or a counting switch changed meanwhile keeps the settings; the memo is still taken", () => {
    expect(takeable(FOUND, BEFORE, { ...BEFORE, idol: "ttmr" })).toEqual({ memo: FOUND.memo });
    expect(takeable(FOUND, BEFORE, { ...BEFORE, counting: false })).toEqual({ memo: FOUND.memo });
  });

  test("nothing found is nothing taken", () => {
    expect(takeable({}, BEFORE, BEFORE)).toEqual({});
  });
});
