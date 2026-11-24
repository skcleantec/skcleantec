import { Router, type Request } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { userHasStaffAdminAccess } from '../auth/staffAdminAccess.service.js';
import { kstDayRangeYmd, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import { bankDepositFeatureDisabledBody } from './bankDepositGuard.js';
import { readBankDepositSettings, saveBankDepositSettings } from './bankDepositSettings.service.js';
import { applyOpenSettings } from './bankDepositTeam.service.js';
import { DEPOSIT_KINDS, type DepositKind } from './bankDepositMatch.js';
import {
  createBankAccount,
  bankDepositSummary,
  createDeviceLinkCode,
  createManualBankDeposit,
  deleteBankAccount,
  deleteBankDeposit,
  depositCandidates,
  depositsForInquiries,
  depositsForInquiry,
  searchDepositTargets,
  ignoreBankDeposit,
  ingestBankDeposits,
  linkBankDeposit,
  listBankAccounts,
  listBankDeposits,
  listBankDevices,
  listUnparsedBankDeposits,
  registerBankDevice,
  reportBankDepositScan,
  requestBankDepositRescan,
  resolveUnparsedBankDeposit,
  revokeBankDevice,
  touchBankDevice,
  unlinkBankDeposit,
  updateBankAccount,
} from './bankDeposit.service.js';

const STATUSES = ['AUTO_LINKED', 'NEEDS_REVIEW', 'LINKED', 'IGNORED'];

function userOf(req: Request): AuthPayload | undefined {
  return (req as Request & { user?: AuthPayload }).user;
}

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function featureOff(res: { status: (code: number) => { json: (body: object) => void } }): void {
  res.status(403).json(bankDepositFeatureDisabledBody());
}

function bearer(req: Request): string {
  const header = req.headers.authorization ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? '';
}

function dayRange(query: Request['query']): { gte: Date; lte: Date } | null {
  const date = typeof query.date === 'string' ? query.date : '';
  const from = typeof query.from === 'string' ? query.from : '';
  const to = typeof query.to === 'string' ? query.to : '';
  if (date) return kstDayRangeYmd(date);
  if (from || to) {
    const start = kstDayRangeYmd(from || to);
    const end = kstDayRangeYmd(to || from);
    if (!start || !end) return null;
    return { gte: start.gte, lte: end.lte };
  }
  return kstDayRangeYmd(kstTodayYmd());
}

export const bankDepositDeviceRouter = Router();

bankDepositDeviceRouter.post('/devices/register', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const code = clip(body.code, 6);
  const deviceName = clip(body.deviceName, 80);
  if (!/^\d{6}$/.test(code) || !deviceName) {
    res.status(400).json({ error: '연결 코드와 기기 이름이 필요해요.' });
    return;
  }
  const created = await registerBankDevice(prisma, {
    code,
    deviceName,
    appVersion: clip(body.appVersion, 40) || null,
  });
  if ('error' in created) {
    if (created.error === 'disabled') {
      featureOff(res);
      return;
    }
    res.status(400).json({ error: created.error });
    return;
  }
  res.status(201).json(created);
});

bankDepositDeviceRouter.post('/ingest', async (req, res) => {
  const token = bearer(req);
  if (!token) {
    res.status(401).json({ error: '기기 연결이 필요해요.' });
    return;
  }
  const body = (req.body ?? {}) as { items?: unknown };
  if (!Array.isArray(body.items) || body.items.length > 50) {
    res.status(400).json({ error: '한 번에 50건까지 보낼 수 있어요.' });
    return;
  }
  const items = body.items.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      dedupeKey: typeof row.dedupeKey === 'string' ? row.dedupeKey : '',
      text: typeof row.text === 'string' ? row.text : '',
      receivedAt: typeof row.receivedAt === 'string' ? row.receivedAt : '',
      contentHash: typeof row.contentHash === 'string' ? row.contentHash : null,
      source: typeof row.source === 'string' ? row.source : null,
    };
  });
  const outcome = await ingestBankDeposits(prisma, token, items);
  if ('error' in outcome) {
    if (outcome.error === 'disabled') {
      featureOff(res);
      return;
    }
    res.status(outcome.error === 'rate' ? 429 : 401).json({
      error: outcome.error === 'rate' ? '잠시 뒤 다시 보내 주세요.' : '기기 연결이 끊어졌어요.',
    });
    return;
  }
  res.json(outcome);
});

bankDepositDeviceRouter.post('/scan-report', async (req, res) => {
  const token = bearer(req);
  if (!token) {
    res.status(401).json({ error: '기기 연결이 필요해요.' });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const scanned = typeof body.scanned === 'number' ? body.scanned : Number.NaN;
  const found = typeof body.found === 'number' ? body.found : Number.NaN;
  const reported = await reportBankDepositScan(prisma, token, { scanned, found });
  if ('error' in reported) {
    if (reported.error === 'disabled') {
      featureOff(res);
      return;
    }
    res.status(reported.error === 'bad' ? 400 : 401).json({
      error: reported.error === 'bad' ? '점검 건수를 숫자로 보내 주세요.' : '기기 연결이 끊어졌어요.',
    });
    return;
  }
  res.json(reported);
});

bankDepositDeviceRouter.post('/heartbeat', async (req, res) => {
  const token = bearer(req);
  const touched = token ? await touchBankDevice(prisma, token) : null;
  if (touched && 'error' in touched) {
    featureOff(res);
    return;
  }
  if (!touched) {
    res.status(401).json({ error: '기기 연결이 끊어졌어요.' });
    return;
  }
  res.json(touched);
});

export const bankDepositRouter = Router();
bankDepositRouter.use(authMiddleware);
bankDepositRouter.use(async (req, res, next) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  if (!(await isFeatureEnabled(tenantId, 'mod_bank_deposit'))) {
    featureOff(res);
    return;
  }
  next();
});

bankDepositRouter.post('/devices/link-code', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  const user = userOf(req);
  if (!(await userHasStaffAdminAccess(user))) {
    res.status(403).json({ error: '기기 연결은 관리자만 할 수 있어요.' });
    return;
  }
  const created = await createDeviceLinkCode(prisma, tenantId, user!.userId);
  if ('error' in created) {
    res.status(503).json({ error: created.error });
    return;
  }
  res.status(201).json(created);
});

bankDepositRouter.get('/devices', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  if (!(await userHasStaffAdminAccess(userOf(req)))) {
    res.status(403).json({ error: '기기 목록은 관리자만 볼 수 있어요.' });
    return;
  }
  res.json({ items: await listBankDevices(prisma, tenantId) });
});

bankDepositRouter.delete('/devices/:id', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  if (!(await userHasStaffAdminAccess(userOf(req)))) {
    res.status(403).json({ error: '기기 연결을 끊을 권한이 없어요.' });
    return;
  }
  const ok = await revokeBankDevice(prisma, tenantId, req.params.id);
  if (!ok) {
    res.status(404).json({ error: '기기를 찾지 못했어요.' });
    return;
  }
  res.json({ ok: true });
});

bankDepositRouter.get('/accounts', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  if (!(await userHasStaffAdminAccess(userOf(req)))) {
    res.status(403).json({ error: '계좌 설정은 관리자만 볼 수 있어요.' });
    return;
  }
  res.json({ items: await listBankAccounts(prisma, tenantId) });
});

bankDepositRouter.post('/accounts', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  if (!(await userHasStaffAdminAccess(userOf(req)))) {
    res.status(403).json({ error: '계좌 설정은 관리자만 할 수 있어요.' });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const operatingCompanyId = clip(body.operatingCompanyId, 80);
  const bankName = clip(body.bankName, 32) || '농협';
  const accountMask = clip(body.accountMask, 40);
  if (!operatingCompanyId || !accountMask) {
    res.status(400).json({ error: '브랜드와 계좌 표시가 필요해요.' });
    return;
  }
  const created = await createBankAccount(prisma, { tenantId, operatingCompanyId, bankName, accountMask });
  if ('error' in created) {
    res.status(400).json({ error: created.error });
    return;
  }
  res.status(201).json(created);
});

bankDepositRouter.patch('/accounts/:id', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  if (!(await userHasStaffAdminAccess(userOf(req)))) {
    res.status(403).json({ error: '계좌 설정은 관리자만 할 수 있어요.' });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const updated = await updateBankAccount(prisma, {
    tenantId,
    id: req.params.id,
    ...(typeof body.operatingCompanyId === 'string' ? { operatingCompanyId: clip(body.operatingCompanyId, 80) } : {}),
    ...(typeof body.bankName === 'string' ? { bankName: clip(body.bankName, 32) } : {}),
    ...(typeof body.accountMask === 'string' ? { accountMask: clip(body.accountMask, 40) } : {}),
    ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
  });
  if ('error' in updated) {
    res.status(updated.error === 'missing' ? 404 : 400).json({
      error: updated.error === 'missing' ? '계좌를 찾지 못했어요.' : updated.error,
    });
    return;
  }
  res.json({ ok: true });
});

bankDepositRouter.delete('/accounts/:id', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  if (!(await userHasStaffAdminAccess(userOf(req)))) {
    res.status(403).json({ error: '계좌 설정은 관리자만 할 수 있어요.' });
    return;
  }
  const ok = await deleteBankAccount(prisma, tenantId, req.params.id);
  if (!ok) {
    res.status(404).json({ error: '계좌를 찾지 못했어요.' });
    return;
  }
  res.json({ ok: true });
});

bankDepositRouter.get('/', requireStaffPermission('inquiry.view'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  const range = dayRange(req.query);
  if (!range) {
    res.status(400).json({ error: '날짜는 YYYY-MM-DD 로 보내 주세요.' });
    return;
  }
  const status = typeof req.query.status === 'string' ? req.query.status : null;
  if (status && !STATUSES.includes(status)) {
    res.status(400).json({ error: '상태 구분이 올바르지 않아요.' });
    return;
  }
  const limitRaw = Number.parseInt(String(req.query.limit ?? '50'), 10);
  const offsetRaw = Number.parseInt(String(req.query.offset ?? '0'), 10);
  const page = await listBankDeposits(prisma, {
    tenantId,
    range,
    status,
    operatingCompanyId: typeof req.query.operatingCompanyId === 'string' ? req.query.operatingCompanyId : null,
    q: typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 40) : null,
    limit: Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 50,
    offset: Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0,
  });
  res.json(page);
});

bankDepositRouter.post('/devices/:id/rescan', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  if (!(await userHasStaffAdminAccess(userOf(req)))) {
    res.status(403).json({ error: '다시 훑기는 관리자만 할 수 있어요.' });
    return;
  }
  const ok = await requestBankDepositRescan(prisma, tenantId, req.params.id);
  if (!ok) {
    res.status(404).json({ error: '기기를 찾지 못했어요.' });
    return;
  }
  res.json({ ok: true });
});

bankDepositRouter.get('/unparsed', requireStaffPermission('inquiry.view'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  res.json(await listUnparsedBankDeposits(prisma, tenantId));
});

bankDepositRouter.post('/unparsed/:id/resolve', requireStaffPermission('inquiry.edit.basic'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  const closed = await resolveUnparsedBankDeposit(prisma, tenantId, req.params.id);
  if ('error' in closed) {
    res.status(404).json({ error: '문자를 찾지 못했어요.' });
    return;
  }
  res.json({ ok: true });
});

bankDepositRouter.get('/settings', requireStaffPermission('inquiry.view'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  res.json({ settings: await readBankDepositSettings(prisma, tenantId) });
});

bankDepositRouter.put('/settings', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  if (!(await userHasStaffAdminAccess(userOf(req)))) {
    res.status(403).json({ error: '알림 설정은 관리자만 바꿀 수 있어요.' });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const saved = await saveBankDepositSettings(prisma, tenantId, body);
  if (!saved.ok) {
    res.status(400).json({ error: saved.error });
    return;
  }
  await applyOpenSettings(prisma, tenantId, saved.before);
  res.json({ settings: saved.settings });
});

bankDepositRouter.post('/manual', requireStaffPermission('inquiry.edit.basic'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  const user = userOf(req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const depositedAt = new Date(typeof body.depositedAt === 'string' ? body.depositedAt : '');
  const created = await createManualBankDeposit(prisma, {
    tenantId,
    userId: user!.userId,
    operatingCompanyId: clip(body.operatingCompanyId, 80) || null,
    amountWon: typeof body.amountWon === 'number' ? body.amountWon : Number.NaN,
    depositorName: typeof body.depositorName === 'string' ? body.depositorName : '',
    depositedAt,
    note: typeof body.note === 'string' ? clip(body.note, 200) || null : null,
    force: body.force === true,
  });
  if ('error' in created) {
    if (created.error === 'duplicate') {
      res.status(409).json({ error: '같은 시각·금액·이름의 입금이 이미 있어요.', existingId: created.existingId });
      return;
    }
    res.status(400).json({ error: created.error });
    return;
  }
  res.status(201).json({ id: created.id });
});

bankDepositRouter.get('/summary', requireStaffPermission('inquiry.view'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  res.json(await bankDepositSummary(prisma, tenantId));
});

bankDepositRouter.get('/by-inquiries', requireStaffPermission('inquiry.view'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  const raw = typeof req.query.ids === 'string' ? req.query.ids.split(',') : [];
  res.json(await depositsForInquiries(prisma, tenantId, raw));
});

bankDepositRouter.get('/by-inquiry/:inquiryId', requireStaffPermission('inquiry.view'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  const items = await depositsForInquiry(prisma, tenantId, req.params.inquiryId);
  res.json({ items });
});

bankDepositRouter.get('/:id/search', requireStaffPermission('inquiry.view'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const found = await searchDepositTargets(prisma, tenantId, req.params.id, q);
  if (!found) {
    res.status(404).json({ error: '입금을 찾지 못했어요.' });
    return;
  }
  res.json(found);
});

bankDepositRouter.get('/:id/candidates', requireStaffPermission('inquiry.view'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  const found = await depositCandidates(prisma, tenantId, req.params.id);
  if (!found) {
    res.status(404).json({ error: '입금을 찾지 못했어요.' });
    return;
  }
  res.json(found);
});

bankDepositRouter.post('/:id/link', requireStaffPermission('inquiry.edit.basic'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  const user = userOf(req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const inquiryId = clip(body.inquiryId, 80) || null;
  const followupId = clip(body.followupId, 80) || null;
  const kind = typeof body.kind === 'string' ? body.kind : '';
  if ((inquiryId ? 1 : 0) + (followupId ? 1 : 0) !== 1 || !DEPOSIT_KINDS.includes(kind as DepositKind)) {
    res.status(400).json({ error: '연결할 접수 또는 부재와 금액 종류가 필요해요.' });
    return;
  }
  const linked = await linkBankDeposit(prisma, {
    tenantId,
    id: req.params.id,
    userId: user!.userId,
    inquiryId,
    followupId,
    kind: kind as DepositKind,
  });
  if ('error' in linked) {
    res.status(linked.error === 'missing' ? 404 : 400).json({
      error: linked.error === 'missing' ? '입금을 찾지 못했어요.' : '이 업체에서 연결할 대상을 찾지 못했어요.',
    });
    return;
  }
  res.json({ ok: true });
});

bankDepositRouter.post('/:id/unlink', requireStaffPermission('inquiry.edit.basic'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  const updated = await unlinkBankDeposit(prisma, tenantId, req.params.id);
  if ('error' in updated) {
    res.status(404).json({ error: '입금을 찾지 못했어요.' });
    return;
  }
  res.json({ ok: true });
});

bankDepositRouter.delete('/:id', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  const user = userOf(req);
  if (!(await userHasStaffAdminAccess(user))) {
    res.status(403).json({ error: '입금 삭제는 관리자만 할 수 있어요.' });
    return;
  }
  const removed = await deleteBankDeposit(prisma, tenantId, req.params.id, user!.userId);
  if ('error' in removed) {
    res.status(404).json({ error: '입금을 찾지 못했어요.' });
    return;
  }
  res.json({ ok: true });
});

bankDepositRouter.post('/:id/ignore', requireStaffPermission('inquiry.edit.basic'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, userOf(req));
  if (!tenantId) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const note = 'note' in body ? clip(body.note, 200) || null : null;
  const updated = await ignoreBankDeposit(prisma, tenantId, req.params.id, note);
  if ('error' in updated) {
    res.status(404).json({ error: '입금을 찾지 못했어요.' });
    return;
  }
  res.json({ ok: true });
});
