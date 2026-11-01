/**
 * What the page and this Worker exchange about the anonymous counts (docs/plans/EXECPLAN_MEMORY_MEMO.md,
 * Milestone 6, decisions D11, D12, D30 and D41): the count event the page sends with `POST /count`
 * when a row is created, and the counts `GET /counts` answers, which rank the card and H.I.F.
 * ability pickers. Types and constants only, so the page can import them without any of the
 * Worker's code.
 */

import type { SectionId } from "../../src/memo/types.ts";

export const COUNT_ROUTE = "/count";
export const COUNTS_ROUTE = "/counts";

/** A count event's body in bytes, at most; a real one is under 400. */
export const COUNT_BODY_MAX = 1024;

/** What is counted per section: the card at its level, the H.I.F. ability, each customization step. */
export const COUNT_KINDS = ["card", "hif", "customization"] as const;
export type CountKind = (typeof COUNT_KINDS)[number];

/** The customization id counted for a row with none (D11). */
export const NO_CUSTOMIZATION = "none";

/**
 * `POST /count`'s JSON body, sent once when a row is created and never when one is changed, moved
 * or deleted (D11): the section it was created in, its card (ProduceCard id) and level, its H.I.F.
 * ability (MemoryAbility id), and its customization as `kind:step` strings (ProduceCardCustomize
 * id and customizeCount), empty for none. Nothing else: no contents of the memo and no
 * per-browser identifier (D12).
 */
export interface CountEvent {
  section: SectionId;
  card: string;
  upgrade: number;
  hif: string;
  customization: readonly string[];
}

/**
 * `GET /counts`'s JSON: for each of the nine sections, each kind's counts by id. A card's id carries
 * its level (`cardCountId`), a customization's its step (`stepCountId`) or is `none`; an id never
 * counted is absent.
 */
export interface CountsAnswer {
  formatVersion: 1;
  sections: Record<SectionId, Record<CountKind, Record<string, number>>>;
}

/** A card's counted id: the card at its level (`p_card-01-act-3_029:1`). */
export function cardCountId(card: string, upgrade: number): string {
  return `${card}:${upgrade}`;
}

/** A customization step's counted id, and its form in a count event: `kind:step`. */
export function stepCountId(kind: string, step: number): string {
  return `${kind}:${step}`;
}
