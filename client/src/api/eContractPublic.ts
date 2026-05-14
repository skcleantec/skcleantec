import { API } from './apiPrefix';

export type PublicSignSessionDto = {
  issuanceId: string;
  definitionTitle: string;
  signerNameLabel: string;
  versionOrdinal: number;
  versionTitle: string;
  bodyMarkdown: string;
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
  const signRes = await fetch(`${API}/e-contract/sign/${encodeURIComponent(token)}/upload-sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const signJson = await signRes.json().catch(() => ({}));
  if (!signRes.ok) throw new Error((signJson as { error?: string }).error || '업로드 준비에 실패했습니다.');
  const m = signJson as {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    folder: string;
  };

  const fd = new FormData();
  fd.append('file', blob, filename);
  fd.append('api_key', m.apiKey);
  fd.append('timestamp', String(m.timestamp));
  fd.append('signature', m.signature);
  fd.append('folder', m.folder);

  const upl = await fetch(`https://api.cloudinary.com/v1_1/${m.cloudName}/image/upload`, {
    method: 'POST',
    body: fd,
  });
  const uj = await upl.json().catch(() => ({}));
  if (!upl.ok) {
    throw new Error((uj as { error?: { message?: string } }).error?.message || '파일 업로드에 실패했습니다.');
  }
  const publicId = typeof (uj as { public_id?: string }).public_id === 'string' ? (uj as { public_id: string }).public_id : '';
  const secureUrl =
    typeof (uj as { secure_url?: string }).secure_url === 'string' ? (uj as { secure_url: string }).secure_url : '';
  if (!publicId.startsWith('e_contract/') || !secureUrl) {
    throw new Error('업로드 결과가 규격에 맞지 않습니다.');
  }
  return { publicId, secureUrl };
}

export async function submitEContractSign(
  token: string,
  body: {
    signerName: string;
    /** 숫자 13자리(하이픈 있어도 됨 — 서버에서 정규화) */
    signerResidentRegistrationNumber: string;
    signerAddressLine: string;
    signerPhone: string;
    signerFreeTextNotes?: string;
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
