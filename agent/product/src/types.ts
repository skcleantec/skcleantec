/** HelpPage / client/public/help/data.json 과 동일 */
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

/** 에이전트 캡처 단계 산출물 */
export type HelpCaptureEntry = {
  role: HelpRole;
  module: string;
  moduleOrder: number;
  title: string;
  path: string;
  /** output/assets/screenshots/ 기준 파일명 */
  screenshotFile: string;
};

/** 에이전트 설명 생성 단계 산출물 — path 로 captures 와 병합 */
export type HelpDescriptionEntry = {
  path: string;
  summary?: string;
  markdown?: string;
};
