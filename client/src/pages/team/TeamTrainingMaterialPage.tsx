import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  fetchTeamLeaderTrainingMeta,
  fetchTeamLeaderTrainingPdfBlob,
  type TeamLeaderTrainingMeta,
} from '../../api/teamLeaderTraining';
import { isAuthSessionExpiredError } from '../../api/auth';
import { clearTeamToken, getTeamToken } from '../../stores/teamAuth';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { teamPreviewDepsKey, useTeamPreviewStaleGuard } from '../../utils/teamPreviewQuery';

function formatUpdatedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export function TeamTrainingMaterialPage() {
  useDocumentTitle('현장팀장 교육자료');
  const navigate = useNavigate();
  const location = useLocation();
  const previewKey = teamPreviewDepsKey(location.search);
  const token = getTeamToken();
  const { capturePreviewKey, isPreviewFetchStale } = useTeamPreviewStaleGuard(previewKey);

  const [meta, setMeta] = useState<TeamLeaderTrainingMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const pdfUrlRef = useRef<string | null>(null);

  const revokePdfUrl = useCallback(() => {
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }
    setPdfUrl(null);
  }, []);

  const loadPdf = useCallback(async () => {
    if (!token) return;
    setPdfLoading(true);
    setErr(null);
    try {
      const blob = await fetchTeamLeaderTrainingPdfBlob(token);
      revokePdfUrl();
      const url = URL.createObjectURL(blob);
      pdfUrlRef.current = url;
      setPdfUrl(url);
    } catch (e) {
      if (isAuthSessionExpiredError(e)) {
        clearTeamToken();
        navigate('/login', { replace: true, state: { sessionExpired: true } });
        return;
      }
      setErr(e instanceof Error ? e.message : '교육자료를 불러올 수 없습니다.');
    } finally {
      setPdfLoading(false);
    }
  }, [token, navigate, revokePdfUrl]);

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    const startedKey = capturePreviewKey();
    setLoading(true);
    setErr(null);
    fetchTeamLeaderTrainingMeta(token)
      .then((m) => {
        if (isPreviewFetchStale(startedKey)) return;
        setMeta(m);
        if (!m.available) {
          setErr('등록된 교육자료가 없습니다. 관리자에게 문의해 주세요.');
          setLoading(false);
          return;
        }
        setLoading(false);
        void loadPdf();
      })
      .catch((e) => {
        if (isPreviewFetchStale(startedKey)) return;
        if (isAuthSessionExpiredError(e)) {
          clearTeamToken();
          navigate('/login', { replace: true, state: { sessionExpired: true } });
          return;
        }
        setErr(e instanceof Error ? e.message : '교육자료 정보를 불러올 수 없습니다.');
        setLoading(false);
      });
  }, [token, navigate, capturePreviewKey, isPreviewFetchStale, loadPdf, previewKey]);

  useEffect(() => () => revokePdfUrl(), [revokePdfUrl]);

  const fileLabel = meta?.fileName?.trim() || '현장팀장 교육자료';
  const updatedLabel = formatUpdatedAt(meta?.updatedAt ?? null);

  return (
    <div className="min-w-0 w-full max-w-full flex flex-col gap-4 pb-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">현장팀장 교육자료</h1>
        <p className="mt-1 text-fluid-sm text-gray-600">
          팀장 전용 교육 PDF입니다. 현장에서 확인·복습할 때 사용하세요.
        </p>
        {updatedLabel ? (
          <p className="mt-2 text-fluid-xs text-gray-500">최종 업데이트: {updatedLabel}</p>
        ) : null}
      </div>

      {err ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-fluid-sm text-rose-800" role="alert">
          {err}
        </p>
      ) : null}

      {loading || pdfLoading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-fluid-sm text-gray-500">
          {loading ? '교육자료 확인 중…' : 'PDF 불러오는 중…'}
        </div>
      ) : null}

      {pdfUrl ? (
        <div className="min-w-0 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800"
            >
              새 탭에서 열기
            </a>
            <a
              href={pdfUrl}
              download={fileLabel.endsWith('.pdf') ? fileLabel : `${fileLabel}.pdf`}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-xs font-medium text-gray-800 hover:bg-gray-50"
            >
              다운로드
            </a>
          </div>
          <p className="text-fluid-2xs text-gray-500 lg:hidden">
            화면이 작으면 「새 탭에서 열기」를 이용하면 더 편합니다.
          </p>
          <div
            className="min-h-[60vh] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
            style={{ height: 'min(calc(100dvh - 14rem), 80vh)' }}
          >
            <iframe
              title={fileLabel}
              src={pdfUrl}
              className="block h-full w-full border-0 bg-white"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
