import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { render } from "preact";
import { useState } from "preact/hooks";
import { act } from "preact/test-utils";
import { emptyMemo, emptyRow, type Memo } from "../memo/types.ts";
import { NOT_SAVING, type Reread, type Saving } from "./storage.ts";
import { type Shown, takeable, useSaving } from "./useSaving.ts";

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

/** A Saving whose rereads wait for the test, which also plays the other tab's messages. */
function heldRereads(): Saving & { asked: ((found: Reread) => void)[]; hear: () => void; memos: Memo[] } {
  let heard = (): void => undefined;
  const asked: ((found: Reread) => void)[] = [];
  const memos: Memo[] = [];
  const saving = {
    ...NOT_SAVING,
    asked,
    memos,
    hear: () => heard(),
    memo: (memo: Memo) => void saving.memos.push(memo),
    reread: () => new Promise<Reread>((resolve) => void saving.asked.push(resolve)),
    listen: (on: () => void) => {
      heard = on;
      return () => undefined;
    },
  };
  return saving;
}

describe("useSaving's rereads (#29)", () => {
  beforeAll(() => GlobalRegistrator.register());
  afterAll(() => GlobalRegistrator.unregister());
  const turn = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

  test("a reread queued behind another takes the newer memo once the first has been taken, and writes neither back", async () => {
    const save = heldRereads();
    let shown: Memo = emptyMemo();
    function Page() {
      const [memo, setMemo] = useState<Memo>(emptyMemo());
      shown = memo;
      useSaving(save, { memo, idol: "hski", counting: true }, { setMemo, setIdol: () => undefined, setCounting: () => undefined, idolFor: () => "hski" });
      return null;
    }
    const root = document.body.appendChild(document.createElement("div"));
    await act(() => render(<Page />, root));
    // Once listening, the page rereads for a write it could not have heard of.
    expect(save.asked.length).toBe(1);
    save.asked[0]?.({});
    // The other tab saves twice; each message asks for a reread.
    save.hear();
    save.hear();
    await turn();
    expect(save.asked.length).toBe(2);
    save.asked[1]?.({ memo: withRow("first") });
    await turn();
    expect(save.asked.length).toBe(3);
    save.asked[2]?.({ memo: withRow("second") });
    await turn();
    expect(shown).toEqual(withRow("second"));
    expect(save.memos).toEqual([]);
    await act(() => render(null, root));
  });
});
