import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';
import {
  platformAuthMiddleware,
  platformSuperAdminOnly,
  type PlatformScopedRequest,
} from '../platform/platformAuth.middleware.js';
import {
  PLATFORM_PARTNER_PROMO_UPLOAD_FOLDER,
  parsePromoLinkTarget,
  parsePromoLinkUrl,
  promoScheduleStatus,
  serializeAdminPromo,
} from './platformPartnerPromo.helpers.js';

const router = Router();

router.use(platformAuthMiddleware, platformSuperAdminOnly);

function parseOptionalDate(raw: unknown): Date | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string') throw new Error('날짜 형식이 올바르지 않습니다.');
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error('날짜 형식이 올바르지 않습니다.');
  return d;
}

function parseBool(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === 'boolean') return raw;
  return fallback;
}

function parseTitle(raw: unknown): string {
  if (typeof raw !== 'string') throw new Error('제목을 입력해 주세요.');
  const t = raw.trim();
  if (!t) throw new Error('제목을 입력해 주세요.');
  if (t.length > 128) throw new Error('제목은 128자 이내입니다.');
  return t;
}

function parseImageUrl(raw: unknown, label: string): string {
  if (typeof raw !== 'string') throw new Error(`${label} 이미지를 업로드해 주세요.`);
  const u = raw.trim();
  if (!u.startsWith('https://')) throw new Error(`${label} 이미지 URL이 올바르지 않습니다.`);
  return u;
}

/** GET /api/platform/partner-promos */
router.get('/', async (_req, res) => {
  const rows = await prisma.platformPartnerPromo.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({
    items: rows.map((r) => ({ ...serializeAdminPromo(r), scheduleStatus: promoScheduleStatus(r) })),
  });
});

/** POST /api/platform/partner-promos/upload-sign */
router.post('/upload-sign', async (_req, res) => {
  try {
    if (!isCloudinaryConfigured()) {
      res.status(503).json({ error: '이미지 저장소가 준비되지 않았습니다.' });
      return;
    }
    const ts = Math.round(Date.now() / 1000);
    const folder = PLATFORM_PARTNER_PROMO_UPLOAD_FOLDER;
    const paramsToSign: Record<string, string | number> = { timestamp: ts, folder };
    const cfg = cloudinary.config();
    if (!cfg.api_secret) {
      res.status(503).json({ error: '저장 설정이 불완전합니다.' });
      return;
    }
    const signature = cloudinary.utils.api_sign_request(paramsToSign, cfg.api_secret);
    res.json({
      cloudName: cfg.cloud_name,
      apiKey: cfg.api_key,
      timestamp: ts,
      signature,
      folder,
    });
  } catch (e) {
    console.error('[platform-partner-promo] upload-sign', e);
    res.status(500).json({ error: '업로드 서명에 실패했습니다.' });
  }
});

function parsePromoImageUrls(body: {
  imageUrl?: unknown;
  mobileImageUrl?: unknown;
  desktopImageUrl?: unknown;
}): { mobileImageUrl: string; desktopImageUrl: string } {
  if (body.imageUrl !== undefined && body.imageUrl !== null && body.imageUrl !== '') {
    const u = parseImageUrl(body.imageUrl, '배너');
    return { mobileImageUrl: u, desktopImageUrl: u };
  }
  return {
    mobileImageUrl: parseImageUrl(body.mobileImageUrl, '배너'),
    desktopImageUrl: parseImageUrl(body.desktopImageUrl, '배너'),
  };
}

/** POST /api/platform/partner-promos */
router.post('/', async (req, res) => {
  const user = (req as PlatformScopedRequest).platformUser;
  try {
    const title = parseTitle(req.body?.title);
    const { mobileImageUrl, desktopImageUrl } = parsePromoImageUrls(req.body ?? {});
    const linkUrl = parsePromoLinkUrl(req.body?.linkUrl);
    const linkTarget = parsePromoLinkTarget(req.body?.linkTarget);
    const startsAt = parseOptionalDate(req.body?.startsAt);
    const endsAt = parseOptionalDate(req.body?.endsAt);
    if (startsAt && endsAt && endsAt <= startsAt) {
      res.status(400).json({ error: '종료일은 시작일 이후여야 합니다.' });
      return;
    }
    const maxSort = await prisma.platformPartnerPromo.aggregate({ _max: { sortOrder: true } });
    const row = await prisma.platformPartnerPromo.create({
      data: {
        title,
        mobileImageUrl,
        desktopImageUrl,
        linkUrl,
        linkTarget,
        startsAt,
        endsAt,
        isActive: parseBool(req.body?.isActive, true),
        showOnMobile: parseBool(req.body?.showOnMobile, true),
        showOnDesktop: parseBool(req.body?.showOnDesktop, true),
        showToExternalPartner: parseBool(req.body?.showToExternalPartner, true),
        showToTenantStaff: parseBool(req.body?.showToTenantStaff, false),
        showOnTeamDashboard: parseBool(req.body?.showOnTeamDashboard, true),
        showOnTeamAssignments: parseBool(req.body?.showOnTeamAssignments, true),
        showOnTeamSchedule: parseBool(req.body?.showOnTeamSchedule, true),
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        createdByPlatformUserId: user.platformUserId,
      },
    });
    res.status(201).json(serializeAdminPromo(row));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : '저장에 실패했습니다.' });
  }
});

/** PATCH /api/platform/partner-promos/:id */
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.platformPartnerPromo.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }
  try {
    const data: Record<string, unknown> = {};
    if (req.body?.title !== undefined) data.title = parseTitle(req.body.title);
    if (
      req.body?.imageUrl !== undefined ||
      req.body?.mobileImageUrl !== undefined ||
      req.body?.desktopImageUrl !== undefined
    ) {
      const urls = parsePromoImageUrls({
        imageUrl: req.body?.imageUrl,
        mobileImageUrl: req.body?.mobileImageUrl ?? existing.mobileImageUrl,
        desktopImageUrl: req.body?.desktopImageUrl ?? existing.desktopImageUrl,
      });
      data.mobileImageUrl = urls.mobileImageUrl;
      data.desktopImageUrl = urls.desktopImageUrl;
    }
    if (req.body?.linkUrl !== undefined) data.linkUrl = parsePromoLinkUrl(req.body.linkUrl);
    if (req.body?.linkTarget !== undefined) data.linkTarget = parsePromoLinkTarget(req.body.linkTarget);
    if (req.body?.startsAt !== undefined) data.startsAt = parseOptionalDate(req.body.startsAt);
    if (req.body?.endsAt !== undefined) data.endsAt = parseOptionalDate(req.body.endsAt);
    if (req.body?.isActive !== undefined) data.isActive = parseBool(req.body.isActive, existing.isActive);
    if (req.body?.showOnMobile !== undefined) {
      data.showOnMobile = parseBool(req.body.showOnMobile, existing.showOnMobile);
    }
    if (req.body?.showOnDesktop !== undefined) {
      data.showOnDesktop = parseBool(req.body.showOnDesktop, existing.showOnDesktop);
    }
    if (req.body?.showToExternalPartner !== undefined) {
      data.showToExternalPartner = parseBool(req.body.showToExternalPartner, existing.showToExternalPartner);
    }
    if (req.body?.showToTenantStaff !== undefined) {
      data.showToTenantStaff = parseBool(req.body.showToTenantStaff, existing.showToTenantStaff);
    }
    if (req.body?.showOnTeamDashboard !== undefined) {
      data.showOnTeamDashboard = parseBool(req.body.showOnTeamDashboard, existing.showOnTeamDashboard);
    }
    if (req.body?.showOnTeamAssignments !== undefined) {
      data.showOnTeamAssignments = parseBool(req.body.showOnTeamAssignments, existing.showOnTeamAssignments);
    }
    if (req.body?.showOnTeamSchedule !== undefined) {
      data.showOnTeamSchedule = parseBool(req.body.showOnTeamSchedule, existing.showOnTeamSchedule);
    }
    const startsAt = (data.startsAt as Date | null | undefined) ?? existing.startsAt;
    const endsAt = (data.endsAt as Date | null | undefined) ?? existing.endsAt;
    if (startsAt && endsAt && endsAt <= startsAt) {
      res.status(400).json({ error: '종료일은 시작일 이후여야 합니다.' });
      return;
    }
    const row = await prisma.platformPartnerPromo.update({ where: { id }, data });
    res.json(serializeAdminPromo(row));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : '수정에 실패했습니다.' });
  }
});

/** DELETE /api/platform/partner-promos/:id */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.platformPartnerPromo.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }
  await prisma.platformPartnerPromo.delete({ where: { id } });
  res.json({ ok: true });
});

/** POST /api/platform/partner-promos/reorder */
router.post('/reorder', async (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    res.status(400).json({ error: '순서 ID 목록이 올바르지 않습니다.' });
    return;
  }
  await prisma.$transaction(
    ids.map((id: string, index: number) =>
      prisma.platformPartnerPromo.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  res.json({ ok: true });
});

export default router;
