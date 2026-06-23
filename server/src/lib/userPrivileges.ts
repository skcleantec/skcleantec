import type { UserRole, MarketerAdminLevel } from '@prisma/client';
import {
  hasMarketerFullAdminAccess,
  hasMarketerOperationalAdminAccess,
} from './marketerAdminLevel.js';

export type MarketerAccessUser = {
  role: UserRole;
  marketerAdminLevel?: MarketerAdminLevel | null;
};

/** 운영 권한 — 배정·삭제·접수 고급 수정 (LIMITED·FULL·ADMIN) */
export function hasOperationalAdminAccess(user: MarketerAccessUser): boolean {
  return hasMarketerOperationalAdminAccess(user.role, user.marketerAdminLevel ?? 'NONE');
}

/** 관리자 전용 페이지·사용자 등록 (FULL·ADMIN) */
export function hasStaffAdminAccess(user: MarketerAccessUser): boolean {
  return hasMarketerFullAdminAccess(user.role, user.marketerAdminLevel ?? 'NONE');
}

/** @deprecated hasOperationalAdminAccess 사용 */
export function hasAdminPrivileges(user: MarketerAccessUser): boolean {
  return hasOperationalAdminAccess(user);
}

export function canAssignInquiries(user: MarketerAccessUser): boolean {
  return hasOperationalAdminAccess(user);
}

export function canDeleteData(user: MarketerAccessUser): boolean {
  return hasOperationalAdminAccess(user);
}

export function canEditInquiryAdvanced(user: MarketerAccessUser): boolean {
  return hasOperationalAdminAccess(user);
}

/** 관리자 전용 페이지 접근 — ADMIN·FULL 마케터 */
export function canAccessAdminOnlyPages(user: MarketerAccessUser): boolean {
  return hasStaffAdminAccess(user);
}
