const HANGUL = /[\u3131-\u318E\uAC00-\uD7A3]/;

/** multipart 업로드 파일명 — UTF-8이 ISO-8859-1로 잘못 해석된 경우 복원 */
export function normalizeUploadedFilename(name: string | null | undefined): string | null {
  if (name == null) return null;
  const raw = name.trim();
  if (!raw) return null;

  if (HANGUL.test(raw)) return raw;

  const fromLatin1 = Buffer.from(raw, 'latin1').toString('utf8');
  if (HANGUL.test(fromLatin1)) return fromLatin1;

  const star = raw.match(/(?:utf-8|UTF-8)''(.+)/);
  if (star?.[1]) {
    try {
      const decoded = decodeURIComponent(star[1].replace(/\+/g, ' '));
      if (decoded) return decoded;
    } catch {
      /* ignore */
    }
  }

  return raw;
}
