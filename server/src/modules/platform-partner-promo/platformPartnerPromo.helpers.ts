import type { Prisma, PlatformPartnerPromo } from '@prisma/client';

export type PlatformPromoAudience = 'external_partner' | 'tenant_staff';

export type PlatformPromoActiveDto = {
  id: string;
  mobileImageUrl: string;
  desktopImageUrl: string;
  linkUrl: string | null;
  linkTarget: string;
  sortOrder: number;
  showOnMobile: boolean;
  showOnDesktop: boolean;
  showOnTeamDashboard: boolean;
  showOnTeamAssignments: boolean;
  showOnTeamSchedule: boolean;
};

export type PlatformPromoAdminDto = PlatformPromoActiveDto & {
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  showOnMobile: boolean;
  showOnDesktop: boolean;
  showToExternalPartner: boolean;
  showToTenantStaff: boolean;
  showOnTeamDashboard: boolean;
  showOnTeamAssignments: boolean;
  showOnTeamSchedule: boolean;
  createdAt: string;
  updatedAt: string;
};

const HTTPS_LINK = /^https:\/\/.+/i;

export function parsePromoLinkUrl(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string') throw new Error('링크 URL 형식이 올바르지 않습니다.');
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!HTTPS_LINK.test(trimmed)) {
    throw new Error('링크는 https:// 로 시작해야 합니다.');
  }
  return trimmed;
}

export function parsePromoLinkTarget(raw: unknown): '_blank' | '_self' {
  if (raw === '_self') return '_self';
  return '_blank';
}

export function whereActivePlatformPromos(audience: PlatformPromoAudience): Prisma.PlatformPartnerPromoWhereInput {
  const now = new Date();
  const audienceWhere =
    audience === 'external_partner'
      ? { showToExternalPartner: true }
      : { showToTenantStaff: true };

  return {
    isActive: true,
    ...audienceWhere,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    ],
  };
}

export function serializeActivePromo(row: PlatformPartnerPromo): PlatformPromoActiveDto {
  return {
    id: row.id,
    mobileImageUrl: row.mobileImageUrl,
    desktopImageUrl: row.desktopImageUrl,
    linkUrl: row.linkUrl,
    linkTarget: row.linkTarget,
    sortOrder: row.sortOrder,
    showOnMobile: row.showOnMobile,
    showOnDesktop: row.showOnDesktop,
    showOnTeamDashboard: row.showOnTeamDashboard,
    showOnTeamAssignments: row.showOnTeamAssignments,
    showOnTeamSchedule: row.showOnTeamSchedule,
  };
}

export function serializeAdminPromo(row: PlatformPartnerPromo): PlatformPromoAdminDto {
  return {
    ...serializeActivePromo(row),
    title: row.title,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    isActive: row.isActive,
    showOnMobile: row.showOnMobile,
    showOnDesktop: row.showOnDesktop,
    showToExternalPartner: row.showToExternalPartner,
    showToTenantStaff: row.showToTenantStaff,
    showOnTeamDashboard: row.showOnTeamDashboard,
    showOnTeamAssignments: row.showOnTeamAssignments,
    showOnTeamSchedule: row.showOnTeamSchedule,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function promoScheduleStatus(row: Pick<PlatformPartnerPromo, 'isActive' | 'startsAt' | 'endsAt'>): string {
  if (!row.isActive) return '비활성';
  const now = Date.now();
  if (row.startsAt && row.startsAt.getTime() > now) return '예정';
  if (row.endsAt && row.endsAt.getTime() <= now) return '종료';
  return '게시중';
}

export const PLATFORM_PARTNER_PROMO_UPLOAD_FOLDER = 'platform/partner-promo';
