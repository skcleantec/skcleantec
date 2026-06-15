import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { SignaturePad } from '../../components/e-contract/SignaturePad';
import {
  completeTeamInspection,
  fetchTeamInspectionChecklist,
  INSPECTION_STATUS_LABELS,
  patchTeamInspectionDraft,
  uploadTeamInspectionSignature,
  type InspectionChecklistDto,
} from '../../api/inquiryInspection';
import { getTeamToken, clearTeamToken } from '../../stores/teamAuth';
import { isAuthSessionExpiredError } from '../../api/auth';
import {
  InspectionBasicSection,
  InspectionConsentSection,
  InspectionHeaderBlock,
} from '../../components/inquiry-inspection/inspectionUiBlocks';
import { TeamInspectionAreasEditor } from './TeamInspectionAreasEditor';
import { copyTextToClipboard } from '../../utils/clipboard';
import { getInspectionCustomerViewUrl } from '../../utils/inspectionCustomerCopy';
import { resolveTeamInquiryReturnTo, teamInquiryNavState } from '../../utils/teamInquiryNavigation';
import { RoundBackButton } from '../../components/ui/RoundBackButton';

export function TeamInspectionPage() {
  const { inquiryId = '' } = useParams<{ inquiryId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const token = getTeamToken();
  const returnTo = useMemo(
    () => resolveTeamInquiryReturnTo(location, inquiryId),
    [location, inquiryId],
  );
  const preCleanReturnTo = useMemo(() => {
    const q = location.search || '';
    return `/team/inspection/${encodeURIComponent(inquiryId)}${q}`;
  }, [inquiryId, location.search]);
  const goBack = useCallback(() => navigate(returnTo), [navigate, returnTo]);
  const [checklist, setChecklist] = useState<InspectionChecklistDto | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const readOnly = checklist?.status === 'COMPLETED' || checklist?.status === 'VOID';

  const reload = useCallback(async () => {
    if (!token || !inquiryId) return;
    setLoadErr(null);
    try {
      const dto = await fetchTeamInspectionChecklist(token, inquiryId);
      setChecklist(dto);
    } catch (e) {
      if (isAuthSessionExpiredError(e)) {
        clearTeamToken();
        navigate('/login', { replace: true });
        return;
      }
      setLoadErr(e instanceof Error ? e.message : '불러오기 실패');
    }
  }, [token, inquiryId, navigate]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveDraft = useCallback(
    async (patch: Record<string, unknown>, opts?: { silent?: boolean }) => {
      if (!token || !inquiryId || readOnly) return;
      if (!opts?.silent) {
        setBusy(true);
        setMsg(null);
      }
      try {
        const dto = await patchTeamInspectionDraft(token, inquiryId, patch);
        setChecklist(dto);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : '저장 실패');
      } finally {
        if (!opts?.silent) setBusy(false);
      }
    },
    [inquiryId, readOnly, token],
  );

  const [leaderNotesLocal, setLeaderNotesLocal] = useState('');
  const leaderNotesFocusedRef = useRef(false);
  const leaderNotesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!checklist) return;
    if (leaderNotesFocusedRef.current) return;
    setLeaderNotesLocal(checklist.leaderNotes ?? '');
  }, [checklist?.id, checklist?.leaderNotes]);

  const flushLeaderNotesSave = useCallback(
    (value: string) => {
      if (leaderNotesSaveTimerRef.current) {
        clearTimeout(leaderNotesSaveTimerRef.current);
        leaderNotesSaveTimerRef.current = null;
      }
      return saveDraft({ leaderNotes: value }, { silent: true });
    },
    [saveDraft],
  );

  const scheduleLeaderNotesSave = useCallback(
    (value: string) => {
      if (leaderNotesSaveTimerRef.current) clearTimeout(leaderNotesSaveTimerRef.current);
      leaderNotesSaveTimerRef.current = setTimeout(() => {
        leaderNotesSaveTimerRef.current = null;
        void saveDraft({ leaderNotes: value }, { silent: true });
      }, 600);
    },
    [saveDraft],
  );

  const [customerEmailLocal, setCustomerEmailLocal] = useState('');
  const customerEmailFocusedRef = useRef(false);
  const customerEmailSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!checklist) return;
    if (customerEmailFocusedRef.current) return;
    setCustomerEmailLocal(checklist.customerEmail ?? '');
  }, [checklist?.id, checklist?.customerEmail]);

  useEffect(
    () => () => {
      if (leaderNotesSaveTimerRef.current) clearTimeout(leaderNotesSaveTimerRef.current);
      if (customerEmailSaveTimerRef.current) clearTimeout(customerEmailSaveTimerRef.current);
    },
    [],
  );

  const flushCustomerEmailSave = useCallback(
    (value: string) => {
      if (customerEmailSaveTimerRef.current) {
        clearTimeout(customerEmailSaveTimerRef.current);
        customerEmailSaveTimerRef.current = null;
      }
      return saveDraft({ customerEmail: value }, { silent: true });
    },
    [saveDraft],
  );

  const scheduleCustomerEmailSave = useCallback(
    (value: string) => {
      if (customerEmailSaveTimerRef.current) clearTimeout(customerEmailSaveTimerRef.current);
      customerEmailSaveTimerRef.current = setTimeout(() => {
        customerEmailSaveTimerRef.current = null;
        void saveDraft({ customerEmail: value }, { silent: true });
      }, 600);
    },
    [saveDraft],
  );

  const handleComplete = async () => {
    if (!token || !inquiryId || readOnly) return;
    if (!window.confirm('고객과 함께 확인·서명을 완료했습니까? 청소완료 후에는 수정할 수 없습니다.')) return;
    await flushLeaderNotesSave(leaderNotesLocal);
    await flushCustomerEmailSave(customerEmailLocal);
    setBusy(true);
    setMsg(null);
    try {
      const dto = await completeTeamInspection(token, inquiryId);
      setChecklist(dto);
      setMsg('청소완료(검수 마감) 처리되었습니다. 완료본 PDF·이메일은 잠시 후 발송됩니다.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '완료 처리 실패');
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="p-4 text-fluid-sm text-gray-600">
        로그인이 필요합니다. <Link to="/login" className="text-blue-700 underline">로그인</Link>
      </div>
    );
  }

  if (loadErr) {
    return (
      <div className="p-4 space-y-3">
        <p className="text-fluid-sm text-rose-700">{loadErr}</p>
        <button type="button" onClick={() => void reload()} className="rounded-lg border px-3 py-2 text-fluid-xs">
          다시 시도
        </button>
      </div>
    );
  }

  if (!checklist) {
    return <div className="p-4 text-fluid-sm text-gray-500">불러오는 중…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RoundBackButton onClick={goBack} />
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && (
            <Link
              to={`/team/post-clean/${encodeURIComponent(inquiryId)}`}
              state={teamInquiryNavState(preCleanReturnTo)}
              className="rounded-full border border-emerald-600 bg-emerald-50 px-2.5 py-0.5 text-fluid-2xs font-medium text-emerald-900 touch-manipulation"
            >
              청소 후 촬영
            </Link>
          )}
          {!readOnly && (
            <Link
              to={`/team/pre-clean/${encodeURIComponent(inquiryId)}`}
              state={teamInquiryNavState(preCleanReturnTo)}
              className="rounded-full border border-sky-600 bg-sky-50 px-2.5 py-0.5 text-fluid-2xs font-medium text-sky-900 touch-manipulation"
            >
              청소 전 촬영
            </Link>
          )}
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-fluid-2xs font-medium text-gray-800">
            {INSPECTION_STATUS_LABELS[checklist.status]}
          </span>
        </div>
      </div>

      <InspectionHeaderBlock checklist={checklist} />

      <InspectionBasicSection
        checklist={checklist}
        readOnly={readOnly}
        onPatch={(basicAnswers) => void saveDraft({ basicAnswers })}
      />

      <TeamInspectionAreasEditor
        checklist={checklist}
        inquiryId={inquiryId}
        token={token}
        readOnly={readOnly}
        busy={busy}
        setBusy={setBusy}
        photoMode="both"
        onReload={reload}
        onMsg={setMsg}
      />

      <section>
        <h3 className="text-fluid-sm font-semibold text-gray-900 mb-2">특이사항 (팀장)</h3>
        <textarea
          value={leaderNotesLocal}
          readOnly={readOnly}
          onChange={(e) => {
            const next = e.target.value;
            setLeaderNotesLocal(next);
            scheduleLeaderNotesSave(next);
          }}
          onFocus={() => {
            leaderNotesFocusedRef.current = true;
          }}
          onBlur={(e) => {
            leaderNotesFocusedRef.current = false;
            flushLeaderNotesSave(e.target.value);
          }}
          rows={4}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base leading-relaxed touch-manipulation"
          placeholder="현장 특이사항, 고객 요청 등"
          autoComplete="off"
          enterKeyHint="done"
        />
      </section>

      <InspectionConsentSection
        checklist={checklist}
        readOnly={readOnly}
        customerEmail={customerEmailLocal}
        onEmailChange={(email) => {
          setCustomerEmailLocal(email);
          scheduleCustomerEmailSave(email);
        }}
        onEmailFocus={() => {
          customerEmailFocusedRef.current = true;
        }}
        onEmailBlur={(email) => {
          customerEmailFocusedRef.current = false;
          void flushCustomerEmailSave(email);
        }}
        onConsentChange={(key, value) => {
          const map: Record<string, string> = {
            personalInfo: 'consentPersonalInfo',
            thirdParty: 'consentThirdParty',
            scopeConfirm: 'consentScopeConfirm',
            leaderLiability: 'consentLeaderLiability',
            customerConfirm: 'consentCustomerConfirm',
            commercialUse: 'consentCommercialUse',
            emailDelivery: 'consentEmailDelivery',
          };
          void saveDraft({ [map[key]!]: value });
        }}
      />

      <section className="space-y-3">
        <h3 className="text-fluid-sm font-semibold text-gray-900">고객 서명</h3>
        {checklist.signature?.secureUrl ? (
          <img src={checklist.signature.secureUrl} alt="고객 서명" className="max-h-32 rounded-lg border bg-white" />
        ) : readOnly ? (
          <p className="text-fluid-xs text-gray-500">서명 없음</p>
        ) : (
          <SignaturePad
            busy={busy}
            saveButtonLabel="서명 저장"
            hint="고객과 함께 박스 안에 서명을 그려 주세요."
            onSave={async (blob) => {
              if (!token) return;
              setBusy(true);
              try {
                const dto = await uploadTeamInspectionSignature(token, inquiryId, blob);
                setChecklist(dto);
                setMsg('서명이 저장되었습니다.');
              } catch (e) {
                setMsg(e instanceof Error ? e.message : '서명 저장 실패');
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
      </section>

      {msg && (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-fluid-xs text-gray-800">{msg}</p>
      )}

      {!readOnly && (
        <div className="sticky bottom-0 -mx-4 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleComplete()}
            className="w-full rounded-xl bg-gray-900 py-3 text-fluid-sm font-semibold text-white touch-manipulation disabled:opacity-50"
          >
            청소완료 (고객 확인·서명)
          </button>
          <p className="mt-2 text-center text-fluid-2xs text-gray-500">
            모든 세부 항목·동의·서명·이메일이 충족되어야 완료됩니다.
          </p>
        </div>
      )}

      {checklist.status === 'COMPLETED' && checklist.completedAt && (
        <div className="space-y-2">
          <p className="text-fluid-xs text-emerald-800">
            완료: {new Date(checklist.completedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
          </p>
          {checklist.customerViewToken ? (
            <button
              type="button"
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-fluid-xs font-medium text-indigo-900"
              onClick={() => {
                void copyTextToClipboard(
                  getInspectionCustomerViewUrl(checklist.customerViewToken!),
                ).then((ok) => alert(ok ? '고객 열람 링크를 복사했습니다.' : '복사에 실패했습니다.'));
              }}
            >
              고객 열람 링크 복사
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
