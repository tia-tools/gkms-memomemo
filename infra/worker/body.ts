/**
 * A request body read with a size cap, for `POST /count` (count.ts). Adopted from
 * gakumas-supportcards' infra/worker/feedback.ts `readCapped`, unchanged but for its comments.
 */

/**
 * The body as text, or null once it passes `max` bytes. Counted in bytes as it streams, so a body
 * without Content-Length (or with a false one) is cut off at the cap instead of being buffered
 * whole, and multibyte text cannot pass the cap by being short in characters.
 */
export async function readCapped(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get("Content-Length") ?? 0);
  if (!(declared <= max)) return null; // also refuses a Content-Length that is not a number
  if (request.body === null) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
