/**
 * The library's format files (https://gkms-library.tia.run/formats/), copied here verbatim as its
 * README § Reading it from an app asks (docs/plans/EXECPLAN_LIBRARY_DATA.md, L3). A published format
 * never changes: a change of shape is a new file with the next version number. This test fails on
 * any edit to a copy, a comment included; the hashes are those gkms-library pins for the same files.
 */

import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";

const COPIED: Readonly<Record<string, string>> = {
  "idols.v1.ts": "874674e7f66306213a7e632fdd5299122751ed63b69ac3115a556743b61e425a",
  "latest.v1.ts": "4100dc880a64eb53fc18f1defa3544583a331dcbc38514ea24047461ae0ae0a1",
  "skill-cards.v1.ts": "8829f9d1fa8550fc27299343b4de4019cc1b78fb8f30e1f1d3c6a8f6bada53c4",
};

const sha256 = async (name: string): Promise<string> =>
  createHash("sha256").update(await Bun.file(new URL(name, import.meta.url)).bytes()).digest("hex");

describe("the library's format files", () => {
  test("each is byte for byte what the library published", async () => {
    for (const [name, hash] of Object.entries(COPIED)) expect(`${name} ${await sha256(name)}`).toBe(`${name} ${hash}`);
  });

  test("every format file here is on the list, so a new copy is pinned when it is added", () => {
    const files = readdirSync(import.meta.dirname).filter((name) => /^[a-z-]+\.v\d+\.ts$/.test(name));
    expect(files.toSorted()).toEqual(Object.keys(COPIED).toSorted());
  });
});
