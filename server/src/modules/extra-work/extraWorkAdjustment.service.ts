import type { ExtraWorkSettlementKind } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { splitExtraWorkAmount } from '../../lib/extraWorkIncentive.js';
import { mapExtraWorkRecord, ratesForMarketer } from './extraWork.service.js';

export type ExtraWorkAdjustmentKind = 'REFUND' | 'COMPANY_SUPPORT' | 'NORMAL';

function occurredAtFromYmd(ymd: string) {
  return new Date(`${ymd}T12:00:00+09:00`);
}

function moneyForKind(params: {
  kind: ExtraWorkAdjustmentKind;
  magnitude: number;
  rates: NonNullable<Awaited<ReturnType<typeof ratesForMarketer>>>;
  teamLeaderIds: string[];
}) {
  if (params.kind === 'COMPANY_SUPPORT') {
    const leaders = params.teamLeaderIds.filter(Boolean);
    if (leaders.length === 0) {
      return {
        amountWon: 0,
        companyWon: -params.magnitude,
        teamLeaderWon: 0,
        marketerWon: params.magnitude,
        parentWon: 0,
        leaderShares: [] as Array<{ teamLeaderId: string; amountWon: number }>,
      };
    }
    const base = Math.floor(params.magnitude / leaders.length);
    const remainder = params.magnitude - base * leaders.length;
    const leaderShares = leaders.map((teamLeaderId, index) => ({
      teamLeaderId,
      amountWon: base + (index === leaders.length - 1 ? remainder : 0),
    }));
    return {
      amountWon: 0,
      companyWon: -params.magnitude,
      teamLeaderWon: params.magnitude,
      marketerWon: 0,
      parentWon: 0,
      leaderShares,
    };
  }
  const split = splitExtraWorkAmount({
    amountWon: params.magnitude,
    companyBps: params.rates.companyBps,
    teamLeaderBps: params.rates.teamLeaderBps,
    marketerBps: params.rates.marketerBps,
    overrideSource: params.rates.overrideSource,
    overrideBps: params.rates.overrideBps,
    hasParent: Boolean(params.rates.parentMarketerId),
    teamLeaderIds: params.teamLeaderIds,
  });
  const sign = params.kind === 'REFUND' ? -1 : 1;
  return {
    amountWon: sign * params.magnitude,
    companyWon: sign * split.companyWon,
    teamLeaderWon: sign * split.teamLeaderWon,
    marketerWon: sign * split.marketerWon,
    parentWon: sign * split.parentWon,
    leaderShares: split.leaderShares.map((share) => ({
      teamLeaderId: share.teamLeaderId,
      amountWon: sign * share.amountWon,
    })),
  };
}

async function leadersOf(tenantId: string, teamLeaderIds: string[]) {
  const ids = [...new Set(teamLeaderIds.filter(Boolean))];
  if (ids.length === 0) return [];
  const rows = await prisma.user.findMany({
    where: { tenantId, id: { in: ids }, role: 'TEAM_LEADER', isActive: true },
    select: { id: true },
  });
  if (rows.length !== ids.length) throw new Error('같은 업체의 팀장을 골라 주세요.');
  return ids;
}

export async function searchExtraWorkInquiries(tenantId: string, query: string) {
  const q = query.trim();
  if (q.length < 1) return [];
  const rows = await prisma.inquiry.findMany({
    where: {
      tenantId,
      OR: [
        { customerName: { contains: q, mode: 'insensitive' } },
        { inquiryNumber: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      customerName: true,
      inquiryNumber: true,
      assignments: {
        orderBy: { sortOrder: 'asc' },
        select: { teamLeader: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
  });
  return rows.map((row) => ({
    id: row.id,
    customerName: row.customerName,
    inquiryNumber: row.inquiryNumber,
    teamLeaders: row.assignments.map((item) => ({ id: item.teamLeader.id, name: item.teamLeader.name })),
  }));
}

export async function saveExtraWorkAdjustment(params: {
  tenantId: string;
  actorId: string;
  recordId?: string | null;
  inquiryId: string;
  marketerId: string;
  teamLeaderId: string | null;
  kind: ExtraWorkAdjustmentKind;
  amountWon: number;
  occurredOn: string;
  note: string;
}) {
  if (!Number.isInteger(params.amountWon) || params.amountWon < 1 || params.amountWon > 100_000_000) {
    throw new Error('금액은 1원 이상 정수로 적어 주세요.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.occurredOn)) throw new Error('날짜를 골라 주세요.');
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: params.inquiryId, tenantId: params.tenantId },
    select: { id: true },
  });
  if (!inquiry) throw new Error('접수를 찾을 수 없습니다.');
  const rates = await ratesForMarketer(params.tenantId, params.marketerId);
  if (!rates) throw new Error('마케터를 골라 주세요.');
  const teamLeaderIds = await leadersOf(params.tenantId, params.teamLeaderId ? [params.teamLeaderId] : []);
  const money = moneyForKind({ kind: params.kind, magnitude: params.amountWon, rates, teamLeaderIds });
  const note = params.note.trim().slice(0, 80);
  const workLabel = note || (params.kind === 'COMPANY_SUPPORT' ? '회사 지원' : params.kind === 'REFUND' ? '환불' : '추가 시공');
  const settlementKind = params.kind as ExtraWorkSettlementKind;
  const data = {
    inquiryId: inquiry.id,
    marketerId: params.marketerId,
    occurredAt: occurredAtFromYmd(params.occurredOn),
    amountWon: money.amountWon,
    workLabel,
    companyBps: rates.companyBps,
    teamLeaderBps: rates.teamLeaderBps,
    marketerBps: rates.marketerBps,
    overrideSource: params.kind === 'COMPANY_SUPPORT' || !rates.parentMarketerId ? 'NONE' : rates.overrideSource,
    overrideBps: params.kind === 'COMPANY_SUPPORT' || !rates.parentMarketerId ? 0 : rates.overrideBps,
    parentMarketerId: params.kind === 'COMPANY_SUPPORT' ? null : rates.parentMarketerId,
    companyWon: money.companyWon,
    teamLeaderWon: money.teamLeaderWon,
    marketerWon: money.marketerWon,
    parentWon: params.kind === 'COMPANY_SUPPORT' ? 0 : money.parentWon,
    settlementKind,
  };
  const recordId = params.recordId?.trim() || '';
  const savedId = await prisma.$transaction(async (tx) => {
    if (!recordId) {
      const created = await tx.extraWorkRecord.create({
        data: {
          ...data,
          tenantId: params.tenantId,
          createdById: params.actorId,
          leaderShares: {
            create: money.leaderShares.map((share) => ({
              tenantId: params.tenantId,
              teamLeaderId: share.teamLeaderId,
              amountWon: share.amountWon,
            })),
          },
        },
        select: { id: true },
      });
      return created.id;
    }
    const existing = await tx.extraWorkRecord.findFirst({
      where: { id: recordId, tenantId: params.tenantId },
      select: { id: true },
    });
    if (!existing) throw new Error('추가 시공을 찾을 수 없습니다.');
    await tx.extraWorkLeaderShare.deleteMany({ where: { tenantId: params.tenantId, recordId } });
    await tx.extraWorkRecord.update({
      where: { id: recordId },
      data: {
        ...data,
        leaderShares: {
          create: money.leaderShares.map((share) => ({
            tenantId: params.tenantId,
            teamLeaderId: share.teamLeaderId,
            amountWon: share.amountWon,
          })),
        },
      },
    });
    return recordId;
  });
  const row = await prisma.extraWorkRecord.findFirst({
    where: { id: savedId, tenantId: params.tenantId },
    include: {
      marketer: { select: { id: true, name: true } },
      parentMarketer: { select: { id: true, name: true } },
      inquiry: { select: { id: true, customerName: true, inquiryNumber: true } },
      photos: { select: { id: true, originalName: true }, orderBy: { createdAt: 'asc' } },
      lines: {
        orderBy: { sortOrder: 'asc' },
        select: {
          workLabel: true,
          placeLabel: true,
          quantity: true,
          unitLabel: true,
          amountWon: true,
          photos: { select: { originalName: true }, orderBy: { createdAt: 'asc' } },
        },
      },
      leaderShares: { select: { amountWon: true, teamLeader: { select: { id: true, name: true } } } },
    },
  });
  if (!row) throw new Error('정산을 저장하지 못했습니다.');
  return mapExtraWorkRecord(row);
}
