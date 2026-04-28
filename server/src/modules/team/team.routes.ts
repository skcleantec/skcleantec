import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import bcrypt from 'bcryptjs';
import { teamAuthMiddleware } from '../auth/auth.middleware.team.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { happyCallDeadlineEnd, isHappyCallEligible } from '../inquiries/happyCall.helpers.js';
import inquiryCleaningPhotosTeamRoutes from '../inquiry-cleaning-photos/inquiryCleaningPhotos.team.routes.js';
import inquiryExtraChargesTeamRoutes from '../inquiry-extra-charges/inquiryExtraCharges.team.routes.js';
import { csReportFullInclude } from '../cs/csReport.include.js';
import { buildCsReportUpdateData } from '../cs/csReport.patch.js';
import { notifyCsReportNavBadges } from '../realtime/navBadgeNotify.js';
import { assignmentTeamLeaderSelect } from '../inquiries/assignmentTeamLeaderSelect.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { resolveExternalSettlementPaidAt } from '../../lib/externalSettlementPaidAt.js';
import {
  parseCrewMeetingTimeBody,
  validateCrewMeetingTimeForInquiry,
} from '../inquiries/crewMeetingTime.helpers.js';
import { notifyAllActiveCrewGroupsRefresh } from '../crew/crewFieldRealtime.js';

const router = Router();

/** 팀 스케줄 범위 — 관리자 스케줄 API와 동일하게 KST 하루 경계 */
const SCHEDULE_QUERY_YMD = /^\d{4}-\d{2}-\d{2}$/;

router.use(teamAuthMiddleware);

/** 팀 화면 기준 현재 사용자(프리뷰 매핑 반영) */
router.get('/me', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const viewer = (req as unknown as {
    teamViewer?: { role?: string; previewExternal?: boolean; previewTeamLeader?: boolean };
  }).teamViewer;
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
      phone: true,
      vehicleNumber: true,
      allowSelfDayOffEdit: true,
      externalCompanyId: true,
      externalCompany: { select: { id: true, name: true } },
    },
  });
  if (!me) {
    res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }
  res.json({
    ...me,
    viewerRole: viewer?.role ?? me.role,
    previewExternal: Boolean(viewer?.previewExternal),
    previewTeamLeader: Boolean(viewer?.previewTeamLeader),
  });
});

const teamInquiryInclude = {
  createdBy: { select: { id: true, name: true, phone: true } },
  orderForm: {
    select: {
      id: true,
      submittedAt: true,
      customerSpecialNotes: true,
      createdBy: { select: { id: true, name: true, phone: true } },
    },
  },
  assignments: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      inquiryId: true,
      teamLeaderId: true,
      assignedAt: true,
      detailViewedAt: true,
      sortOrder: true,
      teamLeader: { select: assignmentTeamLeaderSelect },
      assignedBy: { select: { id: true, name: true } },
    },
  },
  extraCharges: {
    orderBy: { sortOrder: 'asc' as const },
    include: { createdBy: { select: { id: true, name: true } } },
  },
} as const;

/**
 * `crew_member_note`(이름을 `/ , · |` 중 하나로 구분한 문자열)을 파싱해
 * 등록된 `TeamMember` 레코드의 이름과 매칭, 각 접수에 `crewMembers: [{name, phone}]`
 * 을 덧붙인다. 팀장이 현장 팀원에게 직접 연락할 수 있도록 이름·전화를 노출한다.
 */
function parseCrewNames(note: string | null | undefined): string[] {
  if (!note) return [];
  return note
    .split(/[,·/|]/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function attachCrewMembers<T extends { crewMemberNote: string | null }>(
  items: T[],
): Promise<Array<T & { crewMembers: Array<{ name: string; phone: string | null }> }>> {
  const allNames = new Set<string>();
  for (const it of items) {
    for (const n of parseCrewNames(it.crewMemberNote)) allNames.add(n);
  }
  if (allNames.size === 0) {
    return items.map((it) => ({ ...it, crewMembers: [] }));
  }
  const members = await prisma.teamMember.findMany({
    where: { name: { in: Array.from(allNames) }, isActive: true },
    select: { name: true, phone: true, sortOrder: true, createdAt: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const phoneByName = new Map<string, string | null>();
  for (const m of members) {
    // 동명이인이 있을 수 있어 **첫 매칭**만 사용(최선노력). 번호가 있는 행을 우선.
    const cur = phoneByName.get(m.name);
    if (cur == null) phoneByName.set(m.name, m.phone ?? null);
    else if (!cur && m.phone) phoneByName.set(m.name, m.phone);
  }
  return items.map((it) => ({
    ...it,
    crewMembers: parseCrewNames(it.crewMemberNote).map((name) => ({
      name,
      phone: phoneByName.get(name) ?? null,
    })),
  }));
}

async function attachCrewMembersOne<T extends { crewMemberNote: string | null } | null>(
  item: T,
): Promise<
  | (Exclude<T, null> & { crewMembers: Array<{ name: string; phone: string | null }> })
  | null
> {
  if (!item) return null;
  const [enriched] = await attachCrewMembers([item]);
  return enriched as Exclude<T, null> & {
    crewMembers: Array<{ name: string; phone: string | null }>;
  };
}

/** 팀장 GNB: 미읽 메시지 + 담당 미처리(접수) C/S + 미확인 배정(상세 미조회) — 한 요청으로 병렬 COUNT */
router.get('/nav-badges', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const [unreadCount, csPendingCount, newAssignmentCount] = await Promise.all([
    prisma.message.count({
      where: { receiverId: userId, readAt: null },
    }),
    prisma.csReport.count({
      where: {
        status: 'RECEIVED',
        inquiryId: { not: null },
        inquiry: {
          assignments: { some: { teamLeaderId: userId } },
        },
      },
    }),
    prisma.assignment.count({
      where: {
        teamLeaderId: userId,
        detailViewedAt: null,
        inquiry: {
          status: { notIn: ['CANCELLED', 'COMPLETED', 'ON_HOLD'] },
        },
      },
    }),
  ]);
  res.json({ unreadCount, csPendingCount, newAssignmentCount });
});

router.use('/inquiries/:inquiryId/cleaning-photos', inquiryCleaningPhotosTeamRoutes);
router.use('/inquiries/:inquiryId/extra-charges', inquiryExtraChargesTeamRoutes);

/** 팀장: 접수 상세를 열어 확인한 것으로 표시 — 메뉴 미확인 배정 수 감소 */
router.post('/inquiries/:id/detail-viewed', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const { id: inquiryId } = req.params;
  const row = await prisma.assignment.findFirst({
    where: { inquiryId, teamLeaderId: userId },
  });
  if (!row) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  await prisma.assignment.updateMany({
    where: { inquiryId, teamLeaderId: userId, detailViewedAt: null },
    data: { detailViewedAt: new Date() },
  });
  notifyInboxRefresh([userId]);
  res.json({ ok: true });
});

/** 담당 미처리(접수) C/S 건수 — 상단 메뉴 배지용 */
router.get('/cs/pending-count', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const count = await prisma.csReport.count({
    where: {
      status: 'RECEIVED',
      inquiryId: { not: null },
      inquiry: {
        assignments: { some: { teamLeaderId: userId } },
      },
    },
  });
  res.json({ count });
});

/** 담당 접수와 연결된 C/S만 (배정 팀장 본인) */
router.get('/cs', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const items = await prisma.csReport.findMany({
    where: {
      inquiryId: { not: null },
      inquiry: {
        assignments: { some: { teamLeaderId: userId } },
      },
    },
    orderBy: { createdAt: 'desc' },
    include: csReportFullInclude,
  });
  res.json({ items });
});

/** 담당 C/S 수정 — 접수·처리중·완료만 (RECEIVED로는 변경 불가) */
router.patch('/cs/:id', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const user = (req as unknown as { user: AuthPayload }).user;
  const { id } = req.params;
  const body = req.body as { status?: string; memo?: string | null; completionMethod?: string | null };

  const report = await prisma.csReport.findFirst({
    where: {
      id,
      inquiryId: { not: null },
      inquiry: {
        assignments: { some: { teamLeaderId: userId } },
      },
    },
  });
  if (!report) {
    res.status(404).json({ error: '담당 C/S를 찾을 수 없습니다.' });
    return;
  }

  if (
    body.status != null &&
    body.status !== 'PROCESSING' &&
    body.status !== 'DONE' &&
    body.status !== report.status
  ) {
    res.status(400).json({ error: '팀장은 상태를 처리중·완료로만 바꿀 수 있습니다.' });
    return;
  }

  const built = buildCsReportUpdateData({ status: report.status }, body, user);
  if (!built.ok) {
    res.status(400).json({ error: built.error });
    return;
  }
  const updated = await prisma.csReport.update({
    where: { id },
    data: built.data,
    include: csReportFullInclude,
  });
  res.json(updated);
  void notifyCsReportNavBadges(updated.inquiryId);
});

/** 해피콜 미완 건수 (마감 전 / 마감 후) — 팀장 본인 배정만 */
router.get('/happy-call-stats', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const rows = await prisma.inquiry.findMany({
    where: {
      preferredDate: { not: null },
      happyCallCompletedAt: null,
      status: {
        notIn: ['CANCELLED', 'ON_HOLD', 'PENDING', 'DEPOSIT_PENDING', 'DEPOSIT_COMPLETED', 'ORDER_FORM_PENDING'],
      },
      assignments: { some: { teamLeaderId: userId } },
    },
    select: { preferredDate: true },
  });
  const now = new Date();
  let overdueCount = 0;
  let pendingBeforeDeadlineCount = 0;
  for (const r of rows) {
    if (!r.preferredDate) continue;
    if (now > happyCallDeadlineEnd(r.preferredDate)) overdueCount++;
    else pendingBeforeDeadlineCount++;
  }
  res.json({ overdueCount, pendingBeforeDeadlineCount });
});

/** 팀장만 — 담당 접수에 대해 해피콜 완료 처리 */
router.post('/inquiries/:id/happy-call-complete', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const { id } = req.params;
  const inquiry = await prisma.inquiry.findFirst({
    where: {
      id,
      assignments: { some: { teamLeaderId: userId } },
    },
  });
  if (!inquiry) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  if (!isHappyCallEligible(inquiry.status, inquiry.preferredDate)) {
    res.status(400).json({ error: '해피콜을 등록할 수 없는 접수입니다.' });
    return;
  }
  if (inquiry.happyCallCompletedAt) {
    res.json({ ok: true, alreadyCompleted: true });
    return;
  }
  await prisma.inquiry.update({
    where: { id },
    data: { happyCallCompletedAt: new Date() },
  });
  res.json({ ok: true });
});

/** 팀장: 본인 배정 건 예약일 변경 */
router.patch('/inquiries/:id/preferred-date', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const { id } = req.params;
  const body = req.body as { preferredDate?: string };
  const ymd = typeof body.preferredDate === 'string' ? body.preferredDate.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    res.status(400).json({ error: '예약일은 YYYY-MM-DD 형식이어야 합니다.' });
    return;
  }
  const preferredDate = new Date(`${ymd}T12:00:00+09:00`);
  if (Number.isNaN(preferredDate.getTime())) {
    res.status(400).json({ error: '유효한 예약일이 아닙니다.' });
    return;
  }
  const inquiry = await prisma.inquiry.findFirst({
    where: {
      id,
      assignments: { some: { teamLeaderId: userId } },
    },
    include: teamInquiryInclude,
  });
  if (!inquiry) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  if (inquiry.status === 'CANCELLED') {
    res.status(400).json({ error: '취소된 접수는 예약일을 변경할 수 없습니다.' });
    return;
  }
  const beforeYmd = inquiry.preferredDate ? inquiry.preferredDate.toISOString().slice(0, 10) : null;
  if (beforeYmd === ymd) {
    const unchanged = await prisma.inquiry.findUnique({
      where: { id },
      include: teamInquiryInclude,
    });
    res.json(await attachCrewMembersOne(unchanged));
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.inquiry.update({
      where: { id },
      data: { preferredDate },
    });
    await tx.inquiryChangeLog.create({
      data: {
        inquiryId: id,
        customerName: inquiry.customerName,
        actorId: userId,
        lines: [`청소 희망일: ${beforeYmd ?? '(없음)'} → ${ymd}`],
      },
    });
    return tx.inquiry.findUnique({
      where: { id },
      include: teamInquiryInclude,
    });
  });
  res.json(await attachCrewMembersOne(updated));
});

/** 팀장: 오전 희망 접수일 때만 크루 현장 일정에 노출할 미팅 시각(KST, HH:mm) */
router.patch('/inquiries/:id/crew-meeting-time', async (req, res) => {
  try {
    const { userId } = (req as unknown as { user: AuthPayload }).user;
    const { id } = req.params;
    const parsed = parseCrewMeetingTimeBody((req.body as { crewMeetingTime?: unknown })?.crewMeetingTime);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const inquiry = await prisma.inquiry.findFirst({
      where: {
        id,
        assignments: { some: { teamLeaderId: userId } },
      },
      select: {
        id: true,
        customerName: true,
        status: true,
        preferredTime: true,
        betweenScheduleSlot: true,
        crewMeetingTime: true,
      },
    });
    if (!inquiry) {
      res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
      return;
    }
    if (inquiry.status === 'CANCELLED') {
      res.status(400).json({ error: '취소된 접수입니다.' });
      return;
    }
    const chk = validateCrewMeetingTimeForInquiry(
      inquiry.preferredTime,
      inquiry.betweenScheduleSlot,
      parsed.value
    );
    if (!chk.ok) {
      res.status(400).json({ error: chk.error });
      return;
    }
    const before = inquiry.crewMeetingTime;
    const next = parsed.value;
    if (before === next) {
      const unchanged = await prisma.inquiry.findUnique({
        where: { id },
        include: teamInquiryInclude,
      });
      res.json(await attachCrewMembersOne(unchanged));
      return;
    }
    const fmt = (v: string | null) => v ?? '(미지정)';
    const updated = await prisma.$transaction(async (tx) => {
      await tx.inquiry.update({
        where: { id },
        data: { crewMeetingTime: next },
      });
      await tx.inquiryChangeLog.create({
        data: {
          inquiryId: id,
          customerName: inquiry.customerName,
          actorId: userId,
          lines: [`현장 미팅(크루): ${fmt(before)} → ${fmt(next)}`],
        },
      });
      return tx.inquiry.findUnique({
        where: { id },
        include: teamInquiryInclude,
      });
    });
    void notifyAllActiveCrewGroupsRefresh().catch((e) => console.error('[crew-meeting-time] crew refresh', e));
    void notifyCsReportNavBadges(id).catch((e) =>
      console.error('[crew-meeting-time] staff/leaders nav refresh', e),
    );
    res.json(await attachCrewMembersOne(updated));
  } catch (e: unknown) {
    console.error('[PATCH /team/inquiries/:id/crew-meeting-time]', e);
    const msg = e instanceof Error ? e.message : String(e);
    const prismaSchemaHint =
      e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2022'
        ? true
        : e instanceof Prisma.PrismaClientValidationError
          ? true
          : /crew_meeting|crewMeetingTime|Unknown field|Unknown arg/i.test(msg);
    if (prismaSchemaHint) {
      res.status(500).json({
        error:
          'DB에 미팅 시각 컬럼(crew_meeting_time)이 없거나 Prisma 스키마가 맞지 않습니다. 운영 DB에 마이그레이션을 적용하고(npx prisma migrate deploy) 서버를 재시작한 뒤 다시 시도해 주세요.',
      });
      return;
    }
    res.status(500).json({ error: '미팅 시각 저장 중 서버 오류가 발생했습니다.' });
  }
});

/** 접수 취소(관리자/마케터만, 비밀번호 확인 필수) */
router.post('/inquiries/:id/cancel', async (req, res) => {
  const viewer = (req as unknown as {
    teamViewer?: { userId: string; role: string };
    user: AuthPayload;
  }).teamViewer;
  const actorId = viewer?.userId ?? (req as unknown as { user: AuthPayload }).user.userId;
  const actorRole = viewer?.role ?? (req as unknown as { user: AuthPayload }).user.role;
  if (actorRole !== 'ADMIN' && actorRole !== 'MARKETER') {
    res.status(403).json({ error: '취소는 관리자/마케터만 처리할 수 있습니다.' });
    return;
  }
  const { id } = req.params;
  const body = req.body as { password?: string };
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password.trim()) {
    res.status(400).json({ error: '비밀번호를 입력해 주세요.' });
    return;
  }
  const me = await prisma.user.findUnique({
    where: { id: actorId },
    select: { passwordHash: true },
  });
  if (!me || !(await bcrypt.compare(password, me.passwordHash))) {
    res.status(403).json({ error: '비밀번호가 올바르지 않습니다.' });
    return;
  }
  const inquiry = await prisma.inquiry.findFirst({
    where: { id },
    include: {
      assignments: {
        include: { teamLeader: { select: assignmentTeamLeaderSelect } },
      },
    },
  });
  if (!inquiry) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  if (inquiry.status === 'CANCELLED') {
    res.json({ ok: true, alreadyCancelled: true });
    return;
  }
  const ext = inquiry.assignments.find((a) => a.teamLeader.role === 'EXTERNAL_PARTNER');
  const snapCid = ext?.teamLeader.externalCompanyId;
  await prisma.inquiry.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      happyCallCompletedAt: null,
      ...(snapCid ? { cancelFeeExternalCompany: { connect: { id: snapCid } } } : {}),
    },
  });
  await prisma.inquiryChangeLog.create({
    data: {
      inquiryId: inquiry.id,
      customerName: inquiry.customerName,
      actorId,
      lines: ['관리자/마케터 취소 처리'],
    },
  });
  const staff = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['ADMIN', 'MARKETER'] } },
    select: { id: true },
  });
  const assignees = inquiry.assignments.map((a) => a.teamLeaderId);
  notifyInboxRefresh([...new Set([...staff.map((s) => s.id), ...assignees])]);
  res.json({ ok: true });
});

router.get('/inquiries', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const rows = await prisma.inquiry.findMany({
    where: {
      assignments: {
        some: { teamLeaderId: userId },
      },
    },
    orderBy: { preferredDate: 'asc' },
    include: teamInquiryInclude,
  });
  const items = await attachCrewMembers(rows);
  res.json({ items });
});

router.get('/schedule', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const { start, end } = req.query as { start?: string; end?: string };
  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  if (
    typeof start === 'string' &&
    SCHEDULE_QUERY_YMD.test(start) &&
    typeof end === 'string' &&
    SCHEDULE_QUERY_YMD.test(end)
  ) {
    startDate = new Date(`${start}T00:00:00+09:00`);
    endDate = new Date(`${end}T23:59:59.999+09:00`);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  const rows = await prisma.inquiry.findMany({
    where: {
      preferredDate: { gte: startDate, lte: endDate },
      status: { notIn: ['CANCELLED', 'ON_HOLD'] },
      assignments: {
        some: { teamLeaderId: userId },
      },
    },
    orderBy: [{ preferredDate: 'asc' }, { preferredTime: 'asc' }],
    include: teamInquiryInclude,
  });
  const items = await attachCrewMembers(rows);
  res.json({ items });
});

/**
 * 타업체(EXTERNAL_PARTNER) 본인 정산 조회
 * - 월별 합계(예약일 기준)
 * - 건수(정상/취소)
 * - 접수 상세 목록(수수료 포함, 취소는 음수 반영)
 */
router.get('/external-settlement', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const previewStaff = user.role === 'ADMIN' || user.role === 'MARKETER';
  if (user.role !== 'EXTERNAL_PARTNER' && !previewStaff) {
    res.status(403).json({ error: '타업체 계정(또는 개발자 프리뷰)만 접근할 수 있습니다.' });
    return;
  }
  const queryCompanyId = typeof req.query.externalCompanyId === 'string'
    ? req.query.externalCompanyId.trim()
    : '';
  const queryCompanyName = typeof req.query.externalCompanyName === 'string'
    ? req.query.externalCompanyName.trim()
    : '';
  let companyId: string | null = null;
  let companyName: string | null = null;
  if (user.role === 'EXTERNAL_PARTNER') {
    const me = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        externalCompanyId: true,
        externalCompany: { select: { id: true, name: true } },
      },
    });
    companyId = me?.externalCompanyId ?? null;
    companyName = me?.externalCompany?.name ?? null;
  } else if (previewStaff) {
    let company = queryCompanyId
      ? await prisma.externalCompany.findFirst({
          where: { id: queryCompanyId, isActive: true },
          select: { id: true, name: true },
        })
      : null;
    if (!company && queryCompanyName) {
      company = await prisma.externalCompany.findFirst({
        where: { isActive: true, name: queryCompanyName },
        select: { id: true, name: true },
      });
    }
    if (!company && !queryCompanyName) {
      company = await prisma.externalCompany.findFirst({
        where: { isActive: true, name: '클린느' },
        select: { id: true, name: true },
      });
    }
    if (!company) {
      company = await prisma.externalCompany.findFirst({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      });
    }
    companyId = company?.id ?? null;
    companyName = company?.name ?? null;
  }
  if (!companyId) {
    res.status(400).json({ error: '타업체 정보가 연결되지 않은 계정입니다.' });
    return;
  }

  const fromRaw = typeof req.query.from === 'string' ? req.query.from.trim() : '';
  const toRaw = typeof req.query.to === 'string' ? req.query.to.trim() : '';
  const now = new Date();
  const fallbackMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const fallbackFromYmd = `${fallbackMonth}-01`;
  const fromYmd = /^\d{4}-\d{2}-\d{2}$/.test(fromRaw) ? fromRaw : fallbackFromYmd;
  const toYmd = /^\d{4}-\d{2}-\d{2}$/.test(toRaw)
    ? toRaw
    : (() => {
        const tmp = new Date(`${fallbackFromYmd}T00:00:00+09:00`);
        const last = new Date(tmp.getFullYear(), tmp.getMonth() + 1, 0);
        return `${fallbackMonth}-${String(last.getDate()).padStart(2, '0')}`;
      })();
  const loYmd = fromYmd <= toYmd ? fromYmd : toYmd;
  const hiYmd = fromYmd <= toYmd ? toYmd : fromYmd;
  const from = new Date(`${loYmd}T00:00:00+09:00`);
  const to = new Date(`${hiYmd}T23:59:59.999+09:00`);

  const activeRows = await prisma.inquiry.findMany({
    where: {
      externalTransferFee: { not: null },
      preferredDate: { gte: from, lte: to },
      status: { notIn: ['CANCELLED', 'ON_HOLD'] },
      assignments: {
        some: {
          teamLeader: { role: 'EXTERNAL_PARTNER', externalCompanyId: companyId },
        },
      },
    },
    orderBy: [{ preferredDate: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      inquiryNumber: true,
      customerName: true,
      address: true,
      addressDetail: true,
      preferredDate: true,
      status: true,
      externalTransferFee: true,
      assignments: {
        orderBy: { sortOrder: 'asc' as const },
        select: {
          teamLeader: {
            select: {
              id: true,
              name: true,
              role: true,
              externalCompanyId: true,
              externalCompany: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  const cancelledRows = await prisma.inquiry.findMany({
    where: {
      status: 'CANCELLED',
      externalTransferFee: { not: null },
      preferredDate: { gte: from, lte: to },
      OR: [
        { cancelFeeExternalCompanyId: companyId },
        {
          assignments: {
            some: {
              teamLeader: { role: 'EXTERNAL_PARTNER', externalCompanyId: companyId },
            },
          },
        },
      ],
    },
    orderBy: [{ preferredDate: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      inquiryNumber: true,
      customerName: true,
      address: true,
      addressDetail: true,
      preferredDate: true,
      status: true,
      externalTransferFee: true,
      cancelFeeExternalCompanyId: true,
      assignments: {
        orderBy: { sortOrder: 'asc' as const },
        select: {
          teamLeader: {
            select: {
              id: true,
              name: true,
              role: true,
              externalCompanyId: true,
              externalCompany: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  type Item = {
    inquiryId: string;
    inquiryNumber: string | null;
    customerName: string;
    address: string;
    addressDetail: string | null;
    preferredDate: string | null;
    status: string;
    isCancelled: boolean;
    feeAmount: number;
    signedFeeAmount: number;
    assignedExternalLabel: string | null;
  };

  const items: Item[] = [];
  let inquiryCount = 0;
  let cancelledInquiryCount = 0;
  let totalFee = 0;

  for (const row of activeRows) {
    const fee = row.externalTransferFee ?? 0;
    const ext = row.assignments.find(
      (a) => a.teamLeader.role === 'EXTERNAL_PARTNER' && a.teamLeader.externalCompanyId === companyId
    );
    items.push({
      inquiryId: row.id,
      inquiryNumber: row.inquiryNumber ?? null,
      customerName: row.customerName,
      address: row.address,
      addressDetail: row.addressDetail ?? null,
      preferredDate: row.preferredDate ? row.preferredDate.toISOString() : null,
      status: row.status,
      isCancelled: false,
      feeAmount: fee,
      signedFeeAmount: fee,
      assignedExternalLabel: ext?.teamLeader.externalCompany?.name ?? ext?.teamLeader.name ?? null,
    });
    inquiryCount += 1;
    totalFee += fee;
  }

  for (const row of cancelledRows) {
    const fee = row.externalTransferFee ?? 0;
    const sign = -1;
    const ext = row.assignments.find(
      (a) => a.teamLeader.role === 'EXTERNAL_PARTNER' && a.teamLeader.externalCompanyId === companyId
    );
    items.push({
      inquiryId: row.id,
      inquiryNumber: row.inquiryNumber ?? null,
      customerName: row.customerName,
      address: row.address,
      addressDetail: row.addressDetail ?? null,
      preferredDate: row.preferredDate ? row.preferredDate.toISOString() : null,
      status: row.status,
      isCancelled: true,
      feeAmount: fee,
      signedFeeAmount: sign * fee,
      assignedExternalLabel: ext?.teamLeader.externalCompany?.name ?? ext?.teamLeader.name ?? null,
    });
    cancelledInquiryCount += 1;
    totalFee += sign * fee;
  }

  items.sort((a, b) => {
    const da = a.preferredDate ?? '';
    const db = b.preferredDate ?? '';
    return db.localeCompare(da);
  });

  const activeBeforeAgg = await prisma.inquiry.aggregate({
    where: {
      externalTransferFee: { not: null },
      preferredDate: { lt: from },
      status: { notIn: ['CANCELLED', 'ON_HOLD'] },
      assignments: {
        some: {
          teamLeader: { role: 'EXTERNAL_PARTNER', externalCompanyId: companyId },
        },
      },
    },
    _sum: { externalTransferFee: true },
  });
  const cancelledBeforeAgg = await prisma.inquiry.aggregate({
    where: {
      status: 'CANCELLED',
      externalTransferFee: { not: null },
      preferredDate: { lt: from },
      OR: [
        { cancelFeeExternalCompanyId: companyId },
        {
          assignments: {
            some: {
              teamLeader: { role: 'EXTERNAL_PARTNER', externalCompanyId: companyId },
            },
          },
        },
      ],
    },
    _sum: { externalTransferFee: true },
  });
  const signedBeforeRange =
    (activeBeforeAgg._sum.externalTransferFee ?? 0) - (cancelledBeforeAgg._sum.externalTransferFee ?? 0);

  const paidBeforeAgg = await prisma.externalCompanySettlementPayment.aggregate({
    where: { externalCompanyId: companyId, paidAt: { lt: from } },
    _sum: { amount: true },
  });
  const paidBeforeRange = paidBeforeAgg._sum.amount ?? 0;

  const paymentRows = await prisma.externalCompanySettlementPayment.findMany({
    where: { externalCompanyId: companyId, paidAt: { gte: from, lte: to } },
    orderBy: [{ paidAt: 'desc' }],
    select: {
      id: true,
      amount: true,
      paidAt: true,
      memo: true,
      actor: { select: { id: true, name: true, role: true } },
    },
  });
  const periodPaidAgg = await prisma.externalCompanySettlementPayment.aggregate({
    where: { externalCompanyId: companyId, paidAt: { gte: from, lte: to } },
    _sum: { amount: true },
  });
  const periodPaidAmount = periodPaidAgg._sum.amount ?? 0;
  const carryOverAmount = signedBeforeRange - paidBeforeRange;
  const payableAmount = carryOverAmount + totalFee;
  const remainingAmount = payableAmount - periodPaidAmount;

  /** 이후 UI: 올해(KST) 기준 요약 / 최근 1회 정산 */
  const kstYmd = (d: Date) => d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  const summaryYear = kstYmd(new Date()).slice(0, 4);
  const yFromYmd = `${summaryYear}-01-01`;
  const yToYmd = `${summaryYear}-12-31`;
  const yearFromDt = new Date(`${yFromYmd}T00:00:00+09:00`);
  const yearToDt = new Date(`${yToYmd}T23:59:59.999+09:00`);

  const extSomeActive = {
    assignments: {
      some: { teamLeader: { role: 'EXTERNAL_PARTNER' as const, externalCompanyId: companyId } },
    },
  };
  const [
    activeYearAgg,
    cancelledYearAgg,
    activeBeforeYearAgg,
    cancelledBeforeYearAgg,
    paidBeforeYearAgg,
    yearPaidInYearAgg,
    lastPaymentRow,
  ] = await Promise.all([
    prisma.inquiry.aggregate({
      where: {
        externalTransferFee: { not: null },
        preferredDate: { gte: yearFromDt, lte: yearToDt },
        status: { notIn: ['CANCELLED', 'ON_HOLD'] },
        ...extSomeActive,
      },
      _sum: { externalTransferFee: true },
    }),
    prisma.inquiry.aggregate({
      where: {
        status: 'CANCELLED',
        externalTransferFee: { not: null },
        preferredDate: { gte: yearFromDt, lte: yearToDt },
        OR: [
          { cancelFeeExternalCompanyId: companyId },
          {
            assignments: {
              some: {
                teamLeader: { role: 'EXTERNAL_PARTNER' as const, externalCompanyId: companyId },
              },
            },
          },
        ],
      },
      _sum: { externalTransferFee: true },
    }),
    prisma.inquiry.aggregate({
      where: {
        externalTransferFee: { not: null },
        preferredDate: { lt: yearFromDt },
        status: { notIn: ['CANCELLED', 'ON_HOLD'] },
        ...extSomeActive,
      },
      _sum: { externalTransferFee: true },
    }),
    prisma.inquiry.aggregate({
      where: {
        status: 'CANCELLED',
        externalTransferFee: { not: null },
        preferredDate: { lt: yearFromDt },
        OR: [
          { cancelFeeExternalCompanyId: companyId },
          {
            assignments: {
              some: {
                teamLeader: { role: 'EXTERNAL_PARTNER' as const, externalCompanyId: companyId },
              },
            },
          },
        ],
      },
      _sum: { externalTransferFee: true },
    }),
    prisma.externalCompanySettlementPayment.aggregate({
      where: { externalCompanyId: companyId, paidAt: { lt: yearFromDt } },
      _sum: { amount: true },
    }),
    prisma.externalCompanySettlementPayment.aggregate({
      where: { externalCompanyId: companyId, paidAt: { gte: yearFromDt, lte: yearToDt } },
      _sum: { amount: true },
    }),
    prisma.externalCompanySettlementPayment.findFirst({
      where: { externalCompanyId: companyId },
      orderBy: { paidAt: 'desc' },
      select: { amount: true, paidAt: true },
    }),
  ]);

  const yearTotalFee =
    (activeYearAgg._sum.externalTransferFee ?? 0) - (cancelledYearAgg._sum.externalTransferFee ?? 0);
  const signedBeforeYear =
    (activeBeforeYearAgg._sum.externalTransferFee ?? 0) - (cancelledBeforeYearAgg._sum.externalTransferFee ?? 0);
  const paidBeforeYear = paidBeforeYearAgg._sum.amount ?? 0;
  const yearCarryOverAmount = signedBeforeYear - paidBeforeYear;
  const yearPeriodPaidAmount = yearPaidInYearAgg._sum.amount ?? 0;
  const yearPayableAmount = yearCarryOverAmount + yearTotalFee;
  const yearRemainingAmount = yearPayableAmount - yearPeriodPaidAmount;
  const lastSettlementPayment = lastPaymentRow
    ? { amount: lastPaymentRow.amount, paidAt: lastPaymentRow.paidAt.toISOString() }
    : null;

  /** 정산완료내역 "처리 후" — 관리자 집계(첫 외부담당 귀속)와 동일한 누적 인정액을 기준으로, 전체 정산을 시점순 누적 */
  const [activeRowsCumulative, cancelledRowsCumulative, allPaymentsChrono] = await Promise.all([
    prisma.inquiry.findMany({
      where: {
        externalTransferFee: { not: null },
        status: { notIn: ['CANCELLED', 'ON_HOLD'] },
        assignments: {
          some: { teamLeader: { role: 'EXTERNAL_PARTNER', externalCompanyId: { not: null } } },
        },
      },
      select: {
        externalTransferFee: true,
        assignments: {
          orderBy: { sortOrder: 'asc' as const },
          select: { teamLeader: { select: { role: true, externalCompanyId: true } } },
        },
      },
    }),
    prisma.inquiry.findMany({
      where: {
        status: 'CANCELLED',
        externalTransferFee: { not: null },
        OR: [
          { cancelFeeExternalCompanyId: { not: null } },
          {
            assignments: {
              some: { teamLeader: { role: 'EXTERNAL_PARTNER', externalCompanyId: { not: null } } },
            },
          },
        ],
      },
      select: {
        externalTransferFee: true,
        cancelFeeExternalCompanyId: true,
        assignments: {
          orderBy: { sortOrder: 'asc' as const },
          select: { teamLeader: { select: { role: true, externalCompanyId: true } } },
        },
      },
    }),
    prisma.externalCompanySettlementPayment.findMany({
      where: { externalCompanyId: companyId },
      orderBy: [{ paidAt: 'asc' as const }, { id: 'asc' as const }],
      select: { id: true, amount: true },
    }),
  ]);

  let cumulativeNetSigned = 0;
  for (const r of activeRowsCumulative) {
    const ext = r.assignments.find(
      (a) => a.teamLeader.role === 'EXTERNAL_PARTNER' && a.teamLeader.externalCompanyId
    );
    const cid = ext?.teamLeader.externalCompanyId ?? null;
    if (cid === companyId) cumulativeNetSigned += r.externalTransferFee ?? 0;
  }
  for (const r of cancelledRowsCumulative) {
    const ext = r.assignments.find(
      (a) => a.teamLeader.role === 'EXTERNAL_PARTNER' && a.teamLeader.externalCompanyId
    );
    const cid = r.cancelFeeExternalCompanyId ?? ext?.teamLeader.externalCompanyId ?? null;
    if (cid === companyId) cumulativeNetSigned -= r.externalTransferFee ?? 0;
  }

  const outstandingAfterByPaymentId = new Map<string, number>();
  let paidRunning = 0;
  for (const p of allPaymentsChrono) {
    paidRunning += p.amount;
    outstandingAfterByPaymentId.set(p.id, cumulativeNetSigned - paidRunning);
  }

  res.json({
    month: loYmd.slice(0, 7),
    from: loYmd,
    to: hiYmd,
    externalCompanyId: companyId,
    externalCompanyName: companyName,
    inquiryCount,
    cancelledInquiryCount,
    totalCount: inquiryCount + cancelledInquiryCount,
    totalFee,
    carryOverAmount,
    payableAmount,
    periodPaidAmount,
    remainingAmount,
    summaryYear,
    yFromYmd,
    yToYmd,
    yearTotalFee,
    yearCarryOverAmount,
    yearPayableAmount,
    yearPeriodPaidAmount,
    yearRemainingAmount,
    lastSettlementPayment,
    payments: paymentRows.map((r) => ({
      id: r.id,
      amount: r.amount,
      paidAt: r.paidAt.toISOString(),
      memo: r.memo ?? null,
      actorName: r.actor?.name ?? null,
      actorRole: r.actor?.role ?? null,
      outstandingAfterCumulative: outstandingAfterByPaymentId.get(r.id) ?? 0,
    })),
    items,
  });
});

/** 관리자/마케터: 타업체 정산완료(부분 지급) 기록 */
router.post('/external-settlement/payments', async (req, res) => {
  const viewer = (req as unknown as {
    teamViewer?: { userId: string; role: string };
    user: AuthPayload;
  }).teamViewer;
  const actorId = viewer?.userId ?? (req as unknown as { user: AuthPayload }).user.userId;
  const actorRole = viewer?.role ?? (req as unknown as { user: AuthPayload }).user.role;
  if (actorRole !== 'ADMIN' && actorRole !== 'MARKETER') {
    res.status(403).json({ error: '정산완료 기록은 관리자/마케터만 처리할 수 있습니다.' });
    return;
  }
  const body = req.body as { externalCompanyId?: string; amount?: number; memo?: string; paidDate?: string };
  const externalCompanyId = typeof body.externalCompanyId === 'string' ? body.externalCompanyId.trim() : '';
  const amount = Number(body.amount);
  const memo = typeof body.memo === 'string' ? body.memo.trim() : '';
  const paidResolved = resolveExternalSettlementPaidAt(body.paidDate);
  if (!paidResolved.ok) {
    res.status(400).json({ error: paidResolved.error });
    return;
  }
  if (!externalCompanyId) {
    res.status(400).json({ error: 'externalCompanyId가 필요합니다.' });
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: '정산완료 금액은 0원보다 커야 합니다.' });
    return;
  }
  const co = await prisma.externalCompany.findFirst({
    where: { id: externalCompanyId, isActive: true },
    select: { id: true },
  });
  if (!co) {
    res.status(404).json({ error: '타업체를 찾을 수 없습니다.' });
    return;
  }
  const row = await prisma.externalCompanySettlementPayment.create({
    data: {
      externalCompanyId,
      amount: Math.floor(amount),
      memo: memo || null,
      actorId,
      paidAt: paidResolved.paidAt,
    },
    select: { id: true, amount: true, paidAt: true },
  });
  res.json({ ok: true, payment: { id: row.id, amount: row.amount, paidAt: row.paidAt.toISOString() } });
});

export default router;
