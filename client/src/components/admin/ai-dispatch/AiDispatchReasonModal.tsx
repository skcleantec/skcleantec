import { createPortal } from 'react-dom';
import type { AiDispatchBoard, AiDispatchJob, AiDispatchProposal } from '../../../api/aiDispatch';
import { LineMdIcon } from '../../ui/LineMdIcon';

const SLOT_ORDER = ['AM', 'ALL_DAY', 'PM', 'HUMAN'] as const;
const SLOT_LABEL: Record<(typeof SLOT_ORDER)[number], string> = {
  AM: '오전',
  ALL_DAY: '종일',
  PM: '오후',
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
  if (band === '매우피로') return '매우 나쁨';
  if (band === '피로') return '나쁨';
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
  return `${Math.round(km * 10) / 10}km`;
}

function jobBits(proposal: AiDispatchProposal, job?: AiDispatchJob): string {
  const slot = SLOT_LABEL[shownSlot(proposal, job)];
  const pyeong = job?.pyeong != null ? ` ${job.pyeong}평` : '';
  return `${slot} ${proposal.customerName}${pyeong}`;
}

function easeClause(reason: string): string {
  if (reason.includes('피로 점수가 더 높아')) return '피로가 높아 가까운 하루';
  if (reason.includes('피로 점수가 더 낮아')) return '피로가 낮아 조금 먼 하루';
  if (reason.includes('하루 1건')) return '하루 1건이라 집과의 거리만 봄';
  if (reason.includes('짝이 없어도')) return '짝이 없어도 남은 자리에 넣음';
  return '';
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
  const manualLeaderIds = new Set((board.manualJobs ?? []).map((job) => job.teamLeaderId));
  const manualRows = (board.manualJobs ?? []).slice().sort((a, b) => {
    const slot = SLOT_ORDER.indexOf(slotKey(a.slot)) - SLOT_ORDER.indexOf(slotKey(b.slot));
    if (slot !== 0) return slot;
    return a.teamLeaderName.localeCompare(b.teamLeaderName, 'ko');
  });
  const idle = board.leaders.filter((leader) => !groups.has(leader.id) && !manualLeaderIds.has(leader.id));
  const idleWithRoom = idle.filter((leader) => leader.remainingJobs > 0).map((leader) => leader.name);
  const idleFull = idle.filter((leader) => leader.remainingJobs <= 0).map((leader) => leader.name);
  const skipReason = unassigned.every((row) => row.reason.includes('넣을 팀장'))
    ? '넣을 팀장이 없습니다.'
    : idleWithRoom.length > 0
      ? `자리 남음: ${idleWithRoom.join(', ')}`
      : idleFull.length > 0
        ? `오늘 칸이 찬 팀장: ${idleFull.join(', ')}`
        : '오늘 칸이 남은 팀장이 없습니다.';

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
        className="modal-mobile-fullscreen-panel flex max-h-[min(92vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
          <h2 id="ai-dispatch-reason-title" className="text-fluid-sm font-semibold text-slate-900">
            이렇게 배정한 이유
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            aria-label="닫기"
          >
            <LineMdIcon name="close" className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
          {manualRows.length > 0 ? (
            <section className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2">
              <p className="text-fluid-xs font-semibold text-rose-950">수동배정 {manualRows.length}건</p>
              <p className="mt-0.5 text-fluid-2xs leading-snug text-rose-950">
                {manualRows
                  .map((job) => `${SLOT_LABEL[slotKey(job.slot)]} ${job.customerName}${job.pyeong != null ? ` ${job.pyeong}평` : ''} · ${job.teamLeaderName}`)
                  .join(' · ')}
              </p>
            </section>
          ) : null}
          {unassigned.length > 0 ? (
            <section className="rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-2">
              <p className="text-fluid-xs font-semibold text-slate-900">
                팀장 없음 {unassigned.length}건
                <span className="ml-2 font-medium text-slate-600">{skipReason}</span>
              </p>
            </section>
          ) : null}
          <ul className="space-y-1.5">
            {leaderIds.map((leaderId) => {
              const leader = leaderById.get(leaderId);
              const rows = (groups.get(leaderId) ?? []).slice().sort((a, b) => {
                const ai = SLOT_ORDER.indexOf(shownSlot(a, jobById.get(a.inquiryId)));
                const bi = SLOT_ORDER.indexOf(shownSlot(b, jobById.get(b.inquiryId)));
                return ai - bi;
              });
              const jobs = rows
                .map((row) => jobById.get(row.inquiryId))
                .filter((job): job is AiDispatchJob => job != null && job.lat != null && job.lng != null);
              const am = jobs.find((job) => job.slot === 'AM');
              const pm = jobs.find((job) => job.slot === 'PM');
              const between =
                am && pm && am.lat != null && am.lng != null && pm.lat != null && pm.lng != null
                  ? haversineKm({ lat: am.lat, lng: am.lng }, { lat: pm.lat, lng: pm.lng })
                  : null;
              const total = leader ? loopKm(leader.homeLat, leader.homeLng, jobs) : null;
              const reason = rows.map((row) => row.reason).join(' ');
              const why = [
                between == null ? null : `두 곳 ${kmText(between)}`,
                total == null ? null : `집까지 ${kmText(total)}`,
                easeClause(reason),
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <li key={leaderId} className="rounded-xl border border-slate-200 px-2.5 py-2">
                  <p className="truncate text-fluid-sm font-semibold text-slate-900">
                    {leader?.name ?? rows[0]?.teamLeaderName ?? '팀장'}
                    {leader ? (
                      <span className="ml-2 text-fluid-2xs font-medium text-slate-500">
                        피로 {leader.fatigue} · {bandWord(leader.band)}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-fluid-xs text-slate-800">
                    {rows.map((row) => jobBits(row, jobById.get(row.inquiryId))).join(' · ')}
                  </p>
                  {why ? <p className="mt-0.5 text-fluid-2xs text-slate-600">{why}</p> : null}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function loopKm(homeLat: number, homeLng: number, stops: AiDispatchJob[]): number | null {
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
  return total + haversineKm({ lat: last.lat as number, lng: last.lng as number }, home);
}
