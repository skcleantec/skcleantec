/** 숨고 크롤링 자동화(SoomgoAutomation) — 배포·매니페스트 */

export const SOOMGO_AUTOMATION_APP_VERSION = '1.0.6';

export type SoomgoAutomationManifest = {
  latestVersion: string;
  downloadUrl: string;
  releaseNotes?: string;
  sha256?: string;
  minAppVersion?: string;
};
