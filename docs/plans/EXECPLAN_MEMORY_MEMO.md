# Build 「学マス　メモリーメモ帳」, a memo of the produce memories a player owns for H.I.F.

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. It is maintained in accordance with `docs/PLANS.md` at the repository root.

## Purpose / Big Picture

学園アイドルマスター (学マス) is a smartphone and PC idol-raising game. A player raises an idol in a run called a produce, and at the end can save the result as a memory. Part of every saved memory is a produce memory: a skill card, chosen by the player, that the memory lets them carry into a later produce, together with three small stat bonuses. The game's own memory list makes it hard to search, so a player preparing in the recurring event あさりゼミ (an event built around preparing memories) cannot easily answer "which memories do I already have, and which am I still missing?".

After this plan, a player opens `https://gkms-memomemo.tia.run` on a phone or PC and sees one tab per training plan. Inside each tab, rows list the builds they care about (a skill card with its customization and its H.I.F. ability), and next to each build, which of the three standard stat-bonus patterns they own, with the quality of every bonus shown as the game shows it (diamond or rainbow). Missing patterns stand out as hatched 未所持 blocks, and a folded 早見表 (quick-reference table) at the top of the tab lines up every build's owned and missing patterns. They add rows and memories with in-place pickers, the memo is saved in their own browser, and they can move it to another device with a code. Pickers suggest first what other players pick most in that section, from anonymous counts.

To see it working: open the page, add a row 成就+ in センス → 好調, add a %%F memory with Vo diamond, Da diamond, Vi rainbow, and observe the row showing 3.5% / 3.5% / 20 with diamond, diamond and rainbow textures, the %F% and F%% groups showing 未所持, and the 早見表 showing one ✓ and two dashed squares for that row. Reload the page and observe that it is all still there.

## Progress

- [x] (2026-10-30 21:40Z) Design interview (/grill-me) held with the user; decisions D1–D25 (the user's) and D26–D28 (the agent's defaults) recorded in the Decision Log; ADR 0001 written; repository scaffolded from `Taka499/project-template@b52b8df`.
- [x] (2026-10-31 06:03Z) Plan reviewed against gakumas-supportcards, gkms-hif-final-stats and the upstream tables; the corrections and decisions D29–D32 folded in (see the revision note at the end).
- [ ] Milestone 0: verify in the game data the facts the design rests on (card fields, H.I.F. abilities, customization limits, idol art variants, ability tiers, guide categories) and write the data requirements for gakumas-supportcards.
- [ ] Milestone 1 (in gakumas-supportcards): publish `/data/skillcards.v1.json` and the skill card icons in `tia-assets`.
- [ ] Milestone 2: project skeleton — page, Worker, checks and workflows copied from gkms-hif-final-stats; the Worker proxies the data file and reads the icons.
- [ ] Milestone 3: the memo model as pure TypeScript with tests.
- [ ] Milestone 4: the page — tabs, sections, rows, cells, popovers, pickers, 早見表, sorting, settings.
- [ ] Milestone 5: saving in the browser, the home-screen install, and the 引き継ぎコード.
- [ ] Milestone 6: anonymous counts and ranked pickers.
- [ ] Milestone 7: first deployment to `gkms-memomemo.tia.run` and checks of the live site.

## Surprises & Discoveries

- Observation: a skill card's icon is not one picture. For SR and SSR cards the game draws a different illustration per P-idol, and there is no idol-neutral version; the difference is obvious at icon size.
  Evidence: the user, 2026-10-31; a local gakumas-tools checkout holds plan cards as `145_1.png` … `145_12.png` and free starter cards as a single `13.png`. Those images must not be used (decision D20b); the observation only shows the shape of the problem.

- Observation: the two qualities the page records are two rarities of the game's memory stat abilities. Diamond is the game's UR rarity (3.5% growth or +25 initial), rainbow is SSR (2.8% or +20). The game also has R (1.4% / +10) and SR (2.1% / +15), which the user chose not to record (decision D2).
  Evidence: `ProduceSkill.yaml` in gakumas-supportcards' cache of `vertesan/gakumasu-diff` (fetched 2026-09-20):

      p_memory_skill-common-p_trigger-produce_start-no_description-vocal_growth_rate_addition-03-001  SkillRarity_Ssr  p_effect-vocal_growth_rate_addition-0028_0028
      p_memory_skill-common-p_trigger-produce_start-no_description-vocal_growth_rate_addition-04-001  SkillRarity_Ur   p_effect-vocal_growth_rate_addition-0035_0035
      p_memory_skill-common-p_trigger-produce_start-initial-vocal_addition-03-001                     SkillRarity_Ssr  p_effect-vocal_addition-0020_0020
      p_memory_skill-common-p_trigger-produce_start-initial-vocal_addition-04-001                     SkillRarity_Ur   p_effect-vocal_addition-0025_0025

  The current upstream `MemoryAbility.yaml` (2026-10-31) has 8 entries for each of these ability kinds while the September cache has 4 levels; Milestone 0 must find out what the other four are.

- Observation: the game data has 115 H.I.F.-only memory abilities, which are the 「HIFアビリティ」 of this design.
  Evidence: `MemoryAbility.yaml` upstream, 2026-10-31: ids of the form `memory_ability-p_memory_skill-common-hatsuboshi_idol_festival-p_trigger-start_audition-for_hif_memory-exam_status_enchant-exam_turn_timer-exam_status_enchant-01-NNN-001`, `produceGroupIds: [produce_group-003]`, `isUniqueActivation: true`. The user states each one corresponds to exactly one skill card and is drawn with that card's icon.

- Observation: on iPhone Safari, everything a page stores in the browser (localStorage, IndexedDB, service worker caches) is deleted after seven days of Safari use without a visit to that site. A page added to the home screen is exempt. A memo used around a recurring event could otherwise vanish between events.
  Evidence: WebKit's tracking prevention policy ("7-day cap on all script-writeable storage", since Safari 13.1), as known to the agent; re-check against current WebKit documentation in Milestone 5.

- Observation: gakumas-supportcards' cache holds none of the tables this app needs, and its build does not read the cache. Its generators declare and read a fixed set of tables (`scripts/lib/tables.ts`); `bun run generate` writes committed modules (`data/cards.generated.ts` and others), and `bun run build` writes `dist/data/cards.v1.json` from those modules through a Vite plugin. The tables `ProduceCard`, `ProduceCardCustomize`, `MemoryAbility` and `ProduceGuideProduceCardCategory` exist upstream.
  Evidence: `ls .cache/gakumasu-diff` in supportcards, 2026-10-31: `ProduceEffect ProduceEventSupportCard ProduceItem ProduceItemEffect ProduceSkill ProduceStepEventDetail ProduceTrigger SupportCard SupportCardLevelLimit SupportCardProduceSkillFilter SupportCardProduceSkillLevelAssist SupportCardProduceSkillLevelDance SupportCardProduceSkillLevelVisual SupportCardProduceSkillLevelVocal` (all `.yaml`). Its `vite.config.ts`:

      generateBundle() {
        this.emitFile({ type: "asset", fileName: CARD_DATA_PATH, source: cardDataJson(CARDS, HELD, LEVEL_LIMITS) });

  `curl -I https://raw.githubusercontent.com/vertesan/gakumasu-diff/main/<Table>.yaml` answered 200 for each of the four tables, 2026-10-31.

- Observation: neither sibling's Worker can serve a skill card icon, and supportcards' upload decides what is missing by asking its own deployed site. Both Workers answer only support card thumbnails under `w192/` and P-item icons under `w48/`; every other `/img/` path is a 404. `upload.py` sends `HEAD /img/w192/<file>` and `HEAD /img/w48/<file>` to `https://gakumas-supportcards.tia.run`, so a rendition that site does not serve would look missing on every daily run.
  Evidence: `infra/worker/img.ts` in both supportcards and gkms-hif-final-stats (the latter "gakumas-supportcards' infra/worker/img.ts at d08f3de, unchanged"):

      const IMAGE_PATH = /^\/img\/((?:w192\/img_general_csprt-\d-\d{4}_full|w48\/img_general_pitem_\d-\d{3})\.webp)$/;

  and supportcards' `scripts/images/README.md` § Upload: "'Missing' is asked of the deployed site with a `HEAD /img/w192/<file>` per card and `HEAD /img/w48/<file>` per item icon, so planning needs no credentials."

- Observation: on Cloudflare's Workers Free plan, KV allows 1,000 writes a day, which the per-day cap of D12 would spend at one write per row created. During あさりゼミ a few dozen players each setting up 50 rows would pass it, and from then until 00:00 UTC every further write fails. D1 allows 100,000 rows written and 5 million rows read a day on the same plan, and refuses every query once a daily limit is reached. Workers Paid starts at $5 a month. Which plan the Cloudflare account holding `tia.run` is on was not checked.
  Evidence: Cloudflare documentation, read 2026-10-31. `https://developers.cloudflare.com/kv/platform/limits/`: Free "Writes to different keys: 1,000 writes per day", "Writes to same key: 1 per second". `https://developers.cloudflare.com/workers/platform/pricing/`: "Daily usage limits reset daily at 00:00 UTC. If you exceed any one of these limits, further operations of that type will fail with an error"; Workers Paid "a minimum charge of $5 USD per month". `https://developers.cloudflare.com/d1/platform/pricing/`: Free rows read "5 million / day", rows written "100,000 / day", "When your account hits the daily read and/or write limits, you will not be able to run queries against D1"; "Indexes will add an additional written row when writes include the indexed column".

## Decision Log

All decisions D1–D25 were made by the user in the /grill-me session of 2026-10-31 unless marked otherwise; the agent proposed most of them and the user accepted, changed or replaced the proposal.

- Decision: D1 — a row is one build: skill card + customization + H.I.F. ability. The same card with a different customization or a different H.I.F. ability is another row. Every memory in a row carries exactly that build.
  Rationale: two memories can stand in for each other only when their builds match, which is what the player needs to know; the layout draws customization and ability once under the card icon.
  Date/Author: 2026-10-31, user.

- Decision: D2 — a cell of a memory is diamond or rainbow, chosen independently per cell, and a value is never typed: % cells show 3.5 (diamond) or 2.8 (rainbow), F cells show 25 or 20. Lower qualities are not recorded. The tier is chosen from explicit choices, never by tapping a cell to cycle through states.
  Rationale: the game shows each stat bonus with its own quality; the value follows from kind and quality, so there is nothing to mistype.
  Date/Author: 2026-10-31, user (choice instead of cycling).

- Decision: D3 — the patterns. A pattern says, for Vo, Da and Vi in that order, whether the bonus is a percentage growth bonus (%) or a fixed initial bonus (F). Every row always shows %%F, %F% and F%% in that order. A row may add up to two extra groups with distinct patterns; the extra-group picker offers %%% and FFF first, and also %FF, F%F and FF%, which are allowed but not worth tracking for most players.
  Rationale: the three fixed patterns are the gaps players fill; two copies of one extra pattern make no sense.
  Date/Author: 2026-10-31, user.

- Decision: D4 — owning several memories of one pattern in one build stacks them downward in that group's column, each line a full memory. Space under a shorter column is blank, not 未所持; 未所持 means a pattern with no memory at all. Identical duplicates are allowed. Lines keep the order the player entered them. Deleting a memory takes two taps on a delete button: the first arms it with a visible animation, the second deletes.
  Rationale: the user forgot this case at first and proposed stacking; identical duplicates are real ownership.
  Date/Author: 2026-10-31, user.

- Decision: D5 — a memory records only its three cells: no P-idol, no note.
  Rationale: the idol does not matter for coverage; every extra field slows entry.
  Date/Author: 2026-10-31, user.

- Decision: D6 — one table per scenario; this project builds the H.I.F. table only. Every memory in it has an H.I.F. ability, one of the plan's H.I.F. memory abilities, drawn with the icon of the one skill card it corresponds to. Tables for 初 and N.I.A. (the other scenarios) may come later as their own tables and are not built now. The stored memo carries a scenario tag, always `hif`, so a later table needs no data migration.
  Rationale: the user first proposed 初 and NIA as values for "no H.I.F. ability", then replaced that with separate tables per scenario.
  Date/Author: 2026-10-31, user; the scenario tag proposed by the agent and not objected to.

- Decision: D7 — a customization value is a set of (kind, step) pairs from the card's own customization options. More than one kind is allowed when the card's customization allowance is more than one; the card's limit from the data is enforced. "No customization" is a valid value and its own row. It is shown as short labels such as 好調+1, stacked when there are several. Base (non-enhanced) cards are in the pool as well as + cards; base and + are different cards; whether a base card can be customized follows the data.
  Rationale: the user stated the game's rules.
  Date/Author: 2026-10-31, user.

- Decision: D8 — the cards a tab offers are that plan's cards and the plan-free cards (offered under every tab), base and +. Excluded: P-idol unique cards and support-card event cards (neither can be a produce memory), every starter card except 表現の基本 (base version only, the one starter card that can be a produce memory), and unreleased cards. If the data marks which cards can be a produce memory, that mark is the rule, not a hand-made list.
  Rationale: only cards that can be a produce memory belong in a produce memory memo. Terms: see Context and Orientation.
  Date/Author: 2026-10-31, user (unreleased cards and the data mark proposed by the agent).

- Decision: D9 — owned and missing are shown three ways together: a missing pattern is a pink dashed, hatched 未所持 block in the grid; a 早見表 panel at the top of each tab, folded by default, has one line per row (card icon, name, then a square per fixed pattern: ✓ owned, ×N for several, dashed for missing; owned extra groups as grey pattern tags), and tapping a line scrolls to the row and highlights it; a toggle 「未所持がある行だけ表示」 hides rows whose three fixed patterns are all owned.
  Rationale: chosen after an HTML mockup of the three options; the user picked a mix with the map folded. The toggle and the grey tags were the agent's defaults, not objected to.
  Date/Author: 2026-10-31, user.

- Decision: D10 — a public tool with no accounts; each player's memo lives in their own browser and nothing personal is stored on a server.
  Rationale: like the sibling sites; other players share the problem; no storage of strangers' data.
  Date/Author: 2026-10-31, user.

- Decision: D11 — anonymous counts rank the pickers. One count event is sent when a row is created: +1 for its card, +1 for its H.I.F. ability and +1 for its customization (each (kind, step), or "none"), each keyed by the section it was created in. Deleting never subtracts; changing a row never counts. The card and H.I.F. ability pickers are ranked by their section's counts; the customization picker is not ranked (a card has only a few options), but its counts are collected.
  Rationale: the counter answers "what do people pick here"; per-section counts rank by what is picked where the picker is opened; counts per card pair would be too sparse to mean anything.
  Date/Author: 2026-10-31, user (the requirement and the customization rule); granularity proposed by the agent.

- Decision: D12 — counting is on by default, disclosed by one plain line near the footer (「行を追加すると、選んだスキルカード・HIFアビリティ・カスタマイズとセクション名だけを匿名で集計し、候補の並び順に使います」) with an off switch beside it, remembered in the browser. Sent: the section and the three ids only, no contents of the memo and no per-browser identifier. The IP address is used only for a per-day cap, as a hashed key in KV that expires daily (the pattern of gakumas-supportcards' feedback limit), and never stored otherwise. Until counts exist, pickers fall back to the game's order.
  Rationale: disclosure and a way out for a public page; a cap so one person cannot push a card up.
  Date/Author: 2026-10-31, user.

- Decision: D13 — a row may have no memories at all (a build the player is aiming for; all three fixed groups show 未所持). A build may appear only once per tab, whatever the section: the picker refuses a duplicate, says which section holds it and offers to jump there. Moving a row between sections is its own action.
  Rationale: noting a target and watching its gaps fill is the preparation use; a build in two sections would split its memories and show false gaps.
  Date/Author: 2026-10-31, user.

- Decision: D14 — rows keep the player's own order within a section; new rows go to the end; a drag handle rearranges them. A sort button offers several sort keys.
  Rationale: the user's preference over auto-sorting.
  Date/Author: 2026-10-31, user.

- Decision: D15 — the sort button is a one-time rearrange of one section: the sorted result becomes the player's own order, and a brief undo follows. Keys: レアリティ, アクティブ/メンタル, buff type (the game's own guide categories, such as 「やる気を増加するスキルカード」), 五十音 (card name). The sort is stable, so sorting by アクティブ/メンタル and then by レアリティ gives rarity order with active before mental inside each rarity.
  Rationale: one order and no hidden mode; dragging stays possible after a sort.
  Date/Author: 2026-10-31, user.

- Decision: D16 — the memo is saved automatically in the browser (IndexedDB) on every change. The page can be installed to the home screen (a PWA, progressive web app: a manifest and a service worker that let the browser install and open the page like an app), and suggests it to iPhone users because of Safari's seven-day deletion (see Surprises & Discoveries). Moving to another device or keeping a backup uses a 引き継ぎコード: a compact text code and a link carrying it; importing replaces the memo after a confirmation, with an undo; memos are never merged. Nothing is stored on the server.
  Rationale: consistent with D10; merge rules would cost more than they help.
  Date/Author: 2026-10-31, user.

- Decision: D17 — phone first. Under about 600 px of width, cells shrink to about 28 × 26 px with values in about 10 px type and the card column to about 56 px, so the card and the three fixed groups fit in about 370 px with no sideways scrolling, aligned with the section's column header; the extra groups move to a line of their own under the fixed groups.
  Rationale: the three patterns a player checks gaps against are always visible together.
  Date/Author: 2026-10-31, user.

- Decision: D18 — memories are entered and edited in a popover anchored in place to the tapped group, not in a bottom sheet. It has a line each for Vo, Da and Vi with two large buttons, ◆ダイヤ and 虹, each showing the value it means; nothing is preselected and 追加 enables only when all three are chosen, so a half-filled memory cannot exist. Tapping 未所持 opens it for a new memory; tapping an owned line opens it with that memory's tiers and the two-tap 削除 (D4). A thin, low-contrast 「＋」 strip under each owned group's last line adds another memory of that pattern. In the 追加 area, 「＋追加」 asks the pattern first (D3; patterns already in the row are greyed out), then opens the same popover.
  Rationale: per-cell popovers on 28 px cells cost about six taps per memory; the user preferred in-place over a bottom sheet.
  Date/Author: 2026-10-31, user.

- Decision: D19 — adding a row: 「＋ カードを追加」 at the end of a section opens an in-place popover in three steps: the skill card (search box and icon grid; plan cards then free cards, each ranked by the section's counts), the customization (the card's options, なし first, steps per kind, limit enforced), the H.I.F. ability (icon grid ranked by the section's counts). The duplicate check (D13) runs before the row is created; the row goes to the end (D14) and the count is sent (D11, D12). A 「⋯」 on the card cell opens 変更 (the same steps prefilled, with the duplicate check and no count), 別のセクションへ移動 (to the end of the chosen section) and 行を削除 (two taps; the armed state says how many memories go with it, e.g. 「メモリー3件も削除」).
  Rationale: accepted as proposed.
  Date/Author: 2026-10-31, user.

- Decision: D20 — card art follows one global setting 「カードの絵柄」: the player picks a P-idol once and every card icon (including the icons of H.I.F. abilities) uses that idol's illustration; the default is the first idol. A card with a single image uses it. If the chosen idol has no illustration for a card, the default idol's is used (agent's assumption; confirm in Milestone 0).
  Rationale: SR and SSR cards have no idol-neutral art, and players recognize cards by their art.
  Date/Author: 2026-10-31, user.

- Decision: D20b — images are never taken from gakumas-tools or another third party. They are fetched from the game ourselves (GkmasObjectManager) and stored in R2.
  Rationale: the user's instruction.
  Date/Author: 2026-10-31, user.

- Decision: D21 — the image extraction lives in gakumas-supportcards' existing pipeline, extended to skill card icons in every idol variant and to whatever else this page needs from the game (for example the ability quality textures). This app's Worker only reads the shared bucket `tia-assets`. Recorded as `docs/adr/0001-skill-card-data-and-art-come-from-gakumas-supportcards-at-runtime.md`.
  Rationale: one decoder and one daily job to fix when a game update breaks decoding; gkms-hif-final-stats already reads supportcards' art this way.
  Date/Author: 2026-10-31, user.

- Decision: D22 — the game data this page needs is generated by gakumas-supportcards and published as a second versioned file, `/data/skillcards.v1.json`, under its contract rules (supportcards' ADR 0010: the version is in the file name and any change of shape bumps it); this app's Worker proxies it, and the tests read a committed copy. Same ADR as D21.
  Rationale: supportcards may publish art only for released cards, so the release rule and the art must live together; a new card arrives with supportcards' daily job, with no deploy here.
  Date/Author: 2026-10-31, user.

- Decision: D23 — the stack is gkms-hif-final-stats' setup: Bun 1.4, TypeScript 7, Vite, Preact, Tailwind 4, oxlint with the rules adopted from supportcards, `bun test` with happy-dom for components, and pure rule modules with co-located tests. A Cloudflare Worker on `gkms-memomemo.tia.run` serves the page, `/img/*` read-only from `tia-assets`, `/data/skillcards.json` proxied from supportcards, `POST /count` and `GET /counts` (cached for a few minutes). Counts live in Cloudflare D1 (SQLite), where `n = n + 1` cannot lose updates when two players add rows at once, which KV can; the per-day cap lives in KV with a time-to-live. Public repository `tia-tools/gkms-memomemo`, default branch `develop`, `main` as production, a check workflow on pull requests into `develop`, deploy on push to `main`, a task board.
  Rationale: one way of working across the sibling projects.
  Date/Author: 2026-10-31, user.

- Decision: D24 — the repository and directory are `gkms-memomemo`; the domain `gkms-memomemo.tia.run`; the page title 「学マス　メモリーメモ帳」 with a full-width space.
  Rationale: the user's choice.
  Date/Author: 2026-10-31, user.

- Decision: D25 — the repository lives at `~/Developer/gkms-memomemo` and on GitHub as `tia-tools/gkms-memomemo`, public like both siblings.
  Rationale: the user's choice.
  Date/Author: 2026-10-31, user.

- Decision: D26 — the interface is in Japanese only, like the siblings.
  Rationale: agent's default, stated to the user and not objected to.
  Date/Author: 2026-10-31, agent.

- Decision: D27 — when the last memory of an extra group is deleted, the extra group disappears from the row; a fixed group with no memory shows 未所持.
  Rationale: an extra group exists only to hold memories the player happens to own (D3), so an empty one carries no information; agent's assumption, to confirm with the user when Milestone 4 is shown.
  Date/Author: 2026-10-31, agent.

- Decision: D28 — the 引き継ぎコード link carries the code in the URL fragment (`https://gkms-memomemo.tia.run/#import=<code>`), never in the path or query.
  Rationale: a browser never sends the fragment to the server, so a memo never reaches the Worker or its logs, which keeps D10 true even for the import link; agent's decision.
  Date/Author: 2026-10-31, agent.

- Decision: D29 — the counting approach is reopened for cost and settled in Milestone 0: how count events are stored and capped, and whether counting is built as D11, D12 and D23 describe it at all. Until then Milestone 6 stands as written, and it is rewritten to match the outcome.
  Rationale: the per-day cap writes KV once per row created, and the Workers Free plan allows 1,000 KV writes a day (Surprises & Discoveries); the user wants the approach reconsidered to save the cost, and left it for Milestone 0.
  Date/Author: 2026-10-31, user, at the plan review.

- Decision: D30 — whatever endpoint receives count events checks the section against the nine ids and the card, the H.I.F. ability and each customization (kind, step) against the data file the Worker already fetches for `/data/skillcards.json`, not only against the shape of a game id. An event naming anything else is refused and counts nothing.
  Rationale: with only a shape check, anyone could fill the counts, and with them every reply of `GET /counts`, with made-up ids.
  Date/Author: 2026-10-31, agent's proposal at the plan review, accepted by the user.

- Decision: D31 — a saved row whose card, customization or H.I.F. ability is not in the current data file is kept as it is and shown as unknown, still counted in coverage, and can be edited or deleted like any row; it is never dropped or rewritten. A 引き継ぎコード is refused when its format or the shape of an id is wrong, and an id that is well formed but not in the data file is accepted and handled the same way.
  Rationale: the memo is the player's only copy (D10); a data change in supportcards must never delete what they entered, and a code carrying such a row must still move to another device.
  Date/Author: 2026-10-31, agent's proposal at the plan review, accepted by the user. It replaces the rule that decoding checks every id against the data file.

- Decision: D32 — the service worker keeps the page, the last `/data/skillcards.json` it fetched and every icon the page has shown, so the installed page opens offline and draws the memo.
  Rationale: without the data file and the icons an offline page has nothing to draw rows with.
  Date/Author: 2026-10-31, agent's proposal at the plan review, accepted by the user.

## Outcomes & Retrospective

Nothing yet; the plan has not started.

## Context and Orientation

The repository `~/Developer/gkms-memomemo` (GitHub `tia-tools/gkms-memomemo`) holds, at the start of this plan, only the project template: `CLAUDE.md`, `docs/PLANS.md`, `docs/adr/README.md`, `docs/adr/0001-skill-card-data-and-art-come-from-gakumas-supportcards-at-runtime.md` and this plan. There is no code yet.

Terms used throughout, in plain language:

A produce is one run of raising an idol in the game. At the end the player can save a memory. A game memory holds two different things: a stage memory (the skill cards and stats used in contests) and a produce memory. A produce memory is the part that lets the player carry one skill card into a later produce; it has that skill card, possibly a customization of it, an H.I.F. ability if it was made in the H.I.F. scenario, and three stat abilities, one each for Vo (vocal), Da (dance) and Vi (visual). In this plan "memory" always means the produce memory.

A stat ability raises one stat at the start of the next produce, either as a percentage growth bonus (written % here; the game's `*_growth_rate_addition`) or as a fixed initial bonus (written F; the game's `initial-*_addition`). Its quality, called tier here, is diamond (the game's UR rarity: 3.5% or +25) or rainbow (SSR: 2.8% or +20). A pattern is the kind of each of the three abilities in Vo, Da, Vi order, so %%F means Vo%, Da%, Vi fixed. A group is the column of one pattern in a row; a memory is one line of three cells in a group.

A plan is one of the game's three training styles: センス (sense), ロジック (logic), アノマリー (anomaly). Each has two sub-styles, which are the sections of its tab, plus a third section 共通 for builds the player uses with both: センス has 好調, 集中 and 共通; ロジック has やる気, 好印象 and 共通; アノマリー has 強気, 全力 and 共通. The section 共通 is not the game's "free" (共通) skill cards; any section may hold any card the tab offers (D8). Use these stable section ids in code and in the count events: `sense.kocho`, `sense.shuchu`, `sense.common`, `logic.yaruki`, `logic.koinsho`, `logic.common`, `anomaly.tsuyoki`, `anomaly.zenryoku`, `anomaly.common`.

A skill card is a card played in the game's lessons and contests. It has a rarity (N, R, SR, SSR), a type (アクティブ or メンタル), a plan (or free), and a base and an enhanced (+) version, which are different cards. A customization (カスタマイズ) changes a card; each card has a few customization kinds, each with steps (for example 強気+ with steps 1–3), and a limit on how many it can take. An H.I.F. ability is a memory ability only memories made in the H.I.F. scenario (初星アイドルフェスティバル, `hatsuboshi_idol_festival` in the data) have; each corresponds to one skill card and is drawn with its icon. A build is the triple (skill card, customization, H.I.F. ability); a row is one build (D1).

The sibling repositories, all checked out next to this one under `~/Developer`:

gakumas-supportcards (`https://gakumas-supportcards.tia.run`) generates its data from `vertesan/gakumasu-diff`, a public dump of the game's master tables as YAML files (`ProduceCard.yaml`, `ProduceCardCustomize.yaml`, `MemoryAbility.yaml`, `ProduceSkill.yaml`, `ProduceGuideProduceCardCategory.yaml` and others). Its generators read only the tables they declare in `scripts/lib/tables.ts`, caching each in `.cache/gakumasu-diff/`; the tables this app needs, apart from `ProduceSkill.yaml`, are not among them yet. `bun run generate` writes committed modules (`data/cards.generated.ts` and others), and `bun run build` writes the published `dist/data/cards.v1.json` from those modules through a Vite plugin, so the build itself never reads a YAML table; a daily workflow regenerates the modules and merges them by pull request. Its `scripts/images/` pipeline downloads art from the game's servers through GkmasObjectManager (a GPL-3.0 tool that fetches and decrypts the game's asset manifest and bundles; pinned by commit, never shipped), decodes it, and uploads it to the Cloudflare R2 bucket (object storage) `tia-assets`, served under `/img/…` by each app's own Worker. Each image is stored as a private lossless master under `master/` and a public rendition under a prefix named for its width (`w192/` for support card thumbnails, `w48/` for P-item icons). The upload decides what is missing by sending `HEAD` requests to supportcards' own deployed site, and its Worker answers only those two renditions (Surprises & Discoveries). It already publishes `/data/cards.v1.json` for another app (its ADR 0010). Per ADR 0001 of this repository, it will also publish the data and the art this app needs.

gkms-hif-final-stats (`https://gkms-hif-final-stats.tia.run`) is the closest model for this repository's setup: a Preact page built by Vite with Bun, a Cloudflare Worker (`infra/worker/`) serving the built page plus `/img/*` read-only from `tia-assets` and `/data/cards.json` proxied from supportcards, `check.yml` and `deploy.yml` workflows, `oxlint.config.ts`, and tests that pin the workflows' and `wrangler.toml`'s shape. Copy from it rather than inventing.

A Cloudflare Worker is a small server program run by Cloudflare at the domain; `wrangler` is its command-line tool and `wrangler.toml` its configuration. D1 is Cloudflare's SQLite database service; KV is its key-value store, whose keys can expire on their own.

## Plan of Work

Milestone 0 settles the facts. Everything later depends on what the game data actually says, and parts of this design were stated by the user from the game's screens rather than read from the data. Work in a scratch directory under `$TMPDIR`, fetching the YAML tables from `https://raw.githubusercontent.com/vertesan/gakumasu-diff/main/<Table>.yaml` (supportcards' cache holds only `ProduceSkill.yaml` of them). Find and write down, with evidence snippets in Surprises & Discoveries: which fields of `ProduceCard.yaml` give a card's plan, rarity, type, base or enhanced state, source (produce, P-idol unique, support card event, starter), release, customization options and customization limit, and whether a mark exists for "can be a produce memory" (D8); how a customization kind and its steps appear in `ProduceCardCustomize.yaml` and where their Japanese labels come from; how each of the 115 H.I.F. abilities in `MemoryAbility.yaml` leads to its one skill card and to its plan; what the eight `MemoryAbility.yaml` entries per stat ability kind are, and whether diamond = UR and rainbow = SSR holds for all three stats; how the game's guide categories in `ProduceGuideProduceCardCategory.yaml` and its group table map to plans; and, through GkmasObjectManager's manifest, how a skill card's icon asset is named per P-idol, whether every SR and SSR card has one per idol, and which asset the game uses for the diamond and rainbow ability backgrounds; and the game's own order of the P-idols, so that "the first idol", D20's default, names one idol from the data. Choose the icon rendition: its pixel width (the card icon shows at 56 px and the H.I.F. ability box at 24 px, so twice 56 for sharp phone screens is the starting point), its bucket prefix in the `w<width>/` scheme, and its file name per idol variant, as the game names the asset. Settle D29: compare ways of counting and capping count events against the Cloudflare plan the `tia.run` account is actually on (find out which; Surprises & Discoveries gives the free-plan limits), for example keeping the per-day cap in D1 beside the counts, a cap of a different shape, or no counting at all, and record the choice as a decision with its cost. The milestone ends with a requirements section added to this plan's Interfaces and Dependencies, stating what `skillcards.v1.json` must contain, which images `tia-assets` must hold under which prefix and names, and that supportcards' Worker must serve that prefix for its upload to see what is missing, written so a session in gakumas-supportcards can work from it alone; and with Milestone 6 rewritten to the counting decision. Acceptance: every question above has an answer with evidence in this plan, or is recorded as unknown with the fallback chosen, and D29 has its decision.

Milestone 1 happens in gakumas-supportcards, following that repository's own `CLAUDE.md` (which may require its own ExecPlan) and its ADR 0010 for published files and ADR 0003 for images. The session working it follows the way `cards.v1.json` is made (Context and Orientation): it declares the tables Milestone 0 names in `scripts/lib/tables.ts`, with only the fields read; adds a generator that `bun run generate` runs, writing a committed module beside `data/cards.generated.ts`; and adds a build plugin that writes `dist/data/skillcards.v1.json` from that module, published at `https://gakumas-supportcards.tia.run/data/skillcards.v1.json`, so the daily workflow's data pull request carries new skill cards as it carries new support cards. It extends `scripts/images/extract.py` and `upload.py` to extract every released skill card's icon in every idol variant (and the ability textures, if found) into `tia-assets` under the rendition and names Milestone 0 chose, with masters under `master/` as its ADR 0003 prescribes, and widens its Worker's `img.ts` path pattern to that rendition so that the upload's `HEAD` requests see what is already there and the daily job fetches only what is missing. The work goes to a pull request into supportcards' `develop`, reviewed by the user. Acceptance: after supportcards deploys, `curl -s https://gakumas-supportcards.tia.run/data/skillcards.v1.json | head -c 300` shows the file with its `formatVersion`, and a HEAD request for one icon path named in it answers 200.

Milestone 2 creates this repository's skeleton by copying gkms-hif-final-stats: `package.json` (renamed), `tsconfig.json`, `vite.config.ts`, `oxlint.config.ts`, the Tailwind entry, `index.html` titled 「学マス　メモリーメモ帳」, `src/main.tsx` rendering a placeholder, `infra/worker/` with `worker.ts`, `img.ts` and a data proxy for `/data/skillcards.json` (fetching supportcards' file server-side and caching it for an hour, as hif-final-stats' `data.ts` does for cards), `wrangler.toml` for `gkms-memomemo.tia.run` (its `run_worker_first` naming `/img/*` and `/data/skillcards.json`), the workflows `check.yml` and `deploy.yml`, and their shape tests. The copied `img.ts` answers only support card thumbnails and P-item icons (Surprises & Discoveries); change its path pattern to the skill card icon rendition from Milestone 0 (and the ability textures, if any) and nothing else, so `master/` and every other path stay a 404, and change its test to match. In `src/data/`, copy the data file's types from supportcards verbatim into `contract.ts`, write `load.ts` that checks a whole file against them and refuses it with the path of the first bad value, and commit a copy of the real file as `src/data/fixtures/skillcards.v1.json` for the tests. The dev server answers `/data/skillcards.json` from a sibling supportcards build if present, else from the fixture, and `/img/*` from supportcards' local `scripts/images/out/` if present, else 404. Acceptance: `bun test`, `bun run type-check`, `bun run lint` and `bun run build` exit 0, and `bun run dev` serves a page that lists the number of cards the data file holds.

Milestone 3 writes the memo model as pure TypeScript in `src/memo/`, one module per rule, each with a co-located test: the types (see Interfaces and Dependencies); `build.ts` (a build's canonical key, with customization pairs sorted so that the same set always gives the same key); `edit.ts` (add a row at a section's end refusing a build already in the tab and naming its section, change a row's build under the same check, move a row to another section's end, reorder rows by drag, delete a row, add a memory to a group, change and delete a memory, add an extra group with a pattern not already in the row and at most two extras, and drop an extra group when its last memory goes, D27); `sort.ts` (the four sort keys of D15 as a stable sort of one section, returning the new order so the caller can offer undo); `coverage.ts` (for each row, the count per fixed pattern and the owned extra patterns, feeding the 早見表 and the 「未所持がある行だけ表示」 toggle); `values.ts` (the value a cell shows from kind and tier); and `code.ts` (the 引き継ぎコード: the memo as JSON, compressed with the browser's `CompressionStream("deflate-raw")`, encoded as base64url and prefixed `mm1.`; decoding checks the prefix, the format and the shape of every id, and refuses with a reason rather than importing part of a memo; a well-formed id missing from the data file is kept, D31). The model takes card, customization and H.I.F. ability ids as plain strings and needs no data file except where `sort.ts` reads a card's rarity, type and guide category, so this milestone can be worked while Milestone 1 is in review in supportcards, with a hand-written stand-in for those card fields until the fixture exists. Acceptance: the tests pass and each new test was seen to fail when its rule was broken.

Milestone 4 builds the page in `src/app/` with Preact and Tailwind, phone first (D17): the three tabs; per tab the folded 早見表 (D9) and the 「未所持がある行だけ表示」 toggle; per section a header with the three fixed patterns' column labels and the 追加 column, the rows, and 「＋ カードを追加」; per row the card icon with its name, the H.I.F. ability icon and the customization labels under it, the 「⋯」 menu (D19), a drag handle, the groups with stacked memories, the 未所持 blocks, the 「＋」 strips and the 追加 area; the in-place memory popover (D18) and the three-step row popover (D19) with search; the sort button with its keys and the brief undo (D15); the two-tap delete with its arming animation (D4, D19); and a settings area with 「カードの絵柄」 (D20) and the counting note and switch (D12, wired in Milestone 6). A row whose ids are not in the data file is drawn as unknown and keeps its memories, menu and delete (D31). Cells use the textures from `tia-assets` if Milestone 0 found them, otherwise the CSS gradients described in Artifacts and Notes. Acceptance: the scenario in Purpose works in `bun run dev` on a phone-sized window (390 px wide) and on a desktop, checked in a browser; component tests cover the popovers' rules (追加 disabled until three tiers are chosen, the duplicate refusal, two-tap delete).

Milestone 5 makes the memo last. `src/app/storage.ts` saves the whole memo in IndexedDB after every change (debounced so a burst of edits is one write) and asks `navigator.storage.persist()`; the page loads it at start. A web app manifest and a small service worker make the page installable and usable offline: it keeps the page, the last `/data/skillcards.json` it fetched and every icon the page has shown (D32); the settings area suggests 「ホーム画面に追加」 to iPhone Safari users, saying why (Surprises & Discoveries). The 引き継ぎコード UI shows the code with a copy button and the link (D28); opening a link with `#import=` or pasting a code asks for confirmation, replaces the memo, keeps the previous one for an undo, and removes the fragment from the address bar. Acceptance: a memo entered, reloaded, and exported on one browser profile and imported in another is identical, and the undo brings back what was there before; the installed page, opened again with the network off, shows the memo with its icons.

Milestone 6 adds the counts. This paragraph is the design as it stood before D29 reopened it; Milestone 0 rewrites it to the counting decision, and D30 applies to whatever replaces it. In the Worker, `POST /count` accepts `{ section, card, hif, customization }` (customization a list of `kind:step` strings, empty for none), checks the section against the nine ids and the card, the H.I.F. ability and each customization step against the data file the Worker holds for `/data/skillcards.json` (D30), refuses bodies over 1 KB, and counts the client in KV under a truncated SHA-256 of its IP, the UTC day and the secret salt `HASH_SALT` (without the salt an IPv4 address's key could be brute-forced; supportcards' `infra/worker/feedback.ts` does the same) with a one-day time-to-live, answering 429 above the cap (start at 200 events per day), and refusing with 503 while the salt is not set. It then adds 1 to each `(section, kind, id)` row in D1 with an upsert. `GET /counts` returns every count grouped by section and kind, built from one query and cached through the Cache API for five minutes. The page sends the event when a row is created, unless the player switched counting off, and never retries in a way that could double-count; the card and H.I.F. ability pickers order each block by the section's counts, ties and zero counts falling back to the game's order. Acceptance: Worker tests with a fake D1 and KV show the upsert, the cap and the validation; with `wrangler dev` and a local D1, creating rows changes `GET /counts` and the picker order.

Milestone 7 releases. The counting resources named here (D1, KV, `HASH_SALT`) are those of Milestone 6 before D29, and change with it. Following `infra/worker/README.md` (written in Milestone 2 from hif-final-stats' README), create the D1 database and the KV namespace, put their ids in `wrangler.toml`, apply the schema migration, set the Worker secret `HASH_SALT` to a long random value (`bunx wrangler secret put HASH_SALT`; never committed, never printed), store the Cloudflare API token as the repository secret the deploy workflow reads, merge `develop` into `main` through a pull request, and watch `deploy.yml` deploy. Acceptance: `https://gkms-memomemo.tia.run` serves the page, the scenario in Purpose works there on a real phone, `/img/…` answers an icon, `/data/skillcards.json` answers the data, and a row created there appears in `GET /counts`.

## Concrete Steps

Install, from the repository root, once Milestone 2 has created `package.json`:

    cd ~/Developer/gkms-memomemo
    bun install

Under the Claude Code sandbox, Bun's global cache is not writable; use `BUN_INSTALL_CACHE_DIR="$TMPDIR/bun-cache" bun install`. The dev server cannot open its port inside the sandbox (`listen EPERM`); run it outside the sandbox.

The checks, each judged by its exit status (a clean type check or lint prints only the command line):

    bun test
    bun run type-check
    bun run lint
    bun run build

Reading a game table for Milestone 0, outside the repository:

    mkdir -p "$TMPDIR/gd"
    curl -s -o "$TMPDIR/gd/ProduceCard.yaml" https://raw.githubusercontent.com/vertesan/gakumasu-diff/main/ProduceCard.yaml

Work happens on feature branches from `develop` (for example `feat/skeleton`), merged by pull request into `develop`; a release is a pull request from `develop` into `main`.

## Validation and Acceptance

The plan is complete when, on `https://gkms-memomemo.tia.run` from a phone: the scenario in Purpose works; a second F%% memory stacks under the first; an extra %%% group can be added and a second %%% cannot; adding the same build to another section of the same tab is refused with the section named; 早見表 opens from its folded state and a tap on a line scrolls to the row; sorting a section by レアリティ and undoing restores the previous order; switching 「カードの絵柄」 changes every icon; the memo survives a reload and moves to another browser by 引き継ぎコード; and with counting on, creating a row increases its counts in `GET /counts`, while with counting off it does not. `bun test` passes with every rule module and Worker route covered.

## Idempotence and Recovery

Every check and build can be rerun. The data proxy and the icons only read from supportcards, so nothing here can damage its data. The D1 schema is applied as a numbered migration (`wrangler d1 migrations apply`), which skips migrations already applied. A failed deploy leaves the previous version live; rerun `deploy.yml` from the Actions tab. A player's memo is only in their browser, so a bug in the page cannot reach other players' data; the import undo (Milestone 5) protects against a wrong code.

## Artifacts and Notes

The overview options were tried as an HTML mockup during the design session (not kept; it used borrowed icons). What it showed and the user accepted: rows of a 72 px card column (56 px icon, the name in 10 px type, under it a 24 px H.I.F. ability box with the ability's card icon and a customization box with labels such as 好調+1 or なし), then groups of three 40 × 30 px cells with 3 px gaps and 10 px between groups. Each cell has a 3 px strip in the stat's colour at its top (Vo `#f0468c`, Da `#2f8ff0`, Vi `#f5b400`) and its value in 11 px bold type. The section header repeats the strip colours over the column labels (Vo% Da% Vi+ for %%F, and so on) and has a 追加 column whose extra groups carry their pattern above them. The CSS stand-ins for the textures were a pale blue faceted gradient for diamond (border `#7cc4ea`) and a pink-yellow-green-blue-violet gradient for rainbow (border `#c79bf2`); 未所持 was a 2 px dashed `#f0a1bf` border over pink diagonal hatching with 未所持 in `#d0477f`. The 早見表 used 26 × 18 px squares: green `#2f9e6a` with ✓ or ×N for owned, a dashed pink box for missing, and grey tags for extra patterns.

## Interfaces and Dependencies

Dependencies are those of gkms-hif-final-stats (see its `package.json`): `preact`, and for development `vite`, `@preact/preset-vite`, `tailwindcss` with `@tailwindcss/vite`, `typescript` 7, `oxlint` with `oxlint-tsgolint`, `@types/bun`, `@happy-dom/global-registrator`. No new runtime dependency without asking the user. The Worker uses Cloudflare's D1, KV, R2 and Cache APIs through `wrangler`.

At the end of Milestone 3, `src/memo/types.ts` defines:

    export type PlanId = "sense" | "logic" | "anomaly";
    export type SectionId =
      | "sense.kocho" | "sense.shuchu" | "sense.common"
      | "logic.yaruki" | "logic.koinsho" | "logic.common"
      | "anomaly.tsuyoki" | "anomaly.zenryoku" | "anomaly.common";
    export type Kind = "%" | "F";
    export type Pattern = `${Kind}${Kind}${Kind}`;        // Vo, Da, Vi
    export type FixedPattern = "%%F" | "%F%" | "F%%";      // shown in every row, in this order (D3)
    export type ExtraPattern = Exclude<Pattern, FixedPattern>;
    export type Tier = "diamond" | "rainbow";
    export type Memory = readonly [Tier, Tier, Tier];       // Vo, Da, Vi
    export interface CustomizationStep { kind: string; step: number }
    export interface Build { card: string; customization: readonly CustomizationStep[]; hif: string }
    export interface Row {
      id: string;                                           // random, stable across edits
      build: Build;
      fixed: Record<FixedPattern, readonly Memory[]>;
      extras: readonly { pattern: ExtraPattern; memories: readonly Memory[] }[];   // at most 2, distinct
    }
    export interface Memo {
      formatVersion: 1;
      scenario: "hif";
      sections: Record<SectionId, readonly Row[]>;           // each section in the player's order
    }

`src/memo/edit.ts` exposes pure functions from a `Memo` to a new `Memo` or a refusal, for example `addRow(memo, section, build): Memo | { refused: "duplicate"; section: SectionId }`. The data file's types live in `src/data/contract.ts`, copied verbatim from supportcards once Milestone 1 defines them; they are never edited here on their own.

The data requirements for `skillcards.v1.json` are written here at the end of Milestone 0, together with the icon rendition (width, `w<width>/` prefix, file names per idol variant) and the requirement that supportcards' Worker serve it.

Revision note, 2026-10-31: first draft, written at the end of the /grill-me design session from its decision log, before any code; Milestone 0 is the next step.

Revision note, 2026-10-31: the plan was reviewed against gakumas-supportcards, gkms-hif-final-stats and the upstream tables before any work, and the findings folded in at the user's request. Context and Orientation and Milestone 1 now describe supportcards' data pipeline as it is (only declared tables cached, a committed generated module, the published file written by a build plugin), where before they said the file was built from the cached tables. Milestones 0, 1 and 2 now cover the skill card icon rendition and the Workers that must serve it, because both Workers answer only support card thumbnails and item icons and supportcards' upload checks its own site. Milestone 0 also defines D20's "first idol" and settles D29, the counting approach reopened for cost. D30 validates count events against the data file, D31 keeps rows whose ids left the data file (replacing the rule that the 引き継ぎコード decoder checks every id against the data file), and D32 says what the service worker keeps. Milestones 6 and 7 carry `HASH_SALT` and a note that they change with D29. `FixedPattern` and `ExtraPattern` are added to the types so an extra group cannot hold a fixed pattern. Milestone 3 says it can run while Milestone 1 is in review. Three observations were added to Surprises & Discoveries, and the Progress line now names D26–D28.
