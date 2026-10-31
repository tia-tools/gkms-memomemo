import { describe, expect, test } from "bun:test";
import {
  addExtraGroup,
  addMemory,
  addRow,
  changeBuild,
  changeMemory,
  deleteMemory,
  deleteRow,
  type Edited,
  findRow,
  isRefusal,
  MemoEditError,
  moveRow,
  reorderRow,
} from "./edit.ts";
import { type Build, emptyMemo, type Memo, type Memory } from "./types.ts";

const DDR: Memory = ["diamond", "diamond", "rainbow"];
const RRR: Memory = ["rainbow", "rainbow", "rainbow"];
const DDD: Memory = ["diamond", "diamond", "diamond"];

function build(card: string, overrides: Partial<Build> = {}): Build {
  return { card, upgrade: 1, customization: [], kaimaku: false, hif: "memory_ability-a", ...overrides };
}

/** The edit's memo, or a failed test when it was refused. */
function ok(result: Edited): Memo {
  if (isRefusal(result)) throw new Error(`refused: ${JSON.stringify(result)}`);
  return result;
}

/** A memo with rows r1 and r2 in 好調 and r3 in 集中, all センス. */
function memo(): Memo {
  let m = ok(addRow(emptyMemo(), "sense.kocho", "r1", build("p_card-01-act-3_029")));
  m = ok(addRow(m, "sense.kocho", "r2", build("p_card-01-act-1_002")));
  return ok(addRow(m, "sense.shuchu", "r3", build("p_card-01-act-1_022")));
}

const ids = (m: Memo, section: keyof Memo["sections"]) => m.sections[section].map((r) => r.id);

describe("rows", () => {
  test("a new row goes to the end of its section with no memories", () => {
    const m = memo();
    expect(ids(m, "sense.kocho")).toEqual(["r1", "r2"]);
    expect(findRow(m, "r2")?.row.fixed).toEqual({ "%%F": [], "%F%": [], "F%%": [] });
  });

  test("a build already in the tab is refused, naming the section that holds it", () => {
    expect(addRow(memo(), "sense.common", "r9", build("p_card-01-act-1_022"))).toEqual({ refused: "duplicate", section: "sense.shuchu" });
  });

  test("the same card with another customization, 開幕時獲得 or H.I.F. ability is another build", () => {
    const m = memo();
    for (const other of [{ customization: [{ kind: "k", step: 1 }] }, { kaimaku: true }, { hif: "memory_ability-b" }]) {
      expect(isRefusal(addRow(m, "sense.kocho", "r9", build("p_card-01-act-3_029", other)))).toBe(false);
    }
  });

  test("the same build in another tab is allowed: a build is unique per tab", () => {
    expect(ids(ok(addRow(memo(), "logic.common", "r9", build("p_card-01-act-3_029"))), "logic.common")).toEqual(["r9"]);
  });

  test("changing a build keeps the row's memories and place, and refuses a build held elsewhere in the tab", () => {
    const m = addMemory(memo(), "r1", "%%F", DDR);
    const changed = ok(changeBuild(m, "r1", build("p_card-01-act-3_029", { kaimaku: true })));
    expect(ids(changed, "sense.kocho")).toEqual(["r1", "r2"]);
    expect(findRow(changed, "r1")?.row).toMatchObject({ build: { kaimaku: true }, fixed: { "%%F": [DDR] } });
    expect(changeBuild(m, "r1", build("p_card-01-act-1_022"))).toEqual({ refused: "duplicate", section: "sense.shuchu" });
  });

  test("changing a row to its own build is not a duplicate", () => {
    expect(isRefusal(changeBuild(memo(), "r1", build("p_card-01-act-3_029")))).toBe(false);
  });

  test("a row moves to the end of another section of its tab, and not to another tab", () => {
    const moved = ok(moveRow(memo(), "r1", "sense.shuchu"));
    expect([ids(moved, "sense.kocho"), ids(moved, "sense.shuchu")]).toEqual([["r2"], ["r3", "r1"]]);
    expect(moveRow(memo(), "r1", "logic.common")).toEqual({ refused: "other-tab" });
  });

  test("dragging reorders a section, an index past either end meaning that end", () => {
    expect(ids(reorderRow(memo(), "r2", 0), "sense.kocho")).toEqual(["r2", "r1"]);
    expect(ids(reorderRow(memo(), "r1", 9), "sense.kocho")).toEqual(["r2", "r1"]);
    expect(ids(reorderRow(memo(), "r2", -3), "sense.kocho")).toEqual(["r2", "r1"]);
    expect(ids(reorderRow(memo(), "r1", 0), "sense.kocho")).toEqual(["r1", "r2"]);
    const three = ok(addRow(memo(), "sense.kocho", "r4", build("p_card-01-act-1_020")));
    expect(ids(reorderRow(three, "r4", -1), "sense.kocho")).toEqual(["r4", "r1", "r2"]);
    expect(ids(reorderRow(three, "r1", 1), "sense.kocho")).toEqual(["r2", "r1", "r4"]);
  });

  test("deleting a row takes its memories with it", () => {
    const m = deleteRow(addMemory(memo(), "r1", "%%F", DDR), "r1");
    expect([ids(m, "sense.kocho"), findRow(m, "r1")]).toEqual([["r2"], null]);
  });

  test("an edit naming a row the memo does not have throws", () => {
    expect(() => deleteRow(memo(), "nope")).toThrow(MemoEditError);
    expect(() => moveRow(memo(), "nope", "sense.common")).toThrow(MemoEditError);
  });

  test("the memo passed in is never changed", () => {
    const m = memo();
    const before = JSON.stringify(m);
    addMemory(m, "r1", "%%F", DDR);
    deleteRow(m, "r2");
    reorderRow(m, "r2", 0);
    moveRow(m, "r3", "sense.common");
    expect(JSON.stringify(m)).toBe(before);
  });
});

describe("memories", () => {
  test("memories of one pattern stack in the order entered, identical ones included (D4)", () => {
    const m = addMemory(addMemory(addMemory(memo(), "r1", "F%%", DDR), "r1", "F%%", RRR), "r1", "F%%", DDR);
    expect(findRow(m, "r1")?.row.fixed["F%%"]).toEqual([DDR, RRR, DDR]);
  });

  test("a memory is changed in place and deleted from its place", () => {
    const m = addMemory(addMemory(memo(), "r1", "%F%", DDR), "r1", "%F%", RRR);
    expect(findRow(changeMemory(m, "r1", "%F%", 0, DDD), "r1")?.row.fixed["%F%"]).toEqual([DDD, RRR]);
    expect(findRow(changeMemory(m, "r1", "%F%", 1, DDD), "r1")?.row.fixed["%F%"]).toEqual([DDR, DDD]);
    expect(findRow(deleteMemory(m, "r1", "%F%", 0), "r1")?.row.fixed["%F%"]).toEqual([RRR]);
    expect(findRow(deleteMemory(m, "r1", "%F%", 1), "r1")?.row.fixed["%F%"]).toEqual([DDR]);
  });

  test("a fixed group left with no memory stays, as 未所持", () => {
    const m = deleteMemory(addMemory(memo(), "r1", "%%F", DDR), "r1", "%%F", 0);
    expect(findRow(m, "r1")?.row.fixed["%%F"]).toEqual([]);
  });

  test("an index that is not a memory of the group throws", () => {
    const m = addMemory(memo(), "r1", "%%F", DDR);
    for (const index of [1, -1, 0.5]) expect(() => deleteMemory(m, "r1", "%%F", index)).toThrow(MemoEditError);
    expect(() => changeMemory(m, "r1", "%F%", 0, DDR)).toThrow(MemoEditError);
  });
});

describe("extra groups", () => {
  test("an extra group starts with its first memory, and takes more", () => {
    const m = addMemory(ok(addExtraGroup(memo(), "r1", "%%%", DDD)), "r1", "%%%", RRR);
    expect(findRow(m, "r1")?.row.extras).toEqual([{ pattern: "%%%", memories: [DDD, RRR] }]);
  });

  test("a pattern the row already has is refused, and a third extra group is refused", () => {
    const one = ok(addExtraGroup(memo(), "r1", "%%%", DDD));
    expect(addExtraGroup(one, "r1", "%%%", RRR)).toEqual({ refused: "pattern-in-row" });
    const two = ok(addExtraGroup(one, "r1", "FFF", DDD));
    expect(addExtraGroup(two, "r1", "%FF", DDD)).toEqual({ refused: "extras-full" });
  });

  test("an extra group goes when its last memory does (D27), and its slot is free again", () => {
    const two = ok(addExtraGroup(ok(addExtraGroup(memo(), "r1", "%%%", DDD)), "r1", "FFF", RRR));
    const one = deleteMemory(two, "r1", "%%%", 0);
    expect(findRow(one, "r1")?.row.extras).toEqual([{ pattern: "FFF", memories: [RRR] }]);
    expect(isRefusal(addExtraGroup(one, "r1", "%FF", DDD))).toBe(false);
  });

  test("a memory added to an extra group the row does not have throws", () => {
    expect(() => addMemory(memo(), "r1", "FFF", DDD)).toThrow(MemoEditError);
  });
});
