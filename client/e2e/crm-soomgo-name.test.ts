import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { soomgoCustomerNameForIntake } from '../src/utils/crmSoomgoImport.ts';

describe('soomgoCustomerNameForIntake', () => {
  it('지역과 같은 이름은 비운다', () => {
    assert.equal(
      soomgoCustomerNameForIntake({ customerName: '인천 연수구', region: '인천 연수구', nickname: '민지' }),
      '',
    );
    assert.equal(
      soomgoCustomerNameForIntake({ customerName: '', nickname: '서울 강남구', address: '서울 강남구' }),
      '',
    );
  });

  it('특수문자가 있는 이름은 그대로 둔다', () => {
    assert.equal(soomgoCustomerNameForIntake({ customerName: '민지♡', region: '인천 연수구' }), '민지♡');
  });
});
