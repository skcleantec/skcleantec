import {
  internalCustomerToneHint,
  internalCustomerToneImageSrc,
} from '../../../constants/internalCustomerTone';
import type { AiDispatchJob, AiDispatchLeader, AiDispatchManualJob, AiDispatchProposal } from '../../../api/aiDispatch';
import { LineMdIcon } from '../../ui/LineMdIcon';
import { AiDispatchMapPreview } from './AiDispatchRouteMap';

const SLOT_ORDER = ['AM', 'ALL_DAY', 'PM', 'HUMAN'] as const;

const SLOT_LABEL: Record<(typeof SLOT_ORDER)[number], string> = {
  AM: '오전',
  ALL_DAY: '종일',
  PM: '오후',
  HUMAN: '사람 판단',
};

const SLOT_BOX: Record<(typeof SLOT_ORDER)[number], { box: string; pin: string }> = {
  AM: { box: 'border-amber-200 bg-amber-50', pin: '#f59e0b' },
  ALL_DAY: { box: 'border-emerald-200 bg-emerald-50', pin: '#059669' },
  PM: { box: 'border-sky-200 bg-sky-50', pin: '#0ea5e9' },
  HUMAN: { box: 'border-violet-200 bg-violet-50', pin: '#8b5cf6' },
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
  if (band === '매우피로') return '매우 나쁨';
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

function OneTwoRoomMark({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-rose-100 px-1 py-0.5 text-fluid-2xs font-semibold text-rose-800 ring-1 ring-rose-300"
      title="원·투룸"
    >
      <LineMdIcon name="home" className="size-3.5 text-rose-800" />
      원·투룸
    </span>
  );
}

function JobLine({
  label,
  proposal,
  job,
  leaders,
  checked,
  onToggle,
  onLeaderChange,
  onOpenInquiry,
  assignedLeaderIds,
}: {
  label: string;
  proposal: AiDispatchProposal;
  job?: AiDispatchJob;
  leaders: AiDispatchLeader[];
  checked: boolean;
  onToggle: (id: string) => void;
  onLeaderChange: (id: string, teamLeaderId: string | null) => void;
  onOpenInquiry: (inquiryId: string) => void;
  assignedLeaderIds: Set<string>;
}) {
  const editable = proposal.status === 'DRAFT';
  const toneSrc = internalCustomerToneImageSrc(job?.tone);
  const toneHint = internalCustomerToneHint(job?.tone);
  const place = job?.areaLabel ? shortPlace(job.areaLabel) : '';
  const slot = shownSlot(proposal, job);
  const box = SLOT_BOX[slot];

  return (
    <div className={`flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 ${box.box}`}>
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
      <button
        type="button"
        onClick={() => onOpenInquiry(proposal.inquiryId)}
        className="min-w-0 truncate text-left text-fluid-xs font-semibold text-slate-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        title={proposal.customerName}
      >
        {proposal.customerName}
      </button>
      <OneTwoRoomMark on={job?.isOneRoom === true} />
      <span className="min-w-0 truncate text-fluid-2xs text-slate-600" title={job?.areaLabel || '주소 없음'}>
        {place || '주소 없음'}
      </span>
      <span className="shrink-0 text-fluid-2xs font-medium tabular-nums text-slate-800">
        {job?.pyeong != null ? `${job.pyeong}평` : '평수 없음'}
      </span>
      {editable ? (
        <select
          className="ml-auto h-8 max-w-[9rem] shrink-0 rounded-lg border border-slate-300 bg-white px-1.5 text-fluid-2xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          value={proposal.teamLeaderId ?? ''}
          aria-label={`${proposal.customerName} 팀장`}
          onChange={(e) => onLeaderChange(proposal.id, e.target.value || null)}
        >
          <option value="" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
            팀장 없음
          </option>
          {leaders.map((leader) => {
            const taken = assignedLeaderIds.has(leader.id);
            return (
              <option
                key={leader.id}
                value={leader.id}
                style={{ backgroundColor: taken ? '#fbcfe8' : '#ffffff', color: taken ? '#831843' : '#0f172a' }}
              >
                {leader.name}
              </option>
            );
          })}
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

function routePins(leader: AiDispatchLeader | null, rows: AiDispatchProposal[], jobById: Map<string, AiDispatchJob>) {
  const pins: Array<{ lat: number; lng: number; label: string; color: string }> = [];
  if (leader && Number.isFinite(leader.homeLat) && Number.isFinite(leader.homeLng)) {
    pins.push({ lat: leader.homeLat, lng: leader.homeLng, label: '출발', color: '#334155' });
  }
  for (const row of rows) {
    const job = jobById.get(row.inquiryId);
    if (job?.lat == null || job.lng == null) continue;
    const slot = shownSlot(row, job);
    pins.push({ lat: job.lat, lng: job.lng, label: SLOT_LABEL[slot], color: SLOT_BOX[slot].pin });
  }
  return pins;
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
  manualJobs,
  leaders,
  picked,
  onToggle,
  onLeaderChange,
  onOpenInquiry,
}: {
  proposals: AiDispatchProposal[];
  jobs: AiDispatchJob[];
  manualJobs: AiDispatchManualJob[];
  leaders: AiDispatchLeader[];
  picked: string[];
  onToggle: (id: string) => void;
  onLeaderChange: (id: string, teamLeaderId: string | null) => void;
  onOpenInquiry: (inquiryId: string) => void;
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
  const manualLeaderIds = new Set(manualJobs.map((job) => job.teamLeaderId));
  const manualRows = manualJobs.slice().sort((a, b) => {
    const slot = SLOT_ORDER.indexOf(slotKey(a.slot)) - SLOT_ORDER.indexOf(slotKey(b.slot));
    if (slot !== 0) return slot;
    return a.teamLeaderName.localeCompare(b.teamLeaderName, 'ko') || a.customerName.localeCompare(b.customerName, 'ko');
  });
  const assignedLeaderIds = new Set(proposals.map((row) => row.teamLeaderId).filter((id): id is string => Boolean(id)));
  const draftUse = new Map<string, number>();
  for (const row of proposals) {
    if (!row.teamLeaderId) continue;
    const weight = shownSlot(row, jobById.get(row.inquiryId)) === 'ALL_DAY' ? 2 : 1;
    draftUse.set(row.teamLeaderId, (draftUse.get(row.teamLeaderId) ?? 0) + weight);
  }
  const idleLeaders = leaders.filter((leader) => !assignedLeaderIds.has(leader.id) && !manualLeaderIds.has(leader.id));
  const roomLeaders = leaders.filter((leader) => leader.remainingJobs - (draftUse.get(leader.id) ?? 0) > 0);
  const idleNames = idleLeaders.map((leader) => leader.name).join(', ');
  const roomNames = roomLeaders.map((leader) => leader.name).join(', ');

  return (
    <div className="mt-3 space-y-2">
      {manualRows.length > 0 ? (
        <section className="space-y-1 rounded-xl border border-rose-200 bg-rose-50 p-2">
          <h3 className="text-fluid-xs font-semibold text-rose-950">수동배정 {manualRows.length}건</h3>
          {manualRows.map((job) => (
            <div
              key={`${job.id}-${job.teamLeaderId}`}
              className="flex min-w-0 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2 py-1.5"
            >
              <span className="w-16 shrink-0 text-fluid-2xs text-slate-500">{SLOT_LABEL[slotKey(job.slot)]}</span>
              <button
                type="button"
                onClick={() => onOpenInquiry(job.id)}
                className="min-w-0 truncate text-left text-fluid-xs font-semibold text-slate-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                title={job.customerName}
              >
                {job.customerName}
              </button>
              <OneTwoRoomMark on={job.isOneRoom} />
              <span className="min-w-0 truncate text-fluid-2xs text-slate-600" title={job.areaLabel || '주소 없음'}>
                {shortPlace(job.areaLabel) || '주소 없음'}
              </span>
              <span className="shrink-0 text-fluid-2xs font-medium tabular-nums text-slate-800">
                {job.pyeong != null ? `${job.pyeong}평` : '평수 없음'}
              </span>
              <span className="ml-auto shrink-0 truncate text-fluid-2xs font-medium text-rose-900" title={job.teamLeaderName}>
                {job.teamLeaderName}
              </span>
            </div>
          ))}
        </section>
      ) : null}
      {unassigned.length > 0 ? (
        <section className="space-y-1 rounded-xl border border-slate-300 bg-slate-50 p-2">
          <h3 className="text-fluid-xs font-semibold text-slate-900">
            {unassigned.every((row) => row.reason.includes('넣을 팀장'))
              ? '넣을 팀장이 없습니다'
              : idleLeaders.length > 0
                ? `미배정 팀장 ${idleLeaders.length}명: ${idleNames}`
                : '모든 팀장이 배정된 상태입니다'}
          </h3>
          {idleLeaders.length > 0 ? (
            <p className="text-fluid-2xs leading-snug text-slate-600">
              {roomLeaders.length > 0
                ? `자리 남음: ${roomNames}. 오전이 더 많아도 자리가 있으면 그 팀장에게 넣습니다. AI 미리 배정을 다시 누르면 반영됩니다.`
                : '이 팀장들은 오늘 칸이 이미 차 있습니다. 오전과 오후 개수가 달라서 뺀 것이 아닙니다.'}
            </p>
          ) : null}
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
              onOpenInquiry={onOpenInquiry}
              assignedLeaderIds={assignedLeaderIds}
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
        const pins = routePins(leader ?? null, rows, jobById);
        return (
          <section key={leaderId} className="rounded-xl border border-slate-200 bg-white p-2">
            <p className="truncate text-fluid-sm font-semibold text-slate-900">
              팀장명: {leader?.name ?? '팀장'}
              {leader ? (
                <span className="ml-2 font-medium text-slate-600">
                  피로도: {leader.fatigue} ({bandWord(leader.band)}) · 이 날짜 {todayCount}건 / 하루 {leader.jobsPerDay}건
                </span>
              ) : null}
            </p>
            <div className="mt-1.5 flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-1">
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
                    onOpenInquiry={onOpenInquiry}
                    assignedLeaderIds={assignedLeaderIds}
                  />
                ))}
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-fluid-2xs text-slate-800">
                  배정간 거리: {betweenText(rows, jobById)}
                </p>
                <p className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-fluid-2xs font-medium text-slate-900">
                  총 거리: {total == null ? '위치를 찾지 못했습니다' : kmText(total)}
                </p>
                <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-fluid-2xs text-indigo-950">
                  휴무이후 누적거리: {since == null ? '거리 없음' : `${since}km`}
                </p>
                {reason ? (
                  <p className="truncate rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-fluid-2xs text-slate-700" title={reason}>
                    배정사유: {reason}
                  </p>
                ) : null}
              </div>
              <AiDispatchMapPreview pins={pins} />
            </div>
          </section>
        );
      })}
      {unassigned.length === 0 && idleLeaders.length > 0 ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-fluid-2xs leading-snug text-slate-700">
          미배정 팀장 {idleLeaders.length}명: {idleNames}. 열린 일정보다 팀장이 많아 일이 없습니다.
        </p>
      ) : null}
    </div>
  );
}
