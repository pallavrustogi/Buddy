import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, relative } from 'node:path';
import { findRepoRoot, buddyDir, isDir, isFile } from '../lib/paths.js';
import { renderMarkdown, summarize, esc } from '../lib/markdown.js';
import { openFile } from '../lib/opener.js';

// Map .buddy/ files into tour sections. Order = step order in the journey.
const SECTIONS = [
  { id: 'welcome',       icon: '👋', title: 'Welcome',           file: 'README_FOR_HUMANS.md' },
  { id: 'tech',          icon: '🧰', title: 'Tech Stack',        file: 'TECH_STACK.md' },
  { id: 'map',           icon: '🗺️', title: 'Repo Map',          file: 'MAP/repo_map.md' },
  { id: 'entry',         icon: '🚪', title: 'Entry Points',      file: 'MAP/entry_points.md' },
  { id: 'flow',          icon: '🔁', title: 'Data Flow',         file: 'MAP/data_flow.md' },
  { id: 'getting',       icon: '🚀', title: 'Get It Running',    file: 'GETTING_STARTED.md' },
  { id: 'architecture',  icon: '🏛️', title: 'Architecture',      file: 'ARCHITECTURE.md' },
  { id: 'integrations',  icon: '🔌', title: 'Integrations',      file: 'INTEGRATIONS.md' },
  { id: 'links',         icon: '🔗', title: 'Curated Links',     file: 'LINKS.md' },
  { id: 'changelog',     icon: '📜', title: 'Recent Changes',    file: 'CHANGELOG_SUMMARY.md' },
  { id: 'starter',       icon: '🎯', title: 'Starter Tasks',     file: 'STARTER_TASKS.md' },
  { id: 'questions',     icon: '❓', title: 'Open Questions',    file: 'NOTES/open_questions.md' },
];

function readIfExists(p) {
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

function readJsonIfExists(p) {
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function buildSections(buddy) {
  // Map every known .md path to the section that hosts it.
  const fileToSection = new Map();
  SECTIONS.forEach((s) => {
    const norm = s.file.replace(/\\/g, '/').toLowerCase();
    fileToSection.set(norm, s.id);
    fileToSection.set(norm.split('/').pop(), s.id); // basename fallback
  });

  function rewriteLinks(html) {
    return html.replace(/<a href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g, (m, href, attrs, label) => {
      // External and anchor links pass through unchanged.
      if (/^(https?:|mailto:|#)/i.test(href)) return m;
      // Strip leading ./ and any .buddy/ prefix.
      let target = href.replace(/^\.\//, '').replace(/^\.buddy\//i, '');
      const noAnchor = target.split('#')[0].toLowerCase();
      const sectionId = fileToSection.get(noAnchor) || fileToSection.get(noAnchor.split('/').pop());
      if (sectionId) {
        return '<a href="#' + sectionId + '" data-tour-link="1">' + label + '</a>';
      }
      // Unknown intra-doc link — render as plain text so it can't break.
      return label;
    });
  }

  return SECTIONS.map((s) => {
    const md = readIfExists(join(buddy, s.file));
    let html = rewriteLinks(renderMarkdown(md));
    const meta = summarize(md);
    if (s.id === 'starter') {
      // Auto-scan the repo for TODO/FIXME comments and append as an extra
      // "## From the code" section so the page is always fresh.
      const repoRoot = join(buddy, '..');
      const todos = scanTodos(repoRoot, 30);
      if (todos.length) {
        const items = todos.map((t) =>
          '<li><code>' + esc(t.file) + ':' + t.line + '</code> — ' + esc(t.text) + '</li>'
        ).join('');
        html += '<h2>From the code (' + todos.length + ')</h2>'
          + '<p>Buddy found these <code>TODO</code> / <code>FIXME</code> notes. Each is a tiny invitation to ship a small PR:</p>'
          + '<ul>' + items + '</ul>';
      } else {
        html += '<h2>From the code</h2>'
          + '<p>No <code>TODO</code> / <code>FIXME</code> comments found. Nice and tidy! Pick a warm-up task above instead.</p>';
      }
    }
    return {
      id: s.id, icon: s.icon, title: s.title, source: s.file,
      hasContent: Boolean(md.trim()),
      summary: meta.summary || '',
      html,
    };
  });
}

// Scan the repo for TODO/FIXME comments. Returns at most `limit` hits.
// Skips heavy/irrelevant directories so this stays fast on big repos.
function scanTodos(root, limit) {
  const SKIP = new Set([
    'node_modules', '.git', '.buddy', 'dist', 'build', 'out', 'bin', 'obj',
    'target', 'vendor', '.next', '.nuxt', 'coverage', '.venv', 'venv',
    '__pycache__', '.idea', '.vscode',
  ]);
  const CODE_EXT = /\.(js|jsx|ts|tsx|mjs|cjs|py|go|rs|java|cs|rb|php|c|cc|cpp|h|hpp|kt|swift|scala|m|sh|ps1|yaml|yml)$/i;
  const PATTERN = /\b(?:TODO|FIXME|HACK|XXX)\b[:\s]*(.{0,140})/;
  const out = [];
  function walk(dir) {
    if (out.length >= limit) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (out.length >= limit) return;
      if (e.name.startsWith('.') && e.name !== '.') {
        if (SKIP.has(e.name)) continue;
      }
      if (SKIP.has(e.name)) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile() && CODE_EXT.test(e.name)) {
        try {
          const st = statSync(full);
          if (st.size > 512 * 1024) continue; // skip files > 512KB
          const txt = readFileSync(full, 'utf8');
          const lines = txt.split(/\r?\n/);
          for (let i = 0; i < lines.length; i++) {
            const m = lines[i].match(PATTERN);
            if (m) {
              out.push({
                file: relative(root, full).replace(/\\/g, '/'),
                line: i + 1,
                text: (m[0] || '').trim(),
              });
              if (out.length >= limit) return;
            }
          }
        } catch { /* ignore unreadable files */ }
      }
    }
  }
  walk(root);
  return out;
}

// Pools of common technologies used as quiz distractors.
const POOL_LANGS = ['JavaScript','TypeScript','Python','Go','Rust','C#','Java','Ruby','PHP','C++','Kotlin','Swift'];
const POOL_FRAMEWORKS = ['React','Vue','Angular','Express','Django','Flask','Spring Boot','Rails','ASP.NET Core','Next.js','Svelte','FastAPI','NestJS'];
const POOL_BUILD = ['npm','yarn','pnpm','maven','gradle','cargo','pip','poetry','dotnet','make','bazel'];
const POOL_INTEGRATIONS = ['Redis','PostgreSQL','MySQL','MongoDB','Kafka','RabbitMQ','Azure Blob Storage','AWS S3','Elasticsearch','Stripe','Twilio','Auth0','Cosmos DB','SQL Server'];

function pickDistinct(pool, n, exclude = []) {
  const ex = new Set(exclude.map((s) => s.toLowerCase()));
  const remaining = pool.filter((p) => !ex.has(p.toLowerCase()));
  const out = [];
  while (out.length < n && remaining.length) {
    const i = Math.floor(Math.random() * remaining.length);
    out.push(remaining.splice(i, 1)[0]);
  }
  return out;
}

function shuffleWithAnswer(correct, distractors) {
  const choices = [correct, ...distractors];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { choices, answer: choices.indexOf(correct) };
}

function findFromPool(text, pool) {
  if (!text) return [];
  const lower = text.toLowerCase();
  return pool.filter((p) => lower.includes(p.toLowerCase()));
}

function firstCommandFromCodeBlock(md) {
  if (!md) return '';
  const m = md.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  if (!m) return '';
  for (const line of m[1].split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('//')) continue;
    return t.replace(/^\$\s*/, '').slice(0, 80);
  }
  return '';
}

function extractFolderNames(md) {
  if (!md) return [];
  const set = new Set();
  // Match `name/` patterns inside backticks and table cells.
  for (const m of md.matchAll(/`([a-zA-Z0-9_.\-]+\/)`/g)) set.add(m[1]);
  for (const m of md.matchAll(/^\s*[-*]\s+`?([a-zA-Z0-9_.\-]+\/)`?/gm)) set.add(m[1]);
  return [...set].filter((f) => f.length <= 40);
}

function extractH2Titles(md) {
  if (!md) return [];
  return [...(md || '').matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim()).filter((t) => t.length <= 60);
}

function buildQuiz(buddy) {
  const read = (rel) => {
    try { return readFileSync(join(buddy, rel), 'utf8'); } catch { return ''; }
  };
  const tech = read('TECH_STACK.md');
  const getting = read('GETTING_STARTED.md');
  const arch = read('ARCHITECTURE.md');
  const integrations = read('INTEGRATIONS.md');
  const repoMap = read('MAP/repo_map.md');

  const q = [];

  // 1. Language used in the repo (from TECH_STACK).
  const langs = findFromPool(tech, POOL_LANGS);
  if (langs.length) {
    const correct = langs[0];
    const { choices, answer } = shuffleWithAnswer(correct, pickDistinct(POOL_LANGS, 3, langs));
    q.push({ q: `Which language is used in this repo?`, choices, answer });
  }

  // 2. Framework used.
  const fws = findFromPool(tech + '\n' + arch, POOL_FRAMEWORKS);
  if (fws.length) {
    const correct = fws[0];
    const { choices, answer } = shuffleWithAnswer(correct, pickDistinct(POOL_FRAMEWORKS, 3, fws));
    q.push({ q: `Which framework does this repo use?`, choices, answer });
  }

  // 3. Build / package tool.
  const builds = findFromPool(tech + '\n' + getting, POOL_BUILD);
  if (builds.length) {
    const correct = builds[0];
    const { choices, answer } = shuffleWithAnswer(correct, pickDistinct(POOL_BUILD, 3, builds));
    q.push({ q: `Which build or package tool is used here?`, choices, answer });
  }

  // 4. External integration this repo talks to.
  const ints = findFromPool(integrations + '\n' + tech, POOL_INTEGRATIONS);
  if (ints.length) {
    const correct = ints[0];
    const { choices, answer } = shuffleWithAnswer(correct, pickDistinct(POOL_INTEGRATIONS, 3, ints));
    q.push({ q: `Which external service or datastore does this repo integrate with?`, choices, answer });
  }

  // 5. First setup command from GETTING_STARTED.md.
  const cmd = firstCommandFromCodeBlock(getting);
  if (cmd) {
    const fakes = pickDistinct(
      ['npm install', 'yarn install', 'pip install -r requirements.txt', 'dotnet restore', 'cargo build', 'mvn install', './configure && make'],
      3, [cmd]
    );
    const { choices, answer } = shuffleWithAnswer(cmd, fakes);
    q.push({ q: `Which command should you run first to set this repo up locally?`, choices, answer });
  }

  // 6. A real folder from the repo map.
  const folders = extractFolderNames(repoMap);
  if (folders.length) {
    const correct = folders[0];
    const fakes = pickDistinct(
      ['totally-fake/', 'made-up-dir/', 'imaginary/', 'phantom/', 'mythical-module/', 'unicorn-stuff/'],
      3, []
    );
    const { choices, answer } = shuffleWithAnswer(correct, fakes);
    q.push({ q: `Which of these folders actually lives in this repo?`, choices, answer });
  }

  // 7. A real architecture component (H2 from ARCHITECTURE.md).
  const components = extractH2Titles(arch);
  if (components.length) {
    const correct = components[0];
    const fakes = pickDistinct(
      ['Quantum Flux Capacitor', 'Cookie Refrigeration Service', 'Imaginary Friend Daemon', 'Unicorn Stable Manager', 'Coffee-Powered Reactor'],
      3, []
    );
    const { choices, answer } = shuffleWithAnswer(correct, fakes);
    q.push({ q: `Which of these is an actual component described in this repo's architecture?`, choices, answer });
  }

  // Fallback if Buddy hasn't been filled in yet — prompt the user to scan.
  if (q.length === 0) {
    q.push({
      q: `It looks like .buddy/ docs are still empty. Which command should you run in Copilot CLI to fill them in?`,
      choices: [
        '"Scan this repo and fill in .buddy/"',
        'rm -rf .buddy',
        'git push --force',
        'Send an email to your manager',
      ],
      answer: 0,
    });
  }

  return q.slice(0, 5);
}

function buildRepoMeta(repoRoot, buddy) {
  const manifest = readJsonIfExists(join(buddy, 'manifest.json')) || {};
  let pkgName = '';
  const pkgPath = join(repoRoot, 'package.json');
  if (existsSync(pkgPath)) {
    try { pkgName = JSON.parse(readFileSync(pkgPath, 'utf8')).name || ''; } catch {}
  }
  const repoName = pkgName || basename(repoRoot);
  return {
    repoName,
    repoRoot,
    lastIndexedCommit: manifest.last_indexed_commit || null,
    lastRunTimestamp: manifest.last_run_timestamp || null,
    generatedAt: new Date().toISOString(),
  };
}

function buildLinks(buddy) {
  const raw = readJsonIfExists(join(buddy, 'INDEX', 'links.json'));
  if (!raw) return [];
  // Old shape: bare array. New shape: { links: [...] }.
  const arr = Array.isArray(raw) ? raw : (Array.isArray(raw.links) ? raw.links : []);
  return arr.map((l) => ({
    title: l.title || l.url || 'Untitled',
    url: l.url || '#',
    description: l.description || '',
    tags: Array.isArray(l.tags) ? l.tags : [],
    relevance: l.relevance || 'helpful',
  }));
}

export function generateTourHtml(repoRoot, buddy) {
  const sections = buildSections(buddy);
  const quiz = buildQuiz(buddy);
  const meta = buildRepoMeta(repoRoot, buddy);
  const links = buildLinks(buddy);
  meta.linksCount = links.length;
  const data = { meta, sections, quiz, links };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return TOUR_HTML.replace('/*__BUDDY_DATA__*/null', json);
}

export async function tourCommand(opts = {}) {
  const repoRoot = findRepoRoot();
  const buddy = buddyDir(repoRoot);
  if (!isDir(buddy)) {
    console.error(`buddy: no .buddy/ found at ${buddy}`);
    console.error('  Run "buddy init" first.');
    process.exit(1);
  }
  const html = generateTourHtml(repoRoot, buddy);
  const out = join(buddy, 'tour.html');
  writeFileSync(out, html, 'utf8');
  console.log(`🎮 Tour generated: ${out}`);

  if (opts.open === false) return;
  const result = openFile(out, { silent: true });
  if (result.opened) console.log(`📖 Opened tour in your browser.`);
  else if (result.reason && result.reason !== 'BUDDY_NO_OPEN=1') {
    console.log(`(Could not auto-open: ${result.reason})`);
  }
}

const TOUR_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Buddy Tour</title>
<style>
  :root {
    --bg: #fdfbf7; --panel: #ffffff; --ink: #2c2a3a; --muted: #6b6880;
    --accent: #7a5cff; --accent-soft: #efeaff; --warm: #ffb86b;
    --good: #30c48d; --bad: #ff6b6b; --line: #ece8de;
    --code-bg: #f5f1ea;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1a1820; --panel: #24222e; --ink: #f1eef9; --muted: #a8a4bd;
      --accent: #a48cff; --accent-soft: #2e2944; --warm: #ffc98a;
      --line: #34303f; --code-bg: #1f1d28;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif;
    line-height: 1.55; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  code { background: var(--code-bg); padding: 1px 6px; border-radius: 4px;
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 0.92em; }
  pre.code { background: var(--code-bg); padding: 12px 14px; border-radius: 8px;
    overflow-x: auto; position: relative; }
  pre.code code { background: transparent; padding: 0; }
  pre.code .copy { position: absolute; top: 8px; right: 8px; font-size: 11px;
    background: var(--panel); border: 1px solid var(--line); border-radius: 6px;
    padding: 3px 8px; cursor: pointer; color: var(--muted); }
  pre.code .copy:hover { color: var(--ink); }
  blockquote { border-left: 4px solid var(--accent-soft); margin: 1em 0;
    padding: 4px 12px; color: var(--muted); }
  hr { border: 0; border-top: 1px solid var(--line); margin: 1.5em 0; }
  h1,h2,h3,h4 { line-height: 1.25; }

  .app { display: grid; grid-template-columns: 280px 1fr; min-height: 100vh; }
  .sidebar { background: var(--panel); border-right: 1px solid var(--line);
    padding: 18px 14px; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
  .brand { font-weight: 700; font-size: 18px; margin-bottom: 6px; }
  .brand .emoji { font-size: 22px; margin-right: 6px; }
  .repo { font-size: 12px; color: var(--muted); margin-bottom: 12px;
    word-break: break-word; }

  .xp-wrap { background: var(--accent-soft); border-radius: 999px; height: 8px;
    overflow: hidden; margin: 10px 0 4px; }
  .xp-bar { background: var(--accent); height: 100%; width: 0%; transition: width .3s ease; }
  .xp-text { font-size: 11px; color: var(--muted); margin-bottom: 14px; }

  .nav { display: flex; flex-direction: column; gap: 2px; }
  .nav button { all: unset; cursor: pointer; padding: 8px 10px; border-radius: 8px;
    display: flex; align-items: center; gap: 8px; font-size: 14px; }
  .nav button:hover { background: var(--accent-soft); }
  .nav button.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
  .nav .check { margin-left: auto; opacity: 0; transition: opacity .2s; }
  .nav button.done .check { opacity: 1; color: var(--good); }
  .nav .empty-tag { font-size: 10px; color: var(--muted); margin-left: auto; }

  .search { width: 100%; padding: 8px 10px; border: 1px solid var(--line);
    border-radius: 8px; background: var(--bg); color: var(--ink);
    font-family: inherit; font-size: 13px; margin-bottom: 12px; }

  .main { padding: 32px 48px; max-width: 920px; }
  .crumb { color: var(--muted); font-size: 12px; margin-bottom: 6px; }
  .pageTitle { display: flex; align-items: center; gap: 12px; font-size: 28px;
    margin: 0 0 8px; }
  .pageTitle .icon { font-size: 32px; }
  .src-link { font-size: 12px; color: var(--muted); margin-bottom: 18px; }
  .summary { font-size: 16px; color: var(--muted); margin-bottom: 20px; }

  .content { font-size: 15px; }
  .content h1 { font-size: 22px; margin-top: 1.4em; }
  .content h2 { font-size: 18px; margin-top: 1.4em; }
  .content h3 { font-size: 16px; margin-top: 1.2em; }
  .content ul, .content ol { padding-left: 22px; }
  .content li { margin: 4px 0; }

  .empty { padding: 18px; background: var(--accent-soft); border-radius: 10px;
    color: var(--ink); }

  table.md-table { border-collapse: collapse; width: 100%; margin: 14px 0;
    font-size: 14px; display: block; overflow-x: auto; }
  table.md-table th, table.md-table td { border: 1px solid var(--line);
    padding: 8px 12px; vertical-align: top; }
  table.md-table thead { background: var(--accent-soft); }
  table.md-table th { font-weight: 600; color: var(--ink); }
  table.md-table tbody tr:nth-child(even) { background: rgba(122,92,255,0.04); }

  /* TL;DR card at top of each section */
  .tldr { background: var(--accent-soft); border-left: 4px solid var(--accent);
    border-radius: 8px; padding: 12px 16px; margin: 0 0 22px;
    font-size: 15px; color: var(--ink); }
  .tldr .label { font-size: 11px; font-weight: 700; color: var(--accent);
    text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 4px; }

  /* Accordion sections */
  .content details { background: var(--panel); border: 1px solid var(--line);
    border-radius: 10px; padding: 4px 16px; margin: 10px 0;
    transition: box-shadow .2s; }
  .content details[open] { box-shadow: 0 2px 6px rgba(0,0,0,0.04); }
  .content details > summary { cursor: pointer; padding: 12px 0;
    font-weight: 600; font-size: 16px; list-style: none;
    display: flex; align-items: center; gap: 10px; }
  .content details > summary::-webkit-details-marker { display: none; }
  .content details > summary::before { content: "▸"; color: var(--accent);
    transition: transform .2s; display: inline-block; }
  .content details[open] > summary::before { transform: rotate(90deg); }
  .content details > summary:hover { color: var(--accent); }
  .content details > .acc-body { padding: 0 0 12px; }

  /* Link cards (Curated Links page) */
  .link-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
  @media (max-width: 720px) { .link-grid { grid-template-columns: 1fr; } }
  .link-card { background: var(--panel); border: 1px solid var(--line);
    border-radius: 10px; padding: 14px 16px; transition: transform .15s, box-shadow .15s; }
  .link-card:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.06); }
  .link-card .title { font-weight: 600; margin-bottom: 4px; display: flex;
    align-items: center; gap: 8px; }
  .link-card .desc { color: var(--muted); font-size: 13px; margin: 6px 0 8px; }
  .link-card .meta { display: flex; flex-wrap: wrap; gap: 6px; }
  .pill { display: inline-block; padding: 2px 9px; border-radius: 999px;
    font-size: 11px; background: var(--accent-soft); color: var(--accent); }
  .pill.must { background: rgba(255,184,107,0.2); color: #b07028; }
  .pill.optional { background: rgba(168,164,189,0.2); color: var(--muted); }

  .actions { display: flex; gap: 10px; margin: 28px 0 16px; flex-wrap: wrap; }
  .btn { all: unset; cursor: pointer; padding: 10px 16px; border-radius: 999px;
    background: var(--accent); color: white; font-size: 14px; font-weight: 600; }
  .btn.ghost { background: transparent; color: var(--accent);
    border: 1px solid var(--accent); }
  .btn.warm { background: var(--warm); color: #2c2a3a; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 999px;
    background: var(--accent-soft); color: var(--accent); font-size: 11px;
    font-weight: 600; margin-right: 6px; }
  .badge.good { background: rgba(48,196,141,0.15); color: var(--good); }

  .footer { font-size: 11px; color: var(--muted); margin-top: 40px;
    border-top: 1px solid var(--line); padding-top: 14px; }

  /* Quiz */
  .quiz-q { background: var(--panel); border: 1px solid var(--line);
    border-radius: 10px; padding: 16px; margin: 12px 0; }
  .quiz-q .q { font-weight: 600; margin-bottom: 10px; }
  .quiz-q .opt { display: block; padding: 8px 10px; border-radius: 6px;
    cursor: pointer; margin: 4px 0; }
  .quiz-q .opt:hover { background: var(--accent-soft); }
  .quiz-q .opt.right { background: rgba(48,196,141,0.15); color: var(--good); }
  .quiz-q .opt.wrong { background: rgba(255,107,107,0.15); color: var(--bad); }
  .quiz-score { font-size: 18px; font-weight: 700; margin-top: 18px; }

  /* Search results */
  mark { background: #fff2a8; color: #2c2a3a; padding: 0 2px; border-radius: 2px; }
  .search-hits { font-size: 12px; color: var(--muted); margin: 4px 0 0; }

  @media (max-width: 800px) {
    .app { grid-template-columns: 1fr; }
    .sidebar { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--line); }
    .main { padding: 22px 18px; }
  }
</style>
</head>
<body>
<div class="app">
  <aside class="sidebar">
    <div class="brand"><span class="emoji">🤝</span>Buddy Tour</div>
    <div class="repo" id="repoName"></div>
    <input class="search" id="search" placeholder="Search the tour…" />
    <div class="xp-text" id="xpText">0 / 0 onboarding points</div>
    <div class="xp-wrap"><div class="xp-bar" id="xpBar"></div></div>
    <nav class="nav" id="nav"></nav>
  </aside>
  <main class="main" id="main">Loading…</main>
</div>

<script type="application/json" id="buddy-data">/*__BUDDY_DATA__*/null</script>
<script>
(function(){
  const raw = document.getElementById('buddy-data').textContent;
  const DATA = JSON.parse(raw);
  const STORAGE_KEY = 'buddy-tour:' + (DATA.meta.repoName || 'repo');
  const state = loadState();

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { done: {}, quiz: null }; }
    catch { return { done: {}, quiz: null }; }
  }
  function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} }

  const ALL_STEPS = DATA.sections.concat([
    { id: '__quiz__', icon: '🎓', title: 'Graduation Quiz', isQuiz: true, hasContent: true },
  ]);

  document.getElementById('repoName').textContent = '📦 ' + (DATA.meta.repoName || 'repo');

  const nav = document.getElementById('nav');
  ALL_STEPS.forEach((s, idx) => {
    const b = document.createElement('button');
    b.dataset.id = s.id;
    b.innerHTML = '<span>' + s.icon + '</span><span>' + (idx + 1) + '. ' + escapeHtml(s.title) + '</span>'
      + (s.hasContent ? '' : '<span class="empty-tag">empty</span>')
      + '<span class="check">✓</span>';
    b.onclick = () => navigate(s.id);
    nav.appendChild(b);
  });

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  function refreshNav() {
    const total = ALL_STEPS.length;
    let done = 0;
    Array.from(nav.children).forEach((btn) => {
      const id = btn.dataset.id;
      if (state.done[id]) { btn.classList.add('done'); done++; }
      else btn.classList.remove('done');
      btn.classList.toggle('active', id === currentId);
    });
    const pct = total ? Math.round((done / total) * 100) : 0;
    document.getElementById('xpBar').style.width = pct + '%';
    document.getElementById('xpText').textContent =
      done + ' / ' + total + ' steps complete  •  ' + pct + ' XP';
  }

  let currentId = ALL_STEPS[0].id;
  function navigate(id) {
    currentId = id;
    if (id === '__quiz__') renderQuiz();
    else renderSection(DATA.sections.find((x) => x.id === id));
    refreshNav();
    history.replaceState(null, '', '#' + id);
  }

  function markDone(id) { state.done[id] = true; saveState(); refreshNav(); }

  function renderSection(s) {
    const idx = ALL_STEPS.findIndex((x) => x.id === s.id);
    const next = ALL_STEPS[idx + 1];
    const main = document.getElementById('main');

    // Special, more visual rendering for the Curated Links page.
    let body;
    if (s.id === 'links' && Array.isArray(DATA.links) && DATA.links.length) {
      body = renderLinksGrid(DATA.links);
    } else if (s.hasContent) {
      body = '<div class="content">' + s.html + '</div>';
    } else {
      body = '<div class="empty"><strong>This section is empty.</strong> Ask Buddy in your CLI: '
           + '<code>"Scan this repo and fill in .buddy/' + escapeHtml(s.source) + '"</code>.</div>';
    }

    main.innerHTML =
      '<div class="crumb">Step ' + (idx + 1) + ' of ' + ALL_STEPS.length + '</div>'
      + '<h1 class="pageTitle"><span class="icon">' + s.icon + '</span>'
      + escapeHtml(s.title) + '</h1>'
      + (s.summary ? '<div class="tldr"><div class="label">In one line</div>' + escapeHtml(s.summary) + '</div>' : '')
      + '<div class="src-link">📖 Source: <code>.buddy/' + escapeHtml(s.source) + '</code></div>'
      + body
      + '<div class="actions">'
      + '<button class="btn" id="btnDone">' + (state.done[s.id] ? '✓ Marked complete' : 'Mark complete & continue') + '</button>'
      + (next ? '<button class="btn ghost" id="btnNext">Next: ' + escapeHtml(next.title) + ' →</button>' : '')
      + '</div>'
      + '<div class="footer">Generated ' + new Date(DATA.meta.generatedAt).toLocaleString()
      + (DATA.meta.lastIndexedCommit ? ' • Indexed commit ' + DATA.meta.lastIndexedCommit.slice(0,8) : '')
      + '</div>';

    document.getElementById('btnDone').onclick = function(){
      markDone(s.id);
      if (next) navigate(next.id);
    };
    if (next) document.getElementById('btnNext').onclick = function(){
      markDone(s.id); navigate(next.id);
    };
    accordionizeContent(main);
    addCopyButtons(main);
    wireInternalLinks(main);
  }

  // Track scroll listener cleanup so navigating between sidebar sections
  // doesn't leave stale handlers attached to detached DOM.
  let scrollCleanup = null;

  function renderLinksGrid(links) {
    const cards = links.map((l) => {
      const tagPills = (l.tags || []).map((t) =>
        '<span class="pill">' + escapeHtml(t) + '</span>').join('');
      const relPill = '<span class="pill ' + (l.relevance === 'must-read' ? 'must' :
        l.relevance === 'optional' ? 'optional' : '') + '">'
        + escapeHtml(l.relevance || 'helpful') + '</span>';
      const safeUrl = /^(https?:|mailto:)/i.test(l.url || '') ? l.url : '#';
      return '<a class="link-card" href="' + escapeHtml(safeUrl) + '" target="_blank" rel="noopener">'
        + '<div class="title">🔗 ' + escapeHtml(l.title) + '</div>'
        + (l.description ? '<div class="desc">' + escapeHtml(l.description) + '</div>' : '')
        + '<div class="meta">' + relPill + tagPills + '</div>'
        + '</a>';
    }).join('');
    return '<div class="link-grid">' + cards + '</div>';
  }

  // Wrap H2 sections of rendered markdown into <details> accordions.
  // First accordion is open by default so the page never looks empty.
  function accordionizeContent(root) {
    const content = root.querySelector('.content');
    if (!content) return;
    const children = Array.from(content.children);
    if (children.filter((c) => c.tagName === 'H2').length < 2) return;
    // Unique group name so opening one card auto-closes its siblings
    // (native exclusive-accordion behavior in modern browsers).
    const groupName = 'acc-' + Math.random().toString(36).slice(2, 9);
    const frag = document.createDocumentFragment();
    const detailsList = [];
    let bucket = null;
    let firstOpen = true;
    for (const el of children) {
      if (el.tagName === 'H2') {
        const det = document.createElement('details');
        det.name = groupName;
        if (firstOpen) { det.open = true; firstOpen = false; }
        const sum = document.createElement('summary');
        sum.innerHTML = el.innerHTML;
        const accBody = document.createElement('div');
        accBody.className = 'acc-body';
        det.appendChild(sum);
        det.appendChild(accBody);
        frag.appendChild(det);
        detailsList.push(det);
        bucket = accBody;
      } else if (bucket) {
        bucket.appendChild(el);
      } else {
        frag.appendChild(el);
      }
    }
    content.innerHTML = '';
    content.appendChild(frag);
    // Fallback for browsers without exclusive <details name=...> support.
    detailsList.forEach((d) => {
      d.addEventListener('toggle', () => {
        if (!d.open) return;
        detailsList.forEach((o) => { if (o !== d && o.open) o.open = false; });
      });
    });
    // Auto-open the section the user scrolls to. Driven by real scroll
    // events (not IntersectionObserver), so layout shifts caused by
    // opening a card do not re-trigger and fight the user's clicks.
    if (scrollCleanup) { scrollCleanup(); scrollCleanup = null; }
    let userClickLock = 0;
    let lastAdvanceAt = 0;
    let wheelAccum = 0;
    detailsList.forEach((d) => {
      const sum = d.querySelector('summary');
      if (sum) {
        sum.addEventListener('click', () => {
          // Briefly ignore scroll-driven auto-open after a manual click,
          // so the user's choice sticks even if the page reflows.
          userClickLock = Date.now() + 800;
          wheelAccum = 0;
        });
      }
    });
    function handoff(dir) {
      const now = Date.now();
      if (now < userClickLock) return;
      if (now - lastAdvanceAt < 250) return;
      const openIdx = detailsList.findIndex((d) => d.open);
      if (openIdx === -1) { detailsList[0].open = true; return; }
      if (dir > 0) {
        const next = detailsList[openIdx + 1];
        if (next) { next.open = true; lastAdvanceAt = now; }
      } else if (dir < 0) {
        const prev = detailsList[openIdx - 1];
        if (prev) { prev.open = true; lastAdvanceAt = now; }
      }
    }
    function onWheel(e) {
      // Wheel events fire even when the page is not scrollable, so this is
      // the most reliable signal. Accumulate deltaY and hand off when it
      // crosses a threshold — this also debounces trackpad inertia.
      wheelAccum += e.deltaY;
      if (Math.abs(wheelAccum) >= 80) {
        const dir = wheelAccum > 0 ? 1 : -1;
        wheelAccum = 0;
        handoff(dir);
      }
    }
    function onKey(e) {
      if (['ArrowDown','PageDown','End',' '].includes(e.key)) handoff(1);
      else if (['ArrowUp','PageUp','Home'].includes(e.key)) handoff(-1);
    }
    // Also keep a scroll-based path: on scrollable pages, when the open
    // card's body scrolls out of view, advance. This complements wheel
    // accumulation for users who scroll via scrollbar / middle-click.
    let prevScrollY = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const dy = y - prevScrollY;
      prevScrollY = y;
      if (Date.now() < userClickLock) return;
      if (Date.now() - lastAdvanceAt < 250) return;
      const openIdx = detailsList.findIndex((d) => d.open);
      if (openIdx === -1) return;
      const open = detailsList[openIdx];
      const r = open.getBoundingClientRect();
      const vh = window.innerHeight;
      if (dy > 0) {
        const next = detailsList[openIdx + 1];
        if (next && r.bottom < vh * 0.35) handoff(1);
      } else if (dy < 0) {
        const prev = detailsList[openIdx - 1];
        if (prev && r.top > vh * 0.55) handoff(-1);
      }
    }
    const targets = [window, document, document.documentElement, document.body];
    targets.forEach((t) => t.addEventListener('scroll', onScroll, { passive: true }));
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onKey);
    scrollCleanup = () => {
      targets.forEach((t) => t.removeEventListener('scroll', onScroll));
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }

  function wireInternalLinks(root) {
    root.querySelectorAll('a[data-tour-link="1"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const id = (a.getAttribute('href') || '').replace('#', '');
        if (id) navigate(id);
      });
    });
  }

  function addCopyButtons(root) {
    root.querySelectorAll('pre.code').forEach((pre) => {
      if (pre.querySelector('.copy')) return;
      const btn = document.createElement('button');
      btn.className = 'copy';
      btn.textContent = 'Copy';
      btn.onclick = () => {
        const txt = pre.querySelector('code').innerText;
        navigator.clipboard?.writeText(txt);
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1200);
      };
      pre.appendChild(btn);
    });
  }

  function renderQuiz() {
    const main = document.getElementById('main');
    state.quiz = state.quiz || { answers: {} };
    let html = '<div class="crumb">Final step</div>'
      + '<h1 class="pageTitle"><span class="icon">🎓</span>Graduation Quiz</h1>'
      + '<div class="summary">Answer a few quick questions to earn your Buddy Graduate badge.</div>';
    DATA.quiz.forEach((q, qi) => {
      html += '<div class="quiz-q" data-qi="' + qi + '"><div class="q">'
        + (qi + 1) + '. ' + escapeHtml(q.q) + '</div>';
      q.choices.forEach((c, ci) => {
        html += '<button class="opt" data-ci="' + ci + '">' + escapeHtml(c) + '</button>';
      });
      html += '</div>';
    });
    html += '<div class="quiz-score" id="score"></div>';
    html += '<div class="actions"><button class="btn warm" id="btnFinish">Finish & earn badge 🎉</button></div>';
    main.innerHTML = html;

    main.querySelectorAll('.quiz-q').forEach((qEl) => {
      const qi = +qEl.dataset.qi;
      qEl.querySelectorAll('.opt').forEach((opt) => {
        opt.onclick = () => {
          const ci = +opt.dataset.ci;
          state.quiz.answers[qi] = ci;
          saveState();
          qEl.querySelectorAll('.opt').forEach((o) => o.classList.remove('right','wrong'));
          opt.classList.add(ci === DATA.quiz[qi].answer ? 'right' : 'wrong');
          if (ci !== DATA.quiz[qi].answer) {
            const correct = qEl.querySelectorAll('.opt')[DATA.quiz[qi].answer];
            if (correct) correct.classList.add('right');
          }
          updateScore();
        };
        // Restore prior selection
        if (state.quiz.answers[qi] === +opt.dataset.ci) opt.click();
      });
    });
    function updateScore() {
      let correct = 0;
      DATA.quiz.forEach((q, i) => { if (state.quiz.answers[i] === q.answer) correct++; });
      document.getElementById('score').textContent =
        'Score: ' + correct + ' / ' + DATA.quiz.length
        + (correct === DATA.quiz.length ? '  🌟 Perfect!' : '');
    }
    updateScore();
    document.getElementById('btnFinish').onclick = () => {
      markDone('__quiz__');
      alert('🎉 You finished the Buddy Tour!\nYou are ready to ship your first contribution.');
    };
  }

  // Search across all sections.
  document.getElementById('search').addEventListener('input', (e) => {
    const term = e.target.value.trim().toLowerCase();
    if (!term) { navigate(currentId); return; }
    const main = document.getElementById('main');
    const hits = [];
    DATA.sections.forEach((s) => {
      const txt = (s.title + ' ' + s.summary + ' ' + s.html).toLowerCase();
      if (txt.includes(term)) hits.push(s);
    });
    main.innerHTML = '<h1 class="pageTitle"><span class="icon">🔎</span>Search: ' + escapeHtml(term) + '</h1>'
      + '<div class="search-hits">' + hits.length + ' section(s) match.</div>'
      + hits.map((s) => '<div class="quiz-q" style="cursor:pointer" data-id="' + s.id + '">'
        + '<div class="q">' + s.icon + ' ' + escapeHtml(s.title) + '</div>'
        + '<div style="color:var(--muted);font-size:13px">' + escapeHtml(s.summary || '(open to view)') + '</div></div>').join('');
    main.querySelectorAll('[data-id]').forEach((el) => {
      el.onclick = () => { document.getElementById('search').value = ''; navigate(el.dataset.id); };
    });
  });

  // Start: honor URL hash if present.
  const hash = (location.hash || '').replace('#','');
  const start = ALL_STEPS.find((s) => s.id === hash) ? hash : ALL_STEPS[0].id;
  navigate(start);
})();
</script>
</body>
</html>`;
