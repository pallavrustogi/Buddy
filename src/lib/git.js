import { execFileSync } from 'node:child_process';

function runGit(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

export function hasGit(cwd) {
  return runGit(['rev-parse', '--is-inside-work-tree'], cwd) === 'true';
}

export function headCommit(cwd) {
  return runGit(['rev-parse', 'HEAD'], cwd);
}

export function changedFilesSince(commit, cwd) {
  if (!commit) return [];
  const out = runGit(['diff', '--name-status', `${commit}..HEAD`], cwd);
  if (!out) return [];
  return out
    .split('\n')
    .map((line) => {
      const parts = line.split('\t');
      if (parts.length < 2) return null;
      return { status: parts[0].trim(), path: parts.slice(1).join('\t').trim() };
    })
    .filter(Boolean);
}

export function workingTreeChanges(cwd) {
  const out = runGit(['status', '--porcelain'], cwd);
  if (!out) return [];
  return out.split('\n').map((line) => ({
    status: line.slice(0, 2).trim(),
    path: line.slice(3).trim(),
  }));
}
