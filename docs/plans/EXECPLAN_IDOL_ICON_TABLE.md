# Choose 「カードの絵柄」 from a table of the idols' icons

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. It is maintained in accordance with `docs/PLANS.md` at the repository root.

## Purpose / Big Picture

「学マス　メモリーメモ帳」 (`gkms-memomemo.tia.run`, this repository) draws every skill card in the art of one P-idol, the player's choice in the setting 「カードの絵柄」. Today that choice is a plain drop-down of thirteen names above each tab's 早見表 (the folded quick-reference table). Players know the idols by face before name, and a drop-down hides the other twelve until it is opened.

After this plan, 「カードの絵柄」 shows the chosen idol's round icon, the one the game itself uses for her, with her name; tapping it unfolds a table of all thirteen icons, and tapping one chooses her, ringed in the page's pink, and every card icon on the page redraws in her art. The table fits a 390 px phone screen without sideways scrolling and works offline like the rest of the page.

To see it working: run the page (`bun run dev`), open any tab, tap 「カードの絵柄」, tap 篠澤広's icon, and see the card icons in the rows change to her art and her icon ringed; reload and see the choice kept.

The work is issue #86 on the project's board (`tia-tools` project 7, see `CLAUDE.md` § Tasks), split from #14 by the user's answer B to job #77: #14 moved the setting above the 早見表, still chosen by name; this issue carries the icons.

## Progress

- [x] (2026-11-09 19:40Z) #86 claimed on `feat/idol-icon-table-86`; the context read (the icon plan, ADR 0002, the Worker's `/img` route, the service worker's routes, `ArtPicker`, and gakumas-supportcards' image pipeline); this plan drafted with two decisions left to the user (Decision Log, "Open").
- [ ] The user's answers to the two open decisions (where the icons are extracted; where their sheet is kept), recorded in the Decision Log and this plan revised to match.
- [ ] Milestone 1 (prototyping): the thirteen `img_chr_<idol id>_00-thumb-circle` images found in the game's asset manifest, extracted as lossless masters, and looked at.
- [ ] Milestone 2: the idol sheet and its index built locally by `scripts/icons/idols.py`, with tests.
- [ ] Milestone 3: the sheet published where the user decided, and the page able to load it online and offline.
- [ ] Milestone 4: the table on the page, replacing the drop-down, with tests and a look in Chrome at 390 px and on a desktop window.

## Surprises & Discoveries

- Observation: no copy of the game's asset manifest is kept on this machine, so whether every idol has a `…_00-thumb-circle` image is still unconfirmed. The names come from #14, read from the manifest of version 205100:0075.
  Evidence: in `~/Developer/gakumas-supportcards`, no file outside `node_modules` and `.venv` contains `thumb-circle` or `img_sd_`; its extractor fetches the manifest live on every run (2026-11-09).

- Observation: gakumas-supportcards' extractor cannot take these images as it stands. `uv run extract.py --only <regex>` only filters the list its `offered()` builds, and that list holds support cards (`csprt`), P items (`pitem`) and skill cards only; a regex for `img_chr_` matches nothing.
  Evidence: `scripts/images/extract.py` `offered()` and the `--only` help text there, read on 2026-11-09.

## Decision Log

The decisions are numbered T1, T2, … so they cannot be confused with the D numbers of `docs/plans/EXECPLAN_MEMORY_MEMO.md` or the I numbers of `docs/plans/EXECPLAN_GAME_STYLE_ICONS.md`, which this plan cites.

- Decision: T1 — the icon is the game's round thumbnail `img_chr_<idol id>_00-thumb-circle`, not an SD face (`img_sd_<idol id>_face-*`).
  Rationale: it is the one picture per idol the game itself shows where it lists idols, already round and framed for a small size; an SD face comes in several expressions and may be packed with others in one texture, which would need picking and cutting. If Milestone 1 finds an idol without one, this decision is revisited there.
  Date/Author: 2026-11-09, agent.

- Decision: T2 — the thirteen icons are one sprite sheet of thirteen cells, one per idol in the data file's order, 96 px square (twice the 48 CSS px they are drawn at, sharp on a phone's screen), lossy WebP, named by the first 8 hex digits of its SHA-256; a small committed index, `src/icons/idols.v1.json`, names the file, the cell size and the idol of each cell.
  Rationale: one file is one request whatever the page does (the memo plan's D42: on the Workers Free plan every request that runs the Worker counts toward the account's 100,000 a day); a name that is its hash can be cached forever; a committed index ships with the page that reads it, as the skill card index does (I3).
  Date/Author: 2026-11-09, agent.

- Decision: T3 — the table is folded by default. Folded, 「カードの絵柄」 is one button showing the chosen idol's icon and name; unfolded, it is a grid of thirteen icon buttons, seven to a line at 48 px with 4 px gaps (364 px, inside a 390 px screen less the page's padding), the chosen one ringed in pink and marked `aria-pressed`. Choosing an idol folds it again. Each icon's accessible name is the idol's name. An idol the data file lists but the sheet lacks (one the game adds later) is drawn as a grey circle holding the first character of her name.
  Rationale: the setting sits above every tab's 早見表 and is changed rarely, so it should cost one line there, as the folded 早見表 does; seven columns keep two lines of icons inside D17's phone width. A missing icon must not hide a choosable idol.
  Date/Author: 2026-11-09, agent.

- Decision: T4 — the idols offered and their order stay the data file's `idols` (D34); the sheet follows that order when it is built, and the page finds an idol's cell through the index by id, never by position, so a data file whose order changed still draws the right face.
  Rationale: one source for which idols exist; the index is the only bridge between an id and a pixel.
  Date/Author: 2026-11-09, agent.

- Open (for the user, job filed on the board): where the icons are extracted from the game. (A) gakumas-supportcards' extractor learns a fourth kind, the idols' round thumbnails, and writes them as masters into its `scripts/images/out/master/` (and its private `master/` prefix in `tia-assets`), and this repository builds the sheet from that local library, as `scripts/icons/` already does with skill card masters (I10). That keeps one place that talks to the game's servers, at the cost of a change and an issue in another repository. (B) this repository gets its own small extractor in `scripts/icons/`, copying supportcards' `fetch-vendor.sh`, its pinned GkmasObjectManager commit and `decode.py`. That keeps the work in one repository, at the cost of a second copy of the extraction code to keep working when the game changes its format. The agent recommends A.

- Open (for the user, job filed on the board): where the sheet is kept. (A) committed to this repository as `public/icons/idols-<8 hex>.webp`, like the placeholder frames `public/icons/frames112.webp` (I5): about 20 KB, served by the Worker's static assets for free (a request for a static file does not run the Worker), and fetched into the page's offline cache at install with the page's other files. (B) uploaded to the shared R2 bucket `tia-assets` under `gkms-memomemo/idols96/` and served by this app's Worker at `/img/…`, as the skill card sheets are (I3), which is what the memo plan's D20b ("fetched from the game ourselves and stored in R2") says literally; it costs a widened Worker route, an upload step, and one Worker request per device the first time the table is drawn. The agent recommends A: the file is small, it needs no Worker code, and it works offline from the first visit; D20b's point, never taking images from a third party, holds either way.

## Outcomes & Retrospective

Nothing yet.

## Context and Orientation

The repository `~/Developer/gkms-memomemo` (GitHub `tia-tools/gkms-memomemo`, public) is a Preact page built by Vite with Bun, plus a Cloudflare Worker. Terms used here, in plain language:

A P-idol is one of the thirteen playable idols of 学園アイドルマスター. The page's skill card data file (gakumas-supportcards' `skillcards.v1.json`, read by `src/data/load.ts`, its types in `src/data/contract.ts`) lists them as `idols: { id, name }[]` in the game's order: hski 花海咲季, ttmr 月村手毬, fktn 藤田ことね, atbm 雨夜燕, amao 有村麻央, kllj 葛城リーリヤ, kcna 倉本千奈, ssmk 紫雲清夏, shro 篠澤広, jsna 十王星南, hmsz 秦谷美鈴, hume 花海佑芽, hrnm 姫崎莉波. 「カードの絵柄」 is the setting choosing which idol's version of each card's art the page draws (the memo plan's D20 and D34; default the first idol). Its value is saved in the browser with the memo (`src/app/storage.ts`, `useSaving.ts`) and shared with the components through the page context (`src/app/page.ts`, field `idol`).

Today the setting is `ArtPicker` in `src/app/Settings.tsx`, a labelled `<select>` of the idols' names, which `src/app/MemoPage.tsx` passes into each tab's body (`TabBody`, prop `art`) above `QuickTable`, the 早見表.

A sprite sheet is one image holding many small pictures in a grid of equal cells, so the page loads one file instead of one per picture; the page draws one cell as a CSS background (`spriteStyle` in `src/app/sheets.ts`, which takes an `IconCell`, a sheet URL with its column and row counts and the cell's index, and a CSS size). The skill card sheets are built by the icon pipeline `scripts/icons/` (Python with uv, Pillow and numpy, tests with pytest; see `docs/plans/EXECPLAN_GAME_STYLE_ICONS.md`), uploaded to the shared R2 bucket `tia-assets` (Cloudflare's object storage, shared by every `tia.run` app) under `gkms-memomemo/sheet112/`, and served by this app's Worker at `/img/<key>` (`infra/worker/img.ts`, which serves only names matching one pattern; everything else is a 404). Their index is committed as `src/icons/index.v1.json` and bundled into the page. Static files under `public/` are copied into `dist/` and served by the Worker's assets binding without running the Worker's code.

The service worker (`src/sw/`, the memo plan's D58) makes the page work offline. `vite.config.ts` writes into it, at build time, a manifest: every file of `dist/` including `public/`'s (fetched into its cache at install), the sheet prefix, and every sheet the bundled skill card index names (cached the first time it is shown). `src/sw/routes.ts` decides what each request is.

A master is gakumas-supportcards' lossless WebP copy of an image as the game stores it, named like the game's asset. supportcards' image pipeline (`~/Developer/gakumas-supportcards/scripts/images/`, Python with uv) fetches the game's asset manifest live with the vendored library GkmasObjectManager (unpacked by `./fetch-vendor.sh` at the commit pinned in `GkmasObjectManager.sha`; `extract.py` `load_manifest()`), downloads the matching Unity asset bundles (`manifest.download(…)`), decodes each with UnityPy (`decode.py` `decode_texture`, which tries the Unity versions `6000.0.23f1` and `2022.3.21f1` and keeps the largest texture), and writes masters into its `scripts/images/out/master/`. The asset manifest names the idols' round thumbnails `img_chr_<idol id>_00-thumb-circle` (from #14; unconfirmed, Surprises & Discoveries).

## Plan of Work

This section is written for the agent's recommendations (A and A in the Decision Log's open entries); it is revised when the user answers.

Milestone 1 is a prototype: confirm the icons exist and get their masters. In gakumas-supportcards, on a branch and issue of its own there, `extract.py` learns the idols' thumbnails: `offered()` also returns every manifest name matching `img_chr_[a-z]{4}_00-thumb-circle` whose idol id is in the data's playable idols (`scripts/images/skillcards.py` `idol_ids()`), and the master is written as it is decoded, with no resized renditions (nothing of supportcards serves them). First, from `scripts/images/` there, list what the manifest holds: `uv run python -c "import sys; sys.path.insert(0, 'vendor/GkmasObjectManager'); import GkmasObjectManager as gom; print('\n'.join(o.name for o in gom.fetch().search(r'img_chr_.*thumb-circle')))"`. Expected: thirteen names or more, one per playable idol (and perhaps 根緒亜紗里, `nasr`, who is not offered, D34). Then `uv run extract.py --only 'thumb-circle'` writes thirteen masters. Look at them: size, a transparent outside the circle, and whether a frame is drawn in. Record what was found in Surprises & Discoveries. If an idol has no thumbnail, stop and revisit T1. Acceptance: thirteen files `img_chr_<idol id>_00-thumb-circle.webp` in supportcards' `scripts/images/out/master/`, opened and seen to be the idols' faces.

Milestone 2 builds the sheet here. `scripts/icons/idols.py` holds the rules as pure functions (the cell order from the idol list, the placement of each master into a 96 px cell with a high-quality filter, the index's content) and a command: `uv run idols.py --masters <dir> --cards out/offered.json` reads the idol list (`idols` in the JSON `scripts/icons/offered.ts` prints, so Python never reads the data file itself, I8), places each idol's master, writes `out/idols96-<8 hex>.webp` (thirteen cells in one row) and `out/idols.v1.json`, and exits 1 naming any idol whose master is missing. `scripts/icons/test_idols.py` checks, on synthetic masters, the order, the cell geometry, the hash in the name and the refusal of a missing master. Acceptance: `uv run pytest` passes; each new rule turns a test red when broken; the sheet, opened, shows thirteen faces in the data file's order.

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

Judge each by its exit status. Expected transcripts are added here as the milestones run.

## Validation and Acceptance

On `bun run dev` in Chrome at 390 px width: each tab shows 「カードの絵柄」 as one line with 花海咲季's round icon and name (on a fresh profile). Tapping it unfolds thirteen icons in two lines, no horizontal scroll bar, 花海咲季's ringed. Tapping 篠澤広's folds the table, shows her icon and name, and the card icons in the rows and the picker redraw in her art. Reloading keeps her. With `bun run build && bunx vite preview`, after one visit, turning the network off in DevTools and reloading still shows the icons. `bun test` passes, with the new tests seen to fail when their rule is broken (the order, the id lookup, the fallback, the file-name refusal).

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
