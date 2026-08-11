import { Router } from 'express';
import {
  platformAuthMiddleware,
  platformSuperAdminOnly,
} from '../platform/platformAuth.middleware.js';
import {
  createPlatformSmtpProfile,
  deletePlatformSmtpProfile,
  formatPlatformSmtpProfileTestError,
  getPlatformSmtpProfileById,
  listOutboundEmailPurposeCatalog,
  listPlatformSmtpProfiles,
  sendPlatformSmtpProfileTestMail,
  updatePlatformSmtpProfile,
} from './platformSmtpProfile.service.js';
import { parseOutboundEmailPurposes } from '../../lib/outboundEmailPurpose.js';
import { prisma } from '../../lib/prisma.js';

const router = Router();

router.use(platformAuthMiddleware);

router.get('/purposes', (_req, res) => {
  res.json({ items: listOutboundEmailPurposeCatalog() });
});

router.get('/', async (_req, res) => {
  try {
    const items = await listPlatformSmtpProfiles();
    res.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '목록 조회에 실패했습니다.';
    res.status(500).json({ error: msg });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await getPlatformSmtpProfileById(req.params.id);
    if (!item) {
      res.status(404).json({ error: 'SMTP 프로필을 찾을 수 없습니다.' });
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
    const item = await createPlatformSmtpProfile({
      slug: String(body.slug ?? ''),
      label: String(body.label ?? ''),
      enabled: body.enabled !== false,
      purposes: parseOutboundEmailPurposes(body.purposes),
      defaultDisplayName:
        typeof body.defaultDisplayName === 'string' ? body.defaultDisplayName : undefined,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
      smtp:
        body.smtp && typeof body.smtp === 'object' && !Array.isArray(body.smtp)
          ? (body.smtp as {
              host?: string;
              port?: number | null;
              secure?: boolean;
              user?: string;
              from?: string;
              password?: string;
            })
          : undefined,
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
    const item = await updatePlatformSmtpProfile(req.params.id, {
      slug: typeof body.slug === 'string' ? body.slug : undefined,
      label: typeof body.label === 'string' ? body.label : undefined,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      purposes: body.purposes !== undefined ? parseOutboundEmailPurposes(body.purposes) : undefined,
      defaultDisplayName:
        body.defaultDisplayName === null
          ? null
          : typeof body.defaultDisplayName === 'string'
            ? body.defaultDisplayName
            : undefined,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
      smtp:
        body.smtp && typeof body.smtp === 'object' && !Array.isArray(body.smtp)
          ? (body.smtp as {
              host?: string;
              port?: number | null;
              secure?: boolean;
              user?: string;
              from?: string;
              password?: string;
            })
          : undefined,
    });
    res.json(item);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '저장에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.delete('/:id', platformSuperAdminOnly, async (req, res) => {
  try {
    await deletePlatformSmtpProfile(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '삭제에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.post('/:id/test', platformSuperAdminOnly, async (req, res) => {
  try {
    const body = req.body as { to?: string };
    const to = typeof body.to === 'string' ? body.to.trim() : '';
    await sendPlatformSmtpProfileTestMail(req.params.id, to);
    res.json({ ok: true, message: '테스트 메일을 발송했습니다.' });
  } catch (e) {
    const row = await prisma.platformSmtpProfile.findUnique({ where: { id: req.params.id } });
    const msg =
      row != null
        ? formatPlatformSmtpProfileTestError(e, row)
        : e instanceof Error
          ? e.message
          : '테스트 발송에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

export default router;
