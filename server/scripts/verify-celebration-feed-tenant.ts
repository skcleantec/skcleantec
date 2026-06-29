/**
 * 축하 feed 테넌트 격리 검증
 * cd server && npx tsx scripts/verify-celebration-feed-tenant.ts
 */
import { appendCelebrationToFeed, listCelebrationFeedAfter } from '../src/modules/realtime/celebrationFeedStore.js';

const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

const base = {
  type: 'inquiry:celebrate' as const,
  inquiryId: 'inv-1',
  registrarName: '담당',
  customerName: '고객',
  inquiryNumber: '001',
  source: '발주서',
};

const e1 = appendCelebrationToFeed({ ...base, tenantId: TENANT_A });
const e2 = appendCelebrationToFeed({ ...base, tenantId: TENANT_B, customerName: 'B고객' });

assert(e1.eventId < e2.eventId, 'event ids monotonic');

const forA = listCelebrationFeedAfter(e1.eventId - 1, TENANT_A);
assert(forA.length === 1 && forA[0]?.tenantId === TENANT_A, 'tenant A sees only A');
assert(forA[0]?.customerName === '고객', 'tenant A payload');

const forB = listCelebrationFeedAfter(e1.eventId - 1, TENANT_B);
assert(forB.length === 1 && forB[0]?.tenantId === TENANT_B, 'tenant B sees only B');
assert(forB[0]?.customerName === 'B고객', 'tenant B payload');

const forAAfterB = listCelebrationFeedAfter(e2.eventId, TENANT_A);
assert(forAAfterB.length === 0, 'tenant A no leak after B event');

console.info('[verify-celebration-feed-tenant] OK');
