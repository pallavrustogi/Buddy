import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderMarkdown, summarize } from '../src/lib/markdown.js';
import { generateTourHtml } from '../src/commands/tour.js';

function makeTemp() {
  return mkdtempSync(join(tmpdir(), 'buddy-tour-'));
}

test('renderMarkdown handles common blocks', () => {
  const md = '# Hi\n\nA **bold** word and `code`.\n\n- one\n- two\n\n```\nx=1\n```\n';
  const html = renderMarkdown(md);
  assert.match(html, /<h1>Hi<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<code>code<\/code>/);
  assert.match(html, /<li>one<\/li>/);
  assert.match(html, /<pre class="code">/);
});

test('renderMarkdown escapes HTML in paragraph text', () => {
  const html = renderMarkdown('hello <script>alert(1)</script>');
  assert.ok(!html.includes('<script>'), 'must not pass raw <script> through');
  assert.match(html, /&lt;script&gt;/);
});

test('summarize extracts first heading and following paragraph', () => {
  const { title, summary } = summarize('# Welcome\n\nThis is the intro.\n\n## More\n');
  assert.equal(title, 'Welcome');
  assert.equal(summary, 'This is the intro.');
});

test('renderMarkdown handles GFM tables (with and without leading pipes)', () => {
  const md1 = '| Area | Pkg |\n|---|---|\n| Web | Foo 1.0 |\n| Auth | Bar 2.0 |\n';
  const html1 = renderMarkdown(md1);
  assert.match(html1, /<table class="md-table">/);
  assert.match(html1, /<th[^>]*>Area<\/th>/);
  assert.match(html1, /<td[^>]*>Foo 1\.0<\/td>/);
  assert.ok(!/\|\s*Area/.test(html1), 'raw pipes should not leak through');

  const md2 = 'Area | Pkg\n---|---\nWeb | Foo 1.0\nAuth | Bar 2.0\n';
  const html2 = renderMarkdown(md2);
  assert.match(html2, /<table class="md-table">/);
  assert.match(html2, /<td[^>]*>Foo 1\.0<\/td>/);
});

test('generateTourHtml builds quiz from real repo facts (not Buddy meta)', () => {
  const repoRoot = makeTemp();
  const buddy = join(repoRoot, '.buddy');
  mkdirSync(join(buddy, 'MAP'), { recursive: true });
  mkdirSync(join(buddy, 'INDEX'), { recursive: true });
  writeFileSync(join(buddy, 'README_FOR_HUMANS.md'), '# Hi\n');
  writeFileSync(join(buddy, 'TECH_STACK.md'),
    '# Stack\n\n- Language: TypeScript\n- Framework: React\n- Build: pnpm\n');
  writeFileSync(join(buddy, 'GETTING_STARTED.md'),
    '# Setup\n\n```bash\npnpm install\npnpm dev\n```\n');
  writeFileSync(join(buddy, 'INTEGRATIONS.md'),
    '# Integrations\n\nWe use PostgreSQL and Redis.\n');
  writeFileSync(join(buddy, 'ARCHITECTURE.md'),
    '# Architecture\n\n## Web Gateway\n\nFronts requests.\n\n## Order Service\n\nProcesses orders.\n');
  writeFileSync(join(buddy, 'MAP', 'repo_map.md'),
    '# Map\n\n- `apps/` - frontends\n- `services/` - backends\n');
  writeFileSync(join(buddy, 'INDEX', 'links.json'), '[]');
  writeFileSync(join(buddy, 'manifest.json'), '{}');

  try {
    const html = generateTourHtml(repoRoot, buddy);
    // Must reference real content extracted from the docs.
    assert.match(html, /TypeScript/);
    assert.match(html, /React/);
    assert.match(html, /pnpm install/);
    assert.match(html, /PostgreSQL/);
    assert.match(html, /Web Gateway/);
    assert.match(html, /apps\//);
    // Must NOT include the old Buddy-meta quiz strings.
    assert.ok(!/Where does Buddy keep all its knowledge/.test(html), 'no Buddy-meta question');
    assert.ok(!/Before you commit a change, which Buddy command/.test(html), 'no Buddy-meta question');
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('generateTourHtml emits TL;DR card, accordion code, and link grid', () => {
  const repoRoot = makeTemp();
  const buddy = join(repoRoot, '.buddy');
  mkdirSync(join(buddy, 'INDEX'), { recursive: true });
  writeFileSync(join(buddy, 'README_FOR_HUMANS.md'), '# Hi\n\nThis is the intro.\n');
  writeFileSync(join(buddy, 'LINKS.md'), '# Links\n');
  writeFileSync(join(buddy, 'INDEX', 'links.json'), JSON.stringify({
    links: [
      { title: 'Runbook', url: 'https://example.com/r', description: 'On-call runbook',
        tags: ['oncall', 'ops'], relevance: 'must-read' },
      { title: 'API Spec', url: 'https://example.com/a', description: '',
        tags: ['api'], relevance: 'helpful' },
    ],
  }));
  writeFileSync(join(buddy, 'manifest.json'), '{}');
  try {
    const html = generateTourHtml(repoRoot, buddy);
    // TL;DR styling class present (replaces old per-section .summary div).
    assert.match(html, /class="tldr"/);
    assert.match(html, /In one line/);
    // Exclusive-accordion logic shipped in the inline script.
    assert.match(html, /accordionizeContent/);
    assert.match(html, /det\.name = groupName/);
    // Links data is inlined and the grid renderer is shipped.
    assert.match(html, /renderLinksGrid/);
    assert.match(html, /Runbook/);
    assert.match(html, /must-read/);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('generateTourHtml includes Starter Tasks section with auto-detected TODOs', () => {
  const repoRoot = makeTemp();
  const buddy = join(repoRoot, '.buddy');
  mkdirSync(buddy, { recursive: true });
  writeFileSync(join(buddy, 'STARTER_TASKS.md'), '# Starter Tasks\n\nTry one of these.\n');
  writeFileSync(join(buddy, 'manifest.json'), '{}');
  // Drop a couple of source files with TODO/FIXME comments.
  writeFileSync(join(repoRoot, 'a.js'), 'function f(){} // TODO: handle edge case for empty input\n');
  writeFileSync(join(repoRoot, 'b.py'), '# FIXME: this is wrong on Mondays\nprint("hi")\n');
  try {
    const html = generateTourHtml(repoRoot, buddy);
    assert.match(html, /Starter Tasks/);
    assert.match(html, /From the code/);
    assert.match(html, /a\.js/);
    assert.match(html, /b\.py/);
    assert.match(html, /handle edge case/);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('generateTourHtml produces a self-contained file with inlined data', () => {
  const repoRoot = makeTemp();
  const buddy = join(repoRoot, '.buddy');
  mkdirSync(join(buddy, 'MAP'), { recursive: true });
  mkdirSync(join(buddy, 'INDEX'), { recursive: true });
  mkdirSync(join(buddy, 'NOTES'), { recursive: true });
  writeFileSync(
    join(buddy, 'README_FOR_HUMANS.md'),
    '# Hello\n\nThis project does X.\n\nGo to [setup](./GETTING_STARTED.md) or [map](MAP/repo_map.md) or [external](https://example.com) or [unknown](./does-not-exist.md).\n'
  );
  writeFileSync(join(buddy, 'GETTING_STARTED.md'), '# Setup\n\nRun it.\n');
  writeFileSync(join(buddy, 'MAP', 'repo_map.md'), '# Map\n');
  writeFileSync(join(buddy, 'TECH_STACK.md'), '# Stack\n\n- Node 18+\n');
  writeFileSync(join(buddy, 'manifest.json'), JSON.stringify({ last_indexed_commit: 'abcdef1234' }));
  writeFileSync(join(buddy, 'INDEX', 'links.json'), '[]');

  try {
    const html = generateTourHtml(repoRoot, buddy);
    assert.match(html, /<!doctype html>/i);
    assert.match(html, /Buddy Tour/);
    assert.match(html, /id="buddy-data"/);
    assert.ok(!/fetch\s*\(/.test(html), 'tour should not use fetch() at runtime');
    assert.match(html, /This project does X\./);
    assert.match(html, /Node 18\+/);
    assert.ok(!html.includes('</script><script>'));

    // Intra-.buddy/ links should be rewritten to in-tour anchors (JSON-escaped).
    assert.match(html, /href=\\"#getting\\"/);
    assert.match(html, /href=\\"#map\\"/);
    // External links should pass through unchanged.
    assert.match(html, /href=\\"https:\/\/example.com\\"/);
    // Unknown intra-doc links should be stripped (no link, plain text remains).
    assert.ok(!/does-not-exist\.md/.test(html), 'unknown .md links must be stripped');
    assert.match(html, /unknown/);
    // No raw .md href should remain anywhere in the inlined section html.
    assert.ok(!/href=\\"[^"]+\.md/i.test(html), 'no raw .md href should remain');
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
