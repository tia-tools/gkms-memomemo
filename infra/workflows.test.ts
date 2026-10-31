/**
 * The CI workflows cannot run here, so their shape is pinned instead: what triggers each, that
 * neither may write, that every action is pinned to a commit hash, that CI runs the Bun these tests
 * run on, and that the deploy runs every gate before it deploys. Removing a gate or moving the
 * deploy first fails here, rather than turning the gate off without a sound.
 */

import { describe, expect, test } from "bun:test";

type Step = { uses?: string; run?: string; with?: Record<string, unknown>; env?: Record<string, unknown>; "working-directory"?: string };

async function load(name: string): Promise<Record<string, unknown>> {
  const parsed: unknown = Bun.YAML.parse(await Bun.file(new URL(`../.github/workflows/${name}`, import.meta.url)).text());
  if (typeof parsed !== "object" || parsed === null) throw new Error(`${name}: not a mapping`);
  return Object.fromEntries(Object.entries(parsed));
}

function jobs(workflow: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const all: unknown = workflow["jobs"];
  if (typeof all !== "object" || all === null) throw new Error("no jobs");
  return Object.fromEntries(Object.entries(all).map(([name, job]: [string, unknown]) => [name, typeof job === "object" && job !== null ? Object.fromEntries(Object.entries(job)) : {}]));
}

function steps(workflow: Record<string, unknown>, job: string): Step[] {
  const list: unknown = jobs(workflow)[job]?.["steps"];
  if (!Array.isArray(list)) throw new Error(`no steps in job ${job}`);
  return list.filter((s): s is Step => typeof s === "object" && s !== null);
}

/** The only actions the Bun jobs may use, in this order, before any `run` step. */
const ACTIONS = ["actions/checkout", "oven-sh/setup-bun"];
/** The only actions the icon pipeline's job may use, in this order. */
const UV_ACTIONS = ["actions/checkout", "astral-sh/setup-uv"];

const GATES = ["bun install --frozen-lockfile", "bun test", "bun run type-check", "bun run lint", "bun run build"];
const check = await load("check.yml");
const deploy = await load("deploy.yml");

describe("the workflows", () => {
  test("neither may write to the repository, and no job widens that", () => {
    for (const w of [check, deploy]) {
      expect(w["permissions"]).toEqual({ contents: "read" });
      for (const [name, job] of Object.entries(jobs(w))) expect({ name, permissions: job["permissions"] }).toEqual({ name, permissions: undefined });
    }
  });

  test("each job uses only its actions, first, then run steps; check has the icon pipeline's job beside its own", () => {
    expect(Object.keys(jobs(deploy))).toEqual(["deploy"]);
    expect(Object.keys(jobs(check))).toEqual(["check", "icons"]);
    for (const [w, job, actions] of [[check, "check", ACTIONS], [deploy, "deploy", ACTIONS], [check, "icons", UV_ACTIONS]] as const) {
      const list = steps(w, job);
      expect(list.slice(0, actions.length).map((s) => s.uses?.split("@")[0])).toEqual([...actions]);
      expect(list.slice(actions.length).filter((s) => s.uses !== undefined)).toEqual([]);
    }
  });

  test("every action is pinned to a full commit hash, and CI runs this Bun", () => {
    for (const [w, job] of [[check, "check"], [deploy, "deploy"], [check, "icons"]] as const) {
      for (const s of steps(w, job)) {
        if (s.uses !== undefined) expect(s.uses).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
        if (s.uses?.startsWith("oven-sh/setup-bun@") === true) expect(s.with?.["bun-version"]).toBe(Bun.version);
      }
    }
  });

  test("check runs every gate on each pull request into develop, and the icon pipeline's tests from its lockfile", () => {
    expect(check["on"]).toEqual({ pull_request: { branches: ["develop"] } });
    expect(steps(check, "check").flatMap((s) => (s.run === undefined ? [] : [s.run]))).toEqual(GATES);
    const icons = steps(check, "icons").filter((s) => s.run !== undefined);
    expect(icons.map((s) => [s.run, s["working-directory"]])).toEqual([["uv run --frozen pytest", "scripts/icons"]]);
  });

  test("deploy runs from main, every gate first, then wrangler with the two secrets", () => {
    const on: unknown = deploy["on"];
    expect(on).toMatchObject({ push: { branches: ["main"] }, workflow_dispatch: null });
    expect(JSON.stringify(on)).toContain("src/**");
    expect(JSON.stringify(on)).toContain("infra/worker/**");
    const list = steps(deploy, "deploy");
    expect(list[0]?.with?.["ref"]).toBe("main");
    const runs = list.flatMap((s) => (s.run === undefined ? [] : [s.run]));
    expect(runs).toEqual([...GATES, "bunx wrangler@4 deploy"]);
    const last = list.at(-1);
    expect(last?.["working-directory"]).toBe("infra/worker");
    expect(last?.env).toEqual({ CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}", CLOUDFLARE_ACCOUNT_ID: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}" });
    expect(deploy["concurrency"]).toEqual({ group: "deploy-production", "cancel-in-progress": false });
  });
});
