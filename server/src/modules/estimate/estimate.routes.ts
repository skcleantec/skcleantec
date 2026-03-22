import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOnly } from '../auth/auth.middleware.js';

const router = Router();
router.use(authMiddleware);
router.use(adminOnly);

/** 견적 설정 조회/수정 (평당 금액, 예약금) */
router.get('/config', async (_req, res) => {
  let config = await prisma.estimateConfig.findFirst();
  if (!config) {
    config = await prisma.estimateConfig.create({
      data: { pricePerPyeong: 5000, depositAmount: 20000 },
    });
  }
  res.json(config);
});

router.put('/config', async (req, res) => {
  const { pricePerPyeong, depositAmount } = req.body as {
    pricePerPyeong?: number;
    depositAmount?: number;
  };
  let config = await prisma.estimateConfig.findFirst();
  if (!config) {
    config = await prisma.estimateConfig.create({
      data: {
        pricePerPyeong: pricePerPyeong ?? 5000,
        depositAmount: depositAmount ?? 20000,
      },
    });
  } else {
    config = await prisma.estimateConfig.update({
      where: { id: config.id },
      data: {
        ...(pricePerPyeong != null && { pricePerPyeong }),
        ...(depositAmount != null && { depositAmount }),
      },
    });
  }
  res.json(config);
});

/** 추가 옵션 목록 */
router.get('/options', async (_req, res) => {
  const list = await prisma.estimateOption.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  res.json({ items: list });
});

/** 추가 옵션 전체 (비활성 포함) */
router.get('/options/all', async (_req, res) => {
  const list = await prisma.estimateOption.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ items: list });
});

/** 추가 옵션 추가 */
router.post('/options', async (req, res) => {
  const { name, extraAmount, sortOrder } = req.body as {
    name: string;
    extraAmount?: number;
    sortOrder?: number;
  };
  if (!name || name.trim() === '') {
    res.status(400).json({ error: '옵션명을 입력해주세요.' });
    return;
  }
  const created = await prisma.estimateOption.create({
    data: {
      name: name.trim(),
      extraAmount: extraAmount ?? 0,
      sortOrder: sortOrder ?? 0,
    },
  });
  res.json(created);
});

/** 추가 옵션 수정 */
router.patch('/options/:id', async (req, res) => {
  const { id } = req.params;
  const { name, extraAmount, sortOrder, isActive } = req.body;
  const updated = await prisma.estimateOption.update({
    where: { id },
    data: {
      ...(name != null && { name }),
      ...(extraAmount != null && { extraAmount }),
      ...(sortOrder != null && { sortOrder }),
      ...(isActive != null && { isActive }),
    },
  });
  res.json(updated);
});

/** 추가 옵션 삭제 (소프트 삭제) */
router.delete('/options/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.estimateOption.update({
    where: { id },
    data: { isActive: false },
  });
  res.json({ ok: true });
});

export default router;
