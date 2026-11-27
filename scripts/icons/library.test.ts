import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LibraryError, POINTER } from "../../src/data/library.ts";
import { SKILL_CARDS } from "../../src/test-support/skillcards.ts";
import { readLibrary } from "./library.ts";

const FIXTURES = new URL("../../src/data/fixtures/", import.meta.url).pathname;
const site = mkdtempSync(join(tmpdir(), "library-site-"));
afterAll(() => rmSync(site, { recursive: true, force: true }));

/** A directory laid out like the address, holding the pointer and the two releases of the fixtures. */
for (const [from, to] of [
  ["latest.v1.20261127T1126Z.json", POINTER],
  ["skill-cards.v1.20261127T1126Z-a09c6f2a.json", "data/skill-cards/v1/20261127T1126Z-a09c6f2a.json"],
  ["idols.v1.20261116T1124Z-5122c626.json", "data/idols/v1/20261116T1124Z-5122c626.json"],
] as const) {
  await Bun.write(join(site, to), Bun.file(join(FIXTURES, from)));
}

describe("readLibrary", () => {
  test("reads a local directory laid out like the address, with or without a trailing slash", async () => {
    expect(await readLibrary(site)).toStrictEqual(SKILL_CARDS);
    expect((await readLibrary(`${site}/`)).cards.length).toBe(361);
  });

  test("answers a missing file as the address would, a 404", async () => {
    const outcome: unknown = await readLibrary(join(site, "nowhere")).catch((error: unknown) => error);
    expect(outcome).toEqual(new LibraryError(`${join(site, "nowhere")}/${POINTER}: HTTP 404`));
  });
});
