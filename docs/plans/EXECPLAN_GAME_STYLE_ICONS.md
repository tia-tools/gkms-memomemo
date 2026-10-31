# Draw skill cards as the game draws them, from the player's screenshots

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. It is maintained in accordance with `docs/PLANS.md` at the repository root.

## Purpose / Big Picture

「学マス　メモリーメモ帳」 (`gkms-memomemo.tia.run`, this repository) draws every skill card as its bare illustration today. In the game a card's icon is much more: a frame coloured by rarity and shaped by type, the parameter value in the top-left corner, the 元気 (stamina-shield) value in the top-right, the cost at the bottom-right, small effect badges along the left edge, a red ＋ for an upgraded card, and an A or M at the bottom for アクティブ or メンタル. Players recognise cards by that whole picture, not by the art alone, and the base card and its ＋ look different only through it.

After this plan, every card the page offers is drawn the way the game draws it: in the rows, in the card picker, in the 早見表 (the quick-reference table), and as the H.I.F. ability's icon, which uses its base card's picture. The art under the frame still follows the page's 「カードの絵柄」 setting, the P-idol whose version of the illustration the player chose, because the frame and values are painted onto each idol's art. A card the page has no game-style icon for yet (a card the game added after the last screenshots) is drawn as an empty frame of its rarity and type with its name inside, and the user hears about it: a daily check opens an issue on this repository and posts to their Discord.

To see it working: run the page (`bun run dev`), open the センス tab, add a row with 立ち位置チェック+ and see a gold hexagonal frame with 40, 15, the red ＋ and -3 around 花海咲季's art; switch 「カードの絵柄」 to 篠澤広 and see the same frame around her art; compare with the game's P図鑑 (the in-game card encyclopedia), which draws it the same way.

The work is issue #10 on the project's board (`tia-tools` project 7, see `CLAUDE.md` § Tasks). The decision to build the icons here is `docs/adr/0002-game-style-icons-are-built-here-from-screenshots-on-supportcards-art.md`.

## Progress

- [x] (2026-10-31 18:55Z) #10 claimed on `feat/game-style-icons`; the user settled the open design points (composite sheets, `tia-assets` under this app's prefix, Python, a blank-frame placeholder, stale icons kept until retaken, new cards reported by issue and nudge); ADR 0002 written, superseding ADR 0001; this plan drafted.
- [x] (2026-10-31 19:24Z) Milestone 1: identify every screenshot's card and lift the game's overlay off its art (`45f8059`). `uv run lift.py` identifies all 349 screenshots as the 349 offered cells, with no problem and none missing; the best other card scores at least 2.35 times worse than the match; each overlay painted back on its own art is 2.17 levels from the screenshot on average (worst card 6.52). The contact sheets in `scripts/icons/out/check/` show the frames, values, badges, ＋ and A/M laid cleanly on other idols' art. The measurements behind it (the box, the art's placement, the veil per card, the window shapes, the badge slots, the outline at the edge) are in Surprises & Discoveries and I13–I16. `uv run pytest` (31 tests) and `bun test` (233), `bun run type-check`, `bun run lint` and `bun run build` exit 0; every rule of the new modules was seen to turn a test red when broken (17 mutations, two of which first survived and got a sharper test). `check.yml` runs the pytest suite in a job of its own.
- [x] (2026-10-31 21:01Z) Milestone 2: paint the overlays onto every idol's art; build the sprite sheets, the placeholder frames, the index and the stamps locally (`035900a`, `4fea8a4`). `uv run build.py` writes 39 sheets (sense and logic 131 cells, anomaly 125), 13.8 MB in all, 345–361 KB each at WebP quality 75, the index, `cells.json` and `frames112.webp`; `bun stamp.ts` stamped the 349 cells against `ProduceCard.yaml` at `fc6afb8b5ba4` (2026-10-28, before the screenshots were taken), and a second run restamps none. Building it turned up two faults in Milestone 1's lift, both fixed and re-lifted: the hexagon's lower edges were off by up to 6 px (the windows are now measured on the high-resolution frames, I19), and the A badge's pale backing vanished on white art (what every card of a type shows alike is kept opaque, I18). Painted back on its own art each overlay is now 2.09 levels from the screenshot on average (worst 6.53). `uv run pytest` (42), `bun test` (241), `bun run type-check`, `bun run lint` and `bun run build` exit 0; every new rule turned a test red when broken (17 Python and 7 TypeScript mutations; two that first survived got sharper tests).
- [ ] Milestone 3: the page draws this app's sheets (a cell per level, the H.I.F. icon from the base cell, the placeholder); the Worker and the dev server serve them.
- [ ] Milestone 4: upload the sheets to `tia-assets` and commit the index.
- [ ] Milestone 5: the daily check for new and changed cards, with an issue and a Discord message.

## Surprises & Discoveries

- Observation: the approach works on one card. In the trial on 立ち位置チェック+ (before this plan, recorded in issue #10), the icon is a 146 × 146 square at (27, 132) in the 720 × 1280 screenshot, border included; the art is the whole square master drawn as a 137.75 px square at (3.75, 4.25) inside it; the game lays a faint veil over the art (screenshot ≈ 0.84 × art + 30 per channel); the art matched 篠澤広's variant; and the overlay lifted off it, laid back on the same art, differs from the screenshot by 2.8 levels (of 255) on average. Laid on 花海咲季's, 藤田ことね's and 葛城リーリヤ's art it reads as the game's icon, except for a one-pixel tint of the original idol's art along the frame's window.
  Evidence: the trial's scratch scripts (`align.py`, `refine.py`, `extract.py`; not kept in the repository), whose fit was `{"box": [27, 132, 173, 278], "size": 137.75, "x0": 3.75, "y0": 4.25, "idol": "shro"}`.

- Observation: the screenshots cover exactly the cards the page offers. The input set has 349 screenshots: base 1 N, 51 R, 78 SR and 45 SSR; enhanced 51 R, 78 SR and 45 SSR. The page offers 175 cards at level 0 and 174 at level 1 (the data file's 181 and 180, less the six N cards of D54 at both levels; 表現の基本 has no ＋), which is the same 349.
  Evidence: `ls temp/skill_cards/*/* | wc -l` per folder, and the fixture `src/data/fixtures/skillcards.v1.json` counted by rarity, type and level on 2026-11-01: N 7 + 6, R 51 + 51, SR 78 + 78, SSR 45 + 45.

- Observation: no two card ids share an art asset in the data file, so a card is identified by its art alone, and its level by the folder.
  Evidence: the fixture's 361 entries name 181 distinct `art.asset` values, one per card id.

- Observation: today's sprite sheets from gakumas-supportcards hold 68 cells each at about 120 KB (39 sheets, 4.6 MB). The game-style sheets hold a cell per level, about twice as many, so about 300 KB each and 12 MB in all is the estimate to check in Milestone 2.
  Evidence: the supportcards worktree's local `scripts/images/out/sheet112/`: `sense-hski-60cb780d.webp` 68 cells, 121,830 bytes.

- Observation: the game table this plan's fingerprints read, `ProduceCard.yaml`, is 40 MB, and Bun 1.4.3 parses YAML itself (`Bun.YAML.parse`), as `infra/workflows.test.ts` already does.
  Evidence: `curl -sS -o ProduceCard.yaml https://raw.githubusercontent.com/vertesan/gakumasu-diff/main/ProduceCard.yaml`, 40,845,533 bytes, 2026-11-01.

- Observation: the icon is at exactly the same pixels in every screenshot, and the trial's placement of the art was close but not exact. The dark border's bounding box is (27, 132)–(173, 278) in all 349; sub-pixel fits of the art on the 24 base screenshots with the most varied art put it at a 138.25 px square at (3.75, 3.875), with an interquartile spread under a pixel (the trial's single card gave 137.75 at (3.75, 4.25)).
  Evidence: the scratch measurement `median size, x0, y0: [138.25, 3.75, 3.875] spread (IQR): [0.8125, 0.25, 0.3125]`.

- Observation: the veil is a property of each card's art, not one constant: a whitening toward about 249 of 0 to 27 %, identical in the base and ＋ screenshots of every card. A per-channel fit overfits art with little colour variety (it turned blue sleeves purple), so the veil is one gain and one offset shared by the three channels, fitted robustly per card; with it the art inside the window matches the screenshot to a median of 1.6 levels.
  Evidence: per-card gain from 0.727 to 0.999 over the 349 cells (`out/lifted.json`), base and ＋ equal to three decimals for all 174 pairs; the global fit over all cards gave gain 0.99 and offset 2, which fits none of the whitened ones.

- Observation: the masters are opaque inside, so the light backdrops with the school's watermark are part of each idol's art, not a layer the game adds; and 3 of the 2,226 skill card masters are 512 px rather than 256 (placing scales by the master's own width).
  Evidence: no master has more than 0.12 % transparent pixels inside a centred disc of 39 % of its width; sizes `Counter({(256, 256): 2223, (512, 512): 3})`.

- Observation: identification needs the veil fitted per candidate, and a trimmed score. Scored by the median difference with a fixed veil, cards sharing the pink backdrop matched the wrong card (one SR card took the screenshots of two). Fitting a gain and an offset per channel for each candidate on the probe disc and averaging the closest 80 % of its pixels identifies all 349 with a margin of 2.35 or more; the runner-up is always another card, never another idol of the same.
  Evidence: the first prototype's `duplicates [('img_general_skillcard_act-2_042', 'base'), …]`; the second's `min ratio 2.26` (2.35 with the refined placement).

- Observation: the windows are a pointy-topped hexagon wider than a regular one, whose lower point lies under the frame, and a circle. Fitted to where the art shows in the 87 and 88 base screenshots of each type: hexagon corners (72.12, 4.08), (132.62, 32.47), (132.62, 106.36), (72.12, 144.52) and their mirror images, rms 0.28 px over the edge points kept; circle centre (72.05, 73.01), radius 64.41, worst point 0.84 px. A white outline about 1.5 px wide runs just outside both.
  Evidence: the colourfulness profiles across each edge reach their minimum (the white outline) 0.5 to 1.5 px outside the fitted shapes.

- Observation: the fitted shapes are right only to a pixel or two along some edges, and that is enough to leak the original idol's art. Painted with the shape's coverage as alpha, スタートダッシュ showed a band of 花海咲季's pink backdrop along the lower-left edge on every other idol's art, where the real window reaches up to 2 px past the fitted edge. Within 2.5 px of the edge, alpha is therefore measured per pixel as the share of the outline's colour in a mix of outline and art (I14).
  Evidence: the zoomed check of `p_card-01-act-2_002:0` before and after; on a synthetic icon with the window 1.5 px wider than fitted, `test_the_overlay_carries_frame_outline_and_badge_to_other_art_without_the_first_art` fails when the edge takes the shape's coverage and the screenshot's colour.

- Observation: overlay inside the window is only ever drawn at a few places, the badge slots: the left column of effect badges, the top-left value, the top-right 元気 shield, the ＋, the cost and the A or M. Counted over all screenshots, the pixels inside the windows with opaque overlay fall steeply up to a share of 3 % of the screenshots (resampling noise in the art) and then stay near 3,600 up to 6 % (the slots). With a threshold of three screenshots instead, art noise covered most of the window and carried the original art onto other idols.
  Evidence: `share >= 0.01: 6552`, `0.02: 4102`, `0.03: 3728`, `0.04: 3654`, `0.06: 3557` of 12,265 inner pixels.

- Observation: the A or M badge's pale backing vanished on white art, and with it part of the letter: its colour is within a few levels of the art, so nothing told it from the art. Every card of a type draws it alike, so the pixels near or inside the window whose screenshots agree across all cards of the type (median absolute deviation of 2 or less) are that badge, the white outline and part of the cost badge's backing; they are kept opaque wherever a card shows that colour (I18). This replaces the artefact first recorded here, which was this.
  Evidence: about 1,200 such pixels per type (`active 87 MAD<= 2 1203`, `mental 88 MAD<= 2 1183`); the zoomed A of 軽い足取り before and after.


- Observation: the screenshots' fit of the hexagon was wrong at its lower edges, where badges hide most of the edge: the real lower corners are near y 112.6, not 106.4, and the lower point near 140.5, not 144.5. The placeholder frames showed it first, as a strip of art along both lower edges; the lift had hidden it in its 2.5 px edge zone except near the corners. The ten icons of `temp/image.png` are 2.4 times the screenshots' size and carry no badges, and their white outline is sharp: fitted on its outer edge, the hexagon is symmetric top to bottom (rms 0.32 px over 2,552 points), and moved in by the outline's width (1.75 px) it meets the screenshots' fit on the top edges and the sides to 0.1 px. The circle moved by about 0.35 px the same way.
  Evidence: the outline's outer edge minus the old fit, by angle on R-active: `30:+4.7 45:+4.9 … 135:+4.9 150:+4.8` below against `+1.5`–`+2.5` above.

- Observation: the sheets are 345–361 KB each at WebP quality 75 (13.8 MB for 39), against 514–542 KB at 88, with no difference visible at the 40–56 px the page draws. A cell costs about 2.7 KB against 1.8 KB in supportcards' plain-art sheets.
  Evidence: `39 sheets, 13.8 MB, 345–361 KB each (quality 75)`; `39 sheets, 20.7 MB, 514–542 KB each (quality 88)`; the two side by side at twice the cell size in `out/check/`.
## Decision Log

The decisions are numbered I1, I2, … so they cannot be confused with the D numbers of `docs/plans/EXECPLAN_MEMORY_MEMO.md`, which this plan cites.

- Decision: I1 — the icon pipeline lives in this repository, not in gakumas-supportcards. It reads supportcards' art masters but nothing of it is run or changed there.
  Rationale: the user's decision in issue #10. The screenshots are taken by hand and kept on the user's machine, so the pipeline runs there and has no place in supportcards' daily job. Recorded in ADR 0002.
  Date/Author: 2026-11-01, user.

- Decision: I2 — the pipeline paints each card's lifted overlay onto every idol's art and builds sprite sheets per plan and idol, holding a cell per card and level (base and ＋). The H.I.F. ability's icon is its card's base cell. The page draws one background per icon, as it does now, and no longer reads supportcards' sheets.
  Rationale: the user's choice over laying one idol-independent overlay sheet over supportcards' sheets with CSS. Painting at build time resamples the 256 px master once, straight into the frame's window, so the window's edge is exact; layering would place the art under the frame at fractional pixels in the browser and could leave a seam, and would tie the page to another repository's sheet layout. The cost is bigger sheets (I3).
  Date/Author: 2026-11-01, user.

- Decision: I3 — the sheets are stored in the shared R2 bucket `tia-assets` under this app's own prefix, `gkms-memomemo/sheet112/<plan>-<idol id>-<first 8 hex digits of the sheet's SHA-256>.webp`, uploaded from the user's machine with their wrangler login; the upload refuses any key outside `gkms-memomemo/`. This app's Worker serves those names, immutable. The index naming the cells is not uploaded: it is committed as `src/icons/index.v1.json` and bundled into the page.
  Rationale: the user chose the bucket over committing the sheets, which would add about 12 MB of binaries to git history per full build and several MB per new card. Committing the index (the agent's choice) ships it with the page that reads it, so the page and the index cannot disagree about the format, the daily check reads it from the checkout without the site being deployed, and the order "upload the sheets, then commit the index" guarantees that the index never names a sheet the bucket lacks.
  Date/Author: 2026-11-01, user (bucket); agent (committed index).

- Decision: I4 — the pipeline is Python under `scripts/icons/`, managed with `uv`, using Pillow and numpy, with pytest; the tests run in `check.yml`.
  Rationale: the user's choice. numpy suits the per-pixel arithmetic of lifting and painting, the trial was written this way, and gakumas-supportcards' `scripts/images/` uses the same tools.
  Date/Author: 2026-11-01, user.

- Decision: I5 — a card with no game-style icon is drawn as the empty frame of its rarity and type with the card's name inside. The eight frames (N, R, SR, SSR, each アクティブ and メンタル) are cut once from the user's `temp/image.png`, their windows blanked, and committed as one small static file, `public/icons/frames112.webp`. A card whose id is not in the data file at all (D31 of the memo plan) keeps today's grey box with its name.
  Rationale: the user's choice of look. A static file is served free by the Worker's assets binding (a request that does not run the Worker costs nothing on the Free plan), and at about eight cells it is small enough to commit.
  Date/Author: 2026-11-01, user (the look); agent (the file).

- Decision: I6 — when a game update changes a card the page has an icon for, the old icon stays until the user retakes its screenshot and rebuilds; the daily check reports it.
  Rationale: the user's choice. Replacing it by the placeholder at once would need an R2 write token stored in this repository's CI.
  Date/Author: 2026-11-01, user.

- Decision: I7 — a daily workflow lists the offered cards that have no cell in the committed index (new cards) and those whose fingerprint changed (stale), keeps one open issue on this repository listing them, and posts to the user's Discord through nudge (`Taka499/nudge`'s `notify` action, which `tia-tools/gakumas-supportcards` already uses) whenever that list changes.
  Rationale: the user's ask: "When there's a new card detected, an issue need to be created and sent to my discord via nudge." Posting only on a change keeps a card that waits for a screenshot from pinging every day.
  Date/Author: 2026-11-01, user (the ask); agent (one issue, notify on change).

- Decision: I8 — which cards exist and which the page offers comes from the page's own TypeScript (`src/data/load.ts` and `offered` in `src/app/catalog.ts`), exported to the Python pipeline as JSON by `scripts/icons/offered.ts`. Python never re-implements the pool rules (D8, D54 of the memo plan).
  Rationale: one rule in one place; a second copy in Python would drift the first time the rule changes.
  Date/Author: 2026-11-01, agent.

- Decision: I9 — a cell's fingerprint is the first 8 hex digits of the SHA-256 of the card's `ProduceCard.yaml` row at its level, as JSON with sorted keys, without the fields listed in `scripts/icons/fingerprint.ts` as not drawn on the icon. It is stamped into `scripts/icons/stamps.json` when the cell's screenshot is new or changed, and kept as it was when the same screenshot is built again, so rebuilding old screenshots after a game update cannot mark them fresh. Fingerprints are computed only in TypeScript.
  Rationale: the data file does not carry what the icon shows (cost, values, effects), so the check needs the game table; hashing the whole row errs towards a false "stale" (a retake that changes nothing) rather than a missed change. One implementation keeps the stamp and the check from disagreeing.
  Date/Author: 2026-11-01, agent.

- Decision: I10 — the pipeline reads supportcards' lossless masters from a local directory, `--masters`, by default `../gakumas-supportcards/scripts/images/out/master` (or `$SUPPORTCARDS_DIR/scripts/images/out/master`, the convention `vite.config.ts` already uses). Where it is missing, supportcards' `uv run extract.py --only skillcard` fills it from the game.
  Rationale: masters are private in the bucket (`master/`, never served), so reading them remotely would mean about 2,000 `wrangler r2 object get` calls; the extracted library already exists on the machine that has the screenshots.
  Date/Author: 2026-11-01, agent.

- Decision: I11 — this app's Worker stops serving supportcards' `sheet112/` sheets and index once the page draws this app's sheets (Milestone 3).
  Rationale: the page no longer reads them (I2), and every path the Worker serves is one more to keep correct.
  Date/Author: 2026-11-01, agent.

- Decision: I12 — the screenshots stay out of git: `/temp/` is ignored, and the pipeline takes the input directory as an argument, by default `temp/skill_cards`, laid out `<base|enhanced>/<N|R|SR|SSR>/*.png`.
  Rationale: issue #10 ("Inputs, kept out of git"); the folder is 220 MB, and ignoring it means a careless `git add` cannot commit it.
  Date/Author: 2026-11-01, agent.

- Decision: I13 — the veil is fitted per card as one gain and one offset shared by the three channels, on the probe disc, ignoring its worst 30 % of pixels, and applied to every idol's art of that card when painting.
  Rationale: it is a property of the card's art (Surprises & Discoveries), and a fit per channel overfits art with little colour variety. That the same veil holds for every idol of a card is an assumption: only one idol's art per card was captured.
  Date/Author: 2026-11-01, agent.

- Decision: I14 — within 2.5 px of the fitted window edge, a pixel that is a mix of the outline's colour and the art under it gets the outline's colour, with alpha its share in the mix; where the art is too close to the outline's colour for the share to be measured, the shape's coverage decides; a pixel there that is no such mix is the frame (outside the shape) or a badge crossing the edge (inside), as opaque as it is far from the art.
  Rationale: the shapes are right only to a pixel or two, and a colour or alpha taken from the shape leaks the original art (Surprises & Discoveries). This is the "exact mask" issue #10 asked for, measured from the pixels rather than drawn from the shape.
  Date/Author: 2026-11-01, agent.

- Decision: I15 — inside the window, overlay is lifted only in the badge slots, the pixels where at least 3 % of all screenshots have opaque overlay, grown by 2 px; anywhere else inside the window the art shows.
  Rationale: the knee of the count (Surprises & Discoveries). A new card with a badge at a place no other card uses would lose it; the game's badges sit in a fixed column and corners, so none does today.
  Date/Author: 2026-11-01, agent.

- Decision: I16 — the pipeline's modules are `geometry.py` (the measured constants and the window shapes), `shots.py`, `art.py`, `identify.py`, `overlay.py` (lifting and painting), `cells.py` (what the identified screenshots mean and what is wrong with them) and the command `lift.py`; Milestone 2's command is `build.py`. Plan of Work's `lift.py` holding the overlay rules became `overlay.py`, so the command and the rules are apart.
  Rationale: pure rules in their own modules with their tests, I/O in the commands (`CLAUDE.md` § Code Style).
  Date/Author: 2026-11-01, agent.

- Decision: I17 — the sheets are lossy WebP at quality 75 with lossless alpha (the cells' rounded corners are transparent, so the page shows through them), 10 cells to a row, and the placeholder frames at quality 95.
  Rationale: a third smaller than quality 88 with no visible difference at the page's sizes; the frames are one small file.
  Date/Author: 2026-11-01, agent.

- Decision: I18 — what every card of a type shows alike (the pixels within the window's edge zone whose screenshots' median absolute deviation is 2 or less, from at least 20 screenshots) is opaque overlay wherever a card's screenshot shows that colour, and is left to the other rules where it does not.
  Rationale: the A and M badges' pale backing cannot be told from white art otherwise; the condition on the card's own colour keeps a card that shows its art there (or its own badge) from having it overwritten, since the median allows up to half the cards to differ.
  Date/Author: 2026-11-01, agent.

- Decision: I19 — the window shapes are measured on the outline of the eight frames in `temp/image.png`, not on the screenshots, and the placeholder frames are blanked up to 1.5 px past the window.
  Rationale: the frames are larger and badge-free, so the whole outline is visible; the screenshots hide the hexagon's lower edges under badges (Surprises & Discoveries).
  Date/Author: 2026-11-01, agent.

## Outcomes & Retrospective

Nothing yet; the plan has not started.

## Context and Orientation

The repository `~/Developer/gkms-memomemo` (GitHub `tia-tools/gkms-memomemo`) is a Preact page built by Vite with Bun, plus a Cloudflare Worker. Its main plan is `docs/plans/EXECPLAN_MEMORY_MEMO.md`; this plan changes only how skill card icons are made and drawn. What a reader needs from that plan is summarised here.

Terms, in plain language:

A skill card is a card played in the game's lessons and contests. It has a rarity (N, R, SR, SSR), a type (アクティブ, drawn in a hexagonal window, or メンタル, drawn in a round window), a plan (センス, ロジック, アノマリー, or free, meaning usable in any plan), and two levels the page cares about: the base card (level 0) and the upgraded ＋ card (level 1). In the data a card is one id at several levels (`p_card-01-act-1_001` at `upgrade` 0 and 1). For the SR and SSR cards and a few R cards the game draws a different illustration per P-idol (a playable idol; there are 13); the others have one illustration. A card's art asset is named in the data file as `art.asset` (`img_general_skillcard_act-1_001`), with `art.perIdol` saying whether there is one per idol, in which case each is `<asset>-<idol id>` (`img_general_skillcard_act-2_059-hski`).

The data file is gakumas-supportcards' `https://gakumas-supportcards.tia.run/data/skillcards.v1.json`. This app's Worker passes it through at `/data/skillcards.json`, and a copy is committed as `src/data/fixtures/skillcards.v1.json` for tests. Its types are `src/data/contract.ts` and its reader is `src/data/load.ts` (`parseSkillCardData`). It lists the playable idols in the game's order (`idols`, the first being 花海咲季, `hski`, the default of 「カードの絵柄」) and the card pool (`cards`), and `offered(card)` in `src/app/catalog.ts` says which of them the page offers: every card except the N cards other than 表現の基本 (`p_card-00-men-0_003`), the memo plan's D54.

A master is gakumas-supportcards' lossless copy of a card's art as the game stores it: a 256 × 256 WebP with transparent rounded corners, named like the asset (`img_general_skillcard_act-2_059-hski.webp`). supportcards' image pipeline (`scripts/images/` there) extracts them from the game's servers into a local `scripts/images/out/master/` and uploads them to the private `master/` prefix of the R2 bucket `tia-assets` (Cloudflare's object storage, shared by every `tia.run` app). On this machine the extracted library is in the supportcards worktree `~/.mulmoterminal/worktrees/gakumas-supportcards-26d5484a/65-publish-skillcards-v1-json-the-skill-car/scripts/images/out/master` (2,226 skill card masters on 2026-11-01); the main supportcards checkout has none.

The P図鑑 is the game's card encyclopedia. Selecting a card there draws its icon large, always at the same place on screen. The user took one screenshot per offered card and level, 720 × 1280 pixels, in `temp/skill_cards/<base|enhanced>/<N|R|SR|SSR>/gakumas_<date>_<time>.png` (349 files; not in git). `temp/image.png` (2560 × 1440) shows ten icons from another game screen with no values on them, one per rarity and type (N, R, SR, SSR and Legend, each hexagonal and round); this plan cuts the placeholder frames from it.

The overlay is everything the game draws over the art: the frame around the window, the values, the badges, the ＋ and the A or M. The window is the hexagon or circle through which the art shows. The veil is a faint whitening the game lays over the art inside the window (screenshot ≈ 0.84 × art + 30 per channel in the trial). Lifting the overlay means recovering, for each pixel of the 146 × 146 icon, the overlay's colour and its opacity (alpha), knowing the art that was under it. Painting means the reverse with another idol's art: place the master under the frame, apply the veil, and lay the overlay on top.

A sprite sheet is one image holding many icons in a grid of equal cells, so the page loads one file instead of one per icon; on the Workers Free plan every request that runs the Worker counts toward the account's 100,000 a day, which every `tia.run` app shares (the memo plan's D42). The page draws an icon as a CSS background showing one cell of a sheet (`spriteStyle` in `src/app/sheets.ts`). Today the sheets are supportcards' (`sheet112/<plan>-<idol>-<hash>.webp`, one per plan and idol, a cell per card id, plain art), listed by an index the page fetches at `/img/sheet112/index.v1.json`. After this plan they are this app's own, with a cell per card and level, game-style.

The Worker is `infra/worker/`: `worker.ts` routes, `img.ts` serves images from the bucket binding `IMAGES` (only names matching its pattern; everything else is a 404), `data.ts` passes the data file through, `wrangler.toml` configures it, and `infra/worker/README.md` documents routes and deployment. `vite.config.ts` makes the dev server answer the Worker's routes from local files. The site is not deployed yet (the memo plan's Milestone 7).

nudge (`~/Developer/nudge`, GitHub `Taka499/nudge`) is the user's small service that lets a GitHub Actions job post to the user's private Discord channel with no secret in the repository: a job with `id-token: write` runs `Taka499/nudge/actions/notify@<commit>` with `endpoint: https://nudge.tia.run`, a `title`, a `body` and a `url`. The instance serves repositories by owner, and `tia-tools` is served (gakumas-supportcards' `update-data.yml` uses it, pinned at `d9f7f1ac185050506d526532a0e24861564422cf # v1.1.0`; nudge's README shows `792cf13fdc57244eba070e459ef8285e27aeb2fc # v1.2.0`).

The game tables are YAML dumps of the game's master data at `https://raw.githubusercontent.com/vertesan/gakumasu-diff/main/<Table>.yaml`. `ProduceCard.yaml` has one row per card and level (`id`, `upgradeCount`, `rarity`, `category`, `stamina`, `costType`, `costValue`, `playEffects`, `produceDescriptions`, …), from which everything drawn on the icon follows.

## Plan of Work

Milestone 1 builds the first half of the pipeline and proves it on all 349 screenshots: which card each one shows, and the overlay lifted off it. Create `scripts/icons/` as a uv project (`pyproject.toml` with `pillow` and `numpy`, `pytest` in a dev group, `package = false`, Python 3.12, and `uv.lock`), and `scripts/icons/offered.ts`, which reads a data file (by default the fixture) through `parseSkillCardData` and prints, as JSON, every card `offered` accepts with its id, level, name, plan, rarity, type and art. The Python modules keep rules pure and I/O in the command. `geometry.py` holds the constants the trial measured (the icon box, the art's placement, the veil) and the exact window shapes: a coverage mask, per pixel of the 146 × 146 box, of how much of the pixel lies inside the hexagon or the circle, whose centre and size are fitted in this milestone from the screenshots and written down as constants. `shots.py` lists the input folder into shots (path, level from `base` or `enhanced`, rarity from the folder, and the first 8 hex digits of the file's SHA-256) and crops the icon box. `art.py` loads a master, composites it on white, and places it in the box at the art's placement. `identify.py` scores a shot against a placed art with a residual that ignores the overlay (the median of the per-pixel difference inside the window after the veil, so badges count as outliers), takes as candidates every offered card of the folder's rarity in every variant the masters hold, and returns the best card and idol with the margin over the best other card; a shot whose margin is under a threshold is reported, not guessed. `lift.py` computes the overlay: outside the window the alpha is 1 minus the window's coverage; inside it, where the screenshot differs from the veiled art by more than a threshold, the overlay is opaque, ramping between two thresholds; the colour of a partly opaque pixel is solved from the screenshot by taking the known veiled art out of it (colour = (screenshot − (1 − alpha) × veiled art) / alpha), which removes the original idol's tint at the window's edge and around badges. The veil itself is not part of the overlay: painting applies it to the new art. The command `uv run lift.py` runs all of it, writes `out/lifted/<card id>_<level>.png` (the overlay, RGBA) and `out/identified.json` (each shot's card, level, idol, residual, margin and recomposition error), and a contact sheet `out/check/` showing for each card the screenshot, the overlay and the overlay painted back on the same art; it exits 1 when a shot cannot be identified, when two shots give the same card and level, or when an offered card and level has no shot. The tests (`test_*.py`) build synthetic icons from synthetic art and a known overlay and check that identification picks the right art, that lifting recovers the overlay where the art is known, that the window masks have the right area, and that the folder layout is read. `check.yml` gains a job that sets up uv and runs `uv run --frozen pytest` in `scripts/icons`, and `infra/workflows.test.ts` pins it. Acceptance: every shot identified with a clear margin, the 349 cells equal to the offered set, a recomposition error near the trial's 2.8, and a look at the contact sheet showing no fringe.

Milestone 2 builds the second half locally. `paint.py` places a master, applies the veil inside the window and lays an overlay on it, then scales the 146 px result to the 112 px cell with a high-quality filter. `frames.py` cuts the eight placeholder frames from `temp/image.png` (their boxes measured there and written down as constants), blanks each window to the veil's colour over white, scales them to 112 px and writes `out/frames112.webp`, one row of eight cells in the order N-active, N-mental, R-active, R-mental, SR-active, SR-mental, SSR-active, SSR-mental. `sheets.py` builds, for each plan and each idol in the data file's order, a sheet of every cell the plan's tab offers (the plan's cards and the free ones, both levels where a shot exists, in the cards' game `order` and then by level) in that idol's art where the card has one per idol and in its single art otherwise, ten columns wide, encoded as lossy WebP at a quality chosen so a sheet stays near 300 KB (record the sizes), named by its hash, and writes `out/gkms-memomemo/sheet112/…` and `out/index.v1.json` (format in Interfaces and Dependencies) and `out/cells.json`, which maps each cell to its shot's hash. `scripts/icons/fingerprint.ts` computes I9's fingerprint from `ProduceCard.yaml`, and `scripts/icons/stamp.ts` merges `out/cells.json` into `scripts/icons/stamps.json`, giving a cell the current fingerprint when its shot is new or changed and keeping the old one otherwise; both have Bun tests. Acceptance: 39 sheets, each with the plan's offered cells, a look at a few cells per rarity and type next to the screenshots, the sizes recorded, and `stamps.json` holding all 349 cells.

Milestone 3 switches the page. `src/icons/index.v1.json` is the committed index (the local build's `out/index.v1.json`, copied by Milestone 4's upload, and by hand in this milestone so the page can be tried against the local build). `src/app/sheets.ts` reads it (a pure reader, run on the committed file by a test, refusing a file name the Worker would not serve) and finds a card's cell by plan, `<card id>:<level>` and idol, falling back to the default idol and then to none, as today. `src/app/Icon.tsx` draws the cell, or the placeholder: the frame of the card's rarity and type from `/icons/frames112.webp` with the card's name over its window in small type. The H.I.F. ability's icon asks for its card at level 0. `App.tsx` stops fetching the sheet index. `infra/worker/img.ts` serves only `gkms-memomemo/sheet112/<plan>-<idol id>-<8 hex>.webp`, immutable (I11), and its tests and `infra/worker/README.md` follow. `vite.config.ts` serves `/img/gkms-memomemo/…` from `scripts/icons/out/` when the local build has the file. Acceptance: `bun test`, `bun run type-check`, `bun run lint` and `bun run build` exit 0, each new rule seen to fail its test when broken; in Chrome on the dev server, at 390 px and on a desktop window, rows, pickers, the 早見表 and the H.I.F. icons show game-style icons, switching 「カードの絵柄」 changes the art under the frames, and a card removed from the local index shows the placeholder. The user then judges the icon size on a phone (40 px in a row today), which the issue flagged as barely legible; a change of size is the user's ruling, recorded here.

Milestone 4 publishes. `scripts/icons/upload.py` uploads each sheet named by `out/index.v1.json` that the committed `src/icons/index.v1.json` does not name (or every sheet with `--all`) with `bunx wrangler r2 object put tia-assets/<key> --file <path> --remote --content-type image/webp --cache-control "public, max-age=31536000, immutable"`, retrying a failed put twice, refusing any key that does not start with `gkms-memomemo/sheet112/`, and only after every sheet is stored copies `out/index.v1.json` to `src/icons/index.v1.json`. Then the index, the stamps and the frames are committed. Acceptance: for one sheet, `bunx wrangler r2 object get tia-assets/<key> --file "$TMPDIR/check.webp" --remote` gives a file whose `md5 -q` equals the local one, and the committed index names only stored sheets. Live checks wait for the site's first deployment (the memo plan's Milestone 7).

Milestone 5 watches for new and changed cards. `scripts/icons/check.ts` reads the live data file, the committed index and stamps, and `ProduceCard.yaml`, and writes a report: the offered cards and levels with no cell, and the cells whose fingerprint differs from their stamp, each with its name and folder (`base/SR` …) so the user knows what to capture; its rules are pure functions with Bun tests. `.github/workflows/icons.yml` runs it daily after supportcards' data update (which runs at 11:30 UTC) and on demand: a job with `contents: read` and `issues: write` runs the check and, through `gh`, keeps one open issue titled "Screenshots needed for game-style icons" whose body is the report with a hidden marker holding a hash of the list; it opens the issue when the list becomes non-empty, edits it when the list changes, and closes it with a comment when the list is empty, and sets the job output `changed`. A second job, with only `id-token: write`, runs nudge's `notify` when `changed` is true, with the issue's URL. `infra/workflows.test.ts` pins its shape. Acceptance: run by hand (`workflow_dispatch`) once with a card removed from a test copy of the index (or with the real list when a card is missing), see the issue opened and the Discord message arrive, run again and see neither repeated, and see the bun tests of the rules fail when a rule is broken.

## Concrete Steps

From the repository root `~/Developer/gkms-memomemo`, once Milestone 1 has created the uv project:

    cd scripts/icons
    uv sync
    mkdir -p out && bun offered.ts > out/offered.json        # the cards the page offers, from the fixture
    uv run lift.py --masters <masters dir>                    # --shots and --cards default to the paths above
    uv run pytest

Expected from `lift.py` on the 349 screenshots of 2026-11-01 (about 80 seconds):

    349 screenshots, 349 offered cells
    1808 candidate arts
    349 cells lifted; smallest margin 2.35; painted back on the same art, mean error 2.17 (worst 6.52)

and exit status 0. A `problem:` line names a screenshot that cannot be trusted and makes it exit 1; a `missing:` line names an offered cell no screenshot shows (a card to capture), which does not.

Where the masters are: by default `../gakumas-supportcards/scripts/images/out/master`; on this machine today the supportcards worktree named in Context and Orientation. To fill a missing library, in a supportcards checkout: `cd scripts/images && ./fetch-vendor.sh && uv sync && uv run extract.py --only skillcard`.

Milestone 2 adds, in `scripts/icons`, after `lift.py`:

    uv run build.py --masters <masters dir>       # --cards and --frames default to out/offered.json and ../../temp/image.png
    bun stamp.ts                                  # fetches ProduceCard.yaml; --tables <path> to use a local copy

Expected (about two minutes):

    sense: 131 cells, 13 sheets
    logic: 131 cells, 13 sheets
    anomaly: 125 cells, 13 sheets
    39 sheets, 13.8 MB, 345–361 KB each (quality 75)
    349 cells stamped, 349 with the current tables

A `fallback:` line from `build.py` names an idol's art a master library lacks, drawn in the default idol's art instead. Milestone 4 adds:
    uv run upload.py --dry-run          # which sheets would go to tia-assets
    uv run upload.py                    # upload them, then copy the index into src/icons/

The page's checks, each judged by its exit status:

    bun test
    bun run type-check
    bun run lint
    bun run build

Exact transcripts are added here as each milestone runs.

## Validation and Acceptance

The plan is complete when, on the dev server and later on `https://gkms-memomemo.tia.run`: every offered card in the センス, ロジック and アノマリー tabs is drawn with its game frame, values and badges, the ＋ card differently from its base card; switching 「カードの絵柄」 changes the art inside every frame of a per-idol card and leaves single-art cards as they are; each H.I.F. ability's icon is its card's base icon; a card missing from the index is drawn as the empty frame of its rarity and type with its name; the Worker answers `/img/gkms-memomemo/sheet112/<a sheet the index names>` with 200 and `image/webp`, and `/img/sheet112/index.v1.json` with 404; the daily workflow, run by hand while a card is missing, opens one issue and posts one Discord message, and run again posts nothing new. `bun test` covers the page's new reader and placeholder and the check's rules, and `uv run pytest` the pipeline's rules, each rule seen to fail its test when broken.

## Idempotence and Recovery

Every pipeline step can be rerun: `lift.py` and `build.py` rewrite `scripts/icons/out/` (ignored by git) from the inputs; a sheet's name is its hash, so rebuilding identical pixels gives the same name, and uploading a name again stores the same bytes. The upload copies the index only after every sheet is stored, so a run that dies halfway leaves the committed index naming only stored sheets; run it again to finish. Sheets the index no longer names stay in the bucket, harmless, since nothing names them. `stamps.json` keeps a cell's fingerprint as long as its screenshot is unchanged, so rebuilding is safe after a game update. The upload never writes outside `gkms-memomemo/`, so supportcards' objects cannot be touched. The daily workflow keeps one issue and only edits it, so rerunning it cannot open duplicates.

## Artifacts and Notes

The trial's fit and output are in Surprises & Discoveries. Evidence from each milestone is added here.

## Interfaces and Dependencies

New dependencies: Python 3.12 managed by `uv`, with `pillow` and `numpy`, and `pytest` for development, all under `scripts/icons/` (I4). The page gains no runtime dependency. CI gains `astral-sh/setup-uv`, pinned by commit hash like every action here. The daily workflow uses `Taka499/nudge/actions/notify`, pinned by commit hash.

`scripts/icons/offered.ts` prints a JSON array of:

    { "id": "p_card-01-act-1_001", "upgrade": 0, "name": "ファンサ", "plan": "sense", "rarity": "R", "type": "active",
      "order": "…", "asset": "img_general_skillcard_act-1_001", "perIdol": false }

and the playable idols as `{ "idols": ["hski", …], "cards": [ … ] }` around it.

`src/icons/index.v1.json`, committed, bundled into the page:

    {
      "formatVersion": 1,
      "cell": 112,
      "columns": 10,
      "plans": [
        { "plan": "sense",
          "cells": ["p_card-01-act-1_001:0", "p_card-01-act-1_001:1", …],
          "sheets": [{ "idol": "hski", "file": "gkms-memomemo/sheet112/sense-hski-1a2b3c4d.webp" }, …] },
        …
      ]
    }

Every sheet of a plan has the same cells, in the order `cells` lists them, row by row, `columns` to a row; a cell is `<card id>:<level>`. A sheet's `file` is its bucket key, served at `/img/<file>`.

`scripts/icons/stamps.json`, committed:

    { "formatVersion": 1, "cells": { "p_card-01-act-1_001:0": { "shot": "1a2b3c4d", "fingerprint": "5e6f7a8b" }, … } }

`public/icons/frames112.webp`, committed: one row of eight 112 × 112 cells, N-active, N-mental, R-active, R-mental, SR-active, SR-mental, SSR-active, SSR-mental.

In `src/app/sheets.ts`, at the end of Milestone 3:

    export interface IconIndex { cell: number; columns: number; plans: readonly PlanSheets[] }
    export function parseIconIndex(json: unknown): IconIndex;           // throws at the first bad value
    export function iconCell(index: IconIndex, plan: PlanId, card: { id: string; upgrade: number },
                             idol: string, defaultIdol: string): IconCell | null;
    export function spriteStyle(cell: IconCell, size: string): Record<string, string>;   // unchanged
    export function frameStyle(rarity: Rarity, type: CardType, size: string): Record<string, string>;

Revision note, 2026-11-01: first draft, written after claiming #10 and the user's answers on the open points of the issue, before any code.

Revision note, 2026-11-01: Milestone 1 done and recorded: Progress, seven observations from measuring the screenshots (placement, a veil per card, opaque masters, how identification must score, the window shapes, the edge leak and the badge slots, and one artefact left), decisions I13–I16, and the commands and their output in Concrete Steps.

Revision note, 2026-11-01: Milestone 2 done and recorded: Progress, three observations (the A badge's backing, the hexagon's lower edges, the sheets' sizes; the first replaces the artefact Milestone 1 left), decisions I17–I19, and the build's commands and output in Concrete Steps.
