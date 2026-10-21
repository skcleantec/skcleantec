import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  fetchTeamLeaderTrainingFileLinks,
  fetchTeamLeaderTrainingMeta,
  type TeamLeaderTrainingMeta,
} from '../../api/teamLeaderTraining';
import { isAuthSessionExpiredError } from '../../api/auth';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { clearTeamToken, getTeamToken } from '../../stores/teamAuth';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useIsLgUp } from '../../hooks/useMediaQuery';
import { isCbiseoStaffNativeApp } from '../../utils/cbiseoNativeApp';
import { teamPreviewDepsKey, useTeamPreviewStaleGuard } from '../../utils/teamPreviewQuery';

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

/** 업무 앱은 새 창 PDF를 막으므로 휴대폰 기본 앱에서 연다. 브라우저에서는 링크 그대로. */
function openTrainingFile(event: { preventDefault: () => void }, url: string) {
  const openExternal = window.CbiseoApp?.openExternalUrl;
  if (typeof openExternal === 'function') {
    event.preventDefault();
    openExternal(url);
    return;
  }
  if (isCbiseoStaffNativeApp()) {
    event.preventDefault();
    window.location.assign(url);
  }
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
  const [linksLoading, setLinksLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

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
    if (!meta?.available || !token) return;
    const startedKey = capturePreviewKey();
    let cancelled = false;
    const load = (quiet: boolean) => {
      if (!quiet) setLinksLoading(true);
      fetchTeamLeaderTrainingFileLinks(token)
        .then((paths) => {
          if (cancelled || isPreviewFetchStale(startedKey)) return;
          setOpenUrl(`${window.location.origin}${paths.openPath}`);
          setDownloadUrl(`${window.location.origin}${paths.downloadPath}`);
          setLinksLoading(false);
        })
        .catch((e) => {
          if (cancelled || isPreviewFetchStale(startedKey)) return;
          setLinksLoading(false);
          if (!quiet) handlePdfError(e);
        });
    };
    load(false);
    const timer = window.setInterval(() => load(true), 10 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [meta?.available, token, handlePdfError, capturePreviewKey, isPreviewFetchStale]);

  const updatedLabel = formatUpdatedAt(meta?.updatedAt ?? null);
  const showDesktopViewer = isLgUp && Boolean(openUrl) && !linksLoading;

  return (
    <div className="min-w-0 w-full max-w-full flex flex-col gap-2 pb-4 sm:gap-4 lg:pb-8">
      <div className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm sm:rounded-2xl sm:p-5">
        <PageTitleWithFavorite label="현장팀장 교육자료">
          <h1>현장팀장 교육자료</h1>
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
        <div className="flex flex-col gap-2 sm:gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:rounded-2xl sm:p-5">
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
            {openUrl && downloadUrl && !linksLoading ? (
              <>
                <a
                  href={openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => openTrainingFile(event, openUrl)}
                  className="inline-flex min-h-[3rem] w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 py-3 text-fluid-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 active:scale-[0.99]"
                >
                  교육자료 열기
                </a>
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => openTrainingFile(event, downloadUrl)}
                  className="inline-flex min-h-[3rem] w-full touch-manipulation items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 active:scale-[0.99]"
                >
                  파일 저장
                </a>
              </>
            ) : (
              <p className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-fluid-sm text-gray-500">
                {err ? '교육자료를 열 수 없습니다.' : '불러오는 중…'}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {!loading && meta?.available && isLgUp ? (
        <div className="min-w-0 flex flex-col gap-3">
          {linksLoading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-fluid-sm text-gray-500">
              PDF 불러오는 중…
            </div>
          ) : null}

          {showDesktopViewer && openUrl && downloadUrl ? (
            <>
              <div className="flex flex-wrap gap-2">
                <a
                  href={openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => openTrainingFile(event, openUrl)}
                  className="inline-flex items-center rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                >
                  새 탭에서 열기
                </a>
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => openTrainingFile(event, downloadUrl)}
                  className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-xs font-medium text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
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
                  src={openUrl}
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
