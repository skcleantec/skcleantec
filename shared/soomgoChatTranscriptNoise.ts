/** 숨고 DOM 수집 시 UI·GNB·법적 고지 등 — 실제 채팅이 아닌 텍스트 판별 */

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

/** GNB·푸터처럼 짧은 메뉴 라벨만 있는 경우 (실제 대화 문장 아님) */
const SHORT_MENU_LABELS = new Set([
  '요청·견적',
  '요청|견적',
  '스마트견적',
  '마이페이지',
  '고수찾기',
  '커뮤니티',
  '인터넷가입',
  '프로필',
  '프로필 관리',
  '받은 견적',
  '알림 끄기',
  '신고하기',
  '고객 요청 보기',
]);

function normalizeNoiseText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function isSoomgoChatTranscriptNoise(text: string): boolean {
  const t = normalizeNoiseText(text);
  if (!t || t.length < 2) return true;
  if (SHORT_MENU_LABELS.has(t.replace(/\s/g, ''))) return true;
  if (t.length <= 18 && /^채팅\d+\+?$/.test(t.replace(/\s/g, ''))) return true;
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
