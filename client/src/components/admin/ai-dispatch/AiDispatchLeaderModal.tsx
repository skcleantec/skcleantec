import { useState } from 'react';
import { createPortal } from 'react-dom';
import { TEAM_LEADER_SIZE_POLICY_LABEL } from '@shared/teamLeaderDispatch';
import type { AiDispatchLeader } from '../../../api/aiDispatch';
import type { TeamLeaderDispatchFormValue } from '../TeamLeaderDispatchFields';
import { AiDispatchLeaderSettingsModal } from './AiDispatchLeaderSettingsModal';
import { LineMdIcon } from '../../ui/LineMdIcon';

function Row({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-2 rounded-xl border border-slate-200 px-2.5 py-2">
      <LineMdIcon name={icon} className="mt-0.5 size-5 shrink-0 text-slate-600" />
      <div className="min-w-0">
        <p className="text-fluid-xs font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-fluid-xs leading-snug text-slate-600">{body}</p>
      </div>
    </li>
  );
}

function summaryOf(leader: AiDispatchLeader): string {
  if (leader.band === '피로') return '멀리 가거나, 큰 집이 많거나, 쉬지 못한 날이 겹친 상태입니다.';
  if (leader.band === '좋음') return '최근 일주일이 정상보다 가볍거나, 이동이 팀 평균을 넘지 않습니다.';
  return '최근 일주일이 정상 근무에 가깝습니다.';
}

function dayText(leader: AiDispatchLeader): string {
  const detail = leader.detail;
  const gap = detail.workedDays - detail.normalWorkDays;
  const base = `최근 ${detail.windowDays}일 중 ${detail.workedDays}일 일했습니다. 정상은 ${detail.normalWorkDays}일입니다.`;
  if (gap > 0) return `${base} 정상보다 ${gap}일 더 일했습니다.`;
  if (gap < 0) return `${base} 정상보다 ${Math.abs(gap)}일 덜 일했습니다.`;
  return `${base} 정상 날수와 같습니다.`;
}

function jobText(leader: AiDispatchLeader): string {
  const detail = leader.detail;
  const extra = detail.jobCount - detail.normalJobs;
  const base = `${detail.jobCount}건 했습니다. 정상은 ${detail.normalJobs}건입니다.`;
  if (extra > 0) return `${base} ${extra}건이 더 많아 피로가 올라갑니다.`;
  return base;
}

function restText(leader: AiDispatchLeader): string {
  const rest = leader.detail.restDays;
  if (rest === 0) return '이 기간에 쉰 날이 없습니다. 쉼이 없으면 피로가 더 쌓입니다.';
  if (rest >= 2) return `${rest}일 쉬었습니다. 이틀 이상 쉬면 피로가 줄어듭니다.`;
  return `${rest}일 쉬었습니다.`;
}

function loopText(leader: AiDispatchLeader): string {
  const detail = leader.detail;
  if (detail.loopKm == null) return '집이나 현장 좌표가 없어 이동 거리를 재지 못했습니다.';
  if (detail.teamLoopKm == null) return `집에서 현장을 거쳐 집으로 돌아오는 하루 평균이 ${detail.loopKm}km입니다. 비교할 팀장이 부족합니다.`;
  const gap = detail.loopKm - detail.teamLoopKm;
  if (gap > 0) {
    return `집에서 현장을 거쳐 집으로 돌아오는 하루 평균이 ${detail.loopKm}km입니다. 팀 평균 ${detail.teamLoopKm}km보다 ${gap}km 멉니다.`;
  }
  return `집에서 현장을 거쳐 집으로 돌아오는 하루 평균이 ${detail.loopKm}km입니다. 팀 평균 ${detail.teamLoopKm}km와 같거나 더 가깝습니다.`;
}

function betweenText(leader: AiDispatchLeader): string {
  const delta = leader.detail.betweenDeltaKm;
  if (delta == null) return '오전 현장과 오후 현장 사이를 팀과 비교하지 못했습니다.';
  if (delta > 0) return `현장과 현장 사이가 팀 평균보다 ${delta}km 멉니다. 이 거리가 멀수록 피로가 쌓입니다.`;
  if (delta < 0) return `현장과 현장 사이가 팀 평균보다 ${Math.abs(delta)}km 가깝습니다.`;
  return '현장과 현장 사이가 팀 평균과 같습니다.';
}

function largeText(leader: AiDispatchLeader): string {
  const count = leader.detail.largeJobs;
  if (count === 0) return '35평 이상 집은 없습니다. 작은 집은 피로에 더하지 않습니다.';
  return `35평 이상 ${count}건입니다. 큰 집이 많을수록 피로가 올라갑니다.`;
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
              {leader.band} · 피로 {leader.fatigue}
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
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
          <p className="flex items-start gap-2 text-fluid-xs leading-snug text-slate-700">
            <LineMdIcon name="gauge" className="mt-0.5 size-5 shrink-0 text-slate-600" />
            <span>{summaryOf(leader)} 30 이하는 좋음, 60 이하는 보통, 그 위는 피로입니다.</span>
          </p>
          <ul className="space-y-1.5">
            <Row icon="calendar" title="일한 날" body={dayText(leader)} />
            <Row icon="briefcase-check" title="한 일" body={jobText(leader)} />
            <Row icon="moon" title="쉰 날" body={restText(leader)} />
            <Row icon="map-marker" title="집에서 현장" body={loopText(leader)} />
            <Row icon="arrows-horizontal" title="현장과 현장 사이" body={betweenText(leader)} />
            <Row icon="home" title="큰 집" body={largeText(leader)} />
            <Row
              icon="person"
              title="원룸·투룸 인원"
              body={
                leader.detail.soloJobs > 0
                  ? `투룸을 혼자 간 일정이 ${leader.detail.soloJobs}건입니다. 팀원 점수를 켜 두면 이 건만 피로가 올라갑니다. 원룸은 한 명이 기본이라 더하지 않고, 원룸에 팀원이 같이 가면 그 집의 가중치는 없습니다.`
                  : '원룸은 한 명이 기본입니다. 팀원이 같이 간 원룸은 피로에 더하지 않습니다. 투룸을 혼자 가면, 팀원 점수를 켠 업체만 피로가 올라갑니다.'
              }
            />
            <Row
              icon="watch"
              title="오늘 자리"
              body={`하루 최대 ${leader.jobsPerDay}건이고, 지금 남은 자리는 ${leader.remainingJobs}건입니다. 자리가 없어도 빈 일정은 넣습니다. 집 크기는 ${sizeLabel}입니다.`}
            />
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
