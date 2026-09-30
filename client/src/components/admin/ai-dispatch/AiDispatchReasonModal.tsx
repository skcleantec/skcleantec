import { createPortal } from 'react-dom';
import type { AiDispatchBoard, AiDispatchJob, AiDispatchProposal } from '../../../api/aiDispatch';
import { internalCustomerToneHint, internalCustomerToneImageSrc } from '../../../constants/internalCustomerTone';
import { LineMdIcon } from '../../ui/LineMdIcon';

const SLOT_ORDER = ['AM', 'ALL_DAY', 'PM', 'HUMAN'] as const;

const SLOT_LOOK: Record<(typeof SLOT_ORDER)[number], { label: string; dot: string; box: string }> = {
  AM: { label: '오전', dot: 'bg-amber-500', box: 'border-amber-200 bg-amber-50' },
  ALL_DAY: { label: '종일', dot: 'bg-emerald-600', box: 'border-emerald-200 bg-emerald-50' },
  PM: { label: '오후', dot: 'bg-sky-500', box: 'border-sky-200 bg-sky-50' },
  HUMAN: { label: '사람 판단', dot: 'bg-violet-500', box: 'border-violet-200 bg-violet-50' },
};

function slotKey(slot: string): (typeof SLOT_ORDER)[number] {
  if (slot === 'AM' || slot === 'PM' || slot === 'ALL_DAY') return slot;
  return 'HUMAN';
}

function bandWord(band: string): string {
  if (band === '매우피로') return '매우 나쁨';
  if (band === '피로') return '나쁨';
  return band;
}

function shortPlace(area: string): string {
  const parts = area.split(/\s+/).filter(Boolean);
  return parts.slice(-2).join(' ') || area;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (n: number) => (n * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function kmText(km: number): string {
  return `${Math.round(km * 10) / 10}km`;
}

export function AiDispatchReasonModal({ board, onClose }: { board: AiDispatchBoard; onClose: () => void }) {
  const proposals = board.run?.proposals ?? [];
  const jobById = new Map(board.jobs.map((job) => [job.id, job]));
  const leaderById = new Map(board.leaders.map((leader) => [leader.id, leader]));
  const unassigned = proposals.filter((row) => !row.teamLeaderId);
  const groups = new Map<string, AiDispatchProposal[]>();
  for (const row of proposals) {
    if (!row.teamLeaderId) continue;
    const list = groups.get(row.teamLeaderId) ?? [];
    list.push(row);
    groups.set(row.teamLeaderId, list);
  }
  const leaderIds = [...groups.keys()].sort((a, b) => (leaderById.get(a)?.name ?? '').localeCompare(leaderById.get(b)?.name ?? '', 'ko'));
  const idle = board.leaders.filter((leader) => !groups.has(leader.id)).map((leader) => leader.name);

  return createPortal(
    <div
      className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-dispatch-reason-title"
        className="modal-mobile-fullscreen-panel flex max-h-[min(92vh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-slate-50 shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 bg-slate-900 px-3 py-2.5 text-white">
          <div className="flex min-w-0 items-center gap-2">
            <LineMdIcon name="compass" className="size-5 shrink-0 text-sky-300" />
            <div className="min-w-0">
              <p className="text-fluid-2xs text-slate-300">AI 미리 배정</p>
              <h2 id="ai-dispatch-reason-title" className="truncate text-fluid-sm font-semibold">
                이렇게 배정한 이유
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-lg text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            aria-label="닫기"
          >
            <LineMdIcon name="close" className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
          {unassigned.length > 0 ? (
            <section className="rounded-2xl border border-slate-300 bg-white p-2">
              <p className="text-fluid-xs font-semibold text-slate-900">팀장 없음 {unassigned.length}건</p>
              {idle.length > 0 ? (
                <p className="mt-0.5 text-fluid-2xs text-slate-600">미배정 팀장: {idle.join(', ')}</p>
              ) : null}
              <ul className="mt-1.5 space-y-1">
                {unassigned.map((proposal) => (
                  <JobStop key={proposal.id} proposal={proposal} job={jobById.get(proposal.inquiryId)} />
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
            const stops = rows
              .map((row) => jobById.get(row.inquiryId))
              .filter((job): job is AiDispatchJob => job != null && job.lat != null && job.lng != null);
            const between = betweenOf(stops);
            const total = leader ? loopOf(leader.homeLat, leader.homeLng, stops) : null;
            const reason = [...new Set(rows.map((row) => row.reason.trim()).filter(Boolean))].join(' · ');
            return (
              <section key={leaderId} className="rounded-2xl border border-slate-200 bg-white p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-fluid-sm font-semibold text-slate-900">{leader?.name ?? rows[0]?.teamLeaderName ?? '팀장'}</p>
                  {leader ? (
                    <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-fluid-2xs font-medium text-slate-700">
                      피로 {leader.fatigue} · {bandWord(leader.band)}
                    </span>
                  ) : null}
                </div>
                <ol className="mt-2 space-y-1.5 border-l border-slate-200 pl-3">
                  <li className="relative text-fluid-2xs text-slate-500">
                    <span className="absolute -left-[1.05rem] top-1 size-2 rounded-full bg-slate-700" />
                    출발 · 집
                  </li>
                  {rows.map((proposal) => {
                    const look = SLOT_LOOK[shownSlot(proposal, jobById.get(proposal.inquiryId))];
                    return (
                      <li key={proposal.id} className="relative">
                        <span className={`absolute -left-[1.05rem] top-3 size-2 rounded-full ${look.dot}`} />
                        <JobStop proposal={proposal} job={jobById.get(proposal.inquiryId)} />
                      </li>
                    );
                  })}
                  <li className="relative text-fluid-2xs text-slate-500">
                    <span className="absolute -left-[1.05rem] top-1 size-2 rounded-full bg-slate-700" />
                    도착 · 집{total == null ? '' : ` · 총 ${kmText(total)}`}
                  </li>
                </ol>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-fluid-2xs text-slate-700">
                    오전·오후 {between == null ? '해당 없음' : kmText(between)}
                  </span>
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-fluid-2xs text-white">
                    총 거리 {total == null ? '없음' : kmText(total)}
                  </span>
                </div>
                {reason ? (
                  <p className="mt-1.5 truncate text-fluid-2xs text-slate-600" title={reason}>
                    {reason}
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function shownSlot(proposal: AiDispatchProposal, job?: AiDispatchJob): (typeof SLOT_ORDER)[number] {
  if (job && job.slot !== 'HUMAN') return slotKey(job.slot);
  return slotKey(proposal.slot);
}

function JobStop({ proposal, job }: { proposal: AiDispatchProposal; job?: AiDispatchJob }) {
  const slot = SLOT_LOOK[shownSlot(proposal, job)];
  const toneSrc = internalCustomerToneImageSrc(job?.tone);
  const place = job?.areaLabel ? shortPlace(job.areaLabel) : '';
  const pyeong = job?.pyeong != null ? `${job.pyeong}평` : '평수 없음';
  return (
    <div className={`rounded-xl border px-2 py-1.5 ${slot.box}`}>
      <p className="text-fluid-2xs font-medium text-slate-600">{slot.label}</p>
      <p className="flex min-w-0 items-center gap-1 truncate text-fluid-xs font-semibold text-slate-900">
        {toneSrc ? <img src={toneSrc} alt={internalCustomerToneHint(job?.tone)} className="size-4 shrink-0" /> : null}
        <span className="truncate">{proposal.customerName}</span>
      </p>
      <p className="truncate text-fluid-2xs text-slate-600" title={job?.areaLabel}>
        {place || '주소 없음'} · {pyeong}
      </p>
    </div>
  );
}

function betweenOf(stops: AiDispatchJob[]): number | null {
  const am = stops.find((job) => job.slot === 'AM');
  const pm = stops.find((job) => job.slot === 'PM');
  if (!am || !pm || am.lat == null || am.lng == null || pm.lat == null || pm.lng == null) return null;
  return haversineKm({ lat: am.lat, lng: am.lng }, { lat: pm.lat, lng: pm.lng });
}

function loopOf(homeLat: number, homeLng: number, stops: AiDispatchJob[]): number | null {
  const ranked = stops
    .filter((job) => job.lat != null && job.lng != null)
    .slice()
    .sort((a, b) => SLOT_ORDER.indexOf(slotKey(a.slot)) - SLOT_ORDER.indexOf(slotKey(b.slot)));
  if (ranked.length === 0 || !Number.isFinite(homeLat) || !Number.isFinite(homeLng)) return null;
  const home = { lat: homeLat, lng: homeLng };
  let total = haversineKm(home, { lat: ranked[0].lat as number, lng: ranked[0].lng as number });
  for (let i = 1; i < ranked.length; i += 1) {
    total += haversineKm(
      { lat: ranked[i - 1].lat as number, lng: ranked[i - 1].lng as number },
      { lat: ranked[i].lat as number, lng: ranked[i].lng as number },
    );
  }
  const last = ranked[ranked.length - 1];
  total += haversineKm({ lat: last.lat as number, lng: last.lng as number }, home);
  return total;
}
