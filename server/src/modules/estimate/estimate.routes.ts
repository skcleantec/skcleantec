import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, adminOnly, adminOrMarketer } from '../auth/auth.middleware.js';

const router = Router();
router.use(authMiddleware);

/** Read estimate defaults (order form UI for admin + marketer) */
router.get('/config', adminOrMarketer, async (_req, res) => {
  let config = await prisma.estimateConfig.findFirst();
  if (!config) {
    config = await prisma.estimateConfig.create({
      data: { pricePerPyeong: 5000, depositAmount: 20000 },
    });
  }
  res.json(config);
});

/** Update estimate defaults — admin only */
router.put('/config', adminOnly, async (req, res) => {
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

/** Active add-on options only */
router.get('/options', adminOrMarketer, async (_req, res) => {
  const list = await prisma.estimateOption.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  res.json({ items: list });
});

/** All add-on options including inactive */
router.get('/options/all', adminOrMarketer, async (_req, res) => {
  const list = await prisma.estimateOption.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ items: list });
});

router.post('/options', adminOnly, async (req, res) => {
  const { name, extraAmount, sortOrder } = req.body as {
    name: string;
    extraAmount?: number;
    sortOrder?: number;
  };
  if (!name || name.trim() === '') {
    res.status(400).json({ error: '\uC635\uC158\uBA85\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.' });
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

router.patch('/options/:id', adminOnly, async (req, res) => {
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

router.delete('/options/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  await prisma.estimateOption.update({
    where: { id },
    data: { isActive: false },
  });
  res.json({ ok: true });
});

export default router;
