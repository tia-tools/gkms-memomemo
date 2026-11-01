# gkms-memomemo.tia.run Worker

One Cloudflare Worker serves the whole page: the built page as static assets, this app's game-style skill card sprite sheets from the R2 bucket `tia-assets`, read only, gakumas-supportcards' skill card data at this origin, and the anonymous counts that rank the page's pickers, kept in the D1 database `gkms-memomemo` (`docs/adr/0002`; `docs/plans/EXECPLAN_MEMORY_MEMO.md`, decisions D11, D22, D24, D41 and D42; `docs/plans/EXECPLAN_GAME_STYLE_ICONS.md`). The sheets are built and uploaded from a person's machine by the icon pipeline in `scripts/icons/`; the Worker never writes to the bucket. The sheets' index is not served: it is committed as `src/icons/index.v1.json` and bundled into the page. `wrangler.toml` runs the Worker's code only for `/img/*`, `/data/skillcards.json`, `/count` and `/counts` (`run_worker_first`); every other path is answered by the assets directly. Both come from one list, `WORKER_FIRST` in `worker.ts`: `route` answers exactly its paths and sends the rest to the assets, and `wrangler.test.ts` keeps `run_worker_first` equal to it.

That split matters on the Workers Free plan the `tia.run` account is on. Requests answered by the assets are free and unlimited. Every request that runs the Worker counts toward the account's 100,000 a day, which every `tia.run` Worker shares, and past it those requests fail until 00:00 UTC. That is why the page loads a few sprite sheets rather than one image per icon (D42; the plan's Surprises & Discoveries). The page's service worker keeps every sheet it has shown, and answers it from its cache from then on, so a returning player's sheets cost no Worker request; the data file it asks for on every visit, through the browser's hour-long HTTP cache, and keeps the last copy for when there is no network (D58).

| Route | Serves |
|---|---|
| `https://gkms-memomemo.tia.run/` | the page built by `bun run build` (`dist/`) |
| `/img/gkms-memomemo/sheet112/<plan>-<idol id>-<8 hex digits>.webp` | a sprite sheet from `tia-assets`, through `img.ts`, as immutable WebP; its name ends in a hash of its bytes, so it never changes meaning. A matching `If-None-Match` (a list, a weak tag or `*`, for GET and HEAD) is a 304 |
| `/icons/frames112.webp` | the placeholder frames, a static asset from `public/icons/` (no Worker request) |
| `/sw.js` | the service worker, built from `src/sw/` by `bun run build`, a static asset (no Worker request) |
| `/manifest.webmanifest`, `/icons/app-192.png`, `/icons/app-512.png`, `/icons/app-maskable-512.png`, `/icons/apple-touch-icon.png` | the web app manifest and the home-screen icons, static assets from `public/` (no Worker request) |
| any other `/img/` path | a 404 marked `no-store`: gakumas-supportcards' own sheets and index under `sheet112/`, the single icons under `w112/`, the private `master/` prefix and everything else in the bucket are never served |
| `/data/skillcards.json` | gakumas-supportcards' `https://gakumas-supportcards.tia.run/data/skillcards.v1.json`, passed through with an hour's cache; a failure upstream is a 502 marked `no-store` (`data.ts`) |
| `POST /count` | one count event, sent by the page when a row is created: adds 1 to the row's card, H.I.F. ability and customization in its section, under the player's daily cap (`count.ts` `handleCount`; § Counts) |
| `GET /counts` | every count, by section and kind, as JSON cached for an hour (`count.ts` `serveCounts`; § Counts) |

Hostname policy (tia-tools convention): each app lives on its own single-level subdomain of `tia.run`. The zone's free Universal SSL certificate covers no second level.

## Deploy

Deployment is automatic: `.github/workflows/deploy.yml` runs on every push to `main` that touches the page or this directory, and on demand from the Actions tab. It runs the unit tests, the type check, the lint and the build, and deploys only when all of them pass. `main` is production; `develop` is development, and a release is a pull request from `develop` into `main`. The first release is Milestone 7 of the plan.

It needs two repository secrets, set once by a person in the repository's settings (Settings → Secrets and variables → Actions):
- `CLOUDFLARE_ACCOUNT_ID`, the tia-tools account's id;
- `CLOUDFLARE_API_TOKEN`, an **account-owned** API token (dashboard → Manage Account → Account API Tokens, on the account that holds `tia.run`). Being account-owned, it survives any person leaving. Give it the least `wrangler deploy` uses:

| Scope | Permission | Used by |
|---|---|---|
| Workers, scope **Individual Workers**: only `gkms-memomemo` | role **Editor** | the script and the static assets |
| Zone, only `tia.run` | **Workers Routes: Write** | the custom domain in `wrangler.toml`; Cloudflare has no per-Worker role for custom domains yet |

The Workers row is Cloudflare's newer Workers roles, not the legacy permission **Workers Scripts: Edit**, which the token page marks Legacy. That one's replacement is Editor at the whole Workers product's scope, every Worker in the account.

Editor can deploy and update an existing Worker but cannot create one: creating a Worker needs **Admin** at the Workers product level, and a token can name a Worker only once it exists. So the first deployment is either:
- by hand (below), by an account member with that access;
- or by `deploy.yml`, under a token that first holds product-level Workers Admin and is narrowed to Editor on this Worker after.

Changing `name` in `wrangler.toml` does not rename the deployed Worker: the next deploy creates a new one, which is a first deployment again (gkms-hif-final-stats' `infra/worker/README.md` § Deploy gives the order it took there).

Binding the R2 bucket and the D1 database needs no R2 or D1 permission: deploying a Worker never needs permissions on the resources it binds. Source: Cloudflare's [Workers roles and permissions](https://developers.cloudflare.com/workers/authorization/workers/) (its roles, Legacy Workers permissions, Bindings and Routes sections), last read on 2026-11-01, when the page was dated 2026-09-15. If a deploy still fails with a permissions error, the message names the missing permission. Add that one, and record which.

By hand, for the first deployment or an emergency, with `bunx wrangler login` on the account that holds `tia.run`. Run from the repository root:

    bun run build
    cd infra/worker
    bunx wrangler deploy

The `custom_domain` route makes Cloudflare attach the Worker to `gkms-memomemo.tia.run` and manage its DNS record. Check a configuration change without logging in or deploying:

    bunx wrangler deploy --dry-run --outdir "$TMPDIR/wrangler-out"

It prints the bindings (`env.DB (gkms-memomemo)`, `env.IMAGES (tia-assets)`, `env.ASSETS`).

## Counts

The page ranks its card and H.I.F. ability pickers by what players choose in each section (decisions D11, D12 and D41 of the plan). Everything is in one D1 database (Cloudflare's SQLite service), bound as `DB`, with no KV.

**The tables,** `migrations/0001_counts.sql`:
- `counts (section, kind, id, n)`: one count per section and kind (`card`, `hif`, `customization`). A card's id carries its level (`p_card-01-act-3_029:1`), a customization's its step (`p_card_custom-…:1`), or is `none`.
- `caps (key, day, n)`: one row per player and UTC day. `key` is a truncated SHA-256 of the player's network, the day and the secret `HASH_SALT` (`client-key.ts`), so no IP address is stored. An IPv6 address counts by its /64, since one subscriber holds a whole /64.

Both are `WITHOUT ROWID`, so a new row is one row written, not two.

**`POST /count`** takes `{ section, card, upgrade, hif, customization }`, the shape in `count-contract.ts`. It answers, in this order:
1. 405 for another method;
2. 403 when the request carries another site's `Origin`, so no other site's page can have its visitors count;
3. 413 for a body over 1 KB;
4. 400 for a body that is not such an event;
5. 503 while `HASH_SALT` is unset, so nothing is counted unsalted;
6. 400 without `CF-Connecting-IP`;
7. 503 when the skill card file cannot be had, and 400 for an event naming anything the section's tab does not offer (`count-event.ts`, checked against the file `/data/skillcards.json` passes through, kept in the isolate for an hour by `count-data.ts`);
8. 429 when the player's cap row for the day has reached 200 events. The cap is one upsert whose `n` rises only under the cap, so it is exact, and a refused event writes nothing;
9. otherwise 200, after one batch of upserts adds 1 to each count. A D1 failure is a 503. One in that batch, after the cap has taken its place, leaves the place taken with nothing counted; the page does not retry, so nothing is ever counted twice (D63).

Every answer is JSON `{ "ok": … }` marked `no-store`. The Worker logs the rows each step wrote (`count: rows written 1 for the cap, 3 for 3 counts`).

**`GET /counts`** answers `{ formatVersion: 1, sections: { <section>: { card, hif, customization } } }`, every section and kind present, each an object of counts by id. It is one query, kept through the Cache API for an hour under the route alone, so a query string cannot skip the cache. HEAD answers the headers; a D1 failure is a 503 that is not kept.

**The Cron Trigger** `5 0 * * *` (00:05 UTC daily) runs `cleanCaps`, which deletes the cap rows of past days.

**What it costs on the Free plan.** Measured on a local D1 (the plan's Surprises & Discoveries), a counted event writes 4 rows (1 for the cap, 1 each for the card, the ability and a customization or `none`), and 5 with two customization steps; a refused one writes none. Against D1's 100,000 rows written a day, that is about 20,000 to 25,000 rows created a day across all players. Each request to `/count` or `/counts` is also a Worker request, out of the account's 100,000 a day.

**The database** was created in Milestone 7, on 2026-11-01 (UTC), by hand with `bunx wrangler login` on the account that holds `tia.run`, and its id is in `wrangler.toml`. A new migration, or the database made again after a loss, goes the same way, from this directory:

    bunx wrangler d1 create gkms-memomemo --location apac   # only to make it again; then put the new database_id into wrangler.toml
    bunx wrangler d1 migrations apply gkms-memomemo --remote   # applies only the migrations not yet applied

`wrangler.test.ts` requires the binding's `database_id`. Without one, `wrangler dev` (a local D1) and `--dry-run` work, but `wrangler deploy` provisions a new database under the name instead of binding this one: wrangler 4.156.0's source logs "Provisioning" and creates the resource, taking its name from the config.

**The salt** `HASH_SALT` is a Worker secret, set after the Worker's first deployment. Run before it, `wrangler secret put` does not fail: wrangler 4.156.0 (`createDraftWorker` in its source) creates an empty Worker of this name to hold the secret, without asking when no terminal is attached. Until the salt is set, and whenever it is missing, `POST /count` answers 503 and counts nothing. Setting it deploys a new version of the Worker at once. From this directory, without the value ever being shown or written to a file:

    openssl rand -base64 48 | tr -d '\n' | bunx wrangler secret put HASH_SALT

Setting it again changes every player's cap key for the rest of the day, which only resets their count of the day's 200 events.

**Locally,** with a D1 kept outside the repository and a throwaway salt:

    bun run build
    cd infra/worker
    bunx wrangler d1 migrations apply gkms-memomemo --local --persist-to "$TMPDIR/wstate"
    bunx wrangler dev --local --port 8787 --persist-to "$TMPDIR/wstate" --var HASH_SALT:local-test-salt --test-scheduled

Then `POST http://localhost:8787/count` and `GET /counts`; `curl "http://localhost:8787/__scheduled?cron=5+0+*+*+*"` runs the cleanup. `wrangler dev` gives each request `CF-Connecting-IP`, so the cap applies locally too. The page at `http://localhost:8787/` sends its rows' events and ranks its pickers by these counts.

The first `GET /counts` is kept for an hour, by the Worker's local cache and by the browser, so counts posted after it do not show. Locally, `wrangler dev` kept one answer for `127.0.0.1` and `localhost` alike, so another host is no way round it. To see new counts at once, stop `wrangler dev`, delete `$TMPDIR/wstate/v3/cache` (the local cache, beside the local D1, which stays), and start it again on another port, which the browser has not cached.

## Verify

Once deployed, and once the sheets the committed index names are uploaded (`scripts/icons/upload.py`), from the repository root at the deployed commit:

    curl -sI https://gkms-memomemo.tia.run/ | head -3
    # -> HTTP/2 200, content-type: text/html
    curl -s https://gkms-memomemo.tia.run/data/skillcards.json | jq '.formatVersion, (.cards | length)'
    # -> 1, then the number of cards the sibling publishes
    jq '[.plans[].sheets[]] | length' src/icons/index.v1.json
    # -> 39 (three plans × 13 idols)
    curl -sI "https://gkms-memomemo.tia.run/img/$(jq -r '.plans[0].sheets[0].file' src/icons/index.v1.json)"
    # -> HTTP/2 200, content-type: image/webp, cache-control: public, max-age=31536000, immutable
    curl -sI https://gkms-memomemo.tia.run/icons/frames112.webp | head -3
    # -> HTTP/2 200, content-type: image/webp (a static asset)
    curl -s https://gkms-memomemo.tia.run/sw.js | grep -c '"precache"'
    # -> 1: the worker carries the manifest the build wrote into it
    curl -s https://gkms-memomemo.tia.run/manifest.webmanifest | jq -r '.start_url, .display'
    # -> /, then standalone
    curl -sI https://gkms-memomemo.tia.run/img/master/img_general_skillcard_men-0_003.webp
    # -> HTTP/2 404, cache-control: no-store   (a master must be refused even where it exists)
    curl -s https://gkms-memomemo.tia.run/counts | jq '.formatVersion, (.sections | keys | length)'
    # -> 1, then 9 (every section, counted or not)
    curl -s -w ' %{http_code}\n' -X POST https://gkms-memomemo.tia.run/count -d '{}'
    # -> {"ok":false} 400: the Worker answers the route (a body that is not an event is refused before anything else)

## Tests

`bun test` at the repository root runs:
- `img.test.ts` against a fake bucket;
- `data.test.ts` and `worker.test.ts` against a fake upstream;
- `count.test.ts` and `worker.test.ts` against `fake-d1.ts`, which runs the Worker's own SQL on an in-memory SQLite (`bun:sqlite`) with `migrations/` applied;
- `count-event.test.ts` and `count-data.test.ts` against the committed skill card file, and `client-key.test.ts` and `body.test.ts` on their own;
- `wrangler.test.ts` over this directory's `wrangler.toml`;
- `../workflows.test.ts` over the two workflows.

The workflows cannot run locally. That test pins their triggers and their read-only permissions, that every action is pinned to a commit hash and that CI runs the local Bun, and that the deploy runs every gate before it deploys.
