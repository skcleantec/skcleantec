import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  closedStatusForBookedInquiry,
  isOpenCallStatus,
  matchFollowupToInquiry,
  parseAutoCloseLog,
  pickFollowupBooking,
  statusAfterSweep,
  type FollowupMatchInput,
  type InquiryMatchInput,
} from './orderFollowupBooking.logic.js';

const day = new Date('2026-11-20T03:00:00.000Z');

function inquiry(patch: Partial<InquiryMatchInput> = {}): InquiryMatchInput {
  return {
    id: 'inq-1',
    inquiryNumber: '251120-0001',
    status: 'RECEIVED',
    operatingCompanyId: 'brand-a',
    operatingCompanyName: '브랜드A',
    marketerName: '김마케터',
    customerName: '홍길동',
    nickname: null,
    customerPhone: '010-1111-2222',
    customerPhone2: null,
    address: '서울특별시 강남구 역삼동 래미안아파트 101동 502호',
    buildingType: '아파트',
    areaPyeong: 24,
    roomCount: 3,
    bathroomCount: 2,
    isOneRoom: false,
    preferredDate: day,
    createdAt: day,
    ...patch,
  };
}

function followup(patch: Partial<FollowupMatchInput> = {}): FollowupMatchInput {
  return {
    operatingCompanyId: 'brand-a',
    customerName: '홍길동',
    nickname: null,
    customerPhone: '010-9999-0000',
    customerPhone2: null,
    address: '서울특별시 강남구 역삼동 래미안아파트 102동 803호',
    memo: '',
    areaPyeong: 24,
    roomCount: 3,
    bathroomCount: 2,
    isOneRoom: false,
    preferredMoveInCleaningDate: '2026-11-20',
    status: 'ABSENT',
    ...patch,
  };
}

describe('부재보류와 접수 맞추기', () => {
  it('판정 표', () => {
    assert.equal(matchFollowupToInquiry(followup({ customerPhone: '010-1111-2222', customerName: '다른사람', address: '부산광역시 해운대구 우동' }), inquiry()).level, 'booked');
    assert.deepEqual(
      matchFollowupToInquiry(followup({ customerName: '홍길동', address: '', areaPyeong: null, preferredMoveInCleaningDate: null }), inquiry({ address: '서울특별시 송파구 잠실동' })).level,
      null,
    );
    const nameAddress = matchFollowupToInquiry(
      followup({ areaPyeong: null, preferredMoveInCleaningDate: null, memo: '' }),
      inquiry({ buildingType: null, memo: '' }),
    );
    assert.equal(nameAddress.level, 'suspect');
    assert.ok(nameAddress.reasons.includes('name') && nameAddress.reasons.includes('address'));

    const strong = matchFollowupToInquiry(followup(), inquiry({ customerPhone: '010-0000-0000' }));
    assert.equal(strong.level, 'booked');
    assert.ok(strong.reasons.includes('structure'));

    const nameDate = matchFollowupToInquiry(
      followup({ address: '', areaPyeong: null }),
      inquiry({ address: '', buildingType: null }),
    );
    assert.equal(nameDate.level, 'suspect');
    assert.ok(nameDate.reasons.includes('date'));

    const noName = matchFollowupToInquiry(
      followup({ customerName: '김다른', nickname: null }),
      inquiry({ customerName: '이접수', nickname: null, customerPhone: '010-0000-1111' }),
    );
    assert.equal(noName.level, 'suspect');
    assert.equal(noName.reasons.includes('name'), false);

    assert.equal(
      matchFollowupToInquiry(
        followup({ address: '서울특별시 강남구 역삼동', areaPyeong: null, preferredMoveInCleaningDate: null }),
        inquiry({ address: '서울특별시 마포구 합정동 다른아파트', customerPhone: '010-2222-3333' }),
      ).level,
      null,
    );

    const nick = matchFollowupToInquiry(
      followup({ customerName: '고객', nickname: '길동맘', customerPhone: '010-3333-4444' }),
      inquiry({ customerName: '홍길동', nickname: '길동맘(숨고)', customerPhone: '010-5555-6666' }),
    );
    assert.equal(nick.level, 'booked');
    assert.ok(nick.reasons.includes('name'));

    const safe = matchFollowupToInquiry(
      followup({ customerPhone: '0504-111-2222', customerPhone2: '010-1111-2222', customerName: '무관', address: '' }),
      inquiry({ customerPhone: '01011112222', address: '' }),
    );
    assert.equal(safe.level, 'booked');
    assert.ok(safe.reasons.includes('phone'));

    const landline = matchFollowupToInquiry(
      followup({ customerPhone: '02-345-6789', customerName: '무관', address: '' }),
      inquiry({ customerPhone: '023456789', address: '' }),
    );
    assert.equal(landline.level, 'booked');
  });

  it('다른 브랜드는 닫지 않고 otherBrand 로만 보여 준다', () => {
    const booking = pickFollowupBooking(
      followup({ customerPhone: '010-1111-2222', operatingCompanyId: 'brand-a' }),
      [inquiry({ operatingCompanyId: 'brand-b', customerPhone: '010-1111-2222' })],
    );
    assert.equal(booking?.level, 'otherBrand');
    assert.equal(booking?.operatingCompanyId, 'brand-b');
  });

  it('입금대기·대기 접수도 열린 목록 상태가 아니다', () => {
    for (const status of ['DEPOSIT_PENDING', 'PENDING', 'RECEIVED']) {
      const next = closedStatusForBookedInquiry(status);
      assert.equal(next, 'FULFILLED');
      assert.equal(isOpenCallStatus(next), false);
    }
    assert.equal(closedStatusForBookedInquiry('ASSIGNED'), 'RESERVED');
    assert.equal(isOpenCallStatus('RESERVED'), false);
    assert.equal(closedStatusForBookedInquiry('CANCELLED'), null);
  });

  it('취소 로그가 있으면 닫기 전 상태를 읽고, dryRun 은 상태를 그대로 둔다', () => {
    const parsed = parseAutoCloseLog(JSON.stringify({ auto: true, from: 'ABSENT', to: 'FULFILLED', inquiryId: 'inq-1', reasons: ['phone'] }));
    assert.equal(parsed?.from, 'ABSENT');
    assert.equal(parseAutoCloseLog(JSON.stringify({ auto: false, from: 'ABSENT', to: 'FULFILLED' })), null);
    assert.equal(statusAfterSweep('ABSENT', 'FULFILLED', true), 'ABSENT');
    assert.equal(statusAfterSweep('ABSENT', 'FULFILLED', false), 'FULFILLED');
  });
});
