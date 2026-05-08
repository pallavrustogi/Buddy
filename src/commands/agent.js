import { existsSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { agentPromptPath, findRepoRoot } from '../lib/paths.js';

// Install destinations Copilot CLI auto-discovers from:
//   repo:  <repoRoot>/.github/agents/buddy.md
//   user:  ~/.copilot/agents/buddy.md
function destFor(scope, repoRoot) {
  if (scope === 'user') {
    return join(homedir(), '.copilot', 'agents', 'buddy.md');
  }
  return join(repoRoot, '.github', 'agents', 'buddy.md');
}

export function installAgent({ scope = 'repo', force = false, repoRoot } = {}) {
  const src = agentPromptPath();
  if (!existsSync(src)) {
    throw new Error(`agent prompt not found at ${src}`);
  }
  const root = repoRoot || findRepoRoot();
  const dest = destFor(scope, root);
  const destDir = join(dest, '..');
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

  let action = 'created';
  if (existsSync(dest)) {
    if (!force) {
      // Compare contents — if identical, treat as already-installed (idempotent).
      const a = readFileSync(src, 'utf8');
      const b = readFileSync(dest, 'utf8');
      if (a === b) {
        return { dest, scope, action: 'already-installed' };
      }
      return { dest, scope, action: 'exists-different', src };
    }
    action = 'overwritten';
  }
  copyFileSync(src, dest);
  return { dest, scope, action };
}

export async function agentCommand(subcommand, opts = {}) {
  const sub = subcommand || 'install';

  if (sub === 'path') {
    console.log(agentPromptPath());
    return;
  }

  if (sub === 'install') {
    const scope = opts.user ? 'user' : 'repo';
    const result = installAgent({ scope, force: !!opts.force });
    if (result.action === 'already-installed') {
      console.log(`✓ Buddy agent already installed at ${result.dest}`);
    } else if (result.action === 'exists-different') {
      console.log(`! Buddy agent already exists at ${result.dest} (different version).`);
      console.log('  Re-run with --force to overwrite.');
      process.exitCode = 1;
      return;
    } else {
      const verb = result.action === 'overwritten' ? 'Overwrote' : 'Installed';
      console.log(`🤝 ${verb} Buddy agent at ${result.dest}`);
    }
    console.log('');
    console.log('Next: launch Copilot CLI in this repo and run:');
    console.log('  /agent          (then pick "buddy")');
    console.log('Or invoke directly:');
    console.log('  copilot --agent=buddy --prompt "Scan this repo and fill in .buddy/"');
    return;
  }

  console.error(`buddy: unknown agent subcommand "${sub}". Use: install [--user] [--force] | path`);
  process.exit(1);
}
