import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bookingRegionKey,
  buildInquiryBookingIndex,
  candidatesForFollowup,
  closedStatusForBookedInquiry,
  dawnSweepDryRun,
  isOpenCallStatus,
  matchFollowupToInquiry,
  parseAutoCloseLog,
  pickFollowupBooking,
  pickFollowupBookingNarrowed,
  reasonCombo,
  statusAfterSweep,
  tallySweep,
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

  it('지난 이용은 내리지 않고 past 로만 보여 주며, 앞으로의 접수가 있으면 그걸 쓴다', () => {
    const made = new Date('2026-11-25T01:00:00.000Z');
    const past = pickFollowupBooking(
      followup({ customerPhone: '010-1111-2222', createdAt: made, customerName: '다른사람', address: '' }),
      [inquiry({ customerPhone: '010-1111-2222', preferredDate: new Date('2026-11-01T03:00:00.000Z'), createdAt: new Date('2026-10-20T03:00:00.000Z') })],
    );
    assert.equal(past?.level, 'past');

    const finished = pickFollowupBooking(
      followup({ customerPhone: '010-1111-2222', createdAt: made, customerName: '다른사람', address: '' }),
      [inquiry({
        customerPhone: '010-1111-2222',
        status: 'COMPLETED',
        preferredDate: new Date('2026-12-01T03:00:00.000Z'),
        completedAt: new Date('2026-11-10T03:00:00.000Z'),
        createdAt: new Date('2026-11-01T03:00:00.000Z'),
      })],
    );
    assert.equal(finished?.level, 'past');

    const both = pickFollowupBooking(
      followup({ customerPhone: '010-1111-2222', createdAt: made, customerName: '다른사람', address: '' }),
      [
        inquiry({ id: 'old', customerPhone: '010-1111-2222', preferredDate: new Date('2026-11-01T03:00:00.000Z'), createdAt: new Date('2026-10-20T03:00:00.000Z') }),
        inquiry({ id: 'next', customerPhone: '010-1111-2222', preferredDate: new Date('2026-12-01T03:00:00.000Z'), createdAt: new Date('2026-11-24T03:00:00.000Z') }),
      ],
    );
    assert.equal(both?.level, 'booked');
    assert.equal(both?.inquiryId, 'next');
  });

  it('050 안심번호는 72시간 안에서만 전화 근거이고, 임시 번호·이름은 근거가 아니다', () => {
    const near = pickFollowupBooking(
      followup({
        customerPhone: '0504-1111-2222',
        customerName: '다른사람',
        address: '',
        areaPyeong: null,
        createdAt: new Date('2026-11-20T01:00:00.000Z'),
      }),
      [inquiry({
        customerPhone: '050411112222',
        customerName: '무관',
        address: '',
        createdAt: new Date('2026-11-21T01:00:00.000Z'),
      })],
    );
    assert.equal(near?.level, 'booked');
    assert.ok(near?.reasons.includes('phone'));

    const far = matchFollowupToInquiry(
      followup({
        customerPhone: '0504-1111-2222',
        customerName: '다른사람',
        address: '',
        areaPyeong: null,
        preferredMoveInCleaningDate: null,
        createdAt: new Date('2026-11-01T01:00:00.000Z'),
      }),
      inquiry({
        customerPhone: '050411112222',
        customerName: '무관',
        address: '',
        buildingType: null,
        createdAt: new Date('2026-11-20T01:00:00.000Z'),
      }),
    );
    assert.equal(far.level, null);
    assert.equal(far.reasons.includes('phone'), false);

    const farButSameHome = matchFollowupToInquiry(
      followup({ customerPhone: '0504-1111-2222', createdAt: new Date('2026-11-01T01:00:00.000Z') }),
      inquiry({ customerPhone: '050411112222', createdAt: new Date('2026-11-20T01:00:00.000Z') }),
    );
    assert.equal(farButSameHome.level, 'booked');
    assert.equal(farButSameHome.reasons.includes('phone'), false);
    assert.ok(farButSameHome.reasons.includes('name'));

    for (const phone of ['01000000000', '01012345678', '11111111111', '1234567']) {
      assert.equal(
        matchFollowupToInquiry(
          followup({ customerPhone: phone, customerName: '다른사람', address: '', areaPyeong: null, preferredMoveInCleaningDate: null }),
          inquiry({ customerPhone: phone, customerName: '무관', address: '', buildingType: null }),
        ).level,
        null,
      );
    }

    assert.equal(
      matchFollowupToInquiry(
        followup({ customerName: '고객', nickname: null, customerPhone: '010-9999-8888', address: '', areaPyeong: null, preferredMoveInCleaningDate: null }),
        inquiry({ customerName: '고객님', nickname: null, customerPhone: '010-7777-6666', address: '', buildingType: null }),
      ).level,
      null,
    );
    assert.equal(
      matchFollowupToInquiry(
        followup({ customerName: '네이버', nickname: null, leadSource: '네이버', customerPhone: '010-9999-8888', address: '', areaPyeong: null, preferredMoveInCleaningDate: null }),
        inquiry({ customerName: '네이버', nickname: null, source: '네이버', customerPhone: '010-7777-6666', address: '', buildingType: null }),
      ).level,
      null,
    );
    assert.equal(
      matchFollowupToInquiry(
        followup({ customerName: '김', nickname: '12', customerPhone: '010-9999-8888', address: '', areaPyeong: null, preferredMoveInCleaningDate: null }),
        inquiry({ customerName: '김', nickname: '12', customerPhone: '010-7777-6666', address: '', buildingType: null }),
      ).level,
      null,
    );
  });

  it('새벽 작업은 닫지 않고, dryRun 응답은 건수만 담는다', () => {
    assert.equal(dawnSweepDryRun(), true);
    assert.equal(statusAfterSweep('ABSENT', 'FULFILLED', dawnSweepDryRun()), 'ABSENT');
    const plan = tallySweep([
      {
        booking: {
          level: 'booked',
          reasons: ['name', 'address', 'structure'],
          inquiryId: 'inq-1',
          inquiryNumber: null,
          status: 'RECEIVED',
          preferredDate: null,
          operatingCompanyId: 'brand-a',
          operatingCompanyName: null,
          marketerName: null,
        },
        open: true,
        sameBrandBooked: true,
        followupStatus: 'ABSENT',
      },
      {
        booking: {
          level: 'past',
          reasons: ['phone'],
          inquiryId: 'inq-2',
          inquiryNumber: null,
          status: 'COMPLETED',
          preferredDate: null,
          operatingCompanyId: 'brand-a',
          operatingCompanyName: null,
          marketerName: null,
        },
        open: true,
        sameBrandBooked: false,
        followupStatus: 'ON_HOLD',
      },
    ]);
    assert.equal(plan.wouldClose, 1);
    assert.equal(plan.past, 1);
    assert.equal(plan.byInquiryStatus.RECEIVED, 1);
    assert.equal(plan.byFollowupStatus.ABSENT, 1);
    assert.equal(plan.byReasonCombo['name+address+structure'], 1);
    assert.equal(plan.conflictDowngraded, 0);
    assert.equal(JSON.stringify(plan).includes('홍길동'), false);
  });

  it('전화·연결 없이 구조가 어긋나면 예약으로 올리지 않는다', () => {
    const made = new Date('2026-11-20T01:00:00.000Z');
    const near = new Date('2026-11-10T01:00:00.000Z');
    const road = {
      customerPhone: '010-8888-2222',
      address: '서울특별시 강남구 테헤란로 152',
      buildingType: null as string | null,
      memo: '',
      createdAt: near,
      preferredDate: new Date('2026-11-20T03:00:00.000Z'),
    };
    const jibun = {
      customerPhone: '010-9999-1111',
      address: '서울특별시 강남구 역삼동 123-4',
      memo: '',
      createdAt: made,
      preferredMoveInCleaningDate: '2026-11-20',
    };

    const pyeong = pickFollowupBooking(
      followup({ ...jibun, areaPyeong: 22, roomCount: 2, bathroomCount: 1 }),
      [inquiry({ ...road, areaPyeong: 12, roomCount: 2, bathroomCount: 1 })],
    );
    assert.equal(pyeong?.level, 'suspect');
    assert.ok(pyeong?.reasons.includes('name') && pyeong?.reasons.includes('date') && pyeong?.reasons.includes('region'));
    assert.deepEqual(pyeong?.conflict, ['pyeong']);

    const missing = pickFollowupBooking(
      followup({ ...jibun, areaPyeong: null, roomCount: 2, bathroomCount: 1 }),
      [inquiry({ ...road, areaPyeong: 12, roomCount: 2, bathroomCount: 1 })],
    );
    assert.equal(missing?.level, 'booked');
    assert.equal(missing?.conflict, undefined);

    const phone = pickFollowupBooking(
      followup({ ...jibun, customerPhone: '010-1111-2222', areaPyeong: 22, roomCount: 2, bathroomCount: 1 }),
      [inquiry({ ...road, customerPhone: '010-1111-2222', areaPyeong: 12, roomCount: 2, bathroomCount: 1 })],
    );
    assert.equal(phone?.level, 'booked');
    assert.equal(phone?.conflict, undefined);

    const rooms = pickFollowupBooking(
      followup({ ...jibun, areaPyeong: 22, roomCount: 2, bathroomCount: 1 }),
      [inquiry({ ...road, areaPyeong: 22, roomCount: 1, bathroomCount: 1 })],
    );
    assert.equal(rooms?.level, 'suspect');
    assert.deepEqual(rooms?.conflict, ['rooms']);

    const plan = tallySweep([
      { booking: pyeong, open: true, sameBrandBooked: false, followupStatus: 'ABSENT' },
    ]);
    assert.equal(plan.conflictDowngraded, 1);
    assert.equal(plan.suspect, 1);
    assert.equal(plan.wouldClose, 0);
  });

  it('지번과 도로명에서 같은 시·군·구를 뽑고, 이름·희망일·30일 안이면 예약으로 본다', () => {
    assert.equal(bookingRegionKey('서울특별시 강남구 역삼동 123-4'), bookingRegionKey('서울특별시 강남구 테헤란로 152'));
    assert.equal(bookingRegionKey('서울 강남구 역삼동'), '서울특별시|강남구');
    assert.equal(bookingRegionKey('경기도 이천시 창전동 123'), bookingRegionKey('경기도 이천시 경충대로 1914'));
    assert.equal(bookingRegionKey('경기도 성남시 분당구 정자동'), bookingRegionKey('경기도 성남시 분당구 판교로 200'));
    assert.notEqual(bookingRegionKey('경기도 성남시 분당구 판교로'), bookingRegionKey('경기도 성남시 수정구 수정로'));
    assert.equal(bookingRegionKey('부산광역시 해운대구 우동 12'), bookingRegionKey('부산광역시 해운대구 해운대로 100'));
    assert.notEqual(bookingRegionKey('부산광역시 해운대구 해운대로'), bookingRegionKey('부산광역시 수영구 광안로'));
    assert.equal(bookingRegionKey('강원특별자치도 홍천군 홍천읍 희망리'), bookingRegionKey('강원특별자치도 홍천군 홍천로 1'));
    assert.equal(bookingRegionKey('경기도 가평군 가평읍'), bookingRegionKey('경기도 가평군 가평대로 50'));
    assert.equal(bookingRegionKey(''), null);
    assert.equal(bookingRegionKey('테헤란로 152'), null);

    const made = new Date('2026-11-20T01:00:00.000Z');
    const near = new Date('2026-11-01T01:00:00.000Z');
    const far = new Date(made.getTime() - 31 * 24 * 60 * 60 * 1000);
    const exactly = new Date(made.getTime() - 30 * 24 * 60 * 60 * 1000);

    const byStructure = matchFollowupToInquiry(
      followup({
        customerPhone: '010-9999-1111',
        address: '',
        areaPyeong: 24,
        createdAt: made,
        preferredMoveInCleaningDate: '2026-11-20',
      }),
      inquiry({
        customerPhone: '010-8888-2222',
        address: '',
        buildingType: null,
        createdAt: near,
        preferredDate: new Date('2026-11-20T03:00:00.000Z'),
      }),
    );
    assert.equal(byStructure.level, 'booked');
    assert.ok(byStructure.reasons.includes('name') && byStructure.reasons.includes('date') && byStructure.reasons.includes('structure'));
    assert.equal(byStructure.reasons.includes('region'), false);

    const byRegion = matchFollowupToInquiry(
      followup({
        customerPhone: '010-9999-1111',
        address: '서울특별시 강남구 역삼동 123-4',
        areaPyeong: null,
        memo: '',
        createdAt: made,
        preferredMoveInCleaningDate: '2026-11-20',
      }),
      inquiry({
        customerPhone: '010-8888-2222',
        address: '서울특별시 강남구 테헤란로 152',
        buildingType: null,
        memo: '',
        areaPyeong: null,
        createdAt: exactly,
        preferredDate: new Date('2026-11-20T03:00:00.000Z'),
      }),
    );
    assert.equal(byRegion.level, 'booked');
    assert.ok(byRegion.reasons.includes('region'));
    assert.equal(byRegion.reasons.includes('address'), false);
    assert.equal(reasonCombo(byRegion.reasons).includes('region'), true);

    const nameDateOnly = matchFollowupToInquiry(
      followup({
        customerPhone: '010-9999-1111',
        address: '',
        areaPyeong: null,
        createdAt: made,
        preferredMoveInCleaningDate: '2026-11-20',
      }),
      inquiry({
        customerPhone: '010-8888-2222',
        address: '',
        buildingType: null,
        areaPyeong: null,
        createdAt: near,
        preferredDate: new Date('2026-11-20T03:00:00.000Z'),
      }),
    );
    assert.equal(nameDateOnly.level, 'suspect');
    assert.equal(nameDateOnly.reasons.includes('region'), false);

    const tooFar = matchFollowupToInquiry(
      followup({
        customerPhone: '010-9999-1111',
        address: '서울특별시 강남구 역삼동 123-4',
        areaPyeong: null,
        memo: '',
        createdAt: made,
        preferredMoveInCleaningDate: '2026-11-20',
      }),
      inquiry({
        customerPhone: '010-8888-2222',
        address: '서울특별시 강남구 테헤란로 152',
        buildingType: null,
        memo: '',
        areaPyeong: null,
        createdAt: far,
        preferredDate: new Date('2026-11-20T03:00:00.000Z'),
      }),
    );
    assert.equal(tooFar.level, 'suspect');
    assert.ok(tooFar.reasons.includes('region'));

    const otherCity = matchFollowupToInquiry(
      followup({
        customerPhone: '010-9999-1111',
        address: '서울특별시 강남구 역삼동 1',
        areaPyeong: null,
        memo: '',
        createdAt: made,
        preferredMoveInCleaningDate: '2026-11-20',
      }),
      inquiry({
        customerPhone: '010-8888-2222',
        address: '부산광역시 해운대구 해운대로 100',
        buildingType: null,
        memo: '',
        areaPyeong: null,
        createdAt: made,
        preferredDate: new Date('2026-12-02T03:00:00.000Z'),
      }),
    );
    assert.equal(otherCity.level, null);

    const sameDong = matchFollowupToInquiry(
      followup({ customerPhone: '010-9999-1111', areaPyeong: null, preferredMoveInCleaningDate: null, memo: '' }),
      inquiry({ customerPhone: '010-8888-2222', buildingType: null, memo: '' }),
    );
    assert.ok(sameDong.reasons.includes('address') && sameDong.reasons.includes('region'));

    const roadInquiry = inquiry({
      id: 'inq-road',
      customerPhone: '010-7777-6666',
      address: '서울특별시 강남구 테헤란로 152',
      buildingType: null,
      memo: '',
      areaPyeong: null,
      createdAt: exactly,
      preferredDate: new Date('2026-11-20T03:00:00.000Z'),
    });
    const jibunFollowup = followup({
      customerPhone: '010-9999-1111',
      address: '서울특별시 강남구 역삼동 123-4',
      areaPyeong: null,
      memo: '',
      createdAt: made,
      preferredMoveInCleaningDate: '2026-11-20',
    });
    const index = buildInquiryBookingIndex([roadInquiry]);
    assert.ok(candidatesForFollowup(index, jibunFollowup).some((row) => row.id === 'inq-road'));
    assert.equal(pickFollowupBookingNarrowed(jibunFollowup, index)?.level, 'booked');
    assert.equal(pickFollowupBooking(jibunFollowup, [roadInquiry])?.inquiryId, pickFollowupBookingNarrowed(jibunFollowup, index)?.inquiryId);

    const plan = tallySweep([
      {
        booking: {
          level: 'booked',
          reasons: byRegion.reasons,
          inquiryId: 'inq-1',
          inquiryNumber: null,
          status: 'RECEIVED',
          preferredDate: '2026-11-20',
          operatingCompanyId: 'brand-a',
          operatingCompanyName: null,
          marketerName: null,
        },
        open: true,
        sameBrandBooked: true,
        followupStatus: 'ABSENT',
      },
    ]);
    assert.equal(plan.byReason.region, 1);
    assert.equal(plan.byReasonCombo[reasonCombo(byRegion.reasons)], 1);
  });

  it('후보만 대조해도 전체를 대조한 것과 같다', () => {
    const inquiries: InquiryMatchInput[] = [];
    const followups: FollowupMatchInput[] = [];
    const names = ['홍길동', '김영희', '고객', '박철수', '이숨고'];
    const dongs = ['역삼동', '잠실동', '합정동'];
    for (let i = 0; i < 500; i += 1) {
      const phone = `010${String(10000000 + ((i * 97) % 90000000)).slice(0, 8)}`;
      inquiries.push(
        inquiry({
          id: `inq-${i}`,
          customerName: names[i % names.length]!,
          nickname: i % 11 === 0 ? '길동맘' : null,
          customerPhone: phone,
          customerPhone2: i % 17 === 0 ? `0504${String(10000000 + i).slice(0, 8)}` : null,
          address:
            i % 4 === 0
              ? `서울특별시 강남구 테헤란로 ${100 + i}`
              : `서울특별시 강남구 ${dongs[i % dongs.length]} 래미안아파트 ${i}동`,
          areaPyeong: 20 + (i % 8),
          preferredDate: new Date(Date.UTC(2026, 10, 1 + (i % 27), 3)),
          createdAt: new Date(Date.UTC(2026, 9, 1 + (i % 28), 3)),
          status: i % 19 === 0 ? 'COMPLETED' : 'RECEIVED',
          completedAt: i % 19 === 0 ? new Date(Date.UTC(2026, 9, 5, 3)) : null,
          source: i % 13 === 0 ? '숨고' : '전화',
          operatingCompanyId: i % 5 === 0 ? 'brand-b' : 'brand-a',
        }),
      );
    }
    for (let i = 0; i < 500; i += 1) {
      const linked = i % 23 === 0 ? inquiries[i % 500]! : null;
      followups.push(
        followup({
          inquiryId: linked?.id ?? null,
          customerName: i % 3 === 0 ? inquiries[i % 500]!.customerName : names[(i + 2) % names.length]!,
          nickname: i % 29 === 0 ? '길동맘' : null,
          customerPhone: i % 4 === 0 ? inquiries[i % 500]!.customerPhone : `010${String(20000000 + i).padStart(8, '0')}`,
          customerPhone2: i % 31 === 0 ? inquiries[(i + 3) % 500]!.customerPhone2 : null,
          address:
            i % 6 === 0 ? inquiries[i % 500]!.address : i % 6 === 1 ? '서울특별시 강남구 역삼동 10-2' : `부산광역시 해운대구 우동 ${i}`,
          areaPyeong: i % 7 === 0 ? inquiries[i % 500]!.areaPyeong : 30,
          preferredMoveInCleaningDate: i % 8 === 0 ? '2026-11-20' : '2026-12-02',
          createdAt: new Date(Date.UTC(2026, 10, 20, 1)),
          leadSource: i % 9 === 0 ? '숨고' : null,
          operatingCompanyId: 'brand-a',
        }),
      );
    }
    const index = buildInquiryBookingIndex(inquiries);
    for (const row of followups) {
      const full = pickFollowupBooking(row, inquiries);
      const narrow = pickFollowupBookingNarrowed(row, index);
      assert.equal(narrow?.level ?? null, full?.level ?? null);
      assert.equal(narrow?.inquiryId ?? null, full?.inquiryId ?? null);
      assert.deepEqual(narrow?.reasons ?? [], full?.reasons ?? []);
    }
  });
});
