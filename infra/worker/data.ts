/**
 * `/data/skillcards.json`: the skill card file gakumas-supportcards publishes, fetched server-side
 * and passed through at this app's own origin (docs/adr/0001), so the sibling's Worker needs no
 * CORS change. Pure request → response over an upstream fetcher passed in, so it runs under
 * `bun test`. Adopted from gkms-hif-final-stats' infra/worker/data.ts, which does the same for
 * support cards.
 */

/** Where the page asks for the skill card data. */
export const SKILLCARDS_ROUTE = "/data/skillcards.json";
/** The sibling's published file; its name carries the format version (its docs/adr/0010). */
export const SKILLCARDS_SOURCE = "https://gakumas-supportcards.tia.run/data/skillcards.v1.json";
/** The sibling's data changes at most a few times a day; an hour keeps a new card's wait short. */
export const SKILLCARDS_CACHE = "public, max-age=3600";

function unavailable(): Response {
  return new Response("Skill card data unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
}

export async function serveSkillCards(request: Request, fetchUpstream: (url: string) => Promise<Response>): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  let upstream: Response;
  try {
    upstream = await fetchUpstream(SKILLCARDS_SOURCE);
  } catch {
    return unavailable();
  }
  if (!upstream.ok) return unavailable();
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": SKILLCARDS_CACHE };
  return new Response(request.method === "HEAD" ? null : upstream.body, { status: 200, headers });
}
