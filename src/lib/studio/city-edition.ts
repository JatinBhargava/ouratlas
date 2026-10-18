/**
 * The City Edition: twelve pages for a weekly issue about one city, set with a
 * sample week of Bengaluru news (12–19 October 2026).
 *
 * Written here rather than drawn on the design canvas, so it is not in
 * `pages.json` (which only `scripts/studio.ts` writes). `loadStudio` adds it to
 * the shelves after the canvas's own sections, in the same lazy chunk.
 *
 * The other complete issues tell one story; a city edition carries many short
 * ones, so its pages are built for that: a front page with teasers, contents by
 * section, big figures, briefs, two outlets disagreeing side by side, a transit
 * route, a funding table, scorecards, a week of dates, a reader's page and a
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
.stop { position: relative; display: grid; grid-template-columns: 7cqw minmax(0, 1fr) auto; gap: 2.2cqw; align-items: center; padding: 1.55cqw 0; }
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

/* 08 Ledger Table */
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

/* 09 Scoreboard */
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

/* 10 Week Ahead */
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

/* 11 Reader's Page */
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

/* 12 Sources & Credits */
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
  blurb: "A week in one city on twelve pages: front page, contents by section, the numbers, briefs, two reports side by side, the metro line, the ledger, the scoreboard and the week ahead",
  pages: [
    page("01-front", "City Front", `<div class="page front"><div class="pin">
<div class="mast"><h3 class="hd">Atlas <i>Bengaluru</i></h3><div class="date">Week 42<br>12–19 Oct 2026<br>Issue 01</div></div>
<div class="lines" aria-hidden="true"><i style="background:var(--purple)"></i><i style="background:var(--green)"></i><i style="background:var(--yellow)"></i><i style="background:var(--pink)"></i><i style="background:var(--blue)"></i></div>
<div class="hero"><img class="photo" src="%photo:blr-puja%" alt="Durga idol with garlands and oil lamps at a Bengaluru pandal"><span class="cap">Durga Puja at Bongodhara · Pallab2310, CC BY-SA 4.0</span></div>
<div class="lead">
<h4 class="hd">The week the city tried to leave for Dasara</h4>
<p>Three days of rain, a washed-out decider, a protest at Town Hall and the festival exodus, all in forty-eight hours.</p>
</div>
<div class="teasers">
<div style="--c:var(--pink)"><b>Two papers, two numbers</b><span>p. 06</span></div>
<div style="--c:var(--pink)"><b>A heart crosses town in 18 minutes</b><span>p. 07</span></div>
<div style="--c:var(--yellow)"><b>Rain has the last word at the Chinnaswamy</b><span>p. 09</span></div>
</div>
</div><div class="folio"><span>Atlas Bengaluru</span><span>01</span></div></div>`),
    page("02-index", "Section Index", `<div class="page index"><div class="pin">
<span class="lbl">In this issue</span>
<div class="route">
<div class="stop" style="--c:var(--purple)"><span class="dot">03</span><div><b>By the numbers</b><span>The week in six figures</span></div><span class="pg">p. 03</span></div>
<div class="stop" style="--c:var(--purple)"><span class="dot">04</span><div><b>The long way out</b><span>Dasara traffic, fares and the rain</span></div><span class="pg">p. 04</span></div>
<div class="stop" style="--c:var(--green)"><span class="dot">05</span><div><b>City desk</b><span>Lingarajapuram, the master plan, Bannerghatta Road</span></div><span class="pg">p. 05</span></div>
<div class="stop" style="--c:var(--pink)"><span class="dot">06</span><div><b>Two reports</b><span>Town Hall and NICE Road, as the papers told it</span></div><span class="pg">p. 06</span></div>
<div class="stop" style="--c:var(--pink)"><span class="dot">07</span><div><b>On the line</b><span>Pink Line, a heart, and what's next</span></div><span class="pg">p. 07</span></div>
<div class="stop" style="--c:var(--blue)"><span class="dot">08</span><div><b>The ledger</b><span>Bengaluru companies and their money</span></div><span class="pg">p. 08</span></div>
<div class="stop" style="--c:var(--yellow)"><span class="dot">09</span><div><b>Field &amp; ground</b><span>Cricket and football</span></div><span class="pg">p. 09</span></div>
<div class="stop" style="--c:var(--purple)"><span class="dot">10</span><div><b>The week ahead</b><span>Puja, Vijayadashami and later</span></div><span class="pg">p. 10</span></div>
<div class="stop" style="--c:var(--purple)"><span class="dot">11</span><div><b>Reader's page</b><span>Your Bengaluru, in your words</span></div><span class="pg">p. 11</span></div>
</div>
<div class="how"><span>Every item ends with its source. <span class="flag">2 reports</span> marks a figure the papers disagree on.</span></div>
</div><div class="folio"><span>Contents</span><span>02</span></div></div>`),
    page("03-numbers", "By the Numbers", `<div class="page numbers"><div class="pin">
<span class="lbl">By the numbers</span>
<h3 class="hd" style="font-size:7.4cqw">The week, counted</h3>
<div class="grid">
<div class="n" style="--c:var(--purple)"><strong>6 hrs</strong><p>The longest reported wait to get out of the city on Friday night.</p><span class="src">Deccan Herald, 17 Oct</span></div>
<div class="n" style="--c:var(--purple)"><strong>~70%</strong><p>Rise in Bengaluru–Kolkata airfares in Puja week, residents said.</p><span class="src">Deccan Herald, 17 Oct</span></div>
<div class="n" style="--c:var(--green)"><strong>₹400</strong><p>An MG Road–RT Nagar auto in Thursday's rain. The usual fare is ₹160–200.</p><span class="src">Deccan Herald, 16 Oct</span></div>
<div class="n" style="--c:var(--pink)"><strong>36</strong><p>Safety observations on the elevated Pink Line, answered in a week.</p><span class="src">Deccan Herald, 15–16 Oct</span></div>
<div class="n" style="--c:var(--pink)"><strong>18 min</strong><p>Goraguntepalya to Sampige Road, carrying a donor heart.</p><span class="src">New Indian Express, 15 Oct</span></div>
<div class="n" style="--c:var(--yellow)"><strong>7.4</strong><p>Overs India batted before rain ended the series decider.</p><span class="src">Cricbuzz, 18 Oct</span></div>
</div>
</div><div class="folio"><span>By the numbers</span><span>03</span></div></div>`),
    page("04-lead", "Broadsheet Lead", `<div class="page lead-pg"><div class="pin">
<span class="lbl c" style="--c:var(--purple)">The long way out</span>
<h3 class="hd">Six hours to leave the city</h3>
<p class="stand">Dasara, Ayudha Puja and a weekend arrived together, and so did everyone heading home.</p>
<div class="body">
<div class="ph"><img class="photo" src="%photo:blr-viaduct%" alt="Traffic under the Namma Metro viaduct near Jayadeva Hospital"><span class="cap">Under the viaduct at Jayadeva · Gpkp, CC BY-SA 4.0</span></div>
<div class="col c1">
<p>The exodus began on Friday night and did not end until the small hours of Saturday. Mysuru Road, Tumakuru Road, the airport road and Hosur Road all jammed, worst around Goraguntepalya, the Yeshwanthpur flyover, the ISKCON stretch and Rajkumar Road.</p>
<p>Private buses stood in lines that ran for kilometres. Some only got clear of the city between three and four in the morning.</p>
<p class="pull">Some buses only cleared the city between 3 and 4 am.</p>
</div>
<div class="col c2">
<p>Plenty of people never set off. Residents said fares to Kolkata rose by about 70% in Puja week. A ₹6,000–8,500 ticket was closer to ₹17,000. Bus fares to Mangaluru passed ₹2,000, against a usual ₹500–1,200.</p>
<p>Operators said the money moved to three-day trips: Coorg, Mysuru, Chikkamagaluru, Ooty, Wayanad.</p>
</div>
<div class="col c3">
<p>On Thursday an hour of rain flooded Majestic, KR Market, Malleswaram and Basavanagudi, and the Hosur highway near Chandapura. Ride-hailing fares jumped more than 70% at peak hour.</p>
<p>Sunday was clear. The slush stayed.</p>
<p class="src">Deccan Herald 16–17 Oct · The Hindu 18 Oct · Times of India 19 Oct</p>
</div>
</div>
</div><div class="folio"><span>Feature</span><span>04</span></div></div>`),
    page("05-briefs", "Desk Briefs", `<div class="page briefs-pg"><div class="pin">
<span class="lbl c" style="--c:var(--green)">City desk</span>
<h3 class="hd">Around town</h3>
<div class="grid">
<div class="brief"><span class="where">Lingarajapuram</span><b>A drain dig with a month to run</b><p>A 400-metre drain rebuild towards the Hennur flyover has cut shops off from the street. One juice seller's takings have halved, from about ₹10,000 a day. Residents say about ten century-old trees were felled. A tyre dealer has nowhere left to fit tyres, and the official in charge says the work needs another month.</p><span class="src">Deccan Herald, 18 Oct</span></div>
<div class="brief"><span class="where">Citywide</span><b>The master plan's missing roads</b><p>Twenty years on, 85% of the roads in the Comprehensive Development Plan have not been built, while apartment blocks in Balagere, Panathur and Kogilu were approved without them. Deccan Herald traces the gridlock in the tech corridors to approvals that ran ahead of the roads.</p><span class="src">Deccan Herald, 18 Oct</span></div>
<div class="brief"><span class="where">Bannerghatta Road</span><b>Junctions and footpaths, on paper first</b><p>The Greater Bengaluru Authority has asked for a detailed project report on junction and footpath fixes from Gottigere to Tavarekere. It is the same road the elevated Pink Line runs along, which is waiting for its opening date.</p><span class="src">NewsFirst Prime, 15 Oct</span></div>
<div class="brief"><span class="where">Central business district</span><b>An hour of rain, and no autos</b><p>Thursday's downpour flooded Majestic, Town Hall, KR Market and Corporation Circle. Autos refused rides and app fares nearly doubled at peak hour.</p><div class="shot"><img class="photo" src="%photo:blr-kr-market%" alt="Krishna Rajendra Market metro station entrance"><span class="cap">KR Market station · Gpkp, CC BY-SA 4.0</span></div><span class="src">Deccan Herald, 16 Oct</span></div>
</div>
</div><div class="folio"><span>City desk</span><span>05</span></div></div>`),
    page("06-two-reports", "Two Reports", `<div class="page two"><div class="pin">
<div class="band"><img class="photo" src="%photo:blr-town-hall%" alt="Sir Puttanna Chetty Town Hall, Bengaluru"><span class="cap">Town Hall · Harvinder Chandigarh, CC BY 4.0</span></div>
<h3 class="hd">Two papers, two numbers</h3>
<div class="claim">
<p class="what"><b>Town Hall, Saturday.</b> Protesters against the revision of the electoral rolls were detained and released about an hour later. Police said permission had been refused, citing court directions.</p>
<div class="vs">
<div class="side"><strong>75–80</strong><span>detained · New Indian Express</span></div>
<span class="or">or</span>
<div class="side"><strong>50</strong><span>detained · The News Minute</span></div>
</div>
</div>
<div class="claim">
<p class="what"><b>NICE Road, Sunday.</b> A tanker caught fire. Seven fire tenders, a five-kilometre queue, and the driver got out safely.</p>
<div class="vs">
<div class="side"><strong>Chemical</strong><span>tanker · Times of India</span></div>
<span class="or">or</span>
<div class="side"><strong>Diesel</strong><span>tanker · NDTV</span></div>
</div>
</div>
<p class="rule-note">When reports disagree, we print both and name who said what. We don't pick one quietly.</p>
</div><div class="folio"><span>Two reports</span><span>06</span></div></div>`),
    page("07-line", "The Line", `<div class="page line-pg"><div class="pin">
<span class="lbl c" style="--c:var(--pink)">On the line</span>
<h3 class="hd">The Pink Line's last exam</h3>
<svg viewBox="0 0 400 74" role="img" aria-label="The elevated Pink Line: six stations from Kalena Agrahara to Tavarekere, 7.5 km">
<line x1="14" y1="30" x2="386" y2="30" stroke="#cf437d" stroke-width="7" stroke-linecap="round"/>
<g fill="#fdfdfc" stroke="#cf437d" stroke-width="3.5">
<circle cx="14" cy="30" r="8"/><circle cx="88.4" cy="30" r="6"/><circle cx="162.8" cy="30" r="6"/><circle cx="237.2" cy="30" r="6"/><circle cx="311.6" cy="30" r="6"/><circle cx="386" cy="30" r="8"/>
</g>
<text x="6" y="58" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="11" font-weight="600" fill="#1b191e">Kalena Agrahara</text>
<text x="394" y="58" text-anchor="end" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="11" font-weight="600" fill="#1b191e">Tavarekere</text>
<text x="200" y="12" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="8.5" fill="#6b6672">7.5 KM · 6 STATIONS · EVERY 6 MIN AT PEAK</text>
</svg>
<div class="steps">
<div><em>6–8 Oct</em><span>Safety commissioner inspects</span></div>
<div><em>9 Oct</em><span>36 observations sent</span></div>
<div><em>15 Oct</em><span>BMRCL files its answers</span></div>
<div class="next"><em>Next</em><span>Approval, and an opening date</span></div>
</div>
<div class="blk">
<b>A heart crosses the city</b>
<svg viewBox="0 0 400 46" role="img" aria-label="Goraguntepalya 2:22 pm to Mantri Square Sampige Road 2:40 pm, 18 minutes">
<line x1="12" y1="18" x2="388" y2="18" stroke="#23884a" stroke-width="6" stroke-linecap="round"/>
<circle cx="12" cy="18" r="7" fill="#fdfdfc" stroke="#23884a" stroke-width="3.5"/><circle cx="388" cy="18" r="7" fill="#fdfdfc" stroke="#23884a" stroke-width="3.5"/>
<rect x="172" y="8" width="56" height="20" rx="10" fill="#1b191e"/><text x="200" y="22" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="10" fill="#fdfdfc">18 MIN</text>
<text x="4" y="42" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="10" fill="#1b191e">Goraguntepalya · 2:22 pm</text>
<text x="396" y="42" text-anchor="end" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="10" fill="#1b191e">Sampige Road · 2:40 pm</text>
</svg>
<p>From Sparsh Hospital in Yeshwanthpur to Apollo in Seshadripuram, on Wednesday. It is the sixth organ the metro has carried: one liver, three hearts and a pair of lungs.</p>
</div>
<div class="blk">
<b>Further down the line</b>
<div class="ahead">
<div style="--c:var(--pink)"><strong>Nov 2026</strong><span>Trials: underground Pink (Dairy Circle–Nagawara) and Blue Line on ORR</span></div>
<div style="--c:var(--blue)"><strong>May 2027</strong><span>Target opening for both</span></div>
<div style="--c:var(--muted)"><strong>37.8 km</strong><span>Proposed Red Line; soil tests begin on Sarjapur Road</span></div>
</div>
</div>
<div class="fill"><img class="photo" src="%photo:blr-pink-line%" alt="Pink Line route map above the doors inside a metro coach"><span class="cap">The Pink Line map inside a coach · Mallikarjunasj, CC BY-SA 3.0</span></div>
<p class="src">Deccan Herald 15–16 Oct · New Indian Express 15 Oct · Swarajya · The Hindu</p>
</div><div class="folio"><span>On the line</span><span>07</span></div></div>`),
    page("08-ledger", "Ledger Table", `<div class="page ledger-pg"><div class="pin">
<span class="lbl c" style="--c:var(--blue)">The ledger</span>
<h3 class="hd">Who raised, who filed</h3>
<table>
<thead><tr><th scope="col">Company</th><th scope="col">What happened</th><th scope="col">Amount</th></tr></thead>
<tbody>
<tr><td class="co"><b>Scimplify</b><span>Specialty chemicals</span></td><td>Round led by Hitachi Ventures; customers Henkel and Teknor Apex invest. Revenue run rate about $200M, tripled in a year.</td><td class="amt">$25M<small>TechCrunch</small></td></tr>
<tr><td class="co"><b>Mesa School of Business</b><span>Education</span></td><td>Funding to build what it calls an AI-first business school.</td><td class="amt">₹110 cr<small>VCCircle</small></td></tr>
<tr><td class="co"><b>Formial Labs</b><span>Skincare</span></td><td>Pre-seed round led by Zeropearl VC. More than 5,000 custom formulations shipped.</td><td class="amt">₹2.88 cr<small>BW Disrupt</small></td></tr>
<tr><td class="co"><b>Ultrahuman</b><span>Smart rings</span></td><td>Two-year agreement with Abu Dhabi's Public Health Center on a biological-age model. About 800,000 rings sold.</td><td class="amt">Deal<small>TechCrunch</small></td></tr>
<tr><td class="co"><b>Cult.fit</b><span>Fitness</span></td><td>Has received SEBI's observations on its planned IPO, the step before listing.</td><td class="amt">₹950 cr<small>BW Disrupt</small></td></tr>
</tbody>
</table>
<p class="foot">Also in the news but left out until their Bengaluru base is confirmed: RapidCanvas ($29M) and RevRag AI ($2.5M).</p>
</div><div class="folio"><span>The ledger</span><span>08</span></div></div>`),
    page("09-scoreboard", "Scoreboard", `<div class="page score"><div class="pin">
<div class="ph"><img class="photo" src="%photo:blr-chinnaswamy%" alt="M. Chinnaswamy Stadium from the stands"><span class="cap">The Chinnaswamy · Visdaviva, CC BY-SA 3.0</span></div>
<span class="lbl c" style="--c:var(--yellow)">Field &amp; ground</span>
<h3 class="hd">Rain has the last word</h3>
<div class="card">
<div class="top"><span>India v West Indies · 5th T20I</span><span>Sat 17 Oct</span></div>
<div class="rows">
<div class="row"><span>Ground</span><span>M. Chinnaswamy Stadium</span></div>
<div class="row"><span>Overs</span><span>Cut to 9 a side, 9:15 pm start</span></div>
<div class="row"><span>Played</span><span>India 7.4 overs, then rain</span></div>
<div class="row"><span>Series</span><span>Shared 2–2</span></div>
</div>
</div>
<div class="card">
<div class="top"><span>Indian Super League</span><span>In the rain</span></div>
<div class="big"><span>Bengaluru FC</span><span class="sc">2–0</span><span>Chennaiyin FC</span></div>
</div>
<p class="src">Deccan Herald · Cricbuzz · ISL · Rediff · Metro ran trains past 1 am for the crowd (Urban Acres)</p>
</div><div class="folio"><span>Field &amp; ground</span><span>09</span></div></div>`),
    page("10-week-ahead", "Week Ahead", `<div class="page week"><div class="pin">
<span class="lbl c" style="--c:var(--purple)">The week ahead</span>
<h3 class="hd">Puja week, and after</h3>
<div class="days">
<div class="day"><span class="dn">Mon</span><span class="dd">19</span><span class="ev" style="--c:var(--purple)">Durga Puja, KTPO Whitefield</span></div>
<div class="day"><span class="dn">Tue</span><span class="dd">20</span><span class="ev" style="--c:var(--purple)">Vijayadashami</span><span class="ev" style="--c:var(--green)">Expect return traffic</span></div>
<div class="day"><span class="dn">Wed</span><span class="dd">21</span><span class="ev" style="--c:var(--purple)">Last day at KTPO</span></div>
<div class="day"><span class="dn">Thu</span><span class="dd">22</span></div>
<div class="day"><span class="dn">Fri</span><span class="dd">23</span></div>
<div class="day"><span class="dn">Sat</span><span class="dd">24</span></div>
<div class="day"><span class="dn">Sun</span><span class="dd">25</span></div>
</div>
<div class="later">
<div><em>Puja week</em><span><b>A Bengali table at Tamarind, Taj</b>Kosha mangsho, kasundi bhetki, basanti pulao</span></div>
<div><em>30–31 Oct</em><span><b>Halloween at AEIOU Manyata</b>Two nights, Nagawara</span></div>
<div><em>Sun 1 Nov</em><span><b>Steelworks at Sunburn Union</b>Techno, the Bengaluru night of a two-city weekend</span></div>
<div><em>Sat 14 Nov</em><span><b>The Wrong Festival, The Raft</b>Gigs from 6 pm, ₹499</span></div>
</div>
<p class="src">Deccan Herald · IndulgExpress · BW Hotelier · organisers' posts · AllEvents</p>
</div><div class="folio"><span>The week ahead</span><span>10</span></div></div>`),
    page("11-reader", "Reader's Page", `<div class="page reader"><div class="pin">
<div class="top">
<figure class="shot"><img class="photo" src="%photo:blr-vidhana-soudha%" alt="Vidhana Soudha lit up at night"><figcaption class="cap">Your photograph goes here. Sample: Vidhana Soudha at night · Sai23ganesh, CC BY-SA 4.0</figcaption></figure>
<div class="head">
<span class="lbl c" style="--c:var(--purple)">Reader's page</span>
<span><span class="eg">Example</span></span>
<h3 class="hd">Six hours on Tumakuru Road</h3>
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
<div><b>Send yours</b><span>About 300 words and up to three photographs you took, with your name and neighbourhood. In by Thursday 22 October for Week 43.</span></div>
<div><b>Before it prints</b><span>The desk checks names, places, dates and figures, and shows you the page first. Your words and your photographs stay yours.</span></div>
</div>
</div><div class="folio"><span>Reader's page</span><span>11</span></div></div>`),
    page("12-credits", "Sources & Credits", `<div class="page credits"><div class="pin">
<span class="lbl">Sources &amp; credits</span>
<h3 class="hd">Where this came from</h3>
<div class="cols">
<div><b>p. 03–04 · The long way out</b>Deccan Herald, 16 and 17 Oct; The Hindu, 18 Oct; Times of India, 19 Oct</div>
<div><b>p. 05 · City desk</b>Deccan Herald, 16 and 18 Oct; NewsFirst Prime, 15 Oct</div>
<div><b>p. 06 · Two reports</b>New Indian Express and The News Minute, 18 Oct; The Hindu, 19 Oct; Times of India, NDTV, Inshorts and Vartha Bharati, 19 Oct</div>
<div><b>p. 07 · On the line</b>Deccan Herald, 15 and 16 Oct; New Indian Express, 15 Oct; Swarajya; The Hindu</div>
<div><b>p. 08 · The ledger</b>TechCrunch, 12 and 14 Oct; VCCircle; BW Disrupt, 15 and 17 Oct</div>
<div><b>p. 09 · Field &amp; ground</b>Deccan Herald and Cricbuzz, 17–18 Oct; Indian Super League; Rediff; Urban Acres</div>
<div><b>p. 10 · The week ahead</b>Deccan Herald; Curly Tales; IndulgExpress; BW Hotelier; organisers' posts; AllEvents</div>
<div><b>Photographs</b>Wikimedia Commons. Cover: Pallab2310. p. 04 Jayadeva viaduct: Gpkp (CC BY-SA 4.0). p. 06 Town Hall: Harvinder Chandigarh (CC BY 4.0). p. 05 KR Market station: Gpkp (CC BY-SA 4.0). p. 07 Pink Line map: Mallikarjunasj (CC BY-SA 3.0). p. 09 Chinnaswamy: Visdaviva (CC BY-SA 3.0). p. 11 sample, Vidhana Soudha: Sai23ganesh (CC BY-SA 4.0).</div>
</div>
<div class="made">
<span><b>How this was made.</b> Gathered from a free news index and checked against at least one report for each item. Summarised in our own words; no article text or press photographs were reused.</span>
<span>Atlas Bengaluru · a sample city edition · Week 42, 2026</span>
</div>
</div><div class="folio"><span>Colophon</span><span>12</span></div></div>`),
  ],
};
