import { parseJwtPayload } from '../utils/jwtPayload';
import type { MarketerAdminLevel } from '@shared/marketerAdminLevel';
import type { MarketerPermissionMap } from '@shared/marketerPermissions';

const SNAPSHOT_KEY = 'sk_admin_me_snapshot_v1';

export type AuthMeSnapshot = {
  role?: string;
  id?: string;
  email?: string;
  name?: string;
  phone?: string | null;
  vehicleNumber?: string | null;
  tenantId?: string;
  features?: string[];
  telecrm?: unknown;
  tenant?: {
    id?: string;
    plan?: string;
    name?: string;
    displayName?: string;
    slug?: string;
  } | null;
  effectiveStaffAdminAccess?: boolean;
  marketerOperationalAdminAccess?: boolean;
  marketerAdminLevel?: MarketerAdminLevel | null;
  marketerPermissions?: MarketerPermissionMap | null;
  marketerAdminAccess?: boolean;
  isTenantOwner?: boolean;
  isSuperAdmin?: boolean;
  isPlatformSupportAccess?: boolean;
  showStagingDbImport?: boolean;
  showVolumeStats?: boolean;
  profileOnboardingRequired?: boolean;
  externalCompany?: unknown;
  [key: string]: unknown;
};

function tokenFingerprint(token: string): string {
  return token.length > 24 ? token.slice(-24) : token;
}

export function persistAuthMeSnapshot(token: string, data: AuthMeSnapshot): void {
  try {
    sessionStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({
        fp: tokenFingerprint(token),
        at: Date.now(),
        data,
      }),
    );
  } catch {
    /* ignore */
  }
}

export function readAuthMeSnapshot(token: string): AuthMeSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fp?: string; data?: AuthMeSnapshot };
    if (parsed.fp !== tokenFingerprint(token) || !parsed.data || typeof parsed.data !== 'object') {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function clearAuthMeSnapshot(): void {
  try {
    sessionStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    /* ignore */
  }
}

/** JWT + 직전 /auth/me 스냅샷으로 관리자 세션을 즉시 복원 (네트워크 대기 전) */
export function bootstrapAuthMeFromLocal(token: string): AuthMeSnapshot | null {
  const cached = readAuthMeSnapshot(token);
  if (cached?.role) return cached;

  const jwt = parseJwtPayload<{
    userId?: string;
    email?: string;
    role?: string;
    tenantId?: string;
    isTenantOwner?: boolean;
  }>(token);
  if (!jwt?.role) return null;

  return {
    id: typeof jwt.userId === 'string' ? jwt.userId : undefined,
    email: typeof jwt.email === 'string' ? jwt.email : undefined,
    role: jwt.role,
    tenantId: typeof jwt.tenantId === 'string' ? jwt.tenantId : undefined,
    isTenantOwner: jwt.isTenantOwner === true,
    effectiveStaffAdminAccess: jwt.role === 'ADMIN',
    marketerOperationalAdminAccess: jwt.role === 'ADMIN',
  };
}
