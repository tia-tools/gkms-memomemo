---
status: accepted
---

# The anonymous counts and their per-player daily cap live in D1, on the Workers Free plan

The page ranks its pickers by what players choose. Each row created sends one event, which adds 1 to its card, H.I.F. ability and customization in its section. Both the counts and the per-player cap that keeps one person from pushing a card up live in one Cloudflare D1 database (`gkms-memomemo`, bound as `DB`), with no KV, on the Free plan the `tia.run` account is on.
- **The cap** is one upsert per event whose `n` rises only below 200 a day, so it is exact. Its key is a truncated SHA-256 of the player's network (an IPv6 address by its /64), the UTC day and the Worker secret `HASH_SALT`, so no address is stored. A daily Cron Trigger deletes past days' rows.
- **Events** are checked against the skill card data file through the page's own rules before they take a place. An event from another site's page is refused.
- **`GET /counts`** is kept an hour by the Worker's cache.

The alternatives were compared in a table of five. A KV cap with D1 counts would meet the Free plan's 1,000 KV writes a day within one busy あさりゼミ evening. Either store on Workers Paid starts at $5 a month. Workers Analytics Engine would answer `GET /counts` through SQL queries limited to 10,000 a day, and keeps data only three months. The fifth option was no counting. The cost of this choice:
- D1's Free allowance of 100,000 rows written a day. A counted event writes 4 rows, or 5 with two customization steps (measured), so it allows some 20,000 to 25,000 rows created a day across all players.
- Every `/count` and `/counts` request is also one of the account's 100,000 Worker requests a day, which every `tia.run` Worker shares.

Moving to another store, or to Paid, means migrating the counts and changing the Worker's cap.

Source: the user's decision D41, from the comparison of five options, with the agent's details D63 (what an event must name, other sites' pages, IPv6 by /64) and D64 (`WITHOUT ROWID`, the answer's cache), all recorded in `docs/plans/EXECPLAN_MEMORY_MEMO.md` § Decision Log. Evidence level: rows written measured on a local D1 (§ Surprises & Discoveries, Milestone 6), and live since 2026-11-01. The user's first row was counted in production and read back through `GET /counts` (Milestone 7, #43).
