/** 도움말 CMS 마크다운 → TipTap HTML (SimpleMarkdown 과 동일 구조) */
const UI_TOKEN_RE = /\{\{ui:([^}|]+)(?:\|([^}]+))?\}\}/g;
const BOLD_RE = /\*\*(.+?)\*\*/g;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInlineToHtml(text: string): string {
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  UI_TOKEN_RE.lastIndex = 0;
  while ((match = UI_TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(renderBoldOnly(text.slice(lastIndex, match.index)));
    }
    const tokenId = escapeHtml((match[1] ?? '').trim());
    parts.push(`<div data-help-ui="${tokenId}"></div>`);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(renderBoldOnly(text.slice(lastIndex)));
  }

  return parts.join('');
}

function renderBoldOnly(text: string): string {
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  BOLD_RE.lastIndex = 0;
  while ((match = BOLD_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(escapeHtml(text.slice(lastIndex, match.index)));
    }
    parts.push(`<strong>${escapeHtml(match[1] ?? '')}</strong>`);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(escapeHtml(text.slice(lastIndex)));
  }

  return parts.join('');
}

function isTableRow(line: string): boolean {
  return line.includes('|') && line.trim().startsWith('|');
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function parseTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function imageUrlFromMarkdown(filename: string): string {
  const trimmed = filename.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return trimmed;
  }
  return `/help/screenshots/${encodeURIComponent(trimmed)}`;
}

export function helpCmsMarkdownToHtml(source: string): string {
  const normalized = source.replace(/\r\n/g, '\n').trim();
  if (!normalized) return '<p></p>';

  const blocks = normalized.split(/\n\n+/);
  const htmlParts: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const lines = trimmed
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');
    if (lines.length === 0) continue;

    const first = lines[0] ?? '';

    if (lines.length === 1 && /^-{3,}$/.test(first)) {
      htmlParts.push('<hr>');
      continue;
    }

    if (lines.every((line) => line.startsWith('>'))) {
      const inner = lines
        .map((line) => `<p>${renderInlineToHtml(line.replace(/^>\s?/, ''))}</p>`)
        .join('');
      htmlParts.push(`<blockquote class="border-l-4 border-slate-300 pl-4">${inner}</blockquote>`);
      continue;
    }

    const uiBlockMatch = first.match(/^\{\{ui:([^}|]+)(?:\|([^}]+))?\}\}$/);
    if (uiBlockMatch && lines.length === 1) {
      const tokenId = escapeHtml((uiBlockMatch[1] ?? '').trim());
      htmlParts.push(`<div data-help-ui="${tokenId}"></div>`);
      continue;
    }

    const imageMatch = first.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch && lines.length === 1) {
      const alt = escapeHtml(imageMatch[1] ?? '');
      const src = escapeHtml(imageUrlFromMarkdown(imageMatch[2] ?? ''));
      htmlParts.push(
        `<figure class="my-6"><img src="${src}" alt="${alt}" class="max-w-full rounded-lg border border-slate-200 shadow-sm" />${
          alt ? `<figcaption class="mt-2 text-center text-fluid-xs text-slate-500">${alt}</figcaption>` : ''
        }</figure>`,
      );
      continue;
    }

    if (lines.length >= 2 && isTableRow(first) && isTableSeparator(lines[1] ?? '')) {
      const headerCells = parseTableCells(first);
      const bodyLines = lines.slice(2).filter(isTableRow);
      const thead = headerCells
        .map((cell) => `<th>${renderInlineToHtml(cell)}</th>`)
        .join('');
      const tbody = bodyLines
        .map((rowLine) => {
          const cells = parseTableCells(rowLine)
            .map((cell) => `<td>${renderInlineToHtml(cell)}</td>`)
            .join('');
          return `<tr>${cells}</tr>`;
        })
        .join('');
      htmlParts.push(
        `<table class="help-cms-md-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`,
      );
      continue;
    }

    if (first.startsWith('## ')) {
      htmlParts.push(`<h2>${renderInlineToHtml(first.slice(3))}</h2>`);
      continue;
    }

    if (first.startsWith('### ')) {
      htmlParts.push(`<h3>${renderInlineToHtml(first.slice(4))}</h3>`);
      continue;
    }

    if (lines.every((line) => line.startsWith('- '))) {
      const items = lines
        .map((line) => `<li>${renderInlineToHtml(line.slice(2))}</li>`)
        .join('');
      htmlParts.push(`<ul>${items}</ul>`);
      continue;
    }

    if (lines.every((line) => /^\d+\.\s/.test(line))) {
      const items = lines
        .map((line) => `<li>${renderInlineToHtml(line.replace(/^\d+\.\s*/, ''))}</li>`)
        .join('');
      htmlParts.push(`<ol>${items}</ol>`);
      continue;
    }

    const paragraphs = lines.map((line) => `<p>${renderInlineToHtml(line)}</p>`).join('');
    htmlParts.push(paragraphs);
  }

  return htmlParts.join('') || '<p></p>';
}
