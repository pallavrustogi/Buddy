# Buddy 🐶

[![npm version](https://img.shields.io/npm/v/@prustogi/buddy.svg?label=npm&color=cb3837&logo=npm)](https://www.npmjs.com/package/@prustogi/buddy)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node.js 18+](https://img.shields.io/badge/node-18%2B-43853d?logo=node.js&logoColor=white)
![Works with GitHub Copilot CLI](https://img.shields.io/badge/GitHub%20Copilot%20CLI-supported-2da44e?logo=github)
![Works with Claude Code](https://img.shields.io/badge/Claude%20Code-supported-d97706?logo=anthropic&logoColor=white)
![Works with Codex CLI](https://img.shields.io/badge/Codex%20CLI-supported-412991?logo=openai&logoColor=white)
![Works with OpenCode](https://img.shields.io/badge/OpenCode-supported-0b0b0b)
![Works with Cursor](https://img.shields.io/badge/Cursor-supported-000000)
![Works with VS Code Copilot](https://img.shields.io/badge/VS%20Code%20Copilot-supported-007acc?logo=visualstudiocode&logoColor=white)
![Works with JetBrains](https://img.shields.io/badge/JetBrains-supported-000000?logo=jetbrains&logoColor=white)
![Windows](https://img.shields.io/badge/Windows-supported-0078d4?logo=windows&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-supported-000000?logo=apple&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-supported-fcc624?logo=linux&logoColor=black)

> A friendly agent that helps newcomers understand any code repository.
> Works with **GitHub Copilot CLI**, **Claude Code CLI**, **Codex CLI**, **OpenCode**, **Cursor**, **VS Code (GitHub Copilot)**, **Google Antigravity**, **Windsurf**, **Gemini CLI**, **Zed**, and **JetBrains (AI Assistant + Junie)**.
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
- [Codex CLI](https://github.com/openai/codex) — `npm install -g @openai/codex`
- [OpenCode](https://opencode.ai) — `npm install -g opencode-ai`
- [Cursor](https://cursor.com), [VS Code](https://code.visualstudio.com) with GitHub Copilot, [Google Antigravity](https://antigravity.google), [Windsurf](https://windsurf.com), [Zed](https://zed.dev), or a JetBrains IDE — no CLI needed, just open the repo
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) — `npm install -g @google/gemini-cli`

Buddy is the *brain definition*; the AI CLI is the *runtime* that talks to it.

## Quickstart

```bash
cd path/to/some/repo
buddy init        # creates .buddy/, installs the agent for every supported tool, opens the home page
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

**Codex CLI**
```
codex
> scan this repo and fill in .buddy/
```
(Buddy instructions are pre-loaded via `AGENTS.md`)

**OpenCode**
```
opencode
# press Tab to switch to the "buddy" agent, then:
> scan this repo and fill in .buddy/
```

**Cursor**
```
# open the repo in Cursor, start an Agent chat, then:
> @buddy scan this repo and fill in .buddy/
```

**VS Code (GitHub Copilot)**
```
# open Copilot Chat, choose "buddy" in the agent dropdown, then:
> scan this repo and fill in .buddy/
```

**Google Antigravity**
```
> follow the "buddy" rule, then scan this repo and fill in .buddy/
```

**Windsurf** — start a Cascade chat: `use the buddy rule to scan this repo and fill in .buddy/`

**Gemini CLI** — `gemini`, then `scan this repo and fill in .buddy/` (instructions are pre-loaded via `GEMINI.md`)

**Zed** — open the Agent Panel and ask it to scan the repo (`.rules` is loaded automatically)

**JetBrains** — Junie loads `.junie/AGENTS.md` automatically. For AI Assistant chat, set the `buddy` project rule to *Always* or *Manual* in Settings → Rules.

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
| `buddy agent install --codex` | Install for Codex CLI only. |
| `buddy agent install --opencode` | Install for OpenCode only. |
| `buddy agent install --cursor` | Install for Cursor only. |
| `buddy agent install --vscode` | Install for VS Code GitHub Copilot only. |
| `buddy agent install --antigravity` | Install for Google Antigravity only. |
| `buddy agent install --windsurf` / `--gemini` / `--zed` / `--jetbrains` / `--junie` | Install for just that tool. |
| `buddy agent install --all` | Install for every supported tool. |
| `buddy agent list` | Show install status for all agent locations. |
| `buddy agent path` | Print the source paths for the agent prompt files. |

Skip auto-open with `--no-open` or `BUDDY_NO_OPEN=1` (handy for CI).

## Agent install locations

`buddy init` automatically installs agents for every supported tool:

| CLI | Repo-level | User-level |
|---|---|---|
| GitHub Copilot CLI | `.github/agents/buddy.md` | `~/.copilot/agents/buddy.md` |
| Claude Code CLI | `.claude/agents/buddy.md` | `~/.claude/agents/buddy.md` |
| Codex CLI | `AGENTS.md` | `~/.codex/AGENTS.md` |
| OpenCode | `.opencode/agent/buddy.md` | `~/.config/opencode/agent/buddy.md` |
| Cursor | `.cursor/rules/buddy.mdc` | — (repo only) |
| VS Code (Copilot) | `.github/agents/buddy.agent.md` | — (repo only) |
| Google Antigravity | `.agents/rules/buddy.md` | — (repo only) |
| Windsurf | `.windsurf/rules/buddy.md` | — (repo only) |
| Gemini CLI | `GEMINI.md` | `~/.gemini/GEMINI.md` |
| Zed | `.rules` | — (repo only) |
| JetBrains AI Assistant | `.aiassistant/rules/buddy.md` | — (repo only) |
| JetBrains Junie | `.junie/AGENTS.md` | — (repo only) |

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
- **AI-tool dependent.** The CLI works standalone for init/open/status/precheck/link, but the *smart* doc generation needs one of the supported AI tools (or equivalent).

## Development

```bash
npm install
npm test
node bin/buddy.js --help
```

Tests use Node's built-in `node:test` runner — zero extra dependencies.

## License

MIT — see [LICENSE](./LICENSE).

---

> **Disclaimer:** This is a personal project and is not affiliated with or endorsed by Microsoft.
