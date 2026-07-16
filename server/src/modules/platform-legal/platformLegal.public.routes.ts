import { Router, type Request } from 'express';
import { getPublicLegalSession, submitPublicLegalAgreement } from './platformLegal.service.js';

const router = Router();

function clientIp(req: Request): string | undefined {
  const xfRaw = req.headers['x-forwarded-for'];
  const xf = typeof xfRaw === 'string' ? xfRaw.split(',')[0]?.trim() : '';
  const raw = xf || req.socket?.remoteAddress || '';
  return raw || undefined;
}

router.get('/agree/:token', async (req, res) => {
  try {
    const sessionOrErr = await getPublicLegalSession(req.params.token);
    if ('error' in sessionOrErr) {
      const code = sessionOrErr.error;
      const status = code === 'not_found' ? 404 : code === 'expired' ? 410 : 403;
      const msg =
        code === 'expired'
          ? '만료된 링크입니다.'
          : code === 'not_found'
            ? '링크를 찾을 수 없습니다.'
            : '문서를 열 수 없습니다.';
      res.status(status).json({ error: msg });
      return;
    }
    res.json({ session: sessionOrErr });
  } catch (e) {
    console.error('[platform legal public] GET agree', e);
    res.status(500).json({ error: '불러오지 못했습니다.' });
  }
});

router.post('/agree/:token', async (req, res) => {
  const b = req.body ?? {};
  const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined;
  try {
    const result = await submitPublicLegalAgreement({
      token: req.params.token,
      companyName: String(b.companyName ?? ''),
      signerName: String(b.signerName ?? ''),
      signerTitle: String(b.signerTitle ?? ''),
      signerEmail: b.signerEmail != null ? String(b.signerEmail) : null,
      signerPhone: b.signerPhone != null ? String(b.signerPhone) : null,
      tenantSlug: b.tenantSlug != null ? String(b.tenantSlug) : null,
      agreed: Boolean(b.agreed),
      signerIp: clientIp(req),
      signerUserAgent: ua,
    });
    res.status(201).json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'NOT_FOUND') {
      res.status(404).json({ error: '링크를 찾을 수 없습니다.' });
      return;
    }
    if (msg === 'EXPIRED') {
      res.status(410).json({ error: '만료된 링크입니다.' });
      return;
    }
    if (msg === 'ALREADY_AGREED') {
      res.status(409).json({ error: '이미 동의가 완료된 링크입니다.' });
      return;
    }
    if (msg === 'UNPUBLISHED') {
      res.status(403).json({ error: '문서를 열 수 없습니다.' });
      return;
    }
    if (
      msg === 'AGREEMENT_REQUIRED' ||
      msg === 'COMPANY_REQUIRED' ||
      msg === 'SIGNER_NAME_REQUIRED' ||
      msg === 'SIGNER_TITLE_REQUIRED'
    ) {
      res.status(400).json({ error: '필수 항목을 확인해 주세요.' });
      return;
    }
    console.error('[platform legal public] POST agree', e);
    res.status(500).json({ error: '제출에 실패했습니다.' });
  }
});

export default router;
