import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getEContractSubmissionDetail,
  patchEContractSubmissionMedia,
  uploadEContractSubmissionMedia,
  type EContractSubmissionDetailDto,
} from '../../api/adminEContract';
import { ConfirmPasswordModal } from '../admin/ConfirmPasswordModal';
import { eContractRecipientRoleLabel } from '../../utils/eContractDisplay';
import { EContractPagedIframeReader } from './EContractPagedIframeReader';
import { SignaturePad } from './SignaturePad';
import { downloadPagedIframeAsPdf, sanitizeEContractPdfFilenameBase } from './downloadPagedIframePdf';
import { normalizeContractBodyForPaged } from './eContractPagedHtml';

type Props = {
  token: string | null;
  submissionId: string | null;
  open: boolean;
  onClose: () => void;
};

export function AdminEContractSubmissionDetailModal({ token, submissionId, open, onClose }: Props) {
  const [detail, setDetail] = useState<EContractSubmissionDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mediaPanel, setMediaPanel] = useState<'selfie' | 'signature' | null>(null);
  const [readerExpanded, setReaderExpanded] = useState(false);
  const [pagedReady, setPagedReady] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const selfieInputRef = useRef<HTMLInputElement | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaMsg, setMediaMsg] = useState<string | null>(null);
  const [pendingSelfie, setPendingSelfie] = useState<{ publicId: string; secureUrl: string } | null>(null);
  const [pendingSignature, setPendingSignature] = useState<{ publicId: string; secureUrl: string } | null>(null);
  const [mediaConfirmOpen, setMediaConfirmOpen] = useState(false);
  const [mediaConfirmKind, setMediaConfirmKind] = useState<'selfie' | 'signature' | null>(null);

  const recipientDisplayName =
    detail?.recipientName?.trim() ||
    detail?.teamMember?.name?.trim() ||
    detail?.teamLeader?.name?.trim() ||
    detail?.recipientLabel?.trim() ||
    '—';
  const recipientRoleLabel = eContractRecipientRoleLabel(detail?.recipientRole ?? detail?.teamLeader?.role);
  const recipientContact =
    detail?.teamLeader?.email?.trim() ||
    detail?.teamMember?.phone?.trim() ||
    '';

  const pdfFilenameBase = useMemo(() => {
    if (!detail) return '계약서';
    const vo = detail.versionOrdinal != null ? `v${detail.versionOrdinal}` : 'v';
    return sanitizeEContractPdfFilenameBase(`${detail.definitionTitle}_${vo}_${detail.id}`);
  }, [detail]);

  /** 체결 화면(EContractPagedPreviewModal)과 동일한 본문 정규화 */
  const pagedBodyHtml = useMemo(
    () => normalizeContractBodyForPaged(detail?.bodyHtml ?? ''),
    [detail?.bodyHtml],
  );

  useEffect(() => {
    if (!open) {
      setMediaPanel(null);
      setReaderExpanded(false);
      setPagedReady(false);
      setPdfBusy(false);
      setMediaBusy(false);
      setMediaMsg(null);
      setPendingSelfie(null);
      setPendingSignature(null);
      setMediaConfirmOpen(false);
      setMediaConfirmKind(null);
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
    setPagedReady(false);
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

  async function runPdfDownload(): Promise<void> {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) {
      window.alert('미리보기가 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    setPdfBusy(true);
    try {
      await downloadPagedIframeAsPdf(iframe, pdfFilenameBase);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'PDF를 저장하지 못했습니다.');
    } finally {
      setPdfBusy(false);
    }
  }

  async function onSelfieReplaceSelected(files: FileList | null) {
    if (!token || !submissionId || !files?.[0]) return;
    const f = files[0];
    setMediaBusy(true);
    setMediaMsg(null);
    try {
      const up = await uploadEContractSubmissionMedia(token, submissionId, f, f.name || 'selfie.jpg');
      setPendingSelfie(up);
      setMediaMsg('새 셀카를 올렸습니다. 「저장」을 눌러 반영해 주세요.');
    } catch (e) {
      setMediaMsg(e instanceof Error ? e.message : '셀카 업로드에 실패했습니다.');
    } finally {
      setMediaBusy(false);
    }
  }

  async function onSignatureReplaceSaved(blob: Blob) {
    if (!token || !submissionId) return;
    setMediaBusy(true);
    setMediaMsg(null);
    try {
      const up = await uploadEContractSubmissionMedia(
        token,
        submissionId,
        blob,
        `signature_${Date.now()}.png`,
      );
      setPendingSignature(up);
      setMediaMsg('새 서명을 올렸습니다. 「교체 저장」을 눌러 반영해 주세요.');
    } catch (e) {
      setMediaMsg(e instanceof Error ? e.message : '서명 업로드에 실패했습니다.');
      throw e;
    } finally {
      setMediaBusy(false);
    }
  }

  function closeMediaPanel() {
    setMediaPanel(null);
    setMediaMsg(null);
  }

  async function confirmMediaReplace(password: string) {
    if (!token || !submissionId || !mediaConfirmKind) return;
    if (mediaConfirmKind === 'selfie' && !pendingSelfie) {
      throw new Error('교체할 셀카를 먼저 선택해 주세요.');
    }
    if (mediaConfirmKind === 'signature' && !pendingSignature) {
      throw new Error('교체할 서명을 먼저 그려 주세요.');
    }
    setMediaBusy(true);
    setMediaMsg(null);
    try {
      const updated = await patchEContractSubmissionMedia(token, submissionId, {
        password,
        ...(mediaConfirmKind === 'selfie' && pendingSelfie
          ? { selfiePublicId: pendingSelfie.publicId, selfieUrl: pendingSelfie.secureUrl }
          : {}),
        ...(mediaConfirmKind === 'signature' && pendingSignature
          ? { signaturePublicId: pendingSignature.publicId, signatureUrl: pendingSignature.secureUrl }
          : {}),
      });
      setDetail(updated);
      setPagedReady(false);
      if (mediaConfirmKind === 'selfie') setPendingSelfie(null);
      if (mediaConfirmKind === 'signature') setPendingSignature(null);
      setMediaMsg(
        mediaConfirmKind === 'selfie'
          ? '셀카를 교체했습니다.'
          : '서명을 교체했습니다. PDF는 다시 저장해 주세요.',
      );
    } finally {
      setMediaBusy(false);
    }
  }

  const selfieDisplayUrl = pendingSelfie?.secureUrl ?? detail?.selfieUrl ?? null;
  const signatureDisplayUrl = pendingSignature?.secureUrl ?? detail?.signatureUrl ?? null;

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
              : 'max-h-[min(94vh,1000px)] max-w-3xl'
          }`}
        >
          <div className="flex shrink-0 flex-col gap-3 border-b border-gray-200 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 id="ec-submission-modal-title" className="text-fluid-md font-semibold text-gray-900">
                  최종 체결본
                </h2>
                <p className="mt-1 text-fluid-2xs text-gray-600">
                  아래 미리보기는 <span className="font-medium text-gray-800">실제 A4 인쇄 페이지</span>로 분할되어 표시됩니다.
                  각 페이지 머리말에 <span className="font-medium">문서 확인 번호</span>, 꼬리말에 <span className="font-medium">현재/전체 페이지 번호</span>가
                  자동으로 들어갑니다. 부록 「본인확인번호」는 셀카에 함께 찍은 6자리와 동일합니다.
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
                    onClick={() => void runPdfDownload()}
                    disabled={!pagedReady || pdfBusy}
                    className="rounded-lg border border-gray-900 bg-gray-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                    title="현재 미리보기를 PDF 파일로 저장합니다"
                  >
                    {pagedReady ? (pdfBusy ? 'PDF 생성 중…' : 'PDF로 저장') : '페이지 준비 중…'}
                  </button>
                  <button
                    type="button"
                    disabled={!detail.selfieUrl}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-xs font-medium text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={() => setMediaPanel('selfie')}
                  >
                    셀카 보기
                  </button>
                  <button
                    type="button"
                    disabled={!detail.signatureUrl}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-xs font-medium text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={() => setMediaPanel('signature')}
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
                </div>
                <p className="text-fluid-2xs text-gray-500">
                  「PDF로 저장」은 인쇄 창 없이 파일로 받습니다. 페이지가 많으면 수십 초 걸릴 수 있습니다.
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

                {detail.challengeDigits ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-fluid-2xs font-medium text-amber-950">본인확인 번호 (셀카·계약서 부록 공통)</div>
                        <div className="mt-0.5 text-fluid-2xs text-amber-900/90">
                          아래 계약서 부록 (을) 표와 「셀카 보기」 사진에 이 번호가 함께 있어야 합니다.
                        </div>
                      </div>
                      <span className="text-fluid-2xl font-bold tabular-nums tracking-wider text-gray-900">
                        {detail.challengeDigits}
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="min-w-0">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <div className="text-fluid-sm font-semibold text-gray-900">계약서(제출본)</div>
                      <p className="mt-0.5 text-fluid-2xs text-gray-500">
                        본문·계약 당사자 정보·서명까지 한 문서로 묶여, 실제 A4 페이지 형태로 표시됩니다.
                      </p>
                    </div>
                    <div className="text-fluid-2xs text-gray-500">
                      문서 확인 번호 <span className="font-mono text-gray-700">{detail.id}</span>
                    </div>
                  </div>
                  <div className="mt-2 min-w-0">
                    <EContractPagedIframeReader
                      bodyHtml={pagedBodyHtml}
                      docId={detail.id}
                      title={`${detail.definitionTitle} - ${recipientDisplayName}`}
                      iframeRef={iframeRef}
                      onReadyChange={setPagedReady}
                    />
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
                        <span className="font-medium">{recipientRoleLabel}</span> — {recipientDisplayName}{' '}
                        {recipientContact ? (
                          <span className="text-gray-600">({recipientContact})</span>
                        ) : null}
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
                      {detail.challengeDigits ? (
                        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                          <div className="text-fluid-2xs font-medium text-amber-950">본인확인 번호 (셀카에 함께 촬영)</div>
                          <div className="mt-1 text-fluid-xl font-bold tabular-nums tracking-wider text-gray-900">
                            {detail.challengeDigits}
                          </div>
                          <p className="mt-1 text-fluid-2xs text-amber-900/90">
                            계약서 부록 (을) 표에도 동일 번호가 기록됩니다. 셀카 사진과 대조해 주세요.
                          </p>
                        </div>
                      ) : null}
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
                          상단 「셀카 보기」「서명 보기」에서 크게 보고 교체할 수 있습니다.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-4">
                          {detail.selfieUrl ? (
                            <div className="min-w-0">
                              <div className="text-fluid-2xs text-gray-500">
                                셀카
                                {detail.challengeDigits ? (
                                  <span className="ml-1 font-mono tabular-nums text-amber-900">
                                    (번호 {detail.challengeDigits})
                                  </span>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                className="mt-1 block overflow-hidden rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                onClick={() => setMediaPanel('selfie')}
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
                                onClick={() => setMediaPanel('signature')}
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

      {mediaPanel === 'selfie' && selfieDisplayUrl ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="본인확인 셀카"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) closeMediaPanel();
          }}
        >
          <div className="flex max-h-[min(94vh,900px)] w-full max-w-lg flex-col overflow-hidden rounded-t-xl bg-white shadow-xl sm:rounded-xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <div className="min-w-0">
                <h3 className="text-fluid-sm font-semibold text-gray-900">본인확인 셀카</h3>
                <p className="mt-0.5 text-fluid-2xs text-gray-500">체결 후 잘못 올린 셀카만 교체할 수 있습니다.</p>
                {detail?.challengeDigits ? (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5">
                    <span className="text-fluid-2xs font-medium text-amber-950">촬영 번호</span>
                    <span className="text-fluid-md font-bold tabular-nums tracking-wider text-gray-900">
                      {detail.challengeDigits}
                    </span>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="shrink-0 rounded-md px-3 py-1.5 text-fluid-xs text-gray-700 hover:bg-gray-100"
                onClick={closeMediaPanel}
              >
                닫기
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                <img
                  src={selfieDisplayUrl}
                  alt="본인 확인 셀카"
                  className="mx-auto max-h-[min(50vh,420px)] w-full object-contain"
                />
              </div>
              {pendingSelfie ? (
                <p className="mt-2 text-fluid-2xs font-medium text-amber-800">새 사진이 선택되었습니다. 저장을 눌러 반영해 주세요.</p>
              ) : null}
              {mediaMsg && mediaPanel === 'selfie' ? (
                <p className="mt-2 text-fluid-2xs text-gray-700">{mediaMsg}</p>
              ) : null}
            </div>

            {token ? (
              <div className="shrink-0 space-y-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
                <input
                  ref={selfieInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(ev) => {
                    void onSelfieReplaceSelected(ev.target.files);
                    ev.target.value = '';
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={mediaBusy}
                    onClick={() => selfieInputRef.current?.click()}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-fluid-xs font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {mediaBusy ? '업로드 중…' : '사진 교체'}
                  </button>
                  <a
                    href={selfieDisplayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-fluid-xs font-medium text-gray-800 hover:bg-gray-50"
                  >
                    새 탭에서 열기
                  </a>
                  <button
                    type="button"
                    disabled={mediaBusy || !pendingSelfie}
                    onClick={() => {
                      setMediaConfirmKind('selfie');
                      setMediaConfirmOpen(true);
                    }}
                    className="ml-auto rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    저장
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {mediaPanel === 'signature' && signatureDisplayUrl ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="서명"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) closeMediaPanel();
          }}
        >
          <div className="flex max-h-[min(94vh,900px)] w-full max-w-lg flex-col overflow-hidden rounded-t-xl bg-white shadow-xl sm:rounded-xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <div className="min-w-0">
                <h3 className="text-fluid-sm font-semibold text-gray-900">서명</h3>
                <p className="mt-0.5 text-fluid-2xs text-gray-500">
                  아래에서 새로 그리면 PDF·최종본 부록의 (을) 서명도 함께 갱신됩니다.
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-md px-3 py-1.5 text-fluid-xs text-gray-700 hover:bg-gray-100"
                onClick={closeMediaPanel}
              >
                닫기
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white p-2">
                <img
                  src={signatureDisplayUrl}
                  alt="현재 서명"
                  className="mx-auto max-h-28 w-full object-contain"
                />
              </div>
              {pendingSignature ? (
                <p className="mt-2 text-fluid-2xs font-medium text-amber-800">새 서명이 준비되었습니다. 교체 저장을 눌러 반영해 주세요.</p>
              ) : null}
              {mediaMsg && mediaPanel === 'signature' ? (
                <p className="mt-2 text-fluid-2xs text-gray-700">{mediaMsg}</p>
              ) : null}

              {token ? (
                <div className="mt-4">
                  <div className="text-fluid-2xs font-medium text-gray-800">새 서명 그리기</div>
                  <div className="mt-2">
                    <SignaturePad
                      busy={mediaBusy}
                      onSave={onSignatureReplaceSaved}
                      onClear={() => setPendingSignature(null)}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {token ? (
              <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <a
                    href={signatureDisplayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-fluid-xs font-medium text-gray-800 hover:bg-gray-50"
                  >
                    새 탭에서 열기
                  </a>
                  <button
                    type="button"
                    disabled={mediaBusy || !pendingSignature}
                    onClick={() => {
                      setMediaConfirmKind('signature');
                      setMediaConfirmOpen(true);
                    }}
                    className="ml-auto rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    교체 저장
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmPasswordModal
        open={mediaConfirmOpen}
        title={mediaConfirmKind === 'signature' ? '서명 교체' : '셀카 교체'}
        description={
          <p className="text-fluid-2xs text-gray-600">
            {mediaConfirmKind === 'signature'
              ? '체결 기록의 서명과 PDF 부록 서명을 교체합니다. 되돌릴 수 없으니 확인 후 진행해 주세요.'
              : '체결 기록의 본인확인 셀카를 교체합니다. 되돌릴 수 없으니 확인 후 진행해 주세요.'}
          </p>
        }
        confirmLabel={mediaConfirmKind === 'signature' ? '교체 저장' : '저장'}
        zIndexClassName="z-[95]"
        onClose={() => {
          setMediaConfirmOpen(false);
          setMediaConfirmKind(null);
        }}
        onConfirm={confirmMediaReplace}
      />
    </>
  );
}
