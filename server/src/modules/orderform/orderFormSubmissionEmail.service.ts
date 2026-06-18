import type { OrderFormSubmissionEmailStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { assertValidCustomerEmail } from '../../lib/customerEmail.js';
import {
  formatSmtpSendError,
  resolveSmtpTransportForOrderFormCustomerEmail,
  sendMailWithTransport,
} from '../../lib/tenantSmtp.service.js';
import { resolveQuotationBrandDisplayName } from '../quotations/quotationDocumentTitle.service.js';
import {
  buildOrderFormSubmissionEmailHtml,
  buildOrderFormSubmissionEmailPlainText,
  buildOrderFormSubmissionEmailSubject,
} from './orderFormSubmissionEmail.content.js';

export type OrderFormSubmissionEmailSendInput = {
  tenantId: string;
  orderFormId: string;
  operatingCompanyId: string | null;
  customerEmail: string;
  customerName: string;
  inquiryNumber: string | null;
  preferredDateYmd: string;
  preferredTime: string;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
};

async function resolveBrandDisplayName(
  tenantId: string,
  operatingCompanyId: string | null,
): Promise<string> {
  if (!operatingCompanyId) return '';
  const row = await prisma.operatingCompany.findFirst({
    where: { id: operatingCompanyId, tenantId },
    select: { name: true, config: true },
  });
  if (!row) return '';
  return resolveQuotationBrandDisplayName(row);
}

async function upsertSubmissionEmailLog(params: {
  tenantId: string;
  orderFormId: string;
  operatingCompanyId: string | null;
  toEmail: string;
  status: OrderFormSubmissionEmailStatus;
  lastError?: string | null;
  sentAt?: Date | null;
  incrementAttempt?: boolean;
}): Promise<void> {
  const existing = await prisma.orderFormSubmissionEmailLog.findFirst({
    where: { orderFormId: params.orderFormId, tenantId: params.tenantId },
    select: { id: true, attemptCount: true },
  });
  if (existing) {
    await prisma.orderFormSubmissionEmailLog.update({
      where: { id: existing.id },
      data: {
        toEmail: params.toEmail,
        operatingCompanyId: params.operatingCompanyId,
        status: params.status,
        lastError: params.lastError ?? null,
        sentAt: params.sentAt ?? null,
        attemptCount: params.incrementAttempt ? existing.attemptCount + 1 : existing.attemptCount,
      },
    });
    return;
  }
  await prisma.orderFormSubmissionEmailLog.create({
    data: {
      tenantId: params.tenantId,
      orderFormId: params.orderFormId,
      operatingCompanyId: params.operatingCompanyId,
      toEmail: params.toEmail,
      status: params.status,
      lastError: params.lastError ?? null,
      sentAt: params.sentAt ?? null,
      attemptCount: 1,
    },
  });
}

export async function sendOrderFormSubmissionConfirmationEmail(
  input: OrderFormSubmissionEmailSendInput,
): Promise<OrderFormSubmissionEmailStatus> {
  const toEmail = assertValidCustomerEmail(input.customerEmail);
  const transport = await resolveSmtpTransportForOrderFormCustomerEmail(
    input.tenantId,
    input.operatingCompanyId,
  );

  if (!transport) {
    await upsertSubmissionEmailLog({
      tenantId: input.tenantId,
      orderFormId: input.orderFormId,
      operatingCompanyId: input.operatingCompanyId,
      toEmail,
      status: 'SKIPPED_NO_SMTP',
      lastError: '발송 SMTP가 설정되지 않았습니다. (영업 브랜드 또는 공통 기본)',
      sentAt: null,
      incrementAttempt: true,
    });
    return 'SKIPPED_NO_SMTP';
  }

  const brandDisplayName = await resolveBrandDisplayName(input.tenantId, input.operatingCompanyId);
  const contentInput = {
    brandDisplayName,
    customerName: input.customerName,
    inquiryNumber: input.inquiryNumber,
    preferredDateYmd: input.preferredDateYmd,
    preferredTime: input.preferredTime,
    totalAmount: input.totalAmount,
    depositAmount: input.depositAmount,
    balanceAmount: input.balanceAmount,
  };
  const subject = buildOrderFormSubmissionEmailSubject(contentInput);
  const text = buildOrderFormSubmissionEmailPlainText(contentInput);
  const html = buildOrderFormSubmissionEmailHtml(contentInput);

  try {
    await sendMailWithTransport(transport, { to: toEmail, subject, text, html });
    await upsertSubmissionEmailLog({
      tenantId: input.tenantId,
      orderFormId: input.orderFormId,
      operatingCompanyId: input.operatingCompanyId,
      toEmail,
      status: 'SENT',
      lastError: null,
      sentAt: new Date(),
      incrementAttempt: true,
    });
    return 'SENT';
  } catch (e) {
    const msg = formatSmtpSendError(e);
    console.error('[orderform-submission-email] send failed', msg, e);
    await upsertSubmissionEmailLog({
      tenantId: input.tenantId,
      orderFormId: input.orderFormId,
      operatingCompanyId: input.operatingCompanyId,
      toEmail,
      status: 'FAILED',
      lastError: msg,
      sentAt: null,
      incrementAttempt: true,
    });
    return 'FAILED';
  }
}

export async function loadOrderFormSubmissionEmailStatus(
  tenantId: string,
  orderFormId: string,
): Promise<{
  status: OrderFormSubmissionEmailStatus | null;
  toEmail: string | null;
  lastError: string | null;
} | null> {
  const row = await prisma.orderFormSubmissionEmailLog.findFirst({
    where: { tenantId, orderFormId },
    select: { status: true, toEmail: true, lastError: true },
  });
  if (!row) return null;
  return { status: row.status, toEmail: row.toEmail, lastError: row.lastError };
}

/** 제출 성공 직후 비동기 발송(제출 API 응답은 기다리지 않음) */
export function queueOrderFormSubmissionConfirmationEmail(
  input: OrderFormSubmissionEmailSendInput,
): void {
  void sendOrderFormSubmissionConfirmationEmail(input).catch((e) => {
    console.error('[orderform-submission-email] unhandled', e);
  });
}

export function serializeSubmissionEmailLog(row: {
  status: OrderFormSubmissionEmailStatus;
  toEmail: string;
  lastError: string | null;
  sentAt: Date | null;
} | null | undefined) {
  if (!row) return null;
  return {
    status: row.status,
    toEmail: row.toEmail,
    lastError: row.lastError,
    sentAt: row.sentAt?.toISOString() ?? null,
  };
}
