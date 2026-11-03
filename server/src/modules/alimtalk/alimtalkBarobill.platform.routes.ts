import { Router } from 'express';
import { platformAuthMiddleware, platformSuperAdminOnly } from '../platform/platformAuth.middleware.js';
import {
  barobillKakaoSenderId,
  describeBarobillKakaoConfigGap,
  getChannelManagementUrl,
  getHistoryUrl,
  getTemplateManagementUrl,
} from '../../lib/barobill/kakaotalk.js';
import { BarobillCallError, platformBarobillCause } from '../../lib/barobill/soap.js';
import {
  loadBarobillAlimtalkOverview,
  setAlimtalkTemplateProvider,
  syncBarobillAlimtalkTemplates,
} from './alimtalkBarobillSync.service.js';

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
    const message = err instanceof BarobillCallError ? platformBarobillCause(err) : '바로빌 템플릿 동기화에 실패했습니다.';
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

export default router;
