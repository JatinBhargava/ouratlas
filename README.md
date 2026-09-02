# Atlas

Trip photos and your own words, set as a magazine you can keep.

Ten photographs and up to ten thousand words go in; a paginated issue — cover,
contents, feature, plates, colophon — comes out, ready to export as a PDF.

## Running it

```bash
bun install
cp .env.example .env   # then fill in what you want switched on

bun dev                # frontend on :3000, API on :3001
bun run build          # static build into dist/
bun start              # production: one process on :3000, site and API
```

`bun dev` runs two processes, because they want different things. The frontend
is bundled by Bun, which is what gives hot reload; the API is Express. The dev
frontend forwards `/api` to it, so the browser only ever sees one origin —
the same as in production, where Express serves `dist/` and the API together.

Either half can be run alone with `bun dev:web` and `bun dev:api`.

Nothing is required to start. Every integration is optional and a missing key
switches that feature off rather than stopping the server, so the boot log
prints what is on:

```
   accounts  off (set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
   billing   off (set STRIPE_SECRET_KEY, STRIPE_PRICE_*)
   webhook   off (set STRIPE_WEBHOOK_SECRET)
   copy desk on
```

`bun run typecheck` checks the frontend and the API together.

## Where the data goes

**Photographs and story text never leave the browser.** Photos are read into the
tab as object URLs and are never uploaded. The story is held in React state.
Composition and pagination happen in the browser, and export goes through the
browser's own print dialog. None of it is written to a database, and there is
no table it could go in.

Two things do reach a server, both of them opt-in:

- The **copy desk** streams the story through Anthropic and writes nothing down
  on the way (see below).
- **Accounts, subscriptions and the waitlist** are stored in Supabase — an
  email address, a plan, and a Stripe customer id. That is the whole of it.

Earlier versions of this README said nothing was stored at all. Billing changed
that, and it is worth being exact rather than keeping the nicer sentence.

## Accounts

Sign-in is Google, through Supabase Auth. There is no password to store and no
login endpoint in `api/` — the browser gets a signed token from Supabase, and
the server verifies it with Supabase rather than decoding it itself.

Run `api/schema.sql` once in the Supabase SQL editor. It creates three tables,
turns on row-level security for all of them, and adds the trigger that mirrors
a new Google sign-in into `profiles`.

Then enable Google under **Authentication → Providers**, and add your redirect
URLs (`http://localhost:3000/**` for development) under **URL Configuration**.

The service-role key bypasses row-level security, so it stays on the server.
Only `BUN_PUBLIC_*` variables are inlined into the browser bundle, which is why
the Supabase URL and anon key appear twice in `.env.example` and the
service-role key appears once.

## Subscriptions

Two paid plans, both monthly, through Stripe Checkout. Create them as prices in
Stripe and put the **price** ids (not product ids) in `STRIPE_PRICE_TRAVELLER`
and `STRIPE_PRICE_CARTOGRAPHER`.

The browser never names a price, only a plan — a client that could name its own
price could name its own price of zero.

Entitlement is granted by the webhook and nowhere else. Checkout finishing in
the browser proves nothing: the tab can be closed before it happens, and the
return URL can be typed by hand. So `POST /api/stripe/webhook` is the only
writer of the `subscriptions` table, and it acts only on a signed event. It is
mounted with a raw body parser, because the signature covers the exact bytes
Stripe sent and re-serialised JSON is not those bytes.

Forward events while developing:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

It prints a `whsec_...` to put in `STRIPE_WEBHOOK_SECRET`. The deployed endpoint
gets a different one from the dashboard.

Stripe stays the source of truth; the `subscriptions` table is a mirror so a
page load does not need an API call.

Six events are subscribed to, and the endpoint acknowledges and drops anything
else:

```
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
```

The subscription events grant the plan. The invoice events write the ledger
(below) and never grant anything — a paid invoice for a price this server does
not sell should leave a record, not an entitlement.

## The payments ledger

`subscriptions` and `payments` mirror the same Stripe account and answer
different questions. The first is current state, overwritten in place: what
plan is this person on. The second is history, appended to: what have they
actually been charged, with a link to each invoice and its PDF.

They are deliberately **not** joined by a foreign key. Stripe does not order
its webhooks, and `invoice.paid` routinely arrives before the
`customer.subscription.created` it belongs to. A reference would reject those
rows and lose the first payment of every new subscription, which is the one
that matters most. `payments.subscription_id` is a plain id, joined when both
rows exist.

Amounts are stored in the currency's minor unit exactly as Stripe sends them
(`829` = $8.29). A decimal column here would drift against the figures printed
on the invoice.

One subtlety worth knowing when reading the table: Stripe has no "failed"
invoice status. A declined card leaves the invoice `open` and increments its
attempt count, so the outcome lives in `last_attempt_failed`, which is set from
the event type rather than read off the invoice. Cancellation, card changes and plan
switches all go to Stripe's own billing portal rather than being rebuilt here.

Because the webhook can arrive after the browser does, `/account` re-asks for
the plan on a widening interval for about half a minute after checkout instead
of telling someone who has just paid that they are on the free plan.

## The waitlist

`POST /api/waitlist` takes an email address and where on the site it was typed.
It needs no account, which makes it the one write a stranger can reach.

The `waitlist` table has row-level security on and **no policies at all**. That
is deliberate: it is writable only through the server's service-role key, so
anyone holding the public anon key still cannot enumerate the mailing list.
Signing up twice is reported as success, because it is — the address is on the
list either way.

## Layout

```
api/          Express: routes, Supabase and Stripe clients, schema.sql
src/          React app
src/lib/      supabase client, auth context, billing and waitlist helpers
src/types/    types shared by both halves, so they cannot drift on a plan name
dev.ts        runs both halves for development
```

## Deployment

Two containers behind one origin.

```
                    ┌──────────────────────────────┐
  browser  ────────▶│ web    nginx :80             │
                    │        dist/ + SPA fallback  │
                    │        /api/* ──┐            │
                    └─────────────────┼────────────┘
                                      ▼
                    ┌──────────────────────────────┐
                    │ api    Express :3000         │
                    │        not published         │
                    └──────────────────────────────┘
```

The proxy is what makes this one origin rather than two, which is worth more
than it looks: no CORS, no second base URL in the client, and the Stripe
webhook path and Supabase redirect URLs are the same string in production as in
development. The API publishes no port at all — it is reachable on the compose
network and nowhere else, so the service-role key is never one request away from
the internet.

```bash
docker compose up --build      # http://localhost:3000
docker compose down
```

`PORT` moves the published port; everything else comes from `.env`.

### The one thing that is not runtime configuration

`BUN_PUBLIC_SUPABASE_URL` and `BUN_PUBLIC_SUPABASE_ANON_KEY` are **baked into
the bundle at build time** — Bun inlines them (`bunfig.toml`, `build.ts`), so by
the time a container starts, the JavaScript is already written. They are build
arguments to the `web` image, not environment variables on it. Setting them at
run time does nothing whatsoever, silently. `Dockerfile.web` fails the build if
the URL is missing, because the alternative is an image that looks fine and
cannot sign anybody in.

Everything else — Supabase service-role key, Stripe keys, `APP_URL` — is read by
the API at run time and can change without a rebuild.

### Keeping the API awake

`api/cron.ts` runs one scheduled job: every ten minutes it fetches its own
`/api/health`.

Free hosting idles a service out after a quiet spell — around fifteen minutes on
Render — and a cold start is several seconds of someone staring at a blank
sign-in. Ten minutes leaves room for one ping to fail without the idle window
being reached.

It has to be the **public** URL rather than localhost. Hosts count inbound
requests through their own proxy, so a loopback request would keep the event
loop busy and let the service sleep anyway. On Render this is automatic —
`RENDER_EXTERNAL_URL` is injected — and `KEEPALIVE_URL` covers anywhere else.

Two things it deliberately does not do. It cannot wake a service that has
already stopped, because the process holding the timer stopped with it; it only
prevents the idle window from being reached. And it never runs in development,
where pinging localhost would achieve nothing but noise.

A failed ping is logged and the schedule continues. The timer is unref'd, so it
never holds the process open during shutdown. The boot log names the jobs that
started — a cron that silently is not running would be worse than none.

### The masthead line

The small capitalised line in the navigation is where a magazine prints its
circulation and edition, and it behaves like one.

When the visitor count is known it is stated as **circulation**, which is what a
readership figure is called in print. When it is not — analytics off, API
unreachable, a fresh deployment — it falls back to the **edition**, named by the
reader's own clock: Morning, Afternoon, Evening, Late. That needs no data at
all, so the slot is never empty and the nav keeps reading as a periodical rather
than an app chrome bar.

The count itself comes from `GET /api/visits`, which asks Vercel's Web Analytics
API and returns only `{ visitors, pageviews }`. It goes through the server
because the Vercel token reaches the whole account — far too much to hand a
browser for a decorative number — and the response is deliberately thin for the
same reason: no paths, no referrers, no countries.

That call is cached for ten minutes. The figure moves slowly and nobody watches
it change, so a request per page load would spend the rate limit on nothing. A
failed refresh serves the stale value rather than blanking the line.

The nav previously showed a hardcoded `12,480`. On a site about keeping an
honest record of a trip, an invented readership was the wrong default.

### Versioning

`versions.json` is the only place a version number is written:

```json
{ "api": "0.1.0", "ui": "0.1.0" }
```

The two are separate because they ship separately — a frontend change should not
claim the API moved. Everything else reads that file through
`scripts/versions.ts`, which is the single reader so nothing else needs to know
the file's shape:

| Reads it | For |
| --- | --- |
| `.github/workflows/ci.yml` | image tags `v0.1.0`, alongside `latest` and the SHA |
| `docker-compose.yml` | the same tags locally, via `bun run docker:build` |
| `Dockerfile.api` / `.web` | `APP_VERSION` build arg, stamped into the image |
| `api/env.ts` | what `/api/health` and the boot log report |
| `build.ts` | inlined into the bundle, shown in the footer |

Bumping a version is editing that one file. Nothing else needs touching.

Both halves report what they are actually running, which is how a rollout gets
confirmed from outside:

```bash
curl https://api.ouratlas.co.in/api/health
# {"ok":true,"service":"api","version":"0.1.0"}
```

The frontend's equivalent is the `v0.1.0` in the footer.

An image carries the version it was **built** from, stamped in as `APP_VERSION`,
rather than reading `versions.json` at run time — so a container keeps reporting
what it is, even after the file moves on. Locally, `docker compose` on its own
cannot read JSON, so `bun run docker:build` injects the versions for it; called
directly, compose falls back to `:dev`, which is a truthful label for an
unversioned build.

### CI

`.github/workflows/ci.yml`. Every push and pull request runs `check`: install
with a frozen lockfile, typecheck, build the frontend, then boot the API and
wait on `/api/health`. That last step runs with no keys configured at all, which
is the point — the server must start and answer when every integration is
switched off.

Pushes to `master` additionally run `publish`, which builds both images and
pushes them to GHCR tagged `latest` and the commit SHA.

Two repository settings are needed for the web image, both public values, kept
out of the repo rather than out of sight:

| Where | Name |
| --- | --- |
| Variables | `BUN_PUBLIC_SUPABASE_URL` |
| Secrets | `BUN_PUBLIC_SUPABASE_ANON_KEY` |

### Deploying

The pipeline stops at a published image, because where it runs is not decided
yet. On any host with Docker:

```bash
docker compose pull && docker compose up -d
```

with `.env` present and `APP_URL` set to the public origin. Point `APP_URL`
somewhere the browser cannot reach and Stripe will return people to a dead
address after checkout.

## The copy desk (optional)

`POST /api/polish` streams the story through Anthropic for a copy-editing pass.
It is off unless the server has a key:

```bash
ANTHROPIC_API_KEY=sk-ant-... bun dev
```

An identity-linked key also needs the workspace it acts in, or the API answers
400:

```bash
ANTHROPIC_WORKSPACE_ID=wrkspc_...
```

Ordinary keys reject that header, so it is only sent when it is set.

Without one the endpoint returns 503 and the UI says so. The key stays on the
server and is never sent to the browser. The story is split into passes of about
1,200 words so a long trip cannot run past the model's output limit, and the
passes are rejoined so paragraph structure survives the round trip. Nothing is
logged or stored on the way through. Photographs are never sent.

## How the magazine is composed

`src/lib/magazine/` is the engine and `src/components/magazine/` draws it.

The hard part is pagination: fixed pages, variable copy. Rather than estimating
from a words-per-column average, the composer **measures** — each text box is
filled by binary-searching the word count against real type rendered off-screen.
That is why no page overflows and none is left half empty.

- `geometry.ts` — the page grid. Shared by the fitter and the renderer, because
  if the two ever disagreed a page would silently overflow.
- `copy.ts` — the story as paragraphs, and the one function that turns a slice
  into markup. Measuring and drawing go through it for the same reason.
- `fit.ts` — the fitter.
- `templates.ts` — the layouts and their text boxes.
- `compose.ts` — pours copy through the layouts, deals out plates, sets folios.

Print uses an `@page` box matching the layout exactly (520×693 CSS px), so
"Save as PDF" produces pages 1:1 with no scaling.
