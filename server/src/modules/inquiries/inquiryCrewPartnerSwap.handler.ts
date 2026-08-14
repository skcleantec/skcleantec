import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { assignmentTeamLeaderSelect } from './assignmentTeamLeaderSelect.js';
import { isCrewRosterChanged } from './crewMemberNoteCompare.js';
import {
  clearAssignmentCrewMeetingTimes,
  inquiryHasAnyCrewMeetingTimeExtended,
  syncInquiryCrewLeaderAssignments,
} from './inquiryCrewLeaderAssignment.helpers.js';
import {
  clearInquiryCrewMemberMeetingTimes,
} from './inquiryCrewMemberMeetingTime.service.js';
import { allTeamLeadersSolo } from './inquiryNoCrewMembers.helpers.js';
import { dateToYmdKst } from '../users/userEmployment.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { notifyChangeLogToStaff } from '../realtime/changeLogNotify.js';
import { resolveTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import {
  notifyAllActiveCrewGroupsRefresh,
  notifyAllActiveCrewRosterAck,
  notifyTeamLeaderUsersRosterAck,
} from '../crew/crewFieldRealtime.js';
import { attachDistanceFromJuanForInquiry } from './inquiryJuanDistance.js';
import { inquiryDetailInclude } from './inquiryDetailInclude.js';
import { crewPairScheduleChangedAckMessages } from './crewRosterAckMessages.js';
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

type SwapInquiryRow = Prisma.InquiryGetPayload<{ include: typeof swapInclude }>;

/** 클라이언트 `parseCrewMemberNoteToNames` 및 `crewFieldSchedule` 과 동일 규칙 */
const NOTE_SPLIT = /[,·/|]/g;

function parseCrewMemberNoteToNames(v: string | null | undefined): string[] {
  if (!v) return [];
  return v
    .split(NOTE_SPLIT)
    .map((x) => x.trim())
    .filter(Boolean);
}

function joinCrewMemberNote(names: string[]): string | null {
  const t = names.map((x) => x.trim()).filter(Boolean);
  return t.length > 0 ? t.join('/') : null;
}

function fmtNum(v: unknown) {
  return v == null || v === '' ? '(없음)' : String(v);
}

function leaderIdsFromAssignments(row: SwapInquiryRow): {
  teamLeaderIds: string[];
  soloTeamLeaderIds: string[];
} {
  const teamLeaderIds = row.assignments.map((a) => a.teamLeaderId);
  const soloTeamLeaderIds = row.assignments
    .filter((a) => a.noCrewMembers)
    .map((a) => a.teamLeaderId);
  return { teamLeaderIds, soloTeamLeaderIds };
}

async function syncCrewLeaderAssignmentsAfterSwap(
  tx: Prisma.TransactionClient,
  tenantId: string,
  row: SwapInquiryRow,
  crewMemberNote: string | null,
): Promise<void> {
  const { teamLeaderIds, soloTeamLeaderIds } = leaderIdsFromAssignments(row);
  if (teamLeaderIds.length === 0) return;
  if (allTeamLeadersSolo(teamLeaderIds, soloTeamLeaderIds)) {
    await tx.inquiryCrewLeaderAssignment.deleteMany({
      where: { tenantId, inquiryId: row.id },
    });
    return;
  }
  if (!String(crewMemberNote ?? '').trim()) return;
  const syncResult = await syncInquiryCrewLeaderAssignments(tx, tenantId, row.id, {
    crewMemberNote,
    teamLeaderIds,
    soloTeamLeaderIds,
  });
  if (syncResult.error) {
    throw new Error(syncResult.error);
  }
}

const BLOCKED_SWAP_STATUSES = new Set([
  'CANCELLED',
  'ON_HOLD',
  'PENDING',
  'DEPOSIT_PENDING',
  'DEPOSIT_COMPLETED',
  'ORDER_FORM_PENDING',
]);

/**
 * POST /api/inquiries/:id/swap-crew-with-partner
 * 같은 예약일(KST)의 다른 접수와, 지정한 팀원 이름 한 쌍을 서로 교환합니다. (인원 수는 유지)
 */
export async function handlePostSwapCrewWithPartner(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const body = req.body as {
    partnerInquiryId?: unknown;
    myCrewName?: unknown;
    partnerCrewName?: unknown;
  };
  const partnerInquiryId = typeof body.partnerInquiryId === 'string' ? body.partnerInquiryId.trim() : '';
  const myCrewNameRaw = typeof body.myCrewName === 'string' ? body.myCrewName.trim() : '';
  const partnerCrewNameRaw = typeof body.partnerCrewName === 'string' ? body.partnerCrewName.trim() : '';
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
        '대기·입금·미제출·보류·취소 등의 상태인 접수는 팀원 맞바꿈을 할 수 없습니다. 분배·진행 중인 건끼리만 가능합니다.',
    });
    return;
  }

  if (
    (await inquiryHasActivePartnerShareSource(prisma, a.id)) ||
    (await inquiryHasActivePartnerShareSource(prisma, b.id))
  ) {
    res.status(400).json({ error: '파트너 연계 접수는 팀원 맞바꿈을 할 수 없습니다.' });
    return;
  }

  if (
    (await inquiryHasExternalPartnerAssignment(prisma, tenantId, a.id)) ||
    (await inquiryHasExternalPartnerAssignment(prisma, tenantId, b.id))
  ) {
    res.status(400).json({ error: '타업체 담당 접수는 팀원 맞바꿈을 할 수 없습니다.' });
    return;
  }

  if (!a.preferredDate || !b.preferredDate) {
    res.status(400).json({ error: '예약일이 없는 접수는 팀원 맞바꿈을 할 수 없습니다.' });
    return;
  }
  const ymdA = dateToYmdKst(new Date(a.preferredDate));
  const ymdB = dateToYmdKst(new Date(b.preferredDate));
  if (ymdA !== ymdB) {
    res.status(400).json({ error: '같은 예약일인 접수끼리만 팀원 맞바꿈할 수 있습니다.' });
    return;
  }

  if (a.assignments.length === 0 || b.assignments.length === 0) {
    res.status(400).json({
      error: '담당 팀장이 배정된 접수끼리만 팀원 맞바꿈할 수 있습니다.',
    });
    return;
  }

  const aCount = a.crewMemberCount ?? null;
  const aNote = a.crewMemberNote ?? null;
  const bCount = b.crewMemberCount ?? null;
  const bNote = b.crewMemberNote ?? null;

  const aNames = parseCrewMemberNoteToNames(aNote);
  const bNames = parseCrewMemberNoteToNames(bNote);
  if (aNames.length === 0 || bNames.length === 0) {
    res.status(400).json({
      error: '두 접수 모두 팀원 이름(투입 메모)이 있어야 교환할 수 있습니다.',
    });
    return;
  }

  let myName = myCrewNameRaw;
  let theirName = partnerCrewNameRaw;
  if (aNames.length === 1) {
    myName = aNames[0]!;
  }
  if (bNames.length === 1) {
    theirName = bNames[0]!;
  }
  if (aNames.length > 1 && !myName) {
    res.status(400).json({ error: '이 접수에서 교환할 팀원 이름을 지정해 주세요.' });
    return;
  }
  if (bNames.length > 1 && !theirName) {
    res.status(400).json({ error: '상대 접수에서 맞바꿀 팀원 이름을 지정해 주세요.' });
    return;
  }

  const myIdx = aNames.findIndex((n) => n === myName);
  const theirIdx = bNames.findIndex((n) => n === theirName);
  if (myIdx < 0) {
    res.status(400).json({ error: '이 접수 팀원 이름이 투입 메모에 없습니다.' });
    return;
  }
  if (theirIdx < 0) {
    res.status(400).json({ error: '상대 접수 팀원 이름이 투입 메모에 없습니다.' });
    return;
  }

  const aNext = [...aNames];
  const bNext = [...bNames];
  const myTok = aNext[myIdx]!;
  const theirTok = bNext[theirIdx]!;
  aNext[myIdx] = theirTok;
  bNext[theirIdx] = myTok;

  const aNoteNext = joinCrewMemberNote(aNext);
  const bNoteNext = joinCrewMemberNote(bNext);

  const aChanged = isCrewRosterChanged(aNote, aCount, aNoteNext, aCount);
  const bChanged = isCrewRosterChanged(bNote, bCount, bNoteNext, bCount);

  const aHadMeeting =
    aChanged &&
    (await inquiryHasAnyCrewMeetingTimeExtended(prisma, a.id, {
      crewMeetingTime: a.crewMeetingTime,
      assignments: a.assignments,
    }));
  const bHadMeeting =
    bChanged &&
    (await inquiryHasAnyCrewMeetingTimeExtended(prisma, b.id, {
      crewMeetingTime: b.crewMeetingTime,
      assignments: b.assignments,
    }));

  const labelOther = (row: typeof a) =>
    `${String(row.customerName ?? '').trim() || '고객'}${row.inquiryNumber != null ? ` (#${row.inquiryNumber})` : ''}`;

  const linesA: string[] = [
    `팀원 교환: ${labelOther(b)} 접수와 '${myTok}' ↔ '${theirTok}'`,
    `팀원 메모: ${fmtNum(aNote)} → ${fmtNum(aNoteNext)}`,
  ];
  if (aHadMeeting) {
    linesA.push('현장 미팅(크루): 팀원 구성 변경으로 미팅 시각 초기화');
  }

  const linesB: string[] = [
    `팀원 교환: ${labelOther(a)} 접수와 '${theirTok}' ↔ '${myTok}'`,
    `팀원 메모: ${fmtNum(bNote)} → ${fmtNum(bNoteNext)}`,
  ];
  if (bHadMeeting) {
    linesB.push('현장 미팅(크루): 팀원 구성 변경으로 미팅 시각 초기화');
  }

  const dataA: Prisma.InquiryUpdateInput = {
    crewMemberNote: aNoteNext,
    crewMemberCount: aCount,
  };
  const dataB: Prisma.InquiryUpdateInput = {
    crewMemberNote: bNoteNext,
    crewMemberCount: bCount,
  };
  if (aChanged) {
    dataA.crewMeetingTime = null;
    dataA.crewMeetingTimeUpdatedAt = null;
  }
  if (bChanged) {
    dataB.crewMeetingTime = null;
    dataB.crewMeetingTimeUpdatedAt = null;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updatedA = await tx.inquiry.updateMany({
        where: { id: a.id, tenantId },
        data: dataA,
      });
      const updatedB = await tx.inquiry.updateMany({
        where: { id: b.id, tenantId },
        data: dataB,
      });
      if (updatedA.count !== 1 || updatedB.count !== 1) {
        throw new Error('NOT_FOUND');
      }
      if (aChanged) {
        await clearInquiryCrewMemberMeetingTimes(tx, a.id);
        await clearAssignmentCrewMeetingTimes(tx, tenantId, a.id);
      }
      if (bChanged) {
        await clearInquiryCrewMemberMeetingTimes(tx, b.id);
        await clearAssignmentCrewMeetingTimes(tx, tenantId, b.id);
      }
      await syncCrewLeaderAssignmentsAfterSwap(tx, tenantId, a, aNoteNext);
      await syncCrewLeaderAssignmentsAfterSwap(tx, tenantId, b, bNoteNext);
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
    if (e instanceof Error) {
      if (e.message === 'NOT_FOUND') {
        res.status(404).json({ error: '접수를 찾을 수 없습니다.' });
        return;
      }
      if (e.message.includes('팀장') || e.message.includes('팀원')) {
        res.status(400).json({ error: e.message });
        return;
      }
    }
    console.error('swap-crew-with-partner transaction:', e);
    res.status(500).json({ error: '저장 중 오류가 발생했습니다.' });
    return;
  }

  const leaderIds = new Set<string>();
  for (const x of a.assignments) leaderIds.add(x.teamLeaderId);
  for (const x of b.assignments) leaderIds.add(x.teamLeaderId);
  notifyInboxRefresh([...leaderIds]);

  if (linesA.length > 0) {
    notifyChangeLogToStaff({ tenantId: a.tenantId, customerName: a.customerName, inquiryId: a.id, lines: linesA });
  }
  if (linesB.length > 0) {
    notifyChangeLogToStaff({ tenantId: b.tenantId, customerName: b.customerName, inquiryId: b.id, lines: linesB });
  }

  void notifyAllActiveCrewGroupsRefresh(a.tenantId).catch((e) => console.error('[crew-field-notify]', e));

  const swapPairMsg =
    (aChanged || bChanged)
      ? crewPairScheduleChangedAckMessages(myTok, theirTok)
      : null;

  if (swapPairMsg) {
    void notifyAllActiveCrewRosterAck(a.tenantId, swapPairMsg).catch((e) => console.error('[crew-roster-ack]', e));
  }
  if (aChanged && swapPairMsg) {
    notifyTeamLeaderUsersRosterAck(
      a.assignments.map((x) => x.teamLeaderId),
      swapPairMsg,
    );
  }
  if (bChanged && swapPairMsg) {
    notifyTeamLeaderUsersRosterAck(
      b.assignments.map((x) => x.teamLeaderId),
      swapPairMsg,
    );
  }

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
