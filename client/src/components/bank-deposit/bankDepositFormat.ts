import type { BankDepositKind, BankDepositStatus } from '../../api/bankDeposits';
import type { StatusTone } from '../ui/StatusChip';

export const DEPOSIT_KIND_LABEL: Record<BankDepositKind, string> = {
  DEPOSIT: '계약금',
  BALANCE: '잔금',
  TOTAL: '총액',
  OTHER: '기타',
};

export const DEPOSIT_KIND_ORDER: BankDepositKind[] = ['DEPOSIT', 'BALANCE', 'TOTAL', 'OTHER'];

export const DEPOSIT_STATUS_LABEL: Record<BankDepositStatus, string> = {
  AUTO_LINKED: '자동 연결',
  LINKED: '연결함',
  NEEDS_REVIEW: '확인 필요',
  IGNORED: '청소와 무관',
  CANCELLED: '예약취소',
};

export const DEPOSIT_STATUS_TONE: Record<BankDepositStatus, StatusTone> = {
  AUTO_LINKED: 'green',
  LINKED: 'green',
  NEEDS_REVIEW: 'amber',
  IGNORED: 'gray',
  CANCELLED: 'red',
};

const TARGET_STATUS_LABEL: Record<string, string> = {
  PENDING: '대기',
  RECEIVED: '접수',
  DEPOSIT_PENDING: '입금대기',
  DEPOSIT_COMPLETED: '입금완료',
  ORDER_FORM_PENDING: '발주서 미제출',
  ASSIGNED: '분배완료',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  ON_HOLD: '보류',
  CANCELLED: '취소',
  CANCEL_CONFIRMED: '취소확인',
  CS_PROCESSING: 'C/S 처리중',
  REQUESTED: '요청',
  ABSENT: '부재',
  RESERVED: '예약완료',
  FULFILLED: '접수됨',
};

export function targetStatusLabel(target: 'inquiry' | 'followup', status: string | null | undefined): string {
  if (!status) return '';
  if (target === 'followup' && status === 'DEPOSIT_PENDING') return '예약금 대기';
  return TARGET_STATUS_LABEL[status] ?? '';
}

export function won(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

/** 오전 9:04 */
export function kstTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit' });
}

/** 11.24 (화) */
export function kstDayLabel(ymd: string | null | undefined): string {
  if (!ymd) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return '';
  const wd = ['일', '월', '화', '수', '목', '금', '토'][new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()];
  return `${Number(m[2])}.${Number(m[3])} (${wd})`;
}

/** 폰이 마지막으로 연결된 지 얼마나 됐는지. 20분 넘으면 끊긴 것으로 본다(앱은 15분마다 신호). */
export function deviceSeen(lastSeenAt: string | null | undefined, now = Date.now()): { ok: boolean; text: string } {
  if (!lastSeenAt) return { ok: false, text: '아직 연결된 적 없음' };
  const diffMin = Math.max(0, Math.floor((now - new Date(lastSeenAt).getTime()) / 60000));
  const ago =
    diffMin < 1 ? '방금' : diffMin < 60 ? `${diffMin}분 전` : diffMin < 1440 ? `${Math.floor(diffMin / 60)}시간 전` : `${Math.floor(diffMin / 1440)}일 전`;
  return { ok: diffMin <= 20, text: ago };
}
