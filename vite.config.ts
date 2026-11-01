import { createReadStream, existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { type Connect, defineConfig, type Plugin } from "vite";
import { SKILLCARDS_ROUTE } from "./infra/worker/data.ts";
import { imageKey } from "./infra/worker/img.ts";
import { parseIconIndex, SHEET_URL_PREFIX } from "./src/app/sheets.ts";
import { type BuiltFile, SW_FILE, swManifest, withManifest } from "./src/sw/build.ts";

/** The gakumas-supportcards checkout the dev server borrows from; by default beside this one. */
const SIBLING = process.env["SUPPORTCARDS_DIR"] ?? join(import.meta.dirname, "../gakumas-supportcards");

/**
 * What the Worker answers in production, from local files: the skill card data from the sibling's
 * built file when there is one, else this repository's fixture, and `/img/*` (this app's sprite
 * sheets) from the icon pipeline's local build in scripts/icons/out, under the Worker's own
 * `imageKey` rule. Adopted from gkms-hif-final-stats' vite.config.ts.
 */
function localFile(path: string): { file: string; type: string } | null {
  if (path === SKILLCARDS_ROUTE) {
    const built = join(SIBLING, "dist/data/skillcards.v1.json");
    const fixture = join(import.meta.dirname, "src/data/fixtures/skillcards.v1.json");
    const file = [built, fixture].find((f) => existsSync(f));
    return file === undefined ? null : { file, type: "application/json; charset=utf-8" };
  }
  const key = imageKey(path);
  const file = key === null ? null : join(import.meta.dirname, "scripts/icons/out", key);
  return file !== null && existsSync(file) ? { file, type: "image/webp" } : null;
}

/** The Worker's routes from local files (infra/worker/worker.ts in production). */
const answerLocally: Connect.NextHandleFunction = (req, res, next) => {
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
};

/**
 * The dev server and `vite preview` answer the Worker's routes; the preview, which serves the build
 * with its service worker, is where the page is checked offline on this machine.
 */
function localWorker(): Plugin {
  return {
    name: "local-worker",
    configureServer: (server) => void server.middlewares.use(answerLocally),
    configurePreviewServer: (server) => void server.middlewares.use(answerLocally),
  };
}

/** Every file under public/, which Vite copies into dist/ as it is, by its path there. */
function publicFiles(): BuiltFile[] {
  const dir = join(import.meta.dirname, "public");
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const file = join(entry.parentPath, entry.name);
      return { path: relative(dir, file).split(sep).join("/"), bytes: readFileSync(file) };
    });
}

/** The sheets the bundled index names, at the URLs the page asks for them. */
function bundledSheets(): string[] {
  const index = parseIconIndex(JSON.parse(readFileSync(join(import.meta.dirname, "src/icons/index.v1.json"), "utf8")));
  return index.plans.flatMap((plan) => plan.sheets.map((sheet) => `${SHEET_URL_PREFIX}${sheet.file}`));
}

/**
 * The service worker (docs/plans/EXECPLAN_MEMORY_MEMO.md, D58): src/sw/sw.ts built as `sw.js` at the
 * root, beside the page, with its manifest written in once every other file is built. It must stand
 * alone, a classic script with no imports, which every browser runs as a worker; a module the page
 * shares with it would be split into a chunk both import, and the build stops instead.
 */
function serviceWorker(): Plugin {
  return {
    name: "service-worker",
    apply: "build",
    enforce: "post",
    config: () => ({
      build: {
        rolldownOptions: {
          input: { index: join(import.meta.dirname, "index.html"), sw: join(import.meta.dirname, "src/sw/sw.ts") },
          output: { entryFileNames: (chunk) => (chunk.name === "sw" ? SW_FILE : "assets/[name]-[hash].js") },
        },
      },
    }),
    generateBundle(_options, bundle) {
      const sw = bundle[SW_FILE];
      if (sw?.type !== "chunk") return this.error(`${SW_FILE} was not built`);
      const shared = [...sw.imports, ...sw.dynamicImports, ...sw.exports];
      if (shared.length > 0) return this.error(`${SW_FILE} must stand alone; it imports or exports ${shared.join(", ")}`);
      if (bundle["index.html"] === undefined) return this.error("index.html is not built yet; the worker's manifest must cover it");
      const built = Object.values(bundle).map((file): BuiltFile => ({ path: file.fileName, bytes: file.type === "chunk" ? file.code : file.source }));
      sw.code = withManifest(sw.code, swManifest([...built, ...publicFiles()], bundledSheets(), SKILLCARDS_ROUTE, SHEET_URL_PREFIX));
    },
  };
}

export default defineConfig({
  plugins: [preact(), tailwindcss(), localWorker(), serviceWorker()],
});
