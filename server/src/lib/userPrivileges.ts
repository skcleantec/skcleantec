import type { UserRole } from '@prisma/client';

/**
 * 사용자가 관리자 권한이 있는지 확인
 * - ADMIN 역할
 * - 또는 hasAdminPrivileges가 true인 마케터
 */
export function hasAdminPrivileges(user: {
  role: UserRole;
  hasAdminPrivileges?: boolean | null;
}): boolean {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'MARKETER' && user.hasAdminPrivileges) return true;
  return false;
}

/**
 * 배정 권한 체크 (관리자 또는 관리자 권한 마케터)
 */
export function canAssignInquiries(user: {
  role: UserRole;
  hasAdminPrivileges?: boolean | null;
}): boolean {
  return hasAdminPrivileges(user);
}

/**
 * 삭제 권한 체크 (관리자 또는 관리자 권한 마케터)
 */
export function canDeleteData(user: {
  role: UserRole;
  hasAdminPrivileges?: boolean | null;
}): boolean {
  return hasAdminPrivileges(user);
}

/**
 * 접수 수정 권한 (배정·정산·상태 변경 등)
 */
export function canEditInquiryAdvanced(user: {
  role: UserRole;
  hasAdminPrivileges?: boolean | null;
}): boolean {
  return hasAdminPrivileges(user);
}

/**
 * 관리자 전용 페이지 접근 권한 (항상 ADMIN만)
 * hasAdminPrivileges와 무관하게 역할만 체크
 */
export function canAccessAdminOnlyPages(user: {
  role: UserRole;
}): boolean {
  return user.role === 'ADMIN';
}
