import { isLikelyStoredContractImage } from '../../lib/storedObjectUrl.js';

export const SELFIE_REQUIRED_ERROR =
  '본인 확인용 셀카를 올리거나, 「사진은 따로 제출하겠습니다」에 체크해 주세요.';

export const SELFIE_DEFERRED_LABEL = '사진 별도 제출';

export type SelfieSubmitDecision =
  | { ok: true; deferred: false; selfiePublicId: string; selfieUrl: string }
  | { ok: true; deferred: true; selfiePublicId: null; selfieUrl: null; deferredAt: string }
  | { ok: false; error: 'selfie_required' | 'cloudinary_meta' };

function selfieLooksStored(url: string, publicId: string): boolean {
  return isLikelyStoredContractImage(url, publicId, 'e_contract');
}

/** 셀카가 있으면 그걸 쓰고, 없으면 따로 제출 체크일 때만 받는다. */
export function decideSelfieOnSubmit(input: {
  selfiePublicId?: string | null;
  selfieUrl?: string | null;
  selfieDeferred?: boolean;
  signedAtIso: string;
}): SelfieSubmitDecision {
  const publicId = (input.selfiePublicId ?? '').trim();
  const url = (input.selfieUrl ?? '').trim();
  const attempted = publicId.length > 0 || url.length > 0;
  if (attempted && selfieLooksStored(url, publicId)) {
    return { ok: true, deferred: false, selfiePublicId: publicId, selfieUrl: url };
  }
  if (attempted) return { ok: false, error: 'cloudinary_meta' };
  if (input.selfieDeferred === true) {
    return {
      ok: true,
      deferred: true,
      selfiePublicId: null,
      selfieUrl: null,
      deferredAt: input.signedAtIso,
    };
  }
  return { ok: false, error: 'selfie_required' };
}

export function isSelfieMissing(selfieUrl: string | null | undefined): boolean {
  return !(selfieUrl ?? '').trim();
}

export function readSelfieDeferred(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  return (payload as Record<string, unknown>).selfieDeferred === true;
}

export function selfieDeferredPayload(deferredAtIso: string): { selfieDeferred: true; selfieDeferredAt: string } {
  return { selfieDeferred: true, selfieDeferredAt: deferredAtIso };
}

/** 관리자가 나중에 사진을 올려도 「따로 제출」 선택은 남긴다. */
export function withSelfieUploadRecord(
  payload: unknown,
  uploadedAtIso: string,
  userId: string,
): Record<string, unknown> {
  const base =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? { ...(payload as Record<string, unknown>) }
      : {};
  return {
    ...base,
    selfieUploadedAt: uploadedAtIso,
    selfieUploadedByUserId: userId,
  };
}

function isSelfieImageTag(tag: string): boolean {
  return /셀카|selfie/i.test(tag);
}

function imageSrc(tag: string): string {
  const quoted = /\ssrc\s*=\s*"([^"]*)"/i.exec(tag) ?? /\ssrc\s*=\s*'([^']*)'/i.exec(tag);
  return (quoted?.[1] ?? '').trim();
}

/**
 * 합본 HTML·그 HTML로 만드는 docx·PDF.
 * 셀카 그림이 비어 있으면 빼 두고, 따로 제출이면 「사진 별도 제출」만 남긴다.
 * 본인확인 번호 칸은 건드리지 않는다.
 */
export function contractHtmlForSelfie(
  html: string,
  selfie: { deferred: boolean },
): string {
  let out = (html ?? '').replace(/\[\[EC_SELFIE(?:_URL)?\]\]/g, selfie.deferred ? SELFIE_DEFERRED_LABEL : '');
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    if (!isSelfieImageTag(tag)) return tag;
    if (imageSrc(tag)) return selfie.deferred ? SELFIE_DEFERRED_LABEL : tag;
    return selfie.deferred ? SELFIE_DEFERRED_LABEL : '';
  });
  if (!selfie.deferred || out.includes(SELFIE_DEFERRED_LABEL)) return out;

  const row =
    '<tr><td style="padding: 6px 0; color: #333; font-weight: bold;">본인확인 사진</td>' +
    `<td style="padding: 6px 0;">${SELFIE_DEFERRED_LABEL}</td></tr>`;
  const challengeRow =
    /(본인확인번호<\/td>\s*<td\b[^>]*>[\s\S]*?<\/td>\s*<\/tr>)/i;
  if (challengeRow.test(out)) return out.replace(challengeRow, `$1\n${row}`);
  return `${out}\n<p>본인확인 사진: ${SELFIE_DEFERRED_LABEL}</p>`;
}
