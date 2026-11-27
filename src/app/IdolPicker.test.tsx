/**
 * 「カードの絵柄」 chosen from the idols' faces in a simulated DOM (happy-dom) (docs/plans/EXECPLAN_IDOL_ICON_TABLE.md,
 * T3 and T4; the faces from the library, docs/plans/EXECPLAN_LIBRARY_DATA.md, L6). happy-dom loads no image, so a
 * face that cannot be had is an `error` event dispatched by the test.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { render } from "preact";
import { act } from "preact/test-utils";
import type { Idol } from "../data/pool.ts";
import { artToggle, byLabel, chosenIdol, must, tap } from "../test-support/page.tsx";
import { IdolPicker } from "./IdolPicker.tsx";

const IDOLS: Idol[] = [
  { id: "hski", name: "花海咲季" },
  { id: "ttmr", name: "月村手毬" },
  { id: "shro", name: "篠澤広" },
];

let root: HTMLElement;
beforeAll(() => GlobalRegistrator.register());
afterAll(() => GlobalRegistrator.unregister());
beforeEach(() => {
  root = document.body.appendChild(document.createElement("div"));
});
afterEach(() => {
  render(null, root);
  root.remove();
});

/** The picker with `idol` chosen; each choice is recorded and shown, as the page does. */
async function picker(idol: string): Promise<string[]> {
  const chosen: string[] = [];
  function Page() {
    return <IdolPicker idols={IDOLS} idol={chosen.at(-1) ?? idol} onIdol={(id) => (chosen.push(id), draw())} />;
  }
  const draw = () => render(<Page />, root);
  await act(draw);
  return chosen;
}

const faces = () => root.querySelector('[role="group"][aria-label="カードの絵柄"]');
const faceOf = (name: string) => must(byLabel(must(faces(), "the faces"), name).querySelector<HTMLElement>("img, span"), `${name}'s face`);
const LIBRARY_FACE = (id: string) => `https://gkms-library.tia.run/img/w112/img_sd_${id}_face-00.webp`;

describe("IdolPicker", () => {
  test("is folded, showing the chosen idol's name", async () => {
    await picker("ttmr");
    expect(faces()).toBeNull();
    expect(artToggle(root).getAttribute("aria-expanded")).toBe("false");
    expect(chosenIdol(root)).toBe("月村手毬");
  });

  test("unfolds to every idol's face, the chosen one pressed", async () => {
    await picker("ttmr");
    await tap(artToggle(root));
    const buttons = [...must(faces(), "the faces").querySelectorAll("button")];
    expect(buttons.map((b) => [b.getAttribute("aria-label"), b.getAttribute("aria-pressed")])).toEqual([
      ["花海咲季", "false"],
      ["月村手毬", "true"],
      ["篠澤広", "false"],
    ]);
  });

  test("choosing an idol sets her and folds the table", async () => {
    const chosen = await picker("hski");
    await tap(artToggle(root));
    await tap(byLabel(must(faces(), "the faces"), "篠澤広"));
    expect(chosen).toEqual(["shro"]);
    expect(faces()).toBeNull();
    expect(chosenIdol(root)).toBe("篠澤広");
  });

  test("draws each idol's face from the library's address, by her id, as a CORS request the service worker can keep", async () => {
    await picker("hski");
    await tap(artToggle(root));
    for (const [name, id] of [["花海咲季", "hski"], ["月村手毬", "ttmr"], ["篠澤広", "shro"]] as const) {
      expect([faceOf(name).tagName, faceOf(name).getAttribute("src"), faceOf(name).getAttribute("crossorigin")]).toEqual(["IMG", LIBRARY_FACE(id), "anonymous"]);
    }
    expect(must(artToggle(root).querySelector("img"), "the chosen face").getAttribute("src")).toBe(LIBRARY_FACE("hski"));
  });

  test("a face that cannot be had is drawn by the first character of her name, and only hers", async () => {
    await picker("shro");
    await tap(artToggle(root));
    await act(() => void faceOf("篠澤広").dispatchEvent(new Event("error")));
    expect([faceOf("篠澤広").tagName, faceOf("篠澤広").textContent]).toEqual(["SPAN", "篠"]);
    expect(faceOf("花海咲季").tagName).toBe("IMG");
    expect(chosenIdol(root)).toBe("篠澤広");
  });

  test("the chosen face's failure is not carried over to the next idol chosen", async () => {
    const chosen = await picker("shro");
    await act(() => void must(artToggle(root).querySelector("img"), "the chosen face").dispatchEvent(new Event("error")));
    expect(must(artToggle(root).querySelector("span"), "the glyph").textContent).toBe("篠");
    await tap(artToggle(root));
    await tap(byLabel(must(faces(), "the faces"), "花海咲季"));
    expect(chosen).toEqual(["hski"]);
    expect(must(artToggle(root).querySelector("img"), "the chosen face").getAttribute("src")).toBe(LIBRARY_FACE("hski"));
  });
});
