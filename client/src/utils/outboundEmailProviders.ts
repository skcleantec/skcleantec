export type OutboundEmailProviderId = 'gmail' | 'naver' | 'daum' | 'custom';

export type OutboundEmailProviderPreset = {
  id: OutboundEmailProviderId;
  name: string;
  host: string;
  port: string;
  secure: boolean;
  shortNote: string;
  passwordHint: string;
  passwordSteps: string[];
};

export const OUTBOUND_EMAIL_PROVIDERS: OutboundEmailProviderPreset[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    host: 'smtp.gmail.com',
    port: '587',
    secure: false,
    shortNote: 'Google 계정 · 앱 비밀번호(16자리) 필요',
    passwordHint: 'Google 계정 → 보안 → 2단계 인증 후 「앱 비밀번호」 발급',
    passwordSteps: [
      '「보낼 메일 주소」에 쓸 Google 계정으로 로그인한 뒤 2단계 인증을 켭니다.',
      '그 계정에서 보안 → 「앱 비밀번호」로 메일용 16자리를 발급합니다. (다른 Google 계정 비밀번호면 실패합니다)',
      '아래에 붙여 넣습니다. 브라우저가 일반 비밀번호를 자동으로 넣지 않게 주의하세요.',
    ],
  },
  {
    id: 'naver',
    name: '네이버 메일',
    host: 'smtp.naver.com',
    port: '465',
    secure: true,
    shortNote: 'POP3/SMTP 사용 ON · 2단계 인증 시 앱 비밀번호',
    passwordHint: '2단계 인증: 네이버ID → 보안설정 → 애플리케이션 비밀번호',
    passwordSteps: [
      '네이버 메일 → 환경설정 → POP3/IMAP 설정에서 「POP3/SMTP 사용」을 켭니다.',
      '2단계 인증을 쓰면 일반 로그인 비밀번호가 아니라 「애플리케이션 비밀번호」를 발급해 입력합니다.',
      '보낼 메일 주소는 @naver.com 전체 주소와 동일해야 합니다.',
    ],
  },
  {
    id: 'daum',
    name: '다음·카카오',
    host: 'smtp.daum.net',
    port: '465',
    secure: true,
    shortNote: '다음 메일 IMAP/SMTP · 보안 연결 사용',
    passwordHint: '다음 메일 → 환경설정 → IMAP/SMTP 사용',
    passwordSteps: [
      '다음 메일 → 환경설정에서 IMAP/SMTP 사용을 켭니다.',
      '다음·카카오 로그인 비밀번호를 아래에 입력합니다.',
    ],
  },
  {
    id: 'custom',
    name: '직접 입력',
    host: '',
    port: '587',
    secure: false,
    shortNote: '회사 메일·기타 — 고급 설정에서 서버 주소 입력',
    passwordHint: '메일 업체 안내에 따라 연동 비밀번호를 입력하세요.',
    passwordSteps: ['메일 업체에서 안내한 연동 비밀번호를 입력하세요.'],
  },
];

/** @deprecated TenantSmtpSetupGuideModal 호환 */
export const PROVIDER_PRESETS = OUTBOUND_EMAIL_PROVIDERS.filter((p) => p.id !== 'custom').map((p) => ({
  name: p.name,
  host: p.host,
  port: p.port,
  secure: p.secure,
  note: p.passwordHint,
}));

export function findOutboundEmailProvider(id: OutboundEmailProviderId): OutboundEmailProviderPreset {
  return OUTBOUND_EMAIL_PROVIDERS.find((p) => p.id === id) ?? OUTBOUND_EMAIL_PROVIDERS[0];
}

export function inferOutboundEmailProvider(host: string): OutboundEmailProviderId {
  const h = host.trim().toLowerCase();
  if (h.includes('gmail')) return 'gmail';
  if (h.includes('naver')) return 'naver';
  if (h.includes('daum')) return 'daum';
  if (!h) return 'gmail';
  return 'custom';
}

export function applyOutboundEmailProviderPreset(id: OutboundEmailProviderId): {
  host: string;
  port: string;
  secure: boolean;
} {
  const preset = findOutboundEmailProvider(id);
  return {
    host: preset.host,
    port: preset.port,
    secure: preset.secure,
  };
}
