import { describe, expect, test } from "bun:test";
import { IMMUTABLE, INDEX_CACHE, INDEX_KEY, imageKey, notModified, serveImage, type ImageBucket } from "./img.ts";

const SHEET = "sheet112/sense-hski-1a2b3c4d.webp";
const URL_OK = `https://example.tia.run/img/${SHEET}`;
const URL_INDEX = `https://example.tia.run/img/${INDEX_KEY}`;
const SINGLE = "img_general_skillcard_act-3_029-hski.webp";

function bucket(stored: Record<string, string>): ImageBucket & { calls: string[] } {
  const calls: string[] = [];
  const meta = (key: string) => (key in stored ? { httpEtag: `"etag-${key}"`, size: (stored[key] ?? "").length } : null);
  return {
    calls,
    head: async (key) => (calls.push(`head ${key}`), meta(key)),
    get: async (key) => {
      calls.push(`get ${key}`);
      const m = meta(key);
      const body = new Response(stored[key]).body;
      return m && body ? { ...m, body } : null;
    },
  };
}

describe("imageKey", () => {
  test("accepts a sheet of each plan, for any idol id, named with an 8-digit hash", () => {
    expect(imageKey(`/img/${SHEET}`)).toBe(SHEET);
    for (const key of ["sheet112/logic-ttmr-00000000.webp", "sheet112/anomaly-myu0-deadbeef.webp"]) expect(imageKey(`/img/${key}`)).toBe(key);
  });

  test("accepts the index, which lives under the same prefix", () => {
    expect(INDEX_KEY).toBe("sheet112/index.v1.json");
    expect(imageKey(`/img/${INDEX_KEY}`)).toBe(INDEX_KEY);
  });

  test("refuses everything else in the bucket, and every malformed sheet name", () => {
    const refused = [
      "/img/",
      "/img/../secret",
      `/img/${SHEET}/x`,
      `/img/x/${SHEET}`,
      `/img/${SHEET}?x`,
      `/${SHEET}`,
      `/img/w112/${SINGLE}`,
      `/img/master/${SINGLE}`,
      "/img/master/sheet112/sense-hski-1a2b3c4d.webp",
      "/img/sheet112/free-hski-1a2b3c4d.webp",
      "/img/sheet112/sense-hsk-1a2b3c4d.webp",
      "/img/sheet112/sense-HSKI-1a2b3c4d.webp",
      "/img/sheet112/sense-hski-1a2b3c4.webp",
      "/img/sheet112/sense-hski-1A2B3C4D.webp",
      "/img/sheet112/sense-hski-1a2b3c4d.png",
      "/img/sheet112/index.v2.json",
      "/img/sheet112/index.json",
      "/img/sheet96/sense-hski-1a2b3c4d.webp",
      "/img/w192/img_general_csprt-3-0016_full.webp",
    ];
    for (const path of refused) expect({ path, key: imageKey(path) }).toEqual({ path, key: null });
  });
});

describe("the URL parser in front of imageKey", () => {
  // worker.ts hands serveImage the request as the runtime parsed it, so these go through the parser.
  test("encoded slashes, double slashes, trailing dots, case and Unicode never reach the bucket", async () => {
    const tricks = [
      "/img/sheet112%2fsense-hski-1a2b3c4d.webp",
      "/img/sheet112/%2e%2e/master/img_general_skillcard_men-0_003.webp",
      "/img//sheet112/sense-hski-1a2b3c4d.webp",
      "/img/sheet112//sense-hski-1a2b3c4d.webp",
      "/img/sheet112/sense-hski-1a2b3c4d.webp.",
      "/IMG/sheet112/sense-hski-1a2b3c4d.webp",
      "/img/sheet112/sense-hsкi-1a2b3c4d.webp",
      "/img/sheet112/index.v1.json%00",
    ];
    for (const path of tricks) {
      const b = bucket({ [SHEET]: "x", [INDEX_KEY]: "{}", "master/img_general_skillcard_men-0_003.webp": "y" });
      const res = await serveImage(new Request(`https://example.tia.run${path}`), b);
      expect({ path, status: res.status, calls: b.calls }).toEqual({ path, status: 404, calls: [] });
    }
  });

  test("dot segments are resolved before matching, so they can only land on an allowed name", async () => {
    const b = bucket({ [SHEET]: "sheet" });
    const res = await serveImage(new Request(`https://example.tia.run/img/master/%2e%2e/${SHEET}`), b);
    expect([res.status, b.calls]).toEqual([200, [`get ${SHEET}`]]);
  });

  test("a query string is not part of the key", async () => {
    const b = bucket({ [SHEET]: "sheet" });
    const res = await serveImage(new Request(`${URL_OK}?v=2`), b);
    expect([res.status, b.calls]).toEqual([200, [`get ${SHEET}`]]);
  });
});

describe("notModified", () => {
  const ETAG = '"abc123"';
  test("matches the same tag, a weak form of it, a list holding it, and *", () => {
    for (const header of ['"abc123"', 'W/"abc123"', ' "x", W/"abc123" ', "*"]) expect({ header, hit: notModified(header, ETAG) }).toEqual({ header, hit: true });
  });

  test("matches a weak stored tag against its strong form", () => {
    expect(notModified('"abc123"', 'W/"abc123"')).toBe(true);
  });

  test("misses without the header, with another tag, and with a tag that only contains it", () => {
    for (const header of [null, "", '"abc124"', '"abc1234"', 'W/"xabc123"']) expect({ header, hit: notModified(header, ETAG) }).toEqual({ header, hit: false });
  });
});

describe("serveImage", () => {
  test("GET serves a sheet as immutable webp", async () => {
    const b = bucket({ [SHEET]: "webp-bytes" });
    const res = await serveImage(new Request(URL_OK), b);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("Cache-Control")).toBe(IMMUTABLE);
    expect(res.headers.get("ETag")).toBe(`"etag-${SHEET}"`);
    expect(await res.text()).toBe("webp-bytes");
    expect(b.calls).toEqual([`get ${SHEET}`]);
  });

  test("GET serves the index as JSON cached for an hour, never as immutable", async () => {
    const b = bucket({ [INDEX_KEY]: '{"formatVersion":1}' });
    const res = await serveImage(new Request(URL_INDEX), b);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe(INDEX_CACHE);
    expect(await res.text()).toBe('{"formatVersion":1}');
  });

  test("HEAD answers from metadata without reading the body", async () => {
    const b = bucket({ [SHEET]: "webp-bytes" });
    const res = await serveImage(new Request(URL_OK, { method: "HEAD" }), b);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Length")).toBe("10");
    expect(b.calls).toEqual([`head ${SHEET}`]);
  });

  test("a missing sheet is a 404 that must not be cached", async () => {
    const res = await serveImage(new Request(URL_OK, { method: "HEAD" }), bucket({}));
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  test("a path outside the naming scheme never reaches the bucket", async () => {
    const b = bucket({ secret: "x" });
    const res = await serveImage(new Request("https://example.tia.run/img/secret"), b);
    expect(res.status).toBe(404);
    expect(b.calls).toEqual([]);
  });

  test("a master or a single icon is never served, even though it is in the bucket", async () => {
    const b = bucket({ [`master/${SINGLE}`]: "lossless-original", [`w112/${SINGLE}`]: "icon", [SHEET]: "sheet" });
    for (const path of [`master/${SINGLE}`, `w112/${SINGLE}`]) {
      for (const method of ["GET", "HEAD"]) {
        const res = await serveImage(new Request(`https://example.tia.run/img/${path}`, { method }), b);
        expect(res.status).toBe(404);
      }
    }
    expect(b.calls).toEqual([]);
  });

  test("a matching If-None-Match is a 304, for GET and HEAD alike, a weakened tag included", async () => {
    for (const method of ["GET", "HEAD"]) {
      for (const tag of [`"etag-${SHEET}"`, `W/"etag-${SHEET}"`]) {
        const res = await serveImage(new Request(URL_OK, { method, headers: { "If-None-Match": tag } }), bucket({ [SHEET]: "x" }));
        expect({ method, tag, status: res.status, cache: res.headers.get("Cache-Control") }).toEqual({ method, tag, status: 304, cache: IMMUTABLE });
      }
    }
  });

  test("a 304 for the index keeps the index's one-hour cache, never immutable", async () => {
    for (const method of ["GET", "HEAD"]) {
      const res = await serveImage(new Request(URL_INDEX, { method, headers: { "If-None-Match": `W/"etag-${INDEX_KEY}"` } }), bucket({ [INDEX_KEY]: "{}" }));
      expect({ method, status: res.status, cache: res.headers.get("Cache-Control") }).toEqual({ method, status: 304, cache: INDEX_CACHE });
    }
  });

  test("a stale If-None-Match gets the full answer", async () => {
    const res = await serveImage(new Request(URL_OK, { headers: { "If-None-Match": '"etag-old"' } }), bucket({ [SHEET]: "x" }));
    expect([res.status, await res.text()]).toEqual([200, "x"]);
  });

  test("other methods are refused", async () => {
    const res = await serveImage(new Request(URL_OK, { method: "POST" }), bucket({ [SHEET]: "x" }));
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET, HEAD");
  });
});
