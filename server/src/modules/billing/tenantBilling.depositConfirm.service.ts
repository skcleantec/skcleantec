import { prisma } from '../../lib/prisma.js';
import { confirmInvoicePayment } from './tenantBilling.service.js';
import { verifyDepositConfirmToken } from './tenantBilling.depositConfirmToken.js';

const TEST_PREVIEW = {
  tenantName: '연습·테스트',
  tenantSlug: 'test',
  amountKrw: 99000,
  dueDate: null as string | null,
  invoiceStatus: 'OVERDUE',
};

export type DepositConfirmPreview = {
  isTest: boolean;
  alreadyPaid: boolean;
  canConfirm: boolean;
  tenantName: string;
  tenantSlug: string;
  amountKrw: number;
  dueDate: string | null;
  invoiceStatus: string;
  tenantActivated: boolean;
  otherOverdueCount: number;
  message: string;
};

export type DepositConfirmResult = DepositConfirmPreview & {
  confirmed: boolean;
};

function previewMessage(input: {
  isTest: boolean;
  alreadyPaid: boolean;
  canConfirm: boolean;
  invoiceStatus: string;
  tenantActivated: boolean;
  otherOverdueCount: number;
}): string {
  if (input.isTest) {
    return '연습 메일입니다. 실제 업체는 활성화되지 않습니다.';
  }
  if (input.invoiceStatus === 'VOID') {
    return '이 청구는 이미 취소되어 입금 확인할 수 없습니다.';
  }
  if (input.alreadyPaid) {
    return input.tenantActivated
      ? '이미 입금이 확인된 청구입니다. 업체는 활성 상태입니다.'
      : `이미 입금이 확인된 청구입니다. 다른 연체 청구 ${input.otherOverdueCount}건이 남아 업체가 바로 활성화되지 않았습니다.`;
  }
  if (input.canConfirm) {
    return '입금이 맞다면 아래 버튼으로 이 업체를 바로 활성화할 수 있습니다.';
  }
  return '이 청구는 입금 확인할 수 없는 상태입니다.';
}

export async function previewDepositConfirm(token: string): Promise<DepositConfirmPreview> {
  const payload = verifyDepositConfirmToken(token);
  if (payload.test) {
    return {
      isTest: true,
      alreadyPaid: false,
      canConfirm: false,
      tenantName: TEST_PREVIEW.tenantName,
      tenantSlug: TEST_PREVIEW.tenantSlug,
      amountKrw: TEST_PREVIEW.amountKrw,
      dueDate: TEST_PREVIEW.dueDate,
      invoiceStatus: TEST_PREVIEW.invoiceStatus,
      tenantActivated: false,
      otherOverdueCount: 0,
      message: previewMessage({
        isTest: true,
        alreadyPaid: false,
        canConfirm: false,
        invoiceStatus: TEST_PREVIEW.invoiceStatus,
        tenantActivated: false,
        otherOverdueCount: 0,
      }),
    };
  }

  const invoice = await prisma.tenantInvoice.findFirst({
    where: { id: payload.invoiceId, tenantId: payload.tenantId },
    select: {
      status: true,
      amountKrw: true,
      dueDate: true,
      tenant: { select: { name: true, slug: true, status: true } },
    },
  });
  if (!invoice) {
    throw new Error('확인 링크가 올바르지 않거나 청구를 찾을 수 없습니다.');
  }

  const otherOverdueCount = await prisma.tenantInvoice.count({
    where: {
      tenantId: payload.tenantId,
      status: 'OVERDUE',
      id: { not: payload.invoiceId },
    },
  });
  const alreadyPaid = invoice.status === 'PAID';
  const canConfirm = invoice.status === 'ISSUED' || invoice.status === 'OVERDUE';
  const tenantActivated = invoice.tenant.status === 'ACTIVE' && otherOverdueCount === 0;

  return {
    isTest: false,
    alreadyPaid,
    canConfirm,
    tenantName: invoice.tenant.name,
    tenantSlug: invoice.tenant.slug,
    amountKrw: invoice.amountKrw,
    dueDate: invoice.dueDate.toISOString(),
    invoiceStatus: invoice.status,
    tenantActivated,
    otherOverdueCount,
    message: previewMessage({
      isTest: false,
      alreadyPaid,
      canConfirm,
      invoiceStatus: invoice.status,
      tenantActivated,
      otherOverdueCount,
    }),
  };
}

export async function confirmDepositByEmailToken(token: string): Promise<DepositConfirmResult> {
  const payload = verifyDepositConfirmToken(token);
  if (payload.test) {
    throw new Error('연습 메일의 결재확인은 업체를 활성화하지 않습니다.');
  }

  const preview = await previewDepositConfirm(token);
  if (preview.alreadyPaid) {
    return { ...preview, confirmed: false };
  }
  if (!preview.canConfirm) {
    throw new Error(preview.message);
  }

  await confirmInvoicePayment(payload.invoiceId, null, payload.tenantId);

  const after = await previewDepositConfirm(token);
  const tenantActivated = after.tenantActivated;
  const message = tenantActivated
    ? '입금을 확인했습니다. 업체가 활성화되었습니다.'
    : `이 청구는 확인했습니다. 다른 연체 청구 ${after.otherOverdueCount}건이 남아 업체가 바로 활성화되지 않았습니다.`;

  return {
    ...after,
    alreadyPaid: true,
    canConfirm: false,
    confirmed: true,
    message,
  };
}
