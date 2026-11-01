/**
 * Reads the skill card file gakumas-supportcards publishes (src/data/contract.ts) from untrusted
 * JSON. Every value is checked against the contract and copied into a fresh object, so a field the
 * contract does not name is dropped. Anything else that does not match refuses the whole file, with
 * the path of the first bad value: the page never works from part of the card list. One check goes
 * beyond the types: an empty card or idol list is refused too (docs/plans/EXECPLAN_MEMORY_MEMO.md,
 * decision D43). Adopted from gkms-hif-final-stats' src/data/load.ts, which reads support cards the
 * same way; the readers themselves are src/lib/read.ts.
 */

import { SKILLCARDS_ROUTE } from "../../infra/worker/data.ts";
import { boolean, fail, integer, isFields, list, object, oneOf, type Read, ReadError, req, string } from "../lib/read.ts";
import {
  type CustomizationKind,
  type CustomizationStep,
  type HifAbility,
  type Idol,
  SKILLCARD_DATA_FORMAT_VERSION,
  type SkillCard,
  type SkillCardDataFile,
  type SkillCardPlan,
  type SkillCardRarity,
  type SkillCardType,
} from "./contract.ts";

/** The skill card file could not be had or does not match the contract; the message names where. */
export class SkillCardDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillCardDataError";
  }
}

const PLANS: readonly SkillCardPlan[] = ["sense", "logic", "anomaly", "free"];
const RARITIES: readonly SkillCardRarity[] = ["N", "R", "SR", "SSR", "Legend"];
const TYPES: readonly SkillCardType[] = ["active", "mental"];

const idol: Read<Idol> = (value, path) => {
  const f = object(value, path);
  return { id: req(f, "id", string, path), name: req(f, "name", string, path) };
};

const step: Read<CustomizationStep> = (value, path) => {
  const f = object(value, path);
  return { step: req(f, "step", integer, path), label: req(f, "label", string, path) };
};

const kind: Read<CustomizationKind> = (value, path) => {
  const f = object(value, path);
  return { id: req(f, "id", string, path), steps: req(f, "steps", list(step), path) };
};

const art: Read<SkillCard["art"]> = (value, path) => {
  const f = object(value, path);
  return { asset: req(f, "asset", string, path), perIdol: req(f, "perIdol", boolean, path) };
};

const customization: Read<SkillCard["customization"]> = (value, path) => {
  const f = object(value, path);
  return { limit: req(f, "limit", integer, path), kinds: req(f, "kinds", list(kind), path) };
};

const card: Read<SkillCard> = (value, path) => {
  const f = object(value, path);
  return {
    id: req(f, "id", string, path),
    upgrade: req(f, "upgrade", integer, path),
    name: req(f, "name", string, path),
    plan: req(f, "plan", oneOf(PLANS), path),
    rarity: req(f, "rarity", oneOf(RARITIES), path),
    type: req(f, "type", oneOf(TYPES), path),
    order: req(f, "order", string, path),
    guideLabels: req(f, "guideLabels", list(string), path),
    art: req(f, "art", art, path),
    customization: req(f, "customization", customization, path),
  };
};

const hifAbility: Read<HifAbility> = (value, path) => {
  const f = object(value, path);
  return { id: req(f, "id", string, path), card: req(f, "card", string, path) };
};

/** The skill card file, checked whole; throws `SkillCardDataError` at the first value that does not match. */
export function parseSkillCardData(json: unknown): SkillCardDataFile {
  try {
    return readFile(json);
  } catch (error) {
    if (error instanceof ReadError) throw new SkillCardDataError(error.message);
    throw error;
  }
}

function readFile(json: unknown): SkillCardDataFile {
  if (!isFields(json)) throw new SkillCardDataError("the skill card file: expected an object");
  const version = json["formatVersion"];
  if (version !== SKILLCARD_DATA_FORMAT_VERSION) {
    throw new SkillCardDataError(
      `skill card data format version ${JSON.stringify(version)} is not supported: this page reads version ${SKILLCARD_DATA_FORMAT_VERSION}`,
    );
  }
  // Beyond the types (D43): an empty list means a broken publication, and leaves no idol to draw icons for (D34) or no card to pick.
  const idols = req(json, "idols", list(idol), "");
  if (idols.length === 0) fail("idols", "at least one idol");
  const cards = req(json, "cards", list(card), "");
  if (cards.length === 0) fail("cards", "at least one card");
  return { formatVersion: version, idols, cards, hifAbilities: req(json, "hifAbilities", list(hifAbility), "") };
}

/**
 * The skill card file from this origin's route (infra/worker/data.ts), read by `parseSkillCardData`.
 * `get` is the fetch to use, passed in so a test needs no network. Rejects with `SkillCardDataError`
 * when the route answers with an error status or the file does not match.
 */
export async function loadSkillCardData(get: (url: string) => Promise<Response>): Promise<SkillCardDataFile> {
  const response = await get(SKILLCARDS_ROUTE);
  if (!response.ok) throw new SkillCardDataError(`${SKILLCARDS_ROUTE}: HTTP ${response.status}`);
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new SkillCardDataError(`${SKILLCARDS_ROUTE}: not JSON`);
  }
  return parseSkillCardData(json);
}
