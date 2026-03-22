import { Router } from 'express';
import { randomBytes } from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOnly, adminOrMarketer } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';

const router = Router();

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
  } = req.body as {
    customerName: string;
    totalAmount: number;
    depositAmount?: number;
    balanceAmount?: number;
    optionNote?: string;
    preferredDate?: string;
    preferredTime?: string;
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
  infoLinkText: '안내사항',
  submitSuccessTitle: '제출이 완료되었습니다.',
  submitSuccessBody: '청소 전일 저녁, 담당 팀장이 연락드립니다.',
  updatedAt: new Date().toISOString(),
};

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
  const options = await prisma.estimateOption.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
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
    options: options.map((o) => ({ name: o.name, extraAmount: o.extraAmount })),
    formConfig: {
      formTitle: formConfig.formTitle,
      priceLabel: formConfig.priceLabel,
      reviewEventText: formConfig.reviewEventText,
      footerNotice1: formConfig.footerNotice1,
      footerNotice2: formConfig.footerNotice2,
      infoContent: formConfig.infoContent,
      infoLinkText: formConfig.infoLinkText,
      submitSuccessTitle: formConfig.submitSuccessTitle,
      submitSuccessBody: formConfig.submitSuccessBody,
    },
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
    areaPyeong: number;
    preferredDate: string;
    preferredTime: string;
    roomCount?: number;
    balconyCount?: number;
    bathroomCount?: number;
    kitchenCount?: number;
    buildingType: string;
    moveInDate?: string;
    specialNotes?: string;
  };

  const form = await prisma.orderForm.findUnique({ where: { token } });
  if (!form) {
    res.status(404).json({ error: '발주서를 찾을 수 없습니다.' });
    return;
  }
  if (form.submittedAt) {
    res.status(410).json({ error: '이미 제출된 발주서입니다.' });
    return;
  }

  // 관리자가 설정한 날짜/시간 우선, 없으면 고객 입력값 사용 (하위 호환)
  const useDate = form.preferredDate || body.preferredDate;
  const useTime = form.preferredTime || body.preferredTime;
  const preferredDate = useDate ? new Date(useDate + 'T12:00:00') : null;
  const moveInDate = body.moveInDate
    ? new Date(body.moveInDate + 'T12:00:00')
    : null;

  const memo = [
    `[발주서] 총 ${form.totalAmount.toLocaleString()}원 (예약금 ${form.depositAmount.toLocaleString()}원, 잔금 ${form.balanceAmount.toLocaleString()}원)`,
    form.optionNote ? `추가: ${form.optionNote}` : null,
    `신축/구축/인테리어: ${body.buildingType || '-'}`,
    body.moveInDate ? `이사 날짜: ${body.moveInDate}` : null,
    body.specialNotes ? `특이사항: ${body.specialNotes}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  await prisma.$transaction([
    prisma.inquiry.create({
      data: {
        customerName: body.customerName || form.customerName,
        customerPhone: body.customerPhone,
        address: body.address,
        addressDetail: body.addressDetail || null,
        areaPyeong: body.areaPyeong,
        roomCount: body.roomCount ?? null,
        bathroomCount: body.bathroomCount ?? null,
        balconyCount: body.balconyCount ?? null,
        kitchenCount: body.kitchenCount ?? null,
        preferredDate,
        preferredTime: useTime || null,
        memo,
        buildingType: body.buildingType || null,
        moveInDate,
        specialNotes: body.specialNotes || null,
        source: '발주서',
        status: 'RECEIVED',
        orderFormId: form.id,
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
