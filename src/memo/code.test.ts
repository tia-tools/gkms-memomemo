import { describe, expect, test } from "bun:test";
import { CODE_PREFIX, decodeMemo, encodeMemo, isCodeRefusal, MAX_CODE_LENGTH, MAX_MEMO_BYTES } from "./code.ts";
import { addMemory, addRow, type Edited, isRefusal } from "./edit.ts";
import { emptyMemo, type Memo } from "./types.ts";

const HIF = "memory_ability-p_memory_skill-common-hatsuboshi_idol_festival-p_trigger-start_audition-for_hif_memory-exam_status_enchant-exam_turn_timer-exam_status_enchant-01-001-001";

function ok(result: Edited): Memo {
  if (isRefusal(result)) throw new Error(`refused: ${JSON.stringify(result)}`);
  return result;
}

/** The Purpose's scenario: 成就+ in 好調 with one %%F memory, plus a row whose card the data file lacks (D31). */
function memo(): Memo {
  let m = ok(addRow(emptyMemo(), "sense.kocho", "r1", { card: "p_card-01-act-3_029", upgrade: 1, customization: [], kaimaku: false, hif: HIF }));
  m = addMemory(m, "r1", "%%F", ["diamond", "diamond", "rainbow"]);
  return ok(addRow(m, "sense.common", "r2", { card: "p_card-09-act-9_999", upgrade: 0, customization: [], kaimaku: true, hif: HIF }));
}

/** A code carrying arbitrary bytes, deflated as the page would. */
async function codeOf(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const compressed = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
  return CODE_PREFIX + Buffer.from(compressed).toString("base64url");
}

const textCode = (text: string) => codeOf(new TextEncoder().encode(text));

describe("encodeMemo and decodeMemo", () => {
  test("a memo comes back exactly as it went, ids missing from the data file included (D31)", async () => {
    const code = await encodeMemo(memo());
    expect(code.startsWith("mm1.")).toBe(true);
    expect(code.slice(4)).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeMemo(code)).toStrictEqual(memo());
  });

  test("decodes what Node's own base64url writes, so the encoding is standard", async () => {
    expect(await decodeMemo(await textCode(JSON.stringify(memo())))).toStrictEqual(memo());
  });

  test("ignores white space around a pasted code", async () => {
    expect(await decodeMemo(`  ${await encodeMemo(memo())}\n`)).toStrictEqual(memo());
  });
});

describe("decodeMemo, refusals", () => {
  test("refuses text that is not a memo code", async () => {
    for (const code of ["", "hello", "mm2.AAAA", "MM1.AAAA"]) expect(await decodeMemo(code)).toEqual({ refused: "prefix" });
  });

  test("refuses characters outside base64url and a length base64 cannot have", async () => {
    for (const code of ["mm1.ab+c", "mm1.ab/c", "mm1.abc=", "mm1.a b", "mm1.abcde"]) expect(await decodeMemo(code)).toEqual({ refused: "encoding" });
  });

  test("refuses a code longer than the cap before reading it", async () => {
    expect(await decodeMemo(CODE_PREFIX + "A".repeat(MAX_CODE_LENGTH))).toEqual({ refused: "too-large" });
  });

  test("refuses a stream that is not deflate-raw, or is cut short", async () => {
    expect(await decodeMemo("mm1.AQID-vv8CQk")).toEqual({ refused: "compression" });
    const code = await encodeMemo(memo());
    expect(await decodeMemo(code.slice(0, Math.floor(code.length / 2)))).toEqual({ refused: "compression" });
  });

  test("refuses a small code that inflates past the memo cap", async () => {
    const bomb = await codeOf(new Uint8Array(MAX_MEMO_BYTES + 1));
    expect(bomb.length).toBeLessThan(10_000);
    expect(await decodeMemo(bomb)).toEqual({ refused: "too-large" });
  });

  test("refuses bytes that are not UTF-8 text, and text that is not JSON", async () => {
    expect(await decodeMemo(await codeOf(new Uint8Array([0xff, 0xfe, 0x7b])))).toEqual({ refused: "text" });
    // A JSON string holding a byte that is not UTF-8: a lenient decoder would read it as U+FFFD.
    expect(await decodeMemo(await codeOf(new Uint8Array([0x22, 0xff, 0x22])))).toEqual({ refused: "text" });
    expect(await decodeMemo(await textCode("{ not json"))).toEqual({ refused: "text" });
  });

  test("refuses a memo the reader refuses, with the reader's path as the detail", async () => {
    const result = await decodeMemo(await textCode(JSON.stringify({ ...memo(), formatVersion: 2 })));
    expect(result).toEqual({ refused: "format", detail: "formatVersion: expected 1, not 2" });
    expect(isCodeRefusal(result)).toBe(true);
  });
});
