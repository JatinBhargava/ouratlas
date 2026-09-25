---
name: team
description: Starts the Atlas team — product owner, architect and three senior developers (frontend, platform, AI) — on a goal. The product owner writes stories (why and what), the architect adds the how and assigns lanes, the stories go onto the Notion board, the developers pick up their stories in parallel on their own branches, and the architect reviews. Run only when the founder calls /team.
argument-hint: "<goal> | plan <goal> | build | review | status"
disable-model-invocation: true
---

# /team

You are running the Atlas team for the founder. Arguments: `$ARGUMENTS`

| Call | What happens |
|---|---|
| `/team <goal>` | The whole loop: plan → board → build → review → report |
| `/team plan <goal>` | Stories only: written, designed and put on the board as **Ready**; nobody builds |
| `/team build` | Developers pick up every **Ready** story on the board, one per lane at a time |
| `/team review` | The architect reviews every story **In review** |
| `/team status` | Read the board and report; change nothing |

With no goal (`/team` alone), ask the product owner for the next most valuable batch from its roadmap.

The team, as agents in `.claude/agents/`:

| Role | Agent | Lane |
|---|---|---|
| Product owner | `product-owner` | Why and What |
| Architect | `architect` | How, lanes, order, review |
| Senior developer | `senior-dev-frontend` | Frontend |
| Senior developer | `senior-dev-platform` | Platform |
| Senior developer | `senior-dev-ai` | AI |

## 0. Preflight — stop here if any of it fails

1. **Notion is connected.** The Notion MCP tools must be available in this session (the server is `notion` in `.mcp.json`). If they are not, stop and tell the founder: run `/mcp`, choose **notion**, **Authenticate**, approve access in the browser, then run `/team` again.
2. **The board exists.** Read `.claude/team/board.json`. If it is missing, search Notion for a database named **Atlas — Team Board**. If there is none, create a page **Atlas Engineering** (private to the founder's workspace) and inside it a database **Atlas — Team Board** with these properties:
   - `Name` (title)
   - `ID` (text, e.g. `ATL-12`)
   - `Status` (select: Backlog, Ready, In progress, Blocked, In review, Changes requested, Done)
   - `Lane` (select: Frontend, Platform, AI)
   - `Priority` (select: P0, P1, P2, P3)
   - `Estimate` (select: S, M)
   - `Type` (select: Story, Tech, Bug, Spike)
   - `Epic` (text)
   - `Depends on` (text: story IDs)
   - `Plan` (select: All, Wanderer, Traveller, Cartographer, Internal)
   - `Branch` (text)
   - `Founder decision` (checkbox)

   Then write `.claude/team/board.json` with the database's URL and id, the parent page's URL, and `"nextId": 1`. Every later run reuses it.
3. **The working tree is committed** (for `build` and the full loop). Developers work in their own git worktrees, which start from `HEAD`: uncommitted changes are invisible to them. If `git status --porcelain` shows changes, list them and ask the founder to commit first, or confirm that the developers should build without them.

## 1. Plan — product owner, then architect

1. Spawn **`product-owner`** in the foreground with the goal. Ask for 3–6 stories that together achieve it, each with:
   - **Title** — a verb and an outcome ("Readers pick a masthead name for their magazine")
   - **Why** — the user problem, who it is for, the business reason, and how success will be measured
   - **What** — the user-facing behaviour, and 3–7 testable acceptance criteria
   - **Out of scope**
   - Priority, plan placement, epic, and whether it needs a founder decision (and which)

   It must respect the invariants in `CLAUDE.md` and check the code for what already exists.
2. Spawn **`architect`** in the foreground with those stories. Ask it to return, per story: the **How** (approach, rejected alternative, exact files, schema/SQL, invariants at risk, verification steps), **Estimate**, **Lane**, **Depends on**, and a check that no two stories in the batch edit the same file. It splits any story that spans two lanes or would be L-sized, and writes ADRs for cross-cutting decisions.
3. Show the founder the final story list (ID, title, lane, estimate, depends on, founder decision) before writing to Notion only when a story needs a founder decision; otherwise continue.

## 2. Board — write the stories to Notion

For each story, create a page in the board database. Properties from the plan, `ID` = `ATL-<nextId>` (then increment and save `nextId` in `.claude/team/board.json`), and `Status` = **Ready** — or **Backlog** if it depends on an unfinished story or needs a founder decision. The page body, in this order:

```
## Why
<problem · who · business reason · success metric>

## What
<behaviour>
### Acceptance criteria
- [ ] …

## How
<approach · rejected alternative · files · schema/SQL · invariants · verification>

## Out of scope
## Founder decisions
## Dev log
_(the developer fills this in)_
## Review
_(the architect fills this in)_
```

Stop here for `/team plan`, and report the board link and the stories.

## 3. Build — the developers, in parallel

1. Query the board for **Ready** stories whose `Depends on` stories are all Done. For each lane take the highest-priority one.
2. Spawn one developer per lane that has a story — `senior-dev-frontend`, `senior-dev-platform`, `senior-dev-ai` — **all in the same message, in the background, each with `isolation: "worktree"`**. Give each: the story's Notion URL and ID, the board URL, and this instruction: follow your agent workflow; set the story In progress; branch `story/<ID>-<slug>`; build; verify; commit on the branch only; fill in the Dev log; set In review (or Blocked with the reason).
3. As each finishes, note its branch and worktree path from the result. If a lane has more Ready stories, spawn that lane's developer again for the next one. Never run two stories of the same lane at once.
4. When a story comes back Blocked, do not retry it; carry the reason into the report.

## 4. Review — the architect

Spawn **`architect`** with every story now In review: the Notion URLs, branch names and worktree paths. It reviews each diff against the story, runs the CI bar, writes the Review section and sets Done or Changes requested. For Changes requested, spawn that lane's developer once more on the same worktree and branch with the review items, then have the architect review again. Two rounds at most; after that, leave it for the founder.

## 5. Report to the founder

End with a short report:
- the board link;
- a table: ID · title · lane · status · branch;
- for each Done story: one line on what it does, and how to merge it (`git merge --no-ff story/<ID>-<slug>` from `master`, or open a PR — the founder decides);
- everything marked **For the founder**: SQL to run in Supabase, env vars, dashboard steps, and the founder decisions still open;
- anything Blocked, and why.

## Rules for the whole run

- Only the founder merges, pushes or deploys. Nobody commits to `master`.
- No one runs migrations on a real database, changes DNS, or touches the Render, Vercel, Dodo or Supabase dashboards.
- The invariants in `CLAUDE.md` override any story. A story that would break one goes back to the product owner, not into the code.
- Keep Notion the source of truth: every status change happens on the board, not only in chat.
