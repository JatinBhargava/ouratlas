# 0001 — The masthead is the first reader-authored text we store

Date: 2026-09-26
Status: accepted
Stories: 1, 2, 3a, 3b

## Context

Until now the rule in `CLAUDE.md` has been absolute and easy to hold: photographs
and story text are never stored, and the one thing that persists — a saved issue
— is sealed in the browser before it leaves, page pictures and all, with the
title and dek inside the seal. `api/schema.sql` says so in its own opening
comment: "Photographs and story text are never sent to the server and have no
table." Every column on `profiles` today came from Google or from a payment
processor: email, full name, avatar, two customer ids. Nothing on that table was
typed by the reader.

The masthead breaks that. It is a short string the reader writes, and founder
decision #3 puts it on `profiles` so a name survives a new phone, a cleared
cache and a private window — which is the whole promise of "it stays the same
from issue to issue". A masthead kept only in `localStorage` is a masthead that
is lost exactly when the reader would most notice.

The alternative we rejected was to keep it sealed like everything else: store the
masthead in a per-account sealed blob in the `issues` bucket, or derive it from
the most recent saved issue's manifest. Both fail on the same point. The desk
needs the name *before* there is an issue and *before* any key exists, on a
device that has never seen this reader; an encrypted value whose key lives only
in a link the reader may never have kept is a value the desk cannot read. And
counting saved issues cannot answer "which issue is this" either, because
`pruneIssues` (`api/routes/issues.ts:282`) deletes expired free-plan issues, so
a number derived from rows would go backwards.

## Decision

`profiles` gains two columns: `masthead text` (nullable) and
`issues_published integer not null default 0`. They are stored in the clear, not
sealed.

We hold the line elsewhere by keeping the exception as narrow as it can be
stated:

- **Only the name of the magazine.** No title, no dek, no story, no photograph,
  no word count, no dateline. The route that writes it accepts exactly one field
  and rejects a body carrying anything else. The masthead is the name of a
  *publication*, not the content of an issue — closer in kind to a display name
  than to a diary entry.
- **Opt-out, in the reader's own words.** The Account card offers "Keep this to
  this browser only", which nulls the column and leaves the local copy in place.
  Composing, pressing, exporting and saving all keep working with the column
  empty, so the opt-out costs the reader nothing but cross-device continuity.
- **The browser stays the working source of truth.** The server copy is a
  recovery copy, read when the browser has none. Nothing about a press waits on
  it. See 0003.
- **RLS as the existing `profiles` policies do it:** read-own and update-own, so
  the column is reachable by its owner and by the service role, and by nobody
  else.

The `api/schema.sql` comment at the top of the file is amended to say what is
now true, rather than being left to read as a promise the schema no longer keeps.

## Consequences

- There is now a class of reader-authored text on the server, and the next
  request to store "just one small thing the reader typed" will cite this record.
  It should have to argue against the two tests above — is it the name of a
  publication rather than the content of an issue, and does the product still
  work with the column empty — not merely point at the precedent.
- A data-deletion request now has to clear a column that holds something the
  reader wrote. `on delete cascade` from `auth.users` already covers account
  deletion.
- `issues_published` is a real retention metric, the first honest one we have:
  the distribution of issues published per account. It is also the first column
  whose value the browser proposes and the server merely bounds (0003).
- The privacy copy on the site and in the colophon still says nothing of an
  issue is stored. That stays true — an issue is photographs and words, and
  neither is here. The Account card is where the masthead's storage is stated,
  in plain words, next to the switch that turns it off.
