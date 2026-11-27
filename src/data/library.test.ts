import { describe, expect, test } from "bun:test";
import { SKILL_CARDS } from "../test-support/skillcards.ts";
import { LIBRARY, LibraryError, loadLibrary, POINTER } from "./library.ts";

const text = (name: string): Promise<string> => Bun.file(new URL(`fixtures/${name}`, import.meta.url)).text();

/** The pointer as the library answered it on 2026-11-27 at 13:12Z, and the two releases it named. */
const POINTER_TEXT = await text("latest.v1.20261127T1126Z.json");
const SKILL_CARDS_PATH = "data/skill-cards/v1/20261127T1126Z-a09c6f2a.json";
const IDOLS_PATH = "data/idols/v1/20261116T1124Z-5122c626.json";
const FILES: Record<string, string> = {
  [POINTER]: POINTER_TEXT,
  [SKILL_CARDS_PATH]: await text("skill-cards.v1.20261127T1126Z-a09c6f2a.json"),
  [IDOLS_PATH]: await text("idols.v1.20261116T1124Z-5122c626.json"),
};

/** A fake address serving `files` (path → body, or an HTTP status) under `base`, recording what was asked. */
function address(files: Record<string, string | number>, base = LIBRARY) {
  const asked: string[] = [];
  const get = async (url: string): Promise<Response> => {
    asked.push(url);
    const body = url.startsWith(`${base}/`) ? files[url.slice(base.length + 1)] : undefined;
    if (body === undefined) return new Response("not found", { status: 404 });
    return typeof body === "number" ? new Response("error", { status: body }) : new Response(body);
  };
  return { asked, get };
}

/** What `loadLibrary` rejects with; a resolved load fails the test. */
async function refusal(files: Record<string, string | number>): Promise<Error> {
  const outcome: unknown = await loadLibrary(address(files).get).then(
    () => new Error("loaded"),
    (error: unknown) => error,
  );
  if (!(outcome instanceof LibraryError)) throw new Error(`expected a LibraryError, got ${String(outcome)}`);
  return outcome;
}

describe("loadLibrary", () => {
  test("reads the pointer, then the two releases it names, into the pool", async () => {
    const { asked, get } = address(FILES);
    expect(await loadLibrary(get)).toStrictEqual(SKILL_CARDS);
    expect(asked).toEqual([`${LIBRARY}/${POINTER}`, `${LIBRARY}/${SKILL_CARDS_PATH}`, `${LIBRARY}/${IDOLS_PATH}`]);
  });

  test("reads from another address when given one", async () => {
    const { asked, get } = address(FILES, "http://localhost:1");
    expect((await loadLibrary(get, "http://localhost:1")).cards.length).toBe(361);
    expect(asked[0]).toBe(`http://localhost:1/${POINTER}`);
  });

  test("names the file and the status when one answers an error", async () => {
    expect((await refusal({ ...FILES, [POINTER]: 503 })).message).toBe(`${LIBRARY}/${POINTER}: HTTP 503`);
    expect((await refusal({ ...FILES, [IDOLS_PATH]: 404 })).message).toBe(`${LIBRARY}/${IDOLS_PATH}: HTTP 404`);
  });

  test("names the file and the place when one is not JSON or breaks its format", async () => {
    expect((await refusal({ ...FILES, [SKILL_CARDS_PATH]: "{" })).message).toBe(`${LIBRARY}/${SKILL_CARDS_PATH}: not JSON`);
    const broken = JSON.parse(FILES[SKILL_CARDS_PATH] ?? "");
    broken.cards[2].plan = "dance";
    expect((await refusal({ ...FILES, [SKILL_CARDS_PATH]: JSON.stringify(broken) })).message).toStartWith(`${LIBRARY}/${SKILL_CARDS_PATH}: skill-cards v1: cards.2.plan:`);
    expect((await refusal({ ...FILES, [POINTER]: "{}" })).message).toStartWith(`${LIBRARY}/${POINTER}: latest v1:`);
  });

  test("checks the idols release by its own format too", async () => {
    const idols = JSON.parse(FILES[IDOLS_PATH] ?? "");
    idols.idols[0].id = "Hski";
    expect((await refusal({ ...FILES, [IDOLS_PATH]: JSON.stringify(idols) })).message).toStartWith(`${LIBRARY}/${IDOLS_PATH}: idols v1: idols.0.id:`);
  });

  test("takes version 1 of a format when the pointer also names a later version", async () => {
    const pointer = JSON.parse(POINTER_TEXT);
    const v1 = pointer.files.find((file: { format: string }) => file.format === "skill-cards");
    const v2 = { ...v1, formatVersion: 2, path: v1.path.replace("/v1/", "/v2/") };
    pointer.files.unshift(v2);
    const { asked, get } = address({ ...FILES, [POINTER]: JSON.stringify(pointer) });
    expect((await loadLibrary(get)).cards.length).toBe(361);
    expect(asked).toContain(`${LIBRARY}/${SKILL_CARDS_PATH}`);
  });

  test("refuses a pointer that names no release of a format it needs", async () => {
    const pointer = JSON.parse(POINTER_TEXT);
    pointer.files = pointer.files.filter((file: { format: string }) => file.format !== "idols");
    expect((await refusal({ ...FILES, [POINTER]: JSON.stringify(pointer) })).message).toBe(`${POINTER}: names no release of idols v1`);
  });

  test("refuses files that leave no card in the pool", async () => {
    const legend = JSON.parse(FILES[SKILL_CARDS_PATH] ?? "");
    for (const card of legend.cards) card.rarity = "Legend";
    expect((await refusal({ ...FILES, [SKILL_CARDS_PATH]: JSON.stringify(legend) })).message).toContain("no card that can be a produce memory");
  });

  test("names the file when the fetch itself fails", async () => {
    const outcome: unknown = await loadLibrary(async () => {
      throw new Error("offline");
    }).catch((error: unknown) => error);
    expect(outcome).toEqual(new LibraryError(`${LIBRARY}/${POINTER}: offline`));
  });
});
