import type { Prisma } from '@prisma/client';
import { inquiryTrashRetentionDays } from '../../lib/inquiryTrashRetention.js';

/** 활성(미삭제) 접수만 — 모든 업무 목록·조회에 병합 */
export function inquiryActiveOnlyWhere(): Pick<Prisma.InquiryWhereInput, 'deletedAt'> {
  return { deletedAt: null };
}

export function inquiryTrashedOnlyWhere(): Pick<Prisma.InquiryWhereInput, 'deletedAt'> {
  return { deletedAt: { not: null } };
}

export function withActiveInquiryScope(
  tenantId: string,
  where: Prisma.InquiryWhereInput = {},
): Prisma.InquiryWhereInput {
  return { ...where, tenantId, deletedAt: null };
}

export function withTrashedInquiryScope(
  tenantId: string,
  where: Prisma.InquiryWhereInput = {},
): Prisma.InquiryWhereInput {
  return { ...where, tenantId, deletedAt: { not: null } };
}

/** KST 자정 기준 — 이 시각 이전 deletedAt 은 영구 삭제 대상 */
export function inquiryTrashPurgeCutoffDate(retentionDays?: number): Date {
  const days = retentionDays ?? inquiryTrashRetentionDays();
  const kstYmd = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  const [y, m, d] = kstYmd.split('-').map(Number);
  const utcMs = Date.UTC(y, m - 1, d - days, -9, 0, 0, 0);
  return new Date(utcMs);
}

export function inquiryTrashPurgeAtKst(deletedAt: Date, retentionDays?: number): string {
  const days = retentionDays ?? inquiryTrashRetentionDays();
  const kstYmd = deletedAt.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  const [y, m, d] = kstYmd.split('-').map(Number);
  const purgeUtc = Date.UTC(y, m - 1, d + days, -9, 0, 0, 0);
  return new Date(purgeUtc).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

export function inquiryTrashDaysRemaining(deletedAt: Date, retentionDays?: number): number {
  const purgeYmd = inquiryTrashPurgeAtKst(deletedAt, retentionDays);
  const todayYmd = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  const purgeMs = new Date(`${purgeYmd}T12:00:00+09:00`).getTime();
  const todayMs = new Date(`${todayYmd}T12:00:00+09:00`).getTime();
  return Math.max(0, Math.ceil((purgeMs - todayMs) / (24 * 60 * 60 * 1000)));
}
