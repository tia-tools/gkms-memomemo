import { describe, expect, test } from "bun:test";
import type { SkillCard } from "../../src/data/contract.ts";
import { cardNamed, kindLabelled, SKILL_CARDS } from "../../src/test-support/skillcards.ts";
import type { CountEvent } from "./count-contract.ts";
import { countRules, parseCountEvent, type ReadEvent } from "./count-event.ts";

const JOJU = cardNamed("成就+"); // センス SSR, limit 1: 好調+ and コスト値- of one step each
const FANSA = cardNamed("ファンサ+"); // センス R, limit 3: 好調追加, 絶好調追加 and パラメータ+ of three steps
const ZENTO = cardNamed("前途洋々+"); // free
const CHOSEN = cardNamed("挑戦+"); // センス N: in the pool, not offered (D54)
const HYOGEN = cardNamed("表現の基本"); // the one N card offered

function hifOf(plan: SkillCard["plan"]): string {
  const ability = SKILL_CARDS.hifAbilities.find((h) => SKILL_CARDS.cards.find((c) => c.id === h.card)?.plan === plan);
  if (ability === undefined) throw new Error(`no ${plan} H.I.F. ability in the fixture`);
  return ability.id;
}
const SENSE_HIF = hifOf("sense");
const LOGIC_HIF = hifOf("logic");

const GOOD: CountEvent = { section: "sense.kocho", card: JOJU.id, upgrade: 1, hif: SENSE_HIF, customization: [] };
const json = (value: unknown) => JSON.stringify(value);

describe("parseCountEvent", () => {
  test("reads an event, its customization as chosen steps", () => {
    const kind = kindLabelled(FANSA, "パラメータ+");
    expect(parseCountEvent(json({ ...GOOD, customization: [`${kind}:2`] }))).toEqual({
      section: "sense.kocho",
      card: JOJU.id,
      upgrade: 1,
      hif: SENSE_HIF,
      steps: [{ kind, step: 2 }],
    });
    expect(parseCountEvent(json(GOOD))?.steps).toEqual([]);
  });

  test("a step is cut at the last colon, so a kind may hold one", () => {
    expect(parseCountEvent(json({ ...GOOD, customization: ["a:b:3"] }))?.steps).toEqual([{ kind: "a:b", step: 3 }]);
  });

  test("refuses what is not JSON or not an object", () => {
    for (const raw of ["", "{", "null", "[]", "3", json([GOOD])]) expect(parseCountEvent(raw)).toBeNull();
  });

  test("refuses an event with a field missing or one more", () => {
    const { hif: _, ...missing } = GOOD;
    expect(parseCountEvent(json(missing))).toBeNull();
    expect(parseCountEvent(json({ ...GOOD, memo: [] }))).toBeNull();
  });

  test("refuses each field of the wrong type or outside its values", () => {
    const bad: Record<string, unknown>[] = [
      { section: "sense" },
      { section: "sense.kocho " },
      { section: 1 },
      { card: 1 },
      { card: null },
      { upgrade: 2 },
      { upgrade: -1 },
      { upgrade: "1" },
      { upgrade: 0.5 },
      { hif: [] },
      { customization: "none" },
      { customization: null },
      { customization: [1] },
      { customization: ["kind"] },
      { customization: ["kind:"] },
      { customization: [":1"] },
      { customization: ["kind:0"] },
      { customization: ["kind:10"] },
      { customization: ["kind:1.0"] },
      { customization: ["kind: 1"] },
    ];
    for (const fields of bad) expect({ fields, read: parseCountEvent(json({ ...GOOD, ...fields })) }).toEqual({ fields, read: null });
  });
});

describe("countRules", () => {
  const rows = countRules(SKILL_CARDS);
  const read = (event: Partial<CountEvent>): ReadEvent => {
    const parsed = parseCountEvent(json({ ...GOOD, ...event }));
    if (parsed === null) throw new Error("the test's event does not parse");
    return parsed;
  };

  test("counts the card at its level, the ability, and none for no customization (D11)", () => {
    expect(rows(read({}))).toEqual([
      { section: "sense.kocho", kind: "card", id: `${JOJU.id}:1` },
      { section: "sense.kocho", kind: "hif", id: SENSE_HIF },
      { section: "sense.kocho", kind: "customization", id: "none" },
    ]);
  });

  test("counts each customization step, under the section it was sent for", () => {
    const kocho = kindLabelled(FANSA, "好調追加");
    const zekkocho = kindLabelled(FANSA, "絶好調追加");
    const counted = rows(read({ section: "sense.common", card: FANSA.id, customization: [`${kocho}:1`, `${zekkocho}:1`] }));
    expect(counted?.filter((r) => r.kind === "customization")).toEqual([
      { section: "sense.common", kind: "customization", id: `${kocho}:1` },
      { section: "sense.common", kind: "customization", id: `${zekkocho}:1` },
    ]);
    expect(counted?.every((r) => r.section === "sense.common")).toBe(true);
  });

  test("a base card is counted at level 0, and a free card in any tab", () => {
    expect(rows(read({ upgrade: 0 }))?.[0]?.id).toBe(`${JOJU.id}:0`);
    expect(rows(read({ section: "logic.yaruki", card: ZENTO.id, hif: LOGIC_HIF }))?.[0]?.id).toBe(`${ZENTO.id}:1`);
    expect(rows(read({ card: HYOGEN.id, upgrade: 0 }))?.[0]?.id).toBe(`${HYOGEN.id}:0`);
  });

  test("refuses a card the section's tab does not offer: another plan's, an N card other than 表現の基本, a level the file lacks", () => {
    expect(rows(read({ section: "logic.yaruki", hif: LOGIC_HIF }))).toBeNull();
    expect(rows(read({ card: CHOSEN.id }))).toBeNull();
    expect(rows(read({ card: HYOGEN.id, upgrade: 1 }))).toBeNull();
    expect(rows(read({ card: "p_card-01-act-9_999" }))).toBeNull();
  });

  test("refuses an H.I.F. ability of another plan, or one the file lacks", () => {
    expect(rows(read({ hif: LOGIC_HIF }))).toBeNull();
    expect(rows(read({ hif: `${SENSE_HIF}x` }))).toBeNull();
  });

  test("refuses a customization the card cannot carry in a memory: a kind or step it lacks, a kind twice, over its limit or D39's cap", () => {
    const kocho = kindLabelled(JOJU, "好調+");
    const cost = kindLabelled(JOJU, "コスト値-");
    const param = kindLabelled(FANSA, "パラメータ+");
    expect(rows(read({ customization: [`${kocho}:1`] }))).not.toBeNull();
    expect(rows(read({ customization: [`${param}:1`] }))).toBeNull();
    expect(rows(read({ customization: [`${kocho}:2`] }))).toBeNull();
    expect(rows(read({ customization: [`${kocho}:1`, `${kocho}:1`] }))).toBeNull();
    expect(rows(read({ customization: [`${kocho}:1`, `${cost}:1`] }))).toBeNull(); // 成就+'s limit is 1
    expect(rows(read({ card: FANSA.id, customization: [`${param}:2`] }))).not.toBeNull();
    expect(rows(read({ card: FANSA.id, customization: [`${param}:3`] }))).toBeNull(); // ファンサ+'s limit is 3, D39's cap 2
    expect(rows(read({ upgrade: 0, customization: [`${kocho}:1`] }))).toBeNull(); // a base card has none
  });
});
