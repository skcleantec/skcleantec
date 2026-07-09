import type { SoomgoExtractedChat } from '@shared/soomgoBridge';

export type SoomgoImportFieldKey =
  | 'customerName'
  | 'nickname'
  | 'phone'
  | 'pyeong'
  | 'address'
  | 'preferredMoveInCleanYmd'
  | 'requestMemo'
  | 'roomCount'
  | 'bathroomCount'
  | 'balconyCount';

export function formatSoomgoCountForCrm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  return String(value);
}

/** CRM·접수 API용 — 빈 문자열이면 undefined */
export function parseCrmRoomCountInput(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = parseInt(t, 10);
  if (!Number.isFinite(n) || n < 0 || n > 99) return undefined;
  return n;
}

export type SoomgoImportSummary = {
  filled: SoomgoImportFieldKey[];
  lines: string[];
  empty: string[];
};

export function normalizeSoomgoPreferredDate(raw: string | null | undefined): string {
  const t = raw?.trim() ?? '';
  if (!t) return '';
  const m = t.match(/(\d{4})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})/);
  if (!m) return t.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : '';
  const mm = m[2].padStart(2, '0');
  const dd = m[3].padStart(2, '0');
  return `${m[1]}-${mm}-${dd}`;
}

export function summarizeSoomgoImport(data: SoomgoExtractedChat): SoomgoImportSummary {
  const filled: SoomgoImportFieldKey[] = [];
  const lines: string[] = [];
  const empty: string[] = [];

  const name = (data.customerName || data.nickname)?.trim() || '';
  if (name) {
    filled.push('customerName', 'nickname');
    lines.push(`고객명·닉네임 → 접수란 상단`);
  } else {
    empty.push('고객명');
  }

  if (data.phone?.trim()) {
    filled.push('phone');
    lines.push(`연락처 → 접수란 연락처 (${data.phone.trim()})`);
  }

  if (data.pyeong) {
    filled.push('pyeong');
    lines.push(`평수 → 추가 필드 (${data.pyeong}평)`);
  } else {
    empty.push('평수');
  }

  const region = (data.region || data.address)?.trim() || '';
  if (region) {
    filled.push('address');
    lines.push(`주소/지역 → 추가 필드`);
  } else {
    empty.push('주소');
  }

  const preferred = normalizeSoomgoPreferredDate(data.preferredDate);
  if (preferred) {
    filled.push('preferredMoveInCleanYmd');
    lines.push(`희망일 → 추가 필드 (${preferred})`);
  } else if (data.preferredDate) {
    empty.push('희망일(형식)');
  } else {
    empty.push('희망일');
  }

  const memo = (data.requestMemo || data.memo)?.trim() || '';
  if (memo) {
    filled.push('requestMemo');
    lines.push('요청 상세 → 추가 필드 메모');
  }

  if (data.roomCount != null) {
    filled.push('roomCount');
    lines.push(`방 ${data.roomCount}개 → 추가 필드`);
  }
  if (data.bathroomCount != null) {
    filled.push('bathroomCount');
    lines.push(`화장실 ${data.bathroomCount}개 → 추가 필드`);
  }
  if (data.balconyCount != null) {
    filled.push('balconyCount');
    lines.push(`베란다 ${data.balconyCount}개 → 추가 필드`);
  }

  return { filled, lines, empty };
}

export function soomgoImportNoticeText(
  summary: SoomgoImportSummary,
  opts?: { safePhoneSkipped?: boolean },
): string {
  if (summary.lines.length === 0) {
    return '숨고에서 가져올 정보가 없습니다. 채팅방에서 고객명·고객 요청 모달을 확인해 주세요.';
  }
  const hint =
    summary.filled.some((k) =>
      k === 'pyeong' ||
      k === 'address' ||
      k === 'preferredMoveInCleanYmd' ||
      k === 'requestMemo' ||
      k === 'roomCount' ||
      k === 'bathroomCount' ||
      k === 'balconyCount',
    )
      ? ' 평수·주소·희망일·방/화장실/베란다는 접수란 「주소·희망일 등 추가」를 펼쳐 확인하세요.'
      : '';
  let tail = '';
  if (opts?.safePhoneSkipped && !summary.filled.includes('phone')) {
    tail = ' 안심번호 없음(채팅만 희망) — 채팅방 유지됨.';
  } else if (summary.filled.includes('phone')) {
    tail = ' 안심번호를 연락처에 넣었습니다.';
  }
  return `숨고 정보를 접수란에 채웠습니다: ${summary.lines.join(' · ')}.${hint}${tail}`;
}
