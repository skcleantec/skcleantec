import type { OutboundEmailProviderId } from './outboundEmailProviders';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  if (!password && !input.passwordConfigured) {
    errors.smtpPassword = '메일 연동 비밀번호를 입력해 주세요.';
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
