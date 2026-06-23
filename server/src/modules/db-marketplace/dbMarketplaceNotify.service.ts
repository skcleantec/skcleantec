import { prisma } from '../../lib/prisma.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';

async function activeAdminUserIds(tenantId: string): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { tenantId, role: 'ADMIN', isActive: true },
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

export async function notifyDbMarketplaceBuyerRequested(opts: {
  sellerTenantId: string;
}): Promise<void> {
  const userIds = await activeAdminUserIds(opts.sellerTenantId);
  if (userIds.length > 0) await notifyInboxRefresh(userIds);
}

export async function notifyDbMarketplaceConfirmed(opts: {
  sellerTenantId: string;
  buyerKind: 'PARTNER_TENANT' | 'EXTERNAL_COMPANY';
  buyerTenantId: string | null;
  buyerExternalCompanyId: string | null;
}): Promise<void> {
  const userIds = new Set<string>();
  for (const id of await activeAdminUserIds(opts.sellerTenantId)) userIds.add(id);

  if (opts.buyerKind === 'PARTNER_TENANT' && opts.buyerTenantId) {
    for (const id of await activeAdminUserIds(opts.buyerTenantId)) userIds.add(id);
  }
  if (opts.buyerKind === 'EXTERNAL_COMPANY' && opts.buyerExternalCompanyId) {
    for (const id of await externalPartnerUserIds(opts.sellerTenantId, opts.buyerExternalCompanyId)) {
      userIds.add(id);
    }
  }

  if (userIds.size > 0) await notifyInboxRefresh([...userIds]);
}
