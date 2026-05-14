import crypto from 'crypto';

/** 과거 배포: 제목·템플릿 본문 기준 해시(JSON `o`,`t`,`b`). */
export type EContractBodyHashSchema = 'template_v1' | 'display_v2';

/**
 * 배포 순번·제목·본문 조합 무결성 해시(hex). 팀장 체결 시 `version_content_hash`에 동일값 저장.
 * - `template_v1`: 레거시(템플릿 `body_markdown`).
 * - `display_v2`: 치환 완료 표시 본문(`body_display_html`) 기준으로 `v:2` 필드 포함.
 */
export function computeEContractContentHash(input: {
  publishedOrdinal: number;
  titleSnapshot: string;
  bodyCanonical: string;
  schema: EContractBodyHashSchema;
}): string {
  const b = input.bodyCanonical.replace(/\r\n/g, '\n').trimEnd();
  const t = input.titleSnapshot.trim();
  if (input.schema === 'template_v1') {
    const payload = JSON.stringify({
      o: input.publishedOrdinal,
      t,
      b,
    });
    return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
  }
  const payload = JSON.stringify({
    v: 2,
    o: input.publishedOrdinal,
    t,
    b,
  });
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}
