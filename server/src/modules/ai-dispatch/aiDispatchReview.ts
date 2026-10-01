import type { AiDispatchSlot } from './aiDispatch.constants.js';
import { leadersForJob, type DispatchJob, type DispatchLeader, type DispatchManualJob } from './aiDispatchContext.service.js';
import { callOpenAiJson } from '../ai/aiProvider.service.js';
import { haversineKm, slotJobWeight } from './aiDispatchRules.js';
import { periodAlreadyTaken } from './aiDispatchPairing.js';

/** 하루 보드를 다시 읽는 모델. 작은 모델이 초안을 덮어쓰던 호출은 쓰지 않는다. */
const DEFAULT_REVIEW_MODEL = 'gpt-6.1-sol';

export type ReviewDraftLine = {
  inquiryId: string;
  teamLeaderId: string | null;
  slot: AiDispatchSlot;
  reason: string;
  updatedAt: string;
};

type Geo = { lat: number | null; lng: number | null };

function kmBetween(a: Geo, b: Geo): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  return Math.round(haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) * 10) / 10;
}

function homeKm(leader: DispatchLeader, job: Geo): number | null {
  return kmBetween({ lat: leader.homeLat, lng: leader.homeLng }, job);
}

function conditionLabel(band: DispatchLeader['band']): string {
  if (band === '피로') return '나쁨';
  if (band === '매우피로') return '매우 나쁨';
  return band;
}

function movableJob(job: DispatchJob): boolean {
  return !job.blockedReason && job.requiredLeaders <= 1;
}

const REVIEW_SYSTEM = `당신은 입주청소 배정 담당입니다. 이미 짜인 하루 초안을 사람이 보드를 보듯 다시 읽습니다.
질문만 하지 마세요. 주어진 자료로 결정하고 JSON만 반환하세요.
거리는 직선 km이고 자동차 시간이 아닙니다. 오전과 오후를 묶는 기준은 현장과 현장의 거리입니다. 집은 누구를 보낼지만 정합니다.

볼 것:
- 같은 팀장의 오전과 오후는 현장이 가까운 짝으로 묶으세요. 현장이 먼 짝은 한 줄로 잇지 말고 각각 팀장을 두세요.
- 한 팀장에게 오전은 한 현장, 오후는 한 현장만 주세요. 오전 두 건, 오후 두 건은 넣지 마세요. 종일은 오전과 오후가 둘 다 비어 있을 때만 줍니다.
- 자리가 있으면 팀장 없이 두지 마세요. teamLeaderId를 비우는 것은 그 시간대 칸이 없거나 집 크기가 안 맞을 때뿐입니다.
- 피로가 높은 팀장(condition이 나쁨)은 집에서 현장까지 가까운 일정, 피로가 낮은 팀장은 집에서 먼 일정을 맡기세요.
- oneRoom이 true인 일정은 ONE_ROOM_ONLY에 먼저, 그다음 ONE_AND_TWO입니다. 그 팀장에게 자리가 있으면 UNRESTRICTED로 옮기지 마세요.
- jobsPerDay를 넘기지 마세요. seatsUsed는 이미 빠진 수동 일정과 팀장 2명 일정입니다. 초안의 오전·오후는 옮겨도 그 자리가 다시 납니다.
- fixed 일정과 eligibleUserIds 밖 팀장은 쓰지 마세요.
- 괜찮은 일정은 assignments에 넣지 마세요. 바꿀 일정만 넣으세요.
- lessons가 있으면 같은 상황에서 관리자가 고친 쪽을 따르세요. 그 수정은 이전 배정이 틀렸다는 뜻입니다. 하루 칸과 원·투룸 규칙은 깨지 마세요.
- reason은 한국어 한 문장이고 거리와 컨디션만 적으세요. 고객 이름과 전화번호는 쓰지 마세요.

JSON:
{"keep":false,"note":"","assignments":[{"inquiryId":"","teamLeaderId":"","reason":""}]}
고칠 것이 없으면 keep를 true로 하고 assignments는 빈 배열입니다.
teamLeaderId를 빈 문자열로 두면 그 일정은 팀장 없이 둡니다.`;

function buildReviewUser(
  lines: ReviewDraftLine[],
  jobs: DispatchJob[],
  leaders: DispatchLeader[],
  manualJobs: DispatchManualJob[],
  twoRoomMax: number,
  lessons: string[],
): string {
  const open = jobs.filter((job) => !job.blockedReason);
  const movable = open.filter(movableJob);
  const movableIds = new Set(movable.map((job) => job.id));
  const currentOf = (inquiryId: string) =>
    lines.find((line) => line.inquiryId === inquiryId && line.teamLeaderId)?.teamLeaderId ?? null;
  const fixedWeight = new Map(leaders.map((leader) => [leader.id, leader.usedJobs]));
  for (const line of lines) {
    if (!line.teamLeaderId || movableIds.has(line.inquiryId)) continue;
    const job = jobs.find((item) => item.id === line.inquiryId);
    fixedWeight.set(line.teamLeaderId, (fixedWeight.get(line.teamLeaderId) ?? 0) + slotJobWeight(job?.slot ?? line.slot));
  }
  const leaderCards = leaders.map((leader) => {
    const drafted = lines
      .filter((line) => line.teamLeaderId === leader.id)
      .map((line) => jobs.find((job) => job.id === line.inquiryId))
      .filter((job): job is DispatchJob => job != null);
    const manual = manualJobs.filter((job) => job.teamLeaderId === leader.id);
    const am = [...manual.filter((job) => job.slot === 'AM'), ...drafted.filter((job) => job.slot === 'AM')][0];
    const pm = [...manual.filter((job) => job.slot === 'PM'), ...drafted.filter((job) => job.slot === 'PM')][0];
    return {
      userId: leader.id,
      name: leader.name,
      jobsPerDay: leader.jobsPerDay,
      seatsUsed: fixedWeight.get(leader.id) ?? leader.usedJobs,
      sizePolicy: leader.sizePolicy,
      condition: conditionLabel(leader.band),
      morningToAfternoonKm: am && pm ? kmBetween(am, pm) : null,
      fixedStops: manual.map((job) => ({
        slot: job.slot,
        area: job.areaLabel,
        oneRoom: job.isOneRoom,
        fromHomeKm: homeKm(leader, job),
      })),
    };
  });
  const jobCards = movable.map((job) => ({
    inquiryId: job.id,
    slot: job.slot,
    area: job.areaLabel,
    pyeong: job.pyeong,
    oneRoom: job.isOneRoom,
    currentLeaderId: currentOf(job.id),
    eligibleUserIds: leadersForJob(leaders, job, twoRoomMax).map((leader) => leader.id),
    homeKm: leadersForJob(leaders, job, twoRoomMax).map((leader) => ({
      userId: leader.id,
      km: homeKm(leader, job),
    })),
  }));
  const ams = open.filter((job) => job.slot === 'AM');
  const pms = open.filter((job) => job.slot === 'PM');
  const closePairs = ams
    .flatMap((am) =>
      pms.map((pm) => ({
        morningId: am.id,
        afternoonId: pm.id,
        km: kmBetween(am, pm),
        morningLeaderId: currentOf(am.id),
        afternoonLeaderId: currentOf(pm.id),
      })),
    )
    .filter((pair) => pair.km != null)
    .sort((a, b) => (a.km ?? 999) - (b.km ?? 999))
    .slice(0, 15);
  return JSON.stringify({ lessons, leaders: leaderCards, jobs: jobCards, closePairs });
}

function applyReview(
  lines: ReviewDraftLine[],
  jobs: DispatchJob[],
  leaders: DispatchLeader[],
  manualJobs: DispatchManualJob[],
  twoRoomMax: number,
  json: Record<string, unknown>,
): { lines: ReviewDraftLine[]; changed: number; applied: boolean; note: string } {
  const note = typeof json.note === 'string' ? json.note.trim().slice(0, 180) : '';
  if (json.keep === true) return { lines, changed: 0, applied: true, note };
  if (!Array.isArray(json.assignments)) return { lines, changed: 0, applied: false, note: '' };
  if (json.assignments.length === 0) return { lines, changed: 0, applied: true, note };

  const movable = jobs.filter(movableJob);
  const movableIds = new Set(movable.map((job) => job.id));
  const fixed = lines.filter((line) => !movableIds.has(line.inquiryId));
  const used = new Map(leaders.map((leader) => [leader.id, leader.usedJobs]));
  for (const line of fixed) {
    if (!line.teamLeaderId) continue;
    const job = jobs.find((item) => item.id === line.inquiryId);
    used.set(line.teamLeaderId, (used.get(line.teamLeaderId) ?? 0) + slotJobWeight(job?.slot ?? line.slot));
  }
  const currentLeader = new Map<string, string | null>();
  for (const job of movable) {
    currentLeader.set(job.id, lines.find((line) => line.inquiryId === job.id && line.teamLeaderId)?.teamLeaderId ?? null);
  }
  const wantLeader = new Map(currentLeader);
  const wantReason = new Map<string, string>();
  const mentioned = new Set<string>();
  for (const raw of json.assignments) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as { inquiryId?: unknown; teamLeaderId?: unknown; reason?: unknown };
    const inquiryId = typeof row.inquiryId === 'string' ? row.inquiryId : '';
    if (!movableIds.has(inquiryId)) continue;
    const teamLeaderId = typeof row.teamLeaderId === 'string' ? row.teamLeaderId.trim() : '';
    wantLeader.set(inquiryId, teamLeaderId || null);
    mentioned.add(inquiryId);
    if (typeof row.reason === 'string' && row.reason.trim()) wantReason.set(inquiryId, row.reason.trim().slice(0, 160));
  }

  const placed = new Map<string, string>();
  const slotsOf = (leaderId: string) => {
    const slots = manualJobs.filter((row) => row.teamLeaderId === leaderId).map((row) => row.slot);
    for (const line of fixed) {
      if (line.teamLeaderId === leaderId) slots.push(line.slot);
    }
    for (const [inquiryId, id] of placed) {
      if (id !== leaderId) continue;
      const job = jobs.find((item) => item.id === inquiryId);
      if (job) slots.push(job.slot);
    }
    return slots;
  };
  const specialistOpen = (job: DispatchJob) =>
    leaders.some((leader) => {
      if (leader.sizePolicy !== 'ONE_ROOM_ONLY' && leader.sizePolicy !== 'ONE_AND_TWO') return false;
      if (!leadersForJob(leaders, job, twoRoomMax).some((item) => item.id === leader.id)) return false;
      if (periodAlreadyTaken(slotsOf(leader.id), job.slot)) return false;
      return (used.get(leader.id) ?? 0) + slotJobWeight(job.slot) <= leader.jobsPerDay;
    });
  const canPlace = (leaderId: string, job: DispatchJob) => {
    const leader = leaders.find((item) => item.id === leaderId);
    if (!leader) return false;
    if (!leadersForJob(leaders, job, twoRoomMax).some((item) => item.id === leaderId)) return false;
    if (periodAlreadyTaken(slotsOf(leaderId), job.slot)) return false;
    if ((used.get(leaderId) ?? 0) + slotJobWeight(job.slot) > leader.jobsPerDay) return false;
    if (job.isOneRoom && leader.sizePolicy !== 'ONE_ROOM_ONLY' && leader.sizePolicy !== 'ONE_AND_TWO' && specialistOpen(job)) {
      return false;
    }
    return true;
  };
  const tryPlace = (job: DispatchJob, leaderId: string | null, unassign: boolean) => {
    if (placed.has(job.id)) return;
    if (!leaderId) {
      const seatLeft = leaders.some((leader) => canPlace(leader.id, job));
      if (unassign && !seatLeft) placed.set(job.id, '');
      return;
    }
    if (!canPlace(leaderId, job)) return;
    used.set(leaderId, (used.get(leaderId) ?? 0) + slotJobWeight(job.slot));
    placed.set(job.id, leaderId);
  };
  const policyRank = (job: DispatchJob) => {
    if (!job.isOneRoom) return 3;
    const leader = leaders.find((item) => item.id === wantLeader.get(job.id));
    if (leader?.sizePolicy === 'ONE_ROOM_ONLY') return 0;
    if (leader?.sizePolicy === 'ONE_AND_TWO') return 1;
    return 2;
  };
  for (const job of [...movable].sort((a, b) => policyRank(a) - policyRank(b))) {
    const want = wantLeader.get(job.id) ?? null;
    tryPlace(job, want, want == null && mentioned.has(job.id));
  }
  for (const job of movable) {
    if (placed.has(job.id)) continue;
    if (mentioned.has(job.id) && (wantLeader.get(job.id) ?? null) == null) {
      placed.set(job.id, '');
      continue;
    }
    const original = currentLeader.get(job.id) ?? null;
    if (original) tryPlace(job, original, false);
    if (!placed.has(job.id)) placed.set(job.id, '');
  }

  const next = [...fixed];
  let changed = 0;
  for (const job of movable) {
    const leaderId = placed.get(job.id) || null;
    const before = currentLeader.get(job.id) ?? null;
    if (leaderId !== before) changed += 1;
    const previous = lines.find((line) => line.inquiryId === job.id);
    const modelReason = wantLeader.get(job.id) === leaderId ? wantReason.get(job.id) : '';
    const reason =
      leaderId != null
        ? modelReason || previous?.reason || '하루 전체를 보고 이 팀장에게 넣었습니다.'
        : modelReason || previous?.reason || '하루 전체를 보고 팀장 없이 두었습니다.';
    next.push({
      inquiryId: job.id,
      teamLeaderId: leaderId,
      slot: job.slot,
      reason: reason.slice(0, 160),
      updatedAt: job.updatedAt,
    });
  }
  return { lines: next, changed, applied: true, note };
}

export async function reviewDispatchBoard(input: {
  lines: ReviewDraftLine[];
  jobs: DispatchJob[];
  leaders: DispatchLeader[];
  manualJobs: DispatchManualJob[];
  twoRoomMax: number;
  lessons: string[];
}): Promise<{
  lines: ReviewDraftLine[];
  usage: { model: string; promptTokens: number; completionTokens: number } | null;
  changed: number;
  reviewed: boolean;
}> {
  const model = process.env.AI_DISPATCH_REVIEW_MODEL?.trim() || DEFAULT_REVIEW_MODEL;
  const result = await callOpenAiJson({
    product: 'ai_dispatch',
    system: REVIEW_SYSTEM,
    user: buildReviewUser(input.lines, input.jobs, input.leaders, input.manualJobs, input.twoRoomMax, input.lessons),
    model,
    reasoningEffort: 'medium',
    timeoutMs: 90_000,
    maxCompletionTokens: 8000,
  });
  if (!result.json || result.failed) {
    return { lines: input.lines, usage: result.usage, changed: 0, reviewed: false };
  }
  const applied = applyReview(input.lines, input.jobs, input.leaders, input.manualJobs, input.twoRoomMax, result.json);
  if (!applied.applied) return { lines: input.lines, usage: result.usage, changed: 0, reviewed: false };
  return { lines: applied.lines, usage: result.usage, changed: applied.changed, reviewed: true };
}
