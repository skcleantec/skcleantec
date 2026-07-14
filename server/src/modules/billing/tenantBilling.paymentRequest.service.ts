import { prisma } from '../../lib/prisma.js';
import { ensurePlatformBillingSettings } from './tenantBilling.service.js';
import { TenantNotFoundError } from '../tenants/tenant.service.js';
import { notifyPaymentConfirmationRequestByEmail } from './tenantBilling.paymentRequest.email.js';

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
  const notifyEmail = settings.dunningPaymentNotifyEmail?.trim() ?? '';
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
    throw new PaymentConfirmationRequestError('알림 메일 발송에 실패했습니다.', 503);
  }

  return {
    ok: true,
    emailSent: true,
    message: '입금 확인 요청이 접수되었습니다. 확인 후 반영까지 시간이 걸릴 수 있습니다.',
  };
}

export function isPaymentConfirmationRequestEnabled(
  notifyEmail: string | null | undefined,
): boolean {
  const email = notifyEmail?.trim() ?? '';
  return Boolean(email && isValidEmail(email));
}
