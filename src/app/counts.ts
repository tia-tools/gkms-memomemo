/**
 * The anonymous counts on the page (docs/plans/EXECPLAN_MEMORY_MEMO.md, Milestone 6, D11, D12 and
 * D19): the count event a new row sends to `POST /count`, the counts `GET /counts` answers, read
 * whole, and the pickers' order by the section's counts. The shapes are the Worker's
 * (infra/worker/count-contract.ts). The network is passed in (`countsApi`), so a test needs none.
 */

import { cardCountId, COUNT_ROUTE, type CountEvent, COUNTS_ROUTE, stepCountId } from "../../infra/worker/count-contract.ts";
import type { SkillCard } from "../data/contract.ts";
import { child, fail, integer, object, req, type Read, ReadError } from "../lib/read.ts";
import { type Build, SECTION_IDS, type SectionId } from "../memo/types.ts";
import type { HifEntry } from "./catalog.ts";

/**
 * A section's counts by counted id: a card at its level (`cardCountId`), an H.I.F. ability by its
 * id, a customization step as `kind:step` or `none`. No picker ranks the customization (D11).
 */
export interface SectionCounts {
  card: ReadonlyMap<string, number>;
  hif: ReadonlyMap<string, number>;
  customization: ReadonlyMap<string, number>;
}
export type Counts = ReadonlyMap<SectionId, SectionCounts>;

/** The event a row created in `section` with `build` sends (D11): its card at its level, its ability, its customization. */
export function countEvent(section: SectionId, build: Build): CountEvent {
  return {
    section,
    card: build.card,
    upgrade: build.upgrade,
    hif: build.hif,
    customization: build.customization.map((s) => stepCountId(s.kind, s.step)),
  };
}

const count: Read<number> = (value, path) => {
  const n = integer(value, path);
  return n >= 0 ? n : fail(path, "a count of 0 or more");
};

const countMap: Read<ReadonlyMap<string, number>> = (value, path) =>
  new Map(Object.entries(object(value, path)).map(([id, n]) => [id, count(n, child(path, id))]));

const sectionCounts: Read<SectionCounts> = (value, path) => {
  const f = object(value, path);
  return { card: req(f, "card", countMap, path), hif: req(f, "hif", countMap, path), customization: req(f, "customization", countMap, path) };
};

/**
 * `GET /counts`'s answer, checked whole: the format version, and for each of the nine sections its
 * card, H.I.F. ability and customization counts, each a whole number. Throws `ReadError` at the first
 * value that does not match.
 */
export function readCounts(json: unknown): Counts {
  const f = object(json, "");
  if (f["formatVersion"] !== 1) fail("formatVersion", "1");
  const sections = req(f, "sections", object, "");
  return new Map(SECTION_IDS.map((s) => [s, req(sections, s, sectionCounts, "sections")]));
}

/**
 * The entries by their count, highest first; ties and entries never counted keep their order,
 * which is the game's (D19). A stable sort, so equal counts never trade places.
 */
export function ranked<T>(entries: readonly T[], counts: ReadonlyMap<string, number> | undefined, idOf: (entry: T) => string): T[] {
  if (counts === undefined) return [...entries];
  const of = (entry: T) => counts.get(idOf(entry)) ?? 0;
  return entries.toSorted((a, b) => of(b) - of(a));
}

/** The card step's order (D19): the plan's cards, then the free ones, each block ranked on its own. */
export function rankedCards(cards: readonly SkillCard[], counts: SectionCounts | undefined): SkillCard[] {
  const id = (c: SkillCard) => cardCountId(c.id, c.upgrade);
  return [...ranked(cards.filter((c) => c.plan !== "free"), counts?.card, id), ...ranked(cards.filter((c) => c.plan === "free"), counts?.card, id)];
}

/** The ability step's order (D19): the tab's abilities, ranked. */
export function rankedAbilities(abilities: readonly HifEntry[], counts: SectionCounts | undefined): HifEntry[] {
  return ranked(abilities, counts?.hif, (h) => h.ability.id);
}

/** The page's way to the counts: reading them once, and sending a new row's event. */
export interface CountsApi {
  /** The counts, or null when they cannot be had; never rejects. */
  load: () => Promise<Counts | null>;
  /** Sends the event once, never retried, so it is never counted twice; never throws. */
  send: (event: CountEvent) => void;
}

/** No counts and nothing sent: the page as it is without the Worker (tests, a page with no network). */
export const NO_COUNTS: CountsApi = { load: async () => null, send: () => undefined };

/**
 * The counts over HTTP at this origin, through `get` (the browser's fetch). A failure to read is
 * null, so the pickers keep the game's order; a failed send is dropped. `keepalive` lets an event
 * sent just before the page is closed still go out.
 */
export function httpCounts(get: (url: string, init?: RequestInit) => Promise<Response>): CountsApi {
  return {
    load: async () => {
      try {
        const response = await get(COUNTS_ROUTE);
        return response.ok ? readCounts(await response.json()) : null;
      } catch (error) {
        if (error instanceof ReadError) console.warn(`${COUNTS_ROUTE}: ${error.message}`);
        return null;
      }
    },
    send: (event) => {
      const init: RequestInit = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(event), keepalive: true };
      try {
        void get(COUNT_ROUTE, init).catch(() => undefined);
      } catch {
        // A fetch that throws at once is dropped like one that rejects: the event is not retried.
      }
    },
  };
}
