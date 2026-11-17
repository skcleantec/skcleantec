import { prisma } from '../../lib/prisma.js';
import { ensureTenantBillingProfile } from '../billing/tenantBilling.profile.service.js';
import { sendAlimtalkOpsMail } from './alimtalkBarobillOpsMail.js';

export const DEFAULT_BRAND_SETUP_FEE_KRW = 99000;
export const DEFAULT_BRAND_CUSTOM_COPY_FEE_KRW = 30000;

export async function readBrandChannelFees(): Promise<{ setupFeeKrw: number; customCopyFeeKrw: number }> {
  const row = await prisma.platformBillingSettings.findUnique({
    where: { id: 'default' },
    select: { alimtalkBrandSetupFeeKrw: true, alimtalkBrandCustomCopyFeeKrw: true },
  });
  return {
    setupFeeKrw: row?.alimtalkBrandSetupFeeKrw ?? DEFAULT_BRAND_SETUP_FEE_KRW,
    customCopyFeeKrw: row?.alimtalkBrandCustomCopyFeeKrw ?? DEFAULT_BRAND_CUSTOM_COPY_FEE_KRW,
  };
}

export async function saveBrandChannelFees(input: {
  setupFeeKrw: number;
  customCopyFeeKrw: number;
}): Promise<void> {
  await prisma.platformBillingSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      alimtalkBrandSetupFeeKrw: input.setupFeeKrw,
      alimtalkBrandCustomCopyFeeKrw: input.customCopyFeeKrw,
    },
    update: {
      alimtalkBrandSetupFeeKrw: input.setupFeeKrw,
      alimtalkBrandCustomCopyFeeKrw: input.customCopyFeeKrw,
    },
  });
}

export function brandChannelFeeSourceKey(channelId: string): string {
  return `alimtalk-channel:${channelId}`;
}

export const BRAND_CHANNEL_FEE_SOURCE_PREFIX = 'alimtalk-channel:';

export type VatInclusiveSplit = { grossKrw: number; supplyKrw: number; vatKrw: number };

/** 부가세 포함 금액을 공급가와 부가세(10%)로 나눈다. 99,000원 → 90,000 + 9,000. */
export function splitVatInclusiveKrw(grossKrw: number): VatInclusiveSplit {
  const gross = Math.max(0, Math.round(grossKrw));
  const supplyKrw = Math.round(gross / 1.1);
  return { grossKrw: gross, supplyKrw, vatKrw: gross - supplyKrw };
}

export function planBrandChannelRequest(input: { setupFeeExcluded: boolean; grossKrw: number }):
  | { status: 'REQUESTED'; charge: null }
  | { status: 'PAYMENT_PENDING'; charge: VatInclusiveSplit } {
  if (input.setupFeeExcluded || input.grossKrw <= 0) return { status: 'REQUESTED', charge: null };
  return { status: 'PAYMENT_PENDING', charge: splitVatInclusiveKrw(input.grossKrw) };
}

/** 입금완료된 세팅비 청구는 연결 대기로 넘긴다. */
export function brandChannelStatusAfterDeposit(status: string): 'REQUESTED' | null {
  return status === 'PAYMENT_PENDING' ? 'REQUESTED' : null;
}

export function setupFeeChargeLabel(brandName: string, split: VatInclusiveSplit): string {
  const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;
  return `카카오 채널 세팅 · ${brandName} (공급가 ${won(split.supplyKrw)} · 부가세 ${won(split.vatKrw)} · 합계 ${won(split.grossKrw)})`;
}

/** 신청 즉시 1회 청구서를 낸다. 청구서 금액은 공급가이고, 카드·입금 정산이 부가세를 더한다. */
export async function issueBrandChannelSetupInvoice(channelId: string): Promise<void> {
  const channel = await prisma.alimtalkBrandChannel.findUnique({
    where: { id: channelId },
    include: { operatingCompany: { select: { name: true } }, tenant: { select: { plan: true } } },
  });
  if (!channel || channel.status !== 'PAYMENT_PENDING' || channel.setupFeeExcluded) return;
  const plan = planBrandChannelRequest({ setupFeeExcluded: false, grossKrw: channel.setupFeeKrw });
  if (!plan.charge) return;
  const sourceKey = brandChannelFeeSourceKey(channel.id);
  const existing = await prisma.tenantBillingOneTimeCharge.findUnique({ where: { sourceKey } });
  if (existing?.invoiceId && !existing.voidedAt) return;
  const label = setupFeeChargeLabel(channel.operatingCompany.name, plan.charge);
  const now = new Date();
  const profile = await ensureTenantBillingProfile(channel.tenantId);
  const invoice = await prisma.tenantInvoice.create({
    data: {
      tenantId: channel.tenantId,
      periodStart: now,
      periodEnd: now,
      billingCycle: profile.billingCycle,
      plan: channel.tenant.plan,
      amountKrw: plan.charge.supplyKrw,
      catalogAmountKrw: plan.charge.supplyKrw,
      dueDate: now,
      status: 'ISSUED',
      source: 'MANUAL',
      memo: label,
    },
  });
  if (existing) {
    await prisma.tenantBillingOneTimeCharge.update({
      where: { id: existing.id },
      data: { invoiceId: invoice.id, voidedAt: null, amountKrw: plan.charge.supplyKrw, label },
    });
  } else {
    await prisma.tenantBillingOneTimeCharge.create({
      data: {
        tenantId: channel.tenantId,
        label,
        amountKrw: plan.charge.supplyKrw,
        sourceKey,
        invoiceId: invoice.id,
      },
    });
  }
  await prisma.alimtalkBrandChannel.update({
    where: { id: channel.id },
    data: { setupFeeBilledAt: now },
  });
}

export async function notifyBrandChannelConnectionStart(channelId: string, paid: boolean): Promise<void> {
  const channel = await prisma.alimtalkBrandChannel.findUnique({
    where: { id: channelId },
    include: { tenant: { select: { name: true } }, operatingCompany: { select: { name: true } } },
  });
  if (!channel) return;
  await sendAlimtalkOpsMail(
    paid ? '[청소비서] 입금 확인 · 연결 시작' : '[청소비서] 카카오 채널 연결 시작',
    [
      paid ? '세팅비 입금이 확인되어 채널 연결을 시작합니다.' : '세팅비 없이 채널 연결을 시작합니다.',
      '',
      `업체: ${channel.tenant.name}`,
      `브랜드: ${channel.operatingCompany.name}`,
      `채널 아이디: ${channel.searchId}`,
      `연락처: ${channel.adminPhone}`,
    ].join('\n'),
  );
}

/** 세팅비 청구서가 입금완료되면 입금 대기를 연결 대기로 바꾼다. */
export async function advanceBrandChannelAfterSetupPaid(invoiceId: string): Promise<void> {
  const charges = await prisma.tenantBillingOneTimeCharge.findMany({
    where: { invoiceId, voidedAt: null, sourceKey: { startsWith: BRAND_CHANNEL_FEE_SOURCE_PREFIX } },
    select: { sourceKey: true },
  });
  for (const charge of charges) {
    const channelId = charge.sourceKey.slice(BRAND_CHANNEL_FEE_SOURCE_PREFIX.length);
    const channel = await prisma.alimtalkBrandChannel.findUnique({
      where: { id: channelId },
      select: { status: true },
    });
    if (brandChannelStatusAfterDeposit(channel?.status ?? '') !== 'REQUESTED') continue;
    await prisma.alimtalkBrandChannel.update({ where: { id: channelId }, data: { status: 'REQUESTED' } });
    await notifyBrandChannelConnectionStart(channelId, true);
  }
}

/** 세팅비 제외. 아직 안 낸 청구는 취소하고, 입금 대기면 바로 연결 대기로 보낸다. */
export async function releaseBrandChannelSetupFee(channelId: string): Promise<void> {
  const channel = await prisma.alimtalkBrandChannel.findUnique({ where: { id: channelId }, select: { status: true } });
  if (!channel) return;
  const charge = await prisma.tenantBillingOneTimeCharge.findUnique({
    where: { sourceKey: brandChannelFeeSourceKey(channelId) },
  });
  if (charge && !charge.voidedAt && charge.invoiceId) {
    const invoice = await prisma.tenantInvoice.findUnique({ where: { id: charge.invoiceId }, select: { status: true } });
    if (invoice && (invoice.status === 'ISSUED' || invoice.status === 'OVERDUE')) {
      await prisma.tenantInvoice.update({ where: { id: charge.invoiceId }, data: { status: 'VOID' } });
      await prisma.tenantBillingOneTimeCharge.update({ where: { id: charge.id }, data: { voidedAt: new Date() } });
    }
  } else if (charge && !charge.voidedAt && !charge.invoiceId) {
    await prisma.tenantBillingOneTimeCharge.update({ where: { id: charge.id }, data: { voidedAt: new Date() } });
  }
  if (channel.status !== 'PAYMENT_PENDING') return;
  await prisma.alimtalkBrandChannel.update({ where: { id: channelId }, data: { status: 'REQUESTED' } });
  await notifyBrandChannelConnectionStart(channelId, false);
}
