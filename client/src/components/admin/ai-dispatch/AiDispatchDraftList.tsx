import {
  internalCustomerToneHint,
  internalCustomerToneImageSrc,
} from '../../../constants/internalCustomerTone';
import type { AiDispatchJob, AiDispatchLeader, AiDispatchProposal } from '../../../api/aiDispatch';

const SLOT_ORDER = ['AM', 'ALL_DAY', 'PM', 'HUMAN'] as const;

const SLOT_LABEL: Record<(typeof SLOT_ORDER)[number], string> = {
  AM: '오전 배정',
  ALL_DAY: '종일 배정',
  PM: '오후 배정',
  HUMAN: '사람 판단',
};

function slotKey(slot: string): (typeof SLOT_ORDER)[number] {
  if (slot === 'AM' || slot === 'PM' || slot === 'ALL_DAY') return slot;
  return 'HUMAN';
}

function shownSlot(proposal: AiDispatchProposal, job?: AiDispatchJob): (typeof SLOT_ORDER)[number] {
  if (job && job.slot !== 'HUMAN') return slotKey(job.slot);
  return slotKey(proposal.slot);
}

function bandWord(band: string): string {
  if (band === '피로') return '나쁨';
  if (band === '좋음' || band === '보통') return band;
  return band;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (n: number) => (n * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function kmText(km: number): string {
  const rounded = Math.round(km * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}km` : `${rounded.toFixed(1)}km`;
}

function shortPlace(label: string): string {
  const parts = label.split(/\s+/).filter(Boolean);
  return parts.slice(-2).join(' ') || label;
}

function JobLine({
  label,
  proposal,
  job,
  leaders,
  checked,
  onToggle,
  onLeaderChange,
}: {
  label: string;
  proposal: AiDispatchProposal;
  job?: AiDispatchJob;
  leaders: AiDispatchLeader[];
  checked: boolean;
  onToggle: (id: string) => void;
  onLeaderChange: (id: string, teamLeaderId: string | null) => void;
}) {
  const editable = proposal.status === 'DRAFT';
  const toneSrc = internalCustomerToneImageSrc(job?.tone);
  const toneHint = internalCustomerToneHint(job?.tone);
  const place = job?.areaLabel ? shortPlace(job.areaLabel) : '';

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {editable && proposal.teamLeaderId ? (
        <input
          type="checkbox"
          className="size-4 shrink-0 accent-slate-900"
          checked={checked}
          onChange={() => onToggle(proposal.id)}
          aria-label={`${proposal.customerName} 승인 선택`}
        />
      ) : (
        <span className="size-4 shrink-0" aria-hidden />
      )}
      <span className="w-16 shrink-0 text-fluid-2xs text-slate-500">{label}</span>
      {toneSrc ? <img src={toneSrc} alt={toneHint} title={toneHint} className="size-5 shrink-0" /> : null}
      <span className="min-w-0 truncate text-fluid-xs font-semibold text-slate-900" title={proposal.customerName}>
        {proposal.customerName}
      </span>
      {place ? (
        <span className="min-w-0 truncate text-fluid-2xs text-slate-500" title={job?.areaLabel}>
          {place}
        </span>
      ) : null}
      {editable ? (
        <select
          className="ml-auto h-8 max-w-[9rem] shrink-0 rounded-lg border border-slate-300 bg-white px-1.5 text-fluid-2xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          value={proposal.teamLeaderId ?? ''}
          aria-label={`${proposal.customerName} 팀장`}
          onChange={(e) => onLeaderChange(proposal.id, e.target.value || null)}
        >
          <option value="">팀장 없음</option>
          {leaders.map((leader) => (
            <option key={leader.id} value={leader.id}>
              {leader.name}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

function loopKm(leader: AiDispatchLeader, rows: AiDispatchProposal[], jobById: Map<string, AiDispatchJob>): number | null {
  const rank: Record<string, number> = { AM: 0, ALL_DAY: 1, PM: 2, HUMAN: 3 };
  const stops = rows
    .map((row) => jobById.get(row.inquiryId))
    .filter((job): job is AiDispatchJob => job != null && job.lat != null && job.lng != null)
    .sort((a, b) => (rank[a.slot] ?? 9) - (rank[b.slot] ?? 9));
  if (stops.length === 0 || !Number.isFinite(leader.homeLat) || !Number.isFinite(leader.homeLng)) return null;
  const home = { lat: leader.homeLat, lng: leader.homeLng };
  let total = haversineKm(home, { lat: stops[0].lat as number, lng: stops[0].lng as number });
  for (let i = 1; i < stops.length; i += 1) {
    total += haversineKm(
      { lat: stops[i - 1].lat as number, lng: stops[i - 1].lng as number },
      { lat: stops[i].lat as number, lng: stops[i].lng as number },
    );
  }
  const last = stops[stops.length - 1];
  total += haversineKm({ lat: last.lat as number, lng: last.lng as number }, home);
  return total;
}

function betweenText(rows: AiDispatchProposal[], jobById: Map<string, AiDispatchJob>): string {
  const am = rows.map((row) => jobById.get(row.inquiryId)).find((job) => job?.slot === 'AM');
  const pm = rows.map((row) => jobById.get(row.inquiryId)).find((job) => job?.slot === 'PM');
  if (!am || !pm || am.lat == null || am.lng == null || pm.lat == null || pm.lng == null) return '해당 없음';
  const km = haversineKm({ lat: am.lat, lng: am.lng }, { lat: pm.lat, lng: pm.lng });
  const from = shortPlace(am.areaLabel);
  const to = shortPlace(pm.areaLabel);
  return from && to ? `${kmText(km)} (${from}~${to})` : kmText(km);
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
    <div className="mt-3 space-y-2">
      {unassigned.length > 0 ? (
        <section className="space-y-1 rounded-xl border border-slate-300 bg-slate-50 p-2">
          <h3 className="text-fluid-xs font-semibold text-slate-900">{emptyTitle}</h3>
          {unassigned.map((proposal) => (
            <JobLine
              key={proposal.id}
              label={SLOT_LABEL[shownSlot(proposal, jobById.get(proposal.inquiryId))]}
              proposal={proposal}
              job={jobById.get(proposal.inquiryId)}
              leaders={leaders}
              checked={picked.includes(proposal.id)}
              onToggle={onToggle}
              onLeaderChange={onLeaderChange}
            />
          ))}
        </section>
      ) : null}
      {leaderIds.map((leaderId) => {
        const leader = leaderById.get(leaderId);
        const rows = (groups.get(leaderId) ?? []).slice().sort((a, b) => {
          const ai = SLOT_ORDER.indexOf(shownSlot(a, jobById.get(a.inquiryId)));
          const bi = SLOT_ORDER.indexOf(shownSlot(b, jobById.get(b.inquiryId)));
          return ai - bi;
        });
        const total = leader ? loopKm(leader, rows, jobById) : null;
        const since = leader?.detail.distanceSinceRestKm;
        const todayCount = rows.reduce((sum, row) => sum + (shownSlot(row, jobById.get(row.inquiryId)) === 'ALL_DAY' ? 2 : 1), 0);
        const reason = [...new Set(rows.map((row) => row.reason.trim()).filter(Boolean))].join(' · ');
        return (
          <section key={leaderId} className="space-y-1 rounded-xl border border-slate-200 bg-white p-2">
            <p className="truncate text-fluid-sm font-semibold text-slate-900">
              팀장명: {leader?.name ?? '팀장'}
              {leader ? (
                <span className="ml-2 font-medium text-slate-600">
                  피로도: {leader.fatigue} ({bandWord(leader.band)}) · 이 날짜 {todayCount}건 / 하루 {leader.jobsPerDay}건
                </span>
              ) : null}
            </p>
            {rows.map((proposal) => (
              <JobLine
                key={proposal.id}
                label={SLOT_LABEL[shownSlot(proposal, jobById.get(proposal.inquiryId))]}
                proposal={proposal}
                job={jobById.get(proposal.inquiryId)}
                leaders={leaders}
                checked={picked.includes(proposal.id)}
                onToggle={onToggle}
                onLeaderChange={onLeaderChange}
              />
            ))}
            <p className="text-fluid-2xs text-slate-700">배정간 거리: {betweenText(rows, jobById)}</p>
            <p className="text-fluid-2xs text-slate-700">총 거리: {total == null ? '위치를 찾지 못했습니다' : kmText(total)}</p>
            <p className="text-fluid-2xs text-slate-700">휴무이후 누적거리: {since == null ? '거리 없음' : `${since}km`}</p>
            {reason ? (
              <p className="truncate text-fluid-2xs text-slate-600" title={reason}>
                배정사유: {reason}
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
