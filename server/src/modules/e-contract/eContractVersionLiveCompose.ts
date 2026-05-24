import { expandIssuerPlaceholders } from './eContractIssuer.expand.js';
import { getIssuerSnapshot } from './eContractIssuer.profile.service.js';
import { buildPartyAppendixHtml, stripPartyAppendixFromContractHtml } from './eContractPartyAppendix.js';

export type EContractVersionBodySource = {
  bodyMarkdown: string;
  bodyDisplayHtml?: string | null;
};

/**
 * 배포 버전 원문(`bodyMarkdown`)의 갑 토큰을 **현재** 발행측 프로필로 치환하고 부록을 붙인다.
 * 배포 직후 발행측 정보만 채운 경우·프로필을 수정한 뒤에도 미체결·체결 제출 본문이 동일 규칙을 따른다.
 * `bodyMarkdown`이 비어 있으면 `bodyDisplayHtml` 폴백(레거시).
 */
export async function composePublishedVersionHtmlWithLiveIssuer(
  tenantId: string,
  version: EContractVersionBodySource,
  appendixOpts?: { submissionId?: string; signedAtIso?: string }
): Promise<string> {
  const snap = await getIssuerSnapshot(tenantId);
  const raw = (version.bodyMarkdown ?? '').replace(/\r\n/g, '\n').trim();
  if (!raw) {
    const fb =
      typeof version.bodyDisplayHtml === 'string' && version.bodyDisplayHtml.trim() !== ''
        ? version.bodyDisplayHtml.trim()
        : '';
    return fb;
  }
  let main = expandIssuerPlaceholders(raw, snap);
  main = stripPartyAppendixFromContractHtml(main);
  const appendix = buildPartyAppendixHtml(snap, appendixOpts);
  return `${main.trimEnd()}\n\n${appendix}`;
}
