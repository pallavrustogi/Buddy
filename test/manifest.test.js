import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readManifest, writeManifest, defaultManifest } from '../src/lib/manifest.js';

test('defaultManifest has expected shape', () => {
  const m = defaultManifest();
  assert.equal(m.schema_version, 1);
  assert.equal(m.last_indexed_commit, null);
  assert.ok(typeof m.last_run_timestamp === 'string');
  assert.ok(Array.isArray(m.key_outputs_updated));
});

test('readManifest returns null when file missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'buddy-manifest-'));
  try {
    assert.equal(readManifest(dir), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeManifest then readManifest round-trips', () => {
  const dir = mkdtempSync(join(tmpdir(), 'buddy-manifest-'));
  try {
    const m = defaultManifest();
    m.last_indexed_commit = 'abc123';
    writeManifest(dir, m);
    const back = readManifest(dir);
    assert.equal(back.last_indexed_commit, 'abc123');
    assert.equal(back.schema_version, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
