import { describe, expect, test } from "bun:test";
import { marker } from "./check.ts";
import { announce, decide, type OpenIssue, ours } from "./issue.ts";

const KEY = "0123456789ab";
const open = (key: string): OpenIssue => ({ number: 7, title: "Screenshots needed for game-style icons", body: `list\n\n${marker(key)}\n`, url: "https://github.com/x/y/issues/7" });

describe("decide", () => {
  test("opens an issue for a new list, and announces it", () => {
    const action = decide(2, KEY, null);
    expect(action).toEqual({ kind: "create" });
    expect(announce(action)).toBe(true);
  });

  test("leaves an issue whose list is unchanged alone, and says nothing", () => {
    const action = decide(2, KEY, open(KEY));
    expect(action).toEqual({ kind: "none" });
    expect(announce(action)).toBe(false);
  });

  test("rewrites an issue whose list changed, and announces it", () => {
    const action = decide(3, KEY, open("ba9876543210"));
    expect(action).toEqual({ kind: "edit", issue: open("ba9876543210") });
    expect(announce(action)).toBe(true);
  });

  test("closes the issue once nothing is needed, quietly, and does nothing without one", () => {
    expect(decide(0, KEY, open(KEY))).toEqual({ kind: "close", issue: open(KEY) });
    expect(announce(decide(0, KEY, open(KEY)))).toBe(false);
    expect(decide(0, KEY, null)).toEqual({ kind: "none" });
  });
});

describe("ours", () => {
  test("is the open issue with the exact title, if any", () => {
    const other = { ...open(KEY), number: 9, title: "Screenshots needed for game-style icons (old)" };
    expect(ours([other, open(KEY)], "Screenshots needed for game-style icons")?.number).toBe(7);
    expect(ours([other], "Screenshots needed for game-style icons")).toBeNull();
  });
});
