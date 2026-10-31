/**
 * `/img/*`: the skill card sprite sheets and their index, read from the R2 bucket `tia-assets` that
 * gakumas-supportcards fills (docs/adr/0001; decision D42 of docs/plans/EXECPLAN_MEMORY_MEMO.md).
 * This app only reads it. Pure request → response over a bucket passed in, so it runs under
 * `bun test` with a fake bucket. The bucket type is the slice of Cloudflare's R2Bucket this handler
 * uses, which keeps the Workers type package out of the project. Adopted from
 * gkms-hif-final-stats' infra/worker/img.ts, with the sheets and the index in place of its card
 * thumbnails and item icons.
 */

export interface StoredImage {
  httpEtag: string;
  size: number;
}
export interface StoredImageBody extends StoredImage {
  body: ReadableStream;
}
export interface ImageBucket {
  head(key: string): Promise<StoredImage | null>;
  get(key: string): Promise<StoredImageBody | null>;
}

/** The sheets' prefix, named for their cell width (decision D35). */
const SHEETS = "sheet112";

/**
 * Only two kinds of object are ever looked up. A sheet, `sheet112/<plan>-<idol id>-<8 hex>.webp`,
 * whose name ends in a hash of its bytes, so it never changes meaning; and the index of the
 * current sheets, `sheet112/index.v1.json`, which changes whenever a sheet is rebuilt. The single
 * icons, the lossless masters under `master/` and every other object in the bucket are never
 * reachable from here. The pattern spells the prefix out, since a RegExp built from a string is a
 * lint error (security/detect-non-literal-regexp); img.test.ts keeps the two in step.
 */
const SHEET_PATH = /^\/img\/(sheet112\/(?:sense|logic|anomaly)-[a-z0-9]{4}-[0-9a-f]{8}\.webp)$/;
export const INDEX_KEY = `${SHEETS}/index.v1.json`;

/** A sheet's name never changes meaning, so a served sheet is cacheable forever. */
export const IMMUTABLE = "public, max-age=31536000, immutable";
/** The index names the current sheets; an hour, like the data file, keeps a new card's wait short. */
export const INDEX_CACHE = "public, max-age=3600";

/** The bucket key for a request path, or null when the path is neither a sheet nor the index. */
export function imageKey(pathname: string): string | null {
  if (pathname === `/img/${INDEX_KEY}`) return INDEX_KEY;
  return SHEET_PATH.exec(pathname)?.[1] ?? null;
}

/**
 * Whether an `If-None-Match` header matches the stored ETag, so the answer is a 304 (RFC 9110
 * § 13.1.2): `*`, or a list of tags compared weakly, since Cloudflare weakens an ETag (`W/"…"`)
 * when it compresses a response, as it does the JSON index. R2's tags are hex digits, so a tag
 * never holds the comma the list is split on.
 */
export function notModified(ifNoneMatch: string | null, etag: string): boolean {
  if (ifNoneMatch === null) return false;
  if (ifNoneMatch.trim() === "*") return true;
  const opaque = (tag: string) => tag.trim().replace(/^W\//, "");
  return ifNoneMatch.split(",").some((tag) => opaque(tag) === opaque(etag));
}

/** A miss is never cached, so a sheet the sibling uploads later shows at once. */
function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

function headersFor(key: string, image: StoredImage): Headers {
  const isIndex = key === INDEX_KEY;
  return new Headers({
    "Content-Type": isIndex ? "application/json; charset=utf-8" : "image/webp",
    "Cache-Control": isIndex ? INDEX_CACHE : IMMUTABLE,
    ETag: image.httpEtag,
  });
}

export async function serveImage(request: Request, bucket: ImageBucket): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  const key = imageKey(new URL(request.url).pathname);
  if (key === null) return notFound();

  const ifNoneMatch = request.headers.get("If-None-Match");
  if (request.method === "HEAD") {
    const meta = await bucket.head(key);
    if (meta === null) return notFound();
    const headers = headersFor(key, meta);
    if (notModified(ifNoneMatch, meta.httpEtag)) return new Response(null, { status: 304, headers });
    headers.set("Content-Length", String(meta.size));
    return new Response(null, { status: 200, headers });
  }

  const object = await bucket.get(key);
  if (object === null) return notFound();
  const headers = headersFor(key, object);
  if (notModified(ifNoneMatch, object.httpEtag)) return new Response(null, { status: 304, headers });
  return new Response(object.body, { status: 200, headers });
}
