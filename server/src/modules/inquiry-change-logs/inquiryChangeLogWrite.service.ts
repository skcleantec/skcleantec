import type { InquiryStatus, Prisma } from '@prisma/client';
import {
  resolveScheduleAlertKind,
  type ScheduleAlertKind,
} from './inquiryChangeLogs.helpers.js';
import { buildAmountDateChangeLines, formatInquiryDateKr } from '../inquiries/inquiryPatch.helpers.js';

export const INQUIRY_STATUS_LABEL: Record<string, string> = {
  PENDING: '대기',
  RECEIVED: '접수',
  DEPOSIT_PENDING: '입금대기',
  DEPOSIT_COMPLETED: '입금완료',
  ORDER_FORM_PENDING: '미제출',
  ASSIGNED: '분배완료',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  ON_HOLD: '보류',
  CANCELLED: '취소',
  CS_PROCESSING: 'C/S 처리중',
};

export function formatInquiryStatusLabel(v: unknown): string {
  if (v == null || v === '') return '(없음)';
  const s = String(v);
  return INQUIRY_STATUS_LABEL[s] ?? s;
}

function formatChangeText(v: unknown): string {
  if (v == null || v === '') return '(없음)';
  return String(v);
}

export function pushInquiryChangeLine(
  lines: string[],
  label: string,
  before: unknown,
  after: unknown,
  fmt: (v: unknown) => string = formatChangeText,
): void {
  if (before === after) return;
  if (String(before ?? '') === String(after ?? '')) return;
  lines.push(`${label}: ${fmt(before)} → ${fmt(after)}`);
}

export type CustomerOrderFormSubmitSnap = {
  status: InquiryStatus | string | null;
  preferredDate: Date | null;
  preferredTime: string | null;
  preferredTimeDetail: string | null;
  serviceTotalAmount: number | null;
  serviceDepositAmount: number | null;
  serviceBalanceAmount: number | null;
};

/** 고객 발주서 제출 시 날짜·시간·상태·금액 diff (첫 줄은 항상 「고객 발주서 제출」) */
export function buildCustomerOrderFormSubmitChangeLines(
  before: CustomerOrderFormSubmitSnap | null,
  after: CustomerOrderFormSubmitSnap,
): string[] {
  const lines: string[] = ['고객 발주서 제출'];

  if (!before) {
    pushInquiryChangeLine(lines, '상태', null, after.status, formatInquiryStatusLabel);
    if (after.preferredDate) {
      lines.push(`청소 희망일: (없음) → ${formatInquiryDateKr(after.preferredDate)}`);
    }
    pushInquiryChangeLine(lines, '희망 시간대', null, after.preferredTime);
    pushInquiryChangeLine(lines, '희망 시간 상세', null, after.preferredTimeDetail);
    const emptyAmountSnap = {
      preferredDate: null as Date | null,
      serviceTotalAmount: null as number | null,
      serviceDepositAmount: null as number | null,
      serviceBalanceAmount: null as number | null,
    };
    const amountOnly = buildAmountDateChangeLines(emptyAmountSnap, {
      preferredDate: null,
      serviceTotalAmount: after.serviceTotalAmount,
      serviceDepositAmount: after.serviceDepositAmount,
      serviceBalanceAmount: after.serviceBalanceAmount,
    });
    lines.push(...amountOnly);
    return lines;
  }

  lines.push(
    ...buildAmountDateChangeLines(
      {
        preferredDate: before.preferredDate,
        serviceTotalAmount: before.serviceTotalAmount,
        serviceDepositAmount: before.serviceDepositAmount,
        serviceBalanceAmount: before.serviceBalanceAmount,
      },
      {
        preferredDate: after.preferredDate,
        serviceTotalAmount: after.serviceTotalAmount,
        serviceDepositAmount: after.serviceDepositAmount,
        serviceBalanceAmount: after.serviceBalanceAmount,
      },
    ),
  );
  pushInquiryChangeLine(lines, '희망 시간대', before.preferredTime, after.preferredTime);
  pushInquiryChangeLine(lines, '희망 시간 상세', before.preferredTimeDetail, after.preferredTimeDetail);
  pushInquiryChangeLine(lines, '상태', before.status, after.status, formatInquiryStatusLabel);
  return lines;
}

export async function createInquiryChangeLogInTx(
  tx: Prisma.TransactionClient,
  params: {
    inquiryId: string;
    customerName: string;
    actorId: string | null;
    lines: string[];
  },
): Promise<{ id: string; scheduleAlertKind: ScheduleAlertKind | null }> {
  const scheduleAlertKind = resolveScheduleAlertKind(params.lines);
  const log = await tx.inquiryChangeLog.create({
    data: {
      inquiryId: params.inquiryId,
      customerName: params.customerName,
      actorId: params.actorId,
      lines: params.lines,
      scheduleAlertKind,
    },
  });
  return { id: log.id, scheduleAlertKind };
}
