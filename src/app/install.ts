/**
 * Who is told to add the page to the home screen (docs/plans/EXECPLAN_MEMORY_MEMO.md, D16 and D61):
 * a player on an iPhone or iPad who opened it in the browser. Safari there deletes a site's storage,
 * the memo with it, after seven days of use without the player using the site, and a page opened
 * from the home screen keeps its own count of days (§ Surprises & Discoveries).
 */

export interface Device {
  userAgent: string;
  /** `navigator.maxTouchPoints`. */
  maxTouchPoints: number;
  /** Opened from the home screen: `navigator.standalone` on iOS, or the display mode the manifest asks for. */
  standalone: boolean;
}

export function suggestsHomeScreen(device: Device): boolean {
  if (device.standalone) return false;
  if (/\b(?:iPhone|iPad|iPod)\b/.test(device.userAgent)) return true;
  // iPadOS's Safari presents itself as a Mac by default; only its touch screen tells the two apart.
  return /\bMacintosh\b/.test(device.userAgent) && device.maxTouchPoints > 1;
}

/** This browser, as `suggestsHomeScreen` reads it. */
export function thisDevice(): Device {
  const standalone = ("standalone" in navigator && navigator.standalone === true) || window.matchMedia("(display-mode: standalone)").matches;
  return { userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints, standalone };
}

/** The hint, word for word (D61). */
export const HOME_SCREEN_HINT =
  "iPhone・iPad の Safari では、このサイトを7日間使わないと、保存したメモが消えることがあります。「⋯」→「共有」（または共有ボタン）から「ホーム画面に追加」し、そこから開けば、この削除はされません。ホーム画面から開いたページは Safari とは別にメモを保存するので、Safari で作ったメモは引き継ぎコードで移してください。";
