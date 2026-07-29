const API = '/api/public/password-reset';

export type PasswordResetCodeSent = {
  challengeId: string;
  expiresAt: string;
  message: string;
};

export type PasswordResetConfirmResult = {
  ok: boolean;
  message: string;
  loginId: string;
  tenantSlug: string;
};

export async function sendPasswordResetCode(input: {
  tenantSlug: string;
  recoveryEmail: string;
}): Promise<PasswordResetCodeSent> {
  const res = await fetch(`${API}/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as PasswordResetCodeSent & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '인증번호 발송에 실패했습니다.');
  return data;
}

export async function confirmPasswordReset(input: {
  tenantSlug: string;
  recoveryEmail: string;
  challengeId: string;
  verificationCode: string;
  newPassword: string;
}): Promise<PasswordResetConfirmResult> {
  const res = await fetch(`${API}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantSlug: input.tenantSlug,
      recoveryEmail: input.recoveryEmail,
      challengeId: input.challengeId,
      verificationCode: input.verificationCode,
      newPassword: input.newPassword,
    }),
  });
  const data = (await res.json()) as PasswordResetConfirmResult & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '비밀번호 변경에 실패했습니다.');
  return data;
}
