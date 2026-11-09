# CLAUDE.md

This file provides guidance to a coding agent when working with code in this repository.

## Central Configuration

This template carries only the project-scoped scaffold: this CLAUDE.md skeleton, `docs/PLANS.md` (ExecPlan methodology), and `docs/adr/README.md` (ADR convention). Cross-project rules and the generic workflow skills (`grill-me`, `close-out`, `codebase-design`, `adopt-from-sibling`, `harvest-session`, `backlog`) live in the central `Taka499/claude` repository, deployed user-level at `~/.claude` — do not copy them into projects.

`docs/PLANS.md` is the one document that exists in both places. The canonical copy is `docs/PLANS.md` in `Taka499/claude`; the copy here is downstream and is checked in so a plan stays followable from a fresh clone with no `~/.claude`. Change the canonical one and propagate; see the note at the top of the file.

## Documentation

Project documentation lives in `docs/`. When creating or updating plans, ExecPlans, or design docs, save them there. Reference existing docs in `docs/` for context on project phases and milestones.

Every document should be self-sufficient: the reader should never need to hunt for context. Explain concepts inline. When a concept is already defined in another checked-in document, you may reference it by file path and section rather than repeating it — but the reference must be precise enough that the reader can find it immediately (e.g., "see `docs/PLANS.md` § Milestones"), not vague ("see the architecture doc").

## ExecPlans

When writing complex features or significant refactors, use an ExecPlan (as described in `docs/PLANS.md`) from design to implementation. ExecPlans are the persistence layer for cross-session development — they carry forward all context, decisions, and progress so that a fresh session can continue the work without loss. Completed plans are immutable history; when one finishes, run the close-out ritual (`close-out` skill) to extract its durable decisions before moving on.

## Durable Decisions (ADRs)

Cross-plan decisions live in `docs/adr/` (convention: `docs/adr/README.md`). This list is an index, not a home — one line per active decision with a pointer to its ADR; full context, provenance, and lifecycle live in the ADR file. Every non-obvious claim elsewhere in this file must cite its source (`per docs/adr/NNNN` or `per docs/plans/<plan>.md`) so this snapshot stays auditable and rebuildable. When an ADR corrects something an old plan asserted, the ADR wins.

- `docs/adr/0002-game-style-icons-are-built-here-from-screenshots-on-supportcards-art.md` — **accepted** (supersedes 0001): the skill card data file and the art masters (every P-idol variant) come from the sibling gakumas-supportcards at runtime; the game-style icons the page draws are built in this repository from the user's P図鑑 screenshots, painted onto every idol's art, and uploaded as sprite sheets under this app's own prefix `gkms-memomemo/` in the shared R2 bucket `tia-assets`, which this app's Worker serves.
- `docs/adr/0003-counts-and-their-daily-cap-live-in-d1-on-the-free-plan.md` — **accepted**: the anonymous counts and the per-player daily cap (200 events, keyed by a salted hash of the player's network) live in one D1 database on the Workers Free plan, with no KV; moving store or plan means migrating the counts.
- `docs/adr/0004-the-memo-lives-only-in-the-players-browser-moved-by-a-versioned-code.md` — **accepted**: the memo is kept only in the player's IndexedDB, never on the server, and moves by the 引き継ぎコード `mm1.…` in the URL fragment; that code is a published format, so a change of the memo's shape keeps a reader for `mm1.` codes.
- `docs/adr/0005-the-idols-faces-come-from-supportcards-masters-and-are-committed-as-a-static-sheet.md` — **accepted**: 「カードの絵柄」's SD faces are extracted by gakumas-supportcards as local masters only (never uploaded), and the face sheet built from them is committed here as a static file `public/icons/idols96-<8 hex>.webp`, not in `tia-assets` and with no Worker route; rebuilding it needs the sibling checkout.

## Project Overview

「学マス　メモリーメモ帳」 (`gkms-memomemo.tia.run`) is a public web page where 学園アイドルマスター players keep a memo of the produce memories they own for the H.I.F. scenario, because the game's own memory list makes it hard to see what is owned and what is still missing while preparing in the あさりゼミ event. A produce memory is the part of a game memory that carries a skill card into the next produce, not the stage memory beside it. The page has one tab per plan (センス / ロジック / アノマリー), each with three sections (the plan's two styles and 共通); a row is one build — skill card, customization and H.I.F. ability — and holds the memories of that build as Vo/Da/Vi ability groups (%%F, %F%, F%%, plus up to two extra patterns), each cell diamond or rainbow, with a folded 早見表 showing which patterns are owned and missing. The memo stays in the player's browser (IndexedDB, moved between devices by a 引き継ぎコード), and the page installs to the home screen and opens offline; anonymous per-section counts of what players choose rank the pickers, kept with a per-player daily cap in Cloudflare D1 on the account's Free plan (decision D41), and the card data and art come from gakumas-supportcards at runtime, the art drawn in game-style frames built here from the user's screenshots (per `docs/plans/EXECPLAN_MEMORY_MEMO.md`, decisions D1–D68, `docs/plans/EXECPLAN_GAME_STYLE_ICONS.md`, and `docs/adr/0002`–`0005`).

`docs/plans/EXECPLAN_MEMORY_MEMO.md` is **complete** (closed out 2026-11-08, #66). The site has been live since 2026-11-01: released through `main` by pull request #52, deployed by `deploy.yml` under an account-owned token, and every point of its Validation and Acceptance held on the live site from a real iPhone (jobs #47 and #67). Later work goes in issues on the board, not into that plan.

`docs/plans/EXECPLAN_IDOL_ICON_TABLE.md` is **complete** (closed out 2026-11-10, #100): 「カードの絵柄」 is chosen from the idols' SD faces, merged by #98 (closing #86), released by #99 and seen working on the live site.

## Architecture

- `src/` is the page: Preact, built by Vite into `dist/`; `src/main.tsx` is the entry and `src/app/App.tsx` the root component, which loads the data file and the memo saved in the browser and hands them, with the bundled icon index, to `MemoPage.tsx`, the memo page of Milestones 4 and 5 (per `docs/plans/EXECPLAN_MEMORY_MEMO.md` § Plan of Work). `src/app/` keeps its rules in pure modules with co-located tests (`catalog.ts` lookups and the customization labels, `sheets.ts` the sprite sheet cells and the placeholder frames, `customize.ts` the customization step's taps, `picker.ts` search, the rarity filter and the 強化 checkbox (#73), `layout.ts` drag and popover geometry, `fit.ts` a card name's width for its one-line size (#68), `idols.ts` the idols' face sheet's index and an idol's cell, found by id (#86), `labels.ts`, `ids.ts`) and its components thin, sharing one context (`page.ts`); `components.test.tsx` and `page.test.tsx` drive the page in happy-dom through `src/test-support/page.tsx` (decisions D48–D56). The memo and the settings are saved in IndexedDB: the rules in `storage.ts` with the store passed in, `idb.ts` the store, and `useSaving.ts` the page's side (D57); with the page open in two tabs, each tells the others after a write through `tabs.ts` (a BroadcastChannel) and they read the store again, as a tab also does when it is shown again, so neither saves an older memo over the other's (#29). The 引き継ぎコード is on the page: `transfer.ts`, `useImport.ts` and `Transfer.tsx` (D59). The counts are `counts.ts`: a new row's event to `POST /count` while 「集計に協力する」 is on, `GET /counts` read whole once at start, and the card and H.I.F. pickers ranked by the section's counts, through a `CountsApi` passed in (D65). `install.ts` says who sees the iPhone's home-screen hint (D61), and `offline.ts` registers the service worker (D58). The look is the game's (D67): IBM Plex Sans JP from `@fontsource/ibm-plex-sans-jp`, imported in `main.tsx`, and the controls and panels as component classes in `src/index.css` (`.btn`, `.btn-on`, `.btn-off`, `.btn-primary`, `.btn-danger`, `.panel`, `.field`). `src/data/` is the data file's contract: `contract.ts` copied verbatim from gakumas-supportcards' `data/skillcard-data-file.ts` (never edited here on its own; a new format version is copied anew), `load.ts` that refuses a whole file at its first bad value, and an empty card or idol list (decision D43), and the published file as `fixtures/skillcards.v1.json` for the tests. `src/memo/` is the memo model, pure functions with no data file needed except where a rule reads a card: the types, a build's key and rules (`build.ts`, the game's caps as named constants), every edit (`edit.ts`, refusals as values), coverage, cell values, the memo reader (`read.ts`, which refuses a whole memo at its first bad value) and the 引き継ぎコード (`code.ts`) (decisions D39–D47; the row sort was withdrawn by D55). `src/lib/read.ts` holds the JSON readers both readers share, and `src/test-support/skillcards.ts` gives tests the fixture's cards by name. `src/icons/index.v1.json` is the committed index of this app's game-style sprite sheets, written by the icon pipeline, and `public/icons/frames112.webp` the placeholder frames (per `docs/plans/EXECPLAN_GAME_STYLE_ICONS.md`, I3 and I5). 「カードの絵柄」 is chosen in `IdolPicker.tsx` from the idols' SD faces (the game's small cartoon faces), one sheet committed as a static file, `public/icons/idols96-<8 hex>.webp`, with its index `src/icons/idols.v1.json` (per `docs/plans/EXECPLAN_IDOL_ICON_TABLE.md`, T2 and T3, and `docs/adr/0005`).
- `src/sw/` is the service worker (D58): pure rules (`routes.ts`) and handlers over caches passed in (`handlers.ts`), wired by `sw.ts`, which `vite.config.ts` builds as a standalone `/sw.js` with a manifest of the page's files written in (`build.ts`); the font's files, built under `fonts/`, are kept as the page uses them rather than at install (D68); a module shared with the page stops the build. `public/manifest.webmanifest` makes the page installable, with icons drawn by `scripts/icons/app_icon.py` from the page's own cells, no game image (D60).
- `infra/worker/` is the Cloudflare Worker on `gkms-memomemo.tia.run`: it serves `dist/` as static assets, and runs its own code only for `/data/skillcards.json` (proxied from gakumas-supportcards), `/img/*` (this app's sprite sheets under `gkms-memomemo/sheet112/`, read from the shared R2 bucket `tia-assets`), and `POST /count` and `GET /counts`, the anonymous counts in the D1 database bound as `DB` (`count.ts` with its exact daily cap, `count-event.ts` checking an event against the data file through the page's own rules, the tables in `migrations/`, a daily Cron Trigger deleting past days' caps; per `docs/adr/0003` and the plan's D63); see `infra/worker/README.md`. Every request that runs the Worker counts toward the account's Free-plan allowance of 100,000 a day, shared by every `tia.run` Worker, which is why icons come as sprite sheets (per the plan, D42 and § Surprises & Discoveries).
- `scripts/icons/` is the icon pipeline (Python with uv, plus Bun scripts), run on the user's machine: it identifies each P図鑑 screenshot's card, lifts the game's overlay off the art, paints it on every idol's art from gakumas-supportcards' masters, builds the sheets, uploads them and stamps each cell with its card's fingerprint for the daily check; see `docs/plans/EXECPLAN_GAME_STYLE_ICONS.md` § Concrete Steps. `idols.py` builds the idols' face sheet from supportcards' SD face masters (its `extract.py --only 'img_sd_'`) and, with `--publish`, copies it into `public/icons/` and its index into `src/icons/` (`docs/plans/EXECPLAN_IDOL_ICON_TABLE.md` § Concrete Steps).
- `vite.config.ts` builds the service worker, and gives the dev server and `vite preview` (the build with its worker, for offline checks; the plan's § Concrete Steps) the Worker's routes from local files: the sibling checkout `../gakumas-supportcards` (or `SUPPORTCARDS_DIR`) for the built data file, else this repository's fixture, and the icon pipeline's `scripts/icons/out/` for the sheets; a missing image answers 404, as the Worker does.

## Setup and Development

    bun install
    bun run dev        # the page on Vite's dev server, with the Worker's routes from local files

Bun 1.4.3, the version CI pins (`infra/workflows.test.ts` checks the two agree).

## Build and Test

    bun test           # unit tests, co-located as *.test.ts
    bun run type-check # tsc --noEmit
    bun run lint       # oxlint --deny-warnings
    bun run build      # vite build into dist/

Judge each by its exit status: a clean type check or lint prints only the command line. `check.yml` runs all four on every pull request into `develop`, and `deploy.yml` runs them again before it deploys from `main` (`infra/worker/README.md` § Deploy).

## Code Style

The lint policy is `oxlint.config.ts`, adopted from gkms-hif-final-stats: size and complexity limits and the type escape hatches are errors, and an exception goes in that file with its reason and removal condition, never inline. Rules are pure functions in their own files with a co-located test; I/O stays at the call site.

## Tasks

Tasks live on the GitHub board `tia-tools` project `7`; work them with the `task-board` skill. Merges go through PRs into `develop`, the default branch; a PR closes its issue with `Closes #N`.

## Commit Discipline

- Follow Git-flow workflow to manage the branches
- Use small, frequent commits rather than large, infrequent ones
- Only add and commit affected files; leave untracked files as they are
- Never add coding agent attribution in commits

