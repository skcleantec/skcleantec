import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { assignmentTeamLeaderSelect } from './assignmentTeamLeaderSelect.js';
import { dateToYmdKst } from '../users/userEmployment.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { notifyChangeLogToStaff } from '../realtime/changeLogNotify.js';
import { resolveTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { attachDistanceFromJuanForInquiry } from './inquiryJuanDistance.js';
import { inquiryDetailInclude } from './inquiryDetailInclude.js';
import {
  inquiryHasActivePartnerShareSource,
  inquiryHasExternalPartnerAssignment,
} from './inquiryExternalPartnerShareMutex.js';

const swapInclude = {
  assignments: {
    orderBy: { sortOrder: 'asc' as const },
    include: { teamLeader: { select: assignmentTeamLeaderSelect } },
  },
} as const;

const BLOCKED_SWAP_STATUSES = new Set([
  'CANCELLED',
  'ON_HOLD',
  'PENDING',
  'DEPOSIT_PENDING',
  'DEPOSIT_COMPLETED',
  'ORDER_FORM_PENDING',
]);

function toLeaderLabel(u: { name: string; role: string; externalCompany: { name: string } | null }) {
  return u.role === 'EXTERNAL_PARTNER'
    ? `[타업체] ${u.externalCompany?.name ?? u.name}`
    : u.name;
}

function nativeAssignments(row: {
  assignments: Array<{
    id: string;
    teamLeaderId: string;
    noCrewMembers: boolean;
    teamLeader: { role: string; name: string; externalCompany: { name: string } | null };
  }>;
}) {
  return row.assignments.filter((a) => a.teamLeader.role !== 'EXTERNAL_PARTNER');
}

/**
 * POST /api/inquiries/:id/swap-leader-with-partner
 * 같은 예약일(KST)의 다른 접수와, 지정한 자사 팀장 1쌍을 서로 교환합니다.
 */
export async function handlePostSwapLeaderWithPartner(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const body = req.body as {
    partnerInquiryId?: unknown;
    myLeaderId?: unknown;
    partnerLeaderId?: unknown;
  };
  const partnerInquiryId =
    typeof body.partnerInquiryId === 'string' ? body.partnerInquiryId.trim() : '';
  const myLeaderIdRaw = typeof body.myLeaderId === 'string' ? body.myLeaderId.trim() : '';
  const partnerLeaderIdRaw =
    typeof body.partnerLeaderId === 'string' ? body.partnerLeaderId.trim() : '';
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await resolveTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }

  if (!partnerInquiryId || partnerInquiryId === id) {
    res.status(400).json({ error: '맞바꿀 상대 접수를 선택해주세요.' });
    return;
  }

  const [a, b] = await Promise.all([
    prisma.inquiry.findFirst({ where: { id, tenantId }, include: swapInclude }),
    prisma.inquiry.findFirst({ where: { id: partnerInquiryId, tenantId }, include: swapInclude }),
  ]);

  if (!a || !b) {
    res.status(404).json({ error: '접수를 찾을 수 없습니다.' });
    return;
  }

  if (BLOCKED_SWAP_STATUSES.has(a.status) || BLOCKED_SWAP_STATUSES.has(b.status)) {
    res.status(400).json({
      error:
        '대기·입금·미제출·보류·취소 등의 상태인 접수는 팀장 맞바꿈을 할 수 없습니다. 분배·진행 중인 건끼리만 가능합니다.',
    });
    return;
  }

  if (
    (await inquiryHasActivePartnerShareSource(prisma, a.id)) ||
    (await inquiryHasActivePartnerShareSource(prisma, b.id))
  ) {
    res.status(400).json({ error: '파트너 연계 접수는 팀장 맞바꿈을 할 수 없습니다.' });
    return;
  }

  if (
    (await inquiryHasExternalPartnerAssignment(prisma, tenantId, a.id)) ||
    (await inquiryHasExternalPartnerAssignment(prisma, tenantId, b.id))
  ) {
    res.status(400).json({ error: '타업체 담당 접수는 팀장 맞바꿈을 할 수 없습니다.' });
    return;
  }

  if (!a.preferredDate || !b.preferredDate) {
    res.status(400).json({ error: '예약일이 없는 접수는 팀장 맞바꿈을 할 수 없습니다.' });
    return;
  }
  const ymdA = dateToYmdKst(new Date(a.preferredDate));
  const ymdB = dateToYmdKst(new Date(b.preferredDate));
  if (ymdA !== ymdB) {
    res.status(400).json({ error: '같은 예약일인 접수끼리만 팀장 맞바꿈할 수 있습니다.' });
    return;
  }

  const aNative = nativeAssignments(a);
  const bNative = nativeAssignments(b);
  if (aNative.length === 0 || bNative.length === 0) {
    res.status(400).json({
      error: '자사 팀장이 배정된 접수끼리만 팀장 맞바꿈할 수 있습니다.',
    });
    return;
  }

  let myLeaderId = myLeaderIdRaw;
  let partnerLeaderId = partnerLeaderIdRaw;
  if (aNative.length === 1) {
    myLeaderId = aNative[0]!.teamLeaderId;
  }
  if (bNative.length === 1) {
    partnerLeaderId = bNative[0]!.teamLeaderId;
  }
  if (aNative.length > 1 && !myLeaderId) {
    res.status(400).json({ error: '이 접수에서 교환할 팀장을 지정해 주세요.' });
    return;
  }
  if (bNative.length > 1 && !partnerLeaderId) {
    res.status(400).json({ error: '상대 접수에서 맞바꿀 팀장을 지정해 주세요.' });
    return;
  }

  const aRow = aNative.find((x) => x.teamLeaderId === myLeaderId);
  const bRow = bNative.find((x) => x.teamLeaderId === partnerLeaderId);
  if (!aRow) {
    res.status(400).json({ error: '이 접수에 지정한 팀장이 배정되어 있지 않습니다.' });
    return;
  }
  if (!bRow) {
    res.status(400).json({ error: '상대 접수에 지정한 팀장이 배정되어 있지 않습니다.' });
    return;
  }

  const aOthers = new Set(
    aNative.filter((x) => x.teamLeaderId !== myLeaderId).map((x) => x.teamLeaderId),
  );
  const bOthers = new Set(
    bNative.filter((x) => x.teamLeaderId !== partnerLeaderId).map((x) => x.teamLeaderId),
  );
  if (aOthers.has(partnerLeaderId)) {
    res.status(400).json({ error: '교환 후 이 접수에 같은 팀장이 중복 배정됩니다.' });
    return;
  }
  if (bOthers.has(myLeaderId)) {
    res.status(400).json({ error: '교환 후 상대 접수에 같은 팀장이 중복 배정됩니다.' });
    return;
  }

  const myName = toLeaderLabel(aRow.teamLeader);
  const theirName = toLeaderLabel(bRow.teamLeader);
  const aSolo = aRow.noCrewMembers;
  const bSolo = bRow.noCrewMembers;

  const labelOther = (row: typeof a) =>
    `${String(row.customerName ?? '').trim() || '고객'}${row.inquiryNumber != null ? ` (#${row.inquiryNumber})` : ''}`;

  const linesA = [
    `팀장 교환: ${labelOther(b)} 접수와 '${myName}' ↔ '${theirName}'`,
    `팀장 배정: ${myName} → ${theirName}`,
  ];
  const linesB = [
    `팀장 교환: ${labelOther(a)} 접수와 '${theirName}' ↔ '${myName}'`,
    `팀장 배정: ${theirName} → ${myName}`,
  ];

  try {
    await prisma.$transaction(async (tx) => {
      await tx.assignment.update({
        where: { id: aRow.id, tenantId },
        data: { teamLeaderId: partnerLeaderId, noCrewMembers: bSolo },
      });
      await tx.assignment.update({
        where: { id: bRow.id, tenantId },
        data: { teamLeaderId: myLeaderId, noCrewMembers: aSolo },
      });
      await tx.inquiryChangeLog.create({
        data: {
          inquiryId: a.id,
          customerName: a.customerName,
          actorId: user?.userId ?? null,
          lines: linesA,
        },
      });
      await tx.inquiryChangeLog.create({
        data: {
          inquiryId: b.id,
          customerName: b.customerName,
          actorId: user?.userId ?? null,
          lines: linesB,
        },
      });
    });
  } catch (e) {
    console.error('swap-leader-with-partner transaction:', e);
    res.status(500).json({ error: '저장 중 오류가 발생했습니다.' });
    return;
  }

  const leaderIds = new Set<string>();
  for (const x of a.assignments) leaderIds.add(x.teamLeaderId);
  for (const x of b.assignments) leaderIds.add(x.teamLeaderId);
  leaderIds.add(myLeaderId);
  leaderIds.add(partnerLeaderId);
  notifyInboxRefresh([...leaderIds]);

  notifyChangeLogToStaff({
    tenantId: a.tenantId,
    customerName: a.customerName,
    inquiryId: a.id,
    lines: linesA,
  });
  notifyChangeLogToStaff({
    tenantId: b.tenantId,
    customerName: b.customerName,
    inquiryId: b.id,
    lines: linesB,
  });

  const updated = await prisma.inquiry.findFirst({
    where: { id: a.id, tenantId },
    include: inquiryDetailInclude,
  });
  if (!updated) {
    res.status(404).json({ error: '문의를 찾을 수 없습니다.' });
    return;
  }
  res.json(attachDistanceFromJuanForInquiry(updated));
}
