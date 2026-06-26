/** 본문에서 `[[EC_...]]` 토큰 추출 */
export const EC_TOKEN_REGEX = /\[\[EC_[A-Z0-9_]+\]\]/g;

export const EC_SIGNATURE_TOKEN = '[[EC_SIGNATURE]]';
export const EC_CONTRACT_DATE_TOKEN = '[[EC_CONTRACT_DATE]]';
/** 셀카 본인확인용 6자리 — 체결 시 링크 토큰으로 결정·부록에 기록 */
export const EC_CHALLENGE_DIGITS_TOKEN = '[[EC_CHALLENGE_DIGITS]]';

/** 체결 폼 상단 — 항상 표시하는 기본 SIGNER 필드 */
export const EC_CORE_SIGNER_TOKENS = [
  '[[EC_SIGNER_NAME]]',
  '[[EC_SIGNER_RRN]]',
  '[[EC_SIGNER_ADDRESS]]',
  '[[EC_SIGNER_PHONE]]',
] as const;

export function isCoreSignerToken(token: string): boolean {
  return (EC_CORE_SIGNER_TOKENS as readonly string[]).includes(token);
}

export function isValidEcToken(token: string): boolean {
  return /^\[\[EC_[A-Z0-9_]+\]\]$/.test(token.trim());
}

export function extractEcTokensFromText(text: string): string[] {
  const found = new Set<string>();
  const src = (text ?? '').replace(/\r\n/g, '\n');
  for (const m of src.matchAll(EC_TOKEN_REGEX)) {
    found.add(m[0]);
  }
  return [...found];
}

/** 라벨에서 토큰 후보 생성 — 중복 시 숫자 접미 */
export function suggestEcTokenFromLabel(label: string, existing: Set<string>): string {
  const base = label
    .trim()
    .toUpperCase()
    .replace(/[^\w가-힣]+/g, '_')
    .replace(/[가-힣]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const slug = base.length >= 2 ? base.slice(0, 24) : 'FIELD';
  let candidate = `[[EC_${slug}]]`;
  let n = 2;
  while (existing.has(candidate)) {
    candidate = `[[EC_${slug}_${n}]]`;
    n += 1;
  }
  return candidate;
}

export function formatKstContractDate(d: Date): string {
  const parts = d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return parts;
}

export function mergeFieldsFromJson(raw: unknown): Record<string, string> {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== 'string') continue;
    const t = v.trim();
    if (t) out[k] = t;
  }
  return out;
}
