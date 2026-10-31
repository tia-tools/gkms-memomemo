import { describe, expect, test } from "bun:test";
import { type BuildProblem, isBuildProblem, newBuild } from "../memo/build.ts";
import type { Build } from "../memo/types.ts";
import { cardNamed, kindLabelled } from "../test-support/skillcards.ts";
import { chosenStep, fitKaimaku, nothingToCustomize, pickStep, stepOpen, switchKaimaku } from "./customize.ts";

/** ファンサ+ (R + card, limit 3, so 2 in a memory; 開幕時獲得 allows 2 steps), 前途洋々+ (SR +, 開幕時獲得 allows none). */
const FANSA = cardNamed("ファンサ+");
const KOCHO = kindLabelled(FANSA, "好調追加");
const ZEKKOCHO = kindLabelled(FANSA, "絶好調追加");
const PARAM = kindLabelled(FANSA, "パラメータ+");
const ZENTO = cardNamed("前途洋々+");
const HIF = "memory_ability-x";

function built(result: Build | BuildProblem): Build {
  if (isBuildProblem(result)) throw new Error(`problem: ${JSON.stringify(result)}`);
  return result;
}

const fansa = () => newBuild(FANSA.id, FANSA, HIF);

describe("pickStep", () => {
  test("a tapped step is chosen, and tapping another step of the kind replaces it", () => {
    const one = built(pickStep(fansa(), PARAM, 1, FANSA));
    expect(one.customization).toEqual([{ kind: PARAM, step: 1 }]);
    expect(built(pickStep(one, PARAM, 2, FANSA)).customization).toEqual([{ kind: PARAM, step: 2 }]);
  });

  test("tapping the chosen step again takes it back", () => {
    const one = built(pickStep(fansa(), KOCHO, 1, FANSA));
    expect(chosenStep(one, KOCHO)).toBe(1);
    expect(built(pickStep(one, KOCHO, 1, FANSA)).customization).toEqual([]);
  });

  test("steps of several kinds add up, and past D39's cap of 2 the tap is refused", () => {
    const two = built(pickStep(built(pickStep(fansa(), KOCHO, 1, FANSA)), ZEKKOCHO, 1, FANSA));
    expect(chosenStep(two, ZEKKOCHO)).toBe(1);
    expect(pickStep(two, PARAM, 1, FANSA)).toEqual({ problem: "over-limit", steps: 3, limit: 2 });
  });

  test("on an SR + card, a step switches 開幕時獲得 off (D40)", () => {
    const zento = newBuild(ZENTO.id, ZENTO, HIF);
    expect(zento.kaimaku).toBe(true);
    const kind = ZENTO.customization.kinds[0]?.id ?? "";
    expect(built(pickStep(zento, kind, 1, ZENTO)).kaimaku).toBe(false);
  });
});

describe("stepOpen", () => {
  test("enables exactly the steps that keep the build within the card's rules", () => {
    const param2 = built(pickStep(fansa(), PARAM, 2, FANSA));
    expect(stepOpen(param2, PARAM, 1, FANSA)).toBe(true);
    expect(stepOpen(param2, KOCHO, 1, FANSA)).toBe(false);
    expect(stepOpen(fansa(), PARAM, 3, FANSA)).toBe(false);
    expect(stepOpen(fansa(), PARAM, 2, FANSA)).toBe(true);
  });
});

describe("switchKaimaku", () => {
  test("switches where the card allows it, both ways", () => {
    const off = switchKaimaku(fansa(), FANSA);
    expect(off.kaimaku).toBe(false);
    expect(switchKaimaku(off, FANSA).kaimaku).toBe(true);
  });

  test("leaves a base card's 開幕時獲得 on and a card without it off", () => {
    const base = cardNamed("ファンサ");
    expect(switchKaimaku(newBuild(base.id, base, HIF), base).kaimaku).toBe(true);
    const ssr = cardNamed("成就+");
    expect(switchKaimaku(newBuild(ssr.id, ssr, HIF), ssr).kaimaku).toBe(false);
  });

  test("cannot switch on while the customization is past the cap (D40)", () => {
    const zento = newBuild(ZENTO.id, ZENTO, HIF);
    const customized = built(pickStep(zento, ZENTO.customization.kinds[0]?.id ?? "", 1, ZENTO));
    expect(switchKaimaku(customized, ZENTO).kaimaku).toBe(false);
  });
});

describe("fitKaimaku", () => {
  test("switches 開幕時獲得 off on a card that cannot have it, and on where it is always on", () => {
    const ssr = cardNamed("成就+");
    expect(fitKaimaku({ ...newBuild(ssr.id, ssr, HIF), kaimaku: true }, ssr).kaimaku).toBe(false);
    const base = cardNamed("ファンサ");
    expect(fitKaimaku({ ...newBuild(base.id, base, HIF), kaimaku: false }, base).kaimaku).toBe(true);
  });

  test("leaves a switchable 開幕時獲得 as the player set it, and the same build when nothing changes", () => {
    const off = { ...fansa(), kaimaku: false };
    expect(fitKaimaku(off, FANSA)).toBe(off);
    const on = fansa();
    expect(fitKaimaku(on, FANSA)).toBe(on);
  });
});

describe("nothingToCustomize", () => {
  test("a base card has nothing to choose: no kinds, 開幕時獲得 always on", () => {
    const base = cardNamed("ファンサ");
    expect(nothingToCustomize(newBuild(base.id, base, HIF), base)).toBe(true);
  });

  test("a + card with kinds, or with a 開幕時獲得 switch, has something", () => {
    expect(nothingToCustomize(fansa(), FANSA)).toBe(false);
    const ssr = cardNamed("成就+");
    expect(nothingToCustomize(newBuild(ssr.id, ssr, HIF), ssr)).toBe(false);
    const noKinds = { ...FANSA, customization: { limit: 0, kinds: [] } };
    expect(nothingToCustomize(newBuild(FANSA.id, noKinds, HIF), noKinds)).toBe(false);
  });
});
