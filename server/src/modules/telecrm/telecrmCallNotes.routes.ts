import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission, staffMarketerRoleOnly } from '../auth/marketerPermission.middleware.js';
import { requireTelecrmTenant } from './telecrm.helpers.js';

const router = Router();
router.use(authMiddleware, staffMarketerRoleOnly);

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 20);
}

router.get('/', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const phoneRaw = typeof req.query.phone === 'string' ? req.query.phone : '';
  const phone = normalizePhone(phoneRaw);
  if (phone.length < 4) {
    res.status(400).json({ error: '전화번호(4자 이상)가 필요합니다.' });
    return;
  }
  const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 30;
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 30;
  const rows = await prisma.telecrmCallNote.findMany({
    where: { tenantId, userId: user.userId, phone },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      phone: true,
      body: true,
      inquiryId: true,
      createdAt: true,
    },
  });
  res.json({
    items: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

router.post('/', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const { phone: phoneRaw, body, inquiryId } = req.body as {
    phone?: string;
    body?: string;
    inquiryId?: string | null;
  };
  const phone = normalizePhone(typeof phoneRaw === 'string' ? phoneRaw : '');
  const text = typeof body === 'string' ? body.trim().slice(0, 4000) : '';
  if (phone.length < 4) {
    res.status(400).json({ error: '전화번호(4자 이상)가 필요합니다.' });
    return;
  }
  if (!text) {
    res.status(400).json({ error: '통화 메모 내용이 필요합니다.' });
    return;
  }
  const inqId = typeof inquiryId === 'string' && inquiryId.trim() ? inquiryId.trim() : null;
  if (inqId) {
    const inquiry = await prisma.inquiry.findFirst({ where: { id: inqId, tenantId }, select: { id: true } });
    if (!inquiry) {
      res.status(404).json({ error: '접수를 찾을 수 없습니다.' });
      return;
    }
  }
  const row = await prisma.telecrmCallNote.create({
    data: {
      tenantId,
      userId: user.userId,
      phone,
      body: text,
      inquiryId: inqId,
    },
  });
  res.status(201).json({
    id: row.id,
    phone: row.phone,
    body: row.body,
    inquiryId: row.inquiryId,
    createdAt: row.createdAt.toISOString(),
  });
});

export const telecrmCallNotesRouter = router;
