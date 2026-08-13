export const OUTBOUND_EMAIL_COPY = {
  pageTitle: '발송 이메일 설정',
  pageIntro:
    '견적서·영수증 등 고객에게 보내는 메일을, 우리 업체 메일 주소로 보내도록 연결합니다.',
  platformCustomerMailNote:
    '발주서 제출 확인·현장검수 완료본 메일은 청소비서 플랫폼(noreply)에서 자동 발송됩니다. 여기서는 견적서·영수증 발송용 SMTP만 설정하면 됩니다.',
  scopeTitle: '이 설정은 누구 메일로 보내나요?',
  scopeCommon: '업체 공통',
  scopeBrandHint: (brand: string) =>
    `${brand} 고객 메일은 여기서 연결한 메일로만 보냅니다. 비워 두면 해당 브랜드로는 메일을 보내지 않습니다(다른 업체 메일로 대체하지 않음).`,
  scopeCommonHint: '브랜드가 없는 접수·공통 안내용 기본 메일 연결입니다.',
  fallbackPlatform:
    '아래를 비워 두면 청소비서 기본 메일로 보낼 수 있습니다. 고객에게 우리 업체 이름·메일로 보이게 하려면 여기서 설정하세요.',
  fallbackBrandEffective: (brand: string) =>
    `${brand} 전용 발송 이메일이 없습니다. 이 브랜드 메일은 보낼 수 없으며, 다른 업체 메일로 대신 보내지 않습니다.`,
  statusReady: '메일 보내기 준비됨',
  statusFallback: '다른 설정으로 메일을 보냅니다',
  statusMissing: '아직 메일을 보낼 수 없습니다',
  sectionTitle: '메일 보내기 연결',
  guideButton: '자세한 설명 보기',
  stepProvider: '어떤 메일을 쓰시나요?',
  stepEmail: '보낼 메일 주소',
  /** 플랫폼 고객 SMTP 프로필 — wizard 2단계 (로그인 ≠ 발신 표시) */
  platformStepLoginEmail: 'Gmail 로그인 계정',
  platformLoginEmailHint:
    '앱 비밀번호를 발급한 Google 계정입니다. 메일함 로그인용이며, 아래 「고객 발신 주소」와 다릅니다.',
  platformCustomerFromLabel: '고객에게 보이는 발신 주소 (noreply)',
  platformCustomerFromHint:
    '발주서·검수 완료 메일 수신함에 표시되는 주소입니다. Gmail 「다른 주소로 보내기」에 등록한 noreply를 입력하세요.',
  platformSystemFromLabel: '시스템 알림 발신 주소 (cbiseo)',
  platformSystemFromHint:
    '입금 확인 요청 등 운영팀 알림에 표시되는 From입니다. Gmail 「다른 주소로 보내기」에 등록한 cbiseo@service-bridges.com 을 입력하세요. SMTP 로그인은 앱 비밀번호를 발급한 Google 계정(예: cleanbiseo@gmail.com)입니다.',
  platformProfilesIntro:
    'Gmail 「다른 주소로 보내기」와 같이 프로필마다 로그인 계정·발신 주소를 따로 둡니다. 고객 자동발송(noreply)과 플랫폼 알림(cbiseo)은 아래 기본 행에서 각각 설정하세요.',
  platformProfilesVsBillingNote:
    '입금 확인 알림 수신 주소(billing@)는 설정 → 이용료 알림 탭에서 지정합니다. 발송(SMTP)은 「플랫폼 알림 (cbiseo)」 행에서 설정합니다.',
  stepName: '받는 사람에게 보이는 이름',
  stepPassword: '메일 연동 비밀번호',
  stepTest: '연습 보내기',
  sendEmailHint: '메일함에 로그인할 때 쓰는 주소 전체 (@ 포함)',
  displayNameHint: '고객 메일함에 「발신: ○○」처럼 보이는 이름',
  passwordHint:
    'Gmail 앱 비밀번호는 Google이 「abcd efgh ijkl mnop」처럼 띄어 보여 줍니다. 띄어쓰기 있는 그대로 붙여넣어도 됩니다(공백은 자동 무시). 이미 저장됐으면 비밀번호 칸은 비운 채 위 「연습 메일 수신」에서 보내면 됩니다.',
  passwordConfiguredPlaceholder: '●●●●●●●● 저장됨 (바꿀 때만 다시 입력)',
  passwordClear: '칸 비우기',
  passwordReveal: '저장된 앱 비밀번호 보기',
  passwordRevealTitle: '저장된 앱 비밀번호 보기',
  passwordRevealBody:
    '보안을 위해 관리자 로그인 비밀번호를 확인한 뒤, 저장된 메일 연동(앱) 비밀번호를 입력란에 표시합니다.',
  passwordRevealSubmit: '확인 후 보기',
  passwordRevealCancel: '취소',
  passwordRevealSuccess: '저장된 앱 비밀번호를 입력란에 표시했습니다.',
  passwordSavedHint:
    '연동 비밀번호가 이미 저장되어 있습니다. 보려면 「저장된 앱 비밀번호 보기」를 누르세요. 자동완성으로 긴 값이 보이면 「칸 비우기」 후, 위 「연습 메일 수신」에서 연습 메일을 보내세요.',
  passwordGmailReady: (n: number) =>
    n === 16
      ? '앱 비밀번호 16자리로 인식되었습니다. (띄어쓰기는 무시됨)'
      : `공백 제외 ${n}자리 — 앱 비밀번호는 공백 없이 16자리여야 합니다.`,
  testEmailHint:
    '연습 메일을 받을 본인 주소를 직접 입력하세요. 업체 대표 메일·브랜드 메일이 자동으로 들어가지 않습니다.',
  testEmailLabel: '연습 받을 내 메일',
  testEmailPlaceholder: '받을 내 메일 주소 입력',
  testEmailSectionTitle: '연습 메일 수신',
  save: '저장',
  saveAndTest: '저장하고 연습 메일 보내기',
  testOnly: '연습 메일 보내기',
  saving: '저장 중…',
  testing: '보내는 중…',
  advancedToggle: '고급 설정 (메일 회사 서버·연결 번호 직접 바꾸기)',
  advancedHost: '메일 회사 서버 주소',
  advancedPort: '연결 번호',
  advancedSecure: '보안 연결(잠금) 사용',
  advancedSecureHint: 'Gmail 587은 끄기 · 네이버·다음 465는 켜기',
  viewAllFields: '한 번에 보기 (고급)',
  viewWizard: '단계별로 설정하기',
  prev: '이전',
  next: '다음',
  successSave: (scope: string) => `${scope} 메일 연결 설정이 저장되었습니다.`,
  successTest: '연습 메일을 보냈습니다. 받은편지함(스팸함)을 확인해 주세요.',
  successSaveAndTest:
    '설정을 저장하고 연습 메일을 보냈습니다. 받은편지함(스팸함)을 확인해 주세요.',
  clearSmtp: '이 메일 연결 삭제',
  clearSmtpConfirmTitle: '발송 이메일 연결을 삭제할까요?',
  clearSmtpConfirmBody: (scope: string) =>
    `${scope}에 저장된 SMTP(메일 서버·비밀번호)를 삭제합니다. 삭제 후에는 이 범위로는 고객 메일을 보낼 수 없습니다.`,
  clearSmtpPasswordLabel: '본인 로그인 비밀번호',
  clearSmtpSuccess: (scope: string) => `${scope} 메일 연결이 삭제되었습니다.`,
  clearSmtpCancel: '취소',
  clearSmtpSubmit: '삭제',
} as const;
