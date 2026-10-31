import { createReadStream, existsSync } from "node:fs";
import { join } from "node:path";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import { SKILLCARDS_ROUTE } from "./infra/worker/data.ts";
import { imageKey } from "./infra/worker/img.ts";

/** The gakumas-supportcards checkout the dev server borrows from; by default beside this one. */
const SIBLING = process.env["SUPPORTCARDS_DIR"] ?? join(import.meta.dirname, "../gakumas-supportcards");

/**
 * What the Worker answers in production, from local files: the skill card data from the sibling's
 * built file when there is one, else this repository's fixture, and `/img/*` (the sprite sheets
 * and their index) from the sibling's extracted image library, under the Worker's own `imageKey`
 * rule. Adopted from gkms-hif-final-stats' vite.config.ts.
 */
function localFile(path: string): { file: string; type: string } | null {
  if (path === SKILLCARDS_ROUTE) {
    const built = join(SIBLING, "dist/data/skillcards.v1.json");
    const fixture = join(import.meta.dirname, "src/data/fixtures/skillcards.v1.json");
    const file = [built, fixture].find((f) => existsSync(f));
    return file === undefined ? null : { file, type: "application/json; charset=utf-8" };
  }
  const key = imageKey(path);
  const file = key === null ? null : join(SIBLING, "scripts/images/out", key);
  const type = key?.endsWith(".json") === true ? "application/json; charset=utf-8" : "image/webp";
  return file !== null && existsSync(file) ? { file, type } : null;
}

/** Dev server only: the Worker's routes from local files (infra/worker/worker.ts in production). */
function localWorker(): Plugin {
  return {
    name: "local-worker",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0] ?? "";
        const found = localFile(path);
        // A missing image or data file answers as the Worker would, not with the page the fallback would serve.
        if (found === null && (path.startsWith("/img/") || path === SKILLCARDS_ROUTE)) {
          res.statusCode = path === SKILLCARDS_ROUTE ? 502 : 404;
          res.end();
          return;
        }
        if (found === null) return next();
        res.setHeader("Content-Type", found.type);
        createReadStream(found.file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [preact(), tailwindcss(), localWorker()],
});
