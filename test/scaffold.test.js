import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copyTree } from '../src/lib/scaffold.js';

function makeTemp() {
  return mkdtempSync(join(tmpdir(), 'buddy-test-'));
}

test('copyTree creates files that do not exist', () => {
  const src = makeTemp();
  const dst = makeTemp();
  try {
    mkdirSync(join(src, 'sub'), { recursive: true });
    writeFileSync(join(src, 'a.md'), 'A');
    writeFileSync(join(src, 'sub', 'b.md'), 'B');

    const { created, skipped } = copyTree(src, dst);
    assert.equal(created.length, 2);
    assert.equal(skipped.length, 0);
    assert.ok(existsSync(join(dst, 'a.md')));
    assert.ok(existsSync(join(dst, 'sub', 'b.md')));
  } finally {
    rmSync(src, { recursive: true, force: true });
    rmSync(dst, { recursive: true, force: true });
  }
});

test('copyTree does NOT overwrite existing files', () => {
  const src = makeTemp();
  const dst = makeTemp();
  try {
    writeFileSync(join(src, 'a.md'), 'NEW');
    writeFileSync(join(dst, 'a.md'), 'KEEP');

    const { created, skipped } = copyTree(src, dst);
    assert.equal(created.length, 0);
    assert.equal(skipped.length, 1);
    assert.equal(readFileSync(join(dst, 'a.md'), 'utf8'), 'KEEP');
  } finally {
    rmSync(src, { recursive: true, force: true });
    rmSync(dst, { recursive: true, force: true });
  }
});
