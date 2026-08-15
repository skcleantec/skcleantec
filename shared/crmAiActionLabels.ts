const EN_ACTION_LABELS: Record<string, string> = {
  confirmprice: '가격 안내',
  confirmteam: '팀 구성 안내',
  confirmschedule: '일정 안내',
  confirmdeposit: '예약금·결제 안내',
  explainmoveincleaning: '입주청소 설명',
  explaincompletioncleaning: '준공청소 설명',
  explaindifference: '입주·준공 차이 설명',
  answerquestion: '고객 질문 답변',
  sendquote: '견적 안내',
  followup: '후속 연락',
};

function normalizeKey(action: string): string {
  return action.trim().replace(/[\s_-]+/g, '').toLowerCase();
}

/** AI nextActions.action — 영문 코드면 한국어 라벨로 */
export function formatCrmAiActionLabel(action: string): string {
  const trimmed = action.trim();
  if (!trimmed) return '추천 답장';
  if (/[가-힣]/.test(trimmed)) return trimmed;
  const mapped = EN_ACTION_LABELS[normalizeKey(trimmed)];
  if (mapped) return mapped;
  if (/^[a-z][a-zA-Z0-9_]*$/.test(trimmed)) return '고객 질문 답변';
  return trimmed;
}
