# Buddy — User Journey

How a brand-new contributor goes from "I just cloned this strange repo" to "I understand it and can ship code."

> **Audience:** anyone evaluating Buddy or building it. Keep this doc up to date as the CLI evolves — it is the canonical "what does Buddy feel like" reference.

---

## TL;DR

| Command | When |
|---|---|
| `npm install -g ./buddy-<version>.tgz` | Once per machine (download tgz first; Buddy isn't on npm yet) |
| `buddy init` | Once per repo (creates `.buddy/`) |
| `buddy agent` | Once per machine, prints path to wire into Copilot CLI |
| `buddy open` | Anytime — opens `.buddy/README_FOR_HUMANS.md` (the home page) |
| `buddy precheck` | Before commits — shows likely-stale docs |
| `buddy link <url>` | Drop a doc link from the terminal |
| `buddy status` | "Is .buddy/ stale?" |

Everything *smart* (writing docs, answering questions) happens inside Copilot CLI by talking to Buddy in plain English.

---

## Step 1 — Install Buddy (one time, global)

Buddy isn't published to npm yet, so we install from a local tarball:

```bash
# Download buddy-<version>.tgz from the project (Releases page or repo root), then:
npm install -g ./buddy-0.3.0.tgz
```

The user also needs GitHub Copilot CLI installed. Buddy is the *brain definition*; Copilot CLI is the *runtime*.

## Step 2 — Clone the strange repo

```bash
git clone https://github.com/some-org/mystery-project.git
cd mystery-project
```

They have **no idea** what this code does.

## Step 3 — Bootstrap Buddy in this repo

```bash
buddy init
```

What this does (deterministic, no AI yet):
- Creates `.buddy/` with all template files (skeleton)
- Creates `.buddy/manifest.json` with `last_indexed_commit: null`
- Prints next steps

If `.buddy/` already exists (a teammate already committed it):
- `buddy init` says *"Already initialized."*
- **Auto-opens the home page** (`.buddy/README_FOR_HUMANS.md`) so the new user lands on something useful immediately.

## Step 4 — Load Buddy into Copilot CLI

```bash
buddy agent          # prints path to the agent prompt file
copilot              # launch Copilot CLI
> /agents add buddy  # register Buddy using the path printed
> /agents            # pick "Buddy"
```

Copilot CLI now acts as Buddy in this repo.

## Step 5 — First ask: "Scan this repo"

```
> Hi, I'm new here. Scan this repo and fill in .buddy/ so I can understand it.
```

Buddy walks the repo, reads git history, and writes:

- `.buddy/README_FOR_HUMANS.md` — *"This project is a CLI tool that…"* (10-year-old language)
- `.buddy/TECH_STACK.md` — *"Node.js 18, Express, PostgreSQL, Jest…"*
- `.buddy/GETTING_STARTED.md` — exact `npm install` / `npm run dev` / `npm test` commands found in scripts
- `.buddy/ARCHITECTURE.md` — major folders and request flow
- `.buddy/MAP/repo_map.md` — folder-by-folder purpose
- `.buddy/MAP/entry_points.md` — *"App starts at `src/server.js`"*
- `.buddy/INTEGRATIONS.md` — DBs, queues, auth, third-party APIs
- `.buddy/NOTES/open_questions.md` — what Buddy couldn't infer
- `.buddy/NOTES/assumptions.md` — anything Buddy guessed
- Updates `.buddy/manifest.json` with current commit SHA + timestamp

When done, **Buddy automatically opens the home page** (`.buddy/README_FOR_HUMANS.md`) in the user's default editor / browser. The user never has to wonder *"where do I look?"* — Buddy puts them on the front porch.

## Step 6 — User reads the friendly docs

The home page is already open. From there they navigate to:

```bash
buddy open getting-started     # opens .buddy/GETTING_STARTED.md
buddy open architecture        # opens .buddy/ARCHITECTURE.md
buddy open links               # opens .buddy/LINKS.md
```

Beginner-friendly markdown. Short sentences. Defined jargon. Exact commands. They run the project locally in 5 minutes.

## Step 7 — Daily use: ask questions

Inside Copilot CLI with Buddy loaded:

**Question about code**
```
> Where does login happen?
```
> *"Login starts in `src/routes/auth.js:42`. It calls `verifyPassword()` in `src/services/auth.js:88`, then issues a JWT via `src/lib/jwt.js`. See `.buddy/MAP/data_flow.md`."*

**Capture an external doc**
```
> Here's our internal design doc: https://confluence.company.com/x/abc — it explains payments
```
Buddy:
- Adds entry to `.buddy/LINKS.md` and `.buddy/INDEX/links.json`
- Tags it (`payments`, `architecture`, `must-read`)
- Redacts any secrets/tokens in the URL
- Says: *"📎 Saved. I haven't read the doc itself — paste its content if you want me to summarize."*

**How-to question**
```
> How do I add a new API endpoint?
```
Buddy points to `.buddy/ARCHITECTURE.md` plus an existing endpoint as a template, with concrete steps.

## Step 8 — Before committing code

```bash
buddy precheck
```
```
🔍 Files changed since .buddy was last updated (commit abc123):
   M src/routes/auth.js
   A src/routes/oauth.js
   M src/db.js

Likely-stale Buddy docs:
   .buddy/MAP/entry_points.md   (new route file)
   .buddy/INTEGRATIONS.md       (db.js changed)
   .buddy/CHANGELOG_SUMMARY.md  (always)

Tip: ask Buddy in Copilot CLI: "update buddy for my changes"
```

In Copilot CLI:
```
> update buddy
```
Buddy reads the diff, updates only the affected sections, bumps `manifest.json.last_indexed_commit`, prints what changed.

User commits. `.buddy/` changes go in the same commit.

## Step 9 — Teammate clones the repo tomorrow

```bash
git clone ...
cd mystery-project
buddy init        # detects existing .buddy/, auto-opens home page
```

Even without Copilot CLI installed, the markdown docs are already in the repo and readable. They install Buddy only if they want to *update* the docs.

---

## The Auto-Launch Rule (important)

Buddy should **never leave the user staring at a blank terminal** after a successful operation that produced or revealed knowledge. Specifically:

| Trigger | Action |
|---|---|
| `buddy init` and `.buddy/` already exists | Auto-open `.buddy/README_FOR_HUMANS.md` |
| `buddy init` creates fresh `.buddy/` | Auto-open `.buddy/README_FOR_HUMANS.md` (template) |
| Buddy (the agent) finishes scanning a repo | Auto-open `.buddy/README_FOR_HUMANS.md` |
| `buddy open` with no args | Auto-open `.buddy/README_FOR_HUMANS.md` |
| `buddy open <name>` | Open the named doc |

**How "open" works:**
1. Prefer `$EDITOR` / `$VISUAL` if set.
2. Else open in OS default app (`start` on Windows, `open` on macOS, `xdg-open` on Linux).
3. Provide `--no-open` flag and `BUDDY_NO_OPEN=1` env var to suppress (for CI / automation).
4. If no GUI / TTY is available, fall back to printing the file path so the user can copy it.

---

## Capabilities (what Buddy can do)

- ✅ Auto-generate beginner-friendly docs from repo evidence
- ✅ Incremental updates tied to git commits
- ✅ Link capture with secret redaction
- ✅ Pre-commit doc-staleness hints
- ✅ Cite file paths/line ranges when answering questions
- ✅ Portable — pure markdown + JSON, no DB, no embeddings
- ✅ Auto-open the home page so users never feel lost

## Limitations (be honest)

- ❌ Not a code search engine — relies on the host AI tool's file reading
- ❌ Can't read external URLs — stores link metadata only
- ❌ First-pass `ARCHITECTURE.md` is best-effort and marked "inferred"
- ❌ AI-tool dependent — needs Copilot CLI (or equivalent) for the smart parts
- ❌ No live cross-machine sync — pull + re-run to refresh
- ❌ Faithful to the repo — if the repo is misleading, Buddy reflects that
