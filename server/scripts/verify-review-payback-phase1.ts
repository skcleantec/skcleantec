/**
 * Phase 1 검증: review-payback 모듈·토큰 생성·스키마 타입
 * 실행: cd server && npx tsx scripts/verify-review-payback-phase1.ts
 */
import { generateReviewPaybackToken } from '../src/modules/review-payback/reviewPayback.token.js';
import { reviewPaybackTokenCreateField } from '../src/modules/review-payback/reviewPaybackOrderForm.js';
import { maskAccountNumber } from '../src/modules/review-payback/reviewPayback.mask.js';
import { REVIEW_PAYBACK_WS_TYPE } from '../src/modules/review-payback/reviewPayback.constants.js';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const t1 = generateReviewPaybackToken();
const t2 = generateReviewPaybackToken();
assert(t1.length === 24, 'token length 24 hex');
assert(t1 !== t2, 'tokens unique');
assert(reviewPaybackTokenCreateField().reviewPaybackToken.length === 24, 'create field token');
assert(maskAccountNumber('1234567890') === '***7890', 'mask account');
assert(REVIEW_PAYBACK_WS_TYPE === 'review-payback:new', 'ws type');

console.log('[verify-review-payback-phase1] OK');
