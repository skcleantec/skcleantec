import { postBlobToStorage } from '../utils/browserStorageUpload';
import { API } from './apiPrefix';
import type { EContractAudienceKind } from './adminEContract';

export type PublicSignFieldDto = {
  token: string;
  label: string;
  inputType: 'TEXT' | 'TEXTAREA' | 'DATE' | 'NUMBER' | 'PHONE' | 'RRN';
  required: boolean;
  prefill?: string;
};

export type PublicSignSessionDto = {
  issuanceId: string;
  definitionTitle: string;
  audience: EContractAudienceKind;
  signerNameLabel: string;
  versionOrdinal: number;
  versionTitle: string;
  bodyMarkdown: string;
  signFields: PublicSignFieldDto[];
  expiresAtIso: string | null;
  challengeDigits: string;
  issuanceStatus: string;
  alreadySigned: boolean;
  signedAtIso: string | null;
};

export async function fetchEContractPublicSession(token: string): Promise<PublicSignSessionDto> {
  const res = await fetch(`${API}/e-contract/sign/${encodeURIComponent(token)}`);
  const data = (await res.json().catch(() => ({}))) as { error?: string; session?: PublicSignSessionDto };
  if (!res.ok || !data.session) throw new Error(data.error || '링크 정보를 불러오지 못했습니다.');
  return data.session;
}

export async function uploadEContractBlob(
  blob: Blob,
  token: string,
  filename: string
): Promise<{ publicId: string; secureUrl: string }> {
  return postBlobToStorage({
    url: `${API}/e-contract/sign/${encodeURIComponent(token)}/upload`,
    blob,
    filename,
    folderPrefix: 'e_contract',
  });
}

export async function submitEContractSign(
  token: string,
  body: {
    signerName?: string;
    signerResidentRegistrationNumber?: string;
    signerAddressLine?: string;
    signerPhone?: string;
    signerFreeTextNotes?: string;
    signerFields?: Record<string, string>;
    challengeEntered: string;
    agree: boolean;
    selfiePublicId: string;
    selfieUrl: string;
    signaturePublicId: string;
    signatureUrl: string;
  }
): Promise<{ signedAt: string }> {
  const res = await fetch(`${API}/e-contract/sign/${encodeURIComponent(token)}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || '저장하지 못했습니다.');
  const signedAt = (data as { signedAt?: string }).signedAt;
  return { signedAt: typeof signedAt === 'string' ? signedAt : '' };
}
