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
};

export type HelpModuleGroup = {
  module: string;
  moduleOrder: number;
  items: HelpScreenEntry[];
};
