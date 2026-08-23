/** Google Play 「청소비서」 업무 앱 (`com.cbiseo.app`) — 단일 정책 상수 */

/** Play applicationId */
export const CBISEO_STAFF_APP_PACKAGE = 'com.cbiseo.app';

/** Play 스토어 표시명 */
export const CBISEO_STAFF_APP_DISPLAY_NAME = '청소비서';

/** WebView localStorage — 네이티브 앱 세션 플래그 */
export const CBISEO_STAFF_APP_STORAGE_KEY = 'cbiseo_staff_app';

/** WS client 쿼리 (서버 inboxWebSocket platform 구분용) */
export const CBISEO_STAFF_APP_WS_CLIENT = 'cbiseo-staff-app';

/** 앱 WebView에서 PC 전용 — 진입 차단 경로 prefix */
export const STAFF_APP_PC_ONLY_ADMIN_PATH_PREFIXES = ['/admin/crm'] as const;

export function isStaffAppPcOnlyAdminPath(pathname: string): boolean {
  const p = pathname.split('?')[0]?.replace(/\/+$/, '') || '';
  return STAFF_APP_PC_ONLY_ADMIN_PATH_PREFIXES.some(
    (prefix) => p === prefix || p.startsWith(`${prefix}/`),
  );
}

/** `/api/auth/me` role → WebView 홈 (로그인 직후) */
export type StaffAppWebHome = '/team/dashboard' | '/admin/dashboard';

export function resolveStaffAppHomeForRole(role: string | null | undefined): StaffAppWebHome | null {
  if (role === 'TEAM_LEADER' || role === 'EXTERNAL_PARTNER') return '/team/dashboard';
  if (role === 'ADMIN' || role === 'MARKETER' || role === 'OFFICE_STAFF') return '/admin/dashboard';
  return null;
}
