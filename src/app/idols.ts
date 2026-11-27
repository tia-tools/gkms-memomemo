/**
 * The idols' faces for 「カードの絵柄」 (docs/plans/EXECPLAN_LIBRARY_DATA.md, L6): each playable idol's
 * SD face, the small cartoon face the game uses in its menus, loaded from gkms-library's address
 * one image per idol, so a new idol's face appears with no work here. The service worker keeps each
 * face once drawn (src/sw/routes.ts, route `face`); one that cannot be had is drawn by the first
 * character of her name.
 */

import { LIBRARY } from "../data/library.ts";

/** An idol id as the library's idols format allows it, which also keeps anything else out of the URL. */
const IDOL_ID = /^[a-z0-9]{4}$/;

/** The idol's face at the library's address, 112 × 112, or null for an id that is not one. */
export function faceUrl(idol: string): string | null {
  return IDOL_ID.test(idol) ? `${LIBRARY}/img/w112/img_sd_${idol}_face-00.webp` : null;
}

/** What stands for an idol without a face: the first character of her name. */
export function fallbackGlyph(name: string): string {
  return Array.from(name)[0] ?? "?";
}
