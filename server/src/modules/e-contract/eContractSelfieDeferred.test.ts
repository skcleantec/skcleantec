import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SELFIE_DEFERRED_LABEL,
  SELFIE_REQUIRED_ERROR,
  contractHtmlForSelfie,
  decideSelfieOnSubmit,
  isSelfieMissing,
  readSelfieDeferred,
  withSelfieUploadRecord,
} from './eContractSelfieDeferred.js';

const signedAt = '2026-11-27T05:00:00.000Z';
const selfieUrl = 'https://res.cloudinary.com/demo/image/upload/v1/e_contract/issuance/selfie.jpg';
const selfieId = 'e_contract/issuance/selfie';

const appendix = `
<tr><td>본인확인번호</td><td style="font-weight:bold">482913</td></tr>
<img src="" alt="본인 확인 셀카" />
`;

describe('셀카 없이 제출', () => {
  it('따로 제출이면 셀카 없이도 받는다', () => {
    const decision = decideSelfieOnSubmit({ selfieDeferred: true, signedAtIso: signedAt });
    assert.equal(decision.ok, true);
    if (!decision.ok || !decision.deferred) return;
    assert.equal(decision.selfieUrl, null);
    assert.equal(decision.deferredAt, signedAt);
  });

  it('셀카도 없고 체크도 없으면 거절한다', () => {
    const decision = decideSelfieOnSubmit({ selfieDeferred: false, signedAtIso: signedAt });
    assert.deepEqual(decision, { ok: false, error: 'selfie_required' });
    assert.match(SELFIE_REQUIRED_ERROR, /사진은 따로 제출하겠습니다/);
  });

  it('셀카가 있으면 체크와 상관없이 지금처럼 셀카를 쓴다', () => {
    const decision = decideSelfieOnSubmit({
      selfiePublicId: selfieId,
      selfieUrl,
      selfieDeferred: true,
      signedAtIso: signedAt,
    });
    assert.equal(decision.ok, true);
    if (!decision.ok) return;
    assert.equal(decision.deferred, false);
    assert.equal(decision.selfieUrl, selfieUrl);
  });
});

describe('목록과 나중에 올린 사진', () => {
  it('셀카가 없으면 목록에서 빠졌다고 본다', () => {
    assert.equal(isSelfieMissing(null), true);
    assert.equal(isSelfieMissing('  '), true);
    assert.equal(isSelfieMissing(selfieUrl), false);
  });

  it('관리자가 올린 뒤에도 따로 제출 표시는 남고 목록에서는 빠진다', () => {
    const payload = { selfieDeferred: true, selfieDeferredAt: signedAt, challengeDigits: '482913' };
    const next = withSelfieUploadRecord(payload, '2026-11-27T06:00:00.000Z', 'admin-user');
    assert.equal(readSelfieDeferred(next), true);
    assert.equal(next.selfieUploadedByUserId, 'admin-user');
    assert.equal(next.selfieUploadedAt, '2026-11-27T06:00:00.000Z');
    assert.equal(isSelfieMissing(selfieUrl), false);
  });
});

describe('계약서 본문·부록', () => {
  it('따로 제출이면 깨진 그림 대신 사진 별도 제출을 적고 본인확인 번호는 남긴다', () => {
    const html = contractHtmlForSelfie(appendix, { deferred: true });
    assert.match(html, /482913/);
    assert.match(html, new RegExp(SELFIE_DEFERRED_LABEL));
    assert.equal(/<img\b[^>]*src\s*=\s*["']\s*["']/i.test(html), false);
    assert.equal(/<img\b[^>]*셀카/i.test(html), false);
  });

  it('셀카가 있는 체결은 별도 제출 문구를 넣지 않는다', () => {
    const plain = '<p>본인확인번호 482913</p>';
    assert.equal(contractHtmlForSelfie(plain, { deferred: false }), plain);
  });
});
