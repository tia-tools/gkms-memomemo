/** 「カードの絵柄」 chosen from the idols' faces in a simulated DOM (happy-dom) (docs/plans/EXECPLAN_IDOL_ICON_TABLE.md, T3 and T4). */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { render } from "preact";
import { act } from "preact/test-utils";
import type { Idol } from "../data/contract.ts";
import { artToggle, byLabel, chosenIdol, must, tap } from "../test-support/page.tsx";
import type { IdolIcons } from "./idols.ts";
import { IdolPicker } from "./IdolPicker.tsx";

const IDOLS: Idol[] = [
  { id: "hski", name: "花海咲季" },
  { id: "ttmr", name: "月村手毬" },
  { id: "shro", name: "篠澤広" },
];
/** A sheet in another order than the idols, lacking 篠澤広. */
const ICONS: IdolIcons = { cell: 96, file: "idols96-0123abcd.webp", idols: ["ttmr", "hski"] };

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
    return <IdolPicker idols={IDOLS} idol={chosen.at(-1) ?? idol} icons={ICONS} onIdol={(id) => (chosen.push(id), draw())} />;
  }
  const draw = () => render(<Page />, root);
  await act(draw);
  return chosen;
}

const faces = () => root.querySelector('[role="group"][aria-label="カードの絵柄"]');
const faceOf = (name: string) => must(byLabel(must(faces(), "the faces"), name).querySelector<HTMLElement>("span"), `${name}'s face`);

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

  test("finds each face by the idol's id, not her place in the list", async () => {
    await picker("hski");
    await tap(artToggle(root));
    expect(faceOf("花海咲季").style.backgroundImage).toContain("/icons/idols96-0123abcd.webp");
    expect(faceOf("花海咲季").style.backgroundPosition).toBe("calc(-1 * 3rem) calc(0 * 3rem)");
    expect(faceOf("月村手毬").style.backgroundPosition).toBe("calc(0 * 3rem) calc(0 * 3rem)");
  });

  test("an idol the sheet lacks is drawn by the first character of her name", async () => {
    await picker("shro");
    await tap(artToggle(root));
    expect(faceOf("篠澤広").textContent).toBe("篠");
    expect(faceOf("篠澤広").style.backgroundImage).toBe("");
    expect(chosenIdol(root)).toBe("篠澤広");
  });
});
