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

/** 사업자폰 경고 문구. SILENT(연결 끊김)는 기존 연결 끊김 안내가 맡는다. */
export function phoneAlertText(
  code: 'NOT_LISTENING' | 'NO_ACCESS' | 'KEEPALIVE_OFF' | 'SILENT' | 'OLD_APP',
): { short: string; title: string; body: string } | null {
  switch (code) {
    case 'NOT_LISTENING':
      return {
        short: '폰이 알림을 못 듣는 중',
        title: '사업자폰이 입금 알림을 못 듣고 있어요',
        body: '폰은 켜져 있지만 앱이 문자 알림을 읽지 못하는 상태입니다. 지금 들어오는 입금이 빠질 수 있어요. 폰에서 「청소비서 입금 알림」 앱을 한 번 열어 주세요. 계속되면 폰을 껐다 켜 주세요.',
      };
    case 'NO_ACCESS':
      return {
        short: '폰 알림 권한 꺼짐',
        title: '사업자폰의 알림 읽기 권한이 꺼져 있어요',
        body: '이 권한이 꺼지면 입금 문자를 전혀 받지 못합니다. 폰에서 앱을 열고 안내에 따라 「알림 접근」을 다시 켜 주세요.',
      };
    case 'KEEPALIVE_OFF':
      return {
        short: '폰 앱이 대기 중 아님',
        title: '사업자폰 앱이 계속 켜져 있는 상태가 아니에요',
        body: '화면이 꺼지면 입금 알림을 놓칠 수 있습니다. 폰에서 앱을 한 번 열어 주세요.',
      };
    case 'OLD_APP':
      return {
        short: '폰 앱이 예전 버전',
        title: '사업자폰 앱이 예전 버전이에요',
        body: '예전 앱은 알림을 듣고 있는지 알려 주지 않아, 놓쳐도 여기에 표시되지 않습니다. 새 버전으로 바꿔 주세요.',
      };
    default:
      return null;
  }
}
