/**
 * The key a player's daily cap on count events is kept under (docs/plans/EXECPLAN_MEMORY_MEMO.md,
 * Milestone 6, D12 and D41): a truncated SHA-256 of the player's network, the UTC day and a secret
 * salt, so no IP address is stored, and a key says nothing about the key of another day. Without the
 * salt an IPv4 address's key could be found by trying all of them, which is why the Worker counts
 * nothing until the salt is set. The hash is gakumas-supportcards' infra/worker/feedback.ts
 * `dailyBucket`.
 */

/** The UTC day of a moment, `YYYY-MM-DD`: the day a cap row belongs to. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

const HEXTET = /^[0-9a-f]{1,4}$/;
const IPV4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

/** An IPv4 address as two 16-bit groups, or null when it is not one. */
function ipv4Groups(text: string): number[] | null {
  if (!IPV4.test(text)) return null;
  const bytes = text.split(".").map(Number);
  if (bytes.some((b) => b > 255)) return null;
  const [a = 0, b = 0, c = 0, d = 0] = bytes;
  return [a * 256 + b, c * 256 + d];
}

/** One side of an IPv6 address's `::` as 16-bit groups, an IPv4 tail as two, or null. */
function groupsOf(part: string): number[] | null {
  if (part === "") return [];
  const words = part.split(":");
  const last = words.at(-1) ?? "";
  const v4 = last.includes(".") ? ipv4Groups(last) : [];
  const hex = last.includes(".") ? words.slice(0, -1) : words;
  if (v4 === null || !hex.every((w) => HEXTET.test(w))) return null;
  return [...hex.map((w) => parseInt(w, 16)), ...v4];
}

/** An IPv6 address's eight groups, or null when it is not one. */
function ipv6Groups(address: string): number[] | null {
  const halves = address.toLowerCase().split("::");
  const [left = "", right = ""] = halves;
  if (halves.length > 2 || (halves.length === 2 && left.includes("."))) return null;
  const head = groupsOf(left);
  const tail = halves.length === 2 ? groupsOf(right) : [];
  if (head === null || tail === null) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const missing = 8 - head.length - tail.length;
  return missing >= 1 ? [...head, ...Array.from({ length: missing }, () => 0), ...tail] : null;
}

/**
 * Who a cap is kept for: an IPv4 address as it is, an IPv6 address by its /64, since one
 * subscriber holds a whole /64 and can take any address in it at will. An IPv4-mapped IPv6
 * address (`::ffff:203.0.113.7`) is its IPv4 address. Anything else is taken as it is.
 */
export function clientNetwork(ip: string): string {
  if (!ip.includes(":")) return ip;
  const groups = ipv6Groups(ip);
  if (groups === null) return ip;
  const [g0, g1, g2, g3, g4, g5, g6 = 0, g7 = 0] = groups;
  if ([g0, g1, g2, g3, g4].every((g) => g === 0) && g5 === 0xffff) return [g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff].join(".");
  return `${groups.slice(0, 4).map((g) => g.toString(16)).join(":")}::/64`;
}

/** Truncated SHA-256 of `network|day|salt` as 16 hex digits: a per-day key that reveals no address. */
export async function clientKey(ip: string, day: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${clientNetwork(ip)}|${day}|${salt}`));
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
