import { useState } from 'react';
import { createPortal } from 'react-dom';
import { TEAM_LEADER_SIZE_POLICY_LABEL } from '@shared/teamLeaderDispatch';
import type { AiDispatchLeader } from '../../../api/aiDispatch';
import type { TeamLeaderDispatchFormValue } from '../TeamLeaderDispatchFields';
import { AiDispatchLeaderSettingsModal } from './AiDispatchLeaderSettingsModal';
import { LineMdIcon } from '../../ui/LineMdIcon';

function bandWord(band: string): string {
  if (band === '매우피로') return '매우 나쁨';
  if (band === '피로') return '나쁨';
  if (band === '좋음' || band === '보통') return band;
  return band;
}

function Fact({ icon, title, value }: { icon: string; title: string; value: string }) {
  return (
    <li className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
      <LineMdIcon name={icon} className="size-5 shrink-0 text-slate-600" />
      <span className="w-16 shrink-0 text-fluid-2xs text-slate-500">{title}</span>
      <span className="min-w-0 truncate text-fluid-xs font-semibold text-slate-900" title={value}>
        {value}
      </span>
    </li>
  );
}

export function AiDispatchLeaderModal({
  leader,
  saving,
  saveError,
  onClose,
  onSave,
}: {
  leader: AiDispatchLeader;
  saving: boolean;
  saveError: string | null;
  onClose: () => void;
  onSave: (value: TeamLeaderDispatchFormValue) => Promise<void>;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sizeLabel = TEAM_LEADER_SIZE_POLICY_LABEL[leader.sizePolicy];
  const detail = leader.detail;
  const travel =
    detail.loopKm == null
      ? '거리 없음'
      : detail.distanceSinceRestKm == null
        ? `하루 ${detail.loopKm}km`
        : `하루 ${detail.loopKm}km · 누적 ${detail.distanceSinceRestKm}km`;
  const facts = [
    { icon: 'gauge', title: '피로', value: `${leader.fatigue} · ${bandWord(leader.band)}` },
    { icon: 'calendar', title: '지난 근무', value: `${detail.workedDays}일 · ${detail.jobCount}건` },
    { icon: 'moon', title: '휴무', value: detail.sinceRest ? '다음부터 다시 셈' : '기록 없음' },
    { icon: 'map-marker', title: '이동', value: travel },
    { icon: 'home', title: '큰 집', value: detail.largeJobs > 0 ? `${detail.largeJobs}건` : '없음' },
    { icon: 'person', title: '투룸 혼자', value: detail.soloJobs > 0 ? `${detail.soloJobs}건` : '없음' },
    { icon: 'watch', title: '오늘', value: `하루 ${leader.jobsPerDay}건 · 남은 ${leader.remainingJobs} · ${sizeLabel}` },
  ];
  return createPortal(
    <div
      className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-dispatch-leader-title"
        className="modal-mobile-fullscreen-panel flex max-h-[min(92vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
          <div className="min-w-0">
            <h2 id="ai-dispatch-leader-title" className="truncate text-fluid-sm font-semibold text-slate-900">
              {leader.name}
            </h2>
            <p className="text-fluid-2xs text-slate-500">
              {bandWord(leader.band)} · {leader.fatigue}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              aria-label="이 팀장 설정"
            >
              <LineMdIcon name="cog" className="size-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              aria-label="닫기"
            >
            <LineMdIcon name="close" className="size-5" />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-1.5">
            {facts.map((fact) => (
              <Fact key={fact.title} icon={fact.icon} title={fact.title} value={fact.value} />
            ))}
          </ul>
        </div>
      </div>
      {settingsOpen ? (
        <AiDispatchLeaderSettingsModal
          leader={leader}
          saving={saving}
          error={saveError}
          onClose={() => setSettingsOpen(false)}
          onSave={(value) => {
            void onSave(value).then(() => setSettingsOpen(false)).catch(() => undefined);
          }}
        />
      ) : null}
    </div>,
    document.body,
  );
}
