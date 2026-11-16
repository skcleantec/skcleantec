import type { InquiryStatus, OrderFollowupStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { normalizeKrPhoneDigits } from '../cs/matchInquiryForCs.js';
import { addDaysToKstYmd, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { classifyPreferredAnswer, type PreferredKind } from './crmQuickScheduleClassify.js';

/** 예약완료(RECEIVED) 이후. 대기·보류·취소는 아직 예약이 아니다. */
const BOOKED_INQUIRY_STATUSES: InquiryStatus[] = [
  'RECEIVED',
  'DEPOSIT_PENDING',
  'DEPOSIT_COMPLETED',
  'ORDER_FORM_PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CS_PROCESSING',
];

const CLOSED_FOLLOWUP_STATUSES: OrderFollowupStatus[] = ['RESERVED', 'FULFILLED'];

export type QuickScheduleLeadInput = {
  operatingCompanyId: string;
  customerName?: string;
  nickname?: string;
  customerPhone?: string;
  leadSource?: string;
  preferredAnswerRaw?: string;
  serviceType?: string;
  address?: string;
  areaPyeong?: number | null;
};

export async function saveQuickScheduleLead(
  tenantId: string,
  userId: string,
  input: QuickScheduleLeadInput,
): Promise<{ saved: boolean }> {
  const brand = await prisma.operatingCompany.findFirst({
    where: { id: input.operatingCompanyId, tenantId },
    select: { id: true },
  });
  if (!brand) return { saved: false };
  const digits = normalizeKrPhoneDigits(input.customerPhone ?? '');
  if (digits.length < 8) return { saved: false };
  const source = input.leadSource === '미소' ? '미소' : input.leadSource === '숨고' ? '숨고' : '';
  if (!source) return { saved: false };
  const fetchedAt = new Date();
  const raw = String(input.preferredAnswerRaw ?? '').trim().slice(0, 2000);
  const classified = classifyPreferredAnswer(raw, fetchedAt);
  const name = String(input.customerName ?? '').trim().slice(0, 128) || '이름 없음';
  const nickname = String(input.nickname ?? '').trim().slice(0, 128) || null;
  const phone = String(input.customerPhone ?? '').trim().slice(0, 32) || digits;
  const serviceType = String(input.serviceType ?? '').trim().slice(0, 128) || null;
  const address = String(input.address ?? '').trim().slice(0, 500) || null;
  const area =
    input.areaPyeong != null && Number.isFinite(input.areaPyeong) ? Math.round(input.areaPyeong * 10) / 10 : null;
  await prisma.crmQuickScheduleLead.upsert({
    where: {
      tenantId_operatingCompanyId_customerPhoneDigits: {
        tenantId,
        operatingCompanyId: brand.id,
        customerPhoneDigits: digits.slice(0, 20),
      },
    },
    create: {
      tenantId,
      operatingCompanyId: brand.id,
      customerName: name,
      nickname,
      customerPhone: phone,
      customerPhoneDigits: digits.slice(0, 20),
      leadSource: source,
      preferredAnswerRaw: raw,
      preferredKind: classified.kind,
      preferredYmd: classified.ymd,
      serviceType,
      address,
      areaPyeong: area,
      fetchedAt,
      fetchedByUserId: userId,
    },
    update: {
      customerName: name,
      nickname,
      customerPhone: phone,
      leadSource: source,
      preferredAnswerRaw: raw,
      preferredKind: classified.kind,
      preferredYmd: classified.ymd,
      serviceType,
      address,
      areaPyeong: area,
      fetchedAt,
      fetchedByUserId: userId,
    },
  });
  return { saved: true };
}

type LeadRow = {
  id: string;
  customerName: string;
  nickname: string | null;
  customerPhone: string;
  customerPhoneDigits: string;
  leadSource: string;
  preferredAnswerRaw: string;
  preferredKind: string;
  preferredYmd: string | null;
  serviceType: string | null;
  address: string | null;
  areaPyeong: number | null;
  fetchedAt: Date;
};

function inWindow(kind: string, ymd: string | null, today: string, until: string): boolean {
  if (kind === 'ASAP') return true;
  if ((kind === 'DATE' || kind === 'WITHIN_WEEK') && ymd && ymd >= today && ymd <= until) return true;
  return false;
}

function digitsOf(raw: string | null | undefined): string {
  return normalizeKrPhoneDigits(raw ?? '');
}

export async function listQuickScheduleLeads(tenantId: string, operatingCompanyId: string) {
  const brand = await prisma.operatingCompany.findFirst({
    where: { id: operatingCompanyId, tenantId },
    select: { id: true },
  });
  if (!brand) return null;
  const today = kstTodayYmd();
  const until = addDaysToKstYmd(today, 7);
  const rows = await prisma.crmQuickScheduleLead.findMany({
    where: {
      tenantId,
      operatingCompanyId: brand.id,
      preferredKind: { in: ['ASAP', 'DATE', 'WITHIN_WEEK'] },
    },
    orderBy: { fetchedAt: 'desc' },
  });
  const windowed = rows.filter((row) => inWindow(row.preferredKind, row.preferredYmd, today, until));
  const phones = [...new Set(windowed.map((row) => row.customerPhoneDigits).filter((d) => d.length >= 8))];

  const booked = new Set<string>();
  const inquiryByPhone = new Map<string, string>();
  const followupByPhone = new Map<
    string,
    { id: string; status: OrderFollowupStatus; deferCount: number; handlerName: string | null; inquiryId: string | null; customerPhone: string; customerPhone2: string | null }
  >();

  if (phones.length > 0) {
    const [inquiries, followups] = await Promise.all([
      prisma.inquiry.findMany({
        where: { tenantId, operatingCompanyId: brand.id, deletedAt: null, status: { not: 'CANCELLED' } },
        select: { id: true, status: true, customerPhone: true, customerPhone2: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.orderFollowup.findMany({
        where: { tenantId, operatingCompanyId: brand.id },
        select: {
          id: true,
          status: true,
          deferCount: true,
          inquiryId: true,
          customerPhone: true,
          customerPhone2: true,
          updatedAt: true,
          handledBy: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    const wanted = new Set(phones);
    for (const row of inquiries) {
      for (const raw of [row.customerPhone, row.customerPhone2]) {
        const d = digitsOf(raw);
        if (!wanted.has(d)) continue;
        if ((BOOKED_INQUIRY_STATUSES as string[]).includes(row.status)) booked.add(d);
        if (!inquiryByPhone.has(d)) inquiryByPhone.set(d, row.id);
      }
    }
    for (const row of followups) {
      for (const raw of [row.customerPhone, row.customerPhone2]) {
        const d = digitsOf(raw);
        if (!wanted.has(d)) continue;
        if ((CLOSED_FOLLOWUP_STATUSES as string[]).includes(row.status)) booked.add(d);
        if (!followupByPhone.has(d) && !(CLOSED_FOLLOWUP_STATUSES as string[]).includes(row.status)) {
          followupByPhone.set(d, {
            id: row.id,
            status: row.status,
            deferCount: row.deferCount,
            handlerName: row.handledBy?.name?.trim() || null,
            inquiryId: row.inquiryId,
            customerPhone: row.customerPhone,
            customerPhone2: row.customerPhone2,
          });
        }
      }
    }
  }

  const open = windowed.filter((row) => !booked.has(row.customerPhoneDigits));
  const asap = open.filter((row) => row.preferredKind === 'ASAP').sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime());
  const week = open
    .filter((row) => row.preferredKind !== 'ASAP')
    .sort((a, b) => (a.preferredYmd ?? '').localeCompare(b.preferredYmd ?? '') || b.fetchedAt.getTime() - a.fetchedAt.getTime());
  const ordered = [...asap, ...week];

  return {
    todayYmd: today,
    counts: { all: ordered.length, asap: asap.length, week: week.length },
    items: ordered.map((row) => toPublic(row, followupByPhone.get(row.customerPhoneDigits) ?? null, inquiryByPhone.get(row.customerPhoneDigits) ?? null)),
  };
}

function toPublic(
  row: LeadRow,
  followup: {
    id: string;
    status: OrderFollowupStatus;
    deferCount: number;
    handlerName: string | null;
    inquiryId: string | null;
    customerPhone: string;
    customerPhone2: string | null;
  } | null,
  inquiryId: string | null,
) {
  return {
    id: row.id,
    customerName: row.customerName,
    nickname: row.nickname,
    customerPhone: row.customerPhone,
    leadSource: row.leadSource,
    preferredKind: row.preferredKind as PreferredKind,
    preferredYmd: row.preferredYmd,
    preferredAnswerRaw: row.preferredAnswerRaw,
    serviceType: row.serviceType,
    address: row.address,
    areaPyeong: row.areaPyeong,
    fetchedAt: row.fetchedAt.toISOString(),
    inquiryId: followup?.inquiryId ?? inquiryId,
    followup,
  };
}
