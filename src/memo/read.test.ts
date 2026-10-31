import { describe, expect, test } from "bun:test";
import { addExtraGroup, addMemory, addRow, type Edited, isRefusal } from "./edit.ts";
import { MemoFormatError, readMemo } from "./read.ts";
import { type Build, emptyMemo, type Memo } from "./types.ts";

const KIND = "p_card_custom-070-g_effect-effect_add-e_effect-exam_parameter_buff-02";
const HIF = "memory_ability-p_memory_skill-common-hatsuboshi_idol_festival-p_trigger-start_audition-for_hif_memory-exam_status_enchant-exam_turn_timer-exam_status_enchant-01-001-001";

function build(card: string, overrides: Partial<Build> = {}): Build {
  return { card, upgrade: 1, customization: [{ kind: KIND, step: 1 }], kaimaku: false, hif: HIF, ...overrides };
}

function ok(result: Edited): Memo {
  if (isRefusal(result)) throw new Error(`refused: ${JSON.stringify(result)}`);
  return result;
}

/** A memo with memories in a fixed and an extra group, in two tabs. */
function memo(): Memo {
  let m = ok(addRow(emptyMemo(), "sense.kocho", "r1", build("p_card-01-act-3_029")));
  m = addMemory(m, "r1", "%%F", ["diamond", "diamond", "rainbow"]);
  m = ok(addExtraGroup(m, "r1", "%%%", ["rainbow", "rainbow", "diamond"]));
  return ok(addRow(m, "logic.common", "r2", build("p_card-00-men-0_003", { upgrade: 0, customization: [], kaimaku: true })));
}

/** The memo as JSON-parsed data, loose enough for a test to break. */
function json(): Record<string, unknown> & { sections: Record<string, Record<string, unknown>[]> } {
  return JSON.parse(JSON.stringify(memo()));
}

const firstRow = (data: ReturnType<typeof json>): Record<string, unknown> & { build: Record<string, unknown> } => {
  const row = data.sections["sense.kocho"]?.[0];
  if (row === undefined) throw new Error("no first row");
  return JSON.parse(JSON.stringify(row));
};

/** `data` with the first row of 好調 replaced by `row`. */
function withFirstRow(data: ReturnType<typeof json>, row: unknown): unknown {
  return { ...data, sections: { ...data.sections, "sense.kocho": [row] } };
}

describe("readMemo, a memo the page made", () => {
  test("reads back exactly what was written", () => {
    expect(readMemo(json())).toStrictEqual(memo());
  });

  test("keeps well-formed ids the data file may not have (D31)", () => {
    const row = firstRow(json());
    row.build = { ...row.build, card: "p_card-09-act-9_999", hif: "memory_ability-not-yet-released" };
    expect(readMemo(withFirstRow(json(), row)).sections["sense.kocho"][0]?.build.card).toBe("p_card-09-act-9_999");
  });

  test("drops a field the memo does not name", () => {
    const row = firstRow(json());
    row["note"] = "x";
    expect(Object.keys(readMemo(withFirstRow(json(), row)).sections["sense.kocho"][0] ?? {})).toEqual(["id", "build", "fixed", "extras"]);
  });
});

describe("readMemo, refusals", () => {
  test("refuses what is not this memo format, naming why", () => {
    expect(() => readMemo(null)).toThrow("the memo: expected an object");
    expect(() => readMemo({ ...json(), formatVersion: 2 })).toThrow("formatVersion: expected 1, not 2");
    expect(() => readMemo({ ...json(), scenario: "nia" })).toThrow('scenario: expected "hif"');
  });

  test("refuses a missing section and a section of another name, rather than dropping its rows", () => {
    const missing = json();
    delete missing.sections["anomaly.common"];
    expect(() => readMemo(missing)).toThrow("sections.anomaly.common: expected an array");
    const extra = json();
    extra.sections["sense.other"] = [];
    expect(() => readMemo(extra)).toThrow("sections.sense.other: expected no section of that name");
  });

  test("refuses ids that do not have the game's shape", () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ card: "p_card-01-act-3_029; drop" }, "build.card: expected a skill card id"],
      [{ hif: "ability-x" }, "build.hif: expected an H.I.F. ability id"],
      [{ customization: [{ kind: "p_card_custom-<x>", step: 1 }] }, "build.customization[0].kind: expected a customization id"],
    ];
    for (const [change, message] of cases) {
      const row = firstRow(json());
      row.build = { ...row.build, ...change };
      expect(() => readMemo(withFirstRow(json(), row))).toThrow(`sections.sense.kocho[0].${message}`);
    }
    const row = firstRow(json());
    row["id"] = "r 1";
    expect(() => readMemo(withFirstRow(json(), row))).toThrow("sections.sense.kocho[0].id: expected a row id");
  });

  test("refuses a level other than base or +, a step out of range and a 開幕時獲得 that is not true or false", () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ upgrade: 2 }, "build.upgrade: expected 0 to 1"],
      [{ customization: [{ kind: KIND, step: 0 }] }, "build.customization[0].step: expected 1 to 9"],
      [{ kaimaku: "yes" }, "build.kaimaku: expected true or false"],
    ];
    for (const [change, message] of cases) {
      const row = firstRow(json());
      row.build = { ...row.build, ...change };
      expect(() => readMemo(withFirstRow(json(), row))).toThrow(`sections.sense.kocho[0].${message}`);
    }
  });

  test("refuses a memory that is not three tiers", () => {
    for (const bad of [["diamond", "diamond"], ["diamond", "diamond", "gold"], ["diamond", "diamond", "rainbow", "rainbow"]]) {
      const row = firstRow(json());
      row["fixed"] = { "%%F": [bad], "%F%": [], "F%%": [] };
      expect(() => readMemo(withFirstRow(json(), row))).toThrow(/^sections\.sense\.kocho\[0\]\.fixed\.%%F\[0\]/);
    }
  });

  test("refuses extra groups the edits never make: a fixed pattern, a repeat, a third", () => {
    const group = (pattern: string, memories = [["diamond", "diamond", "diamond"]]) => ({ pattern, memories });
    const cases: [unknown[], string][] = [
      [[group("%%F")], "extras[0].pattern: expected %%% | FFF"],
      [[group("FFF"), group("FFF")], "extras: expected distinct patterns"],
      [[group("FFF"), group("%%%"), group("%FF")], "extras: expected at most 2 extra groups"],
    ];
    for (const [extras, message] of cases) {
      const row = firstRow(json());
      row["extras"] = extras;
      expect(() => readMemo(withFirstRow(json(), row))).toThrow(`sections.sense.kocho[0].${message}`);
    }
  });

  test("keeps an extra group with no memory: it stays, as 未所持, until removed by hand (D27)", () => {
    const row = firstRow(json());
    row["extras"] = [{ pattern: "FFF", memories: [] }];
    const memo = readMemo(withFirstRow(json(), row));
    expect(memo.sections["sense.kocho"][0]?.extras).toEqual([{ pattern: "FFF", memories: [] }]);
  });

  test("refuses two rows with one id, and one build twice in a tab, but not across tabs", () => {
    const sameId = json();
    const r1 = firstRow(sameId);
    sameId.sections["sense.shuchu"] = [{ ...r1, build: { ...r1.build, card: "p_card-01-act-1_002" } }];
    expect(() => readMemo(sameId)).toThrow("sections.sense.shuchu[0].id: expected an id no other row has");
    const sameBuild = json();
    sameBuild.sections["sense.common"] = [{ ...firstRow(sameBuild), id: "r9" }];
    expect(() => readMemo(sameBuild)).toThrow("sections.sense.common[0].build: expected a build not already in the tab");
    const otherTab = json();
    otherTab.sections["anomaly.common"] = [{ ...firstRow(otherTab), id: "r9" }];
    expect(readMemo(otherTab).sections["anomaly.common"].length).toBe(1);
  });

  test("every refusal is a MemoFormatError", () => {
    expect(() => readMemo({ ...json(), sections: 1 })).toThrow(MemoFormatError);
  });
});
