/**
 * A count event (count-contract.ts), read from the untrusted body of `POST /count` and checked
 * against the skill card file the Worker proxies (docs/plans/EXECPLAN_MEMORY_MEMO.md, D11 and D30),
 * then turned into the count rows it adds 1 to. An event naming anything the section's tab does not
 * offer is refused whole and counts nothing. What a tab offers is the page's own rule
 * (src/app/catalog.ts), and a customization is checked by the memo's own (src/memo/build.ts), so
 * the Worker cannot accept what the page would never send.
 */

import type { SkillCard, SkillCardDataFile } from "../../src/data/contract.ts";
import { makeCatalog } from "../../src/app/catalog.ts";
import { customizationProblem } from "../../src/memo/build.ts";
import { type ChosenStep, PLAN_IDS, planOf, SECTION_IDS, type SectionId } from "../../src/memo/types.ts";
import { cardCountId, type CountKind, NO_CUSTOMIZATION, stepCountId } from "./count-contract.ts";

/** A count event as read: its customization as chosen steps. */
export interface ReadEvent {
  section: SectionId;
  card: string;
  upgrade: number;
  hif: string;
  steps: ChosenStep[];
}

/** One count `POST /count` adds 1 to. */
export interface CountRow {
  section: SectionId;
  kind: CountKind;
  id: string;
}

const EVENT_FIELDS = ["section", "card", "upgrade", "hif", "customization"];
/** A memo's customization step is 1 to 9 (src/memo/read.ts); a step is written as one digit. */
const STEP = /^[1-9]$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `kind:step` as a chosen step, or null. */
function chosenStep(value: unknown): ChosenStep | null {
  if (typeof value !== "string") return null;
  const at = value.lastIndexOf(":");
  const kind = value.slice(0, at);
  const step = value.slice(at + 1);
  return at > 0 && STEP.test(step) ? { kind, step: Number(step) } : null;
}

function chosenSteps(value: unknown): ChosenStep[] | null {
  if (!Array.isArray(value)) return null;
  const steps = value.map(chosenStep);
  return steps.every((s) => s !== null) ? steps.filter((s) => s !== null) : null;
}

/** The event, or null when it is not JSON, has a field missing, extra or of the wrong type, or names no section. */
export function parseCountEvent(raw: string): ReadEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  // Exactly the five fields: one more is refused here, and a missing one fails its own check below.
  if (Object.keys(value).length !== EVENT_FIELDS.length) return null;
  const { section, card, upgrade, hif, customization } = value;
  const known = SECTION_IDS.find((s) => s === section);
  const steps = chosenSteps(customization);
  if (known === undefined || typeof card !== "string" || typeof hif !== "string" || steps === null) return null;
  if (upgrade !== 0 && upgrade !== 1) return null;
  return { section: known, card, upgrade, hif, steps };
}

/** The rows an event counts, or null when the section's tab does not offer what it names. */
export type CountRules = (event: ReadEvent) => CountRow[] | null;

/**
 * The rules for one skill card file: an event's card must be one its section's tab offers, at that
 * level (D8, D54); its H.I.F. ability one of the tab's (D19); its customization steps the card's
 * own, within the card's limit and D39's cap of 2. It counts its card, its ability, and each
 * customization step, or `none` (D11).
 */
export function countRules(data: SkillCardDataFile): CountRules {
  const catalog = makeCatalog(data);
  const tabs = new Map(
    PLAN_IDS.map((plan) => [
      plan,
      {
        cards: new Map<string, SkillCard>(catalog.tabCards(plan).map((c) => [cardCountId(c.id, c.upgrade), c])),
        hifs: new Set(catalog.tabAbilities(plan).map((h) => h.ability.id)),
      },
    ]),
  );
  return (event) => {
    const tab = tabs.get(planOf(event.section));
    const card = tab?.cards.get(cardCountId(event.card, event.upgrade));
    if (tab === undefined || card === undefined || !tab.hifs.has(event.hif)) return null;
    if (customizationProblem(event.steps, card) !== null) return null;
    const { section } = event;
    const customization = event.steps.length === 0 ? [NO_CUSTOMIZATION] : event.steps.map((s) => stepCountId(s.kind, s.step));
    return [
      { section, kind: "card", id: cardCountId(card.id, card.upgrade) },
      { section, kind: "hif", id: event.hif },
      ...customization.map((id): CountRow => ({ section, kind: "customization", id })),
    ];
  };
}
