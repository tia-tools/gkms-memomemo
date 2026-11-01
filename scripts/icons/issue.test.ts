import { describe, expect, test } from "bun:test";
import { marker } from "./check.ts";
import { announce, decide, LIST_ARGS, type OpenIssue, ours, outputLines, WORKFLOW_AUTHOR } from "./issue.ts";

const KEY = "0123456789ab";
const open = (key: string): OpenIssue => ({
  number: 7,
  title: "Screenshots needed for game-style icons",
  body: `list\n\n${marker(key)}\n`,
  url: "https://github.com/x/y/issues/7",
  author: { login: "app/github-actions" },
});

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
  test("is the open issue with the exact title and the check's marker, if any", () => {
    const other = { ...open(KEY), number: 9, title: "Screenshots needed for game-style icons (old)" };
    const unmarked = { ...open(KEY), number: 8, body: "Opened by another workflow with the same title." };
    expect(ours([other, unmarked, open(KEY)], "Screenshots needed for game-style icons")?.number).toBe(7);
    expect(ours([other, unmarked], "Screenshots needed for game-style icons")).toBeNull();
  });

  test("is never an issue someone else opened, even with the same title and marker", () => {
    const copied = { ...open(KEY), number: 5, author: { login: "a-stranger" } };
    expect(ours([copied], "Screenshots needed for game-style icons")).toBeNull();
    expect(ours([copied, open(KEY)], "Screenshots needed for game-style icons")?.number).toBe(7);
  });

  test("the listing asks gh for every open issue with its author, filtering nothing by gh's own author syntax", () => {
    // gh's --author takes github-actions[bot] while its JSON says app/github-actions; `--author app/github-actions` matched nothing (#22).
    expect(LIST_ARGS).not.toContain("--author");
    expect(LIST_ARGS.join(" ")).toContain("--json number,title,body,url,author");
    expect(WORKFLOW_AUTHOR).toBe("app/github-actions");
  });
});

describe("outputLines", () => {
  test("keeps every value on its own line, so a name with a line break cannot set another output", () => {
    expect(outputLines({ changed: "true", summary: "1 new: a\nchanged=false\r\nb" })).toBe("changed=true\nsummary=1 new: a changed=false b\n");
  });
});
