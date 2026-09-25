# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Atlas (ouratlas.co.in): a user brings up to ten trip photos and up to 10,000 words, and gets back a paginated magazine issue (cover, contents, feature, plates, colophon) that they export to PDF through the browser's print dialog. It's one Bun repo with two parts: a React 19 SPA in `src/` and an Express 5 API in `api/`.

## Commands

```bash
bun install
bun dev                 # both parts: frontend :3000 (Bun bundler, HMR) proxies /api → API :3001
bun dev:web / dev:api   # either part on its own
bun run typecheck       # tsc --noEmit over src/ and api/ together
bun run build           # static frontend into dist/ (also copies src/static/* unhashed)
bun start               # production: one Express process serves dist/ and the API on :3000
bun run docker:build    # compose build, image tags injected from versions.json
bun --env-file=.env scripts/dodo-event.ts subscription.active <supabase-user-id> [plan]   # send a signed Dodo webhook to a local server
```

There is no test suite and no linter. CI (`.github/workflows/ci.yml`) runs a frozen-lockfile install, then `typecheck`, then `build`, then boots the API **with no env keys at all** (`SERVE_STATIC=false PORT=3000 bun api/index.ts`) and checks that `/api/health` answers and that an unknown `/api/*` path returns the JSON 404. Treat that sequence as the verification bar.

## Invariants that span files

- **Photos and story text are never stored, and leave the browser only when the reader asks.** Photos are object URLs and composition happens client-side. There are three exceptions, all opt-in and none logged or stored. `POST /api/editor` (`src/components/editor-panel.tsx`, engine in `api/editor.ts`) is the only one that sends photographs: 512px JPEG previews plus the story go to the editor's own provider (`editorProvider()`: Claude Opus 5 via `@anthropic-ai/sdk` by default — adaptive thinking, structured output, server-side refusal fallbacks — or OpenAI with `EDITOR_PROVIDER=openai`). It returns a plan (theme, cover, photo order, focus points, captions, tilt, title, notes, and for the "custom" theme a page-by-page layout plan) that `Create.tsx` `applyEditor` applies with an undo. The editor never places boxes: it picks from the gridded layouts in `src/lib/magazine/archetypes.ts`, which always tile the page; its page plan lands as `leaves` from `BODY_START` in `compose.ts`. A designed issue also carries a `palette` (paper/ink/accent from the photos, contrast-checked in `src/lib/editor.ts`) and pull `quotes` (verified word for word against the story) on `CustomDesign`; `compose.ts` deals quotes to `quote` boxes like photos to plates, turns spare quote boxes into text, fills photo-less pages with `quoteSplit`, and closes a text-only final page with an accent end card. `bleed` pages run their photo to the trim with the quote over it. It has its own 4 MB JSON parser mounted before the global one in `api/app.ts`, and `EDITOR_NEEDS_SIGN_IN` in `src/types` gates it (off for now). `POST /api/polish` (the "copy desk") is paid-plan-only and streams text to OpenAI/Anthropic. `POST /api/transcribe` (the Speak tab, `src/components/dictation.tsx`) is open to everyone for now (`VOICE_NEEDS_SIGN_IN` in `src/types` turns sign-in back on for both halves). `POST /api/transcribe/session` mints a one-use OpenAI Realtime client secret, and the browser (`src/lib/transcribe.ts`) streams 24 kHz PCM straight to OpenAI over a WebSocket; the text comes back live into the Write box, and the audio never touches our server. Uploaded recordings take the other path: `src/lib/transcribe-file.ts` decodes the file in the browser and posts two-minute 16 kHz WAV pieces (cut at quiet moments, under Vercel's 4.5 MB body limit) to `POST /api/transcribe/file`, which forwards each to OpenAI and holds it only in memory. Don't add uploads, persistence, or logging of user content.
- **Every integration is optional.** `api/env.ts` reads config once and exposes `*Configured` flags plus `describe()`, which prints one on/off line per feature at boot. A missing key turns its feature off: routes throw `unconfigured(...)` (a 503) and never crash the server. SDK clients (`api/stripe.ts`, `api/dodo.ts`, `api/supabase.ts`) are built lazily for the same reason. A new integration should follow this pattern and add a line to `describe()`.
- **A named provider without keys means off, never a fallback.** `billingProvider()` picks Dodo or Stripe (Dodo wins by default, because the Indian merchant account can't charge through Stripe). `polishProvider()` picks OpenAI or Anthropic (OpenAI wins by default). `BILLING_PROVIDER` / `POLISH_PROVIDER` override the choice. The README still describes Stripe as the processor, but Dodo is the live one.
- **Entitlement is server-side only.** The plan comes from `/api/me`, backed by the `subscriptions` table. The browser uses `hasCopyDesk()` only to decide what to show. Both webhooks (`routes/webhook.ts` for Stripe, `routes/dodo-webhook.ts` for Dodo) are the only writers of `subscriptions`. They're mounted with `express.raw` **before** `express.json` in `api/app.ts` so signature checks see the original bytes. `payments` is an append-only ledger and deliberately has no foreign key to `subscriptions`, because webhooks arrive out of order.
- **Supabase schema** lives in `api/schema.sql`, which you run by hand in the Supabase SQL editor. The tables are `profiles`, `subscriptions`, `payments`, `waitlist`, and `exports` (monthly counts, claimed through the `claim_export` RPC). RLS is on for all of them. `waitlist` has no policies, so only the service-role key can reach it.
- **`BUN_PUBLIC_*` is inlined at build time** (`bunfig.toml`, `build.ts`). These values are Docker build args and Vercel build env, so setting them at runtime does nothing. Anything secret must never carry that prefix. `BUN_PUBLIC_CHECKOUT=on` enables the paid-plan buttons, which stay disabled until the Dodo account is approved.
- **Shared types:** `src/types/index.ts` is imported by both parts (`@/types`). The API may import **only** from `src/types`: `Dockerfile.api` copies just that directory, and `.vercelignore` excludes `api/` from the frontend build. Nothing in `src/` imports from `api/`.
- **Errors:** API handlers are wrapped in `asyncRoute` and throw `HttpError(status, userFacingMessage)`. `errorHandler` sends `{ error }` and turns anything unexpected into a generic 500. The client wrapper `src/lib/api.ts` attaches the Supabase bearer token and surfaces `error` as the message. Streaming (`src/lib/polish.ts`) bypasses that wrapper and attaches the token by hand.
- **Versions** exist only in `versions.json` (`api` and `ui` are versioned separately), and `scripts/versions.ts` is the only code that reads it. Images get the value stamped in as `APP_VERSION`. `/api/health` and the site footer report it.

Path aliases: `@/*` → `src/*`, `@api/*` → `api/*`. UI primitives are shadcn (new-york) in `src/components/ui`, styled with Tailwind v4 through `bun-plugin-tailwind`.

## The magazine engine (`src/lib/magazine/`, drawn by `src/components/magazine/`)

Pagination works by **measuring**, not estimating. `fit.ts` binary-searches a word count against real type rendered in an off-screen node, one text box at a time. `compose.ts` then pours the story through the layouts in order, deals out the plates, sets folios, and caps an issue at 96 pages.

- The fitter and the renderer have to agree exactly, or pages overflow silently. They share page geometry (`geometry.ts`: 520×693 CSS px, which also matches the print `@page` so PDFs come out 1:1), markup (`copy.ts` `paragraphsHtml`), and type overrides (`CopyStyle`, applied to both the measuring box and the drawn column). When you change type, spacing, or box sizes, change them in the shared module, never in only one of the two places.
- `templates.ts` turns a `TemplateId` plus plate size into text boxes. `themes.ts` defines each theme as a cycle of templates plus a `Surface` (paper, ink, fonts). `custom.ts` holds user-drawn layouts (`custom-*` templates) where the boxes are the input; they're edited in `layout-designer.tsx`. `typography.ts` defines font stacks.
- Themes and typography load **no webfonts** beyond the one self-hosted face. They use system font stacks with fallbacks for macOS, Windows, and Linux, because a missing face measures differently and breaks pagination.
- Reader decisions that must survive recomposition live in `src/pages/Create.tsx` state, not on the `Issue`, which is rebuilt from scratch on every change. That state includes plate sizes keyed by page index, the riddle seed, theme, tilt, custom design, per-page custom layouts (`leaves`: a box dragged on one page of the proof changes that page only, stored by page index with its slot so it is never laid on a different kind of page), type, and sketches.
- Google sign-in is a full-page redirect, so `src/lib/draft.ts` parks the whole desk (including `File` handles) in IndexedDB and reads it back exactly once. **New desk state must be added to `DeskDraft`** (and to `valid()` if it's required), or it's lost across sign-in. Sign-in is required only at export. Composing works signed out.

## Deployment

- Frontend: Vercel (`vercel.json`) builds `dist/` and rewrites `/api/*` to `https://api.ouratlas.co.in`.
- API: runs as the `Dockerfile.api` container (currently on Render; `api/cron.ts` pings its own public URL every 10 minutes so the service doesn't idle out).
- Self-hosted alternative: `docker-compose.yml` runs nginx (`Dockerfile.web`, `docker/nginx.conf`) in front of an API that exposes no public port. nginx proxy buffering is off and the timeout is 600s, both for the streaming copy desk.
- CI publishes both images to GHCR on pushes to `master`.

## Code style

Comments are prose: they explain *why* a choice was made, what alternative was rejected, and what would break otherwise. Match that density and voice when you edit. UI copy and naming lean on print-magazine vocabulary (plates, folios, colophon, press, desk, circulation), and the plans are named Wanderer (free), Traveller, and Cartographer.
