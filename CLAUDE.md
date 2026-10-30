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

- `docs/adr/0001-skill-card-data-and-art-come-from-gakumas-supportcards-at-runtime.md` — **accepted**: the skill card data file and the card icons (every P-idol variant) are produced by the sibling gakumas-supportcards' pipeline into its published data and the shared R2 bucket `tia-assets`; this app's Worker proxies the data and only reads the bucket, and nothing is built or copied here.

## Project Overview

「学マス　メモリーメモ帳」 (`gkms-memomemo.tia.run`) is a public web page where 学園アイドルマスター players keep a memo of the produce memories they own for the H.I.F. scenario, because the game's own memory list makes it hard to see what is owned and what is still missing while preparing in the あさりゼミ event. A produce memory is the part of a game memory that carries a skill card into the next produce, not the stage memory beside it. The page has one tab per plan (センス / ロジック / アノマリー), each with three sections (the plan's two styles and 共通); a row is one build — skill card, customization and H.I.F. ability — and holds the memories of that build as Vo/Da/Vi ability groups (%%F, %F%, F%%, plus up to two extra patterns), each cell diamond or rainbow, with a folded 早見表 showing which patterns are owned and missing. The memo stays in the player's browser; anonymous per-section counts of what players choose rank the pickers, and the card data and art come from gakumas-supportcards at runtime (per `docs/plans/EXECPLAN_MEMORY_MEMO.md`, decisions D1–D28, and `docs/adr/0001`).

## Architecture

<!-- Describe the high-level structure: key directories, how components relate, data flow. Name the main entry points. -->

## Setup and Development

<!-- How to install dependencies, configure the environment, and run the project locally. Include exact commands. -->

## Build and Test

<!-- List the commands to build, test, lint, and format. Show expected output for a clean run. -->

## Code Style

<!-- Language-specific conventions, naming patterns, import ordering, or formatting tools in use. -->

## Tasks

Tasks live on the GitHub board `tia-tools` project `7`; work them with the `task-board` skill. Merges go through PRs into `develop`, the default branch; a PR closes its issue with `Closes #N`.

## Commit Discipline

- Follow Git-flow workflow to manage the branches
- Use small, frequent commits rather than large, infrequent ones
- Only add and commit affected files; leave untracked files as they are
- Never add coding agent attribution in commits

