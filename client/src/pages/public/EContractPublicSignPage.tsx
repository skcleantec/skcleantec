import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import {
  fetchEContractPublicSession,
  submitEContractSign,
  uploadEContractBlob,
  type PublicSignFieldDto,
  type PublicSignSessionDto,
} from '../../api/eContractPublic';
import { EContractPagedPreviewModal } from '../../components/e-contract/EContractPagedPreviewModal';
import { EContractBodyDisplay } from '../../components/e-contract/EContractBodyDisplay';
import { EContractDynamicFieldInputs, emptyFieldValues } from '../../components/e-contract/EContractDynamicFieldInputs';
import { EC_SIGNER_ADDRESS_TOKEN } from '../../utils/eContractDisplay';
import { splitEContractSignerAddressValue } from '../../components/e-contract/eContractSignerAddressValue';
import { EContractSelfiePicker } from '../../components/e-contract/EContractSelfiePicker';
import { SignaturePad, type SignaturePadActions } from '../../components/e-contract/SignaturePad';
import { prepareImageFileForUpload } from '../../utils/imageResizeForUpload';
import { getTeamToken } from '../../stores/teamAuth';
import { useLoginScrollSurface } from '../../hooks/useMobileInputVisibility';

function TeamLeaderContractDocToolbar({
  onPreview,
  onPdfSave,
}: {
  onPreview: () => void;
  onPdfSave: () => void;
}) {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/90 px-3 py-3 shadow-sm">
      <div className="text-fluid-xs font-semibold text-blue-950">계약서 미리보기·PDF 저장</div>
      <p className="mt-1 text-fluid-2xs text-blue-900/80">
        A4 페이지 단위 미리보기 후 「PDF로 저장」을 누르면 인쇄 창 없이 파일로 받을 수 있습니다.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPreview}
          className="rounded-lg border border-blue-600 bg-white px-3 py-2 text-fluid-xs font-medium text-blue-900 hover:bg-blue-50 touch-manipulation"
        >
          미리보기
        </button>
        <button
          type="button"
          onClick={onPdfSave}
          className="rounded-lg border border-gray-900 bg-gray-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-gray-800 touch-manipulation"
        >
          PDF로 저장
        </button>
      </div>
    </div>
  );
}

const STEPS = ['계약서 읽기', '체결 정보 입력', '서명', '본인 확인', '확인하고 제출'] as const;
const FIELD_ID_PREFIX = 'ec-sign-all';

function fieldElementId(token: string): string {
  return `${FIELD_ID_PREFIX}-${token.replace(/[^\w]/g, '_')}`;
}

/** 아직 못 채운 첫 필수 칸 */
function firstFieldProblem(
  fields: PublicSignFieldDto[],
  values: Record<string, string>,
): { token: string; message: string } | null {
  for (const f of fields) {
    if (!f.required) continue;
    const raw = values[f.token] ?? '';
    if (f.inputType === 'CHECKBOX') {
      if (raw !== 'Y') return { token: f.token, message: `「${f.label}」에 체크해 주세요.` };
      continue;
    }
    if (f.token === EC_SIGNER_ADDRESS_TOKEN) {
      const { base } = splitEContractSignerAddressValue(raw);
      if (!base.trim()) return { token: f.token, message: '「주소 검색」으로 주소를 선택해 주세요.' };
      continue;
    }
    if (!raw.trim()) return { token: f.token, message: `「${f.label}」을(를) 입력해 주세요.` };
  }
  return null;
}

/** 확인 화면에 보여 줄 값 — 주민등록번호 뒷자리는 가린다 */
function summaryValue(f: PublicSignFieldDto, raw: string): string {
  const v = raw.trim();
  if (f.inputType === 'CHECKBOX') return v === 'Y' ? '체크함' : '체크 안 함';
  if (f.inputType === 'SEAL') return v ? '등록함' : '없음';
  if (!v) return '없음';
  if (f.inputType === 'RRN') {
    const digits = v.replace(/\D/g, '');
    return digits.length >= 6 ? `${digits.slice(0, 6)}-●●●●●●●` : '입력함';
  }
  if (f.token === EC_SIGNER_ADDRESS_TOKEN) {
    const { base, detail } = splitEContractSignerAddressValue(v);
    return [base, detail].map((x) => x.trim()).filter(Boolean).join(' ');
  }
  return v;
}

const BTN_NEXT =
  'inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-slate-900 px-3 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:bg-slate-200 disabled:text-slate-400';
const BTN_SUBMIT =
  'inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-blue-700 px-3 text-fluid-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:bg-slate-200 disabled:text-slate-400';
const BTN_PREV =
  'inline-flex min-h-11 w-20 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-fluid-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
/** 계약서 본문 — 휴대폰에서 읽기 좋은 글자 크기·줄 간격, 단어 중간에서 줄이 끊기지 않게 */
const READING_CLASS =
  '!text-[15px] !leading-[1.8] [word-break:keep-all] [overflow-wrap:anywhere] [&_p]:!my-2.5 [&_li]:!my-1.5 [&_h1]:!text-[17px] [&_h1]:!leading-snug [&_h2]:!text-[16px] [&_h2]:!leading-snug [&_h3]:!text-[15px] [&_h1]:mt-4 [&_h2]:mt-4 [&_h3]:mt-3 [&_strong]:font-semibold [&_table]:!text-[13px] [&_table]:!leading-snug [&_td]:[word-break:break-all] [&_img]:max-w-full [&_img]:h-auto';

export function EContractPublicSignPage() {
  const { token } = useParams<{ token: string }>();
  const decoded = decodeURIComponent(token || '').trim();

  const [session, setSession] = useState<PublicSignSessionDto | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selfieUploaded, setSelfieUploaded] = useState<{ publicId: string; secureUrl: string } | null>(null);
  const [selfieGuideOpen, setSelfieGuideOpen] = useState(false);
  /** 사진은 따로 제출 — 본인이 직접 체크해야 셀카 없이 제출된다 */
  const [selfieLater, setSelfieLater] = useState(false);
  const [sigUploaded, setSigUploaded] = useState<{ publicId: string; secureUrl: string } | null>(null);

  const [agree, setAgree] = useState(false);
  const [signerFieldValues, setSignerFieldValues] = useState<Record<string, string>>({});
  /** 0 계약서 읽기 · 1 정보 입력 · 2 서명 · 3 본인 확인 · 4 확인·제출 */
  const [step, setStep] = useState(0);
  const [readDone, setReadDone] = useState(false);
  const [submittedDeferred, setSubmittedDeferred] = useState(false);
  const sigPadRef = useRef<SignaturePadActions | null>(null);

  const lastIssuanceIdRef = useRef('');
  const [pagedPreviewOpen, setPagedPreviewOpen] = useState(false);
  const [pagedAutoPdfDownload, setPagedAutoPdfDownload] = useState(false);
  const { scrollRef, onFieldFocus } = useLoginScrollSurface();

  const load = useCallback(async () => {
    if (!decoded) return;
    setLoadErr(null);
    try {
      const s = await fetchEContractPublicSession(decoded);
      setSession(s);
    } catch (e) {
      setSession(null);
      setLoadErr(e instanceof Error ? e.message : '불러오지 못했습니다.');
    }
  }, [decoded]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    lastIssuanceIdRef.current = '';
  }, [decoded]);

  useEffect(() => {
    if (!session || session.alreadySigned) return;
    if (lastIssuanceIdRef.current !== session.issuanceId) {
      lastIssuanceIdRef.current = session.issuanceId;
      const initial = emptyFieldValues(session.signFields ?? []);
      for (const f of session.signFields ?? []) {
        if (f.prefill?.trim()) initial[f.token] = f.prefill.trim();
      }
      setSignerFieldValues(initial);
    }
  }, [session]);

  const onSelfieSelected = async (file: File | null) => {
    if (!decoded || !file) return;
    setBusy(true);
    setMsg(null);
    try {
      const prepared = await prepareImageFileForUpload(file);
      const up = await uploadEContractBlob(prepared, decoded, prepared.name || 'selfie.jpg');
      setSelfieUploaded(up);
      setSelfieGuideOpen(false);
      setMsg(null);
    } catch (e) {
      setSelfieUploaded(null);
      setMsg(e instanceof Error ? e.message : '셀카 업로드에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const savePublicSignature = async (blob: Blob) => {
    if (!decoded) return;
    setBusy(true);
    setMsg(null);
    try {
      const up = await uploadEContractBlob(blob, decoded, `signature_${Date.now()}.png`);
      setSigUploaded(up);
      setMsg(null);
    } catch (e) {
      setSigUploaded(null);
      setMsg(e instanceof Error ? e.message : '서명 업로드에 실패했습니다.');
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    if (!decoded || !session) return;
    const fields = session.signFields ?? [];
    for (const f of fields) {
      if (f.required && f.inputType === 'CHECKBOX' && signerFieldValues[f.token] !== 'Y') {
        setMsg(`「${f.label}」에 체크해 주세요.`);
        return;
      }
      if (f.required && f.token === EC_SIGNER_ADDRESS_TOKEN) {
        const { base } = splitEContractSignerAddressValue(signerFieldValues[f.token] ?? '');
        if (!base.trim()) {
          setMsg('「주소 검색」으로 주소를 선택해 주세요.');
          return;
        }
        continue;
      }
      if (f.required && !(signerFieldValues[f.token] ?? '').trim()) {
        setMsg(`「${f.label}」을(를) 입력해 주세요.`);
        return;
      }
    }
    if (fields.length === 0) {
      setMsg('입력할 항목이 없습니다. 관리자에게 문의해 주세요.');
      return;
    }
    if (!selfieUploaded && !selfieLater) {
      setMsg('본인 확인용 셀카를 올리거나, 「사진은 따로 제출하겠습니다」에 체크해 주세요.');
      return;
    }
    if (!sigUploaded) {
      setMsg('「서명을 이미지로 저장」을 눌러 서명 업로드를 먼저 완료해 주세요.');
      return;
    }
    if (!agree) {
      setMsg('계약 내용에 동의해 주세요.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await submitEContractSign(decoded, {
        signerFields: signerFieldValues,
        signerName: signerFieldValues['[[EC_SIGNER_NAME]]'] ?? '',
        signerResidentRegistrationNumber: signerFieldValues['[[EC_SIGNER_RRN]]'] ?? '',
        signerAddressLine: signerFieldValues['[[EC_SIGNER_ADDRESS]]'] ?? '',
        signerPhone: signerFieldValues['[[EC_SIGNER_PHONE]]'] ?? '',
        ...(signerFieldValues['[[EC_SIGNER_FREETEXT]]']?.trim()
          ? { signerFreeTextNotes: signerFieldValues['[[EC_SIGNER_FREETEXT]]'] }
          : {}),
        challengeEntered: session.challengeDigits, // UI input removed, submit the challenge digits directly
        agree,
        ...(selfieUploaded
          ? { selfiePublicId: selfieUploaded.publicId, selfieUrl: selfieUploaded.secureUrl }
          : { selfieDeferred: true }),
        signaturePublicId: sigUploaded.publicId,
        signatureUrl: sigUploaded.secureUrl,
      });
      setSubmittedDeferred(!selfieUploaded);
      await load();
      setMsg('체결을 완료했습니다.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '제출하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  /** 계약서를 끝까지 내렸는지 — 한 번 끝에 닿으면 계속 읽은 것으로 둔다 */
  const checkReadEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setReadDone(true);
  }, [scrollRef]);

  const signedOrMissing = !session || session.alreadySigned;
  useEffect(() => {
    if (signedOrMissing || step !== 0 || readDone) return;
    const el = scrollRef.current;
    if (!el) return;
    checkReadEnd();
    const ro = new ResizeObserver(() => checkReadEnd());
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [signedOrMissing, step, readDone, checkReadEnd, scrollRef]);

  const goStep = useCallback(
    (next: number) => {
      setMsg(null);
      setStep(Math.max(0, Math.min(STEPS.length - 1, next)));
      scrollRef.current?.scrollTo({ top: 0 });
    },
    [scrollRef],
  );

  const onNext = async () => {
    if (!session || busy) return;
    const fields = session.signFields ?? [];
    if (step === 0) {
      if (!readDone) return;
      goStep(1);
      return;
    }
    if (step === 1) {
      if (fields.length === 0) {
        setMsg('입력할 항목이 없습니다. 관리자에게 문의해 주세요.');
        return;
      }
      const problem = firstFieldProblem(fields, signerFieldValues);
      if (problem) {
        setMsg(problem.message);
        const el = document.getElementById(fieldElementId(problem.token));
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus({ preventScroll: true });
        return;
      }
      goStep(2);
      return;
    }
    if (step === 2) {
      if (sigUploaded) {
        goStep(3);
        return;
      }
      const ok = await sigPadRef.current?.save();
      if (ok) goStep(3);
      return;
    }
    if (step === 3) {
      if (!selfieUploaded && !selfieLater) {
        setMsg('사진을 올리거나, 「사진은 따로 제출하겠습니다」에 체크해 주세요.');
        return;
      }
      goStep(4);
    }
  };

  if (!decoded) {
    return <div className="p-6 text-center text-fluid-sm text-gray-600">링크가 올바르지 않습니다.</div>;
  }

  if (loadErr) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center px-4 py-10 text-center">
        <p className="text-fluid-sm text-red-700">{loadErr}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center px-4 py-10 text-center text-fluid-sm text-gray-600">
        불러오는 중…
      </div>
    );
  }

  const signFields = session.signFields ?? [];

  if (session.alreadySigned) {
    return (
      <>
        <div className="mx-auto min-h-[55vh] max-w-lg px-4 py-10">
          <h1 className="text-center text-fluid-lg font-semibold text-gray-900">이미 체결되었습니다</h1>
          <p className="mt-3 text-center text-fluid-sm text-gray-600">
            <span className="font-medium">{session.definitionTitle}</span> · 버전{' '}
            <span className="tabular-nums">v{session.versionOrdinal}</span>
          </p>
          {session.signedAtIso ? (
            <p className="mt-2 text-center text-fluid-sm text-gray-700">
              체결 시각:{' '}
              <span className="tabular-nums">{new Date(session.signedAtIso).toLocaleString('ko-KR')}</span>
            </p>
          ) : null}
          {submittedDeferred ? (
            <p
              className="mt-5 rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-3 text-left text-fluid-xs font-medium leading-relaxed text-gray-900"
              role="note"
            >
              본인 확인 사진을 아직 내지 않았습니다. 본인확인 번호{' '}
              <span className="font-bold tabular-nums">{session.challengeDigits}</span>와 얼굴이 함께 보이는 사진을 업체에
              보내 주세요.
            </p>
          ) : null}
          {getTeamToken() ? (
            <div className="mt-6 flex justify-center px-1">
              <Link
                to="/team/dashboard"
                className="inline-flex w-full max-w-sm justify-center rounded-lg bg-gray-900 px-4 py-3 text-center text-fluid-sm font-medium text-white shadow-sm hover:bg-gray-800 touch-manipulation sm:w-auto sm:min-w-[200px]"
              >
                메인화면으로 돌아가기
              </Link>
            </div>
          ) : null}
          {getTeamToken() ? (
            <div className="mt-4">
              <TeamLeaderContractDocToolbar
                onPreview={() => {
                  setPagedAutoPdfDownload(false);
                  setPagedPreviewOpen(true);
                }}
                onPdfSave={() => {
                  setPagedAutoPdfDownload(true);
                  setPagedPreviewOpen(true);
                }}
              />
            </div>
          ) : null}
          <section className="mt-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm text-left">
            <div className="text-fluid-xs font-medium text-gray-800">체결 계약문(확정본)</div>
            <p className="mt-1 text-fluid-2xs text-gray-500">제출 시점에 입력·서명이 반영된 문서입니다.</p>
            <div className="mt-3 min-w-0">
              <EContractBodyDisplay body={session.bodyMarkdown} maxHeightClass="max-h-[60vh]" />
            </div>
          </section>
        </div>
        {getTeamToken() ? (
          <EContractPagedPreviewModal
            open={pagedPreviewOpen}
            onClose={() => {
              setPagedPreviewOpen(false);
              setPagedAutoPdfDownload(false);
            }}
            bodyRaw={session.bodyMarkdown}
            docId={session.issuanceId}
            definitionTitle={session.definitionTitle}
            versionOrdinal={session.versionOrdinal}
            autoDownloadPdfOnReady={pagedAutoPdfDownload}
            onAutoDownloadPdfConsumed={() => setPagedAutoPdfDownload(false)}
          />
        ) : null}
      </>
    );
  }

  const isLast = step === STEPS.length - 1;
  const msgIsError = Boolean(msg);
  const nextLabel =
    step === 0
      ? readDone
        ? '다 읽었습니다 · 다음'
        : '끝까지 읽으면 다음으로 넘어갑니다'
      : step === 2
        ? busy
          ? '저장 중…'
          : sigUploaded
            ? '다음'
            : '서명 완료 · 다음'
        : step === 3 && !selfieUploaded && !selfieLater
          ? '사진을 올리거나 체크해 주세요'
          : '다음';
  const nextDisabled = busy || (step === 0 && !readDone) || (step === 3 && !selfieUploaded && !selfieLater);

  return (
    <>
      <div className="fixed inset-0 flex justify-center bg-slate-100">
        <div className="flex h-full w-full max-w-lg flex-col bg-slate-50 shadow-sm">
          <header className="shrink-0 border-b border-slate-200 bg-white px-4 pb-2.5 pt-[calc(env(safe-area-inset-top,0px)+10px)]">
            <p className="truncate text-fluid-xs text-slate-500">
              <span className="text-fluid-sm font-bold text-slate-900">{session.definitionTitle}</span>
              {' · '}
              {session.signerNameLabel} 님
            </p>
            <div className="mt-2 flex gap-1" aria-hidden>
              {STEPS.map((name, i) => (
                <span
                  key={name}
                  className={`h-1 flex-1 rounded-full ${i < step ? 'bg-slate-900' : i === step ? 'bg-blue-600' : 'bg-slate-200'}`}
                />
              ))}
            </div>
            <p className="mt-1.5 text-fluid-2xs font-semibold text-blue-700" aria-live="polite">
              {step + 1}/{STEPS.length} {STEPS[step]}
            </p>
          </header>

          <div
            ref={scrollRef}
            onFocusCapture={onFieldFocus}
            onScroll={step === 0 ? checkReadEnd : undefined}
            className="relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4"
          >
            {step === 0 ? (
              <div>
                {getTeamToken() ? (
                  <div className="mb-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPagedAutoPdfDownload(false);
                        setPagedPreviewOpen(true);
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-fluid-2xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      A4로 미리보기
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPagedAutoPdfDownload(true);
                        setPagedPreviewOpen(true);
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-fluid-2xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      PDF로 저장
                    </button>
                  </div>
                ) : null}
                {session.expiresAtIso ? (
                  <p className="mb-3 text-fluid-2xs text-amber-800">
                    링크 만료(참고): {new Date(session.expiresAtIso).toLocaleString('ko-KR')}
                  </p>
                ) : null}
                <div className="min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white px-4 py-4">
                  <EContractBodyDisplay body={session.bodyMarkdown} className={READING_CLASS} />
                </div>
                <p className="mt-3 text-center text-fluid-2xs text-slate-500">계약서의 끝입니다.</p>
              </div>
            ) : null}

            {step === 1 ? (
              <div>
                <p className="text-fluid-xs leading-relaxed text-slate-600">
                  위에서 아래로 차례대로 적어 주세요. 「(선택)」이 붙은 칸은 비워도 됩니다.
                </p>
                <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-4">
                  {signFields.length > 0 ? (
                    <EContractDynamicFieldInputs
                      fields={signFields}
                      values={signerFieldValues}
                      onChange={(t, v) => {
                        const field = signFields.find((f) => f.token === t);
                        setSignerFieldValues((prev) => {
                          if (field?.inputType !== 'SEAL') return { ...prev, [t]: v };
                          const next = { ...prev };
                          for (const f of signFields) if (f.inputType === 'SEAL') next[f.token] = v;
                          return next;
                        });
                      }}
                      uploadToken={decoded}
                      idPrefix={FIELD_ID_PREFIX}
                    />
                  ) : (
                    <p className="text-fluid-2xs text-amber-800">입력할 항목이 없습니다. 관리자에게 문의해 주세요.</p>
                  )}
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div>
                {sigUploaded ? (
                  <>
                    <p className="text-fluid-xs text-slate-600">저장된 서명입니다.</p>
                    <div className="mt-3 flex justify-center rounded-xl border border-slate-200 bg-white p-4">
                      <img src={sigUploaded.secureUrl} alt="저장된 서명" className="max-h-56 w-auto" />
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setSigUploaded(null)}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                      >
                        다시 쓰기
                      </button>
                    </div>
                  </>
                ) : (
                  <SignaturePad
                    busy={busy}
                    onSave={savePublicSignature}
                    onClear={() => setSigUploaded(null)}
                    hint="아래 칸 안에 손가락으로 서명해 주세요. 다 쓰고 「서명 완료 · 다음」을 누르면 저장됩니다."
                    canvasHeightClass="h-[min(46dvh,340px)]"
                    hideSaveButton
                    clearButtonLabel="다시 쓰기"
                    actionRef={sigPadRef}
                  />
                )}
              </div>
            ) : null}

            {step === 3 ? (
              <div>
                <p className="text-fluid-xs font-semibold text-slate-700">본인확인 번호</p>
                <div className="mt-2 rounded-xl border-2 border-dashed border-amber-500 bg-yellow-50 py-4 text-center">
                  <span className="text-fluid-4xl font-bold tabular-nums tracking-[0.2em] text-slate-900">
                    {session.challengeDigits}
                  </span>
                </div>
                <p
                  className="mt-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-3 text-center text-fluid-xs font-semibold leading-snug text-slate-950"
                  role="note"
                >
                  이 번호와 얼굴이 함께 보이게 찍어 주세요. 번호는 계약서 부록에도 기록됩니다.
                </p>
                {selfieUploaded ? (
                  <>
                    <div className="mt-4 flex justify-center">
                      <img
                        src={selfieUploaded.secureUrl}
                        alt="본인 확인 사진"
                        className="max-h-64 w-auto rounded-xl border border-slate-200"
                      />
                    </div>
                    <p className="mt-3 text-center text-fluid-2xs text-slate-500">다시 찍으려면 아래 버튼을 누르세요.</p>
                  </>
                ) : null}
                <div className="mt-4">
                  <EContractSelfiePicker busy={busy} onPicked={(file) => void onSelfieSelected(file)} />
                </div>
                <button
                  type="button"
                  onClick={() => setSelfieGuideOpen(true)}
                  className="mt-2 w-full py-1.5 text-center text-fluid-2xs font-medium text-blue-700 underline underline-offset-2"
                >
                  어떻게 찍는지 예시 보기
                </button>
                {selfieUploaded ? null : (
                  <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 bg-white px-3 py-3">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0"
                      checked={selfieLater}
                      disabled={busy}
                      onChange={(ev) => {
                        setSelfieLater(ev.target.checked);
                        setMsg(null);
                      }}
                    />
                    <span className="min-w-0 text-fluid-2xs leading-relaxed text-slate-700">
                      <span className="block text-fluid-xs font-semibold text-slate-950">사진은 따로 제출하겠습니다</span>
                      지금 올리지 않고 넘어갑니다. 위 번호와 얼굴이 함께 보이는 사진을 업체에 따로 보내 주셔야 본인
                      확인이 끝납니다.
                    </span>
                  </label>
                )}
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-3">
                <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-fluid-xs font-bold text-slate-900">체결 정보</h2>
                    <button type="button" onClick={() => goStep(1)} className="text-fluid-2xs font-semibold text-blue-700">
                      고치기
                    </button>
                  </div>
                  <dl className="mt-2 space-y-1.5 text-fluid-xs">
                    {signFields.map((f) => (
                      <div key={f.token} className="flex items-start justify-between gap-3">
                        <dt className="w-24 shrink-0 text-slate-500">{f.label}</dt>
                        <dd className="min-w-0 break-words text-right font-medium text-slate-900">
                          {summaryValue(f, signerFieldValues[f.token] ?? '')}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
                <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-fluid-xs font-bold text-slate-900">서명</h2>
                    <button
                      type="button"
                      onClick={() => {
                        setSigUploaded(null);
                        goStep(2);
                      }}
                      className="text-fluid-2xs font-semibold text-blue-700"
                    >
                      다시 쓰기
                    </button>
                  </div>
                  {sigUploaded ? (
                    <img src={sigUploaded.secureUrl} alt="서명" className="mx-auto mt-2 max-h-24 w-auto" />
                  ) : (
                    <p className="mt-2 text-fluid-2xs text-red-700">서명이 없습니다. 「다시 쓰기」를 눌러 주세요.</p>
                  )}
                </section>
                <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-fluid-xs font-bold text-slate-900">본인 확인 사진</h2>
                    <button type="button" onClick={() => goStep(3)} className="text-fluid-2xs font-semibold text-blue-700">
                      바꾸기
                    </button>
                  </div>
                  {selfieUploaded ? (
                    <img
                      src={selfieUploaded.secureUrl}
                      alt="본인 확인 사진"
                      className="mx-auto mt-2 max-h-32 w-auto rounded-lg border border-slate-200"
                    />
                  ) : (
                    <p className="mt-2">
                      <span className="inline-flex h-[22px] items-center rounded-full border border-[#f3d58a] bg-[#fff6dc] px-2 text-fluid-2xs font-semibold text-[#8a5a00]">
                        사진 따로 제출
                      </span>
                    </p>
                  )}
                </section>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 ${agree ? 'border-blue-600 bg-blue-50' : 'border-slate-300 bg-white'}`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0"
                    checked={agree}
                    onChange={(ev) => {
                      setAgree(ev.target.checked);
                      setMsg(null);
                    }}
                  />
                  <span className="min-w-0 text-fluid-2xs leading-relaxed text-slate-700">
                    <span className="block text-fluid-xs font-semibold text-slate-950">
                      계약 내용을 모두 읽었고 동의합니다
                    </span>
                    위 계약 내용 및 본인이 기재한 을 정보·서명·본인 확인 절차를 이해하였으며 동의합니다.
                  </span>
                </label>
              </div>
            ) : null}

            {step === 0 && !readDone ? (
              <div className="pointer-events-none sticky bottom-1 mt-2 flex justify-center">
                <span className="rounded-full bg-slate-900 px-3 py-1.5 text-fluid-2xs font-semibold text-white shadow-lg">
                  ↓ 아래로 내려 끝까지 읽어 주세요
                </span>
              </div>
            ) : null}
          </div>

          {msgIsError ? (
            <p
              className="shrink-0 border-t border-red-200 bg-red-50 px-4 py-2 text-fluid-xs font-medium text-red-800"
              role="alert"
            >
              {msg}
            </p>
          ) : null}

          <footer className="flex shrink-0 gap-2 border-t border-slate-200 bg-white px-3 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-2.5">
            {step > 0 ? (
              <button type="button" disabled={busy} onClick={() => goStep(step - 1)} className={BTN_PREV}>
                이전
              </button>
            ) : null}
            {isLast ? (
              <button type="button" disabled={busy || !agree} onClick={() => void onSubmit()} className={BTN_SUBMIT}>
                {busy ? '처리 중…' : agree ? '계약 완료 제출' : '동의에 체크해 주세요'}
              </button>
            ) : (
              <button type="button" disabled={nextDisabled} onClick={() => void onNext()} className={BTN_NEXT}>
                {nextLabel}
              </button>
            )}
          </footer>
        </div>
      </div>
      {getTeamToken() ? (
        <EContractPagedPreviewModal
          open={pagedPreviewOpen}
          onClose={() => {
            setPagedPreviewOpen(false);
            setPagedAutoPdfDownload(false);
          }}
          bodyRaw={session.bodyMarkdown}
          docId={session.issuanceId}
          definitionTitle={session.definitionTitle}
          versionOrdinal={session.versionOrdinal}
          autoDownloadPdfOnReady={pagedAutoPdfDownload}
          onAutoDownloadPdfConsumed={() => setPagedAutoPdfDownload(false)}
        />
      ) : null}

      {selfieGuideOpen ? createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="text-fluid-base font-bold text-gray-900">본인 확인 셀카 촬영</h3>
              <button type="button" onClick={() => setSelfieGuideOpen(false)} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="mb-4 text-center">
                <p className="text-fluid-sm font-medium text-gray-800">아래 번호와 얼굴이 함께 나오게 찍어주세요</p>
                <div className="mt-2 inline-block rounded-lg border-2 border-dashed border-blue-400 bg-blue-50 px-6 py-3">
                  <span className="text-fluid-3xl font-bold tracking-widest text-blue-900">{session?.challengeDigits}</span>
                </div>
              </div>
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                <img src="/images/e-contract-selfie-guide.png" alt="셀카 촬영 가이드" className="w-full h-auto object-contain" />
              </div>
            </div>
            <div className="mt-5 shrink-0">
              <EContractSelfiePicker busy={busy} onPicked={(file) => void onSelfieSelected(file)} />
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}
