/**
 * Draws the card that appears when a link to the site is shared.
 *
 * It is generated rather than hand-drawn so it can be corrected when the
 * wording or the branding moves, and it is generated *here* rather than at
 * build time because it changes about once a year: the PNG is committed, and
 * deploys just copy it.
 *
 * The card is an SVG rasterised by QuickLook, which is on every Mac and needs
 * nothing installed. Two things make that reliable rather than lucky:
 *
 *   - QuickLook renders an SVG into a square, so the artwork is laid out on a
 *     1200x1200 ground with the card itself centred, then cropped back out.
 *     Handing it a 1200x630 file instead gets a squashed, padded guess.
 *   - Crawlers rasterise nothing and read no stylesheets, so the face is
 *     embedded in the file as base64 rather than linked. Without that the
 *     headline sets in whatever serif the renderer happens to have.
 *
 * Usage:
 *   bun scripts/og-image.ts                 draw the card
 *   bun scripts/og-image.ts scripts/og/hero.png    use a picture instead
 *
 * The second form is what the site actually ships: a screenshot of the home
 * page, scaled to cover 1200x630 and cropped from the middle, because a card
 * is never shown at the shape it was taken at.
 *
 * The output is a JPEG, and that is not a detail. The same card as a PNG is
 * near a megabyte, and WhatsApp quietly declines to show a thumbnail much over
 * 300 KB — a link that unfurls with no picture at all is a worse outcome than
 * any compression artefact.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** Facebook, LinkedIn, Slack and X all read this shape. */
const CARD = { width: 1200, height: 630 };

const ROOT = path.join(import.meta.dir, "..");
const OUT = path.join(ROOT, "src/static/og.jpg");

/** Quality: a photograph forgives more than flat art with type on it does. */
const QUALITY = { picture: 82, drawn: 92 };

const FONT = path.join(ROOT, "scripts/og/instrument-serif.ttf");
const PHOTO = path.join(ROOT, "src/assets/slideshow/pexels-iamllwyd-34392991.jpg");

const base64 = (file: string) => readFileSync(file).toString("base64");

/** Ink, matching the site's own palette rather than approximating it. */
const INK = {
  ground: "#0c0a09",
  paper: "#fafaf9",
  type: "#fafaf9",
  quiet: "#a8a29e",
  faint: "#57534e",
  rule: "#292524",
  column: "#d6d3d1",
};

/**
 * A run of ruled lines standing in for a column of body copy.
 *
 * The last line of a paragraph is short, which is the detail that makes a
 * block of rules read as text rather than as a barcode.
 */
function column(x: number, y: number, width: number, lines: number): string {
  return Array.from({ length: lines }, (_, i) => {
    const last = i === lines - 1;
    const run = last ? width * 0.58 : width * (i % 6 === 5 ? 0.93 : 1);
    return `<rect x="${x}" y="${y + i * 8}" width="${run.toFixed(1)}" height="2" rx="1" fill="${INK.column}" opacity="0.8"/>`;
  }).join("");
}

/** The two facing leaves, drawn as the app would set them. */
function spread(x: number, y: number): string {
  const leaf = { width: 252, height: 336 };
  const gap = 4;
  const right = x + leaf.width + gap;
  const inner = 22;

  return `
    <g>
      <rect x="${x}" y="${y}" width="${leaf.width}" height="${leaf.height}" fill="${INK.paper}"/>
      <clipPath id="leaf"><rect x="${x}" y="${y}" width="${leaf.width}" height="${leaf.height}"/></clipPath>
      <image href="data:image/jpeg;base64,${base64(PHOTO)}" x="${x}" y="${y}"
             width="${leaf.width}" height="${leaf.height}"
             preserveAspectRatio="xMidYMid slice" clip-path="url(#leaf)"/>

      <rect x="${right}" y="${y}" width="${leaf.width}" height="${leaf.height}" fill="${INK.paper}"/>
      <text x="${right + inner}" y="${y + 50}" font-family="Instrument Serif" font-size="25" fill="#1c1917">The long way round</text>
      ${column(right + inner, y + 76, 96, 27)}
      ${column(right + inner + 112, y + 76, 96, 27)}
      <rect x="${right + inner}" y="${y + leaf.height - 22}" width="16" height="2" rx="1" fill="${INK.column}"/>
    </g>`;
}

function artwork(): string {
  // The card sits in the middle of a square ground, because that is the shape
  // QuickLook will hand back whatever it is given.
  const top = (CARD.width - CARD.height) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.width}" height="${CARD.width}" viewBox="0 0 ${CARD.width} ${CARD.width}">
  <defs>
    <style>@font-face { font-family: "Instrument Serif"; src: url(data:font/ttf;base64,${base64(FONT)}) format("truetype"); }</style>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${INK.ground}" stop-opacity="1"/>
      <stop offset="1" stop-color="${INK.ground}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${CARD.width}" height="${CARD.width}" fill="${INK.ground}"/>

  <g transform="translate(0 ${top})">
    <rect width="${CARD.width}" height="${CARD.height}" fill="${INK.ground}"/>
    ${spread(632, (CARD.height - 336) / 2)}

    <g transform="translate(76 0)">
      <rect x="0" y="145" width="34" height="1" fill="${INK.quiet}" opacity="0.5"/>
      <text x="48" y="150" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="13"
            letter-spacing="3.4" fill="${INK.quiet}">OURATLAS.CO.IN</text>

      <text x="0" y="262" font-family="Instrument Serif" font-size="78" fill="${INK.type}">Your trip, set</text>
      <text x="0" y="338" font-family="Instrument Serif" font-size="78" fill="${INK.type}">as a magazine.</text>

      <text x="0" y="404" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="21" fill="${INK.quiet}">Ten photographs and your own words in.</text>
      <text x="0" y="436" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="21" fill="${INK.quiet}">A paginated issue out, ready to export.</text>

      <rect x="0" y="478" width="452" height="1" fill="${INK.rule}"/>
      <text x="0" y="512" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="16" fill="${INK.faint}">The photographs never leave your browser.</text>
    </g>
  </g>
</svg>`;
}

/** What `sips` says an image measures. */
function measure(file: string): { width: number; height: number } {
  const out = Bun.spawnSync(["sips", "-g", "pixelWidth", "-g", "pixelHeight", file]);
  const text = new TextDecoder().decode(out.stdout);
  const width = Number(/pixelWidth:\s*(\d+)/.exec(text)?.[1]);
  const height = Number(/pixelHeight:\s*(\d+)/.exec(text)?.[1]);
  if (!width || !height) throw new Error(`Could not read the size of ${file}`);
  return { width, height };
}

const run = (...argv: string[]) => {
  const done = Bun.spawnSync(argv);
  if (done.exitCode !== 0) throw new Error(new TextDecoder().decode(done.stderr));
};

/**
 * Fits a picture to the card: scaled until it covers, then cropped from the
 * middle. The same bargain `object-fit: cover` makes, and for the same reason —
 * letterboxing a share card leaves bars that read as a broken image.
 */
async function fromPicture(source: string) {
  const from = measure(source);
  const scratch = path.join(path.dirname(OUT), ".og-working.png");
  await Bun.write(scratch, Bun.file(source));

  // Whichever axis is furthest from the card decides the scale, so the other
  // ends up with something to spare rather than something missing.
  if (from.width / from.height > CARD.width / CARD.height) {
    run("sips", "--resampleHeight", String(CARD.height), scratch);
  } else {
    run("sips", "--resampleWidth", String(CARD.width), scratch);
  }
  run("sips", "-c", String(CARD.height), String(CARD.width), scratch);
  run("sips", "-s", "format", "jpeg", "-s", "formatOptions", String(QUALITY.picture), scratch, "--out", OUT);
  rmSync(scratch, { force: true });

  const size = measure(OUT);
  console.log(
    `  ${path.relative(ROOT, source)}  ${from.width}x${from.height}` +
      `  ->  ${path.relative(ROOT, OUT)}  ${size.width}x${size.height}  ${(Bun.file(OUT).size / 1024).toFixed(0)} KB`,
  );
}

const picture = Bun.argv[2];
if (picture) {
  if (!(await Bun.file(picture).exists())) throw new Error(`No such file: ${picture}`);
  await fromPicture(picture);
  process.exit(0);
}

const work = mkdtempSync(path.join(tmpdir(), "atlas-og-"));
try {
  const svg = path.join(work, "card.svg");
  await Bun.write(svg, artwork());

  // QuickLook writes <name>.png beside whatever -o names.
  const rendered = Bun.spawnSync(["qlmanage", "-t", "-s", String(CARD.width), "-o", work, svg]);
  const png = path.join(work, "card.svg.png");
  if (!(await Bun.file(png).exists())) {
    throw new Error(`qlmanage produced nothing:\n${new TextDecoder().decode(rendered.stderr)}`);
  }

  // Back out of the square: sips crops from the centre, which is where the
  // card was laid out.
  run("sips", "-c", String(CARD.height), String(CARD.width), png);
  run("sips", "-s", "format", "jpeg", "-s", "formatOptions", String(QUALITY.drawn), png, "--out", OUT);

  const size = Bun.file(OUT).size;
  console.log(`  ${path.relative(ROOT, OUT)}  ${CARD.width}x${CARD.height}  ${(size / 1024).toFixed(0)} KB`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
