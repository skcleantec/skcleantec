import { prisma } from './prisma.js';
import { isSoloOperatorTenant } from './soloOperator.js';
import { getEffectiveEnabledModules } from '../modules/tenants/tenantFeatures.service.js';

/**
 * 현장 담당.
 * 배정된 팀장이 있으면 그 팀장 id.
 * 배정이 없고 1인 업체면 활성 ADMIN id.
 * 본사(배정 켜짐)에서 배정이 없으면 빈 배열 — 관리자를 더하지 않는다.
 */
export async function resolveFieldOwnerIds(tenantId: string, inquiryId: string): Promise<string[]> {
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: inquiryId, tenantId },
    select: { id: true },
  });
  if (!inquiry) return [];

  const assignments = await prisma.assignment.findMany({
    where: { tenantId, inquiryId },
    select: { teamLeaderId: true },
  });
  const leaderIds: string[] = [];
  const seen = new Set<string>();
  for (const row of assignments) {
    if (!row.teamLeaderId || seen.has(row.teamLeaderId)) continue;
    seen.add(row.teamLeaderId);
    leaderIds.push(row.teamLeaderId);
  }
  if (leaderIds.length > 0) return leaderIds;

  const enabled = await getEffectiveEnabledModules(tenantId);
  if (!isSoloOperatorTenant(enabled)) return [];

  const admins = await prisma.user.findMany({
    where: { tenantId, role: 'ADMIN', isActive: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  return admins.map((row) => row.id);
}
