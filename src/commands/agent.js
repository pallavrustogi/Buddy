import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { agentPromptPath, claudeAgentPromptPath, codexAgentPromptPath, opencodeAgentPromptPath, ideAgentPromptPath, findRepoRoot } from '../lib/paths.js';

// Install destinations auto-discovered by each CLI:
//   Copilot CLI repo:  <repoRoot>/.github/agents/buddy.md
//   Copilot CLI user:  ~/.copilot/agents/buddy.md
//   Claude Code repo:  <repoRoot>/.claude/agents/buddy.md
//   Claude Code user:  ~/.claude/agents/buddy.md
//   Codex CLI repo:    <repoRoot>/AGENTS.md
//   Codex CLI user:    ~/.codex/AGENTS.md
//   OpenCode repo:     <repoRoot>/.opencode/agent/buddy.md
//   OpenCode user:     ~/.config/opencode/agent/buddy.md
//   Cursor repo:       <repoRoot>/.cursor/rules/buddy.mdc   (no file-based user scope)
//   VS Code repo:      <repoRoot>/.github/agents/buddy.agent.md (no file-based user scope)
//   Antigravity repo:  <repoRoot>/.agents/rules/buddy.md    (user rules live in ~/.gemini/GEMINI.md; not touched)

function destForCopilot(scope, repoRoot) {
  if (scope === 'user') return join(homedir(), '.copilot', 'agents', 'buddy.md');
  return join(repoRoot, '.github', 'agents', 'buddy.md');
}

function destForClaude(scope, repoRoot) {
  if (scope === 'user') return join(homedir(), '.claude', 'agents', 'buddy.md');
  return join(repoRoot, '.claude', 'agents', 'buddy.md');
}

function destForCodex(scope, repoRoot) {
  if (scope === 'user') return join(homedir(), '.codex', 'AGENTS.md');
  return join(repoRoot, 'AGENTS.md');
}

function destForOpencode(scope, repoRoot) {
  if (scope === 'user') return join(homedir(), '.config', 'opencode', 'agent', 'buddy.md');
  return join(repoRoot, '.opencode', 'agent', 'buddy.md');
}

// Editor/IDE-style targets share one prompt body; each gets its own frontmatter and path.
// `user` is null when the tool has no file-based user-level install.
const IDE_DESCRIPTION = 'Friendly onboarding agent that explains the repo like you are new. Maintains a portable .buddy/ knowledge base (Markdown + small JSON) at the repo root so every clone benefits.';

export const IDE_TARGETS = {
  cursor: {
    label: 'Cursor',
    flag: '--cursor',
    frontmatter: `---\ndescription: ${IDE_DESCRIPTION}\nalwaysApply: false\n---\n\n`,
    repo: (root) => join(root, '.cursor', 'rules', 'buddy.mdc'),
    user: null,
    next: 'open this repo in Cursor, start an Agent chat, and type "@buddy scan this repo and fill in .buddy/".',
  },
  vscode: {
    label: 'VS Code Copilot',
    flag: '--vscode',
    frontmatter: `---\nname: buddy\ndescription: ${IDE_DESCRIPTION}\n---\n\n`,
    repo: (root) => join(root, '.github', 'agents', 'buddy.agent.md'),
    user: null,
    next: 'open Copilot Chat in VS Code, pick "buddy" in the agent dropdown, and ask it to scan the repo.',
  },
  antigravity: {
    label: 'Antigravity',
    flag: '--antigravity',
    frontmatter: '',
    repo: (root) => join(root, '.agents', 'rules', 'buddy.md'),
    user: null,
    next: 'open this repo in Antigravity and ask the agent to follow the "buddy" rule and scan the repo.',
  },
  windsurf: {
    label: 'Windsurf',
    flag: '--windsurf',
    frontmatter: `---\ntrigger: model_decision\ndescription: ${IDE_DESCRIPTION}\n---\n\n`,
    repo: (root) => join(root, '.windsurf', 'rules', 'buddy.md'),
    user: null,
    next: 'open this repo in Windsurf, start a Cascade chat, and ask "use the buddy rule to scan this repo and fill in .buddy/".',
  },
  gemini: {
    label: 'Gemini CLI',
    flag: '--gemini',
    frontmatter: '',
    repo: (root) => join(root, 'GEMINI.md'),
    user: () => join(homedir(), '.gemini', 'GEMINI.md'),
    next: 'launch gemini in this repo — Buddy instructions are in GEMINI.md (run /memory refresh if it was already open).',
  },
  zed: {
    label: 'Zed',
    flag: '--zed',
    frontmatter: '',
    repo: (root) => join(root, '.rules'),
    user: null,
    next: 'open this repo in Zed, open the Agent Panel, and ask it to scan the repo and fill in .buddy/ (.rules is loaded automatically).',
  },
  jetbrains: {
    label: 'JetBrains AI Assistant',
    flag: '--jetbrains',
    frontmatter: '',
    repo: (root) => join(root, '.aiassistant', 'rules', 'buddy.md'),
    user: null,
    next: 'in AI Assistant settings (Rules), set the "buddy" project rule to Always or Manual, then ask chat to scan the repo.',
  },
  junie: {
    label: 'JetBrains Junie',
    flag: '--junie',
    frontmatter: '',
    repo: (root) => join(root, '.junie', 'AGENTS.md'),
    user: null,
    next: 'open this repo in a JetBrains IDE and ask Junie to scan the repo and fill in .buddy/ (.junie/AGENTS.md is loaded automatically).',
  },
};

export function installIdeTarget(key, { scope = 'repo', force = false, repoRoot } = {}) {
  const t = IDE_TARGETS[key];
  const root = repoRoot || findRepoRoot();
  const destFn = scope === 'user' ? t.user : t.repo;
  if (!destFn) return { dest: null, action: 'unsupported-scope' };
  const dest = destFn(root);
  const src = ideAgentPromptPath();
  if (!existsSync(src)) throw new Error(`agent prompt not found at ${src}`);
  const content = t.frontmatter + readFileSync(src, 'utf8');
  const destDir = join(dest, '..');
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
  if (existsSync(dest)) {
    if (readFileSync(dest, 'utf8') === content) return { dest, action: 'already-installed' };
    if (!force) return { dest, action: 'exists-different', src };
    writeFileSync(dest, content);
    return { dest, action: 'overwritten' };
  }
  writeFileSync(dest, content);
  return { dest, action: 'created' };
}

function installTo(src, dest, force) {
  if (!existsSync(src)) throw new Error(`agent prompt not found at ${src}`);
  const destDir = join(dest, '..');
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

  if (existsSync(dest)) {
    if (!force) {
      const a = readFileSync(src, 'utf8');
      const b = readFileSync(dest, 'utf8');
      if (a === b) return { dest, action: 'already-installed' };
      return { dest, action: 'exists-different', src };
    }
    copyFileSync(src, dest);
    return { dest, action: 'overwritten' };
  }
  copyFileSync(src, dest);
  return { dest, action: 'created' };
}

export function installAgent({ scope = 'repo', force = false, repoRoot } = {}) {
  const root = repoRoot || findRepoRoot();
  const dest = destForCopilot(scope, root);
  return installTo(agentPromptPath(), dest, force);
}

export function installClaudeAgent({ scope = 'repo', force = false, repoRoot } = {}) {
  const root = repoRoot || findRepoRoot();
  const dest = destForClaude(scope, root);
  return installTo(claudeAgentPromptPath(), dest, force);
}

export function installCodexAgent({ scope = 'repo', force = false, repoRoot } = {}) {
  const root = repoRoot || findRepoRoot();
  const dest = destForCodex(scope, root);
  return installTo(codexAgentPromptPath(), dest, force);
}

export function installOpencodeAgent({ scope = 'repo', force = false, repoRoot } = {}) {
  const root = repoRoot || findRepoRoot();
  const dest = destForOpencode(scope, root);
  return installTo(opencodeAgentPromptPath(), dest, force);
}

export const installCursorAgent = (o) => installIdeTarget('cursor', o);
export const installVscodeAgent = (o) => installIdeTarget('vscode', o);
export const installAntigravityAgent = (o) => installIdeTarget('antigravity', o);
export const installWindsurfAgent = (o) => installIdeTarget('windsurf', o);
export const installGeminiAgent = (o) => installIdeTarget('gemini', o);
export const installZedAgent = (o) => installIdeTarget('zed', o);
export const installJetbrainsAgent = (o) => installIdeTarget('jetbrains', o);
export const installJunieAgent = (o) => installIdeTarget('junie', o);

function printInstallResult(result, label) {
  if (result.action === 'unsupported-scope') {
    console.log(`- ${label}: no file-based user-level install; skipped (use repo level).`);
    return true;
  }
  if (result.action === 'already-installed') {
    console.log(`✓ ${label} agent already installed at ${result.dest}`);
  } else if (result.action === 'exists-different') {
    console.log(`! ${label} agent already exists at ${result.dest} (different version).`);
    console.log('  Re-run with --force to overwrite.');
    return false;
  } else {
    const verb = result.action === 'overwritten' ? 'Overwrote' : 'Installed';
    console.log(`🤝 ${verb} ${label} agent at ${result.dest}`);
  }
  return true;
}

function listAgents(repoRoot) {
  const root = repoRoot || findRepoRoot();
  const locations = [
    { label: 'Copilot CLI (repo)', path: destForCopilot('repo', root) },
    { label: 'Copilot CLI (user)', path: destForCopilot('user', root) },
    { label: 'Claude Code (repo)', path: destForClaude('repo', root) },
    { label: 'Claude Code (user)', path: destForClaude('user', root) },
    { label: 'Codex CLI   (repo)', path: destForCodex('repo', root) },
    { label: 'Codex CLI   (user)', path: destForCodex('user', root) },
    { label: 'OpenCode    (repo)', path: destForOpencode('repo', root) },
    { label: 'OpenCode    (user)', path: destForOpencode('user', root) },
    ...Object.values(IDE_TARGETS).flatMap((t) => [
      { label: `${t.label} (repo)`, path: t.repo(root) },
      ...(t.user ? [{ label: `${t.label} (user)`, path: t.user() }] : []),
    ]),
  ];
  console.log('Buddy agent locations:');
  for (const loc of locations) {
    const status = existsSync(loc.path) ? '✓ installed' : '✗ not installed';
    console.log(`  ${status}  ${loc.label}`);
    console.log(`              ${loc.path}`);
  }
}

export async function agentCommand(subcommand, opts = {}) {
  const sub = subcommand || 'install';
  const scope = opts.user ? 'user' : 'repo';
  const repoRoot = findRepoRoot();

  if (sub === 'path') {
    console.log('Copilot CLI agent:', agentPromptPath());
    console.log('Claude Code agent:', claudeAgentPromptPath());
    console.log('Codex CLI agent:  ', codexAgentPromptPath());
    console.log('OpenCode agent:   ', opencodeAgentPromptPath());
    console.log('IDE agent (Cursor, VS Code, Antigravity, Windsurf, Gemini, Zed, JetBrains, Junie):', ideAgentPromptPath());
    return;
  }

  if (sub === 'list') {
    listAgents(repoRoot);
    return;
  }

  if (sub === 'install') {
    const forAll = opts.all;
    const forClaude = opts.claude || forAll;
    const forCodex = opts.codex || forAll;
    const forOpencode = opts.opencode || forAll;
    const ideKeys = Object.keys(IDE_TARGETS).filter((k) => opts[k] || forAll);
    const anyExplicit = opts.claude || opts.codex || opts.opencode || Object.keys(IDE_TARGETS).some((k) => opts[k]);
    const forCopilot = !anyExplicit || forAll;
    let anyFailed = false;

    if (forCopilot) {
      const result = installAgent({ scope, force: !!opts.force, repoRoot });
      const ok = printInstallResult(result, 'Copilot CLI');
      if (!ok) anyFailed = true;
    }

    if (forClaude) {
      const result = installClaudeAgent({ scope, force: !!opts.force, repoRoot });
      const ok = printInstallResult(result, 'Claude Code');
      if (!ok) anyFailed = true;
    }

    if (forCodex) {
      const result = installCodexAgent({ scope, force: !!opts.force, repoRoot });
      const ok = printInstallResult(result, 'Codex CLI');
      if (!ok) anyFailed = true;
    }

    if (forOpencode) {
      const result = installOpencodeAgent({ scope, force: !!opts.force, repoRoot });
      const ok = printInstallResult(result, 'OpenCode');
      if (!ok) anyFailed = true;
    }

    for (const key of ideKeys) {
      const result = installIdeTarget(key, { scope, force: !!opts.force, repoRoot });
      if (!printInstallResult(result, IDE_TARGETS[key].label)) anyFailed = true;
    }

    if (anyFailed) {
      process.exitCode = 1;
      return;
    }

    console.log('');
    const targets = [
      forCopilot && 'Copilot CLI',
      forClaude && 'Claude Code',
      forCodex && 'Codex CLI',
      forOpencode && 'OpenCode',
      ...ideKeys.map((k) => IDE_TARGETS[k].label),
    ].filter(Boolean);

    if (targets.length === 1) {
      if (forCopilot) {
        console.log('Next: launch Copilot CLI in this repo and run:');
        console.log('  /agent          (then pick "buddy")');
      } else if (forClaude) {
        console.log('Next: launch Claude Code in this repo and run:');
        console.log('  @buddy  (or mention Buddy naturally in your prompt)');
      } else if (forCodex) {
        console.log('Next: launch Codex CLI in this repo — Buddy instructions are in AGENTS.md.');
      } else if (forOpencode) {
        console.log('Next: launch opencode in this repo and press Tab (or use --agent buddy) to switch to Buddy.');
      } else {
        console.log(`Next: ${IDE_TARGETS[ideKeys[0]].next}`);
      }
    } else {
      console.log('Next steps:');
      if (forCopilot) console.log('  Copilot CLI:  /agent  (then pick "buddy")');
      if (forClaude)  console.log('  Claude Code:  @buddy  (or mention Buddy naturally in your prompt)');
      if (forCodex)   console.log('  Codex CLI:    launch codex — Buddy instructions are in AGENTS.md');
      if (forOpencode) console.log('  OpenCode:     launch opencode — press Tab to switch to the "buddy" agent');
      for (const key of ideKeys) console.log(`  ${IDE_TARGETS[key].label}: ${IDE_TARGETS[key].next}`);
    }
    return;
  }

  console.error(`buddy: unknown agent subcommand "${sub}". Use: install [--claude] [--codex] [--opencode] [--cursor] [--vscode] [--antigravity] [--windsurf] [--gemini] [--zed] [--jetbrains] [--junie] [--all] [--user] [--force] | list | path`);
  process.exit(1);
}
