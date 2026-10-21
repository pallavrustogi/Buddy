import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installCursorAgent, installVscodeAgent, installAntigravityAgent, installIdeTarget, IDE_TARGETS } from '../src/commands/agent.js';

function tmpRepo() {
  return mkdtempSync(join(tmpdir(), 'buddy-ide-'));
}

test('cursor install writes .mdc with rule frontmatter', () => {
  const repoRoot = tmpRepo();
  const r = installCursorAgent({ repoRoot });
  assert.equal(r.action, 'created');
  assert.equal(r.dest, join(repoRoot, '.cursor', 'rules', 'buddy.mdc'));
  const text = readFileSync(r.dest, 'utf8');
  assert.match(text, /^---\ndescription: .+\nalwaysApply: false\n---\n/);
  assert.match(text, /You are \*\*Buddy\*\*/);
});

test('vscode install writes .agent.md with name frontmatter', () => {
  const repoRoot = tmpRepo();
  const r = installVscodeAgent({ repoRoot });
  assert.equal(r.dest, join(repoRoot, '.github', 'agents', 'buddy.agent.md'));
  assert.match(readFileSync(r.dest, 'utf8'), /^---\nname: buddy\n/);
});

test('antigravity install writes plain markdown rule', () => {
  const repoRoot = tmpRepo();
  const r = installAntigravityAgent({ repoRoot });
  assert.equal(r.dest, join(repoRoot, '.agents', 'rules', 'buddy.md'));
  assert.match(readFileSync(r.dest, 'utf8'), /^# Buddy/);
});

test('reinstall is idempotent; changed file needs --force', () => {
  const repoRoot = tmpRepo();
  installCursorAgent({ repoRoot });
  assert.equal(installCursorAgent({ repoRoot }).action, 'already-installed');
  const dest = join(repoRoot, '.cursor', 'rules', 'buddy.mdc');
  writeFileSync(dest, 'edited');
  assert.equal(installCursorAgent({ repoRoot }).action, 'exists-different');
  assert.equal(readFileSync(dest, 'utf8'), 'edited');
  assert.equal(installCursorAgent({ repoRoot, force: true }).action, 'overwritten');
});

test('every IDE target installs the Buddy body at its repo path', () => {
  for (const [key, t] of Object.entries(IDE_TARGETS)) {
    const repoRoot = tmpRepo();
    const r = installIdeTarget(key, { repoRoot });
    assert.equal(r.action, 'created', key);
    assert.equal(r.dest, t.repo(repoRoot), key);
    assert.match(readFileSync(r.dest, 'utf8'), /You are \*\*Buddy\*\*/, key);
  }
});

test('windsurf rule uses model_decision trigger', () => {
  const repoRoot = tmpRepo();
  const r = installIdeTarget('windsurf', { repoRoot });
  assert.match(readFileSync(r.dest, 'utf8'), /^---\ntrigger: model_decision\ndescription: /);
});

test('expected paths for gemini, zed, jetbrains, junie', () => {
  const repoRoot = tmpRepo();
  assert.equal(IDE_TARGETS.gemini.repo(repoRoot), join(repoRoot, 'GEMINI.md'));
  assert.equal(IDE_TARGETS.zed.repo(repoRoot), join(repoRoot, '.rules'));
  assert.equal(IDE_TARGETS.jetbrains.repo(repoRoot), join(repoRoot, '.aiassistant', 'rules', 'buddy.md'));
  assert.equal(IDE_TARGETS.junie.repo(repoRoot), join(repoRoot, '.junie', 'AGENTS.md'));
});

test('user scope is skipped for targets without a user-level location', () => {
  const repoRoot = tmpRepo();
  for (const [key, t] of Object.entries(IDE_TARGETS)) {
    if (t.user) continue; // gemini has ~/.gemini/GEMINI.md; don't touch the real home dir in tests
    assert.equal(installIdeTarget(key, { scope: 'user', repoRoot }).action, 'unsupported-scope', key);
  }
  assert.equal(existsSync(join(repoRoot, '.cursor')), false);
});
