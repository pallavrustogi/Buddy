import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function manifestPath(buddyRoot) {
  return join(buddyRoot, 'manifest.json');
}

export function readManifest(buddyRoot) {
  const p = manifestPath(buddyRoot);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export function writeManifest(buddyRoot, manifest) {
  const p = manifestPath(buddyRoot);
  writeFileSync(p, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

export function defaultManifest() {
  return {
    schema_version: 1,
    last_indexed_commit: null,
    last_run_timestamp: new Date().toISOString(),
    files_scanned_count: 0,
    key_outputs_updated: [],
    last_link_update_timestamp: null,
  };
}
