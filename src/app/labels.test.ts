import { describe, expect, test } from "bun:test";
import { ID_SHAPES } from "../memo/read.ts";
import { newRowId, ROW_ID_BYTES, rowIdFrom } from "./ids.ts";
import { columnLabels, refusalText } from "./labels.ts";

describe("columnLabels", () => {
  test("writes a percentage bonus % and a fixed bonus +, in Vo, Da, Vi order", () => {
    expect(columnLabels("%%F")).toEqual(["Vo%", "Da%", "Vi+"]);
    expect(columnLabels("F%%")).toEqual(["Vo+", "Da%", "Vi%"]);
    expect(columnLabels("FFF")).toEqual(["Vo+", "Da+", "Vi+"]);
  });
});

describe("refusalText", () => {
  test("names the section that holds a duplicate", () => {
    expect(refusalText({ refused: "duplicate", section: "logic.koinsho", row: "r1" })).toBe("同じ組み合わせが「好印象」にあります");
  });
});

describe("rowIdFrom", () => {
  test("writes the bytes as base64url without padding", () => {
    expect(rowIdFrom(new Uint8Array([0xfb, 0xff, 0xbf]))).toBe("-_-_");
    expect(rowIdFrom(new Uint8Array([1]))).toBe("AQ");
  });

  test("a new id has the row id's shape and 16 characters, and two differ", () => {
    const [a, b] = [newRowId(), newRowId()];
    expect(ID_SHAPES.row.test(a)).toBe(true);
    expect(a.length).toBe((ROW_ID_BYTES * 4) / 3);
    expect(a).not.toBe(b);
  });
});
