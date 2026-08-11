import type { OrderFormSubmissionEmailStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { assertValidCustomerEmail } from '../../lib/customerEmail.js';
import {
  formatSmtpSendError,
  sendMailWithTransport,
} from '../../lib/tenantSmtp.service.js';
import {
  isPlatformCustomerMailConfigured,
  resolvePlatformCustomerMailTransport,
} from '../../lib/outboundEmailRouter.js';
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
  /** 제출 직후 전달(없으면 DB 스냅샷 조회) */
  customerSubmissionSnapshot?: unknown;
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
  const brandDisplayName = await resolveBrandDisplayName(input.tenantId, input.operatingCompanyId);

  const platformConfigured = await isPlatformCustomerMailConfigured('ORDER_FORM_SUBMISSION');
  const transport = platformConfigured
    ? await resolvePlatformCustomerMailTransport({
        purpose: 'ORDER_FORM_SUBMISSION',
        brandDisplayName,
      })
    : null;

  if (!transport) {
    await upsertSubmissionEmailLog({
      tenantId: input.tenantId,
      orderFormId: input.orderFormId,
      operatingCompanyId: input.operatingCompanyId,
      toEmail,
      status: 'SKIPPED_NO_PLATFORM_SMTP',
      lastError:
        '플랫폼 고객 발송 SMTP(noreply)가 설정되지 않았습니다. 플랫폼 설정 → SMTP 프로필을 확인해 주세요.',
      sentAt: null,
      incrementAttempt: true,
    });
    return 'SKIPPED_NO_PLATFORM_SMTP';
  }

  let snapshot = input.customerSubmissionSnapshot;
  if (snapshot == null) {
    const snapRow = await prisma.orderForm.findFirst({
      where: { id: input.orderFormId, tenantId: input.tenantId },
      select: { customerSubmissionSnapshot: true },
    });
    snapshot = snapRow?.customerSubmissionSnapshot ?? null;
  }

  const contentInput = {
    brandDisplayName,
    customerName: input.customerName,
    inquiryNumber: input.inquiryNumber,
    customerSubmissionSnapshot: snapshot,
    fallback: {
      preferredDateYmd: input.preferredDateYmd,
      preferredTime: input.preferredTime,
      totalAmount: input.totalAmount,
      depositAmount: input.depositAmount,
      balanceAmount: input.balanceAmount,
    },
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
