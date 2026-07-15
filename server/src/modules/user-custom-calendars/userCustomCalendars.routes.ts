import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { getTenantIdFromAuth, type TenantScopedRequest } from '../tenants/tenant.middleware.js';
import { sanitizeCustomCalendarColorKey } from '../../constants/customCalendarColorKeys.js';

const calendarListInclude = {
  inquiryPins: { select: { inquiryId: true } },
} as const;

function serializeCalendar(
  row: {
    id: string;
    userId: string;
    name: string;
    regions: unknown;
    serviceZoneId?: string | null;
    colorKey: string;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    inquiryPins?: Array<{ inquiryId: string }>;
  },
) {
  const { inquiryPins, ...rest } = row;
  return {
    ...rest,
    serviceZoneId: rest.serviceZoneId ?? null,
    pinnedInquiryIds: (inquiryPins ?? []).map((p) => p.inquiryId),
  };
}

async function findOwnedCalendar(calendarId: string, tenantId: string, userId: string) {
  return prisma.userCustomCalendar.findFirst({
    where: { id: calendarId, tenantId, userId },
  });
}

/** 비동기 핸들러 에러를 JSON 500으로 내려주는 래퍼 */
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch((err) => {
      console.error('[user-custom-calendars]', req.method, req.originalUrl, err);
      if (res.headersSent) return;
      const message =
        err instanceof Error && err.message
          ? err.message
          : '요청을 처리하지 못했습니다.';
      res.status(500).json({ error: message });
    });
  };
}

/**
 * 사용자별 맞춤 '지역 필터 캘린더' CRUD.
 *
 * - 본인 소유만 조회/수정/삭제 가능
 * - 삭제는 프로젝트 규칙에 따라 본인 비밀번호 확인 후에만 처리
 * - 실시간 동기화는 해당 데이터가 팀장 화면에 직접 영향을 주지 않으므로 inbox:refresh 전송 불필요
 */
const router = Router();

router.use(authMiddleware);
router.use(requireStaffPermission('schedule.customCalendar'));
router.use((req, res, next) => {
  const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  (req as unknown as TenantScopedRequest).tenantId = tenantId;
  next();
});

function authUser(req: import('express').Request): AuthPayload {
  return (req as unknown as { user: AuthPayload }).user;
}

function sanitizeRegions(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const v of value) {
    if (typeof v !== 'string') continue;
    const s = v.trim();
    if (!s) continue;
    if (s.length > 64) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    cleaned.push(s);
    if (cleaned.length >= 200) break;
  }
  return cleaned;
}

const EXT_COMPANY_PREFIX = '@e:';
const PARTNER_TENANT_PREFIX = '@p:';

function extractPartnerTenantIdsFromRegions(regions: string[]): string[] {
  const ids: string[] = [];
  for (const r of regions) {
    if (!r.startsWith(PARTNER_TENANT_PREFIX)) continue;
    const id = r.slice(PARTNER_TENANT_PREFIX.length).trim();
    if (id) ids.push(id);
  }
  return Array.from(new Set(ids));
}

function calendarHasFilterCriteria(regions: string[], serviceZoneId: string | null): boolean {
  if (serviceZoneId) return true;
  for (const r of regions) {
    if (r.startsWith(EXT_COMPANY_PREFIX) || r.startsWith(PARTNER_TENANT_PREFIX)) return true;
    if (!r.startsWith('@')) return true;
  }
  return false;
}

async function validatePartnerTenantIdsInRegions(
  tenantId: string,
  regions: string[],
): Promise<string | null> {
  const partnerIds = extractPartnerTenantIdsFromRegions(regions);
  if (partnerIds.length === 0) return null;
  const active = await prisma.tenantPartnership.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { tenantLowId: tenantId, tenantHighId: { in: partnerIds } },
        { tenantHighId: tenantId, tenantLowId: { in: partnerIds } },
      ],
    },
    select: { tenantLowId: true, tenantHighId: true },
  });
  const allowed = new Set<string>();
  for (const row of active) {
    allowed.add(row.tenantLowId === tenantId ? row.tenantHighId : row.tenantLowId);
  }
  for (const id of partnerIds) {
    if (!allowed.has(id)) {
      return '연결되지 않았거나 중지된 파트너는 캘린더에 추가할 수 없습니다.';
    }
  }
  return null;
}

async function resolveCalendarServiceZoneId(
  tenantId: string,
  raw: unknown,
): Promise<string | null | 'invalid'> {
  if (raw === undefined) return null;
  if (raw === null || raw === '') return null;
  const id = typeof raw === 'string' ? raw.trim() : '';
  if (!id) return null;
  const zone = await prisma.serviceZone.findFirst({
    where: { id, tenantId, isActive: true },
    select: { id: true },
  });
  return zone ? zone.id : 'invalid';
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { userId } = authUser(req);
    const tenantId = (req as unknown as TenantScopedRequest).tenantId;
    const list = await prisma.userCustomCalendar.findMany({
      where: { tenantId, userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: calendarListInclude,
    });
    res.json({ items: list.map(serializeCalendar) });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { userId } = authUser(req);
    const tenantId = (req as unknown as TenantScopedRequest).tenantId;
    const body = (req.body ?? {}) as {
      name?: unknown;
      regions?: unknown;
      colorKey?: unknown;
      serviceZoneId?: unknown;
    };

    const rawName = typeof body.name === 'string' ? body.name.trim() : '';
    if (!rawName) {
      res.status(400).json({ error: '제목을 입력해주세요.' });
      return;
    }
    if (rawName.length > 64) {
      res.status(400).json({ error: '제목은 64자 이내로 입력해주세요.' });
      return;
    }

    const regions = sanitizeRegions(body.regions);
    if (!regions || regions.length === 0) {
      res.status(400).json({ error: '캘린더 필터 조건을 1개 이상 선택해주세요.' });
      return;
    }

    const colorKey = sanitizeCustomCalendarColorKey(body.colorKey);

    const serviceZoneId = await resolveCalendarServiceZoneId(tenantId, body.serviceZoneId);
    if (serviceZoneId === 'invalid') {
      res.status(400).json({ error: '유효하지 않은 서비스 권역입니다.' });
      return;
    }

    if (!calendarHasFilterCriteria(regions, serviceZoneId === 'invalid' ? null : serviceZoneId)) {
      res.status(400).json({ error: '지역·타업체·파트너 중 하나 이상을 선택해주세요.' });
      return;
    }

    const partnerErr = await validatePartnerTenantIdsInRegions(tenantId, regions);
    if (partnerErr) {
      res.status(400).json({ error: partnerErr });
      return;
    }

    const last = await prisma.userCustomCalendar.findFirst({
      where: { tenantId, userId },
      orderBy: { sortOrder: 'desc' },
    });
    const sortOrder = (last?.sortOrder ?? -1) + 1;

    const created = await prisma.userCustomCalendar.create({
      data: {
        tenantId,
        userId,
        name: rawName,
        regions,
        colorKey,
        sortOrder,
        ...(serviceZoneId ? { serviceZoneId } : {}),
      },
      include: calendarListInclude,
    });
    res.json({ item: serializeCalendar(created) });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { userId } = authUser(req);
    const tenantId = (req as unknown as TenantScopedRequest).tenantId;
    const { id } = req.params;
    const existing = await prisma.userCustomCalendar.findFirst({ where: { id, tenantId, userId } });
    if (!existing) {
      res.status(404).json({ error: '캘린더를 찾을 수 없습니다.' });
      return;
    }

    const body = (req.body ?? {}) as {
      name?: unknown;
      regions?: unknown;
      colorKey?: unknown;
      sortOrder?: unknown;
      serviceZoneId?: unknown;
    };

    const data: {
      name?: string;
      regions?: string[];
      colorKey?: string;
      sortOrder?: number;
      serviceZoneId?: string | null;
    } = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string') {
        res.status(400).json({ error: '제목이 올바르지 않습니다.' });
        return;
      }
      const n = body.name.trim();
      if (!n || n.length > 64) {
        res.status(400).json({ error: '제목을 1~64자로 입력해주세요.' });
        return;
      }
      data.name = n;
    }

    if (body.regions !== undefined) {
      const regions = sanitizeRegions(body.regions);
      if (!regions || regions.length === 0) {
        res.status(400).json({ error: '캘린더 필터 조건을 1개 이상 선택해주세요.' });
        return;
      }
      const nextServiceZoneId =
        body.serviceZoneId !== undefined
          ? await resolveCalendarServiceZoneId(tenantId, body.serviceZoneId)
          : existing.serviceZoneId;
      if (nextServiceZoneId === 'invalid') {
        res.status(400).json({ error: '유효하지 않은 서비스 권역입니다.' });
        return;
      }
      if (!calendarHasFilterCriteria(regions, nextServiceZoneId)) {
        res.status(400).json({ error: '지역·타업체·파트너 중 하나 이상을 선택해주세요.' });
        return;
      }
      const partnerErr = await validatePartnerTenantIdsInRegions(tenantId, regions);
      if (partnerErr) {
        res.status(400).json({ error: partnerErr });
        return;
      }
      data.regions = regions;
    }

    if (body.colorKey !== undefined) {
      data.colorKey = sanitizeCustomCalendarColorKey(body.colorKey);
    }

    if (body.sortOrder !== undefined) {
      const n = Number(body.sortOrder);
      if (Number.isFinite(n)) data.sortOrder = Math.max(0, Math.floor(n));
    }

    if (body.serviceZoneId !== undefined) {
      const resolved = await resolveCalendarServiceZoneId(tenantId, body.serviceZoneId);
      if (resolved === 'invalid') {
        res.status(400).json({ error: '유효하지 않은 서비스 권역입니다.' });
        return;
      }
      data.serviceZoneId = resolved;
    }

    const updated = await prisma.userCustomCalendar.update({
      where: { id },
      data,
      include: calendarListInclude,
    });
    res.json({ item: serializeCalendar(updated) });
  })
);

/** 접수를 캘린더에 수동 포함 */
router.post(
  '/:id/pins',
  asyncHandler(async (req, res) => {
    const { userId } = authUser(req);
    const tenantId = (req as unknown as TenantScopedRequest).tenantId;
    const { id: calendarId } = req.params;
    const body = (req.body ?? {}) as { inquiryId?: unknown };
    const inquiryId = typeof body.inquiryId === 'string' ? body.inquiryId.trim() : '';
    if (!inquiryId) {
      res.status(400).json({ error: '접수 id(inquiryId)가 필요합니다.' });
      return;
    }

    const calendar = await findOwnedCalendar(calendarId, tenantId, userId);
    if (!calendar) {
      res.status(404).json({ error: '캘린더를 찾을 수 없습니다.' });
      return;
    }

    const inquiry = await prisma.inquiry.findFirst({
      where: { id: inquiryId, tenantId },
      select: { id: true, status: true },
    });
    if (!inquiry) {
      res.status(404).json({ error: '접수를 찾을 수 없습니다.' });
      return;
    }
    if (inquiry.status === 'CANCELLED') {
      res.status(400).json({ error: '취소된 접수는 캘린더에 포함할 수 없습니다.' });
      return;
    }

    await prisma.userCustomCalendarInquiryPin.upsert({
      where: { calendarId_inquiryId: { calendarId, inquiryId } },
      create: { tenantId, userId, calendarId, inquiryId },
      update: {},
    });

    const updated = await prisma.userCustomCalendar.findFirst({
      where: { id: calendarId, tenantId, userId },
      include: calendarListInclude,
    });
    res.json({ item: updated ? serializeCalendar(updated) : null, inquiryId });
  }),
);

/** 접수 수동 포함 해제(자동 지역 매칭은 유지) */
router.delete(
  '/:id/pins/:inquiryId',
  asyncHandler(async (req, res) => {
    const { userId } = authUser(req);
    const tenantId = (req as unknown as TenantScopedRequest).tenantId;
    const { id: calendarId, inquiryId } = req.params;

    const calendar = await findOwnedCalendar(calendarId, tenantId, userId);
    if (!calendar) {
      res.status(404).json({ error: '캘린더를 찾을 수 없습니다.' });
      return;
    }

    await prisma.userCustomCalendarInquiryPin.deleteMany({
      where: { calendarId, inquiryId, tenantId, userId },
    });

    const updated = await prisma.userCustomCalendar.findFirst({
      where: { id: calendarId, tenantId, userId },
      include: calendarListInclude,
    });
    res.json({ item: updated ? serializeCalendar(updated) : null, inquiryId });
  }),
);

/** 삭제 — 본인 비밀번호 확인 필수(프로젝트 규칙) */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { userId } = authUser(req);
    const tenantId = (req as unknown as TenantScopedRequest).tenantId;
    const { id } = req.params;

    const body = (req.body ?? {}) as { password?: unknown };
    const password = typeof body.password === 'string' ? body.password : '';
    if (!password) {
      res.status(400).json({ error: '비밀번호를 입력해주세요.' });
      return;
    }

    const existing = await prisma.userCustomCalendar.findFirst({ where: { id, tenantId, userId } });
    if (!existing) {
      res.status(404).json({ error: '캘린더를 찾을 수 없습니다.' });
      return;
    }

    const dbUser = await prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!dbUser) {
      res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
      return;
    }

    const valid = await bcrypt.compare(password, dbUser.passwordHash);
    if (!valid) {
      res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
      return;
    }

    await prisma.userCustomCalendar.delete({ where: { id } });
    res.json({ ok: true });
  })
);

export default router;
