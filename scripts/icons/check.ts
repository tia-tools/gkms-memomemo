/**
 * The daily check of docs/plans/EXECPLAN_GAME_STYLE_ICONS.md (I7, I9): the cards the page offers
 * that have no game-style icon (new cards, drawn as their empty frame until a screenshot is taken)
 * and those whose drawing the game has changed since their screenshot (their stamp's fingerprint
 * differs from the game table's now; they keep the old icon until retaken, I6).
 *
 *     bun scripts/icons/check.ts [--data <path or URL>] [--tables <path or URL>] --out <dir>
 *
 * Reads the live skill card file, the committed index (src/icons/index.v1.json) and stamps
 * (scripts/icons/stamps.json), and ProduceCard.yaml; writes <dir>/needed.json and <dir>/body.md
 * for issue.ts. Builds and uploads nothing: screenshots are taken by hand.
 */

import { offered } from "../../src/app/catalog.ts";
import { type IconIndex, parseIconIndex } from "../../src/app/sheets.ts";
import type { SkillCardDataFile } from "../../src/data/contract.ts";
import { parseSkillCardData } from "../../src/data/load.ts";
import committed from "../../src/icons/index.v1.json";
import { loadFingerprints, PRODUCE_CARD_URL } from "./fingerprint.ts";
import { parseStamps, type Stamps } from "./stamp.ts";

export const DATA_URL = "https://gakumas-supportcards.tia.run/data/skillcards.v1.json";
export const ISSUE_TITLE = "Screenshots needed for game-style icons";
const MARKER = "icons-check";

export interface Needed {
  cell: string;
  name: string;
  /** Where its screenshot goes under temp/skill_cards: `base/SR`, `enhanced/R`. */
  folder: string;
  reason: "new" | "changed";
}

/** The offered cards, in the file's order, that have no cell, or whose stamp no longer matches the game. */
export function needed(data: SkillCardDataFile, index: IconIndex, stamps: Stamps, current: ReadonlyMap<string, string>): Needed[] {
  const built = new Set(index.plans.flatMap((p) => p.cells));
  const out: Needed[] = [];
  for (const card of data.cards.filter(offered)) {
    const cell = `${card.id}:${card.upgrade}`;
    const base = { cell, name: card.name, folder: `${card.upgrade === 0 ? "base" : "enhanced"}/${card.rarity}` };
    if (!built.has(cell)) {
      out.push({ ...base, reason: "new" });
      continue;
    }
    const stamp = stamps.cells[cell];
    if (stamp === undefined || stamp.fingerprint !== current.get(cell)) out.push({ ...base, reason: "changed" });
  }
  return out;
}

/** A short hash of the list, so the issue is touched only when the list changes. */
export function listKey(list: readonly Needed[]): string {
  const lines = list.map((n) => `${n.cell} ${n.reason}`).sort().join("\n");
  return new Bun.CryptoHasher("sha256").update(lines).digest("hex").slice(0, 12);
}

export function marker(key: string): string {
  return `<!-- ${MARKER}: ${key} -->`;
}

/** The key a body carries, or null. */
export function keyOf(body: string): string | null {
  return /<!-- icons-check: ([0-9a-f]{12}) -->/.exec(body)?.[1] ?? null;
}

function lines(list: readonly Needed[]): string {
  return list.map((n) => `- ${n.name} — \`${n.folder}\` — \`${n.cell}\``).join("\n");
}

/** The issue's body: what to capture, where it goes, and what the page does meanwhile. */
export function issueBody(list: readonly Needed[]): string {
  const fresh = list.filter((n) => n.reason === "new");
  const changed = list.filter((n) => n.reason === "changed");
  const parts = [
    "The daily check (`.github/workflows/icons.yml`) found cards the page offers without an up-to-date game-style icon. Take a P図鑑 screenshot of each (720 × 1280, the card selected), put it in `temp/skill_cards/<folder>/`, and follow `docs/plans/EXECPLAN_GAME_STYLE_ICONS.md` § Concrete Steps to lift, build, upload and stamp. A retaken screenshot replaces the old one in its folder. Until then a new card is drawn as its empty frame with its name, and a changed card keeps its old icon.",
  ];
  if (fresh.length > 0) parts.push(`## New cards (${fresh.length})\n\n${lines(fresh)}`);
  if (changed.length > 0) parts.push(`## Changed in the game since their screenshot (${changed.length})\n\n${lines(changed)}`);
  parts.push(marker(listKey(list)));
  return `${parts.join("\n\n")}\n`;
}

/** One line for Discord: the counts and the first few names. */
export function summary(list: readonly Needed[]): string {
  const fresh = list.filter((n) => n.reason === "new").length;
  const names = list.slice(0, 8).map((n) => n.name);
  const more = list.length > names.length ? ` and ${list.length - names.length} more` : "";
  return `${fresh} new, ${list.length - fresh} changed: ${names.join(", ")}${more}`;
}

async function json(source: string): Promise<unknown> {
  if (!/^https?:\/\//.test(source)) return Bun.file(source).json();
  const response = await fetch(source);
  if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`);
  return response.json();
}

function arg(name: string, fallback: string): string {
  const at = Bun.argv.indexOf(name);
  return at > 0 ? (Bun.argv[at + 1] ?? fallback) : fallback;
}

if (import.meta.main) {
  const out = arg("--out", "");
  if (out === "") {
    console.error("usage: bun scripts/icons/check.ts [--data <path or URL>] [--tables <path or URL>] --out <dir>");
    process.exit(1);
  }
  const data = parseSkillCardData(await json(arg("--data", DATA_URL)));
  const stamps = parseStamps(await Bun.file(new URL("stamps.json", import.meta.url)).json());
  const list = needed(data, parseIconIndex(committed), stamps, await loadFingerprints(arg("--tables", PRODUCE_CARD_URL)));
  const count = list.length;
  await Bun.write(`${out}/needed.json`, `${JSON.stringify({ key: listKey(list), count, title: ISSUE_TITLE, summary: count === 0 ? "" : summary(list) })}\n`);
  await Bun.write(`${out}/body.md`, issueBody(list));
  console.log(count === 0 ? "every offered card has an up-to-date icon" : summary(list));
}
