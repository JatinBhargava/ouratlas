# Changelog

What changed in each version of Atlas. The API and the website are versioned
separately in `versions.json`; while they share a number, one entry covers both.
A release is tagged `v<version>` by CI when tagging is switched on (see
`.github/workflows/ci.yml`), and that tag carries the entry below as its message.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
versions follow [Semantic Versioning](https://semver.org/).

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
