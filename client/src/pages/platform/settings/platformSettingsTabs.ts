export type PlatformSettingsTabId = 'smtp' | 'business' | 'legal';

export type PlatformSettingsTab = {
  id: PlatformSettingsTabId;
  label: string;
  description: string;
  ready: boolean;
};

export const PLATFORM_SETTINGS_TABS: PlatformSettingsTab[] = [
  {
    id: 'smtp',
    label: 'SMTP',
    description: '플랫폼 알림·입금 확인 요청 메일 발송',
    ready: true,
  },
  {
    id: 'business',
    label: '사업자 정보',
    description: '사업자등록·회사 정보 (추후 입력)',
    ready: true,
  },
  {
    id: 'legal',
    label: '이용약관·계약',
    description: '회원사 약관·고객 동의 문서 관리 및 링크 체결',
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
