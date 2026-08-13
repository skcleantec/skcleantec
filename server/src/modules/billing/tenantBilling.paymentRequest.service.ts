import { prisma } from '../../lib/prisma.js';
import { ensurePlatformBillingSettings } from './tenantBilling.service.js';
import { TenantNotFoundError } from '../tenants/tenant.service.js';
import { notifyPaymentConfirmationRequestByEmail } from './tenantBilling.paymentRequest.email.js';
import {
  PLATFORM_SYSTEM_MAIL_FROM,
  resolvePlatformBillingNotifyEmail,
} from '../../lib/platformWorkspace.constants.js';

const REQUEST_COOLDOWN_MS = 60 * 60 * 1000;

export class PaymentConfirmationRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 429 | 503 = 400,
  ) {
    super(message);
    this.name = 'PaymentConfirmationRequestError';
  }
}

export type PaymentConfirmationRequestResult = {
  ok: true;
  emailSent: boolean;
  message: string;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** ADMIN — 미결재 청구서 입금 확인 요청 (플랫폼 알림 이메일) */
export async function requestTenantPaymentConfirmation(input: {
  tenantId: string;
  invoiceId?: string;
  requesterUserId: string;
  requesterName: string;
  requesterEmail: string;
}): Promise<PaymentConfirmationRequestResult> {
  const settings = await ensurePlatformBillingSettings();
  const notifyEmail = resolvePlatformBillingNotifyEmail(settings.dunningPaymentNotifyEmail);
  if (!notifyEmail) {
    throw new PaymentConfirmationRequestError(
      '입금 확인 알림 이메일이 설정되지 않았습니다. 플랫폼 관리자에게 문의해 주세요.',
      503,
    );
  }
  if (!isValidEmail(notifyEmail)) {
    throw new PaymentConfirmationRequestError('입금 확인 알림 이메일 형식이 올바르지 않습니다.', 503);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { id: true, name: true, slug: true },
  });
  if (!tenant) throw new TenantNotFoundError();

  const invoice = input.invoiceId
    ? await prisma.tenantInvoice.findFirst({
        where: {
          id: input.invoiceId,
          tenantId: input.tenantId,
          status: { in: ['ISSUED', 'OVERDUE'] },
        },
      })
    : await prisma.tenantInvoice.findFirst({
        where: {
          tenantId: input.tenantId,
          status: { in: ['ISSUED', 'OVERDUE'] },
        },
        orderBy: { dueDate: 'asc' },
      });

  if (!invoice) {
    throw new PaymentConfirmationRequestError('입금 확인을 요청할 미납 청구서가 없습니다.', 404);
  }

  const lastRequested = invoice.paymentConfirmationRequestedAt;
  if (lastRequested && Date.now() - lastRequested.getTime() < REQUEST_COOLDOWN_MS) {
    const minutesLeft = Math.ceil((REQUEST_COOLDOWN_MS - (Date.now() - lastRequested.getTime())) / 60000);
    throw new PaymentConfirmationRequestError(
      `최근에 입금 확인을 요청했습니다. ${minutesLeft}분 후에 다시 시도해 주세요.`,
      429,
    );
  }

  const mailResult = await notifyPaymentConfirmationRequestByEmail({
    notifyEmail,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    tenantId: tenant.id,
    invoiceId: invoice.id,
    amountKrw: invoice.amountKrw,
    dueDate: invoice.dueDate.toISOString(),
    invoiceStatus: invoice.status,
    requesterName: input.requesterName.trim() || input.requesterEmail,
    requesterEmail: input.requesterEmail,
  });

  await prisma.tenantInvoice.update({
    where: { id: invoice.id },
    data: { paymentConfirmationRequestedAt: new Date() },
  });

  if (!mailResult.sent) {
    if (mailResult.reason === 'SMTP_NOT_CONFIGURED') {
      throw new PaymentConfirmationRequestError(
        '메일 발송 설정이 되어 있지 않아 요청을 전달하지 못했습니다. 플랫폼 관리자에게 직접 연락해 주세요.',
        503,
      );
    }
    throw new PaymentConfirmationRequestError(
      smtpNotConfiguredMessage(mailResult.reason, mailResult.detail),
      503,
    );
  }

  return {
    ok: true,
    emailSent: true,
    message:
      '운영팀에 입금 확인 알림을 보냈습니다. 반영까지 시간이 걸릴 수 있으며, 업체 이메일로는 발송되지 않습니다.',
  };
}

export function isPaymentConfirmationRequestEnabled(
  notifyEmail: string | null | undefined,
): boolean {
  const email = resolvePlatformBillingNotifyEmail(notifyEmail);
  return isValidEmail(email);
}

const PAYMENT_NOTIFY_TEST_TENANT_NAME = '연습·테스트';

function smtpNotConfiguredMessage(reason: string | undefined, detail?: string): string {
  if (detail?.trim()) return detail.trim();
  if (reason === 'SMTP_NOT_CONFIGURED') {
    return 'SMTP가 설정되지 않았습니다. 플랫폼 설정 → SMTP에서 알림 메일 보내기를 저장한 뒤 다시 시도해 주세요.';
  }
  if (reason === 'SMTP_SEND_FAILED') {
    return 'SMTP 발송에 실패했습니다.';
  }
  return '알림 메일 발송에 실패했습니다.';
}

/** 플랫폼 — 입금 확인 요청 알림 연습 메일 (청구·요청 기록 없음) */
export async function sendPaymentConfirmationNotifyTestEmail(input?: {
  notifyEmail?: string | null;
  /** 비우면 notifyEmail로 발송. billing@ 그룹 대신 개인 메일로 SMTP만 확인할 때 사용 */
  testTo?: string | null;
}): Promise<{
  ok: true;
  message: string;
  to: string;
  subject: string;
  smtp: { authUser: string | null; from: string | null; host: string | null };
}> {
  const settings = await ensurePlatformBillingSettings();
  const notifyEmail = resolvePlatformBillingNotifyEmail(
    input?.notifyEmail?.trim() || settings.dunningPaymentNotifyEmail,
  );
  const to = (input?.testTo?.trim() || notifyEmail).trim();
  if (!to) {
    throw new PaymentConfirmationRequestError('알림 받을 이메일을 입력해 주세요.', 400);
  }
  if (!isValidEmail(to)) {
    throw new PaymentConfirmationRequestError('수신 이메일 형식을 확인해 주세요.', 400);
  }
  if (!isValidEmail(notifyEmail)) {
    throw new PaymentConfirmationRequestError('알림 받을 이메일 형식을 확인해 주세요.', 400);
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);

  const mailResult = await notifyPaymentConfirmationRequestByEmail({
    notifyEmail: to,
    tenantName: PAYMENT_NOTIFY_TEST_TENANT_NAME,
    tenantSlug: 'test',
    tenantId: '00000000-0000-0000-0000-000000000000',
    invoiceId: '00000000-0000-0000-0000-000000000001',
    amountKrw: 99000,
    dueDate: dueDate.toISOString(),
    invoiceStatus: 'OVERDUE',
    requesterName: '연습 발송',
    requesterEmail: PLATFORM_SYSTEM_MAIL_FROM,
  });

  if (!mailResult.sent) {
    throw new PaymentConfirmationRequestError(
      smtpNotConfiguredMessage(mailResult.reason, mailResult.detail),
      503,
    );
  }

  const subject = `[${PAYMENT_NOTIFY_TEST_TENANT_NAME}] 입금확인요청`;
  const { getPlatformSmtpSendDiagnostics } = await import('../../lib/platformSmtp.service.js');
  const smtpDiag = await getPlatformSmtpSendDiagnostics();

  return {
    ok: true,
    message: `${to}로 연습 메일을 보냈습니다. 제목: ${subject}. 발신 SMTP: ${smtpDiag.authUser ?? '(미설정)'} → From ${smtpDiag.from ?? '(미설정)'}`,
    to,
    subject,
    smtp: {
      authUser: smtpDiag.authUser,
      from: smtpDiag.from,
      host: smtpDiag.host,
    },
  };
}
