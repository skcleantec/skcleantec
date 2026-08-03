import type { OutboundEmailProviderId } from './outboundEmailProviders';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 서버 normalizeSmtpSecret 과 동일 — 공백·제로폭·전각 제거 */
export function normalizeSmtpPasswordInput(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, '')
    .replace(/\s+/g, '');
}

/** Gmail 앱 비밀번호(16자)로 쓸 수 있는지 */
export function isGmailAppPassword(normalized: string): boolean {
  return /^[a-zA-Z0-9]{16}$/.test(normalized);
}

/**
 * 저장·발송에 넣을 비밀번호.
 * - 비어 있으면 기존 저장분 유지(빈 문자열 반환)
 * - Gmail인데 16자가 아니면 자동완성(일반 비번)으로 보고, 이미 저장된 값이 있으면 무시
 */
export function resolveSmtpPasswordForSubmit(input: {
  providerId: OutboundEmailProviderId;
  smtpPassword: string;
  passwordConfigured: boolean;
}): { password: string; ignoredAutofill: boolean; error: string | null } {
  const normalized = normalizeSmtpPasswordInput(input.smtpPassword);
  if (!normalized) {
    if (!input.passwordConfigured) {
      return { password: '', ignoredAutofill: false, error: '메일 연동 비밀번호를 입력해 주세요.' };
    }
    return { password: '', ignoredAutofill: false, error: null };
  }
  if (input.providerId === 'gmail' && !isGmailAppPassword(normalized)) {
    if (input.passwordConfigured) {
      return { password: '', ignoredAutofill: true, error: null };
    }
    return {
      password: '',
      ignoredAutofill: false,
      error:
        'Gmail은 Google 「앱 비밀번호」 16자리만 됩니다. 브라우저 자동완성 값을 지운 뒤, 앱 비밀번호만 붙여 넣어 주세요.',
    };
  }
  return { password: normalized, ignoredAutofill: false, error: null };
}

export function parseSmtpFrom(from: string): { displayName: string; email: string } {
  const trimmed = from.trim();
  const angle = trimmed.match(/^"([^"]*)"\s*<([^>]+)>$/);
  if (angle) {
    return { displayName: angle[1].trim(), email: angle[2].trim() };
  }
  const loose = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (loose) {
    return { displayName: loose[1].replace(/^"|"$/g, '').trim(), email: loose[2].trim() };
  }
  if (trimmed.includes('@')) {
    return { displayName: '', email: trimmed };
  }
  return { displayName: trimmed, email: '' };
}

export function buildSmtpFrom(displayName: string, email: string): string {
  const name = displayName.trim();
  const addr = email.trim();
  if (!addr) return name;
  if (!name) return addr;
  return `"${name.replace(/"/g, '')}" <${addr}>`;
}

export type OutboundEmailValidationInput = {
  providerId: OutboundEmailProviderId;
  sendEmail: string;
  displayName: string;
  smtpHost: string;
  smtpPort: string;
  smtpPassword: string;
  passwordConfigured: boolean;
  testEmailTo?: string;
  requireTestEmail?: boolean;
};

export function validateOutboundEmailForm(input: OutboundEmailValidationInput): Record<string, string> {
  const errors: Record<string, string> = {};
  const sendEmail = input.sendEmail.trim();
  const displayName = input.displayName.trim();
  const host = input.smtpHost.trim();
  const port = parseInt(input.smtpPort, 10);
  const password = input.smtpPassword.trim();
  const testTo = input.testEmailTo?.trim() ?? '';

  if (!sendEmail) {
    errors.sendEmail = '보낼 메일 주소를 입력해 주세요.';
  } else if (!EMAIL_RE.test(sendEmail)) {
    errors.sendEmail = '올바른 이메일 형식으로 입력해 주세요. (예: name@gmail.com)';
  } else if (input.providerId === 'naver' && !sendEmail.trim().toLowerCase().endsWith('@naver.com')) {
    errors.sendEmail = '네이버 메일은 @naver.com 주소 전체를 입력해 주세요.';
  } else if (input.providerId === 'gmail') {
    const lower = sendEmail.toLowerCase();
    if (!lower.endsWith('@gmail.com') && !lower.endsWith('@googlemail.com')) {
      // Google Workspace(@회사도메인)도 smtp.gmail.com 사용 가능 — 전체 주소만 강제
      if (!sendEmail.includes('@')) {
        errors.sendEmail = 'Gmail/Google 로그인에 쓰는 이메일 주소 전체를 입력해 주세요.';
      }
    }
  }

  if (!displayName) {
    errors.displayName = '받는 사람에게 보이는 이름을 입력해 주세요.';
  }

  if (input.providerId === 'custom' && !host) {
    errors.smtpHost = '메일 회사 서버 주소를 입력해 주세요.';
  }

  if (input.providerId === 'custom' && (!Number.isFinite(port) || port < 1 || port > 65535)) {
    errors.smtpPort = '연결 번호는 1~65535 사이로 입력해 주세요.';
  }

  const resolved = resolveSmtpPasswordForSubmit({
    providerId: input.providerId,
    smtpPassword: password,
    passwordConfigured: input.passwordConfigured,
  });
  if (resolved.error) {
    errors.smtpPassword = resolved.error;
  }

  if (input.requireTestEmail && !testTo) {
    errors.testEmailTo = '연습 보낼 내 메일 주소를 입력해 주세요.';
  } else if (testTo && !EMAIL_RE.test(testTo)) {
    errors.testEmailTo = '올바른 이메일 형식으로 입력해 주세요.';
  }

  return errors;
}

export function firstOutboundEmailValidationMessage(errors: Record<string, string>): string | null {
  const keys = ['sendEmail', 'displayName', 'smtpHost', 'smtpPassword', 'testEmailTo', 'smtpPort'] as const;
  for (const key of keys) {
    if (errors[key]) return errors[key];
  }
  return null;
}
