import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffAdminAccess } from '../auth/staffAdmin.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { createdAtRangeFromListQuery } from '../ops-analytics/kstHourListFilter.js';
import {
  mapInquiryTrashListMeta,
  purgeInquiryFromTrashNow,
  restoreInquiryFromTrash,
} from './inquiryTrash.service.js';
import { withTrashedInquiryScope } from './inquiryTrash.helpers.js';
import { inquiryTrashRetentionDays } from '../../lib/inquiryTrashRetention.js';
import { prisma } from '../../lib/prisma.js';

const router = Router();

async function verifyStaffPasswordForRequest(
  req: Request,
  res: Response,
  passwordRaw: unknown,
): Promise<boolean> {
  const password = passwordRaw != null ? String(passwordRaw) : '';
  if (!password) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return false;
  }
  const user = (req as unknown as { user: AuthPayload }).user;
  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!dbUser) {
    res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    return false;
  }
  const valid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!valid) {
    res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    return false;
  }
  return true;
}

type TrashRowSelect = {
  id: string;
  customerName: string;
  inquiryNumber: string | null;
  customerPhone: string;
  address: string;
  status: string;
  deletedAt: Date | null;
  deletedBy: { id: string; name: string } | null;
};

function mapTrashRow(row: TrashRowSelect) {
  if (!row.deletedAt) return null;
  const meta = mapInquiryTrashListMeta(row.deletedAt);
  return {
    id: row.id,
    customerName: row.customerName,
    inquiryNumber: row.inquiryNumber,
    customerPhone: row.customerPhone,
    address: row.address,
    status: row.status,
    deletedAt: row.deletedAt.toISOString(),
    deletedBy: row.deletedBy ? { id: row.deletedBy.id, name: row.deletedBy.name } : null,
    purgeAt: meta.purgeAt,
    daysRemaining: meta.daysRemaining,
    retentionDays: meta.retentionDays,
  };
}

/** GET — 휴지통 목록 (관리자 전용) */
router.get('/', requireStaffAdminAccess, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const {
    limit = '30',
    offset = '0',
    search,
    datePreset,
    month,
    day,
    fromYmd,
    toYmd,
  } = req.query;
  const limitN = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 30));
  const offsetN = Math.max(0, parseInt(String(offset), 10) || 0);

  const range = createdAtRangeFromListQuery({
    datePreset: typeof datePreset === 'string' ? datePreset : undefined,
    month: typeof month === 'string' ? month : undefined,
    day: typeof day === 'string' ? day : undefined,
    fromYmd: typeof fromYmd === 'string' ? fromYmd : undefined,
    toYmd: typeof toYmd === 'string' ? toYmd : undefined,
  });

  const andClauses: Prisma.InquiryWhereInput[] = [withTrashedInquiryScope(tenantId)];
  if (range) {
    andClauses.push({ deletedAt: { gte: range.gte, lte: range.lte } });
  }
  if (search && typeof search === 'string' && search.trim()) {
    const s = search.trim();
    andClauses.push({
      OR: [
        { customerName: { contains: s } },
        { customerPhone: { contains: s } },
        { inquiryNumber: { contains: s } },
      ],
    });
  }
  const where: Prisma.InquiryWhereInput =
    andClauses.length === 1 ? andClauses[0]! : { AND: andClauses };

  const [rows, total] = await Promise.all([
    prisma.inquiry.findMany({
      where,
      orderBy: { deletedAt: 'desc' },
      take: limitN,
      skip: offsetN,
      select: {
        id: true,
        customerName: true,
        inquiryNumber: true,
        customerPhone: true,
        address: true,
        status: true,
        deletedAt: true,
        deletedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.inquiry.count({ where }),
  ]);

  res.json({
    items: rows.map((r) => mapTrashRow(r)).filter(Boolean),
    total,
    retentionDays: inquiryTrashRetentionDays(),
  });
});

/** GET — 휴지통 상세 (관리자 전용) */
router.get('/:id', requireStaffAdminAccess, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const row = await prisma.inquiry.findFirst({
    where: withTrashedInquiryScope(tenantId, { id: req.params.id }),
    select: {
      id: true,
      customerName: true,
      inquiryNumber: true,
      customerPhone: true,
      customerPhone2: true,
      address: true,
      addressDetail: true,
      status: true,
      preferredDate: true,
      deletedAt: true,
      deletedBy: { select: { id: true, name: true } },
      orderFormId: true,
    },
  });
  if (!row?.deletedAt) {
    res.status(404).json({ error: '휴지통에서 접수를 찾을 수 없습니다.' });
    return;
  }
  const mapped = mapTrashRow({ ...row, deletedAt: row.deletedAt });
  res.json({
    ...mapped,
    customerPhone2: row.customerPhone2,
    addressDetail: row.addressDetail,
    preferredDate: row.preferredDate?.toISOString().slice(0, 10) ?? null,
    orderFormId: row.orderFormId,
  });
});

/** POST — 복구 (관리자 전용 + 비밀번호) */
router.post('/:id/restore', requireStaffAdminAccess, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const body = req.body as { password?: unknown };
  if (!(await verifyStaffPasswordForRequest(req, res, body.password))) return;
  try {
    await restoreInquiryFromTrash(tenantId, req.params.id, user.userId ?? null);
    res.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === 'NOT_FOUND') {
      res.status(404).json({ error: '휴지통에서 접수를 찾을 수 없습니다.' });
      return;
    }
    console.error('[inquiry-trash restore]', e);
    res.status(500).json({ error: '복구에 실패했습니다.' });
  }
});

/** POST — 즉시 영구 삭제 (관리자 전용 + 비밀번호) */
router.post('/:id/purge', requireStaffAdminAccess, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const body = req.body as { password?: unknown };
  if (!(await verifyStaffPasswordForRequest(req, res, body.password))) return;
  try {
    await purgeInquiryFromTrashNow(tenantId, req.params.id, user.userId ?? null);
    res.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === 'NOT_FOUND') {
      res.status(404).json({ error: '휴지통에서 접수를 찾을 수 없습니다.' });
      return;
    }
    console.error('[inquiry-trash purge]', e);
    res.status(500).json({ error: '영구 삭제에 실패했습니다.' });
  }
});

export default router;
