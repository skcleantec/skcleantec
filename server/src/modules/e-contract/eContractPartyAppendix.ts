import { expandIssuerPlaceholders, type EContractIssuerSnapshot } from './eContractIssuer.expand.js';

/**
 * 편집기 본문 아래에 자동으로 붙는 블록(배포 표시본·미리보기·체결 화면 공통).
 * - 갑: 발행측 프로필로 토큰 치환
 * - 을: 체결 시 입력·서명 토큰 유지(제출 시 전체 HTML에서 일괄 치환)
 */
export function buildPartyAppendixHtml(issuer: EContractIssuerSnapshot | null): string {
  const tmpl = `
<div class="ec-party-appendix border-t border-gray-300 mt-10 pt-8 text-fluid-sm text-gray-900">
<h3 class="text-fluid-md font-semibold text-gray-900 mb-3">계약주 (갑) 정보</h3>
<table class="w-full border-collapse border border-gray-300 text-fluid-xs">
<tbody>
<tr><th class="border border-gray-300 bg-gray-50 px-2 py-2 text-center" style="width:28%">상호</th><td class="border border-gray-300 px-2 py-2 text-center">[[EC_ISSUER_COMPANY]]</td></tr>
<tr><th class="border border-gray-300 bg-gray-50 px-2 py-2 text-center">대표자</th><td class="border border-gray-300 px-2 py-2 text-center">[[EC_ISSUER_REP]]</td></tr>
<tr><th class="border border-gray-300 bg-gray-50 px-2 py-2 text-center">사업자등록번호</th><td class="border border-gray-300 px-2 py-2 text-center">[[EC_ISSUER_BIZNO]]</td></tr>
<tr><th class="border border-gray-300 bg-gray-50 px-2 py-2 text-center">주소</th><td class="border border-gray-300 px-2 py-2 text-center">[[EC_ISSUER_ADDRESS]]</td></tr>
<tr><th class="border border-gray-300 bg-gray-50 px-2 py-2 text-center">전화</th><td class="border border-gray-300 px-2 py-2 text-center">[[EC_ISSUER_PHONE]]</td></tr>
<tr><th class="border border-gray-300 bg-gray-50 px-2 py-2 text-center">팩스</th><td class="border border-gray-300 px-2 py-2 text-center">[[EC_ISSUER_FAX]]</td></tr>
<tr><th class="border border-gray-300 bg-gray-50 px-2 py-2 text-center">이메일</th><td class="border border-gray-300 px-2 py-2 text-center">[[EC_ISSUER_EMAIL]]</td></tr>
<tr><th class="border border-gray-300 bg-gray-50 px-2 py-2 text-center">도장</th><td class="border border-gray-300 px-2 py-2 text-center">[[EC_ISSUER_SEAL]]</td></tr>
</tbody>
</table>
<h3 class="text-fluid-md font-semibold text-gray-900 mt-8 mb-2">계약자 (을) 정보</h3>
<p class="text-fluid-2xs text-gray-600 mb-3">아래 항목은 <strong>체결 링크</strong>에서 팀장(을)이 입력합니다. 본문에 <span class="rounded bg-gray-100 px-1 font-mono text-fluid-2xs">[[EC_SIGNER_…]]</span> 토큰을 넣은 경우와 동일한 값이 체결 시 반영됩니다.</p>
<table class="w-full border-collapse border border-gray-300 text-fluid-xs">
<tbody>
<tr><th class="border border-gray-300 bg-gray-50 px-2 py-2 text-center" style="width:28%">성명</th><td class="border border-gray-300 px-2 py-2 text-center font-mono text-fluid-2xs text-gray-700">[[EC_SIGNER_NAME]]</td></tr>
<tr><th class="border border-gray-300 bg-gray-50 px-2 py-2 text-center">주민등록번호</th><td class="border border-gray-300 px-2 py-2 text-center font-mono text-fluid-2xs text-gray-700">[[EC_SIGNER_RRN]]</td></tr>
<tr><th class="border border-gray-300 bg-gray-50 px-2 py-2 text-center">주소</th><td class="border border-gray-300 px-2 py-2 text-center font-mono text-fluid-2xs text-gray-700">[[EC_SIGNER_ADDRESS]]</td></tr>
<tr><th class="border border-gray-300 bg-gray-50 px-2 py-2 text-center">연락처</th><td class="border border-gray-300 px-2 py-2 text-center font-mono text-fluid-2xs text-gray-700">[[EC_SIGNER_PHONE]]</td></tr>
<tr><th class="border border-gray-300 bg-gray-50 px-2 py-2 text-center">추가 기재</th><td class="border border-gray-300 px-2 py-2 text-center font-mono text-fluid-2xs text-gray-700">[[EC_SIGNER_FREETEXT]]</td></tr>
<tr><th class="border border-gray-300 bg-gray-50 px-2 py-2 text-center">서명</th><td class="border border-gray-300 px-2 py-2 text-center font-mono text-fluid-2xs text-gray-700">[[EC_SIGNATURE]]</td></tr>
</tbody>
</table>
</div>`;
  return expandIssuerPlaceholders(tmpl.replace(/\r\n/g, '\n'), issuer);
}
