import { aiDispatchSlotLabel } from '@shared/aiDispatch';
import { TEAM_LEADER_SIZE_POLICY_LABEL } from '@shared/teamLeaderDispatch';
import type { AiDispatchJob, AiDispatchLeader, AiDispatchProposal } from '../../../api/aiDispatch';

const BAND_CLASS: Record<string, string> = {
  좋음: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  보통: 'bg-amber-50 text-amber-900 border-amber-200',
  피로: 'bg-red-50 text-red-800 border-red-200',
};

export function AiDispatchLeaderStrip({ leaders }: { leaders: AiDispatchLeader[] }) {
  if (leaders.length === 0) {
    return <p className="text-fluid-xs text-slate-500">집 주소가 있고 휴무가 아닌 팀장이 없습니다.</p>;
  }
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {leaders.map((leader) => (
        <div key={leader.id} className="min-w-[9.5rem] rounded-lg border border-slate-200 bg-white p-2">
          <p className="truncate text-fluid-xs font-semibold text-slate-900" title={leader.name}>
            {leader.name}
          </p>
          <p className={`mt-1 inline-flex rounded border px-1.5 py-0 text-fluid-2xs ${BAND_CLASS[leader.band] ?? ''}`}>
            {leader.band}
          </p>
          <p className="mt-1 line-clamp-2 text-fluid-2xs text-slate-500" title={leader.note}>
            {leader.note}
          </p>
          <p className="mt-1 text-fluid-2xs text-slate-600">
            남음 {leader.remainingJobs}건 · {TEAM_LEADER_SIZE_POLICY_LABEL[leader.sizePolicy]}
          </p>
        </div>
      ))}
    </div>
  );
}

export function AiDispatchProposalCard({
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
  const editable = proposal.status === 'DRAFT';
  const human = proposal.slot === 'HUMAN' || !proposal.teamLeaderId;
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-2 sm:p-3">
      <div className="flex items-start gap-2">
        {editable && !human ? (
          <input
            type="checkbox"
            className="mt-1 size-4"
            checked={checked}
            onChange={() => onToggle(proposal.id)}
            aria-label="승인 선택"
          />
        ) : (
          <span className="mt-0.5 text-fluid-2xs text-slate-400">{proposal.status === 'APPROVED' ? '반영' : proposal.status === 'STALE' ? '오래됨' : ''}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-fluid-sm font-semibold text-slate-900" title={proposal.customerName}>
            {proposal.customerName}
          </p>
          <p className="truncate text-fluid-2xs text-slate-500">
            {aiDispatchSlotLabel(proposal.slot)}
            {job?.pyeong != null ? ` · ${job.pyeong}평` : ''}
            {job?.isOneRoom ? ' · 원룸' : ''}
            {job ? ` · ${job.areaLabel}` : ''}
          </p>
          <p className="mt-1 text-fluid-xs leading-snug text-slate-700">{proposal.reason}</p>
          {editable ? (
            <label className="mt-2 block">
              <span className="mb-1 block text-fluid-2xs text-slate-500">팀장</span>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-fluid-xs"
                value={proposal.teamLeaderId ?? ''}
                onChange={(e) => onLeaderChange(proposal.id, e.target.value || null)}
              >
                <option value="">사람 판단</option>
                {leaders.map((leader) => (
                  <option key={leader.id} value={leader.id}>
                    {leader.name} · {leader.band}
                  </option>
                ))}
              </select>
            </label>
          ) : proposal.teamLeaderName ? (
            <p className="mt-1 text-fluid-xs text-slate-800">{proposal.teamLeaderName}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
