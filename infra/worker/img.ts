/**
 * `/img/*`: this app's game-style skill card sprite sheets, read from the R2 bucket `tia-assets`
 * under this app's own prefix, where the icon pipeline in scripts/icons uploads them
 * (docs/adr/0002; docs/plans/EXECPLAN_GAME_STYLE_ICONS.md, I3 and I11). Their index is not served:
 * it is committed and bundled into the page. Pure request → response over a bucket passed in, so
 * it runs under `bun test` with a fake bucket. The bucket type is the slice of Cloudflare's
 * R2Bucket this handler uses, which keeps the Workers type package out of the project. Adopted
 * from gkms-hif-final-stats' infra/worker/img.ts.
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

/** The sheets' prefix in the bucket: this app's own, then the cell width. */
export const SHEETS = "gkms-memomemo/sheet112";

/**
 * Only sheets are ever looked up: `gkms-memomemo/sheet112/<plan>-<idol id>-<8 hex>.webp`, whose
 * name ends in a hash of its bytes, so it never changes meaning. gakumas-supportcards' sheets and
 * index, the single icons, the lossless masters under `master/` and every other object in the
 * bucket are never reachable from here. The pattern spells the prefix out, since a RegExp built
 * from a string is a lint error (security/detect-non-literal-regexp); img.test.ts keeps the two in step.
 */
const SHEET_PATH = /^\/img\/(gkms-memomemo\/sheet112\/(?:sense|logic|anomaly)-[a-z0-9]{4}-[0-9a-f]{8}\.webp)$/;

/** A sheet's name never changes meaning, so a served sheet is cacheable forever. */
export const IMMUTABLE = "public, max-age=31536000, immutable";

/** The bucket key for a request path, or null when the path is not a sheet's. */
export function imageKey(pathname: string): string | null {
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

/** A miss is never cached, so a sheet uploaded later shows at once. */
function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

function headersFor(image: StoredImage): Headers {
  return new Headers({ "Content-Type": "image/webp", "Cache-Control": IMMUTABLE, ETag: image.httpEtag });
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
    const headers = headersFor(meta);
    if (notModified(ifNoneMatch, meta.httpEtag)) return new Response(null, { status: 304, headers });
    headers.set("Content-Length", String(meta.size));
    return new Response(null, { status: 200, headers });
  }

  const object = await bucket.get(key);
  if (object === null) return notFound();
  const headers = headersFor(object);
  if (notModified(ifNoneMatch, object.httpEtag)) return new Response(null, { status: 304, headers });
  return new Response(object.body, { status: 200, headers });
}
