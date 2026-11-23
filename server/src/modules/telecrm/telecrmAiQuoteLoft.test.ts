import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { judgeTelecrmAiQuoteLoft, loftSurchargeForQuote } from './telecrmAiQuoteLoft.js';
import { pickSentBaseCleaningWon } from './telecrmAiQuoteBaseLine.js';

describe('복층 판정', () => {
  it('체크가 켜지면 복층', () => {
    const row = judgeTelecrmAiQuoteLoft({ oneRoomLoft: true, text: '복층 아님' });
    assert.equal(row.isLoft, true);
    assert.equal(row.source, 'check');
  });

  it('체크가 꺼지면 메모에 복층이 있어도 복층 아님', () => {
    const row = judgeTelecrmAiQuoteLoft({ oneRoomLoft: false, text: '복층 있어요' });
    assert.equal(row.isLoft, false);
    assert.equal(row.source, 'check');
  });

  it('체크가 없으면 메모의 복층을 본다', () => {
    const row = judgeTelecrmAiQuoteLoft({ oneRoomLoft: null, text: '고객요청: 복층이에요' });
    assert.equal(row.isLoft, true);
    assert.equal(row.source, 'memo');
    assert.equal(row.matchedText, '복층');
  });

  it('부정하는 말이면 복층 아님', () => {
    for (const text of ['복층 아님', '복층 아니에요', '복층X', '복층 x', '복층 없음', '복층은 아니에요', '단층입니다']) {
      const row = judgeTelecrmAiQuoteLoft({ oneRoomLoft: null, text });
      assert.equal(row.isLoft, false, text);
      assert.equal(row.source, 'memo');
    }
  });
});

describe('복층 추가금', () => {
  it('체크면 기본 금액에 3만을 더하는 줄만 만든다', () => {
    const hit = loftSurchargeForQuote(judgeTelecrmAiQuoteLoft({ oneRoomLoft: true }), 30000);
    assert.equal(hit.addWon, 30000);
    assert.equal(hit.label, '복층 체크 → +3만 원');
    assert.equal(hit.loft.applied, true);
  });

  it('메모만 있어도 같은 추가금', () => {
    const hit = loftSurchargeForQuote(
      judgeTelecrmAiQuoteLoft({ oneRoomLoft: null, text: '숨고 요청에 복층' }),
      30000,
    );
    assert.equal(hit.addWon, 30000);
    assert.equal(hit.label, '메모에 복층 → +3만 원');
  });

  it('부정 표현이나 설정 0이면 더하지 않는다', () => {
    const negative = loftSurchargeForQuote(
      judgeTelecrmAiQuoteLoft({ oneRoomLoft: null, text: '복층 아님' }),
      30000,
    );
    assert.equal(negative.addWon, 0);
    assert.equal(negative.loft.applied, false);
    const off = loftSurchargeForQuote(judgeTelecrmAiQuoteLoft({ oneRoomLoft: true }), 0);
    assert.equal(off.addWon, 0);
    assert.equal(off.loft.applied, false);
  });
});

describe('보낸 견적의 기본 금액', () => {
  it('복층 줄은 기본청소 금액에 섞지 않는다', () => {
    const won = pickSentBaseCleaningWon({
      pyeong: 19,
      baseEstimateWon: 150000,
      lines: [{ label: '복층', amountWon: 30000 }],
    });
    assert.equal(won, 150000);
  });
});
