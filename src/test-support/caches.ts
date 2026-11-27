/**
 * Stand-ins for the service worker's world in tests (src/sw/handlers.ts): caches over Maps, keyed by
 * absolute URL as the browser's are, and a network that answers from a table, or not at all while
 * offline. A cache hands out a copy of what it keeps, and honours an answer's `Vary` header unless
 * asked to ignore it, as the browser's does; the network can add one to every answer. `putDelay`
 * makes a `put` take that many milliseconds, as a browser's can, so a test can make two settlings
 * interleave, or fail, as a full quota makes it.
 */

import type { CacheLike, CachesLike } from "../sw/handlers.ts";

export const ORIGIN = "https://gkms-memomemo.tia.run";

const keyOf = (request: Request | string): string => (typeof request === "string" ? new URL(request, ORIGIN).href : request.url);

export interface FakeCaches extends CachesLike {
  /** Each cache's kept URLs, by cache name. */
  readonly kept: () => Record<string, string[]>;
  /** A cache's kept answer's body, as text. */
  readonly text: (name: string, url: string) => Promise<string | undefined>;
}

export interface FakeNetwork {
  fetch: (request: Request | string) => Promise<Response>;
  /** Every URL fetched, in order. */
  readonly fetched: string[];
  /** While true, every fetch rejects, as it does with no network. */
  offline: boolean;
  /** The answers, by path: a body (status 200) or a status. */
  answers: Map<string, string | number>;
  /** A `Vary` header every answer carries, as `vite preview` sends `Vary: Origin`; null for none. */
  vary: string | null;
}

export function fakeNetwork(answers: Record<string, string | number>): FakeNetwork {
  const network: FakeNetwork = {
    fetched: [],
    offline: false,
    answers: new Map(Object.entries(answers)),
    vary: null,
    fetch: (request) => {
      const url = keyOf(request);
      network.fetched.push(url);
      if (network.offline) return Promise.reject(new TypeError("Failed to fetch"));
      const answer = network.answers.get(new URL(url).pathname) ?? 404;
      const headers = network.vary === null ? undefined : { Vary: network.vary };
      return Promise.resolve(typeof answer === "number" ? new Response(null, { status: answer, headers }) : new Response(answer, { status: 200, headers }));
    },
  };
  return network;
}

/** What a cache keeps under a URL: the answer, and the headers of the request it answered, which `Vary` compares. */
interface Entry {
  response: Response;
  headers: Headers;
}

const headersOf = (request: Request | string): Headers => (typeof request === "string" ? new Headers() : request.headers);

/** Whether `request` matches the kept entry under the entry's `Vary`, as the Cache API decides it. */
function varyMatches(entry: Entry, request: Request | string): boolean {
  const vary = entry.response.headers.get("Vary");
  if (vary === null) return true;
  const incoming = headersOf(request);
  return vary.split(",").every((name) => entry.headers.get(name.trim()) === incoming.get(name.trim()));
}

/** How long a `put` into the cache `name` of `url` takes, in milliseconds; `"fail"` makes it reject, as a full quota does. */
export type PutDelay = (name: string, url: string) => number | "fail";

export function fakeCaches(network: FakeNetwork, putDelay: PutDelay = () => 0): FakeCaches {
  const all = new Map<string, Map<string, Entry>>();
  const cacheOf = (name: string, entries: Map<string, Entry>): CacheLike => ({
    match: (request, options) => {
      const entry = entries.get(keyOf(request));
      return Promise.resolve(entry !== undefined && (options.ignoreVary || varyMatches(entry, request)) ? entry.response.clone() : undefined);
    },
    put: async (request, response) => {
      const entry = { response: response.clone(), headers: headersOf(request) };
      const delay = putDelay(name, keyOf(request));
      if (delay === "fail") throw new DOMException("the quota is full", "QuotaExceededError");
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      entries.set(keyOf(request), entry);
    },
    addAll: async (requests) => {
      const answers = await Promise.all(requests.map((r) => network.fetch(r)));
      if (answers.some((a) => !a.ok)) throw new TypeError("addAll: a request failed");
      requests.forEach((r, i) => {
        const answer = answers[i];
        if (answer !== undefined) entries.set(keyOf(r), { response: answer, headers: headersOf(r) });
      });
    },
    keys: () => Promise.resolve([...entries.keys()].map((url) => new Request(url))),
    delete: (request) => Promise.resolve(entries.delete(keyOf(request))),
  });
  return {
    open: (name) => {
      const entries = all.get(name) ?? new Map<string, Entry>();
      all.set(name, entries);
      return Promise.resolve(cacheOf(name, entries));
    },
    keys: () => Promise.resolve([...all.keys()]),
    delete: (name) => Promise.resolve(all.delete(name)),
    kept: () => Object.fromEntries([...all].map(([name, entries]) => [name, [...entries.keys()]])),
    text: async (name, url) => all.get(name)?.get(keyOf(url))?.response.clone().text(),
  };
}
