# Buddy 🐶

> A friendly Copilot CLI agent that helps newcomers understand any code repository.
> Buddy stores all knowledge in a portable `.buddy/` folder at the repo root — pure Markdown + small JSON, no databases, no embeddings, no global state. Check it into git and your whole team benefits.

---

## Why Buddy?

You just cloned a repo you've never seen. You have no idea what it does, how to run it, or where to start reading. Buddy fixes that — *and* leaves behind a beginner-friendly knowledge base your teammates inherit when they clone the same repo.

## Install

Buddy isn't on npm yet. Grab the latest tarball and install it globally:

```bash
# 1. Download buddy-<version>.tgz from the project (e.g., the GitHub Releases page
#    or directly from the repo root).
# 2. Install it globally:
npm install -g ./buddy-0.3.0.tgz
```

Requires **Node 18+**. You'll also want [GitHub Copilot CLI](https://github.com/cli/cli) installed — Buddy is the *brain definition*; Copilot CLI is the *runtime* that talks to it.

## Quickstart

```bash
cd path/to/some/repo
buddy init        # creates .buddy/, installs the agent into .github/agents/, opens the home page
copilot           # launch GitHub Copilot CLI
> /agent          # pick "buddy"
> Scan this repo and fill in .buddy/
```

That's it. Buddy populates `.buddy/README_FOR_HUMANS.md`, `GETTING_STARTED.md`, `ARCHITECTURE.md`, and friends.

## Commands

| Command | What it does |
|---|---|
| `buddy init` | Create `.buddy/` (or auto-open home page if it exists). |
| `buddy open [doc]` | Open `.buddy/README_FOR_HUMANS.md` (or a named doc like `getting-started`, `architecture`, `links`). |
| `buddy status` | Show whether `.buddy/` is current with HEAD. |
| `buddy precheck` | Before commits — list docs likely stale based on git changes. |
| `buddy link <url>` | Save a doc URL with secret redaction. |
| `buddy agent` | Print the agent prompt path (for `/agents add` in Copilot CLI). |

Skip auto-open with `--no-open` or `BUDDY_NO_OPEN=1` (handy for CI).

## What Buddy writes to `.buddy/`

```
.buddy/
├── README_FOR_HUMANS.md      ← the home page
├── GETTING_STARTED.md
├── ARCHITECTURE.md
├── TECH_STACK.md
├── INTEGRATIONS.md
├── CHANGELOG_SUMMARY.md
├── LINKS.md
├── MAP/
│   ├── repo_map.md
│   ├── entry_points.md
│   └── data_flow.md
├── INDEX/
│   └── links.json
├── NOTES/
│   ├── open_questions.md
│   └── assumptions.md
└── manifest.json
```

All Markdown + small JSON. **No databases. No embeddings. No `~/.buddy` dir.** Commit it, share it, win.

## The auto-launch rule

After `buddy init` (whether `.buddy/` was just created or already existed), Buddy opens `.buddy/README_FOR_HUMANS.md` in your default editor or browser so you immediately land on something useful. Same for `buddy open`. Suppress with `--no-open` or `BUDDY_NO_OPEN=1`.

## Honest limitations

- **Not a code search engine.** Buddy relies on Copilot CLI's file reading for the smart parts.
- **Doesn't fetch external URLs.** `buddy link` stores metadata only — paste contents if you want a summary.
- **First-pass `ARCHITECTURE.md` is best-effort** and clearly marked when inferred.
- **AI-tool dependent.** The CLI works standalone for init/open/status/precheck/link, but the *smart* doc generation needs Copilot CLI (or equivalent).

## Development

```bash
npm install
npm test
node bin/buddy.js --help
```

Tests use Node's built-in `node:test` runner — zero extra dependencies.

## License

MIT — see [LICENSE](./LICENSE).
