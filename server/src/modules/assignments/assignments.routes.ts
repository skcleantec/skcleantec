import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOrMarketer } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';

function canMarketerActOnInquiry(
  inquiry: { createdById: string | null; orderForm: { createdById: string } | null },
  marketerId: string
): boolean {
  if (inquiry.createdById === marketerId) return true;
  if (inquiry.createdById == null && inquiry.orderForm?.createdById === marketerId) return true;
  return false;
}

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
      where: { id: teamLeaderId, role: 'TEAM_LEADER', isActive: true },
    }),
  ]);

  if (!inquiry) {
    res.status(404).json({ error: '문의를 찾을 수 없습니다.' });
    return;
  }
  if (user.role === 'MARKETER' && !canMarketerActOnInquiry(inquiry, user.userId)) {
    res.status(403).json({ error: '본인이 접수한 건만 분배할 수 있습니다.' });
    return;
  }
  if (!teamLeader) {
    res.status(404).json({ error: '팀장을 찾을 수 없습니다.' });
    return;
  }

  if (inquiry.status === 'PENDING') {
    res.status(400).json({ error: '대기 상태(고객 발주서 미제출)인 건은 분배할 수 없습니다. 발주서 제출 후 접수로 바뀌면 분배할 수 있습니다.' });
    return;
  }

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
      teamLeader: { select: { id: true, name: true } },
    },
  });

  res.status(201).json(assignment);
});

export default router;
