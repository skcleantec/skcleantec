import { useCallback, useEffect, useState } from 'react';
import {
  fetchAdminInspectionChecklist,
  INSPECTION_STATUS_LABELS,
  voidAdminInspectionChecklist,
  type InspectionChecklistDto,
} from '../../api/inquiryInspection';
import {
  InspectionAreaCard,
  InspectionBasicSection,
  InspectionConsentSection,
  InspectionHeaderBlock,
} from './inspectionUiBlocks';
import { getMe } from '../../api/auth';

export function AdminInspectionPanel({
  inquiryId,
  token,
}: {
  inquiryId: string;
  token: string;
}) {
  const [checklist, setChecklist] = useState<InspectionChecklistDto | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidPassword, setVoidPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setErr(null);
    try {
      const dto = await fetchAdminInspectionChecklist(token, inquiryId);
      setChecklist(dto);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '불러오기 실패');
      setChecklist(null);
    }
  }, [token, inquiryId]);

  useEffect(() => {
    void reload();
    void getMe(token)
      .then((me) => setIsAdmin(me.role === 'ADMIN'))
      .catch(() => setIsAdmin(false));
  }, [reload, token]);

  const downloadAllPhotos = () => {
    if (!checklist) return;
    for (const area of checklist.areas) {
      for (const p of area.photos) {
        const a = document.createElement('a');
        a.href = p.secureUrl;
        a.download = `${area.label}_${p.phase}_${p.id.slice(0, 8)}.jpg`;
        a.target = '_blank';
        a.rel = 'noopener';
        a.click();
      }
    }
  };

  if (checklist === undefined) {
    return <p className="text-fluid-xs text-gray-500">현장 검수 정보를 불러오는 중…</p>;
  }

  if (!checklist) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-fluid-xs text-gray-600">
        아직 현장 검수 체크리스트가 없습니다. 팀장이 현장에서 「현장 검수 / 청소완료」를 진행하면 여기에 표시됩니다.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {err && <p className="text-fluid-xs text-rose-700">{err}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-fluid-2xs font-medium text-slate-800">
          {INSPECTION_STATUS_LABELS[checklist.status]}
        </span>
        {checklist.completedAt && (
          <span className="text-fluid-2xs text-gray-600">
            완료 {new Date(checklist.completedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
          </span>
        )}
        {checklist.emailSentAt ? (
          <span className="text-fluid-2xs text-emerald-700">이메일 발송됨</span>
        ) : checklist.status === 'COMPLETED' ? (
          <span className="text-fluid-2xs text-amber-700">이메일 발송 예정</span>
        ) : null}
        <button
          type="button"
          onClick={downloadAllPhotos}
          className="ml-auto rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-fluid-2xs hover:bg-gray-50"
        >
          사진 일괄 다운로드
        </button>
      </div>

      <InspectionHeaderBlock checklist={checklist} />

      <InspectionBasicSection checklist={checklist} readOnly onPatch={() => {}} />

      <section className="space-y-3">
        <h3 className="text-fluid-sm font-semibold text-gray-900">구역별 사진</h3>
        {checklist.areas.map((area) => (
          <InspectionAreaCard
            key={area.id}
            area={area}
            readOnly
            busy={false}
            onToggleNa={() => {}}
            onNaReasonChange={() => {}}
            onUpload={() => {}}
            onDeletePhoto={() => {}}
          />
        ))}
      </section>

      {checklist.leaderNotes?.trim() && (
        <section>
          <h3 className="text-fluid-sm font-semibold text-gray-900 mb-1">특이사항</h3>
          <p className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 text-fluid-xs">{checklist.leaderNotes}</p>
        </section>
      )}

      <InspectionConsentSection checklist={checklist} readOnly onConsentChange={() => {}} onEmailChange={() => {}} />

      {checklist.signature?.secureUrl && (
        <section>
          <h3 className="text-fluid-sm font-semibold text-gray-900 mb-2">고객 서명</h3>
          <img src={checklist.signature.secureUrl} alt="고객 서명" className="max-h-36 rounded-lg border bg-white" />
        </section>
      )}

      {checklist.status === 'VOID' && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-fluid-xs text-rose-900">
          무효 처리: {checklist.voidedBy?.name ?? '—'} ·{' '}
          {checklist.voidedAt
            ? new Date(checklist.voidedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
            : '—'}
          <p className="mt-1 whitespace-pre-wrap">{checklist.voidReason}</p>
        </div>
      )}

      {isAdmin && checklist.status === 'COMPLETED' && (
        <details className="rounded-lg border border-amber-200 bg-amber-50/50">
          <summary className="cursor-pointer px-3 py-2 text-fluid-xs font-medium text-amber-950">
            관리자 — 검수본 무효(VOID)
          </summary>
          <div className="space-y-2 border-t border-amber-100 px-3 py-3">
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              rows={2}
              placeholder="무효 사유 (필수)"
              className="w-full rounded border border-gray-300 px-2 py-1 text-fluid-xs"
            />
            <input
              type="password"
              value={voidPassword}
              onChange={(e) => setVoidPassword(e.target.value)}
              placeholder="관리자 비밀번호"
              className="w-full rounded border border-gray-300 px-2 py-1 text-fluid-xs"
            />
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const dto = await voidAdminInspectionChecklist(token, inquiryId, voidPassword, voidReason);
                  setChecklist(dto);
                  setVoidPassword('');
                  setVoidReason('');
                } catch (e) {
                  alert(e instanceof Error ? e.message : '무효 처리 실패');
                } finally {
                  setBusy(false);
                }
              }}
              className="rounded-lg border border-rose-700 bg-white px-3 py-1.5 text-fluid-xs text-rose-900"
            >
              무효 처리
            </button>
          </div>
        </details>
      )}
    </div>
  );
}
