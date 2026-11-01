import { describe, expect, test } from "bun:test";
import { parseCells, parseStamps, stamp, type Stamps } from "./stamp.ts";

const previous: Stamps = { formatVersion: 1, cells: { "a:0": { shot: "11111111", fingerprint: "aaaaaaaa" }, "gone:0": { shot: "22222222", fingerprint: "bbbbbbbb" } } };
const now = new Map([["a:0", "cccccccc"], ["b:1", "dddddddd"]]);

describe("stamp", () => {
  test("keeps a cell's stamp while its screenshot is the same, even after the game changed it", () => {
    const { stamps, restamped } = stamp(previous, { "a:0": "11111111" }, now);
    expect(stamps.cells["a:0"]).toEqual({ shot: "11111111", fingerprint: "aaaaaaaa" });
    expect(restamped).toEqual([]);
  });

  test("stamps a new or retaken screenshot with the tables as they are now, and drops cells no longer built", () => {
    const { stamps, restamped } = stamp(previous, { "b:1": "33333333", "a:0": "44444444" }, now);
    expect(stamps).toEqual({ formatVersion: 1, cells: { "a:0": { shot: "44444444", fingerprint: "cccccccc" }, "b:1": { shot: "33333333", fingerprint: "dddddddd" } } });
    expect(restamped).toEqual(["a:0", "b:1"]);
  });

  test("refuses a cell the tables do not have", () => {
    expect(() => stamp(null, { "x:0": "55555555" }, now)).toThrow("x:0");
  });

  test("reads only well-formed files", () => {
    expect(parseStamps(previous)).toEqual(previous);
    expect(() => parseStamps({ formatVersion: 2, cells: {} })).toThrow();
    expect(() => parseStamps({ formatVersion: 1, cells: { "a:0": { shot: "xyz", fingerprint: "aaaaaaaa" } } })).toThrow("8 hex");
    expect(parseCells({ "a:0": "11111111" })).toEqual({ "a:0": "11111111" });
    expect(() => parseCells({ "a:0": 1 })).toThrow();
  });
});
