import type { InternalCustomerTone } from '@prisma/client';

const TONE_VALUES: InternalCustomerTone[] = ['GOOD', 'NORMAL', 'BAD'];

/** 1차: 마케터·관리자만. 팀장·외부 확장 시 이 함수만 조정 */
export function canViewInternalCustomerTone(role: string | undefined): boolean {
  return role === 'ADMIN' || role === 'MARKETER';
}

export function canEditInternalCustomerTone(role: string | undefined): boolean {
  return canViewInternalCustomerTone(role);
}

export function parseInternalCustomerToneInput(raw: unknown): InternalCustomerTone | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().toUpperCase();
  if (TONE_VALUES.includes(s as InternalCustomerTone)) {
    return s as InternalCustomerTone;
  }
  return null;
}

export function internalCustomerToneEmoji(tone: InternalCustomerTone): string {
  switch (tone) {
    case 'GOOD':
      return '😊';
    case 'BAD':
      return '😠';
    default:
      return '😐';
  }
}

/** 변경 이력·관리 화면 — 이모티콘만 (문구 노출 최소화) */
export function internalCustomerToneDisplay(tone: InternalCustomerTone): string {
  return internalCustomerToneEmoji(tone);
}

/** API 응답 — 권한 없으면 필드 제거 */
export function attachInternalCustomerToneForRole<T extends { internalCustomerTone?: InternalCustomerTone }>(
  row: T,
  role: string | undefined,
): Omit<T, 'internalCustomerTone'> & { internalCustomerTone?: InternalCustomerTone } {
  if (!canViewInternalCustomerTone(role)) {
    const { internalCustomerTone: _omit, ...rest } = row;
    return rest;
  }
  return row;
}

export function mapInquiriesInternalToneForRole<T extends { internalCustomerTone?: InternalCustomerTone }>(
  items: T[],
  role: string | undefined,
): Array<Omit<T, 'internalCustomerTone'> & { internalCustomerTone?: InternalCustomerTone }> {
  return items.map((row) => attachInternalCustomerToneForRole(row, role));
}
