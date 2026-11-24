/** 예약취소·휴무 팀장. DB 없이 판정한다. */

export type InquiryDepositSync = 'cancel' | 'restore' | 'none';

/** 접수 상태가 취소가 되거나, 취소에서 돌아오면 연결된 입금을 따라가게 한다. */
export function inquiryDepositSync(previousStatus: string, nextStatus: string): InquiryDepositSync {
  const wasCancelled = previousStatus === 'CANCELLED';
  const nowCancelled = nextStatus === 'CANCELLED';
  if (!wasCancelled && nowCancelled) return 'cancel';
  if (wasCancelled && !nowCancelled) return 'restore';
  return 'none';
}

/** 취소 전 상태가 없으면, 연결이 있으면 LINKED, 없으면 NEEDS_REVIEW. */
export function restoredDepositStatus(input: {
  cancelPrevStatus: string | null;
  linked: boolean;
}): string {
  const prev = input.cancelPrevStatus;
  if (prev && prev !== 'CANCELLED') return prev;
  return input.linked ? 'LINKED' : 'NEEDS_REVIEW';
}

export function leadersOnDuty<T extends { id: string }>(
  leaders: T[],
  dayOffIds: ReadonlySet<string>,
  skipDayOff: boolean,
): T[] {
  if (!skipDayOff) return leaders;
  return leaders.filter((leader) => !dayOffIds.has(leader.id));
}

export function depositListCounts(groups: Array<{ status: string; n: number }>) {
  const counts = { today: 0, autoLinked: 0, needsReview: 0, ignored: 0, cancelled: 0 };
  for (const group of groups) {
    counts.today += group.n;
    if (group.status === 'AUTO_LINKED') counts.autoLinked += group.n;
    if (group.status === 'NEEDS_REVIEW') counts.needsReview += group.n;
    if (group.status === 'IGNORED') counts.ignored += group.n;
    if (group.status === 'CANCELLED') counts.cancelled += group.n;
  }
  return counts;
}

const LINKED_FOR_BLOCK = new Set(['AUTO_LINKED', 'LINKED']);

/** 예약취소된 입금은 이미 연결된 종류로 세지 않는다. */
export function kindBlocksDeposit(status: string): boolean {
  return LINKED_FOR_BLOCK.has(status);
}
