import {
  CBISEO_STAFF_APP_DISPLAY_NAME,
  CBISEO_STAFF_APP_PLAY_STORE_URL,
} from '@shared/cbiseoStaffAppPolicy';

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

/** 수정 화면 등 — 평문 비밀번호를 모를 때 복사 텍스트에 넣는 안내 */
export const LOGIN_COPY_PASSWORD_PLACEHOLDER =
  '(등록·재설정 직후에만 확인 가능 — 새 비밀번호 입력 후 복사하면 포함됩니다)';

export function resolveLoginCopyPassword(password: string | undefined | null): string {
  const trimmed = password?.trim() ?? '';
  return trimmed || LOGIN_COPY_PASSWORD_PLACEHOLDER;
}

function includesStaffAppOnboarding(accountLabel?: string): boolean {
  const label = accountLabel?.trim();
  return label === '팀장' || label === '마케터';
}

/** 관리자 → 카톡·문자 전달용 로그인 안내 텍스트 */
export function buildLoginCredentialsCopyText(input: LoginCredentialsCopyInput): string {
  const loginUrl = (input.loginUrl?.trim() || resolveLoginPageUrl()).replace(/\/+$/, '');
  const tenantSlug = input.tenantSlug.trim().toLowerCase();
  const email = input.email.trim();
  const staffApp = includesStaffAppOnboarding(input.accountLabel);

  const lines: string[] = ['━━━━━ 청소비서 로그인 안내 ━━━━━'];

  if (input.accountLabel?.trim()) {
    lines.push(`계정 구분: ${input.accountLabel.trim()}`, '');
  }

  if (staffApp) {
    lines.push(
      `[앱 설치]`,
      `Google Play에서 「${CBISEO_STAFF_APP_DISPLAY_NAME}」 앱을 검색해 설치해 주세요.`,
      CBISEO_STAFF_APP_PLAY_STORE_URL,
      '',
      `[로그인 정보]`,
      `업체 코드: ${tenantSlug}`,
      `아이디: ${email}`,
      `비밀번호: ${input.password}`,
      '',
      `[이용 방법]`,
      `① Google Play에서 ${CBISEO_STAFF_APP_DISPLAY_NAME} 앱 설치`,
      `② 앱 실행 → 업체 코드 → 아이디 → 비밀번호 순서로 입력 후 로그인`,
      `③ 처음 로그인 시 안내에 따라 본인 정보를 입력해 주세요`,
      `④ (선택) 다음부터 카카오로 편하게 로그인하려면`,
      `   · 우측 상단 프로필(이름) 메뉴 → 「카카오 계정 연결」`,
      `   · 「카카오 계정 연결하기」 → 카카오 로그인 → 비밀번호 입력 → 「연결 완료」`,
      '',
      `[PC·웹 로그인]`,
      `접속 주소: ${loginUrl}`,
    );
  } else {
    lines.push(
      `접속 주소: ${loginUrl}`,
      `업체 코드: ${tenantSlug}`,
      `아이디: ${email}`,
      `비밀번호: ${input.password}`,
      '',
      '① 위 주소로 접속',
      '② 업체 코드 → 아이디 → 비밀번호 순서로 입력',
      '③ 로그인 후 안내에 따라 본인 정보를 입력해 주세요.',
    );
  }

  lines.push('━━━━━━━━━━━━━━━━━━━');

  return lines.filter((line, i, arr) => !(line === '' && i > 0 && arr[i - 1] === '')).join('\n');
}

export function loginCredentialsCopySections(input: LoginCredentialsCopyInput) {
  const loginUrl = (input.loginUrl?.trim() || resolveLoginPageUrl()).replace(/\/+$/, '');
  const staffApp = includesStaffAppOnboarding(input.accountLabel);
  const sections: { title: string; rows: { label: string; value: string }[] }[] = [];

  if (input.accountLabel?.trim()) {
    sections.push({
      title: '계정',
      rows: [{ label: '구분', value: input.accountLabel.trim() }],
    });
  }

  if (staffApp) {
    sections.push({
      title: '앱 설치',
      rows: [
        { label: '앱 이름', value: CBISEO_STAFF_APP_DISPLAY_NAME },
        { label: 'Google Play', value: CBISEO_STAFF_APP_PLAY_STORE_URL },
      ],
    });
    sections.push({
      title: '로그인 정보',
      rows: [
        { label: '업체 코드', value: input.tenantSlug.trim().toLowerCase() },
        { label: '아이디', value: input.email.trim() },
        { label: '비밀번호', value: input.password },
      ],
    });
    sections.push({
      title: 'PC·웹',
      rows: [{ label: '접속 주소', value: loginUrl }],
    });
  } else {
    sections.push({
      title: '로그인',
      rows: [
        { label: '접속 주소', value: loginUrl },
        { label: '업체 코드', value: input.tenantSlug.trim().toLowerCase() },
        { label: '아이디', value: input.email.trim() },
        { label: '비밀번호', value: input.password },
      ],
    });
  }

  return sections;
}
