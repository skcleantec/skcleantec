/** SK클린텍 L3 — server 전용 (shared/custom/skcleantecOpsUi.ts 와 동기화) */

import { prisma } from '../../lib/prisma.js';
import { getEffectiveEnabledModules } from '../tenants/tenantFeatures.service.js';

const SK_CLEANTEC_OPS_UI_FEATURE = 'custom_skcleanteck_ops_ui';
const SK_ONE_ROOM_LABEL = '원/투룸';
const DEFAULT_ONE_ROOM_LABEL = '원룸';

function isSkCleantecTenantSlug(slug: string | null | undefined): boolean {
  const s = slug?.trim().toLowerCase();
  return s === 'skcleanteck' || s === 'sk';
}

export function oneRoomLabelWhenSkOpsEnabled(enabled: boolean): string {
  return enabled ? SK_ONE_ROOM_LABEL : DEFAULT_ONE_ROOM_LABEL;
}

export async function isSkCleantecOpsUiEnabled(tenantId: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });
  if (!isSkCleantecTenantSlug(tenant?.slug)) return false;
  const modules = await getEffectiveEnabledModules(tenantId);
  return modules.includes(SK_CLEANTEC_OPS_UI_FEATURE);
}
