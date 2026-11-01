import { describe, expect, test } from "bun:test";
import { cardNamed, kindLabelled } from "../test-support/skillcards.ts";
import { type BuildProblem, buildKey, buildProblem, isBuildProblem, kaimakuRule, kaimakuSwitch, newBuild, stepLimit, withCustomization } from "./build.ts";
import type { Build } from "./types.ts";

/** ファンサ+ (R, limit 3): 好調追加 and 絶好調追加 of one step each, パラメータ+ of three (D39's own example). */
const FANSA = cardNamed("ファンサ+");
const KOCHO = kindLabelled(FANSA, "好調追加");
const ZEKKOCHO = kindLabelled(FANSA, "絶好調追加");
const PARAM = kindLabelled(FANSA, "パラメータ+");
/** 前途洋々+ (SR, limit 2), 成就+ (SSR), 挑戦+ (N), 挑戦 (a base card), シュプレヒコール+ (SR, limit 1). */
const ZENTO = cardNamed("前途洋々+");
const JOJU = cardNamed("成就+");
const CHOSEN_PLUS = cardNamed("挑戦+");
const CHOSEN = cardNamed("挑戦");
const SPRECH = cardNamed("シュプレヒコール+");

function build(card: { id: string; upgrade: number }, customization: Build["customization"], kaimaku: boolean): Build {
  return { card: card.id, upgrade: card.upgrade, customization, kaimaku, hif: "memory_ability-x" };
}

/** The build `withCustomization` returned, or a failed test when it named a problem. */
function built(result: Build | BuildProblem): Build {
  if (isBuildProblem(result)) throw new Error(`problem: ${JSON.stringify(result)}`);
  return result;
}

describe("buildKey", () => {
  test("is the same for the same customization chosen in another order", () => {
    const a = build(FANSA, [{ kind: KOCHO, step: 1 }, { kind: ZEKKOCHO, step: 1 }], true);
    const b = build(FANSA, [{ kind: ZEKKOCHO, step: 1 }, { kind: KOCHO, step: 1 }], true);
    expect(buildKey(a)).toBe(buildKey(b));
  });

  test("differs when any part of the build differs: level, step, 開幕時獲得 or H.I.F. ability", () => {
    const base = build(FANSA, [{ kind: PARAM, step: 1 }], true);
    const others: Build[] = [
      { ...base, upgrade: 0 },
      { ...base, customization: [{ kind: PARAM, step: 2 }] },
      { ...base, kaimaku: false },
      { ...base, hif: "memory_ability-y" },
    ];
    expect(new Set([base, ...others].map(buildKey)).size).toBe(5);
  });
});

describe("buildProblem, customization (D39)", () => {
  test("allows D39's examples on ファンサ+: パラメータ+ at step 2, 好調追加 with 絶好調追加, one of them with パラメータ+ at step 1", () => {
    for (const customization of [[{ kind: PARAM, step: 2 }], [{ kind: KOCHO, step: 1 }, { kind: ZEKKOCHO, step: 1 }], [{ kind: KOCHO, step: 1 }, { kind: PARAM, step: 1 }], []]) {
      expect(buildProblem(build(FANSA, customization, false), FANSA)).toBeNull();
    }
  });

  test("refuses more than 2 steps in all, though ファンサ+'s own limit is 3", () => {
    expect(buildProblem(build(FANSA, [{ kind: PARAM, step: 3 }], false), FANSA)).toEqual({ problem: "over-limit", steps: 3, limit: 2 });
    expect(buildProblem(build(FANSA, [{ kind: KOCHO, step: 1 }, { kind: PARAM, step: 2 }], false), FANSA)).toEqual({ problem: "over-limit", steps: 3, limit: 2 });
  });

  test("applies a card's own limit when it is under the cap", () => {
    expect(stepLimit(SPRECH)).toBe(1);
    expect(stepLimit(FANSA)).toBe(2);
    const [first, second] = SPRECH.customization.kinds;
    const both = [{ kind: first?.id ?? "", step: 1 }, { kind: second?.id ?? "", step: 1 }];
    expect(buildProblem(build(SPRECH, both, false), SPRECH)).toEqual({ problem: "over-limit", steps: 2, limit: 1 });
  });

  test("refuses a kind the card does not have, a step its kind does not have, and a kind chosen twice", () => {
    expect(buildProblem(build(FANSA, [{ kind: "p_card_custom-x", step: 1 }], false), FANSA)).toEqual({ problem: "unknown-kind", kind: "p_card_custom-x" });
    expect(buildProblem(build(FANSA, [{ kind: KOCHO, step: 2 }], false), FANSA)).toEqual({ problem: "unknown-step", kind: KOCHO, step: 2 });
    expect(buildProblem(build(FANSA, [{ kind: PARAM, step: 1 }, { kind: PARAM, step: 1 }], false), FANSA)).toEqual({ problem: "repeated-kind", kind: PARAM });
  });

  test("refuses any customization on a base card, which has no options", () => {
    expect(buildProblem(build(CHOSEN, [{ kind: KOCHO, step: 1 }], true), CHOSEN)).toEqual({ problem: "unknown-kind", kind: KOCHO });
  });
});

describe("開幕時獲得 (D40)", () => {
  test("the table: a base card always on with cap 0, R+ cap 2, SR+ cap 0, SSR+ and N+ none", () => {
    expect([CHOSEN, FANSA, ZENTO, JOJU, CHOSEN_PLUS].map(kaimakuRule)).toEqual([
      { cap: 0, alwaysOn: true },
      { cap: 2, alwaysOn: false },
      { cap: 0, alwaysOn: false },
      null,
      null,
    ]);
  });

  test("a new row has it wherever the card can have it", () => {
    expect([CHOSEN, FANSA, ZENTO, JOJU, CHOSEN_PLUS].map((c) => newBuild(c.id, c, "h").kaimaku)).toEqual([true, true, true, false, false]);
    expect(newBuild(FANSA.id, FANSA, "h")).toEqual({ card: FANSA.id, upgrade: 1, customization: [], kaimaku: true, hif: "h" });
  });

  test("refuses it on a card that cannot have it, and refuses a base card without it", () => {
    expect(buildProblem(build(JOJU, [], true), JOJU)).toEqual({ problem: "kaimaku-unavailable" });
    expect(buildProblem(build(CHOSEN_PLUS, [], true), CHOSEN_PLUS)).toEqual({ problem: "kaimaku-unavailable" });
    expect(buildProblem(build(CHOSEN, [], false), CHOSEN)).toEqual({ problem: "kaimaku-required" });
    expect(buildProblem(build(CHOSEN, [], true), CHOSEN)).toBeNull();
  });

  test("an R+ card keeps it with up to 2 steps; an SR+ card only with none", () => {
    expect(buildProblem(build(FANSA, [{ kind: PARAM, step: 2 }], true), FANSA)).toBeNull();
    const zentoStep = [{ kind: ZENTO.customization.kinds[0]?.id ?? "", step: 1 }];
    expect(buildProblem(build(ZENTO, zentoStep, false), ZENTO)).toBeNull();
    expect(buildProblem(build(ZENTO, zentoStep, true), ZENTO)).toEqual({ problem: "kaimaku-over-cap", steps: 1, cap: 0 });
  });

  test("customizing over the cap switches it off, and it stays off when the customization goes", () => {
    const zentoStep = [{ kind: ZENTO.customization.kinds[0]?.id ?? "", step: 1 }];
    const customized = built(withCustomization(newBuild(ZENTO.id, ZENTO, "h"), zentoStep, ZENTO));
    expect(customized.kaimaku).toBe(false);
    expect(kaimakuSwitch(customized, ZENTO)).toBe("blocked");
    const plain = built(withCustomization(customized, [], ZENTO));
    expect([plain.kaimaku, kaimakuSwitch(plain, ZENTO)]).toEqual([false, "switchable"]);
  });

  test("customizing within the cap keeps it on", () => {
    const kept = built(withCustomization(newBuild(FANSA.id, FANSA, "h"), [{ kind: PARAM, step: 2 }], FANSA));
    expect([kept.kaimaku, kaimakuSwitch(kept, FANSA)]).toEqual([true, "switchable"]);
  });

  test("a customization the card cannot carry is refused, never returned as a build", () => {
    expect(withCustomization(newBuild(FANSA.id, FANSA, "h"), [{ kind: PARAM, step: 3 }], FANSA)).toEqual({ problem: "over-limit", steps: 3, limit: 2 });
    expect(withCustomization(newBuild(FANSA.id, FANSA, "h"), [{ kind: "p_card_custom-x", step: 1 }], FANSA)).toEqual({ problem: "unknown-kind", kind: "p_card_custom-x" });
  });

  test("the switch is fixed on a base card and absent on SSR+ and N+ cards", () => {
    expect([CHOSEN, JOJU, CHOSEN_PLUS].map((c) => kaimakuSwitch(newBuild(c.id, c, "h"), c))).toEqual(["always", "unavailable", "unavailable"]);
  });
});
