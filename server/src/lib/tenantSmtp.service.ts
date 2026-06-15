import type { TenantSmtpConfigStored } from '../modules/tenants/tenantConfig.schema.js';
import { decryptTenantSecret } from './tenantSecretCrypto.js';
import { isSmtpConfigured as isGlobalSmtpConfigured, type MailSendInput } from './mailer.js';
import { getTenantConfig } from '../modules/tenants/tenantConfig.service.js';

export type ResolvedSmtpTransport = {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
  from: string;
  source: 'tenant' | 'global';
};

function storedSmtpComplete(stored: TenantSmtpConfigStored | undefined): boolean {
  if (!stored) return false;
  const host = stored.host?.trim();
  const from = stored.from?.trim();
  const passEnc = stored.passEnc?.trim();
  return Boolean(host && from && passEnc);
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
  const port = stored!.port ?? 587;
  const secure = stored!.secure === true || port === 465;
  return {
    host,
    port,
    secure,
    from,
    auth: user ? { user, pass } : { user: from, pass },
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

export async function resolveSmtpTransportForTenant(tenantId: string): Promise<ResolvedSmtpTransport | null> {
  const config = await getTenantConfig(tenantId);
  const tenant = resolveStoredSmtpTransport(config.smtp);
  if (tenant) return tenant;
  return resolveGlobalSmtpTransport();
}

export async function isSmtpConfiguredForTenant(tenantId: string): Promise<boolean> {
  return (await resolveSmtpTransportForTenant(tenantId)) != null;
}

export async function sendMailForTenant(tenantId: string, input: MailSendInput): Promise<boolean> {
  const transport = await resolveSmtpTransportForTenant(tenantId);
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

/** 테스트 발송 — tenant SMTP만 사용 (global fallback 없음) */
export async function sendTestMailWithTenantSmtp(
  tenantId: string,
  to: string,
): Promise<boolean> {
  const config = await getTenantConfig(tenantId);
  const transport = resolveStoredSmtpTransport(config.smtp);
  if (!transport) return false;
  await sendMailWithTransport(transport, {
    to,
    subject: '[메일 발송 테스트] 현장 검수 완료본 SMTP',
    html: '<p>업체등록정보에 설정한 SMTP로 발송된 테스트 메일입니다.</p>',
    text: '업체등록정보에 설정한 SMTP로 발송된 테스트 메일입니다.',
  });
  return true;
}

export { isGlobalSmtpConfigured };
