import type { PlatformBillingSettings } from '@prisma/client';
import type { TenantSmtpConfigStored } from '../modules/tenants/tenantConfig.schema.js';
import {
  isGlobalSmtpConfigured,
  resolveGlobalSmtpTransport,
  resolveStoredSmtpTransport,
  sendMailWithTransport,
  smtpPublicFromStored,
  formatSmtpSendError,
  extractSmtpLoginEmail,
  type ResolvedSmtpTransport,
} from './tenantSmtp.service.js';
import {
  mergeSmtpConfigStored,
  type SmtpConfigPatch,
} from './smtpConfigStored.js';
import { prisma } from './prisma.js';
import type { MailSendInput } from './mailer.js';
import { resolvePlatformMailFromForRecipient } from './platformSmtpDelivery.helpers.js';
import {
  buildPlatformCustomerFromAddress,
  findEnabledPlatformSmtpProfileForPurpose,
  resolvePlatformSmtpProfileTransport,
} from '../modules/platform-smtp-profiles/platformSmtpProfile.service.js';

async function resolvePlatformSystemNotifyTransport(): Promise<{
  transport: ResolvedSmtpTransport | null;
  viaProfile: boolean;
}> {
  const row = await findEnabledPlatformSmtpProfileForPurpose('PLATFORM_SYSTEM_NOTIFY');
  if (row) {
    const from = buildPlatformCustomerFromAddress({
      profile: row,
      brandDisplayName: row.defaultDisplayName?.trim() || '청소비서',
    });
    const transport = resolvePlatformSmtpProfileTransport(row, from);
    if (transport) return { transport, viaProfile: true };
  }
  return { transport: null, viaProfile: false };
}

async function ensurePlatformBillingRow(): Promise<PlatformBillingSettings> {
  return prisma.platformBillingSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  });
}

export type PlatformSmtpSettingsPublic = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  passwordConfigured: boolean;
  configured: boolean;
  envFallbackAvailable: boolean;
  effectiveConfigured: boolean;
};

function smtpStoredFromRow(row: PlatformBillingSettings): TenantSmtpConfigStored {
  const user = row.smtpUser?.trim() || undefined;
  let from = row.smtpFrom?.trim() || undefined;
  // 레거시: from에 이메일 없이 표시명만 저장된 경우 로그인 계정으로 보정
  if (from && !extractSmtpLoginEmail(from).includes('@') && user?.includes('@')) {
    from = user;
  }
  return {
    host: row.smtpHost?.trim() || undefined,
    port: row.smtpPort ?? undefined,
    secure: row.smtpSecure === true ? true : row.smtpSecure === false ? false : undefined,
    user,
    from,
    passEnc: row.smtpPassEnc?.trim() || undefined,
  };
}

type PlatformSmtpPrismaData = {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUser: string | null;
  smtpFrom: string | null;
  smtpPassEnc: string | null;
};

function prismaDataFromStored(stored: TenantSmtpConfigStored): PlatformSmtpPrismaData {
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

/** 기존 행 + patch → Prisma update 필드. merge 결과 없으면 빈 객체(기존 SMTP 유지). */
export function buildPlatformSmtpUpdateDataFromRow(
  row: PlatformBillingSettings,
  patch: SmtpConfigPatch,
): PlatformSmtpPrismaData | Record<string, never> {
  const existing = smtpStoredFromRow(row);
  validatePlatformSmtpPatch(patch, existing);
  const merged = mergeSmtpConfigStored(existing, patch);
  if (!merged) return {};
  return prismaDataFromStored(merged);
}

export function buildPlatformSmtpPublic(row: PlatformBillingSettings): PlatformSmtpSettingsPublic {
  const stored = smtpStoredFromRow(row);
  const pub = smtpPublicFromStored(stored);
  const envFallbackAvailable = isGlobalSmtpConfigured();
  return {
    ...pub,
    envFallbackAvailable,
    effectiveConfigured: pub.configured || envFallbackAvailable,
  };
}

function validatePlatformSmtpPatch(
  patch: SmtpConfigPatch,
  existingStored: TenantSmtpConfigStored | undefined,
): void {
  const mergedPreview = mergeSmtpConfigStored(existingStored, patch);
  const host = mergedPreview?.host?.trim() ?? '';
  const from = mergedPreview?.from?.trim() ?? '';
  const password = patch.password;
  const willHavePass =
    (typeof password === 'string' && password.length > 0) ||
    Boolean(mergedPreview?.passEnc?.trim());
  const touched =
    [patch.host, patch.from, patch.user, patch.password].some(
      (v) => typeof v === 'string' && v.trim().length > 0,
    ) ||
    patch.port !== undefined ||
    patch.secure !== undefined;

  if (host && from && !willHavePass) {
    throw new Error('SMTP 비밀번호(앱 비밀번호)를 입력해 주세요.');
  }
  if (touched && (!host || !from)) {
    throw new Error('SMTP 호스트·보내는 사람 표시를 입력해 주세요.');
  }
}

export async function updatePlatformSmtpSettings(
  patch: SmtpConfigPatch | undefined,
): Promise<PlatformSmtpSettingsPublic> {
  if (!patch) {
    const row = await ensurePlatformBillingRow();
    return buildPlatformSmtpPublic(row);
  }
  const row = await ensurePlatformBillingRow();
  const data = buildPlatformSmtpUpdateDataFromRow(row, patch);
  if (Object.keys(data).length === 0) {
    return buildPlatformSmtpPublic(row);
  }
  const updated = await prisma.platformBillingSettings.update({
    where: { id: 'default' },
    data,
  });
  return buildPlatformSmtpPublic(updated);
}

export async function resolvePlatformSmtpTransport(): Promise<ResolvedSmtpTransport | null> {
  const profileResult = await resolvePlatformSystemNotifyTransport();
  if (profileResult.transport) return profileResult.transport;
  return resolveLegacyPlatformBillingSmtpTransport();
}

async function resolveLegacyPlatformBillingSmtpTransport(): Promise<ResolvedSmtpTransport | null> {
  const row = await ensurePlatformBillingRow();
  const db = resolveStoredSmtpTransport(smtpStoredFromRow(row), 'platform');
  if (db) return db;
  return resolveGlobalSmtpTransport();
}

export type PlatformSmtpSendDiagnostics = {
  authUser: string | null;
  from: string | null;
  host: string | null;
  source: ResolvedSmtpTransport['source'] | null;
  passwordDecryptOk: boolean;
};

export async function getPlatformSmtpSendDiagnostics(): Promise<PlatformSmtpSendDiagnostics> {
  const profileResult = await resolvePlatformSystemNotifyTransport();
  if (profileResult.transport) {
    return {
      authUser: profileResult.transport.auth?.user ?? null,
      from: profileResult.transport.from ?? null,
      host: profileResult.transport.host ?? null,
      source: profileResult.transport.source ?? null,
      passwordDecryptOk: true,
    };
  }

  const row = await ensurePlatformBillingRow();
  const stored = smtpStoredFromRow(row);
  const passEnc = stored.passEnc?.trim();
  let passwordDecryptOk = false;
  if (passEnc) {
    const { decryptTenantSecret } = await import('./tenantSecretCrypto.js');
    const raw = decryptTenantSecret(passEnc);
    passwordDecryptOk = Boolean(raw?.trim());
  }
  const transport = await resolvePlatformSmtpTransport();
  return {
    authUser: transport?.auth?.user ?? null,
    from: transport?.from ?? null,
    host: transport?.host ?? null,
    source: transport?.source ?? null,
    passwordDecryptOk: !passEnc || passwordDecryptOk,
  };
}

export async function isPlatformSmtpConfigured(): Promise<boolean> {
  return (await resolvePlatformSmtpTransport()) != null;
}

export async function sendPlatformMail(
  input: MailSendInput,
): Promise<{ sent: boolean; reason?: string; detail?: string; deliveryNote?: string; messageId?: string }> {
  const profileResult = await resolvePlatformSystemNotifyTransport();
  let transport = profileResult.transport;
  let viaProfile = profileResult.viaProfile;

  if (!transport) {
    transport = await resolveLegacyPlatformBillingSmtpTransport();
    viaProfile = false;
  }

  if (!transport) {
    const diag = await getPlatformSmtpSendDiagnostics();
    if (diag.passwordDecryptOk === false) {
      return {
        sent: false,
        reason: 'SMTP_NOT_CONFIGURED',
        detail:
          '저장된 SMTP 앱 비밀번호를 읽을 수 없습니다. 설정 → SMTP의 「플랫폼 알림 (cbiseo)」 프로필에서 앱 비밀번호를 다시 입력·저장해 주세요.',
      };
    }
    return {
      sent: false,
      reason: 'SMTP_NOT_CONFIGURED',
      detail:
        'SMTP가 설정되지 않았습니다. 설정 → SMTP에서 「플랫폼 알림 (cbiseo)」 프로필의 Gmail 로그인·앱 비밀번호·발신 주소를 저장해 주세요.',
    };
  }

  const delivery = viaProfile
    ? { from: transport.from, fromAdjusted: false as const }
    : resolvePlatformMailFromForRecipient(transport, input.to);
  const payload: MailSendInput = {
    ...input,
    from: delivery.from,
    replyTo: 'replyTo' in delivery ? delivery.replyTo : undefined,
  };
  try {
    const result = await sendMailWithTransport(transport, payload);
    return {
      sent: true,
      deliveryNote: delivery.fromAdjusted ? delivery.note : undefined,
      messageId: result.messageId,
    };
  } catch (e) {
    return {
      sent: false,
      reason: 'SMTP_SEND_FAILED',
      detail: formatSmtpSendError(e, {
        smtpHost: transport.host,
        smtpUser: transport.auth?.user ?? extractSmtpLoginEmail(transport.from),
      }),
    };
  }
}

export async function sendPlatformSmtpTestMail(to: string): Promise<void> {
  const email = to.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('테스트 수신 이메일 형식을 확인해 주세요.');
  }
  const result = await sendPlatformMail({
    to: email,
    subject: '[청소비서] 플랫폼 SMTP 테스트',
    html: '<p>플랫폼 SMTP 설정으로 발송된 테스트 메일입니다.</p>',
    text: '플랫폼 SMTP 설정으로 발송된 테스트 메일입니다.',
  });
  if (!result.sent) {
    throw new Error(
      result.detail ??
        'SMTP가 설정되지 않았습니다. 아래 항목을 저장하거나 서버 환경변수를 확인해 주세요.',
    );
  }
}
