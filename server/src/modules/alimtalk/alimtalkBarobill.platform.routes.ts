import { Router } from 'express';
import { platformAuthMiddleware, platformSuperAdminOnly } from '../platform/platformAuth.middleware.js';
import {
  barobillKakaoSenderId,
  describeBarobillKakaoConfigGap,
  getChannelManagementUrl,
  getChannels,
  getHistoryUrl,
  getTemplateManagementUrl,
} from '../../lib/barobill/kakaotalk.js';
import { redactSecrets } from '../../lib/barobill/mask.js';
import { BarobillCallError, platformBarobillCause } from '../../lib/barobill/soap.js';
import {
  loadBarobillAlimtalkOverview,
  setAlimtalkTemplateProvider,
  syncBarobillAlimtalkTemplates,
} from './alimtalkBarobillSync.service.js';
import {
  disconnectBrandChannel,
  excludeBrandChannelSetupFee,
  linkBrandChannel,
  listPlatformBrandChannels,
  listTenantBrandChannelDetail,
} from './alimtalkBrandChannel.service.js';
import { brandChannelLastCheckedAt, syncAlimtalkBrandChannels } from './alimtalkBrandChannel.sync.js';
import { saveBrandChannelFees } from './alimtalkBrandChannel.fee.js';
import { channelIdsMatch, isPlatformDefaultChannel } from './alimtalkBrandChannel.select.js';
import { loadBrandChannelCopy } from './alimtalkBrandChannel.copy.js';
import { prisma } from '../../lib/prisma.js';

function syncRouteError(err: unknown): string {
  if (err instanceof BarobillCallError) return platformBarobillCause(err);
  const raw = err instanceof Error ? err.message : '';
  const cleaned = redactSecrets(raw)
    .replace(/01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
  return cleaned || '바로빌 템플릿 동기화에 실패했습니다.';
}

const router = Router();

router.use(platformAuthMiddleware);

router.get('/barobill', async (_req, res) => {
  try {
    const overview = await loadBarobillAlimtalkOverview();
    res.json(overview);
  } catch (err) {
    const message = err instanceof BarobillCallError ? platformBarobillCause(err) : '바로빌 알림톡 상태를 불러오지 못했습니다.';
    res.status(502).json({ error: message });
  }
});

router.post('/barobill/sync', platformSuperAdminOnly, async (_req, res) => {
  try {
    const result = await syncBarobillAlimtalkTemplates({ force: true });
    res.json(result);
  } catch (err) {
    const message = syncRouteError(err);
    res.status(502).json({ error: message });
  }
});

router.post('/barobill/url', platformSuperAdminOnly, async (req, res) => {
  const kind = typeof req.body?.kind === 'string' ? req.body.kind : '';
  const gap = describeBarobillKakaoConfigGap();
  if (gap?.includes('BAROBILL_KAKAO_SENDER_ID') || gap?.includes('BAROBILL_CERTKEY')) {
    res.status(400).json({ error: gap });
    return;
  }
  try {
    const id = barobillKakaoSenderId();
    const url =
      kind === 'channel'
        ? await getChannelManagementUrl(id)
        : kind === 'template'
          ? await getTemplateManagementUrl(id)
          : kind === 'history'
            ? await getHistoryUrl(id)
            : '';
    if (!url) {
      res.status(400).json({ error: '관리 화면 종류가 올바르지 않습니다.' });
      return;
    }
    res.json({ url });
  } catch (err) {
    const message = err instanceof BarobillCallError ? platformBarobillCause(err) : '바로빌 관리 주소를 받지 못했습니다.';
    res.status(502).json({ error: message });
  }
});

router.patch('/templates/:code/provider', platformSuperAdminOnly, async (req, res) => {
  const provider = req.body?.provider;
  if (provider !== 'solapi' && provider !== 'barobill') {
    res.status(400).json({ error: '보내는 곳은 솔라피 또는 바로빌입니다.' });
    return;
  }
  try {
    const updated = await setAlimtalkTemplateProvider(req.params.code, provider);
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : '보내는 곳을 바꾸지 못했습니다.';
    const status = message.includes('정상') ? 400 : 404;
    res.status(status).json({ error: message });
  }
});

router.get('/brand-channel-copy', async (_req, res) => {
  res.json({ templates: await loadBrandChannelCopy() });
});

router.get('/brand-channels', async (_req, res) => {
  const data = await listPlatformBrandChannels();
  res.json({ ...data, lastCheckedAt: brandChannelLastCheckedAt() });
});

router.post('/brand-channels/sync', platformSuperAdminOnly, async (_req, res) => {
  try {
    const result = await syncAlimtalkBrandChannels();
    res.json({ ...result, lastCheckedAt: brandChannelLastCheckedAt() });
  } catch (err) {
    const message = err instanceof Error ? err.message : '채널 심사를 확인하지 못했습니다.';
    res.status(502).json({ error: message.replace(/바로빌/g, '발송 서비스') });
  }
});

router.get('/brand-channels/remote', platformSuperAdminOnly, async (_req, res) => {
  try {
    const channels = await getChannels();
    const used = await prisma.alimtalkBrandChannel.findMany({
      where: { status: { not: 'DISCONNECTED' }, providerChannelId: { not: null } },
      select: { providerChannelId: true, operatingCompany: { select: { name: true } } },
    });
    const platformChannelId = process.env.BAROBILL_KAKAO_CHANNEL_ID?.trim() ?? '';
    res.json({
      channels: channels.map((row) => ({
        channelId: row.ChannelId,
        channelName: row.ChannelName,
        platformDefault: isPlatformDefaultChannel(row.ChannelId, platformChannelId),
        usedBy:
          used.find(
            (item) => item.providerChannelId && channelIdsMatch(item.providerChannelId, item.providerChannelId, row.ChannelId),
          )?.operatingCompany.name ?? null,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '채널 목록을 불러오지 못했습니다.';
    res.status(502).json({ error: message.replace(/바로빌/g, '발송 서비스') });
  }
});

router.patch('/brand-channel-fees', platformSuperAdminOnly, async (req, res) => {
  const setupFeeKrw = Number(req.body?.setupFeeKrw);
  const customCopyFeeKrw = Number(req.body?.customCopyFeeKrw);
  if (!Number.isFinite(setupFeeKrw) || setupFeeKrw < 0 || !Number.isFinite(customCopyFeeKrw) || customCopyFeeKrw < 0) {
    res.status(400).json({ error: '금액을 확인해 주세요.' });
    return;
  }
  await saveBrandChannelFees({ setupFeeKrw: Math.round(setupFeeKrw), customCopyFeeKrw: Math.round(customCopyFeeKrw) });
  res.json({ ok: true });
});

router.get('/tenants/:tenantId/brand-channels', async (req, res) => {
  res.json({ brands: await listTenantBrandChannelDetail(req.params.tenantId) });
});

router.post('/tenants/:tenantId/brand-channels/link', platformSuperAdminOnly, async (req, res) => {
  const result = await linkBrandChannel({
    tenantId: req.params.tenantId,
    operatingCompanyId: String(req.body?.operatingCompanyId ?? ''),
    providerChannelId: String(req.body?.providerChannelId ?? ''),
    createTemplates: req.body?.createTemplates !== false,
  });
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true });
});

router.post('/tenants/:tenantId/brand-channels/:channelId/disconnect', platformSuperAdminOnly, async (req, res) => {
  await disconnectBrandChannel(req.params.tenantId, req.params.channelId);
  res.json({ ok: true });
});

router.post('/tenants/:tenantId/brand-channels/:channelId/exclude-fee', platformSuperAdminOnly, async (req, res) => {
  await excludeBrandChannelSetupFee(req.params.tenantId, req.params.channelId);
  res.json({ ok: true });
});

export default router;
