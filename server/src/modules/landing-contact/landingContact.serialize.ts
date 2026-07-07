import type { LandingContactFormConfig, LandingContactInquiry, OperatingCompany, User } from '@prisma/client';
import { toOperatingCompanyPublicSummary } from '../operating-companies/operatingCompanyPublicSummary.js';
import { parseLandingContactCustomFields, resolveLandingContactCustomFields } from './landingContactForm.schema.js';

type Row = LandingContactInquiry & {
  operatingCompany: Pick<OperatingCompany, 'id' | 'name' | 'slug' | 'isActive' | 'config'>;
  assignedTo?: Pick<User, 'id' | 'name' | 'role'> | null;
  convertedBy?: Pick<User, 'id' | 'name' | 'role'> | null;
  inquiry?: { id: string; inquiryNumber: string | null; status: string } | null;
};

export function serializeLandingContactInquiry(row: Row) {
  return {
    id: row.id,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    content: row.content,
    customFieldValues: row.customFieldValues,
    status: row.status,
    source: row.source,
    sourcePageUrl: row.sourcePageUrl,
    memo: row.memo,
    operatingCompany: toOperatingCompanyPublicSummary(row.operatingCompany),
    assignedTo: row.assignedTo
      ? { id: row.assignedTo.id, name: row.assignedTo.name, role: row.assignedTo.role }
      : null,
    convertedBy: row.convertedBy
      ? { id: row.convertedBy.id, name: row.convertedBy.name, role: row.convertedBy.role }
      : null,
    convertedAt: row.convertedAt?.toISOString() ?? null,
    inquiry: row.inquiry
      ? {
          id: row.inquiry.id,
          inquiryNumber: row.inquiry.inquiryNumber,
          status: row.inquiry.status,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeLandingContactInquiries(rows: Row[]) {
  return rows.map(serializeLandingContactInquiry);
}

type ConfigRow = LandingContactFormConfig & {
  operatingCompany: Pick<OperatingCompany, 'id' | 'name' | 'slug' | 'isActive' | 'config'>;
};

export function serializeLandingContactFormConfig(row: ConfigRow) {
  const oc = toOperatingCompanyPublicSummary(row.operatingCompany);
  return {
    id: row.id,
    operatingCompanyId: row.operatingCompanyId,
    operatingCompanyName: row.operatingCompany.name,
    operatingCompanySlug: row.operatingCompany.slug,
    displayName: oc.displayName,
    title: row.title,
    introText: row.introText,
    customFields: resolveLandingContactCustomFields(row.customFields),
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeLandingContactPublicForm(row: ConfigRow) {
  const base = serializeLandingContactFormConfig(row);
  return {
    title: base.title,
    introText: base.introText,
    customFields: base.customFields,
    displayName: base.displayName,
    brandSlug: base.operatingCompanySlug,
    isActive: base.isActive,
  };
}
