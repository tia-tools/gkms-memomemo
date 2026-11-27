# Read the game's data and art from gkms-library

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. It is maintained in accordance with `docs/PLANS.md` at the repository root.

## Purpose / Big Picture

「学マス　メモリーメモ帳」 (`gkms-memomemo.tia.run`, this repository) is a public page where 学園アイドルマスター players keep a memo of the produce memories they own. Everything it knows about the game, the skill cards it offers, the H.I.F. abilities, the playable idols and the art its icons are built from, comes today from a sibling app, gakumas-supportcards, which builds a skill card file shaped for this page alone and keeps the art's lossless originals on its owner's machine. A new idol shows the cost of that: 氷渡香名江 (`hkne`) is in today's data, but 「カードの絵柄」 (the setting that picks whose art the cards are drawn in) has no face for her, because the face sheet is rebuilt by hand from supportcards' local files (issue #103).

A neutral service now publishes the game's data and images for every `tia.run` app: gkms-library, at `https://gkms-library.tia.run`, regenerated twice a day with no person involved (repository `tia-tools/gkms-library`, its `README.md` and its plan `docs/plans/EXECPLAN_LIBRARY_ALONE.md`, decision L6, which makes this app the first to move). After this plan, this page reads the library's files instead of supportcards', cuts its own card pool from them, and builds its icons from masters synced from the library. A player sees no change in the cards offered (the pool is the same 361 cards and 115 abilities), and a new idol's face appears in 「カードの絵柄」 without anyone rebuilding anything, if the faces are loaded from the library (an open decision below). On the developer side, nothing in this repository reads `gakumas-supportcards.tia.run` or a supportcards checkout any more.

To see it working after release: open `https://gkms-memomemo.tia.run`, tap 「カードの絵柄」 and see fourteen faces, 氷渡香名江's among them; in the browser's network panel, no request goes to `gakumas-supportcards.tia.run`; and `git grep gakumas-supportcards.tia.run` in this repository finds nothing outside history documents.

The work is issue #109 on the project's board (`tia-tools` project 7, see `CLAUDE.md` § Tasks), worked on the branch `feat/library-data-109`. It also settles issue #103.

## Progress

- [x] (2026-11-27 13:25Z) #109 queued and claimed on `feat/library-data-109` (from `origin/develop` at `7aa7fca`); the library's `README.md`, its four formats and its plan read; this repository's data seam, Worker, service worker, face picker and icon pipeline read; the pool rule prototyped on the library's live files (Surprises & Discoveries: it reproduces today's file exactly); this plan drafted with two decisions left to the user (Decision Log, "Open").
- [x] (2026-11-27 13:30Z) Jobs filed for the two open decisions, holding up #109: #111 (D-fetch, where the browser fetches the data; recommended B) and #112 (D-faces, how the faces are loaded; recommended A).
- [x] (2026-11-27 13:40Z) Milestone 1, formats: `valibot@1.5.0` added; `skill-cards.v1.ts`, `idols.v1.ts` and `latest.v1.ts` copied into `src/data/formats/`, their SHA-256 equal to the hashes gkms-library pins for them; `pinned.test.ts` turned red when a space was appended to a copy (`dbf6e01`). The test reads the files with `Bun.file`, since oxlint's `security(detect-non-literal-fs-filename)` refuses `readFileSync` of a computed path.
- [x] (2026-11-27 13:50Z) Milestone 1, pool: `src/data/pool.ts` and its test, with the three fixtures of L4 (`0be8752`). The equality test passes (361 cards, 115 abilities, 14 idols); removing each of the ten clauses of the rule and the refusal in turn turned one to three tests red.
- [x] (2026-11-27 13:58Z) Milestone 1, readers: every import of `src/data/contract.ts` moved to `pool.ts` with the types renamed (`SkillCardDataFile` → `Pool`, `SkillCard` → `PoolCard`, `SkillCardRarity`/`Type`/`Plan` → `CardRarity`/`Type`/`Plan`), `contract.ts` deleted, and `src/test-support/skillcards.ts`, `src/app/App.test.tsx` and `scripts/icons/offered.test.ts` on the pool of the library fixtures (`2f09dbd`). No test depended on the 2026-10-31 card set: `bun test` 531 pass, and type-check, lint and build exit 0. Remaining from this milestone: the old reader `parseSkillCardData` in `src/data/load.ts`, its test and the old fixture `skillcards.v1.json` stay until Milestone 2 replaces the page's fetch.
- [x] (2026-11-27 14:05Z) Milestone 2, the part common to both answers of #111: `src/data/library.ts` (`loadLibrary`, `releasePath`, `LibraryError`) with the pointer of 2026-11-27 committed as `src/data/fixtures/latest.v1.20261127T1126Z.json` (`d857e9c`); 9 tests, and breaking the status check, the version filter, the idols check or the default address each turned one or more red (the version filter and the idols check survived until a test each was added). The Worker's count rules (`infra/worker/count-data.ts`) and the icon scripts read the pool through it: `scripts/icons/library.ts` (`readLibrary`, an address or a local directory), `check.ts --library` replacing `--data`, `offered.ts [address or directory]` (`bfafba0`). `bun test` 542 pass; type-check, lint and build exit 0; `wrangler deploy --dry-run` bundles the Worker at 43.87 KiB. Run against the live library, `offered.ts` printed 14 idols and 349 offered cards, and `check.ts` reported `0 new, 349 changed`, the same list the open issue #110 already holds (Surprises & Discoveries).
- [ ] Milestone 2, remaining: the page's own fetch, written to the answer of #111; then the old reader (`parseSkillCardData` in `src/data/load.ts`, its test, the fixture `skillcards.v1.json`) goes, and with answer B the Worker's `/data/skillcards.json` route.
- [ ] Milestone 3: the faces (shape set by the second decision); #103 settled; ADR 0005 superseded.
- [ ] Milestone 4: the icon pipeline reads masters synced from the library; the daily icons check runs after the library's update.
- [ ] Milestone 5: documents, `/codex-review`, pull request into `develop`, release into `main`, and the live checks.

## Surprises & Discoveries

- Observation: the pool rule, applied to the library's files, gives exactly the skill card file supportcards publishes today: the same 361 cards in the same order, equal on every field the old file has, the same 115 H.I.F. abilities mapped to the same cards, and the same 14 idols in the same order.
  Evidence: a scratch Python script (not kept) on 2026-11-27 13:15Z over `https://gkms-library.tia.run/data/skill-cards/v1/20261127T1126Z-a09c6f2a.json`, `…/idols/v1/20261116T1124Z-5122c626.json` and `https://gakumas-supportcards.tia.run/data/skillcards.v1.json`, all fetched that minute: `lib pool 361 abil 115 | old cards 361 abil 115 idols old 14 lib 14`, no id in one and not the other, `field diffs 0`, `order equal True`, `abil equal True`, `idols True`.
- Observation: the library's skill card release is about five times today's file: 996,180 bytes against 192,178, but 42,027 bytes gzipped, and the address answers it with Brotli. It holds 1,841 card rows (every card at every upgrade level).
  Evidence: `ls -l` and `gzip -c | wc -c` on the release above; `curl -sI -H "Accept-Encoding: gzip, br"` shows `content-encoding: br`.
- Observation: the case of #103 is live: the idols file names 14 idols, the committed face sheet (`public/icons/idols96-a82c359e.webp`, index `src/icons/idols.v1.json`) has 13, missing `hkne` (氷渡香名江), who is drawn today by the first character of her name. Every one of the 14 faces is already at the library's address, `https://gkms-library.tia.run/img/w112/img_sd_<idol id>_face-00.webp`, each 2,954 to 3,966 bytes, answered with `cache-control: public, max-age=31536000, immutable` and `access-control-allow-origin: *`.
  Evidence: `curl` of each of the 14 on 2026-11-27 13:18Z, all `200`.
- Observation: every file at the library's address is readable from any origin (`access-control-allow-origin: *`). The pointer `data/latest.v1.json` is answered with `cache-control: public, max-age=300`, a release with `public, max-age=31536000, immutable`. This repository's page sets no Content-Security-Policy (`git grep -i content-security` finds nothing), so nothing in the page itself stops it from fetching or drawing from that origin.
  Evidence: `curl -sI` of the pointer and of both releases, 2026-11-27 13:12Z.

- Observation: the daily icons check reports every offered card as changed in the game since its screenshot (`0 new, 349 changed`), with the library as its source exactly as with supportcards' file: the open issue #110, written by the workflow before this branch, lists the same 349. So the count comes from the game's table and the stamps (`scripts/icons/stamps.json`), not from this move; it is outside this plan.
  Evidence: `bun scripts/icons/check.ts --out $TMPDIR/icons` on 2026-11-27 at 14:03Z; `gh issue view 110` shows "Changed in the game since their screenshot (349)".

## Decision Log

- Decision: L1 — the pool rule moves here, unchanged. A skill card row of the library's `skill-cards` v1 is in the pool when its `upgrade` is 0 or 1; its `origin.tag` is not `idolUnique` and its `origin.supportCard` is null; it is not a starter (`origin.tag` `starter`) other than level 0 of 表現の基本 (`p_card-00-men-0_003`); its `type` is not `trouble`; and its `rarity` is not `Legend`. A memory ability is an H.I.F. ability when its `groups` include `produce_group-003` and its `card` is a pool card's id. These are the memo plan's decisions D8, D37 and D38 (`docs/plans/EXECPLAN_MEMORY_MEMO.md`), as supportcards' `scripts/lib/build-skillcards.ts` applied them; the rule this page applies on top (no N card but 表現の基本, D54) stays in `src/app/catalog.ts` as today.
  Rationale: the library publishes every card as neutral facts (its decision L8), so a pool is an app's own rule; the prototype shows the rule reproduces today's file exactly.
  Date/Author: 2026-11-27, Claude (from the issue's text).
- Decision: L2 — the app keeps one internal shape for what it reads, the pool: idols, pool cards and H.I.F. abilities, the fields today's `SkillCardDataFile` in `src/data/contract.ts` has. `src/data/pool.ts` builds it from the two checked library files, and every reader of today's type (the catalog, the page, the Worker's count rules, the icon check scripts) takes the pool instead, unchanged otherwise. `contract.ts` stops being a verbatim copy of supportcards' file: its types become this app's own, in `pool.ts`, and the type is renamed `Pool`.
  Rationale: the seam already exists, and every consumer works from it; building the same shape from new sources keeps the change to the readers mechanical and lets the equality test (L1) prove the move loses nothing. Leaving the name `SkillCardDataFile` would keep saying it is a published file, which it no longer is.
  Date/Author: 2026-11-27, Claude.
- Decision: L3 — the library's files are checked by their own format files, copied verbatim into `src/data/formats/` (`skill-cards.v1.ts`, `idols.v1.ts`, and the pointer's `latest.v1.ts`) and called through their `parse`; a test pins each copy's SHA-256. This needs Valibot at major version 1, added as a dependency. The hand-written reader in `src/data/load.ts` and its readers for the card file go; `src/lib/read.ts` stays, since the memo reader, the icon index and the counts use it. Beyond the formats' own checks, an empty pool (no card left after the cut) refuses the files, keeping the spirit of the memo plan's D43 (an empty list is a broken publication).
  Rationale: the issue asks for it, and the library's `README.md` § Reading it from an app says the same: copy, call `parse`, pin the hash, since a format file never changes once published and a change of shape is a new version beside the old one.
  Date/Author: 2026-11-27, Claude (from the issue's text).
- Decision: L4 — the test fixtures become the library's releases of 2026-11-27, committed under `src/data/fixtures/` by their release names, with the supportcards file fetched the same minute kept beside them for the equality test. The old fixture `skillcards.v1.json` (supportcards' file of 2026-10-31) goes once no test reads it.
  Rationale: the tests should run on what the page will read; the equality test is the proof of step 1 of #109.
  Date/Author: 2026-11-27, Claude.
- Open: D-fetch — where the browser fetches the data from. (A) still through this Worker, at this origin: the Worker reads the pointer and both releases and serves them to the page in one answer, so the service worker's data route and the dev server's shape barely change, at one Worker request per page load as today. (B) straight from the library's address: the page fetches the pointer and then the two releases itself; no Worker request for data, and the Worker's `/data/skillcards.json` route goes, but the service worker must learn to keep files of another origin (the pointer network-first with a kept copy, a release cache-first since its name never changes meaning, releases the kept pointer no longer names dropped). Either way the Worker's count check reads the library itself, server-side. Filed as job #111 (recommended B). The answer is recorded here and Milestone 2 written to it.
- Open: D-faces — how 「カードの絵柄」's faces are loaded. (A) from the library's address, one image per idol (`img/w112/img_sd_<idol id>_face-00.webp`, about 3.5 KB each), so a new idol's face appears by itself; the committed sheet, its index and `idols.py --publish` go, the service worker keeps the faces for offline, and a face not yet published is drawn by the first character of the name as today. (B) a sheet built here as today, from masters synced from the library, committed under `public/icons/`; a new idol still needs a rebuild and a commit, and #103's daily check still has to notice it (the question of job #104). Filed as job #112 (recommended A); either answer settles #103 and supersedes ADR 0005 with a new ADR.

## Outcomes & Retrospective

(Nothing yet.)

## Context and Orientation

Words used throughout. A *skill card* is a card of the game; each exists at upgrade levels 0 (base) and 1 (+, 強化), and higher in the library's file. A *produce memory* is the part of a game memory that carries a skill card into the next produce; this page's *pool* is the set of skill cards that can be one. An *H.I.F. ability* is a memory ability of the H.I.F. scenario, each tied to one card. A *P-idol* is a playable idol; some cards are drawn differently for each (`art.perIdol`). A *master* is a lossless original of a game image; this repository's icon pipeline paints its game-style icons on masters. A *release* of the library is one update's content of one format, at a path that never gets other content; the *pointer* `data/latest.v1.json` names each format's newest release and is the only file that changes under its name. A *format* is the shape of a library file, published as a TypeScript file with a Valibot schema and a `parse` function (Valibot is a small schema library: a schema object checks an unknown value and returns it typed, or the issues found).

The data seam today. `src/data/contract.ts` holds the types of supportcards' skill card file (`SkillCardDataFile`: `formatVersion`, `idols`, `cards`, `hifAbilities`). `src/data/load.ts` reads that file from untrusted JSON (`parseSkillCardData`, built on the readers of `src/lib/read.ts`) and fetches it from this origin's route `/data/skillcards.json` (`loadSkillCardData`, called by `src/main.tsx`). The Worker (`infra/worker/`, file `data.ts`) answers that route by passing through `https://gakumas-supportcards.tia.run/data/skillcards.v1.json` with an hour's cache. Readers of the parsed file: `src/app/App.tsx` and `src/app/catalog.ts` (lookups, and `offered`, this page's rule of which pool cards a picker shows); `infra/worker/count-data.ts` and `count-event.ts` (`POST /count` checks an event against the file, fetched server-side and kept an hour); `scripts/icons/check.ts` and `offered.ts` (the daily icons check, run by `.github/workflows/icons.yml` at 11:45 UTC, "after gakumas-supportcards' data update"); `src/test-support/skillcards.ts` (the fixture's cards by name, for tests). The fixture is `src/data/fixtures/skillcards.v1.json`.

The service worker (`src/sw/`, built as `/sw.js` by `vite.config.ts`): `routes.ts` sorts each request into `page`, `precached`, `data`, `sheet`, `font` or `network`, and today only requests to this origin are ever handled; `data` (the route above) is fetched from the network with the last copy kept for offline. `worthKeeping` picks, from the URLs a first visit loaded before the service worker controlled the page, those to keep. The dev server and `vite preview` (in `vite.config.ts`) answer `/data/skillcards.json` from the sibling checkout `../gakumas-supportcards` (or `SUPPORTCARDS_DIR`), else this repository's fixture.

The faces. 「カードの絵柄」 is `src/app/IdolPicker.tsx`; it draws each idol's face as a cell of one committed sheet, `public/icons/idols96-a82c359e.webp`, indexed by `src/icons/idols.v1.json` and read by `src/app/idols.ts`; an idol the sheet lacks is drawn by her name's first character. `scripts/icons/idols.py` builds the sheet from supportcards' local masters (`../gakumas-supportcards/scripts/images/out/master/img_sd_<id>_face-00.webp`) and with `--publish` copies it into place. Why it is so is `docs/adr/0005-the-idols-faces-come-from-supportcards-masters-and-are-committed-as-a-static-sheet.md`, which this plan supersedes.

The icon pipeline (`scripts/icons/`, Python with uv): `lift.py`, `build.py` and `idols.py` each take `--masters`, defaulting to `../../../gakumas-supportcards/scripts/images/out/master` relative to the script. The library offers the same masters through `bun run sync-masters -- --dest <directory> [--only <regular expression>]`, run in a gkms-library checkout (it copies them from the library's private bucket `gkms-library-masters`, so it needs the user's Cloudflare login there).

The library side, in short (from its `README.md`, read 2026-11-27): the pointer, then `data/<format>/v<N>/<release>.json`; formats at `formats/<format>.v<N>.ts`; skill card icons at `img/w112/<asset>.webp` and `img/w112/<asset>-<idol id>.webp`; faces at `img/w112/img_sd_<idol id>_face-00.webp`. Runs at 11:50 and 20:50 Japan time (02:50 and 11:50 UTC). An image a release names may be missing for a while, and the address tells a browser to remember a miss for four hours. This app's own sprite sheets stay where they are (`gkms-memomemo/sheet112/` in the shared bucket `tia-assets`, served by this Worker's `/img/*`).

## Plan of Work

Milestone 1 (the pool from the library, behind the seam). Add `valibot` at `^1` to `package.json` with `bun add valibot`. Copy the library's three format files verbatim from `https://gkms-library.tia.run/formats/` into `src/data/formats/` (`skill-cards.v1.ts`, `idols.v1.ts`, `latest.v1.ts`) and add `src/data/formats/pinned.test.ts`, which reads each file's bytes and checks its SHA-256 against a constant. If the lint or type check objects to a copied file, the exception goes in `oxlint.config.ts` with its reason and removal condition, never into the file (its bytes are pinned). Write `src/data/pool.ts`: the types `Pool`, `PoolCard`, `HifAbility`, `Idol`, `CustomizationKind`, `CustomizationStep` (today's shapes from `contract.ts`, with `PoolCard.type` `"active" | "mental"`), `inPool(card)` and `pool(skillCards, idols): Pool` (L1, L2), and `PoolError` for an empty pool. A pool card is the library's row without `origin`, field order as today. Fixtures (L4): commit the 2026-11-27 releases as `src/data/fixtures/skill-cards.v1.20261127T1126Z-a09c6f2a.json` and `idols.v1.20261116T1124Z-5122c626.json`, and supportcards' file of the same minute as `supportcards-skillcards.20261127.json`. `src/data/pool.test.ts`: the pool of the fixtures deep-equals supportcards' file (minus `formatVersion`), 361 cards and 115 abilities; and one test per clause of the rule, each built from one fixture row changed. Then move every reader of `SkillCardDataFile` to `Pool` (the list in Context and Orientation), point `src/test-support/skillcards.ts` at the pool of the new fixtures, and delete `contract.ts`, the card file's readers in `load.ts` and their tests. A test whose expectation depended on the 2026-10-31 card set is fixed and the change recorded in Progress. At the end, `bun test`, `bun run type-check`, `bun run lint` and `bun run build` exit 0, and nothing fetches anything new yet: the page still asks `/data/skillcards.json`, which this milestone's `load.ts` reads as today's shape through a temporary adapter, or Milestone 2 follows on the same branch before any push (decided when the first decision is answered; recorded in Progress).

Milestone 2 (fetching). Written once D-fetch is answered. Common to both answers: `src/data/library.ts` holds the library's address and `loadLibrary(get)`, which fetches the pointer, finds `skill-cards` v1 and `idols` v1 in it, fetches both releases, checks each with its format's `parse`, and returns `pool(…)`; it is the one fetch path for the Worker's count rules (`infra/worker/count-data.ts`, which keeps its hour-long cache of rules), for `scripts/icons/check.ts` and `scripts/icons/offered.ts`, and, under answer B, for the page. Under answer A, the Worker's `data.ts` route answers with the two checked releases in one JSON envelope `{ "skillCards": …, "idols": … }`, and the page parses that and cuts the pool. Under answer B, `src/main.tsx` calls `loadLibrary(fetch)` directly, `data.ts` and its route go (from `worker.ts`, `WORKER_FIRST`, `wrangler.toml`'s `run_worker_first`, and the README), and `src/sw/routes.ts` gains two routes for the library's origin, `pointer` (network first, last copy kept) and `release` (cache first), with `worthKeeping` keeping both from a first visit and a kept release dropped once the kept pointer no longer names it. The dev server (`vite.config.ts`) stops borrowing from `../gakumas-supportcards`: under A it answers the envelope from the library's live address, or from a local `gkms-library` output when `LIBRARY_DIR` is set; under B the page fetches the library itself and the dev server serves no data.

Milestone 3 (faces). Written once D-faces is answered. Under A: `IdolPicker.tsx` draws each face as an `<img>` of `https://gkms-library.tia.run/img/w112/img_sd_<id>_face-00.webp` with `crossorigin="anonymous"` (so the service worker gets a readable answer, not an opaque one), sized as today, falling back to the first character on `error`; the service worker keeps faces cache-first under a route of their own; `public/icons/idols96-*.webp`, `src/icons/idols.v1.json`, the sheet parts of `src/app/idols.ts` and `idols.py` (or its `--publish`) go. Under B: `idols.py` reads masters synced from the library (Milestone 4's directory), the sheet is rebuilt with 14 faces and committed, and the daily check's handling of a new idol follows job #104's answer. Either way a new ADR (`docs/adr/0006-…`) records where the data, the masters and the faces come from, superseding 0005 and the "comes from supportcards" part of 0002 (whose game-style icon decision stands), and #103 is closed by this branch's pull request (`Closes #103` beside `Closes #109`).

Milestone 4 (icon pipeline and daily check). Run `bun run sync-masters -- --dest <this repository>/scripts/icons/out/masters` in the gkms-library checkout (the directory is ignored by git through `scripts/icons/out/`), compare its file names and pixels with supportcards' `scripts/images/out/master/` for a few skill card and face masters, and change the `--masters` default of `lift.py`, `build.py` and `idols.py` (if it stays) to `scripts/icons/out/masters`, with a message naming the sync command when the directory is missing. A rebuild of the sheets from the synced masters must produce byte-identical sheets to the committed ones, or the difference is explained in Surprises & Discoveries before anything is uploaded; this milestone uploads nothing. `.github/workflows/icons.yml` moves to a time after the library's 11:50 UTC run (12:15 UTC), its comment and `infra/workflows.test.ts` with it, and `scripts/icons/check.ts`'s `DATA_URL` goes in favour of `loadLibrary`.

Milestone 5 (documents and release). `CLAUDE.md` (Project Overview, Architecture, the ADR index), `infra/worker/README.md`, `scripts/icons/pyproject.toml`'s description and every comment naming supportcards as the data source are updated; `git grep -n "gakumas-supportcards"` afterwards lists only history (plans, ADRs, and the comments crediting code adopted from it, such as `infra/worker/body.ts`). `/codex-review` on the branch's whole diff, every finding fixed or answered here. Push and a pull request into `develop` closing #109 (and #103), on the user's approval (a job). After it merges, the release into `main` (a pull request `develop` → `main`, on the user's approval), `deploy.yml`'s run, and the live checks of Validation and Acceptance.

## Concrete Steps

From the repository root `/Users/ghensk/Developer/gkms-memomemo`:

    bun add valibot@^1
    mkdir -p src/data/formats
    for f in skill-cards idols latest; do curl -sf -o src/data/formats/$f.v1.ts https://gkms-library.tia.run/formats/$f.v1.ts; done
    shasum -a 256 src/data/formats/*.ts      # the constants of pinned.test.ts

The fixtures, fetched the same minute (the release names are those the pointer gave on 2026-11-27; later releases are fine for a re-run, with the test's expected counts read again from supportcards' file of that minute):

    curl -sf https://gkms-library.tia.run/data/latest.v1.json
    curl -sf -o src/data/fixtures/skill-cards.v1.20261127T1126Z-a09c6f2a.json https://gkms-library.tia.run/data/skill-cards/v1/20261127T1126Z-a09c6f2a.json
    curl -sf -o src/data/fixtures/idols.v1.20261116T1124Z-5122c626.json https://gkms-library.tia.run/data/idols/v1/20261116T1124Z-5122c626.json
    curl -sf -o src/data/fixtures/supportcards-skillcards.20261127.json https://gakumas-supportcards.tia.run/data/skillcards.v1.json

The checks after each milestone, each judged by its exit status:

    bun test && bun run type-check && bun run lint && bun run build

Masters (Milestone 4), in the gkms-library checkout, which needs the user's Cloudflare login:

    cd ../gkms-library && bun run sync-masters -- --dest ../gkms-memomemo/scripts/icons/out/masters

## Validation and Acceptance

Milestone 1: `bun test src/data/pool.test.ts` passes, with the equality test seen to fail when a clause of `inPool` is removed (each clause's own test likewise); `pinned.test.ts` fails when a byte of a copied format is changed.

Milestone 2, under either answer: `bun run dev`, open the printed address, and see the page with its three tabs and the card picker offering the same cards as the live site. Under B, the network panel shows the pointer and two releases fetched from `gkms-library.tia.run` and no request to `/data/skillcards.json`; on `vite preview`, after one visit, stopping the server and reloading draws the page with its cards from the service worker's cache. The Worker's tests show `POST /count` refusing an event naming a card outside the pool and accepting one inside it, with the rules built from the library fixture.

Milestone 3: under A, 「カードの絵柄」 unfolds to 14 faces, 氷渡香名江's drawn from the library's address; offline on `vite preview` after one visit with the picker opened, the faces still draw. Under B, the sheet has 14 cells.

Milestone 4: a rebuild from synced masters reproduces the committed sheets byte for byte, or the difference is explained; `bun test infra/workflows.test.ts` passes with the new schedule.

Release: on `https://gkms-memomemo.tia.run`, the page loads, its card counts match the pool (361 cards at two levels as today, with the picker's own N rule on top), 「カードの絵柄」 shows 14 faces, the network panel shows no request to `gakumas-supportcards.tia.run`, and `curl -s -X POST` of a valid count event per `infra/worker/README.md` § Verify answers as before.

## Idempotence and Recovery

Every step above can be rerun: the downloads overwrite the same files, the format copies are checked by hash, and `sync-masters` writes into an ignored directory. Nothing is uploaded to any bucket in this plan. If the release misbehaves, the previous deploy is restored by reverting the release's merge on a branch and merging that into `main` through a pull request (the protected branches change only by merges); the library and supportcards both keep publishing, so the old code still has its source until supportcards' old paths are removed (the library's L6, step 5, which waits for this release).

## Artifacts and Notes

The prototype's output, 2026-11-27 13:15Z:

    lib pool 361 abil 115 | old cards 361 abil 115 idols old 14 lib 14
    in lib not old []
    in old not lib []
    field diffs 0
    order equal True
    abil equal True []
    idols True []

## Interfaces and Dependencies

Valibot `^1` (runtime dependency, used only through the copied format files). In `src/data/pool.ts`:

    export interface Pool { idols: readonly Idol[]; cards: readonly PoolCard[]; hifAbilities: readonly HifAbility[] }
    export function inPool(card: SkillCard): boolean            // SkillCard from formats/skill-cards.v1.ts
    export function pool(skillCards: SkillCardsFile, idols: IdolsFile): Pool   // throws PoolError on an empty pool

In `src/data/library.ts` (Milestone 2):

    export const LIBRARY = "https://gkms-library.tia.run";
    export async function loadLibrary(get: (url: string) => Promise<Response>): Promise<Pool>

Rejects with an error naming the URL and the HTTP status, or the place of the first bad value (the format's own message).
