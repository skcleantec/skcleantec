import { prisma } from '../../lib/prisma.js';

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

/** 채널이 연결되면 다음 이용료 청구에 세팅비 1회를 올린다. 면제 업체도 포함한다. */
export async function ensureBrandChannelSetupFee(channelId: string): Promise<void> {
  const channel = await prisma.alimtalkBrandChannel.findUnique({
    where: { id: channelId },
    include: { operatingCompany: { select: { name: true } } },
  });
  if (!channel) return;
  const sourceKey = brandChannelFeeSourceKey(channel.id);
  const existing = await prisma.tenantBillingOneTimeCharge.findUnique({ where: { sourceKey } });
  if (channel.setupFeeExcluded || channel.setupFeeKrw <= 0) {
    if (existing && !existing.invoiceId && !existing.voidedAt) {
      await prisma.tenantBillingOneTimeCharge.update({
        where: { id: existing.id },
        data: { voidedAt: new Date() },
      });
    }
    return;
  }
  if (existing) {
    if (existing.voidedAt && !existing.invoiceId) {
      await prisma.tenantBillingOneTimeCharge.update({
        where: { id: existing.id },
        data: { voidedAt: null, amountKrw: channel.setupFeeKrw, label: `카카오 채널 세팅 · ${channel.operatingCompany.name}` },
      });
    }
    return;
  }
  await prisma.tenantBillingOneTimeCharge.create({
    data: {
      tenantId: channel.tenantId,
      label: `카카오 채널 세팅 · ${channel.operatingCompany.name}`,
      amountKrw: channel.setupFeeKrw,
      sourceKey,
    },
  });
}
