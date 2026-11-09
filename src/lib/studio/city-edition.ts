/**
 * The City Edition: thirteen pages for a weekly issue about one city, set with a
 * sample week of Bengaluru news (5–8 November 2026).
 *
 * Written here rather than drawn on the design canvas, so it is not in
 * `pages.json` (which only `scripts/studio.ts` writes). `loadStudio` adds it to
 * the shelves after the canvas's own sections, in the same lazy chunk.
 *
 * The other complete issues tell one story; a city edition carries many short
 * ones, so its pages are built for that: a front page with teasers, contents by
 * section, big figures, briefs, two outlets disagreeing side by side, a transit
 * route, a timeline of dates, a funding table, scorecards, a week of dates, a reader's page and a
 * sources page. Every page is sized in container units (`cqw`) against its own
 * 780px width, so it draws the same at any scale the studio shows it.
 *
 * Only the site's Instrument Serif is a webfont here; the sans and mono are
 * system stacks, like the rest of the studio. The diagrams are inline SVG,
 * which the editor leaves alone (`fill-in.tsx` skips anything inside `svg`),
 * so their station names are part of the drawing, not text to retype.
 *
 * The photographs are openly licensed (Wikimedia Commons), credited on the
 * last page, and named `blr-*` in `src/lib/studio.ts`.
 */

import type { StudioPage, StudioSection } from "@/lib/studio";

const CSS = `.page {
  --paper: #fdfdfc; --ink: #1b191e; --muted: #6b6672; --rule: #dad7de;
  --purple: #7a2c8c; --green: #23884a; --yellow: #c99a06; --pink: #cf437d; --blue: #2a63b3;
  --display: "Instrument Serif", ui-serif, Georgia, "Times New Roman", serif;
  --sans: "Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif;
  --mono: ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  container-type: inline-size; position: relative; width: 780px; height: 1040px; box-sizing: border-box;
  background: var(--paper); color: var(--ink); overflow: hidden;
  font-family: var(--sans); font-size: 2.3cqw; line-height: 1.45;
}
.page * { box-sizing: border-box; }
.pin { position: absolute; inset: 6.5cqw 7cqw 8.5cqw; display: flex; flex-direction: column; gap: 2.6cqw; min-height: 0; }
.folio { position: absolute; left: 7cqw; right: 7cqw; bottom: 3.4cqw; display: flex; justify-content: space-between; font-family: var(--mono); font-size: 1.55cqw; color: var(--muted); letter-spacing: 0.04em; text-transform: uppercase; }
.lbl { font-family: var(--sans); font-weight: 600; font-size: 1.55cqw; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); }
.lbl.c { color: var(--c, var(--muted)); }
.hd { font-family: var(--display); font-weight: 400; line-height: 0.98; letter-spacing: -0.005em; margin: 0; text-wrap: balance; }
.src { font-family: var(--mono); font-size: 1.45cqw; color: var(--muted); line-height: 1.4; }
.cap { font-size: 1.6cqw; color: var(--muted); line-height: 1.35; }
.photo { display: block; width: 100%; height: 100%; object-fit: cover; }
.lines { display: flex; gap: 0.6cqw; height: 0.9cqw; }
.lines i { flex: 1; }
.flag { display: inline-block; font-family: var(--mono); font-size: 1.4cqw; color: var(--paper); background: var(--pink); padding: 0.15cqw 0.8cqw; border-radius: 0.4cqw; letter-spacing: 0.04em; vertical-align: 0.2cqw; }
.page p { margin: 0; }

/* 01 City Front */
.front .mast { display: flex; align-items: baseline; justify-content: space-between; gap: 2cqw; }
.front .mast h3 { font-size: 13.5cqw; }
.front .mast h3 i { font-style: italic; color: var(--purple); }
.front .date { font-family: var(--mono); font-size: 1.55cqw; color: var(--muted); text-align: right; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.5; }
.front .hero { flex: 1 1 auto; min-height: 0; position: relative; }
.front .hero .cap { position: absolute; left: 1.4cqw; bottom: 1.2cqw; color: #fff; text-shadow: 0 0 0.6cqw rgba(0,0,0,0.7); font-size: 1.4cqw; }
.front .lead { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 3cqw; align-items: end; }
.front .lead h4 { font-size: 6.4cqw; }
.front .lead p { font-size: 2.15cqw; color: var(--muted); }
.teasers { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2.4cqw; border-top: 0.25cqw solid var(--ink); padding-top: 1.6cqw; }
.teasers div { display: grid; gap: 0.5cqw; align-content: start; border-left: 0.6cqw solid var(--c); padding-left: 1.4cqw; }
.teasers b { font-family: var(--display); font-weight: 400; font-size: 2.9cqw; line-height: 1.02; }
.teasers span { font-family: var(--mono); font-size: 1.45cqw; color: var(--muted); }

/* 02 Section Index */
.index .route { position: relative; display: grid; gap: 0; margin-top: 1cqw; }
.index .route::before { content: ""; position: absolute; left: 3.1cqw; top: 3cqw; bottom: 3cqw; width: 0.9cqw; background: linear-gradient(var(--purple) 0 16%, var(--green) 16% 32%, var(--pink) 32% 48%, var(--blue) 48% 64%, var(--yellow) 64% 80%, var(--purple) 80% 100%); border-radius: 1cqw; }
.stop { position: relative; display: grid; grid-template-columns: 7cqw minmax(0, 1fr) auto; gap: 2.2cqw; align-items: center; padding: 1.15cqw 0; }
.stop .dot { width: 7cqw; height: 7cqw; border-radius: 50%; background: var(--paper); border: 0.9cqw solid var(--c); display: grid; place-items: center; font-family: var(--mono); font-size: 1.9cqw; font-weight: 500; position: relative; z-index: 1; }
.stop b { font-family: var(--display); font-weight: 400; font-size: 4.1cqw; line-height: 1; display: block; }
.stop span { font-size: 1.95cqw; color: var(--muted); }
.stop .pg { font-family: var(--mono); font-size: 1.6cqw; color: var(--muted); }
.index .how { margin-top: auto; border-top: 0.15cqw solid var(--rule); padding-top: 1.8cqw; font-size: 1.9cqw; color: var(--muted); display: grid; gap: 0.6cqw; }

/* 03 By the Numbers */
.numbers .grid { flex: 1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(3, minmax(0, 1fr)); border-top: 0.25cqw solid var(--ink); }
.numbers .n { padding: 2.2cqw 2.4cqw 1.6cqw 0; border-bottom: 0.15cqw solid var(--rule); display: flex; flex-direction: column; gap: 0.9cqw; }
.numbers .n:nth-child(even) { padding-left: 2.6cqw; border-left: 0.15cqw solid var(--rule); }
.numbers .n strong { font-family: var(--display); font-weight: 400; font-size: 10.5cqw; line-height: 0.9; color: var(--c); font-variant-numeric: lining-nums tabular-nums; letter-spacing: -0.02em; }
.numbers .n p { font-size: 2.05cqw; line-height: 1.35; }
.numbers .n .src { margin-top: auto; }

/* 04 Broadsheet Lead */
.lead-pg h3 { font-size: 7.4cqw; }
.lead-pg .stand { font-size: 2.35cqw; color: var(--muted); max-width: 88%; }
.lead-pg .body { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: auto minmax(0, 1fr); gap: 1.8cqw 2.6cqw; }
.lead-pg .ph { grid-column: 2 / 4; grid-row: 1; display: grid; gap: 0.8cqw; }
.lead-pg .ph img { aspect-ratio: 16 / 9; height: auto; }
.lead-pg .c1 { grid-column: 1; grid-row: 1 / 3; }
.lead-pg .c2 { grid-column: 2; grid-row: 2; }
.lead-pg .c3 { grid-column: 3; grid-row: 2; }
.lead-pg .col { font-size: 2.05cqw; line-height: 1.46; display: grid; gap: 1.1cqw; align-content: start; text-align: left; hyphens: auto; }
.lead-pg .c1 p:first-child::first-letter { font-family: var(--display); float: left; font-size: 7.2cqw; line-height: 0.8; padding: 0.6cqw 0.8cqw 0 0; color: var(--purple); }
.pull { font-family: var(--display); font-style: italic; font-size: 3.4cqw; line-height: 1.08; color: var(--purple); border-top: 0.25cqw solid var(--purple); padding-top: 1.2cqw; }

/* 05 Desk Briefs */
.briefs-pg h3 { font-size: 7.8cqw; }
.briefs-pg .grid { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 0; border-top: 0.25cqw solid var(--ink); }
.brief { padding: 2.2cqw 2.4cqw 1.8cqw 0; display: flex; flex-direction: column; gap: 1cqw; border-bottom: 0.15cqw solid var(--rule); min-height: 0; }
.brief:nth-child(even) { padding-left: 2.6cqw; padding-right: 0; border-left: 0.15cqw solid var(--rule); }
.brief .where { font-family: var(--mono); font-size: 1.5cqw; color: var(--green); text-transform: uppercase; letter-spacing: 0.06em; }
.brief b { font-family: var(--display); font-weight: 400; font-size: 4.2cqw; line-height: 1; }
.brief p { font-size: 2.3cqw; line-height: 1.42; }
.brief .shot { flex: 1 1 auto; min-height: 0; position: relative; }
.brief .shot .cap { position: absolute; left: 1cqw; bottom: 0.8cqw; color: #fff; text-shadow: 0 0 0.6cqw rgba(0,0,0,0.75); font-size: 1.3cqw; }
.brief .src { margin-top: auto; }

/* 06 Two Reports */
.two .band { height: 30%; flex: none; position: relative; }
.two .band .cap { position: absolute; right: 1.2cqw; bottom: 1cqw; color: #fff; text-shadow: 0 0 0.6cqw rgba(0,0,0,0.75); font-size: 1.4cqw; }
.two h3 { font-size: 7cqw; }
.claim { display: grid; gap: 1.2cqw; border-top: 0.25cqw solid var(--ink); padding-top: 1.6cqw; }
.claim .what { font-size: 2.05cqw; line-height: 1.42; }
.vs { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 2cqw; align-items: stretch; }
.vs .side { background: color-mix(in srgb, var(--pink) 7%, var(--paper)); border: 0.15cqw solid color-mix(in srgb, var(--pink) 30%, var(--paper)); border-radius: 0.8cqw; padding: 1.6cqw 1.8cqw; display: grid; gap: 0.5cqw; }
.vs .side strong { font-family: var(--display); font-weight: 400; font-size: 5.4cqw; line-height: 0.95; }
.vs .side span { font-family: var(--mono); font-size: 1.5cqw; color: var(--muted); }
.vs .or { align-self: center; font-family: var(--display); font-style: italic; font-size: 3cqw; color: var(--pink); }
.two .rule-note { margin-top: auto; font-size: 1.85cqw; color: var(--muted); border-top: 0.15cqw solid var(--rule); padding-top: 1.4cqw; }

/* 07 The Line */
.line-pg h3 { font-size: 7.4cqw; }
.line-pg svg { display: block; width: 100%; height: auto; overflow: visible; }
.line-pg .blk { display: grid; gap: 1.2cqw; border-top: 0.25cqw solid var(--ink); padding-top: 1.6cqw; }
.line-pg .blk b { font-family: var(--display); font-weight: 400; font-size: 3.8cqw; line-height: 1; }
.line-pg .blk p { font-size: 2cqw; line-height: 1.42; }
.steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1.4cqw; }
.steps div { border-top: 0.6cqw solid var(--pink); padding-top: 0.9cqw; display: grid; gap: 0.3cqw; align-content: start; }
.steps div.next { border-top-style: dotted; }
.steps em { font-style: normal; font-family: var(--mono); font-size: 1.5cqw; color: var(--muted); }
.steps span { font-size: 1.85cqw; line-height: 1.3; }
.ahead { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2cqw; }
.ahead div { display: grid; gap: 0.4cqw; align-content: start; border-left: 0.6cqw solid var(--c); padding-left: 1.3cqw; }
.line-pg .fill { flex: 1 1 auto; min-height: 0; position: relative; }
.line-pg .fill .cap { position: absolute; left: 1.2cqw; bottom: 1cqw; color: #fff; text-shadow: 0 0 0.6cqw rgba(0,0,0,0.75); font-size: 1.4cqw; }
.ahead strong { font-family: var(--display); font-weight: 400; font-size: 3.4cqw; line-height: 1; }
.ahead span { font-size: 1.8cqw; line-height: 1.3; }

/* 08 Timeline */
.timeline h3 { font-size: 7.4cqw; }
.timeline .stand { font-size: 2.2cqw; color: var(--muted); max-width: 88%; }
.tl { list-style: none; margin: 0; padding: 0; flex: 1; min-height: 0; display: grid; grid-auto-rows: minmax(0, 1fr); position: relative; border-top: 0.25cqw solid var(--ink); }
.tl::before { content: ""; position: absolute; left: 20.55cqw; top: 0; bottom: 0; width: 0.5cqw; background: var(--rule); }
.tl li { display: grid; grid-template-columns: 17cqw 4.4cqw minmax(0, 1fr); gap: 0 1.6cqw; align-items: start; padding-top: 1.5cqw; min-height: 0; }
.tl time { font-family: var(--mono); font-size: 1.9cqw; text-align: right; padding-top: 0.7cqw; }
.tl .nd { display: block; width: 3.6cqw; height: 3.6cqw; border-radius: 50%; background: var(--paper); border: 0.7cqw solid var(--pink); justify-self: center; margin-top: 0.3cqw; position: relative; z-index: 1; }
.tl .miss .nd { border-color: var(--muted); }
.tl .done .nd { background: var(--green); border-color: var(--green); }
.tl .next .nd { background: color-mix(in srgb, var(--pink) 25%, var(--paper)); }
.tl .far .nd { border-style: dotted; }
.tl li > div { display: grid; gap: 0.35cqw; align-content: start; }
.tl .st { font-family: var(--mono); font-size: 1.35cqw; letter-spacing: 0.08em; text-transform: uppercase; color: var(--pink); }
.tl .miss .st { color: var(--muted); }
.tl .done .st { color: var(--green); }
.tl b { font-family: var(--display); font-weight: 400; font-size: 3.5cqw; line-height: 1; }
.tl li > div > span:last-child { font-size: 1.85cqw; line-height: 1.32; color: var(--muted); }

/* 09 Ledger Table */
.ledger-pg h3 { font-size: 7.4cqw; }
.ledger-pg table { width: 100%; border-collapse: collapse; }
.ledger-pg th { font-family: var(--sans); font-weight: 600; font-size: 1.5cqw; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); text-align: left; padding: 0 1.5cqw 1cqw 0; border-bottom: 0.25cqw solid var(--ink); }
.ledger-pg th:last-child, .ledger-pg td:last-child { text-align: right; padding-right: 0; }
.ledger-pg td { padding: 1.6cqw 1.5cqw 1.6cqw 0; border-bottom: 0.15cqw solid var(--rule); vertical-align: top; font-size: 1.95cqw; line-height: 1.38; }
.ledger-pg td.co b { font-family: var(--display); font-weight: 400; font-size: 3.2cqw; line-height: 1; display: block; }
.ledger-pg td.co span { font-family: var(--mono); font-size: 1.4cqw; color: var(--muted); }
.ledger-pg td.amt { font-family: var(--display); font-size: 4.2cqw; line-height: 1; white-space: nowrap; color: var(--blue); }
.ledger-pg td.amt small { display: block; font-family: var(--mono); font-size: 1.35cqw; color: var(--muted); margin-top: 0.6cqw; }
.ledger-pg .foot { margin-top: auto; font-size: 1.8cqw; color: var(--muted); border-top: 0.15cqw solid var(--rule); padding-top: 1.4cqw; }

/* 10 Scoreboard */
.score .ph { height: 40%; flex: none; position: relative; }
.score .ph .cap { position: absolute; left: 1.2cqw; bottom: 1cqw; color: #fff; text-shadow: 0 0 0.6cqw rgba(0,0,0,0.75); font-size: 1.4cqw; }
.score h3 { font-size: 7cqw; }
.card { border: 0.2cqw solid var(--ink); display: grid; }
.card .top { background: var(--ink); color: var(--paper); padding: 1.1cqw 1.6cqw; display: flex; justify-content: space-between; gap: 2cqw; font-family: var(--mono); font-size: 1.5cqw; letter-spacing: 0.05em; text-transform: uppercase; }
.card .rows { display: grid; }
.card .row { display: grid; grid-template-columns: 34% minmax(0, 1fr); border-top: 0.15cqw solid var(--rule); }
.card .row:first-child { border-top: 0; }
.card .row span { padding: 0.9cqw 1.6cqw; font-size: 1.95cqw; }
.card .row span:first-child { font-family: var(--mono); font-size: 1.5cqw; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; padding-top: 1.15cqw; }
.card .big { padding: 1.4cqw 1.6cqw; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 2cqw; font-family: var(--display); font-size: 3.6cqw; line-height: 1; }
.card .big .sc { font-size: 6.6cqw; color: var(--yellow); font-variant-numeric: tabular-nums; }
.card .big span:last-child { text-align: right; }

/* 11 Week Ahead */
.week h3 { font-size: 7.4cqw; }
.days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-top: 0.25cqw solid var(--ink); }
.day { border-right: 0.15cqw solid var(--rule); padding: 1cqw 0.9cqw 1.2cqw; min-height: 22cqw; display: flex; flex-direction: column; gap: 0.7cqw; }
.day:last-child { border-right: 0; }
.day .dn { font-family: var(--mono); font-size: 1.45cqw; color: var(--muted); text-transform: uppercase; }
.day .dd { font-family: var(--display); font-size: 5.2cqw; line-height: 0.9; }
.ev { font-size: 1.6cqw; line-height: 1.25; border-left: 0.5cqw solid var(--c); padding-left: 0.7cqw; }
.later { display: grid; gap: 0; border-top: 0.25cqw solid var(--ink); }
.later div { display: grid; grid-template-columns: 17cqw minmax(0, 1fr); gap: 2cqw; padding: 1.25cqw 0; border-bottom: 0.15cqw solid var(--rule); }
.later em { font-style: normal; font-family: var(--mono); font-size: 1.6cqw; color: var(--purple); padding-top: 0.3cqw; }
.later b { font-family: var(--display); font-weight: 400; font-size: 3cqw; line-height: 1; display: block; }
.later span { font-size: 1.85cqw; color: var(--muted); }

/* 12 Reader's Page */
.reader .top { height: 47%; flex: none; display: grid; grid-template-columns: 41% minmax(0, 1fr); gap: 3cqw; min-height: 0; }
.reader .shot { margin: 0; display: flex; flex-direction: column; gap: 0.8cqw; min-height: 0; }
.reader .shot img { flex: 1 1 auto; min-height: 0; }
.reader .head { display: flex; flex-direction: column; justify-content: flex-end; gap: 1.3cqw; min-width: 0; }
.reader .eg { font-family: var(--mono); font-size: 1.4cqw; color: var(--paper); background: var(--muted); padding: 0.15cqw 0.8cqw; border-radius: 0.4cqw; letter-spacing: 0.06em; text-transform: uppercase; }
.reader h3 { font-size: 6.6cqw; }
.reader .stand { font-size: 2.3cqw; line-height: 1.35; color: var(--muted); }
.reader .by { font-family: var(--mono); font-size: 1.6cqw; text-transform: uppercase; letter-spacing: 0.05em; border-top: 0.15cqw solid var(--rule); padding-top: 1.1cqw; }
.reader .credit { font-family: var(--mono); font-size: 1.45cqw; color: var(--muted); }
.reader .story { columns: 2; column-gap: 2.8cqw; font-size: 2.05cqw; line-height: 1.46; }
.reader .story p + p { margin-top: 1cqw; }
.reader .story p:first-child::first-letter { font-family: var(--display); float: left; font-size: 6.4cqw; line-height: 0.8; padding: 0.5cqw 0.8cqw 0 0; color: var(--purple); }
.reader .story .pull { break-inside: avoid; margin-block: 1.6cqw; }
.reader .send { margin-top: auto; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2.6cqw; border-top: 0.25cqw solid var(--ink); padding-top: 1.6cqw; }
.reader .send div { display: grid; gap: 0.6cqw; align-content: start; }
.reader .send b { font-family: var(--display); font-weight: 400; font-size: 3.2cqw; line-height: 1; }
.reader .send span { font-size: 1.85cqw; line-height: 1.4; color: var(--muted); }

/* 13 Sources & Credits */
.credits h3 { font-size: 7cqw; }
.credits .cols { flex: 1; min-height: 0; columns: 2; column-gap: 3cqw; column-rule: 0.15cqw solid var(--rule); font-size: 1.62cqw; line-height: 1.38; }
.credits .cols div { break-inside: avoid; margin-bottom: 1.5cqw; }
.credits .cols b { font-family: var(--sans); font-weight: 600; font-size: 1.45cqw; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); display: block; margin-bottom: 0.3cqw; }
.credits .made { border-top: 0.25cqw solid var(--ink); padding-top: 1.6cqw; font-size: 1.9cqw; line-height: 1.4; display: grid; gap: 0.8cqw; }`;

const page = (id: string, title: string, html: string): StudioPage => ({ id: `city-${id}`, title, width: 780, height: 1040, css: CSS, html });

export const CITY_EDITION: StudioSection = {
  id: "city-edition",
  group: "issues",
  name: "City Edition · Bengaluru",
  blurb: "A week in one city on thirteen pages: front page, contents by section, the numbers, briefs, two reports side by side, the metro line, a timeline of dates, the ledger, the scoreboard and the week ahead",
  pages: [
    page("01-front", "City Front", `<div class="page front"><div class="pin">
<div class="mast"><h3 class="hd">Atlas <i>Bengaluru</i></h3><div class="date">Week 45<br>5–8 Nov 2026<br>Issue 02</div></div>
<div class="lines" aria-hidden="true"><i style="background:var(--purple)"></i><i style="background:var(--green)"></i><i style="background:var(--yellow)"></i><i style="background:var(--pink)"></i><i style="background:var(--blue)"></i></div>
<div class="hero"><img class="photo" src="%photo:blr-viaduct%" alt="Traffic under the Namma Metro viaduct near Jayadeva Hospital"><span class="cap">Namma Metro viaduct near Jayadeva Hospital · Gpkp, CC BY-SA 4.0</span></div>
<div class="lead">
<h4 class="hd">A metro line, cleared and waiting for a date</h4>
<p>The Pink Line has its safety clearance and two possible opening days, 13 and 15 November, while a week of light rain was forecast.</p>
</div>
<div class="teasers">
<div style="--c:var(--pink)"><b>Two dates for one opening</b><span>p. 06</span></div>
<div style="--c:var(--pink)"><b>Seven dates for one line</b><span>p. 08</span></div>
<div style="--c:var(--blue)"><b>Farm waste, $10.3M</b><span>p. 09</span></div>
</div>
</div><div class="folio"><span>Atlas Bengaluru</span><span>01</span></div></div>`),
    page("02-index", "Section Index", `<div class="page index"><div class="pin">
<span class="lbl">In this issue</span>
<div class="route">
<div class="stop" style="--c:var(--purple)"><span class="dot">03</span><div><b>By the numbers</b><span>The week in six figures</span></div><span class="pg">p. 03</span></div>
<div class="stop" style="--c:var(--purple)"><span class="dot">04</span><div><b>Cleared, not dated</b><span>The Pink Line before its opening</span></div><span class="pg">p. 04</span></div>
<div class="stop" style="--c:var(--green)"><span class="dot">05</span><div><b>City desk</b><span>Regularisation fees, e-khata, rain, Deepavali</span></div><span class="pg">p. 05</span></div>
<div class="stop" style="--c:var(--pink)"><span class="dot">06</span><div><b>Two reports</b><span>The opening day and the summit venue</span></div><span class="pg">p. 06</span></div>
<div class="stop" style="--c:var(--pink)"><span class="dot">07</span><div><b>On the line</b><span>Six stations, 7.5 km</span></div><span class="pg">p. 07</span></div>
<div class="stop" style="--c:var(--pink)"><span class="dot">08</span><div><b>Timeline</b><span>Seven dates for one line</span></div><span class="pg">p. 08</span></div>
<div class="stop" style="--c:var(--blue)"><span class="dot">09</span><div><b>The ledger</b><span>Bengaluru companies and their money</span></div><span class="pg">p. 09</span></div>
<div class="stop" style="--c:var(--yellow)"><span class="dot">10</span><div><b>Field &amp; ground</b><span>Bengaluru FC in Goa</span></div><span class="pg">p. 10</span></div>
<div class="stop" style="--c:var(--purple)"><span class="dot">11</span><div><b>The week ahead</b><span>Opening day, the summit and later</span></div><span class="pg">p. 11</span></div>
<div class="stop" style="--c:var(--purple)"><span class="dot">12</span><div><b>Reader's page</b><span>Your Bengaluru, in your words</span></div><span class="pg">p. 12</span></div>
</div>
<div class="how"><span>Every item ends with its source. <span class="flag">2 reports</span> marks a date or figure the papers disagree on.</span></div>
</div><div class="folio"><span>Contents</span><span>02</span></div></div>`),
    page("03-numbers", "By the Numbers", `<div class="page numbers"><div class="pin">
<span class="lbl">By the numbers</span>
<h3 class="hd" style="font-size:7.4cqw">The week, counted</h3>
<div class="grid">
<div class="n" style="--c:var(--pink)"><strong>15 Nov</strong><p>The day the Chief Minister said the Prime Minister would open the Pink Line. Not yet confirmed.</p><span class="src">The Hans India; Construction World</span></div>
<div class="n" style="--c:var(--pink)"><strong>7.5 km</strong><p>The elevated Kalena Agrahara–Tavarekere stretch, cleared by the Commissioner of Metro Railway Safety.</p><span class="src">Swarajya; Construction World</span></div>
<div class="n" style="--c:var(--blue)"><strong>$10.3M</strong><p>Series A closed by altM, a Bengaluru maker of chemicals from farm waste.</p><span class="src">The Week, 5 Nov</span></div>
<div class="n" style="--c:var(--green)"><strong>254</strong><p>Applications at the e-khata melas in Bengaluru South on Sunday. 93 were cleared.</p><span class="src">Deccan Herald, 8–9 Nov</span></div>
<div class="n" style="--c:var(--green)"><strong>50%</strong><p>The cut in fees to regularise houses built on BDA-notified layouts.</p><span class="src">Deccan Herald, 8–9 Nov</span></div>
<div class="n" style="--c:var(--yellow)"><strong>5 days</strong><p>Of light to moderate rain the IMD expected in Bengaluru, 6 to 10 November.</p><span class="src">Goodreturns, 5 Nov</span></div>
</div>
</div><div class="folio"><span>By the numbers</span><span>03</span></div></div>`),
    page("04-lead", "Broadsheet Lead", `<div class="page lead-pg"><div class="pin">
<span class="lbl c" style="--c:var(--pink)">Cleared, not dated</span>
<h3 class="hd">The Pink Line is ready for a date</h3>
<p class="stand">The elevated stretch has its safety clearance. What it does not yet have is an opening day.</p>
<div class="body">
<div class="ph"><img class="photo" src="%photo:blr-pink-line%" alt="Pink Line route map above the doors inside a metro coach"><span class="cap">The Pink Line map inside a coach · Mallikarjunasj, CC BY-SA 3.0</span></div>
<div class="col c1">
<p>The Commissioner of Metro Railway Safety cleared the 7.5-kilometre elevated stretch between Kalena Agrahara, on Bannerghatta Road, and Tavarekere on Wednesday 28 October. Clearance comes before passengers, not instead of them.</p>
<p>Chief Minister D K Shivakumar has said the Prime Minister will come on 15 November to open it. The state is still waiting for the Centre to confirm a date.</p>
<p class="pull">Cleared 28 October. Dated: not yet.</p>
</div>
<div class="col c2">
<p>The stations named in the reports are Kalena Agrahara, Hulimavu, IIM-B, JP Nagar 4th Phase, Jayadeva Hospital and Tavarekere. The opening takes the Namma Metro network past 100 kilometres and adds an interchange with the Yellow Line.</p>
<p>The underground stretch from Dairy Circle to Nagawara is not part of it. Swarajya reports a May 2027 target for that one.</p>
</div>
<div class="col c3">
<p>Dates have slipped before. A 15 August launch was reported in August, and a September opening after that. Page 08 sets them in order.</p>
<p>OneIndia puts the opening on 13 November. Page 06 sets the two dates side by side.</p>
<p class="src">Swarajya · Construction World · The Hans India · OneIndia · NewsBytes · Business Today</p>
</div>
</div>
</div><div class="folio"><span>Feature</span><span>04</span></div></div>`),
    page("05-briefs", "Desk Briefs", `<div class="page briefs-pg"><div class="pin">
<span class="lbl c" style="--c:var(--green)">City desk</span>
<h3 class="hd">Around town</h3>
<div class="grid">
<div class="brief"><span class="where">Citywide</span><b>Half the fee to make a home legal</b><p>Karnataka has halved the fees for regularising houses built without approval on BDA-notified layouts. The Chief Minister was due to review the scheme with senior BDA officials on Monday and to launch an online application system.</p><span class="src">Deccan Herald, 8–9 Nov</span></div>
<div class="brief"><span class="where">Bengaluru South</span><b>A Sunday for e-khata</b><p>The Bengaluru South city corporation held e-khata melas at 12 centres on Sunday. Of 254 applications, 93 were cleared. Similar melas ran across all five corporations.</p><span class="src">Deccan Herald, 8 Nov</span></div>
<div class="brief"><span class="where">Weather</span><b>Drizzle through the week</b><p>The IMD expected light to moderate rain in Bengaluru from 6 to 10 November, tied to a weakened system over the Bay of Bengal. Its outlook for the month leans below normal for much of Karnataka.</p><span class="src">Goodreturns, 5 Nov · The Week, 1 Nov</span></div>
<div class="brief"><span class="where">Central business district</span><b>Deepavali at KR Market</b><p>Sunday was Deepavali. Deccan Herald's weekend coverage included KR Market lit up for the festival. We found no reliable reports on this year's traffic, air quality or crackers, so none are printed.</p><div class="shot"><img class="photo" src="%photo:blr-kr-market%" alt="Krishna Rajendra Market metro station entrance"><span class="cap">KR Market station · Gpkp, CC BY-SA 4.0</span></div><span class="src">Deccan Herald, 8–9 Nov</span></div>
</div>
</div><div class="folio"><span>City desk</span><span>05</span></div></div>`),
    page("06-two-reports", "Two Reports", `<div class="page two"><div class="pin">
<div class="band"><img class="photo" src="%photo:blr-town-hall%" alt="Sir Puttanna Chetty Town Hall, Bengaluru"><span class="cap">Town Hall · Harvinder Chandigarh, CC BY 4.0</span></div>
<h3 class="hd">Two dates for one opening</h3>
<div class="claim">
<p class="what"><b>The Pink Line, opening day.</b> The elevated stretch is cleared, but the reports differ on when it opens. The state is awaiting a date from the Centre.</p>
<div class="vs">
<div class="side"><strong>15 Nov</strong><span>opening · Hans India, Construction World</span></div>
<span class="or">or</span>
<div class="side"><strong>13 Nov</strong><span>opening · OneIndia</span></div>
</div>
</div>
<div class="claim">
<p class="what"><b>Bengaluru Tech Summit, 17–19 Nov.</b> BioSpectrum has the 29th edition at BIEC. A TradeIndia listing gives a different venue.</p>
<div class="vs">
<div class="side"><strong>BIEC</strong><span>venue · BioSpectrum</span></div>
<span class="or">or</span>
<div class="side"><strong>Palace</strong><span>venue · TradeIndia</span></div>
</div>
</div>
<p class="rule-note">When reports disagree, we print both and name who said what. We don't pick one quietly.</p>
</div><div class="folio"><span>Two reports</span><span>06</span></div></div>`),
    page("07-line", "The Line", `<div class="page line-pg"><div class="pin">
<span class="lbl c" style="--c:var(--pink)">On the line</span>
<h3 class="hd">Six stations, 7.5 km</h3>
<svg viewBox="0 0 400 96" role="img" aria-label="The elevated Pink Line, not to scale: Kalena Agrahara, Hulimavu, IIM-B, JP Nagar 4th Phase, Jayadeva Hospital and Tavarekere">
<line x1="14" y1="44" x2="386" y2="44" stroke="#cf437d" stroke-width="7" stroke-linecap="round"/>
<g fill="#fdfdfc" stroke="#cf437d" stroke-width="3.5">
<circle cx="14" cy="44" r="8"/><circle cx="88.4" cy="44" r="6"/><circle cx="162.8" cy="44" r="6"/><circle cx="237.2" cy="44" r="6"/><circle cx="311.6" cy="44" r="6"/><circle cx="386" cy="44" r="8"/>
</g>
<g font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="10.5" font-weight="600" fill="#1b191e">
<text x="6" y="70">Kalena Agrahara</text>
<text x="88.4" y="26" text-anchor="middle">Hulimavu</text>
<text x="162.8" y="70" text-anchor="middle">IIM-B</text>
<text x="237.2" y="26" text-anchor="middle">JP Nagar 4th Phase</text>
<text x="311.6" y="70" text-anchor="middle">Jayadeva Hospital</text>
<text x="394" y="26" text-anchor="end">Tavarekere</text>
</g>
<text x="200" y="92" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="8.5" fill="#6b6672">7.5 KM · 6 STATIONS · SPACING NOT TO SCALE</text>
</svg>
<div class="blk">
<b>What opens, and what does not</b>
<p>The elevated section comes first and takes the Namma Metro network past 100 kilometres, with an interchange with the Yellow Line. The underground Pink stretch, Dairy Circle to Nagawara, is a separate job. Trials on it and on the Blue Line along the Outer Ring Road were expected in November, with both targeted for May 2027.</p>
</div>
<div class="blk">
<b>Three dates to watch</b>
<div class="ahead">
<div style="--c:var(--pink)"><strong>28 Oct</strong><span>Safety commissioner clears the elevated stretch</span></div>
<div style="--c:var(--pink)"><strong>13 or 15 Nov</strong><span>Opening day, depending on the report</span></div>
<div style="--c:var(--blue)"><strong>May 2027</strong><span>Target for underground Pink and the Blue Line</span></div>
</div>
</div>
<div class="blk">
<b>What the reports did not say</b>
<p>Fares, train frequency and first-day timings were not in anything we found, so none are printed. We will add them when BMRCL publishes them.</p>
</div>
<p class="src">Swarajya · Construction World · OneIndia · NewsBytes · The Hans India</p>
</div><div class="folio"><span>On the line</span><span>07</span></div></div>`),
    page("08-timeline", "Timeline", `<div class="page timeline"><div class="pin">
<span class="lbl c" style="--c:var(--pink)">Timeline</span>
<h3 class="hd">Seven dates for one line</h3>
<p class="stand">Each date below was reported for the Pink Line, in order of the day named. Only one of them has happened.</p>
<ol class="tl">
<li class="miss"><time>Mar 2026</time><i class="nd"></i><div><span class="st">Missed</span><b>The first target</b><span>Deccan Herald reported the elevated stretch to open in March 2026 and the underground stretch in September.</span></div></li>
<li class="miss"><time>15 Aug 2026</time><i class="nd"></i><div><span class="st">Missed</span><b>An Independence Day launch</b><span>Business Today reported the line aiming for 15 August, in a piece dated 10 August.</span></div></li>
<li class="miss"><time>Sep 2026</time><i class="nd"></i><div><span class="st">Missed</span><b>A September opening</b><span>Swarajya and Construction World reported the 7.5-kilometre stretch ready for a September launch.</span></div></li>
<li class="done"><time>28 Oct 2026</time><i class="nd"></i><div><span class="st">Done</span><b>Safety clearance</b><span>The Commissioner of Metro Railway Safety cleared the elevated stretch. Passengers still wait.</span></div></li>
<li class="next"><time>13 Nov 2026</time><i class="nd"></i><div><span class="st">Reported</span><b>OneIndia's opening day</b><span>A Friday, with the Deputy Chief Minister hinting at a visit by the Prime Minister.</span></div></li>
<li class="next"><time>15 Nov 2026</time><i class="nd"></i><div><span class="st">Reported</span><b>The Chief Minister's day</b><span>A Sunday. The Hans India, Construction World and Swarajya name it, pending the Centre.</span></div></li>
<li class="far"><time>May 2027</time><i class="nd"></i><div><span class="st">Target</span><b>The underground stretch</b><span>Swarajya reports May 2027 for the underground Pink Line and the Blue Line on the Outer Ring Road.</span></div></li>
</ol>
<p class="src">Dates are as reported, not an official timetable. Deccan Herald · Business Today · Swarajya · Construction World · OneIndia · The Hans India</p>
</div><div class="folio"><span>Timeline</span><span>08</span></div></div>`),
    page("09-ledger", "Ledger Table", `<div class="page ledger-pg"><div class="pin">
<span class="lbl c" style="--c:var(--blue)">The ledger</span>
<h3 class="hd">Who raised, and how much</h3>
<table>
<thead><tr><th scope="col">Company</th><th scope="col">What happened</th><th scope="col">Amount</th></tr></thead>
<tbody>
<tr><td class="co"><b>altM</b><span>Chemicals from farm waste</span></td><td>Series A backed by Rainmatter and Mela Ventures, to move from pilot to commercial manufacturing. It makes industrial chemicals from rice straw and sugarcane bagasse. Its 2023 seed round was $3.5M.</td><td class="amt">$10.3M<small>The Week, YourStory</small></td></tr>
<tr><td class="co"><b>Bengaluru</b><span>Jan to Sep 2026</span></td><td>The city drew about $4.4 billion in startup funding in the first nine months of the year, as the Economic Times reported and Digg relayed.</td><td class="amt">$4.4B<small>Economic Times, via Digg</small></td></tr>
<tr><td class="co"><b>Bengaluru</b><span>Q3 2026</span></td><td>Inc42 puts the third quarter at more than $1.4 billion, up 157% on a year earlier. The two figures cover different periods and are not set against each other.</td><td class="amt">$1.4B+<small>Inc42</small></td></tr>
</tbody>
</table>
<p class="foot">Left out: Gnani.ai's ₹68 crore Series B, because we could not confirm when it closed, and Shiprocket's quarterly profit, because it was reported from Gurugram or Delhi, not Bengaluru.</p>
</div><div class="folio"><span>The ledger</span><span>09</span></div></div>`),
    page("10-scoreboard", "Scoreboard", `<div class="page score"><div class="pin">
<div class="ph"><img class="photo" src="%photo:blr-chinnaswamy%" alt="M. Chinnaswamy Stadium from the stands"><span class="cap">The Chinnaswamy, home ground of RCB · Visdaviva, CC BY-SA 3.0</span></div>
<span class="lbl c" style="--c:var(--yellow)">Field &amp; ground</span>
<h3 class="hd">A late win in Goa</h3>
<div class="card">
<div class="top"><span>Indian Super League</span><span>Fri 6 Nov</span></div>
<div class="rows">
<div class="row"><span>Fixture</span><span>FC Goa v Bengaluru FC</span></div>
<div class="row"><span>Ground</span><span>Pandit Jawaharlal Nehru Stadium</span></div>
<div class="row"><span>Result</span><span>Bengaluru FC won 2–1, away</span></div>
<div class="row"><span>Late goal</span><span>The winner came in stoppage time</span></div>
</div>
</div>
<div class="card">
<div class="top"><span>Earlier this season</span><span>Bengaluru FC</span></div>
<div class="rows">
<div class="row"><span>10 Oct</span><span>Won 3–2 v Sporting Delhi</span></div>
<div class="row"><span>17 Oct</span><span>Won 2–0 v Chennaiyin FC</span></div>
<div class="row"><span>30 Oct</span><span>Listed v NorthEast United; no result found</span></div>
</div>
</div>
<p class="src">Khel Now, 6 Nov (the only report of the Goa match we found) · Vavel fixtures page</p>
</div><div class="folio"><span>Field &amp; ground</span><span>10</span></div></div>`),
    page("11-week-ahead", "Week Ahead", `<div class="page week"><div class="pin">
<span class="lbl c" style="--c:var(--purple)">The week ahead</span>
<h3 class="hd">Opening week, and after</h3>
<div class="days">
<div class="day"><span class="dn">Mon</span><span class="dd">9</span><span class="ev" style="--c:var(--green)">BDA fee scheme review</span></div>
<div class="day"><span class="dn">Tue</span><span class="dd">10</span><span class="ev" style="--c:var(--yellow)">Last of the forecast rain</span></div>
<div class="day"><span class="dn">Wed</span><span class="dd">11</span><span class="ev" style="--c:var(--purple)">Reader's page deadline</span></div>
<div class="day"><span class="dn">Thu</span><span class="dd">12</span><span class="ev" style="--c:var(--purple)">Next edition</span></div>
<div class="day"><span class="dn">Fri</span><span class="dd">13</span><span class="ev" style="--c:var(--pink)">Pink Line, per OneIndia</span></div>
<div class="day"><span class="dn">Sat</span><span class="dd">14</span></div>
<div class="day"><span class="dn">Sun</span><span class="dd">15</span><span class="ev" style="--c:var(--pink)">Pink Line, per the CM</span></div>
</div>
<div class="later">
<div><em>13 or 15 Nov</em><span><b>The Pink Line opens</b>Two dates reported; the Centre's confirmation is awaited</span></div>
<div><em>17–19 Nov</em><span><b>Bengaluru Tech Summit</b>The 29th edition, themed "AI &amp; Beyond", at BIEC per BioSpectrum</span></div>
<div><em>May 2027</em><span><b>Underground Pink, Blue Line</b>BMRCL's latest reported target, per Swarajya</span></div>
<div><em>12–15 Nov</em><span><b>Gigs and exhibitions</b>We found no verified listings for these days, so none are printed</span></div>
</div>
<p class="src">The Hans India · OneIndia · BioSpectrum · YourStory · Swarajya · Deccan Herald</p>
</div><div class="folio"><span>The week ahead</span><span>11</span></div></div>`),
    page("12-reader", "Reader's Page", `<div class="page reader"><div class="pin">
<div class="top">
<figure class="shot"><img class="photo" src="%photo:blr-vidhana-soudha%" alt="Vidhana Soudha lit up at night"><figcaption class="cap">Your photograph goes here. Sample: Vidhana Soudha at night · Sai23ganesh, CC BY-SA 4.0</figcaption></figure>
<div class="head">
<span class="lbl c" style="--c:var(--purple)">Reader's page</span>
<span><span class="eg">Example</span></span>
<h3 class="hd">My first ride on the Pink Line</h3>
<p class="stand">One line on what happened, and why it stayed with you.</p>
<span class="by">By your name · Your neighbourhood</span>
<span class="credit">Photographs by the writer</span>
</div>
</div>
<div class="story">
<p>Start with the moment, not the background: where you were, what you could hear, who was with you. Tap any line on this page and type your own words over it.</p>
<p>Then tell it the way you would to a friend over chai. Names of places, times and prices help other readers see it, and they are what the desk checks before the page prints.</p>
<p class="pull">A line from your story that you want people to remember goes here.</p>
<p>Keep it to about 300 words, which is what this page holds, and keep the photographs to ones you took yourself.</p>
<p>End where it ended for you. It doesn't need a moral.</p>
</div>
<div class="send">
<div><b>Send yours</b><span>About 300 words and up to three photographs you took, with your name and neighbourhood. In by Wednesday 11 November for Week 46.</span></div>
<div><b>Before it prints</b><span>The desk checks names, places, dates and figures, and shows you the page first. Your words and your photographs stay yours.</span></div>
</div>
</div><div class="folio"><span>Reader's page</span><span>12</span></div></div>`),
    page("13-credits", "Sources & Credits", `<div class="page credits"><div class="pin">
<span class="lbl">Sources &amp; credits</span>
<h3 class="hd">Where this came from</h3>
<div class="cols">
<div><b>p. 03–04 · Cleared, not dated</b>Swarajya, Construction World, The Hans India and OneIndia, Oct–Nov 2026; NewsBytes; Business Today, 10 Aug</div>
<div><b>p. 05 · City desk</b>Deccan Herald, 8–9 Nov; Goodreturns, 5 Nov; The Week, 1 Nov</div>
<div><b>p. 06 · Two reports</b>The Hans India, Construction World and Swarajya (15 Nov); OneIndia (13 Nov); BioSpectrum and TradeIndia (summit venue)</div>
<div><b>p. 07 · On the line</b>Swarajya; Construction World; OneIndia; NewsBytes; The Hans India</div>
<div><b>p. 08 · Timeline</b>Deccan Herald; Business Today, 10 Aug; Swarajya; Construction World; OneIndia; The Hans India</div>
<div><b>p. 09 · The ledger</b>The Week and YourStory, 5 Nov; Economic Times, relayed by Digg; Inc42</div>
<div><b>p. 10 · Field &amp; ground</b>Khel Now, 6 Nov; Vavel</div>
<div><b>p. 11 · The week ahead</b>The Hans India; OneIndia; BioSpectrum; YourStory; Swarajya; Deccan Herald</div>
<div><b>Photographs</b>Wikimedia Commons. Cover and p. 01 Jayadeva viaduct: Gpkp (CC BY-SA 4.0). p. 04 Pink Line map: Mallikarjunasj (CC BY-SA 3.0). p. 05 KR Market station: Gpkp (CC BY-SA 4.0). p. 06 Town Hall: Harvinder Chandigarh (CC BY 4.0). p. 10 Chinnaswamy: Visdaviva (CC BY-SA 3.0). p. 12 sample, Vidhana Soudha: Sai23ganesh (CC BY-SA 4.0).</div>
</div>
<div class="made">
<span><b>How this was made.</b> Gathered from a free news index and checked against at least one report for each item. Summarised in our own words; no article text or press photographs were reused.</span>
<span>Atlas Bengaluru · a sample city edition · Week 45, 2026</span>
</div>
</div><div class="folio"><span>Colophon</span><span>13</span></div></div>`),
  ],
};
