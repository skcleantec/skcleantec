import type { Prisma } from '@prisma/client';
import {
  normalizeBizNumber,
  normalizeSignupBusinessType,
  type SignupBusinessInput,
  validateSignupBusinessInput,
} from './signupBusiness.validation.js';

export type CreateTenantSignupBusinessInput = SignupBusinessInput & {
  tenantId: string;
  submittedAt?: Date;
};

export function parseSignupBusinessPayload(raw: unknown): SignupBusinessInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  const businessType = normalizeSignupBusinessType(body.businessType);
  if (!businessType) return null;
  return {
    businessType,
    bizNumber: body.bizNumber != null ? String(body.bizNumber) : null,
    businessName: body.businessName != null ? String(body.businessName) : null,
    representativeName: body.representativeName != null ? String(body.representativeName) : null,
    addressLine: body.addressLine != null ? String(body.addressLine) : null,
    businessRegistrationImageUrl:
      body.businessRegistrationImageUrl != null ? String(body.businessRegistrationImageUrl) : null,
    businessRegistrationImagePublicId:
      body.businessRegistrationImagePublicId != null
        ? String(body.businessRegistrationImagePublicId)
        : null,
    individualConfirmed: body.individualConfirmed === true || body.individualConfirmed === 'true',
    individualUsageNote: body.individualUsageNote != null ? String(body.individualUsageNote) : null,
  };
}

export function assertValidSignupBusinessInput(input: SignupBusinessInput): void {
  const err = validateSignupBusinessInput(input);
  if (err) {
    const e = new Error(err);
    e.name = 'SignupBusinessValidationError';
    throw e;
  }
}

export function buildTenantSignupBusinessCreateData(
  input: CreateTenantSignupBusinessInput,
): Prisma.TenantSignupBusinessCreateInput {
  assertValidSignupBusinessInput(input);
  const submittedAt = input.submittedAt ?? new Date();
  const base = {
    tenant: { connect: { id: input.tenantId } },
    businessType: input.businessType,
    submittedAt,
  };

  if (input.businessType === 'individual') {
    return {
      ...base,
      individualConfirmedAt: submittedAt,
      individualUsageNote: String(input.individualUsageNote ?? '').trim().slice(0, 256) || null,
    };
  }

  return {
    ...base,
    bizNumber: normalizeBizNumber(input.bizNumber),
    businessName: String(input.businessName ?? '').trim().slice(0, 128),
    representativeName: String(input.representativeName ?? '').trim().slice(0, 128),
    addressLine: String(input.addressLine ?? '').trim() || null,
    businessRegistrationImageUrl: String(input.businessRegistrationImageUrl ?? '').trim().slice(0, 2048),
    businessRegistrationImagePublicId:
      String(input.businessRegistrationImagePublicId ?? '').trim().slice(0, 512) || null,
  };
}

export async function createTenantSignupBusiness(
  tx: Prisma.TransactionClient,
  input: CreateTenantSignupBusinessInput,
) {
  return tx.tenantSignupBusiness.create({
    data: buildTenantSignupBusinessCreateData(input),
  });
}

export type PlatformTenantSignupBusinessPublic = {
  businessType: SignupBusinessInput['businessType'];
  bizNumber: string | null;
  businessName: string | null;
  representativeName: string | null;
  addressLine: string | null;
  businessRegistrationImageUrl: string | null;
  individualConfirmedAt: string | null;
  individualUsageNote: string | null;
  submittedAt: string;
  contactEmail: string | null;
  contactPhone: string | null;
};

type SignupBusinessRow = {
  businessType: string;
  bizNumber: string | null;
  businessName: string | null;
  representativeName: string | null;
  addressLine: string | null;
  businessRegistrationImageUrl: string | null;
  individualConfirmedAt: Date | null;
  individualUsageNote: string | null;
  submittedAt: Date;
};

export function serializeTenantSignupBusinessForPlatform(
  row: SignupBusinessRow,
  contact?: { recoveryEmail?: string | null; phone?: string | null } | null,
): PlatformTenantSignupBusinessPublic {
  const businessType = normalizeSignupBusinessType(row.businessType);
  if (!businessType) {
    throw new Error('invalid_signup_business_type');
  }
  return {
    businessType,
    bizNumber: row.bizNumber?.trim() || null,
    businessName: row.businessName?.trim() || null,
    representativeName: row.representativeName?.trim() || null,
    addressLine: row.addressLine?.trim() || null,
    businessRegistrationImageUrl: row.businessRegistrationImageUrl?.trim() || null,
    individualConfirmedAt: row.individualConfirmedAt?.toISOString() ?? null,
    individualUsageNote: row.individualUsageNote?.trim() || null,
    submittedAt: row.submittedAt.toISOString(),
    contactEmail: contact?.recoveryEmail?.trim() || null,
    contactPhone: contact?.phone?.trim() || null,
  };
}
