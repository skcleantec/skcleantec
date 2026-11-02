import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { normalizeKrPhoneDigits } from '../cs/matchInquiryForCs.js';
import type {
  TelecrmConsultationQuoteLine,
  TelecrmConsultationQuotePayload,
  TelecrmConsultationQuoteStatus,
} from '../../lib/telecrmConsultationQuote.js';
import {
  buildTelecrmQuoteFollowupMemo,
  telecrmQuotePayloadHasContent,
} from '../../lib/telecrmConsultationQuote.js';
import {
  assertActiveLeadSourceLabel,
  mapLeadSourceValidationError,
} from '../inquiry-lead-sources/inquiryLeadSource.service.js';
import {
  appendFollowupLog,
  findOpenFollowupForPhones,
  mergeFollowupMemo,
  OPEN_FOLLOWUP_MERGE_STATUSES,
} from '../order-followups/orderFollowups.service.js';
import { mergeCustomerPhones, relinkSafeNumberRecords } from '../order-followups/customerPhoneRelink.service.js';

export type TelecrmConsultationQuoteDto = {
  id: string;
  phone: string;
  status: TelecrmConsultationQuoteStatus;
  payload: TelecrmConsultationQuotePayload;
  followupId: string | null;
  inquiryId: string | null;
  createdById: string;
  updatedById: string;
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export function normalizeTelecrmQuotePhone(raw: string): string {
  return normalizeKrPhoneDigits(raw).slice(0, 32);
}

function parseQuoteLine(raw: unknown): TelecrmConsultationQuoteLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const source = o.source === 'telecrm' || o.source === 'order' ? o.source : null;
  const label = typeof o.label === 'string' ? o.label.trim().slice(0, 200) : '';
  if (!source || !label) return null;
  const parseAmt = (v: unknown): number | null => {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  };
  const quantityRaw = Number(o.quantity);
  const quantity =
    Number.isFinite(quantityRaw) && quantityRaw >= 1 ? Math.min(99, Math.floor(quantityRaw)) : undefined;
  return {
    source,
    label,
    sublabel: typeof o.sublabel === 'string' ? o.sublabel.trim().slice(0, 500) : undefined,
    itemId: typeof o.itemId === 'string' ? o.itemId.trim().slice(0, 64) : undefined,
    optionId: typeof o.optionId === 'string' ? o.optionId.trim().slice(0, 64) : undefined,
    catalogAmountWon: parseAmt(o.catalogAmountWon),
    amountWon: parseAmt(o.amountWon),
    priceHint: typeof o.priceHint === 'string' ? o.priceHint.trim().slice(0, 200) : null,
    quantity,
  };
}

export function parseTelecrmConsultationQuotePayload(raw: unknown): TelecrmConsultationQuotePayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const pyeong = typeof o.pyeong === 'string' ? o.pyeong.trim().slice(0, 32) : '';
  const parseAmt = (v: unknown): number | null => {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  };
  const linesRaw = Array.isArray(o.lines) ? o.lines : [];
  const lines: TelecrmConsultationQuoteLine[] = [];
  for (const row of linesRaw) {
    const line = parseQuoteLine(row);
    if (line) lines.push(line);
  }
  const copyText = typeof o.copyText === 'string' ? o.copyText.trim().slice(0, 8000) : '';
  const payload: TelecrmConsultationQuotePayload = {
    pyeong,
    baseEstimateWon: parseAmt(o.baseEstimateWon),
    minimumApplied: o.minimumApplied === true,
    lines,
    grandTotalWon: parseAmt(o.grandTotalWon),
    copyText,
  };
  if (!telecrmQuotePayloadHasContent(payload)) return null;
  return payload;
}

function serializeQuoteRow(
  row: {
    id: string;
    phone: string;
    status: string;
    payload: unknown;
    followupId: string | null;
    inquiryId: string | null;
    createdById: string;
    updatedById: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: { name: string | null } | null;
    updatedBy: { name: string | null } | null;
  },
): TelecrmConsultationQuoteDto {
  return {
    id: row.id,
    phone: row.phone,
    status: row.status as TelecrmConsultationQuoteStatus,
    payload: row.payload as TelecrmConsultationQuotePayload,
    followupId: row.followupId,
    inquiryId: row.inquiryId,
    createdById: row.createdById,
    updatedById: row.updatedById,
    createdByName: row.createdBy?.name ?? null,
    updatedByName: row.updatedBy?.name ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const quoteSelect = {
  id: true,
  phone: true,
  status: true,
  payload: true,
  followupId: true,
  inquiryId: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { name: true } },
  updatedBy: { select: { name: true } },
} as const;

export async function listTelecrmConsultationQuotesForPhone(
  tenantId: string,
  operatingCompanyId: string,
  phoneRaw: string,
  opts?: { historyLimit?: number },
): Promise<{
  draft: TelecrmConsultationQuoteDto | null;
  latestQuoted: TelecrmConsultationQuoteDto | null;
  latestSent: TelecrmConsultationQuoteDto | null;
  active: TelecrmConsultationQuoteDto | null;
  history: TelecrmConsultationQuoteDto[];
}> {
  const phone = normalizeTelecrmQuotePhone(phoneRaw);
  if (phone.length < 4) {
    return { draft: null, latestQuoted: null, latestSent: null, active: null, history: [] };
  }
  const historyLimit = Math.min(20, Math.max(1, opts?.historyLimit ?? 5));

  const [draftRow, quotedRow, sentRow, sentHistoryRows] = await Promise.all([
    prisma.telecrmConsultationQuote.findFirst({
      where: { tenantId, operatingCompanyId, phone, status: 'DRAFT' },
      orderBy: { updatedAt: 'desc' },
      select: quoteSelect,
    }),
    prisma.telecrmConsultationQuote.findFirst({
      where: { tenantId, operatingCompanyId, phone, status: 'QUOTED' },
      orderBy: { updatedAt: 'desc' },
      select: quoteSelect,
    }),
    prisma.telecrmConsultationQuote.findFirst({
      where: { tenantId, operatingCompanyId, phone, status: 'SENT' },
      orderBy: { updatedAt: 'desc' },
      select: quoteSelect,
    }),
    prisma.telecrmConsultationQuote.findMany({
      where: { tenantId, operatingCompanyId, phone, status: 'SENT' },
      orderBy: { updatedAt: 'desc' },
      take: historyLimit,
      select: quoteSelect,
    }),
  ]);

  const draft = draftRow ? serializeQuoteRow(draftRow) : null;
  const latestQuoted = quotedRow ? serializeQuoteRow(quotedRow) : null;
  const latestSent = sentRow ? serializeQuoteRow(sentRow) : null;
  return {
    draft,
    latestQuoted,
    latestSent,
    active: draft,
    history: sentHistoryRows.map(serializeQuoteRow),
  };
}

export async function upsertTelecrmConsultationQuoteDraft(
  tenantId: string,
  operatingCompanyId: string,
  userId: string,
  phoneRaw: string,
  payload: TelecrmConsultationQuotePayload,
): Promise<TelecrmConsultationQuoteDto> {
  const phone = normalizeTelecrmQuotePhone(phoneRaw);
  if (phone.length < 4) throw new Error('전화번호(4자 이상)가 필요합니다.');

  const jsonPayload = payload as unknown as Prisma.InputJsonValue;
  const existing = await prisma.telecrmConsultationQuote.findFirst({
    where: { tenantId, operatingCompanyId, phone, status: 'DRAFT' },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });

  if (existing) {
    const row = await prisma.telecrmConsultationQuote.update({
      where: { id: existing.id },
      data: { payload: jsonPayload, updatedById: userId },
      select: quoteSelect,
    });
    return serializeQuoteRow(row);
  }

  const row = await prisma.telecrmConsultationQuote.create({
    data: {
      tenantId,
      operatingCompanyId,
      phone,
      status: 'DRAFT',
      payload: jsonPayload,
      createdById: userId,
      updatedById: userId,
    },
    select: quoteSelect,
  });
  return serializeQuoteRow(row);
}

export async function supersedeTelecrmConsultationQuotesForPhone(
  tenantId: string,
  operatingCompanyId: string,
  userId: string,
  phoneRaw: string,
): Promise<void> {
  const phone = normalizeTelecrmQuotePhone(phoneRaw);
  if (phone.length < 4) return;
  await prisma.telecrmConsultationQuote.updateMany({
    where: {
      tenantId,
      operatingCompanyId,
      phone,
      status: { in: ['DRAFT', 'QUOTED'] },
    },
    data: { status: 'SUPERSEDED', updatedById: userId },
  });
}

/** 이 번호로 견적보내기 한 기록 — 최신순 (누가·언제·얼마) */
export async function listSentTelecrmConsultationQuotes(
  tenantId: string,
  operatingCompanyId: string,
  phoneRaw: string,
  limit = 10,
): Promise<TelecrmConsultationQuoteDto[]> {
  const phone = normalizeTelecrmQuotePhone(phoneRaw);
  if (phone.length < 4) return [];
  const rows = await prisma.telecrmConsultationQuote.findMany({
    where: { tenantId, operatingCompanyId, phone, status: 'SENT' },
    orderBy: { createdAt: 'desc' },
    take: Math.min(30, Math.max(1, limit)),
    select: quoteSelect,
  });
  return rows.map(serializeQuoteRow);
}

export async function getLatestTelecrmConsultationQuoteSummary(
  tenantId: string,
  operatingCompanyId: string,
  phoneRaw: string,
): Promise<TelecrmConsultationQuoteDto | null> {
  const { latestSent } = await listTelecrmConsultationQuotesForPhone(
    tenantId,
    operatingCompanyId,
    phoneRaw,
    { historyLimit: 1 },
  );
  return latestSent;
}

export async function recordTelecrmConsultationQuoteSent(
  tenantId: string,
  operatingCompanyId: string,
  userId: string,
  phoneRaw: string,
  payload: TelecrmConsultationQuotePayload,
): Promise<TelecrmConsultationQuoteDto> {
  const phone = normalizeTelecrmQuotePhone(phoneRaw);
  if (phone.length < 4) throw new Error('전화번호(4자 이상)가 필요합니다.');
  if (!telecrmQuotePayloadHasContent(payload)) throw new Error('저장할 견적 내용이 없습니다.');

  const jsonPayload = payload as unknown as Prisma.InputJsonValue;

  // 예전 보낸 견적도 SENT 로 남겨 둠 — 「누가 언제 얼마로 보냈는지」 기록을 모두 보여 주기 위함 (가장 최근 것은 updatedAt 순으로 찾음)
  return prisma.$transaction(async (tx) => {
    const row = await tx.telecrmConsultationQuote.create({
      data: {
        tenantId,
        operatingCompanyId,
        phone,
        status: 'SENT',
        payload: jsonPayload,
        createdById: userId,
        updatedById: userId,
      },
      select: quoteSelect,
    });
    return serializeQuoteRow(row);
  });
}

export type FinalizeTelecrmConsultationQuoteInput = {
  phone: string;
  /** 연락처2 (주로 050 안심번호) — 비우면 기존 연락처2 유지 */
  customerPhone2?: string | null;
  payload: TelecrmConsultationQuotePayload;
  customerName: string;
  nickname?: string | null;
  goldDb?: boolean;
  preferredMoveInCleaningDate?: string | null;
  address?: string | null;
  areaPyeong?: number | null;
  roomCount?: number | null;
  bathroomCount?: number | null;
  balconyCount?: number | null;
  followupStatus: 'ABSENT' | 'ON_HOLD';
  extraMemo?: string | null;
  actorName?: string | null;
  leadSource?: string | null;
  strictLeadSource?: boolean;
};

export type FinalizeTelecrmConsultationQuoteResult = {
  quote: TelecrmConsultationQuoteDto;
  followupId: string;
  followupCreated: boolean;
};

export async function finalizeTelecrmConsultationQuote(
  tenantId: string,
  operatingCompanyId: string,
  userId: string,
  input: FinalizeTelecrmConsultationQuoteInput,
): Promise<FinalizeTelecrmConsultationQuoteResult> {
  const phone = normalizeTelecrmQuotePhone(input.phone);
  if (phone.length < 4) throw new Error('전화번호(4자 이상)가 필요합니다.');
  if (!telecrmQuotePayloadHasContent(input.payload)) throw new Error('저장할 견적 내용이 없습니다.');

  const customerName = input.customerName.trim().slice(0, 120);
  if (!customerName) throw new Error('고객명(또는 닉네임)이 필요합니다.');

  const followupStatus = input.followupStatus;
  if (followupStatus !== 'ABSENT' && followupStatus !== 'ON_HOLD') {
    throw new Error('부재/보류 상태만 지원합니다.');
  }

  const nickname = typeof input.nickname === 'string' ? input.nickname.trim().slice(0, 80) || null : null;
  const goldDb = input.goldDb === true;
  const preferredMoveInCleaningDate =
    input.preferredMoveInCleaningDate === undefined
      ? undefined
      : input.preferredMoveInCleaningDate;

  const extraMemo = typeof input.extraMemo === 'string' ? input.extraMemo.trim() : '';
  const strictLeadSource = input.strictLeadSource === true;
  let resolvedLeadSource: string | null = null;
  if (strictLeadSource || (typeof input.leadSource === 'string' && input.leadSource.trim())) {
    try {
      resolvedLeadSource = await assertActiveLeadSourceLabel(prisma, tenantId, input.leadSource);
    } catch (e) {
      const mapped = mapLeadSourceValidationError(e);
      if (mapped) throw new Error(mapped.message);
      throw e;
    }
  } else if (strictLeadSource) {
    throw new Error('유입 경로를 선택해 주세요.');
  }
  const jsonPayload = input.payload as unknown as Prisma.InputJsonValue;

  const actorRow = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { name: true },
  });
  const actorName = input.actorName?.trim() || actorRow?.name || null;
  const autoMemo = buildTelecrmQuoteFollowupMemo({
    payload: input.payload,
    actorName,
  });
  const followupMemo = extraMemo ? `${autoMemo}\n${extraMemo}` : autoMemo;

  const intakeExtrasData: Record<string, string | number | null> = {};
  if (input.address !== undefined) intakeExtrasData.address = input.address;
  if (input.areaPyeong !== undefined) intakeExtrasData.areaPyeong = input.areaPyeong;
  if (input.roomCount !== undefined) intakeExtrasData.roomCount = input.roomCount;
  if (input.bathroomCount !== undefined) intakeExtrasData.bathroomCount = input.bathroomCount;
  if (input.balconyCount !== undefined) intakeExtrasData.balconyCount = input.balconyCount;

  const phone2Input =
    typeof input.customerPhone2 === 'string' ? input.customerPhone2.trim().slice(0, 32) || null : null;

  const finalized = await prisma.$transaction(async (tx) => {
    const existing = await findOpenFollowupForPhones(tx, {
      tenantId,
      operatingCompanyId,
      customerPhone: phone,
      customerPhone2: phone2Input,
      statuses: OPEN_FOLLOWUP_MERGE_STATUSES,
    });
    let followup: { id: string };
    let followupCreated = false;

    if (existing) {
      const mergedPhones = mergeCustomerPhones({
        prevPhone: existing.customerPhone,
        prevPhone2: existing.customerPhone2,
        nextPhone: phone,
        nextPhone2: phone2Input,
      });
      followup = await tx.orderFollowup.update({
        where: { id: existing.id },
        data: {
          customerName,
          nickname,
          customerPhone: mergedPhones.customerPhone || phone,
          customerPhone2: mergedPhones.customerPhone2,
          status: followupStatus,
          goldDb: goldDb || existing.goldDb,
          memo: mergeFollowupMemo(existing.memo, followupMemo),
          handledById: userId,
          ...(resolvedLeadSource != null ? { leadSource: resolvedLeadSource } : {}),
          ...(preferredMoveInCleaningDate !== undefined
            ? { preferredMoveInCleaningDate }
            : {}),
          ...intakeExtrasData,
        },
        select: { id: true },
      });
      await appendFollowupLog(tx, {
        followupId: followup.id,
        actorId: userId,
        action: 'QUOTE_FINALIZE',
        detail: JSON.stringify({ status: followupStatus, quoteGrandTotalWon: input.payload.grandTotalWon }),
      });
    } else {
      const createPhones = mergeCustomerPhones({
        prevPhone: null,
        prevPhone2: null,
        nextPhone: phone,
        nextPhone2: phone2Input,
      });
      followup = await tx.orderFollowup.create({
        data: {
          tenantId,
          operatingCompanyId,
          customerName,
          nickname,
          customerPhone: createPhones.customerPhone || phone,
          customerPhone2: createPhones.customerPhone2,
          status: followupStatus,
          goldDb,
          memo: followupMemo,
          createdById: userId,
          handledById: userId,
          ...(resolvedLeadSource != null ? { leadSource: resolvedLeadSource } : {}),
          ...(preferredMoveInCleaningDate !== undefined
            ? { preferredMoveInCleaningDate }
            : {}),
          ...intakeExtrasData,
        },
        select: { id: true },
      });
      followupCreated = true;
      await appendFollowupLog(tx, {
        followupId: followup.id,
        actorId: userId,
        action: 'CREATE',
        detail: JSON.stringify({
          status: followupStatus,
          customerName,
          customerPhone: phone,
          source: 'telecrm_quote_finalize',
          ...(resolvedLeadSource ? { leadSource: resolvedLeadSource } : {}),
        }),
      });
    }

    const draftRow = await tx.telecrmConsultationQuote.findFirst({
      where: { tenantId, operatingCompanyId, phone, status: 'DRAFT' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });

    let quoteRow;
    if (draftRow) {
      quoteRow = await tx.telecrmConsultationQuote.update({
        where: { id: draftRow.id },
        data: {
          status: 'QUOTED',
          payload: jsonPayload,
          followupId: followup.id,
          updatedById: userId,
        },
        select: quoteSelect,
      });
    } else {
      const quotedRow = await tx.telecrmConsultationQuote.findFirst({
        where: { tenantId, operatingCompanyId, phone, status: 'QUOTED' },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });
      if (quotedRow) {
        quoteRow = await tx.telecrmConsultationQuote.update({
          where: { id: quotedRow.id },
          data: {
            payload: jsonPayload,
            followupId: followup.id,
            updatedById: userId,
          },
          select: quoteSelect,
        });
      } else {
        quoteRow = await tx.telecrmConsultationQuote.create({
          data: {
            tenantId,
            operatingCompanyId,
            phone,
            status: 'QUOTED',
            payload: jsonPayload,
            followupId: followup.id,
            createdById: userId,
            updatedById: userId,
          },
          select: quoteSelect,
        });
      }
    }

    const callNoteBody = autoMemo.split('\n').slice(0, 3).join(' · ').slice(0, 4000);
    await tx.telecrmCallNote.create({
      data: {
        tenantId,
        userId,
        phone,
        body: callNoteBody,
      },
    });

    return {
      quote: serializeQuoteRow(quoteRow),
      followupId: followup.id,
      followupCreated,
    };
  });

  try {
    const saved = await prisma.orderFollowup.findUnique({
      where: { id: finalized.followupId },
      select: { customerPhone: true, customerPhone2: true },
    });
    if (saved) {
      await relinkSafeNumberRecords(prisma, {
        tenantId,
        operatingCompanyId,
        customerPhone: saved.customerPhone,
        customerPhone2: saved.customerPhone2,
        actorUserId: userId,
        excludeFollowupId: finalized.followupId,
      });
    }
  } catch (e) {
    console.error('[telecrm-quote] finalize phone relink failed', e instanceof Error ? e.message : e);
  }
  return finalized;
}

export async function linkTelecrmConsultationQuoteInquiry(
  tenantId: string,
  operatingCompanyId: string,
  userId: string,
  input: {
    phone: string;
    inquiryId?: string | null;
    orderFormId?: string | null;
  },
): Promise<TelecrmConsultationQuoteDto | null> {
  const phone = normalizeTelecrmQuotePhone(input.phone);
  if (phone.length < 4) return null;

  let inquiryId =
    typeof input.inquiryId === 'string' && input.inquiryId.trim() ? input.inquiryId.trim() : null;

  if (!inquiryId && typeof input.orderFormId === 'string' && input.orderFormId.trim()) {
    const linked = await prisma.inquiry.findFirst({
      where: { tenantId, orderFormId: input.orderFormId.trim() },
      select: { id: true },
    });
    inquiryId = linked?.id ?? null;
  }

  if (inquiryId) {
    const inquiry = await prisma.inquiry.findFirst({
      where: { id: inquiryId, tenantId },
      select: { id: true },
    });
    if (!inquiry) throw new Error('접수를 찾을 수 없습니다.');
  }

  const quoteRow = await prisma.telecrmConsultationQuote.findFirst({
    where: {
      tenantId,
      operatingCompanyId,
      phone,
      status: { in: ['DRAFT', 'QUOTED'] },
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
  if (!quoteRow) return null;

  const updated = await prisma.telecrmConsultationQuote.update({
    where: { id: quoteRow.id },
    data: {
      status: 'ORDER_ISSUED',
      inquiryId,
      updatedById: userId,
    },
    select: quoteSelect,
  });
  return serializeQuoteRow(updated);
}
