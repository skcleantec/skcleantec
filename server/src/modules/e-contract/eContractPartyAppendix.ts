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
  const docId = options?.submissionId ? options.submissionId.toUpperCase().slice(0, 13) : '미발급(임시)';

  let dateText = '년 월 일 (체결 시 자동 입력)';
  if (options?.signedAtIso) {
    const d = new Date(options.signedAtIso);
    if (!Number.isNaN(d.getTime())) {
      dateText = `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일`;
    }
  }

  const tmpl = `
<div class="ec-party-appendix" style="margin-top: 50px; padding-top: 30px; border-top: 2px solid #111827; font-family: 'Malgun Gothic', sans-serif; color: #111827; page-break-inside: avoid;">
  <div style="text-align: right; font-size: 11px; color: #6b7280; margin-bottom: 40px;">
    문서 확인 번호: <strong>${docId}</strong>
  </div>

  <div style="text-align: center; margin-bottom: 50px; font-size: 18px; font-weight: bold; letter-spacing: 2px;">
    ${dateText}
  </div>

  <table style="width: 100%; border: 0; border-collapse: separate; border-spacing: 20px 0; table-layout: fixed;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding: 0;">
        <h3 style="font-size: 15px; font-weight: bold; margin: 0 0 12px 0; color: #111827; text-align: left;">계약주 (갑)</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
          <tbody>
            <tr><th style="border: 1px solid #d1d5db; background-color: #f9fafb; padding: 10px; width: 32%; font-weight: bold;">상호</th><td style="border: 1px solid #d1d5db; padding: 10px;">[[EC_ISSUER_COMPANY]]</td></tr>
            <tr><th style="border: 1px solid #d1d5db; background-color: #f9fafb; padding: 10px; font-weight: bold;">대표자</th><td style="border: 1px solid #d1d5db; padding: 10px;">[[EC_ISSUER_REP]]</td></tr>
            <tr><th style="border: 1px solid #d1d5db; background-color: #f9fafb; padding: 10px; font-weight: bold;">사업자번호</th><td style="border: 1px solid #d1d5db; padding: 10px;">[[EC_ISSUER_BIZNO]]</td></tr>
            <tr><th style="border: 1px solid #d1d5db; background-color: #f9fafb; padding: 10px; font-weight: bold;">주소</th><td style="border: 1px solid #d1d5db; padding: 10px;">[[EC_ISSUER_ADDRESS]]</td></tr>
            <tr><th style="border: 1px solid #d1d5db; background-color: #f9fafb; padding: 10px; font-weight: bold;">연락처</th><td style="border: 1px solid #d1d5db; padding: 10px;">[[EC_ISSUER_PHONE]]</td></tr>
            <tr><th style="border: 1px solid #d1d5db; background-color: #f9fafb; padding: 10px; font-weight: bold;">이메일</th><td style="border: 1px solid #d1d5db; padding: 10px;">[[EC_ISSUER_EMAIL]]</td></tr>
            <tr><th style="border: 1px solid #d1d5db; background-color: #f9fafb; padding: 10px; font-weight: bold; height: 80px; vertical-align: middle;">(인)</th><td style="border: 1px solid #d1d5db; padding: 10px; text-align: center; vertical-align: middle;">[[EC_ISSUER_SEAL]]</td></tr>
          </tbody>
        </table>
      </td>
      <td style="width: 50%; vertical-align: top; padding: 0;">
        <h3 style="font-size: 15px; font-weight: bold; margin: 0 0 12px 0; color: #111827; text-align: left;">계약자 (을)</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
          <tbody>
            <tr><th style="border: 1px solid #d1d5db; background-color: #f9fafb; padding: 10px; width: 32%; font-weight: bold;">성명</th><td style="border: 1px solid #d1d5db; padding: 10px; font-weight: bold;">[[EC_SIGNER_NAME]]</td></tr>
            <tr><th style="border: 1px solid #d1d5db; background-color: #f9fafb; padding: 10px; font-weight: bold;">주민번호</th><td style="border: 1px solid #d1d5db; padding: 10px;">[[EC_SIGNER_RRN]]</td></tr>
            <tr><th style="border: 1px solid #d1d5db; background-color: #f9fafb; padding: 10px; font-weight: bold;">주소</th><td style="border: 1px solid #d1d5db; padding: 10px;">[[EC_SIGNER_ADDRESS]]</td></tr>
            <tr><th style="border: 1px solid #d1d5db; background-color: #f9fafb; padding: 10px; font-weight: bold;">연락처</th><td style="border: 1px solid #d1d5db; padding: 10px;">[[EC_SIGNER_PHONE]]</td></tr>
            <tr><th style="border: 1px solid #d1d5db; background-color: #f9fafb; padding: 10px; font-weight: bold;">추가 기재</th><td style="border: 1px solid #d1d5db; padding: 10px;">[[EC_SIGNER_FREETEXT]]</td></tr>
            <tr><th style="border: 1px solid #d1d5db; background-color: #f9fafb; padding: 10px; font-weight: bold;">(인)</th><td style="border: 1px solid #d1d5db; padding: 10px;"></td></tr>
            <tr><th style="border: 1px solid #d1d5db; background-color: #f9fafb; padding: 10px; font-weight: bold; height: 80px; vertical-align: middle;">서명</th><td style="border: 1px solid #d1d5db; padding: 10px; text-align: center; vertical-align: middle;">[[EC_SIGNATURE]]</td></tr>
          </tbody>
        </table>
      </td>
    </tr>
  </table>
</div>`;
  return expandIssuerPlaceholders(tmpl.replace(/\r\n/g, '\n'), issuer);
}
