/**
 * 축하 바 — 외부 운영자(플랫폼 지원·개발용) 등록자 제외 검증
 * cd server && npx tsx scripts/verify-inquiry-celebrate-eligibility.ts
 */
import { isExternalOperatorRegistrar } from '../src/modules/realtime/inquiryCelebrateEligibility.js';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

assert(
  isExternalOperatorRegistrar({ email: 'pyo', platformSupportAccessId: null }),
  'team-preview email excluded',
);
assert(
  !isExternalOperatorRegistrar({ email: 'marketer1', platformSupportAccessId: null }),
  'normal staff included',
);
assert(
  isExternalOperatorRegistrar({ email: 'psaabc', platformSupportAccessId: 'uuid-1' }),
  'platform support shadow excluded',
);
assert(
  !isExternalOperatorRegistrar({ email: 'admin', platformSupportAccessId: null }),
  'tenant admin (non-dev list) included',
);

console.info('[verify-inquiry-celebrate-eligibility] OK');
