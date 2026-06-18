import { Router } from 'express';
import { platformAuthMiddleware, platformSuperAdminOnly } from './platformAuth.middleware.js';
import {
  createTenantSupportAccessForPlatform,
  listTenantSupportAccessForPlatform,
  suggestSupportAccessLoginId,
  suggestSupportAccessPassword,
  updateTenantSupportAccessForPlatform,
} from './tenantSupportAccess.service.js';

const router = Router();

router.use(platformAuthMiddleware);

router.get('/suggest', platformSuperAdminOnly, (_req, res) => {
  res.json({
    loginId: suggestSupportAccessLoginId(),
    password: suggestSupportAccessPassword(),
  });
});

router.get('/', platformSuperAdminOnly, async (_req, res) => {
  const items = await listTenantSupportAccessForPlatform();
  res.json({ items });
});

router.post('/', platformSuperAdminOnly, async (req, res) => {
  try {
    const body = req.body as {
      loginId?: string;
      password?: string;
      name?: string;
      memo?: string;
    };
    const result = await createTenantSupportAccessForPlatform({
      loginId: String(body.loginId ?? suggestSupportAccessLoginId()),
      password: String(body.password ?? suggestSupportAccessPassword()),
      name: body.name,
      memo: body.memo,
    });
    res.status(201).json({
      account: result.account,
      initialPassword: result.initialPassword,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '계정 생성에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.patch('/:id', platformSuperAdminOnly, async (req, res) => {
  try {
    const body = req.body as {
      loginId?: string;
      password?: string;
      name?: string;
      memo?: string | null;
      isActive?: boolean;
    };
    const account = await updateTenantSupportAccessForPlatform(req.params.id, body);
    res.json({ account });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '계정 수정에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

export default router;
