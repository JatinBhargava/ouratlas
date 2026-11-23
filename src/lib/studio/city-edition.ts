/**
 * The City Edition: sixteen pages for a weekly issue about one city, set with a
 * sample edition of Bengaluru news (19–22 November 2026).
 *
 * Written here rather than drawn on the design canvas, so it is not in
 * `pages.json` (which only `scripts/studio.ts` writes). `loadStudio` adds it to
 * the shelves after the canvas's own sections, in the same lazy chunk.
 *
 * The other complete issues tell one story; a city edition carries many short
 * ones, so its pages are built for that: a front page with teasers, contents by
 * section, big figures, a then-and-now pair, briefs, a ward tracker with bars, two readings of a story side by side,
 * a transit route, rider questions answered, a timeline of dates, a funding table,
 * scorecards, a week of dates, a reader's page and a sources page. Every page is sized in container units (`cqw`) against its own
 * 780px width, so it draws the same at any scale the studio shows it.
 *
 * Only the site's Instrument Serif is a webfont here; the sans and mono are
 * system stacks, like the rest of the studio. The route diagram is inline SVG,
 * which the editor leaves alone (`fill-in.tsx` skips anything inside `svg`),
 * so its station names are part of the drawing, not text to retype. This
 * edition's new layout, the then-and-now pair on page 05, replaced the
 * interchange diagram: with no new Pink Line news the diagram repeated
 * what the rider questions already say, and the issue is capped at sixteen pages.
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
.stop { position: relative; display: grid; grid-template-columns: 6.6cqw minmax(0, 1fr) auto; gap: 2.2cqw; align-items: center; padding: 0.1cqw 0; }
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

/* 05 Then and Now */
.then h3 { font-size: 7.4cqw; }
.then .stand { font-size: 2.2cqw; color: var(--muted); max-width: 92%; }
.then .pair { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 2cqw; align-items: stretch; }
.then .yr { border-top: 0.6cqw solid var(--c); padding-top: 1.3cqw; display: grid; gap: 0.8cqw; align-content: start; }
.then .yr .y { font-family: var(--mono); font-size: 1.55cqw; letter-spacing: 0.1em; text-transform: uppercase; color: var(--c); }
.then .yr strong { font-family: var(--display); font-weight: 400; font-size: 10.5cqw; line-height: 0.9; color: var(--c); letter-spacing: -0.02em; font-variant-numeric: lining-nums; }
.then .yr p { font-size: 2cqw; line-height: 1.4; }
.then .arrow { align-self: center; font-family: var(--display); font-size: 5.4cqw; color: var(--muted); }
.then .cmp { display: grid; border-top: 0.25cqw solid var(--ink); }
.then .cmp > div { display: grid; grid-template-columns: 13cqw minmax(0, 1fr) minmax(0, 1fr); gap: 2.2cqw; padding: 2.2cqw 0; border-bottom: 0.15cqw solid var(--rule); }
.then .cmp .k { font-family: var(--mono); font-size: 1.45cqw; text-transform: uppercase; letter-spacing: 0.06em; color: var(--blue); padding-top: 0.3cqw; }
.then .cmp span:not(.k) { font-size: 2.05cqw; line-height: 1.38; }
.then .note { margin-top: auto; border-top: 0.15cqw solid var(--rule); padding-top: 1.4cqw; font-size: 1.85cqw; line-height: 1.4; color: var(--muted); }

/* 06 Desk Briefs */
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

/* 07 Ward Tracker */
.track h3 { font-size: 7.4cqw; }
.track .stand { font-size: 2.2cqw; color: var(--muted); max-width: 92%; }
.track .meter { display: grid; gap: 1.2cqw; border-top: 0.25cqw solid var(--ink); padding-top: 1.5cqw; }
.track .meter b { font-family: var(--display); font-weight: 400; font-size: 3.6cqw; line-height: 1; }
.track .bar { display: grid; grid-template-columns: 25cqw minmax(0, 1fr) 11cqw; gap: 1.6cqw; align-items: center; }
.track .bar span { font-size: 1.75cqw; line-height: 1.25; }
.track .bar .rail { height: 2.8cqw; background: color-mix(in srgb, var(--c) 12%, var(--paper)); border-radius: 0.4cqw; overflow: hidden; }
.track .bar .rail i { display: block; height: 100%; background: var(--c); border-radius: 0.4cqw; min-width: 0.7cqw; }
.track .bar em { font-style: normal; font-family: var(--display); font-size: 3.6cqw; line-height: 1; text-align: right; color: var(--c); font-variant-numeric: lining-nums tabular-nums; }
.track .note { margin-top: auto; border-top: 0.15cqw solid var(--rule); padding-top: 1.4cqw; font-size: 1.85cqw; line-height: 1.4; color: var(--muted); display: grid; gap: 0.8cqw; }

/* 08 Two Reports */
.two .band { height: 27%; flex: none; position: relative; }
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

/* 09 The Line */
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

/* 10 Questions & Answers */
.qa h3 { font-size: 7.4cqw; }
.qa .list { flex: 1; min-height: 0; display: grid; grid-auto-rows: minmax(0, 1fr); border-top: 0.25cqw solid var(--ink); }
.qa .item { display: grid; grid-template-columns: 8cqw minmax(0, 1fr); gap: 0 2cqw; padding: 1.3cqw 0; border-bottom: 0.15cqw solid var(--rule); min-height: 0; }
.qa .q { font-family: var(--display); font-style: italic; font-size: 7.4cqw; line-height: 0.85; color: var(--c); }
.qa .item > div { display: grid; gap: 0.5cqw; align-content: start; }
.qa .item b { font-family: var(--display); font-weight: 400; font-size: 3.5cqw; line-height: 1; }
.qa .item p { font-size: 1.9cqw; line-height: 1.38; }
.qa .who { font-family: var(--mono); font-size: 1.4cqw; color: var(--muted); }

/* 11 Timeline */
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

/* 12 Ledger Table */
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

/* 13 Scoreboard */
.score .ph { height: 31%; flex: none; position: relative; }
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

/* 14 Week Ahead */
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

/* 15 Reader's Page */
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

/* 16 Sources & Credits */
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
  blurb: "An edition of one city on sixteen pages: front page, contents by section, the numbers, the summit week and its conclave a year on, a ward tracker, two readings of a road, the metro line, rider questions answered, a timeline of dates, the ledger, the scoreboard and the week ahead",
  pages: [
    page("01-front", "City Front", `<div class="page front"><div class="pin">
<div class="mast"><h3 class="hd">Atlas <i>Bengaluru</i></h3><div class="date">Week 47<br>19–22 Nov 2026<br>Issue 06</div></div>
<div class="lines" aria-hidden="true"><i style="background:var(--purple)"></i><i style="background:var(--green)"></i><i style="background:var(--yellow)"></i><i style="background:var(--pink)"></i><i style="background:var(--blue)"></i></div>
<div class="hero"><img class="photo" src="%photo:blr-town-hall%" alt="Sir Puttanna Chetty Town Hall, Bengaluru"><span class="cap">Town Hall, a Bengaluru landmark · Harvinder Chandigarh, CC BY 4.0</span></div>
<div class="lead">
<h4 class="hd">The summit closes on ₹1,050 crore</h4>
<p>The Bengaluru Tech Summit ended on Thursday 19 November. Its startup conclave drew about ₹1,050 crore in pledges from 24 venture firms.</p>
</div>
<div class="teasers">
<div style="--c:var(--blue)"><b>The conclave, a year on</b><span>p. 05</span></div>
<div style="--c:var(--green)"><b>Ward One, counted</b><span>p. 07</span></div>
<div style="--c:var(--yellow)"><b>Ballari Road, two lengths</b><span>p. 08</span></div>
</div>
</div><div class="folio"><span>Atlas Bengaluru</span><span>01</span></div></div>`),
    page("02-index", "Section Index", `<div class="page index"><div class="pin">
<span class="lbl">In this issue</span>
<div class="route">
<div class="stop" style="--c:var(--purple)"><span class="dot">03</span><div><b>By the numbers</b><span>The edition in six figures</span></div><span class="pg">p. 03</span></div>
<div class="stop" style="--c:var(--blue)"><span class="dot">04</span><div><b>Summit week</b><span>AI &amp; Beyond, and what it closed on</span></div><span class="pg">p. 04</span></div>
<div class="stop" style="--c:var(--blue)"><span class="dot">05</span><div><b>Then and now</b><span>The startup conclave, a year on</span></div><span class="pg">p. 05</span></div>
<div class="stop" style="--c:var(--green)"><span class="dot">06</span><div><b>City desk</b><span>A festival, a food show, a junction</span></div><span class="pg">p. 06</span></div>
<div class="stop" style="--c:var(--green)"><span class="dot">07</span><div><b>Ward One, counted</b><span>Potholes, banners and debris</span></div><span class="pg">p. 07</span></div>
<div class="stop" style="--c:var(--yellow)"><span class="dot">08</span><div><b>Two readings</b><span>Ballari Road: how long, and who is curbed</span></div><span class="pg">p. 08</span></div>
<div class="stop" style="--c:var(--pink)"><span class="dot">09</span><div><b>On the line</b><span>Six stations, 7.5 km, week two</span></div><span class="pg">p. 09</span></div>
<div class="stop" style="--c:var(--pink)"><span class="dot">10</span><div><b>Rider questions</b><span>Six answers for the first weeks</span></div><span class="pg">p. 10</span></div>
<div class="stop" style="--c:var(--pink)"><span class="dot">11</span><div><b>Timeline</b><span>Seven dates for one line</span></div><span class="pg">p. 11</span></div>
<div class="stop" style="--c:var(--blue)"><span class="dot">12</span><div><b>The ledger</b><span>Small rounds, and a quiet week</span></div><span class="pg">p. 12</span></div>
<div class="stop" style="--c:var(--green)"><span class="dot">13</span><div><b>Field &amp; ground</b><span>Bengaluru FC, a Friday fixture</span></div><span class="pg">p. 13</span></div>
<div class="stop" style="--c:var(--purple)"><span class="dot">14</span><div><b>The week ahead</b><span>A food show, a concert and a deadline</span></div><span class="pg">p. 14</span></div>
<div class="stop" style="--c:var(--purple)"><span class="dot">15</span><div><b>Reader's page</b><span>Your Bengaluru, in your words</span></div><span class="pg">p. 15</span></div>
</div>
<div class="how"><span>Every item ends with its source. <span class="flag">2 readings</span> marks a name, date or figure the papers don't agree on.</span></div>
</div><div class="folio"><span>Contents</span><span>02</span></div></div>`),
    page("03-numbers", "By the Numbers", `<div class="page numbers"><div class="pin">
<span class="lbl">By the numbers</span>
<h3 class="hd" style="font-size:7.4cqw">The edition, counted</h3>
<div class="grid">
<div class="n" style="--c:var(--blue)"><strong style="font-size:9cqw">₹1,050 cr</strong><p>Deep-tech investment announced by 24 venture firms at the summit's Future Makers Conclave. Pledges, not payments.</p><span class="src">Analytics India Magazine; The South First, Nov 2026</span></div>
<div class="n" style="--c:var(--purple)"><strong>63,200</strong><p>Young people the state says it will train in AI, announced on the summit's first day.</p><span class="src">CXOToday, Nov 2026</span></div>
<div class="n" style="--c:var(--pink)"><strong>33,409</strong><p>Reported riders on the Pink Line's first day, Saturday 14 November. The only count we found.</p><span class="src">Inshorts; Deccan Herald</span></div>
<div class="n" style="--c:var(--yellow)"><strong>18 mo</strong><p>How long Ballari Road traffic curbs are due to run from 6 November while BDA builds an elevated corridor.</p><span class="src">The News Minute; OneIndia</span></div>
<div class="n" style="--c:var(--green)"><strong>10 days</strong><p>Bengaluru Jatre, a city-wide festival the GBA is organising, planned for 4 to 13 December.</p><span class="src">The South First; Asianet Newsable</span></div>
<div class="n" style="--c:var(--blue)"><strong style="font-size:9cqw">$4.4 bn</strong><p>Startup funding Bengaluru reportedly drew in the first nine months of 2026. Our running total.</p><span class="src">Economic Times, via Digg</span></div>
</div>
</div><div class="folio"><span>By the numbers</span><span>03</span></div></div>`),
    page("04-lead", "Broadsheet Lead", `<div class="page lead-pg"><div class="pin">
<span class="lbl c" style="--c:var(--blue)">Summit week</span>
<h3 class="hd">AI &amp; Beyond closes on a ₹1,050 crore headline</h3>
<p class="stand">The summit ran from 17 to 19 November. The big number came on the last day. Here is what it counts, and what it does not.</p>
<div class="body">
<div class="ph"><img class="photo" style="object-position:50% 18%" src="%photo:blr-vidhana-soudha%" alt="Vidhana Soudha lit up at night"><span class="cap">Vidhana Soudha, seat of the Karnataka government · Sai23ganesh, CC BY-SA 4.0</span></div>
<div class="col c1">
<p>The 29th Bengaluru Tech Summit ended on Thursday 19 November at the BIEC, after three days under the theme "AI &amp; Beyond", CXOToday reports. Its startup showcase, the Future Makers Conclave, drew about ₹1,050 crore in deep-tech investment announcements from 24 venture capital firms, as The South First and Analytics India Magazine report.</p>
<p class="pull">₹1,050 crore, in announcements.</p>
</div>
<div class="col c2">
<p>That is a pledge. We found no report of how much has been paid out. The summit's first day brought a ₹100 crore robotics hub and AI training for 63,200 young people, CXOToday says.</p>
<p>The South First's headline also says the state signed international MoUs. We did not find a total for them.</p>
</div>
<div class="col c3">
<p>A CXOToday day-two headline says Bengaluru holds 71% of India's recent AI unicorns. We read the headline, not the study behind it.</p>
<p>Page 05 sets this year's conclave against last year's, which is harder than it looks.</p>
<p class="src">CXOToday · The South First · Analytics India Magazine · Deccan Herald · Devdiscourse</p>
</div>
</div>
</div><div class="folio"><span>Feature</span><span>04</span></div></div>`),
    page("05-then-now", "Then and Now", `<div class="page then"><div class="pin">
<span class="lbl c" style="--c:var(--blue)">Then and now</span>
<h3 class="hd">The startup conclave, a year on</h3>
<p class="stand">Both years' conclaves closed the Bengaluru Tech Summit with a sum for deep-tech startups. The sums are not counted the same way, so we set each beside the other.</p>
<div class="pair">
<div class="yr" style="--c:var(--muted)"><span class="y">November 2025</span><strong>₹400 cr</strong><p>Deccan Herald and Devdiscourse put the year's close at ₹400 crore for deep-tech startups, from the state and venture firms.</p></div>
<span class="arrow" aria-hidden="true">→</span>
<div class="yr" style="--c:var(--blue)"><span class="y">November 2026</span><strong>₹1,050 cr</strong><p>The South First and Analytics India Magazine report about ₹1,050 crore announced by 24 venture firms.</p></div>
</div>
<div class="cmp">
<div><span class="k">Firms</span><span>16 venture funds, in a pre-event plan for ₹430 crore (Deccan Herald)</span><span>24 venture firms, as reported after the conclave</span></div>
<div><span class="k">Wording</span><span>"Distribute" and "boost" in the closing headlines of Deccan Herald and Devdiscourse</span><span>"Announcements" of "investment"; no report of money paid out</span></div>
<div><span class="k">Also said</span><span>A joint fund of over ₹1,000 crore, in The Week's (PTI) 18 Nov 2025 headline</span><span>A ₹100 crore robotics hub and 63,200 young people to be trained, on day one (CXOToday)</span></div>
</div>
<p class="note">So is it two and a half times last year's? Only against the ₹400 crore, and 2025's own reports also carried ₹430 crore and "over ₹1,000 crore". We read these as headlines and summaries.</p>
</div><div class="folio"><span>Then and now</span><span>05</span></div></div>`),
    page("06-briefs", "Desk Briefs", `<div class="page briefs-pg"><div class="pin">
<span class="lbl c" style="--c:var(--green)">City desk</span>
<h3 class="hd">Around town</h3>
<div class="grid">
<div class="brief"><span class="where">Metro</span><b>Day one is still the figure</b><p>We found no Pink Line count for a weekday. A BMRCL official expects the pattern to steady toward the end of November, newskarnataka reports. Pictured is KR Market, an existing station.</p><div class="shot"><img class="photo" src="%photo:blr-kr-market%" alt="Krishna Rajendra Market metro station entrance"><span class="cap">KR Market station · Gpkp, CC BY-SA 4.0</span></div><span class="src">newskarnataka; Swarajya</span></div>
<div class="brief"><span class="where">Festival</span><b>Bengaluru Jatre, from 4 December</b><p>The GBA is the nodal agency for a ten-day festival from 4 to 13 December, with no central venue and more than 300 programmes planned, The South First reports. The state puts the cost at ₹15 to 20 crore.</p><span class="src">The South First; Asianet Newsable</span></div>
<div class="brief"><span class="where">Junction</span><b>Konanakunte Cross to be reworked</b><p>A minister's review told the South city corporation to improve Konanakunte Cross to ease traffic, Deccan Chronicle reports. The same review looked ahead to the next Ward One round, set for 21 November.</p><span class="src">Deccan Chronicle</span></div>
<div class="brief"><span class="where">Trade</span><b>Indusfood, 25 to 27 November</b><p>A food and drink sourcing show at the BIEC, run by the Trade Promotion Council of India, open from 9 am. Its conference programme was still to be published in the listings we saw.</p><span class="src">Indusfood Bengaluru site; Expomap</span></div>
</div>
</div><div class="folio"><span>City desk</span><span>06</span></div></div>`),
    page("07-tracker", "Ward Tracker", `<div class="page track"><div class="pin">
<span class="lbl c" style="--c:var(--green)">Ward One, counted</span>
<h3 class="hd">A month-long clean-up, and what we could count</h3>
<p class="stand">The GBA's Ward One campaign works one ward per division through November. We found one new count this week, on banners. The pothole and debris bars are last edition's figures from The Bengaluru Live, with their dates, because nothing newer turned up.</p>
<div class="meter" style="--c:var(--green)"><b>Potholes repaired (last edition's counts)</b>
<div class="bar"><span>North, first week to 7 Nov</span><div class="rail"><i style="width:100%"></i></div><em>145</em></div>
<div class="bar"><span>Central, 13 Nov only</span><div class="rail"><i style="width:7.6%"></i></div><em>11</em></div>
<div class="bar"><span>North, 13 Nov only</span><div class="rail"><i style="width:6.9%"></i></div><em>10</em></div>
</div>
<div class="meter" style="--c:var(--yellow)"><b>Unauthorised banners removed (new)</b>
<div class="bar"><span>Central corporation, campaign</span><div class="rail"><i style="width:100%"></i></div><em>273</em></div>
<div class="bar"><span>Chickpet division, of those</span><div class="rail"><i style="width:30%"></i></div><em>82</em></div>
</div>
<div class="meter" style="--c:var(--blue)"><b>Debris cleared, tonnes (last edition's counts)</b>
<div class="bar"><span>North, first week to 7 Nov</span><div class="rail"><i style="width:100%"></i></div><em>797</em></div>
<div class="bar"><span>Central, 13 Nov only</span><div class="rail"><i style="width:10.5%"></i></div><em>83.5</em></div>
</div>
<div class="note">
<span>Deccan Chronicle gave the banner counts without a date we could confirm. A minister's review set the next Ward One round for 21 November; we found no tally from it.</span>
<span class="src">Deccan Chronicle (Central, banners; review) · The Bengaluru Live (North, 7 Nov and 13 Nov; Central, 13 Nov)</span>
</div>
</div><div class="folio"><span>Ward tracker</span><span>07</span></div></div>`),
    page("08-two-reports", "Two Reports", `<div class="page two"><div class="pin">
<div class="band"><img class="photo" src="%photo:blr-viaduct%" alt="Traffic under the Namma Metro viaduct near Jayadeva Hospital"><span class="cap">Under the metro viaduct at Jayadeva Hospital, not on Ballari Road · Gpkp, CC BY-SA 4.0</span></div>
<h3 class="hd">Ballari Road: how long, and who is curbed</h3>
<div class="claim">
<p class="what"><b>How long is the elevated corridor?</b> BDA began work on 6 November, with curbs for about 18 months, on a corridor from the UAS staff quarters towards Mehkri Circle.</p>
<div class="vs">
<div class="side"><strong>1.6 km</strong><span>four lanes · The News Minute, Construction World</span></div>
<span class="or">or</span>
<div class="side"><strong>1.74 km</strong><span>four lanes · Swarajya, Dynamite News</span></div>
</div>
<p class="what">Deccan Herald's report of the cabinet approval lists a 1.70 km corridor costing ₹725 crore, inside a ₹2,215 crore Hebbal project. The lengths may count ramps and the rotary differently; no report says.</p>
</div>
<div class="claim">
<p class="what"><b>Who is kept off the road?</b> Goods vehicles of every weight, and KSRTC and private buses, according to the Traffic Police advisory as reported by The News Minute and OneIndia. Cars, bikes and school buses go on.</p>
<div class="vs">
<div class="side"><strong>All goods vehicles</strong><span>and buses · The News Minute, OneIndia</span></div>
<span class="or">or</span>
<div class="side"><strong>Heavy goods only</strong><span>one report we could not trace to an outlet</span></div>
</div>
</div>
<p class="rule-note">We print both and say who said what. The police advisory is the one to check before you drive.</p>
</div><div class="folio"><span>Two readings</span><span>08</span></div></div>`),
    page("09-line", "The Line", `<div class="page line-pg"><div class="pin">
<span class="lbl c" style="--c:var(--pink)">On the line</span>
<h3 class="hd">Six stations, 7.5 km, week two</h3>
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
<b>What is running</b>
<p>IBTimes India puts the cost of the elevated Pink Line at about ₹3,470 crore. OneIndia's timetable has weekday trains every 8 minutes at peak and every 10 off-peak, with the Monday first train at 4:55 am from Kalena Agrahara. The underground stretch, Dairy Circle to Nagawara, is a separate job; Swarajya reported a May 2027 target for it and the Blue Line.</p>
</div>
<div class="blk">
<b>Three dates, and the one still to come</b>
<div class="ahead">
<div style="--c:var(--pink)"><strong>Sat 14 Nov</strong><span>Public service begins; 33,409 riders reported</span></div>
<div style="--c:var(--blue)"><strong>Mon 16 Nov</strong><span>The first weekday rush; still no count in anything we found</span></div>
<div style="--c:var(--purple)"><strong>End of Nov</strong><span>When a BMRCL official expects ridership to steady</span></div>
</div>
</div>
<div class="blk">
<b>What the reports did not say</b>
<p>Swarajya puts average weekday ridership across the network at about 9.16 lakh, and expects it to pass 10 lakh once the Pink Line opens. That is a network figure, not the Pink Line's. No Pink Line weekday count, fare or last train was in anything we found, so none is printed.</p>
</div>
<p class="src">Deccan Herald · IBTimes India · OneIndia · newskarnataka · Swarajya</p>
</div><div class="folio"><span>On the line</span><span>09</span></div></div>`),
    page("10-questions", "Questions & Answers", `<div class="page qa"><div class="pin">
<span class="lbl c" style="--c:var(--pink)">Rider questions</span>
<h3 class="hd">Six questions for the first weeks</h3>
<div class="list">
<div class="item" style="--c:var(--pink)"><span class="q">1</span><div><b>Is it open?</b><p>Yes. Public service began on Saturday 14 November, a day after the inauguration. The first weekday was Monday 16 November.</p><span class="who">Deccan Herald · The Week (PTI)</span></div></div>
<div class="item" style="--c:var(--purple)"><span class="q">2</span><div><b>Where does it go?</b><p>Six elevated stations over 7.5 km: Kalena Agrahara, Hulimavu, IIM-B, JP Nagar 4th Phase, Jayadeva Hospital and Tavarekere (also called Suddagunte Palya).</p><span class="who">Construction World · IBTimes India</span></div></div>
<div class="item" style="--c:var(--green)"><span class="q">3</span><div><b>How often do trains run?</b><p>Every 8 minutes at weekday peak and every 10 off-peak. The first train on Monday left Kalena Agrahara at 4:55 am.</p><span class="who">OneIndia · IBTimes India</span></div></div>
<div class="item" style="--c:var(--yellow)"><span class="q">4</span><div><b>How many people rode?</b><p>33,409 on the first day, as reported. A BMRCL official expects the pattern to steady toward the end of November. We found no weekday figure.</p><span class="who">Inshorts · newskarnataka</span></div></div>
<div class="item" style="--c:var(--blue)"><span class="q">5</span><div><b>What will it cost?</b><p>A Goodreturns explainer lists the fare in its headline, but we read only the headline, so no fare is printed. Check BMRCL's notices before you travel.</p><span class="who">Goodreturns, headline only</span></div></div>
<div class="item" style="--c:var(--pink)"><span class="q">6</span><div><b>Can I change to another line?</b><p>Yes, at Jayadeva Hospital, a multi-tier station where the Pink Line meets the Yellow Line towards Electronic City.</p><span class="who">OneIndia · Swarajya</span></div></div>
</div>
</div><div class="folio"><span>Rider questions</span><span>10</span></div></div>`),
    page("11-timeline", "Timeline", `<div class="page timeline"><div class="pin">
<span class="lbl c" style="--c:var(--pink)">Timeline</span>
<h3 class="hd">Seven dates for one line</h3>
<p class="stand">Each date below was reported for the Pink Line. Two were missed, three were kept, one is still unmeasured and one is a target.</p>
<ol class="tl">
<li class="miss"><time>15 Aug 2026</time><i class="nd"></i><div><span class="st">Missed</span><b>An Independence Day launch</b><span>Business Today reported the line aiming for 15 August, in a piece dated 10 August.</span></div></li>
<li class="miss"><time>Sep 2026</time><i class="nd"></i><div><span class="st">Missed</span><b>A September opening</b><span>Swarajya and Construction World reported the 7.5-kilometre stretch ready for a September launch.</span></div></li>
<li class="done"><time>28 Oct 2026</time><i class="nd"></i><div><span class="st">Done</span><b>Safety clearance</b><span>The Commissioner of Metro Railway Safety cleared the elevated stretch. Passengers still waited.</span></div></li>
<li class="done"><time>13 Nov 2026</time><i class="nd"></i><div><span class="st">Done</span><b>Inauguration day</b><span>A Friday. The Prime Minister rode with the Chief Minister, Deccan Herald reports.</span></div></li>
<li class="done"><time>14 Nov 2026</time><i class="nd"></i><div><span class="st">Done</span><b>Public service</b><span>A Saturday. Inshorts reports 33,409 riders on the first day.</span></div></li>
<li class="next"><time>16 Nov 2026</time><i class="nd"></i><div><span class="st">Unmeasured</span><b>The first weekday</b><span>A BMRCL official said the effect would show from Monday. A week on, we still found no figure.</span></div></li>
<li class="far"><time>May 2027</time><i class="nd"></i><div><span class="st">Target</span><b>The underground stretch</b><span>Swarajya reports May 2027 for the underground Pink Line and the Blue Line on the Outer Ring Road.</span></div></li>
</ol>
<p class="src">Dates are as reported, not an official timetable. Deccan Herald · Business Today · Swarajya · Construction World · Inshorts</p>
</div><div class="folio"><span>Timeline</span><span>11</span></div></div>`),
    page("12-ledger", "Ledger Table", `<div class="page ledger-pg"><div class="pin">
<span class="lbl c" style="--c:var(--blue)">The ledger</span>
<h3 class="hd">Small rounds, and a quiet week</h3>
<table>
<thead><tr><th scope="col">Company</th><th scope="col">What happened</th><th scope="col">Amount</th></tr></thead>
<tbody>
<tr><td class="co"><b>Soket AI Labs</b><span>Frontier AI research, seed</span></td><td>Finvolve and India Accelerator announced an investment in the Bengaluru lab. The size was not disclosed.</td><td class="amt">Undisclosed<small>OneIndia, Nov 2026</small></td></tr>
<tr><td class="co"><b>ECOPATH</b><span>Climate tech, seed</span></td><td>Social Alpha and Gemcorp backed the Bengaluru startup's zero-cement construction technology. Older than this edition's window; it was in YourStory's 3 November roundup.</td><td class="amt">₹2.25 cr<small>YourStory, 3 Nov</small></td></tr>
<tr><td class="co"><b>Humyn Labs</b><span>Data for physical AI, Series A</span></td><td>Last edition's lead round: TechCrunch's headline of 18 November puts it at $47 million, with Accel backing. We read the headline only.</td><td class="amt">$47M<small>TechCrunch, 18 Nov</small></td></tr>
<tr><td class="co"><b>Bengaluru</b><span>Jan to Sep 2026</span></td><td>The city drew about $4.4 billion in startup funding in the first nine months of the year, as the Economic Times reported and Digg relayed. Kept as the running total.</td><td class="amt">$4.4B<small>Economic Times, via Digg</small></td></tr>
</tbody>
</table>
<p class="foot">We found no Bengaluru round we could confirm and date between 19 and 22 November. PlatinumRx's reported talks to raise about $32 million are not printed: a round in talks is not a round closed.</p>
</div><div class="folio"><span>The ledger</span><span>12</span></div></div>`),
    page("13-scoreboard", "Scoreboard", `<div class="page score"><div class="pin">
<div class="ph"><img class="photo" src="%photo:blr-chinnaswamy%" alt="M. Chinnaswamy Stadium from the stands"><span class="cap">The Chinnaswamy, home ground of RCB · Visdaviva, CC BY-SA 3.0</span></div>
<span class="lbl c" style="--c:var(--yellow)">Field &amp; ground</span>
<h3 class="hd">A Friday fixture, and no score</h3>
<div class="card">
<div class="top"><span>Indian Super League</span><span>Home match</span></div>
<div class="rows">
<div class="row"><span>Fixture</span><span>Bengaluru FC v Mumbai City FC</span></div>
<div class="row"><span>Ground</span><span>Sree Kanteerava Stadium</span></div>
<div class="row"><span>Day</span><span>Fri 20 Nov, 7:30 pm, as Khel Now's preview of 19 November has it</span></div>
<div class="row"><span>The result</span><span>We found no match report, so no score is printed. Check the club or the ISL site.</span></div>
</div>
</div>
<div class="card">
<div class="top"><span>This season</span><span>Bengaluru FC</span></div>
<div class="rows">
<div class="row"><span>10 Oct</span><span>Won 3–2 v SC Delhi</span></div>
<div class="row"><span>30 Oct</span><span>Drew 1–1 v NorthEast United</span></div>
<div class="row"><span>6 Nov</span><span>Won 2–1 at FC Goa, in stoppage time</span></div>
<div class="row"><span>Before Friday</span><span>Three wins and a draw from four, and Mumbai City still looking for a first win, Khel Now's preview says</span></div>
</div>
</div>
<p class="src">Khel Now · Mykhel · Devdiscourse · Fotmob</p>
</div><div class="folio"><span>Field &amp; ground</span><span>13</span></div></div>`),
    page("14-week-ahead", "Week Ahead", `<div class="page week"><div class="pin">
<span class="lbl c" style="--c:var(--purple)">The week ahead</span>
<h3 class="hd">A food show, a concert and a deadline</h3>
<div class="days">
<div class="day"><span class="dn">Mon</span><span class="dd">23</span><span class="ev" style="--c:var(--purple)">This edition</span></div>
<div class="day"><span class="dn">Tue</span><span class="dd">24</span><span class="ev" style="--c:var(--muted)">Nothing verified</span></div>
<div class="day"><span class="dn">Wed</span><span class="dd">25</span><span class="ev" style="--c:var(--green)">Indusfood opens, BIEC</span><span class="ev" style="--c:var(--purple)">Reader's page deadline</span></div>
<div class="day"><span class="dn">Thu</span><span class="dd">26</span><span class="ev" style="--c:var(--green)">Indusfood, day two</span><span class="ev" style="--c:var(--purple)">Next edition</span></div>
<div class="day"><span class="dn">Fri</span><span class="dd">27</span><span class="ev" style="--c:var(--green)">Indusfood, last day</span></div>
<div class="day"><span class="dn">Sat</span><span class="dd">28</span><span class="ev" style="--c:var(--muted)">Nothing verified</span></div>
<div class="day"><span class="dn">Sun</span><span class="dd">29</span><span class="ev" style="--c:var(--pink)">Diljit Dosanjh, NICE Grounds</span></div>
</div>
<div class="later">
<div><em>Wed 25 to Fri 27 Nov</em><span><b>Indusfood Bengaluru</b>From 9 am at the BIEC on Tumkur Road, organised by the Trade Promotion Council of India, per the show's own site and Expomap</span></div>
<div><em>Sun 29 Nov</em><span><b>Diljit Dosanjh, AURA India tour</b>At NICE Grounds, Madavara, partly seated per BookMyShow. One aggregator gives a 4 pm start; prices differ by listing, so confirm</span></div>
<div><em>4 to 13 Dec</em><span><b>Bengaluru Jatre</b>A city-wide festival run through the GBA, with no central stage and more than 300 programmes planned, The South First reports</span></div>
<div><em>To about May 2028</em><span><b>Ballari Road corridor work</b>BDA's elevated corridor, 18 months from 6 November, with curbs on some vehicles</span></div>
</div>
<p class="src">Indusfood Bengaluru · Expomap · BookMyShow · NewsX · The South First · The News Minute · OneIndia</p>
</div><div class="folio"><span>The week ahead</span><span>14</span></div></div>`),
    page("15-reader", "Reader's Page", `<div class="page reader"><div class="pin">
<div class="top">
<figure class="shot"><img class="photo" src="%photo:blr-pink-line%" alt="Pink Line route map above the doors inside a metro coach"><figcaption class="cap">Your photograph goes here. Sample: the Pink Line map in a coach · Mallikarjunasj, CC BY-SA 3.0</figcaption></figure>
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
<div><b>Send yours</b><span>About 300 words and up to three photographs you took, with your name and neighbourhood. In by Wednesday 25 November for Issue 07.</span></div>
<div><b>Before it prints</b><span>The desk checks names, places, dates and figures, and shows you the page first. Your words and your photographs stay yours.</span></div>
</div>
</div><div class="folio"><span>Reader's page</span><span>15</span></div></div>`),
    page("16-credits", "Sources & Credits", `<div class="page credits"><div class="pin">
<span class="lbl">Sources &amp; credits</span>
<h3 class="hd">Where this came from</h3>
<div class="cols">
<div><b>p. 03–05 · Summit week</b>CXOToday (summit close, day-one announcements, day-two headline); The South First and Analytics India Magazine (₹1,050 crore, 24 firms), Nov 2026; Deccan Herald and Devdiscourse, Nov 2025 (₹400 crore; 16 firms and ₹430 crore before the event); The Week (PTI), 18 Nov 2025 (headline)</div>
<div><b>p. 06 · City desk</b>newskarnataka and Swarajya (Pink Line); The South First and Asianet Newsable (Bengaluru Jatre); Deccan Chronicle (Konanakunte Cross); Indusfood Bengaluru site and Expomap</div>
<div><b>p. 07 · Ward tracker</b>Deccan Chronicle (Central banners; the minister's review); The Bengaluru Live (North, 7 Nov and 13 Nov; Central, 13 Nov), carried from Issue 05</div>
<div><b>p. 08 · Two readings</b>The News Minute, OneIndia and Construction World (Ballari Road curbs, length); Swarajya and Dynamite News (1.74 km); Deccan Herald (cabinet approval, 1.70 km)</div>
<div><b>p. 09 · On the line</b>IBTimes India (cost, first train); OneIndia (timetable); Deccan Herald; Inshorts; newskarnataka; Swarajya</div>
<div><b>p. 10 · Rider questions</b>Deccan Herald; The Week (PTI); Construction World; IBTimes India; OneIndia; Inshorts; newskarnataka; Goodreturns (headline); Swarajya</div>
<div><b>p. 11 · Timeline</b>Business Today, 10 Aug; Swarajya; Construction World; Deccan Herald; Inshorts</div>
<div><b>p. 12 · The ledger</b>OneIndia (Soket AI Labs); YourStory, 3 Nov (ECOPATH); TechCrunch, 18 Nov (headline only); Economic Times, relayed by Digg</div>
<div><b>p. 13 · Field &amp; ground</b>Khel Now, 19 Nov (preview); Mykhel; Devdiscourse; Fotmob</div>
<div><b>p. 14 · The week ahead</b>Indusfood Bengaluru; Expomap; BookMyShow; NewsX; The South First; The News Minute; OneIndia</div>
<div><b>Photographs</b>Wikimedia Commons. p. 01 Town Hall: Harvinder Chandigarh (CC BY 4.0). p. 04 Vidhana Soudha: Sai23ganesh (CC BY-SA 4.0). p. 06 KR Market station: Gpkp (CC BY-SA 4.0). p. 08 Jayadeva viaduct: Gpkp (CC BY-SA 4.0). p. 13 Chinnaswamy: Visdaviva (CC BY-SA 3.0). p. 15 sample, Pink Line map: Mallikarjunasj (CC BY-SA 3.0).</div>
</div>
<div class="made">
<span><b>How this was made.</b> Gathered through a news search and checked against at least one report for each item; most reports were read as headlines and summaries only. Summarised in our own words; no article text or press photographs were reused.</span>
<span>Atlas Bengaluru · a sample city edition · Week 47, 2026</span>
</div>
</div><div class="folio"><span>Colophon</span><span>16</span></div></div>`),
  ],
};
