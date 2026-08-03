/**
 * 방·화·베 원문 인용 — 서버 extractRhbRawSnippet 과 동일 규칙.
 * 원문에 없는 `방3화2베1` 형식을 절대 만들어 내지 않는다.
 */
export function extractRhbRawSnippetFromText(text: string): string | null {
  const t = text.trim();
  if (!t) return null;

  const withPyeong = t.match(
    /\d+(?:\.\d+)?\s*평\s*[(\uFF08]\s*\d+\s*[,，·/\s]\s*\d+\s*[,，·/\s]\s*\d+\s*[)\uFF09]/,
  );
  if (withPyeong?.[0]) return withPyeong[0].replace(/\s+/g, ' ').trim().slice(0, 48);

  const patterns: RegExp[] = [
    /방\s*\d+\s*화(?:장실|욕실)?\s*\d+\s*베(?:란다)?\s*\d+/i,
    /[(\uFF08]\s*\d+\s*[,，·/\s]\s*\d+\s*[,，·/\s]\s*\d+\s*[)\uFF09]/,
    /(?<![0-9])\d+\s*[,，·/]\s*\d+\s*[,，·/]\s*\d+(?![0-9])/,
    /방\s*\d+[^\n]{0,24}(?:화장실|욕실|화)\s*\d+[^\n]{0,24}베(?:란다)?\s*\d+/i,
    /방\s*\d+/i,
    /(?:화장실|욕실)\s*\d+/i,
    /베란다\s*\d+/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[0]) return m[0].replace(/\s+/g, ' ').trim().slice(0, 48);
  }

  const lineMatch = t.match(/[^\n]*(?:\d+\s*평\s*[(\uFF08]|[(\uFF08]\s*\d+\s*[,，·/]|방|화장실|욕실|베란다)[^\n]*/);
  return lineMatch?.[0]?.trim().slice(0, 48) ?? null;
}
