import type { TelecrmUserCapabilities } from '@shared/telecrmTenantPolicy';
import type { ProfileOnboardingInitial } from '../components/common/ProfileOnboardingModal';
import { resolveCanCrmSettingsFromMe } from '../hooks/useAdminStaffSession';
import { parseTelecrmCapabilitiesFromMe } from './telecrmCapabilities';
import { resolveEffectiveStaffAdminFromMe, type StaffAdminMeFields } from './staffAdminAccess';
import { isTeamPreviewAdminEmail, shouldShowAdminDevPreviewLinks } from './teamPreview';
import { getToken } from '../stores/auth';
import { bootstrapAuthMeFromLocal, type AuthMeSnapshot } from '../api/authMeSnapshot';

export type AdminAuthMeHydration = {
  role: string | null;
  staffMe: StaffAdminMeFields | null;
  effectiveStaffAdmin: boolean;
  meUserId: string | null;
  meName: string | null;
  meEmail: string | null;
  mePhone: string | null;
  meVehicleNumber: string | null;
  showStagingDbImportMenu: boolean;
  showVolumeStatsMenu: boolean;
  isPlatformSupportAccess: boolean;
  suppressCelebrateBar: boolean;
  tenantFeatures: readonly string[] | null;
  tenantTelecrm: TelecrmUserCapabilities | null;
  tenantPlan: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  meTenantId: string | null;
  isTenantOwner: boolean;
  isSuperAdmin: boolean;
  canCrmSettings: boolean;
  profileOnboardingRequired: boolean;
  profileOnboardingInitial: ProfileOnboardingInitial;
  teamPreviewLink: boolean;
};

export function hydrateAdminSessionFromAuthMe(u: AuthMeSnapshot): AdminAuthMeHydration {
  const role = typeof u.role === 'string' ? u.role : null;
  const staffMe: StaffAdminMeFields | null = role
    ? {
        role,
        effectiveStaffAdminAccess: u.effectiveStaffAdminAccess as boolean | undefined,
        marketerAdminLevel: (u as { marketerAdminLevel?: StaffAdminMeFields['marketerAdminLevel'] })
          .marketerAdminLevel,
        marketerPermissions:
          (u.marketerPermissions as StaffAdminMeFields['marketerPermissions']) ?? null,
        marketerOperationalAdminAccess: Boolean(
          (u as { marketerOperationalAdminAccess?: boolean }).marketerOperationalAdminAccess,
        ),
      }
    : null;
  const email = typeof u.email === 'string' ? u.email : '';
  const tenantSlugForPreview =
    (typeof (u.tenant as { slug?: string } | undefined)?.slug === 'string' &&
      (u.tenant as { slug: string }).slug.trim()) ||
    null;

  return {
    role,
    staffMe,
    effectiveStaffAdmin: resolveEffectiveStaffAdminFromMe(staffMe ?? u),
    meUserId: typeof u.id === 'string' ? u.id : null,
    meName: typeof u.name === 'string' && u.name.trim() ? u.name.trim() : null,
    meEmail: typeof u.email === 'string' && u.email.trim() ? u.email.trim() : null,
    mePhone: typeof u.phone === 'string' && u.phone.trim() ? u.phone.trim() : null,
    meVehicleNumber:
      typeof u.vehicleNumber === 'string' && u.vehicleNumber.trim() ? u.vehicleNumber.trim() : null,
    showStagingDbImportMenu: Boolean(u.showStagingDbImport),
    showVolumeStatsMenu: Boolean(u.showVolumeStats),
    isPlatformSupportAccess: Boolean(u.isPlatformSupportAccess),
    suppressCelebrateBar: Boolean(u.isPlatformSupportAccess) || isTeamPreviewAdminEmail(email),
    tenantFeatures: Array.isArray(u.features) ? u.features : role ? [] : null,
    tenantTelecrm: parseTelecrmCapabilitiesFromMe((u as { telecrm?: unknown }).telecrm),
    tenantPlan:
      typeof (u.tenant as { plan?: string } | undefined)?.plan === 'string'
        ? (u.tenant as { plan: string }).plan
        : null,
    tenantSlug:
      typeof (u.tenant as { slug?: string } | undefined)?.slug === 'string'
        ? (u.tenant as { slug: string }).slug
        : null,
    tenantName:
      (typeof (u.tenant as { displayName?: string } | undefined)?.displayName === 'string' &&
        (u.tenant as { displayName: string }).displayName.trim()) ||
      (typeof (u.tenant as { name?: string } | undefined)?.name === 'string' &&
        (u.tenant as { name: string }).name.trim()) ||
      null,
    meTenantId:
      (typeof u.tenantId === 'string' && u.tenantId.trim()) ||
      (typeof (u.tenant as { id?: string } | undefined)?.id === 'string' &&
        (u.tenant as { id: string }).id.trim()) ||
      null,
    isTenantOwner: Boolean(u.isTenantOwner),
    isSuperAdmin: Boolean(u.isSuperAdmin),
    canCrmSettings: resolveCanCrmSettingsFromMe(u),
    profileOnboardingRequired: Boolean(u.profileOnboardingRequired) && role === 'MARKETER',
    profileOnboardingInitial: {
      role: role ?? 'MARKETER',
      name: typeof u.name === 'string' ? u.name : null,
      phone: typeof u.phone === 'string' ? u.phone : null,
      externalCompany:
        (u.externalCompany as ProfileOnboardingInitial['externalCompany']) ?? null,
    },
    teamPreviewLink: shouldShowAdminDevPreviewLinks({
      email,
      role,
      tenantSlug: tenantSlugForPreview,
    }),
  };
}

/** AdminLayout 첫 렌더 — JWT·스냅샷으로 /auth/me 응답 전 관리자 세션 즉시 복원 */
export function readInitialAdminSession(): AdminAuthMeHydration | null {
  const token = getToken();
  if (!token) return null;
  const boot = bootstrapAuthMeFromLocal(token);
  if (!boot?.role) return null;
  return hydrateAdminSessionFromAuthMe(boot);
}
