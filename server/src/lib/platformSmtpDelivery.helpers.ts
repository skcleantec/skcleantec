import {
  PLATFORM_SYSTEM_MAIL_FROM,
  PLATFORM_WORKSPACE_DOMAIN,
} from './platformWorkspace.constants.js';
import { extractSmtpLoginEmail, type ResolvedSmtpTransport } from './tenantSmtp.service.js';

function emailDomain(raw: string): string {
  const email = extractSmtpLoginEmail(raw).trim().toLowerCase();
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at + 1) : '';
}

function formatFrom(displayName: string, email: string): string {
  const name = displayName.trim().replace(/"/g, '');
  const addr = email.trim();
  if (!addr.includes('@')) return name || addr;
  if (!name) return addr;
  return `"${name}" <${addr}>`;
}

export type PlatformMailFromResolution = {
  from: string;
  replyTo?: string;
  fromAdjusted: boolean;
  note?: string;
};

/**
 * @service-bridges.com 그룹·사용자로 보낼 때:
 * 개인 Gmail SMTP 로그인 + From cbiseo@service-bridges.com 조합은
 * Workspace 수신측 SPF/DMARC 에서 스푸핑으로 걸러지는 경우가 많다.
 * (개인 Gmail 테스트 수신은 통과해도 billing@ 그룹은 안 올 수 있음)
 */
export function resolvePlatformMailFromForRecipient(
  transport: ResolvedSmtpTransport,
  to: string,
): PlatformMailFromResolution {
  const configuredFrom = transport.from.trim();
  const toDomain = emailDomain(to);
  if (toDomain !== PLATFORM_WORKSPACE_DOMAIN) {
    return { from: configuredFrom, fromAdjusted: false };
  }

  const authEmail = (transport.auth?.user?.trim() || extractSmtpLoginEmail(configuredFrom)).toLowerCase();
  const authDomain = emailDomain(authEmail);
  if (!authEmail.includes('@')) {
    return { from: configuredFrom, fromAdjusted: false };
  }

  if (authDomain === PLATFORM_WORKSPACE_DOMAIN) {
    return { from: configuredFrom, fromAdjusted: false };
  }

  const configuredFromEmail = extractSmtpLoginEmail(configuredFrom);
  const displayMatch = configuredFrom.match(/^"([^"]*)"\s*</);
  const looseMatch = configuredFrom.match(/^(.+?)\s*<([^>]+)>$/);
  const displayName =
    displayMatch?.[1]?.trim() ||
    looseMatch?.[1]?.replace(/^"|"$/g, '').trim() ||
    '청소비서';

  const replyTo = configuredFromEmail.includes('@')
    ? configuredFromEmail
    : PLATFORM_SYSTEM_MAIL_FROM;

  return {
    from: formatFrom(displayName, authEmail),
    replyTo,
    fromAdjusted: true,
    note:
      'billing@ 등 Workspace 주소 수신을 위해 발신 From을 SMTP 로그인 계정으로 맞췄습니다. cbiseo@service-bridges.com 으로 보이게 하려면 Google Workspace 계정(cbiseo@) SMTP 로그인이 필요합니다.',
  };
}
