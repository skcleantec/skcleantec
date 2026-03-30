import { Router } from 'express';
import { randomBytes, randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOnly, adminOrMarketer } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import {
  DEFAULT_GUIDE_SECTIONS,
  type GuideSection,
} from './guideDefaults.js';
import {
  filterActiveProfessionalOptionIds,
  formatProfessionalOptionsMemoLine,
  normalizeHexColor,
  parseProfessionalOptionIdsRaw,
} from './specialtyOptions.js';
import { ensureMissingProfessionalDefaults } from './defaultProfessionalOptions.js';

const router = Router();

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

/** 공개: 고객 안내사항 페이지(`/info`)용 — 인증 없음 */
router.get('/public-guide', async (_req, res) => {
  try {
    let cfg = await prisma.orderFormConfig.findFirst();
    if (!cfg) {
      cfg = await prisma.orderFormConfig.create({ data: {} });
    }
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
router.get('/professional-options', async (_req, res) => {
  try {
    const items = await prisma.professionalSpecialtyOption.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, label: true, priceHint: true, emoji: true, color: true, sortOrder: true },
    });
    res.json({ items });
  } catch (err) {
    console.error('professional-options list error:', err);
    res.status(500).json({ error: '전문 시공 옵션을 불러올 수 없습니다.' });
  }
});

/** 관리자/마케터: 전문 시공 옵션 전체 (비활성 포함) */
router.get('/professional-options/all', authMiddleware, adminOrMarketer, async (_req, res) => {
  try {
    const items = await prisma.professionalSpecialtyOption.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
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
    label?: string;
    priceHint?: string;
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
  const priceHint = body.priceHint != null ? String(body.priceHint).trim() : '';
  const emoji = body.emoji != null ? String(body.emoji).trim().slice(0, 8) : '';
  const sortOrder = body.sortOrder != null && Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
  const isActive = body.isActive !== false;
  try {
    const created = await prisma.professionalSpecialtyOption.create({
      data: { id: randomUUID(), label, priceHint, emoji, color, sortOrder, isActive },
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
    priceHint?: string;
    emoji?: string;
    color?: string;
    sortOrder?: number;
    isActive?: boolean;
  };
  const existing = await prisma.professionalSpecialtyOption.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }
  const data: Record<string, unknown> = {};
  if (body.label !== undefined) {
    const label = String(body.label).trim();
    if (!label) {
      res.status(400).json({ error: '항목명을 입력해주세요.' });
      return;
    }
    data.label = label;
  }
  if (body.priceHint !== undefined) data.priceHint = String(body.priceHint).trim();
  if (body.emoji !== undefined) data.emoji = String(body.emoji).trim().slice(0, 8);
  if (body.color !== undefined) {
    const color = normalizeHexColor(String(body.color));
    if (!color) {
      res.status(400).json({ error: '색상은 #RRGGBB 형식으로 입력해주세요.' });
      return;
    }
    data.color = color;
  }
  if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) {
    data.sortOrder = Number(body.sortOrder);
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  try {
    const updated = await prisma.professionalSpecialtyOption.update({
      where: { id },
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
  try {
    await prisma.professionalSpecialtyOption.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
  }
});

/** 관리자/마케터: 발주서 목록 */
router.get('/', authMiddleware, adminOrMarketer, async (req, res) => {
  const list = await prisma.orderForm.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      inquiries: { take: 1 },
    },
  });
  res.json({ items: list });
});

/** 관리자/마케터: 발주서 발급 (고객명, 견적 입력 → 링크 생성) */
router.post('/', authMiddleware, adminOrMarketer, async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const {
    customerName,
    totalAmount,
    depositAmount,
    balanceAmount,
    optionNote,
    preferredDate,
    preferredTime,
    preferredTimeDetail,
  } = req.body as {
    customerName: string;
    totalAmount: number;
    depositAmount?: number;
    balanceAmount?: number;
    optionNote?: string;
    preferredDate?: string;
    preferredTime?: string;
    preferredTimeDetail?: string;
  };
  if (!customerName?.trim()) {
    res.status(400).json({ error: '고객명을 입력해주세요.' });
    return;
  }
  if (totalAmount == null || totalAmount < 0) {
    res.status(400).json({ error: '총 금액을 입력해주세요.' });
    return;
  }
  const deposit = depositAmount ?? 20000;
  const balance = balanceAmount ?? Math.max(0, totalAmount - deposit);
  const token = randomBytes(12).toString('hex');
  const orderForm = await prisma.orderForm.create({
    data: {
      token,
      customerName: customerName.trim(),
      totalAmount,
      depositAmount: deposit,
      balanceAmount: balance,
      optionNote: optionNote?.trim() || null,
      preferredDate: preferredDate?.trim() || null,
      preferredTime: preferredTime?.trim() || null,
      preferredTimeDetail: preferredTimeDetail?.trim() || null,
      createdById: userId,
    },
  });
  res.json(orderForm);
});

const DEFAULT_FORM_CONFIG = {
  id: '',
  formTitle: 'SK클린텍 입주청소 발주서',
  priceLabel: '(특가)',
  reviewEventText: '* 리뷰 별5점 이벤트 참여, 1만원 입금',
  footerNotice1: '‼️ 청소 전일 저녁, 담당 팀장 연락 드림',
  footerNotice2: '❌ 연락 없을 시, 본사 확인 요청 필',
  infoContent: null as string | null,
  infoLinkText: '고객 정보처리 동의 및 안내사항',
  submitSuccessTitle: '제출이 완료되었습니다.',
  submitSuccessBody: '청소 전일 저녁, 담당 팀장이 연락드립니다.',
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
  };
}

/** 관리자/마케터: 폼 메시지 설정 조회 (by-token보다 먼저 선언) */
router.get('/form-config', authMiddleware, adminOrMarketer, async (_req, res) => {
  try {
    let config = await prisma.orderFormConfig.findFirst();
    if (!config) {
      try {
        config = await prisma.orderFormConfig.create({
          data: {},
        });
      } catch (createErr) {
        console.error('form-config create error:', createErr);
        return res.json(DEFAULT_FORM_CONFIG);
      }
    }
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
    let config = await prisma.orderFormConfig.findFirst();
    if (!config) {
      config = await prisma.orderFormConfig.create({
        data: {},
      });
    }
    const updated = await prisma.orderFormConfig.update({
      where: { id: config.id },
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
      inquiries: true,
    },
  });
  if (!form) {
    res.status(404).json({ error: '발주서를 찾을 수 없습니다.' });
    return;
  }
  if (form.submittedAt) {
    res.status(410).json({ error: '이미 제출된 발주서입니다.' });
    return;
  }
  try {
    await ensureMissingProfessionalDefaults(prisma);
  } catch (err) {
    console.error('by-token ensure professional defaults:', err);
  }

  const [options, professionalOptions] = await Promise.all([
    prisma.estimateOption.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.professionalSpecialtyOption.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, label: true, priceHint: true, emoji: true, color: true, sortOrder: true },
    }),
  ]);
  let formConfig = await prisma.orderFormConfig.findFirst();
  if (!formConfig) {
    formConfig = await prisma.orderFormConfig.create({
      data: {},
    });
  }
  res.json({
    id: form.id,
    token: form.token,
    customerName: form.customerName,
    totalAmount: form.totalAmount,
    depositAmount: form.depositAmount,
    balanceAmount: form.balanceAmount,
    optionNote: form.optionNote,
    preferredDate: form.preferredDate,
    preferredTime: form.preferredTime,
    preferredTimeDetail: form.preferredTimeDetail,
    options: options.map((o) => ({ name: o.name, extraAmount: o.extraAmount })),
    professionalOptions,
    formConfig: resolvedPublicFormConfig(formConfig),
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
    areaPyeong: number;
    areaBasis: string;
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
    specialNotes?: string;
    professionalOptionIds?: unknown;
  };

  const rawIds = parseProfessionalOptionIdsRaw(body.professionalOptionIds);
  const professionalIds = await filterActiveProfessionalOptionIds(prisma, rawIds);
  const professionalMemoLine = await formatProfessionalOptionsMemoLine(prisma, professionalIds);

  const form = await prisma.orderForm.findUnique({ where: { token } });
  if (!form) {
    res.status(404).json({ error: '발주서를 찾을 수 없습니다.' });
    return;
  }
  if (form.submittedAt) {
    res.status(410).json({ error: '이미 제출된 발주서입니다.' });
    return;
  }

  if (!body.customerPhone2 || !String(body.customerPhone2).trim()) {
    res.status(400).json({ error: '보조 전화번호를 입력해주세요.' });
    return;
  }
  const areaBasisNorm = String(body.areaBasis || '').trim();
  if (areaBasisNorm !== '공급' && areaBasisNorm !== '전용') {
    res.status(400).json({ error: '평수 기준으로 공급 또는 전용을 선택해주세요.' });
    return;
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

  const adminDetailLocked = Boolean(
    form.preferredTimeDetail && String(form.preferredTimeDetail).trim()
  );
  const useDetailStr = adminDetailLocked
    ? String(form.preferredTimeDetail).trim()
    : body.preferredTimeDetail != null && String(body.preferredTimeDetail).trim()
      ? String(body.preferredTimeDetail).trim()
      : null;

  const preferredDate = new Date(useDateStr + 'T12:00:00');
  const moveInDate = body.moveInDate
    ? new Date(body.moveInDate + 'T12:00:00')
    : null;

  const memo = [
    `[발주서] 총 ${form.totalAmount.toLocaleString()}원 (예약금 ${form.depositAmount.toLocaleString()}원, 잔금 ${form.balanceAmount.toLocaleString()}원)`,
    `보조 연락처: ${String(body.customerPhone2).trim()}`,
    `건축물 유형: ${propertyTypeNorm}`,
    `평수: ${areaBasisNorm} ${body.areaPyeong}평`,
    form.optionNote ? `추가: ${form.optionNote}` : null,
    `신축/구축/인테리어/거주: ${body.buildingType || '-'}`,
    body.moveInDate ? `이사 날짜: ${body.moveInDate}` : null,
    body.specialNotes ? `특이사항: ${body.specialNotes}` : null,
    useDetailStr ? `희망 시각: ${useDetailStr}` : null,
    professionalMemoLine,
  ]
    .filter(Boolean)
    .join('\n');

  await prisma.$transaction([
    prisma.inquiry.create({
      data: {
        createdById: form.createdById,
        customerName: body.customerName || form.customerName,
        customerPhone: body.customerPhone,
        customerPhone2: String(body.customerPhone2).trim(),
        address: body.address,
        addressDetail: body.addressDetail || null,
        areaPyeong: body.areaPyeong,
        areaBasis: areaBasisNorm,
        propertyType: propertyTypeNorm,
        roomCount: body.roomCount ?? null,
        bathroomCount: body.bathroomCount ?? null,
        balconyCount: body.balconyCount ?? null,
        kitchenCount: body.kitchenCount ?? null,
        preferredDate,
        preferredTime: useTimeStr,
        preferredTimeDetail: useDetailStr,
        memo,
        buildingType: body.buildingType || null,
        moveInDate,
        specialNotes: body.specialNotes || null,
        serviceTotalAmount: form.totalAmount,
        serviceDepositAmount: form.depositAmount,
        serviceBalanceAmount: form.balanceAmount,
        source: '발주서',
        status: 'RECEIVED',
        orderFormId: form.id,
        professionalOptionIds: professionalIds,
      },
    }),
    prisma.orderForm.update({
      where: { id: form.id },
      data: { submittedAt: new Date() },
    }),
  ]);

  res.json({ ok: true });
});

export default router;
