import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { findRepoRoot, buddyDir, templatesDir, isDir } from '../lib/paths.js';
import { copyTree } from '../lib/scaffold.js';
import { readManifest, writeManifest, defaultManifest } from '../lib/manifest.js';
import { hasGit, headCommit } from '../lib/git.js';
import { openFile } from '../lib/opener.js';
import { installAgent, installClaudeAgent, installCodexAgent, installOpencodeAgent, installIdeTarget, IDE_TARGETS } from './agent.js';
import { generateTourHtml } from './tour.js';
import { writeFileSync } from 'node:fs';

function regenerateTour(repoRoot, buddy) {
  try {
    const tourHtml = generateTourHtml(repoRoot, buddy);
    writeFileSync(join(buddy, 'tour.html'), tourHtml, 'utf8');
    console.log(`🎮 Interactive tour: ${join(buddy, 'tour.html')}`);
  } catch (err) {
    console.log(`! Could not generate tour: ${err.message}`);
  }
}

export async function initCommand(opts) {
  const repoRoot = findRepoRoot();
  const buddy = buddyDir(repoRoot);
  const homePage = join(buddy, 'tour.html');
  const alreadyExisted = isDir(buddy);

  if (alreadyExisted && !opts.force) {
    console.log(`✓ .buddy/ already exists at ${buddy}`);
    console.log('  Treating it as the source of truth. Nothing to scaffold.');
    maybeInstallAgent(repoRoot, opts);
    regenerateTour(repoRoot, buddy);
    autoOpenHome(homePage, opts);
    return;
  }

  if (!isDir(buddy)) mkdirSync(buddy, { recursive: true });

  const { created, skipped } = copyTree(templatesDir(), buddy);

  const manifest = readManifest(buddy) || defaultManifest();
  manifest.last_run_timestamp = new Date().toISOString();
  if (hasGit(repoRoot)) {
    manifest.last_indexed_commit = headCommit(repoRoot);
  }
  manifest.key_outputs_updated = ['init'];
  writeManifest(buddy, manifest);

  console.log(`🎉 Buddy initialized at ${buddy}`);
  console.log(`   Files created: ${created.length}, skipped (already present): ${skipped.length}`);
  if (manifest.last_indexed_commit) {
    console.log(`   Indexed commit: ${manifest.last_indexed_commit.slice(0, 8)}`);
  } else {
    console.log('   (No git repo detected — fine. Buddy will fall back to file mtimes.)');
  }

  maybeInstallAgent(repoRoot, opts);

  regenerateTour(repoRoot, buddy);

  console.log('');
  console.log('Next steps:');
  console.log('  Copilot CLI:  /agent  →  pick "buddy"  →  "Scan this repo and fill in .buddy/"');
  console.log('  Claude Code:  @buddy  →  "Scan this repo and fill in .buddy/"');
  console.log('  Codex CLI:    launch codex  →  Buddy instructions are in AGENTS.md');
  console.log('  OpenCode:     launch opencode  →  press Tab to switch to the "buddy" agent');
  for (const t of Object.values(IDE_TARGETS)) console.log(`  ${t.label}: ${t.next}`);

  autoOpenHome(homePage, opts);
}

function maybeInstallAgent(repoRoot, opts) {
  if (opts.installAgent === false) return;
  const scope = opts.userAgent ? 'user' : 'repo';

  // Install for Copilot CLI
  try {
    const result = installAgent({ scope, repoRoot });
    if (result.action === 'already-installed') {
      console.log(`✓ Copilot CLI agent already installed at ${result.dest}`);
    } else if (result.action === 'exists-different') {
      console.log(`! Copilot CLI agent at ${result.dest} differs — run "buddy agent install --force" to update.`);
    } else {
      console.log(`🤝 Installed Copilot CLI agent at ${result.dest}`);
    }
  } catch (err) {
    console.log(`! Could not install Copilot CLI agent: ${err.message}`);
  }

  // Install for Claude Code
  try {
    const result = installClaudeAgent({ scope, repoRoot });
    if (result.action === 'already-installed') {
      console.log(`✓ Claude Code agent already installed at ${result.dest}`);
    } else if (result.action === 'exists-different') {
      console.log(`! Claude Code agent at ${result.dest} differs — run "buddy agent install --claude --force" to update.`);
    } else {
      console.log(`🤝 Installed Claude Code agent at ${result.dest}`);
    }
  } catch (err) {
    console.log(`! Could not install Claude Code agent: ${err.message}`);
  }

  // Install for Codex CLI
  try {
    const result = installCodexAgent({ scope, repoRoot });
    if (result.action === 'already-installed') {
      console.log(`✓ Codex CLI agent already installed at ${result.dest}`);
    } else if (result.action === 'exists-different') {
      console.log(`! Codex CLI agent at ${result.dest} differs — run "buddy agent install --codex --force" to update.`);
    } else {
      console.log(`🤝 Installed Codex CLI agent at ${result.dest}`);
    }
  } catch (err) {
    console.log(`! Could not install Codex CLI agent: ${err.message}`);
  }

  // Install for OpenCode
  try {
    const result = installOpencodeAgent({ scope, repoRoot });
    if (result.action === 'already-installed') {
      console.log(`✓ OpenCode agent already installed at ${result.dest}`);
    } else if (result.action === 'exists-different') {
      console.log(`! OpenCode agent at ${result.dest} differs — run "buddy agent install --opencode --force" to update.`);
    } else {
      console.log(`🤝 Installed OpenCode agent at ${result.dest}`);
    }
  } catch (err) {
    console.log(`! Could not install OpenCode agent: ${err.message}`);
  }

  // Editor/IDE targets mostly have no user scope; installIdeTarget reports that.
  for (const [key, t] of Object.entries(IDE_TARGETS)) {
    try {
      const result = installIdeTarget(key, { scope, repoRoot });
      if (result.action === 'unsupported-scope') continue;
      if (result.action === 'already-installed') {
        console.log(`✓ ${t.label} agent already installed at ${result.dest}`);
      } else if (result.action === 'exists-different') {
        console.log(`! ${t.label} agent at ${result.dest} differs — run "buddy agent install ${t.flag} --force" to update.`);
      } else {
        console.log(`🤝 Installed ${t.label} agent at ${result.dest}`);
      }
    } catch (err) {
      console.log(`! Could not install ${t.label} agent: ${err.message}`);
    }
  }
}

function autoOpenHome(homePage, opts) {
  if (opts.open === false) {
    console.log(`\n🎮 Interactive tour: ${homePage}`);
    return;
  }
  const result = openFile(homePage, { silent: true });
  if (result.opened) {
    console.log(`\n🎮 Opened interactive tour: ${homePage}`);
  } else {
    console.log(`\n🎮 Interactive tour: ${homePage}`);
    if (result.reason && result.reason !== 'BUDDY_NO_OPEN=1') {
      console.log(`   (Could not auto-open: ${result.reason})`);
    }
  }
}
