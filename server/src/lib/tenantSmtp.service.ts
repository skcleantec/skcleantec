import type { TenantSmtpConfigStored } from '../modules/tenants/tenantConfig.schema.js';
import { decryptTenantSecret } from './tenantSecretCrypto.js';
import { isSmtpConfigured as isGlobalSmtpConfigured, type MailSendInput } from './mailer.js';
import { getTenantConfig } from '../modules/tenants/tenantConfig.service.js';
import { prisma } from './prisma.js';
import { parseOperatingCompanyConfig } from '../modules/operating-companies/operatingCompany.schema.js';
import { smtpConfigStoredComplete } from './smtpConfigStored.js';

export type ResolvedSmtpTransport = {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
  from: string;
  source: 'tenant' | 'global';
};

/** `"회사명" <a@b.com>` 또는 `a@b.com` 에서 로그인용 이메일만 추출 */
export function extractSmtpLoginEmail(raw: string): string {
  const t = raw.trim();
  const angle = t.match(/<([^>]+)>/);
  if (angle?.[1]) return angle[1].trim();
  return t;
}

function resolveSmtpAuthUser(user: string, from: string): string | null {
  const fromEmail = extractSmtpLoginEmail(from);
  const userEmail = user.trim();
  if (userEmail.includes('@')) return userEmail;
  if (fromEmail.includes('@')) return fromEmail;
  return null;
}

/** nodemailer 오류 → 화면용 짧은 메시지 (비밀번호 등은 노출하지 않음) */
export function formatSmtpSendError(e: unknown): string {
  const err = e as {
    message?: string;
    response?: string;
    responseCode?: number;
    code?: string;
  };
  const blob = `${err.response ?? ''} ${err.message ?? ''}`.toLowerCase();
  if (blob.includes('username and password not accepted') || blob.includes('535')) {
    return 'Gmail 로그인이 거부되었습니다. SMTP 로그인 계정에 @gmail.com 전체 주소를 넣고, 일반 비밀번호가 아닌 앱 비밀번호를 사용했는지 확인해 주세요.';
  }
  if (blob.includes('invalid login') || blob.includes('authentication')) {
    return 'SMTP 인증에 실패했습니다. 로그인 계정·앱 비밀번호·포트(587/465)와 SSL 설정을 확인해 주세요.';
  }
  if (blob.includes('self signed certificate') || blob.includes('certificate')) {
    return 'SMTP 서버 SSL 인증서 연결에 실패했습니다. 포트·SSL/TLS 설정을 확인해 주세요.';
  }
  if (err.code === 'ECONNECTION' || err.code === 'ETIMEDOUT') {
    return 'SMTP 서버에 연결하지 못했습니다. 호스트·포트·방화벽을 확인해 주세요.';
  }
  if (err.message?.trim()) return err.message.trim();
  return '메일 발송에 실패했습니다. SMTP 설정을 확인해 주세요.';
}

function storedSmtpComplete(stored: TenantSmtpConfigStored | undefined): boolean {
  return smtpConfigStoredComplete(stored);
}

export function smtpPublicFromStored(stored: TenantSmtpConfigStored | undefined): {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  passwordConfigured: boolean;
  configured: boolean;
} {
  const host = stored?.host?.trim() ?? '';
  const from = stored?.from?.trim() ?? '';
  const user = stored?.user?.trim() ?? '';
  const port = stored?.port ?? 587;
  const secure = stored?.secure === true || port === 465;
  const passwordConfigured = Boolean(stored?.passEnc?.trim());
  const configured = storedSmtpComplete(stored);
  return { host, port, secure, user, from, passwordConfigured, configured };
}

export function resolveStoredSmtpTransport(
  stored: TenantSmtpConfigStored | undefined,
): ResolvedSmtpTransport | null {
  if (!storedSmtpComplete(stored)) return null;
  const pass = decryptTenantSecret(stored!.passEnc!.trim());
  if (!pass) return null;
  const host = stored!.host!.trim();
  const from = stored!.from!.trim();
  const user = stored!.user?.trim() ?? '';
  const authUser = resolveSmtpAuthUser(user, from);
  if (!authUser) return null;
  const port = stored!.port ?? 587;
  const secure = stored!.secure === true || port === 465;
  return {
    host,
    port,
    secure,
    from,
    auth: { user: authUser, pass },
    source: 'tenant',
  };
}

export function resolveGlobalSmtpTransport(): ResolvedSmtpTransport | null {
  if (!isGlobalSmtpConfigured()) return null;
  const host = (process.env.SMTP_HOST ?? '').trim();
  const from = (process.env.SMTP_FROM ?? process.env.SMTP_USER ?? '').trim();
  const user = (process.env.SMTP_USER ?? '').trim();
  const pass = (process.env.SMTP_PASS ?? '').trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  return {
    host,
    port,
    secure,
    from,
    auth: user && pass ? { user, pass } : undefined,
    source: 'global',
  };
}

export function resolveEffectiveSmtpConfigured(
  brandStored: TenantSmtpConfigStored | undefined,
  tenantStored: TenantSmtpConfigStored | undefined,
  globalAvailable: boolean,
): boolean {
  if (storedSmtpComplete(brandStored)) return true;
  if (storedSmtpComplete(tenantStored)) return true;
  return globalAvailable;
}

async function loadOperatingCompanySmtpStored(
  tenantId: string,
  operatingCompanyId: string,
): Promise<TenantSmtpConfigStored | undefined> {
  const row = await prisma.operatingCompany.findFirst({
    where: { id: operatingCompanyId, tenantId },
    select: { config: true },
  });
  if (!row) return undefined;
  return parseOperatingCompanyConfig(row.config).smtp;
}

export async function resolveSmtpTransportForTenant(
  tenantId: string,
  operatingCompanyId?: string | null,
): Promise<ResolvedSmtpTransport | null> {
  const config = await getTenantConfig(tenantId);

  if (operatingCompanyId) {
    const brandStored = await loadOperatingCompanySmtpStored(tenantId, operatingCompanyId);
    const brand = resolveStoredSmtpTransport(brandStored);
    if (brand) return brand;
  }

  const tenant = resolveStoredSmtpTransport(config.smtp);
  if (tenant) return tenant;
  return resolveGlobalSmtpTransport();
}

export async function isSmtpConfiguredForTenant(
  tenantId: string,
  operatingCompanyId?: string | null,
): Promise<boolean> {
  return (await resolveSmtpTransportForTenant(tenantId, operatingCompanyId)) != null;
}

export async function sendMailForTenant(
  tenantId: string,
  input: MailSendInput,
  operatingCompanyId?: string | null,
): Promise<boolean> {
  const transport = await resolveSmtpTransportForTenant(tenantId, operatingCompanyId);
  if (!transport) return false;
  await sendMailWithTransport(transport, input);
  return true;
}

export async function sendMailWithTransport(
  transport: ResolvedSmtpTransport,
  input: MailSendInput,
): Promise<void> {
  const nodemailer = await import('nodemailer');
  const tx = nodemailer.createTransport({
    host: transport.host,
    port: transport.port,
    secure: transport.secure,
    requireTLS: !transport.secure && transport.port === 587,
    auth: transport.auth,
  });
  await tx.sendMail({
    from: transport.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: input.attachments,
  });
}

/** 테스트 발송 — 지정 SMTP만 사용 (global fallback 없음) */
export async function sendTestMailWithTenantSmtp(
  tenantId: string,
  to: string,
  operatingCompanyId?: string | null,
): Promise<boolean> {
  let stored: TenantSmtpConfigStored | undefined;
  if (operatingCompanyId) {
    stored = await loadOperatingCompanySmtpStored(tenantId, operatingCompanyId);
  } else {
    const config = await getTenantConfig(tenantId);
    stored = config.smtp;
  }
  const transport = resolveStoredSmtpTransport(stored);
  if (!transport) return false;
  await sendMailWithTransport(transport, {
    to,
    subject: '[메일 발송 테스트] 현장 검수 완료본 SMTP',
    html: '<p>업체등록정보에 설정한 SMTP로 발송된 테스트 메일입니다.</p>',
    text: '업체등록정보에 설정한 SMTP로 발송된 테스트 메일입니다.',
  });
  return true;
}

/**
 * 고객 발주서 제출 확인 메일 — 영업 브랜드 SMTP만 사용(테넌트·전역 폴백 없음).
 */
export async function resolveSmtpTransportForOrderFormCustomerEmail(
  tenantId: string,
  operatingCompanyId: string | null | undefined,
): Promise<ResolvedSmtpTransport | null> {
  if (!operatingCompanyId) return null;
  const stored = await loadOperatingCompanySmtpStored(tenantId, operatingCompanyId);
  return resolveStoredSmtpTransport(stored);
}

export { isGlobalSmtpConfigured };
