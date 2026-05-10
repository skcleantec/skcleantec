import { API, apiErrorMessage } from './apiPrefix';
import { AuthSessionExpiredError } from './auth';
import { isLikelyNetworkFailure } from './fetchNetwork';

function apiUnreachableMessage(): Error {
  return new Error(
    'API 서버에 연결할 수 없습니다. 저장소 루트에서 npm run dev 로 API가 떠 있는지 확인해 주세요.'
  );
}

export type StagingDbImportStatusPayload = {
  status: string;
  message: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export async function postStagingDbImportStart(
  token: string,
  password: string,
): Promise<{ jobId: string }> {
  let res: Response;
  try {
    res = await fetch(`${API}/admin/staging-db-import/start`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) throw apiUnreachableMessage();
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (res.status === 401) throw new AuthSessionExpiredError();
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '작업을 시작할 수 없습니다.'));
  }
  return res.json() as Promise<{ jobId: string }>;
}

export async function getStagingDbImportStatus(
  token: string,
  jobId: string,
): Promise<StagingDbImportStatusPayload> {
  let res: Response;
  try {
    res = await fetch(`${API}/admin/staging-db-import/status/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) throw apiUnreachableMessage();
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (res.status === 401) throw new AuthSessionExpiredError();
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '상태를 불러올 수 없습니다.'));
  }
  return res.json() as Promise<StagingDbImportStatusPayload>;
}
