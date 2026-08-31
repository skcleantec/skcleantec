/**
 * 팀장 스케줄 — KST 날짜 직렬화·월 구간 정밀 검증
 * 실행: cd server && npx tsx scripts/verify-team-schedule-kst.ts
 */
import {
  kstMonthRangeYm,
  kstTodayYmd,
  addDaysToKstYmd,
} from '../src/modules/inquiries/inquiryListDateRange.js';
import {
  serializeTeamInquiryPreferredDateKst,
  serializeTeamInquiryPreferredDatesKst,
} from '../src/modules/team/teamInquiryResponse.helpers.js';
import { dateToYmdKst } from '../src/modules/users/userEmployment.js';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

function assertEq(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`ASSERT ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/** slice(0,10) on UTC ISO — 구 버그 재현 */
function legacyUtcSlice(iso: string): string {
  return iso.slice(0, 10);
}

function main(): void {
  console.log('verify-team-schedule-kst: start');

  // 1) KST 자정 전후 UTC ISO → YMD (한국 8/31 00:30 = UTC 8/30 15:30)
  const kstMidnightEdge = new Date('2026-08-30T15:00:00.000Z');
  const serialized = serializeTeamInquiryPreferredDateKst({ id: 'x', preferredDate: kstMidnightEdge });
  assertEq(serialized.preferredDate, '2026-08-31', 'UTC ISO → KST YMD');
  assert(
    legacyUtcSlice(kstMidnightEdge.toISOString()) !== serialized.preferredDate,
    'legacy slice must differ from KST YMD on edge case',
  );

  // 2) 이미 YMD 문자열이면 그대로
  assertEq(
    serializeTeamInquiryPreferredDateKst({ preferredDate: '2026-09-01' }).preferredDate,
    '2026-09-01',
    'plain YMD passthrough',
  );

  // 3) null
  assertEq(serializeTeamInquiryPreferredDateKst({ preferredDate: null }).preferredDate, null, 'null preferredDate');

  // 4) 목록 직렬화
  const list = serializeTeamInquiryPreferredDatesKst([
    { preferredDate: kstMidnightEdge },
    { preferredDate: '2026-09-15' },
  ]);
  assertEq(list.length, 2, 'list length');
  assertEq(list[0]?.preferredDate, '2026-08-31', 'list[0] KST');
  assertEq(list[1]?.preferredDate, '2026-09-15', 'list[1] passthrough');

  // 5) 월 구간 — KST 8월 말일 23:59 포함
  const aug = kstMonthRangeYm('2026-08');
  assert(aug != null, 'aug range exists');
  assertEq(dateToYmdKst(aug!.gte), '2026-08-01', 'aug start YMD');
  assertEq(dateToYmdKst(aug!.lte), '2026-08-31', 'aug end YMD');

  // 6) 클라이언트 getMonthRange와 동일 키 (오늘 KST 달)
  const today = kstTodayYmd();
  const monthKey = today.slice(0, 7);
  const monthRange = kstMonthRangeYm(monthKey);
  assert(monthRange != null, 'current month range');
  const monthStart = monthKey + '-01';
  assertEq(dateToYmdKst(monthRange!.gte), monthStart, 'current month start');

  // 7) PATCH 저장 패턴(T12:00:00+09:00) 왕복
  const patchYmd = '2026-12-31';
  const stored = new Date(`${patchYmd}T12:00:00+09:00`);
  assertEq(serializeTeamInquiryPreferredDateKst({ preferredDate: stored }).preferredDate, patchYmd, 'PATCH noon KST');

  // 8) addDaysToKstYmd 연말
  assertEq(addDaysToKstYmd('2026-12-31', 1), '2027-01-01', 'KST year rollover');

  console.log('verify-team-schedule-kst: OK (all checks passed)');
}

main();
