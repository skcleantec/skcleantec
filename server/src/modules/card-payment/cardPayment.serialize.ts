import type { CardPayment, TenantPgOnboarding, TenantPgCredential } from '@prisma/client';

function kstYmd(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);
}

export function serializeCardPayment(
  row: CardPayment & {
    createdBy?: { id: string; name: string } | null;
    inquiry?: { id: string; inquiryNumber: string | null; customerName: string; customerPhone?: string | null } | null;
  },
) {
  return {
    id: row.id,
    inquiryId: row.inquiryId,
    inquiryNumber: row.inquiryNumber,
    method: row.method,
    payRail: row.payRail,
    status: row.status,
    amountWon: row.amountWon,
    tenantFeeBps: row.tenantFeeBps,
    platformCostBps: row.platformCostBps,
    tenantFeeWon: row.tenantFeeWon,
    platformCostWon: row.platformCostWon,
    platformSpreadWon: row.platformSpreadWon,
    tenantNetWon: row.tenantNetWon,
    customerName: row.customerName || row.inquiry?.customerName || '',
    customerPhone: row.inquiry?.customerPhone?.trim() || row.customerPhoneMasked,
    customerPhoneMasked: row.customerPhoneMasked,
    cardLast4: row.cardLast4,
    approvalNo: row.approvalNo,
    pgOrderId: row.pgOrderId,
    pgClerkNo: row.pgClerkNo,
    pgClerkCode: row.pgClerkCode,
    paidAt: row.paidAt?.toISOString() ?? null,
    failReason: row.failReason,
    cancelable: row.status === 'APPROVED' && row.paidAt != null && kstYmd(row.paidAt) === kstYmd(new Date()),
    cancelVia:
      row.status === 'APPROVED' && row.paidAt != null && kstYmd(row.paidAt) === kstYmd(new Date())
        ? row.method === 'CUSTOMER_LINK'
          ? ('api' as const)
          : ('seller' as const)
        : null,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy
      ? { id: row.createdBy.id, name: row.createdBy.name }
      : { id: row.createdById, name: '' },
  };
}

export function serializeOnboarding(row: TenantPgOnboarding) {
  return {
    id: row.id,
    status: row.status,
    businessName: row.businessName,
    bizNumber: row.bizNumber,
    representativeName: row.representativeName,
    representativeBirth: row.representativeBirth,
    addressLine: row.addressLine,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    bankName: row.bankName,
    bankAccount: row.bankAccount,
    accountHolder: row.accountHolder,
    websiteUrl: row.websiteUrl,
    note: row.note,
    businessKind: row.businessKind,
    businessCardImageUrl: row.businessCardImageUrl,
    consentTermsAt: row.consentTermsAt?.toISOString() ?? null,
    consentPrivacyAt: row.consentPrivacyAt?.toISOString() ?? null,
    consentThirdPartyAt: row.consentThirdPartyAt?.toISOString() ?? null,
    consentIllegalUseAt: row.consentIllegalUseAt?.toISOString() ?? null,
    consentMarketingAt: row.consentMarketingAt?.toISOString() ?? null,
    reviewToken: row.reviewToken,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    forwardedAt: row.forwardedAt?.toISOString() ?? null,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    platformMemo: row.platformMemo,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeCredentialPublic(row: TenantPgCredential | null) {
  if (!row) {
    return { connected: false as const };
  }
  return {
    connected: true as const,
    rail: row.rail,
    isActive: row.isActive,
    apiKeyLast4: row.apiKeyLast4,
    tidMasked: row.tidMasked,
    mid: row.mid,
    oid: row.oid,
    connectedAt: row.connectedAt.toISOString(),
  };
}
