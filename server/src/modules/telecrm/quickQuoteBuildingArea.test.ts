import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatQuickQuoteAreaLine,
  formatQuickQuoteUnitLine,
  normUnit,
  presentExposAreas,
  summarizeExposAreas,
  UNIT_MISS_NOTE,
} from './quickQuoteBuildingArea.js';

const apt = { mainPurpsCdNm: '아파트' };

test('주거 전유만 모으고 주차·지하·관리 공용은 뺀 뒤 0.5㎡ 안으로 묶는다', () => {
  const summary = summarizeExposAreas([
    { exposPubuseGbCd: '1', area: '84.93', dongNm: '101', hoNm: '101', ...apt },
    { exposPubuseGbCd: '2', area: '27.4', dongNm: '101', hoNm: '101', mainPurpsCdNm: '복도' },
    { exposPubuseGbCd: '2', area: '30', dongNm: '101', hoNm: '101', mainPurpsCdNm: '주차장' },
    { exposPubuseGbCd: '2', area: '12', dongNm: '101', hoNm: '101', flrGbCd: '10', mainPurpsCdNm: '계단' },
    { exposPubuseGbCd: '2', area: '8', dongNm: '101', hoNm: '101', mainPurpsCdNm: '관리사무소' },
    { exposPubuseGbCd: '1', area: '84.7', dongNm: '101', hoNm: '102', ...apt },
    { exposPubuseGbCd: '2', area: '27.6', dongNm: '101', hoNm: '102', etcPurps: '복도' },
    { exposPubuseGbCd: '1', area: '84.9', dongNm: '102', hoNm: '201', mainPurpsCdNm: '근린생활시설' },
    { exposPubuseGbCd: '1', area: '40', dongNm: '103', hoNm: '101', mainPurpsCdNm: '업무시설' },
  ]);
  assert.equal(summary.kind, 'groups');
  if (summary.kind !== 'groups') return;
  assert.equal(summary.groups.length, 1);
  const group = summary.groups[0]!;
  assert.equal(group.exclusiveSqm, 84.7);
  assert.equal(group.households, 2);
  assert.equal(group.supplyUnconfirmed, false);
  assert.ok(group.supplySqm != null && group.supplySqm > 100 && group.supplySqm < 120);
});

test('공급 비율이 1.6을 넘으면 확인 필요로 두고 세대 수만 센다', () => {
  const rows = [
    { exposPubuseGbCd: '1', area: '59.9', dongNm: '101', hoNm: '1', ...apt },
    { exposPubuseGbCd: '2', area: '20', dongNm: '101', hoNm: '1', mainPurpsCdNm: '복도' },
    { exposPubuseGbCd: '1', area: '59.8', dongNm: '101', hoNm: '2', ...apt },
    { exposPubuseGbCd: '2', area: '80', dongNm: '101', hoNm: '2', mainPurpsCdNm: '복도' },
  ];
  const summary = summarizeExposAreas(rows);
  assert.equal(summary.kind, 'groups');
  if (summary.kind !== 'groups') return;
  assert.equal(summary.groups[0]?.households, 2);
  assert.equal(summary.groups[0]?.supplyUnconfirmed, false);
  assert.equal(summary.groups[0]?.supplyPyeong, Math.round(((59.9 + 20) / 3.305785) * 10) / 10);
});

test('전용면적 오름차순이고 0.5㎡보다 멀면 다른 평형이다', () => {
  const summary = summarizeExposAreas([
    { exposPubuseGbCd: '1', area: '84.9', dongNm: '1', hoNm: '1', ...apt },
    { exposPubuseGbCd: '2', area: '27', dongNm: '1', hoNm: '1', mainPurpsCdNm: '계단' },
    { exposPubuseGbCd: '1', area: '59.9', dongNm: '1', hoNm: '2', ...apt },
    { exposPubuseGbCd: '2', area: '19', dongNm: '1', hoNm: '2', mainPurpsCdNm: '계단' },
    { exposPubuseGbCd: '1', area: '85.5', dongNm: '1', hoNm: '3', ...apt },
    { exposPubuseGbCd: '2', area: '28', dongNm: '1', hoNm: '3', mainPurpsCdNm: '계단' },
  ]);
  assert.equal(summary.kind, 'groups');
  if (summary.kind !== 'groups') return;
  assert.deepEqual(
    summary.groups.map((group) => group.exclusiveSqm),
    [59.9, 84.9, 85.5],
  );
  assert.equal(summary.groups[0]?.households, 1);
});

test('같은 평형 공급은 가장 흔한 평이다', () => {
  const rows = [];
  for (let i = 0; i < 3; i += 1) {
    rows.push(
      { exposPubuseGbCd: '1', area: '84.9', dongNm: '101', hoNm: String(i), ...apt },
      { exposPubuseGbCd: '2', area: '27.5', dongNm: '101', hoNm: String(i), mainPurpsCdNm: '복도' },
    );
  }
  rows.push(
    { exposPubuseGbCd: '1', area: '84.8', dongNm: '101', hoNm: '9', ...apt },
    { exposPubuseGbCd: '2', area: '40', dongNm: '101', hoNm: '9', mainPurpsCdNm: '복도' },
  );
  const summary = summarizeExposAreas(rows);
  assert.equal(summary.kind, 'groups');
  if (summary.kind !== 'groups') return;
  assert.equal(summary.groups.length, 1);
  assert.equal(summary.groups[0]?.households, 4);
  assert.equal(summary.groups[0]?.supplyPyeong, Math.round((112.4 / 3.305785) * 10) / 10);
});

test('제107동과 107동, 3101호와 3101은 같은 집이다', () => {
  assert.equal(normUnit('제107동'), normUnit('107동'));
  assert.equal(normUnit('107동'), normUnit('107'));
  assert.equal(normUnit('3101호'), normUnit('3101'));
  assert.equal(normUnit('A-1동'), normUnit('a1'));
  assert.equal(normUnit(' 0107 '), '107');
  const summary = presentExposAreas(
    [
      { exposPubuseGbCd: '1', area: '84.9', dongNm: '제107동', hoNm: '3101호', ...apt },
      { exposPubuseGbCd: '2', area: '33.45', dongNm: '제107동', hoNm: '3101호', mainPurpsCdNm: '계단' },
      { exposPubuseGbCd: '1', area: '59.9', dongNm: '제108동', hoNm: '3101호', ...apt },
    ],
    { dongNm: '107동', hoNm: '3101' },
  );
  assert.equal(summary.kind, 'unit');
  if (summary.kind !== 'unit') return;
  assert.equal(summary.line, '107동 3101호 · 전용 84.9㎡ · 공급 35.8평');
  assert.equal(formatQuickQuoteUnitLine('107동', '3101', summary), summary.line);
});

test('동만 고르면 그 동 평형만 남긴다', () => {
  const summary = presentExposAreas(
    [
      { exposPubuseGbCd: '1', area: '84.9', dongNm: '제107동', hoNm: '3101호', ...apt },
      { exposPubuseGbCd: '2', area: '33.45', dongNm: '제107동', hoNm: '3101호', mainPurpsCdNm: '계단' },
      { exposPubuseGbCd: '1', area: '59.9', dongNm: '제108동', hoNm: '101호', ...apt },
      { exposPubuseGbCd: '2', area: '20', dongNm: '제108동', hoNm: '101호', mainPurpsCdNm: '계단' },
    ],
    { dongNm: '107' },
  );
  assert.equal(summary.kind, 'groups');
  if (summary.kind !== 'groups') return;
  assert.equal(summary.note, undefined);
  assert.equal(summary.groups.length, 1);
  assert.equal(summary.groups[0]?.exclusiveSqm, 84.9);
});

test('없는 호수는 단지 전체 평형을 그대로 보여 준다', () => {
  const summary = presentExposAreas(
    [
      { exposPubuseGbCd: '1', area: '84.9', dongNm: '제107동', hoNm: '3101호', ...apt },
      { exposPubuseGbCd: '2', area: '33.45', dongNm: '제107동', hoNm: '3101호', mainPurpsCdNm: '계단' },
    ],
    { dongNm: '109동', hoNm: '101' },
  );
  assert.equal(summary.kind, 'groups');
  if (summary.kind !== 'groups') return;
  assert.equal(summary.note, UNIT_MISS_NOTE);
  assert.equal(summary.groups.length, 1);
  assert.equal(summary.groups[0]?.exclusiveSqm, 84.9);
});

test('동·호를 고르면 그 집 한 줄이다', () => {
  const summary = summarizeExposAreas(
    [
      { exposPubuseGbCd: '1', area: '59.5', dongNm: '101동', hoNm: '201호', ...apt },
      { exposPubuseGbCd: '2', area: '10', dongNm: '101동', hoNm: '201호', mainPurpsCdNm: '계단' },
      { exposPubuseGbCd: '1', area: '84', dongNm: '102동', hoNm: '201호', ...apt },
    ],
    { dongNm: '101', hoNm: '201' },
  );
  assert.equal(summary.kind, 'unit');
  if (summary.kind !== 'unit') return;
  assert.equal(summary.exclusiveSqm, 59.5);
  assert.equal(summary.supplySqm, 69.5);
  assert.equal(formatQuickQuoteAreaLine({ ...summary, households: 1 }), '전용 59.5㎡ · 공급 21평 · 1세대');
});

test('큰 단지 평형 줄은 전용 작은 순으로 적는다', () => {
  const rows = [];
  const samples = [
    { area: '84.93', common: '27.4', count: 412 },
    { area: '59.87', common: '18.2', count: 180 },
    { area: '114.9', common: '36', count: 64 },
  ];
  let ho = 1;
  for (const sample of samples) {
    for (let i = 0; i < sample.count; i += 1) {
      const name = String(ho);
      ho += 1;
      rows.push({ exposPubuseGbCd: '1', area: sample.area, dongNm: '101', hoNm: name, ...apt });
      rows.push({
        exposPubuseGbCd: '2',
        area: sample.common,
        dongNm: '101',
        hoNm: name,
        mainPurpsCdNm: '계단',
      });
    }
  }
  const summary = summarizeExposAreas(rows);
  assert.equal(summary.kind, 'groups');
  if (summary.kind !== 'groups') return;
  const lines = summary.groups.filter((group) => group.households >= 3).map((group) => formatQuickQuoteAreaLine(group));
  assert.deepEqual(lines, [
    '전용 59.9㎡ · 공급 23.6평 · 180세대',
    '전용 84.9㎡ · 공급 34평 · 412세대',
    '전용 114.9㎡ · 공급 45.6평 · 64세대',
  ]);
});
