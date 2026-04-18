import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOrMarketer } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { dateToYmdKst, isUserEmployedOnYmd, kstTodayYmd } from '../users/userEmployment.js';
import { assignmentTeamLeaderSelect } from '../inquiries/assignmentTeamLeaderSelect.js';
import { notifyNewAssignmentForInquiry } from '../push/inquiryTeamWebPush.js';

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

  if (!inquiryId || !teamLeaderId) {
    res.status(400).json({ error: '문의 ID와 팀장 ID가 필요합니다.' });
    return;
  }

  const [inquiry, teamLeader] = await Promise.all([
    prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: { orderForm: { select: { createdById: true } } },
    }),
    prisma.user.findUnique({
      where: {
        id: teamLeaderId,
        isActive: true,
        role: { in: ['TEAM_LEADER', 'EXTERNAL_PARTNER'] },
      },
      select: { id: true, role: true, hireDate: true, resignationDate: true, externalCompanyId: true },
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

  if (inquiry.status === 'PENDING') {
    res.status(400).json({ error: '대기 상태(고객 발주서 미제출)인 건은 분배할 수 없습니다. 발주서 제출 후 접수로 바뀌면 분배할 수 있습니다.' });
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

  res.status(201).json(assignment);
});

export default router;
