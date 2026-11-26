import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mutedNameNorm, mutedRuleMatches, pickMutedRule, validateMutedInput } from './bankDepositMuted.logic.js';

const base = { id: 'r1', operatingCompanyId: null, nameNorm: '토스페이먼츠', displayName: '토스페이먼츠', matchMode: 'exact', enabled: true };

describe('고정 입금처 매칭', () => {
  it('공백·대소문자 무시하고 정확히 같으면 맞는다', () => {
    assert.equal(mutedNameNorm(' 토스 페이먼츠 '), '토스페이먼츠');
    assert.equal(mutedRuleMatches(base, '토스 페이먼츠', 'oc1'), true);
    assert.equal(mutedRuleMatches(base, '토스페이먼츠2', 'oc1'), false);
  });
  it('prefix 모드는 뒤 숫자·기호를 무시한다', () => {
    const rule = { ...base, nameNorm: 'ksnet_0001', matchMode: 'prefix' };
    assert.equal(mutedRuleMatches(rule, 'KSNET_7731', null), true);
    assert.equal(mutedRuleMatches(rule, 'KSNET 99', null), true);
    assert.equal(mutedRuleMatches(rule, 'KS', null), false);
  });
  it('끈 규칙·다른 브랜드 규칙은 맞지 않는다', () => {
    assert.equal(mutedRuleMatches({ ...base, enabled: false }, '토스페이먼츠', null), false);
    assert.equal(mutedRuleMatches({ ...base, operatingCompanyId: 'ocA' }, '토스페이먼츠', 'ocB'), false);
    assert.equal(mutedRuleMatches({ ...base, operatingCompanyId: 'ocA' }, '토스페이먼츠', 'ocA'), true);
  });
  it('브랜드 지정 규칙이 공통 규칙보다 먼저 잡힌다', () => {
    const common = { ...base, id: 'c' };
    const brand = { ...base, id: 'b', operatingCompanyId: 'ocA', displayName: '토스(브랜드A)' };
    assert.equal(pickMutedRule([common, brand], '토스페이먼츠', 'ocA')?.id, 'b');
    assert.equal(pickMutedRule([common, brand], '토스페이먼츠', 'ocB')?.id, 'c');
    assert.equal(pickMutedRule([common, brand], '홍길동', 'ocB'), null);
  });
});

describe('고정 입금처 입력 검증', () => {
  it('짧은 이름은 거절하고 표시명은 입금자명으로 채운다', () => {
    assert.equal(validateMutedInput({ depositorName: '김' }).ok, false);
    const ok = validateMutedInput({ depositorName: ' 케이에스넷 ', kind: 'PG', matchMode: 'weird' });
    assert.ok(ok.ok);
    if (ok.ok) {
      assert.equal(ok.value.displayName, '케이에스넷');
      assert.equal(ok.value.kind, 'PG');
      assert.equal(ok.value.matchMode, 'exact');
      assert.equal(ok.value.operatingCompanyId, null);
    }
  });
});
