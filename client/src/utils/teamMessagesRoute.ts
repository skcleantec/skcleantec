/** 팀장 메시지(채팅) 화면 — 상단 알림 배너를 숨겨 창 높이를 유지한다. */
export function isTeamMessagesPath(pathname: string): boolean {
  return pathname === '/team/messages' || pathname.startsWith('/team/messages/');
}
