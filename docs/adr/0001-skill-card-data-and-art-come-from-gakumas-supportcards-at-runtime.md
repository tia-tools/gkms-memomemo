---
status: accepted
---

# Skill card data and art come from gakumas-supportcards at runtime

This app needs the game's skill cards (with their customizations, the H.I.F. memory abilities that point at them, the guide categories, and which cards are released and can be a produce memory) and each card's icon in every P-idol's variant. Neither is built here. The sibling gakumas-supportcards extends its existing pipeline to produce both: it generates a second versioned data file from `vertesan/gakumasu-diff` under its own contract rules (its ADR 0010), and its image pipeline (pinned GkmasObjectManager, the Unity-version fallback in `decode.py`, master-first upload, a daily job that fetches only what is missing) extracts the icons into the shared R2 bucket `tia-assets`. This app's Worker proxies the data file and only reads the bucket, as gkms-hif-final-stats already does for support cards (its ADR 0001). The alternative was a pipeline of this app's own, which would duplicate the decoder that a game update has already broken once, and would have to agree across repositories with supportcards on which cards are released, since art may only be published for released cards. The cost is that supportcards holds data and assets it does not display, that a format change goes through its contract versioning, and that this project's first milestone is a pull request in supportcards.

Source: user decisions D21 and D22 in the /grill-me session of 2026-10-31, recorded in `docs/plans/EXECPLAN_MEMORY_MEMO.md` § Decision Log; evidence level: user decision, the supportcards pipeline described from its `scripts/images/README.md` as read in that session.
