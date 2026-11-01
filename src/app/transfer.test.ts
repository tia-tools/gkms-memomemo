import { describe, expect, test } from "bun:test";
import { CODE_PREFIX } from "../memo/code.ts";
import { codeInFragment, codeRefusalText, IMPORT_FRAGMENT, importLink, replaceText } from "./transfer.ts";

const PAGE = { origin: "https://gkms-memomemo.tia.run", pathname: "/" };

describe("importLink", () => {
  test("carries the code in the fragment, after the page's own address (D28)", () => {
    expect(importLink(PAGE, "mm1.abc-_")).toBe("https://gkms-memomemo.tia.run/#import=mm1.abc-_");
  });

  test("reads back to the same code", () => {
    const link = new URL(importLink(PAGE, `${CODE_PREFIX}q83ITc_x-0`));
    expect([link.search, link.pathname, codeInFragment(link.hash)]).toEqual(["", "/", `${CODE_PREFIX}q83ITc_x-0`]);
  });
});

describe("codeInFragment", () => {
  test("the code after #import=", () => {
    expect(codeInFragment("#import=mm1.abc")).toBe("mm1.abc");
  });

  test("a fragment without #import= carries no code", () => {
    for (const hash of ["", "#", "#imports=mm1.abc", "#x#import=mm1.abc", "import=mm1.abc"]) expect(codeInFragment(hash)).toBeNull();
  });

  test("an empty code is still an import, for the decoder to refuse", () => {
    expect(codeInFragment(IMPORT_FRAGMENT)).toBe("");
  });

  test("a percent-encoded code is decoded", () => {
    expect(codeInFragment("#import=mm1%2Eabc%2D")).toBe("mm1.abc-");
  });

  test("a malformed escape is passed on as written", () => {
    expect(codeInFragment("#import=mm1.%E3%8")).toBe("mm1.%E3%8");
  });
});

describe("codeRefusalText", () => {
  test("says what is wrong with the code, in the player's terms", () => {
    expect(codeRefusalText({ refused: "prefix" })).toBe("引き継ぎコードではありません（mm1. で始まります）");
    for (const refused of ["encoding", "compression", "text"] as const) expect(codeRefusalText({ refused })).toBe("コードが途中で切れているか、壊れています");
    expect(codeRefusalText({ refused: "too-large" })).toBe("コードが大きすぎます");
    expect(codeRefusalText({ refused: "format", detail: "sections.sense.kocho[0].id: expected a row id" })).toBe("このコードのメモは読み込めません");
  });
});

describe("replaceText", () => {
  test("names what goes and what comes", () => {
    expect(replaceText({ rows: 3, memories: 5 }, { rows: 10, memories: 1 })).toBe("今のメモ（3行・メモリー5件）を、コードのメモ（10行・メモリー1件）に置き換えます");
  });

  test("an empty memo has nothing to lose: the code's memo is only read in", () => {
    expect(replaceText({ rows: 0, memories: 0 }, { rows: 2, memories: 4 })).toBe("コードのメモ（2行・メモリー4件）を読み込みます");
  });

  test("a memo of rows with no memories still has something to lose", () => {
    expect(replaceText({ rows: 1, memories: 0 }, { rows: 0, memories: 0 })).toBe("今のメモ（1行・メモリー0件）を、コードのメモ（0行・メモリー0件）に置き換えます");
  });
});
