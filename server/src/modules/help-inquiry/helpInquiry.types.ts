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

export const DEFAULT_HELP_INQUIRY_CATEGORIES: HelpInquiryCategory[] = [
  { id: 'general', label: '일반 문의', sortOrder: 0 },
  { id: 'feature', label: '기능 요청', sortOrder: 1 },
  { id: 'bug', label: '버그 신고', sortOrder: 2 },
];
