/**
 * A stand-in for Cloudflare's D1 in tests: the slice count.ts uses (`CountsDb`), run on an
 * in-memory SQLite (`bun:sqlite`) with this directory's migrations applied in order, as
 * `wrangler d1 migrations apply` does. The tests therefore run the Worker's own SQL, upserts and
 * RETURNING included, rather than a model of it. Rows written are SQLite's changes, which for these
 * WITHOUT ROWID tables is what a local D1 reported (the plan's Surprises & Discoveries). Test code
 * only: the Worker never imports it.
 */

import { Database } from "bun:sqlite";
import type { CountsDb, D1Answer, D1Statement } from "./count.ts";

const MIGRATIONS = new URL("./migrations/", import.meta.url);

/** The migrations' SQL, in the order of their numbered names. */
export async function migrations(): Promise<string[]> {
  const names = (await Array.fromAsync(new Bun.Glob("*.sql").scan({ cwd: MIGRATIONS.pathname }))).toSorted();
  return Promise.all(names.map((name) => Bun.file(new URL(name, MIGRATIONS)).text()));
}

export interface FakeD1 extends CountsDb {
  sqlite: Database;
  /** Every statement run, with the rows it wrote. */
  written: { sql: string; rows: number }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function fakeD1(): Promise<FakeD1> {
  const sqlite = new Database(":memory:");
  for (const sql of await migrations()) sqlite.exec(sql);
  const written: FakeD1["written"] = [];
  const changes = () => {
    const row: unknown = sqlite.query("SELECT total_changes() AS n").get();
    return isRecord(row) && typeof row["n"] === "number" ? row["n"] : 0;
  };
  const execute = (sql: string, values: (string | number)[]): D1Answer => {
    const before = changes();
    const results = sqlite
      .query(sql)
      .all(...values)
      .filter(isRecord);
    const rows = changes() - before;
    written.push({ sql, rows });
    return { results, meta: { rows_written: rows } };
  };
  const pending = new WeakMap<D1Statement, () => D1Answer>();
  const statement = (sql: string, values: (string | number)[]): D1Statement => {
    const s: D1Statement = {
      bind: (...next) => statement(sql, next),
      all: async () => execute(sql, values),
      run: async () => execute(sql, values),
    };
    pending.set(s, () => execute(sql, values));
    return s;
  };
  return {
    sqlite,
    written,
    prepare: (sql) => statement(sql, []),
    batch: async (statements) =>
      sqlite.transaction(() =>
        statements.map((s) => {
          const run = pending.get(s);
          if (run === undefined) throw new Error("not a statement of this database");
          return run();
        }),
      )(),
  };
}
