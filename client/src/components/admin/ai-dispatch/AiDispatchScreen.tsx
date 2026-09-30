import { lazy, Suspense, useEffect, useState } from 'react';
import { TEAM_LEADER_SIZE_POLICY_LABEL } from '@shared/teamLeaderDispatch';
import type { AiDispatchBoard, AiDispatchJob, AiDispatchLeader, AiDispatchProposal } from '../../../api/aiDispatch';
import { getSchedule, type ScheduleItem } from '../../../api/schedule';
import { getToken } from '../../../stores/auth';
import { formatDateCompactWithWeekday } from '../../../utils/dateFormat';
import { LineMdIcon } from '../../ui/LineMdIcon';
import { AiDispatchReasonModal } from './AiDispatchReasonModal';
import { AiDispatchSettingsModal } from './AiDispatchSettingsModal';
import { AiDispatchLeaderModal } from './AiDispatchLeaderModal';
import { AiDispatchDraftList } from './AiDispatchDraftList';
import { AiDispatchLaunchButton } from './AiDispatchLaunchButton';
import { AiDispatchHelpModal } from '../ai-dispatch-help/AiDispatchHelpModal';
import { AiDispatchHelpTrigger } from '../ai-dispatch-help/AiDispatchHelpTrigger';
import { AiDispatchProgressModal } from './AiDispatchProgressModal';
import type { TeamLeaderDispatchFormValue } from '../TeamLeaderDispatchFields';

const ScheduleDayMapModal = lazy(() =>
  import('../ScheduleDayMapModal').then((m) => ({ default: m.ScheduleDayMapModal })),
);

const BAND_ORDER = ['좋음', '보통', '피로', '매우피로'] as const;

const BAND_STYLE: Record<(typeof BAND_ORDER)[number], { chip: string; panel: string; fill: string; label: string }> = {
  좋음: { chip: 'bg-emerald-50 text-emerald-900 border-emerald-200', panel: 'border-emerald-200 bg-emerald-50/60', fill: 'bg-emerald-500', label: '좋음' },
  보통: { chip: 'bg-amber-50 text-amber-950 border-amber-200', panel: 'border-amber-200 bg-amber-50/70', fill: 'bg-amber-500', label: '보통' },
  피로: { chip: 'bg-red-50 text-red-900 border-red-200', panel: 'border-red-200 bg-red-50/70', fill: 'bg-red-500', label: '나쁨' },
  매우피로: { chip: 'bg-red-100 text-red-950 border-red-400', panel: 'border-red-400 bg-red-100/80', fill: 'bg-red-700', label: '매우 나쁨' },
};

const SLOT_ORDER = ['AM', 'PM', 'ALL_DAY', 'HUMAN'] as const;

const SLOT_STYLE: Record<(typeof SLOT_ORDER)[number], { stripe: string; chip: string; label: string }> = {
  AM: { stripe: 'border-l-amber-500', chip: 'bg-amber-50 text-amber-950 border-amber-200', label: '오전' },
  PM: { stripe: 'border-l-sky-500', chip: 'bg-sky-50 text-sky-950 border-sky-200', label: '오후' },
  ALL_DAY: { stripe: 'border-l-emerald-600', chip: 'bg-emerald-50 text-emerald-950 border-emerald-200', label: '종일' },
  HUMAN: { stripe: 'border-l-violet-500', chip: 'bg-violet-50 text-violet-950 border-violet-200', label: '사람 판단' },
};

function slotKey(slot: string): (typeof SLOT_ORDER)[number] {
  if (slot === 'AM' || slot === 'PM' || slot === 'ALL_DAY') return slot;
  return 'HUMAN';
}

function shownSlot(proposal: AiDispatchProposal, job?: AiDispatchJob): (typeof SLOT_ORDER)[number] {
  if (job && job.slot !== 'HUMAN') return slotKey(job.slot);
  return slotKey(proposal.slot);
}

function StepMark({ n }: { n: string }) {
  return (
    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-fluid-2xs font-semibold text-white">
      {n}
    </span>
  );
}

export function AiDispatchScreen({
  date,
  onDateChange,
  board,
  loading,
  running,
  drafting,
  progressStep,
  progressMessage,
  progressSeconds,
  leaderSaving,
  leaderSaveError,
  error,
  notice,
  picked,
  minPyeong,
  leaderCount,
  twoRoom,
  includeCrew,
  normalDays,
  normalJobs,
  onMinPyeong,
  onLeaderCount,
  onTwoRoom,
  onIncludeCrew,
  onNormalDays,
  onNormalJobs,
  onRun,
  onApprove,
  onToggle,
  onSelectAll,
  onOpenInquiry,
  onLeaderChange,
  onSaveSettings,
  onSaveLeader,
  reportOpen,
  onOpenReport,
  onCloseReport,
}: {
  date: string;
  onDateChange: (date: string) => void;
  board: AiDispatchBoard | null;
  loading: boolean;
  running: boolean;
  drafting: boolean;
  progressStep: number;
  progressMessage: string;
  progressSeconds: number;
  leaderSaving: boolean;
  leaderSaveError: string | null;
  error: string | null;
  notice: string | null;
  picked: string[];
  minPyeong: string;
  leaderCount: string;
  twoRoom: string;
  includeCrew: boolean;
  normalDays: string;
  normalJobs: string;
  onMinPyeong: (value: string) => void;
  onLeaderCount: (value: string) => void;
  onTwoRoom: (value: string) => void;
  onIncludeCrew: (value: boolean) => void;
  onNormalDays: (value: string) => void;
  onNormalJobs: (value: string) => void;
  onRun: () => void;
  onApprove: () => void;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onOpenInquiry: (inquiryId: string) => void;
  onLeaderChange: (id: string, teamLeaderId: string | null) => void;
  onSaveSettings: () => void;
  onSaveLeader: (leaderId: string, value: TeamLeaderDispatchFormValue) => Promise<void>;
  reportOpen: boolean;
  onOpenReport: () => void;
  onCloseReport: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dayMapOpen, setDayMapOpen] = useState(false);
  const [dayMapItems, setDayMapItems] = useState<ScheduleItem[]>([]);
  const [dayMapError, setDayMapError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [leaderOpen, setLeaderOpen] = useState<AiDispatchLeader | null>(null);
  useEffect(() => {
    setLeaderOpen((current) => {
      if (!current || !board) return current;
      return board.leaders.find((leader) => leader.id === current.id) ?? null;
    });
  }, [board]);
  const leaders = board?.leaders ?? [];
  const jobs = board?.jobs ?? [];
  const manualJobs = board?.manualJobs ?? [];
  const proposals = board?.run?.proposals ?? [];
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const draftCount = proposals.filter((row) => row.status === 'DRAFT' && row.teamLeaderId && shownSlot(row, jobById.get(row.inquiryId)) !== 'HUMAN').length;
  const openCount = proposals.filter((row) => !row.teamLeaderId && shownSlot(row, jobById.get(row.inquiryId)) !== 'HUMAN').length;
  const humanCount = proposals.filter((row) => shownSlot(row, jobById.get(row.inquiryId)) === 'HUMAN').length;
  const selectable = proposals.filter((row) => row.status === 'DRAFT' && row.teamLeaderId);
  const allPicked = selectable.length > 0 && selectable.every((row) => picked.includes(row.id));

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:gap-4">
      <header className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h1 className="text-fluid-lg font-semibold tracking-tight text-slate-900">AI 미리 배정</h1>
          <AiDispatchHelpTrigger onClick={() => setHelpOpen(true)} />
        </div>
        <p className="mt-0.5 text-fluid-xs text-slate-500">세 단계로 보고, 고른 건만 실제 배정됩니다.</p>
      </header>

      {board && !board.aiConfigured ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-xs text-amber-950">
          AI 미설정. 키를 연결하기 전에는 초안을 만들지 않습니다.
        </p>
      ) : null}
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800">{error}</p> : null}
      {notice ? <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-fluid-xs text-slate-700">{notice}</p> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <StepMark n="1" />
            <div className="min-w-0">
              <h2 className="text-fluid-sm font-semibold text-slate-900">날짜</h2>
              <p className="text-fluid-2xs text-slate-500">이 날짜의 예약완료·미배정만 초안이 됩니다.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-fluid-2xs font-medium text-slate-600">
              날짜
              <input
                type="date"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                className="ml-2 min-h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-fluid-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              />
            </label>
            <AiDispatchLaunchButton disabled={running} onClick={onRun}>
              {drafting ? '실행 중…' : 'AI 미리 배정'}
            </AiDispatchLaunchButton>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              aria-label="배정 규칙"
            >
              <LineMdIcon name="cog" className="size-5" />
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <CountChip label="미배정" value={loading && !board ? '…' : String(jobs.length)} />
          <CountChip label="수동배정" value={loading && !board ? '…' : String(manualJobs.length)} />
          <CountChip label="초안" value={String(draftCount)} />
          <CountChip label="팀장 없음" value={String(openCount)} />
          <CountChip label="사람 판단" value={String(humanCount)} />
        </div>
      </section>

      <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] lg:items-start sm:gap-4">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex items-start gap-2">
            <StepMark n="2" />
            <div>
              <h2 className="text-fluid-sm font-semibold text-slate-900">팀장 컨디션</h2>
              <p className="text-fluid-2xs text-slate-500">휴무 다음부터 0에서 다시 쌓입니다. 2주간 휴무가 없으면 매우 나쁨입니다.</p>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            {loading && !board ? <p className="text-fluid-xs text-slate-500">불러오는 중…</p> : null}
            {!loading && leaders.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-fluid-xs text-slate-500">
                집 주소가 있고 휴무가 아닌 팀장이 없습니다.
              </p>
            ) : null}
            {BAND_ORDER.map((band) => {
              const rows = leaders
                .filter((leader) => leader.band === band)
                .slice()
                .sort((a, b) => b.fatigue - a.fatigue);
              if (rows.length === 0) return null;
              return (
                <div key={band}>
                  <p className="mb-1.5 flex items-center gap-1.5 text-fluid-2xs font-semibold text-slate-700">
                    <span className={`rounded-full border px-2 py-0.5 ${BAND_STYLE[band].chip}`}>{BAND_STYLE[band].label}</span>
                    <span className="tabular-nums text-slate-500">{rows.length}명</span>
                  </p>
                  <ul className="space-y-1.5">
                    {rows.map((leader) => (
                      <LeaderCard key={leader.id} leader={leader} onOpen={() => setLeaderOpen(leader)} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <StepMark n="3" />
              <div className="min-w-0">
                <h2 className="text-fluid-sm font-semibold text-slate-900">초안 확인</h2>
                <p className="text-fluid-2xs text-slate-500">
                  {board?.run?.summary?.trim() || '팀장과 이유를 본 뒤 선택 승인합니다.'}
                </p>
                {dayMapError ? <p className="text-fluid-2xs text-red-700">{dayMapError}</p> : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const token = getToken();
                  if (!token) return;
                  setDayMapError(null);
                  void getSchedule(token, date, date)
                    .then((data) => {
                      setDayMapItems(data.items);
                      setDayMapOpen(true);
                    })
                    .catch((e: unknown) => setDayMapError(e instanceof Error ? e.message : '지도를 열지 못했습니다.'));
                }}
                className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                title="당일 전체 지도"
                aria-label="당일 전체 지도"
              >
                <LineMdIcon name="map-marker" className="size-5" />
              </button>
              <button
                type="button"
                disabled={proposals.length === 0}
                onClick={onOpenReport}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                배정 이유
              </button>
              <button
                type="button"
                disabled={selectable.length === 0}
                onClick={onSelectAll}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                {allPicked ? '선택 해제' : '전체 선택'}
              </button>
              <button
                type="button"
                disabled={running || picked.length === 0}
                onClick={onApprove}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                <LineMdIcon name="briefcase-check" className="size-4" />
                선택 승인{picked.length > 0 ? ` ${picked.length}` : ''}
              </button>
            </div>
          </div>

          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="시간대 색">
            {SLOT_ORDER.map((slot) => (
              <li key={slot} className={`rounded-full border px-2 py-0.5 text-fluid-2xs font-medium ${SLOT_STYLE[slot].chip}`}>
                {SLOT_STYLE[slot].label}
              </li>
            ))}
          </ul>

          <AiDispatchDraftList
            proposals={proposals}
            jobs={jobs}
            manualJobs={manualJobs}
            leaders={leaders}
            picked={picked}
            onToggle={onToggle}
            onLeaderChange={onLeaderChange}
            onOpenInquiry={onOpenInquiry}
          />
          {!loading && proposals.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center">
              <p className="text-fluid-sm font-medium text-slate-800">
                {jobs.length ? '아직 초안이 없습니다' : '배정할 예약완료가 없습니다'}
              </p>
              <p className="mt-1 text-fluid-xs text-slate-500">
                {jobs.length
                  ? `미배정 ${jobs.length}건. 위의 AI 미리 배정을 누르면 팀장별로 나뉩니다.`
                  : '날짜를 바꾸거나, 스케쥴에서 예약완료인 건을 확인하세요.'}
              </p>
            </div>
          ) : null}
        </section>
      </div>

      {settingsOpen ? (
        <AiDispatchSettingsModal
          minPyeong={minPyeong}
          leaderCount={leaderCount}
          twoRoom={twoRoom}
          includeCrew={includeCrew}
          normalDays={normalDays}
          normalJobs={normalJobs}
          onMinPyeong={onMinPyeong}
          onLeaderCount={onLeaderCount}
          onTwoRoom={onTwoRoom}
          onIncludeCrew={onIncludeCrew}
          onNormalDays={onNormalDays}
          onNormalJobs={onNormalJobs}
          onSave={onSaveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
      {leaderOpen ? (
        <AiDispatchLeaderModal
          leader={leaderOpen}
          saving={leaderSaving}
          saveError={leaderSaveError}
          onClose={() => setLeaderOpen(null)}
          onSave={(value) => onSaveLeader(leaderOpen.id, value)}
        />
      ) : null}
      {drafting ? <AiDispatchProgressModal step={progressStep} message={progressMessage} seconds={progressSeconds} /> : null}
      {reportOpen && board?.run ? <AiDispatchReasonModal board={board} onClose={onCloseReport} /> : null}
      <AiDispatchHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      {dayMapOpen && getToken() ? (
        <Suspense fallback={null}>
          <ScheduleDayMapModal
            open
            onClose={() => setDayMapOpen(false)}
            dateLabel={formatDateCompactWithWeekday(date)}
            items={dayMapItems}
            token={getToken() as string}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

function CountChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-fluid-2xs text-slate-600">
      {label}
      <span className="font-semibold tabular-nums text-slate-900">{value}</span>
    </span>
  );
}

function LeaderCard({ leader, onOpen }: { leader: AiDispatchLeader; onOpen: () => void }) {
  const band = BAND_STYLE[leader.band as (typeof BAND_ORDER)[number]] ?? BAND_STYLE.보통;
  const fatigue = Math.max(0, Math.min(100, Math.round(leader.fatigue)));
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`w-full rounded-xl border px-2.5 py-2 text-left hover:ring-2 hover:ring-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${band.panel}`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-fluid-sm font-semibold text-slate-900" title={leader.name}>
            {leader.name}
          </p>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-fluid-2xs font-semibold ${band.chip}`}>{band.label}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2" title={`피로 ${fatigue}. 100에 가까울수록 지친 상태`}>
          <div
            className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white ring-1 ring-slate-900/10"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={fatigue}
            aria-label={`${leader.name} 피로 ${fatigue}`}
          >
            <div className={`h-full rounded-full ${band.fill}`} style={{ width: `${fatigue}%` }} />
          </div>
          <span className="w-7 shrink-0 text-right text-fluid-2xs font-semibold tabular-nums text-slate-800">{fatigue}</span>
        </div>
        <p className="mt-1 text-fluid-2xs text-slate-700">
          이 날짜 남은 자리 <span className="font-semibold tabular-nums">{leader.remainingJobs}</span>건 · 하루 {leader.jobsPerDay}건
          <span className="text-slate-400"> · </span>
          {TEAM_LEADER_SIZE_POLICY_LABEL[leader.sizePolicy]}
        </p>
        <p className="mt-0.5 truncate text-fluid-2xs text-slate-600" title={leader.note}>
          {leader.note}
        </p>
      </button>
    </li>
  );
}

