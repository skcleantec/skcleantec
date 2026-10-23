import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { encryptTenantSecret } from '../../lib/tenantSecretCrypto.js';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import { pullSkHomepageMail, testSkHomepageMailbox } from './skHomepageMail.pull.js';
import { requireSkCleantecTenantId } from './skHomepageMail.tenant.js';

const router = Router();

router.use(authMiddleware, requireStaffPermission('admin.companyProfile'));

async function skTenantOrReject(res: import('express').Response, tenantId: string): Promise<boolean> {
  if (await requireSkCleantecTenantId(tenantId)) return true;
  res.status(403).json({ error: '이 업체에서는 쓰지 않습니다.' });
  return false;
}

function mailboxOk(value: string): boolean {
  return /^[^@\s]+@naver\.com$/i.test(value);
}

router.get('/', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId || !(await skTenantOrReject(res, tenantId))) return;
  const inbox = await prisma.skHomepageMailInbox.findFirst({ where: { tenantId } });
  const recent = inbox
    ? await prisma.skHomepageInquiryMail.findMany({
        where: { tenantId },
        orderBy: { receivedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          fromAddress: true,
          subject: true,
          receivedAt: true,
          status: true,
          textBody: true,
          inquiry: { select: { inquiryNumber: true } },
        },
      })
    : [];
  const pendingCount = inbox
    ? await prisma.skHomepageInquiryMail.count({ where: { tenantId, status: 'PENDING_MATCH' } })
    : 0;
  const matchedCount = inbox
    ? await prisma.skHomepageInquiryMail.count({ where: { tenantId, status: 'MATCHED' } })
    : 0;
  res.json({
    enabled: inbox?.enabled ?? false,
    mailbox: inbox?.mailbox ?? '',
    passwordSet: Boolean(inbox?.passwordEnc),
    lastSyncAt: inbox?.lastSyncAt?.toISOString() ?? null,
    lastError: inbox?.lastError ?? null,
    pendingCount,
    matchedCount,
    recent: recent.map((row) => ({
      id: row.id,
      fromAddress: row.fromAddress,
      subject: row.subject,
      receivedAt: row.receivedAt.toISOString(),
      status: row.status,
      inquiryNumber: row.inquiry?.inquiryNumber ?? null,
      excerpt: row.textBody.slice(0, 400),
    })),
  });
});

router.put('/', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId || !(await skTenantOrReject(res, tenantId))) return;
  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  const mailbox = typeof body.mailbox === 'string' ? body.mailbox.trim().toLowerCase() : '';
  const enabled = body.enabled === true;
  const password = typeof body.password === 'string' ? body.password.trim() : '';
  if (!mailboxOk(mailbox)) {
    res.status(400).json({ error: '네이버 메일 주소(@naver.com)를 적어 주세요.' });
    return;
  }
  const existing = await prisma.skHomepageMailInbox.findFirst({ where: { tenantId } });
  if (!password && !existing?.passwordEnc) {
    res.status(400).json({ error: '애플리케이션 비밀번호를 적어 주세요.' });
    return;
  }
  if (password) {
    const tested = await testSkHomepageMailbox(mailbox, password);
    if (!tested.ok) {
      res.status(400).json({ error: tested.error });
      return;
    }
  }
  const data = {
    mailbox,
    enabled,
    ...(password ? { passwordEnc: encryptTenantSecret(password), lastError: null } : {}),
  };
  if (existing) {
    await prisma.skHomepageMailInbox.update({ where: { id: existing.id }, data });
  } else {
    await prisma.skHomepageMailInbox.create({
      data: { tenantId, ...data, passwordEnc: encryptTenantSecret(password) },
    });
  }
  res.json({ ok: true });
});

router.post('/pull', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId || !(await skTenantOrReject(res, tenantId))) return;
  try {
    const result = await pullSkHomepageMail(tenantId);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : '메일을 가져오지 못했습니다.' });
  }
});

export default router;
