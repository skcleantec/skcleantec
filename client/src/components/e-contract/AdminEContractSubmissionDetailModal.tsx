import { useEffect, useState, useRef, useLayoutEffect, useCallback } from 'react';
import { getEContractSubmissionDetail, type EContractSubmissionDetailDto } from '../../api/adminEContract';
import { EContractBodyDisplay } from './EContractBodyDisplay';

type Props = {
  token: string | null;
  submissionId: string | null;
  open: boolean;
  onClose: () => void;
};

/** 체결 합본: 내부 max-height 없이 한 덩어리 스크롤 + (선택) 한 화면에 축소 */
function SubmissionContractReader({ bodyHtml, fitOneScreen }: { bodyHtml: string; fitOneScreen: boolean }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ cw: number; ch: number; s: number } | null>(null);

  const recompute = useCallback(() => {
    if (!fitOneScreen) return;
    const vp = viewportRef.current;
    const m = measureRef.current;
    if (!vp || !m) return;
    const ch = m.scrollHeight;
    const cw = m.scrollWidth;
    const vph = vp.clientHeight;
    const vpw = vp.clientWidth;
    if (ch < 8 || cw < 8 || vph < 8 || vpw < 8) return;
    const s = Math.min(1, (vph * 0.98) / ch, (vpw * 0.98) / cw);
    setFit((prev) => {
      if (prev && prev.cw === cw && prev.ch === ch && Math.abs(prev.s - s) < 0.0005) return prev;
      return { cw, ch, s };
    });
  }, [fitOneScreen]);

  useLayoutEffect(() => {
    if (!fitOneScreen) {
      setFit(null);
      return;
    }
    recompute();
  }, [fitOneScreen, recompute, bodyHtml]);

  useEffect(() => {
    if (!fitOneScreen) return;
    const vp = viewportRef.current;
    const m = measureRef.current;
    if (!vp || !m) return;
    const ro = new ResizeObserver(() => {
      window.requestAnimationFrame(recompute);
    });
    ro.observe(vp);
    ro.observe(m);
    const t = window.setTimeout(recompute, 120);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
    };
  }, [fitOneScreen, recompute]);

  if (!fitOneScreen) {
    return (
      <div ref={measureRef} className="min-w-0 rounded-md border border-gray-200 bg-white p-2">
        <EContractBodyDisplay body={bodyHtml} maxHeightClass="" />
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      className="mx-auto flex w-full min-w-0 max-w-full justify-center overflow-hidden rounded-md border border-gray-200 bg-white p-2"
      style={{ maxHeight: 'min(calc(96vh - 15.5rem), 78vh)', minHeight: 'min(220px, 40vh)' }}
    >
      {fit && fit.s > 0 ? (
        <div
          className="overflow-hidden"
          style={{
            width: Math.max(1, fit.cw * fit.s),
            height: Math.max(1, fit.ch * fit.s),
          }}
        >
          <div
            ref={measureRef}
            className="min-w-0"
            style={{
              width: fit.cw,
              transform: `scale(${fit.s})`,
              transformOrigin: 'top left',
            }}
          >
            <EContractBodyDisplay body={bodyHtml} maxHeightClass="" />
          </div>
        </div>
      ) : (
        <div ref={measureRef} className="min-w-0 w-full">
          <EContractBodyDisplay body={bodyHtml} maxHeightClass="" />
        </div>
      )}
    </div>
  );
}

export function AdminEContractSubmissionDetailModal({ token, submissionId, open, onClose }: Props) {
  const [detail, setDetail] = useState<EContractSubmissionDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [imageLightboxUrl, setImageLightboxUrl] = useState<string | null>(null);
  const [imageLightboxLabel, setImageLightboxLabel] = useState('');
  const [readerExpanded, setReaderExpanded] = useState(false);
  const [fitOneScreen, setFitOneScreen] = useState(false);

  useEffect(() => {
    if (!open) {
      setImageLightboxUrl(null);
      setImageLightboxLabel('');
      setReaderExpanded(false);
      setFitOneScreen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !token || !submissionId) {
      setDetail(null);
      setErr(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setDetail(null);
    void (async () => {
      try {
        const d = await getEContractSubmissionDetail(token, submissionId);
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : '불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, token, submissionId]);

  if (!open) return null;

  const signerEntered =
    detail?.payload &&
    typeof detail.payload === 'object' &&
    detail.payload !== null &&
    'signerEntered' in detail.payload &&
    typeof (detail.payload as { signerEntered?: unknown }).signerEntered === 'object' &&
    (detail.payload as { signerEntered: Record<string, unknown> }).signerEntered !== null
      ? (detail.payload as { signerEntered: Record<string, unknown> }).signerEntered
      : null;

  return (
    <>
      <div
        className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ec-submission-modal-title"
        onMouseDown={(ev) => {
          if (ev.target === ev.currentTarget) onClose();
        }}
      >
        <div
          className={`flex w-full flex-col overflow-hidden rounded-t-lg border border-gray-200 bg-white shadow-xl sm:rounded-lg ${
            readerExpanded && detail
              ? 'h-[96vh] max-h-[96vh] max-w-[min(1180px,99vw)]'
              : 'max-h-[min(92vh,900px)] max-w-3xl'
          }`}
        >
          <div className="flex shrink-0 flex-col gap-3 border-b border-gray-200 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 id="ec-submission-modal-title" className="text-fluid-md font-semibold text-gray-900">
                  최종 체결본
                </h2>
                <p className="mt-1 text-fluid-2xs text-gray-600">
                  아래 본문·다운로드 파일에는 <span className="font-medium text-gray-800">업체(갑) 표기·팀장(을) 입력·서명 이미지</span>가
                  반영된 확정 HTML입니다. (구버전 체결은 합본이 없을 수 있습니다.)
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-md px-3 py-1.5 text-fluid-sm text-gray-700 hover:bg-gray-100"
              >
                닫기
              </button>
            </div>
            {detail && !loading && !err ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-xs font-medium text-gray-900 hover:bg-gray-50"
                  onClick={() => {
                    const iframe = document.querySelector('iframe[title="계약서 미리보기"]') as HTMLIFrameElement;
                    if (iframe && iframe.contentWindow) {
                      iframe.contentWindow.focus();
                      iframe.contentWindow.print();
                    }
                  }}
                  title="PDF로 완벽한 페이지 나누기가 적용된 문서를 인쇄/다운로드합니다."
                >
                  인쇄 / PDF로 저장
                </button>
                <button
                  type="button"
                  disabled={!detail.selfieUrl}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-xs font-medium text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={() => {
                    if (detail.selfieUrl) {
                      setImageLightboxLabel('본인확인 셀카');
                      setImageLightboxUrl(detail.selfieUrl);
                    }
                  }}
                >
                  셀카 보기
                </button>
                <button
                  type="button"
                  disabled={!detail.signatureUrl}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-xs font-medium text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={() => {
                    if (detail.signatureUrl) {
                      setImageLightboxLabel('서명');
                      setImageLightboxUrl(detail.signatureUrl);
                    }
                  }}
                >
                  서명 보기
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-fluid-xs font-medium text-blue-900 hover:bg-blue-100"
                  onClick={() => setReaderExpanded((v) => !v)}
                >
                  {readerExpanded ? '보통 크기' : '문서만 넓게'}
                </button>
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-fluid-xs font-medium ${
                    fitOneScreen
                      ? 'border-violet-300 bg-violet-100 text-violet-900'
                      : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
                  }`}
                  onClick={() => setFitOneScreen((v) => !v)}
                >
                  {fitOneScreen ? '실제 크기(스크롤)' : '한 화면에 맞춤'}
                </button>
                </div>
                <p className="text-fluid-2xs text-gray-500">
                  ⚠️ 화면에 보이는 A4 페이지 형태 그대로 PDF로 저장할 수 있습니다. 상단의 <strong>「인쇄 / PDF로 저장」</strong>을 눌러 대상을 "PDF로 저장"으로 선택하세요.
                </p>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {loading ? (
              <p className="text-center text-fluid-sm text-gray-500">불러오는 중…</p>
            ) : err ? (
              <p className="text-center text-fluid-sm text-red-700">{err}</p>
            ) : detail ? (
              <div className="space-y-4">
                {!detail.mergedUsed ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-xs text-amber-900">
                    이 기록에는 체결 시점 합본 HTML이 없습니다. 아래는 해당 버전 계약 원문(갑 치환본)입니다. 신규 체결분은 합본이
                    저장됩니다.
                  </div>
                ) : null}

                <div className="min-w-0">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <div className="text-fluid-sm font-semibold text-gray-900">계약서(제출본)</div>
                      <p className="mt-0.5 text-fluid-2xs text-gray-500">
                        {fitOneScreen
                          ? '「한 화면에 맞춤」으로 본문·서명까지 한 뷰에 맞춥니다. 글자가 작으면 「실제 크기(스크롤)」로 바꾸세요.'
                          : '본문과 서명은 같은 문서 안에 이어집니다. 위에서 「한 화면에 맞춤」을 켜면 스크롤 없이 한 화면에 맞춥니다.'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 min-w-0">
                    <SubmissionContractReader bodyHtml={detail.bodyHtml} fitOneScreen={fitOneScreen} />
                  </div>
                </div>

                <details className="group rounded-lg border border-gray-200 bg-gray-50 open:bg-white">
                  <summary className="cursor-pointer list-none px-3 py-2.5 text-fluid-xs font-medium text-gray-800 marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden>▸</span>
                      <span className="group-open:hidden">체결 요약·을 입력·이미지 미리보기 펼치기</span>
                      <span className="hidden group-open:inline">체결 요약·을 입력·이미지 미리보기 접기</span>
                    </span>
                  </summary>
                  <div className="space-y-4 border-t border-gray-200 px-3 pb-3 pt-3">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-fluid-xs text-gray-800">
                      <div>
                        <span className="font-medium">계약 종류</span> — {detail.definitionTitle}
                      </div>
                      <div className="mt-1">
                        <span className="font-medium">팀장</span> — {detail.teamLeader.name}{' '}
                        <span className="text-gray-600">({detail.teamLeader.email})</span>
                      </div>
                      <div className="mt-1">
                        <span className="font-medium">버전</span> —{' '}
                        <span className="tabular-nums">{detail.versionOrdinal != null ? `v${detail.versionOrdinal}` : '—'}</span>
                        {detail.versionTitle ? ` · ${detail.versionTitle}` : null}
                      </div>
                      <div className="mt-1">
                        <span className="font-medium">체결 시각</span> —{' '}
                        <span className="tabular-nums">{new Date(detail.signedAt).toLocaleString('ko-KR')}</span>
                      </div>
                      {detail.signerIp ? (
                        <div className="mt-1 break-all text-gray-600">
                          <span className="font-medium text-gray-800">IP</span> — {detail.signerIp}
                        </div>
                      ) : null}
                      {detail.signerUserAgent ? (
                        <div className="mt-1 break-all text-gray-600">
                          <span className="font-medium text-gray-800">UA</span> — {detail.signerUserAgent}
                        </div>
                      ) : null}
                    </div>

                    {signerEntered ? (
                      <div className="rounded-lg border border-gray-200 p-3">
                        <div className="text-fluid-xs font-medium text-gray-800">을(팀장) 입력 요약</div>
                        <dl className="mt-2 grid gap-1 text-fluid-2xs text-gray-700 sm:grid-cols-2">
                          {typeof signerEntered.name === 'string' ? (
                            <>
                              <dt className="text-gray-500">성함</dt>
                              <dd className="truncate font-medium">{String(signerEntered.name)}</dd>
                            </>
                          ) : null}
                          {typeof signerEntered.residentRegistrationNumber === 'string' ? (
                            <>
                              <dt className="text-gray-500">주민등록번호</dt>
                              <dd className="font-mono tabular-nums">{String(signerEntered.residentRegistrationNumber)}</dd>
                            </>
                          ) : null}
                          {typeof signerEntered.addressLine === 'string' ? (
                            <>
                              <dt className="self-start text-gray-500">주소</dt>
                              <dd className="whitespace-pre-wrap break-words">{String(signerEntered.addressLine)}</dd>
                            </>
                          ) : null}
                          {typeof signerEntered.phone === 'string' ? (
                            <>
                              <dt className="text-gray-500">연락처</dt>
                              <dd className="tabular-nums">{String(signerEntered.phone)}</dd>
                            </>
                          ) : null}
                          {typeof signerEntered.freeTextNotes === 'string' && String(signerEntered.freeTextNotes).trim() ? (
                            <>
                              <dt className="self-start text-gray-500">추가 기재</dt>
                              <dd className="whitespace-pre-wrap break-words">{String(signerEntered.freeTextNotes)}</dd>
                            </>
                          ) : null}
                        </dl>
                      </div>
                    ) : null}

                    {(detail.selfieUrl || detail.signatureUrl) && (
                      <div>
                        <div className="text-fluid-xs font-medium text-gray-800">이미지 미리보기</div>
                        <p className="mt-1 text-fluid-2xs text-gray-500">
                          상단 「셀카 보기」「서명 보기」로 크게 볼 수 있습니다.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-4">
                          {detail.selfieUrl ? (
                            <div className="min-w-0">
                              <div className="text-fluid-2xs text-gray-500">셀카</div>
                              <button
                                type="button"
                                className="mt-1 block overflow-hidden rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                onClick={() => {
                                  setImageLightboxLabel('본인확인 셀카');
                                  setImageLightboxUrl(detail.selfieUrl);
                                }}
                              >
                                <img
                                  src={detail.selfieUrl}
                                  alt="본인 확인 셀카"
                                  className="max-h-40 w-auto object-contain"
                                />
                              </button>
                            </div>
                          ) : null}
                          {detail.signatureUrl ? (
                            <div className="min-w-0">
                              <div className="text-fluid-2xs text-gray-500">서명</div>
                              <button
                                type="button"
                                className="mt-1 block overflow-hidden rounded border border-gray-200 bg-white p-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                onClick={() => {
                                  setImageLightboxLabel('서명');
                                  setImageLightboxUrl(detail.signatureUrl);
                                }}
                              >
                                <img src={detail.signatureUrl} alt="서명" className="max-h-24 w-auto object-contain" />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {imageLightboxUrl ? (
        <div
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={imageLightboxLabel}
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) {
              setImageLightboxUrl(null);
              setImageLightboxLabel('');
            }
          }}
        >
          <div className="relative max-h-full max-w-full rounded-lg bg-white p-2 shadow-xl">
            <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-2 pb-2">
              <span className="text-fluid-sm font-medium text-gray-900">{imageLightboxLabel}</span>
              <div className="flex flex-wrap gap-2">
                <a
                  href={imageLightboxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-gray-300 px-3 py-1 text-fluid-xs text-gray-800 hover:bg-gray-50"
                >
                  새 탭에서 열기
                </a>
                <button
                  type="button"
                  className="rounded-md bg-gray-900 px-3 py-1 text-fluid-xs font-medium text-white hover:bg-gray-800"
                  onClick={() => {
                    setImageLightboxUrl(null);
                    setImageLightboxLabel('');
                  }}
                >
                  닫기
                </button>
              </div>
            </div>
            <div className="max-h-[min(80vh,720px)] overflow-auto p-2">
              <img
                src={imageLightboxUrl}
                alt={imageLightboxLabel}
                className="mx-auto max-h-[min(75vh,680px)] w-auto max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
