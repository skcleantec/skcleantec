/**
 * 안내사항 위약 — 중복·당일·줄바꿈 (npx tsx scripts/verify-order-guide-cancellation.ts)
 */
import assert from 'node:assert/strict';
import {
  buildGuidePlaceholderContextFromPolicy,
  ensureCancellationPolicyPlaceholderInSections,
  expandGuideSectionItems,
  GUIDE_PLACEHOLDER_CANCELLATION_POLICY,
  isLineCoveredByCancellationPolicyToken,
} from '../src/lib/orderFormGuidePlaceholders.js';
import {
  DEFAULT_OPERATING_COMPANY_CANCELLATION_POLICY,
  renderCancellationPolicyLines,
} from '../src/lib/operatingCompanyCancellationPolicyCore.js';

const PRE_DAY =
  '고객님 사정으로 전일 청소 예약 취소 또는 변경 시 청소비 위약금 30%가 적용됩니다.';
const SAME_DAY =
  '고객님 사정으로 당일 청소 예약 취소 또는 변경 시 청소비 위약금 50%가 적용됩니다.';

function editorTextToGuideItems(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

function testEnsureStripsRealStoredDupes() {
  const sections = ensureCancellationPolicyPlaceholderInSections([
    {
      title: '취소·변경 안내',
      items: [
        PRE_DAY,
        '당일 취소 또는 변경 시 위약금 50%가 적용됩니다.',
        '예약일 14일 이내 취소 시 예약금은 반환되지 않음을 양해 부탁드립니다.',
      ],
    },
  ]);
  const items = sections[0]!.items;
  assert.deepEqual(items, [
    GUIDE_PLACEHOLDER_CANCELLATION_POLICY,
    '예약일 14일 이내 취소 시 예약금은 반환되지 않음을 양해 부탁드립니다.',
  ]);
}

function testEnsureStripsDuplicatePreDay() {
  const sections = ensureCancellationPolicyPlaceholderInSections([
    {
      title: '취소·변경 안내',
      items: [
        GUIDE_PLACEHOLDER_CANCELLATION_POLICY,
        PRE_DAY,
        '예약일 14일 이내 취소 시 예약금은 반환되지 않음을 양해 부탁드립니다.',
      ],
    },
  ]);
  const items = sections[0]!.items;
  assert.equal(items.filter((l) => l === PRE_DAY).length, 0, '전일 한글 중복 줄이 남아 있음');
  assert.ok(items.includes(GUIDE_PLACEHOLDER_CANCELLATION_POLICY));
  assert.ok(items.some((l) => l.includes('14일')));
}

function testExpandHasSameDayOnce() {
  const ctx = buildGuidePlaceholderContextFromPolicy(DEFAULT_OPERATING_COMPANY_CANCELLATION_POLICY);
  const expanded = expandGuideSectionItems(
    [GUIDE_PLACEHOLDER_CANCELLATION_POLICY, PRE_DAY],
    ctx,
  );
  const pre = expanded.filter((l) => l === PRE_DAY);
  const same = expanded.filter((l) => l === SAME_DAY);
  assert.equal(pre.length, 1, `전일이 ${pre.length}번`);
  assert.equal(same.length, 1, `당일이 ${same.length}번`);
  const policyLines = renderCancellationPolicyLines(DEFAULT_OPERATING_COMPANY_CANCELLATION_POLICY);
  assert.ok(policyLines.some((l) => l.includes('당일')), '기본 정책에 당일 구간 없음');
}

function testEnterKeepsBlankLine() {
  const items = editorTextToGuideItems('첫 줄\n\n둘째 줄');
  assert.deepEqual(items, ['첫 줄', '', '둘째 줄']);
  assert.deepEqual(editorTextToGuideItems('첫 줄\r\n둘째 줄'), ['첫 줄', '둘째 줄']);
}

function testCoveredLineDetection() {
  assert.equal(isLineCoveredByCancellationPolicyToken(PRE_DAY), true);
  assert.equal(isLineCoveredByCancellationPolicyToken(SAME_DAY), true);
  assert.equal(
    isLineCoveredByCancellationPolicyToken(
      '예약일 14일 이내 취소 시 예약금은 반환되지 않음을 양해 부탁드립니다.',
    ),
    false,
  );
  assert.equal(
    isLineCoveredByCancellationPolicyToken('당일 취소 또는 변경 시 위약금 50%가 적용됩니다.'),
    true,
  );
}

testEnsureStripsRealStoredDupes();
testEnsureStripsDuplicatePreDay();
testExpandHasSameDayOnce();
testEnterKeepsBlankLine();
testCoveredLineDetection();
console.log('verify-order-guide-cancellation: ok');
