/** 1:1 허용: 스태프↔현장, 관리자↔마케터. 마케터끼리·관리자끼리는 불가. */
export function canMessagePair(myRole: string, otherRole: string): boolean {
  const staff = myRole === 'ADMIN' || myRole === 'MARKETER';
  const otherStaff = otherRole === 'ADMIN' || otherRole === 'MARKETER';
  const fieldRole = (r: string) => r === 'TEAM_LEADER' || r === 'EXTERNAL_PARTNER';
  if (staff && fieldRole(otherRole)) return true;
  if (fieldRole(myRole) && otherStaff) return true;
  if ((myRole === 'ADMIN' && otherRole === 'MARKETER') || (myRole === 'MARKETER' && otherRole === 'ADMIN')) {
    return true;
  }
  return false;
}
