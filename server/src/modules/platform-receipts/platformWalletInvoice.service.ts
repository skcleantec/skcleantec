import { randomBytes } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { TAXINVOICE_COST_KRW } from '../../lib/barobill/policy.js';
import { readPlatformIssuer, refreshPlatformIssuerCert } from './platformIssuer.js';
import {
  registAndIssueTaxInvoice,
  cancelIssuedTaxInvoice,
  fetchTaxInvoiceStates,
} from '../taxinvoice/taxInvoice.barobill.js';

function kstYmd(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function isSameKstDay(a: Date, b: Date): boolean {
  return kstYmd(a) === kstYmd(b);
}

export async function ensureSkippedForCardPayment(paymentId: string): Promise<void> {
  const existing = await prisma.platformWalletInvoice.findUnique({ where: { paymentId } });
  if (existing) return;
  const payment = await prisma.usageFeeCardPayment.findFirst({ where: { id: paymentId } });
  if (!payment) return;
  await prisma.platformWalletInvoice.create({
    data: {
      paymentId,
      tenantId: payment.tenantId ?? '',
      status: 'SKIPPED',
      costKrw: 0,
    },
  });
}

export async function scheduleIssueForBankWalletPayment(paymentId: string): Promise<void> {
  const payment = await prisma.usageFeeCardPayment.findFirst({ where: { id: paymentId } });
  if (!payment || !payment.tenantId) return;
  if (payment.payMethod !== 'BANK' || payment.status !== 'APPROVED') return;

  const existing = await prisma.platformWalletInvoice.findUnique({ where: { paymentId } });
  if (existing) return;

  const walletInvoice = await prisma.platformWalletInvoice.create({
    data: {
      paymentId,
      tenantId: payment.tenantId,
      status: 'PENDING',
      costKrw: 0,
    },
  });

  setImmediate(() => {
    void issueWalletTaxInvoice(walletInvoice.id, payment).catch((err) => {
      console.error('[platform-wallet-invoice] async issue error', err instanceof Error ? err.message : err);
    });
  });
}

async function issueWalletTaxInvoice(
  walletInvoiceId: string,
  payment: {
    id: string;
    tenantId: string | null;
    supplyAmountKrw: number;
    vatAmountKrw: number;
    paidAt: Date;
  },
): Promise<void> {
  if (!payment.tenantId) {
    await prisma.platformWalletInvoice.update({
      where: { id: walletInvoiceId },
      data: { status: 'FAILED', error: '업체 ID 없음' },
    });
    return;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: payment.tenantId },
    select: { config: true },
  });
  const cfg = (tenant?.config as Record<string, unknown> | null) ?? {};
  const companyReg = (cfg.companyRegistration as Record<string, string> | undefined) ?? {};
  const bizNo = (companyReg.businessRegistrationNo ?? '').replace(/\D/g, '');
  const corpName = (companyReg.companyName ?? '').trim();

  if (!bizNo || !corpName) {
    await prisma.platformWalletInvoice.update({
      where: { id: walletInvoiceId },
      data: { status: 'FAILED', error: '업체 사업자정보 없음' },
    });
    return;
  }

  let issuer;
  try {
    issuer = readPlatformIssuer();
  } catch (err) {
    await prisma.platformWalletInvoice.update({
      where: { id: walletInvoiceId },
      data: { status: 'FAILED', error: err instanceof Error ? err.message.slice(0, 500) : '발행자 환경변수 없음' },
    });
    return;
  }

  const { valid } = await refreshPlatformIssuerCert().catch(() => ({ valid: false, expireDate: null }));
  if (!valid) {
    await prisma.platformWalletInvoice.update({
      where: { id: walletInvoiceId },
      data: { status: 'FAILED', error: '서비스브릿지 인증서 미등록' },
    });
    return;
  }

  const mgtKey = `pwi${randomBytes(10).toString('hex')}`;
  const writeDate = kstYmd(payment.paidAt);
  const ceoName = (companyReg.representativeName ?? '').trim();
  const addr = (companyReg.addressLine ?? '').trim();
  const email = (companyReg.contactEmail ?? '').trim();

  try {
    await registAndIssueTaxInvoice({
      corpNum: issuer.corpNum,
      userId: issuer.barobillUserId,
      mgtKey,
      corpName: issuer.corpName,
      ceoName: issuer.ceoName,
      addr: issuer.addr,
      bizType: issuer.bizType,
      bizClass: issuer.bizClass,
      email: issuer.email,
      tel: issuer.tel,
      contactName: issuer.contactName,
      buyerCorpNum: bizNo,
      buyerCorpName: corpName,
      buyerCeoName: ceoName,
      buyerAddr: addr,
      buyerEmail: email,
      buyerContactName: ceoName || corpName,
      buyerBizType: '',
      buyerBizClass: '',
      writeDate,
      purposeType: 1,
      taxType: 1,
      taxInvoiceType: 1,
      supply: payment.supplyAmountKrw,
      tax: payment.vatAmountKrw,
      total: payment.supplyAmountKrw + payment.vatAmountKrw,
      lines: [
        {
          name: '청소비서 지갑 충전',
          supply: payment.supplyAmountKrw,
          tax: payment.vatAmountKrw,
        },
      ],
    });

    const [state] = await fetchTaxInvoiceStates({ corpNum: issuer.corpNum, mgtKeys: [mgtKey] }).catch(() => []);

    await prisma.platformWalletInvoice.update({
      where: { id: walletInvoiceId },
      data: {
        status: 'ISSUED',
        mgtKey,
        ntsSendKey: state?.ntsSendKey ?? null,
        costKrw: TAXINVOICE_COST_KRW,
        issuedAt: new Date(),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 500) : '발급 실패';
    console.error('[platform-wallet-invoice] issue failed', msg);
    await prisma.platformWalletInvoice.update({
      where: { id: walletInvoiceId },
      data: { status: 'FAILED', error: msg, mgtKey },
    }).catch(() => undefined);
  }
}

export async function cancelOrModifyForPayment(paymentId: string): Promise<void> {
  const walletInvoice = await prisma.platformWalletInvoice.findUnique({ where: { paymentId } });
  if (!walletInvoice || walletInvoice.status !== 'ISSUED' || !walletInvoice.mgtKey) return;

  let issuer;
  try {
    issuer = readPlatformIssuer();
  } catch {
    return;
  }

  const payment = await prisma.usageFeeCardPayment.findFirst({ where: { id: paymentId } });
  if (!payment) return;

  const sameDay = isSameKstDay(payment.paidAt, new Date());
  const ntsSent = walletInvoice.ntsSendKey && walletInvoice.ntsSendKey.length > 0;

  if (sameDay && !ntsSent) {
    try {
      await cancelIssuedTaxInvoice({ corpNum: issuer.corpNum, mgtKey: walletInvoice.mgtKey });
      await prisma.platformWalletInvoice.update({
        where: { id: walletInvoice.id },
        data: { status: 'ISSUED', cancelledAt: new Date() },
      });
    } catch (err) {
      console.error('[platform-wallet-invoice] cancel failed', err instanceof Error ? err.message : err);
    }
    return;
  }

  const cancelMgtKey = `pwi-m${randomBytes(10).toString('hex')}`;
  const tenant = await prisma.tenant.findUnique({
    where: { id: walletInvoice.tenantId },
    select: { config: true },
  });
  const cfg = (tenant?.config as Record<string, unknown> | null) ?? {};
  const companyReg = (cfg.companyRegistration as Record<string, string> | undefined) ?? {};
  const bizNo = (companyReg.businessRegistrationNo ?? '').replace(/\D/g, '');
  const corpName = (companyReg.companyName ?? '').trim();
  if (!bizNo || !corpName) return;

  try {
    await registAndIssueTaxInvoice({
      corpNum: issuer.corpNum,
      userId: issuer.barobillUserId,
      mgtKey: cancelMgtKey,
      corpName: issuer.corpName,
      ceoName: issuer.ceoName,
      addr: issuer.addr,
      bizType: issuer.bizType,
      bizClass: issuer.bizClass,
      email: issuer.email,
      tel: issuer.tel,
      contactName: issuer.contactName,
      buyerCorpNum: bizNo,
      buyerCorpName: corpName,
      buyerCeoName: (companyReg.representativeName ?? '').trim(),
      buyerAddr: (companyReg.addressLine ?? '').trim(),
      buyerEmail: (companyReg.contactEmail ?? '').trim(),
      buyerContactName: (companyReg.representativeName ?? corpName).trim(),
      buyerBizType: '',
      buyerBizClass: '',
      writeDate: kstYmd(new Date()),
      purposeType: 1,
      taxType: 1,
      taxInvoiceType: 1,
      supply: -payment.supplyAmountKrw,
      tax: -payment.vatAmountKrw,
      total: -(payment.supplyAmountKrw + payment.vatAmountKrw),
      lines: [
        {
          name: '청소비서 지갑 충전',
          supply: -payment.supplyAmountKrw,
          tax: -payment.vatAmountKrw,
        },
      ],
      modifyCode: '4',
    });
    await prisma.platformWalletInvoice.update({
      where: { id: walletInvoice.id },
      data: { cancelledAt: new Date() },
    });
  } catch (err) {
    console.error('[platform-wallet-invoice] modify cancel failed', err instanceof Error ? err.message : err);
  }
}

export async function retryFailedWalletInvoice(paymentId: string): Promise<void> {
  const walletInvoice = await prisma.platformWalletInvoice.findUnique({ where: { paymentId } });
  if (!walletInvoice || walletInvoice.status !== 'FAILED') {
    throw new Error('실패 상태 건만 재시도할 수 있습니다.');
  }

  await prisma.platformWalletInvoice.update({
    where: { id: walletInvoice.id },
    data: { status: 'PENDING', error: null },
  });

  const payment = await prisma.usageFeeCardPayment.findFirst({ where: { id: paymentId } });
  if (!payment) return;

  setImmediate(() => {
    void issueWalletTaxInvoice(walletInvoice.id, payment).catch((err) => {
      console.error('[platform-wallet-invoice] retry error', err instanceof Error ? err.message : err);
    });
  });
}

export async function getWalletInvoiceForPayment(paymentId: string) {
  return prisma.platformWalletInvoice.findUnique({
    where: { paymentId },
    select: { status: true, error: true, issuedAt: true, cancelledAt: true },
  });
}
