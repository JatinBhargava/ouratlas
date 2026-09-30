# Changelog

What changed in each version of Atlas. The API and the website are versioned
separately in `versions.json`; while they share a number, one entry covers both.
A release is tagged `v<version>` by CI when tagging is switched on (see
`.github/workflows/ci.yml`), and that tag carries the entry below as its message.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
versions follow [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-10-01

The website only; the API stays at 1.0.0, so this is tagged `web-v1.1.0`.

### Added

- **Atlas Studio** (`/studio`). Every layout from the design canvas, 206 pages
  in four groups (one-page magazines, magazine pages, new ideas, and complete
  ten-page issues), with a fill-in editor (`FillIn`) that swaps in the reader's
  photos, makes the text editable and lets a crop be dragged. Pages are
  finished HTML drawn in script-less `srcdoc` iframes, imported by
  `scripts/studio.ts` into `src/lib/studio/pages.json` (a lazy chunk) with the
  sample photos in `src/assets/studio/`. Only pages near the screen keep a live
  frame. PDF and PNG downloads need no sign-in; Save & share needs one and
  parks the editor under the `studio` key of `lib/draft.ts` across the redirect.
  Linked from the Products menu.
- **`SaveDialog`**, split out of `save-panel.tsx`, so the desk and the Studio
  seal and upload pages through the same dialog and `saveIssue`.
- **Preview in Editor in Chief.** A Preview button beside Download PDF opens the
  whole issue as a bound magazine: the cover on its own, then every page facing
  its neighbour, turned with the arrows, the ← → keys, a swipe or a page's edge
  (one page at a time on a phone). It is the desk's own `IssueView`, the book
  `/read` opens a saved issue in, with each page drawn by the studio's `Sheet`,
  so the proof shows exactly what the PDF will. The PDF can be downloaded from
  inside it, and the editor's shortcuts are held while it is open. Nothing new
  is uploaded or kept.
- **A 404 page to play with.** The cover tears into three pieces the reader
  drags back into place, above a contents list of pages that do exist.
- **A "Make" column in the footer** linking every tool, since the Products menu
  draws its links only once opened and crawlers otherwise found them only in
  the sitemap.

### Changed

- The Studio, the poster, Editor in Chief and the layout directory are drawn
  ahead of time by `build.ts` with their own titles and share cards
  (`scripts/og-studio.ts` makes the Studio's). `useHydrated` holds back
  anything sized from the viewport or read from the query until the browser
  takes over, so the prebuilt markup and the first render agree.
- Carousel slides are scaled from each leaf's own width, so the Studio's larger
  pages save at the same 1080×1440.

### Fixed

- Panning a photo on a phone: a touch the browser turned into a scroll
  (`pointercancel`) left the drag attached and the picture stuck mid-move.
  Plates now take `touch-none`, and the pan badge is always shown and larger on
  coarse pointers.
- The inspector's section headings are `h2`, not `h3`, so the poster page no
  longer skips a heading level.

## [1.0.0] - 2026-09-27

The first version with an Android app.

### Added

- **Android app.** The same desk and press, packaged with Capacitor and installed
  from an APK (Play Store to follow). Pages ship inside the app; it talks to the
  live API and Supabase. Build it with `bun run app:build`.
- **Google sign-in in the app.** Google opens in the browser sheet over the app
  and returns through `in.co.ouratlas://auth`, landing back on the page sign-in
  began from, with a parked desk restored as on the website. Needs
  `in.co.ouratlas://auth**` in Supabase's Redirect URLs.
- **CORS for the app** on the API, for `https://localhost` (Android) and
  `capacitor://localhost` (iPhone). `APP_ORIGINS` changes the list, and the boot
  log reports it on an `apps` line.
- **Build settings for the app:** `BUN_PUBLIC_API_URL` (where the API is) and
  `BUN_PUBLIC_SITE_URL` (where shared links point). Both stay unset for the
  website.
- **Optional release tags in CI:** a "Create a git tag" box on manual runs, or
  `TAG_ON_BUILD=true` to tag every master build.

### Changed

- Save & share links made in the app point at ouratlas.co.in, not the phone's
  own address.
- Vercel Analytics and Speed Insights load on the website only.
- API and website are both at 1.0.0.

### Not yet in the app

- Export PDF and the carousel save nothing yet; they need the share sheet.
- Account deletion from inside the app, which Google Play requires.

## [0.3.0] - 2026-09-26

### Added

- **Atlas for any memory.** Weddings, birthdays, a first year and ordinary days,
  not only trips, across the home page, the editor and the copy desk.
- **The studio.** A one-page poster (`/poster`) and Editor in Chief
  (`/editor-in-chief`): place text, photo and shape boxes by hand and download a
  PDF or PNG. No sign-in and nothing uploaded.
- **The layout directory** (`/layouts`). Designers submit layouts with one sample
  picture; readers like them; editors review them in a queue
  (`/admin/layouts`), and the submitter is emailed the decision through Resend.
- **Share on socials** from Save & share.
- **Admin dashboard** (`/admin/dashboard`) for the editors.
- The copy desk on the free plan (two a month), and a sample story to start from.

### Fixed

- A page that fails on a phone shows a way back instead of a blank screen.

## [0.2.0] - 2026-09-26

### Added

- AI usage limits: a short burst limit on every AI route, and a monthly
  allowance per plan on the editor and the copy desk.

### Changed

- New prices: Traveller ₹99 (was ₹499), Cartographer ₹199 (was ₹1,199).
- An issue takes up to 10 photos (was 15).

## [0.1.0] - 2026-09-02

The first public version, and everything built on it until 0.2.0.

### Added

- **The magazine engine.** Up to 10 photos and 10,000 words become a paginated
  issue (cover, contents, feature, plates, colophon), paginated by measuring real
  type, up to 96 pages. Themes, plate sizes, the riddle and tilt.
- **Export to PDF** through the print dialog on computers, and as a made PDF on
  phones.
- **The editor**, an AI art director that plans the issue from the photos and the
  story, with undo.
- **The copy desk**, which edits the story and streams the result back.
- **The Speak tab**: live dictation, and uploaded recordings transcribed in pieces.
- **Google sign-in**, with the whole desk kept across the redirect.
- **Plans and billing** (Wanderer, Traveller, Cartographer) through Dodo Payments,
  with Stripe kept in reserve; monthly export limits on the free plan.
- **Save & share**: issues saved as sealed page pictures, opened with a key that
  stays in the link, plus My magazines (`/magazines`).
- **Carousel slides** for Instagram and WhatsApp.
- **Custom layouts** and the drawing board.
- Per-page SEO, a sitemap and share cards; code splitting for a faster first page.
- About, terms, privacy, refunds and contact pages, and a visitor counter.
- Deployment: Vercel for the site, a container for the API, and CI that publishes
  both images.

[1.0.0]: https://github.com/JatinBhargava/ouratlas/compare/3d1b5e9...v1.0.0
[0.3.0]: https://github.com/JatinBhargava/ouratlas/compare/97b5159...3d1b5e9
[0.2.0]: https://github.com/JatinBhargava/ouratlas/compare/83bf5c9...97b5159
[0.1.0]: https://github.com/JatinBhargava/ouratlas/commits/83bf5c9
