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

/** The only actions either workflow may use, in this order, before any `run` step. */
const ACTIONS = ["actions/checkout", "oven-sh/setup-bun"];

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

  test("each job is a single job using only checkout and setup-bun, first, then run steps", () => {
    for (const [w, job] of [[check, "check"], [deploy, "deploy"]] as const) {
      expect(Object.keys(jobs(w))).toEqual([job]);
      const list = steps(w, job);
      expect(list.slice(0, ACTIONS.length).map((s) => s.uses?.split("@")[0])).toEqual(ACTIONS);
      expect(list.slice(ACTIONS.length).filter((s) => s.uses !== undefined)).toEqual([]);
    }
  });

  test("every action is pinned to a full commit hash, and CI runs this Bun", () => {
    for (const [w, job] of [[check, "check"], [deploy, "deploy"]] as const) {
      for (const s of steps(w, job)) {
        if (s.uses !== undefined) expect(s.uses).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
        if (s.uses?.startsWith("oven-sh/setup-bun@") === true) expect(s.with?.["bun-version"]).toBe(Bun.version);
      }
    }
  });

  test("check runs every gate on each pull request into develop", () => {
    expect(check["on"]).toEqual({ pull_request: { branches: ["develop"] } });
    expect(steps(check, "check").flatMap((s) => (s.run === undefined ? [] : [s.run]))).toEqual(GATES);
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
