import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  fetchTeamInspectionChecklist,
  INSPECTION_STATUS_LABELS,
  type InspectionChecklistDto,
} from '../../api/inquiryInspection';
import { getTeamToken, clearTeamToken } from '../../stores/teamAuth';
import { isAuthSessionExpiredError } from '../../api/auth';
import { InspectionHeaderBlock } from '../../components/inquiry-inspection/inspectionUiBlocks';
import { TeamPreCleanWizard } from './TeamPreCleanWizard';
import { isAfterItemComplete } from '@shared/inquiryInspectionTemplate';
import { resolveTeamInquiryReturnTo, teamInquiryNavState } from '../../utils/teamInquiryNavigation';
import { RoundBackButton } from '../../components/ui/RoundBackButton';

function countAfterProgress(checklist: InspectionChecklistDto) {
  let afterDone = 0;
  let total = 0;
  for (const area of checklist.areas) {
    if (area.notApplicable) continue;
    for (const item of area.items) {
      if (item.itemKey.startsWith('_')) continue;
      total += 1;
      if (
        isAfterItemComplete({
          notApplicable: item.notApplicable,
          afterCount: item.photos.filter((p) => p.phase === 'AFTER').length,
        })
      ) {
        afterDone += 1;
      }
    }
  }
  return { afterDone, total };
}

export function TeamPostCleanPhotoPage() {
  const { inquiryId = '' } = useParams<{ inquiryId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const token = getTeamToken();
  const returnTo = useMemo(
    () => resolveTeamInquiryReturnTo(location, inquiryId),
    [location, inquiryId],
  );
  const inspectionReturnTo = useMemo(() => {
    const q = location.search || '';
    return `/team/post-clean/${encodeURIComponent(inquiryId)}${q}`;
  }, [inquiryId, location.search]);
  const goBack = useCallback(() => navigate(returnTo), [navigate, returnTo]);
  const [checklist, setChecklist] = useState<InspectionChecklistDto | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [captureActive, setCaptureActive] = useState(false);
  const autoStartedRef = useRef(false);

  const readOnly = checklist?.status === 'COMPLETED' || checklist?.status === 'VOID';

  const reload = useCallback(async (): Promise<InspectionChecklistDto | null> => {
    if (!token || !inquiryId) return null;
    setLoadErr(null);
    try {
      const dto = await fetchTeamInspectionChecklist(token, inquiryId);
      setChecklist(dto);
      return dto;
    } catch (e) {
      if (isAuthSessionExpiredError(e)) {
        clearTeamToken();
        navigate('/login', { replace: true });
        return null;
      }
      setLoadErr(e instanceof Error ? e.message : '불러오기 실패');
      return null;
    }
  }, [token, inquiryId, navigate]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!checklist || readOnly || autoStartedRef.current) return;
    const { afterDone, total } = countAfterProgress(checklist);
    if (total > 0 && afterDone < total) {
      autoStartedRef.current = true;
      setCaptureActive(true);
    }
  }, [checklist, readOnly]);

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

  const { afterDone, total } = countAfterProgress(checklist);
  const afterIncomplete = total > 0 && afterDone < total;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RoundBackButton onClick={goBack} />
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-fluid-2xs font-medium text-emerald-900">
          청소 후 촬영
        </span>
      </div>

      <InspectionHeaderBlock
        checklist={checklist}
        title="청소 후 현장 촬영"
        intro="청소가 끝난 뒤, 청소 전과 같은 순서로 세부 항목별 「청소 후」 사진을 촬영합니다."
      />

      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-fluid-xs text-emerald-950">
        진행: 청소 후 {afterDone}/{total} 항목
        {!afterIncomplete && total > 0 && (
          <span className="ml-2 font-medium text-emerald-800">— 청소 후 촬영 완료</span>
        )}
      </div>

      {!readOnly && afterIncomplete && !captureActive && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setMsg(null);
            setCaptureActive(true);
          }}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-3 text-fluid-sm font-semibold text-white touch-manipulation disabled:opacity-50"
        >
          청소 후 촬영 시작
        </button>
      )}

      {!readOnly && (
        <TeamPreCleanWizard
          checklist={checklist}
          inquiryId={inquiryId}
          token={token}
          readOnly={readOnly}
          busy={busy}
          setBusy={setBusy}
          onReload={reload}
          onMsg={setMsg}
          onChecklistUpdate={setChecklist}
          phase="AFTER"
          hideAreaGrid
          captureActive={captureActive}
          onClose={() => {
            setCaptureActive(false);
            void reload();
          }}
        />
      )}

      {msg && (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-fluid-xs text-gray-800">{msg}</p>
      )}

      {!readOnly && (
        <div className="sticky bottom-0 -mx-4 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
          <Link
            to={`/team/inspection/${encodeURIComponent(inquiryId)}`}
            state={teamInquiryNavState(inspectionReturnTo)}
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-gray-900 py-3 text-fluid-sm font-semibold text-white touch-manipulation"
          >
            현장 검수 · 청소완료로 이동
          </Link>
        </div>
      )}

      {readOnly && (
        <p className="text-fluid-xs text-gray-500">{INSPECTION_STATUS_LABELS[checklist.status]}</p>
      )}
    </div>
  );
}
