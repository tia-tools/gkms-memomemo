import { describe, expect, test } from "bun:test";
import { WORKER_FIRST } from "./worker.ts";

const config: unknown = Bun.TOML.parse(await Bun.file(new URL("./wrangler.toml", import.meta.url)).text());

function table(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("not a table");
  return Object.fromEntries(Object.entries(value));
}

const root = table(config);

describe("wrangler.toml", () => {
  test("deploys the Worker on its own tia.run subdomain (D24)", () => {
    expect(root["name"]).toBe("gkms-memomemo");
    expect(root["routes"]).toEqual([{ pattern: "gkms-memomemo.tia.run", custom_domain: true }]);
  });

  test("runs the Worker first exactly on the paths worker.ts answers, and serves dist/ for the rest", () => {
    const assets = table(root["assets"]);
    expect(assets["directory"]).toBe("../../dist");
    expect(assets["binding"]).toBe("ASSETS");
    expect(assets["run_worker_first"]).toEqual([...WORKER_FIRST]);
  });

  test("binds the sibling's bucket as IMAGES, the name the Worker's Env reads", () => {
    expect(root["r2_buckets"]).toEqual([{ binding: "IMAGES", bucket_name: "tia-assets" }]);
  });

  test("binds the counts' database as DB, the name the Worker's Env reads, with its migrations beside this file", async () => {
    const databases = root["d1_databases"];
    expect(Array.isArray(databases) ? databases.length : 0).toBe(1);
    const db = table(Array.isArray(databases) ? databases[0] : null);
    expect(db["binding"]).toBe("DB");
    expect(db["database_name"]).toBe("gkms-memomemo");
    expect(db["migrations_dir"]).toBe("migrations");
    const files = await Array.fromAsync(new Bun.Glob("*.sql").scan({ cwd: new URL("./migrations/", import.meta.url).pathname }));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(file).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
  });

  test("runs the daily cleanup of the caps once a day (count.ts cleanCaps)", () => {
    expect(table(root["triggers"])["crons"]).toEqual(["5 0 * * *"]);
  });

  // An [env.*] table inherits the top-level routes, custom domain included: deployed, it would offer
  // to move the production hostname onto itself (the TypeScript stack note, § Cloudflare Workers
  // deployment). Every environment must declare its own routes.
  test("every environment, if one is added, declares its own routes", () => {
    for (const [name, env] of Object.entries(table(root["env"] ?? {}))) expect({ name, routes: "routes" in table(env) }).toEqual({ name, routes: true });
  });
});
