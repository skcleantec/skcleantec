/** 국내 은행·금융기관 선택 목록 (입금 안내 공통) */
export const KOREAN_BANK_OTHER = '기타';

export const KOREAN_BANK_OPTIONS = [
  'KB국민은행',
  '신한은행',
  '우리은행',
  '하나은행',
  'NH농협은행',
  'IBK기업은행',
  'SC제일은행',
  '한국씨티은행',
  'KDB산업은행',
  '한국수출입은행',
  'Sh수협은행',
  'BNK부산은행',
  'BNK경남은행',
  'DGB대구은행',
  '광주은행',
  '전북은행',
  '제주은행',
  '카카오뱅크',
  '케이뱅크',
  '토스뱅크',
  '새마을금고',
  '신협',
  '산림조합',
  '우체국',
  '도이치은행',
  'JP모건체이스은행',
  '미즈호은행',
  '뱅크오브아메리카',
  '중국공상은행',
  '중국은행',
  'HSBC은행',
  KOREAN_BANK_OTHER,
] as const;

/** 저장값·레거시 약칭 → 드롭다운 값 */
const BANK_NAME_ALIASES: Record<string, string> = {
  국민은행: 'KB국민은행',
  KB국민: 'KB국민은행',
  농협: 'NH농협은행',
  NH농협: 'NH농협은행',
  기업은행: 'IBK기업은행',
  IBK: 'IBK기업은행',
  SC제일: 'SC제일은행',
  씨티은행: '한국씨티은행',
  산업은행: 'KDB산업은행',
  수협: 'Sh수협은행',
  수협은행: 'Sh수협은행',
  부산은행: 'BNK부산은행',
  경남은행: 'BNK경남은행',
  대구은행: 'DGB대구은행',
};

const OPTION_SET = new Set<string>(KOREAN_BANK_OPTIONS);

export function normalizeStoredBankName(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return '';
  return BANK_NAME_ALIASES[trimmed] ?? trimmed;
}

export function resolveBankSelectValue(stored: string | null | undefined): {
  select: string;
  other: string;
} {
  const normalized = normalizeStoredBankName(stored);
  if (!normalized) return { select: '', other: '' };
  if (OPTION_SET.has(normalized)) {
    return { select: normalized, other: '' };
  }
  return { select: KOREAN_BANK_OTHER, other: normalized };
}

export function resolveBankNameFromSelect(select: string, other: string): string {
  if (!select.trim()) return '';
  if (select === KOREAN_BANK_OTHER) return other.trim();
  return select.trim();
}

export function isKnownKoreanBankName(name: string | null | undefined): boolean {
  const normalized = normalizeStoredBankName(name);
  return Boolean(normalized && OPTION_SET.has(normalized));
}
