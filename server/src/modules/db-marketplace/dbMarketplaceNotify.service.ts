import { prisma } from '../../lib/prisma.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';

export type DbMarketplaceAudienceRef = {
  audienceKind: string;
  partnerTenantId: string | null;
  externalCompanyId: string | null;
};

async function activeStaffAdminMarketerUserIds(tenantId: string): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { tenantId, role: { in: ['ADMIN', 'MARKETER'] }, isActive: true },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function externalPartnerUserIds(tenantId: string, externalCompanyId: string): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: {
      tenantId,
      role: 'EXTERNAL_PARTNER',
      externalCompanyId,
      isActive: true,
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function resolveDbMarketplaceWatcherUserIds(opts: {
  sellerTenantId: string;
  visibility: string;
  audiences: DbMarketplaceAudienceRef[];
}): Promise<string[]> {
  const userIds = new Set<string>();

  if (opts.visibility === 'ALL') {
    const partnerships = await prisma.tenantPartnership.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ tenantLowId: opts.sellerTenantId }, { tenantHighId: opts.sellerTenantId }],
      },
      select: { tenantLowId: true, tenantHighId: true },
    });
    for (const p of partnerships) {
      const partnerId = p.tenantLowId === opts.sellerTenantId ? p.tenantHighId : p.tenantLowId;
      for (const id of await activeStaffAdminMarketerUserIds(partnerId)) userIds.add(id);
    }
    const externalPartners = await prisma.user.findMany({
      where: {
        tenantId: opts.sellerTenantId,
        role: 'EXTERNAL_PARTNER',
        isActive: true,
      },
      select: { id: true },
    });
    for (const u of externalPartners) userIds.add(u.id);
  } else {
    for (const a of opts.audiences) {
      if (a.audienceKind === 'PARTNER_TENANT' && a.partnerTenantId) {
        for (const id of await activeStaffAdminMarketerUserIds(a.partnerTenantId)) userIds.add(id);
      }
      if (a.audienceKind === 'EXTERNAL_COMPANY' && a.externalCompanyId) {
        for (const id of await externalPartnerUserIds(opts.sellerTenantId, a.externalCompanyId)) {
          userIds.add(id);
        }
      }
    }
  }

  return [...userIds];
}

function mapAudiences(
  audiences: DbMarketplaceAudienceRef[],
): DbMarketplaceAudienceRef[] {
  return audiences.map((a) => ({
    audienceKind: a.audienceKind,
    partnerTenantId: a.partnerTenantId ?? null,
    externalCompanyId: a.externalCompanyId ?? null,
  }));
}

/** 판매자 테넌트 관리자만 — 장바구니 배지·내 판매 탭 */
export async function notifyDbMarketplaceSellerAdmins(tenantId: string): Promise<void> {
  const userIds = await activeStaffAdminMarketerUserIds(tenantId);
  if (userIds.length > 0) await notifyInboxRefresh(userIds);
}

/** 게시·철회·노출 변경 — 판매자 + 구매 가능 시청자 */
export async function notifyDbMarketplaceBroadcast(opts: {
  sellerTenantId: string;
  visibility: string;
  audiences: DbMarketplaceAudienceRef[];
}): Promise<void> {
  const userIds = new Set<string>();
  for (const id of await activeStaffAdminMarketerUserIds(opts.sellerTenantId)) userIds.add(id);
  for (const id of await resolveDbMarketplaceWatcherUserIds({
    sellerTenantId: opts.sellerTenantId,
    visibility: opts.visibility,
    audiences: mapAudiences(opts.audiences),
  })) {
    userIds.add(id);
  }
  if (userIds.size > 0) await notifyInboxRefresh([...userIds]);
}

export async function notifyDbMarketplaceBuyerRequested(opts: {
  sellerTenantId: string;
  visibility: string;
  audiences: DbMarketplaceAudienceRef[];
  buyerTenantId: string | null;
  buyerExternalCompanyId: string | null;
}): Promise<void> {
  const userIds = new Set<string>();
  for (const id of await activeStaffAdminMarketerUserIds(opts.sellerTenantId)) userIds.add(id);
  for (const id of await resolveDbMarketplaceWatcherUserIds({
    sellerTenantId: opts.sellerTenantId,
    visibility: opts.visibility,
    audiences: mapAudiences(opts.audiences),
  })) {
    userIds.add(id);
  }
  if (opts.buyerTenantId) {
    for (const id of await activeStaffAdminMarketerUserIds(opts.buyerTenantId)) userIds.add(id);
  }
  if (opts.buyerExternalCompanyId) {
    for (const id of await externalPartnerUserIds(opts.sellerTenantId, opts.buyerExternalCompanyId)) {
      userIds.add(id);
    }
  }
  if (userIds.size > 0) await notifyInboxRefresh([...userIds]);
}

export async function notifyDbMarketplaceConfirmed(opts: {
  sellerTenantId: string;
  buyerKind: 'PARTNER_TENANT' | 'EXTERNAL_COMPANY';
  buyerTenantId: string | null;
  buyerExternalCompanyId: string | null;
}): Promise<void> {
  const userIds = new Set<string>();
  for (const id of await activeStaffAdminMarketerUserIds(opts.sellerTenantId)) userIds.add(id);

  if (opts.buyerKind === 'PARTNER_TENANT' && opts.buyerTenantId) {
    for (const id of await activeStaffAdminMarketerUserIds(opts.buyerTenantId)) userIds.add(id);
  }
  if (opts.buyerKind === 'EXTERNAL_COMPANY' && opts.buyerExternalCompanyId) {
    for (const id of await externalPartnerUserIds(opts.sellerTenantId, opts.buyerExternalCompanyId)) {
      userIds.add(id);
    }
  }

  if (userIds.size > 0) await notifyInboxRefresh([...userIds]);
}

/** 판매자 구매 신청 거절 — OPEN 복귀, 판매자·구매자·시청자 갱신 */
export async function notifyDbMarketplaceSellerDeclined(opts: {
  sellerTenantId: string;
  visibility: string;
  audiences: DbMarketplaceAudienceRef[];
  buyerTenantId: string | null;
  buyerExternalCompanyId: string | null;
}): Promise<void> {
  const userIds = new Set<string>();
  for (const id of await activeStaffAdminMarketerUserIds(opts.sellerTenantId)) userIds.add(id);
  for (const id of await resolveDbMarketplaceWatcherUserIds({
    sellerTenantId: opts.sellerTenantId,
    visibility: opts.visibility,
    audiences: mapAudiences(opts.audiences),
  })) {
    userIds.add(id);
  }
  if (opts.buyerTenantId) {
    for (const id of await activeStaffAdminMarketerUserIds(opts.buyerTenantId)) userIds.add(id);
  }
  if (opts.buyerExternalCompanyId) {
    for (const id of await externalPartnerUserIds(opts.sellerTenantId, opts.buyerExternalCompanyId)) {
      userIds.add(id);
    }
  }
  if (userIds.size > 0) await notifyInboxRefresh([...userIds]);
}

/** listing Q&A 등록 — 판매자·시청자·구매 신청자(해당 시) 갱신 */
export async function notifyDbMarketplaceMessagePosted(opts: {
  sellerTenantId: string;
  visibility: string;
  audiences: DbMarketplaceAudienceRef[];
  buyerTenantId: string | null;
  buyerExternalCompanyId: string | null;
  authorUserId: string;
}): Promise<void> {
  const userIds = new Set<string>();
  for (const id of await activeStaffAdminMarketerUserIds(opts.sellerTenantId)) userIds.add(id);
  for (const id of await resolveDbMarketplaceWatcherUserIds({
    sellerTenantId: opts.sellerTenantId,
    visibility: opts.visibility,
    audiences: mapAudiences(opts.audiences),
  })) {
    userIds.add(id);
  }
  if (opts.buyerTenantId) {
    for (const id of await activeStaffAdminMarketerUserIds(opts.buyerTenantId)) userIds.add(id);
  }
  if (opts.buyerExternalCompanyId) {
    for (const id of await externalPartnerUserIds(opts.sellerTenantId, opts.buyerExternalCompanyId)) {
      userIds.add(id);
    }
  }
  userIds.delete(opts.authorUserId);
  if (userIds.size > 0) await notifyInboxRefresh([...userIds]);
}

/** listing hold 생성·해제 — 판매자·시청자·(해제 시) 이전 예약자 갱신 */
export async function notifyDbMarketplaceHoldChanged(opts: {
  sellerTenantId: string;
  visibility: string;
  audiences: DbMarketplaceAudienceRef[];
  buyerTenantId: string | null;
  buyerExternalCompanyId: string | null;
  authorUserId: string | null;
}): Promise<void> {
  const userIds = new Set<string>();
  for (const id of await activeStaffAdminMarketerUserIds(opts.sellerTenantId)) userIds.add(id);
  for (const id of await resolveDbMarketplaceWatcherUserIds({
    sellerTenantId: opts.sellerTenantId,
    visibility: opts.visibility,
    audiences: mapAudiences(opts.audiences),
  })) {
    userIds.add(id);
  }
  if (opts.buyerTenantId) {
    for (const id of await activeStaffAdminMarketerUserIds(opts.buyerTenantId)) userIds.add(id);
  }
  if (opts.buyerExternalCompanyId) {
    for (const id of await externalPartnerUserIds(opts.sellerTenantId, opts.buyerExternalCompanyId)) {
      userIds.add(id);
    }
  }
  if (opts.authorUserId) userIds.delete(opts.authorUserId);
  if (userIds.size > 0) await notifyInboxRefresh([...userIds]);
}
