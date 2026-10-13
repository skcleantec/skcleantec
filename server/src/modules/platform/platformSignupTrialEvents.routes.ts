import { Router } from 'express';
import {
  platformAuthMiddleware,
  platformSuperAdminOnly,
  type PlatformScopedRequest,
} from './platformAuth.middleware.js';
import {
  createSignupTrialEvent,
  deleteSignupTrialEvent,
  getActiveSignupTrialEvent,
  getSignupTrialEvent,
  listSignupTrialEvents,
  updateSignupTrialEvent,
} from './signupTrialEvent.service.js';

const router = Router();

router.use(platformAuthMiddleware);

router.get('/', async (_req, res) => {
  try {
    const items = await listSignupTrialEvents();
    const active = await getActiveSignupTrialEvent();
    res.json({
      items,
      activeEventId: active?.id ?? null,
      policyNote:
        '켜져 있으면 가입과 동시에 그 일수만큼 무료로 바로 이용합니다. 끄면 그 시각 이후 가입·승인에는 무료 체험이 적용되지 않습니다.',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '목록 조회에 실패했습니다.';
    res.status(500).json({ error: msg });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await getSignupTrialEvent(req.params.id);
    if (!item) {
      res.status(404).json({ error: '이벤트를 찾을 수 없습니다.' });
      return;
    }
    res.json(item);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '조회에 실패했습니다.';
    res.status(500).json({ error: msg });
  }
});

router.post('/', platformSuperAdminOnly, async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const platformUser = (req as PlatformScopedRequest).platformUser;
    const item = await createSignupTrialEvent({
      name: String(body.name ?? ''),
      isActive: body.isActive !== false,
      trialDays: body.trialDays != null ? Number(body.trialDays) : undefined,
      startsAt: (body.startsAt as string | null | undefined) ?? null,
      endsAt: (body.endsAt as string | null | undefined) ?? null,
      applySelfServe: body.applySelfServe !== false,
      applyPlatformProvision: body.applyPlatformProvision !== false,
      includeCoinGrace: body.includeCoinGrace !== false,
      priority: body.priority != null ? Number(body.priority) : undefined,
      createdByPlatformUserId: platformUser?.platformUserId ?? null,
    });
    res.status(201).json(item);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '생성에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.patch('/:id', platformSuperAdminOnly, async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const item = await updateSignupTrialEvent(req.params.id, {
      name: body.name != null ? String(body.name) : undefined,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
      trialDays: body.trialDays != null ? Number(body.trialDays) : undefined,
      startsAt: body.startsAt !== undefined ? (body.startsAt as string | null) : undefined,
      endsAt: body.endsAt !== undefined ? (body.endsAt as string | null) : undefined,
      applySelfServe: typeof body.applySelfServe === 'boolean' ? body.applySelfServe : undefined,
      applyPlatformProvision:
        typeof body.applyPlatformProvision === 'boolean' ? body.applyPlatformProvision : undefined,
      includeCoinGrace: typeof body.includeCoinGrace === 'boolean' ? body.includeCoinGrace : undefined,
      priority: body.priority != null ? Number(body.priority) : undefined,
    });
    res.json(item);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '저장에 실패했습니다.';
    const status = msg.includes('찾을 수 없') ? 404 : 400;
    res.status(status).json({ error: msg });
  }
});

router.delete('/:id', platformSuperAdminOnly, async (req, res) => {
  try {
    await deleteSignupTrialEvent(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '삭제에 실패했습니다.';
    const status = msg.includes('찾을 수 없') ? 404 : 400;
    res.status(status).json({ error: msg });
  }
});

export default router;
