import { findRepoRoot, buddyDir, isDir } from '../lib/paths.js';
import { readManifest } from '../lib/manifest.js';
import { hasGit, headCommit, changedFilesSince, workingTreeChanges } from '../lib/git.js';

// Heuristics: which doc(s) might be stale based on which files changed.
const RULES = [
  { match: /(^|\/)package\.json$|^requirements\.txt$|^pyproject\.toml$|^go\.mod$|^Cargo\.toml$|^pom\.xml$|^build\.gradle/, doc: 'TECH_STACK.md' },
  { match: /^README\.md$|^docs?\//i, doc: 'README_FOR_HUMANS.md' },
  { match: /^Dockerfile$|docker-compose|\.env|config\//i, doc: 'INTEGRATIONS.md' },
  { match: /^src\//, doc: 'MAP/repo_map.md' },
  { match: /(server|main|index|app|cli)\.(js|ts|py|go|rs|java)$/i, doc: 'MAP/entry_points.md' },
  { match: /(routes?|controllers?|handlers?|api)\//i, doc: 'MAP/data_flow.md' },
  { match: /\.github\/|Makefile|justfile/i, doc: 'GETTING_STARTED.md' },
];

export async function precheckCommand() {
  const repoRoot = findRepoRoot();
  const buddy = buddyDir(repoRoot);

  if (!isDir(buddy)) {
    console.log('❌ No .buddy/ here. Run "buddy init" first.');
    return;
  }
  if (!hasGit(repoRoot)) {
    console.log('⚠️  No git detected — precheck needs git history.');
    return;
  }

  const manifest = readManifest(buddy);
  const last = manifest && manifest.last_indexed_commit;
  if (!last) {
    console.log('💡 No prior index. Ask Buddy to scan this repo first.');
    return;
  }

  const head = headCommit(repoRoot);
  const committed = changedFilesSince(last, repoRoot);
  const working = workingTreeChanges(repoRoot);
  const allPaths = [
    ...committed.map((c) => c.path),
    ...working.map((w) => w.path),
  ];

  console.log(`🔍 Files changed since .buddy was last updated (commit ${last.slice(0, 8)} → ${head.slice(0, 8)}):`);
  if (allPaths.length === 0) {
    console.log('   (none)');
    console.log('\n✅ .buddy/ should still be current.');
    return;
  }
  for (const p of allPaths.slice(0, 30)) console.log(`   ${p}`);
  if (allPaths.length > 30) console.log(`   …and ${allPaths.length - 30} more`);

  const stale = new Set();
  stale.add('CHANGELOG_SUMMARY.md'); // always
  for (const p of allPaths) {
    for (const rule of RULES) {
      if (rule.match.test(p)) stale.add(rule.doc);
    }
  }

  console.log('\nLikely-stale Buddy docs:');
  for (const doc of stale) console.log(`   .buddy/${doc}`);

  console.log('\n💡 In Copilot CLI: ask Buddy "update buddy for my changes".');
}
