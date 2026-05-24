import { stabilizeEContractParagraphHtml } from './eContractBodyParagraphStabilize.js';
import { EC_SIGNATURE_TOKEN, EC_CONTRACT_DATE_TOKEN } from './eContractField.tokens.js';
import { signerSignatureUrlLooksValid } from './eContractSigner.expand.js';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function signatureMarkup(url: string): string {
  if (!signerSignatureUrlLooksValid(url)) {
    return '<span class="e-contract-no-sign text-gray-500">(서명 없음)</span>';
  }
  const src = escapeHtml(url.trim());
  return `<img src="${src}" alt="서명" class="e-contract-signer-signature-img inline-block max-w-[260px] align-middle border border-gray-200 bg-white p-1" loading="lazy" />`;
}

function formatValueForHtml(token: string, raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (token === EC_SIGNATURE_TOKEN) return signatureMarkup(t);
  return escapeHtml(t).replace(/\n/g, '<br />');
}

/**
 * token → 표시 문자열 맵으로 본문의 `[[EC_...]]` 를 일괄 치환합니다.
 */
export function expandEcTokenMap(html: string, values: Record<string, string>): string {
  let out = stabilizeEContractParagraphHtml((html ?? '').replace(/\r\n/g, '\n'));
  const entries = Object.entries(values).sort((a, b) => b[0].length - a[0].length);
  for (const [token, raw] of entries) {
    const val = formatValueForHtml(token, raw);
    out = out.split(token).join(val);
  }
  return out;
}

/** 미리보기 — 빈 signer 값은 안내 문구 */
export function expandEcTokenMapPreview(
  html: string,
  values: Record<string, string>,
  opts?: { emptySignerHint?: string }
): string {
  const hint = opts?.emptySignerHint ?? '(체결 시 입력)';
  const filled: Record<string, string> = {};
  for (const [token, raw] of Object.entries(values)) {
    if (!raw.trim()) {
      if (token === EC_CONTRACT_DATE_TOKEN) filled[token] = '(체결 시 확정)';
      else if (token === EC_SIGNATURE_TOKEN) filled[token] = '';
      else filled[token] = hint;
    } else {
      filled[token] = raw;
    }
  }
  return expandEcTokenMap(html, filled);
}

/** (을) 추가 기재 표 행 — 레거시 부록 호환 */
export function freeTextNotesRowMarkup(notesRaw: string): string {
  const notes = notesRaw.trim();
  if (!notes) return '';
  const html = escapeHtml(notes).replace(/\n/g, '<br />');
  return `<tr><td style="padding: 6px 0; color: #333; font-weight: bold;">추가 기재</td><td style="padding: 6px 0;">${html}</td></tr>`;
}

export const EC_SIGNER_FREETEXT_ROW_TOKEN = '[[EC_SIGNER_FREETEXT_ROW]]';
