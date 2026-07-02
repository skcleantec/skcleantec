/** 브라우저·LB·배포 교체 시 연결이 먼저 끊길 때 Express send/sendFile이 내는 오류 — 서버 버그 아님 */
export function isBenignClientAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  if (e.code === 'ECONNABORTED' || e.code === 'ECONNRESET' || e.code === 'ERR_STREAM_PREMATURE_CLOSE') {
    return true;
  }
  return e.message === 'Request aborted';
}
