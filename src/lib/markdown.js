// Tiny markdown -> HTML renderer. Block-level: # headings, ``` fenced code,
// > blockquotes, --- hr, - / * / 1. lists, paragraphs.
// Inline: **bold**, *italic*, `code`, [text](url).
// No external deps. Inputs are trusted (Buddy's own .buddy/ docs).

const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => escapeMap[c]);
}

function inline(text) {
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    // Block only dangerous schemes; let everything else (relative .md paths,
    // anchors, raw filenames) reach the post-render link rewriter.
    const safe = /^\s*(javascript:|data:|vbscript:)/i.test(url) ? '#' : url;
    const ext = /^https?:/.test(safe) ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${safe}"${ext}>${label}</a>`;
  });
  return s;
}

export function renderMarkdown(md) {
  if (!md) return '';
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push(`<pre class="code"><code data-lang="${esc(lang)}">${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*---+\s*$/.test(line)) { out.push('<hr/>'); i++; continue; }

    // GitHub-flavored tables: header row, separator row, then body rows.
    // Accept rows with or without leading/trailing pipes.
    const looksLikeTableRow = (s) => s.includes('|');
    const looksLikeTableSep = (s) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(s);
    if (looksLikeTableRow(line) && i + 1 < lines.length && looksLikeTableSep(lines[i + 1])) {
      const splitRow = (row) => row.trim().replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
      const header = splitRow(line);
      const sepCells = splitRow(lines[i + 1]);
      const align = sepCells.map((c) => {
        const left = /^:/.test(c), right = /:$/.test(c);
        if (left && right) return 'center';
        if (right) return 'right';
        return 'left';
      });
      i += 2;
      const body = [];
      while (i < lines.length && looksLikeTableRow(lines[i]) && lines[i].trim() !== '') {
        body.push(splitRow(lines[i]));
        i++;
      }
      const headHtml = '<thead><tr>' + header.map((c, idx) =>
        `<th style="text-align:${align[idx] || 'left'}">${inline(c)}</th>`).join('') + '</tr></thead>';
      const bodyHtml = '<tbody>' + body.map((row) =>
        '<tr>' + row.map((c, idx) =>
          `<td style="text-align:${align[idx] || 'left'}">${inline(c)}</td>`).join('') + '</tr>'
      ).join('') + '</tbody>';
      out.push(`<table class="md-table">${headHtml}${bodyHtml}</table>`);
      continue;
    }

    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      out.push(`<ul>${buf.map((b) => `<li>${inline(b)}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      out.push(`<ol>${buf.map((b) => `<li>${inline(b)}</li>`).join('')}</ol>`);
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    const buf = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,6}\s|```|\s*[-*]\s|\s*\d+\.\s|\s*>|\s*---|\s*\|)/.test(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }

  return out.join('\n');
}

// Extract the first top-level heading and the paragraph that follows it.
export function summarize(md) {
  if (!md) return { title: '', summary: '' };
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let title = '';
  let summary = '';
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^#\s+(.*)$/);
    if (h) {
      title = stripInline(h[1].trim());
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() === '') continue;
        if (/^#/.test(lines[j])) break;
        if (/^>/.test(lines[j])) continue;
        summary = stripInline(lines[j].trim());
        break;
      }
      break;
    }
  }
  return { title, summary };
}

// Strip markdown inline syntax for plain-text contexts (titles, summaries).
function stripInline(s) {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) -> text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();
}
