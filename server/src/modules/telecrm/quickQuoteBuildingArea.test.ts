import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeExposAreas } from './quickQuoteBuildingArea.js';

test('전유는 모으고 주차·지하 공용은 공급에서 뺀다', () => {
  const summary = summarizeExposAreas([
    { exposPubuseGbCd: '1', area: '84.93', dongNm: '101', hoNm: '101' },
    { exposPubuseGbCd: '2', area: '20', dongNm: '101', hoNm: '101', mainPurpsCdNm: '복도' },
    { exposPubuseGbCd: '2', area: '30', dongNm: '101', hoNm: '101', mainPurpsCdNm: '주차장' },
    { exposPubuseGbCd: '2', area: '12', dongNm: '101', hoNm: '101', flrGbCd: '10', mainPurpsCdNm: '계단' },
    { exposPubuseGbCd: '1', area: '84.91', dongNm: '101', hoNm: '102' },
    { exposPubuseGbCd: '2', area: '22', dongNm: '101', hoNm: '102', etcPurps: '복도' },
  ]);
  assert.equal(summary.kind, 'groups');
  if (summary.kind !== 'groups') return;
  assert.equal(summary.groups.length, 1);
  const group = summary.groups[0]!;
  assert.equal(group.exclusiveSqm, 84.9);
  assert.equal(group.households, 2);
  const common = group.supplySqm - group.exclusiveSqm;
  assert.ok(common > 19 && common < 25, `주거공용만 남아야 함: ${common}`);
});

test('동·호를 고르면 그 집만 돌려준다', () => {
  const summary = summarizeExposAreas(
    [
      { exposPubuseGbCd: '1', area: '59.5', dongNm: '101동', hoNm: '201호' },
      { exposPubuseGbCd: '2', area: '10', dongNm: '101동', hoNm: '201호', mainPurpsCdNm: '계단' },
      { exposPubuseGbCd: '1', area: '84', dongNm: '102동', hoNm: '201호' },
    ],
    { dongNm: '101', hoNm: '201' },
  );
  assert.equal(summary.kind, 'unit');
  if (summary.kind !== 'unit') return;
  assert.equal(summary.exclusiveSqm, 59.5);
  assert.equal(summary.supplySqm, 69.5);
});

test('전유 면적이 없으면 비운다', () => {
  const summary = summarizeExposAreas([
    { exposPubuseGbCd: '2', area: '100', mainPurpsCdNm: '기계실' },
  ]);
  assert.equal(summary.kind, 'empty');
});
