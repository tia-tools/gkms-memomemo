-- The anonymous counts that rank the pickers, and the per-player daily cap on count events
-- (docs/plans/EXECPLAN_MEMORY_MEMO.md, Milestone 6, decisions D11 and D41). Applied with
-- `wrangler d1 migrations apply`, which skips a migration already applied; never edit this file
-- once it is applied anywhere: a change is a new numbered file.
--
-- Both tables are WITHOUT ROWID: the primary key is then the table itself, so a new row is one row
-- written in D1's billing, not two (the row and its key's index), measured on a local D1
-- (the plan's Surprises & Discoveries).

-- One count per section, kind and id. `kind` is card, hif or customization. A card's id carries
-- its level (p_card-01-act-3_029:1), a customization's its step (p_card_custom-…:1), or is `none`
-- for a row with no customization.
CREATE TABLE counts (
  section TEXT NOT NULL,
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (section, kind, id)
) WITHOUT ROWID;

-- One row per player and UTC day: `key` is a truncated SHA-256 of the player's network, the day
-- and a secret salt, so no IP address is stored; `n` is the events counted that day. The daily
-- Cron Trigger deletes the rows of past days.
CREATE TABLE caps (
  key TEXT NOT NULL PRIMARY KEY,
  day TEXT NOT NULL,
  n INTEGER NOT NULL
) WITHOUT ROWID;
