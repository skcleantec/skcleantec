import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireStaffPermissionByMethod } from '../auth/marketerPermission.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import {
  createdAtRangeFromQuery,
  preferredMoveInYmdRangeFromQuery,
} from '../inquiries/inquiryListDateRange.js';
import {
  createdAtRangeFromListQuery,
  parseKstHourQuery,
} from '../ops-analytics/kstHourListFilter.js';
import { orderFollowupIdsMatchingKstHour } from '../ops-analytics/kstHourFilterQueries.js';
import {
  appendFollowupLog,
  FOLLOWUP_INCLUDE,
  parseStatus,
  serializeFollowup,
  serializeLog,
} from './orderFollowups.service.js';
import { canAdminOrMarketerViewInquiry } from '../inquiry-cleaning-photos/inquiryCleaningPhotos.access.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { allocateNextInquiryNumber } from '../inquiries/inquiryNumber.js';
import { tenantIdForUserId } from '../tenants/tenant.service.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import {
  resolveInquiryOperatingCompanyId,
  mapOperatingCompanyResolveError,
} from '../operating-companies/operatingCompanyResolve.service.js';
import { userHasStaffAdminAccess } from '../auth/staffAdminAccess.service.js';
import type { UserRole } from '@prisma/client';
import { readCrmWorkBrandInput, resolveCrmWorkOperatingCompanyId } from '../telecrm/crmWorkBrandResolve.service.js';

const router = Router();

/** 부재현황이 입금 완료(RESERVED)일 때, 연결 접수가 입금대기면 접수 목록용 입금완료(DEPOSIT_COMPLETED)로 맞춤 */
async function syncInquiryWhenFollowupDepositComplete(inquiryId: string, tenantId: string): Promise<void> {
  const updated = await prisma.inquiry.updateMany({
    where: { id: inquiryId, tenantId, status: 'DEPOSIT_PENDING' },
    data: { status: 'DEPOSIT_COMPLETED' },
  });
  if (updated.count === 0) return;
  const assigns = await prisma.assignment.findMany({
    where: { inquiryId, tenantId },
    select: { teamLeaderId: true },
  });
  if (assigns.length > 0) {
    notifyInboxRefresh([...new Set(assigns.map((a) => a.teamLeaderId))]);
  }
}

/** 부재현황이 예약금 대기(DEPOSIT_PENDING)일 때, 연결 접수를 접수 목록 입금대기로 맞춤(접수번호 없으면 발급) */
async function syncInquiryWhenFollowupDepositPending(inquiryId: string, tenantId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const inv = await tx.inquiry.findFirst({
      where: { id: inquiryId, tenantId },
      select: { status: true, inquiryNumber: true, tenantId: true, operatingCompanyId: true },
    });
    if (!inv || inv.status === 'CANCELLED') return;
    if (
      inv.status === 'DEPOSIT_COMPLETED' ||
      inv.status === 'ORDER_FORM_PENDING' ||
      inv.status === 'ASSIGNED' ||
      inv.status === 'IN_PROGRESS' ||
      inv.status === 'COMPLETED' ||
      inv.status === 'CS_PROCESSING'
    ) {
      return;
    }
    const data: import('@prisma/client').Prisma.InquiryUpdateInput = {
      status: 'DEPOSIT_PENDING',
    };
    if (inv.inquiryNumber == null) {
      data.inquiryNumber = await allocateNextInquiryNumber(tx, inv.tenantId, inv.operatingCompanyId);
    }
    await tx.inquiry.update({ where: { id: inquiryId }, data });
  });
}
router.use(authMiddleware);
router.use(requireStaffPermissionByMethod(['followup.view'], ['followup.edit']));

function parseNextContact(raw: unknown): Date | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string') return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** 입주청소 희망일 YYYY-MM-DD — 잘못된 값이면 `INVALID` */
function parsePreferredMoveInCleaningDate(raw: unknown): string | null | 'INVALID' {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw !== 'string') return 'INVALID';
  const s = raw.trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'INVALID';
  const [ys, ms, ds] = s.split('-').map(Number);
  const dt = new Date(ys, ms - 1, ds);
  if (dt.getFullYear() !== ys || dt.getMonth() !== ms - 1 || dt.getDate() !== ds) return 'INVALID';
  return s;
}

type DepositFlowStatus = 'DEPOSIT_PENDING' | 'RESERVED';

/** 부재현황 입금 흐름 상태일 때 접수를 자동 생성해 연결용 inquiryId를 돌려준다. */
async function createInquiryForDepositFlow(params: {
  actorId: string;
  customerName: string;
  nickname: string | null;
  customerPhone: string;
  memo: string | null;
  followupStatus: DepositFlowStatus;
}): Promise<string> {
  const tenantId = await tenantIdForUserId(params.actorId);
  if (!tenantId) {
    throw new Error('접수 생성에 필요한 업체 정보를 찾을 수 없습니다.');
  }
  return prisma.$transaction(async (tx) => {
    const actor = await tx.user.findFirst({
      where: { id: params.actorId, tenantId },
      select: { role: true },
    });
    const operatingCompanyId = await resolveInquiryOperatingCompanyId({
      tx,
      tenantId,
      userId: params.actorId,
      userRole: actor?.role,
    });
    const inquiryStatus =
      params.followupStatus === 'DEPOSIT_PENDING' ? 'DEPOSIT_PENDING' : 'DEPOSIT_COMPLETED';
    const inquiryNumber =
      inquiryStatus === 'DEPOSIT_PENDING'
        ? await allocateNextInquiryNumber(tx, tenantId, operatingCompanyId)
        : null;
    const created = await tx.inquiry.create({
      data: {
        tenantId,
        operatingCompanyId,
        inquiryNumber,
        createdById: params.actorId,
        customerName: params.customerName,
        nickname: params.nickname,
        customerPhone: params.customerPhone,
        customerPhone2: null,
        address: '',
        addressDetail: null,
        preferredDate: null,
        preferredTime: null,
        preferredTimeDetail: null,
        memo: params.memo,
        source: '전화',
        status: inquiryStatus,
      },
      select: { id: true },
    });
    return created.id;
  });
}

router.get('/', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const includeFulfilled = req.query.includeFulfilled === '1' || req.query.includeFulfilled === 'true';
  const statusFilter = parseStatus(req.query.status);
  const customerName =
    typeof req.query.customerName === 'string' ? req.query.customerName.trim() : '';
  const inquiryIdFilter =
    typeof req.query.inquiryId === 'string' ? req.query.inquiryId.trim() : '';
  const missingInquiryLink =
    req.query.missingInquiryLink === '1' || req.query.missingInquiryLink === 'true';
  const opsDrill = req.query.opsDrill === '1' || req.query.opsDrill === 'true';
  if (inquiryIdFilter && missingInquiryLink) {
    res.status(400).json({ error: 'inquiryId와 missingInquiryLink는 함께 사용할 수 없습니다.' });
    return;
  }
  if (missingInquiryLink && customerName.length < 2) {
    res.status(400).json({ error: '고객명을 두 글자 이상 입력해 주세요.' });
    return;
  }
  if (inquiryIdFilter) {
    const ok = await canAdminOrMarketerViewInquiry(user, inquiryIdFilter);
    if (!ok) {
      res.status(403).json({ error: '해당 접수의 부재현황을 조회할 권한이 없습니다.' });
      return;
    }
  }
  const where: import('@prisma/client').Prisma.OrderFollowupWhereInput = { tenantId };
  /** 부재·보류 화면은 항상 부재/보류 상태만 조회한다. (대시보드 drill-down은 opsDrill로 예외) */
  const absHoldOnly: import('@prisma/client').Prisma.OrderFollowupWhereInput = {
    status: { in: ['REQUESTED', 'ABSENT', 'ON_HOLD'] },
  };
  if (opsDrill && statusFilter) {
    where.status = statusFilter;
  } else {
    where.AND = [absHoldOnly];
  }
  if (inquiryIdFilter) {
    where.inquiryId = inquiryIdFilter;
  }
  if (missingInquiryLink) {
    where.inquiryId = null;
  }
  if (statusFilter && !opsDrill) {
    where.status = statusFilter;
  } else if (!opsDrill) {
    /** 부재·보류 화면 기본: 완료만 제외(부재/보류 안에서) */
    const listExtraAnd: import('@prisma/client').Prisma.OrderFollowupWhereInput[] = [];
    if (!includeFulfilled) {
      listExtraAnd.push({ NOT: { status: 'FULFILLED' } });
    }
    const prevAnd = where.AND
      ? Array.isArray(where.AND)
        ? where.AND
        : [where.AND]
      : [];
    where.AND = [...prevAnd, ...listExtraAnd];
  }
  const preferredYmdRange = missingInquiryLink
    ? null
    : preferredMoveInYmdRangeFromQuery({
        preferredDatePreset:
          typeof req.query.preferredDatePreset === 'string'
            ? req.query.preferredDatePreset
            : undefined,
        preferredMonth:
          typeof req.query.preferredMonth === 'string' ? req.query.preferredMonth : undefined,
        preferredDay: typeof req.query.preferredDay === 'string' ? req.query.preferredDay : undefined,
      });
  const dateRange =
    missingInquiryLink || preferredYmdRange
      ? null
      : createdAtRangeFromListQuery({
          datePreset: typeof req.query.datePreset === 'string' ? req.query.datePreset : undefined,
          month: typeof req.query.month === 'string' ? req.query.month : undefined,
          day: typeof req.query.day === 'string' ? req.query.day : undefined,
          fromYmd: typeof req.query.fromYmd === 'string' ? req.query.fromYmd : undefined,
          toYmd: typeof req.query.toYmd === 'string' ? req.query.toYmd : undefined,
        });
  const kstHour = parseKstHourQuery(req.query.kstHour);
  if (dateRange) {
    where.createdAt = { gte: dateRange.gte, lte: dateRange.lte };
  }
  if (kstHour !== undefined && dateRange && !missingInquiryLink) {
    const followupStatusForHour =
      statusFilter && typeof statusFilter === 'string' ? statusFilter : undefined;
    const matchedIds = await orderFollowupIdsMatchingKstHour({
      tenantId,
      gte: dateRange.gte,
      lte: dateRange.lte,
      kstHour,
      status: followupStatusForHour,
    });
    where.id = {
      in: matchedIds.length > 0 ? matchedIds : ['00000000-0000-0000-0000-000000000000'],
    };
  }
  if (preferredYmdRange) {
    where.preferredMoveInCleaningDate = { gte: preferredYmdRange.gte, lte: preferredYmdRange.lte };
  }
  if (customerName) {
    where.customerName = { contains: customerName, mode: 'insensitive' };
  }
  const goldDbOnlyRaw = req.query.goldDbOnly;
  const goldDbOnly =
    goldDbOnlyRaw === '1' || goldDbOnlyRaw === 'true' || goldDbOnlyRaw === 'yes';
  if (goldDbOnly) {
    where.goldDb = true;
  }
  if (missingInquiryLink) {
    const rows = await prisma.orderFollowup.findMany({
      where,
      include: FOLLOWUP_INCLUDE,
      orderBy: [{ createdAt: 'desc' }],
      take: 40,
    });
    res.json({ items: rows.map((r) => serializeFollowup(r)), total: rows.length });
    return;
  }

  const parsedLimit = Number.parseInt(String(req.query.limit ?? '30'), 10);
  const parsedOffset = Number.parseInt(String(req.query.offset ?? '0'), 10);
  const take = Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, parsedLimit)) : 30;
  const skip = Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : 0;

  const [total, rows] = await Promise.all([
    prisma.orderFollowup.count({ where }),
    prisma.orderFollowup.findMany({
      where,
      include: FOLLOWUP_INCLUDE,
      orderBy: [{ createdAt: 'desc' }],
      take,
      skip,
    }),
  ]);
  res.json({ items: rows.map((r) => serializeFollowup(r)), total });
});

router.get('/:id/logs', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { id } = req.params;
  const exists = await prisma.orderFollowup.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!exists) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }
  const logs = await prisma.orderFollowupLog.findMany({
    where: { followupId: id },
    include: { actor: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json({ items: logs.map(serializeLog) });
});

router.post('/', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const body = req.body as Record<string, unknown>;
  const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() || null : null;
  const customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '';
  if (!customerName) {
    res.status(400).json({ error: '고객명은 필수입니다.' });
    return;
  }
  const status = parseStatus(body.status) ?? 'ABSENT';
  const memo = typeof body.memo === 'string' ? body.memo.trim() || null : null;
  const nextContactAt = parseNextContact(body.nextContactAt);
  const goldDb = typeof body.goldDb === 'boolean' ? body.goldDb : false;
  let preferredMoveInCleaningDate: string | null | undefined = undefined;
  if (Object.prototype.hasOwnProperty.call(body, 'preferredMoveInCleaningDate')) {
    const parsed = parsePreferredMoveInCleaningDate(body.preferredMoveInCleaningDate);
    if (parsed === 'INVALID') {
      res.status(400).json({ error: '입주청소 희망 날짜는 YYYY-MM-DD 형식의 유효한 날짜여야 합니다.' });
      return;
    }
    preferredMoveInCleaningDate = parsed;
  }
  let connectInquiryId: string | undefined;
  if (typeof body.inquiryId === 'string' && body.inquiryId.trim()) {
    const iid = body.inquiryId.trim();
    const exists = await prisma.inquiry.findUnique({ where: { id: iid }, select: { id: true } });
    if (!exists) {
      res.status(400).json({ error: '접수를 찾을 수 없습니다.' });
      return;
    }
    const ok = await canAdminOrMarketerViewInquiry(user, iid);
    if (!ok) {
      res.status(403).json({ error: '해당 접수에 부재현황을 연결할 권한이 없습니다.' });
      return;
    }
    connectInquiryId = iid;
  }
  if (!connectInquiryId && (status === 'DEPOSIT_PENDING' || status === 'RESERVED')) {
    connectInquiryId = await createInquiryForDepositFlow({
      actorId: user.userId,
      customerName,
      nickname,
      customerPhone,
      memo,
      followupStatus: status,
    });
  }
  let operatingCompanyId: string;
  try {
    const isStaffAdmin = await userHasStaffAdminAccess(user);
    const brandInput = readCrmWorkBrandInput({}, body);
    operatingCompanyId = await resolveCrmWorkOperatingCompanyId({
      tenantId,
      userId: user.userId,
      userRole: user.role as UserRole,
      isStaffAdmin,
      ...brandInput,
    });
  } catch (e) {
    const mapped = mapOperatingCompanyResolveError(e);
    if (mapped) {
      res.status(mapped.status).json({ error: mapped.message });
      return;
    }
    throw e;
  }
  const row = await prisma.orderFollowup.create({
    data: {
      tenantId,
      operatingCompanyId,
      customerName,
      nickname,
      customerPhone,
      status,
      goldDb,
      memo,
      nextContactAt: nextContactAt === undefined ? null : nextContactAt,
      createdById: user.userId,
      handledById: user.userId,
      depositReceivedAt: status === 'RESERVED' ? new Date() : null,
      ...(preferredMoveInCleaningDate !== undefined
        ? { preferredMoveInCleaningDate }
        : {}),
      ...(connectInquiryId ? { inquiryId: connectInquiryId } : {}),
    },
    include: FOLLOWUP_INCLUDE,
  });
  await appendFollowupLog(prisma, {
    followupId: row.id,
    actorId: user.userId,
    action: 'CREATE',
    detail: JSON.stringify({
      status,
      customerName,
      nickname,
      customerPhone,
      ...(connectInquiryId ? { inquiryId: connectInquiryId } : {}),
      ...(preferredMoveInCleaningDate !== undefined
        ? { preferredMoveInCleaningDate: preferredMoveInCleaningDate ?? null }
        : {}),
    }),
  });
  const full = await prisma.orderFollowup.findUniqueOrThrow({
    where: { id: row.id },
    include: FOLLOWUP_INCLUDE,
  });
  if (connectInquiryId) {
    if (status === 'DEPOSIT_PENDING') {
      await syncInquiryWhenFollowupDepositPending(connectInquiryId, tenantId);
    } else if (status === 'RESERVED') {
      await syncInquiryWhenFollowupDepositComplete(connectInquiryId, tenantId);
    }
  }
  res.status(201).json({ item: serializeFollowup(full) });
});

router.patch('/:id', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const prev = await prisma.orderFollowup.findFirst({ where: { id, tenantId } });
  if (!prev) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }

  const data: import('@prisma/client').Prisma.OrderFollowupUpdateInput = {
    handledBy: { connect: { id: user.userId } },
  };

  if (typeof body.customerPhone === 'string') {
    const next = body.customerPhone.trim();
    if (next !== prev.customerPhone) {
      data.customerPhone = next;
      await appendFollowupLog(prisma, {
        followupId: id,
        actorId: user.userId,
        action: 'CUSTOMER_PHONE',
        detail: JSON.stringify({ from: prev.customerPhone, to: next }),
      });
    }
  }

  if ('inquiryId' in body) {
    const raw = body.inquiryId;
    if (raw === null || raw === '') {
      if (prev.inquiryId != null) {
        data.inquiry = { disconnect: true };
        await appendFollowupLog(prisma, {
          followupId: id,
          actorId: user.userId,
          action: 'INQUIRY_LINK',
          detail: JSON.stringify({ from: prev.inquiryId, to: null }),
        });
      }
    } else if (typeof raw === 'string') {
      const iid = raw.trim();
      if (!iid) {
        if (prev.inquiryId != null) {
          data.inquiry = { disconnect: true };
          await appendFollowupLog(prisma, {
            followupId: id,
            actorId: user.userId,
            action: 'INQUIRY_LINK',
            detail: JSON.stringify({ from: prev.inquiryId, to: null }),
          });
        }
      } else if (iid !== prev.inquiryId) {
        const exists = await prisma.inquiry.findUnique({ where: { id: iid }, select: { id: true } });
        if (!exists) {
          res.status(400).json({ error: '접수를 찾을 수 없습니다.' });
          return;
        }
        const ok = await canAdminOrMarketerViewInquiry(user, iid);
        if (!ok) {
          res.status(403).json({ error: '해당 접수에 부재현황을 연결할 권한이 없습니다.' });
          return;
        }
        data.inquiry = { connect: { id: iid } };
        await appendFollowupLog(prisma, {
          followupId: id,
          actorId: user.userId,
          action: 'INQUIRY_LINK',
          detail: JSON.stringify({ from: prev.inquiryId ?? null, to: iid }),
        });
      }
    }
  }

  if (typeof body.customerName === 'string') {
    const next = body.customerName.trim();
    if (!next) {
      res.status(400).json({ error: '고객명은 비워둘 수 없습니다.' });
      return;
    }
    if (next !== prev.customerName) {
      data.customerName = next;
      await appendFollowupLog(prisma, {
        followupId: id,
        actorId: user.userId,
        action: 'CUSTOMER_NAME',
        detail: JSON.stringify({ from: prev.customerName, to: next }),
      });
    }
  }

  if (body.nickname === null || typeof body.nickname === 'string') {
    const nextNickname =
      typeof body.nickname === 'string' ? body.nickname.trim() || null : null;
    const prevNickname = prev.nickname ?? null;
    if (nextNickname !== prevNickname) {
      data.nickname = nextNickname;
      await appendFollowupLog(prisma, {
        followupId: id,
        actorId: user.userId,
        action: 'NICKNAME',
        detail: JSON.stringify({ from: prevNickname, to: nextNickname }),
      });
    }
  }

  if (typeof body.memo === 'string') {
    const m = body.memo.trim();
    data.memo = m || null;
    await appendFollowupLog(prisma, {
      followupId: id,
      actorId: user.userId,
      action: 'MEMO',
      detail: m || null,
    });
  }

  const nc = parseNextContact(body.nextContactAt);
  if (nc !== undefined) {
    data.nextContactAt = nc;
    await appendFollowupLog(prisma, {
      followupId: id,
      actorId: user.userId,
      action: 'NEXT_CONTACT',
      detail: nc ? nc.toISOString() : null,
    });
  }

  if (Object.prototype.hasOwnProperty.call(body, 'preferredMoveInCleaningDate')) {
    const p = parsePreferredMoveInCleaningDate(body.preferredMoveInCleaningDate);
    if (p === 'INVALID') {
      res.status(400).json({ error: '입주청소 희망 날짜는 YYYY-MM-DD 형식의 유효한 날짜여야 합니다.' });
      return;
    }
    const prevP = prev.preferredMoveInCleaningDate ?? null;
    if (p !== prevP) {
      data.preferredMoveInCleaningDate = p;
      await appendFollowupLog(prisma, {
        followupId: id,
        actorId: user.userId,
        action: 'PREFERRED_MOVE_IN_CLEANING_DATE',
        detail: JSON.stringify({ from: prevP, to: p }),
      });
    }
  }

  const st = parseStatus(body.status);
  if (st) {
    data.status = st;
    if (st === 'RESERVED' && !prev.depositReceivedAt) {
      data.depositReceivedAt = new Date();
    }
    await appendFollowupLog(prisma, {
      followupId: id,
      actorId: user.userId,
      action: 'STATUS',
      detail: JSON.stringify({ from: prev.status, to: st }),
    });
    if (
      prev.inquiryId == null &&
      !Object.prototype.hasOwnProperty.call(body, 'inquiryId') &&
      (st === 'DEPOSIT_PENDING' || st === 'RESERVED')
    ) {
      const autoInquiryId = await createInquiryForDepositFlow({
        actorId: user.userId,
        customerName:
          typeof body.customerName === 'string' && body.customerName.trim()
            ? body.customerName.trim()
            : prev.customerName,
        nickname:
          body.nickname === null || typeof body.nickname === 'string'
            ? typeof body.nickname === 'string'
              ? body.nickname.trim() || null
              : null
            : prev.nickname ?? null,
        customerPhone:
          typeof body.customerPhone === 'string' ? body.customerPhone.trim() : prev.customerPhone,
        memo:
          typeof body.memo === 'string'
            ? body.memo.trim() || null
            : (data.memo as string | null | undefined) ?? prev.memo ?? null,
        followupStatus: st,
      });
      data.inquiry = { connect: { id: autoInquiryId } };
      await appendFollowupLog(prisma, {
        followupId: id,
        actorId: user.userId,
        action: 'INQUIRY_LINK',
        detail: JSON.stringify({ from: prev.inquiryId ?? null, to: autoInquiryId }),
      });
    }
  }

  if (typeof body.goldDb === 'boolean' && body.goldDb !== prev.goldDb) {
    data.goldDb = body.goldDb;
    await appendFollowupLog(prisma, {
      followupId: id,
      actorId: user.userId,
      action: 'GOLD_DB',
      detail: JSON.stringify({ goldDb: body.goldDb }),
    });
  }

  await prisma.orderFollowup.update({
    where: { id },
    data,
  });
  const full = await prisma.orderFollowup.findUniqueOrThrow({
    where: { id },
    include: FOLLOWUP_INCLUDE,
  });
  if (full.inquiryId) {
    if (full.status === 'DEPOSIT_PENDING') {
      await syncInquiryWhenFollowupDepositPending(full.inquiryId, tenantId);
    } else if (full.status === 'RESERVED') {
      await syncInquiryWhenFollowupDepositComplete(full.inquiryId, tenantId);
    }
  }
  res.json({ item: serializeFollowup(full) });
});

/** 재연락 후에도 부재·보류 유지 시 보류 횟수 +1 */
router.post('/:id/defer', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { id } = req.params;
  const body = req.body as { note?: string };
  const prev = await prisma.orderFollowup.findFirst({ where: { id, tenantId } });
  if (!prev) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }
  if (prev.status === 'FULFILLED') {
    res.status(400).json({ error: '처리 완료된 건에는 부재 누적을 할 수 없습니다.' });
    return;
  }
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  await prisma.orderFollowup.update({
    where: { id },
    data: {
      deferCount: { increment: 1 },
      handledBy: { connect: { id: user.userId } },
    },
  });
  await appendFollowupLog(prisma, {
    followupId: id,
    actorId: user.userId,
    action: 'DEFER',
    detail: JSON.stringify({ deferCount: prev.deferCount + 1, note: note || undefined }),
  });
  const full = await prisma.orderFollowup.findUniqueOrThrow({
    where: { id },
    include: FOLLOWUP_INCLUDE,
  });
  res.json({ item: serializeFollowup(full) });
});

/** 부재현황 삭제 — 관리자/마케터 + 본인 비밀번호 확인 필수 */
router.delete('/:id', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { id } = req.params;
  const body = req.body as { password?: string };
  const password = body.password != null ? String(body.password).trim() : '';
  if (!password) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { id: true, passwordHash: true },
  });
  if (!dbUser) {
    res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }
  const valid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!valid) {
    res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    return;
  }

  const exists = await prisma.orderFollowup.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!exists) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }

  await prisma.orderFollowup.delete({ where: { id } });
  res.json({ ok: true as const });
});

export default router;
