# Choose 「カードの絵柄」 from a table of the idols' icons

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. It is maintained in accordance with `docs/PLANS.md` at the repository root.

## Purpose / Big Picture

「学マス　メモリーメモ帳」 (`gkms-memomemo.tia.run`, this repository) draws every skill card in the art of one P-idol, the player's choice in the setting 「カードの絵柄」. Today that choice is a plain drop-down of thirteen names above each tab's 早見表 (the folded quick-reference table). Players know the idols by face before name, and a drop-down hides the other twelve until it is opened.

After this plan, 「カードの絵柄」 shows the chosen idol's face, her small cartoon (SD, "super deformed") face from the game in its default smile, in a circle, with her name; tapping it unfolds a table of all thirteen icons, and tapping one chooses her, ringed in the page's pink, and every card icon on the page redraws in her art. The table fits a 390 px phone screen without sideways scrolling and works offline like the rest of the page.

To see it working: run the page (`bun run dev`), open any tab, tap 「カードの絵柄」, tap 篠澤広's icon, and see the card icons in the rows change to her art and her icon ringed; reload and see the choice kept.

The work is issue #86 on the project's board (`tia-tools` project 7, see `CLAUDE.md` § Tasks), split from #14 by the user's answer B to job #77: #14 moved the setting above the 早見表, still chosen by name; this issue carries the icons.

## Progress

- [x] (2026-11-09 19:40Z) #86 claimed on `feat/idol-icon-table-86`; the context read (the icon plan, ADR 0002, the Worker's `/img` route, the service worker's routes, `ArtPicker`, and gakumas-supportcards' image pipeline); this plan drafted with two decisions left to the user (Decision Log, "Open").
- [x] (2026-11-09 19:58Z) The user chose the cartoon faces over the round thumbnails, the default smile for the page and a contact sheet of every face to look at in Milestone 1 (T5, superseding T1); this plan revised to match.
- [x] (2026-11-09 20:02Z) The user answered jobs #95 and #96, both A: supportcards' extractor pulls the faces (T6), and the sheet is committed under `public/icons/` (T7).
- [x] (2026-11-09 20:08Z) Milestone 1 (prototyping): the game has one SD face per idol, `img_sd_<idol id>_face-00`, the default smile, a plain 256 × 256 texture (Surprises & Discoveries). gakumas-supportcards' extractor learned the faces as master-only files on its branch `feat/sd-faces-82` (its issue #82, commit `75ba02f`; its `uv run pytest` 71 passed, each of the four new rules seen to turn a test red when broken); `uv run extract.py --only 'img_sd_'` wrote 15 masters into its `scripts/images/out/master/` and a second run processed none. A contact sheet of all 15 (`scripts/icons/out/check/faces.png`, drawn by a scratch script, not kept) was shown to the user. Remaining: supportcards' branch pushed and merged through a pull request into its `develop`, on the user's go.
- [x] (2026-11-09 20:00Z) Milestone 2: `scripts/icons/idols.py` builds the face sheet and its index (`4433cd8`): `uv run idols.py` → `13 faces, idols96-a82c359e.webp, 43 KB`; the sheet, opened, shows the 13 faces in the data file's order. `uv run --frozen pytest` 58 passed; six mutations of its rules (the missing-face check, the row order, both halves of the stale-sheet filter, the face file, the kept alpha) each turned a test red.
- [x] (2026-11-09 20:05Z) Milestone 3: `uv run idols.py --publish` put `public/icons/idols96-a82c359e.webp` and `src/icons/idols.v1.json` in place; `src/app/idols.ts` reads the index (`5a018ea`). `bun run build` puts the sheet in `dist/icons/` and in `dist/sw.js`'s precache list, with no change to the service worker (every file under `public/` is precached); a test checks that the committed index names a sheet that exists in `public/icons/`, so no separate service worker test was added. Five mutations of `idols.ts` each turned a test red.
- [x] (2026-11-09 20:16Z) Milestone 4: `IdolPicker.tsx` replaces the drop-down `ArtPicker` (`d0caf5c`); the page tests that used the `<select>` now choose through `chooseIdol` and read `chosenIdol` in `src/test-support/page.tsx`. `bun test` 520 passed, `bun run type-check`, `bun run lint` and `bun run build` exit 0; five mutations of the picker (fold on choosing, pressed state, folded at start, lookup by id, the fallback character) each turned a test red. In Chrome on the dev server (Surprises & Discoveries on how 390 px was shown): folded, one line with 花海咲季's face and name; unfolded, 7 + 6 faces inside 390 px, hers ringed; choosing 篠澤広 folded it, showed her face and name, and the rows' card icons switched to her art; after a reload she was still chosen and pressed; at 1200 px the same table. Offline: on `vite preview` the sheet was in the page's install cache (`memomemo-page-…`) after one visit; with the preview server stopped, a reload drew the page and the sheet (43,568 bytes, status 200 from the service worker).
- [x] (2026-11-09 20:35Z) `/codex-review` (codex-cli 0.150.1, read-only in a snapshot; its sandbox held and neither repository was written by it) of this branch (`origin/develop...b1095a4`): CODEX VERDICT: LGTM, no findings on the picker's accessibility, the sheet and index staying in step, or the ported tests; it could not run the DOM suites in its snapshot (no dependencies installed), which ran here (520 pass). Of supportcards' `feat/sd-faces-82` (`origin/develop...75ba02f`): CODEX VERDICT: LGTM, no path that assumes a served rendition reaches a face, and `--only-missing` is unchanged.
- [x] (2026-11-09 20:40Z) On the user's approval (job #97) both branches were pushed; supportcards' pull request #83 merged into its `develop` (`e219f850`) and its #82 closed with the board's `done`; this repository's pull request #98 merged into `develop` (`1ab7e03`), closing #86.
- [x] (2026-11-09 20:52Z) Released by pull request #99 (`develop` into `main`, merge `80ed08e0`); `deploy.yml` run 42696866549 succeeded. On the live site `https://gkms-memomemo.tia.run/icons/idols96-a82c359e.webp` answers 200 `image/webp` with bytes whose SHA-256 starts `a82c359e`, `sw.js` precaches it, and in Chrome 「カードの絵柄」 shows 花海咲季's face and name and unfolds to 13 faces drawn from the 1248 × 96 sheet, with no console error.
- [x] (2026-11-09 20:53Z) Closed out on `docs/close-out-idol-icon-table-100` (#100): T6 and T7 recorded as `docs/adr/0005-the-idols-faces-come-from-supportcards-masters-and-are-committed-as-a-static-sheet.md`, which also corrects T6's claim that the faces go to supportcards' private `master/` prefix in the bucket (they stay local); `CLAUDE.md` indexes the ADR and marks this plan complete. **This plan is complete and immutable from here.**

## Surprises & Discoveries

- Observation: no copy of the game's asset manifest is kept on this machine; the names had to be read from the live manifest.
  Evidence: in `~/Developer/gakumas-supportcards`, no file outside `node_modules` and `.venv` contains `thumb-circle` or `img_sd_`; its extractor fetches the manifest live on every run (2026-11-09).

- Observation: the game has exactly one SD face per idol, `img_sd_<idol id>_face-00`, the default smile, for 15 idols: the 13 playable ones and `hkne` and `nasr`, who are not offered (D34). Each bundle holds one 256 × 256 RGBA texture with a transparent background, no atlas, so there is no expression to choose and nothing to cut. The round thumbnails `img_chr_<id>_00-thumb-circle` exist for many more characters (20 or more, the non-idol cast included).
  Evidence: `gom.fetch().search(r'img_sd_.*face')` on manifest 205100:0082 → 15 names, one per id; the bundle of `img_sd_hski_face-00` (13,081 bytes) holds an AssetBundle and one Texture2D `img_sd_hski_face-00` 256 × 256; masters `(256, 256) RGBA`, alpha 0–255 (2026-11-09).

- Observation: gakumas-supportcards' extractor cannot take these images as it stands. `uv run extract.py --only <regex>` only filters the list its `offered()` builds, and that list holds support cards (`csprt`), P items (`pitem`) and skill cards only; a regex for `img_chr_` matches nothing.
  Evidence: `scripts/images/extract.py` `offered()` and the `--only` help text there, read on 2026-11-09.

- Observation: the face sheet is 43 KB at WebP quality 90 and 34 KB at 80, 31 KB at 75, 29 KB at 60; the alpha, kept lossless, is most of it. Quality 90 is kept: cartoon faces are flat colours and sharp lines, where lossy artefacts show first, and the file is fetched once, at install.
  Evidence: `90 43 KB`, `80 34 KB`, `75 31 KB`, `60 29 KB` for the 13-face row (2026-11-09).

- Observation: in this session Chrome's window could not be resized (the window stayed 1560 px wide inside, likely full screen), so 390 px was shown by loading the page into a same-origin iframe 390 px wide, whose media queries follow the iframe's width.
  Evidence: `resize_window` to 390 and to 400 reported success while `innerWidth` stayed 1560; in the iframe `innerWidth` was 390 (2026-11-09).

## Decision Log

The decisions are numbered T1, T2, … so they cannot be confused with the D numbers of `docs/plans/EXECPLAN_MEMORY_MEMO.md` or the I numbers of `docs/plans/EXECPLAN_GAME_STYLE_ICONS.md`, which this plan cites.

- Decision: T1 — the icon is the game's round thumbnail `img_chr_<idol id>_00-thumb-circle`, not an SD face (`img_sd_<idol id>_face-*`).
  Rationale: it is the one picture per idol the game itself shows where it lists idols, already round and framed for a small size; an SD face comes in several expressions and may be packed with others in one texture, which would need picking and cutting. If Milestone 1 finds an idol without one, this decision is revisited there.
  Date/Author: 2026-11-09, agent. Superseded by T5 the same day.

- Decision: T2 — the thirteen icons are one sprite sheet of thirteen cells, one per idol in the data file's order, 96 px square (twice the 48 CSS px they are drawn at, sharp on a phone's screen), lossy WebP, named by the first 8 hex digits of its SHA-256; a small committed index, `src/icons/idols.v1.json`, names the file, the cell size and the idol of each cell.
  Rationale: one file is one request whatever the page does (the memo plan's D42: on the Workers Free plan every request that runs the Worker counts toward the account's 100,000 a day); a name that is its hash can be cached forever; a committed index ships with the page that reads it, as the skill card index does (I3).
  Date/Author: 2026-11-09, agent.

- Decision: T3 — the table is folded by default. Folded, 「カードの絵柄」 is one button showing the chosen idol's icon and name; unfolded, it is a grid of thirteen icon buttons, seven to a line at 48 px with 4 px gaps (364 px, inside a 390 px screen less the page's padding), the chosen one ringed in pink and marked `aria-pressed`. Choosing an idol folds it again. Each icon's accessible name is the idol's name. An idol the data file lists but the sheet lacks (one the game adds later) is drawn as a grey circle holding the first character of her name.
  Rationale: the setting sits above every tab's 早見表 and is changed rarely, so it should cost one line there, as the folded 早見表 does; seven columns keep two lines of icons inside D17's phone width. A missing icon must not hide a choosable idol.
  Date/Author: 2026-11-09, agent.

- Decision: T4 — the idols offered and their order stay the data file's `idols` (D34); the sheet follows that order when it is built, and the page finds an idol's cell through the index by id, never by position, so a data file whose order changed still draws the right face.
  Rationale: one source for which idols exist; the index is the only bridge between an id and a pixel.
  Date/Author: 2026-11-09, agent.

- Decision: T5 — the icon is the idol's SD face (`img_sd_<idol id>_face-*`, the small cartoon face), in its default smile, drawn inside a white circle on the page. This supersedes T1. Milestone 1 extracts every face of every idol, not only the smile, and builds a contact sheet of all of them (one line per idol, each face labelled with its asset name) that the user looks at; the agent names the file it takes for each idol's default smile, and the user confirms it there or picks another. (Milestone 1 found only one face per idol, the smile, so there was nothing to pick.) The page's sprite sheet holds only the chosen face per idol; the contact sheet is a local review image in `scripts/icons/out/`, not committed or served.
  Rationale: the user's preference ("I prefer the small cartoon faces"), after hearing that T1's reasons were convenience only: one picture per idol, possible cutting from a shared texture, and already round. The user asked to see every expression at the step that picks one, while saying the default smile is enough for this project.
  Date/Author: 2026-11-09, user.

- Decision: T6 — the faces are extracted by gakumas-supportcards' extractor (`scripts/images/extract.py` there), which learns them as a fourth kind of image and writes their lossless masters into its `scripts/images/out/master/` (and its private `master/` prefix in `tia-assets`); this repository builds its sheet from that local library, as `scripts/icons/` already does with the skill card masters (I10). The change in supportcards is made on a branch and an issue of its own there.
  Rationale: the user's answer A to job #95, over a second extractor here. One place talks to the game's servers, so a change in the game's format is fixed once.
  Date/Author: 2026-11-09, user.

- Decision: T7 — the face sheet is committed to this repository under `public/icons/` (`idols96-<8 hex>.webp`), like the placeholder frames `public/icons/frames112.webp` (I5), and served as a static file; it is not uploaded to `tia-assets`, and the Worker gains no route.
  Rationale: the user's answer A to job #96, over the bucket and the Worker's `/img`. The file is about 20 KB; a static file costs no Worker request on the Free plan (a request for a file under `public/` does not run the Worker's code), and the service worker fetches it at install with the page's other files, so it works offline from the first visit. The memo plan's D20b, never taking images from a third party, holds: the faces come from the game through supportcards' own extractor.
  Date/Author: 2026-11-09, user.

## Outcomes & Retrospective

2026-11-09, at close-out: the purpose is met on the live site. A player chooses 「カードの絵柄」 from the 13 idols' SD faces, in one line folded and two lines open on a 390 px phone, offline too, and the choice carries over from the drop-down it replaced. Nothing remains of the plan. What changed on the way: the round thumbnail (T1) gave way to the SD face at the user's choice (T5), the several expressions #14 had assumed turned out to be one, which removed Milestone 1's handling of packed faces and its face map, and Milestone 3's service worker test became a test that the index names a sheet present in `public/icons/`. The extraction lives in gakumas-supportcards (its #82, #83), so a game update that adds an idol means: extract there, `uv run idols.py --publish` here, commit. An idol the data file lists before that is drawn by her name's first character, and nothing watches for it; a daily check like the skill cards' (`docs/plans/EXECPLAN_GAME_STYLE_ICONS.md`, I7) was not asked for. Lessons: list the live asset manifest at the start of any plan that names game assets, since it settles in minutes what a plan may otherwise carry as an assumption; and a decision that names where a file goes in another repository (T6's bucket prefix) should be checked against that repository's upload code before it is written down.

2026-11-09, all four milestones done on the branch: 「カードの絵柄」 is a folded button with the chosen idol's SD face and name, unfolding to the 13 faces, working at 390 px, on a desktop and offline. What remains is review and merging, here and in gakumas-supportcards (#82), whose extractor change this plan relies on to rebuild the sheet. Lesson: the asset manifest settled in minutes what had been carried as an assumption since #14 (several expressions per idol); listing the live manifest belongs at the very start of any plan that names game assets.

## Context and Orientation

The repository `~/Developer/gkms-memomemo` (GitHub `tia-tools/gkms-memomemo`, public) is a Preact page built by Vite with Bun, plus a Cloudflare Worker. Terms used here, in plain language:

A P-idol is one of the thirteen playable idols of 学園アイドルマスター. The page's skill card data file (gakumas-supportcards' `skillcards.v1.json`, read by `src/data/load.ts`, its types in `src/data/contract.ts`) lists them as `idols: { id, name }[]` in the game's order: hski 花海咲季, ttmr 月村手毬, fktn 藤田ことね, atbm 雨夜燕, amao 有村麻央, kllj 葛城リーリヤ, kcna 倉本千奈, ssmk 紫雲清夏, shro 篠澤広, jsna 十王星南, hmsz 秦谷美鈴, hume 花海佑芽, hrnm 姫崎莉波. 「カードの絵柄」 is the setting choosing which idol's version of each card's art the page draws (the memo plan's D20 and D34; default the first idol). Its value is saved in the browser with the memo (`src/app/storage.ts`, `useSaving.ts`) and shared with the components through the page context (`src/app/page.ts`, field `idol`).

Today the setting is `ArtPicker` in `src/app/Settings.tsx`, a labelled `<select>` of the idols' names, which `src/app/MemoPage.tsx` passes into each tab's body (`TabBody`, prop `art`) above `QuickTable`, the 早見表.

A sprite sheet is one image holding many small pictures in a grid of equal cells, so the page loads one file instead of one per picture; the page draws one cell as a CSS background (`spriteStyle` in `src/app/sheets.ts`, which takes an `IconCell`, a sheet URL with its column and row counts and the cell's index, and a CSS size). The skill card sheets are built by the icon pipeline `scripts/icons/` (Python with uv, Pillow and numpy, tests with pytest; see `docs/plans/EXECPLAN_GAME_STYLE_ICONS.md`), uploaded to the shared R2 bucket `tia-assets` (Cloudflare's object storage, shared by every `tia.run` app) under `gkms-memomemo/sheet112/`, and served by this app's Worker at `/img/<key>` (`infra/worker/img.ts`, which serves only names matching one pattern; everything else is a 404). Their index is committed as `src/icons/index.v1.json` and bundled into the page. Static files under `public/` are copied into `dist/` and served by the Worker's assets binding without running the Worker's code.

The service worker (`src/sw/`, the memo plan's D58) makes the page work offline. `vite.config.ts` writes into it, at build time, a manifest: every file of `dist/` including `public/`'s (fetched into its cache at install), the sheet prefix, and every sheet the bundled skill card index names (cached the first time it is shown). `src/sw/routes.ts` decides what each request is.

A master is gakumas-supportcards' lossless WebP copy of an image as the game stores it, named like the game's asset. supportcards' image pipeline (`~/Developer/gakumas-supportcards/scripts/images/`, Python with uv) fetches the game's asset manifest live with the vendored library GkmasObjectManager (unpacked by `./fetch-vendor.sh` at the commit pinned in `GkmasObjectManager.sha`; `extract.py` `load_manifest()`), downloads the matching Unity asset bundles (`manifest.download(…)`), decodes each with UnityPy (`decode.py` `decode_texture`, which tries the Unity versions `6000.0.23f1` and `2022.3.21f1` and keeps the largest texture), and writes masters into its `scripts/images/out/master/`. The asset manifest names the idols' SD faces `img_sd_<idol id>_face-*`, several expressions per idol, and their round thumbnails `img_chr_<idol id>_00-thumb-circle` (from #14; unconfirmed, Surprises & Discoveries). An SD face is the small cartoon ("super deformed") drawing of an idol the game uses in its menus. A Unity asset bundle may hold one texture or an atlas, one texture with several pictures cut from it by Sprite objects that name each one's rectangle; `decode_texture` keeps only the largest texture, so an atlas would hand back the whole sheet rather than one face.

## Plan of Work

Milestone 1 is a prototype: confirm the faces exist, get their masters, and let the user see them. From `scripts/images/` in gakumas-supportcards, list what the manifest holds: `uv run python -c "import sys; sys.path.insert(0, 'vendor/GkmasObjectManager'); import GkmasObjectManager as gom; print('\n'.join(o.name for o in gom.fetch().search(r'img_sd_.*face')))"`. Then, on a branch and issue of its own in gakumas-supportcards (its #82, branch `feat/sd-faces-82`), `extract.py` learns the faces: `thumbnail.py` names them (`SD_FACE_PATTERN`, `file_name_for`, `is_sd_face`), keeps them as lossless RGBA masters (`master_rendition`), and says they have no served rendition (`has_public_rendition` false, `public_prefix_for` refusing them); `extract.py` adds them to `offered()` and writes only their master (`rendition_paths`). The unattended `--only-missing` run never fetches one, since it keeps only files of the cards in supportcards' data. `uv run extract.py --only 'img_sd_'` writes every face's master. Then a contact sheet of every face, one cell per idol with its id, in `scripts/icons/out/check/faces.png`, is shown to the user. Acceptance: the masters of every face in supportcards' `scripts/images/out/master/`, and the contact sheet seen by the user. Done: one face per idol, so T5's face is `img_sd_<idol id>_face-00` for every idol and no face map is needed.

Milestone 2 builds the sheet here. `scripts/icons/idols.py` holds the rules as pure functions (the cell order from the idol list, the placement of each master into a 96 px cell with a high-quality filter, the index's content) and a command: `uv run idols.py --masters <dir> --cards out/offered.json` reads the idol list (`idols` in the JSON `scripts/icons/offered.ts` prints, so Python never reads the data file itself, I8), places each idol's face (`img_sd_<idol id>_face-00.webp`, T5) in a 96 px cell, writes `out/idols96-<8 hex>.webp` (thirteen cells in one row) and `out/idols.v1.json`, and exits 1 naming any idol whose master is missing. `scripts/icons/test_idols.py` checks, on synthetic masters, the order, the cell geometry, the hash in the name and the refusal of a missing master. Acceptance: `uv run pytest` passes; each new rule turns a test red when broken; the sheet, opened, shows thirteen faces in the data file's order.

Milestone 3 publishes. `uv run idols.py --publish` copies the sheet into `public/icons/` and the index into `src/icons/idols.v1.json`, removing an older `public/icons/idols96-*.webp` so only the one the index names remains; the two files are committed together. The page reads the index through a pure reader in `src/app/idols.ts` (refusing a malformed index and a file name that is not `idols96-<8 hex>.webp`, so nothing else can reach a CSS `url()`), tested on the committed file. Because the sheet is under `public/`, the build's service worker manifest already lists it for the install cache; a test in `src/sw/` asserts that it does. Acceptance: `bun run build` puts the sheet in `dist/icons/` and in the service worker's precache list; `bun test` passes.

Milestone 4 is the table. A component `IdolPicker` in `src/app/IdolPicker.tsx` replaces `ArtPicker` (removed from `Settings.tsx`) where `MemoPage.tsx` builds the `art` prop. Folded, it is a button (`aria-expanded`) with the chosen idol's icon at 32 px and her name; unfolded, a group of thirteen buttons at 48 px, seven per line, each `aria-pressed` and named by the idol's name, the chosen one ringed in pink; choosing calls the existing `onIdol` and folds. Which cell an idol uses, and the fallback circle for an idol without one, are pure functions in `src/app/idols.ts` with tests. `components.test.tsx` (or a new `IdolPicker.test.tsx`) drives it in happy-dom through `src/test-support/page.tsx`: unfold, choose 篠澤広, see her pressed and the setting saved, see the fallback for an idol absent from the index. Acceptance: `bun test`, `bun run type-check`, `bun run lint` and `bun run build` exit 0; in Chrome on `bun run dev`, at 390 px and on a desktop window, the table fits without sideways scrolling, choosing an idol redraws the card icons and survives a reload, and the `vite preview` build shows the icons with the network off after one visit.

## Concrete Steps

From the repository root `~/Developer/gkms-memomemo`, after Milestone 1 has filled supportcards' masters:

    cd scripts/icons
    uv sync
    mkdir -p out && bun offered.ts > out/offered.json
    uv run idols.py --masters ../../../gakumas-supportcards/scripts/images/out/master
    uv run pytest
    uv run idols.py --masters ../../../gakumas-supportcards/scripts/images/out/master --publish

Then, from the root:

    bun test && bun run type-check && bun run lint && bun run build
    bun run dev

Judge each by its exit status. Expected from `idols.py` on the faces of 2026-11-09:

    13 faces, idols96-a82c359e.webp, 43 KB
    published public/icons/idols96-a82c359e.webp and src/icons/idols.v1.json

A `missing:` line names an idol whose face master is not in `--masters`, and the command exits 1; extract the faces first in gakumas-supportcards, `cd scripts/images && uv run extract.py --only 'img_sd_'`.

## Validation and Acceptance

On `bun run dev` in Chrome at 390 px width: each tab shows 「カードの絵柄」 as one line with 花海咲季's smiling SD face in a circle and her name (on a fresh profile). Tapping it unfolds thirteen icons in two lines, no horizontal scroll bar, 花海咲季's ringed. Tapping 篠澤広's folds the table, shows her icon and name, and the card icons in the rows and the picker redraw in her art. Reloading keeps her. With `bun run build && bunx vite preview`, after one visit, turning the network off in DevTools and reloading still shows the icons. `bun test` passes, with the new tests seen to fail when their rule is broken (the order, the id lookup, the fallback, the file-name refusal).

## Idempotence and Recovery

`idols.py` rewrites `out/` each run, and `--publish` replaces the sheet and index together; running either twice changes nothing the second time, since the sheet's name is its hash. Extraction in supportcards skips masters already present unless `--force`. Nothing here deletes anything outside `scripts/icons/out/` and the old `public/icons/idols96-*.webp` the new index no longer names.

## Artifacts and Notes

None yet.

## Interfaces and Dependencies

In `src/app/idols.ts`, define:

    export interface IdolIcons { cell: number; file: string; idols: readonly string[] }   // file: "idols96-<8 hex>.webp"; idols: ids, cell i
    export function parseIdolIcons(json: unknown): IdolIcons                               // throws IdolIconsError at the first bad value
    export function idolCell(icons: IdolIcons, idol: string): IconCell | null              // IconCell from src/app/sheets.ts, drawn by spriteStyle
    export function fallbackGlyph(name: string): string                                     // the first character of the name

`src/icons/idols.v1.json`:

    { "formatVersion": 1, "cell": 96, "file": "idols96-<8 hex>.webp", "idols": ["hski", "ttmr", …] }

`scripts/icons/idols.py` uses Pillow only, like the rest of the pipeline (I4). No new npm or Python dependency.

## Revision notes

2026-11-09: the icon changed from the round thumbnail to the SD face at the user's choice (T5 supersedes T1). Purpose, Progress, Surprises & Discoveries, Context and Orientation, Milestones 1 and 2, and Validation now say SD face; Milestone 1 now extracts every face, handles a bundle that packs several faces in one texture, and ends with a contact sheet the user looks at to confirm each idol's default smile.

2026-11-09: the user answered the two open decisions (jobs #95 and #96, both A); they are T6 and T7 in the Decision Log, and the Plan of Work, which was written for those answers, stands as it was.

2026-11-09: Milestone 1 done. The game has one SD face per idol, so Milestone 1's handling of several faces per bundle and its face map were dropped, and Milestone 2 takes `face-00` for every idol.

2026-11-09: Milestones 2, 3 and 4 done; the Progress, Surprises & Discoveries, Concrete Steps and Outcomes sections record them. Milestone 3's planned service worker test was replaced by a test that the index names a sheet present in `public/icons/`, since the service worker precaches every file there without a change.
