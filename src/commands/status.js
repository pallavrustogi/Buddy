import { findRepoRoot, buddyDir, isDir } from '../lib/paths.js';
import { readManifest } from '../lib/manifest.js';
import { hasGit, headCommit, changedFilesSince } from '../lib/git.js';

export async function statusCommand() {
  const repoRoot = findRepoRoot();
  const buddy = buddyDir(repoRoot);

  if (!isDir(buddy)) {
    console.log('❌ No .buddy/ in this repo. Run "buddy init".');
    return;
  }

  const manifest = readManifest(buddy);
  if (!manifest) {
    console.log('⚠️  .buddy/ exists but manifest.json is missing or unreadable.');
    return;
  }

  console.log(`📦 Buddy at ${buddy}`);
  console.log(`   Last run:           ${manifest.last_run_timestamp || '(never)'}`);
  console.log(`   Last indexed commit: ${manifest.last_indexed_commit || '(none)'}`);

  if (!hasGit(repoRoot)) {
    console.log('   (No git in this repo — skipping diff.)');
    return;
  }

  const head = headCommit(repoRoot);
  console.log(`   Current HEAD:        ${head ? head.slice(0, 8) : '(unknown)'}`);

  if (!manifest.last_indexed_commit) {
    console.log('\n💡 Buddy has never indexed this repo. Ask Buddy in Copilot CLI: "scan this repo".');
    return;
  }

  if (head === manifest.last_indexed_commit) {
    console.log('\n✅ .buddy/ is current with HEAD.');
    return;
  }

  const changes = changedFilesSince(manifest.last_indexed_commit, repoRoot);
  console.log(`\n🔍 ${changes.length} file(s) changed since last index:`);
  for (const c of changes.slice(0, 20)) {
    console.log(`   ${c.status}  ${c.path}`);
  }
  if (changes.length > 20) console.log(`   …and ${changes.length - 20} more`);
  console.log('\n💡 In Copilot CLI: ask Buddy "update buddy for my changes".');
}
