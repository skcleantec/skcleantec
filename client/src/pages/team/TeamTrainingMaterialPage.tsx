import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  fetchTeamLeaderTrainingMeta,
  fetchTeamLeaderTrainingPdfBlob,
  type TeamLeaderTrainingMeta,
} from '../../api/teamLeaderTraining';
import { isAuthSessionExpiredError } from '../../api/auth';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { clearTeamToken, getTeamToken } from '../../stores/teamAuth';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useIsLgUp } from '../../hooks/useMediaQuery';
import { teamPreviewDepsKey, useTeamPreviewStaleGuard } from '../../utils/teamPreviewQuery';

const DOWNLOAD_NAME = '현장팀장 교육자료.pdf';

function formatUpdatedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function PdfOpenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3v4a2 2 0 002 2h4M9 13h6M9 17h4" />
    </svg>
  );
}

export function TeamTrainingMaterialPage() {
  useDocumentTitle('현장팀장 교육자료');
  const navigate = useNavigate();
  const location = useLocation();
  const isLgUp = useIsLgUp();
  const previewKey = teamPreviewDepsKey(location.search);
  const token = getTeamToken();
  const { capturePreviewKey, isPreviewFetchStale } = useTeamPreviewStaleGuard(previewKey);

  const [meta, setMeta] = useState<TeamLeaderTrainingMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [mobileAction, setMobileAction] = useState<'open' | 'download' | null>(null);
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

  const handlePdfError = useCallback(
    (e: unknown) => {
      if (isAuthSessionExpiredError(e)) {
        clearTeamToken();
        navigate('/login', { replace: true, state: { sessionExpired: true } });
        return;
      }
      setErr(e instanceof Error ? e.message : '교육자료를 불러올 수 없습니다.');
    },
    [navigate],
  );

  const ensurePdfBlob = useCallback(async (): Promise<string> => {
    if (pdfUrlRef.current) return pdfUrlRef.current;
    if (!token) throw new Error('로그인이 필요합니다.');
    setPdfLoading(true);
    setErr(null);
    try {
      const blob = await fetchTeamLeaderTrainingPdfBlob(token);
      revokePdfUrl();
      const url = URL.createObjectURL(blob);
      pdfUrlRef.current = url;
      setPdfUrl(url);
      return url;
    } finally {
      setPdfLoading(false);
    }
  }, [token, revokePdfUrl]);

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
        }
        setLoading(false);
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
  }, [token, navigate, capturePreviewKey, isPreviewFetchStale, previewKey]);

  useEffect(() => {
    if (!meta?.available || !isLgUp || !token) return;
    const startedKey = capturePreviewKey();
    ensurePdfBlob().catch((e) => {
      if (isPreviewFetchStale(startedKey)) return;
      handlePdfError(e);
    });
  }, [meta?.available, isLgUp, token, ensurePdfBlob, handlePdfError, capturePreviewKey, isPreviewFetchStale]);

  useEffect(() => () => revokePdfUrl(), [revokePdfUrl]);

  const handleMobileOpen = async () => {
    setMobileAction('open');
    try {
      const url = await ensurePdfBlob();
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.click();
      }
    } catch (e) {
      handlePdfError(e);
    } finally {
      setMobileAction(null);
    }
  };

  const handleMobileDownload = async () => {
    setMobileAction('download');
    try {
      const url = await ensurePdfBlob();
      const a = document.createElement('a');
      a.href = url;
      a.download = DOWNLOAD_NAME;
      a.click();
    } catch (e) {
      handlePdfError(e);
    } finally {
      setMobileAction(null);
    }
  };

  const updatedLabel = formatUpdatedAt(meta?.updatedAt ?? null);
  const mobileBusy = pdfLoading || mobileAction !== null;
  const showDesktopViewer = isLgUp && Boolean(pdfUrl) && !pdfLoading;

  return (
    <div className="min-w-0 w-full max-w-full flex flex-col gap-3 sm:gap-4 pb-6 lg:pb-8">
      <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-5 shadow-sm">
        <PageTitleWithFavorite label="현장팀장 교육자료">
          <h1 className="text-base sm:text-lg font-semibold text-gray-900">현장팀장 교육자료</h1>
        </PageTitleWithFavorite>
        {updatedLabel ? (
          <p className="mt-1.5 sm:mt-2 text-fluid-sm text-gray-500">최종 업데이트: {updatedLabel}</p>
        ) : null}
      </div>

      {err ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-fluid-sm text-rose-800" role="alert">
          {err}
        </p>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-fluid-sm text-gray-500">
          교육자료 확인 중…
        </div>
      ) : null}

      {!loading && meta?.available && !isLgUp ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
                <PdfOpenIcon className="h-6 w-6" />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-fluid-sm font-medium text-slate-900">휴대폰에서 PDF 보기</p>
                <p className="mt-1 text-fluid-xs leading-relaxed text-slate-600">
                  아래 「교육자료 열기」를 누르면 휴대폰 기본 PDF 뷰어에서 열립니다. 확대·넘기기·북마크가
                  편합니다.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => void handleMobileOpen()}
              disabled={mobileBusy}
              className="inline-flex min-h-[3rem] w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 py-3 text-fluid-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]"
            >
              {mobileAction === 'open' ? '불러오는 중…' : '교육자료 열기'}
            </button>
            <button
              type="button"
              onClick={() => void handleMobileDownload()}
              disabled={mobileBusy}
              className="inline-flex min-h-[3rem] w-full touch-manipulation items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]"
            >
              {mobileAction === 'download' ? '준비 중…' : '파일 저장'}
            </button>
          </div>
        </div>
      ) : null}

      {!loading && meta?.available && isLgUp ? (
        <div className="min-w-0 flex flex-col gap-3">
          {pdfLoading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-fluid-sm text-gray-500">
              PDF 불러오는 중…
            </div>
          ) : null}

          {showDesktopViewer ? (
            <>
              <div className="flex flex-wrap gap-2">
                <a
                  href={pdfUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800"
                >
                  새 탭에서 열기
                </a>
                <a
                  href={pdfUrl!}
                  download={DOWNLOAD_NAME}
                  className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-xs font-medium text-gray-800 hover:bg-gray-50"
                >
                  다운로드
                </a>
              </div>
              <div
                className="min-h-[480px] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
                style={{ height: 'min(calc(100dvh - 12rem), 85vh)' }}
              >
                <iframe
                  title="현장팀장 교육자료"
                  src={pdfUrl!}
                  className="block h-full w-full border-0 bg-white"
                />
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
