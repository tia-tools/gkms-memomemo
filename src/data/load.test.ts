import { describe, expect, test } from "bun:test";
import { SKILLCARDS_ROUTE } from "../../infra/worker/data.ts";
import { loadSkillCardData, parseSkillCardData, SkillCardDataError } from "./load.ts";

/** gakumas-supportcards' published file at its merge f336717 (2026-10-31), byte for byte. */
const TEXT = await Bun.file(new URL("./fixtures/skillcards.v1.json", import.meta.url)).text();
const FIXTURE: unknown = JSON.parse(TEXT);

/** The parts of the file the tests below break, typed loosely enough to break them. */
interface LooseCard {
  [key: string]: unknown;
  art: Record<string, unknown>;
  customization: { kinds: { steps: Record<string, unknown>[] }[] };
}
interface LooseFile {
  [key: string]: unknown;
  cards: LooseCard[];
  idols: unknown[];
  hifAbilities: unknown[];
}

/** A fresh, mutable copy of the fixture for one test to break. */
function fixture(): LooseFile {
  return JSON.parse(TEXT);
}

/** `list[i]`, or a failed test if it is missing. */
function at<T>(list: readonly T[], i: number): T {
  const item = list[i];
  if (item === undefined) throw new Error(`the fixture has no item ${i}`);
  return item;
}

/** The first card with a customization kind, which only + cards have. */
const customized = (file: LooseFile) => file.cards.findIndex((c) => c.customization.kinds.length > 0);

describe("parseSkillCardData, the real file", () => {
  test("keeps every field of every entry: the parsed data equals the file", () => {
    expect(FIXTURE).toStrictEqual(parseSkillCardData(FIXTURE));
  });

  test("holds 181 cards at level 0 and 180 at level 1, 13 idols from hski, and 115 H.I.F. abilities", () => {
    const data = parseSkillCardData(FIXTURE);
    expect(data.formatVersion).toBe(1);
    expect([data.cards.filter((c) => c.upgrade === 0).length, data.cards.filter((c) => c.upgrade === 1).length]).toEqual([181, 180]);
    expect(data.cards.length).toBe(361);
    expect(data.idols.length).toBe(13);
    expect(data.idols[0]).toEqual({ id: "hski", name: "花海咲季" });
    expect(data.hifAbilities.length).toBe(115);
  });

  test("has the scenario's card, 成就+ in センス, with its customization kinds", () => {
    const card = parseSkillCardData(FIXTURE).cards.find((c) => c.name === "成就+");
    expect(card).toMatchObject({ upgrade: 1, plan: "sense" });
    expect(card?.customization.kinds.length).toBeGreaterThan(0);
  });

  test("names a pool card for every H.I.F. ability", () => {
    const data = parseSkillCardData(FIXTURE);
    const ids = new Set(data.cards.map((c) => c.id));
    expect(data.hifAbilities.filter((a) => !ids.has(a.card))).toEqual([]);
  });
});

describe("parseSkillCardData, the format version", () => {
  test("refuses another format version, naming it", () => {
    const file = fixture();
    file["formatVersion"] = 2;
    expect(() => parseSkillCardData(file)).toThrow("format version 2");
  });

  test("refuses a file with no format version", () => {
    const file = fixture();
    delete file["formatVersion"];
    expect(() => parseSkillCardData(file)).toThrow(SkillCardDataError);
  });

  test("refuses what is not a skill card file at all", () => {
    for (const value of [null, undefined, "cards", 1, []]) {
      expect(() => parseSkillCardData(value)).toThrow(SkillCardDataError);
    }
  });
});

describe("parseSkillCardData, a broken entry", () => {
  test("names the path of a bad value", () => {
    const file = fixture();
    at(file.cards, 0)["plan"] = "vocal";
    expect(() => parseSkillCardData(file)).toThrow("cards[0].plan: expected sense | logic | anomaly | free");
  });

  test("names a bad value deep in a customization", () => {
    const file = fixture();
    const i = customized(file);
    at(at(at(file.cards, i).customization.kinds, 0).steps, 0)["step"] = 1.5;
    expect(() => parseSkillCardData(file)).toThrow(`cards[${i}].customization.kinds[0].steps[0].step: expected an integer`);
  });

  test("refuses an art variant flag that is not a boolean", () => {
    const file = fixture();
    at(file.cards, 0).art["perIdol"] = "true";
    expect(() => parseSkillCardData(file)).toThrow("cards[0].art.perIdol: expected true or false");
  });

  test("refuses a missing required field", () => {
    const file = fixture();
    delete at(file.cards, 3)["rarity"];
    expect(() => parseSkillCardData(file)).toThrow("cards[3].rarity: expected N | R | SR | SSR | Legend");
  });

  test("refuses an idol or an H.I.F. ability that is not an object", () => {
    const idols = fixture();
    idols.idols[1] = "ttmr";
    expect(() => parseSkillCardData(idols)).toThrow("idols[1]: expected an object");
    const abilities = fixture();
    abilities.hifAbilities[0] = null;
    expect(() => parseSkillCardData(abilities)).toThrow("hifAbilities[0]: expected an object");
  });

  test("refuses an empty card or idol list, so the page never works with nothing to pick or draw", () => {
    const cards = fixture();
    cards.cards = [];
    expect(() => parseSkillCardData(cards)).toThrow("cards: expected at least one card");
    const idols = fixture();
    idols.idols = [];
    expect(() => parseSkillCardData(idols)).toThrow("idols: expected at least one idol");
  });

  test("refuses a fractional or non-finite number", () => {
    for (const value of [0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const file = fixture();
      at(file.cards, 0)["upgrade"] = value;
      expect(() => parseSkillCardData(file)).toThrow("cards[0].upgrade: expected an integer");
    }
  });
});

describe("parseSkillCardData, what may vary", () => {
  test("reads an empty H.I.F. ability list", () => {
    const file = fixture();
    file.hifAbilities = [];
    expect(parseSkillCardData(file).hifAbilities).toEqual([]);
  });

  test("drops a field the contract does not name, without refusing the file", () => {
    const file = fixture();
    at(file.cards, 0)["comingSoon"] = true;
    at(file.cards, 0).art["width"] = 112;
    const parsed = parseSkillCardData(file).cards[0];
    expect(parsed === undefined ? [] : Object.keys(parsed)).not.toContain("comingSoon");
    expect(parsed === undefined ? [] : Object.keys(parsed.art)).toEqual(["asset", "perIdol"]);
  });
});

describe("loadSkillCardData", () => {
  /** A fetch that records the URL asked for and answers `response`. */
  function fakeGet(response: Response): { get: (url: string) => Promise<Response>; asked: string[] } {
    const asked: string[] = [];
    return { asked, get: (url) => (asked.push(url), Promise.resolve(response)) };
  }

  /** What `loadSkillCardData(get)` rejects with; a resolved load fails the test. */
  async function refusal(get: (url: string) => Promise<Response>): Promise<SkillCardDataError> {
    const outcome: unknown = await loadSkillCardData(get).then(
      () => new Error("the load resolved"),
      (error: unknown) => error,
    );
    if (!(outcome instanceof SkillCardDataError)) throw outcome;
    return outcome;
  }

  test("asks this origin's route and reads the file", async () => {
    const { get, asked } = fakeGet(new Response(TEXT, { status: 200 }));
    expect(await loadSkillCardData(get)).toStrictEqual(parseSkillCardData(FIXTURE));
    expect(asked).toEqual([SKILLCARDS_ROUTE]);
  });

  test("refuses an error status, naming it", async () => {
    const { get } = fakeGet(new Response("Skill card data unavailable", { status: 502 }));
    expect((await refusal(get)).message).toContain("/data/skillcards.json: HTTP 502");
  });

  test("refuses a body that is not JSON", async () => {
    const { get } = fakeGet(new Response("<!doctype html>", { status: 200 }));
    expect((await refusal(get)).message).toContain("/data/skillcards.json: not JSON");
  });

  test("refuses a file that does not match, with the parser's path", async () => {
    const file = fixture();
    at(file.cards, 0)["plan"] = "vocal";
    const { get } = fakeGet(new Response(JSON.stringify(file), { status: 200 }));
    expect((await refusal(get)).message).toContain("cards[0].plan");
  });
});
