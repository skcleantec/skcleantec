import type { PrismaClient } from '@prisma/client';
import { notifyNewAssignmentForInquiry } from '../push/inquiryTeamWebPush.js';
import {
  assertTeamLeadersMatchInquiryBrand,
  OperatingCompanyAssignmentError,
} from '../operating-companies/operatingCompanyAssignment.js';
import {
  assertInquiryTeamLeaderAssignmentZones,
  ServiceZoneAssignmentError,
} from '../service-zones/serviceZoneAssignment.js';
import { loadDispatchDay } from './aiDispatchContext.service.js';
import { rememberDispatchCorrection } from './aiDispatchLessons.js';
import type { AiDispatchSlot } from './aiDispatch.constants.js';

type Db = PrismaClient;

export async function updateDraftProposal(
  db: Db,
  tenantId: string,
  proposalId: string,
  input: { teamLeaderId: string | null; slot?: string },
) {
  const proposal = await db.aiDispatchProposal.findFirst({
    where: { id: proposalId, tenantId, status: 'DRAFT', run: { status: 'DRAFT', tenantId } },
    include: { run: { select: { workDate: true } } },
  });
  if (!proposal) return { error: '수정할 제안이 없습니다.' as const };
  const workDate = proposal.run.workDate.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  const day = await loadDispatchDay(db, tenantId, workDate);
  const job = day?.jobs.find((item) => item.id === proposal.inquiryId);
  if (!day || !job) return { error: '이 날짜의 접수를 찾지 못했습니다.' as const };
  if (job.updatedAt !== proposal.inquiryUpdatedAt.toISOString() && new Date(job.updatedAt) > proposal.inquiryUpdatedAt) {
    await db.aiDispatchProposal.updateMany({
      where: { id: proposal.id, tenantId },
      data: { status: 'STALE' },
    });
    return { error: '접수가 바뀌어 제안이 오래되었습니다. 다시 실행해 주세요.' as const };
  }
  const aiLeaderId = proposal.aiTeamLeaderId ?? (proposal.reason.includes('관리자가') ? null : proposal.teamLeaderId);
  const siblings = await db.aiDispatchProposal.findMany({
    where: { tenantId, runId: proposal.runId, id: { not: proposal.id } },
    select: {
      teamLeaderId: true,
      slot: true,
      inquiry: { select: { addressGeoLat: true, addressGeoLng: true } },
    },
  });
  try {
    await rememberDispatchCorrection(db, tenantId, {
      inquiryId: proposal.inquiryId,
      aiLeaderId,
      nextLeaderId: input.teamLeaderId,
      slot: job.slot,
      isOneRoom: job.isOneRoom,
      lat: job.lat,
      lng: job.lng,
      leaders: day.leaders,
      siblingStops: siblings.map((row) => ({
        teamLeaderId: row.teamLeaderId,
        slot: row.slot,
        lat: row.inquiry.addressGeoLat,
        lng: row.inquiry.addressGeoLng,
      })),
    });
  } catch (e) {
    console.error('[ai-dispatch] lesson', e instanceof Error ? e.message : 'unknown');
  }
  if (!input.teamLeaderId) {
    const updated = await db.aiDispatchProposal.update({
      where: { id: proposal.id },
      data: { teamLeaderId: null, slot: job.slot, reason: '관리자가 팀장을 뺐습니다.' },
    });
    return { proposal: updated };
  }
  const slot = (input.slot || job.slot) as AiDispatchSlot;
  if (slot !== job.slot) {
    return { error: '시간대를 접수와 다르게 바꿀 수 없습니다.' as const };
  }
  if (!day.leaders.some((leader) => leader.id === input.teamLeaderId)) {
    return { error: '이 날짜에 배정할 수 있는 팀장이 아닙니다.' as const };
  }
  const updated = await db.aiDispatchProposal.update({
    where: { id: proposal.id },
    data: {
      teamLeaderId: input.teamLeaderId,
      slot,
      reason: proposal.reason.includes('관리자가 수정') ? proposal.reason : `${proposal.reason} (관리자가 수정)`,
    },
  });
  return { proposal: updated };
}

export async function approveDraftProposals(db: Db, tenantId: string, actorId: string, proposalIds: string[]) {
  const uniqueIds = [...new Set(proposalIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return { error: '승인할 제안을 선택해 주세요.' as const };
  const proposals = await db.aiDispatchProposal.findMany({
    where: { id: { in: uniqueIds }, tenantId, status: 'DRAFT', teamLeaderId: { not: null }, run: { tenantId, status: 'DRAFT' } },
    include: { inquiry: { select: { id: true, status: true, address: true, operatingCompanyId: true, updatedAt: true, customerName: true } } },
  });
  if (proposals.length !== uniqueIds.length) return { error: '승인할 수 있는 제안만 선택해 주세요.' as const };

  const byInquiry = new Map<string, typeof proposals>();
  for (const proposal of proposals) {
    const list = byInquiry.get(proposal.inquiryId) ?? [];
    list.push(proposal);
    byInquiry.set(proposal.inquiryId, list);
  }

  const approvedInquiryIds: string[] = [];
  const failed: Array<{ inquiryId: string; error: string }> = [];

  for (const [inquiryId, rows] of byInquiry) {
    const inquiry = rows[0]?.inquiry;
    if (!inquiry) continue;
    if (rows.some((row) => inquiry.updatedAt > row.inquiryUpdatedAt)) {
      await db.aiDispatchProposal.updateMany({
        where: { id: { in: rows.map((row) => row.id) }, tenantId },
        data: { status: 'STALE' },
      });
      failed.push({ inquiryId, error: '접수가 바뀌어 제안이 오래되었습니다.' });
      continue;
    }
    if (inquiry.status !== 'RECEIVED' && inquiry.status !== 'ASSIGNED') {
      failed.push({ inquiryId, error: '예약완료 또는 배정 상태에서만 반영할 수 있습니다.' });
      continue;
    }
    const leaderIds = rows.map((row) => row.teamLeaderId).filter((id): id is string => Boolean(id));
    const assignees = await db.user.findMany({
      where: { tenantId, id: { in: leaderIds }, role: 'TEAM_LEADER', isActive: true },
      select: { id: true, role: true, operatingCompanyMemberships: { select: { operatingCompanyId: true } } },
    });
    if (assignees.length !== leaderIds.length) {
      failed.push({ inquiryId, error: '팀장 계정을 확인하지 못했습니다.' });
      continue;
    }
    try {
      await assertTeamLeadersMatchInquiryBrand({
        db,
        tenantId,
        inquiryOperatingCompanyId: inquiry.operatingCompanyId,
        assignees,
      });
      await assertInquiryTeamLeaderAssignmentZones({
        db,
        tenantId,
        inquiryAddress: inquiry.address,
        inquiryId,
        teamLeaderIds: leaderIds,
        internalTeamLeaderIds: leaderIds,
        assignmentServiceZoneId: null,
      });
    } catch (e) {
      const message =
        e instanceof OperatingCompanyAssignmentError || e instanceof ServiceZoneAssignmentError
          ? e.message
          : '배정 규칙을 통과하지 못했습니다.';
      failed.push({ inquiryId, error: message });
      continue;
    }

    const prev = await db.assignment.findMany({
      where: { tenantId, inquiryId },
      select: { teamLeaderId: true },
    });
    await db.$transaction(async (tx) => {
      await tx.assignment.deleteMany({ where: { tenantId, inquiryId } });
      await tx.assignment.createMany({
        data: leaderIds.map((teamLeaderId, index) => ({
          tenantId,
          inquiryId,
          teamLeaderId,
          assignedById: actorId,
          sortOrder: index,
        })),
      });
      if (inquiry.status === 'RECEIVED') {
        await tx.inquiry.updateMany({
          where: { id: inquiryId, tenantId },
          data: { status: 'ASSIGNED' },
        });
      }
      await tx.aiDispatchProposal.updateMany({
        where: { id: { in: rows.map((row) => row.id) }, tenantId },
        data: { status: 'APPROVED' },
      });
    });
    approvedInquiryIds.push(inquiryId);
    void notifyNewAssignmentForInquiry(
      tenantId,
      inquiryId,
      leaderIds,
      prev.map((row) => row.teamLeaderId),
    ).catch((e) => console.error('[ai-dispatch] notify', e));
  }

  const runIds = [...new Set(proposals.map((row) => row.runId))];
  for (const runId of runIds) {
    const left = await db.aiDispatchProposal.count({
      where: { runId, tenantId, status: 'DRAFT', teamLeaderId: { not: null } },
    });
    if (left === 0) {
      await db.aiDispatchRun.updateMany({
        where: { id: runId, tenantId, status: 'DRAFT' },
        data: { status: 'APPROVED' },
      });
    }
  }

  return { approvedInquiryIds, failed };
}
