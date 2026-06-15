import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  fetchTeamInspectionChecklist,
  INSPECTION_STATUS_LABELS,
  type InspectionChecklistDto,
} from '../../api/inquiryInspection';
import { getTeamToken, clearTeamToken } from '../../stores/teamAuth';
import { isAuthSessionExpiredError } from '../../api/auth';
import {
  InspectionHeaderBlock,
  INSPECTION_PRE_CLEAN_GUIDE,
} from '../../components/inquiry-inspection/inspectionUiBlocks';
import { TeamInspectionAreasEditor } from './TeamInspectionAreasEditor';
import { TeamPreCleanWizard } from './TeamPreCleanWizard';
import { isBeforeItemComplete } from '@shared/inquiryInspectionTemplate';
import { resolveTeamInquiryReturnTo, teamInquiryNavState } from '../../utils/teamInquiryNavigation';
import { RoundBackButton } from '../../components/ui/RoundBackButton';
import { FlaggedBeforePhotosSection } from '../../components/inquiry-inspection/FlaggedBeforePhotosSection';

function countBeforeProgress(checklist: InspectionChecklistDto) {
  let beforeDone = 0;
  let total = 0;
  for (const area of checklist.areas) {
    if (area.notApplicable) continue;
    for (const item of area.items) {
      if (item.itemKey.startsWith('_')) continue;
      total += 1;
      if (
        isBeforeItemComplete({
          notApplicable: item.notApplicable,
          beforeCount: item.photos.filter((p) => p.phase === 'BEFORE').length,
        })
      ) {
        beforeDone += 1;
      }
    }
  }
  return { beforeDone, total };
}

export function TeamPreCleanPhotoPage() {
  const { inquiryId = '' } = useParams<{ inquiryId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const token = getTeamToken();
  const returnTo = useMemo(
    () => resolveTeamInquiryReturnTo(location, inquiryId),
    [location, inquiryId],
  );
  const goBack = useCallback(() => navigate(returnTo), [navigate, returnTo]);
  const [checklist, setChecklist] = useState<InspectionChecklistDto | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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

  const { beforeDone, total } = countBeforeProgress(checklist);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RoundBackButton onClick={goBack} />
        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-fluid-2xs font-medium text-sky-900">
          청소 전 촬영
        </span>
      </div>

      <InspectionHeaderBlock
        checklist={checklist}
        title="청소 전 현장 촬영"
        intro={INSPECTION_PRE_CLEAN_GUIDE}
      />

      <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-fluid-xs text-sky-950">
        진행: 청소 전 {beforeDone}/{total} 항목
        {beforeDone >= total && total > 0 && (
          <span className="ml-2 font-medium text-emerald-800">— 청소 전 촬영 완료</span>
        )}
      </div>

      <FlaggedBeforePhotosSection
        checklist={checklist}
        inquiryId={inquiryId}
        token={token}
        readOnly={readOnly}
        disabled={busy}
        onChecklistUpdate={setChecklist}
        onMsg={setMsg}
      />

      {readOnly ? (
        <TeamInspectionAreasEditor
          checklist={checklist}
          inquiryId={inquiryId}
          token={token}
          readOnly={readOnly}
          busy={busy}
          setBusy={setBusy}
          photoMode="before-only"
          onReload={reload}
          onMsg={setMsg}
        />
      ) : (
        <TeamPreCleanWizard
          checklist={checklist}
          inquiryId={inquiryId}
          token={token}
          readOnly={readOnly}
          busy={busy}
          setBusy={setBusy}
          onReload={reload}
          onMsg={setMsg}
          onClose={goBack}
          onChecklistUpdate={setChecklist}
        />
      )}

      {msg && (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-fluid-xs text-gray-800">{msg}</p>
      )}

      {!readOnly && (
        <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
          <Link
            to={`/team/inspection/${encodeURIComponent(inquiryId)}`}
            state={teamInquiryNavState(returnTo)}
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-gray-900 py-3 text-fluid-sm font-semibold text-white touch-manipulation"
          >
            현장 검수 · 청소완료로 이동
          </Link>
          <p className="text-center text-fluid-2xs text-gray-500">
            크루 청소 후 「청소 후」 사진·고객 확인·서명은 검수 페이지에서 진행합니다.
          </p>
        </div>
      )}

      {readOnly && (
        <p className="text-fluid-xs text-gray-500">{INSPECTION_STATUS_LABELS[checklist.status]}</p>
      )}
    </div>
  );
}
