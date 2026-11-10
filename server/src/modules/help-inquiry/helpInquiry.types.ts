export type HelpInquiryCategory = {
  id: string;
  label: string;
  sortOrder: number;
};

export type HelpInquirySettingsDto = {
  contactEmail: string;
  notifyEmail: string;
  composeHelpText: string | null;
  categories: HelpInquiryCategory[];
};

export type HelpInquiryPostDto = {
  id: string;
  categoryId: string;
  categoryLabel: string;
  authorName: string;
  authorEmail: string;
  title: string;
  bodyMarkdown: string;
  imageUrls: string[];
  createdAt: string;
};

/** 신규 설치·settings 행 생성 시에만 사용. 기존 PlatformBoardCategory label은 덮어쓰지 않음. */
export const DEFAULT_HELP_INQUIRY_CATEGORIES: HelpInquiryCategory[] = [
  { id: 'general', label: '사용 방법', sortOrder: 0 },
  { id: 'billing', label: '요금·결제', sortOrder: 1 },
  { id: 'bug', label: '오류 신고', sortOrder: 2 },
  { id: 'feature', label: '기능 요청', sortOrder: 3 },
  { id: 'sales', label: '도입·상담', sortOrder: 4 },
];
