import { aiDispatchSlotLabel } from '@shared/aiDispatch';
import { TEAM_LEADER_SIZE_POLICY_LABEL } from '@shared/teamLeaderDispatch';
import type { AiDispatchBoard, AiDispatchJob, AiDispatchLeader, AiDispatchProposal } from '../../../api/aiDispatch';
import { LineMdIcon } from '../../ui/LineMdIcon';
import { AiDispatchReasonModal } from './AiDispatchReasonModal';

const BAND_ORDER = ['좋음', '보통', '피로'] as const;

const BAND_STYLE: Record<(typeof BAND_ORDER)[number], { chip: string; panel: string; fill: string }> = {
  좋음: { chip: 'bg-emerald-50 text-emerald-900 border-emerald-200', panel: 'border-emerald-200 bg-emerald-50/60', fill: 'bg-emerald-500' },
  보통: { chip: 'bg-amber-50 text-amber-950 border-amber-200', panel: 'border-amber-200 bg-amber-50/70', fill: 'bg-amber-500' },
  피로: { chip: 'bg-red-50 text-red-900 border-red-200', panel: 'border-red-200 bg-red-50/70', fill: 'bg-red-500' },
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

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-fluid-xs font-medium text-slate-800">{label}</span>
      <span className="mt-0.5 block text-fluid-2xs text-slate-500">{hint}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-fluid-sm tabular-nums text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      />
    </label>
  );
}

export function AiDispatchScreen({
  date,
  onDateChange,
  board,
  loading,
  running,
  error,
  notice,
  picked,
  minPyeong,
  leaderCount,
  twoRoom,
  includeCrew,
  onMinPyeong,
  onLeaderCount,
  onTwoRoom,
  onIncludeCrew,
  onRun,
  onApprove,
  onToggle,
  onLeaderChange,
  onSaveSettings,
  reportOpen,
  onOpenReport,
  onCloseReport,
}: {
  date: string;
  onDateChange: (date: string) => void;
  board: AiDispatchBoard | null;
  loading: boolean;
  running: boolean;
  error: string | null;
  notice: string | null;
  picked: string[];
  minPyeong: string;
  leaderCount: string;
  twoRoom: string;
  includeCrew: boolean;
  onMinPyeong: (value: string) => void;
  onLeaderCount: (value: string) => void;
  onTwoRoom: (value: string) => void;
  onIncludeCrew: (value: boolean) => void;
  onRun: () => void;
  onApprove: () => void;
  onToggle: (id: string) => void;
  onLeaderChange: (id: string, teamLeaderId: string | null) => void;
  onSaveSettings: () => void;
  reportOpen: boolean;
  onOpenReport: () => void;
  onCloseReport: () => void;
}) {
  const leaders = board?.leaders ?? [];
  const jobs = board?.jobs ?? [];
  const proposals = board?.run?.proposals ?? [];
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const draftCount = proposals.filter((row) => row.status === 'DRAFT' && row.teamLeaderId && shownSlot(row, jobById.get(row.inquiryId)) !== 'HUMAN').length;
  const openCount = proposals.filter((row) => !row.teamLeaderId && shownSlot(row, jobById.get(row.inquiryId)) !== 'HUMAN').length;
  const humanCount = proposals.filter((row) => shownSlot(row, jobById.get(row.inquiryId)) === 'HUMAN').length;

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:gap-4">
      <header className="min-w-0">
        <h1 className="text-fluid-lg font-semibold tracking-tight text-slate-900">AI 미리 배정</h1>
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
            <button
              type="button"
              disabled={running}
              onClick={onRun}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <LineMdIcon name="calendar" className="size-4" />
              {running ? '실행 중…' : 'AI 미리 배정'}
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <CountChip label="미배정" value={loading && !board ? '…' : String(jobs.length)} />
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
              <p className="text-fluid-2xs text-slate-500">좋음은 멀리, 피로는 집 근처로 둡니다.</p>
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
                    <span className={`rounded-full border px-2 py-0.5 ${BAND_STYLE[band].chip}`}>{band}</span>
                    <span className="tabular-nums text-slate-500">{rows.length}명</span>
                  </p>
                  <ul className="space-y-1.5">
                    {rows.map((leader) => (
                      <LeaderCard key={leader.id} leader={leader} />
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
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={proposals.length === 0}
                onClick={onOpenReport}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                <LineMdIcon name="map-marker" className="size-4" />
                배정 이유
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

          <div className="mt-3 space-y-4">
            {SLOT_ORDER.map((slot) => {
              const rows = proposals.filter((proposal) => shownSlot(proposal, jobById.get(proposal.inquiryId)) === slot);
              if (rows.length === 0) return null;
              return (
                <div key={slot}>
                  <h3 className="mb-1.5 text-fluid-xs font-semibold text-slate-800">
                    {SLOT_STYLE[slot].label}
                    <span className="ml-1 font-normal tabular-nums text-slate-500">{rows.length}</span>
                  </h3>
                  <ul className="space-y-1.5">
                    {rows.map((proposal) => (
                      <ProposalCard
                        key={proposal.id}
                        proposal={proposal}
                        job={jobById.get(proposal.inquiryId)}
                        leaders={leaders}
                        checked={picked.includes(proposal.id)}
                        onToggle={onToggle}
                        onLeaderChange={onLeaderChange}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
            {!loading && proposals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center">
                <p className="text-fluid-sm font-medium text-slate-800">
                  {jobs.length ? '아직 초안이 없습니다' : '배정할 예약완료가 없습니다'}
                </p>
                <p className="mt-1 text-fluid-xs text-slate-500">
                  {jobs.length
                    ? `미배정 ${jobs.length}건. 위의 AI 미리 배정을 누르면 오전·오후로 나뉩니다.`
                    : '날짜를 바꾸거나, 스케쥴에서 예약완료인 건을 확인하세요.'}
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <details className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <summary className="cursor-pointer text-fluid-sm font-semibold text-slate-900">배정 규칙</summary>
        <p className="mt-1 text-fluid-2xs text-slate-500">
          큰 집만 팀장을 더 붙입니다. 사이청소·조율은 오전·오후가 정해진 건만 초안에 넣습니다. 피로는 마지막으로 쉰 다음 일만
          더합니다.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="이 평수 이상" hint="이 크기부터 팀장을 더 붙입니다" value={minPyeong} onChange={onMinPyeong} />
          <Field label="팀장 수" hint="위 평수일 때 붙는 인원" value={leaderCount} onChange={onLeaderCount} />
          <Field label="투룸 상한" hint="이 평수 이하는 작은 집으로 봅니다" value={twoRoom} onChange={onTwoRoom} />
        </div>
        <div className="mt-3">
          <p className="text-fluid-xs font-medium text-slate-800">팀원 점수</p>
          <p className="mt-0.5 text-fluid-2xs text-slate-500">
            켜면 팀원 없이 간 날에 피로를 더합니다. 팀원을 안 쓰는 업체는 끄세요.
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={includeCrew}
            onClick={() => onIncludeCrew(!includeCrew)}
            className={`mt-1.5 inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-fluid-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
              includeCrew
                ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            <span className={`inline-block size-3 rounded-full ${includeCrew ? 'bg-white' : 'bg-slate-300'}`} aria-hidden />
            {includeCrew ? '팀원 점수 포함' : '팀원 점수 제외'}
          </button>
        </div>
        <button
          type="button"
          onClick={onSaveSettings}
          className="mt-3 min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          규칙 저장
        </button>
      </details>
      {reportOpen && board?.run ? <AiDispatchReasonModal board={board} onClose={onCloseReport} /> : null}
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

function LeaderCard({ leader }: { leader: AiDispatchLeader }) {
  const band = BAND_STYLE[leader.band as (typeof BAND_ORDER)[number]] ?? BAND_STYLE.보통;
  const fatigue = Math.max(1, Math.min(100, Math.round(leader.fatigue || 1)));
  return (
    <li className={`rounded-xl border px-2.5 py-2 ${band.panel}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-fluid-sm font-semibold text-slate-900" title={leader.name}>
          {leader.name}
        </p>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-fluid-2xs font-semibold ${band.chip}`}>{leader.band}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2" title={`피로 ${fatigue}. 100에 가까울수록 지친 상태`}>
        <div
          className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white ring-1 ring-slate-900/10"
          role="meter"
          aria-valuemin={1}
          aria-valuemax={100}
          aria-valuenow={fatigue}
          aria-label={`${leader.name} 피로 ${fatigue}`}
        >
          <div className={`h-full rounded-full ${band.fill}`} style={{ width: `${fatigue}%` }} />
        </div>
        <span className="w-7 shrink-0 text-right text-fluid-2xs font-semibold tabular-nums text-slate-800">{fatigue}</span>
      </div>
      <p className="mt-1 text-fluid-2xs text-slate-700">
        남음 <span className="font-semibold tabular-nums">{leader.remainingJobs}</span>건
        <span className="text-slate-400"> · </span>
        {TEAM_LEADER_SIZE_POLICY_LABEL[leader.sizePolicy]}
      </p>
      <p className="mt-0.5 truncate text-fluid-2xs text-slate-600" title={leader.note}>
        {leader.note}
      </p>
    </li>
  );
}

function ProposalCard({
  job,
  proposal,
  leaders,
  checked,
  onToggle,
  onLeaderChange,
}: {
  job: AiDispatchJob | undefined;
  proposal: AiDispatchProposal;
  leaders: AiDispatchLeader[];
  checked: boolean;
  onToggle: (id: string) => void;
  onLeaderChange: (id: string, teamLeaderId: string | null) => void;
}) {
  const slot = shownSlot(proposal, job);
  const style = SLOT_STYLE[slot];
  const editable = proposal.status === 'DRAFT';
  const needsPerson = slot === 'HUMAN' || !proposal.teamLeaderId;
  const statusLabel =
    proposal.status === 'APPROVED' ? '반영됨' : proposal.status === 'STALE' ? '다시 실행' : proposal.status === 'SKIPPED' ? '건너뜀' : null;

  return (
    <li className={`rounded-xl border border-slate-200 border-l-4 bg-white p-2.5 sm:p-3 ${style.stripe}`}>
      <div className="flex items-start gap-2">
        {editable && !needsPerson ? (
          <input
            type="checkbox"
            className="mt-1 size-4 accent-slate-900"
            checked={checked}
            onChange={() => onToggle(proposal.id)}
            aria-label={`${proposal.customerName} 승인 선택`}
          />
        ) : (
          <span className="mt-1 size-4 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="min-w-0 truncate text-fluid-sm font-semibold text-slate-900" title={proposal.customerName}>
              {proposal.customerName}
            </p>
            <span className={`rounded-full border px-2 py-0.5 text-fluid-2xs font-medium ${style.chip}`}>{style.label}</span>
            {statusLabel ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-fluid-2xs text-slate-600">{statusLabel}</span>
            ) : null}
            {!proposal.teamLeaderId && slot !== 'HUMAN' ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-fluid-2xs text-slate-600">팀장 없음</span>
            ) : null}
          </div>
          <p className="mt-1 flex flex-wrap gap-1 text-fluid-2xs text-slate-600">
            {job?.pyeong != null ? <span className="rounded-md bg-slate-100 px-1.5 py-0.5 tabular-nums">{job.pyeong}평</span> : null}
            {job?.isOneRoom ? <span className="rounded-md bg-slate-100 px-1.5 py-0.5">원룸</span> : null}
            {job?.areaLabel ? <span className="max-w-[16rem] truncate rounded-md bg-slate-100 px-1.5 py-0.5" title={job.areaLabel}>{job.areaLabel}</span> : null}
            {job?.preferredTime ? <span className="rounded-md bg-slate-100 px-1.5 py-0.5">{job.preferredTime}</span> : null}
            {proposal.fromHomeKm != null ? (
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 tabular-nums">집에서 편도 {proposal.fromHomeKm}km</span>
            ) : null}
          </p>
          <p className="mt-1.5 text-fluid-xs leading-snug text-slate-700">{proposal.reason}</p>
          {editable ? (
            <label className="mt-2 block">
              <span className="mb-1 block text-fluid-2xs font-medium text-slate-500">팀장</span>
              <select
                className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-fluid-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                value={proposal.teamLeaderId ?? ''}
                onChange={(e) => onLeaderChange(proposal.id, e.target.value || null)}
              >
                <option value="">배정 안 함</option>
                {leaders.map((leader) => (
                  <option key={leader.id} value={leader.id}>
                    {leader.name} · {leader.band} · 남음 {leader.remainingJobs}
                  </option>
                ))}
              </select>
            </label>
          ) : proposal.teamLeaderName ? (
            <p className="mt-2 text-fluid-xs font-medium text-slate-800">{proposal.teamLeaderName}</p>
          ) : (
            <p className="mt-2 text-fluid-xs text-slate-600">{slot === 'HUMAN' ? aiDispatchSlotLabel('HUMAN') : '팀장 없음'}</p>
          )}
        </div>
      </div>
    </li>
  );
}
