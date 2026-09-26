# 0004 — Display type steps down; the fitter is not asked to measure it

Date: 2026-09-26
Status: accepted
Stories: 1, 2, 4

## Context

`src/lib/magazine/fit.ts` is the heart of the engine and the invariant the engine
is built on: the fitter and the renderer share page geometry, markup and type
overrides, because if they ever disagreed a page would silently overflow. It
works by binary-searching a **word count** of the story against real type
rendered in an off-screen node, and it returns a `Slice` plus the cursor the next
box starts from. Every box downstream depends on where this one stopped.

The reader's masthead is now printed in three places — the cover lockup, the
contents head, and the modernist large running foot — and it must step down in
size rather than wrap or clip. The question is whether that measurement belongs
in `fit.ts`.

## Decision

It does not, and the reason is structural rather than a matter of convenience.

The three pages a masthead is printed on carry **no fitted copy at all**:
`templates.ts:152` `cover: { plates: 1, boxes: [] }`, `:153`
`contents: { plates: 0, boxes: [] }`, `:210` `colophon: { boxes: [] }`. The
composer never asks the fitter for a box on any of them, so a masthead cannot
push copy off a page, cannot change where a line breaks in the story, and cannot
move a cursor. There is nothing for the fitter and the renderer to disagree
*about*. The running foot is drawn inside the `FOLIO = 22` strip
(`geometry.ts:17`), which is reserved out of `TEXT_HEIGHT` before any box is
measured — the fitter has already been told that space is not its.

Teaching `fit.ts` to measure a display line would mean giving the measuring node
a second dress code (it wears `CopyStyle`, plus `--display-font` for the drop cap
alone, and every key is rewritten on every call precisely so a previous theme
cannot leak in) and a second return shape, in order to answer a question that
pours nothing. The repo already has the right precedent for display type:
`quoteSize` (`src/components/magazine/pages.tsx:1231`) steps a pull quote down
until it fits, with a comment saying exactly why measuring is unnecessary there —
"nothing is poured after it, so nothing downstream depends on its exact wrap."
A masthead is in that class.

So: a **size step-down in the renderer**, in one shared module
(`src/lib/magazine/imprint.ts`), used by all three printed places.

Where it improves on `quoteSize`: a masthead is the most conspicuous line in the
product, and `quoteSize`'s half-an-em-per-character estimate is too crude for it —
28 characters of Devanagari and 28 characters of a condensed grotesque are not the
same width. The helper therefore takes a **real advance width from a canvas**
(`CanvasRenderingContext2D.measureText`) in the face the leaf actually declares,
read off `SurfaceContext`, which `MagazinePage` already provides and `QuoteBlock`
and `SketchPad` already consume. `measureText` is synchronous, needs no node in
the document, forces no layout, and is memoised per (text, face, weight, tracking,
width, ladder). Letter-spacing is added arithmetically because `ctx.letterSpacing`
is Chromium-only and Atlas has to measure the same in Safari and Firefox.

### Why this cannot put the fitter and the renderer out of agreement

The decision is taken once, during React render, and emitted as an explicit
`fontSize` in a style attribute. Every downstream renderer is handed the answer
rather than the question: the on-screen proof, the `display:none` print sheet, the
carousel slide and the PDF all draw the same number. `modern-screenshot` clones
the leaf into an SVG `foreignObject` and lets the browser lay it out
(`press.ts:38–49`), so the same CSS produces the same drawing in all four — which
is also why `overflow: hidden` plus `text-overflow: ellipsis` is a safe backstop
here where it would not be under a second renderer.

And the backstop matters: **CSS caps the box, the measurement only chooses a size
inside it.** Every masthead gets an explicit `maxWidth` with `overflow: hidden`,
the elements it shares a line with get `shrink-0`, and the row gets
`flex-nowrap`. If the canvas is unavailable, if a face is substituted, if a
`DeskDraft` restored from an older build carries a longer name than the current
cap allows — the worst outcome is an ellipsis, never an overflow, never a wrap,
and never a displaced folio numeral.

Fonts: the display faces are system stacks by invariant (no webfonts beyond the
one self-hosted face), so they are available at first paint. The one self-hosted
face is the fallback in `HEADLINE`, and `sendToPress` already awaits
`document.fonts.ready` before composing (`Create.tsx:803`) as `pressPdf` and
`pressSlides` do before drawing. Those awaits are what make a measurement taken
at render time safe; a masthead measured against a swap fallback would be sized
for a face it is not drawn in.

## Consequences

- There are now two measuring strategies in the engine, and the boundary between
  them has to stay stated: **the fitter measures anything the story is poured
  through; a step-down sizes anything that pours nothing.** A future headline that
  sits *inside* a measured box — as the drop cap does — belongs to the fitter, not
  here.
- `Opener` and `FourColumn` clamp their headlines with `line-clamp`
  (`pages.tsx:683`, `:1152`) against a fixed `OPENER_HEAD` precisely so a long
  title cannot push copy off the page. Those stay as they are: they *are* inside
  the measured geometry, and a step-down there would change what the fitter was
  given. This record does not license changing them.
- The helper is a client-side measurement, so it is one more thing that behaves
  differently in a headless render. There is no server render of a page, so this
  costs nothing today; it is why the no-canvas path returns the largest size and
  leans on the CSS cap.
