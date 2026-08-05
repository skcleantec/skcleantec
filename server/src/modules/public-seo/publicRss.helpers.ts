export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function toRfc822(date: Date): string {
  return date.toUTCString();
}

export function plainTextFromHtml(html: string, maxLen = 500): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

export function helpArticlePublicUrl(
  baseUrl: string,
  tabGroup: string,
  categorySlug: string,
  slug: string,
): string {
  const q = new URLSearchParams({
    category: tabGroup,
    section: categorySlug,
    article: slug,
  });
  return `${baseUrl}/help?${q.toString()}`;
}
