import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOrMarketer } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { isTeamPreviewAdminEmail } from '../auth/teamPreview.helpers.js';
import { dateToYmdKst, isUserEmployedOnYmd, kstTodayYmd } from '../users/userEmployment.js';
import { assignmentTeamLeaderSelect } from '../inquiries/assignmentTeamLeaderSelect.js';
import { notifyAllActiveCrewGroupsRefresh } from '../crew/crewFieldRealtime.js';
import { notifyNewAssignmentForInquiry } from '../push/inquiryTeamWebPush.js';
import { notifyChangeLogToStaff } from '../realtime/changeLogNotify.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';

const router = Router();

router.use(authMiddleware);
router.use(adminOrMarketer);

router.post('/', async (req, res) => {
  const { inquiryId, teamLeaderId } = req.body as {
    inquiryId?: string;
    teamLeaderId?: string;
  };
  const user = (req as unknown as { user: AuthPayload }).user;
  const adminId = user.userId;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }

  if (!inquiryId || !teamLeaderId) {
    res.status(400).json({ error: '문의 ID와 팀장 ID가 필요합니다.' });
    return;
  }

  const [inquiry, teamLeader] = await Promise.all([
    prisma.inquiry.findFirst({
      where: { id: inquiryId, tenantId },
      include: { orderForm: { select: { createdById: true } } },
    }),
    prisma.user.findFirst({
      where: {
        id: teamLeaderId,
        tenantId,
        isActive: true,
        role: { in: ['TEAM_LEADER', 'EXTERNAL_PARTNER', 'ADMIN'] },
      },
      select: { id: true, role: true, email: true, hireDate: true, resignationDate: true, externalCompanyId: true },
    }),
  ]);

  if (!inquiry) {
    res.status(404).json({ error: '문의를 찾을 수 없습니다.' });
    return;
  }
  if (!teamLeader) {
    res.status(404).json({ error: '팀장·타업체 계정을 찾을 수 없습니다.' });
    return;
  }
  // 개발자(team-preview-admin) 본인만 ADMIN 역할인 채로 팀장 배정이 가능하다.
  if (teamLeader.role === 'ADMIN' && !isTeamPreviewAdminEmail(teamLeader.email)) {
    res.status(400).json({ error: '관리자는 팀장으로 배정할 수 없습니다.' });
    return;
  }
  if (teamLeader.role === 'EXTERNAL_PARTNER' && !teamLeader.externalCompanyId) {
    res.status(400).json({ error: '타업체 계정에 소속 업체가 없습니다.' });
    return;
  }
  const assignYmd = inquiry.preferredDate
    ? dateToYmdKst(new Date(inquiry.preferredDate))
    : kstTodayYmd();
  if (teamLeader.role === 'TEAM_LEADER') {
    if (!isUserEmployedOnYmd(teamLeader.hireDate, teamLeader.resignationDate, assignYmd)) {
      res.status(400).json({ error: '해당 예약일에 배정할 수 없는 팀장 계정입니다.' });
      return;
    }
  }

  if (inquiry.status === 'CANCELLED' || inquiry.status === 'ON_HOLD') {
    res.status(400).json({ error: '취소·보류 상태인 건에는 분배할 수 없습니다.' });
    return;
  }

  if (inquiry.status === 'PENDING') {
    res.status(400).json({ error: '대기 상태(고객 발주서 미제출)인 건은 분배할 수 없습니다. 발주서 제출 후 접수로 바뀌면 분배할 수 있습니다.' });
    return;
  }
  if (inquiry.status === 'DEPOSIT_PENDING') {
    res.status(400).json({
      error: '입금대기인 건은 분배할 수 없습니다. 입금 완료 후 발주서 생성·대기 전환 뒤 진행하세요.',
    });
    return;
  }
  if (inquiry.status === 'DEPOSIT_COMPLETED' || inquiry.status === 'ORDER_FORM_PENDING') {
    res.status(400).json({
      error:
        inquiry.status === 'ORDER_FORM_PENDING'
          ? '미제출(발주서 고객 작성 대기)인 건은 분배할 수 없습니다. 고객이 제출해 접수로 바뀐 뒤 진행하세요.'
          : '입금완료(발주서 미연결 또는 미제출)인 건은 분배할 수 없습니다. 발주서가 제출되어 접수로 전환된 뒤 진행하세요.',
    });
    return;
  }

  const prevLeaderRows = await prisma.assignment.findMany({
    where: { inquiryId },
    select: { teamLeaderId: true },
  });
  const prevLeaderSet = new Set(prevLeaderRows.map((r) => r.teamLeaderId));

  await prisma.$transaction(async (tx) => {
    await tx.assignment.deleteMany({ where: { inquiryId } });
    await tx.assignment.create({
      data: {
        tenantId,
        inquiryId,
        teamLeaderId,
        assignedById: adminId,
        sortOrder: 0,
      },
    });
    await tx.inquiry.update({
      where: { id: inquiryId },
      data: { status: 'ASSIGNED' },
    });
  });

  const assignment = await prisma.assignment.findFirst({
    where: { inquiryId },
    orderBy: { sortOrder: 'asc' },
    include: {
      teamLeader: { select: assignmentTeamLeaderSelect },
    },
  });

  void notifyNewAssignmentForInquiry(inquiryId, [teamLeaderId], [...prevLeaderSet]).catch((e) =>
    console.error('[assignment-notify] notifyNewAssignmentForInquiry', e)
  );
  void notifyAllActiveCrewGroupsRefresh(tenantId).catch((e) =>
    console.error('[assignment-notify] notifyAllActiveCrewGroupsRefresh', e)
  );

  // 첫 배정(미배정 → 배정)은 "배정"일 뿐 변경 이력으로 보지 않는다.
  // 이미 배정된 건에 한해, 이후 담당이 바뀐 경우만 종 아이콘에 잡히게 한다.
  try {
    const nameIds = [...new Set([...prevLeaderSet, teamLeaderId])];
    const named = await prisma.user.findMany({
      where: { id: { in: nameIds }, tenantId },
      select: { id: true, name: true },
    });
    const nameOf = (uid: string) => named.find((u) => u.id === uid)?.name ?? '(이전 담당)';
    const beforeTxt =
      prevLeaderSet.size > 0 ? [...prevLeaderSet].map(nameOf).join(', ') : '(없음)';
    const afterTxt = nameOf(teamLeaderId);
    if (prevLeaderSet.size > 0 && beforeTxt !== afterTxt) {
      const line = `팀장 배정: ${beforeTxt} → ${afterTxt}`;
      await prisma.inquiryChangeLog.create({
        data: { inquiryId, customerName: inquiry.customerName, actorId: adminId, lines: [line] },
      });
      notifyChangeLogToStaff({ tenantId, customerName: inquiry.customerName, inquiryId, lines: [line] });
    }
  } catch (e) {
    console.error('[assignment-notify] changeLog', e);
  }

  res.status(201).json(assignment);
});

export default router;
