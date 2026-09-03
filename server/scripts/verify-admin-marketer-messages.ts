/**
 * 관리자↔마케터 메시지 허용 매트릭스 (DB 없음)
 * 실행: cd server ; npx tsx scripts/verify-admin-marketer-messages.ts
 */
import { canMessagePair } from '../src/modules/messages/canMessagePair.js';

const expectTrue: Array<[string, string]> = [
  ['ADMIN', 'MARKETER'],
  ['MARKETER', 'ADMIN'],
  ['ADMIN', 'TEAM_LEADER'],
  ['MARKETER', 'TEAM_LEADER'],
  ['ADMIN', 'EXTERNAL_PARTNER'],
  ['MARKETER', 'EXTERNAL_PARTNER'],
  ['TEAM_LEADER', 'ADMIN'],
  ['TEAM_LEADER', 'MARKETER'],
  ['EXTERNAL_PARTNER', 'ADMIN'],
  ['EXTERNAL_PARTNER', 'MARKETER'],
];

const expectFalse: Array<[string, string]> = [
  ['MARKETER', 'MARKETER'],
  ['ADMIN', 'ADMIN'],
  ['TEAM_LEADER', 'TEAM_LEADER'],
  ['TEAM_LEADER', 'EXTERNAL_PARTNER'],
  ['EXTERNAL_PARTNER', 'TEAM_LEADER'],
  ['CREW', 'ADMIN'],
  ['ADMIN', 'CREW'],
];

let failed = 0;
for (const [a, b] of expectTrue) {
  if (!canMessagePair(a, b)) {
    console.error(`FAIL expected allow ${a} → ${b}`);
    failed += 1;
  }
}
for (const [a, b] of expectFalse) {
  if (canMessagePair(a, b)) {
    console.error(`FAIL expected deny ${a} → ${b}`);
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`verify-admin-marketer-messages: ${failed} failed`);
  process.exit(1);
}
console.log('verify-admin-marketer-messages: ok');
