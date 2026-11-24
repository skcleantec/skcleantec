import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addressShort,
  attachLinkedSummaries,
  bankDepositFeatureStatus,
  displayWon,
  followupCard,
  groupDepositsByInquiry,
  phoneTail,
  preferredDateYmd,
  rowMatchesSearch,
  searchParts,
} from './bankDepositView.js';
import { sameTenant } from './bankDepositGuard.js';

describe('후보 표시', () => {
  it('전화는 끝 4자리, 주소는 30자, 날짜는 KST 하루다', () => {
    assert.equal(phoneTail('010-1234-5678'), '5678');
    assert.equal(phoneTail('12'), null);
    assert.equal(addressShort(`서울시 ${'가'.repeat(40)}`), `서울시 ${'가'.repeat(26)}`);
    assert.equal(preferredDateYmd(new Date('2026-11-23T15:30:00.000Z')), '2026-11-24');
    assert.equal(displayWon(null, 80000), 80000);
    assert.equal(displayWon(20000, 80000), 20000);
  });

  it('부재·보류 후보는 금액이 비어 있다', () => {
    const card = followupCard({
      customerName: '고객',
      nickname: null,
      phones: ['010-0000-1111'],
      preferredDate: '2026-11-24',
      address: '서울시 강남구',
      status: 'DEPOSIT_PENDING',
      inquiryNumber: null,
      linkedKinds: [],
    });
    assert.equal(card.depositWon, null);
    assert.equal(card.balanceWon, null);
    assert.equal(card.totalWon, null);
    assert.equal(card.phoneTail, '1111');
    assert.equal(card.status, 'DEPOSIT_PENDING');
  });
});

describe('목록 연결과 검색', () => {
  it('연결 대상과 연결한 사람 이름을 붙인다', () => {
    const [item] = attachLinkedSummaries(
      [{ id: 'd1', linkedInquiryId: 'inq-1', linkedFollowupId: null, linkedByUserId: 'user-1' }],
      {
        inquiries: new Map([
          ['inq-1', { id: 'inq-1', customerName: '고객', nickname: null, preferredDate: '2026-11-24', status: 'DEPOSIT_PENDING', inquiryNumber: 'A-1' }],
        ]),
        followups: new Map(),
        users: new Map([['user-1', '직원']]),
      },
    );
    assert.equal(item.linked?.target, 'inquiry');
    assert.equal(item.linked?.inquiryNumber, 'A-1');
    assert.equal(item.linkedByName, '직원');
    assert.equal('linkedByUserId' in item, false);
  });

  it('이름·전화 끝자리로 찾고, 다른 브랜드는 빼며, 다른 업체는 막는다', () => {
    const row = { customerName: '김고객', nickname: '별명', phones: ['010-5555-1212'], operatingCompanyId: 'brand-a' };
    assert.equal(rowMatchesSearch(row, searchParts('김고'), 'brand-a'), true);
    assert.equal(rowMatchesSearch(row, searchParts('1212'), 'brand-a'), true);
    assert.equal(rowMatchesSearch(row, searchParts('1212'), 'brand-b'), false);
    assert.equal(rowMatchesSearch(row, searchParts('9999'), 'brand-a'), false);
    assert.equal(searchParts('').text, '');
    assert.equal(sameTenant('tenant-a', 'tenant-b'), false);
  });

  it('여러 접수의 연결된 입금만 묶는다', () => {
    const grouped = groupDepositsByInquiry([
      { id: 'd1', linkedInquiryId: 'inq-1', linkedKind: 'DEPOSIT', amountWon: 20000, depositedAt: new Date('2026-11-24T00:04:00.000Z'), depositorName: '고객' },
      { id: 'd2', linkedInquiryId: null, linkedKind: null, amountWon: 1000, depositedAt: new Date('2026-11-24T00:04:00.000Z'), depositorName: '다른' },
    ]);
    assert.equal(grouped.byInquiry['inq-1']?.[0]?.kind, 'DEPOSIT');
    assert.equal(grouped.byInquiry['inq-2'], undefined);
  });
});

describe('기능 켜짐', () => {
  it('꺼진 업체는 403이다', () => {
    assert.equal(bankDepositFeatureStatus(false), 403);
    assert.equal(bankDepositFeatureStatus(true), null);
  });
});
