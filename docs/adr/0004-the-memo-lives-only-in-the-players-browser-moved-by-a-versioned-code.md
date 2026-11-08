---
status: accepted
---

# The memo lives only in the player's browser, and moves between devices by a versioned 引き継ぎコード

A player's memo is kept in their own browser's IndexedDB and nowhere else: the site has no accounts and stores no memo on its server. A memo moves to another device, or to the iPhone's home-screen page, whose storage is apart from Safari's, through a 引き継ぎコード. That is the memo as JSON, compressed with `deflate-raw` and written in base64url, behind the prefix `mm1.`. Its link carries the code in the URL fragment (`#import=…`), which a browser never sends, so a memo never reaches the Worker or its logs. Importing replaces the memo after a confirmation that counts both memos, keeps the old one for an undo, and never merges. A row whose ids the current data file lacks is kept as it is, so a data change cannot delete what a player entered.

That makes the code a published format. Codes that players have saved or shared must keep decoding: a change of the memo's shape needs a new prefix, or a new `formatVersion` inside, together with a reader that still accepts `mm1.` codes. The alternatives were accounts with a server copy, which would store strangers' data and need sign-in, recovery and deletion, and merging an imported memo with the present one, whose rules for two copies of a row would cost more than they help. The cost is that a lost browser profile loses its memo unless a code was kept. iPhone Safari also deletes a site's storage after seven days without a visit, which the page answers by suggesting the home screen.

Source: the user's decisions D10 (no accounts, nothing personal on a server) and D16 (saved in the browser, moved by a code, replaced and never merged), with the agent's D28 (the fragment) and D31 (unknown ids kept), both accepted by the user, and D46, D57 and D59 (the code's checks and caps, the saving, the page's import), in `docs/plans/EXECPLAN_MEMORY_MEMO.md` § Decision Log. Evidence level: a code moved between two origins with an identical result (Milestone 5), and on a real iPhone from Safari into the home-screen page (Milestone 7, job #47).
