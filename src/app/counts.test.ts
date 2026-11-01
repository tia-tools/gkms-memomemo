import { describe, expect, test } from "bun:test";
import type { CountEvent, CountsAnswer } from "../../infra/worker/count-contract.ts";
import { countsAnswer } from "../../infra/worker/count.ts";
import { newBuild } from "../memo/build.ts";
import { SECTION_IDS, type SectionId } from "../memo/types.ts";
import { cardNamed, kindLabelled } from "../test-support/skillcards.ts";
import { CATALOG, must } from "../test-support/page.tsx";
import { countEvent, httpCounts, ranked, rankedAbilities, rankedCards, readCounts, type SectionCounts } from "./counts.ts";

const JOJU = cardNamed("成就+");
const HIF = must(CATALOG.tabAbilities("sense")[0], "a センス ability").ability.id;

/** The Worker's own answer, with these sections' kinds replaced. */
function answer(sections: Partial<Record<SectionId, Partial<CountsAnswer["sections"]["sense.kocho"]>>>): CountsAnswer {
  const built = countsAnswer([]);
  for (const s of SECTION_IDS) Object.assign(built.sections[s], sections[s] ?? {});
  return built;
}

describe("countEvent", () => {
  test("is the section, the card and its level, the ability, and each customization step as kind:step", () => {
    const kind = kindLabelled(JOJU, "好調+");
    const build = { ...newBuild(JOJU.id, JOJU, HIF), customization: [{ kind, step: 1 }] };
    expect(countEvent("sense.common", build)).toEqual({ section: "sense.common", card: JOJU.id, upgrade: 1, hif: HIF, customization: [`${kind}:1`] });
    expect(countEvent("sense.kocho", newBuild(JOJU.id, JOJU, HIF)).customization).toEqual([]);
  });
});

describe("readCounts", () => {
  test("reads each section's card and ability counts, the Worker's own answer included", () => {
    const counts = readCounts(answer({ "logic.yaruki": { card: { "p_card-02-act-1_001:1": 3 }, hif: { "memory_ability-x": 2 }, customization: { none: 5 } } }));
    expect(counts.size).toBe(9);
    expect([...(counts.get("logic.yaruki")?.card ?? [])]).toEqual([["p_card-02-act-1_001:1", 3]]);
    expect([...(counts.get("logic.yaruki")?.hif ?? [])]).toEqual([["memory_ability-x", 2]]);
    expect(counts.get("sense.kocho")?.card.size).toBe(0);
  });

  test("refuses the whole answer at the first value that does not match", () => {
    const good = answer({});
    const bad: unknown[] = [
      null,
      [],
      { ...good, formatVersion: 2 },
      { formatVersion: 1 },
      { ...good, sections: [] },
      { ...good, sections: { ...good.sections, "sense.kocho": undefined } },
      { ...good, sections: { ...good.sections, "sense.kocho": { card: {} } } },
      answer({ "sense.kocho": { card: { a: -1 } } }),
      answer({ "sense.kocho": { card: { a: 1.5 } } }),
      { ...good, sections: { ...good.sections, "sense.kocho": { card: {}, hif: { a: "1" }, customization: {} } } },
      { ...good, sections: { ...good.sections, "sense.kocho": { card: {}, hif: [], customization: {} } } },
    ];
    for (const value of bad) expect(() => readCounts(value)).toThrow();
  });

  test("an id named __proto__ is a count like any other", () => {
    const counts = readCounts(JSON.parse(JSON.stringify(answer({})).replace('"sense.kocho":{"card":{}', '"sense.kocho":{"card":{"__proto__":4}')));
    expect(counts.get("sense.kocho")?.card.get("__proto__")).toBe(4);
  });
});

describe("ranked", () => {
  const ids = ["a", "b", "c", "d", "e"];
  const by = (counts: Record<string, number>) => ranked(ids, new Map(Object.entries(counts)), (x) => x);

  test("puts the most counted first", () => {
    expect(by({ c: 5, e: 9, b: 1 })).toEqual(["e", "c", "b", "a", "d"]);
  });

  test("ties and entries never counted keep their order", () => {
    expect(by({ d: 2, b: 2 })).toEqual(["b", "d", "a", "c", "e"]);
    expect(by({ a: 0, e: 0 })).toEqual(ids);
    expect(by({})).toEqual(ids);
    expect(ranked(ids, undefined, (x) => x)).toEqual(ids);
  });

  test("leaves the entries it was given as they were", () => {
    const entries = ["a", "b"];
    ranked(entries, new Map([["b", 1]]), (x) => x);
    expect(entries).toEqual(["a", "b"]);
  });
});

describe("rankedCards and rankedAbilities", () => {
  const cards = CATALOG.tabCards("sense");
  const firstFree = cards.findIndex((c) => c.plan === "free");
  const lastFree = must(cards.at(-1), "a free card");
  const lastPlan = must(cards[firstFree - 1], "a センス card");

  test("rank the plan's cards and the free ones each in their own block", () => {
    const counts: SectionCounts = { card: new Map([[`${lastFree.id}:${lastFree.upgrade}`, 9], [`${lastPlan.id}:${lastPlan.upgrade}`, 1]]), hif: new Map() };
    const order = rankedCards(cards, counts);
    expect(order[0]).toBe(lastPlan);
    expect(order[firstFree]).toBe(lastFree);
    expect(order.length).toBe(cards.length);
    expect(order.slice(0, firstFree).every((c) => c.plan !== "free")).toBe(true);
  });

  test("count a card at its level: the base card's count does not rank the + card", () => {
    const base = must(cards.find((c) => c.id === JOJU.id && c.upgrade === 0), "成就");
    const order = rankedCards(cards, { card: new Map([[`${JOJU.id}:0`, 3]]), hif: new Map() });
    expect(order[0]).toBe(base);
    expect(order.filter((c) => c !== base)).toEqual(cards.filter((c) => c !== base));
  });

  test("keep the game's order with no counts", () => {
    expect(rankedCards(cards, undefined)).toEqual(cards);
    const abilities = CATALOG.tabAbilities("sense");
    expect(rankedAbilities(abilities, undefined)).toEqual(abilities);
  });

  test("rank the abilities by their id", () => {
    const abilities = CATALOG.tabAbilities("sense");
    const last = must(abilities.at(-1), "an ability");
    expect(rankedAbilities(abilities, { card: new Map(), hif: new Map([[last.ability.id, 1]]) })[0]).toBe(last);
  });
});

describe("httpCounts", () => {
  const EVENT: CountEvent = { section: "sense.kocho", card: JOJU.id, upgrade: 1, hif: HIF, customization: [] };

  test("loads the counts from /counts", async () => {
    const asked: string[] = [];
    const api = httpCounts(async (url) => (asked.push(url), Response.json(answer({ "sense.kocho": { card: { x: 1 } } }))));
    expect((await api.load())?.get("sense.kocho")?.card.get("x")).toBe(1);
    expect(asked).toEqual(["/counts"]);
  });

  test("loads nothing, never rejecting, when the answer is an error, not JSON, not counts, or the network is down", async () => {
    const answers: (() => Promise<Response>)[] = [
      async () => Response.json(answer({}), { status: 503 }),
      async () => new Response("<!doctype html>"),
      async () => Response.json({ formatVersion: 2 }),
      async () => {
        throw new TypeError("Failed to fetch");
      },
    ];
    for (const get of answers) expect(await httpCounts(get).load()).toBeNull();
  });

  test("sends the event once, as JSON, to POST /count, kept alive past the page's end", async () => {
    const sent: [string, RequestInit | undefined][] = [];
    httpCounts(async (url, init) => (sent.push([url, init]), new Response("{}"))).send(EVENT);
    expect(sent.length).toBe(1);
    const [url, init] = must(sent[0], "a request");
    expect(url).toBe("/count");
    expect(init?.method).toBe("POST");
    expect(init?.keepalive).toBe(true);
    const body = init?.body;
    expect(typeof body === "string" ? JSON.parse(body) : body).toEqual(EVENT);
  });

  test("a failed send is dropped, not retried, and throws nothing, its rejection handled", async () => {
    let handlers = 0;
    /** A rejected fetch that counts the rejection handlers attached to it, since bun test reports no unhandled rejection. */
    class Watched extends Promise<Response> {
      override then<A = Response, B = never>(ok?: ((value: Response) => A | PromiseLike<A>) | null, fail?: ((reason: unknown) => B | PromiseLike<B>) | null): Promise<A | B> {
        if (fail) handlers++;
        return super.then(ok, fail);
      }
    }
    let tries = 0;
    const rejecting = httpCounts(() => (tries++, new Watched((_, reject) => reject(new TypeError("Failed to fetch")))));
    expect(() => rejecting.send(EVENT)).not.toThrow();
    const throwing = httpCounts(() => {
      tries++;
      throw new TypeError("synchronous");
    });
    expect(() => throwing.send(EVENT)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(tries).toBe(2);
    expect(handlers).toBe(1);
  });
});
