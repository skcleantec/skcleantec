export type HelpRole = 'admin' | 'crew';

export type HelpScreenEntry = {
  role: HelpRole;
  module: string;
  moduleOrder: number;
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
