# 0002 — `Manifest` goes to `v: 2`, and how a sealed manifest is allowed to change

Date: 2026-09-26
Status: accepted
Stories: 4

## Context

A saved issue's `Manifest` (`src/lib/saved.ts`) is the only description of a
magazine we keep, and it is sealed with the issue's own AES-GCM key before it is
uploaded. Nothing outside the browser that holds the key can read it, and that
includes us: there is no migration we can run over it, no backfill, no query. The
`issues` row holds an owner, a page count, an expiry, a ready flag and
optionally the key — and deliberately nothing else (`api/schema.sql:318–333`).

So a manifest's shape is a wire format between two builds of the browser that may
be months apart, in both directions: a link shared in September 2026 must open in
a browser running the 2027 build, and a manifest written by the 2027 build must
open in a tab someone left open from September. It carries `v: 1` today and
nothing reads it.

Story 4 needs two more fields on it — the masthead and the issue number — so the
reader page can print `THE COROMANDEL REVIEW · Issue 03 · September 2026` instead
of the hardcoded "Vol. I", and My magazines can group a run.

## Decision

`v` widens to `1 | 2`. New saves write `v: 2`. `masthead` and `issueNo` are both
**optional** fields, and no consumer branches on `v`.

That last clause is the decision, and the rest follows from it. Because the new
fields are optional, a `v: 1` manifest parses as a well-formed `v: 2`-shaped
object with them absent, and every consumer that treats them as optional renders
a pre-Story-4 save exactly as it renders today — no number, no empty "Issue"
label. There is nothing to migrate because there is no incompatible shape.

`v` is therefore not a switch. It is a tripwire, kept for the change we have not
had to make yet: the day a field's *meaning* changes, or a required field is
added or removed, `v` is how a reader recognises a manifest it must not
misinterpret. Reading it as a switch now would mean writing a branch that has
nothing to choose between, and the branch would be the first thing to rot.

The rule this sets for every later change to `Manifest`:

- **Additive and optional keeps `v` where it is** in spirit but we still step it,
  so the written version says which build sealed it — cheap, and it is the only
  provenance a sealed blob has.
- **Anything a reader could misread — a changed unit, a changed meaning, a
  removed field — steps `v` and requires a branch** in `openManifest` and
  `openIssue`, written to render the old shape rather than refuse it.
- **Never refuse an unknown, higher `v`.** The seal already proves the manifest is
  ours. A manifest from a future build still carries title, dateline, folios,
  words, photographs and dek, and rendering those is strictly better than telling
  the reader their own magazine cannot be opened. Read what is recognised, ignore
  the rest.

## Consequences

- Manifests written before Story 4 ships can never gain a masthead or a number.
  A reader's older saves will sit in My magazines with no "Issue NN" label
  alongside newer ones that have one, and there is no fix for that short of
  asking them to save again. Accepted: the alternative is a number we invented
  for an issue the reader never numbered.
- `Manifest` is now versioned in fact as well as in name, so the type is a
  published interface. It belongs to `src/lib/saved.ts` and changes to it are
  reviewed as contract changes, not as component changes.
- Nothing about the masthead or the number reaches the `issues` row or any
  request body. Both live inside the seal only, which keeps the schema comment at
  `api/schema.sql:318–333` true and keeps the server unable to say what any saved
  magazine is called. This is the constraint that makes the reader page's header
  a client-side render and not a server-rendered share card.
