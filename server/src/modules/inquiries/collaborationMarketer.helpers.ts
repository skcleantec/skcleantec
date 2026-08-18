import type { Prisma, PrismaClient } from '@prisma/client';
import { InquiryCreateError } from './inquiryCreate.service.js';

export function parseCollaborationMarketerId(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  const id = String(raw).trim();
  return id || null;
}

/** 협업 마케터 검증 — 담당(접수) 마케터와 동일인 불가 */
export async function resolveCollaborationMarketerIdForWrite(
  db: PrismaClient | Prisma.TransactionClient,
  tenantId: string,
  raw: unknown,
  primaryMarketerId: string | null | undefined,
): Promise<string | null> {
  const next = parseCollaborationMarketerId(raw);
  if (!next) return null;
  const primary = primaryMarketerId?.trim() || null;
  if (primary && next === primary) {
    throw new InquiryCreateError('협업 마케터는 담당 마케터와 같을 수 없습니다.');
  }
  const collab = await db.user.findFirst({
    where: { id: next, tenantId },
    select: { id: true, role: true, isActive: true },
  });
  if (!collab || !collab.isActive || (collab.role !== 'ADMIN' && collab.role !== 'MARKETER')) {
    throw new InquiryCreateError('협업 마케터는 활성 관리자/마케터만 선택할 수 있습니다.');
  }
  return next;
}
