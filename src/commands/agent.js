import { existsSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { agentPromptPath, claudeAgentPromptPath, findRepoRoot } from '../lib/paths.js';

// Install destinations auto-discovered by each CLI:
//   Copilot CLI repo:  <repoRoot>/.github/agents/buddy.md
//   Copilot CLI user:  ~/.copilot/agents/buddy.md
//   Claude Code repo:  <repoRoot>/.claude/agents/buddy.md
//   Claude Code user:  ~/.claude/agents/buddy.md

function destForCopilot(scope, repoRoot) {
  if (scope === 'user') return join(homedir(), '.copilot', 'agents', 'buddy.md');
  return join(repoRoot, '.github', 'agents', 'buddy.md');
}

function destForClaude(scope, repoRoot) {
  if (scope === 'user') return join(homedir(), '.claude', 'agents', 'buddy.md');
  return join(repoRoot, '.claude', 'agents', 'buddy.md');
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

function printInstallResult(result, label) {
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
    return;
  }

  if (sub === 'list') {
    listAgents(repoRoot);
    return;
  }

  if (sub === 'install') {
    const forClaude = opts.claude || opts.all;
    const forCopilot = !opts.claude || opts.all;
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

    if (anyFailed) {
      process.exitCode = 1;
      return;
    }

    console.log('');
    if (forCopilot && !forClaude) {
      console.log('Next: launch Copilot CLI in this repo and run:');
      console.log('  /agent          (then pick "buddy")');
    } else if (forClaude && !forCopilot) {
      console.log('Next: launch Claude Code in this repo and run:');
      console.log('  @buddy  (or mention Buddy naturally in your prompt)');
    } else {
      console.log('Next steps:');
      console.log('  Copilot CLI:  /agent  (then pick "buddy")');
      console.log('  Claude Code:  @buddy  (or mention Buddy naturally in your prompt)');
    }
    return;
  }

  console.error(`buddy: unknown agent subcommand "${sub}". Use: install [--claude] [--all] [--user] [--force] | list | path`);
  process.exit(1);
}
