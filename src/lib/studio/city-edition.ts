/**
 * The City Edition: sixteen pages for a weekly issue about one city, set with a
 * sample edition of Bengaluru news (23–25 November 2026).
 *
 * Written here rather than drawn on the design canvas, so it is not in
 * `pages.json` (which only `scripts/studio.ts` writes). `loadStudio` adds it to
 * the shelves after the canvas's own sections, in the same lazy chunk.
 *
 * The other complete issues tell one story; a city edition carries many short
 * ones, so its pages are built for that: a front page with teasers, contents by
 * section, big figures, a then-and-now pair, briefs, a ward tracker with bars, two readings of a story side by side,
 * a transit route, rider questions answered, a long read with a rail of dates, a funding table,
 * scorecards, a week of dates, a reader's page and a sources page. Every page is sized in container units (`cqw`) against its own
 * 780px width, so it draws the same at any scale the studio shows it.
 *
 * Only the site's Instrument Serif is a webfont here; the sans and mono are
 * system stacks, like the rest of the studio. The route diagram is inline SVG,
 * which the editor leaves alone (`fill-in.tsx` skips anything inside `svg`),
 * so its station names are part of the drawing, not text to retype. This
 * edition's new layout, the long read on page 11, replaced the Pink Line
 * timeline: its dates were already on page 09 and nothing new was reported in
 * a fortnight, and the issue is capped at sixteen pages. A quiet week is
 * printed as one: a section with nothing verifiable carries its older counts
 * with their dates, or says it found none, rather than padding.
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

/* 11 Long Read */
.longread h3 { font-size: 7.4cqw; }
.longread .stand { font-size: 2.2cqw; color: var(--muted); max-width: 92%; }
.longread .rd { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 25cqw; gap: 3.4cqw; border-top: 0.25cqw solid var(--ink); padding-top: 1.8cqw; }
.longread .txt { font-size: 2cqw; line-height: 1.46; display: grid; gap: 1.1cqw; align-content: start; min-height: 0; }
.longread .txt > p:first-child::first-letter { font-family: var(--display); float: left; font-size: 7.2cqw; line-height: 0.8; padding: 0.6cqw 0.8cqw 0 0; color: var(--yellow); }
.longread .txt h5 { font-family: var(--display); font-weight: 400; font-size: 3.4cqw; line-height: 1; margin: 0.8cqw 0 0; }
.longread .rail { border-left: 0.15cqw solid var(--rule); padding-left: 2.2cqw; display: grid; gap: 1.6cqw; align-content: start; min-height: 0; }
.longread .rail div { display: grid; gap: 0.3cqw; border-top: 0.5cqw solid var(--yellow); padding-top: 0.9cqw; }
.longread .rail em { font-style: normal; font-family: var(--mono); font-size: 1.5cqw; letter-spacing: 0.06em; text-transform: uppercase; color: var(--yellow); }
.longread .rail div span { font-size: 1.8cqw; line-height: 1.32; }

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
  blurb: "An edition of one city on sixteen pages: front page, contents by section, the numbers, a festival a week out, a match from preview to result, a ward tracker, two readings of the city vote, the metro line, rider questions answered, a long read with a rail of dates, the ledger, the scoreboard and the week ahead",
  pages: [
    page("01-front", "City Front", `<div class="page front"><div class="pin">
<div class="mast"><h3 class="hd">Atlas <i>Bengaluru</i></h3><div class="date">Week 48<br>23–25 Nov 2026<br>Issue 07</div></div>
<div class="lines" aria-hidden="true"><i style="background:var(--purple)"></i><i style="background:var(--green)"></i><i style="background:var(--yellow)"></i><i style="background:var(--pink)"></i><i style="background:var(--blue)"></i></div>
<div class="hero"><img class="photo" style="object-position:50% 18%" src="%photo:blr-vidhana-soudha%" alt="Vidhana Soudha lit up at night"><span class="cap">Vidhana Soudha, seat of the Karnataka government · Sai23ganesh, CC BY-SA 4.0</span></div>
<div class="lead">
<h4 class="hd">The city vote, moved twice</h4>
<p>The Supreme Court's deadline for the five city corporation elections is 31 December. The State Election Commission has asked for a month more.</p>
</div>
<div class="teasers">
<div style="--c:var(--blue)"><b>Jatre, a week away</b><span>p. 04</span></div>
<div style="--c:var(--green)"><b>December, or January?</b><span>p. 08</span></div>
<div style="--c:var(--yellow)"><b>Top of the table</b><span>p. 13</span></div>
</div>
</div><div class="folio"><span>Atlas Bengaluru</span><span>01</span></div></div>`),
    page("02-index", "Section Index", `<div class="page index"><div class="pin">
<span class="lbl">In this issue</span>
<div class="route">
<div class="stop" style="--c:var(--purple)"><span class="dot">03</span><div><b>By the numbers</b><span>The edition in six figures</span></div><span class="pg">p. 03</span></div>
<div class="stop" style="--c:var(--blue)"><span class="dot">04</span><div><b>The festival</b><span>Bengaluru Jatre, and two numbers that differ</span></div><span class="pg">p. 04</span></div>
<div class="stop" style="--c:var(--blue)"><span class="dot">05</span><div><b>Then and now</b><span>A preview, and then the result</span></div><span class="pg">p. 05</span></div>
<div class="stop" style="--c:var(--green)"><span class="dot">06</span><div><b>City desk</b><span>A metro count, power cuts, jetting machines</span></div><span class="pg">p. 06</span></div>
<div class="stop" style="--c:var(--green)"><span class="dot">07</span><div><b>Ward One, counted</b><span>A directive, and older counts</span></div><span class="pg">p. 07</span></div>
<div class="stop" style="--c:var(--yellow)"><span class="dot">08</span><div><b>Two readings</b><span>The city vote: December, or January?</span></div><span class="pg">p. 08</span></div>
<div class="stop" style="--c:var(--pink)"><span class="dot">09</span><div><b>On the line</b><span>Six stations, 7.5 km, two weeks in</span></div><span class="pg">p. 09</span></div>
<div class="stop" style="--c:var(--pink)"><span class="dot">10</span><div><b>Rider questions</b><span>Six answers, one still open</span></div><span class="pg">p. 10</span></div>
<div class="stop" style="--c:var(--yellow)"><span class="dot">11</span><div><b>The long read</b><span>Why the city's vote keeps moving</span></div><span class="pg">p. 11</span></div>
<div class="stop" style="--c:var(--blue)"><span class="dot">12</span><div><b>The ledger</b><span>A quiet week for rounds</span></div><span class="pg">p. 12</span></div>
<div class="stop" style="--c:var(--green)"><span class="dot">13</span><div><b>Field &amp; ground</b><span>Bengaluru FC go top</span></div><span class="pg">p. 13</span></div>
<div class="stop" style="--c:var(--purple)"><span class="dot">14</span><div><b>The week ahead</b><span>Indusfood, a concert, then Jatre</span></div><span class="pg">p. 14</span></div>
<div class="stop" style="--c:var(--purple)"><span class="dot">15</span><div><b>Reader's page</b><span>Your Bengaluru, in your words</span></div><span class="pg">p. 15</span></div>
</div>
<div class="how"><span>Every item ends with its source. <span class="flag">2 readings</span> marks a name, date or figure the papers don't agree on.</span></div>
</div><div class="folio"><span>Contents</span><span>02</span></div></div>`),
    page("03-numbers", "By the Numbers", `<div class="page numbers"><div class="pin">
<span class="lbl">By the numbers</span>
<h3 class="hd" style="font-size:7.4cqw">The edition, counted</h3>
<div class="grid">
<div class="n" style="--c:var(--yellow)"><strong style="font-size:9cqw">31 Dec</strong><p>The Supreme Court's current deadline for the five city corporation elections. The Election Commission has asked for 31 January 2027.</p><span class="src">Siasat; The South First; The Hans India</span></div>
<div class="n" style="--c:var(--purple)"><strong>127+</strong><p>Areas listed for BESCOM maintenance outages across 23 and 24 November.</p><span class="src">Goodreturns; Asianet Newsable, Nov 2026</span></div>
<div class="n" style="--c:var(--green)"><strong>13 pts</strong><p>Bengaluru FC's tally after five games, enough for top of the ISL table after the 2–0 over Mumbai City.</p><span class="src">ESPN India; IANS, 20 Nov 2026</span></div>
<div class="n" style="--c:var(--pink)"><strong>33,409</strong><p>Reported riders on the Pink Line's first day, Saturday 14 November. Still the only count we found.</p><span class="src">newskarnataka; Deccan Herald</span></div>
<div class="n" style="--c:var(--blue)"><strong>10 days</strong><p>Bengaluru Jatre, a city-wide festival run through the GBA, from 4 to 13 December.</p><span class="src">The South First; Deccan Herald</span></div>
<div class="n" style="--c:var(--blue)"><strong style="font-size:9cqw">$25.2M</strong><p>All Indian startups raised in the week to 13 November, down 90.1% on the week before. A national figure, not Bengaluru's.</p><span class="src">Inc42, Nov 2026</span></div>
</div>
</div><div class="folio"><span>By the numbers</span><span>03</span></div></div>`),
    page("04-lead", "Broadsheet Lead", `<div class="page lead-pg"><div class="pin">
<span class="lbl c" style="--c:var(--blue)">The festival</span>
<h3 class="hd">Bengaluru Jatre opens on 4 December</h3>
<p class="stand">The ten-day festival is a week and a day away. Here is what the reports agree on, and the numbers they don't.</p>
<div class="body">
<div class="ph"><img class="photo" src="%photo:blr-town-hall%" alt="Sir Puttanna Chetty Town Hall, Bengaluru"><span class="cap">Town Hall, a Bengaluru landmark; not a named Jatre venue · Harvinder Chandigarh, CC BY 4.0</span></div>
<div class="col c1">
<p>The Greater Bengaluru Authority is the nodal agency for Bengaluru Jatre, which runs from 4 to 13 December and is billed by The South First as a city-wide celebration of art, culture, literature and communities. It is spread across the five city corporations. The Hans India reports parks, roads, government offices and schools among the venues.</p>
<p class="pull">Ten days, five corporations.</p>
</div>
<div class="col c2">
<p>Krishna Byre Gowda, the minister who announced it, also floated music and performance on Metro concourses, subject to BMRCL. newskarnataka reported on 12 October that more than 300 organisations and over 80 artists had shown interest.</p>
<p>Size is where reports differ: The South First counted more than 300 programmes, while Deccan Herald's headline says 200 venues.</p>
</div>
<div class="col c3">
<p>Cost differs more. Asianet Newsable gave the state's figure as ₹15 to 20 crore; The Hans India's headline has the JDS questioning a ₹200 crore spend. One is an estimate and the other an opposition figure. We found no budget paper.</p>
<p class="src">The South First · The Hans India · Deccan Herald · newskarnataka · Asianet Newsable</p>
</div>
</div>
</div><div class="folio"><span>Feature</span><span>04</span></div></div>`),
    page("05-then-now", "Then and Now", `<div class="page then"><div class="pin">
<span class="lbl c" style="--c:var(--green)">Then and now</span>
<h3 class="hd">From preview to 2–0</h3>
<p class="stand">Issue 06 printed a Friday fixture and no score. The match has since been reported, so we set the preview beside the result.</p>
<div class="pair">
<div class="yr" style="--c:var(--muted)"><span class="y">Thu 19 Nov · preview</span><strong>10 pts</strong><p>Khel Now's preview had Bengaluru FC on three wins and a draw from four, facing a Mumbai City side still seeking a first win.</p></div>
<span class="arrow" aria-hidden="true">→</span>
<div class="yr" style="--c:var(--green)"><span class="y">Fri 20 Nov · result</span><strong>2–0</strong><p>Borja Martínez scored from the spot in the 57th minute and substitute Ryan Williams added a second in the 85th, IANS reports.</p></div>
</div>
<div class="cmp">
<div><span class="k">Points</span><span>10 from four games, by the preview's record</span><span>13 from five, one clear of Mohun Bagan, says ESPN India</span></div>
<div><span class="k">Mumbai City</span><span>Still looking for a first win</span><span>The wait goes on, in new head coach Ashvir Singh Johal's first match, IANS says</span></div>
<div><span class="k">Also noted</span><span>A 7:30 pm kick-off at the Kanteerava, per the preview</span><span>Sunil Chhetri's 200th ISL appearance, per the reports</span></div>
</div>
<p class="note">Reports differ slightly on the penalty and on Bengaluru's home-win count. The scorers and minutes above are the ones reported most consistently. We read these as summaries.</p>
</div><div class="folio"><span>Then and now</span><span>05</span></div></div>`),
    page("06-briefs", "Desk Briefs", `<div class="page briefs-pg"><div class="pin">
<span class="lbl c" style="--c:var(--green)">City desk</span>
<h3 class="hd">Around town</h3>
<div class="grid">
<div class="brief"><span class="where">Metro</span><b>Two weeks, one count</b><p>Still no Pink Line weekday figure in anything we found. A BMRCL official expects the pattern to steady toward the end of November, newskarnataka reports. Pictured is KR Market, an existing station.</p><div class="shot"><img class="photo" src="%photo:blr-kr-market%" alt="Krishna Rajendra Market metro station entrance"><span class="cap">KR Market station · Gpkp, CC BY-SA 4.0</span></div><span class="src">newskarnataka; Swarajya</span></div>
<div class="brief"><span class="where">Power</span><b>Outages on 23 and 24 Nov</b><p>BESCOM listed maintenance cuts across more than 127 areas over the two days. For Monday, the area around the Pottery Road 66/11 kV substation was to be dark from 9 am to 7:30 pm, the listings say.</p><span class="src">Goodreturns; Asianet Newsable</span></div>
<div class="brief"><span class="where">Ward One</span><b>Jetting machines for public spaces</b><p>Each of the five corporations is to use high-pressure jetting machines on junctions, footpaths, bus shelters and flyover pillars, under the Ward One drive. The listings we saw carried no date.</p><span class="src">Deccan Chronicle; The Hans India</span></div>
<div class="brief"><span class="where">Trade</span><b>Indusfood ends on Friday</b><p>The food and drink sourcing show at the BIEC runs to Friday 27 November, from 9 am, run by the Trade Promotion Council of India. We saw no conference programme in the listings.</p><span class="src">Indusfood Bengaluru site; Expomap</span></div>
</div>
</div><div class="folio"><span>City desk</span><span>06</span></div></div>`),
    page("07-tracker", "Ward Tracker", `<div class="page track"><div class="pin">
<span class="lbl c" style="--c:var(--green)">Ward One, counted</span>
<h3 class="hd">A month-long clean-up, and what we could count</h3>
<p class="stand">The GBA's Ward One campaign works one ward per division through November. This week brought a directive on jetting machines, not a count. The bars below are earlier counts, with their dates, because nothing newer turned up.</p>
<div class="meter" style="--c:var(--green)"><b>Potholes repaired (counts from Issue 05)</b>
<div class="bar"><span>North, first week to 7 Nov</span><div class="rail"><i style="width:100%"></i></div><em>145</em></div>
<div class="bar"><span>Central, 13 Nov only</span><div class="rail"><i style="width:7.6%"></i></div><em>11</em></div>
<div class="bar"><span>North, 13 Nov only</span><div class="rail"><i style="width:6.9%"></i></div><em>10</em></div>
</div>
<div class="meter" style="--c:var(--yellow)"><b>Unauthorised banners removed (from Issue 06)</b>
<div class="bar"><span>Central corporation, campaign</span><div class="rail"><i style="width:100%"></i></div><em>273</em></div>
<div class="bar"><span>Chickpet division, of those</span><div class="rail"><i style="width:30%"></i></div><em>82</em></div>
</div>
<div class="meter" style="--c:var(--blue)"><b>Debris cleared, tonnes (counts from Issue 05)</b>
<div class="bar"><span>North, first week to 7 Nov</span><div class="rail"><i style="width:100%"></i></div><em>797</em></div>
<div class="bar"><span>Central, 13 Nov only</span><div class="rail"><i style="width:10.5%"></i></div><em>83.5</em></div>
</div>
<div class="note">
<span>A minister's review set the next Ward One round for 21 November; we found no tally from it, and no new count of potholes, banners or debris this week.</span>
<span class="src">Deccan Chronicle (Central, banners; jetting machines) · The Bengaluru Live (North, 7 Nov and 13 Nov; Central, 13 Nov)</span>
</div>
</div><div class="folio"><span>Ward tracker</span><span>07</span></div></div>`),
    page("08-two-reports", "Two Reports", `<div class="page two"><div class="pin">
<div class="band"><img class="photo" src="%photo:blr-viaduct%" alt="Traffic under the Namma Metro viaduct near Jayadeva Hospital"><span class="cap">Illustration only: traffic under the metro viaduct at Jayadeva Hospital · Gpkp, CC BY-SA 4.0</span></div>
<h3 class="hd">The city vote: December, or January?</h3>
<div class="claim">
<p class="what"><b>When must the five corporations vote?</b> The Supreme Court set 31 December 2026 on 17 July, and warned against asking again. The State Election Commission has since asked it for one more month.</p>
<div class="vs">
<div class="side"><strong>31 Dec 2026</strong><span>the Court's deadline · Siasat, Free Press Journal</span></div>
<span class="or">or</span>
<div class="side"><strong>31 Jan 2027</strong><span>the Commission's request · Siasat, The Hans India</span></div>
</div>
<p class="what">These are an order and a request, not two accounts of one fact. We found no report that the Court has ruled on the request, and could not date when it was filed.</p>
</div>
<div class="claim">
<p class="what"><b>Which voter list?</b> The Court tied the December date to the revision of Karnataka's electoral rolls. The Commission wants to use the roll of 18 April, which already exists.</p>
<div class="vs">
<div class="side"><strong>Wait for the revision</strong><span>the Court's reason · Verdictum, Lawbeat</span></div>
<span class="or">or</span>
<div class="side"><strong>Use the April roll</strong><span>the Commission's plan · Siasat</span></div>
</div>
</div>
<p class="rule-note">We print both and say who said what. Page 11 tells how the date got here.</p>
</div><div class="folio"><span>Two readings</span><span>08</span></div></div>`),
    page("09-line", "The Line", `<div class="page line-pg"><div class="pin">
<span class="lbl c" style="--c:var(--pink)">On the line</span>
<h3 class="hd">Six stations, 7.5 km, two weeks in</h3>
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
<p>Swarajya puts average weekday ridership across the network at about 9.16 lakh, and expects it to pass 10 lakh once the Pink Line opens. That is a network figure, not the Pink Line's. Two weeks on, we found no Pink Line weekday count, fare or last train, so none is printed.</p>
</div>
<p class="src">Deccan Herald · IBTimes India · OneIndia · newskarnataka · Swarajya</p>
</div><div class="folio"><span>On the line</span><span>09</span></div></div>`),
    page("10-questions", "Questions & Answers", `<div class="page qa"><div class="pin">
<span class="lbl c" style="--c:var(--pink)">Rider questions</span>
<h3 class="hd">Six questions, one still open</h3>
<div class="list">
<div class="item" style="--c:var(--pink)"><span class="q">1</span><div><b>Is it open?</b><p>Yes. Public service began on Saturday 14 November, a day after the inauguration. The first weekday was Monday 16 November.</p><span class="who">Deccan Herald · The Week (PTI)</span></div></div>
<div class="item" style="--c:var(--purple)"><span class="q">2</span><div><b>Where does it go?</b><p>Six elevated stations over 7.5 km: Kalena Agrahara, Hulimavu, IIM-B, JP Nagar 4th Phase, Jayadeva Hospital and Tavarekere (also called Suddagunte Palya).</p><span class="who">Construction World · IBTimes India</span></div></div>
<div class="item" style="--c:var(--green)"><span class="q">3</span><div><b>How often do trains run?</b><p>Every 8 minutes at weekday peak and every 10 off-peak. The first train on Monday left Kalena Agrahara at 4:55 am.</p><span class="who">OneIndia · IBTimes India</span></div></div>
<div class="item" style="--c:var(--yellow)"><span class="q">4</span><div><b>How many people rode?</b><p>33,409 on the first day, as reported. A BMRCL official expects the pattern to steady toward the end of November. Two weeks in, we found no weekday figure.</p><span class="who">newskarnataka · Inshorts</span></div></div>
<div class="item" style="--c:var(--blue)"><span class="q">5</span><div><b>What will it cost?</b><p>A Goodreturns explainer lists the fare in its headline, but we read only the headline, so no fare is printed. Check BMRCL's notices before you travel.</p><span class="who">Goodreturns, headline only</span></div></div>
<div class="item" style="--c:var(--pink)"><span class="q">6</span><div><b>Can I change to another line?</b><p>Yes, at Jayadeva Hospital, a multi-tier station where the Pink Line meets the Yellow Line towards Electronic City.</p><span class="who">OneIndia · Swarajya</span></div></div>
</div>
</div><div class="folio"><span>Rider questions</span><span>10</span></div></div>`),
    page("11-longread", "Long Read", `<div class="page longread"><div class="pin">
<span class="lbl c" style="--c:var(--yellow)">The long read</span>
<h3 class="hd">Why the city's vote keeps moving</h3>
<p class="stand">Five city corporations were meant to elect their councils by mid-2026. The date is now a Supreme Court deadline and a request to move it.</p>
<div class="rd">
<div class="txt">
<p>The Greater Bengaluru Authority replaced the BBMP in September 2025, and the city's civic body became five corporations. Councils for them have not been elected, so the Supreme Court has been setting the date.</p>
<h5>Three dates</h5>
<p>In January the Court asked for the polls by 30 June. In May it moved the date to 31 August, refusing the state's request for September and calling it the last extension. On 17 July it moved it again, to 31 December, citing the revision of Karnataka's electoral rolls. The Chief Justice warned it would hear no more excuses after that.</p>
<p class="pull">Two extensions, and a third asked for.</p>
<h5>The new request</h5>
<p>The State Election Commission has asked for one more month, to 31 January 2027, and for leave to use the roll of 18 April rather than wait for the revision, Siasat reports. We found no report of a ruling.</p>
<h5>What stays open</h5>
<p>The Hans India's headline says the polls face further delay; we read the headline only. Until the Court rules, the date on page 08 is the order, not the plan.</p>
</div>
<div class="rail">
<span class="lbl">The dates</span>
<div><em>Jan 2026</em><span>The Court asks for polls by 30 June</span></div>
<div><em>May 2026</em><span>Moved to 31 August, called the last extension</span></div>
<div><em>17 Jul 2026</em><span>Moved to 31 December</span></div>
<div><em>Undated</em><span>The Commission asks for 31 January 2027</span></div>
</div>
</div>
<p class="src">Siasat · Free Press Journal · The South First · Verdictum · Lawbeat · The Hans India (headline) · Deccan Herald (the GBA's start)</p>
</div><div class="folio"><span>The long read</span><span>11</span></div></div>`),
    page("12-ledger", "Ledger Table", `<div class="page ledger-pg"><div class="pin">
<span class="lbl c" style="--c:var(--blue)">The ledger</span>
<h3 class="hd">A quiet week for rounds</h3>
<table>
<thead><tr><th scope="col">Company</th><th scope="col">What happened</th><th scope="col">Amount</th></tr></thead>
<tbody>
<tr><td class="co"><b>Gnani.ai</b><span>Voice AI, Series B</span></td><td>NewsBytes calls it a Bengaluru company and says Aavishkaar Capital led the round. We could not date the report, so we cannot place it in this window.</td><td class="amt">₹68 cr<small>NewsBytes, undated</small></td></tr>
<tr><td class="co"><b>Humyn Labs</b><span>Data for physical AI, Series A</span></td><td>Carried from Issue 06: TechCrunch's headline of 18 November puts the round at $47 million, with Accel backing. We read the headline only.</td><td class="amt">$47M<small>TechCrunch, 18 Nov</small></td></tr>
<tr><td class="co"><b>All of India</b><span>Week to 13 Nov</span></td><td>Indian startups raised $25.2 million in the week, down 90.1% on the week before, Inc42 reports. A national figure, not a Bengaluru one.</td><td class="amt">$25.2M<small>Inc42, Nov 2026</small></td></tr>
<tr><td class="co"><b>Bengaluru</b><span>Jan to Sep 2026</span></td><td>The city drew about $4.4 billion in startup funding in the first nine months of the year, as the Economic Times reported and Digg relayed. Kept as the running total.</td><td class="amt">$4.4B<small>Economic Times, via Digg</small></td></tr>
</tbody>
</table>
<p class="foot">We found no Bengaluru round we could confirm and date between 23 and 25 November. PlatinumRx's reported talks to raise about $32 million are not printed: a round in talks is not a round closed.</p>
</div><div class="folio"><span>The ledger</span><span>12</span></div></div>`),
    page("13-scoreboard", "Scoreboard", `<div class="page score"><div class="pin">
<div class="ph"><img class="photo" src="%photo:blr-chinnaswamy%" alt="M. Chinnaswamy Stadium from the stands"><span class="cap">The Chinnaswamy, home ground of RCB; Bengaluru FC play at the Kanteerava · Visdaviva, CC BY-SA 3.0</span></div>
<span class="lbl c" style="--c:var(--yellow)">Field &amp; ground</span>
<h3 class="hd">Top of the table, away next</h3>
<div class="card">
<div class="top"><span>Indian Super League</span><span>Home match</span></div>
<div class="rows">
<div class="row"><span>Result</span><span>Bengaluru FC 2–0 Mumbai City FC</span></div>
<div class="row"><span>Ground</span><span>Sree Kanteerava Stadium, Fri 20 Nov</span></div>
<div class="row"><span>Goals</span><span>Borja Martínez, penalty, 57'; Ryan Williams, 85' (IANS)</span></div>
<div class="row"><span>The table</span><span>13 points from five games, top, one clear of Mohun Bagan (ESPN India)</span></div>
</div>
</div>
<div class="card">
<div class="top"><span>This season</span><span>Bengaluru FC</span></div>
<div class="rows">
<div class="row"><span>10 Oct</span><span>Won 3–2 v SC Delhi</span></div>
<div class="row"><span>30 Oct</span><span>Drew 1–1 v NorthEast United</span></div>
<div class="row"><span>6 Nov</span><span>Won 2–1 at FC Goa, in stoppage time</span></div>
<div class="row"><span>Next</span><span>Away at Odisha FC on Fri 4 December, The Morning Voice says</span></div>
</div>
</div>
<p class="src">IANS · Khel Now · myKhel · ESPN India · The Morning Voice · Fotmob</p>
</div><div class="folio"><span>Field &amp; ground</span><span>13</span></div></div>`),
    page("14-week-ahead", "Week Ahead", `<div class="page week"><div class="pin">
<span class="lbl c" style="--c:var(--purple)">The week ahead</span>
<h3 class="hd">Indusfood, a concert, then Jatre</h3>
<div class="days">
<div class="day"><span class="dn">Thu</span><span class="dd">26</span><span class="ev" style="--c:var(--green)">Indusfood, day two</span></div>
<div class="day"><span class="dn">Fri</span><span class="dd">27</span><span class="ev" style="--c:var(--green)">Indusfood, last day</span></div>
<div class="day"><span class="dn">Sat</span><span class="dd">28</span><span class="ev" style="--c:var(--muted)">Nothing verified</span></div>
<div class="day"><span class="dn">Sun</span><span class="dd">29</span><span class="ev" style="--c:var(--pink)">Diljit Dosanjh, NICE Grounds</span><span class="ev" style="--c:var(--purple)">Reader's page deadline</span></div>
<div class="day"><span class="dn">Mon</span><span class="dd">30</span><span class="ev" style="--c:var(--purple)">Next edition</span></div>
<div class="day"><span class="dn">Tue</span><span class="dd">1</span><span class="ev" style="--c:var(--muted)">Nothing verified</span></div>
<div class="day"><span class="dn">Wed</span><span class="dd">2</span><span class="ev" style="--c:var(--muted)">Nothing verified</span></div>
</div>
<div class="later">
<div><em>Fri 27 Nov</em><span><b>Indusfood, last day</b>From 9 am at the BIEC on Tumkur Road, organised by the Trade Promotion Council of India, per the show's own site and Expomap</span></div>
<div><em>Sun 29 Nov</em><span><b>Diljit Dosanjh, AURA India tour</b>At NICE Grounds, Madavara, partly seated per BookMyShow. One aggregator gives a 4 pm start; prices differ by listing, so confirm</span></div>
<div><em>Fri 4 Dec</em><span><b>Bengaluru FC at Odisha FC</b>An away fixture in the ISL, per The Morning Voice. The same day, Bengaluru Jatre opens and runs to 13 December</span></div>
<div><em>Sat 5 Dec</em><span><b>Bengaluru Midnight Marathon</b>Listed as the 19th edition by running-calendar sites; confirm the start and route with the organisers</span></div>
<div><em>By 31 Dec</em><span><b>The city corporation elections</b>The Supreme Court's current deadline; the Election Commission has asked for 31 January 2027</span></div>
</div>
<p class="src">Indusfood Bengaluru · Expomap · BookMyShow · NewsX · The South First · The Morning Voice · Finishers · Siasat</p>
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
<div><b>Send yours</b><span>About 300 words and up to three photographs you took, with your name and neighbourhood. In by Sunday 29 November for Issue 08.</span></div>
<div><b>Before it prints</b><span>The desk checks names, places, dates and figures, and shows you the page first. Your words and your photographs stay yours.</span></div>
</div>
</div><div class="folio"><span>Reader's page</span><span>15</span></div></div>`),
    page("16-credits", "Sources & Credits", `<div class="page credits"><div class="pin">
<span class="lbl">Sources &amp; credits</span>
<h3 class="hd">Where this came from</h3>
<div class="cols">
<div><b>p. 03 · By the numbers</b>Siasat; The South First; The Hans India (headline); Goodreturns and Asianet Newsable (outages); ESPN India and IANS (BFC); newskarnataka and Deccan Herald (Pink Line); Inc42 (week to 13 Nov)</div>
<div><b>p. 04 · The festival</b>The South First; The Hans India (venues; the JDS headline); Deccan Herald (headline, 200 venues); newskarnataka, 12 Oct; Asianet Newsable (₹15 to 20 crore), carried from Issue 06</div>
<div><b>p. 05 · Then and now</b>Khel Now (preview, 19 Nov); IANS (goals; Mumbai City's coach); ESPN India (the table); myKhel</div>
<div><b>p. 06 · City desk</b>newskarnataka and Swarajya (Pink Line); Goodreturns and Asianet Newsable (BESCOM outages, 23 and 24 Nov); Deccan Chronicle and The Hans India (jetting machines); Indusfood Bengaluru site and Expomap</div>
<div><b>p. 07 · Ward tracker</b>Deccan Chronicle (Central banners; jetting machines); The Bengaluru Live (North, 7 Nov and 13 Nov; Central, 13 Nov), carried from Issues 05 and 06</div>
<div><b>p. 08 and 11 · The city vote</b>Siasat; Free Press Journal; The South First; Verdictum; Lawbeat; The Hans India (headline); Deccan Herald (the GBA's start, 2025)</div>
<div><b>p. 09–10 · The line</b>IBTimes India (cost, first train); OneIndia (timetable); Deccan Herald; The Week (PTI); Construction World; Inshorts; newskarnataka; Swarajya; Goodreturns (headline)</div>
<div><b>p. 12 · The ledger</b>NewsBytes (Gnani.ai); TechCrunch, 18 Nov (headline only); Inc42; Economic Times, relayed by Digg</div>
<div><b>p. 13 · Field &amp; ground</b>IANS; Khel Now; myKhel; ESPN India; The Morning Voice; Fotmob</div>
<div><b>p. 14 · The week ahead</b>Indusfood Bengaluru; Expomap; BookMyShow; NewsX; The South First; The Morning Voice; Finishers; Siasat</div>
<div><b>Photographs</b>Wikimedia Commons. p. 01 Vidhana Soudha: Sai23ganesh (CC BY-SA 4.0). p. 04 Town Hall: Harvinder Chandigarh (CC BY 4.0). p. 06 KR Market station: Gpkp (CC BY-SA 4.0). p. 08 Jayadeva viaduct: Gpkp (CC BY-SA 4.0). p. 13 Chinnaswamy: Visdaviva (CC BY-SA 3.0). p. 15 sample, Pink Line map: Mallikarjunasj (CC BY-SA 3.0).</div>
</div>
<div class="made">
<span><b>How this was made.</b> Gathered through a news search and checked against at least one report for each item; most reports were read as headlines and summaries only. Summarised in our own words; no article text or press photographs were reused.</span>
<span>Atlas Bengaluru · a sample city edition · Week 48, 2026</span>
</div>
</div><div class="folio"><span>Colophon</span><span>16</span></div></div>`),
  ],
};
