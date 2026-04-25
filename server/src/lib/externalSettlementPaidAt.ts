const YMD = /^\d{4}-\d{2}-\d{2}$/;

function kstYmd(d: Date): string {
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

/**
 * 타업체 정산 기록의 paidAt.
 * - 생략·빈 문자열: 요청 시각(기존 동작)
 * - YYYY-MM-DD: 해당일 정오 KST(표시·월 집계 시 날짜가 흔들리지 않도록)
 */
export function resolveExternalSettlementPaidAt(
  paidDateRaw: unknown
): { ok: true; paidAt: Date } | { ok: false; error: string } {
  if (paidDateRaw === undefined || paidDateRaw === null) {
    return { ok: true, paidAt: new Date() };
  }
  if (typeof paidDateRaw === 'string' && !paidDateRaw.trim()) {
    return { ok: true, paidAt: new Date() };
  }
  const s = typeof paidDateRaw === 'string' ? paidDateRaw.trim() : '';
  if (!YMD.test(s)) {
    return { ok: false, error: '정산일은 YYYY-MM-DD 형식이어야 합니다.' };
  }
  const todayKst = kstYmd(new Date());
  if (s > todayKst) {
    return { ok: false, error: '정산일은 오늘(한국) 이후로 설정할 수 없습니다.' };
  }
  return { ok: true, paidAt: new Date(`${s}T12:00:00+09:00`) };
}
