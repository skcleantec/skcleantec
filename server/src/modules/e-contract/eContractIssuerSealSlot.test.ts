import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EContractIssuerSnapshot } from './eContractIssuer.expand.js';
import { buildPartyAppendixHtml } from './eContractPartyAppendix.js';

const tenantId = 'tenant-1';
const issuerUrl = 'https://cbiseo-seal.r2.dev/issuer.png';
const companyUrl = 'https://cbiseo-seal.r2.dev/company.png';
const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/v1/e_contract/issuer/old.png';
const signatureUrl = 'https://cbiseo-seal.r2.dev/sign.png';

function snap(partial: EContractIssuerSnapshot): EContractIssuerSnapshot {
  return { tenantId, representativeName: '이정무', ...partial };
}

function appendix(partial: EContractIssuerSnapshot): string {
  return buildPartyAppendixHtml(snap(partial));
}

function assertNameAndIn(html: string) {
  assert.match(html, /font-weight: bold[^>]*>이정무</);
  assert.match(html, /position: relative[^>]*>\(인\)/);
  assert.equal(html.includes('(도장 미등록)'), false);
  assert.equal(html.includes('(서명 미등록)'), false);
}

describe('갑 (인) 칸', () => {
  it('발급자 도장이 있으면 그 이미지를 (인) 위에 둔다', () => {
    const html = appendix({
      sealPublicId: 'e_contract/issuer/stamp',
      sealSecureUrl: issuerUrl,
      sealDisplayWidthPx: 200,
      companySealPublicId: `skcleanteck/tenants/${tenantId}/company-seal/stamp`,
      companySealSecureUrl: companyUrl,
    });
    assertNameAndIn(html);
    assert.match(html, /class="e-contract-seal-img"/);
    assert.match(html, /alt="인"/);
    assert.match(html, /width="120"/);
    assert.match(html, /position:absolute/);
    assert.equal(html.includes(issuerUrl), true);
    assert.equal(html.includes(companyUrl), false);
  });

  it('발급자 도장이 없으면 업체 직인을 쓴다', () => {
    const html = appendix({
      companySealPublicId: `skcleanteck/tenants/${tenantId}/company-seal/stamp`,
      companySealSecureUrl: companyUrl,
    });
    assertNameAndIn(html);
    assert.equal(html.includes(companyUrl), true);
    assert.match(html, /width="60"/);
  });

  it('둘 다 없으면 이름과 (인) 만 나온다', () => {
    const html = appendix({});
    assertNameAndIn(html);
    assert.equal(/<img\b/i.test(html), false);
  });

  it('서명만 있고 업체 직인이 있으면 직인을 쓰고 서명 이미지는 넣지 않는다', () => {
    const html = appendix({
      issuerStampKind: 'SIGNATURE',
      signaturePublicId: 'e_contract/issuer/sign',
      signatureSecureUrl: signatureUrl,
      companySealPublicId: `skcleanteck/tenants/${tenantId}/company-seal/stamp`,
      companySealSecureUrl: companyUrl,
    });
    assertNameAndIn(html);
    assert.equal(html.includes(companyUrl), true);
    assert.equal(html.includes(signatureUrl), false);
    assert.equal(html.includes('alt="서명"'), false);
  });

  it('cloudinary 발급자 도장은 건너뛰고 업체 직인을 쓴다', () => {
    const html = appendix({
      sealPublicId: 'e_contract/issuer/old',
      sealSecureUrl: cloudinaryUrl,
      companySealPublicId: `skcleanteck/tenants/${tenantId}/company-seal/stamp`,
      companySealSecureUrl: companyUrl,
    });
    assertNameAndIn(html);
    assert.equal(html.includes(cloudinaryUrl), false);
    assert.equal(html.includes('res.cloudinary.com'), false);
    assert.equal(html.includes(companyUrl), true);
  });
});
