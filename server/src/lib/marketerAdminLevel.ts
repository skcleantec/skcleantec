/**
 * @generated-sync from shared/marketerAdminLevel.ts — 직접 수정하지 마세요.
 * 변경: shared/marketerAdminLevel.ts 수정 후 동기화.
 */

/** 마케터 관리자 권한 단계 — User.marketerAdminLevel */

export type MarketerAdminLevel = 'NONE' | 'LIMITED' | 'FULL';

export const MARKETER_ADMIN_LEVEL_VALUES = ['NONE', 'LIMITED', 'FULL'] as const satisfies readonly MarketerAdminLevel[];

export const MARKETER_ADMIN_LEVEL_LABEL: Record<MarketerAdminLevel, string> = {
  NONE: '없음',
  LIMITED: '일부 권한',
  FULL: '전체 권한',
};

export function parseMarketerAdminLevel(raw: unknown): MarketerAdminLevel | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toUpperCase();
  return MARKETER_ADMIN_LEVEL_VALUES.includes(v as MarketerAdminLevel) ? (v as MarketerAdminLevel) : null;
}

/** 배정·삭제·접수 고급 수정 등 운영 권한 */
export function hasMarketerOperationalAdminAccess(
  role: string | null | undefined,
  level: MarketerAdminLevel | null | undefined,
): boolean {
  if (role === 'ADMIN') return true;
  if (role !== 'MARKETER') return false;
  return level === 'LIMITED' || level === 'FULL';
}

/** 관리자 전용 GNB·사용자 등록 등 ADMIN과 동일 업무 메뉴 */
export function hasMarketerFullAdminAccess(
  role: string | null | undefined,
  level: MarketerAdminLevel | null | undefined,
): boolean {
  if (role === 'ADMIN') return true;
  if (role !== 'MARKETER') return false;
  return level === 'FULL';
}
