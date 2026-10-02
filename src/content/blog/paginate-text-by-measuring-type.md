---
title: How to paginate text by measuring type, not guessing
description: How Atlas cuts a long story into magazine columns that never overflow, by binary-searching word counts against real type in the browser.
kind: engineering
date: 2026-10-01
tags: [typography, pagination, web layout]
keyword: paginate text by measuring type
feature: 0.1.0
---

Atlas sets a story of several thousand words into a magazine issue of up to 96 pages, and no column on any of those pages may end with a line hanging off its foot. It gets there by measuring rather than estimating. For every text box on every page, it renders a candidate amount of the story in an invisible node dressed in the same type as the page, reads the height back, and binary-searches the largest word count that fits. This post walks through that fitter, the rules that keep the measurement and the printed page in agreement, and how to build the same thing in your own project. It shipped in the first version of Atlas, 0.1.0, and everything the desk does with text still stands on it.

## The problem: a magazine page has a foot

On the web, text has no bottom. A column grows to hold whatever you put in it, and the page scrolls. A magazine page is the opposite. In Atlas it is 520 by 693 CSS pixels (`src/lib/magazine/geometry.ts`), with a 40px margin on every side, a 22px strip at the foot reserved for the page number, and two columns of 211px with an 18px gutter between them. That leaves 591px of depth for type on a page with no photograph, and less on a page that carries one. When you press an issue on [the desk](/create), your story has to be cut into runs that fill those boxes exactly, one after another.

Every box depends on the one before it. The fitter hands back the place in the story where it stopped, and the next box starts from there. Misjudge one box by a single line and every page after it shifts.

Misjudge it the other way and the result is worse. The column that draws the copy on the page is clipped to the height it was fitted to (`overflow-hidden` on the `Copy` component in `src/components/magazine/pages.tsx`). If the fitter gave a box twelve words when it had room for ten, the last two would be cut off at its foot and never reappear, because the next box starts after them. The comment at the head of `geometry.ts` names the failure plainly: if the fitter and the renderer ever disagreed, "a page would silently overflow".

The fitter's own opening comment states why the obvious shortcut was not taken:

> Guessing from a words-per-column average is close but never exact, and "close" shows up as a line hanging off the bottom of a page.

## Why measure instead of estimate

The repository records three alternatives, and the reasons each fails are the design of what replaced it.

**A words-per-column average.** This is the approach the fitter's comment rejects, and the house style shows why no average can hold. Body copy in Atlas is justified and hyphenated (`hyphens-auto text-justify` in `COPY_CLASS`, `src/lib/magazine/copy.ts`). Where a line breaks depends on the length of each word near its end, on how much the justification can stretch, and on where the browser is willing to hyphenate, which depends on the language and on the hyphenation dictionary that particular browser has ([MDN on `hyphens`](https://developer.mozilla.org/en-US/docs/Web/CSS/hyphens)). Paragraphs add their own error: each one after the first opens with 0.75em of space, and each ends on a short line. Two stories of the same word count, one in short paragraphs and one in long, stand at different depths. An average is right on average, which is the failure the comment describes.

**One render per word.** The straightforward way to measure is to add a word, check the height, and repeat until it overflows. It is correct and slow: a column holds hundreds of words, and an issue has dozens of columns. The fitter's doc comment records the choice it made instead: "Binary search over the word count — about ten renders of a small subtree per box, rather than one per word."

**A separate measuring path for display type.** The fourth architecture decision record (`docs/adr/0004-display-type-steps-down-the-fitter-does-not-measure-it.md`) draws the boundary of the fitter's job. The reader's masthead, which is printed on the cover, the contents and the running foot, is sized by a canvas `measureText` call and a step down in size, not by the fitter, because those pages "carry no fitted copy at all". The record's rule is worth keeping for any project like this: "the fitter measures anything the story is poured through; a step-down sizes anything that pours nothing."

That record also suggests the trade-off for body copy, though the repository does not record it as the reason the fitter was built the way it was. Canvas `measureText` returns the metrics of one string as given ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/measureText)). To use it for a column you would have to break the lines yourself, justify them, and hyphenate them, and then hope your line breaker agreed with the browser that draws the page. Measuring in the DOM asks the browser that will draw the page how it would draw it, so there is no second line breaker to fall out of step.

Measuring in the DOM also means typesetting happens in the browser: the composer's doc comment in `src/lib/magazine/compose.ts` ends "Runs in the browser and touches nothing outside this tab." Atlas's photographs and story text are never stored, and leave the browser only when you ask for one of the opt-in tools, such as the AI editor or the copy desk. Typesetting is not one of them.

## How it works

### One measuring node, dressed like the page

`src/lib/magazine/fit.ts`

```ts
function measurer(): HTMLDivElement {
  if (host?.isConnected) return host;
  host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.className = COPY_CLASS;
  host.style.cssText =
    "position:absolute;left:-10000px;top:0;visibility:hidden;display:flow-root;contain:content;pointer-events:none";
  document.body.appendChild(host);
  return host;
}
```

Every declaration in that style string has a job.

- `visibility:hidden` rather than `display:none`, because a hidden element is not drawn but "still affects layout as normal", while `display:none` takes it out of layout altogether and would report a height of nothing ([MDN on `visibility`](https://developer.mozilla.org/en-US/docs/Web/CSS/visibility)).
- `position:absolute` and `left:-10000px` move it off the page, so it never pushes anything else around.
- `display:flow-root` creates a new block formatting context, which stops the first paragraph's top margin collapsing out of the box ([MDN on margin collapsing](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_box_model/Mastering_margin_collapsing)). The code's comment gives the reason: a collapsed margin "would under-report the height". The drawn column carries `flow-root` too, for the same reason.
- `contain:content` isolates the node's internal layout from the rest of the page ([MDN on `contain`](https://developer.mozilla.org/en-US/docs/Web/CSS/contain)), so filling it again and again does not ask the browser to reconsider anything outside it.

### Binary search over a word count

`src/lib/magazine/fit.ts`

```ts
  const box = measurer();
  box.style.width = `${width}px`;
  wear(box, options.copy, options.display);

  const fits = (count: number) => {
    box.innerHTML = paragraphsHtml(take(paragraphs, cursor, count).slice, options);
    return box.scrollHeight <= height;
  };

  let low = 0;
  let high = Math.min(left, CEILING);

  // The whole remainder fits — the last text page of the issue.
  if (fits(high)) {
    box.innerHTML = "";
    return take(paragraphs, cursor, high);
  }

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(middle)) low = middle;
    else high = middle - 1;
  }

  box.innerHTML = "";
  return take(paragraphs, cursor, low);
```

The story arrives as paragraphs of words, and a position in it is a cursor: `{ paragraph, word }`. `take` cuts a given number of words from the cursor and returns the slice and where the cursor lands. `fits` renders that slice into the measuring node at the box's width and compares `scrollHeight` with the box's height. `scrollHeight` is the right property because it measures the content's full height, "including content not visible on the screen due to overflow", and it is a whole number of pixels ([MDN on `scrollHeight`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight)).

Before searching, it tries everything that is left. On the last text page the whole remainder fits, and one render settles it. Otherwise it searches between nothing and `CEILING`, which is 700 words, a number the comment says is well above what any box holds "even for a full page of small type". `Math.ceil` in the midpoint matters: with `low = middle` on success, a floor would leave the loop stuck when `high` is one more than `low`.

A slice is a list of lines, and each line remembers whether it is the tail of a paragraph begun in the previous box (`continued`). That flag is what keeps the drop cap on a paragraph's real first letter and off the tail of one carried over. Each slice also keeps the cursors it was cut between, which is what lets you type straight into a column on the proof: `spliceStory` in `copy.ts` puts the edited words back exactly where they came from.

### The same markup, byte for byte

The measurement is only worth anything if the page draws exactly what was measured, so one function produces the markup for both. The column on the page draws its slice like this:

`src/components/magazine/pages.tsx`

```tsx
  const { copy, punctuation } = use(SurfaceContext);
  // …
    <div
      className={cn(COPY_CLASS, "flow-root overflow-hidden", writable && "outline-offset-2 focus:outline-2 focus:outline-emerald-600")}
      style={{ width, height, ...copy }}
      // …
      dangerouslySetInnerHTML={{ __html: paragraphsHtml(slice, { dropCap, punctuation }) }}
    />
```

The same `COPY_CLASS`, the same `paragraphsHtml`, the same width. The comment at the top of `copy.ts` gives the rule: "Splitting these into two code paths is how pages start overflowing by a line."

The rule reaches into details that look harmless. One theme lifts full stops and ampersands into the accent colour by wrapping each in a `<span>`. A span that only sets a colour cannot move a line, and the code says so, but the span is still added inside `paragraphsHtml` as an option, not by the renderer afterwards, because the measured markup "has to *be* the same markup".

### Type overrides go to both places

Themes and the reader's own type choice may change the body face, its size, leading, tracking and alignment. Those values (`CopyStyle`) are read by the drawn column from the page's surface, as above, and put on the measuring node here:

`src/lib/magazine/fit.ts`

```ts
function wear(box: HTMLDivElement, style: CopyStyle | undefined, display: string | undefined) {
  for (const key of COPY_STYLE_KEYS) box.style[key] = style?.[key] ?? "";
  if (display) box.style.setProperty("--display-font", display);
  else box.style.removeProperty("--display-font");
}
```

Every key is written on every call, blank where the theme says nothing. The node is long-lived, so without the reset one theme's face would linger into the next theme's measurement.

`--display-font` is there for the drop cap, the one piece of display type that sits inside a measured box and pushes the copy around it. The measuring node lives on `document.body`, outside the page that declares that variable, so without this line the cap would be measured in the house serif and drawn in the theme's face, and the opening paragraph "would wrap a line short or a line long".

### Fonts first, and no fonts that might be missing

`src/pages/Create.tsx`

```ts
      // Copy is fitted by measuring real type. Measuring before the webfont
      // arrives would fit against the fallback and re-wrap once it loads.
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(resolve));
```

`document.fonts.ready` resolves "once the document has completed loading fonts, layout operations are completed, and no further font loads are needed" ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/ready)). Composing before then would measure against a fallback face and draw in the real one.

The other half of this is in `src/lib/magazine/typography.ts`. Atlas serves one face from its own origin, and every other choice is a stack of system fonts with a fallback for macOS, Windows and Linux in turn. The comment explains why that is a pagination rule as much as a style rule: a face missing on one machine "would not merely look different; it would measure differently, and the pages would break in other places".

### Pouring the story through the pages

`src/lib/magazine/compose.ts` walks the layouts in order and asks the fitter to fill each page's boxes from wherever the story has got to:

`src/lib/magazine/compose.ts`

```ts
  const fill = (boxes: { width: number; height: number }[], dropCap = false): { slices: Slice[]; took: number } => {
    const slices: Slice[] = [];
    let took = 0;
    for (const [index, box] of boxes.entries()) {
      const fitted = fitBox(paragraphs, cursor, box.width, box.height, {
        dropCap: dropCap && index === 0,
        copy: copyStyle,
        display: displayFont,
        punctuation: inkedPunctuation,
      });
      slices.push(fitted.slice);
      cursor = fitted.next;
      took += fitted.taken;
    }
    return { slices, took };
  };
```

The plate on an illustrated page is sized before the copy is poured, because the plate decides how much room the columns have. That is why a reader can drag a plate's edge on the proof to make the photograph larger: the page keeps its new plate, holds less copy, and every page after it re-flows, while the pages before it stay put. The composer stops at 96 pages, and breaks out if a layout ever takes neither copy nor a photograph, so a page with no room for a word cannot repeat forever.

Once you can measure, you can search on other axes too. When the story ends on a designed page (one of the reader's own layouts, or one the AI editor planned) that carries a photograph and boxes sized for a full page of text, the composer finds the shallowest depth of columns that still holds the last words, by the same halving, and gives the rest of the page to the photograph. A page redrawn by hand on the proof is left as drawn.

`src/lib/magazine/compose.ts`

```ts
    const shallowest = (shape: keyof typeof shapes): number | null => {
      let low = 12;
      let high = TEXT_HEIGHT;
      if (!fitsIn(shape, high)) return null;
      while (high - low > 2) {
        const mid = Math.floor((low + high) / 2);
        if (fitsIn(shape, mid)) high = mid;
        else low = mid;
      }
      // A line's grace, so rounding in the browser cannot push the last line off.
      return Math.min(TEXT_HEIGHT, high + 6);
    };
```

## Building the same thing in your own project

Anything that cuts flowing text into fixed boxes has this problem: printable reports, slide generators, e-book readers that page rather than scroll. Here is the shape of it, reduced from Atlas's version; a sketch for your own code, not a file from the repository.

```ts
const markup = (words: string[]) => `<p>${words.join(" ")}</p>`; // one function, used to measure and to draw

function fit(words: string[], start: number, box: HTMLElement, height: number) {
  const fits = (n: number) => {
    box.innerHTML = markup(words.slice(start, start + n));
    return box.scrollHeight <= height;
  };
  let low = 0;
  let high = Math.min(words.length - start, 700);
  if (fits(high)) return start + high;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits(mid)) low = mid;
    else high = mid - 1;
  }
  return start + low; // where the next box begins
}
```

The function is the easy part. What makes it hold up is keeping measuring and drawing identical:

1. **One function makes the markup.** If anything decorates the text, it does so inside that function.
2. **One source for the type.** Face, size, leading, tracking and alignment go to the measuring node and the drawn box from the same object, and the measuring node is reset on every call.
3. **The same width, from the same constants.** Atlas keeps the page geometry in one module that both sides import.
4. **Wait for fonts,** and prefer faces you know every reader has, or serve your own.
5. **Measure laid out but unseen:** `visibility: hidden`, off-screen, a block formatting context so margins stay inside.
6. **Clip the drawn box,** so a disagreement shows as a cut line rather than text spilling over the next element, and treat any clipping as a bug in the agreement.
7. **Return a cursor,** so the next box knows where to start, and keep it on the slice if you ever want the text to be editable in place.

## What it improved

The repository does not record a before-and-after figure for overflowing pages, because there was never an estimating version to compare against: the fitter arrived with the first commit of the engine, and the words-per-column average exists only as the alternative its comment turns down. What can be stated exactly is the cost of the search, worked out from the code. One render tests the whole remainder, and the halving takes at most ten more, since 2 to the power of 10 (1,024) is the first power of two above the 701 possible answers. That is at most eleven renders per box, against as many as 700 for adding one word at a time.

The effect on the issue is plainer than any number. Columns end on the last line that fits, in whatever face the theme or the reader chose. A plate can be dragged larger and the story re-flows around it. The last page of a story can be cut to the depth its words need. And text can be edited straight on the proof, because every column knows which words of the story it holds.

The cost is that all of this is layout work in the browser's main thread, and a long story means many boxes. The desk does not hide that: it plays a short interlude while the type is set, and the comment in `Create.tsx` explains that the desk "is never left on screen doing visible nothing while the type is set".

To see the fitter at work, paste a long story into [the desk](/create), press it, and drag the edge of a photograph on the proof. What each version has added since is on [What's new](/whats-new).
