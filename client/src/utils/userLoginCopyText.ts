export function resolveLoginPageUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/login`;
  }
  return 'https://www.cbiseo.com/login';
}

export type LoginCredentialsCopyInput = {
  loginUrl?: string;
  tenantSlug: string;
  email: string;
  password: string;
  /** 팀장 · 마케터 · 타업체 등 */
  accountLabel?: string;
};

/** 관리자 → 카톡 전달용 로그인 안내 텍스트 */
export function buildLoginCredentialsCopyText(input: LoginCredentialsCopyInput): string {
  const loginUrl = (input.loginUrl?.trim() || resolveLoginPageUrl()).replace(/\/+$/, '');

  const lines = [
    '━━━━━ 청소비서 로그인 안내 ━━━━━',
    ...(input.accountLabel?.trim() ? [`계정 구분: ${input.accountLabel.trim()}`, ''] : []),
    `접속 주소: ${loginUrl}`,
    `업체 코드: ${input.tenantSlug.trim().toLowerCase()}`,
    `아이디: ${input.email.trim()}`,
    `비밀번호: ${input.password}`,
    '',
    '① 위 주소로 접속',
    '② 업체 코드 → 아이디 → 비밀번호 순서로 입력',
    '③ 로그인 후 안내에 따라 본인 정보를 입력해 주세요.',
    '━━━━━━━━━━━━━━━━━━━',
  ].filter((line, i, arr) => !(line === '' && i > 0 && arr[i - 1] === ''));
  return lines.join('\n');
}

export function loginCredentialsCopySections(input: LoginCredentialsCopyInput) {
  const loginUrl = (input.loginUrl?.trim() || resolveLoginPageUrl()).replace(/\/+$/, '');
  const rows: { label: string; value: string }[] = [];
  if (input.accountLabel?.trim()) {
    rows.push({ label: '계정 구분', value: input.accountLabel.trim() });
  }
  rows.push(
    { label: '접속 주소', value: loginUrl },
    { label: '업체 코드', value: input.tenantSlug.trim().toLowerCase() },
    { label: '아이디', value: input.email.trim() },
    { label: '비밀번호', value: input.password },
  );
  return [{ title: '로그인', rows }];
}
