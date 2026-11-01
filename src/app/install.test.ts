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
