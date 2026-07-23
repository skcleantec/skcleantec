import type { PrismaClient } from '@prisma/client';
import {
  type PlatformPromoAudience,
  serializeActivePromo,
  whereActivePlatformPromos,
} from './platformPartnerPromo.helpers.js';
import { applyPromoDisplayOrder, audienceOrderMode } from './platformPartnerPromoOrder.service.js';
import { ensurePlatformPartnerPromoSettings } from './platformPartnerPromoSettings.service.js';

export async function listActivePlatformPromos(
  db: PrismaClient,
  audience: PlatformPromoAudience,
) {
  const [rows, settings] = await Promise.all([
    db.platformPartnerPromo.findMany({
      where: whereActivePlatformPromos(audience),
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    ensurePlatformPartnerPromoSettings(db),
  ]);

  const audienceMode = audienceOrderMode(audience, settings);
  const ordered = applyPromoDisplayOrder(rows, audienceMode);
  return ordered.map(serializeActivePromo);
}
