import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Walk upward from cwd looking for a repo root signal (.git or .buddy or package.json).
// Falls back to cwd if nothing is found.
export function findRepoRoot(start = process.cwd()) {
  let dir = resolve(start);
  while (true) {
    if (
      existsSync(join(dir, '.git')) ||
      existsSync(join(dir, '.buddy')) ||
      existsSync(join(dir, 'package.json'))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return resolve(start);
    dir = parent;
  }
}

export function buddyDir(repoRoot = findRepoRoot()) {
  return join(repoRoot, '.buddy');
}

export function packageRoot() {
  return resolve(__dirname, '..', '..');
}

export function templatesDir() {
  return join(packageRoot(), 'templates', '.buddy');
}

export function agentPromptPath() {
  return join(packageRoot(), 'agents', 'buddy.agent.md');
}

export function claudeAgentPromptPath() {
  return join(packageRoot(), 'agents', 'buddy-claude.agent.md');
}

export function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}
