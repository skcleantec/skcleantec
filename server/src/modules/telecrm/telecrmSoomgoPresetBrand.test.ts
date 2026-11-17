import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyCommonCopy,
  findBrandPreset,
  pickSoomgoCredentialSource,
  presetForSend,
  saveBrandPreset,
  type SoomgoPresetBrandRow,
} from './telecrmSoomgoPresetBrand.js';

const tenant = 'tenant-1';
const brandA = 'brand-a';
const brandB = 'brand-b';
const user1 = 'user-1';
const user2 = 'user-2';

function row(partial: Partial<SoomgoPresetBrandRow> & Pick<SoomgoPresetBrandRow, 'id' | 'triggerKind'>): SoomgoPresetBrandRow {
  return {
    tenantId: tenant,
    ownerUserId: null,
    operatingCompanyId: null,
    stepsJson: '[]',
    isActive: false,
    paybackWon: null,
    label: partial.triggerKind,
    ...partial,
  };
}

describe('숨고 자동메시지 브랜드 × 직원', () => {
  it('비어 있는 브랜드에만 공통 내용을 복사하고, 채워진 브랜드는 그대로 둔다', () => {
    const common = row({
      id: 'common-absent',
      triggerKind: 'auto_absent',
      stepsJson: JSON.stringify([{ type: 'text', text: '부재 공통' }]),
      isActive: true,
    });
    const emptyA = row({
      id: 'a-absent',
      triggerKind: 'auto_absent',
      operatingCompanyId: brandA,
      stepsJson: '[]',
      isActive: false,
    });
    const filledB = row({
      id: 'b-absent',
      triggerKind: 'auto_absent',
      operatingCompanyId: brandB,
      stepsJson: JSON.stringify([{ type: 'text', text: '브랜드B만' }]),
      isActive: true,
    });
    const copied = applyCommonCopy([common, emptyA, filledB], [brandA, brandB]);
    const sendA = presetForSend(findBrandPreset(copied, { tenantId: tenant, triggerKind: 'auto_absent', operatingCompanyId: brandA, ownerUserId: null }));
    const sendB = presetForSend(findBrandPreset(copied, { tenantId: tenant, triggerKind: 'auto_absent', operatingCompanyId: brandB, ownerUserId: null }));
    assert.equal(sendA?.stepsJson.includes('부재 공통'), true);
    assert.equal(sendB?.stepsJson.includes('브랜드B만'), true);
    assert.equal(copied.some((item) => item.id === 'common-absent' && item.operatingCompanyId == null), true);
    assert.equal(presetForSend(findBrandPreset(copied, { tenantId: tenant, triggerKind: 'auto_absent', operatingCompanyId: null, ownerUserId: null })), null);
  });

  it('브랜드 A 저장이 브랜드 B와 다른 직원의 전화 문구를 바꾸지 않는다', () => {
    let rows: SoomgoPresetBrandRow[] = [];
    rows = saveBrandPreset(rows, { tenantId: tenant, triggerKind: 'auto_absent', operatingCompanyId: brandA, ownerUserId: null, label: '부재' }, {
      stepsJson: JSON.stringify([{ type: 'text', text: 'A-부재' }]),
      isActive: true,
    });
    rows = saveBrandPreset(rows, { tenantId: tenant, triggerKind: 'auto_absent', operatingCompanyId: brandB, ownerUserId: null, label: '부재' }, {
      stepsJson: JSON.stringify([{ type: 'text', text: 'B-부재' }]),
      isActive: true,
    });
    rows = saveBrandPreset(rows, { tenantId: tenant, triggerKind: 'auto_quote', operatingCompanyId: brandA, ownerUserId: null, label: '견적' }, {
      stepsJson: JSON.stringify([{ type: 'text', text: '견적 {페이백금액}' }]),
      isActive: true,
      paybackWon: 15000,
    });
    rows = saveBrandPreset(rows, { tenantId: tenant, triggerKind: 'auto_call', operatingCompanyId: brandA, ownerUserId: user1, label: '통화' }, {
      stepsJson: JSON.stringify([{ type: 'text', text: '직원1 통화' }]),
      isActive: true,
    });
    rows = saveBrandPreset(rows, { tenantId: tenant, triggerKind: 'auto_call', operatingCompanyId: brandA, ownerUserId: user2, label: '통화' }, {
      stepsJson: JSON.stringify([{ type: 'text', text: '직원2 통화' }]),
      isActive: true,
    });
    rows = saveBrandPreset(rows, { tenantId: tenant, triggerKind: 'auto_absent', operatingCompanyId: brandA, ownerUserId: null, label: '부재' }, {
      stepsJson: JSON.stringify([{ type: 'text', text: 'A-부재-수정' }]),
      isActive: true,
    });

    const absentA = presetForSend(findBrandPreset(rows, { tenantId: tenant, triggerKind: 'auto_absent', operatingCompanyId: brandA, ownerUserId: null }));
    const absentB = presetForSend(findBrandPreset(rows, { tenantId: tenant, triggerKind: 'auto_absent', operatingCompanyId: brandB, ownerUserId: null }));
    const quoteA = presetForSend(findBrandPreset(rows, { tenantId: tenant, triggerKind: 'auto_quote', operatingCompanyId: brandA, ownerUserId: null }));
    const quoteB = presetForSend(findBrandPreset(rows, { tenantId: tenant, triggerKind: 'auto_quote', operatingCompanyId: brandB, ownerUserId: null }));
    const call1 = presetForSend(findBrandPreset(rows, { tenantId: tenant, triggerKind: 'auto_call', operatingCompanyId: brandA, ownerUserId: user1 }));
    const call2 = presetForSend(findBrandPreset(rows, { tenantId: tenant, triggerKind: 'auto_call', operatingCompanyId: brandA, ownerUserId: user2 }));
    const call1OnB = presetForSend(findBrandPreset(rows, { tenantId: tenant, triggerKind: 'auto_call', operatingCompanyId: brandB, ownerUserId: user1 }));

    assert.match(absentA?.stepsJson ?? '', /A-부재-수정/);
    assert.match(absentB?.stepsJson ?? '', /B-부재/);
    assert.equal(quoteA?.paybackWon, 15000);
    assert.equal(quoteB, null);
    assert.match(call1?.stepsJson ?? '', /직원1/);
    assert.match(call2?.stepsJson ?? '', /직원2/);
    assert.equal(call1OnB, null);
    assert.equal(findBrandPreset(rows, { tenantId: tenant, triggerKind: 'auto_absent', operatingCompanyId: brandA, ownerUserId: user1 }), null);
  });

  it('꺼져 있거나 브랜드가 없으면 보내지 않는다', () => {
    const off = row({
      id: 'off',
      triggerKind: 'auto_quote',
      operatingCompanyId: brandA,
      stepsJson: JSON.stringify([{ type: 'text', text: '견적' }]),
      isActive: false,
      paybackWon: 20000,
    });
    assert.equal(presetForSend(off), null);
    assert.equal(presetForSend(findBrandPreset([off], { tenantId: tenant, triggerKind: 'auto_quote', operatingCompanyId: null, ownerUserId: null })), null);
  });

  it('숨고 계정은 브랜드 계정이 있으면 브랜드, 없으면 업체 계정', () => {
    assert.equal(pickSoomgoCredentialSource(true, true), 'brand');
    assert.equal(pickSoomgoCredentialSource(false, true), 'tenant');
    assert.equal(pickSoomgoCredentialSource(false, false), null);
  });
});
