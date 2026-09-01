# Atlas

Trip photos and your own words, set as a magazine you can keep.

Ten photographs and up to ten thousand words go in; a paginated issue — cover,
contents, feature, plates, colophon — comes out, ready to export as a PDF.

## Running it

```bash
bun install
bun dev          # development, with hot reload
bun start        # production
bun run build.ts # static build into dist/
```

## Where the data goes

Photographs are read into the tab as object URLs and are **never uploaded**.
The story is held in React state. Composition and pagination happen in the
browser, and export goes through the browser's own print dialog. Nothing is
written to a database.

The one exception is the optional copy desk (see below), which is opt-in, marked
as such in the UI, and stated on the issue's colophon whenever it is used.

## The copy desk (optional)

`POST /api/polish` streams the story through Anthropic for a copy-editing pass.
It is off unless the server has a key:

```bash
ANTHROPIC_API_KEY=sk-ant-... bun dev
```

An identity-linked key also needs the workspace it acts in, or the API answers
400:

```bash
ANTHROPIC_WORKSPACE_ID=wrkspc_...
```

Ordinary keys reject that header, so it is only sent when it is set.

Without one the endpoint returns 503 and the UI says so. The key stays on the
server and is never sent to the browser. The story is split into passes of about
1,200 words so a long trip cannot run past the model's output limit, and the
passes are rejoined so paragraph structure survives the round trip. Nothing is
logged or stored on the way through. Photographs are never sent.

## How the magazine is composed

`src/lib/magazine/` is the engine and `src/components/magazine/` draws it.

The hard part is pagination: fixed pages, variable copy. Rather than estimating
from a words-per-column average, the composer **measures** — each text box is
filled by binary-searching the word count against real type rendered off-screen.
That is why no page overflows and none is left half empty.

- `geometry.ts` — the page grid. Shared by the fitter and the renderer, because
  if the two ever disagreed a page would silently overflow.
- `copy.ts` — the story as paragraphs, and the one function that turns a slice
  into markup. Measuring and drawing go through it for the same reason.
- `fit.ts` — the fitter.
- `templates.ts` — the layouts and their text boxes.
- `compose.ts` — pours copy through the layouts, deals out plates, sets folios.

Print uses an `@page` box matching the layout exactly (520×693 CSS px), so
"Save as PDF" produces pages 1:1 with no scaling.
