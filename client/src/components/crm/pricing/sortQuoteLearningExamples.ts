import type { TelecrmQuoteCrewLearningExample } from '@shared/telecrmQuoteCrewLearning';

/** 비교 접수 — 최신순, 최대 5건. CRM 안내와 견적 도우미가 같이 쓴다. */
export function sortExamplesLatestFirst(list: TelecrmQuoteCrewLearningExample[]): TelecrmQuoteCrewLearningExample[] {
  const t = (ex: TelecrmQuoteCrewLearningExample) => {
    const v = ex.date ? new Date(ex.date).getTime() : NaN;
    return Number.isNaN(v) ? -Infinity : v;
  };
  return [...list].sort((a, b) => t(b) - t(a)).slice(0, 5);
}
