import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyAiQuote, structKeyOfClassified, typeGroupOf } from './telecrmAiQuoteClassify.js';
import { listBaseDriftItems, resolveAiQuoteCore, skAiQuoteBaseRows } from './telecrmAiQuoteBase.js';
import { pickSentBaseCleaningWon } from './telecrmAiQuoteBaseLine.js';

const ROWS = skAiQuoteBaseRows();

function quote(input: {
  label?: string | null;
  isOneRoom?: boolean;
  rooms?: number | null;
  baths?: number | null;
  balconies?: number | null;
  pyeong: number;
  corrections?: { amountWon: number; at: number }[];
  group?: { count: number; median: number } | null;
  groupLabel?: string | null;
  pyeongCurveWon?: number | null;
}) {
  const classified = classifyAiQuote({
    propertyTypeLabel: input.label,
    isOneRoom: input.isOneRoom,
    roomCount: input.rooms,
    bathroomCount: input.baths,
    balconyCount: input.balconies,
    areaPyeong: input.pyeong,
  });
  return resolveAiQuoteCore({
    classified,
    propertyLabel: input.label,
    baseRows: ROWS,
    corrections: input.corrections,
    group: input.group,
    groupLabel: input.groupLabel,
    pyeongCurveWon: input.pyeongCurveWon,
  });
}

describe('유형·구조 판정', () => {
  it('오피스텔·원룸·1.5룸은 소형, 아파트는 일반', () => {
    assert.equal(typeGroupOf('오피스텔'), 'small');
    assert.equal(typeGroupOf('원룸'), 'small');
    assert.equal(typeGroupOf('1.5룸'), 'small');
    assert.equal(typeGroupOf('아파트'), 'general');
    assert.equal(typeGroupOf('빌라'), 'general');
    assert.equal(typeGroupOf(''), null);
  });

  it('방1 이하면 원룸 계열이고 평수 소수점은 버린다', () => {
    const row = classifyAiQuote({
      propertyTypeLabel: '오피스텔',
      isOneRoom: false,
      roomCount: 1,
      bathroomCount: 1,
      balconyCount: 1,
      areaPyeong: 19.9,
    });
    assert.equal(row.isOneRoomLike, true);
    assert.equal(row.pyeong, 19);
    assert.equal(row.typeGroup, 'small');
    assert.equal(structKeyOfClassified(row), 'small|oneroom');
  });
});

describe('기준표', () => {
  it('19평 오피스텔 방1·화1·베1은 15만', () => {
    const hit = quote({ label: '오피스텔', rooms: 1, baths: 1, balconies: 1, pyeong: 19 });
    assert.equal(hit?.amountWon, 150000);
    assert.equal(hit?.label, '오피스텔·20평 이하 → 15만 고정 (기준표)');
  });

  it('원룸 표시가 꺼져 있어도 방1이면 15만, 21평 오피스텔은 21만', () => {
    assert.equal(quote({ label: '오피스텔', isOneRoom: false, rooms: 1, baths: 1, balconies: 1, pyeong: 19 })?.amountWon, 150000);
    assert.equal(quote({ label: '오피스텔', rooms: 1, pyeong: 21 })?.amountWon, 210000);
  });

  it('아파트 소형은 20만, 방2 23평은 23만', () => {
    assert.equal(quote({ label: '아파트', rooms: 1, baths: 1, pyeong: 19 })?.amountWon, 200000);
    assert.equal(quote({ label: '아파트', rooms: 2, baths: 1, balconies: 1, pyeong: 22 })?.amountWon, 200000);
    assert.equal(quote({ label: '아파트', rooms: 2, pyeong: 23 })?.amountWon, 230000);
  });

  it('방3 줄은 평수와 화장실·베란다에 따라 갈린다', () => {
    assert.equal(quote({ label: '아파트', rooms: 3, baths: 1, balconies: 1, pyeong: 24 })?.amountWon, 240000);
    assert.equal(quote({ label: '아파트', rooms: 3, baths: 1, balconies: 1, pyeong: 25 })?.amountWon, 250000);
    assert.equal(quote({ label: '아파트', rooms: 3, baths: 2, balconies: 2, pyeong: 25 })?.amountWon, 250000);
    assert.equal(quote({ label: '아파트', rooms: 3, baths: 2, pyeong: 33 })?.amountWon, 330000);
  });

  it('평수만 있으면 기준표를 쓰지 않고 학습값을 쓴다', () => {
    const hit = quote({
      pyeong: 19,
      group: { count: 4, median: 180000 },
      pyeongCurveWon: 220000,
    });
    assert.equal(hit?.source, 'pyeong');
    assert.equal(hit?.amountWon, 220000);
    assert.match(hit?.label ?? '', /19평 평수 기준/);
  });

  it('같은 구조 예약이 5건 이상이면 가운데 금액', () => {
    const hit = quote({
      pyeong: 20,
      group: { count: 12, median: 210000 },
      groupLabel: '일반·방2·화2',
      pyeongCurveWon: 220000,
    });
    assert.equal(hit?.amountWon, 210000);
    assert.equal(hit?.label, '일반·방2·화2 예약 12건 가운데 금액');
  });

  it('기준표에 없는 방2·화2 20평은 상담사가 보낸 21만', () => {
    const hit = quote({
      label: '아파트',
      rooms: 2,
      baths: 2,
      pyeong: 20,
      corrections: [{ amountWon: 210000, at: Date.now() }],
      pyeongCurveWon: 180000,
    });
    assert.equal(hit?.source, 'counselor');
    assert.equal(hit?.amountWon, 210000);
    assert.match(hit?.label ?? '', /상담사 견적 반영/);
  });

  it('기준표 1번에서 17만을 세 번 보내도 AI는 15만, 확인 목록은 1건', () => {
    const hit = quote({
      label: '오피스텔',
      rooms: 1,
      baths: 1,
      balconies: 1,
      pyeong: 19,
      corrections: [
        { amountWon: 170000, at: Date.now() },
        { amountWon: 170000, at: Date.now() },
        { amountWon: 170000, at: Date.now() },
      ],
    });
    assert.equal(hit?.amountWon, 150000);
    assert.equal(hit?.source, 'base');
    const now = new Date('2026-11-23T00:00:00.000Z');
    const items = listBaseDriftItems({
      now,
      records: [1, 2, 3].map((n) => ({
        baseRowId: 'row-1',
        label: '20평 이하 → 15만 고정',
        tableAmountWon: 150000,
        sentAmountWon: 170000,
        at: new Date(now.getTime() - n * 86400000).toISOString(),
      })),
    });
    assert.equal(items.length, 1);
    assert.equal(items[0].count, 3);
    assert.equal(items[0].sentAmountWon, 170000);
    assert.equal(items[0].tableAmountWon, 150000);
  });
});

describe('기본청소 줄', () => {
  it('추가시공·할인이 섞여 있어도 기본청소 금액만 고른다', () => {
    const won = pickSentBaseCleaningWon({
      pyeong: 19,
      baseEstimateWon: 990000,
      grandTotalWon: 170000,
      lines: [
        { label: '추가시공 줄눈', amountWon: 30000, quantity: 1 },
        { label: '할인', amountWon: -10000 },
        { label: '기본청소', amountWon: 150000, quantity: 1 },
      ],
    });
    assert.equal(won, 150000);
  });

  it('기본 줄이 없고 기본견적 금액도 없으면 null', () => {
    assert.equal(pickSentBaseCleaningWon({ lines: [{ label: '추가시공', amountWon: 30000 }] }), null);
  });
});
