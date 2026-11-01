/**
 * Keeps one open issue listing the cards check.ts found (docs/plans/EXECPLAN_GAME_STYLE_ICONS.md,
 * I7): opened when the list becomes non-empty, its body replaced when the list changes, closed
 * when the list is empty. The list's key in a hidden marker tells whether it changed, so a card
 * that waits for its screenshot does not reopen or repost anything day after day. Only an issue
 * the workflow opened (by github-actions, with the exact title and the marker) is ever touched;
 * that is checked here in `ours`, on every open issue, and not with gh's `--author` filter, which
 * spells the bot differently (`github-actions[bot]`) from the author gh reports
 * (`app/github-actions`): filtering by the latter matched nothing, and every run opened a
 * duplicate (#22).
 *
 *     GH_TOKEN=… bun scripts/icons/issue.ts <dir from check.ts>
 *
 * In a GitHub Actions job, writes `changed` (true when the issue was opened or its list changed,
 * which is when nudge posts), `url`, `title` and `summary` to $GITHUB_OUTPUT.
 */

import { keyOf } from "./check.ts";

export interface OpenIssue {
  number: number;
  title: string;
  body: string;
  url: string;
  author: { login: string };
}

/** The author gh reports for an issue the workflow's token opened. */
export const WORKFLOW_AUTHOR = "app/github-actions";

/** Every open issue with what `ours` needs to tell the workflow's own; 500 reaches past any plausible backlog. */
export const LIST_ARGS: readonly string[] = ["issue", "list", "--state", "open", "--json", "number,title,body,url,author", "--limit", "500"];

export type Action = { kind: "none" } | { kind: "create" } | { kind: "edit"; issue: OpenIssue } | { kind: "close"; issue: OpenIssue };

/** What to do with the workflow's open issue, if any, given today's list. */
export function decide(count: number, key: string, open: OpenIssue | null): Action {
  if (count === 0) return open === null ? { kind: "none" } : { kind: "close", issue: open };
  if (open === null) return { kind: "create" };
  return keyOf(open.body) === key ? { kind: "none" } : { kind: "edit", issue: open };
}

/** Whether the user hears of it: a new list, not a closed or unchanged one. */
export function announce(action: Action): boolean {
  return action.kind === "create" || action.kind === "edit";
}

/**
 * The workflow's own open issue among those listed: opened by github-actions (anyone can open an
 * issue on a public repository and copy the title and the marker), with the exact title and the
 * hidden marker check.ts writes (another workflow of this repository also writes as github-actions).
 */
export function ours(listed: readonly OpenIssue[], title: string): OpenIssue | null {
  return listed.find((i) => i.author.login === WORKFLOW_AUTHOR && i.title === title && keyOf(i.body) !== null) ?? null;
}

/**
 * $GITHUB_OUTPUT lines, `name=value`, each value on one line: a line break in a value (a card name
 * from the data file, say) would otherwise start a line of its own and could set another output.
 */
export function outputLines(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([name, value]) => `${name}=${value.replace(/[\r\n\u2028\u2029]+/g, " ")}\n`)
    .join("");
}

function gh(args: string[]): string {
  const run = Bun.spawnSync(["gh", ...args], { stderr: "pipe", stdout: "pipe" });
  if (run.exitCode !== 0) throw new Error(`gh ${args[0]} ${args[1]}: ${run.stderr.toString().trim()}`);
  return run.stdout.toString().trim();
}

if (import.meta.main) {
  const dir = Bun.argv[2];
  if (dir === undefined) {
    console.error("usage: bun scripts/icons/issue.ts <dir from check.ts>");
    process.exit(1);
  }
  const found: { key: string; count: number; title: string; summary: string } = await Bun.file(`${dir}/needed.json`).json();
  const bodyFile = `${dir}/body.md`;
  const listed: OpenIssue[] = JSON.parse(gh([...LIST_ARGS]));
  const action = decide(found.count, found.key, ours(listed, found.title));
  let url = "";
  if (action.kind === "create") url = gh(["issue", "create", "--title", found.title, "--body-file", bodyFile]);
  if (action.kind === "edit") {
    gh(["issue", "edit", String(action.issue.number), "--body-file", bodyFile]);
    url = action.issue.url;
  }
  if (action.kind === "close") {
    gh(["issue", "close", String(action.issue.number), "--comment", "Every card the page offers has an up-to-date game-style icon again."]);
    url = action.issue.url;
  }
  console.log(`${action.kind}${url === "" ? "" : ` ${url}`}`);
  const outputs = process.env["GITHUB_OUTPUT"];
  if (outputs !== undefined) {
    const changed = announce(action);
    const title = `Game-style icons: ${found.count} card${found.count === 1 ? "" : "s"} to capture`;
    const file = Bun.file(outputs);
    const before = (await file.exists()) ? await file.text() : "";
    await Bun.write(file, before + outputLines({ changed: String(changed), url, title, summary: found.summary }));
  }
}
