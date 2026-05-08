import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Recursively copy a template directory tree without overwriting existing files.
// Returns { created: string[], skipped: string[] }.
export function copyTree(srcDir, dstDir) {
  const created = [];
  const skipped = [];
  walk(srcDir, dstDir, created, skipped);
  return { created, skipped };
}

function walk(src, dst, created, skipped) {
  if (!existsSync(dst)) {
    mkdirSync(dst, { recursive: true });
  }
  for (const entry of readdirSync(src)) {
    const s = join(src, entry);
    const d = join(dst, entry);
    if (statSync(s).isDirectory()) {
      walk(s, d, created, skipped);
    } else {
      if (existsSync(d)) {
        skipped.push(d);
      } else {
        copyFileSync(s, d);
        created.push(d);
      }
    }
  }
}
