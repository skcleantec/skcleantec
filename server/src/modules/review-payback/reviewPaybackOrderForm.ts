import { generateReviewPaybackToken } from './reviewPayback.token.js';

/** 발주서 create data 에 spread — 발급 시 페이백 토큰 자동 부여 */
export function reviewPaybackTokenCreateField(): { reviewPaybackToken: string } {
  return { reviewPaybackToken: generateReviewPaybackToken() };
}
