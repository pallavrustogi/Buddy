import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { findRepoRoot, buddyDir, isDir } from '../lib/paths.js';
import { openFile } from '../lib/opener.js';

const ALIASES = {
  home: 'README_FOR_HUMANS.md',
  readme: 'README_FOR_HUMANS.md',
  'getting-started': 'GETTING_STARTED.md',
  setup: 'GETTING_STARTED.md',
  architecture: 'ARCHITECTURE.md',
  arch: 'ARCHITECTURE.md',
  stack: 'TECH_STACK.md',
  'tech-stack': 'TECH_STACK.md',
  integrations: 'INTEGRATIONS.md',
  changelog: 'CHANGELOG_SUMMARY.md',
  links: 'LINKS.md',
  map: 'MAP/repo_map.md',
  entry: 'MAP/entry_points.md',
  'entry-points': 'MAP/entry_points.md',
  flow: 'MAP/data_flow.md',
  'data-flow': 'MAP/data_flow.md',
  questions: 'NOTES/open_questions.md',
  assumptions: 'NOTES/assumptions.md',
};

export async function openCommand(doc, opts) {
  const repoRoot = findRepoRoot();
  const buddy = buddyDir(repoRoot);

  if (!isDir(buddy)) {
    console.error(`buddy: no .buddy/ found at ${buddy}`);
    console.error('  Run "buddy init" first.');
    process.exit(1);
  }

  const target = doc ? resolveDoc(doc) : 'README_FOR_HUMANS.md';
  const filePath = join(buddy, target);

  if (!existsSync(filePath)) {
    console.error(`buddy: not found in .buddy/ — ${target}`);
    process.exit(1);
  }

  if (opts.open === false) {
    console.log(filePath);
    return;
  }

  const result = openFile(filePath, { silent: true });
  if (result.opened) {
    console.log(`📖 Opened ${target}`);
  } else {
    console.log(filePath);
    if (result.reason && result.reason !== 'BUDDY_NO_OPEN=1') {
      console.log(`(Could not auto-open: ${result.reason})`);
    }
  }
}

function resolveDoc(name) {
  const key = name.toLowerCase().replace(/\.md$/, '');
  if (ALIASES[key]) return ALIASES[key];
  // Allow direct path inside .buddy/
  return name;
}
