import { describe, expect, test } from "bun:test";
import { readCapped } from "./body.ts";

const URL_COUNT = "https://gkms-memomemo.tia.run/count";

function post(body: BodyInit | null, headers: Record<string, string> = {}): Request {
  return new Request(URL_COUNT, { method: "POST", body, headers });
}

function stream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({ start: (c) => (c.enqueue(bytes), c.close()) });
}

describe("readCapped", () => {
  test("reads a body up to the cap, the cap itself included", async () => {
    expect(await readCapped(post("abc"), 10)).toBe("abc");
    expect(await readCapped(post("x".repeat(10)), 10)).toBe("x".repeat(10));
    expect(await readCapped(post(stream(new TextEncoder().encode("成就+"))), 10)).toBe("成就+");
  });

  test("a request without a body reads as empty", async () => {
    expect(await readCapped(new Request(URL_COUNT, { method: "POST" }), 10)).toBe("");
  });

  test("refuses a body one byte over, and a Content-Length over the cap or not a number", async () => {
    expect(await readCapped(post("x".repeat(11)), 10)).toBeNull();
    expect(await readCapped(post("abc", { "Content-Length": "11" }), 10)).toBeNull();
    expect(await readCapped(post("abc", { "Content-Length": "abc" }), 10)).toBeNull();
  });

  test("counts bytes, not characters, also when no Content-Length is sent", async () => {
    const wide = new TextEncoder().encode("あ".repeat(4)); // 4 characters, 12 bytes
    const streamed = post(stream(wide));
    expect(streamed.headers.get("Content-Length")).toBeNull();
    expect(await readCapped(streamed, 10)).toBeNull();
  });

  test("an endless body is cut off at the cap, not read to the end", async () => {
    let pulled = 0;
    let cancelled = false;
    const chunk = new Uint8Array(100).fill(0x61);
    const endless = new ReadableStream<Uint8Array>({ pull: (c) => (pulled++, c.enqueue(chunk)), cancel: () => void (cancelled = true) });
    expect(await readCapped(post(endless), 1024)).toBeNull();
    expect(cancelled).toBe(true);
    expect(pulled).toBeLessThanOrEqual(1024 / chunk.byteLength + 2);
  });
});
