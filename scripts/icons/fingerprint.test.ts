import { describe, expect, test } from "bun:test";
import { canonical, fingerprint, fingerprints, NOT_DRAWN } from "./fingerprint.ts";

const row = { id: "p_card-01-act-1_001", upgradeCount: 1, name: "ファンサ+", stamina: 2, playEffects: [{ produceExamEffectId: "e_effect-exam_lesson-0010-01" }] };

describe("fingerprint", () => {
  test("is the same whatever order the keys come in", () => {
    expect(canonical({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe('{"a":{"c":[3,{"e":5,"f":4}],"d":2},"b":1}');
    expect(fingerprint({ stamina: 2, id: row.id, playEffects: row.playEffects, upgradeCount: 1, name: "x" })).toBe(fingerprint(row));
  });

  test("changes with anything drawn on the icon", () => {
    expect(fingerprint({ ...row, stamina: 3 })).not.toBe(fingerprint(row));
    expect(fingerprint({ ...row, playEffects: [{ produceExamEffectId: "e_effect-exam_lesson-0012-01" }] })).not.toBe(fingerprint(row));
    expect(fingerprint({ ...row, aFieldTheGameAddsLater: true })).not.toBe(fingerprint(row));
  });

  test("ignores what the icon never shows", () => {
    expect(NOT_DRAWN).toContain("name");
    expect(fingerprint({ ...row, name: "改名", viewStartTime: "1778896800000", order: "9" })).toBe(fingerprint(row));
    expect(fingerprint(row)).toMatch(/^[0-9a-f]{8}$/);
  });

  test("keys every row by its card and level, and refuses a row without them", () => {
    const map = fingerprints([row, { ...row, upgradeCount: 0, stamina: 1 }]);
    expect([...map.keys()]).toEqual(["p_card-01-act-1_001:1", "p_card-01-act-1_001:0"]);
    expect(() => fingerprints([{ id: "x" }])).toThrow("upgradeCount");
    expect(() => fingerprints([])).toThrow("at least one row");
  });
});
