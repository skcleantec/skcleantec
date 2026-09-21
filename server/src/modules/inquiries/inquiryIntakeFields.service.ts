import type { Prisma, PrismaClient } from '@prisma/client';
import type { InquiryIntakeFormProfile } from '../../lib/inquiryFormProfile.js';
import {
  INQUIRY_INTAKE_FIELD_CATALOG,
  INQUIRY_INTAKE_FIELD_GROUPS,
  inquiryIntakeKeysForDisplay,
  normalizeInquiryIntakeKeys,
  parseStoredInquiryIntakeKeys,
} from '../../lib/inquiryIntakeFields.js';

type Db = PrismaClient | Prisma.TransactionClient;

const SECTION_TOGGLE_KEYS = ['photos', 'professionalOptions'] as const;

export async function readTenantInquiryIntakeKeys(db: Db, tenantId: string): Promise<string[] | null> {
  const row = await db.tenant.findFirst({
    where: { id: tenantId },
    select: { inquiryIntakeSystemFieldKeys: true },
  });
  return parseStoredInquiryIntakeKeys(row?.inquiryIntakeSystemFieldKeys);
}

export function applyTenantInquiryIntakeOverlay(
  profile: InquiryIntakeFormProfile,
  tenantKeys: string[] | null,
): InquiryIntakeFormProfile {
  if (!tenantKeys) return profile;
  if (!profile.isDefault) return profile;
  const sectionOffKeys = [...profile.sectionOffKeys];
  for (const key of SECTION_TOGGLE_KEYS) {
    if (!tenantKeys.includes(key) && !sectionOffKeys.includes(key)) {
      sectionOffKeys.push(key);
    }
  }
  return {
    ...profile,
    isDefault: false,
    systemFieldKeys: tenantKeys,
    sectionOffKeys,
  };
}

export async function getTenantInquiryIntakeFieldsState(db: Db, tenantId: string) {
  const stored = await readTenantInquiryIntakeKeys(db, tenantId);
  const keys = inquiryIntakeKeysForDisplay(stored);
  return {
    customized: stored != null,
    keys,
    groups: INQUIRY_INTAKE_FIELD_GROUPS.map((group) => ({
      id: group.id,
      title: group.title,
      items: INQUIRY_INTAKE_FIELD_CATALOG.filter((f) => f.group === group.id).map((f) => ({
        key: f.key,
        label: f.label,
        locked: f.locked,
        on: keys.includes(f.key),
      })),
    })),
  };
}

export async function saveTenantInquiryIntakeFields(db: Db, tenantId: string, keysRaw: unknown) {
  if (!Array.isArray(keysRaw)) {
    throw new Error('칸 목록이 올바르지 않습니다.');
  }
  const keys = normalizeInquiryIntakeKeys(keysRaw.map((x) => String(x)));
  const owned = await db.tenant.findFirst({
    where: { id: tenantId },
    select: { id: true },
  });
  if (!owned) {
    throw new Error('업체를 찾을 수 없습니다.');
  }
  await db.tenant.update({
    where: { id: tenantId },
    data: { inquiryIntakeSystemFieldKeys: keys },
  });
  return getTenantInquiryIntakeFieldsState(db, tenantId);
}
