import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { findRepoRoot, buddyDir, templatesDir, isDir } from '../lib/paths.js';
import { copyTree } from '../lib/scaffold.js';
import { readManifest, writeManifest, defaultManifest } from '../lib/manifest.js';
import { hasGit, headCommit } from '../lib/git.js';
import { openFile } from '../lib/opener.js';
import { installAgent } from './agent.js';

export async function initCommand(opts) {
  const repoRoot = findRepoRoot();
  const buddy = buddyDir(repoRoot);
  const homePage = join(buddy, 'README_FOR_HUMANS.md');
  const alreadyExisted = isDir(buddy);

  if (alreadyExisted && !opts.force) {
    console.log(`✓ .buddy/ already exists at ${buddy}`);
    console.log('  Treating it as the source of truth. Nothing to scaffold.');
    maybeInstallAgent(repoRoot, opts);
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

  console.log('');
  console.log('Next steps:');
  console.log('  1. Launch Copilot CLI in this repo:  copilot');
  console.log('  2. Run:  /agent          (then pick "buddy")');
  console.log('  3. Ask Buddy: "Scan this repo and fill in .buddy/"');

  autoOpenHome(homePage, opts);
}

function maybeInstallAgent(repoRoot, opts) {
  if (opts.installAgent === false) return;
  const scope = opts.userAgent ? 'user' : 'repo';
  try {
    const result = installAgent({ scope, repoRoot });
    if (result.action === 'already-installed') {
      console.log(`✓ Buddy agent already installed at ${result.dest}`);
    } else if (result.action === 'exists-different') {
      console.log(`! Buddy agent at ${result.dest} differs from the packaged version.`);
      console.log('  Run "buddy agent install --force" to update it.');
    } else {
      console.log(`🤝 Installed Buddy agent at ${result.dest}`);
    }
  } catch (err) {
    console.log(`! Could not install Buddy agent: ${err.message}`);
  }
}

function autoOpenHome(homePage, opts) {
  if (opts.open === false) {
    console.log(`\n📖 Home page: ${homePage}`);
    return;
  }
  const result = openFile(homePage, { silent: true });
  if (result.opened) {
    console.log(`\n📖 Opened home page: ${homePage}`);
  } else {
    console.log(`\n📖 Home page: ${homePage}`);
    if (result.reason && result.reason !== 'BUDDY_NO_OPEN=1') {
      console.log(`   (Could not auto-open: ${result.reason})`);
    }
  }
}
