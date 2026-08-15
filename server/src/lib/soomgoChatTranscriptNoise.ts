/** @see shared/soomgoChatTranscriptNoise.ts — 클라이언트·shared 와 동기화 */

const UI_NOISE_PATTERNS: RegExp[] = [
  /^요청\s*[·|]\s*견적$/,
  /^스마트\s*견적$/,
  /^마이\s*페이지$/,
  /^고수\s*찾기$/,
  /^커뮤니티$/,
  /^인터넷\s*가입$/,
  /^프로필\s*관리$/,
  /^받은\s*견적$/,
  /^채팅\s*메시지\s*검색/,
  /^고객\s*요청\s*보기$/,
  /^알림\s*끄기$/,
  /^신고\s*하기$/,
  /^채팅\s*\d+\+?$/,
  /^프로필$/,
  /브레이브\s*모바일/,
  /통신\s*판매\s*중개/,
  /거래\s*당사자/,
  /\[위험\]/,
  /100%\s*사기/,
  /사칭\s*공사/,
  /전자\s*세금\s*계산서/,
  /고수를\s*고용/,
  /견적\s*요청/,
  /자동\s*응답/,
  /채팅방\s*나가기/,
  /^입력\s*중$/,
  /^안읽음$/,
  /^읽음$/,
  /^\d{1,2}:\d{2}$/,
  /^\d{4}년\s*\d{1,2}월\s*\d{1,2}일/,
];

const SHORT_MENU_LABELS = new Set([
  '요청·견적',
  '요청|견적',
  '스마트견적',
  '마이페이지',
  '고수찾기',
  '커뮤니티',
  '인터넷가입',
  '프로필',
  '프로필관리',
  '받은견적',
  '알림끄기',
  '신고하기',
  '고객요청보기',
]);

function normalizeNoiseText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function isSoomgoChatTranscriptNoise(text: string): boolean {
  const t = normalizeNoiseText(text);
  if (!t || t.length < 2) return true;
  const compact = t.replace(/\s/g, '');
  if (SHORT_MENU_LABELS.has(compact)) return true;
  if (t.length <= 18 && /^채팅\d+\+?$/.test(compact)) return true;
  for (const re of UI_NOISE_PATTERNS) {
    if (re.test(t)) return true;
  }
  return false;
}

export function filterSoomgoChatMessages<T extends { role: string; text: string }>(
  messages: T[],
): T[] {
  return messages.filter((m) => {
    const role = m.role?.trim();
    const text = m.text?.trim();
    if (!text || role === 'system') return false;
    if (isSoomgoChatTranscriptNoise(text)) return false;
    return role === 'customer' || role === 'pro';
  });
}
