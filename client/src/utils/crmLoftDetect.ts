/** 서버 judgeTelecrmAiQuoteLoft 와 같은 규칙. 체크가 없을 때만 메모에서 복층을 찾는다. */
const LOFT_NEGATIVE = /복층\s*아님|복층\s*아니|복층\s*없|복층\s*은\s*아니|복층\s*[xX×]|단층/;

export function memoSaysLoft(text: string | null | undefined): boolean {
  const raw = String(text ?? '');
  if (!raw.trim() || LOFT_NEGATIVE.test(raw)) return false;
  return /복층/.test(raw);
}
