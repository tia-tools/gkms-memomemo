import { describe, expect, test } from "bun:test";
import { suggestsHomeScreen } from "./install.ts";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.96 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

describe("suggestsHomeScreen", () => {
  test("an iPhone in the browser is told", () => {
    expect(suggestsHomeScreen({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5, standalone: false })).toBe(true);
  });

  test("so is another browser on an iPhone, which shares Safari's engine", () => {
    expect(suggestsHomeScreen({ userAgent: IPHONE_CHROME, maxTouchPoints: 5, standalone: false })).toBe(true);
  });

  test("an iPad presenting itself as a Mac is told, by its touch screen", () => {
    expect(suggestsHomeScreen({ userAgent: IPAD_AS_MAC, maxTouchPoints: 5, standalone: false })).toBe(true);
  });

  test("a Mac, which has no touch screen, is not", () => {
    expect(suggestsHomeScreen({ userAgent: IPAD_AS_MAC, maxTouchPoints: 0, standalone: false })).toBe(false);
    expect(suggestsHomeScreen({ userAgent: IPAD_AS_MAC, maxTouchPoints: 1, standalone: false })).toBe(false);
  });

  test("a page already opened from the home screen is not", () => {
    expect(suggestsHomeScreen({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5, standalone: true })).toBe(false);
    expect(suggestsHomeScreen({ userAgent: IPAD_AS_MAC, maxTouchPoints: 5, standalone: true })).toBe(false);
  });

  test("Android and Windows are not, touch screen or not", () => {
    expect(suggestsHomeScreen({ userAgent: ANDROID, maxTouchPoints: 5, standalone: false })).toBe(false);
    expect(suggestsHomeScreen({ userAgent: WINDOWS, maxTouchPoints: 10, standalone: false })).toBe(false);
  });

  test("an empty user agent is not", () => {
    expect(suggestsHomeScreen({ userAgent: "", maxTouchPoints: 5, standalone: false })).toBe(false);
  });
});

const PUBLIC = new URL("../../public/", import.meta.url);
const read = (path: string) => Bun.file(new URL(path, PUBLIC)).text();
const MANIFEST: unknown = JSON.parse(await read("manifest.webmanifest"));
const INDEX_HTML = await Bun.file(new URL("../../index.html", import.meta.url)).text();

/** A PNG's width and height, from its header, or null when the file is not a PNG. */
async function pngSize(path: string): Promise<string | null> {
  const bytes = new Uint8Array(await Bun.file(new URL(path.replace(/^\//, ""), PUBLIC)).arrayBuffer());
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || signature.some((b, i) => bytes[i] !== b)) return null;
  const view = new DataView(bytes.buffer);
  return `${view.getUint32(16)}x${view.getUint32(20)}`;
}

function fields(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("not an object");
  return Object.fromEntries(Object.entries(value));
}

const manifest = fields(MANIFEST);
const icons = Array.isArray(manifest["icons"]) ? manifest["icons"].map(fields) : [];

describe("the web app manifest (D58, D60)", () => {
  test("installs the page at its root, opened as an app, under the page's own title", () => {
    const title = /<title>(.*)<\/title>/.exec(INDEX_HTML)?.[1];
    expect({ name: manifest["name"], start: manifest["start_url"], scope: manifest["scope"], id: manifest["id"], display: manifest["display"] }).toEqual({
      name: title,
      start: "/",
      scope: "/",
      id: "/",
      display: "standalone",
    });
  });

  test("has a 192 and a 512 px icon for any use and a maskable one, each the size it says", async () => {
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) expect({ src: icon["src"], size: await pngSize(String(icon["src"])) }).toEqual({ src: icon["src"], size: String(icon["sizes"]) });
    const any = icons.filter((i) => i["purpose"] === "any").map((i) => i["sizes"]);
    expect([any.includes("192x192"), any.includes("512x512"), icons.some((i) => i["purpose"] === "maskable")]).toEqual([true, true, true]);
  });

  test("index.html names the manifest and the iPhone's 180 px icon, which exist", async () => {
    expect(INDEX_HTML).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    const touch = /<link rel="apple-touch-icon" href="([^"]+)"/.exec(INDEX_HTML)?.[1] ?? "";
    expect(await pngSize(touch)).toBe("180x180");
  });
});
