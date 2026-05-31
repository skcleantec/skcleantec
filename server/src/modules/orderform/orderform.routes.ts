import { Router } from 'express';
import { randomBytes, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOnly, adminOrMarketer, adminOrMarketerOrTeamLeader } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import {
  deleteOrderFormPhoto,
  listOrderFormPhotos,
  serializeOrderFormPhoto,
  uploadOrderFormPhotoBuffer,
} from './orderformPhotos.service.js';
import {
  DEFAULT_GUIDE_SECTIONS,
  type GuideSection,
} from './guideDefaults.js';
import {
  filterActiveProfessionalOptionIds,
  normalizeHexColor,
  parseProfessionalOptionIdsRaw,
  professionalOptionDepthFromRoot,
} from './specialtyOptions.js';
import { allocateNextInquiryNumber } from '../inquiries/inquiryNumber.js';
import { syncInquiryAddressGeo } from '../inquiries/inquiryAddressGeoSync.js';
import { notifyInquiryCelebrate } from '../realtime/inquiryCelebrateNotify.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { tenantIdForUserId } from '../tenants/tenant.service.js';
import { createdAtRangeFromQuery, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import {
  assertTenantAllowsPublicService,
  PublicTenantAccessError,
  publicTenantAccessHttpStatus,
  validateOptionalPublicTenantSlug,
} from '../tenants/publicTenantAccess.js';
import { resolvePublicTenantIdFromRequest } from '../tenants/publicRequestTenant.js';
import {
  getOrCreateEstimateConfig,
  getOrCreateOrderFormConfig,
  profOptionKey,
  seedProfessionalDefaultsForTenant,
} from '../tenants/tenantConfigSeed.service.js';
import { ORDER_FORM_CONFIG_DEFAULTS } from '../../constants/orderFormConfigDefaults.js';
import { isAllowedPreferredTimeDetail } from './preferredTimeDetail.validation.js';
import {
  getPublicTemplateForForm,
  resolveIssueTemplate,
  sanitizeCustomAnswers,
} from '../orderform-templates/orderFormTemplate.service.js';

const router = Router();

function publicTenantSlugFromQuery(req: { query: Record<string, unknown> }): string | undefined {
  const raw = req.query.tenant ?? req.query.tenantSlug;
  return typeof raw === 'string' ? raw : undefined;
}

async function assertPublicOrderFormAccess(
  tenantId: string,
  req: { query: Record<string, unknown> },
): Promise<void> {
  await assertTenantAllowsPublicService(tenantId);
  await validateOptionalPublicTenantSlug(tenantId, publicTenantSlugFromQuery(req));
}

function respondPublicTenantAccessError(res: import('express').Response, e: unknown): boolean {
  if (e instanceof PublicTenantAccessError) {
    res.status(publicTenantAccessHttpStatus(e.code)).json({ error: e.message });
    return true;
  }
  return false;
}

const VALID_ORDER_TIME_SLOTS = new Set(['오전', '오후', '사이청소']);

/** 목록 연동용 접수 생성 시 주소 미수집 표시. 미제출 발주서 삭제 시 해당 접수는 삭제한다. */
const STANDALONE_ORDER_INQUIRY_ADDRESS_MARKER = '(발주서 링크 발급)';

function preferredDateYmdToKstNoon(ymdRaw: string | undefined): Date | null {
  const ymd = ymdRaw?.trim();
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = new Date(`${ymd}T12:00:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

type ForceMatchInquirySnapshot = {
  id: string;
  status: string;
  inquiryNumber: string | null;
  customerName: string;
  nickname: string | null;
  customerPhone: string;
  customerPhone2: string | null;
  address: string;
  addressDetail: string | null;
  areaPyeong: number | null;
  areaBasis: string | null;
  exclusiveAreaSqm: number | null;
  propertyType: string | null;
  roomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
  kitchenCount: number | null;
  preferredDate: Date | null;
  preferredTime: string | null;
  preferredTimeDetail: string | null;
  memo: string | null;
  buildingType: string | null;
  moveInDate: Date | null;
  moveInDateUndecided: boolean;
  specialNotes: string | null;
  serviceTotalAmount: number | null;
  serviceDepositAmount: number | null;
  serviceBalanceAmount: number | null;
  professionalOptionIds: Prisma.JsonValue | null;
};

/** JSON 본문에서 정수(원) 파싱 — 문자열·콤마 허용 */
function parseBodyInt(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  const n = parseInt(String(value).replace(/,/g, '').trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function parseBodyAreaFloat(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

/** 발급 시 선택 입력 — 둘 다 있을 때만 저장·고객 잠금 */
function parseOptionalIssueArea(body: {
  areaPyeong?: unknown;
  areaBasis?: unknown;
}): { areaPyeong: number | null; areaBasis: string | null } | { error: string } {
  const basisRaw = body.areaBasis != null ? String(body.areaBasis).trim() : '';
  const pyRaw = body.areaPyeong;
  const pyEmpty = pyRaw == null || (typeof pyRaw === 'string' && pyRaw.trim() === '');

  if (!basisRaw && pyEmpty) {
    return { areaPyeong: null, areaBasis: null };
  }
  if (basisRaw !== '공급' && basisRaw !== '전용') {
    return { error: '면적 기준은 공급 또는 전용으로 선택해주세요.' };
  }
  if (pyEmpty) {
    return { error: '면적 기준을 선택했으면 평수도 입력해주세요.' };
  }
  const n = parseBodyAreaFloat(pyRaw);
  if (n == null || n <= 0 || n > 100_000) {
    return { error: '평수는 양수 숫자로 입력해 주세요.' };
  }
  return { areaPyeong: n, areaBasis: basisRaw };
}

function isOrderFormAreaLocked(form: {
  areaBasis: string | null;
  areaPyeong: number | null;
}): boolean {
  const basis = form.areaBasis?.trim();
  if (basis !== '공급' && basis !== '전용') return false;
  return form.areaPyeong != null && Number.isFinite(form.areaPyeong) && form.areaPyeong > 0;
}

function parseGuideSectionsFromDb(raw: string | null | undefined): GuideSection[] {
  if (!raw?.trim()) return DEFAULT_GUIDE_SECTIONS;
  const t = raw.trim();
  if (t.startsWith('{')) {
    try {
      const p = JSON.parse(t) as { sections?: unknown };
      if (Array.isArray(p.sections) && p.sections.length > 0) {
        const out: GuideSection[] = [];
        for (const s of p.sections) {
          if (s && typeof s === 'object') {
            const title = String((s as { title?: unknown }).title ?? '').trim();
            const itemsRaw = (s as { items?: unknown }).items;
            const items = Array.isArray(itemsRaw)
              ? itemsRaw.map((x) => String(x).trim()).filter(Boolean)
              : [];
            if (title || items.length) out.push({ title: title || '안내', items });
          }
        }
        if (out.length) return out;
      }
    } catch {
      /* 레거시 본문 */
    }
  }
  const lines = t.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length) return [{ title: '안내', items: lines }];
  return DEFAULT_GUIDE_SECTIONS;
}

const profOptionOrderBy: Prisma.ProfessionalSpecialtyOptionOrderByWithRelationInput[] = [
  { parentId: 'asc' },
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
];

const profOptionSelectPublic = {
  id: true,
  parentId: true,
  isGroup: true,
  isActive: true,
  label: true,
  priceHint: true,
  priceAmount: true,
  emoji: true,
  color: true,
  sortOrder: true,
} as const;

const profOptionSelectListRow = {
  id: true,
  parentId: true,
  isGroup: true,
  label: true,
  priceHint: true,
  priceAmount: true,
  emoji: true,
  color: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
} as const;

/** 공개: 고객 안내사항 페이지(`/info`)용 — 인증 없음 */
router.get('/public-guide', async (req, res) => {
  try {
    const tenantId = await resolvePublicTenantIdFromRequest(req);
    const cfg = await getOrCreateOrderFormConfig(prisma, tenantId);
    const sections = parseGuideSectionsFromDb(cfg.infoContent);
    const infoLinkText =
      cfg.infoLinkText?.trim() || '고객 정보처리 동의 및 안내사항';
    res.json({ sections, infoLinkText });
  } catch (err) {
    console.error('public-guide error:', err);
    res.json({
      sections: DEFAULT_GUIDE_SECTIONS,
      infoLinkText: '고객 정보처리 동의 및 안내사항',
    });
  }
});

/** 공개: 고객 발주서 — 전문 시공 옵션 목록 (활성만, 정렬) */
router.get('/professional-options', async (req, res) => {
  try {
    const tenantId = await resolvePublicTenantIdFromRequest(req);
    const items = await prisma.professionalSpecialtyOption.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [{ parentId: null }, { parent: { isActive: true } }],
      },
      orderBy: profOptionOrderBy,
      select: profOptionSelectPublic,
    });
    res.json({ items });
  } catch (err) {
    console.error('professional-options list error:', err);
    res.status(500).json({ error: '전문 시공 옵션을 불러올 수 없습니다.' });
  }
});

/** 관리자/마케터: 전문 시공 옵션 전체 (비활성 포함) */
router.get('/professional-options/all', authMiddleware, adminOrMarketer, async (req, res) => {
  try {
    const user = (req as unknown as { user: AuthPayload }).user;
    const tenantId = await requireTenantIdFromAuth(res, user);
    if (!tenantId) return;
    const items = await prisma.professionalSpecialtyOption.findMany({
      where: { tenantId },
      orderBy: profOptionOrderBy,
      select: profOptionSelectListRow,
    });
    res.json({ items });
  } catch (err) {
    console.error('professional-options/all error:', err);
    res.status(500).json({ error: '전문 시공 옵션을 불러올 수 없습니다.' });
  }
});

/** 관리자/마케터: 전문 시공 옵션 추가 */
router.post('/professional-options', authMiddleware, adminOrMarketer, async (req, res) => {
  const body = req.body as {
    id?: string;
    label?: string;
    parentId?: string | null;
    isGroup?: boolean;
    priceHint?: string;
    priceAmount?: unknown;
    emoji?: string;
    color?: string;
    sortOrder?: number;
    isActive?: boolean;
  };
  const label = String(body.label ?? '').trim();
  if (!label) {
    res.status(400).json({ error: '항목명을 입력해주세요.' });
    return;
  }
  const color = normalizeHexColor(String(body.color ?? '#6b7280'));
  if (!color) {
    res.status(400).json({ error: '색상은 #RRGGBB 형식(예: #2563eb)으로 입력해주세요.' });
    return;
  }
  const parentId =
    body.parentId == null || body.parentId === '' ? null : String(body.parentId).trim() || null;
  const isGroupRoot = Boolean(body.isGroup);
  const priceHint = body.priceHint != null ? String(body.priceHint).trim() : '';
  const priceAmount = parseBodyInt(body.priceAmount);
  const emoji = body.emoji != null ? String(body.emoji).trim().slice(0, 8) : '';
  const sortOrder = body.sortOrder != null && Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
  const isActive = body.isActive !== false;
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const providedId = typeof body.id === 'string' ? body.id.trim() : '';
  const optionId = providedId || randomUUID();

  try {
    if (parentId) {
      const p = await prisma.professionalSpecialtyOption.findUnique({
        where: profOptionKey(tenantId, parentId),
      });
      if (!p) {
        res.status(400).json({ error: '상위 항목을 찾을 수 없습니다.' });
        return;
      }
      const parentDepth = await professionalOptionDepthFromRoot(prisma, tenantId, parentId);
      if (parentDepth > 1) {
        res.status(400).json({
          error: '하위는 최대 2단계까지입니다. (대분류 → 중간 항목 → 세부 금액)',
        });
        return;
      }
      if (!p.parentId && !p.isGroup) {
        await prisma.professionalSpecialtyOption.update({
          where: profOptionKey(tenantId, parentId),
          data: { isGroup: true },
        });
      }
    }

    const isGroup = parentId ? false : isGroupRoot;
    const finalPrice =
      parentId != null
        ? priceAmount != null && priceAmount >= 0
          ? priceAmount
          : null
        : isGroup
          ? null
          : priceAmount != null && priceAmount >= 0
            ? priceAmount
            : null;

    const created = await prisma.professionalSpecialtyOption.create({
      data: {
        tenantId,
        id: optionId,
        parentId,
        isGroup,
        label,
        priceHint: priceHint || null,
        priceAmount: finalPrice,
        emoji: emoji || null,
        color,
        sortOrder,
        isActive,
      },
    });
    res.json(created);
  } catch (err) {
    console.error('professional-options create error:', err);
    res.status(500).json({ error: '추가에 실패했습니다.' });
  }
});

/** 관리자/마케터: 전문 시공 옵션 수정 */
router.patch('/professional-options/:id', authMiddleware, adminOrMarketer, async (req, res) => {
  const { id } = req.params;
  const body = req.body as {
    label?: string;
    parentId?: string | null;
    isGroup?: boolean;
    priceHint?: string;
    priceAmount?: unknown;
    emoji?: string;
    color?: string;
    sortOrder?: number;
    isActive?: boolean;
  };
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const existing = await prisma.professionalSpecialtyOption.findUnique({
    where: profOptionKey(tenantId, id),
  });
  if (!existing) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }
  const data: Prisma.ProfessionalSpecialtyOptionUpdateInput = {};
  if (body.label !== undefined) {
    const l = String(body.label).trim();
    if (!l) {
      res.status(400).json({ error: '항목명을 입력해주세요.' });
      return;
    }
    data.label = l;
  }
  if (body.parentId !== undefined) {
    const pId =
      body.parentId == null || body.parentId === '' ? null : String(body.parentId).trim() || null;
    if (pId) {
      if (pId === id) {
        res.status(400).json({ error: '자기 자신을 상위로 둘 수 없습니다.' });
        return;
      }
      const p = await prisma.professionalSpecialtyOption.findUnique({
        where: profOptionKey(tenantId, pId),
      });
      if (!p) {
        res.status(400).json({ error: '상위 항목을 찾을 수 없습니다.' });
        return;
      }
      const parentDepth = await professionalOptionDepthFromRoot(prisma, tenantId, pId);
      if (parentDepth > 1) {
        res.status(400).json({
          error: '하위는 최대 2단계까지입니다. (대분류 → 중간 항목 → 세부 금액)',
        });
        return;
      }
      data.parent = { connect: profOptionKey(tenantId, pId) };
      data.isGroup = false;
    } else {
      data.parent = { disconnect: true };
    }
  }
  if (body.isGroup !== undefined && !existing.parentId) {
    data.isGroup = Boolean(body.isGroup);
  }
  if (body.priceHint !== undefined) data.priceHint = String(body.priceHint).trim();
  if (body.emoji !== undefined) data.emoji = String(body.emoji).trim().slice(0, 8);
  if (body.color !== undefined) {
    const c = normalizeHexColor(String(body.color));
    if (!c) {
      res.status(400).json({ error: '색상은 #RRGGBB 형식으로 입력해주세요.' });
      return;
    }
    data.color = c;
  }
  if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) {
    data.sortOrder = Number(body.sortOrder);
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.priceAmount !== undefined) {
    const n = parseBodyInt(body.priceAmount);
    if (n != null && n < 0) {
      res.status(400).json({ error: '가격은 0 이상이어야 합니다.' });
      return;
    }
    if (existing.parentId) {
      data.priceAmount = n != null && n >= 0 ? n : null;
    } else {
      const willBeGroup =
        'isGroup' in data && data.isGroup !== undefined
          ? Boolean(data.isGroup)
          : body.isGroup !== undefined
            ? Boolean(body.isGroup)
            : existing.isGroup;
      data.priceAmount = willBeGroup ? null : n != null && n >= 0 ? n : null;
    }
  }
  if (!existing.parentId) {
    const nextIsGroup =
      'isGroup' in data && data.isGroup !== undefined
        ? Boolean(data.isGroup)
        : body.isGroup !== undefined
          ? Boolean(body.isGroup)
          : existing.isGroup;
    if (nextIsGroup) {
      data.priceAmount = null;
    }
  }
  try {
    const updated = await prisma.professionalSpecialtyOption.update({
      where: profOptionKey(tenantId, id),
      data,
    });
    res.json(updated);
  } catch (err) {
    console.error('professional-options patch error:', err);
    res.status(500).json({ error: '수정에 실패했습니다.' });
  }
});

/** 관리자/마케터: 전문 시공 옵션 삭제 */
router.delete('/professional-options/:id', authMiddleware, adminOrMarketer, async (req, res) => {
  const { id } = req.params;
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  try {
    const row = await prisma.professionalSpecialtyOption.findUnique({
      where: profOptionKey(tenantId, id),
      select: { parentId: true },
    });
    const pId = row?.parentId;
    await prisma.professionalSpecialtyOption.delete({ where: profOptionKey(tenantId, id) });
    if (pId) {
      const remain = await prisma.professionalSpecialtyOption.count({
        where: { tenantId, parentId: pId },
      });
      if (remain === 0) {
        const parent = await prisma.professionalSpecialtyOption.findUnique({
          where: profOptionKey(tenantId, pId),
          select: { parentId: true, isGroup: true },
        });
        if (parent && !parent.parentId) {
          await prisma.professionalSpecialtyOption.update({
            where: profOptionKey(tenantId, pId),
            data: { isGroup: false },
          });
        }
      }
    }
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
  }
});

const orderFormCreatedBySelect = {
  select: { id: true, name: true, role: true },
} as const;

/** 편집기 왼쪽 iframe용 — 실제 `/order/:token` 과 동일 렌더. 목록에서는 숨김 */
export const DESIGNER_PREVIEW_ORDER_TOKEN = 'skct_designer_preview_v1';

/** 견적 설정·추가 옵션 반영해 미리보기 발주서 금액 동기화 (32평 기준) */
async function upsertDesignerPreviewOrderForm(createdById: string, tenantId: string) {
  const DEMO_PYEONG = 32;
  const ec = await getOrCreateEstimateConfig(prisma, tenantId);
  const pricePer = ec?.pricePerPyeong ?? 8000;
  const deposit = ec?.depositAmount ?? 20000;
  const extras = await prisma.estimateOption.aggregate({
    where: { tenantId, isActive: true },
    _sum: { extraAmount: true },
  });
  const extraSum = extras._sum.extraAmount ?? 0;
  const totalAmount = pricePer * DEMO_PYEONG + extraSum;
  const balanceAmount = Math.max(0, totalAmount - deposit);

  const existing = await prisma.orderForm.findUnique({
    where: { token: DESIGNER_PREVIEW_ORDER_TOKEN },
  });
  if (!existing) {
    return prisma.orderForm.create({
      data: {
        tenantId,
        token: DESIGNER_PREVIEW_ORDER_TOKEN,
        customerName: '미리보기(고객용)',
        customerPhone: '010-0000-0000',
        totalAmount,
        depositAmount: deposit,
        balanceAmount,
        createdById,
      },
    });
  }
  return prisma.orderForm.update({
    where: { token: DESIGNER_PREVIEW_ORDER_TOKEN },
    data: { totalAmount, depositAmount: deposit, balanceAmount },
  });
}

/** 관리자/마케터: 고객 발주서 편집 화면용 고정 미리보기 토큰 (없으면 생성, 호출 시 금액 동기화) */
router.get('/designer-preview-token', authMiddleware, adminOrMarketer, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const { userId } = user;
  try {
    const form = await upsertDesignerPreviewOrderForm(userId, tenantId);
    res.json({ token: form.token });
  } catch (e) {
    console.error('[designer-preview-token]', e);
    res.status(500).json({ error: '미리보기 발주서를 준비하지 못했습니다.' });
  }
});

/**
 * 발주서 목록 응답 상한 — 운영 DB 누적 시 전량 로드로 첫 페인트가 멈추는 것을 방지.
 * 더 많은 과거가 필요하면 필터(기간·고객명·발급자)로 좁힌다.
 */
/** 관리자/마케터: 발주서 목록 (발급일·담당·제출 상태 필터) */
router.get('/', authMiddleware, adminOrMarketer, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const q = req.query as Record<string, string | undefined>;
  const dateRange = createdAtRangeFromQuery({
    datePreset: q.datePreset,
    month: q.month,
    day: q.day,
  });
  const createdById =
    typeof q.createdById === 'string' && /^[0-9a-f-]{36}$/i.test(q.createdById.trim())
      ? q.createdById.trim()
      : undefined;
  const customerName = typeof q.customerName === 'string' ? q.customerName.trim() : '';
  const submitStatusRaw = typeof q.submitStatus === 'string' ? q.submitStatus.trim().toLowerCase() : 'all';
  const submitStatus =
    submitStatusRaw === 'pending' || submitStatusRaw === 'submitted' ? submitStatusRaw : 'all';

  const where: Prisma.OrderFormWhereInput = {
    tenantId,
    token: { not: DESIGNER_PREVIEW_ORDER_TOKEN },
  };
  if (dateRange) {
    where.createdAt = { gte: dateRange.gte, lte: dateRange.lte };
  }
  if (createdById) {
    where.createdById = createdById;
  }
  if (customerName) {
    where.customerName = { contains: customerName, mode: 'insensitive' };
  }
  if (submitStatus === 'pending') {
    where.submittedAt = null;
  } else if (submitStatus === 'submitted') {
    where.submittedAt = { not: null };
  }

  const parsedLimit = Number.parseInt(String(q.limit ?? '30'), 10);
  const parsedOffset = Number.parseInt(String(q.offset ?? '0'), 10);
  const take = Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, parsedLimit)) : 30;
  const skip = Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : 0;

  const [total, list, issuers] = await Promise.all([
    prisma.orderForm.count({ where }),
    prisma.orderForm.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        inquiries: { take: 1 },
        createdBy: orderFormCreatedBySelect,
      },
    }),
    prisma.user.findMany({
      where: { tenantId, isActive: true, role: { in: ['ADMIN', 'MARKETER'] } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    }),
  ]);

  const issuerOptions = issuers.map((u) => ({
    id: u.id,
    role: u.role,
    label:
      u.role === 'ADMIN'
        ? (u.name?.trim() ? `관리자 · ${u.name.trim()}` : `관리자 · ${u.email}`)
        : (u.name?.trim() || u.email || u.id),
  }));

  res.json({ items: list, issuers: issuerOptions, total });
});

/** 관리자/마케터: 고객 제출 원본 스냅샷(제출 시점 저장 JSON). 미제출이거나 레거시면 null */
router.get('/:id/customer-submission', authMiddleware, adminOrMarketer, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const rawId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  if (!/^[0-9a-f-]{36}$/i.test(rawId)) {
    res.status(400).json({ error: '유효한 발주서 id가 필요합니다.' });
    return;
  }
  const row = await prisma.orderForm.findFirst({
    where: { id: rawId, tenantId, token: { not: DESIGNER_PREVIEW_ORDER_TOKEN } },
    select: { customerSubmissionSnapshot: true, submittedAt: true },
  });
  if (!row) {
    res.status(404).json({ error: '발주서를 찾을 수 없습니다.' });
    return;
  }
  res.json({
    submittedAt: row.submittedAt,
    snapshot: row.customerSubmissionSnapshot ?? null,
  });
});

/** 관리자/마케터: 접수 강제 매칭 후보(고객 제출 완료 발주서) */
router.get('/force-match-candidates', authMiddleware, adminOrMarketer, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const q = req.query as Record<string, string | undefined>;
  const query = typeof q.query === 'string' ? q.query.trim() : '';
  const limitRaw = Number.parseInt(String(q.limit ?? '20'), 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(60, Math.max(1, limitRaw)) : 20;

  const where: Prisma.OrderFormWhereInput = {
    tenantId,
    submittedAt: { not: null },
  };
  if (query) {
    where.OR = [
      { customerName: { contains: query, mode: 'insensitive' } },
      { customerPhone: { contains: query } },
      { token: { contains: query } },
    ];
  }

  const forms = await prisma.orderForm.findMany({
    where,
    orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: {
      inquiries: {
        orderBy: { updatedAt: 'desc' },
        take: 1,
        select: { id: true, status: true, inquiryNumber: true, customerName: true, customerPhone: true },
      },
      createdBy: orderFormCreatedBySelect,
    },
  });

  const items = forms.map((form) => {
    const linked = form.inquiries[0] ?? null;
    return {
      id: form.id,
      token: form.token,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      totalAmount: form.totalAmount,
      depositAmount: form.depositAmount,
      balanceAmount: form.balanceAmount,
      submittedAt: form.submittedAt,
      createdAt: form.createdAt,
      createdBy: form.createdBy,
      linkedInquiry: linked
        ? {
            id: linked.id,
            status: linked.status,
            inquiryNumber: linked.inquiryNumber,
            customerName: linked.customerName,
            customerPhone: linked.customerPhone,
          }
        : null,
    };
  });

  res.json({ items });
});

/** 관리자/마케터: 발주서 발급 (고객명, 견적 입력 → 링크 생성). `pendingInquiryId` 있으면 대기 접수에 발주서 연결  
 * `POST /` 는 `POST /:id/delete` 보다 **먼저** 등록해야 루트 경로가 잘못 매칭되지 않습니다. */
router.post('/', authMiddleware, adminOrMarketer, async (req, res) => {
  const { userId, role, tenantId: authTenantId } = (req as unknown as { user: AuthPayload }).user;
  if (!authTenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const {
    customerName,
    customerPhone: customerPhoneRaw,
    totalAmount: totalRaw,
    depositAmount: depositRaw,
    balanceAmount: balanceRaw,
    optionNote,
    preferredDate,
    preferredTime,
    preferredTimeDetail,
    pendingInquiryId,
    areaPyeong: areaPyeongRaw,
    areaBasis: areaBasisRaw,
    templateId: templateIdRaw,
  } = req.body as {
    customerName: string;
    customerPhone?: string | null;
    totalAmount?: unknown;
    depositAmount?: unknown;
    balanceAmount?: unknown;
    optionNote?: string;
    preferredDate?: string;
    preferredTime?: string;
    preferredTimeDetail?: string;
    pendingInquiryId?: string;
    areaPyeong?: unknown;
    areaBasis?: unknown;
    templateId?: string;
  };
  const areaParsed = parseOptionalIssueArea({ areaPyeong: areaPyeongRaw, areaBasis: areaBasisRaw });
  if ('error' in areaParsed) {
    res.status(400).json({ error: areaParsed.error });
    return;
  }
  const { areaPyeong: issueAreaPyeong, areaBasis: issueAreaBasis } = areaParsed;
  const customerPhoneOpt =
    customerPhoneRaw != null && String(customerPhoneRaw).trim()
      ? String(customerPhoneRaw).trim()
      : null;
  if (!customerName?.trim()) {
    res.status(400).json({ error: '고객명을 입력해주세요.' });
    return;
  }
  const totalAmount = parseBodyInt(totalRaw);
  if (totalAmount == null || totalAmount < 0) {
    res.status(400).json({ error: '총 금액을 입력해주세요.' });
    return;
  }
  const depositParsed = parseBodyInt(depositRaw);
  const deposit = depositParsed != null && depositParsed >= 0 ? depositParsed : 20000;
  const balanceParsed = parseBodyInt(balanceRaw);
  const balance =
    balanceParsed != null && balanceParsed >= 0 ? balanceParsed : Math.max(0, totalAmount - deposit);
  const token = randomBytes(12).toString('hex');

  const resolvedTemplate = await resolveIssueTemplate(prisma, authTenantId, templateIdRaw);
  if (resolvedTemplate === 'invalid') {
    res.status(400).json({ error: '선택한 발주서 양식을 찾을 수 없거나 발행되지 않았습니다.' });
    return;
  }
  const templateData = resolvedTemplate
    ? { templateId: resolvedTemplate.id, templateVersion: resolvedTemplate.version }
    : {};

  const pid = typeof pendingInquiryId === 'string' ? pendingInquiryId.trim() : '';
  try {
    if (pid) {
      const pending = await prisma.inquiry.findFirst({
        where: { id: pid, tenantId: authTenantId },
        select: { id: true, status: true, orderFormId: true, createdById: true },
      });
      if (!pending) {
        res.status(404).json({ error: '연결할 접수를 찾을 수 없습니다.' });
        return;
      }
      if (pending.status !== 'PENDING' && pending.status !== 'DEPOSIT_COMPLETED') {
        res.status(400).json({
          error: '대기·입금완료(발주서 미제출) 접수만 연결할 수 있습니다.',
        });
        return;
      }
      if (pending.orderFormId) {
        res.status(400).json({ error: '이미 발주서가 연결된 접수입니다.' });
        return;
      }
      if (role === 'MARKETER' && pending.createdById !== userId) {
        res.status(403).json({ error: '본인이 등록한 대기 접수만 연결할 수 있습니다.' });
        return;
      }

      const orderForm = await prisma.$transaction(async (tx) => {
        const created = await tx.orderForm.create({
          data: {
            tenantId: authTenantId,
            token,
            customerName: customerName.trim(),
            customerPhone: customerPhoneOpt,
            totalAmount,
            depositAmount: deposit,
            balanceAmount: balance,
            optionNote: optionNote?.trim() || null,
            preferredDate: preferredDate?.trim() || null,
            preferredTime: preferredTime?.trim() || null,
            preferredTimeDetail: preferredTimeDetail?.trim() || null,
            areaPyeong: issueAreaPyeong,
            areaBasis: issueAreaBasis,
            createdById: userId,
            ...templateData,
          },
        });
        await tx.inquiry.update({
          where: { id: pid },
          data: {
            orderFormId: created.id,
            status: 'ORDER_FORM_PENDING',
            source: '발주서',
            ...(issueAreaPyeong != null && issueAreaBasis
              ? { areaPyeong: issueAreaPyeong, areaBasis: issueAreaBasis, exclusiveAreaSqm: null }
              : {}),
          },
        });
        return tx.orderForm.findUniqueOrThrow({
          where: { id: created.id },
          include: {
            inquiries: { take: 1 },
            createdBy: orderFormCreatedBySelect,
          },
        });
      });
      const assigns = await prisma.assignment.findMany({
        where: { inquiryId: pid },
        select: { teamLeaderId: true },
      });
      const leaderIds = [...new Set(assigns.map((a) => a.teamLeaderId))];
      if (leaderIds.length > 0) {
        notifyInboxRefresh(leaderIds);
      }
      res.json(orderForm);
      return;
    }

    const prefDateStr = preferredDate?.trim() || null;
    const memoParts: string[] = [];
    if (optionNote?.trim()) memoParts.push(optionNote.trim());
    if (preferredTime?.trim()) memoParts.push(`희망시간: ${preferredTime.trim()}`);
    if (preferredTimeDetail?.trim()) memoParts.push(`시간 상세: ${preferredTimeDetail.trim()}`);
    const inquiryMemo = memoParts.length ? memoParts.join('\n') : null;
    const inquiryPreferredDate = preferredDateYmdToKstNoon(prefDateStr ?? undefined);

    const orderForm = await prisma.$transaction(async (tx) => {
      const created = await tx.orderForm.create({
        data: {
          tenantId: authTenantId,
          token,
          customerName: customerName.trim(),
          customerPhone: customerPhoneOpt,
          totalAmount,
          depositAmount: deposit,
          balanceAmount: balance,
          optionNote: optionNote?.trim() || null,
          preferredDate: prefDateStr,
          preferredTime: preferredTime?.trim() || null,
          preferredTimeDetail: preferredTimeDetail?.trim() || null,
          areaPyeong: issueAreaPyeong,
          areaBasis: issueAreaBasis,
          createdById: userId,
          ...templateData,
        },
      });
      await tx.inquiry.create({
        data: {
          tenantId: authTenantId,
          customerName: customerName.trim(),
          customerPhone: customerPhoneOpt ?? '',
          address: STANDALONE_ORDER_INQUIRY_ADDRESS_MARKER,
          preferredDate: inquiryPreferredDate,
          preferredTime: preferredTime?.trim() || null,
          preferredTimeDetail: preferredTimeDetail?.trim() || null,
          memo: inquiryMemo,
          status: 'ORDER_FORM_PENDING',
          source: '발주서',
          orderFormId: created.id,
          createdById: userId,
          serviceTotalAmount: totalAmount,
          serviceDepositAmount: deposit,
          serviceBalanceAmount: balance,
          areaPyeong: issueAreaPyeong,
          areaBasis: issueAreaBasis,
        },
      });
      return tx.orderForm.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          inquiries: { take: 1 },
          createdBy: orderFormCreatedBySelect,
        },
      });
    });
    res.json(orderForm);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2022') {
      res.status(503).json({
        error:
          'DB에 최신 컬럼이 반영되지 않았습니다. 배포 서버에서 `npx prisma migrate deploy` 실행 후 재시작해 주세요. (order_forms.customer_phone)',
      });
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (/customer_phone|column .* does not exist/i.test(msg)) {
      res.status(503).json({
        error:
          'DB에 최신 컬럼이 반영되지 않았습니다. 배포 서버에서 `npx prisma migrate deploy` 실행 후 재시작해 주세요. (order_forms.customer_phone)',
      });
      return;
    }
    console.error('[orderforms POST /]', e);
    res.status(500).json({
      error: process.env.NODE_ENV !== 'production' ? msg : '발주서 발급에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    });
  }
});

/** 관리자/마케터: 제출 완료 발주서를 기존 접수에 강제 매칭하고 접수 정보를 덮어쓴다. */
router.post('/:id/force-match-inquiry', authMiddleware, adminOrMarketer, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const { userId, role } = user;
  const { id: orderFormId } = req.params;
  const body = req.body as { inquiryId?: string };
  const inquiryId = typeof body.inquiryId === 'string' ? body.inquiryId.trim() : '';
  if (!inquiryId) {
    res.status(400).json({ error: '연결할 접수 ID가 필요합니다.' });
    return;
  }

  const [form, targetInquiry] = await Promise.all([
    prisma.orderForm.findFirst({
      where: { id: orderFormId, tenantId },
      select: {
        id: true,
        token: true,
        customerName: true,
        customerPhone: true,
        totalAmount: true,
        depositAmount: true,
        balanceAmount: true,
        submittedAt: true,
        createdById: true,
      },
    }),
    prisma.inquiry.findFirst({
      where: { id: inquiryId, tenantId },
      select: {
        id: true,
        customerPhone: true,
        orderFormId: true,
        status: true,
        createdById: true,
        assignments: { select: { teamLeaderId: true } },
      },
    }),
  ]);

  if (!form) {
    res.status(404).json({ error: '발주서를 찾을 수 없습니다.' });
    return;
  }
  if (!form.submittedAt) {
    res.status(400).json({ error: '고객이 제출한 발주서만 강제 매칭할 수 있습니다.' });
    return;
  }
  if (!targetInquiry) {
    res.status(404).json({ error: '연결할 접수를 찾을 수 없습니다.' });
    return;
  }
  if (role === 'MARKETER' && targetInquiry.createdById !== userId) {
    res.status(403).json({ error: '본인이 등록한 접수에만 강제 매칭할 수 있습니다.' });
    return;
  }
  if (targetInquiry.orderFormId && targetInquiry.orderFormId !== form.id) {
    res.status(400).json({ error: '이미 다른 발주서가 연결된 접수입니다.' });
    return;
  }

  const sourceInquiry = await prisma.inquiry.findFirst({
    where: { orderFormId: form.id },
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true,
      status: true,
      inquiryNumber: true,
      customerName: true,
      nickname: true,
      customerPhone: true,
      customerPhone2: true,
      address: true,
      addressDetail: true,
      areaPyeong: true,
      areaBasis: true,
      exclusiveAreaSqm: true,
      propertyType: true,
      roomCount: true,
      bathroomCount: true,
      balconyCount: true,
      kitchenCount: true,
      preferredDate: true,
      preferredTime: true,
      preferredTimeDetail: true,
      memo: true,
      buildingType: true,
      moveInDate: true,
      moveInDateUndecided: true,
      specialNotes: true,
      serviceTotalAmount: true,
      serviceDepositAmount: true,
      serviceBalanceAmount: true,
      professionalOptionIds: true,
    },
  });

  const source = sourceInquiry as ForceMatchInquirySnapshot | null;
  const targetPatched = await prisma.$transaction(async (tx) => {
    const data: Prisma.InquiryUpdateInput = {
      orderForm: { connect: { id: form.id } },
      status: 'RECEIVED',
      ...(form.createdById ? { createdBy: { connect: { id: form.createdById } } } : {}),
      serviceTotalAmount: source?.serviceTotalAmount ?? form.totalAmount,
      serviceDepositAmount: source?.serviceDepositAmount ?? form.depositAmount,
      serviceBalanceAmount: source?.serviceBalanceAmount ?? form.balanceAmount,
    };
    if (source) {
      data.customerName = source.customerName || form.customerName;
      data.nickname = source.nickname;
      data.customerPhone = source.customerPhone || form.customerPhone || targetInquiry.customerPhone;
      data.customerPhone2 = source.customerPhone2;
      data.address = source.address;
      data.addressDetail = source.addressDetail;
      data.areaPyeong = source.areaPyeong;
      data.areaBasis = source.areaBasis;
      data.exclusiveAreaSqm = source.exclusiveAreaSqm;
      data.propertyType = source.propertyType;
      data.roomCount = source.roomCount;
      data.bathroomCount = source.bathroomCount;
      data.balconyCount = source.balconyCount;
      data.kitchenCount = source.kitchenCount;
      data.preferredDate = source.preferredDate;
      data.preferredTime = source.preferredTime;
      data.preferredTimeDetail = source.preferredTimeDetail;
      data.buildingType = source.buildingType;
      data.moveInDate = source.moveInDate;
      data.moveInDateUndecided = source.moveInDateUndecided;
      data.specialNotes = source.specialNotes;
      data.professionalOptionIds =
        source.professionalOptionIds == null ? Prisma.JsonNull : source.professionalOptionIds;
    } else {
      data.customerName = form.customerName;
      if (form.customerPhone) data.customerPhone = form.customerPhone;
    }

    const updated = await tx.inquiry.update({
      where: { id: inquiryId },
      data,
      select: { id: true, status: true, orderFormId: true },
    });
    return updated;
  });

  const teamLeaderIds = [...new Set(targetInquiry.assignments.map((a) => a.teamLeaderId))];
  if (teamLeaderIds.length > 0) {
    notifyInboxRefresh(teamLeaderIds);
  }

  res.json({
    ok: true,
    inquiry: targetPatched,
    sourceInquiryId: sourceInquiry?.id ?? null,
    sourceInquiryStatus: sourceInquiry?.status ?? null,
  });
});

/**
 * 관리자/마케터: 발주서 삭제 (본인 비밀번호 확인 필수).
 * - 미제출: 발주서만 삭제. 일반 발급으로 자동 생성된 플레이스홀더 접수(주소 `(발주서 링크 발급)`)는 함께 삭제.
 *   그 외 연결 접수는 orderFormId 만 해제하고 상태 복귀.
 * - 제출 완료: 발주서로 생성된 접수(Inquiry)도 함께 삭제된다. 복구 불가.
 *   (InquiryCleaningPhoto·Assignment 는 FK Cascade, InquiryChangeLog·CsReport 는 inquiryId SetNull)
 */
router.post('/:id/delete', authMiddleware, adminOrMarketer, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const { userId, role } = user;
  const { id } = req.params;
  const body = req.body as { password?: string };
  const password = body.password != null ? String(body.password).trim() : '';
  if (!password) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
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

  const form = await prisma.orderForm.findFirst({
    where: { id, tenantId },
    select: { id: true, createdById: true, submittedAt: true },
  });
  if (!form) {
    res.status(404).json({ error: '발주서를 찾을 수 없습니다.' });
    return;
  }
  if (role === 'MARKETER' && form.createdById !== userId) {
    res.status(403).json({ error: '본인이 발급한 발주서만 삭제할 수 있습니다.' });
    return;
  }
  const isSubmitted = Boolean(form.submittedAt);
  const linkedInquiriesBeforeDelete = await prisma.inquiry.findMany({
    where: { orderFormId: id },
    select: {
      id: true,
      assignments: { select: { teamLeaderId: true } },
    },
  });
  const teamLeaderIdsToRefresh = [
    ...new Set(
      linkedInquiriesBeforeDelete
        .flatMap((i) => i.assignments.map((a) => a.teamLeaderId))
        .filter(Boolean)
    ),
  ];

  await prisma.$transaction(async (tx) => {
    const fullForm = await tx.orderForm.findUnique({
      where: { id },
      select: {
        id: true,
        customerName: true,
        totalAmount: true,
        createdById: true,
        submittedAt: true,
        createdAt: true,
      },
    });
    if (!fullForm) {
      throw new Error('order_form_not_found');
    }
    await tx.orderFormDeleteLog.create({
      data: {
        orderFormId: fullForm.id,
        actorId: userId,
        actorRole: role,
        createdById: fullForm.createdById,
        customerName: fullForm.customerName,
        totalAmount: fullForm.totalAmount,
        submittedAt: fullForm.submittedAt,
        orderFormCreatedAt: fullForm.createdAt,
      },
    });
    if (isSubmitted) {
      await tx.inquiry.deleteMany({ where: { orderFormId: id } });
    } else {
      const linked = await tx.inquiry.findMany({
        where: { orderFormId: id },
        select: { id: true, status: true, inquiryNumber: true, address: true },
      });
      for (const row of linked) {
        if (row.status === 'ORDER_FORM_PENDING') {
          const standaloneShell =
            row.inquiryNumber == null && row.address === STANDALONE_ORDER_INQUIRY_ADDRESS_MARKER;
          if (standaloneShell) {
            await tx.inquiry.delete({ where: { id: row.id } });
          } else {
            await tx.inquiry.update({
              where: { id: row.id },
              data: {
                orderFormId: null,
                status: row.inquiryNumber != null ? 'DEPOSIT_COMPLETED' : 'PENDING',
              },
            });
          }
        } else {
          await tx.inquiry.update({
            where: { id: row.id },
            data: { orderFormId: null },
          });
        }
      }
    }
    await tx.orderForm.delete({ where: { id } });
  });
  if (teamLeaderIdsToRefresh.length > 0) {
    notifyInboxRefresh(teamLeaderIdsToRefresh);
  }
  res.json({ ok: true });
});

const DEFAULT_FORM_CONFIG = {
  id: '',
  ...ORDER_FORM_CONFIG_DEFAULTS,
  infoContent: null as string | null,
  updatedAt: new Date().toISOString(),
};

type FormConfigRow = {
  formTitle: string;
  priceLabel: string | null;
  reviewEventText: string | null;
  footerNotice1: string | null;
  footerNotice2: string | null;
  infoContent: string | null;
  infoLinkText: string | null;
  submitSuccessTitle: string | null;
  submitSuccessBody: string | null;
  timeSlotAckTitle?: string | null;
  timeSlotAckBody?: string | null;
  timeSlotAckConsentHint?: string | null;
};

/** 고객용: DB에 ""·null이 있어도 기본 문구로 내려줌 (클라이언트 ?? 만으로는 빈 문자열이 남음) */
function resolvedPublicFormConfig(row: FormConfigRow) {
  const d = DEFAULT_FORM_CONFIG;
  const line = (v: string | null | undefined, def: string) => {
    const t = v != null ? String(v).trim() : '';
    return t || def;
  };
  const infoTrimmed = row.infoContent != null ? String(row.infoContent).trim() : '';
  return {
    formTitle: line(row.formTitle, d.formTitle),
    priceLabel: line(row.priceLabel, d.priceLabel),
    reviewEventText: line(row.reviewEventText, d.reviewEventText),
    footerNotice1: line(row.footerNotice1, d.footerNotice1),
    footerNotice2: line(row.footerNotice2, d.footerNotice2),
    infoContent: infoTrimmed || null,
    infoLinkText: line(row.infoLinkText, d.infoLinkText),
    submitSuccessTitle: line(row.submitSuccessTitle, d.submitSuccessTitle),
    submitSuccessBody: line(row.submitSuccessBody, d.submitSuccessBody),
    timeSlotAckTitle: line(row.timeSlotAckTitle, d.timeSlotAckTitle),
    timeSlotAckBody: line(row.timeSlotAckBody, d.timeSlotAckBody),
    timeSlotAckConsentHint: line(row.timeSlotAckConsentHint, d.timeSlotAckConsentHint),
  };
}

/** 관리자/마케터: 폼 메시지 설정 조회 (by-token보다 먼저 선언) */
router.get('/form-config', authMiddleware, adminOrMarketer, async (req, res) => {
  try {
    const user = (req as unknown as { user: AuthPayload }).user;
    const tenantId = await requireTenantIdFromAuth(res, user);
    if (!tenantId) return;
    const config = await getOrCreateOrderFormConfig(prisma, tenantId);
    res.json(config);
  } catch (err) {
    console.error('form-config get error:', err);
    res.json(DEFAULT_FORM_CONFIG);
  }
});

/** 관리자: 폼 메시지 설정 수정 */
router.put('/form-config', authMiddleware, adminOnly, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  try {
    const user = (req as unknown as { user: AuthPayload }).user;
    const tenantId = await requireTenantIdFromAuth(res, user);
    if (!tenantId) return;
    await getOrCreateOrderFormConfig(prisma, tenantId);
    const updated = await prisma.orderFormConfig.update({
      where: { tenantId },
      data: {
        ...(body.formTitle != null && { formTitle: String(body.formTitle) }),
        ...(body.priceLabel != null && { priceLabel: body.priceLabel ? String(body.priceLabel) : null }),
        ...(body.reviewEventText != null && { reviewEventText: body.reviewEventText ? String(body.reviewEventText) : null }),
        ...(body.footerNotice1 != null && { footerNotice1: body.footerNotice1 ? String(body.footerNotice1) : null }),
        ...(body.footerNotice2 != null && { footerNotice2: body.footerNotice2 ? String(body.footerNotice2) : null }),
        ...(body.infoContent != null && { infoContent: body.infoContent ? String(body.infoContent) : null }),
        ...(body.infoLinkText != null && { infoLinkText: body.infoLinkText ? String(body.infoLinkText) : null }),
        ...(body.submitSuccessTitle != null && { submitSuccessTitle: body.submitSuccessTitle ? String(body.submitSuccessTitle) : null }),
        ...(body.submitSuccessBody != null && { submitSuccessBody: body.submitSuccessBody ? String(body.submitSuccessBody) : null }),
        ...(body.timeSlotAckTitle != null && {
          timeSlotAckTitle: body.timeSlotAckTitle ? String(body.timeSlotAckTitle) : null,
        }),
        ...(body.timeSlotAckBody != null && {
          timeSlotAckBody: body.timeSlotAckBody ? String(body.timeSlotAckBody) : null,
        }),
        ...(body.timeSlotAckConsentHint != null && {
          timeSlotAckConsentHint: body.timeSlotAckConsentHint ? String(body.timeSlotAckConsentHint) : null,
        }),
      },
    });
    res.json(updated);
  } catch (err) {
    console.error('form-config put error:', err);
    res.status(500).json({
      error: '폼 메시지 저장에 실패했습니다.',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

/** 공개: 토큰으로 발주서 조회 (인증 불필요) */
router.get('/by-token/:token', async (req, res) => {
  const { token } = req.params;
  const form = await prisma.orderForm.findUnique({
    where: { token },
    include: {
      inquiries: {
        where: { status: { in: ['PENDING', 'DEPOSIT_COMPLETED', 'ORDER_FORM_PENDING'] } },
        take: 1,
      },
    },
  });
  if (!form) {
    res.status(404).json({ error: '발주서를 찾을 수 없습니다.' });
    return;
  }
  try {
    await assertPublicOrderFormAccess(form.tenantId, req);
  } catch (e) {
    if (respondPublicTenantAccessError(res, e)) return;
    throw e;
  }
  if (form.submittedAt) {
    const linkedInquiry = await prisma.inquiry.findFirst({
      where: { orderFormId: form.id },
      orderBy: { createdAt: 'desc' },
      select: { inquiryNumber: true },
    });
    const formConfig = await getOrCreateOrderFormConfig(prisma, form.tenantId);
    res.json({
      id: form.id,
      token: form.token,
      customerName: form.customerName,
      submittedAt: form.submittedAt.toISOString(),
      inquiryNumber: linkedInquiry?.inquiryNumber ?? null,
      customerSubmissionSnapshot: form.customerSubmissionSnapshot ?? null,
      formConfig: resolvedPublicFormConfig(formConfig),
    });
    return;
  }
  try {
    await seedProfessionalDefaultsForTenant(prisma, form.tenantId);
  } catch (err) {
    console.error('by-token ensure professional defaults:', err);
  }

  const pendingRow = form.inquiries[0];
  const pendingInquiry = pendingRow
    ? {
        customerName: pendingRow.customerName,
        customerPhone: pendingRow.customerPhone,
        customerPhone2: pendingRow.customerPhone2,
        address: pendingRow.address,
        addressDetail: pendingRow.addressDetail,
        areaPyeong: pendingRow.areaPyeong,
        areaBasis: pendingRow.areaBasis,
        exclusiveAreaSqm: pendingRow.exclusiveAreaSqm ?? null,
        propertyType: pendingRow.propertyType,
        roomCount: pendingRow.roomCount,
        bathroomCount: pendingRow.bathroomCount,
        balconyCount: pendingRow.balconyCount,
        kitchenCount: pendingRow.kitchenCount,
        preferredDate: pendingRow.preferredDate
          ? pendingRow.preferredDate.toISOString().slice(0, 10)
          : null,
        preferredTime: pendingRow.preferredTime,
        preferredTimeDetail: pendingRow.preferredTimeDetail,
        buildingType: pendingRow.buildingType,
        moveInDate: pendingRow.moveInDate ? pendingRow.moveInDate.toISOString().slice(0, 10) : null,
        moveInDateUndecided: pendingRow.moveInDateUndecided,
        memo: pendingRow.memo,
      }
    : null;

  const [options, professionalOptions] = await Promise.all([
    prisma.estimateOption.findMany({
      where: { tenantId: form.tenantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.professionalSpecialtyOption.findMany({
      where: {
        tenantId: form.tenantId,
        isActive: true,
        OR: [{ parentId: null }, { parent: { isActive: true } }],
      },
      orderBy: profOptionOrderBy,
      select: profOptionSelectPublic,
    }),
  ]);
  const formConfig = await getOrCreateOrderFormConfig(prisma, form.tenantId);
  const template = await getPublicTemplateForForm(prisma, form.tenantId, form.templateId);
  res.json({
    id: form.id,
    token: form.token,
    customerName: form.customerName,
    customerPhone: form.customerPhone,
    totalAmount: form.totalAmount,
    depositAmount: form.depositAmount,
    balanceAmount: form.balanceAmount,
    optionNote: form.optionNote,
    preferredDate: form.preferredDate,
    preferredTime: form.preferredTime,
    preferredTimeDetail: form.preferredTimeDetail,
    areaPyeong: form.areaPyeong,
    areaBasis: form.areaBasis,
    options: options.map((o) => ({ name: o.name, extraAmount: o.extraAmount })),
    professionalOptions,
    formConfig: resolvedPublicFormConfig(formConfig),
    template,
    customAnswers: (form.customerAnswers as Record<string, unknown> | null) ?? null,
    /** 미제출 발주서에 고객이 이어 쓰는 특이사항(접수 `specialNotes`와 별도) */
    draftCustomerSpecialNotes: form.customerSpecialNotes,
    pendingInquiry,
  });
});

/** 공개: 발주서 제출 (고객이 작성 후 제출 → 문의로 등록) */
router.post('/submit/:token', async (req, res) => {
  const { token } = req.params;
  const body = req.body as {
    customerName: string;
    address: string;
    addressDetail?: string;
    customerPhone: string;
    customerPhone2: string;
    /** 공급면적(분양평수)일 때만 필수 */
    areaPyeong?: number | string | null;
    areaBasis: string;
    exclusiveAreaSqm?: number | string | null;
    propertyType: string;
    preferredDate: string;
    preferredTime: string;
    preferredTimeDetail?: string | null;
    roomCount?: number;
    balconyCount?: number;
    bathroomCount?: number;
    kitchenCount?: number;
    buildingType: string;
    moveInDate?: string;
    /** 거주 외일 때 날짜 대신 미정 선택 */
    moveInDateUndecided?: boolean | string;
    specialNotes?: string;
    professionalOptionIds?: unknown;
    answers?: unknown;
  };

  const form = await prisma.orderForm.findUnique({ where: { token } });
  if (!form) {
    res.status(404).json({ error: '발주서를 찾을 수 없습니다.' });
    return;
  }
  try {
    await assertPublicOrderFormAccess(form.tenantId, req);
  } catch (e) {
    if (respondPublicTenantAccessError(res, e)) return;
    throw e;
  }
  const submitTenantId = form.tenantId;
  const rawIds = parseProfessionalOptionIdsRaw(body.professionalOptionIds);
  const professionalIds = await filterActiveProfessionalOptionIds(prisma, submitTenantId, rawIds);
  const customerSpecialNotes =
    body.specialNotes != null && String(body.specialNotes).trim()
      ? String(body.specialNotes).trim()
      : null;
  if (form.submittedAt) {
    res.status(410).json({ error: '이미 제출된 발주서입니다.' });
    return;
  }

  if (!body.customerPhone2 || !String(body.customerPhone2).trim()) {
    res.status(400).json({ error: '보조 전화번호를 입력해주세요.' });
    return;
  }

  const adminAreaLocked = isOrderFormAreaLocked(form);
  let areaBasisNorm: string;
  let areaPyeongOut: number | null;
  let exclusiveAreaSqm: number | null = null;

  if (adminAreaLocked) {
    areaBasisNorm = String(form.areaBasis).trim();
    areaPyeongOut = form.areaPyeong!;
  } else {
    areaBasisNorm = String(body.areaBasis || '').trim();
    if (areaBasisNorm !== '공급' && areaBasisNorm !== '전용') {
      res.status(400).json({ error: '면적 기준으로 공급면적 또는 전용면적을 선택해주세요.' });
      return;
    }
    if (areaBasisNorm === '공급') {
      const rawPy = body.areaPyeong;
      if (rawPy == null || (typeof rawPy === 'string' && rawPy.trim() === '')) {
        res.status(400).json({ error: '공급면적(분양평수)을 평 단위로 입력해 주세요.' });
        return;
      }
      const n =
        typeof rawPy === 'number'
          ? rawPy
          : Number(String(rawPy).replace(/,/g, '').trim());
      if (!Number.isFinite(n) || n <= 0 || n > 100_000) {
        res.status(400).json({ error: '분양평수(평)는 양수 숫자로 입력해 주세요.' });
        return;
      }
      areaPyeongOut = n;
    } else {
      const rawPy = body.areaPyeong;
      if (rawPy == null || (typeof rawPy === 'string' && rawPy.trim() === '')) {
        res.status(400).json({ error: '전용면적(실제 내 집 공간)을 평 단위로 입력해 주세요.' });
        return;
      }
      const n =
        typeof rawPy === 'number'
          ? rawPy
          : Number(String(rawPy).replace(/,/g, '').trim());
      if (!Number.isFinite(n) || n <= 0 || n > 100_000) {
        res.status(400).json({ error: '전용면적(평)은 양수 숫자로 입력해 주세요.' });
        return;
      }
      areaPyeongOut = n;
      exclusiveAreaSqm = null;
    }
  }

  const propertyTypeNorm = String(body.propertyType || '').trim();
  if (!propertyTypeNorm) {
    res.status(400).json({ error: '아파트·오피스텔 등 건축물 유형을 선택해주세요.' });
    return;
  }

  // 관리자가 발급 시 날짜를 넣었으면 그 날짜는 고객이 바꿀 수 없음(본문 무시). 미지정이면 고객 입력 사용.
  const adminDateLocked = Boolean(form.preferredDate && String(form.preferredDate).trim());
  let useDateStr: string;
  let useTimeStr: string;
  if (adminDateLocked) {
    useDateStr = String(form.preferredDate).trim();
    useTimeStr =
      (form.preferredTime && String(form.preferredTime).trim()) ||
      (body.preferredTime && String(body.preferredTime).trim()) ||
      '';
  } else {
    useDateStr = (body.preferredDate && String(body.preferredDate).trim()) || '';
    useTimeStr =
      (body.preferredTime && String(body.preferredTime).trim()) ||
      (form.preferredTime && String(form.preferredTime).trim()) ||
      '';
  }
  if (!useDateStr || !useTimeStr) {
    res.status(400).json({ error: '청소 날짜와 시간을 입력해주세요.' });
    return;
  }
  if (!VALID_ORDER_TIME_SLOTS.has(useTimeStr)) {
    res.status(400).json({ error: '시간대를 선택해주세요.' });
    return;
  }

  const adminDetailLocked = Boolean(
    form.preferredTimeDetail && String(form.preferredTimeDetail).trim()
  );
  const useDetailStr = adminDetailLocked
    ? String(form.preferredTimeDetail).trim()
    : body.preferredTimeDetail != null && String(body.preferredTimeDetail).trim()
      ? String(body.preferredTimeDetail).trim()
      : null;

  if (
    !adminDetailLocked &&
    useDetailStr &&
    !isAllowedPreferredTimeDetail(useTimeStr, useDetailStr)
  ) {
    res.status(400).json({
      error: '구체적 시각을 해당 시간대에서 허용되는 범위로 선택해 주세요.',
    });
    return;
  }

  const preferredDate = new Date(useDateStr + 'T12:00:00');

  const RESIDING_BT = '거주(짐이있는상태)';
  const buildingTypeTrim =
    body.buildingType != null && String(body.buildingType).trim()
      ? String(body.buildingType).trim()
      : '';
  const moveInUndecidedRaw = body.moveInDateUndecided;
  const moveInUndecided =
    moveInUndecidedRaw === true ||
    moveInUndecidedRaw === 'true' ||
    String(moveInUndecidedRaw ?? '') === '1';

  let moveInDateStr =
    body.moveInDate != null && String(body.moveInDate).trim()
      ? String(body.moveInDate).trim()
      : null;

  if (moveInUndecided) {
    moveInDateStr = null;
  } else if (moveInDateStr && !/^\d{4}-\d{2}-\d{2}$/.test(moveInDateStr)) {
    res.status(400).json({ error: '이사 예정일 형식이 올바르지 않습니다.' });
    return;
  }

  if (moveInDateStr) {
    const todayYmd = kstTodayYmd();
    if (moveInDateStr < todayYmd) {
      res.status(400).json({ error: '이사 예정일은 오늘(한국 기준) 이후 날짜만 선택할 수 있습니다.' });
      return;
    }
  }

  if (buildingTypeTrim && buildingTypeTrim !== RESIDING_BT) {
    if (!moveInUndecided && !moveInDateStr) {
      res.status(400).json({
        error: '신축·구축·인테리어 선택 시 이사 예정일을 입력하거나 「미정」을 선택해 주세요.',
      });
      return;
    }
  }

  const moveInDate = moveInDateStr ? new Date(moveInDateStr + 'T12:00:00') : null;

  const profLabelRows =
    professionalIds.length > 0
      ? await prisma.professionalSpecialtyOption.findMany({
          where: { tenantId: submitTenantId, id: { in: professionalIds } },
          select: { id: true, label: true },
        })
      : [];
  const profLabelById = new Map(profLabelRows.map((r) => [r.id, r.label]));
  const professionalOptionLabels = professionalIds.map((id) => profLabelById.get(id) ?? id);

  // 동적 템플릿 추가 항목 — 답변 정규화 + 라벨 부여(스냅샷 보존, 템플릿 변경에 안전)
  const submitTemplate = await getPublicTemplateForForm(prisma, submitTenantId, form.templateId);
  const customAnswers = submitTemplate
    ? sanitizeCustomAnswers(body.answers, submitTemplate.customFields)
    : {};
  const customAnswersData =
    Object.keys(customAnswers).length > 0
      ? { customerAnswers: customAnswers as Prisma.InputJsonValue }
      : {};
  const templateAnswers: Prisma.InputJsonValue[] = submitTemplate
    ? submitTemplate.customFields
        .filter((cf) => customAnswers[cf.fieldKey] != null)
        .map((cf) => ({
          fieldKey: cf.fieldKey,
          label: cf.label,
          value: customAnswers[cf.fieldKey] as Prisma.InputJsonValue,
        }))
    : [];

  const customerSubmissionSnapshot = {
    version: 1,
    capturedAt: new Date().toISOString(),
    template: submitTemplate
      ? {
          id: submitTemplate.id,
          title: submitTemplate.title,
          icon: submitTemplate.icon,
          version: form.templateVersion ?? null,
        }
      : null,
    templateAnswers,
    fields: {
      customerName: String(body.customerName || form.customerName || '').trim() || form.customerName,
      address: String(body.address ?? ''),
      addressDetail:
        body.addressDetail != null && String(body.addressDetail).trim()
          ? String(body.addressDetail).trim()
          : null,
      customerPhone: String(body.customerPhone ?? ''),
      customerPhone2: String(body.customerPhone2).trim(),
      areaPyeong: areaPyeongOut,
      areaBasis: areaBasisNorm,
      exclusiveAreaSqm,
      propertyType: propertyTypeNorm,
      preferredDate: useDateStr,
      preferredTime: useTimeStr,
      preferredTimeDetail: useDetailStr,
      roomCount: body.roomCount ?? null,
      bathroomCount: body.bathroomCount ?? null,
      balconyCount: body.balconyCount ?? null,
      kitchenCount: body.kitchenCount ?? null,
      buildingType:
        body.buildingType != null && String(body.buildingType).trim()
          ? String(body.buildingType).trim()
          : null,
      moveInDate: moveInDateStr,
      moveInDateUndecided: moveInUndecided,
      specialNotes: customerSpecialNotes,
      professionalOptionIds: [...professionalIds],
      professionalOptionLabels,
    },
    issuedSummary: {
      totalAmount: form.totalAmount,
      depositAmount: form.depositAmount,
      balanceAmount: form.balanceAmount,
      optionNote: form.optionNote,
    },
  };

  const existingPending = await prisma.inquiry.findFirst({
    where: { orderFormId: form.id, status: { in: ['PENDING', 'DEPOSIT_COMPLETED', 'ORDER_FORM_PENDING'] } },
    select: { id: true, inquiryNumber: true },
  });

  let changedInquiryId: string | null = null;
  if (existingPending) {
    await prisma.$transaction(async (tx) => {
      const inquiryNumber =
        existingPending.inquiryNumber ?? (await allocateNextInquiryNumber(tx, submitTenantId));
      await tx.inquiry.update({
        where: { id: existingPending.id },
        data: {
          inquiryNumber,
          customerName: body.customerName || form.customerName,
          customerPhone: body.customerPhone,
          customerPhone2: String(body.customerPhone2).trim(),
          address: body.address,
          addressDetail: body.addressDetail || null,
          areaPyeong: areaPyeongOut,
          areaBasis: areaBasisNorm,
          exclusiveAreaSqm,
          propertyType: propertyTypeNorm,
          roomCount: body.roomCount ?? null,
          bathroomCount: body.bathroomCount ?? null,
          balconyCount: body.balconyCount ?? null,
          kitchenCount: body.kitchenCount ?? null,
          preferredDate,
          preferredTime: useTimeStr,
          preferredTimeDetail: useDetailStr,
          buildingType: body.buildingType || null,
          moveInDate,
          moveInDateUndecided: moveInUndecided,
          serviceTotalAmount: form.totalAmount,
          serviceDepositAmount: form.depositAmount,
          serviceBalanceAmount: form.balanceAmount,
          source: '발주서',
          status: 'RECEIVED',
          professionalOptionIds: professionalIds,
        },
      });
      await tx.orderForm.update({
        where: { id: form.id },
        data: {
          submittedAt: new Date(),
          customerSpecialNotes,
          /** 발주서 목록 「예약일」열 — 고객 제출 값을 접수와 동일하게 반영 */
          preferredDate: useDateStr,
          preferredTime: useTimeStr,
          preferredTimeDetail: useDetailStr,
          customerSubmissionSnapshot,
          ...customAnswersData,
        },
      });
    });
    changedInquiryId = existingPending.id;
  } else {
    await prisma.$transaction(async (tx) => {
      const inquiryNumber = await allocateNextInquiryNumber(tx, submitTenantId);
      const createdInquiry = await tx.inquiry.create({
        data: {
          tenantId: submitTenantId,
          inquiryNumber,
          createdById: form.createdById,
          customerName: body.customerName || form.customerName,
          customerPhone: body.customerPhone,
          customerPhone2: String(body.customerPhone2).trim(),
          address: body.address,
          addressDetail: body.addressDetail || null,
          areaPyeong: areaPyeongOut,
          areaBasis: areaBasisNorm,
          exclusiveAreaSqm,
          propertyType: propertyTypeNorm,
          roomCount: body.roomCount ?? null,
          bathroomCount: body.bathroomCount ?? null,
          balconyCount: body.balconyCount ?? null,
          kitchenCount: body.kitchenCount ?? null,
          preferredDate,
          preferredTime: useTimeStr,
          preferredTimeDetail: useDetailStr,
          buildingType: body.buildingType || null,
          moveInDate,
          moveInDateUndecided: moveInUndecided,
          serviceTotalAmount: form.totalAmount,
          serviceDepositAmount: form.depositAmount,
          serviceBalanceAmount: form.balanceAmount,
          source: '발주서',
          status: 'RECEIVED',
          orderFormId: form.id,
          professionalOptionIds: professionalIds,
        },
        select: { id: true },
      });
      await tx.orderForm.update({
        where: { id: form.id },
        data: {
          submittedAt: new Date(),
          customerSpecialNotes,
          preferredDate: useDateStr,
          preferredTime: useTimeStr,
          preferredTimeDetail: useDetailStr,
          customerSubmissionSnapshot,
          ...customAnswersData,
        },
      });
      changedInquiryId = createdInquiry.id;
    });
  }

  const geoTarget = await prisma.inquiry.findFirst({
    where: { orderFormId: form.id },
    select: { id: true },
  });
  if (geoTarget) {
    await syncInquiryAddressGeo(prisma, geoTarget.id);
  }

  const celebrateRow = await prisma.inquiry.findFirst({
    where: { orderFormId: form.id },
    select: {
      createdById: true,
      customerName: true,
      inquiryNumber: true,
      source: true,
    },
  });
  if (celebrateRow) {
    void notifyInquiryCelebrate({
      tenantId: submitTenantId,
      createdById: celebrateRow.createdById,
      customerName: celebrateRow.customerName,
      inquiryNumber: celebrateRow.inquiryNumber,
      source: celebrateRow.source,
    });
  }
  if (changedInquiryId) {
    const assigns = await prisma.assignment.findMany({
      where: { inquiryId: changedInquiryId },
      select: { teamLeaderId: true },
    });
    const leaderIds = [...new Set(assigns.map((a) => a.teamLeaderId))];
    if (leaderIds.length > 0) {
      notifyInboxRefresh(leaderIds);
    }
  }

  res.json({ ok: true });
});

/* ========================= 발주서 현장 사진 (고객 첨부) ========================= */

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});
const photoUploadFields = photoUpload.fields([
  { name: 'images', maxCount: 20 },
  { name: 'image', maxCount: 1 },
]);

/** 공개(토큰): 발주서에 첨부된 사진 목록. 제출 전·후 모두 조회 가능. */
router.get('/by-token/:token/photos', async (req, res) => {
  const { token } = req.params;
  const form = await prisma.orderForm.findUnique({
    where: { token },
    select: { id: true, tenantId: true },
  });
  if (!form) {
    res.status(404).json({ error: '발주서를 찾을 수 없습니다.' });
    return;
  }
  try {
    await assertPublicOrderFormAccess(form.tenantId, req);
  } catch (e) {
    if (respondPublicTenantAccessError(res, e)) return;
    throw e;
  }
  const rows = await listOrderFormPhotos(form.id);
  res.json({ items: rows.map(serializeOrderFormPhoto) });
});

/** 공개(토큰): 고객이 발주서 제출 전에 현장 사진 업로드. 제출 이후에는 수정 불가. */
router.post('/by-token/:token/photos', photoUploadFields, async (req, res) => {
  if (!isCloudinaryConfigured()) {
    res.status(503).json({
      error:
        '사진 업로드가 아직 준비되지 않았습니다. 관리자에게 문의해주세요. (CLOUDINARY 설정 필요)',
    });
    return;
  }
  const { token } = req.params;
  const form = await prisma.orderForm.findUnique({
    where: { token },
    select: { id: true, tenantId: true, submittedAt: true },
  });
  if (!form) {
    res.status(404).json({ error: '발주서를 찾을 수 없습니다.' });
    return;
  }
  try {
    await assertPublicOrderFormAccess(form.tenantId, req);
  } catch (e) {
    if (respondPublicTenantAccessError(res, e)) return;
    throw e;
  }
  if (form.submittedAt) {
    res.status(410).json({ error: '이미 제출된 발주서는 사진을 변경할 수 없습니다.' });
    return;
  }

  const raw = req.files as Record<string, Express.Multer.File[]> | undefined;
  const files = [...(raw?.images ?? []), ...(raw?.image ?? [])];
  if (files.length === 0) {
    res.status(400).json({ error: '이미지 파일을 선택해주세요.' });
    return;
  }

  const MAX_PER_FORM = 20;
  const existingCount = await prisma.orderFormPhoto.count({ where: { orderFormId: form.id } });
  if (existingCount + files.length > MAX_PER_FORM) {
    res.status(400).json({
      error: `사진은 발주서 당 최대 ${MAX_PER_FORM}장까지 첨부할 수 있습니다. (현재 ${existingCount}장)`,
    });
    return;
  }

  const created: Awaited<ReturnType<typeof uploadOrderFormPhotoBuffer>>[] = [];
  try {
    for (const file of files) {
      if (!file.buffer?.length) continue;
      const row = await uploadOrderFormPhotoBuffer({
        orderFormId: form.id,
        buffer: file.buffer,
        mimetype: file.mimetype,
      });
      created.push(row);
    }
    if (created.length === 0) {
      res.status(400).json({ error: '유효한 이미지 파일이 없습니다.' });
      return;
    }
    const items = created.map(serializeOrderFormPhoto);
    res.status(201).json({ items, item: items[0] });
  } catch (e) {
    console.error('[orderform-photo upload]', e);
    res.status(500).json({ error: '사진 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }
});

/** 공개(토큰): 고객이 잘못 올린 사진을 제출 전에 삭제. 제출 이후에는 불가. */
router.delete('/by-token/:token/photos/:photoId', async (req, res) => {
  const { token, photoId } = req.params;
  const form = await prisma.orderForm.findUnique({
    where: { token },
    select: { id: true, tenantId: true, submittedAt: true },
  });
  if (!form) {
    res.status(404).json({ error: '발주서를 찾을 수 없습니다.' });
    return;
  }
  try {
    await assertPublicOrderFormAccess(form.tenantId, req);
  } catch (e) {
    if (respondPublicTenantAccessError(res, e)) return;
    throw e;
  }
  if (form.submittedAt) {
    res.status(410).json({ error: '이미 제출된 발주서는 사진을 변경할 수 없습니다.' });
    return;
  }
  const photo = await prisma.orderFormPhoto.findFirst({
    where: { id: photoId, orderFormId: form.id },
    select: { id: true },
  });
  if (!photo) {
    res.status(404).json({ error: '사진을 찾을 수 없습니다.' });
    return;
  }
  await deleteOrderFormPhoto(photoId);
  res.json({ ok: true });
});

/** 관리자·마케터: 발주서에 첨부된 사진 목록 조회 (orderFormId 기준). */
router.get('/:id/photos', authMiddleware, adminOrMarketerOrTeamLeader, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const { id } = req.params;
  const form = await prisma.orderForm.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!form) {
    res.status(404).json({ error: '발주서를 찾을 수 없습니다.' });
    return;
  }
  const rows = await listOrderFormPhotos(form.id);
  res.json({ items: rows.map(serializeOrderFormPhoto) });
});

export default router;
