import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOnly } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';

const router = Router();

router.use(authMiddleware);
router.use(adminOnly);

router.post('/', async (req, res) => {
  const { inquiryId, teamLeaderId } = req.body as {
    inquiryId?: string;
    teamLeaderId?: string;
  };
  const adminId = (req as { user: AuthPayload }).user.userId;

  if (!inquiryId || !teamLeaderId) {
    res.status(400).json({ error: '문의 ID와 팀장 ID가 필요합니다.' });
    return;
  }

  const [inquiry, teamLeader] = await Promise.all([
    prisma.inquiry.findUnique({ where: { id: inquiryId } }),
    prisma.user.findUnique({
      where: { id: teamLeaderId, role: 'TEAM_LEADER', isActive: true },
    }),
  ]);

  if (!inquiry) {
    res.status(404).json({ error: '문의를 찾을 수 없습니다.' });
    return;
  }
  if (!teamLeader) {
    res.status(404).json({ error: '팀장을 찾을 수 없습니다.' });
    return;
  }

  const assignment = await prisma.assignment.upsert({
    where: { inquiryId },
    create: {
      inquiryId,
      teamLeaderId,
      assignedById: adminId,
    },
    update: {
      teamLeaderId,
      assignedById: adminId,
    },
    include: {
      teamLeader: { select: { id: true, name: true } },
    },
  });

  await prisma.inquiry.update({
    where: { id: inquiryId },
    data: { status: 'ASSIGNED' },
  });

  res.status(201).json(assignment);
});

export default router;
