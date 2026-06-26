import { expandIssuerPlaceholders, type EContractIssuerSnapshot } from './eContractIssuer.expand.js';

const APPENDIX_ROOT_OPEN_RE = /<div\b[^>]*\bec-party-appendix\b[^>]*>/i;

/** `<div class="ec-party-appendix" …> … </div>` 의 닫는 위치 (중첩 div 고려) */
function findMatchingDivClose(html: string, openDivMatchStart: number): number | null {
  const tagRe = /<\/?div\b[^>]*>/gi;
  tagRe.lastIndex = openDivMatchStart;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html))) {
    const isClose = /^<\/div\b/i.test(match[0]);
    if (!isClose) depth++;
    else depth--;
    if (depth === 0) {
      return match.index + match[0].length;
    }
  }
  return null;
}

/**
 * 배포본(bodyDisplayHtml)에는 이미 부록이 포함되어 있다.
 * 체결 제출 시 부록을 다시 붙이면 갑/을 표가 두 번 나오므로, 기존 부록 블록을 모두 제거한 뒤 한 번만 붙인다.
 */
export function stripPartyAppendixFromContractHtml(html: string): string {
  let result = html;
  for (;;) {
    APPENDIX_ROOT_OPEN_RE.lastIndex = 0;
    const m = APPENDIX_ROOT_OPEN_RE.exec(result);
    if (!m) break;
    const start = m.index;
    const end = findMatchingDivClose(result, start);
    if (end === null) break;
    result = result.slice(0, start) + result.slice(end);
  }
  return result.replace(/\s+$/, '').trimEnd();
}

/**
 * 과거 버그로 합본 HTML에 부록이 연속 두 번 이상 들어간 경우, 마지막 부록만 남긴다(체결 시점 일자·서명 반영본 우선).
 */
export function dedupeTrailingPartyAppendices(html: string): string {
  const ranges: Array<{ start: number; end: number }> = [];
  let pos = 0;
  for (;;) {
    const rest = html.slice(pos);
    const m = rest.match(APPENDIX_ROOT_OPEN_RE);
    if (!m || m.index === undefined) break;
    const start = pos + m.index;
    const end = findMatchingDivClose(html, start);
    if (end === null) return html;
    ranges.push({ start, end });
    pos = end;
  }
  if (ranges.length <= 1) return html;
  const lastBlock = html.slice(ranges[ranges.length - 1].start, ranges[ranges.length - 1].end);
  let main = html;
  for (let i = ranges.length - 1; i >= 0; i--) {
    const r = ranges[i];
    main = main.slice(0, r.start) + main.slice(r.end);
  }
  return `${main.trimEnd()}\n\n${lastBlock}`.trimEnd();
}

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
<div class="ec-party-appendix" style="margin-top: 60px; padding-top: 40px; border-top: 1px solid #000; font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; color: #000;">
  <div style="text-align: center; margin-bottom: 60px; font-size: 18px; font-weight: bold; letter-spacing: 2px;">
    ${dateText}
  </div>

  <table width="100%" style="border: 0; border-collapse: collapse; table-layout: fixed;">
    <tr>
      <td width="50%" style="vertical-align: top; padding: 0 20px 0 0;">
        <div style="font-size: 15px; font-weight: bold; margin-bottom: 16px;">[계 약 주] (갑)</div>
        <table width="100%" style="border-collapse: collapse; font-size: 14px; text-align: left;">
          <tbody>
            <tr><td width="80" style="padding: 6px 0; color: #333; font-weight: bold;">상호</td><td style="padding: 6px 0;">[[EC_ISSUER_COMPANY]]</td></tr>
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
      <td width="50%" style="vertical-align: top; padding: 0 0 0 20px;">
        <div style="font-size: 15px; font-weight: bold; margin-bottom: 16px;">[계 약 자] (을)</div>
        <table width="100%" style="border-collapse: collapse; font-size: 14px; text-align: left;">
          <tbody>
            <tr><td width="80" style="padding: 6px 0; color: #333; font-weight: bold;">성명</td><td style="padding: 6px 0; font-weight: bold;">[[EC_SIGNER_NAME]]</td></tr>
            <tr><td style="padding: 6px 0; color: #333; font-weight: bold;">주민번호</td><td style="padding: 6px 0;">[[EC_SIGNER_RRN]]</td></tr>
            <tr><td style="padding: 6px 0; color: #333; font-weight: bold;">주소</td><td style="padding: 6px 0;">[[EC_SIGNER_ADDRESS]]</td></tr>
            <tr><td style="padding: 6px 0; color: #333; font-weight: bold;">연락처</td><td style="padding: 6px 0;">[[EC_SIGNER_PHONE]]</td></tr>
            [[EC_SIGNER_FREETEXT_ROW]]
            <tr>
              <td colspan="2" style="padding-top: 20px; vertical-align: top;">
                <div style="border: 1px solid #111; border-radius: 4px; min-height: 120px; padding: 8px; box-sizing: border-box;">
                  <div style="display: grid; grid-template-rows: auto 1fr; min-height: 104px;">
                    <div style="font-size: 13px; font-weight: bold; color: #111; line-height: 1.25; justify-self: start; align-self: start; margin: 0; padding: 0;">(서명/인)</div>
                    <div style="display: flex; justify-content: flex-end; align-items: flex-end; padding-top: 6px;">
                      <span style="display: inline-block; max-width: 100%; text-align: right;">[[EC_SIGNATURE]]</span>
                    </div>
                  </div>
                </div>
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
