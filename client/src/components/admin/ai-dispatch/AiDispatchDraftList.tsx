import {
  internalCustomerToneHint,
  internalCustomerToneImageSrc,
} from '../../../constants/internalCustomerTone';
import type { AiDispatchJob, AiDispatchLeader, AiDispatchProposal } from '../../../api/aiDispatch';
import { AiDispatchRouteMap } from './AiDispatchRouteMap';

const SLOT_ORDER = ['AM', 'ALL_DAY', 'PM', 'HUMAN'] as const;

const SLOT_STYLE: Record<(typeof SLOT_ORDER)[number], { stripe: string; chip: string; label: string; color: string }> = {
  AM: { stripe: 'border-l-amber-500', chip: 'bg-amber-50 text-amber-950 border-amber-200', label: '오전', color: '#f59e0b' },
  PM: { stripe: 'border-l-sky-500', chip: 'bg-sky-50 text-sky-950 border-sky-200', label: '오후', color: '#0ea5e9' },
  ALL_DAY: { stripe: 'border-l-emerald-600', chip: 'bg-emerald-50 text-emerald-950 border-emerald-200', label: '종일', color: '#059669' },
  HUMAN: { stripe: 'border-l-violet-500', chip: 'bg-violet-50 text-violet-950 border-violet-200', label: '사람 판단', color: '#8b5cf6' },
};

function slotKey(slot: string): (typeof SLOT_ORDER)[number] {
  if (slot === 'AM' || slot === 'PM' || slot === 'ALL_DAY') return slot;
  return 'HUMAN';
}

function shownSlot(proposal: AiDispatchProposal, job?: AiDispatchJob): (typeof SLOT_ORDER)[number] {
  if (job && job.slot !== 'HUMAN') return slotKey(job.slot);
  return slotKey(proposal.slot);
}

function JobRow({
  proposal,
  job,
  leaders,
  checked,
  onToggle,
  onLeaderChange,
}: {
  proposal: AiDispatchProposal;
  job?: AiDispatchJob;
  leaders: AiDispatchLeader[];
  checked: boolean;
  onToggle: (id: string) => void;
  onLeaderChange: (id: string, teamLeaderId: string | null) => void;
}) {
  const slot = shownSlot(proposal, job);
  const style = SLOT_STYLE[slot];
  const editable = proposal.status === 'DRAFT';
  const toneSrc = internalCustomerToneImageSrc(job?.tone);
  const toneHint = internalCustomerToneHint(job?.tone);

  return (
    <li className={`rounded-lg border border-slate-200 border-l-4 bg-white px-2 py-2 ${style.stripe}`}>
      <div className="flex items-start gap-2">
        {editable && proposal.teamLeaderId ? (
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
          <div className="flex items-center gap-1.5">
            {toneSrc ? <img src={toneSrc} alt={toneHint} title={toneHint} className="size-5 shrink-0" /> : null}
            <p className="min-w-0 flex-1 truncate text-fluid-sm font-semibold text-slate-900" title={proposal.customerName}>
              {proposal.customerName}
            </p>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-fluid-2xs font-medium ${style.chip}`}>{style.label}</span>
          </div>
          <p className="mt-1 truncate text-fluid-2xs text-slate-600" title={job?.areaLabel || proposal.reason}>
            {[job?.isOneRoom ? '원룸' : null, job?.pyeong != null ? `${job.pyeong}평` : null, job?.areaLabel, proposal.fromHomeKm != null ? `집 편도 ${proposal.fromHomeKm}km` : null]
              .filter(Boolean)
              .join(' · ') || proposal.reason}
          </p>
          {editable ? (
            <label className="mt-1.5 block">
              <span className="sr-only">팀장</span>
              <select
                className="min-h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-fluid-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                value={proposal.teamLeaderId ?? ''}
                onChange={(e) => onLeaderChange(proposal.id, e.target.value || null)}
              >
                <option value="">팀장 없음</option>
                {leaders.map((leader) => (
                  <option key={leader.id} value={leader.id}>
                    {leader.name} · {leader.band}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function routePins(leader: AiDispatchLeader | null, rows: AiDispatchProposal[], jobById: Map<string, AiDispatchJob>) {
  const pins: Array<{ lat: number; lng: number; label: string; color: string }> = [];
  if (leader && Number.isFinite(leader.homeLat) && Number.isFinite(leader.homeLng)) {
    pins.push({ lat: leader.homeLat, lng: leader.homeLng, label: '집', color: '#334155' });
  }
  for (const row of rows) {
    const job = jobById.get(row.inquiryId);
    if (job?.lat == null || job.lng == null) continue;
    const slot = shownSlot(row, job);
    pins.push({ lat: job.lat, lng: job.lng, label: SLOT_STYLE[slot].label, color: SLOT_STYLE[slot].color });
  }
  return pins;
}

export function AiDispatchDraftList({
  proposals,
  jobs,
  leaders,
  picked,
  onToggle,
  onLeaderChange,
}: {
  proposals: AiDispatchProposal[];
  jobs: AiDispatchJob[];
  leaders: AiDispatchLeader[];
  picked: string[];
  onToggle: (id: string) => void;
  onLeaderChange: (id: string, teamLeaderId: string | null) => void;
}) {
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const leaderById = new Map(leaders.map((leader) => [leader.id, leader]));
  const unassigned = proposals.filter((row) => !row.teamLeaderId);
  const groups = new Map<string, AiDispatchProposal[]>();
  for (const row of proposals) {
    if (!row.teamLeaderId) continue;
    const list = groups.get(row.teamLeaderId) ?? [];
    list.push(row);
    groups.set(row.teamLeaderId, list);
  }
  const leaderIds = [...groups.keys()].sort((a, b) => (leaderById.get(a)?.name ?? '').localeCompare(leaderById.get(b)?.name ?? '', 'ko'));
  const emptyTitle = unassigned.every((row) => row.reason.includes('넣을 팀장')) ? '넣을 팀장이 없습니다' : '모든 팀장이 배정된 상태입니다';

  return (
    <div className="mt-3 space-y-3">
      {unassigned.length > 0 ? (
        <section className="rounded-xl border border-slate-300 bg-slate-50 p-2">
          <h3 className="px-1 text-fluid-xs font-semibold text-slate-900">{emptyTitle}</h3>
          <ul className="mt-1.5 space-y-1.5">
            {unassigned.map((proposal) => (
              <JobRow
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
        </section>
      ) : null}
      {leaderIds.map((leaderId) => {
        const leader = leaderById.get(leaderId);
        const rows = (groups.get(leaderId) ?? []).slice().sort((a, b) => {
          const ai = SLOT_ORDER.indexOf(shownSlot(a, jobById.get(a.inquiryId)));
          const bi = SLOT_ORDER.indexOf(shownSlot(b, jobById.get(b.inquiryId)));
          return ai - bi;
        });
        const pins = routePins(leader ?? null, rows, jobById);
        return (
          <section key={leaderId} className="rounded-xl border border-slate-200 bg-white p-2">
            <h3 className="truncate px-1 text-fluid-sm font-semibold text-slate-900">{leader?.name ?? '팀장'}</h3>
            {leader ? (
              <p className="px-1 text-fluid-2xs text-slate-500">
                {leader.band} · 하루 {leader.jobsPerDay}건
              </p>
            ) : null}
            <ul className="mt-1.5 space-y-1.5">
              {rows.map((proposal) => (
                <JobRow
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
            <div className="mt-2">
              <AiDispatchRouteMap pins={pins} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
