import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOrMarketer } from '../auth/auth.middleware.js';

const router = Router();

router.use(authMiddleware);
router.use(adminOrMarketer);

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** preferredDate 조회 — 하루 단위는 KST(Asia/Seoul)와 동일하게 맞춤 (말일 일정 누락 방지) */
function rangeFromQuery(start?: string, end?: string) {
  const now = new Date();
  if (start && YMD.test(start) && end && YMD.test(end)) {
    return {
      startDate: new Date(`${start}T00:00:00+09:00`),
      endDate: new Date(`${end}T23:59:59.999+09:00`),
    };
  }
  return {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
    endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

router.get('/', async (req, res) => {
  const { start, end } = req.query as { start?: string; end?: string };
  const { startDate, endDate } = rangeFromQuery(
    typeof start === 'string' ? start : undefined,
    typeof end === 'string' ? end : undefined
  );

  const items = await prisma.inquiry.findMany({
    where: {
      preferredDate: { gte: startDate, lte: endDate },
      /** 대기(PENDING)도 예약일이 있으면 스케줄에 표시(접수 확정 전·발주서 대기 구분용) */
      status: { not: 'CANCELLED' },
    },
    orderBy: [{ preferredDate: 'asc' }, { preferredTime: 'asc' }],
    include: {
      assignments: {
        include: { teamLeader: { select: { id: true, name: true } } },
      },
      orderForm: {
        select: {
          id: true,
          totalAmount: true,
          depositAmount: true,
          balanceAmount: true,
          createdBy: { select: { id: true, name: true } },
        },
      },
      changeLogs: {
        orderBy: { createdAt: 'desc' as const },
        take: 30,
        select: { id: true, createdAt: true, lines: true },
      },
    },
  });

  res.json({ items });
});

export default router;
