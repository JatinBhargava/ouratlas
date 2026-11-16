/**
 * The City Edition: fifteen pages for a weekly issue about one city, set with a
 * sample edition of Bengaluru news (12–15 November 2026).
 *
 * Written here rather than drawn on the design canvas, so it is not in
 * `pages.json` (which only `scripts/studio.ts` writes). `loadStudio` adds it to
 * the shelves after the canvas's own sections, in the same lazy chunk.
 *
 * The other complete issues tell one story; a city edition carries many short
 * ones, so its pages are built for that: a front page with teasers, contents by
 * section, big figures, briefs, two outlets disagreeing side by side, a transit
 * route, an interchange drawn as a diagram, rider questions answered, a timeline of dates, a funding table,
 * scorecards, a week of dates, a reader's page and a sources page. Every page is sized in container units (`cqw`) against its own
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
.index .route::before { content: ""; position: absolute; left: 2.85cqw; top: 3cqw; bottom: 3cqw; width: 0.9cqw; background: linear-gradient(var(--purple) 0 16%, var(--green) 16% 32%, var(--pink) 32% 48%, var(--blue) 48% 64%, var(--yellow) 64% 80%, var(--purple) 80% 100%); border-radius: 1cqw; }
.stop { position: relative; display: grid; grid-template-columns: 6.6cqw minmax(0, 1fr) auto; gap: 2.2cqw; align-items: center; padding: 0.5cqw 0; }
.stop .dot { width: 6.6cqw; height: 6.6cqw; border-radius: 50%; background: var(--paper); border: 0.9cqw solid var(--c); display: grid; place-items: center; font-family: var(--mono); font-size: 1.9cqw; font-weight: 500; position: relative; z-index: 1; }
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

/* 08 Interchange */
.swap h3 { font-size: 7.4cqw; }
.swap .stand { font-size: 2.3cqw; color: var(--muted); max-width: 90%; }
.swap svg { display: block; width: 100%; height: auto; overflow: visible; }
.swap .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 0.25cqw solid var(--ink); }
.swap .f { display: grid; gap: 0.6cqw; align-content: start; padding: 1.7cqw 2.4cqw 1.5cqw 0; border-bottom: 0.15cqw solid var(--rule); }
.swap .f:nth-child(even) { padding-left: 2.6cqw; padding-right: 0; border-left: 0.15cqw solid var(--rule); }
.swap .f .k { font-family: var(--mono); font-size: 1.45cqw; text-transform: uppercase; letter-spacing: 0.06em; color: var(--c); }
.swap .f b { font-family: var(--display); font-weight: 400; font-size: 3.4cqw; line-height: 1; }
.swap .f p { font-size: 1.9cqw; line-height: 1.4; }

/* 09 Questions & Answers */
.qa h3 { font-size: 7.4cqw; }
.qa .list { flex: 1; min-height: 0; display: grid; grid-auto-rows: minmax(0, 1fr); border-top: 0.25cqw solid var(--ink); }
.qa .item { display: grid; grid-template-columns: 8cqw minmax(0, 1fr); gap: 0 2cqw; padding: 1.3cqw 0; border-bottom: 0.15cqw solid var(--rule); min-height: 0; }
.qa .q { font-family: var(--display); font-style: italic; font-size: 7.4cqw; line-height: 0.85; color: var(--c); }
.qa .item > div { display: grid; gap: 0.5cqw; align-content: start; }
.qa .item b { font-family: var(--display); font-weight: 400; font-size: 3.5cqw; line-height: 1; }
.qa .item p { font-size: 1.9cqw; line-height: 1.38; }
.qa .who { font-family: var(--mono); font-size: 1.4cqw; color: var(--muted); }

/* 10 Timeline */
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

/* 11 Ledger Table */
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

/* 12 Scoreboard */
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

/* 13 Week Ahead */
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

/* 14 Reader's Page */
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

/* 15 Sources & Credits */
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
  blurb: "An edition of one city on fifteen pages: front page, contents by section, the numbers, briefs, two reports side by side, the metro line, an interchange drawn out, rider questions answered, a timeline of dates, the ledger, the scoreboard and the week ahead",
  pages: [
    page("01-front", "City Front", `<div class="page front"><div class="pin">
<div class="mast"><h3 class="hd">Atlas <i>Bengaluru</i></h3><div class="date">Week 47<br>12–15 Nov 2026<br>Issue 04</div></div>
<div class="lines" aria-hidden="true"><i style="background:var(--purple)"></i><i style="background:var(--green)"></i><i style="background:var(--yellow)"></i><i style="background:var(--pink)"></i><i style="background:var(--blue)"></i></div>
<div class="hero"><img class="photo" src="%photo:blr-viaduct%" alt="Traffic under the Namma Metro viaduct near Jayadeva Hospital"><span class="cap">Namma Metro viaduct near Jayadeva Hospital · Gpkp, CC BY-SA 4.0</span></div>
<div class="lead">
<h4 class="hd">The Pink Line's first weekend</h4>
<p>Inaugurated on Friday 13 November, open to riders from Saturday. Reports put the first day at 33,409 riders.</p>
</div>
<div class="teasers">
<div style="--c:var(--pink)"><b>Friday, then Saturday</b><span>p. 04</span></div>
<div style="--c:var(--yellow)"><b>Where two lines meet</b><span>p. 08</span></div>
<div style="--c:var(--green)"><b>Friday night at the Kanteerava</b><span>p. 12</span></div>
</div>
</div><div class="folio"><span>Atlas Bengaluru</span><span>01</span></div></div>`),
    page("02-index", "Section Index", `<div class="page index"><div class="pin">
<span class="lbl">In this issue</span>
<div class="route">
<div class="stop" style="--c:var(--purple)"><span class="dot">03</span><div><b>By the numbers</b><span>The edition in six figures</span></div><span class="pg">p. 03</span></div>
<div class="stop" style="--c:var(--pink)"><span class="dot">04</span><div><b>Friday, then Saturday</b><span>The Pink Line's first weekend</span></div><span class="pg">p. 04</span></div>
<div class="stop" style="--c:var(--green)"><span class="dot">05</span><div><b>City desk</b><span>Feeder buses, the summit, a fee cut</span></div><span class="pg">p. 05</span></div>
<div class="stop" style="--c:var(--pink)"><span class="dot">06</span><div><b>Two reports</b><span>A match day and a summit venue</span></div><span class="pg">p. 06</span></div>
<div class="stop" style="--c:var(--pink)"><span class="dot">07</span><div><b>On the line</b><span>Six stations, 7.5 km, now open</span></div><span class="pg">p. 07</span></div>
<div class="stop" style="--c:var(--yellow)"><span class="dot">08</span><div><b>Where two lines meet</b><span>Jayadeva Hospital, drawn out</span></div><span class="pg">p. 08</span></div>
<div class="stop" style="--c:var(--pink)"><span class="dot">09</span><div><b>Rider questions</b><span>Six answers for the first week</span></div><span class="pg">p. 09</span></div>
<div class="stop" style="--c:var(--pink)"><span class="dot">10</span><div><b>Timeline</b><span>Seven dates for one line</span></div><span class="pg">p. 10</span></div>
<div class="stop" style="--c:var(--blue)"><span class="dot">11</span><div><b>The ledger</b><span>A quiet week for Bengaluru rounds</span></div><span class="pg">p. 11</span></div>
<div class="stop" style="--c:var(--green)"><span class="dot">12</span><div><b>Field &amp; ground</b><span>Bengaluru FC, back at home</span></div><span class="pg">p. 12</span></div>
<div class="stop" style="--c:var(--purple)"><span class="dot">13</span><div><b>The week ahead</b><span>The summit, a home match and later</span></div><span class="pg">p. 13</span></div>
<div class="stop" style="--c:var(--purple)"><span class="dot">14</span><div><b>Reader's page</b><span>Your Bengaluru, in your words</span></div><span class="pg">p. 14</span></div>
</div>
<div class="how"><span>Every item ends with its source. <span class="flag">2 reports</span> marks a date or figure the papers disagree on.</span></div>
</div><div class="folio"><span>Contents</span><span>02</span></div></div>`),
    page("03-numbers", "By the Numbers", `<div class="page numbers"><div class="pin">
<span class="lbl">By the numbers</span>
<h3 class="hd" style="font-size:7.4cqw">The edition, counted</h3>
<div class="grid">
<div class="n" style="--c:var(--pink)"><strong>33,409</strong><p>People reported riding the Pink Line on its first day of service, Saturday 14 November.</p><span class="src">Inshorts; News Karnataka, 15 Nov</span></div>
<div class="n" style="--c:var(--pink)"><strong>7.5 km</strong><p>The elevated stretch that opened, with six stations from Kalena Agrahara to Tavarekere.</p><span class="src">Construction World; OneIndia</span></div>
<div class="n" style="--c:var(--pink)"><strong>100 km</strong><p>The length Namma Metro passes with the new stretch, as reported before the opening.</p><span class="src">NewsBytes</span></div>
<div class="n" style="--c:var(--blue)"><strong>17–19 Nov</strong><p>Dates of the 29th Bengaluru Tech Summit, themed "AI &amp; Beyond".</p><span class="src">BioSpectrum; YourStory</span></div>
<div class="n" style="--c:var(--green)"><strong>20 Nov</strong><p>Bengaluru FC at home to Mumbai City FC, 7:30 pm, in two listings. Deccan Herald had 19 Nov.</p><span class="src">District; Khel Now; Deccan Herald</span></div>
<div class="n" style="--c:var(--green)"><strong>369</strong><p>Wards across the five city corporations, since the final delimitation of 19 November 2025.</p><span class="src">ThePrint (PTI), 28 Oct; South First</span></div>
</div>
</div><div class="folio"><span>By the numbers</span><span>03</span></div></div>`),
    page("04-lead", "Broadsheet Lead", `<div class="page lead-pg"><div class="pin">
<span class="lbl c" style="--c:var(--pink)">Friday, then Saturday</span>
<h3 class="hd">The Pink Line's first weekend</h3>
<p class="stand">The line was inaugurated on Friday and carried its first riders on Saturday. Here is what the weekend's reports say, and what they leave out.</p>
<div class="body">
<div class="ph"><img class="photo" src="%photo:blr-pink-line%" alt="Pink Line route map above the doors inside a metro coach"><span class="cap">The Pink Line map inside a coach · Mallikarjunasj, CC BY-SA 3.0</span></div>
<div class="col c1">
<p>Prime Minister Narendra Modi inaugurated Namma Metro's elevated Pink Line stretch on Friday 13 November and rode a train with Chief Minister D K Shivakumar, Deccan Herald and News24 report. The 7.5-kilometre stretch has six stations, from Kalena Agrahara to Tavarekere.</p>
<p>Public service began the next morning, Saturday 14 November, as Minister Krishna Byre Gowda had said it would.</p>
<p class="pull">33,409 riders on the first day.</p>
</div>
<div class="col c2">
<p>That is the first-day figure given by Inshorts and News Karnataka. Jayadeva Hospital, where the line meets the Yellow Line, saw the most people. A BMRCL official called the numbers encouraging and said the weekend would show more.</p>
<p>The same reports expect ridership to settle towards the end of November.</p>
</div>
<div class="col c3">
<p>The Federal's first-day report found gaps. Riders on Bannerghatta Road said they save time, and asked for shorter waits between trains and for feeder buses before Monday's rush.</p>
<p>One caution. We read several of these reports through search summaries, not whole articles, and found no fare. Check BMRCL for fares and timings.</p>
<p class="src">Deccan Herald · News24 · Inshorts · News Karnataka · The Federal · The Week (PTI)</p>
</div>
</div>
</div><div class="folio"><span>Feature</span><span>04</span></div></div>`),
    page("05-briefs", "Desk Briefs", `<div class="page briefs-pg"><div class="pin">
<span class="lbl c" style="--c:var(--green)">City desk</span>
<h3 class="hd">Around town</h3>
<div class="grid">
<div class="brief"><span class="where">Network</span><b>Past 100 kilometres</b><p>With the Pink stretch open, Namma Metro passes 100 km of line, NewsBytes reported ahead of the opening. Pictured is KR Market, an existing station.</p><div class="shot"><img class="photo" src="%photo:blr-kr-market%" alt="Krishna Rajendra Market metro station entrance"><span class="cap">KR Market station · Gpkp, CC BY-SA 4.0</span></div><span class="src">NewsBytes</span></div>
<div class="brief"><span class="where">Buses</span><b>Feeders for the Pink Line</b><p>BMTC has proposed five dedicated feeder routes to Pink Line stations. Three existing feeder services already reach four of them: Jayadeva Hospital, IIMB, JP Nagar 4th Phase and Hulimavu. We could not confirm which have started.</p><span class="src">Swarajya</span></div>
<div class="brief"><span class="where">Tech</span><b>The summit, a day away</b><p>The 29th Bengaluru Tech Summit runs 17 to 19 November, themed "AI &amp; Beyond", with the Karnataka government as host. Page 06 covers the venue.</p><span class="src">BioSpectrum · YourStory · South First</span></div>
<div class="brief"><span class="where">Housing</span><b>A fee cut for unauthorised homes</b><p>A news page dated 9 November reports Chief Minister D K Shivakumar announcing a 50 per cent cut in the BDA's regularisation fees. We could not open the story, so no conditions are printed.</p><span class="src">NewKerala, 9 Nov</span></div>
</div>
</div><div class="folio"><span>City desk</span><span>05</span></div></div>`),
    page("06-two-reports", "Two Reports", `<div class="page two"><div class="pin">
<div class="band"><img class="photo" src="%photo:blr-town-hall%" alt="Sir Puttanna Chetty Town Hall, Bengaluru"><span class="cap">Town Hall · Harvinder Chandigarh, CC BY 4.0</span></div>
<h3 class="hd">A match day and a venue</h3>
<div class="claim">
<p class="what"><b>Bengaluru FC v Mumbai City FC.</b> Everyone has it at the Sree Kanteerava Stadium, but not on the same day. District's listing gives 7:30 pm.</p>
<div class="vs">
<div class="side"><strong>19 Nov</strong><span>match day · Deccan Herald</span></div>
<span class="or">or</span>
<div class="side"><strong>20 Nov</strong><span>match day · Khel Now, District</span></div>
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
<h3 class="hd">Six stations, 7.5 km, now open</h3>
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
<b>What opened, and what has not</b>
<p>The elevated section is the first part of the Pink Line to carry riders, and it takes the network past 100 kilometres. The underground stretch, Dairy Circle to Nagawara, is a separate job. Swarajya reported a May 2027 target for it and for the Blue Line along the Outer Ring Road.</p>
</div>
<div class="blk">
<b>Three dates, now kept</b>
<div class="ahead">
<div style="--c:var(--pink)"><strong>Fri 13 Nov</strong><span>Inauguration, with a ride for the Prime Minister and Chief Minister</span></div>
<div style="--c:var(--pink)"><strong>Sat 14 Nov</strong><span>Public service begins; 33,409 riders reported</span></div>
<div style="--c:var(--blue)"><strong>Mon 16 Nov</strong><span>The first weekday rush, which riders were waiting to see</span></div>
</div>
</div>
<div class="blk">
<b>What the reports did not say</b>
<p>Fares and the last train of the day were not in anything we found, so none are printed. Riders asked for shorter waits between trains; BMRCL had not published new gaps in anything we could read.</p>
</div>
<p class="src">Deccan Herald · The Federal · Inshorts · News Karnataka · Swarajya · NewsBytes</p>
</div><div class="folio"><span>On the line</span><span>07</span></div></div>`),
    page("08-interchange", "Interchange Diagram", `<div class="page swap"><div class="pin">
<span class="lbl c" style="--c:var(--yellow)">Where two lines meet</span>
<h3 class="hd">Changing at Jayadeva Hospital</h3>
<p class="stand">The new Pink Line crosses the Yellow Line at one station, and that station was the busiest of the six on Saturday.</p>
<svg viewBox="0 0 400 232" role="img" aria-label="A diagram, not to scale, of the Yellow Line running across and the Pink Line running up, crossing at Jayadeva Hospital">
<line x1="14" y1="96" x2="386" y2="96" stroke="#c99a06" stroke-width="7" stroke-linecap="round"/>
<line x1="200" y1="24" x2="200" y2="206" stroke="#cf437d" stroke-width="7" stroke-linecap="round"/>
<g fill="#fdfdfc" stroke="#c99a06" stroke-width="3.5"><circle cx="30" cy="96" r="6"/><circle cx="110" cy="96" r="6"/><circle cx="296" cy="96" r="6"/></g>
<g fill="#fdfdfc" stroke="#cf437d" stroke-width="3.5"><circle cx="200" cy="24" r="6"/><circle cx="200" cy="130" r="6"/><circle cx="200" cy="156" r="6"/><circle cx="200" cy="182" r="6"/><circle cx="200" cy="206" r="6"/></g>
<circle cx="200" cy="96" r="12" fill="#fdfdfc" stroke="#1b191e" stroke-width="3.5"/>
<g font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="10.5" font-weight="600" fill="#1b191e">
<text x="30" y="78" text-anchor="middle">RV Road</text>
<text x="110" y="78" text-anchor="middle">Ragigudda</text>
<text x="296" y="78" text-anchor="middle">BTM Layout</text>
<text x="216" y="74">Jayadeva Hospital</text>
<text x="214" y="28">Tavarekere</text>
<text x="214" y="134">JP Nagar 4th Phase</text>
<text x="214" y="160">IIM-B</text>
<text x="214" y="186">Hulimavu</text>
<text x="214" y="210">Kalena Agrahara</text>
<text x="386" y="116" text-anchor="end">towards Electronic City</text>
</g>
<text x="14" y="228" font-family="ui-monospace, Menlo, monospace" font-size="8.5" fill="#6b6672">YELLOW ACROSS · PINK UP · SPACING AND DIRECTION NOT TO SCALE</text>
</svg>
<div class="facts">
<div class="f" style="--c:var(--pink)"><span class="k">The station</span><b>Two lines, one stop</b><p>Jayadeva Hospital is a multi-tier elevated station shared by the Yellow and Pink lines, OneIndia and Swarajya reported.</p></div>
<div class="f" style="--c:var(--purple)"><span class="k">The change</span><b>Towards Electronic City</b><p>Bannerghatta Road riders can switch here to the Yellow Line for Electronic City.</p></div>
<div class="f" style="--c:var(--green)"><span class="k">The rank</span><b>The third of its kind</b><p>The Federal described it, before the opening, as the city's third interchange after Majestic and RV Road.</p></div>
<div class="f" style="--c:var(--pink)"><span class="k">Day one</span><b>The most footfall</b><p>Jayadeva Hospital recorded the line's highest footfall on Saturday. The Federal found the station less ready than the crowd.</p></div>
</div>
<p class="src">OneIndia · Swarajya · The Federal · News Karnataka. Platform walking times were not in any report we found.</p>
</div><div class="folio"><span>Interchange</span><span>08</span></div></div>`),
    page("09-questions", "Questions & Answers", `<div class="page qa"><div class="pin">
<span class="lbl c" style="--c:var(--pink)">Rider questions</span>
<h3 class="hd">Six questions for the first week</h3>
<div class="list">
<div class="item" style="--c:var(--pink)"><span class="q">1</span><div><b>Is it open?</b><p>Yes. The line was inaugurated on Friday 13 November and public service began on Saturday 14 November.</p><span class="who">Deccan Herald · The Week (PTI)</span></div></div>
<div class="item" style="--c:var(--purple)"><span class="q">2</span><div><b>Where does it go?</b><p>Six elevated stations over 7.5 km: Kalena Agrahara, Hulimavu, IIM-B, JP Nagar 4th Phase, Jayadeva Hospital and Tavarekere.</p><span class="who">Construction World · OneIndia</span></div></div>
<div class="item" style="--c:var(--green)"><span class="q">3</span><div><b>How many people rode?</b><p>33,409 on the first day, as reported. A BMRCL official said the weekend would show more. Jayadeva Hospital was the busiest.</p><span class="who">Inshorts · News Karnataka</span></div></div>
<div class="item" style="--c:var(--yellow)"><span class="q">4</span><div><b>What will it cost?</b><p>Not in anything we found, so no fare is printed. Check BMRCL's notices before you travel.</p><span class="who">Not yet published</span></div></div>
<div class="item" style="--c:var(--blue)"><span class="q">5</span><div><b>Can I change to another line?</b><p>Yes, at Jayadeva Hospital, where the Pink Line meets the Yellow Line towards Electronic City. Page 08 draws it.</p><span class="who">OneIndia · Swarajya</span></div></div>
<div class="item" style="--c:var(--pink)"><span class="q">6</span><div><b>How do I get to a station?</b><p>BMTC has proposed five feeder routes, and three existing ones already reach four stations. Riders asked for more.</p><span class="who">Swarajya · The Federal</span></div></div>
</div>
</div><div class="folio"><span>Rider questions</span><span>09</span></div></div>`),
    page("10-timeline", "Timeline", `<div class="page timeline"><div class="pin">
<span class="lbl c" style="--c:var(--pink)">Timeline</span>
<h3 class="hd">Seven dates for one line</h3>
<p class="stand">Each date below was reported for the Pink Line. Three were missed, three were kept, and one is a target.</p>
<ol class="tl">
<li class="miss"><time>Mar 2026</time><i class="nd"></i><div><span class="st">Missed</span><b>The first target</b><span>Deccan Herald reported the elevated stretch to open in March 2026 and the underground stretch in September.</span></div></li>
<li class="miss"><time>15 Aug 2026</time><i class="nd"></i><div><span class="st">Missed</span><b>An Independence Day launch</b><span>Business Today reported the line aiming for 15 August, in a piece dated 10 August.</span></div></li>
<li class="miss"><time>Sep 2026</time><i class="nd"></i><div><span class="st">Missed</span><b>A September opening</b><span>Swarajya and Construction World reported the 7.5-kilometre stretch ready for a September launch.</span></div></li>
<li class="done"><time>28 Oct 2026</time><i class="nd"></i><div><span class="st">Done</span><b>Safety clearance</b><span>The Commissioner of Metro Railway Safety cleared the elevated stretch. Passengers still waited.</span></div></li>
<li class="done"><time>13 Nov 2026</time><i class="nd"></i><div><span class="st">Done</span><b>Inauguration day</b><span>A Friday. The Prime Minister rode with the Chief Minister, Deccan Herald reports. An earlier 15 November was dropped.</span></div></li>
<li class="done"><time>14 Nov 2026</time><i class="nd"></i><div><span class="st">Done</span><b>Public service</b><span>A Saturday. Inshorts and News Karnataka report 33,409 riders on the first day.</span></div></li>
<li class="far"><time>May 2027</time><i class="nd"></i><div><span class="st">Target</span><b>The underground stretch</b><span>Swarajya reports May 2027 for the underground Pink Line and the Blue Line on the Outer Ring Road.</span></div></li>
</ol>
<p class="src">Dates are as reported, not an official timetable. Deccan Herald · Business Today · Swarajya · Construction World · Inshorts · News Karnataka</p>
</div><div class="folio"><span>Timeline</span><span>10</span></div></div>`),
    page("11-ledger", "Ledger Table", `<div class="page ledger-pg"><div class="pin">
<span class="lbl c" style="--c:var(--blue)">The ledger</span>
<h3 class="hd">A quiet week for rounds</h3>
<table>
<thead><tr><th scope="col">Company</th><th scope="col">What happened</th><th scope="col">Amount</th></tr></thead>
<tbody>
<tr><td class="co"><b>Gnani.ai</b><span>Voice AI, Series B</span></td><td>The outlets give different sizes for the same round, led by Aavishkaar Capital. NewsBytes says ₹68 crore. Business Today, on 31 March, says $10 million. It is not new this week; we print it to show the gap.</td><td class="amt">₹68 cr or $10M<small>NewsBytes; Business Today</small></td></tr>
<tr><td class="co"><b>Bengaluru</b><span>Jan to Sep 2026</span></td><td>The city drew about $4.4 billion in startup funding in the first nine months of the year, as the Economic Times reported and Digg relayed. Printed last edition, kept here as the running total.</td><td class="amt">$4.4B<small>Economic Times, via Digg</small></td></tr>
</tbody>
</table>
<p class="foot">We found no Bengaluru-based round dated 12 to 15 November that an outlet confirmed. PowerUp Money ($10M) and The Croffle Guys (₹14 crore) are in YourStory's 3 November roundup, but we could not confirm they are Bengaluru-based, so they are left out.</p>
</div><div class="folio"><span>The ledger</span><span>11</span></div></div>`),
    page("12-scoreboard", "Scoreboard", `<div class="page score"><div class="pin">
<div class="ph"><img class="photo" src="%photo:blr-chinnaswamy%" alt="M. Chinnaswamy Stadium from the stands"><span class="cap">The Chinnaswamy, home ground of RCB · Visdaviva, CC BY-SA 3.0</span></div>
<span class="lbl c" style="--c:var(--yellow)">Field &amp; ground</span>
<h3 class="hd">Friday night at the Kanteerava</h3>
<div class="card">
<div class="top"><span>Indian Super League</span><span>Next match</span></div>
<div class="rows">
<div class="row"><span>Fixture</span><span>Bengaluru FC v Mumbai City FC</span></div>
<div class="row"><span>Ground</span><span>Sree Kanteerava Stadium</span></div>
<div class="row"><span>Day</span><span>Fri 20 Nov, 7:30 pm, per District; Deccan Herald had 19 Nov</span></div>
<div class="row"><span>The break</span><span>No league games 7 to 20 Nov, per Khel Now</span></div>
</div>
</div>
<div class="card">
<div class="top"><span>This season</span><span>Bengaluru FC</span></div>
<div class="rows">
<div class="row"><span>10 Oct</span><span>Won 3–2 v SC Delhi</span></div>
<div class="row"><span>30 Oct</span><span>Drew 1–1 v NorthEast United</span></div>
<div class="row"><span>6 Nov</span><span>Won 2–1 at FC Goa, in stoppage time</span></div>
</div>
</div>
<p class="src">Khel Now · District · Deccan Herald · Devdiscourse · Mykhel. No match was played in this edition's window.</p>
</div><div class="folio"><span>Field &amp; ground</span><span>12</span></div></div>`),
    page("13-week-ahead", "Week Ahead", `<div class="page week"><div class="pin">
<span class="lbl c" style="--c:var(--purple)">The week ahead</span>
<h3 class="hd">The summit, and a home match</h3>
<div class="days">
<div class="day"><span class="dn">Mon</span><span class="dd">16</span><span class="ev" style="--c:var(--pink)">First weekday on the Pink Line</span></div>
<div class="day"><span class="dn">Tue</span><span class="dd">17</span><span class="ev" style="--c:var(--blue)">Tech Summit opens</span></div>
<div class="day"><span class="dn">Wed</span><span class="dd">18</span><span class="ev" style="--c:var(--purple)">Reader's page deadline</span></div>
<div class="day"><span class="dn">Thu</span><span class="dd">19</span><span class="ev" style="--c:var(--blue)">Summit's last day</span><span class="ev" style="--c:var(--purple)">Next edition</span></div>
<div class="day"><span class="dn">Fri</span><span class="dd">20</span><span class="ev" style="--c:var(--green)">Bengaluru FC at home, 7:30 pm</span></div>
<div class="day"><span class="dn">Sat</span><span class="dd">21</span><span class="ev" style="--c:var(--muted)">Nothing verified</span></div>
<div class="day"><span class="dn">Sun</span><span class="dd">22</span><span class="ev" style="--c:var(--muted)">Nothing verified</span></div>
</div>
<div class="later">
<div><em>17–19 Nov</em><span><b>Bengaluru Tech Summit</b>The 29th edition, themed "AI &amp; Beyond", at BIEC per BioSpectrum. TradeIndia names another venue</span></div>
<div><em>19 or 20 Nov</em><span><b>Bengaluru FC v Mumbai City</b>At the Kanteerava; most listings say Friday 20 November</span></div>
<div><em>Through Nov</em><span><b>Ward One campaign</b>The GBA's month-long drive in one ward per division, begun on 1 November</span></div>
<div><em>Late Nov or Dec</em><span><b>Kadalekai Parishe</b>The groundnut fair in Basavanagudi falls on the last Monday of Karthika masa. We found no confirmed 2026 dates</span></div>
</div>
<p class="src">BioSpectrum · TradeIndia · District · Khel Now · Deccan Herald · ThePrint · Karnataka tourism listings</p>
</div><div class="folio"><span>The week ahead</span><span>13</span></div></div>`),
    page("14-reader", "Reader's Page", `<div class="page reader"><div class="pin">
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
<div><b>Send yours</b><span>About 300 words and up to three photographs you took, with your name and neighbourhood. In by Wednesday 18 November for Issue 05.</span></div>
<div><b>Before it prints</b><span>The desk checks names, places, dates and figures, and shows you the page first. Your words and your photographs stay yours.</span></div>
</div>
</div><div class="folio"><span>Reader's page</span><span>14</span></div></div>`),
    page("15-credits", "Sources & Credits", `<div class="page credits"><div class="pin">
<span class="lbl">Sources &amp; credits</span>
<h3 class="hd">Where this came from</h3>
<div class="cols">
<div><b>p. 03–04 · Friday, then Saturday</b>Deccan Herald and News24, Nov 2026 (inauguration); Inshorts and News Karnataka, 15 Nov (first-day riders); The Federal (first-day report); The Week (PTI), 11 Nov; Construction World; OneIndia; NewsBytes; ThePrint (PTI), 28 Oct; South First</div>
<div><b>p. 05 · City desk</b>NewsBytes; Swarajya (BMTC feeders); BioSpectrum, YourStory and South First (summit); NewKerala, 9 Nov (BDA fee cut)</div>
<div><b>p. 06 · Two reports</b>Deccan Herald, Khel Now and District (match day); BioSpectrum, YourStory and South First (BIEC); TradeIndia (another venue)</div>
<div><b>p. 07 · On the line</b>Deccan Herald; The Federal; Inshorts; News Karnataka; Swarajya; NewsBytes</div>
<div><b>p. 08 · Interchange</b>OneIndia; Swarajya; The Federal; News Karnataka</div>
<div><b>p. 09 · Rider questions</b>Deccan Herald; The Week (PTI); Inshorts; News Karnataka; Construction World; OneIndia; Swarajya; The Federal</div>
<div><b>p. 10 · Timeline</b>Deccan Herald; Business Today, 10 Aug; Swarajya; Construction World; Inshorts; News Karnataka</div>
<div><b>p. 11 · The ledger</b>NewsBytes; Business Today, 31 Mar (Gnani.ai); Economic Times, relayed by Digg; YourStory, 3 Nov</div>
<div><b>p. 12 · Field &amp; ground</b>District; Khel Now; Deccan Herald; Devdiscourse; Mykhel</div>
<div><b>p. 13 · The week ahead</b>BioSpectrum; TradeIndia; District; Khel Now; Deccan Herald; ThePrint; Karnataka tourism listings (Kadalekai Parishe rule)</div>
<div><b>Photographs</b>Wikimedia Commons. Cover and p. 01 Jayadeva viaduct: Gpkp (CC BY-SA 4.0). p. 04 Pink Line map: Mallikarjunasj (CC BY-SA 3.0). p. 05 KR Market station: Gpkp (CC BY-SA 4.0). p. 06 Town Hall: Harvinder Chandigarh (CC BY 4.0). p. 12 Chinnaswamy: Visdaviva (CC BY-SA 3.0). p. 14 sample, Vidhana Soudha: Sai23ganesh (CC BY-SA 4.0).</div>
</div>
<div class="made">
<span><b>How this was made.</b> Gathered through a news search and checked against at least one report for each item; several reports were read as headlines and summaries only. Summarised in our own words; no article text or press photographs were reused.</span>
<span>Atlas Bengaluru · a sample city edition · Week 47, 2026</span>
</div>
</div><div class="folio"><span>Colophon</span><span>15</span></div></div>`),
  ],
};
