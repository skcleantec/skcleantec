import type { PrismaClient } from '@prisma/client';
import {
  type PlatformPromoAudience,
  serializeActivePromo,
  whereActivePlatformPromos,
} from './platformPartnerPromo.helpers.js';

export async function listActivePlatformPromos(
  db: PrismaClient,
  audience: PlatformPromoAudience,
) {
  const rows = await db.platformPartnerPromo.findMany({
    where: whereActivePlatformPromos(audience),
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(serializeActivePromo);
}
