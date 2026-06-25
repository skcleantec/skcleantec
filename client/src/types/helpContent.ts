export type HelpRole = 'admin' | 'team';

export type HelpScreenEntry = {
  role: HelpRole;
  module: string;
  moduleOrder: number;
  /** 같은 module 내 목차 순서 (작을수록 위) */
  itemOrder?: number;
  title: string;
  path: string;
  screenshotFile: string;
  summary: string;
  markdown: string;
  /** 정적 HTML 가이드 — 있으면 iframe으로 표시 (마크다운 대신) */
  embedUrl?: string;
};

export type HelpModuleGroup = {
  module: string;
  moduleOrder: number;
  items: HelpScreenEntry[];
};
