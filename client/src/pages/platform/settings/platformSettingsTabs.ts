export type PlatformSettingsTabId =
  | 'business'
  | 'bank'
  | 'smtp'
  | 'email-templates'
  | 'legal'
  | 'billing-notify';

export type PlatformSettingsTab = {
  id: PlatformSettingsTabId;
  label: string;
  description: string;
  ready: boolean;
};

export const PLATFORM_SETTINGS_TABS: PlatformSettingsTab[] = [
  {
    id: 'business',
    label: '우리 회사 정보',
    description: '사업자등록·회사 정보 (추후 입력)',
    ready: true,
  },
  {
    id: 'bank',
    label: '입금 계좌·연체',
    description: '이용료 입금 계좌, 연체 유예, 납부 안내 문구',
    ready: true,
  },
  {
    id: 'smtp',
    label: '메일',
    description: 'noreply·cbiseo SMTP 프로필 · Gmail 다른 주소로 보내기',
    ready: true,
  },
  {
    id: 'email-templates',
    label: '고객 메일',
    description: '발주서·검수 완료 메일 제목·본문 (청소비서 브랜드 서식)',
    ready: true,
  },
  {
    id: 'legal',
    label: '약관',
    description: '회원가입(/signup)에 표시되는 이용약관·개인정보 처리방침 — 수정·저장·삭제',
    ready: true,
  },
  {
    id: 'billing-notify',
    label: '이용료 알림',
    description: '업체 입금 확인 요청 알림 — 수신 이메일 저장',
    ready: true,
  },
];

export function parsePlatformSettingsTab(raw: string | undefined): PlatformSettingsTabId {
  const tab = PLATFORM_SETTINGS_TABS.find((t) => t.id === raw);
  if (tab?.ready) return tab.id;
  return 'smtp';
}

export function platformSettingsTabPath(tab: PlatformSettingsTabId): string {
  return `/platform/settings/${tab}`;
}
