import { prisma } from '../../lib/prisma.js';
import { DEFAULT_LOFT_SURCHARGE_WON } from './telecrmAiQuoteLoft.js';

/** 브랜드 설정이 없으면 3만 원. 0이면 추가하지 않는다. */
export async function getTelecrmAiQuoteLoftAmount(
  tenantId: string,
  operatingCompanyId: string | null,
): Promise<number> {
  const brand = operatingCompanyId?.trim();
  if (!brand) return DEFAULT_LOFT_SURCHARGE_WON;
  const row = await prisma.telecrmAiQuoteLoftSetting.findFirst({
    where: { tenantId, operatingCompanyId: brand },
    select: { amountWon: true },
  });
  return row?.amountWon ?? DEFAULT_LOFT_SURCHARGE_WON;
}

export async function saveTelecrmAiQuoteLoftAmount(
  tenantId: string,
  operatingCompanyId: string,
  amountWon: number,
): Promise<number> {
  const row = await prisma.telecrmAiQuoteLoftSetting.upsert({
    where: { tenantId_operatingCompanyId: { tenantId, operatingCompanyId } },
    create: { tenantId, operatingCompanyId, amountWon },
    update: { amountWon },
  });
  return row.amountWon;
}
