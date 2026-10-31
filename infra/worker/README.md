# gkms-memomemo.tia.run Worker

One Cloudflare Worker serves the whole page: the built page as static assets, this app's game-style skill card sprite sheets from the R2 bucket `tia-assets`, read only, and gakumas-supportcards' skill card data at this origin (`docs/adr/0002`; `docs/plans/EXECPLAN_MEMORY_MEMO.md`, decisions D22, D24 and D42; `docs/plans/EXECPLAN_GAME_STYLE_ICONS.md`). The sheets are built and uploaded from a person's machine by the icon pipeline in `scripts/icons/`; the Worker never writes to the bucket. The sheets' index is not served: it is committed as `src/icons/index.v1.json` and bundled into the page. `wrangler.toml` runs the Worker's code only for `/img/*` and `/data/skillcards.json` (`run_worker_first`); every other path is answered by the assets directly. Both come from one list, `WORKER_FIRST` in `worker.ts`: `route` answers exactly its paths and sends the rest to the assets, and `wrangler.test.ts` keeps `run_worker_first` equal to it.

That split matters on the Workers Free plan the `tia.run` account is on. Requests answered by the assets are free and unlimited. Every request that runs the Worker counts toward the account's 100,000 a day, which every `tia.run` Worker shares, and past it those requests fail until 00:00 UTC. That is why the page loads a few sprite sheets rather than one image per icon (D42; the plan's Surprises & Discoveries).

| Route | Serves |
|---|---|
| `https://gkms-memomemo.tia.run/` | the page built by `bun run build` (`dist/`) |
| `/img/gkms-memomemo/sheet112/<plan>-<idol id>-<8 hex digits>.webp` | a sprite sheet from `tia-assets`, through `img.ts`, as immutable WebP; its name ends in a hash of its bytes, so it never changes meaning. A matching `If-None-Match` (a list, a weak tag or `*`, for GET and HEAD) is a 304 |
| `/icons/frames112.webp` | the placeholder frames, a static asset from `public/icons/` (no Worker request) |
| any other `/img/` path | a 404 marked `no-store`: gakumas-supportcards' own sheets and index under `sheet112/`, the single icons under `w112/`, the private `master/` prefix and everything else in the bucket are never served |
| `/data/skillcards.json` | gakumas-supportcards' `https://gakumas-supportcards.tia.run/data/skillcards.v1.json`, passed through with an hour's cache; a failure upstream is a 502 marked `no-store` (`data.ts`) |

Hostname policy (tia-tools convention): each app lives on its own single-level subdomain of `tia.run`. The zone's free Universal SSL certificate covers no second level.

## Deploy

Deployment is automatic: `.github/workflows/deploy.yml` runs on every push to `main` that touches the page or this directory, and on demand from the Actions tab. It runs the unit tests, the type check, the lint and the build, and deploys only when all of them pass. `main` is production; `develop` is development, and a release is a pull request from `develop` into `main`. The first release is Milestone 7 of the plan.

It needs two repository secrets, set once by a person in the repository's settings (Settings → Secrets and variables → Actions):
- `CLOUDFLARE_ACCOUNT_ID`, the tia-tools account's id;
- `CLOUDFLARE_API_TOKEN`, an **account-owned** API token (dashboard → Manage Account → Account API Tokens, on the account that holds `tia.run`). Being account-owned, it survives any person leaving. Give it the least `wrangler deploy` uses:

| Scope | Permission | Used by |
|---|---|---|
| Workers, only the Worker `gkms-memomemo` | **Editor** | the script and the static assets |
| Zone, only `tia.run` | **Workers Routes: Write** | the custom domain in `wrangler.toml` |

Editor can deploy and update an existing Worker but cannot create one: creating a Worker needs **Admin** at the Workers product level, and a token can name a Worker only once it exists. So the first deployment is either:
- by hand (below), by an account member with that access;
- or by `deploy.yml`, under a token that first holds product-level Workers Admin and is narrowed to Editor on this Worker after.

Changing `name` in `wrangler.toml` does not rename the deployed Worker: the next deploy creates a new one, which is a first deployment again (gkms-hif-final-stats' `infra/worker/README.md` § Deploy gives the order it took there).

Binding the R2 bucket needs no R2 permission: deploying a Worker never needs permissions on the resources it binds. Source: Cloudflare's [Workers roles and permissions](https://developers.cloudflare.com/workers/authorization/workers/), as read for gkms-hif-final-stats on 2026-10-29. If a deploy still fails with a permissions error, the message names the missing permission. Add that one, and record which.

By hand, for the first deployment or an emergency, with `bunx wrangler login` on the account that holds `tia.run`. Run from the repository root:

    bun run build
    cd infra/worker
    bunx wrangler deploy

The `custom_domain` route makes Cloudflare attach the Worker to `gkms-memomemo.tia.run` and manage its DNS record. Check a configuration change without logging in or deploying:

    bunx wrangler deploy --dry-run --outdir "$TMPDIR/wrangler-out"

It prints the bindings (`env.IMAGES (tia-assets)`, `env.ASSETS`).

The D1 database and the daily Cron Trigger of the counts (decision D41) are added in Milestone 6 and created in Milestone 7.

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
    curl -sI https://gkms-memomemo.tia.run/img/master/img_general_skillcard_men-0_003.webp
    # -> HTTP/2 404, cache-control: no-store   (a master must be refused even where it exists)

## Tests

`bun test` at the repository root runs:
- `img.test.ts` against a fake bucket;
- `data.test.ts` and `worker.test.ts` against a fake upstream;
- `wrangler.test.ts` over this directory's `wrangler.toml`;
- `../workflows.test.ts` over the two workflows.

The workflows cannot run locally. That test pins their triggers and their read-only permissions, that every action is pinned to a commit hash and that CI runs the local Bun, and that the deploy runs every gate before it deploys.
