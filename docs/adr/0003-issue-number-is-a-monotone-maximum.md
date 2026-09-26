# 0003 — The browser owns the run; the issue number is a monotone maximum, not a server allocation

Date: 2026-09-26
Status: accepted
Stories: 2, 3a, 3b

## Context

Founder decision #2: the issue number advances on the first successful **export
or save** of a composition. Sending to press does not advance it, recomposition
never changes it, and re-export never advances it. Founder decision #3: the
masthead lives on `profiles` but the browser stays the working source of truth,
because composing signed out has to work — sign-in is required only at export.

Those two together rule out the obvious design. If the number were allocated
server-side at the press, then: composing signed out could not show a number at
all; every abandoned press would burn one, which decision #2 forbids; and a
reader with no network would be unable to press. `claim_export`
(`api/schema.sql:268–315`) is the right *shape* to copy — one statement, so a
double-click cannot slip two claims past it — but it is a monthly counter that
spends, and the number is a position in a run that accumulates.

Counting rows was considered and is wrong for a reason that is easy to miss:
`pruneIssues` (`api/routes/issues.ts:282`) deletes expired free-plan saves, so a
number derived from `issues` rows would go *backwards* — a reader's fourth issue
would be numbered 02 after two of the first three expired. `exports` cannot
answer it either; it is a monthly count, reset by month, and it has no idea which
issue is which.

## Decision

There are two separate operations and they are named separately.

**Proposing** happens in the browser, at the press, with no network call. The
number shown is `max(local.lastIssue, server.issuesPublished) + 1`, or whatever
the reader typed instead (1–999, so someone who had a run before Atlas can start
at 7). It is minted once per composition at the same moment the riddle seed is
(`src/pages/Create.tsx:805–812`) and handed back unchanged to every recomposition
— a plate drag, a theme change, a type change, a `leaves` edit — because it is
desk state, like the seed and the plate sizes, and not a property of the `Issue`,
which is rebuilt from scratch on every change.

**Settling** happens on the first successful export or save, and it is a
**monotone maximum on both sides**:

- locally, `lastIssue = max(lastIssue, issueNo)`;
- on the server, `claim_issue_number(p_user, p_number)` does
  `issues_published = greatest(issues_published, p_number)` in one statement and
  returns the settled value.

Because both are a maximum and not an increment, "the same composition exported
twice" cannot advance the counter, and neither can the same *number* exported
again after a plate drag has replaced the `Issue` object. That is the actual
guarantee. The `publishedFor` ref in `Create.tsx` — keyed on the `Issue` object
exactly as the existing `claimedFor` ref (`Create.tsx:246`) is keyed for the
export allowance — only saves a pointless network call; it is not what makes the
count correct. Idempotence is. A guard that depended on object identity would be
wrong the moment the reader dragged a plate between two exports.

The server never lowers the column and never allocates ahead of the browser. It
is a floor that a browser can raise and read back, which is what makes a new
phone continue the run at the right number.

## Consequences

- **Two tabs pressing at the same instant can both print "Issue 04."** Both read
  the same floor, both propose 04, both settle to 04, and the column ends at 4.
  This is the price of a number the reader can see before they have signed in,
  and it is a price we are choosing: the alternative burns a number on every
  abandoned press. It is rare (it needs two presses with no export between them)
  and it is recoverable (the number is editable on the desk). It is stated here
  rather than in a route comment because the next person to read
  `claim_issue_number` will want to know that the missing `+1` is deliberate.
- The number is not a unique key and must never be used as one. It is a label on
  a cover.
- Taking a saved issue down, or a free-plan issue expiring, cannot lower the next
  number, because nothing in the counter is derived from rows that can be deleted.
- A reader who clears site data on a device they have never signed in on loses
  their run entirely. Signing in recovers it from the floor. That is what Story 3
  is for, and it is why the masthead and the numbering are not paywalled —
  `save-panel.tsx:216` paywalls "keep forever" and nothing else here.
- `atlas:press` in `localStorage` is a contract, versioned, documented with the
  module that owns it, and read defensively: private windows and blocked site
  data throw rather than answering, so every read and write is wrapped and an
  unreadable store leaves the desk fully working on an empty record — the same
  discipline `src/lib/draft.ts` already applies to IndexedDB and session storage.
