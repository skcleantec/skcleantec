import { expandIssuerPlaceholders, type EContractIssuerSnapshot } from './eContractIssuer.expand.js';

/**
 * 편집기 본문 아래에 자동으로 붙는 블록(배포 표시본·미리보기·체결 화면 공통).
 * - 갑: 발행측 프로필로 토큰 치환
 * - 을: 체결 시 입력·서명 토큰 유지(제출 시 전체 HTML에서 일괄 치환)
 */
export function buildPartyAppendixHtml(
  issuer: EContractIssuerSnapshot | null,
  options?: { signedAtIso?: string; submissionId?: string }
): string {
  let dateText = '년 월 일 (체결 시 자동 입력)';
  if (options?.signedAtIso) {
    const d = new Date(options.signedAtIso);
    if (!Number.isNaN(d.getTime())) {
      dateText = `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일`;
    }
  }

  const tmpl = `
<div class="ec-party-appendix" style="margin-top: 60px; padding-top: 40px; border-top: 1px solid #000; font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; color: #000; page-break-inside: avoid;">
  <div style="text-align: center; margin-bottom: 60px; font-size: 18px; font-weight: bold; letter-spacing: 2px;">
    ${dateText}
  </div>

  <table style="width: 100%; border: 0; border-collapse: collapse; table-layout: fixed;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding: 0 20px 0 0;">
        <div style="font-size: 15px; font-weight: bold; margin-bottom: 16px;">[계 약 주] (갑)</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; text-align: left;">
          <tbody>
            <tr><td style="width: 80px; padding: 6px 0; color: #333; font-weight: bold;">상호</td><td style="padding: 6px 0;">[[EC_ISSUER_COMPANY]]</td></tr>
            <tr><td style="padding: 6px 0; color: #333; font-weight: bold;">대표자</td><td style="padding: 6px 0;">[[EC_ISSUER_REP]]</td></tr>
            <tr><td style="padding: 6px 0; color: #333; font-weight: bold;">사업자번호</td><td style="padding: 6px 0;">[[EC_ISSUER_BIZNO]]</td></tr>
            <tr><td style="padding: 6px 0; color: #333; font-weight: bold;">주소</td><td style="padding: 6px 0;">[[EC_ISSUER_ADDRESS]]</td></tr>
            <tr><td style="padding: 6px 0; color: #333; font-weight: bold;">연락처</td><td style="padding: 6px 0;">[[EC_ISSUER_PHONE]]</td></tr>
            <tr><td style="padding: 6px 0; color: #333; font-weight: bold;">이메일</td><td style="padding: 6px 0;">[[EC_ISSUER_EMAIL]]</td></tr>
            <tr>
              <td colspan="2" style="padding-top: 20px; text-align: right; vertical-align: middle;">
                <span style="font-weight: bold; margin-right: 16px; vertical-align: middle;">(인)</span>
                <span style="display: inline-block; vertical-align: middle;">[[EC_ISSUER_SEAL]]</span>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
      <td style="width: 50%; vertical-align: top; padding: 0 0 0 20px;">
        <div style="font-size: 15px; font-weight: bold; margin-bottom: 16px;">[계 약 자] (을)</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; text-align: left;">
          <tbody>
            <tr><td style="width: 80px; padding: 6px 0; color: #333; font-weight: bold;">성명</td><td style="padding: 6px 0; font-weight: bold;">[[EC_SIGNER_NAME]]</td></tr>
            <tr><td style="padding: 6px 0; color: #333; font-weight: bold;">주민번호</td><td style="padding: 6px 0;">[[EC_SIGNER_RRN]]</td></tr>
            <tr><td style="padding: 6px 0; color: #333; font-weight: bold;">주소</td><td style="padding: 6px 0;">[[EC_SIGNER_ADDRESS]]</td></tr>
            <tr><td style="padding: 6px 0; color: #333; font-weight: bold;">연락처</td><td style="padding: 6px 0;">[[EC_SIGNER_PHONE]]</td></tr>
            [[EC_SIGNER_FREETEXT_ROW]]
            <tr>
              <td colspan="2" style="padding-top: 20px; text-align: right; vertical-align: middle;">
                <span style="font-weight: bold; margin-right: 16px; vertical-align: middle;">(서명/인)</span>
                <span style="display: inline-block; vertical-align: middle;">[[EC_SIGNATURE]]</span>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </table>
</div>`;
  return expandIssuerPlaceholders(tmpl.replace(/\r\n/g, '\n'), issuer);
}
