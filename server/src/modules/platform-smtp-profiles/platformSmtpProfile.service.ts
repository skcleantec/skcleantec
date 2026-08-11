import type { PlatformSmtpProfile } from '@prisma/client';
import {
  OUTBOUND_EMAIL_PURPOSE_LABELS,
  OUTBOUND_EMAIL_PURPOSES,
  parseOutboundEmailPurposes,
  type OutboundEmailPurpose,
} from '../../lib/outboundEmailPurpose.js';
import { prisma } from '../../lib/prisma.js';
import {
  mergeSmtpConfigStored,
  type SmtpConfigPatch,
  smtpConfigStoredComplete,
} from '../../lib/smtpConfigStored.js';
import type { TenantSmtpConfigStored } from '../tenants/tenantConfig.schema.js';
import {
  extractSmtpLoginEmail,
  resolveStoredSmtpTransport,
  sendMailWithTransport,
  smtpPublicFromStored,
  formatSmtpSendError,
  type ResolvedSmtpTransport,
} from '../../lib/tenantSmtp.service.js';
import { normalizeSmtpSecret } from '../../lib/smtpConfigStored.js';

export type PlatformSmtpProfilePublic = {
  id: string;
  slug: string;
  label: string;
  enabled: boolean;
  purposes: OutboundEmailPurpose[];
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    from: string;
    passwordConfigured: boolean;
    configured: boolean;
  };
  defaultDisplayName: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type PlatformSmtpProfileCreateInput = {
  slug: string;
  label: string;
  enabled?: boolean;
  purposes?: OutboundEmailPurpose[];
  defaultDisplayName?: string;
  sortOrder?: number;
  smtp?: SmtpConfigPatch;
};

export type PlatformSmtpProfileUpdateInput = {
  slug?: string;
  label?: string;
  enabled?: boolean;
  purposes?: OutboundEmailPurpose[];
  defaultDisplayName?: string | null;
  sortOrder?: number;
  smtp?: SmtpConfigPatch;
};

function smtpStoredFromRow(row: PlatformSmtpProfile): TenantSmtpConfigStored {
  return {
    host: row.smtpHost?.trim() || undefined,
    port: row.smtpPort ?? undefined,
    secure: row.smtpSecure === true ? true : row.smtpSecure === false ? false : undefined,
    user: row.smtpUser?.trim() || undefined,
    from: row.smtpFrom?.trim() || undefined,
    passEnc: row.smtpPassEnc?.trim() || undefined,
  };
}

function prismaSmtpDataFromStored(stored: TenantSmtpConfigStored) {
  const port = stored.port ?? 587;
  return {
    smtpHost: stored.host?.trim() || null,
    smtpPort: port,
    smtpSecure: stored.secure === true || port === 465,
    smtpUser: stored.user?.trim() || null,
    smtpFrom: stored.from?.trim() || null,
    smtpPassEnc: stored.passEnc?.trim() || null,
  };
}

function normalizeSlug(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  if (!s || s.length > 64) {
    throw new Error('slug는 영문·숫자·하이픈 64자 이내로 입력해 주세요.');
  }
  return s;
}

function validatePlatformSmtpMerged(merged: TenantSmtpConfigStored): void {
  const login = merged.user?.trim().toLowerCase() ?? '';
  const fromEmail = extractSmtpLoginEmail(merged.from?.trim() ?? '').toLowerCase();
  if (!login.includes('@')) {
    throw new Error('Gmail 로그인 계정(앱 비밀번호를 발급한 Google 계정)을 입력해 주세요.');
  }
  if (fromEmail && login === fromEmail && fromEmail.includes('noreply')) {
    throw new Error(
      'noreply 주소는 SMTP 로그인 계정으로 쓸 수 없습니다. Gmail 로그인 계정에는 앱 비밀번호를 발급한 실제 Google 계정을 입력하고, noreply는 「고객 발신 주소」에만 두세요.',
    );
  }
}

async function assertPurposeUniqueness(
  purposes: OutboundEmailPurpose[],
  excludeId?: string,
): Promise<void> {
  if (purposes.length === 0) return;
  const rows = await prisma.platformSmtpProfile.findMany({
    where: {
      enabled: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, slug: true, purposes: true },
  });
  for (const row of rows) {
    const existing = parseOutboundEmailPurposes(row.purposes);
    const overlap = purposes.filter((p) => existing.includes(p));
    if (overlap.length > 0) {
      throw new Error(
        `purpose ${overlap.join(', ')} 는 이미 프로필 「${row.slug}」에 연결되어 있습니다.`,
      );
    }
  }
}

function serializeProfile(row: PlatformSmtpProfile): PlatformSmtpProfilePublic {
  const stored = smtpStoredFromRow(row);
  const pub = smtpPublicFromStored(stored);
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    enabled: row.enabled,
    purposes: parseOutboundEmailPurposes(row.purposes),
    smtp: pub,
    defaultDisplayName: row.defaultDisplayName?.trim() ?? '',
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function listOutboundEmailPurposeCatalog(): Array<{
  id: OutboundEmailPurpose;
  label: string;
}> {
  return OUTBOUND_EMAIL_PURPOSES.map((id) => ({
    id,
    label: OUTBOUND_EMAIL_PURPOSE_LABELS[id],
  }));
}

export async function listPlatformSmtpProfiles(): Promise<PlatformSmtpProfilePublic[]> {
  const rows = await prisma.platformSmtpProfile.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(serializeProfile);
}

export async function getPlatformSmtpProfileById(id: string): Promise<PlatformSmtpProfilePublic | null> {
  const row = await prisma.platformSmtpProfile.findUnique({ where: { id } });
  return row ? serializeProfile(row) : null;
}

export async function findEnabledPlatformSmtpProfileForPurpose(
  purpose: OutboundEmailPurpose,
): Promise<PlatformSmtpProfile | null> {
  const rows = await prisma.platformSmtpProfile.findMany({
    where: { enabled: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  for (const row of rows) {
    const purposes = parseOutboundEmailPurposes(row.purposes);
    if (purposes.includes(purpose)) return row;
  }
  return null;
}

export function resolvePlatformSmtpLoginEmail(row: PlatformSmtpProfile): string | null {
  const user = row.smtpUser?.trim() ?? '';
  if (user.includes('@')) return user.toLowerCase();
  return null;
}

export function resolvePlatformSmtpProfileTransport(
  row: PlatformSmtpProfile,
  fromOverride?: string,
): ResolvedSmtpTransport | null {
  const base = resolveStoredSmtpTransport(smtpStoredFromRow(row));
  if (!base) return null;
  const loginEmail = resolvePlatformSmtpLoginEmail(row);
  if (!loginEmail || !base.auth) return null;
  return {
    ...base,
    auth: { ...base.auth, user: loginEmail },
    from: fromOverride?.trim() || base.from,
    source: 'platform',
  };
}

export async function isPlatformCustomerMailConfigured(
  purpose: OutboundEmailPurpose,
): Promise<boolean> {
  const row = await findEnabledPlatformSmtpProfileForPurpose(purpose);
  if (!row) return false;
  if (!smtpConfigStoredComplete(smtpStoredFromRow(row))) return false;
  return resolvePlatformSmtpLoginEmail(row) != null;
}

export async function createPlatformSmtpProfile(
  input: PlatformSmtpProfileCreateInput,
): Promise<PlatformSmtpProfilePublic> {
  const slug = normalizeSlug(input.slug);
  const label = input.label.trim();
  if (!label) throw new Error('표시 이름을 입력해 주세요.');
  const purposes = input.purposes ?? [];
  await assertPurposeUniqueness(purposes);

  const existingStored: TenantSmtpConfigStored = {};
  const merged = input.smtp ? mergeSmtpConfigStored(existingStored, input.smtp) : undefined;
  if (merged && merged.host && merged.from && !merged.passEnc?.trim()) {
    throw new Error('SMTP 비밀번호(앱 비밀번호)를 입력해 주세요.');
  }
  if (merged && smtpConfigStoredComplete(merged)) {
    validatePlatformSmtpMerged(merged);
    if (typeof input.smtp?.password === 'string' && input.smtp.password.length > 0) {
      const normalized = normalizeSmtpSecret(input.smtp.password);
      if (normalized.length !== 16) {
        throw new Error(
          'Gmail 앱 비밀번호는 공백 제외 16자리입니다. Google 계정 → 보안 → 앱 비밀번호에서 새로 발급해 붙여 넣어 주세요.',
        );
      }
    }
  }

  const row = await prisma.platformSmtpProfile.create({
    data: {
      slug,
      label,
      enabled: input.enabled !== false,
      purposes,
      defaultDisplayName: input.defaultDisplayName?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      ...(merged ? prismaSmtpDataFromStored(merged) : {}),
    },
  });
  return serializeProfile(row);
}

export async function updatePlatformSmtpProfile(
  id: string,
  input: PlatformSmtpProfileUpdateInput,
): Promise<PlatformSmtpProfilePublic> {
  const row = await prisma.platformSmtpProfile.findUnique({ where: { id } });
  if (!row) throw new Error('SMTP 프로필을 찾을 수 없습니다.');

  const purposes =
    input.purposes !== undefined ? input.purposes : parseOutboundEmailPurposes(row.purposes);
  if (input.enabled !== false) {
    await assertPurposeUniqueness(purposes, id);
  }

  const existingStored = smtpStoredFromRow(row);
  const merged = input.smtp ? mergeSmtpConfigStored(existingStored, input.smtp) : existingStored;
  if (merged && smtpConfigStoredComplete(merged)) {
    validatePlatformSmtpMerged(merged);
    if (typeof input.smtp?.password === 'string' && input.smtp.password.length > 0) {
      const normalized = normalizeSmtpSecret(input.smtp.password);
      if (normalized.length !== 16) {
        throw new Error(
          'Gmail 앱 비밀번호는 공백 제외 16자리입니다. Google 계정 → 보안 → 앱 비밀번호에서 새로 발급해 붙여 넣어 주세요.',
        );
      }
    }
  }
  if (merged && smtpConfigStoredComplete(merged) === false && input.smtp) {
    const touched =
      input.smtp.host !== undefined ||
      input.smtp.from !== undefined ||
      input.smtp.user !== undefined ||
      input.smtp.password !== undefined;
    if (touched && merged.host && merged.from && !merged.passEnc?.trim()) {
      throw new Error('SMTP 비밀번호(앱 비밀번호)를 입력해 주세요.');
    }
  }

  const updated = await prisma.platformSmtpProfile.update({
    where: { id },
    data: {
      ...(input.slug !== undefined ? { slug: normalizeSlug(input.slug) } : {}),
      ...(input.label !== undefined ? { label: input.label.trim() } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.purposes !== undefined ? { purposes } : {}),
      ...(input.defaultDisplayName !== undefined
        ? { defaultDisplayName: input.defaultDisplayName?.trim() || null }
        : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.smtp ? prismaSmtpDataFromStored(merged ?? existingStored) : {}),
    },
  });
  return serializeProfile(updated);
}

export async function deletePlatformSmtpProfile(id: string): Promise<void> {
  const row = await prisma.platformSmtpProfile.findUnique({ where: { id } });
  if (!row) throw new Error('SMTP 프로필을 찾을 수 없습니다.');
  await prisma.platformSmtpProfile.delete({ where: { id } });
}

export async function sendPlatformSmtpProfileTestMail(profileId: string, to: string): Promise<void> {
  const email = to.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('테스트 수신 이메일 형식을 확인해 주세요.');
  }
  const row = await prisma.platformSmtpProfile.findUnique({ where: { id: profileId } });
  if (!row) throw new Error('SMTP 프로필을 찾을 수 없습니다.');
  const display = row.defaultDisplayName?.trim() || '청소비서';
  const from = buildPlatformCustomerFromAddress({
    profile: row,
    brandDisplayName: display,
  });
  const transport = resolvePlatformSmtpProfileTransport(row, from);
  if (!transport) {
    throw new Error(
      'SMTP가 설정되지 않았습니다. Gmail 로그인 계정(앱 비밀번호 발급 계정)·보내는 주소(noreply)·앱 비밀번호를 저장해 주세요.',
    );
  }
  await sendMailWithTransport(transport, {
    to: email,
    subject: `[청소비서] SMTP 프로필 테스트 — ${row.label}`,
    html: `<p>플랫폼 SMTP 프로필 「${row.label}」 연습 메일입니다.</p>`,
    text: `플랫폼 SMTP 프로필 「${row.label}」 연습 메일입니다.`,
  });
}

export function formatPlatformSmtpProfileTestError(
  e: unknown,
  row: PlatformSmtpProfile,
): string {
  const login = resolvePlatformSmtpLoginEmail(row);
  return formatSmtpSendError(e, {
    smtpHost: row.smtpHost?.trim() ?? undefined,
    smtpUser: login ?? undefined,
  });
}

export function buildPlatformCustomerFromAddress(params: {
  profile: PlatformSmtpProfile;
  brandDisplayName: string;
}): string {
  const fromRaw = params.profile.smtpFrom?.trim() || '';
  const email = extractSmtpLoginEmail(fromRaw);
  if (!email) return fromRaw;
  const name =
    params.brandDisplayName.trim() ||
    params.profile.defaultDisplayName?.trim() ||
    '청소비서';
  return `"${name.replace(/"/g, '')}" <${email}>`;
}
