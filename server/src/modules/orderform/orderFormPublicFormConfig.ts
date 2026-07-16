import type { PrismaClient } from '@prisma/client';
import { ORDER_FORM_CONFIG_DEFAULTS } from '../../constants/orderFormConfigDefaults.js';
import { getOrCreateOrderFormConfig } from '../tenants/tenantConfigSeed.service.js';
import { getOrCreateOrderFormBrandCustomerLinkConfig } from './orderFormBrandCustomerLink.service.js';

type Db = PrismaClient;

export type PublicFormConfig = {
  formTitle: string;
  priceLabel: string;
  reviewEventText: string;
  footerNotice1: string;
  footerNotice2: string;
  infoContent: string | null;
  infoLinkText: string;
  submitSuccessTitle: string;
  submitSuccessBody: string;
  timeSlotAckTitle: string;
  timeSlotAckBody: string;
  timeSlotAckConsentHint: string;
};

type FormConfigRow = {
  formTitle: string;
  priceLabel: string | null;
  reviewEventText: string | null;
  footerNotice1: string | null;
  footerNotice2: string | null;
  infoContent: string | null;
  infoLinkText: string | null;
  submitSuccessTitle: string | null;
  submitSuccessBody: string | null;
  timeSlotAckTitle?: string | null;
  timeSlotAckBody?: string | null;
  timeSlotAckConsentHint?: string | null;
};

const DEFAULT_FORM_CONFIG = {
  ...ORDER_FORM_CONFIG_DEFAULTS,
  infoContent: null as string | null,
};

/** 고객용: DB에 ""·null이 있어도 기본 문구로 내려줌 */
export function resolvedPublicFormConfig(row: FormConfigRow): PublicFormConfig {
  const d = DEFAULT_FORM_CONFIG;
  const line = (v: string | null | undefined, def: string) => {
    const t = v != null ? String(v).trim() : '';
    return t || def;
  };
  const infoTrimmed = row.infoContent != null ? String(row.infoContent).trim() : '';
  return {
    formTitle: line(row.formTitle, d.formTitle),
    priceLabel: line(row.priceLabel, d.priceLabel),
    reviewEventText:
      row.reviewEventText == null ? d.reviewEventText : String(row.reviewEventText).trim(),
    footerNotice1: line(row.footerNotice1, d.footerNotice1),
    footerNotice2: line(row.footerNotice2, d.footerNotice2),
    infoContent: infoTrimmed || null,
    infoLinkText: line(row.infoLinkText, d.infoLinkText),
    submitSuccessTitle: line(row.submitSuccessTitle, d.submitSuccessTitle),
    submitSuccessBody: line(row.submitSuccessBody, d.submitSuccessBody),
    timeSlotAckTitle: line(row.timeSlotAckTitle, d.timeSlotAckTitle),
    timeSlotAckBody: line(row.timeSlotAckBody, d.timeSlotAckBody),
    timeSlotAckConsentHint: line(row.timeSlotAckConsentHint, d.timeSlotAckConsentHint),
  };
}

function brandOverlayOnTenantFormConfig(
  tenantCfg: Awaited<ReturnType<typeof getOrCreateOrderFormConfig>>,
  brandCfg: Awaited<ReturnType<typeof getOrCreateOrderFormBrandCustomerLinkConfig>>,
): FormConfigRow {
  const pick = (brandVal: string | null | undefined, tenantVal: string | null | undefined) => {
    if (brandVal == null) return tenantVal ?? null;
    const t = String(brandVal).trim();
    return t ? brandVal : tenantVal ?? null;
  };
  return {
    formTitle: pick(brandCfg.formTitle, tenantCfg.formTitle) ?? tenantCfg.formTitle,
    priceLabel: brandCfg.priceLabel ?? tenantCfg.priceLabel,
    reviewEventText:
      brandCfg.reviewEventText !== undefined && brandCfg.reviewEventText !== null
        ? brandCfg.reviewEventText
        : tenantCfg.reviewEventText,
    footerNotice1: brandCfg.footerNotice1 ?? tenantCfg.footerNotice1,
    footerNotice2: brandCfg.footerNotice2 ?? tenantCfg.footerNotice2,
    infoContent: tenantCfg.infoContent,
    infoLinkText: tenantCfg.infoLinkText,
    submitSuccessTitle: tenantCfg.submitSuccessTitle,
    submitSuccessBody: tenantCfg.submitSuccessBody,
    timeSlotAckTitle: tenantCfg.timeSlotAckTitle,
    timeSlotAckBody: tenantCfg.timeSlotAckBody,
    timeSlotAckConsentHint: tenantCfg.timeSlotAckConsentHint,
  };
}

/** 발주서 건의 브랜드(operatingCompany) 문구를 반영한 고객용 formConfig */
export async function resolvePublicFormConfigForOrderForm(
  db: Db,
  tenantId: string,
  operatingCompanyId?: string | null,
): Promise<PublicFormConfig> {
  const tenantCfg = await getOrCreateOrderFormConfig(db, tenantId);
  const ocId = operatingCompanyId?.trim();
  if (!ocId) return resolvedPublicFormConfig(tenantCfg);
  try {
    const brandCfg = await getOrCreateOrderFormBrandCustomerLinkConfig(db, tenantId, ocId);
    return resolvedPublicFormConfig(brandOverlayOnTenantFormConfig(tenantCfg, brandCfg));
  } catch {
    return resolvedPublicFormConfig(tenantCfg);
  }
}
