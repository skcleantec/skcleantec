import type { Prisma, PrismaClient } from '@prisma/client';
import {
  getDefaultOperatingCompanyId,
} from '../operating-companies/operatingCompany.service.js';
import { parseOperatingCompanyConfig } from '../operating-companies/operatingCompany.schema.js';

/** @see shared/quotationDocument.ts */
function formatQuotationDocumentTitle(brandOrCompanyName: string): string {
  const name = brandOrCompanyName.trim();
  if (!name) return '견적서';
  return `${name} 견적서`;
}

type Db = PrismaClient | Prisma.TransactionClient;

export type QuotationOperatingCompanySummary = {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  isDefault: boolean;
};

export function serializeQuotationOperatingCompany(row: {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  config: unknown;
}): QuotationOperatingCompanySummary {
  const config = parseOperatingCompanyConfig(row.config);
  return {
    id: row.id,
    name: row.name,
    displayName: config.branding?.displayName?.trim() || row.name,
    slug: row.slug,
    isDefault: row.isDefault,
  };
}

export function resolveQuotationBrandDisplayName(
  operatingCompany: { name: string; config: unknown } | null | undefined,
  fallbackCompanyName?: string | null,
): string {
  if (operatingCompany) {
    const config = parseOperatingCompanyConfig(operatingCompany.config);
    return config.branding?.displayName?.trim() || operatingCompany.name.trim();
  }
  return fallbackCompanyName?.trim() || '';
}

export function resolveQuotationDocumentTitle(
  operatingCompany: { name: string; config: unknown } | null | undefined,
  fallbackCompanyName?: string | null,
): string {
  return formatQuotationDocumentTitle(
    resolveQuotationBrandDisplayName(operatingCompany, fallbackCompanyName),
  );
}

export async function resolveQuotationOperatingCompanyId(
  db: Db,
  tenantId: string,
  opts: {
    bodyValue?: unknown;
    inquiryId?: string | null;
    existingId?: string | null;
  },
): Promise<string | null | 'INVALID'> {
  if (opts.bodyValue !== undefined) {
    if (opts.bodyValue === null || opts.bodyValue === '') return null;
    if (typeof opts.bodyValue !== 'string') return 'INVALID';
    const id = opts.bodyValue.trim();
    const oc = await db.operatingCompany.findFirst({
      where: { id, tenantId, isActive: true },
      select: { id: true },
    });
    if (!oc) return 'INVALID';
    return oc.id;
  }

  if (opts.existingId) return opts.existingId;

  if (opts.inquiryId) {
    const inquiry = await db.inquiry.findFirst({
      where: { id: opts.inquiryId, tenantId },
      select: { operatingCompanyId: true },
    });
    if (inquiry?.operatingCompanyId) {
      const active = await db.operatingCompany.findFirst({
        where: { id: inquiry.operatingCompanyId, tenantId, isActive: true },
        select: { id: true },
      });
      if (active) return active.id;
    }
  }

  try {
    return await getDefaultOperatingCompanyId(db, tenantId);
  } catch {
    return null;
  }
}

export async function listQuotationEditorOperatingCompanies(
  db: Db,
  tenantId: string,
): Promise<QuotationOperatingCompanySummary[]> {
  const rows = await db.operatingCompany.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      isDefault: true,
      config: true,
    },
  });
  return rows.map(serializeQuotationOperatingCompany);
}
