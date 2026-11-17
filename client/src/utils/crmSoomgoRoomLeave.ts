/** 숨고 창이 채팅방인지. 목록·요청·그 밖은 방이 아님. */
export type SoomgoRoomSnapshot = {
  inRoom: boolean;
  chatId: string | null;
};

/** CRM이 직접 옮긴 직후. 다른 방으로 연 것만 제외하고, 목록으로 나간 것은 비운다. */
export type SoomgoSelfNavKind = 'open-room' | 'return-list';

export type SoomgoRoomLeaveDecision = 'clear-list' | 'clear-room' | 'keep' | 'defer' | 'noop';

export function soomgoRoomSnapshot(status: {
  inChatRoom?: boolean;
  pageMode?: string | null;
  chatId?: string | null;
} | null | undefined): SoomgoRoomSnapshot {
  const inRoom = Boolean(status?.inChatRoom) || status?.pageMode === 'chat_room';
  const chatId = inRoom ? status?.chatId?.trim() || null : null;
  return { inRoom, chatId };
}

/**
 * 직전 상태와 지금 상태로 접수란을 비울지 정한다.
 * - 방→목록, 사용자가 방→다른 방: 내용이 있으면 비움
 * - 처음부터 목록, 같은 목록, 브릿지가 막 켜진 첫 상태: 유지
 * - CRM이 연 방에서 목록으로 나감: 비움. CRM이 다른 방으로 연 전환만 유지
 * - 「목록으로」는 저장 흐름이 비우므로 여기서는 유지
 * - 가져오기·채팅 열기 중: 보류
 * - 내용 없음: 비우지 않음
 */
export function decideSoomgoRoomLeave(input: {
  prev: SoomgoRoomSnapshot | null;
  next: SoomgoRoomSnapshot;
  hasContent: boolean;
  busy: boolean;
  selfNav: SoomgoSelfNavKind | null;
}): SoomgoRoomLeaveDecision {
  if (input.busy) return 'defer';
  if (!input.prev) return 'keep';
  if (input.selfNav === 'return-list') return 'keep';

  const leftRoom = input.prev.inRoom && !input.next.inRoom;
  const switchedRoom =
    input.prev.inRoom &&
    input.next.inRoom &&
    Boolean(input.prev.chatId) &&
    Boolean(input.next.chatId) &&
    input.prev.chatId !== input.next.chatId;

  if (switchedRoom && input.selfNav === 'open-room') return 'keep';
  if (!leftRoom && !switchedRoom) return 'keep';
  if (!input.hasContent) return 'noop';
  if (leftRoom) return 'clear-list';
  return 'clear-room';
}
