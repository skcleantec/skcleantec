/**
 * 잔금 원문 인용 스모크 — `npx tsx scripts/_check-quick-paste-balance-evidence.ts`
 */
import {
  findBalanceEvidenceSnippet,
  parseBalanceAmountFromText,
} from '../src/modules/quick-paste/quickPasteAmount.helpers.js';
import { buildRuleFieldEvidence } from '../src/modules/quick-paste/quickPasteEvidence.helpers.js';
import { parseQuickPasteText } from '../src/modules/quick-paste/quickPasteParse.service.js';

const text = `✨깨끗주의보 예약확정 문자✨
상담 최희정

1⃣ 성함 : 임현섭(거주)
2⃣ 연락처 및 비상연락처 : 010-6533-1515
4⃣ 현장주소 : 경기도 평택시 소사동 sk뷰아파트 102동 1301호
5⃣ 평수 : 34평(부분)
6⃣ 방갯수 (방 / 화장실 / 베란다 ) : 방2개 거실/주방 화장실1개
7⃣ 방문 희망시간 및 날짜 :3월 28일 시간무관

✔ 15만 원 상당 집안 전체 공간 살균 서비스 제공
✔ 창틀 실리콘 곰팡이 방지 약품 도포

청소비용 25만원
`;

const amount = parseBalanceAmountFromText(text);
const sn = findBalanceEvidenceSnippet(text, amount);
const parsed = parseQuickPasteText(text);
const ev = buildRuleFieldEvidence(text, parsed.draft);

const okAmount = amount === 250_000 && parsed.draft.serviceBalanceAmount === 250_000;
const okSn =
  Boolean(sn && /청소비용\s*25만/.test(sn)) &&
  Boolean(ev.serviceBalanceAmount?.snippet && /청소비용\s*25만/.test(ev.serviceBalanceAmount.snippet)) &&
  !/15만/.test(sn || '') &&
  !/15만/.test(ev.serviceBalanceAmount?.snippet || '');

console.log(okAmount ? 'OK' : 'FAIL', 'amount', amount, 'draft', parsed.draft.serviceBalanceAmount);
console.log(okSn ? 'OK' : 'FAIL', 'snippet', sn);
console.log('evidence', ev.serviceBalanceAmount?.snippet);

if (!okAmount || !okSn) process.exit(1);
