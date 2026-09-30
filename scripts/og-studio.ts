/**
 * Draws the card that appears when a link to Atlas Studio is shared.
 *
 * The studio's pitch is its pages, so the card shows real ones: five layouts
 * from `src/lib/studio/pages.json`, set with the sample photographs in
 * `src/assets/studio`, beside a line of the site's own type. Drawn from the
 * same markup the studio shows, a card can never promise a page that is not
 * on the shelves.
 *
 * Rendered by Google Chrome rather than QuickLook (`og-image.ts`): the pages
 * are HTML and CSS, which QuickLook cannot lay out. Chrome is driven over its
 * debugging port with nothing installed from npm, and everything the card
 * needs (photographs, the face) is inlined as data, so no server runs and no
 * request leaves the machine. `sips` turns the capture into the JPEG, for the
 * same reason as og.jpg: WhatsApp declines thumbnails much over 300 KB.
 *
 * Like og.jpg it is generated here and committed, not drawn at build time, and
 * build.ts copies it from src/static unhashed so shared links keep finding it.
 *
 * Usage (macOS with Google Chrome):
 *   bun scripts/og-studio.ts
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const CARD = { width: 1200, height: 630 };
const ROOT = path.join(import.meta.dir, "..");
const OUT = path.join(ROOT, "src/static/og-studio.jpg");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** The brand, as the rest of the site's print pieces use it. */
const INK = { cream: "#f4efe6", ink: "#1a1512", clay: "#b4562c", marigold: "#f2a93b" };

/**
 * The pages, left to right, and where each sits. Chosen for range: a clay
 * poster, a travel-poster cover, black-and-white, loud colour and a quiet
 * arch, so the card says "every mood" without a word about it. Offsets are in
 * card pixels; the last page runs off the edge on purpose, as a table of
 * proofs would.
 */
const SPREAD: { id: string; x: number; y: number; tilt: number }[] = [
  { id: "poster", x: 528, y: 150, tilt: -3.5 },
  { id: "th-riviera-01", x: 680, y: 58, tilt: 1.5 },
  { id: "th-noir-01", x: 830, y: 196, tilt: -1.5 },
  { id: "th-pop-01", x: 968, y: 40, tilt: 2.5 },
  { id: "th-garden-01", x: 1080, y: 214, tilt: -2 },
];
/** Every page is drawn this wide on the card; the studio's pages are 780×1040. */
const PAGE_WIDTH = 270;

type Page = { id: string; width: number; height: number; css: string; html: string };

const base64 = async (file: string) => Buffer.from(await Bun.file(file).arrayBuffer()).toString("base64");
const attribute = (text: string) => text.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

const { sections } = (await Bun.file(path.join(ROOT, "src/lib/studio/pages.json")).json()) as { sections: { pages: Page[] }[] };
const pages = new Map(sections.flatMap(section => section.pages.map(page => [page.id, page] as const)));
const font = `data:font/ttf;base64,${await base64(path.join(ROOT, "src/static/instrument-serif.ttf"))}`;

const photos = new Map<string, string>();
async function photo(name: string): Promise<string> {
  if (!photos.has(name)) photos.set(name, `data:image/jpeg;base64,${await base64(path.join(ROOT, "src/assets/studio", `${name}.jpg`))}`);
  return photos.get(name)!;
}

/** One page as a document for a frame, as `pageDocument` in lib/studio.ts builds it, with the pictures inlined. */
async function frame(page: Page): Promise<string> {
  let source = `${page.css}\u0000${page.html}`;
  for (const [, name] of source.matchAll(/%photo:([\w-]+)%/g)) source = source.replaceAll(`%photo:${name}%`, await photo(name!));
  const [css, html] = source.split("\u0000");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
@font-face{font-family:"Instrument Serif";font-style:normal;font-weight:400;font-display:block;src:url("${font}") format("truetype")}
${css}
html,body{margin:0;overflow:hidden;background:transparent}
</style></head><body>${html}</body></html>`;
}

async function card(): Promise<string> {
  const leaves: string[] = [];
  for (const [index, place] of SPREAD.entries()) {
    const page = pages.get(place.id);
    if (!page) throw new Error(`og-studio: no studio page "${place.id}"; pick another from pages.json`);
    const scale = PAGE_WIDTH / page.width;
    leaves.push(`<div class="leaf" style="left:${place.x}px;top:${place.y}px;width:${PAGE_WIDTH}px;height:${page.height * scale}px;transform:rotate(${place.tilt}deg);z-index:${index + 1}">
  <iframe srcdoc="${attribute(await frame(page))}" style="width:${page.width}px;height:${page.height}px;transform:scale(${scale})"></iframe>
</div>`);
  }

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
@font-face{font-family:"Instrument Serif";src:url("${font}") format("truetype")}
html,body{margin:0;width:${CARD.width}px;height:${CARD.height}px;overflow:hidden;background:${INK.cream}}
.leaf{position:absolute;overflow:hidden;background:#fff;box-shadow:0 2px 4px rgba(26,21,18,.18),0 18px 40px rgba(26,21,18,.22);transform-origin:50% 50%}
.leaf iframe{border:0;position:absolute;top:0;left:0;transform-origin:0 0}
.copy{position:absolute;left:64px;top:0;bottom:0;width:440px;display:flex;flex-direction:column;justify-content:center;gap:22px;z-index:10}
.kicker{display:flex;align-items:center;gap:14px;font:600 14px/1 "Helvetica Neue",Helvetica,Arial,sans-serif;letter-spacing:.26em;text-transform:uppercase;color:${INK.clay}}
.kicker::before{content:"";width:36px;height:3px;background:${INK.marigold}}
h1{margin:0;font:400 76px/.98 "Instrument Serif",serif;letter-spacing:-.01em;color:${INK.ink}}
h1 em{font-style:italic;color:${INK.clay}}
p{margin:0;font:400 21px/1.4 "Helvetica Neue",Helvetica,Arial,sans-serif;color:rgba(26,21,18,.74)}
.address{font:500 15px/1 "Helvetica Neue",Helvetica,Arial,sans-serif;letter-spacing:.04em;color:${INK.ink};margin-top:10px}
</style></head><body>
${leaves.join("\n")}
<div class="copy">
  <div class="kicker">Atlas Studio</div>
  <h1>Magazine layouts for <em>your own</em> photos</h1>
  <p>From one-page magazines to complete issues. Fill any with your pictures and words, and download a PDF.</p>
  <div class="address">ouratlas.co.in/studio</div>
</div>
</body></html>`;
}

/** Loads the card in Chrome and returns a PNG of exactly the card's size. */
async function capture(file: string, work: string): Promise<Uint8Array> {
  const port = 9300 + Math.floor(Math.random() * 500);
  const chrome = Bun.spawn([CHROME, "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(work, "profile")}`, "about:blank"], {
    stdout: "ignore",
    stderr: "ignore",
  });
  try {
    let targets: { type: string; webSocketDebuggerUrl: string }[] = [];
    for (let attempt = 0; attempt < 50 && !targets.length; attempt++) {
      await Bun.sleep(200);
      targets = await fetch(`http://127.0.0.1:${port}/json`).then(response => response.json() as Promise<typeof targets>, () => []);
    }
    const target = targets.find(entry => entry.type === "page");
    if (!target) throw new Error("og-studio: Chrome did not open a page");

    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(resolve => (socket.onopen = resolve));
    let next = 0;
    const waiting = new Map<number, (result: any) => void>();
    const events = new Map<string, () => void>();
    socket.onmessage = message => {
      const data = JSON.parse(String(message.data));
      if (data.id) waiting.get(data.id)?.(data.result);
      if (data.method) events.get(data.method)?.();
    };
    const send = (method: string, params: object = {}) =>
      new Promise<any>(resolve => {
        const id = ++next;
        waiting.set(id, resolve);
        socket.send(JSON.stringify({ id, method, params }));
      });

    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { ...CARD, deviceScaleFactor: 1, mobile: false });
    const loaded = new Promise<void>(resolve => events.set("Page.loadEventFired", resolve));
    await send("Page.navigate", { url: `file://${file}` });
    await loaded;
    // The frames' faces and pictures are data, but decoding them is not instant.
    await send("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true });
    await Bun.sleep(800);
    const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, ...CARD, scale: 1 } });
    socket.close();
    return Buffer.from(shot.data, "base64");
  } finally {
    chrome.kill();
  }
}

const work = mkdtempSync(path.join(tmpdir(), "atlas-og-studio-"));
try {
  const html = path.join(work, "card.html");
  await Bun.write(html, await card());
  const png = path.join(work, "card.png");
  await Bun.write(png, await capture(html, work));
  const converted = Bun.spawnSync(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "86", png, "--out", OUT]);
  if (converted.exitCode !== 0) throw new Error(new TextDecoder().decode(converted.stderr));
  console.log(`  ${path.relative(ROOT, OUT)}  ${CARD.width}x${CARD.height}  ${(Bun.file(OUT).size / 1024).toFixed(0)} KB`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
