import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { findRepoRoot, buddyDir, isDir } from '../lib/paths.js';
import { redactUrl } from '../lib/redact.js';
import { readManifest, writeManifest, defaultManifest } from '../lib/manifest.js';

export async function linkCommand(rawUrl, opts) {
  const repoRoot = findRepoRoot();
  const buddy = buddyDir(repoRoot);

  if (!isDir(buddy)) {
    console.error('buddy: no .buddy/ here. Run "buddy init" first.');
    process.exit(1);
  }

  const { url, redacted, warnings } = redactUrl(rawUrl);
  for (const w of warnings) console.log(`⚠️  ${w}`);

  const entry = {
    title: opts.title || inferTitle(url),
    url,
    description: opts.desc || '',
    tags: (opts.tags || '').split(',').map((s) => s.trim()).filter(Boolean),
    relevance: opts.relevance || 'helpful',
    added_by: process.env.USER || process.env.USERNAME || 'unknown',
    added_at: new Date().toISOString(),
    redacted,
  };

  // Update INDEX/links.json
  const linksJsonPath = join(buddy, 'INDEX', 'links.json');
  const existing = existsSync(linksJsonPath)
    ? safeJson(readFileSync(linksJsonPath, 'utf8'), { links: [] })
    : { links: [] };
  existing.links.push(entry);
  writeFileSync(linksJsonPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');

  // Append to LINKS.md (human-friendly)
  const linksMd = join(buddy, 'LINKS.md');
  const block =
    `\n### ${entry.title}\n` +
    `- **URL:** ${entry.url}\n` +
    `- **Why it matters:** ${entry.description || '(add a short note)'}\n` +
    `- **Tags:** ${entry.tags.join(', ') || '(none)'}\n` +
    `- **Relevance:** ${entry.relevance}\n` +
    `- **Added:** ${entry.added_at} by ${entry.added_by}\n`;
  appendFileSync(linksMd, block, 'utf8');

  // Update manifest timestamp
  const manifest = readManifest(buddy) || defaultManifest();
  manifest.last_link_update_timestamp = entry.added_at;
  writeManifest(buddy, manifest);

  console.log(`📎 Saved link: ${entry.title}`);
  console.log(`   ${entry.url}`);
  console.log('   (Note: Buddy stores link metadata only — it has not read the linked page.)');
}

function safeJson(text, fallback) {
  try { return JSON.parse(text); } catch { return fallback; }
}

function inferTitle(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.replace(/\/$/, '') || u.hostname;
  } catch {
    return url.slice(0, 60);
  }
}
