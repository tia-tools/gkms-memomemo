---
status: accepted
---

# The idols' faces come from supportcards' local masters and are committed here as a static sheet

「カードの絵柄」 is chosen from the idols' SD faces, the small cartoon faces the game uses in its menus (`img_sd_<idol id>_face-00`, the default smile; the game has only that one face per idol). Two choices follow, and they differ from how this app's skill card art is handled under ADR 0002.
- **Where the faces come from:** gakumas-supportcards' extractor pulls them from the game (`cd scripts/images && uv run extract.py --only 'img_sd_'` there), as lossless masters in its local `scripts/images/out/master/` only. They are not uploaded to the bucket, not even to its private `master/` prefix, and nothing serves them. `scripts/icons/idols.py` here builds the sheet from that local library, so rebuilding it needs a supportcards checkout with the faces extracted.
- **Where the sheet lives:** it is committed to this repository as a static file, `public/icons/idols96-<8 hex>.webp` (43 KB), with its index `src/icons/idols.v1.json`. It is not in the shared R2 bucket `tia-assets`, and the Worker has no route for it. A static file costs no Worker request on the Free plan, and the service worker precaches it with the page, so it works offline from the first visit.

The alternatives were a second extractor in this repository (a second copy of code that talks to the game's servers, to keep working when the game changes its format), and the bucket served through the Worker's `/img` route, which the memo plan's D20b ("fetched from the game ourselves and stored in R2") says literally (a Worker route, an upload step, and a Worker request per device). D20b's point, never taking images from a third party, holds either way. The cost of this choice is a game image in git history, replaced in full whenever the faces change, and a dependency on the sibling checkout to rebuild it. Decision T6 of the plan says the faces also go to supportcards' private `master/` prefix in the bucket; they do not, since supportcards' `upload.py` uploads only files with a served rendition.

Source: the user's answers A to jobs #95 (supportcards extracts) and #96 (committed static sheet), and their choice of the SD faces over the round thumbnails, recorded in `docs/plans/EXECPLAN_IDOL_ICON_TABLE.md` § Decision Log (T5–T7); evidence level: user decision, built and verified on the live site after release #99 (the sheet served with its hash, 13 faces drawn); the supportcards side is tia-tools/gakumas-supportcards#83, whose upload path for faces was checked by test and by Codex review.
