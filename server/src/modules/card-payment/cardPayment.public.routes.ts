import { Router } from 'express';
import { getPublicPaymentByToken } from './cardPaymentIntent.service.js';
import { saveCredentialFromPlatform } from './cardPaymentCredential.service.js';
import {
  getOnboardingByReviewToken,
  listOnboardingsForPartner,
  tenantIdForSubmittedOnboarding,
} from './cardPaymentOnboarding.service.js';
import { requirePgPartner, signPgPartnerToken, verifyPgPartnerLogin } from './pgPartnerAuth.js';
import { applyWspayWebhook } from './cardPaymentWebhook.service.js';
import { applyPaysisNotification, startPaysisWindowByLinkToken } from './cardPaymentWindow.service.js';

const router = Router();

router.get('/link/:token', async (req, res) => {
  const data = await getPublicPaymentByToken(String(req.params.token));
  if (!data) {
    res.status(404).json({ error: '결제 링크가 없거나 만료되었습니다.' });
    return;
  }
  if ('expired' in data) {
    res.status(410).json({ error: '결제 링크가 만료되었습니다.' });
    return;
  }
  res.json(data);
});

router.post('/link/:token/window', async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (body.cardNumber || body.cardNo || body.cvc) {
    res.status(400).json({ error: '카드번호는 결제창에서만 입력합니다.' });
    return;
  }
  const result = await startPaysisWindowByLinkToken(String(req.params.token), body.payScreen === 'M' ? 'M' : 'P');
  if ('error' in result) {
    res.status(result.status ?? 400).json({ error: result.error });
    return;
  }
  res.json({ redirectUrl: result.redirectUrl });
});

const partnerLoginFails = new Map<string, { count: number; resetAt: number }>();

router.post('/pg-partner/login', (req, res) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const fail = partnerLoginFails.get(ip);
  if (fail && fail.resetAt > now && fail.count >= 8) {
    res.status(429).json({ error: '잠시 후 다시 로그인해 주세요.' });
    return;
  }
  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  const loginId = typeof body.loginId === 'string' ? body.loginId : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!verifyPgPartnerLogin(loginId, password)) {
    const next = fail && fail.resetAt > now ? fail.count + 1 : 1;
    partnerLoginFails.set(ip, { count: next, resetAt: now + 10 * 60 * 1000 });
    res.status(401).json({ error: '아이디 또는 비밀번호가 맞지 않습니다.' });
    return;
  }
  partnerLoginFails.delete(ip);
  res.json({ token: signPgPartnerToken() });
});

router.get('/pg-partner/applications', async (req, res) => {
  if (!requirePgPartner(req, res)) return;
  const items = await listOnboardingsForPartner();
  res.json({ items });
});

router.post('/pg-partner/applications/:id/codes', async (req, res) => {
  if (!requirePgPartner(req, res)) return;
  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  if (body.cardNo || body.cardNumber || body.cvc || body.card_no) {
    res.status(400).json({ error: '카드번호는 받지 않습니다. 가맹 코드만 입력합니다.' });
    return;
  }
  const tenantId = await tenantIdForSubmittedOnboarding(String(req.params.id));
  if (!tenantId) {
    res.status(404).json({ error: 'PG 신청을 찾을 수 없습니다.' });
    return;
  }
  const mid = typeof body.mid === 'string' ? body.mid.trim() : '';
  const oid = typeof body.oid === 'string' ? body.oid.trim() : '';
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  const tid = typeof body.tid === 'string' && body.tid.trim() ? body.tid.trim() : mid;
  if (!/^[A-Za-z0-9]{4,32}$/.test(mid)) {
    res.status(400).json({ error: 'MID는 영문·숫자 4~32자리여야 합니다.' });
    return;
  }
  if (!/^[A-Za-z0-9]{4}$/.test(oid)) {
    res.status(400).json({ error: 'OID는 영문·숫자 4자리여야 합니다.' });
    return;
  }
  if (!apiKey || /^\d{13,19}$/.test(apiKey.replace(/\s/g, ''))) {
    res.status(400).json({ error: 'API 키 또는 결제창 mKey를 입력해 주세요. 카드번호는 받지 않습니다.' });
    return;
  }
  try {
    const saved = await saveCredentialFromPlatform({ tenantId, apiKey, tid, mid, oid });
    res.json({
      ok: true,
      mid: saved.connected ? saved.mid : null,
      oid: saved.connected ? saved.oid : null,
      apiKeyLast4: saved.connected ? saved.apiKeyLast4 : null,
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : '코드를 연결하지 못했습니다.' });
  }
});

router.get('/pg-join/:token', async (req, res) => {
  const row = await getOnboardingByReviewToken(String(req.params.token));
  if (!row) {
    res.status(404).json({ error: 'PG 신청을 찾을 수 없습니다.' });
    return;
  }
  const { tenantId: _tenantId, ...publicRow } = row;
  res.json(publicRow);
});

router.post('/pg-join/:token/codes', async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  if (body.cardNo || body.cardNumber || body.cvc || body.card_no) {
    res.status(400).json({ error: '카드번호는 받지 않습니다. 가맹 코드만 입력합니다.' });
    return;
  }
  const row = await getOnboardingByReviewToken(String(req.params.token));
  if (!row) {
    res.status(404).json({ error: 'PG 신청을 찾을 수 없습니다.' });
    return;
  }
  const mid = typeof body.mid === 'string' ? body.mid.trim() : '';
  const oid = typeof body.oid === 'string' ? body.oid.trim() : '';
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  const tid = typeof body.tid === 'string' && body.tid.trim() ? body.tid.trim() : mid;
  if (!/^[A-Za-z0-9]{4,32}$/.test(mid)) {
    res.status(400).json({ error: 'MID는 영문·숫자 4~32자리여야 합니다.' });
    return;
  }
  if (!/^[A-Za-z0-9]{4}$/.test(oid)) {
    res.status(400).json({ error: 'OID는 영문·숫자 4자리여야 합니다.' });
    return;
  }
  if (!apiKey) {
    res.status(400).json({ error: 'API 키 또는 결제창 mKey가 필요합니다.' });
    return;
  }
  if (/^\d{13,19}$/.test(apiKey.replace(/\s/g, ''))) {
    res.status(400).json({ error: '카드번호는 받지 않습니다. 가맹 키를 입력해 주세요.' });
    return;
  }
  try {
    const saved = await saveCredentialFromPlatform({
      tenantId: row.tenantId,
      apiKey,
      tid,
      mid,
      oid,
    });
    res.json({ ok: true, mid: saved.connected ? saved.mid : null, oid: saved.connected ? saved.oid : null });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : '코드를 연결하지 못했습니다.' });
  }
});

router.post('/paysis-noti', async (req, res) => {
  const result = await applyPaysisNotification(req.body);
  res.type('text/plain').send(result === 'SUCCESS' ? '<RESULT>SUCCESS</RESULT>' : '<RESULT>FAIL</RESULT>');
});

router.post('/wspay-webhook', async (req, res) => {
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  const result = await applyWspayWebhook(req.body, raw);
  if ('error' in result) {
    res.status(result.status ?? 400).json({ error: result.error });
    return;
  }
  res.json(result);
});

export default router;
