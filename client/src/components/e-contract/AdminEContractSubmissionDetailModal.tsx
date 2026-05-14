import { useEffect, useState } from 'react';
import { getEContractSubmissionDetail, type EContractSubmissionDetailDto } from '../../api/adminEContract';
import { EContractBodyDisplay } from './EContractBodyDisplay';
import { sanitizeEContractHtml } from '../../utils/sanitizeEContractHtml';

type Props = {
  token: string | null;
  submissionId: string | null;
  open: boolean;
  onClose: () => void;
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeFileSegment(raw: string, max = 56): string {
  const t = raw.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/_+/g, '_').trim();
  return (t.length ? t : 'contract').slice(0, max);
}

function downloadSubmissionHtml(detail: EContractSubmissionDetailDto): void {
  const inner = sanitizeEContractHtml(detail.bodyHtml);
  const title = esc(`${detail.definitionTitle} — 체결 제출본`);
  const meta = esc(
    `${detail.teamLeader.name} (${detail.teamLeader.email}) · ${new Date(detail.signedAt).toLocaleString('ko-KR')}`
  );
  const doc = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;padding:20px;max-width:920px;margin:0 auto;line-height:1.55;color:#111827;}
h1{font-size:1.2rem;font-weight:600;margin:0 0 12px;}
.ec-meta{font-size:13px;color:#4b5563;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid #e5e7eb;}
</style>
</head>
<body>
<h1>${title}</h1>
<div class="ec-meta">${meta}</div>
<div class="e-contract-body-html">${inner || '<p>(본문 없음)</p>'}</div>
</body>
</html>`;
  const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = detail.signedAt.slice(0, 19).replace(/[T:]/g, '-');
  a.href = url;
  a.download = `${safeFileSegment(detail.definitionTitle)}_${stamp}.html`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function printSubmissionHtml(detail: EContractSubmissionDetailDto): void {
  const inner = sanitizeEContractHtml(detail.bodyHtml);
  const title = esc(`${detail.definitionTitle} — 체결 제출본`);
  const meta = esc(
    `${detail.teamLeader.name} (${detail.teamLeader.email}) · ${new Date(detail.signedAt).toLocaleString('ko-KR')}`
  );
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) {
    window.alert('팝업이 차단되어 인쇄 창을 열 수 없습니다. 브라우저에서 팝업을 허용해 주세요.');
    return;
  }
  w.document.open();
  w.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<title>${title}</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;padding:20px;line-height:1.55;color:#111827;}
h1{font-size:1.15rem;font-weight:600;}
.ec-meta{font-size:13px;color:#4b5563;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e5e7eb;}
@media print { body { padding: 12px; } }
</style>
</head>
<body>
<h1>${title}</h1>
<div class="ec-meta">${meta}</div>
<div class="e-contract-body-html">${inner || '<p>(본문 없음)</p>'}</div>
</body>
</html>`);
  w.document.close();
  w.focus();
  window.setTimeout(() => {
    try {
      w.print();
    } catch {
      /* ignore */
    }
  }, 300);
}

export function AdminEContractSubmissionDetailModal({ token, submissionId, open, onClose }: Props) {
  const [detail, setDetail] = useState<EContractSubmissionDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [imageLightboxUrl, setImageLightboxUrl] = useState<string | null>(null);
  const [imageLightboxLabel, setImageLightboxLabel] = useState('');

  useEffect(() => {
    if (!open) {
      setImageLightboxUrl(null);
      setImageLightboxLabel('');
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
        <div className="flex max-h-[min(92vh,900px)] w-full max-w-3xl flex-col rounded-t-lg border border-gray-200 bg-white shadow-xl sm:rounded-lg">
          <div className="flex shrink-0 flex-col gap-3 border-b border-gray-200 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <h2 id="ec-submission-modal-title" className="text-fluid-md font-semibold text-gray-900">
                체결 제출본 — 상세
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-md px-3 py-1.5 text-fluid-sm text-gray-700 hover:bg-gray-100"
              >
                닫기
              </button>
            </div>
            {detail && !loading && !err ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-xs font-medium text-gray-900 hover:bg-gray-50"
                  onClick={() => downloadSubmissionHtml(detail)}
                >
                  HTML 다운로드
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-xs font-medium text-gray-900 hover:bg-gray-50"
                  onClick={() => printSubmissionHtml(detail)}
                >
                  인쇄 / PDF 저장
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
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {loading ? (
              <p className="text-center text-fluid-sm text-gray-500">불러오는 중…</p>
            ) : err ? (
              <p className="text-center text-fluid-sm text-red-700">{err}</p>
            ) : detail ? (
              <div className="space-y-6">
                {!detail.mergedUsed ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-xs text-amber-900">
                    이 기록에는 체결 시점 합본 HTML이 없습니다. 아래는 해당 버전 계약 원문(갑 치환본)입니다. 신규 체결분은 합본이
                    저장됩니다.
                  </div>
                ) : null}

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

                <div>
                  <div className="text-fluid-xs font-medium text-gray-800">계약 문안(제출본)</div>
                  <div className="mt-2 min-w-0 rounded-md border border-gray-200 bg-white p-2">
                    <EContractBodyDisplay body={detail.bodyHtml} maxHeightClass="max-h-[50vh]" />
                  </div>
                </div>

                {(detail.selfieUrl || detail.signatureUrl) && (
                  <div>
                    <div className="text-fluid-xs font-medium text-gray-800">미리보기</div>
                    <p className="mt-1 text-fluid-2xs text-gray-500">상단 「셀카 보기」「서명 보기」로 크게 볼 수 있습니다.</p>
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
