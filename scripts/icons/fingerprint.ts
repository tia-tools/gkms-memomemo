/**
 * A card's fingerprint: what the game draws on its icon, as a short hash of its row in the game
 * table `ProduceCard.yaml` (docs/plans/EXECPLAN_GAME_STYLE_ICONS.md, I9). The published data file
 * does not carry cost, values or effects, so the table is read directly. Every field counts except
 * those listed as never drawn, so a field the game adds later makes a card look changed rather
 * than hiding a change: a needless retake costs less than a stale icon.
 */

import { child, fail, integer, isFields, list, object, ReadError, req, string } from "../../src/lib/read.ts";

export const PRODUCE_CARD_URL = "https://raw.githubusercontent.com/vertesan/gakumasu-diff/main/ProduceCard.yaml";

/** Fields of a row the icon never shows: names, art, voice, unlocking, where the card comes from, release. */
export const NOT_DRAWN: readonly string[] = [
  "name",
  "assetId",
  "isCharacterAsset",
  "voiceAssetId",
  "isInitial",
  "isRestrict",
  "searchTag",
  "libraryHidden",
  "isReward",
  "unlockProducerLevel",
  "rentalUnlockProducerLevel",
  "evaluation",
  "originIdolCardId",
  "originSupportCardId",
  "isInitialDeckProduceCard",
  "produceCardCustomizeIds",
  "maxCustomizeCount",
  "originCharacterId",
  "originPrimaStellaIdolCardId",
  "viewStartTime",
  "isLimited",
  "order",
];

/** JSON with every object's keys sorted, so the same row always hashes alike. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isFields(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function fingerprint(row: Record<string, unknown>): string {
  const drawn = Object.fromEntries(Object.entries(row).filter(([key]) => !NOT_DRAWN.includes(key)));
  return new Bun.CryptoHasher("sha256").update(canonical(drawn)).digest("hex").slice(0, 8);
}

/** Every row's fingerprint by its cell, `<card id>:<level>`; throws at a row without an id or a level. */
export function fingerprints(rows: unknown): Map<string, string> {
  const out = new Map<string, string>();
  for (const [i, value] of list(object)(rows, "ProduceCard").entries()) {
    const path = child("ProduceCard", String(i));
    out.set(`${req(value, "id", string, path)}:${req(value, "upgradeCount", integer, path)}`, fingerprint(value));
  }
  if (out.size === 0) fail("ProduceCard", "at least one row");
  return out;
}

/** The fingerprints of the table at a URL or a local path. */
export async function loadFingerprints(source: string): Promise<Map<string, string>> {
  const text = /^https?:\/\//.test(source) ? await fetchText(source) : await Bun.file(source).text();
  try {
    return fingerprints(Bun.YAML.parse(text));
  } catch (error) {
    if (error instanceof ReadError) throw new Error(`${source}: ${error.message}`);
    throw error;
  }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}
