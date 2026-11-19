export function compactSearch(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, '');
}

export function highlightParts(text: string, query: string): { text: string; hit: boolean }[] {
  const needle = compactSearch(query);
  if (!needle) return [{ text, hit: false }];
  const parts: { text: string; hit: boolean }[] = [];
  let i = 0;
  while (i < text.length) {
    let cursor = i;
    let matched = 0;
    let consumed = 0;
    while (cursor < text.length && matched < needle.length) {
      const ch = text[cursor] ?? '';
      if (/\s/.test(ch)) {
        cursor += 1;
        consumed += 1;
        continue;
      }
      if (ch.toLowerCase() !== needle[matched]) break;
      cursor += 1;
      matched += 1;
      consumed += 1;
    }
    if (matched === needle.length && consumed > 0) {
      parts.push({ text: text.slice(i, i + consumed), hit: true });
      i += consumed;
      continue;
    }
    const last = parts[parts.length - 1];
    const ch = text[i] ?? '';
    if (last && !last.hit) last.text += ch;
    else parts.push({ text: ch, hit: false });
    i += 1;
  }
  return parts.length > 0 ? parts : [{ text, hit: false }];
}
