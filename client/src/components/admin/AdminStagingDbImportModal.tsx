import { useEffect, useState } from 'react';
import {
  getStagingDbImportPreflight,
  getStagingDbImportStatus,
  postStagingDbImportStart,
  type StagingDbImportPreflightPayload,
  type StagingDbImportStatusPayload,
} from '../../api/stagingDbImport';
import { isAuthSessionExpiredError } from '../../api/auth';

type Props = {
  open: boolean;
  onClose: () => void;
  token: string | null;
  onSessionExpired?: () => void;
};

export function AdminStagingDbImportModal({ open, onClose, token, onSessionExpired }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobView, setJobView] = useState<StagingDbImportStatusPayload | null>(null);
  const [preflight, setPreflight] = useState<StagingDbImportPreflightPayload | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword('');
      setError(null);
      setBusy(false);
      setJobId(null);
      setJobView(null);
      setPreflight(null);
      setPreflightLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !token || jobId) return;
    let cancelled = false;
    setPreflightLoading(true);
    void getStagingDbImportPreflight(token)
      .then((p) => {
        if (!cancelled) setPreflight(p);
      })
      .catch((e) => {
        if (cancelled) return;
        if (isAuthSessionExpiredError(e)) {
          onSessionExpired?.();
          return;
        }
        setError(e instanceof Error ? e.message : '사전 점검을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setPreflightLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token, jobId, onSessionExpired]);

  useEffect(() => {
    if (!open || !token || !jobId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await getStagingDbImportStatus(token, jobId);
        if (cancelled) return;
        setJobView(s);
        if (s.status === 'done' || s.status === 'failed') {
          setBusy(false);
        }
      } catch (e) {
        if (cancelled) return;
        if (isAuthSessionExpiredError(e)) {
          onSessionExpired?.();
          return;
        }
        setError(e instanceof Error ? e.message : '상태를 불러오지 못했습니다.');
        setBusy(false);
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, token, jobId, onSessionExpired]);

  const submit = async () => {
    if (!token) return;
    const p = password.trim();
    if (!p) {
      setError('비밀번호를 입력해 주세요.');
      return;
    }
    setError(null);
    setBusy(true);
    setJobView(null);
    try {
      const { jobId: jid } = await postStagingDbImportStart(token, p);
      setJobId(jid);
    } catch (e) {
      if (isAuthSessionExpiredError(e)) {
        onSessionExpired?.();
        return;
      }
      setError(e instanceof Error ? e.message : '시작 요청에 실패했습니다.');
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="스테이징 DB 가져오기"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-2xl"
      >
        <h2 className="text-base font-semibold text-gray-900">운영 DB → 스테이징 복사</h2>
        <p className="mt-2 text-fluid-xs text-gray-600 leading-relaxed">
          스테이징 Postgres의 데이터가 <strong className="text-gray-800">덮어써집니다</strong>. 개발자 전용이며, 운영 DB는
          읽기만 합니다.
        </p>
        <ul className="mt-2 list-disc pl-4 text-fluid-2xs text-gray-500 space-y-0.5">
          <li>진행 중에는 스테이징 화면이 잠시 불안정할 수 있습니다.</li>
          <li>완료 후 브라우저를 새로고침해 주세요.</li>
        </ul>

        {preflightLoading ? (
          <p className="mt-3 text-fluid-xs text-gray-500">DB 연결 사전 점검 중…</p>
        ) : null}

        {preflight ? (
          <div className="mt-3 rounded border border-gray-100 bg-gray-50 px-3 py-2 text-fluid-2xs text-gray-700 space-y-2">
            <div>
              <p className="font-medium text-gray-800">운영(덤프 소스)</p>
              <p className="font-mono text-[11px] break-all">{preflight.sourceLabel}</p>
              <p>
                접수 {preflight.source.inquiryCount} · tenant {preflight.source.tenantCount} · user{' '}
                {preflight.source.userCount}
              </p>
              {preflight.source.tenantSlugs ? <p>tenants: {preflight.source.tenantSlugs}</p> : null}
            </div>
            <div>
              <p className="font-medium text-gray-800">스테이징(복원 대상)</p>
              <p className="font-mono text-[11px] break-all">{preflight.targetLabel}</p>
              <p>
                접수 {preflight.target.inquiryCount} · tenant {preflight.target.tenantCount} · user{' '}
                {preflight.target.userCount}
              </p>
              <p>앱이 보는 접수: {preflight.appInquiryCount >= 0 ? preflight.appInquiryCount : '(조회 실패)'}</p>
            </div>
            {preflight.warnings.length > 0 ? (
              <ul className="list-disc pl-4 text-amber-900 space-y-1">
                {preflight.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : (
              <p className="text-green-800">사전 점검 경고 없음 — 운영·스테이징 지표가 정상적으로 구분됩니다.</p>
            )}
          </div>
        ) : null}

        {jobView ? (
          <div className="mt-3 rounded border border-gray-100 bg-gray-50 px-3 py-2 text-fluid-xs text-gray-800">
            <p className="font-medium tabular-nums">상태: {jobView.status}</p>
            {jobView.message ? (
              <p className="mt-1 text-gray-600 whitespace-pre-wrap break-words text-left">{jobView.message}</p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-fluid-xs text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        {!jobId || jobView?.status === 'failed' ? (
          <label className="mt-3 block">
            <span className="mb-1 block text-fluid-xs text-gray-600">본인 비밀번호 확인</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy && Boolean(jobId)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="현재 로그인 계정 비밀번호"
            />
          </label>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700"
          >
            닫기
          </button>
          {!jobId || jobView?.status === 'failed' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="rounded bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
            >
              {busy && !jobView ? '시작 중…' : '가져오기 시작'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
