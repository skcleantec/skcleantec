import { config } from '../../config/index.js';

/** 운영(소스) DB URL에 sslmode 보강 — 값만 반환, 로깅 금지 */
export function ensureDatabaseUrlSslMode(url: string): string {
  const u = url.trim();
  if (!u) return u;
  if (/[?&]sslmode=/i.test(u)) return u;
  return u.includes('?') ? `${u}&sslmode=require` : `${u}?sslmode=require`;
}

export function userMayUseStagingDbImport(role: string | undefined, email: string | undefined): boolean {
  if (!config.stagingDbImport.enabled) return false;
  if (role !== 'ADMIN') return false;
  const em = (email ?? '').toLowerCase();
  const sub = config.stagingDbImport.operatorEmailSubstring.toLowerCase();
  return sub.length > 0 && em.includes(sub);
}

/**
 * 플랫폼 운영자(소유자) 판별 — 스테이징 import 활성화 여부와 무관(운영에서도 true).
 * 인프라 진단(볼륨 상태 등) 노출 게이트로 사용. ADMIN + 운영자 이메일 substring.
 */
export function userIsPlatformOperator(role: string | undefined, email: string | undefined): boolean {
  if (role !== 'ADMIN') return false;
  const em = (email ?? '').toLowerCase();
  const sub = config.stagingDbImport.operatorEmailSubstring.toLowerCase();
  return sub.length > 0 && em.includes(sub);
}
