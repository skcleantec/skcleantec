import type { Prisma } from '@prisma/client';
import { createdAtRangeFromQuery } from '../inquiries/inquiryListDateRange.js';

export type EContractListQuery = {
  datePreset?: string;
  month?: string;
  day?: string;
  teamLeaderId?: string;
  limit: number;
  offset: number;
};

export function parseEContractListQuery(query: Record<string, unknown>): EContractListQuery {
  const limitRaw = typeof query.limit === 'string' ? parseInt(query.limit, 10) : NaN;
  const offsetRaw = typeof query.offset === 'string' ? parseInt(query.offset, 10) : 0;
  const teamLeaderId = typeof query.teamLeaderId === 'string' ? query.teamLeaderId.trim() : '';
  return {
    datePreset: typeof query.datePreset === 'string' ? query.datePreset.trim() : undefined,
    month: typeof query.month === 'string' ? query.month.trim() : undefined,
    day: typeof query.day === 'string' ? query.day.trim() : undefined,
    teamLeaderId: teamLeaderId || undefined,
    limit: Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 30,
    offset: Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0,
  };
}

/** 체결 기록 — `signedAt` 기준 KST 구간 */
export function signedAtRangeFromQuery(q: Pick<EContractListQuery, 'datePreset' | 'month' | 'day'>) {
  return createdAtRangeFromQuery(q);
}

/** 발급 목록 — `createdAt`(발급일) 기준 KST 구간 */
export function issuanceCreatedAtRangeFromQuery(q: Pick<EContractListQuery, 'datePreset' | 'month' | 'day'>) {
  return createdAtRangeFromQuery(q);
}

export function submissionWhereFromListQuery(
  query: EContractListQuery
): Prisma.EContractSubmissionWhereInput {
  const range = signedAtRangeFromQuery(query);
  const where: Prisma.EContractSubmissionWhereInput = {};
  if (range) where.signedAt = range;
  if (query.teamLeaderId) {
    where.issuance = { teamLeaderId: query.teamLeaderId };
  }
  return where;
}

export function issuanceWhereForTeamLeader(
  teamLeaderId: string,
  query: Pick<EContractListQuery, 'datePreset' | 'month' | 'day'>
): Prisma.EContractIssuanceWhereInput {
  const range = issuanceCreatedAtRangeFromQuery(query);
  const where: Prisma.EContractIssuanceWhereInput = { teamLeaderId };
  if (range) where.createdAt = range;
  return where;
}
