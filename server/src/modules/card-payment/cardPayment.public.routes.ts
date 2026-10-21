import { Router } from 'express';
import { getPublicPaymentByToken } from './cardPaymentIntent.service.js';
import { readCredentialSecrets, saveCredentialFromPlatform, updateCredentialFromPartner } from './cardPaymentCredential.service.js';
import { connectPartnerRails, getPartnerMerchant, listPartnerMerchants, listPartnerPayments } from './pgPartnerMerchant.service.js';
import { readSellerCenterLogin, saveSellerCenterLogin, saveSellerCenterLoginId } from './cardPaymentSellerCenter.service.js';
import {
  getOnboardingByReviewToken,
  listOnboardingsForPartner,
  tenantIdForSubmittedOnboarding,
} from './cardPaymentOnboarding.service.js';
import { partnerRevealAllowed, readPgPartnerLoginId, requirePgPartner, signPgPartnerToken, verifyPgPartnerLogin } from './pgPartnerAuth.js';
import { listPartnerRefunds } from './pgPartnerRefund.service.js';
import {
  PLATFORM_PG_AGENCY_ID,
  getPlatformPgAgencyRow,
  platformAgencyDetail,
  readPlatformAgencySecrets,
  savePlatformAgencyFromPartner,
} from './platformPgAgency.service.js';
import { applyWspayWebhook } from './cardPaymentWebhook.service.js';
import { getPgApplicationNotifyEmails, savePgApplicationNotifyEmails } from './pgApplicationNotify.service.js';
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

router.post('/pg-partner/login', async (req, res) => {
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
  if (!(await verifyPgPartnerLogin(loginId, password))) {
    const next = fail && fail.resetAt > now ? fail.count + 1 : 1;
    partnerLoginFails.set(ip, { count: next, resetAt: now + 10 * 60 * 1000 });
    res.status(401).json({ error: '아이디 또는 비밀번호가 맞지 않습니다.' });
    return;
  }
  partnerLoginFails.delete(ip);
  res.json({ token: signPgPartnerToken(loginId) });
});

router.get('/pg-partner/refunds', async (req, res) => {
  if (!requirePgPartner(req, res)) return;
  res.json(await listPartnerRefunds());
});

router.get('/pg-partner/merchants', async (req, res) => {
  if (!requirePgPartner(req, res)) return;
  res.json({ items: await listPartnerMerchants() });
});

router.get('/pg-partner/merchants/:tenantId', async (req, res) => {
  if (!requirePgPartner(req, res)) return;
  const tenantId = String(req.params.tenantId);
  if (tenantId === PLATFORM_PG_AGENCY_ID) {
    res.json(platformAgencyDetail(await getPlatformPgAgencyRow()));
    return;
  }
  const row = await getPartnerMerchant(tenantId);
  if (!row) {
    res.status(404).json({ error: '업체를 찾을 수 없습니다.' });
    return;
  }
  res.json(row);
});

router.put('/pg-partner/merchants/:tenantId', async (req, res) => {
  if (!requirePgPartner(req, res)) return;
  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  if (body.cardNo || body.cardNumber || body.cvc) {
    res.status(400).json({ error: '카드번호는 받지 않습니다.' });
    return;
  }
  const tenantId = String(req.params.tenantId);
  if (tenantId === PLATFORM_PG_AGENCY_ID) {
    try {
      await savePlatformAgencyFromPartner({
        sellerLoginId: typeof body.sellerLoginId === 'string' ? body.sellerLoginId : '',
        sellerPassword: typeof body.sellerPassword === 'string' ? body.sellerPassword : '',
        rail: body.rail === 'LINK' ? 'LINK' : body.rail === 'KEYIN' ? 'KEYIN' : '',
        apiKey: typeof body.apiKey === 'string' ? body.apiKey : '',
        tid: typeof body.tid === 'string' ? body.tid : '',
        mid: typeof body.mid === 'string' ? body.mid : '',
        oid: typeof body.oid === 'string' ? body.oid : '',
      });
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : '대리점 정보를 저장하지 못했습니다.' });
    }
    return;
  }
  const merchant = await getPartnerMerchant(tenantId);
  if (!merchant) {
    res.status(404).json({ error: '업체를 찾을 수 없습니다.' });
    return;
  }
  const rail = body.rail === 'LINK' ? 'LINK' : body.rail === 'KEYIN' ? 'KEYIN' : '';
  if (!rail) {
    res.status(400).json({ error: '수기 또는 인증 중 어느 쪽인지 선택해 주세요.' });
    return;
  }
  try {
    const saved = await updateCredentialFromPartner({
      tenantId,
      rail,
      apiKey: typeof body.apiKey === 'string' ? body.apiKey : '',
      tid: typeof body.tid === 'string' ? body.tid : '',
      mid: typeof body.mid === 'string' ? body.mid : '',
      oid: typeof body.oid === 'string' ? body.oid : '',
    });
    const sellerLoginId = typeof body.sellerLoginId === 'string' ? body.sellerLoginId.trim() : '';
    const sellerPassword = typeof body.sellerPassword === 'string' ? body.sellerPassword : '';
    if (sellerLoginId && sellerPassword.trim()) {
      await saveSellerCenterLogin(tenantId, sellerLoginId, sellerPassword);
    } else if (sellerLoginId) {
      await saveSellerCenterLoginId(tenantId, sellerLoginId);
    }
    res.json({ ok: true, rail, mid: saved.connected ? saved.mid : null, oid: saved.connected ? saved.oid : null, apiKeyLast4: saved.connected ? saved.apiKeyLast4 : null });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : '가맹 정보를 저장하지 못했습니다.' });
  }
});

router.post('/pg-partner/merchants/:tenantId/reveal', async (req, res) => {
  if (!requirePgPartner(req, res)) return;
  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  const password = typeof body.password === 'string' ? body.password : '';
  const rail = body.rail === 'LINK' ? 'LINK' : body.rail === 'KEYIN' ? 'KEYIN' : '';
  if (!rail) {
    res.status(400).json({ error: '수기 또는 인증을 선택해 주세요.' });
    return;
  }
  if (!(await partnerRevealAllowed(readPgPartnerLoginId(req), password))) {
    res.status(401).json({ error: '비밀번호가 맞지 않습니다.' });
    return;
  }
  const tenantId = String(req.params.tenantId);
  if (tenantId === PLATFORM_PG_AGENCY_ID) {
    res.json(await readPlatformAgencySecrets(rail));
    return;
  }
  const merchant = await getPartnerMerchant(tenantId);
  if (!merchant) {
    res.status(404).json({ error: '업체를 찾을 수 없습니다.' });
    return;
  }
  const secrets = await readCredentialSecrets(tenantId, rail);
  const seller = await readSellerCenterLogin(tenantId);
  res.json({ apiKey: secrets.apiKey, tid: secrets.tid, sellerPassword: seller.password });
});

router.post('/pg-partner/applications/:id/connect', async (req, res) => {
  if (!requirePgPartner(req, res)) return;
  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  if (body.cardNo || body.cardNumber || body.cvc) {
    res.status(400).json({ error: '카드번호는 받지 않습니다.' });
    return;
  }
  const tenantId = await tenantIdForSubmittedOnboarding(String(req.params.id));
  if (!tenantId) {
    res.status(404).json({ error: 'PG 신청을 찾을 수 없습니다.' });
    return;
  }
  const railOf = (value: unknown) => {
    const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    return {
      mid: typeof row.mid === 'string' ? row.mid : '',
      oid: typeof row.oid === 'string' ? row.oid : '',
      tid: typeof row.tid === 'string' ? row.tid : '',
      apiKey: typeof row.apiKey === 'string' ? row.apiKey : '',
    };
  };
  try {
    await connectPartnerRails(tenantId, {
      sellerLoginId: typeof body.sellerLoginId === 'string' ? body.sellerLoginId : '',
      sellerPassword: typeof body.sellerPassword === 'string' ? body.sellerPassword : '',
      keyin: railOf(body.keyin),
      link: railOf(body.link),
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : '연동하지 못했습니다.' });
  }
});

router.get('/pg-partner/payments', async (req, res) => {
  if (!requirePgPartner(req, res)) return;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  res.json(await listPartnerPayments({ status, limit, offset }));
});

router.get('/pg-partner/notify-emails', async (req, res) => {
  if (!requirePgPartner(req, res)) return;
  res.json({ emails: await getPgApplicationNotifyEmails() });
});

router.put('/pg-partner/notify-emails', async (req, res) => {
  if (!requirePgPartner(req, res)) return;
  const body = req.body && typeof req.body === 'object' ? (req.body as { emails?: unknown }) : {};
  try {
    const emails = await savePgApplicationNotifyEmails(body.emails);
    res.json({ emails });
  } catch (e) {
    const message = e instanceof Error ? e.message : '알림 메일을 저장하지 못했습니다.';
    res.status(400).json({ error: message });
  }
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
    const saved = await saveCredentialFromPlatform({
      tenantId,
      rail: apiKey.startsWith('ssp-') ? 'KEYIN' : 'LINK',
      apiKey,
      tid,
      mid,
      oid,
    });
    const sellerLoginId = typeof body.sellerLoginId === 'string' ? body.sellerLoginId : '';
    const sellerPassword = typeof body.sellerPassword === 'string' ? body.sellerPassword : '';
    await saveSellerCenterLogin(tenantId, sellerLoginId, sellerPassword);
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
      rail: apiKey.startsWith('ssp-') ? 'KEYIN' : 'LINK',
      apiKey,
      tid,
      mid,
      oid,
    });
    const sellerLoginId = typeof body.sellerLoginId === 'string' ? body.sellerLoginId : '';
    const sellerPassword = typeof body.sellerPassword === 'string' ? body.sellerPassword : '';
    await saveSellerCenterLogin(row.tenantId, sellerLoginId, sellerPassword);
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
