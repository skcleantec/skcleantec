import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchEContractPublicSession,
  submitEContractSign,
  uploadEContractBlob,
  type PublicSignSessionDto,
} from '../../api/eContractPublic';
import { EContractPagedPreviewModal } from '../../components/e-contract/EContractPagedPreviewModal';
import { EContractBodyDisplay } from '../../components/e-contract/EContractBodyDisplay';
import { SignaturePad } from '../../components/e-contract/SignaturePad';
import { getTeamToken } from '../../stores/teamAuth';

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

export function EContractPublicSignPage() {
  const { token } = useParams<{ token: string }>();
  const decoded = decodeURIComponent(token || '').trim();

  const [session, setSession] = useState<PublicSignSessionDto | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selfieFileName, setSelfieFileName] = useState<string | null>(null);
  const [selfieUploaded, setSelfieUploaded] = useState<{ publicId: string; secureUrl: string } | null>(null);
  const [sigUploaded, setSigUploaded] = useState<{ publicId: string; secureUrl: string } | null>(null);

  const [challengeInput, setChallengeInput] = useState('');
  const [agree, setAgree] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerRrn, setSignerRrn] = useState('');
  const [signerAddress, setSignerAddress] = useState('');
  const [signerPhone, setSignerPhone] = useState('');
  const [signerFreeTextNotes, setSignerFreeTextNotes] = useState('');

  const selfInputRef = useRef<HTMLInputElement | null>(null);
  const lastIssuanceIdRef = useRef('');
  const [pagedPreviewOpen, setPagedPreviewOpen] = useState(false);
  const [pagedAutoPdfDownload, setPagedAutoPdfDownload] = useState(false);

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
      setSignerName(session.signerNameLabel?.trim() ?? '');
      setSignerRrn('');
      setSignerAddress('');
      setSignerPhone('');
      setSignerFreeTextNotes('');
    }
  }, [session]);

  const onSelfieSelected = async (files: FileList | null) => {
    if (!decoded || !files?.[0]) return;
    const f = files[0];
    setSelfieFileName(f.name);
    setBusy(true);
    setMsg(null);
    try {
      const up = await uploadEContractBlob(f, decoded, f.name || 'selfie.jpg');
      setSelfieUploaded(up);
      setMsg('셀카를 업로드했습니다.');
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
      setMsg('서명을 저장했습니다. 아래 「계약 완료 제출」을 눌러 주세요.');
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
    if (!signerName.trim()) {
      setMsg('을(본인) 성함을 입력해 주세요.');
      return;
    }
    const rrnDigits = signerRrn.replace(/\D/g, '');
    if (rrnDigits.length !== 13) {
      setMsg('주민등록번호 13자리를 입력해 주세요.');
      return;
    }
    if (!signerAddress.trim()) {
      setMsg('주소를 입력해 주세요.');
      return;
    }
    if (!signerPhone.trim()) {
      setMsg('연락처를 입력해 주세요.');
      return;
    }
    if (!selfieUploaded) {
      setMsg('본인 확인용 셀카를 업로드해 주세요.');
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
      const notes = signerFreeTextNotes.trim();
      await submitEContractSign(decoded, {
        signerName: signerName.trim(),
        signerResidentRegistrationNumber: rrnDigits,
        signerAddressLine: signerAddress.trim(),
        signerPhone: signerPhone.trim(),
        ...(notes ? { signerFreeTextNotes: notes } : {}),
        challengeEntered: challengeInput,
        agree,
        selfiePublicId: selfieUploaded.publicId,
        selfieUrl: selfieUploaded.secureUrl,
        signaturePublicId: sigUploaded.publicId,
        signatureUrl: sigUploaded.secureUrl,
      });
      await load();
      setMsg('체결을 완료했습니다.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '제출하지 못했습니다.');
    } finally {
      setBusy(false);
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

  return (
    <>
      <div className="mx-auto min-h-[70vh] w-full max-w-lg px-4 py-8">
      <h1 className="text-fluid-lg font-semibold text-gray-900">전자계약</h1>
      <p className="mt-1 text-fluid-sm text-gray-600">
        <span className="font-medium text-gray-800">{session.signerNameLabel}</span> 님 전용 체결 링크입니다.
      </p>
      <p className="mt-1 text-fluid-xs text-gray-500">
        {session.definitionTitle} · 버전 <span className="tabular-nums font-medium">v{session.versionOrdinal}</span>
      </p>
      {session.expiresAtIso ? (
        <p className="mt-2 text-fluid-2xs text-amber-800">
          링크 만료(참고): {new Date(session.expiresAtIso).toLocaleString('ko-KR')}
        </p>
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

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-fluid-xs font-medium text-gray-800">계약 내용(v{session.versionOrdinal})</div>
        <div className="mt-3 min-w-0">
          <EContractBodyDisplay body={session.bodyMarkdown} maxHeightClass="max-h-[40vh]" />
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-fluid-sm font-semibold text-gray-900">을(본인) 정보</div>
        <p className="mt-2 text-fluid-2xs text-gray-600">
          계약 본문에 삽입된 을 정보 칸(이름·주민등록번호·주소 등)에는 아래에 입력하는 내용이 들어갑니다. 제출 전 내용을 다시 확인해 주세요.
        </p>
        <div className="mt-5 min-w-0 space-y-4">
          <div>
            <label htmlFor="ec-sign-name" className="block text-fluid-xs font-medium text-gray-800">
              성함
            </label>
            <input
              id="ec-sign-name"
              type="text"
              autoComplete="name"
              value={signerName}
              onChange={(ev) => setSignerName(ev.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
              maxLength={128}
            />
          </div>
          <div>
            <label htmlFor="ec-sign-rrn" className="block text-fluid-xs font-medium text-gray-800">
              주민등록번호 <span className="font-normal text-gray-500">(숫자 13자리)</span>
            </label>
            <input
              id="ec-sign-rrn"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={signerRrn}
              onChange={(ev) => setSignerRrn(ev.target.value.replace(/\D/g, '').slice(0, 13))}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm tabular-nums tracking-wide"
              maxLength={13}
              placeholder="13자리"
            />
          </div>
          <div>
            <label htmlFor="ec-sign-addr" className="block text-fluid-xs font-medium text-gray-800">
              주소
            </label>
            <textarea
              id="ec-sign-addr"
              rows={3}
              value={signerAddress}
              onChange={(ev) => setSignerAddress(ev.target.value)}
              className="mt-1 w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-fluid-xs"
              maxLength={2000}
            />
          </div>
          <div>
            <label htmlFor="ec-sign-phone" className="block text-fluid-xs font-medium text-gray-800">
              연락처
            </label>
            <input
              id="ec-sign-phone"
              type="text"
              inputMode="tel"
              autoComplete="tel"
              value={signerPhone}
              onChange={(ev) => setSignerPhone(ev.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm tabular-nums"
              maxLength={32}
            />
          </div>
          <div>
            <label htmlFor="ec-sign-notes" className="block text-fluid-xs font-medium text-gray-800">
              추가 기재 <span className="font-normal text-gray-500">(선택, 계약서 [[EC_SIGNER_FREETEXT]] 위치에 반영)</span>
            </label>
            <textarea
              id="ec-sign-notes"
              rows={2}
              value={signerFreeTextNotes}
              onChange={(ev) => setSignerFreeTextNotes(ev.target.value)}
              className="mt-1 w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-fluid-xs"
              maxLength={4000}
            />
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-fluid-sm font-semibold text-gray-900">서명</div>
        <SignaturePad busy={busy} onSave={savePublicSignature} onClear={() => setSigUploaded(null)} />
      </section>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-fluid-sm font-semibold text-gray-900">본인확인 번호</div>
        <div className="mt-3 rounded-lg border border-dashed border-gray-400 bg-yellow-50 p-6 text-center">
          <span className="text-fluid-4xl font-bold tabular-nums tracking-wider text-gray-900">{session.challengeDigits}</span>
        </div>
        <div
          className="mt-4 rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-3.5 text-center shadow-sm"
          role="note"
          aria-live="polite"
        >
          <p className="text-[12px] font-semibold leading-snug text-gray-950">
            위 번호와 얼굴이 함께 보이도록 셀카를 촬영해 업로드해 주세요.
          </p>
        </div>

        <div className="mt-6">
          <label htmlFor="e-contract-challenge" className="block text-fluid-xs font-medium text-gray-800">
            번호 확인 입력
          </label>
          <input
            id="e-contract-challenge"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={challengeInput}
            maxLength={6}
            onChange={(ev) => setChallengeInput(ev.target.value.replace(/[^\d]/g, '').slice(0, 6))}
            placeholder="표시된 6자리"
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-center text-fluid-lg tabular-nums"
          />
        </div>

        <div className="mt-6">
          <input
            ref={selfInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="user"
            className="hidden"
            onChange={(ev) => void onSelfieSelected(ev.target.files)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => selfInputRef.current?.click()}
            className="w-full rounded-lg border border-gray-300 bg-gray-50 py-3 text-fluid-sm font-medium text-gray-900 disabled:opacity-50"
          >
            셀카 촬영·업로드
          </button>
          {selfieFileName ? <div className="mt-2 truncate text-fluid-2xs text-gray-500">{selfieFileName}</div> : null}
          {selfieUploaded ? (
            <div className="mt-4 flex justify-center">
              <img src={selfieUploaded.secureUrl} alt="본인 확인 셀카" className="max-h-48 w-auto rounded border border-gray-200" />
            </div>
          ) : null}
        </div>
      </section>

      <label className="mt-8 flex cursor-pointer gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <input type="checkbox" checked={agree} onChange={(ev) => setAgree(ev.target.checked)} />
        <span className="text-[11px] text-gray-800">
          위 계약 내용 및 본인이 기재한 을 정보·서명·본인 확인 절차를 이해하였으며 동의합니다.
        </span>
      </label>

      {msg ? (
        <div
          className={`mt-4 rounded-lg border px-3 py-3 text-fluid-sm ${msg.includes('실패') || msg.includes('못했') || msg.includes('다시') ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-900'}`}
        >
          {msg}
        </div>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => void onSubmit()}
        className="mt-6 w-full rounded-lg bg-blue-700 py-3 text-fluid-md font-semibold text-white shadow disabled:opacity-50"
      >
        {busy ? '처리 중…' : '계약 완료 제출'}
      </button>

      <p className="mt-6 text-center text-fluid-2xs text-gray-500">모바일 화면에 맞춘 간편 체결 페이지입니다.</p>
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
