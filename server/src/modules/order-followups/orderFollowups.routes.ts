import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOrMarketer } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { createdAtRangeFromQuery } from '../inquiries/inquiryListDateRange.js';
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

const router = Router();

/** 부재현황이 입금 완료(RESERVED)일 때, 연결 접수가 입금대기면 접수 목록용 입금완료(DEPOSIT_COMPLETED)로 맞춤 */
async function syncInquiryWhenFollowupDepositComplete(inquiryId: string): Promise<void> {
  const updated = await prisma.inquiry.updateMany({
    where: { id: inquiryId, status: 'DEPOSIT_PENDING' },
    data: { status: 'DEPOSIT_COMPLETED' },
  });
  if (updated.count === 0) return;
  const assigns = await prisma.assignment.findMany({
    where: { inquiryId },
    select: { teamLeaderId: true },
  });
  if (assigns.length > 0) {
    notifyInboxRefresh([...new Set(assigns.map((a) => a.teamLeaderId))]);
  }
}

/** 부재현황이 예약금 대기(DEPOSIT_PENDING)일 때, 연결 접수를 접수 목록 입금대기로 맞춤(접수번호 없으면 발급) */
async function syncInquiryWhenFollowupDepositPending(inquiryId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const inv = await tx.inquiry.findUnique({
      where: { id: inquiryId },
      select: { status: true, inquiryNumber: true },
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
      data.inquiryNumber = await allocateNextInquiryNumber(tx);
    }
    await tx.inquiry.update({ where: { id: inquiryId }, data });
  });
}
router.use(authMiddleware);
router.use(adminOrMarketer);

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
  return prisma.$transaction(async (tx) => {
    const inquiryStatus =
      params.followupStatus === 'DEPOSIT_PENDING' ? 'DEPOSIT_PENDING' : 'DEPOSIT_COMPLETED';
    const inquiryNumber =
      inquiryStatus === 'DEPOSIT_PENDING' ? await allocateNextInquiryNumber(tx) : null;
    const created = await tx.inquiry.create({
      data: {
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
  const includeFulfilled = req.query.includeFulfilled === '1' || req.query.includeFulfilled === 'true';
  const statusFilter = parseStatus(req.query.status);
  const customerName =
    typeof req.query.customerName === 'string' ? req.query.customerName.trim() : '';
  const inquiryIdFilter =
    typeof req.query.inquiryId === 'string' ? req.query.inquiryId.trim() : '';
  const missingInquiryLink =
    req.query.missingInquiryLink === '1' || req.query.missingInquiryLink === 'true';
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
  const where: import('@prisma/client').Prisma.OrderFollowupWhereInput = {};
  /** 부재·보류 화면은 항상 부재/보류 상태만 조회한다. */
  const absHoldOnly: import('@prisma/client').Prisma.OrderFollowupWhereInput = {
    status: { in: ['REQUESTED', 'ABSENT', 'ON_HOLD'] },
  };
  where.AND = [absHoldOnly];
  if (inquiryIdFilter) {
    where.inquiryId = inquiryIdFilter;
  }
  if (missingInquiryLink) {
    where.inquiryId = null;
  }
  if (statusFilter) {
    where.status = statusFilter;
  } else {
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
  const dateRange = missingInquiryLink
    ? null
    : createdAtRangeFromQuery({
        datePreset: typeof req.query.datePreset === 'string' ? req.query.datePreset : undefined,
        month: typeof req.query.month === 'string' ? req.query.month : undefined,
        day: typeof req.query.day === 'string' ? req.query.day : undefined,
      });
  if (dateRange) {
    where.createdAt = { gte: dateRange.gte, lte: dateRange.lte };
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
  const take = missingInquiryLink ? 40 : 500;
  const rows = await prisma.orderFollowup.findMany({
    where,
    include: FOLLOWUP_INCLUDE,
    orderBy: [{ createdAt: 'desc' }],
    take,
  });
  res.json({ items: rows.map((r) => serializeFollowup(r)) });
});

router.get('/:id/logs', async (req, res) => {
  const { id } = req.params;
  const exists = await prisma.orderFollowup.findUnique({ where: { id }, select: { id: true } });
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
  const row = await prisma.orderFollowup.create({
    data: {
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
      await syncInquiryWhenFollowupDepositPending(connectInquiryId);
    } else if (status === 'RESERVED') {
      await syncInquiryWhenFollowupDepositComplete(connectInquiryId);
    }
  }
  res.status(201).json({ item: serializeFollowup(full) });
});

router.patch('/:id', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const prev = await prisma.orderFollowup.findUnique({ where: { id } });
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
      await syncInquiryWhenFollowupDepositPending(full.inquiryId);
    } else if (full.status === 'RESERVED') {
      await syncInquiryWhenFollowupDepositComplete(full.inquiryId);
    }
  }
  res.json({ item: serializeFollowup(full) });
});

/** 재연락 후에도 부재·보류 유지 시 보류 횟수 +1 */
router.post('/:id/defer', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const { id } = req.params;
  const body = req.body as { note?: string };
  const prev = await prisma.orderFollowup.findUnique({ where: { id } });
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

  const exists = await prisma.orderFollowup.findUnique({
    where: { id },
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
