import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import {
  authMiddleware,
  adminOrMarketer,
  type AuthPayload,
  superAdminOnly,
} from '../auth/auth.middleware.js';
import { isSuperAdminRoleAndEmail } from '../auth/superAdmin.js';
import {
  inclusiveDayCount,
  parseRange,
  resolveMarketerScope,
  loadMarketerUsers,
  sumSpendFromSessions,
} from './advertising.helpers.js';
import {
  isSoomgoChannelName,
  SOOMGO_WON_PER_AUTO_ESTIMATE,
  SOOMGO_WON_PER_RECEIVED_REQUEST,
} from './soomgoAd.constants.js';

const router = Router();

function authUser(req: unknown): AuthPayload {
  return (req as { user: AuthPayload }).user;
}

/** 활성 채널 목록 (종료 시 금액 입력용). ?all=1 이면 최고 관리자만 비활성 포함 */
router.get('/channels', authMiddleware, adminOrMarketer, async (req, res) => {
  const user = authUser(req);
  const all = req.query.all === '1' || req.query.all === 'true';
  const includeInactive = all && isSuperAdminRoleAndEmail(user.role, user.email);
  const channels = await prisma.adChannel.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ items: channels });
});

router.post('/channels', authMiddleware, superAdminOnly, async (req, res) => {
  const { name, sortOrder } = req.body as { name?: string; sortOrder?: number };
  const n = String(name ?? '').trim();
  if (!n) {
    res.status(400).json({ error: '채널 이름을 입력해주세요.' });
    return;
  }
  const row = await prisma.adChannel.create({
    data: {
      name: n,
      sortOrder: typeof sortOrder === 'number' && Number.isFinite(sortOrder) ? sortOrder : 0,
    },
  });
  res.json(row);
});

/** 채널 표시 순서 일괄 저장 (배열 순서 = 위에서 아래) */
router.put('/channels/reorder', authMiddleware, superAdminOnly, async (req, res) => {
  const body = req.body as { orderedIds?: string[] };
  const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.filter((x) => typeof x === 'string' && x.trim()) : [];
  if (orderedIds.length === 0) {
    res.status(400).json({ error: '순서(채널 id 배열)가 필요합니다.' });
    return;
  }
  const unique = new Set(orderedIds);
  if (unique.size !== orderedIds.length) {
    res.status(400).json({ error: '중복된 채널이 있습니다.' });
    return;
  }
  const existing = await prisma.adChannel.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true },
  });
  if (existing.length !== orderedIds.length) {
    res.status(400).json({ error: '존재하지 않는 채널이 포함되어 있습니다.' });
    return;
  }
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.adChannel.update({ where: { id }, data: { sortOrder: index } })
    )
  );
  res.json({ ok: true });
});

/** 광고비 입력 이력이 없는 채널만 삭제. 본인 비밀번호 확인 필수 */
router.delete('/channels/:id', authMiddleware, superAdminOnly, async (req, res) => {
  const { id } = req.params;
  const body = req.body as { password?: string };
  const password = body.password != null ? String(body.password) : '';
  if (!password) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return;
  }

  const user = authUser(req);
  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!dbUser) {
    res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }
  const valid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!valid) {
    res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    return;
  }

  const lineCount = await prisma.adSpendLine.count({ where: { channelId: id } });
  if (lineCount > 0) {
    res.status(400).json({
      error: '이미 광고비 입력 이력이 있는 채널은 삭제할 수 없습니다. 비활성화를 이용해 주세요.',
    });
    return;
  }

  try {
    await prisma.adChannel.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: '채널을 찾을 수 없습니다.' });
  }
});

router.patch('/channels/:id', authMiddleware, superAdminOnly, async (req, res) => {
  const { id } = req.params;
  const body = req.body as { name?: string; isActive?: boolean; sortOrder?: number };
  const data: { name?: string; isActive?: boolean; sortOrder?: number } = {};
  if (body.name != null) data.name = String(body.name).trim();
  if (body.isActive != null) data.isActive = Boolean(body.isActive);
  if (body.sortOrder != null && typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder;
  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: '수정할 내용이 없습니다.' });
    return;
  }
  try {
    const row = await prisma.adChannel.update({ where: { id }, data });
    res.json(row);
  } catch {
    res.status(404).json({ error: '채널을 찾을 수 없습니다.' });
  }
});

router.post('/sessions/start', authMiddleware, adminOrMarketer, async (req, res) => {
  const user = authUser(req);
  const existing = await prisma.adWorkSession.findFirst({
    where: { userId: user.userId, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });
  if (existing) {
    res.status(400).json({ error: '이미 진행 중인 작업이 있습니다. 종료 후 다시 시작할 수 있습니다.' });
    return;
  }
  const session = await prisma.adWorkSession.create({
    data: { userId: user.userId, startedAt: new Date() },
  });
  res.json(session);
});

router.get('/sessions/active', authMiddleware, adminOrMarketer, async (req, res) => {
  const user = authUser(req);
  const session = await prisma.adWorkSession.findFirst({
    where: { userId: user.userId, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });
  res.json({ session });
});

router.post('/sessions/end', authMiddleware, adminOrMarketer, async (req, res) => {
  const user = authUser(req);
  const body = req.body as {
    lines?: Array<{
      channelId?: string;
      amount?: number;
      soomgo?: { received?: number; autoEstimate?: number; confirmed?: number };
    }>;
  };
  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  const session = await prisma.adWorkSession.findFirst({
    where: { userId: user.userId, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });
  if (!session) {
    res.status(400).json({ error: '진행 중인 작업이 없습니다.' });
    return;
  }

  const activeChannels = await prisma.adChannel.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  const channelById = new Map(activeChannels.map((c) => [c.id, c]));
  const allowed = new Set(activeChannels.map((c) => c.id));

  const channelIds = new Set<string>();
  const normalized: Array<{
    channelId: string;
    amount: number;
    soomgoReceived?: number | null;
    soomgoAuto?: number | null;
    soomgoConfirmed?: number | null;
  }> = [];

  for (const row of rawLines) {
    if (!row?.channelId || typeof row.channelId !== 'string') continue;
    if (channelIds.has(row.channelId)) continue;
    if (!allowed.has(row.channelId)) continue;

    const ch = channelById.get(row.channelId);
    if (!ch) continue;

    if (isSoomgoChannelName(ch.name)) {
      const sg = row.soomgo;
      if (!sg || typeof sg !== 'object') {
        res.status(400).json({ error: `${ch.name}: 숨고 채널은 받은요청·자동견적·예약확정 건수를 입력해 주세요.` });
        return;
      }
      const received = Math.max(0, Math.floor(Number(sg.received)));
      const autoEst = Math.max(0, Math.floor(Number(sg.autoEstimate)));
      const confirmed = Math.max(0, Math.floor(Number(sg.confirmed)));
      if (!Number.isFinite(received) || !Number.isFinite(autoEst) || !Number.isFinite(confirmed)) {
        res.status(400).json({ error: `${ch.name}: 건수는 0 이상 정수로 입력해 주세요.` });
        return;
      }
      const amt =
        received * SOOMGO_WON_PER_RECEIVED_REQUEST + autoEst * SOOMGO_WON_PER_AUTO_ESTIMATE;
      if (amt <= 0) {
        res.status(400).json({
          error: `${ch.name}: 받은요청·자동견적 건수로 산출된 당일 광고비가 0원입니다.`,
        });
        return;
      }
      channelIds.add(row.channelId);
      normalized.push({
        channelId: row.channelId,
        amount: amt,
        soomgoReceived: received,
        soomgoAuto: autoEst,
        soomgoConfirmed: confirmed,
      });
    } else {
      if (typeof row.amount !== 'number' || !Number.isFinite(row.amount)) continue;
      const amt = Math.max(0, Math.round(row.amount));
      if (amt <= 0) continue;
      channelIds.add(row.channelId);
      normalized.push({ channelId: row.channelId, amount: amt, soomgoReceived: null, soomgoAuto: null, soomgoConfirmed: null });
    }
  }

  if (normalized.length > 0) {
    const total = normalized.reduce((s, l) => s + l.amount, 0);
    if (total <= 0) {
      res.status(400).json({ error: '채널별 금액 합계가 0보다 커야 합니다.' });
      return;
    }
  }

  const endedAt = new Date();
  await prisma.$transaction(async (tx) => {
    if (normalized.length > 0) {
      await tx.adSpendLine.createMany({
        data: normalized.map((l) => ({
          sessionId: session.id,
          channelId: l.channelId,
          amount: l.amount,
          soomgoReceivedCount: l.soomgoReceived != null ? l.soomgoReceived : null,
          soomgoAutoEstimateCount: l.soomgoAuto != null ? l.soomgoAuto : null,
          soomgoConfirmedCount: l.soomgoConfirmed != null ? l.soomgoConfirmed : null,
        })),
      });
    }
    await tx.adWorkSession.update({
      where: { id: session.id },
      data: { endedAt },
    });
  });

  const updated = await prisma.adWorkSession.findUnique({
    where: { id: session.id },
    include: { spendLines: { include: { channel: true } } },
  });
  res.json({ session: updated });
});

router.get('/analytics', authMiddleware, adminOrMarketer, async (req, res) => {
  const user = authUser(req);
  const range = parseRange(
    typeof req.query.from === 'string' ? req.query.from : undefined,
    typeof req.query.to === 'string' ? req.query.to : undefined
  );
  if (!range) {
    res.status(400).json({ error: 'from, to (YYYY-MM-DD)를 지정해주세요.' });
    return;
  }

  const scope = resolveMarketerScope(user, typeof req.query.marketerId === 'string' ? req.query.marketerId : undefined);
  if (user.role !== 'ADMIN' && req.query.marketerId) {
    res.status(403).json({ error: '다른 사용자 데이터를 조회할 수 없습니다.' });
    return;
  }

  const days = inclusiveDayCount(range.fromYmd, range.toYmd);

  const sessionWhere: {
    endedAt: { not: null; gte: Date; lte: Date };
    userId?: { in: string[] };
  } = {
    endedAt: { not: null, gte: range.from, lte: range.to },
  };
  if (scope.marketerIds !== 'ALL_MARKETERS') {
    sessionWhere.userId = { in: scope.marketerIds };
  }

  const inquiryWhere = {
    source: '발주서' as const,
    orderFormId: { not: null } as const,
    createdAt: { gte: range.from, lte: range.to },
    ...(scope.marketerIds !== 'ALL_MARKETERS' ? { createdById: { in: scope.marketerIds } } : {}),
  };

  /** 세션·지출: user 객체 없이 최소 필드만 (메모리 절약) */
  const [sessions, inquiryTotals, inquiryByCreator] = await Promise.all([
    prisma.adWorkSession.findMany({
      where: sessionWhere,
      select: {
        userId: true,
        spendLines: { select: { amount: true } },
      },
    }),
    prisma.inquiry.aggregate({
      where: inquiryWhere,
      _count: { _all: true },
      _sum: { serviceTotalAmount: true },
    }),
    prisma.inquiry.groupBy({
      by: ['createdById'],
      where: {
        ...inquiryWhere,
        createdById: { not: null },
      },
      _count: { _all: true },
      _sum: { serviceTotalAmount: true },
    }),
  ]);

  const totalSpend = sumSpendFromSessions(sessions);
  const inquiryCount = inquiryTotals._count._all;
  const totalRevenue = inquiryTotals._sum.serviceTotalAmount ?? 0;
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : null;
  const costPerInquiry = inquiryCount > 0 ? totalSpend / inquiryCount : null;
  const avgDailySpend = totalSpend / days;

  const spendByUser = new Map<string, number>();
  for (const s of sessions) {
    const u = s.userId;
    let add = 0;
    for (const l of s.spendLines) add += l.amount;
    spendByUser.set(u, (spendByUser.get(u) ?? 0) + add);
  }

  const revenueByUser = new Map<string, number>();
  const inquiryCountByUser = new Map<string, number>();
  for (const row of inquiryByCreator) {
    const uid = row.createdById;
    if (!uid) continue;
    revenueByUser.set(uid, row._sum.serviceTotalAmount ?? 0);
    inquiryCountByUser.set(uid, row._count._all);
  }

  let rowUsers: { id: string; name: string; email: string; role: string }[] = [];
  if (scope.marketerIds === 'ALL_MARKETERS') {
    const marketers = await loadMarketerUsers(prisma, scope);
    const mIds = new Set(marketers.map((m) => m.id));
    const extraIds = new Set<string>();
    for (const uid of spendByUser.keys()) {
      if (!mIds.has(uid)) extraIds.add(uid);
    }
    for (const uid of revenueByUser.keys()) {
      if (!mIds.has(uid)) extraIds.add(uid);
    }
    const extras =
      extraIds.size > 0
        ? await prisma.user.findMany({
            where: { id: { in: [...extraIds] }, role: 'ADMIN', isActive: true },
            select: { id: true, name: true, email: true, role: true },
          })
        : [];
    rowUsers = [
      ...marketers.map((m) => ({ ...m, role: 'MARKETER' })),
      ...extras,
    ];
  } else {
    const one = await prisma.user.findUnique({
      where: { id: scope.marketerIds[0] },
      select: { id: true, name: true, email: true, role: true },
    });
    rowUsers = one ? [one] : [];
  }

  const byUser = rowUsers.map((u) => {
    const spend = spendByUser.get(u.id) ?? 0;
    const rev = revenueByUser.get(u.id) ?? 0;
    const ic = inquiryCountByUser.get(u.id) ?? 0;
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      totalAdSpend: spend,
      orderInquiryCount: ic,
      totalRevenue: rev,
      roas: spend > 0 ? rev / spend : null,
      costPerInquiry: ic > 0 ? spend / ic : null,
      avgDailySpend: spend / days,
    };
  });

  byUser.sort((a, b) => b.totalAdSpend - a.totalAdSpend);

  res.json({
    period: { from: range.fromYmd, to: range.toYmd, days },
    summary: {
      totalAdSpend: totalSpend,
      orderInquiryCount: inquiryCount,
      totalRevenue,
      roas,
      costPerInquiry,
      avgDailySpend,
    },
    byUser,
  });
});

router.get('/sessions/history', authMiddleware, adminOrMarketer, async (req, res) => {
  const user = authUser(req);
  const range = parseRange(
    typeof req.query.from === 'string' ? req.query.from : undefined,
    typeof req.query.to === 'string' ? req.query.to : undefined
  );
  if (!range) {
    res.status(400).json({ error: 'from, to (YYYY-MM-DD)를 지정해주세요.' });
    return;
  }

  const scope = resolveMarketerScope(user, typeof req.query.marketerId === 'string' ? req.query.marketerId : undefined);
  if (user.role !== 'ADMIN' && req.query.marketerId) {
    res.status(403).json({ error: '다른 사용자 데이터를 조회할 수 없습니다.' });
    return;
  }

  const where: {
    endedAt: { not: null; gte: Date; lte: Date };
    userId?: { in: string[] };
  } = {
    endedAt: { not: null, gte: range.from, lte: range.to },
  };
  if (scope.marketerIds !== 'ALL_MARKETERS') {
    where.userId = { in: scope.marketerIds };
  }

  const sessions = await prisma.adWorkSession.findMany({
    where,
    include: {
      spendLines: { include: { channel: true } },
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { endedAt: 'desc' },
    take: 200,
  });

  res.json({ items: sessions });
});

export default router;
