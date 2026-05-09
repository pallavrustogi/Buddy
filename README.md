# Buddy 🐶

> A friendly agent that helps newcomers understand any code repository.
> Works with **GitHub Copilot CLI** and **Claude Code CLI**.
> Buddy stores all knowledge in a portable `.buddy/` folder at the repo root — pure Markdown + small JSON, no databases, no embeddings, no global state. Check it into git and your whole team benefits.

---

## Why Buddy?

You just cloned a repo you've never seen. You have no idea what it does, how to run it, or where to start reading. Buddy fixes that — *and* leaves behind a beginner-friendly knowledge base your teammates inherit when they clone the same repo.

## Install

```bash
npm install -g @prustogi/buddy
```

Requires **Node 18+**. You'll also want at least one of:
- [GitHub Copilot CLI](https://github.com/github/gh-copilot) — `gh extension install github/gh-copilot`
- [Claude Code CLI](https://claude.ai/code) — `npm install -g @anthropic-ai/claude-code`

Buddy is the *brain definition*; the AI CLI is the *runtime* that talks to it.

## Quickstart

```bash
cd path/to/some/repo
buddy init        # creates .buddy/, installs the agent for both CLIs, opens the home page
```

Then load Buddy in whichever AI CLI you use:

**GitHub Copilot CLI**
```
copilot
> /agent          # pick "buddy"
> Scan this repo and fill in .buddy/
```

**Claude Code CLI**
```
claude
> @buddy scan this repo and fill in .buddy/
```

That's it. Buddy populates `.buddy/README_FOR_HUMANS.md`, `GETTING_STARTED.md`, `ARCHITECTURE.md`, and friends.

## Commands

| Command | What it does |
|---|---|
| `buddy init` | Create `.buddy/` and install agents for all CLIs (or auto-open home page if it exists). |
| `buddy open [doc]` | Open `.buddy/README_FOR_HUMANS.md` (or a named doc like `getting-started`, `architecture`, `links`). |
| `buddy status` | Show whether `.buddy/` is current with HEAD. |
| `buddy precheck` | Before commits — list docs likely stale based on git changes. |
| `buddy link <url>` | Save a doc URL with secret redaction. |
| `buddy agent install` | Install the Buddy agent for Copilot CLI (default). |
| `buddy agent install --claude` | Install for Claude Code CLI only. |
| `buddy agent install --all` | Install for both Copilot CLI and Claude Code. |
| `buddy agent list` | Show install status for all agent locations. |
| `buddy agent path` | Print the source paths for both agent prompt files. |

Skip auto-open with `--no-open` or `BUDDY_NO_OPEN=1` (handy for CI).

## Agent install locations

`buddy init` automatically installs agents for both CLIs:

| CLI | Repo-level | User-level |
|---|---|---|
| GitHub Copilot CLI | `.github/agents/buddy.md` | `~/.copilot/agents/buddy.md` |
| Claude Code CLI | `.claude/agents/buddy.md` | `~/.claude/agents/buddy.md` |

Use `buddy agent install --user` to install at user level instead of repo level.
Use `buddy agent list` to see what is installed where.

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

- **Not a code search engine.** Buddy relies on the AI CLI's file reading for the smart parts.
- **Doesn't fetch external URLs.** `buddy link` stores metadata only — paste contents if you want a summary.
- **First-pass `ARCHITECTURE.md` is best-effort** and clearly marked when inferred.
- **AI-tool dependent.** The CLI works standalone for init/open/status/precheck/link, but the *smart* doc generation needs GitHub Copilot CLI or Claude Code (or equivalent).

## Development

```bash
npm install
npm test
node bin/buddy.js --help
```

Tests use Node's built-in `node:test` runner — zero extra dependencies.

## License

MIT — see [LICENSE](./LICENSE).
