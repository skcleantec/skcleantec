const FOLLOWUP_STATUS_LABEL: Record<string, string> = {
  REQUESTED: '요청',
  ABSENT: '부재',
  DEPOSIT_PENDING: '예약금 대기',
  ON_HOLD: '보류·고민',
  RESERVED: '입금 완료',
  FULFILLED: '처리 완료',
};

const FOLLOWUP_LOG_ACTION_LABEL: Record<string, string> = {
  CREATE: '등록',
  STATUS: '상태 변경',
  CUSTOMER_PHONE: '연락처 변경',
  CUSTOMER_PHONE2: '연락처2 변경',
  CUSTOMER_NAME: '고객명 변경',
  NICKNAME: '닉네임 변경',
  MEMO: '메모 수정',
  NEXT_CONTACT: '다음 연락 예정',
  INQUIRY_LINK: '접수 연결',
  PREFERRED_MOVE_IN_CLEANING_DATE: '입주청소 희망일 변경',
  DEFER: '보류 횟수',
  GOLD_DB: '골드DB',
  HANDLED_BY: '담당 변경',
};

function statusLabel(code: unknown): string {
  if (typeof code !== 'string' || !code.trim()) return '';
  return FOLLOWUP_STATUS_LABEL[code.trim().toUpperCase()] ?? code.trim();
}

function fmtPhone(raw: unknown): string {
  if (raw == null || raw === '') return '(없음)';
  const s = String(raw).trim();
  return s || '(없음)';
}

function fmtDateKo(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (!s) return null;
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s.slice(0, 10);
    return d.toLocaleString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return s.slice(0, 16);
  }
}

function tryParseJson(detail: string): unknown {
  try {
    return JSON.parse(detail) as unknown;
  } catch {
    return null;
  }
}

export function formatFollowupLogTitle(action: string): string {
  const key = action.trim().toUpperCase();
  const label = FOLLOWUP_LOG_ACTION_LABEL[key] ?? '변경';
  return `부재·보류 · ${label}`;
}

export function formatFollowupLogDetail(action: string, detail: string | null | undefined): string | null {
  const raw = detail?.trim();
  if (!raw) return null;

  const key = action.trim().toUpperCase();

  if (key === 'NEXT_CONTACT') {
    return fmtDateKo(raw) ? `다음 연락: ${fmtDateKo(raw)}` : null;
  }

  if (key === 'MEMO') {
    return raw.length > 120 ? `${raw.slice(0, 120)}…` : raw;
  }

  const parsed = tryParseJson(raw);
  if (!parsed || typeof parsed !== 'object') {
    return raw.length > 120 ? `${raw.slice(0, 120)}…` : raw;
  }

  const o = parsed as Record<string, unknown>;

  if (key === 'CREATE') {
    const parts: string[] = [];
    const st = statusLabel(o.status);
    if (st) parts.push(`상태 ${st}`);
    if (typeof o.customerName === 'string' && o.customerName.trim()) {
      parts.push(`고객 ${o.customerName.trim()}`);
    }
    if (typeof o.nickname === 'string' && o.nickname.trim()) {
      parts.push(`닉네임 ${o.nickname.trim()}`);
    }
    if (typeof o.customerPhone === 'string' && o.customerPhone.trim()) {
      parts.push(`연락처 ${o.customerPhone.trim()}`);
    }
    if (typeof o.preferredMoveInCleaningDate === 'string' && o.preferredMoveInCleaningDate.trim()) {
      parts.push(`입주청소 희망 ${o.preferredMoveInCleaningDate.trim()}`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  if (key === 'STATUS') {
    const from = statusLabel(o.from);
    const to = statusLabel(o.to);
    if (from && to && from === to) return `상태 ${to}`;
    if (from && to) return `${from} → ${to}`;
    if (to) return `상태 ${to}`;
    return null;
  }

  if (key === 'CUSTOMER_PHONE' || key === 'CUSTOMER_PHONE2') {
    return `${fmtPhone(o.from)} → ${fmtPhone(o.to)}`;
  }

  if (key === 'CUSTOMER_NAME' || key === 'NICKNAME') {
    const from = o.from == null || o.from === '' ? '(없음)' : String(o.from);
    const to = o.to == null || o.to === '' ? '(없음)' : String(o.to);
    return `${from} → ${to}`;
  }

  if (key === 'PREFERRED_MOVE_IN_CLEANING_DATE') {
    const from = o.from == null || o.from === '' ? '(없음)' : String(o.from);
    const to = o.to == null || o.to === '' ? '(없음)' : String(o.to);
    return `${from} → ${to}`;
  }

  if (key === 'INQUIRY_LINK') {
    if (o.to) return '접수에 연결했습니다';
    if (o.from) return '접수 연결을 해제했습니다';
    return null;
  }

  return null;
}

export function formatCsTimelineTitle(status: string): string {
  const map: Record<string, string> = {
    OPEN: '접수',
    IN_PROGRESS: '처리 중',
    RESOLVED: '처리 완료',
    CLOSED: '종료',
  };
  const label = map[status.trim().toUpperCase()] ?? status.trim();
  return `C/S · ${label}`;
}

/** 접촉 이력 API가 구버전이어도 화면에서 읽기 쉽게 보정 */
export function humanizeContactTimelineRow(row: {
  kind: string;
  title: string;
  detail: string | null;
}): { title: string; detail: string | null } {
  if (row.kind !== 'followup_log') return row;

  const actionMatch = row.title.match(/부재·보류\s*·\s*(\w+)/);
  const action = actionMatch?.[1]?.trim() ?? '';
  const looksRawAction = /^[A-Z_]+$/.test(action);

  let title = row.title;
  let detail = row.detail;

  if (looksRawAction) {
    title = formatFollowupLogTitle(action);
    const formatted = formatFollowupLogDetail(action, detail ?? undefined);
    if (formatted) detail = formatted;
    else if (detail && detail.trim().startsWith('{')) detail = null;
  } else if (detail && detail.trim().startsWith('{')) {
    for (const tryAction of [
      'CREATE',
      'STATUS',
      'CUSTOMER_PHONE',
      'CUSTOMER_PHONE2',
      'CUSTOMER_NAME',
      'NICKNAME',
      'NEXT_CONTACT',
      'INQUIRY_LINK',
    ]) {
      const formatted = formatFollowupLogDetail(tryAction, detail);
      if (formatted) {
        detail = formatted;
        break;
      }
    }
  }

  return { title, detail };
}
