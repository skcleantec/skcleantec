/**
 * 빠른등록 날짜 파서 스모크 — `npx tsx scripts/_check-quick-paste-dates.ts`
 */
import { parseQuickPasteText } from '../src/modules/quick-paste/quickPasteParse.service.js';
import {
  normalizePreferredDateOrNull,
  parsePreferredDateFromText,
} from '../src/modules/quick-paste/quickPasteDate.helpers.js';
import { dateLabelAlternation } from '../src/modules/quick-paste/quickPastePatterns.js';

const cases: Array<{ name: string; text: string; expect: string }> = [
  {
    name: '라벨+점날짜+오전',
    text: '예약자: 홍길동\n날짜 : 2026.03.28 오전\n잔금 23만',
    expect: '2026-03-28',
  },
  {
    name: '희망일 YMD',
    text: '희망일: 2026-03-28',
    expect: '2026-03-28',
  },
  {
    name: 'YYMMDD near label',
    text: '예약일 260406',
    expect: '2026-04-06',
  },
  {
    name: 'YY.MM.DD',
    text: '날짜: 26.03.28',
    expect: '2026-03-28',
  },
];

let failed = 0;
for (const c of cases) {
  const parsed = parseQuickPasteText(c.text);
  const ok = parsed.draft.preferredDate === c.expect;
  console.log(ok ? 'OK' : 'FAIL', c.name, '→', parsed.draft.preferredDate, '(expect', c.expect + ')');
  if (!ok) failed += 1;
}

const badAi = normalizePreferredDateOrNull('260406');
console.log(badAi === '2026-04-06' ? 'OK' : 'FAIL', 'normalize YYMMDD', badAi);

const reject = normalizePreferredDateOrNull('not-a-date');
console.log(reject == null ? 'OK' : 'FAIL', 'reject junk', reject);

const fromText = parsePreferredDateFromText('날짜 : 2026.03.28 오전', dateLabelAlternation());
console.log(
  fromText.date === '2026-03-28' &&
    /2026\.03\.28/.test(fromText.snippet ?? '') &&
    /오전/.test(fromText.snippet ?? '')
    ? 'OK'
    : 'FAIL',
  'fromText',
  fromText.date,
  fromText.snippet,
  fromText.rawDateText,
);

const withTime = parseQuickPasteText('날짜 : 2026.03.28 오전\n잔금 10만');
console.log(
  withTime.draft.preferredTime === '오전' ? 'OK' : 'FAIL',
  'preferredTime',
  withTime.draft.preferredTime,
);

if (failed > 0) {
  process.exitCode = 1;
  console.error(`\n${failed} case(s) failed`);
} else {
  console.log('\nall date checks passed');
}
