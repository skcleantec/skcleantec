import { Router } from 'express';
import { platformAuthMiddleware } from './platformAuth.middleware.js';
import { listPlatformCoinUsage } from './platformCoinUsage.service.js';

const router = Router();

router.use(platformAuthMiddleware);

/** 전 테넌트 월별 코인 사용량 (Premium·grace 포함) */
router.get('/', async (req, res) => {
  try {
    const data = await listPlatformCoinUsage(req.query as Record<string, unknown>);
    res.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '코인 사용량 조회에 실패했습니다.';
    res.status(500).json({ error: msg });
  }
});

export default router;
