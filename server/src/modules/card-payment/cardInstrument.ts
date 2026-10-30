/** 승인 응답·결제 통보에서 카드사·할부·신용/체크를 읽는다. 없는 키는 저장하지 않는다. */

export type CardInstrument = {
  cardIssuer: string | null;
  installmentMonths: number | null;
  cardKind: string | null;
};

const ISSUER_KEYS = ['card_issuer', 'cardIssuer', 'cardName', 'card_name', 'issuerName', 'issuer', 'fnName'] as const;
const QUOTA_KEYS = ['quota', 'installment', 'cardQuota', 'QUOTA'] as const;
const KIND_KEYS = ['cardKind', 'cardType', 'card_kind', 'checkCard'] as const;

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value).trim();
  if (!raw || /\d{13,19}/.test(raw)) return null;
  return raw.slice(0, max);
}

function months(value: unknown): number | null {
  const raw = text(value, 2);
  if (!raw || !/^\d{1,2}$/.test(raw)) return null;
  const n = Number(raw);
  if (n < 0 || n > 12) return null;
  return n;
}

function kind(value: unknown): string | null {
  const raw = text(value, 16);
  if (!raw) return null;
  if (/신용/.test(raw) || raw.toUpperCase() === 'CREDIT') return '신용';
  if (/체크|직불/.test(raw) || /^(DEBIT|CHECK)$/i.test(raw)) return '체크';
  return null;
}

export function readCardInstrument(rec: Record<string, unknown>): CardInstrument {
  const issuer = ISSUER_KEYS.map((key) => text(rec[key], 40)).find((value) => value) ?? null;
  const installment = QUOTA_KEYS.map((key) => months(rec[key])).find((value) => value != null) ?? null;
  const cardKind = KIND_KEYS.map((key) => kind(rec[key])).find((value) => value) ?? null;
  return { cardIssuer: issuer, installmentMonths: installment ?? null, cardKind };
}

/** 로그용. 값과 카드번호·비밀번호 키는 빼서 키 이름만 남긴다. */
export function instrumentKeyNames(rec: Record<string, unknown>): string[] {
  return Object.keys(rec).filter((key) => !/card.?no|cert|password|pan|hash|phone|email|buyer/i.test(key));
}

export function monthsFromInstallmentCode(code: string): number | null {
  if (!/^\d{2}$/.test(code)) return null;
  const n = Number(code);
  return n >= 0 && n <= 12 ? n : null;
}

export function paidSourceFromScreen(payScreen: string | null | undefined): string | null {
  if (payScreen === 'P') return 'PC';
  if (payScreen === 'M') return '모바일';
  return null;
}
