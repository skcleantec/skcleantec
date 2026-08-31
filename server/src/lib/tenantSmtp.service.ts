import type { TenantSmtpConfigStored } from '../modules/tenants/tenantConfig.schema.js';
import { decryptTenantSecret } from './tenantSecretCrypto.js';
import { isSmtpConfigured as isGlobalSmtpConfigured, type MailSendInput } from './mailer.js';
import { getTenantConfig } from '../modules/tenants/tenantConfig.service.js';
import { prisma } from './prisma.js';
import { parseOperatingCompanyConfig } from '../modules/operating-companies/operatingCompany.schema.js';
import { normalizeSmtpSecret, smtpConfigStoredComplete } from './smtpConfigStored.js';

export type ResolvedSmtpTransport = {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
  from: string;
  source: 'tenant' | 'global' | 'platform';
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

function isNaverSmtpHost(host: string): boolean {
  return host.trim().toLowerCase().includes('naver.com');
}

function isGmailSmtpHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  return h.includes('gmail.com') || h.includes('googlemail.com') || h.includes('googleapis.com');
}

type SmtpProviderKind = 'gmail' | 'naver' | 'daum' | 'other';

function inferSmtpProviderKind(ctx?: { smtpHost?: string; smtpUser?: string }): SmtpProviderKind {
  const host = (ctx?.smtpHost ?? '').trim().toLowerCase();
  const user = extractSmtpLoginEmail(ctx?.smtpUser ?? '').trim().toLowerCase();
  if (host.includes('naver') || user.endsWith('@naver.com')) return 'naver';
  if (host.includes('gmail') || user.endsWith('@gmail.com')) return 'gmail';
  if (
    host.includes('daum') ||
    user.endsWith('@daum.net') ||
    user.endsWith('@hanmail.net') ||
    user.endsWith('@kakao.com')
  ) {
    return 'daum';
  }
  return 'other';
}

function smtpAuthFailureMessage(provider: SmtpProviderKind): string {
  if (provider === 'naver') {
    return '네이버 SMTP 인증에 실패했습니다. POP3/SMTP 사용 ON, 2단계 인증 시 애플리케이션 비밀번호, @naver.com 전체 주소·포트 465(SSL)를 확인해 주세요.';
  }
  if (provider === 'gmail') {
    return 'Gmail SMTP 로그인이 거부되었습니다. 「Gmail 로그인 계정」이 앱 비밀번호를 발급한 Google 계정과 같은지, 일반 로그인 비밀번호가 아닌 16자리 앱 비밀번호인지 확인해 주세요. noreply 발신 주소는 로그인 계정과 달라도 됩니다. Google 계정 → 보안 → 2단계 인증 ON 후 앱 비밀번호를 새로 발급해 저장해 보세요.';
  }
  if (provider === 'daum') {
    return '다음·카카오 SMTP 인증에 실패했습니다. IMAP/SMTP 사용 ON, 로그인 비밀번호·포트 465(SSL) 설정을 확인해 주세요.';
  }
  return 'SMTP 인증에 실패했습니다. 로그인 주소·연동(앱) 비밀번호·포트·SSL 설정을 확인해 주세요.';
}

function enrichSmtpError(
  e: unknown,
  ctx: { smtpHost: string; smtpUser?: string },
): Error & { smtpHost?: string; smtpUser?: string } {
  const base = e instanceof Error ? e : new Error(String(e));
  const err = base as Error & { smtpHost?: string; smtpUser?: string };
  err.smtpHost = ctx.smtpHost;
  if (ctx.smtpUser) err.smtpUser = ctx.smtpUser;
  return err;
}

/** 네이버·Gmail: 로그인 주소·포트 정규화. Gmail은 표시이름이 있어도 SMTP auth는 이메일만 사용 */
function nodemailerTransportOptions(transport: ResolvedSmtpTransport) {
  let { host, port, secure } = transport;
  let from = transport.from;
  let auth = transport.auth
    ? { user: transport.auth.user, pass: normalizeSmtpSecret(transport.auth.pass) }
    : undefined;

  if (isNaverSmtpHost(host)) {
    port = 465;
    secure = true;
    const login = (auth?.user ?? extractSmtpLoginEmail(from)).trim().toLowerCase();
    if (login) {
      from = login;
      if (auth) auth = { ...auth, user: login };
    }
  }

  if (isGmailSmtpHost(host)) {
    // 587+STARTTLS 기본. 465로 저장된 경우만 SSL 유지
    if (port !== 465) {
      port = 587;
      secure = false;
    } else {
      secure = true;
    }
    const loginFromAuth = auth?.user?.trim().toLowerCase() ?? '';
    const login =
      transport.source === 'platform'
        ? loginFromAuth
        : (loginFromAuth || extractSmtpLoginEmail(from).trim().toLowerCase());
    if (login) {
      if (auth) auth = { ...auth, user: login };
      // 플랫폼 noreply Send-as: From 이메일 유지. 테넌트 Gmail만 로그인 계정과 From 일치
      if (transport.source !== 'platform') {
        const display = from.match(/^"([^"]*)"\s*</)?.[1] ?? from.match(/^(.+?)\s*</)?.[1]?.replace(/^"|"$/g, '');
        from = display?.trim() ? `"${display.trim().replace(/"/g, '')}" <${login}>` : login;
      }
    }
  }

  return {
    host,
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth,
    from,
  };
}

/** nodemailer 오류 → 화면용 짧은 메시지 (비밀번호 등은 노출하지 않음) */
export function formatSmtpSendError(e: unknown, ctx?: { smtpHost?: string; smtpUser?: string }): string {
  const err = e as {
    message?: string;
    response?: string;
    responseCode?: number;
    code?: string;
    smtpHost?: string;
    smtpUser?: string;
  };
  const mergedCtx = {
    smtpHost: ctx?.smtpHost ?? err.smtpHost,
    smtpUser: ctx?.smtpUser ?? err.smtpUser,
  };
  const provider = inferSmtpProviderKind(mergedCtx);
  const blob = `${err.response ?? ''} ${err.message ?? ''} ${err.code ?? ''}`.toLowerCase();
  const loginHint = mergedCtx.smtpUser?.trim() ? ` (로그인 시도: ${mergedCtx.smtpUser.trim()})` : '';
  // 'authentication' 단독 매칭은 TLS 등 다른 오류를 앱 비밀번호 안내로 오인하게 만들어 제외
  const isAuthFailure =
    /\b535\b/.test(blob) ||
    /\b534\b/.test(blob) ||
    blob.includes('username and password not accepted') ||
    blob.includes('invalid login') ||
    blob.includes('bad credentials') ||
    blob.includes('application-specific password') ||
    blob.includes('authentication failed');
  if (isAuthFailure) {
    return `${smtpAuthFailureMessage(provider)}${loginHint}`;
  }
  if (blob.includes('self signed certificate') || blob.includes('certificate')) {
    return 'SMTP 서버 SSL 인증서 연결에 실패했습니다. 포트·SSL/TLS 설정을 확인해 주세요.';
  }
  if (err.code === 'ECONNECTION' || err.code === 'ETIMEDOUT' || err.code === 'ESOCKET') {
    return 'SMTP 서버에 연결하지 못했습니다. 호스트·포트·방화벽을 확인해 주세요.';
  }
  if (blob.includes('no recipients defined')) {
    return '수신 이메일 주소 형식이 올바르지 않습니다. 예: name@example.com';
  }
  if (err.message?.trim()) return `${err.message.trim()}${loginHint}`;
  return `메일 발송에 실패했습니다. SMTP 설정을 확인해 주세요.${loginHint}`;
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
  source: ResolvedSmtpTransport['source'] = 'tenant',
): ResolvedSmtpTransport | null {
  if (!storedSmtpComplete(stored)) return null;
  const passRaw = decryptTenantSecret(stored!.passEnc!.trim());
  if (!passRaw) return null;
  const pass = normalizeSmtpSecret(passRaw);
  if (!pass) return null;
  const host = stored!.host!.trim();
  const from = stored!.from!.trim();
  const user = stored!.user?.trim() ?? '';
  const authUser = resolveSmtpAuthUser(user, from)?.toLowerCase() ?? null;
  if (!authUser) return null;
  const port = stored!.port ?? 587;
  const secure = stored!.secure === true || port === 465;
  return {
    host,
    port,
    secure,
    from,
    auth: { user: authUser, pass },
    source,
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

/**
 * 브랜드 스코프 고객 메일 발송 가능 여부.
 * 브랜드가 있으면 해당 브랜드 SMTP만 인정한다(테넌트 공통·전역 폴백 금지).
 * `tenantStored`/`globalAvailable`는 하위 호환용으로 받으며 사용하지 않는다.
 */
export function resolveEffectiveSmtpConfigured(
  brandStored: TenantSmtpConfigStored | undefined,
  _tenantStored?: TenantSmtpConfigStored | undefined,
  _globalAvailable?: boolean,
): boolean {
  return storedSmtpComplete(brandStored);
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
  // 브랜드가 지정된 고객 메일: 해당 브랜드 SMTP만 사용. 공통/전역으로 폴백하면
  // 다른 업체(브랜드) 이름으로 나갈 수 있으므로 금지한다.
  if (operatingCompanyId) {
    const brandStored = await loadOperatingCompanySmtpStored(tenantId, operatingCompanyId);
    return resolveStoredSmtpTransport(brandStored);
  }

  const config = await getTenantConfig(tenantId);
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
): Promise<{ messageId?: string }> {
  const nodemailer = await import('nodemailer');
  const opts = nodemailerTransportOptions(transport);
  const tx = nodemailer.createTransport({
    host: opts.host,
    port: opts.port,
    secure: opts.secure,
    requireTLS: opts.requireTLS,
    auth: opts.auth,
    tls: {
      minVersion: 'TLSv1.2' as const,
      servername: opts.host,
    },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
  });
  const from = input.from?.trim() || opts.from;
  try {
    const info = await tx.sendMail({
      from,
      to: input.to,
      replyTo: input.replyTo?.trim() || undefined,
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachments,
    });
    return { messageId: typeof info.messageId === 'string' ? info.messageId : undefined };
  } catch (e) {
    throw enrichSmtpError(e, {
      smtpHost: opts.host,
      smtpUser: opts.auth?.user ?? extractSmtpLoginEmail(from),
    });
  }
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

export async function resolveSmtpErrorContextForTenant(
  tenantId: string,
  operatingCompanyId?: string | null,
): Promise<{ smtpHost?: string; smtpUser?: string }> {
  let stored: TenantSmtpConfigStored | undefined;
  if (operatingCompanyId) {
    stored = await loadOperatingCompanySmtpStored(tenantId, operatingCompanyId);
  } else {
    const config = await getTenantConfig(tenantId);
    stored = config.smtp;
  }
  const host = stored?.host?.trim() ?? '';
  const user = stored?.user?.trim() || extractSmtpLoginEmail(stored?.from ?? '');
  return {
    smtpHost: host || undefined,
    smtpUser: user || undefined,
  };
}

/**
 * 고객 발주서 제출 확인 메일 — 견적서와 동일.
 * 브랜드 지정 시 브랜드 SMTP만, 없으면 테넌트 공통 → 전역.
 */
export async function resolveSmtpTransportForOrderFormCustomerEmail(
  tenantId: string,
  operatingCompanyId: string | null | undefined,
): Promise<ResolvedSmtpTransport | null> {
  return resolveSmtpTransportForTenant(tenantId, operatingCompanyId ?? undefined);
}

export { isGlobalSmtpConfigured };
