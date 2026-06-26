import { prisma } from '../../lib/prisma.js';

const SUBMISSION_MEDIA_FOLDER_PREFIX = 'e_contract/issuance/';

function submissionMediaFolderForUpload(issuanceId: string): string {
  return `${SUBMISSION_MEDIA_FOLDER_PREFIX}${issuanceId.replace(/[^\w\-]/g, '')}`;
}

export function submissionMediaUploadFolder(issuanceId: string): string {
  return submissionMediaFolderForUpload(issuanceId);
}

function isLikelyCloudinaryUrl(urlRaw: unknown, publicIdRaw: unknown): boolean {
  const url = typeof urlRaw === 'string' ? urlRaw.trim() : '';
  const publicId = typeof publicIdRaw === 'string' ? publicIdRaw.trim() : '';
  if (!url || !publicId) return false;
  const u = url.toLowerCase();
  return (
    u.startsWith('https://') &&
    (u.includes('res.cloudinary.com') || u.includes('/image/upload/v')) &&
    publicId.startsWith('e_contract/')
  );
}

function patchSignatureInMergedHtml(html: string, oldUrl: string | null | undefined, newUrl: string): string {
  const neu = newUrl.trim();
  if (!neu) return html;
  let out = html;
  const old = (oldUrl ?? '').trim();
  if (old && old !== neu) {
    out = out.split(old).join(neu);
  }
  out = out.replace(
    /(<img[^>]*class="[^"]*e-contract-signer-signature-img[^"]*"[^>]*\ssrc=")([^"]*)(")/gi,
    `$1${neu.replace(/"/g, '&quot;')}$3`,
  );
  return out;
}

export async function patchSubmissionMediaForAdmin(
  tenantId: string,
  submissionId: string,
  input: {
    selfiePublicId?: string | null;
    selfieUrl?: string | null;
    signaturePublicId?: string | null;
    signatureUrl?: string | null;
  },
): Promise<{ id: string }> {
  const row = await prisma.eContractSubmission.findFirst({
    where: { id: submissionId, issuance: { definition: { tenantId } } },
    select: {
      id: true,
      selfiePublicId: true,
      selfieUrl: true,
      signaturePublicId: true,
      signatureUrl: true,
      mergedContractHtml: true,
    },
  });
  if (!row) {
    throw Object.assign(new Error('not_found'), { code: 'not_found' as const });
  }

  const data: {
    selfiePublicId?: string;
    selfieUrl?: string;
    signaturePublicId?: string;
    signatureUrl?: string;
    mergedContractHtml?: string;
  } = {};

  if (input.selfiePublicId !== undefined || input.selfieUrl !== undefined) {
    if (!isLikelyCloudinaryUrl(input.selfieUrl, input.selfiePublicId)) {
      throw Object.assign(new Error('selfie_bad'), { code: 'bad_request' as const });
    }
    data.selfiePublicId = String(input.selfiePublicId).trim().slice(0, 512);
    data.selfieUrl = String(input.selfieUrl).trim().slice(0, 2048);
  }

  if (input.signaturePublicId !== undefined || input.signatureUrl !== undefined) {
    if (!isLikelyCloudinaryUrl(input.signatureUrl, input.signaturePublicId)) {
      throw Object.assign(new Error('signature_bad'), { code: 'bad_request' as const });
    }
    const newSigUrl = String(input.signatureUrl).trim();
    data.signaturePublicId = String(input.signaturePublicId).trim().slice(0, 512);
    data.signatureUrl = newSigUrl.slice(0, 2048);

    const merged =
      typeof row.mergedContractHtml === 'string' && row.mergedContractHtml.trim() !== ''
        ? row.mergedContractHtml.trim()
        : '';
    if (merged) {
      data.mergedContractHtml = patchSignatureInMergedHtml(merged, row.signatureUrl, newSigUrl);
    }
  }

  if (Object.keys(data).length === 0) {
    throw Object.assign(new Error('nothing_to_patch'), { code: 'bad_request' as const });
  }

  await prisma.eContractSubmission.update({
    where: { id: row.id },
    data,
  });

  return { id: row.id };
}
