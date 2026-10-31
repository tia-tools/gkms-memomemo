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
  - [x] (2026-10-31 06:29Z) Game tables (`vertesan/gakumasu-diff` at `fc6afb8b5ba4`, 2026-10-28) and the asset manifest (version `205100:0075`) read; every question of the milestone answered or narrowed in Surprises & Discoveries; agent defaults D33–D36 recorded; requirements drafted in Interfaces and Dependencies with the open points marked.
  - [x] (2026-10-31 07:46Z) The user answered three of the four questions the data cannot settle: no ++ or +++ (D37), no Legend cards (D38), the limit counts steps with a memory capped at 2 (D39); and added 開幕時獲得 to the build (D40).
  - [x] (2026-10-31 08:15Z) The counting approach (D29): compared in a table of five options; the user chose everything in D1 on the Free plan the account is on (D41), and Milestones 6 and 7 were rewritten to it. The user also corrected D40: "N" meant the base card, and the rule is a customization-steps cap while 開幕時獲得 is on.
  - [x] (2026-10-31 09:14Z) Icon delivery under the Free plan: the user chose sprite sheets (D42), and the supportcards requirements gained the sheets and their index. The account's daily request counts cannot be read with wrangler (Surprises & Discoveries); the user can read them in the dashboard.
- [x] (2026-10-31 09:14Z) Milestone 0 complete: every question has an answer with evidence or a recorded fallback (the icon width is measured in Milestone 1, D35), D29 is settled by D41, and Interfaces and Dependencies states what supportcards must provide.
  - [ ] Requirements finalized with those answers, and Milestone 6 rewritten to the counting decision.
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

The observations below are Milestone 0's. Unless stated otherwise their evidence is the upstream tables at `vertesan/gakumasu-diff` commit `fc6afb8b5ba4` (2026-10-28), read on 2026-10-31 by scratch scripts outside the repository, and the game's asset manifest version `205100:0075`, fetched the same day through supportcards' pinned GkmasObjectManager.

- Observation: a base card and its + are one `ProduceCard` id at two upgrade levels, not two cards, and the data has two more levels. `ProduceCard.yaml` has 1,801 rows for 472 ids, one row per `(id, upgradeCount)`: `upgradeCount` 0 is the base card, 1 the + card, and 2 and 3 exist for every card that has a + (443 ids), named ++ and +++. `assetId` and `isCharacterAsset` never differ between the levels of one id.
  Evidence: `p_card-01-act-1_001  0:ファンサ  1:ファンサ+  2:ファンサ++  3:ファンサ+++`; 472 rows at level 0, 443 at each of 1, 2 and 3.

- Observation: only an upgraded card can be customized. No level-0 row has a customization option (472 of 472); 248 of the 443 level-1 rows have some. Levels 1, 2 and 3 of one id carry the same options and limit for 439 of the 443 ids. A customization kind is one `ProduceCardCustomize` id (290 kinds), its steps are that id's rows, numbered by `customizeCount` (222 kinds with 1 step, 34 with 2, 34 with 3), and a card lists its kinds in `produceCardCustomizeIds` (2 or 3) with a limit `maxCustomizeCount` (1 to 3). Whether the limit counts kinds or steps is not in the data: 124 cards have limit 1 with two one-step kinds, which fits both readings, and ファンサ+ has limit 3 with kinds of 1, 1 and 3 steps, which the two readings treat differently.
  Evidence: ファンサ+'s kinds, as `customizeCount:grow effect:producePoint` per step:

      好調追加      1:g_effect-effect_add-e_effect-exam_parameter_buff-02:70
      絶好調追加    1:g_effect-effect_add-e_effect-exam_parameter_buff_multiple_per_turn-02:70
      (no text)     1:g_effect-lesson_add-6:40  2:g_effect-lesson_add-12:40  3:g_effect-lesson_add-30:70

- Observation: a customization's Japanese label is in the data, in one of two places. 149 of the 392 step rows carry a `description` (23 distinct texts such as 好調追加, 絶好調追加, 強気+, 成長追加); for the rest, `ProduceDescriptionProduceCardGrowEffect.yaml` gives a label per grow-effect type in `produceCardCustomizeDescription`, such as `ParameterBuffTurnAdd=好調+`, `LessonAdd=パラメータ+`, `BlockAdd=元気+`. The generic `EffectAdd=効果追加` is never needed alone for the pool: of the 122 steps adding an effect, the 4 without a `description` belong to P-idol unique cards (絶対に負けない, それぞれの道, 入道雲と、きみ, よそ見はダメ♪). How the game prints the step next to the label (the design's 好調+1) has not been checked against a game screen.

- Observation: no field marks a card as able to be a produce memory, so D8's rule is applied through the data's own tags. `ProduceCard.yaml` has no such field (its fields include `searchTag`, `originIdolCardId`, `originSupportCardId`, `isInitial`, `isInitialDeckProduceCard`, `libraryHidden`, `isLimited`, `isReward`, `isRestrict` and `viewStartTime`; `isLimited`, `isReward` and `isRestrict` are false on every row). P-idol unique cards are `searchTag: idol-unique` (680 rows), support-card event cards have `originSupportCardId` (236 rows), starter cards are `searchTag: starter` (136 rows, 表現の基本 being `p_card-00-men-0_003`), and the one trouble card is 眠気 (`category: ProduceCardCategory_Trouble`). Without those, the pool is 209 cards at level 0: 78 SR, 51 R, 45 SSR, 28 Legend and 7 N; 67 センス, 67 ロジック, 65 アノマリー, 10 free. 180 of them have a + (174 of those with customizations, 190 kinds in all); the 28 Legend cards have only level 0.
  Evidence: the Legend rarity (`ProduceCardRarity_Legend`) is new to this design: 15 plan cards such as 舞台の支配者 (`p_card-01-act-100_003`), and 13 一番星 cards such as 好きを集める一番星 (`p_card-01-ido-100_039`), each with an `originPrimaStellaIdolCardId`. Whether either kind can be a produce memory is the user's to say.

- Observation: a card's release is its `viewStartTime`, epoch milliseconds, or "0" for always; no card had one in the future on 2026-10-31. The release rule is therefore `viewStartTime <= now`, which supportcards' build applies so that art and data for a card appear together.
  Evidence: 1,285 rows with "0", the rest dated, for example `1778896800000` (16 rows); 0 rows later than the time of reading.

- Observation: each of the 115 H.I.F. abilities belongs to exactly one skill card, and that card is named only inside an id. Every one has a `ProduceSkill` with one effect, `p_effect-exam_status_enchant-enchant-p_ef-hif_memory-<card id>-enc02`; following the enchant chain through `ProduceExamStatusEnchant`, `ProduceExamEffect` and `ProduceCardSearch` reaches no field naming the card. The 115 card ids are distinct, all exist, and are all R (49) or SR (66) plan cards in the pool: 40 センス, 38 ロジック, 37 アノマリー, none free and none SSR. The skills' own `planType` is `ProducePlanType_Common` for all, so an ability's plan is its card's plan. The trigger is `p_trigger-start_audition-for_hif_memory` for all.
  Evidence: `memory_ability-p_memory_skill-common-hatsuboshi_idol_festival-…-01-001-001` → skill effect `p_effect-exam_status_enchant-enchant-p_ef-hif_memory-p_card-01-men-1_034-enc02` → card `p_card-01-men-1_034` (ひと呼吸).

- Observation: the eight `MemoryAbility.yaml` entries per stat ability kind are four rarities under two id families, and diamond = UR, rainbow = SSR holds for Vo, Da and Vi alike. Each kind (Vo%, Vo F, Da%, …) has R, SR, SSR and UR, each once as `ability-…` (for example `ability-p_cd-memory-vocal-1500-001-…-04-001`) and once as `memory_ability-…-04-001-001`, both pointing at one `ProduceSkill`. The rarity is on the `ProduceSkill` (`SkillRarity_R`, `_Sr`, `_Ssr`, `_Ur`); `MemoryAbility.rarity` is `SkillRarity_Unknown` on all 585 rows. The values are 1.4 / 2.1 / 2.8 / 3.5 % and +10 / +15 / +20 / +25 for every stat.
  Evidence: `dance_growth_rate_addition-0028_0028` and `-0035_0035`, `visual_addition-0020_0020` and `-0025_0025`, and the same for vocal, each twice.

- Observation: the guide categories cover a third of the pool. `ProduceGuideProduceCardCategoryGroup.yaml` has one group per sub-style (ParameterBuff 好調, LessonBuff 集中, CardPlayAggressive やる気, Review 好印象, Concentration 強気, FullPower 全力, the last two being アノマリー's), each twice (`_group_20`, `_group_35`); its categories carry labels such as 「やる気を増加するスキルカード」 and list recommended cards (11 distinct labels, with その他のスキルカード). 75 of the 209 pool cards are in at least one category, 6 of them under two labels; 134, such as ファンサ and 愛嬌, are in none. Every card instead has `effectGroupIds`, the game's effect taxonomy (for example `effect_group-visible-exam_parameter_buff-000`), usually several per card.

- Observation: the game orders the P-idols in `Character.yaml` by `order`, so D20's "first idol" is 花海咲季 (`hski`, order 10). The 13 playable idols (`isPlayable: true`), in order: hski, ttmr, fktn, atbm, amao, kllj, kcna, ssmk, shro, jsna, hmsz, hume, hrnm. Card art also exists for 根緒亜紗里 (`nasr`), who is not playable.

- Observation: a skill card's icon is the asset `<assetId>.unity3d` when `isCharacterAsset` is false, and `<assetId>-<character id>.unity3d` per idol when it is true, where `assetId` already reads `img_general_skillcard_…`. Every per-idol card in the pool has all 13 playable idols' variants, so D20's fallback is not needed today. The pool needs 1,901 icons: 141 cards × 13 (every SR and SSR, 3 R and 15 Legend) and 68 single images (48 R, 7 N, 13 一番星).
  Evidence: the manifest lists 2,483 `img_general_skillcard_*` assets, for example `img_general_skillcard_act-2_009-hski.unity3d` … `-ttmr.unity3d` (14 suffixes with `nasr`) and `img_general_skillcard_men-0_003.unity3d` (表現の基本).

- Observation: the manifest has no texture for the diamond and rainbow qualities. A search of its 49,144 names for rarity, frame, UR, SSR, rainbow, diamond, ability and memory found none; they are probably in a sprite atlas. It does have stat icons, `img_general_icon_produce-effect_bg-{vocal,dance,visual}` and `…_pict-{vocal,dance,visual}`, `…_pict-dancegrowthrate`. The cells therefore use the CSS stand-ins of Artifacts and Notes.

- Observation, for D29: two more Cloudflare services could hold counts or caps. Workers Analytics Engine includes 100,000 data points written and 10,000 read queries a day on the Free plan, bills nothing at present, and keeps data for three months. The Workers Rate Limiting binding allows only 10- or 60-second periods, counts separately in each Cloudflare location and approximately, and its page states no plan or price.
  Evidence: `https://developers.cloudflare.com/analytics/analytics-engine/pricing/` ("Currently, you will not be billed for your use of Workers Analytics Engine"), `…/analytics-engine/limits/` ("stored for three months"), `https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/` ("Must be either 10 or 60", "Rate limits are approximate and apply separately in each Cloudflare location"), read 2026-10-31.

- Observation, for D29 and Milestone 2: on the Workers Free plan the icons, not the counts, are the first daily limit the site meets. Requests for the page's own files (the assets binding) are free and unlimited, but every request matching `run_worker_first`, so every `/img/*` icon, runs the Worker and counts toward the Free plan's 100,000 requests a day, after which those requests fail until 00:00 UTC. A Worker runs before Cloudflare's cache, so `Cache-Control: immutable` saves only the second request from the same browser. A player who fills a tab sees most of its cards and H.I.F. abilities in the pickers, and switching 「カードの絵柄」 loads them all again, so a few hundred new players a day could use up the allowance (an estimate, not measured). The allowance is the account's, so every `tia.run` Worker shares it: once it is spent, gakumas-supportcards and gkms-hif-final-stats fail too, until 00:00 UTC (09:00 in Japan). Workers Cache does not help: a request it answers without running the Worker is still billed as a Worker request, and turning it on bills requests for static assets as well. Workers Paid has no daily request limit.
  Evidence: `https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/` ("Requests to static assets are free and unlimited"; with `run_worker_first`, "If you exceed your free tier request limits, these requests will receive a 429 (Too Many Requests) response"), `https://developers.cloudflare.com/workers/platform/limits/` ("Accounts on the Workers Free plan have a daily request limit of 100,000 requests, resetting at midnight UTC. When a Worker exceeds this limit, Cloudflare returns Error 1027"; Paid "No limit"), `https://developers.cloudflare.com/workers/reference/how-the-cache-works/` ("Cloudflare Workers run before the cache"), and `https://developers.cloudflare.com/workers/cache/` ("all requests to your Worker are billed at the standard Workers request rate … whether the response comes from cache or from your Worker"; Workers pricing: with caching enabled, requests to static assets are billed at the standard request rate), read 2026-10-31. The first two pages disagree on the error (429 or 1027).

- Observation: the account's Worker request counts cannot be read with wrangler. Wrangler 4.156.0 has no metrics command (`wrangler tail` streams live logs only), and its login token carries no analytics permission. They are in the Cloudflare dashboard (Workers & Pages, each Worker's Metrics), or in the GraphQL Analytics API with a token the user creates with Account Analytics read.
  Evidence: `bunx wrangler --help` in supportcards, 2026-10-31, lists only `wrangler tail` among commands about running Workers; `bunx wrangler whoami` lists the scopes `account (read)`, `workers (write)`, `workers_scripts (write)`, `workers_tail (read)`, `d1 (write)` and others, none for analytics.

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

- Decision: D33 — a card is identified by its game id and its upgrade level together, `(ProduceCard id, upgradeCount)`; a build's card is that pair (Interfaces and Dependencies), and base and + are two cards of one id, as D7 means. A level-0 card always has customization "none", since the data gives it no options.
  Rationale: the data keeps base and + under one id (Surprises & Discoveries), so the id alone cannot tell them apart.
  Date/Author: 2026-10-31, agent, from the data in Milestone 0.

- Decision: D34 — 「カードの絵柄」 offers the 13 playable P-idols in the game's order (`Character.order`), and its default, D20's "first idol", is 花海咲季 (`hski`). The variants drawn for 根緒亜紗里 (`nasr`), who is not playable, are not offered. D20's fallback to the default idol stays for a future card that lacks a variant.
  Rationale: the game's own order needs no list kept here; every per-idol card in the pool has all 13 today.
  Date/Author: 2026-10-31, agent, from the data in Milestone 0.

- Decision: D35 — the icon rendition is `w112/` (112 pixels wide, twice the 56 px icon), each file named as the game names the asset with `.webp` in place of `.unity3d`: `w112/img_general_skillcard_<…>.webp` for a single image, `w112/img_general_skillcard_<…>-<character id>.webp` per idol, beside a lossless master under `master/` as supportcards' ADR 0003 prescribes. If Milestone 1 finds the textures narrower than 112 pixels, the rendition takes their width and its prefix is renamed to match before anything is published. The diamond and rainbow cells use the CSS stand-ins of Artifacts and Notes. (The page draws icons from sprite sheets built from these files, D42.)
  Rationale: one rendition serves both the 56 px card icon and the 24 px H.I.F. ability box on phone screens of twice the density; the game has no standalone tier texture (Surprises & Discoveries).
  Date/Author: 2026-10-31, agent, from the data in Milestone 0.

- Decision: D36 — D15's buff-type sort orders a section by the card's guide category label, the labels in the order they first appear in `ProduceGuideProduceCardCategory.yaml`. A card under two labels sorts by the first of them, and a card in no category sorts after all labelled cards, together with those labelled その他のスキルカード.
  Rationale: the guide categories cover 75 of the 209 pool cards (Surprises & Discoveries); this keeps the user's choice of the game's own categories and gives every other card one place. Agent's default, to confirm with the user when Milestone 4 is shown; the alternative is the game's effect groups, which every card has but usually several of.
  Date/Author: 2026-10-31, agent, from the data in Milestone 0.

- Decision: D37 — a memory's skill card is a base or a + card only; the data's ++ and +++ levels (`upgradeCount` 2 and 3) are never offered.
  Rationale: the user's statement of the game's rule.
  Date/Author: 2026-10-31, user, answering Milestone 0.

- Decision: D38 — Legend cards (`ProduceCardRarity_Legend`), both the 15 plan cards and the 13 一番星 cards, are not in the pool.
  Rationale: the user's statement that they cannot be a produce memory.
  Date/Author: 2026-10-31, user, answering Milestone 0.

- Decision: D39 — a card's customization limit counts steps: the steps of every kind chosen, added up, may not exceed the card's `maxCustomizeCount`, and a produce memory caps that sum at 2 whatever the card's limit. So ファンサ+ (limit 3) can take パラメータ+ at step 2 alone, or 好調追加 and 絶好調追加, or one of them with パラメータ+ at step 1, but not パラメータ+ at step 3. This refines D7, which did not say whether the limit counted kinds or steps.
  Rationale: the user's statement of the game's rules, the cap of 2 being the current rule for produce memories; it is kept as one constant beside D40's so a change of the game's rule is one edit.
  Date/Author: 2026-10-31, user, answering Milestone 0.

- Decision: D40 — 開幕時獲得 (whether the memory's card is acquired at the start) is part of the build, so a build is (skill card, customization, 開幕時獲得, H.I.F. ability) and the same card and customization with and without 開幕時獲得 are two rows. Which cards can have it, and with how much customization, is one table of customization caps that apply while 開幕時獲得 is on: a base card (level 0, any rarity) 0, an R + card 2 (D39's cap), an SR + card 0; a card the table does not list (an SSR or N + card) cannot have 開幕時獲得. A new row's 開幕時獲得 is on wherever the card can have it. On a base card it is always on; on an R or SR + card the player may switch it off. Choosing a customization whose steps exceed the cap switches 開幕時獲得 off by itself, and 開幕時獲得 can be switched on only while the customization fits the cap, so today an SR build is customized or 開幕時獲得, never both. Base cards have no customization options in the data, so their cap only matters if that changes. The table is not in the game tables read in Milestone 0; it is a named constant in this app, beside D39's cap, so that a change of the game's rule (SR's cap rising above 0, say) is one edit and no code. This entry replaces the first version of D40, written when the agent read the user's "N" as the N rarity; the user meant the base card.
  Rationale: the user's statement of the game's current rules, given while answering Milestone 0, and the user's recommendation to express the 開幕時獲得 rule as a customization-steps cap rather than as "customized or 開幕時獲得", since SR's exclusion may be lifted; and the user's answer that a base card's memory is always 開幕時獲得 while an SR card's can be switched off by hand as well as by customization.
  Date/Author: 2026-10-31, user.

- Decision: D41 — D29 is settled: the counts and the per-player daily cap both live in Cloudflare D1, on the Workers Free plan the `tia.run` account is on, with no KV. The cap row is an upsert whose `n = n + 1` only applies while `n` is under the cap, so it cannot be overshot; a daily Cron Trigger deletes the past days' cap rows; `GET /counts` is cached for an hour to keep D1 reads low. This replaces D23's KV cap.
  Rationale: chosen by the user from the comparison of five options (D1 only; KV cap and D1 counts on the Free or the Paid plan; Analytics Engine; no counting): it costs nothing, the cap is exact, and it keeps one store; the estimate is about 5 D1 rows written per row created against 100,000 a day, to be measured with D1's `meta.rows_written` in Milestone 6.
  Date/Author: 2026-10-31, user.

- Decision: D42 — the page draws skill card icons from sprite sheets, one per plan and playable idol, each holding every icon that plan's tab offers, with an index that names each cell, built by supportcards' image pipeline from the single `w112/` icons (Interfaces and Dependencies). This app's Worker serves the sheets and the index only. The single icons stay in the bucket as the sheets' source and the unit supportcards' upload checks, and are not loaded by the page.
  Rationale: on the Free plan every image the Worker serves counts toward the account's 100,000 requests a day, shared by every `tia.run` Worker (Surprises & Discoveries); a player filling the three tabs would cost about 200 requests in single icons and about 3 in sheets, plus 3 per change of 「カードの絵柄」. Chosen by the user over single icons with measurement and over Workers Paid.
  Date/Author: 2026-10-31, user.

## Outcomes & Retrospective

Nothing yet; the plan has not started.

## Context and Orientation

The repository `~/Developer/gkms-memomemo` (GitHub `tia-tools/gkms-memomemo`) holds, at the start of this plan, only the project template: `CLAUDE.md`, `docs/PLANS.md`, `docs/adr/README.md`, `docs/adr/0001-skill-card-data-and-art-come-from-gakumas-supportcards-at-runtime.md` and this plan. There is no code yet.

Terms used throughout, in plain language:

A produce is one run of raising an idol in the game. At the end the player can save a memory. A game memory holds two different things: a stage memory (the skill cards and stats used in contests) and a produce memory. A produce memory is the part that lets the player carry one skill card into a later produce; it has that skill card, possibly a customization of it, an H.I.F. ability if it was made in the H.I.F. scenario, and three stat abilities, one each for Vo (vocal), Da (dance) and Vi (visual). In this plan "memory" always means the produce memory.

A stat ability raises one stat at the start of the next produce, either as a percentage growth bonus (written % here; the game's `*_growth_rate_addition`) or as a fixed initial bonus (written F; the game's `initial-*_addition`). Its quality, called tier here, is diamond (the game's UR rarity: 3.5% or +25) or rainbow (SSR: 2.8% or +20). A pattern is the kind of each of the three abilities in Vo, Da, Vi order, so %%F means Vo%, Da%, Vi fixed. A group is the column of one pattern in a row; a memory is one line of three cells in a group.

A plan is one of the game's three training styles: センス (sense), ロジック (logic), アノマリー (anomaly). Each has two sub-styles, which are the sections of its tab, plus a third section 共通 for builds the player uses with both: センス has 好調, 集中 and 共通; ロジック has やる気, 好印象 and 共通; アノマリー has 強気, 全力 and 共通. The section 共通 is not the game's "free" (共通) skill cards; any section may hold any card the tab offers (D8). Use these stable section ids in code and in the count events: `sense.kocho`, `sense.shuchu`, `sense.common`, `logic.yaruki`, `logic.koinsho`, `logic.common`, `anomaly.tsuyoki`, `anomaly.zenryoku`, `anomaly.common`.

A skill card is a card played in the game's lessons and contests. It has a rarity (N, R, SR, SSR), a type (アクティブ or メンタル), a plan (or free), and a base and an enhanced (+) version, which are different cards (in the data, one id at two upgrade levels, D33). A customization (カスタマイズ) changes a card; each card has a few customization kinds, each with steps (for example 強気+ with steps 1–3), and a limit on the steps it can take in all, which a produce memory caps at 2 (D39). 開幕時獲得 marks a memory whose card is acquired at the start; base cards and R and SR + cards can have it, each with a cap on the customization steps it allows (today 0, 2 and 0, so an SR card with it has no customization), and it is on by default (D40). An H.I.F. ability is a memory ability only memories made in the H.I.F. scenario (初星アイドルフェスティバル, `hatsuboshi_idol_festival` in the data) have; each corresponds to one skill card and is drawn with its icon. A build is (skill card, customization, 開幕時獲得, H.I.F. ability); a row is one build (D1, D40).

The sibling repositories, all checked out next to this one under `~/Developer`:

gakumas-supportcards (`https://gakumas-supportcards.tia.run`) generates its data from `vertesan/gakumasu-diff`, a public dump of the game's master tables as YAML files (`ProduceCard.yaml`, `ProduceCardCustomize.yaml`, `MemoryAbility.yaml`, `ProduceSkill.yaml`, `ProduceGuideProduceCardCategory.yaml` and others). Its generators read only the tables they declare in `scripts/lib/tables.ts`, caching each in `.cache/gakumasu-diff/`; the tables this app needs, apart from `ProduceSkill.yaml`, are not among them yet. `bun run generate` writes committed modules (`data/cards.generated.ts` and others), and `bun run build` writes the published `dist/data/cards.v1.json` from those modules through a Vite plugin, so the build itself never reads a YAML table; a daily workflow regenerates the modules and merges them by pull request. Its `scripts/images/` pipeline downloads art from the game's servers through GkmasObjectManager (a GPL-3.0 tool that fetches and decrypts the game's asset manifest and bundles; pinned by commit, never shipped), decodes it, and uploads it to the Cloudflare R2 bucket (object storage) `tia-assets`, served under `/img/…` by each app's own Worker. Each image is stored as a private lossless master under `master/` and a public rendition under a prefix named for its width (`w192/` for support card thumbnails, `w48/` for P-item icons). The upload decides what is missing by sending `HEAD` requests to supportcards' own deployed site, and its Worker answers only those two renditions (Surprises & Discoveries). It already publishes `/data/cards.v1.json` for another app (its ADR 0010). Per ADR 0001 of this repository, it will also publish the data and the art this app needs.

gkms-hif-final-stats (`https://gkms-hif-final-stats.tia.run`) is the closest model for this repository's setup: a Preact page built by Vite with Bun, a Cloudflare Worker (`infra/worker/`) serving the built page plus `/img/*` read-only from `tia-assets` and `/data/cards.json` proxied from supportcards, `check.yml` and `deploy.yml` workflows, `oxlint.config.ts`, and tests that pin the workflows' and `wrangler.toml`'s shape. Copy from it rather than inventing.

A Cloudflare Worker is a small server program run by Cloudflare at the domain; `wrangler` is its command-line tool and `wrangler.toml` its configuration. D1 is Cloudflare's SQLite database service; KV is its key-value store, whose keys can expire on their own.

## Plan of Work

Milestone 0 settles the facts. Everything later depends on what the game data actually says, and parts of this design were stated by the user from the game's screens rather than read from the data. Work in a scratch directory under `$TMPDIR`, fetching the YAML tables from `https://raw.githubusercontent.com/vertesan/gakumasu-diff/main/<Table>.yaml` (supportcards' cache holds only `ProduceSkill.yaml` of them). Find and write down, with evidence snippets in Surprises & Discoveries: which fields of `ProduceCard.yaml` give a card's plan, rarity, type, base or enhanced state, source (produce, P-idol unique, support card event, starter), release, customization options and customization limit, and whether a mark exists for "can be a produce memory" (D8); how a customization kind and its steps appear in `ProduceCardCustomize.yaml` and where their Japanese labels come from; how each of the 115 H.I.F. abilities in `MemoryAbility.yaml` leads to its one skill card and to its plan; what the eight `MemoryAbility.yaml` entries per stat ability kind are, and whether diamond = UR and rainbow = SSR holds for all three stats; how the game's guide categories in `ProduceGuideProduceCardCategory.yaml` and its group table map to plans; and, through GkmasObjectManager's manifest, how a skill card's icon asset is named per P-idol, whether every SR and SSR card has one per idol, and which asset the game uses for the diamond and rainbow ability backgrounds; and the game's own order of the P-idols, so that "the first idol", D20's default, names one idol from the data. Choose the icon rendition: its pixel width (the card icon shows at 56 px and the H.I.F. ability box at 24 px, so twice 56 for sharp phone screens is the starting point), its bucket prefix in the `w<width>/` scheme, and its file name per idol variant, as the game names the asset. Settle D29: compare ways of counting and capping count events against the Cloudflare plan the `tia.run` account is actually on (find out which; Surprises & Discoveries gives the free-plan limits), for example keeping the per-day cap in D1 beside the counts, a cap of a different shape, or no counting at all, and record the choice as a decision with its cost. The milestone ends with a requirements section added to this plan's Interfaces and Dependencies, stating what `skillcards.v1.json` must contain, which images `tia-assets` must hold under which prefix and names, and that supportcards' Worker must serve that prefix for its upload to see what is missing, written so a session in gakumas-supportcards can work from it alone; and with Milestone 6 rewritten to the counting decision. Acceptance: every question above has an answer with evidence in this plan, or is recorded as unknown with the fallback chosen, and D29 has its decision.

Milestone 1 happens in gakumas-supportcards, following that repository's own `CLAUDE.md` (which may require its own ExecPlan) and its ADR 0010 for published files and ADR 0003 for images. The session working it follows the way `cards.v1.json` is made (Context and Orientation): it declares the tables Milestone 0 names in `scripts/lib/tables.ts`, with only the fields read; adds a generator that `bun run generate` runs, writing a committed module beside `data/cards.generated.ts`; and adds a build plugin that writes `dist/data/skillcards.v1.json` from that module, published at `https://gakumas-supportcards.tia.run/data/skillcards.v1.json`, so the daily workflow's data pull request carries new skill cards as it carries new support cards. It extends `scripts/images/extract.py` and `upload.py` to extract every pool card's icon in every idol variant into `tia-assets` under the rendition and names Milestone 0 chose, with masters under `master/` as its ADR 0003 prescribes; builds from them the sprite sheets and their index (D42), rebuilding a sheet when the icons it holds change; and widens its Worker's `img.ts` path pattern to the single icons and the sheets, so that the upload's `HEAD` requests see what is already there and the daily job fetches only what is missing. The work goes to a pull request into supportcards' `develop`, reviewed by the user. Acceptance: after supportcards deploys, `curl -s https://gakumas-supportcards.tia.run/data/skillcards.v1.json | head -c 300` shows the file with its `formatVersion`, `curl -s https://gakumas-supportcards.tia.run/img/sheet112/index.v1.json` lists 39 sheets, and a HEAD request for one sheet it names answers 200.

Milestone 2 creates this repository's skeleton by copying gkms-hif-final-stats: `package.json` (renamed), `tsconfig.json`, `vite.config.ts`, `oxlint.config.ts`, the Tailwind entry, `index.html` titled 「学マス　メモリーメモ帳」, `src/main.tsx` rendering a placeholder, `infra/worker/` with `worker.ts`, `img.ts` and a data proxy for `/data/skillcards.json` (fetching supportcards' file server-side and caching it for an hour, as hif-final-stats' `data.ts` does for cards), `wrangler.toml` for `gkms-memomemo.tia.run` (its `run_worker_first` naming `/img/*` and `/data/skillcards.json`), the workflows `check.yml` and `deploy.yml`, and their shape tests. The copied `img.ts` answers only support card thumbnails and P-item icons (Surprises & Discoveries); change its path pattern to the sprite sheets and their index (D42; Interfaces and Dependencies) and nothing else, so `master/`, the single icons and every other path stay a 404, give the index the data file's one-hour cache instead of `immutable`, and change its test to match. In `src/data/`, copy the data file's types from supportcards verbatim into `contract.ts`, write `load.ts` that checks a whole file against them and refuses it with the path of the first bad value, and commit a copy of the real file as `src/data/fixtures/skillcards.v1.json` for the tests. The dev server answers `/data/skillcards.json` from a sibling supportcards build if present, else from the fixture, and `/img/*` from supportcards' local `scripts/images/out/` if present, else 404. Acceptance: `bun test`, `bun run type-check`, `bun run lint` and `bun run build` exit 0, and `bun run dev` serves a page that lists the number of cards the data file holds.

Milestone 3 writes the memo model as pure TypeScript in `src/memo/`, one module per rule, each with a co-located test: the types (see Interfaces and Dependencies); `build.ts` (a build's canonical key, with customization pairs sorted so that the same set always gives the same key, and its validity: customization steps adding up to no more than the card's limit and D39's cap of 2, 開幕時獲得 only on the cards D40's table lists and only with customization within that card's cap, the memory cap and the table being named constants); `edit.ts` (add a row at a section's end refusing a build already in the tab and naming its section, change a row's build under the same check, move a row to another section's end, reorder rows by drag, delete a row, add a memory to a group, change and delete a memory, add an extra group with a pattern not already in the row and at most two extras, and drop an extra group when its last memory goes, D27); `sort.ts` (the four sort keys of D15 as a stable sort of one section, returning the new order so the caller can offer undo); `coverage.ts` (for each row, the count per fixed pattern and the owned extra patterns, feeding the 早見表 and the 「未所持がある行だけ表示」 toggle); `values.ts` (the value a cell shows from kind and tier); and `code.ts` (the 引き継ぎコード: the memo as JSON, compressed with the browser's `CompressionStream("deflate-raw")`, encoded as base64url and prefixed `mm1.`; decoding checks the prefix, the format and the shape of every id, and refuses with a reason rather than importing part of a memo; a well-formed id missing from the data file is kept, D31). The model takes card, customization and H.I.F. ability ids as plain strings and needs no data file except where `sort.ts` reads a card's rarity, type and guide category, so this milestone can be worked while Milestone 1 is in review in supportcards, with a hand-written stand-in for those card fields until the fixture exists. Acceptance: the tests pass and each new test was seen to fail when its rule was broken.

Milestone 4 builds the page in `src/app/` with Preact and Tailwind, phone first (D17): the three tabs; per tab the folded 早見表 (D9) and the 「未所持がある行だけ表示」 toggle; per section a header with the three fixed patterns' column labels and the 追加 column, the rows, and 「＋ カードを追加」; per row the card icon with its name, the H.I.F. ability icon and the customization labels under it, the 「⋯」 menu (D19), a drag handle, the groups with stacked memories, the 未所持 blocks, the 「＋」 strips and the 追加 area; the in-place memory popover (D18) and the three-step row popover (D19) with search, whose customization step also offers 開幕時獲得, on by default, for the cards D40's table lists (fixed on for a base card), and enforces D39 and D40 as choices are made (a customization beyond the card's 開幕時獲得 cap switches 開幕時獲得 off, and 開幕時獲得 cannot be switched on while the customization exceeds it), and the row's 開幕時獲得 drawn as a label beside its customization; the sort button with its keys and the brief undo (D15); the two-tap delete with its arming animation (D4, D19); and a settings area with 「カードの絵柄」 (D20) and the counting note and switch (D12, wired in Milestone 6). Icons are cells of the sprite sheets, drawn as CSS backgrounds positioned from the sheet index, and an icon the index lacks is drawn as the card's name (D42). A row whose ids are not in the data file is drawn as unknown and keeps its memories, menu and delete (D31). Cells use the textures from `tia-assets` if Milestone 0 found them, otherwise the CSS gradients described in Artifacts and Notes. Acceptance: the scenario in Purpose works in `bun run dev` on a phone-sized window (390 px wide) and on a desktop, checked in a browser; component tests cover the popovers' rules (追加 disabled until three tiers are chosen, the duplicate refusal, two-tap delete).

Milestone 5 makes the memo last. `src/app/storage.ts` saves the whole memo in IndexedDB after every change (debounced so a burst of edits is one write) and asks `navigator.storage.persist()`; the page loads it at start. A web app manifest and a small service worker make the page installable and usable offline: it keeps the page, the last `/data/skillcards.json` and sheet index it fetched, and every sprite sheet the page has shown (D32, D42); the settings area suggests 「ホーム画面に追加」 to iPhone Safari users, saying why (Surprises & Discoveries). The 引き継ぎコード UI shows the code with a copy button and the link (D28); opening a link with `#import=` or pasting a code asks for confirmation, replaces the memo, keeps the previous one for an undo, and removes the fragment from the address bar. Acceptance: a memo entered, reloaded, and exported on one browser profile and imported in another is identical, and the undo brings back what was there before; the installed page, opened again with the network off, shows the memo with its icons.

Milestone 6 adds the counts, all in D1 (D41). A numbered migration creates two tables: `counts (section, kind, id, n)` with primary key `(section, kind, id)`, where `kind` is `card`, `hif` or `customization` and the id of a card carries its level (`p_card-01-act-3_029:1`); and `caps (key, day, n)` with primary key `key`. In the Worker, `POST /count` accepts `{ section, card, upgrade, hif, customization }` (customization a list of `kind:step` strings, empty for none), checks the section against the nine ids and the card at that level, the H.I.F. ability and each customization step against the data file the Worker holds for `/data/skillcards.json` (D30), and refuses bodies over 1 KB. It refuses with 503 while the secret salt `HASH_SALT` is not set. Otherwise it computes the client's key, a truncated SHA-256 of its IP (`CF-Connecting-IP`), the UTC day and the salt (without the salt an IPv4 address's key could be brute-forced; supportcards' `infra/worker/feedback.ts` does the same), and upserts its cap row so that `n` rises only while it is under the cap (start at 200 events per day), reading back whether it rose (`RETURNING`); if it did not, the answer is 429 and nothing is counted. Then one D1 batch adds 1 to each `(section, kind, id)` row with an upsert. Log `meta.rows_written` of both steps in the tests' fake and once against a local D1, and record the real figure in Surprises & Discoveries beside D41's estimate. A daily Cron Trigger deletes `caps` rows of past days. `GET /counts` returns every count grouped by section and kind, built from one query and cached through the Cache API for an hour. The page sends the event when a row is created, unless the player switched counting off, and never retries in a way that could double-count; the card and H.I.F. ability pickers order each block by the section's counts, ties and zero counts falling back to the game's order. Acceptance: Worker tests with a fake D1 show the upserts, the exact cap (the 201st event of a day is refused and counts nothing), the validation and the cleanup; with `wrangler dev` and a local D1, creating rows changes `GET /counts` and the picker order.

Milestone 7 releases. Following `infra/worker/README.md` (written in Milestone 2 from hif-final-stats' README), create the D1 database, put its id in `wrangler.toml` with the daily Cron Trigger, apply the schema migration, set the Worker secret `HASH_SALT` to a long random value (`bunx wrangler secret put HASH_SALT`; never committed, never printed), store the Cloudflare API token as the repository secret the deploy workflow reads, merge `develop` into `main` through a pull request, and watch `deploy.yml` deploy. Acceptance: `https://gkms-memomemo.tia.run` serves the page, the scenario in Purpose works there on a real phone, `/img/…` answers an icon, `/data/skillcards.json` answers the data, and a row created there appears in `GET /counts`.

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

Dependencies are those of gkms-hif-final-stats (see its `package.json`): `preact`, and for development `vite`, `@preact/preset-vite`, `tailwindcss` with `@tailwindcss/vite`, `typescript` 7, `oxlint` with `oxlint-tsgolint`, `@types/bun`, `@happy-dom/global-registrator`. No new runtime dependency without asking the user. The Worker uses Cloudflare's D1, R2 and Cache APIs and a Cron Trigger through `wrangler` (no KV, D41).

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
    export interface CustomizationStep { kind: string; step: number }   // ProduceCardCustomize id, its customizeCount
    export interface Build {
      card: string;                                         // ProduceCard id
      upgrade: number;                                      // its upgradeCount: 0 base, 1 + (D33)
      customization: readonly CustomizationStep[];          // empty for なし; steps add up to at most 2 (D39)
      kaimaku: boolean;                                     // 開幕時獲得 (D40)
      hif: string;                                          // MemoryAbility id of the H.I.F. ability
    }
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

### What gakumas-supportcards must provide (Milestone 1)

This section is written so that a session in gakumas-supportcards can work from it alone. The facts behind it, with their evidence, are in Surprises & Discoveries; the pool follows D8, D37 and D38. This app applies D39's and D40's rules itself from `rarity` and `customization`, so they need nothing more in the file.

The data file is `https://gakumas-supportcards.tia.run/data/skillcards.v1.json`, published under supportcards' ADR 0010 (the format version in the file and in its name; any change of shape bumps both). Like `cards.v1.json`, `bun run build` writes it from a committed module that `bun run generate` produces from the `vertesan/gakumasu-diff` tables `ProduceCard`, `ProduceCardCustomize`, `ProduceCardGrowEffect`, `ProduceDescriptionProduceCardGrowEffect`, `MemoryAbility`, `ProduceSkill`, `ProduceGuideProduceCardCategory` and `Character`. It holds:

- `formatVersion`: 1.
- `idols`: the playable P-idols (`Character.isPlayable`) in the game's order (`Character.order`), each `{ id, name }`, for example `{ "id": "hski", "name": "花海咲季" }`.
- `cards`: every card in the pool, one entry per `(id, upgradeCount)`. The pool is every released card (`viewStartTime` "0" or not later than the build) at upgrade levels 0 and 1, except P-idol unique cards (`searchTag` `idol-unique`), support-card event cards (`originSupportCardId` set), starter cards (`searchTag` `starter`), trouble cards (`category` `ProduceCardCategory_Trouble`) and Legend cards (`ProduceCardRarity_Legend`). The one exception to the starter rule is 表現の基本 (`p_card-00-men-0_003`), whose level 0 is in the pool. Levels 2 and 3 (++ and +++) are never in it. On 2026-10-31 that is 181 cards at level 0 and 180 at level 1. Each entry has:
  - `id` and `upgrade` (`upgradeCount`), and `name` as the game writes it at that level (成就+);
  - `plan`: `sense`, `logic`, `anomaly` or `free` (from `ProducePlanType_Plan1`, `Plan2`, `Plan3` and `Common`);
  - `rarity`: `N`, `R`, `SR`, `SSR` or `Legend`, and `type`: `active` or `mental`;
  - `order`: the game's `order` string, for sorting in the game's order;
  - `guideLabels`: the labels of the guide categories whose `produceCardIds` hold the card's id, in the order the categories are listed, without repeats, possibly empty;
  - `art`: `{ asset, perIdol }`, with `asset` the card's `assetId` (`img_general_skillcard_act-3_029`) and `perIdol` its `isCharacterAsset`;
  - `customization`: `{ limit, kinds }`, with `limit` the card's `maxCustomizeCount` and `kinds` its `produceCardCustomizeIds` in order, each `{ id, steps }`, and each step `{ step, label }`: `step` its `customizeCount`, and `label` its `description` if set, else the `produceCardCustomizeDescription` of its first grow effect's type in `ProduceDescriptionProduceCardGrowEffect`. Level 0 has `{ limit: 0, kinds: [] }`.
- `hifAbilities`: every H.I.F. ability (`MemoryAbility` rows with `produceGroupIds` `[produce_group-003]`) whose card is released, each `{ id, card }`. `id` is the `MemoryAbility` id, and `card` the `ProduceCard` id found in its skill's effect id, `p_effect-exam_status_enchant-enchant-p_ef-hif_memory-<card id>-enc02`; no structured field names it. The generator fails, naming the ability, when an id does not match that form or names a card that is not in the pool. An ability's plan is its card's plan.

The images are skill card icons in the shared R2 bucket `tia-assets`, extracted by supportcards' `scripts/images/` pipeline from the game's own bundles (never from a third party, D20b), only for cards in the pool, so that art and data appear together:

- For each card id in the pool, the bundle `<assetId>.unity3d` when `isCharacterAsset` is false, and `<assetId>-<idol id>.unity3d` for each playable idol when it is true; 1,693 icons on 2026-10-31 (126 cards × 13 idols and 55 single images).
- Each stored as a lossless master `master/<asset name>.webp` and a public rendition `w112/<asset name>.webp`, 112 pixels wide, where `<asset name>` is the bundle's name without `.unity3d` (D35). If the textures are narrower than 112 pixels, the rendition takes their width and its prefix is renamed to match before anything is published.
- supportcards' Worker `img.ts` must answer `w112/` icons, as it answers `w192/` and `w48/` today, so that `upload.py`'s `HEAD` requests see which icons are already stored and the daily job fetches only the missing ones. The asset names seen in the pool have the form `img_general_skillcard_(act|men|ido)-<digits>_<three digits>`, with `-<four letters or digits>` per idol.

The page does not load those single icons; it loads sprite sheets built from them (D42), so that a player costs a handful of Worker requests rather than hundreds:

- One sheet per plan (`sense`, `logic`, `anomaly`) and playable idol, 39 today: a WebP grid of 112 × 112 cells (the width D35 settles) holding the icon of every card id the plan's tab offers, that is the plan's pool cards and the free ones, in the chosen idol's variant where the card has variants and its single image where it does not. A single image and a free card therefore appear in several sheets. The cells follow the cards' game `order`. Lossy WebP is expected; the quality is chosen in Milestone 1 so that a sheet stays near or under half a megabyte, and the sizes are recorded.
- Each sheet is stored under `sheet112/<plan>-<idol id>-<first 8 hex digits of the SHA-256 of its bytes>.webp`, so a name never changes meaning and can be served as immutable. A sheet is rebuilt, under its new name, whenever the icons it holds change.
- An index `sheet112/index.v1.json` lists every current sheet: `{ "formatVersion": 1, "cell": 112, "sheets": [{ "plan": "sense", "idol": "hski", "file": "sheet112/sense-hski-1a2b3c4d.webp", "columns": 10, "assets": ["img_general_skillcard_act-3_029-hski", …] }, …] }`, where `assets` names the cell contents in order (asset names as in the single icons), so the page finds an icon's cell by name and never by assuming an order. The index is uploaded after the sheets it names, so it never names a sheet that is not stored yet; sheets it no longer names may be deleted a day later.
- supportcards' Worker serves `sheet112/` too, so that the pipeline can tell with a `HEAD` request which sheets are already stored. How it decides that a sheet must be rebuilt (for example by comparing the index it would write with the stored one) is that repository's design.

This app's Worker serves `/img/sheet112/<plan>-<idol id>-<8 hex digits>.webp` (immutable) and `/img/sheet112/index.v1.json` (cached for an hour, like the data file) from the bucket, and nothing else (Milestone 2). The page builds each icon from `art`, the idol chosen in 「カードの絵柄」 (D20, D34) and the index: the cell of `<asset>-<idol id>` (or `<asset>` for a single image) in the sheet of the tab's plan and that idol. An icon missing from the index (a card released before its art was extracted) is drawn as the card's name, as supportcards' table does.

Revision note, 2026-10-31: first draft, written at the end of the /grill-me design session from its decision log, before any code; Milestone 0 is the next step.

Revision note, 2026-10-31: the plan was reviewed against gakumas-supportcards, gkms-hif-final-stats and the upstream tables before any work, and the findings folded in at the user's request. Context and Orientation and Milestone 1 now describe supportcards' data pipeline as it is (only declared tables cached, a committed generated module, the published file written by a build plugin), where before they said the file was built from the cached tables. Milestones 0, 1 and 2 now cover the skill card icon rendition and the Workers that must serve it, because both Workers answer only support card thumbnails and item icons and supportcards' upload checks its own site. Milestone 0 also defines D20's "first idol" and settles D29, the counting approach reopened for cost. D30 validates count events against the data file, D31 keeps rows whose ids left the data file (replacing the rule that the 引き継ぎコード decoder checks every id against the data file), and D32 says what the service worker keeps. Milestones 6 and 7 carry `HASH_SALT` and a note that they change with D29. `FixedPattern` and `ExtraPattern` are added to the types so an extra group cannot hold a fixed pattern. Milestone 3 says it can run while Milestone 1 is in review. Three observations were added to Surprises & Discoveries, and the Progress line now names D26–D28.

Revision note, 2026-10-31: Milestone 0's reading of the game data and the asset manifest added to Surprises & Discoveries, with the agent's defaults D33–D36 (a card is its id and upgrade level, the idol list and default, the `w112/` icon rendition, the buff-type sort). `Build` gained `upgrade`, and the draft of what supportcards must provide replaced the placeholder in Interfaces and Dependencies. Four questions for the user are listed in Progress; the milestone stays open until they are answered.

Revision note, 2026-10-31: the user's answers recorded as D37 (no ++ or +++), D38 (no Legend cards), D39 (the limit counts steps, capped at 2 in a memory) and D40 (開幕時獲得 is part of the build, with its rarity rules). Context and Orientation, Milestones 3 and 4, `Build` (`kaimaku`) and the supportcards requirements follow them; the requirements no longer have open points. An observation on the Workers Free plan's daily request limit was added, because the icons meet it before the counts do. D29 stays open: the user asked for the counting options compared in a table first.

Revision note, 2026-10-31: D40 rewritten after the user's correction ("N" meant the base card; 開幕時獲得 is on by default and is expressed as a customization-steps cap per kind of card), with the Context, Milestone 3 and Milestone 4 text that follows it. D41 settles D29 (everything in D1 on the Free plan), and Milestones 6 and 7 were rewritten to it, without KV. The Free-plan observation gained that the request allowance is shared by every `tia.run` Worker and that Workers Cache does not lift it; icon delivery is a new open point of Milestone 0, and `CLAUDE.md`'s overview now cites D41.

Revision note, 2026-10-31: D40 completed with the user's answer: a base card's 開幕時獲得 is always on, and an R or SR + card's can be switched off by hand; Milestone 4 follows it.

Revision note, 2026-10-31: D42 records the user's choice of sprite sheets for icons, and the supportcards requirements, Milestones 1, 2, 4 and 5 and D35 follow it; an observation records that wrangler cannot read the account's request counts. Milestone 0 is complete; Milestone 1 is next, in gakumas-supportcards.
